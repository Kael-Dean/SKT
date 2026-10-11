// src/pages/work/Buy.jsx
// ─────────────────────────────────────────────────────────────────────────────
// บันทึกออเดอร์ซื้อข้าวเปลือก — CONTROLLER (plan §A2).
// This file owns every piece of state, every effect, the refs map, validation,
// handleSubmit / handleReset and the payload. The JSX lives in ./buy/*:
//   BuyCustomerSection · BuySpecSection · BuyWeighSection · BuySummary
// Sections receive one props-bag `form` (built at the bottom of this file).
// Desktop (≥md) renders the same 3-card <form> as before, node for node, so the
// Enter-to-next flow (useEnterNavigation in ./buy/buyShared.js) is unchanged.
// ─────────────────────────────────────────────────────────────────────────────
import { useEffect, useMemo, useRef, useState } from "react"
import { apiAuth, post } from "../../lib/api" // ✅ helper แนบโทเคนอัตโนมัติ
import { cx, baseField, labelCls, helpTextCls } from "../../lib/styles"
import {
  onlyDigits,
  toNumber,
  findLabelById,
  useDebounce,
  moneyToNumber,
  formatMoneyInput,
  suggestDeductionWeight,
  isEnabledInput,
  useEnterNavigation,
  deriveLockedBranch,
  ERROR_SCAN_ORDER,
} from "./buy/buyShared"
import { validateAllErrors } from "./buy/buyValidation"
import BuyCustomerSection from "./buy/BuyCustomerSection"
import BuySpecSection from "./buy/BuySpecSection"
import BuyWeighSection from "./buy/BuyWeighSection"
import BuySummary from "./buy/BuySummary"

/** ---------- Component ---------- */
const Buy = () => {
  // --- FIX: force re-load warehouses (คลัง) even when branchId stays the same ---
  async function forceKlangLoad(branchId, branchName) {
    const bId = branchId ?? null
    const bName = String(branchName ?? "").trim()
    if (bId == null && !bName) {
      setKlangOptions([])
      setOrder((p) => ({ ...p, klangName: "", klangId: null }))
      return
    }
    try {
      const qs = bId != null ? `branch_id=${bId}` : `branch_name=${encodeURIComponent(bName)}`
      const data = await apiAuth(`/order/klang/search?${qs}`)
      setKlangOptions((data || []).map((k) => ({ id: k.id, label: k.klang_name })))
    } catch (e) {
      console.error("Load klang error:", e)
      setKlangOptions([])
    }
  }

  const [loadingCustomer, setLoadingCustomer] = useState(false)
  const [customerFound, setCustomerFound] = useState(null)
  const [errors, setErrors] = useState({})
  const [missingHints, setMissingHints] = useState({})
  const [nameResults, setNameResults] = useState([])
  const [showNameList, setShowNameList] = useState(false)

  // ▼ บริษัท
  const [companyResults, setCompanyResults] = useState([])
  const [showCompanyList, setShowCompanyList] = useState(false)
  const companyBoxRef = useRef(null)
  const companyInputRef = useRef(null)
  const companySuppressSearchRef = useRef(false)
  const [companyHighlighted, setCompanyHighlighted] = useState(-1)
  const companyItemRefs = useRef([])

  const nameBoxRef = useRef(null)
  const nameInputRef = useRef(null)
  const suppressNameSearchRef = useRef(false)

  const [highlightedIndex, setHighlightedIndex] = useState(-1)
  const listContainerRef = useRef(null)
  const itemRefs = useRef([])

  /** dropdown opts */
  const [productOptions, setProductOptions] = useState([])
  const [riceOptions, setRiceOptions] = useState([]) // species
  const [subriceOptions, setSubriceOptions] = useState([]) // variant
  const [branchOptions, setBranchOptions] = useState([])
  const [klangOptions, setKlangOptions] = useState([])
  const [conditionOptions, setConditionOptions] = useState([])
  const [fieldTypeOptions, setFieldTypeOptions] = useState([])
  const [yearOptions, setYearOptions] = useState([])
  const [programOptions, setProgramOptions] = useState([])
  const [paymentOptions, setPaymentOptions] = useState([])
  const [businessOptions, setBusinessOptions] = useState([])

  // ใช้บังคับให้โหลดคลังใหม่ (กันกรณี branchId เท่าเดิม)
/** ▶︎ ฟอร์มสำเร็จรูป (Template) — โหลดจาก BE */
  // 🔒 โหมดล็อกสเปก: ใช้ฟอร์มสำเร็จรูปเท่านั้น
  const LOCK_SPEC = true

  // ไม่มีตัวเลือก “ไม่ล็อก” อีกต่อไป
  const [templateOptions, setTemplateOptions] = useState([])
  const [formTemplate, setFormTemplate] = useState("") // ต้องเลือกเสมอ
  const [selectedTemplateLabel, setSelectedTemplateLabel] = useState("") // เก็บ label ที่เลือกไว้
  const [pendingTemplateLabel, setPendingTemplateLabel] = useState("") // ใช้ดักเติม species หลังโหลด riceOptions
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

    const fetchAll = async () => {
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
    fetchAll()
  }, [templateOptions])

  /** คืนข้อความบรรทัดย่อยของ template: “ชั้นย่อย …” */
  const templateSubLabel = (opt) => {
    const vid = String(opt?.spec?.variant_id ?? "")
    const vLabel = vid ? (variantLookup[vid] || `#${vid}`) : ""
    return vLabel ? `ชั้นย่อย: ${vLabel}` : ""
  }

  /** ⭐ ประเภทผู้ซื้อ */
  const buyerTypeOptions = [
    { id: "person", label: "บุคคลธรรมดา" },
    { id: "company", label: "บริษัท / นิติบุคคล" },
  ]
  const [buyerType, setBuyerType] = useState("person")

  /** ▼ Kill‑switch: ปิดการค้นหา/ออโต้ฟิลอัตโนมัติหลังบันทึก/รีเซ็ต จนกว่าจะพิมพ์ใหม่ */
  const [autoSearchEnabled, setAutoSearchEnabled] = useState(true)

  // 🔒 กันกดบันทึกซ้ำ
  const [submitting, setSubmitting] = useState(false)

  /** ฟอร์มลูกค้า */
  const [customer, setCustomer] = useState({
    // บุคคลธรรมดา
    citizenId: "",
    memberId: "",
    fullName: "",
    houseNo: "",
    moo: "",
    subdistrict: "",
    district: "",
    province: "",
    postalCode: "",
    phone: "",

    // CCD (ซ่อน UI)
    fid: "",
    fidOwner: "",
    fidRelationship: "",

    // บริษัท / นิติบุคคล
    companyName: "",
    taxId: "",
    companyPhone: "",
    // HQ
    hqHouseNo: "",
    hqMoo: "",
    hqSubdistrict: "",
    hqDistrict: "",
    hqProvince: "",
    hqPostalCode: "",
    // Branch (optional)
    brHouseNo: "",
    brMoo: "",
    brSubdistrict: "",
    brDistrict: "",
    brProvince: "",
    brPostalCode: "",
  })

  /** เมตาสมาชิก/ลูกค้า */
  const [memberMeta, setMemberMeta] = useState({
    type: "unknown",
    assoId: null,
    memberId: null,
  })

  /** ฟอร์มออเดอร์ */
  const [order, setOrder] = useState({
    productId: "",
    productName: "",
    riceId: "",
    riceType: "",
    subriceId: "",
    subriceName: "",
    gram: "",
    riceYear: "",
    riceYearId: "",
    condition: "",
    conditionId: "",
    fieldType: "",
    fieldTypeId: "",
    programId: "",
    programName: "",
    paymentMethod: "",
    paymentMethodId: "",
    businessType: "",
    businessTypeId: "",
    entryWeightKg: "",
    exitWeightKg: "",
    moisturePct: "",
    impurityPct: "",
    manualDeduct: false,
    deductWeightKg: "",
    unitPrice: "",
    amountTHB: "",
    paymentRefNo: "",
    issueDate: new Date().toISOString().slice(0, 10),
    branchName: "",
    branchId: null,
    klangName: "",
    klangId: null,
    registeredPlace: "",
    comment: "",
  })

  /** ───── Dept (ใหม่) ───── */
  const [dept, setDept] = useState({
    allowedPeriod: 30,
    postpone: false,
    postponePeriod: 0,
  })
  const updateDept = (k, v) => setDept((p) => ({ ...p, [k]: v }))

  /** ---------- Refs ---------- */
  const refs = {
    // บุคคล
    citizenId: useRef(null),
    memberId: useRef(null),
    fullName: useRef(null),
    houseNo: useRef(null),
    moo: useRef(null),
    subdistrict: useRef(null),
    district: useRef(null),
    province: useRef(null),
    postalCode: useRef(null),
    phone: useRef(null),

    // CCD
    fid: useRef(null),
    fidOwner: useRef(null),
    fidRelationship: useRef(null),

    // บริษัท
    companyName: useRef(null),
    taxId: useRef(null),
    companyPhone: useRef(null),
    hqHouseNo: useRef(null),
    hqMoo: useRef(null),
    hqSubdistrict: useRef(null),
    hqDistrict: useRef(null),
    hqProvince: useRef(null),
    hqPostalCode: useRef(null),
    brHouseNo: useRef(null),
    brMoo: useRef(null),
    brSubdistrict: useRef(null),
    brDistrict: useRef(null),
    brProvince: useRef(null),
    brPostalCode: useRef(null),

    // ออเดอร์
    product: useRef(null),
    riceType: useRef(null),
    subrice: useRef(null),
    condition: useRef(null),
    fieldType: useRef(null),
    riceYear: useRef(null),
    program: useRef(null),
    payment: useRef(null),
    branchName: useRef(null),
    klangName: useRef(null),
    entryWeightKg: useRef(null),
    exitWeightKg: useRef(null),
    moisturePct: useRef(null),
    impurityPct: useRef(null),
    deductWeightKg: useRef(null),
    unitPrice: useRef(null),
    amountTHB: useRef(null),
    paymentRefNo: useRef(null),
    issueDate: useRef(null),
    gram: useRef(null),
    comment: useRef(null),
    businessType: useRef(null),

    formTemplate: useRef(null),
    buyerType: useRef(null),

    // --- Dept (credit) ---
    deptAllowed: useRef(null),
    deptPostpone: useRef(null),
    deptPostponePeriod: useRef(null),

    // ✅ ปุ่มบันทึกออเดอร์
    submitBtn: useRef(null),
  }

  

  // 🔒 กันกดซ้ำในระดับ micro (setState ยังไม่ทัน)
  const submitLockRef = useRef(false)
const { onEnter, focusNext } = useEnterNavigation(refs, buyerType, order)

  /** ▼ จุดยึดบนสุด */
  const pageTopRef = useRef(null)
  /** ========= anti-race สำหรับผลลัพธ์ async ที่ค้าง ========= */
  const searchEpochRef = useRef(0)
  const bumpSearchEpoch = () => { searchEpochRef.current += 1 }

  /** โหลด Template ล่าสุด (จาก shared หรือของหน้า buy) */
  useEffect(() => {
    try {
      const shared = localStorage.getItem("shared.formTemplate")
      if (shared) {
        const o = JSON.parse(shared)
        if (o?.id) {
          setFormTemplate(String(o.id))
          setSelectedTemplateLabel(o.label || "")
          return
        }
      }
      const saved = localStorage.getItem("buy.formTemplate")
      if (saved) setFormTemplate(saved)
    } catch (_e) {}
  }, [])

  /** scrollToTop */
  const scrollToPageTop = () => {
    try { pageTopRef.current?.scrollIntoView({ block: "start", behavior: "smooth" }) } catch (_e) {}
    const root = document.scrollingElement || document.documentElement || document.body
    try { root.scrollTo({ top: 0, behavior: "smooth" }) } catch { root.scrollTop = 0 }
  }

  /** debounce */
  const debouncedCitizenId = useDebounce(customer.citizenId)
  const debouncedMemberId = useDebounce(customer.memberId)
  const debouncedFullName = useDebounce(customer.fullName)
  const debouncedCompanyName = useDebounce(customer.companyName)
  const debouncedTaxId = useDebounce(customer.taxId)

  /** helper: เรียกหลาย endpoint จนกว่าจะเจอ */
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

  /** 🔎 ดึงที่อยู่+ข้อมูลบุคคลจาก citizen_id */
  const loadAddressByCitizenId = async (cid) => {
    if (!autoSearchEnabled) return
    const __epoch = searchEpochRef.current
    const q = encodeURIComponent(onlyDigits(cid))
    const candidates = [
      `/order/customer/detail?citizen_id=${q}`,
      `/order/customers/detail?citizen_id=${q}`,
      `/customer/detail?citizen_id=${q}`,
      `/customers/detail?citizen_id=${q}`,
      `/member/detail?citizen_id=${q}`,
      `/order/customers/search?q=${q}`,
    ]
    const data = await fetchFirstOkJson(candidates)
    if (__epoch !== searchEpochRef.current) return

    const toStr = (v) => (v == null ? "" : String(v))
    const addr = {
      houseNo: toStr(data.address ?? data.house_no ?? data.houseNo ?? ""),
      moo: toStr(data.mhoo ?? data.moo ?? ""),
      subdistrict: toStr(data.sub_district ?? data.subdistrict ?? data.subDistrict ?? ""),
      district: toStr(data.district ?? ""),
      province: toStr(data.province ?? ""),
      postalCode: onlyDigits(toStr(data.postal_code ?? data.postalCode ?? "")),

      firstName: toStr(data.first_name ?? data.firstName ?? ""),
      lastName: toStr(data.last_name ?? data.lastName ?? ""),
      type: data.type ?? undefined,
      asso_id: data.asso_id ?? data.assoId ?? undefined,

      phone: toStr(data.phone ?? data.tel ?? data.mobile ?? ""),
      fid: toStr(data.fid ?? ""),
      fidOwner: toStr(data.fid_owner ?? data.fidowner ?? ""),
      fidRelationship: toStr(data.fid_relationship ?? data.fidreationship ?? data.fid_rel ?? ""),
      member_id: data.member_id ?? null,
    }

    const hasAnyAddress =
      addr.houseNo || addr.moo || addr.subdistrict || addr.district || addr.province || addr.postalCode

    if (
      addr.firstName ||
      addr.lastName ||
      hasAnyAddress ||
      addr.phone ||
      addr.fid ||
      addr.fidOwner ||
      addr.fidRelationship
    ) {
      if (__epoch !== searchEpochRef.current) return
      setCustomer((prev) => ({
        ...prev,
        fullName:
          addr.firstName || addr.lastName
            ? `${addr.firstName} ${addr.lastName}`.trim() || prev.fullName
            : prev.fullName,
        houseNo: addr.houseNo || prev.houseNo,
        moo: addr.moo || prev.moo,
        subdistrict: addr.subdistrict || prev.subdistrict,
        district: addr.district || prev.district,
        province: addr.province || prev.province,
        postalCode: addr.postalCode || prev.postalCode,

        phone: addr.phone || prev.phone,
        fid: addr.fid || prev.fid,
        fidOwner: addr.fidOwner || prev.fidOwner,
        fidRelationship: addr.fidRelationship || prev.fidRelationship,
      }))
      if (addr.type) setMemberMeta((m) => ({ ...m, type: addr.type }))
      if (addr.asso_id) setMemberMeta((m) => ({ ...m, assoId: addr.asso_id }))
      if (addr.member_id != null) setMemberMeta((m) => ({ ...m, memberId: String(addr.member_id) }))
    }
  }

  const mapCompanyToUI = (r = {}) => {
    const S = (v) => (v == null ? "" : String(v))
    return {
      assoId: r.asso_id ?? r.assoId ?? null,
      companyName: S(r.company_name ?? r.companyName ?? ""),
      taxId: onlyDigits(S(r.tax_id ?? r.taxId ?? "")),
      phone: S(r.phone_number ?? r.phone ?? ""),

      // HQ
      hqHouseNo: S(r.hq_address ?? r.hqAddress ?? ""),
      hqMoo: S(r.hq_moo ?? r.hqMoo ?? ""),
      hqSubdistrict: S(r.hq_tambon ?? r.hqSubdistrict ?? ""),
      hqDistrict: S(r.hq_amphur ?? r.hqDistrict ?? ""),
      hqProvince: S(r.hq_province ?? r.hqProvince ?? ""),
      hqPostalCode: onlyDigits(S(r.hq_postal_code ?? r.hqPostalCode ?? "")),

      // Branch (optional)
      brHouseNo: S(r.branch_address ?? r.branchAddress ?? ""),
      brMoo: S(r.branch_moo ?? r.branchMoo ?? ""),
      brSubdistrict: S(r.branch_tambon ?? r.brSubdistrict ?? ""),
      brDistrict: S(r.branch_amphur ?? r.brDistrict ?? ""),
      brProvince: S(r.branch_province ?? r.brProvince ?? ""),
      brPostalCode: onlyDigits(S(r.branch_postal_code ?? r.brPostalCode ?? "")),
    }
  }

  const pickCompanyResult = async (rec) => {
    companySuppressSearchRef.current = true
    const data = mapCompanyToUI(rec)
    setCustomer((prev) => ({
      ...prev,
      companyName: data.companyName || prev.companyName,
      taxId: data.taxId || prev.taxId,
      companyPhone: data.phone || prev.companyPhone,
      hqHouseNo: data.hqHouseNo || prev.hqHouseNo,
      hqMoo: data.hqMoo || prev.hqMoo,
      hqSubdistrict: data.hqSubdistrict || prev.hqSubdistrict,
      hqDistrict: data.hqDistrict || prev.hqDistrict,
      hqProvince: data.hqProvince || prev.hqProvince,
      hqPostalCode: data.hqPostalCode || prev.hqPostalCode,
      brHouseNo: data.brHouseNo || prev.brHouseNo,
      brMoo: data.brMoo || prev.brMoo,
      brSubdistrict: data.brSubdistrict || prev.brSubdistrict,
      brDistrict: data.brDistrict || prev.brDistrict,
      brProvince: data.brProvince || prev.brProvince,
      brPostalCode: data.brPostalCode || prev.brPostalCode,
    }))
    setMemberMeta({ type: "company", assoId: data.assoId ?? null, memberId: null })
    setShowCompanyList(false)
    setCompanyResults([])
    setCompanyHighlighted(-1)
  }

  /** โหลด dropdown ชุดแรก + branch */
  useEffect(() => {
    const loadStaticDD = async () => {
      try {
        const [products, conditions, fields, years, programs, payments, branches, businesses] =
          await Promise.all([
            fetchFirstOkJson(["/order/product/search"]),
            fetchFirstOkJson(["/order/condition/search"]),
            fetchFirstOkJson(["/order/field/search", "/order/field_type/list", "/order/field-type/list"]),
            fetchFirstOkJson(["/order/year/search"]),
            fetchFirstOkJson(["/order/program/search"]),
            fetchFirstOkJson(["/order/payment/search/buy"]),
            fetchFirstOkJson(["/order/branch/search"]),
            fetchFirstOkJson(["/order/business/search"]),
          ])

        setProductOptions(
          (products || [])
            .map((x) => ({
              id: String(x.id ?? x.product_id ?? x.value ?? ""),
              label: String(x.product_type ?? x.name ?? x.label ?? "").trim(),
            }))
            .filter((o) => o.id && o.label)
        )

        setConditionOptions(
          (conditions || [])
            .map((x, i) => ({
              id: String(x.id ?? x.value ?? i),
              label: String(x.condition ?? x.year ?? x.name ?? x.label ?? "").trim(),
            }))
            .filter((o) => o.id && o.label)
        )

        setFieldTypeOptions(
          (fields || [])
            .map((x, i) => ({
              id: String(x.id ?? x.value ?? i),
              label: String(
                x.field ?? x.field_type ?? x.name ?? x.year ?? x.label ?? (typeof x === "string" ? x : "")
              ).trim(),
            }))
            .filter((o) => o.id && o.label)
        )

        setYearOptions(
          (years || [])
            .map((x, i) => ({
              id: String(x.id ?? x.value ?? i),
              label: String(x.year ?? x.name ?? x.label ?? "").trim(),
            }))
            .filter((o) => o.id && o.label)
        )

        setProgramOptions(
          (programs || [])
            .map((x, i) => ({
              id: String(x.id ?? x.value ?? i),
              label: String(x.program ?? x.year ?? x.name ?? x.label ?? "").trim(),
            }))
            .filter((o) => o.id && o.label)
        )

        setPaymentOptions(
          (payments || [])
            .map((x, i) => ({
              id: String(x.id ?? x.value ?? i),
              label: String(x.payment ?? x.name ?? x.label ?? "").trim(),
            }))
            .filter((o) => o.id && o.label)
        )

        setBranchOptions((branches || []).map((b) => ({ id: b.id, label: b.branch_name })))

        setBusinessOptions(
          (businesses || [])
            .map((x, i) => ({
              id: String(x.id ?? x.value ?? i),
              label: String(x.business ?? x.name ?? x.label ?? "").trim(),
            }))
            .filter((o) => o.id && o.label)
        )
      } catch (err) {
        console.error("loadStaticDD fatal:", err)
        setProductOptions([])
        setConditionOptions([])
        setFieldTypeOptions([])
        setYearOptions([])
        setProgramOptions([])
        setPaymentOptions([])
        setBranchOptions([])
        setBusinessOptions([])
      }
    }
    loadStaticDD()
  }, [])

  /** 🔄 โหลดรายการฟอร์มสำเร็จรูปจาก BE (โหมดบังคับใช้ template เท่านั้น) */
  useEffect(() => {
    const loadForms = async () => {
      try {
        const arr = (await apiAuth("/order/form/search")) || []
        const mapped = arr 
          .map((x) => ({ 
            id: String(x.id ?? x.value ?? ""), 
            label: String(x.prod_name ?? x.name ?? x.label ?? "").trim(), 
            // ⭐ เก็บ spec ทั้งชุดจาก BE เพื่อยิงใส่ฟอร์มตรง ๆ 
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

        // ตั้งค่า template เริ่มต้น: ใช้อันที่เซฟไว้ หรืออันแรก
        let nextId = ""
        try {
          const shared = localStorage.getItem("shared.formTemplate")
          if (shared) {
            const o = JSON.parse(shared)
            if (o?.id && mapped.some(m => String(m.id) === String(o.id))) nextId = String(o.id)
          }
          if (!nextId) {
            const saved = localStorage.getItem("buy.formTemplate")
            if (saved && mapped.some(m => String(m.id) === String(saved))) nextId = String(saved)
          }
        } catch (_e) {}
        if (!nextId) nextId = String(mapped[0]?.id || "")

        if (nextId) {
          setFormTemplate(nextId)
          const found = mapped.find((o) => String(o.id) === nextId)
          setSelectedTemplateLabel(found?.label || "")
          if (found?.spec) applyTemplateBySpec(found.spec)
          try {
            localStorage.setItem("shared.formTemplate", JSON.stringify({ id: nextId, label: found?.label || "" }))
            localStorage.setItem("buy.formTemplate", nextId)
          } catch (_e) {}
        }
      } catch (e) {
        console.error("load form templates error:", e)
        setTemplateOptions([])
      }
    }
    loadForms()
  }, [])

  // 🔒 สาขาที่ล็อกจากสิทธิ์ผู้ใช้
  const [lockedBranch, setLockedBranch] = useState(null)
  const [branchLocked, setBranchLocked] = useState(false)

  /** 🔒 ล็อกสาขาตาม username ใน JWT (แข็งแรง) */
  useEffect(() => {
    if (!branchOptions?.length) return
    const b = deriveLockedBranch(branchOptions)
    if (b) {
      setLockedBranch(b)
      setBranchLocked(true)
      setOrder((p) => ({
        ...p,
        branchId: b.id,
        branchName: b.label,
        klangName: "",
        klangId: null,
      }))
    } else {
      setLockedBranch(null)
      setBranchLocked(false)
    }
  }, [branchOptions])

  // ใช้ซ้ำเพื่อย้ำล็อกเวลารีเซ็ต
  const enforceBranchLock = () => {
    const b = lockedBranch || deriveLockedBranch(branchOptions)
    if (!b) { setBranchLocked(false); return null }
    setBranchLocked(true)
    setOrder((p) => ({ ...p, branchId: b.id, branchName: b.label, klangName: "", klangId: null }))
    setKlangReloadKey((n) => n + 1) // ⟳ บังคับให้โหลดคลัง
    return b
  }

// ปิด dropdown บริษัทเมื่อคลิกนอก
  useEffect(() => {
    const onClick = (e) => {
      if (!companyBoxRef.current) return
      if (!companyBoxRef.current.contains(e.target)) {
        setShowCompanyList(false)
        setCompanyHighlighted(-1)
      }
    }
    document.addEventListener("click", onClick)
    return () => document.removeEventListener("click", onClick)
  }, [])

  // trigger ค้นหาจากชื่อบริษัท
  useEffect(() => {
    if (!autoSearchEnabled) { setShowCompanyList(false); setCompanyResults([]); setCompanyHighlighted(-1); return }
    if (buyerType !== "company") {
      setShowCompanyList(false)
      setCompanyResults([])
      setCompanyHighlighted(-1)
      return
    }

    const q = (debouncedCompanyName || "").trim()
    if (companySuppressSearchRef.current) {
      companySuppressSearchRef.current = false
      setShowCompanyList(false)
      setCompanyResults([])
      setCompanyHighlighted(-1)
      return
    }
    if (q.length < 2) {
      setCompanyResults([])
      setShowCompanyList(false)
      setCompanyHighlighted(-1)
      return
    }

    const searchCompany = async () => {
      const __epoch = searchEpochRef.current
      try {
        setLoadingCustomer(true)
        const items = (await apiAuth(`/order/companies/search?q=${encodeURIComponent(q)}`)) || []
        if (__epoch !== searchEpochRef.current) return
        setCompanyResults(items)
        if (document.activeElement === companyInputRef.current) {
          if (__epoch !== searchEpochRef.current) return
          setShowCompanyList(true)
          if (__epoch !== searchEpochRef.current) return
          setCompanyHighlighted(items.length > 0 ? 0 : -1)
        }
      } catch (err) {
        console.error(err)
        setCompanyResults([])
        setShowCompanyList(false)
        setCompanyHighlighted(-1)
      } finally {
        setLoadingCustomer(false)
      }
    }
    searchCompany()
  }, [debouncedCompanyName, buyerType, autoSearchEnabled])

  // ค้นหาจากเลขภาษี
  useEffect(() => {
    if (!autoSearchEnabled) return
    if (buyerType !== "company") return
    const tid = onlyDigits(debouncedTaxId)
    if (tid.length !== 13) return
    const searchByTax = async () => {
      const __epoch = searchEpochRef.current
      try {
        setLoadingCustomer(true)
        const items = (await apiAuth(`/order/companies/search?q=${encodeURIComponent(tid)}`)) || []
        if (items.length > 0) {
          if (__epoch !== searchEpochRef.current) return
          await pickCompanyResult(items[0]) // auto-fill เมื่อภาษีตรง
        }
      } catch (e) {
        console.error(e)
      } finally {
        setLoadingCustomer(false)
      }
    }
    searchByTax()
  }, [debouncedTaxId, buyerType, autoSearchEnabled])

  // คีย์บอร์ดนำทางลิสต์บริษัท
  const handleCompanyKeyDown = async (e) => {
    if (!showCompanyList || companyResults.length === 0) return
    if (e.key === "ArrowDown") {
      e.preventDefault()
      const next = companyHighlighted < companyResults.length - 1 ? companyHighlighted + 1 : 0
      setCompanyHighlighted(next)
      requestAnimationFrame(() => {
        const el = companyItemRefs.current[next]
        try { el?.scrollIntoView({ block: "nearest" }) } catch (_e) {}
      })
    } else if (e.key === "ArrowUp") {
      e.preventDefault()
      const prev = companyHighlighted > 0 ? companyHighlighted - 1 : companyResults.length - 1
      setCompanyHighlighted(prev)
      requestAnimationFrame(() => {
        const el = companyItemRefs.current[prev]
        try { el?.scrollIntoView({ block: "nearest" }) } catch (_e) {}
      })
    } else if (e.key === "Enter") {
      e.preventDefault()
      if (companyHighlighted >= 0 && companyHighlighted < companyResults.length) {
        await pickCompanyResult(companyResults[companyHighlighted])
      }
    } else if (e.key === "Escape") {
      e.preventDefault()
      setShowCompanyList(false)
      setCompanyHighlighted(-1)
    }
  }

  /** เมื่อเลือก product → โหลด species */
  useEffect(() => {
    const pid = order.productId
    if (!pid) {
      setRiceOptions([])
      setOrder((p) => ({ ...p, riceId: "", riceType: "", subriceId: "", subriceName: "" }))
      return
    }

    const loadSpecies = async () => {
      try {
        const arr = (await apiAuth(`/order/species/search?product_id=${encodeURIComponent(pid)}`)) || []
        const mapped = arr
          .map((x) => ({
            id: String(x.id ?? x.species_id ?? x.value ?? ""),
            label: String(x.species ?? x.name ?? x.label ?? "").trim(),
          }))
          .filter((o) => o.id && o.label)
        setRiceOptions(mapped)
      } catch (e) {
        console.error("load species error:", e)
        setRiceOptions([])
      }
    }
    loadSpecies()
  }, [order.productId])

  /** เมื่อเลือก species → โหลด variant */
  useEffect(() => {
    const rid = order.riceId
    if (!rid) {
      setSubriceOptions([])
      setOrder((p) => ({ ...p, subriceId: "", subriceName: "" }))
      return
    }
    const loadVariant = async () => {
      try {
        const arr = (await apiAuth(`/order/variant/search?species_id=${encodeURIComponent(rid)}`)) || []
        const mapped = arr
          .map((x) => ({
            id: String(x.id ?? x.variant_id ?? x.value ?? ""),
            label: String(x.variant ?? x.name ?? x.label ?? "").trim(),
          }))
          .filter((o) => o.id && o.label)
        setSubriceOptions(mapped)
      } catch (e) {
        console.error("load variant error:", e)
        setSubriceOptions([])
      }
    }
    loadVariant()
  }, [order.riceId])

  /** โหลดคลังตามสาขา */
  useEffect(() => {
    const bId = order.branchId
    const bName = order.branchName?.trim()
    if (bId == null && !bName) {
      setKlangOptions([])
      setOrder((p) => ({ ...p, klangName: "", klangId: null }))
      return
    }
    const loadKlang = async () => {
      try {
        const qs = bId != null ? `branch_id=${bId}` : `branch_name=${encodeURIComponent(bName)}`
        const data = await apiAuth(`/order/klang/search?${qs}`)
        setKlangOptions((data || []).map((k) => ({ id: k.id, label: k.klang_name })))
      } catch (e) {
        console.error("Load klang error:", e)
        setKlangOptions([])
      }
    }
    loadKlang()
  }, [order.branchId, order.branchName])

  /** map record -> UI (เฉพาะบุคคล) */
  const mapSimplePersonToUI = (r = {}) => {
    const toStr = (v) => (v == null ? "" : String(v))
    return {
      citizenId: toStr(r.citizen_id ?? r.citizenId ?? ""),
      firstName: toStr(r.first_name ?? r.firstName ?? ""),
      lastName: toStr(r.last_name ?? r.lastName ?? ""),
      fullName: `${toStr(r.first_name ?? r.firstName ?? "")} ${toStr(r.last_name ?? r.lastName ?? "")}`.trim(),
      assoId: r.asso_id ?? r.assoId ?? null,
      type: r.type ?? "unknown",
      houseNo: toStr(r.address ?? r.house_no ?? r.houseNo ?? ""),
      moo: toStr(r.mhoo ?? r.moo ?? ""),
      subdistrict: toStr(r.sub_district ?? r.subdistrict ?? r.subDistrict ?? ""),
      district: toStr(r.district ?? ""),
      province: toStr(r.province ?? ""),
      postalCode: onlyDigits(toStr(r.postal_code ?? r.postalCode ?? "")),

      phone: toStr(r.phone ?? r.tel ?? r.mobile ?? ""),
      fid: toStr(r.fid ?? ""),
      fidOwner: toStr(r.fid_owner ?? r.fidowner ?? ""),
      fidRelationship: toStr(r.fid_relationship ?? r.fidreationship ?? r.fid_rel ?? ""),
      memberId: r.member_id != null ? String(r.member_id) : null,
    }
  }

  /** เติมจากเรคอร์ด (เฉพาะบุคคล) */
  const fillFromRecord = async (raw = {}) => {
    if (!autoSearchEnabled) return
    const __epoch = searchEpochRef.current
    const data = mapSimplePersonToUI(raw)
    if (__epoch !== searchEpochRef.current) return
    setCustomer((prev) => ({
      ...prev,
      citizenId: onlyDigits(data.citizenId || prev.citizenId),
      fullName: data.fullName || prev.fullName,

      phone: data.phone || prev.phone,
      fid: data.fid || prev.fid,
      fidOwner: data.fidOwner || prev.fidOwner,
      fidRelationship: data.fidRelationship || prev.fidRelationship,
      memberId: data.memberId != null ? data.memberId : prev.memberId,
    }))
    if (__epoch !== searchEpochRef.current) return
    setMemberMeta({ type: data.type, assoId: data.assoId, memberId: data.memberId })
    setCustomerFound(true)

    const hasAnyAddr =
      data.houseNo || data.moo || data.subdistrict || data.district || data.province || data.postalCode

    if (hasAnyAddr) {
      setCustomer((prev) => ({
        ...prev,
        houseNo: data.houseNo || prev.houseNo,
        moo: data.moo || prev.moo,
        subdistrict: data.subdistrict || prev.subdistrict,
        district: data.district || prev.district,
        province: data.province || prev.province,
        postalCode: data.postalCode || prev.postalCode,
      }))
      return
    }

    const cid = onlyDigits(data.citizenId)
    if (cid.length === 13) {
      await loadAddressByCitizenId(cid)
    }
  }

  /** ค้นหาด้วย member_id — ใช้เป็นหลักสำหรับบุคคล */
  useEffect(() => {
    if (!autoSearchEnabled) return
    if (buyerType !== "person") {
      setCustomerFound(null)
      return
    }
    const mid = String(debouncedMemberId || "").trim()
if (!mid) return
    const fetchByMemberId = async () => {
      const __epoch = searchEpochRef.current
      try {
        setLoadingCustomer(true)
        const arr = (await apiAuth(`/order/customers/search?q=${encodeURIComponent(String(mid))}`)) || []
        const exact = arr.find((r) => r.type === "member" && String(r.member_id) === mid) || arr[0]
        if (exact) {
          if (__epoch !== searchEpochRef.current) return
          await fillFromRecord(exact)
        } else {
          if (__epoch !== searchEpochRef.current) return
          setCustomerFound(false)
          if (__epoch !== searchEpochRef.current) return
          setMemberMeta({ type: "customer", assoId: null, memberId: null })
        }
      } catch (e) {
        console.error(e)
        if (__epoch !== searchEpochRef.current) return
        setCustomerFound(false)
        if (__epoch !== searchEpochRef.current) return
        setMemberMeta({ type: "customer", assoId: null, memberId: null })
      } finally {
        setLoadingCustomer(false)
      }
    }
    fetchByMemberId()
  }, [debouncedMemberId, buyerType, autoSearchEnabled])

  /** ค้นหาด้วยเลขบัตร — คงไว้เพื่อเติมข้อมูล/ที่อยู่ */
  useEffect(() => {
    if (!autoSearchEnabled) return
    if (buyerType !== "person") {
      setCustomerFound(null)
      setMemberMeta({ type: "unknown", assoId: null, memberId: null })
      return
    }
    const cid = onlyDigits(debouncedCitizenId)
    if (memberMeta.memberId || memberMeta.assoId) return
    if (/^0{13}$/.test(cid)) { setCustomerFound(null); return }
    if (cid.length !== 13) {
      setCustomerFound(null)
      return
    }
    const fetchByCid = async () => {
      const __epoch = searchEpochRef.current
      try {
        setLoadingCustomer(true)
        const arr = (await apiAuth(`/order/customers/search?q=${encodeURIComponent(cid)}`)) || []
        const exact = arr.find((r) => onlyDigits(r.citizen_id || r.citizenId || "") === cid) || arr[0]
        if (exact) {
          if (__epoch !== searchEpochRef.current) return
          await fillFromRecord(exact)
        } else {
          if (__epoch !== searchEpochRef.current) return
          setCustomerFound(false)
          if (__epoch !== searchEpochRef.current) return
          setMemberMeta({ type: "customer", assoId: null, memberId: null })
        }
      } catch (e) {
        console.error(e)
        if (__epoch !== searchEpochRef.current) return
        setCustomerFound(false)
        if (__epoch !== searchEpochRef.current) return
        setMemberMeta({ type: "customer", assoId: null, memberId: null })
      } finally {
        setLoadingCustomer(false)
      }
    }
    fetchByCid()
  }, [debouncedCitizenId, buyerType, memberMeta.memberId, memberMeta.assoId, autoSearchEnabled])

  /** ค้นหาด้วยชื่อ — ข้ามเมื่อเป็นบริษัท */
  useEffect(() => {
    if (!autoSearchEnabled) { setShowNameList(false); setNameResults([]); setHighlightedIndex(-1); return }
    if (buyerType !== "person") {
      setShowNameList(false)
      setNameResults([])
      setHighlightedIndex(-1)
      setMemberMeta({ type: "unknown", assoId: null, memberId: null })
      return
    }

    const q = (debouncedFullName || "").trim()

    if (suppressNameSearchRef.current) {
      suppressNameSearchRef.current = false
      setShowNameList(false)
      setNameResults([])
      setHighlightedIndex(-1)
      return
    }
    if (q.length < 2) {
      setNameResults([])
      setShowNameList(false)
      setHighlightedIndex(-1)
      return
    }

    const searchByName = async () => {
      const __epoch = searchEpochRef.current
      try {
        setLoadingCustomer(true)
        const items = (await apiAuth(`/order/customers/search?q=${encodeURIComponent(q)}`)) || []

        const mapped = items.map((r) => ({
          ...r,
          type: r.type,
          asso_id: r.asso_id,
          member_id: r.member_id,
          citizen_id: r.citizen_id,
          first_name: r.first_name,
          last_name: r.last_name,
          address: r.address ?? r.house_no ?? r.houseNo ?? "",
          mhoo: r.mhoo ?? r.moo ?? "",
          sub_district: r.sub_district ?? r.subdistrict ?? r.subDistrict ?? "",
          district: r.district ?? "",
          province: r.province ?? "",
          postal_code: r.postal_code ?? r.postalCode ?? "",
          phone: r.phone ?? r.tel ?? r.mobile ?? "",
          fid: r.fid ?? null,
          fid_owner: r.fid_owner ?? r.fidowner ?? "",
          fid_relationship: r.fid_relationship ?? r.fidreationship ?? null,
        }))
        if (__epoch !== searchEpochRef.current) return
        setNameResults(mapped)
        if (document.activeElement === nameInputRef.current) {
          if (__epoch !== searchEpochRef.current) return
          setShowNameList(true)
          if (__epoch !== searchEpochRef.current) return
          setHighlightedIndex(mapped.length > 0 ? 0 : -1)
        }
      } catch (err) {
        console.error(err)
        setNameResults([])
        setShowNameList(false)
        setHighlightedIndex(-1)
      } finally {
        setLoadingCustomer(false)
      }
    }
    searchByName()
  }, [debouncedFullName, buyerType, autoSearchEnabled])

  /** ปิด dropdown ชื่อเมื่อคลิกนอกกล่อง */
  useEffect(() => {
    const onClick = (e) => {
      if (!nameBoxRef.current) return
      if (!nameBoxRef.current.contains(e.target)) {
        setShowNameList(false)
        setHighlightedIndex(-1)
      }
    }
    document.addEventListener("click", onClick)
    return () => document.removeEventListener("click", onClick)
  }, [])

  const focusKlangOrBranchOrEntry = () => {
    const tryFocusRef = (r) => {
      const el = r?.current
      if (el && isEnabledInput(el)) {
        try { el.scrollIntoView({ block: "center" }) } catch (_e) {}
        el.focus?.()
        try { el.select?.() } catch (_e) {}
        return true
      }
      return false
    }
    if (tryFocusRef(refs.klangName)) return
    if (tryFocusRef(refs.branchName)) return
    tryFocusRef(refs.entryWeightKg)
  }

const pickNameResult = async (rec) => {
    suppressNameSearchRef.current = true
    await fillFromRecord(rec)
    setShowNameList(false)
    setNameResults([])
    setHighlightedIndex(-1)
    // หลังเลือกชื่อแล้ว ให้โฟกัสไปที่ "คลัง" (ถ้าเลือกได้) ถ้าไม่ได้ให้ไปที่ "สาขา" หรือ "น้ำหนักก่อนชั่ง"
    requestAnimationFrame(() => {
      focusKlangOrBranchOrEntry()
    })
  }

  /** scroll item ที่ไฮไลต์ */
  const scrollHighlightedIntoView2 = (index) => {
    const itemEl = itemRefs.current[index]
    const listEl = listContainerRef.current
    if (!itemEl || !listEl) return
    try {
      itemEl.scrollIntoView({ block: "nearest", inline: "nearest" })
    } catch {
      const itemRect = itemEl.getBoundingClientRect()
      const listRect = listEl.getBoundingClientRect()
      const buffer = 6
      if (itemRect.top < listRect.top + buffer) {
        listEl.scrollTop -= (listRect.top + buffer) - itemRect.top
      } else if (itemRect.bottom > listRect.bottom - buffer) {
        listEl.scrollTop += itemRect.bottom - (listRect.bottom - buffer)
      }
    }
  }

  /** ---- จัดการ error สีแดง ---- */
  const hasRed = (key) => !!errors[key] || !!missingHints[key]
  const redFieldCls = (key) =>
    hasRed(key) ? "border-red-500 ring-2 ring-red-300 focus:ring-0 focus:border-red-500" : ""
  const clearError = (key) =>
    setErrors((prev) => {
      if (!(key in prev)) return prev
      const { [key]: _omit, ...rest } = prev
      return rest
    })

  /** คีย์บอร์ดนำทาง dropdown ชื่อ */
  const handleNameKeyDown = async (e) => {
    if (e.key === "ArrowDown" && showNameList && nameResults.length > 0) {
      e.preventDefault()
      const next = highlightedIndex < nameResults.length - 1 ? highlightedIndex + 1 : 0
      setHighlightedIndex(next)
      requestAnimationFrame(() => scrollHighlightedIntoView2(next))
    } else if (e.key === "ArrowUp" && showNameList && nameResults.length > 0) {
      e.preventDefault()
      const prev = highlightedIndex > 0 ? highlightedIndex - 1 : nameResults.length - 1
      setHighlightedIndex(prev)
      requestAnimationFrame(() => scrollHighlightedIntoView2(prev))
    } else if (e.key === "Enter" && !e.isComposing) {
      e.preventDefault()
      if (showNameList && nameResults.length > 0 && highlightedIndex >= 0 && highlightedIndex < nameResults.length) {
        await pickNameResult(nameResults[highlightedIndex])
      } else {
        focusKlangOrBranchOrEntry()
      }
    } else if (e.key === "Escape" && showNameList) {
      e.preventDefault()
      setShowNameList(false)
      setHighlightedIndex(-1)
    }
  }

  useEffect(() => {
    if (!showNameList) return
    if (highlightedIndex < 0) return
    requestAnimationFrame(() => scrollHighlightedIntoView2(highlightedIndex))
  }, [highlightedIndex, showNameList])

  /** ---------- น้ำหนักจากตาชั่ง ---------- */
  const grossFromScale = useMemo(() => {
    const entry = toNumber(order.entryWeightKg)
    const exit = toNumber(order.exitWeightKg)
    const g = Math.abs(exit - entry)
    return g > 0 ? g : 0
  }, [order.entryWeightKg, order.exitWeightKg])

  /** ---------- Auto calc ---------- */
  const autoDeduct = useMemo(() => {
    const baseGross = grossFromScale
    if (order.manualDeduct) return toNumber(order.deductWeightKg)
    return suggestDeductionWeight(baseGross, order.moisturePct, order.impurityPct)
  }, [order.manualDeduct, order.deductWeightKg, grossFromScale, order.moisturePct, order.impurityPct])

  const netWeight = useMemo(() => {
    const n = grossFromScale - toNumber(autoDeduct)
    return n > 0 ? n : 0
  }, [grossFromScale, autoDeduct])

  const computedAmount = useMemo(() => {
    if (order.unitPrice === "" || isNaN(Number(order.unitPrice))) return null
    return netWeight * Number(order.unitPrice)
  }, [netWeight, order.unitPrice])

  useEffect(() => {
    if (computedAmount !== null) {
      const rounded = Math.round(computedAmount * 100) / 100
      const formatted = formatMoneyInput(String(rounded))
      setOrder((prev) => ({ ...prev, amountTHB: formatted }))
    }
  }, [computedAmount])

  /** ---------- Payment resolver ---------- */
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

  /** ตรวจว่าเป็น “ค้าง/เครดิต” ไหม (fallback) */
  const isCreditPayment = () => {
    const pid = resolvePaymentId()
    if (pid === 4) return true
    if (pid === 3) return false
    const label =
      (order.paymentMethod || "").trim() ||
      (paymentOptions.find((o) => Number(o.id) === Number(pid))?.label || "").trim()
    const s = label.toLowerCase()
    return s.includes("ค้าง") || s.includes("เครดิต") || s.includes("credit") || s.includes("เชื่อ") || s.includes("ติด")
  }

  /** 👉 ซื้อเชื่อ = 4, ซื้อสด = 3 */
  const resolvePaymentIdForBE = () => {
    const id = resolvePaymentId()
    if (id != null) return id
    return isCreditPayment() ? 4 : 3
  }

  /** ---------- Missing hints ---------- */
  const redHintCls = (key) =>
    missingHints[key] ? "border-red-400 ring-2 ring-red-300 focus:border-red-400 animate-pulse" : ""
  const clearHint = (key) => setMissingHints((prev) => (prev[key] ? { ...prev, [key]: false } : prev))

  const computeMissingHints = () => {
    const m = {}

    if (buyerType === "person") {
      if (!customer.fullName.trim()) m.fullName = true
    } else {
      if (!customer.companyName.trim()) m.companyName = true
      if (!customer.taxId.trim()) m.taxId = true
    }

    if (!order.paymentMethod && !resolvePaymentId()) m.payment = true
    if (!order.issueDate) m.issueDate = true
    if (!order.paymentRefNo?.trim()) m.paymentRefNo = true

    if (!order.productId) m.product = true
    if (!order.riceId) m.riceType = true
    if (!order.subriceId) m.subrice = true
    if (!order.conditionId) m.condition = true
    if (!order.fieldTypeId) m.fieldType = true
    if (!order.riceYearId) m.riceYear = true
    if (!order.programId) m.program = true
    if (!order.businessTypeId) m.businessType = true
    if (!order.branchName) m.branchName = true
    if (!order.klangName) m.klangName = true

    const pid = resolvePaymentId()
    if (!pid) m.payment = true

    if (!order.entryWeightKg || Number(order.entryWeightKg) < 0) m.entryWeightKg = true
    if (!order.exitWeightKg || Number(order.exitWeightKg) <= 0) m.exitWeightKg = true
    if (grossFromScale <= 0) m.netFromScale = true

    if (String(order.moisturePct).trim() === "") m.moisturePct = true
    if (String(order.impurityPct).trim() === "") m.impurityPct = true
    if (String(order.gram).trim() === "") m.gram = true
    if (String(order.unitPrice).trim() === "") m.unitPrice = true

    if (!order.amountTHB || moneyToNumber(order.amountTHB) <= 0) m.amountTHB = true
    return m
  }

  /** ---------- Handlers ---------- */
  const updateCustomer = (k, v) => {
    // ผู้ใช้เริ่มพิมพ์ใหม่ => อนุญาตให้ระบบค้นหาอีกครั้ง
    setAutoSearchEnabled(true)
    if (String(v).trim() !== "") clearHint(k)
    setCustomer((prev) => ({ ...prev, [k]: v }))
  }
  const updateOrder = (k, v) => {
    if (String(v).trim() !== "") clearHint(k)
    setOrder((prev) => ({ ...prev, [k]: v }))
  }

/** ---------- Template mapping (ใหม่/อิง spec จาก BE โดยตรง) ---------- */
  // โหมดนี้บังคับใช้ template เสมอ
  const isTemplateActive = true 
  const applyTemplateBySpec = (spec) => { 
    if (!spec) return 
    const S = (v) => (v == null ? "" : String(v)) 
    setOrder((p) => ({ 
      ...p, 
      // ตั้งค่าเป็น "id" ทั้งหมดก่อน แล้วให้ hook ด้านล่างเติม label ตาม options 
      productId: S(spec.product_id), 
      riceId: S(spec.species_id), 
      subriceId: S(spec.variant_id), 
      riceYearId: S(spec.product_year), 
      conditionId: S(spec.condition_id), 
      fieldTypeId: S(spec.field_type), 
      programId: S(spec.program), 
      businessTypeId: S(spec.business_type), 
      // เคลียร์ชื่อเดิมเพื่อรอ sync id->label 
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
  // เลือก template → อัด spec ลงฟอร์มทันที 
  useEffect(() => { 
    if (!formTemplate) return 
    const current = templateOptions.find((o) => String(o.id) === String(formTemplate)) 
    if (current?.spec) applyTemplateBySpec(current.spec) 
    // eslint-disable-next-line react-hooks/exhaustive-deps 
  }, [formTemplate]) 
 
  /** ---------- Sync id -> label เมื่อ options โหลดเสร็จ ---------- */ 
  useEffect(() => { 
    const lbl = findLabelById(productOptions, order.productId) 
    if (order.productId && lbl && lbl !== order.productName) { 
      setOrder((p) => ({ ...p, productName: lbl })) 
    } 
  }, [order.productId, productOptions]) // productName 
  useEffect(() => { 
    const lbl = findLabelById(riceOptions, order.riceId) 
    if (order.riceId && lbl && lbl !== order.riceType) { 
      setOrder((p) => ({ ...p, riceType: lbl })) 
    } 
  }, [order.riceId, riceOptions]) // riceType 
  useEffect(() => { 
    const lbl = findLabelById(subriceOptions, order.subriceId) 
    if (order.subriceId && lbl && lbl !== order.subriceName) { 
      setOrder((p) => ({ ...p, subriceName: lbl })) 
    } 
  }, [order.subriceId, subriceOptions]) // subriceName 
  useEffect(() => { 
    const lbl = findLabelById(conditionOptions, order.conditionId) 
    if (order.conditionId && lbl && lbl !== order.condition) { 
      setOrder((p) => ({ ...p, condition: lbl })) 
    } 
  }, [order.conditionId, conditionOptions]) // condition 
  useEffect(() => { 
    const lbl = findLabelById(fieldTypeOptions, order.fieldTypeId) 
    if (order.fieldTypeId && lbl && lbl !== order.fieldType) { 
      setOrder((p) => ({ ...p, fieldType: lbl })) 
    } 
  }, [order.fieldTypeId, fieldTypeOptions]) // fieldType 
  useEffect(() => { 
    const lbl = findLabelById(yearOptions, order.riceYearId) 
    if (order.riceYearId && lbl && lbl !== order.riceYear) { 
      setOrder((p) => ({ ...p, riceYear: lbl })) 
    } 
  }, [order.riceYearId, yearOptions]) // riceYear 
  useEffect(() => { 
    const lbl = findLabelById(programOptions, order.programId) 
    if (order.programId && lbl && lbl !== order.programName) { 
      setOrder((p) => ({ ...p, programName: lbl })) 
    } 
  }, [order.programId, programOptions]) // programName 
  useEffect(() => { 
    const lbl = findLabelById(businessOptions, order.businessTypeId) 
    if (order.businessTypeId && lbl && lbl !== order.businessType) { 
      setOrder((p) => ({ ...p, businessType: lbl })) 
    } 
  }, [order.businessTypeId, businessOptions]) // businessType

  /** แชร์สถานะสเปกไปยังหน้า Sell ผ่าน localStorage */
  useEffect(() => {
    try {
      const sharedSpec = {
        productId: order.productId || null,
        riceId: order.riceId || null,
        subriceId: order.subriceId || null,
        riceYearId: order.riceYearId || null,
        conditionId: order.conditionId || null,
        fieldTypeId: order.fieldTypeId || null,
        programId: order.programId || null,
        businessTypeId: order.businessTypeId || null,
      }
      localStorage.setItem("shared.specPrefill", JSON.stringify(sharedSpec))
    } catch (_e) {}
  }, [
    order.productId,
    order.riceId,
    order.subriceId,
    order.riceYearId,
    order.conditionId,
    order.fieldTypeId,
    order.programId,
    order.businessTypeId,
  ])

  /** ---------- Validation ---------- */
  const validateAll = () => {
    const e = validateAllErrors({ buyerType, customer, memberMeta, order, grossFromScale, resolvePaymentId })
    setErrors(e)
    return e
  }

  // ✅ เลื่อนโฟกัสไป "ช่องที่ขาดตัวบนสุด"
  const scrollToFirstError = (eObj) => {
    const personKeys = ["memberId", "fullName"]
    const companyKeys = ["companyName", "taxId"]

    const commonOrderKeys = [
      "payment","issueDate","paymentRefNo",
      "product","riceType","subrice","condition","fieldType","riceYear","program","businessType",
      "branchName","klangName",
      "entryWeightKg","exitWeightKg","moisturePct","impurityPct","deductWeightKg","gram","unitPrice","amountTHB",
    ]

    const keys = (buyerType === "person" ? personKeys : companyKeys).concat(commonOrderKeys)
    const firstKey = keys.find((k) => k in eObj)
    if (!firstKey) return
    const keyToFocus = firstKey

    const el = refs[keyToFocus]?.current || (firstKey === "payment" ? refs.payment?.current : null)
    if (el && typeof el.focus === "function") {
      try { el.focus({ preventScroll: true }) } catch { el.focus() }
      try { el.select?.() } catch (_e) {}
    }
  }

  // ✅ โฟกัสตัวแรกตาม missing hints
  const scrollToFirstMissing = (hintsObj) => {
    const personKeys = ["memberId","fullName"]
    const companyKeys = ["companyName","taxId"]
    const commonOrderKeys = [
      "payment","issueDate","paymentRefNo",
      "product","riceType","subrice","condition","fieldType","riceYear","program","businessType",
      "branchName","klangName",
      "entryWeightKg","exitWeightKg","moisturePct","impurityPct","deductWeightKg","gram","unitPrice","amountTHB",
    ]
    const keys = (buyerType === "person" ? personKeys : companyKeys).concat(commonOrderKeys)
    const firstKey = keys.find((k) => hintsObj[k])
    if (!firstKey) return
    const el = refs[firstKey]?.current || (firstKey === "payment" ? refs.payment?.current : null)
    if (el && typeof el.focus === "function") {
      try { el.focus({ preventScroll: true }) } catch { el.focus() }
      try { el.select?.() } catch (_e) {}
    }
  }

  /** ---------- Helpers สำหรับรูปแบบวันที่ ---------- */
  const toIsoDateTime = (yyyyMmDd) => {
    try { return new Date(`${yyyyMmDd}T12:00:00Z`).toISOString() } catch { return new Date().toISOString() }
  }

  /** ---------- Submit ---------- */
  const handleSubmit = async (e) => {
    e.preventDefault()
    // 🔒 กันกดบันทึกซ้ำทั้งจากคลิกและ Enter
    if (submitLockRef.current || submitting) { return }
    submitLockRef.current = true /* placeholder will be fixed below */
    setSubmitting(true)
    try {
    // ปิดออโต้ค้นหาทันทีที่เริ่มบันทึก + ยกเลิกผล async เก่า
    setAutoSearchEnabled(false)
    bumpSearchEpoch()
    e.preventDefault()

    // เด้งขึ้นบนสุด
    scrollToPageTop()

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

    // แยกชื่อ (เฉพาะบุคคล)
    const [firstName, ...rest] = (customer.fullName || "").trim().split(" ")
    const lastName = rest.join(" ")

    // แปลงเป็นตัวเลขให้ชัดเจน
    const productId = /^\d+$/.test(order.productId) ? Number(order.productId) : null
    const riceId = /^\d+$/.test(order.riceId) ? Number(order.riceId) : null // species_id
    const subriceId = /^\d+$/.test(order.subriceId) ? Number(order.subriceId) : null // variant_id
    const b = lockedBranch || deriveLockedBranch(branchOptions)
    if (!b) {
      alert("ล็อกสาขาไม่สำเร็จ: ไม่พบสาขาจากสิทธิ์ผู้ใช้ในระบบ")
      return
    }
    const branchId = Number(b.id)
    const klangId = order.klangId != null ? Number(order.klangId) : null
    const riceYearId = /^\d+$/.test(order.riceYearId) ? Number(order.riceYearId) : null
    const conditionId = /^\d+$/.test(order.conditionId) ? Number(order.conditionId) : null
    const fieldTypeId = /^\d+$/.test(order.fieldTypeId) ? Number(order.fieldTypeId) : null
    const businessTypeId = /^\d+$/.test(order.businessTypeId) ? Number(order.businessTypeId) : null
    const programId = /^\d+$/.test(order.programId) ? Number(order.programId) : null
    const paymentId = resolvePaymentIdForBE()

    if (!productId) return scrollToFirstError({ product: true })
    if (!riceId) return scrollToFirstError({ riceType: true })
    if (!subriceId) return scrollToFirstError({ subrice: true })
    if (!riceYearId) return scrollToFirstError({ riceYear: true })
    if (!conditionId) return scrollToFirstError({ condition: true })
    if (!fieldTypeId) return scrollToFirstError({ fieldType: true })
    if (!programId) return scrollToFirstError({ program: true })
    if (!businessTypeId) return scrollToFirstError({ businessType: true })
    if (!branchId) return scrollToFirstError({ branchName: true })
    if (!klangId) return scrollToFirstError({ klangName: true })
    if (!paymentId) return scrollToFirstError({ payment: true })

    const baseGross = grossFromScale
    const deduction = order.manualDeduct
      ? toNumber(order.deductWeightKg)
      : suggestDeductionWeight(baseGross, order.moisturePct, order.impurityPct)
    const netW = Math.max(0, baseGross - deduction)

    const dateStr = order.issueDate

    // customer payload
    // customer payload
let customerPayload
if (buyerType === "person") {
  const memberIdStr = String(memberMeta.memberId ?? customer.memberId ?? "").trim()
  const assoIdVal = memberMeta.assoId || null 

  if (!memberIdStr && !assoIdVal) {
    alert("กรุณาระบุรหัสสมาชิก (member_id) หรือเลือกบุคคลที่มี asso_id จากผลค้นหา")
    return
  }

  // ✅ member_id ต้องเป็น "string"
  customerPayload = memberIdStr
    ? { party_type: "individual", member_id: memberIdStr, first_name: firstName || "", last_name: lastName || "" }
    : { party_type: "individual", asso_id: assoIdVal, first_name: firstName || "", last_name: lastName || "" }
} else {
  const taxId = onlyDigits(customer.taxId)
  // ✅ ฝั่งบริษัทก็ต้องเป็นโครงสร้างเดียวกัน (ไม่มี {individual:{...}})
  customerPayload = taxId
    ? { party_type: "company", tax_id: String(taxId) }
    : memberMeta.assoId
    ? { party_type: "company", asso_id: memberMeta.assoId }
    : { party_type: "company", tax_id: "" }
}


    /** Dept payload */
    const makeDeptDate = (yyyyMmDd) => {
      try { return new Date(`${yyyyMmDd}T00:00:00Z`).toISOString() } catch { return new Date().toISOString() }
    }
    const deptPayload = {
      date_created: makeDeptDate(dateStr),
      allowed_period: Number(dept.allowedPeriod || 0),
      postpone: Boolean(dept.postpone),
      postpone_period: Number(dept.postponePeriod || 0),
    }

    // ✅ spec ตาม ProductSpecIn (ฝั่ง BE)
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

    const dateISO = toIsoDateTime(dateStr)

    const payload = {
      customer: customerPayload,
      order: {
        payment_id: paymentId,
        spec,
        humidity: Number(order.moisturePct || 0),
        entry_weight: Number(order.entryWeightKg || 0),
        exit_weight: Number(order.exitWeightKg || 0),
        weight: Number(netW),
        price_per_kilo: Number(order.unitPrice || 0),
        price: Number(moneyToNumber(order.amountTHB) || 0),
        impurity: Number(order.impurityPct || 0),
        order_serial: order.paymentRefNo.trim() || null,
        date: dateISO,
        branch_location: branchId,
        klang_location: klangId,
        gram: Number(order.gram || 0),
        comment: order.comment?.trim() || null,
      },
      dept: deptPayload,
    }

    try {
      await post("/order/customers/save/buy", payload)
      try {
        // บันทึก template id และ label ให้หน้า Sell ใช้งานต่อ
        const currentTpl = templateOptions.find((o) => String(o.id) === String(formTemplate))
        const saveTpl = { id: String(formTemplate), label: currentTpl?.label || selectedTemplateLabel || "" }
        localStorage.setItem("shared.formTemplate", JSON.stringify(saveTpl))
        localStorage.setItem("buy.formTemplate", String(formTemplate))
      } catch (_e) {}
      alert("✅✅✅✅✅✅✅✅ บันทึกออเดอร์เรียบร้อย ✅✅✅✅✅✅✅✅")
      // ⬇️ เคลียร์ฟอร์มทั้งหมด + ปิดออโต้ค้นหา จนกว่าจะพิมพ์ใหม่
      handleReset()
      requestAnimationFrame(() => scrollToPageTop())
    } catch (err) {
      console.error("SAVE ERROR:", err?.data || err)
      const detail = err?.data?.detail ? `\n\nรายละเอียด:\n${JSON.stringify(err.data.detail, null, 2)}` : ""
      alert(`บันทึกล้มเหลว: ${err.message || "เกิดข้อผิดพลาด"}${detail}`)
    }
    } finally {
      submitLockRef.current = false
      setSubmitting(false)
    }

}

  const handleReset = () => {
  // ปิดระบบ auto-search ชั่วคราวระหว่างรีเซ็ตเพื่อไม่ให้มี auto-fill
  setAutoSearchEnabled(false)
  try { suppressNameSearchRef.current = true; } catch (_e) {}
  try { companySuppressSearchRef.current = true; } catch (_e) {}

  // ปิดออโต้ฟิลและยกเลิกผล async เก่าทันที
  bumpSearchEpoch()
  try { suppressNameSearchRef.current = true } catch (_e) {}
  try { companySuppressSearchRef.current = true } catch (_e) {}
  setErrors({})
  setMissingHints({})
  setCustomerFound(null)
  setLoadingCustomer(false)
  setNameResults([])
  setShowNameList(false)
  setHighlightedIndex(-1)
  setMemberMeta({ type: "unknown", assoId: null, memberId: null })

  setCustomer({
    citizenId: "",
    memberId: "",
    fullName: "",
    houseNo: "",
    moo: "",
    subdistrict: "",
    district: "",
    province: "",
    postalCode: "",
    phone: "",
    fid: "",
    fidOwner: "",
    fidRelationship: "",
    companyName: "",
    taxId: "",
    companyPhone: "",
    hqHouseNo: "",
    hqMoo: "",
    hqSubdistrict: "",
    hqDistrict: "",
    hqProvince: "",
    hqPostalCode: "",
    brHouseNo: "",
    brMoo: "",
    brSubdistrict: "",
    brDistrict: "",
    brProvince: "",
    brPostalCode: "",
  })

  // ⭐ คงค่า issueDate และสาขาเดิมไว้ และรีเซ็ตเฉพาะ "คลัง"
  setOrder((prev) => ({
    productId: "",
    productName: "",
    riceId: "",
    riceType: "",
    subriceId: "",
    subriceName: "",
    gram: "",
    riceYear: "",
    riceYearId: "",
    condition: "",
    conditionId: "",
    fieldType: "",
    fieldTypeId: "",
    programId: "",
    programName: "",
    paymentMethod: "",
    paymentMethodId: "",
    businessType: "",
    businessTypeId: "",
    entryWeightKg: "",
    exitWeightKg: "",
    moisturePct: "",
    impurityPct: "",
    manualDeduct: false,
    deductWeightKg: "",
    unitPrice: "",
    amountTHB: "",
    paymentRefNo: "",
    issueDate: prev.issueDate,
    // ✅ คงสาขาที่กำลังใช้งานไว้
    branchName: prev.branchName,
    branchId: prev.branchId,
    // 🔄 รีเซ็ตคลังใหม่ แต่ยัง "เลือกได้ปกติ"
    klangName: "",
    klangId: null,
    registeredPlace: "",
    comment: "",
  }))

  // ❌ อย่าล้างรายการคลัง เพื่อให้ดรอปดาวใช้งานได้ทันที
  setRiceOptions([])
  setSubriceOptions([])
  // setKlangOptions([])  // ← เอาออก

  setDept({
    allowedPeriod: 30,
    postpone: false,
    postponePeriod: 0,
  })

  setBuyerType("person")
  // ❌ ไม่ต้อง enforceBranchLock หรือบังคับ reload คลัง

  setPendingTemplateLabel("")
  // ไม่เปลี่ยน formTemplate เพื่อรักษาค่าเดิมที่ผู้ใช้ตั้งไว้
  if (typeof requestAnimationFrame === "function") {
    requestAnimationFrame(() => scrollToPageTop())
  } else {
    scrollToPageTop()
  }
}

  /** ---------- Template picker (shared by desktop + phone) ---------- */
  const onTemplateChange = (id, found) => {
    const idStr = String(id)
    setFormTemplate(idStr)
    const label = found?.label ?? ""
    setSelectedTemplateLabel(label)
    // บันทึกให้หน้าอื่นใช้ต่อ
    try {
      localStorage.setItem("shared.formTemplate", JSON.stringify({ id: idStr, label }))
      localStorage.setItem("buy.formTemplate", idStr)
    } catch (_e) {}
    if (found?.spec) applyTemplateBySpec(found.spec)
  }

  /** ---------- Props-bag for the sections ---------- */
  const form = {
    // state
    buyerType, setBuyerType, buyerTypeOptions,
    customer, updateCustomer, memberMeta, customerFound, loadingCustomer,
    order, setOrder, updateOrder,
    errors, missingHints, clearHint, clearError, redFieldCls, redHintCls,
    formTemplate, templateOptions, selectedTemplateLabel, templateSubLabel, onTemplateChange,
    LOCK_SPEC, branchLocked, lockedBranch,
    paymentOptions, productOptions, riceOptions, subriceOptions, conditionOptions,
    fieldTypeOptions, yearOptions, programOptions, businessOptions, branchOptions, klangOptions,
    grossFromScale, autoDeduct, netWeight,
    submitting,
    // refs
    refs, nameBoxRef, nameInputRef, listContainerRef, itemRefs,
    companyBoxRef, companyInputRef, companyItemRefs,
    // enter-flow
    onEnter, focusNext,
    // name search
    showNameList, setShowNameList, nameResults, highlightedIndex, setHighlightedIndex,
    handleNameKeyDown, pickNameResult, scrollHighlightedIntoView2,
    // company search
    showCompanyList, setShowCompanyList, companyResults, companyHighlighted, setCompanyHighlighted,
    handleCompanyKeyDown, pickCompanyResult,
    // actions
    handleSubmit, handleReset, scrollToPageTop,
  }

  /** ---------- UI ---------- */
  return (
    <div className="min-h-screen bg-white text-black dark:bg-slate-900 dark:text-white rounded-2xl text-[15px] md:text-base">
      <div className="mx-auto max-w-7xl p-5 md:p-6 lg:p-8">

        {/* จุดยึดสำหรับเลื่อนขึ้นบนสุด */}
        <div ref={pageTopRef} />

        <h1 className="mb-4 text-3xl font-bold text-gray-900 dark:text-white">🧾 บันทึกออเดอร์ซื้อข้าวเปลือก</h1>

        {/* กล่องข้อมูลลูกค้า */}
        <BuyCustomerSection form={form} />

        {/* ฟอร์มออเดอร์ */}
        <form
          onSubmit={handleSubmit}
          className="rounded-2xl border border-slate-200 bg-white p-5 text-black shadow-sm dark:border-slate-700 dark:bg-slate-800 dark:text-white"
         onKeyDown={(e)=>{ if(submitting && e.key==="Enter"){ e.preventDefault() } }}>
          <h2 className="mb-3 text-xl font-semibold">รายละเอียดการซื้อ</h2>

          {/* สเปค + สาขา/คลัง */}
          <BuySpecSection form={form} />

          {/* กรอบตัวเลข */}
          <BuyWeighSection form={form} />

          {/* สรุป */}
          <BuySummary form={form} />

          {/* หมายเหตุ */}
          <div className="mt-6">
            <label className={labelCls}>หมายเหตุ / คอมเมนต์ </label>
            <textarea
              ref={refs.comment}
              rows={3}
              className={cx(baseField)}
              value={order.comment}
              onChange={(e) => updateOrder("comment", e.target.value)}
              onKeyDown={onEnter("comment")}
              placeholder="เช่น ลูกค้าขอรับเงินโอนพรุ่งนี้, ความชื้นวัดซ้ำรอบบ่าย, ฯลฯ"
            />
            <p className={helpTextCls}>ข้อความนี้จะถูกส่งไปเก็บในออเดอร์ด้วย</p>
          </div>

          {/* ปุ่ม */}
          <div className="mt-6 flex flex-col gap-3 sm:flex-row">
            <button
              ref={refs.submitBtn}
              type="submit" disabled={submitting} aria-busy={submitting}
              onClick={scrollToPageTop}
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

export default Buy
