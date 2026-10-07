// src/components/hr/kpi/FinalizePanel.jsx
// Sub-tab "สรุปผล" (HR — roles 1·3). Computes composite / step / eligibility; salary does NOT change here.
//   POST /hr/kpi/fiscal-years/{fy}/finalize-all → { finalized: [ids], skipped: [{user_id, reason}] }
//   POST /hr/kpi/evaluations/{id}/finalize?fiscal_year= → { status, composite_score, step_awarded, step_immediate,
//        step_pending, eligible, ineligible_reasons }   (v1.4.0: no `salary_step` anymore)
import { useState } from "react"
import { ListChecks } from "lucide-react"
import { Notice } from "../HrModal"
import { apiAuth } from "../../../lib/api"
import { cx } from "../../../lib/styles"
import { ConfirmDialog, EmptyState, ErrorState, SkeletonTableRows, toast } from "../../ui"
import { cardCls, errText, linkBtn, nf, primaryBtn, thCls } from "../positionUtils"
import { SkippedTable, StatusBadge } from "./KpiBits"
import { COMPONENTS, fmtDay, fmtScore, fmtStep, num, partialTotal } from "./kpiUtils"
import { useEvaluations } from "./useKpi"

export default function FinalizePanel({ fy, info, phase, people, onChanged }) {
  const { rows, loading, error, reload } = useEvaluations(fy)
  const [confirm, setConfirm] = useState(false)
  const [running, setRunning] = useState(false)
  const [runErr, setRunErr] = useState("")
  const [result, setResult] = useState(null)
  const [rowBusy, setRowBusy] = useState(null)
  const [rowErr, setRowErr] = useState({})
  const { nameOf } = people

  const windowOpen = phase === "open" || phase === "before"
  const queue = rows.filter((r) => r.status === "open" || r.status === "returned")

  const refresh = () => { reload(); onChanged?.() }

  const finalizeAll = async () => {
    setRunning(true)
    setRunErr("")
    try {
      const res = await apiAuth(`/hr/kpi/fiscal-years/${Number(fy)}/finalize-all`, { method: "POST" })
      const finalized = Array.isArray(res?.finalized) ? res.finalized : []
      const skipped = Array.isArray(res?.skipped) ? res.skipped : []
      setResult({ finalized, skipped })
      setConfirm(false)
      toast.success(`สรุปผลแล้ว ${nf(finalized.length)} คน`, skipped.length ? { description: `ข้ามไป ${nf(skipped.length)} คน ดูเหตุผลด้านล่าง` } : undefined)
      refresh()
    } catch (e) {
      setRunErr(errText(e))
    } finally {
      setRunning(false)
    }
  }

  const finalizeOne = async (ev) => {
    setRowBusy(ev.user_id)
    setRowErr((m) => ({ ...m, [ev.user_id]: "" }))
    try {
      const res = await apiAuth(`/hr/kpi/evaluations/${ev.user_id}/finalize?fiscal_year=${Number(fy)}`, { method: "POST" })
      const parts = [`คะแนน ${fmtScore(res?.composite_score)}`, `${fmtStep(res?.step_awarded)} ขั้น`]
      if (res?.eligible === false) parts.push("ไม่มีสิทธิ์เลื่อนขั้น")
      toast.success(`สรุปผล ${nameOf(ev.user_id)} แล้ว`, { description: parts.join(", ") })
      refresh()
    } catch (e) {
      setRowErr((m) => ({ ...m, [ev.user_id]: errText(e) }))
    } finally {
      setRowBusy(null)
    }
  }

  return (
    <div className="space-y-4">
      <div className={cx(cardCls, "p-4 sm:p-5")}>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="min-w-0">
            <h3 className="font-semibold text-gray-900 dark:text-gray-100">สรุปผลการประเมินทั้งปี</h3>
            <p className="mt-0.5 text-sm text-gray-600 dark:text-gray-400">
              คำนวณคะแนนรวม ขั้นที่ได้ และสิทธิ์ ของทุกรายการที่คะแนนครบ ยังไม่เปลี่ยนเงินเดือนจนกว่าผู้จัดการอนุมัติ
            </p>
          </div>
          <button
            type="button"
            className={primaryBtn}
            disabled={windowOpen || running || queue.length === 0}
            onClick={() => { setRunErr(""); setConfirm(true) }}
          >
            <ListChecks aria-hidden="true" className="size-4" strokeWidth={2} />
            สรุปผลทั้งหมด
          </button>
        </div>
        {windowOpen && (
          <Notice tone="info" className="mt-3">
            สรุปผลได้หลังสิ้นสุดช่วงประเมิน ({fmtDay(info?.window_end)})
          </Notice>
        )}
      </div>

      {result && (
        <div className={cx(cardCls, "p-4 sm:p-5 space-y-4")} aria-live="polite">
          <p className="text-sm text-gray-700 dark:text-gray-300">
            สรุปผลแล้ว <span className="text-lg font-bold text-emerald-700 dark:text-emerald-300 tabular-nums">{nf(result.finalized.length)}</span> คน
            {result.skipped.length > 0 && <> ข้ามไป <span className="font-semibold text-amber-700 dark:text-amber-300 tabular-nums">{nf(result.skipped.length)}</span> คน แก้คะแนนที่ขาดแล้วสรุปผลอีกครั้ง</>}
          </p>
          <SkippedTable items={result.skipped} nameOf={nameOf} title="ยังสรุปผลไม่ได้" />
        </div>
      )}

      <div>
        <h3 className="mb-2 text-sm font-semibold text-gray-700 dark:text-gray-300">
          รอสรุปผล <span className="tabular-nums">{nf(queue.length)}</span> คน
        </h3>
        {error ? (
          <ErrorState message={error} onRetry={reload} />
        ) : !loading && queue.length === 0 ? (
          <div className={cx(cardCls, "p-2")}>
            <EmptyState title="ไม่มีรายการรอสรุปผล" description="ทุกรายการสรุปผลแล้ว หรือยังไม่มีการประเมินในปีนี้" />
          </div>
        ) : (
          <div className={cx(cardCls, "overflow-hidden")}>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <caption className="sr-only">รายการรอสรุปผล</caption>
                <thead className="border-b border-gray-100 bg-gray-50 dark:border-gray-700 dark:bg-gray-900/30">
                  <tr>
                    <th scope="col" className={cx(thCls, "whitespace-nowrap text-left")}>เจ้าหน้าที่</th>
                    <th scope="col" className={cx(thCls, "whitespace-nowrap text-left hidden sm:table-cell")}>คะแนนที่มี</th>
                    <th scope="col" className={cx(thCls, "whitespace-nowrap text-right")}>รวม</th>
                    <th scope="col" className={thCls}><span className="sr-only">การทำงาน</span></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-gray-700/50">
                  {loading ? (
                    <SkeletonTableRows rows={5} cols={4} />
                  ) : (
                    queue.map((ev) => {
                      const missing = COMPONENTS.filter((c) => num(ev[c.key]) == null)
                      return (
                        <tr key={ev.id ?? ev.user_id} className="hover:bg-gray-50 dark:hover:bg-gray-700/30">
                          <td className="px-4 py-3 align-top">
                            <p className="font-medium text-gray-900 dark:text-gray-100">{nameOf(ev.user_id)}</p>
                            <div className="mt-1"><StatusBadge status={ev.status} /></div>
                            {rowErr[ev.user_id] && (
                              <p role="alert" className="mt-1 text-xs font-medium text-red-600 dark:text-red-400">{rowErr[ev.user_id]}</p>
                            )}
                          </td>
                          <td className="px-4 py-3 align-top text-xs text-gray-600 dark:text-gray-400 hidden sm:table-cell">
                            {missing.length === 0 ? (
                              <span className="text-emerald-700 dark:text-emerald-300">ครบทุกส่วน</span>
                            ) : (
                              <span>ยังขาด: {missing.map((c) => c.label).join(", ")}</span>
                            )}
                          </td>
                          <td className="px-4 py-3 text-right align-top tabular-nums text-gray-700 dark:text-gray-300">{fmtScore(partialTotal(ev))}</td>
                          <td className="px-4 py-3 text-right align-top whitespace-nowrap">
                            <button
                              type="button"
                              className={linkBtn}
                              disabled={windowOpen || rowBusy != null || running}
                              onClick={() => finalizeOne(ev)}
                            >
                              {rowBusy === ev.user_id ? "กำลังสรุป…" : "สรุปผล"}
                            </button>
                          </td>
                        </tr>
                      )
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      <ConfirmDialog
        open={confirm}
        title="สรุปผลการประเมินทั้งหมด"
        description={`สรุปผล ${nf(queue.length)} รายการของปีบัญชี ${fy} รายการที่คะแนนยังไม่ครบจะถูกข้ามและแจ้งเหตุผล`}
        confirmLabel="สรุปผลทั้งหมด"
        loading={running}
        loadingLabel="กำลังสรุปผล…"
        error={runErr}
        onConfirm={finalizeAll}
        onCancel={() => setConfirm(false)}
      />
    </div>
  )
}
