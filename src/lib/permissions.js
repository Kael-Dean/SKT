// src/lib/permissions.js
// ─────────────────────────────────────────────────────────────────────────────
// Permission registry กลาง — ทุกการเช็คสิทธิ์ในหน้าเว็บต้องผ่านไฟล์นี้
//
//   import { can } from "../lib/permissions"
//   if (can("hr.leave.approve.branchHead")) …
//   <RequirePermission perm="hr.dashboard.view">…</RequirePermission>   (route guard)
//   <Can perm="hr.payroll.generate">…</Can> / const { can } = useCan()   (ซ่อน/แสดง UI)
//
// ที่มาของสิทธิ์ (backend PR #13 — AMC_Role_Permission_Matrix.xlsx):
//   ผู้ใช้แต่ละคนมี "ตำแหน่ง" (role 101–142) หรือ Super Admin (role 1) และแต่ละ API เช็ค "permission code"
//   (เช่น plan.report.org). หน้าเว็บอ่านรายการ code ของผู้ใช้จาก GET /auth/me/permissions (myPermissions.js)
//   แล้วเทียบกับ `code` ของคีย์ในตารางนี้ — **ไม่ตัดสินจากเลข role**
//
//   code: ไม่ระบุ        → code ใน rbacMatrix.js ที่มีเลขฟังก์ชัน (no) เดียวกัน
//         "code.x"        → ต้องมี code นี้
//         ["a", "b"]      → มีอย่างน้อยหนึ่ง (หน้า list ที่ผู้อนุมัติหลายขั้นเข้าได้ ตรงกับ backend)
//         "login"         → ทุกคนที่ล็อกอิน (lookup / self-service ที่ backend ไม่เช็ค code)
//         "superadmin"    → role 1 เท่านั้น
//         (me) => boolean → กฎเฉพาะหน้าเว็บ (me = { roleId, scope, senior, has(code) })
//   roles: legacy — guard ของ backend รุ่นก่อน PR #13 (role 1–7). ใช้เฉพาะตอน backend ยังไม่มี
//          /auth/me/permissions (ตอบ 404) เพื่อให้ main deploy ก่อน backend ได้โดยไม่พัง
//          number[] = role ที่ได้ · "any" = ทุกคนที่ล็อกอิน · "public" = ไม่ต้องล็อกอิน (ใช้ทั้งสองโหมด)
//   variant: true    → คีย์ย่อยของฟังก์ชันเดียวกัน (เช่น GET เปิดกว้างกว่า PATCH)
//   feOnly: true     → กฎเฉพาะหน้าเว็บ (ไม่มีในตาราง matrix) — เช่นเมนู HR แบบย่อ
//
// AMC แก้ matrix → backend generate rbac_matrix.py ใหม่ → คัดลอกมาเป็น src/lib/rbacMatrix.js (ไม่ต้องแก้ไฟล์นี้)
// เพิ่ม permission ใหม่: เพิ่ม entry ที่นี่ (คีย์แบบ dotted ไม่เปลี่ยนชื่อภายหลัง) แล้วใช้ can()/<Can>
// ห้าม hardcode เลข role ใน component — ใช้คีย์เสมอ
// ─────────────────────────────────────────────────────────────────────────────
import { useMemo } from "react"
import { getRoleId, getUser } from "./auth"
import { ROLE, ROLE_IDS, ROLE_LABEL, SUPER_ADMIN, HR_POSITION_IDS, MANAGER_POSITION_ID, POSITION_ROLE_OPTIONS } from "./roles"
import { PERMISSION_MATRIX, POSITION_ROLES } from "./rbacMatrix"
import { getMyPermissions, getMyPermissionsVersion, useMyPermissionsVersion } from "./myPermissions"

/** ชื่อโมดูลภาษาไทย (คีย์ = module ภาษาอังกฤษจาก matrix) */
export const MODULE_LABEL = Object.freeze({
  "Account": "บัญชีผู้ใช้",
  "Employee self-service": "บริการตนเองของพนักงาน",
  "HR: Employee records": "HR · ทะเบียนพนักงาน",
  "HR: Leave": "HR · การลา",
  "HR: Holidays": "HR · วันหยุด",
  "HR: Relocation": "HR · ย้ายสาขา",
  "HR: Issue reports": "HR · แจ้งแก้ไขข้อมูล",
  "HR: Out-of-office": "HR · ออกนอกสถานที่",
  "HR: Payroll": "HR · จ่ายเงินเดือน",
  "HR: Positions, salary & promotions": "HR · ตำแหน่ง ขั้นเงินเดือน เลื่อนตำแหน่ง",
  "HR: KPI evaluation": "HR · ประเมิน KPI",
  "HR: Staff loans": "HR · สินเชื่อพนักงาน",
  "HR: Salary certificates": "HR · หนังสือรับรองเงินเดือน",
  "HR: Welfare": "HR · สวัสดิการ",
  "HR: Discipline": "HR · วินัยและการตักเตือน",
  "HR: System": "HR · ระบบ",
  "HR: Reports": "HR · รายงาน",
  "Debt accounting": "บัญชีหนี้",
  "Facility income/expense": "รายรับ-รายจ่ายศูนย์เรียนรู้",
  "Annual plan: master data": "แผนรายปี · ข้อมูลหลัก",
  "Annual plan: data entry": "แผนรายปี · บันทึกข้อมูล",
  "Annual plan: reports": "แผนรายปี · รายงาน",
  "Members & customers": "สมาชิกและลูกค้า",
  "Shares": "หุ้น",
  "Trading (buy / sell)": "ซื้อ-ขาย",
  "Warehouse & stock": "คลังสินค้า",
  "Phase 1 reports": "รายงาน Phase 1",
  "Frontend only": "เฉพาะหน้าเว็บ",
})

// ตำแหน่งที่เห็นคิวสินเชื่อ (handoff #30) — ใช้ตารางใน rbacMatrix.js เผื่อ /auth/me/permissions ยังไม่ส่ง code loan.queue
const LOAN_QUEUE_POSITIONS = new Set(PERMISSION_MATRIX["loan.queue"]?.roles ?? [])

export const PERMISSIONS = Object.freeze({

  // ── Account ──
  "account.login": { no: 1, module: "Account", label: "เข้าสู่ระบบ / ออกจากระบบ", en: "Log in / out", roles: "public" },
  "account.password.change": { no: 2, module: "Account", label: "เปลี่ยนรหัสผ่านของตนเอง", en: "Change own password", roles: "any" },
  "account.password.reset": { no: 3, module: "Account", label: "ขอรีเซ็ตรหัสผ่านผ่าน LINE", en: "Request password reset via LINE", roles: "public" },
  "account.branch.switch": { code: "account.switch_branch", no: 4, module: "Account", label: "สลับสาขาที่ทำงาน", en: "Switch active branch", roles: "any", note: "POST /auth/switch-branch — account.switch_branch (Super Admin ผ่านเสมอ)" },
  "account.notifications": { no: 5, module: "Account", label: "ดูการแจ้งเตือนของตนเอง", en: "View own notifications", roles: "any" },

  // ── Employee self-service ──
  "self.profile.view": { no: 6, module: "Employee self-service", label: "ดูข้อมูลส่วนตัว / ตำแหน่ง / สาขาของตนเอง", en: "View own profile, position, branches", roles: "any" },
  "self.history.view": { no: 7, module: "Employee self-service", label: "ดูประวัติตำแหน่ง ขั้นเงินเดือน และการย้ายสาขาของตนเอง", en: "View own position / salary / relocation history", roles: "any" },
  "self.payroll.view": { no: 8, module: "Employee self-service", label: "ดูข้อมูลการเงินและสลิปเงินเดือนของตนเอง", en: "View own financial info & payslips", roles: "any" },
  "self.leave.request": { no: 9, module: "Employee self-service", label: "ยื่นใบลา", en: "Submit own leave request", roles: "any" },
  "self.leave.view": { no: 10, module: "Employee self-service", label: "ดูโควตา / ประวัติการลา และพิมพ์ใบลาของตนเอง", en: "View own leave balance / history / print form", roles: "any" },
  "self.leave.cancel": { no: 11, module: "Employee self-service", label: "ยกเลิกใบลาของตนเอง (ที่ยังรออนุมัติ)", en: "Cancel own pending leave", roles: "any" },
  "self.relocation.request": { no: 12, module: "Employee self-service", label: "ยื่นคำขอย้ายสาขา", en: "Submit relocation request", roles: "any" },
  "self.relocation.view": { no: 13, module: "Employee self-service", label: "ดูคำขอย้ายสาขาของตนเอง", en: "View own relocation requests", roles: "any" },
  "self.issue.report": { no: 14, module: "Employee self-service", label: "แจ้งแก้ไขข้อมูลส่วนตัว (ส่งให้ HR)", en: "Report data issue to HR", roles: "any" },
  "self.loan.apply": { no: 15, module: "Employee self-service", label: "ขอกู้เงินพนักงาน", en: "Apply for staff loan", roles: "any" },
  "self.loan.view": { no: 16, module: "Employee self-service", label: "ดูสินเชื่อและตารางผ่อนชำระของตนเอง", en: "View own loans & repayment schedule", roles: "any" },
  "self.salaryCert.request": { no: 17, module: "Employee self-service", label: "ขอหนังสือรับรองเงินเดือน", en: "Request salary certificate", roles: "any" },
  "self.kpi.view": { no: 18, module: "Employee self-service", label: "ดูผลประเมิน KPI ของตนเอง", en: "View own KPI results", roles: "any" },
  "self.ooo.request": { no: 19, module: "Employee self-service", label: "ยื่นขอออกนอกพื้นที่ / ดู / ยกเลิก", en: "File / view / cancel own out-of-office request", roles: "any" },
  // 3L — แบบประเมินตนเอง + ผลหลังอนุมัติ (PUT /personnel/me/kpi/self-assessment · GET /personnel/me/kpi/result)
  "self.kpi.result": { no: 18, module: "Employee self-service", label: "ประเมินตนเอง / ดูผลการประเมินของฉัน (หลังอนุมัติ)", en: "Own KPI self-assessment / approved result", roles: "any", variant: true },
  // 3P / 3Q — self-service ที่ backend เช็คแค่การล็อกอิน (ยังไม่มีเลขฟังก์ชันใน matrix)
  "self.welfare.view": { code: "login", no: null, module: "Employee self-service", label: "ดูสวัสดิการของฉัน (คำขอเบิก / สิทธิ์คงเหลือ / ครอบครัวที่ได้รับสิทธิ์)", en: "View own welfare", roles: "any", note: "GET /personnel/me/welfare" },
  "self.discipline.report": { code: "login", no: null, module: "Employee self-service", label: "แจ้งเรื่องการกระทำผิดระเบียบของเพื่อนร่วมงาน / ดูสถานะเรื่องที่แจ้ง", en: "Report misconduct / view own reports' status", roles: "any", note: "POST/GET /personnel/me/discipline-reports" },
  "self.discipline.history": { code: "login", no: null, module: "Employee self-service", label: "ดูประวัติการตักเตือนของฉัน + หนังสือ (PDF)", en: "View own discipline history", roles: "any", note: "GET /personnel/me/discipline" },

  // ── HR: Employee records ──
  "hr.dashboard.view": { no: 20, module: "HR: Employee records", label: "ดูแดชบอร์ด HR", en: "View HR dashboard", roles: [1, 3] },
  "hr.employees.list": { no: 21, module: "HR: Employee records", label: "ค้นหา / ดูรายชื่อพนักงาน", en: "Search / list employees", roles: [1, 3] },
  "hr.employees.view": { no: 22, module: "HR: Employee records", label: "ดูโปรไฟล์พนักงานทั้งหมด (รายคน)", en: "View full employee profile", roles: [1, 3] },
  "hr.employees.export": { no: 23, module: "HR: Employee records", label: "ส่งออกรายชื่อพนักงาน", en: "Export employee list", roles: [1, 3] },
  "hr.employees.create": { no: 24, module: "HR: Employee records", label: "เพิ่มพนักงานใหม่ / สร้างบัญชีผู้ใช้", en: "Register new employee / create user", roles: [1, 3] },
  "hr.employees.editPersonal": { no: 25, module: "HR: Employee records", label: "แก้ไขข้อมูลส่วนตัว / ติดต่อ / ที่อยู่", en: "Edit personal / contact / address", roles: [1, 3] },
  "hr.employees.editFinancial": { no: 26, module: "HR: Employee records", label: "แก้ไขข้อมูลการเงินพื้นฐาน (ธนาคาร ภาษี ฯลฯ)", en: "Edit financial baseline", roles: [1, 3] },
  "hr.employees.editEducation": { no: 27, module: "HR: Employee records", label: "เพิ่ม / แก้ไข / ลบ ประวัติการศึกษา", en: "Add / edit / delete education", roles: [1, 3] },
  "hr.employees.deactivate": { no: 28, module: "HR: Employee records", label: "ระงับ / เปิดใช้งานบัญชีพนักงาน", en: "Deactivate / reactivate employee", roles: [1, 3] },
  "hr.employees.terminate": { no: 29, module: "HR: Employee records", label: "บันทึกการพ้นสภาพ + ใบสรุปการพ้นสภาพ", en: "Terminate employee + settlement record", roles: [1, 3] },
  "hr.employees.resetPassword": { no: 30, module: "HR: Employee records", label: "รีเซ็ตรหัสผ่านให้พนักงาน / ส่งข้อมูลเข้าระบบอีกครั้ง", en: "Reset password / resend credentials for staff", roles: [1, 3] },
  // 3G (PR 45) — ประวัติกิจกรรม (ประชุม / สัมมนา / ฝึกอบรม / สอบ) บนหน้าพนักงาน
  "hr.employee.activities.view": { code: "hr.employee.view", no: 22, module: "HR: Employee records", label: "ดูประวัติกิจกรรมของพนักงาน (ประชุม / สัมมนา / ฝึกอบรม / สอบ)", en: "View employee activity history", roles: [1, 3], variant: true, note: "GET /hr/employees/{id}/activities" },
  "hr.employee.activities.edit": { code: "hr.employee.edit_personal", no: 25, module: "HR: Employee records", label: "เพิ่ม / แก้ไข / ลบ ประวัติกิจกรรม + ใบประกาศ", en: "Add / edit / delete employee activities", roles: [1, 3], variant: true, note: "POST/PATCH/DELETE /hr/employees/{id}/activities" },
  "hr.employees.branchAssign": { no: 31, module: "HR: Employee records", label: "กำหนดสาขาเพิ่มเติมให้พนักงาน (ดู / เพิ่ม / ถอน)", en: "Assign extra branches to employee", roles: [1] },

  // ── HR: Leave ──
  "hr.leave.list": { code: ["leave.list", "leave.approve.head", "leave.approve.asst", "leave.confirm.manager"], no: 32, module: "HR: Leave", label: "ดูรายการใบลาทั้งหมด (กรองสถานะ/สาขา/ช่วงวันที่)", en: "List leave requests", roles: [1, 2, 3, 6, 7] },
  "hr.leave.approve.branchHead": { no: 33, module: "HR: Leave", label: "อนุมัติ / ไม่อนุมัติใบลาสั้น (<3 วัน) — หัวหน้าสาขา", en: "Branch head approve / deny short leave", roles: [1, 6] },
  "hr.leave.approve.asstManager": { no: 34, module: "HR: Leave", label: "อนุมัติใบลายาว / ใบลาของหัวหน้า — ผู้ช่วยผู้จัดการ", en: "Asst. manager approve long / head leave", roles: [1, 7] },
  "hr.leave.approve.manager": { no: 35, module: "HR: Leave", label: "ยืนยัน / ปฏิเสธใบลา — ผู้จัดการ", en: "Manager confirm / deny leave", roles: [1, 2] },
  "hr.leave.deny": { no: 36, module: "HR: Leave", label: "ไม่อนุมัติใบลา (ทุกขั้นตอน)", en: "Deny leave (any stage)", roles: [1, 2, 6, 7] },
  "hr.leave.cancelApproved": { no: 37, module: "HR: Leave", label: "ยกเลิกใบลาที่อนุมัติแล้ว + คืนโควตา", en: "Cancel approved leave & restore quota", roles: [1, 2] },
  "hr.leave.quota.view": { no: 38, module: "HR: Leave", label: "ดูโควตา / ยอดคงเหลือ / ประวัติการลาของพนักงาน", en: "View employee leave quota / balance / history", roles: [1, 3] },
  "hr.leave.quota.edit": { no: 39, module: "HR: Leave", label: "แก้ไขโควตาการลารายคน", en: "Override employee leave quota", roles: [1, 3] },
  "hr.leave.quota.reset": { no: 40, module: "HR: Leave", label: "รีเซ็ตโควตาการลาประจำปี (ทั้งองค์กร)", en: "Reset leave quotas for new fiscal year", roles: [1, 3] },
  "hr.leave.print": { no: 41, module: "HR: Leave", label: "พิมพ์ใบลาของพนักงาน", en: "Print employee leave form (PDF)", roles: [1, 3] },
  "hr.leave.calendar": { no: 42, module: "HR: Leave", label: "ดูปฏิทินการลา (แยกตามสาขา)", en: "View leave calendar", roles: [1, 3], note: "3H: GET /hr/leave-calendar/days (PR 42) · /hr/leave-calendar — หัวหน้าสาขา (110) เห็นเฉพาะสาขาที่ดูแล" },
  "hr.leaveTypes.manage": { no: 43, module: "HR: Leave", label: "ตั้งค่าประเภทการลา (โควตา / เปิด-ปิด)", en: "Configure leave types", roles: [1, 3], note: "PATCH = 1,3 · GET /hr/leave-types = ทุกคนที่ล็อกอิน (ดู hr.leaveTypes.view)" },
  "hr.leaveTypes.view": { code: "login", no: 43, module: "HR: Leave", label: "ดูประเภทการลา", en: "View leave types", roles: "any", variant: true },

  // ── HR: Holidays ──
  "hr.holidays.view": { code: "login", no: 44, module: "HR: Holidays", label: "ดูวันหยุดประจำปี", en: "View holidays", roles: "any" },
  "hr.holidays.manage": { no: 45, module: "HR: Holidays", label: "เพิ่ม / แก้ไข / ยกเลิก / คัดลอกวันหยุดข้ามปี", en: "Create / edit / cancel / copy holidays", roles: [1, 3] },
  "hr.holidayWork.view": { no: 46, module: "HR: Holidays", label: "ดูรายการทำงานในวันหยุด", en: "View holiday-work records", roles: [1, 3, 4] },
  "hr.holidayWork.manage": { no: 47, module: "HR: Holidays", label: "บันทึก / ยกเลิกการทำงานในวันหยุด", en: "Record / cancel holiday work", roles: [1, 3] },

  // ── HR: Relocation ──
  "hr.relocation.list": { no: 48, module: "HR: Relocation", label: "ดูคำขอย้ายสาขา / รายละเอียด / พิมพ์แบบฟอร์ม", en: "View relocation requests / print form", roles: [1, 2, 3] },
  "hr.relocation.approve.branchHead": { no: 49, module: "HR: Relocation", label: "อนุมัติ / ไม่อนุมัติคำขอย้าย — หัวหน้าสาขา", en: "Branch head approve / deny relocation", roles: [1, 3] },
  "hr.relocation.approve.manager": { no: 50, module: "HR: Relocation", label: "อนุมัติ / ไม่อนุมัติคำขอย้าย — ผู้จัดการ (เลือกสาขา/วันที่ย้าย)", en: "Manager approve / deny relocation", roles: [1, 2] },
  "hr.relocation.direct": { no: 51, module: "HR: Relocation", label: "บันทึกการย้ายสาขาโดยตรง (ไม่ต้องมีคำขอ)", en: "Record direct relocation", roles: [1, 3] },
  "hr.relocation.history": { no: 52, module: "HR: Relocation", label: "ดูประวัติการย้ายสาขาของพนักงาน", en: "View employee relocation history", roles: [1, 3] },
  "hr.relocation.applyDue": { no: 53, module: "HR: Relocation", label: "สั่งให้การย้ายที่ถึงกำหนดมีผล", en: "Apply due relocations", roles: [1, 3] },

  // ── HR: Issue reports ──
  "hr.issues.list": { no: 54, module: "HR: Issue reports", label: "ดูคำร้องแก้ไขข้อมูลจากพนักงาน", en: "View data-correction reports", roles: [1, 3] },
  "hr.issues.decide": { no: 55, module: "HR: Issue reports", label: "อนุมัติ / ปฏิเสธคำร้องแก้ไขข้อมูล", en: "Approve / deny data-correction report", roles: [1, 3] },
  "hr.issues.stats": { code: "issue.view", no: 54, module: "HR: Issue reports", label: "ดูสถิติคำร้องแก้ไขข้อมูล", en: "Data-correction report statistics", roles: [1, 3], variant: true, note: "3F: GET /hr/issue-reports/stats" },

  // ── HR: Out-of-office ──
  "hr.ooo.list": { code: ["ooo.view", "ooo.approve.head", "ooo.approve.asst", "ooo.confirm.manager", "ooo.reject"], no: 56, module: "HR: Out-of-office", label: "ดูรายการ / สรุป / การตั้งค่า ออกนอกพื้นที่", en: "View out-of-office list / summary / settings", roles: [1, 2, 3, 6, 7] },
  "hr.ooo.approve.branchHead": { no: 57, module: "HR: Out-of-office", label: "อนุมัติ — หัวหน้าสาขา", en: "Branch head approve", roles: [1, 6] },
  "hr.ooo.approve.asstManager": { no: 58, module: "HR: Out-of-office", label: "อนุมัติ — ผู้ช่วยผู้จัดการ", en: "Asst. manager approve", roles: [1, 7] },
  "hr.ooo.approve.manager": { no: 59, module: "HR: Out-of-office", label: "ยืนยัน — ผู้จัดการ", en: "Manager confirm", roles: [1, 2] },
  "hr.ooo.reject": { no: 60, module: "HR: Out-of-office", label: "ปฏิเสธคำขอออกนอกพื้นที่", en: "Reject out-of-office request", roles: [1, 2, 6, 7] },
  "hr.ooo.settings.edit": { no: 61, module: "HR: Out-of-office", label: "แก้ไขการตั้งค่าออกนอกพื้นที่", en: "Edit out-of-office settings", roles: [1, 3] },

  // ── HR: Payroll ──
  "hr.payroll.generate": { no: 62, module: "HR: Payroll", label: "คำนวณเงินเดือนรายคน", en: "Generate payroll (one employee)", roles: [1, 3] },
  "hr.payroll.daysWorked": { code: "payroll.generate", no: 62, module: "HR: Payroll", label: "บันทึกจำนวนวันทำงานของลูกจ้างรายวัน (ก่อนคำนวณเงินเดือน)", en: "Record days worked (daily-paid)", roles: [1, 3], variant: true, note: "3C daily-paid: GET/PUT /hr/payroll/days-worked/{y}/{m}" },
  "hr.payroll.generateBulk": { no: 63, module: "HR: Payroll", label: "คำนวณเงินเดือนทั้งองค์กร (ประจำเดือน)", en: "Generate payroll (all employees)", roles: [1, 3] },
  "hr.payroll.list": { no: 64, module: "HR: Payroll", label: "ดูรายการ / สรุปเงินเดือนประจำเดือน", en: "View payroll list / summary", roles: [1, 3] },
  "hr.payroll.history": { no: 65, module: "HR: Payroll", label: "ดูประวัติเงินเดือนรายพนักงาน", en: "View employee payroll history", roles: [1, 3] },
  "hr.payroll.adjust": { no: 66, module: "HR: Payroll", label: "ปรับปรุงรายการเงินเดือนด้วยมือ (ต้องระบุเหตุผล)", en: "Manually adjust payroll record", roles: [1, 3] },
  "hr.payroll.payslip": { no: 67, module: "HR: Payroll", label: "พิมพ์สลิปเงินเดือน", en: "Print payslip (PDF)", roles: [1, 3] },
  // งวด 3 (3C) — code ใหม่ของ backend (payroll.settings / payroll.period.approve) ยังไม่มีเลขฟังก์ชันใน matrix ที่ได้รับ
  // ส่ง/ปิดงวด/คำนวณใหม่ ใช้ payroll.generate เดิม → hr.payroll.generate
  "hr.payroll.settings.view": { code: ["payroll.view", "payroll.settings"], no: null, module: "HR: Payroll", label: "ดูการตั้งค่าการคำนวณเงินเดือน", en: "View payroll settings", roles: [1, 3], note: "GET /hr/payroll/settings — payroll.view หรือ payroll.settings" },
  "hr.payroll.settings.edit": { code: "payroll.settings", no: null, module: "HR: Payroll", label: "แก้ไขการตั้งค่าการคำนวณเงินเดือน (อัตราประกันสังคม / เงินสะสม / ภาษี)", en: "Edit payroll settings", roles: [1, 3], note: "PATCH /hr/payroll/settings" },
  "hr.payroll.periods.view": { code: ["payroll.view", "payroll.period.approve"], no: null, module: "HR: Payroll", label: "ดูสถานะงวดเงินเดือน", en: "View pay periods", roles: [1, 2, 3], note: "GET /hr/payroll/periods" },
  "hr.payroll.period.approve": { code: "payroll.period.approve", no: null, module: "HR: Payroll", label: "อนุมัติ / ส่งกลับแก้ไขงวดเงินเดือน — ผู้จัดการ", en: "Approve / return pay period (manager)", roles: [1, 2] },

  // ── HR: Positions, salary & promotions ──
  "hr.positions.view": { code: ["position.view", "position.edit", "position.change", "hr.employee.create"], no: 68, module: "HR: Positions, salary & promotions", label: "ดูรายการตำแหน่ง", en: "View positions", roles: "any" },
  "hr.positions.manage": { no: 69, module: "HR: Positions, salary & promotions", label: "เพิ่ม / แก้ไข / ปิดใช้งานตำแหน่ง", en: "Create / edit / deactivate positions", roles: [1, 3] },
  "hr.positions.assign": { no: 70, module: "HR: Positions, salary & promotions", label: "เปลี่ยนตำแหน่งของพนักงาน + ดูประวัติ", en: "Change employee position / view history", roles: [1, 3] },
  "hr.salaryLadder.view": { no: 71, module: "HR: Positions, salary & promotions", label: "ดูบัญชีเงินเดือน (salary ladder)", en: "View salary ladder", roles: [1, 3] },
  "hr.salaryLadder.edit": { no: 72, module: "HR: Positions, salary & promotions", label: "ปรับอัตราเงินเดือนในบัญชีเงินเดือนประจำปี", en: "Edit salary ladder amounts", roles: [1, 3] },
  "hr.salaryRoster.view": { no: 73, module: "HR: Positions, salary & promotions", label: "ดูทะเบียนเงินเดือนพนักงานทั้งหมด", en: "View salary roster", roles: [1, 2, 3, 7] },
  "hr.salary.history": { no: 74, module: "HR: Positions, salary & promotions", label: "ดูประวัติขั้นเงินเดือนรายคน", en: "View employee salary history", roles: [1, 3] },
  "hr.salary.stepAward": { no: 75, module: "HR: Positions, salary & promotions", label: "ให้ขั้นเงินเดือนเพิ่ม (salary step award)", en: "Award salary step", roles: [1, 3] },
  "hr.promotions.eligible": { no: 76, module: "HR: Positions, salary & promotions", label: "ดูรายชื่อผู้มีสิทธิ์เลื่อนตำแหน่ง", en: "View promotion-eligible employees", roles: [1, 3] },
  "hr.promotions.exams": { no: 77, module: "HR: Positions, salary & promotions", label: "สร้างรายการสอบเลื่อนตำแหน่ง / บันทึกผลสอบ", en: "Create promotion exam / record result", roles: [1, 3] },

  // ── HR: KPI evaluation ──
  "hr.kpi.window.set": { no: 78, module: "HR: KPI evaluation", label: "ตั้งค่าช่วงเวลาประเมิน KPI ประจำปี", en: "Set KPI evaluation window", roles: [1, 2, 3] },
  "hr.kpi.profit.record": { no: 79, module: "HR: KPI evaluation", label: "บันทึกผลกำไรประจำปี (เกณฑ์การให้ขั้น)", en: "Record annual profit result", roles: [1, 2] },
  "hr.kpi.evaluations.view": { no: 80, module: "HR: KPI evaluation", label: "ดูสถานะปีประเมิน / รายการประเมินทั้งหมด / รายละเอียดรายคน", en: "View KPI year status / evaluations / detail", roles: [1, 2, 3, 7] },
  "hr.kpi.monthly": { no: 81, module: "HR: KPI evaluation", label: "บันทึก / ดู KPI รายเดือนของพนักงาน", en: "Submit / view monthly KPI", roles: [1, 3] },
  "hr.kpi.branch": { no: 82, module: "HR: KPI evaluation", label: "บันทึก / ดู KPI ระดับสาขา (ประจำปี)", en: "Submit / view branch KPI", roles: [1, 2, 3] },
  "hr.kpi.score.branchHead": { no: 83, module: "HR: KPI evaluation", label: "ให้คะแนน — หัวหน้าสาขา", en: "Score: branch head", roles: [1, 6], note: "Backend เช็คตำแหน่ง (ชื่อขึ้นต้น \"หัวหน้า\") ไม่ใช่ role — role 1 ผ่านเสมอ; หน้าเว็บประมาณด้วย role 6" },
  "hr.kpi.score.asstManager": { no: 84, module: "HR: KPI evaluation", label: "ให้คะแนน — ผู้ช่วยผู้จัดการ", en: "Score: asst. manager", roles: [1, 2, 7] },
  "hr.kpi.score.manager": { no: 85, module: "HR: KPI evaluation", label: "ให้คะแนน — ผู้จัดการ", en: "Score: manager", roles: [1, 2] },
  "hr.kpi.score.board": { no: 86, module: "HR: KPI evaluation", label: "ให้คะแนน — กรรมการ (พนักงานระดับสูง)", en: "Score: board (senior staff)", roles: [1, 2] },
  "hr.kpi.finalize": { no: 87, module: "HR: KPI evaluation", label: "สรุปผลประเมิน (รายคน / ทั้งปี)", en: "Finalize evaluation (one / all)", roles: [1, 3] },
  "hr.kpi.reopen": { no: 88, module: "HR: KPI evaluation", label: "ปรับสิทธิ์การได้ขั้นด้วยมือ / ส่งกลับแก้ไขคะแนน", en: "Override eligibility / reopen evaluation", roles: [1, 2, 7] },
  "hr.kpi.review.asstManager": { no: 89, module: "HR: KPI evaluation", label: "ตรวจสอบผลประเมินครั้งแรก — ผู้ช่วยผู้จัดการ", en: "Review results: asst. manager", roles: [1, 7] },
  "hr.kpi.approve.manager": { no: 90, module: "HR: KPI evaluation", label: "อนุมัติผลประเมินและปรับขั้นเงินเดือน — ผู้จัดการ", en: "Final approval: manager", roles: [1, 2] },
  // 3L KPI rework (งวด 4)
  "hr.kpi.notify": { code: "kpi.window", no: 78, module: "HR: KPI evaluation", label: "แจ้งผู้ประเมิน (ส่งการแจ้งเตือนช่วงประเมิน)", en: "Notify evaluators", roles: [1, 2, 3], variant: true, note: "POST /hr/kpi/fiscal-years/{fy}/notify-evaluators" },
  "hr.kpi.monthlyForm": { code: ["kpi.monthly", "kpi.score.head"], no: 81, module: "HR: KPI evaluation", label: "แบบประเมินรายเดือน 12 รายการ (หัวหน้าสาขา: เฉพาะพนักงานในสาขาตน)", en: "Monthly 12-item form", roles: [1, 3, 6], variant: true, note: "PUT /hr/kpi/monthly-form · GET /hr/employees/{id}/kpi/form — backend จำกัดสาขาของหัวหน้าเอง" },
  "hr.kpi.selfAssessment.view": { code: ["kpi.view", "kpi.score.head", "kpi.score.asst", "kpi.score.manager", "kpi.score.board"], no: 80, module: "HR: KPI evaluation", label: "ดูแบบประเมินตนเองของผู้ถูกประเมิน", en: "View evaluatee self-assessment", roles: [1, 2, 3, 6, 7], variant: true, note: "GET /hr/kpi/evaluations/{id}/self-assessment" },
  "hr.kpi.override": { code: "kpi.override", no: 88, module: "HR: KPI evaluation", label: "ยกเลิกผลประเมินที่อนุมัติแล้ว (คืนขั้น/เงินเดือน แล้วส่งกลับประเมินใหม่)", en: "Revoke approved evaluation", roles: [1, 2, 7], variant: true, note: "POST /hr/kpi/evaluations/{id}/revoke" },

  // ── HR: Staff loans ──
  // 3K (backend PR #30): ผู้บังคับบัญชา → ผู้จัดการ (ส่งคณะทำงานฯ) → บันทึกมติคณะทำงานกองทุนฯ (101/105)
  "hr.loans.list": { no: 91, module: "HR: Staff loans", label: "ดูรายการสินเชื่อทั้งหมด", en: "View all loans", roles: [1, 2], note: "GET /hr/loans — loan.view (ผู้จัดการเท่านั้น; HR ยังไม่ได้ รอ AMC ตอบ)" },
  "hr.loans.queue": { code: (me) => me.has("loan.queue") || LOAN_QUEUE_POSITIONS.has(me.roleId), no: null, module: "HR: Staff loans", label: "ดูสินเชื่อที่รอตนพิจารณา + เห็นชอบ / ไม่เห็นชอบ (ผู้บังคับบัญชา)", en: "Loan approval queue / supervisor endorse", roles: [1, 2, 6, 7], note: "GET /hr/loans/queue · supervisor-endorse/-reject — backend ตรวจว่าเป็นผู้บังคับบัญชาของผู้กู้ (คนอื่น 403)" },
  "hr.loans.approve.hr": { no: 92, module: "HR: Staff loans", label: "ส่งเรื่องเข้าคณะทำงานกองทุนฯ / ไม่อนุมัติ — ผู้จัดการ", en: "Manager forward to committee / reject loan", roles: [1, 2], note: "PATCH /hr/loans/{id}/hr-approve · hr-reject" },
  "hr.loans.approve.finance": { no: 93, module: "HR: Staff loans", label: "บันทึกมติคณะทำงานกองทุนฯ (อนุมัติจ่าย / ไม่อนุมัติ)", en: "Record committee decision (disburse / reject)", roles: [1, 2], note: "PATCH /hr/loans/{id}/finance-confirm · finance-reject" },
  "hr.loans.detail": { code: ["loan.view", "loan.approve.hr", "loan.confirm.finance", "loan.queue", "report.hr.loan_schedule"], no: 93, module: "HR: Staff loans", label: "ดูตารางผ่อน / หนังสือกู้และค้ำประกัน (PDF) รายสัญญา", en: "Loan schedule / contract PDF", roles: [1, 2], variant: true, note: "GET /hr/loans/{id}/schedule · contract-pdf (active/closed เท่านั้น) · schedule-pdf" },
  "hr.loans.payoff": { code: "loan.confirm.finance", no: 93, module: "HR: Staff loans", label: "คำนวณยอดปิดบัญชี / บันทึกการชำระปิดบัญชี", en: "Payoff quote / record payoff", roles: [1, 2], variant: true, note: "GET/POST /hr/loans/{id}/payoff — 101, 105" },
  "hr.loans.settings": { code: "loan.confirm.finance", no: 93, module: "HR: Staff loans", label: "ตั้งค่ากองทุน (คณะทำงานกองทุนฯ / อายุเกษียณ)", en: "Loan fund settings", roles: [1, 2], variant: true, note: "GET/PATCH /hr/loans/settings — 101, 105" },
  "hr.loans.overdue": { code: ["loan.view", "loan.confirm.finance"], no: 93, module: "HR: Staff loans", label: "ดูงวดค้างชำระ + เบี้ยปรับ", en: "Overdue instalments", roles: [1, 2], variant: true, note: "GET /hr/loans/overdue" },
  "hr.loans.fundLedger": { code: "report.hr.loans_active", no: 115, module: "HR: Staff loans", label: "ทะเบียนคุมเงินกองทุนฯ (PDF)", en: "Loan fund ledger PDF", roles: [1, 2, 7], variant: true, note: "GET /hr/reports/loans/fund-ledger?fiscal_year=พ.ศ. — 101, 102" },

  // ── HR: Salary certificates ──
  "hr.salaryCert.list": { code: "salary_cert.view", no: 94, module: "HR: Salary certificates", label: "ดูคำขอหนังสือรับรองเงินเดือน", en: "View salary-cert requests", roles: [1, 2, 3], note: "PR 44 — ผู้จัดการ (101) พิจารณา · legacy fallback รวม MANAGER" },
  "hr.salaryCert.decide": { code: "salary_cert.decide", no: 95, module: "HR: Salary certificates", label: "อนุมัติ / ปฏิเสธคำขอ", en: "Approve / deny request", roles: [1, 2, 3], note: "PR 44 — ผู้จัดการ (101) พิจารณา · legacy fallback รวม MANAGER" },
  "hr.salaryCert.print": { code: "salary_cert.pdf", no: 96, module: "HR: Salary certificates", label: "พิมพ์หนังสือรับรอง / แบบฟอร์มคำขอ", en: "Print certificate / request form (PDF)", roles: [1, 2, 3], note: "PR 44 — ผู้จัดการ (101) พิจารณา · legacy fallback รวม MANAGER" },

  // ── HR: Welfare (3P, งวด 3) — code ใหม่ยังไม่มีเลขฟังก์ชันใน matrix ──
  "hr.welfare.view": { code: ["welfare.view", "welfare.approve"], no: null, module: "HR: Welfare", label: "ดูคำขอเบิกสวัสดิการ / ยอดคงเหลือ / การตั้งค่า", en: "View welfare claims / balances / settings", roles: [1, 2, 3, 7], note: "GET /hr/welfare/claims · /hr/employees/{id}/welfare-balance · GET /hr/welfare/settings" },
  "hr.welfare.submit": { code: "welfare.submit", no: null, module: "HR: Welfare", label: "บันทึกคำขอเบิกสวัสดิการ / บันทึกการจ่าย", en: "Enter welfare claim / mark paid", roles: [1, 3], note: "POST /hr/welfare/claims (+ /preview) · POST …/{id}/mark-paid" },
  "hr.welfare.approve": { code: "welfare.approve", no: null, module: "HR: Welfare", label: "อนุมัติ / ไม่อนุมัติคำขอเบิกสวัสดิการ — ผู้จัดการ", en: "Approve / reject welfare claim (manager)", roles: [1, 2], note: "POST …/{id}/approve · …/{id}/reject — อนุมัติคำขอของตนเองไม่ได้ (403)" },
  "hr.welfare.board": { code: ["welfare.approve", "welfare.submit"], no: null, module: "HR: Welfare", label: "บันทึกมติคณะกรรมการ (เมื่อตั้งค่าให้ต้องผ่านคณะกรรมการ)", en: "Record board approval", roles: [1, 2, 3], variant: true, note: "POST …/{id}/board — ผจก. หรือ HR" },
  "hr.welfare.settings": { code: "welfare.settings", no: null, module: "HR: Welfare", label: "แก้ไขการตั้งค่าสวัสดิการ / อัตราค่าการศึกษาบุตร", en: "Edit welfare settings / education rates", roles: [1, 3], note: "PATCH /hr/welfare/settings · PUT /hr/welfare/education-rates" },
  "hr.welfare.dependants.view": { code: ["hr.employee.view", "welfare.view"], no: null, module: "HR: Welfare", label: "ดูผู้มีสิทธิ์รับสวัสดิการของพนักงาน", en: "View employee dependants", roles: [1, 2, 3, 7], variant: true, note: "GET /hr/employees/{id}/dependants — แก้ไขใช้ hr.employees.editPersonal" },

  // ── HR: Discipline (3Q, งวด 4) — code ใหม่ยังไม่มีเลขฟังก์ชันใน matrix ──
  "hr.discipline.topics": { code: "discipline.topics", no: null, module: "HR: Discipline", label: "จัดการหัวข้อระเบียบ + การตั้งค่าวินัย", en: "Manage discipline topics & settings", roles: [1, 3], note: "POST/PATCH/DELETE /hr/discipline/topics · PATCH /hr/discipline/settings" },
  "hr.discipline.view": { code: "discipline.view", no: null, module: "HR: Discipline", label: "ดูเรื่องร้องเรียนและประวัติการตักเตือน (ไม่เห็นผู้แจ้ง)", en: "View cases & histories (no reporter)", roles: [1, 2, 3, 7], note: "GET /hr/discipline/cases · /hr/employees/{id}/discipline · GET /hr/discipline/settings" },
  "hr.discipline.decide": { code: (me) => me.has("discipline.decide.asst") || me.has("discipline.decide.manager") || Boolean(me.senior), no: null, module: "HR: Discipline", label: "พิจารณาเรื่องร้องเรียน (ส่งต่อ / ลงโทษ / ยุติเรื่อง) ตามขั้นของตน", en: "Decide discipline cases at own stage", roles: [1, 2, 6, 7], note: "ขั้นหัวหน้า = หัวหน้าของผู้ถูกแจ้ง (backend คำนวณจากตำแหน่ง — หน้าเว็บประมาณด้วยตำแหน่งหัวหน้า senior) · ผช.ผจก. discipline.decide.asst · ผจก. discipline.decide.manager — ปุ่มจริงดู can_decide / within_my_stage จาก backend" },
  "hr.discipline.cases": { code: (me) => ["discipline.view", "discipline.decide.asst", "discipline.decide.manager"].some((c) => me.has(c)) || Boolean(me.senior), no: null, module: "HR: Discipline", label: "เปิดรายการเรื่องร้องเรียน (หัวหน้าเห็นเฉพาะเรื่องของตน)", en: "Open discipline case list", roles: [1, 2, 3, 6, 7], feOnly: true, note: "GET /hr/discipline/cases — backend กรองรายการตามสิทธิ์เอง" },

  // ── HR: System ──
  "hr.audit.view": { no: 97, module: "HR: System", label: "ดูบันทึกการใช้งานระบบ (Audit log)", en: "View audit log", roles: [1, 3] },

  // ── HR: Reports ──
  "hr.reports.profilePdf": { no: 98, module: "HR: Reports", label: "ใบประวัติพนักงาน (PDF)", en: "Employee profile PDF", roles: [1, 3, 7] },
  "hr.reports.payrollMonthly": { no: 99, module: "HR: Reports", label: "รายงานเงินเดือนประจำเดือน", en: "Monthly payroll report", roles: [1, 3, 7] },
  "hr.reports.payrollAnnual": { no: 100, module: "HR: Reports", label: "รายงานเงินเดือนประจำปี", en: "Annual payroll report", roles: [1, 3, 7] },
  "hr.reports.socialSecurity": { no: 101, module: "HR: Reports", label: "รายงานประกันสังคม", en: "Social security report", roles: [1, 3, 7] },
  "hr.reports.reserveFund": { no: 102, module: "HR: Reports", label: "รายงานเงินสะสม / กองทุนสำรองเลี้ยงชีพ", en: "Reserve / provident fund report", roles: [1, 3, 7] },
  "hr.reports.leaveBalance": { no: 103, module: "HR: Reports", label: "รายงานยอดคงเหลือวันลา", en: "Leave balance report", roles: [1, 3, 7] },
  "hr.reports.leaveUtilization": { no: 104, module: "HR: Reports", label: "รายงานการใช้วันลา", en: "Leave utilization report", roles: [1, 3, 7] },
  "hr.reports.leaveAnnual": { no: 105, module: "HR: Reports", label: "สรุปการลารายปี (ดู / PDF)", en: "Leave annual summary", roles: [1, 3, 7] },
  "hr.reports.leaveRegister": { no: 106, module: "HR: Reports", label: "ทะเบียนการลารายบุคคล", en: "Per-employee leave register", roles: [1, 3, 7] },
  "hr.reports.roster": { no: 107, module: "HR: Reports", label: "ทะเบียนพนักงาน", en: "Employee roster", roles: [1, 3, 7] },
  "hr.reports.newEmployees": { no: 108, module: "HR: Reports", label: "รายงานพนักงานใหม่", en: "New employees report", roles: [1, 3, 7] },
  "hr.reports.positionChanges": { no: 109, module: "HR: Reports", label: "รายงานการเปลี่ยนตำแหน่ง", en: "Position changes report", roles: [1, 3, 7] },
  "hr.reports.relocations": { no: 110, module: "HR: Reports", label: "รายงานการย้ายสาขา (ดู / PDF)", en: "Relocation history report", roles: [1, 3, 7] },
  "hr.reports.salaryLevels": { no: 111, module: "HR: Reports", label: "รายงานระดับเงินเดือน", en: "Salary level report", roles: [1, 3, 7] },
  "hr.reports.salaryAdjustments": { no: 112, module: "HR: Reports", label: "รายงานการปรับเงินเดือนประจำปี", en: "Salary adjustment report", roles: [1, 3, 7] },
  "hr.reports.salaryHistoryPdf": { no: 113, module: "HR: Reports", label: "ประวัติเงินเดือนรายคน (PDF)", en: "Employee salary history PDF", roles: [1, 3, 7] },
  "hr.reports.loanSchedule": { no: 114, module: "HR: Reports", label: "ตารางผ่อนชำระเงินกู้รายสัญญา (PDF)", en: "Loan schedule PDF", roles: [1, 3, 7] },
  "hr.reports.activeLoans": { no: 115, module: "HR: Reports", label: "รายงานเงินกู้คงค้าง", en: "Active loans report", roles: [1, 3, 7] },
  "hr.reports.kpiIndividual": { no: 116, module: "HR: Reports", label: "ผลประเมิน KPI รายบุคคล (PDF)", en: "KPI individual PDF", roles: [1, 3, 7] },
  "hr.reports.kpiBranch": { no: 117, module: "HR: Reports", label: "ผลประเมิน KPI รายสาขา", en: "KPI branch report", roles: [1, 3, 7] },
  "hr.reports.kpiOrganisation": { no: 118, module: "HR: Reports", label: "สรุป KPI ทั้งองค์กร", en: "KPI organisation report", roles: [1, 3, 7] },
  "hr.reports.welfare": { code: "welfare.view", no: null, module: "HR: Reports", label: "รายงานสวัสดิการ (สรุปการเบิก / ทะเบียนผู้มีสิทธิ์) PDF", en: "Welfare claims / dependants report", roles: [1, 2, 3, 7], note: "3P: GET /hr/reports/welfare/claims · /hr/reports/welfare/dependants" },
  "hr.reports.resignedRetired": { no: 119, module: "HR: Reports", label: "รายงานผู้ลาออก / เกษียณ / ถูกให้ออก (ดู / PDF)", en: "Resigned / retired report", roles: [1, 3, 7] },

  // ── Debt accounting ──
  "debt.view": { no: 120, module: "Debt accounting", label: "ดูโปรแกรมหนี้ / รายการหนี้ / รายงาน / PDF", en: "View debt programs, entries, report", roles: [1, 2, 3, 4, 5, 6] },
  "debt.programs.manage": { no: 121, module: "Debt accounting", label: "สร้าง / แก้ไข / ลบ โปรแกรมหนี้", en: "Create / edit / delete debt program", roles: [1, 4] },
  "debt.entries.write": { no: 122, module: "Debt accounting", label: "เพิ่ม / แก้ไข / ลบ รายการหนี้", en: "Create / edit / delete debt entry", roles: [1, 5], note: "Backend require_write (WRITE_ROLES = 1,5); role 5 แก้ได้เฉพาะสาขาตัวเอง" },

  // ── Facility income/expense ──
  "facility.view": { no: 123, module: "Facility income/expense", label: "ดูรายการสถานที่ / สินค้า-บริการ / ธุรกรรม / รายงาน PDF", en: "View facilities, items, transactions, report", roles: [1, 5, 6] },
  "facility.transactions.write": { no: 124, module: "Facility income/expense", label: "บันทึก / แก้ไขธุรกรรมรายรับ-รายจ่าย", en: "Create / edit transactions", roles: [1, 5, 6] },
  "facility.transactions.delete": { no: 125, module: "Facility income/expense", label: "ลบธุรกรรม", en: "Delete transaction", roles: [1] },
  "facility.setup.manage": { no: 126, module: "Facility income/expense", label: "เพิ่ม / แก้ไข / ลบ สถานที่ และรายการ", en: "Manage facilities & items", roles: [1] },

  // ── Annual plan: master data ──
  "plan.master.products": { no: 127, module: "Annual plan: master data", label: "จัดการผลิตภัณฑ์ (ดู / เพิ่ม / แก้ / ลบ)", en: "Manage products", roles: "any" },
  "plan.master.branches": { no: 128, module: "Annual plan: master data", label: "จัดการสาขา (ดู / เพิ่ม / แก้ / ลบ)", en: "Manage branches", roles: "any" },
  "plan.master.units": { no: 129, module: "Annual plan: master data", label: "จัดการหน่วยนับ (ดู / เพิ่ม / แก้ / ลบ)", en: "Manage units", roles: "any" },
  "plan.master.costTypes": { no: 130, module: "Annual plan: master data", label: "จัดการประเภทต้นทุน + กำหนดให้สาขา/ผลิตภัณฑ์", en: "Manage cost types (+ assignment)", roles: [1, 2, 4], note: "สร้าง/แก้ผ่าน /cost-types-with-assignment = 1,2,4 (endpoint เดี่ยวไม่มี guard) — ใช้ค่าที่เข้มกว่า" },
  "plan.master.costTypes.view": { code: "login", no: 130, module: "Annual plan: master data", label: "ดูประเภทค่าใช้จ่าย", en: "View cost types", roles: "any", variant: true },
  "plan.master.earningTypes": { no: 131, module: "Annual plan: master data", label: "จัดการประเภทรายได้ + กำหนดให้สาขา/ผลิตภัณฑ์", en: "Manage earning types (+ assignment)", roles: [1, 2, 4], note: "สร้าง/แก้ผ่าน /earning-types-with-assignment = 1,2,4 (endpoint เดี่ยวไม่มี guard) — ใช้ค่าที่เข้มกว่า" },
  "plan.master.earningTypes.view": { code: "login", no: 131, module: "Annual plan: master data", label: "ดูประเภทรายได้", en: "View earning types", roles: "any", variant: true },
  "plan.master.auxCosts": { no: 132, module: "Annual plan: master data", label: "จัดการต้นทุนเสริม (aux cost)", en: "Manage auxiliary costs", roles: [1, 2, 4], note: "/aux-costs-with-assignment = 1,2,4 (endpoint เดี่ยวไม่มี guard) — ใช้ค่าที่เข้มกว่า" },
  "plan.master.auxCosts.view": { code: "login", no: 132, module: "Annual plan: master data", label: "ดูต้นทุนเสริม", en: "View auxiliary costs", roles: "any", variant: true },

  // ── Annual plan: data entry ──
  "plan.unitPrices": { no: 133, module: "Annual plan: data entry", label: "กำหนดราคาต่อหน่วยประจำปี (ดู / บันทึก / ลบ)", en: "Set annual unit prices", roles: "any" },
  "plan.saleGoals.edit": { no: 134, module: "Annual plan: data entry", label: "กรอกเป้าหมายการขาย (sale goals)", en: "Enter sale goals", roles: [1, 2, 3, 4, 6, 7], note: "PUT = 1,2,3,4,6,7 · GET ไม่มี guard (ดู plan.saleGoals.view)" },
  "plan.saleGoals.view": { no: 134, module: "Annual plan: data entry", label: "ดูเป้าการขาย", en: "View sale goals", roles: "any", variant: true },
  "plan.costs.edit": { no: 135, module: "Annual plan: data entry", label: "กรอกต้นทุนรายเดือนตามแผนธุรกิจ", en: "Enter monthly costs", roles: [1, 2, 3, 4, 6, 7], note: "POST = 1,2,3,4,6,7 · GET ไม่มี guard (ดู plan.costs.view)" },
  "plan.costs.view": { no: 135, module: "Annual plan: data entry", label: "ดูค่าใช้จ่ายรายเดือน", en: "View monthly costs", roles: "any", variant: true },
  "plan.earnings.edit": { no: 136, module: "Annual plan: data entry", label: "กรอกรายได้รายเดือนตามแผนธุรกิจ", en: "Enter monthly earnings", roles: [1, 2, 3, 4, 6, 7], note: "POST = 1,2,3,4,6,7 · GET ไม่มี guard (ดู plan.earnings.view)" },
  "plan.earnings.view": { no: 136, module: "Annual plan: data entry", label: "ดูรายได้รายเดือน", en: "View monthly earnings", roles: "any", variant: true },
  "plan.aux.edit": { no: 137, module: "Annual plan: data entry", label: "กรอกต้นทุนเสริมรายเดือน", en: "Enter monthly aux costs", roles: [1, 2, 3, 4, 6, 7], note: "POST = 1,2,3,4,6,7 · GET ไม่มี guard (ดู plan.aux.view)" },
  "plan.aux.view": { no: 137, module: "Annual plan: data entry", label: "ดูต้นทุนเสริมรายเดือน", en: "View monthly aux costs", roles: "any", variant: true },

  // ── Annual plan: reports ──
  "plan.reports.saleGoal": { no: 138, module: "Annual plan: reports", label: "เป้าหมายการขาย (รายกลุ่ม / ทุกกลุ่ม / รายสาขา)", en: "Sale-goal reports (group / all / branch)", roles: "any" },
  "plan.reports.businessCostsEarnings": { no: 139, module: "Annual plan: reports", label: "ต้นทุนธุรกิจ / รายได้ธุรกิจ (รายสาขา)", en: "Business costs / earnings (branch)", roles: "any" },
  "plan.reports.unitCosts": { no: 140, module: "Annual plan: reports", label: "ต้นทุนเสริมต่อหน่วย / ต้นทุนจัดซื้อต่อหน่วย", en: "Unit aux cost / purchase cost", roles: "any" },
  "plan.reports.branchSummary": { no: 141, module: "Annual plan: reports", label: "สรุปการเงินรายสาขา", en: "Branch financial summary", roles: "any" },
  "plan.reports.organisation": { no: 142, module: "Annual plan: reports", label: "รายงานระดับองค์กร (เป้าหมาย / ต้นทุน / รายได้ / ต้นทุนเสริม / จัดซื้อ / กำไรตามกลุ่ม / สรุป)", en: "Organisation-level plan reports", roles: "any" },
  "plan.reports.monthly": { no: 143, module: "Annual plan: reports", label: "รายงานต้นทุน / รายได้ + ต้นทุนเสริม รายเดือน", en: "Monthly cost / earnings reports", roles: "any" },

  // ── Members & customers ──
  "members.search": { no: 144, module: "Members & customers", label: "ค้นหาสมาชิก / ลูกค้า / สมาชิกที่ลาออก", en: "Search members / customers / resigned", roles: "any" },
  "members.create": { no: 145, module: "Members & customers", label: "สมัครสมาชิกใหม่", en: "Register new member", roles: "any" },
  "customers.create": { no: 146, module: "Members & customers", label: "สมัครลูกค้า (บุคคล / บริษัท)", en: "Register customer (individual / company)", roles: "any" },
  "members.edit": { no: 147, module: "Members & customers", label: "แก้ไขข้อมูลสมาชิก", en: "Edit member", roles: "any" },
  "customers.edit": { no: 148, module: "Members & customers", label: "แก้ไขข้อมูลลูกค้า", en: "Edit customer", roles: "any" },
  "members.status": { no: 149, module: "Members & customers", label: "เปลี่ยนสถานะสมาชิก", en: "Change member status", roles: "any" },
  "members.delete": { no: 150, module: "Members & customers", label: "ลบสมาชิก / ลบลูกค้า (ถ้าไม่มีรายการซื้อขาย)", en: "Delete member / customer", roles: "any" },

  // ── Shares ──
  "shares.buy": { no: 151, module: "Shares", label: "ซื้อหุ้น", en: "Buy shares", roles: "any" },
  "shares.history.edit": { no: 152, module: "Shares", label: "แก้ไข / ลบประวัติหุ้น", en: "Edit / delete share history", roles: "any" },
  "shares.resign.create": { no: 153, module: "Shares", label: "ยื่นคำขอลาออกจากสมาชิก", en: "Create resignation request", roles: "any" },
  "shares.resign.approve": { no: 154, module: "Shares", label: "อนุมัติการลาออกจากสมาชิก", en: "Approve resignation", roles: "any" },
  "shares.monthly.close": { no: 155, module: "Shares", label: "ปิดยอดหุ้นประจำเดือน", en: "Close monthly share", roles: "any" },

  // ── Trading (buy / sell) ──
  "trading.buy.create": { no: 156, module: "Trading (buy / sell)", label: "บันทึกการซื้อ", en: "Record buy order", roles: "any" },
  "trading.sell.create": { no: 157, module: "Trading (buy / sell)", label: "บันทึกการขาย", en: "Record sell order", roles: "any" },
  "trading.orders.edit": { no: 158, module: "Trading (buy / sell)", label: "แก้ไขรายการซื้อ / ขาย", en: "Edit buy / sell order", roles: "any" },
  "trading.orders.delete": { no: 159, module: "Trading (buy / sell)", label: "ยกเลิก / ลบรายการซื้อขาย", en: "Cancel / delete order", roles: "any" },
  "trading.reports.view": { no: 160, module: "Trading (buy / sell)", label: "ดูรายงานการซื้อขาย / สถิติ", en: "View order & sales reports", roles: "any" },
  "trading.stock.recalc": { no: 161, module: "Trading (buy / sell)", label: "คำนวณสต็อกรายวันใหม่ (ด้วยมือ)", en: "Recalculate daily stock", roles: "any" },

  // ── Warehouse & stock ──
  "stock.spec.manage": { no: 162, module: "Warehouse & stock", label: "สร้าง / แก้ไขสเปคสินค้า", en: "Create / edit product spec", roles: "any" },
  "stock.transfer.request": { no: 163, module: "Warehouse & stock", label: "โอนสินค้าระหว่างสาขา: ขอโอน", en: "Stock transfer: request", roles: "any" },
  "stock.transfer.confirm": { no: 164, module: "Warehouse & stock", label: "โอนสินค้า: ดูรายการรอรับ / รอส่ง + ยืนยันรับ", en: "Stock transfer: view pending / confirm", roles: "any" },
  "stock.mill.record": { no: 165, module: "Warehouse & stock", label: "บันทึกการสี (mill)", en: "Record milling", roles: "any" },
  "stock.carryover.record": { no: 166, module: "Warehouse & stock", label: "บันทึกยอดยกมา (carryover)", en: "Record carryover", roles: "any" },
  "stock.cutloss.record": { no: 167, module: "Warehouse & stock", label: "บันทึกการตัดขาดทุน (cut loss)", en: "Record cut-loss", roles: "any" },

  // ── Phase 1 reports ──
  "reports.phase1.p01": { no: 168, module: "Phase 1 reports", label: "รายงาน P01: ขออนุมัติและจ่ายค่าหุ้นลาออก", en: "Report P01", roles: [1, 3, 4, 7] },
  "reports.phase1.p02": { no: 169, module: "Phase 1 reports", label: "รายงาน P02: ขายแยกตามวัน", en: "Report P02", roles: [1, 3, 4, 7] },
  "reports.phase1.p03": { no: 170, module: "Phase 1 reports", label: "รายงาน P03: จ่ายคืนค่าหุ้นสมาชิกลาออก", en: "Report P03", roles: [1, 3, 4, 7] },
  "reports.phase1.p04": { no: 171, module: "Phase 1 reports", label: "รายงาน P04: ซื้อขายแยกราคา", en: "Report P04", roles: [1, 3, 4, 7] },
  "reports.phase1.p05": { no: 172, module: "Phase 1 reports", label: "รายงาน P05: ซื้อข้าวเปลือกรายคน", en: "Report P05", roles: [1, 3, 4, 7] },
  "reports.phase1.p06": { no: 173, module: "Phase 1 reports", label: "รายงาน P06: ซื้อแยกตามวัน", en: "Report P06", roles: [1, 3, 4, 7] },
  "reports.phase1.p07": { no: 174, module: "Phase 1 reports", label: "รายงาน P07: ทะเบียนคุม", en: "Report P07", roles: [1, 3, 4, 7] },
  "reports.phase1.p08": { no: 175, module: "Phase 1 reports", label: "รายงาน P08: รายงานการรวบรวม", en: "Report P08", roles: [1, 3, 4, 7] },
  "reports.phase1.p09": { no: 176, module: "Phase 1 reports", label: "รายงาน P09: เคลื่อนไหวทุนเรือนหุ้นรายกลุ่ม", en: "Report P09", roles: [1, 3, 4, 7] },
  "reports.phase1.p10": { no: 177, module: "Phase 1 reports", label: "รายงาน P10: ทะเบียนทุนเรือนหุ้น (รายคน)", en: "Report P10", roles: [1, 3, 4, 7] },
  "reports.phase1.p11": { no: 178, module: "Phase 1 reports", label: "รายงาน P11: ทุนเรือนหุ้นคงเหลือรายคน", en: "Report P11", roles: [1, 3, 4, 7] },
  "reports.phase1.p12": { no: 179, module: "Phase 1 reports", label: "รายงาน P12: รายงานรวมสาขา", en: "Report P12", roles: [1, 3, 4, 7] },
  "reports.phase1.p13": { no: 180, module: "Phase 1 reports", label: "รายงาน P13: รายงานรายวัน", en: "Report P13", roles: [1, 3, 4, 7] },
  "reports.phase1.p14": { no: 181, module: "Phase 1 reports", label: "รายงาน P14: รายงานสมาชิก", en: "Report P14", roles: [1, 3, 4, 7] },
  "reports.phase1.p15": { no: 182, module: "Phase 1 reports", label: "รายงาน P15: สมาชิกขอลาออกรายคน", en: "Report P15", roles: [1, 3, 4, 7] },
  "reports.phase1.p16": { no: 183, module: "Phase 1 reports", label: "รายงาน P16: รายงานสมาชิกใหม่", en: "Report P16", roles: [1, 3, 4, 7] },
  "reports.phase1.p17": { no: 184, module: "Phase 1 reports", label: "รายงาน P17: สรุปการเคลื่อนไหวทุนเรือนหุ้นรายกลุ่ม", en: "Report P17", roles: [1, 3, 4, 7] },
  "reports.phase1.p18": { no: 185, module: "Phase 1 reports", label: "รายงาน P18: สรุปจำนวนสมาชิกและการถือหุ้น", en: "Report P18", roles: [1, 3, 4, 7] },
  "reports.phase1.p19": { no: 186, module: "Phase 1 reports", label: "รายงาน P19: รายงานสาขา 1 (สรุปข้าว)", en: "Report P19", roles: [1, 3, 4, 7] },

  // ── Frontend only (ไม่มีใน matrix — กฎการแสดงผลของหน้าเว็บ ไม่ได้ให้สิทธิ์เพิ่มจาก backend) ──
  "admin.roles.view": { code: "superadmin", no: null, module: "Frontend only", label: "ดูหน้าสิทธิ์ตามบทบาท", en: "View role permission matrix", roles: [1], feOnly: true },
  "approval.anyStage": { code: "superadmin", no: null, module: "Frontend only", label: "พิจารณาคำขอได้ทุกขั้น (ใบลา / ออกนอกสถานที่)", en: "Act on any approval stage", roles: [1], feOnly: true, note: "สอดคล้อง backend: role 1 อยู่ในทุก guard ของขั้นอนุมัติ" },
  "nav.hrCompactMenu": { code: (me) => HR_POSITION_IDS.has(me.roleId), no: null, module: "Frontend only", label: "ใช้เมนูด้านข้างแบบ HR (ย่อ)", en: "Use the compact HR sidebar", roles: [3], feOnly: true },
  "home.hrDashboardOnly": { code: (me) => HR_POSITION_IDS.has(me.roleId), no: null, module: "Frontend only", label: "หน้าหลักเป็นแดชบอร์ด HR อย่างเดียว", en: "Home is the HR dashboard only", roles: [3], feOnly: true, note: "ตำแหน่ง HR เปิด /home แล้วไป /hr/dashboard ทันที — ไม่เห็นการ์ดฟังก์ชันอื่นบนหน้าหลัก (sidebar ปกติ)" },
  "debt.entries.ownBranchOnly": { code: (me) => me.scope === "own_branch", no: null, module: "Frontend only", label: "บันทึกหนี้ได้เฉพาะสาขาตนเอง", en: "Debt entries locked to own branch", roles: [5], feOnly: true, note: "ตำแหน่ง scope own_branch — backend ล็อกสาขาเอง" },
  "customers.company.add": { code: "customer.register", no: null, module: "Frontend only", label: "เพิ่มบริษัท (ลูกค้านิติบุคคล)", en: "Add company customer", roles: "any", feOnly: true, note: "ตาม backend: POST /member/customers/company-signup ต้องมี customer.register (Super Admin ผ่านเสมอ)" },
})

// ─── helpers ────────────────────────────────────────────────────────────────
const IS_DEV = Boolean(import.meta.env?.DEV)
const warned = new Set()

/** เลขฟังก์ชันใน matrix → permission code ของ backend */
const CODE_BY_NO = Object.freeze(
  Object.fromEntries(Object.entries(PERMISSION_MATRIX).filter(([, m]) => m.no != null).map(([code, m]) => [m.no, code])),
)

function lookup(key) {
  const p = PERMISSIONS[key]
  if (!p && IS_DEV && !warned.has(key)) {
    warned.add(key)
    console.warn(`[permissions] unknown permission key "${key}" — denied`)
  }
  return p
}

/** code ของ backend ที่คีย์นี้ใช้ (string | string[] | "login" | "superadmin" | function | null) */
export function codeFor(key) {
  const p = PERMISSIONS[key]
  if (!p) return null
  if (p.roles === "public") return "public"
  if (p.code !== undefined) return p.code
  return p.no != null ? CODE_BY_NO[p.no] ?? null : null
}

// ผู้ใช้ปัจจุบันในโหมด RBAC: จาก /auth/me/permissions ถ้าโหลดแล้ว, ถ้ายังไม่ได้แต่ token เป็นตำแหน่ง 101–142
// ใช้ตาราง rbacMatrix.js ชั่วคราว (กันเมนูว่างระหว่างโหลด). null = backend รุ่นเก่า → ใช้ `roles` เดิม
let meCache = { version: -1, token: null, me: null }

function makeMe(roleId, scope, senior, codes) {
  const set = new Set(codes)
  const superAdmin = roleId === SUPER_ADMIN
  return Object.freeze({ roleId, scope, senior, superAdmin, has: (c) => superAdmin || set.has(c) })
}

function rbacMe() {
  const version = getMyPermissionsVersion()
  const token = localStorage.getItem("token")
  if (meCache.version === version && meCache.token === token) return meCache.me
  let me = null
  const mine = getMyPermissions()
  if (mine) {
    me = makeMe(mine.role_id, mine.scope, mine.senior, mine.permissions)
  } else {
    const rid = getRoleId()
    const pos = POSITION_ROLES[rid]
    if (pos) {
      const codes = Object.entries(PERMISSION_MATRIX).filter(([, m]) => m.roles.includes(rid)).map(([c]) => c)
      me = makeMe(rid, pos.scope, pos.senior, codes)
    }
  }
  meCache = { version, token, me }
  return me
}

/** ใช้สิทธิ์แบบ permission code (backend PR #13) อยู่ไหม — false = backend รุ่นเก่า (role 1–7) */
export function isRbacMode() {
  return rbacMe() != null
}

/** ข้อมูลผู้ใช้ในโหมด RBAC: { roleId, scope, senior, superAdmin, has(code) } หรือ null */
export function currentAccess() {
  return rbacMe()
}

/**
 * ผู้ใช้เลือกสาขาอื่นได้ไหม (scope "all") — false = ล็อกที่สาขาที่ใช้งานอยู่ (scope "own_branch")
 * backend บังคับเองอยู่แล้ว ตัวนี้แค่ซ่อน/ล็อกตัวเลือกสาขา. backend รุ่นเก่า → true (คงพฤติกรรมเดิม)
 */
export function canPickAnyBranch() {
  const me = rbacMe()
  if (!me) return true
  return me.superAdmin || me.scope === "all"
}

function grantRbac(code, me) {
  if (code == null) return me.superAdmin
  if (code === "public" || code === "login") return true
  if (code === "superadmin") return me.superAdmin
  if (typeof code === "function") return Boolean(code(me))
  if (Array.isArray(code)) return code.some((c) => me.has(c))
  return me.has(code)
}

function grantLegacy(p, roleId) {
  const r = Number(roleId)
  if (!Number.isFinite(r) || r <= 0) return false
  if (p.roles === "any") return true
  return Array.isArray(p.roles) && p.roles.includes(r)
}

/** role ids (legacy 1–7) ที่ได้สิทธิ์ของคีย์นี้ ("any"/"public" → ทุก role) */
export function rolesFor(key) {
  const p = PERMISSIONS[key]
  if (!p) return []
  return Array.isArray(p.roles) ? p.roles : ROLE_IDS
}

/** position ids (101–142) ที่ได้สิทธิ์ของคีย์นี้ตาม rbacMatrix.js (ไม่รวม Super Admin ที่ได้ทุกอย่าง) */
export function positionsFor(key) {
  const code = codeFor(key)
  const ids = Object.keys(POSITION_ROLES).map(Number)
  return ids.filter((id) => {
    const pos = POSITION_ROLES[id]
    const codes = Object.entries(PERMISSION_MATRIX).filter(([, m]) => m.roles.includes(id)).map(([c]) => c)
    return grantRbac(code, makeMe(id, pos.scope, pos.senior, codes))
  })
}

/**
 * ผู้ใช้ปัจจุบันมีสิทธิ์ใช้คีย์นี้ไหม — คีย์ที่ไม่รู้จัก → false
 * roleId ใช้เฉพาะโหมด legacy (backend รุ่นเก่า); โหมด RBAC ใช้รายการ code ของผู้ใช้ที่ล็อกอินอยู่เสมอ
 */
export function can(key, roleId = getRoleId()) {
  const p = lookup(key)
  if (!p) return false
  if (p.roles === "public") return true
  const me = rbacMe()
  if (me) return grantRbac(codeFor(key), me)
  return grantLegacy(p, roleId)
}

export function canAny(keys, roleId = getRoleId()) {
  return Array.isArray(keys) && keys.some((k) => can(k, roleId))
}

export function canAll(keys, roleId = getRoleId()) {
  return Array.isArray(keys) && keys.length > 0 && keys.every((k) => can(k, roleId))
}

/**
 * เช็คชุดเงื่อนไขแบบเดียวกับ <RequirePermission>/<Can>:
 * perm (คีย์เดียว) · anyOf (อย่างน้อยหนึ่ง) · allOf (ครบทุกตัว) · allow (ฟังก์ชันกฎเฉพาะผู้ใช้)
 * ไม่ส่งเงื่อนไขอะไรเลย → false (กันลืมใส่ perm แล้วเปิดหน้าโดยไม่ตั้งใจ)
 */
export function checkAccess({ perm, anyOf, allOf, allow } = {}, roleId = getRoleId()) {
  if (perm == null && anyOf == null && allOf == null && allow == null) return false
  if (perm != null && !can(perm, roleId)) return false
  if (anyOf != null && !canAny(anyOf, roleId)) return false
  if (allOf != null && !canAll(allOf, roleId)) return false
  if (allow != null && !allow()) return false
  return true
}

/** Hook สำหรับ component — re-render เมื่อโหลดสิทธิ์จาก backend เสร็จ/เปลี่ยน */
export function useCan() {
  const roleId = getRoleId()
  const version = useMyPermissionsVersion()
  return useMemo(
    () => ({
      roleId,
      version,
      can: (key) => can(key, roleId),
      canAny: (keys) => canAny(keys, roleId),
      canAll: (keys) => canAll(keys, roleId),
      canPickAnyBranch: () => canPickAnyBranch(),
    }),
    [roleId, version],
  )
}

/** ชื่อตำแหน่งของผู้ใช้ที่ล็อกอินอยู่ (role_name จาก backend → ตาราง role) */
export function myRoleLabel() {
  const mine = getMyPermissions()
  if (mine?.role_name) return mine.role_name
  const rid = getRoleId()
  return POSITION_ROLES[rid]?.name ?? ROLE_LABEL[rid] ?? (rid ? `Role ${rid}` : "—")
}

/**
 * ตัวเลือก role ตอนสร้างผู้ใช้ / แก้พนักงาน: ตำแหน่ง 101–142 (backend PR #13)
 * backend รุ่นเก่า → role 2–7 เดิม (ไม่รวม Admin — สร้างผ่านช่องทางผู้ดูแลระบบเท่านั้น)
 */
export function assignableRoleOptions() {
  if (isRbacMode()) return POSITION_ROLE_OPTIONS
  return ROLE_IDS.filter((id) => id !== ROLE.ADMIN).map((id) => ({ value: id, label: ROLE_LABEL[id] }))
}

/** แถวทั้งหมดของ registry (เรียงตามเลขฟังก์ชัน, คีย์เฉพาะหน้าเว็บอยู่ท้าย) — ใช้กับหน้า /admin/roles */
export function permissionRows() {
  return Object.entries(PERMISSIONS)
    .map(([key, p]) => ({ key, ...p }))
    .sort((a, b) => (a.no ?? 9999) - (b.no ?? 9999) || Number(Boolean(a.variant)) - Number(Boolean(b.variant)))
}

/** คีย์ KPI ทั้งหมด — แท็บ KPI ในหน้า HR แสดงเมื่อมีอย่างน้อยหนึ่ง (แท็บย่อยกรองต่อด้วย getKpiPerms) */
export const HR_KPI_PERMS = Object.freeze(Object.keys(PERMISSIONS).filter((k) => k.startsWith("hr.kpi.")))

/**
 * หน้า "งานบุคคล (HR)" (/hr/dashboard) — เข้าได้ถ้ามีอย่างน้อยหนึ่งแท็บ (แต่ละแท็บเช็คคีย์ของตัวเองใน HRDashboard.jsx).
 * hr.dashboard.view คุมเฉพาะแถบสถิติด้านบน (matrix ใหม่ให้ Super Admin เท่านั้น)
 */
export const HR_HUB_PERMS = Object.freeze([
  "hr.dashboard.view",
  ...new Set(["hr.employees.list", "hr.positions.view", "hr.promotions.eligible", "hr.promotions.exams", "hr.employees.terminate", "hr.reports.resignedRetired", "hr.leave.list", "hr.reports.leaveAnnual", "hr.reports.leaveRegister", "hr.ooo.list", "hr.holidayWork.view", "hr.relocation.list", "hr.reports.relocations", "hr.salaryLadder.view", "hr.salaryRoster.view", "hr.salary.history", "hr.salary.stepAward", "hr.payroll.list", "hr.payroll.settings.view", "hr.payroll.period.approve", "hr.loans.list", "hr.loans.queue", "hr.loans.approve.finance", "hr.loans.fundLedger","hr.salaryCert.list", "hr.leaveTypes.manage", "hr.holidays.manage", "hr.issues.list", "hr.audit.view", ...HR_KPI_PERMS,
    // WP0 scaffold: 3H ปฏิทินการลา · 3P สวัสดิการ · 3Q วินัย · 3F สถิติคำร้อง
    "hr.leave.calendar", "hr.welfare.view", "hr.welfare.submit", "hr.welfare.settings", "hr.discipline.cases", "hr.discipline.topics", "hr.issues.stats"]),
])

/** คีย์ Phase 1 report ทั้ง 19 ตัว (P01–P19) */
export const PHASE1_REPORT_PERMS = Object.freeze(
  Array.from({ length: 19 }, (_, i) => `reports.phase1.p${String(i + 1).padStart(2, "0")}`),
)

/**
 * หน้า "คลังเอกสาร & รายงาน" (/documents) รวมรายงานหลายกลุ่ม — เข้าได้ถ้ามีสิทธิ์อย่างน้อยหนึ่งกลุ่ม
 * (รายงานซื้อ-ขาย · รายงานแผนรายปี · รายงาน Phase 1) — ใช้ร่วมกันใน App.jsx และ Home.jsx
 */
export const DOCUMENTS_PERMS = Object.freeze([
  "trading.reports.view", "plan.reports.saleGoal", ...PHASE1_REPORT_PERMS,
  // รายงานฝ่ายบุคคล (report.hr.*) — กล่อง "รายงานฝ่ายบุคคล" ในหน้าเดียวกัน
  ...Object.keys(PERMISSIONS).filter((k) => k.startsWith("hr.reports.")),
  // R12 — รายงานออกนอกพื้นที่ / ประวัติการตักเตือน ในหน้าเดียวกัน (ผู้ถือ ooo.view / discipline.view อย่างเดียวก็เข้าได้)
  "hr.ooo.list", "hr.discipline.view",
])

// ─── กฎพิเศษที่ผูกกับ "ผู้ใช้" ไม่ใช่ role (คงไว้โดยเจตนา) ─────────────────────
const BRING_IN_MILL_USER_IDS = new Set([17, 18])

/** หน้า "ยกเข้าโรงสี" (/bring-in-mill) — เฉพาะ user id 17 และ 18 (กฎธุรกิจเดิม) */
export function canBringInMill(user = getUser()) {
  const uid = Number(user?.id ?? user?.user_id ?? 0)
  return BRING_IN_MILL_USER_IDS.has(uid)
}

/**
 * เมนู/หน้า "เพิ่มบริษัท" — เปิดตามสิทธิ์ customer.register เหมือน backend
 * (POST /member/customers/company-signup) · Super Admin ผ่านเสมอ (handoff F29)
 */
export function canSeeAddCompany(roleId = getRoleId()) {
  return can("customers.company.add", roleId) || can("customers.create", roleId)
}
