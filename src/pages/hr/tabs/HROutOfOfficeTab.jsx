// src/pages/hr/tabs/HROutOfOfficeTab.jsx
// 3O ขอออกนอกสถานที่ — ฝั่ง HR / ผู้อนุมัติ
//   (a) รายการคำขอ + อนุมัติ/ไม่อนุมัติ ตามขั้น   (b) สรุปรายสาขา   (c) ตั้งค่า
// Spec: handoff/api-handoff-payment-2.md §1 (approval chain) + §2 (3O)
// Used by the HR dashboard tab and by /out-of-office/approvals (roles 2/6/7).
import { Fragment, useCallback, useEffect, useMemo, useState } from "react"
import { apiAuth } from "../../../lib/api"
import { can } from "../../../lib/permissions"
import {
  OOO_TYPE_LABEL,
  STATUS,
  STATUS_LABEL,
  hhmm,
} from "../../../lib/approval"
import { KIND, requestNotificationsRefresh } from "../../../lib/approvalActions"
import DecisionModal from "../../../components/DecisionModal"
import LeaveStageActions from "../../../components/LeaveStageActions"
import ApprovalHistory from "../../../components/ApprovalHistory"
import OOOWorkDetails from "../../../components/OOOWorkDetails"
import { StageBadge, JustificationBadge } from "../../../components/ApprovalBadges"
import SelectDropdown from "../../../components/SelectDropdown"
import BranchLockNote from "../../../components/BranchLockNote"
import useBranchLock, { scopedBranchId } from "../../../hooks/useBranchLock"
import { Skeleton, ErrorState, EmptyState, Tabs, tabId, panelId, useSubTab } from "../../../components/ui"
import { cx, baseField, tabPanelCls } from "../../../lib/styles"

// ─── helpers ────────────────────────────────────────────────────────────────
const THAI_MONTHS = [
  "มกราคม", "กุมภาพันธ์", "มีนาคม", "เมษายน", "พฤษภาคม", "มิถุนายน",
  "กรกฎาคม", "สิงหาคม", "กันยายน", "ตุลาคม", "พฤศจิกายน", "ธันวาคม",
]
const THAI_MONTHS_SHORT = [
  "ม.ค.", "ก.พ.", "มี.ค.", "เม.ย.", "พ.ค.", "มิ.ย.",
  "ก.ค.", "ส.ค.", "ก.ย.", "ต.ค.", "พ.ย.", "ธ.ค.",
]
const TYPE_SHORT = { work: "ปฏิบัติงาน", personal: "ธุระส่วนตัว" }

/** "2026-11-02" → "2 พ.ย. 2569" (no timezone shift) */
function fmtThaiShort(iso) {
  if (typeof iso !== "string") return "—"
  const [y, m, d] = iso.slice(0, 10).split("-").map(Number)
  if (!y || !m || !d) return "—"
  return `${d} ${THAI_MONTHS_SHORT[m - 1]} ${y + 543}`
}

function toMin(t) {
  if (typeof t !== "string" || t.length < 4) return null
  const [h, m] = t.split(":").map(Number)
  return Number.isFinite(h) && Number.isFinite(m) ? h * 60 + m : null
}

/** Best-effort requester name — the 3O schema only guarantees user_id. */
function requesterName(r) {
  const full =
    r.full_name || r.user_full_name || r.requester_name ||
    [r.user_first_name || r.first_name, r.user_last_name || r.last_name].filter(Boolean).join(" ")
  return full || `พนักงานรหัส ${r.user_id}`
}

const yearOptionsFor = () => {
  const y = new Date().getFullYear()
  return [y + 1, y, y - 1, y - 2].map((v) => ({ value: String(v), label: `พ.ศ. ${v + 543}` }))
}

// ─── shared styles ──────────────────────────────────────────────────────────
const inputCls = cx(baseField, "!rounded-lg !px-3 !py-2 md:!text-sm disabled:cursor-not-allowed disabled:opacity-60")
const inputErrCls = "!border-red-400 dark:!border-red-500 focus:!ring-red-400"
const cardCls =
  "rounded-2xl bg-white dark:bg-gray-800 shadow-sm ring-1 ring-gray-200/70 dark:ring-gray-700/70"
const labelCls = "text-xs font-medium text-gray-600 dark:text-gray-400"
const focusRing =
  "focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-1 dark:focus-visible:ring-offset-gray-800"
const thCls =
  "px-3 py-2.5 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 whitespace-nowrap"
const tdCls = "px-3 py-3 align-top text-sm text-gray-800 dark:text-gray-200"

function Spinner() {
  return <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white" aria-hidden="true" />
}

// ═══════════════════════════════════════════════════════════════════════════
// (a) รายการคำขอ
// ═══════════════════════════════════════════════════════════════════════════
const STATUS_FILTER_OPTIONS = [
  { value: "", label: "ทุกสถานะ" },
  ...Object.values(STATUS).map((s) => ({ value: s, label: STATUS_LABEL[s] })),
]

function RequestsPanel({ branchOptions, branchName }) {
  // ตัวกรองสาขา: scope "own_branch" → ล็อกที่สาขาที่ใช้งานอยู่
  const branchLock = useBranchLock()

  // mine = เฉพาะรายการที่ฉันดำเนินการได้ตอนนี้ (?mine=true) — api-handoff-4 §1
  const [filters, setFilters] = useState({ status: "", branch_id: branchLock.activeKey, from_date: "", to_date: "", mine: "" })
  useEffect(() => {
    if (!branchLock.locked) return
    setFilters((f) => (f.branch_id === branchLock.activeKey ? f : { ...f, branch_id: branchLock.activeKey }))
  }, [branchLock.locked, branchLock.activeKey])
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [banner, setBanner] = useState(null) // { tone: "error" | "success", text }
  const [decision, setDecision] = useState(null) // { req, mode }
  const [historyId, setHistoryId] = useState(null)

  const fetchRows = useCallback(() => {
    setLoading(true)
    setError("")
    const qs = new URLSearchParams()
    Object.entries({ ...filters, branch_id: scopedBranchId(filters.branch_id) }).forEach(([k, v]) => { if (v) qs.set(k, v) })
    const q = qs.toString()
    apiAuth(`/hr/out-of-office${q ? `?${q}` : ""}`)
      .then((data) => setRows(Array.isArray(data) ? data : []))
      .catch((e) => setError(e.message || "โหลดรายการไม่สำเร็จ"))
      .finally(() => setLoading(false))
  }, [filters])

  useEffect(() => { fetchRows() }, [fetchRows])

  useEffect(() => {
    if (banner?.tone !== "success") return
    const t = setTimeout(() => setBanner(null), 4000)
    return () => clearTimeout(t)
  }, [banner])

  const setFilter = (k) => (v) => {
    const val = v?.target ? v.target.value : v
    setFilters((f) => ({ ...f, [k]: val }))
  }
  const dateRangeInvalid = filters.from_date && filters.to_date && filters.to_date < filters.from_date
  const hasFilters = Object.entries(filters).some(([k, v]) => Boolean(v) && !(k === "branch_id" && branchLock.locked))

  const onDecisionDone = (mode) => {
    const req = decision.req
    setDecision(null)
    const text = {
      approve: `อนุมัติคำขอของ ${requesterName(req)} แล้ว`,
      reject: `ไม่อนุมัติคำขอของ ${requesterName(req)} แล้ว`,
      justified: `บันทึกผลตรวจ "สมเหตุสมผล" ของ ${requesterName(req)} แล้ว`,
      unjust: `บันทึกผลตรวจ "ไม่สมเหตุสมผล" ของ ${requesterName(req)} แล้ว`,
    }[mode]
    setBanner({ tone: "success", text })
    requestNotificationsRefresh()
    fetchRows()
  }
  const onDecisionConflict = (err) => {
    setDecision(null)
    setBanner({ tone: "error", text: err?.message || "ดำเนินการไม่สำเร็จ" })
    fetchRows()
  }

  const toggleHistory = (id) => setHistoryId((cur) => (cur === id ? null : id))
  const historyBtn = (r) => (
    <button
      type="button"
      onClick={() => toggleHistory(r.id)}
      aria-expanded={historyId === r.id}
      className={`rounded-lg px-2 py-1 text-xs font-medium text-indigo-600 dark:text-indigo-400 hover:underline cursor-pointer ${focusRing} focus-visible:ring-indigo-500`}
    >
      {historyId === r.id ? "ซ่อนประวัติ" : "ประวัติ"}
    </button>
  )
  const renderActions = (r, full = false) => (
    <div className={`flex flex-wrap items-center gap-2 ${full ? "" : "justify-end"}`}>
      <LeaveStageActions req={r} kind={KIND.OOO} onDecide={(req, mode) => setDecision({ req, mode })} hideReason />
      {historyBtn(r)}
    </div>
  )

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className={`${cardCls} p-4`}>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-[repeat(4,minmax(0,1fr))_auto] items-end">
          <div className="flex flex-col gap-1">
            <span className={labelCls}>สถานะ</span>
            <SelectDropdown options={STATUS_FILTER_OPTIONS} value={filters.status} onChange={setFilter("status")} placeholder="ทุกสถานะ" />
          </div>
          <div className="flex flex-col gap-1">
            <span className={labelCls}>สาขา</span>
            <SelectDropdown
              options={[{ value: "", label: "ทุกสาขา" }, ...branchOptions]}
              value={filters.branch_id}
              onChange={setFilter("branch_id")}
              placeholder="ทุกสาขา"
              disabled={branchLock.locked}
            />
            {branchLock.locked && <BranchLockNote className="mt-0" />}
          </div>
          <div className="flex flex-col gap-1">
            <label htmlFor="ooo-f-from" className={labelCls}>ตั้งแต่วันที่</label>
            <input id="ooo-f-from" type="date" className={inputCls} value={filters.from_date} onChange={setFilter("from_date")} />
          </div>
          <div className="flex flex-col gap-1">
            <label htmlFor="ooo-f-to" className={labelCls}>ถึงวันที่</label>
            <input
              id="ooo-f-to"
              type="date"
              className={`${inputCls} ${dateRangeInvalid ? inputErrCls : ""}`}
              value={filters.to_date}
              min={filters.from_date || undefined}
              onChange={setFilter("to_date")}
              aria-invalid={dateRangeInvalid || undefined}
            />
          </div>
          <button
            type="button"
            disabled={!hasFilters}
            onClick={() => setFilters({ status: "", branch_id: branchLock.activeKey, from_date: "", to_date: "", mine: "" })}
            className={`h-10 rounded-lg px-3 text-sm font-medium text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors duration-200 cursor-pointer ${focusRing} focus-visible:ring-indigo-500`}
          >
            ล้างตัวกรอง
          </button>
        </div>
        {dateRangeInvalid && (
          <p className="mt-2 text-xs text-red-600 dark:text-red-400">วันที่สิ้นสุดต้องไม่ก่อนวันที่เริ่ม</p>
        )}
        <label className="mt-3 flex w-fit cursor-pointer items-center gap-2 text-sm text-gray-700 select-none dark:text-gray-200">
          <input
            type="checkbox"
            className="size-4 accent-indigo-600"
            checked={filters.mine === "true"}
            onChange={(e) => setFilters((f) => ({ ...f, mine: e.target.checked ? "true" : "" }))}
          />
          แสดงเฉพาะรายการที่รอฉันอนุมัติ/ตรวจสอบ
        </label>
      </div>

      {banner && (
        <div
          role={banner.tone === "error" ? "alert" : "status"}
          className={`flex items-start justify-between gap-3 rounded-xl px-4 py-3 text-sm ${
            banner.tone === "error"
              ? "bg-red-50 text-red-700 ring-1 ring-red-200 dark:bg-red-900/20 dark:text-red-300 dark:ring-red-800/60"
              : "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200 dark:bg-emerald-900/20 dark:text-emerald-300 dark:ring-emerald-800/60"
          }`}
        >
          <span>{banner.text}</span>
          <button
            type="button"
            onClick={() => setBanner(null)}
            aria-label="ปิดข้อความ"
            className={`shrink-0 rounded p-0.5 opacity-70 hover:opacity-100 cursor-pointer ${focusRing} focus-visible:ring-indigo-500`}
          >
            <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" className="size-4">
              <path d="M18 6 6 18M6 6l12 12" />
            </svg>
          </button>
        </div>
      )}

      {error && <ErrorState message={error} onRetry={fetchRows} />}

      {loading ? (
        <div className={`${cardCls} p-4 space-y-3`} aria-busy="true" aria-label="กำลังโหลดรายการ">
          {[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-12" />)}
        </div>
      ) : error ? null : rows.length === 0 ? (
        <div className={cardCls}>
          <EmptyState
            title={filters.mine ? "ไม่มีคำขอรอคุณอนุมัติหรือตรวจสอบ" : "ไม่พบคำขอตามตัวกรอง"}
            description={hasFilters ? "ลองเปลี่ยนสถานะ สาขา หรือช่วงวันที่" : "เมื่อมีพนักงานยื่นคำขอออกนอกสถานที่ รายการจะแสดงที่นี่"}
          />
        </div>
      ) : (
        <>
          <p className="text-sm text-gray-500 dark:text-gray-400 tabular-nums">{rows.length} รายการ</p>

          {/* Mobile: cards */}
          <ul className="space-y-3 md:hidden">
            {rows.map((r) => (
              <li key={r.id} className={`${cardCls} p-4 space-y-2`}>
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="font-semibold text-gray-900 dark:text-gray-100 break-words">{requesterName(r)}</p>
                    <p className="text-xs text-gray-500 dark:text-gray-400">{branchName(r.branch_id) || "ไม่ระบุสาขา"}</p>
                  </div>
                  <div className="flex flex-col items-end gap-1">
                    <StageBadge req={r} />
                    <JustificationBadge req={r} />
                  </div>
                </div>
                <p className="text-sm text-gray-800 dark:text-gray-200 tabular-nums">
                  {fmtThaiShort(r.request_date)} · {hhmm(r.time_out)}–{hhmm(r.time_back)} น.
                  <span className="text-gray-500 dark:text-gray-400"> · {TYPE_SHORT[r.request_type] || r.request_type}</span>
                </p>
                <p className="text-sm text-gray-700 dark:text-gray-300 break-words">{r.place}</p>
                <p className="text-sm text-gray-500 dark:text-gray-400 break-words">{r.reason}</p>
                <OOOWorkDetails req={r} compact />
                {r.reject_reason && (
                  <p className="rounded-lg bg-rose-50 dark:bg-rose-900/20 px-3 py-1.5 text-sm text-rose-700 dark:text-rose-300 break-words">
                    เหตุผลที่ไม่อนุมัติ: {r.reject_reason}
                  </p>
                )}
                {r.justification_note && (
                  <p className="text-xs text-gray-600 dark:text-gray-300 break-words">หมายเหตุผลตรวจ: {r.justification_note}</p>
                )}
                {renderActions(r, true)}
                {historyId === r.id && <ApprovalHistory kind={KIND.OOO} id={r.id} req={r} className="rounded-xl bg-gray-50 p-3 dark:bg-gray-700/40" />}
              </li>
            ))}
          </ul>

          {/* Desktop: table */}
          <div className={`${cardCls} hidden md:block overflow-x-auto`}>
            <table className="w-full min-w-[860px]">
              <thead className="border-b border-gray-200 dark:border-gray-700 bg-gray-50/80 dark:bg-gray-800">
                <tr>
                  <th scope="col" className={thCls}>ผู้ขอ</th>
                  <th scope="col" className={thCls}>วันเวลา</th>
                  <th scope="col" className={thCls}>ประเภท</th>
                  <th scope="col" className={thCls}>สถานที่ / เหตุผล</th>
                  <th scope="col" className={thCls}>สถานะ/ขั้นตอน · ผลตรวจสอบ</th>
                  <th scope="col" className={`${thCls} text-right`}><span className="sr-only">การดำเนินการ</span></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-700/70">
                {rows.map((r) => (
                  <Fragment key={r.id}>
                  <tr className="even:bg-gray-50 dark:even:bg-gray-700/30">
                    <td className={`${tdCls} max-w-[200px]`}>
                      <p className="font-medium text-gray-900 dark:text-gray-100 break-words">{requesterName(r)}</p>
                      <p className="text-xs text-gray-500 dark:text-gray-400">{branchName(r.branch_id) || "ไม่ระบุสาขา"}</p>
                    </td>
                    <td className={`${tdCls} whitespace-nowrap tabular-nums`}>
                      <p>{fmtThaiShort(r.request_date)}</p>
                      <p className="text-xs text-gray-500 dark:text-gray-400">{hhmm(r.time_out)}–{hhmm(r.time_back)} น.</p>
                    </td>
                    <td className={`${tdCls} whitespace-nowrap`} title={OOO_TYPE_LABEL[r.request_type]}>
                      {TYPE_SHORT[r.request_type] || r.request_type}
                    </td>
                    <td className={`${tdCls} max-w-[320px]`}>
                      <p className="break-words">{r.place}</p>
                      <p className="text-xs text-gray-500 dark:text-gray-400 break-words line-clamp-2" title={r.reason}>{r.reason}</p>
                      <OOOWorkDetails req={r} compact className="mt-1.5" />
                    </td>
                    <td className={`${tdCls} max-w-[220px]`}>
                      <div className="flex flex-wrap gap-1">
                        <StageBadge req={r} />
                        <JustificationBadge req={r} />
                      </div>
                      {r.justification_note && (
                        <p className="mt-1 text-xs text-gray-600 dark:text-gray-300 break-words">หมายเหตุผลตรวจ: {r.justification_note}</p>
                      )}
                      {r.reject_reason && (
                        <p className="mt-1 text-xs text-rose-700 dark:text-rose-300 break-words">เหตุผล: {r.reject_reason}</p>
                      )}
                    </td>
                    <td className={`${tdCls} text-right`}>
                      {renderActions(r)}
                    </td>
                  </tr>
                  {historyId === r.id && (
                    <tr>
                      <td colSpan={6} className="px-3 pb-4">
                        <ApprovalHistory kind={KIND.OOO} id={r.id} req={r} className="rounded-xl bg-gray-50 p-4 dark:bg-gray-700/40" />
                      </td>
                    </tr>
                  )}
                  </Fragment>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      {decision && (
        <DecisionModal
          mode={decision.mode}
          kind={KIND.OOO}
          req={decision.req}
          title={`${requesterName(decision.req)} — ${OOO_TYPE_LABEL[decision.req.request_type] || "ขอออกนอกสถานที่"}`}
          summary={`${fmtThaiShort(decision.req.request_date)} ${hhmm(decision.req.time_out)}–${hhmm(decision.req.time_back)} น. · ${decision.req.place || ""}`}
          onClose={() => setDecision(null)}
          onDone={onDecisionDone}
          onConflict={onDecisionConflict}
        />
      )}
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════════════
// (b) สรุปรายสาขา
// ═══════════════════════════════════════════════════════════════════════════
function SummaryPanel({ branchName }) {
  const [year, setYear] = useState(() => String(new Date().getFullYear()))
  const [month, setMonth] = useState(() => String(new Date().getMonth() + 1))
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")

  const yearOptions = useMemo(yearOptionsFor, [])
  const monthOptions = useMemo(() => THAI_MONTHS.map((m, i) => ({ value: String(i + 1), label: m })), [])

  const fetchSummary = useCallback(() => {
    setLoading(true)
    setError("")
    apiAuth(`/hr/out-of-office/summary?year=${year}&month=${month}`)
      .then((data) => setRows(Array.isArray(data) ? data : []))
      .catch((e) => setError(e.message || "โหลดสรุปไม่สำเร็จ"))
      .finally(() => setLoading(false))
  }, [year, month])

  useEffect(() => { fetchSummary() }, [fetchSummary])

  const totals = useMemo(
    () => rows.reduce((t, r) => ({ work: t.work + (Number(r.work) || 0), personal: t.personal + (Number(r.personal) || 0) }), { work: 0, personal: 0 }),
    [rows],
  )
  const numCls = `${tdCls} text-right tabular-nums`
  const period = `${THAI_MONTHS[Number(month) - 1]} ${Number(year) + 543}`

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <p className="text-sm text-gray-600 dark:text-gray-400">
          จำนวนคำขอที่<span className="font-medium text-gray-800 dark:text-gray-200">อนุมัติแล้ว</span> แยกตามสาขา เดือน{period}
        </p>
        <div className="flex gap-2">
          <div className="w-36"><SelectDropdown options={monthOptions} value={month} onChange={setMonth} placeholder="เดือน" /></div>
          <div className="w-32"><SelectDropdown options={yearOptions} value={year} onChange={setYear} placeholder="ปี" /></div>
        </div>
      </div>

      {error && <ErrorState message={error} onRetry={fetchSummary} />}

      {loading ? (
        <div className={`${cardCls} p-4 space-y-3`} aria-busy="true" aria-label="กำลังโหลดสรุป">
          {[0, 1, 2].map((i) => <Skeleton key={i} className="h-9" />)}
        </div>
      ) : error ? null : rows.length === 0 ? (
        <div className={cardCls}>
          <EmptyState title="ยังไม่มีคำขอที่อนุมัติ" description={`ไม่มีการออกนอกสถานที่ที่อนุมัติแล้วในเดือน${period}`} />
        </div>
      ) : (
        <div className={`${cardCls} overflow-x-auto`}>
          <table className="w-full min-w-[480px]">
            <caption className="sr-only">สรุปการออกนอกสถานที่รายสาขา เดือน{period}</caption>
            <thead className="border-b border-gray-200 dark:border-gray-700 bg-gray-50/80 dark:bg-gray-800">
              <tr>
                <th scope="col" className={thCls}>สาขา</th>
                <th scope="col" className={`${thCls} text-right`}>ปฏิบัติงาน</th>
                <th scope="col" className={`${thCls} text-right`}>ธุระส่วนตัว</th>
                <th scope="col" className={`${thCls} text-right`}>รวม</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-700/70">
              {rows.map((r, i) => {
                const w = Number(r.work) || 0
                const p = Number(r.personal) || 0
                return (
                  <tr key={r.branch_id ?? `none-${i}`} className="even:bg-gray-50 dark:even:bg-gray-700/30">
                    <th scope="row" className={`${tdCls} text-left font-medium`}>
                      {r.branch_name || branchName(r.branch_id) || "ไม่ระบุสาขา"}
                    </th>
                    <td className={numCls}>{w}</td>
                    <td className={numCls}>{p}</td>
                    <td className={`${numCls} font-semibold text-gray-900 dark:text-gray-100`}>{w + p}</td>
                  </tr>
                )
              })}
            </tbody>
            <tfoot className="border-t-2 border-gray-200 dark:border-gray-700">
              <tr>
                <th scope="row" className={`${tdCls} text-left font-semibold`}>รวมทุกสาขา</th>
                <td className={`${numCls} font-semibold`}>{totals.work}</td>
                <td className={`${numCls} font-semibold`}>{totals.personal}</td>
                <td className={`${numCls} font-bold text-indigo-700 dark:text-indigo-300`}>{totals.work + totals.personal}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      )}
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════════════
// (c) ตั้งค่า
// ═══════════════════════════════════════════════════════════════════════════
const toForm = (s) => ({
  work_start: hhmm(s?.work_start ?? ""),
  work_end: hhmm(s?.work_end ?? ""),
  half_day_hours: s?.half_day_hours != null ? String(s.half_day_hours) : "",
  min_notice_days: s?.min_notice_days != null ? String(s.min_notice_days) : "0",
  max_backdate_days: s?.max_backdate_days != null ? String(s.max_backdate_days) : "0",
  unlimited: s?.personal_monthly_limit == null,
  personal_monthly_limit: s?.personal_monthly_limit != null ? String(s.personal_monthly_limit) : "",
})

const fromForm = (f) => ({
  work_start: f.work_start,
  work_end: f.work_end,
  half_day_hours: Number(f.half_day_hours),
  min_notice_days: Number(f.min_notice_days),
  max_backdate_days: Number(f.max_backdate_days),
  personal_monthly_limit: f.unlimited ? null : Number(f.personal_monthly_limit),
})

function SettingsPanel() {
  const canEdit = can("hr.ooo.settings.edit")

  const [original, setOriginal] = useState(null)
  const [form, setForm] = useState(toForm(null))
  const [errors, setErrors] = useState({})
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState("")
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState("")
  const [saved, setSaved] = useState(false)

  const load = useCallback(() => {
    setLoading(true)
    setLoadError("")
    apiAuth("/hr/out-of-office/settings")
      .then((s) => { setOriginal(s || {}); setForm(toForm(s)) })
      .catch((e) => setLoadError(e.message || "โหลดการตั้งค่าไม่สำเร็จ"))
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => { load() }, [load])

  useEffect(() => {
    if (!saved) return
    const t = setTimeout(() => setSaved(false), 4000)
    return () => clearTimeout(t)
  }, [saved])

  const set = (k) => (e) => {
    const v = e.target.type === "checkbox" ? e.target.checked : e.target.value
    setForm((f) => ({ ...f, [k]: v }))
    setErrors((er) => ({ ...er, [k]: undefined, ...(k === "unlimited" ? { personal_monthly_limit: undefined } : {}) }))
    setSaveError("")
    setSaved(false)
  }

  const validate = () => {
    const er = {}
    const isInt = (v) => /^\d+$/.test(String(v).trim())
    if (!form.work_start) er.work_start = "กรุณาระบุเวลาเริ่มงาน"
    if (!form.work_end) er.work_end = "กรุณาระบุเวลาเลิกงาน"
    if (form.work_start && form.work_end && toMin(form.work_start) >= toMin(form.work_end)) {
      er.work_end = "เวลาเลิกงานต้องหลังเวลาเริ่มงาน"
    }
    const hd = Number(form.half_day_hours)
    if (form.half_day_hours === "" || !Number.isFinite(hd) || hd <= 0) er.half_day_hours = "ต้องมากกว่า 0"
    if (!isInt(form.min_notice_days)) er.min_notice_days = "ระบุเป็นจำนวนวันเต็ม (0 ขึ้นไป)"
    if (!isInt(form.max_backdate_days)) er.max_backdate_days = "ระบุเป็นจำนวนวันเต็ม (0 ขึ้นไป)"
    if (!form.unlimited && (!isInt(form.personal_monthly_limit) || Number(form.personal_monthly_limit) < 1)) {
      er.personal_monthly_limit = "ระบุจำนวนครั้งตั้งแต่ 1 ขึ้นไป หรือเลือกไม่จำกัด"
    }
    return er
  }

  const changes = useMemo(() => {
    if (!original) return {}
    const next = fromForm(form)
    const prev = fromForm(toForm(original))
    const diff = {}
    Object.keys(next).forEach((k) => {
      if (next[k] !== prev[k] && !(Number.isNaN(next[k]) && Number.isNaN(prev[k]))) diff[k] = next[k]
    })
    return diff
  }, [form, original])
  const dirty = Object.keys(changes).length > 0

  const handleSave = async (e) => {
    e.preventDefault()
    if (!canEdit) return
    const er = validate()
    setErrors(er)
    if (Object.keys(er).length) {
      const first = ["work_start", "work_end", "half_day_hours", "min_notice_days", "max_backdate_days", "personal_monthly_limit"].find((k) => er[k])
      document.getElementById(`ooo-s-${first}`)?.focus()
      return
    }
    if (!dirty) return
    setSaving(true)
    setSaveError("")
    try {
      const res = await apiAuth("/hr/out-of-office/settings", { method: "PATCH", body: changes })
      const next = res && typeof res === "object" && "work_start" in res ? res : { ...original, ...changes }
      setOriginal(next)
      setForm(toForm(next))
      setSaved(true)
    } catch (err) {
      setSaveError(err.message || "บันทึกไม่สำเร็จ")
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className={`${cardCls} p-5 space-y-4 max-w-2xl`} aria-busy="true" aria-label="กำลังโหลดการตั้งค่า">
        {[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-10" />)}
      </div>
    )
  }
  if (loadError) return <ErrorState message={loadError} onRetry={load} />

  const errP = (k) => ({
    id: `ooo-s-${k}`,
    disabled: !canEdit,
    "aria-invalid": errors[k] ? true : undefined,
    "aria-describedby": errors[k] ? `ooo-s-${k}-err` : `ooo-s-${k}-hint`,
    className: `${inputCls} tabular-nums ${errors[k] ? inputErrCls : ""}`,
  })
  const msg = (k, hint) =>
    errors[k]
      ? <p id={`ooo-s-${k}-err`} className="text-xs text-red-600 dark:text-red-400">{errors[k]}</p>
      : hint ? <p id={`ooo-s-${k}-hint`} className="text-xs text-gray-500 dark:text-gray-400">{hint}</p> : null

  return (
    <form onSubmit={handleSave} noValidate className="max-w-2xl space-y-4">
      <div className="rounded-xl bg-amber-50 dark:bg-amber-900/20 ring-1 ring-amber-200 dark:ring-amber-800/50 px-4 py-3 text-sm text-amber-800 dark:text-amber-200">
        ค่าตั้งต้นเหล่านี้ FRD กำหนดไว้ชั่วคราวและยังรอ AMC ยืนยัน ฝ่ายบุคคลแก้ไขให้ตรงระเบียบได้ที่หน้านี้
      </div>

      {!canEdit && (
        <p className="text-sm text-gray-500 dark:text-gray-400">
          คุณดูการตั้งค่าได้อย่างเดียว เฉพาะผู้ดูแลระบบและฝ่ายบุคคลที่แก้ไขได้
        </p>
      )}

      <fieldset className={`${cardCls} p-5 space-y-4`}>
        <legend className="sr-only">ช่วงเวลาทำงาน</legend>
        <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">เวลาทำงาน</h3>
        <div className="grid gap-4 sm:grid-cols-3">
          <div className="flex flex-col gap-1">
            <label htmlFor="ooo-s-work_start" className={labelCls}>เริ่มงาน (น.)</label>
            <input type="time" value={form.work_start} onChange={set("work_start")} {...errP("work_start")} />
            {msg("work_start")}
          </div>
          <div className="flex flex-col gap-1">
            <label htmlFor="ooo-s-work_end" className={labelCls}>เลิกงาน (น.)</label>
            <input type="time" value={form.work_end} onChange={set("work_end")} {...errP("work_end")} />
            {msg("work_end")}
          </div>
          <div className="flex flex-col gap-1">
            <label htmlFor="ooo-s-half_day_hours" className={labelCls}>ครึ่งวัน (ชั่วโมง)</label>
            <input type="number" inputMode="decimal" min="0.5" step="0.5" value={form.half_day_hours} onChange={set("half_day_hours")} {...errP("half_day_hours")} />
            {msg("half_day_hours", "ออกได้นานสุดต่อครั้ง")}
          </div>
        </div>
      </fieldset>

      <fieldset className={`${cardCls} p-5 space-y-4`}>
        <legend className="sr-only">เงื่อนไขการยื่น</legend>
        <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">เงื่อนไขการยื่น</h3>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="flex flex-col gap-1">
            <label htmlFor="ooo-s-min_notice_days" className={labelCls}>ต้องยื่นล่วงหน้าอย่างน้อย (วัน)</label>
            <input type="number" inputMode="numeric" min="0" step="1" value={form.min_notice_days} onChange={set("min_notice_days")} {...errP("min_notice_days")} />
            {msg("min_notice_days", "0 = ยื่นวันเดียวกันได้")}
          </div>
          <div className="flex flex-col gap-1">
            <label htmlFor="ooo-s-max_backdate_days" className={labelCls}>ยื่นย้อนหลังได้ไม่เกิน (วัน)</label>
            <input type="number" inputMode="numeric" min="0" step="1" value={form.max_backdate_days} onChange={set("max_backdate_days")} {...errP("max_backdate_days")} />
            {msg("max_backdate_days", "0 = ยื่นย้อนหลังไม่ได้")}
          </div>
        </div>

        <div className="flex flex-col gap-1">
          <label htmlFor="ooo-s-personal_monthly_limit" className={labelCls}>ธุระส่วนตัวได้ไม่เกิน (ครั้ง/เดือน)</label>
          <div className="flex flex-wrap items-center gap-4">
            <input
              type="number"
              inputMode="numeric"
              min="1"
              step="1"
              value={form.unlimited ? "" : form.personal_monthly_limit}
              onChange={set("personal_monthly_limit")}
              placeholder={form.unlimited ? "ไม่จำกัด" : ""}
              {...errP("personal_monthly_limit")}
              disabled={!canEdit || form.unlimited}
              className={`${inputCls} tabular-nums max-w-[10rem] ${errors.personal_monthly_limit ? inputErrCls : ""}`}
            />
            <label className="inline-flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300 cursor-pointer has-[:disabled]:cursor-not-allowed">
              <input
                type="checkbox"
                checked={form.unlimited}
                onChange={set("unlimited")}
                disabled={!canEdit}
                className="size-4 rounded accent-indigo-600"
              />
              ไม่จำกัด
            </label>
          </div>
          {msg("personal_monthly_limit")}
        </div>
      </fieldset>

      {saveError && (
        <p role="alert" className="rounded-lg bg-red-50 dark:bg-red-900/20 px-3 py-2 text-sm text-red-700 dark:text-red-300">{saveError}</p>
      )}
      {saved && (
        <p role="status" className="rounded-lg bg-emerald-50 dark:bg-emerald-900/20 px-3 py-2 text-sm text-emerald-700 dark:text-emerald-300">บันทึกการตั้งค่าแล้ว</p>
      )}

      {canEdit && (
        <div className="flex gap-3">
          <button
            type="submit"
            disabled={saving || !dirty}
            className={`inline-flex items-center justify-center gap-2 h-10 rounded-xl bg-indigo-600 hover:bg-indigo-500 px-5 text-sm font-semibold text-white shadow-sm transition-colors duration-200 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed ${focusRing} focus-visible:ring-indigo-500`}
          >
            {saving && <Spinner />}
            {saving ? "กำลังบันทึก..." : "บันทึกการตั้งค่า"}
          </button>
          <button
            type="button"
            disabled={saving || !dirty}
            onClick={() => { setForm(toForm(original)); setErrors({}); setSaveError("") }}
            className={`h-10 rounded-xl border border-gray-300 dark:border-gray-600 px-4 text-sm font-semibold text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors duration-200 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed ${focusRing} focus-visible:ring-indigo-500`}
          >
            คืนค่าเดิม
          </button>
        </div>
      )}
    </form>
  )
}

// ═══════════════════════════════════════════════════════════════════════════
// container
// ═══════════════════════════════════════════════════════════════════════════
const SUB_TABS = [
  ["requests", "รายการคำขอ"],
  ["summary", "สรุปรายสาขา"],
  ["settings", "ตั้งค่า"],
]

export default function HROutOfOfficeTab() {
  const [subTab, setSubTab] = useSubTab(SUB_TABS.map(([v]) => v), "requests")
  const [branches, setBranches] = useState([])

  useEffect(() => {
    apiAuth("/order/branch/search")
      .then((data) => setBranches((data || []).map((b) => ({ value: String(b.id), label: b.branch_name }))))
      .catch(() => {})
  }, [])

  const branchMap = useMemo(() => new Map(branches.map((b) => [b.value, b.label])), [branches])
  const branchName = useCallback((id) => (id == null ? "" : branchMap.get(String(id)) || ""), [branchMap])

  return (
    <div className="space-y-4">
      <Tabs
        items={SUB_TABS.map(([value, label]) => ({ value, label }))}
        value={subTab}
        onChange={setSubTab}
        ariaLabel="ขอออกนอกสถานที่"
        idBase="hr-ooo"
      />

      <div role="tabpanel" id={panelId("hr-ooo", subTab)} aria-labelledby={tabId("hr-ooo", subTab)} tabIndex={0} className={tabPanelCls}>
        {subTab === "requests" && <RequestsPanel branchOptions={branches} branchName={branchName} />}
        {subTab === "summary" && <SummaryPanel branchName={branchName} />}
        {subTab === "settings" && <SettingsPanel />}
      </div>
    </div>
  )
}
