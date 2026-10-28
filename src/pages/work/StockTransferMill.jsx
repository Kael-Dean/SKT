// src/pages/StockTransferMill.jsx
import { useEffect, useMemo, useRef, useState, useCallback } from "react"
import { Trash2 } from "lucide-react"
import { get, post } from "../../lib/api"
import { describeApiError } from "../../lib/apiErrors"
import { cx, baseField, labelCls, helpTextCls, errorTextCls, primaryBtnCls, dangerBtnCls } from "../../lib/styles"
import { SkeletonTableRows, EmptyState, ErrorState, Badge, DataList, StickyActionBar, ConfirmDialog, toast } from "../../components/ui"
import ComboBox from "../../components/ComboBox"
import ProductFormPicker from "../../components/ProductFormPicker"
import useProductForms, { specFromForm } from "../../lib/useProductForms"
import { useIsPhone } from "../../hooks/useMediaQuery"
import useBranchLock from "../../hooks/useBranchLock"
import BranchLockNote from "../../components/BranchLockNote"
import DateInput from "../../components/ThaiDateField"
import PageTitle from "../../components/PageTitle"

/** ---------- Utils ---------- */
const onlyDigits = (s = "") => String(s ?? "").replace(/\D+/g, "")
const toInt = (v) => {
  const n = Number(v)
  if (!Number.isFinite(n)) return 0
  return Math.trunc(n)
}
const nf = (n) =>
  new Intl.NumberFormat("th-TH", { maximumFractionDigits: 2 }).format(isFinite(n) ? Number(n) : 0)

/** ชื่อฟิลด์สั้นสำหรับ toast "กรอกไม่ครบ" (mobile-copy §3.3) */
const FIELD_LABELS = {
  lot_number: "เลขล็อต",
  total_weight: "น้ำหนักรวมล็อต",
  branch_id: "สาขา",
  klang_id: "คลัง",
  form_id: "ฟอร์มสินค้า",
  product_id: "ประเภทสินค้า",
  rice_id: "ชนิดข้าว",
  subrice_id: "ชั้นย่อย",
  picks: "รายการในล็อต",
}
const missingDescription = (keys) => {
  const names = keys.map((k) => FIELD_LABELS[k]).filter(Boolean)
  const rest = names.length - 3
  return `ยังไม่ได้กรอก: ${names.slice(0, 3).join(", ")}${rest > 0 ? ` และอีก ${rest} ช่อง` : ""}`
}

/** แปลง error จากหลังบ้านเป็นข้อความไทย (mobile-copy §4.3–4.4) */
const SAVE_ERR_TH = [
  [/failed to fetch|networkerror|timeout/i, "เชื่อมต่อเซิร์ฟเวอร์ไม่ได้"],
  [/field required/i, "ข้อมูลบางช่องไม่ครบ"],
  [/value is not a valid|type_error/i, "รูปแบบข้อมูลบางช่องไม่ถูกต้อง"],
  [/greater than 0|ensure this value is greater/i, "น้ำหนักหรือราคาต้องมากกว่า 0"],
  [/not found[\s\S]*(klang|warehouse)|(klang|warehouse)[\s\S]*not found/i, "ไม่พบคลังที่เลือก"],
  [/duplicate|already exists/i, "รายการนี้มีอยู่แล้ว"],
]
function describeSaveError(err) {
  const status = err?.status
  // 403 พร้อม detail = กฎธุรกิจ, 409 = เช่น สต็อกไม่พอ → แสดง detail จาก backend (handoff F6/F7)
  if (status === 403 || status === 409) return describeApiError(err)
  const raw = String(err?.message || "")
  const isThai = /[฀-๿]/.test(raw)
  const hit = SAVE_ERR_TH.find(([re]) => re.test(raw))?.[1]
  if (hit) return { title: status === 422 ? "ข้อมูลไม่ผ่านการตรวจ" : "บันทึกไม่สำเร็จ", description: hit }
  if (!status) return { title: "บันทึกไม่สำเร็จ", description: isThai ? raw : "เชื่อมต่อเซิร์ฟเวอร์ไม่ได้ ตรวจสัญญาณแล้วลองใหม่ ข้อมูลที่กรอกยังอยู่" }
  if (status === 401) return { title: "หมดเวลาใช้งาน", description: "เข้าสู่ระบบใหม่แล้วลองอีกครั้ง" }
  if (status === 409) return { title: "รายการนี้มีอยู่แล้ว", description: isThai ? raw : "เลขล็อตนี้ถูกบันทึกไปแล้ว ตรวจก่อนบันทึกซ้ำ" }
  if (status === 422) return { title: "ข้อมูลไม่ผ่านการตรวจ", description: isThai ? raw : "เซิร์ฟเวอร์ปฏิเสธข้อมูลบางช่อง ตรวจค่าที่กรอกแล้วลองใหม่" }
  if (status >= 500) return { title: "เซิร์ฟเวอร์ขัดข้อง", description: "ยังไม่ได้บันทึก ลองใหม่ในอีกสักครู่ ถ้ายังไม่ได้ให้แจ้งผู้ดูแลระบบ" }
  return { title: "บันทึกไม่สำเร็จ", description: isThai ? raw : "เกิดข้อผิดพลาดที่ไม่คาดคิด ลองใหม่อีกครั้ง" }
}

/** แสดงข้อความจาก backend เฉพาะเมื่อเป็นภาษาไทยแล้ว ไม่งั้นใช้ข้อความกลาง */
const friendly = (e, fallback) => (/[฀-๿]/.test(e?.message || "") ? e.message : fallback)

/** ---------- Styles ---------- */
const sectionCardCls =
  "mb-4 md:mb-6 rounded-2xl border border-slate-200 bg-white p-4 md:p-5 shadow-sm dark:border-slate-700 dark:bg-slate-800"
const sectionTitleTextCls = "mb-3 text-lg md:text-xl font-semibold"

/** ---------- Helper: โฟกัสช่องถัดไปที่ใช้งานได้ ---------- */
const focusNextAvailable = (...refs) => {
  for (const r of refs) {
    const el = r?.current
    if (!el) continue
    // ถ้าเป็นปุ่ม/อินพุตที่ disabled ให้ข้าม
    if (typeof el.disabled !== "undefined" && el.disabled) continue
    try {
      el.focus()
      return true
    } catch { /* element not focusable — skip */ }
  }
  return false
}

/** ---------- DateInput ---------- */
// ช่องวันที่ไทย (วัน เดือน พ.ศ.) ตัวกลาง — API เหมือน input เดิม (handoff F25)

/** ---------- Page: ส่งสี ---------- */
function StockTransferMill() {
  const isPhone = useIsPhone()
  const [submitting, setSubmitting] = useState(false)

  /** ---------- Dropdown options ---------- */
  const [branchOptions, setBranchOptions] = useState([])
  const [klangOptions, setKlangOptions] = useState([])

  /** ฟอร์มสินค้า (handoff F30) */
  const productForms = useProductForms()
  const [formId, setFormId] = useState("")
  const selectedForm = productForms.findForm(formId)
  /** เปลี่ยนฟอร์มตอนมีรายการในล็อต → ถามก่อนล้าง */
  const [pendingFormId, setPendingFormId] = useState(null)

  /** ชื่อคลังตาม id (เติมจากรายการคลังที่โหลดแต่ละสาขา) — ตารางล็อตแสดงชื่อ ไม่ใช่เลข (F22) */
  const [klangNames, setKlangNames] = useState({})
  const rememberKlangNames = useCallback((list) => {
    setKlangNames((prev) => {
      let changed = false
      const next = { ...prev }
      ;(list || []).forEach((k) => {
        const id = String(k.id ?? "")
        const label = k.label ?? k.klang_name
        if (id && label && next[id] !== label) { next[id] = label; changed = true }
      })
      return changed ? next : prev
    })
  }, [])
  const loadedBranchKlangs = useRef(new Set())

  /** ---------- All Klangs (ทุกสาขา) ---------- */
  const [selectAllKlangs, setSelectAllKlangs] = useState(false)
  const [allKlangsCache, setAllKlangsCache] = useState([]) // [{id,label,branch_id,branch_label}]

  /** สาขา: scope "own_branch" → ล็อกที่สาขาที่ใช้งานอยู่ (โหมดทุกคลังก็ค้นเฉพาะสาขานี้) */
  const branchLock = useBranchLock()

  /** ---------- Form ---------- */
  const [form, setForm] = useState({
    lot_date: new Date().toISOString().slice(0, 10),
    lot_number: "",
    total_weight: "",
    branch_id: branchLock.activeId,
    branch_name: "",
    klang_id: null,
    klang_name: "",

  })
  const update = (k, v) => setForm((p) => ({ ...p, [k]: v }))

  /** ---------- Errors / hints ---------- */
  const [errors, setErrors] = useState({})
  const [missingHints, setMissingHints] = useState({})
  const redFieldCls = (key) => (errors[key] || missingHints[key] ? "border-red-500 ring-2 ring-red-300 focus:ring-0 focus:border-red-500" : "")
  const clearHint = (key) => setMissingHints((prev) => (prev[key] ? { ...prev, [key]: false } : prev))
  const clearError = (key) =>
    setErrors((prev) => {
      if (!(key in prev)) return prev
      const { [key]: _omit, ...rest } = prev
      return rest
    })

  /** ---------- Eligible TempStock ---------- */
  const [eligible, setEligible] = useState([])
  const [loadingEligible, setLoadingEligible] = useState(false)
  const [eligibleErr, setEligibleErr] = useState("")

  /** ---------- Picks in this lot ---------- */
  const [picks, setPicks] = useState([]) // [{ tempstock_id, stock_id, amount_available, stock_branch, stock_klang, pick_weight }]
  const totalPicked = useMemo(() => picks.reduce((acc, it) => acc + toInt(it.pick_weight), 0), [picks])
  const requiredTotal = useMemo(() => toInt(form.total_weight), [form.total_weight])
  const diff = requiredTotal - totalPicked

  // เคลียร์เฉพาะผลค้นหา (เก็บ picks ไว้) เวลาที่ตั้งเปลี่ยน
  const clearEligibleOnly = useCallback(() => {
    setEligible([])
    setEligibleErr("")
  }, [])

  /** ---------- Refs สำหรับ Enter Chain ---------- */
  const lotNumberRef = useRef(null)
  const totalWeightRef = useRef(null)

  const branchBtnRef = useRef(null)
  const klangBtnRef = useRef(null)
  const productBtnRef = useRef(null) // ฟอร์มสินค้า
  const submitBtnRef = useRef(null)

  /** ---------- Scroll/Focus helpers (ให้เหมือนหน้า Sales) ---------- */
  const scrollToPageTop = () => {
    try {
      const root = document.scrollingElement || document.documentElement || document.body
      root.scrollTo({ top: 0, behavior: "smooth" })
    } catch { /* smooth scroll best-effort */ }
  }

  const errorOrder = [
    "lot_number",
    "total_weight",
    "branch_id",
    "klang_id",
    "form_id",
    "picks",
  ]
  const refMap = {
    lot_number: lotNumberRef,
    total_weight: totalWeightRef,
    branch_id: branchBtnRef,
    klang_id: klangBtnRef,
    form_id: productBtnRef,
    picks: totalWeightRef,
  }
  const focusByKey = (key) => {
    const r = refMap[key]
    const el = r?.current
    if (!el) return
    try { el.scrollIntoView({ behavior: "smooth", block: "center" }) } catch { /* best-effort */ }
    try { el.focus?.() } catch { /* best-effort */ }
  }
  const scrollToFirstError = (eObj) => {
    const firstKey = errorOrder.find((k) => k in eObj)
    if (firstKey) focusByKey(firstKey)
  }
  const scrollToFirstMissing = (hintsObj) => {
    const firstKey = errorOrder.find((k) => hintsObj[k])
    if (firstKey) focusByKey(firstKey)
  }

  /** ---------- Load branches ---------- */
  useEffect(() => {
    get("/order/branch/search")
      .then((branches) => setBranchOptions((branches || []).map((b) => ({ id: b.id, label: b.branch_name }))))
      .catch((e) => { console.error("load branches error:", e); setBranchOptions([]) })
  }, [])

  // ล็อกสาขา → บังคับเป็นสาขาที่ใช้งานอยู่ + ชื่อจากรายการสาขา
  useEffect(() => {
    if (!branchLock.locked) return
    setAllKlangsCache([])
    const found = branchOptions.find((b) => String(b.id) === branchLock.activeKey)
    setForm((p) => {
      const name = found?.label ?? ""
      if (String(p.branch_id ?? "") === branchLock.activeKey && p.branch_name === name) return p
      const sameBranch = String(p.branch_id ?? "") === branchLock.activeKey
      return {
        ...p,
        branch_id: found?.id ?? branchLock.activeId,
        branch_name: name,
        ...(sameBranch ? null : { klang_id: null, klang_name: "" }),
      }
    })
  }, [branchLock.locked, branchLock.activeKey, branchLock.activeId, branchOptions])

  // branch -> klang
  useEffect(() => {
    const bid = form.branch_id
    const bname = form.branch_name?.trim()
    if (bid == null && !bname) {
      setKlangOptions([])
      update("klang_id", null)
      update("klang_name", "")
      return
    }
    const loadKlang = async () => {
      try {
        const qs = bid != null ? `branch_id=${bid}` : `branch_name=${encodeURIComponent(bname)}`
        const arr = await get(`/order/klang/search?${qs}`)
        const list = (arr || []).map((k) => ({ id: k.id, label: k.klang_name }))
        setKlangOptions(list)
        rememberKlangNames(list)
        if (bid != null) loadedBranchKlangs.current.add(String(bid))
      } catch (e) {
        console.error("Load klang error:", e)
        setKlangOptions([])
      }
    }
    loadKlang()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form.branch_id, form.branch_name])

  /** ชื่อคลังของแถวที่มาจากสาขาที่ยังไม่ได้โหลด (โหมดทุกคลัง / แถวเก่าในล็อต) */
  useEffect(() => {
    const need = new Set()
    ;[...eligible, ...picks].forEach((r) => {
      const b = r?.stock_branch
      if (b != null && !loadedBranchKlangs.current.has(String(b))) need.add(String(b))
    })
    if (need.size === 0) return
    need.forEach((b) => loadedBranchKlangs.current.add(b))
    Promise.allSettled([...need].map((b) => get(`/order/klang/search?branch_id=${encodeURIComponent(b)}`)))
      .then((res) => res.forEach((r) => {
        if (r.status === "fulfilled") rememberKlangNames((r.value || []).map((k) => ({ id: k.id, label: k.klang_name })))
      }))
  }, [eligible, picks, rememberKlangNames])

  const branchName = (id) => (id == null ? "—" : branchOptions.find((b) => String(b.id) === String(id))?.label || `สาขา #${id}`)
  const klangName = (id) => (id == null ? "—" : klangNames[String(id)] || `คลัง #${id}`)

  /** ---------- Validate ---------- */
  const computeMissingHints = () => {
    const m = {}
    if (!form.lot_number?.trim()) m.lot_number = true
    // klang_id ไม่บังคับ (รองรับ “ทุกคลัง”)
    if (!formId) m.form_id = true
    if (!form.total_weight || toInt(form.total_weight) <= 0) m.total_weight = true
    return m
  }

  const validateBeforeSearch = () => {
    const e = {}
    // ถ้าไม่ได้เลือก “ทุกคลัง” ต้องมี klang_id
    if (!selectAllKlangs && !form.klang_id) e.klang_id = "กรุณาเลือกคลังสำหรับดึงรายการ หรือเปิดโหมด 'ดึงจากทุกคลัง'"
    if (!formId) e.form_id = "กรุณาเลือกฟอร์มสินค้า"
    else if (!selectedForm) e.form_id = "ฟอร์มสินค้านี้ใช้งานไม่ได้แล้ว เลือกฟอร์มอื่น"
    setErrors(e)
    return Object.keys(e).length === 0
  }

  // ⭐ เปลี่ยนให้คืน "e object" เพื่อใช้แจ้งเตือนแบบหน้า Sales
  const validateBeforeSubmit = () => {
    const e = {}
    if (!form.lot_number?.trim()) e.lot_number = "กรุณาใส่เลขล็อต"
    // ไม่บังคับ klang_id
    if (!formId) e.form_id = "กรุณาเลือกฟอร์มสินค้า"
    else if (!selectedForm) e.form_id = "ฟอร์มสินค้านี้ใช้งานไม่ได้แล้ว เลือกฟอร์มอื่น"

    const tw = toInt(form.total_weight)
    if (tw <= 0) e.total_weight = "น้ำหนักรวมต้องมากกว่า 0 (กก.) และเป็นจำนวนเต็ม"
    if (picks.length === 0) e.picks = "กรุณาเพิ่มคลังอย่างน้อย 1 รายการ"
    const totalPicked = picks.reduce((acc, it) => acc + toInt(it.pick_weight), 0)
    if (totalPicked !== tw)
      e.picks = `น้ำหนักที่เลือก (${totalPicked.toLocaleString()} กก.) ต้องเท่ากับน้ำหนักรวม (${tw.toLocaleString()} กก.)`
    // backend รับล็อตจากคลังเดียว (handoff F22)
    if (new Set(picks.map((p) => String(p.stock_klang))).size > 1)
      e.picks = "หนึ่งล็อตเลือกได้จากคลังเดียว ลบรายการของคลังอื่นออกก่อนบันทึก"

    setErrors(e)
    return e
  }

  /** ---------- Payload helpers ---------- */
  const buildSpecPayload = (includeKlang = true, klangIdOverride = null) => {
    const specWrapper = { spec: specFromForm(selectedForm) }
    if (!includeKlang) return { spec: specWrapper } // สำหรับ submit — backend เอาคลังจากล็อตเอง
    const klangLoc = klangIdOverride != null ? klangIdOverride : form.klang_id ?? null
    return { spec: { ...specWrapper, klang_location: klangLoc } }
  }

  /** ---------- All Klangs helper (ทุกสาขา) ---------- */
  const ensureAllKlangs = useCallback(async () => {
    if (allKlangsCache.length > 0) return allKlangsCache
    // ดึงคลังของทุกสาขา (ล็อกสาขา → เฉพาะสาขาที่ใช้งานอยู่)
    const branches = branchLock.locked
      ? branchOptions.filter((b) => String(b.id) === branchLock.activeKey)
      : branchOptions
    const branchMap = new Map(branches.map((b) => [String(b.id), b.label]))
    const results = await Promise.allSettled(
      branches.map((b) => get(`/order/klang/search?branch_id=${b.id}`))
    )
    const merged = []
    results.forEach((res, idx) => {
      if (res.status === "fulfilled" && Array.isArray(res.value)) {
        const b = branches[idx]
        res.value.forEach((k) => {
          merged.push({
            id: k.id,
            label: k.klang_name,
            branch_id: b.id,
            branch_label: branchMap.get(String(b.id)) || "",
          })
        })
      }
    })
    setAllKlangsCache(merged)
    rememberKlangNames(merged)
    branches.forEach((b) => loadedBranchKlangs.current.add(String(b.id)))
    return merged
  }, [allKlangsCache, branchOptions, branchLock.locked, branchLock.activeKey, rememberKlangNames])

  /** ---------- Eligible fetch ---------- */
  const fetchEligible = async () => {
    setEligibleErr("")
    if (!validateBeforeSearch()) return
    setLoadingEligible(true)
    try {
      if (selectAllKlangs) {
        // ดึงจากทุกคลัง ทุกสาขา → รวมผล และ dedupe ตาม tempstock_id
        const allKlangs = await ensureAllKlangs()
        if (allKlangs.length === 0) {
          setEligible([])
          setEligibleErr("ไม่พบบัญชีคลังใด ๆ ในระบบ")
          setLoadingEligible(false)
          return
        }

        const payloads = allKlangs.map((k) => buildSpecPayload(true, k.id))
        const calls = await Promise.allSettled(payloads.map((pl) => post("/mill/eligible", pl)))

        const map = new Map() // tempstock_id -> row
        calls.forEach((c) => {
          if (c.status === "fulfilled" && Array.isArray(c.value)) {
            c.value.forEach((row) => {
              // dedupe by tempstock_id (ล่าสุดทับเดิมไม่เป็นไร — ข้อมูลเหมือนกัน)
              map.set(row.tempstock_id, row)
            })
          }
        })
        const merged = Array.from(map.values())
        setEligible(merged)
        if (merged.length === 0) {
          setEligibleErr("ไม่พบสต็อกที่ตรงสเปคในทุกคลัง")
        }
      } else {
        const payload = buildSpecPayload(true) // รวม klang เฉพาะที่เลือก
        const rows = await post("/mill/eligible", payload)
        setEligible(Array.isArray(rows) ? rows : [])
        if (!rows || rows.length === 0) setEligibleErr("ไม่พบสต็อกที่ตรงสเปคในคลังนี้")
      }
    } catch (err) {
      console.error(err)
      setEligible([])
      setEligibleErr(friendly(err, "ดึงคลังที่เข้าเกณฑ์ไม่สำเร็จ ลองใหม่อีกครั้ง"))
    } finally {
      setLoadingEligible(false)
    }
  }

  /** ---------- Pick handlers ---------- */
  const upsertPick = (row, weightStr) => {
    const pickInt = toInt(weightStr)
    if (pickInt <= 0) {
      toast.error("น้ำหนักไม่ถูกต้อง", { description: "น้ำหนักต้องเป็นจำนวนเต็มกิโล มากกว่า 0" })
      return
    }
    if (pickInt > row.amount_available) {
      toast.error("เกินคงเหลือในคลังนี้", { description: `คงเหลือ ${nf(row.amount_available)} กก.` })
      return
    }
    setPicks((prev) => {
      const idx = prev.findIndex((p) => p.tempstock_id === row.tempstock_id)
      const rec = {
        tempstock_id: row.tempstock_id,
        stock_id: row.stock_id,
        amount_available: row.amount_available,
        stock_branch: row.stock_branch ?? null,
        stock_klang: row.stock_klang,
        pick_weight: pickInt,
      }
      if (idx === -1) return [...prev, rec]
      const clone = prev.slice()
      clone[idx] = rec
      return clone
    })
  }

  const removePick = (tempstock_id) => setPicks((prev) => prev.filter((p) => p.tempstock_id !== tempstock_id))

  const setPickWeight = (tempstock_id, v) => {
    const next = toInt(onlyDigits(v))
    setPicks((prev) =>
      prev.map((x) =>
        x.tempstock_id === tempstock_id
          ? { ...x, pick_weight: next > x.amount_available ? x.amount_available : next }
          : x
      )
    )
  }
  const normalizePickWeight = (tempstock_id) => {
    setPicks((prev) =>
      prev.map((x) =>
        x.tempstock_id === tempstock_id ? { ...x, pick_weight: Math.max(1, toInt(x.pick_weight)) } : x
      )
    )
  }

  /** ---------- Submit ---------- */
  const handleSubmit = async (e) => {
    e?.preventDefault?.()
    // เหมือนหน้า Sales: เลื่อนขึ้นบนสุดก่อน validate
    scrollToPageTop()

    const hints = computeMissingHints()
    setMissingHints(hints)
    const eObj = validateBeforeSubmit()

    if (Object.keys(eObj).length > 0 || Object.values(hints).some(Boolean)) {
      const valueOf = (k) => (k === "form_id" ? formId : form[k])
    const missingKeys = errorOrder.filter((k) => hints[k] && (valueOf(k) === "" || valueOf(k) == null))
      if (missingKeys.length) toast.error("กรอกไม่ครบ", { description: missingDescription(missingKeys) })
      else toast.error("ข้อมูลไม่ถูกต้อง", { description: Object.values(eObj)[0] || "ตรวจช่องที่มีกรอบสีแดง" })
      if (Object.keys(eObj).length > 0) scrollToFirstError(eObj)
      else scrollToFirstMissing(hints)
      return
    }

    setSubmitting(true)
    try {
      const specForSubmit = buildSpecPayload(false).spec // ไม่มี klang_location
      const payload = {
        lot_number: form.lot_number.trim(),
        spec: specForSubmit,
        total_weight: toInt(form.total_weight),
        items: picks.map((p) => ({
          tempstock_id: p.tempstock_id,
          pick_weight: toInt(p.pick_weight),
        })),
      }

      await post("/mill/records", payload)

      toast.success("บันทึกส่งสีแล้ว", {
        description: `ล็อต ${form.lot_number.trim()} · ${nf(toInt(form.total_weight))} กก. · ${picks.length} คลัง`,
      })

      // Reset เฉพาะส่วนสินค้า (คง branch/klang/โหมดทุกคลัง เผื่อดึงต่อ)
      setPicks([])
      clearEligibleOnly()
      // คงฟอร์มสินค้า/สาขา/คลังไว้ เผื่อทำล็อตถัดไป
      setForm((f) => ({ ...f, lot_number: "", total_weight: "" }))

      requestAnimationFrame(() => scrollToPageTop())
      try { submitBtnRef.current?.blur?.() } catch { /* blur best-effort */ }
    } catch (err) {
      console.error(err)
      const { title, description } = describeSaveError(err)
      toast.error(title, { description })
    } finally {
      setSubmitting(false)
    }
  }

  const handleReset = () => {
    setPicks([])
    clearEligibleOnly()
    setForm((f) => ({ ...f, lot_number: "", total_weight: "" }))
    setFormId("")
    setErrors({})
    setMissingHints({})
  }

  const fetchLabel = loadingEligible
    ? (selectAllKlangs ? "กำลังดึงจากทุกคลัง..." : "กำลังดึงคลังที่เข้าเกณฑ์...")
    : (selectAllKlangs ? (branchLock.locked ? "ดึงจากทุกคลัง (สาขานี้)" : "ดึงจากทุกคลัง (ทุกสาขา)") : "ดึงคลังที่เข้าเกณฑ์")

  const progressBadge =
    requiredTotal <= 0 ? null : diff === 0 ? (
      <Badge tone="success">ครบ</Badge>
    ) : diff > 0 ? (
      <Badge tone="pending">ขาด {nf(diff)} กก.</Badge>
    ) : diff < 0 ? (
      <Badge tone="danger">เกิน {nf(Math.abs(diff))} กก.</Badge>
    ) : null

  /** ---------- Sticky bar summary (<md) ---------- */
  const barSummary = (
    <div className="flex min-w-0 items-center gap-2">
      <p className="min-w-0 flex-1 truncate tabular-nums text-gray-900 dark:text-gray-100">
        รวมที่เลือก {nf(totalPicked)} / {nf(requiredTotal)} กก.
      </p>
      <span className="shrink-0">{progressBadge}</span>
    </div>
  )

  const eligibleEmpty = (
    <EmptyState
      className="!py-10"
      title="ยังไม่มีรายการคลัง"
      description={`เลือกสเปคข้าวให้ครบ แล้วกด “${selectAllKlangs ? "ดึงจากทุกคลัง" : "ดึงคลังที่เข้าเกณฑ์"}” เพื่อแสดงคลังที่มีสต็อกตรงสเปค`}
    />
  )
  const picksEmpty = (
    <EmptyState
      className="!py-10"
      title="ยังไม่มีรายการในล็อต"
      description="เพิ่มคลังจาก “เลือกคลังเข้าล็อต” ด้านบน เพื่อรวมน้ำหนักให้ครบตามที่ต้องการ"
    />
  )

  return (
    <div className="min-h-screen bg-white text-black dark:bg-slate-900 dark:text-white rounded-2xl text-[15px] md:text-base">
      <div className="w-full p-4 md:p-6 lg:p-8">
        <PageTitle title="ส่งสี / สร้างล็อตสี" />

        <form onSubmit={handleSubmit}>
          {/* กรอบที่ 1: ข้อมูล LOT */}
          <div className={sectionCardCls}>
            <h2 className={sectionTitleTextCls}>ข้อมูลล็อต</h2>
            <div className="grid gap-4 md:grid-cols-3">
              <div>
                <label htmlFor="lot_number" className={labelCls}>เลขล็อต</label>
                <input
                  id="lot_number"
                  ref={lotNumberRef}
                  className={cx(baseField, redFieldCls("lot_number"))}
                  value={form.lot_number}
                  onChange={(e) => update("lot_number", e.target.value)}
                  onFocus={() => {
                    clearError("lot_number")
                    clearHint("lot_number")
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault()
                      focusNextAvailable(totalWeightRef)
                    }
                  }}
                  placeholder="เช่น MILL-2025-001"
                  aria-invalid={errors.lot_number ? true : undefined}
                />
                {errors.lot_number && <p className={errorTextCls}>{errors.lot_number}</p>}
              </div>

              <div>
                <label htmlFor="total_weight" className={labelCls}>น้ำหนักรวมล็อต (กก.)</label>
                <input
                  id="total_weight"
                  ref={totalWeightRef}
                  inputMode="numeric"
                  className={cx(baseField, "tabular-nums", redFieldCls("total_weight"))}
                  value={form.total_weight}
                  onChange={(e) => update("total_weight", onlyDigits(e.target.value))}
                  onFocus={() => {
                    clearError("total_weight")
                    clearHint("total_weight")
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault()
                      // ถ้าเปิดโหมดทุกคลัง → ข้ามสาขา/คลัง ไป "ประเภทสินค้า"
                      if (selectAllKlangs) {
                        focusNextAvailable(productBtnRef)
                      } else {
                        // ถ้า branch ถูก disable (ไม่มี) → ข้ามไปคลัง/ประเภทสินค้า
                        if (!focusNextAvailable(branchBtnRef)) {
                          if (!focusNextAvailable(klangBtnRef)) {
                            focusNextAvailable(productBtnRef)
                          }
                        }
                      }
                    }
                  }}
                  placeholder="เช่น 5000"
                  aria-invalid={errors.total_weight ? true : undefined}
                />
                <p className={helpTextCls}>กรอกเป็นจำนวนเต็ม</p>
                {errors.total_weight && <p className={errorTextCls}>{errors.total_weight}</p>}
              </div>

              <div>
                <label htmlFor="lot_date" className={labelCls}>วันที่ล็อต (ไม่บังคับ)</label>
                <DateInput
                  id="lot_date"
                  value={form.lot_date}
                  onChange={(e) => update("lot_date", e.target.value)}
                />
              </div>
            </div>
          </div>

          {/* กรอบที่ 2: ที่ตั้ง & สเปคข้าว */}
          <div className={sectionCardCls}>
            <h2 className={sectionTitleTextCls}>ที่ตั้ง & สเปคข้าว</h2>

            {/* แถบสวิตช์ “ดึงจากทุกคลัง (ทุกสาขา)” */}
            <div className="mb-3 flex min-h-touch items-center gap-3 rounded-xl border border-slate-200 px-3 py-2 dark:border-slate-700/60">
              <input
                id="allKlangs"
                type="checkbox"
                className="size-5 shrink-0 accent-emerald-600 cursor-pointer"
                checked={selectAllKlangs}
                onChange={(e) => {
                  const on = e.target.checked
                  setSelectAllKlangs(on)
                  // เปิดโหมดทุกคลัง → ปิดการเลือกคลังเดี่ยว / ล้างผลค้นหา
                  if (on) {
                    update("klang_id", null)
                    update("klang_name", "")
                  }
                  clearEligibleOnly()
                  clearError("klang_id")
                  clearHint("klang_id")
                }}
              />
              <label htmlFor="allKlangs" className="min-h-touch flex items-center cursor-pointer select-none">
                <span>ดึงจาก <b>ทุกคลัง</b> ที่มีข้าวตามสเปค ({branchLock.locked ? "สาขาที่ใช้งานอยู่" : "ทุกสาขา"})</span>
              </label>
            </div>

            <div className="grid gap-4 md:grid-cols-3">
              {/* สาขา */}
              <div>
                <label className={labelCls}>สาขา</label>
                <ComboBox
                  title="สาขา"
                  ariaLabel="สาขา"
                  options={branchOptions}
                  value={form.branch_id}
                  getValue={(o) => o.id}
                  onChange={(_v, found) => {
                    clearError("branch_id")
                    update("branch_id", found?.id ?? null)
                    update("branch_name", found?.label ?? "")
                    // เปลี่ยนสาขา: เคลียร์คลังที่เลือก & เคลียร์ผลค้นหา (เก็บ picks ไว้)
                    update("klang_id", null)
                    update("klang_name", "")
                    clearEligibleOnly()
                  }}
                  placeholder="— เลือกสาขา —"
                  disabled={selectAllKlangs || branchLock.locked} // โหมดทุกคลัง: ไม่ต้องเลือกสาขา
                  buttonRef={branchBtnRef}
                  enterMovesWhenFilled
                  onEnterNext={() => {
                    // ถ้า "คลัง" ใช้ไม่ได้ (disabled) ให้ข้ามไป "ประเภทสินค้า"
                    if (!focusNextAvailable(klangBtnRef)) focusNextAvailable(productBtnRef)
                  }}
                />
                {branchLock.locked ? (
                  <BranchLockNote />
                ) : selectAllKlangs && (
                  <p className={helpTextCls}>โหมด “ทุกคลัง” จะค้นหาทุกสาขาให้อัตโนมัติ</p>
                )}
              </div>

              {/* คลัง */}
              <div>
                <label className={labelCls}>คลัง</label>
                <ComboBox
                  title="คลัง"
                  ariaLabel="คลัง"
                  options={klangOptions}
                  value={form.klang_id}
                  getValue={(o) => o.id}
                  onChange={(_v, found) => {
                    clearError("klang_id")
                    clearHint("klang_id")
                    update("klang_id", found?.id ?? null)
                    update("klang_name", found?.label ?? "")
                    clearEligibleOnly()
                  }}
                  placeholder="— เลือกคลัง —"
                  disabled={!form.branch_id || selectAllKlangs}
                  error={!selectAllKlangs && !!errors.klang_id}
                  hintRed={!selectAllKlangs && !!missingHints.klang_id}
                  clearHint={() => clearHint("klang_id")}
                  buttonRef={klangBtnRef}
                  enterMovesWhenFilled
                  onEnterNext={() => focusNextAvailable(productBtnRef)}
                />
                <p className={helpTextCls}>
                  {selectAllKlangs
                    ? "กำลังใช้โหมดดึงจากทุกคลัง (ปิดการเลือกคลังเดี่ยว)"
                    : "เลือกคลัง → ดึงรายการ → เพิ่มเข้า “ล็อต” ได้หลายคลัง"}
                </p>
                {!selectAllKlangs && errors.klang_id && <p className={errorTextCls}>{errors.klang_id}</p>}
              </div>

            </div>

            {/* สินค้า — ฟอร์มสินค้าตัวเดียว + ชิปสเปค (handoff F30) */}
            <ProductFormPicker
              id="mill-form"
              forms={productForms}
              value={formId}
              storageKey="mill.formTemplate"
              onChange={(id) => {
                clearError("form_id")
                clearHint("form_id")
                if (picks.length > 0 && String(id) !== String(formId)) { setPendingFormId(id); return }
                setFormId(id)
                clearEligibleOnly()
              }}
              error={errors.form_id}
              hintRed={!!missingHints.form_id}
              clearHint={() => clearHint("form_id")}
              buttonRef={productBtnRef}
              className="mt-4 md:max-w-2xl"
            />

            <div className="mt-4 flex flex-col gap-3 sm:flex-row">
              <button
                type="button"
                onClick={fetchEligible}
                className="inline-flex items-center justify-center rounded-2xl
                  bg-indigo-600 px-6 py-3 text-base font-semibold text-white
                  shadow-[0_6px_16px_rgba(79,70,229,0.35)]
                  transition-all duration-300 ease-out
                  hover:bg-indigo-700 hover:shadow-[0_8px_20px_rgba(79,70,229,0.45)]
                  hover:scale-[1.05] active:scale-[.97]
                  disabled:opacity-60 disabled:cursor-not-allowed cursor-pointer"
                aria-busy={loadingEligible ? "true" : "false"}
                disabled={loadingEligible}
              >
                {fetchLabel}
              </button>

              <div className="flex items-center text-sm text-slate-600 dark:text-slate-300">
                {loadingEligible ? (
                  <Badge tone="neutral">กำลังดึงรายการ…</Badge>
                ) : eligibleErr ? (
                  <Badge tone="danger">{eligibleErr}</Badge>
                ) : eligible.length > 0 ? (
                  <Badge tone="success">พบ {eligible.length} รายการที่เข้าเกณฑ์</Badge>
                ) : null}
              </div>
            </div>
          </div>

          {/* กรอบที่ 3: รายการคลังที่เข้าเกณฑ์ + เพิ่มเข้าลอต */}
          <div className={sectionCardCls}>
            <h2 className={sectionTitleTextCls}>เลือกคลังเข้าล็อต</h2>

            {isPhone ? (
              eligibleErr && !loadingEligible ? (
                <ErrorState message={eligibleErr} onRetry={fetchEligible} />
              ) : (
                <DataList
                  items={eligible}
                  keyOf={(r) => r.tempstock_id}
                  loading={loadingEligible}
                  skeletonRows={3}
                  emptyState={eligibleEmpty}
                  title={(r) => klangName(r.stock_klang)}
                  subtitle={(r) => branchName(r.stock_branch)}
                  badge={(r) => (picks.some((p) => p.tempstock_id === r.tempstock_id) ? <Badge tone="success">ในล็อต</Badge> : null)}
                  fields={[{ label: "คงเหลือ", value: (r) => `${nf(r.amount_available ?? 0)} กก.`, align: "right", emphasis: true, span: 2 }]}
                  actions={(r) => (
                    <EligibleActions
                      row={r}
                      inLot={picks.some((p) => p.tempstock_id === r.tempstock_id)}
                      defaultWeight={picks.find((p) => p.tempstock_id === r.tempstock_id)?.pick_weight ?? ""}
                      onAdd={(w) => upsertPick(r, w)}
                    />
                  )}
                />
              )
            ) : (
              <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-700">
                <table className="min-w-full text-left text-sm">
                  <thead className="bg-slate-50 dark:bg-slate-700/40 text-slate-600 dark:text-slate-300">
                    <tr>
                      <th className="px-3 py-2 font-medium">สาขา</th>
                      <th className="px-3 py-2 font-medium">คลัง</th>
                      <th className="px-3 py-2 text-right font-medium">คงเหลือ (กก.)</th>
                      <th className="px-3 py-2 w-48 font-medium">ใส่กก.ที่จะใช้</th>
                      <th className="px-3 py-2 w-32 font-medium">เพิ่ม/อัปเดต</th>
                    </tr>
                  </thead>
                  <tbody>
                    {loadingEligible ? (
                      <SkeletonTableRows rows={5} cols={5} />
                    ) : eligibleErr ? (
                      <tr>
                        <td colSpan={5} className="px-3 py-4">
                          <ErrorState message={eligibleErr} onRetry={fetchEligible} />
                        </td>
                      </tr>
                    ) : eligible.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="px-3 py-2">{eligibleEmpty}</td>
                      </tr>
                    ) : (
                      eligible.map((row) => (
                        <RowEligible
                          key={row.tempstock_id}
                          row={row}
                          branchLabel={branchName(row.stock_branch)}
                          klangLabel={klangName(row.stock_klang)}
                          defaultWeight={picks.find((p) => p.tempstock_id === row.tempstock_id)?.pick_weight ?? ""}
                          onAdd={(w) => upsertPick(row, w)}
                        />
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* กรอบที่ 4: สรุปรายการในลอต */}
          <div className={sectionCardCls}>
            <h2 className={sectionTitleTextCls}>รายการในล็อต</h2>

            {isPhone ? (
              <>
                <DataList
                  items={picks}
                  keyOf={(p) => p.tempstock_id}
                  emptyState={picksEmpty}
                  title={(p) => klangName(p.stock_klang)}
                  subtitle={(p) => branchName(p.stock_branch)}
                  fields={[
                    { label: "คงเหลือ", value: (p) => `${nf(p.amount_available)} กก.`, align: "right" },
                    {
                      label: "กก. ที่ใช้",
                      align: "right",
                      value: (p) => (
                        <input
                          inputMode="numeric"
                          aria-label={`กก. ที่ใช้ คลัง ${p.stock_klang ?? ""}`}
                          className={cx(baseField, "w-28 !py-2 text-right tabular-nums")}
                          value={p.pick_weight}
                          onChange={(e) => setPickWeight(p.tempstock_id, e.target.value)}
                          onBlur={() => normalizePickWeight(p.tempstock_id)}
                          placeholder="เช่น 1200"
                        />
                      ),
                    },
                  ]}
                  actions={(p) => (
                    <button
                      type="button"
                      onClick={() => removePick(p.tempstock_id)}
                      aria-label={`ลบ คลัง ${p.stock_klang ?? ""}`}
                      className={cx(dangerBtnCls, "size-11 !px-0")}
                    >
                      <Trash2 aria-hidden="true" className="size-5" strokeWidth={1.75} />
                    </button>
                  )}
                />
                {errors.picks && <p className={errorTextCls + " mt-2"}>{errors.picks}</p>}
              </>
            ) : (
              <>
                <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-700">
                  <table className="min-w-full text-left text-sm">
                    <thead className="bg-slate-50 dark:bg-slate-700/40 text-slate-600 dark:text-slate-300">
                      <tr>
                        <th className="px-3 py-2 font-medium">สาขา</th>
                        <th className="px-3 py-2 font-medium">คลัง</th>
                        <th className="px-3 py-2 text-right font-medium">คงเหลือ</th>
                        <th className="px-3 py-2 w-40 font-medium">กก. ที่ใช้</th>
                        <th className="px-3 py-2 w-24 font-medium">ลบ</th>
                      </tr>
                    </thead>
                    <tbody>
                      {picks.length === 0 && (
                        <tr>
                          <td colSpan={5} className="px-3 py-2">{picksEmpty}</td>
                        </tr>
                      )}
                      {picks.map((p) => (
                        <tr key={p.tempstock_id} className="border-t border-slate-100 dark:border-slate-700/60">
                          <td className="px-3 py-2 text-slate-700 dark:text-slate-200">{branchName(p.stock_branch)}</td>
                          <td className="px-3 py-2 text-slate-700 dark:text-slate-200">{klangName(p.stock_klang)}</td>
                          <td className="px-3 py-2 text-right tabular-nums text-slate-700 dark:text-slate-200">{p.amount_available.toLocaleString()} กก.</td>
                          <td className="px-3 py-2">
                            <input
                              inputMode="numeric"
                              aria-label={`กก. ที่ใช้ คลัง ${p.stock_klang ?? ""}`}
                              className={cx(baseField, "tabular-nums")}
                              value={p.pick_weight}
                              onChange={(e) => setPickWeight(p.tempstock_id, e.target.value)}
                              onBlur={() => normalizePickWeight(p.tempstock_id)}
                              placeholder="เช่น 1200"
                            />
                          </td>
                          <td className="px-3 py-2">
                            <button
                              type="button"
                              onClick={() => removePick(p.tempstock_id)}
                              className="rounded-xl border border-red-300 px-3 py-2 text-red-600 transition-colors duration-150 hover:bg-red-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-red-400 dark:border-red-800/70 dark:text-red-300 dark:hover:bg-red-900/20 cursor-pointer"
                            >
                              ลบ
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Progress */}
                <div className="mt-4">
                  <div className="flex items-center justify-between text-sm">
                    <div className="text-slate-600 dark:text-slate-300">
                      รวมที่เลือก: <b>{totalPicked.toLocaleString()}</b> / ต้องการ <b>{requiredTotal.toLocaleString()}</b> กก.
                    </div>
                    <div
                      className={cx(
                        "font-semibold",
                        requiredTotal <= 0
                          ? "text-slate-500 dark:text-slate-400"
                          : diff === 0 ? "text-emerald-600 dark:text-emerald-400" : diff > 0 ? "text-amber-600 dark:text-amber-400" : "text-red-600 dark:text-red-400"
                      )}
                    >
                      {requiredTotal <= 0
                        ? "ยังไม่ได้กรอกน้ำหนักรวมล็อต"
                        : diff === 0
                        ? "ครบตามน้ำหนักรวม"
                        : diff > 0
                        ? `ขาดอีก ${diff.toLocaleString()} กก.`
                        : `เกิน ${Math.abs(diff).toLocaleString()} กก.`}
                    </div>
                  </div>
                  <div className="mt-2 h-3 w-full rounded-full bg-slate-200 dark:bg-slate-700 overflow-hidden">
                    <div
                      className={cx("h-3 rounded-full transition-all", requiredTotal > 0 && diff === 0 ? "bg-emerald-500" : "bg-amber-500")}
                      style={{ width: `${requiredTotal === 0 ? 0 : Math.min(100, Math.max(0, (totalPicked / requiredTotal) * 100))}%` }}
                    />
                  </div>
                  {errors.picks && <p className={errorTextCls + " mt-2"}>{errors.picks}</p>}
                </div>
              </>
            )}
          </div>

          {/* ปุ่ม — <md: แถบติดล่าง (UI-SPEC §7) · ≥md: ปุ่มเดิม */}
          {isPhone ? (
            <StickyActionBar
              summary={barSummary}
              secondary={{ label: "ล้างฟอร์ม", onClick: handleReset, disabled: submitting }}
              primary={{ label: submitting ? "กำลังบันทึก…" : "บันทึก", onClick: handleSubmit, loading: submitting }}
            />
          ) : (
            <div className="mt-6 flex flex-col gap-3 sm:flex-row">
              <button
                ref={submitBtnRef}
                type="submit"
                disabled={submitting}
                className="inline-flex items-center justify-center rounded-2xl
                  bg-emerald-600 px-6 py-3 text-base font-semibold text-white
                  shadow-[0_6px_16px_rgba(16,185,129,0.35)]
                  transition-all duration-300 ease-out
                  hover:bg-emerald-700 hover:shadow-[0_8px_20px_rgba(16,185,129,0.45)]
                  hover:scale-[1.05] active:scale-[.97]
                  disabled:opacity-60 disabled:cursor-not-allowed cursor-pointer"
                aria-busy={submitting ? "true" : "false"}
              >
                {submitting ? "กำลังบันทึก..." : "บันทึก"}
              </button>

              <button
                type="button"
                onClick={handleReset}
                className="inline-flex items-center justify-center rounded-2xl
                  border border-slate-300 bg-white px-6 py-3 text-base font-medium text-slate-700
                  shadow-sm
                  transition-all duration-300 ease-out
                  hover:bg-slate-100 hover:shadow-md hover:scale-[1.03]
                  active:scale-[.97]
                  dark:border-slate-600 dark:bg-slate-700/60 dark:text-white
                  dark:hover:bg-slate-700/50 dark:hover:shadow-lg cursor-pointer"
              >
                รีเซ็ต
              </button>
            </div>
          )}
        </form>

        <ConfirmDialog
          open={pendingFormId != null}
          title="เปลี่ยนฟอร์มสินค้า?"
          description={`มี ${picks.length} รายการในล็อตแล้ว การเปลี่ยนฟอร์มสินค้าจะล้างรายการทั้งหมดในล็อต`}
          confirmLabel="เปลี่ยนและล้างรายการ"
          tone="danger"
          onCancel={() => setPendingFormId(null)}
          onConfirm={() => {
            setFormId(pendingFormId)
            setPendingFormId(null)
            setPicks([])
            clearEligibleOnly()
          }}
        />
      </div>
    </div>
  )
}

/** แถวในตาราง Eligible พร้อมอินพุตน้ำหนักท้องถิ่น (≥md) */
function RowEligible({ row, branchLabel, klangLabel, defaultWeight, onAdd }) {
  const [w, setW] = useState(defaultWeight ?? "")
  useEffect(() => setW(defaultWeight ?? ""), [defaultWeight])

  const canAdd = toInt(w) > 0

  return (
    <tr className="border-t border-slate-100 dark:border-slate-700/60">
      <td className="px-3 py-2 text-slate-700 dark:text-slate-200">{branchLabel}</td>
      <td className="px-3 py-2 text-slate-700 dark:text-slate-200">{klangLabel}</td>
      <td className="px-3 py-2 text-right tabular-nums text-slate-700 dark:text-slate-200">{row.amount_available?.toLocaleString()} กก.</td>
      <td className="px-3 py-2">
        <input
          inputMode="numeric"
          aria-label={`ใส่กก.ที่จะใช้ คลัง ${row.stock_klang ?? ""}`}
          className={cx(baseField, "tabular-nums")}
          value={w}
          onChange={(e) => setW(onlyDigits(e.target.value))}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault()
              if (canAdd) onAdd(w)
            }
          }}
          placeholder="จำนวนเต็ม"
        />
      </td>
      <td className="px-3 py-2">
        <button
          type="button"
          onClick={() => onAdd(w)}
          disabled={!canAdd}
          className={cx(
            "rounded-xl px-3 py-2 text-white transition-colors duration-150 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-slate-800",
            canAdd
              ? "bg-emerald-600 hover:bg-emerald-700 cursor-pointer"
              : "bg-slate-400 dark:bg-slate-600 cursor-not-allowed"
          )}
        >
          เพิ่ม/อัปเดต
        </button>
      </td>
    </tr>
  )
}

/** การ์ด Eligible บนมือถือ: ช่องกก. + ปุ่มเพิ่ม/อัปเดต (UI-SPEC §6.4) */
function EligibleActions({ row, inLot, defaultWeight, onAdd }) {
  const [w, setW] = useState(defaultWeight ?? "")
  useEffect(() => setW(defaultWeight ?? ""), [defaultWeight])
  const canAdd = toInt(w) > 0

  return (
    <>
      <input
        inputMode="numeric"
        aria-label={`ใส่กก.ที่จะใช้ คลัง ${row.stock_klang ?? ""}`}
        className={cx(baseField, "w-32 !py-2 text-right tabular-nums")}
        value={w}
        onChange={(e) => setW(onlyDigits(e.target.value))}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault()
            if (canAdd) onAdd(w)
          }
        }}
        placeholder="กก."
      />
      <button type="button" onClick={() => onAdd(w)} disabled={!canAdd} className={cx(primaryBtnCls, "h-11")}>
        {inLot ? "อัปเดต" : "เพิ่ม"}
      </button>
    </>
  )
}

export default StockTransferMill
