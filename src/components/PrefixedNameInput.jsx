// src/components/PrefixedNameInput.jsx
// Dropdown คำนำหน้า + ช่องชื่อ สำหรับฟิลด์ที่ backend เก็บ "คำนำหน้า+ชื่อ" เป็น string เดียว.
//   value / onChange(full)  = string รวม เช่น "นายสมชาย"
//   onPrefixChange(prefix)  = แจ้งเมื่อเปลี่ยนคำนำหน้า (เช่น ตั้งเพศให้อัตโนมัติ)
// คำนำหน้า/ชื่อเก็บใน state ภายในเพื่อให้เลือกคำนำหน้าก่อนพิมพ์ชื่อได้; sync ใหม่เมื่อ value เปลี่ยนจากข้างนอก
import { useState } from "react"
import SelectDropdown from "./SelectDropdown"
import { ADULT_PREFIX_OPTIONS, joinPrefixedName, splitPrefixedName } from "../lib/namePrefix"
import { baseField, cx } from "../lib/styles"

export default function PrefixedNameInput({
  id,
  value = "",
  onChange,
  onPrefixChange,
  options = ADULT_PREFIX_OPTIONS,
  label = "ชื่อ",
  placeholder = "ชื่อ",
  size = "md",
  inputClassName,
  invalid = false,
  prefixInvalid = false,
  required = false,
  disabled = false,
  autoComplete = "off",
  describedBy,
}) {
  const [parts, setParts] = useState(() => splitPrefixedName(value))
  const [synced, setSynced] = useState(value)
  // value เปลี่ยนจากข้างนอก (reset ฟอร์ม / โหลดข้อมูล) → แยกใหม่
  if (value !== synced) {
    setSynced(value)
    if (value !== joinPrefixedName(parts.prefix, parts.name)) setParts(splitPrefixedName(value))
  }

  const emit = (next) => {
    setParts(next)
    const full = joinPrefixedName(next.prefix, next.name)
    setSynced(full)
    onChange?.(full)
  }

  // ค่าเก่าที่คำนำหน้าไม่อยู่ในรายการ (เช่น ผู้ใหญ่ที่เคยเป็น ด.ช.) ยังแสดงได้
  const opts = parts.prefix && !options.some((o) => o.value === parts.prefix)
    ? [{ value: parts.prefix, label: parts.prefix }, ...options]
    : options

  return (
    <div className="flex items-stretch gap-2">
      {/* trigger สูงเท่าช่องชื่อ */}
      <div className={cx(size === "sm" ? "w-28" : "w-32", "shrink-0 [&>div]:h-full [&>div>button]:h-full")}>
        <SelectDropdown
          id={id ? `${id}-prefix` : undefined}
          size={size}
          options={opts}
          value={parts.prefix}
          onChange={(v) => {
            emit({ ...parts, prefix: v })
            onPrefixChange?.(v)
          }}
          placeholder="คำนำหน้า"
          ariaLabel={`คำนำหน้า${label}`}
          showSwatch={false}
          required={required}
          disabled={disabled}
          error={prefixInvalid}
        />
      </div>
      <input
        id={id}
        type="text"
        className={cx(baseField, "min-w-0 flex-1", inputClassName)}
        value={parts.name}
        placeholder={placeholder}
        onChange={(e) => emit({ ...parts, name: e.target.value })}
        aria-invalid={invalid || undefined}
        aria-describedby={describedBy}
        required={required}
        disabled={disabled}
        autoComplete={autoComplete}
      />
    </div>
  )
}
