// src/lib/shortfall.js — ดาวน์โหลด PDF รายชื่อเจ้าหน้าที่ที่เงินเดือนสุทธิติดลบ (PR 107)
import { apiDownload } from "./api"
import { saveBlob } from "./files"
import { toast } from "../components/ui"

/** คืน true เมื่อสำเร็จ */
export async function downloadShortfallPdf({ year, month }) {
  try {
    const { blob, filename } = await apiDownload(`/hr/payroll/shortfalls/pdf?year=${year}&month=${month}`)
    await saveBlob(blob, filename && filename !== "download" ? filename : `shortfalls_${year + 543}-${String(month).padStart(2, "0")}.pdf`)
    return true
  } catch (err) {
    toast.error("ดาวน์โหลดรายชื่อไม่สำเร็จ", { description: err.message || undefined })
    return false
  }
}
