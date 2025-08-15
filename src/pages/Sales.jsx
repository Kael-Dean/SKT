import { useEffect, useMemo, useRef, useState } from "react"

/** ---------- ENV (ชี้ไปที่ API เดิมของคุณ) ---------- */
const API_BASE = import.meta.env.VITE_API_BASE || "" // เช่น http://<ip>:<port>

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

// debounce ง่ายๆ
function useDebounce(value, delay = 400) {
  const [debounced, setDebounced] = useState(value)
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delay)
    return () => clearTimeout(t)
  }, [value, delay])
  return debounced
}

/** กฎคำนวณหักน้ำหนัก (ตั้งค่าได้) */
const MOISTURE_STD = 15
function suggestDeductionWeight(grossKg, moisturePct, impurityPct) {
  const w = toNumber(grossKg)
  const m = Math.max(0, toNumber(moisturePct) - MOISTURE_STD)
  const imp = Math.max(0, toNumber(impurityPct))
  const dedByMoisture = (m / 100) * w
  const dedByImpurity = (imp / 100) * w
  return Math.max(0, dedByMoisture + dedByImpurity)
}

/** ---------- Component ---------- */
const Sales = () => {
  const [loadingCustomer, setLoadingCustomer] = useState(false)
  const [customerFound, setCustomerFound] = useState(null) // true | false | null
  const [errors, setErrors] = useState({})
  const [nameResults, setNameResults] = useState([])
  const [showNameList, setShowNameList] = useState(false)

  const nameBoxRef = useRef(null)

  // ฟอร์มลูกค้า
  const [customer, setCustomer] = useState({
    citizenId: "",
    fullName: "",
    houseNo: "",
    moo: "",
    subdistrict: "",
    district: "",
    province: "",
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
    registeredPlace: "",
  })

  // debounce ค้นหาลูกค้าจากเลขบัตร / จากชื่อ
  const debouncedCitizenId = useDebounce(customer.citizenId)
  const debouncedFullName = useDebounce(customer.fullName)

  /** ---------- API Helpers ---------- */
  const authHeader = () => {
    const token = localStorage.getItem("token")
    return {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    }
  }

  // map record จาก backend -> โครง UI ฝั่งเรา
  const mapMemberToUI = (m = {}) => ({
    citizenId: (m.citizen_id ?? m.citizenId ?? "").toString(),
    fullName: `${m.first_name ?? ""} ${m.last_name ?? ""}`.trim() || m.fullName || "",
    houseNo: m.address ?? m.houseNo ?? "",
    moo: m.mhoo ?? m.moo ?? "",
    subdistrict: m.sub_district ?? m.subdistrict ?? "",
    district: m.district ?? "",
    province: m.province ?? "",
  })

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
    }))
  }

  /** ---------- ค้นหาจาก "เลขบัตร" ด้วย /member/members/search?q= ---------- */
  useEffect(() => {
    const cid = onlyDigits(debouncedCitizenId)

    // รอให้ครบ 13 หลักก่อนแล้วค่อยค้น (ปล่อยให้ checksum ผิดได้ แต่จะแจ้งเตือน)
    if (cid.length !== 13) {
      setCustomerFound(null)
      return
    }

    const fetchByCid = async () => {
      try {
        setLoadingCustomer(true)
        setCustomerFound(null)

        // เรียก endpoint เดิมของคุณ
        const url = `${API_BASE}/member/members/search?q=${encodeURIComponent(cid)}`
        const res = await fetch(url, { headers: authHeader() })
        if (!res.ok) throw new Error("search failed")
        const arr = await res.json() // เป็นรายการสมาชิก

        // หา exact match โดย citizen_id เท่ากันเป๊ะก่อน, ถ้าไม่มีก็ใช้ตัวแรก
        const exact = (arr || []).find(
          (r) => onlyDigits(r.citizen_id || r.citizenId || "") === cid
        )
        const found = exact || (arr && arr[0])

        if (found) {
          fillFromRecord(found)
          setCustomerFound(true)
        } else {
          setCustomerFound(false)
        }
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

  /** ---------- ค้นหาจาก "ชื่อ–สกุล" (dropdown) ด้วย /member/members/search?q= ---------- */
  useEffect(() => {
    const q = (debouncedFullName || "").trim()
    if (q.length < 2) {
      setNameResults([])
      setShowNameList(false)
      return
    }

    const searchByName = async () => {
      try {
        setLoadingCustomer(true)
        const url = `${API_BASE}/member/members/search?q=${encodeURIComponent(q)}`
        const res = await fetch(url, { headers: authHeader() })
        if (!res.ok) throw new Error("search failed")
        const items = (await res.json()) || []

        // map เป็นโครงที่ UI แสดงใน dropdown
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
        }))
        setNameResults(mapped)
        setShowNameList(true)
      } catch (err) {
        console.error(err)
        setNameResults([])
        setShowNameList(false)
      } finally {
        setLoadingCustomer(false)
      }
    }
    searchByName()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedFullName])

  // ปิดรายการชื่อเมื่อคลิกนอกกล่อง
  useEffect(() => {
    const onClick = (e) => {
      if (!nameBoxRef.current) return
      if (!nameBoxRef.current.contains(e.target)) setShowNameList(false)
    }
    document.addEventListener("click", onClick)
    return () => document.removeEventListener("click", onClick)
  }, [])

  const pickNameResult = (rec) => {
    fillFromRecord(rec)
    setCustomerFound(true)
    setShowNameList(false)
  }

  // คำนวณหัก/สุทธิ/จำนวนเงิน
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

  /** ---------- Handlers ---------- */
  const updateCustomer = (k, v) => setCustomer((prev) => ({ ...prev, [k]: v }))
  const updateOrder = (k, v) => setOrder((prev) => ({ ...prev, [k]: v }))

  const validateAll = () => {
    const e = {}
    // แสดงเตือนถ้า checksum ผิด แต่ไม่บล็อกการบันทึก (ให้ backend ตัดสิน)
    if (customer.citizenId && !validateThaiCitizenId(customer.citizenId)) e.citizenId = "เลขบัตรประชาชนอาจไม่ถูกต้อง"
    if (!customer.fullName) e.fullName = "กรุณากรอกชื่อ–สกุล"
    if (!customer.subdistrict || !customer.district || !customer.province) e.address = "กรุณากรอกที่อยู่ให้ครบ"
    if (!order.riceType) e.riceType = "เลือกชนิดข้าวเปลือก"
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

    const payload = {
      customer: {
        citizenId: onlyDigits(customer.citizenId),
        fullName: customer.fullName.trim(),
        houseNo: customer.houseNo.trim(),
        moo: customer.moo.trim(),
        subdistrict: customer.subdistrict.trim(),
        district: customer.district.trim(),
        province: customer.province.trim(),
      },
      order: {
        riceType: order.riceType,
        moisturePct: toNumber(order.moisturePct),
        impurityPct: toNumber(order.impurityPct),
        grossWeightKg: toNumber(order.grossWeightKg),
        deductWeightKg: toNumber(autoDeduct),
        netWeightKg: netWeight,
        unitPrice: order.unitPrice === "" ? null : toNumber(order.unitPrice),
        amountTHB: toNumber(order.amountTHB),
        paymentRefNo: order.paymentRefNo.trim(),
        issueDate: order.issueDate,
        registeredPlace: order.registeredPlace.trim(),
      },
    }

    try {
      const res = await fetch(`${API_BASE}/api/orders`, {
        method: "POST",
        headers: authHeader(),
        body: JSON.stringify(payload),
      })
      if (!res.ok) throw new Error("ไม่สามารถบันทึกออเดอร์ได้")
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
    setCustomer({
      citizenId: "",
      fullName: "",
      houseNo: "",
      moo: "",
      subdistrict: "",
      district: "",
      province: "",
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
      registeredPlace: "",
    })
  }

  /** ---------- UI ---------- */
  return (
    <div className="mx-auto max-w-6xl p-4 md:p-6">
      <h1 className="mb-4 text-2xl font-bold text-gray-900 dark:text-white">🧾 บันทึกออเดอร์ซื้อข้าวเปลือก</h1>

      {/* ค้นหาลูกค้าด้วยเลขบัตร / ชื่อ */}
      <div className="text-black mb-6 rounded-2xl border border-emerald-200 bg-white p-4 shadow-sm">
        <h2 className="mb-3 text-lg font-semibold">ข้อมูลลูกค้า</h2>
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
              {!loadingCustomer && customer.citizenId.length === 13 && customerFound === true && (
                <span className="text-emerald-600">พบข้อมูลลูกค้าและเติมให้แล้ว ✅</span>
              )}
              {!loadingCustomer && customer.citizenId.length === 13 && customerFound === false && (
                <span className="text-amber-600">ไม่พบบุคคลนี้ในระบบ จะบันทึกเป็นลูกค้าใหม่</span>
              )}
              {/* ถ้า checksum ไม่ผ่าน แค่เตือน ไม่บล็อก */}
              {customer.citizenId.length === 13 && !validateThaiCitizenId(customer.citizenId) && (
                <span className="text-amber-600"> — เลขบัตรอาจไม่ถูกต้อง</span>
              )}
            </div>
          </div>

          <div className="md:col-span-2" ref={nameBoxRef}>
            <label className="mb-1 block text-sm font-medium">ชื่อ–สกุล (พิมพ์เพื่อค้นหาอัตโนมัติ)</label>
            <input
              className={`w-full rounded-xl border p-2 outline-none transition ${
                errors.fullName ? "border-red-400" : "border-slate-300 focus:border-emerald-500"
              }`}
              value={customer.fullName}
              onChange={(e) => {
                setCustomer((p) => ({ ...p, fullName: e.target.value }))
                if (e.target.value.trim().length >= 2) setShowNameList(true)
              }}
              placeholder="เช่น นายสมชาย ใจดี"
              onFocus={() => customer.fullName.trim().length >= 2 && setShowNameList(true)}
            />
            {errors.fullName && <p className="mt-1 text-sm text-red-500">{errors.fullName}</p>}

            {showNameList && nameResults.length > 0 && (
              <div className="mt-1 max-h-60 w-full overflow-auto rounded-xl border border-slate-200 bg-white shadow">
                {nameResults.map((r) => (
                  <button
                    type="button"
                    key={r.id || `${r.citizenId}-${r.first_name}-${r.last_name}`}
                    onClick={() => pickNameResult(r)}
                    className="flex w-full items-start gap-3 px-3 py-2 text-left hover:bg-emerald-50"
                  >
                    <div className="flex-1">
                      <div className="font-medium">{`${r.first_name ?? ""} ${r.last_name ?? ""}`.trim()}</div>
                      <div className="text-xs text-slate-500">
                        ปชช. {r.citizenId} • {r.address ? `บ้าน ${r.address}` : ""} {r.mhoo ? `หมู่ ${r.mhoo}` : ""}
                        {r.sub_district ? ` • ต.${r.sub_district}` : ""}{r.district ? ` อ.${r.district}` : ""}
                        {r.province ? ` จ.${r.province}` : ""}
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>

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
            <label className="mb-1 block text-sm font-medium">ตำบล</label>
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
        </div>
      </div>

      {/* ฟอร์มออเดอร์ */}
      <form onSubmit={handleSubmit} className="rounded-2xl border border-emerald-200 bg-white p-4 shadow-sm">
        <h2 className="text-black mb-3 text-lg font-semibold">รายละเอียดการซื้อ</h2>

        <div className=" text-black grid gap-4 md:grid-cols-3">
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
              <option value="ข้าวหอมมะลิ">ข้าวหอมมะลิ</option>
              <option value="ข้าวขาว">ข้าวขาว</option>
              <option value="ข้าวเหนียว">ข้าวเหนียว</option>
              <option value="ข้าวหอมปทุม">ข้าวหอมปทุม</option>
              <option value="ข้าวไรซ์เบอร์รี">ข้าวไรซ์เบอร์รี</option>
              <option value="อื่นๆ">อื่นๆ</option>
            </select>
            {errors.riceType && <p className="mt-1 text-sm text-red-500">{errors.riceType}</p>}
          </div>

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
              onChange={(e) =>
                setOrder((p) => ({ ...p, grossWeightKg: e.target.value.replace(/[^\d.]/g, "") }))
              }
              placeholder="เช่น 5000"
            />
            {errors.grossWeightKg && <p className="mt-1 text-sm text-red-500">{errors.grossWeightKg}</p>}
          </div>

          <div className="md:col-span-2">
            <div className="flex items-center justify-between">
              <label className="mb-1 block text-sm font-medium">หักน้ำหนัก (ความชื้น+สิ่งเจือปน) (กก.)</label>
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
              value={order.manualDeduct ? order.deductWeightKg : String(Math.round(suggestDeductionWeight(order.grossWeightKg, order.moisturePct, order.impurityPct) * 100) / 100)}
              onChange={(e) =>
                setOrder((p) => ({ ...p, deductWeightKg: e.target.value.replace(/[^\d.]/g, "") }))
              }
              placeholder="ระบบคำนวณให้ หรือกำหนดเอง"
            />
            {errors.deductWeightKg && <p className="mt-1 text-sm text-red-500">{errors.deductWeightKg}</p>}
            <p className="mt-1 text-xs text-slate-500">
              แนะนำอัตโนมัติ = หัก {MOISTURE_STD}% ความชื้นเป็นฐาน + สิ่งเจือปนตามจริง
            </p>
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium">น้ำหนักสุทธิ (กก.)</label>
            <input
              disabled
              className="w-full rounded-xl border border-slate-300 bg-slate-100 p-2 outline-none"
              value={Math.round((toNumber(order.grossWeightKg) - toNumber(order.manualDeduct ? order.deductWeightKg : suggestDeductionWeight(order.grossWeightKg, order.moisturePct, order.impurityPct))) * 100) / 100}
            />
          </div>

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

          <div className="md:col-span-2">
            <label className="mb-1 block text-sm font-medium">สถานที่ขึ้นจดทะเบียน</label>
            <input
              className="w-full rounded-xl border border-slate-300 p-2 outline-none focus:border-emerald-500"
              value={order.registeredPlace}
              onChange={(e) => setOrder((p) => ({ ...p, registeredPlace: e.target.value }))}
              placeholder="เช่น สหกรณ์การเกษตรอำเภอ…"
            />
          </div>
        </div>

        {/* สรุป */}
        <div className="text-black mt-6 rounded-xl border border-slate-200 bg-slate-50 p-4">
          <h3 className="text-black mb-2 text-base font-semibold">สรุป</h3>
          <div className="grid gap-2 md:grid-cols-4">
            <div className="rounded-lg bg-white p-3 text-sm shadow">
              <div className="text-slate-500">น้ำหนักตามใบชั่ง</div>
              <div className="text-lg font-semibold">{Number(order.grossWeightKg || 0)} กก.</div>
            </div>
            <div className="rounded-lg bg-white p-3 text-sm shadow">
              <div className="text-slate-500">หัก (ความชื้น+สิ่งเจือปน)</div>
              <div className="text-lg font-semibold">
                {Math.round(suggestDeductionWeight(order.grossWeightKg, order.moisturePct, order.impurityPct) * 100) / 100} กก.
              </div>
            </div>
            <div className="rounded-lg bg-white p-3 text-sm shadow">
              <div className="text-slate-500">น้ำหนักสุทธิ</div>
              <div className="text-lg font-semibold">
                {Math.round((toNumber(order.grossWeightKg) - toNumber(order.manualDeduct ? order.deductWeightKg : suggestDeductionWeight(order.grossWeightKg, order.moisturePct, order.impurityPct))) * 100) / 100} กก.
              </div>
            </div>
            <div className="rounded-lg bg-white p-3 text-sm shadow">
              <div className="text-slate-500">เป็นเงิน</div>
              <div className="text-lg font-semibold">
                {order.amountTHB ? thb(Number(order.amountTHB)) : "—"}
              </div>
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
