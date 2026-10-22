// src/pages/work/MySalaryCert.jsx
// ขอหนังสือรับรองเงินเดือน (3M · 13G) — POST/GET /personnel/me/salary-cert-requests
// STUB (WP0) — WP7 แทนที่เนื้อหา
import PageTitle from "../../components/PageTitle"
import ComingSoon from "../../components/ComingSoon"
import { cardCls } from "../../lib/styles"

export default function MySalaryCert() {
  return (
    <div className="mx-auto max-w-4xl space-y-5 pb-10">
      <PageTitle title="ขอหนังสือรับรองเงินเดือน" />
      <div className={cardCls}>
        <ComingSoon />
      </div>
    </div>
  )
}
