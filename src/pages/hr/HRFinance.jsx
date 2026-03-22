// src/pages/hr/HRFinance.jsx
// จัดการข้อมูลการเงินพนักงาน — Admin เท่านั้น
import { useState } from "react"

// Mock data — รอเชื่อม GET /hr/financials
const MOCK_EMPLOYEES = [
  { id: 1, name: "สมชาย ใจดี",     position: "ผู้อำนวยการ",        salary: 55000, loan: 0,      ss: 1650, prov: 2750, job_age: 6 },
  { id: 2, name: "สุภา รักสงบ",    position: "เจ้าหน้าที่บุคคล",   salary: 22000, loan: 5000,  ss: 660,  prov: 1100, job_age: 4 },
  { id: 3, name: "วิชัย มั่นคง",   position: "ผู้จัดการสาขา",      salary: 40000, loan: 10000, ss: 1200, prov: 2000, job_age: 7 },
  { id: 4, name: "นงนุช สุขใจ",    position: "หัวหน้าบัญชี",       salary: 38000, loan: 0,     ss: 1140, prov: 1900, job_age: 8 },
  { id: 5, name: "ประสิทธิ์ เชี่ยวชาญ", position: "นักการตลาด",   salary: 25000, loan: 3000,  ss: 750,  prov: 1250, job_age: 3 },
  { id: 6, name: "มาลี ขยันดี",    position: "พนักงานขาย",          salary: 18000, loan: 2000,  ss: 540,  prov: 900,  job_age: 3 },
  { id: 7, name: "กานดา สุดสวย",   position: "เจ้าหน้าที่บัญชี",   salary: 20000, loan: 0,     ss: 600,  prov: 1000, job_age: 2 },
]

// Mock payslip history
const MOCK_PAYSLIPS = [
  { month: "เมษายน 2568",   total: 55000, deduction: 4400,  net: 50600 },
  { month: "มีนาคม 2568",   total: 55000, deduction: 4400,  net: 50600 },
  { month: "กุมภาพันธ์ 2568", total: 55000, deduction: 4400, net: 50600 },
  { month: "มกราคม 2568",   total: 55000, deduction: 4400,  net: 50600 },
]

const fmt = (n) => Number(n).toLocaleString("th-TH", { minimumFractionDigits: 2 })

export default function HRFinance() {
  const [editModal, setEditModal] = useState(null) // employee object
  const [editForm, setEditForm] = useState({})
  const [employees, setEmployees] = useState(MOCK_EMPLOYEES)
  const [activeTab, setActiveTab] = useState("employees") // "employees" | "payslips"
  const [saved, setSaved] = useState(false)

  const openEdit = (emp) => {
    setEditModal(emp)
    setEditForm({ salary: emp.salary, loan: emp.loan })
    setSaved(false)
  }

  const saveEdit = () => {
    setEmployees((prev) =>
      prev.map((e) => e.id === editModal.id ? { ...e, salary: Number(editForm.salary), loan: Number(editForm.loan) } : e)
    )
    setSaved(true)
    setTimeout(() => setEditModal(null), 800)
  }

  const totalPayroll = employees.reduce((s, e) => s + e.salary, 0)

  return (
    <div className="space-y-5 pb-10">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-xl font-bold text-gray-900 dark:text-gray-100">ข้อมูลการเงินพนักงาน</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
            ยอดเงินเดือนรวม: <span className="font-semibold text-indigo-700 dark:text-indigo-300">{fmt(totalPayroll)} บาท/เดือน</span>
          </p>
        </div>
        <div className="flex items-center gap-2 rounded-full bg-amber-100 dark:bg-amber-900/30 border border-amber-200 dark:border-amber-700 px-3 py-1.5 text-xs font-semibold text-amber-700 dark:text-amber-300">
          ⚠️ ข้อมูลตัวอย่าง (Mock)
        </div>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: "พนักงานทั้งหมด", value: employees.length + " คน", color: "text-indigo-700 dark:text-indigo-300" },
          { label: "เงินเดือนรวม", value: fmt(totalPayroll) + " ฿", color: "text-emerald-700 dark:text-emerald-300" },
          { label: "ประกันสังคมรวม", value: fmt(employees.reduce((s, e) => s + e.ss, 0)) + " ฿", color: "text-blue-700 dark:text-blue-300" },
          { label: "เงินกู้คงเหลือรวม", value: fmt(employees.reduce((s, e) => s + e.loan, 0)) + " ฿", color: "text-red-700 dark:text-red-300" },
        ].map((c) => (
          <div key={c.label} className="rounded-2xl bg-white dark:bg-gray-800 ring-1 ring-gray-200/70 dark:ring-gray-700/70 shadow-sm p-4">
            <p className="text-xs text-gray-500 dark:text-gray-400">{c.label}</p>
            <p className={`text-lg font-bold mt-1 ${c.color}`}>{c.value}</p>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div className="flex gap-1 rounded-xl bg-gray-100 dark:bg-gray-800 p-1 w-fit">
        {[["employees", "รายบุคคล"], ["payslips", "ประวัติสลิป (mock)"]].map(([v, label]) => (
          <button
            key={v}
            onClick={() => setActiveTab(v)}
            className={`px-4 py-2 rounded-lg text-sm font-semibold transition-all cursor-pointer ${activeTab === v ? "bg-white dark:bg-gray-700 text-indigo-700 dark:text-indigo-300 shadow-sm" : "text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200"}`}
          >
            {label}
          </button>
        ))}
      </div>

      {activeTab === "employees" && (
        <div className="rounded-2xl bg-white dark:bg-gray-800 ring-1 ring-gray-200/70 dark:ring-gray-700/70 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/30">
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wide">พนักงาน</th>
                  <th className="text-right px-4 py-3 text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wide">เงินเดือน</th>
                  <th className="text-right px-4 py-3 text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wide hidden sm:table-cell">เงินกู้</th>
                  <th className="text-right px-4 py-3 text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wide hidden md:table-cell">ประกันสังคม</th>
                  <th className="text-right px-4 py-3 text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wide hidden md:table-cell">กองทุนสำรอง</th>
                  <th className="text-center px-4 py-3 text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wide">จัดการ</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-700/50">
                {employees.map((e) => (
                  <tr key={e.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/30 transition-colors">
                    <td className="px-4 py-3">
                      <p className="font-semibold text-gray-900 dark:text-gray-100">{e.name}</p>
                      <p className="text-xs text-gray-500 dark:text-gray-400">{e.position} · {e.job_age} ปี</p>
                    </td>
                    <td className="px-4 py-3 text-right font-semibold text-emerald-700 dark:text-emerald-300">{fmt(e.salary)}</td>
                    <td className="px-4 py-3 text-right text-gray-600 dark:text-gray-400 hidden sm:table-cell">{fmt(e.loan)}</td>
                    <td className="px-4 py-3 text-right text-gray-600 dark:text-gray-400 hidden md:table-cell">{fmt(e.ss)}</td>
                    <td className="px-4 py-3 text-right text-gray-600 dark:text-gray-400 hidden md:table-cell">{fmt(e.prov)}</td>
                    <td className="px-4 py-3 text-center">
                      <button
                        onClick={() => openEdit(e)}
                        className="px-3 py-1.5 rounded-lg bg-indigo-100 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300 text-xs font-semibold hover:bg-indigo-200 dark:hover:bg-indigo-900/50 transition cursor-pointer"
                      >
                        แก้ไข
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {activeTab === "payslips" && (
        <div className="space-y-3">
          <div className="flex items-center gap-2 rounded-lg bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700 px-3 py-2 text-xs text-amber-700 dark:text-amber-300">
            ⚠️ ประวัติสลิปเงินเดือนเป็นข้อมูลตัวอย่าง — รอเชื่อม POST /hr/payslip เมื่อ backend พร้อม
          </div>
          <div className="rounded-2xl bg-white dark:bg-gray-800 ring-1 ring-gray-200/70 dark:ring-gray-700/70 shadow-sm overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/30">
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wide">เดือน</th>
                  <th className="text-right px-4 py-3 text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wide">รายได้รวม</th>
                  <th className="text-right px-4 py-3 text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wide">หักทั้งหมด</th>
                  <th className="text-right px-4 py-3 text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wide">รับสุทธิ</th>
                  <th className="text-center px-4 py-3 text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wide">สลิป</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-700/50">
                {MOCK_PAYSLIPS.map((p, i) => (
                  <tr key={i} className="hover:bg-gray-50 dark:hover:bg-gray-700/30">
                    <td className="px-4 py-3 font-medium text-gray-900 dark:text-gray-100">{p.month}</td>
                    <td className="px-4 py-3 text-right text-gray-700 dark:text-gray-300">{fmt(p.total)}</td>
                    <td className="px-4 py-3 text-right text-red-600 dark:text-red-400">-{fmt(p.deduction)}</td>
                    <td className="px-4 py-3 text-right font-bold text-emerald-700 dark:text-emerald-300">{fmt(p.net)}</td>
                    <td className="px-4 py-3 text-center">
                      <button className="px-3 py-1.5 rounded-lg bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400 text-xs font-semibold hover:bg-gray-200 dark:hover:bg-gray-600 transition cursor-pointer">
                        📄 ดูสลิป
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <button className="w-full h-11 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-sm transition shadow-sm cursor-pointer">
            + สร้างสลิปเงินเดือนประจำเดือน
          </button>
        </div>
      )}

      <p className="text-xs text-center text-gray-400 dark:text-gray-600">
        ⚠️ ข้อมูลตัวอย่าง — รอเชื่อมต่อ API เมื่อ backend พร้อม
      </p>

      {/* Edit Modal */}
      {editModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="w-full max-w-sm rounded-2xl bg-white dark:bg-gray-800 shadow-2xl p-6 space-y-4">
            <h3 className="text-lg font-bold text-gray-900 dark:text-gray-100">
              แก้ไขข้อมูลการเงิน
            </h3>
            <p className="text-sm text-gray-600 dark:text-gray-400">{editModal.name} · {editModal.position}</p>
            <div className="space-y-3">
              <div>
                <label className="text-xs font-medium text-gray-600 dark:text-gray-400 block mb-1">เงินเดือน (บาท)</label>
                <input
                  type="number"
                  value={editForm.salary}
                  onChange={(e) => setEditForm((p) => ({ ...p, salary: e.target.value }))}
                  className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-3 py-2 text-sm text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
              <div>
                <label className="text-xs font-medium text-gray-600 dark:text-gray-400 block mb-1">เงินกู้สหกรณ์คงเหลือ (บาท)</label>
                <input
                  type="number"
                  value={editForm.loan}
                  onChange={(e) => setEditForm((p) => ({ ...p, loan: e.target.value }))}
                  className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-3 py-2 text-sm text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
            </div>
            {saved && (
              <div className="rounded-lg bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-700 px-3 py-2 text-sm text-emerald-700 dark:text-emerald-300 text-center">
                ✅ บันทึกสำเร็จ
              </div>
            )}
            <div className="flex gap-3">
              <button
                onClick={() => setEditModal(null)}
                className="flex-1 h-10 rounded-xl border border-gray-300 dark:border-gray-600 text-sm font-semibold text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700 transition cursor-pointer"
              >
                ยกเลิก
              </button>
              <button
                onClick={saveEdit}
                className="flex-1 h-10 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-semibold transition shadow-sm cursor-pointer"
              >
                บันทึก
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
