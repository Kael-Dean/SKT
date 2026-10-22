// src/pages/hr/tabs/PersonnelDisciplineTab.jsx
// ช่องในโปรไฟล์พนักงาน (HRPersonnelDetail): ประวัติการตักเตือน (3Q)
//   GET /hr/employees/{id}/discipline · PDF ต่อแถว GET /hr/discipline/actions/{id}/pdf (blob)
// props: { employeeId, employeeName }
// STUB (WP0) — WP3 แทนที่เนื้อหา
import ComingSoon from "../../../components/ComingSoon"
import { cardPaddedCls } from "../../../lib/styles"

// eslint-disable-next-line no-unused-vars -- props ใช้เมื่อ WP3 เติมเนื้อหา
export default function PersonnelDisciplineTab({ employeeId, employeeName }) {
  return (
    <section aria-labelledby="pd-discipline-h" className={cardPaddedCls}>
      <h2 id="pd-discipline-h" className="text-sm font-semibold text-gray-900 dark:text-gray-100">ประวัติการตักเตือน</h2>
      <ComingSoon compact />
    </section>
  )
}
