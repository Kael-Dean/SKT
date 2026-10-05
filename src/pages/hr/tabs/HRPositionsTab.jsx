// src/pages/hr/tabs/HRPositionsTab.jsx
// จัดการตำแหน่งงาน (3D) — ใช้ PositionsManager ตัวกลาง (ชื่อ, ระดับ/กระบอก, ปิดใช้งาน + ยืนยัน)
// API: GET/POST /hr/positions · PATCH /hr/positions/{id} · PATCH /hr/positions/{id}/deactivate
import PositionsManager from "../../../components/hr/PositionsManager"

export default function HRPositionsTab() {
  return <PositionsManager />
}
