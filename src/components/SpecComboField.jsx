// src/components/SpecComboField.jsx
// Label + shared ComboBox + error/help line for the รหัสข้าว (ProductSpec) forms
// (/spec/create, /spec/manage edit sheet).
import { useId } from "react"
import ComboBox from "./ComboBox"
import { labelCls, helpTextCls, errorTextCls } from "../lib/styles"

export default function SpecComboField({
  label,
  required = false,
  value,
  onChange,
  options,
  placeholder,
  disabled = false,
  loading = false,
  errorText,
  helpText,
  buttonRef,
  onEnterNext,
  searchable = "auto",
}) {
  const id = useId()
  const finalPlaceholder = loading ? "กำลังโหลด..." : placeholder

  return (
    <div>
      <label htmlFor={id} className={labelCls}>
        {label} {required ? <span className="text-red-500">*</span> : null}
      </label>

      <ComboBox
        id={id}
        title={String(label).replace(/\s*\([^)]*\)\s*$/, "")}
        ariaLabel={label}
        searchable={searchable}
        options={options}
        value={value}
        onChange={(v) => onChange?.(v)}
        placeholder={finalPlaceholder}
        disabled={disabled || loading}
        error={!!errorText}
        buttonRef={buttonRef}
        onEnterNext={onEnterNext}
      />

      {errorText ? <p className={errorTextCls}>{errorText}</p> : helpText ? <p className={helpTextCls}>{helpText}</p> : null}
    </div>
  )
}
