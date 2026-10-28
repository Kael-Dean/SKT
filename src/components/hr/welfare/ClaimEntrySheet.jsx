// src/components/hr/welfare/ClaimEntrySheet.jsx
// ─────────────────────────────────────────────────────────────────────────────
// HR บันทึกคำขอเบิกสวัสดิการจากแบบฟอร์มกระดาษ (3P B3)
//   POST /hr/welfare/claims/preview   (ไม่บันทึก) → { cap_year, requested_amount, eligible_amount }
//   POST /hr/welfare/claims           (hr.welfare.submit)
//   GET  /hr/employees/{id}/dependants          — ตัวเลือกผู้รับบริการ + เหตุผลไม่มีสิทธิ์
//   GET  /hr/employees/{id}/welfare-balance     — การ์ดสิทธิ์คงเหลือข้างฟอร์ม
//
// พรีวิวยิงเมื่อช่องบังคับครบ (debounce 450ms, ทิ้งคำตอบเก่า) → "เบิกได้ตามสิทธิ์ X บาท"
// ตามสิทธิ์ < ขอเบิก → เตือน (บันทึกได้ ผจก. ตัดสินต่อ) · 422 ภาษาไทย (ไม่มีสิทธิ์ ฯลฯ) แสดงตามที่ส่งมา
// เลขการคำนวณช่วงนอน 30/15 วัน, ส่วนต่างสิทธิ์อื่น, คู่สมรสทำงานที่เดียวกัน — HR คิดเองแล้วกรอกยอด (นอกขอบเขต)
// ─────────────────────────────────────────────────────────────────────────────
import { useEffect, useId, useMemo, useRef, useState } from "react"
import { TriangleAlert } from "lucide-react"
import { apiAuth } from "../../../lib/api"
import { apiDetail } from "../../../lib/apiErrors"
import { cx, baseField, errorTextCls, helpTextCls, labelCls, neutralBtnCls, submitBtnCls } from "../../../lib/styles"
import {
  CLAIM_TYPES, EMPTY_CLAIM, FACILITY_TYPES, INSTITUTION_TYPES, PATIENT_TYPES,
  buildClaimBody, claimReadyForPreview, currentAcademicYearBE, dependantMeta, dependantName,
  educationLevelLabel, money, requestedOf, sortDependants, validateClaim,
} from "../../../lib/welfare"
import { Sheet, toast } from "../../ui"
import SelectDropdown from "../../SelectDropdown"
import ThaiDateField from "../../ThaiDateField"
import EmployeePicker from "../EmployeePicker"
import StatusMsg from "../StatusMsg"
import Segmented from "./Segmented"
import WelfareBalanceCard from "./WelfareBalanceCard"

const inputCls = cx(baseField, "!rounded-lg !px-3 !py-2 md:!text-sm")
const dateCls = "!rounded-lg !px-3 !py-2 md:!text-sm"
const btnCls = "h-12 md:h-10 md:!px-5 md:!py-0 md:!text-sm"
const errBorder = "!border-red-500 dark:!border-red-400"
const Req = () => <span className="text-red-600 dark:text-red-400" aria-hidden="true"> *</span>

/** ช่องตัวเลขเงิน */
function MoneyField({ id, label, value, onChange, error, hint, required, placeholder = "0.00", integer = false }) {
  const describedBy = [hint ? `${id}-hint` : null, error ? `${id}-err` : null].filter(Boolean).join(" ") || undefined
  return (
    <div>
      <label htmlFor={id} className={cx(labelCls, "md:!text-sm")}>{label}{required && <Req />}</label>
      <input id={id} type="number" inputMode={integer ? "numeric" : "decimal"} min="0" step={integer ? "1" : "0.01"}
        value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} required={required}
        aria-invalid={error ? true : undefined} aria-describedby={describedBy}
        className={cx(inputCls, "tabular-nums", error && errBorder)} />
      {hint && <p id={`${id}-hint`} className={cx(helpTextCls, "md:text-xs")}>{hint}</p>}
      {error && <p id={`${id}-err`} className={errorTextCls}>{error}</p>}
    </div>
  )
}

/** แถบผลพรีวิว — อยู่ใน footer ให้เห็นตลอดทั้งมือถือ/desktop */
function PreviewLine({ preview, requested }) {
  if (preview.state === "idle") {
    return <p className="text-sm text-gray-500 dark:text-gray-400">กรอกช่องที่มี * ให้ครบเพื่อดูยอดที่เบิกได้</p>
  }
  if (preview.state === "loading" && !preview.data) {
    return <p className="text-sm text-gray-500 dark:text-gray-400" role="status">กำลังคำนวณสิทธิ์…</p>
  }
  if (preview.state === "error") {
    return (
      <p className="flex items-start gap-1.5 text-sm font-medium text-red-700 dark:text-red-300" role="alert">
        <TriangleAlert aria-hidden="true" className="mt-0.5 size-4 shrink-0" />{preview.error}
      </p>
    )
  }
  const d = preview.data || {}
  const req = Number(d.requested_amount ?? requested)
  const elig = Number(d.eligible_amount ?? 0)
  const capped = elig < req
  return (
    <div role="status" aria-live="polite" className={cx("transition-opacity duration-150", preview.state === "loading" && "opacity-60")}>
      <p className="text-sm text-gray-700 dark:text-gray-300">
        เบิกได้ตามสิทธิ์{" "}
        <strong className={cx("text-lg tabular-nums", capped ? "text-amber-700 dark:text-amber-300" : "text-emerald-700 dark:text-emerald-300")}>{money(elig)}</strong> บาท
        {d.cap_year && <span className="text-xs text-gray-500 dark:text-gray-400"> · วงเงินปี {d.cap_year}</span>}
      </p>
      {capped && (
        <p className="flex items-start gap-1.5 text-xs text-amber-800 dark:text-amber-200">
          <TriangleAlert aria-hidden="true" className="mt-px size-3.5 shrink-0" />
          ต่ำกว่าที่ขอ {money(req)} บาท — บันทึกได้ ผู้จัดการพิจารณาต่อ{elig <= 0 ? " (วงเงินหมดแล้ว)" : ""}
        </p>
      )}
    </div>
  )
}

/**
 * @param {{ open: boolean, onClose: () => void, onSaved?: (claim: object) => void,
 *           initialUserId?: string, educationRates?: object[] }} props
 */
export default function ClaimEntrySheet({ open, onClose, onSaved, initialUserId = "", educationRates = [] }) {
  const uid = useId()
  const [form, setForm] = useState(() => ({ ...EMPTY_CLAIM, user_id: initialUserId, academic_year: String(currentAcademicYearBE()) }))
  const [personName, setPersonName] = useState("")
  const [errors, setErrors] = useState({})
  const [deps, setDeps] = useState({ userId: null, rows: [], error: "" })
  const [preview, setPreview] = useState({ state: "idle", data: null, error: "" })
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState(null)
  const seq = useRef(0)

  const set = (k) => (v) => {
    setForm((p) => ({ ...p, [k]: v }))
    if (errors[k]) setErrors((e) => ({ ...e, [k]: undefined }))
  }

  // ผู้มีสิทธิ์ของเจ้าหน้าที่ที่เลือก
  useEffect(() => {
    if (!form.user_id) return
    let alive = true
    apiAuth(`/hr/employees/${encodeURIComponent(form.user_id)}/dependants`)
      .then((d) => { if (alive) setDeps({ userId: form.user_id, rows: sortDependants(Array.isArray(d) ? d : d?.items ?? []), error: "" }) })
      .catch((err) => { if (alive) setDeps({ userId: form.user_id, rows: [], error: apiDetail(err) || "โหลดรายชื่อผู้มีสิทธิ์ไม่สำเร็จ" }) })
    return () => { alive = false }
  }, [form.user_id])
  const depsLoading = !!form.user_id && deps.userId !== form.user_id
  const depRows = useMemo(() => (deps.userId === form.user_id ? deps.rows : []), [deps, form.user_id])

  // พรีวิวสิทธิ์ (debounce)
  const body = useMemo(() => buildClaimBody(form), [form])
  const ready = claimReadyForPreview(form)
  const bodyKey = ready ? JSON.stringify(body) : ""
  useEffect(() => {
    if (!bodyKey) { setPreview({ state: "idle", data: null, error: "" }); return }
    const mine = ++seq.current
    setPreview((p) => ({ ...p, state: "loading", error: "" }))
    const t = setTimeout(() => {
      apiAuth("/hr/welfare/claims/preview", { method: "POST", body: JSON.parse(bodyKey) })
        .then((d) => { if (seq.current === mine) setPreview({ state: "ok", data: d, error: "" }) })
        .catch((err) => { if (seq.current === mine) setPreview({ state: "error", data: null, error: apiDetail(err) || "คำนวณสิทธิ์ไม่สำเร็จ" }) })
    }, 450)
    return () => clearTimeout(t)
  }, [bodyKey])

  const changeType = (t) => {
    setForm((p) => ({
      ...p, claim_type: t, dependant_id: "",
      facility_type: t === "checkup" ? "gov" : p.claim_type === "checkup" ? "" : p.facility_type,
    }))
    setErrors({})
  }

  const save = async () => {
    const errs = validateClaim(form)
    setErrors(errs)
    if (Object.keys(errs).length) {
      setMsg({ tone: "warning", text: "ตรวจช่องที่มีข้อความสีแดงก่อนบันทึก" })
      return
    }
    setSaving(true)
    setMsg(null)
    try {
      const res = await apiAuth("/hr/welfare/claims", { method: "POST", body })
      const capped = res && Number(res.eligible_amount) < Number(res.requested_amount)
      toast.success("บันทึกคำขอเบิกแล้ว", {
        description: `${personName || "เจ้าหน้าที่"} · ตามสิทธิ์ ${money(res?.eligible_amount)} บาท${capped ? " (ต่ำกว่าที่ขอ)" : ""} · รอผู้จัดการอนุมัติ`,
      })
      onSaved?.(res)
      onClose()
    } catch (err) {
      setMsg({ tone: "error", text: apiDetail(err) || "บันทึกไม่สำเร็จ" })
    } finally {
      setSaving(false)
    }
  }

  const id = (k) => `${uid}-${k}`
  const err = (k) => errors[k]
  const errP = (k) => errors[k] && <p id={`${id(k)}-err`} className={errorTextCls}>{errors[k]}</p>
  const t = form.claim_type
  const ipd = form.patient_type === "ipd"

  // ตัวเลือกผู้รับบริการ
  const patientOptions = useMemo(() => {
    if (t === "medical") {
      return [
        { value: "", label: personName ? `${personName} (ตัวเจ้าหน้าที่)` : "ตัวเจ้าหน้าที่เอง", sublabel: "มีสิทธิ์" },
        ...depRows.map((d) => ({
          value: String(d.id),
          label: dependantName(d),
          sublabel: d.medical_eligible ? dependantMeta(d) : `ไม่มีสิทธิ์: ${d.medical_reason || "—"}`,
        })),
      ]
    }
    return depRows.filter((d) => d.relationship === "บุตร").map((d) => ({
      value: String(d.id),
      label: dependantName(d),
      sublabel: d.education_eligible ? dependantMeta(d) : `ไม่มีสิทธิ์: ${d.education_reason || "—"}`,
    }))
  }, [t, depRows, personName])
  const pickedDep = depRows.find((d) => String(d.id) === String(form.dependant_id))
  const pickedReason = pickedDep && (t === "medical" ? (!pickedDep.medical_eligible && pickedDep.medical_reason) : (!pickedDep.education_eligible && pickedDep.education_reason))

  // อัตราเพดานค่าการศึกษาของระดับ/ประเภทที่เลือก (ถ้าโหลดตารางมาแล้ว)
  const levelOptions = useMemo(() => {
    const seen = new Map()
    for (const r of educationRates) if (r?.level != null && !seen.has(Number(r.level))) seen.set(Number(r.level), r.level_label)
    const levels = seen.size ? [...seen.entries()].sort((a, b) => a[0] - b[0]) : [1, 2, 3, 4, 5, 6].map((lv) => [lv, null])
    return levels.map(([lv, lbl]) => ({ value: String(lv), label: lbl || educationLevelLabel(lv) }))
  }, [educationRates])
  const rateCap = useMemo(() => {
    if (!form.education_level || !form.institution_type) return null
    const r = educationRates.find((x) => Number(x.level) === Number(form.education_level) &&
      (x.institution_type ?? x.school_type ?? x.type) === form.institution_type)
    if (!r) return null
    const v = r.cap ?? r.amount ?? r.rate ?? r.max_amount ?? r.cap_amount
    return v != null ? Number(v) : null
  }, [educationRates, form.education_level, form.institution_type])

  const balanceAcademicYear = t === "education" && /^25\d\d$/.test(form.academic_year) ? form.academic_year : currentAcademicYearBE()

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title="บันทึกคำขอเบิกสวัสดิการ"
      subtitle="กรอกจากแบบฟอร์มที่เจ้าหน้าที่ยื่น"
      size="full"
      busy={saving}
      initialFocus={initialUserId ? undefined : null}
      footer={
        <div className="space-y-3 md:flex md:items-center md:justify-between md:gap-4 md:space-y-0">
          <div className="min-w-0 md:flex-1"><PreviewLine preview={preview} requested={requestedOf(form)} /></div>
          <div className="grid grid-cols-2 gap-3 md:flex md:shrink-0 md:gap-2">
            <button type="button" onClick={onClose} disabled={saving} className={cx(neutralBtnCls, btnCls)}>ยกเลิก</button>
            <button type="button" onClick={save} disabled={saving} className={cx(submitBtnCls, btnCls, "!rounded-xl")}>
              {saving ? "กำลังบันทึก…" : "บันทึกคำขอ"}
            </button>
          </div>
        </div>
      }
    >
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_18rem]">
        <form className="min-w-0 space-y-5" onSubmit={(e) => { e.preventDefault(); save() }} noValidate>
          <div>
            <EmployeePicker
              id={id("emp")}
              label={<>เจ้าหน้าที่ผู้ขอเบิก<Req /></>}
              value={form.user_id}
              onChange={(v, p) => {
                setForm((f) => ({ ...f, user_id: v, dependant_id: "" }))
                setPersonName(p ? [p.first_name, p.last_name].filter(Boolean).join(" ") : "")
                setErrors((e) => ({ ...e, user_id: undefined }))
              }}
              className="!max-w-none"
            />
            {errP("user_id")}
          </div>

          <Segmented name={id("type")} legend="ประเภทคำขอ" required options={CLAIM_TYPES} value={t} onChange={changeType} />

          {/* ผู้รับบริการ */}
          {t === "checkup" ? (
            <p className="rounded-xl bg-gray-50 p-3 text-sm text-gray-600 dark:bg-white/[.03] dark:text-gray-300">
              ตรวจสุขภาพเบิกได้เฉพาะตัวเจ้าหน้าที่ ปีละ 1 ครั้ง ที่สถานพยาบาลรัฐเท่านั้น
            </p>
          ) : (
            <div>
              <span id={`${id("dep")}-label`} className={cx(labelCls, "md:!text-sm")}>
                {t === "education" ? "บุตรที่เบิก" : "ผู้รับการรักษา"}{t === "education" && <Req />}
              </span>
              <SelectDropdown
                id={id("dep")} size="sm" showSwatch={false} showSublabelInTrigger
                ariaLabelledby={`${id("dep")}-label`}
                ariaDescribedby={[errors.dependant_id ? `${id("dependant_id")}-err` : null, pickedReason ? `${id("dep")}-why` : null].filter(Boolean).join(" ") || undefined}
                options={patientOptions} value={form.dependant_id} onChange={set("dependant_id")}
                disabled={!form.user_id} loading={depsLoading} error={!!err("dependant_id")}
                placeholder={!form.user_id ? "เลือกเจ้าหน้าที่ก่อน" : t === "education" ? (patientOptions.length ? "เลือกบุตร" : "ยังไม่มีบุตรในทะเบียน") : "เลือกผู้รับการรักษา"}
              />
              {errP("dependant_id")}
              {deps.error && <p className={errorTextCls} role="alert">{deps.error}</p>}
              {pickedReason && (
                <p id={`${id("dep")}-why`} className="mt-1 flex items-start gap-1.5 text-sm text-amber-800 dark:text-amber-200">
                  <TriangleAlert aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
                  ไม่มีสิทธิ์: {pickedReason}
                </p>
              )}
              {form.user_id && !depsLoading && !depRows.length && !deps.error && (
                <p className={cx(helpTextCls, "md:text-xs")}>ยังไม่มีครอบครัวในทะเบียน — เพิ่มได้ที่โปรไฟล์พนักงาน ช่อง “ผู้มีสิทธิ์รับสวัสดิการ”</p>
              )}
            </div>
          )}

          {/* ค่ารักษาพยาบาล / ตรวจสุขภาพ */}
          {t !== "education" && (
            <div className="space-y-4">
              <div className={cx("grid gap-4", t === "medical" && "sm:grid-cols-2")}>
                <Segmented name={id("fac")} legend="สถานพยาบาล" required options={FACILITY_TYPES}
                  value={form.facility_type} onChange={set("facility_type")}
                  error={err("facility_type")} errorId={`${id("facility_type")}-err`} />
                {t === "medical" && (
                  <Segmented name={id("pt")} legend="ประเภทผู้ป่วย" required options={PATIENT_TYPES}
                    value={form.patient_type} onChange={set("patient_type")}
                    error={err("patient_type")} errorId={`${id("patient_type")}-err`} />
                )}
              </div>
              {t === "checkup" && form.facility_type === "private" && (
                <StatusMsg msg={{ tone: "warning", text: "ตรวจสุขภาพที่สถานพยาบาลเอกชนเบิกไม่ได้ตามระเบียบ" }} />
              )}

              <div className={cx("grid gap-4", t === "medical" && ipd && "sm:grid-cols-2")}>
                <div>
                  <label htmlFor={id("sd")} className={cx(labelCls, "md:!text-sm")}>
                    {t === "checkup" ? "วันที่ตรวจ" : ipd ? "วันที่เข้ารักษา" : "วันที่รับบริการ"}<Req />
                  </label>
                  <ThaiDateField id={id("sd")} value={form.service_date} onChange={(e) => set("service_date")(e.target.value)}
                    error={!!err("service_date")} aria-describedby={errors.service_date ? `${id("service_date")}-err` : undefined} className={dateCls} />
                  {errP("service_date")}
                </div>
                {t === "medical" && ipd && (
                  <div>
                    <label htmlFor={id("dc")} className={cx(labelCls, "md:!text-sm")}>วันที่ออกจากโรงพยาบาล</label>
                    <ThaiDateField id={id("dc")} value={form.discharge_date} onChange={(e) => set("discharge_date")(e.target.value)}
                      error={!!err("discharge_date")} aria-describedby={errors.discharge_date ? `${id("discharge_date")}-err` : undefined} className={dateCls} />
                    {errP("discharge_date")}
                  </div>
                )}
              </div>

              {t === "medical" ? (
                <div className={cx("grid gap-4", ipd && "sm:grid-cols-3")}>
                  <MoneyField id={id("treatment_amount")} label="ค่ารักษา (บาท)" required value={form.treatment_amount} onChange={set("treatment_amount")}
                    error={err("treatment_amount")} hint={ipd ? "ไม่รวมค่าห้องและค่าอาหาร" : undefined} />
                  {ipd && (
                    <>
                      <MoneyField id={id("room_days")} label="จำนวนวันนอน" integer placeholder="0" value={form.room_days} onChange={set("room_days")} error={err("room_days")} />
                      <MoneyField id={id("room_amount")} label="ค่าห้อง + อาหาร (บาท)" value={form.room_amount} onChange={set("room_amount")}
                        error={err("room_amount")} hint={form.facility_type === "private" ? "เอกชนเบิกได้ไม่เกินวันละ 600 บาท" : "รพ.รัฐ: ใช้อัตราของกระทรวงการคลัง"} />
                    </>
                  )}
                </div>
              ) : (
                <MoneyField id={id("checkup_amount")} label="ค่าตรวจสุขภาพ (บาท)" required value={form.checkup_amount} onChange={set("checkup_amount")} error={err("checkup_amount")} />
              )}
            </div>
          )}

          {/* ค่าการศึกษาบุตร */}
          {t === "education" && (
            <div className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label htmlFor={id("ay")} className={cx(labelCls, "md:!text-sm")}>ปีการศึกษา (พ.ศ.)<Req /></label>
                  <input id={id("ay")} type="text" inputMode="numeric" maxLength={4} value={form.academic_year}
                    onChange={(e) => set("academic_year")(e.target.value.replace(/\D/g, ""))}
                    aria-invalid={err("academic_year") ? true : undefined} aria-describedby={errors.academic_year ? `${id("academic_year")}-err` : undefined}
                    className={cx(inputCls, "tabular-nums", err("academic_year") && errBorder)} />
                  {errP("academic_year")}
                </div>
                <Segmented name={id("inst")} legend="สถานศึกษา" required options={INSTITUTION_TYPES}
                  value={form.institution_type} onChange={set("institution_type")}
                  error={err("institution_type")} errorId={`${id("institution_type")}-err`} />
              </div>
              <div>
                <label htmlFor={id("iname")} className={cx(labelCls, "md:!text-sm")}>ชื่อสถานศึกษา</label>
                <input id={id("iname")} value={form.institution_name} onChange={(e) => set("institution_name")(e.target.value)} className={inputCls} placeholder="เช่น โรงเรียนสุรวิทยาคาร" />
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <span id={`${id("lv")}-label`} className={cx(labelCls, "md:!text-sm")}>ระดับการศึกษา<Req /></span>
                  <SelectDropdown id={id("lv")} size="sm" showSwatch={false} required
                    ariaLabelledby={`${id("lv")}-label`} ariaDescribedby={errors.education_level ? `${id("education_level")}-err` : undefined}
                    options={levelOptions} value={form.education_level} onChange={set("education_level")}
                    error={!!err("education_level")} placeholder="เลือกระดับ" />
                  {errP("education_level")}
                </div>
                <MoneyField id={id("education_amount")} label="ค่าการศึกษาตามใบเสร็จ (บาท)" required value={form.education_amount} onChange={set("education_amount")}
                  error={err("education_amount")} hint={rateCap != null ? `เพดานระดับนี้ ${money(rateCap)} บาท ต่อปีการศึกษา` : undefined} />
              </div>
              {Number(form.education_level) === 6 && (
                <div>
                  <div className="flex items-start gap-3">
                    <input id={id("fd")} type="checkbox" checked={form.first_degree} onChange={(e) => set("first_degree")(e.target.checked)}
                      aria-invalid={err("first_degree") ? true : undefined} aria-describedby={errors.first_degree ? `${id("first_degree")}-err` : undefined}
                      className="mt-0.5 size-5 shrink-0 cursor-pointer rounded accent-indigo-600 md:size-4" />
                    <label htmlFor={id("fd")} className="cursor-pointer text-sm text-gray-800 dark:text-gray-200">เป็นปริญญาตรีใบแรกของบุตร<Req /></label>
                  </div>
                  {errP("first_degree")}
                </div>
              )}
            </div>
          )}

          {/* ใบเสร็จ */}
          <fieldset className="space-y-4 border-t border-gray-100 pt-4 dark:border-line">
            <legend className="sr-only">ใบเสร็จรับเงิน</legend>
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label htmlFor={id("rno")} className={cx(labelCls, "md:!text-sm")}>เลขที่ใบเสร็จ</label>
                <input id={id("rno")} value={form.receipt_no} onChange={(e) => set("receipt_no")(e.target.value)} className={inputCls} autoComplete="off" />
              </div>
              <div>
                <label htmlFor={id("rdate")} className={cx(labelCls, "md:!text-sm")}>วันที่ในใบเสร็จ</label>
                <ThaiDateField id={id("rdate")} value={form.receipt_date} onChange={(e) => set("receipt_date")(e.target.value)} className={dateCls} />
              </div>
            </div>
            <div>
              <label htmlFor={id("note")} className={cx(labelCls, "md:!text-sm")}>หมายเหตุ</label>
              <textarea id={id("note")} rows={2} value={form.note} onChange={(e) => set("note")(e.target.value)} className={cx(inputCls, "resize-y")}
                placeholder="เช่น ยอดหลังหักส่วนที่เบิกจากสิทธิ์อื่นแล้ว" />
            </div>
          </fieldset>

          {msg && <StatusMsg msg={msg} />}
          <button type="submit" hidden aria-hidden="true" tabIndex={-1} />
        </form>

        <aside className="min-w-0 lg:sticky lg:top-0 lg:self-start">
          <WelfareBalanceCard
            employeeId={form.user_id || null}
            academicYear={t === "education" ? balanceAcademicYear : undefined}
            compact
            className="!bg-gray-50 !shadow-none !ring-0 dark:!bg-white/[.03]"
          />
        </aside>
      </div>
    </Sheet>
  )
}
