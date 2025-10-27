// src/pages/CustomerAdd.jsx
import { useEffect, useMemo, useRef, useState, forwardRef, useImperativeHandle } from "react"
import { apiAuth } from "../lib/api"

/** ---------- Utils ---------- */
const onlyDigits = (s = "") => s.replace(/\D+/g, "")
const cx = (...a) => a.filter(Boolean).join(" ")

/** **********************************************************************
 * จังหวัดสุรินทร์: รายการอำเภอ (ครบ 17) และตำบล (ตามหน้า MemberSignup)
 * - พยายามดึงจาก API ก่อน (เช่น /geo/*) → ถ้าไม่มีใช้ fallback ด้านล่าง
 *********************************************************************** */
const PROV_SURIN = "สุรินทร์"

// ✅ ครบ 17 อำเภอ (แบบเดียวกับ MemberSignup)
const AMPHOES_SURIN = [
  "เมืองสุรินทร์","จอมพระ","ชุมพลบุรี","ท่าตูม","ปราสาท","กาบเชิง","รัตนบุรี","สนม",
  "ศีขรภูมิ","สังขะ","ลำดวน","สำโรงทาบ","โนนนารายณ์","บัวเชด","พนมดงรัก","ศรีณรงค์","เขวาสินรินทร์",
]

// ✅ Mapping ตำบลตามหน้า MemberSignup
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

/** ---------- ComboBox (เปิดแล้วไฮไลต์ตัวแรก/ค่าปัจจุบันอัตโนมัติ) ---------- */
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
      if (idx >= 0) {
        requestAnimationFrame(() => scrollHighlightedIntoView(idx))
      }
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
      e.preventDefault()
      setOpen(true)
      return
    }
    if (!open && (e.key === " " || e.key === "ArrowDown")) {
      e.preventDefault()
      setOpen(true)
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
      if (highlight >= 0 && highlight < options.length) {
        commit(options[highlight], { navigate: true })
      }
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

/** ---------- Helpers: โหลดอำเภอ/ตำบล ---------- */
const shapeOptions = (arr = [], labelKey = "name", valueKey = "id") =>
  arr.map((x, i) => {
    const v = String(x?.[valueKey] ?? x?.value ?? x?.id ?? x?.[labelKey] ?? i)
    const l = String(x?.[labelKey] ?? x?.label ?? x?.name ?? x)
    return { value: v, label: l }
  })

const dedupe = (arr) => Array.from(new Set(arr))

/** ---------- Prefix/sex helpers ---------- */
const PREFIX_OPTIONS = [
  { value: "1", label: "นาย" },
  { value: "2", label: "นาง" },
  { value: "3", label: "นางสาว" },
]
const sexFromPrefix = (pre) => (pre === "1" ? "M" : pre === "2" || pre === "3" ? "F" : "")

/** ---------- Component: CustomerAdd ---------- */
const CustomerAdd = () => {
  const [errors, setErrors] = useState({})
  const [submitting, setSubmitting] = useState(false)

  // สำหรับตัวเลือกความสัมพันธ์ FID
  const [relOpts, setRelOpts] = useState([])   // [{id, fid_relationship}]
  const [relLoading, setRelLoading] = useState(false)

  // อำเภอ/ตำบล (options เหมือน MemberSignup)
  const [amphoeOptions, setAmphoeOptions] = useState([]) // [{value,label}]
  const [tambonOptions, setTambonOptions] = useState([]) // [{value,label}]

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

  // ปุ่มของ ComboBox
  const comboBtnRefs = {
    precode: useRef(null),
    district: useRef(null),
    sub_district: useRef(null),
    fid_relationship: useRef(null),
  }

  // ฟอร์ม
  const [form, setForm] = useState({
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

  const update = (k, v) => setForm((p) => ({ ...p, [k]: v }))
  const clearError = (k) =>
    setErrors((prev) => {
      if (!(k in prev)) return prev
      const { [k]: _omit, ...rest } = prev
      return rest
    })

  // ---------- Enter Navigation ----------
  const enterOrder = [
    { key: "citizen_id", ref: refs.citizen_id },
    { key: "precode", ref: comboBtnRefs.precode },
    { key: "full_name", ref: refs.full_name },
    { key: "address", ref: refs.address },
    { key: "mhoo", ref: refs.mhoo },
    { key: "district", ref: comboBtnRefs.district },
    { key: "sub_district", ref: comboBtnRefs.sub_district },
    { key: "province", ref: refs.province },
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
    onKeyDown: (e) => {
      if (e.key === "Enter") {
        e.preventDefault()
        focusNextFromIndex(idx)
      }
    }
  })
  // ---------- END Enter Navigation ----------

  // โหลดตัวเลือก FID Relationship จาก BE
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

  // --- โหลดอำเภอ (พยายามจาก API | fallback คงที่) ---
  const loadAmphoesSurin = async () => {
    const candidates = [
      `/geo/amphoe?province=${encodeURIComponent(PROV_SURIN)}`,
      `/geo/amphoes?province_name=${encodeURIComponent(PROV_SURIN)}`,
      `/th/geo/amphoe?province=${encodeURIComponent(PROV_SURIN)}`,
      `/address/amphoe?province=${encodeURIComponent(PROV_SURIN)}`,
    ]
    let options = []
    for (const p of candidates) {
      try {
        const data = await apiAuth(p)
        if (Array.isArray(data) && data.length) {
          const tryKeys = ["name", "amphoe_name", "amphoe", "label"]
          const labelKey = tryKeys.find((k) => typeof data?.[0]?.[k] !== "undefined") || "name"
          options = shapeOptions(data, labelKey)
          break
        }
      } catch {}
    }
    if (!options.length) {
      options = AMPHOES_SURIN.map((n) => ({ value: n, label: n }))
    }
    setAmphoeOptions(options.sort((a, b) => a.label.localeCompare(b.label, "th")))
  }

  const loadTambonsByAmphoe = async (amphoeLabel) => {
    if (!amphoeLabel) { setTambonOptions([]); return }
    const candidates = [
      `/geo/tambon?province=${encodeURIComponent(PROV_SURIN)}&amphoe=${encodeURIComponent(amphoeLabel)}`,
      `/geo/tambons?province=${encodeURIComponent(PROV_SURIN)}&amphoe=${encodeURIComponent(amphoeLabel)}`,
      `/th/geo/tambon?province=${encodeURIComponent(PROV_SURIN)}&amphoe=${encodeURIComponent(amphoeLabel)}`,
      `/address/tambon?province=${encodeURIComponent(PROV_SURIN)}&amphoe=${encodeURIComponent(amphoeLabel)}`,
    ]
    let options = []
    for (const p of candidates) {
      try {
        const data = await apiAuth(p)
        if (Array.isArray(data) && data.length) {
          const tryKeys = ["name", "tambon_name", "subdistrict", "label"]
          const labelKey = tryKeys.find((k) => typeof data?.[0]?.[k] !== "undefined") || "name"
          options = shapeOptions(data, labelKey)
          break
        }
      } catch {}
    }
    if (!options.length) {
      const fall = dedupe(TAMBONS_BY_AMPHOE[amphoeLabel] || [])
      options = fall.map((n, i) => ({ value: n || String(i), label: n }))
    }
    setTambonOptions(options.sort((a, b) => a.label.localeCompare(b.label, "th")))
  }

  // mount: โหลดอำเภอ
  useEffect(() => { loadAmphoesSurin() }, [])

  // รีเซ็ตตำบล & โหลดใหม่เมื่อเปลี่ยนอำเภอ
  useEffect(() => {
    const amphoeLabel = form.district
      ? (amphoeOptions.find((o) => String(o.value) === String(form.district))?.label ?? form.district)
      : ""
    update("sub_district", "")
    loadTambonsByAmphoe(amphoeLabel)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form.district])

  /** ตรวจความถูกต้องก่อนส่งเข้า Back */
  const validateAll = () => {
    const e = {}

    const cid = onlyDigits(form.citizen_id)
    if (cid.length !== 13) e.citizen_id = "กรุณากรอกเลขบัตรประชาชน 13 หลัก"

    if (!form.precode) e.precode = "กรุณาเลือกคำนำหน้า"
    if (!form.full_name.trim()) e.full_name = "กรุณากรอกชื่อ–สกุล"
    if (!form.address.trim()) e.address = "กรุณากรอกบ้านเลขที่"

    if (!form.district) e.district = "กรุณาเลือกอำเภอ"
    if (!form.sub_district) e.sub_district = "กรุณาเลือกตำบล"

    if (!form.province.trim()) e.province = "กรุณากรอกจังหวัด"

    // 🔧 เหลือเฉพาะ postal_code ที่ต้องเป็นตัวเลข (ตัด FID ออก)
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
      sub_district: form.sub_district.trim(),
      district: form.district.trim(),
      province: form.province.trim(),
      postal_code: form.postal_code !== "" ? Number(form.postal_code) : null,
      phone_number: form.phone_number.trim() || null,
      // กลุ่ม FID (optional) — ✅ ส่งเป็นสตริงตามที่กรอก
      fid: form.fid !== "" ? String(form.fid).trim() : null,
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
                  onChange={(e) => {
                    clearError("citizen_id")
                    const digits = onlyDigits(e.target.value).slice(0, 13)
                    update("citizen_id", digits)
                  }}
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

            {/* แถวถัดไป */}
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

              {/* อำเภอ */}
              <div>
                <label className={labelCls}>อำเภอ</label>
                <div ref={refs.district}>
                  <ComboBox
                    options={amphoeOptions}
                    value={form.district}
                    onChange={(v) => { clearError("district"); update("district", v) }}
                    placeholder="— เลือกอำเภอ —"
                    error={!!errors.district}
                    buttonRef={comboBtnRefs.district}
                    onEnterNext={() => focusNextFromIndex(5)}
                  />
                </div>
                {errors.district && <p className={errorTextCls}>{errors.district}</p>}
              </div>

              {/* ตำบล */}
              <div>
                <label className={labelCls}>ตำบล</label>
                <div ref={refs.sub_district}>
                  <ComboBox
                    options={tambonOptions}
                    value={form.sub_district}
                    onChange={(v) => { clearError("sub_district"); update("sub_district", v) }}
                    placeholder={form.district ? "— เลือกตำบล —" : "เลือกอำเภอก่อน"}
                    error={!!errors.sub_district}
                    disabled={!form.district}
                    buttonRef={comboBtnRefs.sub_district}
                    onEnterNext={() => focusNextFromIndex(6)}
                  />
                </div>
                {errors.sub_district && <p className={errorTextCls}>{errors.sub_district}</p>}
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
                  placeholder="เช่น สุรินทร์"
                  aria-invalid={errors.province ? true : undefined}
                  {...bindEnter(7)}
                />
                {errors.province && <p className={errorTextCls}>{errors.province}</p>}
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

              {/* sex (คำนวณจาก precode ภายในฟอร์ม) */}
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

              {/* บล็อก FID */}
              <div className="md:col-span-3 grid gap-4 md:grid-cols-3">
                {/* fid */}
                <div>
                  <label className={labelCls}>เลขที่ทะเบียนเกษตรกร (FID)</label>
                  <input
                    ref={refs.fid}
                    // ⬇️ อนุญาตเป็นสตริง ไม่บังคับเลข
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

                {/* fid_owner */}
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

                {/* fid_relationship */}
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
