// src/pages/work/FacilityReport.jsx
// รายรับ-รายจ่ายสถานที่ — POST/GET/PATCH/DELETE /facility-report/*
import { useEffect, useRef, useState, useMemo } from "react"
import { apiAuth, apiDownload } from "../../lib/api"
import { getRoleId } from "../../lib/auth"
import SelectDropdown from "../../components/SelectDropdown"

const ROLE_ADMIN = 1

// ─── utils ────────────────────────────────────────────────────────────────────
function today() { return new Date().toISOString().slice(0, 10) }
function firstOfMonth() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-01`
}
function fmtAmt(n) {
  return Number(n).toLocaleString("th-TH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

// ─── style tokens ─────────────────────────────────────────────────────────────
const inputCls =
  "w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 py-2 text-sm text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition"
const cardCls =
  "rounded-2xl bg-white dark:bg-gray-800 shadow-sm ring-1 ring-gray-200/70 dark:ring-gray-700/70 p-5"

// ─── shared sub-components ────────────────────────────────────────────────────
function Field({ label, required, children }) {
  return (
    <div className="flex flex-col gap-1">
      <label className="text-xs font-medium text-gray-600 dark:text-gray-400">
        {label}{required && <span className="text-red-500 ml-0.5">*</span>}
      </label>
      {children}
    </div>
  )
}

function SectionTitle({ children }) {
  return (
    <p className="text-xs font-semibold text-indigo-600 dark:text-indigo-400 uppercase tracking-wider mb-3 flex items-center gap-2">
      <span className="flex-1 h-px bg-indigo-100 dark:bg-indigo-900/40" />
      {children}
      <span className="flex-1 h-px bg-indigo-100 dark:bg-indigo-900/40" />
    </p>
  )
}

// ─── TxRow ────────────────────────────────────────────────────────────────────
function TxRow({ tx, itemMap, isAdmin, onEdit, onDelete }) {
  const item = itemMap[tx.facility_item_id]
  const isIncome = item?.item_type === "income"
  return (
    <div className="flex items-center justify-between gap-3 rounded-xl bg-gray-50 dark:bg-gray-700/50 px-4 py-2.5 mb-1.5">
      <div className="min-w-0">
        <p className="text-sm font-medium text-gray-900 dark:text-gray-100">
          {item?.name ?? `รายการ #${tx.facility_item_id}`}
        </p>
        {tx.note && (
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{tx.note}</p>
        )}
      </div>
      <div className="flex items-center gap-3 flex-shrink-0">
        <p className={`text-sm font-bold ${isIncome ? "text-emerald-700 dark:text-emerald-300" : "text-red-700 dark:text-red-300"}`}>
          ฿{fmtAmt(tx.amount)}
        </p>
        <div className="flex gap-1">
          <button
            onClick={onEdit}
            className="p-1.5 rounded-lg text-gray-400 hover:text-amber-600 hover:bg-amber-50 dark:hover:bg-amber-900/20 transition cursor-pointer"
            title="แก้ไข"
          >
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
            </svg>
          </button>
          {isAdmin && (
            <button
              onClick={onDelete}
              className="p-1.5 rounded-lg text-gray-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 transition cursor-pointer"
              title="ลบ"
            >
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

// ─── TransactionModal ─────────────────────────────────────────────────────────
function TransactionModal({ items, defaultDate, tx, onSave, onClose }) {
  const isEdit = !!tx
  const [form, setForm] = useState({
    facility_item_id: tx?.facility_item_id ? String(tx.facility_item_id) : "",
    amount: tx?.amount ? String(tx.amount) : "",
    transaction_date: tx?.transaction_date ?? defaultDate,
    note: tx?.note ?? "",
  })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState("")

  const incomeItems = items.filter((i) => i.item_type === "income")
  const expenseItems = items.filter((i) => i.item_type === "expense")
  const itemOptions = [
    ...incomeItems.map((i) => ({ value: i.id, label: `[รายรับ] ${i.name}` })),
    ...expenseItems.map((i) => ({ value: i.id, label: `[รายจ่าย] ${i.name}` })),
  ]

  const handleSave = async () => {
    if (!isEdit && !form.facility_item_id) { setError("กรุณาเลือกรายการ"); return }
    const amt = Number(form.amount)
    if (!form.amount || isNaN(amt) || amt <= 0) { setError("กรุณาระบุจำนวนเงินที่ถูกต้อง"); return }
    if (!form.transaction_date) { setError("กรุณาระบุวันที่"); return }
    setSaving(true); setError("")
    try {
      if (isEdit) {
        await apiAuth(`/facility-report/transactions/${tx.id}`, {
          method: "PATCH",
          body: { amount: amt, transaction_date: form.transaction_date, note: form.note || null },
        })
      } else {
        await apiAuth("/facility-report/transactions", {
          method: "POST",
          body: {
            facility_item_id: Number(form.facility_item_id),
            amount: amt,
            transaction_date: form.transaction_date,
            note: form.note || null,
          },
        })
      }
      onSave()
    } catch (e) {
      setError(e.message || "บันทึกไม่สำเร็จ")
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
      <div className="w-full max-w-md rounded-2xl bg-white dark:bg-gray-800 shadow-2xl p-6 space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-base font-bold text-gray-900 dark:text-gray-100">
            {isEdit ? "แก้ไขรายการ" : "บันทึกรายการใหม่"}
          </h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 cursor-pointer text-lg leading-none">✕</button>
        </div>

        {!isEdit && (
          <Field label="รายการ" required>
            <SelectDropdown
              options={itemOptions}
              value={form.facility_item_id}
              onChange={(v) => setForm((prev) => ({ ...prev, facility_item_id: v }))}
              placeholder="— เลือกรายการ —"
            />
          </Field>
        )}

        {isEdit && (
          <p className="text-sm text-gray-600 dark:text-gray-400 bg-gray-50 dark:bg-gray-700/50 rounded-lg px-3 py-2">
            รายการ: <span className="font-semibold">{items.find((i) => i.id === tx.facility_item_id)?.name ?? `#${tx.facility_item_id}`}</span>
          </p>
        )}

        <Field label="จำนวนเงิน (บาท)" required>
          <input
            type="number" min="0" step="0.01"
            className={inputCls} placeholder="0.00"
            value={form.amount}
            onChange={(e) => setForm((prev) => ({ ...prev, amount: e.target.value }))}
          />
        </Field>

        <Field label="วันที่" required>
          <input
            type="date" className={inputCls}
            value={form.transaction_date}
            onChange={(e) => setForm((prev) => ({ ...prev, transaction_date: e.target.value }))}
          />
        </Field>

        <Field label="หมายเหตุ">
          <input
            type="text" className={inputCls} placeholder="หมายเหตุ (ถ้ามี)"
            value={form.note}
            onChange={(e) => setForm((prev) => ({ ...prev, note: e.target.value }))}
          />
        </Field>

        {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}

        <div className="flex gap-3">
          <button
            onClick={handleSave} disabled={saving}
            className="flex-1 h-10 rounded-xl bg-indigo-600 text-white font-semibold hover:bg-indigo-500 disabled:opacity-60 disabled:cursor-not-allowed transition cursor-pointer"
          >
            {saving ? "กำลังบันทึก..." : "บันทึก"}
          </button>
          <button
            onClick={onClose}
            className="flex-1 h-10 rounded-xl border border-gray-300 dark:border-gray-600 text-sm text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700 transition cursor-pointer"
          >
            ยกเลิก
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── FacilityModal ────────────────────────────────────────────────────────────
function FacilityModal({ facility, onSave, onClose }) {
  const isEdit = !!facility
  const [form, setForm] = useState({ name: facility?.name ?? "", description: facility?.description ?? "" })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState("")

  const handleSave = async () => {
    if (!form.name.trim()) { setError("กรุณาระบุชื่อสถานที่"); return }
    setSaving(true); setError("")
    try {
      if (isEdit) {
        await apiAuth(`/facility-report/facilities/${facility.id}`, {
          method: "PATCH",
          body: { name: form.name.trim(), description: form.description || null },
        })
      } else {
        await apiAuth("/facility-report/facilities", {
          method: "POST",
          body: { name: form.name.trim(), description: form.description || null },
        })
      }
      onSave()
    } catch (e) {
      setError(e.message || "บันทึกไม่สำเร็จ")
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
      <div className="w-full max-w-sm rounded-2xl bg-white dark:bg-gray-800 shadow-2xl p-6 space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-base font-bold text-gray-900 dark:text-gray-100">
            {isEdit ? "แก้ไขสถานที่" : "เพิ่มสถานที่"}
          </h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 cursor-pointer text-lg leading-none">✕</button>
        </div>

        <Field label="ชื่อสถานที่" required>
          <input type="text" className={inputCls} placeholder="เช่น ร้านปันสุข" value={form.name}
            onChange={(e) => setForm((prev) => ({ ...prev, name: e.target.value }))} />
        </Field>

        <Field label="รายละเอียด">
          <input type="text" className={inputCls} placeholder="รายละเอียด (ถ้ามี)" value={form.description}
            onChange={(e) => setForm((prev) => ({ ...prev, description: e.target.value }))} />
        </Field>

        {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}

        <div className="flex gap-3">
          <button onClick={handleSave} disabled={saving}
            className="flex-1 h-10 rounded-xl bg-indigo-600 text-white font-semibold hover:bg-indigo-500 disabled:opacity-60 disabled:cursor-not-allowed transition cursor-pointer">
            {saving ? "กำลังบันทึก..." : "บันทึก"}
          </button>
          <button onClick={onClose}
            className="flex-1 h-10 rounded-xl border border-gray-300 dark:border-gray-600 text-sm text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700 transition cursor-pointer">
            ยกเลิก
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── ItemModal ────────────────────────────────────────────────────────────────
function ItemModal({ facilities, item, onSave, onClose }) {
  const isEdit = !!item
  const [form, setForm] = useState({
    facility_id: item?.facility_id ? String(item.facility_id) : "",
    name: item?.name ?? "",
    item_type: item?.item_type ?? "income",
    display_order: item?.display_order ?? 1,
  })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState("")

  const facilityOpts = facilities.map((f) => ({ value: f.id, label: f.name }))
  const typeOpts = [
    { value: "income", label: "รายรับ" },
    { value: "expense", label: "รายจ่าย" },
  ]

  const handleSave = async () => {
    if (!isEdit && !form.facility_id) { setError("กรุณาเลือกสถานที่"); return }
    if (!form.name.trim()) { setError("กรุณาระบุชื่อรายการ"); return }
    setSaving(true); setError("")
    try {
      if (isEdit) {
        await apiAuth(`/facility-report/items/${item.id}`, {
          method: "PATCH",
          body: { name: form.name.trim(), item_type: form.item_type, display_order: Number(form.display_order) },
        })
      } else {
        await apiAuth("/facility-report/items", {
          method: "POST",
          body: {
            facility_id: Number(form.facility_id),
            name: form.name.trim(),
            item_type: form.item_type,
            display_order: Number(form.display_order),
          },
        })
      }
      onSave()
    } catch (e) {
      setError(e.message || "บันทึกไม่สำเร็จ")
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
      <div className="w-full max-w-sm rounded-2xl bg-white dark:bg-gray-800 shadow-2xl p-6 space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-base font-bold text-gray-900 dark:text-gray-100">
            {isEdit ? "แก้ไขรายการ" : "เพิ่มรายการ"}
          </h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 cursor-pointer text-lg leading-none">✕</button>
        </div>

        {!isEdit && (
          <Field label="สถานที่" required>
            <SelectDropdown
              options={facilityOpts}
              value={form.facility_id}
              onChange={(v) => setForm((prev) => ({ ...prev, facility_id: v }))}
              placeholder="— เลือกสถานที่ —"
            />
          </Field>
        )}

        {isEdit && (
          <p className="text-sm text-gray-600 dark:text-gray-400 bg-gray-50 dark:bg-gray-700/50 rounded-lg px-3 py-2">
            สถานที่: <span className="font-semibold">{facilities.find((f) => f.id === item.facility_id)?.name ?? `#${item.facility_id}`}</span>
          </p>
        )}

        <Field label="ชื่อรายการ" required>
          <input type="text" className={inputCls} placeholder="เช่น ยอดขายอาหาร" value={form.name}
            onChange={(e) => setForm((prev) => ({ ...prev, name: e.target.value }))} />
        </Field>

        <Field label="ประเภท" required>
          <SelectDropdown
            options={typeOpts}
            value={form.item_type}
            onChange={(v) => setForm((prev) => ({ ...prev, item_type: v }))}
          />
        </Field>

        <Field label="ลำดับแสดงผล">
          <input type="number" min="1" className={inputCls} value={form.display_order}
            onChange={(e) => setForm((prev) => ({ ...prev, display_order: e.target.value }))} />
        </Field>

        {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}

        <div className="flex gap-3">
          <button onClick={handleSave} disabled={saving}
            className="flex-1 h-10 rounded-xl bg-indigo-600 text-white font-semibold hover:bg-indigo-500 disabled:opacity-60 disabled:cursor-not-allowed transition cursor-pointer">
            {saving ? "กำลังบันทึก..." : "บันทึก"}
          </button>
          <button onClick={onClose}
            className="flex-1 h-10 rounded-xl border border-gray-300 dark:border-gray-600 text-sm text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700 transition cursor-pointer">
            ยกเลิก
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Main Component ───────────────────────────────────────────────────────────
export default function FacilityReport() {
  const roleId = getRoleId()
  const isAdmin = roleId === ROLE_ADMIN
  const autoSelectedRef = useRef(false)

  const [tab, setTab] = useState("record")

  // Facilities & items
  const [facilities, setFacilities] = useState([])
  const [allItems, setAllItems] = useState([])
  const [loadingFacilities, setLoadingFacilities] = useState(true)
  const [facilityError, setFacilityError] = useState("")

  // Record tab
  const [selectedFacilityId, setSelectedFacilityId] = useState(null)
  const [filterDate, setFilterDate] = useState(today())
  const [items, setItems] = useState([])
  const [transactions, setTransactions] = useState([])
  const [loadingTx, setLoadingTx] = useState(false)
  const [txError, setTxError] = useState("")
  const [txVersion, setTxVersion] = useState(0)

  // Report tab
  const [reportFacilityIds, setReportFacilityIds] = useState([])
  const [reportFrom, setReportFrom] = useState(firstOfMonth())
  const [reportTo, setReportTo] = useState(today())
  const [generatingPdf, setGeneratingPdf] = useState(false)
  const [reportError, setReportError] = useState("")

  // Admin tab (version counter triggers re-fetch)
  const [adminVersion, setAdminVersion] = useState(0)

  // Modals
  const [txModal, setTxModal] = useState(null)
  const [facilityModal, setFacilityModal] = useState(null)
  const [itemModal, setItemModal] = useState(null)

  // ── Load facilities ──────────────────────────────────────────────────────────
  useEffect(() => {
    setLoadingFacilities(true)
    setFacilityError("")
    apiAuth("/facility-report/facilities")
      .then((data) => setFacilities(Array.isArray(data) ? data : []))
      .catch((e) => setFacilityError(e.message || "โหลดข้อมูลสถานที่ไม่สำเร็จ"))
      .finally(() => setLoadingFacilities(false))
  }, [adminVersion])

  // ── Auto-select first facility (once) ────────────────────────────────────────
  useEffect(() => {
    if (facilities.length > 0 && !autoSelectedRef.current) {
      autoSelectedRef.current = true
      setSelectedFacilityId(facilities[0].id)
      setReportFacilityIds([facilities[0].id])
    }
  }, [facilities])

  // ── Load items for record tab ────────────────────────────────────────────────
  useEffect(() => {
    if (!selectedFacilityId) { setItems([]); return }
    apiAuth(`/facility-report/items?facility_id=${selectedFacilityId}`)
      .then((data) => setItems(Array.isArray(data) ? data : []))
      .catch(() => setItems([]))
  }, [selectedFacilityId, adminVersion])

  // ── Load all items for admin tab ─────────────────────────────────────────────
  useEffect(() => {
    if (tab !== "admin") return
    apiAuth("/facility-report/items")
      .then((data) => setAllItems(Array.isArray(data) ? data : []))
      .catch(() => {})
  }, [tab, adminVersion])

  // ── Load transactions ────────────────────────────────────────────────────────
  useEffect(() => {
    if (tab !== "record" || !selectedFacilityId) { setTransactions([]); return }
    setLoadingTx(true); setTxError("")
    const p = new URLSearchParams({ facility_id: selectedFacilityId, from_date: filterDate, to_date: filterDate })
    apiAuth(`/facility-report/transactions?${p}`)
      .then((data) => setTransactions(Array.isArray(data) ? data : []))
      .catch((e) => setTxError(e.message || "โหลดรายการไม่สำเร็จ"))
      .finally(() => setLoadingTx(false))
  }, [tab, selectedFacilityId, filterDate, txVersion])

  // ── Derived ──────────────────────────────────────────────────────────────────
  const itemMap = useMemo(() => {
    const m = {}; items.forEach((i) => { m[i.id] = i }); return m
  }, [items])

  const incomeTx = useMemo(
    () => transactions.filter((t) => itemMap[t.facility_item_id]?.item_type === "income"),
    [transactions, itemMap]
  )
  const expenseTx = useMemo(
    () => transactions.filter((t) => itemMap[t.facility_item_id]?.item_type === "expense"),
    [transactions, itemMap]
  )
  const unclassifiedTx = useMemo(
    () => transactions.filter((t) => !itemMap[t.facility_item_id]),
    [transactions, itemMap]
  )
  const totalIncome = incomeTx.reduce((s, t) => s + Number(t.amount), 0)
  const totalExpense = expenseTx.reduce((s, t) => s + Number(t.amount), 0)

  const facilityOpts = useMemo(() => facilities.map((f) => ({ value: f.id, label: f.name })), [facilities])

  // ── PDF report ───────────────────────────────────────────────────────────────
  const handleGeneratePdf = async () => {
    if (!reportFacilityIds.length) { setReportError("กรุณาเลือกสถานที่อย่างน้อย 1 แห่ง"); return }
    if (!reportFrom || !reportTo) { setReportError("กรุณาระบุช่วงวันที่"); return }
    setGeneratingPdf(true); setReportError("")
    try {
      const p = new URLSearchParams({ from_date: reportFrom, to_date: reportTo })
      reportFacilityIds.forEach((id) => p.append("facility_ids", id))
      const { blob, filename } = await apiDownload(`/facility-report/report/pdf?${p}`)
      const url = URL.createObjectURL(blob)
      const a = document.createElement("a")
      a.href = url; a.download = filename || `facility_report_${reportFrom}_${reportTo}.pdf`
      a.click(); URL.revokeObjectURL(url)
    } catch (e) {
      let msg = e.message
      try { const d = JSON.parse(msg); msg = d?.detail || msg } catch {}
      setReportError(msg || "ดาวน์โหลดรายงานไม่สำเร็จ")
    } finally {
      setGeneratingPdf(false)
    }
  }

  // ── Delete handlers ──────────────────────────────────────────────────────────
  const handleDeleteTx = async (txId) => {
    if (!window.confirm("ต้องการลบรายการนี้?")) return
    try {
      await apiAuth(`/facility-report/transactions/${txId}`, { method: "DELETE" })
      setTxVersion((v) => v + 1)
    } catch (e) { alert(`ลบไม่สำเร็จ: ${e.message}`) }
  }

  const handleDeleteFacility = async (id) => {
    if (!window.confirm("ต้องการลบสถานที่นี้?")) return
    try {
      await apiAuth(`/facility-report/facilities/${id}`, { method: "DELETE" })
      setAdminVersion((v) => v + 1)
    } catch (e) { alert(`ลบไม่สำเร็จ: ${e.message}`) }
  }

  const handleDeleteItem = async (id) => {
    if (!window.confirm("ต้องการลบรายการนี้?")) return
    try {
      await apiAuth(`/facility-report/items/${id}`, { method: "DELETE" })
      setAdminVersion((v) => v + 1)
    } catch (e) { alert(`ลบไม่สำเร็จ: ${e.message}`) }
  }

  // ── 403 / access-denied guard ────────────────────────────────────────────────
  if (!loadingFacilities && facilityError) {
    const is403 = facilityError.includes("403") ||
      facilityError.toLowerCase().includes("permission") ||
      facilityError.toLowerCase().includes("branch") ||
      facilityError.toLowerCase().includes("ไม่มีสิทธิ์")
    if (is403) {
      return (
        <div className="max-w-lg mx-auto mt-10">
          <div className={`${cardCls} text-center space-y-3 py-12`}>
            <div className="text-5xl">🔒</div>
            <h2 className="text-base font-bold text-gray-900 dark:text-gray-100">ไม่มีสิทธิ์เข้าถึง</h2>
            <p className="text-sm text-gray-500 dark:text-gray-400">สาขาของคุณไม่ได้รับสิทธิ์ใช้งานฟีเจอร์นี้</p>
          </div>
        </div>
      )
    }
  }

  const tabs = [
    { v: "record", label: "บันทึกรายการ" },
    { v: "report", label: "สร้างรายงาน PDF" },
    ...(isAdmin ? [{ v: "admin", label: "จัดการสถานที่" }] : []),
  ]

  return (
    <div className="max-w-3xl mx-auto space-y-5 pb-12">
      {/* Page title */}
      <div>
        <h1 className="text-xl font-bold text-gray-900 dark:text-gray-100">รายรับ-รายจ่ายสถานที่</h1>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
          บันทึกรายรับ-รายจ่ายรายวัน และสร้างรายงาน PDF
        </p>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 rounded-xl bg-gray-100 dark:bg-gray-800 p-1 w-fit">
        {tabs.map(({ v, label }) => (
          <button
            key={v}
            onClick={() => setTab(v)}
            className={`px-4 py-2 rounded-lg text-sm font-semibold transition-all cursor-pointer ${
              tab === v
                ? "bg-white dark:bg-gray-700 text-indigo-700 dark:text-indigo-300 shadow-sm"
                : "text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {loadingFacilities && (
        <div className="flex justify-center py-12">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-gray-200 border-t-indigo-500 dark:border-gray-700 dark:border-t-indigo-400" />
        </div>
      )}

      {!loadingFacilities && facilityError && (
        <div className="rounded-xl bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 px-4 py-3 text-sm text-red-700 dark:text-red-300">
          {facilityError}
        </div>
      )}

      {/* ══════════ RECORD TAB ══════════ */}
      {tab === "record" && !loadingFacilities && !facilityError && (
        <div className="space-y-4">
          {/* Filters */}
          <div className={cardCls}>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Field label="สถานที่">
                <SelectDropdown
                  options={facilityOpts}
                  value={selectedFacilityId}
                  onChange={(v) => setSelectedFacilityId(Number(v))}
                  placeholder="— เลือกสถานที่ —"
                />
              </Field>
              <Field label="วันที่">
                <input
                  type="date" className={inputCls}
                  value={filterDate}
                  onChange={(e) => setFilterDate(e.target.value)}
                />
              </Field>
            </div>
          </div>

          {/* Summary cards */}
          {selectedFacilityId && !loadingTx && !txError && (
            <div className="grid grid-cols-3 gap-3">
              <div className="rounded-xl bg-emerald-50 dark:bg-emerald-900/20 p-4 text-center">
                <p className="text-xs text-emerald-600 dark:text-emerald-400 font-semibold mb-1">รายรับ</p>
                <p className="text-lg font-bold text-emerald-700 dark:text-emerald-300">฿{fmtAmt(totalIncome)}</p>
              </div>
              <div className="rounded-xl bg-red-50 dark:bg-red-900/20 p-4 text-center">
                <p className="text-xs text-red-600 dark:text-red-400 font-semibold mb-1">รายจ่าย</p>
                <p className="text-lg font-bold text-red-700 dark:text-red-300">฿{fmtAmt(totalExpense)}</p>
              </div>
              <div className={`rounded-xl p-4 text-center ${
                totalIncome - totalExpense >= 0 ? "bg-indigo-50 dark:bg-indigo-900/20" : "bg-amber-50 dark:bg-amber-900/20"
              }`}>
                <p className={`text-xs font-semibold mb-1 ${
                  totalIncome - totalExpense >= 0 ? "text-indigo-600 dark:text-indigo-400" : "text-amber-600 dark:text-amber-400"
                }`}>สุทธิ</p>
                <p className={`text-lg font-bold ${
                  totalIncome - totalExpense >= 0 ? "text-indigo-700 dark:text-indigo-300" : "text-amber-700 dark:text-amber-300"
                }`}>฿{fmtAmt(totalIncome - totalExpense)}</p>
              </div>
            </div>
          )}

          {/* Transaction list */}
          <div className={cardCls}>
            <div className="flex items-center justify-between mb-4">
              <SectionTitle>รายการประจำวัน</SectionTitle>
              {selectedFacilityId && (
                <button
                  onClick={() => setTxModal({})}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-indigo-600 text-white text-xs font-semibold hover:bg-indigo-500 transition cursor-pointer flex-shrink-0"
                >
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
                  </svg>
                  บันทึกรายการ
                </button>
              )}
            </div>

            {loadingTx ? (
              <div className="flex justify-center py-8">
                <div className="h-6 w-6 animate-spin rounded-full border-2 border-gray-200 border-t-indigo-500" />
              </div>
            ) : txError ? (
              <p className="text-sm text-red-600 dark:text-red-400">{txError}</p>
            ) : !selectedFacilityId ? (
              <p className="text-sm text-gray-400 dark:text-gray-500 text-center py-6">เลือกสถานที่เพื่อดูรายการ</p>
            ) : transactions.length === 0 ? (
              <p className="text-sm text-gray-400 dark:text-gray-500 text-center py-6">ยังไม่มีรายการในวันที่เลือก</p>
            ) : (
              <div>
                {incomeTx.length > 0 && (
                  <div className="mb-3">
                    <p className="text-xs font-semibold text-emerald-600 dark:text-emerald-400 mb-2 px-1">รายรับ</p>
                    {incomeTx.map((tx) => (
                      <TxRow key={tx.id} tx={tx} itemMap={itemMap} isAdmin={isAdmin}
                        onEdit={() => setTxModal({ tx })}
                        onDelete={() => handleDeleteTx(tx.id)} />
                    ))}
                  </div>
                )}
                {expenseTx.length > 0 && (
                  <div className="mb-3">
                    <p className="text-xs font-semibold text-red-600 dark:text-red-400 mb-2 px-1">รายจ่าย</p>
                    {expenseTx.map((tx) => (
                      <TxRow key={tx.id} tx={tx} itemMap={itemMap} isAdmin={isAdmin}
                        onEdit={() => setTxModal({ tx })}
                        onDelete={() => handleDeleteTx(tx.id)} />
                    ))}
                  </div>
                )}
                {unclassifiedTx.map((tx) => (
                  <TxRow key={tx.id} tx={tx} itemMap={itemMap} isAdmin={isAdmin}
                    onEdit={() => setTxModal({ tx })}
                    onDelete={() => handleDeleteTx(tx.id)} />
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ══════════ REPORT TAB ══════════ */}
      {tab === "report" && !loadingFacilities && (
        <div className={`${cardCls} space-y-5`}>
          <SectionTitle>สร้างรายงาน PDF</SectionTitle>

          <div>
            <p className="text-xs font-medium text-gray-600 dark:text-gray-400 mb-2">
              สถานที่ <span className="text-red-500">*</span>
            </p>
            <div className="flex flex-wrap gap-2">
              {facilities.map((f) => {
                const isSelected = reportFacilityIds.includes(f.id)
                return (
                  <label key={f.id} className={`flex items-center gap-2 px-3 py-2 rounded-xl border cursor-pointer select-none transition-all text-sm ${
                    isSelected
                      ? "border-indigo-500 bg-indigo-50 dark:bg-indigo-900/25 ring-1 ring-indigo-400 text-indigo-700 dark:text-indigo-300"
                      : "border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300 hover:border-indigo-300 dark:hover:border-indigo-600"
                  }`}>
                    <input
                      type="checkbox" className="sr-only"
                      checked={isSelected}
                      onChange={() => setReportFacilityIds((prev) =>
                        prev.includes(f.id) ? prev.filter((x) => x !== f.id) : [...prev, f.id]
                      )}
                    />
                    <span className={`w-4 h-4 rounded flex items-center justify-center flex-shrink-0 border-2 transition-all ${
                      isSelected ? "border-indigo-600 bg-indigo-600" : "border-gray-300 dark:border-gray-600"
                    }`}>
                      {isSelected && (
                        <svg className="w-2.5 h-2.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                        </svg>
                      )}
                    </span>
                    {f.name}
                  </label>
                )
              })}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <Field label="ตั้งแต่วันที่" required>
              <input type="date" className={inputCls} value={reportFrom}
                onChange={(e) => setReportFrom(e.target.value)} />
            </Field>
            <Field label="ถึงวันที่" required>
              <input type="date" className={inputCls} value={reportTo}
                min={reportFrom || undefined}
                onChange={(e) => setReportTo(e.target.value)} />
            </Field>
          </div>

          {reportError && (
            <div className="rounded-xl bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 px-4 py-3 text-sm text-red-700 dark:text-red-300">
              {reportError}
            </div>
          )}

          <button
            onClick={handleGeneratePdf} disabled={generatingPdf}
            className="w-full h-12 rounded-xl bg-indigo-600 text-white font-semibold hover:bg-indigo-500 disabled:opacity-60 disabled:cursor-not-allowed transition shadow-sm cursor-pointer flex items-center justify-center gap-2"
          >
            {generatingPdf ? (
              <>
                <span className="h-4 w-4 rounded-full border-2 border-white/40 border-t-white animate-spin" />
                กำลังสร้างรายงาน...
              </>
            ) : (
              <>
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                </svg>
                ดาวน์โหลดรายงาน PDF
              </>
            )}
          </button>
        </div>
      )}

      {/* ══════════ ADMIN TAB ══════════ */}
      {tab === "admin" && isAdmin && !loadingFacilities && (
        <div className="space-y-5">
          {/* Facilities */}
          <div className={cardCls}>
            <div className="flex items-center justify-between mb-4">
              <SectionTitle>สถานที่</SectionTitle>
              <button
                onClick={() => setFacilityModal({})}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-indigo-600 text-white text-xs font-semibold hover:bg-indigo-500 transition cursor-pointer flex-shrink-0"
              >
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
                </svg>
                เพิ่มสถานที่
              </button>
            </div>
            {facilities.length === 0 ? (
              <p className="text-sm text-gray-400 dark:text-gray-500 text-center py-4">ยังไม่มีสถานที่</p>
            ) : (
              <div className="space-y-2">
                {facilities.map((f) => (
                  <div key={f.id} className="flex items-center justify-between gap-3 rounded-xl bg-gray-50 dark:bg-gray-700/50 px-4 py-3">
                    <div className="min-w-0">
                      <p className="font-semibold text-sm text-gray-900 dark:text-gray-100">{f.name}</p>
                      {f.description && <p className="text-xs text-gray-500 dark:text-gray-400">{f.description}</p>}
                    </div>
                    <div className="flex gap-2 flex-shrink-0">
                      <button
                        onClick={() => setFacilityModal({ facility: f })}
                        className="px-3 py-1 rounded-lg bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300 text-xs font-semibold hover:bg-amber-200 dark:hover:bg-amber-900/50 transition cursor-pointer"
                      >
                        แก้ไข
                      </button>
                      <button
                        onClick={() => handleDeleteFacility(f.id)}
                        className="px-3 py-1 rounded-lg bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300 text-xs font-semibold hover:bg-red-200 dark:hover:bg-red-900/50 transition cursor-pointer"
                      >
                        ลบ
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Items */}
          <div className={cardCls}>
            <div className="flex items-center justify-between mb-4">
              <SectionTitle>รายการรายรับ-รายจ่าย</SectionTitle>
              <button
                onClick={() => setItemModal({})}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-indigo-600 text-white text-xs font-semibold hover:bg-indigo-500 transition cursor-pointer flex-shrink-0"
              >
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
                </svg>
                เพิ่มรายการ
              </button>
            </div>

            {facilities.map((f) => {
              const fItems = allItems.filter((i) => i.facility_id === f.id)
              if (!fItems.length) return null
              return (
                <div key={f.id} className="mb-4 last:mb-0">
                  <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 mb-2 px-1">{f.name}</p>
                  <div className="space-y-1.5">
                    {fItems.map((item) => (
                      <div key={item.id} className="flex items-center justify-between gap-3 rounded-xl bg-gray-50 dark:bg-gray-700/50 px-4 py-2.5">
                        <div className="flex items-center gap-2 min-w-0">
                          <span className={`flex-shrink-0 rounded-full px-2 py-0.5 text-xs font-semibold ${
                            item.item_type === "income"
                              ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300"
                              : "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300"
                          }`}>
                            {item.item_type === "income" ? "รายรับ" : "รายจ่าย"}
                          </span>
                          <p className="text-sm text-gray-900 dark:text-gray-100 truncate">{item.name}</p>
                        </div>
                        <div className="flex gap-2 flex-shrink-0">
                          <button
                            onClick={() => setItemModal({ item })}
                            className="px-3 py-1 rounded-lg bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300 text-xs font-semibold hover:bg-amber-200 dark:hover:bg-amber-900/50 transition cursor-pointer"
                          >
                            แก้ไข
                          </button>
                          <button
                            onClick={() => handleDeleteItem(item.id)}
                            className="px-3 py-1 rounded-lg bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300 text-xs font-semibold hover:bg-red-200 dark:hover:bg-red-900/50 transition cursor-pointer"
                          >
                            ลบ
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )
            })}

            {allItems.length === 0 && (
              <p className="text-sm text-gray-400 dark:text-gray-500 text-center py-4">ยังไม่มีรายการ</p>
            )}
          </div>
        </div>
      )}

      {/* ── Modals ── */}
      {txModal !== null && (
        <TransactionModal
          items={items}
          defaultDate={filterDate}
          tx={txModal.tx}
          onSave={() => { setTxModal(null); setTxVersion((v) => v + 1) }}
          onClose={() => setTxModal(null)}
        />
      )}
      {facilityModal !== null && (
        <FacilityModal
          facility={facilityModal.facility}
          onSave={() => { setFacilityModal(null); setAdminVersion((v) => v + 1) }}
          onClose={() => setFacilityModal(null)}
        />
      )}
      {itemModal !== null && (
        <ItemModal
          facilities={facilities}
          item={itemModal.item}
          onSave={() => { setItemModal(null); setAdminVersion((v) => v + 1) }}
          onClose={() => setItemModal(null)}
        />
      )}
    </div>
  )
}
