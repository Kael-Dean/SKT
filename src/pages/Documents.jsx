  // src/pages/Documents.jsx
import { useEffect, useMemo, useRef, useState, forwardRef, useImperativeHandle } from "react"
import { apiAuth, apiDownload } from "../lib/api"   // helper แนบ token + BASE URL

/** ---------- Utils ---------- */
const cx = (...a) => a.filter(Boolean).join(" ")

/** ---------- Icons ---------- */
const PrinterIcon = ({ className = "", size = 20 }) => (
  <svg
    viewBox="0 0 24 24"
    width={size}
    height={size}
    fill="currentColor"
    className={className}
    aria-hidden="true"
  >
    <path d="M6 9V2h12v7H6zm2-5v3h8V4H8z" />
    <path d="M6 19h12v3H6v-3zm2 1v1h8v-1H8z" />
    <path d="M6 14H5a3 3 0 0 1-3-3V9a3 3 0 0 1 3-3h14a3 3 0 0 1 3 3v2a3 3 0 0 1-3 3h-1v-3H6v3zm13-5a1 1 0 1 0 0 2 1 1 0 0 0 0-2z" />
  </svg>
)

/** ---------- Styles ---------- */
const baseField =
  "w-full rounded-2xl border border-slate-300 bg-slate-100 p-3 text-[15px] md:text-base " +
  "text-black outline-none placeholder:text-slate-500 focus:border-emerald-600 focus:ring-2 focus:ring-emerald-500/30 shadow-none " +
  "dark:border-slate-500 dark:bg-slate-700 dark:text-slate-100 dark:placeholder:text-slate-300 dark:focus:border-emerald-400 dark:focus:ring-emerald-400/30"
const labelCls = "mb-1 block text-[15px] md:text-base font-medium text-slate-700 dark:text-slate-200"
const helpTextCls = "mt-1 text-sm text-slate-600 dark:text-slate-300"
const errorTextCls = "mt-1 text-sm text-red-500"

/** ---------- DateInput ---------- */
const DateInput = forwardRef(function DateInput(
  { error = false, className = "", ...props },
  ref
) {
  const inputRef = useRef(null)
  useImperativeHandle(ref, () => inputRef.current)

  return (
    <div className="relative">
      <style>{`input[type="date"]::-webkit-calendar-picker-indicator { opacity: 0; }`}</style>
      <input
        type="date"
        ref={inputRef}
        className={cx(
          baseField,
          "pr-12 cursor-pointer",
          error && "border-red-400 ring-2 ring-red-300/70",
          className
        )}
        {...props}
      />
      <button
        type="button"
        onClick={() => {
          const el = inputRef.current
          if (!el) return
          if (typeof el.showPicker === "function") el.showPicker()
          else { el.focus(); el.click?.() }
        }}
        aria-label="เปิดตัวเลือกวันที่"
        className="absolute right-2 top-1/2 -translate-y-1/2 inline-flex h-9 w-9 items-center justify-center rounded-xl
                   transition-transform hover:scale-110 active:scale-95 focus:outline-none cursor-pointer bg-transparent"
      >
        <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor" className="text-slate-600 dark:text-slate-200">
          <path d="M7 2a1 1 0 0 1 1 1v1h8V3a1 1 0 1 1 2 0v1h1a2 2 0 0 1 2 2v3H3V6a2 2 0 0 1 2-2h1V3a1 1 0 1 1 1-1zm14 9v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-7h18zM7 14h2v2H7v-2zm4 0h2v2h-2v-2z" />
        </svg>
      </button>
    </div>
  )
})

/** ---------- ComboBox ---------- */
function ComboBox({
  options = [],
  value,
  onChange,
  placeholder = "— เลือก —",
  getLabel = (o) => o?.label ?? "",
  getValue = (o) => o?.value ?? o?.id ?? "",
  disabled = false,
  error = false,
  buttonRef = null,
  onEnterNext = null,
}) {
  const [open, setOpen] = useState(false)
  const [highlight, setHighlight] = useState(-1)
  const boxRef = useRef(null)
  const listRef = useRef(null)
  const internalBtnRef = useRef(null)
  const controlRef = buttonRef || internalBtnRef

  const selectedLabel = useMemo(() => {
    const found = options.find((o) => String(getValue(o)) === String(value))
    return found ? getLabel(found) : ""
  }, [options, value, getLabel, getValue])

  const selectedIndex = useMemo(
    () => options.findIndex((o) => String(getValue(o)) === String(value)),
    [options, value, getValue]
  )

  useEffect(() => {
    const onClick = (e) => {
      if (!boxRef.current) return
      if (!boxRef.current.contains(e.target)) {
        setOpen(false)
        setHighlight(-1)
      }
    }
    document.addEventListener("click", onClick)
    return () => document.removeEventListener("click", onClick)
  }, [])

  useEffect(() => {
    if (open) {
      const idx = selectedIndex >= 0 ? selectedIndex : (options.length ? 0 : -1)
      setHighlight(idx)
      if (idx >= 0) {
        requestAnimationFrame(() => {
          const listEl = listRef.current
          const itemEl = listEl?.children?.[idx]
          if (!listEl || !itemEl) return
          const itemRect = itemEl.getBoundingClientRect()
          const listRect = listEl.getBoundingClientRect()
          const buffer = 6
          if (itemRect.top < listRect.top + buffer) {
            listEl.scrollTop -= (listRect.top + buffer) - itemRect.top
          } else if (itemRect.bottom > listRect.bottom - buffer) {
            listEl.scrollTop += itemRect.bottom - (listRect.bottom - buffer)
          }
        })
      }
    }
  }, [open, selectedIndex, options])

  const commit = (opt, { navigate = false } = {}) => {
    const v = String(getValue(opt))
    onChange?.(v, opt)
    setOpen(false)
    setHighlight(-1)
    requestAnimationFrame(() => {
      controlRef.current?.focus()
      if (navigate) onEnterNext?.()
    })
  }

  const onKeyDown = (e) => {
    if (disabled) return
    if (!open && e.key === "Enter") { e.preventDefault(); setOpen(true); return }
    if (!open && (e.key === " " || e.key === "ArrowDown")) { e.preventDefault(); setOpen(true); return }
    if (!open) return
    if (e.key === "ArrowDown") {
      e.preventDefault()
      setHighlight((h) => (h < options.length - 1 ? h + 1 : 0))
    } else if (e.key === "ArrowUp") {
      e.preventDefault()
      setHighlight((h) => (h > 0 ? h - 1 : options.length - 1))
    } else if (e.key === "Enter") {
      e.preventDefault()
      if (highlight >= 0 && highlight < options.length) commit(options[highlight], { navigate: true })
    } else if (e.key === "Escape") {
      e.preventDefault()
      setOpen(false); setHighlight(-1)
    }
  }

  return (
    <div className="relative" ref={boxRef}>
      <button
        type="button"
        ref={controlRef}
        disabled={disabled}
        onClick={() => {
          if (disabled) return
          setOpen((o) => {
            const willOpen = !o
            if (!o) {
              const idx = selectedIndex >= 0 ? selectedIndex : (options.length ? 0 : -1)
              setHighlight(idx)
            }
            return willOpen
          })
        }}
        onKeyDown={onKeyDown}
        className={cx(
          "w-full rounded-2xl border p-3 text-left text-[15px] md:text-base outline-none transition shadow-none",
          disabled ? "bg-slate-200 cursor-not-allowed" : "bg-slate-100 hover:bg-slate-200 cursor-pointer",
          error ? "border-red-400 ring-2 ring-red-300/70"
                : "border-slate-300 focus:border-emerald-600 focus:ring-2 focus:ring-emerald-500/30",
          "dark:border-slate-500 dark:bg-slate-700 dark:text-slate-100 dark:hover:bg-slate-700/80"
        )}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-invalid={error ? true : undefined}
      >
        {selectedLabel || <span className="text-slate-500 dark:text-white/70">{placeholder}</span>}
      </button>

      {open && (
        <div
          ref={listRef}
          role="listbox"
          className="absolute z-20 mt-1 max-h-72 w-full overflow-auto rounded-2xl border border-slate-200 bg-white text-black shadow-lg dark:border-slate-700 dark:bg-slate-800 dark:text-white"
        >
          {options.length === 0 && (
            <div className="px-3 py-2 text-sm text-slate-600 dark:text-slate-300">ไม่มีตัวเลือก</div>
          )}
          {options.map((opt, idx) => {
            const label = getLabel(opt)
            const isActive = idx === highlight
            const isChosen = String(getValue(opt)) === String(value)
            return (
              <button
                key={String(getValue(opt)) || label || idx}
                type="button"
                role="option"
                aria-selected={isChosen}
                onMouseEnter={() => setHighlight(idx)}
                onClick={() => commit(opt)}
                className={cx(
                  "relative flex w-full items-center gap-2 px-3 py-2.5 text-left text-[15px] md:text-base transition rounded-xl cursor-pointer",
                  isActive
                    ? "bg-emerald-100 ring-1 ring-emerald-300 dark:bg-emerald-400/20 dark:ring-emerald-500"
                    : "hover:bg-emerald-50 dark:hover:bg-emerald-900/30"
                )}
              >
                {isActive && (
                  <span className="absolute left-0 top-0 h-full w-1 bg-emerald-600 dark:bg-emerald-400/70 rounded-l-xl" />
                )}
                <span className="flex-1">{label}</span>
                {isChosen && <span className="text-emerald-600 dark:text-emerald-300">✓</span>}
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}

/** ---------- รายการรายงาน / mapping ไป BE ---------- */
const REPORTS = [
  {
    key: "purchaseGrouped",
    title: "ซื้อ/ขาย แยกราคาต่อกก. (Excel)",
    desc: "สรุปซื้อ-ขายตามราคาต่อกก. ช่วงวันที่ที่กำหนด",
    endpoint: "/report/orders/purchase-excel", // requires: start_date, end_date, spec_id; optional: branch_id, klang_id
    type: "excel",
    require: ["startDate", "endDate", "specId"],
    optional: ["branchId", "klangId"],
  },
  {
    key: "salesDaily",
    title: "ขายรายวัน (Excel)",
    desc: "รายการขายแบบแยกวันต่อวัน",
    endpoint: "/report/sales/daily-excel", // requires: start_date, end_date, branch_id; optional: spec_id
    type: "excel",
    require: ["startDate", "endDate", "branchId"],
    optional: ["specId"],
  },
  {
    key: "purchasesDaily",
    title: "ซื้อรายวัน (Excel)",
    desc: "รายการซื้อแบบแยกวันต่อวัน",
    endpoint: "/report/purchases/daily-excel", // requires: start_date, end_date, branch_id; optional: spec_id
    type: "excel",
    require: ["startDate", "endDate", "branchId"],
    optional: ["specId"],
  },
  {
    key: "registerPurchase",
    title: "ทะเบียนรับซื้อ (Excel)",
    desc: "ทะเบียนรับซื้อพร้อมค้นหาสายพันธุ์/ที่อยู่",
    endpoint: "/report/orders/register-excel", // requires: start_date, end_date; optional: branch_id, klang_id, species_like, addr_line4, addr_line5
    type: "excel",
    require: ["startDate", "endDate"],
    optional: ["branchId", "klangId", "speciesLike", "addrLine4", "addrLine5"],
  },
  {
    key: "branchRx",
    title: "สรุปสาขา (RX) (Excel)",
    desc: "ซื้อ-ขาย-รับโอน-โอน-ส่งสี-ตัดเสียหาย ตามสาขา",
    endpoint: "/report/branch-rx.xlsx", // requires: start_date, end_date, branch_id, spec_id
    type: "excel",
    require: ["startDate", "endDate", "branchId", "specId"],
    optional: [],
  },
  {
    key: "riceSummary",
    title: "สรุปซื้อขายรวม (Excel)",
    desc: "รวมทุกสาขา/ชนิดข้าวหลัก ช่วงวันที่ที่กำหนด",
    endpoint: "/report/rice-summary.xlsx", // requires: start_date, end_date
    type: "excel",
    require: ["startDate", "endDate"],
    optional: [],
  },
  {
    key: "stockTree",
    title: "โครงสร้างสต๊อก (JSON)",
    desc: "ภาพรวมสต๊อกแบบ Tree (product → species → …)",
    endpoint: "/report/stock/tree", // requires: branch_id, product_id; optional: klang_id
    type: "json",
    require: ["branchId", "productId"],
    optional: ["klangId"],
  },
  // -----------------------------
  // PDF (Documint) - เปิดดู/พิมพ์
  // -----------------------------
  {
    key: "buy-by-day",
    title: "รับซื้อรายวัน (PDF)",
    desc: "รายงานรับซื้อรายวันจาก Documint (กด 🖨️ เพื่อพิมพ์)",
    endpoint: "/docs/reports/buy-by-day.pdf", // requires: start_date, end_date; optional: branch_id, klang_id, spec_id
    type: "pdf",
    require: ["startDate", "endDate"],
    optional: ["branchId", "klangId", "specId"],
  },
  {
    key: "by-price",
    title: "สรุปตามราคาต่อกก. (PDF)",
    desc: "รายงานสรุปซื้อ/ขายตามราคาต่อกก. (Documint)",
    endpoint: "/docs/reports/by-price.pdf",
    type: "pdf",
    require: ["startDate", "endDate"],
    optional: ["branchId", "klangId", "specId"],
  },
  {
    key: "sell-by-day",
    title: "ขายรายวัน (PDF)",
    desc: "รายงานขายรายวันจาก Documint",
    endpoint: "/docs/reports/sell-by-day.pdf",
    type: "pdf",
    require: ["startDate", "endDate"],
    optional: ["branchId", "klangId", "specId"],
  },
  {
    key: "rice-summary",
    title: "สรุปซื้อขายรวม (PDF)",
    desc: "รายงานสรุปซื้อขายรวมจาก Documint",
    endpoint: "/docs/reports/rice-summary.pdf",
    type: "pdf",
    require: ["startDate", "endDate"],
    optional: ["branchId", "klangId", "specId"],
  },
  {
    key: "collection-report",
    title: "รายงานรวบรวม (PDF)",
    desc: "รายงานรวบรวม/สะสม (Documint)",
    endpoint: "/docs/reports/collection-report.pdf",
    type: "pdf",
    require: ["startDate", "endDate"],
    optional: ["branchId", "klangId", "specId"],
  },
  {
    key: "daily-report",
    title: "รายงานประจำวัน (PDF)",
    desc: "รายงานประจำวันจาก Documint",
    endpoint: "/docs/reports/daily-report.pdf",
    type: "pdf",
    require: ["startDate", "endDate"],
    optional: ["branchId", "klangId", "specId"],
  },
  {
    key: "control-report",
    title: "รายงานควบคุม (PDF)",
    desc: "รายงานควบคุมรวมทุกสาขา (Documint)",
    endpoint: "/docs/reports/control-report.pdf",
    type: "pdf",
    require: ["startDate", "endDate"],
    optional: ["branchId", "klangId", "specId"],
  },
  {
    key: "branch-summary",
    title: "สรุปสาขา/คลัง (PDF)",
    desc: "รายงานสรุปกิจกรรมสาขา/คลัง (Documint)",
    endpoint: "/docs/reports/branch-summary.pdf",
    type: "pdf",
    require: ["startDate", "endDate"],
    optional: ["branchId", "klangId", "specId"],
  },

]

function Documents() {
  /** ---------- โหลดตัวเลือกพื้นฐาน ---------- */
  const [loadingOptions, setLoadingOptions] = useState(false)
  const [loadingSpecs, setLoadingSpecs] = useState(false)
  const [downloading, setDownloading] = useState(false)
  const [errors, setErrors] = useState({})
  const [activeReport, setActiveReport] = useState(null)

  const [productOptions, setProductOptions] = useState([])
  const [specOptions, setSpecOptions] = useState([]) // รายการสำเร็จรูป (spec)
  const [branchOptions, setBranchOptions] = useState([])
  const [klangOptions, setKlangOptions] = useState([])

  const [previewJson, setPreviewJson] = useState(null)

  const today = new Date().toISOString().slice(0, 10)
  const firstDayThisMonth = useMemo(() => {
    const d = new Date(); d.setDate(1); return d.toISOString().slice(0, 10)
  }, [])

  /** ---------- State ฟิลเตอร์ ---------- */
  const [filters, setFilters] = useState({
    startDate: firstDayThisMonth,
    endDate: today,
    productId: "",
    specId: "",
    branchId: "",
    klangId: "",
    speciesLike: "",
    addrLine4: "",
    addrLine5: "",
  })
  const setFilter = (k, v) => setFilters((p) => ({ ...p, [k]: v }))

  /** โหลดตัวเลือกพื้นฐาน (product, branch) */
  useEffect(() => {
    const loadOptions = async () => {
      try {
        setLoadingOptions(true)
        const [products, branches] = await Promise.all([
          apiAuth("/order/product/search"),
          apiAuth("/order/branch/search"),
        ])
        setProductOptions(
          (products || [])
            .map((x) => ({
              id: String(x.id ?? x.product_id ?? ""),
              label: String(x.product_type ?? x.name ?? "").trim(),
            }))
            .filter((o) => o.id && o.label)
        )
        setBranchOptions(
          (branches || [])
            .map((b) => ({ id: String(b.id), label: b.branch_name }))
            .filter((o) => o.id && o.label)
        )
      } catch (e) {
        console.error("loadOptions error:", e)
        setProductOptions([]); setBranchOptions([])
      } finally {
        setLoadingOptions(false)
      }
    }
    loadOptions()
  }, [])

  /** โหลด “รายการสำเร็จรูป (spec)” แบบหน้า buy: /order/form/search */
  useEffect(() => {
    const loadSpecs = async () => {
      try {
        setLoadingSpecs(true)
        const rows = await apiAuth("/order/form/search") // คืน ProductSpec ที่มี prod_name แล้ว
        const opts = (rows || [])
          .map((r) => ({
            id: String(r.id),
            label: String(r.prod_name || r.name || r.spec_name || `spec #${r.id}`).trim(),
          }))
          .filter((o) => o.id && o.label)

        // 🔧 แสดงเฉพาะ 2 รายการบนสุดเท่านั้น
        setSpecOptions(opts.slice(0, 2))
      } catch (e) {
        console.error("loadSpecs error:", e)
        setSpecOptions([])
      } finally {
        setLoadingSpecs(false)
      }
    }
    loadSpecs()
  }, [])

  /** branch → klang */
  useEffect(() => {
    const bId = filters.branchId
    if (!bId) {
      setKlangOptions([])
      setFilters((p) => ({ ...p, klangId: "" }))
      return
    }
    (async () => {
      try {
        const arr = (await apiAuth(`/order/klang/search?branch_id=${encodeURIComponent(bId)}`)) || []
        setKlangOptions(arr.map((x) => ({ id: String(x.id), label: x.klang_name })).filter((o) => o.id && o.label))
      } catch (e) {
        console.error("load klang error:", e)
        setKlangOptions([])
      }
    })()
  }, [filters.branchId])

  /** ---------- Validation ---------- */
  const validate = (report) => {
    const e = {}
    if (!report) return e

    const needDate = report.require.includes("startDate") || report.require.includes("endDate")
    if (needDate) {
      if (!filters.startDate) e.startDate = "กรุณาเลือกวันที่เริ่มต้น"
      if (!filters.endDate) e.endDate = "กรุณาเลือกวันที่สิ้นสุด"
      if (filters.startDate && filters.endDate) {
        const s = new Date(filters.startDate)
        const ed = new Date(filters.endDate)
        if (ed < s) e.endDate = "วันสิ้นสุดต้องไม่ก่อนวันเริ่มต้น"
      }
    }
    for (const field of report.require) {
      if (["startDate", "endDate"].includes(field)) continue
      if (!filters[field]) e[field] = "จำเป็นต้องระบุ"
    }
    setErrors(e)
    return e
  }

  /** ---------- Map ฟิลด์ → QueryString ---------- */
  const buildParams = (report) => {
    const p = new URLSearchParams()
    if (report.require.includes("startDate") || report.optional?.includes?.("startDate")) p.set("start_date", filters.startDate)
    if (report.require.includes("endDate") || report.optional?.includes?.("endDate")) p.set("end_date", filters.endDate)
    if (filters.branchId) p.set("branch_id", filters.branchId)
    if (filters.klangId) p.set("klang_id", filters.klangId)
    if (filters.specId) {
      // รองรับ BE ที่รับหลายค่า: spec_id=1&spec_id=2 (ตอนนี้เราเลือกเดี่ยว แต่ใช้ append เผื่ออนาคต)
      p.append("spec_id", filters.specId)
    }
    if (filters.productId && report.key === "stockTree") p.set("product_id", filters.productId)

    if (report.key === "registerPurchase") {
      if (filters.speciesLike) p.set("species_like", filters.speciesLike.trim())
      if (filters.addrLine4) p.set("addr_line4", filters.addrLine4.trim())
      if (filters.addrLine5) p.set("addr_line5", filters.addrLine5.trim())
    }
    return p
  }


  /** ---------- Download / Preview / Print ---------- */
  const doDownload = async (report) => {
    const errs = validate(report)
    if (Object.keys(errs).length) return

    // สำหรับ PDF: เปิดหน้าต่าง “ทันที” (กัน popup ถูก block) แล้วค่อยยัด PDF ทีหลัง
    const preOpenWin = report.type === "pdf" ? window.open("", "_blank") : null
    if (preOpenWin && report.type === "pdf") {
      try {
        preOpenWin.document.title = report.title || "Report"
        preOpenWin.document.body.innerHTML = `
          <div style="font-family: sans-serif; padding: 16px;">
            <div style="font-size: 16px; font-weight: 600;">กำลังเตรียมรายงาน…</div>
            <div style="margin-top: 6px; color: #64748b;">ถ้าหน้านี้ไม่เปลี่ยนเป็น PDF ให้ตรวจสอบการเชื่อมต่อ/สิทธิ์การเข้าถึง</div>
          </div>
        `
      } catch (_) {}
    }

    try {
      setDownloading(true)
      const params = buildParams(report)

      if (report.type === "excel") {
        const { blob, filename } = await apiDownload(`${report.endpoint}?${params.toString()}`)
        const link = document.createElement("a")
        link.href = URL.createObjectURL(blob)
        link.download = filename || `${report.key}_${filters.startDate || ""}_${filters.endDate || ""}.xlsx`
        document.body.appendChild(link); link.click(); link.remove()
        setTimeout(() => URL.revokeObjectURL(link.href), 3000)
        return
      }

      if (report.type === "pdf") {
        // ✅ สำคัญ: ตั้ง preview=false เพื่อได้ไฟล์สำหรับพิมพ์ (ปกติ preview=true จะมีลายน้ำ)
        params.set("preview", "false")

        const { blob } = await apiDownload(`${report.endpoint}?${params.toString()}`)
        const url = URL.createObjectURL(blob)

        // ถ้าเปิดหน้าต่างไว้ได้ ให้ redirect ไป PDF
        if (preOpenWin) {
          try {
            preOpenWin.location.href = url
            // พยายามสั่งพิมพ์อัตโนมัติ (บาง browser อาจบล็อก/ไม่รองรับ)
            const tryPrint = () => {
              try { preOpenWin.focus(); preOpenWin.print() } catch (_) {}
            }
            setTimeout(tryPrint, 1200)
          } catch (_) {}
        } else {
          // fallback
          const link = document.createElement("a")
          link.href = url
          link.target = "_blank"
          link.rel = "noreferrer"
          document.body.appendChild(link); link.click(); link.remove()
        }

        // ค่อย revoke ทีหลัง (เผื่อยังโหลดไม่เสร็จ)
        setTimeout(() => URL.revokeObjectURL(url), 60_000)
        return
      }

      // json
      const json = await apiAuth(`${report.endpoint}?${params.toString()}`)
      setPreviewJson(json)
      const blob = new Blob([JSON.stringify(json, null, 2)], { type: "application/json" })
      const link = document.createElement("a")
      link.href = URL.createObjectURL(blob)
      link.download = `${report.key}.json`
      document.body.appendChild(link); link.click(); link.remove()
      setTimeout(() => URL.revokeObjectURL(link.href), 3000)

    } catch (err) {
      console.error(err)
      try { preOpenWin?.close?.() } catch (_) {}
      alert("เกิดข้อผิดพลาดในการดึงรายงาน")
    } finally {
      setDownloading(false)
    }
  }

  const resetForm = () =>
    setFilters({
      startDate: firstDayThisMonth,
      endDate: new Date().toISOString().slice(0, 10),
      productId: "",
      specId: "",
      branchId: "",
      klangId: "",
      speciesLike: "",
      addrLine4: "",
      addrLine5: "",
    })

  /** ---------- UI helpers ---------- */
  const FieldError = ({ name }) =>
    errors[name] ? <div className={errorTextCls}>{errors[name]}</div> : null

  const withEmpty = (opts, emptyLabel = "— เลือก —") => [{ id: "", label: emptyLabel }, ...opts]

  const FormDates = ({ report }) => {
    if (!(report.require.includes("startDate") || report.require.includes("endDate"))) return null
    return (
      <>
        <div>
          <label className={labelCls}>วันที่เริ่มต้น</label>
          <DateInput
            value={filters.startDate}
            onChange={(e) => setFilter("startDate", e.target.value)}
            error={!!errors.startDate}
          />
          <FieldError name="startDate" />
        </div>
        <div>
          <label className={labelCls}>วันที่สิ้นสุด</label>
          <DateInput
            value={filters.endDate}
            onChange={(e) => setFilter("endDate", e.target.value)}
            error={!!errors.endDate}
          />
          <FieldError name="endDate" />
        </div>
      </>
    )
  }

  /** ดรอปดาว “รายการสำเร็จรูป (spec)” จาก BE */
  const FormSpecOnly = ({ requiredSpec = false }) => (
    <div>
      <label className={labelCls}>
        รายการสำเร็จรูป (spec){requiredSpec && <span className="text-red-500"> *</span>}
      </label>
      <ComboBox
        options={withEmpty(specOptions, loadingSpecs ? "— กำลังโหลด… —" : "— เลือก —")}
        value={filters.specId}
        onChange={(v) => setFilter("specId", v)}
        placeholder={loadingSpecs ? "— กำลังโหลด… —" : "— เลือก —"}
        disabled={loadingSpecs || specOptions.length === 0}
        error={!!(requiredSpec && errors.specId)}
      />
      {requiredSpec && <FieldError name="specId" />}
      <p className={helpTextCls}>ข้อมูลรายการมาจากฝั่ง BE <code>/order/form/search</code> (prod_name)</p>
    </div>
  )

  const FormBranchKlang = ({ requireBranch = false }) => (
    <>
      <div>
        <label className={labelCls}>
          สาขา{requireBranch && <span className="text-red-500"> *</span>}
        </label>
        <ComboBox
          options={withEmpty(branchOptions, "— เลือก —")}
          value={filters.branchId}
          onChange={(v) => setFilter("branchId", v)}
          placeholder="— เลือก —"
          error={!!(requireBranch && errors.branchId)}
        />
        {requireBranch && <FieldError name="branchId" />}
      </div>
      <div>
        <label className={labelCls}>คลัง (ไม่บังคับ)</label>
        <ComboBox
          options={withEmpty(klangOptions, "— ทั้งหมด —")}
          value={filters.klangId}
          onChange={(v) => setFilter("klangId", v)}
          placeholder="— ทั้งหมด —"
          disabled={!filters.branchId || klangOptions.length === 0}
        />
      </div>
    </>
  )

  const renderReportForm = (report) => {
    if (!report) return null

    if (report.key === "purchaseGrouped") {
      return (
        <div className="grid gap-4 md:grid-cols-3">
          <FormDates report={report} />
          <FormSpecOnly requiredSpec />
          <FormBranchKlang requireBranch={false} />
        </div>
      )
    }

    if (report.key === "salesDaily" || report.key === "purchasesDaily") {
      return (
        <>
          <div className="grid gap-4 md:grid-cols-3">
            <FormDates report={report} />
            <FormBranchKlang requireBranch />
            <FormSpecOnly requiredSpec={false} />
          </div>
          <p className={helpTextCls}>ถ้าไม่เลือกสเปก ระบบจะออกรวมทุกชนิดในสาขาที่เลือก</p>
        </>
      )
    }

    if (report.key === "registerPurchase") {
      return (
        <div className="grid gap-4 md:grid-cols-3">
          <FormDates report={report} />
          <FormBranchKlang requireBranch={false} />
          <div>
            <label className={labelCls}>ค้นหาชื่อสายพันธุ์ (`species_like`)</label>
            <input
              className={baseField}
              placeholder="เช่น มะลิ"
              value={filters.speciesLike}
              onChange={(e) => setFilter("speciesLike", e.target.value)}
            />
          </div>
          <div>
            <label className={labelCls}>ที่อยู่ บรรทัด 4 (`addr_line4`)</label>
            <input
              className={baseField}
              value={filters.addrLine4}
              onChange={(e) => setFilter("addrLine4", e.target.value)}
            />
          </div>
          <div>
            <label className={labelCls}>ที่อยู่ บรรทัด 5 (`addr_line5`)</label>
            <input
              className={baseField}
              value={filters.addrLine5}
              onChange={(e) => setFilter("addrLine5", e.target.value)}
            />
          </div>
        </div>
      )
    }

    if (report.key === "branchRx") {
      return (
        <div className="grid gap-4 md:grid-cols-3">
          <FormDates report={report} />
          <FormBranchKlang requireBranch />
          <FormSpecOnly requiredSpec />
        </div>
      )
    }

    if (report.key === "riceSummary") {
      return <div className="grid gap-4 md:grid-cols-3"><FormDates report={report} /></div>
    }

    if (report.key === "stockTree") {
      return (
        <>
          <div className="grid gap-4 md:grid-cols-3">
            <FormBranchKlang requireBranch />
            <div>
              <label className={labelCls}>ประเภทสินค้า (product_id) *</label>
              <ComboBox
                options={withEmpty(productOptions, "— เลือก —")}
                value={filters.productId}
                onChange={(v) => setFilter("productId", v)}
                placeholder="— เลือก —"
                error={!!errors.productId}
              />
              <FieldError name="productId" />
            </div>
          </div>

          {previewJson && (
            <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm dark:border-slate-700 dark:bg-slate-800">
              <div className="mb-2 font-semibold">ตัวอย่างผลลัพธ์ (JSON)</div>
              <pre className="max-h-80 overflow-auto whitespace-pre-wrap break-words">
                {JSON.stringify(previewJson, null, 2)}
              </pre>
            </div>
          )}
        </>
      )
    }


    // ✅ Documint PDF (พิมพ์)
    if (report.type === "pdf") {
      return (
        <>
          <div className="grid gap-4 md:grid-cols-3">
            <FormDates report={report} />
            <FormBranchKlang requireBranch={false} />
            <FormSpecOnly requiredSpec={false} />
          </div>
          <p className={helpTextCls}>
            กดปุ่ม <span className="font-semibold">🖨️</span> เพื่อเปิด PDF แล้วพิมพ์ (ระบบจะเรียก BE <code>/docs/reports/&lt;report_code&gt;.pdf</code>)
          </p>
        </>
      )
    }

    return null
  }

  const reportObj = REPORTS.find((r) => r.key === activeReport)

  return (
    <div className="min-h-screen bg-white text-black dark:bg-slate-900 dark:text-white rounded-2xl text-[15px] md:text-base documents-page">
      {/* ให้ปุ่มที่กดได้เป็นเคอร์เซอร์นิ้วชี้เฉพาะตอน hover และไม่ทับ disabled/wait */}
      <style>{`
        .documents-page button:not(:disabled):not(.cursor-not-allowed):not(.cursor-wait):hover { cursor: pointer; }
        .documents-page [role="button"]:hover, .documents-page [role="option"]:hover { cursor: pointer; }
      `}</style>

      <div className="mx-auto max-w-6xl p-5 md:p-6 lg:p-8">
        <div className="mb-6 flex items-center gap-3">
          <h1 className="text-3xl font-bold">📚 คลังเอกสาร & รายงาน</h1>
          {!loadingOptions && !loadingSpecs && (
            <span className="inline-flex items-center gap-2 rounded-full bg-emerald-50 px-3 py-1.5 text-emerald-700 ring-1 ring-emerald-200 dark:bg-emerald-900/20 dark:text-emerald-200 dark:ring-emerald-700/60">
              พร้อมใช้งาน
            </span>
          )}
        </div>

        {!reportObj && (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {REPORTS.map((r) => (
              <button
                key={r.key}
                type="button"
                onClick={() => { setActiveReport(r.key); setPreviewJson(null); setErrors({}); }}
                className="group rounded-2xl border border-slate-200 bg-white p-5 text-left shadow-sm transition-all hover:shadow-md hover:scale-[1.01] dark:border-slate-700 dark:bg-slate-800 cursor-pointer"
              >
                <div className="mb-2 flex items-center justify-between">
                  <div className="text-lg font-semibold">{r.title}</div>
                  <span className={cx(
                    "rounded-full px-2.5 py-1 text-xs font-medium",
                    r.type === "excel"
                      ? "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200 dark:bg-emerald-900/20 dark:text-emerald-200 dark:ring-emerald-700/60"
                      : r.type === "pdf"
                        ? "bg-fuchsia-50 text-fuchsia-700 ring-1 ring-fuchsia-200 dark:bg-fuchsia-900/20 dark:text-fuchsia-200 dark:ring-fuchsia-700/60"
                        : "bg-sky-50 text-sky-700 ring-1 ring-sky-200 dark:bg-sky-900/20 dark:text-sky-200 dark:ring-sky-700/60"
                  )}>
                    {r.type.toUpperCase()}
                  </span>
                </div>
                <p className="text-slate-600 dark:text-slate-300">{r.desc}</p>
              </button>
            ))}
          </div>
        )}

        {reportObj && (
          <form
            onSubmit={(e) => { e.preventDefault(); doDownload(reportObj) }}
            className="rounded-2xl border border-slate-200 bg-white p-5 text-black shadow-sm dark:border-slate-700 dark:bg-slate-800 dark:text-white mt-2"
          >
            <div className="mb-5 flex items-center justify-between gap-3">
              <div>
                <div className="text-xl font-semibold">{reportObj.title}</div>
                <div className={helpTextCls}>{reportObj.desc}</div>
              </div>
              <button
                type="button"
                onClick={() => { setActiveReport(null); setPreviewJson(null); setErrors({}); }}
                className="inline-flex items-center justify-center rounded-2xl border border-slate-300 bg-white px-4 md:px-5 py-3 text-base font-semibold text-slate-700 shadow-sm transition-all hover:bg-slate-100 hover:shadow-md hover:scale-[1.02] active:scale-[.98] dark:border-slate-600 dark:bg-slate-700/60 dark:text-white dark:hover:bg-slate-700/50 cursor-pointer"
                title="กลับไปหน้าเลือกรายงาน"
              >
                ← เลือกรายงานอื่น
              </button>
            </div>

            {renderReportForm(reportObj)}

            <div className="mt-6 flex flex-wrap items-center gap-3">
              <button
                type="submit"
                disabled={downloading}
                className={cx(
                  "inline-flex items-center justify-center rounded-2xl bg-emerald-600 px-6 py-3 text-base font-semibold text-white " +
                  "shadow-[0_6px_16px_rgba(16,185,129,0.35)] transition-all duration-300 ease-out " +
                  "hover:bg-emerald-700 hover:shadow-[0_8px_20px_rgba(16,185,129,0.45)] hover:scale-[1.05] active:scale-[.97] cursor-pointer",
                  downloading && "opacity-70 cursor-wait hover:scale-100 hover:shadow-none"
                )}
              >
                {reportObj.type === "excel"
                  ? (downloading ? "กำลังเตรียมไฟล์..." : "⬇️ ดาวน์โหลด Excel")
                  : reportObj.type === "pdf"
                    ? (downloading ? "กำลังเตรียม PDF..." : (
                        <span className="inline-flex items-center gap-2">
                          <PrinterIcon className="-ml-0.5" />
                          พิมพ์ PDF
                        </span>
                      ))
                    : (downloading ? "กำลังดึงข้อมูล..." : "👁️‍🗨️ พรีวิว + ดาวน์โหลด JSON")}
              </button>

              <button
                type="button"
                onClick={resetForm}
                className={
                  "inline-flex items-center justify-center rounded-2xl border border-slate-300 bg-white px-6 py-3 text-base " +
                  "font-medium text-slate-700 shadow-sm transition-all duration-300 ease-out hover:bg-slate-100 hover:shadow-md " +
                  "hover:scale-[1.03] active:scale-[.97] dark:border-slate-600 dark:bg-slate-700/60 dark:text-white " +
                  "dark:hover:bg-slate-700/50 dark:hover:shadow-lg cursor-pointer"
                }
              >
                รีเซ็ตตัวกรอง
              </button>
            </div>
          </form>
        )}

        <div className="mt-6 rounded-2xl border border-dashed border-slate-300 p-5 text-slate-600 dark:border-slate-600 dark:text-slate-300">
          <div className="font-medium">เพิ่มรายงานใหม่</div>
          <div className="mt-1 text-sm">
            ให้หลังบ้านเปิด endpoint ภายใต้ <code className="px-1 rounded bg-slate-100 dark:bg-slate-700">/report/…</code> (Excel/JSON) หรือ <code className="px-1 rounded bg-slate-100 dark:bg-slate-700">/docs/reports/&lt;report_code&gt;.pdf</code> (Documint PDF) แล้วเพิ่มรายการในอาร์เรย์ <code>REPORTS</code> พร้อมกำหนด <code>require</code>/<code>optional</code> ให้ตรงกับพารามิเตอร์ของ BE
          </div>
        </div>
      </div>
    </div>
  )
}

export default Documents
