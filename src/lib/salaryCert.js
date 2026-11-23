// src/lib/salaryCert.js
// ─────────────────────────────────────────────────────────────────────────────
// หนังสือรับรองเงินเดือน (3M · 13G + PR 44 "Supervisor + Manager") — ค่ากลางที่
// HRSalaryCertTab / MySalaryCert / SalaryCertSupervisorQueue ใช้ร่วมกัน
//
//   pending_supervisor ──(หัวหน้าให้ความเห็น)──▶ pending_manager ──(ผู้จัดการ)──▶ approved | denied
//            └──────────────(ผู้จัดการพิจารณาได้เลยโดยไม่ต้องรอ)──────────────▶
//
// สถานะ `pending` เดิมไม่มีแล้ว — ใช้ isSalaryCertPending() แทนการเทียบ string
// ─────────────────────────────────────────────────────────────────────────────
import { apiDownload } from "./api"
import { saveBlob } from "./files"

export const SALARY_CERT_STATUS = Object.freeze({
  PENDING_SUPERVISOR: "pending_supervisor",
  PENDING_MANAGER: "pending_manager",
  APPROVED: "approved",
  DENIED: "denied",
})

export const SALARY_CERT_STATUS_LABEL = Object.freeze({
  pending_supervisor: "รอความเห็นผู้บังคับบัญชา",
  pending_manager: "รอผู้จัดการพิจารณา",
  approved: "อนุมัติแล้ว",
  denied: "ไม่อนุมัติ",
  pending: "รอพิจารณา", // แถวเก่าที่ยังไม่ผ่าน migration
})

export const SALARY_CERT_STATUS_TONE = Object.freeze({
  pending_supervisor: "pending",
  pending_manager: "info",
  approved: "success",
  denied: "danger",
  pending: "pending",
})

export const salaryCertStatusLabel = (s) => SALARY_CERT_STATUS_LABEL[s] ?? s ?? "—"
export const salaryCertStatusTone = (s) => SALARY_CERT_STATUS_TONE[s] ?? "neutral"

/** ทั้งสองขั้นที่ยังไม่ตัดสิน นับเป็น "รอพิจารณา" */
export const isSalaryCertPending = (s) =>
  s === SALARY_CERT_STATUS.PENDING_SUPERVISOR || s === SALARY_CERT_STATUS.PENDING_MANAGER || s === "pending"

export const SALARY_CERT_PURPOSE_LABEL = Object.freeze({
  document: "เพื่อใช้เป็นหลักฐาน",
  loan_self: "เพื่อกู้เงิน",
  loan_guarantee: "เพื่อค้ำประกันเงินกู้",
})
export const salaryCertPurposeLabel = (p) => SALARY_CERT_PURPOSE_LABEL[p] ?? p ?? "หนังสือรับรองเงินเดือน"

export const SUPERVISOR_OPINION_LABEL = Object.freeze({
  agree: "เห็นชอบ",
  disagree: "ไม่เห็นชอบ",
})

// ─── ข้อมูลหัวกระดาษ / ผู้ลงนาม (ตามแบบฟอร์มจริงของ สกต.) ─────────────────────
export const ORG_LETTERHEAD = Object.freeze({
  nameTh: "สหกรณ์การเกษตรเพื่อการตลาดลูกค้า ธ.ก.ส. สุรินทร์ จำกัด",
  addressTh: "126 ม.4 ต.ตาอ็อง อ.เมือง จ.สุรินทร์ 32000 โทรศัพท์ 085-695-6247",
  nameEn: "Agricultural Marketing Cooperative Surin Limited",
  addressEn: "126 Moo 4, Tambon Ta-ong, Amphoe Mueang, Surin 32000 · Tel. 085-695-6247",
  short: "สกต.สุรินทร์",
  sealSrc: "/logo/skt-seal.png",
})
export const DEFAULT_SIGNER = Object.freeze({ name: "นางสาวกมลทิพย์ พิมพ์เสน", title: "ผู้จัดการ" })

// ─── วันที่ / จำนวนเงินแบบหนังสือราชการ ─────────────────────────────────────
const toDate = (iso) => {
  if (!iso) return null
  const d = new Date(String(iso).length <= 10 ? `${iso}T00:00:00` : iso)
  return Number.isNaN(d.getTime()) ? null : d
}
/** ISO → { day, month, year } แบบไทย (พ.ศ.) */
export function thaiDateParts(iso) {
  const d = toDate(iso)
  if (!d) return null
  return {
    day: String(d.getDate()),
    month: d.toLocaleDateString("th-TH", { month: "long" }),
    year: String(d.getFullYear() + 543),
  }
}
/** ISO → "1 มิถุนายน 2560" */
export function thaiLongDate(iso) {
  const p = thaiDateParts(iso)
  return p ? `${p.day} ${p.month} ${p.year}` : ""
}
/** ISO ของวันนี้ตามเวลาเครื่อง */
export function todayIso() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`
}

const TH_DIGIT = ["", "หนึ่ง", "สอง", "สาม", "สี่", "ห้า", "หก", "เจ็ด", "แปด", "เก้า"]
const TH_PLACE = ["", "สิบ", "ร้อย", "พัน", "หมื่น", "แสน"]
function readUpToMillion(s) {
  // s = ตัวเลขไม่เกิน 6 หลัก (ไม่มีศูนย์นำหน้าก็ได้)
  let out = ""
  s = s.replace(/^0+/, "") // ก้อนล่างของ "ล้าน" (000001) อ่าน "หนึ่ง" ไม่ใช่ "เอ็ด"
  const len = s.length
  for (let i = 0; i < len; i++) {
    const n = Number(s[i])
    const pos = len - i - 1
    if (n === 0) continue
    if (pos === 0 && n === 1 && len > 1) out += "เอ็ด"
    else if (pos === 1 && n === 2) out += "ยี่"
    else if (pos === 1 && n === 1) out += ""
    else out += TH_DIGIT[n]
    out += TH_PLACE[pos]
  }
  return out
}
function readInteger(s) {
  s = s.replace(/^0+/, "")
  if (!s) return "ศูนย์"
  const parts = []
  while (s.length > 6) { parts.unshift(s.slice(-6)); s = s.slice(0, -6) }
  parts.unshift(s)
  return parts.map((p, i) => readUpToMillion(p) + (i < parts.length - 1 ? "ล้าน" : "")).join("")
}
/** 25000.5 → "สองหมื่นห้าพันบาทห้าสิบสตางค์" · ค่าไม่ใช่ตัวเลข → "" */
export function bahtText(value) {
  const n = Number(String(value ?? "").replace(/,/g, ""))
  if (!Number.isFinite(n) || n < 0 || String(value ?? "").trim() === "") return ""
  const [intPart, decPart = "00"] = n.toFixed(2).split(".")
  const baht = readInteger(intPart) + "บาท"
  return decPart === "00" ? `${baht}ถ้วน` : `${baht}${readInteger(decPart)}สตางค์`
}
/** ตัวเลขเงิน 2 ตำแหน่ง (25,000.00) · ค่าว่าง → "" */
export function moneyText(value) {
  const n = Number(String(value ?? "").replace(/,/g, ""))
  if (String(value ?? "").trim() === "" || !Number.isFinite(n)) return ""
  return n.toLocaleString("th-TH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

/** ดาวน์โหลด PDF จาก path ที่ให้มา แล้วสั่ง browser บันทึกไฟล์ */
export async function downloadSalaryCertPdf(path, fallbackName) {
  const { blob, filename } = await apiDownload(path)
  await saveBlob(blob, filename && filename !== "download" ? filename : fallbackName)
}
