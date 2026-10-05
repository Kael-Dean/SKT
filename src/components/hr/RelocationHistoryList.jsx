// src/components/hr/RelocationHistoryList.jsx
// 3E — ประวัติย้ายสาขารายบุคคล (รวมทั้งย้ายโดยตรงและคำขอที่อนุมัติแล้ว)
// GET /hr/employees/{id}/relocation-history
//   → [{id, from_branch_id, from_branch_name, to_branch_id, to_branch_name, date, reason, authorized_by}]
// authorized_by เป็น user id → แปลงเป็นชื่อผ่าน GET /hr/personnel/{id} (cache ระดับ module)
import { useCallback, useEffect, useState } from "react"
import { apiAuth } from "../../lib/api"
import { Skeleton, ErrorState } from "../ui"

const nameCache = new Map() // userId → Promise<string|null>

function fetchPersonName(userId) {
  const key = String(userId)
  if (!nameCache.has(key)) {
    nameCache.set(key, apiAuth(`/hr/personnel/${userId}`)
      .then((p) => `${p?.first_name ?? ""} ${p?.last_name ?? ""}`.trim() || null)
      .catch(() => { nameCache.delete(key); return null }))
  }
  return nameCache.get(key)
}

function fmtThaiDate(value) {
  if (!value) return "—"
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(value))
  const d = m ? new Date(+m[1], +m[2] - 1, +m[3]) : new Date(value)
  if (Number.isNaN(d.getTime())) return String(value)
  return d.toLocaleDateString("th-TH", { day: "numeric", month: "short", year: "numeric" })
}

export default function RelocationHistoryList({ userId, refreshKey = 0 }) {
  const [rows, setRows] = useState([])
  const [names, setNames] = useState({})
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")

  const load = useCallback(() => {
    if (!userId) return
    setLoading(true)
    setError("")
    apiAuth(`/hr/employees/${userId}/relocation-history`)
      .then((data) => {
        const list = Array.isArray(data) ? data : []
        setRows(list)
        const ids = [...new Set(list.map((r) => r.authorized_by).filter((v) => v != null))]
        ids.forEach((uid) => {
          fetchPersonName(uid).then((n) => {
            const label = n ?? `ผู้ใช้ #${uid}`
            setNames((prev) => (prev[uid] === label ? prev : { ...prev, [uid]: label }))
          })
        })
      })
      .catch((e) => setError(e.message || "โหลดประวัติย้ายสาขาไม่สำเร็จ"))
      .finally(() => setLoading(false))
  }, [userId])

  useEffect(() => { load() }, [load, refreshKey])

  if (loading) {
    return (
      <div className="space-y-2" aria-busy="true" aria-label="กำลังโหลดประวัติย้ายสาขา">
        <Skeleton className="h-12 w-full" />
        <Skeleton className="h-12 w-full" />
      </div>
    )
  }
  if (error) return <ErrorState message={error} onRetry={load} />
  if (rows.length === 0) {
    return (
      <p className="py-3 text-sm text-gray-500 dark:text-gray-400">
        ยังไม่มีประวัติย้ายสาขา
      </p>
    )
  }

  // ล่าสุดอยู่บนสุด
  const ordered = [...rows].reverse()

  return (
    <div className="overflow-x-auto -mx-1">
      <table className="w-full min-w-[560px] text-sm">
        <caption className="sr-only">ประวัติย้ายสาขา เรียงจากล่าสุด</caption>
        <thead>
          <tr className="text-left text-xs text-gray-500 dark:text-gray-400 border-b border-gray-200 dark:border-gray-700">
            <th scope="col" className="px-2 py-2 font-medium whitespace-nowrap">วันที่</th>
            <th scope="col" className="px-2 py-2 font-medium">จากสาขา</th>
            <th scope="col" className="px-2 py-2 font-medium">ไปสาขา</th>
            <th scope="col" className="px-2 py-2 font-medium">เหตุผล</th>
            <th scope="col" className="px-2 py-2 font-medium whitespace-nowrap">ผู้สั่งย้าย</th>
          </tr>
        </thead>
        <tbody>
          {ordered.map((r, i) => (
            <tr key={r.id ?? i} className="border-b border-gray-100 dark:border-gray-700/50 last:border-0 align-top">
              <td className="px-2 py-2.5 whitespace-nowrap tabular-nums text-gray-700 dark:text-gray-300">{fmtThaiDate(r.date)}</td>
              <td className="px-2 py-2.5 text-gray-600 dark:text-gray-400">{r.from_branch_name ?? "—"}</td>
              <td className="px-2 py-2.5 font-semibold text-gray-900 dark:text-gray-100">{r.to_branch_name ?? "—"}</td>
              <td className="px-2 py-2.5 text-gray-600 dark:text-gray-400 max-w-[18rem] break-words">{r.reason || "—"}</td>
              <td className="px-2 py-2.5 whitespace-nowrap text-gray-700 dark:text-gray-300">
                {r.authorized_by == null ? "—" : (names[r.authorized_by] ?? <span className="text-gray-400 dark:text-gray-500">กำลังโหลด…</span>)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
