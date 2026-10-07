// src/components/hr/kpi/ManagerApprovePanel.jsx
// Sub-tab "ผจก. อนุมัติ" (roles 1·2): queue = status asst_reviewed. THIS moves salary (effective 1 เม.ย.).
//   POST /hr/kpi/fiscal-years/{fy}/manager-approve { user_ids, comment, board_reference }
//     → { approved: [{user_id, eligible, level_before, level_after, step_pending}], skipped: [{user_id, reason}] }
// ผช.ผจก./ผจก. rows need board_reference and are approved in a separate call.
// No optimistic UI: render from the response, then refetch.
import { useState } from "react"
import { BadgeCheck, Gavel } from "lucide-react"
import { apiAuth } from "../../../lib/api"
import { cx } from "../../../lib/styles"
import { Badge, ConfirmDialog, EmptyState, ErrorState, toast } from "../../ui"
import { cardCls, errText, fmtLevel, inputCls, labelCls, linkBtn, nf, primaryBtn, secondaryBtn, thCls } from "../positionUtils"
import ReviewTable from "./ReviewTable"
import { EligibilityDialog, ReopenDialog } from "./ReviewDialogs"
import { NoteField, SkippedTable } from "./KpiBits"
import { fmtStep, needsBoardRef, num } from "./kpiUtils"
import { useEvaluations } from "./useKpi"

export default function ManagerApprovePanel({ fy, perms, people, onChanged }) {
  const { rows, loading, error, reload } = useEvaluations(fy, "asst_reviewed")
  const [selected, setSelected] = useState(() => new Set())
  const [dialog, setDialog] = useState(null) // reopen | elig
  const [approve, setApprove] = useState(null) // { ids, board: bool }
  const [comment, setComment] = useState("")
  const [boardRef, setBoardRef] = useState("")
  const [touched, setTouched] = useState(false)
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState("")
  const [result, setResult] = useState(null)

  const live = new Set(rows.map((r) => r.user_id))
  const picked = [...selected].filter((id) => live.has(id))
  const pickedRegular = picked.filter((id) => !people.isSenior(id))
  const pickedSenior = picked.filter((id) => people.isSenior(id))

  const toggle = (id) => setSelected((s) => {
    const n = new Set(s)
    if (n.has(id)) n.delete(id)
    else n.add(id)
    return n
  })
  const refresh = () => { reload(); onChanged?.() }

  const open = (ids, board) => {
    setErr("")
    setTouched(false)
    setComment("")
    if (!board) setBoardRef("")
    setApprove({ ids, board })
  }

  const submit = async () => {
    if (!approve) return
    setTouched(true)
    if (approve.board && !boardRef.trim()) return
    setBusy(true)
    setErr("")
    try {
      const res = await apiAuth(`/hr/kpi/fiscal-years/${Number(fy)}/manager-approve`, {
        method: "POST",
        body: {
          user_ids: approve.ids,
          comment: comment.trim() || null,
          board_reference: approve.board ? boardRef.trim() : null,
        },
      })
      const approved = Array.isArray(res?.approved) ? res.approved : []
      const skipped = Array.isArray(res?.skipped) ? res.skipped : []
      setResult({ approved, skipped, board: approve.board })
      setApprove(null)
      setSelected(new Set())
      if (approved.length) {
        toast.success(`อนุมัติแล้ว ${nf(approved.length)} คน`, skipped.length ? { description: `ข้ามไป ${nf(skipped.length)} คน ดูเหตุผลในผลการอนุมัติ` } : undefined)
      } else {
        toast.warning("ไม่มีรายการที่ได้รับอนุมัติ", { description: "ดูเหตุผลในผลการอนุมัติ" })
      }
      refresh()
    } catch (e) {
      setErr(errText(e))
    } finally {
      setBusy(false)
    }
  }

  const boardSkipped = result?.skipped?.filter((s) => needsBoardRef(s.reason)) ?? []
  const closeDialog = () => setDialog(null)
  const afterRow = () => { setDialog(null); refresh() }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-gray-600 dark:text-gray-400">
          รออนุมัติ <span className="font-semibold tabular-nums text-gray-900 dark:text-gray-100">{nf(rows.length)}</span> คน
          การอนุมัติจะปรับขั้นและเงินเดือน มีผล 1 เม.ย.
        </p>
        <div className="flex flex-wrap gap-2">
          {pickedSenior.length > 0 && (
            <button type="button" className={secondaryBtn} onClick={() => open(pickedSenior, true)}>
              <Gavel aria-hidden="true" className="size-4" strokeWidth={2} />
              อนุมัติตามมติคณะกรรมการ ({nf(pickedSenior.length)})
            </button>
          )}
          <button type="button" className={primaryBtn} disabled={pickedRegular.length === 0} onClick={() => open(pickedRegular, false)}>
            <BadgeCheck aria-hidden="true" className="size-4" strokeWidth={2} />
            อนุมัติ{pickedRegular.length ? ` (${nf(pickedRegular.length)})` : ""}
          </button>
        </div>
      </div>

      {result && (
        <ApproveResult
          result={result}
          people={people}
          boardSkipped={boardSkipped}
          onBoardApprove={() => open(boardSkipped.map((s) => s.user_id), true)}
          onDismiss={() => setResult(null)}
        />
      )}

      {error ? (
        <ErrorState message={error} onRetry={reload} />
      ) : !loading && rows.length === 0 ? (
        <div className={cx(cardCls, "p-2")}>
          <EmptyState title="ไม่มีรายการรออนุมัติ" description="รายการจะเข้ามาหลังผู้ช่วยผู้จัดการตรวจสอบแล้ว" />
        </div>
      ) : (
        <ReviewTable
          caption="รายการรอผู้จัดการอนุมัติ"
          rows={rows}
          loading={loading}
          people={people}
          showSenior
          selected={selected}
          onToggle={toggle}
          onToggleAll={(ids) => setSelected(new Set(ids))}
          canReopen={perms.reopen}
          canEligibility={perms.eligibility}
          onReopen={(ev) => setDialog({ kind: "reopen", ev })}
          onEligibility={(ev) => setDialog({ kind: "elig", ev })}
        />
      )}

      <ConfirmDialog
        open={!!approve}
        title={approve?.board ? `อนุมัติตามมติคณะกรรมการ ${nf(approve?.ids.length ?? 0)} คน` : `ยืนยันอนุมัติเลื่อนขั้น ${nf(approve?.ids.length ?? 0)} คน`}
        description="ขั้นและเงินเดือนจะปรับทันที มีผล 1 เม.ย. ผู้ที่ไม่มีสิทธิ์จะได้ 0 ขั้น ส่วน +0.5 ของกลุ่ม 90 คะแนนขึ้นไปจะรอผลประกอบการ"
        confirmLabel={approve?.board ? "อนุมัติพร้อมมติ" : "อนุมัติและปรับเงินเดือน"}
        loading={busy}
        loadingLabel="กำลังอนุมัติ…"
        error={err}
        onConfirm={submit}
        onCancel={() => setApprove(null)}
      >
        <div className="space-y-3">
          {approve?.board && (
            <div>
              <label htmlFor="kpi-board-ref" className={labelCls}>
                เลขที่มติคณะกรรมการ<span className="text-red-600 dark:text-red-400"> *</span>
              </label>
              <input
                id="kpi-board-ref"
                type="text"
                value={boardRef}
                onChange={(e) => setBoardRef(e.target.value)}
                placeholder="เช่น มติ คกก. ชุดที่ 35 ครั้งที่ 10"
                aria-invalid={touched && !boardRef.trim() ? true : undefined}
                className={cx(inputCls, touched && !boardRef.trim() && "border-red-400 dark:border-red-500")}
              />
              {touched && !boardRef.trim() && (
                <p className="mt-1 text-xs font-medium text-red-600 dark:text-red-400">ตำแหน่งผู้ช่วยผู้จัดการ/ผู้จัดการต้องระบุมติคณะกรรมการ</p>
              )}
            </div>
          )}
          {approve && (
            <p className="text-xs text-gray-600 dark:text-gray-400">
              {approve.ids.slice(0, 6).map((id) => people.nameOf(id)).join(", ")}
              {approve.ids.length > 6 ? ` และอีก ${nf(approve.ids.length - 6)} คน` : ""}
            </p>
          )}
          <NoteField label="ความเห็น" required={false} value={comment} onChange={setComment} rows={2} placeholder="ไม่บังคับ" />
        </div>
      </ConfirmDialog>

      {dialog?.kind === "reopen" && (
        <ReopenDialog fy={fy} ev={dialog.ev} name={people.nameOf(dialog.ev.user_id)} onClose={closeDialog} onDone={afterRow} />
      )}
      {dialog?.kind === "elig" && (
        <EligibilityDialog fy={fy} ev={dialog.ev} name={people.nameOf(dialog.ev.user_id)} onClose={closeDialog} onDone={afterRow} />
      )}
    </div>
  )
}

function ApproveResult({ result, people, boardSkipped, onBoardApprove, onDismiss }) {
  const { approved, skipped } = result
  return (
    <section aria-label="ผลการอนุมัติ" aria-live="polite" className={cx(cardCls, "p-4 sm:p-5 space-y-4")}>
      <div className="flex flex-wrap items-start justify-between gap-2">
        <h3 className="font-semibold text-gray-900 dark:text-gray-100">
          ผลการอนุมัติ: อนุมัติ <span className="tabular-nums text-emerald-700 dark:text-emerald-300">{nf(approved.length)}</span> คน
          {skipped.length > 0 && <>, ข้าม <span className="tabular-nums text-amber-700 dark:text-amber-300">{nf(skipped.length)}</span> คน</>}
        </h3>
        <button type="button" className={linkBtn} onClick={onDismiss}>ปิดผลการอนุมัติ</button>
      </div>

      {approved.length === 0 && skipped.length === 0 && (
        <p className="text-sm text-gray-600 dark:text-gray-400">ไม่มีรายการในสถานะรอผู้จัดการอนุมัติ ต้องให้ผู้ช่วยผู้จัดการตรวจสอบก่อน</p>
      )}

      {approved.length > 0 && (
        <div className="overflow-x-auto rounded-xl ring-1 ring-gray-200 dark:ring-gray-700">
          <table className="w-full text-sm">
            <caption className="sr-only">รายการที่อนุมัติแล้ว</caption>
            <thead className="bg-gray-50 dark:bg-gray-900/30">
              <tr>
                <th scope="col" className={cx(thCls, "whitespace-nowrap text-left")}>เจ้าหน้าที่</th>
                <th scope="col" className={cx(thCls, "whitespace-nowrap text-left")}>ขั้นเงินเดือน</th>
                <th scope="col" className={cx(thCls, "whitespace-nowrap text-left")}>รอผลประกอบการ</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-700/50">
              {approved.map((a) => {
                const before = num(a.level_before)
                const after = num(a.level_after)
                const same = before != null && after != null && before === after
                const pend = num(a.step_pending)
                return (
                  <tr key={a.user_id}>
                    <td className="px-4 py-2.5 font-medium text-gray-900 dark:text-gray-100 whitespace-nowrap">
                      {people.nameOf(a.user_id)}
                      {a.eligible === false && <Badge tone="danger" className="ml-2">ไม่มีสิทธิ์</Badge>}
                    </td>
                    <td className="px-4 py-2.5 tabular-nums text-gray-700 dark:text-gray-300 whitespace-nowrap">
                      {fmtLevel(before)} <span aria-hidden="true">→</span><span className="sr-only">เป็น</span>{" "}
                      <span className={same ? "" : "font-semibold text-emerald-700 dark:text-emerald-300"}>{fmtLevel(after)}</span>
                      {same && <span className="ml-1 text-xs text-gray-500 dark:text-gray-400">(ไม่เปลี่ยน)</span>}
                    </td>
                    <td className="px-4 py-2.5 whitespace-nowrap">
                      {pend != null && pend > 0 ? <Badge tone="pending">+{fmtStep(pend)} ขั้น</Badge> : <span className="text-gray-400 dark:text-gray-500">—</span>}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      <SkippedTable
        items={skipped}
        nameOf={people.nameOf}
        title="ข้ามไป"
      />
      {boardSkipped.length > 0 && (
        <button type="button" className={secondaryBtn} onClick={onBoardApprove}>
          <Gavel aria-hidden="true" className="size-4" strokeWidth={2} />
          อนุมัติ {nf(boardSkipped.length)} คนนี้ตามมติคณะกรรมการ
        </button>
      )}
    </section>
  )
}
