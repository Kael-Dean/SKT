// src/lib/homeFunctions.js
// ─────────────────────────────────────────────────────────────────────────────
// The function catalogue of the app (moved out of pages/work/Home.jsx so the
// Sidebar's phone-only "ธุรกิจรวบรวมผลผลิต" section, the Home shortcut strip
// and recentRoutes.js read the same list).
//
//   ALL_FUNCTIONS   [{ group, icon, color, items: [{ label, path, icon, perm | anyOf, allow? }] }]
//   TRADING_GROUP   the trading subset shown in the Sidebar on phones
//   TRADING_PATHS   Set of every path in the trading module (groups 1–3) —
//                   recentRoutes only remembers these
//   canAccessItem(item, roleId)   permission check shared by Home + Sidebar
//   lucideFor(path)               lucide icon component for a path (line-art;
//                                 the emoji `icon` field stays for the desktop tiles)
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
    icon: "🌾",
    color: "from-green-400 to-emerald-500",
    items: [
      { label: "ยกมา", path: "/bring-in", icon: "📤", perm: "stock.carryover.record" },
      { label: "ยกเข้าโรงสี", path: "/bring-in-mill", icon: "🏭", perm: "stock.mill.record", allow: canBringInMill },
      { label: "ซื้อข้าว", path: "/Buy", icon: "🛒", perm: "trading.buy.create" },
      { label: "ขายข้าว", path: "/sales", icon: "💰", perm: "trading.sell.create" },
      { label: "รับเข้า", path: "/transfer-in", icon: "📥", perm: "stock.transfer.confirm" },
      { label: "โอนออก", path: "/transfer-out", icon: "📦", perm: "stock.transfer.request" },
      { label: "ส่งสี", path: "/transfer-mill", icon: "🔄", perm: "stock.mill.record" },
      { label: "ตัดเสียหาย", path: "/damage-out", icon: "⚠️", perm: "stock.cutloss.record" },
    ],
  },
  {
    group: "ทะเบียนสมาชิก",
    icon: "🪪",
    color: "from-blue-400 to-indigo-500",
    items: [
      { label: "สมัครสมาชิก", path: "/member-signup", icon: "📝", perm: "members.create" },
      { label: "เพิ่มลูกค้าทั่วไป", path: "/customer-add", icon: "📝", perm: "customers.create" },
      { label: "เพิ่มบริษัท", path: "/company-add", icon: "📝", perm: "customers.create", allow: canSeeAddCompany },
      { label: "ค้นหาสมาชิก", path: "/search", icon: "🔎", perm: "members.search" },
      { label: "ค้นหาลูกค้าทั่วไป", path: "/customer-search", icon: "🔎", perm: "members.search" },
      { label: "สมาชิกสิ้นสภาพ", path: "/member-termination", icon: "🪪", perm: "members.status" },
      { label: "ซื้อหุ้น", path: "/share", icon: "📈", perm: "shares.buy" },
    ],
  },
  {
    group: "ออเดอร์ & คลังสินค้า",
    icon: "📦",
    color: "from-orange-400 to-amber-500",
    items: [
      { label: "ดูออเดอร์ซื้อขาย", path: "/order", icon: "📝", perm: "trading.reports.view" },
      { label: "แก้ไขออเดอร์", path: "/order-correction", icon: "🛠️", perm: "trading.orders.edit" },
      { label: "คลังสินค้า", path: "/stock", icon: "🏭", perm: "trading.reports.view" },
      { label: "เพิ่มรหัสข้าว", path: "/spec/create", icon: "🌾", perm: "stock.spec.manage" },
      { label: "จัดการรหัสข้าว", path: "/spec/manage", icon: "🏷️", perm: "stock.spec.manage" },
    ],
  },
  {
    group: "รายงาน & แผน",
    icon: "📊",
    color: "from-purple-400 to-violet-500",
    items: [
      { label: "รายงาน", path: "/documents", icon: "📝", anyOf: DOCUMENTS_PERMS },
      { label: "แผนปฏิบัติงานรายปี", path: "/operation-plan", icon: "🗺️", perm: "plan.saleGoals.view" },
      { label: "แก้ไขข้อมูลธุรกิจ", path: "/business-edit", icon: "⚙️", perm: "plan.master.products" },
      { label: "ติดตามหนี้", path: "/debt-hub", icon: "💳", perm: "debt.view" },
      { label: "รายได้-ค่าใช้จ่ายศูนย์เรียนรู้และพัฒนาผลิตภัณฑ์", path: "/facility-report", icon: "🏢", perm: "facility.view" },
    ],
  },
  {
    group: "งานบุคคล",
    icon: "👥",
    color: "from-rose-400 to-pink-500",
    items: [
      { label: "ภาพรวมงานบุคคล",     path: "/hr/dashboard",    icon: "👥", anyOf: HR_HUB_PERMS },
      { label: "ลงทะเบียนเจ้าหน้าที่", path: "/hr/staff-signup",  icon: "➕", perm: "hr.employees.create" },
      { label: "รายชื่อเจ้าหน้าที่",    path: "/hr/users",         icon: "📋", perm: "hr.employees.list" },
      { label: "อนุมัติใบลา",       path: "/hr/leaves",        icon: "📅", perm: "hr.leave.list" },
      { label: "ข้อมูลการเงิน",     path: "/hr/finance",       icon: "💰", perm: "hr.employees.editFinancial" },
      { label: "ย้ายสาขา",          path: "/hr/relocation",    icon: "🏢", perm: "hr.relocation.list" },
      { label: "ขอสินเชื่อ",         path: "/loan-request",     icon: "💳", perm: "self.loan.apply" },
      { label: "สลิปเงินเดือนของฉัน", path: "/my-payslips",      icon: "🧾", perm: "self.payroll.view" },
      { label: "ปฏิทินวันหยุด",      path: "/holidays",         icon: "🗓️", perm: "hr.holidays.view" },
      { label: "ข้อมูลการเงินของฉัน", path: "/my-financial",     icon: "💵", perm: "self.payroll.view" },
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
