// src/pages/hr/HRRelocation.jsx
// หน้า /hr/relocation — จัดการคำขอย้ายสาขา + ย้ายสาขาโดยตรง (3E)
// ใช้ logic ชุดเดียวกับแท็บใน HR Dashboard เพื่อไม่ให้ endpoint/flow แตกต่างกันสองที่
import HRRelocationTab from "./tabs/HRRelocationTab"
import PageTitle from "../../components/PageTitle"

export default function HRRelocation() {
  return (
    <div className="space-y-5 pb-10">
      <PageTitle title="จัดการย้ายสาขา" />
      <HRRelocationTab />
    </div>
  )
}
