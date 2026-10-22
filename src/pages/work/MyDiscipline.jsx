// src/pages/work/MyDiscipline.jsx
// แจ้งเรื่อง/ประวัติการตักเตือนของฉัน (3Q)
//   ?view=report  (default) แบบฟอร์มแจ้งเรื่อง  — POST /personnel/me/discipline-reports
//   ?view=reports เรื่องที่ฉันแจ้ง (สถานะเท่านั้น) — GET /personnel/me/discipline-reports
//   ?view=history ประวัติการตักเตือนของฉัน + PDF — GET /personnel/me/discipline (&id=<action id> จากการแจ้งเตือน)
// STUB (WP0) — WP3 แทนที่เนื้อหา
import PageTitle from "../../components/PageTitle"
import ComingSoon from "../../components/ComingSoon"
import { cardCls } from "../../lib/styles"

export default function MyDiscipline() {
  return (
    <div className="mx-auto max-w-4xl space-y-5 pb-10">
      <PageTitle title="แจ้งเรื่องและประวัติการตักเตือน" />
      <div className={cardCls}>
        <ComingSoon />
      </div>
    </div>
  )
}
