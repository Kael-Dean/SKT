// src/pages/hr/tabs/HRPayrollSettingsTab.jsx
// ─────────────────────────────────────────────────────────────────────────────
// ตั้งค่าการคำนวณเงินเดือน (งวด 3 · 3C)
//   GET   /hr/payroll/settings   hr.payroll.settings.view (payroll.view | payroll.settings)
//   PATCH /hr/payroll/settings   hr.payroll.settings.edit (payroll.settings) — ส่งเฉพาะช่องที่เปลี่ยน
//   ค่าใหม่มีผลกับเงินเดือนที่สร้าง/คำนวณใหม่ "หลัง" บันทึก · ทุกการแก้ไขบันทึก audit log
//   ค่าจ้างขั้นต่ำ > เพดาน → 422 (แสดง detail ตามที่ backend ส่ง; หน้าเว็บเช็คก่อนส่งด้วย)
// ─────────────────────────────────────────────────────────────────────────────
import { useCallback, useEffect, useId, useMemo, useState } from "react"
import { Info } from "lucide-react"
import { apiAuth } from "../../../lib/api"
import { useCan } from "../../../lib/permissions"
import { fmtDateTime } from "../../../lib/payroll"
import {
  cx, baseField, errorTextCls, fieldDisabled, segmentedCls, segmentedItemActiveCls, segmentedItemCls,
} from "../../../lib/styles"
import { ErrorState, SkeletonCard, StickyActionBar, toast } from "../../../components/ui"
import StatusMsg from "../../../components/hr/StatusMsg"

const inputCls = cx(baseField, "!rounded-lg !px-3 !py-2 md:!text-sm text-right tabular-nums")

// type: pct (0–100) · baht (≥0) · days (1–31 จำนวนเต็ม) · choice
const FIELDS = {
  sso_rate_pct: { label: "อัตราเงินสมทบประกันสังคม", unit: "%", type: "pct" },
  sso_wage_floor: { label: "ค่าจ้างขั้นต่ำที่ใช้คำนวณ", unit: "บาท", type: "baht" },
  sso_wage_ceiling: { label: "เพดานค่าจ้าง", unit: "บาท", type: "baht" },
  reserve_rate_pct: { label: "อัตราเงินสะสม (% ของเงินเดือน)", unit: "%", type: "pct", hint: "ใช้กับคนที่ไม่ได้กำหนดเงินสะสมเป็นบาทไว้ในข้อมูลการเงินรายคน" },
  tax_mode: {
    label: "วิธีคำนวณภาษี", type: "choice",
    options: [{ value: "pnd1", label: "ภ.ง.ด.1" }, { value: "flat_rate", label: "อัตราคงที่" }],
    hint: "ภ.ง.ด.1 = คำนวณภาษีทั้งปีตามกรมสรรพากรแล้วหารเฉลี่ยรายเดือน · อัตราคงที่ = % ของเงินเดือน",
  },
  tax_flat_rate_pct: { label: "อัตราภาษีคงที่", unit: "%", type: "pct", when: (f) => f.tax_mode === "flat_rate" },
  tax_expense_pct: { label: "หักค่าใช้จ่าย", unit: "%", type: "pct", hint: "ตามกฎหมาย 50%", when: (f) => f.tax_mode === "pnd1" },
  tax_expense_cap: { label: "หักค่าใช้จ่ายไม่เกิน", unit: "บาท/ปี", type: "baht", hint: "ตามกฎหมาย 100,000 บาท", when: (f) => f.tax_mode === "pnd1" },
  tax_personal_allowance: { label: "ค่าลดหย่อนส่วนตัว", unit: "บาท/ปี", type: "baht", hint: "ตามกฎหมาย 60,000 บาท", when: (f) => f.tax_mode === "pnd1" },
  daily_rate_divisor: {
    label: "ตัวหารค่าจ้างรายวัน", type: "choice",
    options: [{ value: "working_days", label: "วันทำงานจริง" }, { value: "fixed", label: "จำนวนวันคงที่" }],
    hint: "วันทำงานจริง = จำนวนวันทำงานของเดือนตามปฏิทินวันหยุด",
  },
  daily_rate_fixed_days: { label: "จำนวนวัน (ถ้าเลือกคงที่)", unit: "วัน", type: "days", when: (f) => f.daily_rate_divisor === "fixed" },
}

const GROUPS = [
  { title: "ประกันสังคม", keys: ["sso_rate_pct", "sso_wage_floor", "sso_wage_ceiling"], note: "หักจากค่าจ้างที่อยู่ระหว่างค่าจ้างขั้นต่ำกับเพดาน" },
  { title: "เงินสะสม", keys: ["reserve_rate_pct"] },
  { title: "ภาษีเงินได้หัก ณ ที่จ่าย", keys: ["tax_mode", "tax_flat_rate_pct", "tax_expense_pct", "tax_expense_cap", "tax_personal_allowance"] },
  { title: "ค่าจ้างรายวัน", keys: ["daily_rate_divisor", "daily_rate_fixed_days"], note: "ใช้คำนวณงดจ่าย (ลาเกินสิทธิ์) และค่าทำงานวันหยุด" },
]

const KEYS = Object.keys(FIELDS)
const toForm = (s) => Object.fromEntries(KEYS.map((k) => [k, s?.[k] == null ? "" : String(s[k])]))
const same = (k, a, b) => (FIELDS[k].type === "choice" ? a === b : a.trim() !== "" && b.trim() !== "" ? Number(a) === Number(b) : a.trim() === b.trim())

function validate(f) {
  const e = {}
  for (const k of KEYS) {
    const def = FIELDS[k]
    if (def.type === "choice" || (def.when && !def.when(f))) continue
    const v = f[k].trim()
    if (v === "") { e[k] = "กรอกค่านี้"; continue }
    const n = Number(v)
    if (!Number.isFinite(n)) e[k] = "กรอกเป็นตัวเลข"
    else if (def.type === "pct" && (n < 0 || n > 100)) e[k] = "กรอก 0–100"
    else if (def.type === "baht" && n < 0) e[k] = "ต้องไม่ติดลบ"
    else if (def.type === "days" && (!Number.isInteger(n) || n < 1 || n > 31)) e[k] = "กรอกจำนวนเต็ม 1–31"
  }
  if (!e.sso_wage_floor && !e.sso_wage_ceiling && Number(f.sso_wage_floor) > Number(f.sso_wage_ceiling)) {
    e.sso_wage_floor = "ค่าจ้างขั้นต่ำต้องไม่เกินเพดานค่าจ้าง"
  }
  return e
}

function Field({ k, form, setValue, error, readOnly, changed }) {
  const id = useId()
  const def = FIELDS[k]
  if (def.when && !def.when(form)) return null
  const hintId = def.hint ? `${id}-hint` : undefined
  const errId = error ? `${id}-err` : undefined
  const describedBy = [hintId, errId].filter(Boolean).join(" ") || undefined

  return (
    <div className="grid gap-x-6 gap-y-1.5 py-3 md:grid-cols-[minmax(0,1fr)_16rem] md:items-start">
      <div className="min-w-0">
        <label htmlFor={def.type === "choice" ? undefined : id} id={`${id}-label`} className="flex items-center gap-2 text-sm font-medium text-gray-900 dark:text-gray-100">
          {def.label}
          {changed && <span className="rounded-full bg-indigo-50 px-1.5 py-px text-[11px] font-medium text-indigo-700 dark:bg-indigo-500/15 dark:text-indigo-300">แก้ไขแล้ว</span>}
        </label>
        {def.hint && <p id={hintId} className="mt-0.5 text-xs text-gray-500 dark:text-gray-400">{def.hint}</p>}
      </div>
      <div>
        {def.type === "choice" ? (
          <div role="radiogroup" aria-labelledby={`${id}-label`} aria-describedby={describedBy} className={cx(segmentedCls, readOnly && "opacity-80")}>
            {def.options.map((o) => {
              const on = form[k] === o.value
              return (
                <button
                  key={o.value}
                  type="button"
                  role="radio"
                  aria-checked={on}
                  disabled={readOnly}
                  onClick={() => setValue(k, o.value)}
                  className={cx(segmentedItemCls, "md:!min-h-8 disabled:cursor-not-allowed", on && segmentedItemActiveCls)}
                >
                  {o.label}
                </button>
              )
            })}
          </div>
        ) : (
          <div className="relative">
            <input
              id={id}
              type="number"
              inputMode={def.type === "days" ? "numeric" : "decimal"}
              step={def.type === "days" ? "1" : "0.01"}
              min={def.type === "days" ? 1 : 0}
              max={def.type === "pct" ? 100 : def.type === "days" ? 31 : undefined}
              value={form[k]}
              onChange={(e) => setValue(k, e.target.value)}
              readOnly={readOnly}
              aria-invalid={error ? true : undefined}
              aria-describedby={describedBy}
              className={cx(inputCls, "!pr-16", readOnly && fieldDisabled, error && "!border-red-500 dark:!border-red-400")}
            />
            <span aria-hidden="true" className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-xs text-gray-500 dark:text-gray-400">{def.unit}</span>
          </div>
        )}
        {error && <p id={errId} className={errorTextCls}>{error}</p>}
      </div>
    </div>
  )
}

export default function HRPayrollSettingsTab() {
  const { can } = useCan()
  const canEdit = can("hr.payroll.settings.edit")
  const [saved, setSaved] = useState(null)
  const [form, setForm] = useState(toForm(null))
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState("")
  const [errors, setErrors] = useState({})
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState(null)

  const load = useCallback(() => {
    setLoading(true)
    setLoadError("")
    apiAuth("/hr/payroll/settings")
      .then((d) => { setSaved(d); setForm(toForm(d)); setErrors({}) })
      .catch((e) => setLoadError(e.message || "โหลดการตั้งค่าไม่สำเร็จ"))
      .finally(() => setLoading(false))
  }, [])
  useEffect(() => { load() }, [load])

  const base = useMemo(() => toForm(saved), [saved])
  const changedKeys = KEYS.filter((k) => !same(k, form[k], base[k]))
  const dirty = changedKeys.length > 0

  const setValue = (k, v) => {
    setForm((p) => ({ ...p, [k]: v }))
    setMsg(null)
    if (errors[k] || (k === "sso_wage_ceiling" && errors.sso_wage_floor)) setErrors((e) => ({ ...e, [k]: undefined, ...(k === "sso_wage_ceiling" ? { sso_wage_floor: undefined } : {}) }))
  }

  const reset = () => { setForm(base); setErrors({}); setMsg(null) }

  const save = async () => {
    const errs = validate(form)
    setErrors(errs)
    if (Object.keys(errs).length) { setMsg({ tone: "warning", text: "ตรวจช่องที่มีข้อความสีแดงก่อนบันทึก" }); return }
    const body = {}
    for (const k of changedKeys) body[k] = FIELDS[k].type === "choice" ? form[k] : FIELDS[k].type === "days" ? parseInt(form[k], 10) : form[k].trim()
    setSaving(true)
    setMsg(null)
    try {
      const res = await apiAuth("/hr/payroll/settings", { method: "PATCH", body })
      if (res && typeof res === "object" && "sso_rate_pct" in res) { setSaved(res); setForm(toForm(res)) }
      else load()
      toast.success("บันทึกการตั้งค่าแล้ว", { description: "มีผลกับเงินเดือนที่สร้างหรือคำนวณใหม่หลังจากนี้" })
    } catch (err) {
      setMsg({ tone: "error", text: err.message || "บันทึกไม่สำเร็จ" })
    } finally {
      setSaving(false)
    }
  }

  if (loading) return <div className="space-y-3"><SkeletonCard /><SkeletonCard /></div>
  if (loadError) return <ErrorState message={loadError} onRetry={load} />

  const updatedBy = saved?.updated_by_name || (saved?.updated_by != null ? `ผู้ใช้ #${saved.updated_by}` : null)

  return (
    <form className="space-y-4" noValidate onSubmit={(e) => { e.preventDefault(); if (canEdit && dirty) save() }}>
      <div className="flex flex-col gap-2 rounded-xl bg-indigo-50/70 px-4 py-3 text-sm text-indigo-950 ring-1 ring-inset ring-indigo-100 dark:bg-indigo-500/10 dark:text-indigo-100 dark:ring-indigo-400/20 md:flex-row md:items-center md:justify-between">
        <p className="flex items-start gap-2">
          <Info aria-hidden="true" className="mt-0.5 size-4 shrink-0" strokeWidth={1.75} />
          <span>ค่าที่แก้มีผลกับเงินเดือนที่ <b className="font-semibold">สร้างหรือคำนวณใหม่หลังบันทึก</b> เท่านั้น — งวดที่คำนวณไปแล้วไม่เปลี่ยน จนกว่าจะกด &quot;คำนวณใหม่&quot; ในงวดร่าง</span>
        </p>
        {saved?.updated_at && (
          <p className="shrink-0 text-xs text-indigo-900/80 dark:text-indigo-200/80">
            แก้ไขล่าสุด {fmtDateTime(saved.updated_at)}{updatedBy ? ` · ${updatedBy}` : ""}
          </p>
        )}
      </div>

      {!canEdit && (
        <p className="text-sm text-gray-600 dark:text-gray-400">ดูได้อย่างเดียว — แก้ไขได้เฉพาะหัวหน้าแผนกบุคคล</p>
      )}

      {GROUPS.map((g) => (
        <fieldset key={g.title} className="rounded-2xl bg-white px-4 pt-3 pb-1 ring-1 ring-gray-200/70 shadow-sm dark:bg-surface dark:ring-line dark:shadow-none md:px-5">
          <legend className="sr-only">{g.title}</legend>
          <h3 aria-hidden="true" className="text-sm font-semibold text-gray-900 dark:text-gray-100">{g.title}</h3>
          {g.note && <p className="mt-0.5 text-xs text-gray-500 dark:text-gray-400">{g.note}</p>}
          <div className="mt-1 divide-y divide-gray-100 dark:divide-line">
            {g.keys.map((k) => (
              <Field key={k} k={k} form={form} setValue={setValue} error={errors[k]} readOnly={!canEdit || saving} changed={changedKeys.includes(k)} />
            ))}
          </div>
        </fieldset>
      ))}

      {msg && <StatusMsg msg={msg} />}

      {canEdit && (
        <StickyActionBar
          summary={
            <span className="text-sm text-gray-600 dark:text-gray-400" aria-live="polite">
              {dirty ? `แก้ไข ${changedKeys.length} ช่อง ยังไม่บันทึก` : "ยังไม่มีการแก้ไข"}
            </span>
          }
          secondary={dirty ? { label: "คืนค่าเดิม", onClick: reset, disabled: saving } : undefined}
          primary={{ label: saving ? "กำลังบันทึก…" : "บันทึกการตั้งค่า", onClick: save, disabled: !dirty || saving, loading: saving }}
        />
      )}
    </form>
  )
}
