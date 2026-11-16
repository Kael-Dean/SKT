// ทะเบียนการลา — โครงตามแบบฟอร์มกระดาษของสหกรณ์ (ประเภท · สิทธิ์ · ยกมา · ลาแล้ว · คงเหลือ · เกินสิทธิ์ · หลักเกณฑ์)
// ข้อมูล: leave_quota (LeaveQuotaOut — ยกมาเฉพาะลาพักผ่อน) + แถวจาก useLeaveBalance() → { name, quota, used, remaining }
// desktop = ตาราง, มือถือ = การ์ดต่อประเภท (คอลัมน์เกิน 4 → ไม่ทำตารางบนจอแคบ)
import { useState } from "react"
import { ChevronDown, FileText } from "lucide-react"
import { cx } from "../../lib/styles"
import { fmtDays, parseDays } from "../../lib/leaveDays"
import { isAnnualLeave, isPrescribedLeave, leaveCriteria } from "../../lib/leaveTypes"
import { useIsPhone } from "../../hooks/useMediaQuery"
import { Skeleton } from "../ui"

const isAbsence = (name) => String(name ?? "").trim().startsWith("ขาดงาน")

/** แปลงแถวจาก API เป็นตัวเลขของทะเบียน — ลาพักผ่อนใช้สิทธิ์ปีนี้ + ยกมาจาก leave_quota */
function toRegisterRow(row, quota) {
  const used = parseDays(row.used) ?? 0
  const annual = isAnnualLeave(row.name)
  const prescribed = isPrescribedLeave(row.name)
  const absence = isAbsence(row.name)
  const entitled = annual ? parseDays(quota.annual_leave) ?? 0 : parseDays(row.quota)
  const carried = annual ? parseDays(quota.annual_leave_carried_over) ?? 0 : null
  const cap = prescribed || absence ? null : (entitled ?? 0) + (carried ?? 0)
  const capped = cap != null && cap > 0
  return {
    key: row.id ?? row.name,
    name: row.name,
    used,
    entitled,
    carried,
    cap,
    capped,
    prescribed,
    absence,
    remaining: capped ? Math.max(0, cap - used) : null,
    over: cap == null ? 0 : Math.max(0, used - cap),
    criteria: leaveCriteria(row.name),
  }
}

const Dash = () => <span className="text-gray-300 dark:text-gray-600" aria-label="ไม่มี">–</span>

/** ตัวเลขวัน — 0 / ไม่มีค่า แสดงเป็นขีด เพื่อให้แถวที่มีความเคลื่อนไหวเด่นขึ้น */
function Num({ v, tone, strong }) {
  if (v == null || v === 0) return <Dash />
  return (
    <span
      className={cx(
        "tabular-nums",
        strong ? "font-semibold" : "font-medium",
        tone === "warn" ? "text-amber-600 dark:text-amber-400"
          : tone === "danger" ? "text-red-600 dark:text-red-400"
            : tone === "accent" ? "text-indigo-700 dark:text-indigo-300"
              : "text-gray-900 dark:text-gray-100",
      )}
    >
      {fmtDays(v)}
    </span>
  )
}

function UsageBar({ used, cap, className }) {
  if (!cap) return null
  const over = used > cap
  const pct = Math.min(100, (used / cap) * 100)
  return (
    <div
      className={cx("h-1 rounded-full bg-gray-200/80 dark:bg-white/10 overflow-hidden", className)}
      role="progressbar"
      aria-valuemin={0}
      aria-valuemax={cap}
      aria-valuenow={used}
      aria-label={`ใช้ไป ${fmtDays(used)} จาก ${fmtDays(cap)} วัน`}
    >
      <div
        className={cx("h-full rounded-full transition-[width] duration-300", over ? "bg-amber-500" : "bg-indigo-500 dark:bg-indigo-400")}
        style={{ width: `${pct}%` }}
      />
    </div>
  )
}

function CertNote({ cert }) {
  if (!cert) return null
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-gray-100 dark:bg-white/5 px-2 py-0.5 text-[11px] font-medium text-gray-600 dark:text-gray-300">
      <FileText aria-hidden="true" className="size-3" />
      ใบรับรองแพทย์{typeof cert === "string" ? ` (${cert})` : ""}
    </span>
  )
}

function Criteria({ c, className }) {
  if (!c) return <p className={cx("text-xs text-gray-400 dark:text-gray-500", className)}>–</p>
  return (
    <div className={className}>
      <ul className="space-y-0.5 text-xs leading-relaxed text-gray-600 dark:text-gray-400">
        {c.rules.map((r) => (
          <li key={r} className="flex gap-1.5">
            <span aria-hidden="true" className="mt-[0.55em] size-1 shrink-0 rounded-full bg-gray-300 dark:bg-gray-600" />
            <span>{r}</span>
          </li>
        ))}
      </ul>
      {c.cert && <CertNote cert={c.cert} />}
    </div>
  )
}

function entitledCell(r) {
  if (r.prescribed) return <span className="text-xs text-gray-500 dark:text-gray-400">ตามแพทย์สั่ง</span>
  if (r.absence) return <Dash />
  return <Num v={r.entitled} />
}

/* ───────────── desktop: ตาราง ───────────── */

const TH = "px-3 py-2 text-xs font-semibold text-gray-500 dark:text-gray-400 whitespace-nowrap"
const TD = "px-3 py-3 align-top text-sm text-right"

function RegisterTable({ rows, year }) {
  return (
    <div className="overflow-x-auto -mx-5 px-5">
      <table className="w-full min-w-[760px] border-separate border-spacing-0">
        <caption className="sr-only">ทะเบียนการลา ปีงบประมาณ {year} หน่วยเป็นวัน</caption>
        <thead>
          <tr>
            <th rowSpan={2} scope="col" className={cx(TH, "text-left align-bottom border-b border-gray-200 dark:border-line w-[22%]")}>
              ประเภท
            </th>
            <th colSpan={5} scope="colgroup" className={cx(TH, "text-center border-b border-gray-100 dark:border-line font-medium")}>
              <span className="rounded-full bg-indigo-50 dark:bg-indigo-500/10 px-2.5 py-0.5 text-indigo-700 dark:text-indigo-300">
                ประจำปี {year}
              </span>
            </th>
            <th rowSpan={2} scope="col" className={cx(TH, "text-left align-bottom border-b border-gray-200 dark:border-line pl-6")}>
              หลักเกณฑ์
            </th>
          </tr>
          <tr>
            {["สิทธิ์", "ยกมา", "ลาแล้ว", "คงเหลือ", "เกินสิทธิ์ (งดจ่าย)"].map((h) => (
              <th key={h} scope="col" className={cx(TH, "text-right border-b border-gray-200 dark:border-line")}>
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => {
            const touched = r.used > 0
            return (
              <tr key={r.key} className="group transition-colors duration-200 hover:bg-gray-50/80 dark:hover:bg-white/[0.03]">
                <th scope="row" className="px-3 py-3 align-top text-left border-b border-gray-100 dark:border-line">
                  <span className={cx("text-sm", touched ? "font-semibold text-gray-900 dark:text-gray-100" : "font-medium text-gray-700 dark:text-gray-300")}>
                    {r.name}
                  </span>
                </th>
                <td className={cx(TD, "border-b border-gray-100 dark:border-line")}>{entitledCell(r)}</td>
                <td className={cx(TD, "border-b border-gray-100 dark:border-line")}><Num v={r.carried} /></td>
                <td className={cx(TD, "border-b border-gray-100 dark:border-line")}>
                  <Num v={r.used} strong tone={r.absence ? "danger" : undefined} />
                  {r.capped && touched && <UsageBar used={r.used} cap={r.cap} className="mt-1.5 ml-auto w-12" />}
                </td>
                <td className={cx(TD, "border-b border-gray-100 dark:border-line")}>
                  {r.capped ? <Num v={r.remaining} strong tone="accent" /> : <Dash />}
                </td>
                <td className={cx(TD, "border-b border-gray-100 dark:border-line")}><Num v={r.over} tone="warn" /></td>
                <td className="pl-6 pr-3 py-3 align-top border-b border-gray-100 dark:border-line min-w-[240px]">
                  <Criteria c={r.criteria} className="space-y-1.5" />
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

/* ───────────── มือถือ: การ์ดต่อประเภท ───────────── */

function RegisterCard({ r }) {
  const [open, setOpen] = useState(false)
  const touched = r.used > 0
  const cells = [
    ["สิทธิ์", entitledCell(r)],
    ["ยกมา", <Num key="c" v={r.carried} />],
    ["คงเหลือ", r.capped ? <Num key="r" v={r.remaining} strong tone="accent" /> : <Dash key="r" />],
    ["เกินสิทธิ์", <Num key="o" v={r.over} tone="warn" />],
  ]
  return (
    <li className={cx("rounded-xl p-3.5 ring-1", touched ? "bg-white dark:bg-raised ring-gray-200 dark:ring-line-strong" : "bg-gray-50 dark:bg-white/[0.03] ring-transparent")}>
      <div className="flex items-baseline justify-between gap-3">
        <p className={cx("min-w-0 truncate text-sm", touched ? "font-semibold text-gray-900 dark:text-gray-100" : "font-medium text-gray-700 dark:text-gray-300")}>
          {r.name}
        </p>
        <p className="shrink-0 text-xs text-gray-500 dark:text-gray-400">
          ลาแล้ว <Num v={r.used} strong tone={r.absence ? "danger" : undefined} />
          {r.capped && <span className="tabular-nums"> / {fmtDays(r.cap)}</span>} วัน
        </p>
      </div>
      {r.capped && <UsageBar used={r.used} cap={r.cap} className="mt-2" />}
      <dl className="mt-3 grid grid-cols-4 gap-2">
        {cells.map(([label, value]) => (
          <div key={label} className="min-w-0">
            <dt className="text-[11px] leading-tight text-gray-500 dark:text-gray-400">{label}</dt>
            <dd className="mt-0.5 text-sm">{value}</dd>
          </div>
        ))}
      </dl>
      {r.criteria && (
        <>
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            aria-expanded={open}
            className="mt-1 -mb-2 -mx-1 inline-flex min-h-touch items-center gap-1 rounded px-1 text-xs font-medium text-indigo-700 dark:text-indigo-300 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
          >
            หลักเกณฑ์
            <ChevronDown aria-hidden="true" className={cx("size-3.5 transition-transform duration-200", open && "rotate-180")} />
          </button>
          {open && <Criteria c={r.criteria} className="space-y-1.5 border-t border-gray-100 dark:border-line pt-2" />}
        </>
      )}
    </li>
  )
}

/* ───────────── ตัวหลัก ───────────── */

/**
 * @param {object}  quota  leave_quota — { year, annual_leave, annual_leave_carried_over }
 * @param {object[]|null} rows  แถวจาก useLeaveBalance (null = กำลังโหลด)
 * @param {string}  error
 * @param {string}  [newHireNote]  ข้อความเมื่อสิทธิ์ลาพักผ่อนปีนี้ = 0
 */
export default function LeaveRegisterTable({ quota, rows, error, newHireNote }) {
  const isPhone = useIsPhone()
  const reg = (rows ?? []).map((r) => toRegisterRow(r, quota))

  const totalUsed = reg.filter((r) => !r.absence).reduce((s, r) => s + r.used, 0)
  const absenceDays = reg.filter((r) => r.absence).reduce((s, r) => s + r.used, 0)
  const overDays = reg.reduce((s, r) => s + r.over, 0)
  const annualThisYear = parseDays(quota.annual_leave) ?? 0

  const summary = [
    { label: "ลาแล้วทั้งปี", value: totalUsed },
    { label: "ขาดงาน", value: absenceDays, tone: absenceDays > 0 ? "danger" : undefined },
    { label: "เกินสิทธิ์ (งดจ่าย)", value: overDays, tone: overDays > 0 ? "warn" : undefined },
  ]

  return (
    <div>
      {rows === null ? (
        <div className="space-y-2" aria-busy="true" aria-label="กำลังโหลดทะเบียนการลา">
          <Skeleton className="h-10 rounded-xl" />
          {Array.from({ length: 5 }, (_, i) => <Skeleton key={i} className="h-12 rounded-xl" />)}
        </div>
      ) : reg.length === 0 ? (
        <p className="text-sm text-gray-500 dark:text-gray-400">ยังไม่มีประเภทการลาในปีงบประมาณนี้</p>
      ) : (
        <>
          <dl className="mb-4 flex flex-wrap gap-x-8 gap-y-2">
            {summary.map((s) => (
              <div key={s.label} className="flex items-baseline gap-2">
                <dt className="text-xs text-gray-500 dark:text-gray-400">{s.label}</dt>
                <dd className="text-sm">
                  <span
                    className={cx(
                      "text-lg font-bold tabular-nums",
                      s.tone === "warn" ? "text-amber-600 dark:text-amber-400"
                        : s.tone === "danger" ? "text-red-600 dark:text-red-400"
                          : "text-gray-900 dark:text-gray-100",
                    )}
                  >
                    {fmtDays(s.value)}
                  </span>
                  <span className="ml-1 text-xs text-gray-500 dark:text-gray-400">วัน</span>
                </dd>
              </div>
            ))}
          </dl>

          {isPhone ? (
            <ul className="space-y-2">
              {reg.map((r) => <RegisterCard key={r.key} r={r} />)}
            </ul>
          ) : (
            <RegisterTable rows={reg} year={quota.year} />
          )}
        </>
      )}

      {annualThisYear === 0 && newHireNote && rows !== null && (
        <p className="mt-3 text-xs text-gray-500 dark:text-gray-400 leading-relaxed">{newHireNote}</p>
      )}
      {error && <p className="mt-2 text-sm text-red-600 dark:text-red-400">โหลดทะเบียนการลาไม่สำเร็จ ลองเปิดหน้านี้ใหม่</p>}
    </div>
  )
}
