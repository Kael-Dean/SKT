import { useEffect, useMemo, useRef, useState, forwardRef, useImperativeHandle } from "react"

/** ---------- ENV ---------- */
const API_BASE = import.meta.env.VITE_API_BASE || ""

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

/** ---------- class helpers ---------- */
const cx = (...a) => a.filter(Boolean).join(" ")

/** ---------- สไตล์เดียวกับหน้า Sales ---------- */
const baseField =
  "w-full rounded-2xl border border-slate-300 bg-slate-100 p-3 text-[15px] md:text-base " +
  "text-black outline-none placeholder:text-slate-500 focus:border-emerald-600 focus:ring-2 focus:ring-emerald-500/30 shadow-none " +
  "dark:border-slate-500 dark:bg-slate-700 dark:text-slate-100 dark:placeholder:text-slate-300 dark:focus:border-emerald-400 dark:focus:ring-emerald-400/30"

const fieldError = "border-red-500 ring-2 ring-red-300 focus:ring-0 focus:border-red-500"
const fieldDisabled =
  "bg-slate-200 text-slate-600 cursor-not-allowed opacity-95 dark:bg-slate-700/70 dark:text-slate-300"

const labelCls = "mb-1 block text-[15px] md:text-base font-medium text-slate-700 dark:text-slate-200"
const helpTextCls = "mt-1 text-sm text-slate-600 dark:text-slate-300"
const errorTextCls = "mt-1 text-sm text-red-500"

/** ---------- Reusable Section Card ---------- */
function SectionCard({ title, subtitle, children, className = "" }) {
  return (
    <div
      className={cx(
        "rounded-2xl border border-slate-200 bg-white p-5 text-black shadow-sm",
        "dark:border-slate-700 dark:bg-slate-800 dark:text-white",
        className
      )}
    >
      {title && <h2 className="mb-1 text-xl font-semibold">{title}</h2>}
      {subtitle && <p className="mb-4 text-sm text-slate-600 dark:text-slate-300">{subtitle}</p>}
      {children}
    </div>
  )
}

/** ---------- Reusable ComboBox ---------- */
function ComboBox({
  options = [],
  value,
  onChange,
  placeholder = "— เลือก —",
  getLabel = (o) => o?.label ?? "",
  getValue = (o) => o?.value ?? o?.id ?? "",
  disabled = false,
  error = false,
  buttonRef = null,
}) {
  const [open, setOpen] = useState(false)
  const [highlight, setHighlight] = useState(-1)
  const boxRef = useRef(null)
  const listRef = useRef(null)
  const internalBtnRef = useRef(null)
  const controlRef = buttonRef || internalBtnRef

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
    requestAnimationFrame(() => controlRef.current?.focus())
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
        ref={controlRef}
        disabled={disabled}
        onClick={() => {
          if (!disabled) setOpen((o) => !o)
        }}
        onKeyDown={onKeyDown}
        className={cx(
          "w-full rounded-2xl border p-3 text-left text-[15px] md:text-base outline-none transition shadow-none",
          disabled ? "bg-slate-200 cursor-not-allowed" : "bg-slate-100 hover:bg-slate-200 cursor-pointer",
          error
            ? "border-red-400 ring-2 ring-red-300/70"
            : "border-slate-300 focus:border-emerald-600 focus:ring-2 focus:ring-emerald-500/30",
          "dark:border-slate-500 dark:bg-slate-700 dark:text-slate-100 dark:hover:bg-slate-700/80"
        )}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-invalid={error ? true : undefined}
      >
        {selectedLabel || <span className="text-slate-500 dark:text-white/70">{placeholder}</span>}
      </button>

      {open && (
        <div
          ref={listRef}
          role="listbox"
          className="absolute z-20 mt-1 max-h-72 w-full overflow-auto rounded-2xl border border-slate-200 bg-white text-black shadow-lg dark:border-slate-700 dark:bg-slate-800 dark:text-white"
        >
          {options.length === 0 && (
            <div className="px-3 py-2 text-sm text-slate-600 dark:text-slate-300">ไม่มีตัวเลือก</div>
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
                className={cx(
                  "relative flex w-full items-center gap-2 px-3 py-2.5 text-left text-[15px] md:text-base transition rounded-xl cursor-pointer",
                  isActive
                    ? "bg-emerald-100 ring-1 ring-emerald-300 dark:bg-emerald-400/20 dark:ring-emerald-500"
                    : "hover:bg-emerald-50 dark:hover:bg-emerald-900/30"
                )}
              >
                {isActive && (
                  <span className="absolute left-0 top-0 h-full w-1 bg-emerald-600 dark:bg-emerald-400/70 rounded-l-xl" />
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

/** ---------- DateInput ---------- */
const DateInput = forwardRef(function DateInput({ error = false, className = "", ...props }, ref) {
  const inputRef = useRef(null)
  useImperativeHandle(ref, () => inputRef.current)

  return (
    <div className="relative">
      <style>{`
        input[type="date"]::-webkit-calendar-picker-indicator { opacity: 0; }
      `}</style>

      <input
        type="date"
        ref={inputRef}
        className={cx(baseField, "pr-12 cursor-pointer", error && fieldError, className)}
        {...props}
      />

      <button
        type="button"
        onClick={() => {
          const el = inputRef.current
          if (!el) return
          if (typeof el.showPicker === "function") el.showPicker()
          else { el.focus(); el.click?.() }
        }}
        aria-label="เปิดตัวเลือกวันที่"
        className="absolute right-2 top-1/2 -translate-y-1/2 inline-flex h-9 w-9 items-center justify-center rounded-xl
                   transition-transform hover:scale-110 active:scale-95 focus:outline-none cursor-pointer bg-transparent"
      >
        <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor" className="text-slate-600 dark:text-slate-200">
          <path d="M7 2a1 1 0 0 1 1 1v1h8V3a1 1 0 1 1 2 0v1h1a2 2 0 0 1 2 2v3H3V6a2 2 0 0 1 2-2h1V3a1 1 0 0 1 1-1zm14 9v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-7h18zM7 14h2v2H7v-2zm4 0h2v2h-2v-2z" />
        </svg>
      </button>
    </div>
  )
})

/** ---------- Component ---------- */
const MemberSignup = () => {
  const [errors, setErrors] = useState({})
  const [submitting, setSubmitting] = useState(false)
  const [shouldScrollError, setShouldScrollError] = useState(false)

  const [form, setForm] = useState({
    regis_date: new Date().toISOString().slice(0, 10),
    seedling_prog: false,
    slowdown_rice: false,
    organic_prog: false,
    product_loan: false,

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
    spouce_name: "",   // <— อยู่ในกรอบแรกแล้ว
    orders_placed: "",

    // Land
    own_rai: "",   own_ngan: "",   own_wa: "",
    rent_rai: "",  rent_ngan: "",  rent_wa: "",
    other_rai: "", other_ngan: "", other_wa: "",
  })

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
    subprov: useRef(null),
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
    own_rai: useRef(null),  own_ngan: useRef(null),  own_wa: useRef(null),
    rent_rai: useRef(null), rent_ngan: useRef(null), rent_wa: useRef(null),
    other_rai: useRef(null),other_ngan: useRef(null),other_wa: useRef(null),
  }

  const update = (k, v) => setForm((prev) => ({ ...prev, [k]: v }))
  const clearError = (key) =>
    setErrors((prev) => {
      if (!(key in prev)) return prev
      const { [key]: _omit, ...rest } = prev
      return rest
    })

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
      "member_id","precode","subprov","postal_code","salary","tgs_group","share_per_month",
      "ar_limit","normal_share","orders_placed",
      "own_rai","own_ngan","own_wa","rent_rai","rent_ngan","rent_wa","other_rai","other_ngan","other_wa",
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
      seedling_prog: !!form.seedling_prog,
      slowdown_rice: !!form.slowdown_rice,
      organic_prog: !!form.organic_prog,
      product_loan: !!form.product_loan,

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
      spouce_name: form.spouce_name.trim(), // เหมือนเดิม
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
      seedling_prog: false,
      slowdown_rice: false,
      organic_prog: false,
      product_loan: false,

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

  /** ---------- UI ---------- */
  return (
    <div className="min-h-screen bg-white text-black dark:bg-slate-900 dark:text-white rounded-2xl text-[15px] md:text-base">
      <div className="mx-auto max-w-7xl p-5 md:p-6 lg:p-8">
        <h1 className="mb-4 text-3xl font-bold text-gray-900 dark:text-white">👤 สมัครสมาชิก</h1>

        <form onSubmit={handleSubmit}>
          {/* โครงการที่เข้าร่วม */}
          <SectionCard title="โครงการที่เข้าร่วม" className="mb-6">
            <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-4">
              {[
                { key: "seedling_prog",  label: "โครงผลิตเมล็ดพันธ์" },
                { key: "slowdown_rice",  label: "โครงการชะลอข้าวเปลือก" },
                { key: "organic_prog",   label: "โครงการอินทรีย์" },
                { key: "product_loan",   label: "โครงการสินค้าเป็นเงินเชื่อ" },
              ].map(({ key, label }) => (
                <label
                  key={key}
                  className={cx(
                    "group relative flex items-center gap-4 cursor-pointer rounded-2xl border p-4 min-h-[72px] transition-all",
                    "border-slate-200 bg-white/80 dark:border-slate-700 dark:bg-slate-700/40",
                    "shadow-[0_4px_14px_rgba(0,0,0,0.06)] hover:shadow-[0_10px_26px_rgba(0,0,0,0.12)]",
                    "hover:border-emerald-300/70 dark:hover:border-emerald-400/40",
                    // active state
                    form[key] ? "ring-2 ring-emerald-400 shadow-[0_12px_30px_rgba(16,185,129,0.25)]" : "ring-0"
                  )}
                >
                  <span
                    className={cx(
                      "relative inline-flex h-7 w-12 flex-shrink-0 items-center rounded-full transition-colors",
                      form[key] ? "bg-emerald-600" : "bg-slate-300 dark:bg-slate-600"
                    )}
                    aria-hidden="true"
                  >
                    <span
                      className={cx(
                        "inline-block h-6 w-6 transform rounded-full bg-white shadow transition",
                        "shadow-[0_3px_10px_rgba(0,0,0,0.25)]",
                        form[key] ? "translate-x-6" : "translate-x-1",
                        "group-hover:scale-105"
                      )}
                    />
                  </span>

                  <input type="checkbox" className="sr-only" checked={!!form[key]} onChange={(e) => update(key, e.target.checked)} />
                  <span className="text-slate-800 dark:text-slate-100 text-[15px] md:text-base font-medium">{label}</span>
                  <span className={cx("pointer-events-none absolute inset-0 rounded-2xl transition-opacity","bg-emerald-100/30 dark:bg-emerald-400/10", form[key] ? "opacity-100" : "opacity-0 group-hover:opacity-100")} aria-hidden="true" />
                </label>
              ))}
            </div>
          </SectionCard>

          {/* กรอบที่ 1 */}
          <SectionCard title="ข้อมูลสมาชิก">
            <div className="grid gap-4 md:grid-cols-4">
              {/* เลขสมาชิก */}
              <div>
                <label className={labelCls}>เลขสมาชิก (member_id)</label>
                <input
                  ref={refs.member_id}
                  inputMode="numeric"
                  className={cx(baseField, errors.member_id && fieldError)}
                  value={form.member_id}
                  onChange={(e) => { clearError("member_id"); update("member_id", onlyDigits(e.target.value)) }}
                  onFocus={() => clearError("member_id")}
                  placeholder="เช่น 11263"
                  aria-invalid={errors.member_id ? true : undefined}
                />
                {errors.member_id && <p className={errorTextCls}>{errors.member_id}</p>}
              </div>

              {/* คำนำหน้า */}
              <div>
                <label className={labelCls}>คำนำหน้า (precode)</label>
                <input
                  ref={refs.precode}
                  inputMode="numeric"
                  className={cx(baseField, errors.precode && fieldError)}
                  value={form.precode}
                  onChange={(e) => { clearError("precode"); update("precode", onlyDigits(e.target.value)) }}
                  onFocus={() => clearError("precode")}
                  placeholder="เช่น 1"
                  aria-invalid={errors.precode ? true : undefined}
                />
                {errors.precode && <p className={errorTextCls}>{errors.precode}</p>}
              </div>

              {/* วันที่สมัคร */}
              <div className="md:col-span-2">
                <label className={labelCls}>วันที่สมัคร (regis_date)</label>
                <DateInput
                  ref={refs.regis_date}
                  value={form.regis_date}
                  onChange={(e) => { clearError("regis_date"); update("regis_date", e.target.value) }}
                  onFocus={() => clearError("regis_date")}
                  error={!!errors.regis_date}
                  aria-invalid={errors.regis_date ? true : undefined}
                />
                {errors.regis_date && <p className={errorTextCls}>{errors.regis_date}</p>}
              </div>

              {/* ชื่อ */}
              <div className="md:col-span-2">
                <label className={labelCls}>ชื่อ</label>
                <input
                  ref={refs.first_name}
                  className={cx(baseField, errors.first_name && fieldError)}
                  value={form.first_name}
                  onChange={(e) => { clearError("first_name"); update("first_name", e.target.value) }}
                  onFocus={() => clearError("first_name")}
                  placeholder="สมชาย"
                  aria-invalid={errors.first_name ? true : undefined}
                />
                {errors.first_name && <p className={errorTextCls}>{errors.first_name}</p>}
              </div>

              {/* นามสกุล */}
              <div className="md:col-span-2">
                <label className={labelCls}>นามสกุล</label>
                <input
                  ref={refs.last_name}
                  className={cx(baseField, errors.last_name && fieldError)}
                  value={form.last_name}
                  onChange={(e) => { clearError("last_name"); update("last_name", e.target.value) }}
                  onFocus={() => clearError("last_name")}
                  placeholder="ใจดี"
                  aria-invalid={errors.last_name ? true : undefined}
                />
                {errors.last_name && <p className={errorTextCls}>{errors.last_name}</p>}
              </div>

              {/* บัตรประชาชน */}
              <div className="md:col-span-2">
                <label className={labelCls}>เลขบัตรประชาชน (13 หลัก)</label>
                <input
                  ref={refs.citizen_id}
                  inputMode="numeric"
                  maxLength={13}
                  className={cx(baseField, errors.citizen_id && fieldError)}
                  value={form.citizen_id}
                  onChange={(e) => { clearError("citizen_id"); update("citizen_id", onlyDigits(e.target.value)) }}
                  onFocus={() => clearError("citizen_id")}
                  placeholder="1234567890123"
                  aria-invalid={errors.citizen_id ? true : undefined}
                />
                {errors.citizen_id && <p className={errorTextCls}>{errors.citizen_id}</p>}
              </div>

              {/* เพศ */}
              <div>
                <label className={labelCls}>เพศ (M/F)</label>
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
                {errors.sex && <p className={errorTextCls}>{errors.sex}</p>}
              </div>

              {/* คู่สมรส — ย้ายมาอยู่กรอบแรก */}
              <div className="md:col-span-2">
                <label className={labelCls}>ชื่อคู่สมรส (spouce_name)</label>
                <input
                  ref={refs.spouce_name}
                  className={baseField}
                  value={form.spouce_name}
                  onChange={(e) => update("spouce_name", e.target.value)}
                />
              </div>
            </div>
          </SectionCard>

          {/* กรอบที่ 2 */}
          <SectionCard title="ที่อยู่และการติดต่อ" className="mt-6">
            <div className="grid gap-4 md:grid-cols-4">
              <div className="md:col-span-3">
                <label className={labelCls}>ที่อยู่ (address)</label>
                <input
                  ref={refs.address}
                  className={cx(baseField, errors.address && fieldError)}
                  value={form.address}
                  onChange={(e) => { clearError("address"); update("address", e.target.value) }}
                  onFocus={() => clearError("address")}
                  placeholder="บ้านเลขที่ หมู่ ตำบล อำเภอ จังหวัด"
                  aria-invalid={errors.address ? true : undefined}
                />
                {errors.address && <p className={errorTextCls}>{errors.address}</p>}
              </div>

              <div>
                <label className={labelCls}>หมู่ (mhoo)</label>
                <input ref={refs.mhoo} className={baseField} value={form.mhoo} onChange={(e) => update("mhoo", e.target.value)} placeholder="เช่น 1" />
              </div>

              <div>
                <label className={labelCls}>ตำบล (sub_district)</label>
                <input
                  ref={refs.sub_district}
                  className={cx(baseField, errors.sub_district && fieldError)}
                  value={form.sub_district}
                  onChange={(e) => { clearError("sub_district"); update("sub_district", e.target.value) }}
                  onFocus={() => clearError("sub_district")}
                  aria-invalid={errors.sub_district ? true : undefined}
                />
                {errors.sub_district && <p className={errorTextCls}>{errors.sub_district}</p>}
              </div>

              <div>
                <label className={labelCls}>อำเภอ (district)</label>
                <input
                  ref={refs.district}
                  className={cx(baseField, errors.district && fieldError)}
                  value={form.district}
                  onChange={(e) => { clearError("district"); update("district", e.target.value) }}
                  onFocus={() => clearError("district")}
                  aria-invalid={errors.district ? true : undefined}
                />
                {errors.district && <p className={errorTextCls}>{errors.district}</p>}
              </div>

              <div>
                <label className={labelCls}>จังหวัด (province)</label>
                <input
                  ref={refs.province}
                  className={cx(baseField, errors.province && fieldError)}
                  value={form.province}
                  onChange={(e) => { clearError("province"); update("province", e.target.value) }}
                  onFocus={() => clearError("province")}
                  aria-invalid={errors.province ? true : undefined}
                />
                {errors.province && <p className={errorTextCls}>{errors.province}</p>}
              </div>

              <div>
                <label className={labelCls}>อำเภอย่อย/รหัสอำเภอ (subprov)</label>
                <input ref={refs.subprov} inputMode="numeric" className={baseField} value={form.subprov} onChange={(e) => update("subprov", onlyDigits(e.target.value))} placeholder="เช่น 501" />
              </div>

              <div>
                <label className={labelCls}>รหัสไปรษณีย์</label>
                <input
                  ref={refs.postal_code}
                  inputMode="numeric"
                  maxLength={5}
                  className={cx(baseField, errors.postal_code && fieldError)}
                  value={form.postal_code}
                  onChange={(e) => { clearError("postal_code"); update("postal_code", onlyDigits(e.target.value)) }}
                  onFocus={() => clearError("postal_code")}
                  aria-invalid={errors.postal_code ? true : undefined}
                />
                {errors.postal_code && <p className={errorTextCls}>{errors.postal_code}</p>}
              </div>

              <div className="md:col-span-2">
                <label className={labelCls}>โทรศัพท์ (phone_number)</label>
                <input
                  ref={refs.phone_number}
                  inputMode="tel"
                  className={cx(baseField, errors.phone_number && fieldError)}
                  value={form.phone_number}
                  onChange={(e) => { clearError("phone_number"); update("phone_number", e.target.value) }}
                  onFocus={() => clearError("phone_number")}
                  placeholder="08x-xxx-xxxx"
                  aria-invalid={errors.phone_number ? true : undefined}
                />
                {errors.phone_number && <p className={errorTextCls}>{errors.phone_number}</p>}
              </div>
            </div>
          </SectionCard>

          {/* กรอบที่ 3 */}
          <SectionCard title="ข้อมูลเพิ่มเติมและการเงิน" className="mt-6">
            <div className="grid gap-4 md:grid-cols-4">
              <div>
                <label className={labelCls}>เงินเดือน (salary)</label>
                <input
                  ref={refs.salary}
                  inputMode="decimal"
                  className={cx(baseField, errors.salary && fieldError)}
                  value={form.salary}
                  onChange={(e) => { clearError("salary"); update("salary", e.target.value.replace(/[^\d.]/g, "")) }}
                  onFocus={() => clearError("salary")}
                  placeholder="15000"
                  aria-invalid={errors.salary ? true : undefined}
                />
                {errors.salary && <p className={errorTextCls}>{errors.salary}</p>}
              </div>

              <div>
                <label className={labelCls}>กลุ่ม (tgs_group)</label>
                <input
                  ref={refs.tgs_group}
                  inputMode="numeric"
                  className={cx(baseField, errors.tgs_group && fieldError)}
                  value={form.tgs_group}
                  onChange={(e) => { clearError("tgs_group"); update("tgs_group", onlyDigits(e.target.value)) }}
                  onFocus={() => clearError("tgs_group")}
                  placeholder="16"
                  aria-invalid={errors.tgs_group ? true : undefined}
                />
                {errors.tgs_group && <p className={errorTextCls}>{errors.tgs_group}</p>}
              </div>

              <div>
                <label className={labelCls}>ส่งหุ้น/เดือน (share_per_month)</label>
                <input
                  ref={refs.share_per_month}
                  inputMode="decimal"
                  className={cx(baseField, errors.share_per_month && fieldError)}
                  value={form.share_per_month}
                  onChange={(e) => { clearError("share_per_month"); update("share_per_month", e.target.value.replace(/[^\d.]/g, "")) }}
                  onFocus={() => clearError("share_per_month")}
                  placeholder="500"
                  aria-invalid={errors.share_per_month ? true : undefined}
                />
                {errors.share_per_month && <p className={errorTextCls}>{errors.share_per_month}</p>}
              </div>

              <div>
                <label className={labelCls}>วงเงินสินเชื่อ (ar_limit)</label>
                <input
                  ref={refs.ar_limit}
                  inputMode="numeric"
                  className={cx(baseField, errors.ar_limit && fieldError)}
                  value={form.ar_limit}
                  onChange={(e) => { clearError("ar_limit"); update("ar_limit", onlyDigits(e.target.value)) }}
                  onFocus={() => clearError("ar_limit")}
                  placeholder="100000"
                  aria-invalid={errors.ar_limit ? true : undefined}
                />
                {errors.ar_limit && <p className={errorTextCls}>{errors.ar_limit}</p>}
              </div>

              <div>
                <label className={labelCls}>หุ้นปกติ (normal_share)</label>
                <input
                  ref={refs.normal_share}
                  inputMode="decimal"
                  className={cx(baseField, errors.normal_share && fieldError)}
                  value={form.normal_share}
                  onChange={(e) => { clearError("normal_share"); update("normal_share", e.target.value.replace(/[^\d.]/g, "")) }}
                  onFocus={() => clearError("normal_share")}
                  placeholder="214"
                  aria-invalid={errors.normal_share ? true : undefined}
                />
                {errors.normal_share && <p className={errorTextCls}>{errors.normal_share}</p>}
                {!!landPreview && <p className={helpTextCls}>{landPreview}</p>}
              </div>

              <div>
                <label className={labelCls}>วันที่ซื้อครั้งล่าสุด (last_bought_date)</label>
                <DateInput
                  ref={refs.last_bought_date}
                  value={form.last_bought_date}
                  onChange={(e) => { clearError("last_bought_date"); update("last_bought_date", e.target.value) }}
                  onFocus={() => clearError("last_bought_date")}
                  error={!!errors.last_bought_date}
                  aria-invalid={errors.last_bought_date ? true : undefined}
                />
                {errors.last_bought_date && <p className={errorTextCls}>{errors.last_bought_date}</p>}
              </div>

              <div>
                <label className={labelCls}>วันที่โอน (transfer_date - ไม่ระบุก็ได้)</label>
                <DateInput ref={refs.transfer_date} value={form.transfer_date} onChange={(e) => update("transfer_date", e.target.value)} />
              </div>

              <div className="md:col-span-2">
                <label className={labelCls}>บัญชีธนาคาร (bank_account)</label>
                <input ref={refs.bank_account} className={baseField} value={form.bank_account} onChange={(e) => update("bank_account", e.target.value)} placeholder="014-1-23456-7" />
              </div>

              <div>
                <label className={labelCls}>รหัสสมาชิกในระบบ (tgs_id)</label>
                <input ref={refs.tgs_id} className={baseField} value={form.tgs_id} onChange={(e) => update("tgs_id", e.target.value)} placeholder="TGS-001" />
              </div>

              {/* เอา 'คู่สมรส' ออกไปแล้วจากกรอบนี้ */}
              <div>
                <label className={labelCls}>จำนวนครั้งที่ซื้อ (orders_placed)</label>
                <input
                  ref={refs.orders_placed}
                  inputMode="numeric"
                  className={cx(baseField, errors.orders_placed && fieldError)}
                  value={form.orders_placed}
                  onChange={(e) => { clearError("orders_placed"); update("orders_placed", onlyDigits(e.target.value)) }}
                  onFocus={() => clearError("orders_placed")}
                  placeholder="เช่น 4"
                  aria-invalid={errors.orders_placed ? true : undefined}
                />
                {errors.orders_placed && <p className={errorTextCls}>{errors.orders_placed}</p>}
              </div>
            </div>

            {/* ที่ดินถือครอง */}
            <h3 className="mt-6 mb-3 text-lg font-semibold">ที่ดินถือครอง</h3>
            <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white text-black shadow-sm dark:border-slate-700 dark:bg-slate-800 dark:text-white">
              <table className="min-w-full text-left text-[15px] md:text-base">
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
                          className={cx(baseField, "text-center", errors[`${key}_rai`] && fieldError)}
                          value={form[`${key}_rai`]}
                          onChange={(e)=>{ clearError(`${key}_rai`); update(`${key}_rai`, onlyDigits(e.target.value)) }}
                          onFocus={() => clearError(`${key}_rai`)}
                          placeholder="0"
                          aria-invalid={errors[`${key}_rai`] ? true : undefined}
                        />
                        {errors[`${key}_rai`] && <p className={cx(errorTextCls, "text-xs")}>{errors[`${key}_rai`]}</p>}
                      </td>
                      <td className="px-3 py-2">
                        <input
                          ref={refs[`${key}_ngan`]}
                          inputMode="numeric"
                          className={cx(baseField, "text-center", errors[`${key}_ngan`] && fieldError)}
                          value={form[`${key}_ngan`]}
                          onChange={(e)=>{ clearError(`${key}_ngan`); update(`${key}_ngan`, String(clampNgan(e.target.value))) }}
                          onFocus={() => clearError(`${key}_ngan`)}
                          placeholder="0–3"
                          aria-invalid={errors[`${key}_ngan`] ? true : undefined}
                        />
                        {errors[`${key}_ngan`] && <p className={cx(errorTextCls, "text-xs")}>{errors[`${key}_ngan`]}</p>}
                      </td>
                      <td className="px-3 py-2">
                        <input
                          ref={refs[`${key}_wa`]}
                          inputMode="numeric"
                          className={cx(baseField, "text-center", errors[`${key}_wa`] && fieldError)}
                          value={form[`${key}_wa`]}
                          onChange={(e)=>{ clearError(`${key}_wa`); update(`${key}_wa`, String(clampWa(e.target.value))) }}
                          onFocus={() => clearError(`${key}_wa`)}
                          placeholder="0–99"
                          aria-invalid={errors[`${key}_wa`] ? true : undefined}
                        />
                        {errors[`${key}_wa`] && <p className={cx(errorTextCls, "text-xs")}>{errors[`${key}_wa`]}</p>}
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
                className="inline-flex items-center justify-center rounded-2xl 
                          bg-emerald-600 px-6 py-3 text-base font-semibold text-white
                          shadow-[0_6px_16px_rgba(16,185,129,0.35)]
                          transition-all duration-300 ease-out
                          hover:bg-emerald-700 hover:shadow-[0_8px_20px_rgba(16,185,129,0.45)]
                          hover:scale-[1.05] active:scale-[.97]
                          disabled:opacity-60 disabled:cursor-not-allowed cursor-pointer"
                aria-busy={submitting ? "true" : "false"}
              >
                {submitting ? "กำลังบันทึก..." : "บันทึกการสมัครสมาชิก"}
              </button>

              <button
                type="button"
                onClick={handleReset}
                className="inline-flex items-center justify-center rounded-2xl 
                          border border-slate-300 bg-white px-6 py-3 text-base font-medium text-slate-700 
                          shadow-sm
                          transition-all duration-300 ease-out
                          hover:bg-slate-100 hover:shadow-md hover:scale-[1.03]
                          active:scale-[.97]
                          dark:border-slate-600 dark:bg-slate-700/60 dark:text-white 
                          dark:hover:bg-slate-700/50 dark:hover:shadow-lg cursor-pointer"
              >
                รีเซ็ต
              </button>
            </div>
          </SectionCard>
        </form>
      </div>
    </div>
  )
}

export default MemberSignup
