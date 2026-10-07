// src/pages/hr/HRDashboard.jsx
// HR Dashboard (งานบุคคล) — stat strip + grouped left rail (20 sections, 6 groups)
// + Ctrl/⌘K quick switcher. Everything (rail, <lg menu, switcher, section header,
// document.title) reads from the single HR_NAV config below.
// URL contract: ?tab=<key> (push on navigation, invalid → replace to employees);
// sub-tabs inside sections write &sub=<value> with replace (see lib/useSubTab).
import { useCallback, useEffect, useId, useMemo, useRef, useState } from "react"
import { Link, useSearchParams } from "react-router-dom"
import {
  AlertCircle,
  Archive,
  ArrowRightLeft,
  Award,
  Banknote,
  BookOpen,
  BriefcaseBusiness,
  CalendarClock,
  CalendarDays,
  ClipboardList,
  Coins,
  FileText,
  HandCoins,
  History,
  ListChecks,
  MapPin,
  RotateCw,
  ScrollText,
  Search,
  Target,
  UserMinus,
  Users,
  Wrench,
} from "lucide-react"
import { apiAuth } from "../../lib/api"
import { cx, cardCls, neutralBtnCls } from "../../lib/styles"
import { PageSection, Skeleton } from "../../components/ui"
import Portal from "../../components/Portal"
import SelectDropdown from "../../components/SelectDropdown"

import HREmployeesTab from "./tabs/HREmployeesTab"
import HRLeaveTab from "./tabs/HRLeaveTab"
import HRRelocationTab from "./tabs/HRRelocationTab"
import HRIssueTab from "./tabs/HRIssueTab"
import HRSalaryTab from "./tabs/HRSalaryTab"
import HRPayrollTab from "./tabs/HRPayrollTab"
import HRLoansTab from "./tabs/HRLoansTab"
import HRKpiTab from "./tabs/HRKpiTab"
import HRPositionsTab from "./tabs/HRPositionsTab"
import HRLeaveTypesTab from "./tabs/HRLeaveTypesTab"
import HRPromotionsTab from "./tabs/HRPromotionsTab"
import HRAuditTab from "./tabs/HRAuditTab"
import HRTerminationTab from "./tabs/HRTerminationTab"
import HRSalaryCertTab from "./tabs/HRSalaryCertTab"
import HRRelocationHistoryTab from "./tabs/HRRelocationHistoryTab"
import HRLeaveRegisterTab from "./tabs/HRLeaveRegisterTab"
import HRResignedRetiredTab from "./tabs/HRResignedRetiredTab"
import HRHolidayCalendarTab from "./tabs/HRHolidayCalendarTab"
import HRHolidayWorkTab from "./tabs/HRHolidayWorkTab"
import HROutOfOfficeTab from "./tabs/HROutOfOfficeTab"

// ─── Navigation config (single source of truth) ──────────────────────────────

const HR_NAV = [
  {
    group: "บุคลากร",
    items: [
      { key: "employees", label: "เจ้าหน้าที่", icon: Users,
        description: "ข้อมูลเจ้าหน้าที่ทั้งหมด ค้นหา ลงทะเบียน และดูประวัติรายบุคคล",
        keywords: ["พนักงาน", "บุคลากร", "รายชื่อ", "ลงทะเบียน", "employees"] },
      { key: "positions", label: "ตำแหน่งงาน", icon: BriefcaseBusiness,
        description: "กำหนดตำแหน่งงานและกระบอกเงินเดือนของแต่ละตำแหน่ง",
        keywords: ["ตำแหน่ง", "กระบอก", "positions"] },
      { key: "promotions", label: "เลื่อนตำแหน่ง", icon: Award,
        description: "ผู้มีสิทธิ์สอบเลื่อนตำแหน่ง และการสอบที่นัดไว้",
        keywords: ["สอบ", "เลื่อนระดับ", "promotion"] },
      { key: "termination", label: "บันทึกออกจากงาน", icon: UserMinus,
        description: "บันทึกการออกจากงานของเจ้าหน้าที่ พร้อมเหตุผลและวันที่มีผล",
        keywords: ["ออกจากงาน", "เลิกจ้าง", "เงินชดเชย", "termination"] },
      { key: "resigned-retired", label: "ประวัติออกจากงาน", icon: Archive,
        description: "รายชื่อเจ้าหน้าที่ที่ลาออก เกษียณ หรือพ้นสภาพ",
        keywords: ["ลาออก", "เกษียณ", "ไล่ออก", "ลาออก/เกษียณ"] },
    ],
  },
  {
    group: "การลาและเวลา",
    items: [
      { key: "leave", label: "คำขอลา", icon: FileText, badgeKey: "pending_leave_requests",
        description: "ตรวจและอนุมัติคำขอลาของเจ้าหน้าที่",
        keywords: ["ลา", "leave", "อนุมัติ", "ใบลา"] },
      { key: "leave-register", label: "ทะเบียนการลา", icon: BookOpen,
        description: "สรุปวันลาที่ใช้ไปและคงเหลือของเจ้าหน้าที่แต่ละคน",
        keywords: ["ลา", "วันลา", "สรุปการลา"] },
      { key: "out-of-office", label: "ออกนอกสถานที่", icon: MapPin,
        description: "คำขอออกนอกสถานที่และสถานะการอนุมัติ",
        keywords: ["นอกสถานที่", "ไปราชการ", "อนุมัติ"] },
      { key: "holiday-work", label: "ทำงานวันหยุด", icon: CalendarClock,
        description: "บันทึกการทำงานในวันหยุดของเจ้าหน้าที่",
        keywords: ["วันหยุด", "โอที", "ot"] },
    ],
  },
  {
    group: "การย้าย",
    items: [
      { key: "relocation", label: "ย้ายสาขา", icon: ArrowRightLeft, badgeKey: "pending_relocation_requests",
        description: "คำขอย้ายสาขาและการอนุมัติ",
        keywords: ["ย้าย", "สาขา", "โยกย้าย", "อนุมัติ"] },
      { key: "relocation-history", label: "ประวัติย้ายสาขา", icon: History,
        description: "ประวัติการย้ายสาขาของเจ้าหน้าที่",
        keywords: ["ย้าย", "สาขา", "ประวัติ"] },
    ],
  },
  {
    group: "เงินเดือนและสวัสดิการ",
    items: [
      { key: "salary", label: "เงินเดือน", icon: Coins,
        description: "เลื่อนขั้นเงินเดือนเจ้าหน้าที่ และดูอัตราเงินเดือนแต่ละขั้นของกระบอก",
        keywords: ["ขั้น", "เลื่อนขั้น", "บัญชีเงินเดือน", "กระบอก", "salary"] },
      { key: "payroll", label: "จ่ายเงินเดือน", icon: Banknote,
        description: "สร้างและตรวจรายการเงินเดือนประจำเดือน",
        keywords: ["สลิป", "จ่าย", "payroll", "เงินเดือน"] },
      { key: "loans", label: "สินเชื่อ", icon: HandCoins,
        description: "สินเชื่อของเจ้าหน้าที่และการผ่อนชำระ",
        keywords: ["กู้", "เงินกู้", "loan", "ผ่อน"] },
      { key: "salary-cert", label: "หนังสือรับรองเงินเดือน", icon: ScrollText,
        description: "คำขอและการออกหนังสือรับรองเงินเดือน",
        keywords: ["หนังสือรับรอง", "รับรองเงินเดือน", "certificate"] },
      { key: "kpi", label: "KPI", icon: Target,
        description: "ประเมิน KPI ประจำปี สรุปผล ตรวจสอบ อนุมัติเลื่อนขั้น และบันทึกผลประกอบการ",
        keywords: ["ประเมิน", "ตัวชี้วัด", "คะแนน", "kpi", "เลื่อนขั้นประจำปี", "อนุมัติ", "ผลประกอบการ"] },
    ],
  },
  {
    group: "ตั้งค่า",
    items: [
      { key: "leave-types", label: "ประเภทการลา", icon: ListChecks,
        description: "กำหนดประเภทการลาและสิทธิ์วันลา",
        keywords: ["ลา", "ประเภท", "สิทธิ์ลา"] },
      { key: "holiday-calendar", label: "ปฏิทินวันหยุด", icon: CalendarDays,
        description: "กำหนดวันหยุดประจำปีขององค์กร",
        keywords: ["วันหยุด", "ปฏิทิน", "holiday"] },
    ],
  },
  {
    group: "ระบบ",
    items: [
      { key: "issues", label: "รายงานปัญหา", icon: Wrench, badgeKey: "pending_issue_reports",
        description: "รายงานปัญหาการใช้งานระบบและสถานะการแก้ไข",
        keywords: ["ปัญหา", "แจ้งปัญหา", "บั๊ก", "issue"] },
      { key: "audit", label: "ประวัติการใช้งาน", icon: ClipboardList,
        description: "ประวัติการใช้งานและการแก้ไขข้อมูลในระบบ HR",
        keywords: ["ประวัติระบบ", "log", "audit"] },
    ],
  },
]

const NAV_ITEMS = HR_NAV.flatMap((g) => g.items.map((it) => ({ ...it, group: g.group })))
const NAV_BY_KEY = Object.fromEntries(NAV_ITEMS.map((it) => [it.key, it]))
const DEFAULT_TAB = "employees"

// ─── Matching (label + keywords + key) ───────────────────────────────────────

const norm = (s) => String(s ?? "").toLowerCase().trim()

const isSubsequence = (q, s) => {
  let i = 0
  for (const ch of s) if (ch === q[i]) i++
  return i === q.length
}

/**
 * Lower is better: label prefix → label substring → keyword/key prefix →
 * keyword/key substring → label subsequence (3+ chars). null = no match.
 */
function matchScore(item, q) {
  if (!q) return 0
  const label = norm(item.label)
  const extra = [item.key, ...(item.keywords ?? [])].map(norm)
  if (label.startsWith(q)) return 0
  if (label.includes(q)) return 1
  if (extra.some((f) => f.startsWith(q))) return 2
  if (extra.some((f) => f.includes(q))) return 3
  if (q.length >= 3 && isSubsequence(q, label)) return 4
  return null
}

function rankItems(query) {
  const q = norm(query)
  return NAV_ITEMS
    .map((it, i) => ({ it, i, s: matchScore(it, q) }))
    .filter((x) => x.s != null)
    .sort((a, b) => a.s - b.s || a.i - b.i)
    .map((x) => x.it)
}

const prefersReducedMotion = () =>
  window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches ?? false

const isMac = () =>
  typeof navigator !== "undefined" && /mac|iphone|ipad/i.test(navigator.platform || navigator.userAgent || "")

// ─── Formatting ──────────────────────────────────────────────────────────────

const nf = (n) => Number(n).toLocaleString("th-TH")
const money = (n) => Number(n).toLocaleString("th-TH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })
const badgeText = (n) => (n > 99 ? "99+" : String(n))

// ─── Section body ────────────────────────────────────────────────────────────

function renderSection(key, { onGoToPositions }) {
  switch (key) {
    case "employees":          return <HREmployeesTab />
    case "leave":              return <HRLeaveTab />
    case "relocation":         return <HRRelocationTab />
    case "issues":             return <HRIssueTab />
    case "salary":             return <HRSalaryTab onGoToPositions={onGoToPositions} />
    case "payroll":            return <HRPayrollTab />
    case "loans":              return <HRLoansTab />
    case "kpi":                return <HRKpiTab />
    case "positions":          return <HRPositionsTab />
    case "leave-types":        return <HRLeaveTypesTab />
    case "promotions":         return <HRPromotionsTab />
    case "audit":              return <HRAuditTab />
    case "termination":        return <HRTerminationTab />
    case "salary-cert":        return <HRSalaryCertTab />
    case "relocation-history": return <HRRelocationHistoryTab />
    case "leave-register":     return <HRLeaveRegisterTab />
    case "resigned-retired":   return <HRResignedRetiredTab />
    case "holiday-calendar":   return <HRHolidayCalendarTab />
    case "holiday-work":       return <HRHolidayWorkTab />
    case "out-of-office":      return <HROutOfOfficeTab />
    default:                   return <HREmployeesTab />
  }
}

// ─── Stat strip ──────────────────────────────────────────────────────────────

const STAT_TILES = [
  { field: "total_active_employees", label: "เจ้าหน้าที่ที่ใช้งานอยู่", icon: Users, tab: "employees",
    format: (v) => `${nf(v)} คน` },
  { field: "pending_leave_requests", label: "คำขอลารออนุมัติ", icon: FileText, tab: "leave", pending: true,
    format: (v) => `${nf(v)} รายการ` },
  { field: "pending_relocation_requests", label: "คำขอย้ายสาขารออนุมัติ", icon: ArrowRightLeft, tab: "relocation", pending: true,
    format: (v) => `${nf(v)} รายการ` },
  { field: "pending_issue_reports", label: "รายงานปัญหารอดำเนินการ", icon: Wrench, tab: "issues", pending: true,
    format: (v) => `${nf(v)} รายการ` },
  { field: "total_salary_this_month", label: "เงินเดือนรวมเดือนนี้", icon: Banknote, tab: "payroll",
    format: (v) => `${money(v)} บาท` },
]

const TILE_CLS =
  "group flex min-h-[76px] w-full items-center gap-3 rounded-2xl bg-white p-4 text-left shadow-sm " +
  "ring-1 ring-gray-200/70 transition-colors duration-150 cursor-pointer " +
  "hover:ring-gray-300 dark:bg-gray-800 dark:ring-gray-700/70 dark:hover:ring-gray-600 " +
  "focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"

function StatStrip({ stats, loading, error, onRetry, onGo }) {
  if (loading) {
    return (
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5" role="status" aria-label="กำลังโหลดตัวเลขสรุป…">
        {STAT_TILES.map((t) => (
          <div key={t.field} aria-hidden="true" className={cx(cardCls, "flex min-h-[76px] items-center gap-3 p-4")}>
            <Skeleton rounded="rounded-xl" className="size-9 shrink-0" />
            <div className="min-w-0 flex-1 space-y-2">
              <Skeleton rounded="rounded-md" className="h-3 w-3/4" />
              <Skeleton rounded="rounded-md" className="h-4 w-1/2" />
            </div>
          </div>
        ))}
      </div>
    )
  }

  if (error) {
    return (
      <div role="alert" className={cx(cardCls, "flex flex-wrap items-center gap-3 p-4")}>
        <AlertCircle aria-hidden="true" className="size-5 shrink-0 text-red-500" strokeWidth={1.75} />
        <p className="min-w-0 flex-1 text-sm font-medium text-gray-700 dark:text-gray-200">โหลดตัวเลขสรุปไม่สำเร็จ</p>
        <button type="button" onClick={onRetry} className={cx(neutralBtnCls, "h-9")}>
          <RotateCw aria-hidden="true" className="size-4" strokeWidth={1.75} />
          ลองใหม่
        </button>
      </div>
    )
  }

  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
      {STAT_TILES.map((t) => {
        const raw = stats?.[t.field]
        const has = raw != null && raw !== "" && Number.isFinite(Number(raw))
        const showDot = t.pending && has && Number(raw) > 0
        const Icon = t.icon
        return (
          <button key={t.field} type="button" onClick={() => onGo(t.tab)} className={TILE_CLS}>
            <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-gray-100 text-gray-500 dark:bg-gray-700/60 dark:text-gray-300">
              <Icon aria-hidden="true" className="size-4" strokeWidth={1.75} />
            </span>
            <span className="min-w-0">
              <span className="line-clamp-2 text-xs leading-snug text-gray-500 dark:text-gray-400" title={t.label}>
                {t.label}
              </span>
              <span className="mt-0.5 flex items-center gap-1.5">
                {showDot && <span aria-hidden="true" className="size-1.5 shrink-0 rounded-full bg-amber-500" />}
                {has ? (
                  <span className="min-w-0 break-words text-base font-bold leading-tight tabular-nums text-gray-900 dark:text-gray-100">
                    {t.format(raw)}
                  </span>
                ) : (
                  <span className="text-sm font-medium text-gray-500 dark:text-gray-400">ไม่มีข้อมูล</span>
                )}
              </span>
            </span>
          </button>
        )
      })}
    </div>
  )
}

// ─── Rail ────────────────────────────────────────────────────────────────────

function NavBadge({ count, active }) {
  if (!(typeof count === "number" && count > 0)) return null
  return (
    <span
      className={cx(
        "ml-auto min-w-5 shrink-0 rounded-full px-1.5 text-center text-xs font-semibold leading-5 tabular-nums",
        active
          ? "bg-indigo-600 text-white dark:bg-indigo-500"
          : "bg-gray-200/80 text-gray-700 dark:bg-gray-700 dark:text-gray-200"
      )}
    >
      <span aria-hidden="true">{badgeText(count)}</span>
      <span className="sr-only">รอดำเนินการ {count} รายการ</span>
    </span>
  )
}

function HRNavItem({ item, active, count, onNavigate, itemRef }) {
  const Icon = item.icon
  return (
    <li>
      <Link
        ref={itemRef}
        to={{ search: `?tab=${item.key}` }}
        aria-current={active ? "page" : undefined}
        onClick={(e) => {
          // let modified clicks (new tab / window) behave natively
          if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0) return
          e.preventDefault()
          onNavigate(item.key)
        }}
        className={cx(
          "group flex h-8 w-full items-center gap-2.5 rounded-lg px-2.5 text-sm transition-colors duration-150",
          "focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-indigo-500",
          active
            ? "bg-indigo-50 font-semibold text-indigo-700 dark:bg-indigo-500/15 dark:text-indigo-300"
            : "font-medium text-gray-600 hover:bg-gray-100 hover:text-gray-900 dark:text-gray-400 dark:hover:bg-gray-800 dark:hover:text-gray-100"
        )}
      >
        <Icon
          aria-hidden="true"
          strokeWidth={1.75}
          className={cx(
            "size-4 shrink-0",
            active
              ? "text-indigo-600 dark:text-indigo-400"
              : "text-gray-400 group-hover:text-gray-600 dark:text-gray-500 dark:group-hover:text-gray-300"
          )}
        />
        <span className="min-w-0 truncate">{item.label}</span>
        <NavBadge count={count} active={active} />
      </Link>
    </li>
  )
}

function HRRail({ activeKey, badges, onNavigate, onOpenSwitcher }) {
  const [filter, setFilter] = useState("")
  const activeRef = useRef(null)
  const filterId = useId()
  const q = norm(filter)
  const mac = isMac()

  const groups = useMemo(
    () =>
      HR_NAV.map((g) => ({
        group: g.group,
        items: g.items.filter((it) => matchScore(it, q) != null),
      })).filter((g) => g.items.length > 0),
    [q]
  )

  useEffect(() => {
    activeRef.current?.scrollIntoView?.({ block: "nearest" })
    // only on mount: keep the active item visible in a short viewport
  }, [])

  const onFilterKey = (e) => {
    if (e.key === "Enter") {
      const first = rankItems(filter)[0]
      if (first) {
        e.preventDefault()
        onNavigate(first.key)
        setFilter("")
      }
    } else if (e.key === "Escape" && filter) {
      e.preventDefault()
      setFilter("")
    }
  }

  let firstHeader = true
  return (
    <nav aria-label="เมนูงานบุคคล" className="sticky top-6 hidden self-start lg:block">
      <div className="relative">
        <label htmlFor={filterId} className="sr-only">ค้นหาเมนู</label>
        <Search
          aria-hidden="true"
          strokeWidth={1.75}
          className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-gray-400"
        />
        <input
          id={filterId}
          type="search"
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          onKeyDown={onFilterKey}
          placeholder="ค้นหาเมนู"
          autoComplete="off"
          className={cx(
            "h-9 w-full rounded-xl bg-white pl-8 pr-14 text-sm text-gray-900 ring-1 ring-gray-200 placeholder:text-gray-400",
            "focus:outline-none focus:ring-2 focus:ring-indigo-500 dark:bg-gray-800 dark:text-gray-100 dark:ring-gray-700",
            "[&::-webkit-search-cancel-button]:hidden"
          )}
        />
        <button
          type="button"
          onClick={onOpenSwitcher}
          aria-label={`เปิดตัวค้นหาเมนู (${mac ? "⌘K" : "Ctrl K"})`}
          className="absolute right-2 top-1/2 -translate-y-1/2 rounded-md focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 cursor-pointer"
        >
          <kbd className="block rounded-md px-1.5 font-sans text-[11px] leading-6 text-gray-500 ring-1 ring-gray-200 dark:text-gray-400 dark:ring-gray-700">
            {mac ? "⌘K" : "Ctrl K"}
          </kbd>
        </button>
      </div>

      <div className="mt-1 max-h-[calc(100dvh-8rem)] overflow-y-auto pr-1 [scrollbar-width:thin]">
        {groups.length === 0 ? (
          <p className="px-2.5 py-2 text-sm text-gray-500 dark:text-gray-400">ไม่พบเมนู</p>
        ) : (
          groups.map((g) => {
            const pt = firstHeader ? "pt-3" : "pt-5"
            firstHeader = false
            const headId = `hr-rail-${g.group}`
            return (
              <div key={g.group}>
                <h2 id={headId} className={cx("px-2.5 pb-1.5 text-xs font-semibold text-gray-500 dark:text-gray-400", pt)}>
                  {g.group}
                </h2>
                <ul role="list" aria-labelledby={headId} className="space-y-0.5">
                  {g.items.map((it) => (
                    <HRNavItem
                      key={it.key}
                      item={it}
                      active={it.key === activeKey}
                      count={it.badgeKey ? badges?.[it.badgeKey] : undefined}
                      onNavigate={onNavigate}
                      itemRef={it.key === activeKey ? activeRef : undefined}
                    />
                  ))}
                </ul>
              </div>
            )
          })
        )}
      </div>
    </nav>
  )
}

// ─── Ctrl/⌘K quick switcher ──────────────────────────────────────────────────

function QuickSwitcher({ activeKey, badges, onNavigate, onClose }) {
  const [query, setQuery] = useState("")
  const inputRef = useRef(null)
  const listId = useId()
  const optId = (key) => `${listId}-opt-${key}`

  const results = useMemo(() => rankItems(query), [query])
  const grouped = !norm(query)
  const [activeIdx, setActiveIdx] = useState(() => Math.max(0, NAV_ITEMS.findIndex((it) => it.key === activeKey)))
  const safeIdx = results.length ? Math.min(activeIdx, results.length - 1) : -1
  const activeItem = safeIdx >= 0 ? results[safeIdx] : null

  useEffect(() => {
    inputRef.current?.focus()
  }, [])

  useEffect(() => {
    if (!activeItem) return
    document.getElementById(optId(activeItem.key))?.scrollIntoView({ block: "nearest" })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeItem?.key])

  const go = (it) => {
    if (!it) return
    onNavigate(it.key)
    onClose(it.key !== activeKey)
  }

  const onKeyDown = (e) => {
    const n = results.length
    if (e.key === "Escape") {
      e.preventDefault()
      onClose()
    } else if (e.key === "Tab") {
      e.preventDefault() // focus stays in the dialog (single focusable input)
    } else if (!n) {
      return
    } else if (e.key === "ArrowDown") {
      e.preventDefault()
      setActiveIdx((safeIdx + 1) % n)
    } else if (e.key === "ArrowUp") {
      e.preventDefault()
      setActiveIdx((safeIdx - 1 + n) % n)
    } else if (e.key === "Home") {
      e.preventDefault()
      setActiveIdx(0)
    } else if (e.key === "End") {
      e.preventDefault()
      setActiveIdx(n - 1)
    } else if (e.key === "Enter") {
      e.preventDefault()
      go(activeItem)
    }
  }

  const renderOption = (it, idx) => {
    const Icon = it.icon
    const selected = idx === safeIdx
    const count = it.badgeKey ? badges?.[it.badgeKey] : undefined
    return (
      <div
        key={it.key}
        id={optId(it.key)}
        role="option"
        aria-selected={selected}
        onMouseDown={(e) => e.preventDefault()}
        onMouseMove={() => idx !== safeIdx && setActiveIdx(idx)}
        onClick={() => go(it)}
        className={cx(
          "flex h-10 cursor-pointer items-center gap-3 rounded-lg px-3 text-sm",
          selected
            ? "bg-indigo-50 text-indigo-700 dark:bg-indigo-500/15 dark:text-indigo-200"
            : "text-gray-700 dark:text-gray-200"
        )}
      >
        <Icon
          aria-hidden="true"
          strokeWidth={1.75}
          className={cx("size-4 shrink-0", selected ? "text-indigo-600 dark:text-indigo-300" : "text-gray-400 dark:text-gray-500")}
        />
        <span className="min-w-0 flex-1 truncate font-medium">{it.label}</span>
        {!grouped && <span className="shrink-0 text-xs text-gray-600 dark:text-gray-400">{it.group}</span>}
        <NavBadge count={count} active={false} />
      </div>
    )
  }

  let idx = -1
  return (
    <Portal>
      <div className="fixed inset-0 z-[10060]">
        <div aria-hidden="true" className="absolute inset-0 bg-gray-950/40" onMouseDown={onClose} />
        <div
          role="dialog"
          aria-modal="true"
          aria-label="ไปที่เมนู"
          className="absolute left-1/2 top-[15vh] w-[min(36rem,calc(100vw-2rem))] -translate-x-1/2 overflow-hidden rounded-2xl bg-white shadow-lg ring-1 ring-gray-200 dark:bg-gray-800 dark:ring-gray-700"
        >
          <div className="relative border-b border-gray-100 dark:border-gray-700">
            <Search
              aria-hidden="true"
              strokeWidth={1.75}
              className="pointer-events-none absolute left-4 top-1/2 size-4 -translate-y-1/2 text-gray-400"
            />
            <input
              ref={inputRef}
              type="text"
              role="combobox"
              aria-expanded="true"
              aria-controls={listId}
              aria-autocomplete="list"
              aria-activedescendant={activeItem ? optId(activeItem.key) : undefined}
              aria-label="ไปที่เมนู"
              value={query}
              onChange={(e) => {
                setQuery(e.target.value)
                setActiveIdx(0)
              }}
              onKeyDown={onKeyDown}
              placeholder="พิมพ์ชื่อเมนูหรือคำค้น"
              autoComplete="off"
              className="h-12 w-full bg-transparent pl-10 pr-4 text-base text-gray-900 placeholder:text-gray-400 focus:outline-none dark:text-gray-100"
            />
          </div>

          <div id={listId} role="listbox" aria-label="เมนู" className="max-h-80 overflow-y-auto p-2">
            {results.length === 0 ? (
              <p className="px-3 py-6 text-center text-sm text-gray-500 dark:text-gray-400">
                ไม่พบเมนูที่ตรงกับ “{query.trim()}”
              </p>
            ) : grouped ? (
              HR_NAV.map((g) => {
                const headId = `${listId}-g-${g.group}`
                return (
                  <div key={g.group} role="group" aria-labelledby={headId}>
                    <div id={headId} role="presentation" className="px-3 pb-1 pt-2 text-xs font-semibold text-gray-500 dark:text-gray-400">
                      {g.group}
                    </div>
                    {g.items.map((it) => {
                      idx += 1
                      return renderOption(NAV_BY_KEY[it.key], idx)
                    })}
                  </div>
                )
              })
            ) : (
              results.map((it, i) => renderOption(it, i))
            )}
          </div>

          <div className="border-t border-gray-100 px-4 py-2 text-xs text-gray-500 dark:border-gray-700 dark:text-gray-400">
            ↑↓ เลือก · Enter เปิด · Esc ปิด
          </div>
        </div>
      </div>
    </Portal>
  )
}

// ─── Page ────────────────────────────────────────────────────────────────────

export default function HRDashboard() {
  const [searchParams, setSearchParams] = useSearchParams()
  const rawTab = searchParams.get("tab")
  const activeKey = rawTab && NAV_BY_KEY[rawTab] ? rawTab : DEFAULT_TAB
  const active = NAV_BY_KEY[activeKey]

  const rootRef = useRef(null)
  const openerRef = useRef(null)
  const contentRef = useRef(null)
  const focusSectionRef = useRef(false)
  const [switcherOpen, setSwitcherOpen] = useState(false)

  const [stats, setStats] = useState(null)
  const [loadingStats, setLoadingStats] = useState(true)
  const [statsError, setStatsError] = useState(false)
  const [statsReq, setStatsReq] = useState(0)

  // Invalid / missing tab → rewrite to the default (replace, no history entry)
  useEffect(() => {
    if (rawTab !== activeKey) {
      setSearchParams((prev) => {
        const p = new URLSearchParams(prev)
        p.set("tab", activeKey)
        p.delete("sub")
        return p
      }, { replace: true })
    }
  }, [rawTab, activeKey, setSearchParams])

  useEffect(() => {
    let alive = true
    setLoadingStats(true)
    setStatsError(false)
    apiAuth("/hr/dashboard")
      .then((d) => { if (alive) setStats(d) })
      .catch(() => { if (alive) { setStats(null); setStatsError(true) } })
      .finally(() => { if (alive) setLoadingStats(false) })
    return () => { alive = false }
  }, [statsReq])

  // Badges only when stats loaded cleanly (the strip reports errors itself)
  const badges = !loadingStats && !statsError ? stats : null

  const setTab = useCallback((key) => {
    setSearchParams({ tab: key }) // push; drops `sub`
    const main = rootRef.current?.closest("main")
    const behavior = prefersReducedMotion() ? "auto" : "smooth"
    if (main) main.scrollTo({ top: 0, behavior })
    else window.scrollTo({ top: 0, behavior })
  }, [setSearchParams])

  const goToPositions = useCallback(() => setTab("positions"), [setTab])

  const openSwitcher = useCallback(() => {
    openerRef.current = document.activeElement
    setSwitcherOpen(true)
  }, [])

  const closeSwitcher = useCallback((navigated) => {
    setSwitcherOpen(false)
    const el = openerRef.current
    openerRef.current = null
    // return focus after the portal unmounts. After navigating, the opener may
    // be gone (it lived in the old section) — move focus to the new section
    // heading so keyboard/SR users land in the content, not on <body>.
    if (navigated === true) {
      focusSectionRef.current = true // handled by the effect below once the new section mounts
      return
    }
    requestAnimationFrame(() => {
      if (el && typeof el.focus === "function" && document.contains(el)) el.focus()
    })
  }, [])

  useEffect(() => {
    if (!focusSectionRef.current) return
    focusSectionRef.current = false
    requestAnimationFrame(() => contentRef.current?.querySelector("h2")?.focus({ preventScroll: true }))
  }, [activeKey])

  // Ctrl+K / ⌘K — only while this page is mounted
  useEffect(() => {
    const onKey = (e) => {
      if ((e.ctrlKey || e.metaKey) && !e.altKey && String(e.key).toLowerCase() === "k") {
        e.preventDefault()
        if (switcherOpen) closeSwitcher()
        else openSwitcher()
      }
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [switcherOpen, openSwitcher, closeSwitcher])

  // document.title follows the section
  useEffect(() => {
    const prev = document.title
    return () => { document.title = prev }
  }, [])
  useEffect(() => {
    document.title = `${active.label} · HR`
  }, [active.label])

  const menuOptions = useMemo(
    () =>
      NAV_ITEMS.map((it) => {
        const n = it.badgeKey ? badges?.[it.badgeKey] : undefined
        return {
          value: it.key,
          label: it.label,
          sublabel: typeof n === "number" && n > 0 ? `${it.group} · รอ ${badgeText(n)}` : it.group,
          keywords: it.keywords,
        }
      }),
    [badges]
  )

  return (
    <div ref={rootRef} className="space-y-6 pb-10">
      <header>
        <h1 className="text-xl font-bold text-gray-900 dark:text-gray-100">งานบุคคล (HR)</h1>
        <p className="mt-0.5 text-sm leading-relaxed text-gray-500 dark:text-gray-400">
          จัดการข้อมูลเจ้าหน้าที่ การลา การย้ายสาขา และเงินเดือน
        </p>
      </header>

      <StatStrip
        stats={stats}
        loading={loadingStats}
        error={statsError}
        onRetry={() => setStatsReq((n) => n + 1)}
        onGo={setTab}
      />

      <div className="lg:grid lg:grid-cols-[15rem_minmax(0,1fr)] lg:items-start lg:gap-8">
        <HRRail activeKey={activeKey} badges={badges} onNavigate={setTab} onOpenSwitcher={openSwitcher} />

        <div className="min-w-0 space-y-3">
          {/* <lg: searchable section menu replaces the rail */}
          <div className="lg:hidden">
            <SelectDropdown
              options={menuOptions}
              value={activeKey}
              onChange={(v) => v && v !== activeKey && setTab(v)}
              placeholder="เลือกเมนู"
              searchable
              searchPlaceholder="ค้นหาเมนู"
              emptyText="ไม่พบเมนู"
              showSwatch={false}
              showSublabelInTrigger
              ariaLabel="เลือกเมนู"
            />
          </div>

          <div ref={contentRef} className={cx(cardCls, "min-w-0 p-4 lg:p-5 xl:p-6")}>
            <PageSection key={activeKey} title={active.label} description={active.description} icon={active.icon}>
              {renderSection(activeKey, { onGoToPositions: goToPositions })}
            </PageSection>
          </div>
        </div>
      </div>

      {switcherOpen && (
        <QuickSwitcher activeKey={activeKey} badges={badges} onNavigate={setTab} onClose={closeSwitcher} />
      )}
    </div>
  )
}
