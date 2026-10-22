// src/pages/work/MyWelfare.jsx
// สวัสดิการของฉัน (3P) — GET /personnel/me/welfare (อ่านอย่างเดียว: คำขอเบิก + สิทธิ์คงเหลือ + ครอบครัวที่ได้รับสิทธิ์)
// STUB (WP0) — WP2 แทนที่เนื้อหา
import PageTitle from "../../components/PageTitle"
import ComingSoon from "../../components/ComingSoon"
import { cardCls } from "../../lib/styles"

export default function MyWelfare() {
  return (
    <div className="mx-auto max-w-4xl space-y-5 pb-10">
      <PageTitle title="สวัสดิการของฉัน" />
      <div className={cardCls}>
        <ComingSoon />
      </div>
    </div>
  )
}
