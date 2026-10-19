// src/pages/work/HolidayCalendar.jsx
// ปฏิทินวันหยุดของสหกรณ์ (3N) — อ่านอย่างเดียว สำหรับทุกคนที่ล็อกอิน (`hr.holidays.view`, GET /hr/holidays)
// ใช้ตารางเดียวกับแท็บ HR (`HRHolidayCalendarTab readOnly`) — ฝ่ายบุคคลจัดการที่ HR Dashboard → ปฏิทินวันหยุด
import HRHolidayCalendarTab from "../hr/tabs/HRHolidayCalendarTab"
import PageTitle from "../../components/PageTitle"

export default function HolidayCalendar() {
  return (
    <div className="mx-auto max-w-4xl space-y-5 pb-10">
      <PageTitle title="ปฏิทินวันหยุด" />
      <HRHolidayCalendarTab readOnly />
    </div>
  )
}
