// src/components/hr/SalaryStepPanel.jsx
// เลื่อนขั้นเงินเดือน — POST /hr/employees/{id}/salary-step-award {step > 0, reason}
// → {old_level, new_level, capped}. capped = ชนขั้นสูงสุดของกระบอก (UAT D2)
// 409 = ตำแหน่งของเจ้าหน้าที่ยังไม่มีระดับ (position_tier_id) → แสดง detail + บอกให้ไปตั้งระดับก่อน
import { useEffect, useState } from "react"
import { apiAuth } from "../../lib/api"
import EmployeePicker from "./EmployeePicker"
import SalaryHistoryTable from "./SalaryHistoryTable"
import usePositions from "./usePositions"
import { Notice } from "./HrModal"
import {
  tierName, thb, fmtLevel, errText, tierQuery, employeeName,
  inputCls, labelCls, primaryBtn, cardCls,
} from "./positionUtils"

const STEP_PRESETS = ["0.5", "1", "1.5", "2"]

export default function SalaryStepPanel({ onGoToPositions }) {
  const { byId: positionsById } = usePositions()
  const [empId, setEmpId] = useState("")
  const [emp, setEmp] = useState(null)
  const [detail, setDetail] = useState(null) // /hr/personnel/{id} — ขั้นปัจจุบัน

  const [step, setStep] = useState("1")
  const [reason, setReason] = useState("")
  const [submitting, setSubmitting] = useState(false)
  const [fieldError, setFieldError] = useState("")
  const [apiError, setApiError] = useState(null) // { status, message }
  const [result, setResult] = useState(null) // { old_level, new_level, capped, salary?, name }
  const [historyKey, setHistoryKey] = useState(0)

  useEffect(() => {
    if (!empId) { setDetail(null); return }
    let alive = true
    apiAuth(`/hr/personnel/${empId}`)
      .then((d) => { if (alive) setDetail(d) })
      .catch(() => { if (alive) setDetail(null) })
    return () => { alive = false }
  }, [empId, historyKey])

  const positionId = detail?.position ?? emp?.position
  const position = positionId != null ? positionsById[positionId] : null
  const tierId = position?.position_tier_id ?? null
  const currentLevel = detail?.personnel_info?.salary_level

  const pick = (v, e) => {
    setEmpId(v)
    setEmp(e)
    setResult(null)
    setApiError(null)
    setFieldError("")
  }

  const submit = async (e) => {
    e.preventDefault()
    setFieldError("")
    setApiError(null)
    setResult(null)
    const n = Number(step)
    if (!empId) return setFieldError("เลือกเจ้าหน้าที่ก่อน")
    if (!Number.isFinite(n) || n <= 0) return setFieldError("จำนวนขั้นต้องมากกว่า 0")
    if (!reason.trim()) return setFieldError("กรอกเหตุผลการเลื่อนขั้น")
    setSubmitting(true)
    try {
      const res = await apiAuth(`/hr/employees/${empId}/salary-step-award`, {
        method: "POST",
        body: { step: n, reason: reason.trim() },
      })
      let salary = null
      if (tierId != null && res?.new_level != null) {
        try {
          const row = await apiAuth(`/hr/salary-ladder/lookup?${tierQuery(tierId)}&level=${encodeURIComponent(res.new_level)}`)
          salary = row?.salary_amount ?? null
        } catch { /* ไม่มีขั้นนี้ในบัญชี — แค่ไม่แสดงเงินเดือน */ }
      }
      setResult({ ...res, requested: n, salary, name: employeeName(emp) || `รหัส ${empId}` })
      setReason("")
      setHistoryKey((k) => k + 1)
    } catch (err) {
      setApiError({ status: err?.status, message: errText(err, "เลื่อนขั้นไม่สำเร็จ") })
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="space-y-4">
      <div className="grid gap-4 lg:grid-cols-[minmax(0,26rem)_minmax(0,1fr)] lg:items-start">
        <form onSubmit={submit} className={cardCls + " p-5 space-y-4"} noValidate>
          <div>
            <h3 className="font-semibold text-gray-900 dark:text-gray-100">เลื่อนขั้นเงินเดือน</h3>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">เพิ่มขั้นให้เจ้าหน้าที่ ระบบจะไม่ให้เกินขั้นสูงสุดของกระบอก</p>
          </div>

          <EmployeePicker id="step-emp" value={empId} onChange={pick} positionsById={positionsById} />

          {empId && (
            <dl className="grid grid-cols-2 gap-x-4 gap-y-2 rounded-xl bg-gray-50 dark:bg-gray-900/40 px-3.5 py-3 text-sm">
              <div className="col-span-2">
                <dt className="text-xs text-gray-500 dark:text-gray-400">ตำแหน่ง</dt>
                <dd className="text-gray-900 dark:text-gray-100 break-words">{position?.title ?? (positionId != null ? `ตำแหน่ง #${positionId}` : "ยังไม่มีตำแหน่ง")}</dd>
              </div>
              <div>
                <dt className="text-xs text-gray-500 dark:text-gray-400">กระบอก</dt>
                <dd className={tierId ? "text-gray-900 dark:text-gray-100" : "text-amber-700 dark:text-amber-300"}>{tierName(tierId) ?? "ยังไม่กำหนด"}</dd>
              </div>
              <div>
                <dt className="text-xs text-gray-500 dark:text-gray-400">ขั้นปัจจุบัน</dt>
                <dd className="tabular-nums text-gray-900 dark:text-gray-100">{fmtLevel(currentLevel)}</dd>
              </div>
            </dl>
          )}

          {empId && position && tierId == null && (
            <Notice tone="warning">
              ตำแหน่ง “{position.title}” ยังไม่ได้กำหนดระดับ ระบบจะปฏิเสธการเลื่อนขั้น — กำหนดระดับของตำแหน่งนี้ก่อน
              {onGoToPositions && (
                <> {" "}<button type="button" onClick={onGoToPositions} className="font-semibold underline cursor-pointer">ไปที่ตำแหน่งงาน</button></>
              )}
            </Notice>
          )}

          <div>
            <label htmlFor="step-amount" className={labelCls}>จำนวนขั้นที่เพิ่ม <span className="text-red-500" aria-hidden="true">*</span></label>
            <div className="flex gap-2">
              <input
                id="step-amount"
                type="number"
                inputMode="decimal"
                min="0.5"
                step="0.5"
                value={step}
                onChange={(e) => setStep(e.target.value)}
                className={inputCls + " w-24 tabular-nums text-right"}
              />
              <div className="flex gap-1" role="group" aria-label="เลือกจำนวนขั้นด่วน">
                {STEP_PRESETS.map((s) => (
                  <button
                    key={s}
                    type="button"
                    aria-pressed={Number(step) === Number(s)}
                    onClick={() => setStep(s)}
                    className={`h-9 min-w-10 px-2 rounded-lg text-sm tabular-nums font-medium border transition-colors duration-200 cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 ${Number(step) === Number(s) ? "border-indigo-500 bg-indigo-50 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-300 dark:border-indigo-400" : "border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700"}`}
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div>
            <label htmlFor="step-reason" className={labelCls}>เหตุผล <span className="text-red-500" aria-hidden="true">*</span></label>
            <input
              id="step-reason"
              type="text"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              className={inputCls}
              placeholder="เช่น ผลประเมินประจำปี 2569 ระดับดีเด่น"
              maxLength={255}
            />
          </div>

          {fieldError && <Notice tone="error">{fieldError}</Notice>}
          {apiError && (
            <Notice tone="error">
              <p>{apiError.message}</p>
              {apiError.status === 409 && (
                <p className="mt-1">
                  ตำแหน่งของเจ้าหน้าที่คนนี้ยังไม่มีระดับ (กระบอกเงินเดือน) — ไปกำหนดระดับของตำแหน่งที่แท็บ “ตำแหน่งงาน” ก่อน แล้วค่อยเลื่อนขั้นอีกครั้ง
                  {onGoToPositions && (
                    <> {" "}<button type="button" onClick={onGoToPositions} className="font-semibold underline cursor-pointer">ไปที่ตำแหน่งงาน</button></>
                  )}
                </p>
              )}
            </Notice>
          )}

          <button type="submit" disabled={submitting} className={primaryBtn + " w-full"}>
            {submitting ? "กำลังเลื่อนขั้น…" : "เลื่อนขั้น"}
          </button>
        </form>

        <div className="space-y-4 min-w-0" aria-live="polite">
          {result && <AwardResult result={result} />}
          {empId ? (
            <SalaryHistoryTable employeeId={empId} refreshKey={historyKey} />
          ) : (
            <div className={cardCls + " p-6 text-sm text-gray-500 dark:text-gray-400"}>
              เลือกเจ้าหน้าที่เพื่อดูขั้นปัจจุบันและประวัติการเลื่อนขั้น
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function AwardResult({ result }) {
  const gained = Number(result.new_level) - Number(result.old_level)
  return (
    <div className={`rounded-2xl ring-1 p-5 ${result.capped ? "bg-amber-50 ring-amber-200 dark:bg-amber-900/20 dark:ring-amber-700/60" : "bg-emerald-50 ring-emerald-200 dark:bg-emerald-900/20 dark:ring-emerald-800/60"}`}>
      <p className={`text-sm font-semibold ${result.capped ? "text-amber-900 dark:text-amber-200" : "text-emerald-900 dark:text-emerald-200"}`}>
        {result.capped ? "ถึงขั้นสูงสุดของกระบอกแล้ว" : "เลื่อนขั้นแล้ว"} · {result.name}
      </p>
      <div className="mt-2 flex items-baseline gap-3 tabular-nums">
        <span className="text-lg text-gray-500 dark:text-gray-400">{fmtLevel(result.old_level)}</span>
        <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" className="size-4 text-gray-400 self-center"><path d="M5 12h14M13 6l6 6-6 6" /></svg>
        <span className="text-3xl font-bold text-gray-900 dark:text-gray-100">{fmtLevel(result.new_level)}</span>
        <span className="sr-only">จากขั้น {fmtLevel(result.old_level)} เป็นขั้น {fmtLevel(result.new_level)}</span>
        {result.salary != null && <span className="text-sm text-gray-600 dark:text-gray-300">{thb(result.salary)} บาท</span>}
      </div>
      {result.capped ? (
        <p className="mt-2 text-sm text-amber-900 dark:text-amber-200 text-pretty">
          ขอเพิ่ม {fmtLevel(result.requested)} ขั้น แต่ได้จริง {fmtLevel(gained)} ขั้น เพราะชนขั้นสูงสุดของกระบอก ({fmtLevel(result.new_level)}) — ถ้าจะให้ขึ้นต่อต้องเลื่อนตำแหน่งไปกระบอกที่สูงกว่า
        </p>
      ) : (
        <p className="mt-2 text-sm text-emerald-900 dark:text-emerald-200">เพิ่ม {fmtLevel(gained)} ขั้น บันทึกลงประวัติแล้ว</p>
      )}
    </div>
  )
}
