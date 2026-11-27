// src/pages/hr/tabs/HRDisciplineTab.jsx
// ─────────────────────────────────────────────────────────────────────────────
// เรื่องร้องเรียน/ตักเตือน (งวด 4 · 3Q · AMC 2026-11-16) — ผู้พิจารณา (หัวหน้า / ผช.ผจก. / ผจก.) และ HR
// เปิดจาก /hr/dashboard?tab=discipline และ /hr/discipline (HRDiscipline.jsx)
//
// ขั้น: head → hr (ฝ่ายบุคคลจัดทำหนังสือรายงาน) → asst (ผช.ผจก. ตรวจสอบ) → manager
//   GET  /hr/discipline/cases?status=open|closed&stage=&mine=true   (stage=hr = กล่องงาน HR)
//   GET  /hr/discipline/cases/{id}                                  รายละเอียด + ladder + events + attachments + record
//   POST /hr/discipline/cases/{id}/hr-report { report_no, report_date, summary }   ขั้น hr → asst
//   POST /hr/discipline/cases/{id}/escalate  { reason }      head → hr · asst → manager ("ตรวจสอบและส่งต่อผู้จัดการ")
//   POST /hr/discipline/cases/{id}/punish    { step 1–4, note, place, act_description, incident_end, witness_1/2, clause_ids }
//   POST /hr/discipline/cases/{id}/record    บันทึกวินัยและโทษทางวินัย (ขั้น manager · can_record_outcome) — RecordForm
//   PATCH /hr/discipline/cases/{id}/record   แจ้งผล / อุทธรณ์ — RecordPatchSheet
//   PATCH /hr/discipline/actions/{id}        บันทึกการรับทราบ — AckSheet
//   POST /hr/discipline/cases/{id}/dismiss   { reason, false_report }
//
// ปุ่มทั้งหมดอิง server: can_decide · can_write_hr_report · can_record_outcome · allowed_steps[].within_my_stage/needs_record
// ผู้แจ้ง: แสดงเฉพาะเมื่อ key reporter_* มีอยู่จริง (backend ตัด key ทิ้งเมื่อไม่มีสิทธิ์เห็น — HR ไม่เห็นเสมอ)
// (2026-11-16) dialog "บันทึกผลมติคณะกรรมการ" (punish 7/8) ถูกเอาออก — แทนด้วย "บันทึกวินัยและโทษทางวินัย"
//
// Deep link: &id=<case id> (การแจ้งเตือน discipline_case) · &action=<action id> (discipline_action ถึง HR)
// ─────────────────────────────────────────────────────────────────────────────
import { useCallback, useEffect, useId, useMemo, useState } from "react"
import { useSearchParams } from "react-router-dom"
import { ArrowUpRight, FileDown, FileText, LoaderCircle, Paperclip, UserX } from "lucide-react"
import { apiAuth } from "../../../lib/api"
import { apiDetail } from "../../../lib/apiErrors"
import { useCan } from "../../../lib/permissions"
import { keepBackState } from "../../../lib/drill"
import {
  cx, baseField, cardCls, dangerBtnCls, errorTextCls, focusRingCls, neutralBtnCls, primaryBtnCls, tabPanelCls,
} from "../../../lib/styles"
import {
  EVENT_LABEL, LADDER, MAX_WARNING_STEP, NEXT_STAGE, STAGES, SUSPENSION_STEP, TERMINATION_STEPS,
  asArray, canSeeReporter, caseStatus, downloadActionPdf, fmtDate, fmtDateTime, nowBangkok, resolutionText,
  stageLabel, stepLabel, stepTone, suspensionText, terminationPrefillFor,
} from "../../../lib/discipline"
import useFileUploads from "../../../hooks/useFileUploads"
import { useIsPhone } from "../../../hooks/useMediaQuery"
import {
  Badge, DataList, EmptyState, ErrorState, Sheet, Skeleton, SkeletonTableRows, Tabs, panelId, tabId, toast, useSubTab,
} from "../../../components/ui"
import SelectDropdown from "../../../components/SelectDropdown"
import ThaiDateField from "../../../components/ThaiDateField"
import AttachmentList from "../../../components/AttachmentList"
import { TerminationSheet } from "../../../components/hr/TerminationForm"
import ClausePicker, { ClauseList } from "../../../components/hr/discipline/ClausePicker"
import AckSheet, { WitnessFields } from "../../../components/hr/discipline/AckSheet"
import { ackText, canAckAction } from "../../../components/hr/discipline/disciplineData"
import RecordForm from "../../../components/hr/discipline/RecordForm"
import RecordCard, { RecordPatchSheet } from "../../../components/hr/discipline/RecordCard"
import { NameHeaderCell, NameNoMatch, NameSearchField } from "../../../components/hr/nameFilter"
import { useNameFilter } from "../../../components/hr/useNameFilter"

const ID_BASE = "hr-disc"
const RECORD_FORM_ID = `${ID_BASE}-record-form`
const inputCls = cx(baseField, "!rounded-lg !px-3 !py-2 md:!text-sm")
const dateCls = "!rounded-lg !px-3 !py-2 md:!text-sm"
const smallLabel = "mb-1 block text-xs font-medium text-gray-600 dark:text-gray-400"
const sectionH = "mb-2 text-xs font-semibold text-gray-500 dark:text-gray-400"
const pdfBtnCls = cx(
  "inline-flex min-h-touch items-center gap-1.5 rounded-lg px-3 text-sm font-medium text-indigo-700 ring-1 ring-inset ring-indigo-200 transition-colors duration-150 hover:bg-indigo-50 disabled:opacity-60 cursor-pointer md:pointer-fine:min-h-9 dark:text-indigo-300 dark:ring-indigo-400/30 dark:hover:bg-indigo-500/10",
  focusRingCls,
)

const accusedName = (c) => c?.accused_name || (c?.accused_id != null ? `รหัส ${c.accused_id}` : "—")

/** ปุ่ม escalate ที่ขั้น asst = ผช.ผจก. ตรวจหนังสือรายงานแล้วส่งต่อ */
const escalateLabel = (stage, next) => (stage === "asst" ? "ตรวจสอบและส่งต่อผู้จัดการ" : `ส่งต่อ${stageLabel(next)}`)

function SeriousBadge() {
  return <Badge tone="danger">ร้ายแรง</Badge>
}

function DetailRow({ label, children }) {
  return (
    <div className="grid grid-cols-[7.5rem_minmax(0,1fr)] gap-3 py-2 text-sm first:pt-0">
      <dt className="text-gray-500 dark:text-gray-400">{label}</dt>
      <dd className="min-w-0 text-gray-900 dark:text-gray-100">{children}</dd>
    </div>
  )
}

// ─── ลำดับขั้นโทษ (ladder) ──────────────────────────────────────────────────

function LadderTrack({ c }) {
  const ladder = c.ladder || {}
  const open = c.status === "open"
  const earlier = new Map(asArray(ladder.earlier_actions).map((a) => [Number(a.step), a]))
  const allowed = new Map(asArray(ladder.allowed_steps).map((s) => [Number(s.step), s]))
  const next = Number(ladder.next_step) || null
  const stageMax = ladder.stage_max_step != null ? Number(ladder.stage_max_step) : null
  const issued = c.action?.step != null ? Number(c.action.step) : null

  return (
    <ol className="relative space-y-0.5" aria-label="ลำดับขั้นโทษของหัวข้อนี้">
      {LADDER.map((s) => {
        const done = earlier.get(s.step)
        const isIssued = issued === s.step
        const isNext = open && next === s.step
        const isAllowed = open && allowed.has(s.step)
        const beyond = open && !s.record && stageMax != null && s.step > stageMax && s.step >= (next ?? 0)
        const state = isIssued ? "issued" : done ? "done" : isNext ? "next" : isAllowed ? "allowed" : "idle"
        return (
          <li key={s.step} className={cx(
            "relative grid grid-cols-[1.5rem_minmax(0,1fr)] items-start gap-3 rounded-lg px-2 py-1.5",
            s.step === MAX_WARNING_STEP + 1 && "mt-2 border-t border-dashed border-gray-200 pt-2.5 dark:border-white/10",
            state === "next" && "bg-indigo-50 ring-1 ring-inset ring-indigo-200 dark:bg-indigo-500/10 dark:ring-indigo-400/30",
            state === "issued" && "bg-red-50 ring-1 ring-inset ring-red-200 dark:bg-red-500/10 dark:ring-red-400/25",
          )}>
            <span aria-hidden="true" className={cx(
              "mt-0.5 flex size-6 items-center justify-center rounded-full text-xs font-semibold tabular-nums",
              state === "done" ? "bg-gray-700 text-white dark:bg-gray-300 dark:text-gray-900"
                : state === "issued" ? "bg-red-600 text-white dark:bg-red-500"
                : state === "next" ? "bg-indigo-600 text-white dark:bg-indigo-500"
                : state === "allowed" ? "bg-white text-indigo-700 ring-1 ring-indigo-300 dark:bg-transparent dark:text-indigo-300 dark:ring-indigo-400/40"
                : "bg-gray-100 text-gray-400 dark:bg-white/[.06] dark:text-gray-500",
            )}>
              {s.step}
            </span>
            <div className="min-w-0">
              <p className={cx("text-sm", state === "idle" ? "text-gray-500 dark:text-gray-400" : "font-medium text-gray-900 dark:text-gray-100")}>
                {stepLabel(s.step, isNext ? ladder.next_step_label : allowed.get(s.step)?.label)}
                {state === "next" && <span className="ml-2 whitespace-nowrap text-xs font-semibold text-indigo-700 dark:text-indigo-300">ขั้นถัดไป</span>}
                {state === "issued" && <span className="ml-2 whitespace-nowrap text-xs font-semibold text-red-700 dark:text-red-300">ในเรื่องนี้</span>}
              </p>
              {done && (
                <p className="text-xs tabular-nums text-gray-500 dark:text-gray-400">
                  {done.doc_no ? `${done.doc_no} · ` : ""}{fmtDate(done.issued_on)}
                </p>
              )}
              {!done && (state === "next" || state === "allowed" || state === "idle") && (
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  {s.record ? "ผ่านคณะกรรมการสอบสวน · บันทึกที่ขั้นผู้จัดการ" : `ผู้มีอำนาจ: ${s.by}`}
                  {beyond && <span className="text-amber-700 dark:text-amber-300"> · เกินอำนาจขั้น{stageLabel(c.stage)}</span>}
                </p>
              )}
            </div>
          </li>
        )
      })}
    </ol>
  )
}

function EventsTimeline({ events }) {
  const list = asArray(events)
  if (!list.length) return <p className="text-sm text-gray-500 dark:text-gray-400">ยังไม่มีการดำเนินการ</p>
  return (
    <ol className="space-y-2.5">
      {list.map((e, i) => (
        <li key={`${e.action}-${e.created_at}-${i}`} className="grid grid-cols-[auto_minmax(0,1fr)] gap-3 text-sm">
          <span aria-hidden="true" className="mt-1.5 size-2 rounded-full bg-gray-400 dark:bg-gray-500" />
          <div className="min-w-0">
            <p className="text-gray-900 dark:text-gray-100">
              <span className="font-medium">{EVENT_LABEL[e.action] ?? e.action}</span>
              {(e.action === "escalated" || e.action === "hr_report") && e.from_stage
                ? <span className="text-gray-600 dark:text-gray-400"> · {stageLabel(e.from_stage)} → {stageLabel(e.to_stage)}</span>
                : e.to_stage && e.action === "submitted"
                  ? <span className="text-gray-600 dark:text-gray-400"> · ถึง{stageLabel(e.to_stage)}</span>
                  : null}
            </p>
            <p className="text-xs tabular-nums text-gray-500 dark:text-gray-400">{fmtDateTime(e.created_at)}</p>
            {e.reason && <p className="mt-0.5 whitespace-pre-wrap break-words text-gray-700 dark:text-gray-300">{e.reason}</p>}
          </div>
        </li>
      ))}
    </ol>
  )
}

/** หนังสือรายงานของฝ่ายบุคคล (แสดงบนสุดของเรื่องเมื่อมี — ผช.ผจก. ใช้ตรวจสอบ) */
function HrReportBlock({ c }) {
  if (!c?.hr_report_no && !c?.hr_report_summary) return null
  return (
    <section aria-label="หนังสือรายงานผู้จัดการ" className="rounded-xl bg-indigo-50/70 px-3 py-3 ring-1 ring-inset ring-indigo-200 dark:bg-indigo-500/10 dark:ring-indigo-400/25">
      <p className="flex flex-wrap items-center gap-x-2 text-xs font-semibold text-indigo-900 dark:text-indigo-200">
        <FileText aria-hidden="true" className="size-3.5" /> หนังสือรายงานผู้จัดการ (ฝ่ายบุคคล)
        <span className="font-normal tabular-nums text-indigo-800/80 dark:text-indigo-200/80">
          {c.hr_report_no ? `เลขที่ ${c.hr_report_no}` : ""}{c.hr_report_date ? ` · ${fmtDate(c.hr_report_date, { long: true })}` : ""}
        </span>
      </p>
      {c.hr_report_summary && <p className="mt-1.5 whitespace-pre-wrap break-words text-sm leading-relaxed text-gray-900 dark:text-gray-100">{c.hr_report_summary}</p>}
    </section>
  )
}

// ─── ฟอร์มในชีต (อยู่ใน Sheet เดียวกัน — ไม่ซ้อน modal) ───────────────────────

/** ออกหนังสือตักเตือน ขั้น 1–4 + ข้อมูลในหนังสือตามแบบ AMC */
function PunishForm({ c, state, setState }) {
  const uid = useId()
  const options = asArray(c.ladder?.allowed_steps).filter((o) => !o.needs_record && Number(o.step) <= MAX_WARNING_STEP)
  const nextStage = NEXT_STAGE[c.stage]
  const step = Number(state.step) || null
  const set = (k) => (e) => setState((s) => ({ ...s, [k]: e?.target ? e.target.value : e, err: "", fieldErr: { ...s.fieldErr, [k]: "" } }))
  const fe = state.fieldErr || {}
  const incidentDay = c.incident_at ? new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Bangkok" }).format(new Date(c.incident_at)) : undefined

  return (
    <div className="space-y-4">
      <fieldset>
        <legend className={smallLabel}>เลือกหนังสือ <span className="text-red-600 dark:text-red-400">*</span></legend>
        <div className="space-y-2">
          {options.map((o) => {
            const n = Number(o.step)
            const active = step === n
            const within = o.within_my_stage !== false
            return (
              <label key={n} className={cx(
                "flex items-start gap-3 rounded-xl border px-3 py-2.5 transition-colors duration-150",
                within ? "cursor-pointer has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-indigo-500" : "cursor-not-allowed opacity-75",
                active ? "border-indigo-500 bg-indigo-50 dark:border-indigo-400 dark:bg-indigo-500/10"
                  : "border-gray-300 hover:bg-gray-50 dark:border-line-field dark:hover:bg-white/[.03]",
              )}>
                <input type="radio" name={`${uid}-step`} value={n} checked={active} disabled={!within}
                  onChange={() => setState((s) => ({ ...s, step: n, err: "" }))} className="mt-1 accent-indigo-600" />
                <span className="min-w-0 flex-1">
                  <span className="flex flex-wrap items-center gap-2">
                    <Badge tone={stepTone(n)}>ขั้น {n}</Badge>
                    <span className="text-sm font-medium text-gray-900 dark:text-gray-100">{stepLabel(n, o.label)}</span>
                  </span>
                  <span className="mt-0.5 block text-xs text-gray-500 dark:text-gray-400">
                    {n === MAX_WARNING_STEP ? "หนังสือตักเตือน — ระบุจำนวนครั้งที่ให้โอกาสแล้ว" : "บันทึกการตักเตือนด้วยวาจา — มีคำรับรองของผู้ถูกตักเตือน"}
                  </span>
                  {!within && (
                    <span className="mt-0.5 block text-xs text-amber-800 dark:text-amber-300">
                      เกินอำนาจขั้นของคุณ — {nextStage ? `ส่งต่อ${stageLabel(nextStage)}` : "ต้องให้ผู้มีอำนาจพิจารณา"}
                    </span>
                  )}
                </span>
              </label>
            )
          })}
        </div>
      </fieldset>

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="min-w-0">
          <label htmlFor={`${uid}-place`} className={smallLabel}>สถานที่เกิดเหตุ</label>
          <input id={`${uid}-place`} value={state.place} maxLength={300} onChange={set("place")} placeholder="เช่น สาขาสุรินทร์" className={inputCls} />
        </div>
        <div className="min-w-0">
          <label htmlFor={`${uid}-end`} className={smallLabel}>วันสิ้นสุดเหตุ (ถ้าต่อเนื่อง)</label>
          <ThaiDateField id={`${uid}-end`} ariaLabel="วันสิ้นสุดเหตุ" value={state.incident_end} min={incidentDay} error={!!fe.incident_end}
            aria-describedby={fe.incident_end ? `${uid}-end-err` : undefined} onChange={set("incident_end")} className={dateCls} />
          {fe.incident_end && <p id={`${uid}-end-err`} className={errorTextCls}>{fe.incident_end}</p>}
        </div>
      </div>

      <div>
        <label htmlFor={`${uid}-act`} className={smallLabel}>พฤติการณ์ (พิมพ์ในหนังสือ)</label>
        <textarea id={`${uid}-act`} rows={3} maxLength={2000} value={state.act_description} onChange={set("act_description")}
          className={cx(inputCls, "resize-y leading-relaxed")} />
        <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">เติมจากรายละเอียดที่ผู้แจ้งเขียน — ผู้ถูกตักเตือนเห็นข้อความนี้ในหนังสือ แก้ให้เป็นข้อเท็จจริงที่ตรวจแล้ว</p>
      </div>

      <div>
        <label htmlFor={`${uid}-clauses`} className={smallLabel}>ข้อระเบียบที่ฝ่าฝืน</label>
        <ClausePicker id={`${uid}-clauses`} value={state.clause_ids} extra={asArray(c.default_clauses)} onChange={set("clause_ids")} />
      </div>

      <WitnessFields uid={`${uid}-w`} w1={state.witness_1} w2={state.witness_2}
        onChange={(k, v) => setState((s) => ({ ...s, [k === "w1" ? "witness_1" : "witness_2"]: v }))} />

      <div>
        <label htmlFor={`${uid}-note`} className={smallLabel}>หมายเหตุในหนังสือ (ไม่บังคับ)</label>
        <textarea id={`${uid}-note`} rows={2} maxLength={1000} value={state.note} onChange={set("note")}
          placeholder="เงื่อนไขหรือข้อความเพิ่มเติม" className={cx(inputCls, "resize-y")} />
      </div>

      <p className="rounded-lg bg-gray-50 px-3 py-2 text-xs leading-relaxed text-gray-600 dark:bg-white/[.03] dark:text-gray-400">
        ภาคทัณฑ์ พักงาน ให้ออก และไล่ออก ต้องผ่านคณะกรรมการสอบสวน — {c.stage === "manager" ? "บันทึกที่ “บันทึกวินัยและโทษทางวินัย”" : "ส่งต่อจนถึงผู้จัดการ แล้วฝ่ายบุคคลบันทึกผล"}
      </p>
    </div>
  )
}

function HrReportForm({ state, setState }) {
  const uid = useId()
  const today = nowBangkok().date
  const fe = state.fieldErr || {}
  const set = (k) => (e) => setState((s) => ({ ...s, [k]: e?.target ? e.target.value : e, fieldErr: { ...s.fieldErr, [k]: "" } }))
  return (
    <div className="space-y-4">
      <p className="text-sm leading-relaxed text-gray-700 dark:text-gray-300">
        รายงานผู้จัดการว่าตักเตือนครบแล้วยังฝ่าฝืน หรือเป็นความผิดร้ายแรง — ส่งแล้วเรื่องไปที่ผู้ช่วยผู้จัดการเพื่อตรวจสอบ ก่อนถึงผู้จัดการ
      </p>
      <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_minmax(0,13rem)]">
        <div className="min-w-0">
          <label htmlFor={`${uid}-no`} className={smallLabel}>เลขที่หนังสือ <span className="text-red-600 dark:text-red-400">*</span></label>
          <input id={`${uid}-no`} data-autofocus value={state.report_no} maxLength={200} onChange={set("report_no")} aria-required="true"
            aria-invalid={!!fe.report_no || undefined} aria-describedby={fe.report_no ? `${uid}-no-err` : undefined}
            placeholder="สกต.สร. บค. 1/2569" className={cx(inputCls, fe.report_no && "!border-red-500 dark:!border-red-400")} />
          {fe.report_no && <p id={`${uid}-no-err`} className={errorTextCls}>{fe.report_no}</p>}
        </div>
        <div className="min-w-0">
          <label htmlFor={`${uid}-date`} className={smallLabel}>วันที่ <span className="text-red-600 dark:text-red-400">*</span></label>
          <ThaiDateField id={`${uid}-date`} ariaLabel="วันที่หนังสือรายงาน" value={state.report_date} max={today} error={!!fe.report_date}
            aria-describedby={fe.report_date ? `${uid}-date-err` : undefined} onChange={set("report_date")} className={dateCls} />
          {fe.report_date && <p id={`${uid}-date-err`} className={errorTextCls}>{fe.report_date}</p>}
        </div>
      </div>
      <div>
        <label htmlFor={`${uid}-sum`} className={smallLabel}>สรุปเรื่อง <span className="text-red-600 dark:text-red-400">*</span></label>
        <textarea id={`${uid}-sum`} rows={5} maxLength={4000} value={state.summary} onChange={set("summary")} aria-required="true"
          aria-invalid={!!fe.summary || undefined} aria-describedby={fe.summary ? `${uid}-sum-err` : undefined}
          placeholder="เช่น ตักเตือนครบแล้วยังฝ่าฝืน เสนอพิจารณาตั้งกรรมการสอบสวน"
          className={cx(inputCls, "resize-y leading-relaxed", fe.summary && "!border-red-500 dark:!border-red-400")} />
        {fe.summary && <p id={`${uid}-sum-err`} className={errorTextCls}>{fe.summary}</p>}
      </div>
    </div>
  )
}

function ReasonForm({ id, label, hint, value, onChange, error, placeholder, children }) {
  return (
    <div className="space-y-3">
      <div>
        <label htmlFor={id} className={smallLabel}>{label} <span className="text-red-600 dark:text-red-400">*</span></label>
        <textarea id={id} rows={4} maxLength={1000} value={value} onChange={(e) => onChange(e.target.value)}
          aria-invalid={!!error || undefined} aria-describedby={`${id}-help`} placeholder={placeholder}
          className={cx(inputCls, "resize-y", error && "!border-red-500 dark:!border-red-400")} />
        <p id={`${id}-help`} className={error ? errorTextCls : "mt-1 text-xs text-gray-500 dark:text-gray-400"}>{error || hint}</p>
      </div>
      {children}
    </div>
  )
}

/** ผลการพิจารณา (หนังสือของเรื่องนี้) + ข้อมูลในหนังสือ + บันทึกการรับทราบ */
function ActionBlock({ a, canAck, onAck }) {
  const [pdfBusy, setPdfBusy] = useState(false)
  const openPdf = async () => {
    setPdfBusy(true)
    try { await downloadActionPdf(a) } catch (e) { toast.error("เปิดหนังสือไม่สำเร็จ", { description: apiDetail(e) || "ลองใหม่อีกครั้ง" }) } finally { setPdfBusy(false) }
  }
  const ack = ackText(a, (d) => fmtDate(d, { long: true }))
  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 text-sm">
          <p className="flex flex-wrap items-center gap-2 font-medium text-gray-900 dark:text-gray-100">
            <Badge tone={stepTone(a.step)}>ขั้น {a.step}</Badge>
            {stepLabel(a.step, a.step_label)}
          </p>
          <p className="mt-0.5 text-xs tabular-nums text-gray-500 dark:text-gray-400">
            {a.doc_no ? `เลขที่ ${a.doc_no} · ` : ""}ออกเมื่อ {fmtDate(a.issued_on)}{a.issued_by_name ? ` · โดย ${a.issued_by_name}` : ""}
          </p>
          {a.committee_resolution_no && <p className="mt-0.5 text-gray-700 dark:text-gray-300">{resolutionText(a)}</p>}
          {Number(a.step) === SUSPENSION_STEP && a.suspension_start && (
            <p className="mt-0.5 tabular-nums text-red-800 dark:text-red-200">พักงาน {suspensionText(a)}</p>
          )}
        </div>
        <div className="flex flex-wrap gap-2">
          {a.id != null && (
            <button type="button" onClick={openPdf} disabled={pdfBusy} className={pdfBtnCls}>
              {pdfBusy ? <LoaderCircle aria-hidden="true" className="size-4 animate-spin" /> : <FileDown aria-hidden="true" className="size-4" />}
              หนังสือ PDF
            </button>
          )}
          {canAck && (
            <button type="button" onClick={onAck} className={cx(neutralBtnCls, "md:pointer-fine:!h-9 !px-3 !text-sm")}>บันทึกการรับทราบ</button>
          )}
        </div>
      </div>
      {(a.place || a.act_description || a.clauses?.length > 0) && (
        <dl className="divide-y divide-gray-100 rounded-xl bg-gray-50 px-3 dark:divide-line dark:bg-white/[.03]">
          {a.place && <DetailRow label="สถานที่">{a.place}</DetailRow>}
          {a.act_description && <DetailRow label="พฤติการณ์"><span className="whitespace-pre-wrap break-words">{a.act_description}</span></DetailRow>}
          {a.clauses?.length > 0 && <DetailRow label="ข้อระเบียบ"><ClauseList clauses={a.clauses} /></DetailRow>}
        </dl>
      )}
      <p className="text-xs text-gray-600 dark:text-gray-400">
        {ack || "ยังไม่บันทึกการรับทราบ"}
        {(a.witness_1 || a.witness_2) && ` · พยาน: ${[a.witness_1, a.witness_2].filter(Boolean).join(", ")}`}
      </p>
    </div>
  )
}

// ─── Sheet รายละเอียดเรื่อง ─────────────────────────────────────────────────

const emptyPunish = (c) => ({
  step: null, note: "", place: "", act_description: c?.details ?? "", incident_end: "",
  witness_1: "", witness_2: "", clause_ids: asArray(c?.default_clauses).map((x) => Number(x.id)), err: "", fieldErr: {},
})
const emptyReport = () => ({ report_no: "", report_date: nowBangkok().date, summary: "", fieldErr: {} })

function CaseSheet({ caseId, initialMode = "view", onClose, onChanged, onOpenTermination }) {
  const { can } = useCan()
  const canTerminate = can("hr.employees.terminate")
  const canReadSettings = can("hr.discipline.view")
  const isHrRecorder = can("hr.discipline.recordOutcome")

  const [c, setC] = useState(null)
  const [loading, setLoading] = useState(true)
  const [loadErr, setLoadErr] = useState("")
  const [tick, setTick] = useState(0)

  const [mode, setMode] = useState("view") // view | punish | escalate | dismiss | hrReport | record
  const [pendingMode, setPendingMode] = useState(initialMode)
  const [subSheet, setSubSheet] = useState(null) // { kind: "ack", action } | { kind: "recordPatch" }
  const [busy, setBusy] = useState(false)
  const [punish, setPunish] = useState(() => emptyPunish(null))
  const [report, setReport] = useState(emptyReport)
  const uploads = useFileUploads()
  const [reason, setReason] = useState("")
  const [reasonErr, setReasonErr] = useState("")
  const [falseReport, setFalseReport] = useState(false)
  const [formErr, setFormErr] = useState("")
  const [offerEscalate, setOfferEscalate] = useState(false)
  const [serverPrefill, setServerPrefill] = useState(null)
  const [settings, setSettings] = useState(null)

  useEffect(() => {
    let alive = true
    setLoading(true); setLoadErr("")
    apiAuth(`/hr/discipline/cases/${encodeURIComponent(caseId)}`)
      .then((d) => { if (alive) setC(d) })
      .catch((e) => {
        if (!alive) return
        setLoadErr(e?.status === 404 ? "ไม่พบเรื่องนี้ หรือคุณไม่มีสิทธิ์ดู" : apiDetail(e) || "โหลดรายละเอียดเรื่องไม่สำเร็จ")
      })
      .finally(() => { if (alive) setLoading(false) })
    return () => { alive = false }
  }, [caseId, tick])

  // ช่วงวันพักงานตามระเบียบ — ใช้ในฟอร์มบันทึกวินัย (โทษพักงาน)
  useEffect(() => {
    if (mode !== "record" || !canReadSettings || settings) return
    apiAuth("/hr/discipline/settings").then(setSettings).catch(() => {})
  }, [mode, canReadSettings, settings])

  const open = c?.status === "open"
  const canDecide = !!c?.can_decide && open
  const canHrReport = !!c?.can_write_hr_report && open
  const canRecord = !!c?.can_record_outcome && open
  const withinOptions = asArray(c?.ladder?.allowed_steps).filter((o) => o.within_my_stage !== false && !o.needs_record && Number(o.step) <= MAX_WARNING_STEP)
  const nextStage = c ? NEXT_STAGE[c.stage] : null
  const st = caseStatus(c)

  const toMode = useCallback((m) => {
    if (m === "view" && uploads.ids.length) uploads.discard()
    setMode(m); setFormErr(""); setReasonErr(""); setOfferEscalate(false)
    if (m === "punish") {
      const next = Number(c?.ladder?.next_step)
      const def = withinOptions.find((o) => Number(o.step) === next) ?? (withinOptions.length === 1 ? withinOptions[0] : null)
      setPunish({ ...emptyPunish(c), step: def ? Number(def.step) : null })
    }
    if (m === "hrReport") setReport(emptyReport())
    if (m === "escalate" || m === "dismiss") { setReason(""); setFalseReport(false) }
  }, [c, uploads, withinOptions])

  // เปิดจากปุ่มในแถว ("จัดทำหนังสือรายงาน" / "บันทึกวินัย") → เข้าโหมดนั้นเมื่อโหลดเสร็จและมีสิทธิ์จริง
  useEffect(() => {
    if (!c || pendingMode === "view") return
    if ((pendingMode === "hrReport" && canHrReport) || (pendingMode === "record" && canRecord)) toMode(pendingMode)
    setPendingMode("view")
  }, [c, pendingMode, canHrReport, canRecord, toMode])

  const afterDone = (msg, desc) => {
    toast.success(msg, desc ? { description: desc } : undefined)
    onChanged()
    setMode("view")
    setTick((t) => t + 1)
  }

  const handleErr = (e, fallback) => {
    const detail = apiDetail(e)
    if (e?.status === 409 || e?.status === 403) {
      // 409 = ขั้นผิด / ต้องผ่านคณะกรรมการ / เรื่องปิดแล้ว / งวดเงินเดือนปิด · 403 = ไม่ใช่ขั้นของคุณ
      setOfferEscalate(e.status === 409 && !!nextStage && /ส่งต่อ|อำนาจ/.test(detail))
      setFormErr(detail || fallback)
      if (e.status === 403 || /ปิดแล้ว/.test(detail)) { setTick((t) => t + 1); onChanged() }
      return
    }
    setFormErr(detail || fallback)
  }

  const submitPunish = async () => {
    const step = Number(punish.step)
    if (!step) { setFormErr("เลือกหนังสือก่อน"); return }
    const incidentDay = c.incident_at ? new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Bangkok" }).format(new Date(c.incident_at)) : ""
    if (punish.incident_end && incidentDay && punish.incident_end < incidentDay) {
      setPunish((s) => ({ ...s, fieldErr: { incident_end: "วันสิ้นสุดเหตุต้องไม่ก่อนวันที่เกิดเหตุ" } })); return
    }
    const t = (v) => String(v ?? "").trim() || null
    const body = {
      step,
      note: t(punish.note),
      place: t(punish.place),
      act_description: t(punish.act_description),
      incident_end: punish.incident_end || null,
      witness_1: t(punish.witness_1),
      witness_2: t(punish.witness_2),
      clause_ids: punish.clause_ids,
    }
    setBusy(true); setFormErr(""); setOfferEscalate(false)
    try {
      const res = await apiAuth(`/hr/discipline/cases/${c.id}/punish`, { method: "POST", body })
      const doc = res?.action?.doc_no
      afterDone("ออกหนังสือแล้ว", `${stepLabel(step, res?.action?.step_label)}${doc ? ` · เลขที่ ${doc}` : ""} — แจ้งผู้ถูกตักเตือนแล้ว`)
    } catch (e) {
      handleErr(e, "ออกหนังสือไม่สำเร็จ")
    } finally {
      setBusy(false)
    }
  }

  const submitReport = async () => {
    const fieldErr = {}
    if (!report.report_no.trim()) fieldErr.report_no = "ระบุเลขที่หนังสือ"
    if (!report.report_date) fieldErr.report_date = "ระบุวันที่"
    else if (report.report_date > nowBangkok().date) fieldErr.report_date = "วันที่ต้องไม่เป็นวันในอนาคต"
    if (!report.summary.trim()) fieldErr.summary = "ระบุสรุปเรื่อง"
    if (Object.keys(fieldErr).length) { setReport((s) => ({ ...s, fieldErr })); return }
    setBusy(true); setFormErr("")
    try {
      const res = await apiAuth(`/hr/discipline/cases/${c.id}/hr-report`, {
        method: "POST", body: { report_no: report.report_no.trim(), report_date: report.report_date, summary: report.summary.trim() },
      })
      if (res && typeof res === "object" && res.id != null) setC(res)
      afterDone("ส่งหนังสือรายงานแล้ว", "เรื่องอยู่ที่ผู้ช่วยผู้จัดการเพื่อตรวจสอบและส่งต่อผู้จัดการ")
    } catch (e) {
      handleErr(e, "ส่งหนังสือรายงานไม่สำเร็จ")
    } finally {
      setBusy(false)
    }
  }

  const onRecordSaved = (res) => {
    if (res?.termination_prefill) setServerPrefill(res.termination_prefill)
    const a = res?.action
    afterDone("บันทึกวินัยและโทษทางวินัยแล้ว",
      a ? `${stepLabel(a.step, a.step_label)}${a.doc_no ? ` · เลขที่ ${a.doc_no}` : ""} — แจ้งผู้ถูกลงโทษแล้ว · ปิดเรื่องแล้ว` : "ไม่มีความผิด — ยุติเรื่องแล้ว")
    for (const w of asArray(res?.warnings)) {
      toast.info("ข้อควรระวัง", { description: typeof w === "string" ? w : w?.message || w?.detail || JSON.stringify(w), duration: 10000 })
    }
    const months = asArray(res?.payroll_recalculated)
    if (months.length) {
      toast.info("คำนวณเงินเดือนฉบับร่างใหม่แล้ว", {
        description: `งวด ${months.map((m) => new Date(`${String(m).slice(0, 7)}-01T00:00:00`).toLocaleDateString("th-TH", { month: "short", year: "numeric" })).join(", ")} — หักวันพักงาน`,
      })
    }
    if (res?.termination_prefill && canTerminate) {
      const p = res.termination_prefill
      toast.info("ต้องบันทึกการพ้นสภาพ", {
        description: `${p.reason || "ให้ออก/ไล่ออก"} — บัญชียังใช้งานได้จนกว่าจะบันทึก`,
        duration: Infinity,
        action: {
          label: "บันทึกการพ้นสภาพ",
          onClick: () => onOpenTermination({ id: p.employee_id ?? c.accused_id, first_name: c.accused_name || `รหัส ${c.accused_id}`, last_name: "" }, p),
        },
      })
    }
  }

  const submitReason = async (kind) => {
    if (!reason.trim()) { setReasonErr(kind === "escalate" ? "ระบุเหตุผล / ผลการตรวจสอบ" : "ระบุเหตุผลที่ยุติเรื่อง"); document.getElementById(`${ID_BASE}-reason`)?.focus(); return }
    setBusy(true); setFormErr(""); setOfferEscalate(false)
    try {
      if (kind === "escalate") {
        await apiAuth(`/hr/discipline/cases/${c.id}/escalate`, { method: "POST", body: { reason: reason.trim() } })
        afterDone("ส่งต่อแล้ว", `เรื่องอยู่ที่${stageLabel(nextStage)}`)
      } else {
        await apiAuth(`/hr/discipline/cases/${c.id}/dismiss`, { method: "POST", body: { reason: reason.trim(), false_report: falseReport } })
        afterDone("ยุติเรื่องแล้ว", "ไม่นับเป็นโทษ ผู้แจ้งได้รับแจ้งว่าพิจารณาแล้ว")
      }
    } catch (e) {
      handleErr(e, kind === "escalate" ? "ส่งต่อไม่สำเร็จ" : "ยุติเรื่องไม่สำเร็จ")
    } finally {
      setBusy(false)
    }
  }

  const prefill = c ? terminationPrefillFor(c, serverPrefill) : null
  const showTermination = !!prefill && canTerminate && TERMINATION_STEPS.includes(Number(c?.action?.step))

  // ── ชีตย่อย (สลับแทนชีตหลัก — ไม่ซ้อน modal) ──
  if (subSheet?.kind === "ack") {
    return (
      <AckSheet action={subSheet.action} onClose={() => setSubSheet(null)}
        onSaved={() => { setSubSheet(null); setTick((t) => t + 1); onChanged() }} />
    )
  }
  if (subSheet?.kind === "recordPatch" && c?.record) {
    return (
      <RecordPatchSheet caseId={c.id} record={c.record} onClose={() => setSubSheet(null)}
        onSaved={() => { setSubSheet(null); setTick((t) => t + 1); onChanged() }} />
    )
  }

  // ── footer ──
  const sheetBtn = "!h-11 md:pointer-fine:!h-10 !px-4 !text-sm"
  let footer
  if (!c || (!canDecide && !canHrReport && !canRecord)) {
    footer = <div className="flex justify-end"><button type="button" onClick={onClose} className={cx(neutralBtnCls, sheetBtn)}>ปิด</button></div>
  } else if (mode === "view") {
    const primary = canRecord ? "record" : canHrReport ? "hrReport" : withinOptions.length ? "punish" : "escalate"
    footer = (
      <div className="flex flex-wrap items-center justify-end gap-2 [&>button]:grow md:[&>button]:grow-0">
        {canDecide && <button type="button" onClick={() => toMode("dismiss")} className={cx(neutralBtnCls, sheetBtn, "md:mr-auto")}>ยุติเรื่อง</button>}
        {canDecide && nextStage && (
          <button type="button" onClick={() => toMode("escalate")} className={cx(primary === "escalate" ? primaryBtnCls : neutralBtnCls, sheetBtn)}>
            {escalateLabel(c.stage, nextStage)}
          </button>
        )}
        {canDecide && withinOptions.length > 0 && (
          <button type="button" onClick={() => toMode("punish")} className={cx(primary === "punish" ? primaryBtnCls : neutralBtnCls, sheetBtn)}>ออกหนังสือตักเตือน…</button>
        )}
        {canHrReport && <button type="button" onClick={() => toMode("hrReport")} className={cx(primaryBtnCls, sheetBtn)}>จัดทำหนังสือรายงานผู้จัดการ</button>}
        {canRecord && <button type="button" onClick={() => toMode("record")} className={cx(primaryBtnCls, sheetBtn)}>บันทึกวินัยและโทษทางวินัย</button>}
      </div>
    )
  } else {
    const step = Number(punish.step)
    const confirm = mode === "punish"
      ? { label: step ? `ยืนยัน: ${LADDER.find((s) => s.step === step)?.short ?? `ขั้น ${step}`}` : "ยืนยันออกหนังสือ", cls: primaryBtnCls, run: submitPunish, disabled: !step }
      : mode === "hrReport"
        ? { label: "ส่งหนังสือรายงาน", cls: primaryBtnCls, run: submitReport }
        : mode === "record"
          ? { label: "บันทึกและปิดเรื่อง", cls: primaryBtnCls, form: RECORD_FORM_ID, disabled: uploads.busy }
          : mode === "escalate"
            ? { label: c.stage === "asst" ? "ยืนยันส่งต่อผู้จัดการ" : "ยืนยันส่งต่อ", cls: primaryBtnCls, run: () => submitReason("escalate") }
            : { label: "ยืนยันยุติเรื่อง", cls: dangerBtnCls, run: () => submitReason("dismiss") }
    footer = (
      <div className="grid grid-cols-2 gap-3 md:flex md:justify-end md:gap-2">
        <button type="button" onClick={() => toMode("view")} disabled={busy} className={cx(neutralBtnCls, sheetBtn)}>ย้อนกลับ</button>
        <button type={confirm.form ? "submit" : "button"} form={confirm.form} onClick={confirm.run} disabled={busy || confirm.disabled} className={cx(confirm.cls, sheetBtn)}>
          {busy ? "กำลังบันทึก…" : confirm.label}
        </button>
      </div>
    )
  }

  const title = {
    punish: "ออกหนังสือตักเตือน", escalate: c?.stage === "asst" ? "ตรวจสอบและส่งต่อผู้จัดการ" : "ส่งต่อเรื่อง", dismiss: "ยุติเรื่อง",
    hrReport: "จัดทำหนังสือรายงานผู้จัดการ", record: "บันทึกวินัยและโทษทางวินัย",
  }[mode] ?? (c?.topic || "รายละเอียดเรื่อง")
  const subtitle = c ? `${accusedName(c)} · ${c.topic ? `${c.topic} · ` : ""}เรื่อง #${c.id}` : undefined

  return (
    <Sheet open onClose={onClose} busy={busy} size={mode === "record" ? "full" : mode === "view" ? "xl" : "lg"} title={title} subtitle={subtitle} footer={footer}
      initialFocus={mode === "escalate" || mode === "dismiss" ? `#${ID_BASE}-reason` : undefined}>
      {loading && !c ? (
        <div className="space-y-3" aria-busy="true"><span className="sr-only">กำลังโหลด…</span><Skeleton className="h-6 w-2/3" /><Skeleton className="h-24" /><Skeleton className="h-40" /></div>
      ) : loadErr ? (
        <ErrorState message={loadErr} onRetry={() => setTick((t) => t + 1)} />
      ) : !c ? null : mode === "view" ? (
        <div className="space-y-5">
          <div className="flex flex-wrap items-center gap-2">
            <Badge tone={st.tone}>{st.label}</Badge>
            {open && <Badge tone="info">ขั้น{stageLabel(c.stage, c.stage_label)}</Badge>}
            {c.topic_is_serious && <SeriousBadge />}
            {open && !canDecide && !canHrReport && !canRecord && <span className="text-xs text-gray-500 dark:text-gray-400">ดูอย่างเดียว — ไม่ใช่ขั้นพิจารณาของคุณ</span>}
          </div>

          {showTermination && (
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-amber-50 px-3 py-2.5 text-sm text-amber-950 ring-1 ring-inset ring-amber-200 dark:bg-amber-500/10 dark:text-amber-100 dark:ring-amber-400/20">
              <p className="min-w-0">
                <span className="font-semibold">{prefill.reason || stepLabel(c.action.step)}</span> — ต้องบันทึกการพ้นสภาพ บัญชียังใช้งานได้จนกว่าจะบันทึก
              </p>
              <button type="button" onClick={() => onOpenTermination({ id: c.accused_id, first_name: c.accused_name || `รหัส ${c.accused_id}`, last_name: "" }, prefill)}
                className={cx(primaryBtnCls, "md:pointer-fine:!h-9 !px-3 !text-sm")}>
                <UserX aria-hidden="true" className="size-4" /> บันทึกการพ้นสภาพ
              </button>
            </div>
          )}

          <HrReportBlock c={c} />

          {c.record && (
            <RecordCard caseId={c.id} record={c.record} action={c.action} canEdit={isHrRecorder}
              onEdit={() => setSubSheet({ kind: "recordPatch" })} />
          )}

          <div className="grid gap-5 md:grid-cols-[minmax(0,1fr)_minmax(0,20rem)]">
            <div className="min-w-0 space-y-5">
              <dl className="divide-y divide-gray-100 dark:divide-line">
                <DetailRow label="ผู้ถูกแจ้ง">{accusedName(c)}</DetailRow>
                <DetailRow label="หัวข้อ">{c.topic || "—"}</DetailRow>
                <DetailRow label="เกิดเหตุ"><span className="tabular-nums">{fmtDateTime(c.incident_at)}</span></DetailRow>
                <DetailRow label="แจ้งเมื่อ"><span className="tabular-nums">{fmtDateTime(c.created_at)}</span></DetailRow>
                <DetailRow label="ผู้แจ้ง">
                  {canSeeReporter(c) ? (
                    <>
                      {c.reporter_name || (c.reporter_id != null ? `รหัส ${c.reporter_id}` : "—")}
                      <span className="block text-xs text-gray-500 dark:text-gray-400">ความลับ — ห้ามเปิดเผยต่อผู้ถูกแจ้ง</span>
                    </>
                  ) : <span className="text-gray-500 dark:text-gray-400">ไม่เปิดเผย</span>}
                </DetailRow>
              </dl>

              <section aria-labelledby={`${ID_BASE}-details-h`}>
                <h3 id={`${ID_BASE}-details-h`} className={sectionH}>รายละเอียดจากผู้แจ้ง</h3>
                <p className="whitespace-pre-wrap break-words rounded-xl bg-gray-50 px-3 py-2.5 text-sm text-gray-800 dark:bg-white/[.03] dark:text-gray-200">{c.details || "—"}</p>
              </section>

              <section aria-labelledby={`${ID_BASE}-files-h`}>
                <h3 id={`${ID_BASE}-files-h`} className={sectionH}>หลักฐานและเอกสาร {c.attachments?.length ? `(${c.attachments.length})` : ""}</h3>
                <AttachmentList attachments={c.attachments} emptyText="ไม่มีไฟล์แนบ" />
              </section>

              {!open && (
                <section aria-labelledby={`${ID_BASE}-outcome-h`} className="space-y-2">
                  <h3 id={`${ID_BASE}-outcome-h`} className={sectionH}>{c.record ? "หนังสือที่ออก" : "ผลการพิจารณา"}</h3>
                  {c.action ? (
                    <ActionBlock a={c.action} canAck={canAckAction(c.action, isHrRecorder)} onAck={() => setSubSheet({ kind: "ack", action: c.action })} />
                  ) : (
                    <p className="text-sm text-gray-800 dark:text-gray-200">
                      {c.record ? "ไม่มีความผิด — ไม่ออกหนังสือ" : `ยุติเรื่องโดยไม่ลงโทษ${c.false_report ? " · ระบุว่าแจ้งเท็จ/ไม่มีมูล" : ""}`}
                    </p>
                  )}
                  {c.decision_note && <p className="whitespace-pre-wrap break-words text-sm text-gray-700 dark:text-gray-300">{c.decision_note}</p>}
                  {c.decided_at && <p className="text-xs tabular-nums text-gray-500 dark:text-gray-400">ตัดสินเมื่อ {fmtDateTime(c.decided_at)}</p>}
                </section>
              )}

              <section aria-labelledby={`${ID_BASE}-events-h`}>
                <h3 id={`${ID_BASE}-events-h`} className={sectionH}>การดำเนินการ</h3>
                <EventsTimeline events={c.events} />
              </section>
            </div>

            <section aria-labelledby={`${ID_BASE}-ladder-h`} className="min-w-0">
              <h3 id={`${ID_BASE}-ladder-h`} className={sectionH}>ลำดับขั้นโทษ · {c.topic || "หัวข้อนี้"}</h3>
              <LadderTrack c={c} />
              {open && c.stage === "hr" && (
                <p className="mt-2 rounded-lg bg-indigo-50 px-3 py-2 text-xs leading-relaxed text-indigo-900 dark:bg-indigo-500/10 dark:text-indigo-200">
                  รอฝ่ายบุคคลจัดทำหนังสือรายงานผู้จัดการ — ขั้นนี้ยังออกหนังสือ ส่งต่อ หรือยุติเรื่องไม่ได้
                </p>
              )}
              {open && canDecide && withinOptions.length === 0 && nextStage && (
                <p className="mt-2 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-900 dark:bg-amber-500/10 dark:text-amber-200">
                  ตักเตือนครบแล้ว — {escalateLabel(c.stage, nextStage)}หรือยุติเรื่อง
                </p>
              )}
            </section>
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          {mode !== "record" && mode !== "hrReport" && (
            <p className="text-sm text-gray-700 dark:text-gray-300">
              <span className="font-medium text-gray-900 dark:text-gray-100">{accusedName(c)}</span> · {c.topic}
              {c.topic_is_serious && <> <SeriousBadge /></>}
            </p>
          )}

          {mode === "punish" && <PunishForm c={c} state={punish} setState={setPunish} />}
          {mode === "hrReport" && <HrReportForm state={report} setState={setReport} />}
          {mode === "record" && (
            <>
              <HrReportBlock c={c} />
              <RecordForm formId={RECORD_FORM_ID} c={c} settings={settings} uploads={uploads}
                onBusy={setBusy} onSaved={onRecordSaved} onError={(e) => { if (e?.status === 403 || e?.status === 409) setTick((t) => t + 1) }} />
            </>
          )}

          {mode === "escalate" && (
            <>
              {c.stage === "asst" && <HrReportBlock c={c} />}
              <ReasonForm id={`${ID_BASE}-reason`} label={c.stage === "asst" ? "ผลการตรวจสอบ / ความเห็นถึงผู้จัดการ" : `เหตุผลที่ส่งต่อ${stageLabel(nextStage)}`} value={reason}
                onChange={(v) => { setReason(v); setReasonErr("") }} error={reasonErr}
                hint={`${stageLabel(nextStage)}จะเห็นข้อความนี้ในประวัติการดำเนินการ`}
                placeholder={c.stage === "asst" ? "เช่น ตรวจสอบแล้วข้อเท็จจริงครบ เห็นควรตั้งคณะกรรมการสอบสวน" : "เช่น ตักเตือนเป็นหนังสือแล้วยังฝ่าฝืน"} />
            </>
          )}

          {mode === "dismiss" && (
            <ReasonForm id={`${ID_BASE}-reason`} label="เหตุผลที่ยุติเรื่อง" value={reason}
              onChange={(v) => { setReason(v); setReasonErr("") }} error={reasonErr}
              hint="ยุติแล้วไม่นับเป็นโทษ และผู้แจ้งได้รับแจ้งเพียงว่า “พิจารณาแล้ว”"
              placeholder="เช่น ตรวจสอบแล้วไม่พบการกระทำผิด">
              <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-gray-300 px-3 py-2.5 has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-indigo-500 dark:border-line-field">
                <input type="checkbox" checked={falseReport} onChange={(e) => setFalseReport(e.target.checked)} className="mt-1 accent-red-600" />
                <span className="text-sm">
                  <span className="block font-medium text-gray-900 dark:text-gray-100">แจ้งเท็จ / ไม่มีมูล</span>
                  <span className="block text-xs text-gray-500 dark:text-gray-400">บันทึกไว้เป็นข้อมูล ยังไม่มีบทลงโทษผู้แจ้งอัตโนมัติ</span>
                </span>
              </label>
            </ReasonForm>
          )}

          {formErr && mode !== "record" && (
            <div role="alert" className="space-y-2 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-800 dark:border-red-800/60 dark:bg-red-900/20 dark:text-red-200">
              <p>{formErr}</p>
              {offerEscalate && (
                <button type="button" onClick={() => toMode("escalate")} className={cx(neutralBtnCls, "md:pointer-fine:!h-9 !px-3 !text-sm")}>
                  <ArrowUpRight aria-hidden="true" className="size-4" /> {escalateLabel(c.stage, nextStage)}แทน
                </button>
              )}
            </div>
          )}
        </div>
      )}
    </Sheet>
  )
}

// ─── รายการเรื่อง ───────────────────────────────────────────────────────────

const STAGE_FILTER = [{ value: "", label: "ทุกขั้นพิจารณา" }, ...STAGES]

export default function HRDisciplineTab() {
  const { can } = useCan()
  const canDecide = can("hr.discipline.decide")
  const isHrRecorder = can("hr.discipline.recordOutcome")
  const isPhone = useIsPhone()
  const [params, setParams] = useSearchParams()
  const subs = [...(canDecide ? ["mine"] : []), ...(isHrRecorder ? ["hr"] : []), "open", "closed"]
  const [sub, setSub] = useSubTab(subs, canDecide ? "mine" : isHrRecorder ? "hr" : "open")
  const [stage, setStage] = useState("")
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [reloadKey, setReloadKey] = useState(0)
  const [openState, setOpenState] = useState(() => (params.get("id") ? { id: params.get("id"), mode: "view" } : null))
  const [termination, setTermination] = useState(null) // { employee, prefill }

  const query = useMemo(() => {
    const q = new URLSearchParams()
    q.set("status", sub === "closed" ? "closed" : "open")
    if (sub === "mine") q.set("mine", "true")
    if (sub === "hr") q.set("stage", "hr")
    else if (stage && sub !== "closed") q.set("stage", stage)
    return q.toString()
  }, [sub, stage])

  useEffect(() => {
    let alive = true
    setLoading(true); setError("")
    apiAuth(`/hr/discipline/cases?${query}`)
      .then((d) => { if (alive) setRows(asArray(d)) })
      .catch((e) => { if (alive) setError(apiDetail(e) || "โหลดรายการเรื่องไม่สำเร็จ") })
      .finally(() => { if (alive) setLoading(false) })
    return () => { alive = false }
  }, [query, reloadKey])

  const reload = useCallback(() => setReloadKey((k) => k + 1), [])

  // &action=<action id> (การแจ้งเตือนถึง HR) → หาเรื่องที่ปิดด้วยโทษนั้น
  const actionParam = params.get("action")
  useEffect(() => {
    if (!actionParam) return undefined
    let alive = true
    const clear = () => setParams((prev) => { const p = new URLSearchParams(prev); p.delete("action"); return p }, { replace: true, state: keepBackState() })
    apiAuth("/hr/discipline/cases?status=closed")
      .then((d) => {
        if (!alive) return
        const hit = asArray(d).find((r) => String(r.action?.id ?? r.action_id ?? "") === String(actionParam))
        if (hit) { setOpenState({ id: String(hit.id), mode: "view" }); setParams((prev) => { const p = new URLSearchParams(prev); p.delete("action"); p.set("id", String(hit.id)); return p }, { replace: true, state: keepBackState() }) }
        else { toast.info("ไม่พบเรื่องของการลงโทษนี้ในรายการ", { description: "ดูได้ที่แท็บ “ปิดแล้ว”" }); clear() }
      })
      .catch(() => { if (alive) clear() })
    return () => { alive = false }
  }, [actionParam, setParams])

  const sorted = useMemo(() => {
    const list = [...rows]
    if (sub === "closed") list.sort((a, b) => String(b.decided_at || b.created_at || "").localeCompare(String(a.decided_at || a.created_at || "")))
    else list.sort((a, b) => String(a.created_at || "").localeCompare(String(b.created_at || ""))) // ค้างนานสุดก่อน
    return list
  }, [rows, sub])
  const nf = useNameFilter(sorted, { get: accusedName, label: "ผู้ถูกแจ้ง" })
  const noMatch = nf.rows.length === 0 && nf.total > 0

  const openCase =(r, mode = "view") => setOpenState({ id: String(r.id), mode })
  const closeCase = () => {
    setOpenState(null)
    if (params.get("id")) {
      setParams((prev) => { const p = new URLSearchParams(prev); p.delete("id"); return p }, { replace: true, state: keepBackState() })
    }
  }

  const countOf = (v) => (sub === v && !loading && !error && rows.length ? rows.length : null)
  const tabs = [
    ...(canDecide ? [{ value: "mine", label: "รอฉันพิจารณา", count: countOf("mine") }] : []),
    ...(isHrRecorder ? [{ value: "hr", label: "รอจัดทำหนังสือรายงาน", count: countOf("hr") }] : []),
    { value: "open", label: "ระหว่างพิจารณา" },
    { value: "closed", label: "ปิดแล้ว" },
  ]

  /** ปุ่มในแถว → { label, mode, primary } */
  const rowAction = (r) => {
    if (r.status === "open" && r.can_write_hr_report) return { label: "จัดทำหนังสือรายงาน", mode: "hrReport", primary: true }
    if (r.status === "open" && r.can_record_outcome && !r.can_decide) return { label: "บันทึกวินัย", mode: "record", primary: true }
    if (r.status === "open" && (r.can_decide || sub === "mine")) return { label: "พิจารณา", mode: "view", primary: true }
    return { label: "ดู", mode: "view", primary: false }
  }
  const emptyTitle = { mine: "ไม่มีเรื่องรอคุณพิจารณา", hr: "ไม่มีเรื่องรอจัดทำหนังสือรายงาน", open: "ไม่มีเรื่องที่กำลังพิจารณา" }[sub] ?? "ยังไม่มีเรื่องที่ปิดแล้ว"
  const emptyDesc = sub === "mine"
    ? "เรื่องที่ส่งถึงขั้นของคุณจะแสดงที่นี่ พร้อมแจ้งเตือนที่กระดิ่ง"
    : sub === "hr" ? "เรื่องที่ตักเตือนครบแล้วหรือเป็นความผิดร้ายแรง จะมาถึงฝ่ายบุคคลที่นี่ พร้อมแจ้งเตือนที่กระดิ่ง"
    : stage ? "ลองเลือกทุกขั้นพิจารณา" : "เรื่องที่พนักงานแจ้งจะแสดงที่นี่ตามสิทธิ์ของคุณ"

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <Tabs items={tabs} value={sub} onChange={setSub} ariaLabel="สถานะเรื่อง" idBase={ID_BASE} />
        {sub !== "closed" && sub !== "hr" && (
          <div className="w-full sm:ml-auto sm:w-60">
            <SelectDropdown size="sm" ariaLabel="กรองตามขั้นพิจารณา" value={stage} onChange={setStage} showSwatch={false} options={STAGE_FILTER} />
          </div>
        )}
      </div>

      <div role="tabpanel" id={panelId(ID_BASE, sub)} aria-labelledby={tabId(ID_BASE, sub)} tabIndex={0} className={cx("space-y-3", tabPanelCls)}>
        {error ? (
          <ErrorState message={error} onRetry={reload} />
        ) : isPhone ? (
          <>
          {nf.total > 0 && <NameSearchField nf={nf} />}
          <DataList
            items={nf.rows}
            keyOf={(r) => r.id}
            loading={loading}
            skeletonRows={3}
            title={(r) => accusedName(r)}
            subtitle={(r) => r.topic || "—"}
            badge={(r) => { const s = caseStatus(r); return <Badge tone={s.tone}>{s.label}</Badge> }}
            fields={[
              { label: "เกิดเหตุ", value: (r) => fmtDateTime(r.incident_at) },
              { label: sub === "closed" ? "แจ้งเมื่อ" : "ขั้นพิจารณา", value: (r) => (sub === "closed" ? fmtDate(r.created_at) : stageLabel(r.stage, r.stage_label)), align: "right" },
            ]}
            onClick={(r) => openCase(r, rowAction(r).mode)}
            emptyState={noMatch ? <NameNoMatch nf={nf} /> : <EmptyState title={emptyTitle} description={emptyDesc} />}
          />
          </>
        ) : (
          <div className={cx(cardCls, "overflow-x-auto")}>
            <table className="w-full min-w-[52rem] text-sm">
              <caption className="sr-only">รายการเรื่องร้องเรียน/ตักเตือน</caption>
              <thead className="border-b border-gray-200 text-left text-xs font-semibold text-gray-500 dark:border-line dark:text-gray-400">
                <tr>
                  <NameHeaderCell nf={nf} label="ผู้ถูกแจ้ง" />
                  <th scope="col" className="px-4 py-2.5">หัวข้อ</th>
                  <th scope="col" className="px-4 py-2.5">เกิดเหตุ</th>
                  <th scope="col" className="px-4 py-2.5">{sub === "closed" ? "ผล" : "ขั้นพิจารณา"}</th>
                  <th scope="col" className="px-4 py-2.5">แจ้งเมื่อ</th>
                  <th scope="col" className="px-4 py-2.5"><span className="sr-only">การดำเนินการ</span></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-line">
                {loading ? (
                  <SkeletonTableRows rows={4} cols={6} />
                ) : nf.rows.length === 0 ? (
                  <tr><td colSpan={6}>{noMatch ? <NameNoMatch nf={nf} /> : <EmptyState title={emptyTitle} description={emptyDesc} />}</td></tr>
                ) : nf.rows.map((r) => {
                  const s = caseStatus(r)
                  const act = rowAction(r)
                  return (
                    <tr key={r.id} onClick={() => openCase(r)} className="cursor-pointer align-top transition-colors duration-150 hover:bg-gray-50 dark:hover:bg-white/[.03]">
                      <td className="px-4 py-3 font-medium text-gray-900 dark:text-gray-100">{accusedName(r)}</td>
                      <td className="px-4 py-3">
                        <span className="text-gray-900 dark:text-gray-100">{r.topic || "—"}</span>
                        {r.topic_is_serious && <span className="ml-2 inline-block align-middle"><SeriousBadge /></span>}
                        {r.attachments?.length > 0 && (
                          <span className="ml-2 inline-flex items-center gap-0.5 align-middle text-xs tabular-nums text-gray-500 dark:text-gray-400">
                            <Paperclip aria-hidden="true" className="size-3" />{r.attachments.length}<span className="sr-only"> ไฟล์</span>
                          </span>
                        )}
                        {r.hr_report_no && <span className="mt-0.5 block text-xs tabular-nums text-gray-500 dark:text-gray-400">หนังสือรายงาน {r.hr_report_no}</span>}
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 tabular-nums text-gray-700 dark:text-gray-300">{fmtDateTime(r.incident_at)}</td>
                      <td className="px-4 py-3">
                        {sub === "closed" ? <Badge tone={s.tone}>{s.label}</Badge>
                          : <span className="text-gray-800 dark:text-gray-200">{stageLabel(r.stage, r.stage_label)}</span>}
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 tabular-nums text-gray-500 dark:text-gray-400">{fmtDate(r.created_at)}</td>
                      <td className="px-4 py-3 text-right">
                        <button type="button" onClick={(e) => { e.stopPropagation(); openCase(r, act.mode) }}
                          aria-label={`${act.label} — เรื่องของ ${accusedName(r)} ${r.topic || ""}`}
                          className={cx(
                            act.primary
                              ? "inline-flex h-9 items-center whitespace-nowrap rounded-lg bg-indigo-600 px-3 text-sm font-semibold text-white hover:bg-indigo-500"
                              : "inline-flex h-9 items-center rounded-lg px-3 text-sm font-medium text-indigo-700 hover:bg-indigo-50 dark:text-indigo-300 dark:hover:bg-indigo-500/10",
                            "cursor-pointer transition-colors duration-150", focusRingCls,
                          )}>
                          {act.label}
                        </button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {openState != null && (
        <CaseSheet
          key={`${openState.id}-${openState.mode}`}
          caseId={openState.id}
          initialMode={openState.mode}
          onClose={closeCase}
          onChanged={reload}
          onOpenTermination={(employee, prefill) => { closeCase(); setTermination({ employee, prefill }) }}
        />
      )}
      <TerminationSheet
        open={!!termination}
        onClose={() => setTermination(null)}
        employee={termination?.employee}
        prefill={termination?.prefill}
        onSaved={({ created } = {}) => { if (created) toast.success("บันทึกการพ้นสภาพแล้ว") }}
      />
    </div>
  )
}
