// src/pages/Documents.jsx
import { useEffect, useMemo, useRef, useState } from "react"
import { apiAuth, apiDownload } from "../../lib/api"   // helper แนบ token + BASE URL
import { cx, baseField, labelCls, helpTextCls, errorTextCls, secondaryBtnCls } from "../../lib/styles"
import ExcelDownloadButton from "../../components/ExcelDownloadButton"
import { can } from "../../lib/permissions"
import ComboBox from "../../components/ComboBox"
import BranchLockNote from "../../components/BranchLockNote"
import useBranchLock, { scopedBranchId } from "../../hooks/useBranchLock"
import { toast } from "../../components/ui"
import DateInput from "../../components/ThaiDateField"

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

  // 404 ที่มี detail จริง (เช่น "ไม่มีรายการซื้อ/ขายในช่วงวันที่นี้", "Business Plan 3 not found")
  // แสดงตามนั้น — ใช้ข้อความกลางเฉพาะ 404 ดิบของ FastAPI ("Not Found") — api-handoff §6
  if (status === 404) {
    const detail = typeof err?.data?.detail === "string" ? err.data.detail.trim() : raw.trim()
    if (detail && detail.toLowerCase() !== "not found") return detail.slice(0, 200)
    return "รายงานนี้ยังไม่พร้อมใช้งาน"
  }
  if (status === 403)
    return "บัญชีนี้ไม่มีสิทธิ์เปิดรายงานนี้ ติดต่อผู้ดูแลระบบถ้าต้องใช้"
  if (status === 401)
    return "หมดเวลาใช้งาน เข้าสู่ระบบใหม่แล้วลองอีกครั้ง"

  if (status === 400 || status === 422) {
    const detail = typeof err?.data?.detail === "string" ? err.data.detail.trim() : ""
    return thaiDetail || detail.slice(0, 200) || "ข้อมูลที่เลือกไม่ถูกต้อง ตรวจแล้วลองใหม่"
  }

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
// ช่องวันที่ไทย (วัน เดือน พ.ศ.) ตัวกลาง — API เหมือน input เดิม (handoff F25)


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
// รายการ legacy (/docs/reports/*.pdf, /share/reports/*.pdf, /report/*-excel) ไม่มี endpoint ใน backend
// แล้ว — ลบออก และพาลิงก์ ?report=<คีย์เดิม> ไปรายงานที่ใช้แทน (api-handoff §8–10)
const LEGACY_REPORT_KEYS = {
  "buy-by-day": "phase1-p06", "share-buy-by-day": "phase1-p06",
  "by-price": "phase1-p04", "share-by-price": "phase1-p04",
  "sell-by-day": "phase1-p02", "share-sell-by-day": "phase1-p02",
  "rice-summary": "phase1-p19", "share-rice-summary": "phase1-p19",
  "collection-report": "phase1-p08", "share-collection-report": "phase1-p08",
  "daily-report": "phase1-p13", "share-daily-report": "phase1-p13",
  "control-report": "phase1-p07", "share-control-report": "phase1-p07",
  "branch-summary": "phase1-p12", "share-branch-summary": "phase1-p12",
  "share-member-signup": "phase1-p14", "member-signup": "phase1-p14",
  "share-member-history": "phase1-p10", "member-history": "phase1-p10",
  purchaseGrouped: "phase1-p21", salesDaily: "phase1-p24", purchasesDaily: "phase1-p25",
  registerPurchase: "phase1-p22", branchRx: "phase1-p20", riceSummary: "phase1-p23",
}

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
    require: ["startDate", "endDate"],
    optional: ["branchId"],
    allBranchesOption: true, // ไม่เลือกสาขา = ทุกสาขา
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
    require: ["startDate", "endDate"],
    optional: ["branchId"],
    allBranchesOption: true, // ไม่เลือกสาขา = ทุกสาขา
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
    require: ["startDate", "endDate"],
    optional: ["branchId"],
    allBranchesOption: true, // ไม่เลือกสาขา = ทุกสาขา
  },
  {
    key: "phase1-p07",
    title: "P07 — ทะเบียนคุม (ทุกสาขา)",
    endpoint: "/reports/phase1/P07/pdf",
    type: "phase1_pdf",
    xlsx: true, // Excel twin: /reports/phase1/Pnn/xlsx
    badge: "PHASE1",
    require: ["startDate", "endDate"],
    optional: ["specId"],
    scopeNote: "ทุกสาขา — รายงานนี้รวมทุกสาขาเสมอ ไม่ต้องเลือกสาขา",
    specNote: "ไม่เลือก = ทุกสินค้า (แยกตอนละสินค้าที่มีการซื้อ/ขายในช่วงวันที่)",
  },
  {
    key: "phase1-p08",
    title: "P08 — รายงานการรวบรวม",
    endpoint: "/reports/phase1/P08/pdf",
    type: "phase1_pdf",
    xlsx: true, // Excel twin: /reports/phase1/Pnn/xlsx
    badge: "PHASE1",
    require: ["startDate", "endDate"],
    optional: [],
    scopeNote: "ทั้งองค์กร — รายงานนี้รวมทุกสาขาเสมอ",
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
    require: ["branchId", "startDate", "endDate"],
    optional: ["specId"],
    specNote: "ไม่เลือก = ทุกสินค้าที่มีการซื้อ/ขายในสาขานี้",
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
    require: ["startDate", "endDate"],
    optional: [],
    scopeNote: "ทั้งองค์กร — จัดกลุ่มตามอำเภอ ไม่แยกสาขา",
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
    require: ["startDate", "endDate"],
    optional: ["branchId"],
    allBranchesOption: true, // ไม่เลือกสาขา = ทุกสาขา
  },
]

// -----------------------------
// Phase 1 P20–P27 — Excel ซื้อขาย (มี /xlsx + /pdf คู่กัน, สิทธิ์ order.reports)
// ปุ่มหลักพิมพ์ PDF, ปุ่ม Excel ใช้ /xlsx (excelUrl แปลงจาก /pdf ให้)
// -----------------------------
const TRADE_REPORTS = [
  { key: "phase1-p20", title: "P20 — ทะเบียนคุมสาขา (Branch RX)", endpoint: "/reports/phase1/P20/pdf", require: ["startDate", "endDate", "branchId"], optional: ["specIds"] },
  { key: "phase1-p21", title: "P21 — รายงานซื้อ-ขายแยกตามราคา", endpoint: "/reports/phase1/P21/pdf", require: ["startDate", "endDate"], optional: ["specIds", "branchId", "klangId"], allBranchesOption: true },
  { key: "phase1-p22", title: "P22 — ทะเบียนรับซื้อ", endpoint: "/reports/phase1/P22/pdf", require: ["startDate", "endDate"], optional: ["branchId", "klangId", "speciesLike"], allBranchesOption: true },
  { key: "phase1-p23", title: "P23 — รายงานซื้อขาย (รวม)", endpoint: "/reports/phase1/P23/pdf", require: ["startDate", "endDate"], optional: ["specIds"], scopeNote: "ทั้งองค์กร — ไม่แยกสาขา", specNote: "ไม่เลือก = ทุกสินค้าประเภทธุรกิจ 1" },
  { key: "phase1-p24", title: "P24 — รายงานการขาย (แยกตามวัน)", endpoint: "/reports/phase1/P24/pdf", require: ["startDate", "endDate", "branchId"], optional: ["specIds"] },
  { key: "phase1-p25", title: "P25 — รายงานการซื้อ (แยกตามวัน)", endpoint: "/reports/phase1/P25/pdf", require: ["startDate", "endDate", "branchId"], optional: ["specIds"] },
  { key: "phase1-p26", title: "P26 — ทะเบียนคุม (รายวัน)", endpoint: "/reports/phase1/P26/pdf", require: ["startDate", "endDate", "specId"], optional: ["branchId", "klangId"], allBranchesOption: true },
  {
    key: "phase1-p27", title: "P27 — สรุปการรับซื้อจากสมาชิก (แยกตามสินค้า)", endpoint: "/reports/phase1/P27/pdf",
    require: ["startDate", "endDate"], optional: ["branchId", "specIds"], allBranchesOption: true,
    scopeNote: "เฉพาะสมาชิก (ไม่รวมลูกค้าทั่วไป) · ช่วงยาวหรือทุกสาขาใช้เวลาหลายสิบวินาที — แนะนำดาวน์โหลด Excel",
    specNote: "ไม่เลือก = ทุกสินค้า",
  },
].map((r) => ({ type: "phase1_pdf", xlsx: true, badge: "TRADE", perm: "trading.reports.view", ...r }))

// -----------------------------
// HR reports (/hr/...) — ปี/ปีงบประมาณเป็น พ.ศ. (int) · สิทธิ์ report.hr.* (api-handoff §3, #12)
// field: month · yearBE · fiscalYear · startDate/endDate (→ from_date/to_date) · employeeId · loanId
//        · branchId · exitType · showSensitive
// -----------------------------
const EXIT_TYPE_OPTIONS = [
  { id: "", label: "— ทุกประเภท —" },
  { id: "resigned", label: "ลาออก" },
  { id: "retired", label: "เกษียณ" },
  { id: "deceased", label: "เสียชีวิต" },
  { id: "dismissed", label: "ถูกให้ออก" },
  { id: "failed_probation", label: "ไม่ผ่านทดลองงาน" },
  { id: "contract_end", label: "หมดสัญญา" },
]
const HR_REPORTS = [
  { key: "hr-payroll-monthly", title: "รายงานสรุปเงินเดือน", endpoint: "/hr/payroll/report/monthly", require: ["month", "yearBE"], perm: "hr.reports.payrollMonthly", xlsx: true },
  { key: "hr-payroll-annual", title: "รายงานเงินเดือนประจำปีงบประมาณ", endpoint: "/hr/payroll/report/annual", require: ["fiscalYear"], perm: "hr.reports.payrollAnnual", xlsx: true },
  { key: "hr-social-security", title: "รายงานเงินสมทบประกันสังคม", endpoint: "/hr/payroll/report/social-security", require: ["month", "yearBE"], perm: "hr.reports.socialSecurity", xlsx: true },
  { key: "hr-reserve-fund", title: "รายงานเงินสะสม / กองทุนสำรองเลี้ยงชีพ", endpoint: "/hr/payroll/report/reserve-fund", require: ["month", "yearBE"], perm: "hr.reports.reserveFund", xlsx: true },
  { key: "hr-leave-balance", title: "รายงานสรุปวันลาประจำปีงบประมาณ", endpoint: "/hr/leave/report/balance", require: ["fiscalYear"], perm: "hr.reports.leaveBalance", xlsx: true },
  { key: "hr-leave-utilization", title: "รายงานการลาของพนักงาน", endpoint: "/hr/leave/report/utilization", require: ["startDate", "endDate"], perm: "hr.reports.leaveUtilization", xlsx: true },
  { key: "hr-leave-annual", title: "ทะเบียนคุมการลาประจำปีบัญชี", endpoint: "/hr/leave/annual-summary-pdf", require: [], optional: ["fiscalYear", "branchId"], perm: "hr.reports.leaveAnnual", xlsx: true, allBranchesOption: true },
  { key: "hr-leave-register", title: "ทะเบียนการลาประจำปีบัญชี (เม.ย.–มี.ค.)", endpoint: "/hr/leave/register-pdf", require: [], optional: ["fiscalYear", "branchId"], perm: "hr.reports.leaveRegister", xlsx: true, allBranchesOption: true },
  { key: "hr-roster", title: "ทะเบียนพนักงาน", endpoint: "/hr/reports/roster", require: [], perm: "hr.reports.roster", xlsx: true },
  { key: "hr-new-employees", title: "รายงานพนักงานใหม่", endpoint: "/hr/reports/new-employees", require: ["month", "yearBE"], perm: "hr.reports.newEmployees", xlsx: true },
  { key: "hr-position-changes", title: "รายงานการเปลี่ยนตำแหน่ง", endpoint: "/hr/reports/position-changes", require: ["startDate", "endDate"], perm: "hr.reports.positionChanges", xlsx: true },
  { key: "hr-relocations", title: "รายงานการโอนย้าย", endpoint: "/hr/reports/relocations", require: ["startDate", "endDate"], perm: "hr.reports.relocations", xlsx: true },
  { key: "hr-relocation-history", title: "ประวัติการโยกย้ายเจ้าหน้าที่ (ทั้งองค์กร)", endpoint: "/hr/reports/relocation-history-pdf", require: [], optional: ["startDate", "endDate"], perm: "hr.reports.relocations", xlsx: true },
  { key: "hr-salary-levels", title: "รายงานระดับเงินเดือนพนักงาน", endpoint: "/hr/reports/salary-levels", require: [], perm: "hr.reports.salaryLevels", xlsx: true },
  { key: "hr-salary-adjustments", title: "รายงานการปรับขั้นเงินเดือน", endpoint: "/hr/reports/salary-adjustments", require: ["fiscalYear"], perm: "hr.reports.salaryAdjustments", xlsx: true },
  { key: "hr-loans-active", title: "รายงานเงินกู้ที่ยังค้างชำระ", endpoint: "/hr/reports/loans/active", require: [], perm: "hr.reports.activeLoans", xlsx: true },
  { key: "hr-kpi-branch", title: "รายงาน KPI สาขา", endpoint: "/hr/kpi/report/branch", require: ["fiscalYear"], optional: ["branchId"], perm: "hr.reports.kpiBranch", xlsx: true, allBranchesOption: true },
  { key: "hr-kpi-org", title: "รายงาน KPI รวมองค์กร", endpoint: "/hr/kpi/report/organisation", require: ["fiscalYear"], perm: "hr.reports.kpiOrganisation", xlsx: true },
  { key: "hr-resigned", title: "รายชื่อผู้พ้นสภาพ", endpoint: "/hr/reports/resigned-retired-pdf", require: [], optional: ["exitType", "branchId", "startDate", "endDate"], perm: "hr.reports.resignedRetired", xlsx: true, allBranchesOption: true },
  // รายคน/รายสัญญา (PDF อย่างเดียว ไม่มี Excel)
  { key: "hr-profile-pdf", title: "ข้อมูลประวัติพนักงาน (รายคน)", endpoint: (f) => `/hr/employees/${encodeURIComponent(f.employeeId)}/profile-pdf`, require: ["employeeId"], optional: ["showSensitive"], perm: "hr.reports.profilePdf" },
  { key: "hr-salary-history-pdf", title: "ประวัติการปรับขั้นเงินเดือน (รายคน)", endpoint: (f) => `/hr/employees/${encodeURIComponent(f.employeeId)}/salary-history-pdf`, require: ["employeeId"], perm: "hr.reports.salaryHistoryPdf" },
  { key: "hr-kpi-individual", title: "ผลการประเมิน KPI รายบุคคล", endpoint: (f) => `/hr/kpi/evaluations/${encodeURIComponent(f.employeeId)}/pdf`, require: ["employeeId", "fiscalYear"], perm: "hr.reports.kpiIndividual" },
  { key: "hr-loan-schedule", title: "ตารางผ่อนชำระเงินกู้ (รายสัญญา)", endpoint: (f) => `/hr/loans/${encodeURIComponent(f.loanId)}/schedule-pdf`, require: ["loanId"], perm: "hr.reports.loanSchedule" },
].map((r) => ({ type: "hr_pdf", badge: "HR", optional: [], ...r }))

/** ปีงบประมาณปัจจุบัน (พ.ศ.) — 1 เม.ย. → 31 มี.ค. */
const currentFiscalYearBE = () => {
  const d = new Date()
  return (d.getMonth() >= 3 ? d.getFullYear() : d.getFullYear() - 1) + 543
}
const THAI_MONTH_OPTIONS = ["มกราคม", "กุมภาพันธ์", "มีนาคม", "เมษายน", "พฤษภาคม", "มิถุนายน", "กรกฎาคม", "สิงหาคม", "กันยายน", "ตุลาคม", "พฤศจิกายน", "ธันวาคม"]
  .map((label, i) => ({ id: String(i + 1), label }))

/** ปีแผนงาน (พ.ศ.) — plan_id จริง = BusinessPlan.id จาก GET /unit-prices/{year}/plan (ไม่ใช่ลำดับปี) */
const YEAR_OPTIONS = Array.from({ length: 15 }, (_, i) => {
  const y = String(2569 + i)
  return { id: y, label: y }
})

/** Phase 1 report ที่ผู้ใช้มีสิทธิ์ (คีย์ "phase1-p01" → permission "reports.phase1.p01") */
const phase1Perm = (key) => key.replace("phase1-", "reports.phase1.")
function allowedPhase1Reports() {
  return PHASE1_REPORTS.filter((r) => can(phase1Perm(r.key)))
}
const allowedTradeReports = () => TRADE_REPORTS.filter((r) => can(r.perm))
const allowedHrReports = () => HR_REPORTS.filter((r) => can(r.perm))
const isPdfType = (t) => t === "pdf" || t === "phase1_pdf" || t === "hr_pdf"

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
    if (m === "trade" || m === "excel") return "trade"
    if (m === "hr") return "hr"
    return "phase1"
  })

  const REPORTS = useMemo(() => {
    if (mode === "plan") return PLAN_REPORTS
    if (mode === "trade") return allowedTradeReports()
    if (mode === "hr") return allowedHrReports()
    return allowedPhase1Reports()
  }, [mode])

  /** ---------- โหลดตัวเลือกพื้นฐาน ---------- */
  const [loadingOptions, setLoadingOptions] = useState(false)
  const [loadingSpecs, setLoadingSpecs] = useState(false)
  const [downloading, setDownloading] = useState(false)
  const [errors, setErrors] = useState({})
  const [activeReport, setActiveReport] = useState(null)

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
    // Plan filters — planYear = ปี พ.ศ. ที่เลือก, planId = BusinessPlan.id จริง (resolve จาก backend)
    planYear: "",
    planId: "",
    // P20–P26: หลายสเปค (csv) → spec_id ซ้ำ key
    specIds: "",
    // HR
    month: String(new Date().getMonth() + 1),
    yearBE: String(new Date().getFullYear() + 543),
    fiscalYear: String(currentFiscalYearBE()),
    employeeId: "",
    loanId: "",
    exitType: "",
    showSensitive: false,
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
    const planYear = pickQS(qs, ["plan_year", "year"])
    if (planYear) patch.planYear = planYear

    // open report by code
    const code = pickQS(qs, ["report", "report_code", "reportCode"])

    if (Object.keys(patch).length) {
      setFilters((p) => ({ ...p, ...patch }))
    }

    if (code) {
      // ลิงก์เก่า (?report=sell-by-day ฯลฯ) → รายงานที่ใช้แทน
      const key = LEGACY_REPORT_KEYS[code] || code
      const foundPlan = PLAN_REPORTS.find((r) => r.key === key)
      const foundPhase1 = allowedPhase1Reports().find((r) => r.key === key)
      const foundTrade = allowedTradeReports().find((r) => r.key === key)
      const foundHr = allowedHrReports().find((r) => r.key === key)

      if (foundPlan) {
        setMode("plan")
        setActiveReport(foundPlan.key)
      } else if (foundPhase1) {
        setMode("phase1")
        setActiveReport(foundPhase1.key)
      } else if (foundTrade) {
        setMode("trade")
        setActiveReport(foundTrade.key)
      } else if (foundHr) {
        setMode("hr")
        setActiveReport(foundHr.key)
      }
    }
  }, [])

  /** โหลดตัวเลือกพื้นฐาน (product, branch) */
  useEffect(() => {
    const loadOptions = async () => {
      try {
        setLoadingOptions(true)
        const branches = await apiAuth("/order/branch/search").catch(() => [])
        setBranchOptions(
          (branches || [])
            .map((b) => ({ id: String(b.id), label: b.branch_name }))
            .filter((o) => o.id && o.label)
        )
      } catch (err) {
        console.error("loadOptions error:", err)
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

  /** ปีแผน → BusinessPlan.id จริง: GET /unit-prices/{year}/plan → {exists, plan:{id, fiscal_year}} */
  const [planInfo, setPlanInfo] = useState({ status: "idle", id: "", year: "" })
  useEffect(() => {
    const y = filters.planYear
    if (!y) { setPlanInfo({ status: "idle", id: "", year: "" }); return }
    let alive = true
    setPlanInfo({ status: "loading", id: "", year: y })
    apiAuth(`/unit-prices/${encodeURIComponent(y)}/plan`)
      .then((r) => {
        if (!alive) return
        const id = r?.exists && r?.plan?.id != null ? String(r.plan.id) : ""
        setPlanInfo({ status: id ? "ready" : "missing", id, year: y })
      })
      .catch((err) => alive && setPlanInfo({ status: err?.status === 404 ? "missing" : "error", id: "", year: y }))
    return () => { alive = false }
  }, [filters.planYear])
  // plan_id ที่ส่งจริง: จากปีที่เลือก (ถ้ามี) ไม่งั้นจากลิงก์ ?plan_id=
  const effectivePlanId = filters.planYear ? planInfo.id : filters.planId

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
      if (field === "planId") {
        if (!filters.planYear && !filters.planId) e.planId = "กรุณาเลือกปีแผนงาน"
        else if (filters.planYear && planInfo.status === "loading") e.planId = "กำลังตรวจแผนงาน รอสักครู่"
        else if (filters.planYear && planInfo.status === "missing") e.planId = `ยังไม่มีแผนงานปี ${filters.planYear}`
        else if (filters.planYear && planInfo.status === "error") e.planId = "ตรวจแผนงานไม่สำเร็จ ลองเลือกปีใหม่"
        continue
      }
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

    // ปี พ.ศ. / เดือน (HR)
    if (report.require.includes("month") && !(Number(filters.month) >= 1 && Number(filters.month) <= 12)) e.month = "เลือกเดือน"
    for (const f of ["yearBE", "fiscalYear"]) {
      const wanted = report.require.includes(f) || (report.optional || []).includes(f)
      if (wanted && String(filters[f] || "").trim() && !/^25\d{2}$/.test(String(filters[f]).trim())) e[f] = "ปี พ.ศ. 4 หลัก เช่น 2569"
    }
    for (const f of ["employeeId", "loanId"]) {
      if (report.require.includes(f) && String(filters[f] || "").trim() && !/^\d+$/.test(String(filters[f]).trim())) e[f] = "ตัวเลขเท่านั้น"
    }

    setErrors(e)
    return e
  }

  /** ---------- Map ฟิลด์ → QueryString ---------- */
  const buildParams = (report) => {
    const p = new URLSearchParams()

    const wants = (field) =>
      (report?.require || []).includes(field) || (report?.optional || []).includes(field)

    // HR ใช้ from_date/to_date (P-reports ใช้ start_date/end_date)
    const isHr = report?.type === "hr_pdf"
    if (wants("startDate") && filters.startDate) p.set(isHr ? "from_date" : "start_date", filters.startDate)
    if (wants("endDate") && filters.endDate) p.set(isHr ? "to_date" : "end_date", filters.endDate)

    if (wants("planId") && effectivePlanId) p.set("plan_id", effectivePlanId)

    if (wants("month") && filters.month) p.set("month", String(Number(filters.month)))
    if (wants("yearBE") && String(filters.yearBE).trim()) p.set("year", String(filters.yearBE).trim())
    if (wants("fiscalYear") && String(filters.fiscalYear).trim()) p.set("fiscal_year", String(filters.fiscalYear).trim())
    if (wants("exitType") && filters.exitType) p.set("exit_type", filters.exitType)
    if (wants("showSensitive") && filters.showSensitive) p.set("show_sensitive", "true")
    if (wants("speciesLike") && String(filters.speciesLike || "").trim()) p.set("species_like", String(filters.speciesLike).trim())
    // หลายค่า = ซ้ำ key (spec_id=6&spec_id=5) — comma list ได้ 422
    if (wants("specIds")) for (const n of parseCsvInts(filters.specIds)) p.append("spec_id", String(n))

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

    return p
  }

  /** ---------- Download / Preview / Print ---------- */
  const doDownload = async (report) => {
    const errs = validate(report)
    if (Object.keys(errs).length) return

    const isPdf = isPdfType(report.type)
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
        if (report.type !== "hr_pdf") params.set("preview", "false")

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
      planYear: "",
      planId: "",
      specIds: "",
      month: String(new Date().getMonth() + 1),
      yearBE: String(new Date().getFullYear() + 543),
      fiscalYear: String(currentFiscalYearBE()),
      employeeId: "",
      loanId: "",
      exitType: "",
      showSensitive: false,
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
        value={filters.planYear}
        onChange={(v) => { setFilter("planYear", v); setErrors((e) => ({ ...e, planId: undefined })) }}
        placeholder="— เลือกปี —"
        error={!!errors.planId}
        title="ปีแผนงาน"
      />
      <FieldError name="planId" />
      {!errors.planId && planInfo.status === "loading" && <p className={helpTextCls}>กำลังตรวจแผนงานปี {planInfo.year}…</p>}
      {!errors.planId && planInfo.status === "missing" && <p className={errorTextCls}>ยังไม่มีแผนงานปี {planInfo.year}</p>}
      {!errors.planId && planInfo.status === "error" && <p className={errorTextCls}>ตรวจแผนงานไม่สำเร็จ ลองเลือกปีใหม่</p>}
    </div>
  )

  /** หลายสเปค (P20–P26): เลือกจากรายการแล้วแสดงเป็นชิป — ส่ง spec_id ซ้ำ key */
  const FormSpecMulti = ({ note }) => {
    const picked = parseCsvInts(filters.specIds)
    const labelOf = (id) => specOptions.find((o) => String(o.id) === String(id))?.label || `สเปค #${id}`
    return (
      <div className="md:col-span-3">
        <label className={labelCls}>รายการสินค้า (เลือกได้หลายรายการ · ไม่บังคับ)</label>
        <ComboBox
          options={specOptions.filter((o) => !picked.includes(Number(o.id)))}
          value=""
          onChange={(v) => v && setFilter("specIds", toggleCsvId(filters.specIds, v))}
          placeholder={loadingSpecs ? "— กำลังโหลด… —" : "— เพิ่มรายการสินค้า —"}
          loading={loadingSpecs}
          searchable
          title="รายการสินค้า"
        />
        {picked.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-2">
            {picked.map((id) => (
              <button
                key={id}
                type="button"
                onClick={() => setFilter("specIds", toggleCsvId(filters.specIds, id))}
                className="rounded-full border border-emerald-500 bg-emerald-50 px-3 py-1 text-sm text-emerald-700 transition hover:bg-emerald-100 dark:border-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-200"
                aria-label={`เอา ${labelOf(id)} ออก`}
              >
                {labelOf(id)} ✕
              </button>
            ))}
            <button type="button" onClick={() => setFilter("specIds", "")} className="rounded-full border border-slate-200 bg-white px-3 py-1 text-sm text-slate-700 hover:bg-slate-50 dark:border-slate-600 dark:bg-slate-700/50 dark:text-slate-100">
              ล้าง
            </button>
          </div>
        )}
        <p className={helpTextCls}>{note || "ไม่เลือก = ทุกสินค้า"}</p>
      </div>
    )
  }

  const FormSpecOnly = ({ requiredSpec = false, note }) => (
    <div>
      <label className={labelCls}>
        รายการสำเร็จรูป{requiredSpec && <span className="text-red-500"> *</span>}
      </label>

      {specOptions.length > 0 ? (
        <ComboBox
          options={withEmpty(specOptions, loadingSpecs ? "— กำลังโหลด… —" : requiredSpec ? "— เลือก —" : "— ทุกสินค้า —")}
          searchable
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
      {note && <p className={helpTextCls}>{note}</p>}
      {specOptions.length === 0 && !loadingSpecs && (
        <p className={helpTextCls}>รายการไม่ขึ้น พิมพ์รหัสสเปคเป็นตัวเลขแทนได้</p>
      )}
    </div>
  )

  const FormBranchKlang = ({ requireBranch = false, showKlang = true, allBranches = false }) => (
    <>
      <div>
        <label className={labelCls}>
          สาขา{requireBranch && <span className="text-red-500"> *</span>}
        </label>

        {branchOptions.length > 0 ? (
          <ComboBox
            options={withEmpty(branchOptions, allBranches && !branchLock.locked ? "— ทุกสาขา —" : "— เลือก —")}
            value={filters.branchId}
            onChange={(v) => setFilter("branchId", v)}
            placeholder={allBranches && !branchLock.locked ? "— ทุกสาขา —" : "— เลือก —"}
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
        {branchLock.locked ? <BranchLockNote /> : allBranches && !filters.branchId && <p className={helpTextCls}>ไม่เลือก = ทุกสาขา</p>}
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

    if (report.type === "phase1_pdf") {
      const req = report.require || []
      const opt = report.optional || []

      const hasDates = req.includes("startDate") || req.includes("endDate")
      const hasBranch = req.includes("branchId") || opt.includes("branchId")
      const requireBranch = req.includes("branchId")
      const hasMember = req.includes("memberId") || opt.includes("memberId") || req.includes("assoId") || opt.includes("assoId")
      const hasKlangIds = req.includes("klangIds") || opt.includes("klangIds")
      const hasSpec = req.includes("specId") || opt.includes("specId")
      const hasSpecs = opt.includes("specIds")
      const hasKlang = req.includes("klangId") || opt.includes("klangId")
      const hasSpeciesLike = opt.includes("speciesLike")

      return (
        <>
          {report.scopeNote && (
            <p className="mb-3 inline-flex rounded-xl bg-sky-50 px-3 py-1.5 text-sm text-sky-800 ring-1 ring-sky-200 dark:bg-sky-500/10 dark:text-sky-200 dark:ring-sky-500/30">
              {report.scopeNote}
            </p>
          )}
          <div className="grid gap-4 md:grid-cols-3">
            {hasDates && <FormDates report={report} />}
            {hasBranch && <FormBranchKlang requireBranch={requireBranch} showKlang={hasKlang} allBranches={!!report.allBranchesOption} />}
            {hasSpec && <FormSpecOnly requiredSpec={req.includes("specId")} note={report.specNote} />}
            {hasSpeciesLike && (
              <div>
                <label className={labelCls}>ชื่อพันธุ์ข้าว (ไม่บังคับ)</label>
                <input className={baseField} placeholder="เช่น มะลิ" value={filters.speciesLike} onChange={(e) => setFilter("speciesLike", e.target.value)} />
              </div>
            )}
            {hasSpecs && <FormSpecMulti note={report.specNote} />}
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

    if (report.type === "hr_pdf") {
      const req = report.require || []
      const opt = report.optional || []
      const has = (f) => req.includes(f) || opt.includes(f)
      const star = (f) => (req.includes(f) ? <span className="text-red-500"> *</span> : null)
      return (
        <>
          <div className="grid gap-4 md:grid-cols-3">
            {has("month") && (
              <div>
                <label className={labelCls}>เดือน{star("month")}</label>
                <ComboBox options={THAI_MONTH_OPTIONS} value={filters.month} onChange={(v) => setFilter("month", v)} title="เดือน" error={!!errors.month} />
                <FieldError name="month" />
              </div>
            )}
            {has("yearBE") && (
              <div>
                <label className={labelCls}>ปี (พ.ศ.){star("yearBE")}</label>
                <input inputMode="numeric" maxLength={4} className={cx(baseField, "tabular-nums", errors.yearBE && "border-red-400 ring-2 ring-red-300/70")} value={filters.yearBE} onChange={(e) => setFilter("yearBE", e.target.value.replace(/\D/g, ""))} placeholder="เช่น 2569" />
                <FieldError name="yearBE" />
              </div>
            )}
            {has("fiscalYear") && (
              <div>
                <label className={labelCls}>ปีงบประมาณ (พ.ศ.){star("fiscalYear")}</label>
                <input inputMode="numeric" maxLength={4} className={cx(baseField, "tabular-nums", errors.fiscalYear && "border-red-400 ring-2 ring-red-300/70")} value={filters.fiscalYear} onChange={(e) => setFilter("fiscalYear", e.target.value.replace(/\D/g, ""))} placeholder="เช่น 2569" />
                <FieldError name="fiscalYear" />
                <p className={helpTextCls}>1 เม.ย. – 31 มี.ค.{req.includes("fiscalYear") ? "" : " · เว้นว่าง = ปีปัจจุบัน"}</p>
              </div>
            )}
            {(has("startDate") || has("endDate")) && (
              <>
                <div>
                  <label className={labelCls}>ตั้งแต่วันที่{star("startDate")}</label>
                  <DateInput value={filters.startDate} onChange={(e) => setFilter("startDate", e.target.value)} error={!!errors.startDate} />
                  <FieldError name="startDate" />
                </div>
                <div>
                  <label className={labelCls}>ถึงวันที่{star("endDate")}</label>
                  <DateInput value={filters.endDate} onChange={(e) => setFilter("endDate", e.target.value)} error={!!errors.endDate} />
                  <FieldError name="endDate" />
                </div>
              </>
            )}
            {has("branchId") && <FormBranchKlang requireBranch={req.includes("branchId")} showKlang={false} allBranches={!!report.allBranchesOption} />}
            {has("exitType") && (
              <div>
                <label className={labelCls}>ประเภทการพ้นสภาพ</label>
                <ComboBox options={EXIT_TYPE_OPTIONS} value={filters.exitType} onChange={(v) => setFilter("exitType", v)} title="ประเภทการพ้นสภาพ" />
              </div>
            )}
            {has("employeeId") && (
              <div>
                <label className={labelCls}>รหัสพนักงาน{star("employeeId")}</label>
                <input inputMode="numeric" className={cx(baseField, "tabular-nums", errors.employeeId && "border-red-400 ring-2 ring-red-300/70")} value={filters.employeeId} onChange={(e) => setFilter("employeeId", e.target.value.trim())} placeholder="เช่น 610400001" />
                <FieldError name="employeeId" />
              </div>
            )}
            {has("loanId") && (
              <div>
                <label className={labelCls}>เลขที่สัญญาเงินกู้{star("loanId")}</label>
                <input inputMode="numeric" className={cx(baseField, "tabular-nums", errors.loanId && "border-red-400 ring-2 ring-red-300/70")} value={filters.loanId} onChange={(e) => setFilter("loanId", e.target.value.trim())} placeholder="รหัสสัญญา (ตัวเลข)" />
                <FieldError name="loanId" />
              </div>
            )}
            {has("showSensitive") && (
              <label className="flex items-center gap-2 self-end pb-3 text-sm text-slate-700 dark:text-slate-200">
                <input type="checkbox" className="size-4 accent-indigo-600" checked={!!filters.showSensitive} onChange={(e) => setFilter("showSensitive", e.target.checked)} />
                แสดงเลขบัตร/บัญชีธนาคารเต็ม
              </label>
            )}
          </div>
          <p className={helpTextCls}>
            กดปุ่ม <span className="font-semibold">🖨️</span> เพื่อเปิด PDF{report.xlsx ? " หรือดาวน์โหลด Excel" : ""}
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

            {/* กล่อง: รายงาน Excel ซื้อขาย P20–P26 (สิทธิ์ order.reports) */}
            {allowedTradeReports().length > 0 && (
            <div className="flex flex-col rounded-2xl border border-emerald-200 bg-emerald-50/40 p-6 shadow-sm dark:border-emerald-800/50 dark:bg-emerald-900/10 transition-all hover:shadow-md">
              <div className="mb-4 flex items-center gap-3">
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-emerald-600 dark:bg-emerald-900/50 dark:text-emerald-400">
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8l-6-6zm-1 7V3.5L18.5 9H13zM8 13h2l1 2 1-2h2l-2 3 2 3h-2l-1-2-1 2H8l2-3-2-3z"/>
                  </svg>
                </div>
                <h2 className="text-xl font-bold text-emerald-800 dark:text-emerald-300">รายงานซื้อขาย (Excel)</h2>
              </div>
              <p className="mb-6 text-sm text-emerald-700/80 dark:text-emerald-400/80">
                ทะเบียนคุมสาขา ซื้อ-ขายแยกราคา ทะเบียนรับซื้อ รายงานซื้อ/ขายรายวัน สรุปรับซื้อจากสมาชิก (P20–P27) ได้ทั้ง Excel และ PDF
              </p>
              <div className="mt-auto">
                <ComboBox
                  options={allowedTradeReports().map((r) => ({ ...r, id: r.key, label: r.title }))}
                  placeholder="คลิกเพื่อเลือกรายงาน..."
                  title="รายงานซื้อขาย (Excel)"
                  value={null}
                  onChange={(v) => { setMode("trade"); setActiveReport(v); setPreviewJson(null); setErrors({}) }}
                />
              </div>
            </div>
            )}

            {/* กล่อง: รายงานฝ่ายบุคคล (สิทธิ์ report.hr.*) */}
            {allowedHrReports().length > 0 && (
            <div className="flex flex-col rounded-2xl border border-rose-200 bg-rose-50/40 p-6 shadow-sm dark:border-rose-800/50 dark:bg-rose-900/10 transition-all hover:shadow-md">
              <div className="mb-4 flex items-center gap-3">
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-rose-100 text-rose-600 dark:bg-rose-900/50 dark:text-rose-400">
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                    <path d="M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"/>
                  </svg>
                </div>
                <h2 className="text-xl font-bold text-rose-800 dark:text-rose-300">รายงานฝ่ายบุคคล</h2>
              </div>
              <p className="mb-6 text-sm text-rose-700/80 dark:text-rose-400/80">
                เงินเดือน ประกันสังคม วันลา ทะเบียนพนักงาน การโยกย้าย เงินกู้ และ KPI (PDF / Excel)
              </p>
              <div className="mt-auto">
                <ComboBox
                  options={allowedHrReports().map((r) => ({ ...r, id: r.key, label: r.title }))}
                  placeholder="คลิกเพื่อเลือกรายงาน..."
                  title="รายงานฝ่ายบุคคล"
                  searchable
                  value={null}
                  onChange={(v) => { setMode("hr"); setActiveReport(v); setPreviewJson(null); setErrors({}) }}
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
                ) : isPdfType(reportObj.type) ? (
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