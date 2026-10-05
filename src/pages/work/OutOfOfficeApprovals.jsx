// src/pages/work/OutOfOfficeApprovals.jsx
// หน้าอนุมัติคำขอออกนอกสถานที่ สำหรับผู้อนุมัติที่เข้า HR dashboard ไม่ได้
// (ผู้จัดการ 2 · หัวหน้าสาขา 6 · ผู้ช่วยผู้จัดการ 7). เนื้อหาทั้งหมดอยู่ใน HROutOfOfficeTab.
// AppLayout already applies page padding — this wrapper only adds width + heading.
import HROutOfOfficeTab from "../hr/tabs/HROutOfOfficeTab"

export default function OutOfOfficeApprovals() {
  return (
    <div className="max-w-6xl mx-auto space-y-5 pb-12">
      <div>
        <h1 className="text-xl font-bold text-gray-900 dark:text-gray-100">อนุมัติคำขอออกนอกสถานที่</h1>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
          พิจารณาคำขอที่รอคุณ ดูสรุปรายสาขา และการตั้งค่าเวลาทำงาน
        </p>
      </div>
      <HROutOfOfficeTab />
    </div>
  )
}
