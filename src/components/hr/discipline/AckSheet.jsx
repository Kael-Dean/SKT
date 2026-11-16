// src/components/hr/discipline/AckSheet.jsx
// ─────────────────────────────────────────────────────────────────────────────
// "บันทึกการรับทราบ" ของหนังสือหนึ่งฉบับ — เมื่อสำเนาที่ลงนามแล้วกลับมา
//   PATCH /hr/discipline/actions/{id}  { acknowledged_on, refused_to_sign, witness_1, witness_2 }  → Action
//   สิทธิ์: ผู้ออกหนังสือ หรือ discipline.record_outcome (HR) — หน้าเว็บใช้ canAckAction() ซ่อนปุ่ม, server ตัดสินจริง
//   422: acknowledged_on เป็นวันในอนาคต
// ─────────────────────────────────────────────────────────────────────────────
import { useId, useState } from "react"
import { apiAuth } from "../../../lib/api"
import { apiDetail } from "../../../lib/apiErrors"
import { nowBangkok, stepLabel } from "../../../lib/discipline"
import { cx, baseField, errorTextCls, neutralBtnCls, primaryBtnCls } from "../../../lib/styles"
import { Sheet, toast } from "../../ui"
import ThaiDateField from "../../ThaiDateField"

const inputCls = cx(baseField, "!rounded-lg !px-3 !py-2 md:!text-sm")
const smallLabel = "mb-1 block text-xs font-medium text-gray-600 dark:text-gray-400"

export function WitnessFields({ uid, w1, w2, onChange, disabled }) {
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      <div className="min-w-0">
        <label htmlFor={`${uid}-w1`} className={smallLabel}>พยานคนที่ 1</label>
        <input id={`${uid}-w1`} value={w1} maxLength={200} disabled={disabled} onChange={(e) => onChange("w1", e.target.value)}
          placeholder="ชื่อ-สกุล" className={inputCls} autoComplete="off" />
      </div>
      <div className="min-w-0">
        <label htmlFor={`${uid}-w2`} className={smallLabel}>พยานคนที่ 2</label>
        <input id={`${uid}-w2`} value={w2} maxLength={200} disabled={disabled} onChange={(e) => onChange("w2", e.target.value)}
          placeholder="ชื่อ-สกุล" className={inputCls} autoComplete="off" />
      </div>
    </div>
  )
}

export function RefusedToggle({ id, checked, onChange, disabled, hint }) {
  return (
    <label htmlFor={id} className="flex cursor-pointer items-start gap-3 rounded-xl border border-gray-300 px-3 py-2.5 has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-indigo-500 dark:border-line-field">
      <input id={id} type="checkbox" checked={checked} disabled={disabled} onChange={(e) => onChange(e.target.checked)} className="mt-1 accent-indigo-600" />
      <span className="text-sm">
        <span className="block font-medium text-gray-900 dark:text-gray-100">ผู้ถูกลงโทษปฏิเสธการลงนาม</span>
        <span className="block text-xs text-gray-500 dark:text-gray-400">{hint || "ให้พยานลงชื่อรับรองว่าได้แจ้งแล้ว"}</span>
      </span>
    </label>
  )
}

export default function AckSheet({ action, onClose, onSaved }) {
  const uid = useId()
  const [date, setDate] = useState(action?.acknowledged_on ?? "")
  const [refused, setRefused] = useState(!!action?.refused_to_sign)
  const [w, setW] = useState({ w1: action?.witness_1 ?? "", w2: action?.witness_2 ?? "" })
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState("")
  const [dateErr, setDateErr] = useState("")
  const today = nowBangkok().date

  const save = async (ev) => {
    ev?.preventDefault()
    if (date && date > today) { setDateErr("วันที่รับทราบต้องไม่เป็นวันในอนาคต"); return }
    if (!refused && !date) { setDateErr("ระบุวันที่รับทราบ หรือเลือกว่าปฏิเสธการลงนาม"); return }
    const body = {
      acknowledged_on: refused ? null : date || null,
      refused_to_sign: refused,
      witness_1: w.w1.trim() || null,
      witness_2: w.w2.trim() || null,
    }
    setBusy(true); setErr("")
    try {
      const res = await apiAuth(`/hr/discipline/actions/${encodeURIComponent(action.id)}`, { method: "PATCH", body })
      toast.success("บันทึกการรับทราบแล้ว", { description: "หนังสือ PDF จะแสดงวันที่และพยานตามนี้" })
      onSaved?.(res)
    } catch (e) {
      setErr(apiDetail(e) || "บันทึกไม่สำเร็จ")
    } finally {
      setBusy(false)
    }
  }

  return (
    <Sheet open onClose={onClose} busy={busy} size="md" title="บันทึกการรับทราบ"
      subtitle={`${stepLabel(action?.step, action?.step_label)}${action?.doc_no ? ` · เลขที่ ${action.doc_no}` : ""}`}
      footer={(
        <div className="grid grid-cols-2 gap-3 md:flex md:justify-end md:gap-2">
          <button type="button" onClick={onClose} disabled={busy} className={neutralBtnCls}>ยกเลิก</button>
          <button type="submit" form={`${uid}-form`} disabled={busy} className={primaryBtnCls}>{busy ? "กำลังบันทึก…" : "บันทึก"}</button>
        </div>
      )}>
      <form id={`${uid}-form`} onSubmit={save} noValidate className="space-y-4">
        <RefusedToggle id={`${uid}-refused`} checked={refused} disabled={busy}
          onChange={(v) => { setRefused(v); setDateErr("") }} />
        {!refused && (
          <div className="max-w-xs">
            <label htmlFor={`${uid}-date`} className={smallLabel}>วันที่ผู้ถูกลงโทษลงนามรับทราบ <span className="text-red-600 dark:text-red-400">*</span></label>
            <ThaiDateField id={`${uid}-date`} ariaLabel="วันที่รับทราบ" value={date} max={today} error={!!dateErr}
              aria-describedby={dateErr ? `${uid}-date-err` : undefined}
              onChange={(e) => { setDate(e.target.value); setDateErr("") }} className="!rounded-lg !px-3 !py-2 md:!text-sm" />
          </div>
        )}
        {dateErr && <p id={`${uid}-date-err`} className={errorTextCls}>{dateErr}</p>}
        <WitnessFields uid={uid} w1={w.w1} w2={w.w2} disabled={busy} onChange={(k, v) => setW((s) => ({ ...s, [k]: v }))} />
        {err && <p role="alert" className={errorTextCls}>{err}</p>}
      </form>
    </Sheet>
  )
}
