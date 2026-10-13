// src/lib/useProductForms.js
// ─────────────────────────────────────────────────────────────────────────────
// ฟอร์มสินค้า (ProductSpec ที่ ACTIVE + มีชื่อ) จาก GET /order/form/search
// + ตารางชื่อสเปคไว้แปลง id → ชื่อสำหรับชิป (handoff F30).
//
//   const { forms, status, findForm, chipsFor } = useProductForms()
//   forms   = [{ id: "123", label: prod_name, spec: {product_id, …, business_type} }]
//   status  = "loading" | "ready" | "error"
//   chipsFor(spec) = [{ key, name, value }] ตามลำดับชิปของซื้อข้าว (ค่าว่างถูกตัดทิ้ง)
//
// โหลดครั้งเดียวต่อแท็บ (cache ระดับโมดูล) — ทุกหน้าใช้ข้อมูลชุดเดียวกัน
// ─────────────────────────────────────────────────────────────────────────────
import { useEffect, useState } from "react"
import { apiAuth } from "./api"

export const SPEC_KEYS = [
  "product_id", "species_id", "variant_id", "product_year",
  "condition_id", "field_type", "program", "business_type",
]

/** ลำดับชิป = ซื้อข้าว: ประเภทสินค้า, ชนิด, พันธุ์, สภาพ/เงื่อนไข, ประเภทนา, ปี/ฤดูกาล, ประเภทธุรกิจ, โปรแกรม */
const CHIP_ORDER = [
  ["product_id", "product", "ประเภทสินค้า"],
  ["species_id", "species", "ชนิดข้าว"],
  ["variant_id", "variant", "พันธุ์/ชั้นย่อย"],
  ["condition_id", "condition", "สภาพ/เงื่อนไข"],
  ["field_type", "field", "ประเภทนา"],
  ["product_year", "year", "ปี/ฤดูกาล"],
  ["business_type", "business", "ประเภทธุรกิจ"],
  ["program", "program", "โปรแกรม"],
]

const toId = (v) => (v === null || v === undefined || v === "" ? null : Number(v))

/** spec ที่ส่ง backend — id ทั้ง 8 ค่าจากแถวฟอร์ม (null ถ้าฟอร์มไม่มีค่านั้น) */
export function specFromForm(f) {
  const src = f?.spec ?? f ?? {}
  const out = {}
  SPEC_KEYS.forEach((k) => { out[k] = toId(src[k]) })
  return out
}

const pickLabel = (x, keys) => {
  for (const k of keys) {
    const v = x?.[k]
    if (v !== undefined && v !== null && String(v).trim()) return String(v).trim()
  }
  return ""
}
const toMap = (arr, keys) => {
  const m = {}
  ;(Array.isArray(arr) ? arr : []).forEach((x) => {
    const id = x?.id ?? x?.value
    const label = pickLabel(x, keys)
    if (id != null && label) m[String(id)] = label
  })
  return m
}
const safe = (p) => p.catch(() => [])

let cache = null // Promise<{ forms, names }>

async function loadAll() {
  const [rows, products, conditions, fields, years, programs, businesses] = await Promise.all([
    apiAuth("/order/form/search"),
    safe(apiAuth("/order/product/search")),
    safe(apiAuth("/order/condition/search")),
    safe(apiAuth("/order/field/search")),
    safe(apiAuth("/order/year/search")),
    safe(apiAuth("/order/program/search")),
    safe(apiAuth("/order/business/search")),
  ])

  const forms = (Array.isArray(rows) ? rows : [])
    .filter((x) => !x?.status || String(x.status).toUpperCase() === "ACTIVE")
    .map((x) => ({
      id: String(x.id ?? x.value ?? ""),
      label: String(x.prod_name ?? x.name ?? x.label ?? "").trim(),
      spec: specFromForm(x),
    }))
    .filter((o) => o.id && o.label)

  // ชนิด/พันธุ์ ต้องโหลดตาม product / species ที่ฟอร์มใช้จริง
  const productIds = [...new Set(forms.map((f) => f.spec.product_id).filter((v) => v != null))]
  const speciesIds = [...new Set(forms.map((f) => f.spec.species_id).filter((v) => v != null))]
  const [speciesLists, variantLists] = await Promise.all([
    Promise.all(productIds.map((pid) => safe(apiAuth(`/order/species/search?product_id=${encodeURIComponent(pid)}`)))),
    Promise.all(speciesIds.map((sid) => safe(apiAuth(`/order/variant/search?species_id=${encodeURIComponent(sid)}`)))),
  ])

  const names = {
    product: toMap(products, ["product_type", "name", "label"]),
    species: toMap(speciesLists.flat(), ["species", "name", "label"]),
    variant: toMap(variantLists.flat(), ["variant", "name", "label"]),
    condition: toMap(conditions, ["condition", "name", "label"]),
    field: toMap(fields, ["field", "field_type", "name", "label"]),
    year: toMap(years, ["year", "name", "label"]),
    program: toMap(programs, ["program", "name", "label"]),
    business: toMap(businesses, ["business", "name", "label"]),
  }
  return { forms, names }
}

export function loadProductForms({ refresh = false } = {}) {
  if (!cache || refresh) {
    cache = loadAll().catch((e) => {
      cache = null // ให้ลองใหม่ได้ครั้งหน้า
      throw e
    })
  }
  return cache
}

export function chipsFromNames(names, spec) {
  if (!spec) return []
  return CHIP_ORDER.map(([key, table, name]) => {
    const id = spec[key]
    if (id === null || id === undefined || id === "") return null
    const value = names?.[table]?.[String(id)]
    return value ? { key, name, value } : null
  }).filter(Boolean)
}

export default function useProductForms() {
  const [state, setState] = useState({ forms: [], names: null, status: "loading" })

  useEffect(() => {
    let alive = true
    loadProductForms()
      .then(({ forms, names }) => alive && setState({ forms, names, status: "ready" }))
      .catch((e) => {
        console.error("load product forms error:", e)
        if (alive) setState({ forms: [], names: null, status: "error" })
      })
    return () => { alive = false }
  }, [])

  const findForm = (id) => (id == null || id === "" ? null : state.forms.find((f) => f.id === String(id)) || null)
  /** หาแถวฟอร์มจากชุด id สเปค (ใช้ตอนแก้ไขออเดอร์ที่มีอยู่แล้ว) */
  const findFormBySpec = (spec) => {
    if (!spec) return null
    const want = specFromForm(spec)
    return state.forms.find((f) => SPEC_KEYS.every((k) => (f.spec[k] ?? null) === (want[k] ?? null))) || null
  }
  const chipsFor = (spec) => chipsFromNames(state.names, spec)

  return { ...state, findForm, findFormBySpec, chipsFor }
}
