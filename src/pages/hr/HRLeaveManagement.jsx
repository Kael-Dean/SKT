// src/pages/hr/HRLeaveManagement.jsx
// อนุมัติ / ปฏิเสธ คำขอลา + พรีวิว/พิมพ์ใบลา (LeaveFormDialog)
import { useEffect, useState, useCallback } from "react"
import { Printer } from "lucide-react"
import { apiAuth } from "../../lib/api"
import LeaveFormDialog from "../../components/hr/LeaveFormDialog"
import { PageLoader, ErrorState, EmptyState, Tabs, tabId, panelId, useSubTab } from "../../components/ui"
import { tabPanelCls } from "../../lib/styles"
import DecisionModal from "../../components/DecisionModal"
import LeaveStageActions from "../../components/LeaveStageActions"
import { stageOf } from "../../lib/approval"
import ApprovalHistory from "../../components/ApprovalHistory"
import { StageBadge, JustificationBadge } from "../../components/ApprovalBadges"
import { KIND, requestNotificationsRefresh, rejectionReason, requesterName } from "../../lib/approvalActions"
import { can } from "../../lib/permissions"
import PageTitle from "../../components/PageTitle"
import { fmtLeaveRowDuration } from "../../lib/leaveDays"
import { canHrCancel, cancelLeaveAsHr } from "../../lib/leaveCancel"
import { CancelLeaveButton, CancelLeaveDialog, CancelledNote } from "../../components/LeaveCancel"

// ระหว่างดำเนินการ = ยังรออนุมัติ หรืออนุมัติแล้วรอตรวจสอบ (stage จาก backend — api-handoff-4 §1)
const isPending = (r) => r?.status === "pending" || !!stageOf(r)

function fmtDate(d) {
  if (!d) return "—"
  try { return new Date(d).toLocaleDateString("th-TH") } catch { return d }
}

export default function HRLeaveManagement() {
  const [tab, setTab] = useSubTab(["pending", "all"], "pending")
  const [allRequests, setAllRequests] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")

  const [decision, setDecision] = useState(null) // { req, mode: "approve"|"reject" }
  const [banner, setBanner] = useState(null) // { tone: "success"|"error", text }
  // พิมพ์ใบลา (LeaveFormDialog — ข้อมูลจาก /hr/personnel ฯลฯ) = HR/Admin เท่านั้น — ผู้อนุมัติสายอื่นไม่เห็นปุ่ม
  const canPrint = can("hr.leave.print")
  const [formTarget, setFormTarget] = useState(null)

  const fetchRequests = useCallback(() => {
    setLoading(true)
    setError("")
    // status values are now pending_branch_head / pending_assistant_manager /
    // pending_manager — fetch all and split client-side.
    apiAuth("/hr/leave-requests")
      .then((data) => setAllRequests(Array.isArray(data) ? data : []))
      .catch((e) => setError(e.message || "โหลดข้อมูลไม่สำเร็จ"))
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => { fetchRequests() }, [fetchRequests])

  const requests = tab === "pending" ? allRequests.filter(isPending) : allRequests
  const pendingCount = allRequests.filter(isPending).length
  const [historyId, setHistoryId] = useState(null)
  const [cancelTarget, setCancelTarget] = useState(null) // ใบลาที่กำลังยกเลิก

  const onCancelDone = (r) => {
    setCancelTarget(null)
    setBanner({
      tone: "success",
      text: `ยกเลิกใบลาของ ${requesterName(r)} แล้ว${r.status === "approved" ? " — คืนวันลาเข้าสิทธิ์แล้ว" : ""}`,
    })
    requestNotificationsRefresh()
    fetchRequests()
  }

  const openDecision = (req, mode) => {
    setBanner(null)
    setDecision({ req, mode })
  }

  const onDecisionDone = (mode) => {
    const r = decision.req
    setDecision(null)
    setBanner({
      tone: "success",
      text: `${{ approve: "บันทึกการอนุมัติ", reject: "บันทึกการไม่อนุมัติ", justified: "บันทึกผลตรวจ อนุมัติ ของ", unjust: "บันทึกผลตรวจ ไม่อนุมัติ ของ" }[mode]}ใบลาของ ${requesterName(r)} แล้ว`,
    })
    requestNotificationsRefresh()
    fetchRequests()
  }

  // 403 (ต่างสาขา / ใบลาของตนเอง) · 409 (ขั้นไม่ตรง / ตัดสินแล้ว) — show detail as is
  const onDecisionConflict = (err) => {
    setDecision(null)
    setBanner({ tone: "error", text: err?.message || "ดำเนินการไม่สำเร็จ" })
    fetchRequests()
  }

  return (
    <div className="space-y-5 pb-10">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <PageTitle title="จัดการคำขอลา" />
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
            {loading ? "กำลังโหลด..." : `${tab === "pending" ? `รออนุมัติ ${requests.length} รายการ` : `ทั้งหมด ${requests.length} รายการ`}`}
          </p>
        </div>
      </div>

      {banner && (
        <div
          role={banner.tone === "error" ? "alert" : "status"}
          className={`flex items-start justify-between gap-3 rounded-xl px-4 py-3 text-sm ring-1 ${
            banner.tone === "error"
              ? "bg-red-50 text-red-800 ring-red-200 dark:bg-red-500/10 dark:text-red-200 dark:ring-red-500/30"
              : "bg-emerald-50 text-emerald-800 ring-emerald-200 dark:bg-emerald-500/10 dark:text-emerald-200 dark:ring-emerald-500/30"
          }`}
        >
          <span className="min-w-0 break-words">{banner.text}</span>
          <button
            type="button"
            onClick={() => setBanner(null)}
            aria-label="ปิดข้อความ"
            className="shrink-0 cursor-pointer rounded-lg px-1 text-xs font-semibold opacity-70 hover:opacity-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
          >
            ปิด
          </button>
        </div>
      )}

      {error && <ErrorState message={error} onRetry={fetchRequests} />}

      <Tabs
        items={[
          { value: "pending", label: "รออนุมัติ", count: pendingCount > 0 ? pendingCount : null },
          { value: "all", label: "ทั้งหมด" },
        ]}
        value={tab}
        onChange={setTab}
        ariaLabel="ตัวกรองคำขอลา"
        idBase="leave-mgmt"
      />

      <div role="tabpanel" id={panelId("leave-mgmt", tab)} aria-labelledby={tabId("leave-mgmt", tab)} tabIndex={0} className={tabPanelCls}>
      {/* Cards */}
      {loading ? (
        <PageLoader variant="cards" rows={3} message="กำลังโหลดคำขอลา…" />
      ) : requests.length === 0 ? (
        <EmptyState
          icon={
            <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="size-12">
              <path d="M9 11l3 3L22 4" />
              <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" />
            </svg>
          }
          title={tab === "pending" ? "ไม่มีคำขอที่รออนุมัติ" : "ยังไม่มีคำขอลา"}
          description={tab === "pending" ? "คำขอลาที่ต้องดำเนินการจะปรากฏที่นี่" : "เมื่อมีพนักงานยื่นคำขอลา รายการจะแสดงที่นี่"}
        />
      ) : (
        <div className="space-y-3">
          {requests.map((r) => (
            <div key={r.id} className="rounded-2xl bg-white dark:bg-gray-800 ring-1 ring-gray-200/70 dark:ring-gray-700/70 shadow-sm p-4">
              <div className="flex items-start justify-between gap-3 flex-wrap">
                <div className="flex-[1_1_15rem] space-y-2">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="font-semibold text-gray-900 dark:text-gray-100">
                      {requesterName(r)}
                    </p>
                    <StageBadge req={r} />
                    <JustificationBadge req={r} />
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-sm">
                    <div>
                      <p className="text-xs text-gray-400 dark:text-gray-500">ประเภทการลา</p>
                      <p className="font-medium text-gray-800 dark:text-gray-200">{r.leave_type_name}</p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-400 dark:text-gray-500">ช่วงเวลา</p>
                      <p className="font-medium text-gray-800 dark:text-gray-200">{fmtDate(r.from_date)} – {fmtDate(r.to_date)}</p>
                      {(r.from_time || r.to_time) && (
                        <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                          {r.from_time?.slice(0,5) ?? "—"} – {r.to_time?.slice(0,5) ?? "—"} น.
                        </p>
                      )}
                    </div>
                    <div>
                      <p className="text-xs text-gray-400 dark:text-gray-500">จำนวนวัน</p>
                      <p className="font-bold text-indigo-700 dark:text-indigo-300 ">{fmtLeaveRowDuration(r)}</p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-400 dark:text-gray-500">วันที่ยื่น</p>
                      <p className="font-medium text-gray-800 dark:text-gray-200">{fmtDate(r.created_at)}</p>
                    </div>
                  </div>
                  <CancelledNote leave={r} />
                  {r.address_during_leave && (
                    <p className="text-xs text-gray-500 dark:text-gray-400 bg-gray-50 dark:bg-gray-700/40 rounded-lg px-3 py-1.5">
                      ที่อยู่ระหว่างลา: {r.address_during_leave}
                      {r.contact_during_leave && ` · โทร. ${r.contact_during_leave}`}
                    </p>
                  )}
                  {r.comment && (
                    <p className="text-xs text-gray-500 dark:text-gray-400 bg-gray-50 dark:bg-gray-700/40 rounded-lg px-3 py-1.5">
                      เหตุผล: {r.comment}
                    </p>
                  )}
                  {rejectionReason(r) ? (
                    <p className="text-xs text-red-700 dark:text-red-300 bg-red-50 dark:bg-red-900/20 rounded-lg px-3 py-1.5">
                      เหตุผลที่ไม่อนุมัติ: {rejectionReason(r)}
                    </p>
                  ) : r.hr_comment && (
                    <p className="text-xs text-indigo-700 dark:text-indigo-300 bg-indigo-50 dark:bg-indigo-900/20 rounded-lg px-3 py-1.5">
                      ความเห็นผู้พิจารณา: {r.hr_comment}
                    </p>
                  )}
                  {r.extra_leave_days > 0 && (
                    <p className="flex items-center gap-1.5 text-xs text-amber-700 dark:text-amber-300 bg-amber-50 dark:bg-amber-900/20 rounded-lg px-3 py-1.5">
                      <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="size-3.5 shrink-0">
                        <path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0Z" />
                        <line x1="12" y1="9" x2="12" y2="13" />
                        <line x1="12" y1="17" x2="12.01" y2="17" />
                      </svg>
                      <span>ลาเกินสิทธิ์ <span className="tabular-nums">{r.extra_leave_days}</span> วัน — งดจ่ายเงินส่วนที่เกิน</span>
                    </p>
                  )}
                </div>

                <div className="flex flex-col gap-2 shrink-0">
                  {canPrint && (
                  <button
                    type="button"
                    onClick={() => setFormTarget({ employeeId: r.user_id, leaveId: r.id, leave: r })}
                    className="px-3 py-2 rounded-xl bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-300 text-xs font-semibold transition-all shadow-sm cursor-pointer flex items-center gap-1.5"
                  >
                    <Printer aria-hidden="true" className="size-3.5" strokeWidth={2} />
                    ใบลา
                  </button>
                  )}
                  <button
                    type="button"
                    onClick={() => setHistoryId((cur) => (cur === r.id ? null : r.id))}
                    aria-expanded={historyId === r.id}
                    className="px-3 py-2 rounded-xl border border-gray-200 dark:border-gray-600 text-gray-700 dark:text-gray-300 text-xs font-semibold hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors cursor-pointer"
                  >
                    {historyId === r.id ? "ซ่อนประวัติ" : "ประวัติการอนุมัติ"}
                  </button>
                  <LeaveStageActions req={r} kind={KIND.LEAVE} onDecide={openDecision} />
                  {canHrCancel(r, can) && (
                    <CancelLeaveButton onClick={() => { setBanner(null); setCancelTarget(r) }} />
                  )}
                </div>
              </div>
              {r.justification_note && (
                <p className="mt-2 text-xs text-gray-600 dark:text-gray-300 bg-gray-50 dark:bg-gray-700/40 rounded-lg px-3 py-1.5">
                  หมายเหตุผลตรวจ: {r.justification_note}
                </p>
              )}
              {historyId === r.id && (
                <ApprovalHistory kind={KIND.LEAVE} id={r.id} req={r} className="mt-3 rounded-xl bg-gray-50 p-3 dark:bg-gray-700/40" />
              )}
            </div>
          ))}
        </div>
      )}
      </div>

      {decision && (
        <DecisionModal
          mode={decision.mode}
          kind={KIND.LEAVE}
          req={decision.req}
          title={`${requesterName(decision.req)} — ${decision.req.leave_type_name ?? "ใบลา"}`}
          summary={`${fmtDate(decision.req.from_date)} – ${fmtDate(decision.req.to_date)} · ${fmtLeaveRowDuration(decision.req)}`}
          onClose={() => setDecision(null)}
          onDone={onDecisionDone}
          onConflict={onDecisionConflict}
        />
      )}
      <LeaveFormDialog target={formTarget} onClose={() => setFormTarget(null)} />
      <CancelLeaveDialog
        leave={cancelTarget}
        byHr
        who={cancelTarget ? requesterName(cancelTarget) : undefined}
        onSubmit={(reason) => cancelLeaveAsHr(cancelTarget, reason)}
        onClose={() => setCancelTarget(null)}
        onDone={onCancelDone}
      />
    </div>
  )
}
