// src/pages/hr/tabs/PersonnelDependantsTab.jsx
// ช่องในโปรไฟล์พนักงาน (HRPersonnelDetail): ผู้มีสิทธิ์รับสวัสดิการ (3P)
//   GET/POST /hr/employees/{id}/dependants · PATCH/DELETE /hr/dependants/{id} · GET /hr/employees/{id}/welfare-balance
// props: { employeeId, employeeName }
// STUB (WP0) — WP2 แทนที่เนื้อหา
import ComingSoon from "../../../components/ComingSoon"
import { cardPaddedCls } from "../../../lib/styles"

// eslint-disable-next-line no-unused-vars -- props ใช้เมื่อ WP2 เติมเนื้อหา
export default function PersonnelDependantsTab({ employeeId, employeeName }) {
  return (
    <section aria-labelledby="pd-dependants-h" className={cardPaddedCls}>
      <h2 id="pd-dependants-h" className="text-sm font-semibold text-gray-900 dark:text-gray-100">ผู้มีสิทธิ์รับสวัสดิการ</h2>
      <ComingSoon compact />
    </section>
  )
}
