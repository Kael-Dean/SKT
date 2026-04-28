import { useCallback, useEffect, useState } from "react"
import { apiAuth } from "./api"

const MASTER_EVENT = "master-data:changed"

/** กระจาย event ให้ทุกตารางที่ฟังอยู่ refetch */
export function emitMasterDataChanged(detail = {}) {
  if (typeof window === "undefined") return
  try {
    window.dispatchEvent(new CustomEvent(MASTER_EVENT, { detail }))
  } catch {
    // ignore
  }
}

/** subscribe ให้ callback ถูกเรียกเมื่อมีการแก้ master data */
export function onMasterDataChanged(handler) {
  if (typeof window === "undefined") return () => {}
  const wrapped = (e) => handler(e?.detail || {})
  window.addEventListener(MASTER_EVENT, wrapped)
  return () => window.removeEventListener(MASTER_EVENT, wrapped)
}

/**
 * รวม master list (/products) + ราคาล่าสุด (/lists/products-by-group-latest)
 *  - master = แหล่งความจริงของ "สินค้ามีอะไรบ้าง" (รวมที่เพิ่งเพิ่มผ่าน BusinessEdit)
 *  - latest = ราคาล่าสุดต่อสินค้าในแผนปีนั้น (ถ้ายังไม่มีจะเป็น null)
 *
 * คืน array ของสินค้าในกลุ่มธุรกิจ groupId (active เท่านั้น) แต่ละตัวมี:
 *   { product_id, product_type, unit, business_group,
 *     sell_price, buy_price, comment, unitprice_id }
 */
export async function fetchProductsByGroup(groupId, planId) {
  const gid = Number(groupId || 0)
  const pid = Number(planId || 0)
  if (!gid) return []

  const masterReq = apiAuth("/products").catch(() => [])
  const latestReq = pid > 0
    ? apiAuth(`/lists/products-by-group-latest?plan_id=${pid}`).catch(() => ({}))
    : Promise.resolve({})

  const [master, latest] = await Promise.all([masterReq, latestReq])

  // index ราคาล่าสุดด้วย product_id
  const priceMap = {}
  const group = latest?.[String(gid)] || latest?.[gid]
  const items = Array.isArray(group?.items) ? group.items : []
  for (const it of items) {
    const k = Number(it.product_id || it.product || 0)
    if (!k) continue
    priceMap[String(k)] = it
  }

  const masterList = Array.isArray(master) ? master : []
  return masterList
    .filter((p) => Number(p.business_group) === gid && p.is_active !== false)
    .map((p) => {
      const id = Number(p.id || 0)
      const ext = priceMap[String(id)] || {}
      return {
        product_id: id,
        product_type: String(p.product_type || ext.product_type || "").trim(),
        unit: String(p.unit || ext.unit || "").trim(),
        business_group: gid,
        sell_price: ext.sell_price ?? null,
        buy_price: ext.buy_price ?? null,
        comment: ext.comment ?? "",
        unitprice_id: ext.unitprice_id ?? null,
      }
    })
    .filter((x) => x.product_id > 0)
}

/**
 * Hook: ใช้กับตาราง sell-detail ทั้งหลาย
 *  - โหลดอัตโนมัติเมื่อ groupId/planId เปลี่ยน
 *  - รับ event "master-data:changed" แล้ว refetch
 *  - คืน { products, loading, refresh }
 */
export function useProductsByGroup(groupId, planId) {
  const [products, setProducts] = useState([])
  const [loading, setLoading] = useState(false)

  const refresh = useCallback(async () => {
    setLoading(true)
    try {
      const list = await fetchProductsByGroup(groupId, planId)
      setProducts(list)
    } finally {
      setLoading(false)
    }
  }, [groupId, planId])

  useEffect(() => {
    let alive = true
    ;(async () => {
      setLoading(true)
      try {
        const list = await fetchProductsByGroup(groupId, planId)
        if (alive) setProducts(list)
      } finally {
        if (alive) setLoading(false)
      }
    })()
    return () => { alive = false }
  }, [groupId, planId])

  useEffect(() => {
    return onMasterDataChanged(() => { refresh() })
  }, [refresh])

  return { products, loading, refresh }
}
