// ป้าย "ร่าง · ยังไม่อนุมัติ" สำหรับยอดเงินเดือนจากงวดที่ยังไม่ปิด (UAT งวด 5 DASH-05 / RPT-02)
// ตัดสินว่าเป็นร่างด้วย isDraftPeriod() จาก src/lib/payrollStatus.js

export function DraftBadge({ className = "" }) {
  return (
    <span
      className={`inline-flex shrink-0 items-center rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-semibold text-amber-800 dark:bg-amber-500/15 dark:text-amber-300 ${className}`}
    >
      ร่าง · ยังไม่อนุมัติ
    </span>
  )
}
