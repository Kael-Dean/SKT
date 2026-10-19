// src/components/PageTitle.jsx
// หัวข้อหน้า (h1) — มองไม่เห็นในหน้า (sr-only, ยังอยู่ให้ screen reader / ลำดับหัวข้อ)
// ชื่อจริงที่ผู้ใช้เห็นอยู่ใน Topbar (sticky) — ประหยัดพื้นที่ต้นหน้า ไม่ต้องเลื่อนผ่านหัวข้อใหญ่
//   <PageTitle title="ใบลา" />
//   <PageTitle title={`แก้ไขออเดอร์ ${side}`} ref={topRef} tabIndex={-1} />   (ใช้เป็นจุด focus/scroll ได้)
import { usePageTitle } from "../lib/pageTitle"

export default function PageTitle({ title, ref, ...rest }) {
  usePageTitle(title)
  return (
    <h1 ref={ref} className="sr-only" {...rest}>
      {title}
    </h1>
  )
}
