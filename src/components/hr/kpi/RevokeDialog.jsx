// src/components/hr/kpi/RevokeDialog.jsx
// ยกเลิกผลอนุมัติ (3L) — POST /hr/kpi/evaluations/{id}/revoke { fiscal_year, comment }  (kpi.override)
//   → { status: "returned", level_restored, salary_restored, note }
// Level + salary go back to their pre-step values and the evaluation returns to
// "ส่งกลับแก้ไข". 409 (not approved / held 0.5 already paid / no snapshot) and 422 shown verbatim.
// After success the sheet switches to a result view that shows the backend `note`
// (payslips already issued are not recalculated) — the user must read it, so it is
// not a toast.
import { useState } from "react"
import { AlertTriangle, CircleCheck } from "lucide-react"
import { Notice } from "../HrModal"
import { apiAuth } from "../../../lib/api"
import { cx, dangerBtnCls, neutralBtnCls, primaryBtnCls } from "../../../lib/styles"
import { Sheet, toast } from "../../ui"
import { errText, fmtLevel, thb } from "../positionUtils"
import { GradeBadge, NoteField, StepCell } from "./KpiBits"
import { fmtScore, num } from "./kpiUtils"

export default function RevokeDialog({ fy, ev, name, onClose, onDone }) {
  const [comment, setComment] = useState("")
  const [touched, setTouched] = useState(false)
  const [saving, setSaving] = useState(false)
  const [err, setErr] = useState("")
  const [result, setResult] = useState(null)
  const empty = !comment.trim()

  const submit = async () => {
    setTouched(true)
    if (empty) return
    setSaving(true)
    setErr("")
    try {
      const res = await apiAuth(`/hr/kpi/evaluations/${Number(ev.user_id)}/revoke`, {
        method: "POST",
        body: { fiscal_year: Number(fy), comment: comment.trim() },
      })
      setResult(res && typeof res === "object" ? res : { status: "returned" })
      toast.success("ยกเลิกผลอนุมัติแล้ว", { description: name })
    } catch (e) {
      setErr(errText(e))
    } finally {
      setSaving(false)
    }
  }

  // the list must refresh whether the user closes via X/Esc or the button
  const close = () => (result ? onDone() : onClose())

  const footer = result ? (
    <div className="grid grid-cols-1 gap-3 md:flex md:justify-end">
      <button type="button" className={cx(primaryBtnCls, "h-12 md:h-auto")} onClick={onDone}>เสร็จสิ้น</button>
    </div>
  ) : (
    <div className="grid grid-cols-2 gap-3 md:flex md:justify-end md:gap-2">
      <button type="button" className={cx(neutralBtnCls, "h-12 md:h-auto")} onClick={onClose} disabled={saving}>ยกเลิก</button>
      <button type="button" className={cx(dangerBtnCls, "h-12 md:h-auto")} onClick={submit} disabled={saving}>
        {saving ? "กำลังยกเลิกผล…" : "ยกเลิกผลอนุมัติ"}
      </button>
    </div>
  )

  return (
    <Sheet open onClose={close} title={result ? "ยกเลิกผลอนุมัติแล้ว" : "ยกเลิกผลอนุมัติ"} subtitle={name} busy={saving} size="md" footer={footer}>
      {result ? (
        <div className="space-y-4" aria-live="polite">
          <p className="flex items-start gap-2 text-sm text-gray-700 dark:text-gray-300">
            <CircleCheck aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-emerald-600 dark:text-emerald-400" strokeWidth={2} />
            รายการกลับไปสถานะ “ส่งกลับแก้ไข” ให้คะแนนใหม่ แล้วสรุปผลและส่งตรวจสอบอีกครั้ง
          </p>
          <dl className="divide-y divide-gray-100 rounded-xl ring-1 ring-gray-200 dark:divide-gray-700/60 dark:ring-gray-700">
            <div className="flex items-baseline justify-between gap-4 px-4 py-2.5 text-sm">
              <dt className="text-gray-600 dark:text-gray-400">ขั้นเงินเดือนคืนเป็น</dt>
              <dd className="font-semibold tabular-nums text-gray-900 dark:text-gray-100">{fmtLevel(num(result.level_restored))}</dd>
            </div>
            <div className="flex items-baseline justify-between gap-4 px-4 py-2.5 text-sm">
              <dt className="text-gray-600 dark:text-gray-400">เงินเดือนคืนเป็น</dt>
              <dd className="font-semibold tabular-nums text-gray-900 dark:text-gray-100">
                {num(result.salary_restored) == null ? "—" : thb(num(result.salary_restored))}
              </dd>
            </div>
          </dl>
          {result.note && <Notice tone="warning" title="สิ่งที่ต้องทำต่อ">{result.note}</Notice>}
        </div>
      ) : (
        <div className="space-y-4">
          <dl className="grid grid-cols-3 gap-3 rounded-xl bg-gray-50 p-3 text-sm dark:bg-gray-900/40">
            <div>
              <dt className="text-xs text-gray-500 dark:text-gray-400">คะแนนรวม</dt>
              <dd className="mt-0.5 font-semibold tabular-nums text-gray-900 dark:text-gray-100">{fmtScore(ev.composite_score)}</dd>
            </div>
            <div>
              <dt className="text-xs text-gray-500 dark:text-gray-400">ระดับผล</dt>
              <dd className="mt-0.5"><GradeBadge grade={ev.grade} label={ev.grade_label} /></dd>
            </div>
            <div>
              <dt className="text-xs text-gray-500 dark:text-gray-400">ขั้นที่ได้</dt>
              <dd className="mt-0.5"><StepCell ev={ev} /></dd>
            </div>
          </dl>
          <p className="flex items-start gap-2 text-sm text-gray-700 dark:text-gray-300">
            <AlertTriangle aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-amber-600 dark:text-amber-400" strokeWidth={2} />
            <span>
              ขั้นและเงินเดือนจะคืนเป็นค่าก่อนเลื่อนขั้น รายการกลับไปสถานะ “ส่งกลับแก้ไข” เพื่อประเมินใหม่
              ทำไม่ได้ถ้าจ่ายเงินตกเบิก +0.5 ขั้นไปแล้ว
            </span>
          </p>
          <NoteField
            label="เหตุผลที่ยกเลิก"
            value={comment}
            onChange={setComment}
            placeholder="เช่น คะแนนผู้จัดการบันทึกผิดคน"
            error={touched && empty ? "กรุณาระบุเหตุผล" : ""}
          />
          {err && <Notice tone="error">{err}</Notice>}
        </div>
      )}
    </Sheet>
  )
}
