// src/pages/hr/tabs/HRIssueTab.jsx
// คำร้องแจ้งแก้ไขข้อมูล (3F) — HR dashboard ?tab=issues (&id=<report> จากการแจ้งเตือน)
// เนื้อหาทั้งหมดอยู่ที่ components/hr/IssueReportsPanel.jsx (ใช้ร่วมกับหน้า /hr/issues)
import IssueReportsPanel from "../../../components/hr/IssueReportsPanel"

export default function HRIssueTab() {
  return <IssueReportsPanel idBase="hr-issues" />
}
