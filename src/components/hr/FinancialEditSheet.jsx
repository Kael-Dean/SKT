// src/components/hr/FinancialEditSheet.jsx
// ─────────────────────────────────────────────────────────────────────────────
// แก้ไขข้อมูลการเงินพื้นฐานของเจ้าหน้าที่ — ใช้ร่วมกันใน HRFinance และ HRPersonnelDetail
//   GET  /hr/employees/{id}/financial   (ค่าล่าสุด รวม field ภาษีใหม่ของงวด 3 · 3C)
//   POST /hr/financial/{id}             (บันทึก)
//
//   current_reserve            เงินสะสม บาท/เดือน — 0 = ใช้อัตรา % ในการตั้งค่าการคำนวณเงินเดือน
//   tax_withholding_override   ภาษีหัก ณ ที่จ่ายคงที่/เดือน — ว่าง = null (ใช้ภาษีที่ระบบคำนวณ)
//   tax_extra_allowance        ค่าลดหย่อนเพิ่มเติม/ปี (จาก ล.ย.01) — default 0
//   pay_basis                  "monthly" | "daily" (3C daily-paid) — รายวัน: payroll ไม่ใช้ current_salary
//                              แสดง/ส่งเฉพาะเมื่อ GET คืน field นี้ (backend ที่ยังไม่ migrate จะไม่มี)
// ─────────────────────────────────────────────────────────────────────────────
import { useEffect, useId, useState } from "react"
import { apiAuth } from "../../lib/api"
import { PAY_BASIS_OPTIONS } from "../../lib/payroll"
import {
  cx, baseField, errorTextCls, fieldDisabled, helpTextCls, labelCls, neutralBtnCls, segmentedCls, segmentedItemActiveCls,
  segmentedItemCls, submitBtnCls,
} from "../../lib/styles"
import { Sheet, toast } from "../ui"
import StatusMsg from "./StatusMsg"

const inputCls = cx(baseField, "!rounded-lg !px-3 !py-2 md:!text-sm tabular-nums")
const btnCls = "h-12 md:h-10 md:!px-5 md:!py-0 md:!text-sm"

const FIELDS = [
  { key: "current_salary", label: "เงินเดือน (บาท)", placeholder: "25000" },
  { key: "current_loan", label: "เงินกู้คงเหลือ (บาท)", placeholder: "0" },
  { key: "job_age", label: "อายุงาน (ปี)", placeholder: "0", integer: true },
  { key: "current_reserve", label: "เงินสะสม (บาท/เดือน)", placeholder: "0", hint: "ใส่ 0 = ใช้อัตรา % ตามการตั้งค่าการคำนวณเงินเดือน" },
  { key: "tax_withholding_override", label: "ภาษีหัก ณ ที่จ่ายคงที่/เดือน (บาท)", placeholder: "เว้นว่าง", hint: "เว้นว่าง = ใช้ภาษีที่ระบบคำนวณ (ภ.ง.ด.1)", nullable: true },
  { key: "tax_extra_allowance", label: "ค่าลดหย่อนเพิ่มเติม/ปี (บาท)", placeholder: "0", hint: "จากแบบ ล.ย.01 เช่น คู่สมรส บุตร เบี้ยประกัน" },
]
const GROUPS = [
  { title: "ข้อมูลพื้นฐาน", keys: ["current_salary", "current_loan", "job_age"] },
  { title: "เงินสะสมและภาษี", keys: ["current_reserve", "tax_withholding_override", "tax_extra_allowance"] },
]

const str = (v) => (v == null ? "" : String(v))
const formFrom = (fin = {}) => Object.fromEntries(FIELDS.map((f) => [f.key, str(fin[f.key])]))

function validate(form) {
  const errs = {}
  for (const f of FIELDS) {
    const v = form[f.key].trim()
    if (v === "") continue
    const n = Number(v)
    if (!Number.isFinite(n) || n < 0) errs[f.key] = "กรอกตัวเลขตั้งแต่ 0 ขึ้นไป"
    else if (f.integer && !Number.isInteger(n)) errs[f.key] = "กรอกเป็นจำนวนเต็ม"
  }
  return errs
}

/**
 * @param {{ open: boolean, employeeId: number|string, employeeName?: string, financial?: object,
 *           onClose: () => void, onSaved?: () => void }} props
 */
export default function FinancialEditSheet({ open, employeeId, employeeName, financial, onClose, onSaved }) {
  const uid = useId()
  const [form, setForm] = useState(() => formFrom(financial))
  const [loadingLatest, setLoadingLatest] = useState(false)
  const [errors, setErrors] = useState({})
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState(null)
  // null = backend ไม่ส่ง pay_basis มา → ซ่อนตัวเลือก
  const [payBasis, setPayBasis] = useState(financial?.pay_basis ?? null)
  const isDaily = payBasis === "daily"

  // เปิดใหม่ทุกครั้ง: เติมค่าจากหน้ารายการก่อน แล้วดึงค่าล่าสุด (มี field ภาษีใหม่) มาทับ
  useEffect(() => {
    if (!open || employeeId == null) return
    let alive = true
    setForm(formFrom(financial))
    setPayBasis(financial?.pay_basis ?? null)
    setErrors({})
    setMsg(null)
    setLoadingLatest(true)
    apiAuth(`/hr/employees/${employeeId}/financial`)
      .then((d) => {
        if (!alive || !d || typeof d !== "object") return
        setForm(formFrom({ ...financial, ...d }))
        if ("pay_basis" in d) setPayBasis(d.pay_basis || "monthly")
      })
      .catch(() => { /* ไม่มีสิทธิ์/ยังไม่มีข้อมูล → ใช้ค่าจากหน้ารายการ */ })
      .finally(() => { if (alive) setLoadingLatest(false) })
    return () => { alive = false }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- เติมค่าเฉพาะตอนเปิด / เปลี่ยนคน
  }, [open, employeeId])

  const set = (key, value) => {
    setForm((p) => ({ ...p, [key]: value }))
    if (errors[key]) setErrors((e) => ({ ...e, [key]: undefined }))
  }

  const save = async () => {
    const errs = validate(form)
    setErrors(errs)
    if (Object.keys(errs).length) {
      setMsg({ tone: "warning", text: "ตรวจช่องที่มีข้อความสีแดงก่อนบันทึก" })
      return
    }
    const body = {}
    for (const f of FIELDS) {
      const v = form[f.key].trim()
      if (f.nullable) body[f.key] = v === "" ? null : Number(v)
      else if (v !== "") body[f.key] = f.integer ? parseInt(v, 10) : Number(v)
      else if (f.key === "current_reserve" || f.key === "tax_extra_allowance") body[f.key] = 0
    }
    if (payBasis) body.pay_basis = payBasis
    setSaving(true)
    setMsg(null)
    try {
      await apiAuth(`/hr/financial/${employeeId}`, { method: "POST", body })
      toast.success("บันทึกข้อมูลการเงินแล้ว", { description: employeeName || undefined })
      onSaved?.()
      onClose()
    } catch (err) {
      setMsg({ tone: "error", text: err.message || "บันทึกไม่สำเร็จ" })
    } finally {
      setSaving(false)
    }
  }

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title="แก้ไขข้อมูลการเงิน"
      subtitle={employeeName}
      size="md"
      busy={saving}
      footer={
        <div className="grid grid-cols-2 gap-3 md:flex md:justify-end md:gap-2">
          <button type="button" onClick={onClose} disabled={saving} className={cx(neutralBtnCls, btnCls)}>ยกเลิก</button>
          <button type="button" onClick={save} disabled={saving} className={cx(submitBtnCls, btnCls, "!rounded-xl")}>
            {saving ? "กำลังบันทึก…" : "บันทึก"}
          </button>
        </div>
      }
    >
      <form
        className="space-y-5"
        aria-busy={loadingLatest || undefined}
        onSubmit={(e) => { e.preventDefault(); save() }}
        noValidate
      >
        {payBasis && (
          <div>
            <p id={`${uid}-basis-label`} className={cx(labelCls, "md:!text-sm")}>ประเภทการจ่าย</p>
            <div role="radiogroup" aria-labelledby={`${uid}-basis-label`} aria-describedby={`${uid}-basis-hint`} className={cx(segmentedCls, "md:max-w-xs")}>
              {PAY_BASIS_OPTIONS.map((o) => {
                const on = payBasis === o.value
                return (
                  <button
                    key={o.value}
                    type="button"
                    role="radio"
                    aria-checked={on}
                    tabIndex={on ? 0 : -1}
                    onClick={() => setPayBasis(o.value)}
                    onKeyDown={(e) => {
                      if (!["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"].includes(e.key)) return
                      e.preventDefault()
                      const next = PAY_BASIS_OPTIONS.find((x) => x.value !== o.value)
                      setPayBasis(next.value)
                      e.currentTarget.parentElement?.querySelector(`[data-v="${next.value}"]`)?.focus()
                    }}
                    data-v={o.value}
                    className={cx(segmentedItemCls, "md:!min-h-8", on && segmentedItemActiveCls)}
                  >
                    {o.label}
                  </button>
                )
              })}
            </div>
            <p id={`${uid}-basis-hint`} className={cx(helpTextCls, "md:text-xs")}>
              {isDaily
                ? "ลูกจ้างรายวันได้รับค่าจ้างรายวัน × จำนวนวันที่บันทึกในหน้าจ่ายเงินเดือนแต่ละเดือน — ไม่ใช้ช่องเงินเดือน"
                : "พนักงานรายเดือนได้รับเงินเดือนตามช่องเงินเดือนด้านล่าง"}
            </p>
          </div>
        )}
        {GROUPS.map((g) => (
          <fieldset key={g.title} className="space-y-3">
            <legend className="mb-2 text-xs font-semibold text-gray-500 dark:text-gray-400">{g.title}</legend>
            {g.keys.map((key) => {
              const f = FIELDS.find((x) => x.key === key)
              const id = `${uid}-${key}`
              // ลูกจ้างรายวัน: payroll ไม่ใช้เงินเดือน → ล็อกช่องไว้ (ค่าเดิมยังถูกส่งกลับไปเหมือนเดิม)
              const salaryUnused = key === "current_salary" && isDaily
              const hint = salaryUnused ? "ไม่ใช้กับลูกจ้างรายวัน" : f.hint
              const hintId = hint ? `${id}-hint` : undefined
              const errId = errors[key] ? `${id}-err` : undefined
              return (
                <div key={key}>
                  <label htmlFor={id} className={cx(labelCls, "md:!text-sm")}>{f.label}</label>
                  <input
                    id={id}
                    type="number"
                    inputMode={f.integer ? "numeric" : "decimal"}
                    min="0"
                    step={f.integer ? "1" : "0.01"}
                    value={form[key]}
                    onChange={(e) => set(key, e.target.value)}
                    placeholder={f.placeholder}
                    readOnly={salaryUnused}
                    aria-invalid={errors[key] ? true : undefined}
                    aria-describedby={[hintId, errId].filter(Boolean).join(" ") || undefined}
                    className={cx(inputCls, salaryUnused && fieldDisabled, errors[key] && "!border-red-500 dark:!border-red-400")}
                  />
                  {hint && <p id={hintId} className={cx(helpTextCls, "md:text-xs")}>{hint}</p>}
                  {errors[key] && <p id={errId} className={errorTextCls}>{errors[key]}</p>}
                </div>
              )
            })}
          </fieldset>
        ))}
        {loadingLatest && <p className="text-xs text-gray-500 dark:text-gray-400" role="status">กำลังดึงค่าล่าสุด…</p>}
        {msg && <StatusMsg msg={msg} />}
        <button type="submit" hidden aria-hidden="true" tabIndex={-1} />
      </form>
    </Sheet>
  )
}
