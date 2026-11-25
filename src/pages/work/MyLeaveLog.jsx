// src/pages/work/MyLeaveLog.jsx
// ประวัติการลาของฉัน (รายครั้ง) — GET /personnel/me/leaves?year=  · รวมใบที่ยกเลิก
import { useState } from "react"
import PageTitle from "../../components/PageTitle"
import LeaveLog from "../../components/leave/LeaveLog"
import { currentFiscalYearBE } from "../../lib/leaveDays"

export default function MyLeaveLog() {
  const [year, setYear] = useState(() => currentFiscalYearBE())
  return (
    <div className="p-4 md:p-6">
      <PageTitle title="ประวัติการลาของฉัน" />
      <LeaveLog endpoint="/personnel/me/leaves" year={year} onYearChange={setYear} />
    </div>
  )
}
