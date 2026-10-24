// src/components/hr/welfare/DependantSheet.jsx
// ─────────────────────────────────────────────────────────────────────────────
// เพิ่ม / แก้ไขผู้มีสิทธิ์รับสวัสดิการ (บิดา มารดา คู่สมรส บุตร) — 3P B2
//   POST  /hr/employees/{id}/dependants   (201 → แถวใหม่)
//   PATCH /hr/dependants/{id}             (ส่งเฉพาะช่องที่เปลี่ยน)
//
// กฎ 1–3 คน / อายุ / แฝด backend คำนวณเอง — ฟอร์มนี้แค่เก็บข้อมูลที่กฎต้องใช้ให้ครบ
// (บุตร: ลำดับการเกิด + วันเกิด เสมอ · แฝดต้องติ๊กทั้งสองคน)
// ─────────────────────────────────────────────────────────────────────────────
import { useEffect, useId, useState } from "react"
import { apiAuth } from "../../../lib/api"
import { apiDetail } from "../../../lib/apiErrors"
import { cx, baseField, errorTextCls, helpTextCls, labelCls, neutralBtnCls, submitBtnCls } from "../../../lib/styles"
import { RELATIONSHIP_OPTIONS, dependantName } from "../../../lib/welfare"
import { Sheet, toast } from "../../ui"
import SelectDropdown from "../../SelectDropdown"
import ThaiDateField from "../../ThaiDateField"
import StatusMsg from "../StatusMsg"

const inputCls = cx(baseField, "!rounded-lg !px-3 !py-2 md:!text-sm")
const btnCls = "h-12 md:h-10 md:!px-5 md:!py-0 md:!text-sm"
const errBorder = "!border-red-500 dark:!border-red-400"

const EMPTY = {
  first_name: "", last_name: "", relationship: "", birthday: "", child_order: "",
  is_twin: false, is_adopted: false, is_incapacitated: false, deceased_date: "", has_own_benefits: false, note: "",
}

const fromRow = (d) => (d ? {
  first_name: d.first_name ?? "", last_name: d.last_name ?? "", relationship: d.relationship ?? "",
  birthday: d.birthday ?? "", child_order: d.child_order != null ? String(d.child_order) : "",
  is_twin: !!d.is_twin, is_adopted: !!d.is_adopted, is_incapacitated: !!d.is_incapacitated,
  deceased_date: d.deceased_date ?? "", has_own_benefits: !!d.has_own_benefits, note: d.note ?? "",
} : EMPTY)

function toBody(f) {
  const child = f.relationship === "บุตร"
  return {
    first_name: f.first_name.trim(),
    last_name: f.last_name.trim() || null,
    relationship: f.relationship,
    birthday: f.birthday || null,
    child_order: child && f.child_order !== "" ? parseInt(f.child_order, 10) : null,
    is_twin: child ? f.is_twin : false,
    is_adopted: child ? f.is_adopted : false,
    is_incapacitated: child ? f.is_incapacitated : false,
    deceased_date: f.deceased_date || null,
    has_own_benefits: child ? false : f.has_own_benefits,
    note: f.note.trim() || null,
  }
}

function validate(f) {
  const e = {}
  if (!f.first_name.trim()) e.first_name = "กรอกชื่อ"
  if (!f.relationship) e.relationship = "เลือกความสัมพันธ์"
  if (f.relationship === "บุตร") {
    if (f.child_order === "") e.child_order = "กรอกลำดับการเกิด — ใช้นับสิทธิ์บุตรคนที่ 1–3"
    else if (!Number.isInteger(Number(f.child_order)) || Number(f.child_order) < 1) e.child_order = "กรอกเป็นจำนวนเต็มตั้งแต่ 1"
    if (!f.birthday) e.birthday = "กรอกวันเกิด — ใช้ตรวจอายุตามระเบียบ"
  }
  if (f.deceased_date && f.birthday && f.deceased_date < f.birthday) e.deceased_date = "วันที่เสียชีวิตต้องไม่ก่อนวันเกิด"
  return e
}

function Check({ id, checked, onChange, label, hint, disabled }) {
  return (
    <div className="flex items-start gap-3">
      <input
        id={id} type="checkbox" checked={checked} disabled={disabled}
        onChange={(e) => onChange(e.target.checked)}
        aria-describedby={hint ? `${id}-hint` : undefined}
        className="mt-0.5 size-5 shrink-0 cursor-pointer rounded accent-indigo-600 md:size-4"
      />
      <label htmlFor={id} className="cursor-pointer text-sm text-gray-800 dark:text-gray-200">
        {label}
        {hint && <span id={`${id}-hint`} className="block text-xs text-gray-500 dark:text-gray-400">{hint}</span>}
      </label>
    </div>
  )
}

/**
 * @param {{ open: boolean, employeeId: number|string, employeeName?: string, dependant?: object|null,
 *           onClose: () => void, onSaved?: (row: object) => void }} props
 *   dependant = null → เพิ่มใหม่
 */
export default function DependantSheet({ open, employeeId, employeeName, dependant, onClose, onSaved }) {
  const uid = useId()
  const editing = !!dependant?.id
  const [form, setForm] = useState(() => fromRow(dependant))
  const [errors, setErrors] = useState({})
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState(null)

  useEffect(() => {
    if (!open) return
    setForm(fromRow(dependant))
    setErrors({})
    setMsg(null)
  }, [open, dependant])

  const set = (k) => (v) => {
    setForm((p) => ({ ...p, [k]: v }))
    if (errors[k]) setErrors((e) => ({ ...e, [k]: undefined }))
  }

  const save = async () => {
    const errs = validate(form)
    setErrors(errs)
    if (Object.keys(errs).length) {
      setMsg({ tone: "warning", text: "ตรวจช่องที่มีข้อความสีแดงก่อนบันทึก" })
      return
    }
    const body = toBody(form)
    let payload = body
    if (editing) {
      const before = toBody(fromRow(dependant))
      payload = Object.fromEntries(Object.entries(body).filter(([k, v]) => before[k] !== v))
      if (!Object.keys(payload).length) { onClose(); return }
    }
    setSaving(true)
    setMsg(null)
    try {
      const row = editing
        ? await apiAuth(`/hr/dependants/${dependant.id}`, { method: "PATCH", body: payload })
        : await apiAuth(`/hr/employees/${encodeURIComponent(employeeId)}/dependants`, { method: "POST", body: payload })
      toast.success(editing ? "บันทึกการแก้ไขแล้ว" : "เพิ่มผู้มีสิทธิ์แล้ว", { description: dependantName(row) || undefined })
      onSaved?.(row)
      onClose()
    } catch (err) {
      setMsg({ tone: "error", text: apiDetail(err) || "บันทึกไม่สำเร็จ" })
    } finally {
      setSaving(false)
    }
  }

  const id = (k) => `${uid}-${k}`
  const err = (k) => errors[k] && <p id={`${id(k)}-err`} className={errorTextCls}>{errors[k]}</p>
  const desc = (k, hint) => [hint ? `${id(k)}-hint` : null, errors[k] ? `${id(k)}-err` : null].filter(Boolean).join(" ") || undefined
  const child = form.relationship === "บุตร"

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title={editing ? "แก้ไขผู้มีสิทธิ์" : "เพิ่มผู้มีสิทธิ์รับสวัสดิการ"}
      subtitle={employeeName ? `ครอบครัวของ ${employeeName}` : undefined}
      size="md"
      busy={saving}
      footer={
        <div className="grid grid-cols-2 gap-3 md:flex md:justify-end md:gap-2">
          <button type="button" onClick={onClose} disabled={saving} className={cx(neutralBtnCls, btnCls)}>ยกเลิก</button>
          <button type="button" onClick={save} disabled={saving} className={cx(submitBtnCls, btnCls, "!rounded-xl")}>
            {saving ? "กำลังบันทึก…" : editing ? "บันทึก" : "เพิ่ม"}
          </button>
        </div>
      }
    >
      <form className="space-y-4" onSubmit={(e) => { e.preventDefault(); save() }} noValidate>
        <div>
          <span id={`${id("rel")}-label`} className={cx(labelCls, "md:!text-sm")}>ความสัมพันธ์ <span className="text-red-600 dark:text-red-400" aria-hidden="true">*</span></span>
          <SelectDropdown
            id={id("rel")} size="sm" required showSwatch={false}
            ariaLabelledby={`${id("rel")}-label`} ariaDescribedby={desc("relationship")}
            options={RELATIONSHIP_OPTIONS} value={form.relationship} onChange={set("relationship")}
            placeholder="เลือกความสัมพันธ์" error={!!errors.relationship}
          />
          {err("relationship")}
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label htmlFor={id("fn")} className={cx(labelCls, "md:!text-sm")}>ชื่อ <span className="text-red-600 dark:text-red-400" aria-hidden="true">*</span></label>
            <input id={id("fn")} value={form.first_name} onChange={(e) => set("first_name")(e.target.value)} autoComplete="off"
              required aria-invalid={errors.first_name ? true : undefined} aria-describedby={desc("first_name")}
              placeholder="เช่น ด.ช.สมชาย" className={cx(inputCls, errors.first_name && errBorder)} />
            {errors.first_name && <p id={`${id("first_name")}-err`} className={errorTextCls}>{errors.first_name}</p>}
          </div>
          <div>
            <label htmlFor={id("ln")} className={cx(labelCls, "md:!text-sm")}>นามสกุล</label>
            <input id={id("ln")} value={form.last_name} onChange={(e) => set("last_name")(e.target.value)} autoComplete="off" className={inputCls} />
          </div>
        </div>

        <div className={cx("grid gap-4", child && "sm:grid-cols-2")}>
          <div>
            <label htmlFor={id("bd")} className={cx(labelCls, "md:!text-sm")}>
              วันเกิด {child && <span className="text-red-600 dark:text-red-400" aria-hidden="true">*</span>}
            </label>
            <ThaiDateField id={id("bd")} value={form.birthday} onChange={(e) => set("birthday")(e.target.value)}
              error={!!errors.birthday} aria-describedby={desc("birthday")} className="!rounded-lg !px-3 !py-2 md:!text-sm" />
            {err("birthday")}
          </div>
          {child && (
            <div>
              <label htmlFor={id("co")} className={cx(labelCls, "md:!text-sm")}>บุตรคนที่ (ลำดับการเกิด) <span className="text-red-600 dark:text-red-400" aria-hidden="true">*</span></label>
              <input id={id("co")} type="number" inputMode="numeric" min="1" step="1" value={form.child_order}
                onChange={(e) => set("child_order")(e.target.value)}
                aria-invalid={errors.child_order ? true : undefined} aria-describedby={desc("child_order", true)}
                className={cx(inputCls, "tabular-nums", errors.child_order && errBorder)} />
              <p id={`${id("child_order")}-hint`} className={cx(helpTextCls, "md:text-xs")}>นับรวมบุตรที่เสียชีวิตแล้วด้วย</p>
              {err("child_order")}
            </div>
          )}
        </div>

        {child ? (
          <fieldset className="space-y-3 rounded-xl bg-gray-50 p-3 dark:bg-white/[.03]">
            <legend className="sr-only">สถานะของบุตร</legend>
            <Check id={id("twin")} checked={form.is_twin} onChange={set("is_twin")} label="เป็นแฝด" hint="ติ๊กให้ครบทุกคนในคู่แฝด (วันเกิดเดียวกัน)" />
            <Check id={id("adopt")} checked={form.is_adopted} onChange={set("is_adopted")} label="บุตรบุญธรรม" hint="บุตรบุญธรรมไม่นับเป็นผู้มีสิทธิ์ตามระเบียบ" />
            <Check id={id("incap")} checked={form.is_incapacitated} onChange={set("is_incapacitated")} label="ทุพพลภาพ / ไร้ความสามารถ" hint="เบิกค่ารักษาได้แม้อายุเกิน 20 ปี" />
          </fieldset>
        ) : form.relationship ? (
          <div className="rounded-xl bg-gray-50 p-3 dark:bg-white/[.03]">
            <Check id={id("own")} checked={form.has_own_benefits} onChange={set("has_own_benefits")} label="มีสิทธิ์รักษาพยาบาลของตนเอง"
              hint="เช่น ข้าราชการ รัฐวิสาหกิจ หรือหน่วยงานอื่น — จะไม่มีสิทธิ์เบิกจากสหกรณ์" />
          </div>
        ) : null}

        <div>
          <label htmlFor={id("dd")} className={cx(labelCls, "md:!text-sm")}>วันที่เสียชีวิต</label>
          <ThaiDateField id={id("dd")} value={form.deceased_date} onChange={(e) => set("deceased_date")(e.target.value)}
            error={!!errors.deceased_date} aria-describedby={desc("deceased_date", true)} placeholder="เว้นว่างถ้ายังมีชีวิตอยู่"
            className="!rounded-lg !px-3 !py-2 md:!text-sm" />
          <p id={`${id("deceased_date")}-hint`} className={cx(helpTextCls, "md:text-xs")}>
            {child ? "บุตรที่เสียชีวิตก่อนอายุ 20 ปี จะเปิดสิทธิ์ให้บุตรคนถัดไป" : "เว้นว่างถ้ายังมีชีวิตอยู่"}
          </p>
          {err("deceased_date")}
        </div>

        <div>
          <label htmlFor={id("note")} className={cx(labelCls, "md:!text-sm")}>หมายเหตุ</label>
          <textarea id={id("note")} rows={2} value={form.note} onChange={(e) => set("note")(e.target.value)} className={cx(inputCls, "resize-y")} />
        </div>

        {msg && <StatusMsg msg={msg} />}
        <button type="submit" hidden aria-hidden="true" tabIndex={-1} />
      </form>
    </Sheet>
  )
}
