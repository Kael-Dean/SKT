import { useMemo, useState } from "react"

/** ---------- ENV: API BASE ---------- */
const API_BASE = import.meta.env.VITE_API_BASE // ต้องมีใน .env เช่น VITE_API_BASE=http://18.142.48.127

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

// จำกัดช่วงค่า งาน/วา
const clampNgan = (v) => {
  const n = toNumber(onlyDigits(v))
  return Math.max(0, Math.min(3, n)) // 0–3
}
const clampWa = (v) => {
  const n = toNumber(onlyDigits(v))
  return Math.max(0, Math.min(99, n)) // 0–99
}

/** ---------- Component ---------- */
const MemberSignup = () => {
  const [errors, setErrors] = useState({})
  const [submitting, setSubmitting] = useState(false)

  /**
   * ฟอร์มนี้ถูก “ทำให้ตรง” กับ RequestMember ของเพื่อน:
   * regis_date (date), member_id, precode, first_name, last_name,
   * citizen_id, address, mhoo, sub_district, district, province,
   * subprov, postal_code, phone_number, sex, salary, tgs_group,
   * share_per_month, transfer_date (optional), ar_limit, normal_share,
   * last_bought_date (date), bank_account, tgs_id, spouce_name, orders_placed
   *
   * และเพิ่มฟิลด์ที่ดินถือครอง 9 ช่อง:
   * own_rai, own_ngan, own_wa, rent_rai, rent_ngan, rent_wa, other_rai, other_ngan, other_wa
   */
  const [form, setForm] = useState({
    regis_date: new Date().toISOString().slice(0, 10), // yyyy-mm-dd
    member_id: "",
    precode: "",
    first_name: "",
    last_name: "",
    citizen_id: "",
    address: "",
    mhoo: "",
    sub_district: "",
    district: "",
    province: "",
    subprov: "",
    postal_code: "",
    phone_number: "",
    sex: "", // M | F
    salary: "",
    tgs_group: "",
    share_per_month: "",
    transfer_date: "", // optional
    ar_limit: "",
    normal_share: "",
    last_bought_date: new Date().toISOString().slice(0, 10), // yyyy-mm-dd
    bank_account: "",
    tgs_id: "",
    spouce_name: "",
    orders_placed: "",

    // ---------- ที่ดินถือครอง ----------
    own_rai: "",   own_ngan: "",   own_wa: "",
    rent_rai: "",  rent_ngan: "",  rent_wa: "",
    other_rai: "", other_ngan: "", other_wa: "",
  })

  const update = (k, v) => setForm((prev) => ({ ...prev, [k]: v }))

  const validateAll = () => {
    const e = {}
    if (!form.member_id) e.member_id = "กรอกเลขสมาชิก"
    if (!form.precode) e.precode = "กรอกคำนำหน้า (รหัส)"
    if (!form.first_name) e.first_name = "กรอกชื่อ"
    if (!form.last_name) e.last_name = "กรอกนามสกุล"

    if (!validateThaiCitizenId(form.citizen_id)) e.citizen_id = "เลขบัตรประชาชนไม่ถูกต้อง"

    if (!form.address) e.address = "กรอกที่อยู่"
    if (!form.sub_district) e.sub_district = "กรอกตำบล"
    if (!form.district) e.district = "กรอกอำเภอ"
    if (!form.province) e.province = "กรอกจังหวัด"
    if (!form.postal_code) e.postal_code = "กรอกรหัสไปรษณีย์"

    if (!form.phone_number) e.phone_number = "กรอกเบอร์โทร"
    if (!form.sex) e.sex = "เลือกเพศ (M/F)"

    // ตัวเลข
    ;[
      "member_id",
      "precode",
      "subprov",
      "postal_code",
      "salary",
      "tgs_group",
      "share_per_month",
      "ar_limit",
      "normal_share",
      "orders_placed",
      // land
      "own_rai","own_ngan","own_wa",
      "rent_rai","rent_ngan","rent_wa",
      "other_rai","other_ngan","other_wa",
    ].forEach((k) => {
      const v = form[k]
      if (v !== "" && isNaN(Number(v))) e[k] = "ตัวเลขเท่านั้น"
    })

    // เงื่อนไขช่วง งาน/วา/ไร่ (ถ้ากรอก)
    const landTriples = [
      ["own_rai","own_ngan","own_wa"],
      ["rent_rai","rent_ngan","rent_wa"],
      ["other_rai","other_ngan","other_wa"],
    ]
    landTriples.forEach(([r,n,w]) => {
      const vr = form[r], vn = form[n], vw = form[w]
      if (vn !== "" && (toNumber(vn) < 0 || toNumber(vn) > 3)) e[n] = "งานต้อง 0–3"
      if (vw !== "" && (toNumber(vw) < 0 || toNumber(vw) > 99)) e[w] = "วาต้อง 0–99"
      if (vr !== "" && toNumber(vr) < 0) e[r] = "ไร่ต้อง ≥ 0"
    })

    // วันที่
    if (!form.regis_date) e.regis_date = "เลือกวันที่สมัคร"
    if (!form.last_bought_date) e.last_bought_date = "เลือกวันที่ซื้อครั้งล่าสุด (หรือกำหนดคร่าวๆได้)"

    setErrors(e)
    return Object.keys(e).length === 0
  }

  // แสดง preview เล็ก ๆ (เดิม)
  const landPreview = useMemo(() => {
    const ns = toNumber(form.normal_share)
    return ns ? `${ns.toLocaleString()} หุ้นปกติ` : ""
  }, [form.normal_share])

  const handleSubmit = async (ev) => {
    ev.preventDefault()
    if (!validateAll()) return
    setSubmitting(true)

    const toISODate = (d) => (d ? new Date(d).toISOString() : null)

    const payload = {
      regis_date: toISODate(form.regis_date),
      member_id: Number(form.member_id),
      precode: Number(form.precode),
      first_name: form.first_name.trim(),
      last_name: form.last_name.trim(),
      citizen_id: onlyDigits(form.citizen_id),
      address: form.address.trim(),
      mhoo: form.mhoo.trim(),
      sub_district: form.sub_district.trim(),
      district: form.district.trim(),
      province: form.province.trim(),
      subprov: form.subprov === "" ? null : Number(form.subprov),
      postal_code: Number(form.postal_code),
      phone_number: form.phone_number.trim(),
      sex: form.sex, // "M" | "F"
      salary: form.salary === "" ? 0 : Number(form.salary),
      tgs_group: form.tgs_group === "" ? 0 : Number(form.tgs_group),
      share_per_month: form.share_per_month === "" ? 0 : Number(form.share_per_month),
      transfer_date: form.transfer_date ? toISODate(form.transfer_date) : null, // optional
      ar_limit: form.ar_limit === "" ? 0 : Number(form.ar_limit),
      normal_share: form.normal_share === "" ? 0 : Number(form.normal_share),
      last_bought_date: toISODate(form.last_bought_date),
      bank_account: form.bank_account.trim(),
      tgs_id: form.tgs_id.trim(),
      spouce_name: form.spouce_name.trim(), // สะกดตามสคีมาของเพื่อน
      orders_placed: form.orders_placed === "" ? 0 : Number(form.orders_placed),

      // ----- ใหม่: ที่ดินถือครอง -----
      own_rai:  form.own_rai === "" ? 0 : Number(form.own_rai),
      own_ngan: form.own_ngan === "" ? 0 : Number(form.own_ngan),
      own_wa:   form.own_wa === "" ? 0 : Number(form.own_wa),

      rent_rai:  form.rent_rai === "" ? 0 : Number(form.rent_rai),
      rent_ngan: form.rent_ngan === "" ? 0 : Number(form.rent_ngan),
      rent_wa:   form.rent_wa === "" ? 0 : Number(form.rent_wa),

      other_rai:  form.other_rai === "" ? 0 : Number(form.other_rai),
      other_ngan: form.other_ngan === "" ? 0 : Number(form.other_ngan),
      other_wa:   form.other_wa === "" ? 0 : Number(form.other_wa),
    }

    try {
      const res = await fetch(`${API_BASE}/member/members/save`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      })
      if (!res.ok) {
        const text = await res.text()
        throw new Error(text || "สมัครสมาชิกไม่สำเร็จ")
      }
      alert("บันทึกสมาชิกเรียบร้อย ✅")
      handleReset()
    } catch (err) {
      console.error(err)
      alert(`บันทึกล้มเหลว: ${err.message}`)
    } finally {
      setSubmitting(false)
    }
  }

  const handleReset = () => {
    setErrors({})
    setForm({
      regis_date: new Date().toISOString().slice(0, 10),
      member_id: "",
      precode: "",
      first_name: "",
      last_name: "",
      citizen_id: "",
      address: "",
      mhoo: "",
      sub_district: "",
      district: "",
      province: "",
      subprov: "",
      postal_code: "",
      phone_number: "",
      sex: "",
      salary: "",
      tgs_group: "",
      share_per_month: "",
      transfer_date: "",
      ar_limit: "",
      normal_share: "",
      last_bought_date: new Date().toISOString().slice(0, 10),
      bank_account: "",
      tgs_id: "",
      spouce_name: "",
      orders_placed: "",

      // reset land
      own_rai:"", own_ngan:"", own_wa:"",
      rent_rai:"", rent_ngan:"", rent_wa:"",
      other_rai:"", other_ngan:"", other_wa:"",
    })
  }
  
  /** ---------- UI ---------- */
  return (
    <div className="mx-auto max-w-6xl p-4 md:p-6">
      <h1 className="mb-4 text-2xl font-bold text-gray-900 dark:text-white">👤 สมัครสมาชิก </h1>

      <form onSubmit={handleSubmit} className="rounded-2xl border border-emerald-200 bg-white p-4 shadow-sm">
        <h2 className="mb-3 text-lg font-semibold text-black">ข้อมูลหลัก</h2>

        <div className="grid gap-4 md:grid-cols-4 text-black">
          <div>
            <label className="mb-1 block text-sm font-medium">เลขสมาชิก (member_id)</label>
            <input
              inputMode="numeric"
              className={`w-full rounded-xl border p-2 ${errors.member_id ? "border-red-400" : "border-slate-300 focus:border-emerald-500"}`}
              value={form.member_id}
              onChange={(e) => update("member_id", onlyDigits(e.target.value))}
              placeholder="เช่น 11263"
            />
            {errors.member_id && <p className="mt-1 text-sm text-red-500">{errors.member_id}</p>}
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium">คำนำหน้า (precode)</label>
            <input
              inputMode="numeric"
              className={`w-full rounded-xl border p-2 ${errors.precode ? "border-red-400" : "border-slate-300 focus:border-emerald-500"}`}
              value={form.precode}
              onChange={(e) => update("precode", onlyDigits(e.target.value))}
              placeholder="เช่น 1"
            />
            {errors.precode && <p className="mt-1 text-sm text-red-500">{errors.precode}</p>}
          </div>

          <div className="md:col-span-2">
            <label className="mb-1 block text-sm font-medium">วันที่สมัคร (regis_date)</label>
            <input
              type="date"
              className={`w-full rounded-xl border p-2 ${errors.regis_date ? "border-red-400" : "border-slate-300 focus:border-emerald-500"}`}
              value={form.regis_date}
              onChange={(e) => update("regis_date", e.target.value)}
            />
            {errors.regis_date && <p className="mt-1 text-sm text-red-500">{errors.regis_date}</p>}
          </div>

          <div className="md:col-span-2">
            <label className="mb-1 block text-sm font-medium">ชื่อ</label>
            <input
              className={`w-full rounded-xl border p-2 ${errors.first_name ? "border-red-400" : "border-slate-300 focus:border-emerald-500"}`}
              value={form.first_name}
              onChange={(e) => update("first_name", e.target.value)}
              placeholder="สมชาย"
            />
            {errors.first_name && <p className="mt-1 text-sm text-red-500">{errors.first_name}</p>}
          </div>

          <div className="md:col-span-2">
            <label className="mb-1 block text-sm font-medium">นามสกุล</label>
            <input
              className={`w-full rounded-xl border p-2 ${errors.last_name ? "border-red-400" : "border-slate-300 focus:border-emerald-500"}`}
              value={form.last_name}
              onChange={(e) => update("last_name", e.target.value)}
              placeholder="ใจดี"
            />
            {errors.last_name && <p className="mt-1 text-sm text-red-500">{errors.last_name}</p>}
          </div>

          <div className="md:col-span-2">
            <label className="mb-1 block text-sm font-medium">เลขบัตรประชาชน (13 หลัก)</label>
            <input
              inputMode="numeric"
              maxLength={13}
              className={`w-full rounded-xl border p-2 ${errors.citizen_id ? "border-red-400" : "border-slate-300 focus:border-emerald-500"}`}
              value={form.citizen_id}
              onChange={(e) => update("citizen_id", onlyDigits(e.target.value))}
              placeholder="1234567890123"
            />
            {errors.citizen_id && <p className="mt-1 text-sm text-red-500">{errors.citizen_id}</p>}
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium">เพศ (M/F)</label>
            <select
              className={`w-full rounded-xl border p-2 ${errors.sex ? "border-red-400" : "border-slate-300 focus:border-emerald-500"}`}
              value={form.sex}
              onChange={(e) => update("sex", e.target.value)}
            >
              <option value="">— เลือก —</option>
              <option value="M">ชาย</option>
              <option value="F">หญิง</option>
            </select>
            {errors.sex && <p className="mt-1 text-sm text-red-500">{errors.sex}</p>}
          </div>

          <div className="md:col-span-3">
            <label className="mb-1 block text-sm font-medium">ที่อยู่ (address)</label>
            <input
              className={`w-full rounded-xl border p-2 ${errors.address ? "border-red-400" : "border-slate-300 focus:border-emerald-500"}`}
              value={form.address}
              onChange={(e) => update("address", e.target.value)}
              placeholder="บ้านเลขที่ หมู่ ตำบล อำเภอ จังหวัด"
            />
            {errors.address && <p className="mt-1 text-sm text-red-500">{errors.address}</p>}
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium">หมู่ (mhoo)</label>
            <input
              className="w-full rounded-xl border p-2 border-slate-300 focus:border-emerald-500"
              value={form.mhoo}
              onChange={(e) => update("mhoo", e.target.value)}
              placeholder="เช่น 1"
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium">ตำบล (sub_district)</label>
            <input
              className={`w-full rounded-xl border p-2 ${errors.sub_district ? "border-red-400" : "border-slate-300 focus:border-emerald-500"}`}
              value={form.sub_district}
              onChange={(e) => update("sub_district", e.target.value)}
            />
            {errors.sub_district && <p className="mt-1 text-sm text-red-500">{errors.sub_district}</p>}
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium">อำเภอ (district)</label>
            <input
              className={`w-full rounded-xl border p-2 ${errors.district ? "border-red-400" : "border-slate-300 focus:border-emerald-500"}`}
              value={form.district}
              onChange={(e) => update("district", e.target.value)}
            />
            {errors.district && <p className="mt-1 text-sm text-red-500">{errors.district}</p>}
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium">จังหวัด (province)</label>
            <input
              className={`w-full rounded-xl border p-2 ${errors.province ? "border-red-400" : "border-slate-300 focus:border-emerald-500"}`}
              value={form.province}
              onChange={(e) => update("province", e.target.value)}
            />
            {errors.province && <p className="mt-1 text-sm text-red-500">{errors.province}</p>}
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium">อำเภอย่อย/รหัสอำเภอ (subprov)</label>
            <input
              inputMode="numeric"
              className="w-full rounded-xl border p-2 border-slate-300 focus:border-emerald-500"
              value={form.subprov}
              onChange={(e) => update("subprov", onlyDigits(e.target.value))}
              placeholder="เช่น 501"
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium">รหัสไปรษณีย์</label>
            <input
              inputMode="numeric"
              maxLength={5}
              className={`w-full rounded-xl border p-2 ${errors.postal_code ? "border-red-400" : "border-slate-300 focus:border-emerald-500"}`}
              value={form.postal_code}
              onChange={(e) => update("postal_code", onlyDigits(e.target.value))}
            />
            {errors.postal_code && <p className="mt-1 text-sm text-red-500">{errors.postal_code}</p>}
          </div>

          <div className="md:col-span-2">
            <label className="mb-1 block text-sm font-medium">โทรศัพท์ (phone_number)</label>
            <input
              inputMode="tel"
              className={`w-full rounded-xl border p-2 ${errors.phone_number ? "border-red-400" : "border-slate-300 focus:border-emerald-500"}`}
              value={form.phone_number}
              onChange={(e) => update("phone_number", e.target.value)}
              placeholder="08x-xxx-xxxx"
            />
            {errors.phone_number && <p className="mt-1 text-sm text-red-500">{errors.phone_number}</p>}
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium">เงินเดือน (salary)</label>
            <input
              inputMode="decimal"
              className={`w-full rounded-xl border p-2 ${errors.salary ? "border-red-400" : "border-slate-300 focus:border-emerald-500"}`}
              value={form.salary}
              onChange={(e) => update("salary", e.target.value.replace(/[^\d.]/g, ""))}
              placeholder="15000"
            />
            {errors.salary && <p className="mt-1 text-sm text-red-500">{errors.salary}</p>}
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium">กลุ่ม (tgs_group)</label>
            <input
              inputMode="numeric"
              className={`w-full rounded-xl border p-2 ${errors.tgs_group ? "border-red-400" : "border-slate-300 focus:border-emerald-500"}`}
              value={form.tgs_group}
              onChange={(e) => update("tgs_group", onlyDigits(e.target.value))}
              placeholder="16"
            />
            {errors.tgs_group && <p className="mt-1 text-sm text-red-500">{errors.tgs_group}</p>}
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium">ส่งหุ้น/เดือน (share_per_month)</label>
            <input
              inputMode="decimal"
              className={`w-full rounded-xl border p-2 ${errors.share_per_month ? "border-red-400" : "border-slate-300 focus:border-emerald-500"}`}
              value={form.share_per_month}
              onChange={(e) => update("share_per_month", e.target.value.replace(/[^\d.]/g, ""))}
              placeholder="500"
            />
            {errors.share_per_month && <p className="mt-1 text-sm text-red-500">{errors.share_per_month}</p>}
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium">วงเงินสินเชื่อ (ar_limit)</label>
            <input
              inputMode="numeric"
              className={`w-full rounded-xl border p-2 ${errors.ar_limit ? "border-red-400" : "border-slate-300 focus:border-emerald-500"}`}
              value={form.ar_limit}
              onChange={(e) => update("ar_limit", onlyDigits(e.target.value))}
              placeholder="100000"
            />
            {errors.ar_limit && <p className="mt-1 text-sm text-red-500">{errors.ar_limit}</p>}
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium">หุ้นปกติ (normal_share)</label>
            <input
              inputMode="decimal"
              className={`w-full rounded-xl border p-2 ${errors.normal_share ? "border-red-400" : "border-slate-300 focus:border-emerald-500"}`}
              value={form.normal_share}
              onChange={(e) => update("normal_share", e.target.value.replace(/[^\d.]/g, ""))}
              placeholder="214"
            />
            {errors.normal_share && <p className="mt-1 text-sm text-red-500">{errors.normal_share}</p>}
            <p className="mt-1 text-xs text-slate-500">{landPreview}</p>
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium">วันที่ซื้อครั้งล่าสุด (last_bought_date)</label>
            <input
              type="date"
              className={`w-full rounded-xl border p-2 ${errors.last_bought_date ? "border-red-400" : "border-slate-300 focus:border-emerald-500"}`}
              value={form.last_bought_date}
              onChange={(e) => update("last_bought_date", e.target.value)}
            />
            {errors.last_bought_date && <p className="mt-1 text-sm text-red-500">{errors.last_bought_date}</p>}
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium">วันที่โอน (transfer_date - ไม่ระบุก็ได้)</label>
            <input
              type="date"
              className="w-full rounded-xl border p-2 border-slate-300 focus:border-emerald-500"
              value={form.transfer_date}
              onChange={(e) => update("transfer_date", e.target.value)}
            />
          </div>

          <div className="md:col-span-2">
            <label className="mb-1 block text-sm font-medium">บัญชีธนาคาร (bank_account)</label>
            <input
              className="w-full rounded-xl border p-2 border-slate-300 focus:border-emerald-500"
              value={form.bank_account}
              onChange={(e) => update("bank_account", e.target.value)}
              placeholder="014-1-23456-7"
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium">รหัสสมาชิกในระบบ (tgs_id)</label>
            <input
              className="w-full rounded-xl border p-2 border-slate-300 focus:border-emerald-500"
              value={form.tgs_id}
              onChange={(e) => update("tgs_id", e.target.value)}
              placeholder="TGS-001"
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium">ชื่อคู่สมรส (spouce_name)</label>
            <input
              className="w-full rounded-xl border p-2 border-slate-300 focus:border-emerald-500"
              value={form.spouce_name}
              onChange={(e) => update("spouce_name", e.target.value)}
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium">จำนวนครั้งที่ซื้อ (orders_placed)</label>
            <input
              inputMode="numeric"
              className={`w-full rounded-xl border p-2 ${errors.orders_placed ? "border-red-400" : "border-slate-300 focus:border-emerald-500"}`}
              value={form.orders_placed}
              onChange={(e) => update("orders_placed", onlyDigits(e.target.value))}
              placeholder="เช่น 4"
            />
            {errors.orders_placed && <p className="mt-1 text-sm text-red-500">{errors.orders_placed}</p>}
          </div>
        </div>

        {/* ---------- ที่ดินถือครอง ---------- */}
        <h2 className="mt-6 mb-3 text-lg font-semibold text-black">ที่ดินถือครอง</h2>
        <div className="overflow-auto rounded-xl border border-slate-200">
          <table className="w-full text-sm">
            <thead className="bg-slate-50">
              <tr>
                <th className="p-3 text-left">ประเภท</th>
                <th className="p-3 text-center">ไร่</th>
                <th className="p-3 text-center">งาน</th>
                <th className="p-3 text-center">วา</th>
              </tr>
            </thead>
            <tbody>
              {[
                { key:"own",  label:"ของตนเอง" },
                { key:"rent", label:"เช่า" },
                { key:"other",label:"อื่น ๆ" },
              ].map(({key,label})=>(
                <tr key={key} className="border-t">
                  <td className="p-3">{label}</td>
                  <td className="p-2">
                    <input
                      inputMode="numeric"
                      className={`w-full rounded-lg border p-2 ${errors[`${key}_rai`] ? "border-red-400" : "border-slate-300 focus:border-emerald-500"}`}
                      value={form[`${key}_rai`]}
                      onChange={(e)=>update(`${key}_rai`, onlyDigits(e.target.value))}
                      placeholder="0"
                    />
                    {errors[`${key}_rai`] && <p className="mt-1 text-xs text-red-500">{errors[`${key}_rai`]}</p>}
                  </td>
                  <td className="p-2">
                    <input
                      inputMode="numeric"
                      className={`w-full rounded-lg border p-2 ${errors[`${key}_ngan`] ? "border-red-400" : "border-slate-300 focus:border-emerald-500"}`}
                      value={form[`${key}_ngan`]}
                      onChange={(e)=>update(`${key}_ngan`, String(clampNgan(e.target.value)))}
                      placeholder="0–3"
                    />
                    {errors[`${key}_ngan`] && <p className="mt-1 text-xs text-red-500">{errors[`${key}_ngan`]}</p>}
                  </td>
                  <td className="p-2">
                    <input
                      inputMode="numeric"
                      className={`w-full rounded-lg border p-2 ${errors[`${key}_wa`] ? "border-red-400" : "border-slate-300 focus:border-emerald-500"}`}
                      value={form[`${key}_wa`]}
                      onChange={(e)=>update(`${key}_wa`, String(clampWa(e.target.value)))}
                      placeholder="0–99"
                    />
                    {errors[`${key}_wa`] && <p className="mt-1 text-xs text-red-500">{errors[`${key}_wa`]}</p>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* ปุ่ม */}
        <div className="mt-6 flex flex-col gap-3 sm:flex-row">
          <button
            type="submit"
            disabled={submitting}
            className="inline-flex items-center justify-center rounded-xl bg-emerald-600 px-5 py-2.5 font-medium text-white hover:bg-emerald-700 disabled:opacity-60 active:scale-[.98]"
          >
            {submitting ? "กำลังบันทึก..." : "บันทึกการสมัครสมาชิก"}
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
