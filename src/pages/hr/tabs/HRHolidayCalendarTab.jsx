// src/pages/hr/tabs/HRHolidayCalendarTab.jsx
// ปฏิทินวันหยุด (3N) — GET/POST /hr/holidays, PATCH/DELETE /hr/holidays/{id},
// POST /hr/holidays/copy-year
//
// สหกรณ์ไม่ได้ใช้ปฏิทินวันหยุดราชการ — HR ประกาศเองทุกวัน และวันหยุดที่ประกาศ
// จะถูกตัดออกจากจำนวนวันลาโดยอัตโนมัติ การประกาศ/ยกเลิกจึงมีผลย้อนหลังกับใบลา
// ที่คร่อมวันนั้น ห้าม optimistic update — ต้องรอ response แล้วโหลดใหม่เสมอ
import { useEffect, useState, useCallback } from "react"
import { apiAuth } from "../../../lib/api"
import Portal from "../../../components/Portal"
import { SkeletonTableRows, ErrorState, EmptyState, Badge } from "../../../components/ui"
import { currentFiscalYearBE, fmtDays } from "../../../lib/leaveDays"

const HOLIDAY_COLS = 5

const HOLIDAY_TYPES = [
  { value: "annual", label: "วันหยุดประจำปี" },
  { value: "special", label: "วันหยุดพิเศษประกาศเพิ่ม" },
]
const TYPE_LABEL = { annual: "วันหยุดประจำปี", special: "วันหยุดพิเศษ" }
const TYPE_TONE = { annual: "info", special: "pending" }

const inputCls = "w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-3 py-2 text-sm text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-indigo-500"

function fmtDate(d) {
  if (!d) return "—"
  try { return new Date(`${d}T00:00:00`).toLocaleDateString("th-TH", { day: "numeric", month: "long", year: "numeric" }) } catch { return d }
}
function weekday(d) {
  if (!d) return ""
  try { return new Date(`${d}T00:00:00`).toLocaleDateString("th-TH", { weekday: "long" }) } catch { return "" }
}

export default function HRHolidayCalendarTab() {
  const [fiscalYear, setFiscalYear] = useState(currentFiscalYearBE())
  const [yearInput, setYearInput] = useState(String(currentFiscalYearBE()))
  const [includeInactive, setIncludeInactive] = useState(false)

  const [holidays, setHolidays] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")

  // { mode: "create" | "edit", holiday? }
  const [modal, setModal] = useState(null)
  const [form, setForm] = useState({ holiday_date: "", name: "", holiday_type: "annual", note: "" })
  const [saving, setSaving] = useState(false)
  const [saveMsg, setSaveMsg] = useState(null) // { ok, text }

  // { holiday, result? }
  const [cancelModal, setCancelModal] = useState(null)
  const [cancelling, setCancelling] = useState(false)
  const [cancelErr, setCancelErr] = useState("")

  const [copyModal, setCopyModal] = useState(false)
  const [copyForm, setCopyForm] = useState({ from_fiscal_year: "", to_fiscal_year: "" })
  const [copying, setCopying] = useState(false)
  const [copyMsg, setCopyMsg] = useState(null) // { ok, text }
  const [copyResult, setCopyResult] = useState(null)

  const fetchHolidays = useCallback(() => {
    setLoading(true)
    setError("")
    const p = new URLSearchParams({ fiscal_year: String(fiscalYear) })
    if (includeInactive) p.set("include_inactive", "true")
    apiAuth(`/hr/holidays?${p.toString()}`)
      .then((d) => setHolidays(Array.isArray(d) ? d : []))
      .catch((e) => setError(e.message || "โหลดปฏิทินวันหยุดไม่สำเร็จ"))
      .finally(() => setLoading(false))
  }, [fiscalYear, includeInactive])

  useEffect(() => { fetchHolidays() }, [fetchHolidays])

  const applyYear = () => {
    const y = Number(yearInput)
    if (y >= 2560 && y <= 2599) setFiscalYear(y)
  }

  const openCreate = () => {
    setModal({ mode: "create" })
    setForm({ holiday_date: "", name: "", holiday_type: "annual", note: "" })
    setSaveMsg(null)
  }

  const openEdit = (h) => {
    setModal({ mode: "edit", holiday: h })
    setForm({ holiday_date: h.holiday_date, name: h.name ?? "", holiday_type: h.holiday_type ?? "annual", note: h.note ?? "" })
    setSaveMsg(null)
  }

  const handleSave = async () => {
    if (modal.mode === "create" && !form.holiday_date) {
      setSaveMsg({ ok: false, text: "กรุณาเลือกวันที่" })
      return
    }
    if (!form.name.trim()) {
      setSaveMsg({ ok: false, text: "กรุณากรอกชื่อวันหยุด" })
      return
    }
    setSaving(true)
    setSaveMsg(null)
    try {
      if (modal.mode === "create") {
        await apiAuth("/hr/holidays", {
          method: "POST",
          body: {
            holiday_date: form.holiday_date,
            name: form.name.trim(),
            holiday_type: form.holiday_type,
            note: form.note.trim() || null,
          },
        })
      } else {
        // วันที่แก้ไม่ได้ — ส่งเฉพาะฟิลด์ที่ backend รับ
        await apiAuth(`/hr/holidays/${modal.holiday.id}`, {
          method: "PATCH",
          body: { name: form.name.trim(), holiday_type: form.holiday_type, note: form.note.trim() || null },
        })
      }
      setSaveMsg({ ok: true, text: "บันทึกสำเร็จ — กำลังคำนวณใบลาที่เกี่ยวข้องใหม่" })
      setTimeout(() => { setModal(null); fetchHolidays() }, 800)
    } catch (err) {
      const text =
        err.status === 409 ? "วันที่นี้ถูกประกาศเป็นวันหยุดอยู่แล้ว"
        : err.status === 422 ? "ประเภทวันหยุดไม่ถูกต้อง"
        : err.status === 403 ? "สิทธิ์ของคุณไม่สามารถประกาศวันหยุดได้"
        : err.message || "บันทึกไม่สำเร็จ"
      setSaveMsg({ ok: false, text })
    } finally {
      setSaving(false)
    }
  }

  const handleCancel = async () => {
    setCancelling(true)
    setCancelErr("")
    try {
      const res = await apiAuth(`/hr/holidays/${cancelModal.holiday.id}`, { method: "DELETE" })
      setCancelModal((m) => ({ ...m, result: res ?? {} }))
      fetchHolidays()
    } catch (err) {
      setCancelErr(
        err.status === 409 ? "วันหยุดนี้ถูกยกเลิกไปแล้ว"
        : err.status === 404 ? "ไม่พบวันหยุดนี้ในระบบ"
        : err.message || "ยกเลิกวันหยุดไม่สำเร็จ"
      )
    } finally {
      setCancelling(false)
    }
  }

  const openCopy = () => {
    setCopyForm({ from_fiscal_year: String(fiscalYear), to_fiscal_year: String(fiscalYear + 1) })
    setCopyMsg(null)
    setCopyResult(null)
    setCopyModal(true)
  }

  const handleCopy = async () => {
    const from = Number(copyForm.from_fiscal_year)
    const to = Number(copyForm.to_fiscal_year)
    if (!from || !to) { setCopyMsg({ ok: false, text: "กรุณากรอกปีงบประมาณให้ครบ" }); return }
    if (from === to) { setCopyMsg({ ok: false, text: "ปีต้นทางและปีปลายทางต้องไม่ใช่ปีเดียวกัน" }); return }
    setCopying(true)
    setCopyMsg(null)
    try {
      const res = await apiAuth("/hr/holidays/copy-year", {
        method: "POST",
        body: { from_fiscal_year: from, to_fiscal_year: to },
      })
      setCopyResult(res ?? {})
      setCopyMsg({ ok: true, text: "คัดลอกปฏิทินสำเร็จ" })
      fetchHolidays()
    } catch (err) {
      setCopyMsg({
        ok: false,
        text: err.status === 404 ? "ปีต้นทางยังไม่มีวันหยุดให้คัดลอก"
          : err.status === 422 ? "ปีต้นทางและปีปลายทางต้องไม่ใช่ปีเดียวกัน"
          : err.message || "คัดลอกไม่สำเร็จ",
      })
    } finally {
      setCopying(false)
    }
  }

  const activeCount = holidays.filter((h) => h.is_active !== false).length

  return (
    <div className="space-y-4">
      {/* ตัวกรองปีงบประมาณ */}
      <div className="rounded-2xl bg-white dark:bg-gray-800 ring-1 ring-gray-200/70 dark:ring-gray-700/70 shadow-sm p-4">
        <div className="flex flex-wrap items-end gap-3">
          <div>
            <label className="text-xs font-medium text-gray-600 dark:text-gray-400 block mb-1">ปีงบประมาณ (พ.ศ.)</label>
            <input
              type="number" min={2560} max={2599} value={yearInput}
              onChange={(e) => setYearInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && applyYear()}
              className={`${inputCls} w-28 tabular-nums`}
            />
          </div>
          <button
            onClick={applyYear}
            className="h-10 rounded-xl bg-indigo-600 hover:bg-indigo-500 px-5 text-sm font-semibold text-white shadow-sm transition-colors duration-200 cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-gray-800"
          >
            ค้นหา
          </button>
          <label className="flex items-center gap-2 h-10 text-sm text-gray-600 dark:text-gray-400 cursor-pointer select-none">
            <input
              type="checkbox" checked={includeInactive}
              onChange={(e) => setIncludeInactive(e.target.checked)}
              className="size-4 rounded border-gray-300 dark:border-gray-600 text-indigo-600 focus:ring-indigo-500 cursor-pointer"
            />
            แสดงวันหยุดที่ยกเลิกแล้ว
          </label>
          <p className="ml-auto text-xs text-gray-400 dark:text-gray-500 max-w-xs leading-relaxed">
            ปีงบประมาณเริ่ม 1 เมษายน — วันที่ในเดือน ม.ค.–มี.ค. นับเป็นปีงบประมาณก่อนหน้า
          </p>
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-gray-500 dark:text-gray-400">
          {loading ? "กำลังโหลด…" : `วันหยุดปีงบประมาณ ${fiscalYear} · ${activeCount} วัน`}
        </p>
        <div className="flex items-center gap-2">
          <button
            onClick={openCopy}
            className="h-10 rounded-xl border border-gray-300 dark:border-gray-600 px-4 text-sm font-semibold text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors duration-200 cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
          >
            คัดลอกจากปีก่อน
          </button>
          <button
            onClick={openCreate}
            className="flex items-center gap-2 h-10 rounded-xl bg-indigo-600 hover:bg-indigo-500 px-4 text-sm font-semibold text-white shadow-sm transition-colors duration-200 cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-gray-900"
          >
            <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="size-4">
              <line x1="12" y1="5" x2="12" y2="19" />
              <line x1="5" y1="12" x2="19" y2="12" />
            </svg>
            ประกาศวันหยุด
          </button>
        </div>
      </div>

      {error && <ErrorState message={error} onRetry={fetchHolidays} />}

      <div className="rounded-2xl bg-white dark:bg-gray-800 ring-1 ring-gray-200/70 dark:ring-gray-700/70 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/30">
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 dark:text-gray-400">วันที่</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 dark:text-gray-400">ชื่อวันหยุด</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 dark:text-gray-400">ประเภท</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 dark:text-gray-400 hidden lg:table-cell">หมายเหตุ</th>
                <th className="px-4 py-3 w-32"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-700/50" aria-busy={loading}>
              {loading ? (
                <SkeletonTableRows rows={6} cols={HOLIDAY_COLS} />
              ) : holidays.length === 0 ? (
                <tr>
                  <td colSpan={HOLIDAY_COLS} className="p-0">
                    <EmptyState
                      title={`ยังไม่มีวันหยุดในปีงบประมาณ ${fiscalYear}`}
                      description="สหกรณ์เป็นผู้ประกาศวันหยุดเอง ไม่ได้ใช้ปฏิทินวันหยุดราชการ กดประกาศวันหยุดเพื่อเพิ่มวันแรก หรือคัดลอกปฏิทินจากปีก่อนมาแก้ไข"
                    />
                  </td>
                </tr>
              ) : holidays.map((h) => {
                const inactive = h.is_active === false
                return (
                  <tr key={h.id} className={`transition-colors ${inactive ? "opacity-55" : "hover:bg-gray-50 dark:hover:bg-gray-700/30"}`}>
                    <td className="px-4 py-3">
                      <p className="font-medium text-gray-900 dark:text-gray-100 tabular-nums">{fmtDate(h.holiday_date)}</p>
                      <p className="text-xs text-gray-400 dark:text-gray-500">{weekday(h.holiday_date)}</p>
                    </td>
                    <td className="px-4 py-3 text-gray-700 dark:text-gray-300">
                      {h.name || "—"}
                      {inactive && <span className="ml-2 text-xs text-gray-400 dark:text-gray-500">(ยกเลิกแล้ว)</span>}
                    </td>
                    <td className="px-4 py-3">
                      <Badge tone={TYPE_TONE[h.holiday_type] ?? "neutral"}>{TYPE_LABEL[h.holiday_type] ?? h.holiday_type}</Badge>
                    </td>
                    <td className="px-4 py-3 text-gray-500 dark:text-gray-400 hidden lg:table-cell max-w-xs truncate">{h.note || "—"}</td>
                    <td className="px-4 py-3 text-right whitespace-nowrap">
                      {!inactive && (
                        <>
                          <button onClick={() => openEdit(h)} className="text-xs font-medium text-indigo-600 dark:text-indigo-400 hover:underline cursor-pointer rounded focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-gray-800">แก้ไข</button>
                          <button onClick={() => { setCancelModal({ holiday: h }); setCancelErr("") }} className="ml-4 text-xs font-medium text-red-600 dark:text-red-400 hover:underline cursor-pointer rounded focus:outline-none focus-visible:ring-2 focus-visible:ring-red-500 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-gray-800">ยกเลิก</button>
                        </>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* ประกาศ / แก้ไขวันหยุด */}
      {modal && (
        <Portal>
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
            <div className="w-full max-w-md rounded-2xl bg-white dark:bg-gray-800 shadow-2xl p-6 space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-bold text-gray-900 dark:text-gray-100">
                  {modal.mode === "create" ? "ประกาศวันหยุด" : "แก้ไขวันหยุด"}
                </h3>
                <button onClick={() => setModal(null)} aria-label="ปิด" className="rounded-lg p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600 dark:hover:bg-gray-700 dark:hover:text-gray-200 transition-colors duration-200 cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500">
                  <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="size-5">
                    <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
                  </svg>
                </button>
              </div>

              <div>
                <label className="text-xs font-medium text-gray-600 dark:text-gray-400 block mb-1">
                  วันที่ {modal.mode === "create" && <span className="text-red-500">*</span>}
                </label>
                <input
                  type="date" value={form.holiday_date}
                  onChange={(e) => setForm((f) => ({ ...f, holiday_date: e.target.value }))}
                  disabled={modal.mode === "edit"}
                  className={`${inputCls} disabled:opacity-60 disabled:cursor-not-allowed`}
                />
                {modal.mode === "edit" && (
                  <p className="mt-1 text-xs text-gray-400 dark:text-gray-500">
                    วันที่แก้ไขไม่ได้ — หากต้องการย้ายวัน ให้ยกเลิกวันนี้แล้วประกาศวันใหม่ เพื่อให้ทั้งสองวันถูกคำนวณใบลาใหม่
                  </p>
                )}
              </div>

              <div>
                <label className="text-xs font-medium text-gray-600 dark:text-gray-400 block mb-1">
                  ชื่อวันหยุด <span className="text-red-500">*</span>
                </label>
                <input type="text" value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                  className={inputCls} placeholder="เช่น วันเข้าพรรษา" />
              </div>

              <div>
                <label className="text-xs font-medium text-gray-600 dark:text-gray-400 block mb-1">ประเภทวันหยุด</label>
                <select value={form.holiday_type} onChange={(e) => setForm((f) => ({ ...f, holiday_type: e.target.value }))} className={inputCls}>
                  {HOLIDAY_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
                </select>
              </div>

              <div>
                <label className="text-xs font-medium text-gray-600 dark:text-gray-400 block mb-1">หมายเหตุ</label>
                <input type="text" value={form.note} onChange={(e) => setForm((f) => ({ ...f, note: e.target.value }))}
                  className={inputCls} placeholder="ไม่บังคับ" />
              </div>

              {modal.mode === "create" && (
                <div className="rounded-xl bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800/60 px-3 py-2.5">
                  <p className="text-xs text-amber-800 dark:text-amber-300 leading-relaxed">
                    การประกาศวันหยุดมีผลย้อนหลัง — ใบลาทุกใบที่คร่อมวันนี้ (ทั้งที่อนุมัติแล้วและรออนุมัติ)
                    จะถูกคำนวณจำนวนวันใหม่ และคืนวันลาให้พนักงานโดยอัตโนมัติ
                  </p>
                </div>
              )}

              {saveMsg && (
                <p role="status" className={`text-sm text-center ${saveMsg.ok ? "text-emerald-600 dark:text-emerald-400" : "text-red-600 dark:text-red-400"}`}>
                  {saveMsg.text}
                </p>
              )}

              <div className="flex gap-3">
                <button onClick={() => setModal(null)} className="flex-1 h-10 rounded-xl border border-gray-300 dark:border-gray-600 text-sm font-semibold text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700 transition cursor-pointer">ยกเลิก</button>
                <button onClick={handleSave} disabled={saving}
                  className="flex-1 h-10 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-semibold transition shadow-sm disabled:opacity-60 cursor-pointer">
                  {saving ? "กำลังบันทึก..." : modal.mode === "create" ? "ประกาศวันหยุด" : "บันทึก"}
                </button>
              </div>
            </div>
          </div>
        </Portal>
      )}

      {/* ยกเลิกวันหยุด — ยืนยัน แล้วแสดงใบลาที่ถูกปรับ */}
      {cancelModal && (
        <Portal>
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
            <div className="w-full max-w-lg rounded-2xl bg-white dark:bg-gray-800 shadow-2xl p-6 space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-bold text-gray-900 dark:text-gray-100">
                  {cancelModal.result ? "ยกเลิกวันหยุดแล้ว" : "ยืนยันยกเลิกวันหยุด"}
                </h3>
                <button onClick={() => setCancelModal(null)} aria-label="ปิด" className="rounded-lg p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600 dark:hover:bg-gray-700 dark:hover:text-gray-200 transition-colors duration-200 cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500">
                  <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="size-5">
                    <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
                  </svg>
                </button>
              </div>

              <div className="rounded-xl bg-gray-50 dark:bg-gray-900/40 px-4 py-3">
                <p className="font-semibold text-gray-900 dark:text-gray-100">{cancelModal.holiday.name}</p>
                <p className="text-sm text-gray-500 dark:text-gray-400 tabular-nums">
                  {fmtDate(cancelModal.holiday.holiday_date)} · {weekday(cancelModal.holiday.holiday_date)}
                </p>
              </div>

              {!cancelModal.result ? (
                <>
                  <div className="rounded-xl bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800/60 px-3 py-2.5">
                    <p className="text-xs text-amber-800 dark:text-amber-300 leading-relaxed">
                      วันนี้จะกลับไปเป็นวันทำงานปกติ ใบลาที่คร่อมวันนี้จะถูกนับวันเพิ่มให้ใหม่
                      หากเป็นวันที่ผ่านมาแล้ว ส่วนต่างจะถูกปรับในงวดเงินเดือนถัดไป
                    </p>
                  </div>
                  {cancelErr && <p role="alert" className="text-sm text-center text-red-600 dark:text-red-400">{cancelErr}</p>}
                  <div className="flex gap-3">
                    <button onClick={() => setCancelModal(null)} className="flex-1 h-10 rounded-xl border border-gray-300 dark:border-gray-600 text-sm font-semibold text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700 transition cursor-pointer">ไม่ยกเลิก</button>
                    <button onClick={handleCancel} disabled={cancelling}
                      className="flex-1 h-10 rounded-xl bg-red-600 hover:bg-red-500 text-white text-sm font-semibold transition shadow-sm disabled:opacity-60 cursor-pointer">
                      {cancelling ? "กำลังยกเลิก..." : "ยกเลิกวันหยุด"}
                    </button>
                  </div>
                </>
              ) : (
                <>
                  {cancelModal.result.retroactive && cancelModal.result.note && (
                    <div className="rounded-xl bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800/60 px-3 py-2.5">
                      <p className="text-xs font-semibold text-amber-900 dark:text-amber-200 mb-0.5">การแก้ไขย้อนหลัง</p>
                      <p className="text-xs text-amber-800 dark:text-amber-300 leading-relaxed">{cancelModal.result.note}</p>
                    </div>
                  )}

                  <div>
                    <p className="text-xs font-semibold text-gray-600 dark:text-gray-400 mb-1.5">
                      ใบลาที่ถูกปรับจำนวนวัน ({(cancelModal.result.leaves_adjusted ?? []).length} ใบ)
                    </p>
                    {(cancelModal.result.leaves_adjusted ?? []).length === 0 ? (
                      <p className="text-sm text-gray-500 dark:text-gray-400">ไม่มีใบลาที่ได้รับผลกระทบ</p>
                    ) : (
                      <div className="rounded-xl ring-1 ring-gray-200/70 dark:ring-gray-700/70 overflow-hidden max-h-56 overflow-y-auto">
                        <table className="w-full text-sm">
                          <thead>
                            <tr className="bg-gray-50 dark:bg-gray-900/30">
                              <th className="text-left px-3 py-2 text-xs font-semibold text-gray-500 dark:text-gray-400">เลขที่ใบลา</th>
                              <th className="text-left px-3 py-2 text-xs font-semibold text-gray-500 dark:text-gray-400">รหัสพนักงาน</th>
                              <th className="text-right px-3 py-2 text-xs font-semibold text-gray-500 dark:text-gray-400">จำนวนวัน</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-gray-100 dark:divide-gray-700/50">
                            {cancelModal.result.leaves_adjusted.map((l) => (
                              <tr key={l.leave_id}>
                                <td className="px-3 py-2 text-gray-700 dark:text-gray-300 tabular-nums">#{l.leave_id}</td>
                                <td className="px-3 py-2 text-gray-600 dark:text-gray-400 tabular-nums">{l.user_id}</td>
                                <td className="px-3 py-2 text-right tabular-nums">
                                  <span className="text-gray-400 dark:text-gray-500 line-through">{fmtDays(l.days_before)}</span>
                                  <span className="mx-1.5 text-gray-400 dark:text-gray-500">→</span>
                                  <span className="font-semibold text-emerald-700 dark:text-emerald-300">{fmtDays(l.days_after)}</span>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>

                  <button onClick={() => setCancelModal(null)} className="w-full h-10 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-semibold transition shadow-sm cursor-pointer">
                    เสร็จสิ้น
                  </button>
                </>
              )}
            </div>
          </div>
        </Portal>
      )}

      {/* คัดลอกปฏิทินจากปีก่อน */}
      {copyModal && (
        <Portal>
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
            <div className="w-full max-w-md rounded-2xl bg-white dark:bg-gray-800 shadow-2xl p-6 space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-bold text-gray-900 dark:text-gray-100">คัดลอกปฏิทินวันหยุด</h3>
                <button onClick={() => setCopyModal(false)} aria-label="ปิด" className="rounded-lg p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600 dark:hover:bg-gray-700 dark:hover:text-gray-200 transition-colors duration-200 cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500">
                  <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="size-5">
                    <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
                  </svg>
                </button>
              </div>

              <p className="text-sm text-gray-500 dark:text-gray-400 leading-relaxed">
                ตั้งต้นปฏิทินของปีใหม่จากปีก่อน แล้วค่อยแก้รายวัน วันที่ที่มีอยู่แล้วในปีปลายทางจะถูกข้าม ไม่ถูกเขียนทับ
              </p>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-medium text-gray-600 dark:text-gray-400 block mb-1">จากปีงบประมาณ</label>
                  <input type="number" min={2560} max={2599} value={copyForm.from_fiscal_year}
                    onChange={(e) => setCopyForm((f) => ({ ...f, from_fiscal_year: e.target.value }))}
                    className={`${inputCls} tabular-nums`} />
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-600 dark:text-gray-400 block mb-1">ไปยังปีงบประมาณ</label>
                  <input type="number" min={2560} max={2599} value={copyForm.to_fiscal_year}
                    onChange={(e) => setCopyForm((f) => ({ ...f, to_fiscal_year: e.target.value }))}
                    className={`${inputCls} tabular-nums`} />
                </div>
              </div>

              {copyResult && (
                <div className="rounded-xl bg-gray-50 dark:bg-gray-900/40 px-4 py-3 grid grid-cols-2 gap-3 text-center">
                  <div>
                    <p className="text-2xl font-bold text-emerald-600 dark:text-emerald-400 tabular-nums">{copyResult.created ?? 0}</p>
                    <p className="text-xs text-gray-500 dark:text-gray-400">วันที่คัดลอกมา</p>
                  </div>
                  <div>
                    <p className="text-2xl font-bold text-gray-500 dark:text-gray-400 tabular-nums">{copyResult.skipped ?? 0}</p>
                    <p className="text-xs text-gray-500 dark:text-gray-400">ข้าม (มีอยู่แล้ว)</p>
                  </div>
                </div>
              )}

              {copyMsg && (
                <p role="status" className={`text-sm text-center ${copyMsg.ok ? "text-emerald-600 dark:text-emerald-400" : "text-red-600 dark:text-red-400"}`}>
                  {copyMsg.text}
                </p>
              )}

              <div className="flex gap-3">
                <button onClick={() => setCopyModal(false)} className="flex-1 h-10 rounded-xl border border-gray-300 dark:border-gray-600 text-sm font-semibold text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700 transition cursor-pointer">
                  {copyResult ? "ปิด" : "ยกเลิก"}
                </button>
                <button onClick={handleCopy} disabled={copying}
                  className="flex-1 h-10 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-semibold transition shadow-sm disabled:opacity-60 cursor-pointer">
                  {copying ? "กำลังคัดลอก..." : "คัดลอก"}
                </button>
              </div>
            </div>
          </div>
        </Portal>
      )}
    </div>
  )
}
