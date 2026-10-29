// src/pages/hr/tabs/HROnboardingTab.jsx
// ความคืบหน้าการกรอกข้อมูลเริ่มต้น (first-login onboarding, backend PR 59)
//   GET    /hr/onboarding?branch_id=                     → รายชื่อ + สถานะ (กรองสถานะฝั่งหน้าเว็บ เพื่อนับจำนวนแต่ละสถานะได้ในคำขอเดียว)
//   POST   /hr/employees/{id}/onboarding/reopen          → เปิดให้กรอกใหม่ (ล้างการยืนยันทั้งหมด + ทัวร์)
//   POST   /hr/employees/{id}/onboarding/exempt {reason} → ยกเว้น (422 ถ้าไม่ระบุเหตุผล)
//   DELETE /hr/employees/{id}/onboarding/exempt          → ยกเลิกการยกเว้น (409 ถ้ายังไม่ได้ยกเว้น)
import { useCallback, useEffect, useId, useMemo, useRef, useState } from "react"
import { Check, Search } from "lucide-react"
import { apiAuth } from "../../../lib/api"
import {
  cx,
  baseField,
  labelCls,
  errorTextCls,
  helpTextCls,
  neutralBtnCls,
  primaryBtnCls,
  segmentedCls,
  segmentedItemCls,
  segmentedItemActiveCls,
} from "../../../lib/styles"
import SelectDropdown from "../../../components/SelectDropdown"
import BranchLockNote from "../../../components/BranchLockNote"
import useBranchLock, { scopedBranchId } from "../../../hooks/useBranchLock"
import { useIsPhone } from "../../../hooks/useMediaQuery"
import Can from "../../../components/Can"
import { useCan } from "../../../lib/permissions"
import { useDrill } from "../../../lib/drill"
import { fmtDateTh } from "../../../lib/approvalActions"
import {
  Badge,
  ConfirmDialog,
  DataList,
  EmptyState,
  ErrorState,
  Sheet,
  SkeletonTableRows,
  toast,
} from "../../../components/ui"

const TOTAL_SECTIONS = 8 // account … criminal + license

const ONBOARDING_STATUS = {
  not_started: { label: "ยังไม่เริ่ม", tone: "pending" },
  in_progress: { label: "กำลังกรอก", tone: "info" },
  done: { label: "เสร็จแล้ว", tone: "success" },
  exempt: { label: "ได้รับยกเว้น", tone: "neutral" },
}

const FILTERS = [
  { value: "", label: "ทั้งหมด" },
  { value: "not_started", label: ONBOARDING_STATUS.not_started.label },
  { value: "in_progress", label: ONBOARDING_STATUS.in_progress.label },
  { value: "done", label: ONBOARDING_STATUS.done.label },
  { value: "exempt", label: ONBOARDING_STATUS.exempt.label },
]

/** สถานะตามลำดับความสำคัญ exempt > done > in_progress > not_started (ใช้ค่าจาก backend ถ้าถูกต้อง) */
function statusOf(r) {
  if (ONBOARDING_STATUS[r?.status]) return r.status
  if (r?.exempt_reason) return "exempt"
  if (r?.completed_at) return "done"
  if (Number(r?.sections_confirmed) > 0) return "in_progress"
  return "not_started"
}

const nf = (n) => Number(n).toLocaleString("th-TH")

/** แถบความคืบหน้าบาง ๆ — ขยายจากซ้ายตอนแสดงครั้งแรก (transform scaleX, ปิดเมื่อ reduced motion) */
function ProgressCell({ value, grown }) {
  const n = Math.max(0, Math.min(TOTAL_SECTIONS, Number(value) || 0))
  const full = n === TOTAL_SECTIONS
  return (
    <span className="inline-flex items-center gap-2.5">
      <span className="w-8 shrink-0 text-right text-sm font-medium tabular-nums text-gray-800 dark:text-gray-200">
        {n}/{TOTAL_SECTIONS}
      </span>
      <span
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={TOTAL_SECTIONS}
        aria-valuenow={n}
        aria-label={`ยืนยันแล้ว ${n} จาก ${TOTAL_SECTIONS} หัวข้อ`}
        className="block h-1.5 w-16 shrink-0 overflow-hidden rounded-full bg-gray-200 dark:bg-white/10"
      >
        <span
          className={cx(
            "block h-full w-full origin-left rounded-full transition-transform duration-500 ease-out motion-reduce:transition-none",
            full ? "bg-emerald-500 dark:bg-emerald-400" : "bg-indigo-500 dark:bg-indigo-400",
          )}
          style={{ transform: `scaleX(${grown ? n / TOTAL_SECTIONS : 0})` }}
        />
      </span>
    </span>
  )
}

function TourCell({ done }) {
  return done ? (
    <span className="inline-flex items-center gap-1 text-sm text-emerald-700 dark:text-emerald-300">
      <Check aria-hidden="true" className="size-4" strokeWidth={2} />
      <span className="sr-only">ดูทัวร์แล้ว</span>
    </span>
  ) : (
    <span className="text-sm text-gray-400 dark:text-gray-500">
      <span aria-hidden="true">—</span>
      <span className="sr-only">ยังไม่ได้ดูทัวร์</span>
    </span>
  )
}

const smallBtn = "!h-9 !px-3 !text-[13px] whitespace-nowrap"

/** ปุ่มจัดการของแต่ละแถว — ซ่อนเมื่อไม่มีสิทธิ์ hr.onboarding.manage */
function RowActions({ row, busy, onReopen, onExempt, onUnexempt }) {
  const st = statusOf(row)
  return (
    <Can perm="hr.onboarding.manage">
      <div className="flex flex-wrap justify-end gap-2">
        {st === "exempt" ? (
          <button type="button" disabled={busy} onClick={() => onUnexempt(row)} className={cx(neutralBtnCls, smallBtn)}>
            ยกเลิกการยกเว้น
          </button>
        ) : (
          <>
            {st !== "not_started" && (
              <button type="button" disabled={busy} onClick={() => onReopen(row)} className={cx(neutralBtnCls, smallBtn)}>
                เปิดให้กรอกใหม่
              </button>
            )}
            {st !== "done" && (
              <button type="button" disabled={busy} onClick={() => onExempt(row)} className={cx(neutralBtnCls, smallBtn)}>
                ยกเว้น
              </button>
            )}
          </>
        )}
      </div>
    </Can>
  )
}

const TH = "sticky top-0 z-10 whitespace-nowrap border-b border-gray-200 bg-gray-50 px-4 py-2.5 text-left text-xs font-semibold text-gray-600 dark:border-line-strong dark:bg-gray-900 dark:text-gray-300"
const TD = "px-4 py-3 align-middle"
const NOT_ENABLED_MSG = "ระบบกรอกข้อมูลเริ่มต้นยังไม่เปิดใช้บนเซิร์ฟเวอร์นี้ รอทีม backend อัปเดต"

export default function HROnboardingTab() {
  const { drillTo } = useDrill()
  const isPhone = useIsPhone()
  const { can } = useCan()
  const canManage = can("hr.onboarding.manage")

  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [grown, setGrown] = useState(false)

  const [status, setStatus] = useState("")
  const [query, setQuery] = useState("")
  const branchLock = useBranchLock()
  const [branch, setBranch] = useState(branchLock.activeKey)
  useEffect(() => {
    if (branchLock.locked) setBranch(branchLock.activeKey)
  }, [branchLock.locked, branchLock.activeKey])
  const [branches, setBranches] = useState([])

  // action state
  const [reopenRow, setReopenRow] = useState(null)
  const [unexemptRow, setUnexemptRow] = useState(null)
  const [exemptRow, setExemptRow] = useState(null)
  const [reason, setReason] = useState("")
  const [actionErr, setActionErr] = useState("")
  const [saving, setSaving] = useState(false)
  const reqRef = useRef(0)
  const reasonId = useId()
  const reasonErrId = useId()
  const searchId = useId()

  useEffect(() => {
    apiAuth("/order/branch/search")
      .then((data) => setBranches((data || []).map((b) => ({ value: String(b.id), label: b.branch_name }))))
      .catch(() => {})
  }, [])

  const fetchRows = useCallback(({ quiet = false } = {}) => {
    const req = ++reqRef.current
    if (!quiet) {
      setLoading(true)
      setError("")
    }
    const params = new URLSearchParams()
    const branchId = scopedBranchId(branch)
    if (branchId) params.set("branch_id", branchId)
    const qs = params.toString()
    return apiAuth(`/hr/onboarding${qs ? `?${qs}` : ""}`)
      .then((data) => {
        if (req !== reqRef.current) return
        setRows(Array.isArray(data) ? data : [])
        setError("")
      })
      .catch((e) => {
        if (req !== reqRef.current || quiet) return
        setRows([])
        // 404 = backend without the onboarding routes yet (PR 59 not deployed on this server)
        setError(e.status === 404 ? NOT_ENABLED_MSG : e.status === 403 ? (e.message || "ไม่มีสิทธิ์ดูข้อมูลสาขานี้") : (e.message || "โหลดข้อมูลไม่สำเร็จ"))
      })
      .finally(() => {
        if (req === reqRef.current && !quiet) setLoading(false)
      })
  }, [branch])

  useEffect(() => { fetchRows() }, [fetchRows])

  // แถบความคืบหน้าขยายหลังแสดงผลครั้งแรก (เฟรมถัดไป ให้ transition ทำงาน)
  useEffect(() => {
    if (loading || grown) return undefined
    const id = requestAnimationFrame(() => requestAnimationFrame(() => setGrown(true)))
    return () => cancelAnimationFrame(id)
  }, [loading, grown])

  const counts = useMemo(() => {
    const c = { "": rows.length, not_started: 0, in_progress: 0, done: 0, exempt: 0 }
    rows.forEach((r) => { c[statusOf(r)] += 1 })
    return c
  }, [rows])

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase()
    return rows.filter((r) =>
      (!status || statusOf(r) === status) &&
      (!q || String(r.name ?? "").toLowerCase().includes(q) || String(r.branch_name ?? "").toLowerCase().includes(q)),
    )
  }, [rows, status, query])

  const patchRow = (userId, patch) =>
    setRows((prev) => prev.map((r) => (r.user_id === userId ? { ...r, ...patch } : r)))

  const openProfile = (r) => drillTo(`/hr/personnel/${r.user_id}`, "กรอกข้อมูลเริ่มต้น")

  // ── actions ──────────────────────────────────────────────────────────────
  const startReopen = (r) => { setActionErr(""); setReopenRow(r) }
  const startUnexempt = (r) => { setActionErr(""); setUnexemptRow(r) }
  const startExempt = (r) => { setActionErr(""); setReason(""); setExemptRow(r) }
  const closeAll = () => {
    if (saving) return
    setReopenRow(null)
    setUnexemptRow(null)
    setExemptRow(null)
    setActionErr("")
  }

  const doReopen = async () => {
    const r = reopenRow
    setSaving(true)
    setActionErr("")
    try {
      const res = await apiAuth(`/hr/employees/${r.user_id}/onboarding/reopen`, { method: "POST" })
      const st = res?.status ?? "not_started"
      patchRow(r.user_id, st === "exempt"
        ? { status: st, sections_confirmed: 0, tour_done: false, completed_at: null }
        : { status: st, sections_confirmed: 0, tour_done: false, completed_at: null, exempt_reason: null })
      setReopenRow(null)
      toast.success("เปิดให้กรอกใหม่แล้ว", { description: `${r.name} ต้องยืนยันข้อมูลครบ 8 หัวข้ออีกครั้งก่อนใช้บริการตนเอง` })
      fetchRows({ quiet: true })
    } catch (e) {
      setActionErr(e.message || "ดำเนินการไม่สำเร็จ")
    } finally {
      setSaving(false)
    }
  }

  const doExempt = async (e) => {
    e?.preventDefault?.()
    const r = exemptRow
    const text = reason.trim()
    if (!text) {
      setActionErr("กรุณาระบุเหตุผลที่ยกเว้น")
      document.getElementById(reasonId)?.focus()
      return
    }
    setSaving(true)
    setActionErr("")
    try {
      const res = await apiAuth(`/hr/employees/${r.user_id}/onboarding/exempt`, { method: "POST", body: { reason: text } })
      patchRow(r.user_id, { status: res?.status ?? "exempt", exempt_reason: res?.exempt_reason ?? text })
      setExemptRow(null)
      toast.success("ยกเว้นแล้ว", { description: `${r.name} ใช้บริการตนเองได้โดยไม่ต้องกรอกข้อมูลให้ครบ` })
      fetchRows({ quiet: true })
    } catch (err) {
      setActionErr(err.message || "บันทึกไม่สำเร็จ")
    } finally {
      setSaving(false)
    }
  }

  const doUnexempt = async () => {
    const r = unexemptRow
    setSaving(true)
    setActionErr("")
    try {
      const res = await apiAuth(`/hr/employees/${r.user_id}/onboarding/exempt`, { method: "DELETE" })
      patchRow(r.user_id, { status: res?.status, exempt_reason: null })
      setUnexemptRow(null)
      toast.success("ยกเลิกการยกเว้นแล้ว", { description: `${r.name} ต้องกรอกข้อมูลให้ครบก่อนใช้บริการตนเอง` })
      fetchRows({ quiet: true })
    } catch (err) {
      if (err.status === 409) {
        setActionErr(err.message || "ยังไม่ได้รับการยกเว้น")
        fetchRows({ quiet: true }) // สถานะในรายการอาจเก่า — โหลดใหม่ให้ตรงกับระบบ
      } else {
        setActionErr(err.message || "ดำเนินการไม่สำเร็จ")
      }
    } finally {
      setSaving(false)
    }
  }

  const hasFilters = Boolean(status || query.trim() || (!branchLock.locked && branch))
  const clearFilters = () => {
    setStatus("")
    setQuery("")
    if (!branchLock.locked) setBranch("")
  }

  const empty = (
    <EmptyState
      title={rows.length === 0 ? "ยังไม่มีรายชื่อ" : "ไม่พบรายชื่อที่ตรงกับตัวกรอง"}
      description={rows.length === 0
        ? "ยังไม่มีเจ้าหน้าที่ที่ต้องกรอกข้อมูลเริ่มต้นในขอบเขตนี้"
        : "ลองเปลี่ยนสถานะหรือคำค้น หรือล้างตัวกรองเพื่อดูทั้งหมด"}
      action={hasFilters && rows.length > 0 ? (
        <button type="button" onClick={clearFilters} className={neutralBtnCls}>ล้างตัวกรอง</button>
      ) : null}
    />
  )

  const actionProps = { busy: saving, onReopen: startReopen, onExempt: startExempt, onUnexempt: startUnexempt }

  return (
    <div className="space-y-4">
      {/* ── ตัวกรอง ─────────────────────────────────────────────── */}
      <div className="space-y-3">
        <div className="-mx-1 overflow-x-auto px-1 pb-0.5 [scrollbar-width:none]">
          <div role="radiogroup" aria-label="กรองตามสถานะ" className={cx(segmentedCls, "w-max min-w-full")}>
            {FILTERS.map((f) => {
              const on = status === f.value
              return (
                <button
                  key={f.value || "all"}
                  type="button"
                  role="radio"
                  aria-checked={on}
                  onClick={() => setStatus(f.value)}
                  className={cx(segmentedItemCls, "flex-none md:flex-1 inline-flex items-center justify-center gap-1.5 whitespace-nowrap", on && segmentedItemActiveCls)}
                >
                  {f.label}
                  <span
                    className={cx(
                      "tabular-nums text-xs",
                      on ? "text-indigo-600 dark:text-indigo-300" : "text-gray-500 dark:text-gray-400",
                    )}
                  >
                    {loading ? "–" : nf(counts[f.value] ?? 0)}
                  </span>
                </button>
              )
            })}
          </div>
        </div>

        <div className="flex flex-col gap-3 sm:flex-row sm:items-start">
          <div className="relative min-w-0 flex-1">
            <label htmlFor={searchId} className="sr-only">ค้นหาชื่อหรือสาขา</label>
            <Search aria-hidden="true" strokeWidth={1.75} className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-gray-400" />
            <input
              id={searchId}
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="ค้นหาชื่อหรือสาขา"
              autoComplete="off"
              className={cx(baseField, "!rounded-lg !py-2 !pl-9 !pr-3 md:!text-sm")}
            />
          </div>
          <div className="w-full sm:w-52 sm:shrink-0">
            <SelectDropdown
              size="sm"
              value={branch}
              onChange={setBranch}
              placeholder="ทุกสาขา"
              ariaLabel="สาขา"
            showSwatch={false}
              options={[{ value: "", label: "ทุกสาขา" }, ...branches]}
              disabled={branchLock.locked}
            />
            {branchLock.locked && <BranchLockNote />}
          </div>
        </div>
      </div>

      {error && <ErrorState message={error} onRetry={() => fetchRows()} />}

      {/* ── รายชื่อ ─────────────────────────────────────────────── */}
      {!error && (isPhone ? (
        <DataList
          items={visible}
          keyOf={(r) => r.user_id}
          loading={loading}
          title={(r) => r.name || "—"}
          subtitle={(r) => r.branch_name || "—"}
          badge={(r) => <Badge tone={ONBOARDING_STATUS[statusOf(r)].tone}>{ONBOARDING_STATUS[statusOf(r)].label}</Badge>}
          onClick={openProfile}
          fields={(r) => [
            { key: "progress", label: "ยืนยันแล้ว", value: () => <ProgressCell value={r.sections_confirmed} grown={grown} /> },
            { key: "tour", label: "ทัวร์", value: () => <TourCell done={r.tour_done} /> },
            ...(r.completed_at ? [{ key: "done", label: "เสร็จเมื่อ", value: () => fmtDateTh(r.completed_at) }] : []),
            ...(r.exempt_reason ? [{ key: "reason", label: "เหตุผลยกเว้น", span: 2, value: () => r.exempt_reason }] : []),
          ]}
          actions={canManage ? (r) => <RowActions row={r} {...actionProps} /> : undefined}
          emptyState={empty}
        />
      ) : (
        <div className="overflow-hidden rounded-xl ring-1 ring-gray-200/70 dark:ring-line">
          <div className="max-h-[max(22rem,calc(100dvh-16rem))] overflow-auto overscroll-x-contain">
            <table className="w-full text-sm">
              <thead>
                <tr>
                  <th scope="col" className={TH}>ชื่อ</th>
                  <th scope="col" className={TH}>สาขา</th>
                  <th scope="col" className={TH}>สถานะ</th>
                  <th scope="col" className={TH}>ยืนยันแล้ว</th>
                  <th scope="col" className={cx(TH, "text-center")}>ทัวร์</th>
                  <th scope="col" className={TH}>วันที่เสร็จ</th>
                  <th scope="col" className={TH}>เหตุผลยกเว้น</th>
                  {canManage && <th scope="col" className={cx(TH, "text-right")}><span className="sr-only">จัดการ</span></th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-line">
                {loading ? (
                  <SkeletonTableRows rows={6} cols={canManage ? 8 : 7} />
                ) : visible.length === 0 ? (
                  <tr><td colSpan={canManage ? 8 : 7}>{empty}</td></tr>
                ) : visible.map((r) => {
                  const st = statusOf(r)
                  return (
                    <tr
                      key={r.user_id}
                      onClick={() => openProfile(r)}
                      className="cursor-pointer bg-white transition-colors duration-150 hover:bg-gray-50 dark:bg-transparent dark:hover:bg-white/[.03]"
                    >
                      <td className={TD}>
                        <button
                          type="button"
                          onClick={(e) => { e.stopPropagation(); openProfile(r) }}
                          className="max-w-[16rem] truncate rounded text-left font-medium text-gray-900 hover:text-indigo-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 dark:text-gray-100 dark:hover:text-indigo-300"
                          title={r.name}
                        >
                          {r.name || "—"}
                        </button>
                      </td>
                      <td className={cx(TD, "whitespace-nowrap text-gray-600 dark:text-gray-300")}>{r.branch_name || "—"}</td>
                      <td className={TD}><Badge tone={ONBOARDING_STATUS[st].tone}>{ONBOARDING_STATUS[st].label}</Badge></td>
                      <td className={TD}><ProgressCell value={r.sections_confirmed} grown={grown} /></td>
                      <td className={cx(TD, "text-center")}><TourCell done={r.tour_done} /></td>
                      <td className={cx(TD, "whitespace-nowrap tabular-nums text-gray-600 dark:text-gray-300")}>
                        {r.completed_at ? fmtDateTh(r.completed_at) : <span className="text-gray-400 dark:text-gray-500">—</span>}
                      </td>
                      <td className={cx(TD, "max-w-[14rem] text-gray-600 dark:text-gray-300")}>
                        {r.exempt_reason
                          ? <span className="line-clamp-2" title={r.exempt_reason}>{r.exempt_reason}</span>
                          : <span className="text-gray-400 dark:text-gray-500">—</span>}
                      </td>
                      {canManage && (
                        <td className={TD} onClick={(e) => e.stopPropagation()}>
                          <RowActions row={r} {...actionProps} />
                        </td>
                      )}
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      ))}

      {!loading && !error && rows.length > 0 && (
        <p className="text-sm text-gray-500 dark:text-gray-400">
          แสดง {nf(visible.length)} จาก {nf(rows.length)} คน · ยืนยันครบ 8 หัวข้อแล้วจึงใช้บริการตนเองได้ แม้ยังไม่จบทัวร์
        </p>
      )}

      {/* ── เปิดให้กรอกใหม่ ─────────────────────────────────────── */}
      <ConfirmDialog
        open={Boolean(reopenRow)}
        title={`เปิดให้ ${reopenRow?.name ?? ""} กรอกข้อมูลใหม่?`}
        description="ใช้เมื่อข้อมูลที่กรอกไว้ต้องตรวจทานใหม่ทั้งชุด"
        confirmLabel="เปิดให้กรอกใหม่"
        tone="danger"
        loading={saving}
        loadingLabel="กำลังเปิด…"
        error={actionErr}
        onConfirm={doReopen}
        onCancel={closeAll}
      >
        <ul className="list-disc space-y-1.5 pl-5 leading-relaxed">
          <li>ล้างสถานะ “เสร็จแล้ว” ทัวร์ และการยืนยันทั้ง 8 หัวข้อ</li>
          <li>เมนูบริการตนเอง (ลา สลิป เงินกู้ ฯลฯ) จะถูกล็อกอีกครั้ง จนกว่าเจ้าตัวจะยืนยันครบทุกหัวข้อ</li>
          <li>ข้อมูลที่กรอกไว้ยังอยู่ เจ้าตัวแก้ไขต่อจากเดิมได้</li>
        </ul>
        {reopenRow && statusOf(reopenRow) === "exempt" && (
          <p className="mt-3 text-sm text-gray-500 dark:text-gray-400">คนนี้ได้รับยกเว้นอยู่ การยกเว้นจะยังคงอยู่</p>
        )}
      </ConfirmDialog>

      {/* ── ยกเลิกการยกเว้น ─────────────────────────────────────── */}
      <ConfirmDialog
        open={Boolean(unexemptRow)}
        title={`ยกเลิกการยกเว้นของ ${unexemptRow?.name ?? ""}?`}
        description="เจ้าตัวต้องกรอกข้อมูลเริ่มต้นให้ครบก่อนใช้บริการตนเองได้อีกครั้ง หากยังกรอกไม่ครบ เมนูบริการตนเองจะถูกล็อกทันที"
        confirmLabel="ยกเลิกการยกเว้น"
        tone="danger"
        loading={saving}
        error={actionErr}
        onConfirm={doUnexempt}
        onCancel={closeAll}
      >
        {unexemptRow?.exempt_reason && (
          <p className="rounded-xl bg-gray-50 px-3.5 py-2.5 text-sm text-gray-700 dark:bg-white/[.04] dark:text-gray-200">
            <span className="text-gray-500 dark:text-gray-400">เหตุผลเดิม: </span>{unexemptRow.exempt_reason}
          </p>
        )}
      </ConfirmDialog>

      {/* ── ยกเว้น ─────────────────────────────────────────────── */}
      <Sheet
        open={Boolean(exemptRow)}
        onClose={closeAll}
        busy={saving}
        title="ยกเว้นการกรอกข้อมูลเริ่มต้น"
        subtitle={exemptRow ? `${exemptRow.name}${exemptRow.branch_name ? ` · ${exemptRow.branch_name}` : ""}` : undefined}
        size="sm"
        footer={
          <div className="grid grid-cols-2 gap-3 md:flex md:justify-end md:gap-2">
            <button type="button" onClick={closeAll} disabled={saving} className={cx(neutralBtnCls, "h-12 md:h-10")}>
              ยกเลิก
            </button>
            <button type="submit" form="hr-onboarding-exempt" disabled={saving} className={cx(primaryBtnCls, "h-12 md:h-10")}>
              {saving ? "กำลังบันทึก…" : "ยืนยันยกเว้น"}
            </button>
          </div>
        }
      >
        <form id="hr-onboarding-exempt" onSubmit={doExempt} noValidate className="space-y-3">
          <p className="text-sm leading-relaxed text-gray-600 dark:text-gray-300">
            เจ้าตัวจะใช้บริการตนเองได้ทันทีโดยไม่ต้องกรอกข้อมูลให้ครบ ใช้กับคนที่ลายาวหรือใกล้เกษียณ
            รายชื่อจะแสดงเป็น “ได้รับยกเว้น” ไม่นับเป็น “เสร็จแล้ว”
          </p>
          <div>
            <label htmlFor={reasonId} className={labelCls}>
              เหตุผล<span className="ml-0.5 text-red-600 dark:text-red-400" aria-hidden="true">*</span>
            </label>
            <textarea
              id={reasonId}
              rows={3}
              value={reason}
              onChange={(e) => { setReason(e.target.value); if (actionErr) setActionErr("") }}
              required
              aria-required="true"
              aria-invalid={Boolean(actionErr) || undefined}
              aria-describedby={actionErr ? reasonErrId : undefined}
              placeholder="เช่น ลาป่วยระยะยาว"
              className={cx(baseField, "!rounded-lg !px-3 !py-2 md:!text-sm resize-y", actionErr && "!border-red-500 dark:!border-red-400")}
            />
            {actionErr ? (
              <p id={reasonErrId} role="alert" className={errorTextCls}>{actionErr}</p>
            ) : (
              <p className={helpTextCls}>เหตุผลจะแสดงในรายการและบันทึกในประวัติการใช้งาน</p>
            )}
          </div>
        </form>
      </Sheet>
    </div>
  )
}
