
// src/pages/Sales.jsx
import { useEffect, useMemo, useRef, useState, forwardRef, useImperativeHandle } from "react"
import { apiAuth, post } from "../lib/api"

/** ---------------- Utils (same family as Buy.jsx) ---------------- */
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

/** ▶︎ เงิน */
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

/** ▶︎ น้ำหนักหัก */
const MOISTURE_STD = 15
function suggestDeductionWeight(grossKg, moisturePct, impurityPct) {
  const w = toNumber(grossKg)
  const m = Math.max(0, toNumber(moisturePct) - MOISTURE_STD)
  const imp = Math.max(0, toNumber(impurityPct))
  const dedByMoisture = (m / 100) * w
  const dedByImpurity = (imp / 100) * w
  return Math.max(0, dedByMoisture + dedByImpurity)
}

/** ---------------- Styles ---------------- */
const cx = (...a) => a.filter(Boolean).join(" ")
const baseField =
  "w-full rounded-2xl border border-slate-300 bg-slate-100 p-3 text-[15px] md:text-base " +
  "text-black outline-none placeholder:text-slate-500 focus:border-emerald-600 focus:ring-2 focus:ring-emerald-500/30 shadow-none " +
  "dark:border-slate-500 dark:bg-slate-700 dark:text-slate-100 dark:placeholder:text-slate-300 dark:focus:border-emerald-400 dark:focus:ring-emerald-400/30"
const fieldDisabled = "bg-slate-100 text-slate-600 cursor-not-allowed opacity-95 dark:bg-slate-700/70 dark:text-slate-300"
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
  const personOrder = ["memberId","citizenId","fullName","houseNo","moo","subdistrict","district","province","postalCode","phone"]
  const companyOrder = ["companyName","taxId","companyPhone","hqHouseNo","hqMoo","hqSubdistrict","hqDistrict","hqProvince","hqPostalCode","brHouseNo","brMoo","brSubdistrict","brDistrict","brProvince","brPostalCode"]
  const orderOrder = [
    "product","riceType","subrice","condition","fieldType","riceYear","businessType","program",
    "branchName","klangName","entryWeightKg","exitWeightKg","moisturePct","impurityPct","deductWeightKg",
    "unitPrice","amountTHB","weighSlipNo","taxInvoiceNo","salesReceiptNo","payment","issueDate","comment",
  ]
  let list = (buyerType === "person" ? personOrder : companyOrder).concat(orderOrder)
  list = list.filter((key) => {
    const el = refs?.[key]?.current
    if (!el) return false
    if (key === "subrice" && !order.riceId) return false
    if (key === "riceType" && !order.productId) return false
    if (key === "deductWeightKg" && !order.manualDeduct) return false
    if (key === "klangName" && !order.branchId) return false
    if (key === "taxInvoiceNo" && !isCreditPayment()) return false
    if (key === "salesReceiptNo" && isCreditPayment()) return false
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
  const isCreditPayment = () => false // placeholder (real definition below in component scope)
  return { onEnter, focusNext }
}

/** ---------------- Reusable ComboBox ---------------- */
function ComboBox({ options=[], value, onChange, placeholder="— เลือก —", getLabel=(o)=>o?.label??"", getValue=(o)=>o?.value??o?.id??"", disabled=false, error=false, buttonRef=null, hintRed=false, clearHint=()=>{}, onEnterNext }) {
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
      if (!boxRef.current.contains(e.target)) { setOpen(false); setHighlight(-1) }
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
      e.preventDefault(); setOpen(true); setHighlight((h)=> (h>=0?h:0)); clearHint?.(); return
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
        <div ref={listRef} role="listbox" className="absolute z-20 mt-1 max-h-72 w-full overflow-auto overscroll-contain rounded-2xl border border-slate-200 bg-white text-black shadow-lg dark:border-slate-700 dark:bg-slate-800 dark:text-white">
          {options.length === 0 && (<div className="px-3 py-2 text-sm text-slate-600 dark:text-slate-300">ไม่มีตัวเลือก</div>)}
          {options.map((opt, idx) => {
            const label = getLabel(opt)
            const isActive = idx === highlight
            const isChosen = String(getValue(opt)) === String(value)
            return (
              <button key={String(getValue(opt)) || label || idx} type="button" role="option" aria-selected={isChosen}
                onMouseEnter={() => setHighlight(idx)} onClick={() => commit(opt)}
                className={cx(
                  "relative flex w-full items-center gap-2 px-3 py-2.5 text-left text-[15px] md:text-base transition rounded-xl cursor-pointer",
                  isActive ? "bg-emerald-100 ring-1 ring-emerald-300 dark:bg-emerald-400/20 dark:ring-emerald-500" : "hover:bg-emerald-50 dark:hover:bg-emerald-900/30"
                )}>
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

/** ---------------- DateInput ---------------- */
const DateInput = forwardRef(function DateInput({ error = false, className = "", ...props }, ref) {
  const inputRef = useRef(null)
  useImperativeHandle(ref, () => inputRef.current)
  return (
    <div className="relative">
      <style>{`input[type="date"]::-webkit-calendar-picker-indicator { opacity: 0; }`}</style>
      <input type="date" ref={inputRef} className={cx(baseField, "pr-12 cursor-pointer", error && "border-red-400 ring-2 ring-red-300/70", className)} {...props} />
      <button type="button" onClick={() => {
        const el = inputRef.current
        if (!el) return
        if (typeof el.showPicker === "function") el.showPicker()
        else { el.focus(); el.click?.() }
      }} aria-label="เปิดตัวเลือกวันที่"
        className="absolute right-2 top-1/2 -translate-y-1/2 inline-flex h-9 w-9 items-center justify-center rounded-xl transition-transform hover:scale-110 active:scale-95 focus:outline-none cursor-pointer bg-transparent">
        <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor" className="text-slate-600 dark:text-slate-200">
          <path d="M7 2a1 1 0 0 1 1 1v1h8V3a1 1 0 1 1 2 0v1h1a2 2 0 0 1 2 2v3H3V6a2 2 0 0 1 2-2h1V3a1 1 0 1 1 1-1zm14 9v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-7h18zM7 14h2v2H7v-2zm4 0h2v2h-2v-2z" />
        </svg>
      </button>
    </div>
  )
})

/** =====================================================================
 *                          Sales Page (UI = Buy)
 * ===================================================================== */
function Sales() {
  /** ---------- dropdown opts ---------- */
  const [productOptions, setProductOptions] = useState([])
  const [riceOptions, setRiceOptions] = useState([])     // species
  const [subriceOptions, setSubriceOptions] = useState([]) // variant
  const [conditionOptions, setConditionOptions] = useState([])
  const [fieldTypeOptions, setFieldTypeOptions] = useState([])
  const [yearOptions, setYearOptions] = useState([])
  const [programOptions, setProgramOptions] = useState([])
  const [paymentOptions, setPaymentOptions] = useState([]) // SELL endpoints (1,2)
  const [businessOptions, setBusinessOptions] = useState([])
  const [branchOptions, setBranchOptions] = useState([])
  const [klangOptions, setKlangOptions] = useState([])

  /** ---------- templates ---------- */
  const templateOptions = [
    { id: "0", label: "— ฟอร์มปกติ —" },
    { id: "1", label: "รหัส 1 • ข้าวหอมมะลิ" },
    { id: "2", label: "รหัส 2 • ข้าวเหนียว" },
    { id: "3", label: "รหัส 3 • เมล็ดพันธุ์" },
  ]
  const [formTemplate, setFormTemplate] = useState("0") // persist
  useEffect(() => { try { const s = localStorage.getItem("sales.formTemplate"); if (s && ["0","1","2","3"].includes(s)) setFormTemplate(s) } catch {} }, [])

  /** ---------- buyer type ---------- */
  const buyerTypeOptions = [
    { id: "person", label: "บุคคลธรรมดา" },
    { id: "company", label: "บริษัท / นิติบุคคล" },
  ]
  const [buyerType, setBuyerType] = useState("person")

  /** ---------- meta ---------- */
  const [memberMeta, setMemberMeta] = useState({ type: "unknown", assoId: null, memberId: null })

  /** ---------- form (customer) ---------- */
  const [customer, setCustomer] = useState({
    citizenId: "", fullName: "", houseNo: "", moo: "", subdistrict: "", district: "", province: "", postalCode: "", phone: "",
    companyName: "", taxId: "", companyPhone: "",
    hqHouseNo: "", hqMoo: "", hqSubdistrict: "", hqDistrict: "", hqProvince: "", hqPostalCode: "",
    brHouseNo: "", brMoo: "", brSubdistrict: "", brDistrict: "", brProvince: "", brPostalCode: "",
  })

  /** ---------- form (order) ---------- */
  const [order, setOrder] = useState({
    productId: "", productName: "",
    riceId: "", riceType: "",
    subriceId: "", subriceName: "",
    riceYearId: "", riceYear: "",
    conditionId: "", condition: "",
    fieldTypeId: "", fieldType: "",
    programId: "", programName: "",
    businessTypeId: "", businessType: "",
    paymentMethodId: "", paymentMethod: "",
    entryWeightKg: "", exitWeightKg: "",
    moisturePct: "", impurityPct: "",
    manualDeduct: false, deductWeightKg: "",
    unitPrice: "", amountTHB: "",
    branchId: null, branchName: "", klangId: null, klangName: "",
    issueDate: new Date().toISOString().slice(0,10),
    comment: "",
    // เอกสารเพิ่มเติม (optional)
    weighSlipNo: "",          // เลขที่ใบชั่ง
    taxInvoiceNo: "",         // เลขที่ใบกำกับสินค้า (ขายเชื่อ) -> show when credit
    salesReceiptNo: "",       // ใบรับเงินขายสินค้า (ขายสด)   -> show when cash
  })

  /** ---------- dept (credit only) ---------- */
  const [dept, setDept] = useState({ allowedPeriod: 30, postpone: false, postponePeriod: 0 })

  /** ---------- state ---------- */
  const [errors, setErrors] = useState({})
  const [missingHints, setMissingHints] = useState({})
  const [loadingCustomer, setLoadingCustomer] = useState(false)
  const [customerFound, setCustomerFound] = useState(null)

  /** ---------- refs ---------- */
  const refs = {
    citizenId: useRef(null), fullName: useRef(null), houseNo: useRef(null), moo: useRef(null), subdistrict: useRef(null), district: useRef(null), province: useRef(null), postalCode: useRef(null), phone: useRef(null),
    companyName: useRef(null), taxId: useRef(null), companyPhone: useRef(null),
    hqHouseNo: useRef(null), hqMoo: useRef(null), hqSubdistrict: useRef(null), hqDistrict: useRef(null), hqProvince: useRef(null), hqPostalCode: useRef(null),
    brHouseNo: useRef(null), brMoo: useRef(null), brSubdistrict: useRef(null), brDistrict: useRef(null), brProvince: useRef(null), brPostalCode: useRef(null),
    product: useRef(null), riceType: useRef(null), subrice: useRef(null), condition: useRef(null), fieldType: useRef(null), riceYear: useRef(null), program: useRef(null), businessType: useRef(null),
    branchName: useRef(null), klangName: useRef(null),
    entryWeightKg: useRef(null), exitWeightKg: useRef(null), moisturePct: useRef(null), impurityPct: useRef(null), deductWeightKg: useRef(null),
    unitPrice: useRef(null), amountTHB: useRef(null),
    weighSlipNo: useRef(null), taxInvoiceNo: useRef(null), salesReceiptNo: useRef(null),
    payment: useRef(null), issueDate: useRef(null), comment: useRef(null),
    formTemplate: useRef(null), buyerType: useRef(null),
  }
  const { onEnter, focusNext } = useEnterNavigation(refs, buyerType, order)

  /** ---------- helpers ---------- */
  const updateCustomer = (k, v) => setCustomer((p) => ({ ...p, [k]: v }))
  const updateOrder = (k, v) => setOrder((p) => ({ ...p, [k]: v }))
  const clearHint = (key) => setMissingHints((prev) => (prev[key] ? { ...prev, [key]: false } : prev))
  const hasRed = (key) => !!errors[key] || !!missingHints[key]
  const redFieldCls = (key) => (hasRed(key) ? "border-red-500 ring-2 ring-red-300 focus:ring-0 focus:border-red-500" : "")
  const redHintCls = (key) => (missingHints[key] ? "border-red-400 ring-2 ring-red-300 focus:border-red-400 animate-pulse" : "")

  /** ---------- loads ---------- */
  const fetchFirstOkJson = async (paths = []) => {
    for (const p of paths) {
      try {
        const data = await apiAuth(p)
        if (Array.isArray(data)) return data
        if (data && typeof data === "object") return data
      } catch {}
    }
    return []
  }

  useEffect(() => {
    const loadStatic = async () => {
      try {
        const [products, conditions, fields, years, programs, payments, branches, businesses] = await Promise.all([
          fetchFirstOkJson(["/order/product/search"]),
          fetchFirstOkJson(["/order/condition/search"]),
          fetchFirstOkJson(["/order/field/search", "/order/field_type/list", "/order/field-type/list"]),
          fetchFirstOkJson(["/order/year/search"]),
          fetchFirstOkJson(["/order/program/search"]),
          fetchFirstOkJson(["/order/payment/search/sell"]), // SELL: 1,2
          fetchFirstOkJson(["/order/branch/search"]),
          fetchFirstOkJson(["/order/business/search"]),
        ])
        setProductOptions((products||[]).map(x => ({ id:String(x.id ?? x.product_id ?? ""), label:String(x.product_type ?? x.name ?? "").trim() })).filter(o=>o.id && o.label))
        setConditionOptions((conditions||[]).map((x,i)=>({ id:String(x.id ?? i), label:String(x.condition ?? x.name ?? "").trim() })))
        setFieldTypeOptions((fields||[]).map((x,i)=>({ id:String(x.id ?? i), label:String(x.field ?? x.field_type ?? x.name ?? "").trim() })))
        setYearOptions((years||[]).map((x,i)=>({ id:String(x.id ?? i), label:String(x.year ?? x.name ?? "").trim() })))
        setProgramOptions((programs||[]).map((x,i)=>({ id:String(x.id ?? i), label:String(x.program ?? x.name ?? "").trim() })))
        setPaymentOptions((payments||[]).map((x,i)=>({ id:String(x.id ?? i), label:String(x.payment ?? x.method ?? "").trim() })))
        setBranchOptions((branches||[]).map(b => ({ id:b.id, label:b.branch_name })))
        setBusinessOptions((businesses||[]).map((x,i)=>({ id:String(x.id ?? i), label:String(x.business ?? x.name ?? "").trim() })))
      } catch(e) {
        setProductOptions([]); setConditionOptions([]); setFieldTypeOptions([]); setYearOptions([]); setProgramOptions([]); setPaymentOptions([]); setBranchOptions([]); setBusinessOptions([])
      }
    }
    loadStatic()
  }, [])

  /** ---------- product → species ---------- */
  useEffect(() => {
    const pid = order.productId
    if (!pid) { setRiceOptions([]); setOrder(p=>({ ...p, riceId:"", riceType:"", subriceId:"", subriceName:"" })); return }
    const loadSpecies = async () => {
      try {
        const arr = await apiAuth(`/order/species/search?product_id=${encodeURIComponent(pid)}`)
        setRiceOptions((arr||[]).map(x=>({ id:String(x.id ?? x.species_id ?? ""), label:String(x.species ?? x.name ?? "").trim() })).filter(o=>o.id && o.label))
      } catch { setRiceOptions([]) }
    }
    loadSpecies()
  }, [order.productId])

  /** ---------- species → variant ---------- */
  useEffect(() => {
    const rid = order.riceId
    if (!rid) { setSubriceOptions([]); setOrder(p=>({ ...p, subriceId:"", subriceName:"" })); return }
    const loadVariant = async () => {
      try {
        const arr = await apiAuth(`/order/variant/search?species_id=${encodeURIComponent(rid)}`)
        setSubriceOptions((arr||[]).map(x=>({ id:String(x.id ?? x.variant_id ?? ""), label:String(x.variant ?? x.name ?? "").trim() })).filter(o=>o.id && o.label))
      } catch { setSubriceOptions([]) }
    }
    loadVariant()
  }, [order.riceId])

  /** ---------- branch → klang ---------- */
  useEffect(() => {
    const bid = order.branchId
    const bname = order.branchName?.trim()
    if (bid == null && !bname) { setKlangOptions([]); setOrder(p=>({ ...p, klangName:"", klangId:null })); return }
    const loadKlang = async () => {
      try {
        const qs = bid != null ? `branch_id=${bid}` : `branch_name=${encodeURIComponent(bname)}`
        const data = await apiAuth(`/order/klang/search?${qs}`)
        setKlangOptions((data||[]).map(k => ({ id:k.id, label:k.klang_name })))
      } catch { setKlangOptions([]) }
    }
    loadKlang()
  }, [order.branchId, order.branchName])

  /** ---------- person picker (ชื่อ / citizen / member_id via name results) ---------- */
  const [nameResults, setNameResults] = useState([])
  const [showNameList, setShowNameList] = useState(false)
  const nameBoxRef = useRef(null)
  const nameInputRef = useRef(null)
  const suppressNameSearchRef = useRef(false)
  const [highlightedIndex, setHighlightedIndex] = useState(-1)
  const listContainerRef = useRef(null)
  const itemRefs = useRef([])

  const debouncedCitizenId = useDebounce(customer.citizenId)
  const debouncedFullName  = useDebounce(customer.fullName)

  const mapSimplePersonToUI = (r={}) => ({
    citizenId: onlyDigits(r.citizen_id ?? r.citizenId ?? ""),
    fullName: `${r.first_name ?? ""} ${r.last_name ?? ""}`.trim(),
    assoId: r.asso_id ?? r.assoId ?? null,
    memberId: r.member_id ?? r.memberId ?? null,
    type: r.type ?? "unknown",
    phone: r.phone ?? r.tel ?? r.mobile ?? "",
  })

  const fillFromRecord = async (raw={}) => {
    const d = mapSimplePersonToUI(raw)
    setCustomer((p)=>({ ...p, citizenId:d.citizenId || p.citizenId, fullName:d.fullName || p.fullName, phone:d.phone || p.phone }))
    setMemberMeta((m)=>({ ...m, type:d.type, assoId:d.assoId ?? m.assoId, memberId:d.memberId != null ? Number(d.memberId) : m.memberId }))
    setCustomerFound(true)
  }

  useEffect(() => {
    if (buyerType !== "person") { setCustomerFound(null); setMemberMeta({ type:"unknown", assoId:null, memberId:null }); return }
    const cid = onlyDigits(debouncedCitizenId)
    if (!cid || cid.length !== 13) { setCustomerFound(null); return }
    const run = async () => {
      try {
        setLoadingCustomer(true)
        const arr = await apiAuth(`/order/customers/search?q=${encodeURIComponent(cid)}`)
        const exact = (arr||[]).find(r => onlyDigits(r.citizen_id || r.citizenId || "") === cid) || (arr||[])[0]
        if (exact) await fillFromRecord(exact); else { setCustomerFound(false); setMemberMeta({ type:"customer", assoId:null, memberId:null }) }
      } catch { setCustomerFound(false); setMemberMeta({ type:"customer", assoId:null, memberId:null }) }
      finally { setLoadingCustomer(false) }
    }
    run()
  }, [debouncedCitizenId, buyerType])

  useEffect(() => {
    if (buyerType !== "person") { setShowNameList(false); setNameResults([]); setHighlightedIndex(-1); setMemberMeta({ type:"unknown", assoId:null, memberId:null }); return }
    const q = (debouncedFullName || "").trim()
    if (suppressNameSearchRef.current) { suppressNameSearchRef.current=false; setShowNameList(false); setNameResults([]); setHighlightedIndex(-1); return }
    if (q.length < 2) { setShowNameList(false); setNameResults([]); setHighlightedIndex(-1); return }
    const run = async () => {
      try {
        setLoadingCustomer(true)
        const items = await apiAuth(`/order/customers/search?q=${encodeURIComponent(q)}`)
        setNameResults(items || [])
        if (document.activeElement === nameInputRef.current) { setShowNameList(true); setHighlightedIndex((items||[]).length>0?0:-1) }
      } catch { setShowNameList(false); setNameResults([]); setHighlightedIndex(-1) }
      finally { setLoadingCustomer(false) }
    }
    run()
  }, [debouncedFullName, buyerType])

  useEffect(() => {
    const onClick = (e) => { if (!nameBoxRef.current) return; if (!nameBoxRef.current.contains(e.target)) { setShowNameList(false); setHighlightedIndex(-1) } }
    document.addEventListener("click", onClick)
    return () => document.removeEventListener("click", onClick)
  }, [])

  const pickNameResult = async (rec) => {
    suppressNameSearchRef.current = true
    setMemberMeta((m)=>({ ...m, assoId: rec.asso_id ?? m.assoId, memberId: rec.member_id != null ? Number(rec.member_id) : m.memberId, type: rec.type ?? m.type }))
    await fillFromRecord(rec)
    setShowNameList(false); setNameResults([]); setHighlightedIndex(-1)
  }

  const scrollHighlightedIntoView2 = (index) => {
    const itemEl = itemRefs.current[index]
    const listEl = listContainerRef.current
    if (!itemEl || !listEl) return
    try { itemEl.scrollIntoView({ block: "nearest", inline: "nearest" }) } catch {}
  }

  const handleNameKeyDown = async (e) => {
    if (!showNameList || nameResults.length === 0) return
    if (e.key === "ArrowDown") { e.preventDefault(); const next = highlightedIndex < nameResults.length-1 ? highlightedIndex+1 : 0; setHighlightedIndex(next); requestAnimationFrame(()=>scrollHighlightedIntoView2(next)) }
    else if (e.key === "ArrowUp") { e.preventDefault(); const prev = highlightedIndex > 0 ? highlightedIndex-1 : nameResults.length-1; setHighlightedIndex(prev); requestAnimationFrame(()=>scrollHighlightedIntoView2(prev)) }
    else if (e.key === "Enter") { e.preventDefault(); if (highlightedIndex >= 0 && highlightedIndex < nameResults.length) await pickNameResult(nameResults[highlightedIndex]) }
    else if (e.key === "Escape") { e.preventDefault(); setShowNameList(false); setHighlightedIndex(-1) }
  }

  /** ---------- company picker ---------- */
  const [companyResults, setCompanyResults] = useState([])
  const [showCompanyList, setShowCompanyList] = useState(false)
  const [companyHighlighted, setCompanyHighlighted] = useState(-1)
  const companyBoxRef = useRef(null)
  const companyInputRef = useRef(null)
  const companyItemRefs = useRef([])
  const suppressCompanySearchRef = useRef(false)

  const debouncedCompanyName = useDebounce(customer.companyName)
  const debouncedTaxId = useDebounce(customer.taxId)

  useEffect(() => {
    const onClick = (e) => { if (!companyBoxRef.current) return; if (!companyBoxRef.current.contains(e.target)) { setShowCompanyList(false); setCompanyHighlighted(-1) } }
    document.addEventListener("click", onClick)
    return () => document.removeEventListener("click", onClick)
  }, [])

  const mapCompanyToUI = (r = {}) => {
    const S = (v) => (v == null ? "" : String(v))
    return {
      assoId: r.asso_id ?? r.assoId ?? null,
      companyName: S(r.company_name ?? r.companyName ?? ""),
      taxId: onlyDigits(S(r.tax_id ?? r.taxId ?? "")),
      companyPhone: S(r.phone_number ?? r.phone ?? ""),
      hqHouseNo: S(r.hq_address ?? r.hqAddress ?? ""),
      hqMoo: S(r.hq_moo ?? r.hqMoo ?? ""),
      hqSubdistrict: S(r.hq_tambon ?? r.hqSubdistrict ?? ""),
      hqDistrict: S(r.hq_amphur ?? r.hqDistrict ?? ""),
      hqProvince: S(r.hq_province ?? r.hqProvince ?? ""),
      hqPostalCode: onlyDigits(S(r.hq_postal_code ?? r.hqPostalCode ?? "")),
      brHouseNo: S(r.branch_address ?? r.branchAddress ?? ""),
      brMoo: S(r.branch_moo ?? r.branchMoo ?? ""),
      brSubdistrict: S(r.branch_tambon ?? r.brSubdistrict ?? ""),
      brDistrict: S(r.branch_amphur ?? r.brDistrict ?? ""),
      brProvince: S(r.branch_province ?? r.brProvince ?? ""),
      brPostalCode: onlyDigits(S(r.branch_postal_code ?? r.brPostalCode ?? "")),
    }
  }

  const pickCompanyResult = async (rec) => {
    suppressCompanySearchRef.current = true
    const d = mapCompanyToUI(rec)
    setCustomer((p)=>({ ...p,
      companyName:d.companyName || p.companyName, taxId:d.taxId || p.taxId, companyPhone:d.companyPhone || p.companyPhone,
      hqHouseNo:d.hqHouseNo || p.hqHouseNo, hqMoo:d.hqMoo || p.hqMoo, hqSubdistrict:d.hqSubdistrict || p.hqSubdistrict, hqDistrict:d.hqDistrict || p.hqDistrict, hqProvince:d.hqProvince || p.hqProvince, hqPostalCode:d.hqPostalCode || p.hqPostalCode,
      brHouseNo:d.brHouseNo || p.brHouseNo, brMoo:d.brMoo || p.brMoo, brSubdistrict:d.brSubdistrict || p.brSubdistrict, brDistrict:d.brDistrict || p.brDistrict, brProvince:d.brProvince || p.brProvince, brPostalCode:d.brPostalCode || p.brPostalCode,
    }))
    setMemberMeta(m=>({ ...m, assoId:d.assoId ?? m.assoId, type:"company" }))
    setShowCompanyList(false); setCompanyHighlighted(-1); setCompanyResults([])
  }

  useEffect(() => {
    if (buyerType !== "company") { setShowCompanyList(false); setCompanyResults([]); setCompanyHighlighted(-1); return }
    const q = (debouncedCompanyName || "").trim()
    if (suppressCompanySearchRef.current) { suppressCompanySearchRef.current=false; setShowCompanyList(false); setCompanyResults([]); setCompanyHighlighted(-1); return }
    if (q.length < 2) { setCompanyResults([]); setShowCompanyList(false); setCompanyHighlighted(-1); return }
    const run = async () => {
      try {
        setLoadingCustomer(true)
        const items = (await apiAuth(`/order/companies/search?q=${encodeURIComponent(q)}`)) || []
        setCompanyResults(items)
        if (document.activeElement === companyInputRef.current) { setShowCompanyList(true); setCompanyHighlighted(items.length>0?0:-1) }
      } catch { setCompanyResults([]); setShowCompanyList(false); setCompanyHighlighted(-1) }
      finally { setLoadingCustomer(false) }
    }
    run()
  }, [debouncedCompanyName, buyerType])

  useEffect(() => {
    if (buyerType !== "company") return
    const tid = onlyDigits(debouncedTaxId)
    if (tid.length !== 13) return
    const run = async () => {
      try {
        setLoadingCustomer(true)
        const items = (await apiAuth(`/order/companies/search?q=${encodeURIComponent(tid)}`)) || []
        if (items.length > 0) await pickCompanyResult(items[0])
      } catch {} finally { setLoadingCustomer(false) }
    }
    run()
  }, [debouncedTaxId, buyerType])

  /** ---------- calculations ---------- */
  const grossFromScale = useMemo(() => {
    const entry = toNumber(order.entryWeightKg)
    const exit  = toNumber(order.exitWeightKg)
    const g = Math.abs(exit - entry)
    return g > 0 ? g : 0
  }, [order.entryWeightKg, order.exitWeightKg])

  const autoDeduct = useMemo(() => {
    if (order.manualDeduct) return toNumber(order.deductWeightKg)
    return suggestDeductionWeight(grossFromScale, order.moisturePct, order.impurityPct)
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

  /** ---------- payment resolver (SELL: cash=1, credit=2) ---------- */
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
    const label = (order.paymentMethod || "").trim() || (paymentOptions.find((o)=>Number(o.id)===Number(pid))?.label || "").trim()
    const s = label.toLowerCase()
    return s.includes("เชื่อ") || s.includes("เครดิต") || s.includes("credit") || s.includes("ค้าง") || Number(pid) === 2
  }
  const resolvePaymentIdForBE = () => (isCreditPayment() ? 2 : 1)

  /** ---------- validations ---------- */
  const computeMissingHints = () => {
    const m = {}
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
      if (!memberMeta.memberId && !memberMeta.assoId) e.memberId = "กรุณาเลือกบุคคลจากรายการ (ต้องมี member_id หรือ asso_id)"
      if (!customer.fullName) e.fullName = "กรุณากรอกชื่อ–สกุล"
    } else {
      if (!customer.companyName.trim()) e.companyName = "กรุณากรอกชื่อบริษัท"
      if (!customer.taxId.trim() || onlyDigits(customer.taxId).length !== 13) e.taxId = "กรุณากรอกเลขผู้เสียภาษี (13 หลัก)"
    }
    Object.assign(e, computeMissingHints())
    setErrors(e)
    return e
  }

  const scrollToFirstError = (eObj) => {
    const firstKey = ["memberId","companyName","taxId","product","riceType","subrice","condition","fieldType","riceYear","businessType","branchName","klangName","payment","entryWeightKg","exitWeightKg","amountTHB","issueDate"].find(k => k in eObj)
    if (!firstKey) return
    const el = refs[firstKey]?.current || (firstKey === "payment" ? refs.payment?.current : null)
    if (el?.focus) { try { el.scrollIntoView({ behavior:"smooth", block:"center" }) } catch {} el.focus() }
  }

  /** ---------- template effects (like Buy) ---------- */
  const isTemplateActive = formTemplate !== "0"
  useEffect(() => {
    if (!isTemplateActive) return
    if (productOptions.length === 0) return
    const paddy = productOptions.find(o => o.label.includes("ข้าวเปลือก"))
    if (paddy && order.productId !== paddy.id) {
      setOrder(p => ({ ...p, productId:paddy.id, productName:paddy.label, riceId:"", riceType:"", subriceId:"", subriceName:"" }))
    }
  }, [formTemplate, productOptions])
  useEffect(() => {
    if (!isTemplateActive) return
    if (riceOptions.length === 0) return
    const want = formTemplate === "1" ? "หอมมะลิ" : formTemplate === "2" ? "เหนียว" : "พันธุ์"
    const target = riceOptions.find(r => r.label.includes(want))
    if (target && order.riceId !== target.id) {
      setOrder(p => ({ ...p, riceId:target.id, riceType:target.label, subriceId:"", subriceName:"" }))
    }
  }, [formTemplate, riceOptions])

  /** ---------- submit ---------- */
  const toIsoDateTime = (yyyyMmDd) => { try { return new Date(`${yyyyMmDd}T12:00:00Z`).toISOString() } catch { return new Date().toISOString() } }
  const handleSubmit = async (e) => {
    e.preventDefault()
    setMissingHints(computeMissingHints())
    const eObj = validateAll()
    if (Object.keys(eObj).length > 0) { scrollToFirstError(eObj); return }

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
    if (!productId || !riceId || !subriceId || !branchId || !klangId || !paymentId || !riceYearId || !conditionId || !fieldTypeId || !businessTypeId) { return }

    const baseGross = grossFromScale
    const deduction = order.manualDeduct ? toNumber(order.deductWeightKg) : suggestDeductionWeight(baseGross, order.moisturePct, order.impurityPct)
    const netW = Math.max(0, baseGross - deduction)

    // customer
    let customerPayload
    if (buyerType === "person") {
      const assoId = memberMeta.assoId ? String(memberMeta.assoId) : undefined
      const memberIdVal = memberMeta.memberId != null ? Number(memberMeta.memberId) : undefined
      if (!assoId && memberIdVal == null) { alert("กรุณาเลือกบุคคลให้ระบบทราบ asso_id หรือ member_id"); return }
      customerPayload = assoId ? { party_type:"individual", asso_id: assoId } : { party_type:"individual", member_id: memberIdVal }
    } else {
      const assoId = memberMeta.assoId ? String(memberMeta.assoId) : undefined
      const taxId = onlyDigits(customer.taxId) || undefined
      if (!assoId && !taxId) { alert("กรุณาระบุเลขผู้เสียภาษี หรือเลือกบริษัทจากรายการเพื่อได้ asso_id"); return }
      customerPayload = assoId ? { party_type:"company", asso_id: assoId } : { party_type:"company", tax_id: taxId, company_name: customer.companyName?.trim() || undefined }
    }

    // decide primary order_serial: credit -> taxInvoiceNo, cash -> salesReceiptNo; fallback weighSlipNo
    const primaryDoc = isCreditPayment()
      ? (order.taxInvoiceNo || order.weighSlipNo || order.salesReceiptNo || "")
      : (order.salesReceiptNo || order.weighSlipNo || order.taxInvoiceNo || "")

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
        order_serial: primaryDoc || null,
        date: toIsoDateTime(order.issueDate),
        branch_location: branchId,
        klang_location: klangId,
        gram: null,
        comment: order.comment?.trim() || null,
        business_type: businessTypeId,
      },
      dept: {
        date_created: toIsoDateTime(order.issueDate),
        allowed_period: Number(dept.allowedPeriod || 0),
        postpone: Boolean(dept.postpone),
        postpone_period: Number(dept.postponePeriod || 0),
      },
    }

    try {
      await post("/order/customers/save/sell", payload)
      try { localStorage.setItem("sales.formTemplate", formTemplate) } catch {}
      alert("บันทึกออเดอร์ขายเรียบร้อย ✅")
    } catch (err) {
      console.error("SAVE ERROR:", err?.data || err)
      const detail = err?.data?.detail ? `\n\nรายละเอียด:\n${JSON.stringify(err.data.detail, null, 2)}` : ""
      alert(`บันทึกล้มเหลว: ${err.message || "เกิดข้อผิดพลาด"}${detail}`)
    }
  }

  /** ---------- UI ---------- */
  const personBadge = () => (
    memberMeta.memberId != null
      ? <span className="inline-flex items-center gap-2 rounded-full bg-emerald-50 px-3 py-1.5 text-emerald-700 ring-1 ring-emerald-200 dark:bg-emerald-900/20 dark:text-emerald-200 dark:ring-emerald-700/60 self-start">
          <span className="h-2 w-2 rounded-full bg-emerald-500" />
          สมาชิก • member_id {memberMeta.memberId}
        </span>
      : memberMeta.assoId
        ? <span className="inline-flex items-center gap-2 rounded-full bg-sky-50 px-3 py-1.5 text-sky-700 ring-1 ring-sky-200 dark:bg-sky-900/20 dark:text-sky-200 dark:ring-sky-700/60 self-start">
            <span className="h-2 w-2 rounded-full bg-sky-500" />
            ลูกค้าทั่วไป • asso {String(memberMeta.assoId).slice(0,8)}…
          </span>
        : <span className="inline-flex items-center gap-2 rounded-full bg-amber-50 px-3 py-1.5 text-amber-700 ring-1 ring-amber-200 dark:bg-amber-900/20 dark:text-amber-200 dark:ring-amber-700/60 self-start">
            <span className="h-2 w-2 rounded-full bg-amber-500" />
            โปรดกรอก <b>member_id</b> หรือค้นหาชื่อเพื่อเลือกบุคคล
          </span>
  )

  return (
    <div className="min-h-screen bg-white text-black dark:bg-slate-900 dark:text-white rounded-2xl text-[15px] md:text-base">
      <div className="mx-auto max-w-7xl p-5 md:p-6 lg:p-8">
        <h1 className="mb-4 text-3xl font-bold">🧾 บันทึกออเดอร์ขาย</h1>

        {/* กล่องข้อมูลลูกค้า */}
        <div className="mb-6 rounded-2xl border border-slate-200 bg-white p-5 text-black shadow-sm dark:border-slate-700 dark:bg-slate-800 dark:text-white">
          <div className="mb-3 flex flex-wrap items-start gap-2">
            <h2 className="text-xl font-semibold">ข้อมูลลูกค้า</h2>
            {buyerType === "person" ? personBadge() : (
              <span className="inline-flex items-center gap-2 rounded-full bg-indigo-50 px-3 py-1.5 text-indigo-700 ring-1 ring-indigo-200 dark:bg-indigo-900/20 dark:text-indigo-200 dark:ring-indigo-700/60 self-start">
                <span className="h-2 w-2 rounded-full bg-indigo-500" />
                บริษัท / นิติบุคคล
              </span>
            )}

            <div className="ml-auto w-full sm:w-64 self-start">
              <label className={labelCls}>ประเภทผู้ซื้อ</label>
              <ComboBox options={buyerTypeOptions} value={buyerType} onChange={(id)=>setBuyerType(String(id))} buttonRef={refs.buyerType} />
            </div>

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
                value={paymentOptions.find((o)=>o.label===order.paymentMethod)?.id ?? ""}
                onChange={(_id, found) => setOrder((p)=>({ ...p, paymentMethod: found?.label ?? "" }))}
                placeholder="— เลือกวิธีชำระเงิน —"
                buttonRef={refs.payment}
              />
            </div>
            <div>
              <label className={labelCls}>ลงวันที่</label>
              <DateInput ref={refs.issueDate} value={order.issueDate} onChange={(e)=>updateOrder("issueDate", e.target.value)} />
            </div>
          </div>

          {/* โหมดบุคคล */}
          {buyerType === "person" ? (
            <div className="mt-4 grid gap-4 md:grid-cols-3">
              <div>
                <label className={labelCls}>รหัสสมาชิก (member_id)</label>
                <input ref={refs.memberId} inputMode="numeric" className={baseField} placeholder="พิมพ์เลข member_id หรือค้นหาด้านล่าง"
                  onChange={(e)=>setMemberMeta(m=>({ ...m, memberId: toIntOrNull(e.target.value) }))} />
              </div>
              <div className="md:col-span-2">
                <label className={labelCls}>เลขที่บัตรประชาชน (เพื่อค้นหาที่อยู่)</label>
                <input ref={refs.citizenId} inputMode="numeric" maxLength={13} className={baseField} value={customer.citizenId}
                  onChange={(e)=>updateCustomer("citizenId", onlyDigits(e.target.value))} placeholder="เช่น 1234567890123" />
                <div className={helpTextCls}>{loadingCustomer && "กำลังค้นหาผู้ซื้อ..."}</div>
              </div>
              <div className="md:col-span-3" ref={nameBoxRef}>
                <label className={labelCls}>ชื่อ–สกุล (พิมพ์เพื่อค้นหาอัตโนมัติ)</label>
                <input ref={(el)=>{refs.fullName.current=el; nameInputRef.current=el}} className={baseField} value={customer.fullName}
                  onChange={(e)=>{ updateCustomer("fullName", e.target.value); if (e.target.value.trim().length>=2) setShowNameList(true); else { setShowNameList(false); setHighlightedIndex(-1) } }}
                  onKeyDown={handleNameKeyDown} placeholder="เช่น นายสมชาย ใจดี" />
                {showNameList && nameResults.length>0 && (
                  <div ref={listContainerRef} className="mt-1 max-h-72 w-full overflow-auto rounded-2xl border border-slate-200 bg-white text-black shadow-sm dark:border-slate-700 dark:bg-slate-800 dark:text-white" role="listbox">
                    {nameResults.map((r, idx)=>{
                      const isActive = idx===highlightedIndex
                      const full = `${r.first_name ?? ""} ${r.last_name ?? ""}`.trim()
                      return (
                        <button key={`${r.type}-${r.asso_id}-${idx}`} ref={(el)=>itemRefs.current[idx]=el} type="button" onClick={async()=>await pickNameResult(r)}
                          onMouseEnter={()=>{ setHighlightedIndex(idx); requestAnimationFrame(()=>scrollHighlightedIntoView2(idx)) }}
                          role="option" aria-selected={isActive}
                          className={cx("relative flex w-full items-start gap-3 px-3 py-2.5 text-left transition rounded-xl cursor-pointer",
                            isActive ? "bg-emerald-100 ring-1 ring-emerald-300 dark:bg-emerald-400/20 dark:ring-emerald-500" : "hover:bg-emerald-50 dark:hover:bg-emerald-900/30")}>
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
            /* โหมดบริษัท */
            <div className="mt-4 grid gap-4 md:grid-cols-3" ref={companyBoxRef}>
              <div className="md:col-span-2">
                <label className={labelCls}>ชื่อบริษัท / นิติบุคคล (พิมพ์เพื่อค้นหา)</label>
                <input ref={companyInputRef} className={baseField} value={customer.companyName} onChange={(e)=>updateCustomer("companyName", e.target.value)} placeholder="เช่น บริษัท ตัวอย่าง จำกัด" />
                {showCompanyList && companyResults.length>0 && (
                  <div className="mt-1 max-h-72 w-full overflow-auto rounded-2xl border border-slate-200 bg-white text-black shadow-sm dark:border-slate-700 dark:bg-slate-800 dark:text-white" role="listbox">
                    {companyResults.map((r, idx)=>{
                      const isActive = idx===companyHighlighted
                      return (
                        <button key={`${r.asso_id}-${idx}`} ref={(el)=>companyItemRefs.current[idx]=el} type="button" onClick={async()=>await pickCompanyResult(r)}
                          onMouseEnter={()=>setCompanyHighlighted(idx)}
                          className={cx("relative flex w-full items-start gap-3 px-3 py-2.5 text-left transition rounded-xl cursor-pointer",
                            isActive ? "bg-indigo-100 ring-1 ring-indigo-300 dark:bg-indigo-400/20 dark:ring-indigo-500" : "hover:bg-indigo-50 dark:hover:bg-indigo-900/30")}>
                          {isActive && <span className="absolute left-0 top-0 h-full w-1 bg-indigo-600 dark:bg-indigo-400/70 rounded-l-xl" />}
                          <div className="flex-1">
                            <div className="font-medium">{r.company_name ?? "(ไม่มีชื่อ)"}</div>
                            <div className="text-sm text-slate-600 dark:text-slate-300">เลขผู้เสียภาษี {r.tax_id ?? "-"}</div>
                          </div>
                        </button>
                      )
                    })}
                  </div>
                )}
              </div>
              <div>
                <label className={labelCls}>เลขที่ผู้เสียภาษี (13 หลัก)</label>
                <input ref={refs.taxId} inputMode="numeric" className={baseField} value={customer.taxId} onChange={(e)=>updateCustomer("taxId", onlyDigits(e.target.value))} placeholder="เช่น 1234567890123" />
              </div>
            </div>
          )}
        </div>

        {/* กล่องรายละเอียดการขาย */}
        <form onSubmit={handleSubmit} className="rounded-2xl border border-slate-200 bg-white p-5 text-black shadow-sm dark:border-slate-700 dark:bg-slate-800 dark:text-white">
          <h2 className="mb-3 text-xl font-semibold">รายละเอียดการขาย</h2>

          {/* spec / program / business */}
          <div className="grid gap-4 md:grid-cols-3">
            <div>
              <label className={labelCls}>ประเภทสินค้า</label>
              <ComboBox options={productOptions} value={order.productId} onChange={(id,found)=>setOrder(p=>({ ...p, productId:id, productName:found?.label ?? "", riceId:"", riceType:"", subriceId:"", subriceName:"" }))} placeholder="— เลือกประเภทสินค้า —" buttonRef={refs.product} />
            </div>
            <div>
              <label className={labelCls}>ชนิดข้าว</label>
              <ComboBox options={riceOptions} value={order.riceId} onChange={(id,found)=>setOrder(p=>({ ...p, riceId:id, riceType:found?.label ?? "", subriceId:"", subriceName:"" }))} placeholder="— เลือกชนิดข้าว —" buttonRef={refs.riceType} />
            </div>
            <div>
              <label className={labelCls}>ชั้นย่อย</label>
              <ComboBox options={subriceOptions} value={order.subriceId} onChange={(id,found)=>setOrder(p=>({ ...p, subriceId:id, subriceName:found?.label ?? "" }))} placeholder="— เลือกชั้นย่อย —" buttonRef={refs.subrice} />
            </div>
            <div>
              <label className={labelCls}>สภาพ/เงื่อนไข</label>
              <ComboBox options={conditionOptions} value={order.conditionId} onChange={(id,found)=>setOrder(p=>({ ...p, conditionId:id, condition:found?.label ?? "" }))} placeholder="— เลือกสภาพ/เงื่อนไข —" buttonRef={refs.condition} />
            </div>
            <div>
              <label className={labelCls}>ประเภทนา</label>
              <ComboBox options={fieldTypeOptions} value={order.fieldTypeId} onChange={(id,found)=>setOrder(p=>({ ...p, fieldTypeId:id, fieldType:found?.label ?? "" }))} placeholder="— เลือกประเภทนา —" buttonRef={refs.fieldType} />
            </div>
            <div>
              <label className={labelCls}>ปี/ฤดูกาล</label>
              <ComboBox options={yearOptions} value={order.riceYearId} onChange={(id,found)=>setOrder(p=>({ ...p, riceYearId:id, riceYear:found?.label ?? "" }))} placeholder="— เลือกปี/ฤดูกาล —" buttonRef={refs.riceYear} />
            </div>
            <div>
              <label className={labelCls}>ประเภทธุรกิจ</label>
              <ComboBox options={businessOptions} value={order.businessTypeId} onChange={(id,found)=>setOrder(p=>({ ...p, businessTypeId:id, businessType:found?.label ?? "" }))} placeholder="— เลือกประเภทธุรกิจ —" buttonRef={refs.businessType} />
            </div>
            <div>
              <label className={labelCls}>โปรแกรม</label>
              <ComboBox options={programOptions} value={order.programId} onChange={(id,found)=>setOrder(p=>({ ...p, programId:id, programName:found?.label ?? "" }))} placeholder="— เลือกโปรแกรม —" buttonRef={refs.program} />
            </div>
          </div>

          {/* branch / klang */}
          <div className="mt-4 grid gap-4 md:grid-cols-3">
            <div>
              <label className={labelCls}>สาขา</label>
              <ComboBox options={branchOptions} value={order.branchId ?? ""} getValue={(o)=>o.id} onChange={(_id,found)=>setOrder(p=>({ ...p, branchId:found?.id ?? null, branchName:found?.label ?? "", klangId:null, klangName:"" }))} placeholder="— เลือกสาขา —" buttonRef={refs.branchName} />
            </div>
            <div>
              <label className={labelCls}>คลัง</label>
              <ComboBox options={klangOptions} value={order.klangId ?? ""} getValue={(o)=>o.id} onChange={(_id,found)=>setOrder(p=>({ ...p, klangId:found?.id ?? null, klangName:found?.label ?? "" }))} placeholder="— เลือกคลัง —" disabled={!order.branchId} buttonRef={refs.klangName} />
            </div>
          </div>

          {/* numbers */}
          <div className="mt-6 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm ring-1 ring-transparent dark:border-slate-700 dark:bg-slate-800">
            <div className="mb-3 flex items-center gap-2">
              <span className="inline-flex h-2 w-2 rounded-full bg-emerald-500" />
              <h3 className="text-lg font-semibold">ตัวเลขและการคำนวณ</h3>
            </div>
            <div className="grid gap-4 md:grid-cols-3">
              <div><label className={labelCls}>ก่อนชั่ง (กก.)</label><input ref={refs.entryWeightKg} inputMode="decimal" className={baseField} value={order.entryWeightKg} onChange={(e)=>updateOrder("entryWeightKg", e.target.value.replace(/[^0-9.]/g,""))} /></div>
              <div><label className={labelCls}>หลังชั่ง (กก.)</label><input ref={refs.exitWeightKg} inputMode="decimal" className={baseField} value={order.exitWeightKg} onChange={(e)=>updateOrder("exitWeightKg", e.target.value.replace(/[^0-9.]/g,""))} /></div>
              <div><label className={labelCls}>จากตาชั่ง (กก.)</label><input disabled className={cx(baseField, fieldDisabled)} value={Math.round(Math.abs(toNumber(order.exitWeightKg)-toNumber(order.entryWeightKg))*100)/100} /></div>
              <div><label className={labelCls}>ความชื้น (%)</label><input ref={refs.moisturePct} inputMode="decimal" className={baseField} value={order.moisturePct} onChange={(e)=>updateOrder("moisturePct", e.target.value.replace(/[^0-9.]/g,""))} /></div>
              <div><label className={labelCls}>สิ่งเจือปน (%)</label><input ref={refs.impurityPct} inputMode="decimal" className={baseField} value={order.impurityPct} onChange={(e)=>updateOrder("impurityPct", e.target.value.replace(/[^0-9.]/g,""))} /></div>
              <div>
                <div className="flex items-center justify-between"><label className={labelCls}>น้ำหนักหัก (กก.)</label>
                  <label className="flex cursor-pointer items-center gap-2 text-sm"><input type="checkbox" checked={order.manualDeduct} onChange={(e)=>updateOrder("manualDeduct", e.target.checked)} />กำหนดเอง</label></div>
                <input ref={refs.deductWeightKg} inputMode="decimal" className={baseField} disabled={!order.manualDeduct}
                  value={order.manualDeduct ? order.deductWeightKg : Math.round(suggestDeductionWeight(grossFromScale, order.moisturePct, order.impurityPct)*100)/100}
                  onChange={(e)=>updateOrder("deductWeightKg", e.target.value.replace(/[^0-9.]/g,""))} />
              </div>
              <div><label className={labelCls}>น้ำหนักสุทธิ (กก.)</label><input disabled className={cx(baseField, fieldDisabled)} value={Math.round(netWeight*100)/100} /></div>
              <div><label className={labelCls}>ราคาต่อกก. (บาท)</label><input ref={refs.unitPrice} inputMode="decimal" className={baseField} value={order.unitPrice} onChange={(e)=>updateOrder("unitPrice", e.target.value.replace(/[^0-9.]/g,""))} /></div>
              <div><label className={labelCls}>เป็นเงิน (บาท)</label><input ref={refs.amountTHB} inputMode="decimal" className={baseField} value={order.amountTHB} onChange={(e)=>updateOrder("amountTHB", formatMoneyInput(e.target.value))} /></div>
            </div>

            {/* เอกสารเพิ่ม (optional) */}
            <div className="mt-4 grid gap-4 md:grid-cols-3">
              <div>
                <label className={labelCls}>เลขที่ใบชั่ง</label>
                <input ref={refs.weighSlipNo} className={baseField} value={order.weighSlipNo} onChange={(e)=>updateOrder("weighSlipNo", e.target.value)} placeholder="เช่น WS-2025-0001" />
                <p className={helpTextCls}>ไม่บังคับ</p>
              </div>
              {!isCreditPayment() && (
                <div>
                  <label className={labelCls}>ใบรับเงินขายสินค้า (ขายสด)</label>
                  <input ref={refs.salesReceiptNo} className={baseField} value={order.salesReceiptNo} onChange={(e)=>updateOrder("salesReceiptNo", e.target.value)} placeholder="เช่น RC-2025-0001" />
                  <p className={helpTextCls}>แสดงเมื่อเลือกวิธีชำระเงินเป็นขายสด</p>
                </div>
              )}
              {isCreditPayment() && (
                <div>
                  <label className={labelCls}>เลขที่ใบกำกับสินค้า (ขายเชื่อ)</label>
                  <input ref={refs.taxInvoiceNo} className={baseField} value={order.taxInvoiceNo} onChange={(e)=>updateOrder("taxInvoiceNo", e.target.value)} placeholder="เช่น TI-2025-0001" />
                  <p className={helpTextCls}>แสดงเมื่อเลือกวิธีชำระเงินเป็นขายเชื่อ</p>
                </div>
              )}
            </div>
          </div>

          <div className="mt-4">
            <label className={labelCls}>หมายเหตุ / คอมเมนต์</label>
            <textarea ref={refs.comment} rows={3} className={baseField} value={order.comment} onChange={(e)=>updateOrder("comment", e.target.value)} />
          </div>

          <div className="mt-6 flex flex-col gap-3 sm:flex-row">
            <button type="submit" className="inline-flex items-center justify-center rounded-2xl bg-emerald-600 px-6 py-3 text-base font-semibold text-white shadow-[0_6px_16px_rgba(16,185,129,0.35)] transition-all duration-300 ease-out hover:bg-emerald-700 hover:shadow-[0_8px_20px_rgba(16,185,129,0.45)] hover:scale-[1.05] active:scale-[.97] cursor-pointer">บันทึกออเดอร์ขาย</button>
          </div>
        </form>
      </div>
    </div>
  )
}

export default Sales