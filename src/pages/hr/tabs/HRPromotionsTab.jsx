// src/pages/hr/tabs/HRPromotionsTab.jsx
// เลื่อนตำแหน่ง (3D)
// GET   /hr/promotions/eligible            → [{user_id, full_name, position_title, position_entered_date, years_in_position}]
// POST  /hr/promotions/exams               {candidate_id, position_target, exam_date, notes?}
// PATCH /hr/promotions/exams/{id}/result   {result: "pass"|"fail", reason, notes?}
//       pass → BE เปลี่ยนตำแหน่ง + เทียบขั้นเงินเดือนให้อัตโนมัติ · 409 บันทึกผลไปแล้ว · 422 ตำแหน่งเป้าหมายถูกปิด
//
// หมายเหตุ: BE ไม่มี endpoint รายการการสอบ → เก็บการสอบที่นัดจากเครื่องนี้ไว้ใน localStorage
// และมีช่อง "บันทึกผลด้วยเลขที่การสอบ" สำหรับการสอบที่นัดจากเครื่องอื่น
import { useCallback, useEffect, useMemo, useState } from "react"
import { apiAuth } from "../../../lib/api"
import SelectDropdown from "../../../components/SelectDropdown"
import ThaiDateInput from "../../../components/ThaiDateInput"
import { SkeletonTableRows, ErrorState, EmptyState, Badge } from "../../../components/ui"
import HrModal, { Notice } from "../../../components/hr/HrModal"
import EmployeePicker from "../../../components/hr/EmployeePicker"
import usePositions from "../../../components/hr/usePositions"
import {
  tierName, fmtDate, fmtLevel, errText, employeeName,
  inputCls, labelCls, primaryBtn, secondaryBtn, linkBtn, cardCls, thCls,
} from "../../../components/hr/positionUtils"

const EXAMS_KEY = "skt_hr_promotion_exams_v1"

function loadExams() {
  try {
    const raw = JSON.parse(localStorage.getItem(EXAMS_KEY) || "[]")
    return Array.isArray(raw) ? raw : []
  } catch {
    return []
  }
}

const RESULT_BADGE = {
  pending: ["pending", "รอผลสอบ"],
  pass: ["success", "ผ่าน"],
  fail: ["danger", "ไม่ผ่าน"],
  recorded: ["neutral", "บันทึกผลแล้ว"],
}

export default function HRPromotionsTab() {
  const { byId: positionsById, active: activePositions, reload: reloadPositions } = usePositions()

  const [eligible, setEligible] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")

  const [exams, setExams] = useState(loadExams)
  const [flash, setFlash] = useState(null) // { tone, title, body }

  const [scheduleFor, setScheduleFor] = useState(null) // { candidate_id?, candidate_name? } | {}
  const [resultFor, setResultFor] = useState(null) // exam record (may be partial: { id })
  const [manualId, setManualId] = useState("")
  const [manualError, setManualError] = useState("")

  const fetchEligible = useCallback(() => {
    setLoading(true)
    setError("")
    apiAuth("/hr/promotions/eligible")
      .then((d) => {
        const list = Array.isArray(d) ? [...d] : []
        list.sort((a, b) => (b.years_in_position ?? 0) - (a.years_in_position ?? 0))
        setEligible(list)
      })
      .catch((e) => setError(errText(e, "โหลดรายชื่อผู้มีสิทธิ์ไม่สำเร็จ")))
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => { fetchEligible() }, [fetchEligible])

  useEffect(() => {
    try { localStorage.setItem(EXAMS_KEY, JSON.stringify(exams.slice(0, 200))) } catch { /* quota/private mode */ }
  }, [exams])

  const pendingByCandidate = useMemo(() => {
    const m = {}
    for (const ex of exams) if (ex.result === "pending") m[ex.candidate_id] = ex
    return m
  }, [exams])

  const upsertExam = (rec) =>
    setExams((list) => {
      const i = list.findIndex((x) => x.id === rec.id)
      if (i === -1) return [rec, ...list]
      const next = [...list]
      next[i] = { ...next[i], ...rec }
      return next
    })

  const openManual = (e) => {
    e.preventDefault()
    const id = Number(manualId)
    if (!Number.isInteger(id) || id <= 0) return setManualError("กรอกเลขที่การสอบเป็นตัวเลข")
    setManualError("")
    setResultFor(exams.find((x) => x.id === id) ?? { id })
  }

  return (
    <div className="space-y-6">
      {flash && (
        <Notice tone={flash.tone} title={flash.title}>
          {flash.body}
        </Notice>
      )}

      {/* ─── Eligible ─────────────────────────────────────────────── */}
      <section aria-labelledby="eligible-title" className="space-y-3">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h2 id="eligible-title" className="text-base font-semibold text-gray-900 dark:text-gray-100">ผู้มีสิทธิ์สอบเลื่อนตำแหน่ง</h2>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              ดำรงตำแหน่งปัจจุบันครบ 3 ปีขึ้นไป{!loading && !error ? ` · ${eligible.length} คน` : ""}
            </p>
          </div>
          <button type="button" onClick={() => setScheduleFor({})} className={secondaryBtn}>นัดสอบคนอื่น</button>
        </div>

        {error && <ErrorState message={error} onRetry={fetchEligible} />}

        <div className={cardCls + " overflow-hidden"}>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <caption className="sr-only">ผู้มีสิทธิ์สอบเลื่อนตำแหน่ง</caption>
              <thead>
                <tr className="border-b border-gray-100 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/30">
                  <th scope="col" className={thCls + " text-left"}>เจ้าหน้าที่</th>
                  <th scope="col" className={thCls + " text-left hidden md:table-cell"}>ตำแหน่งปัจจุบัน</th>
                  <th scope="col" className={thCls + " text-left hidden lg:table-cell whitespace-nowrap"}>ดำรงตำแหน่งตั้งแต่</th>
                  <th scope="col" className={thCls + " text-right whitespace-nowrap"}>อยู่ในตำแหน่ง</th>
                  <th scope="col" className={thCls + " text-right"}><span className="sr-only">จัดการ</span></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-700/50">
                {loading ? (
                  <SkeletonTableRows rows={5} cols={5} />
                ) : error ? null : eligible.length === 0 ? (
                  <tr><td colSpan={5} className="p-0">
                    <EmptyState title="ยังไม่มีผู้มีสิทธิ์" description="ยังไม่มีเจ้าหน้าที่ที่อยู่ในตำแหน่งปัจจุบันครบ 3 ปี ถ้าต้องการนัดสอบกรณีพิเศษ ใช้ปุ่ม “นัดสอบคนอื่น”" />
                  </td></tr>
                ) : eligible.map((emp) => {
                  const pending = pendingByCandidate[emp.user_id]
                  return (
                    <tr key={emp.user_id} className="hover:bg-gray-50 dark:hover:bg-gray-700/30 transition-colors">
                      <td className="px-4 py-3">
                        <p className="font-medium text-gray-900 dark:text-gray-100 break-words">{emp.full_name}</p>
                        <p className="text-xs text-gray-500 dark:text-gray-400">
                          รหัส <span className="tabular-nums">{emp.user_id}</span>
                          <span className="md:hidden"> · {emp.position_title ?? "ไม่มีตำแหน่ง"}</span>
                        </p>
                      </td>
                      <td className="px-4 py-3 text-gray-700 dark:text-gray-300 hidden md:table-cell break-words">{emp.position_title ?? "—"}</td>
                      <td className="px-4 py-3 text-gray-600 dark:text-gray-400 hidden lg:table-cell whitespace-nowrap">{fmtDate(emp.position_entered_date)}</td>
                      <td className="px-4 py-3 text-right tabular-nums font-semibold text-gray-900 dark:text-gray-100 whitespace-nowrap">{emp.years_in_position ?? "—"} ปี</td>
                      <td className="px-4 py-3 text-right whitespace-nowrap">
                        {pending ? (
                          <button type="button" onClick={() => setResultFor(pending)} className={linkBtn}>
                            บันทึกผล <span className="font-normal text-gray-500 dark:text-gray-400">(สอบ {fmtDate(pending.exam_date)})</span>
                          </button>
                        ) : (
                          <button type="button" onClick={() => setScheduleFor({ candidate_id: String(emp.user_id), candidate_name: emp.full_name, current_title: emp.position_title })} className={linkBtn} aria-label={`นัดสอบ ${emp.full_name}`}>
                            นัดสอบ
                          </button>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {/* ─── Exams ─────────────────────────────────────────────────── */}
      <section aria-labelledby="exams-title" className="space-y-3">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h2 id="exams-title" className="text-base font-semibold text-gray-900 dark:text-gray-100">การสอบที่นัดไว้</h2>
            <p className="text-sm text-gray-500 dark:text-gray-400">รายการที่นัดจากเครื่องนี้ ถ้านัดจากเครื่องอื่นให้บันทึกผลด้วยเลขที่การสอบ</p>
          </div>
          <form onSubmit={openManual} className="flex items-start gap-2" noValidate>
            <div>
              <label htmlFor="manual-exam-id" className="sr-only">เลขที่การสอบ</label>
              <input id="manual-exam-id" type="number" inputMode="numeric" min="1" value={manualId}
                onChange={(e) => setManualId(e.target.value)} placeholder="เลขที่การสอบ"
                aria-invalid={manualError ? "true" : undefined} aria-describedby={manualError ? "manual-exam-err" : undefined}
                className={inputCls + " w-36 tabular-nums"} />
              {manualError && <p id="manual-exam-err" className="mt-1 text-xs text-red-600 dark:text-red-400">{manualError}</p>}
            </div>
            <button type="submit" className={secondaryBtn + " whitespace-nowrap"}>บันทึกผล</button>
          </form>
        </div>

        <div className={cardCls + " overflow-hidden"}>
          {exams.length === 0 ? (
            <EmptyState title="ยังไม่มีการสอบที่นัดไว้" description="กด “นัดสอบ” ที่รายชื่อผู้มีสิทธิ์ด้านบนเพื่อสร้างการสอบ" />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <caption className="sr-only">การสอบที่นัดไว้</caption>
                <thead>
                  <tr className="border-b border-gray-100 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/30">
                    <th scope="col" className={thCls + " text-left whitespace-nowrap"}>เลขที่</th>
                    <th scope="col" className={thCls + " text-left"}>ผู้สอบ</th>
                    <th scope="col" className={thCls + " text-left hidden md:table-cell"}>ตำแหน่งเป้าหมาย</th>
                    <th scope="col" className={thCls + " text-left whitespace-nowrap hidden sm:table-cell"}>วันสอบ</th>
                    <th scope="col" className={thCls + " text-left"}>ผล</th>
                    <th scope="col" className={thCls + " text-right"}><span className="sr-only">จัดการ</span></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-gray-700/50">
                  {exams.map((ex) => {
                    const [tone, label] = RESULT_BADGE[ex.result] ?? RESULT_BADGE.pending
                    const targetTitle = positionsById[ex.position_target]?.title ?? ex.target_title ?? `#${ex.position_target}`
                    return (
                      <tr key={ex.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/30 transition-colors">
                        <td className="px-4 py-3 tabular-nums text-gray-500 dark:text-gray-400">#{ex.id}</td>
                        <td className="px-4 py-3">
                          <p className="font-medium text-gray-900 dark:text-gray-100 break-words">{ex.candidate_name ?? `รหัส ${ex.candidate_id}`}</p>
                          <p className="md:hidden text-xs text-gray-500 dark:text-gray-400 break-words">→ {targetTitle}</p>
                        </td>
                        <td className="px-4 py-3 text-gray-700 dark:text-gray-300 hidden md:table-cell break-words">{targetTitle}</td>
                        <td className="px-4 py-3 text-gray-600 dark:text-gray-400 whitespace-nowrap hidden sm:table-cell">{fmtDate(ex.exam_date)}</td>
                        <td className="px-4 py-3"><Badge tone={tone}>{label}</Badge></td>
                        <td className="px-4 py-3 text-right whitespace-nowrap">
                          {ex.result === "pending" ? (
                            <button type="button" onClick={() => setResultFor(ex)} className={linkBtn}>บันทึกผล</button>
                          ) : (
                            <button type="button" onClick={() => setExams((l) => l.filter((x) => x.id !== ex.id))}
                              className="text-xs text-gray-500 dark:text-gray-400 hover:underline cursor-pointer rounded focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
                              aria-label={`ซ่อนการสอบเลขที่ ${ex.id} จากรายการ`}>
                              ซ่อน
                            </button>
                          )}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </section>

      {scheduleFor && (
        <ScheduleExamModal
          initial={scheduleFor}
          activePositions={activePositions}
          positionsById={positionsById}
          onClose={() => setScheduleFor(null)}
          onCreated={(rec) => {
            upsertExam(rec)
            setScheduleFor(null)
            setFlash({ tone: "success", title: `นัดสอบแล้ว · เลขที่การสอบ #${rec.id}`, body: `${rec.candidate_name} สอบเข้าตำแหน่ง “${rec.target_title}” วันที่ ${fmtDate(rec.exam_date)}` })
          }}
        />
      )}

      {resultFor && (
        <RecordResultModal
          exam={resultFor}
          positionsById={positionsById}
          onClose={() => setResultFor(null)}
          onConflict={() => {
            if (exams.some((x) => x.id === resultFor.id && x.result === "pending")) upsertExam({ id: resultFor.id, result: "recorded" })
          }}
          onRecorded={(res, form) => {
            const known = exams.some((x) => x.id === resultFor.id)
            if (known) upsertExam({ id: resultFor.id, result: form.result })
            setResultFor(null)
            setManualId("")
            const who = resultFor.candidate_name ?? (res?.candidate_id ? `รหัส ${res.candidate_id}` : "ผู้สอบ")
            if (form.result === "pass") {
              const newPosId = res?.new_position_id ?? resultFor.position_target
              const newTitle = positionsById[newPosId]?.title ?? resultFor.target_title ?? (newPosId ? `#${newPosId}` : "ตำแหน่งเป้าหมาย")
              const levelMoved = res?.old_salary_level != null && res?.new_salary_level != null
              setFlash({
                tone: "success",
                title: `บันทึกผลสอบแล้ว: ผ่าน · ${who}`,
                body: (
                  <>
                    <p>ระบบเปลี่ยนตำแหน่งเป็น “{newTitle}” และเทียบขั้นเงินเดือนในกระบอกใหม่ให้อัตโนมัติแล้ว</p>
                    <p className="tabular-nums">
                      {levelMoved
                        ? `ขั้นเงินเดือน ${fmtLevel(res.old_salary_level)} → ${fmtLevel(res.new_salary_level)} (เงินเดือนเท่าเดิม หรือขั้นที่ใกล้ที่สุดโดยไม่เกินเงินเดือนเดิม)`
                        : "ขั้นเงินเดือนคงเดิม (ขั้นเดิมตรงกับเงินเดือนในกระบอกใหม่ หรือยังไม่มีข้อมูลบัญชีเงินเดือน)"}
                    </p>
                  </>
                ),
              })
            } else {
              setFlash({ tone: "info", title: `บันทึกผลสอบแล้ว: ไม่ผ่าน · ${who}`, body: "ตำแหน่งและขั้นเงินเดือนคงเดิม" })
            }
            fetchEligible()
            reloadPositions()
          }}
        />
      )}
    </div>
  )
}

// ─── Schedule exam ───────────────────────────────────────────────────────────
function ScheduleExamModal({ initial, activePositions, positionsById, onClose, onCreated }) {
  const fixedCandidate = !!initial.candidate_id
  const [candidateId, setCandidateId] = useState(initial.candidate_id ?? "")
  const [candidateName, setCandidateName] = useState(initial.candidate_name ?? "")
  const [target, setTarget] = useState("")
  const [examDate, setExamDate] = useState("")
  const [notes, setNotes] = useState("")
  const [saving, setSaving] = useState(false)
  const [err, setErr] = useState("")

  const options = useMemo(
    () => activePositions.map((p) => ({ value: String(p.id), label: p.title, sublabel: tierName(p.position_tier_id) ?? "ยังไม่กำหนดระดับ" })),
    [activePositions],
  )
  const targetPos = target ? positionsById[target] : null

  const submit = async (e) => {
    e?.preventDefault()
    if (!candidateId) return setErr("เลือกผู้สอบ")
    if (!target) return setErr("เลือกตำแหน่งเป้าหมาย")
    if (!examDate) return setErr("เลือกวันสอบ")
    setSaving(true)
    setErr("")
    try {
      const body = { candidate_id: Number(candidateId), position_target: Number(target), exam_date: examDate }
      if (notes.trim()) body.notes = notes.trim()
      const res = await apiAuth("/hr/promotions/exams", { method: "POST", body })
      onCreated({
        id: res?.id,
        candidate_id: Number(candidateId),
        candidate_name: candidateName || `รหัส ${candidateId}`,
        position_target: Number(target),
        target_title: targetPos?.title ?? `#${target}`,
        exam_date: res?.exam_date ?? examDate,
        notes: body.notes ?? null,
        result: res?.result ?? "pending",
        created_at: new Date().toISOString(),
      })
    } catch (e2) {
      setErr(errText(e2, "นัดสอบไม่สำเร็จ"))
    } finally {
      setSaving(false)
    }
  }

  return (
    <HrModal
      title="นัดสอบเลื่อนตำแหน่ง"
      subtitle={fixedCandidate ? `${initial.candidate_name}${initial.current_title ? ` · ปัจจุบัน ${initial.current_title}` : ""}` : undefined}
      onClose={onClose}
      busy={saving}
      size="md"
      footer={
        <>
          <button type="button" onClick={onClose} disabled={saving} className={secondaryBtn + " flex-1"}>ยกเลิก</button>
          <button type="submit" form="schedule-exam-form" disabled={saving} className={primaryBtn + " flex-1"}>{saving ? "กำลังนัดสอบ…" : "นัดสอบ"}</button>
        </>
      }
    >
      <form id="schedule-exam-form" onSubmit={submit} className="space-y-3" noValidate>
        {!fixedCandidate && (
          <EmployeePicker id="exam-candidate" label="ผู้สอบ" value={candidateId} positionsById={positionsById}
            onChange={(v, emp) => { setCandidateId(v); setCandidateName(employeeName(emp)) }} />
        )}
        <div>
          <span id="exam-target-label" className={labelCls}>ตำแหน่งเป้าหมาย <span className="text-red-500" aria-hidden="true">*</span></span>
          <SelectDropdown options={options} value={target} onChange={setTarget} placeholder="— เลือกตำแหน่ง (เฉพาะที่ใช้งาน) —" ariaLabelledby="exam-target-label" />
          {targetPos && targetPos.position_tier_id == null && (
            <p className="mt-1 text-xs text-amber-700 dark:text-amber-300">ตำแหน่งนี้ยังไม่กำหนดระดับ ถ้าสอบผ่านระบบจะเทียบขั้นเงินเดือนให้ไม่ได้</p>
          )}
        </div>
        <div>
          <span id="exam-date-label" className={labelCls}>วันสอบ <span className="text-red-500" aria-hidden="true">*</span></span>
          <ThaiDateInput ariaLabelledby="exam-date-label" className={inputCls + " focus-within:ring-2 focus-within:ring-indigo-500"} value={examDate} onChange={setExamDate} />
        </div>
        <div>
          <label htmlFor="exam-notes" className={labelCls}>หมายเหตุ</label>
          <input id="exam-notes" type="text" value={notes} maxLength={255} onChange={(e) => setNotes(e.target.value)} className={inputCls} placeholder="ไม่บังคับ" />
        </div>
        {err && <Notice tone="error">{err}</Notice>}
      </form>
    </HrModal>
  )
}

// ─── Record result ───────────────────────────────────────────────────────────
function RecordResultModal({ exam, positionsById, onClose, onRecorded, onConflict }) {
  const [result, setResult] = useState("")
  const [reason, setReason] = useState("")
  const [notes, setNotes] = useState("")
  const [saving, setSaving] = useState(false)
  const [err, setErr] = useState(null) // { status, message }

  const targetTitle = exam.position_target != null
    ? positionsById[exam.position_target]?.title ?? exam.target_title ?? `#${exam.position_target}`
    : null

  const submit = async (e) => {
    e?.preventDefault()
    if (!result) return setErr({ message: "เลือกผลสอบ" })
    if (!reason.trim()) return setErr({ message: "กรอกเหตุผล" })
    setSaving(true)
    setErr(null)
    const form = { result, reason: reason.trim(), ...(notes.trim() ? { notes: notes.trim() } : {}) }
    try {
      const res = await apiAuth(`/hr/promotions/exams/${exam.id}/result`, { method: "PATCH", body: form })
      onRecorded(res, form)
    } catch (e2) {
      // 422 แบบ string = กฎธุรกิจ (ตำแหน่งเป้าหมายถูกปิด); แบบ list = validation ของ FastAPI
      setErr({ status: e2?.status, business: typeof e2?.data?.detail === "string", message: errText(e2, "บันทึกผลไม่สำเร็จ") })
      if (e2?.status === 409) onConflict?.()
    } finally {
      setSaving(false)
    }
  }

  const choice = (value, label, activeCls) => (
    <label className={`flex-1 flex items-center justify-center gap-2 h-11 rounded-xl border text-sm font-semibold cursor-pointer transition-colors duration-200 has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-indigo-500 ${result === value ? activeCls : "border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700"}`}>
      <input type="radio" name="exam-result" value={value} checked={result === value} onChange={() => setResult(value)} className="sr-only" />
      {label}
    </label>
  )

  return (
    <HrModal
      title={`บันทึกผลสอบ #${exam.id}`}
      subtitle={[exam.candidate_name, targetTitle && `ตำแหน่งเป้าหมาย ${targetTitle}`].filter(Boolean).join(" · ") || undefined}
      onClose={onClose}
      busy={saving}
      size="md"
      footer={
        <>
          <button type="button" onClick={onClose} disabled={saving} className={secondaryBtn + " flex-1"}>{err?.status === 409 ? "ปิด" : "ยกเลิก"}</button>
          <button type="submit" form="exam-result-form" disabled={saving} className={primaryBtn + " flex-1"}>{saving ? "กำลังบันทึก…" : "บันทึกผล"}</button>
        </>
      }
    >
      <form id="exam-result-form" onSubmit={submit} className="space-y-3" noValidate>
        <fieldset>
          <legend className={labelCls}>ผลสอบ <span className="text-red-500" aria-hidden="true">*</span></legend>
          <div className="flex gap-2">
            {choice("pass", "ผ่าน", "border-emerald-500 bg-emerald-50 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-200 dark:border-emerald-500")}
            {choice("fail", "ไม่ผ่าน", "border-red-500 bg-red-50 text-red-700 dark:bg-red-900/30 dark:text-red-200 dark:border-red-500")}
          </div>
        </fieldset>
        {result === "pass" && (
          <Notice tone="info">
            เมื่อบันทึก “ผ่าน” ระบบจะเปลี่ยนตำแหน่งเป็น{targetTitle ? ` “${targetTitle}”` : "ตำแหน่งเป้าหมาย"} และเทียบขั้นเงินเดือนในกระบอกใหม่ให้อัตโนมัติ (เงินเดือนเท่าเดิม หรือขั้นที่ใกล้ที่สุดโดยไม่เกินเงินเดือนเดิม) บันทึกแล้วแก้ไม่ได้
          </Notice>
        )}
        {result === "fail" && <Notice tone="info">ตำแหน่งและขั้นเงินเดือนคงเดิม บันทึกแล้วแก้ไม่ได้</Notice>}
        <div>
          <label htmlFor="exam-reason" className={labelCls}>เหตุผล <span className="text-red-500" aria-hidden="true">*</span></label>
          <input id="exam-reason" type="text" value={reason} maxLength={255} onChange={(e) => setReason(e.target.value)} className={inputCls}
            placeholder={result === "fail" ? "เช่น คะแนนไม่ถึงเกณฑ์" : "เช่น สอบผ่านตามประกาศผลสอบ ครั้งที่ 1/2569"} />
          {result === "pass" && <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">ใช้เป็นเหตุผลในประวัติตำแหน่งด้วย</p>}
        </div>
        <div>
          <label htmlFor="exam-result-notes" className={labelCls}>หมายเหตุ</label>
          <input id="exam-result-notes" type="text" value={notes} maxLength={255} onChange={(e) => setNotes(e.target.value)} className={inputCls} placeholder="ไม่บังคับ" />
        </div>
        {err && (
          <Notice tone="error">
            <p>{err.message}</p>
            {err.status === 409 && <p className="mt-1">การสอบนี้บันทึกผลไปแล้ว ระบบไม่เปลี่ยนแปลงข้อมูลใด ๆ</p>}
            {err.status === 422 && err.business && <p className="mt-1">ตำแหน่งเป้าหมายถูกปิดใช้งานแล้ว — นัดสอบใหม่โดยเลือกตำแหน่งที่ยังใช้งานอยู่</p>}
          </Notice>
        )}
      </form>
    </HrModal>
  )
}
