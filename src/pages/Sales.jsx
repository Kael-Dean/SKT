// src/pages/Sales.jsx
import { useEffect, useMemo, useRef, useState, forwardRef, useImperativeHandle } from "react"
import { apiAuth, post } from "../lib/api" // helper แนบโทเคนอัตโนมัติ

/** ---------------- Utilities (ยึดสไตล์/แนวคิดจากหน้า Buy) ---------------- */
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

/** เงิน: ช่วยให้พิมพ์แล้วขึ้นคอมม่า และแปลงกลับเป็นตัวเลข */
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

function useDebounce(value, delay = 400) {
  const [debounced, setDebounced] = useState(value)
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delay)
    return () => clearTimeout(t)
  }, [value, delay])
  return debounced
}

/** ---------------- Styles (เหมือนหน้า Buy) ---------------- */
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

/** ---------------- Enter-to-next ---------------- */
const isEnabledInput = (el) => {
  if (!el) return false
  if (typeof el.disabled !== "undefined" && el.disabled) return false
  const style = window.getComputedStyle?.(el)
  if (style && (style.display === "none" || style.visibility === "hidden")) return false
  if (!el.offsetParent && el.type !== "hidden" && el.getAttribute("role") !== "combobox") return false
  return true
}
const useEnterNavigation = (refs, buyerType, order) => {
  const personOrder = ["citizenId", "memberId", "fullName", "houseNo", "moo", "subdistrict", "district", "province", "postalCode", "phone"]
  const companyOrder = ["companyName", "taxId", "companyPhone", "hqHouseNo", "hqMoo", "hqSubdistrict", "hqDistrict", "hqProvince", "hqPostalCode", "brHouseNo", "brMoo", "brSubdistrict", "brDistrict", "brProvince", "brPostalCode"]
  const orderOrder = [
    "product", "riceType", "subrice", "condition", "fieldType", "riceYear", "businessType", "program",
    "branchName", "klangName", "entryWeightKg", "exitWeightKg", "unitPrice", "amountTHB",
    // เอกสารอ้างอิง
    "scaleNo", "cashReceiptNo", "creditInvoiceNo",
    "comment", "payment", "issueDate"
  ]
  let list = (buyerType === "person" ? personOrder : companyOrder).concat(orderOrder)
  list = list.filter((key) => {
    const el = refs?.[key]?.current
    if (!el) return false
    if (key === "subrice" && !order.riceId) return false
    if (key === "riceType" && !order.productId) return false
    if (key === "klangName" && !order.branchId) return false
    // เงื่อนไขแสดงเอกสาร
    if (key === "cashReceiptNo" && !order.__isCash) return false
    if (key === "creditInvoiceNo" && !order.__isCredit) return false
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

/** ---------------- Reusable ComboBox ---------------- */
function ComboBox({
  options = [], value, onChange, placeholder = "— เลือก —",
  getLabel = (o) => o?.label ?? "", getValue = (o) => o?.value ?? o?.id ?? "",
  disabled = false, error = false, buttonRef = null, hintRed = false,
  clearHint = () => {}, onEnterNext
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
      e.preventDefault(); setOpen(true); setHighlight((h) => (h >= 0 ? h : 0)); clearHint?.(); return
    }
    if (!open) return
    if (e.key === "ArrowDown") {
      e.preventDefault()
      setHighlight((h) => { const next = h < options.length - 1 ? h + 1 : 0; requestAnimationFrame(() => scrollHighlightedIntoView(next)); return next })
    } else if (e.key === "ArrowUp") {
      e.preventDefault()
      setHighlight((h) => { const prev = h > 0 ? h - 1 : options.length - 1; requestAnimationFrame(() => scrollHighlightedIntoView(prev)); return prev })
    } else if (e.key === "Enter") {
      e.preventDefault()
      if (highlight >= 0 && highlight < options.length) commit(options[highlight])
    } else if (e.key === "Escape") {
      e.preventDefault(); setOpen(false); setHighlight(-1)
    }
  }

  return (
    <div className="relative" ref={boxRef}>
      <button
        type="button"
        ref={controlRef}
        disabled={disabled}
        onClick={() => { if (!disabled) { setOpen((o) => o || !o); clearHint?.() } }}
        onKeyDown={onKeyDown}
        onFocus={() => clearHint?.()}
        className={cx(
          "w-full rounded-2xl border p-3 text-left text-[15px] md:text-base outline-none transition shadow-none",
          disabled ? "bg-slate-100 cursor-not-allowed" : "bg-slate-100 hover:bg-slate-200 cursor-pointer",
          error ? "border-red-400 ring-2 ring-red-300/70"
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
                  isActive ? "bg-emerald-100 ring-1 ring-emerald-300 dark:bg-emerald-400/20 dark:ring-emerald-500"
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

/** ---------------- DateInput ---------------- */
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
        className="absolute right-2 top-1/2 -translate-y-1/2 inline-flex h-9 w-9 items-center justify-center rounded-xl
        transition-transform hover:scale-110 active:scale-95 focus:outline-none cursor-pointer bg-transparent"
      >
        <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor" className="text-slate-600 dark:text-slate-200">
          <path d="M7 2a1 1 0 0 1 1 1v1h8V3a1 1 0 1 1 2 0v1h1a2 2 0 0 1 2 2v3H3V6a2 2 0 0 1 2-2h1V3a1 1 0 1 1 1-1zm14 9v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-7h18zM7 14h2v2H7v-2zm4 0h2v2h-2v-2z" />
        </svg>
      </button>
    </div>
  )
})

/** =====================================================================
 *                              Sales Page
 *  - UI ให้เหมือน Buy + เพิ่มฟอร์มสำเร็จรูป
 *  - เพิ่มเอกสารอ้างอิง 3 ช่อง (แสดงตามวิธีชำระเงิน)
 *  - ส่งข้อมูลตาม BE (/order/customers/save/sell)
 * ===================================================================== */
function Sales() {
  /** ---------- state พื้นฐาน ---------- */
  const [errors, setErrors] = useState({})
  const [missingHints, setMissingHints] = useState({})
  const [loadingCustomer, setLoadingCustomer] = useState(false)
  const [customerFound, setCustomerFound] = useState(null)

  // ค้นหาชื่อบุคคล
  const [nameResults, setNameResults] = useState([])
  const [showNameList, setShowNameList] = useState(false)
  const nameBoxRef = useRef(null)
  const nameInputRef = useRef(null)
  const suppressNameSearchRef = useRef(false)
  const [highlightedIndex, setHighlightedIndex] = useState(-1)
  const listContainerRef = useRef(null)
  const itemRefs = useRef([])

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

  /** ---------- ฟอร์มสำเร็จรูป (Template) แบบหน้า Buy ---------- */
  const templateOptions = [
    { id: "0", label: "— ฟอร์มปกติ —" },
    { id: "1", label: "รหัส 1 • ข้าวหอมมะลิ" },
    { id: "2", label: "รหัส 2 • ข้าวเหนียว" },
    { id: "3", label: "รหัส 3 • เมล็ดพันธุ์" },
  ]
  const [formTemplate, setFormTemplate] = useState("0")
  const isTemplateActive = formTemplate !== "0"

  /** ---------- ประเภทผู้ซื้อ ---------- */
  const buyerTypeOptions = [
    { id: "person", label: "บุคคลธรรมดา" },
    { id: "company", label: "บริษัท / นิติบุคคล" },
  ]
  const [buyerType, setBuyerType] = useState("person")

  /** ---------- ฟอร์มลูกค้า ---------- */
  const [customer, setCustomer] = useState({
    // บุคคล
    citizenId: "",
    memberId: "", // ⭐ เพื่ออ้างอิงตอนบันทึก
    fullName: "",
    houseNo: "", moo: "", subdistrict: "", district: "", province: "", postalCode: "", phone: "",
    // บริษัท
    companyName: "", taxId: "", companyPhone: "",
    hqHouseNo: "", hqMoo: "", hqSubdistrict: "", hqDistrict: "", hqProvince: "", hqPostalCode: "",
    brHouseNo: "", brMoo: "", brSubdistrict: "", brDistrict: "", brProvince: "", brPostalCode: "",
  })

  /** ---------- meta ของบุคคล/ลูกค้า ---------- */
  const [memberMeta, setMemberMeta] = useState({
    type: "unknown",   // "member" | "customer" | "unknown"
    assoId: null,
    memberId: null,
  })

  /** ---------- ฟอร์มออเดอร์ ---------- */
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

    entryWeightKg: "", exitWeightKg: "",
    unitPrice: "", amountTHB: "",
    issueDate: new Date().toISOString().slice(0, 10),
    gram: "", comment: "",

    // วิธีชำระเงิน
    paymentMethod: "",    // label
    paymentMethodId: "",  // id

    // เอกสารอ้างอิง (optional)
    scaleNo: "",
    cashReceiptNo: "",      // แสดงเมื่อขายสด
    creditInvoiceNo: "",    // แสดงเมื่อขายเชื่อ

    // internal flags
    __isCash: false,
    __isCredit: false,
  })

  /** ---------- Refs สำหรับนำทางด้วย Enter ---------- */
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
    entryWeightKg: useRef(null), exitWeightKg: useRef(null),
    unitPrice: useRef(null), amountTHB: useRef(null),
    issueDate: useRef(null), gram: useRef(null), comment: useRef(null),
    buyerType: useRef(null),

    // docs
    scaleNo: useRef(null),
    cashReceiptNo: useRef(null),
    creditInvoiceNo: useRef(null),

    // template
    formTemplate: useRef(null),
  }
  const { onEnter, focusNext } = useEnterNavigation(refs, buyerType, order)

  /** ---------- Debounce ---------- */
  const debouncedCitizenId = useDebounce(customer.citizenId)
  const debouncedMemberId  = useDebounce(customer.memberId)
  const debouncedFullName  = useDebounce(customer.fullName)
  const debouncedCompanyName = useDebounce(customer.companyName)
  const debouncedTaxId = useDebounce(customer.taxId)

  /** ---------- helpers ---------- */
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

  /** ---------- โหลด dropdown เริ่มต้น ---------- */
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
            fetchFirstOkJson(["/order/payment/search/sell"]),  // ⭐ Sales → sell (id=1,2)
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

  /** ---------- โหลด species/variant เมื่อเลือก product ---------- */
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
      } catch (e) {
        console.error(e); setRiceOptions([])
      }
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
      } catch (e) {
        console.error(e); setSubriceOptions([])
      }
    }
    loadVariant()
  }, [order.riceId])

  /** ---------- โหลดคลังตามสาขา ---------- */
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
      } catch (e) {
        console.error(e); setKlangOptions([])
      }
    }
    loadKlang()
  }, [order.branchId, order.branchName])

  /** ---------- ฟอร์มสำเร็จรูป: โหลด/บันทึกค่า ---------- */
  useEffect(() => {
    try {
      const saved = localStorage.getItem("sales.formTemplate")
      if (saved && ["0", "1", "2", "3"].includes(saved)) setFormTemplate(saved)
    } catch {}
  }, [])
  useEffect(() => {
    try { localStorage.setItem("sales.formTemplate", formTemplate) } catch {}
  }, [formTemplate])

  // เมื่อเปลี่ยน Template → บังคับเลือก "ประเภทสินค้า: ข้าวเปลือก"
  useEffect(() => {
    if (!isTemplateActive) return
    if (productOptions.length === 0) return
    const paddy = productOptions.find((o) => o.label.includes("ข้าวเปลือก"))
    if (paddy && order.productId !== paddy.id) {
      setOrder((p) => ({
        ...p,
        productId: paddy.id,
        productName: paddy.label,
        riceId: "", riceType: "",
        subriceId: "", subriceName: "",
      }))
    }
  }, [formTemplate, productOptions])

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
        subriceId: "", subriceName: "",
      }))
    }
  }, [formTemplate, riceOptions])

  /** ---------- แผงค้นหาบุคคล (member_id, citizen_id, ชื่อ) ---------- */
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
      memberId: r.member_id != null ? toIntOrNull(r.member_id) : null,
    }
  }
  const fillFromRecord = async (raw = {}) => {
    const data = mapSimplePersonToUI(raw)
    setCustomer((prev) => ({
      ...prev,
      citizenId: onlyDigits(data.citizenId || prev.citizenId),
      fullName: data.fullName || prev.fullName,
      phone: data.phone || prev.phone,
      memberId: data.memberId != null ? String(data.memberId) : prev.memberId,
    }))
    setMemberMeta({ type: data.type, assoId: data.assoId, memberId: data.memberId })
    setCustomerFound(true)
  }

  // ค้นด้วย member_id
  useEffect(() => {
    if (buyerType !== "person") { setCustomerFound(null); return }
    const mid = toIntOrNull(debouncedMemberId)
    if (mid == null) return
    const fetchByMemberId = async () => {
      try {
        setLoadingCustomer(true)
        const arr = (await apiAuth(`/order/customers/search?q=${encodeURIComponent(String(mid))}`)) || []
        const exact = arr.find((r) => r.type === "member" && toIntOrNull(r.member_id) === mid) || arr[0]
        if (exact) await fillFromRecord(exact)
        else { setCustomerFound(false); setMemberMeta({ type: "customer", assoId: null, memberId: null }) }
      } catch (e) {
        console.error(e); setCustomerFound(false); setMemberMeta({ type: "customer", assoId: null, memberId: null })
      } finally { setLoadingCustomer(false) }
    }
    fetchByMemberId()
  }, [debouncedMemberId, buyerType])

  // citizen_id (เพื่อช่วยเติมข้อมูล/ที่อยู่เท่านั้น)
  useEffect(() => {
    if (buyerType !== "person") { setCustomerFound(null); setMemberMeta({ type: "unknown", assoId: null, memberId: null }); return }
    const cid = onlyDigits(debouncedCitizenId)
    if (cid.length !== 13) { setCustomerFound(null); return }
    const fetchByCid = async () => {
      try {
        setLoadingCustomer(true)
        const arr = (await apiAuth(`/order/customers/search?q=${encodeURIComponent(cid)}`)) || []
        const exact = arr.find((r) => onlyDigits(r.citizen_id || r.citizenId || "") === cid) || arr[0]
        if (exact) await fillFromRecord(exact)
        else { setCustomerFound(false); setMemberMeta({ type: "customer", assoId: null, memberId: null }) }
      } catch (e) {
        console.error(e); setCustomerFound(false); setMemberMeta({ type: "customer", assoId: null, memberId: null })
      } finally { setLoadingCustomer(false) }
    }
    fetchByCid()
  }, [debouncedCitizenId, buyerType])

  // ค้นด้วยชื่อ
  useEffect(() => {
    if (buyerType !== "person") { setShowNameList(false); setNameResults([]); setHighlightedIndex(-1); setMemberMeta({ type: "unknown", assoId: null, memberId: null }); return }
    const q = (debouncedFullName || "").trim()
    if (suppressNameSearchRef.current) {
      suppressNameSearchRef.current = false; setShowNameList(false); setNameResults([]); setHighlightedIndex(-1); return
    }
    if (q.length < 2) { setNameResults([]); setShowNameList(false); setHighlightedIndex(-1); return }
    const searchByName = async () => {
      try {
        setLoadingCustomer(true)
        const items = (await apiAuth(`/order/customers/search?q=${encodeURIComponent(q)}`)) || []
        const mapped = items.map((r) => ({
          ...r,
          asso_id: r.asso_id, member_id: r.member_id,
          citizen_id: r.citizen_id, first_name: r.first_name, last_name: r.last_name,
        }))
        setNameResults(mapped)
        if (document.activeElement === nameInputRef.current) {
          setShowNameList(true); setHighlightedIndex(mapped.length > 0 ? 0 : -1)
        }
      } catch (e) {
        console.error(e); setNameResults([]); setShowNameList(false); setHighlightedIndex(-1)
      } finally { setLoadingCustomer(false) }
    }
    searchByName()
  }, [debouncedFullName, buyerType])

  // ปิดลิสต์เมื่อคลิกนอก
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
    suppressNameSearchRef.current = true
    await fillFromRecord(rec)
    setShowNameList(false); setNameResults([]); setHighlightedIndex(-1)
  }
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
      if (highlightedIndex >= 0 && highlightedIndex < nameResults.length) await pickNameResult(nameResults[highlightedIndex])
    } else if (e.key === "Escape") {
      e.preventDefault(); setShowNameList(false); setHighlightedIndex(-1)
    }
  }

  /** ---------- บริษัท ---------- */
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
    setMemberMeta({ type: "company", assoId: data.assoId ?? null, memberId: null })
    setShowCompanyList(false); setCompanyResults([]); setCompanyHighlighted(-1)
  }
  useEffect(() => {
    if (buyerType !== "company") { setShowCompanyList(false); setCompanyResults([]); setCompanyHighlighted(-1); return }
    const q = (debouncedCompanyName || "").trim()
    if (companySuppressSearchRef.current) {
      companySuppressSearchRef.current = false; setShowCompanyList(false); setCompanyResults([]); setCompanyHighlighted(-1); return
    }
    if (q.length < 2) { setCompanyResults([]); setShowCompanyList(false); setCompanyHighlighted(-1); return }
    const searchCompany = async () => {
      try {
        setLoadingCustomer(true)
        const items = (await apiAuth(`/order/companies/search?q=${encodeURIComponent(q)}`)) || []
        setCompanyResults(items)
        if (document.activeElement === companyInputRef.current) {
          setShowCompanyList(true); setCompanyHighlighted(items.length > 0 ? 0 : -1)
        }
      } catch (err) {
        console.error(err); setCompanyResults([]); setShowCompanyList(false); setCompanyHighlighted(-1)
      } finally { setLoadingCustomer(false) }
    }
    searchCompany()
  }, [debouncedCompanyName, buyerType])
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
  const handleCompanyKeyDown = async (e) => {
    if (!showCompanyList || companyResults.length === 0) return
    if (e.key === "ArrowDown") { e.preventDefault(); const next = companyHighlighted < companyResults.length - 1 ? companyHighlighted + 1 : 0; setCompanyHighlighted(next); requestAnimationFrame(() => { try { companyItemRefs.current[next]?.scrollIntoView({ block: "nearest" }) } catch {} }) }
    else if (e.key === "ArrowUp") { e.preventDefault(); const prev = companyHighlighted > 0 ? companyHighlighted - 1 : companyResults.length - 1; setCompanyHighlighted(prev); requestAnimationFrame(() => { try { companyItemRefs.current[prev]?.scrollIntoView({ block: "nearest" }) } catch {} }) }
    else if (e.key === "Enter") { e.preventDefault(); if (companyHighlighted >= 0 && companyHighlighted < companyResults.length) await pickCompanyResult(companyResults[companyHighlighted]) }
    else if (e.key === "Escape") { e.preventDefault(); setShowCompanyList(false); setCompanyHighlighted(-1) }
  }

  /** ---------- อัปเดตและคำนวณน้ำหนัก ---------- */
  const updateCustomer = (k, v) => { if (String(v).trim() !== "") clearHint(k); setCustomer((p) => ({ ...p, [k]: v })) }
  const updateOrder = (k, v) => { if (String(v).trim() !== "") clearHint(k); setOrder((p) => ({ ...p, [k]: v })) }

  const grossFromScale = useMemo(() => {
    const entry = toNumber(order.entryWeightKg)
    const exit  = toNumber(order.exitWeightKg)
    const g = Math.abs(exit - entry)
    return g > 0 ? g : 0
  }, [order.entryWeightKg, order.exitWeightKg])

  const computedAmount = useMemo(() => {
    if (order.unitPrice === "" || isNaN(Number(order.unitPrice))) return null
    return grossFromScale * Number(order.unitPrice)
  }, [grossFromScale, order.unitPrice])
  useEffect(() => {
    if (computedAmount !== null) {
      const rounded = Math.round(computedAmount * 100) / 100
      const formatted = formatMoneyInput(String(rounded))
      setOrder((prev) => ({ ...prev, amountTHB: formatted }))
    }
  }, [computedAmount])

  /** ---------- Payment resolver (Sales: ขายสด=1, ขายเชื่อ=2) ---------- */
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

  // sync flags for conditional docs
  useEffect(() => {
    const credit = isCreditPayment()
    setOrder((p) => ({ ...p, __isCredit: credit, __isCash: !credit }))
  }, [order.paymentMethod, paymentOptions])

  /** ---------- Validate + hint ---------- */
  const computeMissingHints = () => {
    const m = {}
    if (buyerType === "person") {
      if (!customer.fullName.trim()) m.fullName = true
    } else {
      if (!customer.companyName.trim()) m.companyName = true
      if (!customer.taxId.trim()) m.taxId = true
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
      // ต้องมี member_id หรือ asso_id ตาม BE (อิงหน้า Buy) :contentReference[oaicite:6]{index=6}
      if (!toIntOrNull(memberMeta.memberId ?? customer.memberId) && !memberMeta.assoId) {
        e.memberId = "กรุณาระบุรหัสสมาชิก (member_id) หรือเลือกบุคคลที่มี asso_id"
      }
    } else {
      if (!customer.companyName.trim()) e.companyName = "กรุณากรอกชื่อบริษัท"
      if (!customer.taxId.trim()) e.taxId = "กรุณากรอกเลขผู้เสียภาษี"
    }

    if (!order.productId) e.product = "เลือกประเภทสินค้า"
    if (!order.riceId) e.riceType = "เลือกชนิดข้าว (species)"
    if (!order.subriceId) e.subrice = "เลือกชั้นย่อย (variant)"
    if (!order.conditionId) e.condition = "เลือกสภาพ/เงื่อนไข"
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
    const amt = moneyToNumber(order.amountTHB)
    if (!amt || amt <= 0) e.amountTHB = "กรอกจำนวนเงินให้ถูกต้อง"
    if (!order.issueDate) e.issueDate = "กรุณาเลือกวันที่"
    setErrors(e)
    return e
  }
  const scrollToFirstError = (eObj) => {
    const personKeys = ["memberId", "fullName"]
    const companyKeys = ["companyName", "taxId"]
    const commonOrderKeys = ["product","riceType","subrice","condition","fieldType","riceYear","businessType","branchName","klangName","payment","entryWeightKg","exitWeightKg","amountTHB","issueDate"]
    const keys = (buyerType === "person" ? personKeys : companyKeys).concat(commonOrderKeys)
    const firstKey = keys.find((k) => k in eObj)
    if (!firstKey) return
    const el = refs[firstKey]?.current || (firstKey === "payment" ? refs.payment?.current : null)
    if (el && typeof el.focus === "function") { try { el.scrollIntoView({ behavior: "smooth", block: "center" }) } catch {} el.focus() }
  }

  /** ---------- Submit (เรียก /order/customers/save/sell) ---------- */
  const toIsoDateTime = (yyyyMmDd) => {
    try { return new Date(`${yyyyMmDd}T12:00:00Z`).toISOString() } catch { return new Date().toISOString() }
  }
  const handleSubmit = async (e) => {
    e.preventDefault()
    const hints = computeMissingHints()
    setMissingHints(hints)
    const eObj = validateAll()
    if (Object.keys(eObj).length > 0) { scrollToFirstError(eObj); return }

    // แยกชื่อบุคคล
    const [firstName, ...rest] = (customer.fullName || "").trim().split(" ")
    const lastName = rest.join(" ")

    // แปลง id ให้เป็นตัวเลข
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
    const paymentId = resolvePaymentIdForBE() // ⭐ sell: 1/2

    // เอกสารอ้างอิง (ตามชนิดการชำระเงิน; ถ้าเว้นว่างจะ fallback ที่ใบชั่ง)
    const isCredit = isCreditPayment()
    const orderSerial =
      (isCredit ? (order.creditInvoiceNo?.trim() || "") : (order.cashReceiptNo?.trim() || "")) ||
      (order.scaleNo?.trim() || null)

    // สร้าง payload ให้ตรงกับ OrderRequest (BE) :contentReference[oaicite:7]{index=7}
    let customerPayload
    if (buyerType === "person") {
      const memberIdNum = toIntOrNull(memberMeta.memberId ?? customer.memberId)
      const assoIdVal = memberMeta.assoId || null
      if (!memberIdNum && !assoIdVal) {
        alert("กรุณาระบุรหัสสมาชิก (member_id) หรือเลือกบุคคลที่มี asso_id จากผลค้นหา")
        return
      }
      customerPayload = memberIdNum
        ? { party_type: "individual", member_id: memberIdNum, first_name: firstName || "", last_name: lastName || "" }
        : { party_type: "individual", asso_id: assoIdVal, first_name: firstName || "", last_name: lastName || "" }
    } else {
      const taxId = onlyDigits(customer.taxId)
      customerPayload = taxId
        ? { party_type: "company", tax_id: taxId }
        : memberMeta.assoId
        ? { party_type: "company", asso_id: memberMeta.assoId }
        : { party_type: "company", tax_id: "" }
    }

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
        humidity: 0,
        entry_weight: Number(order.entryWeightKg || 0),
        exit_weight: Number(order.exitWeightKg || 0),
        weight: Number(grossFromScale),
        price_per_kilo: Number(order.unitPrice || 0),
        price: Number(moneyToNumber(order.amountTHB) || 0),
        impurity: 0,
        order_serial: orderSerial,
        date: dateISO,
        branch_location: branchId,
        klang_location: klangId,
        gram: Number(order.gram || 0),
        comment: order.comment?.trim() || null,
        business_type: businessTypeId,
      },
      // dept แนบเสมอ (BE ใช้เมื่อ payment_id == 2) :contentReference[oaicite:8]{index=8}
      dept: { date_created: dateISO, allowed_period: 30, postpone: false, postpone_period: 0 },
    }

    try {
      await post("/order/customers/save/sell", payload) // :contentReference[oaicite:9]{index=9}
      alert("บันทึกออเดอร์ขายเรียบร้อย ✅")

      // reset ฟอร์มแบบย่อ
      setErrors({}); setMissingHints({})
      setCustomer({
        citizenId: "", memberId: "", fullName: "", houseNo: "", moo: "", subdistrict: "", district: "", province: "", postalCode: "", phone: "",
        companyName: "", taxId: "", companyPhone: "",
        hqHouseNo: "", hqMoo: "", hqSubdistrict: "", hqDistrict: "", hqProvince: "", hqPostalCode: "",
        brHouseNo: "", brMoo: "", brSubdistrict: "", brDistrict: "", brProvince: "", brPostalCode: "",
      })
      setMemberMeta({ type: "unknown", assoId: null, memberId: null })
      setOrder({
        productId: "", productName: "", riceId: "", riceType: "", subriceId: "", subriceName: "",
        conditionId: "", condition: "", fieldTypeId: "", fieldType: "", riceYearId: "", riceYear: "",
        businessTypeId: "", businessType: "", programId: "", programName: "",
        branchName: "", branchId: null, klangName: "", klangId: null,
        entryWeightKg: "", exitWeightKg: "", unitPrice: "", amountTHB: "",
        issueDate: new Date().toISOString().slice(0, 10), gram: "", comment: "",
        paymentMethod: "", paymentMethodId: "",
        scaleNo: "", cashReceiptNo: "", creditInvoiceNo: "",
        __isCash: false, __isCredit: false,
      })
      setRiceOptions([]); setSubriceOptions([]); setKlangOptions([])
      setBuyerType("person")
    } catch (err) {
      console.error("SAVE ERROR:", err?.data || err)
      const detail = err?.data?.detail ? `\n\nรายละเอียด:\n${JSON.stringify(err.data.detail, null, 2)}` : ""
      alert(`บันทึกล้มเหลว: ${err.message || "เกิดข้อผิดพลาด"}${detail}`)
    }
  }

  /** ---------------- UI ---------------- */
  return (
    <div className="min-h-screen bg-white text-black dark:bg-slate-900 dark:text-white rounded-2xl text-[15px] md:text-base">
      <div className="mx-auto max-w-7xl p-5 md:p-6 lg:p-8">
        <h1 className="mb-4 text-3xl font-bold text-gray-900 dark:text-white">🧾 บันทึกออเดอร์ขาย</h1>

        {/* กล่องข้อมูลลูกค้า */}
        <div className="mb-6 rounded-2xl border border-slate-200 bg-white p-5 text-black shadow-sm dark:border-slate-700 dark:bg-slate-800 dark:text-white">
          <div className="mb-3 flex flex-wrap items-start gap-2">
            <h2 className="text-xl font-semibold">ข้อมูลลูกค้า</h2>

            {/* Badge สถานะ — แสดงเฉพาะโหมดบุคคล */}
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

            {/* ประเภทผู้ซื้อ */}
            <div className="ml-auto w-full sm:w-64 self-start">
              <label className={labelCls}>ประเภทผู้ซื้อ</label>
              <ComboBox
                options={buyerTypeOptions}
                value={buyerType}
                onChange={(id) => setBuyerType(String(id))}
                buttonRef={refs.buyerType}
              />
            </div>

            {/* ดรอปดาวฟอร์มสำเร็จรูป */}
            <div className="w-full sm:w-72 self-start">
              <label className={labelCls}>ฟอร์มสำเร็จรูป</label>
              <ComboBox
                options={templateOptions}
                value={formTemplate}
                onChange={(id) => setFormTemplate(String(id))}
                buttonRef={refs.formTemplate}
              />
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
                onChange={(_id, found) => setOrder((p) => ({ ...p, paymentMethod: found?.label ?? "" }))}
                placeholder="— เลือกวิธีชำระเงิน —"
                buttonRef={refs.payment}
                onEnterNext={() => focusNext("payment")}
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
          </div>

          {/* ส่วนฟอร์มลูกค้า (บุคคล / บริษัท) */}
          {buyerType === "person" ? (
            <div className="mt-4 grid gap-4 md:grid-cols-3">
              <div>
                <label className={labelCls}>เลขที่บัตรประชาชน (เพื่อค้นหาที่อยู่)</label>
                <input
                  ref={refs.citizenId}
                  inputMode="numeric" maxLength={13}
                  className={cx(baseField)}
                  value={customer.citizenId}
                  onChange={(e) => updateCustomer("citizenId", onlyDigits(e.target.value))}
                  onFocus={() => clearHint("citizenId")}
                  placeholder="เช่น 1234567890123"
                  onKeyDown={onEnter("citizenId")}
                />
                <div className={helpTextCls}>{loadingCustomer && "กำลังค้นหาลูกค้า..."}</div>
              </div>

              {/* member_id */}
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
                {!!memberMeta.memberId && <p className={helpTextCls}>พบสมาชิก: member_id {memberMeta.memberId}</p>}
                {errors.memberId && <p className={errorTextCls}>{errors.memberId}</p>}
              </div>

              <div className="md:col-span-1" />

              <div className="md:col-span-2" ref={nameBoxRef}>
                <label className={labelCls}>ชื่อ–สกุล (พิมพ์เพื่อค้นหาอัตโนมัติ)</label>
                <input
                  ref={(el) => { refs.fullName.current = el; nameInputRef.current = el }}
                  className={cx(baseField, redFieldCls("fullName"))}
                  value={customer.fullName}
                  onChange={(e) => {
                    updateCustomer("fullName", e.target.value)
                    if (e.target.value.trim().length >= 2) setShowNameList(true)
                    else { setShowNameList(false); setHighlightedIndex(-1) }
                  }}
                  onFocus={() => { clearHint("fullName"); clearError("fullName") }}
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
                    className={"mt-1 max-h-72 w-full overflow-auto rounded-2xl border border-slate-200 bg-white text-black shadow-sm dark:border-slate-700 dark:bg-slate-800 dark:text-white"}
                    role="listbox"
                  >
                    {nameResults.map((r, idx) => {
                      const isActive = idx === highlightedIndex
                      const full = `${r.first_name ?? ""} ${r.last_name ?? ""}`.trim()
                      return (
                        <button
                          type="button"
                          ref={(el) => (itemRefs.current[idx] = el)}
                          key={`${r.type}-${r.asso_id}-${idx}`}
                          onClick={async () => await pickNameResult(r)}
                          onMouseEnter={() => { setHighlightedIndex(idx); requestAnimationFrame(() => scrollHighlightedIntoView2(idx)) }}
                          role="option"
                          aria-selected={isActive}
                          className={cx(
                            "relative flex w-full items-start gap-3 px-3 py-2.5 text-left transition rounded-xl cursor-pointer",
                            isActive ? "bg-emerald-100 ring-1 ring-emerald-300 dark:bg-emerald-400/20 dark:ring-emerald-500"
                                     : "hover:bg-emerald-50 dark:hover:bg-emerald-900/30"
                          )}
                        >
                          {isActive && <span className="absolute left-0 top-0 h-full w-1 bg-emerald-600 dark:bg-emerald-400/70 rounded-l-xl" />}
                          <div className="flex-1">
                            <div className="font-medium">{full || "(ไม่มีชื่อ)"}</div>
                            <div className="text-sm text-slate-600 dark:text-slate-300">
                              {r.type === "member" ? `สมาชิก • member_id ${r.member_id ?? "-"}` : `ลูกค้าทั่วไป • ปชช. ${r.citizen_id ?? "-"}`}
                            </div>
                          </div>
                        </button>
                      )
                    })}
                  </div>
                )}
              </div>
            </div>
          ) : (
            /* -------------------- บริษัท -------------------- */
            <div className="md:col-span-2" ref={companyBoxRef}>
              <label className={labelCls}>ชื่อบริษัท / นิติบุคคล</label>
              <input
                ref={(el) => { refs.companyName.current = el; companyInputRef.current = el }}
                className={cx(baseField, redFieldCls("companyName"))}
                value={customer.companyName}
                onChange={(e) => {
                  updateCustomer("companyName", e.target.value)
                  if (buyerType === "company") {
                    if (e.target.value.trim().length >= 2) setShowCompanyList(true)
                    else { setShowCompanyList(false); setCompanyHighlighted(-1) }
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
                  className={"mt-1 max-h-72 w-full overflow-auto rounded-2xl border border-slate-200 bg-white text-black shadow-sm dark:border-slate-700 dark:bg-slate-800 dark:text-white"}
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
                        onMouseEnter={() => { setCompanyHighlighted(idx); requestAnimationFrame(() => { try { companyItemRefs.current[idx]?.scrollIntoView({ block: "nearest" }) } catch {} }) }}
                        role="option"
                        aria-selected={isActive}
                        className={cx(
                          "relative flex w-full items-start gap-3 px-3 py-2.5 text-left transition rounded-xl cursor-pointer",
                          isActive ? "bg-indigo-100 ring-1 ring-indigo-300 dark:bg-indigo-400/20 dark:ring-indigo-500"
                                   : "hover:bg-indigo-50 dark:hover:bg-indigo-900/30"
                        )}
                      >
                        {isActive && <span className="absolute left-0 top-0 h-full w-1 bg-indigo-600 dark:bg-indigo-400/70 rounded-l-xl" />}
                        <div className="flex-1">
                          <div className="font-medium">{name}</div>
                          <div className="text-sm text-slate-600 dark:text-slate-300">ภาษี {tid} • โทร {r.phone_number ?? "-"}</div>
                        </div>
                      </button>
                    )
                  })}
                </div>
              )}
            </div>
          )}
        </div>

        {/* ฟอร์มออเดอร์ */}
        <form onSubmit={handleSubmit} className="rounded-2xl border border-slate-200 bg-white p-5 text-black shadow-sm dark:border-slate-700 dark:bg-slate-800 dark:text-white">
          <h2 className="mb-3 text-xl font-semibold">รายละเอียดการขาย</h2>

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
                    productId: id, productName: found?.label ?? "",
                    riceId: "", riceType: "", subriceId: "", subriceName: "",
                  }))
                }}
                placeholder="— เลือกประเภทสินค้า —"
                error={!!errors.product}
                hintRed={!!missingHints.product}
                clearHint={() => clearHint("product")}
                buttonRef={refs.product}
                disabled={isTemplateActive}
                onEnterNext={() => focusNext("riceType")}
              />
              {errors.product && <p className={errorTextCls}>{errors.product}</p>}
            </div>

            <div>
              <label className={labelCls}>ชนิดข้าว</label>
              <ComboBox
                options={riceOptions}
                value={order.riceId}
                onChange={(id, found) => {
                  setOrder((p) => ({ ...p, riceId: id, riceType: found?.label ?? "", subriceId: "", subriceName: "" }))
                }}
                placeholder="— เลือกชนิดข้าว —"
                disabled={!order.productId || isTemplateActive}
                error={!!errors.riceType}
                hintRed={!!missingHints.riceType}
                clearHint={() => clearHint("riceType")}
                buttonRef={refs.riceType}
                onEnterNext={() => focusNext("subrice")}
              />
              {errors.riceType && <p className={errorTextCls}>{errors.riceType}</p>}
            </div>

            <div>
              <label className={labelCls}>ชั้นย่อย (Sub-class)</label>
              <ComboBox
                options={subriceOptions}
                value={order.subriceId}
                onChange={(id, found) => setOrder((p) => ({ ...p, subriceId: id, subriceName: found?.label ?? "" }))}
                placeholder="— เลือกชั้นย่อย —"
                disabled={!order.riceId}
                error={!!errors.subrice}
                hintRed={!!missingHints.subrice}
                clearHint={() => clearHint("subrice")}
                buttonRef={refs.subrice}
                onEnterNext={() => focusNext("condition")}
              />
              {errors.subrice && <p className={errorTextCls}>{errors.subrice}</p>}
            </div>

            <div>
              <label className={labelCls}>สภาพ/เงื่อนไข</label>
              <ComboBox
                options={conditionOptions}
                value={order.conditionId}
                getValue={(o) => o.id}
                onChange={(_id, found) => setOrder((p) => ({ ...p, conditionId: found?.id ?? "", condition: found?.label ?? "" }))}
                placeholder="— เลือกสภาพ/เงื่อนไข —"
                error={!!errors.condition}
                hintRed={!!missingHints.condition}
                clearHint={() => clearHint("condition")}
                buttonRef={refs.condition}
                onEnterNext={() => focusNext("fieldType")}
              />
              {errors.condition && <p className={errorTextCls}>{errors.condition}</p>}
            </div>

            <div>
              <label className={labelCls}>ประเภทนา</label>
              <ComboBox
                options={fieldTypeOptions}
                value={order.fieldTypeId}
                getValue={(o) => o.id}
                onChange={(_id, found) => setOrder((p) => ({ ...p, fieldTypeId: found?.id ?? "", fieldType: found?.label ?? "" }))}
                placeholder="— เลือกประเภทนา —"
                error={!!errors.fieldType}
                hintRed={!!missingHints.fieldType}
                clearHint={() => clearHint("fieldType")}
                buttonRef={refs.fieldType}
                onEnterNext={() => focusNext("riceYear")}
              />
              {errors.fieldType && <p className={errorTextCls}>{errors.fieldType}</p>}
            </div>

            <div>
              <label className={labelCls}>ปี/ฤดูกาล</label>
              <ComboBox
                options={yearOptions}
                value={order.riceYearId}
                getValue={(o) => o.id}
                onChange={(_id, found) => setOrder((p) => ({ ...p, riceYearId: found?.id ?? "", riceYear: found?.label ?? "" }))}
                placeholder="— เลือกปี/ฤดูกาล —"
                error={!!errors.riceYear}
                hintRed={!!missingHints.riceYear}
                clearHint={() => clearHint("riceYear")}
                buttonRef={refs.riceYear}
                onEnterNext={() => focusNext("businessType")}
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
                onChange={(_id, found) => setOrder((p) => ({ ...p, businessTypeId: found?.id ?? "", businessType: found?.label ?? "" }))}
                placeholder="— เลือกประเภทธุรกิจ —"
                error={!!errors.businessType}
                hintRed={!!missingHints.businessType}
                clearHint={() => clearHint("businessType")}
                buttonRef={refs.businessType}
                onEnterNext={() => focusNext("program")}
              />
              {errors.businessType && <p className={errorTextCls}>{errors.businessType}</p>}
            </div>

            <div>
              <label className={labelCls}>โปรแกรม</label>
              <ComboBox
                options={programOptions}
                value={order.programId}
                getValue={(o) => o.id}
                onChange={(_id, found) => setOrder((p) => ({ ...p, programId: found?.id ?? "", programName: found?.label ?? "" }))}
                placeholder="— เลือกโปรแกรม —"
                buttonRef={refs.program}
                onEnterNext={() => focusNext("branchName")}
              />
            </div>
          </div>

          {/* สาขา/คลัง */}
          <div className="mt-4 grid gap-4 md:grid-cols-3">
            <div>
              <label className={labelCls}>สาขา</label>
              <ComboBox
                options={branchOptions}
                value={order.branchId}
                getValue={(o) => o.id}
                onChange={(_val, found) => setOrder((p) => ({ ...p, branchId: found?.id ?? null, branchName: found?.label ?? "", klangName: "", klangId: null }))}
                placeholder="— เลือกสาขา —"
                error={!!errors.branchName}
                hintRed={!!missingHints.branchName}
                clearHint={() => clearHint("branchName")}
                buttonRef={refs.branchName}
                onEnterNext={() => focusNext("klangName")}
              />
              {errors.branchName && <p className={errorTextCls}>{errors.branchName}</p>}
            </div>
            <div>
              <label className={labelCls}>คลัง</label>
              <ComboBox
                options={klangOptions}
                value={order.klangId}
                getValue={(o) => o.id}
                onChange={(_val, found) => setOrder((p) => ({ ...p, klangId: found?.id ?? null, klangName: found?.label ?? "" }))}
                placeholder="— เลือกคลัง —"
                disabled={!order.branchId}
                error={!!errors.klangName}
                hintRed={!!missingHints.klangName}
                clearHint={() => clearHint("klangName")}
                buttonRef={refs.klangName}
                onEnterNext={() => focusNext("entryWeightKg")}
              />
              {errors.klangName && <p className={errorTextCls}>{errors.klangName}</p>}
            </div>
          </div>

          {/* ตัวเลข */}
          <div className="mt-6 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm ring-1 ring-transparent dark:border-slate-700 dark:bg-slate-800">
            <div className="mb-3 flex items-center gap-2">
              <span className="inline-flex h-2 w-2 rounded-full bg-emerald-500" />
              <h3 className="text-lg font-semibold">ตัวเลขและการคำนวณ</h3>
            </div>

            <div className="grid gap-4 md:grid-cols-3">
              <div>
                <label className={labelCls}>น้ำหนักก่อนชั่ง (กก.)</label>
                <input
                  ref={refs.entryWeightKg}
                  inputMode="decimal"
                  className={cx(baseField, redFieldCls("entryWeightKg"))}
                  value={order.entryWeightKg}
                  onChange={(e) => updateOrder("entryWeightKg", e.target.value.replace(/[^\d.]/g, ""))}
                  onFocus={() => { clearHint("entryWeightKg"); clearError("entryWeightKg") }}
                  onKeyDown={onEnter("entryWeightKg")}
                  placeholder="เช่น 7000"
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
                  onFocus={() => { clearHint("exitWeightKg"); clearError("exitWeightKg") }}
                  onKeyDown={onEnter("exitWeightKg")}
                  placeholder="เช่น 12000"
                />
                {errors.exitWeightKg && <p className={errorTextCls}>{errors.exitWeightKg}</p>}
              </div>

              <div>
                <label className={labelCls}>น้ำหนักจากตาชั่ง (กก.)</label>
                <input disabled className={cx(baseField, fieldDisabled)} value={Math.round(grossFromScale * 100) / 100} />
                <p className={helpTextCls}>คำนวณจาก |หลังชั่ง − ก่อนชั่ง|</p>
              </div>

              <div>
                <label className={labelCls}>ราคาต่อกก. (บาท)</label>
                <input
                  ref={refs.unitPrice}
                  inputMode="decimal"
                  className={baseField}
                  value={order.unitPrice}
                  onChange={(e) => updateOrder("unitPrice", e.target.value.replace(/[^\d.]/g, ""))}
                  onFocus={() => clearHint("unitPrice")}
                  onKeyDown={onEnter("unitPrice")}
                  placeholder="เช่น 15.00"
                />
                <p className={helpTextCls}>ถ้ากรอกราคา ระบบจะคำนวณ “เป็นเงิน” ให้อัตโนมัติ</p>
              </div>

              <div>
                <label className={labelCls}>เป็นเงิน (บาท)</label>
                <input
                  ref={refs.amountTHB}
                  inputMode="decimal"
                  className={cx(baseField, redFieldCls("amountTHB"))}
                  value={order.amountTHB}
                  onChange={(e) => updateOrder("amountTHB", formatMoneyInput(e.target.value))}
                  onFocus={() => { clearHint("amountTHB"); clearError("amountTHB") }}
                  onKeyDown={onEnter("amountTHB")}
                  placeholder="เช่น 45,000"
                />
                {!!order.amountTHB && <p className={helpTextCls}>≈ {thb(moneyToNumber(order.amountTHB))}</p>}
                {errors.amountTHB && <p className={errorTextCls}>{errors.amountTHB}</p>}
              </div>

              {/* gram (optional) */}
              <div>
                <label className={labelCls}>คุณภาพข้าว (gram)</label>
                <input
                  ref={refs.gram}
                  inputMode="numeric"
                  className={baseField}
                  value={order.gram}
                  onChange={(e) => updateOrder("gram", onlyDigits(e.target.value))}
                  onKeyDown={onEnter("gram")}
                  placeholder="เช่น 85"
                />
              </div>
            </div>
          </div>

          {/* เอกสารอ้างอิง (ด้านล่างกรอบตัวเลข) */}
          <div className="mt-4 grid gap-4 md:grid-cols-3">
            <div>
              <label className={labelCls}>เลขที่ใบชั่ง</label>
              <input
                ref={refs.scaleNo}
                className={baseField}
                value={order.scaleNo}
                onChange={(e) => updateOrder("scaleNo", e.target.value)}
                onKeyDown={onEnter("scaleNo")}
                placeholder="เช่น SCL-2025-000123 (ไม่บังคับ)"
              />
            </div>

            {order.__isCash && (
              <div>
                <label className={labelCls}>ใบรับเงินขายสินค้า (ขายสด)</label>
                <input
                  ref={refs.cashReceiptNo}
                  className={baseField}
                  value={order.cashReceiptNo}
                  onChange={(e) => updateOrder("cashReceiptNo", e.target.value)}
                  onKeyDown={onEnter("cashReceiptNo")}
                  placeholder="เช่น RC-2025-000789 (ไม่บังคับ)"
                />
              </div>
            )}

            {order.__isCredit && (
              <div>
                <label className={labelCls}>เลขที่ใบกำกับสินค้า (ขายเชื่อ)</label>
                <input
                  ref={refs.creditInvoiceNo}
                  className={baseField}
                  value={order.creditInvoiceNo}
                  onChange={(e) => updateOrder("creditInvoiceNo", e.target.value)}
                  onKeyDown={onEnter("creditInvoiceNo")}
                  placeholder="เช่น INV-2025-000456 (ไม่บังคับ)"
                />
              </div>
            )}
          </div>

          {/* หมายเหตุ */}
          <div className="mt-4">
            <label className={labelCls}>หมายเหตุ / คอมเมนต์</label>
            <textarea
              ref={refs.comment}
              rows={3}
              className={baseField}
              value={order.comment}
              onChange={(e) => updateOrder("comment", e.target.value)}
              onKeyDown={onEnter("comment")}
              placeholder="ระบุรายละเอียดเพิ่มเติม ถ้ามี"
            />
          </div>

          {/* สรุปสั้น ๆ */}
          <div className="mt-6 grid gap-4 md:grid-cols-5">
            {buyerType === "person" ? (
              <>
                <div className="rounded-2xl bg-white p-4 text-black shadow-sm ring-1 ring-slate-200 dark:bg-slate-800 dark:text-white dark:ring-slate-700">
                  <div className="text-slate-600 dark:text-slate-300">ผู้ซื้อ</div>
                  <div className="text-lg md:text-xl font-semibold whitespace-pre-line">{customer.fullName || "—"}</div>
                </div>
                <div className="rounded-2xl bg-white p-4 text-black shadow-sm ring-1 ring-slate-200 dark:bg-slate-800 dark:text-white dark:ring-slate-700">
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
                <div className="rounded-2xl bg-white p-4 text-black shadow-sm ring-1 ring-slate-200 dark:bg-slate-800 dark:text-white dark:ring-slate-700">
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
                value: (<ul className="list-disc pl-5"><li>{order.branchName || "—"}</li>{order.klangName && <li>{order.klangName}</li>}</ul>),
              },
              { label: "ก่อนชั่ง", value: Math.round(toNumber(order.entryWeightKg) * 100) / 100 + " กก." },
              { label: "หลังชั่ง", value: Math.round(toNumber(order.exitWeightKg) * 100) / 100 + " กก." },
              { label: "จากตาชั่ง", value: Math.round(grossFromScale * 100) / 100 + " กก." },
              { label: "ราคาต่อหน่วย", value: order.unitPrice ? `${Number(order.unitPrice).toFixed(2)} บาท/กก.` : "—" },
              { label: "ยอดเงิน", value: order.amountTHB ? thb(moneyToNumber(order.amountTHB)) : "—" },
              // เอกสารอ้างอิง
              { label: "เลขที่ใบชั่ง", value: order.scaleNo || "—" },
              ...(order.__isCash ? [{ label: "ใบรับเงิน (สด)", value: order.cashReceiptNo || "—" }] : []),
              ...(order.__isCredit ? [{ label: "ใบกำกับ (เชื่อ)", value: order.creditInvoiceNo || "—" }] : []),
              { label: "หมายเหตุ / คอมเมนต์", value: order.comment || "—" },
            ].map((c) => (
              <div key={c.label} className="rounded-2xl bg-white p-4 text-black shadow-sm ring-1 ring-slate-200 dark:bg-slate-800 dark:text-white dark:ring-slate-700">
                <div className="text-slate-600 dark:text-slate-300">{c.label}</div>
                <div className="text-lg md:text-xl font-semibold">{c.value}</div>
              </div>
            ))}
          </div>

          {/* ปุ่มบันทึก */}
          <div className="mt-8 flex flex-wrap items-center gap-3">
            <button
              type="submit"
              className="inline-flex items-center justify-center rounded-2xl bg-emerald-600 px-5 py-3 font-medium text-white shadow hover:bg-emerald-700 focus:outline-none focus:ring-2 focus:ring-emerald-500/40 active:scale-[0.98]"
            >
              บันทึกออเดอร์ขาย
            </button>
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="inline-flex items-center justify-center rounded-2xl border border-slate-300 bg-white px-5 py-3 font-medium text-slate-700 shadow-sm hover:bg-slate-50 dark:border-slate-600 dark:bg-slate-800 dark:text-white dark:hover:bg-slate-700"
            >
              ล้างฟอร์ม
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

export default Sales
