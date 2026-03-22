// src/pages/hr/HRRelocation.jsx
// ย้ายสาขาพนักงาน — Admin เท่านั้น
import { useEffect, useState } from "react"
import { apiAuth } from "../../lib/api"
import SelectDropdown from "../../components/SelectDropdown"

// Fallback branches ใช้เมื่อ API ยังไม่พร้อม
const FALLBACK_BRANCHES = [
  { id: 1, name: "สำนักงานใหญ่", province: "สุรินทร์" },
  { id: 2, name: "สาขาท่าตูม", province: "สุรินทร์" },
  { id: 3, name: "สาขารัตนบุรี", province: "สุรินทร์" },
  { id: 4, name: "สาขาสังขะ", province: "สุรินทร์" },
]

// Mock employees
const MOCK_EMPLOYEES = [
  { id: 1, name: "สมชาย ใจดี",       branch_id: 1, branch: "สำนักงานใหญ่", position: "ผู้อำนวยการ" },
  { id: 2, name: "สุภา รักสงบ",      branch_id: 1, branch: "สำนักงานใหญ่", position: "เจ้าหน้าที่บุคคล" },
  { id: 3, name: "วิชัย มั่นคง",     branch_id: 2, branch: "สาขาท่าตูม",   position: "ผู้จัดการสาขา" },
  { id: 4, name: "นงนุช สุขใจ",      branch_id: 1, branch: "สำนักงานใหญ่", position: "หัวหน้าบัญชี" },
  { id: 5, name: "ประสิทธิ์ เชี่ยวชาญ", branch_id: 3, branch: "สาขารัตนบุรี", position: "นักการตลาด" },
  { id: 6, name: "มาลี ขยันดี",      branch_id: 2, branch: "สาขาท่าตูม",   position: "พนักงานขาย" },
  { id: 7, name: "กานดา สุดสวย",     branch_id: 1, branch: "สำนักงานใหญ่", position: "เจ้าหน้าที่บัญชี" },
]

// Mock relocation history
const MOCK_HISTORY = [
  { id: 1, employee: "วิชัย มั่นคง",     from: "สำนักงานใหญ่", to: "สาขาท่าตูม",    date: "2022-10-01", note: "ขยายสาขา" },
  { id: 2, employee: "ประสิทธิ์ เชี่ยวชาญ", from: "สำนักงานใหญ่", to: "สาขารัตนบุรี", date: "2023-01-15", note: "โอนย้ายตามคำขอ" },
  { id: 3, employee: "มาลี ขยันดี",      from: "สำนักงานใหญ่", to: "สาขาท่าตูม",    date: "2023-05-01", note: "" },
]

export default function HRRelocation() {
  const [employees, setEmployees] = useState(MOCK_EMPLOYEES)
  const [history, setHistory] = useState(MOCK_HISTORY)
  const [modal, setModal] = useState(null) // employee
  const [targetBranch, setTargetBranch] = useState("")
  const [note, setNote] = useState("")
  const [done, setDone] = useState(false)
  const [activeTab, setActiveTab] = useState("current") // "current" | "history"

  // สาขา — ดึงจาก BE จริง (เหมือนหน้ารายงาน)
  const [branches, setBranches] = useState(FALLBACK_BRANCHES)
  const [loadingBranches, setLoadingBranches] = useState(true)

  useEffect(() => {
    apiAuth("/order/branch/search")
      .then((data) => {
        const mapped = (data || []).map((b) => ({
          id: b.id,
          name: b.branch_name,
          province: b.province ?? "",
        }))
        if (mapped.length > 0) setBranches(mapped)
      })
      .catch(() => {})
      .finally(() => setLoadingBranches(false))
  }, [])

  const openModal = (emp) => {
    setModal(emp)
    setTargetBranch("")
    setNote("")
    setDone(false)
  }

  const handleRelocate = () => {
    if (!targetBranch) return
    const branch = branches.find((b) => b.id === Number(targetBranch))
    setHistory((prev) => [
      { id: prev.length + 1, employee: modal.name, from: modal.branch, to: branch.name, date: new Date().toISOString().slice(0, 10), note },
      ...prev,
    ])
    setEmployees((prev) => prev.map((e) => e.id === modal.id ? { ...e, branch_id: branch.id, branch: branch.name } : e))
    setDone(true)
  }

  return (
    <div className="space-y-5 pb-10">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-xl font-bold text-gray-900 dark:text-gray-100">ย้ายสาขาพนักงาน</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">จัดการการโอนย้ายสาขาพนักงาน</p>
        </div>
        <div className="flex items-center gap-2 rounded-full bg-amber-100 dark:bg-amber-900/30 border border-amber-200 dark:border-amber-700 px-3 py-1.5 text-xs font-semibold text-amber-700 dark:text-amber-300">
          ⚠️ ข้อมูลตัวอย่าง (Mock)
        </div>
      </div>

      {/* Branch summary */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {branches.map((b) => {
          const count = employees.filter((e) => e.branch_id === b.id).length
          return (
            <div key={b.id} className="rounded-2xl bg-white dark:bg-gray-800 ring-1 ring-gray-200/70 dark:ring-gray-700/70 shadow-sm p-4 text-center">
              <p className="text-2xl font-bold text-indigo-700 dark:text-indigo-300">{count}</p>
              <p className="text-xs font-semibold text-gray-800 dark:text-gray-200 mt-0.5">{b.name}</p>
              <p className="text-xs text-gray-400">{b.province}</p>
            </div>
          )
        })}
      </div>

      {/* Tabs */}
      <div className="flex gap-1 rounded-xl bg-gray-100 dark:bg-gray-800 p-1 w-fit">
        {[["current", "พนักงานปัจจุบัน"], ["history", "ประวัติย้ายสาขา"]].map(([v, label]) => (
          <button
            key={v}
            onClick={() => setActiveTab(v)}
            className={`px-4 py-2 rounded-lg text-sm font-semibold transition-all cursor-pointer ${activeTab === v ? "bg-white dark:bg-gray-700 text-indigo-700 dark:text-indigo-300 shadow-sm" : "text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200"}`}
          >
            {label}
          </button>
        ))}
      </div>

      {activeTab === "current" && (
        <div className="rounded-2xl bg-white dark:bg-gray-800 ring-1 ring-gray-200/70 dark:ring-gray-700/70 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/30">
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wide">พนักงาน</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wide">สาขาปัจจุบัน</th>
                  <th className="text-center px-4 py-3 text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wide">จัดการ</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-700/50">
                {employees.map((e) => (
                  <tr key={e.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/30 transition-colors">
                    <td className="px-4 py-3">
                      <p className="font-semibold text-gray-900 dark:text-gray-100">{e.name}</p>
                      <p className="text-xs text-gray-500 dark:text-gray-400">{e.position}</p>
                    </td>
                    <td className="px-4 py-3">
                      <span className="rounded-full bg-indigo-50 dark:bg-indigo-900/20 text-indigo-700 dark:text-indigo-300 px-3 py-1 text-xs font-semibold">
                        {e.branch}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <button
                        onClick={() => openModal(e)}
                        className="px-3 py-1.5 rounded-lg bg-indigo-100 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300 text-xs font-semibold hover:bg-indigo-200 dark:hover:bg-indigo-900/50 transition cursor-pointer"
                      >
                        ย้ายสาขา
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {activeTab === "history" && (
        <div className="rounded-2xl bg-white dark:bg-gray-800 ring-1 ring-gray-200/70 dark:ring-gray-700/70 shadow-sm overflow-hidden">
          {history.length === 0 ? (
            <p className="text-center py-10 text-sm text-gray-400 dark:text-gray-500">ยังไม่มีประวัติการย้ายสาขา</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-100 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/30">
                    <th className="text-left px-4 py-3 text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wide">พนักงาน</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wide">จาก</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wide">ไปยัง</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wide hidden sm:table-cell">วันที่</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wide hidden md:table-cell">หมายเหตุ</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-gray-700/50">
                  {history.map((h) => (
                    <tr key={h.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/30">
                      <td className="px-4 py-3 font-semibold text-gray-900 dark:text-gray-100">{h.employee}</td>
                      <td className="px-4 py-3 text-gray-600 dark:text-gray-400">{h.from}</td>
                      <td className="px-4 py-3">
                        <span className="rounded-full bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-300 px-2.5 py-0.5 text-xs font-semibold">
                          {h.to}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-gray-500 dark:text-gray-400 hidden sm:table-cell">{h.date}</td>
                      <td className="px-4 py-3 text-gray-500 dark:text-gray-400 hidden md:table-cell">{h.note || "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      <p className="text-xs text-center text-gray-400 dark:text-gray-600">
        ⚠️ ข้อมูลตัวอย่าง — รอเชื่อมต่อ POST /hr/relocate เมื่อ backend พร้อม
      </p>

      {/* Relocate Modal */}
      {modal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="w-full max-w-sm rounded-2xl bg-white dark:bg-gray-800 shadow-2xl p-6 space-y-4">
            {done ? (
              <div className="text-center space-y-3 py-4">
                <div className="text-4xl">✅</div>
                <p className="font-bold text-gray-900 dark:text-gray-100">ย้ายสาขาสำเร็จ!</p>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  {modal.name} → {branches.find((b) => b.id === Number(targetBranch))?.name}
                </p>
                <button
                  onClick={() => setModal(null)}
                  className="w-full h-10 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-semibold transition cursor-pointer"
                >
                  ปิด
                </button>
              </div>
            ) : (
              <>
                <h3 className="text-lg font-bold text-gray-900 dark:text-gray-100">ย้ายสาขา</h3>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  {modal.name} · สาขาปัจจุบัน:{" "}
                  <span className="font-semibold text-indigo-700 dark:text-indigo-300">{modal.branch}</span>
                </p>
                <div className="space-y-3">
                  <div>
                    <label className="text-xs font-medium text-gray-600 dark:text-gray-400 block mb-1">
                      สาขาปลายทาง <span className="text-red-500">*</span>
                    </label>
                    <SelectDropdown
                      value={targetBranch}
                      onChange={setTargetBranch}
                      loading={loadingBranches}
                      placeholder="— เลือกสาขาปลายทาง —"
                      options={branches
                        .filter((b) => b.id !== modal.branch_id)
                        .map((b) => ({
                          value: b.id,
                          label: b.name,
                          sublabel: b.province || undefined,
                        }))}
                    />
                  </div>
                  <div>
                    <label className="text-xs font-medium text-gray-600 dark:text-gray-400 block mb-1">หมายเหตุ</label>
                    <input
                      type="text"
                      value={note}
                      onChange={(e) => setNote(e.target.value)}
                      placeholder="ระบุเหตุผลการย้าย (ถ้ามี)"
                      className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-3 py-2 text-sm text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>
                </div>
                <div className="flex gap-3">
                  <button
                    onClick={() => setModal(null)}
                    className="flex-1 h-10 rounded-xl border border-gray-300 dark:border-gray-600 text-sm font-semibold text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700 transition cursor-pointer"
                  >
                    ยกเลิก
                  </button>
                  <button
                    onClick={handleRelocate}
                    disabled={!targetBranch}
                    className="flex-1 h-10 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-semibold transition shadow-sm cursor-pointer"
                  >
                    ยืนยันย้ายสาขา
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
