// src/pages/hr/HRIssueReports.jsx
// คำร้องแจ้งแก้ไขข้อมูล (3F) — หน้าเดี่ยว /hr/issues
// เนื้อหาทั้งหมดอยู่ที่ components/hr/IssueReportsPanel.jsx (ใช้ร่วมกับแท็บ HR dashboard ?tab=issues)
import PageTitle from "../../components/PageTitle"
import IssueReportsPanel from "../../components/hr/IssueReportsPanel"

export default function HRIssueReports() {
  return (
    <div className="pb-10">
      <PageTitle title="คำร้องแจ้งแก้ไขข้อมูล" />
      <IssueReportsPanel idBase="issue-reports" />
    </div>
  )
}
