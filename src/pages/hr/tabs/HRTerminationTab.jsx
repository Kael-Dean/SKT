// src/pages/hr/tabs/HRTerminationTab.jsx
// 13E — Termination Settlement: เลือกเจ้าหน้าที่ (active) → ฟอร์มบันทึกออกจากงาน (src/components/hr/TerminationForm.jsx)
// รายชื่อมาจาก GET /hr/personnel?is_active=true ผ่าน EmployeePicker (ค้นชื่อ/รหัส/ตำแหน่งได้ในช่องเดียว)
import { useState } from "react"
import EmployeePicker from "../../../components/hr/EmployeePicker"
import TerminationForm from "../../../components/hr/TerminationForm"
import { refreshPersonnel } from "../../../components/hr/personnelCache"

export default function HRTerminationTab() {
  const [empId, setEmpId] = useState("")
  const [employee, setEmployee] = useState(null)

  const pick = (value, person) => {
    setEmpId(value)
    setEmployee(person)
  }

  return (
    <div className="space-y-4">
      <div className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-gray-200/70 dark:bg-surface dark:ring-line">
        <EmployeePicker id="term-emp-picker" label="เลือกเจ้าหน้าที่ที่จะบันทึกออกจากงาน" value={empId} onChange={pick} />
      </div>

      {employee && (
        <div className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-gray-200/70 dark:bg-surface dark:ring-line">
          <TerminationForm
            key={employee.id}
            employee={employee}
            // ออกจากงานแล้ว = ไม่ active → โหลดรายชื่อใหม่ให้หายจากตัวเลือก (ฟอร์มยังแสดงต่อเพื่อโหลด PDF/แก้ไข)
            onSaved={({ created }) => { if (created) refreshPersonnel() }}
          />
        </div>
      )}
    </div>
  )
}
