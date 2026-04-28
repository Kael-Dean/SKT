import { useEffect, useState } from "react"
import { apiAuth } from "../../../lib/api"
import Portal from "../../../components/Portal"
import SelectDropdown from "../../../components/SelectDropdown"
import {
  cx, baseField, labelCls, modalCardCls, modalTitleCls,
  submitBtnCls, secondaryBtnCls, resetBtnCls, cardCls,
} from "../../../lib/styles"

const ROLE = { ADMIN: 1, HA: 4, MKT: 5 }

const fmtMoney = (v) =>
  new Intl.NumberFormat("th-TH", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(parseFloat(v) || 0)

const sanitizeDecimal = (s) => {
  const clean = s.replace(/[^0-9.]/g, "")
  const parts = clean.split(".")
  return parts.length > 2 ? parts[0] + "." + parts.slice(1).join("") : clean
}

export default function DebtTotalsTab({ roleId, units, programs, fiscalYears, filters, onTotalsChanged }) {
  const canWrite  = [ROLE.ADMIN, ROLE.HA, ROLE.MKT].includes(roleId)
  const canDelete = [ROLE.ADMIN, ROLE.HA].includes(roleId)

  const [totals, setTotals]   = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError]     = useState("")
  const [modal, setModal]     = useState(null)
  const [form, setForm]       = useState({ unit_id: "", program_id: "", fiscal_year_id: "", original_amount: "", comment: "" })
  const [saving, setSaving]   = useState(false)
  const [saveMsg, setSaveMsg] = useState("")

  useEffect(() => {
    let alive = true
    setLoading(true)
    setError("")
    ;(async () => {
      try {
        const params = new URLSearchParams()
        if (filters.unit_id)        params.set("unit_id", filters.unit_id)
        if (filters.program_id)     params.set("program_id", filters.program_id)
        if (filters.fiscal_year_id) params.set("fiscal_year_id", filters.fiscal_year_id)
        const url = `/debt/totals${params.toString() ? "?" + params.toString() : ""}`
        const data = await apiAuth(url)
        if (alive) setTotals(Array.isArray(data) ? data.filter((r) => r.is_active !== false) : [])
      } catch (e) {
        if (alive) setError(e.message || "โหลดข้อมูลไม่สำเร็จ")
      } finally {
        if (alive) setLoading(false)
      }
    })()
    return () => { alive = false }
  }, [filters.unit_id, filters.program_id, filters.fiscal_year_id])

  function unitName(id)  { return units.find((u) => u.id === Number(id))?.name || `หน่วย ${id}` }
  function progName(id)  { return programs.find((p) => p.id === Number(id))?.prog_name || `โปรแกรม ${id}` }
  function yearName(id)  { return fiscalYears.find((y) => y.id === Number(id))?.year_name || String(id) }

  // SelectDropdown options
  const unitOpts  = units.map((u) => ({ value: String(u.id), label: u.name }))
  const progOpts  = programs.filter((p) => p.is_active !== false).map((p) => ({ value: String(p.id), label: p.prog_name }))
  const yearOpts  = fiscalYears.map((y) => ({ value: String(y.id), label: y.year_name }))

  function openAdd() {
    setForm({ unit_id: "", program_id: "", fiscal_year_id: "", original_amount: "", comment: "" })
    setSaveMsg("")
    setModal({ mode: "add" })
  }

  function openEdit(record) {
    setForm({
      unit_id: String(record.unit_id),
      program_id: String(record.program_id),
      fiscal_year_id: String(record.fiscal_year_id),
      original_amount: record.original_amount,
      comment: record.comment || "",
    })
    setSaveMsg("")
    setModal({ mode: "edit", record })
  }

  function openDelete(record) {
    setSaveMsg("")
    setModal({ mode: "delete", record })
  }

  function closeModal() { setModal(null); setSaveMsg("") }

  async function refetch() {
    const params = new URLSearchParams()
    if (filters.unit_id)        params.set("unit_id", filters.unit_id)
    if (filters.program_id)     params.set("program_id", filters.program_id)
    if (filters.fiscal_year_id) params.set("fiscal_year_id", filters.fiscal_year_id)
    const url = `/debt/totals${params.toString() ? "?" + params.toString() : ""}`
    const data = await apiAuth(url)
    setTotals(Array.isArray(data) ? data.filter((r) => r.is_active !== false) : [])
    onTotalsChanged?.()
  }

  async function handleSave() {
    if (!form.unit_id || !form.program_id || !form.fiscal_year_id) {
      setSaveMsg("กรุณาเลือกหน่วยงาน โปรแกรม และปีงบประมาณ"); return
    }
    if (!form.original_amount || parseFloat(form.original_amount) <= 0) {
      setSaveMsg("กรุณากรอกยอดหนี้ที่มากกว่า 0"); return
    }
    setSaving(true); setSaveMsg("")
    try {
      if (modal.mode === "add") {
        await apiAuth("/debt/totals", {
          method: "POST",
          body: {
            unit_id: Number(form.unit_id),
            program_id: Number(form.program_id),
            fiscal_year_id: Number(form.fiscal_year_id),
            amount: form.original_amount,
            comment: form.comment.trim() || null,
          },
        })
      } else {
        await apiAuth(`/debt/totals/${modal.record.id}`, {
          method: "PATCH",
          body: {
            original_amount: form.original_amount,
            comment: form.comment.trim() || null,
          },
        })
      }
      closeModal()
      await refetch()
    } catch (e) {
      setSaveMsg(e.message || "บันทึกไม่สำเร็จ")
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete() {
    setSaving(true); setSaveMsg("")
    try {
      await apiAuth(`/debt/totals/${modal.record.id}`, { method: "DELETE" })
      closeModal()
      setTotals((prev) => prev.filter((r) => r.id !== modal.record.id))
      onTotalsChanged?.()
    } catch (e) {
      setSaveMsg(e.message || "ลบไม่สำเร็จ")
    } finally {
      setSaving(false)
    }
  }

  const totalOriginal  = totals.reduce((s, r) => s + parseFloat(r.original_amount || 0), 0)
  const totalRemaining = totals.reduce((s, r) => s + parseFloat(r.remaining_amount || 0), 0)
  const totalPaid      = totalOriginal - totalRemaining

  return (
    <div className="space-y-4">
      {/* Summary row */}
      {totals.length > 0 && (
        <div className="grid grid-cols-3 gap-3">
          {[
            { label: "ยอดหนี้ตั้งต้น",  value: totalOriginal,  color: "text-gray-900 dark:text-gray-100" },
            { label: "ชำระแล้ว",        value: totalPaid,      color: "text-emerald-700 dark:text-emerald-400" },
            { label: "ยอดคงเหลือ",      value: totalRemaining, color: "text-red-600 dark:text-red-400" },
          ].map((s) => (
            <div key={s.label} className={cx(cardCls, "p-4 text-center")}>
              <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">{s.label}</p>
              <p className={cx("text-base font-bold tabular-nums", s.color)}>฿{fmtMoney(s.value)}</p>
            </div>
          ))}
        </div>
      )}

      <div className="flex items-center justify-between">
        <p className="text-sm text-gray-500 dark:text-gray-400">
          {loading ? "กำลังโหลด…" : `พบ ${totals.length} รายการ`}
        </p>
        {canWrite && (
          <button onClick={openAdd} className={cx(secondaryBtnCls, "!py-2 !px-4 !text-sm")}>
            + บันทึกหนี้คงค้าง
          </button>
        )}
      </div>

      {error && (
        <div className="rounded-2xl bg-red-50 dark:bg-red-900/20 px-4 py-3 text-sm text-red-600 dark:text-red-400">
          {error}
        </div>
      )}

      {loading ? (
        <div className="flex justify-center py-12">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-gray-200 border-t-indigo-500 dark:border-gray-700 dark:border-t-indigo-400" />
        </div>
      ) : totals.length === 0 && !error ? (
        <div className={cx(cardCls, "py-12 text-center text-sm text-gray-400 dark:text-gray-500")}>
          ไม่พบข้อมูล — ลองเปลี่ยนตัวกรองหรือเพิ่มรายการใหม่
        </div>
      ) : (
        <div className={cx(cardCls, "overflow-hidden")}>
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/60">
                  {["หน่วยงาน", "โปรแกรมหนี้", "ปีงบประมาณ", "ยอดตั้งต้น", "ยอดคงเหลือ", "หมายเหตุ", "จัดการ"].map((h) => (
                    <th key={h} className={cx("px-4 py-3 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide whitespace-nowrap", h === "จัดการ" ? "text-right" : "text-left")}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-700/60">
                {totals.map((row) => (
                  <tr key={row.id} className="hover:bg-gray-50 dark:hover:bg-gray-800/40 transition-colors">
                    <td className="px-4 py-3 font-medium text-gray-900 dark:text-gray-100 whitespace-nowrap">{unitName(row.unit_id)}</td>
                    <td className="px-4 py-3 text-gray-700 dark:text-gray-300 whitespace-nowrap">{progName(row.program_id)}</td>
                    <td className="px-4 py-3 text-gray-700 dark:text-gray-300 whitespace-nowrap">{yearName(row.fiscal_year_id)}</td>
                    <td className="px-4 py-3 text-right tabular-nums text-gray-900 dark:text-gray-100 whitespace-nowrap">
                      ฿{fmtMoney(row.original_amount)}
                    </td>
                    <td className={cx("px-4 py-3 text-right tabular-nums font-semibold whitespace-nowrap",
                      parseFloat(row.remaining_amount) > 0 ? "text-red-600 dark:text-red-400" : "text-emerald-600 dark:text-emerald-400"
                    )}>
                      ฿{fmtMoney(row.remaining_amount)}
                    </td>
                    <td className="px-4 py-3 text-gray-500 dark:text-gray-400 max-w-[180px] truncate">{row.comment || "—"}</td>
                    <td className="px-4 py-3 text-right">
                      <div className="inline-flex items-center gap-2">
                        {canWrite && (
                          <button onClick={() => openEdit(row)} className="rounded-lg px-3 py-1.5 text-xs font-medium text-indigo-600 hover:bg-indigo-50 dark:text-indigo-400 dark:hover:bg-indigo-900/20 transition-colors cursor-pointer">
                            แก้ไข
                          </button>
                        )}
                        {canDelete && (
                          <button onClick={() => openDelete(row)} className="rounded-lg px-3 py-1.5 text-xs font-medium text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-900/20 transition-colors cursor-pointer">
                            ลบ
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Add / Edit Modal */}
      {modal && modal.mode !== "delete" && (
        <Portal>
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
            <div className={cx(modalCardCls, "max-w-md w-full")}>
              <h2 className={cx(modalTitleCls, "mb-5")}>
                {modal.mode === "add" ? "บันทึกหนี้คงค้าง" : "แก้ไขยอดหนี้"}
              </h2>
              <div className="space-y-4">
                {modal.mode === "add" ? (
                  <>
                    <div>
                      <label className={labelCls}>หน่วยงาน <span className="text-red-500">*</span></label>
                      <SelectDropdown
                        options={unitOpts}
                        value={form.unit_id}
                        onChange={(val) => setForm((f) => ({ ...f, unit_id: val }))}
                        placeholder="— เลือกหน่วยงาน —"
                      />
                    </div>
                    <div>
                      <label className={labelCls}>โปรแกรมหนี้ <span className="text-red-500">*</span></label>
                      <SelectDropdown
                        options={progOpts}
                        value={form.program_id}
                        onChange={(val) => setForm((f) => ({ ...f, program_id: val }))}
                        placeholder="— เลือกโปรแกรม —"
                      />
                    </div>
                    <div>
                      <label className={labelCls}>ปีงบประมาณ <span className="text-red-500">*</span></label>
                      <SelectDropdown
                        options={yearOpts}
                        value={form.fiscal_year_id}
                        onChange={(val) => setForm((f) => ({ ...f, fiscal_year_id: val }))}
                        placeholder="— เลือกปีงบประมาณ —"
                      />
                    </div>
                  </>
                ) : (
                  <div className="rounded-xl bg-gray-50 dark:bg-gray-700/40 px-4 py-3 text-sm text-gray-600 dark:text-gray-300 space-y-1">
                    <div><span className="font-medium">หน่วยงาน:</span> {unitName(modal.record.unit_id)}</div>
                    <div><span className="font-medium">โปรแกรม:</span> {progName(modal.record.program_id)}</div>
                    <div><span className="font-medium">ปีงบประมาณ:</span> {yearName(modal.record.fiscal_year_id)}</div>
                  </div>
                )}
                <div>
                  <label className={labelCls}>ยอดหนี้ตั้งต้น (บาท) <span className="text-red-500">*</span></label>
                  <input
                    className={baseField}
                    inputMode="decimal"
                    value={form.original_amount}
                    onChange={(e) => setForm((f) => ({ ...f, original_amount: sanitizeDecimal(e.target.value) }))}
                    placeholder="0.00"
                  />
                  {modal.mode === "edit" && (
                    <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                      ยอดคงเหลือจะเปลี่ยนตาม delta ของยอดตั้งต้น
                    </p>
                  )}
                </div>
                <div>
                  <label className={labelCls}>หมายเหตุ</label>
                  <textarea
                    className={cx(baseField, "resize-none")}
                    rows={2}
                    value={form.comment}
                    onChange={(e) => setForm((f) => ({ ...f, comment: e.target.value }))}
                    placeholder="หมายเหตุ (ไม่จำเป็น)"
                  />
                </div>
              </div>
              {saveMsg && <p className="mt-3 text-sm text-red-500 dark:text-red-400">{saveMsg}</p>}
              <div className="mt-6 flex justify-end gap-3">
                <button onClick={closeModal} className={resetBtnCls} disabled={saving}>ยกเลิก</button>
                <button onClick={handleSave} className={submitBtnCls} disabled={saving}>
                  {saving ? "กำลังบันทึก…" : "บันทึก"}
                </button>
              </div>
            </div>
          </div>
        </Portal>
      )}

      {/* Delete Modal */}
      {modal?.mode === "delete" && (
        <Portal>
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
            <div className={cx(modalCardCls, "max-w-sm w-full")}>
              <h2 className={cx(modalTitleCls, "mb-2")}>ยืนยันการลบ</h2>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                ต้องการลบยอดหนี้ของ <span className="font-semibold text-gray-900 dark:text-gray-100">{unitName(modal.record.unit_id)}</span> — <span className="font-semibold">{progName(modal.record.program_id)}</span> ปี <span className="font-semibold">{yearName(modal.record.fiscal_year_id)}</span> ใช่หรือไม่?
              </p>
              {saveMsg && <p className="mt-3 text-sm text-red-500 dark:text-red-400">{saveMsg}</p>}
              <div className="mt-6 flex justify-end gap-3">
                <button onClick={closeModal} className={resetBtnCls} disabled={saving}>ยกเลิก</button>
                <button
                  onClick={handleDelete}
                  disabled={saving}
                  className="inline-flex items-center justify-center gap-2 rounded-2xl bg-red-600 px-6 py-3 text-base font-semibold text-white shadow-sm cursor-pointer hover:bg-red-700 disabled:opacity-60 disabled:cursor-not-allowed transition-all duration-200"
                >
                  {saving ? "กำลังลบ…" : "ยืนยันลบ"}
                </button>
              </div>
            </div>
          </div>
        </Portal>
      )}
    </div>
  )
}
