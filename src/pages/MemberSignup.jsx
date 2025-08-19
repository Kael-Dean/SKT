import { useEffect, useMemo, useRef, useState } from "react"

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

/** ---------- Reusable ComboBox (สไตล์เดียวกับหน้า Sales) ---------- */
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
        className={`w-full rounded-xl border px-3 py-2 text-left outline-none transition
          ${disabled ? "bg-slate-100 cursor-not-allowed" : "bg-white hover:bg-slate-50"}
          ${error ? "border-red-400" : "border-slate-300 focus:border-emerald-500"}
          shadow-inner focus:ring-2 focus:ring-emerald-200
          dark:border-slate-600 dark:bg-slate-700 dark:text-white dark:hover:bg-slate-600/60 dark:focus:ring-emerald-900/30
          ${open ? "ring-2 ring-emerald-200 dark:ring-emerald-900/30" : ""}`}
        aria-haspopup="listbox"
        aria-expanded={open}
      >
        <span className="block truncate">
          {selectedLabel || <span className="text-slate-400">{placeholder}</span>}
        </span>

        {/* chevron */}
        <svg
          className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 h-5 w-5 opacity-70 dark:opacity-80"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <path d="m6 9 6 6 6-6" />
        </svg>
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
            const isChosen = String(getValue(opt)) === String(value)
            return (
              <button
                key={String(getValue(opt)) || label || idx}
                type="button"
                role="option"
                aria-selected={isChosen}
                onMouseEnter={() => setHighlight(idx)}
                onClick={() => commit(opt)}
                className={`relative flex w-full items-center gap-2 px-3 py-2 text-left text-sm transition
                  ${isActive
                    ? "bg-emerald-100 ring-1 ring-emerald-300 dark:bg-emerald-400/20 dark:ring-emerald-500"
                    : "hover:bg-emerald-50 dark:hover:bg-emerald-900/30"}`}
              >
                {isActive && (
                  <span className="absolute left-0 top-0 h-full w-1 bg-emerald-500 dark:bg-emerald-400/60 rounded-l-xl" />
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
const MemberSignup = () => {
  const [errors, setErrors] = useState({})
  const [submitting, setSubmitting] = useState(false)

  /**
   * ฟอร์มนี้ถูก “ทำให้ตรง” กับ RequestMember ของเพื่อน และเพิ่มฟิลด์ที่ดินถือครอง
   */
  const [form, setForm] = useState({
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
    sex: "", // M | F
    salary: "",
    tgs_group: "",
    share_per_month: "",
    transfer_date: "", // optional1
    ar_limit: "",
    normal_share: "",
    last_bought_date: new Date().toISOString().slice(0, 10),
    bank_account: "",
    tgs_id: "",
    spouce_name: "",
    orders_placed: "",

    // จำนวนที่ดินถือครอง
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

    // เงื่อนไขช่วง งาน/วา/ไร่
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

  // Preview เล็ก ๆ
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

      // Land
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
      own_rai:"", own_ngan:"", own_wa:"",
      rent_rai:"", rent_ngan:"", rent_wa:"",
      other_rai:"", other_ngan:"", other_wa:"",
    })
  }

  /** ---------- UI (ธีมเดียวกับ Order/Sales) ---------- */
  return (
    // พื้นหลังหลัก: Light = ขาว, Dark = slate-900 + มุมมนใหญ่
    <div className="min-h-screen bg-white text-black dark:bg-slate-900 dark:text-white rounded-2xl">
      <div className="mx-auto max-w-7xl p-4 md:p-6">
        {/* หัวข้อ */}
        <h1 className="mb-4 text-2xl font-bold text-gray-900 dark:text-white">👤 สมัครสมาชิก</h1>

        {/* การ์ดหลักของฟอร์ม */}
        <form
          onSubmit={handleSubmit}
          className="rounded-2xl border border-slate-200 bg-white p-4 text-black shadow-sm dark:border-slate-700 dark:bg-slate-800 dark:text-white"
        >
          <h2 className="mb-3 text-lg font-semibold">ข้อมูลหลัก</h2>

          <div className="grid gap-4 md:grid-cols-4">
            {/* เลขสมาชิก */}
            <div>
              <label className="mb-1 block text-sm text-slate-700 dark:text-slate-300">เลขสมาชิก (member_id)</label>
              <input
                inputMode="numeric"
                className={`w-full rounded-xl border p-2 outline-none placeholder:text-slate-400 transition ${
                  errors.member_id ? "border-red-400" : "border-slate-300 focus:border-emerald-500"
                } shadow-inner dark:border-slate-600 dark:bg-slate-700 dark:text-white`}
                value={form.member_id}
                onChange={(e) => update("member_id", onlyDigits(e.target.value))}
                placeholder="เช่น 11263"
              />
              {errors.member_id && <p className="mt-1 text-sm text-red-500">{errors.member_id}</p>}
            </div>

            {/* คำนำหน้า */}
            <div>
              <label className="mb-1 block text-sm text-slate-700 dark:text-slate-300">คำนำหน้า (precode)</label>
              <input
                inputMode="numeric"
                className={`w-full rounded-xl border p-2 outline-none placeholder:text-slate-400 transition ${
                  errors.precode ? "border-red-400" : "border-slate-300 focus:border-emerald-500"
                } shadow-inner dark:border-slate-600 dark:bg-slate-700 dark:text-white`}
                value={form.precode}
                onChange={(e) => update("precode", onlyDigits(e.target.value))}
                placeholder="เช่น 1"
              />
              {errors.precode && <p className="mt-1 text-sm text-red-500">{errors.precode}</p>}
            </div>

            {/* วันที่สมัคร */}
            <div className="md:col-span-2">
              <label className="mb-1 block text-sm text-slate-700 dark:text-slate-300">วันที่สมัคร (regis_date)</label>
              <input
                type="date"
                className={`w-full rounded-xl border p-2 outline-none placeholder:text-slate-400 transition ${
                  errors.regis_date ? "border-red-400" : "border-slate-300 focus:border-emerald-500"
                } shadow-inner dark:border-slate-600 dark:bg-slate-700 dark:text-white`}
                value={form.regis_date}
                onChange={(e) => update("regis_date", e.target.value)}
              />
              {errors.regis_date && <p className="mt-1 text-sm text-red-500">{errors.regis_date}</p>}
            </div>

            {/* ชื่อ */}
            <div className="md:col-span-2">
              <label className="mb-1 block text-sm text-slate-700 dark:text-slate-300">ชื่อ</label>
              <input
                className={`w-full rounded-xl border p-2 outline-none placeholder:text-slate-400 transition ${
                  errors.first_name ? "border-red-400" : "border-slate-300 focus:border-emerald-500"
                } shadow-inner dark:border-slate-600 dark:bg-slate-700 dark:text-white`}
                value={form.first_name}
                onChange={(e) => update("first_name", e.target.value)}
                placeholder="สมชาย"
              />
              {errors.first_name && <p className="mt-1 text-sm text-red-500">{errors.first_name}</p>}
            </div>

            {/* นามสกุล */}
            <div className="md:col-span-2">
              <label className="mb-1 block text-sm text-slate-700 dark:text-slate-300">นามสกุล</label>
              <input
                className={`w-full rounded-xl border p-2 outline-none placeholder:text-slate-400 transition ${
                  errors.last_name ? "border-red-400" : "border-slate-300 focus:border-emerald-500"
                } shadow-inner dark:border-slate-600 dark:bg-slate-700 dark:text-white`}
                value={form.last_name}
                onChange={(e) => update("last_name", e.target.value)}
                placeholder="ใจดี"
              />
              {errors.last_name && <p className="mt-1 text-sm text-red-500">{errors.last_name}</p>}
            </div>

            {/* บัตรประชาชน */}
            <div className="md:col-span-2">
              <label className="mb-1 block text-sm text-slate-700 dark:text-slate-300">เลขบัตรประชาชน (13 หลัก)</label>
              <input
                inputMode="numeric"
                maxLength={13}
                className={`w-full rounded-xl border p-2 outline-none placeholder:text-slate-400 transition ${
                  errors.citizen_id ? "border-red-400" : "border-slate-300 focus:border-emerald-500"
                } shadow-inner dark:border-slate-600 dark:bg-slate-700 dark:text-white`}
                value={form.citizen_id}
                onChange={(e) => update("citizen_id", onlyDigits(e.target.value))}
                placeholder="1234567890123"
              />
              {errors.citizen_id && <p className="mt-1 text-sm text-red-500">{errors.citizen_id}</p>}
            </div>

            {/* เพศ: ใช้ ComboBox */}
            <div>
              <label className="mb-1 block text-sm text-slate-700 dark:text-slate-300">เพศ (M/F)</label>
              <ComboBox
                options={[
                  { value: "M", label: "ชาย (M)" },
                  { value: "F", label: "หญิง (F)" },
                ]}
                value={form.sex}
                onChange={(v) => update("sex", v)}
                placeholder="— เลือก —"
                error={!!errors.sex}
              />
              {errors.sex && <p className="mt-1 text-sm text-red-500">{errors.sex}</p>}
            </div>

            {/* ที่อยู่ */}
            <div className="md:col-span-3">
              <label className="mb-1 block text-sm text-slate-700 dark:text-slate-300">ที่อยู่ (address)</label>
              <input
                className={`w-full rounded-xl border p-2 outline-none placeholder:text-slate-400 transition ${
                  errors.address ? "border-red-400" : "border-slate-300 focus:border-emerald-500"
                } shadow-inner dark:border-slate-600 dark:bg-slate-700 dark:text-white`}
                value={form.address}
                onChange={(e) => update("address", e.target.value)}
                placeholder="บ้านเลขที่ หมู่ ตำบล อำเภอ จังหวัด"
              />
              {errors.address && <p className="mt-1 text-sm text-red-500">{errors.address}</p>}
            </div>

            {/* หมู่ */}
            <div>
              <label className="mb-1 block text-sm text-slate-700 dark:text-slate-300">หมู่ (mhoo)</label>
              <input
                className="w-full rounded-xl border border-slate-300 p-2 outline-none placeholder:text-slate-400 focus:border-emerald-500 shadow-inner dark:border-slate-600 dark:bg-slate-700 dark:text-white"
                value={form.mhoo}
                onChange={(e) => update("mhoo", e.target.value)}
                placeholder="เช่น 1"
              />
            </div>

            {/* ตำบล */}
            <div>
              <label className="mb-1 block text-sm text-slate-700 dark:text-slate-300">ตำบล (sub_district)</label>
              <input
                className={`w-full rounded-xl border p-2 outline-none placeholder:text-slate-400 transition ${
                  errors.sub_district ? "border-red-400" : "border-slate-300 focus:border-emerald-500"
                } shadow-inner dark:border-slate-600 dark:bg-slate-700 dark:text-white`}
                value={form.sub_district}
                onChange={(e) => update("sub_district", e.target.value)}
              />
              {errors.sub_district && <p className="mt-1 text-sm text-red-500">{errors.sub_district}</p>}
            </div>

            {/* อำเภอ */}
            <div>
              <label className="mb-1 block text-sm text-slate-700 dark:text-slate-300">อำเภอ (district)</label>
              <input
                className={`w-full rounded-xl border p-2 outline-none placeholder:text-slate-400 transition ${
                  errors.district ? "border-red-400" : "border-slate-300 focus:border-emerald-500"
                } shadow-inner dark:border-slate-600 dark:bg-slate-700 dark:text-white`}
                value={form.district}
                onChange={(e) => update("district", e.target.value)}
              />
              {errors.district && <p className="mt-1 text-sm text-red-500">{errors.district}</p>}
            </div>

            {/* จังหวัด */}
            <div>
              <label className="mb-1 block text-sm text-slate-700 dark:text-slate-300">จังหวัด (province)</label>
              <input
                className={`w-full rounded-xl border p-2 outline-none placeholder:text-slate-400 transition ${
                  errors.province ? "border-red-400" : "border-slate-300 focus:border-emerald-500"
                } shadow-inner dark:border-slate-600 dark:bg-slate-700 dark:text-white`}
                value={form.province}
                onChange={(e) => update("province", e.target.value)}
              />
              {errors.province && <p className="mt-1 text-sm text-red-500">{errors.province}</p>}
            </div>

            {/* subprov */}
            <div>
              <label className="mb-1 block text-sm text-slate-700 dark:text-slate-300">อำเภอย่อย/รหัสอำเภอ (subprov)</label>
              <input
                inputMode="numeric"
                className="w-full rounded-xl border border-slate-300 p-2 outline-none placeholder:text-slate-400 focus:border-emerald-500 shadow-inner dark:border-slate-600 dark:bg-slate-700 dark:text-white"
                value={form.subprov}
                onChange={(e) => update("subprov", onlyDigits(e.target.value))}
                placeholder="เช่น 501"
              />
            </div>

            {/* รหัสไปรษณีย์ */}
            <div>
              <label className="mb-1 block text-sm text-slate-700 dark:text-slate-300">รหัสไปรษณีย์</label>
              <input
                inputMode="numeric"
                maxLength={5}
                className={`w-full rounded-xl border p-2 outline-none placeholder:text-slate-400 transition ${
                  errors.postal_code ? "border-red-400" : "border-slate-300 focus:border-emerald-500"
                } shadow-inner dark:border-slate-600 dark:bg-slate-700 dark:text-white`}
                value={form.postal_code}
                onChange={(e) => update("postal_code", onlyDigits(e.target.value))}
              />
              {errors.postal_code && <p className="mt-1 text-sm text-red-500">{errors.postal_code}</p>}
            </div>

            {/* โทรศัพท์ */}
            <div className="md:col-span-2">
              <label className="mb-1 block text-sm text-slate-700 dark:text-slate-300">โทรศัพท์ (phone_number)</label>
              <input
                inputMode="tel"
                className={`w-full rounded-xl border p-2 outline-none placeholder:text-slate-400 transition ${
                  errors.phone_number ? "border-red-400" : "border-slate-300 focus:border-emerald-500"
                } shadow-inner dark:border-slate-600 dark:bg-slate-700 dark:text-white`}
                value={form.phone_number}
                onChange={(e) => update("phone_number", e.target.value)}
                placeholder="08x-xxx-xxxx"
              />
              {errors.phone_number && <p className="mt-1 text-sm text-red-500">{errors.phone_number}</p>}
            </div>

            {/* เงินเดือน */}
            <div>
              <label className="mb-1 block text-sm text-slate-700 dark:text-slate-300">เงินเดือน (salary)</label>
              <input
                inputMode="decimal"
                className={`w-full rounded-xl border p-2 outline-none placeholder:text-slate-400 transition ${
                  errors.salary ? "border-red-400" : "border-slate-300 focus:border-emerald-500"
                } shadow-inner dark:border-slate-600 dark:bg-slate-700 dark:text-white`}
                value={form.salary}
                onChange={(e) => update("salary", e.target.value.replace(/[^\d.]/g, ""))}
                placeholder="15000"
              />
              {errors.salary && <p className="mt-1 text-sm text-red-500">{errors.salary}</p>}
            </div>

            {/* กลุ่ม */}
            <div>
              <label className="mb-1 block text-sm text-slate-700 dark:text-slate-300">กลุ่ม (tgs_group)</label>
              <input
                inputMode="numeric"
                className={`w-full rounded-xl border p-2 outline-none placeholder:text-slate-400 transition ${
                  errors.tgs_group ? "border-red-400" : "border-slate-300 focus:border-emerald-500"
                } shadow-inner dark:border-slate-600 dark:bg-slate-700 dark:text-white`}
                value={form.tgs_group}
                onChange={(e) => update("tgs_group", onlyDigits(e.target.value))}
                placeholder="16"
              />
              {errors.tgs_group && <p className="mt-1 text-sm text-red-500">{errors.tgs_group}</p>}
            </div>

            {/* ส่งหุ้น/เดือน */}
            <div>
              <label className="mb-1 block text-sm text-slate-700 dark:text-slate-300">ส่งหุ้น/เดือน (share_per_month)</label>
              <input
                inputMode="decimal"
                className={`w-full rounded-xl border p-2 outline-none placeholder:text-slate-400 transition ${
                  errors.share_per_month ? "border-red-400" : "border-slate-300 focus:border-emerald-500"
                } shadow-inner dark:border-slate-600 dark:bg-slate-700 dark:text-white`}
                value={form.share_per_month}
                onChange={(e) => update("share_per_month", e.target.value.replace(/[^\d.]/g, ""))}
                placeholder="500"
              />
              {errors.share_per_month && <p className="mt-1 text-sm text-red-500">{errors.share_per_month}</p>}
            </div>

            {/* วงเงินสินเชื่อ */}
            <div>
              <label className="mb-1 block text-sm text-slate-700 dark:text-slate-300">วงเงินสินเชื่อ (ar_limit)</label>
              <input
                inputMode="numeric"
                className={`w-full rounded-xl border p-2 outline-none placeholder:text-slate-400 transition ${
                  errors.ar_limit ? "border-red-400" : "border-slate-300 focus:border-emerald-500"
                } shadow-inner dark:border-slate-600 dark:bg-slate-700 dark:text-white`}
                value={form.ar_limit}
                onChange={(e) => update("ar_limit", onlyDigits(e.target.value))}
                placeholder="100000"
              />
              {errors.ar_limit && <p className="mt-1 text-sm text-red-500">{errors.ar_limit}</p>}
            </div>

            {/* หุ้นปกติ */}
            <div>
              <label className="mb-1 block text-sm text-slate-700 dark:text-slate-300">หุ้นปกติ (normal_share)</label>
              <input
                inputMode="decimal"
                className={`w-full rounded-xl border p-2 outline-none placeholder:text-slate-400 transition ${
                  errors.normal_share ? "border-red-400" : "border-slate-300 focus:border-emerald-500"
                } shadow-inner dark:border-slate-600 dark:bg-slate-700 dark:text-white`}
                value={form.normal_share}
                onChange={(e) => update("normal_share", e.target.value.replace(/[^\d.]/g, ""))}
                placeholder="214"
              />
              {errors.normal_share && <p className="mt-1 text-sm text-red-500">{errors.normal_share}</p>}
              <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">{landPreview}</p>
            </div>

            {/* วันที่ซื้อครั้งล่าสุด */}
            <div>
              <label className="mb-1 block text-sm text-slate-700 dark:text-slate-300">วันที่ซื้อครั้งล่าสุด (last_bought_date)</label>
              <input
                type="date"
                className={`w-full rounded-xl border p-2 outline-none placeholder:text-slate-400 transition ${
                  errors.last_bought_date ? "border-red-400" : "border-slate-300 focus:border-emerald-500"
                } shadow-inner dark:border-slate-600 dark:bg-slate-700 dark:text-white`}
                value={form.last_bought_date}
                onChange={(e) => update("last_bought_date", e.target.value)}
              />
              {errors.last_bought_date && <p className="mt-1 text-sm text-red-500">{errors.last_bought_date}</p>}
            </div>

            {/* วันที่โอน */}
            <div>
              <label className="mb-1 block text-sm text-slate-700 dark:text-slate-300">
                วันที่โอน (transfer_date - ไม่ระบุก็ได้)
              </label>
              <input
                type="date"
                className="w-full rounded-xl border border-slate-300 p-2 outline-none placeholder:text-slate-400 focus:border-emerald-500 shadow-inner dark:border-slate-600 dark:bg-slate-700 dark:text-white"
                value={form.transfer_date}
                onChange={(e) => update("transfer_date", e.target.value)}
              />
            </div>

            {/* บัญชีธนาคาร */}
            <div className="md:col-span-2">
              <label className="mb-1 block text-sm text-slate-700 dark:text-slate-300">บัญชีธนาคาร (bank_account)</label>
              <input
                className="w-full rounded-xl border border-slate-300 p-2 outline-none placeholder:text-slate-400 focus:border-emerald-500 shadow-inner dark:border-slate-600 dark:bg-slate-700 dark:text-white"
                value={form.bank_account}
                onChange={(e) => update("bank_account", e.target.value)}
                placeholder="014-1-23456-7"
              />
            </div>

            {/* รหัสสมาชิกระบบ */}
            <div>
              <label className="mb-1 block text-sm text-slate-700 dark:text-slate-300">รหัสสมาชิกในระบบ (tgs_id)</label>
              <input
                className="w-full rounded-xl border border-slate-300 p-2 outline-none placeholder:text-slate-400 focus:border-emerald-500 shadow-inner dark:border-slate-600 dark:bg-slate-700 dark:text-white"
                value={form.tgs_id}
                onChange={(e) => update("tgs_id", e.target.value)}
                placeholder="TGS-001"
              />
            </div>

            {/* คู่สมรส */}
            <div>
              <label className="mb-1 block text-sm text-slate-700 dark:text-slate-300">ชื่อคู่สมรส (spouce_name)</label>
              <input
                className="w-full rounded-xl border border-slate-300 p-2 outline-none placeholder:text-slate-400 focus:border-emerald-500 shadow-inner dark:border-slate-600 dark:bg-slate-700 dark:text-white"
                value={form.spouce_name}
                onChange={(e) => update("spouce_name", e.target.value)}
              />
            </div>

            {/* จำนวนครั้งที่ซื้อ */}
            <div>
              <label className="mb-1 block text-sm text-slate-700 dark:text-slate-300">จำนวนครั้งที่ซื้อ (orders_placed)</label>
              <input
                inputMode="numeric"
                className={`w-full rounded-xl border p-2 outline-none placeholder:text-slate-400 transition ${
                  errors.orders_placed ? "border-red-400" : "border-slate-300 focus:border-emerald-500"
                } shadow-inner dark:border-slate-600 dark:bg-slate-700 dark:text-white`}
                value={form.orders_placed}
                onChange={(e) => update("orders_placed", onlyDigits(e.target.value))}
                placeholder="เช่น 4"
              />
              {errors.orders_placed && <p className="mt-1 text-sm text-red-500">{errors.orders_placed}</p>}
            </div>
          </div>

          {/* ---------- ที่ดินถือครอง ---------- */}
          <h2 className="mt-6 mb-3 text-lg font-semibold">ที่ดินถือครอง</h2>
          <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white text-black shadow-sm dark:border-slate-700 dark:bg-slate-800 dark:text-white">
            <table className="min-w-full text-left text-sm">
              <thead className="bg-slate-50 text-slate-700 dark:bg-slate-700 dark:text-slate-200">
                <tr>
                  <th className="px-3 py-2">ประเภท</th>
                  <th className="px-3 py-2 text-center">ไร่</th>
                  <th className="px-3 py-2 text-center">งาน</th>
                  <th className="px-3 py-2 text-center">วา</th>
                </tr>
              </thead>
              <tbody>
                {[
                  { key:"own",  label:"ของตนเอง" },
                  { key:"rent", label:"เช่า" },
                  { key:"other",label:"อื่น ๆ" },
                ].map(({key,label})=>(
                  <tr key={key} className="bg-white dark:bg-slate-800">
                    <td className="px-3 py-2">{label}</td>
                    <td className="px-3 py-2">
                      <input
                        inputMode="numeric"
                        className={`w-full rounded-xl border p-2 text-center outline-none placeholder:text-slate-400 transition ${
                          errors[`${key}_rai`] ? "border-red-400" : "border-slate-300 focus:border-emerald-500"
                        } shadow-inner dark:border-slate-600 dark:bg-slate-700 dark:text-white`}
                        value={form[`${key}_rai`]}
                        onChange={(e)=>update(`${key}_rai`, onlyDigits(e.target.value))}
                        placeholder="0"
                      />
                      {errors[`${key}_rai`] && <p className="mt-1 text-xs text-red-500">{errors[`${key}_rai`]}</p>}
                    </td>
                    <td className="px-3 py-2">
                      <input
                        inputMode="numeric"
                        className={`w-full rounded-xl border p-2 text-center outline-none placeholder:text-slate-400 transition ${
                          errors[`${key}_ngan`] ? "border-red-400" : "border-slate-300 focus:border-emerald-500"
                        } shadow-inner dark:border-slate-600 dark:bg-slate-700 dark:text-white`}
                        value={form[`${key}_ngan`]}
                        onChange={(e)=>update(`${key}_ngan`, String(clampNgan(e.target.value)))}
                        placeholder="0–3"
                      />
                      {errors[`${key}_ngan`] && <p className="mt-1 text-xs text-red-500">{errors[`${key}_ngan`]}</p>}
                    </td>
                    <td className="px-3 py-2">
                      <input
                        inputMode="numeric"
                        className={`w-full rounded-xl border p-2 text-center outline-none placeholder:text-slate-400 transition ${
                          errors[`${key}_wa`] ? "border-red-400" : "border-slate-300 focus:border-emerald-500"
                        } shadow-inner dark:border-slate-600 dark:bg-slate-700 dark:text-white`}
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
              className="inline-flex items-center justify-center rounded-xl bg-emerald-600 px-5 py-2.5 font-medium text-white shadow-md ring-1 ring-emerald-700/30 hover:bg-emerald-700 active:translate-y-[1px] active:shadow-inner disabled:opacity-60"
            >
              {submitting ? "กำลังบันทึก..." : "บันทึกการสมัครสมาชิก"}
            </button>
            <button
              type="button"
              onClick={handleReset}
              className="inline-flex items-center justify-center rounded-xl border border-slate-300 bg-white px-5 py-2.5 font-medium text-slate-700 shadow-sm hover:bg-slate-50 active:translate-y-[1px] active:shadow-inner active:bg-slate-100 dark:border-slate-600 dark:bg-slate-700 dark:text-white dark:hover:bg-slate-600"
            >
              รีเซ็ต
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

export default MemberSignup
