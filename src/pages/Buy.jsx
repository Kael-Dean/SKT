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

// ⭐ ใหม่: ตรวจความยาวเลขผู้เสียภาษี (ทั่วไป 13 หลัก)
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
  // hidden / display:none
  const style = window.getComputedStyle?.(el)
  if (style && (style.display === "none" || style.visibility === "hidden")) return false
  // detached
  if (!el.offsetParent && el.type !== "hidden" && el.getAttribute("role") !== "combobox") return false
  return true
}

/** ลำดับฟิลด์ที่จะโฟกัสต่อไป (ขึ้นกับ buyerType และสถานะ disable ของบางช่อง) */
const useEnterNavigation = (refs, buyerType, order) => {
  // รายการฝั่งลูกค้า (บุคคล/บริษัท)
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

  // รายการฝั่งออเดอร์
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
      // โฟกัสปุ่มไว้ก่อน เพื่อคีย์ Enter ครั้งถัดไปยังไปต่อ
      controlRef.current?.focus()
      // ถ้ามี onEnterNext ให้เรียกเพื่อเลื่อนไปฟิลด์ถัดไป
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
// อ่าน token จาก storage ต่าง ๆ
const getToken = () =>
  localStorage.getItem("access_token") ||
  localStorage.getItem("token") ||
  sessionStorage.getItem("access_token") ||
  sessionStorage.getItem("token") ||
  ""

// ถอด payload ของ JWT เพื่อเอา sub = username
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

// map คีย์เวิร์ดจาก username -> ชื่อสาขาไทย
const USER_BRANCH_MAP = {
  tartoom: "ท่าตูม",
  ratanaburi: "รัตนบุรี",
  surin: "สุรินทร์",
  sirin: "สุรินทร์", // กันกรณีสะกดแบบ sirin
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

  /** ▶︎ ฟอร์มสำเร็จรูป (Template) */
  const templateOptions = [
    { id: "0", label: "— ฟอร์มปกติ —" },
    { id: "1", label: "ฟอร์ม 17 ตค" },
    { id: "2", label: "รหัส 2 • ข้าวเหนียว" },
    { id: "3", label: "รหัส 3 • เมล็ดพันธุ์" },
  ]
  const [formTemplate, setFormTemplate] = useState("0") // "0" = ไม่ล็อก

  /** ⭐ ประเภทผู้ซื้อ */
  const buyerTypeOptions = [
    { id: "person", label: "บุคคลธรรมดา" },
    { id: "company", label: "บริษัท / นิติบุคคล" },
  ]
  const [buyerType, setBuyerType] = useState("person")

  /** ฟอร์มลูกค้า */
  const [customer, setCustomer] = useState({
    // บุคคลธรรมดา
    citizenId: "",
    memberId: "", // ⭐ ใหม่: ช่องกรอก member_id
    fullName: "",
    houseNo: "",
    moo: "",
    subdistrict: "",
    district: "",
    province: "",
    postalCode: "",
    phone: "",

    // CCD เพิ่ม (ซ่อน UI แล้ว แต่เก็บใน state เผื่อหลังบ้าน)
    fid: "",
    fidOwner: "",
    fidRelationship: "",

    // ⭐ บริษัท / นิติบุคคล
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
    memberId: null, // ⭐ ใหม่: เก็บเลขสมาชิกจากผลค้นหา
  })

  /** ฟอร์มออเดอร์ */
  const [order, setOrder] = useState({
    productId: "",
    productName: "",
    riceId: "", // species_id
    riceType: "",
    subriceId: "", // variant_id
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
    // 💳 วิธีชำระเงิน
    paymentMethod: "", // label
    paymentMethodId: "", // ⭐ เก็บ id ด้วยเพื่อความเสถียร
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
    memberId: useRef(null), // ⭐
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

  /** โหลดค่า Template ล่าสุดจาก localStorage */
  useEffect(() => {
    try {
      const saved = localStorage.getItem("buy.formTemplate")
      if (saved && ["0", "1", "2", "3"].includes(saved)) setFormTemplate(saved)
    } catch {}
  }, [])

  /** ---------- เพิ่ม: helper เด้งไปบนสุดหลังบันทึกสำเร็จ/รีเซ็ต ---------- */
  const scrollToPageTop = () => {
    try {
      window.scrollTo({ top: 0, behavior: "smooth" })
    } catch {
      try { window.scrollTo(0, 0) } catch {}
    }
  }

  /** debounce */
  const debouncedCitizenId = useDebounce(customer.citizenId)
  const debouncedMemberId = useDebounce(customer.memberId) // ⭐
  const debouncedFullName = useDebounce(customer.fullName)
  const debouncedCompanyName = useDebounce(customer.companyName)
  const debouncedTaxId = useDebounce(customer.taxId)

  /** helper: เรียกหลาย endpoint จนกว่าจะเจอ (ใช้ apiAuth) */
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

  /** 🔎 helper: ดึงที่อยู่+ข้อมูลบุคคลจาก citizen_id */
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

  /** 🔒 ล็อกสาขาตาม username ใน JWT (เช่น Admin-tartoom-02 => ท่าตูม) */
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
      try {
        setLoadingCustomer(true)
        const items = (await apiAuth(`/order/companies/search?q=${encodeURIComponent(q)}`)) || []
        setCompanyResults(items)
        if (document.activeElement === companyInputRef.current) {
          setShowCompanyList(true)
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
  }, [debouncedCompanyName, buyerType])

  // ค้นหาจากเลขภาษี
  useEffect(() => {
    if (buyerType !== "company") return
    const tid = onlyDigits(debouncedTaxId)
    if (tid.length !== 13) return
    const searchByTax = async () => {
      try {
        setLoadingCustomer(true)
        const items = (await apiAuth(`/order/companies/search?q=${encodeURIComponent(tid)}`)) || []
        if (items.length > 0) {
          await pickCompanyResult(items[0]) // auto-fill เมื่อภาษีตรง
        }
      } catch (e) {
        console.error(e)
      } finally {
        setLoadingCustomer(false)
      }
    }
    searchByTax()
  }, [debouncedTaxId, buyerType])

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

      // ใหม่:
      phone: toStr(r.phone ?? r.tel ?? r.mobile ?? ""),
      fid: toStr(r.fid ?? ""),
      fidOwner: toStr(r.fid_owner ?? r.fidowner ?? ""),
      fidRelationship: toStr(r.fid_relationship ?? r.fidreationship ?? r.fid_rel ?? ""),
      memberId: r.member_id != null ? toIntOrNull(r.member_id) : null, // ⭐
    }
  }

  /** เติมจากเรคอร์ด (เฉพาะบุคคล) */
  const fillFromRecord = async (raw = {}) => {
    const data = mapSimplePersonToUI(raw)
    setCustomer((prev) => ({
      ...prev,
      citizenId: onlyDigits(data.citizenId || prev.citizenId),
      fullName: data.fullName || prev.fullName,

      phone: data.phone || prev.phone,
      fid: data.fid || prev.fid,
      fidOwner: data.fidOwner || prev.fidOwner,
      fidRelationship: data.fidRelationship || prev.fidRelationship,
      memberId: data.memberId != null ? String(data.memberId) : prev.memberId, // ใส่ใน input ด้วย
    }))
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
    if (buyerType !== "person") {
      setCustomerFound(null)
      return
    }
    const mid = toIntOrNull(debouncedMemberId)
    if (mid == null || mid <= 0) return
    const fetchByMemberId = async () => {
      try {
        setLoadingCustomer(true)
        const arr = (await apiAuth(`/order/customers/search?q=${encodeURIComponent(String(mid))}`)) || []
        const exact = arr.find((r) => r.type === "member" && toIntOrNull(r.member_id) === mid) || arr[0]
        if (exact) {
          await fillFromRecord(exact)
        } else {
          setCustomerFound(false)
          setMemberMeta({ type: "customer", assoId: null, memberId: null })
        }
      } catch (e) {
        console.error(e)
        setCustomerFound(false)
        setMemberMeta({ type: "customer", assoId: null, memberId: null })
      } finally {
        setLoadingCustomer(false)
      }
    }
    fetchByMemberId()
  }, [debouncedMemberId, buyerType])

  /** ค้นหาด้วยเลขบัตร — คงไว้เพื่อเติมข้อมูล/ที่อยู่ */
  useEffect(() => {
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
      try {
        setLoadingCustomer(true)
        const arr = (await apiAuth(`/order/customers/search?q=${encodeURIComponent(cid)}`)) || []
        const exact = arr.find((r) => onlyDigits(r.citizen_id || r.citizenId || "") === cid) || arr[0]
        if (exact) {
          await fillFromRecord(exact)
        } else {
          setCustomerFound(false)
          setMemberMeta({ type: "customer", assoId: null, memberId: null })
        }
      } catch (e) {
        console.error(e)
        setCustomerFound(false)
        setMemberMeta({ type: "customer", assoId: null, memberId: null })
      } finally {
        setLoadingCustomer(false)
      }
    }
    fetchByCid()
  }, [debouncedCitizenId, buyerType, memberMeta.memberId, memberMeta.assoId])

  /** ค้นหาด้วยชื่อ — ข้ามเมื่อเป็นบริษัท */
  useEffect(() => {
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
        setNameResults(mapped)
        if (document.activeElement === nameInputRef.current) {
          setShowNameList(true)
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
  }, [debouncedFullName, buyerType])

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

  /** ---- ช่วยจัดการสีแดงเฉพาะบางช่อง ---- */
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

  /** 👉 ซื้อเชื่อ = 4, ซื้อสด = 3 (เลือก id เป็นหลัก, ถ้าไม่ได้ให้ fallback ตามข้อความ) */
  const resolvePaymentIdForBE = () => {
    const id = resolvePaymentId()
    if (id != null) return id
    return isCreditPayment() ? 4 : 3
  }

  /** ---------- Missing hints ---------- */
  const redHintCls = (key) =>
    missingHints[key] ? "border-red-400 ring-2 ring-red-300 focus:border-red-400 animate-pulse" : ""
  const clearHint = (key) => setMissingHints((prev) => (prev[key] ? { ...prev, [key]: false } : prev))

  // ⭐ ปรับให้ตรวจตามประเภทผู้ซื้อ + ตามที่รีเควสต์
  const computeMissingHints = () => {
    const m = {}

    if (buyerType === "person") {
      if (!customer.fullName.trim()) m.fullName = true
    } else {
      if (!customer.companyName.trim()) m.companyName = true
      if (!customer.taxId.trim()) m.taxId = true
    }

    // ✅ ฟิลด์ที่จำเป็นกับ BE/รีเควสต์
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
    if (String(v).trim() !== "") clearHint(k)
    setCustomer((prev) => ({ ...prev, [k]: v }))
  }
  const updateOrder = (k, v) => {
    if (String(v).trim() !== "") clearHint(k)
    setOrder((prev) => ({ ...prev, [k]: v }))
  }

  /** ---------- Template effects ---------- */
  const isTemplateActive = formTemplate !== "0"

  // เมื่อเปลี่ยน Template (รหัส 1 = ฟอร์ม 17 ตค) → บังคับเลือก "ประเภทสินค้า: ข้าวเปลือก"
  useEffect(() => {
    if (!isTemplateActive) return
    if (productOptions.length === 0) return
    const paddy = productOptions.find((o) => o.label.includes("ข้าวเปลือก"))
    if (paddy && order.productId !== paddy.id) {
      setOrder((p) => ({
        ...p,
        productId: paddy.id,
        productName: paddy.label,
        riceId: "",
        riceType: "",
        subriceId: "",
        subriceName: "",
      }))
    }
  }, [formTemplate, productOptions]) // eslint-disable-line react-hooks/exhaustive-deps

  // เมื่อ species โหลดแล้ว → เลือกชนิดข้าวตาม Template
  useEffect(() => {
    if (!isTemplateActive) return
    if (riceOptions.length === 0) return
    const want = formTemplate === "1" ? "หอมมะลิ" : formTemplate === "2" ? "เหนียว" : "พันธุ์"
    const target = riceOptions.find((r) => r.label.includes(want))
    if (target && order.riceId !== target.id) {
      setOrder((p) => ({
        ...p,
        riceId: target.id,
        riceType: target.label,
        subriceId: "",
        subriceName: "",
      }))
    }
  }, [formTemplate, riceOptions]) // eslint-disable-line react-hooks/exhaustive-deps

  // ⭐ ปรับให้ robust: ฟอร์ม 17 ตค → ตั้งชั้นย่อย = ดอกมะลิ105 (รองรับมี/ไม่มีช่องว่าง และชื่ออังกฤษ)
  useEffect(() => {
    if (formTemplate !== "1") return
    if (subriceOptions.length === 0) return
    const norm = (s) => String(s || "").toLowerCase().replace(/\s+/g, "")
    const isDokMali105 = (label) => {
      const t = norm(label)
      return (
        t.includes("ดอกมะลิ105") ||
        t.includes("หอมมะลิ105") ||
        t.includes("kdml105") ||
        t.includes("jasmine105")
      )
    }
    const target = subriceOptions.find((s) => isDokMali105(s.label))
    if (target && order.subriceId !== target.id) {
      setOrder((p) => ({ ...p, subriceId: target.id, subriceName: target.label }))
    }
  }, [formTemplate, subriceOptions]) // eslint-disable-line react-hooks/exhaustive-deps

  // ⭐ ฟอร์ม 17 ตค → ตั้ง Condition/FieldType/Year/Program/Business
  useEffect(() => {
    if (formTemplate !== "1") return

    const applyIfFound = (opts, includesText, setter) => {
      if (!Array.isArray(opts) || opts.length === 0) return
      const found = opts.find((o) => (o.label || "").includes(includesText))
      if (found) setter(found)
    }

    // condition = แห้ง
    applyIfFound(conditionOptions, "แห้ง", (f) =>
      setOrder((p) => ({ ...p, conditionId: f.id, condition: f.label }))
    )

    // field type = นาปี
    applyIfFound(fieldTypeOptions, "นาปี", (f) =>
      setOrder((p) => ({ ...p, fieldTypeId: f.id, fieldType: f.label }))
    )

    // year = 2566/2567
    applyIfFound(yearOptions, "2566/2567", (f) =>
      setOrder((p) => ({ ...p, riceYearId: f.id, riceYear: f.label }))
    )

    // business = ซื้อมาขายไป
    applyIfFound(businessOptions, "ซื้อมาขายไป", (f) =>
      setOrder((p) => ({ ...p, businessTypeId: f.id, businessType: f.label }))
    )

    // program = ปกติ
    applyIfFound(programOptions, "ปกติ", (f) =>
      setOrder((p) => ({ ...p, programId: f.id, programName: f.label }))
    )
  }, [formTemplate, conditionOptions, fieldTypeOptions, yearOptions, programOptions, businessOptions])

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
      try { el.scrollIntoView({ behavior: "smooth", block: "center" }) } catch {}
      el.focus()
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
      try { el.scrollIntoView({ block: "center" }) } catch {}
      el.focus()
      try { el.select?.() } catch {}
    }
  }

  /** ---------- Helpers สำหรับรูปแบบวันที่ (ISO datetime) ---------- */
  const toIsoDateTime = (yyyyMmDd) => {
    try { return new Date(`${yyyyMmDd}T12:00:00Z`).toISOString() } catch { return new Date().toISOString() }
  }

  /** ---------- Submit ---------- */
  const handleSubmit = async (e) => {
    e.preventDefault()

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

    // ⭐ customer discriminator (individual/company) — ส่งเฉพาะ field ที่ BE รับ
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
            // optional cosmetics (ignored for lookup)
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
        : { party_type: "company", tax_id: "" } // จะให้ BE แจ้ง error เองถ้าไม่ครบ
    }

    /** Dept payload (แนบเสมอ — BE จะใช้เมื่อเป็นเครดิต) */
    const makeDeptDate = (yyyyMmDd) => {
      try { return new Date(`${yyyyMmDd}T00:00:00Z`).toISOString() } catch { return new Date().toISOString() }
    }
    const deptPayload = {
      date_created: makeDeptDate(dateStr),
      allowed_period: Number(dept.allowedPeriod || 0),
      postpone: Boolean(dept.postpone),
      postpone_period: Number(dept.postponePeriod || 0),
    }

    // ✅ spec ตาม ProductSpecIn
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
        // ❌ ห้ามใส่ business_type ในระดับ order (อยู่ใน spec แล้วตาม BE)
      },
      dept: deptPayload,
    }

    try {
      await post("/order/customers/save/buy", payload)
      // เก็บ template ปัจจุบันเผื่อรีเฟรชหน้าในอนาคต
      try { localStorage.setItem("buy.formTemplate", formTemplate) } catch {}
      alert("บันทึกออเดอร์เรียบร้อย ✅")
      // ⬇️ เคลียร์ฟอร์มทั้งหมด แต่คงค่า template เดิมไว้ + เด้งไปด้านบนสุด
      handleReset()
      // ใช้ RAF เพื่อให้ state รีเซ็ตเสร็จแล้วค่อยเลื่อน (รองรับเบราว์เซอร์ทั่วไป)
      requestAnimationFrame(() => scrollToPageTop())
    } catch (err) {
      console.error("SAVE ERROR:", err?.data || err)
      const detail = err?.data?.detail ? `\n\nรายละเอียด:\n${JSON.stringify(err.data.detail, null, 2)}` : ""
      alert(`บันทึกล้มเหลว: ${err.message || "เกิดข้อผิดพลาด"}${detail}`)
    }
  }

  const handleReset = () => {
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

    setOrder({
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
    // หมายเหตุ: formTemplate "คงไว้" ตามที่เลือกก่อนหน้า (ไม่แตะต้อง)

    // ⬆️ เด้งขึ้นบนสุดทุกครั้งที่กดรีเซ็ต
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

            {/* ดรอปดาวฟอร์มสำเร็จรูป (มุมขวา) */}
            <div className="w-full sm:w-72 self-start">
              <label className={labelCls}>ฟอร์มสำเร็จรูป</label>
              <ComboBox
                options={templateOptions}
                value={formTemplate}
                onChange={(id) => setFormTemplate(String(id))}
                buttonRef={refs.formTemplate}
              />
              {formTemplate === "1" ? (
                <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
                  <b>ฟอร์ม 17 ตค</b> จะล็อกค่า:
                  <br />
                  ประเภทสินค้า=ข้าวเปลือก • ชนิดข้าว=ข้าวหอมมะลิ • ชั้นย่อย=ดอกมะลิ 105 • เงื่อนไข=แห้ง • ประเภทนา=นาปี • ปี/ฤดูกาล=2566/2567 • ประเภทธุรกิจ=ซื้อมาขายไป • โปรแกรม=ปกติ
                </p>
              ) : (
                isTemplateActive && (
                  <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
                    ระบบล็อก <b>ประเภทสินค้า: ข้าวเปลือก</b> และ
                    <b>{formTemplate === "2" ? " ข้าวเหนียว" : formTemplate === "3" ? " เมล็ดพันธุ์" : ""}</b>
                  </p>
                )
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
                  setOrder((p) => ({ ...p, paymentMethod: found?.label ?? "", paymentMethodId: id }))
                }
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
                    if (e.target.value.trim().length >= 2) setShowNameList(true)
                    else {
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
                    if (e.target.value.trim().length >= 2) setShowCompanyList(true)
                    else {
                      setShowCompanyList(false)
                      setCompanyHighlighted(-1)
                    }
                  }
                }}
                onFocus={() => clearError("companyName")}
                onKeyDown={handleCompanyKeyDown}
                onKeyDownCapture={onEnter("companyName")}
                placeholder="เช่น บริษัท ตัวอย่าง จำกัด"
                aria-expanded={showCompanyList}
                aria-controls="company-results"
                role="combobox"
                aria-autocomplete="list"
                aria-invalid={errors.companyName ? true : undefined}
              />
              {errors.companyName && <p className={errorTextCls}>{errors.companyName}</p>}

              {buyerType === "company" && showCompanyList && companyResults.length > 0 && (
                <div
                  id="company-results"
                  className={
                    "mt-1 max-h-72 w-full overflow-auto rounded-2xl border border-slate-200 bg-white text-black shadow-sm " +
                    "dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                  }
                  role="listbox"
                >
                  {companyResults.map((r, idx) => {
                    const isActive = idx === companyHighlighted
                    const name = r.company_name ?? r.companyName ?? "(ไม่มีชื่อ)"
                    const tid = r.tax_id ?? "-"
                    return (
                      <button
                        type="button"
                        ref={(el) => (companyItemRefs.current[idx] = el)}
                        key={`${r.asso_id}-${tid}-${idx}`}
                        onClick={async () => await pickCompanyResult(r)}
                        onMouseEnter={() => {
                          setCompanyHighlighted(idx)
                          requestAnimationFrame(() => {
                            try { companyItemRefs.current[idx]?.scrollIntoView({ block: "nearest" }) } catch {}
                          })
                        }}
                        role="option"
                        aria-selected={isActive}
                        className={cx(
                          "relative flex w-full items-start gap-3 px-3 py-2.5 text-left transition rounded-xl cursor-pointer",
                          isActive
                            ? "bg-indigo-100 ring-1 ring-indigo-300 dark:bg-indigo-400/20 dark:ring-indigo-500"
                            : "hover:bg-indigo-50 dark:hover:bg-indigo-900/30"
                        )}
                      >
                        {isActive && (
                          <span className="absolute left-0 top-0 h-full w-1 bg-indigo-600 dark:bg-indigo-400/70 rounded-l-xl" />
                        )}
                        <div className="flex-1">
                          <div className="font-medium">{name}</div>
                          <div className="text-sm text-slate-600 dark:text-slate-300">
                            ภาษี {tid} • โทร {r.phone_number ?? "-"}
                          </div>
                        </div>
                      </button>
                    )
                  })}
                </div>
              )}
            </div>
          )}
          {/* ========== จบฟิลด์ลูกค้าในกรอบเดียว ========== */}
        </div>

        {/* ฟอร์มออเดอร์ */}
        <form
          onSubmit={handleSubmit}
          className="rounded-2xl border border-slate-200 bg-white p-5 text-black shadow-sm dark:border-slate-700 dark:bg-slate-800 dark:text-white"
        >
          <h2 className="mb-3 text-xl font-semibold">รายละเอียดการซื้อ</h2>

          {/* เลือกประเภท/ปี/โปรแกรม/ธุรกิจ */}
          <div className="grid gap-4 md:grid-cols-3">
            <div>
              <label className={labelCls}>ประเภทสินค้า</label>
              <ComboBox
                options={productOptions}
                value={order.productId}
                onChange={(id, found) => {
                  setOrder((p) => ({
                    ...p,
                    productId: id,
                    productName: found?.label ?? "",
                    riceId: "",
                    riceType: "",
                    subriceId: "",
                    subriceName: "",
                  }))
                }}
                placeholder="— เลือกประเภทสินค้า —"
                error={!!errors.product}
                hintRed={!!missingHints.product}
                clearHint={() => clearHint("product")}
                buttonRef={refs.product}
                disabled={formTemplate === "1"} // ⬅️ ล็อกเมื่อเป็นฟอร์ม 17 ตค
                onEnterNext={() => {
                  const tryFocus = () => {
                    if (formTemplate !== "1" && isEnabledInput(refs.riceType?.current)) {
                      refs.riceType.current.focus()
                      refs.riceType.current.scrollIntoView?.({ block: "center" })
                      return true
                    }
                    const keys = ["subrice","condition","fieldType","riceYear","program","businessType","branchName"]
                    for (const k of keys) {
                      const el = refs[k]?.current
                      if (el && isEnabledInput(el)) {
                        try { el.scrollIntoView({ block: "center" }) } catch {}
                        el.focus?.()
                        return true
                      }
                    }
                    return false
                  }
                  if (tryFocus()) return
                  setTimeout(tryFocus, 60)
                  setTimeout(tryFocus, 180)
                }}
              />
              {errors.product && <p className={errorTextCls}>{errors.product}</p>}
            </div>

            <div>
              <label className={labelCls}>ชนิดข้าว</label>
              <ComboBox
                options={riceOptions}
                value={order.riceId}
                onChange={(id, found) => {
                  setOrder((p) => ({
                    ...p,
                    riceId: id,
                    riceType: found?.label ?? "",
                    subriceId: "",
                    subriceName: "",
                  }))
                }}
                placeholder="— เลือกชนิดข้าว —"
                disabled={!order.productId || formTemplate === "1"} // ⬅️ ล็อกเมื่อเป็นฟอร์ม 17 ตค
                error={!!errors.riceType}
                hintRed={!!missingHints.riceType}
                clearHint={() => clearHint("riceType")}
                buttonRef={refs.riceType}
                onEnterNext={() => {
                  const tryFocus = () => {
                    const keys = ["subrice","condition","fieldType","riceYear","program","businessType","branchName"]
                    for (const k of keys) {
                      const el = refs[k]?.current
                      if (el && isEnabledInput(el)) {
                        try { el.scrollIntoView({ block: "center" }) } catch {}
                        el.focus?.()
                        return true
                      }
                    }
                    return false
                  }
                  if (tryFocus()) return
                  setTimeout(tryFocus, 60)
                  setTimeout(tryFocus, 120)
                  setTimeout(tryFocus, 200)
                }}
              />
              {errors.riceType && <p className={errorTextCls}>{errors.riceType}</p>}
            </div>

            <div>
              <label className={labelCls}>ชั้นย่อย (Sub-class)</label>
              <ComboBox
                options={subriceOptions}
                value={order.subriceId}
                onChange={(id, found) => {
                  setOrder((p) => ({ ...p, subriceId: id, subriceName: found?.label ?? "" }))
                }}
                placeholder="— เลือกชั้นย่อย —"
                disabled={!order.riceId || formTemplate === "1"} // ⬅️ ล็อกเมื่อเป็นฟอร์ม 17 ตค
                error={!!errors.subrice}
                hintRed={!!missingHints.subrice}
                clearHint={() => clearHint("subrice")}
                buttonRef={refs.subrice}
                onEnterNext={() => {
                  const keys = ["condition","fieldType","riceYear","program","businessType","branchName"]
                  const tryFocus = () => {
                    for (const k of keys) {
                      const el = refs[k]?.current
                      if (el && isEnabledInput(el)) {
                        try { el.scrollIntoView({ block: "center" }) } catch {}
                        el.focus?.()
                        return true
                      }
                    }
                    return false
                  }
                  if (tryFocus()) return
                  setTimeout(tryFocus, 60)
                  setTimeout(tryFocus, 180)
                }}
              />
              {errors.subrice && <p className={errorTextCls}>{errors.subrice}</p>}
            </div>

            <div>
              <label className={labelCls}>สภาพ/เงื่อนไข</label>
              <ComboBox
                options={conditionOptions}
                value={order.conditionId}
                getValue={(o) => o.id}
                onChange={(_id, found) =>
                  setOrder((p) => ({
                    ...p,
                    conditionId: found?.id ?? "",
                    condition: found?.label ?? "",
                  }))}
                placeholder="— เลือกสภาพ/เงื่อนไข —"
                error={!!errors.condition}
                hintRed={!!missingHints.condition}
                clearHint={() => clearHint("condition")}
                buttonRef={refs.condition}
                disabled={formTemplate === "1"} // ⬅️ ล็อก
                onEnterNext={() => focusNext("condition")}
              />
              {errors.condition && <p className={errorTextCls}>{errors.condition}</p>}
            </div>

            <div>
              <label className={labelCls}>ประเภทนา</label>
              <ComboBox
                options={fieldTypeOptions}
                value={order.fieldTypeId}
                getValue={(o) => o.id}
                onChange={(_id, found) =>
                  setOrder((p) => ({
                    ...p,
                    fieldTypeId: found?.id ?? "",
                    fieldType: found?.label ?? "",
                  }))}
                placeholder="— เลือกประเภทนา —"
                error={!!errors.fieldType}
                hintRed={!!missingHints.fieldType}
                clearHint={() => clearHint("fieldType")}
                buttonRef={refs.fieldType}
                disabled={formTemplate === "1"} // ⬅️ ล็อก
                onEnterNext={() => focusNext("fieldType")}
              />
              {errors.fieldType && <p className={errorTextCls}>{errors.fieldType}</p>}
            </div>

            <div>
              <label className={labelCls}>ปี/ฤดูกาล</label>
              <ComboBox
                options={yearOptions}
                value={order.riceYearId}
                getValue={(o) => o.id}
                onChange={(_id, found) =>
                  setOrder((p) => ({
                    ...p,
                    riceYearId: found?.id ?? "",
                    riceYear: found?.label ?? "",
                  }))}
                placeholder="— เลือกปี/ฤดูกาล —"
                error={!!errors.riceYear}
                hintRed={!!missingHints.riceYear}
                clearHint={() => clearHint("riceYear")}
                buttonRef={refs.riceYear}
                disabled={formTemplate === "1"} // ⬅️ ล็อก
                onEnterNext={() => {
                  // ปี/ฤดูกาล -> ประเภทธุรกิจ (ถ้าใช้ไม่ได้ ข้ามไป โปรแกรม -> สาขา -> คลัง)
                  const tryFocus = () => {
                    const keys = ["businessType", "program", "branchName", "klangName"]
                    for (const k of keys) {
                      const el = refs[k]?.current
                      if (el && isEnabledInput(el)) {
                        try { el.scrollIntoView({ block: "center" }) } catch {}
                        el.focus?.()
                        try { el.select?.() } catch {}
                        return true
                      }
                    }
                    return false
                  }
                  if (tryFocus()) return
                  setTimeout(tryFocus, 60)
                  setTimeout(tryFocus, 180)
                }}
              />
              {errors.riceYear && <p className={errorTextCls}>{errors.riceYear}</p>}
            </div>

            {/* ประเภทธุรกิจ */}
            <div>
              <label className={labelCls}>ประเภทธุรกิจ</label>
              <ComboBox
                options={businessOptions}
                value={order.businessTypeId}
                getValue={(o) => o.id}
                onChange={(_id, found) =>
                  setOrder((p) => ({
                    ...p,
                    businessTypeId: found?.id ?? "",
                    businessType: found?.label ?? "",
                  }))}
                placeholder="— เลือกประเภทธุรกิจ —"
                error={!!errors.businessType}
                hintRed={!!missingHints.businessType}
                clearHint={() => clearHint("businessType")}
                buttonRef={refs.businessType}
                disabled={formTemplate === "1"} // ⬅️ ล็อก
                onEnterNext={() => {
                  // ประเภทธุรกิจ -> โปรแกรม (fallback: สาขา/คลัง ถ้าโปรแกรมใช้ไม่ได้)
                  const tryFocus = () => {
                    const el = refs.program?.current
                    if (el && isEnabledInput(el)) {
                      try { el.scrollIntoView({ block: "center" }) } catch {}
                      el.focus?.()
                      try { el.select?.() } catch {}
                      return true
                    }
                    const fallback = ["branchName","klangName"]
                    for (const k of fallback) {
                      const e2 = refs[k]?.current
                      if (e2 && isEnabledInput(e2)) {
                        try { e2.scrollIntoView({ block: "center" }) } catch {}
                        e2.focus?.()
                        try { e2.select?.() } catch {}
                        return true
                      }
                    }
                    return false
                  }
                  if (tryFocus()) return
                  setTimeout(tryFocus, 80)
                  setTimeout(tryFocus, 200)
                }}
              />
              {errors.businessType && <p className={errorTextCls}>{errors.businessType}</p>}
            </div>

            <div>
              <label className={labelCls}>โปรแกรม</label>
              <ComboBox
                options={programOptions}
                value={order.programId}
                getValue={(o) => o.id}
                onChange={(_id, found) =>
                  setOrder((p) => ({
                    ...p,
                    programId: found?.id ?? "",
                    programName: found?.label ?? "",
                  }))}
                placeholder="— เลือกโปรแกรม —"
                buttonRef={refs.program}
                error={!!errors.program}
                hintRed={!!missingHints.program}
                clearHint={() => { clearHint("program"); clearError("program") }}
                disabled={formTemplate === "1"}
                onEnterNext={() => {
                  // โปรแกรม -> คลัง (ถ้าคลังยังใช้ไม่ได้ ให้ไปสาขาก่อน)
                  const focusKlang = () => {
                    const elK = refs.klangName?.current
                    if (elK && isEnabledInput(elK)) {
                      try { elK.scrollIntoView({ block: "center" }) } catch {}
                      elK.focus?.()
                      try { elK.select?.() } catch {}
                      return true
                    }
                    const elB = refs.branchName?.current
                    if (elB && isEnabledInput(elB)) {
                      try { elB.scrollIntoView({ block: "center" }) } catch {}
                      elB.focus?.()
                      try { elB.select?.() } catch {}
                      return true
                    }
                    return false
                  }
                  if (focusKlang()) return
                  setTimeout(focusKlang, 100)
                  setTimeout(focusKlang, 250)
                }}
              />

              {errors.program && <p className={errorTextCls}>{errors.program}</p>}
            </div>
          </div>

          {/* สาขา + คลัง */}
          <div className="mt-4 grid gap-4 md:grid-cols-3">
            <div>
              <label className={labelCls}>สาขา</label>
              <ComboBox
                options={
                  branchLocked && order.branchId != null
                    ? branchOptions.filter((o) => String(o.id) === String(order.branchId))
                    : branchOptions
                }
                value={order.branchId}
                getValue={(o) => o.id}
                onChange={(_val, found) => {
                  setOrder((p) => ({
                    ...p,
                    branchId: found?.id ?? null,
                    branchName: found?.label ?? "",
                    klangName: "",
                    klangId: null,
                  }))
                }}
                placeholder="— เลือกสาขา —"
                error={!!errors.branchName}
                hintRed={!!missingHints.branchName}
                clearHint={() => clearHint("branchName")}
                buttonRef={refs.branchName}
                disabled={branchLocked}
                onEnterNext={() => {
                  const tryFocus = () => {
                    const el = refs.klangName?.current
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
              {branchLocked && <p className={helpTextCls}>สาขาถูกล็อกตามรหัสผู้ใช้</p>}
              {errors.branchName && <p className={errorTextCls}>{errors.branchName}</p>}
            </div>

            <div>
              <label className={labelCls}>คลัง</label>
              <ComboBox
                options={klangOptions}
                value={order.klangId}
                getValue={(o) => o.id}
                onChange={(_val, found) => {
                  setOrder((p) => ({
                    ...p,
                    klangId: found?.id ?? null,
                    klangName: found?.label ?? "",
                  }))
                }}
                placeholder="— เลือกคลัง —"
                disabled={!order.branchId}
                error={!!errors.klangName}
                hintRed={!!missingHints.klangName}
                clearHint={() => clearHint("klangName")}
                buttonRef={refs.klangName}
                onEnterNext={() => {
                  const tryFocus = () => {
                    const el = refs.entryWeightKg?.current
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
              {errors.klangName && <p className={errorTextCls}>{errors.klangName}</p>}
            </div>
          </div>

          {/* กรอบตัวเลข */}
          <div className="mt-6 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm ring-1 ring-transparent dark:border-slate-700 dark:bg-slate-800">
            <div className="mb-3 flex items-center gap-2">
              <span className="inline-flex h-2 w-2 rounded-full bg-emerald-500" />
              <h3 className="text-lg font-semibold">ตัวเลขและการคำนวณ</h3>
            </div>

            {/* น้ำหนักก่อนชั่ง */}
            <div className="grid gap-4 md:grid-cols-3">
              <div>
                <label className={labelCls}>น้ำหนักก่อนชั่ง (กก.)</label>
                <input
                  ref={refs.entryWeightKg}
                  inputMode="decimal"
                  className={cx(baseField, redFieldCls("entryWeightKg"))}
                  value={order.entryWeightKg}
                  onChange={(e) => updateOrder("entryWeightKg", e.target.value.replace(/[^\d.]/g, ""))}
                  onFocus={() => {
                    clearHint("entryWeightKg")
                    clearError("entryWeightKg")
                  }}
                  onKeyDown={onEnter("entryWeightKg")}
                  placeholder="เช่น 12000"
                  aria-invalid={errors.entryWeightKg ? true : undefined}
                />
                {errors.entryWeightKg && <p className={errorTextCls}>{errors.entryWeightKg}</p>}
              </div>

              <div>
                <label className={labelCls}>น้ำหนักหลังชั่ง (กก.)</label>
                <input
                  ref={refs.exitWeightKg}
                  inputMode="decimal"
                  className={cx(baseField, redFieldCls("exitWeightKg"))}
                  value={order.exitWeightKg}
                  onChange={(e) => updateOrder("exitWeightKg", e.target.value.replace(/[^\d.]/g, ""))}
                  onFocus={() => {
                    clearHint("exitWeightKg")
                    clearError("exitWeightKg")
                  }}
                  onKeyDown={onEnter("exitWeightKg")}
                  placeholder="เช่น 7000"
                  aria-invalid={errors.exitWeightKg ? true : undefined}
                />
                {errors.exitWeightKg && <p className={errorTextCls}>{errors.exitWeightKg}</p>}
              </div>

              <div>
                <label className={labelCls}>น้ำหนักจากตาชั่ง (กก.)</label>
                <input disabled className={cx(baseField, fieldDisabled)} value={Math.round(grossFromScale * 100) / 100} />
                <p className={helpTextCls}>คำนวณจาก |หลังชั่ง − ก่อนชั่ง|</p>
              </div>

              {/* ความชื้น */}
              <div>
                <label className={labelCls}>ความชื้น (%)</label>
                <input
                  ref={refs.moisturePct}
                  inputMode="decimal"
                  className={cx(baseField, redFieldCls("moisturePct"))}
                  value={order.moisturePct}
                  onChange={(e) => updateOrder("moisturePct", onlyDigits(e.target.value))}
                  onFocus={() => { clearHint("moisturePct"); clearError("moisturePct") }}
                  onKeyDown={onEnter("moisturePct")}
                  placeholder="เช่น 18"
                />
                <p className={helpTextCls}>{MOISTURE_STD}</p>
                {errors.moisturePct && <p className={errorTextCls}>{errors.moisturePct}</p>}
              </div>

              {/* สิ่งเจือปน */}
              <div>
                <label className={labelCls}>สิ่งเจือปน (%)</label>
                <input
                  ref={refs.impurityPct}
                  inputMode="decimal"
                  className={cx(baseField, redFieldCls("impurityPct"))}
                  value={order.impurityPct}
                  onChange={(e) => updateOrder("impurityPct", onlyDigits(e.target.value))}
                  onFocus={() => { clearHint("impurityPct"); clearError("impurityPct") }}
                  onKeyDown={onEnter("impurityPct")}
                  placeholder="เช่น 2"
                />
                {errors.impurityPct && <p className={errorTextCls}>{errors.impurityPct}</p>}
              </div>

              {/* หักน้ำหนัก */}
              <div className="">
                <div className="flex items-center justify-between">
                  <label className={labelCls}>หักน้ำหนัก (ความชื้น+สิ่งเจือปน) (กก.)</label>
                  <label className="flex cursor-pointer items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={order.manualDeduct}
                      onChange={(e) => updateOrder("manualDeduct", e.target.checked)}
                    />
                    กำหนดเอง
                  </label>
                </div>
                <input
                  ref={refs.deductWeightKg}
                  inputMode="decimal"
                  disabled={!order.manualDeduct}
                  className={cx(
                    baseField,
                    !order.manualDeduct && fieldDisabled,
                    errors.deductWeightKg && "border-red-400",
                    order.manualDeduct && redHintCls("deductWeightKg")
                  )}
                  value={
                    order.manualDeduct
                      ? order.deductWeightKg
                      : String(Math.round(suggestDeductionWeight(grossFromScale, order.moisturePct, order.impurityPct) * 100) / 100)
                  }
                  onChange={(e) => updateOrder("deductWeightKg", e.target.value.replace(/[^\d.]/g, ""))}
                  onFocus={() => clearHint("deductWeightKg")}
                  onKeyDown={onEnter("deductWeightKg")}
                  placeholder="ระบบคำนวณให้ หรือกำหนดเอง"
                  aria-invalid={errors.deductWeightKg ? true : undefined}
                />
                {errors.deductWeightKg && <p className={errorTextCls}>{errors.deductWeightKg}</p>}
              </div>

              <div>
                <label className={labelCls}>น้ำหนักสุทธิ (กก.)</label>
                <input disabled className={cx(baseField, fieldDisabled)} value={Math.round(netWeight * 100) / 100} />
              </div>

              {/* gram */}
              <div>
                <label className={labelCls}>คุณภาพข้าว (gram)</label>
                <input
                  ref={refs.gram}
                  inputMode="numeric"
                  className={cx(baseField, redFieldCls("gram"))}
                  value={order.gram}
                  onChange={(e) => updateOrder("gram", onlyDigits(e.target.value))}
                  onFocus={() => { clearHint("gram"); clearError("gram") }}
                  onKeyDown={onEnter("gram")}
                  placeholder="เช่น 85"
                />
                {errors.gram && <p className={errorTextCls}>{errors.gram}</p>}
              </div>

              {/* ราคาต่อกก. */}
              <div>
                <label className={labelCls}>ราคาต่อกก. (บาท)</label>
                <input
                  ref={refs.unitPrice}
                  inputMode="decimal"
                  className={cx(baseField, redFieldCls("unitPrice"))}
                  value={order.unitPrice}
                  onChange={(e) => updateOrder("unitPrice", e.target.value.replace(/[^\d.]/g, ""))}
                  onFocus={() => { clearHint("unitPrice"); clearError("unitPrice") }}
                  onKeyDown={onEnter("unitPrice")}
                  placeholder="เช่น 12.50"
                />
                <p className={helpTextCls}>ถ้ากรอกราคา ระบบจะคำนวณ “เป็นเงิน” ให้อัตโนมัติ</p>
                {errors.unitPrice && <p className={errorTextCls}>{errors.unitPrice}</p>}
              </div>

              {/* เป็นเงิน */}
              <div>
                <label className={labelCls}>เป็นเงิน (บาท)</label>
                <input
                  ref={refs.amountTHB}
                  inputMode="decimal"
                  className={cx(baseField, redFieldCls("amountTHB"))}
                  value={order.amountTHB}
                  onChange={(e) => updateOrder("amountTHB", formatMoneyInput(e.target.value))}
                  onFocus={() => {
                    clearHint("amountTHB")
                    clearError("amountTHB")
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.isComposing) {
                      e.preventDefault()
                      const btn = refs.submitBtn?.current
                      if (btn && isEnabledInput(btn)) {
                        try { btn.scrollIntoView({ block: "center" }) } catch {}
                        btn.focus?.()
                      }
                    }
                  }}
                  placeholder="เช่น 60,000"
                  aria-invalid={errors.amountTHB ? true : undefined}
                />
                {!!order.amountTHB && <p className={helpTextCls}>≈ {thb(moneyToNumber(order.amountTHB))}</p>}
                {errors.amountTHB && <p className={errorTextCls}>{errors.amountTHB}</p>}
              </div>
            </div>
          </div>

          {/* สรุป */}
          <div className="mt-6 grid gap-4 md:grid-cols-5">
            {/* ผู้ขาย */}
            {buyerType === "person" ? (
              <>
                <div className="rounded-2xl bg-white p-4 text-black shadow-sm ring-1 ring-slate-200 dark:bg-slate-800 dark:text-white dark:ring-slate-700">
                  <div className="text-slate-600 dark:text-slate-300">ผู้ซื้อ</div>
                  <div className="text-lg md:text-xl font-semibold whitespace-pre-line">
                    {customer.fullName || "—"}
                  </div>
                </div>
                <div className="rounded-2xl bg-white p-4 text-black shadow_sm ring-1 ring-slate-200 dark:bg-slate-800 dark:text-white dark:ring-slate-700">
                  <div className="text-slate-600 dark:text-slate-300">member_id</div>
                  <div className="text-lg md:text-xl font-semibold">{memberMeta.memberId ?? (customer.memberId?.trim() || "-")}</div>
                </div>
              </>
            ) : (
              <>
                <div className="rounded-2xl bg-white p-4 text-black shadow-sm ring-1 ring-slate-200 dark:bg-slate-800 dark:text-white dark:ring-slate-700">
                  <div className="text-slate-600 dark:text-slate-300">บริษัท/นิติบุคคล</div>
                  <div className="text-lg md:text-xl font-semibold">{customer.companyName || "—"}</div>
                </div>
                <div className="rounded-2xl bg_white p-4 text-black shadow-sm ring-1 ring-slate-200 dark:bg-slate-800 dark:text-white dark:ring-slate-700">
                  <div className="text-slate-600 dark:text-slate-300">เลขที่ผู้เสียภาษี</div>
                  <div className="text-lg md:text-xl font-semibold">{customer.taxId || "—"}</div>
                </div>
              </>
            )}

            {[
              { label: "ลงวันที่", value: order.issueDate || "—" },
              { label: "วิธีชำระเงิน", value: order.paymentMethod || "—" },
              { label: "สินค้า", value: order.productName || "—" },
              { label: "ชนิดข้าว", value: order.riceType || "—" },
              { label: "ชั้นย่อย", value: order.subriceName || "—" },
              { label: "เงื่อนไข", value: order.condition || "—" },
              { label: "ประเภทนา", value: order.fieldType || "—" },
              { label: "ปี/ฤดูกาล", value: order.riceYear || "—" },
              { label: "ประเภทธุรกิจ", value: order.businessType || "—" },
              {
                label: "สาขา / คลัง",
                value: (
                  <ul className="list-disc pl-5">
                    <li>{order.branchName || "—"}</li>
                    {order.klangName && <li>{order.klangName}</li>}
                  </ul>
                ),
              },
              { label: "ก่อนชั่ง", value: Math.round(toNumber(order.entryWeightKg) * 100) / 100 + " กก." },
              { label: "หลังชั่ง", value: Math.round(toNumber(order.exitWeightKg) * 100) / 100 + " กก." },
              { label: "จากตาชั่ง", value: Math.round(grossFromScale * 100) / 100 + " กก." },
              { label: "หัก (ความชื้น+สิ่งเจือปน)", value: Math.round(toNumber(autoDeduct) * 100) / 100 + " กก." },
              { label: "สุทธิ", value: Math.round(netWeight * 100) / 100 + " กก." },
              {
                label: "ราคาต่อหน่วย",
                value: order.unitPrice ? `${Number(order.unitPrice).toFixed(2)} บาท/กก.` : "—",
              },
              { label: "ยอดเงิน", value: order.amountTHB ? thb(moneyToNumber(order.amountTHB)) : "—" },
              { label: "เลขที่ใบชั่ง/ใบเบิกเงิน", value: order.paymentRefNo || "—" },
              { label: "หมายเหตุ / คอมเมนต์", value: order.comment || "—" },
            ].map((c) => (
              <div
                key={c.label}
                className="rounded-2xl bg-white p-4 text-black shadow-sm ring-1 ring-slate-200 dark:bg-slate-800 dark:text-white dark:ring-slate-700"
              >
                <div className="text-slate-600 dark:text-slate-300">{c.label}</div>
                {typeof c.value === "string" ? (
                  <div className="text-lg md:text-xl font-semibold whitespace-pre-line">{c.value}</div>
                ) : (
                  <div className="text-lg md:text-xl font-semibold">{c.value}</div>
                )}
              </div>
            ))}
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
