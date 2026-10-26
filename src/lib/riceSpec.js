// src/lib/riceSpec.js
// ─────────────────────────────────────────────────────────────────────────────
// Shared bits of the "รหัสข้าว" (ProductSpec) pages:
//   /spec/create  RiceSpecCreate.jsx   (POST /spec/)
//   /spec/manage  RiceSpecManage.jsx   (GET /order/form/search, PUT /spec/{id})
//
//   SPEC_API            endpoint map (master data = the same set as Sales)
//   SPEC_FIELDS         the 8 spec fields in form order + label + option list key
//   STATIC_MASTERS      the 6 lists that do not depend on another pick
//   speciesUrl(pid) / variantsUrl(sid)
//   toInt, mapIdLabel, sortYears, fetchOptions
//   withCurrent(options, value)   keep a prefilled id selectable even when the
//                                 master list no longer returns it
//   specPreviewName(form, opts)   "ข้าวเปลือก / หอมมะลิ / … / ปี 2568/2569 / …"
//   specErrorMessage(err)         { title, message } for POST/PUT failures
// No React here (react-refresh rule) — pages own their state.
// ─────────────────────────────────────────────────────────────────────────────
import { apiAuth } from "./api"

export const SPEC_API = {
  createSpec: "/spec/",
  updateSpec: (id) => `/spec/${encodeURIComponent(String(id))}`,
  // ACTIVE specs only — the list every buy/sell/stock dropdown reads
  activeSpecs: "/order/form/search",

  // Phase 1 products only (ข้าวเปลือก, ข้าวโพด) — backend rejects others with 400
  products: "/lists/product/search?phase1=true",
  species: "/order/species/search", // ?product_id=
  variants: "/order/variant/search", // ?species_id=
  years: "/order/year/search",
  conditions: "/order/condition/search",
  fieldTypes: "/order/field/search",
  programs: "/order/program/search",
  businessTypes: "/order/business/search",
}

/** The 8 spec fields, in form order. `opts` = key in the options state. */
export const SPEC_FIELDS = [
  { key: "product_id", label: "ประเภทสินค้า", opts: "products", required: true },
  { key: "species_id", label: "ชนิด/สายพันธุ์", opts: "species", required: true },
  { key: "variant_id", label: "พันธุ์/รูปแบบ", opts: "variants", required: true },
  { key: "product_year", label: "ปีผลผลิต", opts: "years" },
  { key: "condition_id", label: "สภาพ/เงื่อนไข", opts: "conditions" },
  { key: "field_type", label: "ประเภทนา", opts: "fieldTypes" },
  { key: "program", label: "โปรแกรม", opts: "programs" },
  { key: "business_type", label: "ประเภทธุรกิจ", opts: "businessTypes" },
]

export const SPEC_FIELD_KEYS = SPEC_FIELDS.map((f) => f.key)

export const emptySpecForm = () => Object.fromEntries(SPEC_FIELD_KEYS.map((k) => [k, ""]))

export const emptySpecOptions = () => ({
  products: [],
  species: [],
  variants: [],
  years: [],
  conditions: [],
  fieldTypes: [],
  programs: [],
  businessTypes: [],
})

export const toInt = (v) => {
  const n = Number(v)
  return Number.isFinite(n) ? Math.trunc(n) : NaN
}

// labelKey can be a list of fallbacks (e.g. /lists/product/search sends product_type or product_name)
export const mapIdLabel = (arr, labelKey) => {
  const safe = Array.isArray(arr) ? arr : []
  const keys = Array.isArray(labelKey) ? labelKey : [labelKey]
  return safe
    .map((x) => ({
      id: String(x?.id ?? ""),
      label: String(keys.map((k) => x?.[k]).find((v) => v != null && v !== "") ?? "").trim(),
    }))
    .filter((x) => x.id && x.label)
}

// Year labels look like "2568/2569". Newest first so the current crop year is the
// first option (ComboBox highlights index 0 on open), and drop typo'd far-future
// rows (e.g. 2585/2586) that are easy to pick by accident.
export const sortYears = (list) => {
  const startOf = (label) => Number(String(label).match(/\d{4}/)?.[0] ?? NaN)
  const maxStart = new Date().getFullYear() + 543 + 1
  return list
    .filter((y) => !(startOf(y.label) > maxStart))
    .sort((a, b) => (startOf(b.label) || 0) - (startOf(a.label) || 0))
}

/** The lists that do not depend on another pick (loaded once per page). */
export const STATIC_MASTERS = [
  { key: "products", url: SPEC_API.products, labelKey: ["product_type", "product_name", "name"] },
  { key: "years", url: SPEC_API.years, labelKey: "year", transform: sortYears },
  { key: "conditions", url: SPEC_API.conditions, labelKey: "condition" },
  { key: "fieldTypes", url: SPEC_API.fieldTypes, labelKey: "field" },
  { key: "programs", url: SPEC_API.programs, labelKey: "program" },
  { key: "businessTypes", url: SPEC_API.businessTypes, labelKey: "business" },
]

export const speciesUrl = (productId) => `${SPEC_API.species}?product_id=${encodeURIComponent(String(productId))}`
export const variantsUrl = (speciesId) => `${SPEC_API.variants}?species_id=${encodeURIComponent(String(speciesId))}`
export const SPECIES_LABEL_KEY = "species"
export const VARIANT_LABEL_KEY = "variant"

/** GET a master list → [{ id, label }]. Throws on failure (callers decide the message). */
export async function fetchOptions(url, labelKey, transform) {
  const data = await apiAuth(url)
  const arr = Array.isArray(data) ? data : Array.isArray(data?.items) ? data.items : []
  const mapped = mapIdLabel(arr, labelKey)
  return transform ? transform(mapped) : mapped
}

export const LOAD_LIST_ERROR = "โหลดรายการไม่สำเร็จ กด “โหลดรายการใหม่” เพื่อลองอีกครั้ง"

/** Keep a prefilled id pickable when the master list dropped it (filtered year, retired row…). */
export function withCurrent(options, value) {
  if (value === "" || value == null) return options
  if (options.some((o) => String(o.id) === String(value))) return options
  return [{ id: String(value), label: `รหัส ${value}` }, ...options]
}

const findLabel = (arr, v) => (arr || []).find((x) => String(x.id) === String(v))?.label

/** Review string of the picks (not sent — backend builds prod_name itself, AMC format). */
export function specPreviewName(form, opts) {
  const parts = [
    findLabel(opts.products, form.product_id),
    findLabel(opts.species, form.species_id),
    findLabel(opts.variants, form.variant_id),
  ]
  const yearLabel = findLabel(opts.years, form.product_year)
  if (yearLabel) parts.push(`ปี ${yearLabel}`)
  parts.push(
    findLabel(opts.conditions, form.condition_id),
    findLabel(opts.fieldTypes, form.field_type),
    findLabel(opts.programs, form.program),
    findLabel(opts.businessTypes, form.business_type),
  )
  return parts.filter(Boolean).join(" / ")
}

const hasThai = (s) => /[฀-๿]/.test(s || "")

/**
 * POST /spec/ and PUT /spec/{id} failures → { title, message, status }.
 *   409 duplicate combo   "Another spec with this combination already exists (id=X)"
 *   400 invalid chain     backend `detail` explains which link is wrong → shown as-is
 *   404 spec not found
 */
export function specErrorMessage(err) {
  const status = err?.status
  const raw = String(err?.message || "")
  if (status === 409) {
    const dupId = raw.match(/id\s*=\s*(\d+)/i)?.[1]
    return {
      status,
      title: "รายการนี้มีอยู่แล้ว",
      message: hasThai(raw)
        ? raw
        : dupId
          ? `ชุดข้อมูลนี้ตรงกับรหัสข้าว ${dupId} ที่มีอยู่แล้ว ใช้รหัสเดิมหรือเลือกค่าอื่น`
          : "มีรหัสข้าวสเปคนี้อยู่แล้ว ใช้รหัสเดิมได้เลย",
    }
  }
  if (status === 400) {
    return { status, title: "ข้อมูลที่เลือกไม่ถูกต้อง", message: raw || "ตรวจสอบประเภทสินค้า สายพันธุ์ และพันธุ์ให้สัมพันธ์กัน" }
  }
  if (status === 404) {
    return { status, title: "ไม่พบรหัสนี้", message: "ไม่พบรหัสข้าวนี้ในระบบ ตรวจสอบรหัสอีกครั้ง" }
  }
  if (status === 0) {
    return { status, title: "เชื่อมต่อไม่ได้", message: raw || "ตรวจสอบอินเทอร์เน็ตแล้วลองใหม่อีกครั้ง" }
  }
  return {
    status,
    title: "บันทึกไม่สำเร็จ",
    message: hasThai(raw) ? raw : "ข้อมูลที่เลือกยังอยู่ ลองบันทึกใหม่อีกครั้ง",
  }
}
