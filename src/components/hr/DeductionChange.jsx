// src/components/hr/DeductionChange.jsx
// "500.00 → 600.00" ของคำขอเปลี่ยนภาษี / เงินสะสม — new เป็น null = "ไม่เปลี่ยน"
// ใช้ทั้งการ์ดของพนักงาน (/my-financial) และคิวของ HR
import { changeParts } from "../../lib/deductions"
import { cx } from "../../lib/styles"

export default function DeductionChange({ current, next, className = "" }) {
  const parts = changeParts(current, next)
  if (!parts) {
    return <span className={cx("text-gray-500 dark:text-gray-400", className)}>ไม่เปลี่ยน</span>
  }
  return (
    <span className={cx("whitespace-nowrap tabular-nums", className)}>
      <span className="text-gray-500 dark:text-gray-400">{parts.from}</span>
      <span aria-hidden="true" className="mx-1.5 text-gray-400 dark:text-gray-500">→</span>
      <span className="sr-only"> เป็น </span>
      <span className="font-semibold text-gray-900 dark:text-gray-100">{parts.to}</span>
    </span>
  )
}
