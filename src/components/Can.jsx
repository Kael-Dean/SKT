// src/components/Can.jsx
// แสดง children เฉพาะเมื่อผู้ใช้มีสิทธิ์ (permission key จาก src/lib/permissions.js)
//
//   <Can perm="hr.payroll.generate"><button>…</button></Can>
//   <Can anyOf={["hr.leave.deny", "hr.ooo.reject"]} fallback={<span>ดูอย่างเดียว</span>}>…</Can>
//
// ใน logic ที่ไม่ใช่ JSX ใช้ can() หรือ useCan() แทน
import { checkAccess } from "../lib/permissions"
import { useMyPermissionsVersion } from "../lib/myPermissions"

export default function Can({ perm, anyOf, allOf, allow, fallback = null, children }) {
  useMyPermissionsVersion()
  return checkAccess({ perm, anyOf, allOf, allow }) ? children : fallback
}
