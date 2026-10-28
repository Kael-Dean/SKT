// src/pages/CustomerAdd.jsx
import { useEffect, useMemo, useRef, useState } from "react"
import { apiAuth } from "../../lib/api"

// ✅ โหลดฐานข้อมูลที่อยู่ไทยแบบ fetch-on-demand (sub_district.json 2.2MB ไม่ถูกฝังใน bundle)
import { useThaiAddressData } from "../../hooks/useThaiAddressData"
import { cx, baseField, labelCls, errorTextCls, submitBtnCls, resetBtnCls, spinnerCls } from "../../lib/styles"
import { Card, CardHeader, PageLoader, ErrorState, toast } from "../../components/ui"
import ComboBox from "../../components/ComboBox"
import DateInput from "../../components/ThaiDateField"
import PageTitle from "../../components/PageTitle"

/* -------------------------- Utilities & helpers -------------------------- */
const onlyDigits = (s = "") => s.replace(/\D+/g, "")
/** แสดงข้อความจาก backend เฉพาะเมื่อเป็นภาษาไทยแล้ว ไม่งั้นใช้ข้อความกลาง */
const isThaiText = (s) => typeof s === "string" && /[฀-๿]/.test(s)

// แปลงชุดข้อมูลเป็น options ที่ ComboBox ใช้
const toOptions = (rows, labelKey, valueKey, extra = (r)=>({})) =>
  (rows || []).map((r, i) => {
    const label = String(r?.[labelKey] ?? r?.name ?? r?.label ?? r ?? "")
    const value = String(r?.[valueKey] ?? r?.id ?? label ?? i)
    return { label, value, ...extra(r) }
  })

/* ------------------------------- UI styles ------------------------------- */
const fieldError = "border-red-500 ring-2 ring-red-300 focus:ring-0 focus:border-red-500"


/* -------------------------------- DateInput ------------------------------- */
// ช่องวันที่ไทย (วัน เดือน พ.ศ.) ตัวกลาง — API เหมือน input เดิม (handoff F25)

/* -------------------------- Prefix/sex helpers --------------------------- */
const PREFIX_OPTIONS = [
  { value: "1", label: "นาย" },
  { value: "2", label: "นาง" },
  { value: "3", label: "นางสาว" },
]
const sexFromPrefix = (pre) => (pre === "1" ? "M" : pre === "2" || pre === "3" ? "F" : "")

/* ----------------------------- Main component ---------------------------- */
const CustomerAdd = () => {
  const [errors, setErrors] = useState({})
  const [submitting, setSubmitting] = useState(false)

  // FID relationship
  const [relOpts, setRelOpts] = useState([])
  const [relLoading, setRelLoading] = useState(false)

  // ตัวเลือก จังหวัด/อำเภอ/ตำบล
  const [provinceOptions, setProvinceOptions] = useState([]) // [{value,label,__id}]
  const [amphoeOptions, setAmphoeOptions] = useState([])
  const [tambonOptions, setTambonOptions] = useState([])

  // โหลดฐานข้อมูลที่อยู่แบบ fetch-on-demand — กันฟอร์มกระตุก + ไม่ฝัง 2.2MB ใน bundle
  const {
    provinces: PROVINCES_RAW,
    districts: DISTRICTS_RAW,
    subdistricts: SUBDISTRICTS_RAW,
    keys: addrKeys,
    ready: addressReady,
    error: addressError,
    reload: reloadAddress,
  } = useThaiAddressData()

  // เก็บ id ที่เลือกไว้ใช้กรองขั้นต่อไป
  const [selectedProvinceId, setSelectedProvinceId] = useState(null)
  const [selectedDistrictId, setSelectedDistrictId] = useState(null)

  // dataset keys ที่ตรวจจับได้ (มาจาก hook หลัง fetch เสร็จ)
  const PROV_K = addrKeys.prov
  const DIST_K = addrKeys.dist
  const SUBD_K = addrKeys.subd

  // refs
  const refs = {
    citizen_id: useRef(null),
    precode: useRef(null),
    full_name: useRef(null),
    address: useRef(null),
    mhoo: useRef(null),
    province: useRef(null),
    district: useRef(null),
    sub_district: useRef(null),
    postal_code: useRef(null),
    phone_number: useRef(null),
    fid: useRef(null),
    fid_owner: useRef(null),
    fid_relationship: useRef(null),
    sex: useRef(null),
  }
  const submitBtnRef = useRef(null)
  const topRef = useRef(null)

  const comboBtnRefs = {
    precode: useRef(null),
    province: useRef(null),
    district: useRef(null),
    sub_district: useRef(null),
    fid_relationship: useRef(null),
  }

  // form state
  const [form, setForm] = useState({
    slowdown_rice: false,
    citizen_id: "",
    precode: "",
    sex: "",
    full_name: "",
    address: "",
    mhoo: "",
    province: "",
    district: "",
    sub_district: "",
    postal_code: "",
    phone_number: "",
    fid: "",
    fid_owner: "",
    fid_relationship: "",
  })

  const update = (k, v) => { setForm((p) => ({ ...p, [k]: v })); clearError(k) }
  const clearError = (k) =>
    setErrors((prev) => {
      if (!(k in prev)) return prev
      const { [k]: _omit, ...rest } = prev
      return rest
    })

  /* ----------------------------- Enter order ----------------------------- */
  const enterOrder = [
    { key: "citizen_id", ref: refs.citizen_id },
    { key: "precode", ref: comboBtnRefs.precode },
    { key: "full_name", ref: refs.full_name },
    { key: "address", ref: refs.address },
    { key: "mhoo", ref: refs.mhoo },
    { key: "province", ref: comboBtnRefs.province },     // ← ย้ายจังหวัดมาก่อน
    { key: "district", ref: comboBtnRefs.district },
    { key: "sub_district", ref: comboBtnRefs.sub_district },
    { key: "postal_code", ref: refs.postal_code },
    { key: "phone_number", ref: refs.phone_number },
    { key: "fid", ref: refs.fid },
    { key: "fid_owner", ref: refs.fid_owner },
    { key: "fid_relationship", ref: comboBtnRefs.fid_relationship },
    { key: "submit", ref: submitBtnRef },
  ]
  const focusNextFromIndex = (idx) => {
    for (let i = idx + 1; i < enterOrder.length; i++) {
      const el = enterOrder[i]?.ref?.current
      if (!el) continue
      if (typeof el.disabled !== "undefined" && el.disabled) continue
      try {
        el.focus()
        try { el.scrollIntoView({ behavior: "smooth", block: "center" }) } catch {}
        if (el?.dataset?.comboboxBtn === "true") {
          requestAnimationFrame(() => { el.click?.() })
        }
      } catch {}
      break
    }
  }
  const bindEnter = (idx) => ({
    onKeyDown: (e) => { if (e.key === "Enter") { e.preventDefault(); focusNextFromIndex(idx) } }
  })

  const scrollToPageTop = () => {
    try { topRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }) } catch {}
    const root = document.scrollingElement || document.documentElement || document.body
    try { root.scrollTo({ top: 0, behavior: "smooth" }) } catch { root.scrollTop = 0 }
  }
  const scrollToFirstError = (eObj = {}) => {
    const keyOrder = enterOrder.map((o) => o.key)
    const firstKey = keyOrder.find((k) => eObj[k])
    if (firstKey) {
      const el = enterOrder.find((o) => o.key === firstKey)?.ref?.current
      if (el && typeof el.focus === "function") {
        try { el.scrollIntoView({ behavior: "smooth", block: "center" }) } catch {}
        el.focus()
      }
      return
    }
    scrollToPageTop()
  }

  /* --------------------------- Load relationships --------------------------- */
  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        setRelLoading(true)
        const rows = await apiAuth(`/member/members/fid_relationship`)
        if (!cancelled && Array.isArray(rows)) setRelOpts(rows)
      } catch { }
      finally { if (!cancelled) setRelLoading(false) }
    })()
    return () => { cancelled = true }
  }, [])

  /* ---------------------- Build province/district data ---------------------- */
  useEffect(() => {
    if (!addressReady) return
    // provinces
    const provOpts = toOptions(
      PROVINCES_RAW,
      PROV_K.name || "name",
      PROV_K.name || "name",     // เก็บ value = ชื่อ จัดเก็บใน form.province
      (r) => ({ __id: String(r?.[PROV_K.id] ?? r?.id ?? r?.code ?? "") })
    )
    provOpts.sort((a, b) => a.label.localeCompare(b.label, "th"))
    setProvinceOptions(provOpts)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [addressReady, PROVINCES_RAW])

  const reloadDistricts = (provinceId) => {
    if (!provinceId) { setAmphoeOptions([]); return }
    const rows = (DISTRICTS_RAW || []).filter((r) => String(r?.[DIST_K.provId]) === String(provinceId))
    const opts = toOptions(
      rows,
      DIST_K.name || "name",
      DIST_K.name || "name",      // value = ชื่อ (เก็บใน form.district)
      (r) => ({ __id: String(r?.[DIST_K.id]) })
    ).sort((a,b) => a.label.localeCompare(b.label, "th"))
    setAmphoeOptions(opts)
  }

  const reloadSubdistricts = (districtId) => {
    if (!districtId) { setTambonOptions([]); return }
    const rows = (SUBDISTRICTS_RAW || []).filter((r) => String(r?.[SUBD_K.distId]) === String(districtId))
    const opts = toOptions(
      rows,
      SUBD_K.name || "name",
      SUBD_K.name || "name",    // value = ชื่อ (เก็บใน form.sub_district)
      (r) => ({ __zip: r?.[SUBD_K.zip] ?? null })
    ).sort((a,b) => a.label.localeCompare(b.label, "th"))
    setTambonOptions(opts)
  }

  // เมื่อเลือกจังหวัด → ล้างอำเภอ/ตำบล และโหลดอำเภอ
  useEffect(() => {
    update("district",""); setSelectedDistrictId(null)
    update("sub_district",""); setTambonOptions([])
    reloadDistricts(selectedProvinceId)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedProvinceId])

  // เมื่อเลือกอำเภอ → ล้างตำบล และโหลดตำบล
  useEffect(() => {
    update("sub_district","")
    reloadSubdistricts(selectedDistrictId)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedDistrictId])

  /* ------------------------------- Validate ------------------------------- */
  const validateAll = () => {
    const e = {}
    const cid = onlyDigits(form.citizen_id)
    // ไม่บังคับกรอก — ถ้ากรอกต้องครบ 13 หลัก
    if (cid.length > 0 && cid.length !== 13) e.citizen_id = "เลขบัตรประชาชนต้องครบ 13 หลัก (หรือเว้นว่างไว้)"

    if (!form.precode) e.precode = "กรุณาเลือกคำนำหน้า"
    if (!form.full_name.trim()) e.full_name = "กรุณากรอกชื่อ–สกุล"
    if (!form.address.trim()) e.address = "กรุณากรอกบ้านเลขที่"
    if (!form.province) e.province = "กรุณาเลือกจังหวัด"
    if (!form.district) e.district = "กรุณาเลือกอำเภอ"
    if (!form.sub_district) e.sub_district = "กรุณาเลือกตำบล"

    if (form.postal_code !== "" && isNaN(Number(form.postal_code))) e.postal_code = "ต้องเป็นตัวเลข"
    setErrors(e)
    return e
  }

  const handleSubmit = async (ev) => {
    ev.preventDefault()
    scrollToPageTop()
    const eObj = validateAll()
    if (Object.keys(eObj).length > 0) {
      toast.error("กรอกไม่ครบ", { description: "ตรวจช่องที่มีกรอบสีแดง" })
      scrollToFirstError(eObj)
      return
    }

    setSubmitting(true)
    const splitName = (full = "") => {
      const parts = full.trim().split(/\s+/).filter(Boolean)
      if (parts.length === 0) return { first_name: "", last_name: "" }
      if (parts.length === 1) return { first_name: parts[0], last_name: "" }
      return { first_name: parts[0], last_name: parts.slice(1).join(" ") }
    }
    const { first_name, last_name } = splitName(form.full_name)

    const payload = {
      first_name,
      last_name,
      citizen_id: onlyDigits(form.citizen_id) || null,
      precode: form.precode !== "" ? Number(form.precode) : null,
      sex: form.sex || null,

      address: form.address.trim(),
      mhoo: (form.mhoo ?? "").toString().trim() || "",
      sub_district: form.sub_district.trim(),
      district: form.district.trim(),
      province: form.province.trim(),
      postal_code: form.postal_code !== "" ? Number(form.postal_code) : null,
      phone_number: form.phone_number.trim() || null,
      fid: form.fid !== "" ? String(form.fid).trim() : null,
      fid_owner: form.fid_owner.trim() || null,
      fid_relationship: form.fid_relationship !== "" ? Number(form.fid_relationship) : null,
    }

    try {
      await apiAuth(`/member/customers/signup`, { method: "POST", body: payload })
      toast.success("บันทึกลูกค้าทั่วไปแล้ว")
      handleReset()
      requestAnimationFrame(() => scrollToPageTop())
      try { submitBtnRef.current?.blur?.() } catch {}
    } catch (err) {
      console.error(err)
      const msg =
        (isThaiText(err?.detail) && err.detail) ||
        (isThaiText(err?.message) && err.message) ||
        "ข้อมูลที่กรอกยังอยู่ ลองบันทึกใหม่อีกครั้ง"
      toast.error("บันทึกไม่สำเร็จ", { description: msg })
    } finally {
      setSubmitting(false)
    }
  }

  const handleReset = () => {
    setErrors({})
    setForm({
      slowdown_rice: false,
      citizen_id: "",
      precode: "",
      sex: "",
      full_name: "",
      address: "",
      mhoo: "",
      province: "",
      district: "",
      sub_district: "",
      postal_code: "",
      phone_number: "",
      fid: "",
      fid_owner: "",
      fid_relationship: "",
    })
    setSelectedProvinceId(null)
    setSelectedDistrictId(null)
    setAmphoeOptions([])
    setTambonOptions([])
    requestAnimationFrame(() => {
      try { topRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }) } catch {}
    })
  }

  const fidRelOptions = useMemo(
    () => relOpts.map((r) => ({ value: String(r.id), label: String(r.fid_relationship) })),
    [relOpts]
  )

  /* ---------------------------------- UI ---------------------------------- */
  return (
    <div className="min-h-screen bg-white text-black dark:bg-slate-900 dark:text-white rounded-2xl text-[15px] md:text-base">
      <div className="w-full p-5 md:p-6 lg:p-8">
        <PageTitle title="เพิ่มลูกค้าทั่วไป" ref={topRef} tabIndex={-1} />

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* โครงการ (UI-only) */}
          <Card>
            <CardHeader title="โครงการที่เข้าร่วม" />
            <div className="grid gap-3 md:grid-cols-3">
              <label
                className={cx(
                  "group relative flex w-full items-center justify-center gap-4 text-center cursor-pointer rounded-2xl border p-4 min-h-[72px] transition-all duration-200",
                  "border-slate-200 bg-slate-50 dark:border-slate-700 dark:bg-slate-700/40",
                  "hover:border-emerald-300/70 hover:shadow-sm dark:hover:border-emerald-400/40",
                  form.slowdown_rice
                    ? "border-emerald-400 bg-emerald-50/60 ring-2 ring-emerald-400/60 dark:bg-emerald-400/10"
                    : "ring-0"
                )}
              >
                <span
                  className={cx(
                    "relative inline-flex h-7 w-12 flex-shrink-0 items-center rounded-full transition-colors",
                    form.slowdown_rice ? "bg-emerald-600" : "bg-slate-300 dark:bg-slate-600"
                  )}
                  aria-hidden="true"
                >
                  <span
                    className={cx(
                      "inline-block h-6 w-6 transform rounded-full bg-white shadow transition",
                      "shadow-[0_3px_10px_rgba(0,0,0,0.25)]",
                      form.slowdown_rice ? "translate-x-6" : "translate-x-1",
                      "group-hover:scale-105"
                    )}
                  />
                </span>

                <input
                  type="checkbox"
                  className="sr-only"
                  checked={!!form.slowdown_rice}
                  onChange={(e) => update("slowdown_rice", e.target.checked)}
                />
                <span className="text-slate-800 dark:text-slate-100 text-[15px] md:text-base font-medium text-center">
                  โครงการชะลอข้าวเปลือก
                </span>
                <span
                  className={cx(
                    "pointer-events-none absolute inset-0 rounded-2xl transition-opacity",
                    "bg-emerald-100/30 dark:bg-emerald-400/10",
                    form.slowdown_rice ? "opacity-100" : "opacity-0 group-hover:opacity-100"
                  )}
                  aria-hidden="true"
                />
              </label>
            </div>
          </Card>

          {/* แบบฟอร์มหลัก */}
          <Card>
            <CardHeader title="ข้อมูลลูกค้าทั่วไป" />

            {addressError ? (
              <ErrorState
                message="โหลดรายชื่อจังหวัด อำเภอ ตำบลไม่สำเร็จ ลองใหม่อีกครั้ง"
                onRetry={reloadAddress}
              />
            ) : !addressReady ? (
              <PageLoader variant="spinner" message="กำลังเตรียมข้อมูลที่อยู่…" />
            ) : (
            <>
            {/* แถวบนสุด */}
            <div className="grid gap-4 md:grid-cols-3">
              <div>
                <label className={labelCls}>เลขที่บัตรประชาชน (13 หลัก · ไม่บังคับ)</label>
                <input
                  ref={refs.citizen_id}
                  inputMode="numeric"
                  maxLength={13}
                  className={cx(baseField, errors.citizen_id && fieldError)}
                  value={form.citizen_id}
                  onChange={(e) => { clearError("citizen_id"); update("citizen_id", onlyDigits(e.target.value).slice(0,13)) }}
                  placeholder="เช่น 1234567890123"
                  aria-invalid={errors.citizen_id ? true : undefined}
                  {...bindEnter(0)}
                />
                {errors.citizen_id && <p className={errorTextCls}>{errors.citizen_id}</p>}
              </div>

              <div>
                <label className={labelCls}>คำนำหน้า</label>
                <div ref={refs.precode}>
                  <ComboBox
                    options={PREFIX_OPTIONS}
                    value={form.precode}
                    onChange={(v) => { clearError("precode"); update("precode", v); update("sex", sexFromPrefix(v)) }}
                    placeholder="— เลือกคำนำหน้า —"
                    error={!!errors.precode}
                    buttonRef={comboBtnRefs.precode}
                    onEnterNext={() => focusNextFromIndex(1)}
                  />
                </div>
                {errors.precode && <p className={errorTextCls}>{errors.precode}</p>}
              </div>

              <div>
                <label className={labelCls}>ชื่อ–สกุล</label>
                <input
                  ref={refs.full_name}
                  className={cx(baseField, errors.full_name && fieldError)}
                  value={form.full_name}
                  onChange={(e) => { clearError("full_name"); update("full_name", e.target.value) }}
                  placeholder="เช่น นายสมชาย ใจดี"
                  aria-invalid={errors.full_name ? true : undefined}
                  {...bindEnter(2)}
                />
                {errors.full_name && <p className={errorTextCls}>{errors.full_name}</p>}
              </div>
            </div>

            {/* แถวที่สอง */}
            <div className="mt-4 grid gap-4 md:grid-cols-3">
              <div>
                <label className={labelCls}>บ้านเลขที่</label>
                <input
                  ref={refs.address}
                  className={cx(baseField, errors.address && fieldError)}
                  value={form.address}
                  onChange={(e) => { clearError("address"); update("address", e.target.value) }}
                  placeholder="เช่น 99/1"
                  aria-invalid={errors.address ? true : undefined}
                  {...bindEnter(3)}
                />
                {errors.address && <p className={errorTextCls}>{errors.address}</p>}
              </div>

              <div>
                <label className={labelCls}>หมู่</label>
                <input
                  ref={refs.mhoo}
                  className={baseField}
                  value={form.mhoo}
                  onChange={(e) => update("mhoo", e.target.value)}
                  placeholder="เช่น 4"
                  {...bindEnter(4)}
                />
              </div>

              {/* จังหวัด (ค้นหาได้) */}
              <div>
                <label className={labelCls}>จังหวัด</label>
                <div ref={refs.province}>
                  <ComboBox
                    options={provinceOptions}
                    value={form.province}
                    onChange={(v, opt) => {
                      clearError("province")
                      update("province", v)
                      setSelectedProvinceId(opt?.__id || null)
                    }}
                    placeholder="— เลือก/พิมพ์เพื่อค้นหาจังหวัด —"
                    error={!!errors.province}
                    buttonRef={comboBtnRefs.province}
                    searchable
                    searchPlaceholder="พิมพ์ชื่อจังหวัด..."
                    onEnterNext={() => focusNextFromIndex(5)}
                  />
                </div>
                {errors.province && <p className={errorTextCls}>{errors.province}</p>}
              </div>

              {/* อำเภอ */}
              <div className="md:col-span-1">
                <label className={labelCls}>อำเภอ</label>
                <div ref={refs.district}>
                  <ComboBox
                    options={amphoeOptions}
                    value={form.district}
                    onChange={(v, opt) => {
                      clearError("district")
                      update("district", v)
                      setSelectedDistrictId(opt?.__id || null)
                    }}
                    placeholder={form.province ? "— เลือกอำเภอ —" : "เลือกจังหวัดก่อน"}
                    error={!!errors.district}
                    disabled={!form.province}
                    buttonRef={comboBtnRefs.district}
                    onEnterNext={() => focusNextFromIndex(6)}
                  />
                </div>
                {errors.district && <p className={errorTextCls}>{errors.district}</p>}
              </div>

              {/* ตำบล */}
              <div className="md:col-span-1">
                <label className={labelCls}>ตำบล</label>
                <div ref={refs.sub_district}>
                  <ComboBox
                    options={tambonOptions}
                    value={form.sub_district}
                    onChange={(v, opt) => {
                      clearError("sub_district")
                      update("sub_district", v)
                      if (!form.postal_code && opt?.__zip) {
                        update("postal_code", String(opt.__zip))
                      }
                    }}
                    placeholder={form.district ? "— เลือกตำบล —" : "เลือกอำเภอก่อน"}
                    error={!!errors.sub_district}
                    disabled={!form.district}
                    buttonRef={comboBtnRefs.sub_district}
                    onEnterNext={() => focusNextFromIndex(7)}
                  />
                </div>
                {errors.sub_district && <p className={errorTextCls}>{errors.sub_district}</p>}
              </div>

              {/* รหัสไปรษณีย์ */}
              <div>
                <label className={labelCls}>รหัสไปรษณีย์</label>
                <input
                  ref={refs.postal_code}
                  inputMode="numeric"
                  maxLength={5}
                  className={cx(baseField, errors.postal_code && fieldError)}
                  value={form.postal_code}
                  onChange={(e) => { clearError("postal_code"); update("postal_code", onlyDigits(e.target.value).slice(0,5)) }}
                  placeholder="เช่น 32000"
                  aria-invalid={errors.postal_code ? true : undefined}
                  {...bindEnter(8)}
                />
                {errors.postal_code && <p className={errorTextCls}>{errors.postal_code}</p>}
              </div>

              {/* เบอร์โทร */}
              <div>
                <label className={labelCls}>เบอร์โทรศัพท์</label>
                <input
                  ref={refs.phone_number}
                  inputMode="tel"
                  className={baseField}
                  value={form.phone_number}
                  onChange={(e) => update("phone_number", e.target.value)}
                  placeholder="เช่น 021234567"
                  {...bindEnter(9)}
                />
              </div>

              {/* เพศ (กำหนดจากคำนำหน้า) */}
              <div>
                <label className={labelCls}>เพศ (กำหนดจากคำนำหน้า)</label>
                <div ref={refs.sex}>
                  <ComboBox
                    options={[{ value: "M", label: "ชาย" }, { value: "F", label: "หญิง" }]}
                    value={form.sex}
                    onChange={() => {}}
                    placeholder="— เลือกคำนำหน้าเพื่อกำหนด —"
                    disabled
                  />
                </div>
              </div>

              {/* FID block */}
              <div className="md:col-span-3 grid gap-4 md:grid-cols-3">
                <div>
                  <label className={labelCls}>เลขทะเบียนเกษตรกร</label>
                  <input
                    ref={refs.fid}
                    className={cx(baseField, errors.fid && fieldError)}
                    value={form.fid}
                    onChange={(e) => { clearError("fid"); update("fid", e.target.value) }}
                    placeholder="เช่น 123456"
                    aria-invalid={errors.fid ? true : undefined}
                    {...bindEnter(10)}
                  />
                  {errors.fid && <p className={errorTextCls}>{errors.fid}</p>}
                </div>

                <div>
                  <label className={labelCls}>ชื่อผู้ขึ้นทะเบียนเกษตรกร</label>
                  <input
                    ref={refs.fid_owner}
                    className={baseField}
                    value={form.fid_owner}
                    onChange={(e) => update("fid_owner", e.target.value)}
                    placeholder="เช่น นายสมหมาย นามดี"
                    {...bindEnter(11)}
                  />
                </div>

                <div>
                  <label className={labelCls}>ความสัมพันธ์กับผู้ขึ้นทะเบียน</label>
                  <div ref={refs.fid_relationship}>
                    <ComboBox
                      options={fidRelOptions}
                      value={form.fid_relationship}
                      onChange={(v) => { clearError("fid_relationship"); update("fid_relationship", v) }}
                      placeholder={relLoading ? "กำลังโหลด..." : "— เลือกความสัมพันธ์ —"}
                      error={!!errors.fid_relationship}
                      disabled={relLoading}
                      buttonRef={comboBtnRefs.fid_relationship}
                      onEnterNext={() => focusNextFromIndex(12)}
                    />
                  </div>
                  {errors.fid_relationship && <p className={errorTextCls}>{errors.fid_relationship}</p>}
                </div>
              </div>
            </div>

            {/* ปุ่ม */}
            <div className="mt-6 flex flex-col gap-3 sm:flex-row">
              <button
                ref={submitBtnRef}
                type="submit"
                disabled={submitting}
                className={submitBtnCls}
                aria-busy={submitting ? "true" : "false"}
              >
                {submitting && <span className={spinnerCls} aria-hidden="true" />}
                {submitting ? "กำลังบันทึก..." : "บันทึก"}
              </button>

              <button
                type="button"
                onClick={handleReset}
                disabled={submitting}
                className={resetBtnCls}
              >
                รีเซ็ต
              </button>
            </div>
            </>
            )}
          </Card>
        </form>
      </div>
    </div>
  )
}

export default CustomerAdd
