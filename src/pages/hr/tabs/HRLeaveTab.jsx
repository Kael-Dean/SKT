// src/pages/hr/tabs/HRLeaveTab.jsx
// อนุมัติ / ปฏิเสธ คำขอลา + ดาวน์โหลด PDF ใบลา
import { useEffect, useState, useCallback } from "react"
import { apiAuth, apiDownload } from "../../../lib/api"
import Portal from "../../../components/Portal"
import { PageLoader, ErrorState, EmptyState } from "../../../components/ui"

const STATUS_LABEL = {
  pending:                   "รอดำเนินการ",
  pending_branch_head:       "รอหัวหน้าอนุมัติ",
  pending_assistant_manager: "รอผู้ช่วยผู้จัดการอนุมัติ",
  pending_manager:           "รอผู้จัดการอนุมัติ",
  approved:                  "อนุมัติแล้ว",
  rejected:                  "ไม่อนุมัติ",
  denied:                    "ไม่อนุมัติ",
  cancelled:                 "ยกเลิก",
}
const STATUS_COLOR = {
  pending:                   "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300",
  pending_branch_head:       "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300",
  pending_assistant_manager: "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-300",
  pending_manager:           "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300",
  approved:                  "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300",
  rejected:                  "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300",
  denied:                    "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300",
  cancelled:                 "bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400",
}

function fmtDate(d) {
  if (!d) return "—"
  try { return new Date(d).toLocaleDateString("th-TH") } catch { return d }
}

export default function HRLeaveTab() {
  const [subTab, setSubTab] = useState("pending")
  const [requests, setRequests] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")

  const [modal, setModal] = useState(null)
  const [hrComment, setHrComment] = useState("")
  const [submitting, setSubmitting] = useState(false)
  const [submitMsg, setSubmitMsg] = useState("")
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
      alert(`ดาวน์โหลด PDF ไม่สำเร็จ: ${err.message || "เกิดข้อผิดพลาด"}`)
    } finally {
      setDownloadingId(null)
    }
  }

  const fetchRequests = useCallback(() => {
    setLoading(true)
    setError("")
    apiAuth("/hr/leave-requests")
      .then(setRequests)
      .catch((e) => setError(e.message || "โหลดข้อมูลไม่สำเร็จ"))
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => { fetchRequests() }, [fetchRequests])

  const openModal = (req, action) => {
    setModal({
      id: req.id,
      action,
      name: `${req.user_first_name} ${req.user_last_name}`,
      leave_type: req.leave_type_name,
      days: req.total_days,
    })
    setHrComment("")
    setSubmitMsg("")
  }

  const handleConfirm = async () => {
    if (!modal) return
    if (modal.action === "deny" && !hrComment.trim()) {
      setSubmitMsg("กรุณากรอกเหตุผลการปฏิเสธ")
      return
    }
    setSubmitting(true)
    setSubmitMsg("")
    try {
      const ep = modal.action === "approve" ? "approve" : "deny"
      const body = { hr_comment: hrComment.trim() || undefined }
      await apiAuth(`/hr/leave-requests/${modal.id}/${ep}`, { method: "POST", body })
      setModal(null)
      fetchRequests()
    } catch (err) {
      setSubmitMsg(err.message || "ดำเนินการไม่สำเร็จ")
    } finally {
      setSubmitting(false)
    }
  }

  const isPending = (status) => status?.startsWith("pending")

  const displayRequests = subTab === "pending"
    ? requests.filter((r) => isPending(r.status))
    : requests

  const pendingCount = requests.filter((r) => isPending(r.status)).length

  return (
    <div className="space-y-4">
      {/* Sub-tabs */}
      <div role="tablist" aria-label="ตัวกรองคำขอลา" className="flex gap-1 rounded-xl bg-gray-100 dark:bg-gray-800 p-1 w-fit">
        {[["pending", "รออนุมัติ"], ["all", "ทั้งหมด"]].map(([v, label]) => (
          <button
            key={v}
            role="tab"
            type="button"
            aria-selected={subTab === v}
            onClick={() => setSubTab(v)}
            className={`px-4 py-2 rounded-lg text-sm font-semibold transition-all duration-200 cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-1 dark:focus-visible:ring-offset-gray-800 ${subTab === v ? "bg-white dark:bg-gray-700 text-indigo-700 dark:text-indigo-300 shadow-sm" : "text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200"}`}
          >
            {label}
            {v === "pending" && pendingCount > 0 && (
              <span className="ml-1.5 rounded-full bg-amber-500 text-white text-[10px] font-bold px-1.5 py-0.5 tabular-nums">
                {pendingCount}
              </span>
            )}
          </button>
        ))}
      </div>

      {error && <ErrorState message={error} onRetry={fetchRequests} />}

      {loading ? (
        <PageLoader variant="cards" rows={3} message="กำลังโหลดคำขอลา…" />
      ) : displayRequests.length === 0 ? (
        <EmptyState
          icon={
            <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="size-12">
              <path d="M9 11l3 3L22 4" />
              <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" />
            </svg>
          }
          title={subTab === "pending" ? "ไม่มีคำขอที่รออนุมัติ" : "ยังไม่มีคำขอลา"}
          description={subTab === "pending" ? "คำขอลาที่ต้องดำเนินการจะปรากฏที่นี่" : "เมื่อมีพนักงานยื่นคำขอลา รายการจะแสดงที่นี่"}
        />
      ) : (
        <div className="space-y-3">
          {displayRequests.map((r) => (
            <div key={r.id} className="rounded-2xl bg-white dark:bg-gray-800 ring-1 ring-gray-200/70 dark:ring-gray-700/70 shadow-sm p-4">
              <div className="flex items-start justify-between gap-3 flex-wrap">
                <div className="flex-1 space-y-2">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="font-semibold text-gray-900 dark:text-gray-100">
                      {r.user_first_name} {r.user_last_name}
                    </p>
                    <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${STATUS_COLOR[r.status] ?? "bg-gray-100 text-gray-600"}`}>
                      {STATUS_LABEL[r.status] ?? r.status}
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
                  {r.hr_comment && (
                    <p className="text-xs text-indigo-700 dark:text-indigo-300 bg-indigo-50 dark:bg-indigo-900/20 rounded-lg px-3 py-1.5">
                      ความเห็น HR: {r.hr_comment}
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
                  {(r.status === "pending" || r.status === "pending_branch_head" || r.status === "pending_assistant_manager" || r.status === "pending_manager") && (
                    <div className="flex gap-2">
                      <button
                        onClick={() => openModal(r, "approve")}
                        className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-semibold transition-all duration-200 shadow-sm cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-1 dark:focus-visible:ring-offset-gray-800"
                      >
                        <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="size-3.5">
                          <path d="M20 6 9 17l-5-5" />
                        </svg>
                        อนุมัติ
                      </button>
                      <button
                        onClick={() => openModal(r, "deny")}
                        className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-red-600 hover:bg-red-500 text-white text-sm font-semibold transition-all duration-200 shadow-sm cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-red-500 focus-visible:ring-offset-1 dark:focus-visible:ring-offset-gray-800"
                      >
                        <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="size-3.5">
                          <path d="M18 6 6 18M6 6l12 12" />
                        </svg>
                        ปฏิเสธ
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Confirm Modal */}
      {modal && (
        <Portal>
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm"
          onClick={() => !submitting && setModal(null)}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="leavetab-confirm-title"
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-sm rounded-2xl bg-white dark:bg-gray-800 shadow-2xl p-6 space-y-4"
          >
            <h3 id="leavetab-confirm-title" className="text-lg font-bold text-gray-900 dark:text-gray-100">
              {modal.action === "approve" ? "ยืนยันอนุมัติ" : "ยืนยันปฏิเสธ"}
            </h3>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              {modal.action === "approve" ? "อนุมัติ" : "ปฏิเสธ"}คำขอลาของ{" "}
              <span className="font-semibold text-gray-900 dark:text-gray-100">{modal.name}</span>{" "}
              ({modal.leave_type} · <span className="tabular-nums">{modal.days}</span> วัน)?
            </p>
            <div>
              <label htmlFor="leavetab-hr-comment" className="text-xs font-medium text-gray-600 dark:text-gray-400 block mb-1">
                ความเห็น HR {modal.action === "deny" && <span className="text-red-500">*</span>}
              </label>
              <input
                id="leavetab-hr-comment"
                type="text"
                autoFocus
                value={hrComment}
                onChange={(e) => setHrComment(e.target.value)}
                placeholder={modal.action === "deny" ? "กรุณาระบุเหตุผล (บังคับ)" : "ความเห็นเพิ่มเติม (ถ้ามี)"}
                aria-invalid={!!submitMsg}
                aria-describedby={submitMsg ? "leavetab-confirm-msg" : undefined}
                className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-3 py-2 text-sm text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
            {submitMsg && <p id="leavetab-confirm-msg" role="alert" className="text-sm text-center text-red-600 dark:text-red-400">{submitMsg}</p>}
            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => setModal(null)}
                disabled={submitting}
                className="flex-1 h-10 rounded-xl border border-gray-300 dark:border-gray-600 text-sm font-semibold text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700 transition duration-200 cursor-pointer disabled:opacity-60 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-1 dark:focus-visible:ring-offset-gray-800"
              >
                ยกเลิก
              </button>
              <button
                type="button"
                onClick={handleConfirm}
                disabled={submitting}
                className={`flex-1 inline-flex items-center justify-center gap-2 h-10 rounded-xl text-white text-sm font-semibold transition duration-200 shadow-sm disabled:opacity-60 cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-1 dark:focus-visible:ring-offset-gray-800 ${modal.action === "approve" ? "bg-emerald-600 hover:bg-emerald-500 focus-visible:ring-emerald-500" : "bg-red-600 hover:bg-red-500 focus-visible:ring-red-500"}`}
              >
                {submitting && <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white" aria-hidden="true" />}
                {submitting ? "กำลังดำเนินการ..." : "ยืนยัน"}
              </button>
            </div>
          </div>
        </div>
        </Portal>
      )}
    </div>
  )
}
