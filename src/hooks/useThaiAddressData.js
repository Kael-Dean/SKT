// src/hooks/useThaiAddressData.js
// ─────────────────────────────────────────────────────────────────────────────
// โหลดฐานข้อมูลที่อยู่ไทย (province/district/sub_district) แบบ fetch-on-demand
// จาก /public/data/thai/*.json แทนการ static import (ไฟล์ sub_district 2.2MB จะได้
// ไม่ถูกฝังเข้า JS bundle — โหลดเฉพาะตอนหน้าที่ต้องใช้ mount).
//
// คืน key ที่ตรวจจับได้ (รองรับหลายรูปแบบ dataset) + สถานะ ready/error.
// ─────────────────────────────────────────────────────────────────────────────
import { useEffect, useState } from "react"

// base path ตาม Vite (base:'./' → BASE_URL === './') — relative จึงปลอดภัยกับ HashRouter
// และรองรับ deploy ใต้ sub-path
const stripTrailingSlash = (s = "") => s.replace(/\/+$/, "")
const assetUrl = (p) => `${stripTrailingSlash(import.meta.env.BASE_URL)}${p}`

// ค้น key แบบยืดหยุ่น รองรับหลายรูปแบบ dataset
const pickKey = (obj = {}, candidates = []) => {
  const lower = Object.keys(obj).reduce((acc, k) => (acc[k.toLowerCase()] = k, acc), {})
  for (const cand of candidates) {
    const k = lower[cand.toLowerCase()]
    if (k) return k
  }
  return null
}

const detectProvinceKeys = (arr) => {
  const s = arr?.[0] || {}
  return {
    id: pickKey(s, ["id","province_id","changwat_id","code","PROVINCE_ID"]),
    name: pickKey(s, ["name_th","name","province_name","PROVINCE_NAME","thai_name","th","nameTH"]),
  }
}
const detectDistrictKeys = (arr) => {
  const s = arr?.[0] || {}
  return {
    id: pickKey(s, ["id","district_id","amphoe_id","AMPHOE_ID","DISTRICT_ID","code"]),
    name: pickKey(s, ["name_th","name","district_name","AMPHOE_NAME","thai_name","nameTH"]),
    provId: pickKey(s, ["province_id","changwat_id","PROVINCE_ID","CHANGWAT_ID"]),
  }
}
const detectSubdistrictKeys = (arr) => {
  const s = arr?.[0] || {}
  return {
    id: pickKey(s, ["id","sub_district_id","tambon_id","SUB_DISTRICT_ID","TAMBON_ID","code"]),
    name: pickKey(s, ["name_th","name","sub_district_name","TAMBON_NAME","thai_name","nameTH"]),
    distId: pickKey(s, ["district_id","amphoe_id","AMPHOE_ID","DISTRICT_ID","code_district"]),
    zip: pickKey(s, ["zip","zipcode","zip_code","POSTCODE"]),
  }
}

const fetchJson = async (p) => {
  const res = await fetch(assetUrl(p))
  if (!res.ok) throw new Error(`โหลด ${p} ไม่สำเร็จ (HTTP ${res.status})`)
  return res.json()
}

/**
 * โหลด province/district/sub_district เมื่อ hook ถูก mount.
 * @returns {{ provinces:any[], districts:any[], subdistricts:any[],
 *             keys:{prov:object,dist:object,subd:object},
 *             ready:boolean, error:Error|null, reload:()=>void }}
 */
export function useThaiAddressData() {
  const [provinces, setProvinces] = useState([])
  const [districts, setDistricts] = useState([])
  const [subdistricts, setSubdistricts] = useState([])
  const [keys, setKeys] = useState({ prov: {}, dist: {}, subd: {} })
  const [ready, setReady] = useState(false)
  const [error, setError] = useState(null)
  const [tick, setTick] = useState(0)

  useEffect(() => {
    let cancelled = false
    setReady(false)
    setError(null)
    ;(async () => {
      try {
        const [p, d, s] = await Promise.all([
          fetchJson("/data/thai/province.json"),
          fetchJson("/data/thai/district.json"),
          fetchJson("/data/thai/sub_district.json"),
        ])
        if (cancelled) return
        setProvinces(p)
        setDistricts(d)
        setSubdistricts(s)
        setKeys({
          prov: detectProvinceKeys(p),
          dist: detectDistrictKeys(d),
          subd: detectSubdistrictKeys(s),
        })
        setReady(true)
      } catch (e) {
        if (!cancelled) setError(e)
      }
    })()
    return () => { cancelled = true }
  }, [tick])

  const reload = () => setTick((t) => t + 1)

  return { provinces, districts, subdistricts, keys, ready, error, reload }
}
