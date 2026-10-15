// src/components/hr/ReturnPeriodSheet.jsx
// ผู้จัดการส่งงวดเงินเดือนกลับเป็น "ร่าง" — POST /hr/payroll/periods/{y}/{m}/return { reason } (ต้องระบุเหตุผล)
import { useEffect, useId, useState } from "react"
import { apiAuth } from "../../lib/api"
import { fmtPayMonth } from "../../lib/payroll"
import { cx, baseField, dangerBtnCls, errorTextCls, helpTextCls, labelCls, neutralBtnCls } from "../../lib/styles"
import { Sheet, toast } from "../ui"
import StatusMsg from "./StatusMsg"

const btnCls = "h-12 md:h-10"

/** period = { year, month } (ค.ศ.) | null */
export default function ReturnPeriodSheet({ period, onClose, onDone }) {
  const id = useId()
  const [reason, setReason] = useState("")
  const [touched, setTouched] = useState(false)
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState(null)

  useEffect(() => {
    if (period) { setReason(""); setTouched(false); setMsg(null) }
  }, [period])

  const empty = !reason.trim()
  const label = period ? fmtPayMonth(period.year, period.month, { long: true }) : ""

  const submit = async () => {
    setTouched(true)
    if (empty) return
    setSaving(true)
    setMsg(null)
    try {
      await apiAuth(`/hr/payroll/periods/${period.year}/${period.month}/return`, { method: "POST", body: { reason: reason.trim() } })
      toast.success("ส่งกลับแก้ไขแล้ว", { description: `งวด ${label} กลับเป็นร่าง ฝ่ายบุคคลจะเห็นเหตุผลนี้` })
      onDone?.()
      onClose()
    } catch (err) {
      setMsg({ tone: "error", text: err.message || "ส่งกลับไม่สำเร็จ" })
    } finally {
      setSaving(false)
    }
  }

  return (
    <Sheet
      open={!!period}
      onClose={onClose}
      title="ส่งกลับแก้ไข"
      subtitle={label ? `งวดเงินเดือน ${label}` : undefined}
      size="sm"
      busy={saving}
      footer={
        <div className="grid grid-cols-2 gap-3 md:flex md:justify-end md:gap-2">
          <button type="button" onClick={onClose} disabled={saving} className={cx(neutralBtnCls, btnCls)}>ยกเลิก</button>
          <button type="button" onClick={submit} disabled={saving} className={cx(dangerBtnCls, btnCls)}>
            {saving ? "กำลังส่ง…" : "ส่งกลับแก้ไข"}
          </button>
        </div>
      }
    >
      <div className="space-y-3">
        <p className="text-sm text-gray-600 dark:text-gray-400">
          งวดจะกลับเป็น <span className="font-medium text-gray-900 dark:text-gray-100">ร่าง</span> เพื่อให้ฝ่ายบุคคลแก้ไขแล้วส่งตรวจสอบใหม่
        </p>
        <div>
          <label htmlFor={id} className={cx(labelCls, "md:!text-sm")}>เหตุผลที่ส่งกลับ <span className="text-red-600 dark:text-red-400">*</span></label>
          <textarea
            id={id}
            rows={4}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            onBlur={() => setTouched(true)}
            aria-invalid={touched && empty ? true : undefined}
            aria-describedby={`${id}-hint${touched && empty ? ` ${id}-err` : ""}`}
            placeholder="เช่น ยอดเงินกู้ของนาย ก. ไม่ตรงกับสัญญา"
            className={cx(baseField, "!rounded-lg !px-3 !py-2 md:!text-sm resize-y", touched && empty && "!border-red-500 dark:!border-red-400")}
          />
          <p id={`${id}-hint`} className={cx(helpTextCls, "md:text-xs")}>ฝ่ายบุคคลจะเห็นข้อความนี้บนงวดที่ส่งกลับ</p>
          {touched && empty && <p id={`${id}-err`} className={errorTextCls}>กรอกเหตุผลก่อนส่งกลับ</p>}
        </div>
        {msg && <StatusMsg msg={msg} />}
      </div>
    </Sheet>
  )
}
