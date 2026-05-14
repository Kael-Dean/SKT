// src/pages/hr/tabs/HRLeaveTypesTab.jsx
// จัดการประเภทการลา — GET /hr/leave-types, PATCH update/toggle
import { useEffect, useState, useCallback } from "react"
import { apiAuth } from "../../../lib/api"

const inputCls = "rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-3 py-1.5 text-sm text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-indigo-500 w-24 text-right"

export default function HRLeaveTypesTab() {
  const [leaveTypes, setLeaveTypes] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [editingId, setEditingId] = useState(null)
  const [editVal, setEditVal] = useState("")
  const [saving, setSaving] = useState(null)
  const [toggling, setToggling] = useState(null)
  const [msg, setMsg] = useState("")

  const fetchLeaveTypes = useCallback(() => {
    setLoading(true)
    setError("")
    apiAuth("/hr/leave-types")
      .then(setLeaveTypes)
      .catch((e) => setError(e.message || "โหลดข้อมูลไม่สำเร็จ"))
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => { fetchLeaveTypes() }, [fetchLeaveTypes])

  const startEdit = (lt) => {
    setEditingId(lt.id)
    setEditVal(String(lt.days_allowed ?? ""))
    setMsg("")
  }

  const saveDays = async (id) => {
    setSaving(id)
    setMsg("")
    try {
      await apiAuth(`/hr/leave-types/${id}`, {
        method: "PATCH",
        body: { days_allowed: Number(editVal) },
      })
      setMsg("✅ บันทึกสำเร็จ")
      setEditingId(null)
      fetchLeaveTypes()
    } catch (err) {
      setMsg(`❌ ${err.message || "บันทึกไม่สำเร็จ"}`)
    } finally {
      setSaving(null)
    }
  }

  const toggleActive = async (lt) => {
    setToggling(lt.id)
    setMsg("")
    try {
      await apiAuth(`/hr/leave-types/${lt.id}/toggle`, { method: "PATCH" })
      fetchLeaveTypes()
    } catch (err) {
      setMsg(`❌ ${err.message || "ไม่สำเร็จ"}`)
    } finally {
      setToggling(null)
    }
  }

  return (
    <div className="space-y-4">
      {error && (
        <div className="rounded-xl bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 px-4 py-3 text-sm text-red-700 dark:text-red-300">{error}</div>
      )}
      {msg && (
        <p className={`text-sm font-medium ${msg.startsWith("✅") ? "text-emerald-600 dark:text-emerald-400" : "text-red-600 dark:text-red-400"}`}>{msg}</p>
      )}

      <div className="rounded-2xl bg-white dark:bg-gray-800 ring-1 ring-gray-200/70 dark:ring-gray-700/70 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/30">
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 dark:text-gray-400">ประเภทการลา</th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 dark:text-gray-400">จำนวนวัน/ปี</th>
                <th className="text-center px-4 py-3 text-xs font-semibold text-gray-500 dark:text-gray-400">สถานะ</th>
                <th className="px-4 py-3 w-28"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-700/50">
              {loading ? (
                <tr><td colSpan={4} className="text-center py-10">
                  <div className="flex justify-center">
                    <div className="h-6 w-6 animate-spin rounded-full border-2 border-gray-200 border-t-indigo-500 dark:border-gray-700 dark:border-t-indigo-400" />
                  </div>
                </td></tr>
              ) : leaveTypes.map((lt) => (
                <tr key={lt.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/30">
                  <td className="px-4 py-3 font-medium text-gray-900 dark:text-gray-100">{lt.leave_name}</td>
                  <td className="px-4 py-3 text-right">
                    {editingId === lt.id ? (
                      <div className="flex items-center justify-end gap-2">
                        <input type="number" value={editVal} onChange={(e) => setEditVal(e.target.value)} className={inputCls} min="0" />
                        <button onClick={() => saveDays(lt.id)} disabled={saving === lt.id}
                          className="text-xs text-emerald-600 dark:text-emerald-400 hover:underline cursor-pointer disabled:opacity-50">
                          {saving === lt.id ? "..." : "บันทึก"}
                        </button>
                        <button onClick={() => setEditingId(null)} className="text-xs text-gray-400 hover:text-gray-600 cursor-pointer">ยกเลิก</button>
                      </div>
                    ) : (
                      <div className="flex items-center justify-end gap-2">
                        <span className="font-semibold text-indigo-700 dark:text-indigo-300">{lt.days_allowed ?? "—"} วัน</span>
                        <button onClick={() => startEdit(lt)} className="text-xs text-gray-400 hover:text-indigo-600 dark:hover:text-indigo-400 cursor-pointer">✏️</button>
                      </div>
                    )}
                  </td>
                  <td className="px-4 py-3 text-center">
                    <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${lt.is_active !== false ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300" : "bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400"}`}>
                      {lt.is_active !== false ? "เปิด" : "ปิด"}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-center">
                    <button
                      onClick={() => toggleActive(lt)}
                      disabled={toggling === lt.id}
                      className={`text-xs font-medium rounded-lg px-3 py-1 transition cursor-pointer disabled:opacity-50 ${lt.is_active !== false ? "bg-gray-100 text-gray-600 hover:bg-red-100 hover:text-red-700 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-red-900/30 dark:hover:text-red-300" : "bg-emerald-100 text-emerald-700 hover:bg-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-300 dark:hover:bg-emerald-900/50"}`}
                    >
                      {toggling === lt.id ? "..." : lt.is_active !== false ? "ปิดใช้งาน" : "เปิดใช้งาน"}
                    </button>
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
