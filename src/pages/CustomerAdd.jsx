// src/pages/CustomerDetail.jsx
import { useEffect, useMemo, useRef, useState } from "react"
import { useParams, useNavigate } from "react-router-dom"
import { apiAuth } from "../lib/api"

/* ---------------- Utils ---------------- */
const onlyDigits = (s = "") => String(s ?? "").replace(/\D+/g, "")
const cx = (...a) => a.filter(Boolean).join(" ")

/* ---------------- Styles ---------------- */
const baseField =
  "w-full rounded-2xl border border-slate-300 bg-slate-100 p-3 text-[15px] md:text-base text-black outline-none " +
  "placeholder:text-slate-500 focus:border-emerald-600 focus:ring-2 focus:ring-emerald-500/30 shadow-none " +
  "dark:border-slate-500 dark:bg-slate-700 dark:text-slate-100 dark:placeholder:text-slate-300 " +
  "dark:focus:border-emerald-400 dark:focus:ring-emerald-400/30"
const fieldError = "border-red-500 ring-2 ring-red-300 focus:ring-0 focus:border-red-500"
const labelCls = "mb-1 block text-[15px] md:text-base font-medium text-slate-700 dark:text-slate-200"
const errorTextCls = "mt-1 text-sm text-red-500"

/* ---------------- Lite ComboBox (ใช้เฉพาะที่ต้องมีในหน้านี้) ---------------- */
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
  onEnterNext = null,
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

  const selectedIndex = useMemo(
    () => options.findIndex((o) => String(getValue(o)) === String(value)),
    [options, value, getValue]
  )

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

  useEffect(() => {
    if (open) {
      const idx = selectedIndex >= 0 ? selectedIndex : (options.length ? 0 : -1)
      setHighlight(idx)
      if (idx >= 0) requestAnimationFrame(() => scrollHighlightedIntoView(idx))
    }
  }, [open, selectedIndex, options])

  const scrollHighlightedIntoView = (index) => {
    const listEl = listRef.current
    const itemEl = listEl?.children?.[index]
    if (!listEl || !itemEl) return
    const itemRect = itemEl.getBoundingClientRect()
    const listRect = listEl.getBoundingClientRect()
    const buffer = 6
    if (itemRect.top < listRect.top + buffer) listEl.scrollTop -= (listRect.top + buffer) - itemRect.top
    else if (itemRect.bottom > listRect.bottom - buffer) listEl.scrollTop += itemRect.bottom - (listRect.bottom - buffer)
  }

  const commit = (opt, { navigate = false } = {}) => {
    const v = String(getValue(opt))
    onChange?.(v, opt)
    setOpen(false)
    setHighlight(-1)
    requestAnimationFrame(() => {
      controlRef.current?.focus()
      if (navigate) onEnterNext?.()
    })
  }

  const onKeyDown = (e) => {
    if (disabled) return
    if (!open && e.key === "Enter") { e.preventDefault(); setOpen(true); return }
    if (!open && (e.key === " " || e.key === "ArrowDown")) { e.preventDefault(); setOpen(true); return }
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
      if (highlight >= 0 && highlight < options.length) commit(options[highlight], { navigate: true })
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
          if (disabled) return
          setOpen((o) => {
            const willOpen = !o
            if (!o) {
              const idx = selectedIndex >= 0 ? selectedIndex : (options.length ? 0 : -1)
              setHighlight(idx)
            }
            return willOpen
          })
        }}
        onKeyDown={onKeyDown}
        data-combobox-btn="true"
        className={cx(
          "w-full rounded-2xl border p-3 text-left text-[15px] md:text-base outline-none transition shadow-none",
          disabled ? "bg-slate-200 cursor-not-allowed" : "bg-slate-100 hover:bg-slate-200 cursor-pointer",
          error ? "border-red-400 ring-2 ring-red-300/70"
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
          {options.length === 0 && <div className="px-3 py-2 text-sm text-slate-600 dark:text-slate-300">ไม่มีตัวเลือก</div>}
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
                  isActive ? "bg-emerald-100 ring-1 ring-emerald-300 dark:bg-emerald-400/20 dark:ring-emerald-500"
                           : "hover:bg-emerald-50 dark:hover:bg-emerald-900/30"
                )}
              >
                {isActive && <span className="absolute left-0 top-0 h-full w-1 bg-emerald-600 dark:bg-emerald-400/70 rounded-l-xl" />}
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

/* ---------------- หน้าแก้ไขข้อมูลลูกค้า ---------------- */
const CustomerDetail = () => {
  const { id } = useParams() // asso_id หรือ customer_id ที่ใช้ในเส้นทาง
  const navigate = useNavigate()

  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [serverError, setServerError] = useState("")

  const [form, setForm] = useState({
    // display/logic
    precode: "",           // "1|2|3"
    sex: "",               // "M|F|"
    // name parts for display
    first_name: "",
    last_name: "",
    // contacts & address
    citizen_id: "",
    phone_number: "",
    address: "",
    mhoo: "",
    sub_district: "",
    district: "",
    province: "",
    postal_code: "",
    // FID group
    fid: "",               // ← string only
    fid_owner: "",
    fid_relationship: "",  // id (string)
  })

  const update = (k, v) => setForm((p) => ({ ...p, [k]: v }))

  // refs (สำหรับ Enter flow ถ้าต้องเพิ่มให้ครบได้)
  const refs = {
    first_name: useRef(null),
    last_name: useRef(null),
    citizen_id: useRef(null),
    phone_number: useRef(null),
    address: useRef(null),
    mhoo: useRef(null),
    sub_district: useRef(null),
    district: useRef(null),
    province: useRef(null),
    postal_code: useRef(null),
    fid: useRef(null),
    fid_owner: useRef(null),
  }

  /* -------- โหลดข้อมูลลูกค้าจาก BE -------- */
  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        setLoading(true)
        setServerError("")
        // ปรับ endpoint ให้ตรงโปรเจ็กต์จริงของคุณ
        const data = await apiAuth(`/member/customers/${id}`)
        if (cancelled) return

        update("precode", data?.precode ? String(data.precode) : "")
        update("sex", data?.sex ?? "")
        update("first_name", data?.first_name ?? "")
        update("last_name", data?.last_name ?? "")
        update("citizen_id", String(data?.citizen_id ?? ""))
        update("phone_number", data?.phone_number ?? "")
        update("address", data?.address ?? "")
        update("mhoo", String(data?.mhoo ?? ""))
        update("sub_district", data?.sub_district ?? "")
        update("district", data?.district ?? "")
        update("province", data?.province ?? "")
        update("postal_code", String(data?.postal_code ?? ""))
        // ✳️ จุดสำคัญ: แปลง FID เป็น string เสมอ
        update("fid", data?.fid ? String(data.fid) : "")
        update("fid_owner", data?.fid_owner ?? "")
        update("fid_relationship", data?.fid_relationship ? String(data.fid_relationship) : "")
      } catch (err) {
        console.error(err)
        setServerError("ไม่พบข้อมูลลูกค้าหรือเกิดข้อผิดพลาดในการโหลด")
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => { cancelled = true }
  }, [id])

  /* -------- Validate เบา ๆ -------- */
  const [errors, setErrors] = useState({})
  const clearError = (k) =>
    setErrors((prev) => {
      if (!(k in prev)) return prev
      const { [k]: _omit, ...rest } = prev
      return rest
    })
  const validateAll = () => {
    const e = {}
    ;["postal_code", "citizen_id", "fid"].forEach((k) => {
      const v = String(form[k] ?? "")
      if (v && isNaN(Number(v))) e[k] = "ต้องเป็นตัวเลข"
    })
    if (!form.first_name.trim()) e.first_name = "กรุณากรอกชื่อ"
    if (!form.last_name.trim()) e.last_name = "กรุณากรอกนามสกุล"
    setErrors(e)
    return Object.keys(e).length === 0
  }

  /* -------- Submit อัปเดต -------- */
  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!validateAll()) return
    setSaving(true)
    setServerError("")

    // ✳️ สร้าง payload โดยบังคับ FID เป็น "สตริงของตัวเลข" (หรือ null ถ้าว่าง)
    const payload = {
      precode: form.precode !== "" ? Number(form.precode) : null,
      sex: form.sex || null,
      first_name: form.first_name.trim(),
      last_name: form.last_name.trim(),
      citizen_id: onlyDigits(form.citizen_id) || null,
      phone_number: form.phone_number.trim() || null,
      address: form.address.trim(),
      mhoo: (form.mhoo ?? "").toString().trim(),
      sub_district: form.sub_district.trim(),
      district: form.district.trim(),
      province: form.province.trim(),
      postal_code: form.postal_code !== "" ? Number(form.postal_code) : null,

      // ✅ FID เป็น string (ไม่ Number)
      fid: form.fid !== "" ? onlyDigits(form.fid) : null,
      fid_owner: form.fid_owner.trim() || null,
      fid_relationship: form.fid_relationship !== "" ? Number(form.fid_relationship) : null,
    }

    try {
      // ปรับเป็น PUT/PATCH + URL ให้ตรงกับ BE ของคุณ
      await apiAuth(`/member/customers/${id}`, { method: "PUT", body: payload })
      alert("บันทึกการแก้ไขข้อมูลลูกค้าสำเร็จ ✅")
      navigate(-1)
    } catch (err) {
      console.error(err)
      const msg =
        (err && err.detail) ||
        (typeof err?.message === "string" ? err.message : "") ||
        "อัปเดตล้มเหลว กรุณาลองใหม่"
      setServerError(msg)
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return <div className="p-6 text-center text-slate-600 dark:text-slate-300">กำลังโหลดข้อมูลลูกค้า…</div>
  }

  return (
    <div className="min-h-screen bg-white text-black dark:bg-slate-900 dark:text-white rounded-2xl text-[15px] md:text-base">
      <div className="mx-auto max-w-6xl p-5 md:p-6">
        <div className="mb-4 flex items-center justify-between">
          <h1 className="text-2xl md:text-3xl font-bold">รายละเอียดลูกค้า</h1>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => navigate(-1)}
              className="rounded-2xl border border-slate-300 bg-white px-5 py-2.5 font-medium text-slate-700 
                         hover:bg-slate-100 dark:border-slate-600 dark:bg-slate-700/60 dark:text-white"
            >
              ยกเลิก
            </button>
            <button
              type="button"
              onClick={handleSubmit}
              disabled={saving}
              className="rounded-2xl bg-emerald-600 px-5 py-2.5 font-semibold text-white
                         hover:bg-emerald-700 disabled:opacity-60"
            >
              {saving ? "กำลังบันทึก..." : "บันทึก"}
            </button>
          </div>
        </div>

        {serverError && (
          <div className="mb-4 rounded-2xl bg-red-50 p-4 text-red-600 border border-red-200">
            {serverError}
          </div>
        )}

        <form onSubmit={handleSubmit} className="grid gap-4 md:grid-cols-2">
          {/* ชื่อ–นามสกุล */}
          <div>
            <label className={labelCls}>ชื่อ</label>
            <input
              ref={refs.first_name}
              className={cx(baseField, errors.first_name && fieldError)}
              value={form.first_name}
              onChange={(e) => { clearError("first_name"); update("first_name", e.target.value) }}
              onFocus={() => clearError("first_name")}
              placeholder="เช่น โสภา"
              aria-invalid={errors.first_name ? true : undefined}
            />
            {errors.first_name && <p className={errorTextCls}>{errors.first_name}</p>}
          </div>
          <div>
            <label className={labelCls}>นามสกุล</label>
            <input
              ref={refs.last_name}
              className={cx(baseField, errors.last_name && fieldError)}
              value={form.last_name}
              onChange={(e) => { clearError("last_name"); update("last_name", e.target.value) }}
              onFocus={() => clearError("last_name")}
              placeholder="เช่น ตลับทอง"
              aria-invalid={errors.last_name ? true : undefined}
            />
            {errors.last_name && <p className={errorTextCls}>{errors.last_name}</p>}
          </div>

          {/* citizen / phone */}
          <div>
            <label className={labelCls}>เลขบัตรประชาชน</label>
            <input
              ref={refs.citizen_id}
              inputMode="numeric"
              className={cx(baseField, errors.citizen_id && fieldError)}
              value={form.citizen_id}
              onChange={(e) => { clearError("citizen_id"); update("citizen_id", onlyDigits(e.target.value).slice(0, 13)) }}
              onFocus={() => clearError("citizen_id")}
              placeholder="13 หลัก"
              aria-invalid={errors.citizen_id ? true : undefined}
            />
            {errors.citizen_id && <p className={errorTextCls}>{errors.citizen_id}</p>}
          </div>
          <div>
            <label className={labelCls}>โทรศัพท์</label>
            <input
              ref={refs.phone_number}
              inputMode="tel"
              className={baseField}
              value={form.phone_number}
              onChange={(e) => update("phone_number", e.target.value)}
              placeholder="เช่น 0884812314"
            />
          </div>

          {/* address */}
          <div className="md:col-span-2 grid gap-4 md:grid-cols-4">
            <div className="md:col-span-2">
              <label className={labelCls}>ที่อยู่</label>
              <input
                ref={refs.address}
                className={baseField}
                value={form.address}
                onChange={(e) => update("address", e.target.value)}
                placeholder="บ้านเลขที่/ซอย/ถนน"
              />
            </div>
            <div>
              <label className={labelCls}>หมู่</label>
              <input
                ref={refs.mhoo}
                className={baseField}
                value={form.mhoo}
                onChange={(e) => update("mhoo", e.target.value)}
                placeholder="เช่น 1"
              />
            </div>
            <div>
              <label className={labelCls}>ตำบล</label>
              <input
                ref={refs.sub_district}
                className={baseField}
                value={form.sub_district}
                onChange={(e) => update("sub_district", e.target.value)}
                placeholder="เช่น บะ"
              />
            </div>
            <div>
              <label className={labelCls}>อำเภอ</label>
              <input
                ref={refs.district}
                className={baseField}
                value={form.district}
                onChange={(e) => update("district", e.target.value)}
                placeholder="เช่น ท่าตูม"
              />
            </div>
            <div>
              <label className={labelCls}>จังหวัด</label>
              <input
                ref={refs.province}
                className={baseField}
                value={form.province}
                onChange={(e) => update("province", e.target.value)}
                placeholder="เช่น สุรินทร์"
              />
            </div>
            <div>
              <label className={labelCls}>รหัสไปรษณีย์</label>
              <input
                ref={refs.postal_code}
                inputMode="numeric"
                maxLength={5}
                className={cx(baseField, errors.postal_code && fieldError)}
                value={form.postal_code}
                onChange={(e) => { clearError("postal_code"); update("postal_code", onlyDigits(e.target.value).slice(0,5)) }}
                onFocus={() => clearError("postal_code")}
                placeholder="เช่น 32120"
                aria-invalid={errors.postal_code ? true : undefined}
              />
              {errors.postal_code && <p className={errorTextCls}>{errors.postal_code}</p>}
            </div>
          </div>

          {/* FID group */}
          <div className="md:col-span-2 grid gap-4 md:grid-cols-3">
            <div>
              <label className={labelCls}>เลขทะเบียนเกษตรกร (FID)</label>
              <input
                ref={refs.fid}
                inputMode="numeric"
                className={cx(baseField, errors.fid && fieldError)}
                value={form.fid}
                onChange={(e) => { clearError("fid"); update("fid", onlyDigits(e.target.value)) }}
                onFocus={() => clearError("fid")}
                placeholder="เช่น 320306068311"
                aria-invalid={errors.fid ? true : undefined}
              />
              {errors.fid && <p className={errorTextCls}>{errors.fid}</p>}
            </div>
            <div>
              <label className={labelCls}>ชื่อทะเบียนเกษตรกร (FID Owner)</label>
              <input
                ref={refs.fid_owner}
                className={baseField}
                value={form.fid_owner}
                onChange={(e) => update("fid_owner", e.target.value)}
                placeholder="เช่น นางโสภา ตลับทอง"
              />
            </div>
            <div>
              <label className={labelCls}>ความสัมพันธ์ (FID Relationship)</label>
              <ComboBox
                options={[
                  { value: "1", label: "ตนเอง" },
                  { value: "2", label: "คู่สมรส" },
                  { value: "3", label: "บุตร/บิดา/มารดา" },
                ]}
                value={form.fid_relationship}
                onChange={(v) => update("fid_relationship", v)}
                placeholder="— เลือกความสัมพันธ์ —"
              />
            </div>
          </div>
        </form>
      </div>
    </div>
  )
}

export default CustomerDetail
