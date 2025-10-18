// src/pages/Sales.jsx
import { useEffect, useMemo, useRef, useState, forwardRef, useImperativeHandle } from "react"
import { apiAuth, post } from "../lib/api"

/** ----------- Utils (same as Buy) ------------ */
const onlyDigits = (s = "") => s.replace(/\D+/g, "")
const toNumber = (v) => (v === "" || v === null || v === undefined ? 0 : Number(v))
const toIntOrNull = (v) => {
  if (v === null || v === undefined) return null
  const s = String(v).trim()
  return /^-?\d+$/.test(s) ? parseInt(s, 10) : null
}

const thb = (n) =>
  new Intl.NumberFormat("th-TH", { style: "currency", currency: "THB", maximumFractionDigits: 2 }).format(
    isFinite(n) ? n : 0
  )

function useDebounce(value, delay = 400) {
  const [debounced, setDebounced] = useState(value)
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delay)
    return () => clearTimeout(t)
  }, [value, delay])
  return debounced
}

/** เงิน */
const moneyToNumber = (v) => {
  if (v === "" || v == null) return 0
  const n = Number(String(v).replace(/,/g, ""))
  return isFinite(n) ? n : 0
}
const formatMoneyInput = (val) => {
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

/** กฎคำนวณหักน้ำหนัก (ชื้น/สิ่งเจือปน) */
const MOISTURE_STD = 15
function suggestDeductionWeight(grossKg, moisturePct, impurityPct) {
  const w = toNumber(grossKg)
  const m = Math.max(0, toNumber(moisturePct) - MOISTURE_STD)
  const imp = Math.max(0, toNumber(impurityPct))
  const dedByMoisture = (m / 100) * w
  const dedByImpurity = (imp / 100) * w
  return Math.max(0, dedByMoisture + dedByImpurity)
}

/** ---------- class helpers (copy style from Buy) ---------- */
const cx = (...a) => a.filter(Boolean).join(" ")
const baseField =
  "w-full rounded-2xl border border-slate-300 bg-slate-100 p-3 text-[15px] md:text-base " +
  "text-black outline-none placeholder:text-slate-500 focus:border-emerald-600 focus:ring-2 focus:ring-emerald-500/30 shadow-none " +
  "dark:border-slate-500 dark:bg-slate-700 dark:text-slate-100 dark:placeholder:text-slate-300 dark:focus:border-emerald-400 dark:focus:ring-emerald-400/30"
const labelCls = "mb-1 block text-[15px] md:text-base font-medium text-slate-700 dark:text-slate-200"
const helpTextCls = "mt-1 text-sm text-slate-600 dark:text-slate-300"

/** ---------- Enter-to-next helpers ---------- */
const isEnabledInput = (el) => {
  if (!el) return false
  if (typeof el.disabled !== "undefined" && el.disabled) return false
  const style = window.getComputedStyle?.(el)
  if (style && (style.display === "none" || style.visibility === "hidden")) return false
  if (!el.offsetParent && el.type !== "hidden" && el.getAttribute("role") !== "combobox") return false
  return true
}

const useEnterNavigation = (refs, buyerType, order) => {
  const personOrder = [
    "citizenId", // คงไว้เพื่อค้นหาที่อยู่
    "memberId",
    "fullName","houseNo","moo","subdistrict","district","province","postalCode","phone",
  ]
  const companyOrder = [
    "companyName","taxId","companyPhone",
    "hqHouseNo","hqMoo","hqSubdistrict","hqDistrict","hqProvince","hqPostalCode",
    "brHouseNo","brMoo","brSubdistrict","brDistrict","brProvince","brPostalCode",
  ]
  const orderOrder = [
    "product","riceType","subrice","condition","fieldType","riceYear","businessType","program",
    "branchName","klangName",
    "entryWeightKg","exitWeightKg","moisturePct","impurityPct","deductWeightKg","gram",
    "unitPrice","amountTHB","paymentRefNo","comment",
    "payment","issueDate",
  ]

  let list = (buyerType === "person" ? personOrder : companyOrder).concat(orderOrder)
  list = list.filter((key) => {
    const el = refs?.[key]?.current
    if (!el) return false
    if (key === "subrice" && !order.riceId) return false
    if (key === "riceType" && !order.productId) return false
    if (key === "deductWeightKg" && !order.manualDeduct) return false
    if (key === "klangName" && !order.branchId) return false
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
    try { el.select?.() } catch {}
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

/** ---------- Reusable ComboBox (copy from Buy) ---------- */
function ComboBox({
  options = [], value, onChange, placeholder = "— เลือก —",
  getLabel = (o) => o?.label ?? "", getValue = (o) => o?.value ?? o?.id ?? "",
  disabled = false, error = false, buttonRef = null, hintRed = false, clearHint = () => {}, onEnterNext,
}) {
  const [open, setOpen] = useState(false)
  const [highlight, setHighlight] = useState(-1)
  const boxRef = useRef(null)
  const listRef = useRef(null)
  const internalBtnRef = useRef(null)
  const controlRef = buttonRef || internalBtnRef

  const selectedLabel = useMemo(() => {
    const found = options.find((o) => String(getValue(o)) === String(value))
    return found ? getLabel(found) : ""
  }, [options, value, getLabel, getValue])

  useEffect(() => {
    const onClick = (e) => {
      if (!boxRef.current) return
      if (!boxRef.current.contains(e.target)) {
        setOpen(false); setHighlight(-1)
      }
    }
    document.addEventListener("click", onClick)
    return () => document.removeEventListener("click", onClick)
  }, [])

  const commit = (opt) => {
    const v = String(getValue(opt))
    onChange?.(v, opt)
    setOpen(false); setHighlight(-1); clearHint?.()
    requestAnimationFrame(() => { controlRef.current?.focus(); onEnterNext?.() })
  }

  const scrollHighlightedIntoView = (index) => {
    const listEl = listRef.current
    const itemEl = listEl?.children?.[index]
    if (!listEl || !itemEl) return
    const itemRect = itemEl.getBoundingClientRect()
    const listRect = listEl.getBoundingClientRect()
    const buffer = 6
    if (itemRect.top < listRect.top + buffer) listEl.scrollTop -= (listRect.top + buffer) - itemRect.top
    else if (itemRect.bottom > listRect.bottom - buffer) listEl.scrollTop += itemRect.bottom - (listRect.bottom - buffer)
  }

  const onKeyDown = (e) => {
    if (disabled) return
    if (!open && (e.key === "Enter" || e.key === " " || e.key === "ArrowDown")) {
      e.preventDefault(); setOpen(true); setHighlight((h) => (h >= 0 ? h : 0)); clearHint?.(); return
    }
    if (!open) return
    if (e.key === "ArrowDown") { e.preventDefault(); setHighlight((h)=>{ const next=h<options.length-1?h+1:0; requestAnimationFrame(()=>scrollHighlightedIntoView(next)); return next }) }
    else if (e.key === "ArrowUp") { e.preventDefault(); setHighlight((h)=>{ const prev=h>0?h-1:options.length-1; requestAnimationFrame(()=>scrollHighlightedIntoView(prev)); return prev }) }
    else if (e.key === "Enter") { e.preventDefault(); if (highlight>=0 && highlight<options.length) commit(options[highlight]) }
    else if (e.key === "Escape") { e.preventDefault(); setOpen(false); setHighlight(-1) }
  }

  return (
    <div className="relative" ref={boxRef}>
      <button
        type="button"
        ref={controlRef}
        disabled={disabled}
        onClick={() => { if (!disabled) { setOpen((o)=>o||!o); clearHint?.() } }}
        onKeyDown={onKeyDown}
        onFocus={() => clearHint?.()}
        className={cx(
          "w-full rounded-2xl border p-3 text-left text-[15px] md:text-base outline-none transition shadow-none",
          disabled ? "bg-slate-100 cursor-not-allowed" : "bg-slate-100 hover:bg-slate-200 cursor-pointer",
          error ? "border-red-400 ring-2 ring-red-300/70" : "border-slate-300 focus:border-emerald-600 focus:ring-2 focus:ring-emerald-500/30",
          "dark:border-slate-500 dark:bg-slate-700 dark:text-slate-100 dark:hover:bg-slate-700/80",
          hintRed && "ring-2 ring-red-300 animate-pulse"
        )}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-invalid={error || hintRed ? true : undefined}
      >
        {selectedLabel || <span className="text-slate-500 dark:text-white/70">{placeholder}</span>}
      </button>

      {open && (
        <div
          ref={listRef}
          role="listbox"
          className="absolute z-20 mt-1 max-h-72 w-full overflow-auto overscroll-contain rounded-2xl border border-slate-200 bg-white text-black shadow-lg dark:border-slate-700 dark:bg-slate-800 dark:text-white"
        >
          {options.length === 0 && (
            <div className="px-3 py-2 text-sm text-slate-600 dark:text-slate-300">ไม่มีตัวเลือก</div>
          )}
          {options.map((opt, idx) => {
            const label = getLabel(opt)
            const isActive = idx === highlight
            const isChosen = String(getValue(opt)) === String(value)
            return (
              <button
                key={String(getValue(opt)) || label || idx}
                type="button"
                role="option"
                aria-selected={isChosen}
                onMouseEnter={() => setHighlight(idx)}
                onClick={() => commit(opt)}
                className={cx(
                  "relative flex w-full items-center gap-2 px-3 py-2.5 text-left text-[15px] md:text-base transition rounded-xl cursor-pointer",
                  isActive
                    ? "bg-emerald-100 ring-1 ring-emerald-300 dark:bg-emerald-400/20 dark:ring-emerald-500"
                    : "hover:bg-emerald-50 dark:hover:bg-emerald-900/30"
                )}
              >
                {isActive && <span className="absolute left-0 top-0 h-full w-1 bg-emerald-600 dark:bg-emerald-400/70 rounded-l-xl" />}
                <span className="flex-1">{label}</span>
                {isChosen && <span className="text-emerald-600 dark:text-emerald-300">✓</span>}
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}

/** ---------- DateInput ---------- */
const DateInput = forwardRef(function DateInput({ error = false, className = "", ...props }, ref) {
  const inputRef = useRef(null)
  useImperativeHandle(ref, () => inputRef.current)
  return (
    <div className="relative">
      <style>{`input[type="date"]::-webkit-calendar-picker-indicator { opacity: 0; }`}</style>
      <input
        type="date"
        ref={inputRef}
        className={cx(baseField, "pr-12 cursor-pointer", error && "border-red-400 ring-2 ring-red-300/70", className)}
        {...props}
      />
      <button
        type="button"
        onClick={() => {
          const el = inputRef.current
          if (!el) return
          if (typeof el.showPicker === "function") el.showPicker()
          else { el.focus(); el.click?.() }
        }}
        aria-label="เปิดตัวเลือกวันที่"
        className="absolute right-2 top-1/2 -translate-y-1/2 inline-flex h-9 w-9 items-center justify-center rounded-xl bg-transparent"
      >
        <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor" className="text-slate-600 dark:text-slate-200">
          <path d="M7 2a1 1 0 0 1 1 1v1h8V3a1 1 0 1 1 2 0v1h1a2 2 0 0 1 2 2v3H3V6a2 2 0 0 1 2-2h1V3a1 1 0 1 1 1-1zm14 9v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-7h18zM7 14h2v2H7v-2zm4 0h2v2h-2v-2z" />
        </svg>
      </button>
    </div>
  )
})

/** ---------- Component ---------- */
const Sales = () => {
  const [loadingCustomer, setLoadingCustomer] = useState(false)
  const [customerFound, setCustomerFound] = useState(null)
  const [errors, setErrors] = useState({})
  const [missingHints, setMissingHints] = useState({})

  /** search state (person) */
  const [nameResults, setNameResults] = useState([])
  const [showNameList, setShowNameList] = useState(false)
  const nameBoxRef = useRef(null)
  const nameInputRef = useRef(null)
  const suppressNameSearchRef = useRef(false)
  const [highlightedIndex, setHighlightedIndex] = useState(-1)
  const listContainerRef = useRef(null)
  const itemRefs = useRef([])

  /** search state (company) */
  const [companyResults, setCompanyResults] = useState([])
  const [showCompanyList, setShowCompanyList] = useState(false)
  const companyBoxRef = useRef(null)
  const companyInputRef = useRef(null)
  const companySuppressSearchRef = useRef(false)
  const [companyHighlighted, setCompanyHighlighted] = useState(-1)
  const companyItemRefs = useRef([])

  /** dropdown opts */
  const [productOptions, setProductOptions] = useState([])
  const [riceOptions, setRiceOptions] = useState([])       // species
  const [subriceOptions, setSubriceOptions] = useState([]) // variant
  const [branchOptions, setBranchOptions] = useState([])
  const [klangOptions, setKlangOptions] = useState([])
  const [conditionOptions, setConditionOptions] = useState([])
  const [fieldTypeOptions, setFieldTypeOptions] = useState([])
  const [yearOptions, setYearOptions] = useState([])
  const [programOptions, setProgramOptions] = useState([])
  const [paymentOptions, setPaymentOptions] = useState([])
  const [businessOptions, setBusinessOptions] = useState([])

  /** ▶︎ ฟอร์มสำเร็จรูป */
  const templateOptions = [
    { id: "0", label: "— ฟอร์มปกติ —" },
    { id: "1", label: "รหัส 1 • ข้าวหอมมะลิ" },
    { id: "2", label: "รหัส 2 • ข้าวเหนียว" },
    { id: "3", label: "รหัส 3 • เมล็ดพันธุ์" },
  ]
  const [formTemplate, setFormTemplate] = useState("0") // 0 = ไม่ล็อก

  /** ประเภทผู้ขาย */
  const buyerTypeOptions = [
    { id: "person", label: "บุคคลธรรมดา" },
    { id: "company", label: "บริษัท / นิติบุคคล" },
  ]
  const [buyerType, setBuyerType] = useState("person")

  /** ฟอร์มลูกค้า */
  const [customer, setCustomer] = useState({
    citizenId: "",
    memberId: "", // ใช้ member_id เป็นหลัก
    fullName: "", houseNo: "", moo: "", subdistrict: "", district: "", province: "", postalCode: "", phone: "",
    companyName: "", taxId: "", companyPhone: "",
    // HQ
    hqHouseNo: "", hqMoo: "", hqSubdistrict: "", hqDistrict: "", hqProvince: "", hqPostalCode: "",
    // Branch (optional)
    brHouseNo: "", brMoo: "", brSubdistrict: "", brDistrict: "", brProvince: "", brPostalCode: "",
  })

  /** meta ผู้ถูกเลือก */
  const [memberMeta, setMemberMeta] = useState({ type: "unknown", assoId: null, memberId: null })

  /** ฟอร์มออเดอร์ */
  const [order, setOrder] = useState({
    productId: "", productName: "",
    riceId: "", riceType: "",
    subriceId: "", subriceName: "",
    gram: "",
    riceYear: "", riceYearId: "",
    condition: "", conditionId: "",
    fieldType: "", fieldTypeId: "",
    programId: "", programName: "",
    paymentMethod: "", paymentMethodId: "",
    businessType: "", businessTypeId: "",
    entryWeightKg: "", exitWeightKg: "",
    moisturePct: "", impurityPct: "",
    manualDeduct: false, deductWeightKg: "",
    unitPrice: "", amountTHB: "",
    paymentRefNo: "", issueDate: new Date().toISOString().slice(0, 10),
    branchName: "", branchId: null,
    klangName: "", klangId: null,
    comment: "",
  })

  /** Dept (ใช้เมื่อขายเชื่อ) */
  const [dept, setDept] = useState({ allowedPeriod: 30, postpone: false, postponePeriod: 0 })
  const updateDept = (k, v) => setDept((p) => ({ ...p, [k]: v }))

  /** ---------- Refs ---------- */
  const refs = {
    citizenId: useRef(null), memberId: useRef(null), fullName: useRef(null),
    houseNo: useRef(null), moo: useRef(null), subdistrict: useRef(null), district: useRef(null),
    province: useRef(null), postalCode: useRef(null), phone: useRef(null),
    companyName: useRef(null), taxId: useRef(null), companyPhone: useRef(null),
    hqHouseNo: useRef(null), hqMoo: useRef(null), hqSubdistrict: useRef(null), hqDistrict: useRef(null),
    hqProvince: useRef(null), hqPostalCode: useRef(null), brHouseNo: useRef(null), brMoo: useRef(null),
    brSubdistrict: useRef(null), brDistrict: useRef(null), brProvince: useRef(null), brPostalCode: useRef(null),
    product: useRef(null), riceType: useRef(null), subrice: useRef(null), condition: useRef(null), fieldType: useRef(null),
    riceYear: useRef(null), program: useRef(null), payment: useRef(null), businessType: useRef(null),
    branchName: useRef(null), klangName: useRef(null),
    entryWeightKg: useRef(null), exitWeightKg: useRef(null), moisturePct: useRef(null), impurityPct: useRef(null),
    deductWeightKg: useRef(null), unitPrice: useRef(null), amountTHB: useRef(null), paymentRefNo: useRef(null),
    issueDate: useRef(null), gram: useRef(null), comment: useRef(null),
    formTemplate: useRef(null), buyerType: useRef(null),
  }
  const { onEnter, focusNext } = useEnterNavigation(refs, buyerType, order)

  /** ---------- Persisted template ---------- */
  useEffect(() => {
    try {
      const saved = localStorage.getItem("sales.formTemplate")
      if (saved && ["0", "1", "2", "3"].includes(saved)) setFormTemplate(saved)
    } catch {}
  }, [])

  /** ---------- Debounce ---------- */
  const debouncedCitizenId = useDebounce(customer.citizenId)
  const debouncedMemberId = useDebounce(customer.memberId)
  const debouncedFullName = useDebounce(customer.fullName)
  const debouncedCompanyName = useDebounce(customer.companyName)
  const debouncedTaxId = useDebounce(customer.taxId)

  /** helper: fetch first ok (reused) */
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

  /** load address by citizen_id (reused) */
  const loadAddressByCitizenId = async (cid) => {
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
    const S = (v) => (v == null ? "" : String(v))

    const addr = {
      houseNo: S(data.address ?? data.house_no ?? data.houseNo ?? ""),
      moo: S(data.mhoo ?? data.moo ?? ""),
      subdistrict: S(data.sub_district ?? data.subdistrict ?? data.subDistrict ?? ""),
      district: S(data.district ?? ""),
      province: S(data.province ?? ""),
      postalCode: onlyDigits(S(data.postal_code ?? data.postalCode ?? "")),
      firstName: S(data.first_name ?? data.firstName ?? ""),
      lastName: S(data.last_name ?? data.lastName ?? ""),
      phone: S(data.phone ?? data.tel ?? data.mobile ?? ""),
      asso_id: data.asso_id ?? data.assoId ?? undefined,
      member_id: data.member_id ?? null,
      type: data.type ?? undefined,
    }

    const hasAddr = addr.houseNo || addr.moo || addr.subdistrict || addr.district || addr.province || addr.postalCode
    if (addr.firstName || addr.lastName || hasAddr || addr.phone) {
      setCustomer((prev) => ({
        ...prev,
        fullName: (addr.firstName || addr.lastName) ? `${addr.firstName} ${addr.lastName}`.trim() || prev.fullName : prev.fullName,
        houseNo: addr.houseNo || prev.houseNo, moo: addr.moo || prev.moo, subdistrict: addr.subdistrict || prev.subdistrict,
        district: addr.district || prev.district, province: addr.province || prev.province, postalCode: addr.postalCode || prev.postalCode,
        phone: addr.phone || prev.phone,
      }))
      if (addr.type) setMemberMeta((m) => ({ ...m, type: addr.type }))
      if (addr.asso_id) setMemberMeta((m) => ({ ...m, assoId: addr.asso_id }))
      if (addr.member_id != null) setMemberMeta((m) => ({ ...m, memberId: toIntOrNull(addr.member_id) }))
    }
  }

  /** company map/pick */
  const mapCompanyToUI = (r = {}) => {
    const S = (v) => (v == null ? "" : String(v))
    return {
      assoId: r.asso_id ?? r.assoId ?? null,
      companyName: S(r.company_name ?? r.companyName ?? ""),
      taxId: onlyDigits(S(r.tax_id ?? r.taxId ?? "")),
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
    const d = mapCompanyToUI(rec)
    setCustomer((prev) => ({
      ...prev,
      companyName: d.companyName || prev.companyName,
      taxId: d.taxId || prev.taxId,
      companyPhone: d.phone || prev.companyPhone,
      hqHouseNo: d.hqHouseNo || prev.hqHouseNo, hqMoo: d.hqMoo || prev.hqMoo,
      hqSubdistrict: d.hqSubdistrict || prev.hqSubdistrict, hqDistrict: d.hqDistrict || prev.hqDistrict,
      hqProvince: d.hqProvince || prev.hqProvince, hqPostalCode: d.hqPostalCode || prev.hqPostalCode,
      brHouseNo: d.brHouseNo || prev.brHouseNo, brMoo: d.brMoo || prev.brMoo, brSubdistrict: d.brSubdistrict || prev.brSubdistrict,
      brDistrict: d.brDistrict || prev.brDistrict, brProvince: d.brProvince || prev.brProvince, brPostalCode: d.brPostalCode || prev.brPostalCode,
    }))
    setMemberMeta({ type: "company", assoId: d.assoId ?? null, memberId: null })
    setShowCompanyList(false); setCompanyResults([]); setCompanyHighlighted(-1)
  }

  /** ---------- Load dropdowns (SELL endpoints) ---------- */
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
            fetchFirstOkJson(["/order/payment/search/sell"]), // SELL
            fetchFirstOkJson(["/order/branch/search"]),
            fetchFirstOkJson(["/order/business/search"]),
          ])

        setProductOptions((products || []).map((x) => ({ id: String(x.id ?? x.product_id ?? ""), label: String(x.product_type ?? x.name ?? "").trim() })).filter(o=>o.id&&o.label))
        setConditionOptions((conditions || []).map((x,i)=>({ id:String(x.id ?? x.value ?? i), label:String(x.condition ?? x.name ?? "").trim() })).filter(o=>o.id&&o.label))
        setFieldTypeOptions((fields || []).map((x,i)=>({ id:String(x.id ?? x.value ?? i), label:String(x.field ?? x.field_type ?? x.name ?? "").trim() })).filter(o=>o.id&&o.label))
        setYearOptions((years || []).map((x,i)=>({ id:String(x.id ?? x.value ?? i), label:String(x.year ?? x.name ?? "").trim() })).filter(o=>o.id&&o.label))
        setProgramOptions((programs || []).map((x,i)=>({ id:String(x.id ?? x.value ?? i), label:String(x.program ?? x.name ?? "").trim() })).filter(o=>o.id&&o.label))
        setPaymentOptions((payments || []).map((x,i)=>({ id:String(x.id ?? x.value ?? i), label:String(x.payment ?? x.name ?? "").trim() })).filter(o=>o.id&&o.label))
        setBranchOptions((branches || []).map((b)=>({ id:b.id, label:b.branch_name })))
        setBusinessOptions((businesses || []).map((x,i)=>({ id:String(x.id ?? x.value ?? i), label:String(x.business ?? x.name ?? "").trim() })).filter(o=>o.id&&o.label))
      } catch (err) {
        console.error("loadStaticDD fatal:", err)
        setProductOptions([]); setConditionOptions([]); setFieldTypeOptions([]); setYearOptions([])
        setProgramOptions([]); setPaymentOptions([]); setBranchOptions([]); setBusinessOptions([])
      }
    }
    loadStaticDD()
  }, [])

  /** company dropdown outside click */
  useEffect(() => {
    const onClick = (e) => {
      if (!companyBoxRef.current) return
      if (!companyBoxRef.current.contains(e.target)) { setShowCompanyList(false); setCompanyHighlighted(-1) }
    }
    document.addEventListener("click", onClick)
    return () => document.removeEventListener("click", onClick)
  }, [])

  /** search company by name */
  useEffect(() => {
    if (buyerType !== "company") { setShowCompanyList(false); setCompanyResults([]); setCompanyHighlighted(-1); return }
    const q = (debouncedCompanyName || "").trim()
    if (companySuppressSearchRef.current) { companySuppressSearchRef.current=false; setShowCompanyList(false); setCompanyResults([]); setCompanyHighlighted(-1); return }
    if (q.length < 2) { setCompanyResults([]); setShowCompanyList(false); setCompanyHighlighted(-1); return }

    const searchCompany = async () => {
      try {
        setLoadingCustomer(true)
        const items = (await apiAuth(`/order/companies/search?q=${encodeURIComponent(q)}`)) || []
        setCompanyResults(items)
        if (document.activeElement === companyInputRef.current) { setShowCompanyList(true); setCompanyHighlighted(items.length>0?0:-1) }
      } catch (err) {
        console.error(err); setCompanyResults([]); setShowCompanyList(false); setCompanyHighlighted(-1)
      } finally { setLoadingCustomer(false) }
    }
    searchCompany()
  }, [debouncedCompanyName, buyerType])

  /** search by tax_id (13 digits) */
  useEffect(() => {
    if (buyerType !== "company") return
    const tid = onlyDigits(debouncedTaxId)
    if (tid.length !== 13) return
    const searchByTax = async () => {
      try {
        setLoadingCustomer(true)
        const items = (await apiAuth(`/order/companies/search?q=${encodeURIComponent(tid)}`)) || []
        if (items.length > 0) await pickCompanyResult(items[0])
      } catch (e) { console.error(e) } finally { setLoadingCustomer(false) }
    }
    searchByTax()
  }, [debouncedTaxId, buyerType])

  /** company list keyboard */
  const handleCompanyKeyDown = async (e) => {
    if (!showCompanyList || companyResults.length === 0) return
    if (e.key === "ArrowDown") { e.preventDefault(); const next=companyHighlighted<companyResults.length-1?companyHighlighted+1:0; setCompanyHighlighted(next); requestAnimationFrame(()=>companyItemRefs.current[next]?.scrollIntoView({block:"nearest"})) }
    else if (e.key === "ArrowUp") { e.preventDefault(); const prev=companyHighlighted>0?companyHighlighted-1:companyResults.length-1; setCompanyHighlighted(prev); requestAnimationFrame(()=>companyItemRefs.current[prev]?.scrollIntoView({block:"nearest"})) }
    else if (e.key === "Enter") { e.preventDefault(); if (companyHighlighted>=0 && companyHighlighted<companyResults.length) await pickCompanyResult(companyResults[companyHighlighted]) }
    else if (e.key === "Escape") { e.preventDefault(); setShowCompanyList(false); setCompanyHighlighted(-1) }
  }

  /** pick lists (product → species → variant) */
  useEffect(() => {
    const pid = order.productId
    if (!pid) { setRiceOptions([]); setOrder((p)=>({ ...p, riceId:"", riceType:"", subriceId:"", subriceName:"" })); return }
    const loadSpecies = async () => {
      try {
        const arr = (await apiAuth(`/order/species/search?product_id=${encodeURIComponent(pid)}`)) || []
        setRiceOptions(arr.map((x)=>({ id:String(x.id ?? x.species_id ?? ""), label:String(x.species ?? x.name ?? "").trim() })).filter(o=>o.id&&o.label))
      } catch (e) { console.error("load species error:", e); setRiceOptions([]) }
    }
    loadSpecies()
  }, [order.productId])

  useEffect(() => {
    const rid = order.riceId
    if (!rid) { setSubriceOptions([]); setOrder((p)=>({ ...p, subriceId:"", subriceName:"" })); return }
    const loadVariant = async () => {
      try {
        const arr = (await apiAuth(`/order/variant/search?species_id=${encodeURIComponent(rid)}`)) || []
        setSubriceOptions(arr.map((x)=>({ id:String(x.id ?? x.variant_id ?? ""), label:String(x.variant ?? x.name ?? "").trim() })).filter(o=>o.id&&o.label))
      } catch (e) { console.error("load variant error:", e); setSubriceOptions([]) }
    }
    loadVariant()
  }, [order.riceId])

  /** branch → klang */
  useEffect(() => {
    const bId = order.branchId
    const bName = order.branchName?.trim()
    if (bId == null && !bName) { setKlangOptions([]); setOrder((p)=>({ ...p, klangName:"", klangId:null })); return }
    const loadKlang = async () => {
      try {
        const qs = bId != null ? `branch_id=${bId}` : `branch_name=${encodeURIComponent(bName)}`
        const data = await apiAuth(`/order/klang/search?${qs}`)
        setKlangOptions((data || []).map((k)=>({ id:k.id, label:k.klang_name })))
      } catch (e) { console.error("Load klang error:", e); setKlangOptions([]) }
    }
    loadKlang()
  }, [order.branchId, order.branchName])

  /** map record → UI (person) */
  const mapSimplePersonToUI = (r = {}) => {
    const S = (v) => (v == null ? "" : String(v))
    return {
      citizenId: S(r.citizen_id ?? r.citizenId ?? ""),
      firstName: S(r.first_name ?? r.firstName ?? ""),
      lastName:  S(r.last_name ?? r.lastName ?? ""),
      fullName: `${S(r.first_name ?? r.firstName ?? "")} ${S(r.last_name ?? r.lastName ?? "")}`.trim(),
      assoId: r.asso_id ?? r.assoId ?? null,
      type: r.type ?? "unknown",
      houseNo: S(r.address ?? r.house_no ?? r.houseNo ?? ""),
      moo: S(r.mhoo ?? r.moo ?? ""),
      subdistrict: S(r.sub_district ?? r.subdistrict ?? r.subDistrict ?? ""),
      district: S(r.district ?? ""),
      province: S(r.province ?? ""),
      postalCode: onlyDigits(S(r.postal_code ?? r.postalCode ?? "")),
      phone: S(r.phone ?? r.tel ?? r.mobile ?? ""),
      memberId: r.member_id != null ? toIntOrNull(r.member_id) : null,
    }
  }

  const fillFromRecord = async (raw = {}) => {
    const d = mapSimplePersonToUI(raw)
    setCustomer((prev)=>({
      ...prev,
      citizenId: onlyDigits(d.citizenId || prev.citizenId),
      fullName: d.fullName || prev.fullName,
      phone: d.phone || prev.phone,
      memberId: d.memberId != null ? String(d.memberId) : prev.memberId,
    }))
    setMemberMeta({ type: d.type, assoId: d.assoId, memberId: d.memberId })
    setCustomerFound(true)

    const hasAddr = d.houseNo || d.moo || d.subdistrict || d.district || d.province || d.postalCode
    if (hasAddr) {
      setCustomer((prev)=>({
        ...prev,
        houseNo: d.houseNo || prev.houseNo, moo: d.moo || prev.moo, subdistrict: d.subdistrict || prev.subdistrict,
        district: d.district || prev.district, province: d.province || prev.province, postalCode: d.postalCode || prev.postalCode,
      }))
      return
    }
    const cid = onlyDigits(d.citizenId)
    if (cid.length === 13) await loadAddressByCitizenId(cid)
  }

  /** search by member_id (primary for person) */
  useEffect(() => {
    if (buyerType !== "person") { setCustomerFound(null); return }
    const mid = toIntOrNull(debouncedMemberId)
    if (mid == null || mid <= 0) return
    const fetchByMID = async () => {
      try {
        setLoadingCustomer(true)
        const arr = (await apiAuth(`/order/customers/search?q=${encodeURIComponent(String(mid))}`)) || []
        const exact = arr.find((r)=> r.type === "member" && toIntOrNull(r.member_id) === mid) || arr[0]
        if (exact) await fillFromRecord(exact)
        else { setCustomerFound(false); setMemberMeta({ type:"customer", assoId:null, memberId:null }) }
      } catch (e) {
        console.error(e); setCustomerFound(false); setMemberMeta({ type:"customer", assoId:null, memberId:null })
      } finally { setLoadingCustomer(false) }
    }
    fetchByMID()
  }, [debouncedMemberId, buyerType])

  /** search by citizen_id (keep for address; DO NOT override if 000... or already chosen) */
  useEffect(() => {
    if (buyerType !== "person") { setCustomerFound(null); setMemberMeta({ type:"unknown", assoId:null, memberId:null }); return }
    const cid = onlyDigits(debouncedCitizenId)
    if (memberMeta.memberId || memberMeta.assoId) return          // already chosen
    if (/^0{13}$/.test(cid)) { setCustomerFound(null); return }    // guard for 000...
    if (cid.length !== 13) { setCustomerFound(null); return }
    const fetchByCID = async () => {
      try {
        setLoadingCustomer(true)
        const arr = (await apiAuth(`/order/customers/search?q=${encodeURIComponent(cid)}`)) || []
        const exact = arr.find((r)=> onlyDigits(r.citizen_id || r.citizenId || "") === cid) || arr[0]
        if (exact) await fillFromRecord(exact)
        else { setCustomerFound(false); setMemberMeta({ type:"customer", assoId:null, memberId:null }) }
      } catch (e) {
        console.error(e); setCustomerFound(false); setMemberMeta({ type:"customer", assoId:null, memberId:null })
      } finally { setLoadingCustomer(false) }
    }
    fetchByCID()
  }, [debouncedCitizenId, buyerType, memberMeta.memberId, memberMeta.assoId])

  /** search by name (person) */
  useEffect(() => {
    if (buyerType !== "person") { setShowNameList(false); setNameResults([]); setHighlightedIndex(-1); setMemberMeta({ type:"unknown", assoId:null, memberId:null }); return }
    const q = (debouncedFullName || "").trim()
    if (suppressNameSearchRef.current) { suppressNameSearchRef.current=false; setShowNameList(false); setNameResults([]); setHighlightedIndex(-1); return }
    if (q.length < 2) { setNameResults([]); setShowNameList(false); setHighlightedIndex(-1); return }

    const searchByName = async () => {
      try {
        setLoadingCustomer(true)
        const items = (await apiAuth(`/order/customers/search?q=${encodeURIComponent(q)}`)) || []
        const mapped = items.map((r)=>({ ...r,
          address: r.address ?? r.house_no ?? r.houseNo ?? "",
          mhoo: r.mhoo ?? r.moo ?? "",
          sub_district: r.sub_district ?? r.subdistrict ?? r.subDistrict ?? "",
          district: r.district ?? "", province: r.province ?? "",
          postal_code: r.postal_code ?? r.postalCode ?? "",
          phone: r.phone ?? r.tel ?? r.mobile ?? "",
        }))
        setNameResults(mapped)
        if (document.activeElement === nameInputRef.current) { setShowNameList(true); setHighlightedIndex(mapped.length>0?0:-1) }
      } catch (err) {
        console.error(err); setNameResults([]); setShowNameList(false); setHighlightedIndex(-1)
      } finally { setLoadingCustomer(false) }
    }
    searchByName()
  }, [debouncedFullName, buyerType])

  useEffect(() => {
    const onClick = (e) => {
      if (!nameBoxRef.current) return
      if (!nameBoxRef.current.contains(e.target)) { setShowNameList(false); setHighlightedIndex(-1) }
    }
    document.addEventListener("click", onClick)
    return () => document.removeEventListener("click", onClick)
  }, [])

  const pickNameResult = async (rec) => {
    suppressNameSearchRef.current = true
    await fillFromRecord(rec)
    setShowNameList(false); setNameResults([]); setHighlightedIndex(-1)
  }

  const scrollHighlightedIntoView2 = (index) => {
    const itemEl = itemRefs.current[index]
    const listEl = listContainerRef.current
    if (!itemEl || !listEl) return
    try { itemEl.scrollIntoView({ block:"nearest", inline:"nearest" }) }
    catch {
      const itemRect = itemEl.getBoundingClientRect(), listRect = listEl.getBoundingClientRect(), buffer = 6
      if (itemRect.top < listRect.top + buffer) listEl.scrollTop -= (listRect.top + buffer) - itemRect.top
      else if (itemRect.bottom > listRect.bottom - buffer) listEl.scrollTop += itemRect.bottom - (listRect.bottom - buffer)
    }
  }
  useEffect(() => { if (showNameList && highlightedIndex >= 0) requestAnimationFrame(()=>scrollHighlightedIntoView2(highlightedIndex)) }, [highlightedIndex, showNameList])

  const handleNameKeyDown = async (e) => {
    if (!showNameList || nameResults.length === 0) return
    if (e.key === "ArrowDown") { e.preventDefault(); const next=highlightedIndex<nameResults.length-1?highlightedIndex+1:0; setHighlightedIndex(next); requestAnimationFrame(()=>scrollHighlightedIntoView2(next)) }
    else if (e.key === "ArrowUp") { e.preventDefault(); const prev=highlightedIndex>0?highlightedIndex-1:nameResults.length-1; setHighlightedIndex(prev); requestAnimationFrame(()=>scrollHighlightedIntoView2(prev)) }
    else if (e.key === "Enter") { e.preventDefault(); if (highlightedIndex>=0 && highlightedIndex<nameResults.length) await pickNameResult(nameResults[highlightedIndex]) }
    else if (e.key === "Escape") { e.preventDefault(); setShowNameList(false); setHighlightedIndex(-1) }
  }

  /** ---------- scale / net / amount ---------- */
  const grossFromScale = useMemo(() => {
    const entry = toNumber(order.entryWeightKg)
    const exit = toNumber(order.exitWeightKg)
    const g = Math.abs(exit - entry)
    return g > 0 ? g : 0
  }, [order.entryWeightKg, order.exitWeightKg])

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

  /** ---------- Payment resolver (SELL: 1/2) ---------- */
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
  const resolvePaymentIdForBE = () => (isCreditPayment() ? 2 : 1) // SELL: credit=2, cash=1

  /** ---------- Missing hints / validation ---------- */
  const redHintCls = (key) => (missingHints[key] ? "border-red-400 ring-2 ring-red-300 focus:border-red-400 animate-pulse" : "")
  const clearHint = (key) => setMissingHints((prev) => (prev[key] ? { ...prev, [key]: false } : prev))
  const computeMissingHints = () => {
    const m = {}
    if (buyerType === "person") {
      if (!customer.fullName.trim()) m.fullName = true
      if (!customer.houseNo.trim()) m.houseNo = true
      if (!customer.moo.trim()) m.moo = true
      if (!customer.subdistrict.trim()) m.subdistrict = true
      if (!customer.district.trim()) m.district = true
      if (!customer.province.trim()) m.province = true
    } else {
      if (!customer.companyName.trim()) m.companyName = true
      if (!customer.taxId.trim()) m.taxId = true
      if (!customer.hqHouseNo.trim()) m.hqHouseNo = true
      if (!customer.hqSubdistrict.trim()) m.hqSubdistrict = true
      if (!customer.hqDistrict.trim()) m.hqDistrict = true
      if (!customer.hqProvince.trim()) m.hqProvince = true
    }
    if (!order.productId) m.product = true
    if (!order.riceId) m.riceType = true
    if (!order.subriceId) m.subrice = true
    if (!order.conditionId) m.condition = true
    if (!order.fieldTypeId) m.fieldType = true
    if (!order.riceYearId) m.riceYear = true
    if (!order.businessTypeId) m.businessType = true
    if (!order.branchName) m.branchName = true
    if (!order.klangName) m.klangName = true
    const pid = resolvePaymentId()
    if (!pid) m.payment = true
    if (!order.entryWeightKg || Number(order.entryWeightKg) < 0) m.entryWeightKg = true
    if (!order.exitWeightKg || Number(order.exitWeightKg) <= 0) m.exitWeightKg = true
    if (grossFromScale <= 0) m.netFromScale = true
    if (!order.amountTHB || moneyToNumber(order.amountTHB) <= 0) m.amountTHB = true
    if (!order.issueDate) m.issueDate = true
    return m
  }

  const validateAll = () => {
    const e = {}
    if (buyerType === "person") {
      if (!customer.fullName) e.fullName = "กรุณากรอกชื่อ–สกุล"
      if (!customer.subdistrict || !customer.district || !customer.province) e.address = "กรุณากรอกที่อยู่ให้ครบ"
      if (!toIntOrNull(memberMeta.memberId ?? customer.memberId) && !memberMeta.assoId) {
        e.memberId = "กรุณาระบุรหัสสมาชิก (member_id) หรือเลือกจากรายชื่อที่มี asso_id"
      }
    } else {
      if (!customer.companyName.trim()) e.companyName = "กรุณากรอกชื่อบริษัท"
      if (!customer.taxId.trim() || onlyDigits(customer.taxId).length !== 13) e.taxId = "กรุณากรอกเลขผู้เสียภาษี (13 หลัก)"
      if (!customer.hqSubdistrict || !customer.hqDistrict || !customer.hqProvince) e.hqAddress = "กรุณากรอกที่อยู่สำนักงานใหญ่ให้ครบ"
    }
    if (!order.productId) e.product = "เลือกประเภทสินค้า"
    if (!order.riceId) e.riceType = "เลือกชนิดข้าว"
    if (!order.subriceId) e.subrice = "เลือกชั้นย่อย"
    if (!order.conditionId) e.condition = "เลือกสภาพ"
    if (!order.fieldTypeId) e.fieldType = "เลือกประเภทนา"
    if (!order.riceYearId) e.riceYear = "เลือกปี/ฤดูกาล"
    if (!order.businessTypeId) e.businessType = "เลือกประเภทธุรกิจ"
    if (!order.branchName) e.branchName = "เลือกสาขา"
    if (!order.klangName) e.klangName = "เลือกคลัง"
    const pid = resolvePaymentId()
    if (!pid) e.payment = "เลือกวิธีชำระเงิน"
    if (order.entryWeightKg === "" || Number(order.entryWeightKg) < 0) e.entryWeightKg = "กรอกน้ำหนักก่อนชั่ง"
    if (order.exitWeightKg === "" || Number(order.exitWeightKg) <= 0) e.exitWeightKg = "กรอกน้ำหนักหลังชั่ง"
    if (grossFromScale <= 0) e.exitWeightKg = "ค่าน้ำหนักจากตาชั่งต้องมากกว่า 0"
    if (order.manualDeduct && (order.deductWeightKg === "" || Number(order.deductWeightKg) < 0)) e.deductWeightKg = "กรอกน้ำหนักหักให้ถูกต้อง"
    const amt = moneyToNumber(order.amountTHB)
    if (!amt || amt <= 0) e.amountTHB = "กรอกจำนวนเงินให้ถูกต้อง"
    if (!order.issueDate) e.issueDate = "กรุณาเลือกวันที่"
    setErrors(e)
    return e
  }

  const scrollToFirstError = (eObj) => {
    const personKeys = ["memberId", "fullName", "address"]
    const companyKeys = ["companyName", "taxId", "hqAddress"]
    const commonOrderKeys = ["product","riceType","subrice","condition","fieldType","riceYear","businessType","branchName","klangName","payment","entryWeightKg","exitWeightKg","deductWeightKg","amountTHB","issueDate"]
    const keys = (buyerType === "person" ? personKeys : companyKeys).concat(commonOrderKeys)
    const firstKey = keys.find((k) => k in eObj)
    if (!firstKey) return
    const mapAddressFocus = firstKey === "address"
      ? customer.houseNo ? (customer.moo ? (customer.subdistrict ? (customer.district ? "province" : "district") : "subdistrict") : "moo") : "houseNo"
      : firstKey === "hqAddress"
      ? customer.hqHouseNo ? (customer.hqSubdistrict ? (customer.hqDistrict ? "hqProvince" : "hqDistrict") : "hqSubdistrict") : "hqHouseNo"
      : firstKey
    const el = refs[mapAddressFocus]?.current || (firstKey === "payment" ? refs.payment?.current : null)
    if (el?.focus) { try { el.scrollIntoView({ behavior:"smooth", block:"center" }) } catch {} el.focus() }
  }

  /** ---------- Template effects ---------- */
  const isTemplateActive = formTemplate !== "0"
  useEffect(() => {
    if (!isTemplateActive) return
    if (productOptions.length === 0) return
    const paddy = productOptions.find((o) => o.label.includes("ข้าวเปลือก"))
    if (paddy && order.productId !== paddy.id) {
      setOrder((p) => ({ ...p, productId: paddy.id, productName: paddy.label, riceId:"", riceType:"", subriceId:"", subriceName:"" }))
    }
  }, [formTemplate, productOptions])

  useEffect(() => {
    if (!isTemplateActive) return
    if (riceOptions.length === 0) return
    const want = formTemplate === "1" ? "หอมมะลิ" : formTemplate === "2" ? "เหนียว" : "พันธุ์"
    const target = riceOptions.find((r) => r.label.includes(want))
    if (target && order.riceId !== target.id) {
      setOrder((p) => ({ ...p, riceId: target.id, riceType: target.label, subriceId:"", subriceName:"" }))
    }
  }, [formTemplate, riceOptions])

  /** ---------- Submit ---------- */
  const toIsoDateTime = (yyyyMmDd) => {
    try { return new Date(`${yyyyMmDd}T12:00:00Z`).toISOString() } catch { return new Date().toISOString() }
  }

  const updateCustomer = (k, v) => { if (String(v).trim() !== "") clearHint(k); setCustomer((prev)=>({ ...prev, [k]: v })) }
  const updateOrder = (k, v) => { if (String(v).trim() !== "") clearHint(k); setOrder((prev)=>({ ...prev, [k]: v })) }

  const handleSubmit = async (e) => {
    e.preventDefault()
    const hints = computeMissingHints()
    setMissingHints(hints)
    const eObj = validateAll()
    if (Object.keys(eObj).length > 0) { scrollToFirstError(eObj); return }

    // split name (person)
    const [firstName, ...rest] = (customer.fullName || "").trim().split(" ")
    const lastName = rest.join(" ")

    // numbers
    const productId = /^\d+$/.test(order.productId) ? Number(order.productId) : null
    const riceId = /^\d+$/.test(order.riceId) ? Number(order.riceId) : null
    const subriceId = /^\d+$/.test(order.subriceId) ? Number(order.subriceId) : null
    const branchId = order.branchId != null ? Number(order.branchId) : null
    const klangId = order.klangId != null ? Number(order.klangId) : null
    const riceYearId = /^\d+$/.test(order.riceYearId) ? Number(order.riceYearId) : null
    const conditionId = /^\d+$/.test(order.conditionId) ? Number(order.conditionId) : null
    const fieldTypeId = /^\d+$/.test(order.fieldTypeId) ? Number(order.fieldTypeId) : null
    const businessTypeId = /^\d+$/.test(order.businessTypeId) ? Number(order.businessTypeId) : null
    const programId = /^\d+$/.test(order.programId) ? Number(order.programId) : null
    const paymentId = resolvePaymentIdForBE()

    // guard
    if (!productId) return scrollToFirstError({ product: true })
    if (!riceId) return scrollToFirstError({ riceType: true })
    if (!subriceId) return scrollToFirstError({ subrice: true })
    if (!riceYearId) return scrollToFirstError({ riceYear: true })
    if (!conditionId) return scrollToFirstError({ condition: true })
    if (!fieldTypeId) return scrollToFirstError({ fieldType: true })
    if (!businessTypeId) return scrollToFirstError({ businessType: true })
    if (!branchId) return scrollToFirstError({ branchName: true })
    if (!klangId) return scrollToFirstError({ klangName: true })
    if (!paymentId) return scrollToFirstError({ payment: true })

    // weight
    const baseGross = grossFromScale
    const deduction = order.manualDeduct ? toNumber(order.deductWeightKg) : suggestDeductionWeight(baseGross, order.moisturePct, order.impurityPct)
    const netW = Math.max(0, baseGross - deduction)

    // customer payload (discriminator)
    let customerPayload
    if (buyerType === "person") {
      const memberIdNum = toIntOrNull(memberMeta.memberId ?? customer.memberId)
      const assoIdVal = memberMeta.assoId || null
      if (!memberIdNum && !assoIdVal) { alert("กรุณาระบุรหัสสมาชิก (member_id) หรือเลือกบุคคลที่มี asso_id จากผลค้นหา"); return }
      customerPayload = memberIdNum
        ? { party_type:"individual", member_id: memberIdNum, first_name: firstName || "", last_name: lastName || "" }
        : { party_type:"individual", asso_id: assoIdVal, first_name: firstName || "", last_name: lastName || "" }
    } else {
      const taxId = onlyDigits(customer.taxId)
      customerPayload = taxId
        ? { party_type:"company", tax_id: taxId }
        : memberMeta.assoId
        ? { party_type:"company", asso_id: memberMeta.assoId }
        : { party_type:"company", tax_id: "" } // ให้ BE แจ้ง error เอง
    }

    const makeDeptDate = (yyyyMmDd) => {
      try { return new Date(`${yyyyMmDd}T00:00:00Z`).toISOString() } catch { return new Date().toISOString() }
    }
    const deptPayload = {
      date_created: makeDeptDate(order.issueDate),
      allowed_period: Number(dept.allowedPeriod || 0),
      postpone: Boolean(dept.postpone),
      postpone_period: Number(dept.postponePeriod || 0),
    }

    // spec (ProductSpecIn)
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
        business_type: businessTypeId,
      },
      dept: deptPayload,
    }

    try {
      await post("/order/customers/save/sell", payload) // SELL
      try { localStorage.setItem("sales.formTemplate", formTemplate) } catch {}
      alert("บันทึกออเดอร์ขายเรียบร้อย ✅")
      handleReset()
    } catch (err) {
      console.error("SAVE ERROR:", err?.data || err)
      const detail = err?.data?.detail ? `\n\nรายละเอียด:\n${JSON.stringify(err.data.detail, null, 2)}` : ""
      alert(`บันทึกล้มเหลว: ${err.message || "เกิดข้อผิดพลาด"}${detail}`)
    }
  }

  const handleReset = () => {
    setErrors({}); setMissingHints({}); setCustomerFound(null); setLoadingCustomer(false)
    setNameResults([]); setShowNameList(false); setHighlightedIndex(-1)
    setMemberMeta({ type:"unknown", assoId:null, memberId:null })
    setCustomer({
      citizenId:"", memberId:"", fullName:"", houseNo:"", moo:"", subdistrict:"", district:"", province:"", postalCode:"", phone:"",
      companyName:"", taxId:"", companyPhone:"",
      hqHouseNo:"", hqMoo:"", hqSubdistrict:"", hqDistrict:"", hqProvince:"", hqPostalCode:"",
      brHouseNo:"", brMoo:"", brSubdistrict:"", brDistrict:"", brProvince:"", brPostalCode:"",
    })
    setOrder({
      productId:"", productName:"", riceId:"", riceType:"", subriceId:"", subriceName:"",
      gram:"", riceYear:"", riceYearId:"", condition:"", conditionId:"", fieldType:"", fieldTypeId:"",
      programId:"", programName:"", paymentMethod:"", paymentMethodId:"",
      businessType:"", businessTypeId:"", entryWeightKg:"", exitWeightKg:"", moisturePct:"", impurityPct:"",
      manualDeduct:false, deductWeightKg:"", unitPrice:"", amountTHB:"", paymentRefNo:"", issueDate:new Date().toISOString().slice(0,10),
      branchName:"", branchId:null, klangName:"", klangId:null, comment:"",
    })
    setRiceOptions([]); setSubriceOptions([]); setKlangOptions([])
    setDept({ allowedPeriod:30, postpone:false, postponePeriod:0 })
    setBuyerType("person")
  }

  /** ---------- UI ---------- */
  const hasRed = (k) => !!errors[k] || !!missingHints[k]
  const redFieldCls = (k) => (hasRed(k) ? "border-red-500 ring-2 ring-red-300 focus:ring-0 focus:border-red-500" : "")

  return (
    <div className="min-h-screen bg-white text-black dark:bg-slate-900 dark:text-white rounded-2xl text-[15px] md:text-base">
      <div className="mx-auto max-w-7xl p-5 md:p-6 lg:p-8">
        <h1 className="mb-4 text-3xl font-bold">🧾 บันทึกออเดอร์ขายข้าว</h1>

        {/* กล่องข้อมูลลูกค้า */}
        <div className="mb-6 rounded-2xl border border-slate-200 bg-white p-5 text-black shadow-sm dark:border-slate-700 dark:bg-slate-800 dark:text-white">
          <div className="mb-3 flex flex-wrap items-start gap-2">
            <h2 className="text-xl font-semibold">ข้อมูลลูกค้า</h2>

            {/* Badge สถานะ */}
            {buyerType === "person" ? (
              memberMeta.type === "member" ? (
                <span className="inline-flex items-center gap-2 rounded-full bg-emerald-50 px-3 py-1.5 text-emerald-700 ring-1 ring-emerald-200 dark:bg-emerald-900/20 dark:text-emerald-200 dark:ring-emerald-700/60 self-start">
                  <span className="h-2 w-2 rounded-full bg-emerald-500" />
                  สมาชิก • member_id {memberMeta.memberId ?? "-"}
                </span>
              ) : customerFound === true && memberMeta.type === "customer" ? (
                <span className="inline-flex items-center gap-2 rounded-full bg-sky-50 px-3 py-1.5 text-sky-700 ring-1 ring-sky-200 dark:bg-sky-900/20 dark:text-sky-200 dark:ring-sky-700/60 self-start">
                  <span className="h-2 w-2 rounded-full bg-sky-500" />
                  ลูกค้าทั่วไป • asso {memberMeta.assoId ?? "-"}
                </span>
              ) : (
                <span className="inline-flex items-center gap-2 rounded-full bg-amber-50 px-3 py-1.5 text-amber-700 ring-1 ring-amber-200 dark:bg-amber-900/20 dark:text-amber-200 dark:ring-amber-700/60 self-start">
                  <span className="h-2 w-2 rounded-full bg-amber-500" />
                  โปรดกรอก <b>member_id</b> หรือค้นหาชื่อเพื่อเลือกบุคคล
                </span>
              )
            ) : (
              <span className="inline-flex items-center gap-2 rounded-full bg-indigo-50 px-3 py-1.5 text-indigo-700 ring-1 ring-indigo-200 dark:bg-indigo-900/20 dark:text-indigo-200 dark:ring-indigo-700/60 self-start">
                <span className="h-2 w-2 rounded-full bg-indigo-500" />
                บริษัท / นิติบุคคล
              </span>
            )}

            {/* ประเภทผู้ซื้อ */}
            <div className="ml-auto w-full sm:w-64 self-start">
              <label className={labelCls}>ประเภทผู้ซื้อ</label>
              <ComboBox options={buyerTypeOptions} value={buyerType} onChange={(id)=>setBuyerType(String(id))} buttonRef={refs.buyerType} />
            </div>

            {/* ฟอร์มสำเร็จรูป */}
            <div className="w-full sm:w-72 self-start">
              <label className={labelCls}>ฟอร์มสำเร็จรูป</label>
              <ComboBox options={templateOptions} value={formTemplate} onChange={(id)=>setFormTemplate(String(id))} buttonRef={refs.formTemplate} />
              {isTemplateActive && (
                <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
                  ระบบล็อก <b>ประเภทสินค้า: ข้าวเปลือก</b> และ
                  <b>{formTemplate === "1" ? " ข้าวหอมมะลิ" : formTemplate === "2" ? " ข้าวเหนียว" : " เมล็ดพันธุ์"}</b>
                </p>
              )}
            </div>
          </div>

          {/* วิธีชำระเงิน + วันที่ */}
          <div className="grid gap-4 md:grid-cols-3">
            <div>
              <label className={labelCls}>วิธีชำระเงิน</label>
              <ComboBox
                options={paymentOptions}
                value={paymentOptions.find((o) => o.label === order.paymentMethod)?.id ?? ""}
                onChange={(_id, found) => setOrder((p)=>({ ...p, paymentMethod: found?.label ?? "" }))}
                placeholder="— เลือกวิธีชำระเงิน —"
                buttonRef={refs.payment}
                onEnterNext={() => focusNext("payment")}
              />
            </div>
            <div>
              <label className={labelCls}>ลงวันที่</label>
              <DateInput ref={refs.issueDate} value={order.issueDate} onChange={(e)=>updateOrder("issueDate", e.target.value)} />
            </div>
          </div>

          {/* โหมดบุคคล */}
          {buyerType === "person" ? (
            <div className="mt-4 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              <div className="md:col-span-1">
                <label className={labelCls}>เลขที่บัตรประชาชน (เพื่อค้นหาที่อยู่)</label>
                <input ref={refs.citizenId} className={cx(baseField)} value={customer.citizenId} onChange={(e)=>updateCustomer("citizenId", e.target.value)} onKeyDown={onEnter("citizenId")} placeholder="เช่น 1234567890123" />
                <p className={helpTextCls}>* ค้นหา/เติมที่อยู่ให้ แต่จะอ้างอิง <b>member_id</b> ตอนบันทึก</p>
              </div>
              <div className="md:col-span-1">
                <label className={labelCls}>รหัสสมาชิก (member_id)</label>
                <input ref={refs.memberId} className={cx(baseField, hasRed("memberId") && "border-red-500 ring-2 ring-red-300")} value={customer.memberId} onChange={(e)=>updateCustomer("memberId", e.target.value)} onKeyDown={onEnter("memberId")} placeholder="เช่น 100234" />
              </div>
              <div className="md:col-span-1">
                <label className={labelCls}>ชื่อ–สกุล (พิมพ์เพื่อค้นหา)</label>
                <div ref={nameBoxRef} className="relative">
                  <input ref={nameInputRef} className={cx(baseField, redHintCls("fullName"))} value={customer.fullName} onChange={(e)=>updateCustomer("fullName", e.target.value)} onKeyDown={(e)=>{ onEnter("fullName")(e); handleNameKeyDown(e) }} placeholder="เช่น นายสมชาย ใจดี" />
                  {showNameList && (
                    <div ref={listContainerRef} className="absolute z-20 mt-1 max-h-72 w-full overflow-auto rounded-2xl border border-slate-200 bg-white text-black shadow-lg dark:border-slate-700 dark:bg-slate-800 dark:text-white">
                      {nameResults.map((r, idx)=>(
                        <button key={idx} ref={(el)=>itemRefs.current[idx]=el} type="button" onClick={()=>pickNameResult(r)}
                          className={cx("block w-full px-3 py-2.5 text-left hover:bg-emerald-50 dark:hover:bg-emerald-900/30", idx===highlightedIndex && "bg-emerald-100 dark:bg-emerald-400/20")}>
                          <div className="font-medium">{`${r.first_name ?? ""} ${r.last_name ?? ""}`.trim()}</div>
                          <div className="text-sm text-slate-600 dark:text-slate-300">{r.address} ม.{r.mhoo} ต.{r.sub_district} อ.{r.district} จ.{r.province}</div>
                          {r.member_id ? <div className="text-sm text-emerald-700 dark:text-emerald-300">member_id: {r.member_id}</div> : r.asso_id ? <div className="text-sm text-sky-700 dark:text-sky-300">asso: {String(r.asso_id).slice(0,8)}…</div> : null}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* address line */}
              <div><label className={labelCls}>บ้านเลขที่</label><input ref={refs.houseNo} className={cx(baseField, redHintCls("houseNo"))} value={customer.houseNo} onChange={(e)=>updateCustomer("houseNo", e.target.value)} onKeyDown={onEnter("houseNo")} /></div>
              <div><label className={labelCls}>หมู่</label><input ref={refs.moo} className={cx(baseField, redHintCls("moo"))} value={customer.moo} onChange={(e)=>updateCustomer("moo", e.target.value)} onKeyDown={onEnter("moo")} /></div>
              <div><label className={labelCls}>ตำบล</label><input ref={refs.subdistrict} className={cx(baseField, redHintCls("subdistrict"))} value={customer.subdistrict} onChange={(e)=>updateCustomer("subdistrict", e.target.value)} onKeyDown={onEnter("subdistrict")} /></div>
              <div><label className={labelCls}>อำเภอ</label><input ref={refs.district} className={cx(baseField, redHintCls("district"))} value={customer.district} onChange={(e)=>updateCustomer("district", e.target.value)} onKeyDown={onEnter("district")} /></div>
              <div><label className={labelCls}>จังหวัด</label><input ref={refs.province} className={cx(baseField, redHintCls("province"))} value={customer.province} onChange={(e)=>updateCustomer("province", e.target.value)} onKeyDown={onEnter("province")} /></div>
              <div><label className={labelCls}>รหัสไปรษณีย์</label><input ref={refs.postalCode} className={baseField} value={customer.postalCode} onChange={(e)=>updateCustomer("postalCode", e.target.value)} onKeyDown={onEnter("postalCode")} /></div>
              <div className="md:col-span-1 lg:col-span-3"><label className={labelCls}>เบอร์โทรศัพท์</label><input ref={refs.phone} className={baseField} value={customer.phone} onChange={(e)=>updateCustomer("phone", e.target.value)} onKeyDown={onEnter("phone")} /></div>
            </div>
          ) : (
            /* โหมดบริษัท */
            <div className="mt-4 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              <div className="md:col-span-1">
                <label className={labelCls}>ชื่อบริษัท</label>
                <div ref={companyBoxRef} className="relative">
                  <input ref={companyInputRef} className={cx(baseField, redHintCls("companyName"))} value={customer.companyName} onChange={(e)=>updateCustomer("companyName", e.target.value)} onKeyDown={(e)=>{ onEnter("companyName")(e); handleCompanyKeyDown(e) }} placeholder="พิมพ์เพื่อค้นหา" />
                  {showCompanyList && (
                    <div className="absolute z-20 mt-1 max-h-72 w-full overflow-auto rounded-2xl border border-slate-200 bg-white text-black shadow-lg dark:border-slate-700 dark:bg-slate-800 dark:text-white">
                      {companyResults.map((c, idx)=>(
                        <button key={idx} ref={(el)=>companyItemRefs.current[idx]=el} type="button" onClick={()=>pickCompanyResult(c)}
                          className={cx("block w-full px-3 py-2.5 text-left hover:bg-emerald-50 dark:hover:bg-emerald-900/30", idx===companyHighlighted && "bg-emerald-100 dark:bg-emerald-400/20")}>
                          <div className="font-medium">{c.company_name}</div>
                          <div className="text-sm text-slate-600 dark:text-slate-300">เลขผู้เสียภาษี: {c.tax_id}</div>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>
              <div><label className={labelCls}>เลขที่ผู้เสียภาษี</label><input ref={refs.taxId} className={cx(baseField, redHintCls("taxId"))} value={customer.taxId} onChange={(e)=>updateCustomer("taxId", e.target.value)} onKeyDown={onEnter("taxId")} placeholder="13 หลัก" /></div>
              <div><label className={labelCls}>เบอร์โทรบริษัท</label><input ref={refs.companyPhone} className={baseField} value={customer.companyPhone} onChange={(e)=>updateCustomer("companyPhone", e.target.value)} onKeyDown={onEnter("companyPhone")} /></div>

              <div><label className={labelCls}>ที่อยู่ (สำนักงานใหญ่)</label><input ref={refs.hqHouseNo} className={cx(baseField, redHintCls("hqHouseNo"))} value={customer.hqHouseNo} onChange={(e)=>updateCustomer("hqHouseNo", e.target.value)} onKeyDown={onEnter("hqHouseNo")} /></div>
              <div><label className={labelCls}>หมู่</label><input ref={refs.hqMoo} className={baseField} value={customer.hqMoo} onChange={(e)=>updateCustomer("hqMoo", e.target.value)} onKeyDown={onEnter("hqMoo")} /></div>
              <div><label className={labelCls}>ตำบล</label><input ref={refs.hqSubdistrict} className={cx(baseField, redHintCls("hqSubdistrict"))} value={customer.hqSubdistrict} onChange={(e)=>updateCustomer("hqSubdistrict", e.target.value)} onKeyDown={onEnter("hqSubdistrict")} /></div>
              <div><label className={labelCls}>อำเภอ</label><input ref={refs.hqDistrict} className={cx(baseField, redHintCls("hqDistrict"))} value={customer.hqDistrict} onChange={(e)=>updateCustomer("hqDistrict", e.target.value)} onKeyDown={onEnter("hqDistrict")} /></div>
              <div><label className={labelCls}>จังหวัด</label><input ref={refs.hqProvince} className={cx(baseField, redHintCls("hqProvince"))} value={customer.hqProvince} onChange={(e)=>updateCustomer("hqProvince", e.target.value)} onKeyDown={onEnter("hqProvince")} /></div>
              <div><label className={labelCls}>รหัสไปรษณีย์</label><input ref={refs.hqPostalCode} className={baseField} value={customer.hqPostalCode} onChange={(e)=>updateCustomer("hqPostalCode", e.target.value)} onKeyDown={onEnter("hqPostalCode")} /></div>
            </div>
          )}
        </div>

        {/* กล่องรายละเอียดออเดอร์ */}
        <div className="mb-6 rounded-2xl border border-slate-200 bg-white p-5 text-black shadow-sm dark:border-slate-700 dark:bg-slate-800 dark:text-white">
          <h2 className="mb-3 text-xl font-semibold">รายละเอียดออเดอร์</h2>

          {/* บรรทัด spec / program / business */}
          <div className="grid gap-4 md:grid-cols-3">
            <div>
              <label className={labelCls}>ประเภทสินค้า</label>
              <ComboBox options={productOptions} value={order.productId} onChange={(id,opt)=>setOrder((p)=>({ ...p, productId:id, productName:opt?.label ?? "", riceId:"", riceType:"", subriceId:"", subriceName:"" }))} placeholder="— เลือกประเภทสินค้า —" buttonRef={refs.product} />
            </div>
            <div>
              <label className={labelCls}>ชนิดข้าว (Species)</label>
              <ComboBox options={riceOptions} value={order.riceId} onChange={(id,opt)=>setOrder((p)=>({ ...p, riceId:id, riceType:opt?.label ?? "", subriceId:"", subriceName:"" }))} placeholder="— เลือกชนิดข้าว —" buttonRef={refs.riceType} />
            </div>
            <div>
              <label className={labelCls}>ชั้นย่อย (Variant)</label>
              <ComboBox options={subriceOptions} value={order.subriceId} onChange={(id,opt)=>setOrder((p)=>({ ...p, subriceId:id, subriceName:opt?.label ?? "" }))} placeholder="— เลือกชั้นย่อย —" buttonRef={refs.subrice} />
            </div>

            <div>
              <label className={labelCls}>สภาพ/เงื่อนไข</label>
              <ComboBox options={conditionOptions} value={order.conditionId} onChange={(id,opt)=>setOrder((p)=>({ ...p, conditionId:id, condition:opt?.label ?? "" }))} placeholder="— เลือกสภาพ —" buttonRef={refs.condition} />
            </div>
            <div>
              <label className={labelCls}>ประเภทนา</label>
              <ComboBox options={fieldTypeOptions} value={order.fieldTypeId} onChange={(id,opt)=>setOrder((p)=>({ ...p, fieldTypeId:id, fieldType:opt?.label ?? "" }))} placeholder="— เลือกประเภทนา —" buttonRef={refs.fieldType} />
            </div>
            <div>
              <label className={labelCls}>ปี/ฤดูกาล</label>
              <ComboBox options={yearOptions} value={order.riceYearId} onChange={(id,opt)=>setOrder((p)=>({ ...p, riceYearId:id, riceYear:opt?.label ?? "" }))} placeholder="— เลือกปี/ฤดูกาล —" buttonRef={refs.riceYear} />
            </div>

            <div>
              <label className={labelCls}>ประเภทธุรกิจ</label>
              <ComboBox options={businessOptions} value={order.businessTypeId} onChange={(id,opt)=>setOrder((p)=>({ ...p, businessTypeId:id, businessType:opt?.label ?? "" }))} placeholder="— เลือกประเภทธุรกิจ —" buttonRef={refs.businessType} />
            </div>
            <div>
              <label className={labelCls}>โปรแกรม</label>
              <ComboBox options={programOptions} value={order.programId} onChange={(id,opt)=>setOrder((p)=>({ ...p, programId:id, programName:opt?.label ?? "" }))} placeholder="— (ถ้ามี) —" buttonRef={refs.program} />
            </div>
          </div>

          {/* สาขา/คลัง */}
          <div className="mt-4 grid gap-4 md:grid-cols-2">
            <div>
              <label className={labelCls}>สาขา</label>
              <ComboBox options={branchOptions} value={order.branchId ?? ""} onChange={(id,opt)=>setOrder((p)=>({ ...p, branchId:Number(id), branchName:opt?.label ?? "", klangId:null, klangName:"" }))} placeholder="— เลือกสาขา —" buttonRef={refs.branchName} />
            </div>
            <div>
              <label className={labelCls}>คลัง</label>
              <ComboBox options={klangOptions} value={order.klangId ?? ""} onChange={(id,opt)=>setOrder((p)=>({ ...p, klangId:Number(id), klangName:opt?.label ?? "" }))} placeholder="— เลือกคลัง —" buttonRef={refs.klangName} />
            </div>
          </div>

          {/* น้ำหนัก/ราคา */}
          <div className="mt-4 grid gap-4 md:grid-cols-3">
            <div><label className={labelCls}>ก่อนชั่ง (กก.)</label><input ref={refs.entryWeightKg} className={cx(baseField)} value={order.entryWeightKg} onChange={(e)=>updateOrder("entryWeightKg", e.target.value)} onKeyDown={onEnter("entryWeightKg")} /></div>
            <div><label className={labelCls}>หลังชั่ง (กก.)</label><input ref={refs.exitWeightKg} className={cx(baseField)} value={order.exitWeightKg} onChange={(e)=>updateOrder("exitWeightKg", e.target.value)} onKeyDown={onEnter("exitWeightKg")} /></div>
            <div><label className={labelCls}>ค่าความชื้น (%)</label><input ref={refs.moisturePct} className={baseField} value={order.moisturePct} onChange={(e)=>updateOrder("moisturePct", e.target.value)} onKeyDown={onEnter("moisturePct")} /></div>
            <div><label className={labelCls}>สิ่งเจือปน (%)</label><input ref={refs.impurityPct} className={baseField} value={order.impurityPct} onChange={(e)=>updateOrder("impurityPct", e.target.value)} onKeyDown={onEnter("impurityPct")} /></div>
            <div><label className={labelCls}>น้ำหนักหัก (กก.)</label><input ref={refs.deductWeightKg} className={baseField} value={order.manualDeduct ? order.deductWeightKg : Math.round(suggestDeductionWeight(grossFromScale, order.moisturePct, order.impurityPct))} onChange={(e)=>{ setOrder((p)=>({ ...p, manualDeduct:true, deductWeightKg:e.target.value })) }} onKeyDown={onEnter("deductWeightKg")} /></div>
            <div><label className={labelCls}>น้ำหนักสุทธิ (กก.)</label><input className={cx(baseField, "bg-slate-100 cursor-not-allowed")} value={netWeight} disabled /></div>
            <div><label className={labelCls}>ราคารับซื้อ (บาท/กก.)</label><input ref={refs.unitPrice} className={baseField} value={order.unitPrice} onChange={(e)=>updateOrder("unitPrice", e.target.value)} onKeyDown={onEnter("unitPrice")} /></div>
            <div><label className={labelCls}>ยอดเงิน (บาท)</label><input ref={refs.amountTHB} className={cx(baseField, hasRed("amountTHB") && "border-red-500 ring-2 ring-red-300")} value={order.amountTHB} onChange={(e)=>updateOrder("amountTHB", formatMoneyInput(e.target.value))} onKeyDown={onEnter("amountTHB")} /></div>
            <div><label className={labelCls}>เลขที่อ้างอิง</label><input ref={refs.paymentRefNo} className={baseField} value={order.paymentRefNo} onChange={(e)=>updateOrder("paymentRefNo", e.target.value)} onKeyDown={onEnter("paymentRefNo")} /></div>
          </div>

          <div className="mt-4">
            <label className={labelCls}>หมายเหตุ</label>
            <textarea ref={refs.comment} className={baseField} rows={3} value={order.comment} onChange={(e)=>updateOrder("comment", e.target.value)} />
          </div>
        </div>

        {/* ปุ่มบันทึก/ล้าง */}
        <div className="flex items-center gap-2">
          <button onClick={handleSubmit} className="rounded-2xl bg-emerald-600 px-5 py-3 text-white hover:bg-emerald-700">บันทึกออเดอร์ขาย</button>
          <button onClick={handleReset} className="rounded-2xl border border-slate-300 px-5 py-3 text-slate-700 hover:bg-slate-100 dark:text-slate-200 dark:border-slate-600 dark:hover:bg-slate-700/40">ล้างฟอร์ม</button>
          <div className="ml-auto text-slate-700 dark:text-slate-300">ยอดเงินสุทธิ: <b>{thb(moneyToNumber(order.amountTHB))}</b></div>
        </div>
      </div>
    </div>
  )
}

export default Sales
