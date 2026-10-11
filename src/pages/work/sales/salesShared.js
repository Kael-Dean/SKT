// src/pages/work/sales/salesShared.js
// ─────────────────────────────────────────────────────────────────────────────
// Non-component helpers for the Sales page (plan §A2). Pure functions and
// hooks only — no React components here (react-refresh lint). Everything was
// lifted verbatim from Sales.jsx so behaviour, formatting and the desktop
// Enter-to-next order stay byte-identical.
// ─────────────────────────────────────────────────────────────────────────────
import { useEffect, useState } from "react"

// ---------------- Utilities ----------------
export const onlyDigits = (s = "") => s.replace(/\D+/g, "")
export const toNumber = (v) => (v === "" || v === null || v === undefined ? 0 : Number(v))
export const round2 = (n) => Math.round((isFinite(n) ? n : 0) * 100) / 100
export const thb = (n) =>
  new Intl.NumberFormat("th-TH", { style: "currency", currency: "THB", maximumFractionDigits: 2 }).format(
    isFinite(n) ? n : 0
  )
/** Plain number formatter (th-TH, ≤2 decimals, no forced ".00") — used for weights in copy (`nf()`). */
export const nf = (n) =>
  new Intl.NumberFormat("th-TH", { maximumFractionDigits: 2 }).format(isFinite(Number(n)) ? Number(n) : 0)

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

export function useDebounce(value, delay = 400) {
  const [debounced, setDebounced] = useState(value)
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delay)
    return () => clearTimeout(t)
  }, [value, delay])
  return debounced
}

// ---------------- Enter-to-next ----------------
export const isEnabledInput = (el) => {
  if (!el) return false
  if (typeof el.disabled !== "undefined" && el.disabled) return false
  const style = window.getComputedStyle?.(el)
  if (style && (style.display === "none" || style.visibility === "hidden")) return false
  if (!el.offsetParent && el.type !== "hidden" && el.getAttribute("role") !== "combobox") return false
  return true
}

export const personOrder = ["citizenId", "memberId", "fullName", "houseNo", "moo", "subdistrict", "district", "province", "postalCode", "phone"]
export const companyOrder = ["companyName", "taxId", "companyPhone", "hqHouseNo", "hqMoo", "hqSubdistrict", "hqDistrict", "hqProvince", "hqPostalCode", "brHouseNo", "brMoo", "brSubdistrict", "brDistrict", "brProvince", "brPostalCode"]
export const orderOrder = [
  "product", "riceType", "subrice", "condition", "fieldType", "riceYear", "businessType", "program",
  "branchName", "klangName",
  "payment",
  "cashReceiptNo", "creditInvoiceNo", "deptAllowed", "deptPostpone", "deptPostponePeriod",
  "comment", "issueDate"
]

export const useEnterNavigation = (refs, buyerType, order) => {
  let list = (buyerType === "person" ? personOrder : companyOrder).concat(orderOrder)
  list = list.filter((key) => {
    const el = refs?.[key]?.current
    if (!el) return false
    if (key === "subrice" && !order.riceId) return false
    if (key === "riceType" && !order.productId) return false
    if (key === "klangName" && !order.branchId) return false
    if (key === "cashReceiptNo" && !order.__isCash) return false
    if (key === "creditInvoiceNo" && !order.__isCredit) return false
    return isEnabledInput(el)
  })
  const focusNext = (currentKey) => {
    const i = list.indexOf(currentKey)
    const nextKey = i >= 0 && i < list.length - 1 ? list[i + 1] : null
    if (!nextKey) return
    const el = refs[nextKey]?.current
    if (!el) return
    try { el.scrollIntoView({ block: "center" }) } catch {}
    el.focus?.()
    try { if (el.select) el.select() } catch {}
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

// ---------------- Trailers ----------------
/** Field order inside one trailer card — drives Enter-to-next (`focusNextTrailer`). */
export const trailerOrder = ["scaleNoFront","unitPriceFront","gramFront","licensePlateFront","frontWeightKg","amountFront","scaleNoBack","unitPriceBack","gramBack","licensePlateBack","backWeightKg","amountBack"]

export const trailerCountOptions = Array.from({ length: 10 }, (_, i) => ({ id: String(i + 1), label: `${i + 1} คัน` }))

export const newTrailer = () => ({
  licensePlateFront: "",
  licensePlateBack: "",
  scaleNoFront: "",
  scaleNoBack: "",
  frontWeightKg: "",
  backWeightKg: "",
  unitPriceFront: "",
  unitPriceBack: "",
  gramFront: "",
  gramBack: "",
})

/** Label of the sale_id reference-document field (dynamic on payment method). */
export const refDocLabel = (order, mobile = false) => {
  if (order.__isCredit) return mobile ? "เลขที่ใบกำกับสินค้า" : "เลขที่ใบกำกับสินค้า (ขายเชื่อ)"
  if (order.__isCash) return mobile ? "เลขที่ใบรับเงิน" : "ใบรับเงินขายสินค้า (ขายสด)"
  return mobile ? "เอกสารอ้างอิง" : "เอกสารอ้างอิง (เลือกวิธีชำระเงินเพื่อกรอก)"
}

export const buyerTypeOptions = [
  { id: "person", label: "บุคคลธรรมดา" },
  { id: "company", label: "บริษัท / นิติบุคคล" },
]

/* ==================== JWT Branch Lock (เหมือนหน้า Buy) ==================== */
const getToken = () =>
  localStorage.getItem("access_token") ||
  localStorage.getItem("token") ||
  sessionStorage.getItem("access_token") ||
  sessionStorage.getItem("token") ||
  ""

const decodeJwtPayload = (token) => {
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
    const payload = decodeJwtPayload(getToken())
    const branchId = payload?.branch ?? null
    if (branchId == null) return null
    return (opts || []).find((o) => String(o.id) === String(branchId)) || null
  } catch (e) {
    console.error("deriveLockedBranch failed:", e)
    return null
  }
}
