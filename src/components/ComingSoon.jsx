// src/components/ComingSoon.jsx
// Placeholder ชั่วคราวของหน้า/ช่องที่ WP0 scaffold สร้างไว้ (3P / 3Q / 3L / 3H / 3F / 3M / 3C รายวัน)
// แพ็กเกจที่รับงานต่อแทนที่เนื้อหา stub แล้วเลิก import ไฟล์นี้ — ลบได้เมื่อไม่มีใครใช้แล้ว
import { EmptyState } from "./ui"
import { cx } from "../lib/styles"

/** compact = ใช้ในการ์ดย่อย (เช่นช่องในโปรไฟล์พนักงาน) */
export default function ComingSoon({ title = "กำลังพัฒนา", description = "ส่วนนี้กำลังพัฒนา จะเปิดใช้งานเร็ว ๆ นี้", compact = false }) {
  return (
    <EmptyState
      title={title}
      description={description}
      className={cx(compact && "!py-6")}
    />
  )
}
