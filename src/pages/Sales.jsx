import { useEffect, useMemo, useState } from "react"

/** ---------- Utils ---------- */
const onlyDigits = (s = "") => s.replace(/\D+/g, "")
const toNumber = (v) => (v === "" || v === null || v === undefined ? 0 : Number(v))
const thb = (n) =>
  new Intl.NumberFormat("th-TH", { style: "currency", currency: "THB", maximumFractionDigits: 2 }).format(
    isFinite(n) ? n : 0
  )

// ตรวจเลขบัตร ปชช.ไทย (13 หลัก) แบบมี checksum
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

/** กฎคำนวณหักน้ำหนัก (ตั้งค่าได้) 
 * สมมติ: ความชื้นมาตรฐาน 15%
 * - เกินทุก 1% หัก 1% ของน้ำหนัก
 * - สิ่งเจือปนหักเท่ากับ % ของน้ำหนัก
 */
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
    deductWeightKg: "", // กรอกเองเมื่อ manualDeduct = true
    unitPrice: "", // ราคาต่อกก. (ถ้ามี)
    amountTHB: "", // เป็นเงิน (แก้ไขได้)
    paymentRefNo: "",
    issueDate: new Date().toISOString().slice(0, 10), // yyyy-mm-dd
    registeredPlace: "",
  })

  // debounce ค้นหาลูกค้าจากเลขบัตร
  const debouncedCitizenId = useDebounce(customer.citizenId)

  // เติมอัตโนมัติถ้าเจอลูกค้า
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

    // เริ่มค้นหา
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

  // คำนวณหักน้ำหนักอัตโนมัติ (ถ้าไม่ manual)
  const autoDeduct = useMemo(() => {
    if (order.manualDeduct) return toNumber(order.deductWeightKg)
    return suggestDeductionWeight(order.grossWeightKg, order.moisturePct, order.impurityPct)
  }, [order.manualDeduct, order.deductWeightKg, order.grossWeightKg, order.moisturePct, order.impurityPct])

  const netWeight = useMemo(() => {
    const n = toNumber(order.grossWeightKg) - toNumber(autoDeduct)
    return n > 0 ? n : 0
  }, [order.grossWeightKg, autoDeduct])

  // เป็นเงิน (ถ้ากรอกราคาต่อกก. จะคำนวณให้โดยอัตโนมัติ แต่ยังแก้ไขได้)
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
      // success
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
      <h1 className="mb-4 text-2xl font-bold text-emerald-700">🧾 บันทึกออเดอร์ซื้อข้าวเปลือก</h1>

      {/* ค้นหาลูกค้าด้วยเลขบัตร */}
      <div className="text-black mb-6 rounded-2xl border border-emerald-200 bg-white p-4 shadow-sm">
        <h2 className="mb-3 text-lg font-semibold">ข้อมูลลูกค้า</h2>
        <div className="grid gap-4 md:grid-cols-3">
          <div className="md:col-span-1">
            <label className="mb-1 block text-sm font-medium">เลขที่บัตรประชาชน (13 หลัก)</label>
            <input
              inputMode="numeric"
              maxLength={13}
              className={`w-full rounded-xl border p-2 outline-none transition ${
                errors.citizenId ? "border-red-400" : "border-slate-300 focus:border-emerald-500"
              }`}
              value={customer.citizenId}
              onChange={(e) => updateCustomer("citizenId", onlyDigits(e.target.value))}
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
              {errors.citizenId && <span className="text-red-500"> — {errors.citizenId}</span>}
            </div>
          </div>

          <div className="md:col-span-2"> 
            <label className="mb-1 block text-sm font-medium">ชื่อ–สกุล</label>
            <input
              className={`w-full rounded-xl border p-2 outline-none transition ${
                errors.fullName ? "border-red-400" : "border-slate-300 focus:border-emerald-500"
              }`}
              value={customer.fullName}
              onChange={(e) => updateCustomer("fullName", e.target.value)}
              placeholder="เช่น นายสมชาย ใจดี"
            />
            {errors.fullName && <p className="mt-1 text-sm text-red-500">{errors.fullName}</p>}
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium">บ้านเลขที่</label>
            <input
              className="w-full rounded-xl border border-slate-300 p-2 outline-none focus:border-emerald-500"
              value={customer.houseNo}
              onChange={(e) => updateCustomer("houseNo", e.target.value)}
              placeholder="เช่น 99/1"
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium">หมู่</label>
            <input
              className="w-full rounded-xl border border-slate-300 p-2 outline-none focus:border-emerald-500"
              value={customer.moo}
              onChange={(e) => updateCustomer("moo", e.target.value)}
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
              onChange={(e) => updateCustomer("subdistrict", e.target.value)}
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
              onChange={(e) => updateCustomer("district", e.target.value)}
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
              onChange={(e) => updateCustomer("province", e.target.value)}
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
              onChange={(e) => updateOrder("riceType", e.target.value)}
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
              onChange={(e) => updateOrder("moisturePct", onlyDigits(e.target.value))}
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
              onChange={(e) => updateOrder("impurityPct", onlyDigits(e.target.value))}
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
              onChange={(e) => updateOrder("grossWeightKg", e.target.value.replace(/[^\d.]/g, ""))}
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
                  onChange={(e) => updateOrder("manualDeduct", e.target.checked)}
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
              value={order.manualDeduct ? order.deductWeightKg : String(Math.round(autoDeduct * 100) / 100)}
              onChange={(e) => updateOrder("deductWeightKg", e.target.value.replace(/[^\d.]/g, ""))}
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
              value={Math.round(netWeight * 100) / 100}
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium">ราคาต่อกก. (บาท) (ไม่บังคับ)</label>
            <input
              inputMode="decimal"
              className="w-full rounded-xl border border-slate-300 p-2 outline-none focus:border-emerald-500"
              value={order.unitPrice}
              onChange={(e) => updateOrder("unitPrice", e.target.value.replace(/[^\d.]/g, ""))}
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
              onChange={(e) => updateOrder("amountTHB", e.target.value.replace(/[^\d.]/g, ""))}
              placeholder="เช่น 60000"
            />
            {!!order.amountTHB && (
              <p className="mt-1 text-xs text-slate-500">≈ {thb(Number(order.amountTHB))}</p>
            )}
            {errors.amountTHB && <p className="mt-1 text-sm text-red-500">{errors.amountTHB}</p>}
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium">เลขที่ใบสำคัญจ่ายเงิน</label>
            <input
              className="w-full rounded-xl border border-slate-300 p-2 outline-none focus:border-emerald-500"
              value={order.paymentRefNo}
              onChange={(e) => updateOrder("paymentRefNo", e.target.value)}
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
              onChange={(e) => updateOrder("issueDate", e.target.value)}
            />
            {errors.issueDate && <p className="mt-1 text-sm text-red-500">{errors.issueDate}</p>}
          </div>

          <div className="md:col-span-2">
            <label className="mb-1 block text-sm font-medium">สถานที่ขึ้นจดทะเบียน</label>
            <input
              className="w-full rounded-xl border border-slate-300 p-2 outline-none focus:border-emerald-500"
              value={order.registeredPlace}
              onChange={(e) => updateOrder("registeredPlace", e.target.value)}
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
              <div className="text-lg font-semibold">{Math.round(autoDeduct * 100) / 100} กก.</div>
            </div>
            <div className="rounded-lg bg-white p-3 text-sm shadow">
              <div className="text-slate-500">น้ำหนักสุทธิ</div>
              <div className="text-lg font-semibold">{Math.round(netWeight * 100) / 100} กก.</div>
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
