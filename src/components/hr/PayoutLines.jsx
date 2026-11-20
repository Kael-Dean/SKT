// src/components/hr/PayoutLines.jsx
// รายละเอียดสลิปเงินเดือนหนึ่งรายการ: รายได้ / รายการหักภายใน / รายการหักภายนอก / งดจ่าย / รับสุทธิ (gross − หัก = สุทธิ)
// ใช้ทั้งหน้า HR (HRPayrollTab) และหน้าสลิปของพนักงาน (MyPayslips) — ลำดับและป้ายเดียวกับสลิป PDF
import {
  EXTERNAL_DEDUCTION_LINES, INCOME_LINES, INTERNAL_DEDUCTION_LINES, UNPAID_DEDUCTION_LINES,
  daysWorkedText, money, netOf, toNum, totalDeductions,
} from "../../lib/payroll"
import { cx } from "../../lib/styles"
import { EstimatedBanner } from "./PayslipEstimated"
import { thaiDate } from "../../lib/loans"

const shownLines = (lines, record) => lines.filter((l) => l.key === "base_salary" || toNum(record[l.key]) !== 0)

function lineLabel(l, record) {
  if (l.key === "base_salary" && record.days_worked != null) {
    // ลูกจ้างรายวัน (3C daily-paid): ค่าจ้าง = ค่าจ้างรายวัน × จำนวนวัน เช่น "22 วัน × 351"
    return <>ค่าจ้างรายวัน <span className="tabular-nums text-gray-500 dark:text-gray-400">({daysWorkedText(record)})</span></>
  }
  // อื่นๆ แสดงรายละเอียดในวงเล็บ เช่น "อื่นๆ (ค่าเสื้อทีม)"
  const note = l.noteKey ? String(record[l.noteKey] ?? "").trim() : ""
  return note ? `${l.label} (${note})` : l.label
}

function Lines({ title, lines, record, tone, hideWhenEmpty = false }) {
  // บรรทัดที่เป็น 0 / ไม่มีค่า ซ่อนไว้ ยกเว้นเงินเดือน (อ่านสลิปง่ายขึ้น)
  const shown = shownLines(lines, record)
  if (hideWhenEmpty && shown.length === 0) return null
  return (
    <section aria-label={title}>
      <h4 className="text-xs font-semibold text-gray-500 dark:text-gray-400">{title}</h4>
      {shown.length === 0 ? (
        <p className="mt-1.5 text-sm text-gray-500 dark:text-gray-400">ไม่มีรายการ</p>
      ) : (
        <dl className="mt-1.5 divide-y divide-gray-100 dark:divide-line">
          {shown.map((l) => (
            <div key={l.key} className="flex items-baseline justify-between gap-4 py-1.5 text-sm">
              <dt className="min-w-0 break-words text-gray-700 dark:text-gray-300">{lineLabel(l, record)}</dt>
              <dd className="shrink-0 tabular-nums text-gray-900 dark:text-gray-100">
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
      <EstimatedBanner record={record} />
      <div className="grid gap-4 md:grid-cols-2 md:gap-6">
        <Lines title="รายได้" lines={INCOME_LINES} record={record} />
        <div className="space-y-4">
          <Lines title="รายการหักภายใน" lines={INTERNAL_DEDUCTION_LINES} record={record} tone="minus" />
          <Lines title="รายการหักภายนอก" lines={EXTERNAL_DEDUCTION_LINES} record={record} tone="minus" hideWhenEmpty />
          <Lines title="งดจ่าย" lines={UNPAID_DEDUCTION_LINES} record={record} tone="minus" hideWhenEmpty />
        </div>
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
        {toNum(record.shortfall_paid) > 0 && (
          <div className="flex items-baseline justify-between gap-4 py-0.5">
            <dt className="min-w-0 break-words text-gray-600 dark:text-gray-400">
              อื่นๆ — เจ้าหน้าที่ชำระส่วนขาด
              {(record.shortfall_paid_note || record.shortfall_paid_on) && (
                <span className="block text-xs text-gray-500 dark:text-gray-400">
                  {[record.shortfall_paid_note, record.shortfall_paid_on && thaiDate(record.shortfall_paid_on)].filter(Boolean).join(" · ")}
                </span>
              )}
            </dt>
            <dd className="shrink-0 tabular-nums text-gray-900 dark:text-gray-100">+{money(record.shortfall_paid)}</dd>
          </div>
        )}
        <div className="mt-1.5 flex items-baseline justify-between gap-4 border-t border-gray-200 pt-2 dark:border-line">
          <dt className="font-semibold text-gray-900 dark:text-gray-100">รับสุทธิ</dt>
          <dd className="text-base font-bold tabular-nums text-emerald-700 dark:text-emerald-300">{money(netOf(record))}</dd>
        </div>
      </dl>
    </div>
  )
}
