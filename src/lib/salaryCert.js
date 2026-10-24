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
  agree: "เห็นด้วย",
  disagree: "ไม่เห็นด้วย",
})

/** ดาวน์โหลด PDF จาก path ที่ให้มา แล้วสั่ง browser บันทึกไฟล์ */
export async function downloadSalaryCertPdf(path, fallbackName) {
  const { blob, filename } = await apiDownload(path)
  const url = URL.createObjectURL(blob)
  const a = document.createElement("a")
  a.href = url
  a.download = filename || fallbackName
  a.click()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}
