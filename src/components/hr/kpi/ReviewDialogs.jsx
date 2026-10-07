// src/components/hr/kpi/ReviewDialogs.jsx
// Row actions on the review screens (roles 1·2·7):
//   POST  /hr/kpi/evaluations/{id}/reopen       { fiscal_year, comment }  (comment required)
//   PATCH /hr/kpi/evaluations/{id}/eligibility  { fiscal_year, eligible, note } (note required)
import { useState } from "react"
import HrModal, { Notice } from "../HrModal"
import { apiAuth } from "../../../lib/api"
import { cx } from "../../../lib/styles"
import { toast } from "../../ui"
import { dangerBtn, errText, primaryBtn, secondaryBtn } from "../positionUtils"
import { EligibilityBadge, NoteField } from "./KpiBits"
import { fmtScore, fmtStep } from "./kpiUtils"

export function ReopenDialog({ fy, ev, name, onClose, onDone }) {
  const [comment, setComment] = useState("")
  const [touched, setTouched] = useState(false)
  const [saving, setSaving] = useState(false)
  const [err, setErr] = useState("")
  const empty = !comment.trim()

  const submit = async () => {
    setTouched(true)
    if (empty) return
    setSaving(true)
    setErr("")
    try {
      await apiAuth(`/hr/kpi/evaluations/${ev.user_id}/reopen`, {
        method: "POST",
        body: { fiscal_year: Number(fy), comment: comment.trim() },
      })
      toast.success("ส่งกลับแก้ไขแล้ว", { description: `${name} แก้คะแนนได้แม้อยู่นอกช่วงประเมิน แล้วต้องสรุปผลและตรวจสอบใหม่` })
      onDone()
    } catch (e) {
      setErr(errText(e))
    } finally {
      setSaving(false)
    }
  }

  return (
    <HrModal
      title="ส่งกลับแก้ไข"
      subtitle={name}
      onClose={onClose}
      busy={saving}
      footer={
        <>
          <button type="button" className={cx(secondaryBtn, "flex-1")} onClick={onClose} disabled={saving}>ยกเลิก</button>
          <button type="button" className={cx(dangerBtn, "flex-1")} onClick={submit} disabled={saving}>
            {saving ? "กำลังส่งกลับ…" : "ส่งกลับแก้ไข"}
          </button>
        </>
      }
    >
      <p className="text-sm text-gray-600 dark:text-gray-400">
        คะแนนรวม {fmtScore(ev.composite_score)} ({fmtStep(ev.step_awarded)} ขั้น) จะกลับไปสถานะ “ส่งกลับแก้ไข” ผลการตรวจสอบของผู้ช่วยผู้จัดการจะถูกล้าง
      </p>
      <NoteField
        label="เหตุผลที่ส่งกลับ"
        value={comment}
        onChange={setComment}
        placeholder="เช่น คะแนนหัวหน้าสาขาผิด"
        error={touched && empty ? "กรุณาระบุเหตุผล" : ""}
      />
      {err && <Notice tone="error">{err}</Notice>}
    </HrModal>
  )
}

export function EligibilityDialog({ fy, ev, name, onClose, onDone }) {
  const [eligible, setEligible] = useState(ev.eligible === false)
  const [note, setNote] = useState("")
  const [touched, setTouched] = useState(false)
  const [saving, setSaving] = useState(false)
  const [err, setErr] = useState("")
  const empty = !note.trim()

  const submit = async () => {
    setTouched(true)
    if (empty) return
    setSaving(true)
    setErr("")
    try {
      await apiAuth(`/hr/kpi/evaluations/${ev.user_id}/eligibility`, {
        method: "PATCH",
        body: { fiscal_year: Number(fy), eligible, note: note.trim() },
      })
      toast.success(eligible ? "กำหนดให้มีสิทธิ์เลื่อนขั้นแล้ว" : "กำหนดให้ไม่มีสิทธิ์เลื่อนขั้นแล้ว", { description: name })
      onDone()
    } catch (e) {
      setErr(errText(e))
    } finally {
      setSaving(false)
    }
  }

  const choice = (value, label, help) => (
    <label
      className={cx(
        "flex cursor-pointer items-start gap-3 rounded-xl border px-3.5 py-3 transition-colors duration-200",
        eligible === value
          ? "border-indigo-400 bg-indigo-50 dark:border-indigo-500 dark:bg-indigo-500/10"
          : "border-gray-200 hover:bg-gray-50 dark:border-gray-700 dark:hover:bg-gray-700/40"
      )}
    >
      <input
        type="radio"
        name="kpi-eligible"
        checked={eligible === value}
        onChange={() => setEligible(value)}
        className="mt-1 accent-indigo-600"
      />
      <span>
        <span className="block text-sm font-semibold text-gray-900 dark:text-gray-100">{label}</span>
        <span className="block text-xs text-gray-600 dark:text-gray-400">{help}</span>
      </span>
    </label>
  )

  return (
    <HrModal
      title="แก้สิทธิ์เลื่อนขั้น"
      subtitle={name}
      onClose={onClose}
      busy={saving}
      size="md"
      footer={
        <>
          <button type="button" className={cx(secondaryBtn, "flex-1")} onClick={onClose} disabled={saving}>ยกเลิก</button>
          <button type="button" className={cx(primaryBtn, "flex-1")} onClick={submit} disabled={saving}>
            {saving ? "กำลังบันทึก…" : "บันทึกสิทธิ์"}
          </button>
        </>
      }
    >
      <div className="flex flex-wrap items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
        สถานะปัจจุบัน <EligibilityBadge ev={ev} />
      </div>
      {ev.ineligible_reasons && (
        <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-800 dark:bg-red-900/20 dark:text-red-200">
          ระบบตรวจพบ: {ev.ineligible_reasons}
        </p>
      )}
      <fieldset className="space-y-2">
        <legend className="sr-only">สิทธิ์เลื่อนขั้น</legend>
        {choice(true, "มีสิทธิ์เลื่อนขั้น", "เช่น ลาป่วยต่อเนื่องไม่เกิน 60 วัน หรือป่วยจากการทำงาน หรือระบบตั้งค่าผิด")}
        {choice(false, "ไม่มีสิทธิ์เลื่อนขั้น", "เช่น ถูกลงโทษทางวินัยสูงกว่าภาคทัณฑ์")}
      </fieldset>
      <NoteField
        label="เหตุผล"
        value={note}
        onChange={setNote}
        placeholder="ระบุเหตุผลประกอบการแก้สิทธิ์"
        hint="ค่าที่แก้จะคงอยู่แม้สรุปผลใหม่"
        error={touched && empty ? "กรุณาระบุเหตุผล" : ""}
      />
      {err && <Notice tone="error">{err}</Notice>}
    </HrModal>
  )
}
