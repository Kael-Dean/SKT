// สิทธิ์การลา + วันที่ลาไปแล้ว — ใช้ร่วมกันระหว่าง "ข้อมูลของฉัน" (MyProfile) และ "ข้อมูลเจ้าหน้าที่" (HRPersonnelDetail)
// ข้อมูล: leave_quota (LeaveQuotaOut) + แถวจาก useLeaveBalance() → { name, quota, used, remaining }
import { cx } from "../../lib/styles"
import { fmtDays, parseDays } from "../../lib/leaveDays"
import { isAnnualLeave, isPrescribedLeave } from "../../lib/leaveTypes"
import { Skeleton } from "../ui"

const isAbsence = (name) => String(name ?? "").trim().startsWith("ขาดงาน")

/** แถบสัดส่วนที่ใช้ไป — เกินสิทธิ์ = เต็มแถบสี amber */
function UsageBar({ used, quota, className }) {
  const u = parseDays(used) ?? 0
  const q = parseDays(quota) ?? 0
  if (q <= 0) return null
  const over = u > q
  const pct = Math.min(100, (u / q) * 100)
  return (
    <div
      className={cx("h-1.5 rounded-full bg-gray-200/80 dark:bg-white/10 overflow-hidden", className)}
      role="progressbar"
      aria-valuemin={0}
      aria-valuemax={q}
      aria-valuenow={u}
      aria-label={`ใช้ไป ${fmtDays(u)} จาก ${fmtDays(q)} วัน`}
    >
      <div
        className={cx("h-full rounded-full transition-[width] duration-300", over ? "bg-amber-500" : "bg-indigo-500 dark:bg-indigo-400")}
        style={{ width: `${pct}%` }}
      />
    </div>
  )
}

function Stat({ label, value, tone = "default", hint }) {
  return (
    <div className="min-w-0">
      <p className="text-xs text-gray-500 dark:text-gray-400">{label}</p>
      <p
        className={cx(
          "text-xl font-bold tabular-nums mt-0.5",
          tone === "warn" ? "text-amber-600 dark:text-amber-400"
            : tone === "danger" ? "text-red-600 dark:text-red-400"
              : "text-gray-900 dark:text-gray-100",
        )}
      >
        {value}
        <span className="ml-1 text-sm font-medium text-gray-500 dark:text-gray-400">วัน</span>
      </p>
      {hint && <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">{hint}</p>}
    </div>
  )
}

function TypeTile({ row }) {
  const used = parseDays(row.used) ?? 0
  const quota = parseDays(row.quota)
  const prescribed = isPrescribedLeave(row.name)
  const absence = isAbsence(row.name)
  const capped = !prescribed && !absence && quota != null && quota > 0
  const remaining = capped ? (parseDays(row.remaining) ?? quota - used) : null
  const over = capped ? Math.max(0, used - quota) : 0
  const touched = used > 0

  return (
    <li
      className={cx(
        "rounded-xl p-3 ring-1 transition-colors duration-200",
        touched
          ? "bg-white dark:bg-raised ring-gray-200 dark:ring-line-strong"
          : "bg-gray-50 dark:bg-gray-700/30 ring-transparent",
      )}
    >
      <div className="flex items-baseline justify-between gap-2">
        <p className={cx("text-sm truncate", touched ? "font-semibold text-gray-900 dark:text-gray-100" : "text-gray-600 dark:text-gray-300")}>
          {row.name}
        </p>
        <p className="shrink-0 text-sm tabular-nums text-gray-500 dark:text-gray-400">
          <span
            className={cx(
              "font-bold",
              absence && touched ? "text-red-600 dark:text-red-400"
                : touched ? "text-gray-900 dark:text-gray-100" : "text-gray-400 dark:text-gray-500",
            )}
          >
            {fmtDays(used)}
          </span>
          {capped && <> / {fmtDays(quota)}</>}
          <span className="ml-0.5 text-xs">วัน</span>
        </p>
      </div>

      {capped && <UsageBar used={used} quota={quota} className="mt-2" />}

      <p className="mt-1.5 text-xs text-gray-500 dark:text-gray-400">
        {prescribed ? "ตามแพทย์สั่ง · ไม่จำกัดวัน"
          : absence ? (touched ? "ไม่นับเป็นวันลา" : "ไม่มีวันขาดงาน")
            : !capped ? "ไม่มีสิทธิ์ในปีนี้"
              : over > 0 ? <span className="font-medium text-amber-600 dark:text-amber-400">เกินสิทธิ์ {fmtDays(over)} วัน (งดจ่าย)</span>
                : <>เหลือ <span className="font-semibold text-gray-700 dark:text-gray-200 tabular-nums">{fmtDays(remaining)}</span> วัน</>}
      </p>
    </li>
  )
}

/**
 * @param {object}  quota  leave_quota — { year, annual_leave, annual_leave_carried_over }
 * @param {object[]|null} rows  แถวจาก useLeaveBalance (null = กำลังโหลด)
 * @param {string}  error
 * @param {string}  [newHireNote]  ข้อความเมื่อสิทธิ์ลาพักผ่อนปีนี้ = 0
 */
export default function LeaveBalancePanel({ quota, rows, error, newHireNote }) {
  const annualRow = rows?.find((r) => isAnnualLeave(r.name))
  const otherRows = rows?.filter((r) => !isAnnualLeave(r.name)) ?? []

  const annualThisYear = parseDays(quota.annual_leave) ?? 0
  const annualCarried = parseDays(quota.annual_leave_carried_over) ?? 0
  const annualTotal = annualThisYear + annualCarried
  const annualUsed = parseDays(annualRow?.used)
  const annualLeft = annualUsed == null ? null : annualTotal - annualUsed

  // สรุปทั้งปี — วันลา (ไม่รวมขาดงาน), วันขาดงาน, วันที่เกินสิทธิ์ (ถูกงดจ่าย)
  const leaveRows = rows?.filter((r) => !isAbsence(r.name)) ?? []
  const totalUsed = leaveRows.reduce((s, r) => s + (parseDays(r.used) ?? 0), 0)
  const typesUsed = leaveRows.filter((r) => (parseDays(r.used) ?? 0) > 0).length
  const absenceDays = (rows ?? []).filter((r) => isAbsence(r.name)).reduce((s, r) => s + (parseDays(r.used) ?? 0), 0)
  const overDays = (rows ?? []).reduce((s, r) => {
    if (isAbsence(r.name) || isPrescribedLeave(r.name)) return s
    const used = parseDays(r.used) ?? 0
    const cap = isAnnualLeave(r.name) ? annualTotal : parseDays(r.quota)
    return cap == null ? s : s + Math.max(0, used - cap)
  }, 0)

  return (
    <div>
      {/* สรุปทั้งปี */}
      {rows === null ? (
        <Skeleton className="h-16 rounded-xl mb-4" />
      ) : rows.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-x-6 gap-y-3 mb-4 pb-4 border-b border-gray-100 dark:border-line">
          <Stat
            label="ลาไปแล้วทั้งหมด"
            value={fmtDays(totalUsed)}
            hint={typesUsed > 0 ? `จาก ${typesUsed} ประเภท` : "ยังไม่มีวันลาในปีนี้"}
          />
          <Stat label="ขาดงาน" value={fmtDays(absenceDays)} tone={absenceDays > 0 ? "danger" : "default"} />
          <Stat
            label="ลาเกินสิทธิ์ (งดจ่าย)"
            value={fmtDays(overDays)}
            tone={overDays > 0 ? "warn" : "default"}
          />
        </div>
      )}

      {/* ลาพักผ่อน: สิทธิ์ปีนี้ + ยกมาจากปีก่อน = สิทธิ์รวม − ใช้ไป = คงเหลือ */}
      <div className="rounded-xl bg-indigo-50 dark:bg-indigo-900/20 p-4 mb-3">
        <div className="flex items-baseline justify-between gap-3 mb-2">
          <p className="text-sm font-semibold text-indigo-900 dark:text-indigo-200">{annualRow?.name ?? "ลาพักผ่อน"}</p>
          {annualLeft != null && (
            <p className="text-sm text-indigo-900/70 dark:text-indigo-200/70">
              คงเหลือ{" "}
              <span className={cx("text-lg font-bold tabular-nums", annualLeft < 0 ? "text-amber-600 dark:text-amber-400" : "text-indigo-700 dark:text-indigo-300")}>
                {fmtDays(Math.max(0, annualLeft))}
              </span>{" "}
              วัน
            </p>
          )}
        </div>
        {annualUsed != null && annualTotal > 0 && <UsageBar used={annualUsed} quota={annualTotal} className="mb-3 !bg-indigo-200/60 dark:!bg-indigo-950/60" />}
        <dl className="space-y-1 text-sm">
          <div className="flex items-baseline justify-between">
            <dt className="text-gray-600 dark:text-gray-400">สิทธิ์ปีนี้</dt>
            <dd className="font-medium text-gray-900 dark:text-gray-100 tabular-nums">{fmtDays(quota.annual_leave)} วัน</dd>
          </div>
          <div className="flex items-baseline justify-between">
            <dt className="text-gray-600 dark:text-gray-400">ยกมาจากปีก่อน</dt>
            <dd className="font-medium text-gray-900 dark:text-gray-100 tabular-nums">{fmtDays(quota.annual_leave_carried_over)} วัน</dd>
          </div>
          <div className="flex items-baseline justify-between border-t border-indigo-200/70 dark:border-indigo-800/60 pt-1 mt-1">
            <dt className="font-semibold text-indigo-900 dark:text-indigo-200">สิทธิ์รวม</dt>
            <dd className="font-semibold text-indigo-900 dark:text-indigo-200 tabular-nums">{fmtDays(annualTotal)} วัน</dd>
          </div>
          <div className="flex items-baseline justify-between">
            <dt className="text-gray-600 dark:text-gray-400">ใช้ไปแล้ว</dt>
            <dd className="font-medium text-gray-900 dark:text-gray-100 tabular-nums">
              {rows === null ? "…" : `${fmtDays(annualUsed ?? 0)} วัน`}
            </dd>
          </div>
          {annualLeft != null && annualLeft < 0 && (
            <div className="flex items-baseline justify-between">
              <dt className="text-amber-700 dark:text-amber-400">เกินสิทธิ์ (งดจ่าย)</dt>
              <dd className="font-semibold text-amber-700 dark:text-amber-400 tabular-nums">{fmtDays(-annualLeft)} วัน</dd>
            </div>
          )}
        </dl>
        {annualThisYear === 0 && newHireNote && (
          <p className="mt-2 text-xs text-gray-500 dark:text-gray-400 leading-relaxed">{newHireNote}</p>
        )}
      </div>

      {/* ประเภทอื่น — ใช้ไป / สิทธิ์ + คงเหลือ */}
      <ul className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-2">
        {rows === null
          ? Array.from({ length: 6 }, (_, i) => <li key={i}><Skeleton className="h-[76px] rounded-xl" /></li>)
          : otherRows.map((r) => <TypeTile key={r.id ?? r.name} row={r} />)}
      </ul>
      {error && <p className="mt-2 text-sm text-red-600 dark:text-red-400">โหลดสิทธิ์การลาแต่ละประเภทไม่สำเร็จ ลองเปิดหน้านี้ใหม่</p>}
    </div>
  )
}
