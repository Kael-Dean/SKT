// src/pages/CustomerAdd.jsx
import { useEffect, useMemo, useRef, useState, forwardRef, useImperativeHandle } from "react"
import { apiAuth } from "../lib/api"

/** ---------- Utils ---------- */
const onlyDigits = (s = "") => s.replace(/\D+/g, "")
const cx = (...a) => a.filter(Boolean).join(" ")

/** **********************************************************************
 * แหล่งข้อมูลจังหวัด/อำเภอ/ตำบล (ทั้งประเทศ)
 * - โหลดจาก /public/data/thai/{province,district,sub_district}.json
 * - ถ้าโหลดไม่ได้ → fallback เฉพาะ “สุรินทร์” เพื่อไม่ให้ฟอร์มพัง
 *********************************************************************** */
const DATA_BASE = "/data/thai" // อยู่ใต้ public (เช่น public/data/thai/province.json)

// ---------- Fallback เฉพาะสุรินทร์ ----------
const PROV_SURIN = "สุรินทร์"
const AMPHOES_SURIN = [
  "เมืองสุรินทร์","จอมพระ","ชุมพลบุรี","ท่าตูม","ปราสาท","กาบเชิง","รัตนบุรี","สนม",
  "ศีขรภูมิ","สังขะ","ลำดวน","สำโรงทาบ","โนนนารายณ์","บัวเชด","พนมดงรัก","ศรีณรงค์","เขวาสินรินทร์",
]
const TAMBONS_BY_AMPHOE = {
  "เมืองสุรินทร์":[
    "ในเมือง","สวาย","ตั้งใจ","เพี้ยราม","นาดี","ท่าสว่าง","สลักได","ตาอ็อง","สำโรง","แกใหญ่",
    "นอกเมือง","คอโค","เฉนียง","เทนมีย์","นาบัว","เมืองที","ราม","บุฤๅษี","ตระแสง","แสลงพันธ์","กาเกาะ"
  ],
  "สังขะ":[ "สังขะ","ขอนแตก","ดม","พระแก้ว","บ้านจารย์","กระเทียม","สะกาด","ตาตุม","ทับทัน","ตาคง","บ้านชบ","เทพรักษา" ],
  "ปราสาท":[
    "กังแอน","ทมอ","ทุ่งมน","ไพล","ตาเบา","หนองใหญ่","ปรือ","บ้านไทร","โคกยาง","โคกสะอาด",
    "โชคนาสาม","เชื้อเพลิง","ปราสาททนง","ตานี","บ้านพลวง","กันตวจระมวล","สมุด","ประทัดบุ"
  ],
  "รัตนบุรี":[ "รัตนบุรี","ธาตุ","แก","ดอนแรด","หนองบัวทอง","หนองบัวบาน","ไผ่","เบิด","น้ำเขียว","กุดขาคีม","ยางสว่าง","ทับใหญ่" ],
  "ท่าตูม":[ "ท่าตูม","กระโพ","พรมเทพ","โพนครก","เมืองแก","บะ","หนองบัว","บัวโคก","หนองเมธี","ทุ่งกุลา" ],
  "จอมพระ":[ "จอมพระ","เมืองลีง","กระหาด","บุแกรง","หนองสนิท","บ้านผือ","ลุ่มระวี","ชุมแสง","เป็นสุข" ],
  "สนม":[ "สนม","แคน","โพนโก","หนองระฆัง","นานวน","หัวงัว","หนองอียอ" ],
  "ศีขรภูมิ":[
    "ระแงง","ตรึม","จารพัต","ยาง","แตล","หนองบัว","คาละแมะ","หนองเหล็ก","หนองขวาว","ช่างปี่",
    "กุดหวาย","ขวาวใหญ่","นารุ่ง","ตรมไพร","ผักไหม"
  ],
  "ลำดวน":[ "ลำดวน","โชคเหนือ","ตรำดม","อู่โลก","ตระเปียงเตีย" ],
  "บัวเชด":[ "บัวเชด","สะเดา","จรัส","ตาวัง","อาโพน","สำเภาลูน" ],
  "ชุมพลบุรี":[ "ชุมพลบุรี","ไพรขลา","นาหนองไผ่","ศรีณรงค์","ยะวึก","เมืองบัว","กระเบื้อง","กระเบื้องเมืองใหม่","สระขุด","หนองเรือ" ],
  "สำโรงทาบ":[ "กระออม","เกาะแก้ว","ประดู่","ศรีสุข","สะโน","สำโรงทาบ","เสม็จ","หนองไผ่ล้อม","หนองฮะ","หมื่นศรี" ],
  "เขวาสินรินทร์":[ "เขวาสินรินทร์","บึง","ตากูก","ปราสาททอง","นาดี" ],
  "พนมดงรัก":[ "บักได","โคกกลาง","จีกแดก","ตาเมียง" ],
  "ศรีณรงค์":[ "ณรงค์","แจนแวน","ตรวจ","หนองแวง","ศรีสุข" ],
  "โนนนารายณ์":[ "หนองหลวง","คำผง","โนน","ระเวียง","หนองเทพ" ],
  "กาบเชิง":[ "กาบเชิง","คูตัน","ด่าน","แนงมุด","โคกตะเคียน","ตะเคียน" ],
}

/** ---------- Styles ---------- */
const baseField =
  "w-full rounded-2xl border border-slate-300 bg-slate-100 p-3 text-[15px] md:text-base " +
  "text-black outline-none placeholder:text-slate-500 focus:border-emerald-600 focus:ring-2 focus:ring-emerald-500/30 shadow-none " +
  "dark:border-slate-500 dark:bg-slate-700 dark:text-slate-100 dark:placeholder:text-slate-300 dark:focus:border-emerald-400 dark:focus:ring-emerald-400/30"

const fieldError = "border-red-500 ring-2 ring-red-300 focus:ring-0 focus:border-red-500"
const labelCls = "mb-1 block text-[15px] md:text-base font-medium text-slate-700 dark:text-slate-200"
const errorTextCls = "mt-1 text-sm text-red-500"

/** ---------- SectionCard ---------- */
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

/** ---------- ComboBox (ปุ่มกดแบบเดิม) ---------- */
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
    if (!open && e.key === "Enter") {
      e.preventDefault(); setOpen(true); return
    }
    if (!open && (e.key === " " || e.key === "ArrowDown")) {
      e.preventDefault(); setOpen(true); return
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
      if (highlight >= 0 && highlight < options.length) commit(options[highlight], { navigate: true })
    } else if (e.key === "Escape") {
      e.preventDefault(); setOpen(false); setHighlight(-1)
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

/** ---------- SearchComboBox (พิมพ์ค้นหา + ดรอปดาว) ---------- */
function SearchComboBox({
  options = [],
  value,
  onChange,
  placeholder = "พิมพ์เพื่อค้นหา…",
  disabled = false,
  error = false,
  inputRef = null,
  onEnterNext = null,
}) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState("")
  const [highlight, setHighlight] = useState(-1)
  const boxRef = useRef(null)
  const listRef = useRef(null)
  const internalInputRef = useRef(null)
  const controlRef = inputRef || internalInputRef

  const selected = useMemo(() => options.find((o) => String(o.value) === String(value)), [options, value])
  const selectedLabel = selected?.label ?? ""

  // sync query display with selected label
  useEffect(() => { setQuery(selectedLabel) }, [selectedLabel])

  useEffect(() => {
    const onClick = (e) => {
      if (!boxRef.current) return
      if (!boxRef.current.contains(e.target)) {
        setOpen(false)
        setHighlight(-1)
        // ถ้าปิดแล้วไม่มี selection → เคลียร์ query ทิ้ง
        if (!value) setQuery("")
      }
    }
    document.addEventListener("click", onClick)
    return () => document.removeEventListener("click", onClick)
  }, [value])

  const norm = (s) => String(s || "").toLocaleLowerCase("th")
  const filtered = useMemo(() => {
    const q = norm(query)
    if (!q) return options
    return options.filter((o) => norm(o.label).includes(q))
  }, [options, query])

  useEffect(() => {
    if (open) {
      const idx = filtered.findIndex((o) => String(o.value) === String(value))
      setHighlight(idx >= 0 ? idx : (filtered.length ? 0 : -1))
      if (idx >= 0) requestAnimationFrame(() => {
        const listEl = listRef.current
        const itemEl = listEl?.children?.[idx]
        if (listEl && itemEl) listEl.scrollTop = itemEl.offsetTop - 6
      })
    }
  }, [open, filtered, value])

  const commit = (opt, { navigate = false } = {}) => {
    onChange?.(String(opt.value), opt)
    setOpen(false)
    setHighlight(-1)
    setQuery(opt.label || "")
    requestAnimationFrame(() => {
      controlRef.current?.blur?.()
      if (navigate) onEnterNext?.()
    })
  }

  const onKeyDown = (e) => {
    if (disabled) return
    if (e.key === "ArrowDown") {
      e.preventDefault()
      setOpen(true)
      setHighlight((h) => {
        const next = h < filtered.length - 1 ? h + 1 : 0
        return filtered.length ? next : -1
      })
    } else if (e.key === "ArrowUp") {
      e.preventDefault()
      if (!open) return
      setHighlight((h) => {
        const prev = h > 0 ? h - 1 : (filtered.length ? filtered.length - 1 : -1)
        return prev
      })
    } else if (e.key === "Enter") {
      e.preventDefault()
      if (open && highlight >= 0 && highlight < filtered.length) {
        commit(filtered[highlight], { navigate: true })
      } else if (!open) {
        setOpen(true)
      } else if (filtered.length === 1) {
        commit(filtered[0], { navigate: true })
      }
    } else if (e.key === "Escape") {
      e.preventDefault(); setOpen(false); setHighlight(-1)
    }
  }

  return (
    <div className="relative" ref={boxRef}>
      <input
        type="text"
        ref={controlRef}
        disabled={disabled}
        value={query}
        onChange={(e) => { setQuery(e.target.value); setOpen(true) }}
        onFocus={() => setOpen(true)}
        onKeyDown={onKeyDown}
        placeholder={placeholder}
        className={cx(baseField, error && fieldError, disabled && "bg-slate-200 cursor-not-allowed")}
        aria-autocomplete="list"
        aria-expanded={open}
        aria-invalid={error ? true : undefined}
      />
      {/* dropdown */}
      {open && (
        <div
          ref={listRef}
          role="listbox"
          className="absolute z-20 mt-1 max-h-72 w-full overflow-auto rounded-2xl border border-slate-200 bg-white text-black shadow-lg dark:border-slate-700 dark:bg-slate-800 dark:text-white"
        >
          {filtered.length === 0 && (
            <div className="px-3 py-2 text-sm text-slate-600 dark:text-slate-300">ไม่พบจังหวัดที่ตรงเงื่อนไข</div>
          )}
          {filtered.map((opt, idx) => {
            const isActive = idx === highlight
            const isChosen = String(opt.value) === String(value)
            return (
              <button
                key={String(opt.value) || idx}
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
                {isActive && <span className="absolute left-0 top-0 h-full w-1 bg-emerald-600 dark:bg-emerald-400/70 rounded-l-xl" />}
                <span className="flex-1">{opt.label}</span>
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

  // ความสัมพันธ์ FID
  const [relOpts, setRelOpts] = useState([])
  const [relLoading, setRelLoading] = useState(false)

  // ---------- Geo data ----------
  const [geoReady, setGeoReady] = useState(false)
  const [provOptions, setProvOptions] = useState([])        // [{value: province_id, label: province_name_th}]
  const [districtOptions, setDistrictOptions] = useState([]) // [{value: district_id, label: amphoe_th}]
  const [tambonOptions, setTambonOptions] = useState([])     // [{value: subdistrict_id, label: tambon_th}]

  // index เร็วๆ
  const geoRef = useRef({
    provinces: [],   // [{id, name_th, name_en}]
    districts: [],   // [{id, name_th, name_en, province_id}]
    subs: [],        // [{id, name_th, name_en, district_id, zip_code}]
    provById: new Map(),
    amphoeByProv: new Map(),     // province_id -> [{id, name_th, ...}]
    tambonByAmphoe: new Map(),   // district_id -> [{id, name_th, ...}]
  })

  // refs อินพุต
  const refs = {
    citizen_id: useRef(null),
    precode: useRef(null),
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
    sex: useRef(null),
  }
  const submitBtnRef = useRef(null)
  const topRef = useRef(null)

  // ปุ่ม ComboBox
  const comboBtnRefs = {
    precode: useRef(null),
    district: useRef(null),
    sub_district: useRef(null),
    fid_relationship: useRef(null),
  }

  // ฟอร์ม (เก็บ id สำหรับจังหวัด/อำเภอ/ตำบล; เปลี่ยนเป็นชื่อไทยตอนส่ง)
  const [form, setForm] = useState({
    slowdown_rice: false,
    citizen_id: "",
    precode: "",
    sex: "",
    full_name: "",
    address: "",
    mhoo: "",
    sub_district: "",  // = subdistrict_id
    district: "",      // = district_id
    province: "",      // = province_id
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

  // ---------- Enter Navigation (เลื่อน “จังหวัด” มาก่อน “อำเภอ”) ----------
  const enterOrder = [
    { key: "citizen_id", ref: refs.citizen_id },
    { key: "precode", ref: comboBtnRefs.precode },
    { key: "full_name", ref: refs.full_name },
    { key: "address", ref: refs.address },
    { key: "mhoo", ref: refs.mhoo },
    { key: "province", ref: refs.province },      // ← จังหวัด มาก่อน
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
        if (el?.dataset?.comboboxBtn === "true") requestAnimationFrame(() => { el.click?.() })
      } catch {}
      break
    }
  }
  const bindEnter = (idx) => ({
    onKeyDown: (e) => {
      if (e.key === "Enter") { e.preventDefault(); focusNextFromIndex(idx) }
    }
  })

  // ---------- โหลดตัวเลือกความสัมพันธ์ FID ----------
  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        setRelLoading(true)
        const rows = await apiAuth(`/member/members/fid_relationship`)
        if (!cancelled && Array.isArray(rows)) setRelOpts(rows)
      } catch {
      } finally {
        if (!cancelled) setRelLoading(false)
      }
    })()
    return () => { cancelled = true }
  }, [])

  /** ------------------------- โหลด Geo JSON ทั้งประเทศ ------------------------- */
  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const [provRes, distRes, subRes] = await Promise.all([
          fetch(`${DATA_BASE}/province.json`),
          fetch(`${DATA_BASE}/district.json`),
          fetch(`${DATA_BASE}/sub_district.json`),
        ])
        if (!provRes.ok || !distRes.ok || !subRes.ok) throw new Error("geo files not found")
        const [provinces, districts, subs] = await Promise.all([provRes.json(), distRes.json(), subRes.json()])

        // build indexes
        const provById = new Map(provinces.map(p => [String(p.id), p]))
        const amphoeByProv = new Map()
        districts.forEach(d => {
          const key = String(d.province_id)
          if (!amphoeByProv.has(key)) amphoeByProv.set(key, [])
          amphoeByProv.get(key).push(d)
        })
        const tambonByAmphoe = new Map()
        subs.forEach(s => {
          const key = String(s.district_id)
          if (!tambonByAmphoe.has(key)) tambonByAmphoe.set(key, [])
          tambonByAmphoe.get(key).push(s)
        })

        geoRef.current = { provinces, districts, subs, provById, amphoeByProv, tambonByAmphoe }

        // province options
        const pOpts = provinces
          .map(p => ({ value: String(p.id), label: String(p.name_th || p.name) }))
          .sort((a, b) => a.label.localeCompare(b.label, "th"))

        if (!cancelled) { setProvOptions(pOpts); setGeoReady(true) }
      } catch (e) {
        // Fallback: สุรินทร์เท่านั้น
        if (!cancelled) {
          setProvOptions([{ value: "SURIN_FALLBACK", label: PROV_SURIN }])
          setGeoReady(false)
        }
      }
    })()
    return () => { cancelled = true }
  }, [])

  // เมื่อเลือก “จังหวัด” → โหลด “อำเภอ”
  const loadAmphoeOptions = (provinceIdOrFallback) => {
    if (geoReady) {
      const provId = String(provinceIdOrFallback || "")
      const amphoes = (geoRef.current.amphoeByProv.get(provId) || [])
      const opts = amphoes
        .map(d => ({ value: String(d.id), label: String(d.name_th || d.name) }))
        .sort((a, b) => a.label.localeCompare(b.label, "th"))
      setDistrictOptions(opts)
      return
    }
    // fallback (สุรินทร์)
    const opts = AMPHOES_SURIN.map(n => ({ value: n, label: n }))
      .sort((a, b) => a.label.localeCompare(b.label, "th"))
    setDistrictOptions(opts)
  }

  // เมื่อเลือก “อำเภอ” → โหลด “ตำบล”
  const loadTambonOptions = (districtIdOrName) => {
    if (geoReady) {
      const dId = String(districtIdOrName || "")
      const subs = geoRef.current.tambonByAmphoe.get(dId) || []
      const opts = subs
        .map(s => ({ value: String(s.id), label: String(s.name_th || s.name), zip: s.zip_code }))
        .sort((a, b) => a.label.localeCompare(b.label, "th"))
      setTambonOptions(opts)
      return
    }
    // fallback
    const amphoeLabel = form.district
      ? (districtOptions.find(o => String(o.value) === String(form.district))?.label ?? form.district)
      : ""
    const fall = Array.from(new Set(TAMBONS_BY_AMPHOE[amphoeLabel] || []))
    const opts = fall.map((n, i) => ({ value: n || String(i), label: n }))
      .sort((a, b) => a.label.localeCompare(b.label, "th"))
    setTambonOptions(opts)
  }

  // เปลี่ยนจังหวัด → เคลียร์อำเภอ/ตำบลและโหลดใหม่
  useEffect(() => {
    if (!form.province) { setDistrictOptions([]); setTambonOptions([]); return }
    loadAmphoeOptions(form.province)
    update("district", ""); update("sub_district", "")
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form.province])

  // เปลี่ยนอำเภอ → เคลียร์ตำบลและโหลดใหม่
  useEffect(() => {
    if (!form.district) { setTambonOptions([]); return }
    loadTambonOptions(form.district)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form.district])

  /** ช่วยแปลง id → ชื่อไทย ตอนส่ง */
  const resolveProvinceName = () => {
    if (!form.province) return ""
    if (!geoReady) return PROV_SURIN
    const p = geoRef.current.provinces.find(p => String(p.id) === String(form.province))
    return p?.name_th || ""
  }
  const resolveDistrictName = () => {
    if (!form.district) return ""
    if (!geoReady) return form.district
    const d = geoRef.current.districts.find(x => String(x.id) === String(form.district))
    return d?.name_th || ""
  }
  const resolveTambonName = () => {
    if (!form.sub_district) return ""
    if (!geoReady) return form.sub_district
    const s = geoRef.current.subs.find(x => String(x.id) === String(form.sub_district))
    return s?.name_th || ""
  }

  /** ตรวจความถูกต้องก่อนส่ง */
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
    return Object.keys(e).length === 0
  }

  const handleSubmit = async (ev) => {
    ev.preventDefault()
    if (!validateAll()) return
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
      sub_district: resolveTambonName(),
      district: resolveDistrictName(),
      province: resolveProvinceName(),
      postal_code: form.postal_code !== "" ? Number(form.postal_code) : null,
      phone_number: form.phone_number.trim() || null,

      fid: form.fid !== "" ? String(form.fid).trim() : null,
      fid_owner: form.fid_owner.trim() || null,
      fid_relationship: form.fid_relationship !== "" ? Number(form.fid_relationship) : null,
    }

    try {
      await apiAuth(`/member/customers/signup`, { method: "POST", body: payload })
      alert("✅ บันทึกข้อมูลลูกค้าทั่วไปเรียบร้อย")
      handleReset()
      requestAnimationFrame(() => {
        try { topRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }) } catch {}
      })
    } catch (err) {
      console.error(err)
      const msg =
        (err && err.detail) ||
        (typeof err?.message === "string" ? err.message : "") ||
        "บันทึกล้มเหลว กรุณาลองใหม่"
      alert(`❌ บันทึกไม่สำเร็จ\n\nสาเหตุ: ${msg}`)
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
      sub_district: "",
      district: "",
      province: "",
      postal_code: "",
      phone_number: "",
      fid: "",
      fid_owner: "",
      fid_relationship: "",
    })
    setDistrictOptions([])
    setTambonOptions([])
    requestAnimationFrame(() => {
      try { topRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }) } catch {}
    })
  }

  // แปลง relOpts -> options สำหรับ ComboBox
  const fidRelOptions = useMemo(
    () => relOpts.map((r) => ({ value: String(r.id), label: String(r.fid_relationship) })),
    [relOpts]
  )

  /** ---------- UI ---------- */
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

          {/* ฟอร์มข้อมูลลูกค้า */}
          <SectionCard title="ข้อมูลลูกค้าทั่วไป">
            {/* แถวบนสุด: 3 ช่อง */}
            <div className="grid gap-4 md:grid-cols-3">
              {/* citizen_id */}
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

              {/* precode */}
              <div>
                <label className={labelCls}>คำนำหน้า (precode)</label>
                <div ref={refs.precode}>
                  <ComboBox
                    options={[{ value: "1", label: "นาย" }, { value: "2", label: "นาง" }, { value: "3", label: "นางสาว" }]}
                    value={form.precode}
                    onChange={(v) => { clearError("precode"); update("precode", v); update("sex", v==="1"?"M":"F") }}
                    placeholder="— เลือกคำนำหน้า —"
                    error={!!errors.precode}
                    buttonRef={comboBtnRefs.precode}
                    onEnterNext={() => focusNextFromIndex(1)}
                  />
                </div>
                {errors.precode && <p className={errorTextCls}>{errors.precode}</p>}
              </div>

              {/* full_name */}
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

            {/* แถวถัดไป: ตามลำดับ จังหวัด → อำเภอ → ตำบล */}
            <div className="mt-4 grid gap-4 md:grid-cols-3">
              {/* address */}
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

              {/* mhoo */}
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

              {/* province (ค้นหาได้) */}
              <div>
                <label className={labelCls}>จังหวัด</label>
                <SearchComboBox
                  options={provOptions}
                  value={form.province}
                  onChange={(v) => { clearError("province"); update("province", v) }}
                  placeholder={provOptions.length ? "พิมพ์เพื่อค้นหาจังหวัด…" : "กำลังโหลด..."}
                  disabled={!provOptions.length}
                  error={!!errors.province}
                  inputRef={refs.province}
                  onEnterNext={() => focusNextFromIndex(5)}
                />
                {errors.province && <p className={errorTextCls}>{errors.province}</p>}
              </div>

              {/* district */}
              <div>
                <label className={labelCls}>อำเภอ</label>
                <div ref={refs.district}>
                  <ComboBox
                    options={districtOptions}
                    value={form.district}
                    onChange={(v) => { clearError("district"); update("district", v) }}
                    placeholder={form.province ? "— เลือกอำเภอ —" : "เลือกจังหวัดก่อน"}
                    error={!!errors.district}
                    disabled={!form.province}
                    buttonRef={comboBtnRefs.district}
                    onEnterNext={() => focusNextFromIndex(6)}
                  />
                </div>
                {errors.district && <p className={errorTextCls}>{errors.district}</p>}
              </div>

              {/* sub_district */}
              <div>
                <label className={labelCls}>ตำบล</label>
                <div ref={refs.sub_district}>
                  <ComboBox
                    options={tambonOptions}
                    value={form.sub_district}
                    onChange={(v, opt) => {
                      clearError("sub_district")
                      update("sub_district", v)
                      // หากมี zip_code ในชุดข้อมูล — auto fill (optional)
                      if (opt?.zip && String(form.postal_code || "") === "") {
                        update("postal_code", String(opt.zip).slice(0,5))
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

              {/* postal_code */}
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
                  {...bindEnter(9)}
                />
              </div>

              {/* sex (disabled) */}
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
                    className={baseField}
                    value={form.fid}
                    onChange={(e) => update("fid", e.target.value)}
                    placeholder="เช่น FID-001234 หรือ 123456"
                    {...bindEnter(10)}
                  />
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
                      options={relOpts.map((r) => ({ value: String(r.id), label: String(r.fid_relationship) }))}
                      value={form.fid_relationship}
                      onChange={(v) => update("fid_relationship", v)}
                      placeholder={relLoading ? "กำลังโหลด..." : "— เลือกความสัมพันธ์ —"}
                      disabled={relLoading}
                      buttonRef={comboBtnRefs.fid_relationship}
                      onEnterNext={() => focusNextFromIndex(12)}
                    />
                  </div>
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
