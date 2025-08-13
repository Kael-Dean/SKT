import { useEffect, useMemo, useState } from "react"

/** ---------- Utils ---------- */
const onlyDigits = (s = "") => s.replace(/\D+/g, "")
const toNumber = (v) => (v === "" || v === null || v === undefined ? 0 : Number(v))

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

// จัดรูปแบบเลขทะเบียนเป็น 000-0000-0000 อัตโนมัติ (เก็บเป็น digits ล้วนตอนส่ง)
function formatRegisterNo(raw) {
  const d = onlyDigits(raw).slice(0, 11)
  const p1 = d.slice(0, 3)
  const p2 = d.slice(3, 7)
  const p3 = d.slice(7, 11)
  if (d.length <= 3) return p1
  if (d.length <= 7) return `${p1}-${p2}`
  return `${p1}-${p2}-${p3}`
}

/** ---------- Component ---------- */
const MemberSignup = () => {
  const [errors, setErrors] = useState({})
  const [checkingCid, setCheckingCid] = useState(false)
  const [cidExists, setCidExists] = useState(null) // true | false | null

  const [form, setForm] = useState({
    // ข้อมูลสมาชิก
    prefix: "",
    firstName: "",
    lastName: "",
    gender: "", // male | female
    maritalStatus: "", // single | married | divorced | widowed
    citizenId: "",
    registerNo: "", // 000-0000-0000
    group: "",
    depositAccount: "",

    // ที่อยู่
    houseNo: "",
    moo: "",
    subdistrict: "",
    district: "",
    province: "",
    postalCode: "",
    phone: "",

    // อาชีพและรายได้
    occupation: "",
    incomePerMonth: "",
    extraIncome: "",

    // ที่ดินถือครอง
    landType: "", // own | rent | other
    rai: "",
    ngan: "",
    wah: "",

    // ข้อมูลสินเชื่อ
    creditLimit: "",

    // อื่นๆ
    memberCode: "", // ให้ backend สร้าง -> ฟิลด์นี้ disabled
    joinDate: new Date().toISOString().slice(0, 10),
  })

  const update = (k, v) => setForm((prev) => ({ ...prev, [k]: v }))

  // ตรวจซ้ำ citizenId (ถ้ามี API)
  const debouncedCID = useDebounce(form.citizenId)
  useEffect(() => {
    const cid = onlyDigits(debouncedCID)
    if (cid.length !== 13 || !validateThaiCitizenId(cid)) {
      setCidExists(null)
      return
    }
    const check = async () => {
      try {
        setCheckingCid(true)
        setCidExists(null)
        const token = localStorage.getItem("token")
        const res = await fetch(`/api/members/check-cid/${cid}`, {
          headers: {
            "Content-Type": "application/json",
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
        })
        if (res.ok) {
          const { exists } = await res.json()
          setCidExists(!!exists)
        } else {
          setCidExists(null)
        }
      } catch {
        setCidExists(null)
      } finally {
        setCheckingCid(false)
      }
    }
    check()
  }, [debouncedCID])

  const validateAll = () => {
    const e = {}
    if (!form.prefix) e.prefix = "เลือกคำนำหน้า"
    if (!form.firstName) e.firstName = "กรุณากรอกชื่อ"
    if (!form.lastName) e.lastName = "กรุณากรอกนามสกุล"
    if (!form.gender) e.gender = "เลือกระบุเพศ"
    if (!form.maritalStatus) e.maritalStatus = "เลือกสถานภาพสมรส"
    if (!validateThaiCitizenId(form.citizenId)) e.citizenId = "เลขบัตรประชาชนไม่ถูกต้อง"
    if (!form.group) e.group = "เลือกกลุ่ม"
    if (!form.subdistrict || !form.district || !form.province) e.address = "กรุณากรอกที่อยู่ให้ครบ"
    if (!form.postalCode) e.postalCode = "กรอกรหัสไปรษณีย์"
    if (form.phone && onlyDigits(form.phone).length < 9) e.phone = "เบอร์โทรไม่ถูกต้อง"

    // รายได้
    if (form.incomePerMonth !== "" && isNaN(Number(form.incomePerMonth))) e.incomePerMonth = "ตัวเลขเท่านั้น"
    if (form.extraIncome !== "" && isNaN(Number(form.extraIncome))) e.extraIncome = "ตัวเลขเท่านั้น"

    // ที่ดินถือครอง (ถ้ากรอกอย่างใดอย่างหนึ่ง ให้ตรวจว่าเป็นตัวเลข)
    ;["rai", "ngan", "wah"].forEach((k) => {
      if (form[k] !== "" && isNaN(Number(form[k]))) e[k] = "ตัวเลขเท่านั้น"
    })

    // สินเชื่อ
    if (form.creditLimit !== "" && isNaN(Number(form.creditLimit))) e.creditLimit = "ตัวเลขเท่านั้น"

    if (!form.joinDate) e.joinDate = "เลือกวันที่เป็นสมาชิก"
    setErrors(e)
    return Object.keys(e).length === 0
  }

  const landTotalWah = useMemo(() => {
    const rai = toNumber(form.rai)
    const ngan = toNumber(form.ngan)
    const wah = toNumber(form.wah)
    return rai * 400 + ngan * 100 + wah
  }, [form.rai, form.ngan, form.wah])

  const handleSubmit = async (ev) => {
    ev.preventDefault()
    if (!validateAll()) return

    const payload = {
      prefix: form.prefix,
      firstName: form.firstName.trim(),
      lastName: form.lastName.trim(),
      gender: form.gender,
      maritalStatus: form.maritalStatus,
      citizenId: onlyDigits(form.citizenId),
      registerNo: onlyDigits(form.registerNo), // เก็บเป็น digits
      group: form.group,
      depositAccount: form.depositAccount.trim(),
      address: {
        houseNo: form.houseNo.trim(),
        moo: form.moo.trim(),
        subdistrict: form.subdistrict.trim(),
        district: form.district.trim(),
        province: form.province.trim(),
        postalCode: form.postalCode.trim(),
        phone: form.phone.trim(),
      },
      occupation: form.occupation,
      incomePerMonth: form.incomePerMonth === "" ? null : toNumber(form.incomePerMonth),
      extraIncome: form.extraIncome === "" ? null : toNumber(form.extraIncome),
      landHolding: {
        landType: form.landType, // own | rent | other
        rai: toNumber(form.rai),
        ngan: toNumber(form.ngan),
        wah: toNumber(form.wah),
        totalWah: landTotalWah,
      },
      credit: {
        limitTHB: form.creditLimit === "" ? null : toNumber(form.creditLimit),
      },
      joinDate: form.joinDate,
      // memberCode: ให้ backend สร้าง
    }

    try {
      const token = localStorage.getItem("token")
      const res = await fetch("/api/members", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify(payload),
      })
      if (!res.ok) throw new Error("สมัครสมาชิกไม่สำเร็จ")
      alert("บันทึกสมาชิกเรียบร้อย ✅")
      handleReset()
    } catch (err) {
      console.error(err)
      alert("บันทึกล้มเหลว กรุณาลองใหม่")
    }
  }

  const handleReset = () => {
    setErrors({})
    setCidExists(null)
    setCheckingCid(false)
    setForm((prev) => ({
      ...prev,
      prefix: "",
      firstName: "",
      lastName: "",
      gender: "",
      maritalStatus: "",
      citizenId: "",
      registerNo: "",
      group: "",
      depositAccount: "",
      houseNo: "",
      moo: "",
      subdistrict: "",
      district: "",
      province: "",
      postalCode: "",
      phone: "",
      occupation: "",
      incomePerMonth: "",
      extraIncome: "",
      landType: "",
      rai: "",
      ngan: "",
      wah: "",
      creditLimit: "",
      memberCode: "",
      joinDate: new Date().toISOString().slice(0, 10),
    }))
  }

  /** ---------- UI ---------- */
  return (
    <div className="mx-auto max-w-6xl p-4 md:p-6">
      <h1 className="mb-4 text-2xl font-bold text-white">👤 สมัครสมาชิก</h1>

      {/* ข้อมูลสมาชิก */}
      <form onSubmit={handleSubmit} className="rounded-2xl border border-emerald-200 bg-white p-4 shadow-sm">
        <h2 className="mb-3 text-lg font-semibold text-black">ข้อมูลสมาชิก</h2>

        <div className="grid gap-4 md:grid-cols-4 text-black">
          <div>
            <label className="mb-1 block text-sm font-medium">คำนำหน้า</label>
            <select
              className={`w-full rounded-xl border p-2 outline-none transition ${
                errors.prefix ? "border-red-400" : "border-slate-300 focus:border-emerald-500"
              }`}
              value={form.prefix}
              onChange={(e) => update("prefix", e.target.value)}
            >
              <option value="">— เลือก —</option>
              <option value="นาย">นาย</option>
              <option value="นาง">นาง</option>
              <option value="นางสาว">นางสาว</option>
              <option value="อื่นๆ">อื่นๆ</option>
            </select>
            {errors.prefix && <p className="mt-1 text-sm text-red-500">{errors.prefix}</p>}
          </div>

          <div className="md:col-span-2">
            <label className="mb-1 block text-sm font-medium">ชื่อ</label>
            <input
              className={`w-full rounded-xl border p-2 outline-none transition ${
                errors.firstName ? "border-red-400" : "border-slate-300 focus:border-emerald-500"
              }`}
              value={form.firstName}
              onChange={(e) => update("firstName", e.target.value)}
              placeholder="เช่น สมชาย"
            />
            {errors.firstName && <p className="mt-1 text-sm text-red-500">{errors.firstName}</p>}
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium">นามสกุล</label>
            <input
              className={`w-full rounded-xl border p-2 outline-none transition ${
                errors.lastName ? "border-red-400" : "border-slate-300 focus:border-emerald-500"
              }`}
              value={form.lastName}
              onChange={(e) => update("lastName", e.target.value)}
              placeholder="เช่น ใจดี"
            />
            {errors.lastName && <p className="mt-1 text-sm text-red-500">{errors.lastName}</p>}
          </div>

          <div className="md:col-span-2">
            <label className="mb-1 block text-sm font-medium">เพศ</label>
            <div className={`flex gap-6 rounded-xl border p-2 ${errors.gender ? "border-red-400" : "border-slate-300"}`}>
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="radio"
                  name="gender"
                  checked={form.gender === "male"}
                  onChange={() => update("gender", "male")}
                />
                ชาย
              </label>
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="radio"
                  name="gender"
                  checked={form.gender === "female"}
                  onChange={() => update("gender", "female")}
                />
                หญิง
              </label>
            </div>
            {errors.gender && <p className="mt-1 text-sm text-red-500">{errors.gender}</p>}
          </div>

          <div className="md:col-span-2">
            <label className="mb-1 block text-sm font-medium">สถานภาพสมรส</label>
            <select
              className={`w-full rounded-xl border p-2 outline-none transition ${
                errors.maritalStatus ? "border-red-400" : "border-slate-300 focus:border-emerald-500"
              }`}
              value={form.maritalStatus}
              onChange={(e) => update("maritalStatus", e.target.value)}
            >
              <option value="">— เลือก —</option>
              <option value="single">โสด</option>
              <option value="married">สมรส</option>
              <option value="divorced">หย่า</option>
              <option value="widowed">คู่สมรสเสียชีวิต</option>
            </select>
            {errors.maritalStatus && <p className="mt-1 text-sm text-red-500">{errors.maritalStatus}</p>}
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium">เลขบัตรประชาชน (13 หลัก)</label>
            <input
              inputMode="numeric"
              maxLength={13}
              className={`w-full rounded-xl border p-2 outline-none transition ${
                errors.citizenId ? "border-red-400" : "border-slate-300 focus:border-emerald-500"
              }`}
              value={form.citizenId}
              onChange={(e) => update("citizenId", onlyDigits(e.target.value))}
              placeholder="เช่น 1234567890123"
            />
            <div className="mt-1 text-xs text-slate-500">
              {checkingCid && "กำลังตรวจสอบสมาชิกซ้ำ..."}
              {!checkingCid && form.citizenId.length === 13 && cidExists === true && (
                <span className="text-amber-600">เลขบัตรนี้มีอยู่ในระบบแล้ว</span>
              )}
              {errors.citizenId && <span className="text-red-500"> — {errors.citizenId}</span>}
            </div>
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium">เลขทะเบียน</label>
            <input
              className="w-full rounded-xl border border-slate-300 p-2 outline-none focus:border-emerald-500"
              value={form.registerNo}
              onChange={(e) => update("registerNo", formatRegisterNo(e.target.value))}
              placeholder="000-0000-0000"
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium">กลุ่ม</label>
            <select
              className={`w-full rounded-xl border p-2 outline-none transition ${
                errors.group ? "border-red-400" : "border-slate-300 focus:border-emerald-500"
              }`}
              value={form.group}
              onChange={(e) => update("group", e.target.value)}
            >
              <option value="">— เลือก —</option>
              <option value="A">กลุ่ม A</option>
              <option value="B">กลุ่ม B</option>
              <option value="C">กลุ่ม C</option>
            </select>
            {errors.group && <p className="mt-1 text-sm text-red-500">{errors.group}</p>}
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium">บัญชีเงินฝาก</label>
            <input
              className="w-full rounded-xl border border-slate-300 p-2 outline-none focus:border-emerald-500"
              value={form.depositAccount}
              onChange={(e) => update("depositAccount", e.target.value)}
              placeholder="เช่น 123-4-56789-0"
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium">รหัสสมาชิก (ให้ระบบออก)</label>
            <input
              disabled
              className="w-full rounded-xl border border-slate-300 bg-slate-100 p-2 outline-none"
              value={form.memberCode || "ระบบจะสร้างอัตโนมัติหลังบันทึก"}
              readOnly
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium">วันที่เป็นสมาชิก</label>
            <input
              type="date"
              className={`w-full rounded-xl border p-2 outline-none transition ${
                errors.joinDate ? "border-red-400" : "border-slate-300 focus:border-emerald-500"
              }`}
              value={form.joinDate}
              onChange={(e) => update("joinDate", e.target.value)}
            />
            {errors.joinDate && <p className="mt-1 text-sm text-red-500">{errors.joinDate}</p>}
          </div>
        </div>

        {/* ที่อยู่ */}
        <div className="mt-6 rounded-2xl border border-emerald-100 bg-white p-4">
          <h3 className="mb-3 text-base font-semibold text-black">ที่อยู่</h3>
          <div className="grid gap-4 md:grid-cols-3 text-black">
            <div>
              <label className="mb-1 block text-sm font-medium">บ้านเลขที่</label>
              <input
                className="w-full rounded-xl border border-slate-300 p-2 outline-none focus:border-emerald-500"
                value={form.houseNo}
                onChange={(e) => update("houseNo", e.target.value)}
                placeholder="เช่น 99/1"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium">หมู่</label>
              <input
                className="w-full rounded-xl border border-slate-300 p-2 outline-none focus:border-emerald-500"
                value={form.moo}
                onChange={(e) => update("moo", e.target.value)}
                placeholder="เช่น 4"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium">ตำบล</label>
              <input
                className={`w-full rounded-xl border p-2 outline-none transition ${
                  errors.address ? "border-amber-400" : "border-slate-300 focus:border-emerald-500"
                }`}
                value={form.subdistrict}
                onChange={(e) => update("subdistrict", e.target.value)}
                placeholder="เช่น หนองปลาไหล"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium">อำเภอ</label>
              <input
                className={`w-full rounded-xl border p-2 outline-none transition ${
                  errors.address ? "border-amber-400" : "border-slate-300 focus:border-emerald-500"
                }`}
                value={form.district}
                onChange={(e) => update("district", e.target.value)}
                placeholder="เช่น เมือง"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium">จังหวัด</label>
              <input
                className={`w-full rounded-xl border p-2 outline-none transition ${
                  errors.address ? "border-amber-400" : "border-slate-300 focus:border-emerald-500"
                }`}
                value={form.province}
                onChange={(e) => update("province", e.target.value)}
                placeholder="เช่น ขอนแก่น"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium">รหัสไปรษณีย์</label>
              <input
                inputMode="numeric"
                maxLength={5}
                className={`w-full rounded-xl border p-2 outline-none transition ${
                  errors.postalCode ? "border-red-400" : "border-slate-300 focus:border-emerald-500"
                }`}
                value={form.postalCode}
                onChange={(e) => update("postalCode", onlyDigits(e.target.value))}
                placeholder="เช่น 40000"
              />
              {errors.postalCode && <p className="mt-1 text-sm text-red-500">{errors.postalCode}</p>}
            </div>
            <div className="md:col-span-2">
              <label className="mb-1 block text-sm font-medium">โทรศัพท์</label>
              <input
                inputMode="tel"
                className={`w-full rounded-xl border p-2 outline-none transition ${
                  errors.phone ? "border-red-400" : "border-slate-300 focus:border-emerald-500"
                }`}
                value={form.phone}
                onChange={(e) => update("phone", e.target.value)}
                placeholder="เช่น 08x-xxx-xxxx"
              />
              {errors.phone && <p className="mt-1 text-sm text-red-500">{errors.phone}</p>}
            </div>
          </div>
        </div>

        {/* อาชีพและรายได้ */}
        <div className="mt-6 rounded-2xl border border-emerald-100 bg-white p-4">
          <h3 className="mb-3 text-base font-semibold text-black">อาชีพและรายได้</h3>
          <div className="grid gap-4 md:grid-cols-3 text-black">
            <div>
              <label className="mb-1 block text-sm font-medium">อาชีพ</label>
              <select
                className="w-full rounded-xl border border-slate-300 p-2 outline-none focus:border-emerald-500"
                value={form.occupation}
                onChange={(e) => update("occupation", e.target.value)}
              >
                <option value="">— เลือก —</option>
                <option value="เกษตรกร">เกษตรกร</option>
                <option value="รับจ้าง">รับจ้าง</option>
                <option value="ค้าขาย">ค้าขาย</option>
                <option value="ข้าราชการ/รัฐวิสาหกิจ">ข้าราชการ/รัฐวิสาหกิจ</option>
                <option value="อื่นๆ">อื่นๆ</option>
              </select>
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium">รายได้ต่อเดือน (บาท)</label>
              <input
                inputMode="decimal"
                className={`w-full rounded-xl border p-2 outline-none transition ${
                  errors.incomePerMonth ? "border-red-400" : "border-slate-300 focus:border-emerald-500"
                }`}
                value={form.incomePerMonth}
                onChange={(e) => update("incomePerMonth", e.target.value.replace(/[^\d.]/g, ""))}
                placeholder="เช่น 15000"
              />
              {errors.incomePerMonth && <p className="mt-1 text-sm text-red-500">{errors.incomePerMonth}</p>}
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium">รายได้พิเศษ (บาท)</label>
              <input
                inputMode="decimal"
                className={`w-full rounded-xl border p-2 outline-none transition ${
                  errors.extraIncome ? "border-red-400" : "border-slate-300 focus:border-emerald-500"
                }`}
                value={form.extraIncome}
                onChange={(e) => update("extraIncome", e.target.value.replace(/[^\d.]/g, ""))}
                placeholder="เช่น 3000"
              />
              {errors.extraIncome && <p className="mt-1 text-sm text-red-500">{errors.extraIncome}</p>}
            </div>
          </div>
        </div>

        {/* ที่ดินถือครอง */}
        <div className="mt-6 rounded-2xl border border-emerald-100 bg-white p-4">
          <h3 className="mb-3 text-base font-semibold text-black">ที่ดินถือครอง</h3>
          <div className="grid gap-4 md:grid-cols-4 text-black">
            <div className="md:col-span-1">
              <label className="mb-1 block text-sm font-medium">ประเภท</label>
              <select
                className="w-full rounded-xl border border-slate-300 p-2 outline-none focus:border-emerald-500"
                value={form.landType}
                onChange={(e) => update("landType", e.target.value)}
              >
                <option value="">— เลือก —</option>
                <option value="own">ของตนเอง</option>
                <option value="rent">เช่า</option>
                <option value="other">อื่นๆ</option>
              </select>
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium">ไร่</label>
              <input
                inputMode="numeric"
                className={`w-full rounded-xl border p-2 outline-none transition ${
                  errors.rai ? "border-red-400" : "border-slate-300 focus:border-emerald-500"
                }`}
                value={form.rai}
                onChange={(e) => update("rai", onlyDigits(e.target.value))}
                placeholder="0"
              />
              {errors.rai && <p className="mt-1 text-sm text-red-500">{errors.rai}</p>}
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium">งาน</label>
              <input
                inputMode="numeric"
                className={`w-full rounded-xl border p-2 outline-none transition ${
                  errors.ngan ? "border-red-400" : "border-slate-300 focus:border-emerald-500"
                }`}
                value={form.ngan}
                onChange={(e) => update("ngan", onlyDigits(e.target.value))}
                placeholder="0"
              />
              {errors.ngan && <p className="mt-1 text-sm text-red-500">{errors.ngan}</p>}
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium">ตารางวา</label>
              <input
                inputMode="numeric"
                className={`w-full rounded-xl border p-2 outline-none transition ${
                  errors.wah ? "border-red-400" : "border-slate-300 focus:border-emerald-500"
                }`}
                value={form.wah}
                onChange={(e) => update("wah", onlyDigits(e.target.value))}
                placeholder="0"
              />
              {errors.wah && <p className="mt-1 text-sm text-red-500">{errors.wah}</p>}
            </div>
          </div>
          <p className="mt-2 text-xs text-slate-500">
            รวม ≈ {landTotalWah} ตารางวา (1 ไร่ = 400 ตรว., 1 งาน = 100 ตรว.)
          </p>
        </div>

        {/* ข้อมูลสินเชื่อ */}
        <div className="mt-6 rounded-2xl border border-emerald-100 bg-white p-4">
          <h3 className="mb-3 text-base font-semibold text-black">ข้อมูลสินเชื่อ</h3>
          <div className="grid gap-4 md:grid-cols-3 text-black">
            <div>
              <label className="mb-1 block text-sm font-medium">วงเงินสินเชื่อ (บาท)</label>
              <input
                inputMode="decimal"
                className={`w-full rounded-xl border p-2 outline-none transition ${
                  errors.creditLimit ? "border-red-400" : "border-slate-300 focus:border-emerald-500"
                }`}
                value={form.creditLimit}
                onChange={(e) => update("creditLimit", e.target.value.replace(/[^\d.]/g, ""))}
                placeholder="เช่น 50000"
              />
              {errors.creditLimit && <p className="mt-1 text-sm text-red-500">{errors.creditLimit}</p>}
            </div>
          </div>
        </div>

        {/* ปุ่ม */}
        <div className="mt-6 flex flex-col gap-3 sm:flex-row">
          <button
            type="submit"
            className="inline-flex items-center justify-center rounded-xl bg-emerald-600 px-5 py-2.5 font-medium text-white hover:bg-emerald-700 active:scale-[.98]"
          >
            บันทึกการสมัครสมาชิก
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

export default MemberSignup
