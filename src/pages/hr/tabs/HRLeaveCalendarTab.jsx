// src/pages/hr/tabs/HRLeaveCalendarTab.jsx
// ปฏิทินการลาแยกตามสาขา (3H, TOR §2.2) — ดูทีเดียวว่าสาขาไหนขาดกี่คนในวันไหน และใครลาประเภทอะไร
// เปิดจาก /hr/dashboard?tab=leave-calendar และ /hr/leave-calendar (HRLeaveCalendar.jsx)
//
// ข้อมูล: GET /hr/leave-calendar/days (PR 42, merged 2026-10-23) → 404/405 fallback GET /hr/leave-calendar + /hr/holidays
// (ดู src/lib/leaveCalendar.js). แสดงเฉพาะใบลาที่อนุมัติแล้ว. ใบลาหลายวันแสดงทุกวันในช่วง รวมเสาร์-อาทิตย์
// → วันไม่ทำงานทำสีจาง แต่ไม่ซ่อนคน
//
// สาขา: backend จำกัดตามตำแหน่งเอง (หัวหน้าสาขาเห็นเฉพาะสาขาที่ดูแล). ผู้ที่เลือกสาขาอื่นไม่ได้
// (`canPickAnyBranch()` = false) → รายการสาขาใน dropdown มาจาก GET /auth/my-branches ตาม handoff
//
// Desktop: ตารางเดือน จ.–อา. (ลูกศรเลื่อนวันได้) · มือถือ: DataList เฉพาะวันที่มีคนลา/วันหยุด
// กดวัน → Sheet รายชื่อคนลาแยกสาขา → กดชื่อ = โปรไฟล์ (drill.js) · "ใบลา #id" = เปิดใบลา PDF ของใบลานั้น
// (ระบบยังไม่มีหน้ารายละเอียดใบลารายใบ — ใบลา PDF คือมุมมองรายใบเดียวที่มี เหมือนแท็บคำขอลา)
import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { CalendarDays, ChevronLeft, ChevronRight, FileText, Loader2 } from "lucide-react"
import { canPickAnyBranch, can } from "../../../lib/permissions"
import { apiDownload } from "../../../lib/api"
import { saveBlob } from "../../../lib/files"
import { useDrill } from "../../../lib/drill"
import { cx, iconBtnCls, neutralBtnCls } from "../../../lib/styles"
import { useIsPhone } from "../../../hooks/useMediaQuery"
import SelectDropdown from "../../../components/SelectDropdown"
import { Badge, DataList, EmptyState, ErrorState, Sheet, Skeleton, toast } from "../../../components/ui"
import {
  WEEKDAY_SHORT,
  WEEKDAY_LONG,
  fetchLeaveCalendar,
  fetchMyBranches,
  filterDays,
  fmtDayLongTH,
  fmtDayShortTH,
  fmtMonthTH,
  fmtTime,
  leaveTypeDotCls,
  leaveTypeSummary,
  monthRange,
  parseISO,
  pressureLevel,
  todayISO,
} from "../../../lib/leaveCalendar"

const ALL = "all"

// ชิปจำนวนคนลา — ไล่สีตามระดับ (ดู pressureLevel)
const PRESSURE_CHIP = [
  "",
  "bg-gray-100 text-gray-700 dark:bg-white/[.07] dark:text-gray-200",
  "bg-amber-100 text-amber-800 dark:bg-amber-500/15 dark:text-amber-200",
  "bg-red-100 text-red-700 dark:bg-red-500/20 dark:text-red-200",
]

function countText(onLeave, headcount) {
  return headcount ? `${onLeave}/${headcount}` : String(onLeave)
}

function shortageText(b) {
  return b.headcount ? `ขาด ${b.onLeave} จาก ${b.headcount} คน` : `ลา ${b.onLeave} คน`
}

function dayAriaLabel(day) {
  const parts = [fmtDayLongTH(day.date)]
  if (day.holiday) parts.push(day.holiday.name)
  else if (day.isWeekend) parts.push("วันหยุดเสาร์-อาทิตย์")
  parts.push(day.onLeave ? `ลา ${day.onLeave} คน` : "ไม่มีคนลา")
  return parts.join(" · ")
}

/* ───────────────────────── small pieces ───────────────────────── */

function TypeDot({ type, halfDay, className = "" }) {
  return <span aria-hidden="true" className={cx("inline-block size-2.5 shrink-0 rounded-full", leaveTypeDotCls(type, halfDay), className)} />
}

function MonthNav({ year, month0, onShift, onToday, isCurrent }) {
  return (
    <div className="flex items-center gap-1">
      <button type="button" className={iconBtnCls} onClick={() => onShift(-1)} aria-label="เดือนก่อนหน้า">
        <ChevronLeft className="size-5" aria-hidden="true" />
      </button>
      <h2 className="min-w-[9.5rem] text-center text-base font-semibold text-gray-900 dark:text-gray-100 tabular-nums" aria-live="polite">
        {fmtMonthTH(year, month0)}
      </h2>
      <button type="button" className={iconBtnCls} onClick={() => onShift(1)} aria-label="เดือนถัดไป">
        <ChevronRight className="size-5" aria-hidden="true" />
      </button>
      {!isCurrent && (
        <button type="button" className={cx(neutralBtnCls, "ml-1 !h-11 md:!h-9 !px-3")} onClick={onToday}>
          เดือนนี้
        </button>
      )}
    </div>
  )
}

function Legend({ types, hasHeadcount }) {
  return (
    <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-xs text-gray-600 dark:text-gray-300">
      {types.length > 0 && (
        <ul className="flex flex-wrap items-center gap-x-3 gap-y-1.5" aria-label="ประเภทการลาในเดือนนี้">
          {types.map((t) => (
            <li key={t.type} className="inline-flex items-center gap-1.5">
              <TypeDot type={t.type} />
              <span>{t.type}</span>
              <span className="tabular-nums text-gray-500 dark:text-gray-400">{t.personDays}</span>
            </li>
          ))}
        </ul>
      )}
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
        <span className="inline-flex items-center gap-1.5">
          <span aria-hidden="true" className="inline-block size-2.5 rounded-full ring-2 ring-inset ring-gray-400 dark:ring-gray-500" />
          ครึ่งวัน
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span aria-hidden="true" className="inline-block h-3 w-4 rounded-sm bg-gray-100 ring-1 ring-inset ring-gray-200 dark:bg-white/[.03] dark:ring-line" />
          วันหยุด / เสาร์-อาทิตย์
        </span>
        <span className="inline-flex items-center gap-1" title={hasHeadcount ? "สัดส่วนคนลาเทียบจำนวนพนักงานของสาขา" : "จำนวนคนลาในสาขา"}>
          {[1, 2, 3].map((lv) => (
            <span key={lv} className={cx("rounded px-1.5 py-px tabular-nums font-medium", PRESSURE_CHIP[lv])}>
              {hasHeadcount ? ["", "<15%", "15–29%", "≥30%"][lv] : ["", "1", "2", "3+"][lv]}
            </span>
          ))}
          <span className="ml-0.5">{hasHeadcount ? "ของพนักงานสาขา" : "คนลาต่อสาขา"}</span>
        </span>
      </div>
    </div>
  )
}

/* ───────────────────────── month grid (desktop) ───────────────────────── */

const MAX_BRANCH_ROWS = 3
const MAX_DOTS = 10

function DayCellBody({ day, singleBranch }) {
  if (!day.onLeave) return null
  if (singleBranch) {
    const b = day.branches[0]
    if (!b) return null
    const lv = pressureLevel(b.onLeave, b.headcount)
    const people = b.people.slice(0, MAX_DOTS)
    return (
      <div className="mt-1.5 space-y-1.5">
        <span className={cx("inline-flex items-baseline gap-1 rounded-md px-1.5 py-0.5 text-xs font-semibold", PRESSURE_CHIP[lv])}>
          <span>ลา</span>
          <span className="tabular-nums">{countText(b.onLeave, b.headcount)}</span>
        </span>
        <div className="flex flex-wrap gap-1" aria-hidden="true">
          {people.map((p) => <TypeDot key={p.key} type={p.leaveType} halfDay={p.halfDay} />)}
          {b.people.length > MAX_DOTS && (
            <span className="text-[11px] leading-none text-gray-500 dark:text-gray-400 tabular-nums">+{b.people.length - MAX_DOTS}</span>
          )}
        </div>
      </div>
    )
  }
  const rows = [...day.branches].sort(
    (a, b) => pressureLevel(b.onLeave, b.headcount) - pressureLevel(a.onLeave, a.headcount) || b.onLeave - a.onLeave,
  )
  const shown = rows.slice(0, MAX_BRANCH_ROWS)
  return (
    <ul className="mt-1.5 space-y-0.5">
      {shown.map((b) => (
        <li key={b.id ?? b.name} className="flex items-center justify-between gap-1.5 text-xs">
          <span className="min-w-0 truncate text-gray-600 dark:text-gray-300">{b.name}</span>
          <span className={cx("shrink-0 rounded px-1.5 py-px font-semibold tabular-nums", PRESSURE_CHIP[pressureLevel(b.onLeave, b.headcount)])}>
            {countText(b.onLeave, b.headcount)}
          </span>
        </li>
      ))}
      {rows.length > MAX_BRANCH_ROWS && (
        <li className="text-[11px] text-gray-500 dark:text-gray-400">อีก <span className="tabular-nums">{rows.length - MAX_BRANCH_ROWS}</span> สาขา</li>
      )}
    </ul>
  )
}

function MonthGrid({ year, month0, days, singleBranch, onOpen }) {
  const today = todayISO()
  const byDate = useMemo(() => new Map(days.map((d) => [d.date, d])), [days])
  const lastDate = new Date(year, month0 + 1, 0).getDate()
  const lead = (new Date(year, month0, 1).getDay() + 6) % 7

  const weeks = useMemo(() => {
    const cells = [...Array(lead).fill(null), ...days]
    while (cells.length % 7) cells.push(null)
    const out = []
    for (let i = 0; i < cells.length; i += 7) out.push(cells.slice(i, i + 7))
    return out
  }, [days, lead])

  // roving tabindex: ลูกศร/Home/End เลื่อนวัน, Enter/Space เปิด
  const initialFocus = byDate.has(today) ? today : days[0]?.date
  const [focusDate, setFocusDate] = useState(initialFocus)
  const activeFocus = byDate.has(focusDate) ? focusDate : initialFocus
  const refs = useRef(new Map())

  const onKeyDown = (e, day) => {
    const d = parseISO(day.date).getDate()
    const wd = day.weekday
    const map = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -7, ArrowDown: 7, Home: -wd, End: 6 - wd }
    if (!(e.key in map)) return
    e.preventDefault()
    const next = Math.min(lastDate, Math.max(1, d + map[e.key]))
    const iso = days[next - 1]?.date
    if (!iso) return
    setFocusDate(iso)
    refs.current.get(iso)?.focus()
  }

  return (
    <div className="overflow-x-auto rounded-xl ring-1 ring-gray-200/70 dark:ring-line">
      <table className="w-full min-w-[760px] table-fixed border-collapse">
        <caption className="sr-only">ปฏิทินการลา {fmtMonthTH(year, month0)} — กดวันที่เพื่อดูรายชื่อ ใช้ลูกศรเลื่อนวัน</caption>
        <thead>
          <tr className="bg-gray-50 dark:bg-white/[.03]">
            {WEEKDAY_SHORT.map((w, i) => (
              <th key={w} scope="col" className={cx("px-2 py-2 text-left text-xs font-semibold", i >= 5 ? "text-gray-500 dark:text-gray-400" : "text-gray-700 dark:text-gray-300")}>
                <abbr title={WEEKDAY_LONG[i]} className="no-underline">{w}</abbr>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {weeks.map((week, wi) => (
            <tr key={wi}>
              {week.map((day, di) => {
                if (!day) return <td key={`pad-${di}`} className="border-t border-gray-100 bg-gray-50/40 dark:border-line dark:bg-transparent" />
                const isToday = day.date === today
                const muted = !day.isWorkingDay
                return (
                  <td key={day.date} className={cx("h-28 border-t border-l border-gray-100 p-0 align-top first:border-l-0 dark:border-line", muted && "bg-gray-50 dark:bg-white/[.025]")}>
                    <button
                      type="button"
                      ref={(el) => { if (el) refs.current.set(day.date, el); else refs.current.delete(day.date) }}
                      tabIndex={day.date === activeFocus ? 0 : -1}
                      onFocus={() => setFocusDate(day.date)}
                      onKeyDown={(e) => onKeyDown(e, day)}
                      onClick={() => onOpen(day)}
                      aria-label={dayAriaLabel(day)}
                      className="group flex h-full w-full flex-col items-stretch px-2 py-1.5 text-left cursor-pointer transition-colors duration-150 hover:bg-indigo-50/60 dark:hover:bg-indigo-500/[.07] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-indigo-500"
                    >
                      <span className="flex items-start justify-between gap-1">
                        <span
                          className={cx(
                            "inline-flex size-6 items-center justify-center rounded-full text-xs font-semibold tabular-nums",
                            isToday ? "bg-indigo-600 text-white dark:bg-indigo-500" : muted ? "text-gray-500 dark:text-gray-400" : "text-gray-800 dark:text-gray-100",
                          )}
                        >
                          {parseISO(day.date).getDate()}
                        </span>
                        {day.holiday && (
                          <span title={day.holiday.name} className="mt-0.5 min-w-0 truncate text-[11px] font-medium text-rose-700 dark:text-rose-300">
                            {day.holiday.name}
                          </span>
                        )}
                      </span>
                      <DayCellBody day={day} singleBranch={singleBranch} />
                    </button>
                  </td>
                )
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function GridSkeleton() {
  return (
    <div className="overflow-hidden rounded-xl ring-1 ring-gray-200/70 dark:ring-line" aria-busy="true" aria-label="กำลังโหลดปฏิทิน">
      <div className="grid grid-cols-7 gap-px bg-gray-100 dark:bg-line">
        {Array.from({ length: 35 }, (_, i) => (
          <div key={i} className="h-28 bg-white p-2 dark:bg-surface">
            <Skeleton className="h-4 w-6" rounded="rounded-md" />
            {i % 3 === 0 && <Skeleton className="mt-3 h-3 w-3/4" rounded="rounded" />}
          </div>
        ))}
      </div>
    </div>
  )
}

/* ───────────────────────── day sheet ───────────────────────── */

const linkCls =
  "rounded text-left cursor-pointer hover:text-indigo-700 hover:underline dark:hover:text-indigo-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"

function PersonRow({ p, onOpenProfile }) {
  const [busy, setBusy] = useState(false)
  const time = p.halfDay && (p.fromTime || p.toTime) ? `${fmtTime(p.fromTime) || "—"}–${fmtTime(p.toTime) || "—"} น.` : ""
  const span = p.fromDate && p.toDate && p.fromDate !== p.toDate ? `${fmtDayShortTH(p.fromDate)} – ${fmtDayShortTH(p.toDate)}` : ""
  const canProfile = p.employeeId != null && onOpenProfile && can("hr.employees.view")
  const canPdf = p.leaveId != null && p.employeeId != null && can("hr.leave.list")

  const openLeave = async () => {
    if (busy) return
    setBusy(true)
    try {
      const { blob, filename } = await apiDownload(`/hr/employees/${p.employeeId}/leaves/${p.leaveId}/pdf`)
      saveBlob(blob, filename && filename !== "download" ? filename : `leave_${p.leaveId}.pdf`)
    } catch (e) {
      toast.error("เปิดใบลาไม่สำเร็จ", { description: e?.message || "ลองใหม่อีกครั้ง" })
    } finally {
      setBusy(false)
    }
  }

  return (
    <li className="flex items-start gap-3 py-2.5">
      <TypeDot type={p.leaveType} halfDay={p.halfDay} className="mt-1.5" />
      <div className="min-w-0 flex-1">
        {canProfile ? (
          <button type="button" onClick={() => onOpenProfile(p.employeeId)} className={cx(linkCls, "-my-3 block max-w-full truncate py-3 text-sm font-medium text-gray-900 dark:text-gray-100 md:my-0 md:py-0")}>
            {p.name}
          </button>
        ) : (
          <p className="truncate text-sm font-medium text-gray-900 dark:text-gray-100">{p.name}</p>
        )}
        <p className="text-xs text-gray-500 dark:text-gray-400">
          {p.leaveType}
          {p.halfDay && <> · ครึ่งวัน{time && <span className="tabular-nums"> {time}</span>}</>}
          {span && <> · <span className="tabular-nums">{span}</span></>}
        </p>
      </div>
      {p.leaveId != null && (canPdf ? (
        <button
          type="button"
          onClick={openLeave}
          disabled={busy}
          aria-label={`เปิดใบลา #${p.leaveId} ของ ${p.name}`}
          className={cx(linkCls, "inline-flex min-h-11 shrink-0 items-center gap-1 px-1 text-xs tabular-nums text-gray-600 dark:text-gray-300 md:min-h-0 md:pt-0.5 disabled:cursor-wait")}
        >
          {busy ? <Loader2 aria-hidden="true" className="size-3.5 animate-spin" /> : <FileText aria-hidden="true" className="size-3.5" strokeWidth={1.75} />}
          ใบลา #{p.leaveId}
        </button>
      ) : (
        <span className="shrink-0 pt-0.5 text-xs tabular-nums text-gray-500 dark:text-gray-400">ใบลา #{p.leaveId}</span>
      ))}
    </li>
  )
}

function DaySheet({ day, onClose, onOpenProfile }) {
  const subtitle = day
    ? [day.holiday?.name || (day.isWeekend ? "วันหยุดเสาร์-อาทิตย์" : null), day.onLeave ? `ลา ${day.onLeave} คน` : "ไม่มีคนลา"].filter(Boolean).join(" · ")
    : ""
  const branches = day ? [...day.branches].sort((a, b) => b.onLeave - a.onLeave || a.name.localeCompare(b.name, "th")) : []
  return (
    <Sheet open={Boolean(day)} onClose={onClose} title={day ? fmtDayLongTH(day.date) : ""} subtitle={subtitle} size="md" initialFocus={null}>
      {day && (branches.length === 0 ? (
        <EmptyState title="ไม่มีใครลาในวันนี้" description="แสดงเฉพาะใบลาที่อนุมัติแล้ว" className="!py-10" />
      ) : (
        <div className="space-y-5">
          {branches.map((b) => (
            <section key={b.id ?? b.name} aria-label={b.name}>
              <div className="flex items-baseline justify-between gap-3 border-b border-gray-100 pb-1.5 dark:border-line">
                <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">{b.name}</h3>
                <span className={cx("rounded-md px-2 py-0.5 text-xs font-semibold tabular-nums", PRESSURE_CHIP[pressureLevel(b.onLeave, b.headcount)])}>
                  {shortageText(b)}
                </span>
              </div>
              <ul className="divide-y divide-gray-100 dark:divide-line">
                {b.people.map((p) => <PersonRow key={p.key} p={p} onOpenProfile={onOpenProfile} />)}
              </ul>
            </section>
          ))}
        </div>
      ))}
    </Sheet>
  )
}

/* ───────────────────────── page ───────────────────────── */

export default function HRLeaveCalendarTab() {
  const isPhone = useIsPhone()
  const { drillTo } = useDrill()
  const now = new Date()
  const [ym, setYm] = useState({ y: now.getFullYear(), m: now.getMonth() })
  const [branch, setBranch] = useState(ALL)

  const [cal, setCal] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [reloadKey, setReloadKey] = useState(0)
  const [openDay, setOpenDay] = useState(null)

  // หัวหน้าสาขา (scope ไม่ใช่ all) — dropdown จาก /auth/my-branches
  const scoped = !canPickAnyBranch()
  const [myBranches, setMyBranches] = useState([])
  useEffect(() => {
    if (!scoped) return
    let alive = true
    fetchMyBranches().then((b) => { if (alive) setMyBranches(b) }).catch(() => {})
    return () => { alive = false }
  }, [scoped])

  useEffect(() => {
    let alive = true
    const { from, to } = monthRange(ym.y, ym.m)
    setLoading(true)
    setError("")
    fetchLeaveCalendar({ from, to })
      .then((data) => { if (alive) setCal({ ...data, from, to }) })
      .catch((e) => {
        if (!alive) return
        setCal(null)
        setError(e?.status === 403 ? e.message || "ท่านไม่มีสิทธิ์ดูปฏิทินการลา" : e?.message || "โหลดปฏิทินการลาไม่สำเร็จ")
      })
      .finally(() => { if (alive) setLoading(false) })
    return () => { alive = false }
  }, [ym, reloadKey])

  const shiftMonth = useCallback((delta) => {
    setYm(({ y, m }) => {
      const d = new Date(y, m + delta, 1)
      return { y: d.getFullYear(), m: d.getMonth() }
    })
  }, [])
  const goToday = () => { const d = new Date(); setYm({ y: d.getFullYear(), m: d.getMonth() }) }
  const isCurrent = ym.y === now.getFullYear() && ym.m === now.getMonth()

  // ตัวเลือกสาขา = สาขาที่ backend ส่งมา (อยู่ในขอบเขตแล้ว) ∪ my-branches
  const branchOptions = useMemo(() => {
    const m = new Map()
    const add = (id, name) => { if (id != null && !m.has(id)) m.set(id, name) }
    myBranches.forEach((b) => add(b.id, b.name))
    cal?.branches.forEach((b) => add(b.id, b.name))
    cal?.days.forEach((d) => d.branches.forEach((b) => add(b.id, b.name)))
    return [...m.entries()].map(([id, name]) => ({ value: String(id), label: name })).sort((a, b) => a.label.localeCompare(b.label, "th"))
  }, [cal, myBranches])

  // ข้อมูลของเดือนอื่นที่ค้างอยู่ระหว่างโหลด ไม่เอามาวาดบนตารางเดือนใหม่
  const monthFrom = monthRange(ym.y, ym.m).from
  const current = cal && cal.from === monthFrom ? cal : null

  const onlyOneBranch = branchOptions.length === 1
  const branchId = onlyOneBranch ? Number(branchOptions[0].value) : branch === ALL ? null : Number(branch)
  const singleBranch = branchId != null

  const days = useMemo(() => filterDays(current?.days ?? [], branchId), [current, branchId])
  const types = useMemo(() => leaveTypeSummary(days), [days])
  const hasHeadcount = Boolean(current?.branches.some((b) => b.headcount))

  const summary = useMemo(() => {
    const people = new Set()
    let peak = null
    for (const d of days) {
      for (const b of d.branches) for (const p of b.people) people.add(p.employeeId ?? p.name)
      if (d.onLeave && (!peak || d.onLeave > peak.onLeave)) peak = d
    }
    return { people: people.size, peak }
  }, [days])

  const phoneDays = useMemo(() => days.filter((d) => d.onLeave > 0 || d.holiday), [days])
  const selectedBranchName = singleBranch ? branchOptions.find((o) => Number(o.value) === branchId)?.label : null

  return (
    <div className="space-y-4">
      {/* toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <MonthNav year={ym.y} month0={ym.m} onShift={shiftMonth} onToday={goToday} isCurrent={isCurrent} />
        <div className="flex w-full items-center gap-2 sm:w-auto">
          {onlyOneBranch ? (
            <p className="text-sm text-gray-600 dark:text-gray-300">
              สาขา <span className="font-medium text-gray-900 dark:text-gray-100">{branchOptions[0].label}</span>
            </p>
          ) : (
            <>
            <label htmlFor="leave-cal-branch" className="shrink-0 text-sm text-gray-600 dark:text-gray-300">สาขา</label>
            <div className="min-w-0 flex-1 sm:w-64 sm:flex-none">
              <SelectDropdown
                id="leave-cal-branch"
                size="sm"
                options={[{ value: ALL, label: scoped ? "ทุกสาขาที่ดูแล" : "ทุกสาขา" }, ...branchOptions]}
                value={branch}
                onChange={setBranch}
                searchable={branchOptions.length > 8}
                showSwatch={false}
                loading={loading && !cal}
              />
            </div>
            </>
          )}
        </div>
      </div>

      {current?.source === "list" && !error && (
        <p role="note" className="rounded-lg bg-gray-50 px-3 py-2 text-xs text-gray-600 dark:bg-white/[.04] dark:text-gray-300">
          แสดงจากรายการใบลา — ระบบยังไม่ส่งจำนวนพนักงานต่อสาขา จึงแสดงเฉพาะจำนวนคนลา
        </p>
      )}

      {error ? (
        <ErrorState message={error} onRetry={() => setReloadKey((k) => k + 1)} />
      ) : !current ? (
        isPhone ? <div className="space-y-3">{[0, 1, 2].map((i) => <Skeleton key={i} className="h-24" />)}</div> : <GridSkeleton />
      ) : (
        <div className={cx("space-y-3 transition-opacity duration-200", loading && "opacity-60")} aria-busy={loading}>
          <div className="flex flex-col gap-2 lg:flex-row lg:items-center lg:justify-between">
            <p className="text-sm text-gray-600 dark:text-gray-300">
              {summary.people ? (
                <>
                  {selectedBranchName ? `${selectedBranchName}: ` : "เดือนนี้ "}มีคนลา <span className="font-semibold tabular-nums text-gray-900 dark:text-gray-100">{summary.people}</span> คน
                  {summary.peak && (
                    <> · ขาดมากสุด <span className="font-semibold text-gray-900 dark:text-gray-100">{fmtDayShortTH(summary.peak.date)}</span> (<span className="tabular-nums">{summary.peak.onLeave}</span> คน)</>
                  )}
                </>
              ) : (
                "ไม่มีใบลาที่อนุมัติแล้วในเดือนนี้"
              )}
            </p>
            <Legend types={types} hasHeadcount={hasHeadcount} />
          </div>

          {isPhone ? (
            <DataList
              items={phoneDays}
              keyOf={(d) => d.date}
              title={(d) => fmtDayLongTH(d.date)}
              subtitle={(d) => d.holiday?.name || (d.isWeekend ? "วันหยุดเสาร์-อาทิตย์" : null)}
              badge={(d) => (d.onLeave ? <Badge tone={d.isWorkingDay ? "info" : "neutral"}>ลา {d.onLeave} คน</Badge> : null)}
              fields={(d) =>
                d.branches.map((b) => ({
                  label: b.name,
                  value: () => (
                    <span className={cx("rounded px-1.5 py-px font-semibold", PRESSURE_CHIP[pressureLevel(b.onLeave, b.headcount)])}>
                      {countText(b.onLeave, b.headcount)}
                    </span>
                  ),
                  align: "right",
                }))
              }
              onClick={(d) => setOpenDay(d)}
              emptyState={<EmptyState icon={<CalendarDays className="size-10" aria-hidden="true" />} title="ไม่มีคนลาในเดือนนี้" description="แสดงเฉพาะใบลาที่อนุมัติแล้ว" />}
            />
          ) : (
            <MonthGrid
              key={`${ym.y}-${ym.m}`}
              year={ym.y}
              month0={ym.m}
              days={days}
              singleBranch={singleBranch}
              onOpen={setOpenDay}
            />
          )}
        </div>
      )}

      <DaySheet day={openDay ? days.find((d) => d.date === openDay.date) ?? openDay : null} onClose={() => setOpenDay(null)}
        onOpenProfile={(id) => { setOpenDay(null); drillTo(`/hr/personnel/${id}`, "ปฏิทินการลา") }}
      />
    </div>
  )
}
