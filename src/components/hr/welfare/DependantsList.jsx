// src/components/hr/welfare/DependantsList.jsx
// ─────────────────────────────────────────────────────────────────────────────
// รายชื่อผู้มีสิทธิ์ + สถานะสิทธิ์ (ค่ารักษา / การศึกษา) พร้อมเหตุผลจาก backend
// ใช้ทั้งโปรไฟล์พนักงาน (มีปุ่มแก้ไข/ลบ) และหน้า "สวัสดิการของฉัน" (อ่านอย่างเดียว)
//
//   <DependantsList items={rows} actions={(d) => …} />
//
// มือถือ: แต่ละคนเป็นบล็อกเรียงลง · ≥md: ตาราง 4 คอลัมน์ (ใช้ grid เดียว ไม่ render ซ้ำ)
// ─────────────────────────────────────────────────────────────────────────────
import { CircleCheck, CircleMinus } from "lucide-react"
import { cx } from "../../../lib/styles"
import { dependantMeta, dependantName } from "../../../lib/welfare"

const COLS = "md:grid md:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)_minmax(0,1fr)_auto] md:items-start md:gap-4"

/** สิทธิ์ 1 ประเภท — มีสิทธิ์ = เขียว, ไม่มี = เทา + เหตุผล */
export function Eligibility({ label, eligible, reason, notApplicable = false }) {
  if (notApplicable) {
    return (
      <div className="flex items-start gap-1.5 text-sm text-gray-500 dark:text-gray-400">
        <span className="md:sr-only">{label}:</span> <span aria-label="ไม่เกี่ยวข้อง">—</span>
      </div>
    )
  }
  return (
    <div className="flex items-start gap-1.5 text-sm">
      {eligible
        ? <CircleCheck aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-emerald-600 dark:text-emerald-400" strokeWidth={2} />
        : <CircleMinus aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-gray-400 dark:text-gray-500" strokeWidth={2} />}
      <div className="min-w-0">
        <span className={eligible ? "font-medium text-emerald-700 dark:text-emerald-300" : "text-gray-700 dark:text-gray-300"}>
          <span className="md:sr-only">{label}: </span>{eligible ? "มีสิทธิ์" : "ไม่มีสิทธิ์"}
        </span>
        {!eligible && reason && <p className="text-xs text-pretty text-gray-500 dark:text-gray-400">{reason}</p>}
      </div>
    </div>
  )
}

export default function DependantsList({ items, actions, className = "" }) {
  return (
    <div className={cx("text-sm", className)}>
      <div className={cx("hidden border-b border-gray-100 pb-2 text-xs font-semibold text-gray-500 dark:border-line dark:text-gray-400", COLS)} aria-hidden="true">
        <span>ชื่อ / ความสัมพันธ์</span>
        <span>ค่ารักษาพยาบาล</span>
        <span>ค่าการศึกษาบุตร</span>
        <span className="w-px" />
      </div>
      <ul className="divide-y divide-gray-100 dark:divide-line">
        {items.map((d) => {
          const child = d.relationship === "บุตร"
          const gone = !!d.deceased_date
          return (
            <li key={d.id} className={cx("space-y-2 py-3 md:space-y-0", COLS)}>
              <div className="flex items-start justify-between gap-2 md:block">
                <div className="min-w-0">
                  <p className={cx("font-medium", gone ? "text-gray-500 dark:text-gray-400" : "text-gray-900 dark:text-gray-100")}>{dependantName(d)}</p>
                  <p className="text-xs text-gray-500 dark:text-gray-400">{dependantMeta(d)}</p>
                  {d.note && <p className="mt-0.5 text-xs italic text-gray-500 dark:text-gray-400">{d.note}</p>}
                </div>
                {actions && <div className="shrink-0 md:hidden">{actions(d)}</div>}
              </div>
              <Eligibility label="ค่ารักษาพยาบาล" eligible={d.medical_eligible} reason={d.medical_reason} />
              <Eligibility label="ค่าการศึกษาบุตร" eligible={d.education_eligible} reason={d.education_reason} notApplicable={!child} />
              {actions ? <div className="hidden md:block">{actions(d)}</div> : <span className="hidden md:block md:w-px" />}
            </li>
          )
        })}
      </ul>
    </div>
  )
}
