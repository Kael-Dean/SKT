// ✅ src/pages/Sales.jsx (จัดลำดับอินพุตให้เหมือนหน้า Buy แล้ว)
import { useEffect, useMemo, useRef, useState, forwardRef, useImperativeHandle } from "react"
import { apiAuth } from "../lib/api" // ← รวม Base URL, token, และ JSON ให้แล้ว

/** ---------- Utils ---------- */
const onlyDigits = (s = "") => s.replace(/\D+/g, "")
const toNumber = (v) => (v === "" || v === null || v === undefined ? 0 : Number(v))
const thb = (n) =>
  new Intl.NumberFormat("th-TH", { style: "currency", currency: "THB", maximumFractionDigits: 2 }).format(
    isFinite(n) ? n : 0
  )

function validateThaiCitizenId(id) {
  const cid = onlyDigits(id)
  if (cid.length !== 13) return false
  let sum = 0
  for (let i = 0; i < 12; i++) sum += Number(cid[i]) * (13 - i)
  const check = (11 - (sum % 11)) % 10
  return check === Number(cid[12])
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

/** ---------- สไตล์ ---------- */
const baseField =
  "w-full rounded-2xl border border-slate-300 bg-slate-100 p-3 text-[15px] md:text-base " +
  "text-black outline-none placeholder:text-slate-500 focus:border-emerald-600 focus:ring-2 focus:ring-emerald-500/30 shadow-none " +
  "dark:border-slate-500 dark:bg-slate-700 dark:text-slate-100 dark:placeholder:text-slate-300 dark:focus:border-emerald-400 dark:focus:ring-emerald-400/30"

const fieldDisabled =
  "bg-slate-100 text-slate-600 cursor-not-allowed opacity-95 dark:bg-slate-700/70 dark:text-slate-300"
const labelCls =
  "mb-1 block text-[15px] md:text-base font-medium text-slate-700 dark:text-slate-200"
const helpTextCls = "mt-1 text-sm text-slate-600 dark:text-slate-300"
const errorTextCls = "mt-1 text-sm text-red-500"
const compactInput = "!py-2 !px-4 !text-[16px] !leading-normal"

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
    requestAnimationFrame(() => controlRef.current?.focus())
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
            setOpen((o) => !o)
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
          else { el.focus(); el.click?.() }
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

/** ---------- Component: Sales ---------- */
const Sales = () => {
  const [loadingCustomer, setLoadingCustomer] = useState(false)
  const [customerFound, setCustomerFound] = useState(null)
  const [errors, setErrors] = useState({})
  const [missingHints, setMissingHints] = useState({})
  const [nameResults, setNameResults] = useState([])
  const [showNameList, setShowNameList] = useState(false)

  const nameBoxRef = useRef(null)
  const nameInputRef = useRef(null)
  const suppressNameSearchRef = useRef(false)

  const [highlightedIndex, setHighlightedIndex] = useState(-1)
  const listContainerRef = useRef(null)
  const itemRefs = useRef([])

  /** dropdown opts */
  const [productOptions, setProductOptions] = useState([])
  const [riceOptions, setRiceOptions] = useState([])
  const [subriceOptions, setSubriceOptions] = useState([])
  const [branchOptions, setBranchOptions] = useState([])
  const [klangOptions, setKlangOptions] = useState([])
  const [conditionOptions, setConditionOptions] = useState([])
  const [fieldTypeOptions, setFieldTypeOptions] = useState([])
  const [yearOptions, setYearOptions] = useState([])
  const [programOptions, setProgramOptions] = useState([])
  const [paymentOptions, setPaymentOptions] = useState([])

  /** ฟอร์มลูกค้า */
  const [customer, setCustomer] = useState({
    citizenId: "",
    fullName: "",
    houseNo: "",
    moo: "",
    subdistrict: "",
    district: "",
    province: "",
    postalCode: "",
  })

  /** เมตาสมาชิก/ลูกค้า */
  const [memberMeta, setMemberMeta] = useState({
    type: "unknown",
    assoId: null,
  })

  /** ฟอร์มออเดอร์ (สำหรับขาย) */
  const [order, setOrder] = useState({
    // product / rice
    productId: "",
    productName: "",
    riceId: "",
    riceType: "",
    subriceId: "",
    subriceName: "",

    // ปี/สภาพ/ประเภทนา (ตาม backend)
    riceYear: "",
    riceYearId: "",
    condition: "",
    conditionId: "",
    fieldType: "",
    fieldTypeId: "",

    // (โปรแกรม/วิธีชำระเงิน — optional UI เท่านั้น)
    program: "",
    paymentMethod: "",

    // ชั่ง/คำนวณ
    entryWeightKg: "",
    exitWeightKg: "",
    moisturePct: "",
    impurityPct: "",
    manualDeduct: false,
    deductWeightKg: "",

    // ราคา
    unitPrice: "",
    amountTHB: "",

    // เอกสาร (ขาย)
    weighSlipNo: "",
    taxInvoiceNo: "",
    salesReceiptNo: "",
    issueDate: new Date().toISOString().slice(0, 10),

    // ที่ตั้ง
    branchName: "",
    branchId: null,
    klangName: "",
    klangId: null,
    registeredPlace: "",
  })

  /** ---------- Refs ---------- */
  const refs = {
    citizenId: useRef(null),
    fullName: useRef(null),
    houseNo: useRef(null),
    moo: useRef(null),
    subdistrict: useRef(null),
    district: useRef(null),
    province: useRef(null),
    postalCode: useRef(null),
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
    issueDate: useRef(null),
    // เอกสารขาย
    weighSlipNo: useRef(null),
    taxInvoiceNo: useRef(null),
    salesReceiptNo: useRef(null),
  }

  /** debounce */
  const debouncedCitizenId = useDebounce(customer.citizenId)
  const debouncedFullName  = useDebounce(customer.fullName)

  /** helper: ลองเรียกหลาย endpoint จนกว่าจะเจอที่ใช้ได้ (array หรือ object ก็รับ) */
  const fetchFirstOkJson = async (paths = []) => {
    for (const p of paths) {
      try {
        const data = await apiAuth(p) // GET + auto JSON
        if (Array.isArray(data)) return data
        if (data && typeof data === "object") return data
      } catch (_) {}
    }
    return Array.isArray(paths) ? [] : {}
  }

  /** 🔎 helper: ดึงที่อยู่เต็มจาก citizen_id (fallback) */
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
    }

    const hasAnyAddress =
      addr.houseNo || addr.moo || addr.subdistrict || addr.district || addr.province || addr.postalCode

    if (addr.firstName || addr.lastName || hasAnyAddress) {
      setCustomer((prev) => ({
        ...prev,
        fullName: (addr.firstName || addr.lastName) ? `${addr.firstName} ${addr.lastName}`.trim() || prev.fullName : prev.fullName,
        houseNo: addr.houseNo || prev.houseNo,
        moo: addr.moo || prev.moo,
        subdistrict: addr.subdistrict || prev.subdistrict,
        district: addr.district || prev.district,
        province: addr.province || prev.province,
        postalCode: addr.postalCode || prev.postalCode,
      }))
      if (addr.type) setMemberMeta((m) => ({ ...m, type: addr.type }))
      if (addr.asso_id) setMemberMeta((m) => ({ ...m, assoId: addr.asso_id }))
    }
  }

  /** โหลด dropdown ชุดแรก (ที่ไม่ผูกกัน) + branch */
  useEffect(() => {
    const loadStaticDD = async () => {
      try {
        const [
          products,
          conditions,
          fields,
          years,
          programs,
          payments,
          branches,
        ] = await Promise.all([
          fetchFirstOkJson(["/order/product/search"]),
          fetchFirstOkJson(["/order/condition/search"]),
          fetchFirstOkJson(["/order/field/search", "/order/field_type/list", "/order/field-type/list"]),
          fetchFirstOkJson(["/order/year/search"]),
          fetchFirstOkJson(["/order/program/search"]),
          fetchFirstOkJson(["/order/payment/search"]), // sales ใช้แบบรวม
          fetchFirstOkJson(["/order/branch/search"]),
        ])

        setProductOptions(
          (products || []).map((x) => ({
            id: String(x.id ?? x.product_id ?? x.value ?? ""),
            label: String(x.product_type ?? x.name ?? x.label ?? "").trim(),
          })).filter((o) => o.id && o.label)
        )

        setConditionOptions(
          (conditions || []).map((x, i) => ({
            id: String(x.id ?? x.value ?? i),
            label: String(x.condition ?? x.year ?? x.name ?? x.label ?? "").trim(),
          })).filter((o) => o.id && o.label)
        )

        setFieldTypeOptions(
          (fields || []).map((x, i) => ({
            id: String(x.id ?? x.value ?? i),
            label: String(x.field_type ?? x.name ?? x.year ?? x.label ?? (typeof x === "string" ? x : "")).trim(),
          })).filter((o) => o.id && o.label)
        )

        setYearOptions(
          (years || []).map((x, i) => ({
            id: String(x.id ?? x.value ?? i),
            label: String(x.year ?? x.name ?? x.label ?? "").trim(),
          })).filter((o) => o.id && o.label)
        )

        setProgramOptions(
          (programs || []).map((x, i) => ({
            id: String(x.id ?? x.value ?? i),
            label: String(x.program ?? x.year ?? x.name ?? x.label ?? "").trim(),
          })).filter((o) => o.id && o.label)
        )

        setPaymentOptions(
          (payments || []).map((x, i) => ({
            id: String(x.id ?? x.value ?? i),
            label: String(x.method ?? x.year ?? x.name ?? x.label ?? "").trim(),
          })).filter((o) => o.id && o.label)
        )

        setBranchOptions((branches || []).map((b) => ({ id: b.id, label: b.branch_name })))
      } catch (err) {
        console.error("loadStaticDD fatal:", err)
        setProductOptions([]); setConditionOptions([]); setFieldTypeOptions([]); setYearOptions([]); setProgramOptions([]); setPaymentOptions([])
        setBranchOptions([])
      }
    }
    loadStaticDD()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  /** เมื่อเลือก product → โหลด rice */
  useEffect(() => {
    const pid = order.productId
    if (!pid) { setRiceOptions([]); setOrder((p) => ({ ...p, riceId: "", riceType: "", subriceId: "", subriceName: "" })); return }

    const loadRice = async () => {
      try {
        const arr = await apiAuth(`/order/rice/search?product_id=${encodeURIComponent(pid)}`)
        const mapped = (arr || []).map((x) => ({
          id: String(x.id ?? x.rice_id ?? x.value ?? ""),
          label: String(x.rice_type ?? x.name ?? x.label ?? "").trim(),
        })).filter((o) => o.id && o.label)
        setRiceOptions(mapped)
      } catch (e) {
        console.error("load rice error:", e)
        setRiceOptions([])
      }
    }
    loadRice()
  }, [order.productId])

  /** เมื่อเลือก rice → โหลด sub-rice */
  useEffect(() => {
    const rid = order.riceId
    if (!rid) { setSubriceOptions([]); setOrder((p) => ({ ...p, subriceId: "", subriceName: "" })); return }
    const loadSub = async () => {
      try {
        const arr = await apiAuth(`/order/sub-rice/search?rice_id=${encodeURIComponent(rid)}`)
        const mapped = (arr || []).map((x) => ({
          id: String(x.id ?? x.subrice_id ?? x.value ?? ""),
          label: String(x.sub_class ?? x.name ?? x.label ?? "").trim(),
        })).filter((o) => o.id && o.label)
        setSubriceOptions(mapped)
      } catch (e) {
        console.error("load subrice error:", e)
        setSubriceOptions([])
      }
    }
    loadSub()
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
      } catch (e) { console.error("Load klang error:", e); setKlangOptions([]) }
    }
    loadKlang()
  }, [order.branchId, order.branchName])

  /** map record -> UI (ครอบคลุมฟิลด์ที่อยู่ด้วย) */
  const mapSimplePersonToUI = (r = {}) => {
    const toStr = (v) => (v == null ? "" : String(v))
    return {
      citizenId: toStr(r.citizen_id ?? r.citizenId ?? ""),
      firstName: toStr(r.first_name ?? r.firstName ?? ""),
      lastName:  toStr(r.last_name ?? r.lastName ?? ""),
      fullName:  `${toStr(r.first_name ?? r.firstName ?? "")} ${toStr(r.last_name ?? r.lastName ?? "")}`.trim(),
      assoId:    r.asso_id ?? r.assoId ?? null,
      type:      r.type ?? "unknown",

      // address fields (ถ้ามีมากับผลลัพธ์ search)
      houseNo:     toStr(r.address ?? r.house_no ?? r.houseNo ?? ""),
      moo:         toStr(r.mhoo ?? r.moo ?? ""),
      subdistrict: toStr(r.sub_district ?? r.subdistrict ?? r.subDistrict ?? ""),
      district:    toStr(r.district ?? ""),
      province:    toStr(r.province ?? ""),
      postalCode:  onlyDigits(toStr(r.postal_code ?? r.postalCode ?? "")),
    }
  }

  /** เติมจากเรคอร์ด + ถ้าไม่ครบค่อย fallback ไปหา address ด้วย citizen_id */
  const fillFromRecord = async (raw = {}) => {
    const data = mapSimplePersonToUI(raw)

    setCustomer((prev) => ({
      ...prev,
      citizenId: onlyDigits(data.citizenId || prev.citizenId),
      fullName: data.fullName || prev.fullName,
    }))
    setMemberMeta({ type: data.type, assoId: data.assoId })
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

  /** ค้นหาด้วยเลขบัตร (ใช้ endpoint ใหม่ /order/customers/search) */
  useEffect(() => {
    const cid = onlyDigits(debouncedCitizenId)
    if (cid.length !== 13) {
      setCustomerFound(null)
      setMemberMeta({ type: "unknown", assoId: null })
      return
    }
    const fetchByCid = async () => {
      try {
        setLoadingCustomer(true)
        const arr = await apiAuth(`/order/customers/search?q=${encodeURIComponent(cid)}`)
        const list = Array.isArray(arr) ? arr : []
        const exact =
          list.find((r) => onlyDigits(r.citizen_id || r.citizenId || "") === cid) || list[0]
        if (exact) {
          await fillFromRecord(exact)
        } else {
          setCustomerFound(false)
          setMemberMeta({ type: "customer", assoId: null })
        }
      } catch (e) {
        console.error(e)
        setCustomerFound(false)
        setMemberMeta({ type: "customer", assoId: null })
      } finally {
        setLoadingCustomer(false)
      }
    }
    fetchByCid()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedCitizenId])

  /** ค้นหาด้วยชื่อ (ใช้ /order/customers/search) */
  useEffect(() => {
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
      setMemberMeta({ type: "unknown", assoId: null })
      return
    }

    const searchByName = async () => {
      try {
        setLoadingCustomer(true)
        const items = await apiAuth(`/order/customers/search?q=${encodeURIComponent(q)}`)
        const mapped = (items || []).map((r) => ({
          type: r.type,
          asso_id: r.asso_id,
          citizen_id: r.citizen_id,
          first_name: r.first_name,
          last_name: r.last_name,
          address: r.address ?? r.house_no ?? r.houseNo ?? "",
          mhoo: r.mhoo ?? r.moo ?? "",
          sub_district: r.sub_district ?? r.subdistrict ?? r.subDistrict ?? "",
          district: r.district ?? "",
          province: r.province ?? "",
          postal_code: r.postal_code ?? r.postalCode ?? "",
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedFullName])

  /** ปิด dropdown เมื่อคลิกนอกกล่อง */
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
    hasRed(key)
      ? "border-red-500 ring-2 ring-red-300 focus:ring-0 focus:border-red-500"
      : ""
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

  /** ---------- น้ำหนักจากตาชั่ง (ใหม่) ---------- */
  const grossFromScale = useMemo(() => {
    const entry = toNumber(order.entryWeightKg)
    const exit  = toNumber(order.exitWeightKg)
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
      setOrder((prev) => ({ ...prev, amountTHB: String(Math.round(computedAmount * 100) / 100) }))
    }
  }, [computedAmount])

  /** ---------- Missing hints ---------- */
  const redHintCls = (key) =>
    missingHints[key]
      ? "border-red-400 ring-2 ring-red-300 focus:border-red-400 animate-pulse"
      : ""

  const clearHint = (key) =>
    setMissingHints((prev) => (prev[key] ? { ...prev, [key]: false } : prev))

  const computeMissingHints = () => {
    const m = {}
    // ลูกค้า
    if (!customer.fullName.trim()) m.fullName = true
    if (!customer.houseNo.trim()) m.houseNo = true
    if (!customer.moo.trim()) m.moo = true
    if (!customer.subdistrict.trim()) m.subdistrict = true
    if (!customer.district.trim()) m.district = true
    if (!customer.province.trim()) m.province = true
    // ออเดอร์ (จำเป็นตาม backend)
    if (!order.productId) m.product = true
    if (!order.riceId) m.riceType = true
    if (!order.subriceId) m.subrice = true
    if (!order.conditionId) m.condition = true
    if (!order.fieldTypeId) m.fieldType = true
    if (!order.riceYearId) m.riceYear = true
    if (!order.branchName) m.branchName = true
    if (!order.klangName) m.klangName = true
    if (!order.entryWeightKg || Number(order.entryWeightKg) < 0) m.entryWeightKg = true
    if (!order.exitWeightKg  || Number(order.exitWeightKg)  <= 0) m.exitWeightKg = true
    if (!order.amountTHB || Number(order.amountTHB) <= 0) m.amountTHB = true
    if (!order.issueDate) m.issueDate = true
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

  /** ---------- Validation ---------- */
  const validateAll = () => {
    const e = {}
    if (customer.citizenId && !validateThaiCitizenId(customer.citizenId)) e.citizenId = "เลขบัตรประชาชนอาจไม่ถูกต้อง"
    if (!customer.fullName) e.fullName = "กรุณากรอกชื่อ–สกุล"
    if (!customer.subdistrict || !customer.district || !customer.province) e.address = "กรุณากรอกที่อยู่ให้ครบ"

    if (!order.productId) e.product = "เลือกประเภทสินค้า"
    if (!order.riceId) e.riceType = "เลือกชนิดข้าว"
    if (!order.subriceId) e.subrice = "เลือกชั้นย่อย"
    if (!order.conditionId) e.condition = "เลือกสภาพ/เงื่อนไข"
    if (!order.fieldTypeId) e.fieldType = "เลือกประเภทนา"
    if (!order.riceYearId) e.riceYear = "เลือกปี/ฤดูกาล"

    if (!order.branchName) e.branchName = "เลือกสาขา"
    if (!order.klangName) e.klangName = "เลือกคลัง"

    if (order.entryWeightKg === "" || Number(order.entryWeightKg) < 0) e.entryWeightKg = "กรอกน้ำหนักก่อนชั่ง"
    if (order.exitWeightKg === "" || Number(order.exitWeightKg) <= 0) e.exitWeightKg = "กรอกน้ำหนักหลังชั่ง"
    if (grossFromScale <= 0) {
      e.exitWeightKg = "ค่าน้ำหนักจากตาชั่งต้องมากกว่า 0"
    }

    if (order.manualDeduct && (order.deductWeightKg === "" || Number(order.deductWeightKg) < 0))
      e.deductWeightKg = "กรอกน้ำหนักหักให้ถูกต้อง"
    if (!order.amountTHB || Number(order.amountTHB) <= 0) e.amountTHB = "กรอกจำนวนเงินให้ถูกต้อง"
    if (!order.issueDate) e.issueDate = "กรุณาเลือกวันที่"
    setErrors(e)
    return e
  }

  const scrollToFirstError = (eObj) => {
    const orderKeys = [
      "fullName",
      "address",
      "product",
      "riceType",
      "subrice",
      "condition",
      "fieldType",
      "riceYear",
      "branchName",
      "klangName",
      "entryWeightKg",
      "exitWeightKg",
      "deductWeightKg",
      "amountTHB",
      "issueDate",
    ]
    const firstKey = orderKeys.find((k) => k in eObj)
    if (!firstKey) return

    const keyToFocus =
      firstKey === "address"
        ? (customer.houseNo ? (customer.moo ? (customer.subdistrict ? (customer.district ? "province" : "district") : "subdistrict") : "moo") : "houseNo")
        : firstKey

    const el = refs[keyToFocus]?.current
    if (el && typeof el.focus === "function") {
      try { el.scrollIntoView({ behavior: "smooth", block: "center" }) } catch {}
      el.focus()
    }
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

    const [firstName, ...rest] = customer.fullName.trim().split(" ")
    const lastName = rest.join(" ")

    const productId  = /^\d+$/.test(order.productId)   ? Number(order.productId)   : null
    const riceId     = /^\d+$/.test(order.riceId)      ? Number(order.riceId)      : null
    const subriceId  = /^\d+$/.test(order.subriceId)   ? Number(order.subriceId)   : null
    const branchId   = order.branchId ?? null
    const klangId    = order.klangId ?? null
    const riceYearId = /^\d+$/.test(order.riceYearId)  ? Number(order.riceYearId)  : null
    const conditionId= /^\d+$/.test(order.conditionId) ? Number(order.conditionId) : null
    const fieldTypeId= /^\d+$/.test(order.fieldTypeId) ? Number(order.fieldTypeId) : null

    if (!productId)  { setErrors((p)=>({ ...p, product:"ไม่พบรหัสสินค้า" }));       scrollToFirstError({product:true}); return }
    if (!riceId)     { setErrors((p)=>({ ...p, riceType:"ไม่พบรหัสชนิดข้าว" }));    scrollToFirstError({riceType:true}); return }
    if (!subriceId)  { setErrors((p)=>({ ...p, subrice:"ไม่พบรหัสชั้นย่อย" }));     scrollToFirstError({subrice:true}); return }
    if (!riceYearId) { setErrors((p)=>({ ...p, riceYear:"ไม่พบรหัสปี/ฤดูกาล" }));   scrollToFirstError({riceYear:true}); return }
    if (!conditionId){ setErrors((p)=>({ ...p, condition:"ไม่พบรหัสสภาพ/เงื่อนไข" })); scrollToFirstError({condition:true}); return }
    if (!fieldTypeId){ setErrors((p)=>({ ...p, fieldType:"ไม่พบรหัสประเภทนา" }));   scrollToFirstError({fieldType:true}); return }
    if (!branchId)   { setErrors((p)=>({ ...p, branchName:"ไม่พบรหัสสาขา" }));      scrollToFirstError({branchName:true}); return }
    if (!klangId)    { setErrors((p)=>({ ...p, klangName:"ไม่พบรหัสคลัง" }));       scrollToFirstError({klangName:true}); return }

    const baseGross = grossFromScale
    const deduction = order.manualDeduct
      ? toNumber(order.deductWeightKg)
      : suggestDeductionWeight(baseGross, order.moisturePct, order.impurityPct)

    const netW = Math.max(0, baseGross - deduction)

    const payload = {
      customer: {
        first_name: firstName || "",
        last_name: lastName || "",
        citizen_id: onlyDigits(customer.citizenId),
        address: customer.houseNo.trim(),
        mhoo: customer.moo.trim(),
        sub_district: customer.subdistrict.trim(),
        district: customer.district.trim(),
        province: customer.province.trim(),
        postal_code: customer.postalCode?.toString().trim() || "",
      },
      order: {
        asso_id: "",
        product_id: productId,
        rice_id: riceId,
        subrice_id: subriceId,
        rice_year: riceYearId,
        field_type: fieldTypeId,
        condition: conditionId,
        humidity: Number(order.moisturePct || 0),
        entry_weight: Number(order.entryWeightKg || 0),
        exit_weight:  Number(order.exitWeightKg  || 0),
        weight: netW,
        price_per_kilo: Number(order.unitPrice || 0),
        price: Number(order.amountTHB),
        impurity: Number(order.impurityPct || 0),
        // ⛳️ Sales endpoint เดิมใช้ ISO — คงไว้ตามเดิม
        date: new Date(`${order.issueDate}T00:00:00.000Z`).toISOString(),
        branch_location: branchId,
        klang_location: klangId,
        // เอกสารขาย
        weight_slip_no: order.weighSlipNo.trim(),
        tax_invoice_no: order.taxInvoiceNo.trim(),
        sales_receipt_no: order.salesReceiptNo.trim(),
      },
      rice:   { rice_type: order.riceType },
      branch: { branch_name: order.branchName },
      klang:  { klang_name: order.klangName },
    }

    try {
      await apiAuth(`/order/customers/save`, { method: "POST", body: payload }) // ← apiAuth จะจัดการ JSON ให้
      alert("บันทึกออเดอร์ขายเรียบร้อย ✅")
      handleReset()
    } catch (err) {
      console.error(err)
      alert("บันทึกล้มเหลว กรุณาลองใหม่")
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
    setMemberMeta({ type: "unknown", assoId: null })
    setCustomer({
      citizenId: "",
      fullName: "",
      houseNo: "",
      moo: "",
      subdistrict: "",
      district: "",
      province: "",
      postalCode: "",
    })
    setOrder({
      productId: "",
      productName: "",
      riceId: "",
      riceType: "",
      subriceId: "",
      subriceName: "",
      riceYear: "",
      riceYearId: "",
      condition: "",
      conditionId: "",
      fieldType: "",
      fieldTypeId: "",
      program: "",
      paymentMethod: "",
      entryWeightKg: "",
      exitWeightKg: "",
      moisturePct: "",
      impurityPct: "",
      manualDeduct: false,
      deductWeightKg: "",
      unitPrice: "",
      amountTHB: "",
      issueDate: new Date().toISOString().slice(0, 10),
      branchName: "",
      branchId: null,
      klangName: "",
      klangId: null,
      registeredPlace: "",
      weighSlipNo: "",
      taxInvoiceNo: "",
      salesReceiptNo: "",
    })
    setRiceOptions([]); setSubriceOptions([]); setKlangOptions([])
  }

  /** ---------- UI ---------- */
  return (
    <div className="min-h-screen bg-white text-black dark:bg-slate-900 dark:text-white rounded-2xl text-[15px] md:text-base">
      <div className="mx-auto max-w-7xl p-5 md:p-6 lg:p-8">
        <h1 className="mb-4 text-3xl font-bold text-gray-900 dark:text-white">🧾 บันทึกออเดอร์ขายข้าวเปลือก</h1>

        {/* กล่องข้อมูลลูกค้า */}
        <div className="mb-6 rounded-2xl border border-slate-200 bg-white p-5 text-black shadow-sm dark:border-slate-700 dark:bg-slate-800 dark:text-white">
          <div className="mb-3 flex flex-wrap items-center gap-2">
            <h2 className="text-xl font-semibold">ข้อมูลลูกค้า</h2>
            {memberMeta.type === "member" ? (
              <span className="inline-flex items-center gap-2 rounded-full bg-emerald-50 px-3 py-1.5 text-emerald-700 ring-1 ring-emerald-200 dark:bg-emerald-900/20 dark:text-emerald-200 dark:ring-emerald-700/60">
                <span className="h-2 w-2 rounded-full bg-emerald-500" />
                สมาชิก • asso {memberMeta.assoId ?? "-"}
              </span>
            ) : customerFound === true && memberMeta.type === "customer" ? (
              <span className="inline-flex items-center gap-2 rounded-full bg-sky-50 px-3 py-1.5 text-sky-700 ring-1 ring-sky-200 dark:bg-sky-900/20 dark:text-sky-200 dark:ring-sky-700/60">
                <span className="h-2 w-2 rounded-full bg-sky-500" />
                ลูกค้าทั่วไป • asso {memberMeta.assoId ?? "-"}
              </span>
            ) : memberMeta.type === "customer" ? (
              <span className="inline-flex items-center gap-2 rounded-full bg-slate-100 px-3 py-1.5 text-slate-700 ring-1 ring-slate-200 dark:bg-slate-700/60 dark:text-slate-200 dark:ring-slate-600">
                <span className="h-2 w-2 rounded-full bg-slate-500" />
                ลูกค้าทั่วไป (จะสร้างอัตโนมัติเมื่อบันทึก)
              </span>
            ) : (
              <span className="inline-flex items-center gap-2 rounded-full bg-amber-50 px-3 py-1.5 text-amber-700 ring-1 ring-amber-200 dark:bg-amber-900/20 dark:text-amber-200 dark:ring-amber-700/60">
                <span className="h-2 w-2 rounded-full bg-amber-500" />
                โปรดกรอกชื่อหรือเลขบัตรประชาชนเพื่อระบุสถานะ
              </span>
            )}
          </div>

          {/* วิธีชำระเงิน + วันที่ (ย้ายขึ้นมาด้านบนให้เหมือนหน้า Buy) */}
          <div className="grid gap-4 md:grid-cols-3">
            <div>
              <label className={labelCls}>วิธีชำระเงิน (ไม่บังคับ)</label>
              <ComboBox
                options={paymentOptions}
                value={paymentOptions.find((o) => o.label === order.paymentMethod)?.id ?? ""}
                onChange={(_id, found) =>
                  setOrder((p) => ({ ...p, paymentMethod: found?.label ?? "" }))
                }
                placeholder="— เลือกวิธีชำระเงิน —"
                buttonRef={refs.payment}
              />
            </div>

            <div>
              <label className={labelCls}>ลงวันที่</label>
              <DateInput
                ref={refs.issueDate}
                value={order.issueDate}
                onChange={(e) => updateOrder("issueDate", e.target.value)}
                onFocus={() => clearHint("issueDate")}
                error={!!errors.issueDate}
                className={redHintCls("issueDate")}
                aria-invalid={errors.issueDate ? true : undefined}
              />
              {errors.issueDate && <p className={errorTextCls}>{errors.issueDate}</p>}
            </div>
          </div>

          {/* เลขบัตร + ชื่อค้นหา + ที่อยู่ */}
          <div className="mt-4 grid gap-4 md:grid-cols-3">
            <div className="md:col-span-1">
              <label className={labelCls}>เลขที่บัตรประชาชน (13 หลัก)</label>
              <input
                ref={refs.citizenId}
                inputMode="numeric"
                maxLength={13}
                className={cx(baseField, errors.citizenId && "border-amber-400")}
                value={customer.citizenId}
                onChange={(e) => updateCustomer("citizenId", onlyDigits(e.target.value))}
                onFocus={() => clearHint("citizenId")}
                placeholder="เช่น 1234567890123"
                aria-invalid={errors.citizenId ? true : undefined}
              />
              <div className={helpTextCls}>
                {loadingCustomer && "กำลังค้นหาลูกค้า..."}
                {customer.citizenId.length === 13 && !validateThaiCitizenId(customer.citizenId) && (
                  <span className="text-amber-600 dark:text-amber-300"> เลขบัตรอาจไม่ถูกต้อง</span>
                )}
                {customer.citizenId.length === 13 && customerFound === true && (
                  <span className="ml-1 text-emerald-600 dark:text-emerald-300">พบข้อมูลแล้ว ✅</span>
                )}
                {customer.citizenId.length === 13 && customerFound === false && (
                  <span className="ml-1 text-amber-600 dark:text-amber-300">ไม่พบบุคคลนี้ (จะบันทึกเป็นลูกค้าทั่วไป)</span>
                )}
              </div>
            </div>

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
                        onMouseEnter={() => { setHighlightedIndex(idx); requestAnimationFrame(() => scrollHighlightedIntoView2(idx)) }}
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
                            {r.type === "member" ? "สมาชิก" : "ลูกค้าทั่วไป"} • ปชช. {r.citizen_id ?? "-"}
                          </div>
                        </div>
                      </button>
                    )
                  })}
                </div>
              )}
            </div>

            {[ // ที่อยู่
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
                  className={cx(baseField, compactInput, errors.address && "border-amber-400", redHintCls(k))}
                  value={customer[k]}
                  onChange={(e) => updateCustomer(k, e.target.value)}
                  onFocus={() => clearHint(k)}
                  placeholder={ph}
                  aria-invalid={errors.address ? true : undefined}
                />
              </div>
            ))}

            <div>
              <label className={labelCls}>รหัสไปรษณีย์ (ไม่บังคับ)</label>
              <input
                ref={refs.postalCode}
                inputMode="numeric"
                maxLength={5}
                className={cx(baseField, compactInput)}
                value={customer.postalCode}
                onChange={(e) => updateCustomer("postalCode", onlyDigits(e.target.value))}
                onFocus={() => clearHint("postalCode")}
                placeholder="เช่น 40000"
              />
            </div>
          </div>
        </div>

        {/* ฟอร์มออเดอร์ */}
        <form
          onSubmit={handleSubmit}
          className="rounded-2xl border border-slate-200 bg-white p-5 text-black shadow-sm dark:border-slate-700 dark:bg-slate-800 dark:text-white"
        >
          <h2 className="mb-3 text-xl font-semibold">รายละเอียดการขาย</h2>

          {/* เลือกประเภท/ปี/โปรแกรม */}
          <div className="grid gap-4 md:grid-cols-3">
            {/* Product */}
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
                    riceId: "", riceType: "",
                    subriceId: "", subriceName: "",
                  }))
                }}
                placeholder="— เลือกประเภทสินค้า —"
                error={!!errors.product}
                hintRed={!!missingHints.product}
                clearHint={() => clearHint("product")}
                buttonRef={refs.product}
              />
              {errors.product && <p className={errorTextCls}>{errors.product}</p>}
            </div>

            {/* Rice */}
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
                    subriceId: "", subriceName: "",
                  }))
                }}
                placeholder="— เลือกชนิดข้าว —"
                disabled={!order.productId}
                error={!!errors.riceType}
                hintRed={!!missingHints.riceType}
                clearHint={() => clearHint("riceType")}
                buttonRef={refs.riceType}
              />
              {errors.riceType && <p className={errorTextCls}>{errors.riceType}</p>}
            </div>

            {/* Sub-rice */}
            <div>
              <label className={labelCls}>ชั้นย่อย (Sub-class)</label>
              <ComboBox
                options={subriceOptions}
                value={order.subriceId}
                onChange={(id, found) => {
                  setOrder((p) => ({ ...p, subriceId: id, subriceName: found?.label ?? "" }))
                }}
                placeholder="— เลือกชั้นย่อย —"
                disabled={!order.riceId}
                error={!!errors.subrice}
                hintRed={!!missingHints.subrice}
                clearHint={() => clearHint("subrice")}
                buttonRef={refs.subrice}
              />
              {errors.subrice && <p className={errorTextCls}>{errors.subrice}</p>}
            </div>

            {/* Condition */}
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
                  }))
                }
                placeholder="— เลือกสภาพ/เงื่อนไข —"
                error={!!errors.condition}
                hintRed={!!missingHints.condition}
                clearHint={() => clearHint("condition")}
                buttonRef={refs.condition}
              />
              {errors.condition && <p className={errorTextCls}>{errors.condition}</p>}
            </div>

            {/* Field type */}
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
                  }))
                }
                placeholder="— เลือกประเภทนา —"
                error={!!errors.fieldType}
                hintRed={!!missingHints.fieldType}
                clearHint={() => clearHint("fieldType")}
                buttonRef={refs.fieldType}
              />
              {errors.fieldType && <p className={errorTextCls}>{errors.fieldType}</p>}
            </div>

            {/* Year */}
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
                  }))
                }
                placeholder="— เลือกปี/ฤดูกาล —"
                error={!!errors.riceYear}
                hintRed={!!missingHints.riceYear}
                clearHint={() => clearHint("riceYear")}
                buttonRef={refs.riceYear}
              />
              {errors.riceYear && <p className={errorTextCls}>{errors.riceYear}</p>}
            </div>

            {/* (Optional) Program */}
            <div>
              <label className={labelCls}>โปรแกรม (ไม่บังคับ)</label>
              <ComboBox
                options={programOptions}
                value={programOptions.find((o) => o.label === order.program)?.id ?? ""}
                onChange={(_id, found) => setOrder((p) => ({ ...p, program: found?.label ?? "" }))}
                placeholder="— เลือกโปรแกรม —"
                buttonRef={refs.program}
              />
            </div>
          </div>

          {/* สาขา + คลัง */}
          <div className="mt-4 grid gap-4 md:grid-cols-3">
            <div>
              <label className={labelCls}>สาขา</label>
              <ComboBox
                options={branchOptions}
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
              />
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
              />
              {errors.klangName && <p className={errorTextCls}>{errors.klangName}</p>}
            </div>
          </div>

          {/* กรอบตัวเลขเหมือนหน้า Buy */}
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
                  onFocus={() => { clearHint("exitWeightKg"); clearError("exitWeightKg") }}
                  placeholder="เช่น 7000"
                  aria-invalid={errors.exitWeightKg ? true : undefined}
                />
                {errors.exitWeightKg && <p className={errorTextCls}>{errors.exitWeightKg}</p>}
              </div>

              <div>
                <label className={labelCls}>น้ำหนักจากตาชั่ง (กก.)</label>
                <input
                  disabled
                  className={cx(baseField, fieldDisabled)}
                  value={Math.round(grossFromScale * 100) / 100}
                />
                <p className={helpTextCls}>คำนวณจาก |หลังชั่ง − ก่อนชั่ง|</p>
              </div>

              <div>
                <label className={labelCls}>ความชื้น (%)</label>
                <input
                  ref={refs.moisturePct}
                  inputMode="decimal"
                  className={cx(baseField)}
                  value={order.moisturePct}
                  onChange={(e) => updateOrder("moisturePct", onlyDigits(e.target.value))}
                  onFocus={() => clearHint("moisturePct")}
                  placeholder="เช่น 18"
                />
                <p className={helpTextCls}>มาตรฐาน {MOISTURE_STD}% หากเกินจะถูกหักน้ำหนัก</p>
              </div>

              <div>
                <label className={labelCls}>สิ่งเจือปน (%)</label>
                <input
                  ref={refs.impurityPct}
                  inputMode="decimal"
                  className={cx(baseField)}
                  value={order.impurityPct}
                  onChange={(e) => updateOrder("impurityPct", onlyDigits(e.target.value))}
                  onFocus={() => clearHint("impurityPct")}
                  placeholder="เช่น 2"
                />
              </div>

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
                  placeholder="ระบบคำนวณให้ หรือกำหนดเอง"
                  aria-invalid={errors.deductWeightKg ? true : undefined}
                />
                {errors.deductWeightKg && <p className={errorTextCls}>{errors.deductWeightKg}</p>}
              </div>

              <div>
                <label className={labelCls}>น้ำหนักสุทธิ (กก.)</label>
                <input
                  disabled
                  className={cx(baseField, fieldDisabled)}
                  value={Math.round(netWeight * 100) / 100}
                />
              </div>

              <div>
                <label className={labelCls}>ราคาต่อกก. (บาท) (ไม่บังคับ)</label>
                <input
                  ref={refs.unitPrice}
                  inputMode="decimal"
                  className={baseField}
                  value={order.unitPrice}
                  onChange={(e) => updateOrder("unitPrice", e.target.value.replace(/[^\d.]/g, ""))}
                  onFocus={() => clearHint("unitPrice")}
                  placeholder="เช่น 12.50"
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
                  onChange={(e) => updateOrder("amountTHB", e.target.value.replace(/[^\d.]/g, ""))}
                  onFocus={() => { clearHint("amountTHB"); clearError("amountTHB") }}
                  placeholder="เช่น 60000"
                  aria-invalid={errors.amountTHB ? true : undefined}
                />
                {!!order.amountTHB && (
                  <p className={helpTextCls}>≈ {thb(Number(order.amountTHB))}</p>
                )}
                {errors.amountTHB && <p className={errorTextCls}>{errors.amountTHB}</p>}
              </div>
            </div>
          </div>

          {/* เอกสารการขาย */}
          <div className="mt-6 grid gap-4 md:grid-cols-3">
            <div>
              <label className={labelCls}>เลขที่ใบชั่ง</label>
              <input
                ref={refs.weighSlipNo}
                className={baseField}
                value={order.weighSlipNo}
                onChange={(e) => updateOrder("weighSlipNo", e.target.value)}
                placeholder="เช่น WS-2025-000123"
              />
            </div>

            <div>
              <label className={labelCls}>เลขที่ใบกำกับสินค้า (ขายเชื่อ)</label>
              <input
                ref={refs.taxInvoiceNo}
                className={baseField}
                value={order.taxInvoiceNo}
                onChange={(e) => updateOrder("taxInvoiceNo", e.target.value)}
                placeholder="เช่น INV-2025-000123"
              />
            </div>

            <div>
              <label className={labelCls}>ใบรับเงินขายสินค้า (ขายสด)</label>
              <input
                ref={refs.salesReceiptNo}
                className={baseField}
                value={order.salesReceiptNo}
                onChange={(e) => updateOrder("salesReceiptNo", e.target.value)}
                placeholder="เช่น RC-2025-000123"
              />
            </div>
          </div>

          {/* --- สรุป --- */}
          <div className="mt-6 grid gap-4 md:grid-cols-5">
            {[
              { label: "ลงวันที่", value: order.issueDate || "—" },
              { label: "วิธีชำระเงิน (UI)", value: order.paymentMethod || "—" },
              { label: "สินค้า", value: order.productName || "—" },
              { label: "ชนิดข้าว", value: order.riceType || "—" },
              { label: "ชั้นย่อย", value: order.subriceName || "—" },
              {
                label: "สาขา / คลัง",
                value: (
                  <ul className="list-disc pl-5">
                    <li>{order.branchName || "—"}</li>
                    {order.klangName && <li>{order.klangName}</li>}
                  </ul>
                ),
              },
              { label: "ก่อนชั่ง", value: (Math.round(toNumber(order.entryWeightKg) * 100) / 100) + " กก." },
              { label: "หลังชั่ง", value: (Math.round(toNumber(order.exitWeightKg) * 100) / 100) + " กก." },
              { label: "จากตาชั่ง", value: (Math.round(grossFromScale * 100) / 100) + " กก." },
              { label: "หัก (ความชื้น+สิ่งเจือปน)", value: (Math.round(toNumber(autoDeduct) * 100) / 100) + " กก." },
              { label: "สุทธิ", value: (Math.round(netWeight * 100) / 100) + " กก." },
              { label: "ปี/ฤดูกาล", value: order.riceYear || "—" },
              { label: "ประเภทนา", value: order.fieldType || "—" },
              { label: "เงื่อนไข", value: order.condition || "—" },
              { label: "โปรแกรม (UI)", value: order.program || "—" },
              { label: "เลขที่ใบชั่ง", value: order.weighSlipNo || "—" },
              { label: "ใบกำกับสินค้า(เชื่อ)", value: order.taxInvoiceNo || "—" },
              { label: "ใบรับเงิน(สด)", value: order.salesReceiptNo || "—" },
            ].map((c) => (
              <div
                key={c.label}
                className="rounded-2xl bg-white p-4 text-black shadow-sm ring-1 ring-slate-200 dark:bg-slate-800 dark:text-white dark:ring-slate-700"
              >
                <div className="text-slate-600 dark:text-slate-300">{c.label}</div>
                {typeof c.value === "string" ? (
                  <div className="text-lg md:text-xl font-semibold whitespace-pre-line">
                    {c.value}
                  </div>
                ) : (
                  <div className="text-lg md:text-xl font-semibold">{c.value}</div>
                )}
              </div>
            ))}
          </div>

          {/* ปุ่ม */}
          <div className="mt-6 flex flex-col gap-3 sm:flex-row">
            <button
              type="submit"
              className="inline-flex items-center justify-center rounded-2xl 
                         bg-emerald-600 px-6 py-3 text-base font-semibold text-white
                         shadow-[0_6px_16px_rgba(16,185,129,0.35)]
                         transition-all duration-300 ease-out
                         hover:bg-emerald-700 hover:shadow-[0_8px_20px_rgba(16,185,129,0.45)]
                         hover:scale-[1.05] active:scale-[.97] cursor-pointer"
            >
              บันทึกออเดอร์ขาย
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
        </form>
      </div>
    </div>
  )
}

export default Sales
