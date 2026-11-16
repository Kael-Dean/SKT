// src/lib/homeFunctions.js
// ─────────────────────────────────────────────────────────────────────────────
// The function catalogue of the app (moved out of pages/work/Home.jsx so the
// Sidebar's phone-only "ธุรกิจรวบรวมผลผลิต" section, the Home shortcut strip
// and recentRoutes.js read the same list).
//
//   ALL_FUNCTIONS   [{ group, color, items: [{ label, path, perm | anyOf, allow?, gated? }] }]
//                   gated = self-service item locked until onboarding is done (PR 59)
//   TRADING_GROUP   the trading subset shown in the Sidebar on phones
//   TRADING_PATHS   Set of every path in the trading module (groups 1–3) —
//                   recentRoutes only remembers these
//   canAccessItem(item, roleId)   permission check shared by Home + Sidebar
//   lucideFor(path)               lucide icon component for a path (line-art)
//   iconToneFor(path)             chip classes (background + icon colour) for a path;
//                                 used by the desktop tiles on Home
// No React components are exported from here (react-refresh rule).
// ─────────────────────────────────────────────────────────────────────────────
import {
  ArrowDownToLine,
  ArrowUpFromLine,
  Banknote,
  Building,
  Building2,
  CalendarCheck,
  CalendarDays,
  ClipboardList,
  CreditCard,
  Factory,
  FileText,
  LayoutDashboard,
  LayoutGrid,
  ListChecks,
  Map,
  PackageCheck,
  PackageMinus,
  PiggyBank,
  ReceiptText,
  Recycle,
  Settings,
  ShoppingCart,
  Tags,
  TrendingUp,
  TriangleAlert,
  UserPlus,
  UserRoundPlus,
  UserSearch,
  UserX,
  Users,
  Wallet,
  Warehouse,
  Wheat,
} from "lucide-react"
import { DOCUMENTS_PERMS, HR_HUB_PERMS, canBringInMill, canSeeAddCompany, checkAccess } from "./permissions"

// ฟังก์ชันทั้งหมดที่ใช้ในการทำงาน — แต่ละการ์ดแสดงตาม permission key
// (perm / anyOf / allow — ดู checkAccess ใน src/lib/permissions.js)
export const ALL_FUNCTIONS = [
  {
    group: "ธุรกิจรวบรวมผลผลิต",
    color: "from-green-400 to-emerald-500",
    items: [
      { label: "ยกมา", path: "/bring-in", perm: "stock.carryover.record" },
      { label: "ยกเข้าโรงสี", path: "/bring-in-mill", perm: "stock.mill.record", allow: canBringInMill },
      { label: "ซื้อข้าว", path: "/Buy", perm: "trading.buy.create" },
      { label: "ขายข้าว", path: "/sales", perm: "trading.sell.create" },
      { label: "รับเข้า", path: "/transfer-in", perm: "stock.transfer.confirm" },
      { label: "โอนออก", path: "/transfer-out", perm: "stock.transfer.request" },
      { label: "ส่งสี", path: "/transfer-mill", perm: "stock.mill.record" },
      { label: "ตัดเสียหาย", path: "/damage-out", perm: "stock.cutloss.record" },
    ],
  },
  {
    group: "ทะเบียนสมาชิก",
    color: "from-blue-400 to-indigo-500",
    items: [
      { label: "สมัครสมาชิก", path: "/member-signup", perm: "members.create" },
      { label: "เพิ่มลูกค้าทั่วไป", path: "/customer-add", perm: "customers.create" },
      { label: "แก้ไขคู่ค้า/บริษัท", path: "/company-add", perm: "customers.create", allow: canSeeAddCompany },
      { label: "ค้นหาสมาชิก", path: "/search", perm: "members.search" },
      { label: "ค้นหาลูกค้าทั่วไป", path: "/customer-search", perm: "members.search" },
      { label: "สมาชิกสิ้นสภาพ", path: "/member-termination", perm: "members.status" },
      { label: "ซื้อหุ้น", path: "/share", perm: "shares.buy" },
    ],
  },
  {
    group: "ออเดอร์ & คลังสินค้า",
    color: "from-orange-400 to-amber-500",
    items: [
      { label: "ดูออเดอร์ซื้อขาย", path: "/order", perm: "trading.reports.view" },
      { label: "แก้ไขออเดอร์", path: "/order-correction", perm: "trading.orders.edit" },
      { label: "คลังสินค้า", path: "/stock", perm: "trading.reports.view" },
      { label: "เพิ่มรหัสข้าว", path: "/spec/create", perm: "stock.spec.manage" },
      { label: "จัดการรหัสข้าว", path: "/spec/manage", perm: "stock.spec.manage" },
    ],
  },
  {
    group: "รายงาน & แผน",
    color: "from-purple-400 to-violet-500",
    items: [
      { label: "รายงาน", path: "/documents", anyOf: DOCUMENTS_PERMS },
      { label: "แผนปฏิบัติงานรายปี", path: "/operation-plan", perm: "plan.saleGoals.view" },
      { label: "แก้ไขข้อมูลธุรกิจ", path: "/business-edit", perm: "plan.master.products" },
      { label: "ติดตามหนี้", path: "/debt-hub", perm: "debt.view" },
      { label: "รายได้-ค่าใช้จ่ายศูนย์เรียนรู้และพัฒนาผลิตภัณฑ์", path: "/facility-report", perm: "facility.view" },
    ],
  },
  {
    group: "งานบุคคล",
    color: "from-rose-400 to-pink-500",
    items: [
      { label: "ภาพรวมงานบุคคล",     path: "/hr/dashboard",    anyOf: HR_HUB_PERMS },
      { label: "ลงทะเบียนเจ้าหน้าที่", path: "/hr/staff-signup",  perm: "hr.employees.create" },
      { label: "รายชื่อเจ้าหน้าที่",    path: "/hr/users",         perm: "hr.employees.list" },
      { label: "อนุมัติใบลา",       path: "/hr/leaves",        perm: "hr.leave.list" },
      { label: "ข้อมูลการเงิน",     path: "/hr/finance",       perm: "hr.employees.editFinancial" },
      { label: "ย้ายสาขา",          path: "/hr/relocation",    perm: "hr.relocation.list" },
      { label: "ขอสินเชื่อ",         path: "/loan-request",     perm: "self.loan.apply", gated: true },
      { label: "สลิปเงินเดือนของฉัน", path: "/my-payslips",      perm: "self.payroll.view", gated: true },
      { label: "ปฏิทินวันหยุด",      path: "/holidays",         perm: "hr.holidays.view" },
      { label: "ข้อมูลการเงินของฉัน", path: "/my-financial",     perm: "self.payroll.view", gated: true },
    ],
  },
]

/** The trading module on phones: buy/sell/stock movements + orders/stock pages. */
export const TRADING_GROUP = {
  group: "ธุรกิจรวบรวมผลผลิต",
  items: [
    ...ALL_FUNCTIONS[0].items,
    ...ALL_FUNCTIONS[2].items.filter((i) => i.path !== "/spec/create" && i.path !== "/spec/manage"),
  ],
}

/** Every path of the trading module (groups 1–3) — scope of recentRoutes. */
export const TRADING_PATHS = new Set(ALL_FUNCTIONS.slice(0, 3).flatMap((g) => g.items.map((i) => i.path)))

/** All items flattened (for lookups by path). */
export const ALL_ITEMS = ALL_FUNCTIONS.flatMap((g) => g.items)

export function canAccessItem(item, roleId) {
  return checkAccess({ perm: item.perm, anyOf: item.anyOf, allow: item.allow }, roleId)
}

const ICONS = {
  "/bring-in": ArrowDownToLine,
  "/bring-in-mill": Factory,
  "/Buy": ShoppingCart,
  "/sales": Banknote,
  "/transfer-in": PackageCheck,
  "/transfer-out": ArrowUpFromLine,
  "/transfer-mill": Recycle,
  "/damage-out": TriangleAlert,
  "/member-signup": UserPlus,
  "/customer-add": UserRoundPlus,
  "/company-add": Building2,
  "/search": UserSearch,
  "/customer-search": UserSearch,
  "/member-termination": UserX,
  "/share": TrendingUp,
  "/order": ClipboardList,
  "/order-correction": ListChecks,
  "/stock": Warehouse,
  "/spec/create": Wheat,
  "/spec/manage": Tags,
  "/documents": FileText,
  "/operation-plan": Map,
  "/business-edit": Settings,
  "/debt-hub": CreditCard,
  "/facility-report": Building,
  "/hr/dashboard": LayoutDashboard,
  "/hr/staff-signup": UserPlus,
  "/hr/users": Users,
  "/hr/leaves": CalendarCheck,
  "/hr/finance": Wallet,
  "/hr/relocation": Building2,
  "/loan-request": CreditCard,
  "/my-payslips": ReceiptText,
  "/my-financial": PiggyBank,
  "/holidays": CalendarDays,
}

/** Lucide icon component for a function path (falls back to a generic grid). */
export function lucideFor(path) {
  return ICONS[path] ?? LayoutGrid
}

// Class names are written out in full: Tailwind v4 can't detect concatenated names.
const ICON_TONES = {
  blue: "bg-blue-50 text-blue-600 dark:bg-raised dark:ring-1 dark:ring-inset dark:ring-line dark:text-blue-200/75",
  sky: "bg-sky-50 text-sky-600 dark:bg-raised dark:ring-1 dark:ring-inset dark:ring-line dark:text-sky-200/75",
  amber: "bg-amber-50 text-amber-600 dark:bg-raised dark:ring-1 dark:ring-inset dark:ring-line dark:text-amber-200/75",
  orange: "bg-orange-50 text-orange-600 dark:bg-raised dark:ring-1 dark:ring-inset dark:ring-line dark:text-orange-200/75",
  rose: "bg-rose-50 text-rose-600 dark:bg-raised dark:ring-1 dark:ring-inset dark:ring-line dark:text-rose-200/75",
  emerald: "bg-emerald-50 text-emerald-600 dark:bg-raised dark:ring-1 dark:ring-inset dark:ring-line dark:text-emerald-200/75",
  lime: "bg-lime-50 text-lime-600 dark:bg-raised dark:ring-1 dark:ring-inset dark:ring-line dark:text-lime-200/75",
  teal: "bg-teal-50 text-teal-600 dark:bg-raised dark:ring-1 dark:ring-inset dark:ring-line dark:text-teal-200/75",
  indigo: "bg-indigo-50 text-indigo-600 dark:bg-raised dark:ring-1 dark:ring-inset dark:ring-line dark:text-indigo-200/75",
  violet: "bg-violet-50 text-violet-600 dark:bg-raised dark:ring-1 dark:ring-inset dark:ring-line dark:text-violet-200/75",
  slate: "bg-slate-100 text-slate-600 dark:bg-white/[.06] dark:text-gray-300",
}

// Each tile keeps the colour of the emoji it used to show.
const PATH_TONES = {
  "/bring-in": "blue",
  "/bring-in-mill": "rose",
  "/Buy": "slate",
  "/sales": "amber",
  "/transfer-in": "blue",
  "/transfer-out": "orange",
  "/transfer-mill": "sky",
  "/damage-out": "amber",
  "/member-signup": "orange",
  "/customer-add": "orange",
  "/company-add": "orange",
  "/search": "sky",
  "/customer-search": "sky",
  "/member-termination": "blue",
  "/share": "rose",
  "/order": "orange",
  "/order-correction": "slate",
  "/stock": "rose",
  "/spec/create": "lime",
  "/spec/manage": "amber",
  "/documents": "orange",
  "/operation-plan": "teal",
  "/business-edit": "slate",
  "/debt-hub": "sky",
  "/facility-report": "slate",
  "/hr/dashboard": "indigo",
  "/hr/staff-signup": "violet",
  "/hr/users": "orange",
  "/hr/leaves": "blue",
  "/hr/finance": "amber",
  "/hr/relocation": "slate",
  "/loan-request": "sky",
  "/my-payslips": "slate",
  "/my-financial": "emerald",
  "/holidays": "blue",
}

/** Chip classes (background + icon colour) for a function path (falls back to slate). */
export function iconToneFor(path) {
  return ICON_TONES[PATH_TONES[path]] ?? ICON_TONES.slate
}
