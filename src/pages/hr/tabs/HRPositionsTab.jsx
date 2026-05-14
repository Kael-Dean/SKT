// src/pages/hr/tabs/HRPositionsTab.jsx
// จัดการตำแหน่งงาน — GET /hr/positions, POST /positions, PATCH /positions/{id}
import { useEffect, useState, useCallback } from "react"
import { apiAuth } from "../../../lib/api"
import Portal from "../../../components/Portal"

const inputCls = "w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-3 py-2 text-sm text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-indigo-500"

export default function HRPositionsTab() {
  const [positions, setPositions] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")

  const [modal, setModal] = useState(null) // { mode: "create"|"edit", position? }
  const [form, setForm] = useState({ position_name: "", position_tier: "" })
  const [saving, setSaving] = useState(false)
  const [saveMsg, setSaveMsg] = useState("")

  const fetchPositions = useCallback(() => {
    setLoading(true)
    setError("")
    apiAuth("/hr/positions")
      .then(setPositions)
      .catch((e) => setError(e.message || "โหลดข้อมูลไม่สำเร็จ"))
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => { fetchPositions() }, [fetchPositions])

  const openCreate = () => {
    setModal({ mode: "create" })
    setForm({ position_name: "", position_tier: "" })
    setSaveMsg("")
  }

  const openEdit = (p) => {
    setModal({ mode: "edit", position: p })
    setForm({ position_name: p.position_name, position_tier: p.position_tier ?? "" })
    setSaveMsg("")
  }

  const handleSave = async () => {
    if (!form.position_name.trim()) {
      setSaveMsg("⚠️ กรุณากรอกชื่อตำแหน่ง")
      return
    }
    setSaving(true)
    setSaveMsg("")
    try {
      if (modal.mode === "create") {
        await apiAuth("/hr/positions", { method: "POST", body: form })
      } else {
        await apiAuth(`/hr/positions/${modal.position.id}`, { method: "PATCH", body: form })
      }
      setSaveMsg("✅ บันทึกสำเร็จ")
      setTimeout(() => { setModal(null); fetchPositions() }, 600)
    } catch (err) {
      setSaveMsg(`❌ ${err.message || "บันทึกไม่สำเร็จ"}`)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm text-gray-500 dark:text-gray-400">
          {loading ? "กำลังโหลด..." : `ตำแหน่งทั้งหมด ${positions.length} รายการ`}
        </p>
        <button
          onClick={openCreate}
          className="flex items-center gap-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 px-4 py-2 text-sm font-semibold text-white shadow-sm transition cursor-pointer"
        >
          ➕ เพิ่มตำแหน่ง
        </button>
      </div>

      {error && (
        <div className="rounded-xl bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 px-4 py-3 text-sm text-red-700 dark:text-red-300">{error}</div>
      )}

      <div className="rounded-2xl bg-white dark:bg-gray-800 ring-1 ring-gray-200/70 dark:ring-gray-700/70 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/30">
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 dark:text-gray-400">ชื่อตำแหน่ง</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 dark:text-gray-400 hidden sm:table-cell">ระดับ</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 dark:text-gray-400">สถานะ</th>
                <th className="px-4 py-3 w-20"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-700/50">
              {loading ? (
                <tr><td colSpan={4} className="text-center py-10">
                  <div className="flex justify-center">
                    <div className="h-6 w-6 animate-spin rounded-full border-2 border-gray-200 border-t-indigo-500 dark:border-gray-700 dark:border-t-indigo-400" />
                  </div>
                </td></tr>
              ) : positions.length === 0 ? (
                <tr><td colSpan={4} className="text-center py-10 text-sm text-gray-400 dark:text-gray-500">ยังไม่มีข้อมูลตำแหน่ง</td></tr>
              ) : positions.map((p) => (
                <tr key={p.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/30">
                  <td className="px-4 py-3 font-medium text-gray-900 dark:text-gray-100">{p.position_name}</td>
                  <td className="px-4 py-3 text-gray-600 dark:text-gray-400 hidden sm:table-cell">{p.position_tier ?? "—"}</td>
                  <td className="px-4 py-3">
                    <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${p.is_active !== false ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300" : "bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400"}`}>
                      {p.is_active !== false ? "ใช้งาน" : "ปิดใช้งาน"}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-center">
                    <button onClick={() => openEdit(p)} className="text-xs text-indigo-600 dark:text-indigo-400 hover:underline cursor-pointer">แก้ไข</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {modal && (
        <Portal>
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="w-full max-w-sm rounded-2xl bg-white dark:bg-gray-800 shadow-2xl p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-bold text-gray-900 dark:text-gray-100">
                {modal.mode === "create" ? "➕ เพิ่มตำแหน่งใหม่" : "แก้ไขตำแหน่ง"}
              </h3>
              <button onClick={() => setModal(null)} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 cursor-pointer">✕</button>
            </div>
            <div>
              <label className="text-xs font-medium text-gray-600 dark:text-gray-400 block mb-1">
                ชื่อตำแหน่ง <span className="text-red-500">*</span>
              </label>
              <input type="text" value={form.position_name} onChange={(e) => setForm(f => ({ ...f, position_name: e.target.value }))}
                className={inputCls} placeholder="ชื่อตำแหน่ง" />
            </div>
            <div>
              <label className="text-xs font-medium text-gray-600 dark:text-gray-400 block mb-1">ระดับตำแหน่ง (position_tier)</label>
              <input type="text" value={form.position_tier} onChange={(e) => setForm(f => ({ ...f, position_tier: e.target.value }))}
                className={inputCls} placeholder="เช่น A, B, C หรือ 1, 2, 3" />
            </div>
            {saveMsg && <p className={`text-sm text-center ${saveMsg.startsWith("✅") ? "text-emerald-600 dark:text-emerald-400" : "text-red-600 dark:text-red-400"}`}>{saveMsg}</p>}
            <div className="flex gap-3">
              <button onClick={() => setModal(null)} className="flex-1 h-10 rounded-xl border border-gray-300 dark:border-gray-600 text-sm font-semibold text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700 transition cursor-pointer">ยกเลิก</button>
              <button onClick={handleSave} disabled={saving}
                className="flex-1 h-10 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-semibold transition shadow-sm disabled:opacity-60 cursor-pointer">
                {saving ? "กำลังบันทึก..." : "บันทึก"}
              </button>
            </div>
          </div>
        </div>
        </Portal>
      )}
    </div>
  )
}
