// src/pages/hr/tabs/HRSalaryCertTab.jsx
// 13G — Salary Certificate Requests: HR list + approve/deny + PDF downloads
import { useEffect, useState, useCallback } from "react"
import { apiAuth, apiDownload } from "../../../lib/api"
import Portal from "../../../components/Portal"

const STATUS_LABEL = { pending: "รออนุมัติ", approved: "อนุมัติแล้ว", denied: "ปฏิเสธ" }
const STATUS_COLOR  = {
  pending:  "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300",
  approved: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300",
  denied:   "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300",
}
const PURPOSE_LABEL = {
  document:       "เพื่อใช้เป็นหลักฐาน",
  loan_self:      "เพื่อกู้เงิน",
  loan_guarantee: "เพื่อค้ำประกันเงินกู้",
}

function fmtDate(d) {
  if (!d) return "—"
  try { return new Date(d).toLocaleDateString("th-TH") } catch { return d }
}

export default function HRSalaryCertTab() {
  const [subTab,    setSubTab]    = useState("pending")
  const [requests,  setRequests]  = useState([])
  const [loading,   setLoading]   = useState(true)
  const [error,     setError]     = useState("")

  const [modal,     setModal]     = useState(null)   // { id, action:"approve"|"deny", userName }
  const [comment,   setComment]   = useState("")
  const [submitting, setSubmitting] = useState(false)
  const [submitMsg,  setSubmitMsg]  = useState("")

  const [pdfLoading, setPdfLoading] = useState({})   // { [id]: bool }
  const [pdfErr,     setPdfErr]     = useState("")

  const fetchRequests = useCallback(() => {
    setLoading(true)
    setError("")
    const url = subTab === "pending"
      ? "/hr/salary-cert-requests?status=pending"
      : "/hr/salary-cert-requests"
    apiAuth(url)
      .then(setRequests)
      .catch((e) => setError(e.message || "โหลดข้อมูลไม่สำเร็จ"))
      .finally(() => setLoading(false))
  }, [subTab])

  useEffect(() => { fetchRequests() }, [fetchRequests])

  const openModal = (req, action) => {
    setModal({ id: req.id, action, userName: req.user_name })
    setComment("")
    setSubmitMsg("")
  }

  const handleConfirm = async () => {
    if (!modal) return
    if (modal.action === "deny" && !comment.trim()) {
      setSubmitMsg("⚠️ กรุณาระบุเหตุผลการปฏิเสธ")
      return
    }
    setSubmitting(true)
    setSubmitMsg("")
    try {
      const ep   = modal.action === "approve" ? "approve" : "deny"
      const body = comment.trim() ? { comment: comment.trim() } : {}
      await apiAuth(`/hr/salary-cert-requests/${modal.id}/${ep}`, { method: "PATCH", body })
      setModal(null)
      fetchRequests()
    } catch (e) {
      setSubmitMsg(`❌ ${e.message || "ดำเนินการไม่สำเร็จ"}`)
    } finally {
      setSubmitting(false)
    }
  }

  const downloadPdf = async (id, type) => {
    const key = `${id}_${type}`
    setPdfLoading((p) => ({ ...p, [key]: true }))
    setPdfErr("")
    try {
      const ep = type === "certificate" ? "certificate-pdf" : "request-form-pdf"
      const { blob, filename } = await apiDownload(`/hr/salary-cert-requests/${id}/${ep}`)
      const url = URL.createObjectURL(blob)
      const a   = document.createElement("a")
      a.href     = url
      a.download = filename || `salary_cert_${id}.pdf`
      a.click()
      URL.revokeObjectURL(url)
    } catch (e) {
      setPdfErr(`❌ ${e.message || "ดาวน์โหลดไม่สำเร็จ"}`)
    } finally {
      setPdfLoading((p) => ({ ...p, [key]: false }))
    }
  }

  const pendingCount = subTab === "all" ? requests.filter((r) => r.status === "pending").length : requests.length

  return (
    <div className="space-y-4">
      {/* Sub-tabs */}
      <div className="flex gap-1 rounded-xl bg-gray-100 dark:bg-gray-800 p-1 w-fit">
        {[["pending", "รออนุมัติ"], ["all", "ทั้งหมด"]].map(([v, label]) => (
          <button
            key={v}
            onClick={() => setSubTab(v)}
            className={`px-4 py-2 rounded-lg text-sm font-semibold transition-all cursor-pointer ${
              subTab === v
                ? "bg-white dark:bg-gray-700 text-indigo-700 dark:text-indigo-300 shadow-sm"
                : "text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200"
            }`}
          >
            {label}
            {v === "pending" && pendingCount > 0 && (
              <span className="ml-1.5 rounded-full bg-amber-500 text-white text-[10px] font-bold px-1.5 py-0.5">{pendingCount}</span>
            )}
          </button>
        ))}
      </div>

      {error && (
        <div className="rounded-xl bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 px-4 py-3 text-sm text-red-700 dark:text-red-300">
          {error}
        </div>
      )}
      {pdfErr && (
        <div className="rounded-xl bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 px-4 py-3 text-sm text-red-700 dark:text-red-300">
          {pdfErr}
        </div>
      )}

      {loading ? (
        <div className="flex justify-center py-16">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-gray-200 border-t-indigo-500 dark:border-gray-700 dark:border-t-indigo-400" />
        </div>
      ) : requests.length === 0 ? (
        <div className="rounded-2xl bg-white dark:bg-gray-800 ring-1 ring-gray-200/70 dark:ring-gray-700/70 shadow-sm p-12 text-center">
          <p className="text-3xl mb-3">📋</p>
          <p className="text-sm text-gray-500 dark:text-gray-400">ไม่มีคำขอหนังสือรับรองเงินเดือน{subTab === "pending" ? "ที่รออนุมัติ" : ""}</p>
        </div>
      ) : (
        <div className="space-y-3">
          {requests.map((r) => (
            <div key={r.id} className="rounded-2xl bg-white dark:bg-gray-800 ring-1 ring-gray-200/70 dark:ring-gray-700/70 shadow-sm p-4">
              <div className="flex items-start justify-between gap-3 flex-wrap">
                <div className="flex-1 space-y-2">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="font-semibold text-gray-900 dark:text-gray-100">{r.user_name}</p>
                    <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${STATUS_COLOR[r.status] ?? "bg-gray-100 text-gray-600"}`}>
                      {STATUS_LABEL[r.status] ?? r.status}
                    </span>
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-sm">
                    <div>
                      <p className="text-xs text-gray-400 dark:text-gray-500">สาขา</p>
                      <p className="font-medium text-gray-800 dark:text-gray-200">{r.branch_name}</p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-400 dark:text-gray-500">จุดประสงค์</p>
                      <p className="font-medium text-gray-800 dark:text-gray-200">{PURPOSE_LABEL[r.purpose_type] ?? r.purpose_type}</p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-400 dark:text-gray-500">จำนวนฉบับ</p>
                      <p className="font-medium text-gray-800 dark:text-gray-200">{r.copies_count} ฉบับ</p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-400 dark:text-gray-500">วันที่ยื่น</p>
                      <p className="font-medium text-gray-800 dark:text-gray-200">{fmtDate(r.requested_at)}</p>
                    </div>
                  </div>
                  {r.supervisor_comment && (
                    <p className={`text-xs rounded-lg px-3 py-1.5 ${r.status === "denied" ? "bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-300" : "bg-indigo-50 dark:bg-indigo-900/20 text-indigo-700 dark:text-indigo-300"}`}>
                      ความเห็น: {r.supervisor_comment}
                    </p>
                  )}
                </div>

                <div className="flex flex-col gap-2 shrink-0">
                  {r.status === "pending" && (
                    <div className="flex gap-2">
                      <button onClick={() => openModal(r, "approve")} className="px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold transition cursor-pointer">✓ อนุมัติ</button>
                      <button onClick={() => openModal(r, "deny")}    className="px-3 py-1.5 rounded-xl bg-red-600 hover:bg-red-500 text-white text-xs font-semibold transition cursor-pointer">✕ ปฏิเสธ</button>
                    </div>
                  )}
                  <div className="flex gap-2 flex-wrap">
                    {r.status === "approved" && (
                      <button
                        onClick={() => downloadPdf(r.id, "certificate")}
                        disabled={pdfLoading[`${r.id}_certificate`]}
                        className="px-3 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold transition disabled:opacity-60 cursor-pointer"
                      >
                        {pdfLoading[`${r.id}_certificate`] ? "..." : "📄 หนังสือรับรอง"}
                      </button>
                    )}
                    <button
                      onClick={() => downloadPdf(r.id, "form")}
                      disabled={pdfLoading[`${r.id}_form`]}
                      className="px-3 py-1.5 rounded-xl bg-gray-600 hover:bg-gray-500 text-white text-xs font-semibold transition disabled:opacity-60 cursor-pointer"
                    >
                      {pdfLoading[`${r.id}_form`] ? "..." : "📋 แบบฟอร์ม"}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modal */}
      {modal && (
        <Portal>
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
            <div className="w-full max-w-sm rounded-2xl bg-white dark:bg-gray-800 shadow-2xl p-6 space-y-4">
              <h3 className="text-lg font-bold text-gray-900 dark:text-gray-100">
                {modal.action === "approve" ? "✓ ยืนยันอนุมัติ" : "✕ ยืนยันปฏิเสธ"}
              </h3>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                คำขอของ <span className="font-semibold text-gray-900 dark:text-gray-100">{modal.userName}</span>
              </p>
              <div>
                <label className="text-xs font-medium text-gray-600 dark:text-gray-400 block mb-1">
                  ความเห็น {modal.action === "deny" && <span className="text-red-500">* (บังคับ)</span>}
                </label>
                <input
                  type="text"
                  value={comment}
                  onChange={(e) => setComment(e.target.value)}
                  placeholder={modal.action === "deny" ? "กรุณาระบุเหตุผล (บังคับ)" : "ความเห็นเพิ่มเติม (ถ้ามี)"}
                  className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-3 py-2 text-sm text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
              {submitMsg && <p className="text-sm text-center text-red-600 dark:text-red-400">{submitMsg}</p>}
              <div className="flex gap-3">
                <button onClick={() => setModal(null)} className="flex-1 h-10 rounded-xl border border-gray-300 dark:border-gray-600 text-sm font-semibold text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700 transition cursor-pointer">
                  ยกเลิก
                </button>
                <button
                  onClick={handleConfirm}
                  disabled={submitting}
                  className={`flex-1 h-10 rounded-xl text-white text-sm font-semibold transition shadow-sm disabled:opacity-60 cursor-pointer ${modal.action === "approve" ? "bg-emerald-600 hover:bg-emerald-500" : "bg-red-600 hover:bg-red-500"}`}
                >
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
