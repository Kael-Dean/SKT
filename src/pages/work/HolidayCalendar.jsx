// src/pages/work/HolidayCalendar.jsx
// ปฏิทินสหกรณ์ — อ่านอย่างเดียว สำหรับทุกคนที่ล็อกอิน (`hr.holidays.view`, GET /hr/holidays?fiscal_year=)
// มุมมองปฏิทินรายเดือน + รายการวันหยุดทั้งปีงบ (เม.ย.–มี.ค.) · ฝ่ายบุคคลประกาศ/แก้ไขที่ HR Dashboard → ปฏิทินวันหยุด
//
// วันประชุม: backend ยังไม่มี endpoint ปฏิทินกิจกรรมของสหกรณ์ (ดู handoff/backend-request-company-calendar.md)
// โครง `events` ในไฟล์นี้รองรับ kind อื่นไว้แล้ว — เมื่อมี API ให้ map เข้า eventsByDate ได้เลย
import { useCallback, useEffect, useMemo, useState } from "react"
import { Link } from "react-router-dom"
import { ChevronLeft, ChevronRight, Settings2 } from "lucide-react"
import { apiAuth } from "../../lib/api"
import { currentFiscalYearBE } from "../../lib/leaveDays"
import { backState } from "../../lib/drill"
import { cx, cardCls, iconBtnCls, neutralBtnCls, focusRingCls } from "../../lib/styles"
import Can from "../../components/Can"
import PageTitle from "../../components/PageTitle"
import { ErrorState, Skeleton } from "../../components/ui"

const WEEKDAYS = ["อา.", "จ.", "อ.", "พ.", "พฤ.", "ศ.", "ส."]

/** สีต่อประเภท — วันหยุดใช้แดงตามธรรมเนียมปฏิทินไทย, วันหยุดพิเศษใช้อำพัน */
const KIND = {
  annual: {
    label: "วันหยุดประจำปี",
    cell: "bg-red-50/80 dark:bg-red-500/[.09]",
    num: "text-red-600 dark:text-red-300",
    name: "text-red-700 dark:text-red-200",
    dot: "bg-red-500 dark:bg-red-400",
  },
  special: {
    label: "วันหยุดพิเศษ",
    cell: "bg-amber-50/90 dark:bg-amber-500/[.09]",
    num: "text-amber-600 dark:text-amber-300",
    name: "text-amber-800 dark:text-amber-200",
    dot: "bg-amber-500 dark:bg-amber-400",
  },
}
const kindOf = (e) => KIND[e.kind] || KIND.annual

const pad = (n) => String(n).padStart(2, "0")
const toIso = (y, m, d) => `${y}-${pad(m + 1)}-${pad(d)}`
const parseIso = (s) => new Date(`${s}T00:00:00`)
const todayIso = () => { const t = new Date(); return toIso(t.getFullYear(), t.getMonth(), t.getDate()) }
/** ปีงบ พ.ศ. ที่เดือนนั้นอยู่ (เม.ย. = เดือน index 3 เริ่มปีงบใหม่) */
const fyOf = (y, m) => (m >= 3 ? y : y - 1) + 543
const th = (iso, opts) => parseIso(iso).toLocaleDateString("th-TH", opts)
const daysBetween = (a, b) => Math.round((parseIso(b) - parseIso(a)) / 86400000)

function countdown(n) {
  if (n === 0) return "วันนี้"
  if (n === 1) return "พรุ่งนี้"
  return `อีก ${n.toLocaleString("th-TH")} วัน`
}

export default function HolidayCalendar() {
  const now = new Date()
  const today = todayIso()
  const [cursor, setCursor] = useState({ y: now.getFullYear(), m: now.getMonth() })
  const [selected, setSelected] = useState(today)
  const [byFy, setByFy] = useState({}) // { [fy]: Holiday[] }
  const [failed, setFailed] = useState({}) // { [fy]: message }

  const viewFy = fyOf(cursor.y, cursor.m)
  const thisFy = currentFiscalYearBE()

  const load = useCallback((fy) => {
    apiAuth(`/hr/holidays?fiscal_year=${fy}`)
      .then((d) => {
        setByFy((s) => ({ ...s, [fy]: Array.isArray(d) ? d : [] }))
        setFailed((s) => { const n = { ...s }; delete n[fy]; return n })
      })
      .catch((e) => setFailed((s) => ({ ...s, [fy]: e.message || "โหลดปฏิทินไม่สำเร็จ" })))
  }, [])

  // ปีงบที่กำลังดู + ปีนี้ + ปีหน้า (หา "วันหยุดถัดไป" ข้ามปีงบได้)
  useEffect(() => {
    for (const fy of new Set([viewFy, thisFy, thisFy + 1])) {
      if (!(fy in byFy)) load(fy)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [viewFy, thisFy, load])

  /** event กลาง: { date, title, kind, note } — วันหยุดเป็นแหล่งเดียวตอนนี้ */
  const events = useMemo(() => {
    const out = []
    for (const list of Object.values(byFy)) {
      for (const h of list) {
        if (h.is_active === false || !h.holiday_date) continue
        out.push({ id: `h${h.id}`, date: h.holiday_date, title: h.name, kind: h.holiday_type === "special" ? "special" : "annual", note: h.note })
      }
    }
    return out.sort((a, b) => a.date.localeCompare(b.date))
  }, [byFy])

  const eventsByDate = useMemo(() => {
    const m = new Map()
    for (const e of events) m.set(e.date, [...(m.get(e.date) || []), e])
    return m
  }, [events])

  const nextEvent = useMemo(() => events.find((e) => e.date >= today), [events, today])
  const yearList = useMemo(() => events.filter((e) => fyOf(parseIso(e.date).getFullYear(), parseIso(e.date).getMonth()) === viewFy), [events, viewFy])

  const viewLoading = !(viewFy in byFy) && !failed[viewFy]
  const viewError = failed[viewFy]

  const shiftMonth = (delta) => setCursor(({ y, m }) => {
    const d = new Date(y, m + delta, 1)
    return { y: d.getFullYear(), m: d.getMonth() }
  })
  const jumpTo = (iso) => {
    const d = parseIso(iso)
    setCursor({ y: d.getFullYear(), m: d.getMonth() })
    setSelected(iso)
  }

  // ── ตารางเดือน ──
  const first = new Date(cursor.y, cursor.m, 1).getDay()
  const daysInMonth = new Date(cursor.y, cursor.m + 1, 0).getDate()
  const cells = [...Array(first).fill(null), ...Array.from({ length: daysInMonth }, (_, i) => i + 1)]
  while (cells.length % 7) cells.push(null)
  const monthLabel = new Date(cursor.y, cursor.m, 1).toLocaleDateString("th-TH", { month: "long", year: "numeric" })
  const monthPrefix = `${cursor.y}-${pad(cursor.m + 1)}-`
  const monthCount = events.filter((e) => e.date.startsWith(monthPrefix)).length
  const isCurrentMonth = cursor.y === now.getFullYear() && cursor.m === now.getMonth()

  const selectedEvents = eventsByDate.get(selected) || []
  const selectedDow = parseIso(selected).getDay()

  return (
    <div className="pb-10">
      <PageTitle title="ปฏิทินวันหยุด" />

      {/* วันหยุดถัดไป — สิ่งที่คนเปิดหน้านี้อยากรู้ก่อน */}
      {nextEvent && (
        <button
          type="button"
          onClick={() => jumpTo(nextEvent.date)}
          className={cx(
            "group mb-4 flex w-full min-w-0 items-center gap-3 rounded-2xl px-4 py-3 text-left cursor-pointer",
            "bg-white ring-1 ring-gray-200/70 hover:ring-gray-300 dark:bg-surface dark:ring-line dark:hover:ring-line-strong",
            "transition-shadow duration-200", focusRingCls,
          )}
        >
          <span className={cx("size-2.5 shrink-0 rounded-full", kindOf(nextEvent).dot)} aria-hidden="true" />
          <span className="min-w-0 flex-1">
            <span className="block text-xs font-medium text-gray-500 dark:text-gray-400">วันหยุดถัดไป</span>
            <span className="block truncate text-[15px] font-semibold text-gray-900 dark:text-gray-100">
              {nextEvent.title}
              <span className="font-normal text-gray-500 dark:text-gray-400">
                {" · "}{th(nextEvent.date, { weekday: "long", day: "numeric", month: "long" })}
              </span>
            </span>
          </span>
          <span className="shrink-0 rounded-full bg-indigo-50 px-2.5 py-1 text-xs font-semibold tabular-nums text-indigo-700 dark:bg-indigo-500/15 dark:text-indigo-200">
            {countdown(daysBetween(today, nextEvent.date))}
          </span>
        </button>
      )}

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_20rem] lg:items-start">
        {/* ── ปฏิทินรายเดือน ── */}
        <section aria-labelledby="cal-month" className={cx(cardCls, "min-w-0 p-3 md:p-5")}>
          <header className="mb-3 flex flex-wrap items-center gap-2 md:mb-4">
            <div className="mr-auto min-w-0 pl-1">
              <h2 id="cal-month" aria-live="polite" className="text-xl font-bold tracking-tight text-gray-900 dark:text-gray-50 md:text-2xl">
                {monthLabel}
              </h2>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                {viewLoading ? "กำลังโหลด…" : monthCount ? `วันหยุด ${monthCount} วัน` : "ไม่มีวันหยุดในเดือนนี้"}
              </p>
            </div>
            {!isCurrentMonth && (
              <button type="button" onClick={() => jumpTo(today)} className={cx(neutralBtnCls, "!h-9 !px-3 !rounded-lg")}>
                วันนี้
              </button>
            )}
            <div className="flex items-center">
              <button type="button" onClick={() => shiftMonth(-1)} className={iconBtnCls} aria-label="เดือนก่อนหน้า">
                <ChevronLeft className="size-5" aria-hidden="true" />
              </button>
              <button type="button" onClick={() => shiftMonth(1)} className={iconBtnCls} aria-label="เดือนถัดไป">
                <ChevronRight className="size-5" aria-hidden="true" />
              </button>
            </div>
          </header>

          {viewError ? (
            <ErrorState message={viewError} onRetry={() => { setFailed((s) => { const n = { ...s }; delete n[viewFy]; return n }); load(viewFy) }} />
          ) : (
            <>
              <div className="grid grid-cols-7 gap-1 md:gap-1.5" aria-hidden="true">
                {WEEKDAYS.map((w, i) => (
                  <div
                    key={w}
                    className={cx(
                      "pb-1.5 text-center text-xs font-semibold",
                      i === 0 || i === 6 ? "text-gray-400 dark:text-gray-500" : "text-gray-500 dark:text-gray-400",
                    )}
                  >
                    {w}
                  </div>
                ))}
              </div>

              <div key={`${cursor.y}-${cursor.m}`} className="animate-fade-in grid grid-cols-7 gap-1 md:gap-1.5" role="group" aria-label={`ปฏิทิน ${monthLabel}`}>
                {cells.map((d, i) => {
                  if (!d) return <div key={`b${i}`} aria-hidden="true" />
                  const iso = toIso(cursor.y, cursor.m, d)
                  const evs = eventsByDate.get(iso) || []
                  const k = evs[0] ? kindOf(evs[0]) : null
                  const dow = i % 7
                  const isWeekend = dow === 0 || dow === 6
                  const isToday = iso === today
                  const isSel = iso === selected
                  return (
                    <button
                      key={iso}
                      type="button"
                      onClick={() => setSelected(iso)}
                      aria-pressed={isSel}
                      aria-current={isToday ? "date" : undefined}
                      aria-label={[th(iso, { weekday: "long", day: "numeric", month: "long" }), ...evs.map((e) => e.title)].join(" — ")}
                      className={cx(
                        "relative flex min-h-12 min-w-0 flex-col items-center gap-1 rounded-xl p-1 text-center cursor-pointer",
                        "md:min-h-24 md:items-start md:p-2 md:text-left",
                        "transition-colors duration-150",
                        k ? k.cell : "hover:bg-gray-50 dark:hover:bg-white/[.04]",
                        isSel && "ring-2 ring-inset ring-indigo-500 dark:ring-indigo-400",
                        focusRingCls,
                      )}
                    >
                      {viewLoading ? (
                        <Skeleton className="size-7" rounded="rounded-full" />
                      ) : (
                        <span
                          className={cx(
                            "inline-flex size-7 items-center justify-center rounded-full text-sm tabular-nums",
                            isToday
                              ? "bg-indigo-600 font-bold text-white dark:bg-indigo-500"
                              : k ? cx("font-bold", k.num)
                              : isWeekend ? "text-gray-400 dark:text-gray-500"
                              : "font-medium text-gray-800 dark:text-gray-200",
                          )}
                        >
                          {d}
                        </span>
                      )}
                      {/* มือถือ: จุด · จอใหญ่: ชื่อวันหยุด */}
                      {k && <span className={cx("size-1.5 rounded-full md:hidden", k.dot)} aria-hidden="true" />}
                      {evs.map((e) => (
                        <span key={e.id} className={cx("hidden w-full text-xs font-medium leading-snug md:line-clamp-2", kindOf(e).name)}>
                          {e.title}
                        </span>
                      ))}
                    </button>
                  )
                })}
              </div>

              {/* วันที่เลือก */}
              <div className="mt-4 rounded-xl bg-gray-50 px-4 py-3 dark:bg-white/[.03]" aria-live="polite">
                <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                  {th(selected, { weekday: "long", day: "numeric", month: "long", year: "numeric" })}
                </p>
                {selectedEvents.length ? (
                  <ul className="mt-1.5 space-y-1.5">
                    {selectedEvents.map((e) => (
                      <li key={e.id} className="flex gap-2.5">
                        <span className={cx("mt-1.5 size-2 shrink-0 rounded-full", kindOf(e).dot)} aria-hidden="true" />
                        <div className="min-w-0">
                          <p className={cx("text-sm font-semibold", kindOf(e).name)}>{e.title}</p>
                          <p className="text-xs text-gray-500 dark:text-gray-400">
                            {kindOf(e).label}{e.note ? ` · ${e.note}` : ""}
                          </p>
                        </div>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="mt-0.5 text-sm text-gray-500 dark:text-gray-400">
                    {selectedDow === 0 || selectedDow === 6 ? "วันเสาร์–อาทิตย์" : "วันทำงานปกติ"}
                  </p>
                )}
              </div>

              <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1.5 px-1 text-xs text-gray-500 dark:text-gray-400">
                <span className="inline-flex items-center gap-1.5"><span className={cx("size-2 rounded-full", KIND.annual.dot)} aria-hidden="true" />{KIND.annual.label}</span>
                <span className="inline-flex items-center gap-1.5"><span className={cx("size-2 rounded-full", KIND.special.dot)} aria-hidden="true" />{KIND.special.label}</span>
                <span className="inline-flex items-center gap-1.5"><span className="size-2 rounded-full bg-indigo-600 dark:bg-indigo-500" aria-hidden="true" />วันนี้</span>
                <Can perm="hr.holidays.manage">
                  <Link
                    to="/hr/dashboard?tab=holiday-calendar"
                    state={backState("ปฏิทินวันหยุด")}
                    className={cx("ml-auto inline-flex min-h-touch items-center gap-1.5 rounded-lg px-1 font-semibold text-indigo-600 hover:text-indigo-700 dark:text-indigo-300 dark:hover:text-indigo-200 md:min-h-0", focusRingCls)}
                  >
                    <Settings2 className="size-3.5" aria-hidden="true" />
                    จัดการวันหยุด
                  </Link>
                </Can>
              </div>
            </>
          )}
        </section>

        {/* ── วันหยุดทั้งปีงบ ── */}
        <section aria-labelledby="cal-year" className={cx(cardCls, "min-w-0 p-3 md:p-4 lg:sticky lg:top-[calc(var(--topbar-h)+1rem)]")}>
          <div className="mb-2 flex items-baseline justify-between gap-2 px-1">
            <h2 id="cal-year" className="text-base font-bold text-gray-900 dark:text-gray-50">วันหยุดปีงบ {viewFy}</h2>
            {!viewLoading && !viewError && (
              <span className="text-xs tabular-nums text-gray-500 dark:text-gray-400">{yearList.length} วัน</span>
            )}
          </div>
          <p className="mb-3 px-1 text-xs text-gray-500 dark:text-gray-400">1 เม.ย. {viewFy} – 31 มี.ค. {viewFy + 1}</p>

          {viewLoading ? (
            <div className="space-y-2">{Array.from({ length: 6 }, (_, i) => <Skeleton key={i} className="h-12" />)}</div>
          ) : viewError ? (
            <p className="px-1 text-sm text-gray-500 dark:text-gray-400">โหลดรายการไม่สำเร็จ</p>
          ) : yearList.length === 0 ? (
            <p className="px-1 py-6 text-center text-sm text-gray-500 dark:text-gray-400">ฝ่ายบุคคลยังไม่ได้ประกาศวันหยุดของปีงบนี้</p>
          ) : (
            <ol className="-mx-1 max-h-[70vh] space-y-0.5 overflow-y-auto lg:max-h-[calc(100dvh-var(--topbar-h)-12rem)]">
              {yearList.map((e) => {
                const past = e.date < today
                const isNext = nextEvent?.id === e.id
                const k = kindOf(e)
                return (
                  <li key={e.id}>
                    <button
                      type="button"
                      onClick={() => jumpTo(e.date)}
                      className={cx(
                        "flex w-full min-w-0 items-center gap-3 rounded-xl px-2 py-2 text-left cursor-pointer",
                        "transition-colors duration-150",
                        e.date === selected ? "bg-indigo-50 dark:bg-indigo-500/10" : "hover:bg-gray-50 dark:hover:bg-white/[.04]",
                        past && "opacity-55",
                        focusRingCls,
                      )}
                    >
                      <span className="flex w-11 shrink-0 flex-col items-center leading-none">
                        <span className={cx("text-lg font-bold tabular-nums", k.num)}>{parseIso(e.date).getDate()}</span>
                        <span className="mt-0.5 text-[11px] font-medium text-gray-500 dark:text-gray-400">{th(e.date, { month: "short" })}</span>
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-semibold text-gray-900 dark:text-gray-100">{e.title}</span>
                        <span className="block truncate text-xs text-gray-500 dark:text-gray-400">
                          {th(e.date, { weekday: "long" })}{e.kind === "special" ? " · วันหยุดพิเศษ" : ""}
                        </span>
                      </span>
                      {isNext && (
                        <span className="shrink-0 rounded-full bg-indigo-600 px-2 py-0.5 text-[11px] font-semibold text-white dark:bg-indigo-500">ถัดไป</span>
                      )}
                    </button>
                  </li>
                )
              })}
            </ol>
          )}
        </section>
      </div>
    </div>
  )
}
