// src/pages/hr/tabs/HRWelfareSettingsTab.jsx
// ─────────────────────────────────────────────────────────────────────────────
// ตั้งค่าสวัสดิการ (3P) — เปิดจาก /hr/dashboard?tab=welfare-settings
//   GET   /hr/welfare/settings          (hr.welfare.view)
//   PATCH /hr/welfare/settings          (hr.welfare.settings) — ส่งเฉพาะค่าที่เปลี่ยน
//   GET   /hr/welfare/education-rates   (12 แถว: ระดับ 1–6 × รัฐ/เอกชน + level_label)
//   PUT   /hr/welfare/education-rates   (hr.welfare.settings) — ส่งทั้งรายการกลับ
// ไม่มีสิทธิ์แก้ = แสดงอย่างเดียว
// ─────────────────────────────────────────────────────────────────────────────
import { useCallback, useEffect, useId, useMemo, useState } from "react"
import { apiAuth } from "../../../lib/api"
import { apiDetail } from "../../../lib/apiErrors"
import { useCan } from "../../../lib/permissions"
import { cx, baseField, cellInput, errorTextCls, helpTextCls, labelCls, neutralBtnCls, submitBtnCls } from "../../../lib/styles"
import { PAYOUT_ROUTES, educationLevelLabel, money, rateAmountKey, rateInstKey } from "../../../lib/welfare"
import { ErrorState, SkeletonText, toast } from "../../../components/ui"
import StatusMsg from "../../../components/hr/StatusMsg"
import Segmented from "../../../components/hr/welfare/Segmented"

const inputCls = cx(baseField, "!rounded-lg !px-3 !py-2 md:!text-sm tabular-nums")
const saveBtn = cx(submitBtnCls, "!rounded-xl !h-11 md:!h-10 !px-5 !py-0 !text-sm")

const CAP_FIELDS = [
  { key: "medical_annual_cap", label: "วงเงินค่ารักษาพยาบาลต่อปี", unit: "บาท", hint: "วงเงินรวมของเจ้าหน้าที่และครอบครัว ต่อปีงบประมาณ (เม.ย.–มี.ค.)" },
  { key: "private_opd_cap", label: "รพ.เอกชน ผู้ป่วยนอก ต่อปี", unit: "บาท", hint: "อยู่ภายในวงเงินรวม" },
  { key: "private_ipd_cap", label: "รพ.เอกชน ผู้ป่วยใน ต่อปี", unit: "บาท", hint: "ค่ารักษา ไม่รวมค่าห้อง" },
  { key: "private_room_per_day", label: "ค่าห้อง + อาหาร รพ.เอกชน", unit: "บาท/วัน" },
  { key: "checkup_cap", label: "ตรวจสุขภาพประจำปี", unit: "บาท", hint: "ปีละครั้ง เฉพาะตัวเจ้าหน้าที่ สถานพยาบาลรัฐ" },
  { key: "child_max_age_medical", label: "อายุบุตรสูงสุดที่เบิกค่ารักษาได้", unit: "ปี", integer: true, hint: "นับเฉพาะอายุต่ำกว่าค่านี้ (ยกเว้นบุตรทุพพลภาพ)" },
]
const BOOL_FIELDS = ["checkup_in_medical_cap", "board_required"]

const toForm = (s = {}) => ({
  ...Object.fromEntries(CAP_FIELDS.map((f) => [f.key, s[f.key] != null ? String(s[f.key]) : ""])),
  checkup_in_medical_cap: !!s.checkup_in_medical_cap,
  board_required: !!s.board_required,
  payout_route: s.payout_route || "separate",
})

function Toggle({ id, checked, onChange, label, hint, disabled }) {
  return (
    <div className="flex items-start justify-between gap-4 py-3">
      <label htmlFor={id} className={cx("min-w-0 text-sm text-gray-800 dark:text-gray-200", !disabled && "cursor-pointer")}>
        {label}
        {hint && <span className="block text-xs text-gray-500 dark:text-gray-400">{hint}</span>}
      </label>
      <button
        id={id} type="button" role="switch" aria-checked={checked} disabled={disabled}
        onClick={() => onChange(!checked)}
        className={cx(
          "relative inline-flex h-6 w-11 shrink-0 cursor-pointer items-center rounded-full transition-colors duration-200",
          "focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-surface",
          "disabled:cursor-not-allowed disabled:opacity-60",
          checked ? "bg-indigo-600" : "bg-gray-300 dark:bg-white/20",
        )}
      >
        <span aria-hidden="true" className={cx("inline-block size-5 rounded-full bg-white shadow transition-transform duration-200 ease-out", checked ? "translate-x-5" : "translate-x-0.5")} />
      </button>
    </div>
  )
}

// ─── การตั้งค่าทั่วไป ────────────────────────────────────────────────────────

function SettingsSection({ canEdit }) {
  const uid = useId()
  const [orig, setOrig] = useState(null)
  const [form, setForm] = useState(toForm())
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [errors, setErrors] = useState({})
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError("")
    try {
      const s = await apiAuth("/hr/welfare/settings")
      setOrig(s)
      setForm(toForm(s))
    } catch (err) {
      setError(apiDetail(err) || "โหลดการตั้งค่าไม่สำเร็จ")
    } finally {
      setLoading(false)
    }
  }, [])
  useEffect(() => { load() }, [load])

  const set = (k) => (v) => {
    setForm((p) => ({ ...p, [k]: v }))
    setMsg(null)
    if (errors[k]) setErrors((e) => ({ ...e, [k]: undefined }))
  }

  const changes = useMemo(() => {
    if (!orig) return {}
    const out = {}
    for (const f of CAP_FIELDS) {
      const v = form[f.key].trim()
      if (v === "") continue
      const n = f.integer ? parseInt(v, 10) : Number(v)
      if (Number(orig[f.key]) !== n) out[f.key] = n
    }
    for (const k of BOOL_FIELDS) if (!!orig[k] !== form[k]) out[k] = form[k]
    if ((orig.payout_route || "separate") !== form.payout_route) out.payout_route = form.payout_route
    return out
  }, [orig, form])
  const dirty = Object.keys(changes).length > 0

  const save = async () => {
    const e = {}
    for (const f of CAP_FIELDS) {
      const v = form[f.key].trim()
      if (v === "") e[f.key] = "กรอกค่า"
      else if (!Number.isFinite(Number(v)) || Number(v) < 0) e[f.key] = "กรอกตัวเลขตั้งแต่ 0 ขึ้นไป"
      else if (f.integer && !Number.isInteger(Number(v))) e[f.key] = "กรอกเป็นจำนวนเต็ม"
    }
    setErrors(e)
    if (Object.keys(e).length) { setMsg({ tone: "warning", text: "ตรวจช่องที่มีข้อความสีแดงก่อนบันทึก" }); return }
    if (!dirty) return
    setSaving(true)
    setMsg(null)
    try {
      const s = await apiAuth("/hr/welfare/settings", { method: "PATCH", body: changes })
      const next = s && typeof s === "object" && Object.keys(s).length ? s : { ...orig, ...changes }
      setOrig(next)
      setForm(toForm(next))
      toast.success("บันทึกการตั้งค่าสวัสดิการแล้ว", { description: "มีผลกับคำขอที่บันทึก/อนุมัติหลังจากนี้" })
    } catch (err) {
      setMsg({ tone: "error", text: apiDetail(err) || "บันทึกไม่สำเร็จ" })
    } finally {
      setSaving(false)
    }
  }

  return (
    <section aria-labelledby={`${uid}-h`} className="space-y-4">
      <div>
        <h2 id={`${uid}-h`} className="text-base font-semibold text-gray-900 dark:text-gray-100">วงเงินและการจ่าย</h2>
        <p className="text-sm text-gray-500 dark:text-gray-400">ตามระเบียบ 13 ค่ารักษาพยาบาล (2561) — เปลี่ยนแล้วมีผลกับคำขอที่บันทึกหลังจากนี้</p>
      </div>

      {error ? <ErrorState message={error} onRetry={load} /> : loading ? <SkeletonText lines={6} /> : (
        <form className="space-y-6" onSubmit={(e) => { e.preventDefault(); save() }} noValidate>
          <fieldset disabled={!canEdit || saving} className="grid gap-x-6 gap-y-4 sm:grid-cols-2 xl:grid-cols-3">
            <legend className="sr-only">วงเงิน</legend>
            {CAP_FIELDS.map((f) => {
              const id = `${uid}-${f.key}`
              const desc = [f.hint ? `${id}-hint` : null, errors[f.key] ? `${id}-err` : null].filter(Boolean).join(" ") || undefined
              return (
                <div key={f.key}>
                  <label htmlFor={id} className={cx(labelCls, "md:!text-sm")}>{f.label}</label>
                  <div className="relative">
                    <input id={id} type="number" inputMode={f.integer ? "numeric" : "decimal"} min="0" step={f.integer ? "1" : "0.01"}
                      value={form[f.key]} onChange={(e) => set(f.key)(e.target.value)}
                      aria-invalid={errors[f.key] ? true : undefined} aria-describedby={desc}
                      className={cx(inputCls, "!pr-16", errors[f.key] && "!border-red-500 dark:!border-red-400")} />
                    <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-xs text-gray-500 dark:text-gray-400">{f.unit}</span>
                  </div>
                  {f.hint && <p id={`${id}-hint`} className={cx(helpTextCls, "md:text-xs")}>{f.hint}</p>}
                  {errors[f.key] && <p id={`${id}-err`} className={errorTextCls}>{errors[f.key]}</p>}
                </div>
              )
            })}
          </fieldset>

          <div className="divide-y divide-gray-100 border-y border-gray-100 dark:divide-line dark:border-line">
            <Toggle id={`${uid}-chk`} checked={form.checkup_in_medical_cap} onChange={set("checkup_in_medical_cap")} disabled={!canEdit || saving}
              label="นับค่าตรวจสุขภาพรวมในวงเงินค่ารักษาพยาบาล"
              hint={`ปิด = ตรวจสุขภาพแยกนอกวงเงิน ${money(Number(form.medical_annual_cap) || 0)} บาท (ค่าเริ่มต้น)`} />
            <Toggle id={`${uid}-board`} checked={form.board_required} onChange={set("board_required")} disabled={!canEdit || saving}
              label="ต้องผ่านมติคณะกรรมการก่อนจ่าย"
              hint="เปิด = หลังผู้จัดการอนุมัติ ต้องบันทึกเลขที่และวันที่ประชุมก่อนจึงจ่ายได้" />
          </div>

          <Segmented name={`${uid}-route`} legend="เส้นทางการจ่ายเงิน" disabled={!canEdit || saving}
            options={PAYOUT_ROUTES.map((r) => ({ value: r.value, label: r.label }))}
            value={form.payout_route} onChange={set("payout_route")} className="max-w-md" />
          <p className="-mt-4 text-xs text-gray-500 dark:text-gray-400">
            {PAYOUT_ROUTES.find((r) => r.value === form.payout_route)?.hint} · กำหนดให้แต่ละคำขอตอนผู้จัดการอนุมัติ
          </p>

          {msg && <StatusMsg msg={msg} />}
          {canEdit ? (
            <div className="flex flex-wrap items-center gap-2">
              <button type="submit" disabled={saving || !dirty} className={saveBtn}>{saving ? "กำลังบันทึก…" : "บันทึกการตั้งค่า"}</button>
              {dirty && !saving && (
                <button type="button" onClick={() => { setForm(toForm(orig)); setErrors({}); setMsg(null) }} className={neutralBtnCls}>ยกเลิกการแก้ไข</button>
              )}
            </div>
          ) : (
            <p className="text-xs text-gray-500 dark:text-gray-400">บัญชีนี้ดูได้อย่างเดียว — การแก้ไขทำโดยฝ่ายบุคคล</p>
          )}
        </form>
      )}
    </section>
  )
}

// ─── อัตราค่าการศึกษาบุตร ────────────────────────────────────────────────────

function RatesSection({ canEdit }) {
  const uid = useId()
  const [rows, setRows] = useState([])    // ต้นฉบับจาก backend
  const [vals, setVals] = useState({})    // index → string
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState(null)

  const fill = (list) => {
    setRows(list)
    setVals(Object.fromEntries(list.map((r, i) => [i, r[rateAmountKey(r)] != null ? String(Number(r[rateAmountKey(r)])) : ""])))
  }

  const load = useCallback(async () => {
    setLoading(true)
    setError("")
    try {
      const d = await apiAuth("/hr/welfare/education-rates")
      fill(Array.isArray(d) ? d : d?.items ?? d?.rates ?? [])
    } catch (err) {
      setError(apiDetail(err) || "โหลดอัตราค่าการศึกษาไม่สำเร็จ")
    } finally {
      setLoading(false)
    }
  }, [])
  useEffect(() => { load() }, [load])

  // ระดับ → { label, gov: index, private: index }
  const levels = useMemo(() => {
    const map = new Map()
    rows.forEach((r, i) => {
      const lv = Number(r.level)
      if (!map.has(lv)) map.set(lv, { level: lv, label: r.level_label || educationLevelLabel(lv) })
      map.get(lv)[r[rateInstKey(r)]] = i
    })
    return [...map.values()].sort((a, b) => a.level - b.level)
  }, [rows])

  const invalid = Object.entries(vals).filter(([, v]) => v === "" || !Number.isFinite(Number(v)) || Number(v) < 0).map(([i]) => Number(i))
  const dirty = rows.some((r, i) => Number(r[rateAmountKey(r)]) !== Number(vals[i]))

  const save = async () => {
    if (invalid.length) { setMsg({ tone: "warning", text: "กรอกอัตราเป็นตัวเลขตั้งแต่ 0 ขึ้นไปให้ครบทุกช่อง" }); return }
    const body = rows.map((r, i) => ({ ...r, [rateAmountKey(r)]: Number(vals[i]) }))
    setSaving(true)
    setMsg(null)
    try {
      const d = await apiAuth("/hr/welfare/education-rates", { method: "PUT", body })
      fill(Array.isArray(d) && d.length ? d : body)
      toast.success("บันทึกอัตราค่าการศึกษาแล้ว")
    } catch (err) {
      setMsg({ tone: "error", text: apiDetail(err) || "บันทึกไม่สำเร็จ" })
    } finally {
      setSaving(false)
    }
  }

  const cell = (idx, label) => {
    if (idx == null) return <span className="text-gray-400 dark:text-gray-500">—</span>
    const bad = invalid.includes(idx)
    if (!canEdit) return <span className="tabular-nums text-gray-900 dark:text-gray-100">{money(vals[idx])}</span>
    return (
      <input type="number" inputMode="decimal" min="0" step="1" value={vals[idx] ?? ""} disabled={saving}
        onChange={(e) => { setVals((v) => ({ ...v, [idx]: e.target.value })); setMsg(null) }}
        aria-label={label} aria-invalid={bad || undefined}
        className={cx(cellInput, "!ml-auto !w-32 !py-1.5", bad && "!border-red-500 dark:!border-red-400")} />
    )
  }

  return (
    <section aria-labelledby={`${uid}-h`} className="space-y-4">
      <div>
        <h2 id={`${uid}-h`} className="text-base font-semibold text-gray-900 dark:text-gray-100">อัตราค่าการศึกษาบุตร</h2>
        <p className="text-sm text-gray-500 dark:text-gray-400">ระเบียบ 14 (2561) — เพดานต่อบุตร 1 คน ต่อปีการศึกษา (บาท)</p>
      </div>
      {error ? <ErrorState message={error} onRetry={load} /> : loading ? <SkeletonText lines={6} /> : rows.length === 0 ? (
        <p className="text-sm text-gray-500 dark:text-gray-400">ยังไม่มีอัตราในระบบ</p>
      ) : (
        <div className="space-y-4">
          <div className="max-w-2xl overflow-x-auto rounded-xl ring-1 ring-gray-200/70 dark:ring-line">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50 text-xs font-semibold text-gray-500 dark:border-line dark:bg-white/[.03] dark:text-gray-400">
                  <th scope="col" className="px-4 py-2.5 text-left">ระดับ</th>
                  <th scope="col" className="px-4 py-2.5 text-right">สถานศึกษารัฐ</th>
                  <th scope="col" className="px-4 py-2.5 text-right">สถานศึกษาเอกชน</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-line">
                {levels.map((l) => (
                  <tr key={l.level}>
                    <th scope="row" className="px-4 py-2 text-left font-normal text-gray-800 dark:text-gray-200">
                      {l.label}
                      {l.level === 6 && <span className="block text-xs text-gray-500 dark:text-gray-400">เฉพาะปริญญาใบแรก</span>}
                    </th>
                    <td className="px-4 py-2 text-right">{cell(l.gov, `${l.label} สถานศึกษารัฐ (บาท)`)}</td>
                    <td className="px-4 py-2 text-right">{cell(l.private, `${l.label} สถานศึกษาเอกชน (บาท)`)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {msg && <StatusMsg msg={msg} />}
          {canEdit && (
            <div className="flex flex-wrap items-center gap-2">
              <button type="button" onClick={save} disabled={saving || !dirty} className={saveBtn}>{saving ? "กำลังบันทึก…" : "บันทึกอัตรา"}</button>
              {dirty && !saving && <button type="button" onClick={() => { fill(rows); setMsg(null) }} className={neutralBtnCls}>ยกเลิกการแก้ไข</button>}
            </div>
          )}
        </div>
      )}
    </section>
  )
}

export default function HRWelfareSettingsTab() {
  const { can } = useCan()
  const canEdit = can("hr.welfare.settings")
  return (
    <div className="space-y-8">
      <SettingsSection canEdit={canEdit} />
      <div className="border-t border-gray-100 dark:border-line" />
      <RatesSection canEdit={canEdit} />
    </div>
  )
}
