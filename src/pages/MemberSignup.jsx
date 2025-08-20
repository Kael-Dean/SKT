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

/** ---------- Button styles (light + dark) ---------- */
const BTN_BASE =
  "inline-flex items-center justify-center rounded-xl px-5 py-2.5 font-medium select-none " +
  "transition-[transform,box-shadow,background] focus-visible:outline-none " +
  "focus-visible:ring-2 ring-emerald-400/40 dark:ring-emerald-300/30 " +
  "focus-visible:ring-offset-2 ring-offset-white dark:ring-offset-slate-900 " +
  "active:translate-y-[1px] disabled:opacity-60";

const BTN_PRIMARY =
  BTN_BASE +
  " text-white border shadow-md " +
  // light
  " bg-emerald-600 hover:bg-emerald-700 border-emerald-700/50 " +
  " shadow-[inset_0_1px_0_rgba(255,255,255,0.15),0_2px_6px_rgba(0,0,0,0.2)] " +
  // dark
  " dark:bg-gradient-to-b dark:from-emerald-600 dark:to-emerald-700 " +
  " dark:hover:from-emerald-500 dark:hover:to-emerald-600 " +
  " dark:border-emerald-400/30 " +
  " dark:shadow-[inset_0_1px_0_rgba(255,255,255,0.06),0_4px_12px_rgba(0,0,0,0.45)] " +
  " active:shadow-inner";

const BTN_SECONDARY =
  BTN_BASE +
  " border text-slate-700 bg-white hover:bg-slate-50 " +
  " border-slate-300 shadow-sm active:shadow-inner " +
  // dark
  " dark:text-slate-100 dark:bg-gradient-to-b dark:from-slate-700 dark:to-slate-800 " +
  " dark:hover:from-slate-600 dark:hover:to-slate-700 " +
  " dark:border-slate-500/60 " +
  " dark:shadow-[inset_0_1px_0_rgba(255,255,255,0.06),0_2px_8px_rgba(0,0,0,0.45)]";

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
        className={`w-full rounded-xl border p-2 text-left outline-none transition ${
          disabled ? "bg-slate-100 cursor-not-allowed" : "bg-white hover:bg-slate-50"
        } ${error ? "border-red-400" : "border-slate-300 focus:border-emerald-500"} dark:border-slate-600 dark:bg-slate-700 dark:text-white dark:hover:bg-slate-600/60`}
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

/** ---------- สไตล์อินพุต + ระบบเลื่อนหา error (ไม่แตะ validate เดิม) ---------- */
const baseField =
  "w-full rounded-xl border p-2 outline-none transition " +
  // Light
  "bg-gradient-to-b from-white to-slate-50 " +
  "focus:ring-2 focus:ring-emerald-500/60 " +
  "placeholder:text-slate-400 " +
  "border-slate-300 focus:border-emerald-500 " +
  // Dark
  "dark:bg-gradient-to-b dark:from-slate-700 dark:to-slate-700 " +
  "dark:text-white dark:border-slate-700 dark:placeholder:text-slate-400 " +
  "dark:focus:ring-emerald-400/60 dark:focus:border-emerald-400"
// (ตัด shadow inner ออกให้ไม่เกิดกรอบซ้อน)

const fieldError = "border-red-400 ring-2 ring-red-300 focus:ring-red-300 focus:border-red-400"
const fieldDisabled = "bg-slate-100 dark:bg-slate-800/70 dark:text-slate-300 cursor-not-allowed opacity-90"

/** ---------- Component ---------- */
const MemberSignup = () => {
  const [errors, setErrors] = useState({})
  const [submitting, setSubmitting] = useState(false)

  // เพิ่ม state เพื่อ “สั่งเลื่อน” หลัง validate ตั้ง errors แล้ว
  const [shouldScrollError, setShouldScrollError] = useState(false)

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

  // ---- Refs สำหรับเลื่อนไปยังช่องที่พลาด (เรียงตามความสำคัญ) ----
  const refs = {
    member_id: useRef(null),
    precode: useRef(null),
    regis_date: useRef(null),
    first_name: useRef(null),
    last_name: useRef(null),
    citizen_id: useRef(null),
    address: useRef(null),
    mhoo: useRef(null),
    sub_district: useRef(null),
    district: useRef(null),
    province: useRef(null),
    postal_code: useRef(null),
    phone_number: useRef(null),
    sex: useRef(null),
    salary: useRef(null),
    tgs_group: useRef(null),
    share_per_month: useRef(null),
    transfer_date: useRef(null),
    ar_limit: useRef(null),
    normal_share: useRef(null),
    last_bought_date: useRef(null),
    bank_account: useRef(null),
    tgs_id: useRef(null),
    spouce_name: useRef(null),
    orders_placed: useRef(null),
    // land
    own_rai: useRef(null),  own_ngan: useRef(null),  own_wa: useRef(null),
    rent_rai: useRef(null), rent_ngan: useRef(null), rent_wa: useRef(null),
    other_rai: useRef(null),other_ngan: useRef(null),other_wa: useRef(null),
  }

  const update = (k, v) => setForm((prev) => ({ ...prev, [k]: v }))

  // ล้าง error รายช่องเมื่อผู้ใช้แก้/โฟกัส
  const clearError = (key) =>
    setErrors((prev) => {
      if (!(key in prev)) return prev
      const { [key]: _omit, ...rest } = prev
      return rest
    })

  // -------------------- validate เดิม (ไม่แก้ logic) --------------------
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
      // land
      "own_rai","own_ngan","own_wa",
      "rent_rai","rent_ngan","rent_wa",
      "other_rai","other_ngan","other_wa",
    ].forEach((k) => {
      const v = form[k]
      if (v !== "" && isNaN(Number(v))) e[k] = "ตัวเลขเท่านั้น"
    })

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

    if (!form.regis_date) e.regis_date = "เลือกวันที่สมัคร"
    if (!form.last_bought_date) e.last_bought_date = "เลือกวันที่ซื้อครั้งล่าสุด (หรือกำหนดคร่าวๆได้)"

    setErrors(e)
    return Object.keys(e).length === 0
  }
  // ---------------------------------------------------------------------

  // เมื่อ errors เปลี่ยนและมีธง shouldScrollError ให้เลื่อนไปยังช่องแรกที่มี error
  useEffect(() => {
    if (!shouldScrollError) return
    const keysOrder = [
      "member_id","precode","regis_date",
      "first_name","last_name","citizen_id",
      "address","mhoo","sub_district","district","province","postal_code",
      "phone_number","sex",
      "salary","tgs_group","share_per_month","transfer_date","ar_limit","normal_share",
      "last_bought_date","bank_account","tgs_id","spouce_name","orders_placed",
      "own_rai","own_ngan","own_wa","rent_rai","rent_ngan","rent_wa","other_rai","other_ngan","other_wa",
    ]
    const firstKey = keysOrder.find((k) => k in errors)
    if (firstKey) {
      const el = refs[firstKey]?.current
      if (el && typeof el.focus === "function") {
        try { el.scrollIntoView({ behavior: "smooth", block: "center" }) } catch {}
        el.focus()
      }
    }
    setShouldScrollError(false)
  }, [errors]) // eslint-disable-line react-hooks/exhaustive-deps

  // Preview เล็ก ๆ
  const landPreview = useMemo(() => {
    const ns = toNumber(form.normal_share)
    return ns ? `${ns.toLocaleString()} หุ้นปกติ` : ""
  }, [form.normal_share])

  const handleSubmit = async (ev) => {
    ev.preventDefault()
    const ok = validateAll()
    if (!ok) { setShouldScrollError(true); return }
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

  /** ---------- UI (ธีม/สไตล์เหมือนหน้า Sales) ---------- */
  return (
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
                ref={refs.member_id}
                inputMode="numeric"
                className={`${baseField} ${errors.member_id ? fieldError : ""}`}
                value={form.member_id}
                onChange={(e) => { clearError("member_id"); update("member_id", onlyDigits(e.target.value)) }}
                onFocus={() => clearError("member_id")}
                placeholder="เช่น 11263"
                aria-invalid={errors.member_id ? true : undefined}
              />
              {errors.member_id && <p className="mt-1 text-sm text-red-500">{errors.member_id}</p>}
            </div>

            {/* คำนำหน้า */}
            <div>
              <label className="mb-1 block text-sm text-slate-700 dark:text-slate-300">คำนำหน้า (precode)</label>
              <input
                ref={refs.precode}
                inputMode="numeric"
                className={`${baseField} ${errors.precode ? fieldError : ""}`}
                value={form.precode}
                onChange={(e) => { clearError("precode"); update("precode", onlyDigits(e.target.value)) }}
                onFocus={() => clearError("precode")}
                placeholder="เช่น 1"
                aria-invalid={errors.precode ? true : undefined}
              />
              {errors.precode && <p className="mt-1 text-sm text-red-500">{errors.precode}</p>}
            </div>

            {/* วันที่สมัคร */}
            <div className="md:col-span-2">
              <label className="mb-1 block text-sm text-slate-700 dark:text-slate-300">วันที่สมัคร (regis_date)</label>
              <input
                ref={refs.regis_date}
                type="date"
                className={`${baseField} ${errors.regis_date ? fieldError : ""}`}
                value={form.regis_date}
                onChange={(e) => { clearError("regis_date"); update("regis_date", e.target.value) }}
                onFocus={() => clearError("regis_date")}
                aria-invalid={errors.regis_date ? true : undefined}
              />
              {errors.regis_date && <p className="mt-1 text-sm text-red-500">{errors.regis_date}</p>}
            </div>

            {/* ชื่อ */}
            <div className="md:col-span-2">
              <label className="mb-1 block text-sm text-slate-700 dark:text-slate-300">ชื่อ</label>
              <input
                ref={refs.first_name}
                className={`${baseField} ${errors.first_name ? fieldError : ""}`}
                value={form.first_name}
                onChange={(e) => { clearError("first_name"); update("first_name", e.target.value) }}
                onFocus={() => clearError("first_name")}
                placeholder="สมชาย"
                aria-invalid={errors.first_name ? true : undefined}
              />
              {errors.first_name && <p className="mt-1 text-sm text-red-500">{errors.first_name}</p>}
            </div>

            {/* นามสกุล */}
            <div className="md:col-span-2">
              <label className="mb-1 block text-sm text-slate-700 dark:text-slate-300">นามสกุล</label>
              <input
                ref={refs.last_name}
                className={`${baseField} ${errors.last_name ? fieldError : ""}`}
                value={form.last_name}
                onChange={(e) => { clearError("last_name"); update("last_name", e.target.value) }}
                onFocus={() => clearError("last_name")}
                placeholder="ใจดี"
                aria-invalid={errors.last_name ? true : undefined}
              />
              {errors.last_name && <p className="mt-1 text-sm text-red-500">{errors.last_name}</p>}
            </div>

            {/* บัตรประชาชน */}
            <div className="md:col-span-2">
              <label className="mb-1 block text-sm text-slate-700 dark:text-slate-300">เลขบัตรประชาชน (13 หลัก)</label>
              <input
                ref={refs.citizen_id}
                inputMode="numeric"
                maxLength={13}
                className={`${baseField} ${errors.citizen_id ? fieldError : ""}`}
                value={form.citizen_id}
                onChange={(e) => { clearError("citizen_id"); update("citizen_id", onlyDigits(e.target.value)) }}
                onFocus={() => clearError("citizen_id")}
                placeholder="1234567890123"
                aria-invalid={errors.citizen_id ? true : undefined}
              />
              {errors.citizen_id && <p className="mt-1 text-sm text-red-500">{errors.citizen_id}</p>}
            </div>

            {/* เพศ */}
            <div>
              <label className="mb-1 block text-sm text-slate-700 dark:text-slate-300">เพศ (M/F)</label>
              <div ref={refs.sex}>
                <ComboBox
                  options={[
                    { value: "M", label: "ชาย (M)" },
                    { value: "F", label: "หญิง (F)" },
                  ]}
                  value={form.sex}
                  onChange={(v) => { clearError("sex"); update("sex", v) }}
                  placeholder="— เลือก —"
                  error={!!errors.sex}
                />
              </div>
              {errors.sex && <p className="mt-1 text-sm text-red-500">{errors.sex}</p>}
            </div>

            {/* ที่อยู่ */}
            <div className="md:col-span-3">
              <label className="mb-1 block text-sm text-slate-700 dark:text-slate-300">ที่อยู่ (address)</label>
              <input
                ref={refs.address}
                className={`${baseField} ${errors.address ? fieldError : ""}`}
                value={form.address}
                onChange={(e) => { clearError("address"); update("address", e.target.value) }}
                onFocus={() => clearError("address")}
                placeholder="บ้านเลขที่ หมู่ ตำบล อำเภอ จังหวัด"
                aria-invalid={errors.address ? true : undefined}
              />
              {errors.address && <p className="mt-1 text-sm text-red-500">{errors.address}</p>}
            </div>

            {/* หมู่ */}
            <div>
              <label className="mb-1 block text-sm text-slate-700 dark:text-slate-300">หมู่ (mhoo)</label>
              <input
                ref={refs.mhoo}
                className={baseField}
                value={form.mhoo}
                onChange={(e) => update("mhoo", e.target.value)}
                placeholder="เช่น 1"
              />
            </div>

            {/* ตำบล */}
            <div>
              <label className="mb-1 block text-sm text-slate-700 dark:text-slate-300">ตำบล (sub_district)</label>
              <input
                ref={refs.sub_district}
                className={`${baseField} ${errors.sub_district ? fieldError : ""}`}
                value={form.sub_district}
                onChange={(e) => { clearError("sub_district"); update("sub_district", e.target.value) }}
                onFocus={() => clearError("sub_district")}
                aria-invalid={errors.sub_district ? true : undefined}
              />
              {errors.sub_district && <p className="mt-1 text-sm text-red-500">{errors.sub_district}</p>}
            </div>

            {/* อำเภอ */}
            <div>
              <label className="mb-1 block text-sm text-slate-700 dark:text-slate-300">อำเภอ (district)</label>
              <input
                ref={refs.district}
                className={`${baseField} ${errors.district ? fieldError : ""}`}
                value={form.district}
                onChange={(e) => { clearError("district"); update("district", e.target.value) }}
                onFocus={() => clearError("district")}
                aria-invalid={errors.district ? true : undefined}
              />
              {errors.district && <p className="mt-1 text-sm text-red-500">{errors.district}</p>}
            </div>

            {/* จังหวัด */}
            <div>
              <label className="mb-1 block text-sm text-slate-700 dark:text-slate-300">จังหวัด (province)</label>
              <input
                ref={refs.province}
                className={`${baseField} ${errors.province ? fieldError : ""}`}
                value={form.province}
                onChange={(e) => { clearError("province"); update("province", e.target.value) }}
                onFocus={() => clearError("province")}
                aria-invalid={errors.province ? true : undefined}
              />
              {errors.province && <p className="mt-1 text-sm text-red-500">{errors.province}</p>}
            </div>

            {/* subprov */}
            <div>
              <label className="mb-1 block text_sm text-slate-700 dark:text-slate-300">อำเภอย่อย/รหัสอำเภอ (subprov)</label>
              <input
                ref={refs.subprov}
                inputMode="numeric"
                className={baseField}
                value={form.subprov}
                onChange={(e) => update("subprov", onlyDigits(e.target.value))}
                placeholder="เช่น 501"
              />
            </div>

            {/* รหัสไปรษณีย์ */}
            <div>
              <label className="mb-1 block text-sm text-slate-700 dark:text-slate-300">รหัสไปรษณีย์</label>
              <input
                ref={refs.postal_code}
                inputMode="numeric"
                maxLength={5}
                className={`${baseField} ${errors.postal_code ? fieldError : ""}`}
                value={form.postal_code}
                onChange={(e) => { clearError("postal_code"); update("postal_code", onlyDigits(e.target.value)) }}
                onFocus={() => clearError("postal_code")}
                aria-invalid={errors.postal_code ? true : undefined}
              />
              {errors.postal_code && <p className="mt-1 text-sm text-red-500">{errors.postal_code}</p>}
            </div>

            {/* โทรศัพท์ */}
            <div className="md:col-span-2">
              <label className="mb-1 block text-sm text-slate-700 dark:text-slate-300">โทรศัพท์ (phone_number)</label>
              <input
                ref={refs.phone_number}
                inputMode="tel"
                className={`${baseField} ${errors.phone_number ? fieldError : ""}`}
                value={form.phone_number}
                onChange={(e) => { clearError("phone_number"); update("phone_number", e.target.value) }}
                onFocus={() => clearError("phone_number")}
                placeholder="08x-xxx-xxxx"
                aria-invalid={errors.phone_number ? true : undefined}
              />
              {errors.phone_number && <p className="mt-1 text-sm text-red-500">{errors.phone_number}</p>}
            </div>

            {/* เงินเดือน */}
            <div>
              <label className="mb-1 block text-sm text-slate-700 dark:text-slate-300">เงินเดือน (salary)</label>
              <input
                ref={refs.salary}
                inputMode="decimal"
                className={`${baseField} ${errors.salary ? fieldError : ""}`}
                value={form.salary}
                onChange={(e) => { clearError("salary"); update("salary", e.target.value.replace(/[^\d.]/g, "")) }}
                onFocus={() => clearError("salary")}
                placeholder="15000"
                aria-invalid={errors.salary ? true : undefined}
              />
              {errors.salary && <p className="mt-1 text-sm text-red-500">{errors.salary}</p>}
            </div>

            {/* กลุ่ม */}
            <div>
              <label className="mb-1 block text-sm text-slate-700 dark:text-slate-300">กลุ่ม (tgs_group)</label>
              <input
                ref={refs.tgs_group}
                inputMode="numeric"
                className={`${baseField} ${errors.tgs_group ? fieldError : ""}`}
                value={form.tgs_group}
                onChange={(e) => { clearError("tgs_group"); update("tgs_group", onlyDigits(e.target.value)) }}
                onFocus={() => clearError("tgs_group")}
                placeholder="16"
                aria-invalid={errors.tgs_group ? true : undefined}
              />
              {errors.tgs_group && <p className="mt-1 text-sm text-red-500">{errors.tgs_group}</p>}
            </div>

            {/* ส่งหุ้น/เดือน */}
            <div>
              <label className="mb-1 block text-sm text-slate-700 dark:text-slate-300">ส่งหุ้น/เดือน (share_per_month)</label>
              <input
                ref={refs.share_per_month}
                inputMode="decimal"
                className={`${baseField} ${errors.share_per_month ? fieldError : ""}`}
                value={form.share_per_month}
                onChange={(e) => { clearError("share_per_month"); update("share_per_month", e.target.value.replace(/[^\d.]/g, "")) }}
                onFocus={() => clearError("share_per_month")}
                placeholder="500"
                aria-invalid={errors.share_per_month ? true : undefined}
              />
              {errors.share_per_month && <p className="mt-1 text-sm text-red-500">{errors.share_per_month}</p>}
            </div>

            {/* วงเงินสินเชื่อ */}
            <div>
              <label className="mb-1 block text-sm text-slate-700 dark:text-slate-300">วงเงินสินเชื่อ (ar_limit)</label>
              <input
                ref={refs.ar_limit}
                inputMode="numeric"
                className={`${baseField} ${errors.ar_limit ? fieldError : ""}`}
                value={form.ar_limit}
                onChange={(e) => { clearError("ar_limit"); update("ar_limit", onlyDigits(e.target.value)) }}
                onFocus={() => clearError("ar_limit")}
                placeholder="100000"
                aria-invalid={errors.ar_limit ? true : undefined}
              />
              {errors.ar_limit && <p className="mt-1 text-sm text-red-500">{errors.ar_limit}</p>}
            </div>

            {/* หุ้นปกติ */}
            <div>
              <label className="mb-1 block text-sm text-slate-700 dark:text-slate-300">หุ้นปกติ (normal_share)</label>
              <input
                ref={refs.normal_share}
                inputMode="decimal"
                className={`${baseField} ${errors.normal_share ? fieldError : ""}`}
                value={form.normal_share}
                onChange={(e) => { clearError("normal_share"); update("normal_share", e.target.value.replace(/[^\d.]/g, "")) }}
                onFocus={() => clearError("normal_share")}
                placeholder="214"
                aria-invalid={errors.normal_share ? true : undefined}
              />
              {errors.normal_share && <p className="mt-1 text-sm text-red-500">{errors.normal_share}</p>}
              <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">{landPreview}</p>
            </div>

            {/* วันที่ซื้อครั้งล่าสุด */}
            <div>
              <label className="mb-1 block text-sm text-slate-700 dark:text-slate-300">วันที่ซื้อครั้งล่าสุด (last_bought_date)</label>
              <input
                ref={refs.last_bought_date}
                type="date"
                className={`${baseField} ${errors.last_bought_date ? fieldError : ""}`}
                value={form.last_bought_date}
                onChange={(e) => { clearError("last_bought_date"); update("last_bought_date", e.target.value) }}
                onFocus={() => clearError("last_bought_date")}
                aria-invalid={errors.last_bought_date ? true : undefined}
              />
              {errors.last_bought_date && <p className="mt-1 text-sm text-red-500">{errors.last_bought_date}</p>}
            </div>

            {/* วันที่โอน */}
            <div>
              <label className="mb-1 block text-sm text-slate-700 dark:text-slate-300">
                วันที่โอน (transfer_date - ไม่ระบุก็ได้)
              </label>
              <input
                ref={refs.transfer_date}
                type="date"
                className={baseField}
                value={form.transfer_date}
                onChange={(e) => update("transfer_date", e.target.value)}
              />
            </div>

            {/* บัญชีธนาคาร */}
            <div className="md:col-span-2">
              <label className="mb-1 block text-sm text-slate-700 dark:text-slate-300">บัญชีธนาคาร (bank_account)</label>
              <input
                ref={refs.bank_account}
                className={baseField}
                value={form.bank_account}
                onChange={(e) => update("bank_account", e.target.value)}
                placeholder="014-1-23456-7"
              />
            </div>

            {/* รหัสสมาชิกระบบ */}
            <div>
              <label className="mb-1 block text-sm text-slate-700 dark:text-slate-300">รหัสสมาชิกในระบบ (tgs_id)</label>
              <input
                ref={refs.tgs_id}
                className={baseField}
                value={form.tgs_id}
                onChange={(e) => update("tgs_id", e.target.value)}
                placeholder="TGS-001"
              />
            </div>

            {/* คู่สมรส */}
            <div>
              <label className="mb-1 block text-sm text-slate-700 dark:text-slate-300">ชื่อคู่สมรส (spouce_name)</label>
              <input
                ref={refs.spouce_name}
                className={baseField}
                value={form.spouce_name}
                onChange={(e) => update("spouce_name", e.target.value)}
              />
            </div>

            {/* จำนวนครั้งที่ซื้อ */}
            <div>
              <label className="mb-1 block text-sm text-slate-700 dark:text-slate-300">จำนวนครั้งที่ซื้อ (orders_placed)</label>
              <input
                ref={refs.orders_placed}
                inputMode="numeric"
                className={`${baseField} ${errors.orders_placed ? fieldError : ""}`}
                value={form.orders_placed}
                onChange={(e) => { clearError("orders_placed"); update("orders_placed", onlyDigits(e.target.value)) }}
                onFocus={() => clearError("orders_placed")}
                placeholder="เช่น 4"
                aria-invalid={errors.orders_placed ? true : undefined}
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
                        ref={refs[`${key}_rai`]}
                        inputMode="numeric"
                        className={`${baseField} text-center ${errors[`${key}_rai`] ? fieldError : ""}`}
                        value={form[`${key}_rai`]}
                        onChange={(e)=>{ clearError(`${key}_rai`); update(`${key}_rai`, onlyDigits(e.target.value)) }}
                        onFocus={() => clearError(`${key}_rai`)}
                        placeholder="0"
                        aria-invalid={errors[`${key}_rai`] ? true : undefined}
                      />
                      {errors[`${key}_rai`] && <p className="mt-1 text-xs text-red-500">{errors[`${key}_rai`]}</p>}
                    </td>
                    <td className="px-3 py-2">
                      <input
                        ref={refs[`${key}_ngan`]}
                        inputMode="numeric"
                        className={`${baseField} text-center ${errors[`${key}_ngan`] ? fieldError : ""}`}
                        value={form[`${key}_ngan`]}
                        onChange={(e)=>{ clearError(`${key}_ngan`); update(`${key}_ngan`, String(clampNgan(e.target.value))) }}
                        onFocus={() => clearError(`${key}_ngan`)}
                        placeholder="0–3"
                        aria-invalid={errors[`${key}_ngan`] ? true : undefined}
                      />
                      {errors[`${key}_ngan`] && <p className="mt-1 text-xs text-red-500">{errors[`${key}_ngan`]}</p>}
                    </td>
                    <td className="px-3 py-2">
                      <input
                        ref={refs[`${key}_wa`]}
                        inputMode="numeric"
                        className={`${baseField} text-center ${errors[`${key}_wa`] ? fieldError : ""}`}
                        value={form[`${key}_wa`]}
                        onChange={(e)=>{ clearError(`${key}_wa`); update(`${key}_wa`, String(clampWa(e.target.value))) }}
                        onFocus={() => clearError(`${key}_wa`)}
                        placeholder="0–99"
                        aria-invalid={errors[`${key}_wa`] ? true : undefined}
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
              className={BTN_PRIMARY}
              aria-busy={submitting ? "true" : "false"}
            >
              {submitting ? "กำลังบันทึก..." : "บันทึกการสมัครสมาชิก"}
            </button>
            <button
              type="button"
              onClick={handleReset}
              className={BTN_SECONDARY}
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
