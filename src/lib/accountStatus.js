// ชื่อไทยของ account_status (backend ส่งค่าอังกฤษ: new / registered ฯลฯ)
// ใช้ account_status_label จาก backend ก่อนถ้ามี — ค่าที่ไม่รู้จักแสดงตามเดิม
const LABELS = {
  new: "บัญชีใหม่ (ยังไม่ได้ตั้งรหัสผ่าน)",
  register: "ใช้งานอยู่",
  registered: "ใช้งานอยู่",
  active: "ใช้งานอยู่",
  inactive: "ปิดการใช้งาน",
  disabled: "ปิดการใช้งาน",
  suspended: "ระงับการใช้งาน",
  locked: "ถูกล็อก",
}

export function accountStatusLabel(status, label) {
  if (label) return label
  if (status == null || status === "") return null
  return LABELS[String(status).toLowerCase()] ?? String(status)
}
