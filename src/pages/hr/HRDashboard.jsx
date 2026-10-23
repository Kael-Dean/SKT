// src/pages/hr/HRDashboard.jsx
// HR Dashboard (งานบุคคล) — stat strip + grouped left rail (26 sections, 7 groups)
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
  CalendarRange,
  ChartColumn,
  ClipboardList,
  Coins,
  FileText,
  Gavel,
  HandCoins,
  HeartHandshake,
  History,
  ListChecks,
  MapPin,
  RotateCw,
  ScrollText,
  Scale,
  SlidersHorizontal,
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
import HRPayrollSettingsTab from "./tabs/HRPayrollSettingsTab"
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
// WP0 scaffold — stub ที่ WP1/WP2/WP3/WP5 เติมเนื้อหา
import HRLeaveCalendarTab from "./tabs/HRLeaveCalendarTab"
import HRWelfareTab from "./tabs/HRWelfareTab"
import HRWelfareSettingsTab from "./tabs/HRWelfareSettingsTab"
import HRDisciplineTab from "./tabs/HRDisciplineTab"
import HRDisciplineSettingsTab from "./tabs/HRDisciplineSettingsTab"
import HRIssueStatsTab from "./tabs/HRIssueStatsTab"
import useModalDismiss from "../../lib/useModalDismiss"
import { HR_KPI_PERMS, can, canPickAnyBranch, checkAccess } from "../../lib/permissions"
import DashboardOverview, { ALL_BRANCHES } from "../../components/hr/DashboardOverview"
import { fetchMyBranches } from "../../lib/leaveCalendar"
import { useMyPermissionsVersion } from "../../lib/myPermissions"
import { ForbiddenState } from "../../components/RequirePermission"
import PageTitle from "../../components/PageTitle"
import { backState, keepBackState } from "../../lib/drill"

// ─── Navigation config (single source of truth) ──────────────────────────────

// perm / anyOf = permission key ของแต่ละแท็บ (src/lib/permissions.js) — ผู้ใช้เห็นเฉพาะแท็บที่มีสิทธิ์
const HR_NAV = [
  {
    group: "บุคลากร",
    items: [
      { key: "employees", perm: "hr.employees.list", label: "เจ้าหน้าที่", icon: Users,
        description: "ข้อมูลเจ้าหน้าที่ทั้งหมด ค้นหา ลงทะเบียน และดูประวัติรายบุคคล",
        keywords: ["พนักงาน", "บุคลากร", "รายชื่อ", "ลงทะเบียน", "employees"] },
      { key: "positions", perm: "hr.positions.view", label: "ตำแหน่งงาน", icon: BriefcaseBusiness,
        description: "กำหนดตำแหน่งงานและกระบอกเงินเดือนของแต่ละตำแหน่ง",
        keywords: ["ตำแหน่ง", "กระบอก", "positions"] },
      { key: "promotions", anyOf: ["hr.promotions.eligible", "hr.promotions.exams"], label: "เลื่อนตำแหน่ง", icon: Award,
        description: "ผู้มีสิทธิ์สอบเลื่อนตำแหน่ง และการสอบที่นัดไว้",
        keywords: ["สอบ", "เลื่อนระดับ", "promotion"] },
      { key: "termination", perm: "hr.employees.terminate", label: "บันทึกออกจากงาน", icon: UserMinus,
        description: "บันทึกการออกจากงานของเจ้าหน้าที่ พร้อมเหตุผลและวันที่มีผล",
        keywords: ["ออกจากงาน", "เลิกจ้าง", "เงินชดเชย", "termination"] },
      { key: "resigned-retired", perm: "hr.reports.resignedRetired", label: "ประวัติออกจากงาน", icon: Archive,
        description: "รายชื่อเจ้าหน้าที่ที่ลาออก เกษียณ หรือพ้นสภาพ",
        keywords: ["ลาออก", "เกษียณ", "ไล่ออก", "ลาออก/เกษียณ"] },
    ],
  },
  {
    group: "การลาและเวลา",
    items: [
      { key: "leave", perm: "hr.leave.list", label: "คำขอลา", icon: FileText, badgeKey: "pending_leave_requests",
        description: "ตรวจและอนุมัติคำขอลาของเจ้าหน้าที่",
        keywords: ["ลา", "leave", "อนุมัติ", "ใบลา"] },
      { key: "leave-register", anyOf: ["hr.reports.leaveAnnual", "hr.reports.leaveRegister"], label: "ทะเบียนการลา", icon: BookOpen,
        description: "สรุปวันลาที่ใช้ไปและคงเหลือของเจ้าหน้าที่แต่ละคน",
        keywords: ["ลา", "วันลา", "สรุปการลา"] },
      { key: "out-of-office", perm: "hr.ooo.list", label: "ออกนอกสถานที่", icon: MapPin,
        description: "คำขอออกนอกสถานที่และสถานะการอนุมัติ",
        keywords: ["นอกสถานที่", "ไปราชการ", "อนุมัติ"] },
      { key: "holiday-work", perm: "hr.holidayWork.view", label: "ทำงานวันหยุด", icon: CalendarClock,
        description: "บันทึกการทำงานในวันหยุดของเจ้าหน้าที่",
        keywords: ["วันหยุด", "โอที", "ot"] },
      { key: "leave-calendar", perm: "hr.leave.calendar", label: "ปฏิทินการลา", icon: CalendarRange,
        description: "ดูว่าใครลาวันไหน แยกตามสาขา ในมุมมองปฏิทินรายเดือน",
        keywords: ["ปฏิทิน", "ลา", "ขาดงาน", "calendar"] },
    ],
  },
  {
    group: "การย้าย",
    items: [
      { key: "relocation", perm: "hr.relocation.list", label: "ย้ายสาขา", icon: ArrowRightLeft, badgeKey: "pending_relocation_requests",
        description: "คำขอย้ายสาขาและการอนุมัติ",
        keywords: ["ย้าย", "สาขา", "โยกย้าย", "อนุมัติ"] },
      { key: "relocation-history", anyOf: ["hr.relocation.list", "hr.reports.relocations"], label: "ประวัติย้ายสาขา", icon: History,
        description: "ประวัติการย้ายสาขาของเจ้าหน้าที่",
        keywords: ["ย้าย", "สาขา", "ประวัติ"] },
    ],
  },
  {
    group: "เงินเดือนและสวัสดิการ",
    items: [
      { key: "salary", anyOf: ["hr.salaryLadder.view", "hr.salaryRoster.view", "hr.salary.history", "hr.salary.stepAward"], label: "เงินเดือน", icon: Coins,
        description: "เลื่อนขั้นเงินเดือนเจ้าหน้าที่ และดูอัตราเงินเดือนแต่ละขั้นของกระบอก",
        keywords: ["ขั้น", "เลื่อนขั้น", "บัญชีเงินเดือน", "กระบอก", "salary"] },
      { key: "payroll", anyOf: ["hr.payroll.list", "hr.payroll.period.approve"], label: "จ่ายเงินเดือน", icon: Banknote,
        description: "สร้าง ตรวจสอบ อนุมัติ และปิดงวดเงินเดือนประจำเดือน",
        keywords: ["สลิป", "จ่าย", "payroll", "เงินเดือน", "งวด", "อนุมัติ", "ปิดงวด"] },
      { key: "loans", anyOf: ["hr.loans.queue", "hr.loans.list", "hr.loans.approve.finance", "hr.loans.overdue", "hr.loans.fundLedger"], label: "สินเชื่อ", icon: HandCoins,
        description: "คำขอกู้เงินกองทุนสงเคราะห์ที่รอพิจารณา สัญญา ตารางผ่อน และยอดค้างชำระ",
        keywords: ["กู้", "เงินกู้", "loan", "ผ่อน", "กองทุน", "อนุมัติ", "คณะทำงาน", "ค้างชำระ"] },
      { key: "salary-cert", perm: "hr.salaryCert.list", label: "หนังสือรับรองเงินเดือน", icon: ScrollText,
        description: "คำขอและการออกหนังสือรับรองเงินเดือน",
        keywords: ["หนังสือรับรอง", "รับรองเงินเดือน", "certificate"] },
      { key: "welfare", anyOf: ["hr.welfare.view", "hr.welfare.submit"], label: "สวัสดิการ", icon: HeartHandshake,
        description: "บันทึกและอนุมัติการเบิกค่ารักษาพยาบาล ตรวจสุขภาพ และค่าการศึกษาบุตร",
        keywords: ["สวัสดิการ", "เบิก", "ค่ารักษา", "ตรวจสุขภาพ", "ค่าเล่าเรียน", "welfare"] },
      { key: "kpi", anyOf: HR_KPI_PERMS, label: "KPI", icon: Target,
        description: "ประเมิน KPI ประจำปี สรุปผล ตรวจสอบ อนุมัติเลื่อนขั้น และบันทึกผลประกอบการ",
        keywords: ["ประเมิน", "ตัวชี้วัด", "คะแนน", "kpi", "เลื่อนขั้นประจำปี", "อนุมัติ", "ผลประกอบการ"] },
    ],
  },
  {
    group: "วินัย",
    items: [
      { key: "discipline", perm: "hr.discipline.cases", label: "เรื่องร้องเรียน/ตักเตือน", icon: Gavel,
        description: "เรื่องที่แจ้งเข้ามา การพิจารณาตามลำดับขั้น และการลงโทษทางวินัย",
        keywords: ["วินัย", "ตักเตือน", "ร้องเรียน", "พักงาน", "ลงโทษ", "discipline"] },
    ],
  },
  {
    group: "ตั้งค่า",
    items: [
      { key: "leave-types", perm: "hr.leaveTypes.manage", label: "ประเภทการลา", icon: ListChecks,
        description: "กำหนดประเภทการลาและสิทธิ์วันลา",
        keywords: ["ลา", "ประเภท", "สิทธิ์ลา"] },
      { key: "payroll-settings", perm: "hr.payroll.settings.view", label: "ตั้งค่าเงินเดือน", icon: SlidersHorizontal,
        description: "อัตราประกันสังคม เงินสะสม วิธีคำนวณภาษี และตัวหารค่าจ้างรายวัน",
        keywords: ["ประกันสังคม", "ภาษี", "ภ.ง.ด.1", "เงินสะสม", "อัตรา", "settings"] },
      { key: "holiday-calendar", perm: "hr.holidays.manage", label: "ปฏิทินวันหยุด", icon: CalendarDays,
        description: "กำหนดวันหยุดประจำปีขององค์กร",
        keywords: ["วันหยุด", "ปฏิทิน", "holiday"] },
      { key: "welfare-settings", anyOf: ["hr.welfare.settings", "hr.welfare.view"], label: "ตั้งค่าสวัสดิการ", icon: HeartHandshake,
        description: "วงเงินสวัสดิการ ช่องทางการจ่าย และอัตราค่าการศึกษาบุตร",
        keywords: ["สวัสดิการ", "วงเงิน", "ค่าการศึกษา", "settings"] },
      { key: "discipline-settings", anyOf: ["hr.discipline.topics", "hr.discipline.view"], label: "ตั้งค่าวินัย", icon: Scale,
        description: "หัวข้อระเบียบ เกณฑ์การนับโทษ และจำนวนวันพักงาน",
        keywords: ["วินัย", "หัวข้อ", "ระเบียบ", "settings"] },
    ],
  },
  {
    group: "ระบบ",
    items: [
      { key: "issues", perm: "hr.issues.list", label: "รายงานปัญหา", icon: Wrench, badgeKey: "pending_issue_reports",
        description: "รายงานปัญหาการใช้งานระบบและสถานะการแก้ไข",
        keywords: ["ปัญหา", "แจ้งปัญหา", "บั๊ก", "issue"] },
      { key: "issue-stats", perm: "hr.issues.stats", label: "สถิติคำร้อง", icon: ChartColumn,
        description: "จำนวนคำร้องแก้ไขข้อมูลรายเดือน แยกตามหัวข้อและสาขา",
        keywords: ["สถิติ", "คำร้อง", "แก้ไขข้อมูล", "stats"] },
      { key: "audit", perm: "hr.audit.view", label: "ประวัติการใช้งาน", icon: ClipboardList,
        description: "ประวัติการใช้งานและการแก้ไขข้อมูลในระบบ HR",
        keywords: ["ประวัติระบบ", "log", "audit"] },
    ],
  },
]

/** เมนูเฉพาะแท็บที่ผู้ใช้ปัจจุบันมีสิทธิ์ → { groups, items, byKey } */
function buildNav() {
  const groups = HR_NAV
    .map((g) => ({ group: g.group, items: g.items.filter((it) => checkAccess({ perm: it.perm, anyOf: it.anyOf })) }))
    .filter((g) => g.items.length > 0)
  const items = groups.flatMap((g) => g.items.map((it) => ({ ...it, group: g.group })))
  return { groups, items, byKey: Object.fromEntries(items.map((it) => [it.key, it])) }
}

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

function rankItems(items, query) {
  const q = norm(query)
  return items
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
    case "payroll-settings":   return <HRPayrollSettingsTab />
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
    case "leave-calendar":     return <HRLeaveCalendarTab />
    case "welfare":            return <HRWelfareTab />
    case "welfare-settings":   return <HRWelfareSettingsTab />
    case "discipline":         return <HRDisciplineTab />
    case "discipline-settings": return <HRDisciplineSettingsTab />
    case "issue-stats":        return <HRIssueStatsTab />
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
        <p className="min-w-0 flex-1 text-sm font-medium text-gray-700 dark:text-gray-200">
          โหลดตัวเลขสรุปไม่สำเร็จ{typeof error === "string" && error ? <span className="font-normal text-gray-500 dark:text-gray-400"> — {error}</span> : null}
        </p>
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

function HRRail({ nav, activeKey, badges, onNavigate, onOpenSwitcher }) {
  const [filter, setFilter] = useState("")
  const activeRef = useRef(null)
  const filterId = useId()
  const q = norm(filter)
  const mac = isMac()

  const groups = useMemo(
    () =>
      nav.groups.map((g) => ({
        group: g.group,
        items: g.items.filter((it) => matchScore(it, q) != null),
      })).filter((g) => g.items.length > 0),
    [nav, q]
  )

  useEffect(() => {
    activeRef.current?.scrollIntoView?.({ block: "nearest" })
    // only on mount: keep the active item visible in a short viewport
  }, [])

  const onFilterKey = (e) => {
    if (e.key === "Enter") {
      const first = rankItems(nav.items, filter)[0]
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
    <nav aria-label="เมนูงานบุคคล" className="sticky top-[calc(var(--topbar-h)+1.5rem)] hidden self-start lg:block">
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

function QuickSwitcher({ nav, activeKey, badges, onNavigate, onClose }) {
  const [query, setQuery] = useState("")
  const inputRef = useRef(null)
  const listId = useId()
  const optId = (key) => `${listId}-opt-${key}`

  const results = useMemo(() => rankItems(nav.items, query), [nav, query])
  const grouped = !norm(query)
  const [activeIdx, setActiveIdx] = useState(() => Math.max(0, nav.items.findIndex((it) => it.key === activeKey)))
  const safeIdx = results.length ? Math.min(activeIdx, results.length - 1) : -1
  const activeItem = safeIdx >= 0 ? results[safeIdx] : null
  // Esc (top-most modal only) + backdrop click close the switcher
  const { backdropProps } = useModalDismiss(onClose)

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
    if (e.key === "Tab") {
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
        <div aria-hidden="true" className="absolute inset-0 bg-gray-950/40" {...backdropProps} />
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
              nav.groups.map((g) => {
                const headId = `${listId}-g-${g.group}`
                return (
                  <div key={g.group} role="group" aria-labelledby={headId}>
                    <div id={headId} role="presentation" className="px-3 pb-1 pt-2 text-xs font-semibold text-gray-500 dark:text-gray-400">
                      {g.group}
                    </div>
                    {g.items.map((it) => {
                      idx += 1
                      return renderOption(nav.byKey[it.key], idx)
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
  const permVersion = useMyPermissionsVersion()
  const nav = useMemo(buildNav, [permVersion]) // permVersion: สร้างเมนูใหม่เมื่อสิทธิ์เปลี่ยน
  const defaultTab = nav.items[0]?.key ?? null
  const activeKey = rawTab && nav.byKey[rawTab] ? rawTab : defaultTab
  const active = activeKey ? nav.byKey[activeKey] : null
  // แถบสถิติ (GET /hr/dashboard) ต้องมี hr.dashboard — ไม่มีก็ไม่ยิง (กัน 403) และไม่แสดง
  const canSeeStats = can("hr.dashboard.view")

  const rootRef = useRef(null)
  const openerRef = useRef(null)
  const contentRef = useRef(null)
  const focusSectionRef = useRef(false)
  const [switcherOpen, setSwitcherOpen] = useState(false)

  // กราฟแนวโน้มเงินเดือน: hr.dashboard หรือ payroll.view (hr.payroll.list = matrix #64)
  const canSeeTrend = canSeeStats || can("hr.payroll.list")

  const [stats, setStats] = useState(null)
  const [loadingStats, setLoadingStats] = useState(true)
  const [statsError, setStatsError] = useState("") // "" = ok · ข้อความจาก server (เช่น 403 นอกสาขาที่ดูแล)
  const [statsReq, setStatsReq] = useState(0)

  // ตัวกรองสาขาของภาพรวม — ส่ง branch_id ให้ /hr/dashboard และ /hr/dashboard/payroll-trend
  const [branch, setBranch] = useState(ALL_BRANCHES)
  const scopedBranches = !canPickAnyBranch()
  const [branchList, setBranchList] = useState([])
  const [branchesLoading, setBranchesLoading] = useState(false)
  useEffect(() => {
    if (!canSeeTrend) return undefined
    let alive = true
    setBranchesLoading(true)
    // scope own_branch → เฉพาะสาขาที่ดูแล (/auth/my-branches) · scope all → ทุกสาขา
    const load = scopedBranches
      ? fetchMyBranches()
      : apiAuth("/order/branch/search").then((d) => (Array.isArray(d) ? d : []).map((b) => ({ id: Number(b.id), name: b.branch_name || `สาขา ${b.id}` })))
    load
      .then((list) => { if (alive) setBranchList(list.filter((b) => Number.isFinite(b.id))) })
      .catch(() => { if (alive) setBranchList([]) })
      .finally(() => { if (alive) setBranchesLoading(false) })
    return () => { alive = false }
  }, [canSeeTrend, scopedBranches])

  // Invalid / missing tab → rewrite to the default (replace, no history entry)
  useEffect(() => {
    if (activeKey && rawTab !== activeKey) {
      setSearchParams((prev) => {
        const p = new URLSearchParams(prev)
        p.set("tab", activeKey)
        p.delete("sub")
        return p
      }, { replace: true, state: keepBackState() })
    }
  }, [rawTab, activeKey, setSearchParams])

  useEffect(() => {
    if (!canSeeStats) {
      setLoadingStats(false)
      return undefined
    }
    let alive = true
    setLoadingStats(true)
    setStatsError("")
    const q = branch === ALL_BRANCHES ? "" : `?branch_id=${encodeURIComponent(branch)}`
    apiAuth(`/hr/dashboard${q}`)
      .then((d) => { if (alive) setStats(d) })
      .catch((e) => { if (alive) { setStats(null); setStatsError(e?.message || "โหลดข้อมูลแดชบอร์ดไม่สำเร็จ") } })
      .finally(() => { if (alive) setLoadingStats(false) })
    return () => { alive = false }
  }, [statsReq, canSeeStats, branch])

  // ตัวเลือกสาขา = รายชื่อสาขา ∪ สาขาที่ server ส่งมาใน employees_per_branch (อยู่ในขอบเขตแล้ว)
  const branchOptions = useMemo(() => {
    const m = new Map()
    branchList.forEach((b) => m.set(b.id, b.name))
    ;(Array.isArray(stats?.employees_per_branch) ? stats.employees_per_branch : []).forEach((b) => {
      const id = Number(b.branch_id)
      if (Number.isFinite(id) && !m.has(id)) m.set(id, b.branch_name || `สาขา ${id}`)
    })
    return [...m.entries()].map(([id, name]) => ({ value: String(id), label: name })).sort((a, b) => a.label.localeCompare(b.label, "th"))
  }, [branchList, stats])

  // Badges only when stats loaded cleanly (the strip reports errors itself)
  const badges = canSeeStats && !loadingStats && !statsError ? stats : null

  const setTab = useCallback((key) => {
    setSearchParams({ tab: key }) // push; drops `sub`
    const main = rootRef.current?.closest("main")
    const behavior = prefersReducedMotion() ? "auto" : "smooth"
    if (main) main.scrollTo({ top: 0, behavior })
    else window.scrollTo({ top: 0, behavior })
  }, [setSearchParams])

  // เงินเดือน → ตำแหน่งงาน เป็น drill-down: Topbar "‹ เงินเดือน" พากลับแท็บเดิม (คนที่เลือกไว้ยังอยู่ใน URL)
  const goToPositions = useCallback(() => {
    setSearchParams({ tab: "positions" }, { state: backState("เงินเดือน") })
    const main = rootRef.current?.closest("main")
    const behavior = prefersReducedMotion() ? "auto" : "smooth"
    if (main) main.scrollTo({ top: 0, behavior })
    else window.scrollTo({ top: 0, behavior })
  }, [setSearchParams])

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
    if (active) document.title = `${active.label} · HR`
  }, [active])

  const menuOptions = useMemo(
    () =>
      nav.items.map((it) => {
        const n = it.badgeKey ? badges?.[it.badgeKey] : undefined
        return {
          value: it.key,
          label: it.label,
          sublabel: typeof n === "number" && n > 0 ? `${it.group} · รอ ${badgeText(n)}` : it.group,
          keywords: it.keywords,
        }
      }),
    [nav, badges]
  )

  // ไม่มีแท็บไหนที่ใช้ได้ (route guard ควรกันไว้แล้ว — กันไว้อีกชั้นไม่ให้จอว่าง)
  if (!active) return <ForbiddenState />

  return (
    <div ref={rootRef} className="space-y-6 pb-10">
      <PageTitle title="งานบุคคล (HR)" />

      {canSeeStats && (
        <StatStrip
          stats={stats}
          loading={loadingStats}
          error={statsError}
          onRetry={() => setStatsReq((n) => n + 1)}
          onGo={(key) => nav.byKey[key] && setTab(key)}
        />
      )}

      {canSeeTrend && (
        <DashboardOverview
          stats={stats}
          loading={loadingStats}
          error={statsError}
          onRetry={() => setStatsReq((n) => n + 1)}
          branch={branch}
          branchOptions={branchOptions}
          branchesLoading={branchesLoading}
          scoped={scopedBranches}
          onBranchChange={setBranch}
          showStatus={canSeeStats}
          showTrend={canSeeTrend}
        />
      )}

      <div className="lg:grid lg:grid-cols-[15rem_minmax(0,1fr)] lg:items-start lg:gap-8">
        <HRRail nav={nav} activeKey={activeKey} badges={badges} onNavigate={setTab} onOpenSwitcher={openSwitcher} />

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
            <PageSection key={activeKey} title={active.label} icon={active.icon}>
              {renderSection(activeKey, { onGoToPositions: goToPositions })}
            </PageSection>
          </div>
        </div>
      </div>

      {switcherOpen && (
        <QuickSwitcher nav={nav} activeKey={activeKey} badges={badges} onNavigate={setTab} onClose={closeSwitcher} />
      )}
    </div>
  )
}
