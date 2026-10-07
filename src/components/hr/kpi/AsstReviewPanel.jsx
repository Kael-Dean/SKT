// src/components/hr/kpi/AsstReviewPanel.jsx
// Sub-tab "ผช.ผจก. ตรวจสอบ" (roles 1·7): queue = status finalized.
//   POST /hr/kpi/fiscal-years/{fy}/asst-review { user_ids, comment } → { reviewed: [ids] }
// Row actions: reopen + eligibility override (ReviewDialogs). Salary does not change here.
import { useState } from "react"
import { CheckCheck } from "lucide-react"
import { apiAuth } from "../../../lib/api"
import { cx } from "../../../lib/styles"
import { ConfirmDialog, EmptyState, ErrorState, toast } from "../../ui"
import { cardCls, errText, nf, primaryBtn } from "../positionUtils"
import ReviewTable from "./ReviewTable"
import { EligibilityDialog, ReopenDialog } from "./ReviewDialogs"
import { NoteField } from "./KpiBits"
import { useEvaluations } from "./useKpi"

export default function AsstReviewPanel({ fy, perms, people, onChanged }) {
  const { rows, loading, error, reload } = useEvaluations(fy, "finalized")
  const [selected, setSelected] = useState(() => new Set())
  const [dialog, setDialog] = useState(null) // { kind: "reopen"|"elig", ev }
  const [confirm, setConfirm] = useState(false)
  const [comment, setComment] = useState("")
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState("")

  const live = new Set(rows.map((r) => r.user_id))
  const picked = [...selected].filter((id) => live.has(id))
  const ineligiblePicked = rows.filter((r) => selected.has(r.user_id) && r.eligible === false).length

  const toggle = (id) => setSelected((s) => {
    const n = new Set(s)
    if (n.has(id)) n.delete(id)
    else n.add(id)
    return n
  })
  const refresh = () => { reload(); onChanged?.() }

  const submit = async () => {
    setBusy(true)
    setErr("")
    try {
      const res = await apiAuth(`/hr/kpi/fiscal-years/${Number(fy)}/asst-review`, {
        method: "POST",
        body: { user_ids: picked, comment: comment.trim() || null },
      })
      const reviewed = Array.isArray(res?.reviewed) ? res.reviewed : []
      const missed = picked.length - reviewed.length
      toast.success(`ตรวจสอบแล้ว ${nf(reviewed.length)} คน`, {
        description: missed > 0 ? `${nf(missed)} คนไม่ได้อยู่ในสถานะรอตรวจสอบแล้ว จึงไม่ถูกบันทึก` : "ส่งต่อให้ผู้จัดการอนุมัติ",
      })
      setConfirm(false)
      setSelected(new Set())
      setComment("")
      refresh()
    } catch (e) {
      setErr(errText(e))
    } finally {
      setBusy(false)
    }
  }

  const closeDialog = () => setDialog(null)
  const afterRow = () => { setDialog(null); refresh() }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-gray-600 dark:text-gray-400">
          รอตรวจสอบ <span className="font-semibold tabular-nums text-gray-900 dark:text-gray-100">{nf(rows.length)}</span> คน
          ตรวจคะแนน ขั้น และสิทธิ์ แล้วส่งต่อให้ผู้จัดการอนุมัติ
        </p>
        <button
          type="button"
          className={primaryBtn}
          disabled={picked.length === 0}
          onClick={() => { setErr(""); setConfirm(true) }}
        >
          <CheckCheck aria-hidden="true" className="size-4" strokeWidth={2} />
          ตรวจสอบแล้ว{picked.length ? ` (${nf(picked.length)})` : ""}
        </button>
      </div>

      {error ? (
        <ErrorState message={error} onRetry={reload} />
      ) : !loading && rows.length === 0 ? (
        <div className={cx(cardCls, "p-2")}>
          <EmptyState title="ไม่มีรายการรอตรวจสอบ" description="รายการจะเข้ามาหลังฝ่ายบุคคลสรุปผลการประเมิน" />
        </div>
      ) : (
        <ReviewTable
          caption="รายการรอผู้ช่วยผู้จัดการตรวจสอบ"
          rows={rows}
          loading={loading}
          people={people}
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
        open={confirm}
        title={`ยืนยันตรวจสอบแล้ว ${nf(picked.length)} คน`}
        description="รายการจะส่งต่อให้ผู้จัดการอนุมัติ เงินเดือนยังไม่เปลี่ยนในขั้นนี้"
        confirmLabel="ตรวจสอบแล้ว"
        loading={busy}
        error={err}
        onConfirm={submit}
        onCancel={() => setConfirm(false)}
      >
        {ineligiblePicked > 0 && (
          <p className="mb-3 rounded-lg bg-amber-50 px-3 py-2 text-amber-800 dark:bg-amber-900/20 dark:text-amber-200">
            ในจำนวนนี้มี {nf(ineligiblePicked)} คนที่ไม่มีสิทธิ์เลื่อนขั้น จะได้ 0 ขั้นเมื่ออนุมัติ
          </p>
        )}
        <NoteField label="ความเห็น" required={false} value={comment} onChange={setComment} rows={2} placeholder="ไม่บังคับ" />
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
