// src/pages/hr/HRKpiPage.jsx
// Standalone KPI page (/hr/kpi) so ผู้จัดการ (role 2) and ผู้ช่วยผู้จัดการ (role 7) can review/approve
// without opening the whole HR dashboard (which stays roles 1·3). Same content as the dashboard's KPI tab.
import { useEffect } from "react"
import { Target } from "lucide-react"
import { PageSection } from "../../components/ui"
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
        <PageSection
          as="h1"
          title="ประเมิน KPI และเลื่อนขั้น"
          description="ตรวจสอบและอนุมัติผลการประเมินประจำปี การอนุมัติของผู้จัดการจะปรับขั้นและเงินเดือน มีผล 1 เม.ย."
          icon={Target}
        >
          <HRKpiTab />
        </PageSection>
    </div>
  )
}
