// src/pages/work/Buy.jsx
// ─────────────────────────────────────────────────────────────────────────────
// บันทึกออเดอร์ซื้อข้าวเปลือก — CONTROLLER (plan §A2).
// This file owns every piece of state, every effect, the refs map, validation,
// handleSubmit / handleReset and the payload. The JSX lives in ./buy/*:
//   BuyCustomerSection · BuySpecSection · BuyWeighSection (+ BuyMobileStepper)
// Sections receive one props-bag `form` (built at the bottom of this file).
// Desktop (≥md, R2): 3 section cards (ลูกค้า · สินค้าและคลัง · ชั่งน้ำหนักและราคา)
// + a sticky <OrderSummaryPanel> (≥lg right column) that owns the save button
// (refs.submitBtn). Enter-to-next order (useEnterNavigation in ./buy/buyShared.js)
// is unchanged; the 8 template-locked spec ComboBoxes are not rendered on
// desktop, so their refs are null and the flow skips them.
// ─────────────────────────────────────────────────────────────────────────────
import { useEffect, useMemo, useRef, useState } from "react"
import { useNavigate } from "react-router-dom"
import { apiAuth, post } from "../../lib/api" // ✅ helper แนบโทเคนอัตโนมัติ
import { logout } from "../../lib/auth"
import { useCan } from "../../lib/permissions"
import { ResultSheet, ConfirmDialog, OrderSummaryPanel, Kbd, toast } from "../../components/ui"
import { useIsPhone } from "../../hooks/useMediaQuery"
import {
  onlyDigits,
  toNumber,
  thb,
  nf,
  findLabelById,
  useDebounce,
  moneyToNumber,
  formatMoneyInput,
  isEnabledInput,
  focusRefWithRetry,
  useEnterNavigation,
  deriveLockedBranch,
  ERROR_SCAN_ORDER,
  FIELD_SHORT,
  describeMissing,
  describeApiError,
  SPEC_LOCKED_KEYS,
} from "./buy/buyShared"
import { validateAllErrors } from "./buy/buyValidation"
import BuyCustomerSection from "./buy/BuyCustomerSection"
import BuySpecSection from "./buy/BuySpecSection"
import BuyWeighSection from "./buy/BuyWeighSection"
import BuyMobileStepper from "./buy/BuyMobileStepper"
import PageTitle from "../../components/PageTitle"
import { backState } from "../../lib/drill"

/** ---------- Component ---------- */
const Buy = () => {
  const isPhone = useIsPhone()
  const navigate = useNavigate()
  const { can } = useCan()
  /** Outcome of the last save → <ResultSheet> (replaces alert()) */
  const [result, setResult] = useState(null)
  /** Desktop "ล้างฟอร์ม" → <ConfirmDialog> (phone stepper owns its own) */
  const [confirmReset, setConfirmReset] = useState(false)
  /** Bumped by handleReset so the phone stepper returns to step 1 */
  const [resetKey, setResetKey] = useState(0)
  /** Phone stepper registers { goTo, showErrors } here (null on desktop) */
  const stepApiRef = useRef(null)

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
  const [klangStatus, setKlangStatus] = useState("idle") // idle | loading | ready | error
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
  /** "loading" | "ready" | "error" — desktop picker shows a real empty/error state */
  const [templatesStatus, setTemplatesStatus] = useState("loading")
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
            const arr = (await apiAuth(`/order/variant/search?species_id=${encodeURIComponent(sid)}&order_type=buy`)) || []
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
    const vLabel = vid ? (variantLookup[vid] || "") : ""
    return vLabel ? `ชั้นย่อย: ${vLabel}` : ""
  }

  /** ⭐ ประเภทผู้ขาย */
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
  /** branch id the current klangOptions were loaded for (guards auto-select) */
  const klangOptionsBranchRef = useRef(null)
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
        const arr = (await apiAuth("/order/form/search?order_type=buy")) || []
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
        setTemplatesStatus("ready")

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
        setTemplatesStatus("error")
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
        const arr = (await apiAuth(`/order/variant/search?species_id=${encodeURIComponent(rid)}&order_type=buy`)) || []
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
      setKlangStatus("loading")
      try {
        const qs = bId != null ? `branch_id=${bId}` : `branch_name=${encodeURIComponent(bName)}`
        const data = await apiAuth(`/order/klang/search?${qs}`)
        klangOptionsBranchRef.current = bId != null ? String(bId) : null
        setKlangOptions((data || []).map((k) => ({ id: k.id, label: k.klang_name })))
        setKlangStatus("ready")
      } catch (e) {
        console.error("Load klang error:", e)
        klangOptionsBranchRef.current = null
        setKlangOptions([])
        setKlangStatus("error")
      }
    }
    loadKlang()
  }, [order.branchId, order.branchName])

  /** คลัง: เลือกให้อัตโนมัติเมื่อมีตัวเดียว หรือคืนค่าคลังล่าสุดของสาขานี้ (localStorage)
   *  — ทำเฉพาะตอนยังไม่ได้เลือก และเมื่อรายการคลังเป็นของสาขาปัจจุบันแล้วเท่านั้น */
  useEffect(() => {
    const bId = order.branchId
    if (bId == null || klangOptions.length === 0) return
    if (klangOptionsBranchRef.current !== String(bId)) return
    if (order.klangId != null && klangOptions.some((o) => String(o.id) === String(order.klangId))) return
    let pick = klangOptions.length === 1 ? klangOptions[0] : null
    if (!pick) {
      try {
        const saved = localStorage.getItem(`buy.lastKlang.${bId}`)
        if (saved) pick = klangOptions.find((o) => String(o.id) === saved) || null
      } catch { /* storage blocked */ }
    }
    if (pick) setOrder((p) => ({ ...p, klangId: pick.id, klangName: pick.label }))
  }, [klangOptions, order.branchId, order.klangId])

  /** จำคลังล่าสุดต่อสาขา */
  useEffect(() => {
    if (order.branchId == null || order.klangId == null) return
    try { localStorage.setItem(`buy.lastKlang.${order.branchId}`, String(order.klangId)) } catch { /* storage blocked */ }
  }, [order.branchId, order.klangId])

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

  /** ปลายทางหลังช่องชื่อ (Enter / เลือกผลค้นหา). Desktop: ชื่อ → วิธีชำระเงิน → เลขที่ใบชั่ง →
   *  คลัง → น้ำหนัก… (R2 full-page Enter flow). Phone stepper: คงเดิม (คลัง/สาขา/น้ำหนัก). */
  const focusAfterName = () => {
    if (isPhone) return focusKlangOrBranchOrEntry()
    focusRefWithRetry(refs.payment)
  }

const pickNameResult = async (rec) => {
    suppressNameSearchRef.current = true
    await fillFromRecord(rec)
    setShowNameList(false)
    setNameResults([])
    setHighlightedIndex(-1)
    // หลังเลือกชื่อ: desktop → "วิธีชำระเงิน" (Enter-flow ทั้งหน้า R2); มือถือ → "คลัง" / "สาขา" / "น้ำหนักก่อนชั่ง" ตามเดิม
    requestAnimationFrame(() => {
      focusAfterName()
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
        focusAfterName()
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
  // ไม่หักเป็นค่าเริ่มต้น — หักเมื่อเปิดสวิตช์ "หักน้ำหนัก" (manualDeduct) เท่านั้น
  const autoDeduct = useMemo(() => {
    if (order.manualDeduct) return toNumber(order.deductWeightKg)
    return 0
  }, [order.manualDeduct, order.deductWeightKg])

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
  const applyTemplateBySpec = (spec) => { 
    if (!spec) return 
    const S = (v) => (v == null ? "" : String(v))
    // ตั้งค่าเป็น "id" แล้วให้ hook ด้านล่างเติม label ตาม options — เคลียร์ชื่อเดิม
    // เฉพาะคู่ที่ id เปลี่ยน (ถ้า id เดิม hook sync จะไม่ทำงานซ้ำ ชื่อต้องคงไว้)
    const pairs = [
      ["productId", "productName", spec.product_id],
      ["riceId", "riceType", spec.species_id],
      ["subriceId", "subriceName", spec.variant_id],
      ["riceYearId", "riceYear", spec.product_year],
      ["conditionId", "condition", spec.condition_id],
      ["fieldTypeId", "fieldType", spec.field_type],
      ["programId", "programName", spec.program],
      ["businessTypeId", "businessType", spec.business_type],
    ]
    setOrder((p) => {
      const next = { ...p }
      for (const [idKey, nameKey, raw] of pairs) {
        const v = S(raw)
        if (String(p[idKey] ?? "") !== v) {
          next[idKey] = v
          next[nameKey] = ""
        }
      }
      return next
    })
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
    const keys = ERROR_SCAN_ORDER(buyerType)
    const firstKey = keys.find((k) => k in eObj)
    if (!firstKey) return
    const keyToFocus = firstKey

    const el = refs[keyToFocus]?.current || (SPEC_LOCKED_KEYS.includes(firstKey) ? refs.formTemplate?.current : null)
    if (el && typeof el.focus === "function") {
      try { el.focus({ preventScroll: true }) } catch { el.focus() }
      try { el.select?.() } catch (_e) {}
    }
  }

  // ✅ โฟกัสตัวแรกตาม missing hints
  const scrollToFirstMissing = (hintsObj) => {
    const keys = ERROR_SCAN_ORDER(buyerType)
    const firstKey = keys.find((k) => hintsObj[k])
    if (!firstKey) return
    const el = refs[firstKey]?.current || (SPEC_LOCKED_KEYS.includes(firstKey) ? refs.formTemplate?.current : null)
    if (el && typeof el.focus === "function") {
      try { el.focus({ preventScroll: true }) } catch { el.focus() }
      try { el.select?.() } catch (_e) {}
    }
  }

  /** ---------- Helpers สำหรับรูปแบบวันที่ ---------- */
  const toIsoDateTime = (yyyyMmDd) => {
    try { return new Date(`${yyyyMmDd}T12:00:00Z`).toISOString() } catch { return new Date().toISOString() }
  }

  /** Validation failure feedback (replaces the two alert() calls — copy §3.1 B1/B2).
   *  Phone: the stepper marks the bad steps, toasts and jumps. Desktop: toast +
   *  focus the first red field exactly as before. */
  const reportIncomplete = (eObj, { hints = false } = {}) => {
    const keys = ERROR_SCAN_ORDER(buyerType).filter((k) => (hints ? !!eObj[k] : k in eObj) && FIELD_SHORT[k])
    if (isPhone && stepApiRef.current) {
      stepApiRef.current.showErrors(hints ? Object.fromEntries(keys.map((k) => [k, "กรอกข้อมูล"])) : eObj, { title: "บันทึกไม่สำเร็จ" })
      return
    }
    toast.error("บันทึกไม่สำเร็จ", {
      description: keys.length ? `ยังไม่ได้กรอก: ${describeMissing(keys)} · ดูช่องที่มีกรอบสีแดง` : "ดูช่องที่มีกรอบสีแดง",
    })
    if (hints) scrollToFirstMissing(eObj)
    else scrollToFirstError(eObj)
  }

  /** ---------- Submit ---------- */
  const handleSubmit = async (e) => {
    e?.preventDefault?.()
    // 🔒 กันกดบันทึกซ้ำทั้งจากคลิกและ Enter
    if (submitLockRef.current || submitting) { return }
    submitLockRef.current = true /* placeholder will be fixed below */
    setSubmitting(true)
    try {
    // ปิดออโต้ค้นหาทันทีที่เริ่มบันทึก + ยกเลิกผล async เก่า
    setAutoSearchEnabled(false)
    bumpSearchEpoch()

    // เด้งขึ้นบนสุด (desktop; the phone stepper scrolls to the field it reports)
    if (!isPhone) scrollToPageTop()

    const hints = computeMissingHints()
    setMissingHints(hints)
    const eObj = validateAll()

     if (Object.keys(eObj).length > 0) {
    reportIncomplete(eObj)
    return
  }
  if (Object.values(hints).some(Boolean)) {
    reportIncomplete(hints, { hints: true })
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
      // copy §3.1 B3
      toast.error("ไม่พบสาขาของผู้ใช้", { description: "บัญชีนี้ยังไม่ได้ผูกสาขา แจ้งผู้ดูแลระบบเพื่อตั้งค่าก่อนบันทึก" })
      stepApiRef.current?.showErrors({ branchName: "เลือกสาขา" }, { title: "ไม่พบสาขาของผู้ใช้" })
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

    // ทุกทางออกต้องบอกผู้ใช้ว่าทำไมยังไม่บันทึก — เดิม return เงียบ ทำให้ "กดบันทึกแล้วไม่มีอะไรเกิดขึ้น" (handoff F18)
    const missingId = [
      [productId, "product"], [riceId, "riceType"], [subriceId, "subrice"], [riceYearId, "riceYear"],
      [conditionId, "condition"], [fieldTypeId, "fieldType"], [programId, "program"], [businessTypeId, "businessType"],
      [branchId, "branchName"], [klangId, "klangName"], [paymentId, "payment"],
    ].find(([v]) => !v)
    if (missingId) {
      const key = missingId[1]
      reportIncomplete({ [key]: SPEC_LOCKED_KEYS.includes(key) ? "ฟอร์มสินค้านี้ข้อมูลไม่ครบ เลือกฟอร์มอื่น" : "กรอกข้อมูล" })
      return
    }

    const baseGross = grossFromScale
    const deduction = order.manualDeduct ? toNumber(order.deductWeightKg) : 0
    const netW = Math.max(0, baseGross - deduction)

    const dateStr = order.issueDate

    // customer payload
    // customer payload
let customerPayload
if (buyerType === "person") {
  const memberIdStr = String(memberMeta.memberId ?? customer.memberId ?? "").trim()
  const assoIdVal = memberMeta.assoId || null 

  if (!memberIdStr && !assoIdVal) {
    // copy §3.1 B4
    if (isPhone && stepApiRef.current) {
      toast.error("ยังไม่ได้ระบุสมาชิก", {
        description: "กรอกรหัสสมาชิก หรือเลือกชื่อจากผลค้นหา",
        action: { label: "ไปที่ขั้น 1", onClick: () => stepApiRef.current?.goTo(0, "memberId") },
      })
      stepApiRef.current.goTo(0, "memberId")
    } else {
      toast.error("ยังไม่ได้ระบุสมาชิก", { description: "กรอกรหัสสมาชิก หรือเลือกชื่อจากผลค้นหา" })
      scrollToFirstError({ memberId: true })
    }
    setErrors((p) => ({ ...p, memberId: "กรอกรหัสสมาชิก หรือเลือกชื่อจากผลค้นหา" }))
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
      const res = await post("/order/customers/save/buy", payload)
      try {
        // บันทึก template id และ label ให้หน้า Sell ใช้งานต่อ
        const currentTpl = templateOptions.find((o) => String(o.id) === String(formTemplate))
        const saveTpl = { id: String(formTemplate), label: currentTpl?.label || selectedTemplateLabel || "" }
        localStorage.setItem("shared.formTemplate", JSON.stringify(saveTpl))
        localStorage.setItem("buy.formTemplate", String(formTemplate))
      } catch (_e) {}
      // Snapshot for the ResultSheet (copy §4.1) — taken before the form is cleared
      const orderNo = res?.order_no ?? res?.order_serial ?? res?.order_id ?? res?.id ?? null
      const lines = [
        { label: "ลูกค้า", value: buyerType === "person" ? customer.fullName.trim() : customer.companyName.trim() },
        { label: "สเปค", value: [order.riceType, order.subriceName].filter(Boolean).join(" · ") || "—" },
        { label: "น้ำหนักสุทธิ", value: `${nf(netW)} กก.` },
        { label: "เป็นเงิน", value: <span className="text-xl font-bold">{thb(moneyToNumber(order.amountTHB))}</span> },
        ...(orderNo != null && orderNo !== "" ? [{ label: "เลขที่ออเดอร์", value: String(orderNo) }] : []),
      ]
      // ⬇️ เคลียร์ฟอร์มทั้งหมด + ปิดออโต้ค้นหา จนกว่าจะพิมพ์ใหม่ (พฤติกรรมเดิมหลัง alert)
      handleReset()
      requestAnimationFrame(() => scrollToPageTop())
      setResult({ tone: "success", title: "บันทึกออเดอร์แล้ว", lines })
    } catch (err) {
      console.error("SAVE ERROR:", err?.data || err)
      const d = describeApiError(err)
      setResult({ tone: "error", ...d })
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

  // ⭐ คงค่า issueDate, สาขา และสเปคจากฟอร์มสำเร็จรูปเดิมไว้ (LOCK_SPEC — สเปค
  // มาจาก formTemplate ที่ยังเลือกอยู่เสมอ; เดิมล้าง id ทิ้งแต่ formTemplate ไม่เปลี่ยน
  // → effect ไม่ re-apply → ต้องเลือกฟอร์มใหม่ทุกครั้งหลังบันทึก)
  setOrder((prev) => ({
    productId: prev.productId,
    productName: prev.productName,
    riceId: prev.riceId,
    riceType: prev.riceType,
    subriceId: prev.subriceId,
    subriceName: prev.subriceName,
    gram: "",
    riceYear: prev.riceYear,
    riceYearId: prev.riceYearId,
    condition: prev.condition,
    conditionId: prev.conditionId,
    fieldType: prev.fieldType,
    fieldTypeId: prev.fieldTypeId,
    programId: prev.programId,
    programName: prev.programName,
    paymentMethod: "",
    paymentMethodId: "",
    businessType: prev.businessType,
    businessTypeId: prev.businessTypeId,
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
    // ✅ คงคลังเดิมไว้ (รถคันถัดไปส่วนใหญ่ลงคลังเดียวกัน — R2)
    klangName: prev.klangName,
    klangId: prev.klangId,
    registeredPlace: "",
    comment: "",
  }))

  // ❌ อย่าล้างรายการตัวเลือก (ชนิดข้าว/ชั้นย่อย/คลัง) — สเปคยังเป็นชุดเดิม
  // และ effect โหลดตัวเลือกจะไม่ทำงานซ้ำเพราะ id ไม่เปลี่ยน

  setDept({
    allowedPeriod: 30,
    postpone: false,
    postponePeriod: 0,
  })

  setBuyerType("person")
  // ❌ ไม่ต้อง enforceBranchLock หรือบังคับ reload คลัง

  setPendingTemplateLabel("")
  // ไม่เปลี่ยน formTemplate เพื่อรักษาค่าเดิมที่ผู้ใช้ตั้งไว้ — ถ้าสเปคใน state
  // ไม่ตรงกับฟอร์ม (เช่น ฟอร์มโหลดมาทีหลัง) ให้อัดสเปคจากฟอร์มปัจจุบันซ้ำ
  const currentTpl = templateOptions.find((o) => String(o.id) === String(formTemplate))
  if (currentTpl?.spec) applyTemplateBySpec(currentTpl.spec)
  setResetKey((k) => k + 1) // phone stepper → ขั้น 1
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
    formTemplate, templateOptions, selectedTemplateLabel, templateSubLabel, onTemplateChange, templatesStatus,
    LOCK_SPEC, branchLocked, lockedBranch,
    paymentOptions, productOptions, riceOptions, subriceOptions, conditionOptions,
    fieldTypeOptions, yearOptions, programOptions, businessOptions, branchOptions, klangOptions, klangStatus,
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
    handleSubmit, handleReset, scrollToPageTop, resolvePaymentId, setErrors, focusKlangOrBranchOrEntry,
    // phone stepper plumbing
    isPhone, stepApiRef, resetKey,
  }

  /** ---------- Desktop keyboard (R2) ---------- */
  // ช่องแรกของลูกค้า (บุคคล → เลขบัตร, บริษัท → ชื่อบริษัท). Desktop only — on
  // phones focusing a field pops the keyboard over the stepper.
  const citizenIdRef = refs.citizenId
  const companyNameRef = refs.companyName
  const focusFirstCustomerField = () => {
    if (isPhone) return
    // after Sheet/ConfirmDialog restore focus to their opener (sync, on close)
    // and after handleReset re-renders person mode
    setTimeout(() => {
      const el = citizenIdRef.current || companyNameRef.current
      try { el?.focus({ preventScroll: true }) } catch { el?.focus?.() }
    }, 60)
  }

  // autofocus on load (unless focus is already inside the form)
  useEffect(() => {
    if (isPhone) return
    const t = setTimeout(() => {
      if (document.activeElement?.closest?.("#buy-form")) return
      const el = citizenIdRef.current || companyNameRef.current
      try { el?.focus({ preventScroll: true }) } catch { el?.focus?.() }
    }, 0)
    return () => clearTimeout(t)
  }, [isPhone, citizenIdRef, companyNameRef])

  // Ctrl+S / Ctrl+Enter (⌘ on Mac) = บันทึก — goes through handleSubmit, so the
  // submit lock and every validation step still apply. e.code catches Ctrl+S on
  // the Thai layout (e.key = "ห"). Ignored while a Sheet / dialog is open.
  const handleSubmitRef = useRef(handleSubmit)
  useEffect(() => { handleSubmitRef.current = handleSubmit })
  useEffect(() => {
    if (isPhone) return
    const onKey = (e) => {
      if (!(e.ctrlKey || e.metaKey) || e.altKey || e.shiftKey) return
      const isSave = e.code === "KeyS" || e.key === "s" || e.key === "S"
      const isEnter = e.key === "Enter" && !e.isComposing
      if (!isSave && !isEnter) return
      if (isSave) e.preventDefault() // never the browser's "Save page" dialog on this page
      if (e.repeat || document.body.dataset.sheetOpen) return
      e.preventDefault()
      handleSubmitRef.current?.()
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [isPhone])

  /** ---------- ResultSheet actions (copy §4.1 / §4.3) ---------- */
  const closeResult = () => setResult(null)
  const resultButtons = (() => {
    if (!result) return {}
    if (result.tone === "success") {
      return {
        // ฟอร์มถูก reset แล้ว — ปิด = ทำรายการใหม่
        primary: { label: "ทำรายการใหม่", onClick: () => { closeResult(); stepApiRef.current?.goTo(0); scrollToPageTop(); focusFirstCustomerField() } },
        secondary: can("trading.reports.view") ? { label: "ดูออเดอร์", onClick: () => { closeResult(); navigate("/order", { state: backState() }) } } : undefined,
      }
    }
    const retry = { label: "ลองอีกครั้ง", onClick: () => { closeResult(); setTimeout(() => handleSubmit(), 0) } }
    const close = { label: "ปิด", onClick: closeResult }
    switch (result.primary) {
      case "edit": return { primary: { label: "แก้ไขข้อมูล", onClick: closeResult }, secondary: close }
      case "login": return { primary: { label: "เข้าสู่ระบบใหม่", onClick: () => { logout(); navigate("/") } }, secondary: close }
      case "orders": return { primary: { label: "ดูออเดอร์", onClick: () => { closeResult(); navigate("/order", { state: backState() }) } }, secondary: close }
      default: return { primary: retry, secondary: close }
    }
  })()
  const resultSheet = (
    <ResultSheet
      open={!!result}
      tone={result?.tone ?? "success"}
      title={result?.title ?? ""}
      description={result?.description}
      lines={result?.lines ?? []}
      primary={resultButtons.primary}
      secondary={resultButtons.secondary}
      onClose={result?.tone === "success" ? resultButtons.primary.onClick : closeResult}
    />
  )

  /** ---------- UI ---------- */
  if (isPhone) {
    return (
      <div className="min-h-dvh bg-white text-black dark:bg-slate-900 dark:text-white rounded-2xl text-base">
        <div className="mx-auto max-w-7xl p-4">
          <div ref={pageTopRef} />
          <PageTitle title="บันทึกออเดอร์ซื้อข้าวเปลือก" />
          <BuyMobileStepper form={form} />
        </div>
        {resultSheet}
      </div>
    )
  }

  /* ---------- Desktop (≥md): 3 section cards + sticky OrderSummaryPanel (R2) ---------- */
  const customerName = (buyerType === "person" ? customer.fullName : customer.companyName).trim()
  const templateLabel =
    templateOptions.find((o) => String(o.id) === String(formTemplate))?.label || (templateOptions.length ? selectedTemplateLabel : "") || ""
  const unitPriceNum = Number(order.unitPrice)
  const hasUnitPrice = String(order.unitPrice).trim() !== "" && Number.isFinite(unitPriceNum)
  const panelRows = [
    { label: "ลูกค้า", value: customerName || "ยังไม่ได้เลือก", emphasis: customerName ? undefined : "muted" },
    { label: "สินค้า", value: templateLabel || "ยังไม่ได้เลือก", emphasis: templateLabel ? undefined : "muted" },
    { label: "คลัง", value: order.klangName || "ยังไม่ได้เลือก", emphasis: order.klangName ? undefined : "muted" },
    { label: "น้ำหนักสุทธิ", value: `${nf(netWeight)} กก.` },
    { label: "ราคา/กก.", value: hasUnitPrice ? `${thb(unitPriceNum)}/กก.` : "—", emphasis: hasUnitPrice ? undefined : "muted" },
    { label: "ยอดเงิน", value: thb(moneyToNumber(order.amountTHB)), emphasis: "total" },
  ]

  return (
    <div className="text-base text-gray-900 dark:text-gray-100">
      <div className="mx-auto max-w-7xl p-4 md:p-6">
        {/* จุดยึดสำหรับเลื่อนขึ้นบนสุด */}
        <div ref={pageTopRef} />

        <PageTitle title="บันทึกออเดอร์ซื้อข้าวเปลือก" />

        <form
          id="buy-form"
          onSubmit={handleSubmit}
          noValidate
          className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_20rem] lg:items-start"
          onKeyDown={(e) => { if (submitting && e.key === "Enter") e.preventDefault() }}
        >
          <div className="min-w-0 space-y-5">
            <BuyCustomerSection form={form} />
            <BuySpecSection form={form} />
            <BuyWeighSection form={form} />
          </div>

          <aside className="md:ml-auto md:w-full md:max-w-sm lg:sticky lg:top-[calc(var(--topbar-h)+1rem)] lg:max-w-none">
            <OrderSummaryPanel
              title="สรุปรายการ"
              rows={panelRows}
              primaryRef={refs.submitBtn}
              primary={{
                label: submitting ? "กำลังบันทึก…" : "บันทึกออเดอร์",
                type: "button",
                onClick: () => handleSubmit(),
                loading: submitting,
              }}
              secondary={{ label: "ล้างฟอร์ม", onClick: () => setConfirmReset(true), disabled: submitting }}
              hint={<><Kbd>Enter</Kbd> ไปช่องถัดไป · <Kbd>Ctrl</Kbd>+<Kbd>S</Kbd> บันทึก</>}
            />
          </aside>
        </form>
      </div>

      <ConfirmDialog
        open={confirmReset}
        title="ล้างข้อมูลที่กรอกไว้"
        description="ข้อมูลลูกค้า น้ำหนัก และราคาจะหาย ฟอร์มสินค้าและคลังยังอยู่"
        confirmLabel="ล้างฟอร์ม"
        cancelLabel="เก็บไว้"
        tone="danger"
        onConfirm={() => { setConfirmReset(false); handleReset(); focusFirstCustomerField() }}
        onCancel={() => setConfirmReset(false)}
      />
      {resultSheet}
    </div>
  )
}

export default Buy
