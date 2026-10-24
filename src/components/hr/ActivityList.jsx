// src/components/hr/ActivityList.jsx
// ─────────────────────────────────────────────────────────────────────────────
// รายการประวัติกิจกรรม (3G · PR 45) — ใช้ร่วมกันระหว่าง HR (PersonnelActivitiesTab) และ
// พนักงานดูของตนเอง (MyProfile). ไม่มี state ของข้อมูลเอง: หน้าเป็นคนโหลด แล้วส่ง items มา
//
//   <ActivityList items={rows} loading={loading} error={error} onRetry={load}
//     emptyTitle="…" emptyDescription="…" emptyAction={<button…/>}
//     actions={(a) => <>แก้ไข / ลบ</>} />              // ไม่ส่ง actions = อ่านอย่างเดียว
//
// Layout: แถวเดียวกันทั้ง desktop และมือถือ (ไม่ใช่ตาราง) — ≥md วันที่อยู่คอลัมน์ซ้าย
// เพื่อสแกนลำดับเวลาได้, มือถือวันที่ย้ายขึ้นบรรทัดเดียวกับประเภท. ใบประกาศเปิด/ดาวน์โหลดผ่าน
// AttachmentList (fetch → blob ตาม token — <a href> ตรง ๆ จะ 401)
// ─────────────────────────────────────────────────────────────────────────────
import { CalendarDays, Clock, MapPin, Building2 } from "lucide-react"
import AttachmentList from "../AttachmentList"
import { Badge, EmptyState, ErrorState, SkeletonText } from "../ui"
import { activityDateRange, activityTypeLabel, activityTypeTone, hoursText } from "../../lib/activities"
import { cx } from "../../lib/styles"

function Meta({ icon, label, children }) {
  if (!children) return null
  const Icon = icon
  return (
    <span className="inline-flex min-w-0 items-center gap-1">
      <Icon aria-hidden="true" className="size-3.5 shrink-0 text-gray-400 dark:text-gray-500" />
      <span className="sr-only">{label} </span>
      <span className="min-w-0 break-words">{children}</span>
    </span>
  )
}

function ActivityRow({ a, actions }) {
  // Keep each date on one line; only break at the dash.
  const range = activityDateRange(a).split(" – ").flatMap((d, i) => [
    i > 0 ? " – " : null,
    <span key={i} className="whitespace-nowrap">{d}</span>,
  ])
  const hours = hoursText(a.hours)
  const files = Array.isArray(a.attachments) ? a.attachments : []
  const action = actions?.(a)
  return (
    <li className="grid gap-x-5 gap-y-1.5 py-4 first:pt-1 last:pb-1 md:grid-cols-[8.5rem_minmax(0,1fr)_auto]">
      {/* ≥md: วันที่เป็นคอลัมน์ลำดับเวลา */}
      <p className="hidden pt-0.5 text-sm tabular-nums text-gray-600 dark:text-gray-400 md:block">
        <time dateTime={a.start_date}>{range}</time>
      </p>

      <div className="min-w-0 space-y-1.5">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <Badge tone={activityTypeTone(a)}>{activityTypeLabel(a)}</Badge>
          <span className="text-xs tabular-nums text-gray-600 dark:text-gray-400 md:hidden">
            <time dateTime={a.start_date}>{range}</time>
          </span>
        </div>
        <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100 break-words">{a.title || "—"}</h3>

        {(a.organizer || a.location || hours) && (
          <p className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-gray-600 dark:text-gray-400">
            <Meta icon={Building2} label="ผู้จัด">{a.organizer}</Meta>
            <Meta icon={MapPin} label="สถานที่">{a.location}</Meta>
            <Meta icon={Clock} label="จำนวนชั่วโมง">{hours}</Meta>
          </p>
        )}

        {a.detail && (
          <p className="max-w-prose whitespace-pre-line text-sm text-gray-700 dark:text-gray-300 text-pretty break-words">{a.detail}</p>
        )}

        {a.result && (
          <p className="text-sm text-gray-700 dark:text-gray-300 break-words">
            <span className="text-gray-500 dark:text-gray-400">ผล </span>
            <span className="font-semibold text-gray-900 dark:text-gray-100">{a.result}</span>
          </p>
        )}

        {files.length > 0 && (
          <div className="pt-1">
            <p className="sr-only">ใบประกาศ / ไฟล์แนบ</p>
            <AttachmentList attachments={files} variant="compact" />
          </div>
        )}
      </div>

      {action && <div className="flex items-start gap-1 md:justify-end">{action}</div>}
    </li>
  )
}

/**
 * @param {{ items?: object[], loading?: boolean, error?: string, onRetry?: () => void,
 *           actions?: (a: object) => import("react").ReactNode, emptyTitle?: string,
 *           emptyDescription?: string, emptyAction?: import("react").ReactNode, className?: string }} props
 */
export default function ActivityList({
  items = [],
  loading = false,
  error = "",
  onRetry,
  actions,
  emptyTitle = "ยังไม่มีประวัติกิจกรรม",
  emptyDescription = "",
  emptyAction = null,
  className = "",
}) {
  if (error) return <ErrorState message={error} onRetry={onRetry} />
  if (loading && items.length === 0) {
    return (
      <div className="space-y-5 py-1" aria-busy="true">
        <span className="sr-only">กำลังโหลดประวัติกิจกรรม…</span>
        {[0, 1, 2].map((i) => <SkeletonText key={i} lines={3} />)}
      </div>
    )
  }
  if (items.length === 0) {
    return (
      <EmptyState
        className="!py-10"
        icon={<CalendarDays aria-hidden="true" className="size-10" strokeWidth={1.5} />}
        title={emptyTitle}
        description={emptyDescription}
        action={emptyAction}
      />
    )
  }
  return (
    <ul className={cx("divide-y divide-gray-100 dark:divide-line", className)} aria-label={`ประวัติกิจกรรม ${items.length} รายการ`}>
      {items.map((a) => <ActivityRow key={a.id} a={a} actions={actions} />)}
    </ul>
  )
}
