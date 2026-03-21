// src/pages/MemberSignup.jsx
import { useEffect, useMemo, useRef, useState, forwardRef, useImperativeHandle } from "react"
import { apiAuth } from "../lib/api"   // ✅ แนบ token อัตโนมัติ + จัดการ 401
import { cx, baseField, labelCls, helpTextCls, errorTextCls } from "../lib/styles"

/** ---------- Utils ---------- */
const onlyDigits = (s = "") => s.replace(/\D+/g, "")
const toNumber = (v) => (v === "" || v === null || v === undefined ? 0 : Number(v))

// ตรวจเลขบัตร ปชช.ไทย (13 หลัก)
function validateThaiCitizenId(id) {
  const cid = onlyDigits(id)
  return cid.length === 13
}

// จำกัดช่วงค่า งาน/วา
const clampNgan = (v) => {
  const n = toNumber(onlyDigits(v))
  return Math.max(0, Math.min(3, n))
}
const clampWa = (v) => {
  const n = toNumber(onlyDigits(v))
  return Math.max(0, Math.min(99, n))
}

// จำกัดทศนิยมไม่เกิน 3 ตำแหน่ง
const toDecimal3 = (s = "") => {
  const cleaned = (s + "").replace(/[^\d.]/g, "")
  const [i = "", d = ""] = cleaned.split(".")
  const dec = d ? d.slice(0, 3) : ""
  return dec ? `${i}.${dec}` : i
}

// รูปแบบตัวเลขไว้โชว์ใน Modal
const n2 = (x) => {
  const n = Number(x)
  return Number.isFinite(n)
    ? n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })
    : "0.00"
}
const n3 = (x) => {
  const n = Number(x)
  return Number.isFinite(n)
    ? n.toLocaleString(undefined, { minimumFractionDigits: 3, maximumFractionDigits: 3 })
    : "0.000"
}

/** ---------- Enter-to-next helpers ---------- */
// ตรวจว่า element โฟกัสได้จริง
const isEnabledInput = (el) => {
  if (!el) return false
  if (typeof el.disabled !== "undefined" && el.disabled) return false
  const style = window.getComputedStyle?.(el)
  if (style && (style.display === "none" || style.visibility === "hidden")) return false
  if (!el.offsetParent && el.type !== "hidden" && el.getAttribute?.("role") !== "combobox") return false
  return true
}

/** Hook map ลำดับโฟกัสเมื่อกด Enter (ลำดับตามที่ผู้ใช้กำหนด) */
const useEnterNavigation = (refs) => {
  const order = [
    "member_id",
    "precode",
    "first_name",
    "last_name",
    "citizen_id",
    "spouce_name",
    "address",
    "mhoo",
    "district",
    "sub_district",
    "subprov",
    "postal_code",
    "phone_number",

    // ⬇️ ช่องการเงินที่ยังใช้งาน
    "tgs_group",
    "bank_account",
    "tgs_id",

    // ⬇️ ซื้อหุ้น (ไม่มีปุ่มซื้อแล้ว)
    "buy_amount",
    "buy_date",

    // เกษตร
    "fid",
    "fid_owner",
    "agri_type",
    "fertilizing_period",
    "fertilizer_type",

    "submitBtn", // → ปุ่มบันทึก
  ]

  const list = order.filter((k) => refs?.[k]?.current && isEnabledInput(refs[k].current))

  const focusNext = (currentKey) => {
    const i = list.indexOf(currentKey)
    const nextKey = i >= 0 && i < list.length - 1 ? list[i + 1] : null
    if (!nextKey) return
    const el = refs[nextKey]?.current
    if (!el) return
    try { el.scrollIntoView({ block: "center", behavior: "smooth" }) } catch {}
    el.focus?.()
    try { el.select?.() } catch {}
  }

  const onEnter = (currentKey) => (e) => {
    if (e.key === "Enter" && !e.isComposing) {
      const isTextArea = e.currentTarget?.tagName?.toLowerCase() === "textarea"
      if (isTextArea && e.shiftKey) return
      e.preventDefault()
      focusNext(currentKey)
    }
  }

  return { onEnter, focusNext }
}

/** ---------- สไตล์ ---------- */
const fieldError = "border-red-500 ring-2 ring-red-300 focus:ring-0 focus:border-red-500"
const fieldDisabled =
  "bg-slate-200 text-slate-600 cursor-not-allowed opacity-95 dark:bg-slate-700/70 dark:text-slate-300"

/** **********************************************************************
 * จังหวัดสุรินทร์: รายการอำเภอ (ครบ 17) และตำบล (ตามที่ผู้ใช้ส่งมา)
 * ใช้ข้อมูล local เพื่อตัด 404 จาก /geo/*
 *********************************************************************** */
const PROV_SURIN = "สุรินทร์"

// ✅ ครบ 17 อำเภอของจังหวัดสุรินทร์
const AMPHOES_SURIN = [
  "เมืองสุรินทร์","จอมพระ","ชุมพลบุรี","ท่าตูม","ปราสาท","กาบเชิง","รัตนบุรี","สนม","ศีขรภูมิ","สังขะ","ลำดวน","สำโรงทาบ","โนนนารายณ์","บัวเชด","พนมดงรัก","ศรีณรงค์","เขวาสินรินทร์",
]

// ✅ ตำบลตามที่ส่งมา (ลบตัวซ้ำ/ปรับสะกดเล็กน้อย)
const TAMBONS_BY_AMPHOE = {
  "เมืองสุรินทร์": [
    "ในเมือง","สวาย","ตั้งใจ","เพี้ยราม","นาดี","ท่าสว่าง","สลักได","ตาอ็อง","สำโรง","แกใหญ่",
    "นอกเมือง","คอโค","เฉนียง","เทนมีย์","นาบัว","เมืองที","ราม","บุฤๅษี","ตระแสง","แสลงพันธ์","กาเกาะ"
  ],
  "สังขะ": ["สังขะ","ขอนแตก","ดม","พระแก้ว","บ้านจารย์","กระเทียม","สะกาด","ตาตุม","ทับทัน","ตาคง","บ้านชบ","เทพรักษา"],
  "ปราสาท": [
    "กังแอน","ทมอ","ทุ่งมน","ไพล","ตาเบา","หนองใหญ่","ปรือ","บ้านไทร","โคกยาง","โคกสะอาด",
    "โชคนาสาม","เชื้อเพลิง","ปราสาททนง","ตานี","บ้านพลวง","กันตวจระมวล","สมุด","ประทัดบุ"
  ],
  "รัตนบุรี": ["รัตนบุรี","ธาตุ","แก","ดอนแรด","หนองบัวทอง","หนองบัวบาน","ไผ่","เบิด","น้ำเขียว","กุดขาคีม","ยางสว่าง","ทับใหญ่"],
  "ท่าตูม": ["ท่าตูม","กระโพ","พรมเทพ","โพนครก","เมืองแก","บะ","หนองบัว","บัวโคก","หนองเมธี","ทุ่งกุลา"],
  "จอมพระ": ["จอมพระ","เมืองลีง","กระหาด","บุแกรง","หนองสนิท","บ้านผือ","ลุ่มระวี","ชุมแสง","เป็นสุข"],
  "สนม": ["สนม","แคน","โพนโก","หนองระฆัง","นานวน","หัวงัว","หนองอียอ"],
  "ศีขรภูมิ": [
    "ระแงง","ตรึม","จารพัต","ยาง","แตล","หนองบัว","คาละแมะ","หนองเหล็ก","หนองขวาว","ช่างปี่",
    "กุดหวาย","ขวาวใหญ่","นารุ่ง","ตรมไพร","ผักไหม"
  ],
  "ลำดวน": ["ลำดวน","โชคเหนือ","ตรำดม","อู่โลก","ตระเปียงเตีย"],
  "บัวเชด": ["บัวเชด","สะเดา","จรัส","ตาวัง","อาโพน","สำเภาลูน"],
  "ชุมพลบุรี": ["ชุมพลบุรี","ไพรขลา","นาหนองไผ่","ศรีณรงค์","ยะวึก","เมืองบัว" ,"กระเบื้อง","กระเบื้องเมืองใหม่","สระขุด","หนองเรือ"],
  "สำโรงทาบ": ["กระออม","เกาะแก้ว","ประดู่","ศรีสุข","สะโน","สำโรงทาบ","เสม็จ","หนองไผ่ล้อม","หนองฮะ","หมื่นศรี"],
  "เขวาสินรินทร์": ["เขวาสินรินทร์","บึง","ตากูก","ปราสาททอง","นาดี"],
  "พนมดงรัก": ["บักได","โคกกลาง","จีกแดก","ตาเมียง"],
  "ศรีณรงค์": ["ณรงค์","แจนแวน","ตรวจ","หนองแวง","ศรีสุข"],
  "โนนนารายณ์": ["หนองหลวง","คำผง","โนน","ระเวียง","หนองเทพ"],
  "กาบเชิง": ["กาบเชิง","คูตัน","ด่าน","แนงมุด","โคกตะเคียน","ตะเคียน"],
}

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
  onEnterNext,
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
    requestAnimationFrame(() => {
      controlRef.current?.focus()
      onEnterNext?.()
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

/** ---------- Receipt Modal ---------- */
function ReceiptModal({ open, onClose, receipt, name }) {
  if (!open) return null
  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-lg rounded-2xl border border-slate-200 bg-white p-6 text-black shadow-xl dark:border-slate-700 dark:bg-slate-800 dark:text-white">
        <h3 className="text-xl font-semibold mb-2">บันทึกสำเร็จ & ใบเสร็จซื้อหุ้น</h3>
        <p className="text-slate-700 dark:text-slate-300 mb-4">
          <span className="font-medium">ชื่อสมาชิก:</span> {name || "-"}
        </p>

        <div className="rounded-xl bg-slate-50 p-4 text-slate-800 dark:bg-slate-700/40 dark:text-slate-100">
          <div className="flex justify-between py-1">
            <span>มูลค่าที่ซื้อ</span>
            <span className="font-semibold">{n3(receipt?.value_bought)} บาท</span>
          </div>
          <div className="flex justify-between py-1">
            <span>ค่าธรรมเนียม</span>
            <span className="font-semibold">{n2(receipt?.fee)} บาท</span>
          </div>
          <div className="flex justify-between py-1">
            <span>รวมชำระ</span>
            <span className="font-semibold">{n2(receipt?.total_due)} บาท</span>
          </div>
          <div className="flex justify-between py-1">
            <span>ยอดรวมหุ้นสะสมหลังซื้อ</span>
            <span className="font-semibold">{n3(receipt?.total_share_after)} บาท</span>
          </div>
          <div className="mt-2 text-sm text-slate-600 dark:text-slate-300">
            วันที่ซื้อ: {receipt?.buy_date || "-"} | รหัสสมาชิกในระบบ: {receipt?.tgs_id || "-"}
          </div>
        </div>

        <div className="mt-5 flex justify-end gap-2">
          <button
            type="button"
            onClick={() => window.print()}
            className="inline-flex items-center justify-center rounded-2xl 
                       border border-indigo-300 bg-white px-5 py-2.5 text-sm font-semibold text-indigo-700 
                       shadow-sm transition hover:bg-indigo-50 dark:bg-slate-700/60 dark:text-indigo-300"
          >
            พิมพ์ใบเสร็จ
          </button>
          <button
            type="button"
            onClick={onClose}
            className="inline-flex items-center justify-center rounded-2xl 
                       bg-emerald-600 px-5 py-2.5 text-sm font-semibold text-white shadow
                       hover:bg-emerald-700"
          >
            ตกลง
          </button>
        </div>
      </div>
    </div>
  )
}

/** ---------- Component ---------- */
const MemberSignup = () => {
  const [errors, setErrors] = useState({})
  const [submitting, setSubmitting] = useState(false)
  const [shouldScrollError, setShouldScrollError] = useState(false)

  // 🔝 ref สำหรับเลื่อนกลับไปบนสุดเมื่อรีเซ็ต
  const topRef = useRef(null)

  // ✅ สถานะสำหรับจังหวัด/อำเภอ/ตำบล (สุรินทร์เท่านั้น)
  const [amphoeOptions, setAmphoeOptions] = useState([])
  const [tambonOptions, setTambonOptions] = useState([])

  // 🧾 ใบเสร็จ/ป๊อปอัป
  const [receipt, setReceipt] = useState(null)
  const [receiptOpen, setReceiptOpen] = useState(false)

  // state หลักของฟอร์ม
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
    province: PROV_SURIN, // ✅ ล็อกไว้เป็น “สุรินทร์”
    subprov: "",
    postal_code: "",
    phone_number: "",
    sex: "",

    // ⬇️ เฉพาะที่ใช้จริงในส่วนการเงิน
    tgs_group: "",
    bank_account: "",
    tgs_id: "",
    spouce_name: "",

    // ซื้อหุ้น (ปุ่มซื้อถูกลบ ใช้ตอน submit)
    buy_amount: "",
    buy_date: new Date().toISOString().slice(0, 10),

    // Land
    own_rai: "",   own_ngan: "",   own_wa: "",
    rent_rai: "",  rent_ngan: "",  rent_wa: "",
    other_rai: "", other_ngan: "", other_wa: "",

    // 🌾 ข้อมูลเกษตร
    fid: "",
    fid_owner: "",
    agri_type: "",
    fertilizing_period: "",
    fertilizer_type: "",
  })

  // ---------- จังหวัด/อำเภอ/ตำบล ----------
  const dedupe = (arr) => Array.from(new Set(arr))

  const loadAmphoesSurin = async () => {
    const options = AMPHOES_SURIN
      .map((n) => ({ value: n, label: n }))
      .sort((a, b) => a.label.localeCompare(b.label, "th"))
    setAmphoeOptions(options)
  }

  const loadTambonsByAmphoe = async (amphoeLabel) => {
    if (!amphoeLabel) { setTambonOptions([]); return }
    const fall = dedupe(TAMBONS_BY_AMPHOE[amphoeLabel] || [])
    const options = fall
      .map((n, i) => ({ value: n || String(i), label: n }))
      .sort((a, b) => a.label.localeCompare(b.label, "th"))
    setTambonOptions(options)
  }

  // โหลดอำเภอครั้งแรก + ล็อกจังหวัดเป็นสุรินทร์เสมอ
  useEffect(() => {
    if (form.province !== PROV_SURIN) {
      setForm((prev) => ({ ...prev, province: PROV_SURIN }))
    }
    loadAmphoesSurin()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // เมื่อเปลี่ยนอำเภอ → โหลดตำบลใหม่ + ล้างค่าตำบลเดิม
  useEffect(() => {
    const amphoeLabel = form.district || ""
    setForm((prev) => ({ ...prev, sub_district: "" }))
    loadTambonsByAmphoe(amphoeLabel)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form.district])

  // refs
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

    // ⬇️ คงเหลือเฉพาะที่ใช้ในส่วนการเงิน
    tgs_group: useRef(null),
    bank_account: useRef(null),
    tgs_id: useRef(null),
    spouce_name: useRef(null),

    // ซื้อหุ้น (ใหม่)
    buy_amount: useRef(null),
    buy_date: useRef(null),

    // เกษตร
    fid: useRef(null),
    fid_owner: useRef(null),
    agri_type: useRef(null),
    fertilizing_period: useRef(null),
    fertilizer_type: useRef(null),

    // ปุ่ม submit (สำหรับโฟกัสตอนสุดท้าย)
    submitBtn: useRef(null),
  }

  // Hook enter-to-next
  const { onEnter, focusNext } = useEnterNavigation(refs)

  const update = (k, v) => setForm((prev) => ({ ...prev, [k]: v }))
  const clearError = (key) =>
    setErrors((prev) => {
      if (!(key in prev)) return prev
      const { [key]: _omit, ...rest } = prev
      return rest
    })

  // 🔁 mapping คำนำหน้า → เพศ (ล็อกเพศให้อัตโนมัติ)
  const PREFIX_OPTIONS = [
    { value: "1", label: "นาย" },
    { value: "2", label: "นาง" },
    { value: "3", label: "นางสาว" },
  ]
  const sexFromPrefix = (pre) => (pre === "1" ? "M" : pre === "2" || pre === "3" ? "F" : "")

  // เมื่อเปลี่ยนคำนำหน้า ⇒ เซ็ตเพศตาม map และล้าง error
  const onChangePrecode = (v) => {
    clearError("precode")
    const mappedSex = sexFromPrefix(v)
    setForm((prev) => ({ ...prev, precode: v, sex: mappedSex }))
    if (mappedSex) clearError("sex")
  }

  const validateAll = () => {
    const e = {}
    if (!form.member_id) e.member_id = "กรอกเลขสมาชิก"
    if (!form.precode) e.precode = "เลือกคำนำหน้า"
    if (!form.first_name) e.first_name = "กรอกชื่อ"
    if (!form.last_name) e.last_name = "กรอกนามสกุล"
    if (!validateThaiCitizenId(form.citizen_id)) e.citizen_id = "เลขบัตรประชาชนไม่ถูกต้อง"

    if (!form.address) e.address = "กรอกที่อยู่"
    if (!form.sub_district) e.sub_district = "เลือกตำบล"
    if (!form.district) e.district = "เลือกอำเภอ"
    if (!form.province) e.province = "จังหวัดต้องเป็นสุรินทร์"

    // เพศถูกล็อกจากคำนำหน้า
    if (!form.sex) e.sex = "เลือกคำนำหน้าเพื่อกำหนดเพศอัตโนมัติ"

    // ตัวเลขต่าง ๆ
    ;[
      "member_id","precode","subprov","postal_code",
      "tgs_group",
      "own_rai","own_ngan","own_wa","rent_rai","rent_ngan","rent_wa","other_rai","other_ngan","other_wa",
      "agri_type","fertilizing_period","fertilizer_type",
    ].forEach((k) => {
      const v = form[k]
      if (v !== "" && isNaN(Number(v))) e[k] = "ตัวเลขเท่านั้น"
    })

    // ซื้อหุ้น: บังคับ tgs_id + buy_amount ≥ 100 (ตาม BE)
    const amountNum = Number(form.buy_amount || 0)
    if (!amountNum || isNaN(amountNum) || amountNum < 100) {
      e.buy_amount = "มูลค่าที่ซื้อต้องเป็นจำนวนเงิน ≥ 100"
    }
    if (!form.tgs_id) e.tgs_id = "กรอกรหัสสมาชิกในระบบ (tgs_id) เพื่อทำการซื้อหุ้น"

    // ช่วงค่าที่ดิน
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

    setErrors(e)
    return Object.keys(e).length === 0
  }

  // เมื่อมี error ให้เลื่อนไปตัวแรก
  useEffect(() => {
    if (!shouldScrollError) return
    const keysOrder = [
      "member_id","precode","regis_date",
      "first_name","last_name","citizen_id",
      "address","mhoo","province","district","sub_district","postal_code",
      "phone_number","sex",

      // การเงิน
      "tgs_group","bank_account","tgs_id",

      // ซื้อหุ้น
      "buy_amount","buy_date",

      // ที่ดินและเกษตร
      "own_rai","own_ngan","own_wa","rent_rai","rent_ngan","rent_wa","other_rai","other_ngan","other_wa",
      "fid","fid_owner","agri_type","fertilizing_period","fertilizer_type",
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

  const toISODate = (d) => (d ? new Date(d).toISOString() : null)

  const handleSubmit = async (ev) => {
    ev.preventDefault()
    const ok = validateAll()
    if (!ok) {
      alert("สมัครสมาชิก/ซื้อหุ้นไม่สำเร็จ ⚠️\n\nกรุณากรอกข้อมูลให้ครบในช่องที่มีกรอบสีแดง")
      setShouldScrollError(true)
      return
    }
    setSubmitting(true)

    const payload = {
      regis_date: toISODate(form.regis_date),
      seedling_prog: !!form.seedling_prog,
      slowdown_rice: !!form.slowdown_rice,
      organic_prog: !!form.organic_prog,
      product_loan: !!form.product_loan,

      member_id: form.member_id.trim(),
      precode: Number(form.precode),
      first_name: form.first_name.trim(),
      last_name: form.last_name.trim(),
      citizen_id: onlyDigits(form.citizen_id),
      address: form.address.trim(),
      mhoo: (form.mhoo ?? "").toString().trim(),
      sub_district: form.sub_district.trim(),
      district: form.district.trim(),
      province: PROV_SURIN,
      subprov: form.subprov === "" ? 0 : Number(form.subprov), // ต้องเป็น int
      postal_code: form.postal_code === "" ? 0 : Number(form.postal_code),
      phone_number: (form.phone_number ?? "").toString().trim(),
      sex: form.sex,

      // เฉพาะที่ใช้
      tgs_group: form.tgs_group === "" ? 0 : Number(form.tgs_group),
      bank_account: (form.bank_account ?? "").toString().trim(),
      tgs_id: form.tgs_id.trim(),
      spouce_name: (form.spouce_name ?? "").toString().trim(),

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

      // 🌾 ข้อมูลเกษตร (🟢 fid เป็น string)
      fid: form.fid === "" ? null : String(form.fid),
      fid_owner: (form.fid_owner ?? "").toString().trim(),
      fid_relationship: form.fid_relationship ?? null,
      agri_type: form.agri_type === "" ? null : Number(form.agri_type),
      fertilizing_period: form.fertilizing_period === "" ? null : Number(form.fertilizing_period),
      fertilizer_type: form.fertilizer_type === "" ? null : Number(form.fertilizer_type),

      // 🟢 ส่งจำนวนเงินซื้อหุ้นครั้งแรกให้ BE ทำรายการทันที
      initial_share: String(form.buy_amount).trim(),     // ส่งเป็น string ให้ BE แปลงเป็น Decimal/ตรวจ ≥ 100
      initial_buy_date: form.buy_date || null,          // ไม่ระบุก็ได้
    }

    try {
      // 1) สมัครสมาชิก
      const resp = await apiAuth(`/member/members/signup`, { method: "POST", body: payload })

      // --- ถ้า BE ไม่ได้ทำ initial purchase ให้ FE ซื้อหุ้นต่อเอง ---
      const buyAmountNum = Number(form.buy_amount || 0)
      let receiptFromBE = resp?.initial_purchase || null

      if (!receiptFromBE && buyAmountNum >= 100 && form.tgs_id?.trim()) {
        const shareBody = {
          amount: buyAmountNum,                 // BE /share/* รับ float
          buy_date: form.buy_date || null,      // YYYY-MM-DD หรือ null
        }
        // เรียกตาม spec ของ BE: /share/{tgs_id}/buy-share
        receiptFromBE = await apiAuth(`/share/${encodeURIComponent(form.tgs_id.trim())}/buy-share`, {
          method: "POST",
          body: shareBody,
        })
      }

      if (receiptFromBE) {
        setReceipt(receiptFromBE)
        setReceiptOpen(true)
      } else {
        alert("บันทึกสมาชิกสำเร็จ (ไม่มีรายการซื้อหุ้น)")
      }
    } catch (err) {
      console.error(err)
      alert(`บันทึก/ซื้อหุ้นล้มเหลว: ${err.message || err}`)
    } finally {
      setSubmitting(false)
    }
  }

  const handleReset = () => {
    setErrors({})
    setReceipt(null)
    setReceiptOpen(false)
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
      province: PROV_SURIN,
      subprov: "",
      postal_code: "",
      phone_number: "",
      sex: "",

      tgs_group: "",
      bank_account: "",
      tgs_id: "",
      spouce_name: "",

      // ซื้อหุ้น
      buy_amount: "",
      buy_date: new Date().toISOString().slice(0, 10),

      // Land
      own_rai:"", own_ngan:"", own_wa:"",
      rent_rai:"", rent_ngan:"", rent_wa:"",
      other_rai:"", other_ngan:"", other_wa:"",

      // 🌾 ใหม่
      fid: "",
      fid_owner: "",
      agri_type: "",
      fertilizing_period: "",
      fertilizer_type: "",
    })
    setTambonOptions([])

    requestAnimationFrame(() => {
      const target = topRef.current
      try {
        if (target && typeof target.scrollIntoView === "function") {
          target.scrollIntoView({ behavior: "smooth", block: "start" })
          target.focus?.()
        } else {
          window.scrollTo({ top: 0, behavior: "smooth" })
        }
      } catch {
        window.scrollTo(0, 0)
      }
    })
  }

  /** ---------- UI ---------- */
  return (
    <div className="min-h-screen bg-white text-black dark:bg-slate-900 dark:text-white rounded-2xl text-[15px] md:text-base">
      <div className="mx-auto max-w-7xl p-5 md:p-6 lg:p-8">
        <h1
          ref={topRef}
          tabIndex={-1}
          className="mb-1 text-3xl font-bold text-gray-900 dark:text-white"
        >
          👤 สมัครสมาชิก
        </h1>

        {/* ⭐ ห่อทั้งฟอร์มด้วยการ์ดใหญ่ */}
        <form
          onSubmit={handleSubmit}
          className="rounded-2xl border border-slate-200 bg-white p-5 text-black shadow-sm dark:border-slate-700 dark:bg-slate-800 dark:text-white"
        >
          {/* โครงการที่เข้าร่วม */}
          <SectionCard title="โครงการที่เข้าร่วม" className="mb-6">
            <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-4">
              {[
                { key: "seedling_prog",  label: "โครงการผลิตเมล็ดพันธ์" },
                { key: "slowdown_rice",  label: "โครงการชะลอข้าวเปลือก" },
                { key: "organic_prog",   label: "โครงการอินทรีย์" },
                { key: "product_loan",   label: "โครงการสินค้าเป็นเงินเชื่อ" },
              ].map(({ key, label }) => (
                <label
                  key={key}
                  className={cx(
                    "group relative flex items-center gap-4 cursor-pointer rounded-2xl border p-4 min-h=[72px] transition-all",
                    "border-slate-200 bg-white/80 dark:border-slate-700 dark:bg-slate-700/40",
                    "shadow-[0_4px_14px_rgba(0,0,0,0.06)] hover:shadow-[0_10px_26px_rgba(0,0,0,0.12)]",
                    "hover:border-emerald-300/70 dark:hover:border-emerald-400/40",
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
                  onKeyDown={onEnter("member_id")}
                  placeholder="เช่น 11263"
                  aria-invalid={errors.member_id ? true : undefined}
                />
                {errors.member_id && <p className={errorTextCls}>{errors.member_id}</p>}
              </div>

              {/* คำนำหน้า */}
              <div>
                <label className={labelCls}>คำนำหน้า (precode)</label>
                <div ref={refs.precode}>
                  <ComboBox
                    options={[{value:"1",label:"นาย"},{value:"2",label:"นาง"},{value:"3",label:"นางสาว"}]}
                    value={form.precode}
                    onChange={(v) => onChangePrecode(v)}
                    placeholder="— เลือกคำนำหน้า —"
                    error={!!errors.precode}
                    buttonRef={refs.precode}
                    onEnterNext={() => focusNext("precode")}
                  />
                </div>
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
                  onKeyDown={onEnter("first_name")}
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
                  onKeyDown={onEnter("last_name")}
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
                  onKeyDown={onEnter("citizen_id")}
                  placeholder="1234567890123"
                  aria-invalid={errors.citizen_id ? true : undefined}
                />
                {errors.citizen_id && <p className={errorTextCls}>{errors.citizen_id}</p>}
                {form.citizen_id.length === 13 && !validateThaiCitizenId(form.citizen_id) && (
                  <p className={helpTextCls}>เลขบัตรอาจไม่ถูกต้อง</p>
                )}
              </div>

              {/* เพศ (ล็อกจากคำนำหน้า) */}
              <div>
                <label className={labelCls}>เพศ (กำหนดจากคำนำหน้า)</label>
                <div ref={refs.sex}>
                  <ComboBox
                    options={[
                      { value: "M", label: "ชาย (M)" },
                      { value: "F", label: "หญิง (F)" },
                    ]}
                    value={form.sex}
                    onChange={() => {}}
                    placeholder="— เลือกคำนำหน้าเพื่อกำหนด —"
                    error={!!errors.sex}
                    disabled
                  />
                </div>
                {errors.sex && <p className={errorTextCls}>{errors.sex}</p>}
              </div>

              {/* คู่สมรส */}
              <div className="md:col-span-2">
                <label className={labelCls}>ชื่อคู่สมรส (spouce_name)</label>
                <input
                  ref={refs.spouce_name}
                  className={baseField}
                  value={form.spouce_name}
                  onChange={(e) => update("spouce_name", e.target.value)}
                  onKeyDown={onEnter("spouce_name")}
                  placeholder="ชื่อคุ๋สมรส"
                />
              </div>
            </div>
          </SectionCard>

          {/* กรอบที่ 2 */}
          <SectionCard title="ที่อยู่และการติดต่อ" className="mt-6">
            <div className="grid gap-4 md:grid-cols-4">
              <div>
                <label className={labelCls}>บ้านเลขที่ (address)</label>
                <input
                  ref={refs.address}
                  className={cx(baseField, errors.address && fieldError)}
                  value={form.address}
                  onChange={(e) => { clearError("address"); update("address", e.target.value) }}
                  onFocus={() => clearError("address")}
                  onKeyDown={onEnter("address")}
                  placeholder="เช่น 123/4"
                  aria-invalid={errors.address ? true : undefined}
                />
                {errors.address && <p className={errorTextCls}>{errors.address}</p>}
              </div>

              <div>
                <label className={labelCls}>หมู่ (mhoo)</label>
                <input
                  ref={refs.mhoo}
                  className={baseField}
                  value={form.mhoo}
                  onChange={(e) => update("mhoo", e.target.value)}
                  onKeyDown={onEnter("mhoo")}
                  placeholder="เช่น 1"
                />
              </div>

              {/* จังหวัด (ล็อกสุรินทร์) */}
              <div>
                <label className={labelCls}>จังหวัด</label>
                <div ref={refs.province}>
                  <ComboBox
                    options={[{ value: PROV_SURIN, label: PROV_SURIN }]}
                    value={form.province}
                    onChange={() => {}}
                    placeholder={PROV_SURIN}
                    disabled
                    error={!!errors.province}
                  />
                </div>
                {errors.province && <p className={errorTextCls}>{errors.province}</p>}
              </div>

              {/* อำเภอ */}
              <div>
                <label className={labelCls}>อำเภอ (district)</label>
                <div ref={refs.district}>
                  <ComboBox
                    options={amphoeOptions}
                    value={form.district}
                    onChange={(v) => { clearError("district"); update("district", v) }}
                    placeholder="— เลือกอำเภอ —"
                    error={!!errors.district}
                    buttonRef={refs.district}
                    onEnterNext={() => focusNext("district")}
                  />
                </div>
                {errors.district && <p className={errorTextCls}>{errors.district}</p>}
              </div>

              {/* ตำบล */}
              <div>
                <label className={labelCls}>ตำบล (sub_district)</label>
                <div ref={refs.sub_district}>
                  <ComboBox
                    options={tambonOptions}
                    value={form.sub_district}
                    onChange={(v) => { clearError("sub_district"); update("sub_district", v) }}
                    placeholder={form.district ? "— เลือกตำบล —" : "เลือกอำเภอก่อน"}
                    error={!!errors.sub_district}
                    disabled={!form.district}
                    buttonRef={refs.sub_district}
                    onEnterNext={() => focusNext("sub_district")}
                  />
                </div>
                {errors.sub_district && <p className={errorTextCls}>{errors.sub_district}</p>}
              </div>

              <div>
                <label className={labelCls}>อำเภอย่อย/รหัสอำเภอ (subprov)</label>
                <input
                  ref={refs.subprov}
                  inputMode="numeric"
                  className={baseField}
                  value={form.subprov}
                  onChange={(e) => update("subprov", onlyDigits(e.target.value))}
                  onKeyDown={onEnter("subprov")}
                  placeholder="เช่น 501"
                />
              </div>

              <div>
                <label className={labelCls}>รหัสไปรษณีย์ </label>
                <input
                  ref={refs.postal_code}
                  inputMode="numeric"
                  maxLength={5}
                  className={cx(baseField, errors.postal_code && fieldError)}
                  value={form.postal_code}
                  onChange={(e) => { clearError("postal_code"); update("postal_code", onlyDigits(e.target.value)) }}
                  onFocus={() => clearError("postal_code")}
                  onKeyDown={onEnter("postal_code")}
                  placeholder="32000"
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
                  onKeyDown={onEnter("phone_number")}
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
                <label className={labelCls}>กลุ่ม (tgs_group)</label>
                <input
                  ref={refs.tgs_group}
                  inputMode="numeric"
                  className={cx(baseField, errors.tgs_group && fieldError)}
                  value={form.tgs_group}
                  onChange={(e) => { clearError("tgs_group"); update("tgs_group", onlyDigits(e.target.value)) }}
                  onFocus={() => clearError("tgs_group")}
                  onKeyDown={onEnter("tgs_group")}
                  placeholder="16"
                  aria-invalid={errors.tgs_group ? true : undefined}
                />
                {errors.tgs_group && <p className={errorTextCls}>{errors.tgs_group}</p>}
              </div>

              <div className="md:col-span-2">
                <label className={labelCls}>บัญชีธนาคาร (bank_account)</label>
                <input
                  ref={refs.bank_account}
                  className={baseField}
                  value={form.bank_account}
                  onChange={(e) => update("bank_account", e.target.value)}
                  onKeyDown={onEnter("bank_account")}
                  placeholder="014-1-23456-7"
                />
              </div>

              <div>
                <label className={labelCls}>รหัสสมาชิกในระบบ (tgs_id)</label>
                <input
                  ref={refs.tgs_id}
                  className={cx(baseField, errors.tgs_id && fieldError)}
                  value={form.tgs_id}
                  onChange={(e) => { clearError("tgs_id"); update("tgs_id", e.target.value) }}
                  onKeyDown={onEnter("tgs_id")}
                  placeholder="TGS-001"
                  aria-invalid={errors.tgs_id ? true : undefined}
                />
                {errors.tgs_id && <p className={errorTextCls}>{errors.tgs_id}</p>}
              </div>
            </div>

            {/* ซื้อหุ้น (แทนชุดฟิลด์ที่ถูกลบปุ่ม) */}
            <h3 className="mt-6 mb-3 text-lg font-semibold">ซื้อหุ้น</h3>
            <div className="grid gap-4 md:grid-cols-4">
              <div>
                <label className={labelCls}>มูลค่าที่ซื้อ (บาท)</label>
                <input
                  ref={refs.buy_amount}
                  inputMode="decimal"
                  className={cx(baseField, errors.buy_amount && fieldError)}
                  value={form.buy_amount}
                  onChange={(e) => { clearError("buy_amount"); update("buy_amount", toDecimal3(e.target.value)) }}
                  onKeyDown={onEnter("buy_amount")}
                  placeholder="เช่น 1000.000"
                  aria-invalid={errors.buy_amount ? true : undefined}
                />
                {errors.buy_amount && <p className={errorTextCls}>{errors.buy_amount}</p>}
                <p className={helpTextCls}>ไม่ต่ำกว่า 100 บาท • ครั้งแรกมีค่าธรรมเนียม 50 บาท </p>
              </div>

              <div>
                <label className={labelCls}>วันที่ซื้อ (ไม่ระบุก็ได้)</label>
                <DateInput
                  ref={refs.buy_date}
                  value={form.buy_date}
                  onChange={(e) => update("buy_date", e.target.value)}
                />
              </div>
            </div>
          </SectionCard>

          {/* กรอบที่ 4: ข้อมูลเกษตร */}
          <SectionCard title="ข้อมูลเกษตร" className="mt-6">
            <div className="grid gap-4 md:grid-cols-4">
              <div>
                <label className={labelCls}>รหัสทะเบียนเกษตรกร (fid)</label>
                <input
                  ref={refs.fid}
                  inputMode="numeric"
                  className={cx(baseField, errors.fid && fieldError)}
                  value={form.fid}
                  onChange={(e) => { clearError("fid"); update("fid", onlyDigits(e.target.value)) }}
                  onFocus={() => clearError("fid")}
                  onKeyDown={onEnter("fid")}
                  placeholder="เช่น 123456"
                  aria-invalid={errors.fid ? true : undefined}
                />
                {errors.fid && <p className={errorTextCls}>{errors.fid}</p>}
              </div>

              <div className="md:col-span-2">
                <label className={labelCls}>ผู้ขึ้นทะเบียนเกษตรกร (fid_owner)</label>
                <input
                  ref={refs.fid_owner}
                  className={cx(baseField, errors.fid_owner && fieldError)}
                  value={form.fid_owner}
                  onChange={(e) => { clearError("fid_owner"); update("fid_owner", e.target.value) }}
                  onFocus={() => clearError("fid_owner")}
                  onKeyDown={onEnter("fid_owner")}
                  placeholder="เช่น นายสมชาย ใจดี"
                  aria-invalid={errors.fid_owner ? true : undefined}
                />
                {errors.fid_owner && <p className={errorTextCls}>{errors.fid_owner}</p>}
              </div>

              <div>
                <label className={labelCls}>ประเภทการเกษตร (agri_type)</label>
                <input
                  ref={refs.agri_type}
                  inputMode="numeric"
                  className={cx(baseField, errors.agri_type && fieldError)}
                  value={form.agri_type}
                  onChange={(e) => { clearError("agri_type"); update("agri_type", onlyDigits(e.target.value)) }}
                  onFocus={() => clearError("agri_type")}
                  onKeyDown={onEnter("agri_type")}
                  placeholder="เช่น 1"
                  aria-invalid={errors.agri_type ? true : undefined}
                />
                {errors.agri_type && <p className={errorTextCls}>{errors.agri_type}</p>}
              </div>

              <div>
                <label className={labelCls}>ช่วงระยะเวลาการใช้ปุ๋ย (fertilizing_period)</label>
                <input
                  ref={refs.fertilizing_period}
                  inputMode="numeric"
                  className={cx(baseField, errors.fertilizing_period && fieldError)}
                  value={form.fertilizing_period}
                  onChange={(e) => { clearError("fertilizing_period"); update("fertilizing_period", onlyDigits(e.target.value)) }}
                  onFocus={() => clearError("fertilizing_period")}
                  onKeyDown={onEnter("fertilizing_period")}
                  placeholder="เช่น 2"
                  aria-invalid={errors.fertilizing_period ? true : undefined}
                />
                {errors.fertilizing_period && <p className={errorTextCls}>{errors.fertilizing_period}</p>}
              </div>

              <div>
                <label className={labelCls}>สูตรที่ใช้ปุ๋ย (fertilizer_type)</label>
                <input
                  ref={refs.fertilizer_type}
                  inputMode="numeric"
                  className={cx(baseField, errors.fertilizer_type && fieldError)}
                  value={form.fertilizer_type}
                  onChange={(e) => { clearError("fertilizer_type"); update("fertilizer_type", onlyDigits(e.target.value)) }}
                  onFocus={() => clearError("fertilizer_type")}
                  onKeyDown={onEnter("fertilizer_type")}
                  placeholder="เช่น 16160 (แทน 16-16-0)"
                  aria-invalid={errors.fertilizer_type ? true : undefined}
                />
                {errors.fertilizer_type && <p className={errorTextCls}>{errors.fertilizer_type}</p>}
              </div>
            </div>

            {/* ปุ่ม */}
            <div className="mt-6 flex flex-col gap-3 sm:flex-row">
              <button
                ref={refs.submitBtn}
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
                {submitting ? "กำลังบันทึก..." : "บันทึก"}
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

        {/* Receipt Modal */}
        <ReceiptModal
          open={receiptOpen}
          receipt={receipt}
          name={`${(form.first_name || "").trim()} ${(form.last_name || "").trim()}`}
          onClose={() => {
            setReceiptOpen(false)
            handleReset()
          }}
        />
      </div>
    </div>
  )
}

export default MemberSignup
