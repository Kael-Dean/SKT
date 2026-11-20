// src/components/hr/discipline/RecordCard.jsx
// ─────────────────────────────────────────────────────────────────────────────
// การ์ด "บันทึกวินัยและโทษทางวินัย" ของเรื่องที่ปิดแล้ว + ชีต "แจ้งผล / อุทธรณ์"
//   GET   /hr/discipline/cases/{id}/record/pdf   (blob)
//   PATCH /hr/discipline/cases/{id}/record       { notified_on, refused_to_sign, witness_1/2, statement_count,
//                                                  appealed, appeal_filed_on, appeal_result, appeal_decided_on, attachment_ids }
//   appeal_deadline = notified_on + 15 วัน (server) · ผลอุทธรณ์ไม่เปลี่ยนโทษอัตโนมัติ
// ─────────────────────────────────────────────────────────────────────────────
import { useId, useState } from "react"
import { FileDown, LoaderCircle } from "lucide-react"
import { apiAuth } from "../../../lib/api"
import { apiDetail } from "../../../lib/apiErrors"
import {
  APPEAL_RESULTS, appealResultLabel, appointedByLabel, daysUntil, downloadRecordPdf, findingLabel, fmtDate,
  memberRoleLabel, noCommitteeReasonLabel, nowBangkok, orderedByLabel, penaltyLabel, suspensionText,
} from "../../../lib/discipline"
import { cx, baseField, errorTextCls, focusRingCls, neutralBtnCls, primaryBtnCls } from "../../../lib/styles"
import { Badge, Sheet, toast } from "../../ui"
import SelectDropdown from "../../SelectDropdown"
import ThaiDateField from "../../ThaiDateField"
import FileUploader from "../../FileUploader"
import useFileUploads from "../../../hooks/useFileUploads"
import { ClauseList } from "./ClausePicker"
import { RefusedToggle, WitnessFields } from "./AckSheet"

const inputCls = cx(baseField, "!rounded-lg !px-3 !py-2 md:!text-sm")
const dateCls = "!rounded-lg !px-3 !py-2 md:!text-sm"
const smallLabel = "mb-1 block text-xs font-medium text-gray-600 dark:text-gray-400"

function Row({ label, children }) {
  return (
    <div className="grid grid-cols-[7.5rem_minmax(0,1fr)] gap-3 py-2 text-sm">
      <dt className="text-gray-500 dark:text-gray-400">{label}</dt>
      <dd className="min-w-0 leading-relaxed text-gray-900 dark:text-gray-100">{children}</dd>
    </div>
  )
}

/** แถบสถานะอุทธรณ์ (นับถอยหลังเมื่อยังอยู่ในกำหนดและยังไม่อุทธรณ์) */
function AppealStatus({ r }) {
  if (r.appealed) {
    return (
      <p className="text-sm text-gray-800 dark:text-gray-200">
        อุทธรณ์แล้ว{r.appeal_filed_on ? ` เมื่อ ${fmtDate(r.appeal_filed_on)}` : ""}
        {r.appeal_result ? ` · ผล: ${appealResultLabel(r.appeal_result, r.appeal_result_label)}${r.appeal_decided_on ? ` (${fmtDate(r.appeal_decided_on)})` : ""}` : " · รอผล"}
      </p>
    )
  }
  if (!r.appeal_deadline) {
    return <p className="text-sm text-gray-600 dark:text-gray-400">{r.finding === "guilty" ? "ยังไม่บันทึกวันที่แจ้งผล — กำหนดอุทธรณ์เริ่มนับเมื่อแจ้งผล" : "—"}</p>
  }
  const left = daysUntil(r.appeal_deadline)
  if (left != null && left >= 0) {
    return (
      <p className="flex flex-wrap items-baseline gap-x-2 text-sm text-amber-900 dark:text-amber-200">
        <span className="text-2xl font-semibold tabular-nums leading-none">{left}</span>
        <span>{left === 0 ? "วันสุดท้ายของการอุทธรณ์ (วันนี้)" : `วัน ก่อนหมดสิทธิ์อุทธรณ์ · ภายใน ${fmtDate(r.appeal_deadline)}`}</span>
      </p>
    )
  }
  return <p className="text-sm text-gray-600 dark:text-gray-400">พ้นกำหนดอุทธรณ์ {fmtDate(r.appeal_deadline)} · ไม่มีการอุทธรณ์</p>
}

export default function RecordCard({ caseId, record: r, action, canEdit, onEdit }) {
  const [pdfBusy, setPdfBusy] = useState(false)
  if (!r) return null
  const guilty = r.finding === "guilty"

  const openPdf = async () => {
    setPdfBusy(true)
    try { await downloadRecordPdf(caseId) } catch (e) { toast.error("เปิดบันทึกไม่สำเร็จ", { description: apiDetail(e) || "ลองใหม่อีกครั้ง" }) } finally { setPdfBusy(false) }
  }

  return (
    <div className="space-y-4 rounded-2xl p-4 ring-1 ring-gray-200 dark:ring-line">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs font-semibold text-gray-500 dark:text-gray-400">บันทึกวินัยและโทษทางวินัย</p>
          <p className="mt-1 flex flex-wrap items-center gap-2 text-base font-semibold text-gray-900 dark:text-gray-100">
            {guilty ? penaltyLabel(r.penalty, r.penalty_label) : findingLabel(r.finding, r.finding_label)}
            <Badge tone={guilty ? (["suspension", "discharge", "dismissal"].includes(r.penalty) ? "danger" : "pending") : "neutral"}>
              {findingLabel(r.finding, r.finding_label)}
            </Badge>
          </p>
          {guilty && r.effective_date && <p className="text-xs tabular-nums text-gray-500 dark:text-gray-400">มีผล {fmtDate(r.effective_date, { long: true })}</p>}
        </div>
        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={openPdf} disabled={pdfBusy}
            className={cx("inline-flex min-h-touch items-center gap-1.5 rounded-lg px-3 text-sm font-medium text-indigo-700 ring-1 ring-inset ring-indigo-200 transition-colors duration-150 hover:bg-indigo-50 disabled:opacity-60 cursor-pointer md:pointer-fine:min-h-9 dark:text-indigo-300 dark:ring-indigo-400/30 dark:hover:bg-indigo-500/10", focusRingCls)}>
            {pdfBusy ? <LoaderCircle aria-hidden="true" className="size-4 animate-spin" /> : <FileDown aria-hidden="true" className="size-4" />}
            บันทึก PDF
          </button>
          {canEdit && (
            <button type="button" onClick={onEdit} className={cx(neutralBtnCls, "md:pointer-fine:!h-9 !px-3 !text-sm")}>แจ้งผล / อุทธรณ์</button>
          )}
        </div>
      </div>

      {guilty && (
        <div className="rounded-xl bg-amber-50 px-3 py-2.5 ring-1 ring-inset ring-amber-200 dark:bg-amber-500/10 dark:ring-amber-400/20">
          <p className="mb-1 text-xs font-semibold text-amber-900 dark:text-amber-200">สิทธิ์อุทธรณ์ (ข้อ 64)</p>
          <AppealStatus r={r} />
        </div>
      )}

      <dl className="divide-y divide-gray-100 dark:divide-line">
        {guilty && (
          <Row label="มติ/คำสั่ง">
            {r.resolution_no || "—"}{r.resolution_date ? ` · ${fmtDate(r.resolution_date, { long: true })}` : ""}
            {r.ordered_by && <span className="block text-xs text-gray-500 dark:text-gray-400">โดย{orderedByLabel(r.ordered_by, r.ordered_by_label)}</span>}
          </Row>
        )}
        {r.penalty === "suspension" && action?.suspension_start && <Row label="พักงาน"><span className="tabular-nums">{suspensionText(action)}</span></Row>}
        {r.penalty === "probation" && r.probation_terms && <Row label="ทัณฑ์บน"><span className="whitespace-pre-wrap">{r.probation_terms}</span></Row>}
        {(r.penalty === "discharge" || r.penalty === "dismissal") && (
          <Row label="ค่าชดเชย">
            {r.severance_paid ? "จ่ายค่าชดเชย" : "ไม่จ่ายค่าชดเชย"}
            {r.damages_amount != null && Number(r.damages_amount) > 0 && (
              <span className="block tabular-nums">ค่าเสียหาย {Number(r.damages_amount).toLocaleString("th-TH", { minimumFractionDigits: 2 })} บาท{r.damages_due ? ` · ชำระภายใน ${fmtDate(r.damages_due)}` : ""}</span>
            )}
          </Row>
        )}
        <Row label="การสอบสวน">
          {r.committee_appointed ? (
            <>
              ตั้งคณะกรรมการโดย{appointedByLabel(r.appointed_by, r.appointed_by_label)} · {r.appointment_order_no}
              {r.appointment_order_date ? ` (${fmtDate(r.appointment_order_date)})` : ""}
              {r.members?.length > 0 && (
                <ul className="mt-1 text-xs text-gray-600 dark:text-gray-400">
                  {r.members.map((m, i) => <li key={m.id ?? i}>{m.name}{m.position ? ` · ${m.position}` : ""} — {memberRoleLabel(m.role, m.role_label)}</li>)}
                </ul>
              )}
            </>
          ) : `ไม่ตั้งคณะกรรมการ — ${noCommitteeReasonLabel(r.no_committee_reason, r.no_committee_reason_label)}`}
          {(r.investigation_finished_on || r.statement_count != null) && (
            <span className="block text-xs tabular-nums text-gray-500 dark:text-gray-400">
              {r.investigation_finished_on ? `สอบสวนเสร็จ ${fmtDate(r.investigation_finished_on)}` : ""}
              {r.statement_count != null ? `${r.investigation_finished_on ? " · " : ""}บันทึกถ้อยคำ ${r.statement_count} ฉบับ` : ""}
            </span>
          )}
        </Row>
        <Row label="สรุปผล"><span className="whitespace-pre-wrap">{r.investigation_summary || "—"}</span></Row>
        {r.clauses?.length > 0 && <Row label="ข้อระเบียบ"><ClauseList clauses={r.clauses} /></Row>}
        <Row label="การแจ้งผล">
          {r.refused_to_sign ? "ปฏิเสธการลงนามรับทราบ" : r.notified_on ? `แจ้งเมื่อ ${fmtDate(r.notified_on, { long: true })}` : "ยังไม่บันทึก"}
          {(r.witness_1 || r.witness_2) && <span className="block text-xs text-gray-500 dark:text-gray-400">พยาน: {[r.witness_1, r.witness_2].filter(Boolean).join(", ")}</span>}
        </Row>
        <Row label="บันทึกโดย">
          {r.recorded_by_name || (r.recorded_by != null ? `รหัส ${r.recorded_by}` : "—")}
          {r.recorded_at && <span className="text-xs text-gray-500 dark:text-gray-400"> · {fmtDate(r.recorded_at)}</span>}
        </Row>
      </dl>
    </div>
  )
}

/** ชีต "แจ้งผล / อุทธรณ์" → PATCH …/record */
export function RecordPatchSheet({ caseId, record: r, onClose, onSaved }) {
  const uid = useId()
  const uploads = useFileUploads()
  const today = nowBangkok().date
  const [f, setF] = useState(() => ({
    notified_on: r?.notified_on ?? "", refused_to_sign: !!r?.refused_to_sign,
    witness_1: r?.witness_1 ?? "", witness_2: r?.witness_2 ?? "",
    statement_count: r?.statement_count != null ? String(r.statement_count) : "",
    appealed: !!r?.appealed, appeal_filed_on: r?.appeal_filed_on ?? "",
    appeal_result: r?.appeal_result ?? "", appeal_decided_on: r?.appeal_decided_on ?? "",
  }))
  const [errors, setErrors] = useState({})
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState("")
  const set = (k) => (v) => { setF((s) => ({ ...s, [k]: v && typeof v === "object" && "target" in v ? v.target.value : v })); setErrors((e) => ({ ...e, [k]: undefined })); setErr("") }

  const close = () => { uploads.discard(); onClose() }

  const save = async (ev) => {
    ev.preventDefault()
    const e = {}
    for (const k of ["notified_on", "appeal_filed_on", "appeal_decided_on"]) if (f[k] && f[k] > today) e[k] = "ต้องไม่เป็นวันในอนาคต"
    if (f.appeal_result && !f.appeal_decided_on) e.appeal_decided_on = "ระบุวันที่วินิจฉัยอุทธรณ์"
    setErrors(e)
    if (Object.keys(e).length) return
    if (uploads.busy) { setErr("รอให้อัปโหลดไฟล์เสร็จก่อน"); return }
    const s = (v) => String(v ?? "").trim() || null
    const appealed = f.appealed || !!f.appeal_filed_on || !!f.appeal_result
    const body = {
      notified_on: f.refused_to_sign ? null : f.notified_on || null,
      refused_to_sign: f.refused_to_sign,
      witness_1: s(f.witness_1), witness_2: s(f.witness_2),
      statement_count: f.statement_count === "" ? null : Number(f.statement_count),
      appealed,
      appeal_filed_on: appealed ? f.appeal_filed_on || null : null,
      appeal_result: appealed ? f.appeal_result || null : null,
      appeal_decided_on: appealed ? f.appeal_decided_on || null : null,
    }
    if (uploads.ids.length) body.attachment_ids = uploads.ids
    setBusy(true); setErr("")
    try {
      const res = await apiAuth(`/hr/discipline/cases/${encodeURIComponent(caseId)}/record`, { method: "PATCH", body })
      uploads.reset()
      toast.success("บันทึกแล้ว", {
        description: res?.appeal_deadline && !res.appealed ? `อุทธรณ์ได้ภายใน ${fmtDate(res.appeal_deadline, { long: true })}` : "พยานและวันที่รับทราบแสดงในหนังสือแล้ว",
      })
      onSaved(res)
    } catch (ex) {
      setErr(apiDetail(ex) || "บันทึกไม่สำเร็จ")
    } finally {
      setBusy(false)
    }
  }

  const dateField = (k, label) => (
    <div className="min-w-0">
      <label htmlFor={`${uid}-${k}`} className={smallLabel}>{label}</label>
      <ThaiDateField id={`${uid}-${k}`} ariaLabel={label} value={f[k]} max={today} error={!!errors[k]} onChange={set(k)} className={dateCls}
        aria-describedby={errors[k] ? `${uid}-${k}-err` : undefined} />
      {errors[k] && <p id={`${uid}-${k}-err`} className={errorTextCls}>{errors[k]}</p>}
    </div>
  )

  return (
    <Sheet open onClose={close} busy={busy} size="lg" title="แจ้งผล / อุทธรณ์" subtitle={penaltyLabel(r?.penalty, r?.penalty_label)}
      footer={(
        <div className="grid grid-cols-2 gap-3 md:flex md:justify-end md:gap-2">
          <button type="button" onClick={close} disabled={busy} className={neutralBtnCls}>ยกเลิก</button>
          <button type="submit" form={`${uid}-form`} disabled={busy || uploads.busy} className={primaryBtnCls}>{busy ? "กำลังบันทึก…" : "บันทึก"}</button>
        </div>
      )}>
      <form id={`${uid}-form`} onSubmit={save} noValidate className="space-y-5">
        <fieldset className="space-y-3">
          <legend className="mb-2 text-xs font-semibold text-gray-500 dark:text-gray-400">การแจ้งผล</legend>
          <RefusedToggle id={`${uid}-refused`} checked={f.refused_to_sign} onChange={set("refused_to_sign")} />
          {!f.refused_to_sign && <div className="sm:max-w-xs">{dateField("notified_on", "วันที่แจ้งผู้ถูกลงโทษ")}</div>}
          <p className="text-xs text-gray-500 dark:text-gray-400">กำหนดอุทธรณ์ = วันที่แจ้ง + 15 วัน · พยานและวันที่จะคัดลอกไปยังหนังสือลงโทษ</p>
          <WitnessFields uid={`${uid}-w`} w1={f.witness_1} w2={f.witness_2} onChange={(k, v) => set(k === "w1" ? "witness_1" : "witness_2")(v)} />
          <div className="sm:max-w-[10rem]">
            <label htmlFor={`${uid}-sc`} className={smallLabel}>จำนวนบันทึกถ้อยคำ</label>
            <input id={`${uid}-sc`} type="text" inputMode="numeric" value={f.statement_count}
              onChange={(e) => set("statement_count")(e.target.value.replace(/[^\d]/g, ""))} className={cx(inputCls, "text-right tabular-nums")} />
          </div>
        </fieldset>

        <fieldset className="space-y-3 border-t border-gray-100 pt-4 dark:border-line">
          <legend className="sr-only">อุทธรณ์</legend>
          <p className="text-xs font-semibold text-gray-500 dark:text-gray-400">อุทธรณ์ (ข้อ 64)</p>
          <label htmlFor={`${uid}-appealed`} className="flex cursor-pointer items-start gap-3 rounded-xl border border-gray-300 px-3 py-2.5 has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-indigo-500 dark:border-line-field">
            <input id={`${uid}-appealed`} type="checkbox" checked={f.appealed} onChange={(e) => set("appealed")(e.target.checked)} className="mt-1 accent-indigo-600" />
            <span className="text-sm font-medium text-gray-900 dark:text-gray-100">ผู้ถูกลงโทษยื่นอุทธรณ์</span>
          </label>
          {(f.appealed || f.appeal_filed_on || f.appeal_result) && (
            <div className="grid gap-3 sm:grid-cols-3">
              {dateField("appeal_filed_on", "วันที่ยื่นอุทธรณ์")}
              <div className="min-w-0">
                <label htmlFor={`${uid}-ar`} className={smallLabel}>ผลอุทธรณ์</label>
                <SelectDropdown id={`${uid}-ar`} size="sm" showSwatch={false} value={f.appeal_result} onChange={set("appeal_result")}
                  options={[{ value: "", label: "— ยังไม่มีผล —" }, ...APPEAL_RESULTS]} />
              </div>
              {dateField("appeal_decided_on", "วันที่วินิจฉัย")}
            </div>
          )}
          {f.appeal_result && f.appeal_result !== "upheld" && (
            <p className="rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-950 dark:bg-amber-500/10 dark:text-amber-100">
              ผลอุทธรณ์ไม่เปลี่ยนโทษในระบบอัตโนมัติ — ถ้ายกเลิกหรือลดโทษ ฝ่ายบุคคลต้องแก้ส่วนที่เกี่ยวข้องเอง (เช่น บันทึกการพ้นสภาพ)
            </p>
          )}
        </fieldset>

        <div className="border-t border-gray-100 pt-4 dark:border-line">
          <FileUploader uploads={uploads} id={`${uid}-files`} label="เอกสารเพิ่มเติม (ไม่บังคับ)" hint="บันทึกถ้อยคำ · หนังสืออุทธรณ์ · คำวินิจฉัย" />
        </div>
        {err && <p role="alert" className={errorTextCls}>{err}</p>}
      </form>
    </Sheet>
  )
}
