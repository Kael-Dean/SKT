// src/pages/hr/HRUserList.jsx
// รายชื่อเจ้าหน้าที่ทั้งหมด — Admin / HR เท่านั้น (GET /hr/personnel)
import { useEffect, useState, useCallback } from "react"
import { useNavigate } from "react-router-dom"
import { apiAuth } from "../../lib/api"
import { cx } from "../../lib/styles"
import { ErrorState, EmptyState, Badge, SkeletonTableRows } from "../../components/ui"

import SelectDropdown from "../../components/SelectDropdown"

const COLS = 6 // รหัส · ชื่อ-นามสกุล · ตำแหน่ง · สาขา · Role · สถานะ

const ROLE_LABEL = { 1: "ผู้ดูแลระบบ", 2: "ผู้จัดการ", 3: "ฝ่ายบุคคล", 4: "หัวหน้าบัญชี", 5: "การตลาด" }
// 5 ตำแหน่งให้สีเฉพาะตัว (เกินขอบเขต tone กลางของ Badge) — เก็บ map เดิมไว้
const ROLE_COLOR = {
  1: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300",
  2: "bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-300",
  3: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300",
  4: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300",
  5: "bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300",
}

const thCls =
  "text-left px-4 py-3 font-semibold text-gray-600 dark:text-gray-400 text-xs uppercase tracking-wide"

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

  // มีตัวกรองที่ทำงานอยู่หรือไม่ (ใช้ตัดสินใจข้อความ empty + ปุ่มล้างตัวกรอง)
  const hasActiveFilters =
    !!search || !!filterRole || !!filterBranch || filterActive !== "true"

  const clearFilters = () => {
    setSearch("")
    setFilterRole("")
    setFilterBranch("")
    setFilterActive("true")
  }

  return (
    <div className="space-y-5 pb-10">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-xl font-bold text-gray-900 dark:text-gray-100">รายชื่อเจ้าหน้าที่ทั้งหมด</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
            {loading ? "กำลังโหลด…" : `เจ้าหน้าที่ ${users.length} คน · ใช้งานอยู่ ${activeCount} คน`}
          </p>
        </div>
        <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-100 dark:bg-emerald-900/30 border border-emerald-200 dark:border-emerald-700 px-3 py-1.5 text-xs font-semibold text-emerald-700 dark:text-emerald-300">
          <span className="size-1.5 rounded-full bg-emerald-500 dark:bg-emerald-400" aria-hidden="true" />
          เชื่อมต่อ API แล้ว
        </span>
      </div>

      {error && <ErrorState message={error} onRetry={fetchUsers} />}

      {/* Filters */}
      <div className="rounded-2xl bg-white dark:bg-gray-800 ring-1 ring-gray-200/70 dark:ring-gray-700/70 shadow-sm p-4 flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[200px]">
          <svg
            aria-hidden="true"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 size-4 text-slate-400 dark:text-slate-500"
          >
            <circle cx="11" cy="11" r="8" />
            <path d="m21 21-4.3-4.3" />
          </svg>
          <input
            type="text"
            placeholder="ค้นหา ชื่อ-นามสกุล…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            aria-label="ค้นหาเจ้าหน้าที่ตามชื่อ-นามสกุล"
            className="w-full rounded-xl border border-slate-300 bg-slate-100 pl-9 pr-3 py-2 text-[15px] text-slate-900 outline-none placeholder:text-slate-400 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/25 transition-colors duration-150 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100 dark:placeholder:text-slate-400 dark:focus:border-indigo-400 dark:focus:ring-indigo-400/25"
          />
        </div>
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
        {hasActiveFilters && (
          <button
            type="button"
            onClick={clearFilters}
            className="shrink-0 inline-flex items-center gap-1.5 rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-600 transition-colors duration-150 hover:bg-slate-100 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700/60 cursor-pointer"
          >
            <svg
              aria-hidden="true"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="size-4"
            >
              <path d="M18 6 6 18" />
              <path d="m6 6 12 12" />
            </svg>
            ล้างตัวกรอง
          </button>
        )}
      </div>

      {/* Table */}
      <div className="rounded-2xl bg-white dark:bg-gray-800 ring-1 ring-gray-200/70 dark:ring-gray-700/70 shadow-sm overflow-hidden">
        <div className="overflow-x-auto" aria-busy={loading ? "true" : "false"}>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/40">
                <th className={thCls}>รหัส</th>
                <th className={thCls}>ชื่อ-นามสกุล</th>
                <th className={cx(thCls, "hidden md:table-cell")}>ตำแหน่ง</th>
                <th className={cx(thCls, "hidden lg:table-cell")}>สาขา</th>
                <th className={thCls}>Role</th>
                <th className={thCls}>สถานะ</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-700/50">
              {loading ? (
                <SkeletonTableRows rows={8} cols={COLS} />
              ) : users.length === 0 ? (
                <tr>
                  <td colSpan={COLS} className="p-0">
                    {hasActiveFilters ? (
                      <EmptyState
                        title="ไม่พบเจ้าหน้าที่ตามตัวกรอง"
                        description="ไม่มีรายชื่อที่ตรงกับเงื่อนไขที่เลือก ลองปรับคำค้นหรือล้างตัวกรองเพื่อดูทั้งหมด"
                        action={
                          <button
                            type="button"
                            onClick={clearFilters}
                            className="inline-flex items-center gap-1.5 rounded-xl border border-indigo-300 bg-white px-4 py-2 text-sm font-medium text-indigo-700 transition-colors duration-150 hover:bg-indigo-50 dark:border-indigo-700 dark:bg-transparent dark:text-indigo-300 dark:hover:bg-indigo-900/20 cursor-pointer"
                          >
                            ล้างตัวกรอง
                          </button>
                        }
                      />
                    ) : (
                      <EmptyState
                        title="ยังไม่มีข้อมูลเจ้าหน้าที่"
                        description="เมื่อมีการเพิ่มเจ้าหน้าที่เข้าระบบ รายชื่อจะแสดงที่นี่"
                      />
                    )}
                  </td>
                </tr>
              ) : (
                users.map((u) => (
                  <tr
                    key={u.id}
                    onClick={() => navigate(`/hr/personnel/${u.id}`)}
                    className="even:bg-gray-50/60 dark:even:bg-gray-900/20 hover:bg-indigo-50 dark:hover:bg-indigo-900/15 transition-colors duration-150 cursor-pointer"
                  >
                    <td className="px-4 py-3 font-mono text-gray-500 dark:text-gray-400 text-xs tabular-nums">{u.id}</td>
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
                      <span className={cx(
                        "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold",
                        ROLE_COLOR[u.role_id] ?? "bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300",
                      )}>
                        {ROLE_LABEL[u.role_id] ?? `Role ${u.role_id}`}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <Badge tone={u.is_active ? "success" : "danger"}>
                        {u.is_active ? "ใช้งาน" : "ไม่ใช้งาน"}
                      </Badge>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
