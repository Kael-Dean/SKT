// src/pages/hr/tabs/HRLoanSheets.jsx
// ─────────────────────────────────────────────────────────────────────────────
// 3K เงินกองทุนสงเคราะห์ฯ (backend PR #30) — แผ่นงานของผู้อนุมัติ ใช้ใน HRLoansTab
//
//   LoanDetailSheet    รายละเอียดสัญญา + ตารางผ่อน (GET /hr/loans/{id}/schedule)
//                      + ปุ่มตามขั้น + PDF หนังสือกู้/ค้ำ (active/closed) + schedule-pdf
//                      + คำนวณ/บันทึกปิดบัญชี (GET/POST /hr/loans/{id}/payoff — 101/105)
//   LoanDecisionSheet  การพิจารณาตามขั้น (backend PR #50 finance-first — ปุ่มแสดงเมื่อสัญญาอยู่ในคิวของผู้ใช้):
//                        pending           → POST finance-check {note?} · finance-check-reject {reason}
//                                            + สิทธิ์กู้ของผู้กู้ (GET /hr/loans/eligibility?user_id=)
//                        finance_checked   → PATCH hr-approve {} · hr-reject {reason}
//                        manager_forwarded → PATCH finance-confirm {มติคณะทำงานฯ + disbursed_on} · finance-reject {reason, …}
//   LoanSettingsSheet  GET/PATCH /hr/loans/settings (101/105) — ส่งเฉพาะช่องที่แก้
//
// error ทุกตัวแสดง `detail` ของ backend ตามที่ส่งมา (403 = ไม่ใช่ผู้พิจารณาขั้นนี้)
// ─────────────────────────────────────────────────────────────────────────────
import { useCallback, useEffect, useId, useMemo, useState } from "react"
import { FileText } from "lucide-react"
import { apiAuth, apiDownload } from "../../../lib/api"
import { apiDetail } from "../../../lib/apiErrors"
import { saveBlob } from "../../../lib/reportFormat"
import { fmtDateTimeTh } from "../../../lib/approvalActions"
import {
  cx, baseField, labelCls, helpTextCls, errorTextCls, primaryBtnCls, dangerBtnCls, neutralBtnCls,
} from "../../../lib/styles"
import { Badge, ConfirmDialog, ErrorState, Sheet, Skeleton, toast } from "../../../components/ui"
import ThaiDateField from "../../../components/ThaiDateField"
import { can } from "../../../lib/permissions"
import {
  LOAN_PURPOSE_LABEL, PAYOFF_REASONS, asList, borrowerName, financeCheckerName, guarantorText, hasContract,
  loanStatusLabel, loanStatusTone, money, stageActions, thaiDate, todayIso, warningList,
} from "../../../lib/loans"

const fieldCls = cx(baseField, "!rounded-xl !px-3 !py-2 md:!text-sm")
const errBorder = "!border-red-500 dark:!border-red-400"

/** detail ของ backend — ไม่มีก็ใช้ข้อความสำรอง */
const errText = (err, fallback) => apiDetail(err) || fallback

/** ตัวเลขจากช่องกรอก ("" → null) */
const numOrNull = (v) => {
  const s = String(v ?? "").replace(/,/g, "").trim()
  if (!s) return null
  const n = Number(s)
  return Number.isFinite(n) ? n : NaN
}

// note: ช่องหมายเหตุไม่บังคับ (ส่งเป็น note) · reason: เหตุผลบังคับ · eligibility: แสดงสิทธิ์กู้ของผู้กู้ประกอบการตรวจ
const DECISIONS = {
  "finance-check": {
    title: "ตรวจสอบคำขอกู้", method: "POST", ep: "finance-check", note: true, eligibility: true,
    confirm: "ตรวจสอบแล้ว ส่งผู้จัดการ", done: "ตรวจสอบแล้ว ส่งต่อผู้จัดการ",
  },
  "finance-check-reject": {
    title: "ไม่ผ่านการตรวจสอบ", method: "POST", ep: "finance-check-reject", reason: true, eligibility: true, danger: true,
    confirm: "ไม่ผ่านการตรวจสอบ", done: "บันทึกไม่ผ่านการตรวจสอบแล้ว",
  },
  forward: {
    title: "เสนอคณะทำงานกองทุนฯ", method: "PATCH", ep: "hr-approve", emptyBody: true, confirm: "เสนอคณะทำงานกองทุนฯ",
    description: "คณะทำงานกองทุนฯ จะพิจารณาในการประชุม แล้วผู้จัดการบันทึกมติและวันที่จ่ายเงินในระบบ", done: "เสนอคณะทำงานกองทุนฯ แล้ว",
  },
  "hr-reject": {
    title: "ไม่อนุมัติคำขอกู้", method: "PATCH", ep: "hr-reject", reason: true, danger: true,
    confirm: "ไม่อนุมัติ", done: "บันทึกไม่อนุมัติแล้ว",
  },
  "finance-confirm": {
    title: "บันทึกมติคณะทำงานฯ: อนุมัติจ่ายเงินกู้", method: "PATCH", ep: "finance-confirm", committee: "required",
    confirm: "บันทึกมติและจ่ายเงินกู้", done: "บันทึกมติแล้ว สัญญาเริ่มผ่อนชำระ",
  },
  "finance-reject": {
    title: "บันทึกมติคณะทำงานฯ: ไม่อนุมัติ", method: "PATCH", ep: "finance-reject", reason: true, committee: "optional", danger: true,
    confirm: "บันทึกมติไม่อนุมัติ", done: "บันทึกมติไม่อนุมัติแล้ว",
  },
}

function LoanSummaryLine({ loan }) {
  return (
    <p className="text-sm text-gray-600 dark:text-gray-300">
      <span className="font-semibold text-gray-900 dark:text-gray-100">{borrowerName(loan)}</span>
      <span className="mx-1.5 text-gray-300 dark:text-gray-600" aria-hidden="true">·</span>
      <span className="tabular-nums">{money(loan.loan_amount ?? loan.amount)} บาท</span>
      {loan.repayment_months != null && (
        <>
          <span className="mx-1.5 text-gray-300 dark:text-gray-600" aria-hidden="true">·</span>
          <span className="tabular-nums">{loan.repayment_months} งวด</span>
        </>
      )}
    </p>
  )
}

/** รหัสผู้กู้ของสัญญา (ใช้ดึงสิทธิ์กู้) */
const borrowerId = (loan) => loan?.user_id ?? loan?.borrower_id ?? loan?.borrower?.id ?? null

/** อายุงาน: service_months (แบบเดียวกับหน้าพนักงาน) หรือรูปแบบอื่นที่ backend อาจส่ง */
function tenureText(d) {
  const m = d?.service_months ?? d?.tenure_months
  if (m != null && m !== "") {
    const n = Number(m)
    if (!Number.isFinite(n)) return String(m)
    const y = Math.floor(n / 12)
    const r = n % 12
    return y > 0 ? `${y} ปี${r ? ` ${r} เดือน` : ""} (${n} เดือน)` : `${n} เดือน`
  }
  if (d?.service_years != null) return `${d.service_years} ปี`
  return d?.tenure_label || d?.tenure || "—"
}

/**
 * สิทธิ์กู้ของผู้กู้ — GET /hr/loans/eligibility?user_id= (ข้อมูลที่หัวหน้าแผนกการเงินใช้ตรวจ)
 * key แบบเดียวกับ /personnel/me/loans/eligibility (+ ชื่อสำรองเผื่อ backend ตั้งต่าง)
 */
export function LoanEligibilityPanel({ userId }) {
  const uid = useId()
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(userId != null)
  const [error, setError] = useState("")

  const load = useCallback(async () => {
    if (userId == null) return
    setLoading(true)
    setError("")
    try {
      setData(await apiAuth(`/hr/loans/eligibility?user_id=${encodeURIComponent(userId)}`))
    } catch (err) {
      setData(null)
      setError(errText(err, "โหลดสิทธิ์กู้ไม่สำเร็จ"))
    } finally {
      setLoading(false)
    }
  }, [userId])
  useEffect(() => { load() }, [load])

  if (userId == null) return null
  const warnings = warningList(data)
  const incomeCap = data?.income_cap ?? data?.salary_cap
  const salary = data?.salary ?? data?.base_salary
  return (
    <section aria-labelledby={`${uid}-h`} aria-busy={loading || undefined} className="space-y-3 rounded-xl bg-gray-50 p-4 dark:bg-white/[.03]">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h3 id={`${uid}-h`} className="text-sm font-semibold text-gray-900 dark:text-gray-100">สิทธิ์กู้ของผู้กู้</h3>
        {data && (
          <p className="text-sm text-gray-600 dark:text-gray-300">
            วงเงินสูงสุด <strong className="text-base tabular-nums text-indigo-700 dark:text-indigo-300">{money(data.max_amount)}</strong> บาท
          </p>
        )}
      </div>
      {loading ? (
        <Skeleton className="h-20" rounded="rounded-xl" />
      ) : error ? (
        <ErrorState message={error} onRetry={load} />
      ) : data ? (
        <>
          <dl className="grid grid-cols-2 gap-x-4 gap-y-3 sm:grid-cols-3">
            <Info label="อายุงาน">{tenureText(data)}</Info>
            <Info label="เพดานตามอายุงาน"><span className="tabular-nums">{money(data.service_cap)}</span></Info>
            <Info label="เพดานตามเงินเดือน">
              <span className="tabular-nums">{money(incomeCap)}</span>
              {data.multiple != null && salary != null && (
                <span className="block text-xs font-normal text-gray-500 dark:text-gray-400 tabular-nums">{money(salary)} × {data.multiple}</span>
              )}
            </Info>
            <Info label="เงินได้สุทธิล่าสุด"><span className="tabular-nums">{money(data.latest_net_pay)}</span></Info>
            <Info label="วันเกษียณ">{thaiDate(data.retirement_date, { long: true })}</Info>
          </dl>
          {warnings.length > 0 && (
            <ul className="space-y-1 rounded-xl bg-amber-50 px-4 py-3 text-sm text-amber-900 dark:bg-amber-500/10 dark:text-amber-200">
              {warnings.map((w) => <li key={w}>{w}</li>)}
            </ul>
          )}
        </>
      ) : null}
    </section>
  )
}

/** การพิจารณาตามขั้น — forward ไม่มีช่องกรอกใช้ ConfirmDialog, ที่เหลือเป็นฟอร์มใน Sheet */
export function LoanDecisionSheet({ loan, mode, committeeChair, onClose, onDone }) {
  const cfg = DECISIONS[mode]
  const uid = useId()
  const [reason, setReason] = useState("")
  const [note, setNote] = useState("")
  const [committee, setCommittee] = useState({
    committee_set_no: "", committee_meeting_no: "", committee_meeting_date: "",
    committee_chair: "", disbursed_on: todayIso(), monthly_principal: "",
  })
  const [errors, setErrors] = useState({})
  const [busy, setBusy] = useState(false)
  const [serverError, setServerError] = useState("")

  if (!cfg || !loan) return null
  const setC = (k, v) => setCommittee((c) => ({ ...c, [k]: v }))

  const submit = async () => {
    const e = {}
    const body = {}
    if (cfg.reason) {
      if (!reason.trim()) e.reason = "ระบุเหตุผล"
      body.reason = reason.trim()
    }
    if (cfg.note && note.trim()) body.note = note.trim()
    if (cfg.committee) {
      const meetingNo = numOrNull(committee.committee_meeting_no)
      if (cfg.committee === "required") {
        if (meetingNo == null) e.committee_meeting_no = "ระบุครั้งที่ประชุม"
        if (!committee.committee_meeting_date) e.committee_meeting_date = "เลือกวันที่ประชุม"
      }
      if (Number.isNaN(meetingNo)) e.committee_meeting_no = "กรอกเป็นตัวเลข"
      if (cfg.committee === "required") {
        const setNo = numOrNull(committee.committee_set_no)
        const principal = numOrNull(committee.monthly_principal)
        if (Number.isNaN(setNo)) e.committee_set_no = "กรอกเป็นตัวเลข"
        if (Number.isNaN(principal) || (principal != null && principal <= 0)) e.monthly_principal = "กรอกจำนวนเงินมากกว่า 0"
        Object.assign(body, {
          committee_set_no: setNo,
          committee_meeting_no: meetingNo,
          committee_meeting_date: committee.committee_meeting_date || null,
          committee_chair: committee.committee_chair.trim() || null,
          disbursed_on: committee.disbursed_on || null,
          monthly_principal: principal,
        })
      } else {
        if (meetingNo != null) body.committee_meeting_no = meetingNo
        if (committee.committee_meeting_date) body.committee_meeting_date = committee.committee_meeting_date
      }
    }
    setErrors(e)
    if (Object.keys(e).length) {
      if (e.reason) document.getElementById(`${uid}-reason`)?.focus()
      return
    }

    setBusy(true)
    setServerError("")
    try {
      const res = await apiAuth(`/hr/loans/${loan.id}/${cfg.ep}`, {
        method: cfg.method,
        ...(cfg.reason || cfg.committee || cfg.note || cfg.emptyBody ? { body } : {}),
      })
      const extra = res?.first_due_date ? `งวดแรก ${thaiDate(res.first_due_date, { long: true })} · งวดสุดท้าย ${thaiDate(res.last_due_date, { long: true })}` : undefined
      toast.success(`${borrowerName(loan)}: ${cfg.done}`, { description: extra })
      onDone?.(res)
    } catch (err) {
      setServerError(errText(err, "ดำเนินการไม่สำเร็จ ลองใหม่อีกครั้ง"))
    } finally {
      setBusy(false)
    }
  }

  if (!cfg.reason && !cfg.committee && !cfg.note) {
    return (
      <ConfirmDialog
        open
        title={cfg.title}
        description={cfg.description}
        confirmLabel={cfg.confirm}
        tone="primary"
        loading={busy}
        error={serverError}
        onConfirm={submit}
        onCancel={onClose}
      >
        <LoanSummaryLine loan={loan} />
      </ConfirmDialog>
    )
  }

  const field = (key, label, { required, type = "number", placeholder, hint } = {}) => (
    <div>
      <label htmlFor={`${uid}-${key}`} className={labelCls}>
        {label}{required && <span className="text-red-600 dark:text-red-400"> *</span>}
      </label>
      {type === "date" ? (
        <ThaiDateField id={`${uid}-${key}`} value={committee[key]} onChange={(e) => setC(key, e.target.value)}
          error={!!errors[key]} className="!rounded-xl !px-3 !py-2 md:!text-sm" aria-describedby={errors[key] ? `${uid}-${key}-err` : undefined} />
      ) : (
        <input id={`${uid}-${key}`} type="text" inputMode={type === "number" ? "decimal" : undefined}
          value={committee[key]} onChange={(e) => setC(key, e.target.value)} placeholder={placeholder}
          aria-invalid={!!errors[key] || undefined} aria-describedby={errors[key] ? `${uid}-${key}-err` : undefined}
          className={cx(fieldCls, type === "number" && "tabular-nums", errors[key] && errBorder)} />
      )}
      {errors[key] ? <p id={`${uid}-${key}-err`} className={errorTextCls}>{errors[key]}</p> : hint && <p className={helpTextCls}>{hint}</p>}
    </div>
  )

  return (
    <Sheet
      open
      onClose={onClose}
      title={cfg.title}
      busy={busy}
      size="md"
      footer={
        <div className="grid grid-cols-2 gap-3 md:flex md:justify-end md:gap-2">
          <button type="button" onClick={onClose} disabled={busy} className={neutralBtnCls}>ยกเลิก</button>
          <button type="button" onClick={submit} disabled={busy} className={cfg.danger ? dangerBtnCls : primaryBtnCls}>
            {busy ? "กำลังบันทึก…" : cfg.confirm}
          </button>
        </div>
      }
    >
      <div className="space-y-4">
        <LoanSummaryLine loan={loan} />
        {cfg.eligibility && <LoanEligibilityPanel userId={borrowerId(loan)} />}
        {cfg.note && (
          <div>
            <label htmlFor={`${uid}-note`} className={labelCls}>หมายเหตุ / เอกสารที่ได้รับ</label>
            <textarea id={`${uid}-note`} rows={3} value={note} onChange={(e) => setNote(e.target.value)}
              className={cx(fieldCls, "resize-none")} placeholder="ไม่บังคับ" />
          </div>
        )}
        {cfg.committee && (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {cfg.committee === "required" && field("committee_set_no", "คณะทำงานชุดที่")}
            {field("committee_meeting_no", "ประชุมครั้งที่", { required: cfg.committee === "required" })}
            {field("committee_meeting_date", "วันที่ประชุม", { required: cfg.committee === "required", type: "date" })}
            {cfg.committee === "required" && (
              <>
                {field("disbursed_on", "วันที่จ่ายเงิน (เงินสด)", { type: "date", hint: "ไม่บังคับ · ค่าเริ่มต้นเป็นวันนี้" })}
                <div className="sm:col-span-2">
                  {field("committee_chair", "ประธานคณะทำงาน", { type: "text", placeholder: committeeChair || "ตามที่ตั้งค่าไว้", hint: "เว้นว่าง = ชื่อในการตั้งค่ากองทุน" })}
                </div>
                <div className="sm:col-span-2">
                  {field("monthly_principal", "ต้นเงินต่องวด (บาท)", {
                    placeholder: loan.monthly_principal ? money(loan.monthly_principal) : "ตามคำขอ",
                    hint: "เว้นว่าง = ตามคำขอ · ถ้ากำหนด จำนวนงวดจะคำนวณใหม่จากยอดนี้",
                  })}
                </div>
              </>
            )}
          </div>
        )}
        {cfg.reason && (
          <div>
            <label htmlFor={`${uid}-reason`} className={labelCls}>เหตุผล<span className="text-red-600 dark:text-red-400"> *</span></label>
            <textarea id={`${uid}-reason`} rows={3} value={reason} onChange={(e) => setReason(e.target.value)}
              aria-invalid={!!errors.reason || undefined} aria-describedby={errors.reason ? `${uid}-reason-err` : undefined}
              className={cx(fieldCls, "resize-none", errors.reason && errBorder)} placeholder="ผู้กู้จะเห็นเหตุผลนี้" />
            {errors.reason && <p id={`${uid}-reason-err`} className={errorTextCls}>{errors.reason}</p>}
          </div>
        )}
        {serverError && <p role="alert" className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-500/10 dark:text-red-300">{serverError}</p>}
      </div>
    </Sheet>
  )
}

// ─── PDF ─────────────────────────────────────────────────────────────────────

const pdfSpinner = "size-4 shrink-0 animate-spin rounded-full border-2 border-gray-300 border-t-gray-700 dark:border-white/20 dark:border-t-gray-100"

/** เปิด PDF จาก backend ในแท็บใหม่ (ถูกบล็อก → ดาวน์โหลด) · error แสดง detail ตามจริง */
export function LoanPdfButton({ path, label, fallbackName, className = neutralBtnCls, disabled = false }) {
  const [busy, setBusy] = useState(false)
  const open = async () => {
    if (busy || !path) return
    setBusy(true)
    try {
      const { blob, filename } = await apiDownload(path)
      const url = URL.createObjectURL(blob)
      const win = window.open(url, "_blank")
      if (!win) saveBlob(blob, filename && filename !== "download" ? filename : fallbackName)
      setTimeout(() => URL.revokeObjectURL(url), 60_000)
    } catch (err) {
      toast.error(`เปิด${label}ไม่สำเร็จ`, { description: errText(err, "ลองใหม่อีกครั้ง") })
    } finally {
      setBusy(false)
    }
  }
  return (
    <button type="button" onClick={open} disabled={disabled || busy} aria-busy={busy || undefined} className={cx(className, busy && "cursor-wait")}>
      {busy ? <span className={pdfSpinner} aria-hidden="true" /> : <FileText aria-hidden="true" className="size-4 shrink-0 text-rose-600 dark:text-rose-400" strokeWidth={2} />}
      {busy ? "กำลังสร้าง PDF…" : label}
    </button>
  )
}

// ─── รายละเอียดสัญญา ─────────────────────────────────────────────────────────

function Info({ label, children, className }) {
  return (
    <div className={className}>
      <dt className="text-xs text-gray-500 dark:text-gray-400">{label}</dt>
      <dd className="mt-0.5 text-sm font-medium text-gray-900 dark:text-gray-100">{children ?? "—"}</dd>
    </div>
  )
}

function ScheduleTable({ rows }) {
  if (!rows.length) return <p className="py-6 text-center text-sm text-gray-500 dark:text-gray-400">ยังไม่มีตารางผ่อน (สร้างเมื่อบันทึกมติอนุมัติ)</p>
  const th = "px-3 py-2 text-xs font-semibold text-gray-500 dark:text-gray-400"
  return (
    <div className="max-h-[50dvh] overflow-auto rounded-xl ring-1 ring-gray-200/70 dark:ring-line">
      <table className="w-full text-sm">
        <caption className="sr-only">ตารางผ่อนชำระรายงวด</caption>
        <thead className="sticky top-0 bg-gray-50 dark:bg-raised">
          <tr>
            <th scope="col" className={cx(th, "text-left")}>งวด / วันชำระ</th>
            <th scope="col" className={cx(th, "hidden text-right md:table-cell")}>วัน</th>
            <th scope="col" className={cx(th, "hidden text-right sm:table-cell")}>เงินต้น</th>
            <th scope="col" className={cx(th, "hidden text-right sm:table-cell")}>ดอกเบี้ย</th>
            <th scope="col" className={cx(th, "text-right")}>ค่างวด</th>
            <th scope="col" className={cx(th, "hidden text-right md:table-cell")}>คงเหลือ</th>
            <th scope="col" className={cx(th, "text-right")}>สถานะ</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100 dark:divide-line">
          {rows.map((r, i) => (
            <tr key={r.id ?? i} className="even:bg-gray-50/60 dark:even:bg-white/[.02]">
              <td className="px-3 py-2">
                <span className="tabular-nums text-gray-500 dark:text-gray-400">{i + 1}.</span>{" "}
                <span className="text-gray-900 dark:text-gray-100">{r.due_date ? thaiDate(r.due_date) : `${r.month}/${r.year}`}</span>
              </td>
              <td className="hidden px-3 py-2 text-right tabular-nums text-gray-600 dark:text-gray-300 md:table-cell">{r.days ?? "—"}</td>
              <td className="hidden px-3 py-2 text-right tabular-nums text-gray-700 dark:text-gray-300 sm:table-cell">{money(r.principal)}</td>
              <td className="hidden px-3 py-2 text-right tabular-nums text-gray-700 dark:text-gray-300 sm:table-cell">{money(r.interest)}</td>
              <td className="px-3 py-2 text-right font-medium tabular-nums text-gray-900 dark:text-gray-100">{money(r.installment_amount)}</td>
              <td className="hidden px-3 py-2 text-right tabular-nums text-gray-600 dark:text-gray-300 md:table-cell">{money(r.remaining_balance)}</td>
              <td className="px-3 py-2 text-right">
                {r.paid
                  ? <span className="text-xs font-medium text-emerald-700 dark:text-emerald-300">ชำระ {r.paid_on ? thaiDate(r.paid_on) : "แล้ว"}</span>
                  : <span className="text-xs text-gray-500 dark:text-gray-400">ยังไม่ชำระ</span>}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function PayoffPanel({ loan, onRecorded }) {
  const uid = useId()
  const [asOf, setAsOf] = useState(todayIso())
  const [quote, setQuote] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")
  const [reason, setReason] = useState("payoff")
  const [note, setNote] = useState("")
  const [confirming, setConfirming] = useState(false)
  const [saving, setSaving] = useState(false)
  const [saveErr, setSaveErr] = useState("")

  const fetchQuote = async () => {
    if (!asOf) return
    setLoading(true)
    setError("")
    try {
      setQuote({ ...(await apiAuth(`/hr/loans/${loan.id}/payoff?as_of=${encodeURIComponent(asOf)}`)), as_of: asOf })
    } catch (err) {
      setQuote(null)
      setError(errText(err, "คำนวณยอดไม่สำเร็จ"))
    } finally {
      setLoading(false)
    }
  }

  const record = async () => {
    setSaving(true)
    setSaveErr("")
    try {
      await apiAuth(`/hr/loans/${loan.id}/payoff`, {
        method: "POST",
        body: { as_of: quote.as_of, reason, ...(note.trim() ? { note: note.trim() } : {}) },
      })
      setConfirming(false)
      toast.success(`ปิดบัญชีของ ${borrowerName(loan)} แล้ว`, { description: `ยอดชำระ ${money(quote.total)} บาท` })
      onRecorded?.()
    } catch (err) {
      setSaveErr(errText(err, "บันทึกไม่สำเร็จ"))
    } finally {
      setSaving(false)
    }
  }

  const stale = quote && quote.as_of !== asOf
  return (
    <section aria-labelledby={`${uid}-h`} className="space-y-3 rounded-xl bg-gray-50 p-4 dark:bg-white/[.03]">
      <h3 id={`${uid}-h`} className="text-sm font-semibold text-gray-900 dark:text-gray-100">ปิดบัญชีก่อนกำหนด</h3>
      <div className="flex flex-wrap items-end gap-2">
        <div className="min-w-48 flex-1">
          <label htmlFor={`${uid}-asof`} className={labelCls}>ชำระ ณ วันที่</label>
          <ThaiDateField id={`${uid}-asof`} value={asOf} onChange={(e) => setAsOf(e.target.value)} className="!rounded-xl !px-3 !py-2 md:!text-sm" />
        </div>
        <button type="button" onClick={fetchQuote} disabled={loading || !asOf} className={neutralBtnCls}>
          {loading ? "กำลังคำนวณ…" : "คำนวณยอดปิดบัญชี"}
        </button>
      </div>
      {error && <p role="alert" className={errorTextCls}>{error}</p>}
      {quote && (
        <>
          <dl className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            <Info label="เงินต้นคงเหลือ"><span className="tabular-nums">{money(quote.principal)}</span></Info>
            <Info label={`ดอกเบี้ย${quote.interest_from ? ` (ตั้งแต่ ${thaiDate(quote.interest_from)})` : ""}`}><span className="tabular-nums">{money(quote.interest)}</span></Info>
            <Info label={`เบี้ยปรับ${quote.overdue_instalments ? ` (ค้าง ${quote.overdue_instalments} งวด)` : ""}`}><span className="tabular-nums">{money(quote.penalty)}</span></Info>
            <Info label="ยอดที่ต้องชำระ" className="col-span-2 sm:col-span-3">
              <span className="text-lg font-bold tabular-nums text-indigo-700 dark:text-indigo-300">{money(quote.total)} บาท</span>
            </Info>
          </dl>
          {stale && <p className="text-sm text-amber-700 dark:text-amber-300">เปลี่ยนวันที่แล้ว กดคำนวณใหม่ก่อนบันทึก</p>}
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <label htmlFor={`${uid}-reason`} className={labelCls}>เหตุที่ปิดบัญชี</label>
              <select id={`${uid}-reason`} value={reason} onChange={(e) => setReason(e.target.value)} className={fieldCls}>
                {PAYOFF_REASONS.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
              </select>
            </div>
            <div>
              <label htmlFor={`${uid}-note`} className={labelCls}>หมายเหตุ</label>
              <input id={`${uid}-note`} type="text" value={note} onChange={(e) => setNote(e.target.value)} className={fieldCls} placeholder="ไม่บังคับ" />
            </div>
          </div>
          <button type="button" onClick={() => { setSaveErr(""); setConfirming(true) }} disabled={stale} className={primaryBtnCls}>
            บันทึกการปิดบัญชี
          </button>
        </>
      )}
      <ConfirmDialog
        open={confirming}
        title="ยืนยันบันทึกการปิดบัญชี"
        description="สัญญาจะเปลี่ยนเป็นปิดบัญชีทันที และแก้กลับในระบบไม่ได้"
        confirmLabel="ยืนยันปิดบัญชี"
        tone="danger"
        loading={saving}
        error={saveErr}
        onConfirm={record}
        onCancel={() => setConfirming(false)}
      >
        {quote && (
          <p className="text-sm text-gray-700 dark:text-gray-300">
            {borrowerName(loan)} ชำระ <strong className="tabular-nums">{money(quote.total)} บาท</strong> ณ {thaiDate(quote.as_of, { long: true })}
            {" "}({PAYOFF_REASONS.find((r) => r.value === reason)?.label})
          </p>
        )}
      </ConfirmDialog>
    </section>
  )
}

/** รายละเอียดสัญญา — loan = แถวจากรายการ (ข้อมูลตารางผ่อนโหลดเพิ่ม) */
export function LoanDetailSheet({ loan, fromQueue, onClose, onAction, onChanged }) {
  // หนังสือกู้ PDF = hr.loans.detail · ตารางผ่อน (GET /schedule, schedule-pdf) ต้อง loan.view (hr.loans.schedule)
  // — code อื่นใน hr.loans.detail (loan.queue, report.hr.loan_schedule ฯลฯ) ได้ 403 จึงไม่ดึง/ไม่แสดงเลย
  const canDocs = can("hr.loans.detail")
  const canSchedule = can("hr.loans.schedule")
  const [schedule, setSchedule] = useState(null)
  const [schedErr, setSchedErr] = useState("")
  const [schedForbidden, setSchedForbidden] = useState(false)
  const [loadingSched, setLoadingSched] = useState(canSchedule)

  const loadSchedule = useCallback(async () => {
    if (!canSchedule) return
    setLoadingSched(true)
    setSchedErr("")
    try {
      setSchedule(await apiAuth(`/hr/loans/${loan.id}/schedule`))
    } catch (err) {
      // สิทธิ์ใน token ไม่ตรงกับ backend → ซ่อนส่วนตารางผ่อนเงียบ ๆ ไม่ขึ้น error
      if (err?.status === 403) setSchedForbidden(true)
      else setSchedErr(errText(err, "โหลดตารางผ่อนไม่สำเร็จ"))
    } finally {
      setLoadingSched(false)
    }
  }, [canSchedule, loan.id])

  useEffect(() => { loadSchedule() }, [loadSchedule])

  const rows = useMemo(() => asList(schedule, "rows", "schedule"), [schedule])
  // บาง backend ส่งข้อมูลสัญญามากับ schedule ด้วย — รวมทับแถวจากรายการ
  const info = useMemo(() => ({ ...loan, ...(schedule && !Array.isArray(schedule) ? schedule : {}) }), [loan, schedule])
  const actions = stageActions(loan, { fromQueue })
  const warnings = warningList(info)
  const reasonText = info.rejected_reason || info.reject_reason || info.rejection_reason
  const checker = financeCheckerName(info)

  return (
    <Sheet
      open
      onClose={onClose}
      title={`สัญญาเงินกู้ #${loan.id}`}
      subtitle={borrowerName(loan)}
      size="lg"
      footer={actions.length > 0 ? (
        <div className="grid grid-cols-2 gap-3 md:flex md:justify-end md:gap-2">
          {[...actions].reverse().map((a) => (
            <button key={a.mode} type="button" onClick={() => onAction(loan, a.mode)} className={a.danger ? neutralBtnCls : primaryBtnCls}>
              {a.label}
            </button>
          ))}
        </div>
      ) : undefined}
    >
      <div className="space-y-5">
        <div className="flex flex-wrap items-center gap-2">
          <Badge tone={loanStatusTone(loan)}>{loanStatusLabel(info)}</Badge>
          {info.purpose_code && <span className="text-sm text-gray-600 dark:text-gray-300">{LOAN_PURPOSE_LABEL[info.purpose_code] ?? info.purpose_code}</span>}
        </div>

        {warnings.length > 0 && (
          <ul className="space-y-1 rounded-xl bg-amber-50 px-4 py-3 text-sm text-amber-900 dark:bg-amber-500/10 dark:text-amber-200">
            {warnings.map((w) => <li key={w}>{w}</li>)}
          </ul>
        )}
        {loan.status === "rejected" && reasonText && (
          <p className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-800 dark:bg-red-500/10 dark:text-red-200">เหตุผลที่ไม่อนุมัติ: {reasonText}</p>
        )}

        <dl className="grid grid-cols-2 gap-x-4 gap-y-3 sm:grid-cols-3">
          <Info label="วงเงินกู้"><span className="tabular-nums">{money(info.loan_amount ?? info.amount)} บาท</span></Info>
          <Info label="จำนวนงวด"><span className="tabular-nums">{info.repayment_months ?? "—"}</span></Info>
          <Info label="ต้นเงินต่องวด"><span className="tabular-nums">{money(info.monthly_principal)}</span></Info>
          <Info label="ค่างวดสูงสุด"><span className="tabular-nums">{money(info.monthly_installment ?? info.max_installment)}</span></Info>
          <Info label="ดอกเบี้ยรวม (ประมาณ)"><span className="tabular-nums">{money(info.total_interest ?? info.total_interest_estimate)}</span></Info>
          <Info label="ผ่อนนอกกองทุน/เดือน"><span className="tabular-nums">{money(info.external_deductions)}</span></Info>
          <Info label="วันที่ยื่น">{thaiDate(info.created_at)}</Info>
          <Info label="วันที่จ่ายเงิน (เงินสด)">{thaiDate(info.disbursed_on)}</Info>
          <Info label="งวดแรก / งวดสุดท้าย">{info.first_due_date ? `${thaiDate(info.first_due_date)} – ${thaiDate(info.last_due_date)}` : "—"}</Info>
          <Info label="ผู้ค้ำประกัน" className="col-span-2 sm:col-span-3">{guarantorText(info)}</Info>
          {(checker || info.finance_checked_at) && (
            <Info label="ตรวจสอบโดยการเงิน" className="col-span-2 sm:col-span-3">
              {checker || "—"}
              {info.finance_checked_at && <span className="font-normal text-gray-600 dark:text-gray-300"> · <span className="tabular-nums">{fmtDateTimeTh(info.finance_checked_at)}</span></span>}
              {info.finance_note && <span className="mt-0.5 block font-normal text-gray-700 dark:text-gray-300">{info.finance_note}</span>}
            </Info>
          )}
          {info.committee_meeting_no != null && (
            <Info label="มติคณะทำงานกองทุนฯ" className="col-span-2 sm:col-span-3">
              {info.committee_set_no != null && `ชุดที่ ${info.committee_set_no} `}ครั้งที่ {info.committee_meeting_no}
              {info.committee_meeting_date && ` วันที่ ${thaiDate(info.committee_meeting_date, { long: true })}`}
              {info.committee_chair && ` · ประธาน ${info.committee_chair}`}
            </Info>
          )}
          {info.purpose && <Info label="รายละเอียดการกู้" className="col-span-2 sm:col-span-3"><span className="font-normal">{info.purpose}</span></Info>}
        </dl>

        {loan.status === "pending" && fromQueue && <LoanEligibilityPanel userId={borrowerId(loan)} />}

        {((canDocs && hasContract(loan)) || (canSchedule && !schedForbidden && rows.length > 0)) && (
          <div className="flex flex-wrap gap-2">
            {canDocs && hasContract(loan) && (
              <LoanPdfButton path={`/hr/loans/${loan.id}/contract-pdf`} label="หนังสือกู้ + ค้ำประกัน" fallbackName={`loan_contract_${loan.id}.pdf`} />
            )}
            {canSchedule && !schedForbidden && rows.length > 0 && (
              <LoanPdfButton path={`/hr/loans/${loan.id}/schedule-pdf`} label="ตารางผ่อน PDF" fallbackName={`loan_schedule_${loan.id}.pdf`} />
            )}
          </div>
        )}

        {canSchedule && !schedForbidden && (
          <section aria-label="ตารางผ่อนชำระ" className="space-y-2">
            <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">ตารางผ่อนชำระ</h3>
            {loadingSched ? (
              <Skeleton className="h-40" rounded="rounded-xl" />
            ) : schedErr ? (
              <ErrorState message={schedErr} onRetry={loadSchedule} />
            ) : (
              <ScheduleTable rows={rows} />
            )}
          </section>
        )}

        {loan.status === "active" && can("hr.loans.payoff") && (
          <PayoffPanel loan={loan} onRecorded={() => { onChanged?.(); onClose() }} />
        )}
      </div>
    </Sheet>
  )
}

// ─── ตั้งค่ากองทุน ───────────────────────────────────────────────────────────

const SETTING_FIELDS = [
  { key: "committee_chair", label: "ประธานคณะทำงานกองทุนฯ" },
  { key: "committee_vice", label: "รองประธาน" },
  { key: "committee_secretary", label: "เลขานุการ" },
  { key: "committee_term", label: "วาระ / ชุดที่", hint: "พิมพ์ในหนังสือกู้และทะเบียนคุม" },
  { key: "retirement_age", label: "อายุเกษียณ (ปี)", numeric: true, hint: "งวดสุดท้ายต้องไม่เกินวันเกษียณ" },
]

export function LoanSettingsSheet({ onClose, onSaved }) {
  const uid = useId()
  const [orig, setOrig] = useState(null)
  const [form, setForm] = useState({})
  const [loading, setLoading] = useState(true)
  const [loadErr, setLoadErr] = useState("")
  const [saving, setSaving] = useState(false)
  const [saveErr, setSaveErr] = useState("")

  const load = useCallback(async () => {
    setLoading(true)
    setLoadErr("")
    try {
      const d = await apiAuth("/hr/loans/settings")
      setOrig(d || {})
      setForm(Object.fromEntries(SETTING_FIELDS.map((f) => [f.key, d?.[f.key] ?? ""])))
    } catch (err) {
      setLoadErr(errText(err, "โหลดการตั้งค่าไม่สำเร็จ"))
    } finally {
      setLoading(false)
    }
  }, [])
  useEffect(() => { load() }, [load])

  const changed = useMemo(() => {
    if (!orig) return {}
    const out = {}
    for (const f of SETTING_FIELDS) {
      const now = String(form[f.key] ?? "").trim()
      if (now !== String(orig[f.key] ?? "").trim()) out[f.key] = f.numeric ? (now === "" ? null : Number(now)) : (now || null)
    }
    return out
  }, [form, orig])
  const ageBad = changed.retirement_age != null && !(Number.isInteger(changed.retirement_age) && changed.retirement_age > 0 && changed.retirement_age <= 100)
  const dirty = Object.keys(changed).length > 0

  const save = async () => {
    if (!dirty || ageBad) return
    setSaving(true)
    setSaveErr("")
    try {
      const d = await apiAuth("/hr/loans/settings", { method: "PATCH", body: changed })
      toast.success("บันทึกการตั้งค่ากองทุนแล้ว")
      onSaved?.(d)
      onClose()
    } catch (err) {
      setSaveErr(errText(err, "บันทึกไม่สำเร็จ"))
    } finally {
      setSaving(false)
    }
  }

  return (
    <Sheet
      open
      onClose={onClose}
      title="ตั้งค่ากองทุนสงเคราะห์ฯ"
      subtitle="ชื่อคณะทำงานที่พิมพ์ในหนังสือกู้ และอายุเกษียณที่ใช้ตรวจคำขอ"
      busy={saving}
      size="md"
      footer={
        <div className="grid grid-cols-2 gap-3 md:flex md:justify-end md:gap-2">
          <button type="button" onClick={onClose} disabled={saving} className={neutralBtnCls}>ยกเลิก</button>
          <button type="button" onClick={save} disabled={saving || loading || !dirty || ageBad} className={primaryBtnCls}>
            {saving ? "กำลังบันทึก…" : "บันทึก"}
          </button>
        </div>
      }
    >
      {loading ? (
        <div className="space-y-3">{[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-14" rounded="rounded-xl" />)}</div>
      ) : loadErr ? (
        <ErrorState message={loadErr} onRetry={load} />
      ) : (
        <div className="space-y-4">
          {SETTING_FIELDS.map((f) => {
            const bad = f.key === "retirement_age" && ageBad
            return (
              <div key={f.key}>
                <label htmlFor={`${uid}-${f.key}`} className={labelCls}>{f.label}</label>
                <input id={`${uid}-${f.key}`} type="text" inputMode={f.numeric ? "numeric" : undefined}
                  value={form[f.key] ?? ""} onChange={(e) => setForm((s) => ({ ...s, [f.key]: e.target.value }))}
                  aria-invalid={bad || undefined}
                  className={cx(fieldCls, f.numeric && "tabular-nums", bad && errBorder)} />
                {bad ? <p className={errorTextCls}>กรอกอายุเป็นจำนวนเต็ม (ปี)</p> : f.hint && <p className={helpTextCls}>{f.hint}</p>}
              </div>
            )
          })}
          {saveErr && <p role="alert" className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-500/10 dark:text-red-300">{saveErr}</p>}
        </div>
      )}
    </Sheet>
  )
}
