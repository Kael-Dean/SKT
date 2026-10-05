// src/pages/hr/HRRelocation.jsx
// หน้า /hr/relocation — จัดการคำขอย้ายสาขา + ย้ายสาขาโดยตรง (3E)
// ใช้ logic ชุดเดียวกับแท็บใน HR Dashboard เพื่อไม่ให้ endpoint/flow แตกต่างกันสองที่
import HRRelocationTab from "./tabs/HRRelocationTab"

export default function HRRelocation() {
  return (
    <div className="space-y-5 pb-10">
      <div>
        <h1 className="text-xl font-bold text-gray-900 dark:text-gray-100">จัดการย้ายสาขา</h1>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
          พิจารณาคำขอย้ายสาขาของพนักงาน หรือบันทึกการย้ายตามคำสั่งโดยตรง
        </p>
      </div>
      <HRRelocationTab />
    </div>
  )
}
