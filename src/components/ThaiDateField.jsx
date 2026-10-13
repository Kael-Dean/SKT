// src/components/ThaiDateField.jsx
// ─────────────────────────────────────────────────────────────────────────────
// ช่องวันที่แบบไทย (วัน เดือน พ.ศ.) — แทน <input type="date"> ที่แสดง MM/DD/ค.ศ. ตามเครื่อง
// ให้รูปแบบตรงกับตาราง (handoff F25). API เหมือน input เดิมเพื่อเปลี่ยนแทนกันได้ทันที:
//
//   <DateInput id="x" ref={dateRef} value="2026-10-14" error={!!err}
//              onChange={(e) => set(e.target.value)} onKeyDown={…} />
//
// value / e.target.value = ISO "YYYY-MM-DD" (ค.ศ.) เหมือนเดิม — payload ไม่เปลี่ยน
// ref → ปุ่มเปิดปฏิทิน (focus() ได้) · className เพิ่มต่อจาก baseField
// ─────────────────────────────────────────────────────────────────────────────
import { forwardRef } from "react"
import ThaiDatePicker from "./ThaiDatePicker"
import { baseField, cx } from "../lib/styles"

const ThaiDateField = forwardRef(function ThaiDateField(
  {
    value = "",
    onChange,
    onKeyDown,
    onFocus,
    error = false,
    className = "",
    id,
    disabled = false,
    placeholder,
    "aria-label": ariaLabelAttr,
    ariaLabel,
    "aria-describedby": ariaDescribedBy,
  },
  ref,
) {
  const iso = value ? String(value).slice(0, 10) : ""
  return (
    <ThaiDatePicker
      ref={ref}
      id={id}
      value={iso}
      onChange={(v) => onChange?.({ target: { value: v || "" }, currentTarget: { value: v || "" } })}
      onKeyDown={onKeyDown}
      onFocus={onFocus}
      error={error}
      disabled={disabled}
      placeholder={placeholder}
      ariaLabel={ariaLabel || ariaLabelAttr || "เลือกวันที่"}
      ariaDescribedBy={ariaDescribedBy}
      className={cx(baseField, className)}
    />
  )
})

export default ThaiDateField
