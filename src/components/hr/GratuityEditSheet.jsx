// src/components/hr/GratuityEditSheet.jsx
// ─────────────────────────────────────────────────────────────────────────────
// แก้ไขรายการบำเหน็จหนึ่งแถว (HR · gratuity.record) — PATCH /hr/gratuity/{id}
//   ส่งเฉพาะช่องที่เปลี่ยน: last_salary (≥0) · years_counted (จำนวนเต็ม ≥0) · funding · status · note
//   backend คำนวณ amount ใหม่เอง และตั้ง source = "manual" (คำนวณรอบหน้าจะคงค่านี้ไว้)
// ─────────────────────────────────────────────────────────────────────────────
import { useEffect, useId, useMemo, useState } from "react"
import { FUNDING_OPTIONS, STATUS_OPTIONS, patchGratuity, toNum } from "../../lib/gratuity"
import { money } from "../../lib/loans"
import { apiErrorText } from "../../lib/apiErrors"
import { cx, baseField, errorTextCls, fieldErrorCls, helpTextCls, labelCls, neutralBtnCls } from "../../lib/styles"
import { SaveButton, SHEET_SAVED_MS, Sheet, toast, useSaveStatus } from "../ui"
import SelectDropdown from "../SelectDropdown"
import StatusMsg from "./StatusMsg"

const inputCls = cx(baseField, "!rounded-lg !px-3 !py-2 md:!text-sm")
const btnCls = "h-12 md:pointer-fine:h-10 md:!px-5 md:!py-0 md:!text-sm"
const NO_FUNDING = "__none"

const initForm = (row) => ({
  last_salary: row?.last_salary != null ? String(toNum(row.last_salary) ?? "") : "",
  years_counted: row?.years_counted != null ? String(row.years_counted) : "",
  funding: row?.funding ?? NO_FUNDING,
  status: row?.status ?? "active",
  note: row?.note ?? "",
})

function validate(f) {
  const e = {}
  const s = f.last_salary.trim()
  if (s === "") e.last_salary = "กรอกเงินเดือนเดือนสุดท้าย"
  else if (!/^\d+(\.\d{1,2})?$/.test(s.replace(/,/g, ""))) e.last_salary = "กรอกเป็นตัวเลข 0 ขึ้นไป ทศนิยมไม่เกิน 2 ตำแหน่ง"
  const y = f.years_counted.trim()
  if (y === "") e.years_counted = "กรอกจำนวนปีที่นับ"
  else if (!/^\d+$/.test(y)) e.years_counted = "กรอกเป็นจำนวนเต็ม 0 ขึ้นไป"
  return e
}

/** @param {{ open: boolean, row: object|null, onClose: () => void, onSaved?: (updated: object) => void }} props */
export default function GratuityEditSheet({ open, row, onClose, onSaved }) {
  const uid = useId()
  const [form, setForm] = useState(() => initForm(row))
  const [touched, setTouched] = useState(false)
  const [msg, setMsg] = useState(null)
  const saveState = useSaveStatus()
  const saving = saveState.saving

  useEffect(() => {
    if (!open) return
    setForm(initForm(row))
    setTouched(false)
    setMsg(null)
    // eslint-disable-next-line react-hooks/exhaustive-deps -- เติมค่าเฉพาะตอนเปิด
  }, [open, row?.id])

  const errors = useMemo(() => validate(form), [form])
  const showErr = (k) => touched && errors[k]
  const set = (k) => (v) => setForm((f) => ({ ...f, [k]: v }))

  const salaryNum = toNum(form.last_salary.replace(/,/g, ""))
  const yearsNum = /^\d+$/.test(form.years_counted.trim()) ? Number(form.years_counted) : null
  const previewAmount = salaryNum != null && yearsNum != null ? salaryNum * yearsNum : null

  const save = async () => {
    setTouched(true)
    setMsg(null)
    if (Object.keys(errors).length) return
    const base = initForm(row)
    const body = {}
    if (form.last_salary.replace(/,/g, "") !== base.last_salary) body.last_salary = form.last_salary.replace(/,/g, "").trim()
    if (form.years_counted.trim() !== base.years_counted) body.years_counted = Number(form.years_counted)
    if (form.funding !== base.funding) body.funding = form.funding === NO_FUNDING ? null : form.funding
    if (form.status !== base.status) body.status = form.status
    if (form.note.trim() !== (base.note ?? "").trim()) body.note = form.note.trim() || null
    if (Object.keys(body).length === 0) { onClose(); return }

    saveState.start()
    try {
      const updated = await patchGratuity(row.id, body)
      toast.success("บันทึกรายการบำเหน็จแล้ว", { description: row?.name || undefined })
      saveState.succeed(() => { onSaved?.(updated); onClose() }, SHEET_SAVED_MS)
    } catch (err) {
      saveState.fail()
      setMsg({ tone: "error", text: apiErrorText(err) })
    }
  }

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title="แก้ไขรายการบำเหน็จ"
      subtitle={row ? `${row.name ?? "—"} · ปีบัญชี ${row.fiscal_year}` : undefined}
      size="sm"
      busy={saving}
      footer={
        <div className="grid grid-cols-2 gap-3 md:flex md:justify-end md:gap-2">
          <button type="button" onClick={onClose} disabled={saving} className={cx(neutralBtnCls, btnCls)}>ยกเลิก</button>
          <SaveButton status={saveState.status} onClick={save} className={cx(btnCls, "!rounded-xl")}>บันทึก</SaveButton>
        </div>
      }
    >
      <form className="space-y-4" onSubmit={(e) => { e.preventDefault(); save() }} noValidate>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="min-w-0">
            <label htmlFor={`${uid}-sal`} className={cx(labelCls, "md:!text-sm")}>เงินเดือนเดือนสุดท้าย (บาท)</label>
            <input
              id={`${uid}-sal`} type="text" inputMode="decimal" autoComplete="off"
              value={form.last_salary} onChange={(e) => set("last_salary")(e.target.value)}
              aria-invalid={showErr("last_salary") ? true : undefined}
              aria-describedby={showErr("last_salary") ? `${uid}-sal-err` : undefined}
              className={cx(inputCls, "tabular-nums text-right", showErr("last_salary") && fieldErrorCls)}
            />
            {showErr("last_salary") && <p id={`${uid}-sal-err`} className={errorTextCls}>{errors.last_salary}</p>}
          </div>
          <div className="min-w-0">
            <label htmlFor={`${uid}-yrs`} className={cx(labelCls, "md:!text-sm")}>จำนวนปีที่นับ</label>
            <input
              id={`${uid}-yrs`} type="text" inputMode="numeric" autoComplete="off"
              value={form.years_counted} onChange={(e) => set("years_counted")(e.target.value)}
              aria-invalid={showErr("years_counted") ? true : undefined}
              aria-describedby={showErr("years_counted") ? `${uid}-yrs-err` : undefined}
              className={cx(inputCls, "tabular-nums text-right", showErr("years_counted") && fieldErrorCls)}
            />
            {showErr("years_counted") && <p id={`${uid}-yrs-err`} className={errorTextCls}>{errors.years_counted}</p>}
          </div>
        </div>

        <p className="flex items-baseline justify-between gap-3 rounded-xl bg-gray-50 px-4 py-2.5 text-sm ring-1 ring-inset ring-gray-200/70 dark:bg-white/[.03] dark:ring-line" aria-live="polite">
          <span className="text-gray-600 dark:text-gray-400">บำเหน็จหลังแก้ไข</span>
          <span className="font-semibold tabular-nums text-gray-900 dark:text-gray-100">{previewAmount == null ? "—" : `${money(previewAmount)} บาท`}</span>
        </p>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="min-w-0">
            <span id={`${uid}-fund-l`} className={cx(labelCls, "md:!text-sm")}>แหล่งเงิน</span>
            <SelectDropdown
              id={`${uid}-fund`} size="sm" showSwatch={false} ariaLabelledby={`${uid}-fund-l`}
              options={[
                { value: NO_FUNDING, label: "ไม่ระบุ" },
                ...FUNDING_OPTIONS,
                // ค่าที่นำเข้ามาแต่ไม่อยู่ในรายการ — แสดงไว้ให้คงค่าเดิมได้
                ...(row?.funding && !FUNDING_OPTIONS.some((o) => o.value === row.funding) ? [{ value: row.funding, label: row.funding }] : []),
              ]}
              value={form.funding} onChange={set("funding")}
            />
          </div>
          <div className="min-w-0">
            <span id={`${uid}-st-l`} className={cx(labelCls, "md:!text-sm")}>สถานะ</span>
            <SelectDropdown
              id={`${uid}-st`} size="sm" showSwatch={false} ariaLabelledby={`${uid}-st-l`}
              options={STATUS_OPTIONS} value={form.status} onChange={set("status")}
            />
          </div>
        </div>

        <div>
          <label htmlFor={`${uid}-note`} className={cx(labelCls, "md:!text-sm")}>หมายเหตุ</label>
          <textarea
            id={`${uid}-note`} rows={2} value={form.note} onChange={(e) => set("note")(e.target.value)}
            aria-describedby={`${uid}-note-hint`}
            className={cx(inputCls, "resize-y leading-relaxed")}
          />
          <p id={`${uid}-note-hint`} className={cx(helpTextCls, "md:text-xs")}>
            ไม่บังคับ — รายการที่แก้ไขแล้วจะคงค่าไว้เมื่อคำนวณบำเหน็จรอบถัดไป (เว้นแต่เลือกคำนวณทับ)
          </p>
        </div>

        {msg && <StatusMsg msg={msg} />}
        <button type="submit" hidden aria-hidden="true" tabIndex={-1} />
      </form>
    </Sheet>
  )
}
