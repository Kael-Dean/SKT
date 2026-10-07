// src/pages/hr/tabs/HRHolidayWorkTab.jsx
// ทะเบียนทำงานวันหยุด (3N) — GET/POST /hr/holiday-work, DELETE /hr/holiday-work/{id}
//
// บันทึกกรณีที่พนักงานถูกสั่งให้มาทำงานในวันที่ไม่ใช่วันทำงาน (เสาร์-อาทิตย์
// หรือวันหยุดที่ประกาศไว้) ค่าตอบแทนตามระเบียบสหกรณ์คือ 2 เท่าของค่าจ้างรายวัน
import { useEffect, useState, useCallback } from "react"
import { apiAuth } from "../../../lib/api"
import Portal from "../../../components/Portal"
import { SkeletonTableRows, ErrorState, EmptyState } from "../../../components/ui"
import { currentFiscalYearBE } from "../../../lib/leaveDays"
import useModalDismiss from "../../../lib/useModalDismiss"

const WORK_COLS = 6

const inputCls = "w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-3 py-2 text-sm text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-indigo-500"

const fmtMul = (v) => (v == null ? "—" : `${Number(v).toLocaleString("th-TH", { minimumFractionDigits: 1 })} เท่า`)

function fmtDate(d) {
  if (!d) return "—"
  try { return new Date(`${d}T00:00:00`).toLocaleDateString("th-TH", { day: "numeric", month: "long", year: "numeric" }) } catch { return d }
}
function weekday(d) {
  if (!d) return ""
  try { return new Date(`${d}T00:00:00`).toLocaleDateString("th-TH", { weekday: "long" }) } catch { return "" }
}

const emptyForm = () => ({ user_id: "", work_date: "", pay_multiplier: "2.0", order_reference: "", note: "" })

export default function HRHolidayWorkTab() {
  const [fiscalYear, setFiscalYear] = useState(currentFiscalYearBE())
  const [yearInput, setYearInput] = useState(String(currentFiscalYearBE()))
  const [userFilter, setUserFilter] = useState("")

  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")

  const [modal, setModal] = useState(false)
  const [form, setForm] = useState(emptyForm())
  const [saving, setSaving] = useState(false)
  const [saveMsg, setSaveMsg] = useState(null) // { ok, text }

  const [removeTarget, setRemoveTarget] = useState(null)
  const [removing, setRemoving] = useState(null) // row id
  const [removeErr, setRemoveErr] = useState("")
  const { backdropProps: formBackdrop } = useModalDismiss(() => setModal(false), { open: modal, disabled: saving })
  const { backdropProps: removeBackdrop } = useModalDismiss(() => setRemoveTarget(null), { open: !!removeTarget, disabled: !!removing })

  const fetchRows = useCallback(() => {
    setLoading(true)
    setError("")
    const p = new URLSearchParams({ fiscal_year: String(fiscalYear) })
    if (userFilter.trim()) p.set("user_id", userFilter.trim())
    apiAuth(`/hr/holiday-work?${p.toString()}`)
      .then((d) => setRows(Array.isArray(d) ? d : []))
      .catch((e) => setError(e.message || "โหลดข้อมูลไม่สำเร็จ"))
      .finally(() => setLoading(false))
  }, [fiscalYear, userFilter])

  useEffect(() => { fetchRows() }, [fetchRows])

  const applyFilter = () => {
    const y = Number(yearInput)
    if (y >= 2560 && y <= 2599) setFiscalYear(y)
    else fetchRows()
  }

  const openCreate = () => {
    setForm(emptyForm())
    setSaveMsg(null)
    setModal(true)
  }

  const handleSave = async () => {
    if (!form.user_id.trim()) { setSaveMsg({ ok: false, text: "กรุณากรอกรหัสพนักงาน" }); return }
    if (!form.work_date) { setSaveMsg({ ok: false, text: "กรุณาเลือกวันที่ทำงาน" }); return }
    if (!(Number(form.pay_multiplier) > 0)) { setSaveMsg({ ok: false, text: "ตัวคูณค่าจ้างต้องมากกว่า 0" }); return }

    setSaving(true)
    setSaveMsg(null)
    try {
      await apiAuth("/hr/holiday-work", {
        method: "POST",
        body: {
          user_id: Number(form.user_id),
          work_date: form.work_date,
          pay_multiplier: String(form.pay_multiplier),
          order_reference: form.order_reference.trim() || null,
          note: form.note.trim() || null,
        },
      })
      setSaveMsg({ ok: true, text: "บันทึกสำเร็จ" })
      setTimeout(() => { setModal(false); fetchRows() }, 700)
    } catch (err) {
      const text =
        err.status === 422 ? "วันที่เลือกเป็นวันทำงานปกติ — ค่าจ้างครอบคลุมอยู่ในเงินเดือนรายเดือนแล้ว บันทึกได้เฉพาะเสาร์-อาทิตย์หรือวันหยุดที่ประกาศไว้"
        : err.status === 409 ? "พนักงานคนนี้มีบันทึกการทำงานในวันดังกล่าวอยู่แล้ว"
        : err.status === 404 ? "ไม่พบพนักงานรหัสนี้ในระบบ"
        : err.message || "บันทึกไม่สำเร็จ"
      setSaveMsg({ ok: false, text })
    } finally {
      setSaving(false)
    }
  }

  const handleRemove = async () => {
    const id = removeTarget.id
    setRemoving(id)
    setRemoveErr("")
    try {
      await apiAuth(`/hr/holiday-work/${id}`, { method: "DELETE" })
      setRemoveTarget(null)
      fetchRows()
    } catch (err) {
      setRemoveErr(err.status === 404 ? "ไม่พบรายการนี้ในระบบ" : err.message || "ลบรายการไม่สำเร็จ")
    } finally {
      setRemoving(null)
    }
  }

  return (
    <div className="space-y-4">
      <div className="rounded-2xl bg-white dark:bg-gray-800 ring-1 ring-gray-200/70 dark:ring-gray-700/70 shadow-sm p-4">
        <div className="flex flex-wrap items-end gap-3">
          <div>
            <label className="text-xs font-medium text-gray-600 dark:text-gray-400 block mb-1">ปีงบประมาณ (พ.ศ.)</label>
            <input type="number" min={2560} max={2599} value={yearInput}
              onChange={(e) => setYearInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && applyFilter()}
              className={`${inputCls} w-28 tabular-nums`} />
          </div>
          <div>
            <label className="text-xs font-medium text-gray-600 dark:text-gray-400 block mb-1">รหัสพนักงาน</label>
            <input type="text" value={userFilter}
              onChange={(e) => setUserFilter(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && applyFilter()}
              placeholder="ทั้งหมด" className={`${inputCls} w-40 tabular-nums`} />
          </div>
          <button onClick={applyFilter}
            className="h-10 rounded-xl bg-indigo-600 hover:bg-indigo-500 px-5 text-sm font-semibold text-white shadow-sm transition-colors duration-200 cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-gray-800">
            ค้นหา
          </button>
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-gray-500 dark:text-gray-400">
          {loading ? "กำลังโหลด…" : `บันทึกทำงานวันหยุด ${rows.length} รายการ`}
        </p>
        <button onClick={openCreate}
          className="flex items-center gap-2 h-10 rounded-xl bg-indigo-600 hover:bg-indigo-500 px-4 text-sm font-semibold text-white shadow-sm transition-colors duration-200 cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-gray-900">
          <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="size-4">
            <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
          </svg>
          บันทึกทำงานวันหยุด
        </button>
      </div>

      {error && <ErrorState message={error} onRetry={fetchRows} />}

      <div className="rounded-2xl bg-white dark:bg-gray-800 ring-1 ring-gray-200/70 dark:ring-gray-700/70 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/30">
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 dark:text-gray-400">เจ้าหน้าที่</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 dark:text-gray-400">วันที่ทำงาน</th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 dark:text-gray-400">ตัวคูณค่าจ้าง</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 dark:text-gray-400 hidden md:table-cell">เลขที่คำสั่ง</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 dark:text-gray-400 hidden lg:table-cell">หมายเหตุ</th>
                <th className="px-4 py-3 w-20"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-700/50" aria-busy={loading}>
              {loading ? (
                <SkeletonTableRows rows={6} cols={WORK_COLS} />
              ) : rows.length === 0 ? (
                <tr>
                  <td colSpan={WORK_COLS} className="p-0">
                    <EmptyState
                      title="ยังไม่มีบันทึกการทำงานวันหยุด"
                      description="บันทึกได้เฉพาะวันเสาร์-อาทิตย์ หรือวันหยุดที่ประกาศไว้ในปฏิทิน โดยต้องมีคำสั่งให้มาปฏิบัติงาน"
                    />
                  </td>
                </tr>
              ) : rows.map((r) => (
                <tr key={r.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/30 transition-colors">
                  <td className="px-4 py-3">
                    <p className="font-medium text-gray-900 dark:text-gray-100">{r.full_name || r.employee_name || "—"}</p>
                    <p className="text-xs text-gray-400 dark:text-gray-500 tabular-nums">รหัส {r.user_id}</p>
                  </td>
                  <td className="px-4 py-3">
                    <p className="text-gray-700 dark:text-gray-300 tabular-nums">{fmtDate(r.work_date)}</p>
                    <p className="text-xs text-gray-400 dark:text-gray-500">{weekday(r.work_date)}</p>
                  </td>
                  <td className="px-4 py-3 text-right font-semibold text-emerald-700 dark:text-emerald-300 tabular-nums">{fmtMul(r.pay_multiplier)}</td>
                  <td className="px-4 py-3 text-gray-600 dark:text-gray-400 hidden md:table-cell">{r.order_reference || "—"}</td>
                  <td className="px-4 py-3 text-gray-500 dark:text-gray-400 hidden lg:table-cell max-w-xs truncate">{r.note || "—"}</td>
                  <td className="px-4 py-3 text-right">
                    <button onClick={() => { setRemoveTarget(r); setRemoveErr("") }} disabled={removing === r.id}
                      className="text-xs font-medium text-red-600 dark:text-red-400 hover:underline cursor-pointer disabled:opacity-50 rounded focus:outline-none focus-visible:ring-2 focus-visible:ring-red-500 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-gray-800">
                      {removing === r.id ? "กำลังลบ..." : "ลบ"}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* บันทึกทำงานวันหยุด */}
      {modal && (
        <Portal>
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm" {...formBackdrop}>
            <div role="dialog" aria-modal="true" className="w-full max-w-md rounded-2xl bg-white dark:bg-gray-800 shadow-2xl p-6 space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-bold text-gray-900 dark:text-gray-100">บันทึกทำงานวันหยุด</h3>
                <button onClick={() => setModal(false)} aria-label="ปิด" className="rounded-lg p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600 dark:hover:bg-gray-700 dark:hover:text-gray-200 transition-colors duration-200 cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500">
                  <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="size-5">
                    <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
                  </svg>
                </button>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-medium text-gray-600 dark:text-gray-400 block mb-1">
                    รหัสพนักงาน <span className="text-red-500">*</span>
                  </label>
                  <input type="text" value={form.user_id} onChange={(e) => setForm((f) => ({ ...f, user_id: e.target.value }))}
                    className={`${inputCls} tabular-nums`} placeholder="เช่น 1001" />
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-600 dark:text-gray-400 block mb-1">
                    วันที่ทำงาน <span className="text-red-500">*</span>
                  </label>
                  <input type="date" value={form.work_date} onChange={(e) => setForm((f) => ({ ...f, work_date: e.target.value }))}
                    className={inputCls} />
                </div>
              </div>

              <div>
                <label className="text-xs font-medium text-gray-600 dark:text-gray-400 block mb-1">ตัวคูณค่าจ้าง</label>
                <input type="number" step="0.1" min="0.1" value={form.pay_multiplier}
                  onChange={(e) => setForm((f) => ({ ...f, pay_multiplier: e.target.value }))}
                  className={`${inputCls} tabular-nums`} />
                <p className="mt-1 text-xs text-gray-400 dark:text-gray-500">
                  ระเบียบสหกรณ์กำหนด 2 เท่าของค่าจ้างรายวัน แก้ไขเฉพาะกรณีที่ได้รับอนุมัติเป็นอย่างอื่น
                </p>
              </div>

              <div>
                <label className="text-xs font-medium text-gray-600 dark:text-gray-400 block mb-1">เลขที่คำสั่ง</label>
                <input type="text" value={form.order_reference} onChange={(e) => setForm((f) => ({ ...f, order_reference: e.target.value }))}
                  className={inputCls} placeholder="เช่น คำสั่งที่ 1/2569" />
              </div>

              <div>
                <label className="text-xs font-medium text-gray-600 dark:text-gray-400 block mb-1">หมายเหตุ</label>
                <input type="text" value={form.note} onChange={(e) => setForm((f) => ({ ...f, note: e.target.value }))}
                  className={inputCls} placeholder="ไม่บังคับ" />
              </div>

              {saveMsg && (
                <p role="status" className={`text-sm text-center leading-relaxed ${saveMsg.ok ? "text-emerald-600 dark:text-emerald-400" : "text-red-600 dark:text-red-400"}`}>
                  {saveMsg.text}
                </p>
              )}

              <div className="flex gap-3">
                <button onClick={() => setModal(false)} className="flex-1 h-10 rounded-xl border border-gray-300 dark:border-gray-600 text-sm font-semibold text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700 transition cursor-pointer">ยกเลิก</button>
                <button onClick={handleSave} disabled={saving}
                  className="flex-1 h-10 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-semibold transition shadow-sm disabled:opacity-60 cursor-pointer">
                  {saving ? "กำลังบันทึก..." : "บันทึก"}
                </button>
              </div>
            </div>
          </div>
        </Portal>
      )}

      {/* ยืนยันลบ */}
      {removeTarget && (
        <Portal>
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm" {...removeBackdrop}>
            <div role="dialog" aria-modal="true" className="w-full max-w-sm rounded-2xl bg-white dark:bg-gray-800 shadow-2xl p-6 space-y-4">
              <h3 className="text-lg font-bold text-gray-900 dark:text-gray-100">ลบบันทึกการทำงาน</h3>
              <p className="text-sm text-gray-600 dark:text-gray-400 leading-relaxed">
                ลบบันทึกของ <span className="font-semibold text-gray-900 dark:text-gray-100">{removeTarget.full_name || `รหัส ${removeTarget.user_id}`}</span>{" "}
                วันที่ {fmtDate(removeTarget.work_date)} ใช่หรือไม่
              </p>
              {removeErr && <p role="alert" className="text-sm text-center text-red-600 dark:text-red-400">{removeErr}</p>}
              <div className="flex gap-3">
                <button onClick={() => setRemoveTarget(null)} className="flex-1 h-10 rounded-xl border border-gray-300 dark:border-gray-600 text-sm font-semibold text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700 transition cursor-pointer">ยกเลิก</button>
                <button onClick={handleRemove} disabled={removing != null}
                  className="flex-1 h-10 rounded-xl bg-red-600 hover:bg-red-500 text-white text-sm font-semibold transition shadow-sm disabled:opacity-60 cursor-pointer">
                  {removing != null ? "กำลังลบ..." : "ลบ"}
                </button>
              </div>
            </div>
          </div>
        </Portal>
      )}
    </div>
  )
}
