// src/components/hr/SalaryStepPanel.jsx
// เลื่อนขั้นเงินเดือน (spec handoff/hr-ux-spec.md §3.1)
// POST /hr/employees/{id}/salary-step-award {step > 0, reason} → {old_level, new_level, capped, old_salary, new_salary, salary_note}
//   capped = ถึงขั้นสูงสุดของกระบอก (UAT D2) · 409 = ตำแหน่งยังไม่มีกระบอก (position_tier_id)
// Preview ก่อนส่ง: GET /hr/salary-ladder?tier= (ขั้นสูงสุด) + GET /hr/salary-ladder/lookup (เงินเดือน)
// ไม่มีการ POST ก่อนผู้ใช้ยืนยันใน ConfirmDialog
//
// Layout: lg 2 คอลัมน์ [picker + สรุป | การ์ดเลื่อนขั้น sticky] แล้วประวัติใต้คอลัมน์ซ้าย
//         < lg คอลัมน์เดียว: picker → สรุป → การ์ดเลื่อนขั้น → ประวัติ
import { useEffect, useId, useRef, useState } from "react"
import { ArrowRight, UserSearch } from "lucide-react"
import { apiAuth } from "../../lib/api"
import { cx, focusRingCls, primaryBtnCls } from "../../lib/styles"
import { ConfirmDialog, EmptyState, ErrorState, Skeleton, toast } from "../ui"
import EmployeePicker from "./EmployeePicker"
import SalaryHistoryTable from "./SalaryHistoryTable"
import SalarySummaryCard from "./SalarySummaryCard"
import usePositions from "./usePositions"
import { Notice } from "./HrModal"
import { getCachedPersonnel, loadPersonnel, refreshPersonnel } from "./personnelCache"
import { invalidateRosterEmployee, useEmployeeSalary, useLadderMax, useSalaryLookup } from "./salaryData"
import { thb, fmtLevel, errText, employeeName, inputCls, labelCls, cardCls } from "./positionUtils"

const CHIPS = [
  { value: "0.5", label: "0.5" },
  { value: "1", label: "1" },
  { value: "1.5", label: "1.5" },
  { value: "2", label: "2" },
  { value: "custom", label: "อื่น ๆ" },
]
const STEP_MIN = 0.5
const STEP_MAX = 5
const REASON_MAX = 255

const CHIP_BASE =
  "h-9 flex-1 rounded-lg text-sm font-semibold tabular-nums ring-1 ring-inset cursor-pointer " +
  "transition-colors duration-150 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 " +
  "focus-visible:ring-offset-2 focus-visible:ring-offset-white dark:focus-visible:ring-offset-gray-800"
const CHIP_OFF =
  "ring-gray-200 text-gray-700 hover:bg-gray-50 dark:ring-gray-600 dark:text-gray-200 dark:hover:bg-gray-700/50"
const CHIP_ON = "bg-indigo-600 text-white ring-indigo-600 dark:bg-indigo-500 dark:ring-indigo-500"

const GO_LINK = "rounded font-semibold underline underline-offset-2 cursor-pointer " + focusRingCls

/** "" when valid, else the error copy (spec §5 Step errors). */
function validateStep(raw) {
  const s = String(raw ?? "").trim()
  if (s === "") return "ระบุจำนวนขั้น"
  const n = Number(s)
  if (!Number.isFinite(n) || n < STEP_MIN || n > STEP_MAX) return "จำนวนขั้นต้องอยู่ระหว่าง 0.5 ถึง 5"
  if (!Number.isInteger(n * 2)) return "ระบุทีละครึ่งขั้น เช่น 1.5 หรือ 2.5"
  return ""
}

const prefersReducedMotion = () =>
  typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches

/** list record for a preselected id (from the shared personnel cache), else null */
const cachedRecord = (id) =>
  id ? getCachedPersonnel()?.find((p) => String(p.id) === String(id)) ?? null : null

// initialEmployeeId: preselect (read once at mount, e.g. from the URL `&emp=`)
// onEmployeeChange(id): lets the parent mirror the picked employee into the URL
export default function SalaryStepPanel({ onGoToPositions, initialEmployeeId = "", onEmployeeChange }) {
  const uid = useId()
  const ids = {
    picker: `${uid}-emp`,
    stepLabel: `${uid}-step-label`,
    custom: `${uid}-step-custom`,
    stepErr: `${uid}-step-err`,
    reason: `${uid}-reason`,
    reasonCount: `${uid}-reason-count`,
    hint: `${uid}-submit-hint`,
  }

  const { byId: positionsById, loading: positionsLoading, error: positionsError, reload: reloadPositions } = usePositions()
  const [empId, setEmpId] = useState(() => (initialEmployeeId ? String(initialEmployeeId) : ""))
  const [emp, setEmp] = useState(() => cachedRecord(initialEmployeeId))
  const [refreshKey, setRefreshKey] = useState(0)

  // deep link before the personnel list was cached: fill the list record once it loads
  useEffect(() => {
    if (!empId || emp) return
    let alive = true
    loadPersonnel()
      .then((list) => {
        const rec = list.find((p) => String(p.id) === String(empId)) ?? null
        if (alive && rec) setEmp((cur) => cur ?? rec)
      })
      .catch(() => {})
    return () => { alive = false }
  }, [empId, emp])
  const info = useEmployeeSalary(empId, refreshKey, positionsById, emp)
  const { positionId, tierId, currentLevel } = info

  const [choice, setChoice] = useState("1")
  const [custom, setCustom] = useState("")
  const [stepError, setStepError] = useState("")
  const [reason, setReason] = useState("")
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [apiError, setApiError] = useState(null) // { status, message }

  // "just updated" cue on the summary card: "on" (indigo, instant) → "fading" (1.2s back) → "off"
  const [cue, setCue] = useState("off")
  const cueTimers = useRef([])
  const clearCue = () => { cueTimers.current.forEach(clearTimeout); cueTimers.current = [] }
  useEffect(() => clearCue, [])
  const flashCue = () => {
    if (prefersReducedMotion()) return
    clearCue()
    setCue("on")
    cueTimers.current = [
      setTimeout(() => setCue("fading"), 80),
      setTimeout(() => setCue("off"), 80 + 1300),
    ]
  }

  // chips: roving focus + focus the custom field when "อื่น ๆ" is activated
  const chipRefs = useRef([])
  const customRef = useRef(null)
  const focusCustom = useRef(false)
  useEffect(() => {
    if (choice === "custom" && focusCustom.current) {
      focusCustom.current = false
      customRef.current?.focus()
    }
  }, [choice])

  // ─── derived: step, preview, rules ───────────────────────────────────────
  const stepRaw = choice === "custom" ? custom : choice
  const stepProblem = validateStep(stepRaw)
  const stepValid = !stepProblem
  const step = stepValid ? Number(stepRaw) : null

  const ladder = useLadderMax(tierId)
  const max = ladder.status === "ok" ? ladder.max : null
  const target = step != null && currentLevel != null ? currentLevel + step : null
  const newLevel = target == null ? null : max != null ? Math.min(target, max) : target
  const gain = newLevel != null ? newLevel - currentLevel : null
  const atMax = gain != null && gain <= 0
  const capped = !atMax && max != null && target != null && newLevel < target
  const previewReady = tierId != null && newLevel != null && !atMax && ladder.status !== "loading"

  const currentSalary = useSalaryLookup(tierId, currentLevel)
  const newSalary = useSalaryLookup(tierId, previewReady ? newLevel : null, { debounce: 250 })
  const delta =
    currentSalary.status === "ok" && newSalary.status === "ok" ? newSalary.amount - currentSalary.amount : null
  const deltaPct = delta != null && currentSalary.amount > 0 ? (delta / currentSalary.amount) * 100 : null

  const detailBusy = !!empId && (info.loading || positionsLoading)
  let hint = ""
  if (!empId) hint = "เลือกเจ้าหน้าที่ก่อน"
  else if (detailBusy) hint = "กำลังโหลดข้อมูลเจ้าหน้าที่…"
  else if (info.error || positionsError) hint = "โหลดข้อมูลไม่สำเร็จ ลองใหม่ที่การ์ดด้านบน"
  else if (positionId == null) hint = "กำหนดตำแหน่งให้เจ้าหน้าที่ก่อน"
  else if (tierId == null) hint = "กำหนดกระบอกเงินเดือนของตำแหน่งก่อน"
  else if (!stepValid) hint = "แก้จำนวนขั้นให้ถูกต้อง"
  else if (!reason.trim()) hint = "กรอกเหตุผลการเลื่อนขั้น"
  else if (atMax) hint = "อยู่ขั้นสูงสุดของกระบอกแล้ว"
  const canSubmit = !hint && !submitting

  const name = employeeName(emp) || (empId ? `รหัส ${empId}` : "")

  // ─── handlers ────────────────────────────────────────────────────────────
  const pick = (v, record) => {
    if (String(v) === String(empId)) return
    // reset synchronously so nothing from the previous person survives a render
    setEmpId(v)
    setEmp(record)
    onEmployeeChange?.(v)
    setChoice("1")
    setCustom("")
    setStepError("")
    setReason("")
    setApiError(null)
    clearCue()
    setCue("off")
  }

  const selectChip = (value, { focusField = false } = {}) => {
    setChoice(value)
    setStepError("")
    if (value === "custom" && focusField) focusCustom.current = true
  }

  const onChipKeyDown = (e, idx) => {
    const last = CHIPS.length - 1
    let next = null
    if (e.key === "ArrowRight" || e.key === "ArrowDown") next = idx === last ? 0 : idx + 1
    else if (e.key === "ArrowLeft" || e.key === "ArrowUp") next = idx === 0 ? last : idx - 1
    else if (e.key === "Home") next = 0
    else if (e.key === "End") next = last
    if (next == null) return
    e.preventDefault()
    selectChip(CHIPS[next].value)
    chipRefs.current[next]?.focus()
  }

  const onSubmit = (e) => {
    e.preventDefault()
    if (choice === "custom") setStepError(stepProblem)
    if (!canSubmit) return
    setApiError(null)
    setConfirmOpen(true)
  }

  const goToPositions = () => {
    setConfirmOpen(false)
    onGoToPositions?.()
  }

  const award = async () => {
    if (submitting || step == null) return
    setSubmitting(true)
    setApiError(null)
    try {
      const res = await apiAuth(`/hr/employees/${empId}/salary-step-award`, {
        method: "POST",
        body: { step, reason: reason.trim() },
      })
      const oldL = res?.old_level ?? currentLevel
      const newL = res?.new_level ?? newLevel
      // v1.4.0: response adds old_salary / new_salary / salary_note (salary moves to the ladder amount)
      const hasSalary = res?.old_salary != null && res?.new_salary != null
      const salaryPart = hasSalary ? ` · เงินเดือน ${thb(res.old_salary)} → ${thb(res.new_salary)} บาท` : ""
      const notePart = res?.salary_note ? ` · ${res.salary_note}` : ""
      const desc = `${name} · ขั้น ${fmtLevel(oldL)} → ${fmtLevel(newL)}${salaryPart}${notePart}`
      if (res?.capped) {
        const got = Number(newL) - Number(oldL)
        toast.warning("เลื่อนขั้นเรียบร้อยแล้ว ถึงขั้นสูงสุดของกระบอก", {
          description: `${desc} · ได้จริง ${fmtLevel(got)} ขั้น`,
          duration: notePart ? 10000 : undefined,
        })
      } else {
        toast.success("เลื่อนขั้นเรียบร้อยแล้ว", { description: desc, duration: notePart ? 10000 : undefined })
      }
      setConfirmOpen(false)
      setReason("")
      setChoice("1")
      setCustom("")
      setStepError("")
      setRefreshKey((k) => k + 1)
      invalidateRosterEmployee(empId) // roster sub-tab re-fetches this person's level
      refreshPersonnel().catch(() => {})
      flashCue()
      // ConfirmDialog returns focus to the submit button, but the form reset
      // just disabled it, so focus would drop to <body>. Land on the step
      // chips (start of the form) instead.
      requestAnimationFrame(() => {
        const a = document.activeElement
        if (!a || a === document.body || a.disabled) chipRefs.current[1]?.focus()
      })
    } catch (err) {
      setApiError({ status: err?.status, message: errText(err, "") })
    } finally {
      setSubmitting(false)
    }
  }

  // ─── render ──────────────────────────────────────────────────────────────
  const showStepError = choice === "custom" && !!stepError

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_22rem] lg:grid-rows-[auto_1fr] lg:items-start">
      {/* LEFT top: picker + summary */}
      <div className="min-w-0 space-y-4 lg:col-start-1 lg:row-start-1">
        <EmployeePicker id={ids.picker} value={empId} onChange={pick} positionsById={positionsById} />
        {positionsError && <ErrorState message={positionsError} onRetry={reloadPositions} />}
        {empId ? (
          <SalarySummaryCard
            emp={emp}
            info={info}
            positionsLoading={positionsLoading}
            onGoToPositions={onGoToPositions}
            highlight={cue}
          />
        ) : (
          <div className={cardCls}>
            <EmptyState
              icon={<UserSearch aria-hidden="true" className="size-10" strokeWidth={1.5} />}
              title="เลือกเจ้าหน้าที่ที่จะเลื่อนขั้น"
              description="ค้นหาด้วยชื่อ รหัส หรือตำแหน่ง ระบบจะแสดงขั้นปัจจุบันและประวัติการเลื่อนขั้น"
            />
          </div>
        )}
      </div>

      {/* RIGHT: action card */}
      <form
        onSubmit={onSubmit}
        noValidate
        aria-labelledby={`${uid}-title`}
        className={cardCls + " p-5 space-y-5 lg:col-start-2 lg:row-start-1 lg:row-span-2 lg:sticky lg:top-6"}
      >
        <div>
          <h3 id={`${uid}-title`} className="font-semibold text-gray-900 dark:text-gray-100">เลื่อนขั้นเงินเดือน</h3>
          <p className="mt-0.5 text-xs text-gray-500 dark:text-gray-400">ขั้นใหม่จะไม่เกินขั้นสูงสุดของกระบอก</p>
        </div>

        {/* Step chips */}
        <div>
          <span id={ids.stepLabel} className={labelCls}>
            จำนวนขั้นที่เลื่อน <span className="text-red-500" aria-hidden="true">*</span>
          </span>
          <div role="radiogroup" aria-labelledby={ids.stepLabel} className="flex gap-1.5">
            {CHIPS.map((c, i) => {
              const on = choice === c.value
              return (
                <button
                  key={c.value}
                  ref={(el) => { chipRefs.current[i] = el }}
                  type="button"
                  role="radio"
                  aria-checked={on}
                  tabIndex={on ? 0 : -1}
                  onClick={() => selectChip(c.value, { focusField: true })}
                  onKeyDown={(e) => onChipKeyDown(e, i)}
                  className={cx(CHIP_BASE, on ? CHIP_ON : CHIP_OFF, c.value === "custom" && "flex-[1.4] whitespace-nowrap")}
                >
                  {c.label}
                </button>
              )
            })}
          </div>

          {choice === "custom" && (
            <div className="mt-3">
              <label htmlFor={ids.custom} className="sr-only">จำนวนขั้นที่เลื่อน (กำหนดเอง)</label>
              <div className="flex items-center gap-2">
                <input
                  ref={customRef}
                  id={ids.custom}
                  type="number"
                  inputMode="decimal"
                  step="0.5"
                  min={STEP_MIN}
                  max={STEP_MAX}
                  value={custom}
                  onChange={(e) => { setCustom(e.target.value); setStepError("") }}
                  onBlur={() => setStepError(validateStep(custom))}
                  aria-invalid={showStepError || undefined}
                  aria-describedby={showStepError ? ids.stepErr : `${uid}-step-help`}
                  className={cx(inputCls.replace("w-full", "w-28"), "tabular-nums", showStepError && "border-red-400 dark:border-red-500")}
                  placeholder="เช่น 2.5"
                />
                <span className="text-sm text-gray-600 dark:text-gray-300">ขั้น</span>
                <span id={`${uid}-step-help`} className="ml-auto whitespace-nowrap text-xs text-gray-500 dark:text-gray-400">สูงสุด 5 ขั้น</span>
              </div>
              {showStepError && (
                <p id={ids.stepErr} className="mt-1.5 text-xs text-red-600 dark:text-red-400">{stepError}</p>
              )}
            </div>
          )}
        </div>

        {/* Preview */}
        <div aria-live="polite" className="space-y-3">
          <Preview
            empId={empId}
            busy={detailBusy || (!!tierId && ladder.status === "loading")}
            blocked={!!empId && !detailBusy && (positionId == null || tierId == null || !!info.error)}
            currentLevel={currentLevel}
            newLevel={atMax ? currentLevel : newLevel}
            stepValid={stepValid}
            currentSalary={currentSalary}
            newSalary={atMax ? currentSalary : newSalary}
            delta={atMax ? null : delta}
            deltaPct={atMax ? null : deltaPct}
          />
          {capped && (
            <Notice tone="warning">
              เลื่อนได้จริง {fmtLevel(gain)} จาก {fmtLevel(step)} ขั้น เพราะถึงขั้นสูงสุดของกระบอก (ขั้น {fmtLevel(max)})
            </Notice>
          )}
          {atMax && !detailBusy && (
            <Notice tone="warning">
              เจ้าหน้าที่คนนี้อยู่ขั้นสูงสุดของกระบอกแล้ว จะเลื่อนขั้นต่อได้เมื่อเลื่อนตำแหน่งไปกระบอกที่สูงกว่า
            </Notice>
          )}
        </div>

        {/* Reason */}
        <div>
          <div className="flex items-baseline justify-between gap-2">
            <label htmlFor={ids.reason} className={labelCls}>
              เหตุผล <span className="text-red-500" aria-hidden="true">*</span>
            </label>
            <span id={ids.reasonCount} className="text-xs tabular-nums text-gray-500 dark:text-gray-400">
              {reason.length}/{REASON_MAX}
            </span>
          </div>
          <textarea
            id={ids.reason}
            rows={3}
            maxLength={REASON_MAX}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            aria-describedby={ids.reasonCount}
            className={inputCls + " resize-none leading-relaxed"}
            placeholder="เช่น ผลประเมินประจำปี 2569 ระดับดีเด่น"
          />
        </div>

        <div className="space-y-2">
          <button
            type="submit"
            disabled={!canSubmit}
            aria-describedby={hint ? ids.hint : undefined}
            className={primaryBtnCls + " w-full"}
          >
            เลื่อนขั้น
          </button>
          {hint && (
            <p id={ids.hint} className="text-center text-xs text-gray-500 dark:text-gray-400">{hint}</p>
          )}
        </div>
      </form>

      {/* LEFT bottom: history */}
      {empId && (
        <div className="min-w-0 lg:col-start-1 lg:row-start-2">
          <SalaryHistoryTable employeeId={empId} refreshKey={refreshKey} title="ประวัติการเลื่อนขั้น" />
        </div>
      )}

      <ConfirmDialog
        open={confirmOpen}
        title="ยืนยันการเลื่อนขั้นเงินเดือน"
        description={`${name} · รหัส ${empId}`}
        confirmLabel="ยืนยันเลื่อนขั้น"
        loadingLabel="กำลังบันทึก…"
        tone="primary"
        initialFocus="cancel"
        loading={submitting}
        onConfirm={award}
        onCancel={() => { if (!submitting) setConfirmOpen(false) }}
        error={apiError && (
          apiError.status === 409 ? (
            <>
              ตำแหน่งของเจ้าหน้าที่คนนี้ยังไม่ได้กำหนดกระบอกเงินเดือน กำหนดที่ “ตำแหน่งงาน” ก่อนเลื่อนขั้น
              {onGoToPositions && (
                <> <button type="button" onClick={goToPositions} className={GO_LINK}>ไปที่ตำแหน่งงาน</button></>
              )}
            </>
          ) : (
            <>
              <p>เลื่อนขั้นไม่สำเร็จ ลองใหม่อีกครั้ง หากยังไม่ได้ แจ้งที่เมนู “รายงานปัญหา”</p>
              {apiError.message && <p className="mt-1 text-xs opacity-90">{apiError.message}</p>}
            </>
          )
        )}
      >
        <dl className="space-y-2 rounded-xl bg-gray-50 p-4 dark:bg-gray-900/40">
          <div className="grid grid-cols-[5rem_minmax(0,1fr)] gap-3">
            <dt className="text-gray-500 dark:text-gray-400">ขั้น</dt>
            <dd className="tabular-nums text-gray-900 dark:text-gray-100">
              {fmtLevel(currentLevel)} <Arrow /> <span className="font-semibold">{fmtLevel(newLevel)}</span>
              {gain != null && <span className="ml-1.5 text-gray-500 dark:text-gray-400">(+{fmtLevel(gain)} ขั้น)</span>}
            </dd>
          </div>
          <div className="grid grid-cols-[5rem_minmax(0,1fr)] gap-3">
            <dt className="text-gray-500 dark:text-gray-400">เงินเดือน</dt>
            <dd className="tabular-nums text-gray-900 dark:text-gray-100">
              {currentSalary.status === "ok" && newSalary.status === "ok" ? (
                <>{thb(currentSalary.amount)} <Arrow /> <span className="font-semibold">{thb(newSalary.amount)}</span> บาท</>
              ) : (
                <span className="text-gray-500 dark:text-gray-400">ไม่พบเงินเดือนของขั้น {fmtLevel(newLevel)} ในบัญชีเงินเดือน</span>
              )}
            </dd>
          </div>
          <div className="grid grid-cols-[5rem_minmax(0,1fr)] gap-3">
            <dt className="text-gray-500 dark:text-gray-400">เหตุผล</dt>
            <dd className="break-words text-gray-900 dark:text-gray-100">{reason.trim()}</dd>
          </div>
        </dl>
        {capped && (
          <p className="mt-3 text-amber-700 dark:text-amber-300">
            เลื่อนได้จริง {fmtLevel(gain)} จาก {fmtLevel(step)} ขั้น เพราะถึงขั้นสูงสุดของกระบอก (ขั้น {fmtLevel(max)})
          </p>
        )}
        <p className="mt-3 text-xs text-gray-500 dark:text-gray-400">บันทึกแล้วจะแก้ไขจากหน้านี้ไม่ได้ ตรวจสอบข้อมูลก่อนยืนยัน</p>
      </ConfirmDialog>
    </div>
  )
}

function Arrow() {
  return (
    <>
      <ArrowRight aria-hidden="true" className="inline size-4 align-[-3px] text-gray-400 dark:text-gray-500" strokeWidth={1.75} />
      <span className="sr-only">เป็น</span>
    </>
  )
}

/** before → after block inside the action card (spec §3.1 Preview). */
function Preview({ empId, busy, blocked, currentLevel, newLevel, stepValid, currentSalary, newSalary, delta, deltaPct }) {
  const box = "rounded-xl bg-gray-50 p-4 dark:bg-gray-900/40"

  if (!empId || blocked) {
    return (
      <div className={cx(box, "text-sm text-gray-500 dark:text-gray-400")}>
        {!empId ? "เลือกเจ้าหน้าที่เพื่อดูขั้นและเงินเดือนใหม่" : "ยังคำนวณขั้นใหม่ไม่ได้ ดูรายละเอียดที่การ์ดเจ้าหน้าที่"}
      </div>
    )
  }
  if (busy) {
    return (
      <div className={cx(box, "space-y-3")} aria-busy="true">
        <Skeleton className="h-7 w-40" />
        <Skeleton className="h-5 w-56 max-w-full" />
      </div>
    )
  }
  if (currentLevel == null) {
    return <div className={cx(box, "text-sm text-gray-500 dark:text-gray-400")}>ไม่พบขั้นปัจจุบันของเจ้าหน้าที่คนนี้</div>
  }
  if (!stepValid) {
    return <div className={cx(box, "text-sm text-gray-500 dark:text-gray-400")}>แก้จำนวนขั้นให้ถูกต้องเพื่อดูขั้นใหม่</div>
  }

  return (
    <div className={cx(box, "space-y-2.5 text-sm")}>
    <dl className="space-y-2.5">
      <div className="flex items-baseline justify-between gap-3">
        <dt className="text-gray-500 dark:text-gray-400">ขั้น</dt>
        <dd className="flex items-baseline gap-2 tabular-nums">
          <span className="text-gray-600 dark:text-gray-300">{fmtLevel(currentLevel)}</span>
          <Arrow />
          <span className="text-2xl font-bold text-gray-900 dark:text-gray-100">{fmtLevel(newLevel)}</span>
        </dd>
      </div>
      <div className="flex items-baseline justify-between gap-3">
        <dt className="shrink-0 text-gray-500 dark:text-gray-400">เงินเดือน</dt>
        <dd className="min-w-0 text-right tabular-nums">
          {newSalary.status === "loading" || currentSalary.status === "loading" ? (
            <Skeleton className="ml-auto h-5 w-40" />
          ) : newSalary.status === "ok" ? (
            <>
              {currentSalary.status === "ok" && (
                <><span className="text-gray-600 dark:text-gray-300">{thb(currentSalary.amount)}</span> <Arrow /> </>
              )}
              <span className="font-bold text-gray-900 dark:text-gray-100">{thb(newSalary.amount)}</span>
              <span className="text-gray-500 dark:text-gray-400"> บาท</span>
            </>
          ) : (
            <span className="text-gray-500 dark:text-gray-400">ไม่พบเงินเดือนของขั้น {fmtLevel(newLevel)} ในบัญชีเงินเดือน</span>
          )}
        </dd>
      </div>
    </dl>
      {delta != null && delta !== 0 && (
        <p className="text-right text-sm font-medium tabular-nums text-emerald-700 dark:text-emerald-400">
          {delta > 0 ? "+" : ""}{thb(delta)} บาท/เดือน
          {deltaPct != null && ` (${deltaPct > 0 ? "+" : ""}${deltaPct.toFixed(1)}%)`}
        </p>
      )}
    </div>
  )
}
