// src/components/hr/kpi/ScoreDialog.jsx
// Score entry for one employee — 3L rework: inputs come from the evaluation's
// `component_max` (the evaluatee's scheme), never from hard-coded maximums.
//   PUT …/{id}/branch-head-score · /asst-manager-score · /manager-score · /board-score
//     body { fiscal_year, score }. `score` omitted on the scheme's individual component
//     = "ใช้คะแนนจากแบบประเมินรายเดือน" (individual_score × max / 100, computed server-side).
//   PUT …/{id}/board-score for non-manager schemes: any of branch_head_score /
//     asst_manager_score / manager_score (mode "คณะกรรมการ").
//   GET …/{id}?fiscal_year= — refresh after a save / resolve a picked employee's scheme.
//   GET …/{id}/self-assessment — shown beside the inputs (never counts).
// Inputs lock outside the window unless status = returned. 409/422 `detail` shown verbatim.
import { useCallback, useEffect, useState } from "react"
import { ClipboardList, Sparkles } from "lucide-react"
import { Notice } from "../HrModal"
import EmployeePicker from "../EmployeePicker"
import Tabs from "../../ui/Tabs"
import { panelId, tabId } from "../../ui/tabIds"
import { apiAuth } from "../../../lib/api"
import { cx, neutralBtnCls, primaryBtnCls } from "../../../lib/styles"
import { Sheet, Skeleton, toast } from "../../ui"
import { errText, inputCls, labelCls } from "../positionUtils"
import { GradeBadge, StatusBadge } from "./KpiBits"
import SelfAssessmentCard from "./SelfAssessmentCard"
import {
  COMPONENT_META,
  canEditScores,
  componentsOf,
  fmtDay,
  fmtScore,
  individualComponentOf,
  itemError,
  num,
} from "./kpiUtils"
import { useEvaluateeSelfAssessment } from "./useKpi"

const toStr = (v) => (num(v) == null ? "" : String(num(v)))

/** loose upper bound for a component across every scheme (used before the scheme is known) */
function looseMax(id, catalogue) {
  const maxes = Object.values(catalogue?.schemes ?? {}).map((s) => num(s?.components?.[id])).filter((n) => n != null)
  return maxes.length ? Math.max(...maxes) : null
}

export default function ScoreDialog({ fy, ev: initialEv, info, phase, perms, catalogue, nameOf, onClose, onSaved }) {
  const isNew = !initialEv
  const [empId, setEmpId] = useState(initialEv ? String(initialEv.user_id) : "")
  const [ev, setEv] = useState(initialEv)
  const [lookup, setLookup] = useState({ loading: false, missing: false, error: "" })
  const [mode, setMode] = useState("single")
  const [form, setForm] = useState({})
  const [saving, setSaving] = useState(null) // null | "save" | "form"
  const [err, setErr] = useState("")

  const self = useEvaluateeSelfAssessment(empId, fy, perms.selfView)

  // (re)load the evaluation: after picking an employee, and after every save so the
  // dialog shows server truth (branch component, individual_score, status).
  const fetchEv = useCallback((id) => {
    if (!perms.viewList) return Promise.resolve(null)
    return apiAuth(`/hr/kpi/evaluations/${Number(id)}?fiscal_year=${Number(fy)}`)
      .then((d) => (d && typeof d === "object" ? d : null))
  }, [fy, perms.viewList])

  useEffect(() => {
    if (!isNew || !empId) return undefined
    let alive = true
    setLookup({ loading: true, missing: false, error: "" })
    setEv(null)
    fetchEv(empId)
      .then((d) => { if (alive) { setEv(d); setLookup({ loading: false, missing: !d, error: "" }) } })
      .catch((e) => {
        if (!alive) return
        if (e?.status === 404) setLookup({ loading: false, missing: true, error: "" })
        else setLookup({ loading: false, missing: false, error: errText(e, "โหลดข้อมูลการประเมินไม่สำเร็จ") })
      })
    return () => { alive = false }
  }, [isNew, empId, fetchEv])

  const status = ev?.status ?? "open"
  const editable = canEditScores({ status }, phase)
  const busy = saving != null

  // components to render
  const known = componentsOf(ev, catalogue)
  const schemeKnown = known.length > 0
  const comps = schemeKnown
    ? known
    : // no evaluation yet → the scheme is decided on the first save; offer what this user may score
      ["branch_head", "asst_manager", "manager"]
        .filter((id) => perms[COMPONENT_META[id].perm])
        .map((id) => ({ ...COMPONENT_META[id], max: looseMax(id, catalogue), loose: true }))
  const individualId = schemeKnown ? individualComponentOf(ev, catalogue) : null
  const individualScore = num(ev?.individual_score)

  const boardAvailable = perms.boardScore && schemeKnown && comps.some((c) => !c.auto && c.id !== "board")
  const board = mode === "board" && boardAvailable
  const inputComps = comps.filter((c) => {
    if (c.auto) return false
    if (board) return c.id !== "board"
    return !!perms[c.perm]
  })

  const value = (c) => (c.id in form ? form[c.id] : toStr(ev?.[c.key]))
  const errors = Object.fromEntries(inputComps.map((c) => [c.id, itemError(value(c), c.max)]))
  const hasRangeError = Object.values(errors).some(Boolean)
  const changed = inputComps.filter((c) => value(c) !== "" && value(c) !== toStr(ev?.[c.key]))

  const refresh = async () => {
    try {
      const fresh = await fetchEv(empId)
      if (fresh) setEv(fresh)
    } catch { /* list reload still runs */ }
    setForm({})
  }

  const save = async () => {
    if (!empId) { setErr("เลือกเจ้าหน้าที่ก่อน"); return }
    if (hasRangeError) return
    if (changed.length === 0) { setErr("ยังไม่มีคะแนนที่เปลี่ยนแปลง"); return }
    setSaving("save")
    setErr("")
    const base = `/hr/kpi/evaluations/${Number(empId)}`
    const done = []
    try {
      if (board) {
        const body = { fiscal_year: Number(fy) }
        for (const c of changed) body[c.key] = Number(value(c))
        await apiAuth(`${base}/board-score`, { method: "PUT", body })
      } else {
        for (const c of changed) {
          await apiAuth(`${base}/${c.path}`, { method: "PUT", body: { fiscal_year: Number(fy), score: Number(value(c)) } })
          done.push(c.label)
        }
      }
      toast.success("บันทึกคะแนนแล้ว", { description: nameOf(empId) })
      onSaved()
    } catch (e) {
      const msg = errText(e)
      setErr(done.length ? `${msg} (บันทึกแล้ว: ${done.join(", ")})` : msg)
      if (done.length) { onSaved({ keepOpen: true }); refresh() }
    } finally {
      setSaving(null)
    }
  }

  /** PUT without `score` → server uses individual_score × max / 100 */
  const applyMonthlyForm = async (c) => {
    setSaving("form")
    setErr("")
    try {
      await apiAuth(`/hr/kpi/evaluations/${Number(empId)}/${c.path}`, { method: "PUT", body: { fiscal_year: Number(fy) } })
      toast.success("ใช้คะแนนจากแบบประเมินรายเดือนแล้ว", { description: `${c.label} · ${nameOf(empId)}` })
      onSaved({ keepOpen: true })
      await refresh()
    } catch (e) {
      setErr(errText(e))
    } finally {
      setSaving(null)
    }
  }

  const footer = (
    <div className="grid grid-cols-2 gap-3 md:flex md:justify-end md:gap-2">
      <button type="button" className={cx(neutralBtnCls, "h-12 md:h-auto")} onClick={onClose} disabled={busy}>ปิด</button>
      <button
        type="button"
        className={cx(primaryBtnCls, "h-12 md:h-auto")}
        onClick={save}
        disabled={busy || !editable || hasRangeError || !empId || inputComps.length === 0 || lookup.loading}
      >
        {saving === "save" ? "กำลังบันทึก…" : board ? "บันทึกคะแนนคณะกรรมการ" : "บันทึกคะแนน"}
      </button>
    </div>
  )

  const showSelf = perms.selfView && !!empId

  return (
    <Sheet
      open
      onClose={onClose}
      title="บันทึกคะแนน KPI"
      subtitle={isNew ? `ปีบัญชี ${fy}` : nameOf(initialEv.user_id)}
      busy={busy}
      size={showSelf ? "full" : "md"}
      footer={footer}
    >
      <div className={cx("gap-5", showSelf ? "grid md:grid-cols-[minmax(0,1fr)_minmax(0,0.9fr)]" : "space-y-4")}>
        <div className="min-w-0 space-y-4">
          {isNew && <EmployeePicker id="kpi-score-emp" value={empId} onChange={(v) => { setEmpId(v); setForm({}); setErr("") }} />}

          {ev && (
            <div className="flex flex-wrap items-center gap-2 text-sm">
              <StatusBadge status={status} />
              {ev.scheme_label && <span className="text-gray-600 dark:text-gray-400">เกณฑ์: {ev.scheme_label}</span>}
              {ev.grade_label && <GradeBadge grade={ev.grade} label={ev.grade_label} />}
              {ev.review_comment && status === "returned" && (
                <span className="basis-full text-gray-600 dark:text-gray-400">เหตุที่ส่งกลับ: {ev.review_comment}</span>
              )}
            </div>
          )}

          {lookup.loading && <Skeleton className="h-24 w-full" />}
          {lookup.error && <Notice tone="error">{lookup.error}</Notice>}
          {empId && !lookup.loading && !schemeKnown && (
            <Notice tone="info" title="ยังไม่มีรายการประเมินของเจ้าหน้าที่คนนี้">
              ระบบกำหนดส่วนที่ให้คะแนนและคะแนนเต็มตามตำแหน่งเมื่อบันทึกครั้งแรก ถ้าตำแหน่งนี้ไม่ใช้ส่วนที่กรอก ระบบจะแจ้งกลับ
            </Notice>
          )}

          {!editable && empId && (
            <Notice tone="warning" title="แก้คะแนนไม่ได้ในตอนนี้">
              {status === "open"
                ? `บันทึกคะแนนได้เฉพาะช่วงประเมิน ${fmtDay(info?.window_start)} – ${fmtDay(info?.window_end)} หรือเมื่อรายการถูกส่งกลับแก้ไข`
                : "รายการนี้สรุปผลแล้ว ต้องให้ผู้ช่วยผู้จัดการหรือผู้จัดการส่งกลับแก้ไขก่อน"}
            </Notice>
          )}

          {boardAvailable && (
            <Tabs
              size="sm"
              idBase="kpi-score-mode"
              ariaLabel="รูปแบบการให้คะแนน"
              value={mode}
              onChange={(m) => { setMode(m); setForm({}); setErr("") }}
              items={[
                { value: "single", label: "รายส่วน" },
                { value: "board", label: "คณะกรรมการ" },
              ]}
            />
          )}
          {board && (
            <p className="text-xs text-gray-500 dark:text-gray-400">คณะกรรมการบันทึกแทนผู้ประเมินได้ทุกส่วนของตำแหน่งนี้ กรอกเฉพาะส่วนที่ต้องการ</p>
          )}

          {empId && !lookup.loading && (
            <div
              className="divide-y divide-gray-100 rounded-xl ring-1 ring-gray-200 dark:divide-gray-700/60 dark:ring-gray-700"
              {...(boardAvailable ? { role: "tabpanel", id: panelId("kpi-score-mode", mode), "aria-labelledby": tabId("kpi-score-mode", mode) } : {})}
            >
              {comps.map((c) => {
                const isInput = inputComps.includes(c)
                const isIndividual = !board && c.id === individualId
                const fieldId = `kpi-score-${c.id}`
                const hintId = `${fieldId}-hint`
                const errId = `${fieldId}-err`
                const preview = individualScore != null && c.max != null ? Math.round(individualScore * c.max) / 100 : null
                return (
                  <div key={c.id} className="space-y-2 px-3.5 py-3">
                    <div className="flex items-baseline justify-between gap-3">
                      {isInput ? (
                        <label htmlFor={fieldId} className={cx(labelCls, "!mb-0 !text-sm !text-gray-800 dark:!text-gray-200")}>
                          {c.label}
                        </label>
                      ) : (
                        <span className="text-sm font-medium text-gray-800 dark:text-gray-200">{c.label}</span>
                      )}
                      <span className="text-xs tabular-nums text-gray-500 dark:text-gray-400">
                        เต็ม {c.max == null ? "—" : fmtScore(c.max)}{c.loose ? " (สูงสุดตามตำแหน่ง)" : ""}
                      </span>
                    </div>

                    {isInput ? (
                      <input
                        id={fieldId}
                        type="number"
                        inputMode="decimal"
                        min="0"
                        max={c.max ?? undefined}
                        step="0.5"
                        value={value(c)}
                        disabled={!editable || busy}
                        onChange={(e) => setForm((s) => ({ ...s, [c.id]: e.target.value }))}
                        aria-invalid={errors[c.id] ? true : undefined}
                        aria-describedby={cx(errors[c.id] && errId, isIndividual && hintId) || undefined}
                        className={cx(inputCls, "tabular-nums disabled:opacity-60 disabled:cursor-not-allowed", errors[c.id] && "!border-red-400 dark:!border-red-500")}
                      />
                    ) : (
                      <p className="text-sm tabular-nums text-gray-900 dark:text-gray-100">
                        {fmtScore(ev?.[c.key])}
                        <span className="ml-2 text-xs text-gray-500 dark:text-gray-400">
                          {c.auto
                            ? num(ev?.[c.key]) == null
                              ? "คำนวณจาก KPI สาขาอัตโนมัติ ยังไม่มี KPI สาขา"
                              : "คำนวณจาก KPI สาขาอัตโนมัติ"
                            : "ผู้ประเมินส่วนนี้เป็นผู้บันทึก"}
                        </span>
                      </p>
                    )}
                    {errors[c.id] && <p id={errId} className="text-xs font-medium text-red-600 dark:text-red-400">ต้องอยู่ระหว่าง {errors[c.id]}</p>}

                    {isIndividual && isInput && (
                      <div id={hintId} className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-indigo-50/70 px-3 py-2 text-xs text-indigo-900 dark:bg-indigo-500/10 dark:text-indigo-200">
                        <span className="inline-flex items-center gap-1.5">
                          <ClipboardList aria-hidden="true" className="size-3.5" strokeWidth={2} />
                          {individualScore == null
                            ? "ยังไม่มีคะแนนจากแบบประเมินรายเดือน"
                            : <>แบบประเมินรายเดือน <b className="tabular-nums">{fmtScore(individualScore)}</b>/100 → <b className="tabular-nums">{fmtScore(preview)}</b>/{fmtScore(c.max)}</>}
                        </span>
                        <button
                          type="button"
                          className="inline-flex min-h-touch items-center gap-1 rounded-md px-2 font-semibold text-indigo-700 hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 disabled:cursor-not-allowed disabled:opacity-50 disabled:no-underline md:min-h-0 md:py-1 dark:text-indigo-300"
                          onClick={() => applyMonthlyForm(c)}
                          disabled={!editable || busy || individualScore == null}
                        >
                          <Sparkles aria-hidden="true" className="size-3.5" strokeWidth={2} />
                          {saving === "form" ? "กำลังบันทึก…" : "ใช้คะแนนจากแบบประเมินรายเดือน"}
                        </button>
                      </div>
                    )}
                  </div>
                )
              })}
              {comps.length === 0 && (
                <p className="px-3.5 py-3 text-sm text-gray-600 dark:text-gray-400">บัญชีของคุณไม่มีสิทธิ์ให้คะแนนส่วนใดของตำแหน่งนี้</p>
              )}
            </div>
          )}

          {err && <Notice tone="error">{err}</Notice>}
        </div>

        {showSelf && (
          <SelfAssessmentCard
            data={self.data}
            loading={self.loading}
            error={self.error}
            catalogue={catalogue}
            className="md:self-start"
          />
        )}
      </div>
    </Sheet>
  )
}
