// src/components/FormApplicantHeader.jsx
// ─────────────────────────────────────────────────────────────────────────────
// หัวฟอร์มแบบกระดาษ "วันที่ / ข้าพเจ้า / ตำแหน่ง / สังกัด" — เติมอัตโนมัติจาก useFormDefaults
// (Frontend Gaps Re-check 2026-10-17 §3). ใช้กับฟอร์ม self-service ที่ backend ไม่รับค่าหัวฟอร์มใน body
// (ขอออกนอกสถานที่ / ขอกู้ / ย้ายสาขา / หนังสือรับรองเงินเดือน) — แสดงแบบอ่านอย่างเดียวให้ผู้ยื่นตรวจว่า
// ระบบรู้จักตัวเขาถูกคน ไม่ต้องพิมพ์ซ้ำ. ข้อมูลผิด → แจ้งแก้ที่หน้า "ข้อมูลของฉัน" (report-issue)
//
// ฟอร์มที่ส่งค่าหัวฟอร์มไป backend จริง (ใบลา) ใช้ useFormDefaults ตรง ๆ เพื่อให้แก้ได้ — ไม่ใช่ component นี้
// ─────────────────────────────────────────────────────────────────────────────
import useFormDefaults from "../hooks/useFormDefaults"
import { getUser } from "../lib/auth"
import { cx } from "../lib/styles"
import { Skeleton } from "./ui"

const todayThai = () =>
  new Date().toLocaleDateString("th-TH", { day: "numeric", month: "long", year: "numeric" })

function Item({ label, value, wide }) {
  return (
    <div className={cx("min-w-0", wide && "col-span-2 sm:col-span-1")}>
      <dt className="text-xs text-gray-500 dark:text-gray-400">{label}</dt>
      <dd className="mt-0.5 truncate text-sm font-medium text-gray-900 dark:text-gray-100" title={value || undefined}>
        {value || <span className="font-normal text-gray-400 dark:text-gray-500">—</span>}
      </dd>
    </div>
  )
}

/**
 * @param {{ className?: string, showDate?: boolean }} props
 */
export default function FormApplicantHeader({ className, showDate = true }) {
  const { defaults, loading } = useFormDefaults()
  const user = getUser() || {}
  const name = defaults.name || user.full_name || user.username || ""
  const unit = [defaults.branch, defaults.department].filter(Boolean).join(" / ")

  return (
    <section
      aria-label="ผู้ยื่นคำขอ"
      aria-busy={loading || undefined}
      className={cx("rounded-xl bg-gray-50 px-4 py-3 ring-1 ring-gray-200/70 dark:bg-white/[.03] dark:ring-line", className)}
    >
      {loading ? (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4" aria-hidden="true">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="space-y-1.5">
              <Skeleton rounded="rounded" className="h-3 w-12" />
              <Skeleton rounded="rounded" className="h-4 w-24" />
            </div>
          ))}
        </div>
      ) : (
        <dl className={cx("grid grid-cols-2 gap-x-4 gap-y-2", showDate ? "sm:grid-cols-4" : "sm:grid-cols-3")}>
          {showDate && <Item label="วันที่" value={todayThai()} />}
          <Item label="ข้าพเจ้า" value={name} />
          <Item label="ตำแหน่ง" value={defaults.position} />
          <Item label="สังกัด" value={unit} wide={!showDate} />
        </dl>
      )}
    </section>
  )
}
