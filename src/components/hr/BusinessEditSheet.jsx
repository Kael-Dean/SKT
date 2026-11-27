// src/components/hr/BusinessEditSheet.jsx
// ─────────────────────────────────────────────────────────────────────────────
// HR ตั้ง "ธุรกิจ" ของเจ้าหน้าที่ — PATCH /hr/employees/{id}/personal { hr_business_id } (handoff PR #117)
//   "ไม่ระบุ" = ส่ง null (ล้างค่า) · ไม่ได้เปลี่ยน = ไม่ส่ง key (ปิด sheet ไปเฉย ๆ)
//   ค่าปัจจุบันที่เป็นธุรกิจปิดใช้งาน (ไม่อยู่ในรายการ active) ยังแสดงชื่อเดิมเป็นตัวเลือก
//   422 "ไม่พบธุรกิจนี้ … หรือปิดใช้งานแล้ว" → แสดงใต้ช่อง
// ─────────────────────────────────────────────────────────────────────────────
import { useEffect, useId, useMemo, useState } from "react"
import { apiAuth } from "../../lib/api"
import { cx, helpTextCls, labelCls, neutralBtnCls } from "../../lib/styles"
import { SaveButton, SHEET_SAVED_MS, Sheet, toast, useSaveStatus } from "../ui"
import SelectDropdown from "../SelectDropdown"
import StatusMsg from "./StatusMsg"

const btnCls = "h-12 md:pointer-fine:h-10 md:!px-5 md:!py-0 md:!text-sm"
const NONE = "" // "ไม่ระบุ"

/**
 * ตัวเลือกธุรกิจ: "ไม่ระบุ" + รายการ active + (ถ้าค่าปัจจุบันไม่อยู่ในรายการ) ชื่อเดิมของพนักงาน
 * @param {{ value: string, label: string }[]} options
 * @param {number|string|null|undefined} currentId
 * @param {string|null|undefined} currentName
 */
function businessSelectOptions(options, currentId, currentName) {
  const list = [{ value: NONE, label: "ไม่ระบุ" }, ...(options || [])]
  const cur = currentId == null ? "" : String(currentId)
  if (cur && !list.some((o) => o.value === cur)) {
    list.push({ value: cur, label: `${currentName || `ธุรกิจ #${cur}`} (ปิดใช้งาน)` })
  }
  return list
}

/**
 * @param {{ open: boolean, employeeId: number|string, employeeName?: string,
 *           currentId?: number|null, currentName?: string|null,
 *           options: { value: string, label: string }[],
 *           onClose: () => void, onSaved?: () => void }} props
 */
export default function BusinessEditSheet({ open, employeeId, employeeName, currentId, currentName, options, onClose, onSaved }) {
  const uid = useId()
  const initial = currentId == null ? NONE : String(currentId)
  const [value, setValue] = useState(initial)
  const [msg, setMsg] = useState(null)
  const saveState = useSaveStatus()
  const saving = saveState.saving

  useEffect(() => {
    if (!open) return
    setValue(initial)
    setMsg(null)
    // eslint-disable-next-line react-hooks/exhaustive-deps -- เติมค่าเฉพาะตอนเปิด
  }, [open])

  const selectOptions = useMemo(
    () => businessSelectOptions(options, currentId, currentName),
    [options, currentId, currentName],
  )

  const save = async () => {
    if (value === initial) { onClose(); return } // ไม่เปลี่ยน = ไม่ต้องส่ง
    saveState.start()
    setMsg(null)
    try {
      await apiAuth(`/hr/employees/${employeeId}/personal`, {
        method: "PATCH",
        body: { hr_business_id: value === NONE ? null : Number(value) },
      })
      toast.success("บันทึกธุรกิจแล้ว", { description: employeeName || undefined })
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
      title="แก้ไขธุรกิจ"
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
        <div className="min-w-0">
          <label htmlFor={`${uid}-biz`} className={cx(labelCls, "md:!text-sm")}>ธุรกิจ</label>
          <SelectDropdown
            id={`${uid}-biz`}
            size="sm"
            value={value}
            onChange={(v) => { setValue(v); setMsg(null) }}
            options={selectOptions}
            showSwatch={false}
            ariaLabel="ธุรกิจ"
            ariaDescribedby={`${uid}-biz-hint`}
            disabled={saving}
          />
          <p id={`${uid}-biz-hint`} className={cx(helpTextCls, "md:text-xs")}>
            ใช้แยกยอดในรายงาน HR ตามธุรกิจ · เลือก "ไม่ระบุ" เพื่อล้างค่า
          </p>
        </div>
        {msg && <StatusMsg msg={msg} />}
        <button type="submit" hidden aria-hidden="true" tabIndex={-1} />
      </form>
    </Sheet>
  )
}
