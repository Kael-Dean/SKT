// src/pages/OrderCorrection.jsx
import { useEffect, useMemo, useRef, useState, forwardRef, useImperativeHandle } from "react";
import { apiAuth } from "../../lib/api";
import { getUser } from "../../lib/auth";
import { ChevronLeft, ChevronRight } from "lucide-react";
import {
  cx, baseField, labelCls, submitBtnCls, resetBtnCls, spinnerCls, primaryBtnCls, neutralBtnCls, dangerBtnCls,
} from "../../lib/styles";
import { SkeletonTableRows, Sheet, DataList, Badge, EmptyState, ConfirmDialog, toast } from "../../components/ui";
import ComboBox from "../../components/ComboBox";
import { useIsPhone } from "../../hooks/useMediaQuery";

/* ---------------- Utilities (ทนทานต่อค่าที่ไม่ใช่สตริง) ---------------- */
const asString = (v) => (v === null || v === undefined ? "" : String(v));
const onlyDigits = (s = "") => asString(s).replace(/\D+/g, "");
const cleanDecimal = (s = "") => asString(s).replace(/[^\d.]/g, "");
const toNumber = (v) => (v === "" || v === null || v === undefined ? 0 : Number(v));
const thb = (n) =>
  new Intl.NumberFormat("th-TH", { style: "currency", currency: "THB", maximumFractionDigits: 2 }).format(
    isFinite(n) ? n : 0
  );
const baht = (n) =>
  new Intl.NumberFormat("th-TH", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(
    isFinite(n) ? n : 0
  );

function useDebounce(value, delay = 400) {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(t);
  }, [value, delay]);
  return debounced;
}

/* ---------------- DateInput (เหมือนหน้าออเดอร์) ---------------- */
const DateInput = forwardRef(function DateInput({ error = false, className = "", ...props }, ref) {
  const inputRef = useRef(null);
  useImperativeHandle(ref, () => inputRef.current);
  return (
    <div className="relative">
      <style>{`input[type="date"]::-webkit-calendar-picker-indicator { opacity: 0; }`}</style>
      <input
        type="date"
        ref={inputRef}
        className={[baseField, "pr-12 cursor-pointer", error ? "border-red-400 ring-2 ring-red-300/70" : "", className].join(" ")}
        {...props}
      />
      <button
        type="button"
        onClick={() => {
          const el = inputRef.current;
          if (!el) return;
          if (typeof el.showPicker === "function") el.showPicker();
          else {
            el.focus();
            el.click?.();
          }
        }}
        aria-label="เปิดตัวเลือกวันที่"
        className="absolute right-2 top-1/2 -translate-y-1/2 inline-flex size-11 md:size-9 items-center justify-center rounded-xl transition-transform hover:scale-110 active:scale-95 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 cursor-pointer bg-transparent"
      >
        <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor" className="text-slate-600 dark:text-slate-200">
          <path d="M7 2a1 1 0 0 1 1 1v1h8V3a1 1 0 1 1 2 0v1h1a2 2 0 0 1 2 2v3H3V6a2 2 0 0 1 2-2h1V3a1 1 0 1 1 1-1zm14 9v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-7h18zM7 14h2v2H7v-2zm4 0h2v2h-2v-2z" />
        </svg>
      </button>
    </div>
  );
});

/* ---------------- Page ---------------- */
const PAGE_SIZE = 100;

function OrderCorrection() {
  const isPhone = useIsPhone();
  /* Dates */
  const today = new Date().toISOString().slice(0, 10);
  const firstDayThisMonth = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().slice(0, 10);

  /* Buy/Sell toggle */
  const [mode, setMode] = useState("buy"); // buy | sell

  /* list + pagination */
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(1);
  const [pageInput, setPageInput] = useState("1");
  const totalPages = useMemo(() => Math.max(1, Math.ceil(rows.length / PAGE_SIZE)), [rows.length]);
  const pagedRows = useMemo(() => {
    const start = (page - 1) * PAGE_SIZE;
    return rows.slice(start, start + PAGE_SIZE);
  }, [rows, page]);

  /* --- เพิ่มตัวกันคำขอซ้อน (กันข้อมูลย้อนกลับจากคำขอเก่า) --- */
  const listReqId = useRef(0);

  /* dropdown opts */
  const [optionsLoading, setOptionsLoading] = useState(true);
  const [branchOptions, setBranchOptions] = useState([]);
  const [klangOptions, setKlangOptions] = useState([]);
  const [specOptions, setSpecOptions] = useState([]);
  const [specDict, setSpecDict] = useState({});
  const [paymentBuy, setPaymentBuy] = useState([]); // 3,4
  const [paymentSell, setPaymentSell] = useState([]); // 1,2
  const getPaymentLabel = (type, id) => {
    const opts = type === "sell" ? paymentSell : paymentBuy;
    return opts.find((o) => String(o.id) === String(id))?.label || (id ? String(id) : "-");
  };

  /* filters */
  const [filters, setFilters] = useState({
    startDate: firstDayThisMonth,
    endDate: today,
    branchId: "",
    branchName: "",
    klangId: "",
    klangName: "",
    q: "",
  });
  const [errors, setErrors] = useState({ startDate: "", endDate: "" });
  const debouncedQ = useDebounce(filters.q, 500);

  /* validate date range */
  const validateDates = (s, e) => {
    const out = { startDate: "", endDate: "" };
    if (!s) out.startDate = "กรุณาเลือกวันที่เริ่ม";
    if (!e) out.endDate = "กรุณาเลือกวันที่สิ้นสุด";
    if (s && e) {
      const sd = new Date(s),
        ed = new Date(e);
      if (ed < sd) out.endDate = "วันสิ้นสุดต้องไม่ก่อนวันเริ่มต้น";
    }
    setErrors(out);
    return !out.startDate && !out.endDate;
  };
  useEffect(() => {
    validateDates(filters.startDate, filters.endDate);
  }, [filters.startDate, filters.endDate]);

  /* load static options */
  useEffect(() => {
    const loadInitial = async () => {
      try {
        setOptionsLoading(true);
        const [branches, specs, payB, payS] = await Promise.all([
          apiAuth(`/order/branch/search`),
          apiAuth(`/order/form/search`),
          apiAuth(`/order/payment/search/buy`),
          apiAuth(`/order/payment/search/sell`),
        ]);

        setBranchOptions((Array.isArray(branches) ? branches : []).map((x) => ({ id: String(x.id), label: x.branch_name })));

        const opts = (Array.isArray(specs) ? specs : [])
          .map((r) => ({
            id: String(r.id),
            label: String(r.prod_name || r.name || r.spec_name || `spec #${r.id}`).trim(),
            raw: r,
          }))
          .filter((o) => o.id && o.label);
        setSpecOptions(opts.map((o) => ({ id: o.id, label: o.label })));
        const dict = {};
        opts.forEach((o) => {
          dict[o.id] = o.raw;
        });
        setSpecDict(dict);

        setPaymentBuy((Array.isArray(payB) ? payB : []).map((p) => ({ id: String(p.id), label: p.payment })));
        setPaymentSell((Array.isArray(payS) ? payS : []).map((p) => ({ id: String(p.id), label: p.payment })));
      } catch (e) {
        console.error("load initial options failed:", e);
        setBranchOptions([]);
        setSpecOptions([]);
        setPaymentBuy([]);
        setPaymentSell([]);
      } finally {
        setOptionsLoading(false);
      }
    };
    loadInitial();
  }, []);

  /* branch -> klang */
  useEffect(() => {
    const run = async () => {
      if (!filters.branchId) {
        setKlangOptions([]);
        setFilters((p) => ({ ...p, klangId: "", klangName: "" }));
        return;
      }
      try {
        const data = await apiAuth(`/order/klang/search?branch_id=${filters.branchId}`);
        setKlangOptions((Array.isArray(data) ? data : []).map((x) => ({ id: String(x.id), label: x.klang_name })));
      } catch (e) {
        console.error("load klang failed:", e);
        setKlangOptions([]);
      }
    };
    run();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters.branchId]);

  /* fetch orders (ป้องกันข้อมูลย้อนด้วย reqId) */
  const fetchOrders = async () => {
    if (!validateDates(filters.startDate, filters.endDate)) return;

    const myReq = ++listReqId.current; // ทำให้คำขอเก่ากลายเป็นของเดิมทันที
    try {
      setLoading(true);
      const params = new URLSearchParams();
      params.set("start_date", filters.startDate);
      params.set("end_date", filters.endDate);
      if (filters.branchId) params.set("branch_id", filters.branchId);
      if (filters.klangId) params.set("klang_id", filters.klangId);
      if (filters.q?.trim()) params.set("q", filters.q.trim());

      const endpoint = mode === "buy" ? `/order/orders/buy-report` : `/order/orders/sell-report`;
      const data = await apiAuth(`${endpoint}?${params.toString()}`);

      // ถ้าไม่ใช่คำขอล่าสุด ให้เมินผลลัพธ์นี้
      if (listReqId.current !== myReq) return;

      setRows(Array.isArray(data) ? data : []);
      setPage(1);
      setPageInput("1");
    } catch (e) {
      console.error(e);
      if (listReqId.current !== myReq) return;
      setRows([]);
      setPage(1);
      setPageInput("1");
    } finally {
      if (listReqId.current === myReq) {
        setLoading(false);
      }
    }
  };

  useEffect(() => {
    fetchOrders();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // เมื่อเปลี่ยนโหมด: เคลียร์ข้อมูลและขึ้นสถานะโหลดทันที + ตัดคำขอเก่า
  const switchMode = (next) => {
    if (next === mode) return;
    listReqId.current += 1; // invalidate คำขอที่กำลังรออยู่
    setLoading(true);       // ให้ UI โชว์ "กำลังโหลด..." ทันที
    setRows([]);            // ป้องกันข้อมูลโหมดเดิมค้างจอ
    setPage(1);
    setPageInput("1");
    setMode(next);          // useEffect ด้านล่างจะเรียก fetchOrders ต่อให้เอง
  };

  useEffect(() => {
    fetchOrders();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode]);

  useEffect(() => {
    if (filters.q.length >= 2 || filters.q.length === 0) fetchOrders();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedQ]);

  /* totals */
  const totals = useMemo(() => {
    let weight = 0,
      revenue = 0;
    rows.forEach((x) => {
      weight += toNumber(x.weight);
      revenue += toNumber(x.price);
    });
    return { weight, revenue };
  }, [rows]);

  /* pagination helpers */
  useEffect(() => {
    setPage((p) => Math.min(Math.max(1, p), totalPages));
    setPageInput((v) => String(Math.min(Math.max(1, toNumber(onlyDigits(v)) || 1), totalPages)));
  }, [totalPages]);

  const goToPage = (p) => {
    const n = Math.min(Math.max(1, toNumber(p)), totalPages);
    setPage(n);
    setPageInput(String(n));
    try {
      const main = document.querySelector("main");
      if (main && typeof main.scrollTo === "function") main.scrollTo({ top: 0, behavior: "smooth" });
      window?.scrollTo?.({ top: 0, behavior: "smooth" }); // body is the scroller now (plan §A7)
    } catch (_) {}
  };
  const nextPage = () => goToPage(page + 1);
  const prevPage = () => goToPage(page - 1);
  const onCommitPageInput = () => {
    const n = toNumber(onlyDigits(pageInput));
    if (!n) {
      setPageInput(String(page));
      return;
    }
    goToPage(n);
  };
  const pageItems = useMemo(() => {
    const items = [];
    const delta = 2;
    const left = Math.max(1, page - delta);
    const right = Math.min(totalPages, page + delta);
    if (left > 1) items.push(1);
    if (left > 2) items.push("...");
    for (let i = left; i <= right; i++) items.push(i);
    if (right < totalPages - 1) items.push("...");
    if (right < totalPages) items.push(totalPages);
    return items;
  }, [page, totalPages]);

  /* reset filters */
  const resetFilters = () => {
    setFilters({
      startDate: firstDayThisMonth,
      endDate: today,
      branchId: "",
      branchName: "",
      klangId: "",
      klangName: "",
      q: "",
    });
    setKlangOptions([]);
    setPage(1);
    setPageInput("1");
    setErrors({ startDate: "", endDate: "" });
  };

  /* ---------------- Edit Modal ---------------- */
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(null);
  const [draft, setDraft] = useState(null);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  // Esc / backdrop / X are handled by <Sheet> (disabled while `busy`).
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [rowError, setRowError] = useState("");
  const [touched, setTouched] = useState(new Set());

  const touch = (k) => setTouched((prev) => new Set([...prev, String(k)]));
  const setD = (patch) =>
    setDraft((p) => ({ ...(p || {}), ...(typeof patch === "function" ? patch(p || {}) : patch) }));
  const getSpecLabel = (id) => specOptions.find((o) => String(o.id) === String(id))?.label || `#${id}`;

  const tryPrefillBranchKlang = async (row) => {
    let foundBranch = branchOptions.find((b) => (b.label || "").trim() === (row.branch_name || "").trim());
    let branchId = foundBranch?.id || "";
    let klangId = "";
    if (branchId) {
      try {
        const data = await apiAuth(`/order/klang/search?branch_id=${branchId}`);
        const opts = (Array.isArray(data) ? data : []).map((x) => ({ id: String(x.id), label: x.klang_name }));
        setKlangOptions(opts);
        const foundKlang = opts.find((k) => (k.label || "").trim() === (row.klang_name || "").trim());
        klangId = foundKlang?.id || "";
      } catch {}
    } else {
      setKlangOptions([]);
    }
    return { branchId, klangId };
  };

  const buildProductSpecIn = (specId) => {
    const raw = specDict[String(specId)];
    if (!raw) return null;
    return {
      product_id: raw.product_id,
      species_id: raw.species_id,
      variant_id: raw.variant_id,
      product_year: raw.product_year ?? null,
      condition_id: raw.condition_id ?? null,
      field_type: raw.field_type ?? null,
      program: raw.program ?? null,
      business_type: raw.business_type ?? null,
    };
  };

  const openModal = async (row) => {
    setRowError("");
    setTouched(new Set());
    setEditing(false);
    setActive(row);

    const guessType = mode === "sell" ? "sell" : "buy";
    const { branchId, klangId } = await tryPrefillBranchKlang(row);
    const editorId = getUser()?.id || "";

    setDraft({
      order_id: row.id ?? row.sale_id ?? row.order_id,
      type: guessType,
      edited_by: editorId,
      reason: "",

      // common
      date: row?.date ? new Date(row.date).toISOString().slice(0, 10) : "",
      branch_location: branchId,
      klang_location: klangId,
      __branch_label: row.branch_name || "",
      __klang_label: row.klang_name || "",
      payment_id: row.payment_id ? String(row.payment_id) : "",
      comment: row.comment || "",

      // change spec
      spec_id: row.spec_id ? String(row.spec_id) : "",

      // BUY-like
      order_serial: row.order_serial || "",
      entry_weight: row.entry_weight ?? "",
      exit_weight: row.exit_weight ?? "",
      weight: row.weight ?? "",
      price_per_kilo: row.price_per_kilo ?? "",
      price: row.price ?? "",
      gram: row.gram ?? "",
      humidity: row.humidity ?? "",
      impurity: row.impurity ?? "",

      // SELL-like
      sale_id: row.sale_id || "", // ⭐ ใบรับเงินขาย (ขายสด) / หรือเอกสารขายเชื่อ
      order_serial_1: row.order_serial_1 || row.order_serial || "",
      order_serial_2: row.order_serial_2 || "",
      license_plate_1: row.license_plate_1 || "",
      license_plate_2: row.license_plate_2 || "",
      weight_1: row.weight_1 ?? (row.sub_order === 1 ? row.weight : ""),
      weight_2: row.weight_2 ?? (row.sub_order === 2 ? row.weight : ""),
      price_1: row.price_1 ?? (row.sub_order === 1 ? row.price : ""),
      price_2: row.price_2 ?? (row.sub_order === 2 ? row.price : ""),
    });
    setOpen(true);
  };

  const closeModal = () => {
    setOpen(false);
    setActive(null);
    setDraft(null);
    setEditing(false);
    setSaving(false);
    setDeleting(false);
    setRowError("");
    setTouched(new Set());
  };

  /* ---- Build changes payloads ---- */
  const buildChangesBuy = (d, touchedKeys) => {
    const c = {};
    const put = (k, v) => {
      if (touchedKeys.has(k)) c[k] = v;
    };
    if (touchedKeys.has("spec_id")) {
      const spec = buildProductSpecIn(d.spec_id);
      if (spec) c["spec"] = spec;
    }
    put("payment_id", d.payment_id ? Number(d.payment_id) : undefined);
    put("humidity", d.humidity === "" ? undefined : Number(cleanDecimal(d.humidity)));
    put("entry_weight", d.entry_weight === "" ? undefined : Number(cleanDecimal(d.entry_weight)));
    put("exit_weight", d.exit_weight === "" ? undefined : Number(cleanDecimal(d.exit_weight)));
    put("weight", d.weight === "" ? undefined : Number(cleanDecimal(d.weight)));
    put("gram", d.gram === "" ? undefined : Number(onlyDigits(d.gram)));
    put("price_per_kilo", d.price_per_kilo === "" ? undefined : Number(cleanDecimal(d.price_per_kilo)));
    put("price", d.price === "" ? undefined : Number(cleanDecimal(d.price)));
    put("impurity", d.impurity === "" ? undefined : Number(cleanDecimal(d.impurity)));
    put("order_serial", d.order_serial || undefined);
    put("date", d.date ? new Date(d.date).toISOString() : undefined);
    put("branch_location", d.branch_location ? Number(d.branch_location) : undefined);
    put("klang_location", d.klang_location ? Number(d.klang_location) : undefined);
    put("comment", d.comment || undefined);

    Object.keys(c).forEach((k) => c[k] === undefined && delete c[k]);
    return c;
  };

  const buildChangesSell = (d, touchedKeys) => {
    const c = {};
    const put = (k, v) => {
      if (touchedKeys.has(k)) c[k] = v;
    };
    if (touchedKeys.has("spec_id")) {
      const spec = buildProductSpecIn(d.spec_id);
      if (spec) c["spec"] = spec;
    }

    // ⭐ รองรับใบรับเงินขาย (ขายสด) / เอกสารขายเชื่อ → ไปที่ sale_id
    put("sale_id", d.sale_id ? asString(d.sale_id).trim() : undefined);

    put("payment_id", d.payment_id ? Number(d.payment_id) : undefined);
    put("license_plate_1", d.license_plate_1 || undefined);
    put("license_plate_2", d.license_plate_2 || undefined);
    put("weight_1", d.weight_1 === "" ? undefined : Number(cleanDecimal(d.weight_1)));
    put("weight_2", d.weight_2 === "" ? undefined : Number(cleanDecimal(d.weight_2)));
    put("gram", d.gram === "" ? undefined : Number(onlyDigits(d.gram)));
    put("price_per_kilo", d.price_per_kilo === "" ? undefined : Number(cleanDecimal(d.price_per_kilo)));
    put("price_1", d.price_1 === "" ? undefined : Number(cleanDecimal(d.price_1)));
    put("price_2", d.price_2 === "" ? undefined : Number(cleanDecimal(d.price_2)));
    put("order_serial_1", d.order_serial_1 || undefined);
    put("order_serial_2", d.order_serial_2 || undefined);
    put("date", d.date ? new Date(d.date).toISOString() : undefined);
    put("branch_location", d.branch_location ? Number(d.branch_location) : undefined);
    put("klang_location", d.klang_location ? Number(d.klang_location) : undefined);
    put("comment", d.comment || undefined);

    Object.keys(c).forEach((k) => c[k] === undefined && delete c[k]);
    return c;
  };

  const buildDept = (d, isBuy) => {
    const wantsCredit = isBuy ? Number(d.payment_id) === 4 : Number(d.payment_id) === 2;
    const anyFilled = d.dept_allowed_period !== "" || d.dept_postpone === true || d.dept_postpone_period !== "";
    if (!wantsCredit && !anyFilled) return undefined;
    return {
      allowed_period: d.dept_allowed_period === "" ? undefined : Number(onlyDigits(d.dept_allowed_period)),
      postpone: !!d.dept_postpone,
      postpone_period: d.dept_postpone_period === "" ? undefined : Number(onlyDigits(d.dept_postpone_period)),
    };
  };

  const save = async () => {
    if (!active || !draft) return;
    setRowError("");

    const editorId = Number(draft.edited_by);
    if (!Number.isFinite(editorId) || editorId <= 0) {
      setRowError("กรุณากรอก 'รหัสเจ้าหน้าที่ผู้แก้ไข (edited_by)' เป็นตัวเลขให้ถูกต้อง");
      return;
    }

    setSaving(true);
    const touchedKeys = new Set(touched);

    const payloadBuy = {
      meta: { edited_by: editorId, reason: (draft.reason || "").trim() || undefined },
      changes: buildChangesBuy(draft, touchedKeys),
      dept: buildDept(draft, true),
    };
    if (payloadBuy.dept === undefined) delete payloadBuy.dept;

    const payloadSell = {
      meta: { edited_by: editorId, reason: (draft.reason || "").trim() || undefined },
      changes: buildChangesSell(draft, touchedKeys),
      dept: buildDept(draft, false),
    };
    if (payloadSell.dept === undefined) delete payloadSell.dept;

    const tryPatch = async (primary) => {
      const id = draft.order_id;
      const patchOnce = async (kind) => {
        const url = kind === "buy" ? `/order/orders/buy/${id}` : `/order/orders/sell/${id}`;
        const body = kind === "buy" ? payloadBuy : payloadSell;
        return apiAuth(url, { method: "PATCH", body });
      };
      try {
        return await patchOnce(primary);
      } catch (e1) {
        const msg = (e1?.message || "").toLowerCase();
        const is404 = msg.includes("404") || msg.includes("not found");
        if (!is404) throw e1;
        const secondary = primary === "buy" ? "sell" : "buy";
        return await patchOnce(secondary);
      }
    };

    try {
      const primary = draft.type === "sell" ? "sell" : "buy";
      await tryPatch(primary);
      setEditing(false);
      setOpen(false);
      await fetchOrders();
    } catch (e) {
      console.error(e);
      setRowError(e?.message || "บันทึกไม่สำเร็จ");
      // Sheet stays open with the draft (UI-SPEC §9).
      toast.error("บันทึกไม่สำเร็จ", { description: e?.message || undefined });
    } finally {
      setSaving(false);
    }
  };

  /* -------- DELETE order -------- */
  const deleteOrder = async () => {
    const id = draft?.order_id;
    if (!id) return;
    const prefer = draft?.type === "sell" ? "sell" : "buy";
    const candidates = [
      `/order/orders/${id}`,
      `/order/orders/${id}?force_type=${prefer}`,
      `/order/orders/${id}?force_type=${prefer === "buy" ? "sell" : "buy"}`,
    ];
    let lastErr = null;
    for (const url of candidates) {
      try {
        await apiAuth(url, { method: "DELETE" });
        return;
      } catch (e) {
        lastErr = e;
      }
    }
    throw lastErr;
  };

  const confirmAndDelete = async () => {
    if (!active || !draft || deleting) return;
    // Confirmation now comes from <ConfirmDialog> (was window.confirm).
    setRowError("");
    setDeleting(true);
    try {
      await deleteOrder();
      setConfirmDelete(false);
      closeModal();
      toast.success("ลบออเดอร์แล้ว");
      await fetchOrders();
    } catch (e) {
      console.error(e);
      setConfirmDelete(false);
      setRowError(e?.message || "ลบออเดอร์ไม่สำเร็จ");
      toast.error("ลบออเดอร์ไม่สำเร็จ", { description: e?.message || undefined });
    } finally {
      setDeleting(false);
    }
  };

  /* -------------- UI -------------- */
  const startIndex = (page - 1) * PAGE_SIZE + 1;
  const endIndex = Math.min(rows.length, page * PAGE_SIZE);

  const isSellCredit = (pid) => Number(pid) === 2;
  const isSellCash = (pid) => Number(pid) === 1;

  /* ---------- phone: card list + compact pager (UI-SPEC §6.1 / §9) ---------- */
  const fmtDate = (d) => (d ? new Date(d).toLocaleDateString("th-TH") : "—");
  const rowView = (r) => {
    const isBuy = mode === "buy";
    const entry = toNumber(r.entry_weight ?? r.entryWeight ?? r.entry ?? 0);
    const exit = toNumber(r.exit_weight ?? r.exitWeight ?? r.exit ?? 0);
    const net = isBuy ? toNumber(r.weight) || Math.max(0, Math.abs(exit - entry)) : toNumber(r.weight ?? 0);
    const price = toNumber(isBuy ? r.price ?? r.amountTHB ?? 0 : r.price ?? 0);
    const raw = toNumber(isBuy ? r.price_per_kilo ?? r.pricePerKilo ?? r.unit_price ?? 0 : r.price_per_kilo ?? 0);
    return {
      net, price, pricePerKg: raw || (net > 0 ? price / net : 0),
      customer: `${r.first_name ?? ""} ${r.last_name ?? ""}`.trim() || r.customer_name || "—",
      species: r.species || r.rice_type || r.riceType || "—",
      branch: r.branch_name || r.branchName || "—",
      klang: r.klang_name || r.klangName || "",
      subtitle: isBuy
        ? [fmtDate(r.date), r.order_serial || r.paymentRefNo || "—", r.klang_name || r.klangName].filter(Boolean).join(" · ")
        : `${fmtDate(r.date)} · ใบรับเงิน ${r.sale_id || "—"} · ใบชั่ง ${r.order_serial || "—"}`,
      sub: r.sub_order,
    };
  };
  const phoneList = (
    <DataList
      items={pagedRows}
      keyOf={(r) => (mode === "buy" ? r.id ?? `${r.order_serial}-${r.date}-${r.first_name ?? ""}-${r.last_name ?? ""}` : `${r.id ?? r.sale_id}-${r.sub_order ?? 0}`)}
      loading={loading}
      skeletonRows={6}
      emptyState={
        <EmptyState
          title="ไม่พบออเดอร์"
          description={`ไม่มีรายการ${mode === "buy" ? "ฝั่งซื้อ" : "ฝั่งขาย"}ในช่วงวันที่และตัวกรองนี้`}
          action={<button type="button" onClick={resetFilters} className={neutralBtnCls}>ล้างตัวกรอง</button>}
        />
      }
      title={(r) => rowView(r).customer}
      subtitle={(r) => <span className="line-clamp-2">{rowView(r).subtitle}</span>}
      badge={(r) => {
        const v = rowView(r);
        return (
          <span className="flex flex-col items-end gap-1">
            <Badge tone="neutral">{v.branch}</Badge>
            {mode === "sell" && toNumber(v.sub) > 1 && <Badge tone="info">ย่อย {v.sub}</Badge>}
          </span>
        );
      }}
      fields={[
        { label: "ชนิดข้าว", value: (r) => rowView(r).species, span: 2 },
        { label: "นน.สุทธิ (กก.)", value: (r) => rowView(r).net.toLocaleString(), align: "right" },
        { label: "ราคา/กก. (บาท)", value: (r) => baht(rowView(r).pricePerKg), align: "right" },
        { label: "เป็นเงิน", value: (r) => thb(rowView(r).price), align: "right", emphasis: true, span: 2 },
      ]}
      onClick={(r) => openModal(r)}
    />
  );
  const phonePager = rows.length > 0 && !loading && (
    <nav aria-label="เลขหน้า" className="mt-4">
      <div className="flex items-center justify-between gap-1.5">
        <button type="button" onClick={prevPage} disabled={page <= 1} aria-label="หน้าก่อนหน้า" className={cx(neutralBtnCls, "shrink-0 gap-1 whitespace-nowrap px-2.5")}>
          <ChevronLeft aria-hidden="true" className="size-4" /> ก่อนหน้า
        </button>
        <div className="flex min-w-0 items-center gap-1.5 whitespace-nowrap text-sm text-gray-600 dark:text-gray-300">
          <span className="hidden min-[380px]:inline">หน้า</span>
          <input
            type="text"
            inputMode="numeric"
            aria-label="ไปหน้า"
            value={pageInput}
            onChange={(e) => setPageInput(onlyDigits(e.target.value))}
            onKeyDown={(e) => e.key === "Enter" && onCommitPageInput()}
            onBlur={onCommitPageInput}
            className="h-11 w-14 shrink-0 rounded-xl border border-slate-300 bg-slate-100 px-1 text-center text-base tabular-nums text-slate-900 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/25 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
          />
          <span className="tabular-nums">/ {totalPages.toLocaleString()}</span>
        </div>
        <button type="button" onClick={nextPage} disabled={page >= totalPages} aria-label="หน้าถัดไป" className={cx(neutralBtnCls, "shrink-0 gap-1 whitespace-nowrap px-2.5")}>
          ถัดไป <ChevronRight aria-hidden="true" className="size-4" />
        </button>
      </div>
      <p className="mt-2 text-center text-xs tabular-nums text-gray-500 dark:text-gray-400">
        {startIndex.toLocaleString()}–{endIndex.toLocaleString()} จาก {rows.length.toLocaleString()}
      </p>
    </nav>
  );

  return (
    <div className="min-h-screen bg-white text-black dark:bg-slate-900 dark:text-white rounded-2xl">
      <div className="mx-auto max-w-7xl p-4 md:p-6">
        {/* หัวเรื่อง + สลับโหมด */}
        <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
            แก้ไขออเดอร์ {mode === "buy" ? "ฝั่งซื้อ" : "ฝั่งขาย"}
          </h1>
          <div className="inline-flex items-center rounded-2xl border border-slate-300 p-1 bg-white shadow-sm dark:bg-slate-800 dark:border-slate-600">
            <button
              type="button"
              onClick={() => switchMode("buy")}
              className={[
                "min-h-touch md:min-h-0 px-4 py-2 rounded-xl text-sm font-semibold transition",
                mode === "buy"
                  ? "bg-emerald-600 text-white shadow"
                  : "text-slate-700 hover:bg-slate-100 dark:text-white dark:hover:bg-slate-700",
              ].join(" ")}
            >
              โหมดซื้อ
            </button>
            <button
              type="button"
              onClick={() => switchMode("sell")}
              className={[
                "min-h-touch md:min-h-0 px-4 py-2 rounded-xl text-sm font-semibold transition",
                mode === "sell"
                  ? "bg-emerald-600 text-white shadow"
                  : "text-slate-700 hover:bg-slate-100 dark:text-white dark:hover:bg-slate-700",
              ].join(" ")}
            >
              โหมดขาย
            </button>
          </div>
        </div>

        {/* Filters */}
        <div className="mb-4 rounded-2xl border border-slate-200 bg-white p-4 text-black shadow-sm dark:border-slate-700 dark:bg-slate-800 dark:text-white">
          {optionsLoading && (
            <div className="mb-3 inline-flex items-center gap-2 text-sm text-slate-500 dark:text-slate-400" role="status" aria-live="polite">
              <span className={cx(spinnerCls, "!border-indigo-400/40 !border-t-indigo-500")} aria-hidden="true" />
              กำลังเตรียมตัวเลือกสาขา/คลัง/สเปก…
            </div>
          )}
          <div className="grid gap-3 md:grid-cols-6">
            <div>
              <label className={labelCls} htmlFor="oc-start">วันที่เริ่ม</label>
              <DateInput
                id="oc-start"
                aria-invalid={errors.startDate ? true : undefined}
                aria-describedby={errors.startDate ? "oc-start-err" : undefined}
                value={filters.startDate}
                onChange={(e) => setFilters((p) => ({ ...p, startDate: e.target.value }))}
                error={!!errors.startDate}
              />
              {errors.startDate && <div id="oc-start-err" className="mt-1 text-sm text-red-600 dark:text-red-400">{errors.startDate}</div>}
            </div>

            <div>
              <label className={labelCls} htmlFor="oc-end">วันที่สิ้นสุด</label>
              <DateInput
                id="oc-end"
                aria-invalid={errors.endDate ? true : undefined}
                aria-describedby={errors.endDate ? "oc-end-err" : undefined}
                value={filters.endDate}
                onChange={(e) => setFilters((p) => ({ ...p, endDate: e.target.value }))}
                error={!!errors.endDate}
              />
              {errors.endDate && <div id="oc-end-err" className="mt-1 text-sm text-red-600 dark:text-red-400">{errors.endDate}</div>}
            </div>

            <div>
              <label className={labelCls}>สาขา</label>
              <ComboBox
                title="สาขา"
                ariaLabel="สาขา"
                options={branchOptions}
                value={filters.branchId}
                getValue={(o) => o.id}
                onChange={(id, found) =>
                  setFilters((p) => ({
                    ...p,
                    branchId: id || "",
                    branchName: found?.label ?? "",
                    klangId: "",
                    klangName: "",
                  }))
                }
                placeholder="— เลือกสาขา —"
              />
            </div>

            <div>
              <label className={labelCls}>คลัง</label>
              <ComboBox
                title="คลัง"
                ariaLabel="คลัง"
                options={klangOptions}
                value={filters.klangId}
                getValue={(o) => o.id}
                onChange={(id, found) => setFilters((p) => ({ ...p, klangId: id || "", klangName: found?.label ?? "" }))}
                placeholder="— เลือกคลัง —"
                disabled={!filters.branchId}
              />
            </div>

            <div className="md:col-span-2">
              <label className={labelCls} htmlFor="oc-q">
                {mode === "buy" ? "ค้นหา (ชื่อ / ปชช. / เลขที่ใบสำคัญ)" : "ค้นหา (ชื่อ / ปชช. / ใบรับเงินขายสินค้า / เลขที่ใบชั่ง)"}
              </label>
              <input
                id="oc-q"
                className={baseField}
                value={filters.q}
                onChange={(e) => setFilters((p) => ({ ...p, q: e.target.value }))}
                placeholder="พิมพ์อย่างน้อย 2 ตัวอักษร แล้วระบบจะค้นหาอัตโนมัติ"
              />
            </div>

            <div className="flex items-end gap-2 md:col-span-6">
              <button
                onClick={fetchOrders}
                type="button"
                disabled={!!errors.startDate || !!errors.endDate || loading}
                className={submitBtnCls}
                aria-busy={loading ? "true" : "false"}
              >
                {loading && <span className={spinnerCls} aria-hidden="true" />}
                ค้นหา
              </button>
              <button
                type="button"
                onClick={resetFilters}
                className={resetBtnCls}
              >
                รีเซ็ต
              </button>
            </div>
          </div>
        </div>

        {/* Summary */}
        <div className="mb-4 grid gap-3 md:grid-cols-3">
          <div className="rounded-2xl bg-white p-4 text-black shadow-sm ring-1 ring-slate-200 dark:bg-slate-800 dark:text-white dark:ring-slate-700">
            <div className="text-slate-500 dark:text-slate-400">จำนวนรายการ</div>
            <div className="text-2xl font-semibold">{rows.length.toLocaleString()}</div>
          </div>
          <div className="rounded-2xl bg-white p-4 text-black shadow-sm ring-1 ring-slate-200 dark:bg-slate-800 dark:text-white dark:ring-slate-700">
            <div className="text-slate-500 dark:text-slate-400">น้ำหนักรวม (กก.)</div>
            <div className="text-2xl font-semibold">{Math.round(toNumber(totals.weight) * 100) / 100}</div>
          </div>
          <div className="rounded-2xl bg-white p-4 text-black shadow-sm ring-1 ring-slate-200 dark:bg-slate-800 dark:text-white dark:ring-slate-700">
            <div className="text-slate-500 dark:text-slate-400">มูลค่ารวม</div>
            <div className="text-2xl font-semibold">{thb(toNumber(totals.revenue))}</div>
          </div>
        </div>

        {/* List: cards on phones (conditional render — not CSS hide), table from md */}
        {isPhone ? (
          <div aria-busy={loading ? "true" : "false"}>
            {phoneList}
            {phonePager}
          </div>
        ) : (
        <div
          className="overflow-x-auto rounded-2xl border border-slate-200 bg-white text-black shadow-sm dark:border-slate-700 dark:bg-slate-800 dark:text-white"
          aria-busy={loading ? "true" : "false"}
        >
          <table className="min-w-full text-left text-sm">
            <thead className="bg-slate-50 text-slate-700 dark:bg-slate-700 dark:text-slate-200">
              {mode === "buy" ? (
                <tr>
                  <th className="px-3 py-2">วันที่</th>
                  <th className="px-3 py-2">เลขที่ใบสำคัญ</th>
                  <th className="px-3 py-2">ลูกค้า</th>
                  <th className="px-3 py-2">ชนิดข้าว</th>
                  <th className="px-3 py-2">สาขา</th>
                  <th className="px-3 py-2">คลัง</th>
                  <th className="px-3 py-2 text-right">น้ำหนักขาเข้า</th>
                  <th className="px-3 py-2 text-right">น้ำหนักขาออก</th>
                  <th className="px-3 py-2 text-right">น้ำหนักสุทธิ</th>
                  <th className="px-3 py-2 text-right">ราคาต่อกก. (บาท)</th>
                  <th className="px-3 py-2 text-right">เป็นเงิน</th>
                  <th className="px-3 py-2 text-right">การกระทำ</th>
                </tr>
              ) : (
                <tr>
                  <th className="px-3 py-2">วันที่</th>
                  <th className="px-3 py-2">ใบรับเงินขายสินค้า</th>
                  <th className="px-3 py-2">เลขที่ใบชั่ง</th>
                  <th className="px-3 py-2">ลูกค้า</th>
                  <th className="px-3 py-2">ชนิดข้าว</th>
                  <th className="px-3 py-2">สาขา</th>
                  <th className="px-3 py-2">คลัง</th>
                  <th className="px-3 py-2 text-right">น้ำหนัก (กก.)</th>
                  <th className="px-3 py-2 text-right">ราคาต่อกก. (บาท)</th>
                  <th className="px-3 py-2 text-right">เป็นเงิน</th>
                  <th className="px-3 py-2 text-center">#ย่อย</th>
                  <th className="px-3 py-2 text-right">การกระทำ</th>
                </tr>
              )}
            </thead>
            <tbody>
              {loading ? (
                <SkeletonTableRows rows={10} cols={12} />
              ) : rows.length === 0 ? (
                <tr>
                  <td className="px-3 py-10 text-center text-slate-500 dark:text-slate-400" colSpan={12}>
                    <div className="flex flex-col items-center gap-2">
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="size-8 text-slate-400 dark:text-slate-500" aria-hidden="true">
                        <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
                        <line x1="9" y1="10" x2="15" y2="10" />
                      </svg>
                      <span>ไม่พบข้อมูลในช่วงวันที่ที่เลือก ลองปรับตัวกรองแล้วค้นหาอีกครั้ง</span>
                    </div>
                  </td>
                </tr>
              ) : mode === "buy" ? (
                pagedRows.map((r) => {
                  const entry = toNumber(r.entry_weight ?? r.entryWeight ?? r.entry ?? 0);
                  const exit = toNumber(r.exit_weight ?? r.exitWeight ?? r.exit ?? 0);
                  const net = toNumber(r.weight) || Math.max(0, Math.abs(exit - entry));
                  const price = toNumber(r.price ?? r.amountTHB ?? 0);
                  const pricePerKgRaw = toNumber(r.price_per_kilo ?? r.pricePerKilo ?? r.unit_price ?? 0);
                  const pricePerKg = pricePerKgRaw || (net > 0 ? price / net : 0);
                  return (
                    <tr
                      key={r.id ?? `${r.order_serial}-${r.date}-${r.first_name ?? ""}-${r.last_name ?? ""}`}
                      className="odd:bg-white even:bg-slate-50 hover:bg-emerald-50 dark:odd:bg-slate-800 dark:even:bg-slate-700 dark:hover:bg-slate-700/70"
                    >
                      <td className="px-3 py-2">{r.date ? new Date(r.date).toLocaleDateString("th-TH") : "—"}</td>
                      <td className="px-3 py-2">{r.order_serial || r.paymentRefNo || "—"}</td>
                      <td className="px-3 py-2">
                        {`${r.first_name ?? ""} ${r.last_name ?? ""}`.trim() || r.customer_name || "—"}
                      </td>
                      <td className="px-3 py-2">{r.species || r.rice_type || r.riceType || "—"}</td>
                      <td className="px-3 py-2">{r.branch_name || r.branchName || "—"}</td>
                      <td className="px-3 py-2">{r.klang_name || r.klangName || "—"}</td>
                      <td className="px-3 py-2 text-right">{entry.toLocaleString()}</td>
                      <td className="px-3 py-2 text-right">{exit.toLocaleString()}</td>
                      <td className="px-3 py-2 text-right">{net.toLocaleString()}</td>
                      <td className="px-3 py-2 text-right">{baht(pricePerKg)}</td>
                      <td className="px-3 py-2 text-right">{thb(price)}</td>
                      <td className="px-3 py-2 text-right">
                        <button
                          type="button"
                          onClick={() => openModal(r)}
                          className="whitespace-nowrap rounded-2xl bg-emerald-600/90 px-4 py-2 text-sm font-semibold text-white shadow-sm ring-1 ring-emerald-700/50 hover:bg-emerald-600 active:scale-[.98] dark:bg-emerald-500/85 dark:hover:bg-emerald-500"
                        >
                          แก้ไข
                        </button>
                      </td>
                    </tr>
                  );
                })
              ) : (
                pagedRows.map((r) => {
                  const net = toNumber(r.weight ?? 0);
                  const price = toNumber(r.price ?? 0);
                  const pricePerKgRaw = toNumber(r.price_per_kilo ?? 0);
                  const pricePerKg = pricePerKgRaw || (net > 0 ? price / net : 0);
                  return (
                    <tr
                      key={`${r.id ?? r.sale_id}-${r.sub_order ?? 0}`}
                      className="odd:bg-white even:bg-slate-50 hover:bg-emerald-50 dark:odd:bg-slate-800 dark:even:bg-slate-700 dark:hover:bg-slate-700/70"
                    >
                      <td className="px-3 py-2">{r.date ? new Date(r.date).toLocaleDateString("th-TH") : "—"}</td>
                      <td className="px-3 py-2">{r.sale_id || "—"}</td>
                      <td className="px-3 py-2">{r.order_serial || "—"}</td>
                      <td className="px-3 py-2">{`${r.first_name ?? ""} ${r.last_name ?? ""}`.trim() || "—"}</td>
                      <td className="px-3 py-2">{r.species || "—"}</td>
                      <td className="px-3 py-2">{r.branch_name || "—"}</td>
                      <td className="px-3 py-2">{r.klang_name || "—"}</td>
                      <td className="px-3 py-2 text-right">{net.toLocaleString()}</td>
                      <td className="px-3 py-2 text-right">{baht(pricePerKg)}</td>
                      <td className="px-3 py-2 text-right">{thb(price)}</td>
                      <td className="px-3 py-2 text-center">{r.sub_order ?? "-"}</td>
                      <td className="px-3 py-2 text-right">
                        <button
                          type="button"
                          onClick={() => openModal(r)}
                          className="whitespace-nowrap rounded-2xl bg-emerald-600/90 px-4 py-2 text-sm font-semibold text-white shadow-sm ring-1 ring-emerald-700/50 hover:bg-emerald-600 active:scale-[.98] dark:bg-emerald-500/85 dark:hover:bg-emerald-500"
                        >
                          แก้ไข
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>

          {/* Pagination Bar */}
          <div className="flex flex-col gap-3 p-3 md:flex-row md:items-center md:justify-between">
            <div className="text-sm text-slate-600 dark:text-slate-300">
              แสดง <b>{rows.length ? startIndex.toLocaleString() : 0}</b>–<b>{rows.length ? endIndex.toLocaleString() : 0}</b>{" "}
              จาก <b>{rows.length.toLocaleString()}</b> รายการ
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={prevPage}
                disabled={page <= 1}
                className={[
                  "h-10 rounded-xl px-4 text-sm font-medium",
                  page <= 1
                    ? "cursor-not-allowed bg-slate-200 text-slate-500 dark:bg-slate-700 dark:text-slate-400"
                    : "bg-white text-slate-700 hover:bg-slate-100 dark:bg-slate-700 dark:text-white dark:hover:bg-slate-600",
                  "border border-slate-300 dark:border-slate-600",
                ].join(" ")}
              >
                ก่อนหน้า
              </button>

              {/* Page numbers */}
              <div className="flex items-center gap-1">
                {pageItems.map((it, idx) =>
                  it === "..." ? (
                    <span key={`dots-${idx}`} className="px-2 text-slate-500 dark:text-slate-300">
                      …
                    </span>
                  ) : (
                    <button
                      key={`p-${it}`}
                      type="button"
                      onClick={() => goToPage(it)}
                      className={[
                        "h-10 min-w-[40px] rounded-xl px-3 text-sm font-semibold transition",
                        it === page
                          ? "bg-emerald-600 text-white"
                          : "bg-white text-slate-700 hover:bg-slate-100 dark:bg-slate-700 dark:text-white dark:hover:bg-slate-600",
                        "border border-slate-300 dark:border-slate-600",
                      ].join(" ")}
                    >
                      {it}
                    </button>
                  )
                )}
              </div>

              <button
                type="button"
                onClick={nextPage}
                disabled={page >= totalPages}
                className={[
                  "h-10 rounded-xl px-4 text-sm font-medium",
                  page >= totalPages
                    ? "cursor-not-allowed bg-slate-200 text-slate-500 dark:bg-slate-700 dark:text-slate-400"
                    : "bg-white text-slate-700 hover:bg-slate-100 dark:bg-slate-700 dark:text-white dark:hover:bg-slate-600",
                  "border border-slate-300 dark:border-slate-600",
                ].join(" ")}
              >
                ถัดไป
              </button>

              {/* Jump to page */}
              <div className="ml-2 flex items-center gap-2">
                <label className="text-sm text-slate-600 dark:text-slate-300" htmlFor="oc-jump">ไปหน้า</label>
                <input
                  id="oc-jump"
                  type="number"
                  min={1}
                  max={totalPages}
                  value={pageInput}
                  onChange={(e) => setPageInput(onlyDigits(e.target.value))}
                  onKeyDown={(e) => e.key === "Enter" && onCommitPageInput()}
                  onBlur={onCommitPageInput}
                  className="h-10 w-20 rounded-xl border border-slate-300 bg-white px-3 text-sm outline-none
                             focus:border-emerald-600 focus:ring-2 focus:ring-emerald-500/30
                             dark:border-slate-600 dark:bg-slate-700 dark:text-white"
                />
                <span className="text-sm text-slate-600 dark:text-slate-300">/ {totalPages.toLocaleString()}</span>
              </div>
            </div>
          </div>
        </div>
        )}
      </div>

      {/* EDIT SHEET — portaled bottom sheet (<md) / centered dialog (≥md) */}
      <Sheet
        open={open && !!active && !!draft}
        onClose={closeModal}
        title={active ? `แก้ไขออเดอร์ #${active.id ?? "-"}` : "แก้ไขออเดอร์"}
        subtitle={draft ? `วันที่เอกสาร: ${draft.date ? new Date(draft.date).toLocaleDateString("th-TH") : "-"}` : undefined}
        size="full"
        hideHandle
        busy={saving || deleting}
        footer={
          !editing ? (
            <div className="grid grid-cols-2 gap-3 md:flex md:justify-end md:gap-2">
              <button
                type="button"
                onClick={() => setConfirmDelete(true)}
                disabled={deleting}
                className={cx(dangerBtnCls, "h-12 md:h-10")}
              >
                {deleting ? "กำลังลบ…" : "ลบออเดอร์"}
              </button>
              <button type="button" onClick={() => setEditing(true)} className={cx(primaryBtnCls, "h-12 md:h-10")}>
                แก้ไข
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-3 md:flex md:justify-end md:gap-2">
              <button
                type="button"
                onClick={() => {
                  setEditing(false);
                  openModal(active);
                }}
                disabled={saving}
                className={cx(neutralBtnCls, "h-12 md:h-10")}
              >
                ยกเลิก
              </button>
              <button
                type="button"
                onClick={save}
                disabled={saving}
                aria-busy={saving || undefined}
                className={cx(submitBtnCls, "h-12 py-0 md:h-10 md:text-sm")}
              >
                {saving && <span className={spinnerCls} aria-hidden="true" />}
                {saving ? "กำลังบันทึก…" : "บันทึก"}
              </button>
            </div>
          )
        }
      >
        {active && draft && (
          <div className="text-base md:text-lg">
                  {rowError && (
                    <div className="mb-4 rounded-xl border border-red-200 bg-red-50 p-3 text-base text-red-700 dark:border-red-400 dark:bg-red-900/20 dark:text-red-200">
                      {rowError}
                    </div>
                  )}

                  {/* ผู้แก้ไข/เหตุผล */}
                  <div className="mb-5 grid gap-4 md:grid-cols-3">
                    <div className="rounded-2xl border border-slate-200 bg-white/70 p-4 dark:border-slate-700 dark:bg-slate-700/40">
                      <div className="text-sm text-slate-600 dark:text-slate-300 mb-1">
                        รหัสเจ้าหน้าที่ผู้แก้ไข (edited_by) *
                      </div>
                      {!editing ? (
                        <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-base dark:border-slate-700 dark:bg-slate-700/60">
                          {draft.edited_by || "-"}
                        </div>
                      ) : (
                        <>
                          <input
                            inputMode="numeric"
                            className={[baseField, "cursor-not-allowed opacity-80"].join(" ")}
                            value={draft.edited_by}
                            readOnly
                            disabled
                          />
                          <div className="mt-1 text-xs text-slate-500 dark:text-slate-300">
                            ล็อกโดยระบบ (ใช้บัญชีผู้ใช้งานปัจจุบัน)
                          </div>
                        </>
                      )}
                    </div>
                    <div className="rounded-2xl border border-slate-200 bg-white/70 p-4 dark:border-slate-700 dark:bg-slate-700/40 md:col-span-2">
                      <div className="text-sm text-slate-600 dark:text-slate-300 mb-1">เหตุผลในการแก้ไข (reason)</div>
                      {!editing ? (
                        <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-base dark:border-slate-700 dark:bg-slate-700/60">
                          {draft.reason || "-"}
                        </div>
                      ) : (
                        <input
                          className={baseField}
                          value={draft.reason}
                          onChange={(e) => {
                            setD({ reason: e.target.value });
                            touch("reason");
                          }}
                          placeholder="เช่น แก้เลขใบสำคัญ/แก้น้ำหนัก/แก้จำนวนเงิน ฯลฯ"
                        />
                      )}
                    </div>
                  </div>

                  {/* ค่าพื้นฐานร่วม */}
                  <div className="mb-6 grid grid-cols-1 gap-5 md:grid-cols-3">
                    <div>
                      <label className="mb-1 block text-sm text-slate-600 dark:text-slate-300">ประเภทเอกสาร</label>
                      <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-base dark:border-slate-700 dark:bg-slate-700/60">
                        {draft.type === "sell" ? "ขาย (SELL)" : "ซื้อ (BUY)"}
                      </div>
                    </div>

                    <div>
                      <label className="mb-1 block text-sm text-slate-600 dark:text-slate-300" htmlFor="oc-edit-date">วันที่เอกสาร</label>
                      {!editing ? (
                        <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-base dark:border-slate-700 dark:bg-slate-700/60">
                          {draft.date ? new Date(draft.date).toLocaleDateString("th-TH") : "-"}
                        </div>
                      ) : (
                        <DateInput
                          id="oc-edit-date"
                          value={draft.date}
                          onChange={(e) => {
                            setD({ date: e.target.value });
                            touch("date");
                          }}
                        />
                      )}
                    </div>

                    <div>
                      <label className="mb-1 block text-sm text-slate-600 dark:text-slate-300">รายการสำเร็จรูป (เปลี่ยนสเปก)</label>
                      {!editing ? (
                        <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-base dark:border-slate-700 dark:bg-slate-700/60">
                          {draft.spec_id ? getSpecLabel(draft.spec_id) : "-"}
                        </div>
                      ) : (
                        <ComboBox
                          title="รายการสำเร็จรูป (เปลี่ยนสเปก)"
                          ariaLabel="รายการสำเร็จรูป (เปลี่ยนสเปก)"
                          options={specOptions}
                          value={draft.spec_id}
                          getValue={(o) => o.id}
                          onChange={(id) => {
                            setD({ spec_id: id || "" });
                            touch("spec_id");
                          }}
                          placeholder="— ไม่เปลี่ยน —"
                        />
                      )}
                    </div>

                    <div>
                      <label className="mb-1 block text-sm text-slate-600 dark:text-slate-300">สาขา</label>
                      {!editing ? (
                        <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-base dark:border-slate-700 dark:bg-slate-700/60">
                          {draft.__branch_label || "-"}
                        </div>
                      ) : (
                        <ComboBox
                          title="สาขา"
                          ariaLabel="สาขา"
                          options={branchOptions}
                          value={draft.branch_location}
                          getValue={(o) => o.id}
                          onChange={(id) => {
                            setD({ branch_location: id || "", klang_location: "" });
                            touch("branch_location");
                          }}
                          placeholder="— เลือกสาขา —"
                        />
                      )}
                    </div>

                    <div>
                      <label className="mb-1 block text-sm text-slate-600 dark:text-slate-300">คลัง</label>
                      {!editing ? (
                        <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-base dark:border-slate-700 dark:bg-slate-700/60">
                          {draft.__klang_label || "-"}
                        </div>
                      ) : (
                        <ComboBox
                          title="คลัง"
                          ariaLabel="คลัง"
                          options={klangOptions}
                          value={draft.klang_location}
                          getValue={(o) => o.id}
                          onChange={(id) => {
                            setD({ klang_location: id || "" });
                            touch("klang_location");
                          }}
                          placeholder="— เลือกคลัง —"
                          disabled={!draft.branch_location}
                        />
                      )}
                    </div>

                    <div>
                      <label className="mb-1 block text-sm text-slate-600 dark:text-slate-300">วิธีชำระเงิน</label>
                      {!editing ? (
                        <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-base dark:border-slate-700 dark:bg-slate-700/60">
                          {getPaymentLabel(draft.type, draft.payment_id)}
                        </div>
                      ) : (
                        <ComboBox
                          title="วิธีชำระเงิน"
                          ariaLabel="วิธีชำระเงิน"
                          options={draft.type === "sell" ? paymentSell : paymentBuy}
                          value={draft.payment_id}
                          getValue={(o) => o.id}
                          onChange={(id) => {
                            setD({ payment_id: id || "" });
                            touch("payment_id");
                          }}
                          placeholder="— ไม่เปลี่ยน —"
                        />
                      )}
                    </div>

                    <div className="md:col-span-3">
                      <label className="mb-1 block text-sm text-slate-600 dark:text-slate-300">หมายเหตุ</label>
                      {!editing ? (
                        <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-base dark:border-slate-700 dark:bg-slate-700/60">
                          {draft.comment || "-"}
                        </div>
                      ) : (
                        <input
                          className={baseField}
                          value={draft.comment}
                          onChange={(e) => {
                            setD({ comment: e.target.value });
                            touch("comment");
                          }}
                          placeholder="บันทึกเพิ่มเติม (ถ้ามี)"
                        />
                      )}
                    </div>
                  </div>

                  {/* BUY fields */}
                  {draft.type !== "sell" && (
                    <div className="mb-6 grid grid-cols-1 gap-5 md:grid-cols-3">
                      {[
                        ["order_serial", "เลขที่ใบสำคัญ"],
                        ["entry_weight", "น้ำหนักขาเข้า (กก.)", "number"],
                        ["exit_weight", "น้ำหนักขาออก (กก.)", "number"],
                        ["weight", "น้ำหนักสุทธิ (กก.)", "number"],
                        ["price_per_kilo", "ราคาต่อกก. (บาท)", "number"],
                        ["price", "เป็นเงิน (บาท)", "number"],
                        ["humidity", "ความชื้น (%)", "number"],
                        ["impurity", "สิ่งเจือปน (%)", "number"],
                        ["gram", "คุณภาพข้าว (gram)", "number"],
                      ].map(([key, label, type]) => (
                        <div key={key}>
                          <label className="mb-1 block text-sm text-slate-600 dark:text-slate-300">{label}</label>
                          {!editing ? (
                            <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-base dark:border-slate-700 dark:bg-slate-700/60">
                              {asString(draft[key] ?? "") || "-"}
                            </div>
                          ) : (
                            <input
                              type="text"
                              inputMode={type === "number" ? "decimal" : undefined}
                              className={baseField}
                              value={asString(draft[key] ?? "")}
                              onChange={(e) => {
                                setD({ [key]: type === "number" ? cleanDecimal(e.target.value) : e.target.value });
                                touch(key);
                              }}
                            />
                          )}
                        </div>
                      ))}
                    </div>
                  )}

                  {/* SELL fields */}
                  {draft.type === "sell" && (
                    <>
                      {/* เอกสารอ้างอิงการขาย (ตามวิธีชำระเงิน) */}
                      <div className="mb-6 grid grid-cols-1 gap-5 md:grid-cols-3">
                        <div className="md:col-span-3">
                          <label className="mb-1 block text-sm text-slate-600 dark:text-slate-300">
                            {isSellCredit(draft.payment_id)
                              ? "เลขที่ใบกำกับสินค้า (ขายเชื่อ)"
                              : isSellCash(draft.payment_id)
                              ? "ใบรับเงินขายสินค้า (ขายสด)"
                              : "เอกสารอ้างอิงการขาย (sale_id)"}
                          </label>
                          {!editing ? (
                            <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-base dark:border-slate-700 dark:bg-slate-700/60">
                              {asString(draft.sale_id || "") || "-"}
                            </div>
                          ) : (
                            <input
                              className={baseField}
                              value={asString(draft.sale_id || "")}
                              onChange={(e) => {
                                setD({ sale_id: e.target.value });
                                touch("sale_id");
                              }}
                              placeholder={
                                isSellCredit(draft.payment_id)
                                  ? "เช่น INV-2025-000456 (ไม่บังคับ)"
                                  : "เช่น RC-2025-000789 (ไม่บังคับ)"
                              }
                            />
                          )}
                          <div className="mt-1 text-sm text-slate-600 dark:text-slate-300">
                            * ค่านี้จะถูกส่งไปหลังบ้านเป็น <code>sale_id</code>
                          </div>
                        </div>
                      </div>

                      <div className="mb-2 text-sm text-slate-600 dark:text-slate-300">ข้อมูลรถพ่วงหลายคัน</div>

                      <div className="mb-6 grid grid-cols-1 gap-5 md:grid-cols-2">
                        {/* พ่วงหน้า */}
                        <div className="rounded-2xl border border-slate-200 p-4 dark:border-slate-700">
                          <div className="mb-3 flex items-center gap-2 font-semibold"><span aria-hidden="true" className="inline-flex size-2 rounded-full bg-emerald-500" />พ่วงหน้า</div>
                          <div className="grid grid-cols-1 gap-4">
                            <div>
                              <label className="mb-1 block text-sm text-slate-600 dark:text-slate-300">
                                เลขที่ใบสำคัญ 1
                              </label>
                              {!editing ? (
                                <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 dark:border-slate-700 dark:bg-slate-700/60">
                                  {asString(draft.order_serial_1 || "") || "-"}
                                </div>
                              ) : (
                                <input
                                  className={baseField}
                                  value={asString(draft.order_serial_1 || "")}
                                  onChange={(e) => {
                                    setD({ order_serial_1: e.target.value });
                                    touch("order_serial_1");
                                  }}
                                />
                              )}
                            </div>

                            <div>
                              <label className="mb-1 block text-sm text-slate-600 dark:text-slate-300">
                                ทะเบียนพ่วงหน้า
                              </label>
                              {!editing ? (
                                <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 dark:border-slate-700 dark:bg-slate-700/60">
                                  {asString(draft.license_plate_1 || "") || "-"}
                                </div>
                              ) : (
                                <input
                                  className={baseField}
                                  value={asString(draft.license_plate_1 || "")}
                                  onChange={(e) => {
                                    setD({ license_plate_1: e.target.value });
                                    touch("license_plate_1");
                                  }}
                                />
                              )}
                            </div>

                            <div>
                              <label className="mb-1 block text-sm text-slate-600 dark:text-slate-300">
                                น้ำหนักสุทธิพ่วงหน้า (กก.)
                              </label>
                              {!editing ? (
                                <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 dark:border-slate-700 dark:bg-slate-700/60">
                                  {asString(draft.weight_1 ?? "") || "-"}
                                </div>
                              ) : (
                                <input
                                  inputMode="decimal"
                                  className={baseField}
                                  value={asString(draft.weight_1 ?? "")}
                                  onChange={(e) => {
                                    setD({ weight_1: cleanDecimal(e.target.value) });
                                    touch("weight_1");
                                  }}
                                />
                              )}
                            </div>

                            <div>
                              <label className="mb-1 block text-sm text-slate-600 dark:text-slate-300">
                                ราคาต่อกก. (บาท)
                              </label>
                              {!editing ? (
                                <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 dark:border-slate-700 dark:bg-slate-700/60">
                                  {asString(draft.price_per_kilo ?? "") || "-"}
                                </div>
                              ) : (
                                <input
                                  inputMode="decimal"
                                  className={baseField}
                                  value={asString(draft.price_per_kilo ?? "")}
                                  onChange={(e) => {
                                    setD({ price_per_kilo: cleanDecimal(e.target.value) });
                                    touch("price_per_kilo");
                                  }}
                                />
                              )}
                              <div className="mt-1 text-xs text-slate-500 dark:text-slate-300">
                                * ใช้ร่วมกันทั้งพ่วงหน้า/พ่วงหลัง
                              </div>
                            </div>

                            <div>
                              <label className="mb-1 block text-sm text-slate-600 dark:text-slate-300">
                                เป็นเงิน (พ่วงหน้า) (บาท)
                              </label>
                              {!editing ? (
                                <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 dark:border-slate-700 dark:bg-slate-700/60">
                                  {asString(draft.price_1 ?? "") || "-"}
                                </div>
                              ) : (
                                <input
                                  inputMode="decimal"
                                  className={baseField}
                                  value={asString(draft.price_1 ?? "")}
                                  onChange={(e) => {
                                    setD({ price_1: cleanDecimal(e.target.value) });
                                    touch("price_1");
                                  }}
                                />
                              )}
                            </div>
                          </div>
                        </div>

                        {/* พ่วงหลัง */}
                        <div className="rounded-2xl border border-slate-200 p-4 dark:border-slate-700">
                          <div className="mb-3 flex items-center gap-2 font-semibold"><span aria-hidden="true" className="inline-flex size-2 rounded-full bg-slate-500" />พ่วงหลัง</div>
                          <div className="grid grid-cols-1 gap-4">
                            <div>
                              <label className="mb-1 block text-sm text-slate-600 dark:text-slate-300">
                                เลขที่ใบสำคัญ 2
                              </label>
                              {!editing ? (
                                <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 dark:border-slate-700 dark:bg-slate-700/60">
                                  {asString(draft.order_serial_2 || "") || "-"}
                                </div>
                              ) : (
                                <input
                                  className={baseField}
                                  value={asString(draft.order_serial_2 || "")}
                                  onChange={(e) => {
                                    setD({ order_serial_2: e.target.value });
                                    touch("order_serial_2");
                                  }}
                                />
                              )}
                            </div>

                            <div>
                              <label className="mb-1 block text-sm text-slate-600 dark:text-slate-300">
                                ทะเบียนพ่วงหลัง
                              </label>
                              {!editing ? (
                                <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 dark:border-slate-700 dark:bg-slate-700/60">
                                  {asString(draft.license_plate_2 || "") || "-"}
                                </div>
                              ) : (
                                <input
                                  className={baseField}
                                  value={asString(draft.license_plate_2 || "")}
                                  onChange={(e) => {
                                    setD({ license_plate_2: e.target.value });
                                    touch("license_plate_2");
                                  }}
                                />
                              )}
                            </div>

                            <div>
                              <label className="mb-1 block text-sm text-slate-600 dark:text-slate-300">
                                น้ำหนักสุทธิพ่วงหลัง (กก.)
                              </label>
                              {!editing ? (
                                <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 dark:border-slate-700 dark:bg-slate-700/60">
                                  {asString(draft.weight_2 ?? "") || "-"}
                                </div>
                              ) : (
                                <input
                                  inputMode="decimal"
                                  className={baseField}
                                  value={asString(draft.weight_2 ?? "")}
                                  onChange={(e) => {
                                    setD({ weight_2: cleanDecimal(e.target.value) });
                                    touch("weight_2");
                                  }}
                                />
                              )}
                            </div>

                            {/* ✅ เพิ่มราคาต่อกก. (บาท) ในบล็อกพ่วงหลัง (ผูกกับ price_per_kilo เดียวกัน) */}
                            <div>
                              <label className="mb-1 block text-sm text-slate-600 dark:text-slate-300">
                                ราคาต่อกก. (บาท)
                              </label>
                              {!editing ? (
                                <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 dark:border-slate-700 dark:bg-slate-700/60">
                                  {asString(draft.price_per_kilo ?? "") || "-"}
                                </div>
                              ) : (
                                <input
                                  inputMode="decimal"
                                  className={baseField}
                                  value={asString(draft.price_per_kilo ?? "")}
                                  onChange={(e) => {
                                    setD({ price_per_kilo: cleanDecimal(e.target.value) });
                                    touch("price_per_kilo");
                                  }}
                                />
                              )}
                              <div className="mt-1 text-xs text-slate-500 dark:text-slate-300">
                                * ใช้ร่วมกันทั้งพ่วงหน้า/พ่วงหลัง
                              </div>
                            </div>

                            <div>
                              <label className="mb-1 block text-sm text-slate-600 dark:text-slate-300">
                                เป็นเงิน (พ่วงหลัง) (บาท)
                              </label>
                              {!editing ? (
                                <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 dark:border-slate-700 dark:bg-slate-700/60">
                                  {asString(draft.price_2 ?? "") || "-"}
                                </div>
                              ) : (
                                <input
                                  inputMode="decimal"
                                  className={baseField}
                                  value={asString(draft.price_2 ?? "")}
                                  onChange={(e) => {
                                    setD({ price_2: cleanDecimal(e.target.value) });
                                    touch("price_2");
                                  }}
                                />
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                    </>
                  )}
          </div>
        )}
      </Sheet>

      <ConfirmDialog
        open={confirmDelete}
        title={`ลบออเดอร์ #${active?.id ?? draft?.order_id ?? ""}`}
        description="การลบจะย้อนสต๊อก/เครดิต และไม่สามารถยกเลิกได้"
        confirmLabel="ลบออเดอร์"
        cancelLabel="เก็บไว้"
        tone="danger"
        loading={deleting}
        loadingLabel="กำลังลบ…"
        onConfirm={confirmAndDelete}
        onCancel={() => setConfirmDelete(false)}
      />
    </div>
  );
}

export default OrderCorrection;
