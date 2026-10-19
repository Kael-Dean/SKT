// src/pages/work/OutOfOfficeApprovals.jsx
// หน้าอนุมัติคำขอออกนอกสถานที่ สำหรับผู้อนุมัติที่เข้า HR dashboard ไม่ได้
// (ผู้จัดการ 2 · หัวหน้าสาขา 6 · ผู้ช่วยผู้จัดการ 7). เนื้อหาทั้งหมดอยู่ใน HROutOfOfficeTab.
// AppLayout already applies page padding — this wrapper only adds width + heading.
import HROutOfOfficeTab from "../hr/tabs/HROutOfOfficeTab"
import PageTitle from "../../components/PageTitle"

export default function OutOfOfficeApprovals() {
  return (
    <div className="max-w-6xl mx-auto space-y-5 pb-12">
      <PageTitle title="อนุมัติคำขอออกนอกสถานที่" />
      <HROutOfOfficeTab />
    </div>
  )
}
