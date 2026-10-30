// src/components/hr/ActivityEditSheet.jsx
// ─────────────────────────────────────────────────────────────────────────────
// เพิ่ม / แก้ไขกิจกรรมของพนักงาน (3G · PR 45) — HR เท่านั้น (hr.employee.activities.edit)
//   POST  /hr/employees/{id}/activities          activity_type*, title*, start_date* (+ field อื่น)
//   PATCH /hr/employees/{id}/activities/{aid}    field ใดก็ได้; attachment_ids = "เพิ่ม" ไฟล์
//   ใบประกาศใหม่: FileUploader → POST /files ทันทีที่เลือก → ids ส่งใน attachment_ids
//   ถอดใบประกาศเดิม: DELETE /files/{id} (ยืนยันก่อน) แล้วให้หน้าแม่โหลดรายการใหม่
//   end_date ต้องไม่ก่อน start_date — เช็คในฟอร์ม + แสดง 422 ของ backend ถ้ายังหลุด
//
// props: { open, employeeId, employeeName, activity (null = เพิ่มใหม่), onClose, onSaved(activity), onFilesChanged() }
// ─────────────────────────────────────────────────────────────────────────────
import { useEffect, useId, useRef, useState } from "react"
import { FileText, Image as ImageIcon, Trash2 } from "lucide-react"
import SelectDropdown from "../SelectDropdown"
import ThaiDateField from "../ThaiDateField"
import FileUploader from "../FileUploader"
import useFileUploads from "../../hooks/useFileUploads"
import { ConfirmDialog, SaveButton, SHEET_SAVED_MS, Sheet, revealFirstInvalid, toast, useSaveStatus } from "../ui"
import StatusMsg from "./StatusMsg"
import { ACTIVITY_TYPES, createActivity, updateActivity } from "../../lib/activities"
import { FILE_MAX_COUNT, deleteFile, formatBytes, isImageType } from "../../lib/files"
import { apiDetail } from "../../lib/apiErrors"
import { cx, baseField, errorTextCls, helpTextCls, iconBtnCls, labelCls, neutralBtnCls } from "../../lib/styles"

const inputCls = cx(baseField, "!rounded-lg !px-3 !py-2 md:!text-sm")
const dateCls = "!rounded-lg !px-3 !py-2 md:!text-sm"
const btnCls = "h-12 md:h-10 md:!px-5 md:!py-0 md:!text-sm"
const errBorder = "!border-red-500 dark:!border-red-400"
const Req = () => <span className="text-red-600 dark:text-red-400" aria-hidden="true"> *</span>

const TEXT_FIELDS = ["title", "organizer", "location", "detail", "result"]
const EMPTY = { activity_type: "training", title: "", start_date: "", end_date: "", hours: "", organizer: "", location: "", detail: "", result: "" }

const str = (v) => (v == null ? "" : String(v))
function formFrom(a) {
  if (!a) return { ...EMPTY }
  return Object.fromEntries(Object.keys(EMPTY).map((k) => [k, str(a[k]) || (k === "activity_type" ? EMPTY.activity_type : "")]))
}

function validate(f) {
  const e = {}
  if (!f.activity_type) e.activity_type = "เลือกประเภทกิจกรรม"
  if (!f.title.trim()) e.title = "กรอกชื่อกิจกรรม"
  if (!f.start_date) e.start_date = "เลือกวันที่เริ่ม"
  if (f.start_date && f.end_date && f.end_date < f.start_date) e.end_date = "วันที่สิ้นสุดต้องไม่ก่อนวันที่เริ่ม"
  if (f.hours !== "") {
    const n = Number(f.hours)
    if (!Number.isFinite(n) || n < 0) e.hours = "กรอกจำนวนชั่วโมงตั้งแต่ 0 ขึ้นไป"
  }
  return e
}

/** 422 แบบ [{loc: ["body","end_date"], msg}] → error รายช่อง */
function fieldErrorsFrom(err) {
  const d = err?.data?.detail
  if (!Array.isArray(d)) return {}
  const out = {}
  for (const x of d) {
    const key = Array.isArray(x?.loc) ? x.loc[x.loc.length - 1] : null
    if (key && key in EMPTY && x?.msg) out[key] = x.msg
  }
  return out
}

function ExistingFile({ file, onRemove, busy }) {
  const Icon = isImageType(file.content_type) ? ImageIcon : FileText
  return (
    <li className="flex items-center gap-3 py-2">
      <Icon aria-hidden="true" className="size-5 shrink-0 text-gray-400 dark:text-gray-500" />
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm text-gray-900 dark:text-gray-100">{file.filename}</span>
        <span className="block text-xs tabular-nums text-gray-500 dark:text-gray-400">{formatBytes(file.size_bytes)}</span>
      </span>
      <button type="button" onClick={() => onRemove(file)} disabled={busy} className={cx(iconBtnCls, "hover:!text-red-600 dark:hover:!text-red-400")}
        aria-label={`ถอดไฟล์ ${file.filename}`}>
        <Trash2 aria-hidden="true" className="size-4" />
      </button>
    </li>
  )
}

export default function ActivityEditSheet({ open, employeeId, employeeName, activity, onClose, onSaved, onFilesChanged }) {
  const uid = useId()
  const id = (k) => `${uid}-${k}`
  const isEdit = Boolean(activity?.id)
  const [form, setForm] = useState(() => formFrom(activity))
  const [errors, setErrors] = useState({})
  const [msg, setMsg] = useState(null)
  const saveState = useSaveStatus()
  const saving = saveState.saving
  const formRef = useRef(null)
  const [existing, setExisting] = useState(() => activity?.attachments ?? [])
  const [removeTarget, setRemoveTarget] = useState(null)
  const [removing, setRemoving] = useState(false)
  const [removeErr, setRemoveErr] = useState("")
  const uploads = useFileUploads({ maxFiles: Math.max(0, FILE_MAX_COUNT - existing.length) })

  // เปิดใหม่ / เปลี่ยนรายการ → เติมฟอร์มจากค่าล่าสุด
  useEffect(() => {
    if (!open) return
    setForm(formFrom(activity))
    setExisting(activity?.attachments ?? [])
    setErrors({})
    setMsg(null)
    // eslint-disable-next-line react-hooks/exhaustive-deps -- เติมค่าเฉพาะตอนเปิด / เปลี่ยนรายการ
  }, [open, activity?.id])

  const set = (key) => (value) => {
    setForm((p) => ({ ...p, [key]: value }))
    setErrors((e) => {
      if (!e[key] && !(key === "start_date" && e.end_date)) return e
      const next = { ...e, [key]: undefined }
      if (key === "start_date") next.end_date = undefined
      return next
    })
  }

  const close = () => {
    if (saving) return
    uploads.discard()
    onClose()
  }

  const buildBody = () => {
    const body = { activity_type: form.activity_type, start_date: form.start_date }
    for (const k of TEXT_FIELDS) {
      const v = form[k].trim()
      if (v) body[k] = v
      else if (isEdit && k !== "title") body[k] = null
    }
    if (form.end_date) body.end_date = form.end_date
    else if (isEdit) body.end_date = null
    if (form.hours !== "") body.hours = Number(form.hours)
    else if (isEdit) body.hours = null
    if (uploads.ids.length) body.attachment_ids = uploads.ids
    return body
  }

  const save = async () => {
    const errs = validate(form)
    setErrors(errs)
    if (Object.keys(errs).length) {
      setMsg({ tone: "warning", text: "ตรวจช่องที่มีข้อความสีแดงก่อนบันทึก" })
      revealFirstInvalid(formRef)
      return
    }
    if (uploads.busy) {
      setMsg({ tone: "warning", text: "รอให้อัปโหลดไฟล์เสร็จก่อนบันทึก" })
      return
    }
    saveState.start()
    setMsg(null)
    try {
      const body = buildBody()
      const saved = isEdit
        ? await updateActivity(employeeId, activity.id, body)
        : await createActivity(employeeId, body)
      uploads.reset()
      toast.success(isEdit ? "บันทึกการแก้ไขกิจกรรมแล้ว" : "เพิ่มกิจกรรมแล้ว", { description: form.title.trim() })
      saveState.succeed(() => { onSaved?.(saved); onClose() }, SHEET_SAVED_MS)
    } catch (err) {
      saveState.fail()
      const fe = fieldErrorsFrom(err)
      if (Object.keys(fe).length) {
        setErrors((e) => ({ ...e, ...fe }))
        revealFirstInvalid(formRef)
      }
      setMsg({ tone: "error", text: apiDetail(err) || "บันทึกไม่สำเร็จ ลองใหม่อีกครั้ง" })
    }
  }

  const confirmRemove = async () => {
    if (!removeTarget) return
    setRemoving(true)
    setRemoveErr("")
    try {
      await deleteFile(removeTarget.id)
      setExisting((list) => list.filter((f) => f.id !== removeTarget.id))
      toast.success("ถอดไฟล์แล้ว", { description: removeTarget.filename })
      setRemoveTarget(null)
      onFilesChanged?.()
    } catch (err) {
      setRemoveErr(apiDetail(err) || "ถอดไฟล์ไม่สำเร็จ")
    } finally {
      setRemoving(false)
    }
  }

  const errP = (k) => errors[k] ? <p id={id(`${k}-err`)} className={errorTextCls}>{errors[k]}</p> : null
  const describedBy = (k, hint) => [hint ? id(`${k}-hint`) : null, errors[k] ? id(`${k}-err`) : null].filter(Boolean).join(" ") || undefined

  const text = (k, label, { required, placeholder, autoComplete = "off" } = {}) => (
    <div>
      <label htmlFor={id(k)} className={cx(labelCls, "md:!text-sm")}>{label}{required && <Req />}</label>
      <input id={id(k)} value={form[k]} onChange={(e) => set(k)(e.target.value)} placeholder={placeholder}
        required={required} aria-required={required || undefined} autoComplete={autoComplete}
        aria-invalid={errors[k] ? true : undefined} aria-describedby={describedBy(k)}
        className={cx(inputCls, errors[k] && errBorder)} />
      {errP(k)}
    </div>
  )

  return (
    <>
      <Sheet
        open={open}
        onClose={close}
        title={isEdit ? "แก้ไขกิจกรรม" : "เพิ่มกิจกรรม"}
        subtitle={employeeName}
        size="lg"
        busy={saving}
        footer={
          <div className="grid grid-cols-2 gap-3 md:flex md:justify-end md:gap-2">
            <button type="button" onClick={close} disabled={saving} className={cx(neutralBtnCls, btnCls)}>ยกเลิก</button>
            <SaveButton status={saveState.status} onClick={save} disabled={uploads.busy} className={cx(btnCls, "!rounded-xl")}
              savedLabel={isEdit ? "บันทึกแล้ว" : "เพิ่มแล้ว"} reserve={["กำลังอัปโหลด…"]}>
              {uploads.busy ? "กำลังอัปโหลด…" : isEdit ? "บันทึกการแก้ไข" : "เพิ่มกิจกรรม"}
            </SaveButton>
          </div>
        }
      >
        <form ref={formRef} className="space-y-5" onSubmit={(e) => { e.preventDefault(); save() }} noValidate>
          <div className="grid gap-4 sm:grid-cols-[minmax(0,12rem)_minmax(0,1fr)]">
            <div>
              <span id={id("type-label")} className={cx(labelCls, "md:!text-sm")}>ประเภท<Req /></span>
              <SelectDropdown id={id("type")} size="sm" showSwatch={false} required
                ariaLabelledby={id("type-label")} ariaDescribedby={describedBy("activity_type")}
                options={ACTIVITY_TYPES} value={form.activity_type} onChange={set("activity_type")}
                error={!!errors.activity_type} placeholder="เลือกประเภท" />
              {errP("activity_type")}
            </div>
            {text("title", "ชื่อกิจกรรม", { required: true, placeholder: "เช่น อบรมความปลอดภัยในการทำงาน, IELTS" })}
          </div>

          <div className="grid gap-4 sm:grid-cols-3">
            <div>
              <label htmlFor={id("start_date")} className={cx(labelCls, "md:!text-sm")}>วันที่เริ่ม<Req /></label>
              <ThaiDateField id={id("start_date")} ariaLabel="วันที่เริ่ม" value={form.start_date} onChange={(e) => set("start_date")(e.target.value)}
                error={!!errors.start_date} aria-describedby={describedBy("start_date")} className={dateCls} />
              {errP("start_date")}
            </div>
            <div>
              <label htmlFor={id("end_date")} className={cx(labelCls, "md:!text-sm")}>วันที่สิ้นสุด</label>
              <ThaiDateField id={id("end_date")} ariaLabel="วันที่สิ้นสุด" value={form.end_date} onChange={(e) => set("end_date")(e.target.value)}
                error={!!errors.end_date} aria-describedby={describedBy("end_date", !errors.end_date)} className={dateCls} />
              {errors.end_date ? errP("end_date") : <p id={id("end_date-hint")} className={cx(helpTextCls, "md:text-xs")}>เว้นว่างถ้าจบในวันเดียว</p>}
            </div>
            <div>
              <label htmlFor={id("hours")} className={cx(labelCls, "md:!text-sm")}>จำนวนชั่วโมง</label>
              <input id={id("hours")} type="number" inputMode="decimal" min="0" step="0.5" value={form.hours}
                onChange={(e) => set("hours")(e.target.value)} placeholder="เช่น 18"
                aria-invalid={errors.hours ? true : undefined} aria-describedby={describedBy("hours")}
                className={cx(inputCls, "tabular-nums", errors.hours && errBorder)} />
              {errP("hours")}
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            {text("organizer", "ผู้จัด / หน่วยงาน", { placeholder: "เช่น British Council" })}
            {text("location", "สถานที่", { placeholder: "เช่น ขอนแก่น, ออนไลน์" })}
          </div>

          <div>
            <label htmlFor={id("detail")} className={cx(labelCls, "md:!text-sm")}>รายละเอียด</label>
            <textarea id={id("detail")} rows={3} value={form.detail} onChange={(e) => set("detail")(e.target.value)}
              className={cx(inputCls, "resize-y")} placeholder="หัวข้อ เนื้อหา หรือหลักสูตร" />
          </div>

          {text("result", "ผล", { placeholder: "เช่น ผ่าน, 6.5, ได้รับวุฒิบัตร" })}

          <fieldset className="space-y-2">
            <legend className="mb-1 text-xs font-semibold text-gray-500 dark:text-gray-400">ใบประกาศ / หลักฐาน</legend>
            {existing.length > 0 && (
              <ul className="divide-y divide-gray-100 dark:divide-line" aria-label={`ไฟล์ที่แนบไว้แล้ว ${existing.length} ไฟล์`}>
                {existing.map((f) => <ExistingFile key={f.id} file={f} onRemove={setRemoveTarget} busy={saving || removing} />)}
              </ul>
            )}
            <FileUploader uploads={uploads} label={existing.length ? "แนบไฟล์เพิ่ม" : "แนบไฟล์"}
              hint="PDF, JPG, PNG หรือ WEBP ไม่เกิน 5 MB ต่อไฟล์" disabled={saving} />
          </fieldset>

          {msg && <StatusMsg msg={msg} />}
          <button type="submit" hidden aria-hidden="true" tabIndex={-1} />
        </form>
      </Sheet>

      <ConfirmDialog
        open={Boolean(removeTarget)}
        title="ถอดไฟล์แนบ"
        description={removeTarget ? `ลบ "${removeTarget.filename}" ออกจากกิจกรรมนี้ — กู้คืนไม่ได้` : ""}
        confirmLabel="ถอดไฟล์"
        tone="danger"
        loading={removing}
        loadingLabel="กำลังถอดไฟล์…"
        error={removeErr}
        onConfirm={confirmRemove}
        onCancel={() => { if (!removing) { setRemoveTarget(null); setRemoveErr("") } }}
      />
    </>
  )
}
