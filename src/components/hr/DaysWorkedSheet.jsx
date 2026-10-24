// src/components/hr/DaysWorkedSheet.jsx
// ─────────────────────────────────────────────────────────────────────────────
// บันทึกจำนวนวันทำงานของลูกจ้างรายวัน (งวด 3 · 3C daily-paid) — ทำก่อนสร้างเงินเดือนของเดือน
//   GET /hr/payroll/days-worked/{y}/{m}   [{ employee_id, employee_name, branch_name, days|null }]  (payroll.view | payroll.generate)
//   PUT /hr/payroll/days-worked/{y}/{m}   { entries: [{ employee_id, days }] } → ตอบรายการเดียวกับ GET  (payroll.generate)
//     days 0–31 ทีละครึ่งวัน (อื่น ๆ 422) · 422 ถ้าไม่ใช่ลูกจ้างรายวันที่ยังทำงาน · 409 ถ้างวดไม่ใช่ร่าง
//   ปี ค.ศ. · ค่าจ้าง = ค่าจ้างรายวัน (settings.daily_wage) × จำนวนวัน
//   เปลี่ยนจำนวนวันหลังสร้างเงินเดือนแล้ว → ต้องกด "คำนวณใหม่" ในงวดร่าง
//   backend ที่ยังไม่ migrate (section21C2_payroll_daily) ตอบ 404 → แจ้งว่ายังไม่เปิดใช้
// ─────────────────────────────────────────────────────────────────────────────
import { useEffect, useId, useMemo, useRef, useState } from "react"
import { Info } from "lucide-react"
import { apiAuth } from "../../lib/api"
import { fmtPayMonth, fmtWorkDays, money, validWorkDays } from "../../lib/payroll"
import { cx, baseField, neutralBtnCls, submitBtnCls } from "../../lib/styles"
import { EmptyState, ErrorState, Sheet, SkeletonTableRows, toast } from "../ui"
import StatusMsg from "./StatusMsg"

const btnCls = "h-12 md:h-10"
const dayInputCls = cx(baseField, "!w-24 !rounded-lg !px-2.5 !py-1.5 md:!text-sm text-right tabular-nums")
const COLS = 3

const rowsOf = (d) => (Array.isArray(d) ? d : Array.isArray(d?.items) ? d.items : [])
const toStr = (v) => (v == null ? "" : fmtWorkDays(v))
const savedOf = (r) => toStr(r.days)

/**
 * @param {{ open: boolean, ym: { year: number, month: number }, canEdit: boolean, isDraft: boolean,
 *           dailyWage?: number|null, hasPayouts?: boolean, onClose: () => void, onSaved?: (rows: object[]) => void }} props
 */
export default function DaysWorkedSheet({ open, ym, canEdit, isDraft, dailyWage = null, hasPayouts = false, onClose, onSaved }) {
  const uid = useId()
  const [rows, setRows] = useState([])
  const [form, setForm] = useState({})
  const [loading, setLoading] = useState(false)
  const [loadError, setLoadError] = useState("")
  const [unsupported, setUnsupported] = useState(false)
  const [errors, setErrors] = useState({})
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState(null)
  const [fillValue, setFillValue] = useState("")
  const inputs = useRef([])

  const label = fmtPayMonth(ym.year, ym.month, { long: true })
  const editable = canEdit && isDraft

  const applyRows = (list) => {
    setRows(list)
    setForm(Object.fromEntries(list.map((r) => [r.employee_id, toStr(r.days)])))
    setErrors({})
  }

  const load = () => {
    setLoading(true)
    setLoadError("")
    setUnsupported(false)
    apiAuth(`/hr/payroll/days-worked/${ym.year}/${ym.month}`)
      .then((d) => applyRows(rowsOf(d)))
      .catch((e) => {
        applyRows([])
        if (e.status === 404) setUnsupported(true)
        else setLoadError(e.message || "โหลดรายชื่อลูกจ้างรายวันไม่สำเร็จ")
      })
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    if (!open) return
    setMsg(null)
    setFillValue("")
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps -- โหลดใหม่เมื่อเปิด / เปลี่ยนเดือน
  }, [open, ym.year, ym.month])

  const changed = useMemo(
    () => rows.filter((r) => (form[r.employee_id] ?? "").trim() !== savedOf(r)),
    [rows, form],
  )
  const enteredCount = rows.filter((r) => (form[r.employee_id] ?? "").trim() !== "").length
  const missingCount = rows.length - enteredCount

  const setDays = (id, v) => {
    setForm((p) => ({ ...p, [id]: v }))
    setMsg(null)
    if (errors[id]) setErrors((e) => ({ ...e, [id]: undefined }))
  }

  const fillEmpty = () => {
    const v = fillValue.trim()
    if (!validWorkDays(v) || v === "") { setMsg({ tone: "warning", text: "จำนวนวันต้องอยู่ระหว่าง 0–31 และลงท้ายด้วย .0 หรือ .5" }); return }
    setForm((p) => {
      const next = { ...p }
      for (const r of rows) if ((next[r.employee_id] ?? "").trim() === "") next[r.employee_id] = fmtWorkDays(v)
      return next
    })
    setMsg(null)
  }

  // Enter / ลูกศรขึ้น-ลง = ไปช่องถัดไป (กรอกต่อเนื่องได้โดยไม่ต้องใช้เมาส์)
  const onKeyDown = (i) => (e) => {
    const step = e.key === "Enter" || e.key === "ArrowDown" ? 1 : e.key === "ArrowUp" ? -1 : 0
    if (!step) return
    e.preventDefault()
    const next = inputs.current[i + step]
    if (next) { next.focus(); next.select() }
  }

  const save = async () => {
    const errs = {}
    const entries = []
    for (const r of changed) {
      const v = (form[r.employee_id] ?? "").trim()
      if (v === "") errs[r.employee_id] = "ล้างค่าไม่ได้ — ใส่ 0 ถ้าไม่ได้ทำงาน"
      else if (!validWorkDays(v)) errs[r.employee_id] = "0–31 วัน ทีละครึ่งวัน"
      else entries.push({ employee_id: r.employee_id, days: Number(v) })
    }
    setErrors(errs)
    if (Object.keys(errs).length) {
      setMsg({ tone: "warning", text: "ตรวจช่องที่มีข้อความสีแดงก่อนบันทึก" })
      const first = rows.findIndex((r) => errs[r.employee_id])
      inputs.current[first]?.focus()
      return
    }
    if (entries.length === 0) return
    setSaving(true)
    setMsg(null)
    try {
      const res = await apiAuth(`/hr/payroll/days-worked/${ym.year}/${ym.month}`, { method: "PUT", body: { entries } })
      const list = rowsOf(res)
      if (list.length) applyRows(list)
      else load()
      toast.success(`บันทึกจำนวนวันทำงาน ${entries.length} คนแล้ว`, {
        description: hasPayouts ? `สร้างเงินเดือน ${label} ไปแล้ว — กด "คำนวณใหม่" เพื่อใช้จำนวนวันใหม่` : label,
      })
      onSaved?.(list)
    } catch (err) {
      setMsg({
        tone: "error",
        text: err.status === 409 ? err.message || `งวด ${label} ไม่ใช่ร่างแล้ว แก้จำนวนวันไม่ได้` : err.message || "บันทึกไม่สำเร็จ",
      })
    } finally {
      setSaving(false)
    }
  }

  const footer = editable && rows.length > 0 ? (
    <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
      <p className="text-sm text-gray-600 dark:text-gray-400" aria-live="polite">
        {changed.length ? `แก้ไข ${changed.length} คน ยังไม่บันทึก` : "ยังไม่มีการแก้ไข"}
      </p>
      <div className="grid grid-cols-2 gap-3 md:flex md:gap-2">
        <button type="button" onClick={onClose} disabled={saving} className={cx(neutralBtnCls, btnCls)}>ปิด</button>
        <button type="button" onClick={save} disabled={saving || changed.length === 0} className={cx(submitBtnCls, btnCls, "!rounded-xl !px-4 !py-0 md:!text-sm")}>
          {saving ? "กำลังบันทึก…" : "บันทึกจำนวนวัน"}
        </button>
      </div>
    </div>
  ) : (
    <div className="flex justify-end">
      <button type="button" onClick={onClose} className={cx(neutralBtnCls, btnCls, "w-full md:w-auto")}>ปิด</button>
    </div>
  )

  let body
  if (unsupported) {
    body = (
      <EmptyState
        title="ยังไม่เปิดใช้การจ่ายแบบรายวัน"
        description="ระบบเบื้องหลังยังไม่รองรับการบันทึกวันทำงานของลูกจ้างรายวัน ติดต่อผู้ดูแลระบบ"
      />
    )
  } else if (loadError) {
    body = <ErrorState message={loadError} onRetry={load} />
  } else if (!loading && rows.length === 0) {
    body = (
      <EmptyState
        title="ยังไม่มีลูกจ้างรายวัน"
        description='ตั้ง "ประเภทการจ่าย" เป็นรายวันได้ที่ข้อมูลการเงินของเจ้าหน้าที่ แล้วกลับมาบันทึกจำนวนวันที่นี่'
      />
    )
  } else {
    body = (
      <div className="space-y-4">
        <p className="flex items-start gap-2 rounded-xl bg-indigo-50/70 px-4 py-3 text-sm text-indigo-950 ring-1 ring-inset ring-indigo-100 dark:bg-indigo-500/10 dark:text-indigo-100 dark:ring-indigo-400/20">
          <Info aria-hidden="true" className="mt-0.5 size-4 shrink-0" strokeWidth={1.75} />
          <span>
            จำนวนวัน = <b className="font-semibold">วันที่ได้รับค่าจ้าง</b> คือวันทำงานรวมวันลาที่ได้รับค่าจ้าง · ใส่ครึ่งวันได้ เช่น 20.5
            {dailyWage != null && <> · ค่าจ้างรายวัน <span className="tabular-nums">{money(dailyWage)}</span> บาท</>}
          </span>
        </p>

        {!isDraft && (
          <StatusMsg msg={{ tone: "warning", text: `งวด ${label} ไม่ใช่ร่างแล้ว — ดูได้อย่างเดียว` }} />
        )}

        {editable && missingCount > 0 && !loading && (
          <div className="flex flex-wrap items-end gap-2">
            <div>
              <label htmlFor={`${uid}-fill`} className="mb-1 block text-xs font-medium text-gray-600 dark:text-gray-400">
                ใส่จำนวนวันให้ {missingCount} คนที่ยังว่าง
              </label>
              <input
                id={`${uid}-fill`}
                type="number"
                inputMode="decimal"
                min="0"
                max="31"
                step="0.5"
                value={fillValue}
                onChange={(e) => setFillValue(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); fillEmpty() } }}
                placeholder="เช่น 26"
                className={dayInputCls}
              />
            </div>
            <button type="button" onClick={fillEmpty} className={cx(neutralBtnCls, "h-11 md:h-9")}>เติมช่องว่าง</button>
          </div>
        )}

        <div className="overflow-hidden rounded-xl ring-1 ring-gray-200/70 dark:ring-line">
          <table className="w-full text-sm">
            <caption className="sr-only">จำนวนวันทำงานของลูกจ้างรายวัน งวด {label}</caption>
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50 dark:border-line dark:bg-white/[.03]">
                <th scope="col" className="px-3 py-2.5 text-left text-xs font-semibold text-gray-600 dark:text-gray-400">ลูกจ้าง / สาขา</th>
                <th scope="col" className="w-28 px-3 py-2.5 text-right text-xs font-semibold text-gray-600 dark:text-gray-400">จำนวนวัน</th>
                <th scope="col" className="hidden w-32 px-3 py-2.5 text-right text-xs font-semibold text-gray-600 dark:text-gray-400 sm:table-cell">
                  ค่าจ้างโดยประมาณ
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-line">
              {loading ? (
                <SkeletonTableRows rows={4} cols={COLS} />
              ) : rows.map((r, i) => {
                const id = `${uid}-d${r.employee_id}`
                const v = form[r.employee_id] ?? ""
                const err = errors[r.employee_id]
                const isChanged = v.trim() !== savedOf(r)
                const estimate = dailyWage != null && v.trim() !== "" && validWorkDays(v) ? Number(v) * dailyWage : null
                return (
                  <tr key={r.employee_id} className={cx(isChanged && "bg-indigo-50/50 dark:bg-indigo-500/[.06]")}>
                    <td className="px-3 py-2 align-top">
                      <label htmlFor={id} className="block font-medium text-gray-900 dark:text-gray-100">{r.employee_name || `รหัส ${r.employee_id}`}</label>
                      <span className="block text-xs text-gray-500 dark:text-gray-400">
                        {r.branch_name || `รหัส ${r.employee_id}`}
                        {r.days == null && !isChanged && <span className="text-amber-700 dark:text-amber-300"> · ยังไม่บันทึก</span>}
                      </span>
                      {err && <span id={`${id}-err`} className="mt-1 block text-xs font-medium text-red-600 dark:text-red-400">{err}</span>}
                    </td>
                    <td className="px-3 py-2 text-right align-top">
                      {editable ? (
                        <input
                          ref={(el) => { inputs.current[i] = el }}
                          id={id}
                          type="number"
                          inputMode="decimal"
                          min="0"
                          max="31"
                          step="0.5"
                          value={v}
                          onChange={(e) => setDays(r.employee_id, e.target.value)}
                          onKeyDown={onKeyDown(i)}
                          onFocus={(e) => e.target.select()}
                          placeholder="—"
                          aria-invalid={err ? true : undefined}
                          aria-describedby={err ? `${id}-err` : undefined}
                          className={cx(dayInputCls, "ml-auto", err && "!border-red-500 dark:!border-red-400")}
                        />
                      ) : (
                        <span id={id} className="tabular-nums text-gray-900 dark:text-gray-100">{r.days == null ? "—" : `${fmtWorkDays(r.days)} วัน`}</span>
                      )}
                    </td>
                    <td className="hidden px-3 py-2 text-right align-top tabular-nums text-gray-700 dark:text-gray-300 sm:table-cell">
                      <span className="inline-block py-1.5">{estimate == null ? "—" : money(estimate)}</span>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>

        {!loading && rows.length > 0 && (
          <p className="text-xs text-gray-600 dark:text-gray-400">
            บันทึกแล้ว <span className="tabular-nums">{rows.length - rows.filter((r) => r.days == null).length}</span> จาก{" "}
            <span className="tabular-nums">{rows.length}</span> คน · ลูกจ้างที่ยังไม่มีจำนวนวันจะถูกข้ามตอนสร้างเงินเดือน
          </p>
        )}

        {msg && <StatusMsg msg={msg} />}
      </div>
    )
  }

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title="จำนวนวันทำงาน ลูกจ้างรายวัน"
      subtitle={`งวด ${label}`}
      size="lg"
      busy={saving}
      footer={footer}
    >
      <form noValidate onSubmit={(e) => { e.preventDefault(); if (editable) save() }}>
        {body}
        <button type="submit" hidden aria-hidden="true" tabIndex={-1} />
      </form>
    </Sheet>
  )
}
