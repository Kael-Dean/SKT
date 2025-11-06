// src/pages/MemberSearch.jsx
import { useEffect, useMemo, useState } from "react"
import { apiAuth } from "../lib/api"   // ✅ ใช้ helper แนบโทเคนอัตโนมัติ

/** ---------- Utils ---------- */
const onlyDigits = (s = "") => s.replace(/\D+/g, "")

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

/** พยายามดึงค่า "ยอดหุ้นปัจจุบัน" จาก response ได้หลายรูปแบบ */
function extractCurrentShare(resp) {
  try {
    if (resp == null) return null
    if (typeof resp === "number") return Number.isFinite(resp) ? resp : null
    if (typeof resp === "string") {
      const n = Number(resp)
      return Number.isFinite(n) ? n : null
    }
    const cand =
      resp.total_share_after ??
      resp.total_share ??
      resp.current_share ??
      resp.balance ??
      resp.share_total ??
      resp?.data?.total_share
    if (cand == null) return null
    const n = Number(cand)
    return Number.isFinite(n) ? n : null
  } catch {
    return null
  }
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
  { key: "member_id", label: "เลขสมาชิก", type: "number" },
  { key: "precode", label: "คำนำหน้า (รหัส)", type: "number" },
  { key: "first_name", label: "ชื่อ", type: "text" },
  { key: "last_name", label: "นามสกุล", type: "text" },
  { key: "citizen_id", label: "เลขบัตรประชาชน", type: "cid" },
  { key: "sex", label: "เพศ (M/F)", type: "select", options: ["", "M", "F"] },
  { key: "phone_number", label: "โทรศัพท์", type: "text" },
  { key: "address", label: "ที่อยู่", type: "text" },
  { key: "mhoo", label: "หมู่", type: "text" },
  { key: "sub_district", label: "ตำบล", type: "text" },
  { key: "district", label: "อำเภอ", type: "text" },
  { key: "province", label: "จังหวัด", type: "text" },
  { key: "postal_code", label: "รหัสไปรษณีย์", type: "number" },
  { key: "subprov", label: "อำเภอย่อย/รหัสอำเภอ", type: "number" },
  { key: "salary", label: "เงินเดือน", type: "decimal" },
  { key: "tgs_group", label: "กลุ่ม", type: "number" },
  { key: "share_per_month", label: "ส่งหุ้น/เดือน", type: "decimal" },
  { key: "ar_limit", label: "วงเงินสินเชื่อ", type: "number" },
  { key: "normal_share", label: "หุ้นปกติ", type: "decimal" }, // 👈 โหมดดูจะโชว์ยอดหุ้นปัจจุบันแทน
  { key: "bank_account", label: "บัญชีธนาคาร", type: "text" },
  { key: "tgs_id", label: "รหัสสมาชิกในระบบ (tgs_id)", type: "text" },
  { key: "spouce_name", label: "ชื่อคู่สมรส", type: "text" },
  { key: "orders_placed", label: "จำนวนครั้งที่ซื้อ", type: "number" },
  { key: "regis_date", label: "วันที่สมัคร", type: "date" },
  { key: "last_bought_date", label: "วันที่ซื้อครั้งล่าสุด", type: "date" },
  { key: "transfer_date", label: "วันที่โอน (ไม่ระบุก็ได้)", type: "date-optional" },
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
  { key: "district", label: "อำเภอ", render: (row) => row.district ?? "-" },   // 👈 ใหม่
  { key: "regis_date", label: "วันที่สมัคร", render: (row) => formatDate(row.regis_date) },
  { key: "__programs", label: "โครงการ", render: (row) => <ProgramBadges row={row} /> },
]

/** ทำให้เรคคอร์ด “ครบคีย์” + ทำความสะอาดเบื้องต้น */
function normalizeRecord(raw = {}) {
  const out = {
    asso_id: raw.asso_id ?? raw.assoId ?? raw.id ?? null,
    member_id: raw.member_id ?? raw.memberId ?? null,

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

  // modal
  const [open, setOpen] = useState(false)
  const [active, setActive] = useState(null)
  const [draft, setDraft] = useState(null)
  const [editing, setEditing] = useState(false)
  const [saving, setSaving] = useState(false)
  const [rowError, setRowError] = useState("")
  // หุ้นปัจจุบัน (แสดงแทน normal_share เมื่อดูรายละเอียด)
  const [currentShare, setCurrentShare] = useState(null)
  const [currentShareLoading, setCurrentShareLoading] = useState(false)
  const [currentShareError, setCurrentShareError] = useState("")

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
        // ✅ ใช้ apiAuth (แนบ token + จัดการ 401)
        const data = await apiAuth(`/member/members/search?q=${encodeURIComponent(term)}`)
        const normalized = (Array.isArray(data) ? data : []).map(normalizeRecord)
        setRows(normalized)
      } catch (e) {
        setError(e?.message || "ค้นหาไม่สำเร็จ")
      } finally {
        setLoading(false)
      }
    }
    run()
  }, [dq])

  const openModal = (row) => {
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
    setEditing(false)
    setOpen(true)

    // โหลดยอดหุ้นปัจจุบันตามจริง (ถ้ามี tgs_id)
    setCurrentShare(null)
    setCurrentShareError("")
    if (r?.tgs_id) {
      ;(async () => {
        try {
          setCurrentShareLoading(true)
          // ลองหลาย endpoint เผื่อ BE ตั้งชื่อแตกต่างกัน
          const tgs = encodeURIComponent(r.tgs_id)
          const endpoints = [
            `/share/${tgs}`,
            `/share/${tgs}/balance`,
            `/share/${tgs}/summary`,
          ]
          let found = null
          for (const ep of endpoints) {
            try {
              const resp = await apiAuth(ep)
              const val = extractCurrentShare(resp)
              if (val != null) { found = val; break }
            } catch (_e) {
              // ลอง endpoint ถัดไป
            }
          }
          if (found != null) setCurrentShare(found)
          else setCurrentShareError("ไม่พบข้อมูลยอดหุ้นปัจจุบัน")
        } catch (e) {
          setCurrentShareError(e?.message || "ดึงยอดหุ้นปัจจุบันไม่สำเร็จ")
        } finally {
          setCurrentShareLoading(false)
        }
      })()
    }
  }

  const closeModal = () => {
    setOpen(false)
    setActive(null)
    setDraft(null)
    setEditing(false)
    setSaving(false)
    setRowError("")
    setCurrentShare(null)
    setCurrentShareLoading(false)
    setCurrentShareError("")
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

  // บันทึก: รวมฟิลด์โครงการไปด้วย
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
      if (!idForPatch && idForPatch !== 0) throw new Error("ไม่พบเลขสมาชิก (member_id) สำหรับบันทึก")

      // optimistic update
      const prev = rows
      setRows((cur) => cur.map((x) => (x.member_id === active.member_id ? { ...x, ...diff } : x)))

      // ✅ ใช้ apiAuth แทน fetch ตรง
      const updatedRaw = await apiAuth(`/member/members/${idForPatch}`, {
        method: "PATCH",
        body: diff,
      })

      const updated = normalizeRecord(updatedRaw)
      setRows((cur) => cur.map((x) => (x.member_id === updated.member_id ? updated : x)))
      setActive(updated)

      // refresh draft
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
      // rollback ถ้า error
      setRows((cur) => cur) // state คงไว้
      setRowError(e?.message || "บันทึกไม่สำเร็จ")
    } finally {
      setSaving(false)
    }
  }

  const loaderCols = TABLE_COLUMNS.length + 1 // + Actions column

  return (
    <div className="min-h-screen rounded-2xl bg-white text-black dark:bg-slate-900 dark:text-white">
      <div className="mx-auto max-w-6xl p-4 md:p-6 text-base md:text-lg">
        <h1 className="mb-4 text-2xl md:text-3xl font-bold">🔎 ค้นหาสมาชิก</h1>

        {/* การ์ดค้นหา */}
        <div className="rounded-2xl border border-slate-200/60 bg-white/85 p-5 md:p-6 shadow-sm backdrop-blur dark:border-white/10 dark:bg-slate-900/40">
          <label className="mb-2 block text-sm md:text-base text-slate-700 dark:text-slate-300">คำค้นหา</label>
          <div className="relative">
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="ค้นหาตามชื่อหรือนามสกุล หรือเลขบัตรประชาชน"
              className="w-full rounded-2xl border border-slate-200 bg-white px-5 py-3 pr-12 text-base outline-none transition placeholder:text-slate-400 focus:border-emerald-400 focus:ring-2 focus:ring-emerald-200 dark:border-white/10 dark:bg-slate-800 dark:placeholder:text-slate-400 dark:focus:border-emerald-500 dark:focus:ring-emerald-500/20"
            />
            <span className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-500">
              🔍
            </span>
          </div>
          <div className="mt-2 text-xs md:text-sm text-slate-500 dark:text-slate-400">
            {dq ? (loading ? <>กำลังค้นหา “{dq}”...</> : <>ผลลัพธ์ {rows.length.toLocaleString()} รายการ</>) : <>พิมพ์อย่างน้อย 1 ตัวอักษรเพื่อค้นหา</>}
          </div>
          {hint && !loading && dq && (
            <div className="mt-1 text-xs md:text-sm text-slate-500">{hint}</div>
          )}
          {error && (
            <div className="mt-3 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-400 dark:bg-red-900/20 dark:text-red-200">
              {error}
            </div>
          )}
        </div>

        {/* ตาราง */}
        <div className="mt-5 rounded-2xl border border-slate-200/60 bg-white/85 shadow-sm backdrop-blur dark:border-white/10 dark:bg-slate-900/40">
          <div className="overflow-x-auto rounded-2xl">
            <table className="w-full text-base tabular-nums">
              <thead className="text-slate-700 dark:text-slate-100">
                <tr className="sticky top-0 z-10 bg-slate-50/95 supports-[backdrop-filter]:bg-slate-50/60 dark:bg-slate-700/60">
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
                {loading &&
                  Array.from({ length: 8 }).map((_, i) => (
                    <tr key={`sk-${i}`} className="animate-pulse dark:odd:bg-slate-800/30 dark:even:bg-slate-800/20">
                      {Array.from({ length: loaderCols }).map((__, j) => (
                        <td key={j} className="px-5 py-4">
                          <div className="h-4 w-28 rounded bg-slate-200/70 dark:bg-slate-700/60" />
                        </td>
                      ))}
                    </tr>
                  ))}

                {!loading && dq && rows.length === 0 && (
                  <tr className="odd:bg-white/90 even:bg-slate-50/70 dark:odd:bg-slate-800/40 dark:even:bg-slate-800/25">
                    <td className="px-5 py-8 text-center text-slate-500 dark:text-slate-300" colSpan={loaderCols}>
                      ไม่พบข้อมูลที่ตรงกับ “{dq}”
                    </td>
                  </tr>
                )}

                {!loading &&
                  rows.map((r) => (
                    <tr
                      key={r.asso_id ?? r.member_id ?? r.citizen_id ?? Math.random()}
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
                          className="whitespace-nowrap rounded-2xl bg-emerald-600/90 px-4 py-2 text-sm md:text-base font-semibold text-white shadow-sm ring-1 ring-emerald-700/50 hover:bg-emerald-600 active:scale-[.98] dark:bg-emerald-500/85 dark:hover:bg-emerald-500"
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
      </div>

      {/* Modal */}
      <div className={`fixed inset-0 z-50 ${open ? "pointer-events-auto" : "pointer-events-none"}`} aria-hidden={!open}>
        <div className={`absolute inset-0 bg-black/60 transition-opacity ${open ? "opacity-100" : "opacity-0"}`} onClick={closeModal} />
        <div className="absolute inset-0 flex items-center justify-center p-3 sm:p-5">
          <div className={`h-[88vh] w-[96vw] max-w-[1280px] transform overflow-hidden rounded-2xl bg-white text-black shadow-2xl transition-all dark:bg-slate-800 dark:text-white ${open ? "scale-100 opacity-100" : "scale-95 opacity-0"}`}>
            <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4 dark:border-slate-700">
              <div className="text-xl md:text-2xl font-semibold">
                {active
                  ? `รายละเอียดสมาชิก #${active.member_id ?? (active.asso_id ? String(active.asso_id).slice(0, 8) : "-")}`
                  : "รายละเอียดสมาชิก"}
              </div>
              <button
                type="button"
                onClick={closeModal}
                className="rounded-xl border border-slate-300 px-4 py-2 text-base hover:bg-slate-50 dark:border-slate-600 dark:hover:bg-slate-700"
              >
                ปิด
              </button>
            </div>

            <div className="h-[calc(88vh-64px)] overflow-y-auto p-4 md:p-6 text-base md:text-lg">
              {!active ? (
                <div className="text-slate-600 dark:text-slate-300">ไม่มีข้อมูล</div>
              ) : (
                <>
                  <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                    <div className="text-sm md:text-base text-slate-600 dark:text-slate-300">
                      สร้างเมื่อ: {formatDate(active.regis_date)} • ซื้อครั้งล่าสุด: {formatDate(active.last_bought_date)}
                    </div>

                    {!editing ? (
                      <button
                        type="button"
                        onClick={() => setEditing(true)}
                        className="rounded-2xl bg-emerald-600 px-4 py-2 text-base font-semibold text-white hover:bg-emerald-700 active:scale-[.98]"
                      >
                        แก้ไข
                      </button>
                    ) : (
                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={save}
                          disabled={saving}
                          className="rounded-2xl bg-emerald-600 px-5 py-2 text-base font-semibold text-white hover:bg-emerald-700 active:scale-[.98] disabled:opacity-60"
                        >
                          {saving ? "กำลังบันทึก..." : "บันทึก"}
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setEditing(false)
                            openModal(active)
                          }}
                          className="rounded-2xl border border-slate-300 px-5 py-2 text-base hover:bg-slate-50 dark:border-slate-600 dark:hover:bg-slate-700"
                        >
                          ยกเลิก
                        </button>
                      </div>
                    )}
                  </div>

                  {/* 📈 ข้อมูลหุ้น */}
                  <div className="mb-5 rounded-2xl border border-indigo-200 bg-indigo-50/60 p-4 dark:border-indigo-400 dark:bg-indigo-900/10">
                    <div className="mb-2 text-base font-semibold text-indigo-800 dark:text-indigo-200">📈 ข้อมูลหุ้น</div>
                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                      {/* ยอดหุ้นปัจจุบัน */}
                      <div className="rounded-xl border border-slate-200 bg-white/70 p-4 dark:border-slate-700 dark:bg-slate-700/40">
                        <div className="text-sm text-slate-600 dark:text-slate-300">ยอดหุ้นปัจจุบัน</div>
                        <div className="mt-1 text-2xl font-semibold">
                          {currentShareLoading
                            ? "กำลังโหลด..."
                            : formatShares(currentShare)}
                        </div>
                        {!!currentShareError && (
                          <div className="mt-1 text-xs text-red-600 dark:text-red-300">{currentShareError}</div>
                        )}
                      </div>
                      {/* ยอดหุ้นสะสม (total_shares) */}
                      <div className="rounded-xl border border-slate-200 bg-white/70 p-4 dark:border-slate-700 dark:bg-slate-700/40">
                        <div className="text-sm text-slate-600 dark:text-slate-300">ยอดหุ้นสะสม (total_shares)</div>
                        <div className="mt-1 text-2xl font-semibold">
                          {formatShares(active?.total_shares)}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* โครงการที่เข้าร่วม */}
                  <div className="mb-5 rounded-2xl border border-emerald-200 bg-emerald-50/60 p-4 dark:border-emerald-400 dark:bg-emerald-900/10">
                    <div className="mb-2 text-base font-semibold text-emerald-800 dark:text-emerald-200">🎯 โครงการที่เข้าร่วม</div>
                    {!editing ? (
                      <ProgramBadges row={active} />
                    ) : (
                      <ProgramToggles value={draft} onChange={onToggleProgram} />
                    )}
                  </div>

                  {rowError && (
                    <div className="mb-4 rounded-xl border border-red-200 bg-red-50 p-3 text-base text-red-700 dark:border-red-400 dark:bg-red-900/20 dark:text-red-200">
                      {rowError}
                    </div>
                  )}

                  {/* ข้อมูลทั่วไป */}
                  <div className="grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-3">
                    {/* ✅ แถวแรกมีเฉพาะ "ชื่อ" และ "นามสกุล" อยู่บรรทัดเดียวกัน */}
                    <div className="md:col-span-2 xl:col-span-3">
                      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
                        {/* ชื่อ */}
                        <div>
                          <label className="mb-1.5 block text-sm md:text-base font-medium text-slate-600 dark:text-slate-300">
                            ชื่อ
                          </label>
                          {!editing ? (
                            <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-base dark:border-slate-700 dark:bg-slate-700/60">
                              {active?.first_name ?? "-"}
                            </div>
                          ) : (
                            <input
                              className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-base text-black placeholder:text-slate-400 outline-none focus:border-emerald-500 dark:border-slate-600 dark:bg-slate-700 dark:text-white"
                              value={draft?.first_name ?? ""}
                              onChange={(e) => onChangeField("first_name", e.target.value)}
                              placeholder="ชื่อ"
                            />
                          )}
                        </div>

                        {/* นามสกุล */}
                        <div>
                          <label className="mb-1.5 block text-sm md:text-base font-medium text-slate-600 dark:text-slate-300">
                            นามสกุล
                          </label>
                          {!editing ? (
                            <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-base dark:border-slate-700 dark:bg-slate-700/60">
                              {active?.last_name ?? "-"}
                            </div>
                          ) : (
                            <input
                              className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-base text-black placeholder:text-slate-400 outline-none focus:border-emerald-500 dark:border-slate-600 dark:bg-slate-700 dark:text-white"
                              value={draft?.last_name ?? ""}
                              onChange={(e) => onChangeField("last_name", e.target.value)}
                              placeholder="นามสกุล"
                            />
                          )}
                        </div>
                      </div>
                    </div>

                    {/* ฟิลด์อื่น ๆ (ยกเว้น first_name/last_name และ LAND_KEYS) */}
                    {FIELD_CONFIG
                      .filter(f => !LAND_KEYS.includes(f.key) && f.key !== "first_name" && f.key !== "last_name")
                      .map((f) => {
                        const val = editing ? draft?.[f.key] ?? "" : active?.[f.key]
                        return (
                          <div key={f.key}>
                            <label className="mb-1.5 block text-sm md:text-base font-medium text-slate-600 dark:text-slate-300">{f.label}</label>
                            {!editing ? (
                              <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-base dark:border-slate-700 dark:bg-slate-700/60">
                                {/* 👇 โหมดดู: ถ้าเป็น normal_share ให้แสดง currentShare ที่ดึงมาจริง */}
                                {f.key === "normal_share"
                                  ? (currentShareLoading
                                      ? "กำลังดึงยอดหุ้น..."
                                      : formatShares(currentShare ?? val))
                                  : (f.type === "date" || f.type === "date-optional"
                                      ? formatDate(val)
                                      : (val ?? "-"))}
                              </div>
                            ) : f.type === "select" ? (
                              <select
                                className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-base text-black outline-none focus:border-emerald-500 dark:border-slate-600 dark:bg-slate-700 dark:text-white"
                                value={val ?? ""}
                                onChange={(e) => onChangeField(f.key, e.target.value)}
                              >
                                {f.options.map((op) => (
                                  <option key={op} value={op}>{op === "" ? "— เลือก —" : op}</option>
                                ))}
                              </select>
                            ) : f.type === "date" || f.type === "date-optional" ? (
                              <input
                                type="date"
                                className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-base text-black outline-none focus:border-emerald-500 dark:border-slate-600 dark:bg-slate-700 dark:text-white"
                                value={val ?? ""}
                                onChange={(e) => onChangeField(f.key, e.target.value)}
                              />
                            ) : (
                              <input
                                className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-base text-black placeholder:text-slate-400 outline-none focus:border-emerald-500 dark:border-slate-600 dark:bg-slate-700 dark:text-white"
                                value={val ?? ""}
                                onChange={(e) => onChangeField(f.key, e.target.value)}
                                placeholder={f.type === "cid" ? "13 หลัก" : ""}
                              />
                            )}
                          </div>
                        )
                      })}
                  </div>

                  {/* ข้อมูลที่ดิน */}
                  <div className="mt-7 rounded-2xl border border-emerald-200 bg-emerald-50/60 p-5 dark:border-emerald-400 dark:bg-emerald-900/10">
                    <div className="mb-3 text-lg font-semibold text-emerald-800 dark:text-emerald-200">🌾 ข้อมูลที่ดิน</div>

                    {[
                      { title: "ถือครอง", keys: ["own_rai","own_ngan","own_wa"] },
                      { title: "เช่าทำกิน", keys: ["rent_rai","rent_ngan","rent_wa"] },
                      { title: "อื่นๆ", keys: ["other_rai","other_ngan","other_wa"] },
                    ].map((sec) => (
                      <div key={sec.title} className="mb-5 last:mb-0">
                        <div className="mb-1.5 text-base font-medium text-slate-700 dark:text-slate-300">{sec.title}</div>
                        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                          {sec.keys.map((k) => {
                            const label = k.endsWith("_rai") ? "ไร่" : k.endsWith("_ngan") ? "งาน" : "ตารางวา"
                            const val = editing ? draft?.[k] ?? 0 : (active?.[k] ?? 0)
                            return (
                              <div key={k}>
                                {!editing ? (
                                  <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-base dark:border-slate-700 dark:bg-slate-700/60">
                                    {val}
                                  </div>
                                ) : (
                                  <input
                                    inputMode="numeric"
                                    className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-base text-black outline-none focus:border-emerald-500 dark:border-slate-600 dark:bg-slate-700 dark:text-white"
                                    value={val}
                                    onChange={(e) => {
                                      const newVal = e.target.value
                                      const n = Number(onlyDigits(String(newVal ?? "")))
                                      const clamped =
                                        k.endsWith("_ngan") ? Math.min(Math.max(n, 0), 3) :
                                        k.endsWith("_wa") ? Math.min(Math.max(n, 0), 99) :
                                        Math.max(n, 0)
                                      setDraft((p) => ({ ...p, [k]: clamped }))
                                    }}
                                    placeholder={label}
                                  />
                                )}
                                <div className="mt-1 text-xs md:text-sm text-slate-500 dark:text-slate-400">
                                  {label}{k.endsWith("_ngan") && " (0–3)"}{k.endsWith("_wa") && " (0–99)"}
                                </div>
                              </div>
                            )
                          })}
                        </div>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default MemberSearch
