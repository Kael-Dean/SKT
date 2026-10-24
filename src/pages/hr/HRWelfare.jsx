// src/pages/hr/HRWelfare.jsx
// หน้าสวัสดิการแยก (/hr/welfare) — เนื้อหาเดียวกับแท็บ "สวัสดิการ" ใน /hr/dashboard (HRWelfareTab)
// ให้ ผจก. / ผช.ผจก. เปิดตรงได้โดยไม่ต้องผ่าน dashboard (แบบ HRKpiPage) — เติมเนื้อหาที่ HRWelfareTab เท่านั้น
import PageTitle from "../../components/PageTitle"
import { cardCls } from "../../lib/styles"
import HRWelfareTab from "./tabs/HRWelfareTab"

export default function HRWelfare() {
  return (
    <div className={`${cardCls} min-w-0 p-4 lg:p-5 xl:p-6`}>
      <PageTitle title="สวัสดิการ" />
      <HRWelfareTab />
    </div>
  )
}
