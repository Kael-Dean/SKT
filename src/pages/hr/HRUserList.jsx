// src/pages/hr/HRUserList.jsx
// รายชื่อพนักงานทั้งหมด — Admin / HR เท่านั้น (GET /hr/personnel)
import { useEffect, useState, useCallback } from "react"
import { useNavigate } from "react-router-dom"
import { apiAuth } from "../../lib/api"
import SelectDropdown from "../../components/SelectDropdown"

const ROLE_LABEL = { 1: "ผู้ดูแลระบบ", 2: "ผู้จัดการ", 3: "ฝ่ายบุคคล", 4: "หัวหน้าบัญชี", 5: "การตลาด" }
const ROLE_COLOR = {
  1: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300",
  2: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300",
  3: "bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-300",
  4: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300",
  5: "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300",
}

export default function HRUserList() {
  const navigate = useNavigate()
  const [users, setUsers] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")

  const [search, setSearch] = useState("")
  const [filterRole, setFilterRole] = useState("")
  const [filterBranch, setFilterBranch] = useState("")
  const [filterActive, setFilterActive] = useState("true")

  const [branches, setBranches] = useState([])

  useEffect(() => {
    apiAuth("/order/branch/search")
      .then((data) => setBranches((data || []).map((b) => ({ value: String(b.id), label: b.branch_name }))))
      .catch(() => {})
  }, [])

  const fetchUsers = useCallback(() => {
    setLoading(true)
    setError("")
    const params = new URLSearchParams()
    if (search) params.set("name", search)
    if (filterBranch) params.set("branch_id", filterBranch)
    if (filterRole) params.set("position_id", filterRole)
    if (filterActive !== "") params.set("is_active", filterActive)
    apiAuth(`/hr/personnel?${params.toString()}`)
      .then(setUsers)
      .catch((e) => setError(e.message || "โหลดข้อมูลไม่สำเร็จ"))
      .finally(() => setLoading(false))
  }, [search, filterBranch, filterRole, filterActive])

  useEffect(() => {
    const t = setTimeout(fetchUsers, 300)
    return () => clearTimeout(t)
  }, [fetchUsers])

  const activeCount = users.filter((u) => u.is_active).length

  return (
    <div className="space-y-5 pb-10">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-xl font-bold text-gray-900 dark:text-gray-100">รายชื่อพนักงานทั้งหมด</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
            {loading ? "กำลังโหลด..." : `พนักงาน ${users.length} คน · ใช้งานอยู่ ${activeCount} คน`}
          </p>
        </div>
        <div className="flex items-center gap-2 rounded-full bg-emerald-100 dark:bg-emerald-900/30 border border-emerald-200 dark:border-emerald-700 px-3 py-1.5 text-xs font-semibold text-emerald-700 dark:text-emerald-300">
          ✅ เชื่อมต่อ API แล้ว
        </div>
      </div>

      {error && (
        <div className="rounded-xl bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 px-4 py-3 text-sm text-red-700 dark:text-red-300">
          ❌ {error}
        </div>
      )}

      {/* Filters */}
      <div className="rounded-2xl bg-white dark:bg-gray-800 ring-1 ring-gray-200/70 dark:ring-gray-700/70 shadow-sm p-4 flex flex-wrap gap-3">
        <input
          type="text"
          placeholder="ค้นหา ชื่อ-นามสกุล..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="flex-1 min-w-[200px] rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-3 py-2 text-sm text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-indigo-500"
        />
        <div className="w-44 shrink-0">
          <SelectDropdown
            value={filterBranch}
            onChange={setFilterBranch}
            placeholder="ทุกสาขา"
            options={[{ value: "", label: "ทุกสาขา" }, ...branches]}
          />
        </div>
        <div className="w-36 shrink-0">
          <SelectDropdown
            value={filterActive}
            onChange={setFilterActive}
            placeholder="ทุกสถานะ"
            options={[
              { value: "", label: "ทุกสถานะ" },
              { value: "true", label: "ใช้งาน" },
              { value: "false", label: "ไม่ใช้งาน" },
            ]}
          />
        </div>
      </div>

      {/* Table */}
      <div className="rounded-2xl bg-white dark:bg-gray-800 ring-1 ring-gray-200/70 dark:ring-gray-700/70 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/30">
                <th className="text-left px-4 py-3 font-semibold text-gray-600 dark:text-gray-400 text-xs uppercase tracking-wide">รหัส</th>
                <th className="text-left px-4 py-3 font-semibold text-gray-600 dark:text-gray-400 text-xs uppercase tracking-wide">ชื่อ-นามสกุล</th>
                <th className="text-left px-4 py-3 font-semibold text-gray-600 dark:text-gray-400 text-xs uppercase tracking-wide hidden md:table-cell">ตำแหน่ง</th>
                <th className="text-left px-4 py-3 font-semibold text-gray-600 dark:text-gray-400 text-xs uppercase tracking-wide hidden lg:table-cell">สาขา</th>
                <th className="text-left px-4 py-3 font-semibold text-gray-600 dark:text-gray-400 text-xs uppercase tracking-wide">Role</th>
                <th className="text-left px-4 py-3 font-semibold text-gray-600 dark:text-gray-400 text-xs uppercase tracking-wide">สถานะ</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-700/50">
              {loading ? (
                <tr>
                  <td colSpan={6} className="text-center py-10">
                    <div className="flex justify-center">
                      <div className="h-6 w-6 animate-spin rounded-full border-2 border-gray-200 border-t-indigo-500" />
                    </div>
                  </td>
                </tr>
              ) : users.length === 0 ? (
                <tr>
                  <td colSpan={6} className="text-center py-10 text-sm text-gray-400 dark:text-gray-500">
                    ไม่พบข้อมูลพนักงาน
                  </td>
                </tr>
              ) : users.map((u) => (
                <tr
                  key={u.id}
                  onClick={() => navigate(`/hr/personnel/${u.id}`)}
                  className="hover:bg-indigo-50 dark:hover:bg-indigo-900/10 transition-colors cursor-pointer"
                >
                  <td className="px-4 py-3 font-mono text-gray-500 dark:text-gray-400 text-xs">{u.id}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2.5">
                      <div className="h-8 w-8 shrink-0 rounded-xl bg-indigo-100 dark:bg-indigo-900/30 flex items-center justify-center text-xs font-bold text-indigo-700 dark:text-indigo-300">
                        {u.first_name?.[0] ?? "?"}
                      </div>
                      <p className="font-semibold text-gray-900 dark:text-gray-100">
                        {u.first_name} {u.last_name}
                      </p>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-gray-600 dark:text-gray-400 hidden md:table-cell">
                    {u.position ?? "—"}
                  </td>
                  <td className="px-4 py-3 text-gray-600 dark:text-gray-400 hidden lg:table-cell">
                    {u.branch_location ?? "—"}
                  </td>
                  <td className="px-4 py-3">
                    <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${ROLE_COLOR[u.role_id] ?? "bg-gray-100 text-gray-600"}`}>
                      {ROLE_LABEL[u.role_id] ?? `Role ${u.role_id}`}
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
    </div>
  )
}
