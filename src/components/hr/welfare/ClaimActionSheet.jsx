// src/components/hr/welfare/ClaimActionSheet.jsx
// ─────────────────────────────────────────────────────────────────────────────
// พิจารณาคำขอเบิกสวัสดิการ (3P B4) — 1 sheet ต่อ 1 ขั้น
//   approve  POST /hr/welfare/claims/{id}/approve    {approved_amount?, payroll_month?}   ผจก.
//   reject   POST /hr/welfare/claims/{id}/reject     {reason}                              ผจก.
//   board    POST /hr/welfare/claims/{id}/board      {board_meeting_ref, board_meeting_date} ผจก./HR
//   paid     POST /hr/welfare/claims/{id}/mark-paid  {paid_on}                             HR (จ่ายแยกเท่านั้น)
//
// ยอดอนุมัติเว้นว่าง = ให้ระบบใช้ยอดตามสิทธิ์ ณ ตอนอนุมัติ (backend ตรวจซ้ำ เกิน → 422 "อนุมัติได้ไม่เกิน X บาท")
// detail ภาษาไทยจาก backend แสดงตามที่ส่งมา
// ขั้นที่ผู้ใช้ทำได้ = workflowActions() ใน lib/welfare.js
// ─────────────────────────────────────────────────────────────────────────────
import { useId, useMemo, useRef, useState } from "react"
import { apiAuth } from "../../../lib/api"
import { apiDetail } from "../../../lib/apiErrors"
import { cx, baseField, dangerBtnCls, errorTextCls, helpTextCls, labelCls, neutralBtnCls, primaryBtnCls, submitBtnCls } from "../../../lib/styles"
import { fmtPayMonth } from "../../../lib/payroll"
import { todayIso } from "../../../lib/loans"
import { claimTypeLabel, money, payrollMonthOptions } from "../../../lib/welfare"
import { Sheet, revealFirstInvalid, toast } from "../../ui"
import SelectDropdown from "../../SelectDropdown"
import ThaiDateField from "../../ThaiDateField"
import StatusMsg from "../StatusMsg"

const inputCls = cx(baseField, "!rounded-lg !px-3 !py-2 md:!text-sm")
const btnCls = "h-12 md:h-10 md:!px-5 md:!py-0 md:!text-sm"
const errBorder = "!border-red-500 dark:!border-red-400"

const TITLES = {
  approve: "อนุมัติคำขอเบิก",
  reject: "ไม่อนุมัติคำขอเบิก",
  board: "บันทึกมติคณะกรรมการ",
  paid: "บันทึกการจ่ายเงิน",
}

/**
 * @param {{ claim: object, mode: "approve"|"reject"|"board"|"paid", personName?: string,
 *           payoutRoute?: string, onClose: () => void, onDone: (claim: object) => void }} props
 *   payoutRoute = เส้นทางจ่ายจากการตั้งค่าปัจจุบัน (กำหนดตอนอนุมัติ)
 */
export default function ClaimActionSheet({ claim, mode, personName, payoutRoute = "separate", onClose, onDone }) {
  const uid = useId()
  const [amount, setAmount] = useState("")
  const [payrollMonth, setPayrollMonth] = useState("")
  const [reason, setReason] = useState("")
  const [boardRef, setBoardRef] = useState("")
  const [boardDate, setBoardDate] = useState("")
  const [paidOn, setPaidOn] = useState(todayIso())
  const [errors, setErrors] = useState({})
  const [saving, setSaving] = useState(false)
  const formRef = useRef(null)
  const [msg, setMsg] = useState(null)

  const eligible = Number(claim?.eligible_amount ?? 0)
  const monthOptions = useMemo(() => [
    { value: "", label: "รอบเงินเดือนถัดไปที่ยังเปิดอยู่ (อัตโนมัติ)" },
    ...payrollMonthOptions(6).map((m) => ({ value: m.value, label: fmtPayMonth(m.year, m.month, { long: true }) })),
  ], [])

  const validate = () => {
    const e = {}
    if (mode === "approve" && amount !== "") {
      const v = Number(amount)
      if (!Number.isFinite(v) || v <= 0) e.amount = "กรอกยอดมากกว่า 0 หรือเว้นว่างเพื่อใช้ยอดตามสิทธิ์"
      else if (v > eligible) e.amount = `เกินยอดตามสิทธิ์ ${money(eligible)} บาท — ระบบจะไม่รับ`
    }
    if (mode === "reject" && !reason.trim()) e.reason = "ระบุเหตุผลที่ไม่อนุมัติ — เจ้าหน้าที่จะเห็นข้อความนี้"
    if (mode === "board") {
      if (!boardRef.trim()) e.boardRef = "กรอกเลขที่/ครั้งที่ประชุม"
      if (!boardDate) e.boardDate = "กรอกวันที่ประชุม"
    }
    if (mode === "paid" && !paidOn) e.paidOn = "กรอกวันที่จ่าย"
    return e
  }

  const submit = async () => {
    const e = validate()
    setErrors(e)
    if (Object.keys(e).length) { revealFirstInvalid(formRef); return }
    let path = ""
    let body = {}
    if (mode === "approve") {
      path = "approve"
      if (amount !== "") body.approved_amount = Number(amount)
      if (payoutRoute === "payroll" && payrollMonth) body.payroll_month = payrollMonth
    } else if (mode === "reject") {
      path = "reject"
      body = { reason: reason.trim() }
    } else if (mode === "board") {
      path = "board"
      body = { board_meeting_ref: boardRef.trim(), board_meeting_date: boardDate }
    } else {
      path = "mark-paid"
      body = { paid_on: paidOn }
    }
    setSaving(true)
    setMsg(null)
    try {
      const res = await apiAuth(`/hr/welfare/claims/${claim.id}/${path}`, { method: "POST", body })
      const done = {
        approve: "อนุมัติแล้ว",
        reject: "บันทึกไม่อนุมัติแล้ว",
        board: "บันทึกมติคณะกรรมการแล้ว",
        paid: "บันทึกการจ่ายแล้ว",
      }[mode]
      toast.success(done, { description: [personName, claimTypeLabel(claim), mode === "approve" && res?.approved_amount != null ? `${money(res.approved_amount)} บาท` : null].filter(Boolean).join(" · ") })
      onDone(res && typeof res === "object" ? res : claim)
    } catch (err) {
      setMsg({ tone: "error", text: apiDetail(err) || "ดำเนินการไม่สำเร็จ" })
    } finally {
      setSaving(false)
    }
  }

  const id = (k) => `${uid}-${k}`
  const errP = (k) => errors[k] && <p id={`${id(k)}-err`} className={errorTextCls}>{errors[k]}</p>
  const confirmCls = mode === "reject" ? dangerBtnCls : mode === "approve" || mode === "paid" ? cx(submitBtnCls, "!rounded-xl") : primaryBtnCls
  const confirmLabel = { approve: "อนุมัติ", reject: "ไม่อนุมัติ", board: "บันทึกมติ", paid: "บันทึกจ่ายแล้ว" }[mode]

  return (
    <Sheet
      open
      onClose={onClose}
      title={TITLES[mode]}
      subtitle={[personName, `${claimTypeLabel(claim)} #${claim.id}`].filter(Boolean).join(" · ")}
      size="sm"
      busy={saving}
      footer={
        <div className="grid grid-cols-2 gap-3 md:flex md:justify-end md:gap-2">
          <button type="button" onClick={onClose} disabled={saving} className={cx(neutralBtnCls, btnCls)}>ยกเลิก</button>
          <button type="button" onClick={submit} disabled={saving} className={cx(confirmCls, btnCls)}>
            {saving ? "กำลังบันทึก…" : confirmLabel}
          </button>
        </div>
      }
    >
      <form ref={formRef} className="space-y-4" onSubmit={(e) => { e.preventDefault(); submit() }} noValidate>
        <dl className="grid grid-cols-3 gap-2 rounded-xl bg-gray-50 p-3 text-center dark:bg-white/[.03]">
          <div>
            <dt className="text-xs text-gray-500 dark:text-gray-400">ขอเบิก</dt>
            <dd className="text-sm font-semibold tabular-nums text-gray-900 dark:text-gray-100">{money(claim.requested_amount)}</dd>
          </div>
          <div>
            <dt className="text-xs text-gray-500 dark:text-gray-400">ตามสิทธิ์</dt>
            <dd className="text-sm font-semibold tabular-nums text-gray-900 dark:text-gray-100">{money(claim.eligible_amount)}</dd>
          </div>
          <div>
            <dt className="text-xs text-gray-500 dark:text-gray-400">อนุมัติ</dt>
            <dd className="text-sm font-semibold tabular-nums text-gray-900 dark:text-gray-100">{money(claim.approved_amount)}</dd>
          </div>
        </dl>

        {mode === "approve" && (
          <>
            {eligible <= 0 && (
              <StatusMsg msg={{ tone: "warning", text: "ยอดตามสิทธิ์เป็น 0 (ใช้วงเงินครบแล้ว) — ควรเลือก “ไม่อนุมัติ” แทน" }} />
            )}
            <div>
              <label htmlFor={id("amt")} className={cx(labelCls, "md:!text-sm")}>ยอดอนุมัติ (บาท)</label>
              <input id={id("amt")} type="number" inputMode="decimal" min="0" step="0.01" value={amount}
                onChange={(e) => { setAmount(e.target.value); setErrors((x) => ({ ...x, amount: undefined })) }}
                placeholder={money(eligible)} aria-invalid={errors.amount ? true : undefined}
                aria-describedby={[`${id("amt")}-hint`, errors.amount ? `${id("amount")}-err` : null].filter(Boolean).join(" ")}
                className={cx(inputCls, "tabular-nums", errors.amount && errBorder)} />
              <p id={`${id("amt")}-hint`} className={cx(helpTextCls, "md:text-xs")}>เว้นว่าง = อนุมัติเต็มยอดตามสิทธิ์ ณ ตอนนี้ (ระบบคำนวณซ้ำให้)</p>
              {errP("amount")}
            </div>
            {payoutRoute === "payroll" ? (
              <div>
                <span id={`${id("pm")}-label`} className={cx(labelCls, "md:!text-sm")}>จ่ายพร้อมเงินเดือนเดือน</span>
                <SelectDropdown id={id("pm")} size="sm" showSwatch={false} ariaLabelledby={`${id("pm")}-label`}
                  options={monthOptions} value={payrollMonth} onChange={setPayrollMonth} />
                <p className={cx(helpTextCls, "md:text-xs")}>เข้าสลิปเป็น “เงินช่วยเหลือสวัสดิการ” (ไม่คิดภาษี)</p>
              </div>
            ) : (
              <p className="text-xs text-gray-500 dark:text-gray-400">เส้นทางจ่าย: จ่ายแยก — HR บันทึกวันจ่ายหลังอนุมัติ</p>
            )}
          </>
        )}

        {mode === "reject" && (
          <div>
            <label htmlFor={id("rs")} className={cx(labelCls, "md:!text-sm")}>เหตุผล <span className="text-red-600 dark:text-red-400" aria-hidden="true">*</span></label>
            <textarea id={id("rs")} rows={3} value={reason} required
              onChange={(e) => { setReason(e.target.value); setErrors((x) => ({ ...x, reason: undefined })) }}
              placeholder="เช่น ใช้วงเงินค่ารักษาพยาบาลประจำปีครบแล้ว"
              aria-invalid={errors.reason ? true : undefined} aria-describedby={errors.reason ? `${id("reason")}-err` : undefined}
              className={cx(inputCls, "resize-y", errors.reason && errBorder)} />
            {errP("reason")}
            <p className={cx(helpTextCls, "md:text-xs")}>ไม่อนุมัติแล้ว วงเงินที่กันไว้จะคืนให้ใช้ต่อได้</p>
          </div>
        )}

        {mode === "board" && (
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor={id("bref")} className={cx(labelCls, "md:!text-sm")}>ครั้งที่ / เลขที่ประชุม <span className="text-red-600 dark:text-red-400" aria-hidden="true">*</span></label>
              <input id={id("bref")} value={boardRef} placeholder="เช่น 5/2569"
                onChange={(e) => { setBoardRef(e.target.value); setErrors((x) => ({ ...x, boardRef: undefined })) }}
                aria-invalid={errors.boardRef ? true : undefined} aria-describedby={errors.boardRef ? `${id("boardRef")}-err` : undefined}
                className={cx(inputCls, errors.boardRef && errBorder)} />
              {errP("boardRef")}
            </div>
            <div>
              <label htmlFor={id("bdate")} className={cx(labelCls, "md:!text-sm")}>วันที่ประชุม <span className="text-red-600 dark:text-red-400" aria-hidden="true">*</span></label>
              <ThaiDateField id={id("bdate")} value={boardDate} error={!!errors.boardDate}
                onChange={(e) => { setBoardDate(e.target.value); setErrors((x) => ({ ...x, boardDate: undefined })) }}
                aria-describedby={errors.boardDate ? `${id("boardDate")}-err` : undefined}
                className="!rounded-lg !px-3 !py-2 md:!text-sm" />
              {errP("boardDate")}
            </div>
          </div>
        )}

        {mode === "paid" && (
          <div>
            <label htmlFor={id("paid")} className={cx(labelCls, "md:!text-sm")}>วันที่จ่าย <span className="text-red-600 dark:text-red-400" aria-hidden="true">*</span></label>
            <ThaiDateField id={id("paid")} value={paidOn} error={!!errors.paidOn}
              onChange={(e) => { setPaidOn(e.target.value); setErrors((x) => ({ ...x, paidOn: undefined })) }}
              aria-describedby={errors.paidOn ? `${id("paidOn")}-err` : undefined}
              className="!rounded-lg !px-3 !py-2 md:!text-sm" />
            {errP("paidOn")}
            <p className={cx(helpTextCls, "md:text-xs")}>จ่าย {money(claim.approved_amount)} บาท แยกจากเงินเดือน</p>
          </div>
        )}

        {msg && <StatusMsg msg={msg} />}
        <button type="submit" hidden aria-hidden="true" tabIndex={-1} />
      </form>
    </Sheet>
  )
}
