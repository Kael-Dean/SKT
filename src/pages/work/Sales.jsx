// src/pages/work/Sales.jsx
// ─────────────────────────────────────────────────────────────────────────────
// Sales (ขายข้าว, หลายพ่วง) — CONTROLLER. Owns every piece of state, the
// effects, the refs / Enter-to-next chains, validation, the per-trailer
// `/order/customers/save/sell` loop and the payload. JSX lives in
// `./sales/*` (plan §A2): the desktop <form> composes the section components
// in the original DOM order so refs, Enter flow and aria stay identical.
// Sections receive one props-bag (`form`) — see `buildForm()` at the bottom.
// ─────────────────────────────────────────────────────────────────────────────
import { useEffect, useMemo, useRef, useState } from "react"
import { apiAuth, post } from "../../lib/api"
import {
  onlyDigits, toNumber, round2, useDebounce, isEnabledInput, useEnterNavigation,
  trailerOrder, newTrailer, deriveLockedBranch,
} from "./sales/salesShared"
import { validateAll as validateAllPure, computeMissingHints as computeMissingHintsPure } from "./sales/salesValidation"
import SalesCustomerSection from "./sales/SalesCustomerSection"
import SalesSpecSection from "./sales/SalesSpecSection"
import SalesTrailerSection from "./sales/SalesTrailerSection"
import SalesSummary, { SalesCommentField } from "./sales/SalesSummary"

// =====================================================================
//                              Sales Page (ขาย: หลายพ่วง)
// =====================================================================
// (ไฟล์นี้แก้ให้ member_id เป็นสตริงเสมอเพื่อคงเลขศูนย์นำหน้า)
function Sales() {
  // ---------- state พื้นฐาน ----------
  const [errors, setErrors] = useState({})
  const [missingHints, setMissingHints] = useState({})
  const [loadingCustomer, setLoadingCustomer] = useState(false)
  const [customerFound, setCustomerFound] = useState(null)
  const [submitting, setSubmitting] = useState(false)

  // 🔒 Kill‑switch auto-search + anti‑race (เหมือนหน้า Buy)
  const [autoSearchEnabled, setAutoSearchEnabled] = useState(true)
  const searchEpochRef = useRef(0)
  const bumpSearchEpoch = () => { searchEpochRef.current += 1 }

  // ⭐ จุดยึดบนสุด + ฟังก์ชันเลื่อนขึ้นบน (เหมือนหน้า Buy)
  const pageTopRef = useRef(null)
  const scrollToPageTop = () => {
    try { pageTopRef.current?.scrollIntoView({ block: "start", behavior: "smooth" }) } catch {}
    const root = document.scrollingElement || document.documentElement || document.body
    try { root.scrollTo({ top: 0, behavior: "smooth" }) } catch { root.scrollTop = 0 }
  }

  // ค้นหาชื่อบุคคล
  const [nameResults, setNameResults] = useState([])
  const [showNameList, setShowNameList] = useState(false)
  const nameBoxRef = useRef(null)
  const nameInputRef = useRef(null)
  const suppressNameSearchRef = useRef(false)
  const [highlightedIndex, setHighlightedIndex] = useState(-1)
  const listContainerRef = useRef(null)
  const itemRefs = useRef([])

  // 🔧 เพิ่มธงกันลูปสำหรับ citizenId และ memberId
  const suppressCitizenSearchRef = useRef(false)
  const suppressMemberSearchRef = useRef(false)

  // ค้นหาบริษัท
  const [companyResults, setCompanyResults] = useState([])
  const [showCompanyList, setShowCompanyList] = useState(false)
  const companyBoxRef = useRef(null)
  const companyInputRef = useRef(null)
  const companySuppressSearchRef = useRef(false)
  const [companyHighlighted, setCompanyHighlighted] = useState(-1)
  const companyItemRefs = useRef([])

  // dropdown opts
  const [productOptions, setProductOptions] = useState([])
  const [riceOptions, setRiceOptions] = useState([])     // species
  const [subriceOptions, setSubriceOptions] = useState([]) // variant
  const [conditionOptions, setConditionOptions] = useState([])
  const [fieldTypeOptions, setFieldTypeOptions] = useState([])
  const [yearOptions, setYearOptions] = useState([])
  const [programOptions, setProgramOptions] = useState([])
  const [paymentOptions, setPaymentOptions] = useState([])
  const [branchOptions, setBranchOptions] = useState([])
  const [klangOptions, setKlangOptions] = useState([])
  const [businessOptions, setBusinessOptions] = useState([])

  // 🔒 ล็อกสาขาตาม JWT
  const [lockedBranch, setLockedBranch] = useState(null)
  const [branchLocked, setBranchLocked] = useState(false)

  // ---------- ฟอร์มสำเร็จรูป (โหมดล็อกเหมือนหน้า Buy) ----------
  const [templateOptions, setTemplateOptions] = useState([]) // ไม่มีตัวเลือก “ฟอร์มปกติ”
  const [formTemplate, setFormTemplate] = useState("")       // ต้องเลือกเสมอ
  const [selectedTemplateLabel, setSelectedTemplateLabel] = useState("")

  /** ⭐ เก็บ label ของ variant (ชั้นย่อย) สำหรับ template */
  const [variantLookup, setVariantLookup] = useState({})
  useEffect(() => {
    const speciesIds = Array.from(
      new Set(
        (templateOptions || [])
          .map((t) => t?.spec?.species_id)
          .filter(Boolean)
          .map(String)
      )
    )
    if (speciesIds.length === 0) return
    const loadAll = async () => {
      try {
        const list = await Promise.all(
          speciesIds.map(async (sid) => {
            const arr = (await apiAuth(`/order/variant/search?species_id=${encodeURIComponent(sid)}`)) || []
            return arr.map((x) => ({
              id: String(x.id ?? x.variant_id ?? x.value ?? ""),
              label: String(x.variant ?? x.name ?? x.label ?? "").trim(),
            }))
          })
        )
        const map = {}
        list.flat().forEach(({ id, label }) => {
          if (id && label) map[id] = label
        })
        setVariantLookup(map)
      } catch (e) {
        console.error("load variants for templates error:", e)
      }
    }
    loadAll()
  }, [templateOptions])

  /** คืน sub‑label แสดงใต้ชื่อ template: “ชั้นย่อย …” */
  const templateSubLabel = (opt) => {
    const vid = String(opt?.spec?.variant_id ?? "")
    const vLabel = vid ? (variantLookup[vid] || `#${vid}`) : ""
    return vLabel ? `ชั้นย่อย: ${vLabel}` : ""
  }

  // ---------- ประเภทผู้ซื้อ ----------
  const [buyerType, setBuyerType] = useState("person")

  // ---------- ฟอร์มลูกค้า ----------
  const [customer, setCustomer] = useState({
    citizenId: "",
    memberId: "", // ⭐ เก็บเป็น string เสมอ
    fullName: "",
    houseNo: "", moo: "", subdistrict: "", district: "", province: "", postalCode: "", phone: "",
    companyName: "", taxId: "", companyPhone: "",
    hqHouseNo: "", hqMoo: "", hqSubdistrict: "", hqDistrict: "", hqProvince: "", hqPostalCode: "",
    brHouseNo: "", brMoo: "", brSubdistrict: "", brDistrict: "", brProvince: "", brPostalCode: "",
  })

  // ---------- meta ของบุคคล/ลูกค้า ----------
  const [memberMeta, setMemberMeta] = useState({ type: "unknown", assoId: null, memberId: "" }) // memberId เป็น string

  // ---------- ฟอร์มออเดอร์ (ค่าใช้ร่วม) ----------
  const [order, setOrder] = useState({
    productId: "", productName: "",
    riceId: "", riceType: "",
    subriceId: "", subriceName: "",
    conditionId: "", condition: "",
    fieldTypeId: "", fieldType: "",
    riceYearId: "", riceYear: "",
    businessTypeId: "", businessType: "",
    programId: "", programName: "",
    branchName: "", branchId: null,
    klangName: "", klangId: null,
    issueDate: new Date().toISOString().slice(0, 10),
    comment: "",
    paymentMethod: "",    // label
    paymentMethodId: "",  // id
    cashReceiptNo: "",
    creditInvoiceNo: "",
    __isCash: false,
    __isCredit: false,
  })

  // ฟอร์มเครดิต (ขายเชื่อ)
  const [dept, setDept] = useState({ allowedPeriod: 30, postpone: false, postponePeriod: 0 })

  // ---------- รถพ่วงหลายคัน ----------
  const [trailersCount, setTrailersCount] = useState(1)
  const [trailers, setTrailers] = useState([newTrailer()])
  useEffect(() => {
    setTrailers((prev) => {
      if (trailersCount <= prev.length) return prev.slice(0, trailersCount)
      const last = prev[prev.length - 1] || newTrailer()
      const more = Array.from({ length: trailersCount - prev.length }, () => ({ ...last, ...newTrailer() } ))
      return prev.concat(more)
    })
  }, [trailersCount])

  const updateTrailer = (idx, key, value) => {
    setTrailers((prev) => prev.map((t, i) => (i === idx ? { ...t, [key]: value } : t)))
  }

  // น้ำหนัก/ราคา/ยอดเงินของรถพ่วงที่กรอกไว้ (ไว้ใช้สรุปด้านล่าง)
  const trailerSummary = useMemo(() => {
    const rows = trailers.map((t, idx) => {
      const w1 = toNumber(t.frontWeightKg)
      const w2 = toNumber(t.backWeightKg)
      const u1 = toNumber(t.unitPriceFront)
      const u2 = toNumber(t.unitPriceBack)
      const g1 = toNumber(t.gramFront)
      const g2 = toNumber(t.gramBack)

      const amount1 = round2(w1 * u1)
      const amount2 = round2(w2 * u2)
      const net = w1 + w2
      const amount = amount1 + amount2
      const priceNumerator = w1 * u1 + w2 * u2
      const gramNumerator = w1 * g1 + w2 * g2
      const weightedUnit = net > 0 ? round2(priceNumerator / net) : 0
      const weightedGram = net > 0 ? Math.round(gramNumerator / net) : 0

      return {
        index: idx + 1,
        net,
        amount,
        weightedUnit,
        weightedGram,
        priceNumerator,
        gramNumerator,
        front: { weight: w1, price: u1, amount: amount1, plate: (t.licensePlateFront || "").trim() },
        back: { weight: w2, price: u2, amount: amount2, plate: (t.licensePlateBack || "").trim() },
      }
    })

    const totals = rows.reduce(
      (acc, r) => {
        acc.frontWeight += r.front.weight
        acc.backWeight += r.back.weight
        acc.net += r.net
        acc.amount += r.amount
        acc.priceNumerator += r.priceNumerator
        acc.gramNumerator += r.gramNumerator
        return acc
      },
      { frontWeight: 0, backWeight: 0, net: 0, amount: 0, priceNumerator: 0, gramNumerator: 0 }
    )

    const weightedUnitAll = totals.net > 0 ? round2(totals.priceNumerator / totals.net) : 0
    const weightedGramAll = totals.net > 0 ? Math.round(totals.gramNumerator / totals.net) : 0

    const hasData = rows.some(
      (r) =>
        r.net > 0 ||
        r.amount > 0 ||
        r.front.price > 0 ||
        r.back.price > 0 ||
        r.front.plate ||
        r.back.plate
    )

    return {
      rows,
      totals: {
        ...totals,
        weightedUnit: weightedUnitAll,
        weightedGram: weightedGramAll,
      },
      hasData,
    }
  }, [trailers])

  // ---------- Refs สำหรับนำทางด้วย Enter ----------
  const refs = {
    citizenId: useRef(null), memberId: useRef(null), fullName: useRef(null),
    houseNo: useRef(null), moo: useRef(null), subdistrict: useRef(null), district: useRef(null),
    province: useRef(null), postalCode: useRef(null), phone: useRef(null),

    companyName: useRef(null), taxId: useRef(null), companyPhone: useRef(null),
    hqHouseNo: useRef(null), hqMoo: useRef(null), hqSubdistrict: useRef(null), hqDistrict: useRef(null),
    hqProvince: useRef(null), hqPostalCode: useRef(null), brHouseNo: useRef(null), brMoo: useRef(null),
    brSubdistrict: useRef(null), brDistrict: useRef(null), brProvince: useRef(null), brPostalCode: useRef(null),

    product: useRef(null), riceType: useRef(null), subrice: useRef(null),
    condition: useRef(null), fieldType: useRef(null), riceYear: useRef(null), businessType: useRef(null),
    program: useRef(null), payment: useRef(null),
    branchName: useRef(null), klangName: useRef(null),

    issueDate: useRef(null), comment: useRef(null),
    buyerType: useRef(null),

    cashReceiptNo: useRef(null),
    creditInvoiceNo: useRef(null),

    formTemplate: useRef(null),

    deptAllowed: useRef(null),
    deptPostpone: useRef(null),
    deptPostponePeriod: useRef(null),

    trailerCount: useRef(null),

    submitBtn: useRef(null),
  }
  const submitLockRef = useRef(false)
  const { onEnter, focusNext } = useEnterNavigation(refs, buyerType, order)

  // ⭐⭐ Refs ของรถพ่วง (dynamic)
  const trailerRefs = useRef([]) // [{key: ref}]
  const getTRef = (i, key) => {
    if (!trailerRefs.current[i]) trailerRefs.current[i] = {}
    if (!trailerRefs.current[i][key]) trailerRefs.current[i][key] = { current: null }
    return trailerRefs.current[i][key]
  }
  // P6 (UI-SPEC §4.3): the phone accordion registers a callback here so a
  // collapsed trailer card is opened BEFORE we try to focus a field inside it.
  // Desktop never sets it → behaviour unchanged.
  const beforeFocusTrailerRef = useRef(null)
  const focusTrailerField = (i, key) => {
    const el = getTRef(i, key)?.current
    if (!el) return false
    beforeFocusTrailerRef.current?.(i)
    const doFocus = () => {
      try { el.scrollIntoView({ block: "center" }) } catch {}
      el.focus?.()
      try { el.select?.() } catch {}
    }
    // If the card was hidden the element has no layout yet — focus after paint.
    if (!el.offsetParent && beforeFocusTrailerRef.current) requestAnimationFrame(doFocus)
    else doFocus()
    return true
  }
  const focusFirstOfTrailer = (i = 0) => focusTrailerField(i, "scaleNoFront")
  const focusNextTrailer = (i, key) => {
    const idx = trailerOrder.indexOf(key)
    if (idx < 0) return false
    if (idx < trailerOrder.length - 1) return focusTrailerField(i, trailerOrder[idx + 1])
    if (i < trailers.length - 1) return focusFirstOfTrailer(i + 1)
    const sb = refs.submitBtn?.current
    if (sb) { try { sb.scrollIntoView({ block: "center" }) } catch {}; sb.focus?.(); return true }
    return false
  }
  const onEnterTrailer = (i, key) => (e) => {
    if (e.key === "Enter" && !e.isComposing) {
      e.preventDefault()
      focusNextTrailer(i, key)
    }
  }

  // ---------- Debounce ----------
  const debouncedCitizenId = useDebounce(customer.citizenId)
  const debouncedMemberId  = useDebounce(customer.memberId)
  const debouncedFullName  = useDebounce(customer.fullName)
  const debouncedCompanyName = useDebounce(customer.companyName)
  const debouncedTaxId = useDebounce(customer.taxId)

  // ---------- helpers ----------
  const fetchFirstOkJson = async (paths = []) => {
    for (const p of paths) {
      try {
        const data = await apiAuth(p)
        if (Array.isArray(data)) return data
        if (data && typeof data === "object") return data
      } catch (_) {}
    }
    return Array.isArray(paths) ? [] : {}
  }
  const clearError = (key) =>
    setErrors((prev) => {
      if (!(key in prev)) return prev
      const { [key]: _omit, ...rest } = prev
      return rest
    })
  const hasRed = (key) => !!errors[key] || !!missingHints[key]
  const redFieldCls = (key) => (hasRed(key) ? "border-red-500 ring-2 ring-red-300 focus:ring-0 focus:border-red-500" : "")
  const redHintCls = (key) => (missingHints[key] ? "border-red-400 ring-2 ring-red-300 focus:border-red-400 animate-pulse" : "")
  const clearHint = (key) => setMissingHints((prev) => (prev[key] ? { ...prev, [key]: false } : prev))

  // ---------- โหลด dropdown เริ่มต้น ----------
  useEffect(() => {
    const loadStaticDD = async () => {
      try {
        const [products, conditions, fields, years, programs, payments, branches, businesses] =
          await Promise.all([
            fetchFirstOkJson(["/order/product/search"]),
            fetchFirstOkJson(["/order/condition/search"]),
            fetchFirstOkJson(["/order/field/search"]),
            fetchFirstOkJson(["/order/year/search"]),
            fetchFirstOkJson(["/order/program/search"]),
            fetchFirstOkJson(["/order/payment/search/sell"]),
            fetchFirstOkJson(["/order/branch/search"]),
            fetchFirstOkJson(["/order/business/search"]),
          ])

        setProductOptions((products || []).map((x) => ({ id: String(x.id), label: String(x.product_type || "").trim() })))
        setConditionOptions((conditions || []).map((x, i) => ({ id: String(x.id ?? i), label: String(x.condition ?? "").trim() })))
        setFieldTypeOptions((fields || []).map((x, i) => ({ id: String(x.id ?? i), label: String(x.field_type ?? x.field ?? "").trim() })))
        setYearOptions((years || []).map((x, i) => ({ id: String(x.id ?? i), label: String(x.year ?? "").trim() })))
        setProgramOptions((programs || []).map((x, i) => ({ id: String(x.id ?? i), label: String(x.program ?? "").trim() })))
        setPaymentOptions((payments || []).map((x, i) => ({ id: String(x.id ?? i), label: String(x.payment ?? "").trim() })))
        setBranchOptions((branches || []).map((b) => ({ id: b.id, label: b.branch_name })))
        setBusinessOptions((businesses || []).map((x, i) => ({ id: String(x.id ?? i), label: String(x.business ?? "").trim() })))
      } catch (e) {
        console.error(e)
        setProductOptions([]); setConditionOptions([]); setFieldTypeOptions([]); setYearOptions([])
        setProgramOptions([]); setPaymentOptions([]); setBranchOptions([]); setBusinessOptions([])
      }
    }
    loadStaticDD()
  }, [])

  // ---------- species/variant ----------
  useEffect(() => {
    const pid = order.productId
    if (!pid) {
      setRiceOptions([]); setOrder((p) => ({ ...p, riceId: "", riceType: "", subriceId: "", subriceName: "" }))
      return
    }
    const loadSpecies = async () => {
      try {
        const arr = (await apiAuth(`/order/species/search?product_id=${encodeURIComponent(pid)}`)) || []
        const mapped = arr.map((x) => ({ id: String(x.id), label: String(x.species ?? "").trim() }))
        setRiceOptions(mapped)
      } catch (e) { console.error(e); setRiceOptions([]) }
    }
    loadSpecies()
  }, [order.productId])

  useEffect(() => {
    const rid = order.riceId
    if (!rid) {
      setSubriceOptions([]); setOrder((p) => ({ ...p, subriceId: "", subriceName: "" }))
      return
    }
    const loadVariant = async () => {
      try {
        const arr = (await apiAuth(`/order/variant/search?species_id=${encodeURIComponent(rid)}`)) || []
        const mapped = arr.map((x) => ({ id: String(x.id), label: String(x.variant ?? "").trim() }))
        setSubriceOptions(mapped)
      } catch (e) { console.error(e); setSubriceOptions([]) }
    }
    loadVariant()
  }, [order.riceId])

  // ---------- โหลดคลังตามสาขา ----------
  useEffect(() => {
    const bId = order.branchId
    const bName = order.branchName?.trim()
    if (bId == null && !bName) {
      setKlangOptions([]); setOrder((p) => ({ ...p, klangName: "", klangId: null }))
      return
    }
    const loadKlang = async () => {
      try {
        const qs = bId != null ? `branch_id=${bId}` : `branch_name=${encodeURIComponent(bName)}`
        const data = await apiAuth(`/order/klang/search?${qs}`)
        setKlangOptions((data || []).map((k) => ({ id: k.id, label: k.klang_name })))
      } catch (e) { console.error(e); setKlangOptions([]) }
    }
    loadKlang()
  }, [order.branchId, order.branchName])

  // ---------- โหลดรายการฟอร์มสำเร็จรูปจาก BE (ล็อกสเปก) ----------
  useEffect(() => {
    const loadForms = async () => {
      try {
        const arr = (await apiAuth("/order/form/search")) || []
        const mapped = arr
          .map((x) => ({
            id: String(x.id ?? x.value ?? ""),
            label: String(x.prod_name ?? x.name ?? x.label ?? "").trim(),
            spec: {
              product_id: x.product_id ?? null,
              species_id: x.species_id ?? null,
              variant_id: x.variant_id ?? null,
              product_year: x.product_year ?? null,
              condition_id: x.condition_id ?? null,
              field_type: x.field_type ?? null,
              program: x.program ?? null,
              business_type: x.business_type ?? null,
            },
          }))
          .filter((o) => o.id && o.label)
        setTemplateOptions(mapped)

        // ตั้งค่า template เริ่มต้น: ใช้อันที่แชร์/ที่เคยเลือก หรืออันแรก
        let nextId = ""
        try {
          const shared = localStorage.getItem("shared.formTemplate")
          if (shared) {
            const o = JSON.parse(shared)
            if (o?.id && mapped.some(m => String(m.id) === String(o.id))) nextId = String(o.id)
          }
          if (!nextId) {
            const saved = localStorage.getItem("sales.formTemplate")
            if (saved && mapped.some(m => String(m.id) === String(saved))) nextId = String(saved)
          }
        } catch {}
        if (!nextId) nextId = String(mapped[0]?.id || "")
        if (nextId) {
          setFormTemplate(nextId)
          const found = mapped.find((o) => String(o.id) === nextId)
          setSelectedTemplateLabel(found?.label || "")
          if (found?.spec) applyTemplateBySpec(found.spec)
          try {
            localStorage.setItem("shared.formTemplate", JSON.stringify({ id: nextId, label: found?.label || "" }))
            localStorage.setItem("sales.formTemplate", nextId)
          } catch {}
        }
      } catch (e) {
        console.error("load form templates error:", e)
        setTemplateOptions([])
      }
    }
    loadForms()
  }, [])

  // ---------- Template mapping (อิง spec จาก BE) ----------
  const findLabelById = (opts = [], id) => {
    const s = String(id ?? "")
    if (!s) return ""
    const f = opts.find((o) => String(o.id) === s)
    return f ? String(f.label ?? "") : ""
  }

  const applyTemplateBySpec = (spec) => {
    if (!spec) return
    const S = (v) => (v == null ? "" : String(v))
    setOrder((p) => ({
      ...p,
      productId: S(spec.product_id),
      riceId: S(spec.species_id),
      subriceId: S(spec.variant_id),
      riceYearId: S(spec.product_year),
      conditionId: S(spec.condition_id),
      fieldTypeId: S(spec.field_type),
      programId: S(spec.program),
      businessTypeId: S(spec.business_type),

      productName: "",
      riceType: "",
      subriceName: "",
      riceYear: "",
      condition: "",
      fieldType: "",
      programName: "",
      businessType: "",
    }))
  }

  // Sync id -> label เมื่อ options โหลดเสร็จ
  useEffect(() => {
    const lbl = findLabelById(productOptions, order.productId)
    if (order.productId && lbl && lbl !== order.productName) {
      setOrder((p) => ({ ...p, productName: lbl }))
    }
  }, [order.productId, productOptions])
  useEffect(() => {
    const lbl = findLabelById(riceOptions, order.riceId)
    if (order.riceId && lbl && lbl !== order.riceType) {
      setOrder((p) => ({ ...p, riceType: lbl }))
    }
  }, [order.riceId, riceOptions])
  useEffect(() => {
    const lbl = findLabelById(subriceOptions, order.subriceId)
    if (order.subriceId && lbl && lbl !== order.subriceName) {
      setOrder((p) => ({ ...p, subriceName: lbl }))
    }
  }, [order.subriceId, subriceOptions])
  useEffect(() => {
    const lbl = findLabelById(conditionOptions, order.conditionId)
    if (order.conditionId && lbl && lbl !== order.condition) {
      setOrder((p) => ({ ...p, condition: lbl }))
    }
  }, [order.conditionId, conditionOptions])
  useEffect(() => {
    const lbl = findLabelById(fieldTypeOptions, order.fieldTypeId)
    if (order.fieldTypeId && lbl && lbl !== order.fieldType) {
      setOrder((p) => ({ ...p, fieldType: lbl }))
    }
  }, [order.fieldTypeId, fieldTypeOptions])
  useEffect(() => {
    const lbl = findLabelById(yearOptions, order.riceYearId)
    if (order.riceYearId && lbl && lbl !== order.riceYear) {
      setOrder((p) => ({ ...p, riceYear: lbl }))
    }
  }, [order.riceYearId, yearOptions])
  useEffect(() => {
    const lbl = findLabelById(programOptions, order.programId)
    if (order.programId && lbl && lbl !== order.programName) {
      setOrder((p) => ({ ...p, programName: lbl }))
    }
  }, [order.programId, programOptions])
  useEffect(() => {
    const lbl = findLabelById(businessOptions, order.businessTypeId)
    if (order.businessTypeId && lbl && lbl !== order.businessType) {
      setOrder((p) => ({ ...p, businessType: lbl }))
    }
  }, [order.businessTypeId, businessOptions])

  // ---------- แชร์ template id ปัจจุบัน ----------
  useEffect(() => {
    try { if (formTemplate) localStorage.setItem("sales.formTemplate", String(formTemplate)) } catch {}
  }, [formTemplate])

  // ---------- แผงค้นหาบุคคล/บริษัท ----------
  const mapSimplePersonToUI = (r = {}) => {
    const S = (v) => (v == null ? "" : String(v))
    return {
      citizenId: S(r.citizen_id ?? r.citizenId ?? ""),
      firstName: S(r.first_name ?? r.firstName ?? ""),
      lastName:  S(r.last_name ?? r.lastName ?? ""),
      fullName: `${S(r.first_name ?? r.firstName ?? "")} ${S(r.last_name ?? r.lastName ?? "")}`.trim(),
      assoId: r.asso_id ?? r.assoId ?? null,
      type: r.type ?? "unknown",
      address: S(r.address ?? r.house_no ?? r.houseNo ?? ""),
      mhoo: S(r.mhoo ?? r.moo ?? ""),
      subdistrict: S(r.sub_district ?? r.subdistrict ?? r.subDistrict ?? ""),
      district: S(r.district ?? ""),
      province: S(r.province ?? ""),
      postalCode: onlyDigits(S(r.postal_code ?? r.postalCode ?? "")),
      phone: S(r.phone ?? r.tel ?? r.mobile ?? ""),
      // ⭐ member_id เก็บเป็น string เลขล้วนเพื่อคง 0 ด้านหน้า
      memberId: r.member_id != null ? onlyDigits(String(r.member_id)) : "",
    }
  }
  const fillFromRecord = async (raw = {}) => {
    const data = mapSimplePersonToUI(raw)
    setCustomer((prev) => ({
      ...prev,
      citizenId: onlyDigits(data.citizenId || prev.citizenId),
      fullName: data.fullName || prev.fullName,
      phone: data.phone || prev.phone,
      memberId: String(data.memberId || "") || prev.memberId,
    }))
    setMemberMeta({ type: data.type, assoId: data.assoId, memberId: data.memberId })
    setCustomerFound(true)
  }

  // 🔎 member_id (ค้นหาแบบเก็บศูนย์นำหน้าได้)
  useEffect(() => {
    if (!autoSearchEnabled) { setCustomerFound(null); return }
    if (buyerType !== "person") { setCustomerFound(null); return }
    // ถ้าเป็นอัปเดตที่มาจากการเลือกชื่อ ให้ข้าม
    if (suppressMemberSearchRef.current) {
      suppressMemberSearchRef.current = false
      return
    }
    const midStr = onlyDigits(String(debouncedMemberId || ""))
    if (!midStr) return
    const __epoch = searchEpochRef.current
    const fetchByMemberId = async () => {
      try {
        setLoadingCustomer(true)
        const arr = (await apiAuth(`/order/customers/search?q=${encodeURIComponent(String(midStr))}`)) || []
        if (__epoch !== searchEpochRef.current) return
        const exact = arr.find((r) => r.type === "member" && onlyDigits(String(r.member_id || "")) === midStr) || arr[0]
        if (exact) {
          // กันลูป: ไม่ให้ไปกระตุ้นชื่อ/บัตร ประชาชนอีก
          suppressNameSearchRef.current = true
          suppressCitizenSearchRef.current = true
          await fillFromRecord(exact)
        } else { if (__epoch !== searchEpochRef.current) return; setCustomerFound(false); setMemberMeta({ type: "customer", assoId: null, memberId: "" }) }
      } catch (e) {
        console.error(e); if (__epoch !== searchEpochRef.current) return; setCustomerFound(false); setMemberMeta({ type: "customer", assoId: null, memberId: "" })
      } finally { if (__epoch === searchEpochRef.current) setLoadingCustomer(false) }
    }
    fetchByMemberId()
  }, [debouncedMemberId, buyerType, autoSearchEnabled])

  // 🔎 citizen_id
  useEffect(() => {
    if (!autoSearchEnabled) { setCustomerFound(null); setMemberMeta({ type: "unknown", assoId: null, memberId: "" }); return }
    if (buyerType !== "person") { setCustomerFound(null); setMemberMeta({ type: "unknown", assoId: null, memberId: "" }); return }
    // ถ้าเป็นอัปเดตที่มาจากการเลือกชื่อ ให้ข้าม
    if (suppressCitizenSearchRef.current) {
      suppressCitizenSearchRef.current = false
      return
    }
    const cid = onlyDigits(debouncedCitizenId)
    if (cid.length !== 13) { setCustomerFound(null); return }
    const __epoch = searchEpochRef.current
    const fetchByCid = async () => {
      try {
        setLoadingCustomer(true)
        const arr = (await apiAuth(`/order/customers/search?q=${encodeURIComponent(cid)}`)) || []
        if (__epoch !== searchEpochRef.current) return
        const exact = arr.find((r) => onlyDigits(r.citizen_id || r.citizenId || "") === cid) || arr[0]
        if (exact) {
          // กันลูป: ไม่ให้ไปกระตุ้นชื่อ/member_id อีก
          suppressNameSearchRef.current = true
          suppressMemberSearchRef.current = true
          await fillFromRecord(exact)
        }
        else { if (__epoch !== searchEpochRef.current) return; setCustomerFound(false); setMemberMeta({ type: "customer", assoId: null, memberId: "" }) }
      } catch (e) {
        console.error(e); if (__epoch !== searchEpochRef.current) return; setCustomerFound(false); setMemberMeta({ type: "customer", assoId: null, memberId: "" })
      } finally { if (__epoch === searchEpochRef.current) setLoadingCustomer(false) }
    }
    fetchByCid()
  }, [debouncedCitizenId, buyerType, autoSearchEnabled])

  // 🔎 ค้นหาด้วยชื่อ
  useEffect(() => {
    if (!autoSearchEnabled) { setShowNameList(false); setNameResults([]); setHighlightedIndex(-1); return }
    if (buyerType !== "person") {
      setShowNameList(false); setNameResults([]); setHighlightedIndex(-1); setMemberMeta({ type: "unknown", assoId: null, memberId: "" })
      return
    }
    const q = (debouncedFullName || "").trim()
    if (suppressNameSearchRef.current) {
      suppressNameSearchRef.current = false; setShowNameList(false); setNameResults([]); setHighlightedIndex(-1); return
    }
    if (q.length < 2) { setNameResults([]); setShowNameList(false); setHighlightedIndex(-1); return }
    const __epoch = searchEpochRef.current
    const searchByName = async () => {
      try {
        setLoadingCustomer(true)
        const items = (await apiAuth(`/order/customers/search?q=${encodeURIComponent(q)}`)) || []
        if (__epoch !== searchEpochRef.current) return
        const mapped = items.map((r) => ({
          ...r,
          asso_id: r.asso_id, member_id: r.member_id,
          citizen_id: r.citizen_id, first_name: r.first_name, last_name: r.last_name,
        }))
        setNameResults(mapped)
        if (document.activeElement === nameInputRef.current) {
          if (__epoch !== searchEpochRef.current) return
          setShowNameList(true); setHighlightedIndex(mapped.length > 0 ? 0 : -1)
        }
      } catch (e) {
        console.error(e); setNameResults([]); setShowNameList(false); setHighlightedIndex(-1)
      } finally { if (__epoch === searchEpochRef.current) setLoadingCustomer(false) }
    }
    searchByName()
  }, [debouncedFullName, buyerType, autoSearchEnabled])

  useEffect(() => {
    const onClick = (e) => {
      if (!nameBoxRef.current) return
      if (!nameBoxRef.current.contains(e.target)) { setShowNameList(false); setHighlightedIndex(-1) }
    }
    document.addEventListener("click", onClick)
    return () => document.removeEventListener("click", onClick)
  }, [])
  const scrollHighlightedIntoView2 = (index) => {
    const itemEl = itemRefs.current[index]
    const listEl = listContainerRef.current
    if (!itemEl || !listEl) return
    try { itemEl.scrollIntoView({ block: "nearest", inline: "nearest" }) } catch {}
  }
  const pickNameResult = async (rec) => {
    // กันลูป: เลือกจากชื่อแล้วจะไม่ไปค้นต่อด้วย citizen/member
    suppressNameSearchRef.current = true
    suppressCitizenSearchRef.current = true
    suppressMemberSearchRef.current = true
    await fillFromRecord(rec)
    setShowNameList(false); setNameResults([]); setHighlightedIndex(-1)
  }

  // ⭐ ปรับ Enter บนลิสต์ชื่อ → ไป "ประเภทสินค้า"
  const handleNameKeyDown = async (e) => {
    if (!showNameList || nameResults.length === 0) return
    if (e.key === "ArrowDown") {
      e.preventDefault()
      const next = highlightedIndex < nameResults.length - 1 ? highlightedIndex + 1 : 0
      setHighlightedIndex(next); requestAnimationFrame(() => scrollHighlightedIntoView2(next))
    } else if (e.key === "ArrowUp") {
      e.preventDefault()
      const prev = highlightedIndex > 0 ? highlightedIndex - 1 : nameResults.length - 1
      setHighlightedIndex(prev); requestAnimationFrame(() => scrollHighlightedIntoView2(prev))
    } else if (e.key === "Enter") {
      e.preventDefault()
      if (highlightedIndex >= 0 && highlightedIndex < nameResults.length) {
        await pickNameResult(nameResults[highlightedIndex])
        requestAnimationFrame(() => {
          const el = refs.product?.current
          if (el && isEnabledInput(el)) {
            try { el.scrollIntoView({ block: "center" }) } catch {}
            el.focus?.()
          }
        })
      }
    } else if (e.key === "Escape") {
      e.preventDefault(); setShowNameList(false); setHighlightedIndex(-1)
    }
  }

  // ---------- บริษัท ----------
  useEffect(() => {
    const onClick = (e) => {
      if (!companyBoxRef.current) return
      if (!companyBoxRef.current.contains(e.target)) { setShowCompanyList(false); setCompanyHighlighted(-1) }
    }
    document.addEventListener("click", onClick)
    return () => document.removeEventListener("click", onClick)
  }, [])
  const mapCompanyToUI = (r = {}) => {
    const S = (v) => (v == null ? "" : String(v))
    return {
      assoId: r.asso_id ?? r.assoId ?? null,
      companyName: S(r.company_name ?? r.companyName ?? ""), taxId: onlyDigits(S(r.tax_id ?? r.taxId ?? "")),
      phone: S(r.phone_number ?? r.phone ?? ""),
      hqHouseNo: S(r.hq_address ?? r.hqAddress ?? ""), hqMoo: S(r.hq_moo ?? r.hqMoo ?? ""),
      hqSubdistrict: S(r.hq_tambon ?? r.hqSubdistrict ?? ""), hqDistrict: S(r.hq_amphur ?? r.hqDistrict ?? ""),
      hqProvince: S(r.hq_province ?? r.hqProvince ?? ""), hqPostalCode: onlyDigits(S(r.hq_postal_code ?? r.hqPostalCode ?? "")),
      brHouseNo: S(r.branch_address ?? r.branchAddress ?? ""), brMoo: S(r.branch_moo ?? r.branchMoo ?? ""),
      brSubdistrict: S(r.branch_tambon ?? r.brSubdistrict ?? ""), brDistrict: S(r.branch_amphur ?? r.brDistrict ?? ""),
      brProvince: S(r.branch_province ?? r.brProvince ?? ""), brPostalCode: onlyDigits(S(r.branch_postal_code ?? r.brPostalCode ?? "")),
    }
  }
  const pickCompanyResult = async (rec) => {
    companySuppressSearchRef.current = true
    const data = mapCompanyToUI(rec)
    setCustomer((prev) => ({
      ...prev,
      companyName: data.companyName || prev.companyName,
      taxId: data.taxId || prev.taxId, companyPhone: data.phone || prev.companyPhone,
      hqHouseNo: data.hqHouseNo || prev.hqHouseNo, hqMoo: data.hqMoo || prev.hqMoo,
      hqSubdistrict: data.hqSubdistrict || prev.hqSubdistrict, hqDistrict: data.hqDistrict || prev.hqDistrict,
      hqProvince: data.hqProvince || prev.hqProvince, hqPostalCode: data.hqPostalCode || prev.hqPostalCode,
      brHouseNo: data.brHouseNo || prev.brHouseNo, brMoo: data.brMoo || prev.brMoo,
      brSubdistrict: data.brSubdistrict || prev.brSubdistrict, brDistrict: data.brDistrict || prev.brDistrict,
      brProvince: data.brProvince || prev.brProvince, brPostalCode: data.brPostalCode || prev.brPostalCode,
    }))
    setMemberMeta({ type: "company", assoId: data.assoId ?? null, memberId: "" })
    setShowCompanyList(false); setCompanyResults([]); setCompanyHighlighted(-1)
  }
  useEffect(() => {
    if (!autoSearchEnabled) { setShowCompanyList(false); setCompanyResults([]); setCompanyHighlighted(-1); return }
    if (buyerType !== "company") { setShowCompanyList(false); setCompanyResults([]); setCompanyHighlighted(-1); return }
    const q = (debouncedCompanyName || "").trim()
    if (companySuppressSearchRef.current) {
      companySuppressSearchRef.current = false; setShowCompanyList(false); setCompanyResults([]); setCompanyHighlighted(-1); return
    }
    if (q.length < 2) { setCompanyResults([]); setShowCompanyList(false); setCompanyHighlighted(-1); return }
    const __epoch = searchEpochRef.current
    const searchCompany = async () => {
      try {
        setLoadingCustomer(true)
        const items = (await apiAuth(`/order/companies/search?q=${encodeURIComponent(q)}`)) || []
        if (__epoch !== searchEpochRef.current) return
        setCompanyResults(items)
        if (document.activeElement === companyInputRef.current) {
          if (__epoch !== searchEpochRef.current) return
          setShowCompanyList(true); setCompanyHighlighted(items.length > 0 ? 0 : -1)
        }
      } catch (err) {
        console.error(err); setCompanyResults([]); setShowCompanyList(false); setCompanyHighlighted(-1)
      } finally {
        if (__epoch === searchEpochRef.current) setLoadingCustomer(false)
      }
    }
    searchCompany()
  }, [debouncedCompanyName, buyerType, autoSearchEnabled])
  useEffect(() => {
    if (!autoSearchEnabled) return
    if (buyerType !== "company") return
    const tid = onlyDigits(debouncedTaxId)
    if (tid.length !== 13) return
    const __epoch = searchEpochRef.current
    const searchByTax = async () => {
      try {
        setLoadingCustomer(true)
        const items = (await apiAuth(`/order/companies/search?q=${encodeURIComponent(tid)}`)) || []
        if (__epoch !== searchEpochRef.current) return
        if (items.length > 0) await pickCompanyResult(items[0])
      } catch (e) { console.error(e) } finally { if (__epoch === searchEpochRef.current) setLoadingCustomer(false) }
    }
    searchByTax()
  }, [debouncedTaxId, buyerType, autoSearchEnabled])
  const handleCompanyKeyDown = async (e) => {
    if (!showCompanyList || companyResults.length === 0) return
    if (e.key === "ArrowDown") { e.preventDefault(); const next = companyHighlighted < companyResults.length - 1 ? companyHighlighted + 1 : 0; setCompanyHighlighted(next); requestAnimationFrame(() => { try { companyItemRefs.current[next]?.scrollIntoView({ block: "nearest" }) } catch {} }) }
    else if (e.key === "ArrowUp") { e.preventDefault(); const prev = companyHighlighted > 0 ? companyHighlighted - 1 : companyResults.length - 1; setCompanyHighlighted(prev); requestAnimationFrame(() => { try { companyItemRefs.current[prev]?.scrollIntoView({ block: "nearest" }) } catch {} }) }
    else if (e.key === "Enter") { e.preventDefault(); if (companyHighlighted >= 0 && companyHighlighted < companyResults.length) await pickCompanyResult(companyResults[companyHighlighted]) }
    else if (e.key === "Escape") { e.preventDefault(); setShowCompanyList(false); setCompanyHighlighted(-1) }
  }

  // ---------- อัปเดต state ----------
  const updateCustomer = (k, v) => {
    setAutoSearchEnabled(true)
    if (String(v).trim() !== "") clearHint(k)
    setCustomer((p) => ({ ...p, [k]: v }))
  }
  const updateOrder = (k, v) => { if (String(v).trim() !== "") clearHint(k); setOrder((p) => ({ ...p, [k]: v })) }

  // ---------- Payment resolver ----------
  const resolvePaymentId = () => {
    if (/^\d+$/.test(String(order.paymentMethodId || ""))) return Number(order.paymentMethodId)
    const label = (order.paymentMethod || "").trim()
    if (label) {
      const found = paymentOptions.find((o) => (o.label || "").trim() === label)
      if (found && /^\d+$/.test(String(found.id))) return Number(found.id)
    }
    if (/^\d+$/.test(String(order.paymentMethod || ""))) return Number(order.paymentMethod)
    return null
  }
  const isCreditPayment = () => {
    const pid = resolvePaymentId()
    const label = (order.paymentMethod || "").trim() || (paymentOptions.find((o) => Number(o.id) === Number(pid))?.label || "").trim()
    const s = label.toLowerCase()
    return s.includes("ค้าง") || s.includes("เครดิต") || s.includes("credit") || s.includes("เชื่อ") || s.includes("ติด")
  }
  const resolvePaymentIdForBE = () => (isCreditPayment() ? 2 : 1)
  useEffect(() => {
    const credit = isCreditPayment()
    setOrder((p) => ({ ...p, __isCredit: credit, __isCash: !credit }))
  }, [order.paymentMethod, paymentOptions])

  // ---------- Validate + hint ----------
  // Validators are pure (sales/salesValidation.js); this wraps them with the
  // live state so call-sites read exactly like before.
  const validationCtx = () => ({ buyerType, customer, memberMeta, order, trailers, paymentId: resolvePaymentId() })
  const computeMissingHints = () => computeMissingHintsPure(validationCtx())
  const validateAll = () => {
    const e = validateAllPure(validationCtx())
    setErrors(e)
    return e
  }

  const scrollToFirstError = (eObj) => {
    const personKeys = ["memberId", "fullName"]
    const companyKeys = ["companyName", "taxId"]
    const commonOrderKeys = ["product","riceType","subrice","condition","fieldType","riceYear","businessType","branchName","klangName","payment","issueDate"]
    const keys = (buyerType === "person" ? personKeys : companyKeys).concat(commonOrderKeys)
    const firstKey = keys.find((k) => k in eObj)
    if (firstKey) {
      const el = refs[firstKey]?.current || (firstKey === "payment" ? refs.payment?.current : null)
      if (el && typeof el.focus === "function") { try { el.scrollIntoView({ behavior: "smooth", block: "center" }) } catch {} el.focus() }
      return
    }
    const tmp = document.getElementById("trailers-block")
    if (tmp) { try { tmp.scrollIntoView({ behavior: "smooth", block: "center" }) } catch {} }
  }

  const scrollToFirstMissing = (hintsObj) => {
    const personKeys = ["memberId","fullName"]
    const companyKeys = ["companyName","taxId"]
    const commonOrderKeys = ["product","riceType","subrice","condition","fieldType","riceYear","businessType","branchName","klangName","payment","issueDate"]
    const keys = (buyerType === "person" ? personKeys : companyKeys).concat(commonOrderKeys)
    const firstKey = keys.find((k) => hintsObj[k])
    if (!firstKey) return
    const el = refs[firstKey]?.current || (firstKey === "payment" ? refs.payment?.current : null)
    if (el && typeof el.focus === "function") {
      try { el.focus({ preventScroll: true }) } catch { el.focus() }
      try { el.select?.() } catch {}
    }
  }

  // ---------- Branch lock (หลังโหลดรายการสาขา) ----------
  useEffect(() => {
    if (!branchOptions?.length) return
    const b = deriveLockedBranch(branchOptions)
    if (b) {
      setLockedBranch(b)
      setBranchLocked(true)
      setOrder((p) => ({ ...p, branchId: b.id, branchName: b.label, klangName: "", klangId: null }))
    } else {
      setLockedBranch(null)
      setBranchLocked(false)
    }
  }, [branchOptions])

  // ---------- Submit ----------
  const toIsoDateTime = (yyyyMmDd) => {
    try { return new Date(`${yyyyMmDd}T12:00:00Z`).toISOString() } catch { return new Date().toISOString() }
  }

  const handleReset = () => {
    // ปิด auto-search ชั่วคราว + ยกเลิกผล async ค้าง
    setAutoSearchEnabled(false)
    bumpSearchEpoch()

    setErrors({}); setMissingHints({})
    setCustomer({
      citizenId: "", memberId: "", fullName: "", houseNo: "", moo: "", subdistrict: "", district: "", province: "", postalCode: "", phone: "",
      companyName: "", taxId: "", companyPhone: "",
      hqHouseNo: "", hqMoo: "", hqSubdistrict: "", hqDistrict: "", hqProvince: "", hqPostalCode: "",
      brHouseNo: "", brMoo: "", brSubdistrict: "", brDistrict: "", brProvince: "", brPostalCode: "",
    })
    setMemberMeta({ type: "unknown", assoId: null, memberId: "" })
    setOrder((prev) => ({
      productId: prev.productId, productName: prev.productName,
      riceId: prev.riceId, riceType: prev.riceType,
      subriceId: prev.subriceId, subriceName: prev.subriceName,
      conditionId: prev.conditionId, condition: prev.condition,
      fieldTypeId: prev.fieldTypeId, fieldType: prev.fieldType,
      riceYearId: prev.riceYearId, riceYear: prev.riceYear,
      businessTypeId: prev.businessTypeId, businessType: prev.businessType,
      programId: prev.programId, programName: prev.programName,
      // คงสาขาที่ล็อกไว้ (ถ้ามี)
      branchName: branchLocked ? (lockedBranch?.label || prev.branchName) : prev.branchName,
      branchId: branchLocked ? (lockedBranch?.id ?? prev.branchId) : prev.branchId,
      klangName: "", klangId: null,
      issueDate: prev.issueDate, comment: "",
      paymentMethod: "", paymentMethodId: "",
      cashReceiptNo: "", creditInvoiceNo: "",
      __isCash: false, __isCredit: false,
    }))
    // ❌ ไม่ล้าง klangOptions เพื่อให้เลือกต่อได้ทันที
    setRiceOptions([]); setSubriceOptions([])
    setBuyerType("person")
    setDept({ allowedPeriod: 30, postpone: false, postponePeriod: 0 })
    setTrailersCount(1)
    setTrailers([newTrailer()])
    setShowNameList(false); setNameResults([]); setHighlightedIndex(-1)
    setShowCompanyList(false); setCompanyResults([]); setCompanyHighlighted(-1)
    try { refs.buyerType?.current?.focus() } catch {}
    requestAnimationFrame(() => scrollToPageTop())
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (submitLockRef.current || submitting) { return }
    submitLockRef.current = true
    setSubmitting(true)
    try {
      scrollToPageTop()
      setAutoSearchEnabled(false)
      bumpSearchEpoch()

      const hints = computeMissingHints()
      setMissingHints(hints)
      const eObj = validateAll()

      if (Object.keys(eObj).length > 0) {
        alert("❌❌❌❌❌❌❌❌❌ บันทึกไม่สำเร็จ ❌❌❌❌❌❌❌❌❌\n\n                   รบกวนกรอกข้อมูลที่จำเป็นให้ครบในช่องที่มีกรอบสีแดง")
        scrollToFirstError(eObj)
        return
      }
      if (Object.values(hints).some(Boolean)) {
        alert("❌❌❌❌❌❌❌❌❌ บันทึกไม่สำเร็จ ❌❌❌❌❌❌❌❌❌\n\n                   รบกวนกรอกข้อมูลที่จำเป็นให้ครบในช่องที่มีกรอบสีแดง")
        scrollToFirstMissing(hints)
        return
      }

      const [firstName, ...rest] = (customer.fullName || "").trim().split(" ")
      const lastName = rest.join(" ")

      const productId = /^\d+$/.test(order.productId) ? Number(order.productId) : null
      const riceId = /^\d+$/.test(order.riceId) ? Number(order.riceId) : null
      const subriceId = /^\d+$/.test(order.subriceId) ? Number(order.subriceId) : null
      const b = lockedBranch || deriveLockedBranch(branchOptions)
      const branchId = b ? Number(b.id) : (order.branchId != null ? Number(order.branchId) : null)
      const klangId = order.klangId != null ? Number(order.klangId) : null
      const riceYearId = /^\d+$/.test(order.riceYearId) ? Number(order.riceYearId) : null
      const conditionId = /^\d+$/.test(order.conditionId) ? Number(order.conditionId) : null
      const fieldTypeId = /^\d+$/.test(order.fieldTypeId) ? Number(order.fieldTypeId) : null
      const businessTypeId = /^\d+$/.test(order.businessTypeId) ? Number(order.businessTypeId) : null
      const programId = /^\d+$/.test(order.programId) ? Number(order.programId) : null
      const paymentId = resolvePaymentIdForBE()

      // customer payload
      let customerPayload
      if (buyerType === "person") {
        const memberIdStr = onlyDigits(String(customer.memberId || ""))
        const assoIdVal = memberMeta.assoId || null

        if (!memberIdStr && !assoIdVal) {
          alert("กรุณาระบุรหัสสมาชิก (member_id) หรือเลือกบุคคลที่มี asso_id จากผลค้นหา")
          return
        }

        customerPayload = memberIdStr
          ? {
              party_type: "individual",
              member_id: memberIdStr,   // ⭐ ส่งเป็น string 000123 ได้
              first_name: firstName || "",
              last_name: lastName || "",
            }
          : {
              party_type: "individual",
              asso_id: assoIdVal,
              first_name: firstName || "",
              last_name: lastName || "",
            }
      } else {
        const taxId = onlyDigits(customer.taxId)
        customerPayload = taxId
          ? { party_type: "company", tax_id: taxId, company_name: customer.companyName || undefined }
          : memberMeta.assoId
          ? { party_type: "company", asso_id: memberMeta.assoId, company_name: customer.companyName || undefined }
          : { party_type: "company", tax_id: "" }
      }

      // spec สำหรับ BE (ตาม ProductSpecIn)
      const spec = {
        product_id: productId,
        species_id: riceId,
        variant_id: subriceId,
        product_year: riceYearId ?? null,
        condition_id: conditionId ?? null,
        field_type: fieldTypeId ?? null,
        program: programId ?? null,
        business_type: businessTypeId ?? null,
      }

      const dateISO = toIsoDateTime(order.issueDate)
      const saleId = ((order.__isCredit ? order.creditInvoiceNo : order.cashReceiptNo) || "").trim() || null

      // ส่งทีละคัน
      let ok = 0
      const results = []
      for (let i = 0; i < trailers.length; i++) {
        const t = trailers[i]
        const w1 = toNumber(t.frontWeightKg)
        const w2 = toNumber(t.backWeightKg)
        const u1 = toNumber(t.unitPriceFront)
        const u2 = toNumber(t.unitPriceBack)
        const g1 = toNumber(t.gramFront)
        const g2 = toNumber(t.gramBack)

        const price1 = round2(w1 * u1)
        const price2 = round2(w2 * u2)

        // gram เฉลี่ยถ่วงน้ำหนักต่อคัน (ส่งให้ BE)
        const net = w1 + w2
        const weightedGram = net > 0 ? Math.round((w1 * g1 + w2 * g2) / net) : (g1 || g2 || 0)

        // ✅ ตาม BE ใหม่: แยกราคา/กก. พ่วงหน้า-พ่วงหลัง
        const pricePerKilo1 = u1
        const pricePerKilo2 = w2 > 0 ? u2 : null

        const payload = {
          customer: customerPayload,
          order: {
            sale_id: saleId,
            payment_id: paymentId,
            spec,
            license_plate_1: (t.licensePlateFront || "").trim() || null,
            license_plate_2: (t.licensePlateBack || "").trim() || null,
            weight_1: w1,
            weight_2: w2 || 0,
            gram: weightedGram,
            price_per_kilo: pricePerKilo1,
            price_per_kilo2: pricePerKilo2,
            price_1: price1,
            price_2: price2 || 0,
            order_serial_1: (t.scaleNoFront || "").trim() || null,
            order_serial_2: (t.scaleNoBack || "").trim() || null,
            date: dateISO,
            branch_location: branchId,
            klang_location: klangId,
            comment: order.comment?.trim() ? `${order.comment.trim()} (พ่วงที่ ${i + 1})` : null,
          },
          // dept แนบเสมอ (ใช้เมื่อ payment_id == 2)
          dept: { date_created: dateISO, allowed_period: Number(dept.allowedPeriod || 0), postpone: Boolean(dept.postpone), postpone_period: Number(dept.postpone ? (dept.postponePeriod || 0) : 0) },
        }

        try {
          const r = await post("/order/customers/save/sell", payload)
          ok += 1
          results.push({ index: i + 1, success: true, id: r?.order_id })
        } catch (err) {
          console.error("SAVE ERROR (trailer", i + 1, "):", err?.data || err)
          results.push({ index: i + 1, success: false, message: err?.message || "เกิดข้อผิดพลาด", detail: err?.data?.detail })
        }
      }

      const failed = results.filter((x) => !x.success)
      if (failed.length === 0) {
        try {
          const currentTpl = templateOptions.find((o) => String(o.id) === String(formTemplate))
          const saveTpl = { id: String(formTemplate), label: currentTpl?.label || selectedTemplateLabel || "" }
          localStorage.setItem("shared.formTemplate", JSON.stringify(saveTpl))
          localStorage.setItem("sales.formTemplate", String(formTemplate))
        } catch {}
        alert("✅✅✅✅✅✅✅✅ บันทึกออเดอร์เรียบร้อย ✅✅✅✅✅✅✅✅")
        handleReset()
        requestAnimationFrame(() => scrollToPageTop())
        try { refs.submitBtn?.current?.blur?.() } catch {}
      } else {
        const summary = failed
          .map((f) => `• คันที่ ${f.index}: ${f.message}${f.detail ? `\nรายละเอียด: ${JSON.stringify(f.detail)}` : ""}`)
          .join("\n\n")
        alert(`❌❌❌❌❌❌❌❌❌ บันทึกไม่สำเร็จ ❌❌❌❌❌❌❌❌❌

บันทึกสำเร็จ ${ok}/${trailers.length} รายการ

รายการที่ผิดพลาด:
${summary}`)
      }
    } finally {
      submitLockRef.current = false
      setSubmitting(false)
    }
  }

  // ---------------- UI ----------------
  const handleFullNameKeyDown = (e) => {
    if (showNameList && nameResults.length > 0) {
      return handleNameKeyDown(e)
    }
    if (e.key === "Enter" && !e.isComposing) {
      e.preventDefault()
      const el = refs.product?.current
      if (el && isEnabledInput(el)) {
        try { el.scrollIntoView({ block: "center" }) } catch {}
        el.focus?.()
        try { el.select?.() } catch {}
        return
      }
      focusNext("fullName")
    }
  }

  // Props-bag handed to every section (plan §A2). One object, passed by
  // reference — sections destructure what they need.
  const form = {
    // state
    errors, missingHints, loadingCustomer, customerFound, submitting,
    buyerType, setBuyerType, customer, memberMeta, order, setOrder, dept, setDept,
    trailersCount, setTrailersCount, trailers, trailerSummary,
    templateOptions, formTemplate, setFormTemplate, selectedTemplateLabel, setSelectedTemplateLabel, templateSubLabel, applyTemplateBySpec,
    productOptions, riceOptions, subriceOptions, conditionOptions, fieldTypeOptions, yearOptions, programOptions,
    paymentOptions, branchOptions, klangOptions, businessOptions, branchLocked, lockedBranch,
    // refs + focus chains
    refs, pageTopRef, getTRef, focusTrailerField, focusFirstOfTrailer, focusNextTrailer, onEnterTrailer, onEnter, focusNext,
    beforeFocusTrailerRef,
    // search panels
    nameBoxRef, nameInputRef, listContainerRef, itemRefs, showNameList, setShowNameList, nameResults, highlightedIndex, setHighlightedIndex,
    pickNameResult, scrollHighlightedIntoView2, handleFullNameKeyDown,
    companyBoxRef, companyInputRef, companyItemRefs, showCompanyList, setShowCompanyList, companyResults, companyHighlighted, setCompanyHighlighted,
    pickCompanyResult, handleCompanyKeyDown,
    // handlers
    updateCustomer, updateOrder, updateTrailer, clearError, clearHint, hasRed, redFieldCls, redHintCls,
    isCreditPayment, resolvePaymentId, handleSubmit, handleReset, scrollToPageTop,
  }

  return (
    <div className="min-h-screen bg-white text-black dark:bg-slate-900 dark:text-white rounded-2xl text-[15px] md:text-base">
      <div className="mx-auto max-w-7xl p-5 md:p-6 lg:p-8">
        {/* จุดยึดสำหรับเลื่อนขึ้นบนสุด (ให้เหมือน Buy) */}
        <div ref={pageTopRef} />

        <h1 className="mb-4 text-3xl font-bold text-gray-900 dark:text-white">🧾 บันทึกออเดอร์ขาย (หลายพ่วง)</h1>

        {/* กล่องข้อมูลลูกค้า */}
        <SalesCustomerSection form={form} />

        {/* ฟอร์มออเดอร์ */}
        <form onSubmit={handleSubmit} onKeyDown={(e)=>{ if(submitting && e.key==="Enter"){ e.preventDefault() } }} className="rounded-2xl border border-slate-200 bg-white p-5 text-black shadow-sm dark:border-slate-700 dark:bg-slate-800 dark:text-white">
          <h2 className="mb-3 text-xl font-semibold">รายละเอียดการขาย</h2>

          {/* สเปค (ล็อกจากฟอร์ม) + สาขา/คลัง */}
          <SalesSpecSection form={form} />

          {/* รถพ่วงหลายคัน */}
          <SalesTrailerSection form={form} />

          {/* หมายเหตุ */}
          <SalesCommentField form={form} />

          {/* สรุปสั้น ๆ + ตารางพ่วง + รวมเงิน */}
          <SalesSummary form={form} />

          {/* ปุ่มบันทึก/รีเซ็ต */}
          <div className="mt-8 flex flex-wrap items-center gap-3">
            <button
              ref={refs.submitBtn}
              type="submit" disabled={submitting} aria-busy={submitting}
              className="inline-flex items-center justify-center rounded-2xl
                bg-emerald-600 px-6 py-3 text-base font-semibold text-white
                shadow-[0_6px_16px_rgba(16,185,129,0.35)]
                transition-all duration-300 ease-out
                hover:bg-emerald-700 hover:shadow-[0_8px_20px_rgba(16,185,129,0.45)]
                hover:scale-[1.05] active:scale-[.97] cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {submitting ? (
                <span className="inline-flex items-center gap-2">
                  <svg viewBox="0 0 24 24" width="18" height="18" className="animate-spin">
                    <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" opacity="0.25"></circle>
                    <path d="M12 2a10 10 0 0 1 10 10" stroke="currentColor" strokeWidth="4" fill="none"></path>
                  </svg>
                  กำลังบันทึก...
                </span>
              ) : (
                <>บันทึก</>
              )}
            </button>
            <button
              type="button"
              onClick={handleReset}
              className="inline-flex items-center justify-center rounded-2xl
                border border-slate-300 bg-white px-6 py-3 text-base font-medium
                text-slate-700 dark:text-white
                shadow-sm
                transition-all duration-300 ease-out
                hover:bg-slate-100 hover:shadow-md hover:scale-[1.03]
                active:scale-[.97]
                dark:border-slate-600 dark:bg-slate-700/60
                dark:hover:bg-slate-700/50 dark:hover:shadow-lg cursor-pointer"
            >
              รีเซ็ต
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

export default Sales
