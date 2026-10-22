// src/pages/work/MyKpi.jsx
// ผลการประเมินของฉัน (3L) — ช่วงประเมิน: แบบประเมินตนเอง PUT /personnel/me/kpi/self-assessment
// หลังผู้จัดการอนุมัติ: การ์ดผล GET /personnel/me/kpi/result
// STUB (WP0) — WP4 แทนที่เนื้อหา
import PageTitle from "../../components/PageTitle"
import ComingSoon from "../../components/ComingSoon"
import { cardCls } from "../../lib/styles"

export default function MyKpi() {
  return (
    <div className="mx-auto max-w-4xl space-y-5 pb-10">
      <PageTitle title="ผลการประเมินของฉัน" />
      <div className={cardCls}>
        <ComingSoon />
      </div>
    </div>
  )
}
