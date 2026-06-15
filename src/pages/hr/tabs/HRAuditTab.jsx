// src/pages/hr/tabs/HRAuditTab.jsx
// ประวัติระบบ — GET /hr/audit-log
import { useEffect, useState, useCallback } from "react"
import { apiAuth } from "../../../lib/api"
import { ErrorState, EmptyState, SkeletonTableRows } from "../../../components/ui"

function fmtDateTime(d) {
  if (!d) return "—"
  try {
    return new Date(d).toLocaleString("th-TH", { dateStyle: "short", timeStyle: "short" })
  } catch { return d }
}

export default function HRAuditTab() {
  const [logs, setLogs] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")

  const [search, setSearch] = useState("")

  const fetchLogs = useCallback(() => {
    setLoading(true)
    setError("")
    const params = new URLSearchParams()
    if (search) params.set("q", search)
    apiAuth(`/hr/audit-log?${params.toString()}`)
      .then(setLogs)
      .catch((e) => setError(e.message || "โหลดข้อมูลไม่สำเร็จ"))
      .finally(() => setLoading(false))
  }, [search])

  useEffect(() => {
    const t = setTimeout(fetchLogs, 400)
    return () => clearTimeout(t)
  }, [fetchLogs])

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3 flex-wrap">
        <input
          type="text"
          placeholder="ค้นหาการกระทำ / ผู้ใช้..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="flex-1 min-w-[200px] rounded-xl border border-slate-300 bg-slate-100 px-3 py-2 text-sm text-slate-900 outline-none placeholder:text-slate-400 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/25 transition dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100 dark:placeholder:text-slate-400 dark:focus:border-indigo-400"
        />
        <p className="text-sm text-gray-500 dark:text-gray-400 shrink-0">
          {loading ? "กำลังโหลด..." : `${logs.length} รายการ`}
        </p>
      </div>

      {error && <ErrorState message={error} onRetry={fetchLogs} />}

      <div className="rounded-2xl bg-white dark:bg-gray-800 ring-1 ring-gray-200/70 dark:ring-gray-700/70 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/30">
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 dark:text-gray-400">เวลา</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 dark:text-gray-400">ผู้ใช้</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 dark:text-gray-400">การกระทำ</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 dark:text-gray-400 hidden lg:table-cell">รายละเอียด</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-700/50">
              {loading ? (
                <SkeletonTableRows rows={10} cols={4} />
              ) : logs.length === 0 ? (
                <tr><td colSpan={4}>
                  <EmptyState
                    title="ไม่พบข้อมูลประวัติระบบ"
                    description={search ? "ไม่พบรายการที่ตรงกับคำค้น ลองปรับคำค้นหาใหม่" : "ยังไม่มีบันทึกการกระทำในระบบ"}
                    action={search ? (
                      <button
                        type="button"
                        onClick={() => setSearch("")}
                        className="inline-flex items-center justify-center gap-2 rounded-2xl border border-indigo-300 bg-white px-4 py-2 text-sm font-medium text-indigo-700 shadow-sm transition-colors duration-150 hover:bg-indigo-50 cursor-pointer dark:border-indigo-700 dark:bg-transparent dark:text-indigo-300 dark:hover:bg-indigo-900/20"
                      >
                        ล้างตัวกรอง
                      </button>
                    ) : null}
                  />
                </td></tr>
              ) : logs.map((log, i) => (
                <tr key={log.id ?? i} className="hover:bg-gray-50 dark:hover:bg-gray-700/30">
                  <td className="px-4 py-3 text-xs text-gray-500 dark:text-gray-400 whitespace-nowrap tabular-nums">{fmtDateTime(log.timestamp ?? log.created_at)}</td>
                  <td className="px-4 py-3 text-gray-700 dark:text-gray-300 tabular-nums">{log.user_id ?? log.username ?? "—"}</td>
                  <td className="px-4 py-3">
                    <span className="rounded-full bg-indigo-100 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300 px-2.5 py-0.5 text-xs font-semibold">
                      {log.action ?? "—"}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-xs text-gray-500 dark:text-gray-400 hidden lg:table-cell max-w-xs truncate">
                    {log.detail ?? log.description ?? "—"}
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
