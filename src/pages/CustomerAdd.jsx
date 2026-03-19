// src/pages/CustomerAdd.jsx
import { useEffect, useMemo, useRef, useState, forwardRef, useImperativeHandle } from "react"
import { apiAuth } from "../lib/api"

// ✅ โหลดข้อมูลจากไฟล์ JSON ใน src (ไม่ใช้ fetch จึงไม่โดน 403)
import PROVINCES_RAW from "../data/thai/province.json"
import DISTRICTS_RAW from "../data/thai/district.json"
import SUBDISTRICTS_RAW from "../data/thai/sub_district.json"

/* -------------------------- Utilities & helpers -------------------------- */
const onlyDigits = (s = "") => s.replace(/\D+/g, "")
const cx = (...a) => a.filter(Boolean).join(" ")

// ค้น key แบบยืดหยุ่น รองรับหลายรูปแบบ dataset
const pickKey = (obj = {}, candidates = []) => {
  const lower = Object.keys(obj).reduce((acc, k) => (acc[k.toLowerCase()] = k, acc), {})
  for (const cand of candidates) {
    const k = lower[cand.toLowerCase()]
    if (k) return k
  }
  return null
}

// normalize dataset -> province/district/subdistrict พร้อม key ที่พบ
const detectProvinceKeys = (arr) => {
  const s = arr?.[0] || {}
  return {
    id: pickKey(s, ["id","province_id","changwat_id","code","PROVINCE_ID"]),
    name: pickKey(s, ["name_th","name","province_name","PROVINCE_NAME","thai_name","th","nameTH"]),
  }
}
const detectDistrictKeys = (arr) => {
  const s = arr?.[0] || {}
  return {
    id: pickKey(s, ["id","district_id","amphoe_id","AMPHOE_ID","DISTRICT_ID","code"]),
    name: pickKey(s, ["name_th","name","district_name","AMPHOE_NAME","thai_name","nameTH"]),
    provId: pickKey(s, ["province_id","changwat_id","PROVINCE_ID","CHANGWAT_ID"]),
  }
}
const detectSubdistrictKeys = (arr) => {
  const s = arr?.[0] || {}
  return {
    id: pickKey(s, ["id","sub_district_id","tambon_id","SUB_DISTRICT_ID","TAMBON_ID","code"]),
    name: pickKey(s, ["name_th","name","sub_district_name","TAMBON_NAME","thai_name","nameTH"]),
    distId: pickKey(s, ["district_id","amphoe_id","AMPHOE_ID","DISTRICT_ID","code_district"]),
    zip: pickKey(s, ["zip","zipcode","zip_code","POSTCODE"]),
  }
}

// แปลงชุดข้อมูลเป็น options ที่ ComboBox ใช้
const toOptions = (rows, labelKey, valueKey, extra = (r)=>({})) =>
  (rows || []).map((r, i) => {
    const label = String(r?.[labelKey] ?? r?.name ?? r?.label ?? r ?? "")
    const value = String(r?.[valueKey] ?? r?.id ?? label ?? i)
    return { label, value, ...extra(r) }
  })

/* ------------------------------- UI styles ------------------------------- */
const baseField =
  "w-full rounded-2xl border border-slate-300 bg-slate-100 p-3 text-[15px] md:text-base " +
  "text-black outline-none placeholder:text-slate-500 focus:border-emerald-600 focus:ring-2 focus:ring-emerald-500/30 shadow-none " +
  "dark:border-slate-500 dark:bg-slate-700 dark:text-slate-100 dark:placeholder:text-slate-300 dark:focus:border-emerald-400 dark:focus:ring-emerald-400/30"

const fieldError = "border-red-500 ring-2 ring-red-300 focus:ring-0 focus:border-red-500"
const labelCls = "mb-1 block text-[15px] md:text-base font-medium text-slate-700 dark:text-slate-200"
const errorTextCls = "mt-1 text-sm text-red-500"

/* ---------------------------- Section container --------------------------- */
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

/* --------------------------- Searchable ComboBox -------------------------- */
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
  searchable = false,
  searchPlaceholder = "พิมพ์เพื่อกรอง...",
  filter = (label, term) => label.toLowerCase().includes(term.trim().toLowerCase()),
}) {
  const [open, setOpen] = useState(false)
  const [highlight, setHighlight] = useState(-1)
  const [term, setTerm] = useState("")
  const boxRef = useRef(null)
  const listRef = useRef(null)
  const internalBtnRef = useRef(null)
  const searchRef = useRef(null)
  const controlRef = buttonRef || internalBtnRef

  const selectedLabel = useMemo(() => {
    const found = options.find((o) => String(getValue(o)) === String(value))
    return found ? getLabel(found) : ""
  }, [options, value, getLabel, getValue])

  const display = useMemo(() => {
    if (!searchable || !term) return options
    return options.filter((o) => filter(getLabel(o), term))
  }, [options, term, searchable, filter, getLabel])

  useEffect(() => {
    const onClick = (e) => {
      if (!boxRef.current) return
      if (!boxRef.current.contains(e.target)) {
        setOpen(false)
        setHighlight(-1)
        setTerm("")
      }
    }
    document.addEventListener("click", onClick)
    return () => document.removeEventListener("click", onClick)
  }, [])

  useEffect(() => {
    if (open) {
      setHighlight(display.length ? 0 : -1)
      if (searchable) {
        requestAnimationFrame(() => searchRef.current?.focus())
      } else if (display.length) {
        // โหมดไม่ค้นหา: โฟกัสลิสต์เพื่อรับคีย์บอร์ด และเลื่อนให้ไอเท็มแรกเข้าเฟรม
        requestAnimationFrame(() => {
          listRef.current?.focus()
          scrollHighlightedIntoView(0)
        })
      }
    }
  }, [open, searchable, display.length])

  const commit = (opt, { navigate = false } = {}) => {
    const v = String(getValue(opt))
    onChange?.(v, opt)
    setOpen(false)
    setHighlight(-1)
    setTerm("")
    requestAnimationFrame(() => {
      // ❌ ไม่ให้เกิดกรอบดำ: เอาโฟกัสออกจากปุ่ม แล้วค่อยไปช่องถัดไป
      controlRef.current?.blur()
      if (navigate) onEnterNext?.()
    })
  }

  const scrollHighlightedIntoView = (index, center = false) => {
    const listEl = listRef.current
    const itemEl = listEl?.children?.[searchable ? index + 1 : index] // +1 เมื่อมีช่องค้นหา
    if (!listEl || !itemEl) return

    if (center) {
      listEl.scrollTop = itemEl.offsetTop - listEl.clientHeight / 2 + itemEl.clientHeight / 2
      return
    }

    const itemRect = itemEl.getBoundingClientRect()
    const listRect = listEl.getBoundingClientRect()
    const buffer = 6
    if (itemRect.top < listRect.top + buffer) {
      listEl.scrollTop -= (listRect.top + buffer) - itemRect.top
    } else if (itemRect.bottom > listRect.bottom - buffer) {
      listEl.scrollTop += itemRect.bottom - (listRect.bottom - buffer)
    }
  }

  const onKeyDownButton = (e) => {
    if (disabled) return
    // เปิดลิสต์เมื่อกด Enter/Space/Arrow
    if (!open && (e.key === "Enter" || e.key === " " || e.key === "ArrowDown" || e.key === "ArrowUp")) {
      e.preventDefault()
      setOpen(true)
      return
    }
    // ลิสต์เปิดและไม่ค้นหา: ส่งต่อคีย์ไปที่ลิสต์
    if (open && !searchable && ["ArrowDown","ArrowUp","Home","End","Enter","Escape"].includes(e.key)) {
      e.preventDefault()
      handleListKeyDown(e)
    }
  }

  const onKeyDownSearch = (e) => {
    if (e.key === "ArrowDown") {
      e.preventDefault()
      setHighlight((h) => {
        const next = h < display.length - 1 ? h + 1 : 0
        requestAnimationFrame(() => scrollHighlightedIntoView(next))
        return next
      })
    } else if (e.key === "ArrowUp") {
      e.preventDefault()
      setHighlight((h) => {
        const prev = h > 0 ? h - 1 : display.length - 1
        requestAnimationFrame(() => scrollHighlightedIntoView(prev))
        return prev
      })
    } else if (e.key === "Enter") {
      e.preventDefault()
      if (highlight >= 0 && highlight < display.length) {
        commit(display[highlight], { navigate: true })
      }
    } else if (e.key === "Escape") {
      e.preventDefault()
      setOpen(false)
      setTerm("")
      setHighlight(-1)
      requestAnimationFrame(() => controlRef.current?.blur()) // ❌ ตัดกรอบดำ
    }
  }

  // ⌨️ โหมดไม่ค้นหา: รองรับลูกศร/Enter/Escape บนลิสต์
  const handleListKeyDown = (e) => {
    if (!open) return
    if (e.key === "ArrowDown") {
      setHighlight((h) => {
        const next = h < display.length - 1 ? h + 1 : 0
        requestAnimationFrame(() => scrollHighlightedIntoView(next))
        return next
      })
    } else if (e.key === "ArrowUp") {
      setHighlight((h) => {
        const prev = h > 0 ? h - 1 : display.length - 1
        requestAnimationFrame(() => scrollHighlightedIntoView(prev))
        return prev
      })
    } else if (e.key === "Home") {
      setHighlight(() => {
        const next = display.length ? 0 : -1
        requestAnimationFrame(() => next >= 0 && scrollHighlightedIntoView(next))
        return next
      })
    } else if (e.key === "End") {
      setHighlight(() => {
        const next = display.length ? display.length - 1 : -1
        requestAnimationFrame(() => next >= 0 && scrollHighlightedIntoView(next))
        return next
      })
    } else if (e.key === "Enter") {
      if (highlight >= 0 && highlight < display.length) {
        commit(display[highlight], { navigate: true })
      }
    } else if (e.key === "Escape") {
      setOpen(false)
      setTerm("")
      setHighlight(-1)
      requestAnimationFrame(() => controlRef.current?.blur()) // ❌ ตัดกรอบดำ
    }
  }

  return (
    <div className="relative" ref={boxRef}>
      {/* กันกรอบ focus ทุกชิ้นส่วนของคอมโบ */}
      <style>{`
        [data-combobox-btn]:focus, [data-combobox-btn]:focus-visible { outline: none !important; }
        [data-combobox-panel]:focus, [data-combobox-panel]:focus-visible { outline: none !important; box-shadow: none !important; }
        [data-combobox-option]:focus, [data-combobox-option]:focus-visible { outline: none !important; }
      `}</style>

      <button
        type="button"
        ref={controlRef}
        disabled={disabled}
        onClick={() => { if (!disabled) setOpen((o) => !o) }}
        onKeyDown={onKeyDownButton}
        data-combobox-btn="true"
        className={cx(
          "w-full rounded-2xl border p-3 text-left text-[15px] md:text-base outline-none focus:outline-none focus-visible:outline-none transition shadow-none",
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
          tabIndex={0}                 // ทำให้รับคีย์บอร์ดได้
          onKeyDown={!searchable ? handleListKeyDown : undefined}
          data-combobox-panel="true"
          className="absolute z-20 mt-1 max-h-72 w-full overflow-auto rounded-2xl border border-slate-200 bg-white text-black shadow-lg dark:border-slate-700 dark:bg-slate-800 dark:text-white outline-none focus:outline-none focus:ring-0 ring-0"
        >
          {searchable && (
            <div className="sticky top-0 z-10 bg-white/95 dark:bg-slate-800/95 backdrop-blur px-3 py-2 border-b border-slate-100 dark:border-slate-700">
              <input
                ref={searchRef}
                value={term}
                onChange={(e) => { setTerm(e.target.value); setHighlight(0) }}
                onKeyDown={onKeyDownSearch}
                placeholder={searchPlaceholder}
                className="w-full rounded-xl border border-slate-300 bg-slate-50 px-3 py-2 text-[15px] outline-none focus:outline-none focus-visible:outline-none focus:ring-2 focus:ring-emerald-500/30 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-100"
              />
            </div>
          )}

          {display.length === 0 && (
            <div className="px-3 py-2 text-sm text-slate-600 dark:text-slate-300">ไม่มีตัวเลือก</div>
          )}
          {display.map((opt, idx) => {
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
                data-combobox-option="true"
                className={cx(
                  "relative flex w-full items-center gap-2 px-3 py-2.5 text-left text-[15px] md:text-base transition rounded-xl cursor-pointer outline-none focus:outline-none focus-visible:outline-none",
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

/* -------------------------------- DateInput ------------------------------- */
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

  // เก็บ id ที่เลือกไว้ใช้กรองขั้นต่อไป
  const [selectedProvinceId, setSelectedProvinceId] = useState(null)
  const [selectedDistrictId, setSelectedDistrictId] = useState(null)

  // dataset keys ที่ตรวจจับได้
  const PROV_K = useMemo(() => detectProvinceKeys(PROVINCES_RAW), [])
  const DIST_K = useMemo(() => detectDistrictKeys(DISTRICTS_RAW), [])
  const SUBD_K = useMemo(() => detectSubdistrictKeys(SUBDISTRICTS_RAW), [])

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

  const update = (k, v) => setForm((p) => ({ ...p, [k]: v }))
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
  }, [])

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
    if (cid.length !== 13) e.citizen_id = "กรุณากรอกเลขบัตรประชาชน 13 หลัก"

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
      alert("❌❌❌❌❌❌❌❌❌ บันทึกไม่สำเร็จ ❌❌❌❌❌❌❌❌❌\n\n                   รบกวนกรอกข้อมูลที่จำเป็นให้ครบในช่องที่มีกรอบสีแดง")
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
      citizen_id: onlyDigits(form.citizen_id),
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
      alert("✅✅✅✅✅✅ บันทึกสมัครลูกค้าทั้วไปเรียบร้อย ✅✅✅✅✅✅")
      handleReset()
      requestAnimationFrame(() => scrollToPageTop())
      try { submitBtnRef.current?.blur?.() } catch {}
    } catch (err) {
      console.error(err)
      const msg =
        (err && err.detail) ||
        (typeof err?.message === "string" ? err.message : "") ||
        "บันทึกล้มเหลว กรุณาลองใหม่"
      alert(`❌❌❌❌❌❌❌❌❌ บันทึกไม่สำเร็จ ❌❌❌❌❌❌❌❌❌

สาเหตุ: ${msg}`)
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
      <div className="mx-auto max-w-7xl p-5 md:p-6 lg:p-8">
        <h1 ref={topRef} tabIndex={-1} className="mb-4 text-3xl font-bold text-gray-900 dark:text-white">
          👤 เพิ่มลูกค้าทั่วไป
        </h1>

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

          {/* แบบฟอร์มหลัก */}
          <SectionCard title="ข้อมูลลูกค้าทั่วไป">
            {/* แถวบนสุด */}
            <div className="grid gap-4 md:grid-cols-3">
              <div>
                <label className={labelCls}>เลขที่บัตรประชาชน (13 หลัก)</label>
                <input
                  ref={refs.citizen_id}
                  inputMode="numeric"
                  maxLength={13}
                  className={cx(baseField, errors.citizen_id && fieldError)}
                  value={form.citizen_id}
                  onChange={(e) => { clearError("citizen_id"); update("citizen_id", onlyDigits(e.target.value).slice(0,13)) }}
                  onFocus={() => clearError("citizen_id")}
                  placeholder="เช่น 1234567890123"
                  aria-invalid={errors.citizen_id ? true : undefined}
                  {...bindEnter(0)}
                />
                {errors.citizen_id && <p className={errorTextCls}>{errors.citizen_id}</p>}
              </div>

              <div>
                <label className={labelCls}>คำนำหน้า (precode)</label>
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
                  onFocus={() => clearError("full_name")}
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
                  onFocus={() => clearError("address")}
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
                  onFocus={() => clearError("postal_code")}
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
                    options={[{ value: "M", label: "ชาย (M)" }, { value: "F", label: "หญิง (F)" }]}
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
                  <label className={labelCls}>เลขที่ทะเบียนเกษตรกร (FID)</label>
                  <input
                    ref={refs.fid}
                    className={cx(baseField, errors.fid && fieldError)}
                    value={form.fid}
                    onChange={(e) => { clearError("fid"); update("fid", e.target.value) }}
                    onFocus={() => clearError("fid")}
                    placeholder="เช่น FID-001234 หรือ 123456"
                    aria-invalid={errors.fid ? true : undefined}
                    {...bindEnter(10)}
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
                    placeholder="เช่น นายสมหมาย นามดี"
                    {...bindEnter(11)}
                  />
                </div>

                <div>
                  <label className={labelCls}>ความสัมพันธ์ (FID Relationship)</label>
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
