// src/lib/apiErrors.js
// ─────────────────────────────────────────────────────────────────────────────
// แปลง error จาก api()/apiAuth() เป็น { title, description } ภาษาไทยสำหรับ toast / dialog
//
//   401              → หมดเวลาใช้งาน (apiAuth พาไปหน้า login ให้อยู่แล้ว)
//   403 + detail     → กฎธุรกิจของ backend (เช่น "ใช้ได้เฉพาะสาขาที่ใช้งานอยู่") — แสดง detail ตรง ๆ
//   409 + detail     → เช่น "สต็อกไม่พอ: คงเหลือ X กก. ต้องการ Y กก." — แสดง detail ตรง ๆ
//   422              → detail ไทยแสดงตรง ๆ, ไม่ใช่ไทย = ข้อความกลาง
// ─────────────────────────────────────────────────────────────────────────────

const hasThai = (s) => /[฀-๿]/.test(String(s || ""))

/** ข้อความ detail จริงจาก backend (string) — "" ถ้าไม่มี */
export function apiDetail(err) {
  const d = err?.data?.detail
  if (typeof d === "string") return d
  if (d && typeof d === "object" && !Array.isArray(d)) return String(d.msg || d.message || "")
  if (Array.isArray(d)) return d.map((x) => x?.msg).filter(Boolean).join(" | ")
  return typeof err?.message === "string" && err.message !== "Request failed" ? err.message : ""
}

export const isStockShortage = (err) => err?.status === 409 && /สต็อกไม่พอ|สต๊อกไม่พอ/.test(apiDetail(err))

export function describeApiError(err, { action = "บันทึก" } = {}) {
  const status = err?.status
  const detail = apiDetail(err)
  const thai = hasThai(detail)

  if (!status) {
    return { title: `${action}ไม่สำเร็จ`, description: "เชื่อมต่อเซิร์ฟเวอร์ไม่ได้ ตรวจสัญญาณแล้วลองใหม่ ข้อมูลที่กรอกยังอยู่" }
  }
  if (status === 401) {
    return { title: "หมดเวลาใช้งาน", description: "เข้าสู่ระบบใหม่แล้วลองอีกครั้ง" }
  }
  if (status === 403) {
    return detail
      ? { title: `${action}ไม่ได้`, description: detail }
      : { title: "ไม่มีสิทธิ์ใช้งาน", description: "ตำแหน่งของบัญชีนี้ไม่มีสิทธิ์ทำรายการนี้" }
  }
  if (status === 409) {
    if (isStockShortage(err)) return { title: "สต็อกไม่พอ", description: detail }
    return { title: `${action}ไม่ได้`, description: detail || "ข้อมูลนี้ขัดแย้งกับรายการที่มีอยู่ ตรวจสอบแล้วลองใหม่" }
  }
  if (status === 404) {
    return { title: "ไม่พบข้อมูล", description: thai ? detail : "ไม่พบรายการนี้ อาจถูกลบหรือแก้ไขไปแล้ว" }
  }
  if (status === 422) {
    return { title: "ข้อมูลไม่ผ่านการตรวจ", description: thai ? detail : "เซิร์ฟเวอร์ปฏิเสธข้อมูลบางช่อง ตรวจค่าที่กรอกแล้วลองใหม่" }
  }
  if (status >= 500) {
    return { title: "เซิร์ฟเวอร์ขัดข้อง", description: `ยังไม่ได้${action} ลองใหม่ในอีกสักครู่ ถ้ายังไม่ได้ให้แจ้งผู้ดูแลระบบ` }
  }
  return { title: `${action}ไม่สำเร็จ`, description: thai ? detail : "เกิดข้อผิดพลาดที่ไม่คาดคิด ลองใหม่อีกครั้ง" }
}

/** ข้อความบรรทัดเดียว (สำหรับที่ที่แสดงได้แค่ string) */
export const apiErrorText = (err, opts) => {
  const { title, description } = describeApiError(err, opts)
  return description ? `${title}: ${description}` : title
}
