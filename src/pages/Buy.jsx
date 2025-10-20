// src/pages/Buy.jsx
import { useEffect, useMemo, useRef, useState, forwardRef, useImperativeHandle } from "react"
import { apiAuth, post } from "../lib/api" // ✅ helper แนบโทเคนอัตโนมัติ

/** ----------- Utils ------------ */
const onlyDigits = (s = "") => s.replace(/\D+/g, "")
const toNumber = (v) => (v === "" || v === null || v === undefined ? 0 : Number(v))
const thb = (n) =>
  new Intl.NumberFormat("th-TH", { style: "currency", currency: "THB", maximumFractionDigits: 2 }).format(
    isFinite(n) ? n : 0
  )

// แปลงเป็นเลขจำนวนเต็ม ถ้าไม่ใช่ตัวเลขให้คืน null
const toIntOrNull = (v) => {
  if (v === null || v === undefined) return null
  const s = String(v).trim()
  return /^-?\d+$/.test(s) ? parseInt(s, 10) : null
}

function validateThaiCitizenId(id) {
  const cid = onlyDigits(id)
  if (cid.length !== 13) return false
  let sum = 0
  for (let i = 0; i < 12; i++) sum += Number(cid[i]) * (13 - i)
  const check = (11 - (sum % 11)) % 10
  return check === Number(cid[12])
}

// ⭐ ตรวจความยาวเลขผู้เสียภาษี (ทั่วไป 13 หลัก)
function validateThaiTaxId(tax) {
  const tid = onlyDigits(tax)
  return tid.length === 13
}

// debounce
function useDebounce(value, delay = 400) {
  const [debounced, setDebounced] = useState(value)
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delay)
    return () => clearTimeout(t)
  }, [value, delay])
  return debounced
}

/** ▶︎ เงิน: ช่วยให้พิมพ์แล้วขึ้นคอมม่า และแปลงกลับเป็นตัวเลข */
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

/** กฎคำนวณหักน้ำหนัก */
const MOISTURE_STD = 15
function suggestDeductionWeight(grossKg, moisturePct, impurityPct) {
  const w = toNumber(grossKg)
  const m = Math.max(0, toNumber(moisturePct) - MOISTURE_STD)
  const imp = Math.max(0, toNumber(impurityPct))
  const dedByMoisture = (m / 100) * w
  const dedByImpurity = (imp / 100) * w
  return Math.max(0, dedByMoisture + dedByImpurity)
}

/** ---------- class helpers ---------- */
const cx = (...a) => a.filter(Boolean).join(" ")
const baseField =
  "w-full rounded-2xl border border-slate-300 bg-slate-100 p-3 text-[15px] md:text-base " +
  "text-black outline-none placeholder:text-slate-500 focus:border-emerald-600 focus:ring-2 focus:ring-emerald-500/30 shadow-none " +
  "dark:border-slate-500 dark:bg-slate-700 dark:text-slate-100 dark:placeholder:text-slate-300 dark:focus:border-emerald-400 dark:focus:ring-emerald-400/30"
const fieldDisabled =
  "bg-slate-100 text-slate-600 cursor-not-allowed opacity-95 dark:bg-slate-700/70 dark:text-slate-300"
const labelCls = "mb-1 block text-[15px] md:text-base font-medium text-slate-700 dark:text-slate-200"
const helpTextCls = "mt-1 text-sm text-slate-600 dark:text-slate-300"
const errorTextCls = "mt-1 text-sm text-red-500"
const compactInput = "!py-2 !px-4 !text-[16px] !leading-normal"

/** ---------- Enter-to-next helpers ---------- */
const isEnabledInput = (el) => {
  if (!el) return false
  if (typeof el.disabled !== "undefined" && el.disabled) return false
  const style = window.getComputedStyle?.(el)
  if (style && (style.display === "none" || style.visibility === "hidden")) return false
  if (!el.offsetParent && el.type !== "hidden" && el.getAttribute("role") !== "combobox") return false
  return true
}

/** ลำดับฟิลด์ที่จะโฟกัสต่อไป */
const useEnterNavigation = (refs, buyerType, order) => {
  const personOrder = [
    "citizenId",
    "memberId",
    "fullName","houseNo","moo","subdistrict","district","province",
    "postalCode","phone",
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
    if (key === "product" && order?.__templateLockedProduct) return true
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
    try { if (el.select) el.select() } catch {}
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

/** ---------- Reusable ComboBox ---------- */
function ComboBox({
  options = [],
  value,
  onChange,
  placeholder = "— เลือก —",
  getLabel = (o) => o?.label ?? "",
  getValue = (o) => o?.value ?? o?.id ?? "",
  disabled = false,
  error = false,
  buttonRef = null,
  hintRed = false,
  clearHint = () => {},
  onEnterNext,
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
        setOpen(false)
        setHighlight(-1)
      }
    }
    document.addEventListener("click", onClick)
    return () => document.removeEventListener("click", onClick)
  }, [])

  const commit = (opt) => {
    const v = String(getValue(opt))
    onChange?.(v, opt)
    setOpen(false)
    setHighlight(-1)
    clearHint?.()
    requestAnimationFrame(() => {
      controlRef.current?.focus()
      onEnterNext?.()
    })
  }

  const scrollHighlightedIntoView = (index) => {
    const listEl = listRef.current
    const itemEl = listEl?.children?.[index]
    if (!listEl || !itemEl) return
    const itemRect = itemEl.getBoundingClientRect()
    const listRect = listEl.getBoundingClientRect()
    const buffer = 6
    if (itemRect.top < listRect.top + buffer) {
      listEl.scrollTop -= (listRect.top + buffer) - itemRect.top
    } else if (itemRect.bottom > listRect.bottom - buffer) {
      listEl.scrollTop += itemRect.bottom - (listRect.bottom - buffer)
    }
  }

  const onKeyDown = (e) => {
    if (disabled) return
    if (!open && (e.key === "Enter" || e.key === " " || e.key === "ArrowDown")) {
      e.preventDefault()
      setOpen(true)
      setHighlight((h) => (h >= 0 ? h : 0))
      clearHint?.()
      return
    }
    if (!open) return

    if (e.key === "ArrowDown") {
      e.preventDefault()
      setHighlight((h) => {
        const next = h < options.length - 1 ? h + 1 : 0
        requestAnimationFrame(() => scrollHighlightedIntoView(next))
        return next
      })
    } else if (e.key === "ArrowUp") {
      e.preventDefault()
      setHighlight((h) => {
        const prev = h > 0 ? h - 1 : options.length - 1
        requestAnimationFrame(() => scrollHighlightedIntoView(prev))
        return prev
      })
    } else if (e.key === "Enter") {
      e.preventDefault()
      if (highlight >= 0 && highlight < options.length) commit(options[highlight])
    } else if (e.key === "Escape") {
      e.preventDefault()
      setOpen(false)
      setHighlight(-1)
    }
  }

  return (
    <div className="relative" ref={boxRef}>
      <button
        type="button"
        ref={controlRef}
        disabled={disabled}
        onClick={() => {
          if (!disabled) {
            setOpen((o) => o || !o)
            clearHint?.()
          }
        }}
        onKeyDown={onKeyDown}
        onFocus={() => clearHint?.()}
        className={cx(
          "w-full rounded-2xl border p-3 text-left text-[15px] md:text-base outline-none transition shadow-none",
          disabled ? "bg-slate-100 cursor-not-allowed" : "bg-slate-100 hover:bg-slate-200 cursor-pointer",
          error
            ? "border-red-400 ring-2 ring-red-300/70"
            : "border-slate-300 focus:border-emerald-600 focus:ring-2 focus:ring-emerald-500/30",
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
                {isActive && (
                  <span className="absolute left-0 top-0 h-full w-1 bg-emerald-600 dark:bg-emerald-400/70 rounded-l-xl" />
                )}
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
const DateInput = forwardRef(function DateInput(
  { error = false, className = "", ...props },
  ref
) {
  const inputRef = useRef(null)
  useImperativeHandle(ref, () => inputRef.current)

  return (
    <div className="relative">
      <style>{`input[type="date"]::-webkit-calendar-picker-indicator { opacity: 0; }`}</style>
      <input
        type="date"
        ref={inputRef}
        className={cx(
          baseField,
          "pr-12 cursor-pointer",
          error && "border-red-400 ring-2 ring-red-300/70",
          className
        )}
        {...props}
      />
      <button
        type="button"
        onClick={() => {
          const el = inputRef.current
          if (!el) return
          if (typeof el.showPicker === "function") el.showPicker()
          else {
            el.focus()
            el.click?.()
          }
        }}
        aria-label="เปิดตัวเลือกวันที่"
        className="absolute right-2 top-1/2 -translate-y-1/2 inline-flex h-9 w-9 items-center justify-center rounded-xl
transition-transform hover:scale-110 active:scale-95 focus:outline-none cursor-pointer
bg-transparent"
      >
        <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor" className="text-slate-600 dark:text-slate-200">
          <path d="M7 2a1 1 0 0 1 1 1v1h8V3a1 1 0 1 1 2 0v1h1a2 2 0 0 1 2 2v3H3V6a2 2 0 0 1 2-2h1V3a1 1 0 1 1 1-1zm14 9v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-7h18zM7 14h2v2H7v-2zm4 0h2v2h-2v-2z" />
        </svg>
      </button>
    </div>
  )
})

/** ---------------- JWT + Branch lock (ใหม่) ---------------- */
const getToken = () =>
  localStorage.getItem("access_token") ||
  localStorage.getItem("token") ||
  sessionStorage.getItem("access_token") ||
  sessionStorage.getItem("token") ||
  ""

const decodeJwtPayload = (token) => {
  try {
    const clean = String(token || "").replace(/^Bearer\s+/i, "")
    const b64 = clean.split(".")[1]
    if (!b64) return null
    const json = atob(b64.replace(/-/g, "+").replace(/_/g, "/"))
    return JSON.parse(json)
  } catch {
    return null
  }
}

const USER_BRANCH_MAP = {
  tartoom: "ท่าตูม",
  ratanaburi: "รัตนบุรี",
  surin: "สุรินทร์",
  sirin: "สุรินทร์",
  processing: "ฝ่ายแปรรูปผลิตผล",
  srikor: "ศีขรภูมิ",
  prasat: "ปราสาท",
  chumpolburi: "ชุมพลบุรี",
  sangkha: "สังขะ",
  chomphra: "จอมพระ",
}

/** ---------- Component ---------- */
const Buy = () => {
  const [loadingCustomer, setLoadingCustomer] = useState(false)
  const [customerFound, setCustomerFound] = useState(null)
  const [errors, setErrors] = useState({})
  const [missingHints, setMissingHints] = useState({})
  const [nameResults, setNameResults] = useState([])
  const [showNameList, setShowNameList] = useState(false)

  // ▼ บริษัท (ค้นหาจากชื่อ/ภาษี)
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

  /** ▶︎ ฟอร์มสำเร็จรูป (Template) — โหลดจาก BE */
  const [templateOptions, setTemplateOptions] = useState([{ id: "0", label: "— ฟอร์มปกติ —" }])
  const [formTemplate, setFormTemplate] = useState("0") // "0" = ไม่ล็อก
  const [selectedTemplateLabel, setSelectedTemplateLabel] = useState("")
  const [pendingTemplateLabel, setPendingTemplateLabel] = useState("")

  /** ⭐ ประเภทผู้ซื้อ */
  const buyerTypeOptions = [
    { id: "person", label: "บุคคลธรรมดา" },
    { id: "company", label: "บริษัท / นิติบุคคล" },
  ]
  const [buyerType, setBuyerType] = useState("person")

  /** ▼ Kill‑switch: ปิดการค้นหา/ออโต้ฟิลอัตโนมัติหลังบันทึก/รีเซ็ต จนกว่าจะพิมพ์ใหม่ */
  const [autoSearchEnabled, setAutoSearchEnabled] = useState(true)

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

  const { onEnter, focusNext } = useEnterNavigation(refs, buyerType, order)

  /** ▼ จุดยึดบนสุด */
  const pageTopRef = useRef(null)
  /** ========= anti-race สำหรับผลลัพธ์ async ที่ค้าง ========= */
  const searchEpochRef = useRef(0)
  const bumpSearchEpoch = () => { searchEpochRef.current += 1 }

  /** โหลด Template ล่าสุดที่เคยเลือก */
  useEffect(() => {
    try {
      // restore id ที่เคยเลือกในหน้า Buy
      const savedId = localStorage.getItem("buy.formTemplate")
      if (savedId && /^\d+$/.test(savedId)) {
        setFormTemplate(savedId)
      }
      // restore label จาก shared.formTemplate เพื่อ apply ถ้า id ไม่เจอในรอบแรก
      const shared = JSON.parse(localStorage.getItem("shared.formTemplate") || "null")
      if (shared?.label) setSelectedTemplateLabel(shared.label)
    } catch {}
  }, [])

  /** scrollToTop */
  const scrollToPageTop = () => {
    try { pageTopRef.current?.scrollIntoView({ block: "start", behavior: "smooth" }) } catch {}
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
      if (addr.member_id != null) setMemberMeta((m) => ({ ...m, memberId: toIntOrNull(addr.member_id) }))
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

  /** 🔄 โหลดรายการฟอร์มสำเร็จรูปจาก BE */
  useEffect(() => {
    const loadForms = async () => {
      try {
        const items = (await apiAuth("/order/form/search")) || [] // [{id, prod_name}]
        const mapped = items
          .map((x) => ({
            id: String(x.id ?? ""),
            label: String(x.prod_name ?? "").trim(),
          }))
          .filter((o) => o.id && o.label)

        setTemplateOptions((prev) => {
          const base = prev.find((p) => p.id === "0") || { id: "0", label: "— ฟอร์มปกติ —" }
          return [base, ...mapped]
        })

        // ถ้าเคยเลือกไว้ (formTemplate) แต่ id นั้นมีใน BE ก็ปล่อยตามเดิม
        // ถ้าไม่เจอ id เดิม แต่เคยมี label ที่ share ไว้ ให้ลอง apply ด้วย label อีกครั้ง
        const current = mapped.find((o) => String(o.id) === String(formTemplate))
        if (!current && selectedTemplateLabel) {
          // ยังไม่รู้ id แต่พอมี label — จะ apply เมื่อ options พร้อมด้านล่าง
        }
      } catch (e) {
        console.error("load form templates failed:", e)
      }
    }
    loadForms()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  /** 🔒 ล็อกสาขาตาม username ใน JWT */
  const [branchLocked, setBranchLocked] = useState(false)
  useEffect(() => {
    if (!branchOptions?.length) return
    try {
      const token = getToken()
      const username = (decodeJwtPayload(token)?.sub || "").toLowerCase()
      if (!username) return
      const key = Object.keys(USER_BRANCH_MAP).find((k) => username.includes(k))
      if (!key) return
      const wantedLabelTH = USER_BRANCH_MAP[key]
      const target = branchOptions.find((o) => String(o.label || "").includes(wantedLabelTH))
      if (!target) return
      setOrder((p) => ({
        ...p,
        branchId: target.id,
        branchName: target.label,
        klangName: "",
        klangId: null,
      }))
      setBranchLocked(true)
    } catch (e) {
      console.error("lock branch by login failed:", e)
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
        try { el?.scrollIntoView({ block: "nearest" }) } catch {}
      })
    } else if (e.key === "ArrowUp") {
      e.preventDefault()
      const prev = companyHighlighted > 0 ? companyHighlighted - 1 : companyResults.length - 1
      setCompanyHighlighted(prev)
      requestAnimationFrame(() => {
        const el = companyItemRefs.current[prev]
        try { el?.scrollIntoView({ block: "nearest" }) } catch {}
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
      memberId: r.member_id != null ? toIntOrNull(r.member_id) : null,
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
      memberId: data.memberId != null ? String(data.memberId) : prev.memberId,
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
    const mid = toIntOrNull(debouncedMemberId)
    if (mid == null || mid <= 0) return
    const fetchByMemberId = async () => {
      const __epoch = searchEpochRef.current
      try {
        setLoadingCustomer(true)
        const arr = (await apiAuth(`/order/customers/search?q=${encodeURIComponent(String(mid))}`)) || []
        const exact = arr.find((r) => r.type === "member" && toIntOrNull(r.member_id) === mid) || arr[0]
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

  const pickNameResult = async (rec) => {
    suppressNameSearchRef.current = true
    await fillFromRecord(rec)
    setShowNameList(false)
    setNameResults([])
    setHighlightedIndex(-1)
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
    if (!showNameList || nameResults.length === 0) return
    if (e.key === "ArrowDown") {
      e.preventDefault()
      const next = highlightedIndex < nameResults.length - 1 ? highlightedIndex + 1 : 0
      setHighlightedIndex(next)
      requestAnimationFrame(() => scrollHighlightedIntoView2(next))
    } else if (e.key === "ArrowUp") {
      e.preventDefault()
      const prev = highlightedIndex > 0 ? highlightedIndex - 1 : nameResults.length - 1
      setHighlightedIndex(prev)
      requestAnimationFrame(() => scrollHighlightedIntoView2(prev))
    } else if (e.key === "Enter") {
      e.preventDefault()
      if (highlightedIndex >= 0 && highlightedIndex < nameResults.length) {
        await pickNameResult(nameResults[highlightedIndex])
      }
    } else if (e.key === "Escape") {
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

  /** ---------- Template (โหลดจาก BE) ---------- */
  const isTemplateActive = formTemplate !== "0"

  // ตัวช่วยเลือก option โดยดูว่า label ของ option อยู่ในข้อความ template label หรือไม่
  const chooseByIncludes = (opts, text) =>
    (opts || []).find((o) => String(text || "").includes(String(o.label || "")))

  const applyTemplateByLabel = (label) => {
    if (!label) return
    // product
    const prod = chooseByIncludes(productOptions, label)
    if (prod && String(order.productId) !== String(prod.id)) {
      setOrder((p) => ({
        ...p,
        productId: prod.id,
        productName: prod.label,
        riceId: "",
        riceType: "",
        subriceId: "",
        subriceName: "",
      }))
      // รอจนกว่าจะโหลด species แล้วค่อยจับคู่ species ตาม label
      setPendingTemplateLabel(label)
    }

    // condition
    const cond = chooseByIncludes(conditionOptions, label)
    if (cond) setOrder((p) => ({ ...p, conditionId: cond.id, condition: cond.label }))

    // field type
    const fld = chooseByIncludes(fieldTypeOptions, label)
    if (fld) setOrder((p) => ({ ...p, fieldTypeId: fld.id, fieldType: fld.label }))

    // year
    const yr = chooseByIncludes(yearOptions, label)
    if (yr) setOrder((p) => ({ ...p, riceYearId: yr.id, riceYear: yr.label }))

    // program
    const prog = chooseByIncludes(programOptions, label)
    if (prog) setOrder((p) => ({ ...p, programId: prog.id, programName: prog.label }))

    // หมายเหตุ: businessType และ subrice ไม่มีใน prod_name → ให้ผู้ใช้เลือกเอง
  }

  // เมื่อ template เปลี่ยนหรือ options พร้อม → ใช้ label เติมค่าที่หาเจอ
  useEffect(() => {
    if (!isTemplateActive) return
    const current = templateOptions.find((o) => String(o.id) === String(formTemplate))
    const label = current?.label || selectedTemplateLabel
    if (label) applyTemplateByLabel(label)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [formTemplate, productOptions, conditionOptions, fieldTypeOptions, yearOptions, programOptions])

  // หลังโหลด species แล้ว ค่อยเติม species จาก label ของ template
  useEffect(() => {
    if (!pendingTemplateLabel || riceOptions.length === 0) return
    const sp = chooseByIncludes(riceOptions, pendingTemplateLabel)
    if (sp) {
      setOrder((p) => ({
        ...p,
        riceId: sp.id,
        riceType: sp.label,
        subriceId: "",
        subriceName: "",
      }))
    }
    setPendingTemplateLabel("")
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [riceOptions, pendingTemplateLabel])

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
    } catch {}
  }, [
    order.productId, order.riceId, order.subriceId,
    order.riceYearId, order.conditionId, order.fieldTypeId,
    order.programId, order.businessTypeId
  ])

  /** ---------- Validation ---------- */
  const validateAll = () => {
    const e = {}

    if (buyerType === "person") {
      if (!customer.fullName) e.fullName = "กรุณากรอกชื่อ–สกุล"
      if (!toIntOrNull(memberMeta.memberId ?? customer.memberId) && !memberMeta.assoId) {
        e.memberId = "กรุณาระบุรหัสสมาชิก (member_id) หรือเลือกจากรายชื่อที่มี asso_id"
      }
    } else {
      if (!customer.companyName.trim()) e.companyName = "กรุณากรอกชื่อบริษัท"
      if (!customer.taxId.trim() || !validateThaiTaxId(customer.taxId)) e.taxId = "กรุณากรอกเลขผู้เสียภาษี (13 หลัก)"
    }

    const pid = resolvePaymentId()
    if (!pid) e.payment = "เลือกวิธีชำระเงิน"
    if (!order.issueDate) e.issueDate = "กรุณาเลือกวันที่"

    if (!order.productId) e.product = "เลือกประเภทสินค้า"
    if (!order.riceId) e.riceType = "เลือกชนิดข้าว (species)"
    if (!order.subriceId) e.subrice = "เลือกชั้นย่อย (variant)"
    if (!order.conditionId) e.condition = "เลือกสภาพ/เงื่อนไข"
    if (!order.fieldTypeId) e.fieldType = "เลือกประเภทนา"
    if (!order.riceYearId) e.riceYear = "เลือกปี/ฤดูกาล"
    if (!order.programId) e.program = "เลือกโปรแกรม"
    if (!order.businessTypeId) e.businessType = "เลือกประเภทธุรกิจ"
    if (!order.branchName) e.branchName = "เลือกสาขา"
    if (!order.klangName) e.klangName = "เลือกคลัง"

    if (order.entryWeightKg === "" || Number(order.entryWeightKg) < 0) e.entryWeightKg = "กรอกน้ำหนักก่อนชั่ง"
    if (order.exitWeightKg === "" || Number(order.exitWeightKg) <= 0) e.exitWeightKg = "กรอกน้ำหนักหลังชั่ง"
    if (grossFromScale <= 0) e.exitWeightKg = "ค่าน้ำหนักจากตาชั่งต้องมากกว่า 0"
    if (order.manualDeduct && (order.deductWeightKg === "" || Number(order.deductWeightKg) < 0))
      e.deductWeightKg = "กรอกน้ำหนักหักให้ถูกต้อง"

    if (order.moisturePct === "" || isNaN(Number(order.moisturePct))) e.moisturePct = "กรอกความชื้น (%)"
    if (order.impurityPct === "" || isNaN(Number(order.impurityPct))) e.impurityPct = "กรอกสิ่งเจือปน (%)"
    if (order.gram === "" || isNaN(Number(order.gram))) e.gram = "กรอกคุณภาพข้าว (gram)"
    if (order.unitPrice === "" || isNaN(Number(order.unitPrice))) e.unitPrice = "กรอกราคาต่อกก. (บาท)"

    const amt = moneyToNumber(order.amountTHB)
    if (!amt || amt <= 0) e.amountTHB = "กรอกจำนวนเงินให้ถูกต้อง"

    setErrors(e)
    return e
  }

  // ✅ เลื่อนโฟกัสไป "ช่องที่ขาดตัวบนสุด"
  const scrollToFirstError = (eObj) => {
    const personKeys = ["memberId", "fullName"]
    const companyKeys = ["companyName", "taxId"]

    const commonOrderKeys = [
      "payment","issueDate",
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
      try { el.select?.() } catch {}
    }
  }

  // ✅ โฟกัสตัวแรกตาม missing hints
  const scrollToFirstMissing = (hintsObj) => {
    const personKeys = ["memberId","fullName"]
    const companyKeys = ["companyName","taxId"]
    const commonOrderKeys = [
      "payment","issueDate",
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
      try { el.select?.() } catch {}
    }
  }

  /** ---------- Helpers สำหรับรูปแบบวันที่ ---------- */
  const toIsoDateTime = (yyyyMmDd) => {
    try { return new Date(`${yyyyMmDd}T12:00:00Z`).toISOString() } catch { return new Date().toISOString() }
  }

  /** ---------- Submit ---------- */
  const handleSubmit = async (e) => {
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
      scrollToFirstError(eObj)
      return
    }
    if (Object.values(hints).some(Boolean)) {
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
    const branchId = order.branchId != null ? Number(order.branchId) : null
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
    let customerPayload
    if (buyerType === "person") {
      const memberIdNum = toIntOrNull(memberMeta.memberId ?? customer.memberId)
      const assoIdVal = memberMeta.assoId || null

      if (!memberIdNum && !assoIdVal) {
        alert("กรุณาระบุรหัสสมาชิก (member_id) หรือเลือกบุคคลที่มี asso_id จากผลค้นหา")
        return
      }

      customerPayload = memberIdNum
        ? {
            party_type: "individual",
            member_id: memberIdNum,
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
        ? { party_type: "company", tax_id: taxId }
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
      } catch {}
      alert("บันทึกออเดอร์เรียบร้อย ✅")
      // ⬇️ เคลียร์ฟอร์มทั้งหมด + ปิดออโต้ค้นหา จนกว่าจะพิมพ์ใหม่
      handleReset()
      requestAnimationFrame(() => scrollToPageTop())
    } catch (err) {
      console.error("SAVE ERROR:", err?.data || err)
      const detail = err?.data?.detail ? `\n\nรายละเอียด:\n${JSON.stringify(err.data.detail, null, 2)}` : ""
      alert(`บันทึกล้มเหลว: ${err.message || "เกิดข้อผิดพลาด"}${detail}`)
    }
  }

  const handleReset = () => {
    // ปิดระบบ auto-search ชั่วคราวระหว่างรีเซ็ตเพื่อไม่ให้มี auto-fill
    setAutoSearchEnabled(false)
    try { suppressNameSearchRef.current = true; } catch {}
    try { companySuppressSearchRef.current = true; } catch {}

    // ปิดออโต้ฟิลและยกเลิกผล async เก่าทันที
    bumpSearchEpoch()
    try { suppressNameSearchRef.current = true } catch (__) {}
    try { companySuppressSearchRef.current = true } catch (__) {}
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

    // ⭐ คงค่า issueDate เดิมไว้
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
      branchName: "",
      branchId: null,
      klangName: "",
      klangId: null,
      registeredPlace: "",
      comment: "",
    }))

    setRiceOptions([])
    setSubriceOptions([])
    setKlangOptions([])

    setDept({
      allowedPeriod: 30,
      postpone: false,
      postponePeriod: 0,
    })

    setBuyerType("person")
    setBranchLocked(false) // ปลดล็อกเมื่อรีเซ็ต
    setPendingTemplateLabel("")
    // ไม่เปลี่ยน formTemplate เพื่อรักษาค่าเดิมที่ผู้ใช้ตั้งไว้
    if (typeof requestAnimationFrame === "function") {
      requestAnimationFrame(() => scrollToPageTop())
    } else {
      scrollToPageTop()
    }
  }

  /** ---------- UI ---------- */
  return (
    <div className="min-h-screen bg-white text-black dark:bg-slate-900 dark:text-white rounded-2xl text-[15px] md:text-base">
      <div className="mx-auto max-w-7xl p-5 md:p-6 lg:p-8">

        {/* จุดยึดสำหรับเลื่อนขึ้นบนสุด */}
        <div ref={pageTopRef} />

        <h1 className="mb-4 text-3xl font-bold text-gray-900 dark:text-white">🧾 บันทึกออเดอร์ซื้อข้าวเปลือก</h1>

        {/* กล่องข้อมูลลูกค้า */}
        <div className="mb-6 rounded-2xl border border-slate-200 bg-white p-5 text-black shadow-sm dark:border-slate-700 dark:bg-slate-800 dark:text-white">
          {/* แถบหัวข้อ + สถานะ + ดรอปดาวฟอร์ม + ประเภทผู้ซื้อ */}
          <div className="mb-3 flex flex-wrap items-start gap-2">
            <h2 className="text-xl font-semibold">ข้อมูลลูกค้า</h2>

            {/* Badge สถานะ — เฉพาะโหมดบุคคล */}
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
              ) : memberMeta.type === "customer" ? (
                <span className="inline-flex items-center gap-2 rounded-full bg-slate-100 px-3 py-1.5 text-slate-700 ring-1 ring-slate-200 dark:bg-slate-700/60 dark:text-slate-200 dark:ring-slate-600 self-start">
                  <span className="h-2 w-2 rounded-full bg-slate-500" />
                  ลูกค้าทั่วไป (เลือกจากรายชื่อเพื่อใช้ asso_id)
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

            {/* ดรอปดาว: ประเภทผู้ซื้อ */}
            <div className="ml-auto w-full sm:w-64 self-start">
              <label className={labelCls}>ประเภทผู้ซื้อ</label>
              <ComboBox
                options={buyerTypeOptions}
                value={buyerType}
                onChange={(id) => setBuyerType(String(id))}
                buttonRef={refs.buyerType}
              />
            </div>

            {/* ดรอปดาวฟอร์มสำเร็จรูป (มุมขวา) — โหลดจาก BE */}
            <div className="w-full sm:w-72 self-start">
              <label className={labelCls}>ฟอร์มสำเร็จรูป</label>
              <ComboBox
                options={templateOptions}
                value={formTemplate}
                onChange={(id, found) => {
                  const idStr = String(id)
                  setFormTemplate(idStr)
                  const label = found?.label ?? ""
                  setSelectedTemplateLabel(label)
                  // บันทึกให้หน้า Sell ใช้ต่อ
                  try {
                    localStorage.setItem("shared.formTemplate", JSON.stringify({ id: idStr, label }))
                    localStorage.setItem("buy.formTemplate", idStr)
                  } catch {}
                  if (idStr !== "0" && label) applyTemplateByLabel(label)
                }}
                buttonRef={refs.formTemplate}
              />
              {isTemplateActive ? (
                <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
                  เลือกฟอร์มจากระบบกลาง (BE) เพื่อให้ฟิลด์สินค้า/สภาพ/โปรแกรม/ปี/ประเภทนา เติมตาม <b>prod_name</b> ของ template
                </p>
              ) : (
                <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
                  โหมดปกติ – ผู้ใช้เลือกทีละฟิลด์ได้อิสระ
                </p>
              )}
            </div>
          </div>

          {/* วิธีชำระเงิน + วันที่ + ใบชั่ง/ใบเบิกเงิน */}
          <div className="grid gap-4 md:grid-cols-3">
            <div>
              <label className={labelCls}>วิธีชำระเงิน</label>
              <ComboBox
                options={paymentOptions}
                value={order.paymentMethodId || ""}
                onChange={(id, found) =>
                  setOrder((p) => ({ ...p, paymentMethod: found?.label ?? "", paymentMethodId: id }))} 
                placeholder="— เลือกวิธีชำระเงิน —"
                buttonRef={refs.payment}
                onEnterNext={() => {
                  const tryFocus = () => {
                    const el = refs.paymentRefNo?.current
                    if (el && isEnabledInput(el)) {
                      try { el.scrollIntoView({ block: "center" }) } catch {}
                      el.focus?.()
                      try { el.select?.() } catch {}
                      return true
                    }
                    return false
                  }
                  if (tryFocus()) return
                  setTimeout(tryFocus, 60)
                  setTimeout(tryFocus, 180)
                }}
              />
            </div>

            <div>
              <label className={labelCls}>ลงวันที่</label>
              <DateInput
                ref={refs.issueDate}
                value={order.issueDate}
                onChange={(e) => setOrder((p) => ({ ...p, issueDate: e.target.value }))}
                onFocus={() => clearHint("issueDate")}
                error={!!errors.issueDate}
                className={redHintCls("issueDate")}
                onKeyDown={onEnter("issueDate")}
                aria-invalid={errors.issueDate ? true : undefined}
              />
              {errors.issueDate && <p className={errorTextCls}>{errors.issueDate}</p>}
            </div>

            <div>
              <label className={labelCls}>เลขที่ใบชั่ง/ใบเบิกเงิน</label>
              <input
                ref={refs.paymentRefNo}
                className={baseField}
                value={order.paymentRefNo}
                onChange={(e) => updateOrder("paymentRefNo", e.target.value)}
                onFocus={() => clearHint("paymentRefNo")}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.isComposing) {
                    e.preventDefault()
                    const targetKey = buyerType === "person" ? "fullName" : "companyName"
                    const tryFocus = () => {
                      const el = refs[targetKey]?.current
                      if (el && isEnabledInput(el)) {
                        try { el.scrollIntoView({ block: "center" }) } catch {}
                        el.focus?.()
                        try { el.select?.() } catch {}
                        return true
                      }
                      return false
                    }
                    if (tryFocus()) return
                    setTimeout(tryFocus, 60)
                    setTimeout(tryFocus, 180)
                  }
                }}
                placeholder="เช่น A-2025-000123"
              />
            </div>
          </div>

          {/* ========== ฟิลด์ลูกค้าในกรอบเดียว ========== */}
          {buyerType === "person" ? (
            <div className="mt-4 grid gap-4 md:grid-cols-3">
              <div>
                <label className={labelCls}>เลขที่บัตรประชาชน (เพื่อค้นหาที่อยู่)</label>
                <input
                  ref={refs.citizenId}
                  inputMode="numeric"
                  maxLength={13}
                  className={cx(baseField, errors.citizenId && "border-amber-400")}
                  value={customer.citizenId}
                  onChange={(e) => updateCustomer("citizenId", onlyDigits(e.target.value))}
                  onFocus={() => clearHint("citizenId")}
                  placeholder="เช่น 1234567890123"
                  onKeyDown={onEnter("citizenId")}
                  aria-invalid={errors.citizenId ? true : undefined}
                />
                <div className={helpTextCls}>
                  {loadingCustomer && "กำลังค้นหาลูกค้า..."}
                  {customer.citizenId.length === 13 && !validateThaiCitizenId(customer.citizenId) && (
                    <span className="text-amber-600 dark:text-amber-300"> เลขบัตรอาจไม่ถูกต้อง</span>
                  )}
                </div>
              </div>

              {/* ⭐ member_id */}
              <div>
                <label className={labelCls}>รหัสสมาชิก (member_id)</label>
                <input
                  ref={refs.memberId}
                  inputMode="numeric"
                  className={cx(baseField, redFieldCls("memberId"))}
                  value={customer.memberId}
                  onChange={(e) => updateCustomer("memberId", onlyDigits(e.target.value))}
                  onFocus={() => clearError("memberId")}
                  onKeyDown={onEnter("memberId")}
                  placeholder="เช่น 100234"
                  aria-invalid={errors.memberId ? true : undefined}
                />
                {!!memberMeta.memberId && (
                  <p className={helpTextCls}>พบสมาชิก: member_id {memberMeta.memberId}</p>
                )}
                {errors.memberId && <p className={errorTextCls}>{errors.memberId}</p>}
              </div>

              <div className="md:col-span-1" />

              <div className="md:col-span-2" ref={nameBoxRef}>
                <label className={labelCls}>ชื่อ–สกุล (พิมพ์เพื่อค้นหาอัตโนมัติ)</label>
                <input
                  ref={(el) => {
                    refs.fullName.current = el
                    nameInputRef.current = el
                  }}
                  className={cx(baseField, redFieldCls("fullName"))}
                  value={customer.fullName}
                  onChange={(e) => {
                    updateCustomer("fullName", e.target.value)
                    if (e.target.value.trim().length >= 2) {
                      setShowNameList(true)
                    } else {
                      setShowNameList(false)
                      setHighlightedIndex(-1)
                    }
                  }}
                  onFocus={() => {
                    clearHint("fullName")
                    clearError("fullName")
                  }}
                  onKeyDown={handleNameKeyDown}
                  onKeyDownCapture={onEnter("fullName")}
                  placeholder="เช่น นายสมชาย ใจดี"
                  aria-expanded={showNameList}
                  aria-controls="name-results"
                  role="combobox"
                  aria-autocomplete="list"
                  aria-invalid={errors.fullName ? true : undefined}
                />
                {errors.fullName && <p className={errorTextCls}>{errors.fullName}</p>}

                {showNameList && nameResults.length > 0 && (
                  <div
                    id="name-results"
                    ref={listContainerRef}
                    className={
                      "mt-1 max-h-72 w-full overflow-auto rounded-2xl border border-slate-200 bg-white text-black shadow-sm " +
                      "dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                    }
                    role="listbox"
                  >
                    {nameResults.map((r, idx) => {
                      const isActive = idx === highlightedIndex
                      const full = `${r.first_name ?? ""} ${r.last_name ?? ""}`.trim()
                      return (
                        <button
                          type="button"
                          ref={(el) => (itemRefs.current[idx] = el)}
                          key={`${r.type}-${r.asso_id}-${r.citizen_id}-${idx}`}
                          onClick={async () => await pickNameResult(r)}
                          onMouseEnter={() => {
                            setHighlightedIndex(idx)
                            requestAnimationFrame(() => scrollHighlightedIntoView2(idx))
                          }}
                          role="option"
                          aria-selected={isActive}
                          className={cx(
                            "relative flex w-full items-start gap-3 px-3 py-2.5 text-left transition rounded-xl cursor-pointer",
                            isActive
                              ? "bg-emerald-100 ring-1 ring-emerald-300 dark:bg-emerald-400/20 dark:ring-emerald-500"
                              : "hover:bg-emerald-50 dark:hover:bg-emerald-900/30"
                          )}
                        >
                          {isActive && (
                            <span className="absolute left-0 top-0 h-full w-1 bg-emerald-600 dark:bg-emerald-400/70 rounded-l-xl" />
                          )}
                          <div className="flex-1">
                            <div className="font-medium">{full || "(ไม่มีชื่อ)"}</div>
                            <div className="text-sm text-slate-600 dark:text-slate-300">
                              {r.type === "member"
                                ? `สมาชิก • member_id ${r.member_id ?? "-"}`
                                : `ลูกค้าทั่วไป • ปชช. ${r.citizen_id ?? "-"}`}
                            </div>
                          </div>
                        </button>
                      )
                    })}
                  </div>
                )}
              </div>

              {[
                ["houseNo", "บ้านเลขที่", "เช่น 99/1"],
                ["moo", "หมู่", "เช่น 4"],
                ["subdistrict", "ตำบล", "เช่น หนองปลาไหล"],
                ["district", "อำเภอ", "เช่น เมือง"],
                ["province", "จังหวัด", "เช่น ขอนแก่น"],
              ].map(([k, label, ph]) => (
                <div key={k}>
                  <label className={labelCls}>{label}</label>
                  <input
                    ref={refs[k]}
                    className={cx(baseField, compactInput)}
                    value={customer[k]}
                    onChange={(e) => updateCustomer(k, e.target.value)}
                    onFocus={() => clearHint(k)}
                    onKeyDown={onEnter(k)}
                    placeholder={ph}
                  />
                </div>
              ))}

              <div>
                <label className={labelCls}>รหัสไปรษณีย์</label>
                <input
                  ref={refs.postalCode}
                  inputMode="numeric"
                  maxLength={5}
                  className={cx(baseField, compactInput)}
                  value={customer.postalCode}
                  onChange={(e) => updateCustomer("postalCode", onlyDigits(e.target.value))}
                  onFocus={() => clearHint("postalCode")}
                  onKeyDown={onEnter("postalCode")}
                  placeholder="เช่น 40000"
                />
              </div>

              <div>
                <label className={labelCls}>เบอร์โทรศัพท์ </label>
                <input
                  ref={refs.phone}
                  inputMode="tel"
                  maxLength={20}
                  className={cx(baseField, compactInput)}
                  value={customer.phone}
                  onChange={(e) => updateCustomer("phone", e.target.value.replace(/[^\d+]/g, ""))}
                  onKeyDown={onEnter("phone")}
                  placeholder="เช่น 0812345678"
                />
                <p className={helpTextCls}></p>
              </div>
            </div>
          ) : (
            /* -------------------- โหมดบริษัท -------------------- */
            <div className="mt-4 md:col-span-2" ref={companyBoxRef}>
              <label className={labelCls}>ชื่อบริษัท / นิติบุคคล</label>
              <input
                ref={(el) => {
                  refs.companyName.current = el
                  companyInputRef.current = el
                }}
                className={cx(baseField, redFieldCls("companyName"))}
                value={customer.companyName}
                onChange={(e) => {
                  updateCustomer("companyName", e.target.value)
                  if (buyerType === "company") {
                    if (e.target.value.trim().length >= 2) {
                      setShowCompanyList(true)
                    } else {
                      setShowCompanyList(false)
                      setCompanyHighlighted(-1)
                    }
                  }
                }}
                onFocus={() => clearError("companyName")}
                onKeyDown={handleCompanyKeyDown}
                placeholder="เช่น บริษัท เอ บี ซี จำกัด"
                aria-expanded={showCompanyList}
                aria-controls="company-results"
                role="combobox"
                aria-autocomplete="list"
                aria-invalid={errors.companyName ? true : undefined}
              />
              {errors.companyName && <p className={errorTextCls}>{errors.companyName}</p>}

              {showCompanyList && companyResults.length > 0 && (
                <div
                  id="company-results"
                  className="mt-1 max-h-72 w-full overflow-auto rounded-2xl border border-slate-200 bg-white text-black shadow-sm dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                  role="listbox"
                >
                  {companyResults.map((r, idx) => {
                    const isActive = idx === companyHighlighted
                    return (
                      <button
                        type="button"
                        key={`${r.tax_id}-${idx}`}
                        ref={(el) => (companyItemRefs.current[idx] = el)}
                        onClick={() => pickCompanyResult(r)}
                        onMouseEnter={() => setCompanyHighlighted(idx)}
                        role="option"
                        aria-selected={isActive}
                        className={cx(
                          "relative flex w-full items-start gap-3 px-3 py-2.5 text-left transition rounded-xl cursor-pointer",
                          isActive
                            ? "bg-emerald-100 ring-1 ring-emerald-300 dark:bg-emerald-400/20 dark:ring-emerald-500"
                            : "hover:bg-emerald-50 dark:hover:bg-emerald-900/30"
                        )}
                      >
                        {isActive && (
                          <span className="absolute left-0 top-0 h-full w-1 bg-emerald-600 dark:bg-emerald-400/70 rounded-l-xl" />
                        )}
                        <div className="flex-1">
                          <div className="font-medium">{r.company_name || "(ไม่ระบุชื่อบริษัท)"}</div>
                          <div className="text-sm text-slate-600 dark:text-slate-300">
                            ภาษี: {r.tax_id || "-"} • โทร: {r.phone_number || "-"}
                          </div>
                        </div>
                      </button>
                    )
                  })}
                </div>
              )}

              <div className="mt-4 grid gap-4 md:grid-cols-3">
                <div>
                  <label className={labelCls}>เลขผู้เสียภาษี</label>
                  <input
                    ref={refs.taxId}
                    inputMode="numeric"
                    maxLength={13}
                    className={cx(baseField, redFieldCls("taxId"))}
                    value={customer.taxId}
                    onChange={(e) => updateCustomer("taxId", onlyDigits(e.target.value))}
                    onFocus={() => clearError("taxId")}
                    onKeyDown={onEnter("taxId")}
                    placeholder="13 หลัก"
                    aria-invalid={errors.taxId ? true : undefined}
                  />
                  {errors.taxId && <p className={errorTextCls}>{errors.taxId}</p>}
                </div>

                <div>
                  <label className={labelCls}>เบอร์โทรบริษัท</label>
                  <input
                    ref={refs.companyPhone}
                    inputMode="tel"
                    className={cx(baseField)}
                    value={customer.companyPhone}
                    onChange={(e) => updateCustomer("companyPhone", e.target.value.replace(/[^\d+]/g, ""))}
                    onKeyDown={onEnter("companyPhone")}
                    placeholder="เช่น 044xxxxxx"
                  />
                </div>
              </div>

              {/* HQ & Branch Address */}
              <div className="mt-4 grid gap-4 md:grid-cols-3">
                {[
                  ["hqHouseNo", "ที่อยู่สำนักงานใหญ่", "เช่น 88/1"],
                  ["hqMoo", "หมู่ (สำนักงานใหญ่)", "เช่น 3"],
                  ["hqSubdistrict", "ตำบล (สำนักงานใหญ่)", "เช่น ในเมือง"],
                  ["hqDistrict", "อำเภอ (สำนักงานใหญ่)", "เช่น เมือง"],
                  ["hqProvince", "จังหวัด (สำนักงานใหญ่)", "เช่น สุรินทร์"],
                  ["hqPostalCode", "ไปรษณีย์ (สำนักงานใหญ่)", "เช่น 32000"],
                ].map(([k, label, ph]) => (
                  <div key={k}>
                    <label className={labelCls}>{label}</label>
                    <input
                      ref={refs[k]}
                      className={cx(baseField, compactInput)}
                      value={customer[k]}
                      onChange={(e) => updateCustomer(k, k.toLowerCase().includes("postal") ? onlyDigits(e.target.value) : e.target.value)}
                      onKeyDown={onEnter(k)}
                      placeholder={ph}
                    />
                  </div>
                ))}
                {[
                  ["brHouseNo", "ที่อยู่สาขา (ถ้ามี)", "เช่น 101/2"],
                  ["brMoo", "หมู่ (สาขา)", "เช่น 2"],
                  ["brSubdistrict", "ตำบล (สาขา)", "เช่น นอกเมือง"],
                  ["brDistrict", "อำเภอ (สาขา)", "เช่น จอมพระ"],
                  ["brProvince", "จังหวัด (สาขา)", "เช่น สุรินทร์"],
                  ["brPostalCode", "ไปรษณีย์ (สาขา)", "เช่น 32180"],
                ].map(([k, label, ph]) => (
                  <div key={k}>
                    <label className={labelCls}>{label}</label>
                    <input
                      ref={refs[k]}
                      className={cx(baseField, compactInput)}
                      value={customer[k]}
                      onChange={(e) => updateCustomer(k, k.toLowerCase().includes("postal") ? onlyDigits(e.target.value) : e.target.value)}
                      onKeyDown={onEnter(k)}
                      placeholder={ph}
                    />
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* กล่องรายการสินค้า/สเปก/ราคา/น้ำหนัก */}
        <form onSubmit={handleSubmit} className="rounded-2xl border border-slate-200 bg-white p-5 text-black shadow-sm dark:border-slate-700 dark:bg-slate-800 dark:text-white">
          <div className="grid gap-4 md:grid-cols-3">
            {/* หมวดสินค้า/สเปก */}
            <div>
              <label className={labelCls}>ประเภทสินค้า</label>
              <ComboBox
                options={productOptions}
                value={order.productId}
                onChange={(id, found) =>
                  setOrder((p) => ({ ...p, productId: id, productName: found?.label ?? "", riceId: "", riceType: "", subriceId: "", subriceName: "" }))
                }
                buttonRef={refs.product}
                placeholder="— เลือกประเภทสินค้า —"
              />
            </div>

            <div>
              <label className={labelCls}>ชนิดข้าว (Species)</label>
              <ComboBox
                options={riceOptions}
                value={order.riceId}
                onChange={(id, found) =>
                  setOrder((p) => ({ ...p, riceId: id, riceType: found?.label ?? "", subriceId: "", subriceName: "" }))
                }
                buttonRef={refs.riceType}
                placeholder="— เลือกชนิดข้าว —"
                disabled={!order.productId}
              />
            </div>

            <div>
              <label className={labelCls}>ชั้นย่อย (Variant)</label>
              <ComboBox
                options={subriceOptions}
                value={order.subriceId}
                onChange={(id, found) => setOrder((p) => ({ ...p, subriceId: id, subriceName: found?.label ?? "" }))}
                buttonRef={refs.subrice}
                placeholder="— เลือกชั้นย่อย —"
                disabled={!order.riceId}
              />
            </div>

            <div>
              <label className={labelCls}>สภาพ/เงื่อนไข</label>
              <ComboBox
                options={conditionOptions}
                value={order.conditionId}
                onChange={(id, found) => setOrder((p) => ({ ...p, conditionId: id, condition: found?.label ?? "" }))}
                buttonRef={refs.condition}
              />
            </div>

            <div>
              <label className={labelCls}>ประเภทนา (Field Type)</label>
              <ComboBox
                options={fieldTypeOptions}
                value={order.fieldTypeId}
                onChange={(id, found) => setOrder((p) => ({ ...p, fieldTypeId: id, fieldType: found?.label ?? "" }))}
                buttonRef={refs.fieldType}
              />
            </div>

            <div>
              <label className={labelCls}>ปี/ฤดูกาล (Year)</label>
              <ComboBox
                options={yearOptions}
                value={order.riceYearId}
                onChange={(id, found) => setOrder((p) => ({ ...p, riceYearId: id, riceYear: found?.label ?? "" }))}
                buttonRef={refs.riceYear}
              />
            </div>

            <div>
              <label className={labelCls}>โปรแกรม</label>
              <ComboBox
                options={programOptions}
                value={order.programId}
                onChange={(id, found) => setOrder((p) => ({ ...p, programId: id, programName: found?.label ?? "" }))}
                buttonRef={refs.program}
              />
            </div>

            <div>
              <label className={labelCls}>ประเภทธุรกิจ</label>
              <ComboBox
                options={businessOptions}
                value={order.businessTypeId}
                onChange={(id, found) => setOrder((p) => ({ ...p, businessTypeId: id, businessType: found?.label ?? "" }))}
                buttonRef={refs.businessType}
              />
            </div>

            {/* สาขา/คลัง */}
            <div>
              <label className={labelCls}>สาขา</label>
              <ComboBox
                options={branchOptions}
                value={order.branchId ?? ""}
                onChange={(id, found) => setOrder((p) => ({ ...p, branchId: Number(id), branchName: found?.label ?? "", klangId: null, klangName: "" }))}
                buttonRef={refs.branchName}
                disabled={branchLocked}
              />
            </div>

            <div>
              <label className={labelCls}>คลัง</label>
              <ComboBox
                options={klangOptions}
                value={order.klangId ?? ""}
                onChange={(id, found) => setOrder((p) => ({ ...p, klangId: Number(id), klangName: found?.label ?? "" }))}
                buttonRef={refs.klangName}
                disabled={!order.branchId}
              />
            </div>

            {/* ค่าชั่ง/คุณภาพ/ราคา */}
            <div>
              <label className={labelCls}>ก่อนชั่ง (กก.)</label>
              <input
                ref={refs.entryWeightKg}
                inputMode="numeric"
                className={cx(baseField, redFieldCls("entryWeightKg"))}
                value={order.entryWeightKg}
                onChange={(e) => updateOrder("entryWeightKg", onlyDigits(e.target.value))}
                onKeyDown={onEnter("entryWeightKg")}
                placeholder="เช่น 9,800"
              />
              {errors.entryWeightKg && <p className={errorTextCls}>{errors.entryWeightKg}</p>}
            </div>

            <div>
              <label className={labelCls}>หลังชั่ง (กก.)</label>
              <input
                ref={refs.exitWeightKg}
                inputMode="numeric"
                className={cx(baseField, redFieldCls("exitWeightKg"))}
                value={order.exitWeightKg}
                onChange={(e) => updateOrder("exitWeightKg", onlyDigits(e.target.value))}
                onKeyDown={onEnter("exitWeightKg")}
                placeholder="เช่น 19,400"
              />
              {errors.exitWeightKg && <p className={errorTextCls}>{errors.exitWeightKg}</p>}
            </div>

            <div className="self-end">
              <div className="rounded-xl bg-slate-50 px-4 py-3 ring-1 ring-slate-200 dark:bg-slate-700/40 dark:ring-slate-600">
                <div className="text-sm text-slate-600 dark:text-slate-300">น้ำหนักจากตาชั่ง (กก.)</div>
                <div className="text-xl font-semibold">{grossFromScale.toLocaleString()}</div>
              </div>
            </div>

            <div>
              <label className={labelCls}>ความชื้น (%)</label>
              <input
                ref={refs.moisturePct}
                inputMode="decimal"
                className={cx(baseField, redFieldCls("moisturePct"))}
                value={order.moisturePct}
                onChange={(e) => updateOrder("moisturePct", e.target.value.replace(/[^\d.]/g, ""))}
                onKeyDown={onEnter("moisturePct")}
                placeholder="เช่น 15"
              />
              {errors.moisturePct && <p className={errorTextCls}>{errors.moisturePct}</p>}
            </div>

            <div>
              <label className={labelCls}>สิ่งเจือปน (%)</label>
              <input
                ref={refs.impurityPct}
                inputMode="decimal"
                className={cx(baseField, redFieldCls("impurityPct"))}
                value={order.impurityPct}
                onChange={(e) => updateOrder("impurityPct", e.target.value.replace(/[^\d.]/g, ""))}
                onKeyDown={onEnter("impurityPct")}
                placeholder="เช่น 1.0"
              />
              {errors.impurityPct && <p className={errorTextCls}>{errors.impurityPct}</p>}
            </div>

            <div>
              <label className={labelCls}>Gram</label>
              <input
                ref={refs.gram}
                inputMode="numeric"
                className={cx(baseField, redFieldCls("gram"))}
                value={order.gram}
                onChange={(e) => updateOrder("gram", onlyDigits(e.target.value))}
                onKeyDown={onEnter("gram")}
                placeholder="เช่น 100"
              />
              {errors.gram && <p className={errorTextCls}>{errors.gram}</p>}
            </div>

            <div className="md:col-span-3 grid gap-4 md:grid-cols-3">
              <div>
                <label className={labelCls}>ตั้งค่าน้ำหนักหักเอง (กก.)</label>
                <div className="flex items-center gap-3">
                  <input
                    type="checkbox"
                    checked={order.manualDeduct}
                    onChange={(e) => setOrder((p) => ({ ...p, manualDeduct: e.target.checked }))}
                  />
                  <input
                    ref={refs.deductWeightKg}
                    inputMode="numeric"
                    disabled={!order.manualDeduct}
                    className={cx(baseField, order.manualDeduct ? "" : fieldDisabled)}
                    value={order.deductWeightKg}
                    onChange={(e) => updateOrder("deductWeightKg", onlyDigits(e.target.value))}
                    onKeyDown={onEnter("deductWeightKg")}
                    placeholder="กรอกเฉพาะเมื่อเลือกตั้งเอง"
                  />
                </div>
              </div>

              <div className="self-end">
                <div className="rounded-xl bg-slate-50 px-4 py-3 ring-1 ring-slate-200 dark:bg-slate-700/40 dark:ring-slate-600">
                  <div className="text-sm text-slate-600 dark:text-slate-300">น้ำหนักหักรวมโดยประมาณ (กก.)</div>
                  <div className="text-xl font-semibold">{toNumber(autoDeduct).toLocaleString()}</div>
                </div>
              </div>

              <div className="self-end">
                <div className="rounded-xl bg-slate-50 px-4 py-3 ring-1 ring-slate-200 dark:bg-slate-700/40 dark:ring-slate-600">
                  <div className="text-sm text-slate-600 dark:text-slate-300">น้ำหนักสุทธิ (กก.)</div>
                  <div className="text-xl font-semibold">{netWeight.toLocaleString()}</div>
                </div>
              </div>
            </div>

            <div>
              <label className={labelCls}>ราคาต่อกก. (บาท)</label>
              <input
                ref={refs.unitPrice}
                inputMode="decimal"
                className={cx(baseField, redFieldCls("unitPrice"))}
                value={order.unitPrice}
                onChange={(e) => updateOrder("unitPrice", e.target.value.replace(/[^\d.]/g, ""))}
                onKeyDown={onEnter("unitPrice")}
                placeholder="เช่น 12.50"
              />
              {errors.unitPrice && <p className={errorTextCls}>{errors.unitPrice}</p>}
            </div>

            <div>
              <label className={labelCls}>จำนวนเงิน (THB)</label>
              <input
                ref={refs.amountTHB}
                inputMode="decimal"
                className={cx(baseField, redFieldCls("amountTHB"))}
                value={order.amountTHB}
                onChange={(e) => updateOrder("amountTHB", formatMoneyInput(e.target.value))}
                onKeyDown={onEnter("amountTHB")}
                placeholder="ระบบจะคำนวณให้อัตโนมัติ"
              />
              {errors.amountTHB && <p className={errorTextCls}>{errors.amountTHB}</p>}
              <p className={helpTextCls}>
                ตัวอย่าง: <b>{thb(moneyToNumber(order.amountTHB))}</b>
              </p>
            </div>
          </div>

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
              type="submit"
              onClick={scrollToPageTop}
              className="inline-flex items-center justify-center rounded-2xl 
                bg-emerald-600 px-6 py-3 text-base font-semibold text-white
                shadow-[0_6px_16px_rgba(16,185,129,0.35)]
                transition-all duration-300 ease-out
                hover:bg-emerald-700 hover:shadow-[0_8px_20px_rgba(16,185,129,0.45)]
                hover:scale-[1.05] active:scale-[.97] cursor-pointer"
            >
              บันทึกออเดอร์
            </button>

            <button
              type="button"
              onClick={handleReset}
              className="inline-flex items-center justify-center rounded-2xl 
          border border-slate-300 bg-white px-6 py-3 text-base font-medium 
          text-slate-700 dark:text:white
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
