// src/pages/hr/HRUserList.jsx
// รายชื่อพนักงานทั้งหมด — Admin / HR เท่านั้น
import { useState } from "react"

const ROLE_LABEL = { 1: "ผู้ดูแลระบบ", 2: "ผู้จัดการ", 3: "ฝ่ายบุคคล", 4: "หัวหน้าบัญชี", 5: "การตลาด" }
const ROLE_COLOR = {
  1: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300",
  2: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300",
  3: "bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-300",
  4: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300",
  5: "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300",
}

// Mock data — รอเชื่อมต่อ GET /hr/users
const MOCK_USERS = [
  { id: 1, first_name: "สมชาย", last_name: "ใจดี", username: "Sjai", email: "somchai@skt.coop", role_id: 1, position_title: "ผู้อำนวยการ", branch_name: "สำนักงานใหญ่", is_active: true, hired: "2020-04-01" },
  { id: 2, first_name: "สุภา", last_name: "รักสงบ", username: "Srak", email: "supa@skt.coop", role_id: 3, position_title: "เจ้าหน้าที่บุคคล", branch_name: "สำนักงานใหญ่", is_active: true, hired: "2021-06-15" },
  { id: 3, first_name: "วิชัย", last_name: "มั่นคง", username: "Vman", email: "vichai@skt.coop", role_id: 2, position_title: "ผู้จัดการสาขา", branch_name: "สาขาท่าตูม", is_active: true, hired: "2019-09-01" },
  { id: 4, first_name: "นงนุช", last_name: "สุขใจ", username: "Nsuk", email: "nongnuch@skt.coop", role_id: 4, position_title: "หัวหน้าบัญชี", branch_name: "สำนักงานใหญ่", is_active: true, hired: "2018-04-01" },
  { id: 5, first_name: "ประสิทธิ์", last_name: "เชี่ยวชาญ", username: "Pche", email: "prasit@skt.coop", role_id: 5, position_title: "นักการตลาด", branch_name: "สาขารัตนบุรี", is_active: true, hired: "2022-01-10" },
  { id: 6, first_name: "มาลี", last_name: "ขยันดี", username: "Mkha", email: "malee@skt.coop", role_id: 5, position_title: "พนักงานขาย", branch_name: "สาขาท่าตูม", is_active: true, hired: "2022-08-01" },
  { id: 7, first_name: "ธวัชชัย", last_name: "ตั้งใจ", username: "Ttan", email: "tawat@skt.coop", role_id: 3, position_title: "เจ้าหน้าที่บุคคล", branch_name: "สาขารัตนบุรี", is_active: false, hired: "2020-11-01" },
  { id: 8, first_name: "กานดา", last_name: "สุดสวย", username: "Ksud", email: "kanda@skt.coop", role_id: 4, position_title: "เจ้าหน้าที่บัญชี", branch_name: "สำนักงานใหญ่", is_active: true, hired: "2023-03-01" },
]

export default function HRUserList() {
  const [search, setSearch] = useState("")
  const [filterRole, setFilterRole] = useState("")
  const [filterActive, setFilterActive] = useState("")

  const filtered = MOCK_USERS.filter((u) => {
    const q = search.toLowerCase()
    const matchSearch = !q || [u.first_name, u.last_name, u.username, u.email, u.position_title]
      .some((v) => v?.toLowerCase().includes(q))
    const matchRole = !filterRole || String(u.role_id) === filterRole
    const matchActive = filterActive === "" || String(u.is_active) === filterActive
    return matchSearch && matchRole && matchActive
  })

  const activeCount = MOCK_USERS.filter((u) => u.is_active).length

  return (
    <div className="space-y-5 pb-10">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-xl font-bold text-gray-900 dark:text-gray-100">รายชื่อพนักงานทั้งหมด</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
            พนักงานทั้งหมด {MOCK_USERS.length} คน · ใช้งานอยู่ {activeCount} คน
          </p>
        </div>
        <div className="flex items-center gap-2 rounded-full bg-amber-100 dark:bg-amber-900/30 border border-amber-200 dark:border-amber-700 px-3 py-1.5 text-xs font-semibold text-amber-700 dark:text-amber-300">
          ⚠️ ข้อมูลตัวอย่าง (Mock) — รอเชื่อม API
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {Object.entries(ROLE_LABEL).map(([id, label]) => {
          const count = MOCK_USERS.filter((u) => u.role_id === Number(id)).length
          return (
            <div key={id} className="rounded-2xl bg-white dark:bg-gray-800 ring-1 ring-gray-200/70 dark:ring-gray-700/70 shadow-sm p-4 text-center">
              <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">{count}</p>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{label}</p>
            </div>
          )
        })}
      </div>

      {/* Filters */}
      <div className="rounded-2xl bg-white dark:bg-gray-800 ring-1 ring-gray-200/70 dark:ring-gray-700/70 shadow-sm p-4 flex flex-wrap gap-3">
        <input
          type="text"
          placeholder="ค้นหา ชื่อ, username, email..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="flex-1 min-w-[200px] rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-3 py-2 text-sm text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-indigo-500"
        />
        <select
          value={filterRole}
          onChange={(e) => setFilterRole(e.target.value)}
          className="rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-3 py-2 text-sm text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-indigo-500"
        >
          <option value="">ทุก Role</option>
          {Object.entries(ROLE_LABEL).map(([id, label]) => (
            <option key={id} value={id}>{label}</option>
          ))}
        </select>
        <select
          value={filterActive}
          onChange={(e) => setFilterActive(e.target.value)}
          className="rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-3 py-2 text-sm text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-indigo-500"
        >
          <option value="">ทุกสถานะ</option>
          <option value="true">ใช้งาน</option>
          <option value="false">ไม่ใช้งาน</option>
        </select>
      </div>

      {/* Table */}
      <div className="rounded-2xl bg-white dark:bg-gray-800 ring-1 ring-gray-200/70 dark:ring-gray-700/70 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/30">
                <th className="text-left px-4 py-3 font-semibold text-gray-600 dark:text-gray-400 text-xs uppercase tracking-wide">รหัส</th>
                <th className="text-left px-4 py-3 font-semibold text-gray-600 dark:text-gray-400 text-xs uppercase tracking-wide">ชื่อ-นามสกุล</th>
                <th className="text-left px-4 py-3 font-semibold text-gray-600 dark:text-gray-400 text-xs uppercase tracking-wide hidden sm:table-cell">Username</th>
                <th className="text-left px-4 py-3 font-semibold text-gray-600 dark:text-gray-400 text-xs uppercase tracking-wide hidden md:table-cell">ตำแหน่ง</th>
                <th className="text-left px-4 py-3 font-semibold text-gray-600 dark:text-gray-400 text-xs uppercase tracking-wide hidden lg:table-cell">สาขา</th>
                <th className="text-left px-4 py-3 font-semibold text-gray-600 dark:text-gray-400 text-xs uppercase tracking-wide">Role</th>
                <th className="text-left px-4 py-3 font-semibold text-gray-600 dark:text-gray-400 text-xs uppercase tracking-wide">สถานะ</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-700/50">
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={7} className="text-center py-10 text-sm text-gray-400 dark:text-gray-500">
                    ไม่พบข้อมูลที่ตรงกับการค้นหา
                  </td>
                </tr>
              ) : filtered.map((u) => (
                <tr key={u.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/30 transition-colors">
                  <td className="px-4 py-3 font-mono text-gray-500 dark:text-gray-400 text-xs">{u.id}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2.5">
                      <div className="h-8 w-8 shrink-0 rounded-xl bg-indigo-100 dark:bg-indigo-900/30 flex items-center justify-center text-xs font-bold text-indigo-700 dark:text-indigo-300">
                        {u.first_name[0]}
                      </div>
                      <div>
                        <p className="font-semibold text-gray-900 dark:text-gray-100">{u.first_name} {u.last_name}</p>
                        <p className="text-xs text-gray-500 dark:text-gray-400 hidden sm:hidden md:block">{u.email}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3 font-mono text-gray-700 dark:text-gray-300 hidden sm:table-cell">{u.username}</td>
                  <td className="px-4 py-3 text-gray-600 dark:text-gray-400 hidden md:table-cell">{u.position_title}</td>
                  <td className="px-4 py-3 text-gray-600 dark:text-gray-400 hidden lg:table-cell">{u.branch_name}</td>
                  <td className="px-4 py-3">
                    <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${ROLE_COLOR[u.role_id] ?? "bg-gray-100 text-gray-600"}`}>
                      {ROLE_LABEL[u.role_id] ?? u.role_id}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${u.is_active ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300" : "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300"}`}>
                      {u.is_active ? "ใช้งาน" : "ไม่ใช้งาน"}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <p className="text-xs text-center text-gray-400 dark:text-gray-600">
        ⚠️ ข้อมูลตัวอย่าง — รอเชื่อมต่อ GET /hr/users เมื่อ backend พร้อม
      </p>
    </div>
  )
}
