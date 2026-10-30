// src/components/hr/GuaranteeBankEditSheet.jsx
// ─────────────────────────────────────────────────────────────────────────────
// HR แก้เลขบัญชีค้ำประกันของเจ้าหน้าที่ — PATCH /hr/employees/{id}/personal { guarantee_bank_no }
//   ไม่บังคับกรอก · เว้นว่าง = ล้างค่า (ส่ง "" ตาม contract ของ backend)
// ─────────────────────────────────────────────────────────────────────────────
import { useEffect, useId, useState } from "react"
import { apiAuth } from "../../lib/api"
import { cx, baseField, helpTextCls, labelCls, neutralBtnCls } from "../../lib/styles"
import { SaveButton, SHEET_SAVED_MS, Sheet, toast, useSaveStatus } from "../ui"
import StatusMsg from "./StatusMsg"

const inputCls = cx(baseField, "!rounded-lg !px-3 !py-2 md:!text-sm tabular-nums")
const btnCls = "h-12 md:h-10 md:!px-5 md:!py-0 md:!text-sm"

/**
 * @param {{ open: boolean, employeeId: number|string, employeeName?: string, value?: string|null,
 *           onClose: () => void, onSaved?: () => void }} props
 */
export default function GuaranteeBankEditSheet({ open, employeeId, employeeName, value, onClose, onSaved }) {
  const uid = useId()
  const [form, setForm] = useState(value ?? "")
  const [msg, setMsg] = useState(null)
  const saveState = useSaveStatus()
  const saving = saveState.saving

  useEffect(() => {
    if (!open) return
    setForm(value ?? "")
    setMsg(null)
    // eslint-disable-next-line react-hooks/exhaustive-deps -- เติมค่าเฉพาะตอนเปิด
  }, [open])

  const save = async () => {
    saveState.start()
    setMsg(null)
    try {
      await apiAuth(`/hr/employees/${employeeId}/personal`, { method: "PATCH", body: { guarantee_bank_no: form.trim() } })
      toast.success("บันทึกเลขบัญชีค้ำประกันแล้ว", { description: employeeName || undefined })
      saveState.succeed(() => { onSaved?.(); onClose() }, SHEET_SAVED_MS)
    } catch (err) {
      saveState.fail()
      setMsg({ tone: "error", text: err.message || "บันทึกไม่สำเร็จ" })
    }
  }

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title="แก้ไขเลขบัญชีค้ำประกัน"
      subtitle={employeeName}
      size="sm"
      busy={saving}
      footer={
        <div className="grid grid-cols-2 gap-3 md:flex md:justify-end md:gap-2">
          <button type="button" onClick={onClose} disabled={saving} className={cx(neutralBtnCls, btnCls)}>ยกเลิก</button>
          <SaveButton status={saveState.status} onClick={save} className={cx(btnCls, "!rounded-xl")}>บันทึก</SaveButton>
        </div>
      }
    >
      <form className="space-y-4" onSubmit={(e) => { e.preventDefault(); save() }} noValidate>
        <div>
          <label htmlFor={`${uid}-gbn`} className={cx(labelCls, "md:!text-sm")}>เลขบัญชีค้ำประกัน</label>
          <input
            id={`${uid}-gbn`}
            type="text"
            inputMode="numeric"
            autoComplete="off"
            value={form}
            onChange={(e) => setForm(e.target.value)}
            aria-describedby={`${uid}-gbn-hint`}
            className={inputCls}
          />
          <p id={`${uid}-gbn-hint`} className={cx(helpTextCls, "md:text-xs")}>ไม่บังคับ — เว้นว่างแล้วบันทึกเพื่อล้างค่า</p>
        </div>
        {msg && <StatusMsg msg={msg} />}
        <button type="submit" hidden aria-hidden="true" tabIndex={-1} />
      </form>
    </Sheet>
  )
}
