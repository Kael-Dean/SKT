// src/components/RequirePermission.jsx
// Route guard ตาม permission key (src/lib/permissions.js)
//
//   <RequirePermission perm="hr.dashboard.view"><HRDashboard /></RequirePermission>
//   <RequirePermission anyOf={["hr.leave.list", "hr.ooo.list"]}>…</RequirePermission>
//   <RequirePermission allow={canBringInMill}>…</RequirePermission>   (กฎเฉพาะผู้ใช้)
//
// ไม่มีสิทธิ์ → แจ้งเตือนสั้น ๆ (toast) แล้วพากลับ /home. ถ้ากำลังอยู่ที่หน้าปลายทางอยู่แล้ว
// (กัน redirect วน) จะแสดงหน้า 403 แทน — ไม่ปล่อยจอว่าง
import { useEffect } from "react"
import { Navigate, useLocation, useNavigate } from "react-router-dom"
import { ShieldOff } from "lucide-react"
import { checkAccess } from "../lib/permissions"
import { toast } from "./ui"

const DENIED_TOAST_ID = "permission-denied"

function DeniedRedirect({ to }) {
  useEffect(() => {
    toast.warning("ไม่มีสิทธิ์เข้าหน้านี้", {
      id: DENIED_TOAST_ID,
      description: "บทบาทของคุณยังไม่ได้รับสิทธิ์ใช้ฟังก์ชันนี้ ระบบพากลับหน้าหลักแล้ว",
    })
  }, [])
  return <Navigate to={to} replace />
}

export function ForbiddenState({ homePath = "/home" }) {
  const navigate = useNavigate()
  return (
    <div role="alert" className="mx-auto flex max-w-md flex-col items-center gap-3 rounded-2xl bg-white p-8 text-center shadow-sm dark:bg-gray-800">
      <span className="flex size-12 items-center justify-center rounded-full bg-amber-50 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300">
        <ShieldOff aria-hidden="true" strokeWidth={1.75} className="size-6" />
      </span>
      <h1 className="text-lg font-bold text-gray-900 dark:text-gray-100">ไม่มีสิทธิ์เข้าหน้านี้</h1>
      <p className="text-sm text-gray-600 dark:text-gray-300">
        บทบาทของคุณยังไม่ได้รับสิทธิ์ใช้ฟังก์ชันนี้ หากต้องใช้งาน ติดต่อผู้ดูแลระบบเพื่อขอสิทธิ์
      </p>
      <button
        type="button"
        onClick={() => navigate(homePath)}
        className="mt-1 cursor-pointer rounded-2xl bg-indigo-500 px-4 py-2 text-sm font-semibold text-white transition-all duration-200 hover:bg-indigo-600 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-gray-800"
      >
        กลับหน้าหลัก
      </button>
    </div>
  )
}

export default function RequirePermission({ perm, anyOf, allOf, allow, redirectTo = "/home", children }) {
  const location = useLocation()
  if (checkAccess({ perm, anyOf, allOf, allow })) return children
  if (location.pathname === redirectTo) return <ForbiddenState homePath="/home" />
  return <DeniedRedirect to={redirectTo} />
}
