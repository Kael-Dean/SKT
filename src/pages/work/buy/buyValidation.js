// src/pages/work/buy/buyValidation.js
// ─────────────────────────────────────────────────────────────────────────────
// validateAll of Buy.jsx split per phone step (plan §A2). Every message is the
// ORIGINAL string (copy §9.1 "เดิม" — lead decision §11.2: no rewording this
// round). `validateAllErrors` merges the three in the original key order, so
// desktop behaviour is unchanged.
//
//   const ctx = { buyerType, customer, memberMeta, order, grossFromScale, resolvePaymentId }
//   validateCustomer(ctx) → { fullName?, memberId?, companyName?, taxId?, payment?, issueDate?, paymentRefNo? }
//   validateSpec(ctx)     → { product?, riceType?, …, branchName?, klangName? }
//   validateWeigh(ctx)    → { entryWeightKg?, exitWeightKg?, deductWeightKg?, moisturePct?, impurityPct?, gram?, unitPrice?, amountTHB? }
// ─────────────────────────────────────────────────────────────────────────────
import { moneyToNumber, validateThaiTaxId } from "./buyShared"

export function validateCustomer({ buyerType, customer, memberMeta, order, resolvePaymentId }) {
  const e = {}

  if (buyerType === "person") {
    if (!customer.fullName) e.fullName = "กรุณากรอกชื่อ–สกุล"
    const _midStr = String(memberMeta.memberId ?? customer.memberId ?? "").trim()
    if (!_midStr && !memberMeta.assoId) {
      e.memberId = "กรุณาระบุรหัสสมาชิก (member_id) หรือเลือกจากรายชื่อที่มี asso_id"
    }
  } else {
    if (!customer.companyName.trim()) e.companyName = "กรุณากรอกชื่อบริษัท"
    if (!customer.taxId.trim() || !validateThaiTaxId(customer.taxId)) e.taxId = "กรุณากรอกเลขผู้เสียภาษี (13 หลัก)"
  }

  const pid = resolvePaymentId()
  if (!pid) e.payment = "เลือกวิธีชำระเงิน"
  if (!order.issueDate) e.issueDate = "กรุณาเลือกวันที่"
  if (!order.paymentRefNo?.trim()) e.paymentRefNo = "กรอกเลขที่ใบชั่ง/ใบเบิกเงิน"

  return e
}

export function validateSpec({ order }) {
  const e = {}
  if (!order.productId) e.product = "เลือกฟอร์มสำเร็จรูปให้มีสเปกสินค้า"
  if (!order.riceId) e.riceType = "เลือกฟอร์มสำเร็จรูปให้มีชนิดข้าว (species)"
  if (!order.subriceId) e.subrice = "เลือกฟอร์มสำเร็จรูปให้มีชั้นย่อย (variant)"
  if (!order.conditionId) e.condition = "เลือกฟอร์มสำเร็จรูปให้มีสภาพ/เงื่อนไข"
  if (!order.fieldTypeId) e.fieldType = "เลือกฟอร์มสำเร็จรูปให้มีประเภทนา"
  if (!order.riceYearId) e.riceYear = "เลือกฟอร์มสำเร็จรูปให้มีปี/ฤดูกาล"
  if (!order.programId) e.program = "เลือกฟอร์มสำเร็จรูปให้มีโปรแกรม"
  if (!order.businessTypeId) e.businessType = "เลือกฟอร์มสำเร็จรูปให้มีประเภทธุรกิจ"
  if (!order.branchName) e.branchName = "เลือกสาขา"
  if (!order.klangName) e.klangName = "เลือกคลัง"
  return e
}

export function validateWeigh({ order, grossFromScale }) {
  const e = {}
  if (order.entryWeightKg === "" || Number(order.entryWeightKg) < 0) e.entryWeightKg = "กรอกน้ำหนักก่อนชั่ง"
  if (order.exitWeightKg === "" || Number(order.exitWeightKg) <= 0) e.exitWeightKg = "กรอกน้ำหนักหลังชั่ง"
  if (grossFromScale <= 0) e.exitWeightKg = "ค่าน้ำหนักจากตาชั่งต้องมากกว่า 0"
  if (order.manualDeduct && (order.deductWeightKg === "" || Number(order.deductWeightKg) < 0))
    e.deductWeightKg = "กรอกน้ำหนักหักให้ถูกต้อง"

  if (order.moisturePct === "" || isNaN(Number(order.moisturePct))) e.moisturePct = "กรอกความชื้น (%)"
  if (order.impurityPct === "" || isNaN(Number(order.impurityPct))) e.impurityPct = "กรอกสิ่งเจือปน (%)"
  if (order.gram === "" || isNaN(Number(order.gram))) e.gram = "กรอกคุณภาพข้าว (gram)"
  if (order.unitPrice === "" || isNaN(Number(order.unitPrice))) e.unitPrice = "กรอกราคาต่อกก. (บาท)"

  const amt = moneyToNumber(order.amountTHB)
  if (!amt || amt <= 0) e.amountTHB = "กรอกจำนวนเงินให้ถูกต้อง"
  return e
}

/** Same result object as the old validateAll (without the setErrors side effect) */
export function validateAllErrors(ctx) {
  return { ...validateCustomer(ctx), ...validateSpec(ctx), ...validateWeigh(ctx) }
}

/** Validators by phone step key, for BuyMobileStepper */
export const STEP_VALIDATORS = {
  customer: validateCustomer,
  spec: validateSpec,
  weigh: validateWeigh,
}
