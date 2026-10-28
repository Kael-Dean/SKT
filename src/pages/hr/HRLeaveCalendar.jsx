// src/pages/hr/HRLeaveCalendar.jsx
// หน้าปฏิทินการลาแยก (/hr/leave-calendar) — เนื้อหาเดียวกับแท็บ "ปฏิทินการลา" ใน /hr/dashboard (HRLeaveCalendarTab)
// ให้ ผจก. / หัวหน้าสาขา เปิดตรงได้ — เติมเนื้อหาที่ HRLeaveCalendarTab เท่านั้น
import PageTitle from "../../components/PageTitle"
import { cardCls } from "../../lib/styles"
import HRLeaveCalendarTab from "./tabs/HRLeaveCalendarTab"

export default function HRLeaveCalendar() {
  return (
    <div className={`${cardCls} min-w-0 p-4 lg:p-5 xl:p-6`}>
      <PageTitle title="ปฏิทินการลา" />
      <HRLeaveCalendarTab />
    </div>
  )
}
