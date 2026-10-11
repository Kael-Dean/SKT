// src/pages/work/buy/buyShared.js
// ─────────────────────────────────────────────────────────────────────────────
// Pure helpers + hooks shared by Buy.jsx (controller) and the buy/* sections.
// No React components live here (react-refresh rule) — DateInput is in
// ./DateInput.jsx. Everything below is byte-for-byte the logic that used to sit
// at the top of Buy.jsx (plan §A2): keep semantics, do not "improve" them.
// ─────────────────────────────────────────────────────────────────────────────
import { useEffect, useState } from "react"

/** ----------- Utils ------------ */
export const onlyDigits = (s = "") => s.replace(/\D+/g, "")
export const toNumber = (v) => (v === "" || v === null || v === undefined ? 0 : Number(v))
export const thb = (n) =>
  new Intl.NumberFormat("th-TH", { style: "currency", currency: "THB", maximumFractionDigits: 2 }).format(
    isFinite(n) ? n : 0
  )
/** Plain number (weights) — th-TH grouping, ≤2 decimals, no forced ".00" (copy §0 V3) */
export const nf = (n) =>
  new Intl.NumberFormat("th-TH", { maximumFractionDigits: 2 }).format(isFinite(Number(n)) ? Number(n) : 0)

export const findLabelById = (opts = [], id) => {
  const s = String(id ?? "")
  if (!s) return ""
  const f = opts.find((o) => String(o.id) === s)
  return f ? String(f.label ?? "") : ""
}

// แปลงเป็นเลขจำนวนเต็ม ถ้าไม่ใช่ตัวเลขให้คืน null
export const toIntOrNull = (v) => {
  if (v === null || v === undefined) return null
  const s = String(v).trim()
  return /^-?\d+$/.test(s) ? parseInt(s, 10) : null
}

export function validateThaiCitizenId(id) {
  const cid = onlyDigits(id)
  if (cid.length !== 13) return false
  let sum = 0
  for (let i = 0; i < 12; i++) sum += Number(cid[i]) * (13 - i)
  const check = (11 - (sum % 11)) % 10
  return check === Number(cid[12])
}

// ตรวจความยาวเลขผู้เสียภาษี (ทั่วไป 13 หลัก)
export function validateThaiTaxId(tax) {
  const tid = onlyDigits(tax)
  return tid.length === 13
}

// debounce
export function useDebounce(value, delay = 400) {
  const [debounced, setDebounced] = useState(value)
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delay)
    return () => clearTimeout(t)
  }, [value, delay])
  return debounced
}

/** ▶︎ เงิน: ช่วยให้พิมพ์แล้วขึ้นคอมม่า และแปลงกลับเป็นตัวเลข */
export const moneyToNumber = (v) => {
  if (v === "" || v == null) return 0
  const n = Number(String(v).replace(/,/g, ""))
  return isFinite(n) ? n : 0
}
export const formatMoneyInput = (val) => {
  let s = String(val).replace(/[^0-9.]/g, "")
  if (s === "") return ""
  const parts = s.split(".")
  const intRaw = parts[0] || "0"
  const decRaw = parts[1] ?? null
  const intClean = intRaw.replace(/^0+(?=\d)/, "")
  const intWithCommas = intClean.replace(/\B(?=(\d{3})+(?!\d))/g, ",")
  if (decRaw != null) {
    const dec = decRaw.replace(/[^0-9]/g, "").slice(0, 2)
    return dec.length > 0 ? `${intWithCommas}.${dec}` : intWithCommas
  }
  return intWithCommas
}

/** กฎคำนวณหักน้ำหนัก */
export const MOISTURE_STD = 15
export function suggestDeductionWeight(grossKg, moisturePct, impurityPct) {
  const w = toNumber(grossKg)
  const m = Math.max(0, toNumber(moisturePct) - MOISTURE_STD)
  const imp = Math.max(0, toNumber(impurityPct))
  const dedByMoisture = (m / 100) * w
  const dedByImpurity = (imp / 100) * w
  return Math.max(0, dedByMoisture + dedByImpurity)
}

/** ---------- Enter-to-next helpers ---------- */
export const isEnabledInput = (el) => {
  if (!el) return false
  if (typeof el.disabled !== "undefined" && el.disabled) return false
  const style = window.getComputedStyle?.(el)
  if (style && (style.display === "none" || style.visibility === "hidden")) return false
  if (!el.offsetParent && el.type !== "hidden" && el.getAttribute("role") !== "combobox") return false
  return true
}

/** Focus helper used by the ComboBox onEnterNext chains (payment → paymentRefNo,
 *  branch → klang, klang → entryWeight). Retries twice because the target may
 *  still be disabled/unmounted on the same frame. Same timings as before. */
export const focusRefWithRetry = (ref) => {
  const tryFocus = () => {
    const el = ref?.current
    if (el && isEnabledInput(el)) {
      try { el.scrollIntoView({ block: "center" }) } catch { /* ignore */ }
      el.focus?.()
      try { el.select?.() } catch { /* ignore */ }
      return true
    }
    return false
  }
  if (tryFocus()) return
  setTimeout(tryFocus, 60)
  setTimeout(tryFocus, 180)
}

/** Field order of the desktop Enter-flow (baseline: handoff/mobile-baseline.md) */
export const PERSON_ORDER = [
  "citizenId",
  "memberId",
  "fullName","houseNo","moo","subdistrict","district","province",
  "postalCode","phone",
]
export const COMPANY_ORDER = [
  "companyName","taxId","companyPhone",
  "hqHouseNo","hqMoo","hqSubdistrict","hqDistrict","hqProvince","hqPostalCode",
  "brHouseNo","brMoo","brSubdistrict","brDistrict","brProvince","brPostalCode",
]
export const ORDER_ORDER = [
  "product","riceType","subrice","condition","fieldType","riceYear","businessType","program",
  "branchName","klangName",
  "entryWeightKg","exitWeightKg","moisturePct","impurityPct","deductWeightKg","gram",
  "unitPrice","amountTHB","paymentRefNo","comment",
  "payment","issueDate",
]

/** ลำดับฟิลด์ที่จะโฟกัสต่อไป */
export const useEnterNavigation = (refs, buyerType, order) => {
  const personOrder = PERSON_ORDER
  const companyOrder = COMPANY_ORDER
  const orderOrder = ORDER_ORDER

  let list = (buyerType === "person" ? personOrder : companyOrder).concat(orderOrder)

  list = list.filter((key) => {
    const el = refs?.[key]?.current
    if (!el) return false
    if (key === "subrice" && !order.riceId) return false
    if (key === "riceType" && !order.productId) return false
    if (key === "product" && order?.__templateLockedProduct) return true
    if (key === "deductWeightKg" && !order.manualDeduct) return false
    if (key === "klangName" && !order.branchId) return false
    return isEnabledInput(el)
  })

  const focusNext = (currentKey) => {
    const i = list.indexOf(currentKey)
    const nextKey = i >= 0 && i < list.length - 1 ? list[i + 1] : null
    if (!nextKey) return
    const el = refs[nextKey]?.current
    if (!el) return
    try { el.scrollIntoView({ block: "center" }) } catch { /* ignore */ }
    el.focus?.()
    try { if (el.select) el.select() } catch { /* ignore */ }
  }

  const onEnter = (currentKey) => (e) => {
    if (e.key === "Enter" && !e.isComposing) {
      const isTextArea = e.currentTarget?.tagName?.toLowerCase() === "textarea"
      if (isTextArea && e.shiftKey) return
      e.preventDefault()
      focusNext(currentKey)
    }
  }

  return { onEnter, focusNext }
}

/** ---------------- JWT + Branch lock ---------------- */
const getStoredToken = () =>
  localStorage.getItem("access_token") ||
  localStorage.getItem("token") ||
  sessionStorage.getItem("access_token") ||
  sessionStorage.getItem("token") ||
  ""

export const decodeJwtPayload = (token) => {
  try {
    const clean = String(token || "").replace(/^Bearer\s+/i, "")
    const b64 = clean.split(".")[1]
    if (!b64) return null
    const json = atob(b64.replace(/-/g, "+").replace(/_/g, "/"))
    return JSON.parse(json)
  } catch {
    return null
  }
}

/** ================= Hard‑lock Branch helpers ================= */
export const deriveLockedBranch = (opts = []) => {
  try {
    const payload = decodeJwtPayload(getStoredToken())
    const branchId = payload?.branch ?? null
    if (branchId == null) return null
    return (opts || []).find((o) => String(o.id) === String(branchId)) || null
  } catch (e) {
    console.error("deriveLockedBranch failed:", e)
    return null
  }
}

/** Mask the middle of a 13-digit id for the review step: 1-2345-xxxxx-67-8 */
export const maskId13 = (id) => {
  const d = onlyDigits(id)
  if (d.length !== 13) return d || "—"
  return `${d[0]}-${d.slice(1, 5)}-xxxxx-${d.slice(10, 12)}-${d[12]}`
}

/** Short field names for toasts (copy §9.3) + the phone step each key lives in */
export const FIELD_SHORT = {
  fullName: "ชื่อ-สกุล",
  memberId: "รหัสสมาชิก",
  companyName: "ชื่อบริษัท",
  taxId: "เลขผู้เสียภาษี",
  payment: "วิธีชำระเงิน",
  issueDate: "วันที่",
  paymentRefNo: "เลขที่ใบชั่ง",
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
  entryWeightKg: "น้ำหนักเข้า",
  exitWeightKg: "น้ำหนักออก",
  moisturePct: "ความชื้น",
  impurityPct: "สิ่งเจือปน",
  deductWeightKg: "น้ำหนักหัก",
  gram: "คุณภาพ",
  unitPrice: "ราคาต่อกก.",
  amountTHB: "เป็นเงิน",
}

/** Keys that belong to each phone step (0-based). Spec keys are flagged
 *  template-locked → the toast points at step 0 (ฟอร์มสำเร็จรูป). */
export const STEP_KEYS = {
  customer: ["memberId", "fullName", "companyName", "taxId", "payment", "issueDate", "paymentRefNo"],
  spec: ["product", "riceType", "subrice", "condition", "fieldType", "riceYear", "program", "businessType", "branchName", "klangName"],
  weigh: ["entryWeightKg", "exitWeightKg", "moisturePct", "impurityPct", "deductWeightKg", "gram", "unitPrice", "amountTHB"],
}
export const SPEC_LOCKED_KEYS = ["product", "riceType", "subrice", "condition", "fieldType", "riceYear", "program", "businessType"]

/** Order used by scrollToFirstError / scrollToFirstMissing (unchanged) */
export const ERROR_SCAN_ORDER = (buyerType) =>
  (buyerType === "person" ? ["memberId", "fullName"] : ["companyName", "taxId"]).concat([
    "payment","issueDate","paymentRefNo",
    "product","riceType","subrice","condition","fieldType","riceYear","program","businessType",
    "branchName","klangName",
    "entryWeightKg","exitWeightKg","moisturePct","impurityPct","deductWeightKg","gram","unitPrice","amountTHB",
  ])

/** "ยังไม่ได้กรอก: a, b, c และอีก k ช่อง" (copy §3.3 / §9.3) */
export const describeMissing = (keys = [], unit = "ช่อง") => {
  const names = keys.map((k) => FIELD_SHORT[k] ?? k)
  const head = names.slice(0, 3).join(", ")
  const rest = names.length - 3
  return rest > 0 ? `${head} และอีก ${rest} ${unit}` : head
}

/** Map an API failure to ResultSheet copy (copy §4.3 / §4.4) */
const THAI_MSG = [
  [/failed to fetch|networkerror|timeout/i, "เชื่อมต่อเซิร์ฟเวอร์ไม่ได้"],
  [/field required/i, "ข้อมูลบางช่องไม่ครบ"],
  [/value is not a valid|type_error/i, "รูปแบบข้อมูลบางช่องไม่ถูกต้อง"],
  [/greater than 0|ensure this value is greater/i, "น้ำหนักหรือราคาต้องมากกว่า 0"],
  [/not found.*member|member.*not found/i, "ไม่พบสมาชิกรหัสนี้"],
  [/not found.*(klang|warehouse)|(klang|warehouse).*not found/i, "ไม่พบคลังที่เลือก"],
  [/duplicate|already exists/i, "รายการนี้มีอยู่แล้ว"],
  [/unauthorized|forbidden|credentials/i, "ไม่มีสิทธิ์หรือหมดเวลาใช้งาน"],
]
export const translateApiMessage = (msg) => {
  const s = String(msg ?? "")
  const hit = THAI_MSG.find(([re]) => re.test(s))
  return hit ? hit[1] : null
}
const isThai = (s) => /[฀-๿]/.test(String(s ?? ""))

export const describeApiError = (err) => {
  const status = Number(err?.status) || null
  const detail = err?.data?.detail
  const detailMsgs = Array.isArray(detail)
    ? detail.map((d) => (d?.msg ? String(d.msg) : typeof d === "string" ? d : JSON.stringify(d)))
    : typeof detail === "string" ? [detail] : []
  const translated = detailMsgs.map(translateApiMessage).filter(Boolean)
  const lines = (translated.length ? translated : detailMsgs.filter(isThai)).slice(0, 4).map((m) => ({ label: "รายละเอียด", value: m }))
  const code = status ?? err?.code ?? err?.name ?? "—"
  const network = !status || /failed to fetch|networkerror|timeout/i.test(String(err?.message))

  if (network)
    return { kind: "network", title: "บันทึกไม่สำเร็จ", description: "เชื่อมต่อเซิร์ฟเวอร์ไม่ได้ ตรวจสัญญาณแล้วลองใหม่ ข้อมูลที่กรอกยังอยู่", lines: [], primary: "retry" }
  if (status === 422)
    return { kind: "422", title: "ข้อมูลไม่ผ่านการตรวจ", description: translated[0] ?? "เซิร์ฟเวอร์ปฏิเสธข้อมูลบางช่อง ตรวจค่าที่กรอกแล้วลองใหม่", lines, primary: "edit" }
  if (status === 401 || status === 403)
    return { kind: "auth", title: "ไม่มีสิทธิ์บันทึก", description: "สิทธิ์ของบัญชีนี้ไม่ครอบคลุมรายการนี้ หรือหมดเวลาใช้งาน เข้าสู่ระบบใหม่แล้วลองอีกครั้ง", lines: [], primary: "login" }
  if (status === 409)
    return { kind: "409", title: "รายการนี้มีอยู่แล้ว", description: "เลขที่ใบชั่งนี้ถูกบันทึกไปแล้ว ตรวจที่ดูออเดอร์ก่อนบันทึกซ้ำ", lines: [], primary: "orders" }
  if (status >= 500)
    return { kind: "5xx", title: "เซิร์ฟเวอร์ขัดข้อง", description: "ยังไม่ได้บันทึก ลองใหม่ในอีกสักครู่ ถ้ายังไม่ได้ให้แจ้งผู้ดูแลระบบ", lines: [], primary: "retry" }
  const msg = err?.message
  return {
    kind: "unknown",
    title: "บันทึกไม่สำเร็จ",
    description: isThai(msg) ? msg : "เกิดข้อผิดพลาดที่ไม่คาดคิด ลองใหม่อีกครั้ง",
    lines: [...lines, { label: "รหัส", value: String(code) }],
    primary: "retry",
  }
}
