// src/components/hr/kpi/ReviewTable.jsx
// Shared review queue table for ผช.ผจก. (status=finalized) and ผจก. (status=asst_reviewed):
// selectable rows, breakdown 42/28/20/10, composite, step (immediate / pending), eligibility.
// Ineligible reasons render as a full-width line under the row so reviewers can't miss them.
import { Fragment, useEffect, useRef } from "react"
import { AlertTriangle } from "lucide-react"
import { cx } from "../../../lib/styles"
import { Badge, SkeletonTableRows } from "../../ui"
import { cardCls, linkBtn, thCls } from "../positionUtils"
import { EligibilityBadge, StepCell } from "./KpiBits"
import { COMPONENTS, fmtScore } from "./kpiUtils"

const checkCls =
  "size-4 rounded border-gray-300 text-indigo-600 accent-indigo-600 cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 dark:border-gray-600 disabled:cursor-not-allowed disabled:opacity-50"

export default function ReviewTable({
  caption,
  rows,
  loading,
  people,
  selected,
  onToggle,
  onToggleAll,
  isSelectable = () => true,
  canReopen,
  canEligibility,
  onReopen,
  onEligibility,
  showSenior = false,
}) {
  const selectable = rows.filter(isSelectable)
  const allOn = selectable.length > 0 && selectable.every((r) => selected.has(r.user_id))
  const someOn = selectable.some((r) => selected.has(r.user_id))
  const headRef = useRef(null)
  useEffect(() => {
    if (headRef.current) headRef.current.indeterminate = someOn && !allOn
  }, [someOn, allOn])
  const cols = 6 + COMPONENTS.length
  const hasActions = canReopen || canEligibility

  return (
    <div className={cx(cardCls, "overflow-hidden")}>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <caption className="sr-only">{caption}</caption>
          <thead className="border-b border-gray-100 bg-gray-50 dark:border-gray-700 dark:bg-gray-900/30">
            <tr>
              <th scope="col" className="w-10 px-4 py-3">
                <input
                  ref={headRef}
                  type="checkbox"
                  className={checkCls}
                  checked={allOn}
                  disabled={selectable.length === 0}
                  onChange={() => onToggleAll(allOn ? [] : selectable.map((r) => r.user_id))}
                  aria-label="เลือกทั้งหมด"
                />
              </th>
              <th scope="col" className={cx(thCls, "whitespace-nowrap text-left")}>เจ้าหน้าที่</th>
              {COMPONENTS.map((c) => (
                <th key={c.key} scope="col" className={cx(thCls, "whitespace-nowrap text-right hidden lg:table-cell whitespace-nowrap")}>
                  {c.label}
                  <span className="block font-normal text-gray-400 dark:text-gray-500">≤{c.max}</span>
                </th>
              ))}
              <th scope="col" className={cx(thCls, "whitespace-nowrap text-right")}>คะแนนรวม</th>
              <th scope="col" className={cx(thCls, "whitespace-nowrap text-left")}>ขั้นที่ได้</th>
              <th scope="col" className={cx(thCls, "whitespace-nowrap text-left")}>สิทธิ์</th>
              <th scope="col" className={thCls}><span className="sr-only">การทำงาน</span></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 dark:divide-gray-700/50">
            {loading ? (
              <SkeletonTableRows rows={5} cols={cols} />
            ) : (
              rows.map((ev) => {
                const on = selected.has(ev.user_id)
                const canSel = isSelectable(ev)
                const name = people.nameOf(ev.user_id)
                const title = people.titleOf(ev.user_id)
                const senior = showSenior && people.isSenior(ev.user_id)
                const flagged = ev.eligible === false
                const checkId = `kpi-sel-${ev.user_id}`
                return (
                  <Fragment key={ev.id ?? ev.user_id}>
                    <tr className={cx(on ? "bg-indigo-50/60 dark:bg-indigo-500/10" : "hover:bg-gray-50 dark:hover:bg-gray-700/30", flagged && "border-b-0")}>
                      <td className="px-4 py-3 align-top">
                        <input
                          id={checkId}
                          type="checkbox"
                          className={checkCls}
                          checked={on}
                          disabled={!canSel}
                          onChange={() => onToggle(ev.user_id)}
                          aria-label={`เลือก ${name}`}
                        />
                      </td>
                      <td className="px-4 py-3 align-top min-w-[11rem]">
                        <label htmlFor={checkId} className="font-medium text-gray-900 dark:text-gray-100 cursor-pointer">{name}</label>
                        {title && <p className="text-xs text-gray-500 dark:text-gray-400">{title}</p>}
                        {senior && <Badge tone="pending" className="mt-1">ต้องมีมติคณะกรรมการ</Badge>}
                        <p className="mt-1 text-xs text-gray-500 dark:text-gray-400 tabular-nums lg:hidden">
                          {COMPONENTS.map((c) => `${c.short} ${fmtScore(ev[c.key])}`).join(" / ")}
                        </p>
                      </td>
                      {COMPONENTS.map((c) => (
                        <td key={c.key} className="px-4 py-3 text-right align-top tabular-nums text-gray-700 dark:text-gray-300 hidden lg:table-cell">
                          {fmtScore(ev[c.key])}
                        </td>
                      ))}
                      <td className="px-4 py-3 text-right align-top">
                        <span className="text-base font-bold text-indigo-700 dark:text-indigo-300 tabular-nums">{fmtScore(ev.composite_score)}</span>
                      </td>
                      <td className="px-4 py-3 align-top whitespace-nowrap"><StepCell ev={ev} /></td>
                      <td className="px-4 py-3 align-top min-w-[8.5rem]"><EligibilityBadge ev={ev} /></td>
                      <td className="px-4 py-3 text-right align-top whitespace-nowrap">
                        {hasActions && (
                          <div className="flex flex-col items-end gap-1.5">
                            {canReopen && (
                              <button type="button" className={linkBtn} onClick={() => onReopen(ev)}>ส่งกลับแก้ไข</button>
                            )}
                            {canEligibility && (
                              <button type="button" className={linkBtn} onClick={() => onEligibility(ev)}>แก้สิทธิ์</button>
                            )}
                          </div>
                        )}
                      </td>
                    </tr>
                    {(flagged || (ev.eligibility_overridden && ev.eligibility_note)) && (
                      <tr className={on ? "bg-indigo-50/60 dark:bg-indigo-500/10" : undefined}>
                        <td />
                        <td colSpan={cols - 1} className="px-4 pb-3 pt-0">
                          {flagged && (
                            <p className="flex items-start gap-1.5 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-800 dark:bg-red-900/20 dark:text-red-200">
                              <AlertTriangle aria-hidden="true" className="mt-0.5 size-4 shrink-0" strokeWidth={1.75} />
                              <span>
                                <span className="font-semibold">ไม่มีสิทธิ์เลื่อนขั้น: </span>
                                {ev.ineligible_reasons || (ev.eligibility_overridden ? "กำหนดโดยผู้ตรวจ" : "—")}
                              </span>
                            </p>
                          )}
                          {ev.eligibility_overridden && ev.eligibility_note && (
                            <p className="mt-1 text-xs text-gray-600 dark:text-gray-400">หมายเหตุการแก้สิทธิ์: {ev.eligibility_note}</p>
                          )}
                        </td>
                      </tr>
                    )}
                  </Fragment>
                )
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
