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

const Sales = () => {
  const [loadingCustomer, setLoadingCustomer] = useState(false)
  const [customerFound, setCustomerFound] = useState(null)
  const [errors, setErrors] = useState({})
  const [nameResults, setNameResults] = useState([])
  const [showNameList, setShowNameList] = useState(false)

  const nameBoxRef = useRef(null)
  const nameInputRef = useRef(null)
  const suppressNameSearchRef = useRef(false)

  const [highlightedIndex, setHighlightedIndex] = useState(-1)
  const listContainerRef = useRef(null)
  const itemRefs = useRef([])

  // dropdown data
  const [riceOptions, setRiceOptions] = useState([])   // [{id, rice_type, price}]
  const [branchOptions, setBranchOptions] = useState([]) // [{id, branch_name}]
  const [klangOptions, setKlangOptions] = useState([]) // [{id, klang_name}]

  // ฟอร์มลูกค้า
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

  // ฟอร์มออเดอร์
  const [order, setOrder] = useState({
    riceType: "",
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
    branchId: null, // ➕ เก็บ id ของสาขาไว้ด้วย
    klangName: "",
  })

  const debouncedCitizenId = useDebounce(customer.citizenId)
  const debouncedFullName = useDebounce(customer.fullName)

  const authHeader = () => {
    const token = localStorage.getItem("token")
    return {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    }
  }

  // โหลด rice / branch ตอน mount
  useEffect(() => {
    const loadDD = async () => {
      try {
        const [r1, r2] = await Promise.all([
          fetch(`${API_BASE}/order/rice/search`, { headers: authHeader() }),
          fetch(`${API_BASE}/order/branch/search`, { headers: authHeader() }),
        ])
        if (!r1.ok) console.error("Load rice options failed:", r1.status, await r1.text())
        if (!r2.ok) console.error("Load branch options failed:", r2.status, await r2.text())
        const rice = r1.ok ? await r1.json() : []
        const branch = r2.ok ? await r2.json() : []
        setRiceOptions(rice || [])
        setBranchOptions(branch || [])
      } catch (e) {
        console.error("Load dropdowns error:", e)
      }
    }
    loadDD()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // โหลดคลังตามสาขา (ใช้ branchId เป็นหลัก ถ้าไม่มีค่อยใช้ชื่อ)
  useEffect(() => {
    const bName = order.branchName?.trim()
    const bId = order.branchId

    if (!bName && (bId == null)) {
      setKlangOptions([])
      setOrder((p) => ({ ...p, klangName: "" }))
      return
    }

    const loadKlang = async () => {
      try {
        const qs = bId != null ? `branch_id=${bId}` : `branch_name=${encodeURIComponent(bName)}`
        const r = await fetch(`${API_BASE}/order/klang/search?${qs}`, { headers: authHeader() })
        if (!r.ok) {
          const msg = await r.text()
          console.error("Load klang failed:", r.status, msg)
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
  }, [order.branchName, order.branchId])

  // map record -> UI
  const mapMemberToUI = (m = {}) => {
    const first = m.first_name ?? m.firstName ?? ""
    const last = m.last_name ?? m.lastName ?? ""
    return {
      citizenId: (m.citizen_id ?? m.citizenId ?? "").toString(),
      fullName: `${first} ${last}`.trim() || m.fullName || "",
      houseNo: m.address ?? m.houseNo ?? "",
      moo: m.mhoo ?? m.moo ?? "",
      subdistrict: m.sub_district ?? m.subdistrict ?? "",
      district: m.district ?? "",
      province: m.province ?? "",
      postalCode: m.postal_code ?? m.postalCode ?? "",
    }
  }

  const fillFromRecord = (raw = {}) => {
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
    setCustomerFound(true)
  }

  /** ---------- ค้นหาด้วยเลขบัตร ---------- */
  useEffect(() => {
    const cid = onlyDigits(debouncedCitizenId)
    if (cid.length !== 13) {
      setCustomerFound(null)
      return
    }
    const fetchByCid = async () => {
      try {
        setLoadingCustomer(true)
        const url = `${API_BASE}/order/customers/search?q=${encodeURIComponent(cid)}`
        const res = await fetch(url, { headers: authHeader() })
        if (!res.ok) throw new Error("search failed")
        const arr = (await res.json()) || []
        const exact = arr.find((r) => onlyDigits(r.citizen_id || r.citizenId || "") === cid) || arr[0]
        if (exact) fillFromRecord(exact)
        else setCustomerFound(false)
      } catch (e) {
        console.error(e)
        setCustomerFound(false)
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
      return
    }
    const searchByName = async () => {
      try {
        setLoadingCustomer(true)
        const url = `${API_BASE}/order/customers/search?q=${encodeURIComponent(q)}`
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
    fillFromRecord(rec)
    setShowNameList(false)
    setNameResults([])
    setHighlightedIndex(-1)
  }

  const scrollHighlightedIntoView = (index) => {
    const itemEl = itemRefs.current[index]
    const listEl = listContainerRef.current
    if (!itemEl || !listEl) return
    try {
      itemEl.scrollIntoView({ block: "nearest", inline: "nearest" })
      return
    } catch (_) {}
    const itemRect = itemEl.getBoundingClientRect()
    const listRect = listEl.getBoundingClientRect()
    const buffer = 6
    if (itemRect.top < listRect.top + buffer) {
      listEl.scrollTop -= (listRect.top + buffer) - itemRect.top
    } else if (itemRect.bottom > listRect.bottom - buffer) {
      listEl.scrollTop += itemRect.bottom - (listRect.bottom - buffer)
    }
  }

  useEffect(() => {
    if (highlightedIndex >= 0) {
      requestAnimationFrame(() => scrollHighlightedIntoView(highlightedIndex))
    }
  }, [highlightedIndex])

  const handleNameKeyDown = (e) => {
    if (!showNameList || nameResults.length === 0) return
    if (e.key === "ArrowDown") {
      e.preventDefault()
      const next = highlightedIndex < nameResults.length - 1 ? highlightedIndex + 1 : 0
      setHighlightedIndex(next)
    } else if (e.key === "ArrowUp") {
      e.preventDefault()
      const prev = highlightedIndex > 0 ? highlightedIndex - 1 : nameResults.length - 1
      setHighlightedIndex(prev)
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

  // เมื่อเลือกชนิดข้าว ให้ auto-fill ราคา (ถ้ามี)
  useEffect(() => {
    if (!order.riceType) return
    const found = riceOptions.find((r) => r.rice_type === order.riceType)
    if (found?.price) {
      setOrder((p) => ({ ...p, unitPrice: String(found.price) }))
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [order.riceType])

  const updateCustomer = (k, v) => setCustomer((prev) => ({ ...prev, [k]: v }))
  const updateOrder = (k, v) => setOrder((prev) => ({ ...prev, [k]: v }))

  const validateAll = () => {
    const e = {}
    if (customer.citizenId && !validateThaiCitizenId(customer.citizenId))
      e.citizenId = "เลขบัตรประชาชนอาจไม่ถูกต้อง"
    if (!customer.fullName) e.fullName = "กรุณากรอกชื่อ–สกุล"
    if (!customer.subdistrict || !customer.district || !customer.province) e.address = "กรุณากรอกที่อยู่ให้ครบ"
    if (!order.riceType) e.riceType = "เลือกชนิดข้าวเปลือก"
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
        humidity: Number(order.moisturePct || 0),
        weight: netWeight, // น้ำหนักสุทธิ
        price: Number(order.amountTHB),
        impurity: Number(order.impurityPct || 0),
        order_serial: order.paymentRefNo.trim(),
        date: new Date(`${order.issueDate}T00:00:00.000Z`).toISOString(),
      },
      rice: { rice_type: order.riceType },
      branch: { branch_name: order.branchName },
      klang: { klang_name: order.klangName },
    }

    try {
      const res = await fetch(`${API_BASE}/order/customers/save`, {
        method: "POST",
        headers: authHeader(),
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
      branchId: null,  // ➕ reset
      klangName: "",
    })
  }

  return (
    <div className="mx-auto max-w-6xl p-4 md:p-6">
      <h1 className="mb-4 text-2xl font-bold text-gray-900 dark:text-white">🧾 บันทึกออเดอร์ซื้อข้าวเปลือก</h1>

      {/* ข้อมูลลูกค้า */}
      <div className="text-black mb-6 rounded-2xl border border-emerald-200 bg-white p-4 shadow-sm">
        <h2 className="mb-2 text-lg font-semibold">ข้อมูลลูกค้า</h2>

        <div className="grid gap-4 md:grid-cols-3">
          <div className="md:col-span-1">
            <label className="mb-1 block text-sm font-medium">เลขที่บัตรประชาชน (13 หลัก)</label>
            <input
              inputMode="numeric"
              maxLength={13}
              className={`w-full rounded-xl border p-2 outline-none transition ${
                errors.citizenId ? "border-amber-400" : "border-slate-300 focus:border-emerald-500"
              }`}
              value={customer.citizenId}
              onChange={(e) => setCustomer((p) => ({ ...p, citizenId: onlyDigits(e.target.value) }))}
              placeholder="เช่น 1234567890123"
            />
            <div className="mt-1 text-xs text-slate-500">
              {loadingCustomer && "กำลังค้นหาลูกค้า..."}
              {customer.citizenId.length === 13 && !validateThaiCitizenId(customer.citizenId) && (
                <span className="text-amber-600">เลขบัตรอาจไม่ถูกต้อง</span>
              )}
              {customerFound === true && <span className="text-emerald-600 ml-1">พบข้อมูลและเติมให้แล้ว ✅</span>}
              {customer.citizenId.length === 13 && customerFound === false && (
                <span className="text-amber-600 ml-1">ไม่พบในระบบ จะบันทึกเป็นลูกค้าใหม่</span>
              )}
            </div>
          </div>

          {/* ชื่อ–สกุล + รายการค้นหา */}
          <div className="md:col-span-2" ref={nameBoxRef}>
            <label className="mb-1 block text-sm font-medium">ชื่อ–สกุล (พิมพ์เพื่อค้นหาอัตโนมัติ)</label>
            <input
              ref={nameInputRef}
              className={`w-full rounded-xl border p-2 outline-none transition ${
                errors.fullName ? "border-red-400" : "border-slate-300 focus:border-emerald-500"
              }`}
              value={customer.fullName}
              onChange={(e) => {
                setCustomer((p) => ({ ...p, fullName: e.target.value }))
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
            />
            {errors.fullName && <p className="mt-1 text-sm text-red-500">{errors.fullName}</p>}
            {showNameList && nameResults.length > 0 && (
              <div
                id="name-results"
                ref={listContainerRef}
                className="mt-1 max-h-60 w-full overflow-auto rounded-xl border border-slate-200 bg-white shadow"
                role="listbox"
              >
                {nameResults.map((r, idx) => (
                  <button
                    type="button"
                    ref={(el) => (itemRefs.current[idx] = el)}
                    key={r.id || `${r.citizenId}-${r.first_name}-${r.last_name}`}
                    onClick={() => {
                      suppressNameSearchRef.current = true
                      fillFromRecord(r)
                      setShowNameList(false)
                      setNameResults([])
                      setHighlightedIndex(-1)
                    }}
                    onMouseEnter={() => {
                      setHighlightedIndex(idx)
                      requestAnimationFrame(() => {
                        const itemEl = itemRefs.current[idx]
                        const listEl = listContainerRef.current
                        if (!itemEl || !listEl) return
                        try { itemEl.scrollIntoView({ block: "nearest", inline: "nearest" }) } catch (_){}
                      })
                    }}
                    role="option"
                    aria-selected={idx === highlightedIndex}
                    className={`flex w-full items-start gap-3 px-3 py-2 text-left ${
                      idx === highlightedIndex ? "bg-emerald-50" : "hover:bg-emerald-50"
                    }`}
                  >
                    <div className="flex-1">
                      <div className="font-medium">{`${r.first_name ?? ""} ${r.last_name ?? ""}`.trim()}</div>
                      <div className="text-xs text-slate-500">
                        ปชช. {r.citizenId} • {r.address ? `บ้าน ${r.address}` : ""} {r.mhoo ? `หมู่ ${r.mhoo}` : ""}
                        {r.sub_district ? ` • ต.${r.sub_district}` : ""}{r.district ? ` อ.${r.district}` : ""}
                        {r.province ? ` จ.${r.province}` : ""} {r.postal_code ? ` ${r.postal_code}` : ""}
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Address */}
          <div>
            <label className="mb-1 block text-sm font-medium">บ้านเลขที่</label>
            <input
              className="w-full rounded-xl border border-slate-300 p-2 outline-none focus:border-emerald-500"
              value={customer.houseNo}
              onChange={(e) => setCustomer((p) => ({ ...p, houseNo: e.target.value }))}
              placeholder="เช่น 99/1"
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium">หมู่</label>
            <input
              className="w-full rounded-xl border border-slate-300 p-2 outline-none focus:border-emerald-500"
              value={customer.moo}
              onChange={(e) => setCustomer((p) => ({ ...p, moo: e.target.value }))}
              placeholder="เช่น 4"
            />
          </div>
          <div>
            <label className="mb-1 block text.sm font-medium">ตำบล</label>
            <input
              className={`w-full rounded-xl border p-2 outline-none transition ${
                errors.address ? "border-amber-400" : "border-slate-300 focus:border-emerald-500"
              }`}
              value={customer.subdistrict}
              onChange={(e) => setCustomer((p) => ({ ...p, subdistrict: e.target.value }))}
              placeholder="เช่น หนองปลาไหล"
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium">อำเภอ</label>
            <input
              className={`w-full rounded-xl border p-2 outline-none transition ${
                errors.address ? "border-amber-400" : "border-slate-300 focus:border-emerald-500"
              }`}
              value={customer.district}
              onChange={(e) => setCustomer((p) => ({ ...p, district: e.target.value }))}
              placeholder="เช่น เมือง"
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium">จังหวัด</label>
            <input
              className={`w-full rounded-xl border p-2 outline-none transition ${
                errors.address ? "border-amber-400" : "border-slate-300 focus:border-emerald-500"
              }`}
              value={customer.province}
              onChange={(e) => setCustomer((p) => ({ ...p, province: e.target.value }))}
              placeholder="เช่น ขอนแก่น"
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium">รหัสไปรษณีย์ (ไม่บังคับ)</label>
            <input
              inputMode="numeric"
              maxLength={5}
              className="w-full rounded-xl border border-slate-300 p-2 outline-none focus:border-emerald-500"
              value={customer.postalCode}
              onChange={(e) => setCustomer((p) => ({ ...p, postalCode: onlyDigits(e.target.value) }))}
              placeholder="เช่น 40000"
            />
          </div>
        </div>
      </div>

      {/* ฟอร์มออเดอร์ */}
      <form onSubmit={handleSubmit} className="rounded-2xl border border-emerald-200 bg-white p-4 shadow-sm">
        <h2 className="text-black mb-3 text-lg font-semibold">รายละเอียดการซื้อ</h2>

        <div className="text-black grid gap-4 md:grid-cols-3">
          {/* Rice type */}
          <div>
            <label className="mb-1 block text-sm font-medium">ชนิดข้าวเปลือก</label>
            <select
              className={`w-full rounded-xl border p-2 outline-none transition ${
                errors.riceType ? "border-red-400" : "border-slate-300 focus:border-emerald-500"
              }`}
              value={order.riceType}
              onChange={(e) => setOrder((p) => ({ ...p, riceType: e.target.value }))}
            >
              <option value="">— เลือกชนิด —</option>
              {riceOptions.map((r) => (
                <option key={r.id ?? r.rice_type} value={r.rice_type}>
                  {r.rice_type}
                </option>
              ))}
            </select>
            {errors.riceType && <p className="mt-1 text-sm text-red-500">{errors.riceType}</p>}
          </div>

          {/* Branch */}
          <div>
            <label className="mb-1 block text-sm font-medium">สาขา</label>
            <select
              className={`w-full rounded-xl border p-2 outline-none transition ${
                errors.branchName ? "border-red-400" : "border-slate-300 focus:border-emerald-500"
              }`}
              value={order.branchName}
              onChange={(e) => {
                const name = e.target.value
                const found = branchOptions.find((b) => b.branch_name === name)
                setOrder((p) => ({
                  ...p,
                  branchName: name,
                  branchId: found?.id ?? null,  // ➕ เก็บ id
                  klangName: "",                 // เคลียร์คลังเดิม
                }))
              }}
            >
              <option value="">— เลือกสาขา —</option>
              {branchOptions.map((b) => (
                <option key={b.id ?? b.branch_name} value={b.branch_name}>
                  {b.branch_name}
                </option>
              ))}
            </select>
            {errors.branchName && <p className="mt-1 text-sm text-red-500">{errors.branchName}</p>}
          </div>

          {/* Klang */}
          <div>
            <label className="mb-1 block text-sm font-medium">คลัง</label>
            <select
              className={`w-full rounded-xl border p-2 outline-none transition ${
                errors.klangName ? "border-red-400" : "border-slate-300 focus:border-emerald-500"
              }`}
              value={order.klangName}
              onChange={(e) => setOrder((p) => ({ ...p, klangName: e.target.value }))}
              disabled={!order.branchName && order.branchId == null}
            >
              <option value="">— เลือกคลัง —</option>
              {klangOptions.map((k) => (
                <option key={k.id ?? k.klang_name} value={k.klang_name}>
                  {k.klang_name}
                </option>
              ))}
            </select>
            {errors.klangName && <p className="mt-1 text-sm text-red-500">{errors.klangName}</p>}
          </div>

          {/* Moisture / Impurity / Weight */}
          <div>
            <label className="mb-1 block text-sm font-medium">ความชื้น (%)</label>
            <input
              inputMode="decimal"
              className="w-full rounded-xl border border-slate-300 p-2 outline-none focus:border-emerald-500"
              value={order.moisturePct}
              onChange={(e) => setOrder((p) => ({ ...p, moisturePct: onlyDigits(e.target.value) }))}
              placeholder="เช่น 18"
            />
            <p className="mt-1 text-xs text-slate-500">มาตรฐาน {MOISTURE_STD}% หากเกินจะถูกหักน้ำหนัก</p>
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium">สิ่งเจือปน (%)</label>
            <input
              inputMode="decimal"
              className="w-full rounded-xl border border-slate-300 p-2 outline-none focus:border-emerald-500"
              value={order.impurityPct}
              onChange={(e) => setOrder((p) => ({ ...p, impurityPct: onlyDigits(e.target.value) }))}
              placeholder="เช่น 2"
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium">น้ำหนักตามใบชั่ง (กก.)</label>
            <input
              inputMode="decimal"
              className={`w-full rounded-xl border p-2 outline-none transition ${
                errors.grossWeightKg ? "border-red-400" : "border-slate-300 focus:border-emerald-500"
              }`}
              value={order.grossWeightKg}
              onChange={(e) => setOrder((p) => ({ ...p, grossWeightKg: e.target.value.replace(/[^\d.]/g, "") }))}
              placeholder="เช่น 5000"
            />
            {errors.grossWeightKg && <p className="mt-1 text-sm text-red-500">{errors.grossWeightKg}</p>}
          </div>

          {/* Deduct */}
          <div className="md:col-span-2">
            <div className="flex items-center justify-between">
              <label className="mb-1 block text-sm font-medium">หักน้ำหนัก (กก.)</label>
              <label className="flex cursor-pointer items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={order.manualDeduct}
                  onChange={(e) => setOrder((p) => ({ ...p, manualDeduct: e.target.checked }))}
                />
                กำหนดเอง
              </label>
            </div>
            <input
              inputMode="decimal"
              disabled={!order.manualDeduct}
              className={`w-full rounded-xl border p-2 outline-none transition ${
                errors.deductWeightKg ? "border-red-400" : "border-slate-300 focus:border-emerald-500"
              } ${!order.manualDeduct ? "bg-slate-100" : ""}`}
              value={
                order.manualDeduct
                  ? order.deductWeightKg
                  : String(
                      Math.round(
                        suggestDeductionWeight(order.grossWeightKg, order.moisturePct, order.impurityPct) * 100
                      ) / 100
                    )
              }
              onChange={(e) => setOrder((p) => ({ ...p, deductWeightKg: e.target.value.replace(/[^\d.]/g, "") }))}
              placeholder="ระบบคำนวณให้ หรือกำหนดเอง"
            />
            {errors.deductWeightKg && <p className="mt-1 text-sm text-red-500">{errors.deductWeightKg}</p>}
          </div>

          {/* Net weight */}
          <div>
            <label className="mb-1 block text-sm font-medium">น้ำหนักสุทธิ (กก.)</label>
            <input
              disabled
              className="w-full rounded-xl border border-slate-300 bg-slate-100 p-2 outline-none"
              value={
                Math.round(
                  (toNumber(order.grossWeightKg) -
                    toNumber(
                      order.manualDeduct
                        ? order.deductWeightKg
                        : suggestDeductionWeight(order.grossWeightKg, order.moisturePct, order.impurityPct)
                    )) *
                    100
                ) / 100
              }
            />
          </div>

          {/* Price */}
          <div>
            <label className="mb-1 block text-sm font-medium">ราคาต่อกก. (บาท) (ไม่บังคับ)</label>
            <input
              inputMode="decimal"
              className="w-full rounded-xl border border-slate-300 p-2 outline-none focus:border-emerald-500"
              value={order.unitPrice}
              onChange={(e) => setOrder((p) => ({ ...p, unitPrice: e.target.value.replace(/[^\d.]/g, "") }))}
              placeholder="เช่น 12.50"
            />
            <p className="mt-1 text-xs text-slate-500">ถ้ากรอกราคา ระบบจะคำนวณ “เป็นเงิน” ให้อัตโนมัติ</p>
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium">เป็นเงิน (บาท)</label>
            <input
              inputMode="decimal"
              className={`w-full rounded-xl border p-2 outline-none transition ${
                errors.amountTHB ? "border-red-400" : "border-slate-300 focus:border-emerald-500"
              }`}
              value={order.amountTHB}
              onChange={(e) => setOrder((p) => ({ ...p, amountTHB: e.target.value.replace(/[^\d.]/g, "") }))}
              placeholder="เช่น 60000"
            />
            {!!order.amountTHB && <p className="mt-1 text-xs text-slate-500">≈ {thb(Number(order.amountTHB))}</p>}
            {errors.amountTHB && <p className="mt-1 text-sm text-red-500">{errors.amountTHB}</p>}
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium">เลขที่ใบสำคัญจ่ายเงิน</label>
            <input
              className="w-full rounded-xl border border-slate-300 p-2 outline-none focus:border-emerald-500"
              value={order.paymentRefNo}
              onChange={(e) => setOrder((p) => ({ ...p, paymentRefNo: e.target.value }))}
              placeholder="เช่น A-2025-000123"
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium">ลงวันที่</label>
            <input
              type="date"
              className={`w-full rounded-xl border p-2 outline-none transition ${
                errors.issueDate ? "border-red-400" : "border-slate-300 focus:border-emerald-500"
              }`}
              value={order.issueDate}
              onChange={(e) => setOrder((p) => ({ ...p, issueDate: e.target.value }))}
            />
            {errors.issueDate && <p className="mt-1 text-sm text-red-500">{errors.issueDate}</p>}
          </div>
        </div>

        {/* สรุป */}
        <div className="text-black mt-6 rounded-xl border border-slate-200 bg-slate-50 p-4">
          <h3 className="text-black mb-2 text-base font-semibold">สรุป</h3>
          <div className="grid gap-2 md:grid-cols-4">
            <div className="rounded-lg bg-white p-3 text-sm shadow">
              <div className="text-slate-500">ชนิดข้าว</div>
              <div className="text-lg font-semibold">{order.riceType || "—"}</div>
            </div>
            <div className="rounded-lg bg-white p-3 text-sm shadow">
              <div className="text-slate-500">สาขา / คลัง</div>
              <div className="text-lg font-semibold">
                {order.branchName || "—"} {order.klangName ? `• ${order.klangName}` : ""}
              </div>
            </div>
            <div className="rounded-lg bg-white p-3 text-sm shadow">
              <div className="text-slate-500">น้ำหนักสุทธิ</div>
              <div className="text-lg font-semibold">
                {Math.round(
                  (toNumber(order.grossWeightKg) -
                    toNumber(
                      order.manualDeduct
                        ? order.deductWeightKg
                        : suggestDeductionWeight(order.grossWeightKg, order.moisturePct, order.impurityPct)
                    )) *
                    100
                ) / 100}{" "}
                กก.
              </div>
            </div>
            <div className="rounded-lg bg-white p-3 text-sm shadow">
              <div className="text-slate-500">เป็นเงิน</div>
              <div className="text-lg font-semibold">{order.amountTHB ? thb(Number(order.amountTHB)) : "—"}</div>
            </div>
          </div>
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
            className="inline-flex items-center justify-center rounded-xl border border-slate-300 bg-white px-5 py-2.5 font-medium text-slate-700 hover:bg-slate-50 active:scale-[.98]"
          >
            รีเซ็ต
          </button>
        </div>
      </form>
    </div>
  )
}

export default Sales
