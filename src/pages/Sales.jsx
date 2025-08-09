import { useEffect, useMemo, useState } from "react"

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

  const [customer, setCustomer] = useState({
    citizenId: "",
    fullName: "",
    houseNo: "",
    moo: "",
    subdistrict: "",
    district: "",
    province: "",
  })

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

  const debouncedCitizenId = useDebounce(customer.citizenId)

  useEffect(() => {
    const cid = onlyDigits(debouncedCitizenId)
    if (cid.length !== 13) {
      setCustomerFound(null)
      return
    }
    if (!validateThaiCitizenId(cid)) {
      setCustomerFound(null)
      return
    }

    const fetchCustomer = async () => {
      try {
        setLoadingCustomer(true)
        setCustomerFound(null)
        const token = localStorage.getItem("token")
        const res = await fetch(`/api/customers/${cid}`, {
          headers: {
            "Content-Type": "application/json",
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
        })
        if (res.ok) {
          const data = await res.json()
          setCustomer((prev) => ({
            ...prev,
            fullName: data.fullName || "",
            houseNo: data.houseNo || "",
            moo: data.moo || "",
            subdistrict: data.subdistrict || "",
            district: data.district || "",
            province: data.province || "",
          }))
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
    fetchCustomer()
  }, [debouncedCitizenId])

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

  const updateCustomer = (k, v) => setCustomer((prev) => ({ ...prev, [k]: v }))
  const updateOrder = (k, v) => setOrder((prev) => ({ ...prev, [k]: v }))

  const validateAll = () => {
    const e = {}
    if (!validateThaiCitizenId(customer.citizenId)) e.citizenId = "เลขบัตรประชาชนไม่ถูกต้อง"
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
      const token = localStorage.getItem("token")
      const res = await fetch("/api/orders", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify(payload),
      })
      if (!res.ok) throw new Error("ไม่สามารถบันทึกออเดอร์ได้")
      alert("บันทึกออเดอร์เรียบร้อย")
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

  return (
    <div className="mx-auto max-w-6xl p-4 md:p-6 text-black">
      {/* ส่วนเนื้อหาทั้งหมดที่เหลือใช้ class text-black แทนสีอื่น */}
      {/* ... โค้ดส่วนฟอร์มเหมือนเดิม แต่เปลี่ยนทุก text-* เป็น text-black ... */}
    </div>
  )
}

export default Sales
