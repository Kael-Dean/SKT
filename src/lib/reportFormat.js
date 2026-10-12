// src/lib/reportFormat.js
// ─────────────────────────────────────────────────────────────────────────────
// Excel (.xlsx) twins of the report PDFs.
// Backend rule (api-handoff "Excel downloads for reports"): every list/summary
// report's Excel endpoint sits beside its PDF endpoint with the SAME query
// string and the SAME auth, so the Excel URL is always derived from the PDF URL:
//   .../pdf  → .../xlsx        (/reports/phase1/P12/pdf → /reports/phase1/P12/xlsx)
//   ...-pdf  → ...-xlsx        (/hr/leave/register-pdf  → /hr/leave/register-xlsx)
//   other    → append /xlsx    (/repgen/report/sale-goal → /repgen/report/sale-goal/xlsx)
// The response is an attachment → save via blob, never iframe / new tab.
// Errors are JSON (401/403/404/422/500) → toast, never saved as a file.
// ─────────────────────────────────────────────────────────────────────────────
import { apiDownload } from "./api"

/** Subtle hint for Excel buttons: totals are live =SUM formulas, so phone /
 *  LINE quick-look previews may show blank or 0 until opened in a real app. */
export const EXCEL_HINT = "ยอดรวมเป็นสูตร เปิดด้วย Excel หรือ Google Sheets"

/** Derive the Excel endpoint from a PDF endpoint (query string preserved). */
export function excelUrl(pdfPath) {
  const s = String(pdfPath || "")
  const i = s.indexOf("?")
  const path = i === -1 ? s : s.slice(0, i)
  const qs = i === -1 ? "" : s.slice(i + 1)
  const x =
    path.endsWith("/pdf") || path.endsWith("-pdf")
      ? path.slice(0, -3) + "xlsx"
      : path.replace(/\/+$/, "") + "/xlsx"
  return qs ? `${x}?${qs}` : x
}

/** "report.pdf" → "report.xlsx" (adds .xlsx when there is no extension). */
export function xlsxFilename(name) {
  const n = String(name || "report").trim() || "report"
  return /\.[a-z0-9]+$/i.test(n) ? n.replace(/\.[a-z0-9]+$/i, ".xlsx") : `${n}.xlsx`
}

/** Save a Blob under `filename` via a temporary <a download>. */
export function saveBlob(blob, filename) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement("a")
  a.href = url
  a.download = filename || "download"
  a.rel = "noopener"
  document.body.appendChild(a)
  a.click()
  a.remove()
  // Revoke on the next turn — revoking synchronously can cancel the download in some browsers.
  setTimeout(() => URL.revokeObjectURL(url), 4000)
}

/**
 * Download the Excel twin of `pdfPath` and save it.
 * @param {string} pdfPath    the exact PDF path (incl. query string) the PDF button uses
 * @param {object} [opts]
 * @param {string} [opts.fallbackName]  used when the response has no Content-Disposition filename
 * @returns {Promise<string>} the saved filename
 */
export async function downloadExcel(pdfPath, { fallbackName } = {}) {
  const { blob, filename } = await apiDownload(excelUrl(pdfPath))

  // A 200 that isn't a spreadsheet (e.g. a JSON error or an HTML fallback page
  // from a proxy) must never land on disk as "report.xlsx".
  const type = String(blob?.type || "").toLowerCase()
  if (type.includes("json") || type.includes("text/html")) {
    const err = new Error("Unexpected response type")
    err.status = 502
    throw err
  }

  const name =
    filename && filename !== "download"
      ? filename
      : xlsxFilename(fallbackName || "report.xlsx")
  saveBlob(blob, name)
  return name
}

/** Thai, user-facing message for a failed Excel download. */
export function excelErrorMessage(err) {
  const status = Number(err?.status) || 0
  const detail = typeof err?.data?.detail === "string" ? err.data.detail.trim() : ""
  const msg = String(err?.message || "").trim()
  const isThai = (s) => /[฀-๿]/.test(s)

  // FastAPI's own unknown-route 404 is {"detail":"Not Found"} — on staging the
  // xlsx routes 404 until backend PR um_backend#12 is merged. A real 404 with a
  // specific detail (e.g. facility not found) is shown as-is.
  if (status === 404) {
    if (detail && detail.toLowerCase() !== "not found") return detail.slice(0, 200)
    return "ยังไม่รองรับไฟล์ Excel สำหรับรายงานนี้"
  }
  if (status === 401) return "หมดเวลาใช้งาน เข้าสู่ระบบใหม่แล้วลองอีกครั้ง"
  if (status === 403) return "บัญชีนี้ไม่มีสิทธิ์ดาวน์โหลดรายงานนี้"
  if (status === 422) return (isThai(msg) && msg.slice(0, 200)) || "ข้อมูลที่เลือกไม่ถูกต้อง ตรวจแล้วลองใหม่"
  if (!status && err instanceof TypeError) return "เชื่อมต่อเซิร์ฟเวอร์ไม่ได้ ตรวจอินเทอร์เน็ตแล้วลองใหม่"
  return (isThai(msg) && msg.slice(0, 200)) || "สร้างไฟล์ Excel ไม่สำเร็จ ลองใหม่อีกครั้ง"
}
