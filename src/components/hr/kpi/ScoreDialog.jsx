// src/components/hr/kpi/ScoreDialog.jsx
// Score entry for one employee.
//   PUT …/{id}/branch-head-score (1·6)  · PUT …/{id}/asst-manager-score (1·2·7)
//   PUT …/{id}/manager-score (1·2)      · PUT …/{id}/board-score (1·2, all three at once)
// Inputs lock outside the window unless status = returned. 409/422 `detail` shown verbatim.
import { useState } from "react"
import HrModal, { Notice } from "../HrModal"
import EmployeePicker from "../EmployeePicker"
import Tabs from "../../ui/Tabs"
import { panelId, tabId } from "../../ui/tabIds"
import { apiAuth } from "../../../lib/api"
import { cx } from "../../../lib/styles"
import { toast } from "../../ui"
import { errText, inputCls, labelCls, primaryBtn, secondaryBtn } from "../positionUtils"
import { StatusBadge } from "./KpiBits"
import { canEditScores, fmtDay, fmtScore, num } from "./kpiUtils"

const FIELDS = [
  { key: "branch_head_score", label: "คะแนนหัวหน้าสาขา", max: 42, path: "branch-head-score", perm: "scoreBranchHead" },
  { key: "asst_manager_score", label: "คะแนนผู้ช่วยผู้จัดการ", max: 20, path: "asst-manager-score", perm: "scoreAsst" },
  { key: "manager_score", label: "คะแนนผู้จัดการ", max: 10, path: "manager-score", perm: "scoreManager" },
]

const toStr = (v) => (num(v) == null ? "" : String(num(v)))

function rangeError(value, max) {
  if (value === "") return ""
  const n = Number(value)
  if (!Number.isFinite(n)) return "กรอกเป็นตัวเลข"
  if (n < 0 || n > max) return `ต้องอยู่ระหว่าง 0–${max}`
  return ""
}

export default function ScoreDialog({ fy, ev, info, phase, perms, nameOf, onClose, onSaved }) {
  const isNew = !ev
  const [empId, setEmpId] = useState(ev ? String(ev.user_id) : "")
  const [mode, setMode] = useState("single")
  const [form, setForm] = useState(() => Object.fromEntries(FIELDS.map((f) => [f.key, toStr(ev?.[f.key])])))
  const [saving, setSaving] = useState(false)
  const [err, setErr] = useState("")

  const status = ev?.status ?? "open"
  const editable = canEditScores({ status }, phase)
  const board = mode === "board" && perms.boardScore
  const visible = board ? FIELDS : FIELDS.filter((f) => perms[f.perm])
  const errors = Object.fromEntries(visible.map((f) => [f.key, rangeError(form[f.key], f.max)]))
  const hasRangeError = Object.values(errors).some(Boolean)
  const changed = visible.filter((f) => form[f.key] !== "" && form[f.key] !== toStr(ev?.[f.key]))
  const boardMissing = board && visible.some((f) => form[f.key] === "")

  const save = async () => {
    if (!empId) { setErr("เลือกเจ้าหน้าที่ก่อน"); return }
    if (hasRangeError) return
    if (boardMissing) { setErr("คะแนนคณะกรรมการต้องกรอกครบทั้ง 3 ส่วน"); return }
    if (!board && changed.length === 0) { setErr("ยังไม่มีคะแนนที่เปลี่ยนแปลง"); return }
    setSaving(true)
    setErr("")
    const base = `/hr/kpi/evaluations/${Number(empId)}`
    const done = []
    try {
      if (board) {
        await apiAuth(`${base}/board-score`, {
          method: "PUT",
          body: {
            fiscal_year: Number(fy),
            branch_head_score: Number(form.branch_head_score),
            asst_manager_score: Number(form.asst_manager_score),
            manager_score: Number(form.manager_score),
          },
        })
      } else {
        for (const f of changed) {
          await apiAuth(`${base}/${f.path}`, {
            method: "PUT",
            body: { fiscal_year: Number(fy), score: Number(form[f.key]) },
          })
          done.push(f.label)
        }
      }
      toast.success("บันทึกคะแนนแล้ว", { description: nameOf(empId) })
      onSaved()
    } catch (e) {
      const msg = errText(e)
      setErr(done.length ? `${msg} (บันทึกแล้ว: ${done.join(", ")})` : msg)
      if (done.length) onSaved({ keepOpen: true })
    } finally {
      setSaving(false)
    }
  }

  return (
    <HrModal
      title="บันทึกคะแนน KPI"
      subtitle={isNew ? `ปีบัญชี ${fy}` : nameOf(ev.user_id)}
      onClose={onClose}
      busy={saving}
      size="md"
      footer={
        <>
          <button type="button" className={cx(secondaryBtn, "flex-1")} onClick={onClose} disabled={saving}>ยกเลิก</button>
          <button type="button" className={cx(primaryBtn, "flex-1")} onClick={save} disabled={saving || !editable || hasRangeError}>
            {saving ? "กำลังบันทึก…" : board ? "บันทึกคะแนนคณะกรรมการ" : "บันทึกคะแนน"}
          </button>
        </>
      }
    >
      {isNew ? (
        <EmployeePicker id="kpi-score-emp" value={empId} onChange={(v) => setEmpId(v)} />
      ) : (
        <div className="flex flex-wrap items-center gap-2 text-sm">
          <StatusBadge status={status} />
          {ev.review_comment && status === "returned" && (
            <span className="text-gray-600 dark:text-gray-400">เหตุที่ส่งกลับ: {ev.review_comment}</span>
          )}
        </div>
      )}

      {!editable && (
        <Notice tone="warning" title="แก้คะแนนไม่ได้ในตอนนี้">
          {status === "open"
            ? `บันทึกคะแนนได้เฉพาะช่วงประเมิน ${fmtDay(info?.window_start)} – ${fmtDay(info?.window_end)} หรือเมื่อรายการถูกส่งกลับแก้ไข`
            : "รายการนี้สรุปผลแล้ว ต้องให้ผู้ช่วยผู้จัดการหรือผู้จัดการส่งกลับแก้ไขก่อน"}
        </Notice>
      )}

      {perms.boardScore && (
        <Tabs
          size="sm"
          idBase="kpi-score-mode"
          ariaLabel="รูปแบบการให้คะแนน"
          value={mode}
          onChange={setMode}
          items={[
            { value: "single", label: "รายส่วน" },
            { value: "board", label: "คณะกรรมการ (ทั้ง 3 ส่วน)" },
          ]}
        />
      )}
      {board && (
        <p className="text-xs text-gray-500 dark:text-gray-400">ใช้กับตำแหน่งอาวุโสที่คณะกรรมการประเมิน บันทึกทั้ง 3 ส่วนพร้อมกัน</p>
      )}

      <div
        className="space-y-3"
        {...(perms.boardScore
          ? { role: "tabpanel", id: panelId("kpi-score-mode", mode), "aria-labelledby": tabId("kpi-score-mode", mode) }
          : {})}
      >
        {visible.map((f) => (
          <div key={f.key}>
            <label htmlFor={`kpi-score-${f.key}`} className={labelCls}>
              {f.label} <span className="text-gray-400 dark:text-gray-500">(0–{f.max})</span>
            </label>
            <input
              id={`kpi-score-${f.key}`}
              type="number"
              inputMode="decimal"
              min="0"
              max={f.max}
              step="0.5"
              value={form[f.key]}
              disabled={!editable || saving}
              onChange={(e) => setForm((s) => ({ ...s, [f.key]: e.target.value }))}
              aria-invalid={errors[f.key] ? true : undefined}
              className={cx(inputCls, "tabular-nums disabled:opacity-60 disabled:cursor-not-allowed", errors[f.key] && "border-red-400 dark:border-red-500")}
            />
            {errors[f.key] && <p className="mt-1 text-xs font-medium text-red-600 dark:text-red-400">{errors[f.key]}</p>}
          </div>
        ))}
        {!isNew && (
          <p className="text-xs text-gray-500 dark:text-gray-400">
            ผลงานสาขา (28): <span className="tabular-nums font-medium text-gray-700 dark:text-gray-300">{fmtScore(ev.branch_score_component)}</span>
            {num(ev.branch_score_component) == null && " — เติมอัตโนมัติจาก KPI สาขาเมื่อบันทึกคะแนนครั้งแรก ต้องบันทึก KPI สาขาก่อน"}
          </p>
        )}
      </div>

      {err && <Notice tone="error">{err}</Notice>}
    </HrModal>
  )
}
