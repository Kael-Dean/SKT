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

/** ---------- Reusable ComboBox (สไตล์เดียวกับช่องในหน้า Order) ---------- */
function ComboBox({
  options = [],
  value,
  onChange, // (newValue, optionObj) => void
  placeholder = "— เลือก —",
  getLabel = (o) => o?.label ?? "",
  getValue = (o) => o?.value ?? o?.id ?? "",
  disabled = false,
  error = false,
}) {
  const [open, setOpen] = useState(false)
  const [highlight, setHighlight] = useState(-1)
  const boxRef = useRef(null)
  const listRef = useRef(null)
  const btnRef = useRef(null)

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
    requestAnimationFrame(() => btnRef.current?.focus())
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
        ref={btnRef}
        disabled={disabled}
        onClick={() => !disabled && setOpen((o) => !o)}
        onKeyDown={onKeyDown}
        className={`w-full rounded-xl border p-2 text-left outline-none transition ${
          disabled ? "bg-slate-100 cursor-not-allowed" : "bg-white hover:bg-slate-50"
        } ${error ? "border-red-400" : "border-slate-300 focus:border-emerald-500"} dark:border-slate-600 dark:bg-slate-700 dark:text-white`}
        aria-haspopup="listbox"
        aria-expanded={open}
      >
        {selectedLabel || <span className="text-slate-400">{placeholder}</span>}
      </button>

      {open && (
        <div
          ref={listRef}
          role="listbox"
          className="absolute z-20 mt-1 max-h-60 w-full overflow-auto rounded-xl border border-slate-200 bg-white text-black shadow dark:border-slate-700 dark:bg-slate-800 dark:text-white"
        >
          {options.length === 0 && (
            <div className="px-3 py-2 text-sm text-slate-500 dark:text-slate-300">ไม่มีตัวเลือก</div>
          )}
          {options.map((opt, idx) => {
            const label = getLabel(opt)
            const isActive = idx === highlight
            return (
              <button
                key={String(getValue(opt)) || label || idx}
                type="button"
                role="option"
                aria-selected={String(getValue(opt)) === String(value)}
                onMouseEnter={() => setHighlight(idx)}
                onClick={() => commit(opt)}
                className={`flex w-full items-center gap-2 px-3 py-2 text-left text-sm ${
                  isActive ? "bg-emerald-50" : "hover:bg-emerald-50"
                } dark:hover:bg-emerald-900/30 dark:text-white`}
              >
                <span className="flex-1">{label}</span>
                {String(getValue(opt)) === String(value) && (
                  <span className="text-emerald-600 dark:text-emerald-400">✓</span>
                )}
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
  /** สถานะค้นหาลูกค้า + dropdown ค้นหาชื่อ */
  const [loadingCustomer, setLoadingCustomer] = useState(false)
  const [customerFound, setCustomerFound] = useState(null) // true | false | null
  const [errors, setErrors] = useState({})
  const [nameResults, setNameResults] = useState([])
  const [showNameList, setShowNameList] = useState(false)

  const nameBoxRef = useRef(null)
  const nameInputRef = useRef(null)
  const suppressNameSearchRef = useRef(false)

  const [highlightedIndex, setHighlightedIndex] = useState(-1)
  const listContainerRef = useRef(null)
  const itemRefs = useRef([])

  /** dropdown: ชนิดข้าว/สาขา/คลัง */
  const [riceOptions, setRiceOptions] = useState([]) // {id,label,price,_raw}
  const [branchOptions, setBranchOptions] = useState([]) // [{id, branch_name}]
  const [klangOptions, setKlangOptions] = useState([])   // [{id, klang_name}]

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

  /** เมตาสถานะสมาชิก/ลูกค้าทั่วไป */
  const [memberMeta, setMemberMeta] = useState({
    type: "unknown", // "member" | "guest" | "unknown"
    memberId: null,  // member_id จากตารางสมาชิก
    memberPk: null,  // id (PK) จากตารางสมาชิก
  })

  /** ฟอร์มออเดอร์ */
  const [order, setOrder] = useState({
    riceType: "",
    riceId: "", // string
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
  })

  /** debounce ค้นหา */
  const debouncedCitizenId = useDebounce(customer.citizenId)
  const debouncedFullName  = useDebounce(customer.fullName)

  /** ---------- API Helpers ---------- */
  const authHeader = () => {
    const token = localStorage.getItem("token")
    return {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    }
  }

  /** โหลด dropdown ชนิดข้าว + สาขา */
  useEffect(() => {
    const loadDD = async () => {
      try {
        const [r1, r2] = await Promise.all([
          fetch(`${API_BASE}/order/rice/search`, { headers: authHeader() }),
          fetch(`${API_BASE}/order/branch/search`, { headers: authHeader() }),
        ])

        const riceRaw = r1.ok ? await r1.json() : []
        const branch  = r2.ok ? await r2.json() : []

        const rice = (riceRaw || []).map((x) => ({
          id: String(x.id ?? x.rice_id ?? x.riceId ?? ""),
          label: x.rice_type ?? x.rice_name ?? x.name ?? "",
          price: x.price ?? x.unit_price ?? undefined,
          _raw: x,
        }))

        setRiceOptions(rice)
        setBranchOptions(branch || [])
      } catch (e) {
        console.error("Load dropdowns error:", e)
      }
    }
    loadDD()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  /** โหลด “คลัง” ตามสาขา */
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
        if (!r.ok) {
          console.error("Load klang failed:", r.status, await r.text())
          setKlangOptions([])
          return
        }
        const data = await r.json()
        setKlangOptions(data || [])
      } catch (e) {
        console.error("Load klang error:", e)
        setKlangOptions([])
      }
    }
    loadKlang()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [order.branchId, order.branchName])

  /** ---------- map record สมาชิก -> UI ---------- */
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

  /** ---------- ค้นหาด้วยเลขบัตร ---------- */
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

  /** ---------- ค้นหาด้วยชื่อ (dropdown) ---------- */
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

  /** ---------- เลื่อนให้รายการที่ไฮไลต์อยู่เข้าวิว ---------- */
  const scrollHighlightedIntoView = (index) => {
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

  /** ---------- คีย์บอร์ดนำทาง dropdown ---------- */
  const handleNameKeyDown = (e) => {
    if (!showNameList || nameResults.length === 0) return

    if (e.key === "ArrowDown") {
      e.preventDefault()
      const next = highlightedIndex < nameResults.length - 1 ? highlightedIndex + 1 : 0
      setHighlightedIndex(next)
      requestAnimationFrame(() => scrollHighlightedIntoView(next))
    } else if (e.key === "ArrowUp") {
      e.preventDefault()
      const prev = highlightedIndex > 0 ? highlightedIndex - 1 : nameResults.length - 1
      setHighlightedIndex(prev)
      requestAnimationFrame(() => scrollHighlightedIntoView(prev))
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
    requestAnimationFrame(() => scrollHighlightedIntoView(highlightedIndex))
  }, [highlightedIndex, showNameList])

  /** ---------- คำนวณอัตโนมัติ ---------- */
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [computedAmount])

  /** เมื่อเลือกชนิดข้าว (id) ให้ auto-fill ราคา (ถ้ามี) */
  useEffect(() => {
    if (!order.riceId) return
    const found = riceOptions.find((r) => r.id === order.riceId)
    if (found?.price != null) {
      setOrder((p) => ({ ...p, unitPrice: String(found.price) }))
    }
  }, [order.riceId, riceOptions])

  /** ---------- Handlers ---------- */
  const updateCustomer = (k, v) => setCustomer((prev) => ({ ...prev, [k]: v }))
  const updateOrder = (k, v) => setOrder((prev) => ({ ...prev, [k]: v }))

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
    setErrors(e)
    return Object.keys(e).length === 0
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!validateAll()) return

    const [firstName, ...rest] = customer.fullName.trim().split(" ")
    const lastName = rest.join(" ")

    const riceId  = /^\d+$/.test(order.riceId) ? Number(order.riceId) : null
    const branchId = order.branchId ?? null
    const klangId  = order.klangId ?? null

    if (!riceId)   return setErrors((prev) => ({ ...prev, riceType: "ไม่พบรหัสชนิดข้าว โปรดเลือกใหม่" }))
    if (!branchId) return setErrors((prev) => ({ ...prev, branchName: "ไม่พบรหัสสาขา โปรดเลือกใหม่" }))
    if (!klangId)  return setErrors((prev) => ({ ...prev, klangName: "ไม่พบรหัสคลัง โปรดเลือกใหม่" }))

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
      },
      rice: { rice_type: order.riceType, id: riceId },
      branch: { branch_name: order.branchName, id: branchId },
      klang: { klang_name: order.klangName, id: klangId },
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
    })
  }

  /** ---------- UI (ธีมเดียวกับ Order) ---------- */
  return (
    // พื้นหลังหลัก: Light = ขาว, Dark = slate-900 + มุมมนเหมือนหน้า Order
    <div className="min-h-screen bg-white text-black dark:bg-slate-900 dark:text-white rounded-2xl">
      <div className="mx-auto max-w-7xl p-4 md:p-6">
        {/* หัวข้อ */}
        <h1 className="mb-4 text-2xl font-bold text-gray-900 dark:text-white">
          🧾 บันทึกออเดอร์ซื้อข้าวเปลือก
        </h1>

        {/* กล่องข้อมูลลูกค้า: การ์ด/เส้นขอบ/สี เหมือน Filters ของ Order */}
        <div className="mb-6 rounded-2xl border border-slate-200 bg-white p-4 text-black shadow-sm dark:border-slate-700 dark:bg-slate-800 dark:text-white">
          <div className="mb-3 flex flex-wrap items-center gap-2">
            <h2 className="text-lg font-semibold">ข้อมูลลูกค้า</h2>
            {memberMeta.type === "member" ? (
              <span className="inline-flex items-center gap-2 rounded-full bg-emerald-50 px-3 py-1 text-emerald-700 ring-1 ring-emerald-200 dark:bg-emerald-900/20 dark:text-emerald-200 dark:ring-emerald-700/60">
                <span className="h-2 w-2 rounded-full bg-emerald-500" />
                สมาชิก • รหัสสมาชิก {memberMeta.memberId ?? "-"}
              </span>
            ) : memberMeta.type === "guest" ? (
              <span className="inline-flex items-center gap-2 rounded-full bg-slate-100 px-3 py-1 text-slate-700 ring-1 ring-slate-200 dark:bg-slate-700/60 dark:text-slate-200 dark:ring-slate-600">
                <span className="h-2 w-2 rounded-full bg-slate-500" />
                ลูกค้าทั่วไป (ไม่พบในฐานสมาชิก)
              </span>
            ) : (
              <span className="inline-flex items-center gap-2 rounded-full bg-amber-50 px-3 py-1 text-amber-700 ring-1 ring-amber-200 dark:bg-amber-900/20 dark:text-amber-200 dark:ring-amber-700/60">
                <span className="h-2 w-2 rounded-full bg-amber-500" />
                โปรดกรอกชื่อหรือเลขบัตรประชาชนเพื่อระบุสถานะ
              </span>
            )}
          </div>

          <div className="grid gap-4 md:grid-cols-3">
            {/* เลขบัตร */}
            <div className="md:col-span-1">
              <label className="mb-1 block text-sm text-slate-700 dark:text-slate-300">เลขที่บัตรประชาชน (13 หลัก)</label>
              <input
                inputMode="numeric"
                maxLength={13}
                className={`w-full rounded-xl border p-2 outline-none placeholder:text-slate-400 transition ${
                  errors.citizenId ? "border-amber-400" : "border-slate-300 focus:border-emerald-500"
                } dark:border-slate-600 dark:bg-slate-700 dark:text-white`}
                value={customer.citizenId}
                onChange={(e) => updateCustomer("citizenId", onlyDigits(e.target.value))}
                placeholder="เช่น 1234567890123"
              />
              <div className="mt-1 text-xs text-slate-500 dark:text-slate-400">
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
              <label className="mb-1 block text-sm text-slate-700 dark:text-slate-300">ชื่อ–สกุล (พิมพ์เพื่อค้นหาอัตโนมัติ)</label>
              <input
                ref={nameInputRef}
                className={`w-full rounded-xl border p-2 outline-none placeholder:text-slate-400 transition ${
                  errors.fullName ? "border-red-400" : "border-slate-300 focus:border-emerald-500"
                } dark:border-slate-600 dark:bg-slate-700 dark:text-white`}
                value={customer.fullName}
                onChange={(e) => {
                  updateCustomer("fullName", e.target.value)
                  if (e.target.value.trim().length >= 2) setShowNameList(true)
                  else {
                    setShowNameList(false)
                    setHighlightedIndex(-1)
                  }
                }}
                onKeyDown={handleNameKeyDown}
                placeholder="เช่น นายสมชาย ใจดี"
                onFocus={() => {
                  if (customer.fullName.trim().length >= 2 && nameResults.length > 0) {
                    setShowNameList(true)
                    if (highlightedIndex === -1) setHighlightedIndex(0)
                  }
                }}
                aria-expanded={showNameList}
                aria-controls="name-results"
                role="combobox"
                aria-autocomplete="list"
              />
              {errors.fullName && <p className="mt-1 text-sm text-red-500">{errors.fullName}</p>}

              {showNameList && nameResults.length > 0 && (
                <div
                  id="name-results"
                  ref={listContainerRef}
                  className="mt-1 max-h-60 w-full overflow-auto rounded-xl border border-slate-200 bg-white text-black shadow dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                  role="listbox"
                >
                  {nameResults.map((r, idx) => (
                    <button
                      type="button"
                      ref={(el) => (itemRefs.current[idx] = el)}
                      key={r.id || `${r.citizenId}-${r.first_name}-${r.last_name}`}
                      onClick={() => pickNameResult(r)}
                      onMouseEnter={() => {
                        setHighlightedIndex(idx)
                        requestAnimationFrame(() => scrollHighlightedIntoView(idx))
                      }}
                      role="option"
                      aria-selected={idx === highlightedIndex}
                      className={`flex w-full items-start gap-3 px-3 py-2 text-left ${
                        idx === highlightedIndex ? "bg-emerald-50" : "hover:bg-emerald-50"
                      } dark:hover:bg-emerald-900/30`}
                    >
                      <div className="flex-1">
                        <div className="font-medium">{`${r.first_name ?? ""} ${r.last_name ?? ""}`.trim()}</div>
                        <div className="text-xs text-slate-500 dark:text-slate-400">
                          ปชช. {r.citizenId} • {r.address ? `บ้าน ${r.address}` : ""} {r.mhoo ? `หมู่ ${r.mhoo}` : ""}
                          {r.sub_district ? ` • ต.${r.sub_district}` : ""}
                          {r.district ? ` อ.${r.district}` : ""} {r.province ? ` จ.${r.province}` : ""}{" "}
                          {r.postal_code ? ` ${r.postal_code}` : ""}
                          {r.member_id ? " • สมาชิก" : ""}
                        </div>
                      </div>
                    </button>
                  ))}
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
                <label className="mb-1 block text-sm text-slate-700 dark:text-slate-300">{label}</label>
                <input
                  className={`w-full rounded-xl border p-2 outline-none placeholder:text-slate-400 transition ${
                    errors.address ? "border-amber-400" : "border-slate-300 focus:border-emerald-500"
                  } dark:border-slate-600 dark:bg-slate-700 dark:text-white`}
                  value={customer[k]}
                  onChange={(e) => updateCustomer(k, e.target.value)}
                  placeholder={ph}
                />
              </div>
            ))}

            <div>
              <label className="mb-1 block text-sm text-slate-700 dark:text-slate-300">รหัสไปรษณีย์ (ไม่บังคับ)</label>
              <input
                inputMode="numeric"
                maxLength={5}
                className="w-full rounded-xl border border-slate-300 p-2 outline-none placeholder:text-slate-400 focus:border-emerald-500 dark:border-slate-600 dark:bg-slate-700 dark:text-white"
                value={customer.postalCode}
                onChange={(e) => updateCustomer("postalCode", onlyDigits(e.target.value))}
                placeholder="เช่น 40000"
              />
            </div>
          </div>
        </div>

        {/* ฟอร์มออเดอร์: การ์ดธีมเดียวกับ Order */}
        <form
          onSubmit={handleSubmit}
          className="rounded-2xl border border-slate-200 bg-white p-4 text-black shadow-sm dark:border-slate-700 dark:bg-slate-800 dark:text-white"
        >
          <h2 className="mb-3 text-lg font-semibold">รายละเอียดการซื้อ</h2>

          <div className="grid gap-4 md:grid-cols-3">
            {/* ชนิดข้าว */}
            <div>
              <label className="mb-1 block text-sm text-slate-700 dark:text-slate-300">ชนิดข้าวเปลือก</label>
              <ComboBox
                options={riceOptions}
                value={order.riceId}
                onChange={(id, found) =>
                  setOrder((p) => ({
                    ...p,
                    riceId: id,
                    riceType: found?.label ?? "",
                    unitPrice: found?.price != null ? String(found.price) : p.unitPrice,
                  }))
                }
                placeholder="— เลือกชนิด —"
                error={!!errors.riceType}
              />
              {errors.riceType && <p className="mt-1 text-sm text-red-500">{errors.riceType}</p>}
            </div>

            {/* สาขา */}
            <div>
              <label className="mb-1 block text-sm text-slate-700 dark:text-slate-300">สาขา</label>
              <ComboBox
                options={branchOptions.map((b) => ({ id: b.id, label: b.branch_name }))}
                value={order.branchName}
                getValue={(o) => o.label}
                onChange={(_val, found) =>
                  setOrder((p) => ({
                    ...p,
                    branchName: found?.label ?? "",
                    branchId: found?.id ?? null,
                    klangName: "",
                    klangId: null,
                  }))
                }
                placeholder="— เลือกสาขา —"
                error={!!errors.branchName}
              />
              {errors.branchName && <p className="mt-1 text-sm text-red-500">{errors.branchName}</p>}
            </div>

            {/* คลัง */}
            <div>
              <label className="mb-1 block text-sm text-slate-700 dark:text-slate-300">คลัง</label>
              <ComboBox
                options={klangOptions.map((k) => ({ id: k.id, label: k.klang_name }))}
                value={order.klangName}
                getValue={(o) => o.label}
                onChange={(_val, found) =>
                  setOrder((p) => ({
                    ...p,
                    klangName: found?.label ?? "",
                    klangId: found?.id ?? null,
                  }))
                }
                placeholder="— เลือกคลัง —"
                disabled={!order.branchName && order.branchId == null}
                error={!!errors.klangName}
              />
              {errors.klangName && <p className="mt-1 text-sm text-red-500">{errors.klangName}</p>}
            </div>

            {/* ความชื้น/สิ่งเจือปน/น้ำหนัก */}
            <div>
              <label className="mb-1 block text-sm text-slate-700 dark:text-slate-300">ความชื้น (%)</label>
              <input
                inputMode="decimal"
                className="w-full rounded-xl border border-slate-300 p-2 outline-none placeholder:text-slate-400 focus:border-emerald-500 dark:border-slate-600 dark:bg-slate-700 dark:text-white"
                value={order.moisturePct}
                onChange={(e) => updateOrder("moisturePct", onlyDigits(e.target.value))}
                placeholder="เช่น 18"
              />
              <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">มาตรฐาน {MOISTURE_STD}% หากเกินจะถูกหักน้ำหนัก</p>
            </div>
            <div>
              <label className="mb-1 block text-sm text-slate-700 dark:text-slate-300">สิ่งเจือปน (%)</label>
              <input
                inputMode="decimal"
                className="w-full rounded-xl border border-slate-300 p-2 outline-none placeholder:text-slate-400 focus:border-emerald-500 dark:border-slate-600 dark:bg-slate-700 dark:text-white"
                value={order.impurityPct}
                onChange={(e) => updateOrder("impurityPct", onlyDigits(e.target.value))}
                placeholder="เช่น 2"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm text-slate-700 dark:text-slate-300">น้ำหนักตามใบชั่ง (กก.)</label>
              <input
                inputMode="decimal"
                className={`w-full rounded-xl border p-2 outline-none placeholder:text-slate-400 transition ${
                  errors.grossWeightKg ? "border-red-400" : "border-slate-300 focus:border-emerald-500"
                } dark:border-slate-600 dark:bg-slate-700 dark:text-white`}
                value={order.grossWeightKg}
                onChange={(e) => updateOrder("grossWeightKg", e.target.value.replace(/[^\d.]/g, ""))}
                placeholder="เช่น 5000"
              />
              {errors.grossWeightKg && <p className="mt-1 text-sm text-red-500">{errors.grossWeightKg}</p>}
            </div>

            {/* หักน้ำหนัก */}
            <div className="md:col-span-2">
              <div className="flex items-center justify-between">
                <label className="mb-1 block text-sm text-slate-700 dark:text-slate-300">
                  หักน้ำหนัก (ความชื้น+สิ่งเจือปน) (กก.)
                </label>
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
                inputMode="decimal"
                disabled={!order.manualDeduct}
                className={`w-full rounded-xl border p-2 outline-none placeholder:text-slate-400 transition ${
                  errors.deductWeightKg ? "border-red-400" : "border-slate-300 focus:border-emerald-500"
                } ${!order.manualDeduct ? "bg-slate-100 dark:bg-slate-700/50" : "dark:border-slate-600 dark:bg-slate-700 dark:text-white"}`}
                value={
                  order.manualDeduct
                    ? order.deductWeightKg
                    : String(
                        Math.round(
                          suggestDeductionWeight(order.grossWeightKg, order.moisturePct, order.impurityPct) * 100
                        ) / 100
                      )
                }
                onChange={(e) => updateOrder("deductWeightKg", e.target.value.replace(/[^\d.]/g, ""))}
                placeholder="ระบบคำนวณให้ หรือกำหนดเอง"
              />
              {errors.deductWeightKg && <p className="mt-1 text-sm text-red-500">{errors.deductWeightKg}</p>}
            </div>

            {/* สุทธิ */}
            <div>
              <label className="mb-1 block text-sm text-slate-700 dark:text-slate-300">น้ำหนักสุทธิ (กก.)</label>
              <input
                disabled
                className="w-full rounded-xl border border-slate-300 bg-slate-100 p-2 outline-none dark:border-slate-600 dark:bg-slate-700/50 dark:text-white"
                value={
                  Math.round(
                    (toNumber(order.grossWeightKg) - toNumber(
                      order.manualDeduct
                        ? order.deductWeightKg
                        : suggestDeductionWeight(order.grossWeightKg, order.moisturePct, order.impurityPct)
                    )) * 100
                  ) / 100
                }
              />
            </div>

            {/* ราคา/เป็นเงิน/เลขอ้างอิง/ลงวันที่ */}
            <div>
              <label className="mb-1 block text-sm text-slate-700 dark:text-slate-300">ราคาต่อกก. (บาท) (ไม่บังคับ)</label>
              <input
                inputMode="decimal"
                className="w-full rounded-xl border border-slate-300 p-2 outline-none placeholder:text-slate-400 focus:border-emerald-500 dark:border-slate-600 dark:bg-slate-700 dark:text-white"
                value={order.unitPrice}
                onChange={(e) => updateOrder("unitPrice", e.target.value.replace(/[^\d.]/g, ""))}
                placeholder="เช่น 12.50"
              />
              <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">ถ้ากรอกราคา ระบบจะคำนวณ “เป็นเงิน” ให้อัตโนมัติ</p>
            </div>

            <div>
              <label className="mb-1 block text-sm text-slate-700 dark:text-slate-300">เป็นเงิน (บาท)</label>
              <input
                inputMode="decimal"
                className={`w-full rounded-xl border p-2 outline-none placeholder:text-slate-400 transition ${
                  errors.amountTHB ? "border-red-400" : "border-slate-300 focus:border-emerald-500"
                } dark:border-slate-600 dark:bg-slate-700 dark:text-white`}
                value={order.amountTHB}
                onChange={(e) => updateOrder("amountTHB", e.target.value.replace(/[^\d.]/g, ""))}
                placeholder="เช่น 60000"
              />
              {!!order.amountTHB && (
                <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">≈ {thb(Number(order.amountTHB))}</p>
              )}
              {errors.amountTHB && <p className="mt-1 text-sm text-red-500">{errors.amountTHB}</p>}
            </div>

            <div>
              <label className="mb-1 block text-sm text-slate-700 dark:text-slate-300">เลขที่ใบสำคัญจ่ายเงิน</label>
              <input
                className="w-full rounded-xl border border-slate-300 p-2 outline-none placeholder:text-slate-400 focus:border-emerald-500 dark:border-slate-600 dark:bg-slate-700 dark:text-white"
                value={order.paymentRefNo}
                onChange={(e) => updateOrder("paymentRefNo", e.target.value)}
                placeholder="เช่น A-2025-000123"
              />
            </div>

            <div>
              <label className="mb-1 block text-sm text-slate-700 dark:text-slate-300">ลงวันที่</label>
              <input
                type="date"
                className={`w-full rounded-xl border p-2 outline-none placeholder:text-slate-400 transition ${
                  errors.issueDate ? "border-red-400" : "border-slate-300 focus:border-emerald-500"
                } dark:border-slate-600 dark:bg-slate-700 dark:text-white`}
                value={order.issueDate}
                onChange={(e) => updateOrder("issueDate", e.target.value)}
              />
              {errors.issueDate && <p className="mt-1 text-sm text-red-500">{errors.issueDate}</p>}
            </div>
          </div>

          {/* สรุป (การ์ดย่อยใช้โทนเดียวกับ Summary ของ Order) */}
          <div className="mt-6 grid gap-3 md:grid-cols-4">
            {[
              { label: "ชนิดข้าว", value: order.riceType || "—" },
              { label: "สาขา / คลัง", value: `${order.branchName || "—"}${order.klangName ? ` • ${order.klangName}` : ""}` },
              {
                label: "น้ำหนักสุทธิ",
                value:
                  (Math.round(
                    (toNumber(order.grossWeightKg) -
                      toNumber(
                        order.manualDeduct
                          ? order.deductWeightKg
                          : suggestDeductionWeight(order.grossWeightKg, order.moisturePct, order.impurityPct)
                      )) *
                      100
                  ) / 100) + " กก.",
              },
              { label: "เป็นเงิน", value: order.amountTHB ? thb(Number(order.amountTHB)) : "—" },
            ].map((c) => (
              <div
                key={c.label}
                className="rounded-2xl bg-white p-4 text-black shadow-sm ring-1 ring-slate-200 dark:bg-slate-800 dark:text-white dark:ring-slate-700"
              >
                <div className="text-slate-500 dark:text-slate-400">{c.label}</div>
                <div className="text-lg font-semibold">{c.value}</div>
              </div>
            ))}
          </div>

          {/* ปุ่ม */}
          <div className="mt-6 flex flex-col gap-3 sm:flex-row">
            <button
              type="submit"
              className="inline-flex items-center justify-center rounded-xl bg-emerald-600 px-5 py-2.5 font-medium text-white hover:bg-emerald-700 active:scale-[.98]"
            >
              บันทึกออเดอร์
            </button>
            <button
              type="button"
              onClick={handleReset}
              className="inline-flex items-center justify-center rounded-xl border border-slate-300 bg-white px-5 py-2.5 font-medium text-slate-700 hover:bg-slate-50 active:scale-[.98] dark:border-slate-600 dark:bg-slate-700 dark:text-white dark:hover:bg-slate-600"
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
