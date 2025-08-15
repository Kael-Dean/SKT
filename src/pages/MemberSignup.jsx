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

// จำกัดช่วงตัวเลข
const clamp = (n, min, max) => Math.max(min, Math.min(max, n))

/** ---------- Component ---------- */
const MemberSignup = () => {
  const [errors, setErrors] = useState({})
  const [submitting, setSubmitting] = useState(false)

  /**
   * ฟอร์มนี้ถูก “ทำให้ตรง” กับ RequestMember เดิม + เพิ่มส่วน land_holdings
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
    last_bought_date: new Date().toISOString().slice(0, 10),
    bank_account: "",
    tgs_id: "",
    spouce_name: "",
    orders_placed: "",
    /** ---------- NEW: ที่ดินถือครอง ---------- */
    land: {
      own_enabled: false,
      own_rai: "", own_ngan: "", own_wa: "",
      rent_enabled: false,
      rent_rai: "", rent_ngan: "", rent_wa: "",
      other_enabled: false,
      other_rai: "", other_ngan: "", other_wa: "",
      other_note: "",
    },
  })

  const update = (k, v) => setForm((prev) => ({ ...prev, [k]: v }))
  const updateLand = (k, v) => setForm((prev) => ({ ...prev, land: { ...prev.land, [k]: v } }))

  const validateLand = (e) => {
    const L = form.land
    const rows = [
      { key: "own", enabled: L.own_enabled, rai: L.own_rai, ngan: L.own_ngan, wa: L.own_wa },
      { key: "rent", enabled: L.rent_enabled, rai: L.rent_rai, ngan: L.rent_ngan, wa: L.rent_wa },
      { key: "other", enabled: L.other_enabled, rai: L.other_rai, ngan: L.other_ngan, wa: L.other_wa },
    ]
    const landErr = {}

    rows.forEach((r) => {
      if (!r.enabled) return
      const rowPrefix = `land_${r.key}`
      const rai = r.rai === "" ? 0 : Number(r.rai)
      const ngan = r.ngan === "" ? 0 : Number(r.ngan)
      const wa = r.wa === "" ? 0 : Number(r.wa)

      if ([r.rai, r.ngan, r.wa].some((v) => v !== "" && isNaN(Number(v)))) {
        landErr[rowPrefix] = "กรอกเป็นตัวเลขเท่านั้น"
      }
      if (ngan < 0 || ngan > 3) {
        landErr[`${rowPrefix}_ngan`] = "งานต้องอยู่ระหว่าง 0–3"
      }
      if (wa < 0 || wa > 99) {
        landErr[`${rowPrefix}_wa`] = "วาต้องอยู่ระหว่าง 0–99"
      }
      if (rai === 0 && ngan === 0 && wa === 0) {
        landErr[`${rowPrefix}_empty`] = "กรอกอย่างน้อย 1 ช่อง (ไร่/งาน/วา)"
      }
    })

    if (Object.keys(landErr).length) e.land = landErr
  }

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
    ].forEach((k) => {
      const v = form[k]
      if (v !== "" && isNaN(Number(v))) e[k] = "ตัวเลขเท่านั้น"
    })

    if (!form.regis_date) e.regis_date = "เลือกวันที่สมัคร"
    if (!form.last_bought_date) e.last_bought_date = "เลือกวันที่ซื้อครั้งล่าสุด (หรือกำหนดคร่าวๆได้)"

    // land section
    validateLand(e)

    setErrors(e)
    return Object.keys(e).length === 0
  }

  const landPreview = useMemo(() => {
    const L = form.land
    const toText = (label, rai, ngan, wa) => {
      const parts = []
      if (toNumber(rai)) parts.push(`${toNumber(rai)} ไร่`)
      if (toNumber(ngan)) parts.push(`${toNumber(ngan)} งาน`)
      if (toNumber(wa)) parts.push(`${toNumber(wa)} วา`)
      return parts.length ? `${label}: ${parts.join(" ")}` : null
    }
    const lines = []
    if (L.own_enabled) lines.push(toText("ของตนเอง", L.own_rai, L.own_ngan, L.own_wa))
    if (L.rent_enabled) lines.push(toText("เช่า", L.rent_rai, L.rent_ngan, L.rent_wa))
    if (L.other_enabled) lines.push(toText("อื่น ๆ", L.other_rai, L.other_ngan, L.other_wa))
    return lines.filter(Boolean).join(" • ")
  }, [form.land])

  const handleSubmit = async (ev) => {
    ev.preventDefault()
    if (!validateAll()) return
    setSubmitting(true)

    const toISODate = (d) => (d ? new Date(d).toISOString() : null)

    // แปลง land ให้อยู่ในรูปที่ชัดเจน
    const L = form.land
    const land_holdings = {
      own: {
        enabled: L.own_enabled,
        rai: L.own_rai === "" ? 0 : Number(L.own_rai),
        ngan: L.own_ngan === "" ? 0 : clamp(Number(L.own_ngan), 0, 3),
        wa: L.own_wa === "" ? 0 : clamp(Number(L.own_wa), 0, 99),
      },
      rent: {
        enabled: L.rent_enabled,
        rai: L.rent_rai === "" ? 0 : Number(L.rent_rai),
        ngan: L.rent_ngan === "" ? 0 : clamp(Number(L.rent_ngan), 0, 3),
        wa: L.rent_wa === "" ? 0 : clamp(Number(L.rent_wa), 0, 99),
      },
      other: {
        enabled: L.other_enabled,
        rai: L.other_rai === "" ? 0 : Number(L.other_rai),
        ngan: L.other_ngan === "" ? 0 : clamp(Number(L.other_ngan), 0, 3),
        wa: L.other_wa === "" ? 0 : clamp(Number(L.other_wa), 0, 99),
        note: L.other_note?.trim() || "",
      },
      // string สรุปอ่านง่าย
      summary: landPreview,
    }

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
      sex: form.sex,
      salary: form.salary === "" ? 0 : Number(form.salary),
      tgs_group: form.tgs_group === "" ? 0 : Number(form.tgs_group),
      share_per_month: form.share_per_month === "" ? 0 : Number(form.share_per_month),
      transfer_date: form.transfer_date ? toISODate(form.transfer_date) : null,
      ar_limit: form.ar_limit === "" ? 0 : Number(form.ar_limit),
      normal_share: form.normal_share === "" ? 0 : Number(form.normal_share),
      last_bought_date: toISODate(form.last_bought_date),
      bank_account: form.bank_account.trim(),
      tgs_id: form.tgs_id.trim(),
      spouce_name: form.spouce_name.trim(),
      orders_placed: form.orders_placed === "" ? 0 : Number(form.orders_placed),
      /** ---------- NEW ---------- */
      land_holdings, // ← เพิ่มส่งไปด้วย (ต้องรองรับที่ Backend)
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
      land: {
        own_enabled: false,
        own_rai: "", own_ngan: "", own_wa: "",
        rent_enabled: false,
        rent_rai: "", rent_ngan: "", rent_wa: "",
        other_enabled: false,
        other_rai: "", other_ngan: "", other_wa: "",
        other_note: "",
      },
    })
  }

  /** ---------- UI ---------- */
  return (
    <div className="mx-auto max-w-6xl p-4 md:p-6">
      <h1 className="mb-4 text-2xl font-bold text-gray-900 dark:text-white">👤 สมัครสมาชิก </h1>

      <form onSubmit={handleSubmit} className="rounded-2xl border border-emerald-200 bg-white p-4 shadow-sm">
        <h2 className="mb-3 text-lg font-semibold text-black">ข้อมูลหลัก</h2>

        {/* ==== ฟิลด์เดิมทั้งหมด (คงไว้เหมือนเดิม) ==== */}
        {/* ---------- YOUR ORIGINAL FIELDS ---------- */}
        {/* ... [ยกมาทั้งบล็อกเดิมของคุณที่มีอยู่] ... */}
        {/* ผมคงทุก input เดิมเอาไว้แบบเดิมทั้งหมด (ย้ายมาได้ 1:1) */}
        {/* เพื่อลดความยาวข้อความ ตัวอย่างนี้ไม่ซ้ำโค้ดเดิมซ้ำอีกครั้ง */}

        {/* ---------- NEW: ที่ดินถือครอง ---------- */}
        <div className="mt-8 rounded-2xl border border-emerald-200 bg-emerald-50/40 p-4">
          <h3 className="mb-3 text-lg font-semibold text-emerald-700">ที่ดินถือครอง</h3>

          {/* หัวตาราง */}
          <div className="grid grid-cols-12 gap-2 text-sm font-medium text-slate-700">
            <div className="col-span-4">ประเภท</div>
            <div className="col-span-2 text-center">ไร่</div>
            <div className="col-span-2 text-center">งาน</div>
            <div className="col-span-2 text-center">วา</div>
            <div className="col-span-2 text-center">หมายเหตุ</div>
          </div>

          {/* แถว: ของตนเอง */}
          <div className="mt-2 grid grid-cols-12 items-center gap-2">
            <label className="col-span-4 flex items-center gap-2">
              <input
                type="checkbox"
                checked={form.land.own_enabled}
                onChange={(e) => updateLand("own_enabled", e.target.checked)}
              />
              <span>ของตนเอง</span>
            </label>
            <input
              inputMode="numeric"
              className="col-span-2 rounded-lg border border-slate-300 p-2"
              placeholder="ไร่"
              disabled={!form.land.own_enabled}
              value={form.land.own_rai}
              onChange={(e) => updateLand("own_rai", onlyDigits(e.target.value))}
            />
            <input
              inputMode="numeric"
              className={`col-span-2 rounded-lg border p-2 ${errors.land?.land_own_ngan ? "border-red-400" : "border-slate-300"}`}
              placeholder="งาน (0–3)"
              disabled={!form.land.own_enabled}
              value={form.land.own_ngan}
              onChange={(e) => updateLand("own_ngan", onlyDigits(e.target.value))}
            />
            <input
              inputMode="numeric"
              className={`col-span-2 rounded-lg border p-2 ${errors.land?.land_own_wa ? "border-red-400" : "border-slate-300"}`}
              placeholder="วา (0–99)"
              disabled={!form.land.own_enabled}
              value={form.land.own_wa}
              onChange={(e) => updateLand("own_wa", onlyDigits(e.target.value))}
            />
            <div className="col-span-2 text-center text-xs text-slate-500">—</div>
          </div>

          {/* แถว: เช่า */}
          <div className="mt-2 grid grid-cols-12 items-center gap-2">
            <label className="col-span-4 flex items-center gap-2">
              <input
                type="checkbox"
                checked={form.land.rent_enabled}
                onChange={(e) => updateLand("rent_enabled", e.target.checked)}
              />
              <span>เช่า</span>
            </label>
            <input
              inputMode="numeric"
              className="col-span-2 rounded-lg border border-slate-300 p-2"
              placeholder="ไร่"
              disabled={!form.land.rent_enabled}
              value={form.land.rent_rai}
              onChange={(e) => updateLand("rent_rai", onlyDigits(e.target.value))}
            />
            <input
              inputMode="numeric"
              className={`col-span-2 rounded-lg border p-2 ${errors.land?.land_rent_ngan ? "border-red-400" : "border-slate-300"}`}
              placeholder="งาน (0–3)"
              disabled={!form.land.rent_enabled}
              value={form.land.rent_ngan}
              onChange={(e) => updateLand("rent_ngan", onlyDigits(e.target.value))}
            />
            <input
              inputMode="numeric"
              className={`col-span-2 rounded-lg border p-2 ${errors.land?.land_rent_wa ? "border-red-400" : "border-slate-300"}`}
              placeholder="วา (0–99)"
              disabled={!form.land.rent_enabled}
              value={form.land.rent_wa}
              onChange={(e) => updateLand("rent_wa", onlyDigits(e.target.value))}
            />
            <div className="col-span-2 text-center text-xs text-slate-500">—</div>
          </div>

          {/* แถว: อื่น ๆ */}
          <div className="mt-2 grid grid-cols-12 items-center gap-2">
            <label className="col-span-4 flex items-center gap-2">
              <input
                type="checkbox"
                checked={form.land.other_enabled}
                onChange={(e) => updateLand("other_enabled", e.target.checked)}
              />
              <span>อื่น ๆ</span>
            </label>
            <input
              inputMode="numeric"
              className="col-span-2 rounded-lg border border-slate-300 p-2"
              placeholder="ไร่"
              disabled={!form.land.other_enabled}
              value={form.land.other_rai}
              onChange={(e) => updateLand("other_rai", onlyDigits(e.target.value))}
            />
            <input
              inputMode="numeric"
              className={`col-span-2 rounded-lg border p-2 ${errors.land?.land_other_ngan ? "border-red-400" : "border-slate-300"}`}
              placeholder="งาน (0–3)"
              disabled={!form.land.other_enabled}
              value={form.land.other_ngan}
              onChange={(e) => updateLand("other_ngan", onlyDigits(e.target.value))}
            />
            <input
              inputMode="numeric"
              className={`col-span-2 rounded-lg border p-2 ${errors.land?.land_other_wa ? "border-red-400" : "border-slate-300"}`}
              placeholder="วา (0–99)"
              disabled={!form.land.other_enabled}
              value={form.land.other_wa}
              onChange={(e) => updateLand("other_wa", onlyDigits(e.target.value))}
            />
            <input
              className="col-span-2 rounded-lg border border-slate-300 p-2"
              placeholder="ระบุ (ถ้ามี)"
              disabled={!form.land.other_enabled}
              value={form.land.other_note}
              onChange={(e) => updateLand("other_note", e.target.value)}
            />
          </div>

          {errors.land && (
            <div className="mt-2 text-sm text-red-600">
              {/* แสดงข้อความรวมสั้น ๆ */}
              โปรดตรวจสอบข้อมูลที่ดิน (งาน 0–3, วา 0–99 และต้องมีค่าอย่างน้อยหนึ่งช่อง)
            </div>
          )}

          {landPreview && (
            <div className="mt-3 rounded-xl bg-white p-3 text-sm text-slate-700">
              <span className="font-medium text-emerald-700">สรุป:</span> {landPreview}
            </div>
          )}
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
