// src/pages/work/HolidayCalendar.jsx
// ปฏิทินวันหยุดของสหกรณ์ (3N) — อ่านอย่างเดียว สำหรับทุกคนที่ล็อกอิน (`hr.holidays.view`, GET /hr/holidays)
// ใช้ตารางเดียวกับแท็บ HR (`HRHolidayCalendarTab readOnly`) — ฝ่ายบุคคลจัดการที่ HR Dashboard → ปฏิทินวันหยุด
import HRHolidayCalendarTab from "../hr/tabs/HRHolidayCalendarTab"

export default function HolidayCalendar() {
  return (
    <div className="mx-auto max-w-4xl space-y-5 pb-10">
      <div>
        <h1 className="text-xl font-bold text-gray-900 dark:text-gray-100">ปฏิทินวันหยุด</h1>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
          วันหยุดที่สหกรณ์ประกาศ — วันเหล่านี้ไม่นับเป็นวันลา
        </p>
      </div>
      <HRHolidayCalendarTab readOnly />
    </div>
  )
}
