// src/components/hr/discipline/RecordForm.jsx
// ─────────────────────────────────────────────────────────────────────────────
// "บันทึกวินัยและโทษทางวินัย" (AMC 2026-11-16) — ผลการสอบสวนนอกระบบ + โทษ · ปิดเรื่อง
//   POST /hr/discipline/cases/{id}/record → 201 { record, case, action, termination_prefill, payroll_recalculated, warnings }
//   สิทธิ์: discipline.record_outcome ที่ขั้นผู้จัดการ (case.can_record_outcome)
//
// หน้าเดียว 5 ส่วน (ตรงกับ PDF): ข้อเท็จจริง · การสอบสวน · มติ/คำสั่ง · การแจ้งผล · เอกสารแนบ
// validation ตาม "Validation Rules" ใน handoff — server ตรวจซ้ำ (422) และ detail แสดงตามที่ส่งมา
//
//   <RecordForm formId c settings uploads onBusy={(b)=>…} onSaved={(res)=>…} />
//   ปุ่มบันทึกอยู่ใน footer ของ Sheet (form={formId})
// ─────────────────────────────────────────────────────────────────────────────
import { useId, useMemo, useState } from "react"
import { Plus, Trash2 } from "lucide-react"
import { apiAuth } from "../../../lib/api"
import { apiDetail } from "../../../lib/apiErrors"
import {
  APPOINTED_BY, COMMITTEE_MIN_MEMBERS, FINDINGS, MEMBER_ROLES, NO_COMMITTEE_REASONS, ORDERED_BY, PENALTIES,
  asArray, inclusiveDays, isTerminationPenalty, nowBangkok,
} from "../../../lib/discipline"
import { cx, baseField, errorTextCls, focusRingCls } from "../../../lib/styles"
import SelectDropdown from "../../SelectDropdown"
import ThaiDateField from "../../ThaiDateField"
import FileUploader from "../../FileUploader"
import ClausePicker from "./ClausePicker"
import { RefusedToggle, WitnessFields } from "./AckSheet"

const inputCls = cx(baseField, "!rounded-lg !px-3 !py-2 md:!text-sm")
const dateCls = "!rounded-lg !px-3 !py-2 md:!text-sm"
const smallLabel = "mb-1 block text-xs font-medium text-gray-600 dark:text-gray-400"
const Req = () => <span className="text-red-600 dark:text-red-400"> *</span>

const bangkokDate = (iso) => {
  if (!iso) return ""
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return String(iso).slice(0, 10)
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Bangkok" }).format(d)
}

const DEFAULT_MEMBERS = () => [
  { name: "", position: "", role: "chair" },
  { name: "", position: "", role: "member" },
  { name: "", position: "", role: "secretary" },
]

function initialState(c) {
  const day = bangkokDate(c?.incident_at)
  return {
    incident_from: day, incident_to: "", place: "", facts: c?.details ?? "", related_law: "", external_evidence: "",
    clause_ids: asArray(c?.default_clauses).map((x) => Number(x.id)),
    committee_appointed: true, no_committee_reason: "", appointed_by: "", appointment_order_no: "", appointment_order_date: "",
    members: DEFAULT_MEMBERS(), investigation_finished_on: "", statement_count: "", finding: "", investigation_summary: "",
    ordered_by: "", resolution_no: "", resolution_date: "", penalty: "", effective_date: "",
    probation_terms: "", suspension_start: "", suspension_end: "", suspension_consent: false,
    severance_paid: null, final_wage_through: "", final_wage_paid_on: "", damages_amount: "", damages_due: "",
    notified_on: "", refused_to_sign: false, witness_1: "", witness_2: "",
  }
}

/** ตรวจตาม handoff → { field: message } (ลำดับ key = ลำดับบนจอ ใช้ focus ช่องแรกที่ผิด) */
function validate(f, settings) {
  const e = {}
  const today = nowBangkok().date
  const future = (d) => d && d > today
  if (f.incident_from && f.incident_to && f.incident_to < f.incident_from) e.incident_to = "วันสิ้นสุดต้องไม่ก่อนวันเริ่ม"
  if (!f.facts.trim()) e.facts = "ระบุพฤติการณ์/ข้อเท็จจริง"
  if (f.finding === "guilty" && !f.clause_ids.length) e.clause_ids = "เลือกข้อระเบียบที่ฝ่าฝืนอย่างน้อย 1 ข้อ"

  if (f.committee_appointed) {
    if (!f.appointed_by) e.appointed_by = "เลือกผู้แต่งตั้ง"
    if (!f.appointment_order_no.trim()) e.appointment_order_no = "ระบุเลขที่คำสั่งแต่งตั้ง"
    if (!f.appointment_order_date) e.appointment_order_date = "ระบุวันที่คำสั่ง"
    const filled = f.members.filter((m) => m.name.trim())
    if (filled.length < COMMITTEE_MIN_MEMBERS) e.members = `คณะกรรมการสอบสวนต้องมีอย่างน้อย ${COMMITTEE_MIN_MEMBERS} คน (ข้อ 57)`
    else if (f.members.some((m) => !m.name.trim() && (m.position.trim()))) e.members = "ระบุชื่อกรรมการให้ครบทุกแถว หรือลบแถวที่ว่าง"
    if (!f.investigation_finished_on) e.investigation_finished_on = "ระบุวันที่สอบสวนเสร็จ"
    else if (f.appointment_order_date && f.investigation_finished_on < f.appointment_order_date) e.investigation_finished_on = "ต้องไม่ก่อนวันที่คำสั่งแต่งตั้ง"
  } else if (!f.no_committee_reason) {
    e.no_committee_reason = "เลือกเหตุที่ไม่ต้องตั้งคณะกรรมการ"
  }
  if (!e.investigation_finished_on && future(f.investigation_finished_on)) e.investigation_finished_on = "ต้องไม่เป็นวันในอนาคต"
  if (f.statement_count !== "" && !(Number.isInteger(Number(f.statement_count)) && Number(f.statement_count) >= 0)) e.statement_count = "กรอกจำนวนเต็ม"
  if (!f.finding) e.finding = "เลือกผลการสอบสวน"
  if (!f.investigation_summary.trim()) e.investigation_summary = "ระบุสรุปผลการสอบสวน"

  if (f.finding === "guilty") {
    if (!f.ordered_by) e.ordered_by = "เลือกผู้มีอำนาจสั่ง"
    if (!f.resolution_no.trim()) e.resolution_no = "ระบุเลขที่มติ/คำสั่ง"
    if (!f.resolution_date) e.resolution_date = "ระบุวันที่มติ/คำสั่ง"
    else if (future(f.resolution_date)) e.resolution_date = "ต้องไม่เป็นวันในอนาคต"
    if (!f.penalty) e.penalty = "เลือกโทษ"
    if (!f.effective_date) e.effective_date = "ระบุวันที่มีผล"
    if (isTerminationPenalty(f.penalty) && !f.committee_appointed && f.no_committee_reason === "below_discharge") {
      e.no_committee_reason = "ให้ออก/ไล่ออกโดยไม่ตั้งคณะกรรมการ ต้องเป็นเหตุตามข้อ 58 เท่านั้น"
    }
    if (f.penalty === "suspension") {
      const days = inclusiveDays(f.suspension_start, f.suspension_end)
      const minD = settings?.suspension_min_days ?? 1
      const maxD = settings?.suspension_max_days ?? 7
      if (!f.suspension_start || !f.suspension_end) e.suspension_start = "ระบุวันเริ่มและวันสุดท้ายของการพักงาน"
      else if (!days) e.suspension_start = "วันสุดท้ายต้องไม่ก่อนวันเริ่ม"
      else if (days < minD || days > maxD) e.suspension_start = `พักงานได้ ${minD}–${maxD} วัน (เลือกไว้ ${days} วัน)`
      if (!f.suspension_consent) e.suspension_consent = "ต้องได้รับความยินยอมเป็นหนังสือก่อนพักงาน (ข้อ 60)"
    }
    if (isTerminationPenalty(f.penalty) && f.damages_amount !== "" && !(Number(f.damages_amount) >= 0)) e.damages_amount = "กรอกจำนวนเงินไม่ติดลบ"
  }
  if (future(f.notified_on)) e.notified_on = "ต้องไม่เป็นวันในอนาคต"
  return e
}

/** ฟอร์ม → body ตาม handoff (ไม่ส่ง key ที่ไม่เกี่ยวกับกรณี — not_guilty ต้องไม่มีช่องโทษ/มติ) */
function toBody(f, attachmentIds) {
  const s = (v) => (String(v ?? "").trim() || null)
  const body = {
    incident_from: f.incident_from || null,
    incident_to: f.incident_to || null,
    place: s(f.place),
    facts: f.facts.trim(),
    related_law: s(f.related_law),
    external_evidence: s(f.external_evidence),
    clause_ids: f.clause_ids,
    committee_appointed: f.committee_appointed,
    investigation_finished_on: f.investigation_finished_on || null,
    statement_count: f.statement_count === "" ? null : Number(f.statement_count),
    finding: f.finding,
    investigation_summary: f.investigation_summary.trim(),
    notified_on: f.refused_to_sign ? null : f.notified_on || null,
    refused_to_sign: f.refused_to_sign,
    witness_1: s(f.witness_1),
    witness_2: s(f.witness_2),
  }
  if (f.committee_appointed) {
    Object.assign(body, {
      no_committee_reason: null,
      appointed_by: f.appointed_by,
      appointment_order_no: f.appointment_order_no.trim(),
      appointment_order_date: f.appointment_order_date,
      members: f.members.filter((m) => m.name.trim()).map((m) => ({ name: m.name.trim(), position: s(m.position), role: m.role })),
    })
  } else {
    Object.assign(body, { no_committee_reason: f.no_committee_reason, appointed_by: null, members: [] })
  }
  if (f.finding === "guilty") {
    Object.assign(body, {
      ordered_by: f.ordered_by,
      resolution_no: f.resolution_no.trim(),
      resolution_date: f.resolution_date,
      penalty: f.penalty,
      effective_date: f.effective_date,
    })
    if (f.penalty === "probation") body.probation_terms = s(f.probation_terms)
    if (f.penalty === "suspension") {
      Object.assign(body, { suspension_start: f.suspension_start, suspension_end: f.suspension_end, suspension_consent: true })
    }
    if (isTerminationPenalty(f.penalty)) {
      Object.assign(body, {
        severance_paid: f.severance_paid ?? f.penalty === "discharge",
        final_wage_through: f.final_wage_through || null,
        final_wage_paid_on: f.final_wage_paid_on || null,
        damages_amount: f.damages_amount === "" ? null : String(f.damages_amount),
        damages_due: f.damages_due || null,
      })
    }
  }
  if (attachmentIds.length) body.attachment_ids = attachmentIds
  return body
}

function Section({ n, title, hint, children }) {
  const hid = useId()
  return (
    <section aria-labelledby={hid} className="space-y-4 border-t border-gray-100 pt-5 first:border-t-0 first:pt-0 dark:border-line">
      <div className="flex items-baseline gap-3">
        <span aria-hidden="true" className="flex size-6 shrink-0 items-center justify-center rounded-full bg-gray-900 text-xs font-semibold tabular-nums text-white dark:bg-gray-100 dark:text-gray-900">{n}</span>
        <div className="min-w-0">
          <h3 id={hid} className="text-sm font-semibold text-gray-900 dark:text-gray-100">{title}</h3>
          {hint && <p className="text-xs leading-relaxed text-gray-500 dark:text-gray-400">{hint}</p>}
        </div>
      </div>
      <div className="space-y-4 md:pl-9">{children}</div>
    </section>
  )
}

function Field({ id, label, req, err, hint, children, className }) {
  return (
    <div className={cx("min-w-0", className)}>
      <label htmlFor={id} className={smallLabel}>{label}{req && <Req />}</label>
      {children}
      {err ? <p id={`${id}-err`} className={errorTextCls}>{err}</p>
        : hint ? <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">{hint}</p> : null}
    </div>
  )
}

function Segmented({ name, value, onChange, options, error, describedBy }) {
  return (
    <div role="radiogroup" aria-describedby={describedBy} className="grid gap-2 sm:grid-cols-2">
      {options.map((o) => {
        const on = value === o.value
        return (
          <label key={o.value} className={cx(
            "flex cursor-pointer items-start gap-3 rounded-xl border px-3 py-2.5 text-sm transition-colors duration-150 has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-indigo-500",
            on ? "border-indigo-500 bg-indigo-50 dark:border-indigo-400 dark:bg-indigo-500/10"
              : error ? "border-red-500 dark:border-red-400" : "border-gray-300 hover:bg-gray-50 dark:border-line-field dark:hover:bg-white/[.03]",
          )}>
            <input type="radio" name={name} value={o.value} checked={on} onChange={() => onChange(o.value)} className="mt-1 accent-indigo-600" />
            <span className="min-w-0">
              <span className="block font-medium text-gray-900 dark:text-gray-100">{o.label}</span>
              {o.hint && <span className="block text-xs text-gray-500 dark:text-gray-400">{o.hint}</span>}
            </span>
          </label>
        )
      })}
    </div>
  )
}

export default function RecordForm({ formId, c, settings, uploads, onBusy, onSaved, onError }) {
  const uid = useId()
  const [f, setF] = useState(() => initialState(c))
  const [errors, setErrors] = useState({})
  const [formErr, setFormErr] = useState("")
  const today = nowBangkok().date
  const extraClauses = useMemo(() => asArray(c?.default_clauses), [c])

  const set = (k) => (v) => {
    const value = v && typeof v === "object" && "target" in v ? v.target.value : v
    setF((s) => ({ ...s, [k]: value }))
    setErrors((e) => (e[k] ? { ...e, [k]: undefined } : e))
    setFormErr("")
  }
  const err = (k) => errors[k]
  const aria = (k) => ({ "aria-invalid": err(k) ? true : undefined, "aria-describedby": err(k) ? `${uid}-${k}-err` : undefined })
  const errCls = (k) => err(k) && "!border-red-500 dark:!border-red-400"
  const fid = (k) => `${uid}-${k}`

  const setMember = (i, k, v) => {
    setF((s) => ({ ...s, members: s.members.map((m, j) => (j === i ? { ...m, [k]: v } : m)) }))
    setErrors((e) => ({ ...e, members: undefined }))
  }

  const days = inclusiveDays(f.suspension_start, f.suspension_end)
  const guilty = f.finding === "guilty"
  const term = isTerminationPenalty(f.penalty)
  const severance = f.severance_paid ?? (f.penalty === "discharge")

  const submit = async (ev) => {
    ev.preventDefault()
    const e = validate(f, settings)
    setErrors(e)
    const first = Object.keys(e)[0]
    if (first) {
      setFormErr("กรอกข้อมูลให้ครบตามที่แจ้ง")
      const el = document.getElementById(first === "members" ? `${uid}-m0-name` : fid(first))
      el?.focus?.(); el?.scrollIntoView?.({ block: "center", behavior: "smooth" })
      return
    }
    if (uploads.busy) { setFormErr("รอให้อัปโหลดไฟล์เสร็จก่อน"); return }
    onBusy(true); setFormErr("")
    try {
      const res = await apiAuth(`/hr/discipline/cases/${c.id}/record`, { method: "POST", body: toBody(f, uploads.ids) })
      uploads.reset()
      onSaved(res)
    } catch (ex) {
      const msg = apiDetail(ex) || "บันทึกไม่สำเร็จ"
      setFormErr(msg)
      onError?.(ex, msg)
    } finally {
      onBusy(false)
    }
  }

  return (
    <form id={formId} onSubmit={submit} noValidate className="space-y-5">
      <Section n={1} title="ข้อเท็จจริง">
        <div className="grid gap-3 sm:grid-cols-2">
          <Field id={fid("incident_from")} label="วันที่เกิดเหตุ">
            <ThaiDateField id={fid("incident_from")} ariaLabel="วันที่เกิดเหตุ" value={f.incident_from} max={today} onChange={set("incident_from")} className={dateCls} />
          </Field>
          <Field id={fid("incident_to")} label="ถึงวันที่ (ถ้าต่อเนื่องหลายวัน)" err={err("incident_to")}>
            <ThaiDateField id={fid("incident_to")} ariaLabel="วันสิ้นสุดเหตุ" value={f.incident_to} min={f.incident_from || undefined} error={!!err("incident_to")} {...aria("incident_to")} onChange={set("incident_to")} className={dateCls} />
          </Field>
        </div>
        <Field id={fid("place")} label="สถานที่">
          <input id={fid("place")} value={f.place} maxLength={300} onChange={set("place")} placeholder="เช่น สาขาสุรินทร์" className={inputCls} />
        </Field>
        <Field id={fid("facts")} label="พฤติการณ์" req err={err("facts")}>
          <textarea id={fid("facts")} rows={4} maxLength={4000} value={f.facts} onChange={set("facts")} {...aria("facts")} aria-required="true"
            className={cx(inputCls, "resize-y leading-relaxed", errCls("facts"))} />
        </Field>
        <Field id={fid("clause_ids")} label="ข้อระเบียบที่ฝ่าฝืน" req={guilty} err={err("clause_ids")} hint="ติ๊กไว้ล่วงหน้าตามหัวข้อของเรื่อง แก้ได้">
          <ClausePicker id={fid("clause_ids")} value={f.clause_ids} extra={extraClauses} error={err("clause_ids")}
            onChange={(ids) => set("clause_ids")(ids)} />
        </Field>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field id={fid("related_law")} label="กฎหมายที่เกี่ยวข้อง">
            <input id={fid("related_law")} value={f.related_law} maxLength={500} onChange={set("related_law")} placeholder="เช่น พ.ร.บ.คุ้มครองแรงงาน มาตรา 119" className={inputCls} />
          </Field>
          <Field id={fid("external_evidence")} label="หลักฐานภายนอก">
            <input id={fid("external_evidence")} value={f.external_evidence} maxLength={500} onChange={set("external_evidence")} placeholder="เช่น บันทึกประจำวันตำรวจ" className={inputCls} />
          </Field>
        </div>
      </Section>

      <Section n={2} title="การสอบสวน" hint="คณะกรรมการสอบสวนทำงานนอกระบบ — บันทึกผลตามเอกสาร">
        <Segmented name={`${uid}-committee`} value={f.committee_appointed ? "yes" : "no"}
          onChange={(v) => { setF((s) => ({ ...s, committee_appointed: v === "yes" })); setErrors({}); setFormErr("") }}
          options={[
            { value: "yes", label: "ตั้งคณะกรรมการสอบสวน", hint: `อย่างน้อย ${COMMITTEE_MIN_MEMBERS} คน (ข้อ 57)` },
            { value: "no", label: "ไม่ต้องตั้งคณะกรรมการ", hint: "ตามข้อ 58 หรือโทษต่ำกว่าให้ออก" },
          ]} />

        {f.committee_appointed ? (
          <>
            <div className="grid gap-3 sm:grid-cols-3">
              <Field id={fid("appointed_by")} label="ผู้แต่งตั้ง" req err={err("appointed_by")}>
                <SelectDropdown id={fid("appointed_by")} size="sm" required showSwatch={false} value={f.appointed_by} onChange={set("appointed_by")}
                  options={APPOINTED_BY} error={!!err("appointed_by")} ariaDescribedby={err("appointed_by") ? `${fid("appointed_by")}-err` : undefined}
                  className={inputCls} />
              </Field>
              <Field id={fid("appointment_order_no")} label="เลขที่คำสั่งแต่งตั้ง" req err={err("appointment_order_no")}>
                <input id={fid("appointment_order_no")} value={f.appointment_order_no} maxLength={200} onChange={set("appointment_order_no")} {...aria("appointment_order_no")}
                  placeholder="คำสั่งที่ 12/2569" className={cx(inputCls, errCls("appointment_order_no"))} />
              </Field>
              <Field id={fid("appointment_order_date")} label="วันที่คำสั่ง" req err={err("appointment_order_date")}>
                <ThaiDateField id={fid("appointment_order_date")} ariaLabel="วันที่คำสั่งแต่งตั้ง" value={f.appointment_order_date} max={today}
                  error={!!err("appointment_order_date")} {...aria("appointment_order_date")} onChange={set("appointment_order_date")} className={dateCls} />
              </Field>
            </div>

            <fieldset className="min-w-0">
              <legend className={smallLabel}>คณะกรรมการสอบสวน<Req /></legend>
              <ul className="space-y-2">
                {f.members.map((m, i) => (
                  <li key={i} className="grid grid-cols-[minmax(0,1fr)_auto] gap-2 rounded-xl bg-gray-50 p-2 sm:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)_minmax(0,1fr)_auto] dark:bg-white/[.03]">
                    <input id={`${uid}-m${i}-name`} value={m.name} maxLength={200} onChange={(e) => setMember(i, "name", e.target.value)}
                      aria-label={`ชื่อกรรมการคนที่ ${i + 1}`} placeholder="ชื่อ-สกุล" className={cx(inputCls, "col-span-1")} />
                    <button type="button" onClick={() => setF((s) => ({ ...s, members: s.members.filter((_, j) => j !== i) }))}
                      disabled={f.members.length <= 1} aria-label={`ลบกรรมการคนที่ ${i + 1}`}
                      className={cx("inline-flex size-11 items-center justify-center rounded-lg text-gray-500 transition-colors duration-150 hover:bg-red-50 hover:text-red-700 disabled:opacity-40 sm:order-last md:size-9 dark:text-gray-400 dark:hover:bg-red-500/10 dark:hover:text-red-300", focusRingCls)}>
                      <Trash2 aria-hidden="true" className="size-4" />
                    </button>
                    <input value={m.position} maxLength={200} onChange={(e) => setMember(i, "position", e.target.value)}
                      aria-label={`ตำแหน่งกรรมการคนที่ ${i + 1}`} placeholder="ตำแหน่ง" className={inputCls} />
                    <SelectDropdown size="sm" showSwatch={false} value={m.role} onChange={(v) => setMember(i, "role", v)} options={MEMBER_ROLES}
                      ariaLabel={`บทบาทกรรมการคนที่ ${i + 1}`} className={inputCls} />
                  </li>
                ))}
              </ul>
              <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
                <button type="button" onClick={() => setF((s) => ({ ...s, members: [...s.members, { name: "", position: "", role: "member" }] }))}
                  className={cx("inline-flex min-h-touch items-center gap-1.5 rounded-lg px-2.5 text-sm font-medium text-indigo-700 hover:bg-indigo-50 md:pointer-fine:min-h-9 dark:text-indigo-300 dark:hover:bg-indigo-500/10", focusRingCls)}>
                  <Plus aria-hidden="true" className="size-4" /> เพิ่มกรรมการ
                </button>
                <span className="text-xs tabular-nums text-gray-500 dark:text-gray-400">{f.members.filter((m) => m.name.trim()).length} คน</span>
              </div>
              {err("members") && <p role="alert" className={errorTextCls}>{err("members")}</p>}
            </fieldset>

            <Field id={fid("investigation_finished_on")} label="วันที่สอบสวนเสร็จ" req err={err("investigation_finished_on")} className="sm:max-w-xs"
              hint="เกิน 30 วันนับจากคำสั่งแต่งตั้ง ระบบจะเตือนหลังบันทึก (ข้อ 57)">
              <ThaiDateField id={fid("investigation_finished_on")} ariaLabel="วันที่สอบสวนเสร็จ" value={f.investigation_finished_on} max={today}
                min={f.appointment_order_date || undefined} error={!!err("investigation_finished_on")} {...aria("investigation_finished_on")}
                onChange={set("investigation_finished_on")} className={dateCls} />
            </Field>
          </>
        ) : (
          <>
            <Field id={fid("no_committee_reason")} label="เหตุที่ไม่ต้องตั้งคณะกรรมการ" req err={err("no_committee_reason")}>
              <SelectDropdown id={fid("no_committee_reason")} size="sm" required showSwatch={false} value={f.no_committee_reason} onChange={set("no_committee_reason")}
                options={NO_COMMITTEE_REASONS} error={!!err("no_committee_reason")} ariaDescribedby={err("no_committee_reason") ? `${fid("no_committee_reason")}-err` : undefined}
                className={inputCls} />
            </Field>
            <Field id={fid("investigation_finished_on")} label="วันที่ตรวจสอบข้อเท็จจริงเสร็จ (ไม่บังคับ)" err={err("investigation_finished_on")} className="sm:max-w-xs">
              <ThaiDateField id={fid("investigation_finished_on")} ariaLabel="วันที่ตรวจสอบเสร็จ" value={f.investigation_finished_on} max={today}
                error={!!err("investigation_finished_on")} onChange={set("investigation_finished_on")} className={dateCls} />
            </Field>
          </>
        )}

        <Field id={fid("statement_count")} label="จำนวนบันทึกถ้อยคำ" err={err("statement_count")} className="sm:max-w-[10rem]">
          <input id={fid("statement_count")} type="text" inputMode="numeric" value={f.statement_count} {...aria("statement_count")}
            onChange={(e) => set("statement_count")(e.target.value.replace(/[^\d]/g, ""))} placeholder="0"
            className={cx(inputCls, "text-right tabular-nums", errCls("statement_count"))} />
        </Field>

        <fieldset className="min-w-0">
          <legend id={fid("finding")} tabIndex={-1} className={smallLabel}>ผลการสอบสวน<Req /></legend>
          <Segmented name={`${uid}-finding`} value={f.finding} onChange={set("finding")} error={!!err("finding")}
            describedBy={err("finding") ? `${fid("finding")}-err` : undefined}
            options={FINDINGS.map((o) => ({ ...o, hint: o.value === "not_guilty" ? "ปิดเรื่องโดยไม่ลงโทษ ไม่นับบนลำดับขั้น" : "บันทึกมติ/คำสั่งและโทษต่อด้านล่าง" }))} />
          {err("finding") && <p id={`${fid("finding")}-err`} className={errorTextCls}>{err("finding")}</p>}
        </fieldset>

        <Field id={fid("investigation_summary")} label="สรุปผลการสอบสวน" req err={err("investigation_summary")}>
          <textarea id={fid("investigation_summary")} rows={3} maxLength={4000} value={f.investigation_summary} onChange={set("investigation_summary")}
            {...aria("investigation_summary")} aria-required="true" placeholder="เช่น พยาน 4 ปากยืนยันข้อเท็จจริง"
            className={cx(inputCls, "resize-y leading-relaxed", errCls("investigation_summary"))} />
        </Field>
      </Section>

      {guilty && (
        <Section n={3} title="มติ / คำสั่ง">
          <div className="grid gap-3 sm:grid-cols-3">
            <Field id={fid("ordered_by")} label="ผู้มีอำนาจสั่ง" req err={err("ordered_by")}>
              <SelectDropdown id={fid("ordered_by")} size="sm" required showSwatch={false} value={f.ordered_by} onChange={set("ordered_by")}
                options={ORDERED_BY} error={!!err("ordered_by")} className={inputCls} />
            </Field>
            <Field id={fid("resolution_no")} label="เลขที่มติ/คำสั่ง" req err={err("resolution_no")}>
              <input id={fid("resolution_no")} value={f.resolution_no} maxLength={200} onChange={set("resolution_no")} {...aria("resolution_no")}
                placeholder="คำสั่งที่ 15/2569" className={cx(inputCls, errCls("resolution_no"))} />
            </Field>
            <Field id={fid("resolution_date")} label="วันที่มติ/คำสั่ง" req err={err("resolution_date")}>
              <ThaiDateField id={fid("resolution_date")} ariaLabel="วันที่มติ/คำสั่ง" value={f.resolution_date} max={today}
                error={!!err("resolution_date")} {...aria("resolution_date")} onChange={set("resolution_date")} className={dateCls} />
            </Field>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field id={fid("penalty")} label="โทษ" req err={err("penalty")}>
              <SelectDropdown id={fid("penalty")} size="sm" required showSwatch={false} value={f.penalty}
                onChange={(v) => { set("penalty")(v); setF((s) => ({ ...s, severance_paid: null })) }}
                options={PENALTIES} error={!!err("penalty")} className={inputCls} />
            </Field>
            <Field id={fid("effective_date")} label="วันที่มีผล" req err={err("effective_date")}>
              <ThaiDateField id={fid("effective_date")} ariaLabel="วันที่มีผล" value={f.effective_date}
                error={!!err("effective_date")} {...aria("effective_date")} onChange={set("effective_date")} className={dateCls} />
            </Field>
          </div>

          {f.penalty === "probation" && (
            <Field id={fid("probation_terms")} label="ทัณฑ์บน (ไม่บังคับ)">
              <textarea id={fid("probation_terms")} rows={2} maxLength={2000} value={f.probation_terms} onChange={set("probation_terms")}
                placeholder="เงื่อนไขที่ผู้ถูกลงโทษต้องปฏิบัติ" className={cx(inputCls, "resize-y")} />
            </Field>
          )}

          {f.penalty === "suspension" && (
            <fieldset className="space-y-3 rounded-xl bg-gray-50 p-3 dark:bg-white/[.03]">
              <legend className="sr-only">ช่วงพักงาน</legend>
              <p className="text-sm font-medium text-gray-900 dark:text-gray-100">ช่วงพักงาน (งดจ่ายค่าจ้างวันทำงานที่พัก)</p>
              <div className="grid gap-3 sm:grid-cols-2">
                <Field id={fid("suspension_start")} label="ตั้งแต่วันที่">
                  <ThaiDateField id={fid("suspension_start")} ariaLabel="วันเริ่มพักงาน" value={f.suspension_start} error={!!err("suspension_start")}
                    onChange={(e) => { const v = e.target.value; setF((s) => ({ ...s, suspension_start: v, suspension_end: s.suspension_end && s.suspension_end < v ? v : s.suspension_end })); setErrors((x) => ({ ...x, suspension_start: undefined })) }}
                    className={dateCls} />
                </Field>
                <Field id={fid("suspension_end")} label="ถึงวันที่">
                  <ThaiDateField id={fid("suspension_end")} ariaLabel="วันสุดท้ายที่พักงาน" value={f.suspension_end} min={f.suspension_start || undefined}
                    error={!!err("suspension_start")} onChange={(e) => { set("suspension_end")(e); setErrors((x) => ({ ...x, suspension_start: undefined })) }} className={dateCls} />
                </Field>
              </div>
              {err("suspension_start") ? <p role="alert" className={errorTextCls}>{err("suspension_start")}</p> : (
                <p className="text-xs tabular-nums text-gray-600 dark:text-gray-400">
                  {days ? `รวม ${days} วัน` : "เลือกวันเริ่มและวันสุดท้าย"} · ตามระเบียบ {settings?.suspension_min_days ?? 1}–{settings?.suspension_max_days ?? 7} วัน · งวดเงินเดือนต้องยังเป็นฉบับร่าง
                </p>
              )}
              <label htmlFor={fid("suspension_consent")} className={cx(
                "flex cursor-pointer items-start gap-3 rounded-xl border bg-white px-3 py-2.5 has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-indigo-500 dark:bg-transparent",
                err("suspension_consent") ? "border-red-500 dark:border-red-400" : "border-gray-300 dark:border-line-field",
              )}>
                <input id={fid("suspension_consent")} type="checkbox" checked={f.suspension_consent} {...aria("suspension_consent")}
                  onChange={(e) => { setF((s) => ({ ...s, suspension_consent: e.target.checked })); setErrors((x) => ({ ...x, suspension_consent: undefined })) }}
                  className="mt-1 accent-indigo-600" />
                <span className="text-sm">
                  <span className="block font-medium text-gray-900 dark:text-gray-100">ผู้ถูกลงโทษยินยอมเป็นหนังสือแล้ว</span>
                  <span className="block text-xs text-gray-500 dark:text-gray-400">ข้อ 60 — แนบหนังสือยินยอมในเอกสารแนบ</span>
                </span>
              </label>
              {err("suspension_consent") && <p id={`${fid("suspension_consent")}-err`} className={errorTextCls}>{err("suspension_consent")}</p>}
            </fieldset>
          )}

          {term && (
            <fieldset className="space-y-3 rounded-xl bg-gray-50 p-3 dark:bg-white/[.03]">
              <legend className="sr-only">ค่าชดเชยและค่าจ้างงวดสุดท้าย</legend>
              <p className="text-sm font-medium text-gray-900 dark:text-gray-100">ค่าชดเชย · ค่าจ้างงวดสุดท้าย · ค่าเสียหาย</p>
              <Segmented name={`${uid}-sev`} value={severance ? "yes" : "no"}
                onChange={(v) => setF((s) => ({ ...s, severance_paid: v === "yes" }))}
                options={[
                  { value: "yes", label: "จ่ายค่าชดเชย", hint: f.penalty === "discharge" ? "ค่าเริ่มต้นของให้ออก" : undefined },
                  { value: "no", label: "ไม่จ่ายค่าชดเชย", hint: f.penalty === "dismissal" ? "ค่าเริ่มต้นของไล่ออก (ข้อ 75)" : undefined },
                ]} />
              <div className="grid gap-3 sm:grid-cols-2">
                <Field id={fid("final_wage_through")} label="ค่าจ้างงวดสุดท้ายถึงวันที่">
                  <ThaiDateField id={fid("final_wage_through")} ariaLabel="ค่าจ้างงวดสุดท้ายถึงวันที่" value={f.final_wage_through} onChange={set("final_wage_through")} className={dateCls} />
                </Field>
                <Field id={fid("final_wage_paid_on")} label="จ่ายค่าจ้างงวดสุดท้ายวันที่">
                  <ThaiDateField id={fid("final_wage_paid_on")} ariaLabel="วันที่จ่ายค่าจ้างงวดสุดท้าย" value={f.final_wage_paid_on} onChange={set("final_wage_paid_on")} className={dateCls} />
                </Field>
                <Field id={fid("damages_amount")} label="ค่าเสียหายที่ต้องชดใช้ (บาท)" err={err("damages_amount")}>
                  <input id={fid("damages_amount")} type="text" inputMode="decimal" value={f.damages_amount} {...aria("damages_amount")}
                    onChange={(e) => set("damages_amount")(e.target.value.replace(/[^\d.]/g, ""))} placeholder="0.00"
                    className={cx(inputCls, "text-right tabular-nums", errCls("damages_amount"))} />
                </Field>
                <Field id={fid("damages_due")} label="กำหนดชำระค่าเสียหาย">
                  <ThaiDateField id={fid("damages_due")} ariaLabel="กำหนดชำระค่าเสียหาย" value={f.damages_due} onChange={set("damages_due")} className={dateCls} />
                </Field>
              </div>
              <p className="text-xs text-gray-600 dark:text-gray-400">หลังบันทึก ระบบจะชวนบันทึกการพ้นสภาพ โดยเติมข้อมูลเหล่านี้ให้</p>
            </fieldset>
          )}
        </Section>
      )}

      <Section n={guilty ? 4 : 3} title="การแจ้งผล" hint="ไม่บังคับตอนนี้ — บันทึกภายหลังได้ที่ “แจ้งผล / อุทธรณ์” (อุทธรณ์ได้ภายใน 15 วันนับจากวันที่แจ้ง)">
        <RefusedToggle id={fid("refused_to_sign")} checked={f.refused_to_sign} onChange={(v) => setF((s) => ({ ...s, refused_to_sign: v }))} />
        {!f.refused_to_sign && (
          <Field id={fid("notified_on")} label="วันที่แจ้งผู้ถูกลงโทษ" err={err("notified_on")} className="sm:max-w-xs">
            <ThaiDateField id={fid("notified_on")} ariaLabel="วันที่แจ้งผล" value={f.notified_on} max={today} error={!!err("notified_on")}
              {...aria("notified_on")} onChange={set("notified_on")} className={dateCls} />
          </Field>
        )}
        <WitnessFields uid={fid("w")} w1={f.witness_1} w2={f.witness_2}
          onChange={(k, v) => setF((s) => ({ ...s, [k === "w1" ? "witness_1" : "witness_2"]: v }))} />
      </Section>

      <Section n={guilty ? 5 : 4} title="เอกสารแนบ">
        <FileUploader uploads={uploads} id={fid("files")} label="คำสั่งแต่งตั้ง · บันทึกถ้อยคำ · รายงานผลสอบสวน · มติ · หนังสือที่ลงนามแล้ว"
          hint="PDF หรือรูปถ่าย — แนบเข้ากับเรื่องนี้ เห็นตามสิทธิ์ของเรื่อง" />
      </Section>

      {formErr && <p role="alert" className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-800 dark:border-red-800/60 dark:bg-red-900/20 dark:text-red-200">{formErr}</p>}
    </form>
  )
}
