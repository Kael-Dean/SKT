// src/pages/hr/tabs/HRDisciplineTab.jsx
// ─────────────────────────────────────────────────────────────────────────────
// เรื่องร้องเรียน/ตักเตือน (งวด 4 · 3Q) — ผู้พิจารณา (หัวหน้า / ผช.ผจก. / ผจก.) และ HR (ดูอย่างเดียว)
// เปิดจาก /hr/dashboard?tab=discipline และ /hr/discipline (HRDiscipline.jsx)
//
//   GET  /hr/discipline/cases?status=open|closed&stage=&mine=true   backend กรองเฉพาะเรื่องที่ผู้เรียกเห็นได้
//   GET  /hr/discipline/cases/{id}                                  รายละเอียด + ladder + events + attachments
//   POST /hr/discipline/cases/{id}/escalate  { reason }
//   POST /hr/discipline/cases/{id}/punish    { step, note?, suspension_start?, suspension_end? }
//        → { case, action, termination_prefill }  (ขั้น 7/8 → ปุ่ม "บันทึกการพ้นสภาพ")
//   POST /hr/discipline/cases/{id}/dismiss   { reason, false_report }
//
// ปุ่มทั้งหมดอิง server: can_decide (เรื่องอยู่ที่ขั้นของฉัน) + allowed_steps[].within_my_stage
// ผู้แจ้ง: แสดงเฉพาะเมื่อ key reporter_* มีอยู่จริง (backend ตัด key ทิ้งเมื่อไม่มีสิทธิ์เห็น)
//
// Deep link: &id=<case id> (การแจ้งเตือน discipline_case) · &action=<action id> (discipline_action ขั้น 7/8 ถึง HR)
// ─────────────────────────────────────────────────────────────────────────────
import { useCallback, useEffect, useId, useMemo, useState } from "react"
import { useSearchParams } from "react-router-dom"
import { ArrowUpRight, FileDown, LoaderCircle, Paperclip, UserX } from "lucide-react"
import { apiAuth } from "../../../lib/api"
import { apiDetail } from "../../../lib/apiErrors"
import { useCan } from "../../../lib/permissions"
import { keepBackState } from "../../../lib/drill"
import {
  cx, baseField, cardCls, dangerBtnCls, errorTextCls, focusRingCls, neutralBtnCls, primaryBtnCls, tabPanelCls,
} from "../../../lib/styles"
import {
  EVENT_LABEL, LADDER, NEXT_STAGE, STAGES, SUSPENSION_STEP, TERMINATION_STEPS,
  asArray, canSeeReporter, caseStatus, downloadActionPdf, fmtDate, fmtDateTime, inclusiveDays, stageLabel,
  stepLabel, stepTone, suspensionText, terminationPrefillFor,
} from "../../../lib/discipline"
import { useIsPhone } from "../../../hooks/useMediaQuery"
import {
  Badge, DataList, EmptyState, ErrorState, Sheet, Skeleton, SkeletonTableRows, Tabs, panelId, tabId, toast, useSubTab,
} from "../../../components/ui"
import SelectDropdown from "../../../components/SelectDropdown"
import ThaiDateField from "../../../components/ThaiDateField"
import AttachmentList from "../../../components/AttachmentList"
import { TerminationSheet } from "../../../components/hr/TerminationForm"

const ID_BASE = "hr-disc"
const inputCls = cx(baseField, "!rounded-lg !px-3 !py-2 md:!text-sm")
const smallLabel = "mb-1 block text-xs font-medium text-gray-600 dark:text-gray-400"
const sectionH = "mb-2 text-xs font-semibold text-gray-500 dark:text-gray-400"

const accusedName = (c) => c?.accused_name || (c?.accused_id != null ? `รหัส ${c.accused_id}` : "—")

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
  const stageMax = Number(ladder.stage_max_step) || null
  const issued = c.action?.step != null ? Number(c.action.step) : null

  return (
    <ol className="relative space-y-0.5" aria-label="ลำดับขั้นโทษของหัวข้อนี้">
      {LADDER.map((s) => {
        const done = earlier.get(s.step)
        const isIssued = issued === s.step
        const isNext = open && next === s.step
        const isAllowed = open && allowed.has(s.step)
        const beyond = open && !s.marker && stageMax != null && s.step > stageMax && s.step >= (next ?? 0)
        const state = isIssued ? "issued" : done ? "done" : isNext ? "next" : isAllowed ? "allowed" : "idle"
        return (
          <li key={s.step} className={cx(
            "relative grid grid-cols-[1.5rem_minmax(0,1fr)] items-start gap-3 rounded-lg px-2 py-1.5",
            state === "next" && "bg-indigo-50 ring-1 ring-inset ring-indigo-200 dark:bg-indigo-500/10 dark:ring-indigo-400/30",
            state === "issued" && "bg-red-50 ring-1 ring-inset ring-red-200 dark:bg-red-500/10 dark:ring-red-400/25",
          )}>
            <span aria-hidden="true" className={cx(
              "mt-0.5 flex size-6 items-center justify-center rounded-full text-xs font-semibold tabular-nums",
              s.marker ? "border border-dashed border-gray-300 text-gray-400 dark:border-white/20 dark:text-gray-500"
                : state === "done" ? "bg-gray-700 text-white dark:bg-gray-300 dark:text-gray-900"
                : state === "issued" ? "bg-red-600 text-white dark:bg-red-500"
                : state === "next" ? "bg-indigo-600 text-white dark:bg-indigo-500"
                : state === "allowed" ? "bg-white text-indigo-700 ring-1 ring-indigo-300 dark:bg-transparent dark:text-indigo-300 dark:ring-indigo-400/40"
                : "bg-gray-100 text-gray-400 dark:bg-white/[.06] dark:text-gray-500",
            )}>
              {s.marker ? "" : s.step}
            </span>
            <div className="min-w-0">
              <p className={cx(
                "text-sm",
                s.marker ? "text-gray-500 italic dark:text-gray-400"
                  : state === "idle" ? "text-gray-500 dark:text-gray-400"
                  : "font-medium text-gray-900 dark:text-gray-100",
              )}>
                {s.marker ? s.label : stepLabel(s.step, isNext ? ladder.next_step_label : allowed.get(s.step)?.label)}
                {state === "next" && <span className="ml-2 text-xs font-semibold text-indigo-700 dark:text-indigo-300">ขั้นถัดไป</span>}
                {state === "issued" && <span className="ml-2 text-xs font-semibold text-red-700 dark:text-red-300">ลงโทษในเรื่องนี้</span>}
              </p>
              {done && (
                <p className="text-xs tabular-nums text-gray-500 dark:text-gray-400">
                  {done.doc_no ? `${done.doc_no} · ` : ""}{fmtDate(done.issued_on)}
                </p>
              )}
              {!done && !s.marker && (state === "next" || state === "allowed" || state === "idle") && (
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  ผู้มีอำนาจ: {s.by}
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
              {e.action === "escalated" && e.from_stage
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

// ─── ฟอร์มตัดสิน (อยู่ใน Sheet เดียวกัน — ไม่ซ้อน modal) ─────────────────────

function PunishForm({ c, state, setState, settings }) {
  const uid = useId()
  const ladder = c.ladder || {}
  const options = asArray(ladder.allowed_steps)
  const nextStage = NEXT_STAGE[c.stage]
  const step = Number(state.step) || null
  const days = inclusiveDays(state.start, state.end)
  const minD = settings?.suspension_min_days
  const maxD = settings?.suspension_max_days

  return (
    <div className="space-y-4">
      <fieldset>
        <legend className={smallLabel}>เลือกโทษ <span className="text-red-600 dark:text-red-400">*</span></legend>
        {c.topic_is_serious && options.length > 1 && (
          <p className="mb-2 text-xs text-gray-600 dark:text-gray-400">หัวข้อร้ายแรง: เลือกโทษที่ขั้นถัดไปหรือหนักกว่าได้</p>
        )}
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
                  {!within && (
                    <span className="mt-0.5 block text-xs text-amber-800 dark:text-amber-300">
                      เกินอำนาจขั้นของคุณ — {nextStage ? `ส่งต่อให้${stageLabel(nextStage)}พิจารณา` : "ต้องให้ผู้มีอำนาจพิจารณา"}
                    </span>
                  )}
                </span>
              </label>
            )
          })}
        </div>
      </fieldset>

      {step === SUSPENSION_STEP && (
        <fieldset className="space-y-2 rounded-xl bg-gray-50 p-3 dark:bg-white/[.03]">
          <legend className="sr-only">ช่วงพักงาน</legend>
          <p className="text-sm font-medium text-gray-900 dark:text-gray-100">ช่วงพักงาน (งดจ่ายค่าจ้างวันทำงานที่พัก)</p>
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label htmlFor={`${uid}-start`} className={smallLabel}>ตั้งแต่วันที่</label>
              <ThaiDateField id={`${uid}-start`} ariaLabel="วันเริ่มพักงาน" value={state.start} error={!!state.dateErr}
                onChange={(e) => setState((s) => ({ ...s, start: e.target.value, end: s.end && s.end < e.target.value ? e.target.value : s.end, dateErr: "", err: "" }))}
                className="!rounded-lg !px-3 !py-2 md:!text-sm" />
            </div>
            <div>
              <label htmlFor={`${uid}-end`} className={smallLabel}>ถึงวันที่</label>
              <ThaiDateField id={`${uid}-end`} ariaLabel="วันสุดท้ายที่พักงาน" value={state.end} error={!!state.dateErr}
                onChange={(e) => setState((s) => ({ ...s, end: e.target.value, dateErr: "", err: "" }))}
                className="!rounded-lg !px-3 !py-2 md:!text-sm" />
            </div>
          </div>
          {state.dateErr ? <p role="alert" className={errorTextCls}>{state.dateErr}</p> : (
            <p className="text-xs tabular-nums text-gray-600 dark:text-gray-400">
              {days ? `รวม ${days} วัน (นับวันแรกและวันสุดท้าย)` : "เลือกวันเริ่มและวันสุดท้าย"}
              {minD != null && maxD != null ? ` · ตามระเบียบ ${minD}–${maxD} วัน` : ""}
            </p>
          )}
        </fieldset>
      )}

      <div>
        <label htmlFor={`${uid}-note`} className={smallLabel}>หมายเหตุในหนังสือ (ไม่บังคับ)</label>
        <textarea id={`${uid}-note`} rows={3} maxLength={1000} value={state.note}
          onChange={(e) => setState((s) => ({ ...s, note: e.target.value }))}
          placeholder="ข้อเท็จจริงหรือเงื่อนไขที่ต้องการให้ปรากฏในหนังสือ" className={cx(inputCls, "resize-y")} />
      </div>

      {step >= 7 && (
        <p className="rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-950 dark:bg-amber-500/10 dark:text-amber-100">
          หลังออกหนังสือ ฝ่ายบุคคลต้องบันทึกการพ้นสภาพ บัญชีของพนักงานยังใช้งานได้จนกว่าจะบันทึก
          {step === 8 ? " · ไล่ออกไม่จ่ายเงินชดเชยเป็นค่าเริ่มต้น" : ""}
        </p>
      )}
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

// ─── Sheet รายละเอียดเรื่อง ─────────────────────────────────────────────────

const EMPTY_PUNISH = { step: null, start: "", end: "", note: "", dateErr: "", err: "" }

function CaseSheet({ caseId, onClose, onChanged, onOpenTermination }) {
  const { can } = useCan()
  const canTerminate = can("hr.employees.terminate")
  const canReadSettings = can("hr.discipline.view")

  const [c, setC] = useState(null)
  const [loading, setLoading] = useState(true)
  const [loadErr, setLoadErr] = useState("")
  const [tick, setTick] = useState(0)

  const [mode, setMode] = useState("view") // view | punish | escalate | dismiss
  const [busy, setBusy] = useState(false)
  const [punish, setPunish] = useState(EMPTY_PUNISH)
  const [reason, setReason] = useState("")
  const [reasonErr, setReasonErr] = useState("")
  const [falseReport, setFalseReport] = useState(false)
  const [formErr, setFormErr] = useState("")
  const [offerEscalate, setOfferEscalate] = useState(false)
  const [serverPrefill, setServerPrefill] = useState(null)
  const [settings, setSettings] = useState(null)
  const [pdfBusy, setPdfBusy] = useState(false)

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

  // ช่วงวันพักงานตามระเบียบ (อ่านได้เมื่อมี discipline.view) — โหลดเมื่อเปิดฟอร์มลงโทษที่มีขั้น 6
  const hasSuspensionOption = asArray(c?.ladder?.allowed_steps).some((s) => Number(s.step) === SUSPENSION_STEP)
  useEffect(() => {
    if (mode !== "punish" || !hasSuspensionOption || !canReadSettings || settings) return
    apiAuth("/hr/discipline/settings").then(setSettings).catch(() => {})
  }, [mode, hasSuspensionOption, canReadSettings, settings])

  const open = c?.status === "open"
  const canDecide = !!c?.can_decide && open
  const options = asArray(c?.ladder?.allowed_steps)
  const withinOptions = options.filter((o) => o.within_my_stage !== false)
  const nextStage = c ? NEXT_STAGE[c.stage] : null
  const st = caseStatus(c)

  const toMode = (m) => {
    setMode(m); setFormErr(""); setReasonErr(""); setOfferEscalate(false)
    if (m === "punish") {
      const next = Number(c?.ladder?.next_step)
      const def = withinOptions.find((o) => Number(o.step) === next) ?? (withinOptions.length === 1 ? withinOptions[0] : null)
      setPunish({ ...EMPTY_PUNISH, step: def ? Number(def.step) : null })
    }
    if (m === "escalate" || m === "dismiss") { setReason(""); setFalseReport(false) }
  }

  const afterDone = (msg, desc) => {
    toast.success(msg, desc ? { description: desc } : undefined)
    onChanged()
    setMode("view")
    setTick((t) => t + 1)
  }

  const handleErr = (e, fallback) => {
    const detail = apiDetail(e)
    if (e?.status === 409 || e?.status === 403) {
      // 409 = ขั้นผิด / เกินอำนาจ / งวดเงินเดือนปิดแล้ว · 403 = ไม่ใช่ขั้นของคุณหรือเรื่องปิดแล้ว
      setOfferEscalate(e.status === 409 && !!nextStage && /ส่งต่อ|อำนาจ/.test(detail))
      setFormErr(detail || fallback)
      if (e.status === 403) setTick((t) => t + 1)
      return
    }
    setFormErr(detail || fallback)
  }

  const submitPunish = async () => {
    const step = Number(punish.step)
    if (!step) { setFormErr("เลือกโทษก่อน"); return }
    const body = { step }
    if (punish.note.trim()) body.note = punish.note.trim()
    if (step === SUSPENSION_STEP) {
      const days = inclusiveDays(punish.start, punish.end)
      const minD = settings?.suspension_min_days
      const maxD = settings?.suspension_max_days
      let dateErr = ""
      if (!punish.start || !punish.end) dateErr = "ระบุวันเริ่มและวันสุดท้ายของการพักงาน"
      else if (!days) dateErr = "วันสุดท้ายต้องไม่ก่อนวันเริ่ม"
      else if (minD != null && days < minD) dateErr = `พักงานอย่างน้อย ${minD} วัน`
      else if (maxD != null && days > maxD) dateErr = `พักงานได้ไม่เกิน ${maxD} วัน`
      if (dateErr) { setPunish((s) => ({ ...s, dateErr })); return }
      body.suspension_start = punish.start
      body.suspension_end = punish.end
    }
    setBusy(true); setFormErr(""); setOfferEscalate(false)
    try {
      const res = await apiAuth(`/hr/discipline/cases/${c.id}/punish`, { method: "POST", body })
      if (res?.termination_prefill) setServerPrefill(res.termination_prefill)
      const doc = res?.action?.doc_no
      afterDone("ลงโทษแล้ว", `${stepLabel(step, res?.action?.step_label)}${doc ? ` · เลขที่ ${doc}` : ""} — แจ้งผู้ถูกลงโทษแล้ว`)
    } catch (e) {
      handleErr(e, "บันทึกการลงโทษไม่สำเร็จ")
    } finally {
      setBusy(false)
    }
  }

  const submitReason = async (kind) => {
    if (!reason.trim()) { setReasonErr(kind === "escalate" ? "ระบุเหตุผลที่ส่งต่อ" : "ระบุเหตุผลที่ยุติเรื่อง"); document.getElementById(`${ID_BASE}-reason`)?.focus(); return }
    setBusy(true); setFormErr(""); setOfferEscalate(false)
    try {
      if (kind === "escalate") {
        await apiAuth(`/hr/discipline/cases/${c.id}/escalate`, { method: "POST", body: { reason: reason.trim() } })
        afterDone("ส่งต่อแล้ว", `เรื่องอยู่ที่${stageLabel(nextStage)} — คุณจะไม่เห็นปุ่มพิจารณาของเรื่องนี้อีก`)
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

  const openPdf = async () => {
    setPdfBusy(true)
    try { await downloadActionPdf(c.action) } catch (e) { toast.error("เปิดหนังสือไม่สำเร็จ", { description: apiDetail(e) || "ลองใหม่อีกครั้ง" }) } finally { setPdfBusy(false) }
  }

  const prefill = c ? terminationPrefillFor(c, serverPrefill) : null
  const showTermination = !!prefill && canTerminate && TERMINATION_STEPS.includes(Number(c?.action?.step))

  // ── footer ──
  const sheetBtn = "!h-11 md:!h-10 !px-4 !text-sm"
  let footer
  if (!c || !canDecide) {
    footer = <div className="flex justify-end"><button type="button" onClick={onClose} className={cx(neutralBtnCls, sheetBtn)}>ปิด</button></div>
  } else if (mode === "view") {
    footer = (
      <div className="grid grid-cols-2 gap-2 md:flex md:items-center md:gap-2">
        <button type="button" onClick={() => toMode("dismiss")} className={cx(neutralBtnCls, sheetBtn, "md:mr-auto")}>ยุติเรื่อง</button>
        {nextStage && (
          <button type="button" onClick={() => toMode("escalate")}
            className={cx(withinOptions.length ? neutralBtnCls : primaryBtnCls, sheetBtn)}>
            ส่งต่อ{stageLabel(nextStage)}
          </button>
        )}
        {withinOptions.length > 0 && (
          <button type="button" onClick={() => toMode("punish")} className={cx(primaryBtnCls, sheetBtn, !nextStage && "col-span-1")}>ลงโทษ…</button>
        )}
      </div>
    )
  } else {
    const step = Number(punish.step)
    const confirm = mode === "punish"
      ? { label: step ? `ยืนยัน: ${LADDER.find((s) => s.step === step)?.short ?? `ขั้น ${step}`}` : "ยืนยันลงโทษ", cls: step >= SUSPENSION_STEP ? dangerBtnCls : primaryBtnCls, run: submitPunish }
      : mode === "escalate"
        ? { label: `ยืนยันส่งต่อ`, cls: primaryBtnCls, run: () => submitReason("escalate") }
        : { label: "ยืนยันยุติเรื่อง", cls: dangerBtnCls, run: () => submitReason("dismiss") }
    footer = (
      <div className="grid grid-cols-2 gap-3 md:flex md:justify-end md:gap-2">
        <button type="button" onClick={() => toMode("view")} disabled={busy} className={cx(neutralBtnCls, sheetBtn)}>ย้อนกลับ</button>
        <button type="button" onClick={confirm.run} disabled={busy || (mode === "punish" && !step)} className={cx(confirm.cls, sheetBtn)}>
          {busy ? "กำลังบันทึก…" : confirm.label}
        </button>
      </div>
    )
  }

  const title = mode === "punish" ? "ลงโทษ" : mode === "escalate" ? "ส่งต่อเรื่อง" : mode === "dismiss" ? "ยุติเรื่อง" : (c?.topic || "รายละเอียดเรื่อง")
  const subtitle = c ? `${accusedName(c)} · เรื่อง #${c.id}` : undefined

  return (
    <Sheet open onClose={onClose} busy={busy} size="lg" title={title} subtitle={subtitle} footer={footer}
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
            {open && !c.can_decide && <span className="text-xs text-gray-500 dark:text-gray-400">ดูอย่างเดียว — ไม่ใช่ขั้นพิจารณาของคุณ</span>}
          </div>

          {showTermination && (
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-amber-50 px-3 py-2.5 text-sm text-amber-950 ring-1 ring-inset ring-amber-200 dark:bg-amber-500/10 dark:text-amber-100 dark:ring-amber-400/20">
              <p className="min-w-0">
                <span className="font-semibold">{prefill.reason || stepLabel(c.action.step)}</span> — ต้องบันทึกการพ้นสภาพ บัญชียังใช้งานได้จนกว่าจะบันทึก
              </p>
              <button type="button" onClick={() => onOpenTermination({ id: c.accused_id, first_name: c.accused_name || `รหัส ${c.accused_id}`, last_name: "" }, prefill)}
                className={cx(primaryBtnCls, "!h-9 !px-3 !text-sm")}>
                <UserX aria-hidden="true" className="size-4" /> บันทึกการพ้นสภาพ
              </button>
            </div>
          )}

          <div className="grid gap-5 md:grid-cols-[minmax(0,1fr)_minmax(0,17rem)]">
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
                <h3 id={`${ID_BASE}-files-h`} className={sectionH}>หลักฐาน {c.attachments?.length ? `(${c.attachments.length})` : ""}</h3>
                <AttachmentList attachments={c.attachments} emptyText="ไม่มีไฟล์แนบ" />
              </section>

              {!open && (
                <section aria-labelledby={`${ID_BASE}-outcome-h`} className="space-y-2">
                  <h3 id={`${ID_BASE}-outcome-h`} className={sectionH}>ผลการพิจารณา</h3>
                  {c.action ? (
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="min-w-0 text-sm">
                        <p className="flex flex-wrap items-center gap-2 font-medium text-gray-900 dark:text-gray-100">
                          <Badge tone={stepTone(c.action.step)}>ขั้น {c.action.step}</Badge>
                          {stepLabel(c.action.step, c.action.step_label)}
                        </p>
                        <p className="mt-0.5 text-xs tabular-nums text-gray-500 dark:text-gray-400">
                          {c.action.doc_no ? `เลขที่ ${c.action.doc_no} · ` : ""}ออกเมื่อ {fmtDate(c.action.issued_on || c.decided_at)}
                        </p>
                        {Number(c.action.step) === SUSPENSION_STEP && c.action.suspension_start && (
                          <p className="mt-0.5 tabular-nums text-red-800 dark:text-red-200">พักงาน {suspensionText(c.action)}</p>
                        )}
                      </div>
                      {c.action.id != null && (
                        <button type="button" onClick={openPdf} disabled={pdfBusy}
                          className={cx("inline-flex min-h-touch items-center gap-1.5 rounded-lg px-3 text-sm font-medium text-indigo-700 ring-1 ring-inset ring-indigo-200 transition-colors duration-150 hover:bg-indigo-50 disabled:opacity-60 cursor-pointer md:min-h-9 dark:text-indigo-300 dark:ring-indigo-400/30 dark:hover:bg-indigo-500/10", focusRingCls)}>
                          {pdfBusy ? <LoaderCircle aria-hidden="true" className="size-4 animate-spin" /> : <FileDown aria-hidden="true" className="size-4" />}
                          หนังสือ PDF
                        </button>
                      )}
                    </div>
                  ) : (
                    <p className="text-sm text-gray-800 dark:text-gray-200">
                      ยุติเรื่องโดยไม่ลงโทษ{c.false_report ? " · ระบุว่าแจ้งเท็จ/ไม่มีมูล" : ""}
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
              {open && canDecide && withinOptions.length === 0 && (
                <p className="mt-2 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-900 dark:bg-amber-500/10 dark:text-amber-200">
                  ขั้นถัดไปเกินอำนาจขั้นนี้ — ส่งต่อ{stageLabel(nextStage)}หรือยุติเรื่อง
                </p>
              )}
            </section>
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          <p className="text-sm text-gray-700 dark:text-gray-300">
            <span className="font-medium text-gray-900 dark:text-gray-100">{accusedName(c)}</span> · {c.topic}
            {c.topic_is_serious && <> <SeriousBadge /></>}
          </p>

          {mode === "punish" && <PunishForm c={c} state={punish} setState={setPunish} settings={settings} />}

          {mode === "escalate" && (
            <ReasonForm id={`${ID_BASE}-reason`} label={`เหตุผลที่ส่งต่อ${stageLabel(nextStage)}`} value={reason}
              onChange={(v) => { setReason(v); setReasonErr("") }} error={reasonErr}
              hint={`${stageLabel(nextStage)}จะเห็นเหตุผลนี้ในประวัติการดำเนินการ`}
              placeholder="เช่น ขั้นถัดไปคือพักงาน เกินอำนาจหัวหน้าสาขา" />
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

          {formErr && (
            <div role="alert" className="space-y-2 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-800 dark:border-red-800/60 dark:bg-red-900/20 dark:text-red-200">
              <p>{formErr}</p>
              {offerEscalate && (
                <button type="button" onClick={() => toMode("escalate")} className={cx(neutralBtnCls, "!h-9 !px-3 !text-sm")}>
                  <ArrowUpRight aria-hidden="true" className="size-4" /> ส่งต่อ{stageLabel(nextStage)}แทน
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
  const isPhone = useIsPhone()
  const [params, setParams] = useSearchParams()
  const subs = canDecide ? ["mine", "open", "closed"] : ["open", "closed"]
  const [sub, setSub] = useSubTab(subs, canDecide ? "mine" : "open")
  const [stage, setStage] = useState("")
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [reloadKey, setReloadKey] = useState(0)
  const [openId, setOpenId] = useState(() => params.get("id"))
  const [termination, setTermination] = useState(null) // { employee, prefill }

  const query = useMemo(() => {
    const q = new URLSearchParams()
    q.set("status", sub === "closed" ? "closed" : "open")
    if (sub === "mine") q.set("mine", "true")
    if (stage && sub !== "closed") q.set("stage", stage)
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

  // &action=<action id> (การแจ้งเตือนขั้น 7/8 ถึง HR) → หาเรื่องที่ปิดด้วยโทษนั้น
  const actionParam = params.get("action")
  useEffect(() => {
    if (!actionParam) return undefined
    let alive = true
    const clear = () => setParams((prev) => { const p = new URLSearchParams(prev); p.delete("action"); return p }, { replace: true, state: keepBackState() })
    apiAuth("/hr/discipline/cases?status=closed")
      .then((d) => {
        if (!alive) return
        const hit = asArray(d).find((r) => String(r.action?.id ?? r.action_id ?? "") === String(actionParam))
        if (hit) { setOpenId(String(hit.id)); setParams((prev) => { const p = new URLSearchParams(prev); p.delete("action"); p.set("id", String(hit.id)); return p }, { replace: true, state: keepBackState() }) }
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

  const openCase = (r) => setOpenId(String(r.id))
  const closeCase = () => {
    setOpenId(null)
    if (params.get("id")) {
      setParams((prev) => { const p = new URLSearchParams(prev); p.delete("id"); return p }, { replace: true, state: keepBackState() })
    }
  }

  const tabs = [
    ...(canDecide ? [{ value: "mine", label: "รอฉันพิจารณา", count: sub === "mine" && !loading && !error && rows.length ? rows.length : null }] : []),
    { value: "open", label: "ระหว่างพิจารณา" },
    { value: "closed", label: "ปิดแล้ว" },
  ]

  const actionLabel = (r) => (r.status === "open" && (r.can_decide || sub === "mine") ? "พิจารณา" : "ดู")
  const emptyTitle = sub === "mine" ? "ไม่มีเรื่องรอคุณพิจารณา" : sub === "open" ? "ไม่มีเรื่องที่กำลังพิจารณา" : "ยังไม่มีเรื่องที่ปิดแล้ว"
  const emptyDesc = sub === "mine"
    ? "เรื่องที่ส่งถึงขั้นของคุณจะแสดงที่นี่ พร้อมแจ้งเตือนที่กระดิ่ง"
    : stage ? "ลองเลือกทุกขั้นพิจารณา" : "เรื่องที่พนักงานแจ้งจะแสดงที่นี่ตามสิทธิ์ของคุณ"

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <Tabs items={tabs} value={sub} onChange={setSub} ariaLabel="สถานะเรื่อง" idBase={ID_BASE} />
        {sub !== "closed" && (
          <div className="w-full sm:ml-auto sm:w-52">
            <SelectDropdown size="sm" ariaLabel="กรองตามขั้นพิจารณา" value={stage} onChange={setStage} showSwatch={false} options={STAGE_FILTER} />
          </div>
        )}
      </div>

      <div role="tabpanel" id={panelId(ID_BASE, sub)} aria-labelledby={tabId(ID_BASE, sub)} tabIndex={0} className={cx("space-y-3", tabPanelCls)}>
        {error ? (
          <ErrorState message={error} onRetry={reload} />
        ) : isPhone ? (
          <DataList
            items={sorted}
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
            onClick={openCase}
            emptyState={<EmptyState title={emptyTitle} description={emptyDesc} />}
          />
        ) : (
          <div className={cx(cardCls, "overflow-x-auto")}>
            <table className="w-full min-w-[52rem] text-sm">
              <caption className="sr-only">รายการเรื่องร้องเรียน/ตักเตือน</caption>
              <thead className="border-b border-gray-200 text-left text-xs font-semibold text-gray-500 dark:border-line dark:text-gray-400">
                <tr>
                  <th scope="col" className="px-4 py-2.5">ผู้ถูกแจ้ง</th>
                  <th scope="col" className="px-4 py-2.5">หัวข้อ</th>
                  <th scope="col" className="px-4 py-2.5">เกิดเหตุ</th>
                  <th scope="col" className="px-4 py-2.5">{sub === "closed" ? "ผล" : "ขั้นพิจารณา"}</th>
                  <th scope="col" className="px-4 py-2.5">แจ้งเมื่อ</th>
                  <th scope="col" className="px-4 py-2.5"><span className="sr-only">การดำเนินการ</span></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-line">
                {loading ? (
                  <tr><td colSpan={6} className="p-3"><SkeletonTableRows rows={4} cols={5} /></td></tr>
                ) : sorted.length === 0 ? (
                  <tr><td colSpan={6}><EmptyState title={emptyTitle} description={emptyDesc} /></td></tr>
                ) : sorted.map((r) => {
                  const s = caseStatus(r)
                  const decide = actionLabel(r) === "พิจารณา"
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
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 tabular-nums text-gray-700 dark:text-gray-300">{fmtDateTime(r.incident_at)}</td>
                      <td className="px-4 py-3">
                        {sub === "closed" ? <Badge tone={s.tone}>{s.label}</Badge>
                          : <span className="text-gray-800 dark:text-gray-200">{stageLabel(r.stage, r.stage_label)}</span>}
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 tabular-nums text-gray-500 dark:text-gray-400">{fmtDate(r.created_at)}</td>
                      <td className="px-4 py-3 text-right">
                        <button type="button" onClick={(e) => { e.stopPropagation(); openCase(r) }}
                          aria-label={`${actionLabel(r)}เรื่องของ ${accusedName(r)} — ${r.topic || ""}`}
                          className={cx(
                            decide
                              ? "inline-flex h-9 items-center rounded-lg bg-indigo-600 px-3 text-sm font-semibold text-white hover:bg-indigo-500"
                              : "inline-flex h-9 items-center rounded-lg px-3 text-sm font-medium text-indigo-700 hover:bg-indigo-50 dark:text-indigo-300 dark:hover:bg-indigo-500/10",
                            "cursor-pointer transition-colors duration-150", focusRingCls,
                          )}>
                          {actionLabel(r)}
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

      {openId != null && (
        <CaseSheet
          key={openId}
          caseId={openId}
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
