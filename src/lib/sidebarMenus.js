// src/lib/sidebarMenus.js
// รายการเมนูของ Sidebar (ย้ายออกจาก components/Sidebar.jsx ให้ช่องค้นหาฟังก์ชันใน Topbar อ่านชุดเดียวกัน)
// No React components are exported from here (react-refresh rule).
import {
  ArrowRightLeft,
  ClipboardCheck,
  Compass,
  CreditCard,
  FileBadge,
  FileText,
  HeartHandshake,
  House,
  Inbox,
  MapPin,
  MapPinCheck,
  PiggyBank,
  ReceiptText,
  ShieldAlert,
  ShieldCheck,
  Target,
  UserRound,
} from "lucide-react"
import { HR_HUB_PERMS } from "./permissions"

// บริการตนเอง — รายการชุดเดียวที่ทั้งสองเมนูใช้ร่วมกัน (api-handoff 2026-10-17 §4–5)
// เพิ่ม/ลบที่นี่ที่เดียว เมนูตามตำแหน่งจะได้ไม่ตกหล่นรายการใดรายการหนึ่ง
//   perm      = ต้องมีสิทธิ์นี้
//   unlessAny = ซ่อนถ้ามีสิทธิ์ใดสิทธิ์หนึ่งในนี้ (เช่น KPI: คนที่เข้า Dashboard HR ได้ใช้แท็บ KPI ในนั้นแทน)
//   gated     = ล็อกไว้จนกว่าจะกรอกข้อมูลเริ่มต้นครบ (onboarding PR 59 — backend ตอบ 403 ONBOARDING_REQUIRED)
export const SELF_SERVICE_MENUS = [
  { label: "ข้อมูลส่วนตัว",       icon: UserRound,      tone: "sky",     path: "/my-profile",    perm: "self.profile.view" },
  { label: "ข้อมูลการเงินของฉัน",  icon: PiggyBank,      tone: "teal",    path: "/my-financial",  perm: "self.payroll.view", gated: true },
  { label: "สลิปเงินเดือนของฉัน",  icon: ReceiptText,    tone: "emerald", path: "/my-payslips",   perm: "self.payroll.view", gated: true },
  { label: "กล่องงานรออนุมัติ",   icon: Inbox,          tone: "amber",   path: "/inbox", badgeKey: "inbox" },
  { label: "ยื่นใบลา",            icon: FileText,       tone: "emerald", path: "/leave-request", perm: "self.leave.request", gated: true },
  { label: "ขอออกนอกสถานที่",     icon: MapPin,         tone: "orange",  path: "/out-of-office", perm: "self.ooo.request", gated: true },
  { label: "คำขอย้ายสาขา",        icon: ArrowRightLeft, tone: "violet",  path: "/my-relocation", perm: "self.relocation.request", gated: true },
  { label: "ขอสินเชื่อ",           icon: CreditCard,     tone: "rose",    path: "/loan-request",  perm: "self.loan.apply", gated: true },
  { label: "ขอหนังสือรับรองเงินเดือน", icon: FileBadge,  tone: "teal",    path: "/my-salary-cert", perm: "self.salaryCert.request", gated: true },
  { label: "สวัสดิการของฉัน",      icon: HeartHandshake, tone: "rose",    path: "/my-welfare",    perm: "self.welfare.view", gated: true },
  { label: "ผลการประเมินของฉัน",   icon: ClipboardCheck, tone: "indigo",  path: "/my-kpi",        perm: "self.kpi.result", gated: true },
  { label: "แจ้งเรื่อง / ประวัติการตักเตือน", icon: ShieldAlert, tone: "amber", path: "/my-discipline", anyOf: ["self.discipline.report", "self.discipline.history"], gated: true },
  // KPI v1.4.0 — ผจก. อนุมัติ / ผช.ผจก. ตรวจสอบ (ผู้ที่เข้า Dashboard HR ได้ใช้แท็บ KPI ในนั้น)
  { label: "ประเมิน KPI / เลื่อนขั้น", icon: Target,     tone: "indigo",  path: "/hr/kpi",       perm: "hr.kpi.evaluations.view", unlessAny: HR_HUB_PERMS },
]

// เมนูแบบย่อสำหรับผู้ใช้ที่มีสิทธิ์ nav.hrCompactMenu (ฝ่ายบุคคล) — หน้าหลักของกลุ่มนี้คือ /hr/dashboard
export const HR_MENUS = [
  { label: "หน้าหลัก",            icon: House,          tone: "indigo",  path: "/hr/dashboard",  anyOf: HR_HUB_PERMS },
  ...SELF_SERVICE_MENUS,
]

// เมนูปกติ — งานที่มีการ์ดในหน้าหลัก (/home) อยู่แล้วไม่ต้องซ้ำในนี้ (§6): เอา "Dashboard HR" ออก
// เพราะการ์ด "ภาพรวมงานบุคคล" ใน Home ใช้สิทธิ์ชุดเดียวกัน (HR_HUB_PERMS)
export const PERSONAL_MENUS = [
  { label: "หน้าหลัก",            icon: House,      tone: "indigo",  path: "/home" },
  ...SELF_SERVICE_MENUS,
  { label: "อนุมัติออกนอกสถานที่", icon: MapPinCheck, tone: "teal",  path: "/out-of-office/approvals", perm: "hr.ooo.list" },
  { label: "สิทธิ์ตามบทบาท",      icon: ShieldCheck, tone: "violet", path: "/admin/roles", perm: "admin.roles.view" },
  { label: "ตัวอย่างการเริ่มใช้งาน", icon: Compass,    tone: "indigo", path: "/admin/onboarding", perm: "admin.onboarding.view" },
  // "รายรับ-รายจ่ายสถานที่" ย้ายไปกลุ่ม "รายงาน & แผน" ในหน้า Home แล้ว
]

export function canSeeSidebarItem(item, { can, canAny }) {
  if (item.perm && !can(item.perm)) return false
  if (item.anyOf && !canAny(item.anyOf)) return false
  if (item.unless && can(item.unless)) return false
  if (item.unlessAny && canAny(item.unlessAny)) return false
  return true
}
