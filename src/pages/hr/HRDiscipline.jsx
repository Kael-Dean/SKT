// src/pages/hr/HRDiscipline.jsx
// หน้าเรื่องร้องเรียน/ตักเตือนแยก (/hr/discipline) — เนื้อหาเดียวกับแท็บ "วินัย" ใน /hr/dashboard (HRDisciplineTab)
// ให้หัวหน้า / ผช.ผจก. / ผจก. เปิดตรงได้ — เติมเนื้อหาที่ HRDisciplineTab เท่านั้น
import PageTitle from "../../components/PageTitle"
import { cardCls } from "../../lib/styles"
import HRDisciplineTab from "./tabs/HRDisciplineTab"

export default function HRDiscipline() {
  return (
    <div className={`${cardCls} min-w-0 p-4 lg:p-5 xl:p-6`}>
      <PageTitle title="เรื่องร้องเรียนและการตักเตือน" />
      <HRDisciplineTab />
    </div>
  )
}
