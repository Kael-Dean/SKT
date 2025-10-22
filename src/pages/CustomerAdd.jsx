// src/pages/CustomerAdd.jsx
import { useEffect, useMemo, useRef, useState, forwardRef, useImperativeHandle } from "react"
import { apiAuth } from "../lib/api"

/** ---------- Utils ---------- */
const onlyDigits = (s = "") => s.replace(/\D+/g, "")
const cx = (...a) => a.filter(Boolean).join(" ")

// Thai citizen ID validator (keep from original)
function validateThaiCitizenId(id) {
  const cid = onlyDigits(id)
  if (cid.length !== 13) return false
  let sum = 0
  for (let i = 0; i < 12; i++) sum += Number(cid[i]) * (13 - i)
  const check = (11 - (sum % 11)) % 10
  return check === Number(cid[12])
}

// debounce
function useDebounce(value, delay = 400) {
  const [debounced, setDebounced] = useState(value)
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delay)
    return () => clearTimeout(t)
  }, [value, delay])
  return debounced
}

/** **********************************************************************
 * จังหวัดสุรินทร์ (เหมือนหน้า Signup): รายการอำเภอ (17) + ตำบลต่ออำเภอ
 * - พยายามโหลดจาก API ก่อน (เช่น /geo/*) ถ้าไม่มีใช้ fallback ด้านล่าง
 *********************************************************************** */
const PROV_SURIN = "สุรินทร์"
const AMPHOES_SURIN = [
  "เมืองสุรินทร์","จอมพระ","ชุมพลบุรี","ท่าตูม","ปราสาท","กาบเชิง","รัตนบุรี","สนม","ศีขรภูมิ",
  "สังขะ","ลำดวน","สำโรงทาบ","โนนนารายณ์","บัวเชด","พนมดงรัก","ศรีณรงค์","เขวาสินรินทร์",
]
const TAMBONS_BY_AMPHOE = {
  "เมืองสุรินทร์": [
    "ในเมือง","สวาย","ตั้งใจ","เพี้ยราม","นาดี","ท่าสว่าง","สลักได","ตาอ็อง","สำโรง","แกใหญ่",
    "นอกเมือง","คอโค","เฉนียง","เทนมีย์","นาบัว","เมืองที","ราม","บุฤๅษี","ตระแสง","แสลงพันธ์","กาเกาะ"
  ],
  "สังขะ": [
    "สังขะ","ขอนแตก","ดม","พระแก้ว","บ้านจารย์","กระเทียม","สะกาด","ตาตุม","ทับทัน","ตาคง","บ้านชบ","เทพรักษา"
  ],
  "ปราสาท": [
    "กังแอน","ทมอ","ทุ่งมน","ไพล","ตาเบา","หนองใหญ่","ปรือ","บ้านไทร","โคกยาง","โคกสะอาด",
    "โชคนาสาม","เชื้อเพลิง","ปราสาททนง","ตานี","บ้านพลวง","กันตวจระมวล","สมุด","ประทัดบุ"
  ],
  "รัตนบุรี": [
    "รัตนบุรี","ธาตุ","แก","ดอนแรด","หนองบัวทอง","หนองบัวบาน","ไผ่","เบิด","น้ำเขียว","กุดขาคีม","ยางสว่าง","ทับใหญ่"
  ],
  "ท่าตูม": [
    "ท่าตูม","กระโพ","พรมเทพ","โพนครก","เมืองแก","บะ","หนองบัว","บัวโคก","หนองเมธี","ทุ่งกุลา"
  ],
  "จอมพระ": [
    "จอมพระ","เมืองลีง","กระหาด","บุแกรง","หนองสนิท","บ้านผือ","ลุ่มระวี","ชุมแสง","เป็นสุข"
  ],
  "สนม": [
    "สนม","แคน","โพนโก","หนองระฆัง","นานวน","หัวงัว","หนองอียอ"
  ],
  "ศีขรภูมิ": [
    "ระแงง","ตรึม","จารพัต","ยาง","แตล","หนองบัว","คาละแมะ","หนองเหล็ก","หนองขวาว","ช่างปี่",
    "กุดหวาย","ขวาวใหญ่","นารุ่ง","ตรมไพร","ผักไหม"
  ],
  "ลำดวน": [
    "ลำดวน","โชคเหนือ","ตรำดม","อู่โลก","ตระเปียงเตีย"
  ],
  "บัวเชด": [
    "บัวเชด","สะเดา","จรัส","ตาวัง","อาโพน","สำเภาลูน"
  ],
  "ชุมพลบุรี": [
    "ชุมพลบุรี","ไพรขลา","นาหนองไผ่","ศรีณรงค์","ยะวึก","เมืองบัว"
  ],
  "สำโรงทาบ": [
    "ชุมพลบุรี","ไพรขลา","นาหนองไผ่","ศรีณรงค์","ยะวึก","เมืองบัว"
  ],
  "เขวาสินรินทร์": [
    "เขวาสินรินทร์","บึง","ตากูก","ปราสาททอง","นาดี"
  ],
  "พนมดงรัก": [
    "บักได","โคกกลาง","จีกแดก","ตาเมียง"
  ],
  "ศรีณรงค์": [
    "ณรงค์","แจนแวน","ตรวจ","หนองแวง","ศรีสุข"
  ],
  "โนนนารายณ์": [
    "หนองหลวง","คำผง","โนน","ระเวียง","หนองเทพ"
  ],
  "กาบเชิง": [
    "กาบเชิง","คูตัน","ด่าน","แนงมุด","โคกตะเคียน","ตะเคียน"
  ],
}

/** ---------- Styles (match Signup) ---------- */
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

/** ---------- ComboBox (same behavior/look as Signup) ---------- */
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
        onClick={() => { if (!disabled) setOpen((o) => !o) }}
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

/** ---------- DateInput (keep) ---------- */
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

  // FID relationship options
  const [relOpts, setRelOpts] = useState([])         // [{id, fid_relationship}]
  const [relLoading, setRelLoading] = useState(false)

  // จังหวัด/อำเภอ/ตำบล options (เหมือน Signup)
  const [amphoeOptions, setAmphoeOptions] = useState([]) // {value,label}
  const [tambonOptions, setTambonOptions] = useState([]) // {value,label}

  // refs เพื่อเลื่อนโฟกัสไปยัง error ตัวแรก
  const refs = {
    citizen_id: useRef(null),
    full_name: useRef(null),
    address: useRef(null),
    mhoo: useRef(null),
    district: useRef(null),     // อำเภอ
    sub_district: useRef(null), // ตำบล
    province: useRef(null),
    postal_code: useRef(null),
    phone_number: useRef(null),
    fid: useRef(null),
    fid_owner: useRef(null),
    fid_relationship: useRef(null),
  }
  const topRef = useRef(null)

  // ฟอร์ม
  const [form, setForm] = useState({
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

  const update = (k, v) => setForm((p) => ({ ...p, [k]: v }))
  const clearError = (k) =>
    setErrors((prev) => {
      if (!(k in prev)) return prev
      const { [k]: _omit, ...rest } = prev
      return rest
    })

  /** ---------- Load FID Relationship ---------- */
  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        setRelLoading(true)
        const rows = await apiAuth(`/member/members/fid_relationship`)
        if (!cancelled && Array.isArray(rows)) {
          setRelOpts(rows)
        }
      } catch {} finally {
        if (!cancelled) setRelLoading(false)
      }
    })()
    return () => { cancelled = true }
  }, [])

  /** ---------- Address autofill via member search (same as original) ---------- */
  const debCid = useDebounce(form.citizen_id, 400)
  const debName = useDebounce(form.full_name, 400)

  const fetchMemberSearch = async (q) => {
    try {
      const arr = await apiAuth(`/member/members/search?q=${encodeURIComponent(q)}`)
      return Array.isArray(arr) ? arr : []
    } catch { return [] }
  }

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
    setForm((prev) => ({
      ...prev,
      full_name: prev.full_name || full,
      address: prev.address || addr.address,
      mhoo: prev.mhoo || addr.mhoo,
      // อำเภอ/ตำบล ให้ผู้ใช้เลือกเองจากดรอปดาวใหม่
      province: prev.province || addr.province,
      postal_code: prev.postal_code || addr.postal_code,
      phone_number: prev.phone_number || addr.phone_number,
      fid: prev.fid || addr.fid,
      fid_owner: prev.fid_owner || addr.fid_owner,
      fid_relationship: prev.fid_relationship || addr.fid_relationship,
    }))
  }

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

  useEffect(() => {
    const q = (debName || "").trim()
    if (submitting) return
    if (q.length < 2) return
    let cancelled = false
    ;(async () => {
      setStatus({ searching: true, message: "กำลังค้นหาจากชื่อ–สกุลในฐานสมาชิก...", tone: "muted" })
      const list = await fetchMemberSearch(q)
      if (cancelled) return
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

  /** ---------- Amphoe/Tambon loader (like Signup) ---------- */
  const shapeOptions = (arr = [], labelKey = "name", valueKey = "id") =>
    arr.map((x, i) => {
      const v = String(x?.[valueKey] ?? x?.value ?? x?.id ?? x?.[labelKey] ?? i)
      const l = String(x?.[labelKey] ?? x?.label ?? x?.name ?? x)
      return { value: v, label: l }
    })
  const dedupe = (arr) => Array.from(new Set(arr))

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

  // init
  useEffect(() => {
    loadAmphoesSurin()
  }, [])

  // when district changed -> reset + load tambons
  useEffect(() => {
    const amphoeLabel = form.district
      ? (amphoeOptions.find((o) => String(o.value) === String(form.district))?.label ?? form.district)
      : ""
    setForm((prev) => ({ ...prev, sub_district: "" }))
    clearError("district")
    clearError("sub_district")
    loadTambonsByAmphoe(amphoeLabel)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form.district])

  /** ---------- Validation ---------- */
  const validateAll = () => {
    const e = {}
    const cid = onlyDigits(form.citizen_id)
    if (cid.length !== 13) e.citizen_id = "กรุณากรอกเลขบัตรประชาชน 13 หลัก"
    if (!form.full_name.trim()) e.full_name = "กรุณากรอกชื่อ–สกุล"
    if (!form.address.trim()) e.address = "กรุณากรอกบ้านเลขที่"
    if (!form.district) e.district = "กรุณาเลือกอำเภอ"
    if (!form.sub_district) e.sub_district = "กรุณาเลือกตำบล"
    if (!form.province.trim()) e.province = "กรุณากรอกจังหวัด"
    ;["postal_code","fid"].forEach((k) => {
      if (form[k] !== "" && isNaN(Number(form[k]))) e[k] = "ต้องเป็นตัวเลข"
    })
    setErrors(e)
    return Object.keys(e).length === 0
  }

  // เลื่อนไป error แรก
  useEffect(() => {
    const order = [
      "citizen_id","full_name","address","mhoo","district","sub_district","province","postal_code",
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
  }, [errors])

  /** ---------- Helpers ---------- */
  const splitName = (full = "") => {
    const parts = full.trim().split(/\s+/).filter(Boolean)
    if (parts.length === 0) return { first_name: "", last_name: "" }
    if (parts.length === 1) return { first_name: parts[0], last_name: "" }
    return { first_name: parts[0], last_name: parts.slice(1).join(" ") }
  }

  /** ---------- Submit ---------- */
  const handleSubmit = async (ev) => {
    ev.preventDefault()
    if (!validateAll()) return
    setSubmitting(true)
    const { first_name, last_name } = splitName(form.full_name)
    const payload = {
      first_name,
      last_name,
      citizen_id: onlyDigits(form.citizen_id),
      address: form.address.trim(),
      mhoo: (form.mhoo ?? "").toString().trim() || "",
      sub_district: form.sub_district.trim(),
      district: form.district.trim(),
      province: form.province.trim(),
      postal_code: form.postal_code !== "" ? Number(form.postal_code) : null,
      phone_number: form.phone_number.trim() || null,
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
                />
                {errors.citizen_id && <p className={errorTextCls}>{errors.citizen_id}</p>}
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

            {/* แถวถัดไป: 3 คอลัมน์ทุกบรรทัด */}
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

              {/* ✅ อำเภอ (SWAPPED to appear before ตำบล) */}
              <div>
                <label className={labelCls}>อำเภอ</label>
                <div ref={refs.district}>
                  <ComboBox
                    options={amphoeOptions}
                    value={form.district}
                    onChange={(v) => { clearError("district"); update("district", v) }}
                    placeholder="— เลือกอำเภอ —"
                    error={!!errors.district}
                  />
                </div>
                {errors.district && <p className={errorTextCls}>{errors.district}</p>}
              </div>

              {/* ✅ ตำบล (ตามอำเภอที่เลือก) — moved to after district */}
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
                  onChange={(e) => { clearError("postal_code"); update("postal_code", onlyDigits(e.target.value).slice(0,5)) }}
                  onFocus={() => clearError("postal_code")}
                  placeholder="เช่น 32000"
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
                  placeholder="เช่น 08x-xxx-xxxx"
                />
              </div>

              {/* บล็อก FID */}
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

                {/* fid_relationship (from BE) */}
                <div>
                  <label className={labelCls}>ความสัมพันธ์ (FID Relationship)</label>
                  <select
                    ref={refs.fid_relationship}
                    className={cx(baseField, errors.fid_relationship && fieldError)}
                    value={form.fid_relationship}
                    onChange={(e) => { clearError("fid_relationship"); update("fid_relationship", e.target.value) }}
                    onFocus={() => clearError("fid_relationship")}
                    disabled={relLoading}
                  >
                    <option value="">{relLoading ? "กำลังโหลด..." : "— เลือกความสัมพันธ์ —"}</option>
                    {relOpts.map((r) => (
                      <option key={r.id} value={r.id}>{r.fid_relationship}</option>
                    ))}
                  </select>
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
