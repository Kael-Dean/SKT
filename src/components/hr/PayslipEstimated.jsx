// src/components/hr/PayslipEstimated.jsx
// ─────────────────────────────────────────────────────────────────────────────
// สลิปที่นำเข้าย้อนหลังเป็น "ประมาณการ" (api-handoff PR 106) — payslip ทุกตัวมี is_estimated + source_note
//   EstimatedBanner  ใช้ในรายละเอียดสลิป (PayoutLines → MyPayslipsPanel + HRPayrollPayoutSheet)
//   EstimatedChip    ป้ายเล็กในรายการ (สลิปของฉัน, ตารางเงินเดือน HR)
// ─────────────────────────────────────────────────────────────────────────────
import { TriangleAlert } from "lucide-react"
import { cx } from "../../lib/styles"

export function EstimatedBanner({ record, className }) {
  if (record?.is_estimated) {
    return (
      <div role="note" className={cx("flex gap-2.5 rounded-xl bg-amber-50 px-3.5 py-3 text-amber-900 ring-1 ring-inset ring-amber-300/70 dark:bg-amber-400/10 dark:text-amber-200 dark:ring-amber-400/30", className)}>
        <TriangleAlert aria-hidden="true" className="mt-0.5 size-4 shrink-0" strokeWidth={1.75} />
        <div className="min-w-0 text-sm">
          <p className="font-medium">ข้อมูลประมาณการ — นำเข้าย้อนหลังจากเอกสารของสหกรณ์ ยอดอาจไม่ตรงกับที่จ่ายจริง</p>
          {record.source_note && <p className="mt-0.5 text-xs opacity-90">{record.source_note}</p>}
        </div>
      </div>
    )
  }
  // เดือนที่นำเข้าจริง — แสดงเป็นหมายเหตุเบา ๆ
  if (record?.source_note) {
    return <p className={cx("text-xs text-gray-500 dark:text-gray-400", className)}>{record.source_note}</p>
  }
  return null
}

export function EstimatedChip({ record, className }) {
  if (!record?.is_estimated) return null
  return (
    <span className={cx("inline-flex items-center rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-900 dark:bg-amber-400/15 dark:text-amber-200", className)}>
      ประมาณการ
    </span>
  )
}
