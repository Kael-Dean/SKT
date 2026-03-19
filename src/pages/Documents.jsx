// src/pages/Documents.jsx
import { useEffect, useMemo, useRef, useState, forwardRef, useImperativeHandle } from "react"
import { apiAuth, apiDownload } from "../lib/api"   // helper แนบ token + BASE URL

/** ---------- Utils ---------- */
const cx = (...a) => a.filter(Boolean).join(" ")

const safeQS = () => {
  try {
    if (typeof window === "undefined") return new URLSearchParams()
    return new URLSearchParams(window.location.search)
  } catch (_) {
    return new URLSearchParams()
  }
}

const pickQS = (qs, keys) => {
  for (const k of keys) {
    const v = qs.get(k)
    if (v !== null && v !== undefined && String(v).trim() !== "") return String(v)
  }
  return ""
}

const toggleCsvId = (csv, id) => {
  const raw = String(csv || "")
  const tokens = raw
    .split(/[,\s]+/)
    .map((x) => x.trim())
    .filter(Boolean)

  const s = String(id)
  const has = tokens.includes(s)
  const next = has ? tokens.filter((x) => x !== s) : [...tokens, s]

  // unique + stable
  const uniq = Array.from(new Set(next))
  return uniq.join(",")
}

const parseCsvInts = (csv) => {
  const raw = String(csv || "")
  const out = []
  for (const token of raw.split(/[,\s]+/)) {
    const t = token.trim()
    if (!t) continue
    // รับเฉพาะเลขจำนวนเต็ม
    if (!/^\d+$/.test(t)) continue
    out.push(Number(t))
  }
  // unique
  return Array.from(new Set(out))
}

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
          else {
            el.focus()
            el.click?.()
          }
        }}
        aria-label="เปิดตัวเลือกวันที่"
        className="absolute right-2 top-1/2 -translate-y-1/2 inline-flex h-9 w-9 items-center justify-center rounded-xl
                   transition-transform hover:scale-110 active:scale-95 focus:outline-none cursor-pointer bg-transparent"
      >
        <svg
          viewBox="0 0 24 24"
          width="20"
          height="20"
          fill="currentColor"
          className="text-slate-600 dark:text-slate-200"
        >
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
      const idx = selectedIndex >= 0 ? selectedIndex : options.length ? 0 : -1
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
            listEl.scrollTop -= listRect.top + buffer - itemRect.top
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
    if (!open && e.key === "Enter") {
      e.preventDefault()
      setOpen(true)
      return
    }
    if (!open && (e.key === " " || e.key === "ArrowDown")) {
      e.preventDefault()
      setOpen(true)
      return
    }
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
      setOpen(false)
      setHighlight(-1)
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
              const idx = selectedIndex >= 0 ? selectedIndex : options.length ? 0 : -1
              setHighlight(idx)
            }
            return willOpen
          })
        }}
        onKeyDown={onKeyDown}
        className={cx(
          "w-full rounded-2xl border p-3 text-left text-[15px] md:text-base outline-none transition shadow-none",
          disabled ? "bg-slate-200 cursor-not-allowed" : "bg-slate-100 hover:bg-slate-200 cursor-pointer",
          error
            ? "border-red-400 ring-2 ring-red-300/70"
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

/** ---------- รายการรายงาน ---------- */
const INTERNAL_REPORTS = [
  {
    key: "purchaseGrouped",
    title: "ซื้อ/ขาย แยกราคาต่อกก. (Excel)",
    endpoint: "/report/orders/purchase-excel", 
    type: "excel",
    badge: "EXCEL",
    require: ["startDate", "endDate", "specId"],
    optional: ["branchId", "klangId"],
  },
  {
    key: "salesDaily",
    title: "ขายรายวัน (Excel)",
    endpoint: "/report/sales/daily-excel",
    type: "excel",
    badge: "EXCEL",
    require: ["startDate", "endDate", "branchId"],
    optional: ["specId"],
  },
  {
    key: "purchasesDaily",
    title: "ซื้อรายวัน (Excel)",
    endpoint: "/report/purchases/daily-excel",
    type: "excel",
    badge: "EXCEL",
    require: ["startDate", "endDate", "branchId"],
    optional: ["specId"],
  },
  {
    key: "registerPurchase",
    title: "ทะเบียนรับซื้อ (Excel)",
    endpoint: "/report/orders/register-excel", 
    type: "excel",
    badge: "EXCEL",
    require: ["startDate", "endDate"],
    optional: ["branchId", "klangId", "speciesLike", "addrLine4", "addrLine5"],
  },
  {
    key: "branchRx",
    title: "สรุปสาขา (RX) (Excel)",
    endpoint: "/report/branch-rx.xlsx", 
    type: "excel",
    badge: "EXCEL",
    require: ["startDate", "endDate", "branchId", "specId"],
    optional: [],
  },
  {
    key: "riceSummary",
    title: "สรุปซื้อขายรวม (Excel)",
    endpoint: "/report/rice-summary.xlsx", 
    type: "excel",
    badge: "EXCEL",
    require: ["startDate", "endDate"],
    optional: [],
  },
  {
    key: "stockTree",
    title: "โครงสร้างสต๊อก (JSON)",
    endpoint: "/report/stock/tree", 
    type: "json",
    badge: "JSON",
    require: ["branchId", "productId"],
    optional: ["klangId"],
  },
  {
    key: "buy-by-day",
    title: "รับซื้อรายวัน (PDF)",
    endpoint: "/docs/reports/buy-by-day.pdf", 
    type: "pdf",
    badge: "PDF",
    require: ["startDate", "endDate"],
    optional: ["branchId", "klangId", "specId"],
  },
  {
    key: "by-price",
    title: "สรุปตามราคาต่อกก. (PDF)",
    endpoint: "/docs/reports/by-price.pdf",
    type: "pdf",
    badge: "PDF",
    require: ["startDate", "endDate"],
    optional: ["branchId", "klangId", "specId"],
  },
  {
    key: "sell-by-day",
    title: "ขายรายวัน (PDF)",
    endpoint: "/docs/reports/sell-by-day.pdf",
    type: "pdf",
    badge: "PDF",
    require: ["startDate", "endDate"],
    optional: ["branchId", "klangId", "specId"],
  },
  {
    key: "rice-summary",
    title: "สรุปซื้อขายรวม (PDF)",
    endpoint: "/docs/reports/rice-summary.pdf",
    type: "pdf",
    badge: "PDF",
    require: ["startDate", "endDate"],
    optional: ["branchId", "klangId", "specId"],
  },
  {
    key: "collection-report",
    title: "รายงานรวบรวม (PDF)",
    endpoint: "/docs/reports/collection-report.pdf",
    type: "pdf",
    badge: "PDF",
    require: ["startDate", "endDate"],
    optional: ["branchId", "klangId", "specId"],
  },
  {
    key: "daily-report",
    title: "รายงานประจำวัน (PDF)",
    endpoint: "/docs/reports/daily-report.pdf",
    type: "pdf",
    badge: "PDF",
    require: ["startDate", "endDate"],
    optional: ["branchId", "klangId", "specId"],
  },
  {
    key: "control-report",
    title: "รายงานควบคุม (PDF)",
    endpoint: "/docs/reports/control-report.pdf",
    type: "pdf",
    badge: "PDF",
    require: ["startDate", "endDate"],
    optional: ["branchId", "klangId", "specId"],
  },
  {
    key: "branch-summary",
    title: "สรุปสาขา/คลัง (PDF)",
    endpoint: "/docs/reports/branch-summary.pdf",
    type: "pdf",
    badge: "PDF",
    require: ["startDate", "endDate"],
    optional: ["branchId", "klangId", "specId"],
  },
]

// -----------------------------
// PDF (Share) - “รายงานทะเบียนหุ้น”
// -----------------------------
const SHARE_REPORTS = [
  {
    key: "share-member-signup",
    reportCode: "member-signup",
    title: "รายงานทะเบียนหุ้น (PDF)",
    endpoint: "/share/reports/member-signup.pdf",
    type: "share_pdf",
    badge: "SHARE PDF",
    require: ["startDate", "endDate", "branchId"],
    optional: [],
  },
  {
    key: "share-member-history",
    reportCode: "member-history", 
    title: "รายงานทะเบียนทุนเรือนหุ้น (PDF)",
    endpoint: "/share/reports/member-history.pdf", 
    type: "share_pdf",
    badge: "SHARE PDF",
    require: ["startDate", "endDate"],
    optional: ["branchId", "memberId", "assoId"],
    requireAny: [["memberId", "assoId"]],
    sendTgsIdAlias: false,
    memberLabel: "member_id",
    memberPlaceholder: "เช่น M12345",
    memberHelp: "กรอก member_id (รหัสสมาชิก) หรือกรอก asso_id อย่างใดอย่างหนึ่ง",
    assoLabel: "asso_id (UUID)",
    assoPlaceholder: "เช่น 550e8400-e29b-41d4-a716-446655440000",
    assoHelp: "กรอก asso_id แทน member_id ได้",
  },
  {
    key: "share-buy-by-day",
    reportCode: "buy-by-day",
    title: "รับซื้อรายวัน (Share PDF)",
    endpoint: "/share/reports/buy-by-day.pdf",
    type: "share_pdf",
    badge: "SHARE PDF",
    require: ["startDate", "endDate"],
    optional: ["branchId", "klangId", "klangIds", "specId"],
  },
  {
    key: "share-by-price",
    reportCode: "by-price",
    title: "สรุปตามราคาต่อกก. (Share PDF)",
    endpoint: "/share/reports/by-price.pdf",
    type: "share_pdf",
    badge: "SHARE PDF",
    require: ["startDate", "endDate"],
    optional: ["branchId", "klangId", "klangIds", "specId"],
  },
  {
    key: "share-sell-by-day",
    reportCode: "sell-by-day",
    title: "ขายรายวัน (Share PDF)",
    endpoint: "/share/reports/sell-by-day.pdf",
    type: "share_pdf",
    badge: "SHARE PDF",
    require: ["startDate", "endDate"],
    optional: ["branchId", "klangId", "klangIds", "specId"],
  },
  {
    key: "share-rice-summary",
    reportCode: "rice-summary",
    title: "สรุปซื้อขายรวม (Share PDF)",
    endpoint: "/share/reports/rice-summary.pdf",
    type: "share_pdf",
    badge: "SHARE PDF",
    require: ["startDate", "endDate"],
    optional: ["branchId", "klangId", "klangIds", "specId"],
  },
  {
    key: "share-collection-report",
    reportCode: "collection-report",
    title: "รายงานรวบรวม (Share PDF)",
    endpoint: "/share/reports/collection-report.pdf",
    type: "share_pdf",
    badge: "SHARE PDF",
    require: ["startDate", "endDate"],
    optional: ["branchId", "klangId", "klangIds", "specId"],
  },
  {
    key: "share-daily-report",
    reportCode: "daily-report",
    title: "รายงานประจำวัน (Share PDF)",
    endpoint: "/share/reports/daily-report.pdf",
    type: "share_pdf",
    badge: "SHARE PDF",
    require: ["startDate", "endDate"],
    optional: ["branchId", "klangId", "klangIds", "specId"],
  },
  {
    key: "share-control-report",
    reportCode: "control-report",
    title: "รายงานควบคุม (Share PDF)",
    endpoint: "/share/reports/control-report.pdf",
    type: "share_pdf",
    badge: "SHARE PDF",
    require: ["startDate", "endDate"],
    optional: ["branchId", "klangId", "klangIds", "specId"],
  },
  {
    key: "share-branch-summary",
    reportCode: "branch-summary",
    title: "สรุปสาขา/คลัง (Share PDF)",
    endpoint: "/share/reports/branch-summary.pdf",
    type: "share_pdf",
    badge: "SHARE PDF",
    require: ["startDate", "endDate"],
    optional: ["branchId", "klangId", "klangIds", "specId"],
  },
  {
    key: "share-custom",
    title: "รายงานทะเบียนหุ้น (ระบุ report_code เอง) (PDF)",
    endpoint: (f) => `/share/reports/${encodeURIComponent(String(f.customReportCode || "").trim())}.pdf`,
    type: "share_pdf",
    badge: "SHARE PDF",
    require: ["startDate", "endDate", "customReportCode"],
    optional: ["branchId", "klangId", "klangIds", "specId"],
  },
]

// -----------------------------
// PDF (Plan) - “รายงานแผนดำเนินงานประจำปี” (01 - 18)
// แมพเข้ากับ Backend (report_router.py) ซึ่งบังคับใช้ `plan_id` และบางเส้นทางใช้ `branch_id`
// -----------------------------
const PLAN_REPORTS = [
  { key: "plan-01", title: "รูปแบบที่ 01 - Sale Goal (รวมกลุ่ม)", endpoint: "/repgen/report/sale-goal", type: "pdf", badge: "PLAN", require: ["planId", "branchId"] },
  { key: "plan-02", title: "รูปแบบที่ 02 - Branch Sale Goal", endpoint: "/repgen/report/branch-sale-goal", type: "pdf", badge: "PLAN", require: ["planId", "branchId"] },
  { key: "plan-03", title: "รูปแบบที่ 03 - Business Costs", endpoint: "/repgen/report/business-costs", type: "pdf", badge: "PLAN", require: ["planId", "branchId"] },
  { key: "plan-04", title: "รูปแบบที่ 04 - Business Earnings", endpoint: "/repgen/report/business-earnings", type: "pdf", badge: "PLAN", require: ["planId", "branchId"] },
  { key: "plan-05", title: "รูปแบบที่ 05 - Unit Aux Cost", endpoint: "/repgen/report/unit-aux-cost", type: "pdf", badge: "PLAN", require: ["planId", "branchId"] },
  { key: "plan-06", title: "รูปแบบที่ 06 - Unit Purchase Cost", endpoint: "/repgen/report/unit-purchase-cost", type: "pdf", badge: "PLAN", require: ["planId", "branchId"] },
  { key: "plan-07", title: "รูปแบบที่ 07 - Branch Financial Summary", endpoint: "/repgen/report/branch-financial-summary", type: "pdf", badge: "PLAN", require: ["planId", "branchId"] },
  { key: "plan-08", title: "รูปแบบที่ 08 - Org Sale Goal (รวม Product)", endpoint: "/repgen/report/org-salegoal", type: "pdf", badge: "PLAN", require: ["planId"] },
  { key: "plan-09", title: "รูปแบบที่ 09 - Org Purchase Cost", endpoint: "/repgen/report/org-purchase-cost", type: "pdf", badge: "PLAN", require: ["planId"] },
  { key: "plan-10", title: "รูปแบบที่ 10 - Org Sale Goal Product", endpoint: "/repgen/report/org-salegoal-product", type: "pdf", badge: "PLAN", require: ["planId"] },
  { key: "plan-11", title: "รูปแบบที่ 11 - Org Business Costs", endpoint: "/repgen/report/org-business-costs", type: "pdf", badge: "PLAN", require: ["planId"] },
  { key: "plan-12", title: "รูปแบบที่ 12 - Org Business Earnings", endpoint: "/repgen/report/org-business-earnings", type: "pdf", badge: "PLAN", require: ["planId"] },
  { key: "plan-13", title: "รูปแบบที่ 13 - Org Aux Costs", endpoint: "/repgen/report/org-aux-costs", type: "pdf", badge: "PLAN", require: ["planId"] },
  { key: "plan-14", title: "รูปแบบที่ 14 - Org Purchase Summary", endpoint: "/repgen/report/org-purchase-summary", type: "pdf", badge: "PLAN", require: ["planId"] },
  { key: "plan-15", title: "รูปแบบที่ 15 - Org Profit By Group", endpoint: "/repgen/report/org-profit-by-group", type: "pdf", badge: "PLAN", require: ["planId"] },
  { key: "plan-16", title: "รูปแบบที่ 16 - Org Financial Summary", endpoint: "/repgen/report/org-financial-summary", type: "pdf", badge: "PLAN", require: ["planId"] },
  { key: "plan-17", title: "รูปแบบที่ 17 - Monthly Costs", endpoint: "/repgen/report/monthly-costs", type: "pdf", badge: "PLAN", require: ["planId", "branchId"] },
  { key: "plan-18", title: "รูปแบบที่ 18 - Monthly Earnings & Aux", endpoint: "/repgen/report/monthly-earnings-aux", type: "pdf", badge: "PLAN", require: ["planId", "branchId"] },
]

const YEAR_OPTIONS = Array.from({ length: 15 }, (_, i) => {
  const y = String(2569 + i)
  const pid = String(1 + i) // 2569 - 2568 = 1
  return { id: pid, label: y }
})

function Documents() {
  const [mode, setMode] = useState(() => {
    const qs = safeQS()
    const m = (pickQS(qs, ["mode", "view", "tab"]) || "").toLowerCase()
    
    if (m === "plan") return "plan"
    if (m === "share" || m === "registry" || m === "shares" || m === "shop" || m === "store") return "share"
    
    return "internal"
  })

  const REPORTS = useMemo(() => {
    if (mode === "share") return SHARE_REPORTS
    if (mode === "plan") return PLAN_REPORTS
    return INTERNAL_REPORTS
  }, [mode])

  /** ---------- โหลดตัวเลือกพื้นฐาน ---------- */
  const [loadingOptions, setLoadingOptions] = useState(false)
  const [loadingSpecs, setLoadingSpecs] = useState(false)
  const [downloading, setDownloading] = useState(false)
  const [errors, setErrors] = useState({})
  const [activeReport, setActiveReport] = useState(null)

  const [productOptions, setProductOptions] = useState([])
  const [specOptions, setSpecOptions] = useState([]) 
  const [branchOptions, setBranchOptions] = useState([])
  const [klangOptions, setKlangOptions] = useState([])

  const [previewJson, setPreviewJson] = useState(null)

  const today = new Date().toISOString().slice(0, 10)
  const firstDayThisMonth = useMemo(() => {
    const d = new Date()
    d.setDate(1)
    return d.toISOString().slice(0, 10)
  }, [])

  /** ---------- State ฟิลเตอร์ ---------- */
  const [filters, setFilters] = useState({
    startDate: firstDayThisMonth,
    endDate: today,
    productId: "",
    specId: "",
    branchId: "",
    klangId: "",
    // share filters
    memberId: "",
    assoId: "",
    klangIds: "", 
    customReportCode: "", 
    // search fields
    speciesLike: "",
    addrLine4: "",
    addrLine5: "",
    // Plan filters
    planId: "",
  })
  const setFilter = (k, v) => setFilters((p) => ({ ...p, [k]: v }))

  /** ---------- Prefill จาก querystring (รองรับลิงก์แชร์) ---------- */
  useEffect(() => {
    const qs = safeQS()

    const patch = {}

    // dates
    const s = pickQS(qs, ["start_date", "startDate"])
    const e = pickQS(qs, ["end_date", "endDate"])
    if (s) patch.startDate = s
    if (e) patch.endDate = e

    // share identity
    const memberId = pickQS(qs, ["member_id", "memberId"]) 
    const tgsId = pickQS(qs, ["tgs_id", "tgsId"])        
    const assoId = pickQS(qs, ["asso_id", "assoId"])      

    if (memberId) patch.memberId = memberId
    else if (tgsId) patch.memberId = tgsId

    if (assoId) patch.assoId = assoId

    // optional filters
    const branchId = pickQS(qs, ["branch_id", "branchId"])
    const klangId = pickQS(qs, ["klang_id", "klangId"])
    const klangIds = pickQS(qs, ["klang_ids", "klangIds"]) 
    const planId = pickQS(qs, ["plan_id", "planId"])

    if (branchId) patch.branchId = branchId
    if (klangId) patch.klangId = klangId
    if (klangIds) patch.klangIds = klangIds
    if (planId) patch.planId = planId

    // open report by code
    const code = pickQS(qs, ["report", "report_code", "reportCode"])

    if (Object.keys(patch).length) {
      setFilters((p) => ({ ...p, ...patch }))
    }

    if (code) {
      const foundShare = SHARE_REPORTS.find((r) => r.reportCode === code || r.key === code)
      const foundInternal = INTERNAL_REPORTS.find((r) => r.key === code)
      const foundPlan = PLAN_REPORTS.find((r) => r.key === code)
      const custom = SHARE_REPORTS.find((r) => r.key === "share-custom")

      if (foundShare) {
        setMode("share")
        setActiveReport(foundShare.key)
      } else if (foundPlan) {
        setMode("plan")
        setActiveReport(foundPlan.key)
      } else if (foundInternal) {
        setMode("internal")
        setActiveReport(foundInternal.key)
      } else if (custom) {
        setMode("share")
        setActiveReport(custom.key)
        setFilters((p) => ({ ...p, customReportCode: code }))
      }
    }
  }, [])

  /** โหลดตัวเลือกพื้นฐาน (product, branch) */
  useEffect(() => {
    const loadOptions = async () => {
      try {
        setLoadingOptions(true)
        const [products, branches] = await Promise.all([
          apiAuth("/order/product/search").catch(() => []),
          apiAuth("/order/branch/search").catch(() => []),
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
      } catch (err) {
        console.error("loadOptions error:", err)
        setProductOptions([])
        setBranchOptions([])
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
        const rows = await apiAuth("/order/form/search").catch(() => [])
        const opts = (rows || [])
          .map((r) => ({
            id: String(r.id),
            label: String(r.prod_name || r.name || r.spec_name || `spec #${r.id}`).trim(),
          }))
          .filter((o) => o.id && o.label)

        setSpecOptions(opts)
      } catch (err) {
        console.error("loadSpecs error:", err)
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
    ;(async () => {
      try {
        const arr = (await apiAuth(`/order/klang/search?branch_id=${encodeURIComponent(bId)}`)) || []
        setKlangOptions(
          arr
            .map((x) => ({ id: String(x.id), label: x.klang_name }))
            .filter((o) => o.id && o.label)
        )
      } catch (err) {
        console.error("load klang error:", err)
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
      const v = filters[field]
      const ok = typeof v === "string" ? v.trim() !== "" : Boolean(v)
      if (!ok) e[field] = "จำเป็นต้องระบุ"
    }

    const niceField = (f) => {
      if (f === "memberId") return "member_id"
      if (f === "assoId") return "asso_id"
      if (f === "customReportCode") return "report_code"
      if (f === "planId") return "plan_id"
      return f
    }

    if (Array.isArray(report.requireAny)) {
      for (const group of report.requireAny) {
        if (!Array.isArray(group) || group.length === 0) continue
        const ok = group.some((f) => Boolean(String(filters[f] || "").trim()))
        if (!ok) {
          const msg = `กรุณาระบุอย่างน้อย 1 อย่าง: ${group.map(niceField).join(" หรือ ")}`
          for (const f of group) {
            if (!e[f]) e[f] = msg
          }
        }
      }
    }

    setErrors(e)
    return e
  }

  /** ---------- Map ฟิลด์ → QueryString ---------- */
  const buildParams = (report) => {
    const p = new URLSearchParams()

    const wants = (field) =>
      (report?.require || []).includes(field) || (report?.optional || []).includes(field)

    if (wants("startDate")) p.set("start_date", filters.startDate)
    if (wants("endDate")) p.set("end_date", filters.endDate)

    if (wants("planId") && filters.planId) p.set("plan_id", filters.planId)

    if (wants("memberId") && String(filters.memberId || "").trim()) {
      const v = String(filters.memberId).trim()
      const key = String(report?.memberQueryKey || "member_id")
      p.set(key, v)

      if (report?.sendTgsIdAlias === true) {
        p.set("tgs_id", v)
      }
    }

    if (wants("assoId") && String(filters.assoId || "").trim()) {
      p.set("asso_id", String(filters.assoId).trim())
    }

    if (wants("branchId") && filters.branchId) p.set("branch_id", filters.branchId)
    if (wants("klangId") && filters.klangId) p.set("klang_id", filters.klangId)

    if (wants("klangIds") && String(filters.klangIds || "").trim()) {
      for (const n of parseCsvInts(filters.klangIds)) {
        p.append("klang_ids", String(n))
      }
    }

    if (wants("specId") && filters.specId) {
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

    const isPdf = report.type === "pdf" || report.type === "share_pdf"
    const preOpenWin = isPdf ? window.open("", "_blank") : null

    if (preOpenWin && isPdf) {
      try {
        preOpenWin.document.title = report.title || "Report"
        preOpenWin.document.body.innerHTML = `
          <div style="font-family: sans-serif; padding: 16px;">
            <div style="font-size: 16px; font-weight: 600;">กำลังเตรียมรายงาน…</div>
            <div style="margin-top: 6px; color: #64748b;">ถ้าหน้านี้ไม่เปลี่ยนเป็น PDF ให้ตรวจสอบสิทธิ์/การเชื่อมต่อ</div>
          </div>
        `
      } catch (_) {}
    }

    try {
      setDownloading(true)
      const params = buildParams(report)
      const endpoint = typeof report.endpoint === "function" ? report.endpoint(filters) : report.endpoint

      if (report.type === "excel") {
        const { blob, filename } = await apiDownload(`${endpoint}?${params.toString()}`)
        const link = document.createElement("a")
        link.href = URL.createObjectURL(blob)
        link.download = filename || `${report.key}_${filters.startDate || ""}_${filters.endDate || ""}.xlsx`
        document.body.appendChild(link)
        link.click()
        link.remove()
        setTimeout(() => URL.revokeObjectURL(link.href), 3000)
        return
      }

      if (isPdf) {
        params.set("preview", "false")

        const { blob } = await apiDownload(`${endpoint}?${params.toString()}`)
        const url = URL.createObjectURL(blob)

        if (preOpenWin) {
          try {
            preOpenWin.location.href = url
            setTimeout(() => {
              try {
                preOpenWin.focus()
                preOpenWin.print()
              } catch (_) {}
            }, 1200)
          } catch (_) {}
        } else {
          const link = document.createElement("a")
          link.href = url
          link.target = "_blank"
          link.rel = "noreferrer"
          document.body.appendChild(link)
          link.click()
          link.remove()
        }

        setTimeout(() => URL.revokeObjectURL(url), 60_000)
        return
      }

      // json
      const json = await apiAuth(`${endpoint}?${params.toString()}`)
      setPreviewJson(json)
      const blob = new Blob([JSON.stringify(json, null, 2)], { type: "application/json" })
      const link = document.createElement("a")
      link.href = URL.createObjectURL(blob)
      link.download = `${report.key}.json`
      document.body.appendChild(link)
      link.click()
      link.remove()
      setTimeout(() => URL.revokeObjectURL(link.href), 3000)
    } catch (err) {
      console.error(err)
      try {
        preOpenWin?.close?.()
      } catch (_) {}
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
      memberId: "",
      assoId: "",
      klangIds: "",
      customReportCode: "",
      speciesLike: "",
      addrLine4: "",
      addrLine5: "",
      planId: "",
    })

  /** ---------- UI helpers ---------- */
  const FieldError = ({ name }) => (errors[name] ? <div className={errorTextCls}>{errors[name]}</div> : null)

  const withEmpty = (opts, emptyLabel = "— เลือก —") => [{ id: "", label: emptyLabel }, ...opts]

  const FormDates = ({ report }) => {
    if (!(report.require.includes("startDate") || report.require.includes("endDate"))) return null
    return (
      <>
        <div>
          <label className={labelCls}>วันที่เริ่มต้น</label>
          <DateInput value={filters.startDate} onChange={(e) => setFilter("startDate", e.target.value)} error={!!errors.startDate} />
          <FieldError name="startDate" />
        </div>
        <div>
          <label className={labelCls}>วันที่สิ้นสุด</label>
          <DateInput value={filters.endDate} onChange={(e) => setFilter("endDate", e.target.value)} error={!!errors.endDate} />
          <FieldError name="endDate" />
        </div>
      </>
    )
  }

  const FormPlanId = () => (
    <div>
      <label className={labelCls}>
        ปีแผนงาน (พ.ศ.) <span className="text-red-500">*</span>
      </label>
      <ComboBox
        options={withEmpty(YEAR_OPTIONS, "— เลือกปี —")}
        value={filters.planId}
        onChange={(v) => setFilter("planId", v)}
        placeholder="— เลือกปี —"
        error={!!errors.planId}
      />
      <FieldError name="planId" />
    </div>
  )

  const FormSpecOnly = ({ requiredSpec = false }) => (
    <div>
      <label className={labelCls}>
        รายการสำเร็จรูป (spec){requiredSpec && <span className="text-red-500"> *</span>}
      </label>

      {specOptions.length > 0 ? (
        <ComboBox
          options={withEmpty(specOptions, loadingSpecs ? "— กำลังโหลด… —" : "— เลือก —")}
          value={filters.specId}
          onChange={(v) => setFilter("specId", v)}
          placeholder={loadingSpecs ? "— กำลังโหลด… —" : "— เลือก —"}
          disabled={loadingSpecs || specOptions.length === 0}
          error={!!(requiredSpec && errors.specId)}
        />
      ) : (
        <input
          className={cx(baseField, requiredSpec && errors.specId && "border-red-400 ring-2 ring-red-300/70")}
          placeholder="ใส่ spec_id (ถ้าระบบไม่โหลดรายการให้)"
          value={filters.specId}
          onChange={(e) => setFilter("specId", e.target.value)}
        />
      )}

      {requiredSpec && <FieldError name="specId" />}
      <p className={helpTextCls}>
        ถ้าเข้าหน้านี้แบบไม่ login รายการตัวเลือกอาจโหลดไม่ได้ ให้พิมพ์ <code>spec_id</code> เองได้
      </p>
    </div>
  )

  const FormBranchKlang = ({ requireBranch = false, showKlang = true }) => (
    <>
      <div>
        <label className={labelCls}>
          สาขา{requireBranch && <span className="text-red-500"> *</span>}
        </label>

        {branchOptions.length > 0 ? (
          <ComboBox
            options={withEmpty(branchOptions, "— เลือก —")}
            value={filters.branchId}
            onChange={(v) => setFilter("branchId", v)}
            placeholder="— เลือก —"
            error={!!(requireBranch && errors.branchId)}
          />
        ) : (
          <input
            className={cx(baseField, requireBranch && errors.branchId && "border-red-400 ring-2 ring-red-300/70")}
            placeholder="ใส่ branch_id (ถ้าระบบไม่โหลดรายการให้)"
            value={filters.branchId}
            onChange={(e) => setFilter("branchId", e.target.value)}
          />
        )}

        {requireBranch && <FieldError name="branchId" />}
      </div>

      {showKlang ? (
        <div>
          <label className={labelCls}>คลัง (ไม่บังคับ)</label>

          {klangOptions.length > 0 ? (
            <ComboBox
              options={withEmpty(klangOptions, "— ทั้งหมด —")}
              value={filters.klangId}
              onChange={(v) => setFilter("klangId", v)}
              placeholder="— ทั้งหมด —"
              disabled={!filters.branchId || klangOptions.length === 0}
            />
          ) : (
            <input
              className={baseField}
              placeholder="ใส่ klang_id (ถ้าระบบไม่โหลดรายการให้)"
              value={filters.klangId}
              onChange={(e) => setFilter("klangId", e.target.value)}
            />
          )}
        </div>
      ) : null}
    </>
  )

  const FormShareIdentity = ({ report }) => {
    const req = report?.require || []
    const opt = report?.optional || []
    const any = report?.requireAny || []

    const inAny = (field) =>
      any.some((g) => Array.isArray(g) && g.includes(field))

    const showMember = req.includes("memberId") || opt.includes("memberId") || inAny("memberId")
    const showAsso = req.includes("assoId") || opt.includes("assoId") || inAny("assoId")

    if (!showMember && !showAsso) return null

    const needMember = req.includes("memberId") || inAny("memberId")
    const needAsso = req.includes("assoId") || inAny("assoId")

    const memberLabel = report?.memberLabel || "member_id"
    const memberPlaceholder = report?.memberPlaceholder || "เช่น M12345"
    const memberHelp =
      report?.memberHelp ||
      "ใส่เพื่อกรองรายงานเฉพาะสมาชิก (ถ้า report รองรับ) หรือปล่อยว่างเพื่อดึงทั้งหมด"

    const assoLabel = report?.assoLabel || "asso_id"
    const assoPlaceholder = report?.assoPlaceholder || "เช่น UUID / รหัสสมาคม (แล้วแต่ระบบ)"
    const assoHelp =
      report?.assoHelp || "ถ้าระบบใช้ asso_id เป็น UUID ให้กรอกเป็นข้อความได้เลย"

    return (
      <>
        {showMember ? (
          <div>
            <label className={labelCls}>
              {memberLabel} {needMember && <span className="text-red-500">*</span>}
            </label>
            <input
              className={cx(baseField, errors.memberId && "border-red-400 ring-2 ring-red-300/70")}
              placeholder={memberPlaceholder}
              value={filters.memberId}
              onChange={(e) => setFilter("memberId", e.target.value)}
            />
            <FieldError name="memberId" />
            <p className={helpTextCls}>{memberHelp}</p>
          </div>
        ) : null}

        {showAsso ? (
          <div>
            <label className={labelCls}>
              {assoLabel} {needAsso && <span className="text-red-500">*</span>}
            </label>
            <input
              className={cx(baseField, errors.assoId && "border-red-400 ring-2 ring-red-300/70")}
              placeholder={assoPlaceholder}
              value={filters.assoId}
              onChange={(e) => setFilter("assoId", e.target.value)}
            />
            <FieldError name="assoId" />
            <p className={helpTextCls}>{assoHelp}</p>
          </div>
        ) : null}
      </>
    )
  }

  const FormCustomReportCode = () => (
    <div>
      <label className={labelCls}>
        report_code <span className="text-red-500">*</span>
      </label>
      <input
        className={cx(baseField, errors.customReportCode && "border-red-400 ring-2 ring-red-300/70")}
        placeholder="เช่น member-signup"
        value={filters.customReportCode}
        onChange={(e) => setFilter("customReportCode", e.target.value)}
      />
      <FieldError name="customReportCode" />
      <p className={helpTextCls}>ระบบจะเรียก <code>/share/reports/&lt;report_code&gt;.pdf</code></p>
    </div>
  )

  const FormShareKlangIds = () => (
    <div className="md:col-span-3">
      <label className={labelCls}>คลังหลายรายการ (klang_ids) (ไม่บังคับ)</label>
      <input
        className={baseField}
        placeholder="เช่น 1,2,3 (เว้นวรรคได้)"
        value={filters.klangIds}
        onChange={(e) => setFilter("klangIds", e.target.value)}
      />

      {klangOptions.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-2">
          {klangOptions.map((k) => {
            const selected = parseCsvInts(filters.klangIds).includes(Number(k.id))
            return (
              <button
                key={k.id}
                type="button"
                onClick={() => setFilter("klangIds", toggleCsvId(filters.klangIds, k.id))}
                className={cx(
                  "rounded-full border px-3 py-1 text-sm transition",
                  selected
                    ? "border-emerald-500 bg-emerald-50 text-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-200 dark:border-emerald-700"
                    : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50 dark:bg-slate-700/50 dark:text-slate-100 dark:border-slate-600"
                )}
              >
                {k.label}
                {selected ? " ✓" : ""}
              </button>
            )
          })}
          <button
            type="button"
            onClick={() => setFilter("klangIds", "")}
            className="rounded-full border border-slate-200 bg-white px-3 py-1 text-sm text-slate-700 hover:bg-slate-50 dark:bg-slate-700/50 dark:text-slate-100 dark:border-slate-600"
            title="ล้าง klang_ids"
          >
            ล้าง
          </button>
        </div>
      )}

      <p className={helpTextCls}>
        ถ้ากรอก <code>klang_ids</code> แล้ว ระบบจะส่งเป็น <code>klang_ids=1&amp;klang_ids=2</code> ไปให้ BE
      </p>
    </div>
  )

  const renderReportForm = (report) => {
    if (!report) return null

    // จัดการฟอร์มสำหรับ Plan Reports
    if (report.badge === "PLAN") {
      const requireBranch = report.require.includes("branchId")
      return (
        <>
          <div className="grid gap-4 md:grid-cols-3">
            <FormPlanId />
            {requireBranch && <FormBranchKlang requireBranch={true} showKlang={false} />}
          </div>
          <p className={helpTextCls}>
            กดปุ่ม <span className="font-semibold">🖨️</span> เพื่อเปิด PDF แล้วพิมพ์ (ระบบดึงข้อมูลตาม Plan ID ที่ระบุ)
          </p>
        </>
      )
    }

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
            <input className={baseField} placeholder="เช่น มะลิ" value={filters.speciesLike} onChange={(e) => setFilter("speciesLike", e.target.value)} />
          </div>
          <div>
            <label className={labelCls}>ที่อยู่ บรรทัด 4 (`addr_line4`)</label>
            <input className={baseField} value={filters.addrLine4} onChange={(e) => setFilter("addrLine4", e.target.value)} />
          </div>
          <div>
            <label className={labelCls}>ที่อยู่ บรรทัด 5 (`addr_line5`)</label>
            <input className={baseField} value={filters.addrLine5} onChange={(e) => setFilter("addrLine5", e.target.value)} />
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
      return (
        <div className="grid gap-4 md:grid-cols-3">
          <FormDates report={report} />
        </div>
      )
    }

    if (report.key === "stockTree") {
      return (
        <>
          <div className="grid gap-4 md:grid-cols-3">
            <FormBranchKlang requireBranch />
            <div>
              <label className={labelCls}>ประเภทสินค้า (product_id) *</label>
              {productOptions.length > 0 ? (
                <ComboBox
                  options={withEmpty(productOptions, "— เลือก —")}
                  value={filters.productId}
                  onChange={(v) => setFilter("productId", v)}
                  placeholder="— เลือก —"
                  error={!!errors.productId}
                />
              ) : (
                <input
                  className={cx(baseField, errors.productId && "border-red-400 ring-2 ring-red-300/70")}
                  placeholder="ใส่ product_id"
                  value={filters.productId}
                  onChange={(e) => setFilter("productId", e.target.value)}
                />
              )}
              <FieldError name="productId" />
            </div>
          </div>

          {previewJson && (
            <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm dark:border-slate-700 dark:bg-slate-800">
              <div className="mb-2 font-semibold">ตัวอย่างผลลัพธ์ (JSON)</div>
              <pre className="max-h-80 overflow-auto whitespace-pre-wrap break-words">{JSON.stringify(previewJson, null, 2)}</pre>
            </div>
          )}
        </>
      )
    }

    if (report.type === "pdf") {
      return (
        <>
          <div className="grid gap-4 md:grid-cols-3">
            <FormDates report={report} />
            <FormBranchKlang requireBranch={false} />
            <FormSpecOnly requiredSpec={false} />
          </div>
          <p className={helpTextCls}>
            กดปุ่ม <span className="font-semibold">🖨️</span> เพื่อเปิด PDF แล้วพิมพ์ (ระบบจะเรียกเส้นทางตามที่กำหนดในชุดรายงาน)
          </p>
        </>
      )
    }

    if (report.type === "share_pdf") {
      const req = report.require || []
      const opt = report.optional || []

      const needBranchKlang = req.includes("branchId") || opt.includes("branchId") || opt.includes("klangId")
      const needSpec = req.includes("specId") || opt.includes("specId")
      const needKlangIds = req.includes("klangIds") || opt.includes("klangIds")

      return (
        <>
          <div className="grid gap-4 md:grid-cols-3">
            <FormDates report={report} />

            {report.key === "share-custom" ? <FormCustomReportCode /> : null}

            {needBranchKlang ? <FormBranchKlang requireBranch={req.includes("branchId")} showKlang={req.includes("klangId") || opt.includes("klangId")} /> : null}

            {needSpec ? <FormSpecOnly requiredSpec={req.includes("specId")} /> : null}

            {needKlangIds ? <FormShareKlangIds /> : null}

            <FormShareIdentity report={report} />
          </div>

          <p className={helpTextCls}>
            โหมดนี้จะเรียก BE <code>/share/reports/&lt;report_code&gt;.pdf</code> (รายงานทะเบียนหุ้น / Share)
          </p>
        </>
      )
    }

    return null
  }

  const reportObj = REPORTS.find((r) => r.key === activeReport)

  return (
    <div className="min-h-screen bg-white text-black dark:bg-slate-900 dark:text-white rounded-2xl text-[15px] md:text-base documents-page">
      <style>{`
        .documents-page button:not(:disabled):not(.cursor-not-allowed):not(.cursor-wait):hover { cursor: pointer; }
        .documents-page [role="button"]:hover, .documents-page [role="option"]:hover { cursor: pointer; }
        
        /* สไตล์ตารางเพื่อให้มองแต่ละเซลล์ง่ายขึ้น */
        .documents-page table { border-collapse: collapse; width: 100%; margin-top: 1rem; }
        .documents-page th, .documents-page td { border: 1px solid #cbd5e1; padding: 0.75rem; text-align: left; }
        .documents-page th { background-color: #f8fafc; font-weight: 600; }
        .dark .documents-page th, .dark .documents-page td { border-color: #475569; }
        .dark .documents-page th { background-color: #1e293b; }
      `}</style>

      <div className="mx-auto max-w-6xl p-5 md:p-6 lg:p-8">
        
        {/* Header - เอาปุ่มเลือก Mode ทั้ง 3 อันด้านบนออกไปแล้ว */}
        <div className="mb-8 flex items-center gap-3">
          <h1 className="text-3xl font-bold">📚 คลังเอกสาร & รายงาน</h1>
          {!loadingOptions && !loadingSpecs && (
            <span className="inline-flex items-center gap-2 rounded-full bg-emerald-50 px-3 py-1.5 text-emerald-700 ring-1 ring-emerald-200 dark:bg-emerald-900/20 dark:text-emerald-200 dark:ring-emerald-700/60">
              พร้อมใช้งาน
            </span>
          )}
        </div>

        {/* --- หน้าแรก: กล่องหมวดหมู่ 3 กล่อง พร้อม Dropdown ประจำกล่อง --- */}
        {!reportObj && (
          <div className="grid gap-6 md:grid-cols-3">
            
            {/* กล่อง 1: รายงานระบบ */}
            <div className="flex flex-col rounded-2xl border border-emerald-200 bg-emerald-50/40 p-6 shadow-sm dark:border-emerald-800/50 dark:bg-emerald-900/10 transition-all hover:shadow-md">
              <div className="mb-4 flex items-center gap-3">
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-emerald-600 dark:bg-emerald-900/50 dark:text-emerald-400">
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M3 3h18v2H3V3zm0 4h18v14H3V7zm2 2v10h14V9H5z" />
                  </svg>
                </div>
                <h2 className="text-xl font-bold text-emerald-800 dark:text-emerald-300">รายงานระบบ</h2>
              </div>
              <p className="mb-6 text-sm text-emerald-700/80 dark:text-emerald-400/80">
                เอกสารสรุปซื้อ-ขาย, สต๊อกสินค้า และการดำเนินการภายในสาขา (PDF/Excel)
              </p>
              <div className="mt-auto relative z-30">
                <ComboBox
                  options={INTERNAL_REPORTS.map((r) => ({ ...r, id: r.key, label: r.title }))}
                  placeholder="คลิกเพื่อเลือกรายงาน..."
                  value={null}
                  onChange={(v) => {
                    setMode("internal")
                    setActiveReport(v)
                    setPreviewJson(null)
                    setErrors({})
                  }}
                />
              </div>
            </div>

            {/* กล่อง 2: รายงานทะเบียนหุ้น */}
            <div className="flex flex-col rounded-2xl border border-violet-200 bg-violet-50/40 p-6 shadow-sm dark:border-violet-800/50 dark:bg-violet-900/10 transition-all hover:shadow-md">
              <div className="mb-4 flex items-center gap-3">
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-violet-100 text-violet-600 dark:bg-violet-900/50 dark:text-violet-400">
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M16 11c1.66 0 2.99-1.34 2.99-3S17.66 5 16 5s-3 1.34-3 3 1.34 3 3 3zm-8 0c1.66 0 2.99-1.34 2.99-3S9.66 5 8 5 5 6.34 5 8s1.34 3 3 3zm0 2c-2.33 0-7 1.17-7 3.5V19h14v-2.5c0-2.33-4.67-3.5-7-3.5zm8 0c-.29 0-.62.02-.97.05 1.16.84 1.97 1.97 1.97 3.45V19h6v-2.5c0-2.33-4.67-3.5-7-3.5z"/>
                  </svg>
                </div>
                <h2 className="text-xl font-bold text-violet-800 dark:text-violet-300">รายงานทะเบียนหุ้น</h2>
              </div>
              <p className="mb-6 text-sm text-violet-700/80 dark:text-violet-400/80">
                เอกสารข้อมูลสมาชิกสมาคม, ทุนเรือนหุ้น และประวัติการทำรายการ (Share PDF)
              </p>
              <div className="mt-auto relative z-20">
                <ComboBox
                  options={SHARE_REPORTS.map((r) => ({ ...r, id: r.key, label: r.title }))}
                  placeholder="คลิกเพื่อเลือกรายงาน..."
                  value={null}
                  onChange={(v) => {
                    setMode("share")
                    setActiveReport(v)
                    setPreviewJson(null)
                    setErrors({})
                  }}
                />
              </div>
            </div>

            {/* กล่อง 3: รายงานแผนดำเนินงานประจำปี */}
            <div className="flex flex-col rounded-2xl border border-blue-200 bg-blue-50/40 p-6 shadow-sm dark:border-blue-800/50 dark:bg-blue-900/10 transition-all hover:shadow-md">
              <div className="mb-4 flex items-center gap-3">
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-blue-100 text-blue-600 dark:bg-blue-900/50 dark:text-blue-400">
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M19 3h-1V1h-2v2H8V1H6v2H5c-1.11 0-2 .9-2 2v14c0 1.1.89 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm0 16H5V8h14v11z"/>
                  </svg>
                </div>
                <h2 className="text-xl font-bold text-blue-800 dark:text-blue-300">รายงานแผนดำเนินงาน</h2>
              </div>
              <p className="mb-6 text-sm text-blue-700/80 dark:text-blue-400/80">
                เอกสารแผนดำเนินงานประจำปี เลือกรูปแบบรายงานที่ต้องการ (รูปแบบที่ 01 ถึง 18)
              </p>
              <div className="mt-auto relative z-10">
                <ComboBox
                  options={PLAN_REPORTS.map((r) => ({ ...r, id: r.key, label: r.title }))}
                  placeholder="คลิกเพื่อเลือกรูปแบบ..."
                  value={null}
                  onChange={(v) => {
                    setMode("plan")
                    setActiveReport(v)
                    setPreviewJson(null)
                    setErrors({})
                  }}
                />
              </div>
            </div>

          </div>
        )}

        {/* --- Form Section for selected report --- */}
        {reportObj && (
          <form
            onSubmit={(e) => {
              e.preventDefault()
              doDownload(reportObj)
            }}
            className="rounded-2xl border border-slate-200 bg-white p-5 text-black shadow-sm dark:border-slate-700 dark:bg-slate-800 dark:text-white mt-2"
          >
            <div className="mb-5 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <div>
                <div className="text-xl font-semibold">{reportObj.title}</div>
              </div>

              <button
                type="button"
                onClick={() => {
                  setActiveReport(null)
                  setPreviewJson(null)
                  setErrors({})
                }}
                className="inline-flex items-center justify-center rounded-2xl border border-slate-300 bg-white px-4 md:px-5 py-3 text-base font-semibold text-slate-700 shadow-sm transition-all hover:bg-slate-100 hover:shadow-md hover:scale-[1.02] active:scale-[.98] dark:border-slate-600 dark:bg-slate-700/60 dark:text-white dark:hover:bg-slate-700/50 cursor-pointer"
                title="กลับไปหน้าเลือกรายงาน"
              >
                ← กลับไปเลือกรายงาน
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
                {reportObj.type === "excel" ? (
                  downloading ? "กำลังเตรียมไฟล์..." : "⬇️ ดาวน์โหลด Excel"
                ) : reportObj.type === "pdf" || reportObj.type === "share_pdf" ? (
                  downloading ? (
                    "กำลังเตรียม PDF..."
                  ) : (
                    <span className="inline-flex items-center gap-2">
                      <PrinterIcon className="-ml-0.5" />
                      พิมพ์ PDF
                    </span>
                  )
                ) : (
                  downloading ? "กำลังดึงข้อมูล..." : "👁️‍🗨️ พรีวิว + ดาวน์โหลด JSON"
                )}
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

      </div>
    </div>
  )
}

export default Documents