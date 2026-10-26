// src/components/hr/welfare/Segmented.jsx
// ─────────────────────────────────────────────────────────────────────────────
// ตัวเลือกแบบปุ่มแบ่งช่อง (2–3 ตัวเลือก) บน native radio — ลูกศรซ้าย/ขวา, Tab, screen reader
// ทำงานตาม browser เอง · หน้าตาตาม segmentedCls / segmentedItemActiveCls ของ styles.js
//
//   <Segmented name="facility" legend="ประเภทสถานพยาบาล" options={[{value,label}]} value={v} onChange={setV} />
// ─────────────────────────────────────────────────────────────────────────────
import { cx, labelCls, segmentedCls } from "../../../lib/styles"

const itemCls =
  "relative flex flex-1 min-h-touch md:min-h-9 cursor-pointer items-center justify-center rounded-xl px-3 text-center text-sm font-medium " +
  "text-gray-600 hover:text-gray-900 dark:text-gray-300 dark:hover:text-gray-100 transition-colors duration-150 " +
  "has-[:checked]:bg-white has-[:checked]:text-indigo-700 has-[:checked]:shadow-sm has-[:checked]:ring-1 has-[:checked]:ring-gray-200/70 " +
  "dark:has-[:checked]:bg-raised dark:has-[:checked]:text-indigo-200 dark:has-[:checked]:ring-line-strong " +
  "has-[:focus-visible]:outline-none has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-indigo-500 dark:has-[:focus-visible]:ring-indigo-400 " +
  "has-[:disabled]:cursor-not-allowed has-[:disabled]:opacity-60"

export default function Segmented({
  name, legend, options, value, onChange, required = false, error, errorId, disabled = false, className = "", hideLegend = false,
}) {
  return (
    <fieldset className={className} aria-describedby={error ? errorId : undefined} aria-invalid={error ? true : undefined}>
      <legend className={cx(labelCls, "md:!text-sm", hideLegend && "sr-only")}>
        {legend}{required && <span className="text-red-600 dark:text-red-400" aria-hidden="true"> *</span>}
      </legend>
      <div className={cx(segmentedCls, error && "!ring-red-500 dark:!ring-red-400")}>
        {options.map((o) => (
          <label key={o.value} className={itemCls}>
            <input
              type="radio" name={name} value={o.value} checked={String(value) === String(o.value)}
              onChange={() => onChange(o.value)} disabled={disabled || o.disabled} required={required}
              className="sr-only"
            />
            {o.label}
          </label>
        ))}
      </div>
      {error && <p id={errorId} className="mt-1 text-sm text-red-600 dark:text-red-400">{error}</p>}
    </fieldset>
  )
}
