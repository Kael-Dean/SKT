// src/pages/hr/tabs/HRLeaveLogTab.jsx
// การลารายคน (รายครั้ง) — เลือกพนักงาน แล้วดูทุกใบลารวมใบที่ยกเลิก · GET /hr/employees/{id}/leaves?year=
// คนที่เลือก + ปีงบ เก็บใน URL (?emp=&fy=) เพื่อให้ลิงก์จากหน้าข้อมูลพนักงานเปิดตรงคนได้
import { useSearchParams } from "react-router-dom"
import EmployeePicker from "../../../components/hr/EmployeePicker"
import LeaveLog from "../../../components/leave/LeaveLog"
import { currentFiscalYearBE } from "../../../lib/leaveDays"
import { keepBackState } from "../../../lib/drill"

export default function HRLeaveLogTab() {
  const [params, setParams] = useSearchParams()
  const emp = params.get("emp") || ""
  const fyParam = params.get("fy")
  const year = fyParam === "all" ? null : Number(fyParam) || currentFiscalYearBE()

  const update = (key, value) =>
    setParams((p) => {
      if (value == null || value === "") p.delete(key)
      else p.set(key, String(value))
      return p
    }, { replace: true, state: keepBackState() })

  return (
    <LeaveLog
      endpoint={emp ? `/hr/employees/${emp}/leaves` : null}
      year={year}
      onYearChange={(y) => update("fy", y ?? "all")}
      emptyHint="เลือกพนักงานเพื่อดูว่าลากี่ครั้ง ลาวันไหน รวมใบที่ยกเลิก"
      toolbar={
        <div className="w-full min-w-0 sm:w-80">
          <EmployeePicker id="leave-log-emp" label="พนักงาน" value={emp} onChange={(v) => update("emp", v)} />
        </div>
      }
    />
  )
}
