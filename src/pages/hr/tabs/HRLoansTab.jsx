// src/pages/hr/tabs/HRLoansTab.jsx
// จัดการสินเชื่อพนักงาน — GET /loans, PATCH hr-approve/hr-reject
import { useEffect, useState, useCallback } from "react"
import { apiAuth } from "../../../lib/api"

const fmt = (n) => n == null ? "—" : Number(n).toLocaleString("th-TH", { minimumFractionDigits: 2 })

const STATUS_LABEL = {
  pending: "รออนุมัติ",
  hr_approved: "HR อนุมัติแล้ว",
  active: "กำลังผ่อนชำระ",
  closed: "ปิดบัญชี",
  rejected: "ปฏิเสธ",
}
const STATUS_COLOR = {
  pending: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300",
  hr_approved: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300",
  active: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300",
  closed: "bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400",
  rejected: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300",
}

function fmtDate(d) {
  if (!d) return "—"
  try { return new Date(d).toLocaleDateString("th-TH") } catch { return d }
}

const inputCls = "w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-3 py-2 text-sm text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-indigo-500"

export default function HRLoansTab() {
  const [loans, setLoans] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")

  const [modal, setModal] = useState(null)
  const [rejectReason, setRejectReason] = useState("")
  const [submitting, setSubmitting] = useState(false)
  const [submitMsg, setSubmitMsg] = useState("")

  const fetchLoans = useCallback(() => {
    setLoading(true)
    setError("")
    apiAuth("/hr/loans")
      .then(setLoans)
      .catch((e) => setError(e.message || "โหลดข้อมูลไม่สำเร็จ"))
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => { fetchLoans() }, [fetchLoans])

  const openModal = (loan, action) => {
    setModal({
      id: loan.id,
      action,
      name: `${loan.user_first_name} ${loan.user_last_name}`,
      amount: loan.loan_amount,
      months: loan.repayment_months,
    })
    setRejectReason("")
    setSubmitMsg("")
  }

  const handleConfirm = async () => {
    if (!modal) return
    if (modal.action === "reject" && !rejectReason.trim()) {
      setSubmitMsg("⚠️ กรุณาระบุเหตุผลการปฏิเสธ")
      return
    }
    setSubmitting(true)
    setSubmitMsg("")
    try {
      const ep = modal.action === "approve" ? "hr-approve" : "hr-reject"
      const body = modal.action === "reject" ? { reason: rejectReason.trim() } : {}
      await apiAuth(`/hr/loans/${modal.id}/${ep}`, { method: "PATCH", body })
      setModal(null)
      fetchLoans()
    } catch (err) {
      setSubmitMsg(`❌ ${err.message || "ไม่สำเร็จ"}`)
    } finally {
      setSubmitting(false)
    }
  }

  const pendingLoans = loans.filter((l) => l.status === "pending")

  return (
    <div className="space-y-4">
      <p className="text-sm text-gray-500 dark:text-gray-400">
        {loading ? "กำลังโหลด..." : `สินเชื่อทั้งหมด ${loans.length} รายการ · รออนุมัติ ${pendingLoans.length} รายการ`}
      </p>

      {error && (
        <div className="rounded-xl bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 px-4 py-3 text-sm text-red-700 dark:text-red-300">{error}</div>
      )}

      {loading ? (
        <div className="flex justify-center py-16">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-gray-200 border-t-indigo-500 dark:border-gray-700 dark:border-t-indigo-400" />
        </div>
      ) : loans.length === 0 ? (
        <div className="rounded-2xl bg-white dark:bg-gray-800 ring-1 ring-gray-200/70 dark:ring-gray-700/70 shadow-sm p-12 text-center">
          <p className="text-3xl mb-3">💳</p>
          <p className="text-sm text-gray-500 dark:text-gray-400">ไม่มีข้อมูลสินเชื่อ</p>
        </div>
      ) : (
        <div className="space-y-3">
          {loans.map((loan) => (
            <div key={loan.id} className="rounded-2xl bg-white dark:bg-gray-800 ring-1 ring-gray-200/70 dark:ring-gray-700/70 shadow-sm p-4">
              <div className="flex items-start justify-between gap-3 flex-wrap">
                <div className="flex-1 space-y-2">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="font-semibold text-gray-900 dark:text-gray-100">{loan.user_first_name} {loan.user_last_name}</p>
                    <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${STATUS_COLOR[loan.status] ?? "bg-gray-100 text-gray-600"}`}>
                      {STATUS_LABEL[loan.status] ?? loan.status}
                    </span>
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-sm">
                    <div>
                      <p className="text-xs text-gray-400 dark:text-gray-500">จำนวนเงิน</p>
                      <p className="font-bold text-indigo-700 dark:text-indigo-300">{fmt(loan.loan_amount)} ฿</p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-400 dark:text-gray-500">ระยะเวลา</p>
                      <p className="font-medium text-gray-800 dark:text-gray-200">{loan.repayment_months} เดือน</p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-400 dark:text-gray-500">งวดละ</p>
                      <p className="font-medium text-gray-800 dark:text-gray-200">{fmt(loan.monthly_installment)} ฿</p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-400 dark:text-gray-500">วันที่ยื่น</p>
                      <p className="font-medium text-gray-800 dark:text-gray-200">{fmtDate(loan.created_at)}</p>
                    </div>
                  </div>
                  {loan.purpose && (
                    <p className="text-xs text-gray-500 dark:text-gray-400 bg-gray-50 dark:bg-gray-700/40 rounded-lg px-3 py-1.5">
                      วัตถุประสงค์: {loan.purpose}
                    </p>
                  )}
                </div>
                {loan.status === "pending" && (
                  <div className="flex gap-2 shrink-0">
                    <button onClick={() => openModal(loan, "approve")} className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-semibold transition shadow-sm cursor-pointer">✓ อนุมัติ</button>
                    <button onClick={() => openModal(loan, "reject")} className="px-4 py-2 rounded-xl bg-red-600 hover:bg-red-500 text-white text-sm font-semibold transition shadow-sm cursor-pointer">✕ ปฏิเสธ</button>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {modal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="w-full max-w-sm rounded-2xl bg-white dark:bg-gray-800 shadow-2xl p-6 space-y-4">
            <h3 className="text-lg font-bold text-gray-900 dark:text-gray-100">
              {modal.action === "approve" ? "✓ ยืนยันอนุมัติสินเชื่อ" : "✕ ยืนยันปฏิเสธสินเชื่อ"}
            </h3>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              <span className="font-semibold text-gray-900 dark:text-gray-100">{modal.name}</span>{" "}
              · {fmt(modal.amount)} ฿ · {modal.months} เดือน
            </p>
            {modal.action === "reject" && (
              <div>
                <label className="text-xs font-medium text-gray-600 dark:text-gray-400 block mb-1">
                  เหตุผลการปฏิเสธ <span className="text-red-500">*</span>
                </label>
                <input type="text" value={rejectReason} onChange={(e) => setRejectReason(e.target.value)}
                  placeholder="กรุณาระบุเหตุผล" className={inputCls} />
              </div>
            )}
            {submitMsg && <p className="text-sm text-center text-red-600 dark:text-red-400">{submitMsg}</p>}
            <div className="flex gap-3">
              <button onClick={() => setModal(null)} className="flex-1 h-10 rounded-xl border border-gray-300 dark:border-gray-600 text-sm font-semibold text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700 transition cursor-pointer">ยกเลิก</button>
              <button onClick={handleConfirm} disabled={submitting}
                className={`flex-1 h-10 rounded-xl text-white text-sm font-semibold transition shadow-sm disabled:opacity-60 cursor-pointer ${modal.action === "approve" ? "bg-emerald-600 hover:bg-emerald-500" : "bg-red-600 hover:bg-red-500"}`}>
                {submitting ? "กำลังดำเนินการ..." : "ยืนยัน"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
