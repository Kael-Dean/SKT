// src/pages/CustomerAdd.jsx
import { useEffect, useMemo, useRef, useState, forwardRef, useImperativeHandle } from "react"
import { apiAuth } from "../lib/api"

/** ---------- Utils ---------- */
const onlyDigits = (s = "") => s.replace(/\D+/g, "")
const cx = (...a) => a.filter(Boolean).join(" ")

// (ยังคงไว้ใช้สำหรับกรณีค้นหา/เติมอัตโนมัติจากชื่อ หากพบเลข 13 หลักจากฐานสมาชิก)


// debounce
function useDebounce(value, delay = 400) {
  const [debounced, setDebounced] = useState(value)
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delay)
    return () => clearTimeout(t)
  }, [value, delay])
  return debounced
}

/** ---------- Styles ---------- */
const baseField =
  "w-full rounded-2xl border border-slate-300 bg-slate-100 p-3 text-[15px] md:text-base " +
  "text-black outline-none placeholder:text-slate-500 focus:border-emerald-600 focus:ring-2 focus:ring-emerald-500/30 shadow-none " +
  "dark:border-slate-500 dark:bg-slate-700 dark:text-slate-100 dark:placeholder:text-slate-300 dark:focus:border-emerald-400 dark:focus:ring-emerald-400/30"

const fieldError = "border-red-500 ring-2 ring-red-300 focus:ring-0 focus:border-red-500"
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

/** ---------- DateInput (เผื่ออนาคต ถ้าต้องใช้) ---------- */
const DateInput = forwardRef(function DateInput({ error = false, className = "", ...props }, ref) {
  const inputRef = useRef(null)
  useImperativeHandle(ref, () => inputRef.current)
  return (
    <div className="relative">
      <style>{`input[type="date"]::-webkit-calendar-picker-indicator { opacity: 0; }`}</style>
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
          <path d="M7 2a1 1 0 0 1 1 1v1h8V3a1 1 0 1 1 2 0v1h1a2 2 0 0 1 2 2v3H3V6a2 2 0 0 1 2-2h1V3a1 1 0 1 1 1-1zm14 9v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-7h18zM7 14h2v2H7v-2zm4 0h2v2h-2v-2z" />
        </svg>
      </button>
    </div>
  )
})

/** ---------- Component: CustomerAdd ---------- */
const CustomerAdd = () => {
  const [errors, setErrors] = useState({})
  const [submitting, setSubmitting] = useState(false)
  const [status, setStatus] = useState({ searching: false, message: "", tone: "muted" }) // tone: muted|ok|warn

  // refs เพื่อเลื่อนโฟกัสไปยัง error ตัวแรก
  const refs = {
    citizen_id: useRef(null),
    full_name: useRef(null),
    address: useRef(null),
    mhoo: useRef(null),
    sub_district: useRef(null),
    district: useRef(null),
    province: useRef(null),
    postal_code: useRef(null),
    phone_number: useRef(null),
    fid: useRef(null),
    fid_owner: useRef(null),
    fid_relationship: useRef(null),
  }
  const topRef = useRef(null)

  // ฟอร์ม (ส่งทุกอินพุตที่ Backend รองรับใน /member/customers/signup)
  const [form, setForm] = useState({
    // UI-only (ยังเก็บไว้ได้ แต่อย่าส่งขึ้น Backend)
    slowdown_rice: false,

    // ลูกค้าทั่วไป (map -> CustomerCreate)
    citizen_id: "",
    full_name: "",
    address: "",
    mhoo: "",
    sub_district: "",
    district: "",
    province: "",
    postal_code: "",
    phone_number: "",

    // เพิ่ม: กลุ่ม FID ให้ส่งขึ้น Backend ด้วย
    fid: "",
    fid_owner: "",
    fid_relationship: "",
  })

  const update = (k, v) => setForm((p) => ({ ...p, [k]: v }))
  const clearError = (k) =>
    setErrors((prev) => {
      if (!(k in prev)) return prev
      const { [k]: _omit, ...rest } = prev
      return rest
    })

  // debounce เพื่อค้นหาอัตโนมัติ (ฝั่งสมาชิก)
  const debCid = useDebounce(form.citizen_id, 400)
  const debName = useDebounce(form.full_name, 400)

  /** helper: ดึงข้อมูลจากสมาชิกเดิม (เพื่อเติมอัตโนมัติ) */
  const fetchMemberSearch = async (q) => {
    try {
      const arr = await apiAuth(`/member/members/search?q=${encodeURIComponent(q)}`)
      return Array.isArray(arr) ? arr : []
    } catch {
      return []
    }
  }

  /** เติมที่อยู่จากผลสมาชิก */
  const hydrateFromMember = (rec) => {
    const toStr = (v) => (v == null ? "" : String(v))
    const addr = {
      address: toStr(rec.address ?? ""),
      mhoo: toStr(rec.mhoo ?? ""),
      sub_district: toStr(rec.sub_district ?? ""),
      district: toStr(rec.district ?? ""),
      province: toStr(rec.province ?? ""),
      postal_code: onlyDigits(toStr(rec.postal_code ?? "")),
      first_name: toStr(rec.first_name ?? ""),
      last_name: toStr(rec.last_name ?? ""),
      phone_number: toStr(rec.phone_number ?? ""),
      fid: toStr(rec.fid ?? ""),
      fid_owner: toStr(rec.fid_owner ?? ""),
      fid_relationship: toStr(rec.fid_relationship ?? ""),
    }
    const full = `${addr.first_name} ${addr.last_name}`.trim()
    update("full_name", form.full_name || full)
    setForm((prev) => ({
      ...prev,
      address: prev.address || addr.address,
      mhoo: prev.mhoo || addr.mhoo,
      sub_district: prev.sub_district || addr.sub_district,
      district: prev.district || addr.district,
      province: prev.province || addr.province,
      postal_code: prev.postal_code || addr.postal_code,
      phone_number: prev.phone_number || addr.phone_number,
      fid: prev.fid || addr.fid,
      fid_owner: prev.fid_owner || addr.fid_owner,
      fid_relationship: prev.fid_relationship || addr.fid_relationship,
    }))
  }

  /** ค้นหาด้วย citizen_id กับฝั่งสมาชิก (เพื่อเติมอัตโนมัติ)
   *  เดิม: ค้นหาเฉพาะกรอกครบ 13 หลักและผ่าน checksum
   *  ตอนนี้ยังคงเงื่อนไขเดิมไว้ (เพื่อกันยิงค้นถี่ ๆ) แต่ช่องกรอก “ไม่บังคับเงื่อนไข” แล้ว
   */
  useEffect(() => {
    const cid = onlyDigits(debCid || "")
    if (submitting) return
    if (cid.length !== 13 || !validateThaiCitizenId(cid)) return
    let cancelled = false
    ;(async () => {
      setStatus({ searching: true, message: "กำลังค้นหาจากเลขบัตรประชาชนในฐานสมาชิก...", tone: "muted" })
      const list = await fetchMemberSearch(cid)
      if (cancelled) return
      const found = list.find((r) => onlyDigits(r.citizen_id ?? "") === cid)
      if (found) {
        hydrateFromMember(found)
        setStatus({ searching: false, message: "พบข้อมูลสมาชิกเดิม และเติมให้อัตโนมัติแล้ว ✅", tone: "ok" })
      } else {
        setStatus({ searching: false, message: "ไม่พบเลขนี้ในฐานสมาชิก จะสร้างลูกค้าใหม่เมื่อบันทึก", tone: "warn" })
      }
    })()
    return () => { cancelled = true }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debCid, submitting])

  /** ค้นหาด้วยชื่อ–สกุล (ไปดูฝั่งสมาชิก) */
  useEffect(() => {
    const q = (debName || "").trim()
    if (submitting) return
    if (q.length < 2) return
    let cancelled = false
    ;(async () => {
      setStatus({ searching: true, message: "กำลังค้นหาจากชื่อ–สกุลในฐานสมาชิก...", tone: "muted" })
      const list = await fetchMemberSearch(q)
      if (cancelled) return
      // เอา record แรกที่ชื่อใกล้เคียง
      const found = list.find((r) => {
        const f = `${(r.first_name ?? "").trim()} ${(r.last_name ?? "").trim()}`.trim()
        return f && f.includes(q)
      })
      if (found) {
        const cid = onlyDigits(found.citizen_id ?? "")
        if (cid.length === 13 && validateThaiCitizenId(cid)) update("citizen_id", cid)
        hydrateFromMember(found)
        setStatus({ searching: false, message: "พบข้อมูลสมาชิกเดิม และเติมให้อัตโนมัติแล้ว ✅", tone: "ok" })
      } else {
        setStatus({ searching: false, message: "ไม่พบชื่อนี้ในฐานสมาชิก", tone: "warn" })
      }
    })()
    return () => { cancelled = true }
    // eslint-disable-line react-hooks/exhaustive-deps
  }, [debName, submitting])

  /** ตรวจความถูกต้องก่อนส่งเข้า Back */
  const validateAll = () => {
    const e = {}
    // ❌ ยกเลิกการบังคับตรวจเลขบัตรประชาชนให้เป็น 13 หลัก
    // if (!validateThaiCitizenId(form.citizen_id)) e.citizen_id = "เลขบัตรประชาชนไม่ถูกต้อง"

    if (!form.full_name.trim()) e.full_name = "กรุณากรอกชื่อ–สกุล"
    if (!form.address.trim()) e.address = "กรุณากรอกบ้านเลขที่"
    if (!form.sub_district.trim()) e.sub_district = "กรุณากรอกตำบล"
    if (!form.district.trim()) e.district = "กรุณากรอกอำเภอ"
    if (!form.province.trim()) e.province = "กรุณากรอกจังหวัด"

    // ถ้ามีค่า ให้เป็นตัวเลข
    ;["postal_code", "fid", "fid_relationship"].forEach((k) => {
      if (form[k] !== "" && isNaN(Number(form[k]))) e[k] = "ต้องเป็นตัวเลข"
    })

    setErrors(e)
    return Object.keys(e).length === 0
  }

  // เลื่อนไป error แรก
  useEffect(() => {
    const order = [
      "citizen_id","full_name","address","mhoo","sub_district","district","province","postal_code",
      "phone_number","fid","fid_owner","fid_relationship"
    ]
    const first = order.find((k) => k in errors)
    if (first) {
      const el = refs[first]?.current
      if (el && typeof el.focus === "function") {
        try { el.scrollIntoView({ behavior: "smooth", block: "center" }) } catch {}
        el.focus()
      }
    }
  }, [errors]) // eslint-disable-line react-hooks/exhaustive-deps

  /** แปลงชื่อเต็ม -> first_name / last_name */
  const splitName = (full = "") => {
    const parts = full.trim().split(/\s+/).filter(Boolean)
    if (parts.length === 0) return { first_name: "", last_name: "" }
    if (parts.length === 1) return { first_name: parts[0], last_name: "" }
    return { first_name: parts[0], last_name: parts.slice(1).join(" ") }
  }

  /** บันทึก (เชื่อมกับ POST /member/customers/signup) */
  const handleSubmit = async (ev) => {
    ev.preventDefault()
    if (!validateAll()) return
    setSubmitting(true)

    const { first_name, last_name } = splitName(form.full_name)

    // ส่งทุกอินพุตที่ Backend รองรับ (CustomerCreate)
    const payload = {
      first_name,
      last_name,
      citizen_id: onlyDigits(form.citizen_id), // ✅ อนุญาตทุกความยาว (จะเป็น "" ได้ถ้าไม่ได้กรอก)
      address: form.address.trim(),
      mhoo: (form.mhoo ?? "").toString().trim() || "",
      sub_district: form.sub_district.trim(),
      district: form.district.trim(),
      province: form.province.trim(),
      postal_code: form.postal_code !== "" ? Number(form.postal_code) : null,
      phone_number: form.phone_number.trim() || null,

      // ✅ เพิ่มกลุ่ม FID (optional ทั้งหมด)
      fid: form.fid !== "" ? Number(form.fid) : null,
      fid_owner: form.fid_owner.trim() || null,
      fid_relationship: form.fid_relationship !== "" ? Number(form.fid_relationship) : null,
    }

    try {
      await apiAuth(`/member/customers/signup`, { method: "POST", body: payload })
      alert("บันทึกข้อมูลลูกค้าทั่วไปเรียบร้อย ✅")
      handleReset()
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
    setStatus({ searching: false, message: "", tone: "muted" })
    setForm({
      slowdown_rice: false,
      citizen_id: "",
      full_name: "",
      address: "",
      mhoo: "",
      sub_district: "",
      district: "",
      province: "",
      postal_code: "",
      phone_number: "",
      fid: "",
      fid_owner: "",
      fid_relationship: "",
    })
    requestAnimationFrame(() => {
      try { topRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }) } catch {}
    })
  }

  /** ---------- UI ---------- */
  return (
    <div className="min-h-screen bg-white text-black dark:bg-slate-900 dark:text-white rounded-2xl text-[15px] md:text-base">
      <div className="mx-auto max-w-7xl p-5 md:p-6 lg:p-8">
        <h1 ref={topRef} tabIndex={-1} className="mb-1 text-3xl font-bold text-gray-900 dark:text-white">
          👤 เพิ่มลูกค้าทั่วไป
        </h1>

        {/* แถบสถานะค้นหา/เติมอัตโนมัติ */}
        {status.message && (
          <div
            className={cx(
              "mb-4 rounded-xl px-4 py-2 text-sm",
              status.tone === "ok"   && "bg-emerald-50 text-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-200",
              status.tone === "warn" && "bg-amber-50 text-amber-700 dark:bg-amber-900/20 dark:text-amber-200",
              status.tone === "muted"&& "bg-slate-100 text-slate-700 dark:bg-slate-800/60 dark:text-slate-200"
            )}
            aria-live="polite"
          >
            {status.searching ? "⏳ " : ""}{status.message}
          </div>
        )}

        <form onSubmit={handleSubmit}>
          {/* โครงการ (UI-only) */}
          <SectionCard title="โครงการที่เข้าร่วม" className="mb-6">
            <div className="grid gap-3 md:grid-cols-3">
              <label
                className={cx(
                  "group relative flex w-full items-center justify-center gap-4 text-center cursor-pointer rounded-2xl border p-4 min-h[72px] transition-all",
                  "border-slate-200 bg-white/80 dark:border-slate-700 dark:bg-slate-700/40",
                  "shadow-[0_4px_14px_rgba(0,0,0,0.06)] hover:shadow-[0_10px_26px_rgba(0,0,0,0.12)]",
                  "hover:border-emerald-300/70 dark:hover:border-emerald-400/40",
                  form.slowdown_rice ? "ring-2 ring-emerald-400 shadow-[0_12px_30px_rgba(16,185,129,0.25)]" : "ring-0"
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
          </SectionCard>

          {/* ฟอร์มข้อมูลลูกค้า */}
          <SectionCard title="ข้อมูลลูกค้าทั่วไป">
            {/* แถวบนสุด: 2 ช่อง */}
            <div className="grid gap-4 md:grid-cols-2">
              {/* citizen_id */}
              <div>
                <label className={labelCls}>เลขที่บัตรประชาชน (พิมพ์เลขได้ทุกความยาว)</label>
                <input
                  ref={refs.citizen_id}
                  inputMode="numeric"
                  className={cx(baseField /* ไม่มีการฟ้อง error citizen_id แล้ว */)}
                  value={form.citizen_id}
                  onChange={(e) => { clearError("citizen_id"); update("citizen_id", onlyDigits(e.target.value)) }}
                  onFocus={() => clearError("citizen_id")}
                  placeholder="พิมพ์ตัวเลขได้อิสระ (ไม่บังคับ 13 หลัก)"
                />
                {/* ไม่แสดง errors.citizen_id อีกต่อไป */}
              </div>

              {/* full_name */}
              <div>
                <label className={labelCls}>ชื่อ–สกุล (พิมพ์เพื่อค้นหาอัตโนมัติ)</label>
                <input
                  ref={refs.full_name}
                  className={cx(baseField, errors.full_name && fieldError)}
                  value={form.full_name}
                  onChange={(e) => { clearError("full_name"); update("full_name", e.target.value) }}
                  onFocus={() => clearError("full_name")}
                  placeholder="เช่น นายสมชาย ใจดี"
                  aria-invalid={errors.full_name ? true : undefined}
                />
                {errors.full_name && <p className={errorTextCls}>{errors.full_name}</p>}
              </div>
            </div>

            {/* แถวถัด ๆ ไป: 3 คอลัมน์ทุกบรรทัด */}
            <div className="mt-4 grid gap-4 md:grid-cols-3">
              {/* address  */}
              <div>
                <label className={labelCls}>บ้านเลขที่</label>
                <input
                  ref={refs.address}
                  className={cx(baseField, errors.address && fieldError)}
                  value={form.address}
                  onChange={(e) => { clearError("address"); update("address", e.target.value) }}
                  onFocus={() => clearError("address")}
                  placeholder="เช่น 99/1"
                  aria-invalid={errors.address ? true : undefined}
                />
                {errors.address && <p className={errorTextCls}>{errors.address}</p>}
              </div>

              {/* mhoo */}
              <div>
                <label className={labelCls}>หมู่</label>
                <input
                  ref={refs.mhoo}
                  className={baseField}
                  value={form.mhoo}
                  onChange={(e) => update("mhoo", e.target.value)}
                  placeholder="เช่น 4"
                />
              </div>

              {/* sub_district */}
              <div>
                <label className={labelCls}>ตำบล</label>
                <input
                  ref={refs.sub_district}
                  className={cx(baseField, errors.sub_district && fieldError)}
                  value={form.sub_district}
                  onChange={(e) => { clearError("sub_district"); update("sub_district", e.target.value) }}
                  onFocus={() => clearError("sub_district")}
                  placeholder="เช่น หนองปลาไหล"
                  aria-invalid={errors.sub_district ? true : undefined}
                />
                {errors.sub_district && <p className={errorTextCls}>{errors.sub_district}</p>}
              </div>

              {/* district */}
              <div>
                <label className={labelCls}>อำเภอ</label>
                <input
                  ref={refs.district}
                  className={cx(baseField, errors.district && fieldError)}
                  value={form.district}
                  onChange={(e) => { clearError("district"); update("district", e.target.value) }}
                  onFocus={() => clearError("district")}
                  placeholder="เช่น เมือง"
                  aria-invalid={errors.district ? true : undefined}
                />
                {errors.district && <p className={errorTextCls}>{errors.district}</p>}
              </div>

              {/* province */}
              <div>
                <label className={labelCls}>จังหวัด</label>
                <input
                  ref={refs.province}
                  className={cx(baseField, errors.province && fieldError)}
                  value={form.province}
                  onChange={(e) => { clearError("province"); update("province", e.target.value) }}
                  onFocus={() => clearError("province")}
                  placeholder="เช่น ขอนแก่น"
                  aria-invalid={errors.province ? true : undefined}
                />
                {errors.province && <p className={errorTextCls}>{errors.province}</p>}
              </div>

              {/* postal_code */}
              <div>
                <label className={labelCls}>รหัสไปรษณีย์ (ไม่บังคับ)</label>
                <input
                  ref={refs.postal_code}
                  inputMode="numeric"
                  maxLength={5}
                  className={cx(baseField, errors.postal_code && fieldError)}
                  value={form.postal_code}
                  onChange={(e) => { clearError("postal_code"); update("postal_code", onlyDigits(e.target.value)) }}
                  onFocus={() => clearError("postal_code")}
                  placeholder="เช่น 40000"
                  aria-invalid={errors.postal_code ? true : undefined}
                />
                {errors.postal_code && <p className={errorTextCls}>{errors.postal_code}</p>}
              </div>

              {/* phone_number */}
              <div>
                <label className={labelCls}>เบอร์โทรศัพท์</label>
                <input
                  ref={refs.phone_number}
                  inputMode="tel"
                  className={baseField}
                  value={form.phone_number}
                  onChange={(e) => update("phone_number", e.target.value)}
                  placeholder="เช่น 021234567"
                />
              </div>

              {/* บล็อก FID (ส่งขึ้น Back ได้) */}
              <div className="md:col-span-3 grid gap-4 md:grid-cols-3">
                {/* fid */}
                <div>
                  <label className={labelCls}>เลขที่ทะเบียนเกษตรกร (FID)</label>
                  <input
                    ref={refs.fid}
                    inputMode="numeric"
                    className={cx(baseField, errors.fid && fieldError)}
                    value={form.fid}
                    onChange={(e) => { clearError("fid"); update("fid", onlyDigits(e.target.value)) }}
                    onFocus={() => clearError("fid")}
                    placeholder="ตัวเลข เช่น 123456"
                    aria-invalid={errors.fid ? true : undefined}
                  />
                  {errors.fid && <p className={errorTextCls}>{errors.fid}</p>}
                </div>

                {/* fid_owner */}
                <div>
                  <label className={labelCls}>ชื่อทะเบียนเกษตรกร (FID Owner)</label>
                  <input
                    ref={refs.fid_owner}
                    className={baseField}
                    value={form.fid_owner}
                    onChange={(e) => update("fid_owner", e.target.value)}
                    placeholder="เช่น นายสมหมาย นามดี"
                  />
                </div>

                {/* fid_relationship */}
                <div>
                  <label className={labelCls}>ความสัมพันธ์ (FID Relationship)</label>
                  <input
                    ref={refs.fid_relationship}
                    inputMode="numeric"
                    className={cx(baseField, errors.fid_relationship && fieldError)}
                    value={form.fid_relationship}
                    onChange={(e) => { clearError("fid_relationship"); update("fid_relationship", onlyDigits(e.target.value)) }}
                    onFocus={() => clearError("fid_relationship")}
                    placeholder="ตัวเลขรหัสความสัมพันธ์ (ถ้ามี)"
                    aria-invalid={errors.fid_relationship ? true : undefined}
                  />
                  {errors.fid_relationship && <p className={errorTextCls}>{errors.fid_relationship}</p>}
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
                {submitting ? "กำลังบันทึก..." : "บันทึกข้อมูลลูกค้า"}
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

export default CustomerAdd
