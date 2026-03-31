// src/pages/hr/HRSalaryTier.jsx
// จัดการ Salary Ladder + Positions — ตาม api-handoff.md
// Auth: Role 1 (ADMIN) หรือ 3 (HR) เท่านั้น
import { useEffect, useState, useCallback } from "react"
import { apiAuth } from "../../lib/api"

// Seeded constants — IDs คงที่จาก BE ไม่เปลี่ยนแปลง
const POSITION_TIERS = [
  { id: 1, name: "employee_level1", full_name: "ลูกจ้าง ระดับ 1" },
  { id: 2, name: "employee_level2", full_name: "ลูกจ้าง ระดับ 2" },
  { id: 3, name: "officer_level1",  full_name: "เจ้าหน้าที่ ระดับ 1" },
  { id: 4, name: "officer_level2",  full_name: "เจ้าหน้าที่ ระดับ 2" },
  { id: 5, name: "officer_level3",  full_name: "เจ้าหน้าที่ ระดับ 3" },
  { id: 6, name: "supervisor_dept",   full_name: "หัวหน้างาน แผนก / ผู้ช่วยสาขา / ฝ่าย" },
  { id: 7, name: "supervisor_branch", full_name: "หัวหน้างาน ฝ่าย / สาขา" },
  { id: 8, name: "asst_manager",      full_name: "ผู้ช่วยผู้จัดการ" },
  { id: 9, name: "manager",           full_name: "ผู้จัดการ" },
]

const fmt = (n) =>
  n == null ? "—" : Number(n).toLocaleString("th-TH", { minimumFractionDigits: 2 })

const inputCls =
  "w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-3 py-2 text-sm text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-indigo-500"

// ---- Tab enum ----
const TAB_LADDER    = "ladder"
const TAB_POSITIONS = "positions"

export default function HRSalaryTier() {
  const [tab, setTab] = useState(TAB_LADDER)

  return (
    <div className="space-y-5 pb-10">
      <div>
        <h1 className="text-xl font-bold text-gray-900 dark:text-gray-100">จัดการบัญชีเงินเดือน & ตำแหน่ง</h1>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
          ดู / แก้ไขตารางเงินเดือนแต่ละระดับ และจัดการตำแหน่งงาน
        </p>
      </div>

      {/* Tab switcher */}
      <div className="flex gap-2 rounded-xl bg-gray-100 dark:bg-gray-800 p-1 w-fit">
        {[
          { key: TAB_LADDER,    label: "📊 บัญชีเงินเดือน" },
          { key: TAB_POSITIONS, label: "🏷️ ตำแหน่งงาน" },
        ].map(({ key, label }) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className={`px-4 py-1.5 rounded-lg text-sm font-semibold transition-all duration-200 cursor-pointer ${
              tab === key
                ? "bg-white dark:bg-gray-700 text-indigo-700 dark:text-indigo-300 shadow-sm"
                : "text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {tab === TAB_LADDER    && <SalaryLadderTab />}
      {tab === TAB_POSITIONS && <PositionsTab />}
    </div>
  )
}

// ============================================================
// Tab 1: Salary Ladder
// ============================================================
function SalaryLadderTab() {
  const [selectedTierId, setSelectedTierId] = useState(1)
  const [ladder, setLadder] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError]   = useState("")

  // modal แก้ไข salary amount
  const [editRow, setEditRow]     = useState(null)
  const [editAmount, setEditAmount] = useState("")
  const [saving, setSaving]       = useState(false)
  const [saveMsg, setSaveMsg]     = useState("")

  const fetchLadder = useCallback((tierId) => {
    setLoading(true)
    setError("")
    setLadder([])
    apiAuth(`/hr/salary-ladder?tier_id=${tierId}`)
      .then(setLadder)
      .catch((e) => setError(e.message || "โหลดข้อมูลไม่สำเร็จ"))
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => { fetchLadder(selectedTierId) }, [selectedTierId, fetchLadder])

  const openEdit = (row) => {
    setEditRow(row)
    setEditAmount(row.salary_amount)
    setSaveMsg("")
  }

  const saveEdit = async () => {
    if (!editRow) return
    setSaving(true)
    setSaveMsg("")
    try {
      await apiAuth(`/hr/salary-ladder/${editRow.id}`, {
        method: "PATCH",
        body: { salary_amount: editAmount },
      })
      setSaveMsg("success")
      setTimeout(() => {
        setEditRow(null)
        fetchLadder(selectedTierId)
      }, 700)
    } catch (err) {
      setSaveMsg(err.message || "บันทึกไม่สำเร็จ")
    } finally {
      setSaving(false)
    }
  }

  const selectedTier = POSITION_TIERS.find((t) => t.id === selectedTierId)

  return (
    <div className="space-y-4">
      {/* Tier selector */}
      <div className="rounded-2xl bg-white dark:bg-gray-800 ring-1 ring-gray-200/70 dark:ring-gray-700/70 shadow-sm p-4">
        <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-3">
          เลือกระดับตำแหน่ง
        </p>
        <div className="flex flex-wrap gap-2">
          {POSITION_TIERS.map((t) => (
            <button
              key={t.id}
              onClick={() => setSelectedTierId(t.id)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all duration-200 cursor-pointer border ${
                selectedTierId === t.id
                  ? "bg-indigo-600 text-white border-indigo-600 shadow-sm"
                  : "bg-white dark:bg-gray-700 text-gray-600 dark:text-gray-300 border-gray-200 dark:border-gray-600 hover:border-indigo-400 hover:text-indigo-700 dark:hover:text-indigo-300"
              }`}
            >
              {t.full_name}
            </button>
          ))}
        </div>
      </div>

      {error && (
        <div className="flex items-start gap-2.5 rounded-xl bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 px-4 py-3 text-sm text-red-700 dark:text-red-300">
          <svg className="mt-0.5 h-4 w-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
          </svg>
          <span>{error}</span>
        </div>
      )}

      {/* Ladder table */}
      <div className="rounded-2xl bg-white dark:bg-gray-800 ring-1 ring-gray-200/70 dark:ring-gray-700/70 shadow-sm overflow-hidden">
        <div className="px-4 py-3 border-b border-gray-100 dark:border-gray-700 flex items-center justify-between">
          <div>
            <p className="text-sm font-bold text-gray-900 dark:text-gray-100">{selectedTier?.full_name}</p>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
              {loading ? "กำลังโหลด..." : `${ladder.length} ขั้น`}
            </p>
          </div>
          <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-100 dark:bg-emerald-900/30 border border-emerald-200 dark:border-emerald-700 px-2.5 py-1 text-xs font-semibold text-emerald-700 dark:text-emerald-300">
            ✅ เชื่อมต่อ API
          </span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/30">
                <th className="text-center px-4 py-3 text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wide w-24">ขั้น</th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wide">เงินเดือน (บาท)</th>
                <th className="text-center px-4 py-3 text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wide w-24">จัดการ</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-700/50">
              {loading ? (
                <tr>
                  <td colSpan={3} className="text-center py-10">
                    <div className="flex justify-center">
                      <div className="h-6 w-6 animate-spin rounded-full border-2 border-gray-200 border-t-indigo-500 dark:border-gray-700 dark:border-t-indigo-400" />
                    </div>
                  </td>
                </tr>
              ) : ladder.length === 0 ? (
                <tr>
                  <td colSpan={3} className="text-center py-10 text-sm text-gray-400 dark:text-gray-500">
                    ไม่พบข้อมูล
                  </td>
                </tr>
              ) : (
                ladder.map((row) => (
                  <tr key={row.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/30 transition-colors">
                    <td className="px-4 py-3 text-center">
                      <span className="inline-flex items-center justify-center h-7 w-14 rounded-full bg-indigo-100 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300 text-xs font-bold">
                        {row.level}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right font-semibold text-emerald-700 dark:text-emerald-300 text-base">
                      {fmt(row.salary_amount)}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <button
                        onClick={() => openEdit(row)}
                        className="px-3 py-1.5 rounded-lg bg-indigo-100 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300 text-xs font-semibold hover:bg-indigo-200 dark:hover:bg-indigo-900/50 transition cursor-pointer"
                      >
                        แก้ไข
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Edit Modal */}
      {editRow && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="w-full max-w-sm rounded-2xl bg-white dark:bg-gray-800 shadow-2xl p-6 space-y-4">
            <h3 className="text-lg font-bold text-gray-900 dark:text-gray-100">แก้ไขเงินเดือน</h3>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              {selectedTier?.full_name} — ขั้น {editRow.level}
            </p>
            <div>
              <label className="text-xs font-medium text-gray-600 dark:text-gray-400 block mb-1">จำนวนเงิน (บาท)</label>
              <input
                type="number"
                value={editAmount}
                onChange={(e) => setEditAmount(e.target.value)}
                className={inputCls}
                placeholder="25000.00"
              />
            </div>
            {saveMsg && saveMsg !== "success" && (
              <p className="text-sm text-center text-red-600 dark:text-red-400">{saveMsg}</p>
            )}
            {saveMsg === "success" && (
              <p className="text-sm text-center text-emerald-600 dark:text-emerald-400">✅ บันทึกสำเร็จ</p>
            )}
            <div className="flex gap-3">
              <button
                onClick={() => setEditRow(null)}
                className="flex-1 h-10 rounded-xl border border-gray-300 dark:border-gray-600 text-sm font-semibold text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700 transition cursor-pointer"
              >
                ยกเลิก
              </button>
              <button
                onClick={saveEdit}
                disabled={saving}
                className="flex-1 h-10 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-60 text-white text-sm font-semibold transition shadow-sm cursor-pointer"
              >
                {saving ? "กำลังบันทึก..." : "บันทึก"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ============================================================
// Tab 2: Positions
// ============================================================
function PositionsTab() {
  const [positions, setPositions] = useState([])
  const [loading, setLoading]     = useState(true)
  const [error, setError]         = useState("")

  // modal สร้างใหม่
  const [showCreate, setShowCreate] = useState(false)
  const [createForm, setCreateForm] = useState({ title: "", position_tier_id: "" })
  const [creating, setCreating]     = useState(false)
  const [createMsg, setCreateMsg]   = useState("")

  // modal แก้ไข
  const [editPos, setEditPos]     = useState(null)
  const [editForm, setEditForm]   = useState({ title: "", position_tier_id: "" })
  const [saving, setSaving]       = useState(false)
  const [saveMsg, setSaveMsg]     = useState("")

  // confirm deactivate
  const [deactivating, setDeactivating] = useState(null) // position id ที่กำลัง deactivate

  const fetchPositions = useCallback(() => {
    setLoading(true)
    setError("")
    apiAuth("/hr/positions")
      .then(setPositions)
      .catch((e) => setError(e.message || "โหลดข้อมูลไม่สำเร็จ"))
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => { fetchPositions() }, [fetchPositions])

  // --- Create ---
  const handleCreate = async () => {
    if (!createForm.title.trim()) {
      setCreateMsg("กรุณากรอกชื่อตำแหน่ง")
      return
    }
    setCreating(true)
    setCreateMsg("")
    try {
      const body = { title: createForm.title.trim() }
      if (createForm.position_tier_id) body.position_tier_id = Number(createForm.position_tier_id)
      await apiAuth("/hr/positions", { method: "POST", body })
      setCreateMsg("success")
      setTimeout(() => { setShowCreate(false); fetchPositions() }, 700)
    } catch (err) {
      setCreateMsg(err.message || "สร้างไม่สำเร็จ")
    } finally {
      setCreating(false)
    }
  }

  // --- Edit ---
  const openEdit = (pos) => {
    setEditPos(pos)
    setEditForm({ title: pos.title, position_tier_id: pos.position_tier_id ?? "" })
    setSaveMsg("")
  }

  const handleSaveEdit = async () => {
    if (!editPos) return
    setSaving(true)
    setSaveMsg("")
    try {
      const body = {}
      if (editForm.title.trim()) body.title = editForm.title.trim()
      if (editForm.position_tier_id !== "") body.position_tier_id = Number(editForm.position_tier_id)
      await apiAuth(`/hr/positions/${editPos.id}`, { method: "PATCH", body })
      setSaveMsg("success")
      setTimeout(() => { setEditPos(null); fetchPositions() }, 700)
    } catch (err) {
      setSaveMsg(err.message || "บันทึกไม่สำเร็จ")
    } finally {
      setSaving(false)
    }
  }

  // --- Deactivate ---
  const handleDeactivate = async (posId) => {
    setDeactivating(posId)
    try {
      await apiAuth(`/hr/positions/${posId}/deactivate`, { method: "PATCH" })
      fetchPositions()
    } catch (err) {
      alert(err.message || "ปิดการใช้งานไม่สำเร็จ")
    } finally {
      setDeactivating(null)
    }
  }

  const active   = positions.filter((p) => p.is_active)
  const inactive = positions.filter((p) => !p.is_active)

  const tierLabel = (id) => POSITION_TIERS.find((t) => t.id === id)?.full_name ?? "—"

  return (
    <div className="space-y-4">
      {/* Header + Create */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <p className="text-sm text-gray-500 dark:text-gray-400">
          {loading ? "กำลังโหลด..." : `${active.length} ตำแหน่งที่ใช้งาน / ${inactive.length} ปิดแล้ว`}
        </p>
        <button
          onClick={() => { setShowCreate(true); setCreateForm({ title: "", position_tier_id: "" }); setCreateMsg("") }}
          className="flex items-center gap-2 px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-semibold transition shadow-sm cursor-pointer"
        >
          + เพิ่มตำแหน่งใหม่
        </button>
      </div>

      {error && (
        <div className="flex items-start gap-2.5 rounded-xl bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 px-4 py-3 text-sm text-red-700 dark:text-red-300">
          <svg className="mt-0.5 h-4 w-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
          </svg>
          <span>{error}</span>
        </div>
      )}

      {/* Positions table */}
      <div className="rounded-2xl bg-white dark:bg-gray-800 ring-1 ring-gray-200/70 dark:ring-gray-700/70 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/30">
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wide">ตำแหน่ง</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wide hidden sm:table-cell">ระดับ</th>
                <th className="text-center px-4 py-3 text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wide">สถานะ</th>
                <th className="text-center px-4 py-3 text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wide">จัดการ</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-700/50">
              {loading ? (
                <tr>
                  <td colSpan={4} className="text-center py-10">
                    <div className="flex justify-center">
                      <div className="h-6 w-6 animate-spin rounded-full border-2 border-gray-200 border-t-indigo-500 dark:border-gray-700 dark:border-t-indigo-400" />
                    </div>
                  </td>
                </tr>
              ) : positions.length === 0 ? (
                <tr>
                  <td colSpan={4} className="text-center py-10 text-sm text-gray-400 dark:text-gray-500">ไม่พบข้อมูลตำแหน่ง</td>
                </tr>
              ) : (
                positions.map((pos) => (
                  <tr
                    key={pos.id}
                    className={`hover:bg-gray-50 dark:hover:bg-gray-700/30 transition-colors ${!pos.is_active ? "opacity-50" : ""}`}
                  >
                    <td className="px-4 py-3">
                      <p className="font-semibold text-gray-900 dark:text-gray-100">{pos.title}</p>
                      <p className="text-xs text-gray-400 dark:text-gray-500 sm:hidden">{tierLabel(pos.position_tier_id)}</p>
                    </td>
                    <td className="px-4 py-3 text-gray-600 dark:text-gray-400 hidden sm:table-cell">
                      {tierLabel(pos.position_tier_id)}
                    </td>
                    <td className="px-4 py-3 text-center">
                      {pos.is_active ? (
                        <span className="inline-flex items-center rounded-full bg-emerald-100 dark:bg-emerald-900/30 px-2 py-0.5 text-xs font-semibold text-emerald-700 dark:text-emerald-300">
                          ใช้งาน
                        </span>
                      ) : (
                        <span className="inline-flex items-center rounded-full bg-gray-100 dark:bg-gray-700 px-2 py-0.5 text-xs font-semibold text-gray-500 dark:text-gray-400">
                          ปิดแล้ว
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <div className="flex items-center justify-center gap-2">
                        <button
                          onClick={() => openEdit(pos)}
                          className="px-3 py-1.5 rounded-lg bg-indigo-100 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300 text-xs font-semibold hover:bg-indigo-200 dark:hover:bg-indigo-900/50 transition cursor-pointer"
                        >
                          แก้ไข
                        </button>
                        {pos.is_active && (
                          <button
                            onClick={() => handleDeactivate(pos.id)}
                            disabled={deactivating === pos.id}
                            className="px-3 py-1.5 rounded-lg bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300 text-xs font-semibold hover:bg-red-200 dark:hover:bg-red-900/50 transition disabled:opacity-60 cursor-pointer disabled:cursor-not-allowed"
                          >
                            {deactivating === pos.id ? "..." : "ปิด"}
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Create Modal */}
      {showCreate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="w-full max-w-sm rounded-2xl bg-white dark:bg-gray-800 shadow-2xl p-6 space-y-4">
            <h3 className="text-lg font-bold text-gray-900 dark:text-gray-100">เพิ่มตำแหน่งใหม่</h3>
            <div className="space-y-3">
              <div>
                <label className="text-xs font-medium text-gray-600 dark:text-gray-400 block mb-1">
                  ชื่อตำแหน่ง <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={createForm.title}
                  onChange={(e) => setCreateForm((p) => ({ ...p, title: e.target.value }))}
                  className={inputCls}
                  placeholder="เช่น นักบัญชีอาวุโส"
                />
              </div>
              <div>
                <label className="text-xs font-medium text-gray-600 dark:text-gray-400 block mb-1">ระดับตำแหน่ง (ไม่บังคับ)</label>
                <select
                  value={createForm.position_tier_id}
                  onChange={(e) => setCreateForm((p) => ({ ...p, position_tier_id: e.target.value }))}
                  className={inputCls}
                >
                  <option value="">— ยังไม่กำหนด —</option>
                  {POSITION_TIERS.map((t) => (
                    <option key={t.id} value={t.id}>{t.full_name}</option>
                  ))}
                </select>
              </div>
            </div>
            {createMsg && createMsg !== "success" && (
              <p className="text-sm text-center text-red-600 dark:text-red-400">{createMsg}</p>
            )}
            {createMsg === "success" && (
              <p className="text-sm text-center text-emerald-600 dark:text-emerald-400">✅ สร้างสำเร็จ</p>
            )}
            <div className="flex gap-3">
              <button
                onClick={() => setShowCreate(false)}
                className="flex-1 h-10 rounded-xl border border-gray-300 dark:border-gray-600 text-sm font-semibold text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700 transition cursor-pointer"
              >
                ยกเลิก
              </button>
              <button
                onClick={handleCreate}
                disabled={creating}
                className="flex-1 h-10 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-60 text-white text-sm font-semibold transition shadow-sm cursor-pointer"
              >
                {creating ? "กำลังสร้าง..." : "สร้าง"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Modal */}
      {editPos && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="w-full max-w-sm rounded-2xl bg-white dark:bg-gray-800 shadow-2xl p-6 space-y-4">
            <h3 className="text-lg font-bold text-gray-900 dark:text-gray-100">แก้ไขตำแหน่ง</h3>
            <div className="space-y-3">
              <div>
                <label className="text-xs font-medium text-gray-600 dark:text-gray-400 block mb-1">ชื่อตำแหน่ง</label>
                <input
                  type="text"
                  value={editForm.title}
                  onChange={(e) => setEditForm((p) => ({ ...p, title: e.target.value }))}
                  className={inputCls}
                />
              </div>
              <div>
                <label className="text-xs font-medium text-gray-600 dark:text-gray-400 block mb-1">ระดับตำแหน่ง</label>
                <select
                  value={editForm.position_tier_id}
                  onChange={(e) => setEditForm((p) => ({ ...p, position_tier_id: e.target.value }))}
                  className={inputCls}
                >
                  <option value="">— ยังไม่กำหนด —</option>
                  {POSITION_TIERS.map((t) => (
                    <option key={t.id} value={t.id}>{t.full_name}</option>
                  ))}
                </select>
              </div>
            </div>
            {saveMsg && saveMsg !== "success" && (
              <p className="text-sm text-center text-red-600 dark:text-red-400">{saveMsg}</p>
            )}
            {saveMsg === "success" && (
              <p className="text-sm text-center text-emerald-600 dark:text-emerald-400">✅ บันทึกสำเร็จ</p>
            )}
            <div className="flex gap-3">
              <button
                onClick={() => setEditPos(null)}
                className="flex-1 h-10 rounded-xl border border-gray-300 dark:border-gray-600 text-sm font-semibold text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700 transition cursor-pointer"
              >
                ยกเลิก
              </button>
              <button
                onClick={handleSaveEdit}
                disabled={saving}
                className="flex-1 h-10 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-60 text-white text-sm font-semibold transition shadow-sm cursor-pointer"
              >
                {saving ? "กำลังบันทึก..." : "บันทึก"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
