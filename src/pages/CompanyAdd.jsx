// src/pages/CompanyAdd.jsx
import { useEffect, useRef, useState } from "react"
import { apiAuth } from "../lib/api"

/** ---------- Utils ---------- */
const onlyDigits = (s = "") => s.replace(/\D+/g, "")
const cx = (...a) => a.filter(Boolean).join(" ")
const is13 = (s = "") => onlyDigits(s).length === 13

/** ---------- Styles (เหมือน CustomerAdd) ---------- */
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

/** ---------- Component ---------- */
const CompanyAdd = () => {
  const [errors, setErrors] = useState({})
  const [submitting, setSubmitting] = useState(false)

  const refs = {
    company_name: useRef(null),
    tax_id: useRef(null),
    company_phone: useRef(null),

    hq_house_no: useRef(null),
    hq_moo: useRef(null),
    hq_subdistrict: useRef(null),
    hq_district: useRef(null),
    hq_province: useRef(null),
    hq_postal: useRef(null),

    br_house_no: useRef(null),
    br_moo: useRef(null),
    br_subdistrict: useRef(null),
    br_district: useRef(null),
    br_province: useRef(null),
    br_postal: useRef(null),
  }

  const [form, setForm] = useState({
    company_name: "",
    tax_id: "",
    company_phone: "",

    // HQ
    hq_house_no: "",
    hq_moo: "",
    hq_subdistrict: "",
    hq_district: "",
    hq_province: "",
    hq_postal: "",

    // Branch (optional)
    br_house_no: "",
    br_moo: "",
    br_subdistrict: "",
    br_district: "",
    br_province: "",
    br_postal: "",
  })

  const update = (k, v) => setForm((p) => ({ ...p, [k]: v }))
  const clearError = (k) =>
    setErrors((prev) => {
      if (!(k in prev)) return prev
      const { [k]: _omit, ...rest } = prev
      return rest
    })

  /** ---------- Validate ---------- */
  const validateAll = () => {
    const e = {}
    if (!form.company_name.trim()) e.company_name = "กรุณากรอกชื่อบริษัท / นิติบุคคล"
    if (!is13(form.tax_id)) e.tax_id = "เลขผู้เสียภาษีต้องเป็นตัวเลข 13 หลัก"

    // HQ required
    if (!form.hq_house_no.trim()) e.hq_house_no = "กรุณากรอกบ้านเลขที่ (HQ)"
    if (!form.hq_subdistrict.trim()) e.hq_subdistrict = "กรุณากรอกตำบล (HQ)"
    if (!form.hq_district.trim()) e.hq_district = "กรุณากรอกอำเภอ (HQ)"
    if (!form.hq_province.trim()) e.hq_province = "กรุณากรอกจังหวัด (HQ)"
    if (form.hq_postal && onlyDigits(form.hq_postal).length !== 5) e.hq_postal = "รหัสไปรษณีย์ต้องมี 5 หลัก"

    // Branch optional but if provided postal must be 5 digits
    if (form.br_postal && onlyDigits(form.br_postal).length !== 5) e.br_postal = "รหัสไปรษณีย์ต้องมี 5 หลัก"

    setErrors(e)
    return Object.keys(e).length === 0
  }

  useEffect(() => {
    if (!Object.keys(errors).length) return
    const order = [
      "company_name",
      "tax_id",
      "company_phone",
      "hq_house_no",
      "hq_moo",
      "hq_subdistrict",
      "hq_district",
      "hq_province",
      "hq_postal",
      "br_house_no",
      "br_moo",
      "br_subdistrict",
      "br_district",
      "br_province",
      "br_postal",
    ]
    const first = order.find((k) => k in errors)
    const el = first ? refs[first]?.current : null
    if (el && el.focus) {
      try {
        el.scrollIntoView({ behavior: "smooth", block: "center" })
      } catch {}
      el.focus()
    }
  }, [errors]) // eslint-disable-line react-hooks/exhaustive-deps

  /** ---------- Submit ---------- */
  const handleSubmit = async (ev) => {
    ev.preventDefault()
    if (!validateAll()) return
    setSubmitting(true)

    const payload = {
      type: "company",
      company_name: form.company_name.trim(),
      tax_id: onlyDigits(form.tax_id),
      company_phone: form.company_phone.trim(),

      hq: {
        house_no: form.hq_house_no.trim(),
        moo: form.hq_moo.trim(),
        subdistrict: form.hq_subdistrict.trim(),
        district: form.hq_district.trim(),
        province: form.hq_province.trim(),
        postal_code: form.hq_postal ? Number(onlyDigits(form.hq_postal)) : 0,
      },
      branch: {
        house_no: form.br_house_no.trim(),
        moo: form.br_moo.trim(),
        subdistrict: form.br_subdistrict.trim(),
        district: form.br_district.trim(),
        province: form.br_province.trim(),
        postal_code: form.br_postal ? Number(onlyDigits(form.br_postal)) : 0,
      },
    }

    try {
      await apiAuth("/order/companies/save", { method: "POST", body: payload })
      alert("บันทึกข้อมูลบริษัทเรียบร้อย ✅")
      handleReset()
    } catch (err) {
      console.error(err)
      alert("บันทึกล้มเหลว กรุณาลองใหม่")
    } finally {
      setSubmitting(false)
    }
  }

  const handleReset = () => {
    setErrors({})
    setForm({
      company_name: "",
      tax_id: "",
      company_phone: "",
      hq_house_no: "",
      hq_moo: "",
      hq_subdistrict: "",
      hq_district: "",
      hq_province: "",
      hq_postal: "",
      br_house_no: "",
      br_moo: "",
      br_subdistrict: "",
      br_district: "",
      br_province: "",
      br_postal: "",
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
                  placeholder="เช่น 0123456789012"
                  aria-invalid={errors.tax_id ? true : undefined}
                />
                {errors.tax_id && <p className={errorTextCls}>{errors.tax_id}</p>}
                <p className={helpTextCls}>ใช้สำหรับออกเอกสารภาษี</p>
              </div>
            </div>

            {/* เบอร์โทรบริษัท (ทำให้กว้างเท่ากับ “บ้านเลขที่” คือ 1 ใน 3 คอลัมน์) */}
            <div className="mt-4 grid gap-4 md:grid-cols-3">
              <div>
                <label className={labelCls}>เบอร์โทรบริษัท (ไม่บังคับ)</label>
                <input
                  ref={refs.company_phone}
                  inputMode="tel"
                  className={baseField}
                  value={form.company_phone}
                  onChange={(e) => update("company_phone", e.target.value)}
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
                  <label className={labelCls}>บ้านเลขที่</label>
                  <input
                    ref={refs.hq_house_no}
                    className={cx(baseField, errors.hq_house_no && fieldError)}
                    value={form.hq_house_no}
                    onChange={(e) => {
                      clearError("hq_house_no")
                      update("hq_house_no", e.target.value)
                    }}
                    onFocus={() => clearError("hq_house_no")}
                    placeholder="เช่น 99/1"
                    aria-invalid={errors.hq_house_no ? true : undefined}
                  />
                  {errors.hq_house_no && <p className={errorTextCls}>{errors.hq_house_no}</p>}
                </div>

                <div>
                  <label className={labelCls}>หมู่</label>
                  <input
                    ref={refs.hq_moo}
                    className={baseField}
                    value={form.hq_moo}
                    onChange={(e) => update("hq_moo", e.target.value)}
                    placeholder="เช่น 4"
                  />
                </div>

                <div>
                  <label className={labelCls}>ตำบล</label>
                  <input
                    ref={refs.hq_subdistrict}
                    className={cx(baseField, errors.hq_subdistrict && fieldError)}
                    value={form.hq_subdistrict}
                    onChange={(e) => {
                      clearError("hq_subdistrict")
                      update("hq_subdistrict", e.target.value)
                    }}
                    onFocus={() => clearError("hq_subdistrict")}
                    placeholder="เช่น หนองปลาไหล"
                    aria-invalid={errors.hq_subdistrict ? true : undefined}
                  />
                  {errors.hq_subdistrict && <p className={errorTextCls}>{errors.hq_subdistrict}</p>}
                </div>

                <div>
                  <label className={labelCls}>อำเภอ</label>
                  <input
                    ref={refs.hq_district}
                    className={cx(baseField, errors.hq_district && fieldError)}
                    value={form.hq_district}
                    onChange={(e) => {
                      clearError("hq_district")
                      update("hq_district", e.target.value)
                    }}
                    onFocus={() => clearError("hq_district")}
                    placeholder="เช่น เมือง"
                    aria-invalid={errors.hq_district ? true : undefined}
                  />
                  {errors.hq_district && <p className={errorTextCls}>{errors.hq_district}</p>}
                </div>

                <div>
                  <label className={labelCls}>จังหวัด</label>
                  <input
                    ref={refs.hq_province}
                    className={cx(baseField, errors.hq_province && fieldError)}
                    value={form.hq_province}
                    onChange={(e) => {
                      clearError("hq_province")
                      update("hq_province", e.target.value)
                    }}
                    onFocus={() => clearError("hq_province")}
                    placeholder="เช่น ขอนแก่น"
                    aria-invalid={errors.hq_province ? true : undefined}
                  />
                  {errors.hq_province && <p className={errorTextCls}>{errors.hq_province}</p>}
                </div>

                <div>
                  <label className={labelCls}>รหัสไปรษณีย์ (HQ)</label>
                  <input
                    ref={refs.hq_postal}
                    inputMode="numeric"
                    maxLength={5}
                    className={cx(baseField, errors.hq_postal && fieldError)}
                    value={form.hq_postal}
                    onChange={(e) => {
                      clearError("hq_postal")
                      update("hq_postal", onlyDigits(e.target.value))
                    }}
                    onFocus={() => clearError("hq_postal")}
                    placeholder="เช่น 10110"
                    aria-invalid={errors.hq_postal ? true : undefined}
                  />
                  {errors.hq_postal && <p className={errorTextCls}>{errors.hq_postal}</p>}
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
                  <label className={labelCls}>บ้านเลขที่ (สาขา)</label>
                  <input
                    ref={refs.br_house_no}
                    className={baseField}
                    value={form.br_house_no}
                    onChange={(e) => update("br_house_no", e.target.value)}
                    placeholder="เช่น 10/2"
                  />
                </div>

                <div>
                  <label className={labelCls}>หมู่ (สาขา)</label>
                  <input
                    ref={refs.br_moo}
                    className={baseField}
                    value={form.br_moo}
                    onChange={(e) => update("br_moo", e.target.value)}
                    placeholder="เช่น 5"
                  />
                </div>

                <div>
                  <label className={labelCls}>ตำบล (สาขา)</label>
                  <input
                    ref={refs.br_subdistrict}
                    className={baseField}
                    value={form.br_subdistrict}
                    onChange={(e) => update("br_subdistrict", e.target.value)}
                    placeholder="เช่น บึงเนียม"
                  />
                </div>

                <div>
                  <label className={labelCls}>อำเภอ (สาขา)</label>
                  <input
                    ref={refs.br_district}
                    className={baseField}
                    value={form.br_district}
                    onChange={(e) => update("br_district", e.target.value)}
                    placeholder="เช่น เมือง"
                  />
                </div>

                <div>
                  <label className={labelCls}>จังหวัด (สาขา)</label>
                  <input
                    ref={refs.br_province}
                    className={baseField}
                    value={form.br_province}
                    onChange={(e) => update("br_province", e.target.value)}
                    placeholder="เช่น ขอนแก่น"
                  />
                </div>

                <div>
                  <label className={labelCls}>รหัสไปรษณีย์ (สาขา)</label>
                  <input
                    ref={refs.br_postal}
                    inputMode="numeric"
                    maxLength={5}
                    className={cx(baseField, errors.br_postal && fieldError)}
                    value={form.br_postal}
                    onChange={(e) => {
                      clearError("br_postal")
                      update("br_postal", onlyDigits(e.target.value))
                    }}
                    onFocus={() => clearError("br_postal")}
                    placeholder="เช่น 10220"
                    aria-invalid={errors.br_postal ? true : undefined}
                  />
                  {errors.br_postal && <p className={errorTextCls}>{errors.br_postal}</p>}
                </div>
              </div>
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
