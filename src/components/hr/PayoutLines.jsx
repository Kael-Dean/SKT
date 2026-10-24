// src/components/hr/PayoutLines.jsx
// รายละเอียดสลิปเงินเดือนหนึ่งรายการ: รายได้ / รายการหัก / รับสุทธิ (gross − หัก = สุทธิ)
// ใช้ทั้งหน้า HR (HRPayrollTab) และหน้าสลิปของพนักงาน (MyPayslips)
import { DEDUCTION_LINES, INCOME_LINES, daysWorkedText, money, netOf, toNum, totalDeductions } from "../../lib/payroll"
import { cx } from "../../lib/styles"

function Lines({ title, lines, record, tone }) {
  // บรรทัดที่เป็น 0 / ไม่มีค่า ซ่อนไว้ ยกเว้นเงินเดือน (อ่านสลิปง่ายขึ้น)
  const shown = lines.filter((l) => l.key === "base_salary" || toNum(record[l.key]) !== 0)
  return (
    <section aria-label={title}>
      <h4 className="text-xs font-semibold text-gray-500 dark:text-gray-400">{title}</h4>
      {shown.length === 0 ? (
        <p className="mt-1.5 text-sm text-gray-500 dark:text-gray-400">ไม่มีรายการ</p>
      ) : (
        <dl className="mt-1.5 divide-y divide-gray-100 dark:divide-line">
          {shown.map((l) => (
            <div key={l.key} className="flex items-baseline justify-between gap-4 py-1.5 text-sm">
              <dt className="text-gray-700 dark:text-gray-300">
                {l.key === "base_salary" && record.days_worked != null ? (
                  // ลูกจ้างรายวัน (3C daily-paid): ค่าจ้าง = ค่าจ้างรายวัน × จำนวนวัน เช่น "22 วัน × 351"
                  <>ค่าจ้างรายวัน <span className="tabular-nums text-gray-500 dark:text-gray-400">({daysWorkedText(record)})</span></>
                ) : l.label}
              </dt>
              <dd className="tabular-nums text-gray-900 dark:text-gray-100">
                {tone === "minus" && toNum(record[l.key]) !== 0 ? "−" : ""}
                {money(record[l.key] ?? 0)}
              </dd>
            </div>
          ))}
        </dl>
      )}
    </section>
  )
}

export default function PayoutLines({ record, className = "" }) {
  if (!record) return null
  const deductions = totalDeductions(record)
  return (
    <div className={cx("space-y-4", className)}>
      <div className="grid gap-4 md:grid-cols-2 md:gap-6">
        <Lines title="รายได้" lines={INCOME_LINES} record={record} />
        <Lines title="รายการหัก" lines={DEDUCTION_LINES} record={record} tone="minus" />
      </div>
      <dl className="rounded-xl bg-gray-50 px-4 py-3 text-sm ring-1 ring-inset ring-gray-200/70 dark:bg-white/[.03] dark:ring-line">
        <div className="flex items-baseline justify-between gap-4 py-0.5">
          <dt className="text-gray-600 dark:text-gray-400">รายได้รวม</dt>
          <dd className="tabular-nums text-gray-900 dark:text-gray-100">{money(record.gross_income)}</dd>
        </div>
        <div className="flex items-baseline justify-between gap-4 py-0.5">
          <dt className="text-gray-600 dark:text-gray-400">รายการหักรวม</dt>
          <dd className="tabular-nums text-gray-900 dark:text-gray-100">{deductions == null ? "—" : `−${money(deductions)}`}</dd>
        </div>
        <div className="mt-1.5 flex items-baseline justify-between gap-4 border-t border-gray-200 pt-2 dark:border-line">
          <dt className="font-semibold text-gray-900 dark:text-gray-100">รับสุทธิ</dt>
          <dd className="text-base font-bold tabular-nums text-emerald-700 dark:text-emerald-300">{money(netOf(record))}</dd>
        </div>
      </dl>
    </div>
  )
}
