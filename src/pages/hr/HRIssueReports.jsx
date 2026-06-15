// src/pages/hr/HRIssueReports.jsx
// อนุมัติ / ปฏิเสธ รายงานปัญหา — GET/POST /hr/issue-reports
import { useEffect, useState, useCallback } from "react"
import { apiAuth } from "../../lib/api"
import { cardCls } from "../../lib/styles"
import { PageLoader, ErrorState, EmptyState, Badge } from "../../components/ui"

const STATUS_LABEL = { pending: "รอดำเนินการ", approved: "อนุมัติแล้ว", denied: "ปฏิเสธ" }
const STATUS_TONE = { pending: "pending", approved: "success", denied: "danger" }

export default function HRIssueReports() {
  const [tab, setTab] = useState("pending")
  const [reports, setReports] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")

  const [modal, setModal] = useState(null) // { id, action: "approve"|"deny", name }
  const [hrComment, setHrComment] = useState("")
  const [submitting, setSubmitting] = useState(false)
  const [submitMsg, setSubmitMsg] = useState("")

  const fetchReports = useCallback(() => {
    setLoading(true)
    setError("")
    const url = tab === "pending" ? "/hr/issue-reports?status=pending" : "/hr/issue-reports"
    apiAuth(url)
      .then(setReports)
      .catch((e) => setError(e.message || "โหลดข้อมูลไม่สำเร็จ"))
      .finally(() => setLoading(false))
  }, [tab])

  useEffect(() => { fetchReports() }, [fetchReports])

  const openModal = (report, action) => {
    setModal({ id: report.id, action, name: `${report.user_first_name} ${report.user_last_name}` })
    setHrComment("")
    setSubmitMsg("")
  }

  const handleConfirm = async () => {
    if (!modal) return
    if (modal.action === "deny" && !hrComment.trim()) {
      setSubmitMsg("⚠️ กรุณากรอกเหตุผลการปฏิเสธ")
      return
    }
    setSubmitting(true)
    setSubmitMsg("")
    try {
      const endpoint = `/hr/issue-reports/${modal.id}/${modal.action === "approve" ? "approve" : "deny"}`
      const body = modal.action === "deny" ? { hr_comment: hrComment.trim() } : {}
      await apiAuth(endpoint, { method: "POST", body })
      setModal(null)
      fetchReports()
    } catch (err) {
      setSubmitMsg(`❌ ${err.message || "ดำเนินการไม่สำเร็จ"}`)
    } finally {
      setSubmitting(false)
    }
  }

  const pendingCount = tab === "pending" ? reports.length : reports.filter((r) => r.status === "pending").length

  return (
    <div className="space-y-5 pb-10">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-xl font-bold text-gray-900 dark:text-gray-100">รายงานปัญหาข้อมูล</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
            {loading ? "กำลังโหลด..." : `${tab === "pending" ? `รอดำเนินการ ${reports.length} รายการ` : `ทั้งหมด ${reports.length} รายการ`}`}
          </p>
        </div>
        <div className="flex items-center gap-1.5 rounded-full bg-emerald-100 dark:bg-emerald-900/30 border border-emerald-200 dark:border-emerald-700 px-3 py-1.5 text-xs font-semibold text-emerald-700 dark:text-emerald-300">
          <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="h-3.5 w-3.5">
            <path d="M20 6 9 17l-5-5" />
          </svg>
          เชื่อมต่อ API แล้ว
        </div>
      </div>

      {error && <ErrorState message={error} onRetry={fetchReports} />}

      {/* Tabs */}
      <div className="flex gap-1 rounded-xl bg-gray-100 dark:bg-gray-800 p-1 w-fit">
        {[["pending", "รอดำเนินการ"], ["all", "ทั้งหมด"]].map(([v, label]) => (
          <button
            key={v}
            onClick={() => setTab(v)}
            className={`px-4 py-2 rounded-lg text-sm font-semibold transition-all cursor-pointer ${tab === v ? "bg-white dark:bg-gray-700 text-indigo-700 dark:text-indigo-300 shadow-sm" : "text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200"}`}
          >
            {label}
            {v === "pending" && pendingCount > 0 && (
              <span className="ml-1.5 rounded-full bg-red-500 text-white text-[10px] font-bold px-1.5 py-0.5">
                {pendingCount}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Cards */}
      {loading ? (
        <PageLoader variant="cards" rows={3} message="กำลังโหลดรายงานปัญหา…" />
      ) : reports.length === 0 ? (
        <div className={cardCls + " p-2"}>
          <EmptyState
            title={`ไม่มีรายงานปัญหา${tab === "pending" ? "ที่รอดำเนินการ" : ""}`}
            description={tab === "pending" ? "รายงานที่รอดำเนินการทั้งหมดได้รับการดำเนินการแล้ว" : "ยังไม่มีรายงานปัญหาในระบบ"}
            action={tab !== "pending" ? null : (
              <button
                type="button"
                onClick={() => setTab("all")}
                className="inline-flex items-center justify-center gap-2 rounded-2xl border border-indigo-300 bg-white px-4 py-2 text-sm font-medium text-indigo-700 shadow-sm transition-colors duration-150 hover:bg-indigo-50 cursor-pointer dark:border-indigo-700 dark:bg-transparent dark:text-indigo-300 dark:hover:bg-indigo-900/20"
              >
                ดูทั้งหมด
              </button>
            )}
          />
        </div>
      ) : (
        <div className="space-y-3">
          {reports.map((r) => (
            <div key={r.id} className="rounded-2xl bg-white dark:bg-gray-800 ring-1 ring-gray-200/70 dark:ring-gray-700/70 shadow-sm p-4">
              <div className="flex items-start justify-between gap-3 flex-wrap">
                <div className="flex-1 space-y-2">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="font-semibold text-gray-900 dark:text-gray-100">
                      {r.user_first_name} {r.user_last_name}
                    </p>
                    <Badge tone={STATUS_TONE[r.status] ?? "neutral"}>
                      {STATUS_LABEL[r.status] ?? r.status}
                    </Badge>
                    {r.category && (
                      <span className="rounded-full bg-indigo-100 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300 px-2.5 py-0.5 text-xs font-semibold">
                        {r.category}
                      </span>
                    )}
                  </div>

                  {r.field_name && (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-sm">
                      <div className="rounded-lg bg-gray-50 dark:bg-gray-700/40 px-3 py-2">
                        <p className="text-xs text-gray-400 dark:text-gray-500 mb-0.5">ฟิลด์ที่แจ้ง</p>
                        <p className="font-semibold text-gray-800 dark:text-gray-200">{r.field_name}</p>
                      </div>
                      <div className="rounded-lg bg-red-50 dark:bg-red-900/20 px-3 py-2">
                        <p className="text-xs text-gray-400 dark:text-gray-500 mb-0.5">ข้อมูลปัจจุบัน</p>
                        <p className="font-medium text-red-700 dark:text-red-300 line-through">{r.current_value || "—"}</p>
                      </div>
                      <div className="rounded-lg bg-emerald-50 dark:bg-emerald-900/20 px-3 py-2 sm:col-span-1">
                        <p className="text-xs text-gray-400 dark:text-gray-500 mb-0.5">ข้อมูลที่ถูกต้อง</p>
                        <p className="font-semibold text-emerald-700 dark:text-emerald-300">{r.correct_value || "—"}</p>
                      </div>
                    </div>
                  )}

                  {r.description && (
                    <p className="text-xs text-gray-500 dark:text-gray-400 bg-gray-50 dark:bg-gray-700/40 rounded-lg px-3 py-1.5">
                      รายละเอียด: {r.description}
                    </p>
                  )}
                  {r.hr_comment && (
                    <p className="text-xs text-indigo-700 dark:text-indigo-300 bg-indigo-50 dark:bg-indigo-900/20 rounded-lg px-3 py-1.5">
                      ความเห็น HR: {r.hr_comment}
                    </p>
                  )}
                </div>

                {r.status === "pending" && (
                  <div className="flex gap-2 shrink-0">
                    <button
                      onClick={() => openModal(r, "approve")}
                      className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-semibold transition-colors duration-150 shadow-sm cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-gray-800"
                    >
                      <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4"><path d="M20 6 9 17l-5-5" /></svg>
                      อนุมัติ
                    </button>
                    <button
                      onClick={() => openModal(r, "deny")}
                      className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-red-600 hover:bg-red-500 text-white text-sm font-semibold transition-colors duration-150 shadow-sm cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-red-500 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-gray-800"
                    >
                      <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4"><path d="M18 6 6 18M6 6l12 12" /></svg>
                      ปฏิเสธ
                    </button>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Confirm Modal */}
      {modal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="w-full max-w-sm rounded-2xl bg-white dark:bg-gray-800 shadow-2xl p-6 space-y-4">
            <h3 className="flex items-center gap-2 text-lg font-bold text-gray-900 dark:text-gray-100">
              {modal.action === "approve" ? (
                <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5 text-emerald-600 dark:text-emerald-400"><path d="M20 6 9 17l-5-5" /></svg>
              ) : (
                <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5 text-red-600 dark:text-red-400"><path d="M18 6 6 18M6 6l12 12" /></svg>
              )}
              {modal.action === "approve" ? "ยืนยันอนุมัติ" : "ยืนยันปฏิเสธ"}
            </h3>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              {modal.action === "approve" ? "อนุมัติ" : "ปฏิเสธ"}รายงานปัญหาของ{" "}
              <span className="font-semibold text-gray-900 dark:text-gray-100">{modal.name}</span>
            </p>

            {modal.action === "deny" && (
              <div>
                <label className="text-xs font-medium text-gray-600 dark:text-gray-400 block mb-1">
                  เหตุผลการปฏิเสธ <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={hrComment}
                  onChange={(e) => setHrComment(e.target.value)}
                  placeholder="กรุณาระบุเหตุผล (บังคับ)"
                  className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-3 py-2 text-sm text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
            )}

            {submitMsg && (
              <p className="text-sm text-center text-red-600 dark:text-red-400">{submitMsg}</p>
            )}
            <div className="flex gap-3">
              <button
                onClick={() => setModal(null)}
                className="flex-1 h-10 rounded-xl border border-gray-300 dark:border-gray-600 text-sm font-semibold text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700 transition cursor-pointer"
              >
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
      )}
    </div>
  )
}
