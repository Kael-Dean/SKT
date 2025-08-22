import { useEffect, useMemo, useRef, useState } from "react"

/** ---------- ENV ---------- */
const API_BASE = import.meta.env.VITE_API_BASE || ""

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

/** ---------- สไตล์ใหม่นุ่มตา/ชัดขึ้น ---------- */
/** พื้นฐานอินพุต: ใหญ่ขึ้น, คอนทราสต์ดีขึ้น, โค้งมากขึ้น */
const baseField =
  "w-full rounded-2xl border border-slate-300 bg-white p-3 text-[15px] md:text-base " +
  "text-black outline-none placeholder:text-slate-500 focus:border-emerald-600 focus:ring-2 focus:ring-emerald-500/30 shadow-none " +
  "dark:border-slate-500 dark:bg-slate-700 dark:text-slate-100 dark:placeholder:text-slate-300 dark:focus:border-emerald-400 dark:focus:ring-emerald-400/30"

/** ช่อง disabled: สีสว่าง อ่านง่าย */
const fieldDisabled =
  "bg-slate-100 text-slate-600 cursor-not-allowed opacity-95 dark:bg-slate-700/70 dark:text-slate-300"

/** ป้ายกำกับ & ข้อความช่วย */
const labelCls =
  "mb-1 block text-[15px] md:text-base font-medium text-slate-700 dark:text-slate-200"
const helpTextCls = "mt-1 text-sm text-slate-600 dark:text-slate-300"
const errorTextCls = "mt-1 text-sm text-red-500"

/** ---------- Reusable ComboBox (ตกแต่งให้เหมือน Order + อ่านง่ายขึ้น) ---------- */
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
      {/* ปุ่ม: ใหญ่ขึ้น คอนทราสต์ดีขึ้น */}
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
          disabled ? "bg-slate-100 cursor-not-allowed" : "bg-white hover:bg-slate-50",
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
        {selectedLabel || <span className="text-slate-500">{placeholder}</span>}
      </button>

      {/* รายการ */}
      {open && (
        <div
          ref={listRef}
          role="listbox"
          className="absolute z-20 mt-1 max-h-72 w-full overflow-auto rounded-2xl border border-slate-200 bg-white text-black shadow-lg dark:border-slate-700 dark:bg-slate-800 dark:text-white"
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
                  "relative flex w-full items-center gap-2 px-3 py-2.5 text-left text-[15px] md:text-base transition rounded-xl",
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

/** ---------- Component ---------- */
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
  const [riceOptions, setRiceOptions] = useState([])
  const [branchOptions, setBranchOptions] = useState([])
  const [klangOptions, setKlangOptions] = useState([])
  const [fieldTypeOptions, setFieldTypeOptions] = useState([]) // <<<< ใหม่: ประเภทนา

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

  /** เมตาสมาชิก */
  const [memberMeta, setMemberMeta] = useState({
    type: "unknown",
    memberId: null,
    memberPk: null,
  })

  /** ฟอร์มออเดอร์ */
  const [order, setOrder] = useState({
    riceType: "",
    riceId: "",
    moisturePct: "",
    impurityPct: "",
    grossWeightKg: "",
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
    // >>> ฟิลด์ใหม่
    gram: "",        // คุณภาพข้าว
    season: "",      // ปี
    fieldType: "",   // นา (string)
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
    riceType: useRef(null),
    branchName: useRef(null),
    klangName: useRef(null),
    moisturePct: useRef(null),
    impurityPct: useRef(null),
    grossWeightKg: useRef(null),
    deductWeightKg: useRef(null),
    unitPrice: useRef(null),
    amountTHB: useRef(null),
    paymentRefNo: useRef(null),
    issueDate: useRef(null),
    gram: useRef(null),
    season: useRef(null),
    fieldType: useRef(null),
  }

  /** debounce */
  const debouncedCitizenId = useDebounce(customer.citizenId)
  const debouncedFullName  = useDebounce(customer.fullName)

  /** API header */
  const authHeader = () => {
    const token = localStorage.getItem("token")
    return {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    }
  }

  /** helper: ลองเรียกหลาย endpoint จนกว่าจะเจอที่ใช้ได้ */
  const fetchFirstOkJson = async (paths = []) => {
    for (const p of paths) {
      try {
        const r = await fetch(`${API_BASE}${p}`, { headers: authHeader() })
        if (r.ok) {
          const data = await r.json()
          if (Array.isArray(data)) return data
        }
      } catch (_) {}
    }
    return []
  }

  /** โหลด dropdown */
  useEffect(() => {
    const loadDD = async () => {
      try {
        const [riceRes, branchRes] = await Promise.allSettled([
          fetch(`${API_BASE}/order/rice/search`,   { headers: authHeader() }),
          fetch(`${API_BASE}/order/branch/search`, { headers: authHeader() }),
          fetch(`${API_BASE}/order/field_type/list`, { headers: authHeader() }),  
        ])

        // rice
        if (riceRes.status === "fulfilled" && riceRes.value.ok) { 
          const riceRaw = await riceRes.value.json()
          const rice = (riceRaw || []).map((x) => ({
            id: String(x.id ?? x.rice_id ?? x.riceId ?? ""),
            label: x.rice_type ?? x.rice_name ?? x.name ?? "",
          }))
          setRiceOptions(rice)
        } else {
          console.error("rice/search failed:", riceRes)
          setRiceOptions([])
        }

        // branch
        if (branchRes.status === "fulfilled" && branchRes.value.ok) {
          const branch = await branchRes.value.json()
          setBranchOptions(branch || [])
        } else {
          console.error("branch/search failed:", branchRes)
          setBranchOptions([])
        }

        // field types
        const ftRaw = await fetchFirstOkJson([
          "/order/field-type/list",
          "/order/field_type/list",
          "/order/field-types",
          "/order/field_type/search",
          "/order/fieldtype/search",
          "/order/fieldtype/list",
          "/order/fieldTypes",
          "/order/field_types",
        ])
        const ftMapped = (ftRaw || []).map((x, i) => {
          const id = x.id ?? x.field_type_id ?? x.value ?? i
          const label = x.field_type ?? x.name ?? x.label ?? (typeof x === "string" ? x : "")
          return { id: String(id), label: String(label).trim() }
        }).filter((o) => o.label)
        setFieldTypeOptions(ftMapped)
      } catch (err) {
        console.error("loadDD fatal:", err)
        setRiceOptions([])
        setBranchOptions([])
        setFieldTypeOptions([])
      }
    }
    loadDD()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])


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
        const r = await fetch(`${API_BASE}/order/klang/search?${qs}`, { headers: authHeader() })
        if (!r.ok) { console.error("Load klang failed:", r.status, await r.text()); setKlangOptions([]); return }
        const data = await r.json()
        setKlangOptions(data || [])
      } catch (e) { console.error("Load klang error:", e); setKlangOptions([]) }
    }
    loadKlang()
  }, [order.branchId, order.branchName])

  /** map member -> UI */
  const mapMemberToUI = (m = {}) => ({
    citizenId: (m.citizen_id ?? m.citizenId ?? "").toString(),
    fullName: `${m.first_name ?? ""} ${m.last_name ?? ""}`.trim() || m.fullName || "",
    houseNo: m.address ?? m.houseNo ?? "",
    moo: m.mhoo ?? m.moo ?? "",
    subdistrict: m.sub_district ?? m.subdistrict ?? "",
    district: m.district ?? "",
    province: m.province ?? "",
    postalCode: m.postal_code ?? m.postalCode ?? "",
    memberId: m.member_id ?? null,
    memberPk: m.id ?? null,
  })

  const fillFromMemberRecord = (raw = {}) => {
    const data = mapMemberToUI(raw)
    setCustomer((prev) => ({
      ...prev,
      citizenId: onlyDigits(data.citizenId || prev.citizenId),
      fullName: data.fullName || prev.fullName,
      houseNo: data.houseNo || "",
      moo: data.moo || "",
      subdistrict: data.subdistrict || "",
      district: data.district || "",
      province: data.province || "",
      postalCode: data.postalCode || "",
    }))
    if (data.memberId) {
      setMemberMeta({ type: "member", memberId: data.memberId, memberPk: data.memberPk })
      setCustomerFound(true)
    } else {
      setMemberMeta({ type: "guest", memberId: null, memberPk: null })
      setCustomerFound(true)
    }
  }

  /** ค้นหาด้วยเลขบัตร */
  useEffect(() => {
    const cid = onlyDigits(debouncedCitizenId)
    if (cid.length !== 13) {
      setCustomerFound(null)
      setMemberMeta((m) => (m.type === "member" ? m : { type: "unknown", memberId: null, memberPk: null }))
      return
    }
    const fetchByCid = async () => {
      try {
        setLoadingCustomer(true)
        const url = `${API_BASE}/member/members/search?q=${encodeURIComponent(cid)}`
        const res = await fetch(url, { headers: authHeader() })
        if (!res.ok) throw new Error("search failed")
        const arr = (await res.json()) || []
        const exact = arr.find((r) => onlyDigits(r.citizen_id || r.citizenId || "") === cid) || arr[0]
        if (exact) fillFromMemberRecord(exact)
        else {
          setCustomerFound(false)
          setMemberMeta({ type: "guest", memberId: null, memberPk: null })
        }
      } catch (e) {
        console.error(e)
        setCustomerFound(false)
        setMemberMeta({ type: "guest", memberId: null, memberPk: null })
      } finally {
        setLoadingCustomer(false)
      }
    }
    fetchByCid()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedCitizenId])

  /** ค้นหาด้วยชื่อ */
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
      setMemberMeta((m) => (m.type === "member" ? m : { type: "unknown", memberId: null, memberPk: null }))
      return
    }

    const searchByName = async () => {
      try {
        setLoadingCustomer(true)
        const url = `${API_BASE}/member/members/search?q=${encodeURIComponent(q)}`
        const res = await fetch(url, { headers: authHeader() })
        if (!res.ok) throw new Error("search failed")
        const items = (await res.json()) || []
        const mapped = items.map((r) => ({
          id: r.id,
          citizenId: r.citizen_id || r.citizenId,
          first_name: r.first_name,
          last_name: r.last_name,
          address: r.address,
          mhoo: r.mhoo,
          sub_district: r.sub_district,
          district: r.district,
          province: r.province,
          postal_code: r.postal_code,
          member_id: r.member_id,
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

  const pickNameResult = (rec) => {
    suppressNameSearchRef.current = true
    fillFromMemberRecord(rec)
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

  /** ---- ช่วยจัดการสีแดงเฉพาะ 3 ช่อง ---- */
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

  /** คีย์บอร์ดนำทาง dropdown */
  const handleNameKeyDown = (e) => {
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
        pickNameResult(nameResults[highlightedIndex])
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

  /** ---------- Auto calc ---------- */
  const autoDeduct = useMemo(() => {
    if (order.manualDeduct) return toNumber(order.deductWeightKg)
    return suggestDeductionWeight(order.grossWeightKg, order.moisturePct, order.impurityPct)
  }, [order.manualDeduct, order.deductWeightKg, order.grossWeightKg, order.moisturePct, order.impurityPct])

  const netWeight = useMemo(() => {
    const n = toNumber(order.grossWeightKg) - toNumber(autoDeduct)
    return n > 0 ? n : 0
  }, [order.grossWeightKg, autoDeduct])

  const computedAmount = useMemo(() => {
    if (order.unitPrice === "" || isNaN(Number(order.unitPrice))) return null
    return netWeight * Number(order.unitPrice)
  }, [netWeight, order.unitPrice])

  useEffect(() => {
    if (computedAmount !== null) {
      setOrder((prev) => ({ ...prev, amountTHB: String(Math.round(computedAmount * 100) / 100) }))
    }
  }, [computedAmount])

  /** auto-fill ราคา เฉพาะกรณี rice มี price แนบมา */
  useEffect(() => {
    if (!order.riceId) return
    const found = riceOptions.find((r) => r.id === order.riceId)
    if (found?.price != null) {
      setOrder((p) => ({ ...p, unitPrice: String(found.price) }))
    }
  }, [order.riceId, riceOptions])

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
    // ออเดอร์
    if (!order.riceId) m.riceType = true
    if (!order.branchName) m.branchName = true
    if (!order.klangName) m.klangName = true
    if (!order.grossWeightKg || Number(order.grossWeightKg) <= 0) m.grossWeightKg = true
    if (order.manualDeduct && (order.deductWeightKg === "" || Number(order.deductWeightKg) < 0)) m.deductWeightKg = true
    if (!order.amountTHB || Number(order.amountTHB) < 0) m.amountTHB = true
    if (!order.issueDate) m.issueDate = true
    // if (!order.fieldType) m.fieldType = true  // ถ้าต้องการบังคับ
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

    if (!order.riceId) e.riceType = "เลือกชนิดข้าวเปลือก"
    if (!order.branchName) e.branchName = "เลือกสาขา"
    if (!order.klangName) e.klangName = "เลือกคลัง"
    if (!order.grossWeightKg || Number(order.grossWeightKg) <= 0) e.grossWeightKg = "กรอกน้ำหนักตามใบชั่ง"
    if (order.manualDeduct && (order.deductWeightKg === "" || Number(order.deductWeightKg) < 0))
      e.deductWeightKg = "กรอกน้ำหนักหักให้ถูกต้อง"
    if (!order.amountTHB || Number(order.amountTHB) < 0) e.amountTHB = "กรอกจำนวนเงินให้ถูกต้อง"
    if (!order.issueDate) e.issueDate = "กรุณาเลือกวันที่"
    // if (!order.fieldType) e.fieldType = "เลือกประเภทนา"
    setErrors(e)
    return e
  }

  const scrollToFirstError = (eObj) => {
    const orderKeys = [
      "fullName",
      "address",
      "riceType",
      "branchName",
      "klangName",
      "grossWeightKg",
      "deductWeightKg",
      "amountTHB",
      "issueDate",
      // "fieldType",
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

    // 1) แสดง hint แดงทุกช่องที่ยังว่าง
    const hints = computeMissingHints()
    setMissingHints(hints)

    // 2) วาลิเดต
    const eObj = validateAll()
    if (Object.keys(eObj).length > 0) {
      scrollToFirstError(eObj)
      return
    }

    const [firstName, ...rest] = customer.fullName.trim().split(" ")
    const lastName = rest.join(" ")

    const riceId  = /^\d+$/.test(order.riceId) ? Number(order.riceId) : null
    const branchId = order.branchId ?? null
    const klangId  = order.klangId ?? null

    if (!riceId)   { setErrors((prev) => ({ ...prev, riceType: "ไม่พบรหัสชนิดข้าว โปรดเลือกใหม่" })); setMissingHints((p)=>({ ...p, riceType:true })); scrollToFirstError({ riceType: true }); return }
    if (!branchId) { setErrors((prev) => ({ ...prev, branchName: "ไม่พบรหัสสาขา โปรดเลือกใหม่" })); setMissingHints((p)=>({ ...p, branchName:true })); scrollToFirstError({ branchName: true }); return }
    if (!klangId)  { setErrors((prev) => ({ ...prev, klangName: "ไม่พบรหัสคลัง โปรดเลือกใหม่" })); setMissingHints((p)=>({ ...p, klangName:true })); scrollToFirstError({ klangName: true }); return }

    const baseHeaders = authHeader()
    let customer_id = memberMeta.memberPk ?? null

    if (!customer_id) {
      try {
        const upsertRes = await fetch(`${API_BASE}/order/customer/upsert`, {
          method: "POST",
          headers: baseHeaders,
          body: JSON.stringify({
            first_name: firstName || "",
            last_name: lastName || "",
            citizen_id: onlyDigits(customer.citizenId),
            address: customer.houseNo.trim(),
            mhoo: customer.moo.trim(),
            sub_district: customer.subdistrict.trim(),
            district: customer.district.trim(),
            province: customer.province.trim(),
            postal_code: customer.postalCode?.toString().trim() || "",
          }),
        })
        if (upsertRes.ok) {
          const u = await upsertRes.json()
          customer_id = u?.id ?? u?.customer_id ?? null
        }
      } catch {}
    }

    if (!customer_id) {
      alert("ไม่พบ/ไม่สามารถสร้างรหัสลูกค้า (customer_id) โปรดเลือกจากรายชื่อสมาชิกหรือให้หลังบ้านเปิด endpoint upsert ลูกค้า")
      return
    }

    const netW = toNumber(order.grossWeightKg) - toNumber(
      order.manualDeduct
        ? order.deductWeightKg
        : suggestDeductionWeight(order.grossWeightKg, order.moisturePct, order.impurityPct)
    )

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
        customer_id,
        rice_id: riceId,
        branch_location: branchId,
        klang_location: klangId,
        humidity: Number(order.moisturePct || 0),
        weight: netW > 0 ? netW : 0,
        price: Number(order.amountTHB),
        impurity: Number(order.impurityPct || 0),
        order_serial: order.paymentRefNo.trim(),
        date: new Date(`${order.issueDate}T00:00:00.000Z`).toISOString(),
        // >>> ฟิลด์ใหม่
        gram: Number(order.gram || 0),
        season: Number(order.season || 0),
        field_type: (order.fieldType || "").trim(),
        price_per_kilo: Number(order.unitPrice || 0),
      },
      rice:   { rice_type: order.riceType, id: riceId },
      branch: { branch_name: order.branchName, id: branchId },
      klang:  { klang_name: order.klangName,  id: klangId },
      customerMeta: {
        type: memberMeta.type === "unknown" ? "guest" : memberMeta.type,
        memberId: memberMeta.memberId,
        memberPk: memberMeta.memberPk,
      },
    }

    try {
      const res = await fetch(`${API_BASE}/order/customers/save`, {
        method: "POST",
        headers: baseHeaders,
        body: JSON.stringify(payload),
      })
      if (!res.ok) {
        const t = await res.text()
        throw new Error(t || "ไม่สามารถบันทึกออเดอร์ได้")
      }
      alert("บันทึกออเดอร์เรียบร้อย ✅")
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
    setMemberMeta({ type: "unknown", memberId: null, memberPk: null })
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
      riceType: "",
      riceId: "",
      moisturePct: "",
      impurityPct: "",
      grossWeightKg: "",
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
      gram: "",
      season: "",
      fieldType: "",
    })
  }

  /** ---------- UI ---------- */
  return (
    <div className="min-h-screen bg-white text-black dark:bg-slate-900 dark:text-white rounded-2xl text-[15px] md:text-base">
      <div className="mx-auto max-w-7xl p-5 md:p-6 lg:p-8">
        <h1 className="mb-4 text-3xl font-bold text-gray-900 dark:text-white">🧾 บันทึกออเดอร์ซื้อข้าวเปลือก</h1>

        {/* กล่องข้อมูลลูกค้า */}
        <div className="mb-6 rounded-2xl border border-slate-200 bg-white p-5 text-black shadow-sm dark:border-slate-700 dark:bg-slate-800 dark:text-white">
          <div className="mb-3 flex flex-wrap items-center gap-2">
            <h2 className="text-xl font-semibold">ข้อมูลลูกค้า</h2>
            {memberMeta.type === "member" ? (
              <span className="inline-flex items-center gap-2 rounded-full bg-emerald-50 px-3 py-1.5 text-emerald-700 ring-1 ring-emerald-200 dark:bg-emerald-900/20 dark:text-emerald-200 dark:ring-emerald-700/60">
                <span className="h-2 w-2 rounded-full bg-emerald-500" />
                สมาชิก • รหัสสมาชิก {memberMeta.memberId ?? "-"}
              </span>
            ) : memberMeta.type === "guest" ? (
              <span className="inline-flex items-center gap-2 rounded-full bg-slate-100 px-3 py-1.5 text-slate-700 ring-1 ring-slate-200 dark:bg-slate-700/60 dark:text-slate-200 dark:ring-slate-600">
                <span className="h-2 w-2 rounded-full bg-slate-500" />
                ลูกค้าทั่วไป (ไม่พบในระบบสมาชิก)
              </span>
            ) : (
              <span className="inline-flex items-center gap-2 rounded-full bg-amber-50 px-3 py-1.5 text-amber-700 ring-1 ring-amber-200 dark:bg-amber-900/20 dark:text-amber-200 dark:ring-amber-700/60">
                <span className="h-2 w-2 rounded-full bg-amber-500" />
                โปรดกรอกชื่อหรือเลขบัตรประชาชนเพื่อระบุสถานะ
              </span>
            )}
          </div>

          <div className="grid gap-4 md:grid-cols-3">
            {/* เลขบัตร (ไม่บังคับ) */}
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
                  <span className="ml-1 text-emerald-600 dark:text-emerald-300">พบข้อมูลลูกค้าแล้ว ✅</span>
                )}
                {customer.citizenId.length === 13 && customerFound === false && (
                  <span className="ml-1 text-amber-600 dark:text-amber-300">ไม่พบบุคคลนี้ในระบบ (ลูกค้าทั่วไป)</span>
                )}
              </div>
            </div>

            {/* ชื่อ–สกุล + รายการค้นหา */}
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
                    return (
                      <button
                        type="button"
                        ref={(el) => (itemRefs.current[idx] = el)}
                        key={r.id || `${r.citizenId}-${r.first_name}-${r.last_name}`}
                        onClick={() => pickNameResult(r)}
                        onMouseEnter={() => { setHighlightedIndex(idx); requestAnimationFrame(() => scrollHighlightedIntoView2(idx)) }}
                        role="option"
                        aria-selected={isActive}
                        className={cx(
                          "relative flex w-full items-start gap-3 px-3 py-2.5 text-left transition rounded-xl",
                          isActive
                            ? "bg-emerald-100 ring-1 ring-emerald-300 dark:bg-emerald-400/20 dark:ring-emerald-500"
                            : "hover:bg-emerald-50 dark:hover:bg-emerald-900/30"
                        )}
                      >
                        {isActive && (
                          <span className="absolute left-0 top-0 h-full w-1 bg-emerald-600 dark:bg-emerald-400/70 rounded-l-xl" />
                        )}
                        <div className="flex-1">
                          <div className="font-medium">{`${r.first_name ?? ""} ${r.last_name ?? ""}`.trim()}</div>
                          <div className="text-sm text-slate-600 dark:text-slate-300">
                            ปชช. {r.citizenId} • {r.address ? `บ้าน ${r.address}` : ""} {r.mhoo ? `หมู่ ${r.mhoo}` : ""}
                            {r.sub_district ? ` • ต.${r.sub_district}` : ""}{r.district ? ` อ.${r.district}` : ""} {r.province ? ` จ.${r.province}` : ""} {r.postal_code ? ` ${r.postal_code}` : ""}{r.member_id ? " • สมาชิก" : ""}
                          </div>
                        </div>
                      </button>
                    )
                  })}
                </div>
              )}
            </div>

            {/* ที่อยู่ */}
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
                  className={cx(baseField, errors.address && "border-amber-400", redHintCls(k))}
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
                className={baseField}
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
          <h2 className="mb-3 text-xl font-semibold">รายละเอียดการซื้อ</h2>

          <div className="grid gap-4 md:grid-cols-3">
            {/* ชนิดข้าว */}
            <div>
              <label className={labelCls}>ชนิดข้าวเปลือก</label>
              <ComboBox
                options={riceOptions}
                value={order.riceId}
                onChange={(id, found) => {
                  setOrder((p) => ({
                    ...p,
                    riceId: id,
                    riceType: found?.label ?? "",
                  }))
                }}
                placeholder="— เลือกชนิด —"
                error={!!errors.riceType}
                hintRed={!!missingHints.riceType}
                clearHint={() => clearHint("riceType")}
                buttonRef={refs.riceType}
              />
              {errors.riceType && <p className={errorTextCls}>{errors.riceType}</p>}
            </div>

            {/* สาขา */}
            <div>
              <label className={labelCls}>สาขา</label>
              <ComboBox
                options={branchOptions.map((b) => ({ id: b.id, label: b.branch_name }))}
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

            {/* คลัง */}
            <div>
              <label className={labelCls}>คลัง</label>
              <ComboBox
                options={klangOptions.map((k) => ({ id: k.id, label: k.klang_name }))}
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

            {/* ความชื้น/สิ่งเจือปน/น้ำหนัก */}
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

            {/* น้ำหนักตามใบชั่ง */}
            <div>
              <label className={labelCls}>น้ำหนักตามใบชั่ง (กก.)</label>
              <input
                ref={refs.grossWeightKg}
                inputMode="decimal"
                className={cx(baseField, redFieldCls("grossWeightKg"))}
                value={order.grossWeightKg}
                onChange={(e) => updateOrder("grossWeightKg", e.target.value.replace(/[^\d.]/g, ""))}
                onFocus={() => { clearHint("grossWeightKg"); clearError("grossWeightKg") }}
                placeholder="เช่น 5000"
                aria-invalid={errors.grossWeightKg ? true : undefined}
              />
              {errors.grossWeightKg && <p className={errorTextCls}>{errors.grossWeightKg}</p>}
            </div>

            {/* หักน้ำหนัก */}
            <div className="md:col-span-2">
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
                    : String(Math.round(suggestDeductionWeight(order.grossWeightKg, order.moisturePct, order.impurityPct) * 100) / 100)
                }
                onChange={(e) => updateOrder("deductWeightKg", e.target.value.replace(/[^\d.]/g, ""))}
                onFocus={() => clearHint("deductWeightKg")}
                placeholder="ระบบคำนวณให้ หรือกำหนดเอง"
                aria-invalid={errors.deductWeightKg ? true : undefined}
              />
              {errors.deductWeightKg && <p className={errorTextCls}>{errors.deductWeightKg}</p>}
            </div>

            {/* สุทธิ */}
            <div>
              <label className={labelCls}>น้ำหนักสุทธิ (กก.)</label>
              <input
                disabled
                className={cx(baseField, fieldDisabled)}
                value={Math.round((toNumber(order.grossWeightKg) - toNumber(order.manualDeduct ? order.deductWeightKg : suggestDeductionWeight(order.grossWeightKg, order.moisturePct, order.impurityPct))) * 100) / 100}
              />
            </div>

            {/* --- ฟิลด์ใหม่: gram/season/field_type --- */}
            <div>
              <label className={labelCls}>คุณภาพข้าว (gram)</label>
              <input
                ref={refs.gram}
                inputMode="numeric"
                className={baseField}
                value={order.gram}
                onChange={(e) => updateOrder("gram", onlyDigits(e.target.value))}
                placeholder="เช่น 85"
              />
            </div>

            <div>
              <label className={labelCls}>ฤดูกาล/ปี (season)</label>
              <input
                ref={refs.season}
                inputMode="numeric"
                className={baseField}
                value={order.season}
                onChange={(e) => updateOrder("season", onlyDigits(e.target.value))}
                placeholder="เช่น 2025"
              />
            </div>

            {/* เปลี่ยนเป็น ComboBox */}
            <div>
              <label className={labelCls}>ประเภทนา (field_type)</label>
              <ComboBox
                options={fieldTypeOptions}
                value={
                  fieldTypeOptions.find((o) => o.label === order.fieldType)?.id ?? ""
                }
                getValue={(o) => o.id}
                onChange={(_id, found) => {
                  setOrder((p) => ({ ...p, fieldType: found?.label ?? "" }))
                }}
                placeholder="— เลือกประเภทนา —"
                clearHint={() => clearHint("fieldType")}
                buttonRef={refs.fieldType}
              />
            </div>

            {/* ราคา/เป็นเงิน/เลขอ้างอิง/ลงวันที่ */}
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

            <div>
              <label className={labelCls}>เลขที่ใบสำคัญจ่ายเงิน</label>
              <input
                ref={refs.paymentRefNo}
                className={baseField}
                value={order.paymentRefNo}
                onChange={(e) => updateOrder("paymentRefNo", e.target.value)}
                onFocus={() => clearHint("paymentRefNo")}
                placeholder="เช่น A-2025-000123"
              />
            </div>

            <div>
              <label className={labelCls}>ลงวันที่</label>
              <input
                ref={refs.issueDate}
                type="date"
                className={cx(baseField, errors.issueDate && "border-red-400", redHintCls("issueDate"))}
                value={order.issueDate}
                onChange={(e) => updateOrder("issueDate", e.target.value)}
                onFocus={() => clearHint("issueDate")}
                aria-invalid={errors.issueDate ? true : undefined}
              />
              {errors.issueDate && <p className={errorTextCls}>{errors.issueDate}</p>}
            </div>
          </div>

          {/* --- สรุป --- */}
          <div className="mt-6 grid gap-4 md:grid-cols-5">
            {[
              { label: "ชนิดข้าว", value: order.riceType || "—" },

              // ⬇️ แก้ให้สาขา/คลังเป็น list มีจุดนำหน้า
              {
                label: "สาขา / คลัง",
                value: (
                  <ul className="list-disc pl-5">
                    <li>{order.branchName || "—"}</li>
                    {order.klangName && <li>{order.klangName}</li>}
                  </ul>
                ),
              },

              {
                label: "น้ำหนักสุทธิ",
                value:
                  (Math.round(
                    (toNumber(order.grossWeightKg) -
                      toNumber(
                        order.manualDeduct
                          ? order.deductWeightKg
                          : suggestDeductionWeight(
                              order.grossWeightKg,
                              order.moisturePct,
                              order.impurityPct
                            )
                      )) * 100
                  ) / 100) + " กก.",
              },
              { label: "คุณภาพ (gram)", value: order.gram || "—" },
              { label: "ฤดูกาล/ปี", value: order.season || "—" },
            ].map((c) => (
              <div
                key={c.label}
                className="rounded-2xl bg-white p-4 text-black shadow-sm ring-1 ring-slate-200 dark:bg-slate-800 dark:text-white dark:ring-slate-700"
              >
                <div className="text-slate-600 dark:text-slate-300">{c.label}</div>

                {/* ✅ รองรับทั้ง string และ JSX */}
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
              className="inline-flex items-center justify-center rounded-2xl bg-emerald-600 px-6 py-3 text-base font-semibold text-white shadow-[0_6px_16px_rgba(16,185,129,0.35)] hover:bg-emerald-700 active:scale-[.98]"
            >
              บันทึกออเดอร์
            </button>
            <button
              type="button"
              onClick={handleReset}
              className="inline-flex items-center justify-center rounded-2xl border border-slate-300 bg-white px-6 py-3 text-base font-medium text-slate-700 hover:bg-slate-50 active:scale-[.98] dark:border-slate-600 dark:bg-slate-700/60 dark:text-white dark:hover:bg-slate-700/50 shadow-none"
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
