// src/pages/StockBringInMill.jsx
import { useEffect, useMemo, useState } from "react"
import { useNavigate } from "react-router-dom"
import { get, post } from "../../lib/api"
import {
  cx,
  baseField,
  fieldDisabled,
  labelCls,
  helpTextCls,
  errorTextCls,
  cardCls,
  sectionTitleCls,
  submitBtnCls,
  resetBtnCls,
  spinnerCls,
} from "../../lib/styles"
import ComboBox from "../../components/ComboBox"
import { StickyActionBar, toast } from "../../components/ui"
import { useIsPhone } from "../../hooks/useMediaQuery"

/** ---------- Auth helpers ---------- */
const ALLOWED_USER_IDS = new Set([17, 18])
const getCurrentUser = () => {
  try {
    const raw = localStorage.getItem("user")
    return raw ? JSON.parse(raw) : null
  } catch {
    return null
  }
}

/** ---------- Utils ---------- */
const onlyDigits = (s = "") => s.replace(/[^\d]/g, "")
const toNumber = (v) => (v === "" || v === null || v === undefined ? 0 : Number(v))
const nf = (n) =>
  new Intl.NumberFormat("th-TH", { maximumFractionDigits: 2 }).format(isFinite(n) ? Number(n) : 0)
const thb = (n) =>
  new Intl.NumberFormat("th-TH", { style: "currency", currency: "THB", maximumFractionDigits: 2 }).format(
    isFinite(n) ? n : 0
  )
/** option value ของหน้านี้ = id ก่อน value (คง default ของ ComboBox copy เดิม) */
const getOptValue = (o) => o?.id ?? o?.value ?? ""

/** ชื่อฟิลด์สั้นสำหรับ toast "กรอกไม่ครบ" (mobile-copy §3.3) */
const FIELD_LABELS = {
  product_id: "ประเภทสินค้า",
  species_id: "ชนิดข้าว",
  variant_id: "ชั้นย่อย",
  klang_location: "คลังโรงสี",
  amount_in: "ปริมาณยกเข้า",
  prices: "ราคา",
}
const MISSING_ORDER = ["product_id", "species_id", "variant_id", "klang_location", "amount_in", "prices"]
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
  [/unauthorized|forbidden|credentials/i, "ไม่มีสิทธิ์หรือหมดเวลาใช้งาน"],
]
function describeSaveError(err) {
  const status = err?.status
  const raw = String(err?.message || "")
  const isThai = /[฀-๿]/.test(raw)
  const hit = SAVE_ERR_TH.find(([re]) => re.test(raw))?.[1]
  if (hit) return { title: status === 422 ? "ข้อมูลไม่ผ่านการตรวจ" : "บันทึกไม่สำเร็จ", description: hit }
  if (!status) return { title: "บันทึกไม่สำเร็จ", description: "เชื่อมต่อเซิร์ฟเวอร์ไม่ได้ ตรวจสัญญาณแล้วลองใหม่ ข้อมูลที่กรอกยังอยู่" }
  if (status === 401 || status === 403) return { title: "ไม่มีสิทธิ์บันทึก", description: "สิทธิ์ของบัญชีนี้ไม่ครอบคลุมรายการนี้ หรือหมดเวลาใช้งาน เข้าสู่ระบบใหม่แล้วลองอีกครั้ง" }
  if (status === 409) return { title: "รายการนี้มีอยู่แล้ว", description: isThai ? raw : "รายการนี้ถูกบันทึกไปแล้ว ตรวจก่อนบันทึกซ้ำ" }
  if (status === 422) return { title: "ข้อมูลไม่ผ่านการตรวจ", description: isThai ? raw : "เซิร์ฟเวอร์ปฏิเสธข้อมูลบางช่อง ตรวจค่าที่กรอกแล้วลองใหม่" }
  if (status >= 500) return { title: "เซิร์ฟเวอร์ขัดข้อง", description: "ยังไม่ได้บันทึก ลองใหม่ในอีกสักครู่ ถ้ายังไม่ได้ให้แจ้งผู้ดูแลระบบ" }
  return { title: "บันทึกไม่สำเร็จ", description: isThai ? raw : `เกิดข้อผิดพลาดที่ไม่คาดคิด ลองใหม่อีกครั้ง · รหัส: ${status}` }
}

/** ---------- Main Page: Bring In to Mill (ยกเข้าโรงสี) ---------- */
function StockBringInMill() {
  const navigate = useNavigate()
  const isPhone = useIsPhone()

  // ❗ Guard ในระดับหน้า (กันคนรู้พาธแล้วเข้ามา)
  useEffect(() => {
    const u = getCurrentUser()
    const uid = Number(u?.id ?? u?.user_id ?? 0)
    if (!ALLOWED_USER_IDS.has(uid)) {
      // ไปหน้าแรกและใส่ state แจ้งเตือนถ้าต้องใช้
      navigate("/home", { replace: true, state: { denied: true } })
    }
  }, [navigate])

  const [loading, setLoading] = useState(false)
  const [errors, setErrors] = useState({})
  const [missingHints, setMissingHints] = useState({})

  // lookups (id/label)
  const [productOptions, setProductOptions] = useState([])
  const [speciesOptions, setSpeciesOptions] = useState([])
  const [variantOptions, setVariantOptions] = useState([])
  const [yearOptions, setYearOptions] = useState([])
  const [conditionOptions, setConditionOptions] = useState([])
  const [fieldTypeOptions, setFieldTypeOptions] = useState([])
  const [programOptions, setProgramOptions] = useState([])
  const [businessOptions, setBusinessOptions] = useState([])
  const [klangOptions, setKlangOptions] = useState([])

  const [form, setForm] = useState({
    // ProductSpecIn
    product_id: "",
    species_id: "",
    variant_id: "",
    product_year: "",
    condition_id: "",
    field_type: "",
    program: "",
    business_type: "",

    // Mill Bring In
    klang_location: "",
    price1: "",
    price2: "", // optional
    amount_in: "",
    comment: "",
  })
  const update = (k, v) => setForm((p) => ({ ...p, [k]: v }))

  /** ---------- helpers ---------- */
  const fetchFirstOkJson = async (paths = []) => {
    for (const p of paths) {
      try {
        const data = await get(p)
        if (Array.isArray(data)) return data
        if (data && typeof data === "object") return data
      } catch { /* try next candidate path */ }
    }
    return Array.isArray(paths) ? [] : {}
  }

  /** ---------- Load lookups ---------- */
  useEffect(() => {
    let alive = true
    async function loadInitial() {
      try {
        const [products, conditions, fields, years, programs, businesses, klangs] = await Promise.all([
          fetchFirstOkJson(["/order/product/search"]),
          fetchFirstOkJson(["/order/condition/search"]),
          fetchFirstOkJson(["/order/field/search", "/order/field_type/list", "/order/field-type/list"]),
          fetchFirstOkJson(["/order/year/search"]),
          fetchFirstOkJson(["/order/program/search"]),
          fetchFirstOkJson(["/order/business/search"]),
          fetchFirstOkJson(["/order/klang/search"]),
        ])
        if (!alive) return

        setProductOptions(
          (products || [])
            .map((x) => ({
              id: String(x.id ?? x.product_id ?? x.value ?? ""),
              label: String(x.product_type ?? x.name ?? x.label ?? "").trim(),
            }))
            .filter((o) => o.id && o.label)
        )
        setConditionOptions(
          (conditions || []).map((x, i) => ({ id: String(x.id ?? x.value ?? i), label: String(x.condition ?? x.name ?? x.label ?? "").trim() }))
        )
        setFieldTypeOptions(
          (fields || []).map((x, i) => ({
            id: String(x.id ?? x.value ?? i),
            label: String(x.field ?? x.field_type ?? x.name ?? x.label ?? (typeof x === "string" ? x : "")).trim(),
          }))
        )
        setYearOptions((years || []).map((x, i) => ({ id: String(x.id ?? x.value ?? i), label: String(x.year ?? x.name ?? x.label ?? "").trim() })))
        setProgramOptions((programs || []).map((x, i) => ({ id: String(x.id ?? x.value ?? i), label: String(x.program ?? x.name ?? x.label ?? "").trim() })))
        setBusinessOptions((businesses || []).map((x, i) => ({ id: String(x.id ?? x.value ?? i), label: String(x.business ?? x.name ?? x.label ?? "").trim() })))
        setKlangOptions((klangs || []).map((k) => ({ id: String(k.id ?? k.klang_id ?? ""), label: String(k.klang_name ?? k.name ?? `คลัง #${k.id ?? k.klang_id}`) })))
      } catch {
        if (!alive) return
        setProductOptions([]); setConditionOptions([]); setFieldTypeOptions([])
        setYearOptions([]); setProgramOptions([]); setBusinessOptions([]); setKlangOptions([])
      }
    }
    loadInitial()
    return () => { alive = false }
  }, [])

  /** ---------- Cascades ---------- */
  useEffect(() => {
    const pid = form.product_id
    if (!pid) {
      setSpeciesOptions([]); setVariantOptions([])
      setForm((p) => ({ ...p, species_id: "", variant_id: "" }))
      return
    }
    let alive = true
    const loadSpecies = async () => {
      try {
        const arr = (await get(`/order/species/search?product_id=${encodeURIComponent(pid)}`)) || []
        const mapped = arr
          .map((x) => ({ id: String(x.id ?? x.species_id ?? x.value ?? ""), label: String(x.species ?? x.name ?? x.label ?? "").trim() }))
          .filter((o) => o.id && o.label)
        if (!alive) return
        setSpeciesOptions(mapped)
        setVariantOptions([])
        setForm((p) => ({ ...p, species_id: "", variant_id: "" }))
      } catch {
        if (!alive) return
        setSpeciesOptions([]); setVariantOptions([])
        setForm((p) => ({ ...p, species_id: "", variant_id: "" }))
      }
    }
    loadSpecies()
    return () => { alive = false }
  }, [form.product_id])

  useEffect(() => {
    const sid = form.species_id
    if (!sid) {
      setVariantOptions([])
      setForm((p) => ({ ...p, variant_id: "" }))
      return
    }
    let alive = true
    const loadVariant = async () => {
      try {
        const arr = (await get(`/order/variant/search?species_id=${encodeURIComponent(sid)}`)) || []
        const mapped = arr
          .map((x) => ({ id: String(x.id ?? x.variant_id ?? x.value ?? ""), label: String(x.variant ?? x.name ?? x.label ?? "").trim() }))
          .filter((o) => o.id && o.label)
        if (!alive) return
        setVariantOptions(mapped)
        setForm((p) => ({ ...p, variant_id: "" }))
      } catch {
        if (!alive) return
        setVariantOptions([])
        setForm((p) => ({ ...p, variant_id: "" }))
      }
    }
    loadVariant()
    return () => { alive = false }
  }, [form.species_id])

  /** ---------- Derived ---------- */
  const pricesArr = useMemo(() => {
    const a = []
    const p1 = toNumber(form.price1)
    const p2 = toNumber(form.price2)
    if (form.price1 !== "" && p1 > 0) a.push(p1)
    if (form.price2 !== "" && p2 > 0) a.push(p2)
    return a
  }, [form.price1, form.price2])

  const totalValuation = useMemo(() => {
    const qty = toNumber(form.amount_in)
    const price = pricesArr[0] ?? 0
    return qty > 0 && price > 0 ? qty * price : 0
  }, [pricesArr, form.amount_in])

  const clearError = (key) =>
    setErrors((prev) => {
      if (!(key in prev)) return prev
      const { [key]: _omit, ...rest } = prev
      return rest
    })
  const clearHint = (key) => setMissingHints((prev) => (prev[key] ? { ...prev, [key]: false } : prev))

  /** ---------- Validate ---------- */
  const computeMissingHints = () => {
    const m = {}
    if (!form.product_id) m.product_id = true
    if (!form.species_id) m.species_id = true
    if (!form.variant_id) m.variant_id = true
    if (!form.klang_location) m.klang_location = true
    if (pricesArr.length === 0) m.prices = true
    if (form.amount_in === "" || toNumber(form.amount_in) < 0) m.amount_in = true
    return m
  }

  const validate = () => {
    const e = {}
    if (!form.product_id) e.product_id = "กรุณาเลือกประเภทสินค้า"
    if (!form.species_id) e.species_id = "กรุณาเลือกชนิดข้าว"
    if (!form.variant_id) e.variant_id = "กรุณาเลือกชั้นย่อย/สายพันธุ์"
    if (!form.klang_location) e.klang_location = "กรุณาเลือกคลังโรงสีปลายทาง"
    if (pricesArr.length === 0) e.prices = "ต้องมีราคาอย่างน้อย 1 ช่อง และมากกว่า 0"
    if (form.amount_in === "") e.amount_in = "กรุณากรอกปริมาณยกเข้า"
    else if (toNumber(form.amount_in) < 0) e.amount_in = "ปริมาณต้องไม่น้อยกว่า 0"
    setErrors(e)
    return { ok: Object.keys(e).length === 0, e }
  }

  /** ---------- Submit ---------- */
  const handleSubmit = async (e) => {
    e?.preventDefault?.()
    const hints = computeMissingHints()
    setMissingHints(hints)
    const { ok, e: ev } = validate()
    if (!ok) {
      const missingKeys = MISSING_ORDER.filter((k) => hints[k])
      if (missingKeys.length) toast.error("กรอกไม่ครบ", { description: missingDescription(missingKeys) })
      else toast.error("ข้อมูลไม่ถูกต้อง", { description: Object.values(ev)[0] })
      return
    }

    const payload = {
      spec: {
        product_id: Number(form.product_id),
        species_id: Number(form.species_id),
        variant_id: Number(form.variant_id),
        product_year: form.product_year === "" ? null : Number(form.product_year),
        condition_id: form.condition_id === "" ? null : Number(form.condition_id),
        field_type: form.field_type === "" ? null : Number(form.field_type),
        program: form.program === "" ? null : Number(form.program),
        business_type: form.business_type === "" ? null : Number(form.business_type),
      },
      klang_location: Number(form.klang_location),
      prices: pricesArr, // 1-2 รายการ, > 0
      amount_in: form.amount_in === "" ? 0 : Number(form.amount_in),
      comment: form.comment?.trim() || null,
    }

    setLoading(true)
    try {
      await post("/mill/bring-in/create", payload)
      toast.success("บันทึกยกเข้าโรงสีแล้ว", {
        description: `${nf(toNumber(form.amount_in))} กก. · ${thb(totalValuation)}`,
      })
      setForm((f) => ({ ...f, price1: "", price2: "", amount_in: "", comment: "" }))
      setErrors({})
      setMissingHints({})
    } catch (err) {
      console.error(err)
      const { title, description } = describeSaveError(err)
      toast.error(title, { description })
    } finally {
      setLoading(false)
    }
  }

  const handleReset = () =>
    setForm((f) => ({
      ...f,
      price1: "",
      price2: "",
      amount_in: "",
      comment: "",
    }))

  /** ---------- Sticky bar summary (<md) ---------- */
  const speciesLabel = speciesOptions.find((o) => String(o.id) === String(form.species_id))?.label
  const klangLabel = klangOptions.find((o) => String(o.id) === String(form.klang_location))?.label
  const barSummary = (
    <div className="min-w-0">
      <p className="truncate text-gray-900 dark:text-gray-100">
        {speciesLabel || klangLabel ? [speciesLabel, klangLabel].filter(Boolean).join(" · ") : "ยังไม่ได้เลือกสเปค"}
      </p>
      <p className="tabular-nums text-gray-500 dark:text-gray-400">
        {nf(toNumber(form.amount_in))} กก. · {thb(totalValuation)}
      </p>
    </div>
  )

  const cardSectionCls = cx(cardCls, "p-4 md:p-5 mb-4 md:mb-6")

  return (
    <div className="min-h-screen bg-white text-black dark:bg-slate-900 dark:text-white rounded-2xl text-[15px] md:text-base">
      <div className="mx-auto max-w-7xl p-4 md:p-6 lg:p-8">
        <h1 className="mb-4 flex items-center gap-2.5 text-xl md:text-3xl font-bold text-gray-900 dark:text-white">
          <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="size-6 md:size-7 text-indigo-600 dark:text-indigo-400">
            <path d="M17 18a2 2 0 0 0-2-2H9a2 2 0 0 0-2 2" />
            <path d="M3 21h18" />
            <path d="M3 7v14" />
            <path d="M21 7v14" />
            <path d="M3 7 7 3h10l4 4" />
            <path d="M3 7h18" />
            <path d="M12 11v3" />
          </svg>
          ยอดยกเข้าโรงสี (Bring In to Mill)
        </h1>

        {/* สเปคสินค้า */}
        <div className={cardSectionCls}>
          <h2 className={sectionTitleCls}>กำหนดสเปคสินค้า</h2>
          <div className="grid gap-4 md:grid-cols-3">
            <div>
              <label className={labelCls}>ประเภทสินค้า</label>
              <ComboBox
                title="ประเภทสินค้า"
                ariaLabel="ประเภทสินค้า"
                options={productOptions}
                value={form.product_id}
                getValue={getOptValue}
                onChange={(v) => { clearError("product_id"); clearHint("product_id"); update("product_id", v) }}
                error={!!errors.product_id}
                hintRed={!!missingHints.product_id}
                clearHint={() => clearHint("product_id")}
                placeholder="— เลือกประเภทสินค้า —"
              />
              {errors.product_id && <p className={errorTextCls}>{errors.product_id}</p>}
            </div>

            <div>
              <label className={labelCls}>ชนิดข้าว (Species)</label>
              <ComboBox
                title="ชนิดข้าว"
                ariaLabel="ชนิดข้าว"
                searchable
                options={speciesOptions}
                value={form.species_id}
                getValue={getOptValue}
                onChange={(v) => { clearError("species_id"); clearHint("species_id"); update("species_id", v) }}
                error={!!errors.species_id}
                hintRed={!!missingHints.species_id}
                clearHint={() => clearHint("species_id")}
                placeholder="— เลือกชนิดข้าว —"
              />
              {errors.species_id && <p className={errorTextCls}>{errors.species_id}</p>}
            </div>

            <div>
              <label className={labelCls}>ชั้นย่อย/สายพันธุ์ (Variant)</label>
              <ComboBox
                title="ชั้นย่อย/สายพันธุ์"
                ariaLabel="ชั้นย่อย/สายพันธุ์"
                searchable
                options={variantOptions}
                value={form.variant_id}
                getValue={getOptValue}
                onChange={(v) => { clearError("variant_id"); clearHint("variant_id"); update("variant_id", v) }}
                error={!!errors.variant_id}
                hintRed={!!missingHints.variant_id}
                clearHint={() => clearHint("variant_id")}
                placeholder="— เลือกชั้นย่อย —"
              />
              {errors.variant_id && <p className={errorTextCls}>{errors.variant_id}</p>}
            </div>

            <div>
              <label className={labelCls}>ปีสินค้า/ฤดูกาล</label>
              <ComboBox
                title="ปีสินค้า/ฤดูกาล"
                ariaLabel="ปีสินค้า/ฤดูกาล"
                options={yearOptions}
                value={form.product_year}
                getValue={getOptValue}
                onChange={(v) => update("product_year", v)}
                placeholder="— เลือกปี/ฤดูกาล —"
              />
              <p className={helpTextCls}>ไม่ระบุก็ได้</p>
            </div>

            <div>
              <label className={labelCls}>สภาพ/เงื่อนไข</label>
              <ComboBox
                title="สภาพ/เงื่อนไข"
                ariaLabel="สภาพ/เงื่อนไข"
                options={conditionOptions}
                value={form.condition_id}
                getValue={getOptValue}
                onChange={(v) => update("condition_id", v)}
                placeholder="— เลือกสภาพ/เงื่อนไข —"
              />
            </div>

            <div>
              <label className={labelCls}>ประเภทนา</label>
              <ComboBox
                title="ประเภทนา"
                ariaLabel="ประเภทนา"
                options={fieldTypeOptions}
                value={form.field_type}
                getValue={getOptValue}
                onChange={(v) => update("field_type", v)}
                placeholder="— เลือกประเภทนา —"
              />
            </div>

            <div>
              <label className={labelCls}>โปรแกรม</label>
              <ComboBox
                title="โปรแกรม"
                ariaLabel="โปรแกรม"
                options={programOptions}
                value={form.program}
                getValue={getOptValue}
                onChange={(v) => update("program", v)}
                placeholder="— เลือกโปรแกรม —"
              />
            </div>

            <div>
              <label className={labelCls}>ประเภทธุรกิจ</label>
              <ComboBox
                title="ประเภทธุรกิจ"
                ariaLabel="ประเภทธุรกิจ"
                options={businessOptions}
                value={form.business_type}
                getValue={getOptValue}
                onChange={(v) => update("business_type", v)}
                placeholder="— เลือกประเภทธุรกิจ —"
              />
            </div>
          </div>
        </div>

        {/* คลังโรงสีปลายทาง & ปริมาณ */}
        <div className={cardSectionCls}>
          <h2 className={sectionTitleCls}>คลังโรงสีปลายทางและปริมาณยกเข้า</h2>
          <div className="grid gap-4 md:grid-cols-3">
            <div>
              <label className={labelCls}>เลือกคลังโรงสีปลายทาง</label>
              <ComboBox
                title="คลังโรงสีปลายทาง"
                ariaLabel="คลังโรงสีปลายทาง"
                options={klangOptions}
                value={form.klang_location}
                getValue={getOptValue}
                onChange={(v) => { clearError("klang_location"); clearHint("klang_location"); update("klang_location", v) }}
                error={!!errors.klang_location}
                hintRed={!!missingHints.klang_location}
                clearHint={() => clearHint("klang_location")}
                placeholder="— เลือกคลัง —"
              />
              {errors.klang_location && <p className={errorTextCls}>{errors.klang_location}</p>}
            </div>

            <div>
              <label htmlFor="mill_amount_in" className={labelCls}>ปริมาณยกเข้า (กก.)</label>
              <input
                id="mill_amount_in"
                inputMode="decimal"
                className={cx(baseField, "tabular-nums", (errors.amount_in || missingHints.amount_in) && "border-red-500 ring-2 ring-red-300")}
                value={form.amount_in}
                onChange={(e) => update("amount_in", onlyDigits(e.target.value))}
                onFocus={() => { setErrors((p)=>({ ...p, amount_in: undefined })); clearHint("amount_in") }}
                placeholder="เช่น 12000"
                aria-invalid={errors.amount_in ? true : undefined}
              />
              {errors.amount_in && <p className={errorTextCls}>{errors.amount_in}</p>}
              <p className={helpTextCls}>ระบุได้ 0 หรือมากกว่า</p>
            </div>
          </div>
        </div>

        {/* ราคายกเข้า */}
        <div className={cardSectionCls}>
          <h2 className={sectionTitleCls}>ราคายกเข้า</h2>
          <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
            <div>
              <label htmlFor="mill_price1" className={labelCls}>ราคา 1 (บาท/กก.)</label>
              <input
                id="mill_price1"
                inputMode="decimal"
                className={cx(baseField, "tabular-nums", errors.prices && "border-red-400 ring-2 ring-red-300/70")}
                value={form.price1}
                onChange={(e) => update("price1", e.target.value.replace(/[^\d.]/g, ""))}
                onFocus={() => setErrors((p)=>({ ...p, prices: undefined }))}
                placeholder="เช่น 9.50"
              />
              <p className={helpTextCls}>ต้องกรอกอย่างน้อย 1 ช่อง</p>
            </div>

            <div>
              <label htmlFor="mill_price2" className={labelCls}>ราคา 2 (บาท/กก.)</label>
              <input
                id="mill_price2"
                inputMode="decimal"
                className={cx(baseField, "tabular-nums")}
                value={form.price2}
                onChange={(e) => update("price2", e.target.value.replace(/[^\d.]/g, ""))}
                placeholder="(เว้นว่างได้)"
              />
            </div>

            <div className="col-span-2 md:col-span-1">
              <label className={labelCls}>มูลค่าประเมินรวม</label>
              <input disabled aria-label="มูลค่าประเมินรวม" className={cx(baseField, fieldDisabled, "tabular-nums")} value={thb(totalValuation)} />
              <p className={helpTextCls}>คำนวณจาก ราคา 1 × ปริมาณ</p>
            </div>
          </div>
          {errors.prices && <p className={errorTextCls}>{errors.prices}</p>}
        </div>

        {/* บันทึกเพิ่มเติม / เหตุผล (ผู้รับ) */}
        <div className={cardSectionCls}>
          <div className="grid gap-4 md:grid-cols-3">
            <div className="md:col-span-3">
              <label htmlFor="mill_comment" className={labelCls}>บันทึกเพิ่มเติม / เหตุผล (ผู้รับ)</label>
              <input
                id="mill_comment"
                className={baseField}
                value={form.comment}
                onChange={(e) => update("comment", e.target.value)}
                placeholder="เช่น ความชื้นสูง แกลบเยอะ หรือเหตุผลการที่ปฏิเสธ"
              />
            </div>
          </div>
        </div>

        {/* ปุ่ม — <md: แถบติดล่าง (UI-SPEC §7) · ≥md: ปุ่มเดิม */}
        {isPhone ? (
          <StickyActionBar
            summary={barSummary}
            secondary={{ label: "ล้างฟอร์ม", onClick: handleReset, disabled: loading }}
            primary={{ label: loading ? "กำลังบันทึก…" : "บันทึก", onClick: handleSubmit, loading }}
          />
        ) : (
          <div className="mt-6 flex flex-col gap-3 sm:flex-row">
            <button
              type="button"
              onClick={handleSubmit}
              disabled={loading}
              className={submitBtnCls}
              aria-busy={loading ? "true" : "false"}
            >
              {loading && <span className={spinnerCls} aria-hidden="true" />}
              {loading ? "กำลังบันทึก..." : "บันทึก"}
            </button>

            <button
              type="button"
              onClick={handleReset}
              className={resetBtnCls}
            >
              รีเซ็ต
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

export default StockBringInMill
