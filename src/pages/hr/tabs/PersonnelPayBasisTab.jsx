// src/pages/hr/tabs/PersonnelPayBasisTab.jsx
// ช่องในโปรไฟล์พนักงาน (HRPersonnelDetail): ประเภทการจ่าย รายเดือน/รายวัน (3C daily-paid)
//   แสดง financial.pay_basis — แก้ผ่าน FinancialEditSheet (PATCH /hr/employees/{id}/financial { pay_basis })
// props: { employeeId, financial }
// STUB (WP0) — WP6 แทนที่เนื้อหา (ยังไม่มี pay_basis จาก backend = ไม่แสดงอะไร)
const PAY_BASIS_LABEL = { monthly: "รายเดือน", daily: "รายวัน" }

// eslint-disable-next-line no-unused-vars -- employeeId ใช้เมื่อ WP6 เติมเนื้อหา
export default function PersonnelPayBasisTab({ employeeId, financial }) {
  const basis = financial?.pay_basis
  if (!basis) return null
  return (
    <p className="text-sm text-gray-700 dark:text-gray-300">
      ประเภทการจ่าย: <span className="font-medium text-gray-900 dark:text-gray-100">{PAY_BASIS_LABEL[basis] ?? basis}</span>
    </p>
  )
}
