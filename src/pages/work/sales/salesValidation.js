// src/pages/work/sales/salesValidation.js
// ─────────────────────────────────────────────────────────────────────────────
// Per-step validators for the Sales page. Messages are the original strings
// from Sales.jsx `validateAll` (copy deck §9.2 "เดิม" column), except the
// round-2 jargon cleanup: no field/DB names (member_id, asso_id) and spec
// errors say the product form lacks the value. `validateAll` merges the three steps and
// returns the exact shape the page always produced:
//   { fullName?, memberId?, companyName?, taxId?, product?, …, klangName?,
//     payment?, issueDate?, trailers?: [{ scaleNoFront?, frontWeightKg?, … _net? }] }
// Pure functions — no React, no setState. Callers set state themselves.
// ─────────────────────────────────────────────────────────────────────────────
import { onlyDigits } from "./salesShared"

/** Step 1 — ลูกค้า + วิธีชำระเงิน + วันที่ */
export function validateCustomer({ buyerType, customer, memberMeta, paymentId, order }) {
  const e = {}
  if (buyerType === "person") {
    if (!customer.fullName) e.fullName = "กรุณากรอกชื่อ–สกุล"
    const memberIdStrForValidate = onlyDigits(String(customer.memberId || ""))
    if (!memberIdStrForValidate && !memberMeta.assoId) {
      e.memberId = "กรอกรหัสสมาชิก หรือเลือกชื่อจากผลค้นหา"
    }
  } else {
    if (!customer.companyName.trim()) e.companyName = "กรุณากรอกชื่อบริษัท"
    if (!customer.taxId.trim()) e.taxId = "กรุณากรอกเลขผู้เสียภาษี"
  }
  if (!paymentId) e.payment = "เลือกวิธีชำระเงิน"
  if (!order.issueDate) e.issueDate = "กรุณาเลือกวันที่"
  return e
}

/** Step 2 — สเปค (มาจากฟอร์มสินค้า) + สาขา/คลัง */
export function validateSpec({ order }) {
  const e = {}
  if (!order.productId) e.product = "ฟอร์มนี้ไม่ได้กำหนดประเภทสินค้า · เลือกฟอร์มอื่น"
  if (!order.riceId) e.riceType = "ฟอร์มนี้ไม่ได้กำหนดชนิดข้าว · เลือกฟอร์มอื่น"
  if (!order.subriceId) e.subrice = "ฟอร์มนี้ไม่ได้กำหนดชั้นย่อย · เลือกฟอร์มอื่น"
  if (!order.conditionId) e.condition = "ฟอร์มนี้ไม่ได้กำหนดสภาพ/เงื่อนไข · เลือกฟอร์มอื่น"
  if (!order.fieldTypeId) e.fieldType = "ฟอร์มนี้ไม่ได้กำหนดประเภทนา · เลือกฟอร์มอื่น"
  if (!order.riceYearId) e.riceYear = "ฟอร์มนี้ไม่ได้กำหนดปี/ฤดูกาล · เลือกฟอร์มอื่น"
  if (!order.businessTypeId) e.businessType = "ฟอร์มนี้ไม่ได้กำหนดประเภทธุรกิจ · เลือกฟอร์มอื่น"
  if (!order.branchName) e.branchName = "เลือกสาขา"
  if (!order.klangName) e.klangName = "เลือกคลัง"
  return e
}

/** Step 3 — รถพ่วง. Returns an array aligned with `trailers` (one object per
 *  trailer, empty object = ok). Back-trailer fields are only required when any
 *  back-trailer field has data (original rule — unchanged). */
export function validateTrailers(trailers) {
  const tErr = []
  trailers.forEach((t, i) => {
    const te = {}
    const hasBack =
      Number(t.backWeightKg || 0) > 0 ||
      String(t.licensePlateBack || "").trim() !== "" ||
      String(t.scaleNoBack || "").trim() !== "" ||
      String(t.unitPriceBack || "").trim() !== "" ||
      String(t.gramBack || "").trim() !== ""
    if (!String(t.scaleNoFront || "").trim()) te.scaleNoFront = "กรุณากรอกเลขที่ใบชั่งพ่วงหน้า"
    // ทะเบียนบังคับทุกพ่วงที่มีน้ำหนัก — backend ปฏิเสธค่าว่าง (handoff F5)
    if (Number(t.frontWeightKg || 0) > 0 && !String(t.licensePlateFront || "").trim()) te.licensePlateFront = "กรอกทะเบียนพ่วงหน้า"
    if (t.frontWeightKg === "" || Number(t.frontWeightKg) <= 0) te.frontWeightKg = "กรอกน้ำหนักสุทธิพ่วงหน้า (> 0)"
    if (t.unitPriceFront === "" || Number(t.unitPriceFront) <= 0) te.unitPriceFront = "กรอกราคาต่อกก. พ่วงหน้า (> 0)"
    if (hasBack) {
      if (Number(t.backWeightKg || 0) > 0 && !String(t.licensePlateBack || "").trim()) te.licensePlateBack = "กรอกทะเบียนพ่วงหลัง"
      if (t.backWeightKg === "" || Number(t.backWeightKg) <= 0) te.backWeightKg = "กรอกน้ำหนักสุทธิพ่วงหลัง (> 0)"
      if (t.unitPriceBack === "" || Number(t.unitPriceBack) <= 0) te.unitPriceBack = "กรอกราคาต่อกก. พ่วงหลัง (> 0)"
    }
    const net = Number(t.frontWeightKg || 0) + Number(t.backWeightKg || 0)
    if (net <= 0) te._net = "น้ำหนักรวมต้องมากกว่า 0"
    tErr[i] = te
  })
  return tErr
}

export const trailersHaveErrors = (tErr = []) => tErr.some((x) => Object.keys(x || {}).length > 0)

/** Merge of all three steps — identical result to the original `validateAll`. */
export function validateAll(ctx) {
  const e = { ...validateCustomer(ctx), ...validateSpec(ctx) }
  const tErr = validateTrailers(ctx.trailers)
  if (trailersHaveErrors(tErr)) e.trailers = tErr
  return e
}

/** Red "missing" hints (pulse ring) — original `computeMissingHints`. */
export function computeMissingHints({ buyerType, customer, order, paymentId }) {
  const m = {}
  if (buyerType === "person") {
    if (!customer.fullName.trim()) m.fullName = true
  } else {
    if (!customer.companyName.trim()) m.companyName = true
    if (!customer.taxId.trim()) m.taxId = true
  }
  if (!order.productId) m.product = true
  if (!order.riceId) m.riceType = true
  if (!order.subriceId) m.subrice = true
  if (!order.conditionId) m.condition = true
  if (!order.fieldTypeId) m.fieldType = true
  if (!order.riceYearId) m.riceYear = true
  if (!order.businessTypeId) m.businessType = true
  if (!order.branchName) m.branchName = true
  if (!order.klangName) m.klangName = true
  if (!paymentId) m.payment = true
  if (!order.issueDate) m.issueDate = true
  return m
}

// ---------------- Step bookkeeping (used by the phone stepper + toasts) ------
/** Which stepper step (1-based) each error key belongs to. */
export const STEP_OF_KEY = {
  fullName: 1, memberId: 1, companyName: 1, taxId: 1, payment: 1, issueDate: 1,
  product: 2, riceType: 2, subrice: 2, condition: 2, fieldType: 2, riceYear: 2, businessType: 2, program: 2,
  branchName: 2, klangName: 2,
  trailers: 3,
}

/** Short field names for toast "ยังไม่ได้กรอก:" lists (copy deck §9.3). */
export const SHORT_LABEL = {
  fullName: "ชื่อ-สกุล",
  memberId: "รหัสสมาชิก",
  companyName: "ชื่อบริษัท",
  taxId: "เลขผู้เสียภาษี",
  payment: "วิธีชำระเงิน",
  issueDate: "วันที่",
  product: "ประเภทสินค้า",
  riceType: "ชนิดข้าว",
  subrice: "ชั้นย่อย",
  condition: "สภาพ/เงื่อนไข",
  fieldType: "ประเภทนา",
  riceYear: "ปี/ฤดูกาล",
  program: "โปรแกรม",
  businessType: "ประเภทธุรกิจ",
  branchName: "สาขา",
  klangName: "คลัง",
  scaleNoFront: "เลขที่ใบชั่งพ่วงหน้า",
  frontWeightKg: "น้ำหนักพ่วงหน้า",
  unitPriceFront: "ราคาพ่วงหน้า",
  licensePlateFront: "ทะเบียนพ่วงหน้า",
  licensePlateBack: "ทะเบียนพ่วงหลัง",
  backWeightKg: "น้ำหนักพ่วงหลัง",
  unitPriceBack: "ราคาพ่วงหลัง",
  _net: "น้ำหนักรวม",
}

/** Order used to pick "the first" error (mirrors `scrollToFirstError`). */
export const ERROR_KEY_ORDER = {
  person: ["memberId", "fullName"],
  company: ["companyName", "taxId"],
  common: ["product","riceType","subrice","condition","fieldType","riceYear","businessType","branchName","klangName","payment","issueDate"],
}

/** Trailer field order used to report the first missing field inside a trailer. */
export const TRAILER_ERROR_KEY_ORDER = ["scaleNoFront", "unitPriceFront", "licensePlateFront", "frontWeightKg", "unitPriceBack", "licensePlateBack", "backWeightKg", "_net"]

/**
 * Build the toast description "ยังไม่ได้กรอก: a, b, c และอีก k ช่อง" (copy §3.3)
 * from an error object. Trailer errors are reported per trailer:
 * "คันที่ 2 ยังไม่ได้กรอก: เลขที่ใบชั่งพ่วงหน้า, …".
 * Returns { text, firstKey, firstTrailer } where firstTrailer is a 0-based index or null.
 */
export function describeErrors(eObj = {}, buyerType = "person") {
  const keys = (buyerType === "person" ? ERROR_KEY_ORDER.person : ERROR_KEY_ORDER.company).concat(ERROR_KEY_ORDER.common)
  const names = []
  let firstKey = null
  for (const k of keys) {
    if (k in eObj) {
      if (!firstKey) firstKey = k
      names.push(SHORT_LABEL[k] || k)
    }
  }
  let firstTrailer = null
  let trailerPrefix = ""
  if (Array.isArray(eObj.trailers)) {
    eObj.trailers.forEach((te, i) => {
      if (!te || Object.keys(te).length === 0) return
      const tn = TRAILER_ERROR_KEY_ORDER.filter((k) => k in te).map((k) => SHORT_LABEL[k] || k)
      if (firstTrailer == null) {
        firstTrailer = i
        // The very first problem is inside a trailer → lead with "คันที่ i ยังไม่ได้กรอก:"
        if (names.length === 0) { trailerPrefix = `คันที่ ${i + 1} `; names.push(...tn); return }
      }
      names.push(...tn.map((n) => `คันที่ ${i + 1}: ${n}`))
    })
  }
  if (names.length === 0) return { text: "", firstKey, firstTrailer }
  const head = names.slice(0, 3).join(", ")
  const rest = names.length - 3
  const text = `${trailerPrefix}ยังไม่ได้กรอก: ${head}${rest > 0 ? ` และอีก ${rest} ช่อง` : ""}`
  return { text, firstKey, firstTrailer }
}
