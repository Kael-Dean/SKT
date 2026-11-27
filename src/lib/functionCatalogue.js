// src/lib/functionCatalogue.js
// ─────────────────────────────────────────────────────────────────────────────
// Every function a user can jump to from the header search (GlobalFunctionSearch).
// Built from the lists the app already navigates by, then deduped by path + params:
//
//   ALL_FUNCTIONS (Home cards) · Sidebar menus · routes neither covers (ROUTE_PAGES)
//   · HR dashboard tabs (HR_NAV) · sub-tabs (HR_SUB_TABS, MY_DISCIPLINE_VIEWS)
//   · reports inside /documents (DOCUMENT_REPORTS)
//
//   entry = { id, path, params, to, label, group, icon, gated, keywords, weakKeywords,
//             rules, supersededBy, source }
//   rules       permission checks; an entry is open if any source's rule passes
//   supersededBy id of the entry to show instead when both are open (same screen, twice)
//
// Adding a route with a page? Add it to ROUTE_PAGES with the same key as its guard in App.jsx,
// and give it keywords in KEYWORDS: words staff really use are what make the search find things.
// No React components are exported from here (react-refresh rule).
// ─────────────────────────────────────────────────────────────────────────────
import { CalendarRange, CreditCard, FileText, Gavel, HeartHandshake, Table2, Tags, TrendingUp, Wrench } from "lucide-react"
import { ALL_FUNCTIONS, canAccessItem, lucideFor } from "./homeFunctions"
import { HR_NAV } from "./hrNav"
import { DOCUMENTS_PERMS, HR_HUB_PERMS, PERMISSIONS, checkAccess } from "./permissions"
import { HR_MENUS, PERSONAL_MENUS, SELF_SERVICE_MENUS, canSeeSidebarItem } from "./sidebarMenus"
import { buildSearchIndex } from "./functionSearch"

const HR_HUB_LABEL = "ภาพรวมงานบุคคล"
const REPORTS_LABEL = "คลังเอกสาร & รายงาน"

// ─── Routes in App.jsx that neither ALL_FUNCTIONS nor the Sidebar lists ──────
// perm / anyOf = the same key as the route's guard. Skipped on purpose: /hr/personnel/:id (needs a
// person), /onboarding, /change-password and the login pages, /dev/*.
const ROUTE_PAGES = [
  { path: "/debt-tracking", label: "ติดตามผลหนี้", group: "ติดตามหนี้", perm: "debt.view", icon: TrendingUp },
  { path: "/debt-form", label: "ตารางหนี้", group: "ติดตามหนี้", perm: "debt.view", icon: Table2 },
  { path: "/hr/issues", label: "คำร้องแจ้งแก้ไขข้อมูล", group: "งานบุคคล", perm: "hr.issues.list", icon: Wrench, supersededBy: "/hr/dashboard?tab=issues" },
  { path: "/hr/salary-tier", label: "บัญชีเงินเดือนและตำแหน่ง", group: "งานบุคคล", perm: "hr.salaryLadder.view", icon: Tags },
  { path: "/hr/welfare", label: "สวัสดิการ", group: "งานบุคคล", perm: "hr.welfare.view", icon: HeartHandshake, supersededBy: "/hr/dashboard?tab=welfare" },
  { path: "/hr/discipline", label: "เรื่องร้องเรียนและการตักเตือน", group: "งานบุคคล", perm: "hr.discipline.cases", icon: Gavel, supersededBy: "/hr/dashboard?tab=discipline" },
  { path: "/hr/leave-calendar", label: "ปฏิทินการลา", group: "งานบุคคล", perm: "hr.leave.calendar", icon: CalendarRange, supersededBy: "/hr/dashboard?tab=leave-calendar" },
]

// Other sources' pages that are the same screen as a dashboard tab: one row is enough.
const SUPERSEDED = {
  "/hr/relocation": "/hr/dashboard?tab=relocation",
  "/holidays": "/hr/dashboard?tab=holiday-calendar",
}

// ─── Sub-tabs inside dashboard tabs (?tab=<tab>&sub=<sub>) ───────────────────
// `sub` values are checked against each tab's useSubTab list. perm / anyOf gate the sub-tab on top
// of its tab (the page shows some of them to everyone in the tab, but their API needs this key).
// Status filters (leave pending/all, relocation by stage, salary-cert) are not functions: left out.
const HR_SUB_TABS = [
  { tab: "salary", sub: "roster", label: "รายชื่อเงินเดือนทั้งหมด", perm: "hr.salaryRoster.view", keywords: ["ทะเบียนเงินเดือน", "เงินเดือนพนักงาน", "salary roster"] },
  { tab: "salary", sub: "step", label: "เลื่อนขั้นเงินเดือน", perm: "hr.salary.stepAward", keywords: ["ขึ้นเงินเดือน", "ปรับขั้น", "ให้ขั้น", "step award"] },
  { tab: "salary", sub: "ladder", label: "บัญชีเงินเดือน", perm: "hr.salaryLadder.view", keywords: ["ขั้นเงินเดือน", "อัตราเงินเดือน", "กระบอก", "salary ladder"] },
  { tab: "salary", sub: "history", label: "ประวัติเงินเดือนรายบุคคล", perm: "hr.salary.history", keywords: ["ประวัติขั้นเงินเดือน", "salary history"] },
  { tab: "payroll", sub: "month", label: "งวดเงินเดือนประจำเดือน", perm: "hr.payroll.month.view", keywords: ["คำนวณเงินเดือน", "ทำเงินเดือน", "ปิดงวด", "payroll"] },
  { tab: "payroll", sub: "external", label: "รายการหักภายนอก", perm: "hr.payroll.month.view", keywords: ["หักภายนอก", "กยศ", "สหกรณ์ออมทรัพย์", "ชมรมเจ้าหน้าที่", "external deductions"] },
  { tab: "payroll", sub: "review", label: "งวดเงินเดือนรอตรวจสอบ/อนุมัติ", anyOf: ["hr.payroll.check.admin", "hr.payroll.check.asst", "hr.payroll.period.approve"], keywords: ["อนุมัติเงินเดือน", "อนุมัติงวด", "ตรวจสอบเงินเดือน", "payroll approve"] },
  { tab: "loans", sub: "queue", label: "สินเชื่อรอพิจารณา", perm: "hr.loans.queue", keywords: ["อนุมัติเงินกู้", "คำขอกู้", "กู้", "loan queue"] },
  { tab: "loans", sub: "all", label: "สัญญาเงินกู้ทั้งหมด", perm: "hr.loans.list", keywords: ["สัญญากู้", "สัญญาสินเชื่อ", "ตารางผ่อน", "loan"] },
  { tab: "loans", sub: "overdue", label: "เงินกู้ค้างชำระ", perm: "hr.loans.overdue", keywords: ["ค้างจ่าย", "เบี้ยปรับ", "ผิดนัด", "overdue"] },
  { tab: "out-of-office", sub: "summary", label: "สรุปออกนอกสถานที่รายสาขา", perm: "hr.ooo.list", keywords: ["สรุปนอกสถานที่", "นอกพื้นที่", "ooo", "out of office"] },
  { tab: "out-of-office", sub: "settings", label: "ตั้งค่าออกนอกสถานที่", perm: "hr.ooo.list", keywords: ["ตั้งค่านอกพื้นที่", "ooo settings"] },
  { tab: "welfare", sub: "queue", label: "เบิกสวัสดิการรออนุมัติ", perm: "hr.welfare.view", keywords: ["อนุมัติสวัสดิการ", "อนุมัติเบิก", "welfare"] },
  { tab: "welfare", sub: "topay", label: "เบิกสวัสดิการรอจ่าย", perm: "hr.welfare.view", keywords: ["จ่ายสวัสดิการ", "รอจ่าย", "welfare"] },
  { tab: "relocation-history", sub: "requests", label: "ประวัติคำขอย้ายสาขา", anyOf: ["hr.relocation.list", "hr.reports.relocations"], keywords: ["คำขอย้าย", "โอนย้าย"] },
  { tab: "kpi", sub: "scores", label: "ให้คะแนนประเมิน KPI", perm: "hr.kpi.evaluations.view", keywords: ["ประเมินพนักงาน", "ให้คะแนน", "ประเมินผล", "evaluate"] },
  { tab: "kpi", sub: "finalize", label: "สรุปผลประเมิน KPI", perm: "hr.kpi.finalize", keywords: ["สรุปคะแนน", "สรุป kpi"] },
  { tab: "kpi", sub: "asst", label: "ผช.ผจก. ตรวจสอบผล KPI", perm: "hr.kpi.review.asstManager", keywords: ["ผู้ช่วยผู้จัดการ", "ตรวจผลประเมิน"] },
  { tab: "kpi", sub: "approve", label: "ผจก. อนุมัติผล KPI", perm: "hr.kpi.approve.manager", keywords: ["ผู้จัดการ", "อนุมัติเลื่อนขั้น", "อนุมัติ kpi"] },
  { tab: "kpi", sub: "branch", label: "ผลงานสาขา (KPI)", perm: "hr.kpi.branch", keywords: ["kpi สาขา", "คะแนนสาขา"] },
  { tab: "kpi", sub: "profit", label: "ผลประกอบการ (KPI)", perm: "hr.kpi.profit.record", keywords: ["ผลกำไร", "กำไรประจำปี", "เกณฑ์ขั้น"] },
  { tab: "kpi", sub: "monthly", label: "แบบประเมิน KPI รายเดือน", anyOf: ["hr.kpi.monthlyForm", "hr.kpi.monthly", "hr.kpi.evaluations.view"], keywords: ["kpi รายเดือน", "ประเมินรายเดือน", "monthly"] },
  { tab: "discipline", sub: "mine", label: "เรื่องร้องเรียนที่รอฉันพิจารณา", perm: "hr.discipline.decide", keywords: ["พิจารณาโทษ", "รอพิจารณา", "ตักเตือน", "วินัย"] },
  { tab: "discipline", sub: "closed", label: "เรื่องร้องเรียนที่ปิดแล้ว", perm: "hr.discipline.cases", keywords: ["ยุติเรื่อง", "ตักเตือน", "วินัย"] },
]

// /my-discipline?view=<view> (VIEWS in pages/work/MyDiscipline.jsx); "report" is the page's default.
const MY_DISCIPLINE_VIEWS = [
  { view: "reports", label: "เรื่องที่ฉันแจ้ง", perm: "self.discipline.report", keywords: ["สถานะเรื่องที่แจ้ง", "ติดตามเรื่อง", "ร้องเรียน", "แจ้ง"] },
  { view: "history", label: "ประวัติการตักเตือนของฉัน", perm: "self.discipline.history", keywords: ["ถูกตักเตือน", "หนังสือเตือน", "โทษ", "วินัย", "ใบเตือน"] },
]

// ─── Reports inside /documents (?report=<key>) ───────────────────────────────
// Titles and keys mirror the report lists in pages/work/Documents.jsx, which keeps the endpoint
// config: that stays in the page's lazy chunk, off the app shell. checkDocumentReports() warns in
// dev if the two drift. Plan reports: the page lists them to everyone on /documents, but the API
// needs plan.reports.*, so the search asks for that key too.
const DOCUMENT_REPORTS = [
  { key: "plan-01", title: "รูปแบบที่ 01 - เป้าหมายการขาย (รวมกลุ่ม)", perm: "plan.reports.saleGoal", keywords: ["เป้าขาย", "แผนขาย"] },
  { key: "plan-02", title: "รูปแบบที่ 02 - เป้าหมายการขายรายสาขา", perm: "plan.reports.saleGoal", keywords: ["เป้าขายสาขา", "แผนขาย"] },
  { key: "plan-03", title: "รูปแบบที่ 03 - ค่าใช้จ่ายธุรกิจ", perm: "plan.reports.businessCostsEarnings", keywords: ["ต้นทุนธุรกิจ", "รายจ่าย", "cost"] },
  { key: "plan-04", title: "รูปแบบที่ 04 - รายได้ธุรกิจ", perm: "plan.reports.businessCostsEarnings", keywords: ["รายรับ", "earning"] },
  { key: "plan-05", title: "รูปแบบที่ 05 - ค่าใช้จ่ายเสริมต่อหน่วย", perm: "plan.reports.unitCosts", keywords: ["ต้นทุนเสริม", "aux cost"] },
  { key: "plan-06", title: "รูปแบบที่ 06 - ต้นทุนซื้อต่อหน่วย", perm: "plan.reports.unitCosts", keywords: ["ต้นทุนจัดซื้อ", "ราคาทุน"] },
  { key: "plan-07", title: "รูปแบบที่ 07 - สรุปการเงินรายสาขา", perm: "plan.reports.branchSummary", keywords: ["การเงินสาขา", "งบสาขา"] },
  { key: "plan-08", title: "รูปแบบที่ 08 - เป้าหมายการขายทั้งองค์กร (รวมสินค้า)", perm: "plan.reports.organisation", keywords: ["เป้าขายรวม", "แผนขาย"] },
  { key: "plan-09", title: "รูปแบบที่ 09 - ต้นทุนซื้อทั้งองค์กร", perm: "plan.reports.organisation", keywords: ["ต้นทุนจัดซื้อรวม"] },
  { key: "plan-10", title: "รูปแบบที่ 10 - เป้าหมายการขายทั้งองค์กร แยกสินค้า", perm: "plan.reports.organisation", keywords: ["เป้าขายแยกสินค้า", "แผนขาย"] },
  { key: "plan-11", title: "รูปแบบที่ 11 - ค่าใช้จ่ายธุรกิจทั้งองค์กร", perm: "plan.reports.organisation", keywords: ["ต้นทุนธุรกิจรวม", "รายจ่ายรวม"] },
  { key: "plan-12", title: "รูปแบบที่ 12 - รายได้ธุรกิจทั้งองค์กร", perm: "plan.reports.organisation", keywords: ["รายรับรวม"] },
  { key: "plan-13", title: "รูปแบบที่ 13 - ค่าใช้จ่ายเสริมทั้งองค์กร", perm: "plan.reports.organisation", keywords: ["ต้นทุนเสริมรวม"] },
  { key: "plan-14", title: "รูปแบบที่ 14 - สรุปการซื้อทั้งองค์กร", perm: "plan.reports.organisation", keywords: ["ซื้อรวม", "ยอดซื้อ"] },
  { key: "plan-15", title: "รูปแบบที่ 15 - กำไรทั้งองค์กร แยกกลุ่ม", perm: "plan.reports.organisation", keywords: ["กำไร", "profit"] },
  { key: "plan-16", title: "รูปแบบที่ 16 - สรุปการเงินทั้งองค์กร", perm: "plan.reports.organisation", keywords: ["งบรวม", "การเงินรวม"] },
  { key: "plan-17", title: "รูปแบบที่ 17 - ค่าใช้จ่ายรายเดือน", perm: "plan.reports.monthly", keywords: ["รายจ่ายรายเดือน", "ต้นทุนรายเดือน"] },
  { key: "plan-18", title: "รูปแบบที่ 18 - รายได้และค่าใช้จ่ายเสริมรายเดือน", perm: "plan.reports.monthly", keywords: ["รายรับรายเดือน"] },

  { key: "phase1-p01", title: "P01 — ขออนุมัติและจ่ายค่าหุ้นลาออก", keywords: ["หุ้นลาออก", "คืนหุ้น", "ลาออกจากสมาชิก"] },
  { key: "phase1-p02", title: "P02 — ขายแยกตามวัน", keywords: ["ยอดขาย", "ขายข้าว", "ขายรายวัน"] },
  { key: "phase1-p03", title: "P03 — จ่ายคืนค่าหุ้นสมาชิกลาออก", keywords: ["คืนหุ้น", "หุ้นลาออก"] },
  { key: "phase1-p04", title: "P04 — ซื้อขายแยกราคา", keywords: ["ราคาข้าว", "ซื้อข้าว", "ขายข้าว"] },
  { key: "phase1-p05", title: "P05 — ซื้อข้าวเปลือกรายคน", keywords: ["ซื้อข้าว", "รับซื้อ", "สมาชิก"] },
  { key: "phase1-p06", title: "P06 — ซื้อแยกตามวัน", keywords: ["ยอดซื้อ", "ซื้อข้าว", "ซื้อรายวัน"] },
  { key: "phase1-p07", title: "P07 — ทะเบียนคุม (ทุกสาขา)", keywords: ["ทะเบียนคุมข้าว", "คุมสต๊อก", "stock"] },
  { key: "phase1-p08", title: "P08 — รายงานการรวบรวม", keywords: ["รวบรวมผลผลิต", "รวบรวมข้าว"] },
  { key: "phase1-p09", title: "P09 — เคลื่อนไหวทุนเรือนหุ้นรายกลุ่ม", keywords: ["หุ้น", "ความเคลื่อนไหวหุ้น", "share"] },
  { key: "phase1-p10", title: "P10 — ทะเบียนทุนเรือนหุ้น (รายคน)", keywords: ["หุ้น", "ทะเบียนหุ้น", "share"] },
  { key: "phase1-p11", title: "P11 — ทุนเรือนหุ้นคงเหลือรายคน", keywords: ["หุ้น", "หุ้นคงเหลือ", "share"] },
  { key: "phase1-p12", title: "P12 — รายงานรวมสาขา", keywords: ["สรุปสาขา", "ทุกสาขา"] },
  { key: "phase1-p13", title: "P13 — รายงานรายวัน", keywords: ["สรุปรายวัน", "daily"] },
  { key: "phase1-p14", title: "P14 — รายงานสมาชิก", keywords: ["ทะเบียนสมาชิก", "รายชื่อสมาชิก", "member"] },
  { key: "phase1-p15", title: "P15 — สมาชิกขอลาออกรายคน", keywords: ["ลาออกจากสมาชิก", "สมาชิกลาออก"] },
  { key: "phase1-p16", title: "P16 — รายงานสมาชิกใหม่", keywords: ["สมัครสมาชิก", "สมาชิกเข้าใหม่"] },
  { key: "phase1-p17", title: "P17 — สรุปการเคลื่อนไหวทุนเรือนหุ้นรายกลุ่ม", keywords: ["หุ้น", "สรุปหุ้น", "share"] },
  { key: "phase1-p18", title: "P18 — สรุปจำนวนสมาชิกและการถือหุ้น", keywords: ["จำนวนสมาชิก", "ถือหุ้น", "หุ้น"] },
  { key: "phase1-p19", title: "P19 — รายงานสาขา1 (สรุปข้าว)", keywords: ["สรุปข้าว", "ข้าวเปลือก"] },

  { key: "phase1-p20", title: "P20 — ทะเบียนคุมสาขา (Branch RX)", perm: "trading.reports.view", keywords: ["ทะเบียนคุมข้าว", "คุมสต๊อกสาขา"] },
  { key: "phase1-p21", title: "P21 — รายงานซื้อ-ขายแยกตามราคา", perm: "trading.reports.view", keywords: ["ราคาข้าว", "ซื้อข้าว", "ขายข้าว"] },
  { key: "phase1-p22", title: "P22 — ทะเบียนรับซื้อ", perm: "trading.reports.view", keywords: ["ซื้อข้าว", "ยอดซื้อ"] },
  { key: "phase1-p23", title: "P23 — รายงานซื้อขาย (รวม)", perm: "trading.reports.view", keywords: ["ซื้อข้าว", "ขายข้าว", "ยอดรวม"] },
  { key: "phase1-p24", title: "P24 — รายงานการขาย (แยกตามวัน)", perm: "trading.reports.view", keywords: ["ขายข้าว", "ยอดขาย"] },
  { key: "phase1-p25", title: "P25 — รายงานการซื้อ (แยกตามวัน)", perm: "trading.reports.view", keywords: ["ซื้อข้าว", "ยอดซื้อ"] },
  { key: "phase1-p26", title: "P26 — ทะเบียนคุม (รายวัน)", perm: "trading.reports.view", keywords: ["คุมสต๊อก", "สต๊อกรายวัน"] },
  { key: "phase1-p27", title: "P27 — สรุปการรับซื้อจากสมาชิก (แยกตามสินค้า)", perm: "trading.reports.view", keywords: ["ซื้อข้าว", "รับซื้อสมาชิก"] },

  { key: "hr-payroll-monthly", title: "รายงานสรุปเงินเดือน", perm: "hr.reports.payrollMonthly", keywords: ["เงินเดือนประจำเดือน", "payroll report"] },
  { key: "hr-payroll-annual", title: "รายงานเงินเดือนประจำปีงบประมาณ", perm: "hr.reports.payrollAnnual", keywords: ["เงินเดือนรายปี", "payroll annual"] },
  { key: "hr-social-security", title: "รายงานเงินสมทบประกันสังคม", perm: "hr.reports.socialSecurity", keywords: ["ประกันสังคม", "สปส", "social security"] },
  { key: "hr-reserve-fund", title: "รายงานเงินสะสม / กองทุนสงเคราะห์เจ้าหน้าที่", perm: "hr.reports.reserveFund", keywords: ["กองทุน", "provident fund"] },
  { key: "hr-leave-balance", title: "รายงานสรุปวันลาประจำปีงบประมาณ", perm: "hr.reports.leaveBalance", keywords: ["วันลาคงเหลือ", "โควตาลา", "leave balance"] },
  { key: "hr-leave-utilization", title: "รายงานการลาของพนักงาน", perm: "hr.reports.leaveUtilization", keywords: ["สถิติการลา", "ลาป่วย", "ลากิจ", "leave report"] },
  { key: "hr-leave-annual", title: "ทะเบียนคุมการลาประจำปีบัญชี", perm: "hr.reports.leaveAnnual", keywords: ["สรุปการลารายปี", "ทะเบียนการลา"] },
  { key: "hr-leave-register", title: "ทะเบียนการลาประจำปีบัญชี (เม.ย.–มี.ค.)", perm: "hr.reports.leaveRegister", keywords: ["ทะเบียนลารายบุคคล", "leave register"] },
  { key: "hr-roster", title: "ทะเบียนพนักงาน", perm: "hr.reports.roster", keywords: ["รายชื่อพนักงาน", "เจ้าหน้าที่", "roster"] },
  { key: "hr-new-employees", title: "รายงานพนักงานใหม่", perm: "hr.reports.newEmployees", keywords: ["เจ้าหน้าที่ใหม่", "เข้าใหม่"] },
  { key: "hr-position-changes", title: "รายงานการเปลี่ยนตำแหน่ง", perm: "hr.reports.positionChanges", keywords: ["ปรับตำแหน่ง", "เลื่อนตำแหน่ง"] },
  { key: "hr-relocations", title: "รายงานการโอนย้าย", perm: "hr.reports.relocations", keywords: ["ย้ายสาขา", "relocation"] },
  { key: "hr-relocation-history", title: "ประวัติการโยกย้ายเจ้าหน้าที่ (ทั้งองค์กร)", perm: "hr.reports.relocations", keywords: ["ย้ายสาขา", "ประวัติย้าย"] },
  { key: "hr-salary-levels", title: "รายงานระดับเงินเดือนพนักงาน", perm: "hr.reports.salaryLevels", keywords: ["ขั้นเงินเดือน", "ระดับ"] },
  { key: "hr-salary-adjustments", title: "รายงานการปรับขั้นเงินเดือน", perm: "hr.reports.salaryAdjustments", keywords: ["เลื่อนขั้น", "ขึ้นเงินเดือน"] },
  { key: "hr-loans-active", title: "รายงานเงินกู้ที่ยังค้างชำระ", perm: "hr.reports.activeLoans", keywords: ["กู้", "สินเชื่อคงค้าง", "กองทุนสงเคราะห์"] },
  { key: "hr-kpi-branch", title: "รายงาน KPI สาขา", perm: "hr.reports.kpiBranch", keywords: ["ผลประเมินสาขา"] },
  { key: "hr-kpi-org", title: "รายงาน KPI รวมองค์กร", perm: "hr.reports.kpiOrganisation", keywords: ["ผลประเมินรวม"] },
  { key: "hr-resigned", title: "รายชื่อผู้พ้นสภาพ", perm: "hr.reports.resignedRetired", keywords: ["ลาออก", "เกษียณ", "ไล่ออก"] },
  { key: "hr-welfare-claims", title: "สรุปการเบิกสวัสดิการประจำปีงบประมาณ", perm: "hr.reports.welfare", keywords: ["เบิกค่ารักษา", "welfare"] },
  { key: "hr-welfare-dependants", title: "ทะเบียนผู้มีสิทธิ์รับสวัสดิการ", perm: "hr.reports.welfare", keywords: ["ครอบครัว", "บุตร"] },
  { key: "hr-unpaid-deductions", title: "สรุปการงดจ่ายเงินเดือน (ลาเกินสิทธิ์ / พักงาน)", perm: "hr.reports.payrollMonthly", keywords: ["หักเงินเดือน", "ลาเกิน"] },
  { key: "hr-out-of-office", title: "รายงานการออกนอกพื้นที่", perm: "hr.ooo.list", keywords: ["นอกสถานที่", "ooo", "out of office"] },
  { key: "hr-ooo-monthly-branch", title: "บันทึกการปฏิบัติงานนอกสถานที่ (รายเดือน · ทั้งสาขา)", perm: "hr.ooo.list", keywords: ["นอกพื้นที่", "ooo"] },
  { key: "hr-ooo-monthly-employee", title: "บันทึกการปฏิบัติงานนอกสถานที่ (รายเดือน · รายคน)", perm: "hr.ooo.list", keywords: ["นอกพื้นที่", "ooo"] },
  { key: "hr-discipline-history", title: "ประวัติการลงโทษทางวินัย", perm: "hr.discipline.view", keywords: ["ตักเตือน", "ใบเตือน", "ร้องเรียน"] },
  { key: "hr-profile-pdf", title: "ข้อมูลประวัติพนักงาน (รายคน)", perm: "hr.reports.profilePdf", keywords: ["ใบประวัติ", "ประวัติเจ้าหน้าที่", "pdf"] },
  { key: "hr-salary-history-pdf", title: "ประวัติการปรับขั้นเงินเดือน (รายคน)", perm: "hr.reports.salaryHistoryPdf", keywords: ["ประวัติเงินเดือน", "เลื่อนขั้น", "pdf"] },
  { key: "hr-kpi-individual", title: "ผลการประเมิน KPI รายบุคคล", perm: "hr.reports.kpiIndividual", keywords: ["ผลประเมินรายคน", "pdf"] },
  { key: "hr-loan-schedule", title: "ตารางผ่อนชำระเงินกู้ (รายสัญญา)", perm: "hr.reports.loanSchedule", keywords: ["ตารางผ่อน", "กู้", "สินเชื่อ", "กองทุนสงเคราะห์"] },
]

const reportGroup = (key) => {
  if (key.startsWith("plan-")) return `${REPORTS_LABEL} · แผนดำเนินงานประจำปี`
  if (key.startsWith("hr-")) return `${REPORTS_LABEL} · ฝ่ายบุคคล`
  return `${REPORTS_LABEL} · ซื้อ-ขายและหุ้น`
}

/** P01–P19 ใช้คีย์ reports.phase1.pNN (เหมือน allowedPhase1Reports ใน Documents) */
const reportPerm = (r) => r.perm ?? r.key.replace("phase1-", "reports.phase1.")

// ─── How staff say it — by entry id (path + params) ──────────────────────────
const KEYWORDS = {
  // ธุรกิจรวบรวมผลผลิต
  "/bring-in": ["ยอดยกมา", "ข้าวยกมา", "ยอดคงเหลือต้นปี", "สต๊อก", "สต็อก", "คลัง", "carryover", "stock"],
  "/bring-in-mill": ["ยอดยกเข้าโรงสี", "โรงสี", "สีข้าว", "mill", "สต๊อก"],
  "/Buy": ["ซื้อ", "รับซื้อ", "ข้าวเปลือก", "ข้าว", "ออเดอร์ซื้อ", "บันทึกซื้อ", "buy", "purchase"],
  "/sales": ["ขาย", "ข้าว", "ข้าวเปลือก", "ออเดอร์ขาย", "บันทึกขาย", "sell", "sales"],
  "/transfer-in": ["รับข้าว", "รับเข้าข้าวเปลือก", "รับโอน", "โอนเข้า", "ยืนยันรับ", "คลัง", "สต๊อก", "transfer in"],
  "/transfer-out": ["โอนข้าว", "โอนออกข้าวเปลือก", "โอนสาขา", "ส่งข้าว", "คลัง", "สต๊อก", "transfer out"],
  "/transfer-mill": ["โรงสี", "สีข้าว", "ส่งโรงสี", "ล็อตสี", "สร้างล็อต", "mill", "milling"],
  "/damage-out": ["ของเสีย", "ข้าวเสีย", "ตัดสต๊อก", "ตัดขาดทุน", "สูญเสีย", "สต๊อก", "คลัง", "cut loss", "damage"],

  // ทะเบียนสมาชิก
  "/member-signup": ["สมาชิกใหม่", "เพิ่มสมาชิก", "ลงทะเบียนสมาชิก", "register member", "member"],
  "/customer-add": ["ลูกค้าใหม่", "ลงทะเบียนลูกค้า", "บุคคลทั่วไป", "customer"],
  "/company-add": ["นิติบุคคล", "ลูกค้าบริษัท", "ห้าง", "company", "คู่ค้า", "เพิ่มบริษัท", "รายชื่อบริษัท"],
  "/search": ["หาสมาชิก", "ข้อมูลสมาชิก", "แก้ไขสมาชิก", "รายชื่อสมาชิก", "member search"],
  "/customer-search": ["หาลูกค้า", "ข้อมูลลูกค้า", "แก้ไขลูกค้า", "customer search"],
  "/member-termination": ["ลาออกจากสมาชิก", "พ้นสมาชิก", "สมาชิกลาออก", "ยกเลิกสมาชิก", "terminate member"],
  "/share": ["หุ้น", "ทุนเรือนหุ้น", "ค่าหุ้น", "ถือหุ้น", "share", "shares"],

  // ออเดอร์ & คลังสินค้า
  "/order": ["ออเดอร์", "รายการซื้อขาย", "ประวัติซื้อขาย", "ซื้อ", "ขาย", "order"],
  "/order-correction": ["แก้ออเดอร์", "ยกเลิกออเดอร์", "ลบออเดอร์", "แก้รายการซื้อ", "แก้รายการขาย", "edit order"],
  "/stock": ["สต๊อก", "สต็อก", "สต๊อค", "ข้าวคงเหลือ", "ยอดคงเหลือ", "โกดัง", "คลัง", "stock", "inventory", "warehouse"],
  "/spec/create": ["สเปคข้าว", "เพิ่มสเปค", "สร้างรหัสข้าว", "ชนิดข้าว", "ข้าว", "spec"],
  "/spec/manage": ["สเปคข้าว", "แก้ไขรหัสข้าว", "แก้สเปค", "ชนิดข้าว", "ข้าว", "spec"],

  // รายงาน & แผน
  "/documents": ["รายงานทั้งหมด", "คลังเอกสาร", "เอกสาร", "พิมพ์รายงาน", "ดาวน์โหลดรายงาน", "pdf", "excel", "report", "documents"],
  "/operation-plan": ["แผนงาน", "แผนธุรกิจ", "แผนประจำปี", "เป้าหมายการขาย", "เป้าขาย", "กรอกค่าใช้จ่าย", "กรอกรายได้", "ต้นทุน", "plan"],
  "/business-edit": ["ข้อมูลหลัก", "master data", "ผลิตภัณฑ์", "สาขา", "หน่วยนับ", "ประเภทต้นทุน", "ประเภทรายได้", "ต้นทุนเสริม"],
  "/debt-hub": ["หนี้", "ลูกหนี้", "เจ้าหนี้", "บัญชีหนี้", "debt"],
  "/facility-report": ["ศูนย์เรียนรู้", "รายรับรายจ่าย", "รายรับ-รายจ่ายสถานที่", "สถานที่", "ห้องประชุม", "facility"],
  "/debt-tracking": ["หนี้", "ยอดหนี้", "โครงการหนี้", "สรุปหนี้", "debt tracking"],
  "/debt-form": ["หนี้", "กรอกหนี้", "บันทึกหนี้", "หนี้รายสาขา", "debt"],

  // งานบุคคล
  "/hr/dashboard": ["งานบุคคล", "ฝ่ายบุคคล", "แดชบอร์ด", "dashboard", "hr"],
  "/hr/staff-signup": ["เพิ่มพนักงาน", "พนักงานใหม่", "สร้างบัญชี", "รับเข้าทำงาน", "new employee", "register"],
  "/hr/users": ["พนักงาน", "รายชื่อพนักงาน", "ค้นหาพนักงาน", "บุคลากร", "employee", "staff"],
  "/hr/leaves": ["คำขอลา", "จัดการคำขอลา", "อนุมัติลา", "ลา", "ลางาน", "leave approve"],
  "/hr/finance": ["ธนาคาร", "เลขบัญชี", "การเงินพนักงาน", "ข้อมูลการเงินเจ้าหน้าที่", "finance"],
  "/hr/relocation": ["จัดการย้ายสาขา", "ย้ายพนักงาน", "โยกย้าย", "relocation"],
  "/holidays": ["วันหยุด", "วันหยุดประจำปี", "วันหยุดนักขัตฤกษ์", "holiday", "calendar"],
  "/hr/issues": ["แจ้งแก้ไขข้อมูล", "แก้ข้อมูลพนักงาน", "คำร้อง", "แจ้ง"],
  "/hr/salary-tier": ["บัญชีเงินเดือน", "ขั้นเงินเดือน", "ตำแหน่งงาน", "กระบอก", "salary tier", "salary ladder"],
  "/hr/welfare": ["เบิกสวัสดิการ", "ค่ารักษา", "ค่าเล่าเรียน", "welfare"],
  "/hr/discipline": ["ร้องเรียน", "ตักเตือน", "วินัย", "ลงโทษ", "discipline"],
  "/hr/leave-calendar": ["ปฏิทิน", "ใครลา", "ขาดงาน", "leave calendar"],

  // บริการตนเอง
  "/home": ["หน้าแรก", "กลับหน้าหลัก", "home", "เมนูหลัก"],
  "/my-profile": ["โปรไฟล์", "ประวัติส่วนตัว", "ข้อมูลของฉัน", "ที่อยู่", "แก้ข้อมูลตัวเอง", "profile"],
  "/my-financial": ["เงินของฉัน", "บัญชีธนาคาร", "เงินสะสม", "ภาษี", "financial"],
  "/my-payslips": ["สลิป", "สลิปเงินเดือน", "เงินเดือน", "ใบจ่ายเงินเดือน", "payslip", "pay slip", "salary slip"],
  "/inbox": ["กล่องงาน", "รออนุมัติ", "งานรออนุมัติ", "อนุมัติ", "งานค้าง", "approve", "inbox"],
  "/leave-request": ["ลา", "ลางาน", "ใบลา", "ขอลา", "ลาป่วย", "ลากิจ", "ลาพักร้อน", "ลาพักผ่อน", "ลาคลอด", "ลาบวช", "วันลา", "โควตาลา", "leave"],
  "/out-of-office": ["นอกสถานที่", "นอกพื้นที่", "ออกนอกพื้นที่", "ไปราชการ", "ไปทำงานข้างนอก", "ooo", "out of office"],
  "/out-of-office/approvals": ["อนุมัตินอกสถานที่", "อนุมัติคำขอออกนอกสถานที่", "นอกพื้นที่", "ooo", "ooo approve"],
  "/my-relocation": ["ย้าย", "ย้ายสาขา", "ขอย้าย", "โอนย้าย", "relocation", "transfer branch"],
  "/loan-request": ["กู้", "เงินกู้", "กู้เงิน", "ขอกู้", "สินเชื่อ", "กองทุนสงเคราะห์", "ขอกู้เงินกองทุนสงเคราะห์", "ตารางผ่อน", "loan"],
  "/my-salary-cert": ["หนังสือรับรอง", "รับรองเงินเดือน", "ใบรับรองเงินเดือน", "หนังสือรับรองการทำงาน", "certificate", "salary certificate"],
  "/my-welfare": ["สวัสดิการ", "เบิกค่ารักษา", "ค่ารักษาพยาบาล", "ค่าเล่าเรียนบุตร", "ตรวจสุขภาพ", "welfare"],
  "/my-kpi": ["ประเมินตนเอง", "ผลประเมิน", "kpi", "คะแนน", "แบบประเมินตนเอง"],
  "/my-discipline": ["แจ้ง", "แจ้งเรื่อง", "ตักเตือน", "ร้องเรียน", "ใบเตือน", "วินัย", "ทำผิดระเบียบ", "discipline", "complaint"],
  "/hr/kpi": ["ประเมิน", "เลื่อนขั้น", "ตรวจสอบ kpi", "อนุมัติ kpi", "kpi"],
  "/admin/roles": ["สิทธิ์", "บทบาท", "role", "permission", "สิทธิ์การใช้งาน", "ตารางสิทธิ์"],
  "/admin/onboarding": ["onboarding", "ออนบอร์ด", "แนะนำการใช้งาน", "ทัวร์", "tour", "ตัวอย่าง", "ผู้ใช้ใหม่", "ครั้งแรก", "ติดตั้งแอป"],

  // แท็บ HR — เพิ่มจาก keywords ใน HR_NAV
  "/hr/dashboard?tab=overview": ["แดชบอร์ด", "hr dashboard"],
  "/hr/dashboard?tab=employees": ["ประวัติพนักงาน", "staff", "employee"],
  "/hr/dashboard?tab=onboarding": ["พนักงานใหม่กรอกข้อมูล", "ความคืบหน้า"],
  "/hr/dashboard?tab=leave": ["อนุมัติลา", "ลาป่วย", "ลากิจ", "ลาพักร้อน"],
  "/hr/dashboard?tab=leave-register": ["ทะเบียนลา", "วันลาคงเหลือ", "โควตาลา", "leave register"],
  "/hr/dashboard?tab=out-of-office": ["นอกพื้นที่", "ooo", "out of office"],
  "/hr/dashboard?tab=holiday-work": ["ทำงานวันหยุด", "ล่วงเวลา", "holiday work"],
  "/hr/dashboard?tab=relocation": ["ย้ายพนักงาน", "relocation"],
  "/hr/dashboard?tab=payroll": ["ทำเงินเดือน", "สลิปเงินเดือน", "คำนวณเงินเดือน", "payslip"],
  "/hr/dashboard?tab=loans": ["สินเชื่อพนักงาน", "กองทุนสงเคราะห์", "คำขอกู้"],
  "/hr/dashboard?tab=salary-cert": ["ใบรับรองเงินเดือน", "salary certificate"],
  "/hr/dashboard?tab=kpi": ["ประเมินผล", "ประเมิน KPI / เลื่อนขั้น", "ประเมิน KPI และเลื่อนขั้น"],
  "/hr/dashboard?tab=discipline": ["ใบเตือน", "แจ้งเรื่อง", "แจ้ง", "complaint"],
  "/hr/dashboard?tab=issues": ["คำร้องแก้ไขข้อมูล", "แจ้งแก้ไขข้อมูล", "แจ้ง"],
  "/hr/dashboard?tab=issue-stats": ["สถิติแจ้งแก้ไข"],
  "/hr/dashboard?tab=signatures": ["ลายเซ็น", "ลายมือชื่อ", "เซ็นอัตโนมัติ", "e-signature"],
  "/hr/dashboard?tab=deduction-requests": ["ขอเปลี่ยนภาษี", "ขอเปลี่ยนเงินสะสม", "ยอดหักภาษี", "อนุมัติเงินสะสม"],
  "/hr/dashboard?tab=audit": ["บันทึกการใช้งาน", "audit log"],
  "/hr/dashboard?tab=holiday-calendar": ["วันหยุดประจำปี", "จัดการวันหยุด", "calendar"],
  "/hr/dashboard?tab=payroll-settings": ["เงินเดือน", "สปส", "เงินสะสมขั้นต่ำ", "กองทุนสงเคราะห์"],
  "/hr/dashboard?tab=termination": ["พ้นสภาพ", "ลาออก", "resign"],
  "/hr/dashboard?tab=resigned-retired": ["พ้นสภาพ", "retired", "resign"],
  "/hr/dashboard?tab=positions": ["ตำแหน่ง", "กระบอกเงินเดือน"],
  "/hr/dashboard?tab=promotions": ["สอบเลื่อนตำแหน่ง", "ผู้มีสิทธิ์สอบ"],
  "/hr/dashboard?tab=dependants": ["ข้อมูลครอบครัว", "ผู้มีสิทธิ์"],
  "/hr/dashboard?tab=leave-types": ["โควตาลา", "leave types"],
  "/hr/dashboard?tab=leave-calendar": ["ใครลา", "leave calendar"],
  "/hr/dashboard?tab=leave-log": ["ลากี่ครั้ง", "ประวัติการลารายคน", "ลารายครั้ง", "leave log"],
  "/my-signature": ["ลายเซ็นของฉัน", "เปลี่ยนลายเซ็น", "ขอเปลี่ยนลายเซ็น", "ลายมือชื่อ", "signature"],
  "/my-leave-log": ["ประวัติการลา", "ลากี่ครั้ง", "ลาวันไหน", "การลาของฉัน", "leave history"],
  "/hr/dashboard?tab=relocation-history": ["ประวัติการย้าย", "โอนย้าย"],
  "/hr/dashboard?tab=salary": ["ปรับเงินเดือน", "ขึ้นเงินเดือน", "ทะเบียนเงินเดือน"],
  "/hr/dashboard?tab=welfare": ["เบิกสวัสดิการ"],
  "/hr/dashboard?tab=welfare-settings": ["วงเงินสวัสดิการ"],
  "/hr/dashboard?tab=discipline-settings": ["ตั้งค่าตักเตือน", "เกณฑ์โทษ"],
}

// ─── Build ───────────────────────────────────────────────────────────────────

const entryId = (path, params) => (params ? `${path}?${params}` : path)
const GENERIC_ICON = lucideFor("")

/** Permission label + English for the key(s) of a rule. HUB-sized anyOf lists would match everything. */
function permissionWords({ perm, anyOf }) {
  const keys = perm ? [perm] : anyOf && anyOf.length <= 5 ? anyOf : []
  return keys.flatMap((k) => [PERMISSIONS[k]?.label, PERMISSIONS[k]?.en]).filter(Boolean)
}

function buildCatalogue() {
  const byId = new Map()

  const add = ({ path, params = "", label, group, icon, gated, keywords = [], weakKeywords = [], rule, supersededBy, source }) => {
    const id = entryId(path, params)
    const known = byId.get(id)
    if (known) {
      // Same destination from another list: other names become aliases, either list's rule opens it.
      if (label !== known.label) known.keywords.push(label)
      known.keywords.push(...keywords)
      known.weakKeywords.push(...weakKeywords)
      known.rules.push(rule)
      known.gated = known.gated || Boolean(gated)
      if (icon && known.icon === GENERIC_ICON) known.icon = icon
      return
    }
    const entry = {
      id,
      path,
      params,
      to: id,
      label,
      group,
      icon: icon ?? lucideFor(path),
      gated: Boolean(gated),
      keywords: [...keywords, ...(KEYWORDS[id] ?? [])],
      weakKeywords: [...weakKeywords],
      rules: [rule],
      supersededBy: supersededBy ?? SUPERSEDED[id] ?? null,
      source,
    }
    byId.set(id, entry)
  }

  for (const { group, items } of ALL_FUNCTIONS) {
    for (const item of items) {
      add({
        path: item.path,
        label: item.label,
        group,
        gated: item.gated,
        weakKeywords: permissionWords(item),
        rule: ({ roleId }) => canAccessItem(item, roleId),
        source: "home",
      })
    }
  }

  for (const item of [...SELF_SERVICE_MENUS, ...HR_MENUS, ...PERSONAL_MENUS]) {
    add({
      path: item.path,
      label: item.label,
      group: "เมนูส่วนตัว",
      icon: item.icon,
      gated: item.gated,
      weakKeywords: permissionWords(item),
      rule: (perms) => canSeeSidebarItem(item, perms),
      source: "sidebar",
    })
  }

  for (const page of ROUTE_PAGES) {
    add({
      ...page,
      weakKeywords: permissionWords(page),
      rule: ({ roleId }) => checkAccess({ perm: page.perm, anyOf: page.anyOf }, roleId),
      source: "route",
    })
  }

  const insideHub = (roleId) => checkAccess({ anyOf: HR_HUB_PERMS }, roleId)
  const tabs = new Map()
  for (const { group, items } of HR_NAV) {
    for (const tab of items) {
      const tabRule = { perm: tab.perm, anyOf: tab.anyOf }
      tabs.set(tab.key, tab)
      add({
        path: "/hr/dashboard",
        params: `tab=${tab.key}`,
        label: tab.label,
        group: `${HR_HUB_LABEL} · ${group}`,
        icon: tab.icon,
        keywords: tab.keywords,
        weakKeywords: [tab.description, ...permissionWords(tabRule)],
        // Both gates: the route's anyOf, then the tab's own key (the route doesn't list every tab key).
        rule: ({ roleId }) => insideHub(roleId) && checkAccess(tabRule, roleId),
        source: "hrTab",
      })
    }
  }

  for (const sub of HR_SUB_TABS) {
    const tab = tabs.get(sub.tab)
    const subRule = { perm: sub.perm, anyOf: sub.anyOf }
    add({
      path: "/hr/dashboard",
      params: `tab=${sub.tab}&sub=${sub.sub}`,
      label: sub.label,
      group: `${HR_HUB_LABEL} · ${tab.label}`,
      icon: tab.icon,
      keywords: sub.keywords,
      weakKeywords: permissionWords(subRule),
      rule: ({ roleId }) =>
        insideHub(roleId) && checkAccess({ perm: tab.perm, anyOf: tab.anyOf }, roleId) && checkAccess(subRule, roleId),
      source: "hrSubTab",
    })
  }

  for (const v of MY_DISCIPLINE_VIEWS) {
    add({
      path: "/my-discipline",
      params: `view=${v.view}`,
      label: v.label,
      group: "แจ้งเรื่อง / ประวัติการตักเตือน",
      icon: byId.get("/my-discipline").icon,
      gated: true,
      keywords: v.keywords,
      weakKeywords: permissionWords(v),
      rule: ({ roleId }) => checkAccess({ perm: v.perm }, roleId),
      source: "myDisciplineView",
    })
  }

  for (const report of DOCUMENT_REPORTS) {
    const perm = reportPerm(report)
    add({
      path: "/documents",
      params: `report=${report.key}`,
      label: report.title,
      group: reportGroup(report.key),
      icon: FileText,
      keywords: ["รายงาน", "report", ...report.keywords],
      weakKeywords: permissionWords({ perm }),
      rule: ({ roleId }) => checkAccess({ anyOf: DOCUMENTS_PERMS }, roleId) && checkAccess({ perm }, roleId),
      source: "report",
    })
  }

  // A hidden twin's words keep finding the row that is shown instead.
  for (const entry of byId.values()) {
    const target = entry.supersededBy && byId.get(entry.supersededBy)
    if (target) target.keywords.push(entry.label, ...entry.keywords)
  }

  for (const entry of byId.values()) {
    entry.keywords = [...new Set(entry.keywords)].filter((k) => k !== entry.label)
    entry.weakKeywords = [...new Set(entry.weakKeywords)]
  }
  return [...byId.values()]
}

export const FUNCTION_CATALOGUE = buildCatalogue()

let searchIndexCache = null
/** Normalised keys for the catalogue: built on first search, then shared. */
export function getFunctionSearchIndex() {
  if (!searchIndexCache) searchIndexCache = buildSearchIndex(FUNCTION_CATALOGUE)
  return searchIndexCache
}

/**
 * ids of the entries this user can open. `perms` = useCan() (recomputed when permissions or
 * act-as-role change). An entry whose twin is also open steps aside so one screen shows once.
 */
export function visibleFunctionIds(perms) {
  const open = new Set(FUNCTION_CATALOGUE.filter((e) => e.rules.some((rule) => rule(perms))).map((e) => e.id))
  for (const entry of FUNCTION_CATALOGUE) {
    if (entry.supersededBy && open.has(entry.supersededBy)) open.delete(entry.id)
  }
  return open
}

/** Dev only: warns when a report in Documents.jsx is missing here or its key differs. */
export function checkDocumentReports(reports) {
  const known = new Map(DOCUMENT_REPORTS.map((r) => [r.key, r]))
  for (const { key, title, perm } of reports) {
    const mine = known.get(key)
    if (!mine) console.warn(`[functionCatalogue] report "${key}" is missing from DOCUMENT_REPORTS: the header search can't find it`)
    else if (mine.title !== title) console.warn(`[functionCatalogue] report "${key}" title differs: "${mine.title}" vs "${title}"`)
    else if (perm && reportPerm(mine) !== perm) console.warn(`[functionCatalogue] report "${key}" permission differs: ${reportPerm(mine)} vs ${perm}`)
  }
}
