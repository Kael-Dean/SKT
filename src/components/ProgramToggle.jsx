/**
 * สวิตช์เปิด/ปิด "โครงการที่เข้าร่วม" — ใช้ร่วมกันทุกหน้า (สมัครสมาชิก / แก้ไขสมาชิก / ลูกค้า)
 * โทนกลาง ไม่มีเงา/แสงเรือง: ตัวเลือกที่เปิดอยู่ใช้ขอบเข้ม + สวิตช์ทึบ
 */
export default function ProgramToggle({ checked, onChange, label, className = "" }) {
  const on = !!checked
  return (
    <label
      className={[
        "group flex min-h-[60px] min-w-0 cursor-pointer items-center gap-3.5 rounded-xl border px-4 py-3 transition-colors duration-200",
        "focus-within:ring-2 focus-within:ring-indigo-400",
        on
          ? "border-gray-900/70 bg-white dark:border-white/45 dark:bg-raised"
          : "border-gray-200 bg-white hover:border-gray-300 dark:border-line dark:bg-surface dark:hover:border-line-strong",
        className,
      ].join(" ")}
    >
      <span
        className={[
          "relative inline-flex h-6 w-11 flex-shrink-0 items-center rounded-full transition-colors duration-200",
          on ? "bg-gray-900 dark:bg-gray-100" : "bg-gray-300 dark:bg-gray-600",
        ].join(" ")}
        aria-hidden="true"
      >
        <span
          className={[
            "inline-block h-5 w-5 transform rounded-full shadow-sm transition-transform duration-200",
            on ? "translate-x-[22px] bg-white dark:bg-gray-900" : "translate-x-0.5 bg-white dark:bg-gray-300",
          ].join(" ")}
        />
      </span>
      <input type="checkbox" className="sr-only" checked={on} onChange={(e) => onChange(e.target.checked)} />
      <span className="min-w-0 flex-1 text-[15px] font-medium text-gray-800 dark:text-gray-100 md:text-base">{label}</span>
    </label>
  )
}
