// src/pages/hr/tabs/PersonnelPayBasisTab.jsx
// แถวในการ์ด "ข้อมูลการเงิน" ของโปรไฟล์พนักงาน (HRPersonnelDetail): ประเภทการจ่าย รายเดือน/รายวัน (3C daily-paid)
//   อ่าน financial.pay_basis — ถ้า payload ของหน้าโปรไฟล์ไม่มี field นี้ ดึง GET /hr/employees/{id}/financial เอง
//   แก้ผ่าน FinancialEditSheet (POST /hr/financial/{id} { pay_basis })
//   backend ที่ยังไม่ migrate (ไม่มี pay_basis ทั้งสองทาง) → ไม่แสดงอะไร
// props: { employeeId, financial }
import { useEffect, useState } from "react"
import { apiAuth } from "../../../lib/api"
import { payBasisLabel } from "../../../lib/payroll"

export default function PersonnelPayBasisTab({ employeeId, financial }) {
  const own = financial?.pay_basis
  const [fetched, setFetched] = useState(null)

  // financial เปลี่ยน (เช่น หลังบันทึกใน FinancialEditSheet) → ดึงใหม่ถ้ายังไม่มีค่าในตัว
  useEffect(() => {
    if (own !== undefined || employeeId == null) return
    let alive = true
    apiAuth(`/hr/employees/${employeeId}/financial`)
      .then((d) => { if (alive) setFetched(d && typeof d === "object" && "pay_basis" in d ? d.pay_basis || "monthly" : null) })
      .catch(() => { if (alive) setFetched(null) })
    return () => { alive = false }
  }, [employeeId, financial, own])

  const basis = own !== undefined ? own || "monthly" : fetched
  if (!basis) return null
  const isDaily = basis === "daily"

  return (
    <div className="flex flex-col py-2 border-b border-gray-100 dark:border-gray-700/50 last:border-0 sm:flex-row sm:gap-4">
      <span className="shrink-0 text-xs font-medium text-gray-500 dark:text-gray-400 sm:w-44">ประเภทการจ่าย</span>
      <span className="mt-0.5 text-sm text-gray-900 dark:text-gray-100 sm:mt-0">
        {payBasisLabel(basis) ?? basis}
        {isDaily && (
          <span className="block text-xs text-gray-600 dark:text-gray-400">
            ค่าจ้างรายวัน × จำนวนวันที่บันทึกในแต่ละเดือน — ไม่ใช้เงินเดือนปัจจุบันในการคำนวณ
          </span>
        )}
      </span>
    </div>
  )
}
