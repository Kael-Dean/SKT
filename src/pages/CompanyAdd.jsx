// src/pages/CompanyAdd.jsx
import { useEffect, useRef, useState } from "react"
import { apiAuth } from "../lib/api"

/** ---------- Utils ---------- */
const onlyDigits = (s = "") => s.replace(/\D+/g, "")
const cx = (...a) => a.filter(Boolean).join(" ")
const is13 = (s = "") => onlyDigits(s).length === 13
const toNull = (s) => {
  const v = (s ?? "").trim()
  return v === "" ? null : v
}
const isEnterKey = (e) =>
  e.key === "Enter" && !e.shiftKey && !e.altKey && !e.ctrlKey && !e.metaKey && !e.isComposing

/** ---------- Styles (เทียบให้ตรงกับ CustomerAdd) ---------- */
const baseField =
  "w-full rounded-2xl border border-slate-300 bg-slate-100 p-3 text-[15px] md:text-base " +
  "text-black outline-none placeholder:text-slate-500 focus:border-emerald-600 focus:ring-2 focus:ring-emerald-500/30 shadow-none " +
  "dark:border-slate-500 dark:bg-slate-700 dark:text-slate-100 dark:placeholder:text-slate-300 dark:focus:border-emerald-400 dark:focus:ring-emerald-400/30"

const fieldError = "border-red-500 ring-2 ring-red-300 focus:ring-0 focus:border-red-500"
const labelCls = "mb-1 block text-[15px] md:text-base font-medium text-slate-700 dark:text-slate-200"
const helpTextCls = "mt-1 text-sm text-slate-600 dark:text-slate-300"
const errorTextCls = "mt-1 text-sm text-red-500"

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

/** ---------- Component: CompanyAdd (with FormGuard + Enter navigation) ---------- */
const CompanyAdd = () => {
  const [errors, setErrors] = useState({})
  const [submitting, setSubmitting] = useState(false)

  // ---------- Refs ----------
  const refs = {
    company_name: useRef(null),
    tax_id: useRef(null),
    phone_number: useRef(null),

    hq_address: useRef(null),
    hq_moo: useRef(null),
    hq_tambon: useRef(null),
    hq_amphur: useRef(null),
    hq_province: useRef(null),
    hq_postal_code: useRef(null),

    branch_address: useRef(null),
    branch_moo: useRef(null),
    branch_tambon: useRef(null),
    branch_amphur: useRef(null),
    branch_province: useRef(null),
    branch_postal_code: useRef(null),

    submit_btn: useRef(null),
  }

  // ---------- Form state (ตรงกับ BE: CompanyCustomerCreate) ----------
  const [form, setForm] = useState({
    company_name: "",
    tax_id: "",
    phone_number: "",

    // HQ
    hq_address: "",
    hq_moo: "",
    hq_tambon: "",
    hq_amphur: "",
    hq_province: "",
    hq_postal_code: "",

    // Branch (optional)
    branch_address: "",
    branch_moo: "",
    branch_tambon: "",
    branch_amphur: "",
    branch_province: "",
    branch_postal_code: "",
  })

  const update = (k, v) => setForm((p) => ({ ...p, [k]: v }))
  const clearError = (k) =>
    setErrors((prev) => {
      if (!(k in prev)) return prev
      const { [k]: _omit, ...rest } = prev
      return rest
    })

  // ---------- FormGuard: per-field validators ----------
  const validateField = (k, val = form[k]) => {
    let msg = ""

    // ข้อกำหนดหลักคงเดิม: ชื่อบริษัท, tax_id 13 หลัก, และ HQ บังคับ (ยกเว้น moo/postal ที่ optional ตามเดิม)
    switch (k) {
      case "company_name":
        if (!(val ?? "").trim()) msg = "กรุณากรอกชื่อบริษัท / นิติบุคคล"
        break
      case "tax_id":
        if (!is13(val)) msg = "เลขผู้เสียภาษีต้องเป็นตัวเลข 13 หลัก"
        break
      case "hq_address":
        if (!(val ?? "").trim()) msg = "กรุณากรอกบ้านเลขที่/ที่อยู่ (HQ)"
        break
      case "hq_tambon":
        if (!(val ?? "").trim()) msg = "กรุณากรอกตำบล (HQ)"
        break
      case "hq_amphur":
        if (!(val ?? "").trim()) msg = "กรุณากรอกอำเภอ (HQ)"
        break
      case "hq_province":
        if (!(val ?? "").trim()) msg = "กรุณากรอกจังหวัด (HQ)"
        break
      case "hq_postal_code":
        if (val && onlyDigits(val).length !== 5) msg = "รหัสไปรษณีย์ (HQ) ต้องมี 5 หลัก"
        break
      case "branch_postal_code":
        if (val && onlyDigits(val).length !== 5) msg = "รหัสไปรษณีย์ (สาขา) ต้องมี 5 หลัก"
        break
      default:
        msg = ""
    }

    setErrors((prev) => {
      const next = { ...prev }
      if (msg) next[k] = msg
      else delete next[k]
      return next
    })

    return !msg
  }

  const validateAll = () => {
    const keys = [
      "company_name",
      "tax_id",
      "hq_address",
      "hq_tambon",
      "hq_amphur",
      "hq_province",
      "hq_postal_code",
      "branch_postal_code",
    ]
    const results = keys.map((k) => validateField(k))
    return results.every(Boolean)
  }

  // ---------- Enter-to-next order (ตามที่ผู้ใช้กำหนด) ----------
  // หมายเหตุ: ผู้ใช้ไม่ได้ใส่ tax_id ในลำดับ Enter จึงปล่อยให้กรอกเองตามสะดวก
  // แต่ formguard ยังตรวจตอน blur/submit ให้ครบตามกฎเดิม
  const enterOrder = [
    "company_name",
    "phone_number",
    "hq_address",
    "hq_moo",
    "hq_tambon",
    "hq_amphur",
    "hq_province",
    "hq_postal_code",
    "branch_address",
    "branch_moo",
    "branch_tambon",
    "branch_amphur",
    "branch_province",
    "branch_postal_code",
    "submit_btn",
  ]

  const requiredInEnter = new Set([
    "company_name",
    "hq_address",
    "hq_tambon",
    "hq_amphur",
    "hq_province",
    // postal code HQ optional ถ้าไม่กรอกจะไม่บล็อก Enter แต่ถ้ากรอกต้องครบ 5 หลัก -> จะ guard ถ้าใส่ไม่ครบ
    // branch_* ทั้งหมด optional; ถ้าใส่ branch_postal_code ต้องครบ 5 หลัก -> guard
  ])

  const guardIfNeededAndNext = (currentKey) => {
    // ตรวจช่องปัจจุบันก่อนเลื่อน
    if (requiredInEnter.has(currentKey)) {
      const ok = validateField(currentKey)
      if (!ok) {
        const el = refs[currentKey]?.current
        if (el) {
          el.focus()
          el.select?.()
        }
        return
      }
    }
    // rule สำหรับ postal code: ถ้าพิมพ์แล้ว ต้องครบ 5
    if (currentKey === "hq_postal_code" && form.hq_postal_code) {
      if (!validateField("hq_postal_code")) return
    }
    if (currentKey === "branch_postal_code" && form.branch_postal_code) {
      if (!validateField("branch_postal_code")) return
    }

    // ไปตัวถัดไป
    const idx = enterOrder.indexOf(currentKey)
    const nextKey = idx >= 0 ? enterOrder[Math.min(idx + 1, enterOrder.length - 1)] : null
    if (!nextKey) return

    if (nextKey === "submit_btn") {
      // โฟกัสปุ่ม ถ้ากด Enter ที่ปุ่มก็จะ submit ฟอร์มตามปกติ
      refs.submit_btn.current?.focus()
      return
    }

    const el = refs[nextKey]?.current
    if (el) {
      try {
        el.scrollIntoView({ behavior: "smooth", block: "center" })
      } catch {}
      el.focus()
      el.select?.()
    }
  }

  const onEnter = (key) => (e) => {
    if (!isEnterKey(e)) return
    e.preventDefault()
    guardIfNeededAndNext(key)
  }

  // ---------- Auto-focus ไป error ตัวแรกหลัง validate/setErrors ----------
  useEffect(() => {
    if (!Object.keys(errors).length) return
    const order = [
      "company_name",
      "tax_id",
      "phone_number",
      "hq_address",
      "hq_moo",
      "hq_tambon",
      "hq_amphur",
      "hq_province",
      "hq_postal_code",
      "branch_address",
      "branch_moo",
      "branch_tambon",
      "branch_amphur",
      "branch_province",
      "branch_postal_code",
    ]
    const first = order.find((k) => k in errors)
    const el = first ? refs[first]?.current : null
    if (el && el.focus) {
      try {
        el.scrollIntoView({ behavior: "smooth", block: "center" })
      } catch {}
      el.focus()
      el.select?.()
    }
  }, [errors]) // eslint-disable-line react-hooks/exhaustive-deps

  // ---------- Submit ----------
  const handleSubmit = async (ev) => {
    ev.preventDefault()
    // ตรวจทั้งฟอร์มก่อน
    if (!validateAll()) {
      alert("บันทึกไม่สำเร็จ กรุณากรอกข้อมูลที่จำเป็นให้ครบถ้วนและถูกต้อง")
      return
    }
    setSubmitting(true)

    // map -> CompanyCustomerCreate (ตรงชื่อฟิลด์)
    const payload = {
      company_name: form.company_name.trim(),
      tax_id: onlyDigits(form.tax_id),
      phone_number: toNull(form.phone_number),

      hq_address: toNull(form.hq_address),
      hq_moo: toNull(form.hq_moo),
      hq_tambon: toNull(form.hq_tambon),
      hq_amphur: toNull(form.hq_amphur),
      hq_province: toNull(form.hq_province),
      hq_postal_code: form.hq_postal_code ? onlyDigits(form.hq_postal_code) : null, // ส่งเป็นสตริง

      branch_address: toNull(form.branch_address),
      branch_moo: toNull(form.branch_moo),
      branch_tambon: toNull(form.branch_tambon),
      branch_amphur: toNull(form.branch_amphur),
      branch_province: toNull(form.branch_province),
      branch_postal_code: form.branch_postal_code ? onlyDigits(form.branch_postal_code) : null, // ส่งเป็นสตริง
    }

    try {
      await apiAuth("/member/customers/company-signup", { method: "POST", body: payload })
      alert("บันทึกข้อมูลบริษัทเรียบร้อย ✅")
      handleReset()
      // กลับไปโฟกัสช่องแรกเพื่อสะดวกเริ่มรายการถัดไป
      refs.company_name.current?.focus()
    } catch (err) {
      console.error(err)
      const msg =
        (err && err.detail) ||
        (typeof err?.message === "string" ? err.message : "") ||
        "บันทึกล้มเหลว กรุณาลองใหม่"
      alert(msg)
    } finally {
      setSubmitting(false)
    }
  }

  const handleReset = () => {
    setErrors({})
    setForm({
      company_name: "",
      tax_id: "",
      phone_number: "",

      hq_address: "",
      hq_moo: "",
      hq_tambon: "",
      hq_amphur: "",
      hq_province: "",
      hq_postal_code: "",

      branch_address: "",
      branch_moo: "",
      branch_tambon: "",
      branch_amphur: "",
      branch_province: "",
      branch_postal_code: "",
    })
  }

  /** ---------- UI ---------- */
  return (
    <div className="min-h-screen bg-white text-black dark:bg-slate-900 dark:text-white rounded-2xl text-[15px] md:text-base">
      <div className="mx-auto max-w-7xl p-5 md:p-6 lg:p-8">
        <h1 className="mb-1 text-3xl font-bold text-gray-900 dark:text-white">🏢 เพิ่มบริษัท / นิติบุคคล</h1>

        <form onSubmit={handleSubmit}>
          <SectionCard title="ข้อมูลบริษัท">
            {/* แถวบนสุด: ชื่อบริษัท / เลขผู้เสียภาษี */}
            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <label className={labelCls}>ชื่อบริษัท / นิติบุคคล</label>
                <input
                  ref={refs.company_name}
                  className={cx(baseField, errors.company_name && fieldError)}
                  value={form.company_name}
                  onChange={(e) => {
                    clearError("company_name")
                    update("company_name", e.target.value)
                  }}
                  onFocus={() => clearError("company_name")}
                  onBlur={() => validateField("company_name")}
                  onKeyDown={onEnter("company_name")}
                  placeholder="เช่น บริษัท ตัวอย่าง จำกัด"
                  aria-invalid={errors.company_name ? true : undefined}
                />
                {errors.company_name && <p className={errorTextCls}>{errors.company_name}</p>}
              </div>

              <div>
                <label className={labelCls}>เลขที่ผู้เสียภาษี (13 หลัก)</label>
                <input
                  ref={refs.tax_id}
                  inputMode="numeric"
                  maxLength={13}
                  className={cx(baseField, errors.tax_id && fieldError)}
                  value={form.tax_id}
                  onChange={(e) => {
                    clearError("tax_id")
                    update("tax_id", onlyDigits(e.target.value))
                  }}
                  onFocus={() => clearError("tax_id")}
                  onBlur={() => validateField("tax_id")}
                  // ไม่ใส่ onKeyDown เพื่อไม่รบกวนลำดับ Enter ตามที่ผู้ใช้กำหนด
                  placeholder="เช่น 0123456789012"
                  aria-invalid={errors.tax_id ? true : undefined}
                />
                {errors.tax_id && <p className={errorTextCls}>{errors.tax_id}</p>}
                <p className={helpTextCls}>ใช้สำหรับออกเอกสารภาษี</p>
              </div>
            </div>

            {/* เบอร์โทรบริษัท (ไม่บังคับ) */}
            <div className="mt-4 grid gap-4 md:grid-cols-3">
              <div>
                <label className={labelCls}>เบอร์โทรบริษัท (ไม่บังคับ)</label>
                <input
                  ref={refs.phone_number}
                  inputMode="tel"
                  className={baseField}
                  value={form.phone_number}
                  onChange={(e) => update("phone_number", e.target.value)}
                  onKeyDown={onEnter("phone_number")}
                  placeholder="เช่น 021234567"
                />
              </div>
            </div>

            {/* HQ */}
            <div className="mt-6">
              <div className="mb-2 flex items-center gap-2">
                <span className="h-2 w-2 rounded-full bg-blue-500" />
                <span className="font-semibold">ที่อยู่สำนักงานใหญ่ (HQ)</span>
              </div>

              <div className="grid gap-4 md:grid-cols-3">
                <div>
                  <label className={labelCls}>บ้านเลขที่ / ที่อยู่ (HQ)</label>
                  <input
                    ref={refs.hq_address}
                    className={cx(baseField, errors.hq_address && fieldError)}
                    value={form.hq_address}
                    onChange={(e) => {
                      clearError("hq_address")
                      update("hq_address", e.target.value)
                    }}
                    onFocus={() => clearError("hq_address")}
                    onBlur={() => validateField("hq_address")}
                    onKeyDown={onEnter("hq_address")}
                    placeholder="เช่น 99/1 หมู่บ้านตัวอย่าง"
                    aria-invalid={errors.hq_address ? true : undefined}
                  />
                  {errors.hq_address && <p className={errorTextCls}>{errors.hq_address}</p>}
                </div>

                <div>
                  <label className={labelCls}>หมู่ (HQ)</label>
                  <input
                    ref={refs.hq_moo}
                    className={baseField}
                    value={form.hq_moo}
                    onChange={(e) => update("hq_moo", e.target.value)}
                    onKeyDown={onEnter("hq_moo")}
                    placeholder="เช่น 4"
                  />
                </div>

                <div>
                  <label className={labelCls}>ตำบล (HQ)</label>
                  <input
                    ref={refs.hq_tambon}
                    className={cx(baseField, errors.hq_tambon && fieldError)}
                    value={form.hq_tambon}
                    onChange={(e) => {
                      clearError("hq_tambon")
                      update("hq_tambon", e.target.value)
                    }}
                    onFocus={() => clearError("hq_tambon")}
                    onBlur={() => validateField("hq_tambon")}
                    onKeyDown={onEnter("hq_tambon")}
                    placeholder="เช่น หนองปลาไหล"
                    aria-invalid={errors.hq_tambon ? true : undefined}
                  />
                  {errors.hq_tambon && <p className={errorTextCls}>{errors.hq_tambon}</p>}
                </div>

                <div>
                  <label className={labelCls}>อำเภอ (HQ)</label>
                  <input
                    ref={refs.hq_amphur}
                    className={cx(baseField, errors.hq_amphur && fieldError)}
                    value={form.hq_amphur}
                    onChange={(e) => {
                      clearError("hq_amphur")
                      update("hq_amphur", e.target.value)
                    }}
                    onFocus={() => clearError("hq_amphur")}
                    onBlur={() => validateField("hq_amphur")}
                    onKeyDown={onEnter("hq_amphur")}
                    placeholder="เช่น เมือง"
                    aria-invalid={errors.hq_amphur ? true : undefined}
                  />
                  {errors.hq_amphur && <p className={errorTextCls}>{errors.hq_amphur}</p>}
                </div>

                <div>
                  <label className={labelCls}>จังหวัด (HQ)</label>
                  <input
                    ref={refs.hq_province}
                    className={cx(baseField, errors.hq_province && fieldError)}
                    value={form.hq_province}
                    onChange={(e) => {
                      clearError("hq_province")
                      update("hq_province", e.target.value)
                    }}
                    onFocus={() => clearError("hq_province")}
                    onBlur={() => validateField("hq_province")}
                    onKeyDown={onEnter("hq_province")}
                    placeholder="เช่น ขอนแก่น"
                    aria-invalid={errors.hq_province ? true : undefined}
                  />
                  {errors.hq_province && <p className={errorTextCls}>{errors.hq_province}</p>}
                </div>

                <div>
                  <label className={labelCls}>รหัสไปรษณีย์ (HQ)</label>
                  <input
                    ref={refs.hq_postal_code}
                    inputMode="numeric"
                    maxLength={5}
                    className={cx(baseField, errors.hq_postal_code && fieldError)}
                    value={form.hq_postal_code}
                    onChange={(e) => {
                      clearError("hq_postal_code")
                      update("hq_postal_code", onlyDigits(e.target.value))
                    }}
                    onFocus={() => clearError("hq_postal_code")}
                    onBlur={() => validateField("hq_postal_code")}
                    onKeyDown={onEnter("hq_postal_code")}
                    placeholder="เช่น 10110"
                    aria-invalid={errors.hq_postal_code ? true : undefined}
                  />
                  {errors.hq_postal_code && <p className={errorTextCls}>{errors.hq_postal_code}</p>}
                </div>
              </div>
            </div>

            {/* Branch (optional) */}
            <div className="mt-8">
              <div className="mb-2 flex items-center gap-2">
                <span className="h-2 w-2 rounded-full bg-blue-500" />
                <span className="font-semibold">ที่อยู่สำนักงานสาขา (ถ้ามี)</span>
              </div>

              <div className="grid gap-4 md:grid-cols-3">
                <div>
                  <label className={labelCls}>บ้านเลขที่ / ที่อยู่ (สาขา)</label>
                  <input
                    ref={refs.branch_address}
                    className={baseField}
                    value={form.branch_address}
                    onChange={(e) => update("branch_address", e.target.value)}
                    onKeyDown={onEnter("branch_address")}
                    placeholder="เช่น 10/2 หมู่บ้านตัวอย่าง"
                  />
                </div>

                <div>
                  <label className={labelCls}>หมู่ (สาขา)</label>
                  <input
                    ref={refs.branch_moo}
                    className={baseField}
                    value={form.branch_moo}
                    onChange={(e) => update("branch_moo", e.target.value)}
                    onKeyDown={onEnter("branch_moo")}
                    placeholder="เช่น 5"
                  />
                </div>

                <div>
                  <label className={labelCls}>ตำบล (สาขา)</label>
                  <input
                    ref={refs.branch_tambon}
                    className={baseField}
                    value={form.branch_tambon}
                    onChange={(e) => update("branch_tambon", e.target.value)}
                    onKeyDown={onEnter("branch_tambon")}
                    placeholder="เช่น บึงเนียม"
                  />
                </div>

                <div>
                  <label className={labelCls}>อำเภอ (สาขา)</label>
                  <input
                    ref={refs.branch_amphur}
                    className={baseField}
                    value={form.branch_amphur}
                    onChange={(e) => update("branch_amphur", e.target.value)}
                    onKeyDown={onEnter("branch_amphur")}
                    placeholder="เช่น เมือง"
                  />
                </div>

                <div>
                  <label className={labelCls}>จังหวัด (สาขา)</label>
                  <input
                    ref={refs.branch_province}
                    className={baseField}
                    value={form.branch_province}
                    onChange={(e) => update("branch_province", e.target.value)}
                    onKeyDown={onEnter("branch_province")}
                    placeholder="เช่น ขอนแก่น"
                  />
                </div>

                <div>
                  <label className={labelCls}>รหัสไปรษณีย์ (สาขา)</label>
                  <input
                    ref={refs.branch_postal_code}
                    inputMode="numeric"
                    maxLength={5}
                    className={cx(baseField, errors.branch_postal_code && fieldError)}
                    value={form.branch_postal_code}
                    onChange={(e) => {
                      clearError("branch_postal_code")
                      update("branch_postal_code", onlyDigits(e.target.value))
                    }}
                    onFocus={() => clearError("branch_postal_code")}
                    onBlur={() => validateField("branch_postal_code")}
                    onKeyDown={onEnter("branch_postal_code")}
                    placeholder="เช่น 10220"
                    aria-invalid={errors.branch_postal_code ? true : undefined}
                  />
                  {errors.branch_postal_code && <p className={errorTextCls}>{errors.branch_postal_code}</p>}
                </div>
              </div>
            </div>

            {/* ปุ่ม */}
            <div className="mt-6 flex flex-col gap-3 sm:flex-row">
              <button
                ref={refs.submit_btn}
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
                onKeyDown={(e) => {
                  if (isEnterKey(e)) {
                    // ให้ปุ่มทำงาน submit ตามปกติ
                  }
                }}
              >
                {submitting ? "กำลังบันทึก..." : "บันทึกข้อมูลบริษัท"}
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

export default CompanyAdd
