// src/pages/OrderCorrection.jsx
import React, {
  useEffect,
  useMemo,
  useRef,
  useState,
  forwardRef,
  useImperativeHandle,
  Component,
} from "react";
import { apiAuth } from "../lib/api";
import { getUser } from "../lib/auth";

/* ---------------- Utils ---------------- */
const onlyDigits = (s = "") => s.replace(/\D+/g, "");
const cleanDecimal = (s = "") => String(s ?? "").replace(/[^\d.]/g, "");
const toNumber = (v) =>
  v === "" || v === null || v === undefined ? 0 : Number(v);
const thb = (n) =>
  new Intl.NumberFormat("th-TH", {
    style: "currency",
    currency: "THB",
    maximumFractionDigits: 2,
  }).format(isFinite(n) ? n : 0);
const baht = (n) =>
  new Intl.NumberFormat("th-TH", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(isFinite(n) ? n : 0);

function useDebounce(value, delay = 400) {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(t);
  }, [value, delay]);
  return debounced;
}

/* ---------------- Error Boundary ---------------- */
class PageErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, message: "" };
  }
  static getDerivedStateFromError(err) {
    return { hasError: true, message: err?.message || "เกิดข้อผิดพลาดที่ไม่ทราบสาเหตุ" };
  }
  componentDidCatch(err, info) {
    // เงียบไว้ไม่ให้ทั้งแอปล่ม
    console.error("OrderCorrection crashed:", err, info);
  }
  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-white text-black dark:bg-slate-900 dark:text-white">
          <div className="mx-auto max-w-3xl p-6">
            <div className="rounded-2xl border border-amber-300 bg-amber-50 p-6 text-amber-900 dark:border-amber-500 dark:bg-amber-900/20 dark:text-amber-200">
              <div className="text-xl font-semibold mb-2">เกิดข้อผิดพลาด</div>
              <p className="mb-4">{this.state.message}</p>
              <button
                type="button"
                className="rounded-xl bg-emerald-600 px-4 py-2 text-white font-semibold hover:bg-emerald-700"
                onClick={() => (window.location.href = window.location.href)}
              >
                รีเฟรชหน้า
              </button>
            </div>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

/* ---------------- Base field style ---------------- */
const baseField =
  "w-full rounded-2xl border border-slate-300 bg-slate-100 p-3 text-[15px] md:text-base " +
  "text-black outline-none placeholder:text-slate-500 focus:border-emerald-600 focus:ring-2 focus:ring-emerald-500/30 shadow-none " +
  "dark:border-slate-500/40 dark:bg-slate-700/80 dark:text-slate-100 dark:placeholder:text-slate-300 dark:focus:border-emerald-400 dark:focus:ring-emerald-400/30";

/* ---------------- Reusable ComboBox ---------------- */
function ComboBox({
  options = [],
  value,
  onChange,
  placeholder = "— เลือก —",
  getLabel = (o) => o?.label ?? "",
  getValue = (o) => o?.value ?? o?.id ?? "",
  disabled = false,
  error = false,
}) {
  const [open, setOpen] = useState(false);
  const [highlight, setHighlight] = useState(-1);
  const boxRef = useRef(null);
  const listRef = useRef(null);
  const btnRef = useRef(null);

  const selectedLabel = useMemo(() => {
    const found = options.find((o) => String(getValue(o)) === String(value));
    return found ? getLabel(found) : "";
  }, [options, value, getLabel, getValue]);

  useEffect(() => {
    const onClick = (e) => {
      if (!boxRef.current) return;
      if (!boxRef.current.contains(e.target)) {
        setOpen(false);
        setHighlight(-1);
      }
    };
    document.addEventListener("click", onClick);
    return () => document.removeEventListener("click", onClick);
  }, []);

  const commit = (opt) => {
    const v = String(getValue(opt));
    onChange?.(v, opt);
    setOpen(false);
    setHighlight(-1);
    requestAnimationFrame(() => btnRef.current?.focus());
  };

  const scrollHighlightedIntoView = (index) => {
    const listEl = listRef.current;
    const itemEl = listEl?.children?.[index];
    if (!listEl || !itemEl) return;
    const itemRect = itemEl.getBoundingClientRect();
    const listRect = listEl.getBoundingClientRect();
    const buffer = 6;
    if (itemRect.top < listRect.top + buffer) {
      listEl.scrollTop -= (listRect.top + buffer) - itemRect.top;
    } else if (itemRect.bottom > listRect.bottom - buffer) {
      listEl.scrollTop += itemRect.bottom - (listRect.bottom - buffer);
    }
  };

  const onKeyDown = (e) => {
    if (disabled) return;
    if (!open && (e.key === "Enter" || e.key === " " || e.key === "ArrowDown")) {
      e.preventDefault();
      setOpen(true);
      setHighlight((h) => (h >= 0 ? h : 0));
      return;
    }
    if (!open) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setHighlight((h) => {
        const next = h < options.length - 1 ? h + 1 : 0;
        requestAnimationFrame(() => scrollHighlightedIntoView(next));
        return next;
      });
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setHighlight((h) => {
        const prev = h > 0 ? h - 1 : options.length - 1;
        requestAnimationFrame(() => scrollHighlightedIntoView(prev));
        return prev;
      });
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (highlight >= 0 && highlight < options.length) commit(options[highlight]);
    } else if (e.key === "Escape") {
      e.preventDefault();
      setOpen(false);
      setHighlight(-1);
    }
  };

  return (
    <div className="relative" ref={boxRef}>
      <button
        type="button"
        ref={btnRef}
        disabled={disabled}
        onClick={() => !disabled && setOpen((o) => !o)}
        onKeyDown={onKeyDown}
        className={[
          "w-full rounded-2xl border p-3 text-left text-[15px] md:text-base outline-none transition shadow-none",
          disabled
            ? "bg-slate-100 cursor-not-allowed"
            : "bg-slate-100 hover:bg-slate-200 cursor-pointer",
          error
            ? "border-red-400 ring-2 ring-red-300/70"
            : "border-slate-300 focus:border-emerald-600 focus:ring-2 focus:ring-emerald-500/30",
          "text-black placeholder:text-slate-500",
          "dark:border-slate-500/40 dark:bg-slate-700/80 dark:text-slate-100 dark:hover:bg-slate-700/70 dark:placeholder:text-slate-300 dark:focus:border-emerald-400 dark:focus:ring-emerald-400/30",
        ].join(" ")}
        aria-haspopup="listbox"
        aria-expanded={open}
      >
        {selectedLabel || (
          <span className="text-slate-500 dark:text-white/70">{placeholder}</span>
        )}
      </button>

      {open && (
        <div
          ref={listRef}
          role="listbox"
          className="absolute z-20 mt-1 max-h-72 w-full overflow-auto rounded-2xl border border-slate-200 bg-white text-black shadow-lg dark:border-slate-700 dark:bg-slate-800 dark:text-white"
        >
          {options.length === 0 && (
            <div className="px-3 py-2 text-sm text-slate-600 dark:text-slate-300">
              ไม่มีตัวเลือก
            </div>
          )}
          {options.map((opt, idx) => {
            const label = getLabel(opt);
            const isActive = idx === highlight;
            const isChosen = String(getValue(opt)) === String(value);
            return (
              <button
                key={String(getValue(opt)) || label || idx}
                type="button"
                role="option"
                aria-selected={isChosen}
                onMouseEnter={() => setHighlight(idx)}
                onClick={() => commit(opt)}
                className={[
                  "relative flex w-full items-center gap-2 px-3 py-2.5 text-left text-[15px] md:text-base transition rounded-xl cursor-pointer",
                  isActive
                    ? "bg-emerald-100 ring-1 ring-emerald-300 dark:bg-emerald-400/20 dark:ring-emerald-500"
                    : "hover:bg-emerald-50 dark:hover:bg-emerald-900/30",
                ].join(" ")}
              >
                {isActive && (
                  <span className="absolute left-0 top-0 h-full w-1 bg-emerald-600 dark:bg-emerald-400/70 rounded-l-xl" />
                )}
                <span className="flex-1">{label}</span>
                {isChosen && <span className="text-emerald-600 dark:text-emerald-300">✓</span>}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

/* ---------------- DateInput (custom popover, no showPicker) ---------------- */
const pad2 = (n) => String(n).padStart(2, "0");
const toYMD = (d) =>
  `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
const parseYMD = (s) => {
  if (!s || typeof s !== "string") return null;
  const m = s.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return null;
  const y = +m[1], mo = +m[2] - 1, d = +m[3];
  const dt = new Date(y, mo, d);
  return Number.isFinite(dt.getTime()) ? dt : null;
};
const getDaysInMonth = (year, monthIndex) =>
  new Date(year, monthIndex + 1, 0).getDate();

const DateInput = forwardRef(function DateInput(
  { value = "", onChange, error = false, className = "" },
  ref
) {
  const inputRef = useRef(null);
  useImperativeHandle(ref, () => inputRef.current);

  const today = new Date();
  const valueDate = parseYMD(value) || today;
  const [open, setOpen] = useState(false);
  const [viewYear, setViewYear] = useState(valueDate.getFullYear());
  const [viewMonth, setViewMonth] = useState(valueDate.getMonth());
  const boxRef = useRef(null);

  useEffect(() => {
    const onClick = (e) => {
      if (!boxRef.current) return;
      if (!boxRef.current.contains(e.target)) setOpen(false);
    };
    const onEsc = (e) => e.key === "Escape" && setOpen(false);
    document.addEventListener("click", onClick);
    document.addEventListener("keydown", onEsc);
    return () => {
      document.removeEventListener("click", onClick);
      document.removeEventListener("keydown", onEsc);
    };
  }, []);

  const commit = (d) => {
    const s = toYMD(d);
    // ทำให้ signature เหมือน input event ของเดิม
    onChange?.({ target: { value: s } });
    setOpen(false);
  };

  const nextMonth = () => {
    const m = viewMonth + 1;
    if (m > 11) {
      setViewMonth(0);
      setViewYear((y) => y + 1);
    } else {
      setViewMonth(m);
    }
  };
  const prevMonth = () => {
    const m = viewMonth - 1;
    if (m < 0) {
      setViewMonth(11);
      setViewYear((y) => y - 1);
    } else {
      setViewMonth(m);
    }
  };

  // ป้องกันลูกศรขึ้น/ลงของแป้นพิมพ์ไปชน handler อื่นจนล่ม
  const blockArrows = (e) => {
    if (e.key === "ArrowUp" || e.key === "ArrowDown") e.preventDefault();
  };

  // build วันในเดือน
  const first = new Date(viewYear, viewMonth, 1);
  const firstDay = first.getDay(); // 0=Sun
  const days = getDaysInMonth(viewYear, viewMonth);
  const weeks = [];
  let cur = 1 - ((firstDay + 6) % 7); // ให้คอลัมน์แรกเป็นวันจันทร์ (Mon=0)
  for (let w = 0; w < 6; w++) {
    const row = [];
    for (let d = 0; d < 7; d++, cur++) {
      row.push(cur);
    }
    weeks.push(row);
  }

  const weekHdr = ["จ", "อ", "พ", "พฤ", "ศ", "ส", "อา"];

  return (
    <div className="relative" ref={boxRef}>
      <input
        ref={inputRef}
        type="text"
        value={value}
        onChange={(e) => {
          // อนุญาตพิมพ์เองเป็น YYYY-MM-DD
          const v = e.target.value;
          if (!v || /^(\d{4})(-\d{0,2})?(-\d{0,2})?$/.test(v)) {
            onChange?.({ target: { value: v } });
          }
        }}
        onFocus={() => setOpen(true)}
        onKeyDown={blockArrows}
        placeholder="YYYY-MM-DD"
        className={[
          baseField,
          "pr-12 cursor-pointer",
          error ? "border-red-400 ring-2 ring-red-300/70" : "",
          className,
        ].join(" ")}
      />
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-label="เปิดตัวเลือกวันที่"
        className="absolute right-2 top-1/2 -translate-y-1/2 inline-flex h-9 w-9 items-center justify-center rounded-xl
                   transition-transform hover:scale-110 active:scale-95 focus:outline-none cursor-pointer bg-transparent"
      >
        <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor" className="text-slate-600 dark:text-slate-200">
          <path d="M7 2a1 1 0 0 1 1 1v1h8V3a1 1 0 1 1 2 0v1h1a2 2 0 0 1 2 2v3H3V6a2 2 0 0 1 2-2h1V3a1 1 0 1 1 1-1zm14 9v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-7h18zM7 14h2v2H7v-2zm4 0h2v2h-2v-2z" />
        </svg>
      </button>

      {open && (
        <div className="absolute z-30 mt-1 w-[280px] rounded-2xl border border-slate-200 bg-white text-black shadow-xl dark:border-slate-700 dark:bg-slate-800 dark:text-white">
          <div className="flex items-center justify-between px-3 py-2 border-b border-slate-100 dark:border-slate-700">
            <button
              type="button"
              onClick={prevMonth}
              className="rounded-lg px-2 py-1 hover:bg-slate-100 dark:hover:bg-slate-700"
            >
              ‹
            </button>
            <div className="font-semibold">
              {new Date(viewYear, viewMonth, 1).toLocaleDateString("th-TH", {
                year: "numeric",
                month: "long",
              })}
            </div>
            <button
              type="button"
              onClick={nextMonth}
              className="rounded-lg px-2 py-1 hover:bg-slate-100 dark:hover:bg-slate-700"
            >
              ›
            </button>
          </div>

          <div className="px-2 py-2">
            <div className="grid grid-cols-7 gap-1 text-center text-xs text-slate-500 dark:text-slate-300 mb-1">
              {weekHdr.map((d) => (
                <div key={d}>{d}</div>
              ))}
            </div>
            <div className="grid grid-cols-7 gap-1 text-center">
              {weeks.map((row, i) =>
                row.map((day, j) => {
                  const inMonth = day >= 1 && day <= days;
                  const d = new Date(viewYear, viewMonth, Math.max(1, Math.min(day, days)));
                  const s = inMonth ? toYMD(new Date(viewYear, viewMonth, day)) : "";
                  const isSelected = s && value && s === value;
                  const isToday = s && toYMD(today) === s;

                  return (
                    <button
                      type="button"
                      key={`${i}-${j}`}
                      disabled={!inMonth}
                      onClick={() => inMonth && commit(new Date(viewYear, viewMonth, day))}
                      className={[
                        "h-9 rounded-xl text-sm",
                        !inMonth
                          ? "opacity-30 cursor-default"
                          : "hover:bg-emerald-50 dark:hover:bg-emerald-900/30",
                        isSelected
                          ? "bg-emerald-600 text-white hover:bg-emerald-600"
                          : isToday
                          ? "ring-1 ring-emerald-400"
                          : "",
                      ].join(" ")}
                    >
                      {inMonth ? day : ""}
                    </button>
                  );
                })
              )}
            </div>

            <div className="mt-2 flex items-center justify-between">
              <button
                type="button"
                onClick={() => {
                  setViewYear(today.getFullYear());
                  setViewMonth(today.getMonth());
                  commit(today);
                }}
                className="rounded-xl px-3 py-1.5 text-sm bg-emerald-600 text-white hover:bg-emerald-700"
              >
                วันนี้
              </button>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="rounded-xl px-3 py-1.5 text-sm border border-slate-300 hover:bg-slate-100 dark:border-slate-600 dark:hover:bg-slate-700"
              >
                ปิด
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
});

/* ---------------- RBAC: อนุญาตเฉพาะ role_id ∈ {1,2,3} ---------------- */
const ALLOWED_ROLE_IDS = new Set([1, 2, 3]);
function getCurrentUserRoleId() {
  const u = getUser(); // { id, username, role_id, exp }  จาก saveAuth()
  // กันเคสตกค้าง/ระบบอื่น ๆ
  const fallbacks = [
    u?.role_id,
    u?.roleId,
    u?.role,
    Number(localStorage.getItem("role")),
  ].map((x) => (x == null ? null : Number(x)));
  const rid = fallbacks.find((n) => Number.isFinite(n)) || 0;
  return rid;
}

/* ---------------- Page constants ---------------- */
const PAGE_SIZE = 100;

const OrderCorrection = () => {
  /* ---------- RBAC ---------- */
  const roleId = getCurrentUserRoleId();
  const allowed = ALLOWED_ROLE_IDS.has(Number(roleId || 0));

  /* ---------- Dates ---------- */
  const today = new Date().toISOString().slice(0, 10);
  const firstDayThisMonth = new Date(
    new Date().getFullYear(),
    new Date().getMonth(),
    1
  )
    .toISOString()
    .slice(0, 10);

  /* ---------- State: list & filters ---------- */
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);

  const [page, setPage] = useState(1);
  const [pageInput, setPageInput] = useState("1");
  const totalPages = useMemo(
    () => Math.max(1, Math.ceil(rows.length / PAGE_SIZE)),
    [rows.length]
  );
  const pagedRows = useMemo(() => {
    const start = (page - 1) * PAGE_SIZE;
    return rows.slice(start, start + PAGE_SIZE);
  }, [rows, page]);

  // options
  const [branchOptions, setBranchOptions] = useState([]);
  const [klangOptions, setKlangOptions] = useState([]);
  const [specOptions, setSpecOptions] = useState([]);
  const [specDict, setSpecDict] = useState({});
  const [paymentBuy, setPaymentBuy] = useState([]); // [{id,label}]
  const [paymentSell, setPaymentSell] = useState([]);

  // filters
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

  /* ---------- Validation: date ---------- */
  const validateDates = (s, e) => {
    const out = { startDate: "", endDate: "" };
    if (!s) out.startDate = "กรุณาเลือกวันที่เริ่ม";
    if (!e) out.endDate = "กรุณาเลือกวันที่สิ้นสุด";
    if (s && e) {
      const sd = new Date(s);
      const ed = new Date(e);
      if (ed < sd) out.endDate = "วันสิ้นสุดต้องไม่ก่อนวันเริ่มต้น";
    }
    setErrors(out);
    return !out.startDate && !out.endDate;
  };
  useEffect(
    () => validateDates(filters.startDate, filters.endDate),
    [filters.startDate, filters.endDate]
  );

  /* ---------- Load options ---------- */
  useEffect(() => {
    const loadInitial = async () => {
      try {
        const [branches, specs, payB, payS] = await Promise.all([
          apiAuth(`/order/branch/search`),
          apiAuth(`/order/form/search`),
          apiAuth(`/order/payment/search/buy`), // 3=เงินสด, 4=เครดิต
          apiAuth(`/order/payment/search/sell`), // 1=เงินสด, 2=เครดิต
        ]);
        setBranchOptions(
          (Array.isArray(branches) ? branches : []).map((x) => ({
            id: String(x.id),
            label: x.branch_name,
          }))
        );

        const opts = (Array.isArray(specs) ? specs : [])
          .map((r) => ({
            id: String(r.id),
            label: String(
              r.prod_name || r.name || r.spec_name || `spec #${r.id}`
            ).trim(),
            raw: r,
          }))
          .filter((o) => o.id && o.label);

        setSpecOptions(opts.map(({ id, label }) => ({ id, label })));
        const dict = {};
        opts.forEach((o) => {
          dict[o.id] = o.raw;
        });
        setSpecDict(dict);

        setPaymentBuy(
          (Array.isArray(payB) ? payB : []).map((p) => ({
            id: String(p.id),
            label: p.payment,
          }))
        );
        setPaymentSell(
          (Array.isArray(payS) ? payS : []).map((p) => ({
            id: String(p.id),
            label: p.payment,
          }))
        );
      } catch (e) {
        console.error("load initial options failed:", e);
        setBranchOptions([]);
        setSpecOptions([]);
        setPaymentBuy([]);
        setPaymentSell([]);
      }
    };
    loadInitial();
  }, []);

  /* ---------- branch -> klang ---------- */
  useEffect(() => {
    const loadKlang = async () => {
      if (!filters.branchId) {
        setKlangOptions([]);
        setFilters((p) => ({ ...p, klangId: "", klangName: "" }));
        return;
      }
      try {
        const data = await apiAuth(
          `/order/klang/search?branch_id=${filters.branchId}`
        );
        setKlangOptions(
          (Array.isArray(data) ? data : []).map((x) => ({
            id: String(x.id),
            label: x.klang_name,
          }))
        );
      } catch (e) {
        console.error("load klang failed:", e);
        setKlangOptions([]);
      }
    };
    loadKlang();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters.branchId]);

  /* ---------- Fetch orders ---------- */
  const fetchOrders = async () => {
    if (!validateDates(filters.startDate, filters.endDate)) return;
    try {
      setLoading(true);
      const params = new URLSearchParams();
      params.set("start_date", filters.startDate);
      params.set("end_date", filters.endDate);
      if (filters.branchId) params.set("branch_id", filters.branchId);
      if (filters.klangId) params.set("klang_id", filters.klangId);
      if (filters.q?.trim()) params.set("q", filters.q.trim());

      const data = await apiAuth(`/order/orders/report?${params.toString()}`);
      setRows(Array.isArray(data) ? data : []);
      setPage(1);
      setPageInput("1");
    } catch (e) {
      console.error(e);
      setRows([]);
      setPage(1);
      setPageInput("1");
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => {
    fetchOrders();
  }, []);
  useEffect(() => {
    if (filters.q.length >= 2 || filters.q.length === 0) fetchOrders();
  }, [debouncedQ]);

  /* ---------- Totals ---------- */
  const totals = useMemo(() => {
    let weight = 0,
      revenue = 0;
    rows.forEach((x) => {
      weight += toNumber(x.weight);
      revenue += toNumber(x.price);
    });
    return { weight, revenue };
  }, [rows]);

  /* ---------- Pagination helpers ---------- */
  useEffect(() => {
    setPage((p) => Math.min(Math.max(1, p), totalPages));
    setPageInput((v) =>
      String(Math.min(Math.max(1, toNumber(onlyDigits(v)) || 1), totalPages))
    );
  }, [totalPages]);

  const goToPage = (p) => {
    const n = Math.min(Math.max(1, toNumber(p)), totalPages);
    setPage(n);
    setPageInput(String(n));
    try {
      const main = document.querySelector("main");
      if (main && typeof main.scrollTo === "function")
        main.scrollTo({ top: 0, behavior: "smooth" });
      else window?.scrollTo?.({ top: 0, behavior: "smooth" });
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

  /* ---------- Reset filters ---------- */
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

  /* ---------- EDIT MODAL ---------- */
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(null); // แถวที่เลือก
  const [draft, setDraft] = useState(null); // แบบฟอร์มแก้ไข
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [rowError, setRowError] = useState("");
  const [touched, setTouched] = useState(new Set());

  const touch = (k) => setTouched((prev) => new Set([...prev, String(k)]));
  const setD = (patch) =>
    setDraft((p) => ({
      ...(p || {}),
      ...(typeof patch === "function" ? patch(p || {}) : patch),
    }));

  const tryPrefillBranchKlang = async (row) => {
    let foundBranch = branchOptions.find(
      (b) => (b.label || "").trim() === (row.branch_name || "").trim()
    );
    let branchId = foundBranch?.id || "";
    let klangId = "";
    if (branchId) {
      try {
        const data = await apiAuth(`/order/klang/search?branch_id=${branchId}`);
        const opts = (Array.isArray(data) ? data : []).map((x) => ({
          id: String(x.id),
          label: x.klang_name,
        }));
        setKlangOptions(opts);
        const foundKlang = opts.find(
          (k) => (k.label || "").trim() === (row.klang_name || "").trim()
        );
        klangId = foundKlang?.id || "";
      } catch {}
    } else {
      setKlangOptions([]);
    }
    return { branchId, klangId };
  };

  const openModal = async (row) => {
    setRowError("");
    setTouched(new Set());
    setEditing(false);
    setActive(row);
    const guessType =
      toNumber(row.entry_weight) > 0 || toNumber(row.exit_weight) > 0
        ? "buy"
        : "sell";

    const { branchId, klangId } = await tryPrefillBranchKlang(row);

    const editorId = getUser()?.id || "";

    setDraft({
      order_id: row.id,
      type: guessType,
      edited_by: editorId,
      reason: "",

      // common
      date: row?.date ? new Date(row.date).toISOString().slice(0, 10) : "",
      branch_location: branchId,
      klang_location: klangId,
      payment_id: "",
      comment: "",

      // buy-ish
      order_serial: row.order_serial || "",
      entry_weight: row.entry_weight ?? 0,
      exit_weight: row.exit_weight ?? 0,
      weight: row.weight ?? 0,
      price_per_kilo: row.price_per_kilo ?? 0,
      price: row.price ?? 0,
      gram: "",
      humidity: "",
      impurity: "",

      // sell-ish
      order_serial_1: "",
      order_serial_2: "",
      license_plate_1: "",
      license_plate_2: "",
      weight_1: "",
      weight_2: "",
      price_1: "",
      price_2: "",

      // credit terms
      dept_allowed_period: "",
      dept_postpone: false,
      dept_postpone_period: "",

      // change spec
      spec_id: "",
    });

    setOpen(true);
  };

  const closeModal = () => {
    setOpen(false);
    setActive(null);
    setDraft(null);
    setEditing(false);
    setSaving(false);
    setRowError("");
    setTouched(new Set());
  };

  /* ---------- Save (PATCH) ---------- */
  const buildProductSpecIn = (specId) => {
    const raw = specDict[String(specId)];
    if (!raw) return null;
    // map ตรงกับ BE
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
    const wantsCredit = isBuy
      ? Number(d.payment_id) === 4 /* buy credit */
      : Number(d.payment_id) === 2 /* sell credit */;
    const anyFilled =
      d.dept_allowed_period !== "" ||
      d.dept_postpone === true ||
      d.dept_postpone_period !== "";
    if (!wantsCredit && !anyFilled) return undefined;
    return {
      allowed_period:
        d.dept_allowed_period === ""
          ? undefined
          : Number(onlyDigits(d.dept_allowed_period)),
      postpone: !!d.dept_postpone,
      postpone_period:
        d.dept_postpone_period === ""
          ? undefined
          : Number(onlyDigits(d.dept_postpone_period)),
    };
  };

  const save = async () => {
    if (!active || !draft) return;
    setRowError("");

    const editorId = Number(draft.edited_by);
    if (!Number.isFinite(editorId) || editorId <= 0) {
      setRowError(
        "กรุณากรอก 'รหัสพนักงานผู้แก้ไข (edited_by)' เป็นตัวเลขให้ถูกต้อง"
      );
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
      const patch = async (kind) => {
        const url =
          kind === "buy" ? `/order/orders/buy/${id}` : `/order/orders/sell/${id}`;
        const body = kind === "buy" ? payloadBuy : payloadSell;
        return apiAuth(url, { method: "PATCH", body });
      };
      try {
        return await patch(primary);
      } catch (e1) {
        const msg = (e1?.message || "").toLowerCase();
        const is404 = msg.includes("404") || msg.includes("not found");
        if (!is404) throw e1;
        const secondary = primary === "buy" ? "sell" : "buy";
        return await patch(secondary);
      }
    };

    try {
      const primary = draft.type === "sell" ? "sell" : "buy";
      await tryPatch(primary);
      setEditing(false);
      setOpen(false);
      await fetchOrders(); // refresh
    } catch (e) {
      console.error(e);
      setRowError(e?.message || "บันทึกไม่สำเร็จ");
    } finally {
      setSaving(false);
    }
  };

  /* ---------- Render ---------- */
  if (!allowed) {
    return (
      <div className="min-h-screen bg-white text-black dark:bg-slate-900 dark:text-white rounded-2xl">
        <div className="mx-auto max-w-4xl p-6">
          <div className="rounded-2xl border border-red-200 bg-red-50 p-6 text-red-800 dark:border-red-400 dark:bg-red-900/10 dark:text-red-200">
            <div className="text-2xl font-semibold mb-2">
              403 — ไม่มีสิทธิ์เข้าหน้านี้
            </div>
            <p>
              หน้านี้อนุญาตเฉพาะ <b>role_id 1/2/3 (admin / mng / hr)</b> เท่านั้น
            </p>
          </div>
        </div>
      </div>
    );
  }

  const startIndex = (page - 1) * PAGE_SIZE + 1;
  const endIndex = Math.min(rows.length, page * PAGE_SIZE);

  return (
    <PageErrorBoundary>
      <div className="min-h-screen bg-white text-black dark:bg-slate-900 dark:text-white rounded-2xl">
        <div className="mx-auto max-w-7xl p-4 md:p-6">
          <h1 className="mb-4 text-2xl font-bold text-gray-900 dark:text-white">
            🛠️ แก้ไขออเดอร์ (สำหรับบัญชี)
          </h1>

          {/* Filters */}
          <div className="mb-4 rounded-2xl border border-slate-200 bg-white p-4 text-black shadow-sm dark:border-slate-700 dark:bg-slate-800 dark:text-white">
            <div className="grid gap-3 md:grid-cols-6">
              <div>
                <label className="mb-1 block text-sm text-slate-700 dark:text-slate-300">
                  วันที่เริ่ม
                </label>
                <DateInput
                  value={filters.startDate}
                  onChange={(e) =>
                    setFilters((p) => ({ ...p, startDate: e.target.value }))
                  }
                  error={!!errors.startDate}
                />
                {errors.startDate && (
                  <div className="mt-1 text-sm text-red-500">
                    {errors.startDate}
                  </div>
                )}
              </div>

              <div>
                <label className="mb-1 block text-sm text-slate-700 dark:text-slate-300">
                  วันที่สิ้นสุด
                </label>
                <DateInput
                  value={filters.endDate}
                  onChange={(e) =>
                    setFilters((p) => ({ ...p, endDate: e.target.value }))
                  }
                  error={!!errors.endDate}
                />
                {errors.endDate && (
                  <div className="mt-1 text-sm text-red-500">
                    {errors.endDate}
                  </div>
                )}
              </div>

              {/* สาขา */}
              <div>
                <label className="mb-1 block text-sm text-slate-700 dark:text-slate-300">
                  สาขา
                </label>
                <ComboBox
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

              {/* คลัง */}
              <div>
                <label className="mb-1 block text-sm text-slate-700 dark:text-slate-300">
                  คลัง
                </label>
                <ComboBox
                  options={klangOptions}
                  value={filters.klangId}
                  getValue={(o) => o.id}
                  onChange={(id, found) =>
                    setFilters((p) => ({
                      ...p,
                      klangId: id || "",
                      klangName: found?.label ?? "",
                    }))
                  }
                  placeholder="— เลือกคลัง —"
                  disabled={!filters.branchId}
                />
              </div>

              {/* Search box */}
              <div className="md:col-span-2">
                <label className="mb-1 block text-sm text-slate-700 dark:text-slate-300">
                  ค้นหา (ชื่อ / ปชช. / เลขที่ใบสำคัญ)
                </label>
                <input
                  className={baseField}
                  value={filters.q}
                  onChange={(e) =>
                    setFilters((p) => ({ ...p, q: e.target.value }))
                  }
                  placeholder="พิมพ์อย่างน้อย 2 ตัวอักษร แล้วระบบจะค้นหาอัตโนมัติ"
                />
              </div>

              <div className="flex items-end gap-2 md:col-span-6">
                <button
                  onClick={fetchOrders}
                  type="button"
                  disabled={!!errors.startDate || !!errors.endDate}
                  className={[
                    "inline-flex items-center justify-center rounded-2xl px-6 py-3 text-base font-semibold text-white transition-all duration-300 ease-out cursor-pointer",
                    !!errors.startDate || !!errors.endDate
                      ? "bg-emerald-400/60 pointer-events-none"
                      : "bg-emerald-600 shadow-[0_6px_16px_rgba(16,185,129,0.35)] hover:bg-emerald-700 hover:shadow-[0_8px_20px_rgba(16,185,129,0.45)] hover:scale-[1.05] active:scale-[.97]",
                  ].join(" ")}
                >
                  ค้นหา
                </button>
                <button
                  type="button"
                  onClick={resetFilters}
                  className="inline-flex items-center justify-center rounded-2xl 
                             border border-slate-300 bg-white px-6 py-3 text-base font-medium text-slate-700 
                             shadow-sm transition-all duration-300 ease-out
                             hover:bg-slate-100 hover:shadow-md hover:scale-[1.03]
                             active:scale-[.97]
                             dark:border-slate-600 dark:bg-slate-700/60 dark:text-white 
                             dark:hover:bg-slate-700/50 dark:hover:shadow-lg cursor-pointer"
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
              <div className="text-2xl font-semibold">
                {rows.length.toLocaleString()}
              </div>
            </div>
            <div className="rounded-2xl bg-white p-4 text-black shadow-sm ring-1 ring-slate-200 dark:bg-slate-800 dark:text-white dark:ring-slate-700">
              <div className="text-slate-500 dark:text-slate-400">น้ำหนักรวม (กก.)</div>
              <div className="text-2xl font-semibold">
                {Math.round(toNumber(totals.weight) * 100) / 100}
              </div>
            </div>
            <div className="rounded-2xl bg-white p-4 text-black shadow-sm ring-1 ring-slate-200 dark:bg-slate-800 dark:text-white dark:ring-slate-700">
              <div className="text-slate-500 dark:text-slate-400">มูลค่ารวม</div>
              <div className="text-2xl font-semibold">
                {thb(toNumber(totals.revenue))}
              </div>
            </div>
          </div>

          {/* Table */}
          <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white text-black shadow-sm dark:border-slate-700 dark:bg-slate-800 dark:text-white">
            <table className="min-w-full text-left text-sm">
              <thead className="bg-slate-50 text-slate-700 dark:bg-slate-700 dark:text-slate-200">
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
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td className="px-3 py-3" colSpan={12}>
                      กำลังโหลด...
                    </td>
                  </tr>
                ) : rows.length === 0 ? (
                  <tr>
                    <td className="px-3 py-3" colSpan={12}>
                      ไม่พบข้อมูล
                    </td>
                  </tr>
                ) : (
                  pagedRows.map((r) => {
                    const entry = toNumber(r.entry_weight ?? 0);
                    const exit = toNumber(r.exit_weight ?? 0);
                    const net = toNumber(r.weight) || Math.max(0, Math.abs(exit - entry));
                    const price = toNumber(r.price ?? 0);
                    const pricePerKgRaw = toNumber(r.price_per_kilo ?? 0);
                    const pricePerKg = pricePerKgRaw || (net > 0 ? price / net : 0);
                    return (
                      <tr
                        key={
                          r.id ??
                          `${r.order_serial}-${r.date}-${r.first_name ?? ""}-${r.last_name ?? ""}`
                        }
                        className="odd:bg-white even:bg-slate-50 hover:bg-emerald-50 dark:odd:bg-slate-800 dark:even:bg-slate-700 dark:hover:bg-slate-700/70"
                      >
                        <td className="px-3 py-2">
                          {r.date ? new Date(r.date).toLocaleDateString("th-TH") : "—"}
                        </td>
                        <td className="px-3 py-2">{r.order_serial || "—"}</td>
                        <td className="px-3 py-2">
                          {`${r.first_name ?? ""} ${r.last_name ?? ""}`.trim() || "—"}
                        </td>
                        <td className="px-3 py-2">{r.species || "—"}</td>
                        <td className="px-3 py-2">{r.branch_name || "—"}</td>
                        <td className="px-3 py-2">{r.klang_name || "—"}</td>
                        <td className="px-3 py-2 text-right">
                          {entry.toLocaleString()}
                        </td>
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
                )}
              </tbody>
            </table>

            {/* Pagination Bar */}
            <div className="flex flex-col gap-3 p-3 md:flex-row md:items-center md:justify-between">
              <div className="text-sm text-slate-600 dark:text-slate-300">
                แสดง <b>{rows.length ? startIndex.toLocaleString() : 0}</b>
                –<b>{rows.length ? endIndex.toLocaleString() : 0}</b> จาก{" "}
                <b>{rows.length.toLocaleString()}</b> รายการ
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
                      <span
                        key={`dots-${idx}`}
                        className="px-2 text-slate-500 dark:text-slate-300"
                      >
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
                  <label className="text-sm text-slate-600 dark:text-slate-300">
                    ไปหน้า
                  </label>
                  <input
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
                  <span className="text-sm text-slate-600 dark:text-slate-300">
                    / {totalPages.toLocaleString()}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* EDIT MODAL */}
        <div
          className={`fixed inset-0 z-50 ${
            open ? "pointer-events-auto" : "pointer-events-none"
          }`}
          aria-hidden={!open}
        >
          <div
            className={`absolute inset-0 bg-black/60 transition-opacity ${
              open ? "opacity-100" : "opacity-0"
            }`}
            onClick={closeModal}
          />
          <div className="absolute inset-0 flex items-center justify-center p-3 sm:p-5">
            <div
              className={`h-[88vh] w-[96vw] max-w-[1280px] transform overflow-hidden rounded-2xl bg-white text-black shadow-2xl transition-all dark:bg-slate-800 dark:text-white ${
                open ? "scale-100 opacity-100" : "scale-95 opacity-0"
              }`}
            >
              <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4 dark:border-slate-700">
                <div className="text-xl md:text-2xl font-semibold">
                  {active ? `แก้ไขออเดอร์ #${active.id ?? "-"}` : "แก้ไขออเดอร์"}
                </div>
                <button
                  type="button"
                  onClick={closeModal}
                  className="rounded-xl border border-slate-300 px-4 py-2 text-base hover:bg-slate-50 dark:border-slate-600 dark:hover:bg-slate-700"
                >
                  ปิด
                </button>
              </div>

              <div className="h-[calc(88vh-64px)] overflow-y-auto p-4 md:p-6 text-base md:text-lg">
                {!active || !draft ? (
                  <div className="text-slate-600 dark:text-slate-300">ไม่มีข้อมูล</div>
                ) : (
                  <>
                    <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                      <div className="text-sm md:text-base text-slate-600 dark:text-slate-300">
                        วันที่เอกสาร:{" "}
                        {draft.date
                          ? new Date(draft.date).toLocaleDateString("th-TH")
                          : "-"}
                      </div>

                      {!editing ? (
                        <button
                          type="button"
                          onClick={() => setEditing(true)}
                          className="rounded-2xl bg-emerald-600 px-4 py-2 text-base font-semibold text-white hover:bg-emerald-700 active:scale-[.98]"
                        >
                          แก้ไข
                        </button>
                      ) : (
                        <div className="flex gap-2">
                          <button
                            type="button"
                            onClick={save}
                            disabled={saving}
                            className="rounded-2xl bg-emerald-600 px-5 py-2 text-base font-semibold text-white hover:bg-emerald-700 active:scale-[.98] disabled:opacity-60"
                          >
                            {saving ? "กำลังบันทึก..." : "บันทึกการแก้ไข"}
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setEditing(false);
                              openModal(active);
                            }}
                            className="rounded-2xl border border-slate-300 px-5 py-2 text-base hover:bg-slate-50 dark:border-slate-600 dark:hover:bg-slate-700"
                          >
                            ยกเลิก
                          </button>
                        </div>
                      )}
                    </div>

                    {rowError && (
                      <div className="mb-4 rounded-xl border border-red-200 bg-red-50 p-3 text-base text-red-700 dark:border-red-400 dark:bg-red-900/20 dark:text-red-200">
                        {rowError}
                      </div>
                    )}

                    {/* ผู้แก้ไข */}
                    <div className="mb-5 grid gap-4 md:grid-cols-3">
                      <div className="rounded-2xl border border-slate-200 bg-white/70 p-4 dark:border-slate-700 dark:bg-slate-700/40">
                        <div className="text-sm text-slate-600 dark:text-slate-300 mb-1">
                          รหัสพนักงานผู้แก้ไข (edited_by) *
                        </div>
                        {!editing ? (
                          <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-base dark:border-slate-700 dark:bg-slate-700/60">
                            {draft.edited_by || "-"}
                          </div>
                        ) : (
                          <input
                            inputMode="numeric"
                            className={baseField}
                            value={draft.edited_by}
                            onChange={(e) => {
                              setD({ edited_by: onlyDigits(e.target.value) });
                              touch("edited_by");
                            }}
                            placeholder="เฉพาะตัวเลข"
                          />
                        )}
                      </div>
                      <div className="rounded-2xl border border-slate-200 bg-white/70 p-4 dark:border-slate-700 dark:bg-slate-700/40 md:col-span-2">
                        <div className="text-sm text-slate-600 dark:text-slate-300 mb-1">
                          เหตุผลในการแก้ไข (reason)
                        </div>
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
                        <label className="mb-1 block text-sm text-slate-600 dark:text-slate-300">
                          ประเภทเอกสาร (เดาอัตโนมัติ, เปลี่ยนได้)
                        </label>
                        {!editing ? (
                          <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-base dark:border-slate-700 dark:bg-slate-700/60">
                            {draft.type === "sell" ? "ขาย (SELL)" : "ซื้อ (BUY)"}
                          </div>
                        ) : (
                          <ComboBox
                            options={[
                              { id: "buy", label: "ซื้อ (BUY)" },
                              { id: "sell", label: "ขาย (SELL)" },
                            ]}
                            value={draft.type}
                            getValue={(o) => o.id}
                            onChange={(id) => {
                              setD({ type: id });
                              touch("type");
                            }}
                          />
                        )}
                      </div>

                      <div>
                        <label className="mb-1 block text-sm text-slate-600 dark:text-slate-300">
                          วันที่เอกสาร
                        </label>
                        {!editing ? (
                          <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-base dark:border-slate-700 dark:bg-slate-700/60">
                            {draft.date
                              ? new Date(draft.date).toLocaleDateString("th-TH")
                              : "-"}
                          </div>
                        ) : (
                          <DateInput
                            value={draft.date}
                            onChange={(e) => {
                              setD({ date: e.target.value });
                              touch("date");
                            }}
                          />
                        )}
                      </div>

                      <div>
                        <label className="mb-1 block text-sm text-slate-600 dark:text-slate-300">
                          รายการสำเร็จรูป (เปลี่ยนสเปก)
                        </label>
                        {!editing ? (
                          <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-base dark:border-slate-700 dark:bg-slate-700/60">
                            {draft.spec_id ? `#${draft.spec_id}` : "-"}
                          </div>
                        ) : (
                          <ComboBox
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
                        <label className="mb-1 block text-sm text-slate-600 dark:text-slate-300">
                          สาขา
                        </label>
                        {!editing ? (
                          <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-base dark:border-slate-700 dark:bg-slate-700/60">
                            {draft.branch_location || "-"}
                          </div>
                        ) : (
                          <ComboBox
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
                        <label className="mb-1 block text-sm text-slate-600 dark:text-slate-300">
                          คลัง
                        </label>
                        {!editing ? (
                          <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-base dark:border-slate-700 dark:bg-slate-700/60">
                            {draft.klang_location || "-"}
                          </div>
                        ) : (
                          <ComboBox
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
                        <label className="mb-1 block text-sm text-slate-600 dark:text-slate-300">
                          วิธีชำระเงิน
                        </label>
                        {!editing ? (
                          <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-base dark:border-slate-700 dark:bg-slate-700/60">
                            {draft.payment_id || "-"}
                          </div>
                        ) : (
                          <ComboBox
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
                        <label className="mb-1 block text-sm text-slate-600 dark:text-slate-300">
                          หมายเหตุ
                        </label>
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

                    {/* ฟิลด์เฉพาะ BUY */}
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
                          ["gram", "แกรม", "number"],
                        ].map(([key, label, type]) => (
                          <div key={key}>
                            <label className="mb-1 block text-sm text-slate-600 dark:text-slate-300">
                              {label}
                            </label>
                            {!editing ? (
                              <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-base dark:border-slate-700 dark:bg-slate-700/60">
                                {String(draft[key] ?? "") || "-"}
                              </div>
                            ) : (
                              <input
                                type={type === "number" ? "text" : "text"}
                                inputMode={type === "number" ? "decimal" : undefined}
                                className={baseField}
                                value={String(draft[key] ?? "")}
                                onChange={(e) => {
                                  setD({
                                    [key]:
                                      type === "number"
                                        ? cleanDecimal(e.target.value)
                                        : e.target.value,
                                  });
                                  touch(key);
                                }}
                              />
                            )}
                          </div>
                        ))}
                      </div>
                    )}

                    {/* ฟิลด์เฉพาะ SELL */}
                    {draft.type === "sell" && (
                      <div className="mb-6 grid grid-cols-1 gap-5 md:grid-cols-3">
                        {[
                          ["order_serial_1", "เลขที่ใบสำคัญ 1"],
                          ["order_serial_2", "เลขที่ใบสำคัญ 2"],
                          ["license_plate_1", "ทะเบียนรถ 1"],
                          ["license_plate_2", "ทะเบียนรถ 2"],
                          ["weight_1", "น้ำหนัก 1 (กก.)", "number"],
                          ["weight_2", "น้ำหนัก 2 (กก.)", "number"],
                          ["price_per_kilo", "ราคาต่อกก. (บาท)", "number"],
                          ["price_1", "เป็นเงิน 1 (บาท)", "number"],
                          ["price_2", "เป็นเงิน 2 (บาท)", "number"],
                          ["gram", "แกรม", "number"],
                        ].map(([key, label, type]) => (
                          <div key={key}>
                            <label className="mb-1 block text-sm text-slate-600 dark:text-slate-300">
                              {label}
                            </label>
                            {!editing ? (
                              <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-base dark:border-slate-700 dark:bg-slate-700/60">
                                {String(draft[key] ?? "") || "-"}
                              </div>
                            ) : (
                              <input
                                type={type === "number" ? "text" : "text"}
                                inputMode={type === "number" ? "decimal" : undefined}
                                className={baseField}
                                value={String(draft[key] ?? "")}
                                onChange={(e) => {
                                  setD({
                                    [key]:
                                      type === "number"
                                        ? cleanDecimal(e.target.value)
                                        : e.target.value,
                                  });
                                  touch(key);
                                }}
                              />
                            )}
                          </div>
                        ))}
                      </div>
                    )}

                    {/* เงื่อนไขเครดิต */}
                    <div className="mb-2 text-sm text-slate-600 dark:text-slate-300">
                      เงื่อนไขเครดิต (จะแนบในคำขอเฉพาะเมื่อเป็นเครดิต:
                      buy=4, sell=2)
                    </div>
                    <div className="mb-8 grid grid-cols-1 gap-5 md:grid-cols-3">
                      <div>
                        <label className="mb-1 block text-sm text-slate-600 dark:text-slate-300">
                          อนุญาตเครดิต (วัน)
                        </label>
                        {!editing ? (
                          <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-base dark:border-slate-700 dark:bg-slate-700/60">
                            {draft.dept_allowed_period || "-"}
                          </div>
                        ) : (
                          <input
                            inputMode="numeric"
                            className={baseField}
                            value={draft.dept_allowed_period}
                            onChange={(e) => {
                              setD({ dept_allowed_period: onlyDigits(e.target.value) });
                              touch("dept_allowed_period");
                            }}
                            placeholder="จำนวนวัน"
                          />
                        )}
                      </div>

                      <div>
                        <label className="mb-1 block text-sm text-slate-600 dark:text-slate-300">
                          เลื่อนจ่าย/เลื่อนรับ (postpone)
                        </label>
                        {!editing ? (
                          <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-base dark:border-slate-700 dark:bg-slate-700/60">
                            {draft.dept_postpone ? "ใช่" : "ไม่"}
                          </div>
                        ) : (
                          <label className="inline-flex items-center gap-2 text-sm">
                            <input
                              type="checkbox"
                              checked={!!draft.dept_postpone}
                              onChange={(e) => {
                                setD({ dept_postpone: e.target.checked });
                                touch("dept_postpone");
                              }}
                            />
                            <span>เปิดใช้งาน</span>
                          </label>
                        )}
                      </div>

                      <div>
                        <label className="mb-1 block text-sm text-slate-600 dark:text-slate-300">
                          ระยะเวลาที่เลื่อน (วัน)
                        </label>
                        {!editing ? (
                          <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-base dark:border-slate-700 dark:bg-slate-700/60">
                            {draft.dept_postpone_period || "-"}
                          </div>
                        ) : (
                          <input
                            inputMode="numeric"
                            className={baseField}
                            value={draft.dept_postpone_period}
                            onChange={(e) => {
                              setD({
                                dept_postpone_period: onlyDigits(e.target.value),
                              });
                              touch("dept_postpone_period");
                            }}
                            placeholder="จำนวนวัน"
                          />
                        )}
                      </div>
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </PageErrorBoundary>
  );
};

export default OrderCorrection;
