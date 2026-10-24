// src/lib/exitTypes.js
// ประเภทการออกจากงาน (exit_type) — ชื่อไทยกลางของหน้า HR
//   ค่ามาตรฐานจาก TerminationForm: resigned / retired / dismissed / deceased / failed_probation / contract_end
//   ข้อมูลเก่าที่บันทึกก่อนมีฟอร์มยังเก็บเป็น resign / retire / dismiss → แปลเป็นชื่อเดียวกัน

export const EXIT_TYPE_LABEL = {
  retired: "เกษียณอายุ",
  deceased: "เสียชีวิต",
  resigned: "ลาออก",
  dismissed: "ไล่ออก",
  failed_probation: "ไม่ผ่านทดลองงาน",
  contract_end: "สิ้นสุดสัญญาจ้าง",
}

const LEGACY = { resign: "resigned", retire: "retired", dismiss: "dismissed" }

/** "resign" → "resigned" · ค่าอื่นคืนตามเดิม */
export const normalizeExitType = (v) => {
  const k = String(v ?? "").trim().toLowerCase()
  return LEGACY[k] ?? k
}

/** ชื่อไทยของ exit_type — ไม่รู้จัก → คืนค่าเดิม, ว่าง → null */
export const exitTypeLabel = (v) => {
  if (v == null || v === "") return null
  return EXIT_TYPE_LABEL[normalizeExitType(v)] ?? String(v)
}
