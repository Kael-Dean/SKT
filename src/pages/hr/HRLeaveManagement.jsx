// src/pages/hr/HRLeaveManagement.jsx
// อนุมัติ / ปฏิเสธ คำขอลา — Admin / HR
import { useState } from "react"

const STATUS_LABEL = { pending: "รออนุมัติ", approved: "อนุมัติแล้ว", rejected: "ปฏิเสธ" }
const STATUS_COLOR = {
  pending:  "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300",
  approved: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300",
  rejected: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300",
}

// Mock leave requests — รอเชื่อม GET /hr/leave-requests
const MOCK_REQUESTS = [
  { id: 1, employee: "สุภา รักสงบ", leave_type: "ลาป่วย", start: "2025-05-10", end: "2025-05-12", days: 3, reason: "ไข้หวัดใหญ่", status: "pending", requested_at: "2025-05-08" },
  { id: 2, employee: "วิชัย มั่นคง", leave_type: "ลากิจ", start: "2025-05-15", end: "2025-05-15", days: 1, reason: "ธุระส่วนตัว", status: "pending", requested_at: "2025-05-09" },
  { id: 3, employee: "ประสิทธิ์ เชี่ยวชาญ", leave_type: "ลาพักร้อน", start: "2025-06-01", end: "2025-06-05", days: 5, reason: "พักผ่อน", status: "approved", requested_at: "2025-04-30" },
  { id: 4, employee: "มาลี ขยันดี", leave_type: "ลาป่วย", start: "2025-04-25", end: "2025-04-26", days: 2, reason: "ไม่สบาย", status: "approved", requested_at: "2025-04-24" },
  { id: 5, employee: "กานดา สุดสวย", leave_type: "ลากิจ", start: "2025-05-20", end: "2025-05-20", days: 1, reason: "ติดต่อหน่วยงานราชการ", status: "rejected", requested_at: "2025-05-15" },
]

export default function HRLeaveManagement() {
  const [tab, setTab] = useState("pending") // "pending" | "all"
  const [requests, setRequests] = useState(MOCK_REQUESTS)
  const [confirmModal, setConfirmModal] = useState(null) // { id, action }

  const displayed = tab === "pending"
    ? requests.filter((r) => r.status === "pending")
    : requests

  const pendingCount = requests.filter((r) => r.status === "pending").length

  const handleAction = (id, action) => {
    setConfirmModal({ id, action })
  }

  const confirmAction = () => {
    if (!confirmModal) return
    const { id, action } = confirmModal
    setRequests((prev) =>
      prev.map((r) => r.id === id ? { ...r, status: action === "approve" ? "approved" : "rejected" } : r)
    )
    setConfirmModal(null)
  }

  const req = confirmModal ? requests.find((r) => r.id === confirmModal.id) : null

  return (
    <div className="space-y-5 pb-10">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-xl font-bold text-gray-900 dark:text-gray-100">จัดการคำขอลา</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
            รออนุมัติ {pendingCount} รายการ
          </p>
        </div>
        <div className="flex items-center gap-2 rounded-full bg-amber-100 dark:bg-amber-900/30 border border-amber-200 dark:border-amber-700 px-3 py-1.5 text-xs font-semibold text-amber-700 dark:text-amber-300">
          ⚠️ ข้อมูลตัวอย่าง (Mock)
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 rounded-xl bg-gray-100 dark:bg-gray-800 p-1 w-fit">
        {[["pending", "รออนุมัติ"], ["all", "ทั้งหมด"]].map(([v, label]) => (
          <button
            key={v}
            onClick={() => setTab(v)}
            className={`px-4 py-2 rounded-lg text-sm font-semibold transition-all cursor-pointer ${tab === v ? "bg-white dark:bg-gray-700 text-indigo-700 dark:text-indigo-300 shadow-sm" : "text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200"}`}
          >
            {label}
            {v === "pending" && pendingCount > 0 && (
              <span className="ml-1.5 rounded-full bg-amber-500 text-white text-[10px] font-bold px-1.5 py-0.5">
                {pendingCount}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Cards */}
      {displayed.length === 0 ? (
        <div className="rounded-2xl bg-white dark:bg-gray-800 ring-1 ring-gray-200/70 dark:ring-gray-700/70 shadow-sm p-12 text-center">
          <p className="text-3xl mb-3">✅</p>
          <p className="text-sm text-gray-500 dark:text-gray-400">ไม่มีคำขอที่รออนุมัติ</p>
        </div>
      ) : (
        <div className="space-y-3">
          {displayed.map((r) => (
            <div key={r.id} className="rounded-2xl bg-white dark:bg-gray-800 ring-1 ring-gray-200/70 dark:ring-gray-700/70 shadow-sm p-4">
              <div className="flex items-start justify-between gap-3 flex-wrap">
                <div className="flex-1 space-y-2">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="font-semibold text-gray-900 dark:text-gray-100">{r.employee}</p>
                    <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${STATUS_COLOR[r.status]}`}>
                      {STATUS_LABEL[r.status]}
                    </span>
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-sm">
                    <div>
                      <p className="text-xs text-gray-400 dark:text-gray-500">ประเภทการลา</p>
                      <p className="font-medium text-gray-800 dark:text-gray-200">{r.leave_type}</p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-400 dark:text-gray-500">ช่วงเวลา</p>
                      <p className="font-medium text-gray-800 dark:text-gray-200">{r.start} – {r.end}</p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-400 dark:text-gray-500">จำนวนวัน</p>
                      <p className="font-bold text-indigo-700 dark:text-indigo-300">{r.days} วัน</p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-400 dark:text-gray-500">วันที่ยื่น</p>
                      <p className="font-medium text-gray-800 dark:text-gray-200">{r.requested_at}</p>
                    </div>
                  </div>
                  {r.reason && (
                    <p className="text-xs text-gray-500 dark:text-gray-400 bg-gray-50 dark:bg-gray-700/40 rounded-lg px-3 py-1.5">
                      เหตุผล: {r.reason}
                    </p>
                  )}
                </div>

                {r.status === "pending" && (
                  <div className="flex gap-2 shrink-0">
                    <button
                      onClick={() => handleAction(r.id, "approve")}
                      className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-semibold transition-all shadow-sm hover:shadow-md cursor-pointer"
                    >
                      ✓ อนุมัติ
                    </button>
                    <button
                      onClick={() => handleAction(r.id, "reject")}
                      className="px-4 py-2 rounded-xl bg-red-600 hover:bg-red-500 text-white text-sm font-semibold transition-all shadow-sm hover:shadow-md cursor-pointer"
                    >
                      ✕ ปฏิเสธ
                    </button>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      <p className="text-xs text-center text-gray-400 dark:text-gray-600">
        ⚠️ ข้อมูลตัวอย่าง — รอเชื่อมต่อ API เมื่อ backend พร้อม
      </p>

      {/* Confirm Modal */}
      {confirmModal && req && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="w-full max-w-sm rounded-2xl bg-white dark:bg-gray-800 shadow-2xl p-6 space-y-4">
            <h3 className="text-lg font-bold text-gray-900 dark:text-gray-100">
              {confirmModal.action === "approve" ? "✓ ยืนยันอนุมัติ" : "✕ ยืนยันปฏิเสธ"}
            </h3>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              {confirmModal.action === "approve" ? "อนุมัติ" : "ปฏิเสธ"}คำขอลาของ{" "}
              <span className="font-semibold text-gray-900 dark:text-gray-100">{req.employee}</span>{" "}
              ({req.leave_type} · {req.days} วัน)?
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setConfirmModal(null)}
                className="flex-1 h-10 rounded-xl border border-gray-300 dark:border-gray-600 text-sm font-semibold text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700 transition cursor-pointer"
              >
                ยกเลิก
              </button>
              <button
                onClick={confirmAction}
                className={`flex-1 h-10 rounded-xl text-white text-sm font-semibold transition shadow-sm cursor-pointer ${confirmModal.action === "approve" ? "bg-emerald-600 hover:bg-emerald-500" : "bg-red-600 hover:bg-red-500"}`}
              >
                ยืนยัน
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
