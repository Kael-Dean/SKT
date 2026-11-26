// สถานะงวดเงินเดือน (period_status จาก /hr/dashboard/payroll-trend และ /hr/payroll/*)
// ปิดงวด/อนุมัติแล้ว = ยอดจริง · อย่างอื่น (draft ฯลฯ) = ร่าง ต้องติดป้ายให้ผู้ดูรู้

const FINAL = new Set(["closed", "approved", "paid", "locked", "finalized", "finalised"])

/** true เมื่อรู้สถานะและยังไม่ใช่งวดที่ปิด/อนุมัติแล้ว (ไม่รู้สถานะ = ไม่ติดป้าย) */
export function isDraftPeriod(status) {
  if (status == null || status === "") return false
  return !FINAL.has(String(status).toLowerCase())
}
