// src/pages/hr/tabs/HRPayrollPayoutSheet.jsx
// ─────────────────────────────────────────────────────────────────────────────
// รายละเอียดเงินเดือนหนึ่งคน + ปรับรายการด้วยมือ (เฉพาะงวด "ร่าง")
//   GET   /hr/employees/{user_id}/payroll   ประวัติ (หา record ตาม id — มีบรรทัดครบ รวม add_holiday_pay)
//   PATCH /hr/payroll/{id}                  { reason*, income_tax, add_pending, deduct_loan, deduct_slf, deduct_extra_leave }
//                                           gross/net คำนวณใหม่จากบรรทัด — ไม่ส่ง final_payout
//   งวดที่ไม่ใช่ร่าง → backend ตอบ 409 (หน้าเว็บปิดฟอร์มไว้ก่อน)
// ─────────────────────────────────────────────────────────────────────────────
import { useEffect, useId, useState } from "react"
import { apiAuth } from "../../../lib/api"
import { useCan } from "../../../lib/permissions"
import { EXTRA_LEAVE_LABEL, fmtDateTime, parsePayMonth, fmtPayMonth } from "../../../lib/payroll"
import { cx, baseField, errorTextCls, helpTextCls, labelCls, neutralBtnCls, primaryBtnCls, submitBtnCls } from "../../../lib/styles"
import { Sheet, toast, SkeletonText } from "../../../components/ui"
import PayoutLines from "../../../components/hr/PayoutLines"
import StatusMsg from "../../../components/hr/StatusMsg"

const inputCls = cx(baseField, "!rounded-lg !px-3 !py-2 md:!text-sm tabular-nums")
const btnCls = "h-12 md:h-10"

const ADJUST_FIELDS = [
  { key: "income_tax", label: "ภาษีหัก ณ ที่จ่าย" },
  { key: "add_pending", label: "เงินเพิ่มอื่น ๆ" },
  { key: "deduct_loan", label: "เงินกู้" },
  { key: "deduct_slf", label: "กยศ." },
  { key: "deduct_extra_leave", label: EXTRA_LEAVE_LABEL },
]

const str = (v) => (v == null ? "" : String(Number(v)))
const historyList = (d) => (Array.isArray(d) ? d : Array.isArray(d?.items) ? d.items : [])

/**
 * payout   แถวจาก GET /hr/payroll (id, user_id, employee_name, branch_name, month, net_payout, …)
 * isDraft  งวดของเดือนนี้ยังเป็นร่าง → ปรับรายการได้
 */
export default function HRPayrollPayoutSheet({ payout, isDraft, periodLabel, onClose, onSaved, onDownload, downloading }) {
  const uid = useId()
  const { can } = useCan()
  const canAdjust = can("hr.payroll.adjust")
  const canSlip = can("hr.payroll.payslip")
  const [record, setRecord] = useState(null)
  const [loading, setLoading] = useState(false)
  const [editing, setEditing] = useState(false)
  const [form, setForm] = useState({})
  const [reason, setReason] = useState("")
  const [errors, setErrors] = useState({})
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState(null)

  const load = () => {
    if (!payout) return
    setRecord(payout)
    if (!payout.user_id || !can("hr.payroll.history")) return
    setLoading(true)
    apiAuth(`/hr/employees/${payout.user_id}/payroll`)
      .then((d) => {
        const full = historyList(d).find((r) => String(r.id) === String(payout.id))
        if (full) setRecord({ ...payout, ...full })
      })
      .catch(() => { /* ใช้ข้อมูลจากแถวในตาราง */ })
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    setEditing(false)
    setMsg(null)
    setErrors({})
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps -- โหลดใหม่เมื่อเปลี่ยนรายการเท่านั้น
  }, [payout?.id])

  const startEdit = () => {
    setForm(Object.fromEntries(ADJUST_FIELDS.map((f) => [f.key, str(record?.[f.key] ?? 0)])))
    setReason("")
    setErrors({})
    setMsg(null)
    setEditing(true)
  }

  const save = async () => {
    const errs = {}
    const body = {}
    for (const f of ADJUST_FIELDS) {
      const v = (form[f.key] ?? "").trim()
      const n = Number(v === "" ? 0 : v)
      if (!Number.isFinite(n) || n < 0) { errs[f.key] = "กรอกตัวเลขตั้งแต่ 0 ขึ้นไป"; continue }
      if (n !== Number(record?.[f.key] ?? 0)) body[f.key] = n
    }
    if (!reason.trim()) errs.reason = "ระบุเหตุผลของการปรับรายการ"
    setErrors(errs)
    if (Object.keys(errs).length) return
    if (Object.keys(body).length === 0) {
      setMsg({ tone: "warning", text: "ยังไม่ได้เปลี่ยนตัวเลขช่องใด" })
      return
    }
    body.reason = reason.trim()
    setSaving(true)
    setMsg(null)
    try {
      await apiAuth(`/hr/payroll/${payout.id}`, { method: "PATCH", body })
      toast.success("ปรับรายการเงินเดือนแล้ว", { description: payout.employee_name })
      setEditing(false)
      load()
      onSaved?.()
    } catch (err) {
      setMsg({ tone: "error", text: err.message || "บันทึกไม่สำเร็จ" })
    } finally {
      setSaving(false)
    }
  }

  const pm = parsePayMonth(payout?.month)
  const subtitle = [payout?.branch_name, pm ? fmtPayMonth(pm.year, pm.month, { long: true }) : null].filter(Boolean).join(" · ")

  const footer = editing ? (
    <div className="grid grid-cols-2 gap-3 md:flex md:justify-end md:gap-2">
      <button type="button" onClick={() => setEditing(false)} disabled={saving} className={cx(neutralBtnCls, btnCls)}>ยกเลิก</button>
      <button type="button" onClick={save} disabled={saving} className={cx(submitBtnCls, btnCls, "!rounded-xl !px-4 !py-0 md:!text-sm")}>
        {saving ? "กำลังบันทึก…" : "บันทึกการปรับ"}
      </button>
    </div>
  ) : (
    <div className="grid grid-cols-2 gap-3 md:flex md:justify-end md:gap-2">
      {canSlip ? (
        <button type="button" onClick={() => onDownload(payout.id)} disabled={downloading} className={cx(neutralBtnCls, btnCls)}>
          {downloading ? "กำลังโหลด…" : "สลิป PDF"}
        </button>
      ) : <span className="md:hidden" />}
      {canAdjust && isDraft ? (
        <button type="button" onClick={startEdit} disabled={loading} className={cx(primaryBtnCls, btnCls)}>ปรับรายการ</button>
      ) : (
        <button type="button" onClick={onClose} className={cx(neutralBtnCls, btnCls)}>ปิด</button>
      )}
    </div>
  )

  return (
    <Sheet
      open={!!payout}
      onClose={onClose}
      title={payout?.employee_name || "รายละเอียดเงินเดือน"}
      subtitle={subtitle || undefined}
      size="lg"
      busy={saving}
      footer={footer}
    >
      {loading && !record?.base_salary ? (
        <SkeletonText lines={6} />
      ) : editing ? (
        <form className="space-y-4" noValidate onSubmit={(e) => { e.preventDefault(); save() }}>
          <p className="text-sm text-gray-600 dark:text-gray-400">
            รายได้รวมและยอดสุทธิจะคำนวณใหม่จากบรรทัดที่แก้ · บันทึกเหตุผลไว้ในประวัติการใช้งาน
          </p>
          <div className="grid gap-3 sm:grid-cols-2">
            {ADJUST_FIELDS.map((f) => {
              const id = `${uid}-${f.key}`
              return (
                <div key={f.key}>
                  <label htmlFor={id} className={cx(labelCls, "md:!text-sm")}>{f.label} (บาท)</label>
                  <input
                    id={id}
                    type="number"
                    inputMode="decimal"
                    min="0"
                    step="0.01"
                    value={form[f.key] ?? ""}
                    onChange={(e) => setForm((p) => ({ ...p, [f.key]: e.target.value }))}
                    aria-invalid={errors[f.key] ? true : undefined}
                    aria-describedby={errors[f.key] ? `${id}-err` : undefined}
                    className={cx(inputCls, errors[f.key] && "!border-red-500 dark:!border-red-400")}
                  />
                  {errors[f.key] && <p id={`${id}-err`} className={errorTextCls}>{errors[f.key]}</p>}
                </div>
              )
            })}
          </div>
          <div>
            <label htmlFor={`${uid}-reason`} className={cx(labelCls, "md:!text-sm")}>เหตุผล <span className="text-red-600 dark:text-red-400">*</span></label>
            <input
              id={`${uid}-reason`}
              type="text"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="เช่น แก้ภาษีตามหนังสือ ล.ย.01"
              aria-invalid={errors.reason ? true : undefined}
              aria-describedby={errors.reason ? `${uid}-reason-err` : `${uid}-reason-hint`}
              className={cx(inputCls, errors.reason && "!border-red-500 dark:!border-red-400")}
            />
            {errors.reason
              ? <p id={`${uid}-reason-err`} className={errorTextCls}>{errors.reason}</p>
              : <p id={`${uid}-reason-hint`} className={cx(helpTextCls, "md:text-xs")}>ถ้ากด "คำนวณใหม่" ทั้งงวด การปรับด้วยมือนี้จะถูกเขียนทับ</p>}
          </div>
          {msg && <StatusMsg msg={msg} />}
          <button type="submit" hidden aria-hidden="true" tabIndex={-1} />
        </form>
      ) : (
        <div className="space-y-4">
          <PayoutLines record={record} />
          {canAdjust && !isDraft && (
            <p className="text-sm text-gray-600 dark:text-gray-400">
              งวดนี้อยู่ในขั้น <span className="font-medium text-gray-900 dark:text-gray-100">{periodLabel}</span> — ปรับรายการได้เฉพาะงวดที่เป็นร่าง
            </p>
          )}
          {record?.processed_at && (
            <p className="text-xs text-gray-500 dark:text-gray-400">คำนวณเมื่อ {fmtDateTime(record.processed_at)}</p>
          )}
          {msg && <StatusMsg msg={msg} />}
        </div>
      )}
    </Sheet>
  )
}

