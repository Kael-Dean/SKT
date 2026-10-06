// src/components/hr/SalaryHistoryTable.jsx
// ประวัติขั้นเงินเดือน — GET /hr/employees/{id}/salary-history
// → [{old_level, new_level, reason, effective_date, …}] (API เรียงเก่า→ใหม่; UI แสดงใหม่สุดก่อน)
import { useCallback, useEffect, useRef, useState } from "react"
import { apiAuth } from "../../lib/api"
import { SkeletonTableRows, ErrorState, EmptyState } from "../ui"
import { fmtLevel, fmtDate, reasonLabel, errText, cardCls, thCls } from "./positionUtils"

export default function SalaryHistoryTable({ employeeId, refreshKey = 0, title = "ประวัติขั้นเงินเดือน" }) {
  const [rows, setRows] = useState([])
  const [loadedFor, setLoadedFor] = useState(null) // employeeId ของ rows ที่ถืออยู่ — กันแสดงประวัติของคนก่อน
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")
  // race guard: เฉพาะ request ล่าสุดเท่านั้นที่เขียน state ได้ (สลับคนเร็ว ๆ / unmount)
  const reqRef = useRef(0)

  const load = useCallback(() => {
    if (!employeeId) return
    const req = ++reqRef.current
    setLoading(true)
    setError("")
    apiAuth(`/hr/employees/${employeeId}/salary-history`)
      .then((d) => {
        if (req !== reqRef.current) return
        const list = Array.isArray(d) ? [...d] : []
        list.sort((a, b) => String(b.effective_date ?? "").localeCompare(String(a.effective_date ?? "")) || (b.id ?? 0) - (a.id ?? 0))
        setRows(list)
        setLoadedFor(employeeId)
      })
      .catch((e) => {
        if (req !== reqRef.current) return
        setRows([])
        setLoadedFor(employeeId)
        setError(errText(e, "โหลดประวัติไม่สำเร็จ"))
      })
      .finally(() => { if (req === reqRef.current) setLoading(false) })
  }, [employeeId])

  useEffect(() => {
    load()
    const guard = reqRef
    return () => { guard.current++ }
  }, [load, refreshKey])

  if (!employeeId) return null

  // ยังไม่ได้ข้อมูลของคนนี้ → skeleton (ไม่โชว์ของคนก่อนแม้แต่เฟรมเดียว)
  const stale = String(loadedFor) !== String(employeeId)
  // refresh ของคนเดิม (หลังเลื่อนขั้น) คงแถวเดิมไว้จนข้อมูลใหม่มา ไม่กระพริบเป็น skeleton
  const showSkeleton = stale || (loading && rows.length === 0)

  return (
    <div className={cardCls + " overflow-hidden"}>
      <div className="px-4 py-3 border-b border-gray-100 dark:border-gray-700 flex items-baseline justify-between gap-3">
        <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">{title}</h3>
        {!showSkeleton && !error && <span className="text-xs text-gray-500 dark:text-gray-400 tabular-nums">{rows.length} รายการ</span>}
      </div>
      {error && !stale ? (
        <div className="p-4"><ErrorState message={error} onRetry={load} /></div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <caption className="sr-only">{title}</caption>
            <thead>
              <tr className="border-b border-gray-100 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/30">
                <th scope="col" className={thCls + " text-left whitespace-nowrap"}>วันที่มีผล</th>
                <th scope="col" className={thCls + " text-right whitespace-nowrap"}>ขั้นเดิม</th>
                <th scope="col" className={thCls + " text-right whitespace-nowrap"}>ขั้นใหม่</th>
                <th scope="col" className={thCls + " text-right whitespace-nowrap hidden sm:table-cell"}>เปลี่ยนแปลง</th>
                <th scope="col" className={thCls + " text-left"}>เหตุผล</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-700/50">
              {showSkeleton ? (
                <SkeletonTableRows rows={4} cols={5} />
              ) : rows.length === 0 ? (
                <tr><td colSpan={5} className="p-0">
                  <EmptyState title="ยังไม่มีประวัติขั้นเงินเดือน" description="เมื่อเลื่อนขั้นหรือสอบเลื่อนตำแหน่งผ่าน รายการจะแสดงที่นี่" />
                </td></tr>
              ) : rows.map((h, i) => {
                const diff = h.old_level != null && h.new_level != null ? Number(h.new_level) - Number(h.old_level) : null
                return (
                  <tr key={h.id ?? i} className="hover:bg-gray-50 dark:hover:bg-gray-700/30 transition-colors">
                    <td className="px-4 py-2.5 whitespace-nowrap text-gray-600 dark:text-gray-400">{fmtDate(h.effective_date)}</td>
                    <td className="px-4 py-2.5 text-right tabular-nums text-gray-500 dark:text-gray-400">{fmtLevel(h.old_level)}</td>
                    <td className="px-4 py-2.5 text-right tabular-nums font-semibold text-gray-900 dark:text-gray-100">{fmtLevel(h.new_level)}</td>
                    <td className={`px-4 py-2.5 text-right tabular-nums hidden sm:table-cell ${diff > 0 ? "text-emerald-700 dark:text-emerald-400" : diff < 0 ? "text-amber-700 dark:text-amber-300" : "text-gray-500 dark:text-gray-400"}`}>
                      {diff == null ? "ไม่ระบุ" : `${diff > 0 ? "+" : ""}${diff.toFixed(1)}`}
                    </td>
                    <td className="px-4 py-2.5 text-gray-700 dark:text-gray-300 break-words">{reasonLabel(h.reason)}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
