// src/pages/hr/HRKpiPage.jsx
// Standalone KPI page (/hr/kpi) so ผู้จัดการ (role 2) and ผู้ช่วยผู้จัดการ (role 7) can review/approve
// without opening the whole HR dashboard (which stays roles 1·3). Same content as the dashboard's KPI tab.
import { useEffect } from "react"
import PageTitle from "../../components/PageTitle"
import { cardCls } from "../../lib/styles"
import HRKpiTab from "./tabs/HRKpiTab"

export default function HRKpiPage() {
  useEffect(() => {
    const prev = document.title
    document.title = "ประเมิน KPI และเลื่อนขั้น"
    return () => { document.title = prev }
  }, [])

  return (
    <div className={`${cardCls} min-w-0 p-4 lg:p-5 xl:p-6`}>
        <PageTitle title="ประเมิน KPI และเลื่อนขั้น" />
        <HRKpiTab />
    </div>
  )
}
