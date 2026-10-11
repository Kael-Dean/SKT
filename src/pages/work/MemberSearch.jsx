// src/pages/MemberSearch.jsx
import { useEffect, useMemo, useState } from "react"
import { apiAuth } from "../../lib/api"   // ✅ ใช้ helper แนบโทเคนอัตโนมัติ
import { SkeletonTableRows, ErrorState, EmptyState, Sheet, SearchField, DataList, toast } from "../../components/ui"
import { useIsPhone } from "../../hooks/useMediaQuery"
import { cx, neutralBtnCls, secondaryBtnCls, submitBtnCls } from "../../lib/styles"

/** ไอคอนแว่นขยาย (inline SVG — currentColor, ไม่มี emoji) */
function SearchIcon({ className = "size-5" }) {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      <circle cx="11" cy="11" r="8" />
      <path d="m21 21-4.3-4.3" />
    </svg>
  )
}

/** ---------- Utils ---------- */
const onlyDigits = (s = "") => s.replace(/\D+/g, "")

/** แสดงข้อความจาก backend เฉพาะเมื่อเป็นภาษาไทยแล้ว ไม่งั้นใช้ข้อความกลาง */
const friendly = (e, fallback) => (/[฀-๿]/.test(e?.message || "") ? e.message : fallback)

/** debounce */
function useDebounce(value, delay = 400) {
  const [debounced, setDebounced] = useState(value)
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delay)
    return () => clearTimeout(t)
  }, [value, delay])
  return debounced
}

/** แปลงเป็น YYYY-MM-DD แบบปลอดภัย; ถ้าไม่ได้ให้คืน "" */
function toInputDateSafely(v) {
  if (!v) return ""
  if (typeof v === "string" && /^\d{2}\/\d{2}\/\d{4}$/.test(v)) {
    const [dd, mm, yyyyRaw] = v.split("/")
    const yyyy = Number(yyyyRaw) > 2500 ? Number(yyyyRaw) - 543 : Number(yyyyRaw)
    const d = new Date(Date.UTC(yyyy, Number(mm) - 1, Number(dd)))
    return isNaN(d) ? "" : d.toISOString().slice(0, 10)
  }
  const d = new Date(v)
  return isNaN(d) ? "" : d.toISOString().slice(0, 10)
}

/** แสดงวันที่แบบไทย; ถ้าไม่ได้ให้ "-" */
function formatDate(v) {
  if (!v) return "-"
  if (typeof v === "string" && /^\d{2}\/\d{2}\/\d{4}$/.test(v)) return v
  try {
    const d = new Date(v)
    if (isNaN(d)) return "-"
    return d.toLocaleDateString("th-TH", { day: "2-digit", month: "2-digit", year: "numeric" })
  } catch {
    return "-"
  }
}

/** แปลงตัวเลขหุ้นให้สวยงาม */
function formatShares(v) {
  if (v === null || v === undefined) return "—"
  const n = Number(v)
  return Number.isFinite(n)
    ? n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })
    : "—"
}

/** ---------- โครงการ ---------- */
const PROGRAMS = [
  { key: "seedling_prog", label: "โครงผลิตเมล็ดพันธ์", emoji: "🌱" },
  { key: "slowdown_rice", label: "โครงการชะลอข้าวเปลือก", emoji: "🐢" },
  { key: "organic_prog", label: "โครงการอินทรีย์", emoji: "🌿" },
  { key: "product_loan", label: "โครงการสินค้าเป็นเงินเชื่อ", emoji: "💳" },
]
const PROG_KEYS = PROGRAMS.map((p) => p.key)
const toBool = (v) => v === true || v === 1 || v === "1" || String(v).toLowerCase() === "true"

/** ---------- ฟิลด์ทั้งหมด (ยกเว้นโครงการ) ---------- */
const FIELD_CONFIG = [
  { key: "member_id", label: "เลขสมาชิก", type: "text" },
  { key: "precode", label: "คำนำหน้า", type: "number", options: [{ value: "", label: "— เลือก —" }, { value: "1", label: "นาย" }, { value: "2", label: "นาง" }, { value: "3", label: "นางสาว" }] },
  { key: "first_name", label: "ชื่อ", type: "text" },
  { key: "last_name", label: "นามสกุล", type: "text" },
  { key: "citizen_id", label: "เลขบัตรประชาชน", type: "cid" },
  { key: "sex", label: "เพศ", type: "select", options: [{ value: "", label: "— เลือก —" }, { value: "M", label: "ชาย" }, { value: "F", label: "หญิง" }] },
  { key: "phone_number", label: "โทรศัพท์", type: "text" },
  { key: "address", label: "ที่อยู่", type: "text" },
  { key: "mhoo", label: "หมู่", type: "text" },
  { key: "sub_district", label: "ตำบล", type: "text" },
  { key: "district", label: "อำเภอ", type: "text" },
  { key: "province", label: "จังหวัด", type: "text" },
  { key: "postal_code", label: "รหัสไปรษณีย์", type: "number" },
  { key: "subprov", label: "อำเภอย่อย/รหัสอำเภอ", type: "number" },
  { key: "tgs_group", label: "กลุ่ม", type: "number" },
  { key: "bank_account", label: "บัญชีธนาคาร", type: "text" },
  { key: "tgs_id", label: "รหัส TGS", type: "text" },
  { key: "spouce_name", label: "ชื่อคู่สมรส", type: "text" },
  { key: "orders_placed", label: "จำนวนครั้งที่ซื้อ", type: "number" },
  { key: "regis_date", label: "วันที่สมัคร", type: "date" },
  // ที่ดิน
  { key: "own_rai", label: "ถือครอง (ไร่)", type: "number" },
  { key: "own_ngan", label: "ถือครอง (งาน)", type: "number" },
  { key: "own_wa", label: "ถือครอง (ตารางวา)", type: "number" },
  { key: "rent_rai", label: "เช่าทำกิน (ไร่)", type: "number" },
  { key: "rent_ngan", label: "เช่าทำกิน (งาน)", type: "number" },
  { key: "rent_wa", label: "เช่าทำกิน (ตารางวา)", type: "number" },
  { key: "other_rai", label: "อื่นๆ (ไร่)", type: "number" },
  { key: "other_ngan", label: "อื่นๆ (งาน)", type: "number" },
  { key: "other_wa", label: "อื่นๆ (ตารางวา)", type: "number" },
]
const LAND_KEYS = [
  "own_rai","own_ngan","own_wa",
  "rent_rai","rent_ngan","rent_wa",
  "other_rai","other_ngan","other_wa",
]

/** Badge แสดงโครงการ (โหมดดู) */
function ProgramBadges({ row }) {
  const active = PROGRAMS.filter(p => toBool(row?.[p.key]))
  if (active.length === 0) {
    return <span className="inline-flex items-center rounded-lg border border-slate-300 px-2.5 py-1 text-xs text-slate-600 dark:border-slate-600 dark:text-slate-300">ไม่มี</span>
  }
  return (
    <div className="flex flex-wrap gap-1.5">
      {active.map(p => (
        <span
          key={p.key}
          className="inline-flex items-center gap-1 rounded-xl bg-emerald-50 px-2.5 py-1 text-xs font-medium text-emerald-800 ring-1 ring-emerald-200 dark:bg-emerald-900/20 dark:text-emerald-200 dark:ring-emerald-700/40"
          title={p.label}
        >
          <span>{p.emoji}</span>
          <span className="whitespace-nowrap">{p.label}</span>
        </span>
      ))}
    </div>
  )
}

/** Toggle โครงการ (โหมดแก้ไข) */
function ProgramToggles({ value, onChange }) {
  return (
    <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-4">
      {PROGRAMS.map(({ key, label }) => (
        <label
          key={key}
          className={[
            "group relative flex items-center gap-4 cursor-pointer rounded-2xl border p-4 min-h-[72px] transition-all",
            "border-slate-200 bg-white/80 dark:border-slate-700 dark:bg-slate-700/40",
            "shadow-[0_4px_14px_rgba(0,0,0,0.06)] hover:shadow-[0_10px_26px_rgba(0,0,0,0.12)]",
            "hover:border-emerald-300/70 dark:hover:border-emerald-400/40",
            value?.[key] ? "ring-2 ring-emerald-400 shadow-[0_12px_30px_rgba(16,185,129,0.25)]" : "ring-0",
          ].join(" ")}
        >
          <span
            className={[
              "relative inline-flex h-7 w-12 flex-shrink-0 items-center rounded-full transition-colors",
              value?.[key] ? "bg-emerald-600" : "bg-slate-300 dark:bg-slate-600",
            ].join(" ")}
            aria-hidden="true"
          >
            <span
              className={[
                "inline-block h-6 w-6 transform rounded-full bg-white shadow transition",
                "shadow-[0_3px_10px_rgba(0,0,0,0.25)]",
                value?.[key] ? "translate-x-6" : "translate-x-1",
                "group-hover:scale-105",
              ].join(" ")}
            />
          </span>
          <input
            type="checkbox"
            className="sr-only"
            checked={!!value?.[key]}
            onChange={(e) => onChange(key, e.target.checked)}
          />
          <span className="text-slate-800 dark:text-slate-100 text-[15px] md:text-base font-medium">{label}</span>
          <span
            className={[
              "pointer-events-none absolute inset-0 rounded-2xl transition-opacity",
              "bg-emerald-100/30 dark:bg-emerald-400/10",
              value?.[key] ? "opacity-100" : "opacity-0 group-hover:opacity-100",
            ].join(" ")}
            aria-hidden="true"
          />
        </label>
      ))}
    </div>
  )
}

/** คอลัมน์ตาราง — ✅ เพิ่ม “อำเภอ” ต่อจาก “จังหวัด” */
const TABLE_COLUMNS = [
  { key: "first_name", label: "ชื่อ", render: (row) => row.first_name ?? "-" },
  { key: "last_name", label: "นามสกุล", render: (row) => row.last_name ?? "-" },
  { key: "citizen_id", label: "เลขบัตรประชาชน", render: (row) => row.citizen_id || "-" },
  { key: "phone_number", label: "โทรศัพท์", render: (row) => row.phone_number ?? "-" },
  { key: "province", label: "จังหวัด", render: (row) => row.province ?? "-" },
  { key: "district", label: "อำเภอ", render: (row) => row.district ?? "-" },
  { key: "regis_date", label: "วันที่สมัคร", render: (row) => formatDate(row.regis_date) },
  { key: "__programs", label: "โครงการ", render: (row) => <ProgramBadges row={row} /> },
]

/** ทำให้เรคคอร์ด “ครบคีย์” + ทำความสะอาดเบื้องต้น */
function normalizeRecord(raw = {}) {
  const out = {
    asso_id: raw.asso_id ?? raw.assoId ?? raw.id ?? null,
    member_id: raw.member_id != null ? String(raw.member_id) : (raw.memberId != null ? String(raw.memberId) : null),

    first_name: raw.first_name ?? raw.firstname ?? "",
    last_name: raw.last_name ?? raw.lastname ?? "",
    citizen_id: onlyDigits(raw.citizen_id ?? raw.citizenId ?? "") || null,

    phone_number: raw.phone_number ?? raw.phone ?? null,
    address: raw.address ?? "",
    mhoo: raw.mhoo ?? raw.moo ?? "",
    sub_district: raw.sub_district ?? raw.subdistrict ?? "",
    district: raw.district ?? "",
    province: raw.province ?? "",
    postal_code: raw.postal_code ?? raw.postalCode ?? null,
    subprov: raw.subprov ?? null,
    sex: raw.sex ?? "",
    salary: raw.salary ?? null,
    tgs_group: raw.tgs_group ?? null,
    share_per_month: raw.share_per_month ?? null,
    ar_limit: raw.ar_limit ?? null,
    normal_share: raw.normal_share ?? null,
    bank_account: raw.bank_account ?? "",
    tgs_id: raw.tgs_id ?? "",
    spouce_name: raw.spouce_name ?? "",
    orders_placed: raw.orders_placed ?? null,

    // ✅ รองรับ total_shares จาก API
    total_shares: raw.total_shares ?? raw.totalShares ?? null,

    regis_date: raw.regis_date ?? raw.created_at ?? raw.registered_at ?? null,
    last_bought_date: raw.last_bought_date ?? null,
    transfer_date: raw.transfer_date ?? null,

    own_rai: raw.own_rai ?? 0,
    own_ngan: raw.own_ngan ?? 0,
    own_wa: raw.own_wa ?? 0,
    rent_rai: raw.rent_rai ?? 0,
    rent_ngan: raw.rent_ngan ?? 0,
    rent_wa: raw.rent_wa ?? 0,
    other_rai: raw.other_rai ?? 0,
    other_ngan: raw.other_ngan ?? 0,
    other_wa: raw.other_wa ?? 0,

    seedling_prog: toBool(raw.seedling_prog ?? false),
    slowdown_rice: toBool(raw.slowdown_rice ?? false),
    organic_prog: toBool(raw.organic_prog ?? false),
    product_loan: toBool(raw.product_loan ?? false),
  }

  FIELD_CONFIG.forEach(({ key }) => {
    if (!(key in out)) out[key] = LAND_KEYS.includes(key) ? 0 : ""
  })
  PROG_KEYS.forEach((k) => {
    if (!(k in out)) out[k] = false
  })
  return out
}

/** clamp งาน/วา/ไร่ */
function clampLandValue(key, raw) {
  const n = Number(onlyDigits(String(raw ?? "")))
  if (Number.isNaN(n)) return 0
  if (key.endsWith("_ngan")) return Math.min(Math.max(n, 0), 3)
  if (key.endsWith("_wa"))   return Math.min(Math.max(n, 0), 99)
  return Math.max(n, 0)
}

const MemberSearch = () => {
  const [q, setQ] = useState("")
  const dq = useDebounce(q, 450)

  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")
  const [reloadKey, setReloadKey] = useState(0)   // ↻ สำหรับปุ่ม "ลองใหม่"

  // modal
  const [open, setOpen] = useState(false)
  const [active, setActive] = useState(null)
  const [draft, setDraft] = useState(null)
  const [editing, setEditing] = useState(false)
  const [saving, setSaving] = useState(false)
  const isPhone = useIsPhone()
  const [rowError, setRowError] = useState("")

  const hint = useMemo(() => {
    const digits = onlyDigits(q)
    if (digits.length === 13) return "ค้นหาตามเลขบัตรประชาชน"
    if (q.trim().includes(" ")) return "ค้นหาตามชื่อและนามสกุล"
    if (q.trim().length >= 2) return "ค้นหาตามชื่อหรือนามสกุล"
    return "พิมพ์ชื่อ/นามสกุล หรือเลขบัตรประชาชน"
  }, [q])

  useEffect(() => {
    const run = async () => {
      setError("")
      setRows([])
      const term = dq.trim()
      if (!term) return
      setLoading(true)
      try {
        const data = await apiAuth(`/member/members/search?q=${encodeURIComponent(term)}`)
        const normalized = (Array.isArray(data) ? data : []).map(normalizeRecord)
        setRows(normalized)
      } catch (e) {
        setError(friendly(e, "ค้นหาไม่สำเร็จ ลองใหม่อีกครั้ง"))
      } finally {
        setLoading(false)
      }
    }
    run()
  }, [dq, reloadKey])

  const openModal = (row, { edit = false } = {}) => {
    const r = normalizeRecord(row)
    setActive(r)

    const d = {}
    FIELD_CONFIG.forEach(({ key, type }) => {
      let v = r[key]
      if (LAND_KEYS.includes(key)) v = typeof v === "number" ? v : 0
      else if (type === "date" || type === "date-optional") v = toInputDateSafely(v)
      else if (type === "cid") v = onlyDigits(String(v || "")).slice(0, 13)
      else v = v ?? ""
      d[key] = v
    })
    PROG_KEYS.forEach((k) => { d[k] = !!r[k] })
    setDraft(d)

    setRowError("")
    setEditing(edit)
    setOpen(true)
  }

  const closeModal = () => {
    setOpen(false)
    setActive(null)
    setDraft(null)
    setEditing(false)
    setSaving(false)
    setRowError("")
  }

  const onChangeField = (key, val) => {
    const cfg = FIELD_CONFIG.find((f) => f.key === key)
    if (!cfg) return
    if (LAND_KEYS.includes(key)) val = clampLandValue(key, val)
    else if (cfg.type === "cid") val = onlyDigits(val).slice(0, 13)
    else if (cfg.type === "number") val = onlyDigits(val)
    else if (cfg.type === "decimal") val = String(val).replace(/[^\d.]/g, "")
    setDraft((p) => ({ ...p, [key]: val }))
  }

  const onToggleProgram = (key, checked) => {
    if (!PROG_KEYS.includes(key)) return
    setDraft((p) => ({ ...p, [key]: !!checked }))
  }

  const save = async () => {
    if (!active) return
    setRowError("")
    setSaving(true)
    try {
      const diff = {}
      const keysToCheck = [
        ...FIELD_CONFIG.map((f) => f.key),
        ...PROG_KEYS,
      ]

      keysToCheck.forEach((key) => {
        const cfg = FIELD_CONFIG.find((f) => f.key === key)
        const oldV = active[key]
        let newV = draft[key]

        if (cfg) {
          if (cfg.type === "date" || cfg.type === "date-optional") {
            newV = newV ? new Date(newV).toISOString() : null
          } else if (cfg.type === "number" || cfg.type === "decimal" || LAND_KEYS.includes(key)) {
            newV = newV === "" || newV == null ? 0 : Number(newV)
          }
        } else if (PROG_KEYS.includes(key)) {
          newV = !!newV
        }

        if (oldV !== newV) diff[key] = newV
      })

      const idForPatch = active.member_id
      if (!idForPatch && idForPatch !== 0) throw new Error("รายการนี้ไม่มีเลขสมาชิก จึงบันทึกการแก้ไขไม่ได้")

      // ✅ ส่งค่า member_id กลับไปเป็น string เสมอ (แก้กรณี BE ต้องการ string)
      diff.member_id = String(idForPatch)

      setRows((cur) => cur.map((x) => (x.member_id === active.member_id ? { ...x, ...diff } : x)))

      const updatedRaw = await apiAuth(`/member/members/${idForPatch}`, {
        method: "PATCH",
        body: diff,
      })

      const updated = normalizeRecord(updatedRaw)
      setRows((cur) => cur.map((x) => (x.member_id === updated.member_id ? updated : x)))
      setActive(updated)

      const nd = {}
      FIELD_CONFIG.forEach(({ key, type }) => {
        let v = updated[key]
        if (LAND_KEYS.includes(key)) v = typeof v === "number" ? v : 0
        else if (type === "date" || type === "date-optional") v = toInputDateSafely(v)
        else v = v ?? ""
        nd[key] = v
      })
      PROG_KEYS.forEach((k) => { nd[k] = !!updated[k] })
      setDraft(nd)

      setEditing(false)
    } catch (e) {
      setRows((cur) => cur)
      setRowError(friendly(e, "บันทึกไม่สำเร็จ ลองใหม่อีกครั้ง"))
      toast.error("บันทึกไม่สำเร็จ", { description: friendly(e, "ข้อมูลที่แก้ยังอยู่ ลองบันทึกใหม่อีกครั้ง") })
    } finally {
      setSaving(false)
    }
  }

  const loaderCols = TABLE_COLUMNS.length + 1

  /* ── shared field-input class for the detail sheet ── */
  const inputCls =
    "w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-base text-black placeholder:text-slate-400 outline-none " +
    "focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/25 dark:border-slate-600 dark:bg-slate-700 dark:text-white"
  const readCls = "rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-base break-words text-gray-900 dark:border-slate-700 dark:bg-slate-700/60 dark:text-gray-100"
  const inputModeFor = (type) => (type === "cid" || type === "number" ? "numeric" : type === "decimal" ? "decimal" : undefined)

  const fullName = (r) => `${r?.first_name ?? ""} ${r?.last_name ?? ""}`.trim() || "(ไม่มีชื่อ)"

  const emptyBefore = (
    <EmptyState
      icon={<SearchIcon className="size-12" />}
      title="เริ่มต้นด้วยการค้นหาสมาชิก"
      description="พิมพ์ชื่อ นามสกุล เลขบัตรประชาชน หรือเลขทะเบียนสมาชิกในช่องด้านบนเพื่อแสดงรายชื่อ"
    />
  )
  const emptyNone = (
    <EmptyState
      title={`ไม่พบข้อมูลที่ตรงกับ “${dq}”`}
      description="ลองตรวจสอบการสะกด หรือค้นหาด้วยคำอื่น เช่น เลขบัตรประชาชน หรือเลขทะเบียนสมาชิก"
      action={
        <button type="button" onClick={() => setQ("")} className={neutralBtnCls}>
          ล้างตัวกรอง
        </button>
      }
    />
  )

  const sheetFooter = active ? (
    <div className="grid grid-cols-2 gap-3 md:flex md:justify-end md:gap-2">
      {!editing ? (
        <>
          <button type="button" onClick={closeModal} className={cx(neutralBtnCls, "h-12 md:h-10")}>
            ปิด
          </button>
          <button type="button" onClick={() => setEditing(true)} className={cx(secondaryBtnCls, "h-12 py-0 text-sm md:h-10")}>
            แก้ไข
          </button>
        </>
      ) : (
        <>
          <button
            type="button"
            disabled={saving}
            onClick={() => { setEditing(false); openModal(active) }}
            className={cx(neutralBtnCls, "h-12 md:h-10")}
          >
            ยกเลิก
          </button>
          <button type="button" onClick={save} disabled={saving} aria-busy={saving || undefined} className={cx(submitBtnCls, "h-12 py-0 text-sm md:h-10")}>
            {saving ? "กำลังบันทึก…" : "บันทึก"}
          </button>
        </>
      )}
    </div>
  ) : null

  return (
    <div className="min-h-screen rounded-2xl bg-white text-black dark:bg-slate-900 dark:text-white">
      <div className="mx-auto max-w-6xl p-4 md:p-6 text-base md:text-lg">
        <h1 className="mb-4 flex items-center gap-2 text-xl md:text-3xl font-bold">
          <SearchIcon className="size-6 text-indigo-600 dark:text-indigo-400" />
          ค้นหาสมาชิก
        </h1>

        {/* การ์ดค้นหา */}
        <div className="rounded-2xl border border-slate-200/60 bg-white p-4 md:p-6 shadow-sm dark:border-white/10 dark:bg-slate-800/60">
          <label htmlFor="member-search-q" className="mb-2 block text-sm md:text-base text-slate-700 dark:text-slate-300">คำค้นหา</label>
          <SearchField
            id="member-search-q"
            value={q}
            onChange={setQ}
            open={false}
            loading={loading}
            placeholder={isPhone ? "ชื่อ นามสกุล เลขบัตร หรือเลขสมาชิก" : "ค้นหาตามชื่อหรือนามสกุล เลขบัตรประชาชน หรือเลขทะเบียนสมาชิก"}
            ariaLabel="ค้นหาสมาชิก"
          />
          <div className="mt-2 text-sm text-slate-500 dark:text-slate-400" aria-live="polite">
            {dq ? (loading ? <>กำลังค้นหา “{dq}”…</> : <>พบ {rows.length.toLocaleString()} รายการ</>) : <>พิมพ์อย่างน้อย 1 ตัวอักษรเพื่อค้นหา</>}
          </div>
          {hint && !loading && dq && (
            <div className="mt-1 text-sm text-slate-500 dark:text-slate-400">{hint}</div>
          )}
          {error && (
            <ErrorState
              className="mt-3"
              message={error}
              onRetry={() => setReloadKey((k) => k + 1)}
            />
          )}
        </div>

        {/* ผลลัพธ์ */}
        {isPhone ? (
          <div className="mt-4">
            <DataList
              items={error ? [] : rows}
              keyOf={(r, i) => r.asso_id ?? r.member_id ?? r.citizen_id ?? i}
              loading={loading}
              skeletonRows={4}
              title={(r) => fullName(r)}
              subtitle={(r) => r.citizen_id || "ไม่มีเลขบัตร"}
              fields={[
                { label: "โทรศัพท์", value: (r) => r.phone_number || "-" },
                { label: "อำเภอ/จังหวัด", value: (r) => [r.district, r.province].filter(Boolean).join(", ") || "-" },
                { label: "วันที่สมัคร", value: (r) => formatDate(r.regis_date) },
                { label: "เลขสมาชิก", value: (r) => r.member_id ?? "-", align: "right" },
              ]}
              onClick={(r) => openModal(r)}
              actions={(r) => (
                <button
                  type="button"
                  onClick={(e) => { e.stopPropagation(); openModal(r, { edit: true }) }}
                  className={cx(secondaryBtnCls, "h-11 px-4 py-0 text-sm")}
                  aria-label={`แก้ไข ${fullName(r)}`}
                >
                  แก้ไข
                </button>
              )}
              emptyState={error ? null : dq ? emptyNone : emptyBefore}
            />
          </div>
        ) : (
        <div className="mt-5 rounded-2xl border border-slate-200/60 bg-white shadow-sm dark:border-white/10 dark:bg-slate-800/40">
          <div className="overflow-x-auto rounded-2xl xl:overflow-x-clip">
            <table className="w-full text-base tabular-nums">
              <thead className="text-slate-700 dark:text-slate-100">
                <tr className="sticky top-0 xl:top-(--topbar-h) z-10 bg-slate-50 dark:bg-slate-700">
                  {TABLE_COLUMNS.map((c) => (
                    <th key={c.key} className="whitespace-nowrap px-5 py-4 text-left text-[15px] md:text-base font-semibold">
                      {c.label}
                    </th>
                  ))}
                  <th className="px-5 py-4 text-right text-[15px] md:text-base font-semibold whitespace-nowrap min-w-[132px]">
                    การกระทำ
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200/70 dark:divide-white/8">
                {loading && <SkeletonTableRows rows={8} cols={loaderCols} />}

                {/* ก่อนเริ่มค้นหา — สอนขั้นตอนถัดไป */}
                {!loading && !error && !dq && (
                  <tr>
                    <td colSpan={loaderCols} className="p-0">{emptyBefore}</td>
                  </tr>
                )}

                {/* ค้นหาแล้วแต่ไม่พบผลลัพธ์ */}
                {!loading && !error && dq && rows.length === 0 && (
                  <tr>
                    <td colSpan={loaderCols} className="p-0">{emptyNone}</td>
                  </tr>
                )}

                {!loading &&
                  rows.map((r, i) => (
                    <tr
                      key={r.asso_id ?? r.member_id ?? r.citizen_id ?? i}
                      className="odd:bg-white/90 even:bg-slate-50/70 hover:bg-emerald-50/70 dark:odd:bg-slate-800/40 dark:even:bg-slate-800/25 dark:hover:bg-emerald-400/10 transition-colors"
                    >
                      {TABLE_COLUMNS.map((c) => (
                        <td key={c.key} className="px-5 py-4">
                          {c.render ? c.render(r) : (r[c.key] ?? "-")}
                        </td>
                      ))}
                      <td className="px-5 py-4 text-right">
                        <button
                          type="button"
                          onClick={() => openModal(r)}
                          className="min-h-touch md:min-h-0 whitespace-nowrap rounded-2xl bg-emerald-600/90 px-4 py-2 text-sm md:text-base font-semibold text-white shadow-sm ring-1 ring-emerald-700/50 hover:bg-emerald-600 active:scale-[.98] dark:bg-emerald-500/85 dark:hover:bg-emerald-500"
                        >
                          ดูรายละเอียด
                        </button>
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        </div>
        )}
      </div>

      {/* รายละเอียดสมาชิก — Sheet (bottom sheet <md, centered dialog ≥md) */}
      <Sheet
        open={open && !!active}
        onClose={closeModal}
        title={active ? fullName(active) : "รายละเอียดสมาชิก"}
        subtitle={
          active
            ? [active.member_id != null && active.member_id !== "" ? `เลขสมาชิก ${active.member_id}` : "", active.citizen_id || ""].filter(Boolean).join(" · ") || undefined
            : undefined
        }
        size="lg"
        busy={saving}
        footer={sheetFooter}
      >
        {active && (
          <div className="text-base text-gray-900 dark:text-gray-100">
            <div className="mb-3 text-sm text-slate-600 dark:text-slate-300">
              สร้างเมื่อ: {formatDate(active.regis_date)}
              {editing && <span className="ml-2 font-medium text-indigo-700 dark:text-indigo-300">· กำลังแก้ไข</span>}
            </div>

            {/* ข้อมูลหุ้น */}
            <div className="mb-4 rounded-2xl border border-indigo-200 bg-indigo-50/60 p-4 dark:border-indigo-400/40 dark:bg-indigo-900/10">
              <div className="mb-2 text-base font-semibold text-indigo-800 dark:text-indigo-200">ข้อมูลหุ้น</div>
              <div className="rounded-xl border border-slate-200 bg-white/70 p-4 dark:border-slate-700 dark:bg-slate-700/40">
                <div className="text-sm text-slate-600 dark:text-slate-300">ยอดหุ้นสะสม</div>
                <div className="mt-1 text-2xl font-semibold tabular-nums text-gray-900 dark:text-gray-100">{formatShares(active?.total_shares)}</div>
              </div>
            </div>

            {/* โครงการที่เข้าร่วม */}
            <div className="mb-4 rounded-2xl border border-emerald-200 bg-emerald-50/60 p-4 dark:border-emerald-400/40 dark:bg-emerald-900/10">
              <div className="mb-2 text-base font-semibold text-emerald-800 dark:text-emerald-200">โครงการที่เข้าร่วม</div>
              {!editing ? <ProgramBadges row={active} /> : <ProgramToggles value={draft} onChange={onToggleProgram} />}
            </div>

            {rowError && (
              <div role="alert" className="mb-4 rounded-xl border border-red-200 bg-red-50 p-3 text-base text-red-700 dark:border-red-400 dark:bg-red-900/20 dark:text-red-200">
                {rowError}
              </div>
            )}

            {/* ข้อมูลทั่วไป */}
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              {[
                { key: "first_name", label: "ชื่อ", type: "text" },
                { key: "last_name", label: "นามสกุล", type: "text" },
                ...FIELD_CONFIG.filter((f) => !LAND_KEYS.includes(f.key) && f.key !== "first_name" && f.key !== "last_name"),
              ].map((f) => {
                const val = editing ? draft?.[f.key] ?? "" : active?.[f.key]
                const fid = `member-f-${f.key}`
                return (
                  <div key={f.key}>
                    <label htmlFor={editing ? fid : undefined} className="mb-1.5 block text-sm font-medium text-slate-600 dark:text-slate-300">
                      {f.label}
                    </label>
                    {!editing ? (
                      <div className={readCls}>
                        {(f.type === "date" || f.type === "date-optional")
                          ? formatDate(val)
                          : f.options && val !== "" && val != null
                            ? (f.options.find((op) => op.value === String(val))?.label ?? val)
                            : (f.key === "normal_share" ? formatShares(val) : (val === "" || val == null ? "-" : val))}
                      </div>
                    ) : f.options ? (
                      <select id={fid} className={inputCls} value={val ?? ""} onChange={(e) => onChangeField(f.key, e.target.value)}>
                        {f.options.map((op) => (
                          <option key={op.value} value={op.value}>{op.label}</option>
                        ))}
                      </select>
                    ) : f.type === "date" || f.type === "date-optional" ? (
                      <input id={fid} type="date" className={inputCls} value={val ?? ""} onChange={(e) => onChangeField(f.key, e.target.value)} />
                    ) : (
                      <input
                        id={fid}
                        className={inputCls}
                        value={val ?? ""}
                        inputMode={inputModeFor(f.type)}
                        maxLength={f.type === "cid" ? 13 : undefined}
                        onChange={(e) => onChangeField(f.key, e.target.value)}
                        placeholder={f.type === "cid" ? "13 หลัก" : ""}
                      />
                    )}
                  </div>
                )
              })}
            </div>

            {/* ข้อมูลที่ดิน */}
            <div className="mt-6 rounded-2xl border border-emerald-200 bg-emerald-50/60 p-4 dark:border-emerald-400/40 dark:bg-emerald-900/10">
              <div className="mb-3 text-lg font-semibold text-emerald-800 dark:text-emerald-200">ข้อมูลที่ดิน</div>
              {[
                { title: "ถือครอง", keys: ["own_rai","own_ngan","own_wa"] },
                { title: "เช่าทำกิน", keys: ["rent_rai","rent_ngan","rent_wa"] },
                { title: "อื่นๆ", keys: ["other_rai","other_ngan","other_wa"] },
              ].map((sec) => (
                <div key={sec.title} className="mb-4 last:mb-0">
                  <div className="mb-1.5 text-base font-medium text-slate-700 dark:text-slate-300">{sec.title}</div>
                  <div className="grid grid-cols-3 gap-3">
                    {sec.keys.map((k) => {
                      const label = k.endsWith("_rai") ? "ไร่" : k.endsWith("_ngan") ? "งาน" : "ตารางวา"
                      const val = editing ? draft?.[k] ?? 0 : (active?.[k] ?? 0)
                      return (
                        <div key={k}>
                          {!editing ? (
                            <div className={cx(readCls, "tabular-nums")}>{val}</div>
                          ) : (
                            <input
                              inputMode="numeric"
                              aria-label={`${sec.title} (${label})`}
                              className={cx(inputCls, "tabular-nums")}
                              value={val}
                              onChange={(e) => setDraft((p) => ({ ...p, [k]: clampLandValue(k, e.target.value) }))}
                              placeholder={label}
                            />
                          )}
                          <div className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                            {label}{k.endsWith("_ngan") && " (0–3)"}{k.endsWith("_wa") && " (0–99)"}
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </Sheet>
    </div>
  )
}

export default MemberSearch
