// src/pages/hr/HRLeaveManagement.jsx
// อนุมัติ / ปฏิเสธ คำขอลา + ดาวน์โหลด PDF ใบลา
import { useEffect, useState, useCallback } from "react"
import { apiAuth, apiDownload } from "../../lib/api"
import { PageLoader, ErrorState, EmptyState, Tabs, tabId, panelId, useSubTab, toast } from "../../components/ui"
import { tabPanelCls } from "../../lib/styles"
import DecisionModal from "../../components/DecisionModal"
import LeaveStageActions from "../../components/LeaveStageActions"
import { isPendingStatus, statusLabel, statusTone } from "../../lib/approval"
import { KIND, requestNotificationsRefresh, rejectionReason } from "../../lib/approvalActions"

// legacy "pending" rows (pre-งวด 2) still show a sensible label
const leaveStatusLabel = (s) => (s === "pending" ? "รอดำเนินการ" : statusLabel(s))
const isPending = (s) => s === "pending" || isPendingStatus(s)

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
  const [downloadingId, setDownloadingId] = useState(null)

  const handlePdfDownload = async (employeeId, leaveId) => {
    setDownloadingId(leaveId)
    try {
      const { blob, filename } = await apiDownload(`/hr/employees/${employeeId}/leaves/${leaveId}/pdf`)
      const url = URL.createObjectURL(blob)
      const a = document.createElement("a")
      a.href = url
      a.download = filename || `leave_${leaveId}.pdf`
      a.click()
      URL.revokeObjectURL(url)
    } catch (err) {
      toast.error("ดาวน์โหลด PDF ไม่สำเร็จ", { description: err.message || "เกิดข้อผิดพลาด" })
    } finally {
      setDownloadingId(null)
    }
  }

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

  const requests = tab === "pending" ? allRequests.filter((r) => isPending(r.status)) : allRequests
  const pendingCount = allRequests.filter((r) => isPending(r.status)).length

  const openDecision = (req, mode) => {
    setBanner(null)
    setDecision({ req, mode })
  }

  const onDecisionDone = (mode) => {
    const r = decision.req
    setDecision(null)
    setBanner({
      tone: "success",
      text: `${mode === "approve" ? "บันทึกการอนุมัติ" : "บันทึกการไม่อนุมัติ"}ใบลาของ ${r.user_first_name ?? ""} ${r.user_last_name ?? ""} แล้ว`,
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
          <h1 className="text-xl font-bold text-gray-900 dark:text-gray-100">จัดการคำขอลา</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
            {loading ? "กำลังโหลด..." : `${tab === "pending" ? `รออนุมัติ ${requests.length} รายการ` : `ทั้งหมด ${requests.length} รายการ`}`}
          </p>
        </div>
        <div className="inline-flex items-center gap-2 rounded-full bg-emerald-100 dark:bg-emerald-900/30 border border-emerald-200 dark:border-emerald-700 px-3 py-1.5 text-xs font-semibold text-emerald-700 dark:text-emerald-300">
          <span className="relative inline-flex h-2 w-2 text-emerald-500 dark:text-emerald-400">
            <span className="status-ping" aria-hidden="true" />
            <span className="inline-flex h-2 w-2 rounded-full bg-current" />
          </span>
          เชื่อมต่อ API แล้ว
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
                <div className="flex-1 space-y-2">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="font-semibold text-gray-900 dark:text-gray-100">
                      {r.user_first_name} {r.user_last_name}
                    </p>
                    <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${statusTone(r.status === "pending" ? "pending_branch_head" : r.status)}`}>
                      {leaveStatusLabel(r.status)}
                    </span>
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
                      <p className="font-bold text-indigo-700 dark:text-indigo-300 tabular-nums">{r.total_days} วัน</p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-400 dark:text-gray-500">วันที่ยื่น</p>
                      <p className="font-medium text-gray-800 dark:text-gray-200">{fmtDate(r.created_at)}</p>
                    </div>
                  </div>
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
                      <span>ลาเกินสิทธิ์ <span className="tabular-nums">{r.extra_leave_days}</span> วัน — หักจากเงินเดือน</span>
                    </p>
                  )}
                </div>

                <div className="flex flex-col gap-2 shrink-0">
                  <button
                    onClick={() => handlePdfDownload(r.user_id, r.id)}
                    disabled={downloadingId === r.id}
                    className="px-3 py-2 rounded-xl bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-300 text-xs font-semibold transition-all shadow-sm disabled:opacity-60 disabled:cursor-not-allowed cursor-pointer flex items-center gap-1.5"
                  >
                    {downloadingId === r.id ? (
                      <>
                        <span className="h-3 w-3 rounded-full border-2 border-gray-400/40 border-t-gray-500 animate-spin" />
                        โหลด...
                      </>
                    ) : (
                      <>
                        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                        </svg>
                        PDF
                      </>
                    )}
                  </button>
                  <LeaveStageActions req={r} onDecide={openDecision} />
                </div>
              </div>
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
          title={`${decision.req.user_first_name ?? ""} ${decision.req.user_last_name ?? ""} — ${decision.req.leave_type_name ?? "ใบลา"}`}
          summary={`${fmtDate(decision.req.from_date)} – ${fmtDate(decision.req.to_date)} · ${decision.req.total_days ?? "-"} วัน`}
          onClose={() => setDecision(null)}
          onDone={onDecisionDone}
          onConflict={onDecisionConflict}
        />
      )}
    </div>
  )
}
