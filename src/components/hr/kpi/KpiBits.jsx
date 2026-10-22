// src/components/hr/kpi/KpiBits.jsx
// Small shared pieces for the KPI tab: status / pending / eligibility badges,
// step cell, required note field, result tables for skipped rows.
import { useId } from "react"
import { Badge } from "../../ui"
import { cx } from "../../../lib/styles"
import { GRADE_TONE, PENDING, STATUS, componentsOf, fmtScore, fmtStep, num } from "./kpiUtils"
import { inputCls, labelCls, thCls } from "../positionUtils"

export function StatusBadge({ status }) {
  const s = STATUS[status]
  return <Badge tone={s?.tone ?? "neutral"}>{s?.label ?? status ?? "—"}</Badge>
}

/** grade_label pill (null until finalize → dash) */
export function GradeBadge({ grade, label, className = "" }) {
  if (!grade && !label) return <span className="text-gray-400 dark:text-gray-500">—</span>
  return <Badge tone={GRADE_TONE[grade] ?? "neutral"} className={className}>{label ?? grade}</Badge>
}

/**
 * Per-scheme score breakdown: "หส. 31.5/42 · สาขา 25/28 · …". Columns can't be
 * fixed any more (each row may use a different scheme), so this is one cell.
 */
export function ComponentBreakdown({ ev, catalogue, className = "" }) {
  const comps = componentsOf(ev, catalogue)
  if (!comps.length) return <span className="text-xs text-gray-500 dark:text-gray-400">ยังไม่ทราบเกณฑ์ตำแหน่ง</span>
  return (
    <dl className={cx("flex flex-wrap gap-x-3 gap-y-0.5 text-xs tabular-nums", className)}>
      {comps.map((c) => {
        const v = num(ev?.[c.key])
        return (
          <div key={c.id} className="inline-flex items-baseline gap-1 whitespace-nowrap">
            <dt className="text-gray-500 dark:text-gray-400">{c.short}</dt>
            <dd className={v == null ? "text-gray-400 dark:text-gray-500" : "font-medium text-gray-800 dark:text-gray-200"}>
              {fmtScore(v)}
              <span className="font-normal text-gray-400 dark:text-gray-500">/{fmtScore(c.max)}</span>
            </dd>
          </div>
        )
      })}
    </dl>
  )
}

/** scheme label under the employee name */
export function SchemeLabel({ ev, catalogue }) {
  const label = ev?.scheme_label ?? (ev?.scheme && catalogue?.schemes?.[ev.scheme]?.label)
  if (!label) return null
  return <p className="text-xs text-gray-500 dark:text-gray-400">เกณฑ์: {label}</p>
}

export function PendingBadge({ status }) {
  const p = PENDING[status]
  if (!p) return null
  return <Badge tone={p.tone}>{p.label}</Badge>
}

/** eligible true/false/null + overridden marker */
export function EligibilityBadge({ ev }) {
  if (ev?.eligible == null) return <span className="text-gray-400 dark:text-gray-500">—</span>
  return (
    <span className="inline-flex flex-wrap items-center gap-1 whitespace-nowrap">
      {ev.eligible ? <Badge tone="success">มีสิทธิ์</Badge> : <Badge tone="danger">ไม่มีสิทธิ์</Badge>}
      {ev.eligibility_overridden && <Badge tone="neutral">แก้โดยผู้ตรวจ</Badge>}
    </span>
  )
}

/** step_awarded with immediate / pending split */
export function StepCell({ ev }) {
  const awarded = num(ev?.step_awarded)
  const imm = num(ev?.step_immediate)
  const pend = num(ev?.step_pending)
  if (awarded == null) return <span className="text-gray-400 dark:text-gray-500">—</span>
  return (
    <div className="leading-tight">
      <span className="font-semibold text-gray-900 dark:text-gray-100 tabular-nums">{fmtStep(awarded)}</span>
      <span className="text-xs text-gray-500 dark:text-gray-400"> ขั้น</span>
      {(imm != null || (pend != null && pend > 0)) && (
        <p className="mt-0.5 text-xs text-gray-500 dark:text-gray-400 tabular-nums whitespace-nowrap">
          เม.ย. {fmtStep(imm ?? awarded)}
          {pend != null && pend > 0 && <> / รอ {fmtStep(pend)}</>}
        </p>
      )}
    </div>
  )
}

/** required textarea with inline error */
export function NoteField({ label, value, onChange, error, placeholder, required = true, rows = 3, hint }) {
  const id = useId()
  const errId = `${id}-err`
  const hintId = `${id}-hint`
  return (
    <div>
      <label htmlFor={id} className={labelCls}>
        {label}
        {required && <span className="text-red-600 dark:text-red-400"> *</span>}
      </label>
      <textarea
        id={id}
        rows={rows}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        aria-invalid={error ? true : undefined}
        aria-describedby={cx(error && errId, hint && hintId) || undefined}
        className={cx(inputCls, "resize-y", error && "border-red-400 dark:border-red-500")}
      />
      {hint && !error && <p id={hintId} className="mt-1 text-xs text-gray-500 dark:text-gray-400">{hint}</p>}
      {error && <p id={errId} className="mt-1 text-xs font-medium text-red-600 dark:text-red-400">{error}</p>}
    </div>
  )
}

/** [{user_id, reason}] → table (finalize-all / approve / profit skipped lists) */
export function SkippedTable({ items, nameOf, title = "ข้ามไป", renderAction }) {
  if (!items?.length) return null
  return (
    <div>
      <h4 className="mb-2 text-sm font-semibold text-amber-800 dark:text-amber-200">
        {title} <span className="tabular-nums">{items.length}</span> คน
      </h4>
      <div className="overflow-x-auto rounded-xl ring-1 ring-amber-200 dark:ring-amber-800/60">
        <table className="w-full text-sm">
          <thead className="bg-amber-50 dark:bg-amber-900/20">
            <tr>
              <th scope="col" className={cx(thCls, "whitespace-nowrap text-left")}>เจ้าหน้าที่</th>
              <th scope="col" className={cx(thCls, "whitespace-nowrap text-left")}>เหตุผล</th>
              {renderAction && <th scope="col" className={thCls}><span className="sr-only">การทำงาน</span></th>}
            </tr>
          </thead>
          <tbody className="divide-y divide-amber-100 dark:divide-amber-900/40">
            {items.map((s, i) => (
              <tr key={`${s.user_id}-${i}`}>
                <td className="px-4 py-2.5 align-top font-medium text-gray-900 dark:text-gray-100 whitespace-nowrap">{nameOf(s.user_id)}</td>
                <td className="px-4 py-2.5 align-top text-gray-700 dark:text-gray-300 break-words min-w-[14rem]">{s.reason || "—"}</td>
                {renderAction && <td className="px-4 py-2.5 align-top text-right whitespace-nowrap">{renderAction(s)}</td>}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
