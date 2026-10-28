// src/components/ReportIssueSheet.jsx
// ─────────────────────────────────────────────────────────────────────────────
// 3F "แจ้งแก้ไขข้อมูล" — the one form an employee uses to ask HR to change their own data.
// Used by MyProfile (button at the top) and by onboarding (cid / hired / family rows),
// which opens it pre-pointed at a category + field.
//
//   <ReportIssueSheet open={open} onClose={close}
//     initialCategory="personal_info" initialField="cid" currentValue="1234…" onSent={reload} />
//
//   GET  /personnel/me/report-issue/fields → [{ category, category_label, fields: [{ field, label, input_type }] }]
//   POST /personnel/me/report-issue        { category, field_name, current_value, correct_value, description }
//        → { status: "applied" | "created" … }  (409 = a request for this field is already pending)
// Fields named `*_other` (financial_other, family_other, education_other, …) are "manual": no single
// correct value — the description carries the request and correct_value is sent as "-".
// ─────────────────────────────────────────────────────────────────────────────
import { useEffect, useState } from "react"
import { apiAuth } from "../lib/api"
import { cx, baseField, labelCls, submitBtnCls, neutralBtnCls, errorTextCls, helpTextCls } from "../lib/styles"
import SelectDropdown from "./SelectDropdown"
import DateInput from "./ThaiDateField"
import { Sheet, toast } from "./ui"

const inputCls = cx(baseField, "!rounded-lg !px-3 !py-2 md:!text-sm")
const EMPTY = { category: "", field_name: "", current_value: "", correct_value: "", description: "" }
const isManualField = (f) => typeof f === "string" && f.endsWith("_other")

// fields list rarely changes — share one fetch across opens
let fieldsCache = null

export default function ReportIssueSheet({ open, onClose, initialCategory = "", initialField = "", currentValue = "", onSent }) {
  const [form, setForm] = useState(EMPTY)
  const [fields, setFields] = useState({ status: fieldsCache ? "ready" : "idle", list: fieldsCache ?? [] })
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState("")

  useEffect(() => {
    if (!open) return
    setForm({ ...EMPTY, category: initialCategory, field_name: initialField, current_value: currentValue ?? "" })
    setMsg("")
    if (!fieldsCache) {
      setFields({ status: "loading", list: [] })
      apiAuth("/personnel/me/report-issue/fields")
        .then((d) => {
          fieldsCache = Array.isArray(d) ? d : []
          setFields({ status: "ready", list: fieldsCache })
        })
        .catch(() => setFields({ status: "error", list: [] }))
    }
  }, [open, initialCategory, initialField, currentValue])

  const set = (k) => (v) => setForm((p) => ({ ...p, [k]: v }))
  const category = fields.list.find((c) => c.category === form.category)
  const categoryFields = category?.fields ?? []
  const field = categoryFields.find((f) => f.field === form.field_name)
  const inputType = field?.input_type || "text"
  const manual = isManualField(form.field_name)

  const submit = async (e) => {
    e.preventDefault()
    if (!form.category || !form.field_name) return setMsg("เลือกหมวดหมู่และข้อมูลที่ต้องการแก้")
    if (manual ? !form.description.trim() : !String(form.correct_value).trim()) {
      return setMsg(manual ? "ระบุรายละเอียดว่าต้องแก้อะไร" : "กรอกค่าที่ถูกต้อง")
    }
    setBusy(true)
    setMsg("")
    try {
      const body = { ...form, correct_value: manual ? "-" : String(form.correct_value).trim() }
      const res = await apiAuth("/personnel/me/report-issue", { method: "POST", body })
      if (res?.status === "applied") toast.success("บันทึกแล้ว", { description: "ข้อมูลของคุณถูกแก้ไขเรียบร้อย" })
      else toast.success("ส่งให้ฝ่าย HR แล้ว", { description: "ติดตามสถานะได้ที่ “คำร้องของฉัน” ในหน้าข้อมูลส่วนตัว" })
      onClose?.()
      onSent?.(res)
    } catch (err) {
      setMsg(err.status === 409 ? "มีคำร้องสำหรับข้อมูลนี้รออยู่แล้ว" : err.message || "ส่งคำร้องไม่สำเร็จ")
    } finally {
      setBusy(false)
    }
  }

  return (
    <Sheet
      open={open}
      onClose={onClose}
      busy={busy}
      size="sm"
      title="แจ้งแก้ไขข้อมูล"
      subtitle="ฝ่ายบุคคลจะตรวจสอบและแก้ให้"
      footer={
        <div className="grid grid-cols-2 gap-3 md:flex md:justify-end md:gap-2">
          <button type="button" onClick={onClose} disabled={busy} className={neutralBtnCls}>ยกเลิก</button>
          <button type="submit" form="report-issue-form" disabled={busy} className={submitBtnCls}>
            {busy ? "กำลังส่ง…" : "ส่งคำร้อง"}
          </button>
        </div>
      }
    >
      <form id="report-issue-form" onSubmit={submit} className="space-y-4">
        <div>
          <label htmlFor="ri-category" className={labelCls}>หมวดหมู่ <span className="text-red-500">*</span></label>
          <SelectDropdown
            id="ri-category"
            size="sm"
            required
            value={form.category}
            onChange={(v) => setForm((p) => ({ ...p, category: v, field_name: "" }))}
            placeholder="— เลือกหมวดหมู่ —"
            loading={fields.status === "loading"}
            options={fields.list.filter((c) => (c.fields || []).length > 0).map((c) => ({ value: c.category, label: c.category_label || c.category }))}
          />
          {fields.status === "error" && <p className={errorTextCls}>โหลดรายการไม่สำเร็จ ปิดแล้วเปิดใหม่อีกครั้ง</p>}
        </div>
        {form.category && (
          <div>
            <label htmlFor="ri-field" className={labelCls}>ข้อมูลที่ต้องการแก้ <span className="text-red-500">*</span></label>
            <SelectDropdown
              id="ri-field"
              size="sm"
              required
              value={form.field_name}
              onChange={(v) => setForm((p) => ({ ...p, field_name: v, correct_value: "" }))}
              placeholder="— เลือกข้อมูล —"
              options={categoryFields.map((f) => ({ value: f.field, label: f.label || f.field }))}
            />
          </div>
        )}
        {!manual && (
          <>
            <div>
              <label htmlFor="ri-current" className={labelCls}>ค่าปัจจุบัน (ที่ผิด)</label>
              <input id="ri-current" type="text" value={form.current_value} onChange={(e) => set("current_value")(e.target.value)} className={inputCls} placeholder="ค่าที่แสดงอยู่ตอนนี้" />
            </div>
            <div>
              <label htmlFor="ri-correct" className={labelCls}>ค่าที่ถูกต้อง <span className="text-red-500">*</span></label>
              {inputType === "date" ? (
                <DateInput id="ri-correct" ariaLabel="ค่าที่ถูกต้อง" value={form.correct_value} onChange={(e) => set("correct_value")(e.target.value)} />
              ) : inputType === "textarea" ? (
                <textarea id="ri-correct" rows={3} value={form.correct_value} onChange={(e) => set("correct_value")(e.target.value)} className={cx(inputCls, "resize-none")} placeholder="ค่าที่ควรจะเป็น" />
              ) : (
                <input
                  id="ri-correct"
                  type={inputType === "int" ? "number" : "text"}
                  inputMode={inputType === "int" ? "numeric" : undefined}
                  step={inputType === "int" ? 1 : undefined}
                  value={form.correct_value}
                  onChange={(e) => set("correct_value")(e.target.value)}
                  className={inputCls}
                  placeholder="ค่าที่ควรจะเป็น"
                />
              )}
            </div>
          </>
        )}
        <div>
          <label htmlFor="ri-desc" className={labelCls}>
            รายละเอียด{manual ? <span className="text-red-500"> *</span> : " เพิ่มเติม"}
          </label>
          <textarea
            id="ri-desc"
            value={form.description}
            onChange={(e) => set("description")(e.target.value)}
            className={cx(inputCls, "resize-none")}
            rows={manual ? 4 : 2}
            placeholder={manual ? "อธิบายว่าข้อมูลส่วนไหนไม่ถูกต้อง และควรเป็นอย่างไร" : "อธิบายเพิ่มเติม (ถ้ามี)"}
          />
          {manual && <p className={helpTextCls}>HR จะอ่านรายละเอียดนี้แล้วแก้ให้ในระบบ</p>}
        </div>
        {msg && <p role="alert" className={errorTextCls}>{msg}</p>}
      </form>
    </Sheet>
  )
}
