// src/pages/Documents.jsx
import { useEffect, useMemo, useRef, useState, forwardRef, useImperativeHandle } from "react"
import { apiAuth, apiDownload } from "../../lib/api"   // helper แนบ token + BASE URL
import { cx, baseField, labelCls, helpTextCls, errorTextCls, secondaryBtnCls } from "../../lib/styles"
import ExcelDownloadButton from "../../components/ExcelDownloadButton"
import { can } from "../../lib/permissions"
import ComboBox from "../../components/ComboBox"
import BranchLockNote from "../../components/BranchLockNote"
import useBranchLock, { scopedBranchId } from "../../hooks/useBranchLock"
import { toast } from "../../components/ui"

/** ---------- Utils ---------- */

const safeQS = () => {
  try {
    if (typeof window === "undefined") return new URLSearchParams()
    return new URLSearchParams(window.location.search)
  } catch {
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

/**
 * แปลง error จาก apiDownload/apiAuth → ข้อความที่บอกสาเหตุจริง
 * ช่วยแยกว่าติดที่ backend (404 ยังไม่เปิด route), สิทธิ์ (403), เซสชัน (401)
 * หรือพารามิเตอร์ (422) แทน alert generic
 */
const reportErrorMessage = (err) => {
  const status = Number(err?.status) || 0

  // ข้อความจาก backend ที่เป็นภาษาไทยอยู่แล้ว แสดงต่อได้ (ภาษาอังกฤษ/โค้ดดิบ ไม่แสดง)
  const raw = String(err?.message || "")
  const thaiDetail = /[฀-๿]/.test(raw) ? raw.slice(0, 200) : ""

  if (status === 404)
    return "รายงานนี้ยังไม่พร้อมใช้งาน"
  if (status === 403)
    return "บัญชีนี้ไม่มีสิทธิ์เปิดรายงานนี้ ติดต่อผู้ดูแลระบบถ้าต้องใช้"
  if (status === 401)
    return "หมดเวลาใช้งาน เข้าสู่ระบบใหม่แล้วลองอีกครั้ง"

  if (status === 422)
    return thaiDetail || "ข้อมูลที่เลือกไม่ถูกต้อง ตรวจแล้วลองใหม่"

  return thaiDetail || "ดึงรายงานไม่สำเร็จ ลองใหม่อีกครั้ง"
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


/** ---------- MemberSearchBox (ค้นหาสมาชิก/ลูกค้า → asso_id) ---------- */
const personLabel = (r) => {
  const name = [r?.first_name, r?.last_name].filter(Boolean).join(" ").trim()
  const company = String(r?.company_name || r?.companyName || "").trim()
  if (name) return name
  if (company) return company
  if (r?.member_id) return `สมาชิก ${r.member_id}`
  return "ไม่ทราบชื่อ"
}

/**
 * ช่องค้นหาสมาชิกแบบ autocomplete — reuse endpoint /order/customers/search (เหมือนหน้าซื้อ)
 * เลือกแล้วส่ง asso_id กลับผ่าน onPick. เป็น component ระดับบนสุด (identity คงที่)
 * เพื่อไม่ให้ remount ทุกครั้งที่ parent re-render (กัน input เสีย focus)
 */
function MemberSearchBox({ valueLabel = "", error = false, onPick, onClear }) {
  const [q, setQ] = useState("")
  const [results, setResults] = useState([])
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [highlight, setHighlight] = useState(-1)
  const boxRef = useRef(null)
  const epochRef = useRef(0)

  const selectable = (r) =>
    r && r.asso_id !== null && r.asso_id !== undefined && String(r.asso_id).trim() !== ""

  // debounce + ค้นหา
  useEffect(() => {
    const term = q.trim()
    if (term.length < 2) {
      setResults([])
      setLoading(false)
      return
    }
    const my = ++epochRef.current
    setLoading(true)
    const t = setTimeout(async () => {
      try {
        const items = (await apiAuth(`/order/customers/search?q=${encodeURIComponent(term)}`)) || []
        if (my !== epochRef.current) return
        const arr = Array.isArray(items) ? items : []
        setResults(arr)
        setOpen(true)
        setHighlight(arr.length ? 0 : -1)
      } catch {
        if (my !== epochRef.current) return
        setResults([])
        setOpen(true)
      } finally {
        if (my === epochRef.current) setLoading(false)
      }
    }, 300)
    return () => clearTimeout(t)
  }, [q])

  // ปิดเมื่อคลิกนอกกล่อง
  useEffect(() => {
    const onClick = (e) => {
      if (boxRef.current && !boxRef.current.contains(e.target)) {
        setOpen(false)
        setHighlight(-1)
      }
    }
    document.addEventListener("click", onClick)
    return () => document.removeEventListener("click", onClick)
  }, [])

  const pick = (r) => {
    if (!selectable(r)) return
    onPick?.(r)
    setQ("")
    setResults([])
    setOpen(false)
    setHighlight(-1)
  }

  const onKeyDown = (e) => {
    if (!open && e.key === "ArrowDown") {
      if (results.length) setOpen(true)
      return
    }
    if (!open) return
    if (e.key === "ArrowDown") {
      e.preventDefault()
      setHighlight((h) => (h < results.length - 1 ? h + 1 : 0))
    } else if (e.key === "ArrowUp") {
      e.preventDefault()
      setHighlight((h) => (h > 0 ? h - 1 : results.length - 1))
    } else if (e.key === "Enter") {
      e.preventDefault()
      if (highlight >= 0 && highlight < results.length) pick(results[highlight])
    } else if (e.key === "Escape") {
      e.preventDefault()
      setOpen(false)
      setHighlight(-1)
    }
  }

  // สถานะ "เลือกแล้ว" — แสดงชิปพร้อมปุ่มเปลี่ยน
  if (valueLabel) {
    return (
      <div
        className={cx(
          "flex items-center justify-between gap-3 rounded-2xl border px-4 py-3 transition",
          "border-emerald-300 bg-emerald-50 dark:border-emerald-700 dark:bg-emerald-900/20"
        )}
      >
        <div className="flex min-w-0 items-center gap-2">
          <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor" className="shrink-0 text-emerald-600 dark:text-emerald-300" aria-hidden="true">
            <path d="M12 12a5 5 0 1 0 0-10 5 5 0 0 0 0 10zm0 2c-4.42 0-8 2.24-8 5v1h16v-1c0-2.76-3.58-5-8-5z" />
          </svg>
          <span className="truncate font-medium text-emerald-800 dark:text-emerald-100">{valueLabel}</span>
        </div>
        <button
          type="button"
          onClick={() => onClear?.()}
          className="shrink-0 rounded-xl border border-emerald-300 bg-white px-3 py-1.5 text-sm font-medium text-emerald-700 transition hover:bg-emerald-100 dark:border-emerald-700 dark:bg-slate-800 dark:text-emerald-200 dark:hover:bg-slate-700 cursor-pointer"
        >
          เปลี่ยน
        </button>
      </div>
    )
  }

  return (
    <div className="relative" ref={boxRef}>
      <input
        className={cx(baseField, error && "border-red-400 ring-2 ring-red-300/70")}
        placeholder="พิมพ์ชื่อ / รหัสสมาชิก / เลขบัตร แล้วเลือกจากรายการ"
        value={q}
        onChange={(e) => setQ(e.target.value)}
        onFocus={() => { if (results.length) setOpen(true) }}
        onKeyDown={onKeyDown}
        autoComplete="off"
        aria-invalid={error ? true : undefined}
      />
      {open && (
        <div
          role="listbox"
          className="absolute z-30 mt-1 max-h-72 w-full overflow-auto rounded-2xl border border-slate-200 bg-white text-black shadow-lg dark:border-slate-700 dark:bg-slate-800 dark:text-white"
        >
          {loading && (
            <div className="px-3 py-2.5 text-sm text-slate-500 dark:text-slate-300">กำลังค้นหา…</div>
          )}
          {!loading && results.length === 0 && (
            <div className="px-3 py-2.5 text-sm text-slate-500 dark:text-slate-300">ไม่พบสมาชิกที่ตรงกับคำค้น</div>
          )}
          {!loading &&
            results.map((r, idx) => {
              const ok = selectable(r)
              const isActive = idx === highlight
              const label = personLabel(r)
              const sub = [
                r?.type === "member" ? `สมาชิก${r?.member_id ? ` ${r.member_id}` : ""}` : "ลูกค้า",
                r?.citizen_id ? `บัตร ${r.citizen_id}` : "",
              ]
                .filter(Boolean)
                .join(" · ")
              return (
                <button
                  key={`${r?.asso_id ?? "na"}-${idx}`}
                  type="button"
                  role="option"
                  aria-selected={isActive}
                  disabled={!ok}
                  onMouseEnter={() => setHighlight(idx)}
                  onClick={() => pick(r)}
                  className={cx(
                    "flex w-full flex-col items-start gap-0.5 rounded-xl px-3 py-2.5 text-left transition",
                    !ok && "cursor-not-allowed opacity-50",
                    ok && isActive && "bg-emerald-100 dark:bg-emerald-400/20",
                    ok && !isActive && "hover:bg-emerald-50 dark:hover:bg-emerald-900/30",
                    ok && "cursor-pointer"
                  )}
                >
                  <span className="text-[15px] font-medium">{label}</span>
                  <span className="text-xs text-slate-500 dark:text-slate-400">
                    {sub}
                    {!ok ? " · เลือกไม่ได้ ข้อมูลรายนี้ไม่ครบ" : ""}
                  </span>
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
    // รายงานนี้ออกเป็น JSON เท่านั้น ซ่อนจากหน้ารายงาน (ดู VISIBLE_INTERNAL_REPORTS) · ดูสต็อกที่หน้า "คลังสินค้า"
    key: "stockTree",
    title: "โครงสร้างสต๊อก",
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
/** รายงานที่แสดงให้ผู้ใช้เลือก (ไม่รวมรายงานที่ออกเป็น JSON อย่างเดียว) */
const VISIBLE_INTERNAL_REPORTS = INTERNAL_REPORTS.filter((r) => r.type !== "json")

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
    memberLabel: "เลขสมาชิก",
    memberPlaceholder: "เช่น 11263",
    memberHelp: "กรอกเลขสมาชิก หรือรหัสลูกค้าทั่วไป อย่างใดอย่างหนึ่ง",
    assoLabel: "รหัสลูกค้าทั่วไป",
    assoPlaceholder: "รหัสลูกค้าทั่วไป",
    assoHelp: "ใช้แทนเลขสมาชิกได้",
  },
  {
    key: "share-buy-by-day",
    reportCode: "buy-by-day",
    title: "รับซื้อรายวัน (PDF)",
    endpoint: "/share/reports/buy-by-day.pdf",
    type: "share_pdf",
    badge: "SHARE PDF",
    require: ["startDate", "endDate"],
    optional: ["branchId", "klangId", "klangIds", "specId"],
  },
  {
    key: "share-by-price",
    reportCode: "by-price",
    title: "สรุปตามราคาต่อกก. (PDF)",
    endpoint: "/share/reports/by-price.pdf",
    type: "share_pdf",
    badge: "SHARE PDF",
    require: ["startDate", "endDate"],
    optional: ["branchId", "klangId", "klangIds", "specId"],
  },
  {
    key: "share-sell-by-day",
    reportCode: "sell-by-day",
    title: "ขายรายวัน (PDF)",
    endpoint: "/share/reports/sell-by-day.pdf",
    type: "share_pdf",
    badge: "SHARE PDF",
    require: ["startDate", "endDate"],
    optional: ["branchId", "klangId", "klangIds", "specId"],
  },
  {
    key: "share-rice-summary",
    reportCode: "rice-summary",
    title: "สรุปซื้อขายรวม (PDF)",
    endpoint: "/share/reports/rice-summary.pdf",
    type: "share_pdf",
    badge: "SHARE PDF",
    require: ["startDate", "endDate"],
    optional: ["branchId", "klangId", "klangIds", "specId"],
  },
  {
    key: "share-collection-report",
    reportCode: "collection-report",
    title: "รายงานรวบรวม (PDF)",
    endpoint: "/share/reports/collection-report.pdf",
    type: "share_pdf",
    badge: "SHARE PDF",
    require: ["startDate", "endDate"],
    optional: ["branchId", "klangId", "klangIds", "specId"],
  },
  {
    key: "share-daily-report",
    reportCode: "daily-report",
    title: "รายงานประจำวัน (PDF)",
    endpoint: "/share/reports/daily-report.pdf",
    type: "share_pdf",
    badge: "SHARE PDF",
    require: ["startDate", "endDate"],
    optional: ["branchId", "klangId", "klangIds", "specId"],
  },
  {
    key: "share-control-report",
    reportCode: "control-report",
    title: "รายงานควบคุม (PDF)",
    endpoint: "/share/reports/control-report.pdf",
    type: "share_pdf",
    badge: "SHARE PDF",
    require: ["startDate", "endDate"],
    optional: ["branchId", "klangId", "klangIds", "specId"],
  },
  {
    key: "share-branch-summary",
    reportCode: "branch-summary",
    title: "สรุปสาขา/คลัง (PDF)",
    endpoint: "/share/reports/branch-summary.pdf",
    type: "share_pdf",
    badge: "SHARE PDF",
    require: ["startDate", "endDate"],
    optional: ["branchId", "klangId", "klangIds", "specId"],
  },
  {
    key: "share-custom",
    title: "รายงานทะเบียนหุ้น ระบุรหัสรายงานเอง (PDF)",
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
  { key: "plan-01", title: "รูปแบบที่ 01 - เป้าหมายการขาย (รวมกลุ่ม)", endpoint: "/repgen/report/sale-goal", type: "pdf", xlsx: true, badge: "PLAN", require: ["planId", "branchId"] },
  { key: "plan-02", title: "รูปแบบที่ 02 - เป้าหมายการขายรายสาขา", endpoint: "/repgen/report/branch-sale-goal", type: "pdf", xlsx: true, badge: "PLAN", require: ["planId", "branchId"] },
  { key: "plan-03", title: "รูปแบบที่ 03 - ค่าใช้จ่ายธุรกิจ", endpoint: "/repgen/report/business-costs", type: "pdf", xlsx: true, badge: "PLAN", require: ["planId", "branchId"] },
  { key: "plan-04", title: "รูปแบบที่ 04 - รายได้ธุรกิจ", endpoint: "/repgen/report/business-earnings", type: "pdf", xlsx: true, badge: "PLAN", require: ["planId", "branchId"] },
  { key: "plan-05", title: "รูปแบบที่ 05 - ค่าใช้จ่ายเสริมต่อหน่วย", endpoint: "/repgen/report/unit-aux-cost", type: "pdf", xlsx: true, badge: "PLAN", require: ["planId", "branchId"] },
  { key: "plan-06", title: "รูปแบบที่ 06 - ต้นทุนซื้อต่อหน่วย", endpoint: "/repgen/report/unit-purchase-cost", type: "pdf", xlsx: true, badge: "PLAN", require: ["planId", "branchId"] },
  { key: "plan-07", title: "รูปแบบที่ 07 - สรุปการเงินรายสาขา", endpoint: "/repgen/report/branch-financial-summary", type: "pdf", xlsx: true, badge: "PLAN", require: ["planId", "branchId"] },
  { key: "plan-08", title: "รูปแบบที่ 08 - เป้าหมายการขายทั้งองค์กร (รวมสินค้า)", endpoint: "/repgen/report/org-salegoal", type: "pdf", xlsx: true, badge: "PLAN", require: ["planId"] },
  { key: "plan-09", title: "รูปแบบที่ 09 - ต้นทุนซื้อทั้งองค์กร", endpoint: "/repgen/report/org-purchase-cost", type: "pdf", xlsx: true, badge: "PLAN", require: ["planId"] },
  { key: "plan-10", title: "รูปแบบที่ 10 - เป้าหมายการขายทั้งองค์กร แยกสินค้า", endpoint: "/repgen/report/org-salegoal-product", type: "pdf", xlsx: true, badge: "PLAN", require: ["planId"] },
  { key: "plan-11", title: "รูปแบบที่ 11 - ค่าใช้จ่ายธุรกิจทั้งองค์กร", endpoint: "/repgen/report/org-business-costs", type: "pdf", xlsx: true, badge: "PLAN", require: ["planId"] },
  { key: "plan-12", title: "รูปแบบที่ 12 - รายได้ธุรกิจทั้งองค์กร", endpoint: "/repgen/report/org-business-earnings", type: "pdf", xlsx: true, badge: "PLAN", require: ["planId"] },
  { key: "plan-13", title: "รูปแบบที่ 13 - ค่าใช้จ่ายเสริมทั้งองค์กร", endpoint: "/repgen/report/org-aux-costs", type: "pdf", xlsx: true, badge: "PLAN", require: ["planId"] },
  { key: "plan-14", title: "รูปแบบที่ 14 - สรุปการซื้อทั้งองค์กร", endpoint: "/repgen/report/org-purchase-summary", type: "pdf", xlsx: true, badge: "PLAN", require: ["planId"] },
  { key: "plan-15", title: "รูปแบบที่ 15 - กำไรทั้งองค์กร แยกกลุ่ม", endpoint: "/repgen/report/org-profit-by-group", type: "pdf", xlsx: true, badge: "PLAN", require: ["planId"] },
  { key: "plan-16", title: "รูปแบบที่ 16 - สรุปการเงินทั้งองค์กร", endpoint: "/repgen/report/org-financial-summary", type: "pdf", xlsx: true, badge: "PLAN", require: ["planId"] },
  { key: "plan-17", title: "รูปแบบที่ 17 - ค่าใช้จ่ายรายเดือน", endpoint: "/repgen/report/monthly-costs", type: "pdf", xlsx: true, badge: "PLAN", require: ["planId", "branchId"] },
  { key: "plan-18", title: "รูปแบบที่ 18 - รายได้และค่าใช้จ่ายเสริมรายเดือน", endpoint: "/repgen/report/monthly-earnings-aux", type: "pdf", xlsx: true, badge: "PLAN", require: ["planId", "branchId"] },
]

// -----------------------------
// Phase 1 Reports — สหกรณ์ (P01–P19)
// Endpoints: GET /reports/phase1/P{nn}/pdf
// -----------------------------
const PHASE1_REPORTS = [
  {
    key: "phase1-p01",
    title: "P01 — ขออนุมัติและจ่ายค่าหุ้นลาออก",
    endpoint: "/reports/phase1/P01/pdf",
    type: "phase1_pdf",
    xlsx: true, // Excel twin: /reports/phase1/Pnn/xlsx
    badge: "PHASE1",
    require: ["branchId", "startDate", "endDate"],
    optional: [],
  },
  {
    key: "phase1-p02",
    title: "P02 — ขายแยกตามวัน",
    endpoint: "/reports/phase1/P02/pdf",
    type: "phase1_pdf",
    xlsx: true, // Excel twin: /reports/phase1/Pnn/xlsx
    badge: "PHASE1",
    require: ["branchId", "startDate", "endDate"],
    optional: [],
  },
  {
    key: "phase1-p03",
    title: "P03 — จ่ายคืนค่าหุ้นสมาชิกลาออก",
    endpoint: "/reports/phase1/P03/pdf",
    type: "phase1_pdf",
    xlsx: true, // Excel twin: /reports/phase1/Pnn/xlsx
    badge: "PHASE1",
    require: ["branchId", "startDate", "endDate"],
    optional: [],
  },
  {
    key: "phase1-p04",
    title: "P04 — ซื้อขายแยกราคา",
    endpoint: "/reports/phase1/P04/pdf",
    type: "phase1_pdf",
    xlsx: true, // Excel twin: /reports/phase1/Pnn/xlsx
    badge: "PHASE1",
    require: ["branchId", "startDate", "endDate"],
    optional: [],
  },
  {
    key: "phase1-p05",
    title: "P05 — ซื้อข้าวเปลือกรายคน",
    endpoint: "/reports/phase1/P05/pdf",
    type: "phase1_pdf",
    xlsx: true, // Excel twin: /reports/phase1/Pnn/xlsx
    badge: "PHASE1",
    // BE: asso_id (บังคับ) + start_date + end_date + branch_id (ไม่บังคับ)
    // รายงานรายคน — ต้องเลือกสมาชิกก่อน (ค้นหาชื่อ → asso_id)
    require: ["assoId", "startDate", "endDate"],
    optional: ["branchId"],
    memberSearch: true,
  },
  {
    key: "phase1-p06",
    title: "P06 — ซื้อแยกตามวัน",
    endpoint: "/reports/phase1/P06/pdf",
    type: "phase1_pdf",
    xlsx: true, // Excel twin: /reports/phase1/Pnn/xlsx
    badge: "PHASE1",
    require: ["branchId", "startDate", "endDate"],
    optional: [],
  },
  {
    key: "phase1-p07",
    title: "P07 — ทะเบียนคุม",
    endpoint: "/reports/phase1/P07/pdf",
    type: "phase1_pdf",
    xlsx: true, // Excel twin: /reports/phase1/Pnn/xlsx
    badge: "PHASE1",
    // handoff (4): params branch_id, start_date, end_date (no spec_id)
    require: ["branchId", "startDate", "endDate"],
    optional: [],
  },
  {
    key: "phase1-p08",
    title: "P08 — รายงานการรวบรวม",
    endpoint: "/reports/phase1/P08/pdf",
    type: "phase1_pdf",
    xlsx: true, // Excel twin: /reports/phase1/Pnn/xlsx
    badge: "PHASE1",
    require: ["branchId", "startDate", "endDate"],
    optional: [],
  },
  {
    key: "phase1-p09",
    title: "P09 — เคลื่อนไหวทุนเรือนหุ้นรายกลุ่ม",
    endpoint: "/reports/phase1/P09/pdf",
    type: "phase1_pdf",
    xlsx: true, // Excel twin: /reports/phase1/Pnn/xlsx
    badge: "PHASE1",
    require: ["branchId", "startDate", "endDate"],
    optional: [],
  },
  {
    key: "phase1-p10",
    title: "P10 — ทะเบียนทุนเรือนหุ้น (รายคน)",
    endpoint: "/reports/phase1/P10/pdf",
    type: "phase1_pdf",
    xlsx: true, // Excel twin: /reports/phase1/Pnn/xlsx
    badge: "PHASE1",
    require: ["memberId"],
    optional: ["branchId"],
    memberLabel: "เลขสมาชิก",
    memberPlaceholder: "เช่น 12345",
    memberHelp: "รายงานนี้ออกทีละคน ระบุเลขสมาชิก",
  },
  {
    key: "phase1-p11",
    title: "P11 — ทุนเรือนหุ้นคงเหลือรายคน",
    endpoint: "/reports/phase1/P11/pdf",
    type: "phase1_pdf",
    xlsx: true, // Excel twin: /reports/phase1/Pnn/xlsx
    badge: "PHASE1",
    require: ["branchId"],
    optional: [],
  },
  {
    key: "phase1-p12",
    title: "P12 — รายงานรวมสาขา",
    endpoint: "/reports/phase1/P12/pdf",
    type: "phase1_pdf",
    xlsx: true, // Excel twin: /reports/phase1/Pnn/xlsx
    badge: "PHASE1",
    require: ["branchId", "startDate", "endDate"],
    optional: [],
  },
  {
    key: "phase1-p13",
    title: "P13 — รายงานรายวัน",
    endpoint: "/reports/phase1/P13/pdf",
    type: "phase1_pdf",
    xlsx: true, // Excel twin: /reports/phase1/Pnn/xlsx
    badge: "PHASE1",
    // handoff (4): params branch_id, start_date, end_date (no spec_id)
    require: ["branchId", "startDate", "endDate"],
    optional: [],
  },
  {
    key: "phase1-p14",
    title: "P14 — รายงานสมาชิก",
    endpoint: "/reports/phase1/P14/pdf",
    type: "phase1_pdf",
    xlsx: true, // Excel twin: /reports/phase1/Pnn/xlsx
    badge: "PHASE1",
    require: ["branchId", "startDate", "endDate"],
    optional: ["klangIds"],
  },
  {
    key: "phase1-p15",
    title: "P15 — สมาชิกขอลาออกรายคน",
    endpoint: "/reports/phase1/P15/pdf",
    type: "phase1_pdf",
    xlsx: true, // Excel twin: /reports/phase1/Pnn/xlsx
    badge: "PHASE1",
    require: ["branchId", "startDate", "endDate"],
    optional: [],
  },
  {
    key: "phase1-p16",
    title: "P16 — รายงานสมาชิกใหม่",
    endpoint: "/reports/phase1/P16/pdf",
    type: "phase1_pdf",
    xlsx: true, // Excel twin: /reports/phase1/Pnn/xlsx
    badge: "PHASE1",
    require: ["branchId", "startDate", "endDate"],
    optional: [],
  },
  {
    key: "phase1-p17",
    title: "P17 — สรุปการเคลื่อนไหวทุนเรือนหุ้นรายกลุ่ม",
    endpoint: "/reports/phase1/P17/pdf",
    type: "phase1_pdf",
    xlsx: true, // Excel twin: /reports/phase1/Pnn/xlsx
    badge: "PHASE1",
    require: ["branchId", "startDate", "endDate"],
    optional: [],
  },
  {
    key: "phase1-p18",
    title: "P18 — สรุปจำนวนสมาชิกและการถือหุ้น",
    endpoint: "/reports/phase1/P18/pdf",
    type: "phase1_pdf",
    xlsx: true, // Excel twin: /reports/phase1/Pnn/xlsx
    badge: "PHASE1",
    require: ["branchId"],
    optional: [],
  },
  {
    key: "phase1-p19",
    title: "P19 — รายงานสาขา1 (สรุปข้าว)",
    endpoint: "/reports/phase1/P19/pdf",
    type: "phase1_pdf",
    xlsx: true, // Excel twin: /reports/phase1/Pnn/xlsx
    badge: "PHASE1",
    require: ["branchId", "startDate", "endDate"],
    optional: [],
  },
]

const YEAR_OPTIONS = Array.from({ length: 15 }, (_, i) => {
  const y = String(2569 + i)
  const pid = String(1 + i) // 2569 - 2568 = 1
  return { id: pid, label: y }
})

/** Phase 1 report ที่ผู้ใช้มีสิทธิ์ (คีย์ "phase1-p01" → permission "reports.phase1.p01") */
const phase1Perm = (key) => key.replace("phase1-", "reports.phase1.")
function allowedPhase1Reports() {
  return PHASE1_REPORTS.filter((r) => can(phase1Perm(r.key)))
}

// Phase 1 split for the landing cards: member/share registry vs rice buy/sell.
// Anything not listed here falls into the rice group.
const PHASE1_MEMBER_KEYS = new Set([
  "phase1-p01", "phase1-p03", "phase1-p09", "phase1-p10", "phase1-p11",
  "phase1-p14", "phase1-p15", "phase1-p16", "phase1-p17", "phase1-p18",
])
const isPhase1Member = (r) => PHASE1_MEMBER_KEYS.has(r.key)

function Documents() {
  const [mode, setMode] = useState(() => {
    const qs = safeQS()
    const m = (pickQS(qs, ["mode", "view", "tab"]) || "").toLowerCase()
    
    if (m === "plan") return "plan"
    if (m === "share" || m === "registry" || m === "shares" || m === "shop" || m === "store") return "share"
    if (m === "phase1" || m === "p1" || m === "phase-1") return "phase1"

    return "internal"
  })

  const REPORTS = useMemo(() => {
    if (mode === "share") return SHARE_REPORTS
    if (mode === "plan") return PLAN_REPORTS
    if (mode === "phase1") return allowedPhase1Reports()
    return VISIBLE_INTERNAL_REPORTS
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

  const [, setPreviewJson] = useState(null)

  const today = new Date().toISOString().slice(0, 10)
  const firstDayThisMonth = useMemo(() => {
    const d = new Date()
    d.setDate(1)
    return d.toISOString().slice(0, 10)
  }, [])

  /** สาขา: scope "own_branch" → ล็อกที่สาขาที่ใช้งานอยู่ */
  const branchLock = useBranchLock()

  /** ---------- State ฟิลเตอร์ ---------- */
  const [filters, setFilters] = useState({
    startDate: firstDayThisMonth,
    endDate: today,
    productId: "",
    specId: "",
    branchId: branchLock.activeKey,
    klangId: "",
    // share filters
    memberId: "",
    assoId: "",
    assoName: "", // ป้ายชื่อสมาชิกที่เลือก (สำหรับ P05 member search)
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
      const foundInternal = VISIBLE_INTERNAL_REPORTS.find((r) => r.key === code)
      const foundPlan = PLAN_REPORTS.find((r) => r.key === code)
      const foundPhase1 = allowedPhase1Reports().find((r) => r.key === code)
      const custom = SHARE_REPORTS.find((r) => r.key === "share-custom")

      if (foundShare) {
        setMode("share")
        setActiveReport(foundShare.key)
      } else if (foundPlan) {
        setMode("plan")
        setActiveReport(foundPlan.key)
      } else if (foundPhase1) {
        setMode("phase1")
        setActiveReport(foundPhase1.key)
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
            label: String(r.prod_name || r.name || r.spec_name || "").trim(),
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

  /** ล็อกสาขา (รวมถึงลิงก์แชร์ที่ระบุ branch_id อื่น) → บังคับเป็นสาขาที่ใช้งานอยู่ */
  useEffect(() => {
    if (!branchLock.locked) return
    setFilters((p) => (p.branchId === branchLock.activeKey ? p : { ...p, branchId: branchLock.activeKey, klangId: "" }))
  }, [branchLock.locked, branchLock.activeKey])

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
      if (f === "memberId") return "เลขสมาชิก"
      if (f === "assoId") return "รหัสลูกค้าทั่วไป"
      if (f === "customReportCode") return "รหัสรายงาน"
      if (f === "planId") return "แผน"
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

    const branchId = scopedBranchId(filters.branchId)
    if (wants("branchId") && branchId) p.set("branch_id", branchId)
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

    const isPdf = report.type === "pdf" || report.type === "share_pdf" || report.type === "phase1_pdf"
    // หมายเหตุความปลอดภัย: ไม่ใช้ feature "noopener" ตรงนี้ เพราะ noopener จะทำให้
    // window.open() คืนค่า null บนเบราว์เซอร์เป้าหมาย ซึ่งจะทำให้ flow พรีวิว PDF พัง
    // (โค้ดด้านล่างต้องใช้ handle เพื่อเขียน placeholder, set location.href เป็น blob URL,
    // focus/print และ close ตอน error) — แทนที่จะใช้ noopener เราจึง null ค่า opener
    // ด้วยตัวเองเพื่อปิดช่องโหว่ reverse-tabnabbing โดยยังคงควบคุมหน้าต่างได้
    const preOpenWin = isPdf ? window.open("", "_blank") : null
    if (preOpenWin) {
      try {
        preOpenWin.opener = null
      } catch { /* ignore */ }
    }

    if (preOpenWin && isPdf) {
      try {
        preOpenWin.document.title = report.title || "Report"
        // สร้าง placeholder ด้วย DOM API (createElement + textContent) แทน innerHTML
        // เพื่อกันการ inject HTML — ไม่มีการนำข้อมูล user/dynamic มา assign ผ่าน innerHTML
        const doc = preOpenWin.document
        // The pre-opened tab is a blank document (white by default) — follow the
        // app theme so the muted hint keeps its contrast in dark mode too.
        const isDark = document.documentElement.classList.contains("dark")
        if (isDark) {
          doc.documentElement.style.colorScheme = "dark"
          doc.body.style.background = "#0B0B0F"
          doc.body.style.color = "#EDEDF0"
        }
        const wrap = doc.createElement("div")
        wrap.style.fontFamily = "sans-serif"
        wrap.style.padding = "16px"

        const heading = doc.createElement("div")
        heading.style.fontSize = "16px"
        heading.style.fontWeight = "600"
        heading.textContent = "กำลังเตรียมรายงาน…"

        const hint = doc.createElement("div")
        hint.style.marginTop = "6px"
        hint.style.color = isDark ? "#9A9AA5" : "#64748b"
        hint.textContent = "ถ้าหน้านี้ไม่เปลี่ยนเป็น PDF ให้กลับไปหน้ารายงานเพื่อดูสาเหตุ"

        wrap.appendChild(heading)
        wrap.appendChild(hint)

        doc.body.replaceChildren(wrap)
      } catch { /* ignore */ }
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
              } catch { /* ignore */ }
            }, 1200)
          } catch { /* ignore */ }
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
      } catch { /* ignore */ }
      toast.error("เปิดรายงานไม่สำเร็จ", { description: reportErrorMessage(err) })
    } finally {
      setDownloading(false)
    }
  }

  /** PDF path (endpoint + same query) for the Excel twin — null when the form is invalid.
   *  No `preview` param: that one is PDF-only. ExcelDownloadButton maps it via excelUrl(). */
  const excelPdfPath = (report) => {
    if (Object.keys(validate(report)).length) return null
    const endpoint = typeof report.endpoint === "function" ? report.endpoint(filters) : report.endpoint
    const qs = buildParams(report).toString()
    return qs ? `${endpoint}?${qs}` : endpoint
  }

  const resetForm = () =>
    setFilters({
      startDate: firstDayThisMonth,
      endDate: new Date().toISOString().slice(0, 10),
      productId: "",
      specId: "",
      branchId: branchLock.activeKey,
      klangId: "",
      memberId: "",
      assoId: "",
      assoName: "",
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
        รายการสำเร็จรูป{requiredSpec && <span className="text-red-500"> *</span>}
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
          placeholder="รหัสสเปค (ตัวเลข)"
          value={filters.specId}
          onChange={(e) => setFilter("specId", e.target.value)}
        />
      )}

      {requiredSpec && <FieldError name="specId" />}
      {specOptions.length === 0 && !loadingSpecs && (
        <p className={helpTextCls}>รายการไม่ขึ้น พิมพ์รหัสสเปคเป็นตัวเลขแทนได้</p>
      )}
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
            disabled={branchLock.locked}
          />
        ) : (
          <input
            className={cx(baseField, requireBranch && errors.branchId && "border-red-400 ring-2 ring-red-300/70")}
            placeholder="รหัสสาขา (ตัวเลข)"
            value={filters.branchId}
            onChange={(e) => setFilter("branchId", e.target.value)}
            readOnly={branchLock.locked}
            aria-readonly={branchLock.locked || undefined}
          />
        )}

        {requireBranch && <FieldError name="branchId" />}
        {branchLock.locked && <BranchLockNote />}
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
              placeholder="รหัสคลัง (ตัวเลข)"
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

    const memberLabel = report?.memberLabel || "เลขสมาชิก"
    const memberPlaceholder = report?.memberPlaceholder || "เช่น 11263"
    const memberHelp =
      report?.memberHelp ||
      "ใส่เพื่อดูเฉพาะสมาชิกคนนี้ หรือเว้นว่างเพื่อดูทั้งหมด"

    const assoLabel = report?.assoLabel || "รหัสลูกค้าทั่วไป"
    const assoPlaceholder = report?.assoPlaceholder || "รหัสลูกค้าทั่วไป"
    const assoHelp =
      report?.assoHelp || "ใช้แทนเลขสมาชิกได้"

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
        รหัสรายงาน <span className="text-red-500">*</span>
      </label>
      <input
        className={cx(baseField, errors.customReportCode && "border-red-400 ring-2 ring-red-300/70")}
        placeholder="เช่น member-signup"
        value={filters.customReportCode}
        onChange={(e) => setFilter("customReportCode", e.target.value)}
      />
      <FieldError name="customReportCode" />
    </div>
  )

  const FormShareKlangIds = () => (
    <div className="md:col-span-3">
      <label className={labelCls}>คลังหลายรายการ (ไม่บังคับ)</label>
      <input
        className={baseField}
        placeholder="รหัสคลัง (ตัวเลข) เช่น 1,2,3"
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
            title="ล้างคลังที่เลือก"
          >
            ล้าง
          </button>
        </div>
      )}

      <p className={helpTextCls}>
        {klangOptions.length > 0 ? "กดเลือกได้หลายคลัง หรือเว้นว่างเพื่อรวมทุกคลัง" : "เว้นว่างเพื่อรวมทุกคลัง"}
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
            กดปุ่ม <span className="font-semibold">🖨️</span> เพื่อเปิด PDF แล้วพิมพ์ ข้อมูลตามปีแผนงานที่เลือก
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
          <p className={helpTextCls}>ถ้าไม่เลือกสเปค จะออกรวมทุกชนิดในสาขาที่เลือก</p>
        </>
      )
    }

    if (report.key === "registerPurchase") {
      return (
        <div className="grid gap-4 md:grid-cols-3">
          <FormDates report={report} />
          <FormBranchKlang requireBranch={false} />
          <div>
            <label className={labelCls}>ค้นหาชื่อสายพันธุ์</label>
            <input className={baseField} placeholder="เช่น มะลิ" value={filters.speciesLike} onChange={(e) => setFilter("speciesLike", e.target.value)} />
          </div>
          <div>
            <label className={labelCls}>ที่อยู่ บรรทัด 4</label>
            <input className={baseField} value={filters.addrLine4} onChange={(e) => setFilter("addrLine4", e.target.value)} />
          </div>
          <div>
            <label className={labelCls}>ที่อยู่ บรรทัด 5</label>
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
              <label className={labelCls}>ประเภทสินค้า *</label>
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
                  placeholder="รหัสประเภทสินค้า (ตัวเลข)"
                  value={filters.productId}
                  onChange={(e) => setFilter("productId", e.target.value)}
                />
              )}
              <FieldError name="productId" />
            </div>
          </div>
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
            กดปุ่ม <span className="font-semibold">🖨️</span> เพื่อเปิด PDF แล้วพิมพ์
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
            กดปุ่ม <span className="font-semibold">🖨️</span> เพื่อเปิด PDF แล้วพิมพ์
          </p>
        </>
      )
    }

    if (report.type === "phase1_pdf") {
      const req = report.require || []
      const opt = report.optional || []

      const hasDates = req.includes("startDate") || req.includes("endDate")
      const hasBranch = req.includes("branchId") || opt.includes("branchId")
      const requireBranch = req.includes("branchId")
      const hasMember = req.includes("memberId") || opt.includes("memberId") || req.includes("assoId") || opt.includes("assoId")
      const hasKlangIds = req.includes("klangIds") || opt.includes("klangIds")
      const hasSpec = req.includes("specId") || opt.includes("specId")

      return (
        <>
          <div className="grid gap-4 md:grid-cols-3">
            {hasDates && <FormDates report={report} />}
            {hasBranch && <FormBranchKlang requireBranch={requireBranch} showKlang={false} />}
            {hasSpec && <FormSpecOnly requiredSpec={req.includes("specId")} />}
            {report.memberSearch ? (
              <div className="md:col-span-3">
                <label className={labelCls}>
                  ค้นหาสมาชิก <span className="text-red-500">*</span>
                </label>
                <MemberSearchBox
                  valueLabel={filters.assoName || (filters.assoId ? "เลือกสมาชิกแล้ว" : "")}
                  error={!!errors.assoId}
                  onPick={(r) => {
                    setFilters((p) => ({ ...p, assoId: String(r.asso_id), assoName: personLabel(r) }))
                    setErrors((e) => ({ ...e, assoId: undefined }))
                  }}
                  onClear={() => setFilters((p) => ({ ...p, assoId: "", assoName: "" }))}
                />
                <FieldError name="assoId" />
                <p className={helpTextCls}>
                  เลือกสมาชิก/ลูกค้าที่ต้องการดูประวัติซื้อข้าวเปลือก แล้วกดพิมพ์ PDF
                </p>
              </div>
            ) : hasMember ? (
              <FormShareIdentity report={report} />
            ) : null}
            {hasKlangIds && <FormShareKlangIds />}
          </div>
          <p className={helpTextCls}>
            กดปุ่ม <span className="font-semibold">🖨️</span> เพื่อเปิดและพิมพ์รายงาน PDF
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
          <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">

            {/* กล่อง 1: รายงานซื้อขายข้าว (Phase 1) — แสดงเฉพาะผู้มีสิทธิ์ reports.phase1.* */}
            {allowedPhase1Reports().some((r) => !isPhase1Member(r)) && (
            <div className="flex flex-col rounded-2xl border border-amber-200 bg-amber-50/40 p-6 shadow-sm dark:border-amber-800/50 dark:bg-amber-900/10 transition-all hover:shadow-md">
              <div className="mb-4 flex items-center gap-3">
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-amber-100 text-amber-600 dark:bg-amber-900/50 dark:text-amber-400">
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M20 6h-2.18c.07-.44.18-.88.18-1.36C18 2.54 15.86.5 13.31.5c-1.38 0-2.61.56-3.51 1.46L9 2.77l-.8-.81C7.3 1.06 6.07.5 4.69.5 2.14.5 0 2.54 0 4.64c0 .48.11.92.18 1.36H0v2h20V6zm-5.47 0H9.47C9.17 5.56 9 4.98 9 4.64c0-1.03.9-2.14 1.94-2.14.54 0 1.05.24 1.42.62L14 4.88l1.64-1.76C16.01 2.74 16.52 2.5 17.06 2.5 18.1 2.5 19 3.61 19 4.64c0 .34-.17.92-.47 1.36zM1 20c0 1.1.9 2 2 2h18c1.1 0 2-.9 2-2V9H1v11zm8-8h6v2H9v-2z"/>
                  </svg>
                </div>
                <h2 className="text-xl font-bold text-amber-800 dark:text-amber-300">รายงานซื้อขายข้าว</h2>
              </div>
              <p className="mb-6 text-sm text-amber-700/80 dark:text-amber-400/80">
                ซื้อ/ขายข้าวเปลือกรายวัน รายคน แยกราคา ทะเบียนคุม และสรุปสาขา (PDF)
              </p>
              <div className="mt-auto">
                <ComboBox
                  options={allowedPhase1Reports().filter((r) => !isPhase1Member(r)).map((r) => ({ ...r, id: r.key, label: r.title }))}
                  placeholder="คลิกเพื่อเลือกรายงาน..."
                  title="รายงานซื้อขายข้าว"
                  value={null}
                  onChange={(v) => {
                    setMode("phase1")
                    setActiveReport(v)
                    setPreviewJson(null)
                    setErrors({})
                  }}
                />
              </div>
            </div>
            )}

            {/* กล่อง 2: รายงานสมาชิกและทุนเรือนหุ้น (Phase 1) */}
            {allowedPhase1Reports().some(isPhase1Member) && (
            <div className="flex flex-col rounded-2xl border border-violet-200 bg-violet-50/40 p-6 shadow-sm dark:border-violet-800/50 dark:bg-violet-900/10 transition-all hover:shadow-md">
              <div className="mb-4 flex items-center gap-3">
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-violet-100 text-violet-600 dark:bg-violet-900/50 dark:text-violet-400">
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M16 11c1.66 0 2.99-1.34 2.99-3S17.66 5 16 5s-3 1.34-3 3 1.34 3 3 3zm-8 0c1.66 0 2.99-1.34 2.99-3S9.66 5 8 5 5 6.34 5 8s1.34 3 3 3zm0 2c-2.33 0-7 1.17-7 3.5V19h14v-2.5c0-2.33-4.67-3.5-7-3.5zm8 0c-.29 0-.62.02-.97.05 1.16.84 1.97 1.97 1.97 3.45V19h6v-2.5c0-2.33-4.67-3.5-7-3.5z"/>
                  </svg>
                </div>
                <h2 className="text-xl font-bold text-violet-800 dark:text-violet-300">รายงานสมาชิก</h2>
              </div>
              <p className="mb-6 text-sm text-violet-700/80 dark:text-violet-400/80">
                ทะเบียนสมาชิก สมาชิกใหม่/ลาออก ทุนเรือนหุ้น และการจ่ายคืนค่าหุ้น (PDF)
              </p>
              <div className="mt-auto">
                <ComboBox
                  options={allowedPhase1Reports().filter(isPhase1Member).map((r) => ({ ...r, id: r.key, label: r.title }))}
                  placeholder="คลิกเพื่อเลือกรายงาน..."
                  title="รายงานสมาชิก"
                  value={null}
                  onChange={(v) => {
                    setMode("phase1")
                    setActiveReport(v)
                    setPreviewJson(null)
                    setErrors({})
                  }}
                />
              </div>
            </div>
            )}

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
                ) : reportObj.type === "pdf" || reportObj.type === "share_pdf" || reportObj.type === "phase1_pdf" ? (
                  downloading ? (
                    "กำลังเตรียม PDF..."
                  ) : (
                    <span className="inline-flex items-center gap-2">
                      <PrinterIcon className="-ml-0.5" />
                      พิมพ์ PDF
                    </span>
                  )
                ) : (
                  downloading ? "กำลังดึงข้อมูล..." : "ดาวน์โหลด"
                )}
              </button>

              {reportObj.xlsx && (
                <ExcelDownloadButton
                  key={reportObj.key}
                  label="ดาวน์โหลด Excel"
                  getPdfPath={() => excelPdfPath(reportObj)}
                  fallbackName={`${reportObj.key}${reportObj.require.includes("startDate") ? `_${filters.startDate}_${filters.endDate}` : ""}.xlsx`}
                  className={cx(secondaryBtnCls, "disabled:opacity-60 disabled:cursor-not-allowed disabled:hover:scale-100")}
                />
              )}

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
                รีเซ็ต
              </button>
            </div>
          </form>
        )}

      </div>
    </div>
  )
}

export default Documents