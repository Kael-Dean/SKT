import { useEffect, useMemo, useState } from "react"

/** ---------- ENV ---------- */
const API_BASE = import.meta.env.VITE_API_BASE || ""

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
  // รูปแบบไทย 26/07/2566 หรือ 26/07/2023
  if (typeof v === "string" && /^\d{2}\/\d{2}\/\d{4}$/.test(v)) {
    const [dd, mm, yyyyRaw] = v.split("/")
    const yyyy = Number(yyyyRaw) > 2500 ? Number(yyyyRaw) - 543 : Number(yyyyRaw)
    const d = new Date(Date.UTC(yyyy, Number(mm) - 1, Number(dd)))
    return isNaN(d) ? "" : d.toISOString().slice(0, 10)
  }
  // timestamp/ISO
  const d = new Date(v)
  return isNaN(d) ? "" : d.toISOString().slice(0, 10)
}

/** แสดงวันที่แบบไทย; ถ้าไม่ได้ให้ "-" */
function formatDate(v) {
  if (!v) return "-"
  // ถ้าเป็นรูปแบบไทยอยู่แล้วก็แสดงเลย
  if (typeof v === "string" && /^\d{2}\/\d{2}\/\d{4}$/.test(v)) return v
  try {
    const d = new Date(v)
    if (isNaN(d)) return "-"
    return d.toLocaleDateString("th-TH", { day: "2-digit", month: "2-digit", year: "numeric" })
  } catch {
    return "-"
  }
}

/** ---------- ฟิลด์ทั้งหมด ---------- */
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
  { key: "normal_share", label: "หุ้นปกติ", type: "decimal" },
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

/** คอลัมน์ตาราง */
const TABLE_COLUMNS = [
  { key: "first_name", label: "ชื่อ" },
  { key: "last_name", label: "นามสกุล" },
  { key: "citizen_id", label: "เลขบัตรประชาชน" },
  { key: "phone_number", label: "โทรศัพท์" },
  { key: "province", label: "จังหวัด" },
  { key: "regis_date", label: "วันที่สมัคร", render: (v) => formatDate(v) },
]

/** ทำให้เรคคอร์ด “ครบคีย์” + แก้ชื่อคีย์ที่ต่างกัน + ทำความสะอาดเบื้องต้น */
function normalizeRecord(raw = {}) {
  const out = {
    id: raw.id ?? raw.member_pk ?? null,
    member_id: raw.member_id ?? raw.memberId ?? raw.id ?? null,
    first_name: raw.first_name ?? raw.firstname ?? "",
    last_name: raw.last_name ?? raw.lastname ?? "",
    citizen_id: onlyDigits(raw.citizen_id ?? raw.citizenId ?? ""),
    phone_number: raw.phone_number ?? raw.phone ?? "-",
    address: raw.address ?? "",
    mhoo: raw.mhoo ?? raw.moo ?? "",
    sub_district: raw.sub_district ?? raw.subdistrict ?? "",
    district: raw.district ?? "",
    province: raw.province ?? "",
    postal_code: raw.postal_code ?? raw.postalCode ?? "",
    subprov: raw.subprov ?? "",
    sex: raw.sex ?? "",
    salary: raw.salary ?? "",
    tgs_group: raw.tgs_group ?? "",
    share_per_month: raw.share_per_month ?? "",
    ar_limit: raw.ar_limit ?? "",
    normal_share: raw.normal_share ?? "",
    bank_account: raw.bank_account ?? "",
    tgs_id: raw.tgs_id ?? "",
    spouce_name: raw.spouce_name ?? "",
    orders_placed: raw.orders_placed ?? "",
    regis_date: raw.regis_date ?? raw.created_at ?? raw.registered_at ?? "",
    last_bought_date: raw.last_bought_date ?? "",
    transfer_date: raw.transfer_date ?? "",
    own_rai: raw.own_rai ?? 0,
    own_ngan: raw.own_ngan ?? 0,
    own_wa: raw.own_wa ?? 0,
    rent_rai: raw.rent_rai ?? 0,
    rent_ngan: raw.rent_ngan ?? 0,
    rent_wa: raw.rent_wa ?? 0,
    other_rai: raw.other_rai ?? 0,
    other_ngan: raw.other_ngan ?? 0,
    other_wa: raw.other_wa ?? 0,
  }
  // ให้ครบตาม FIELD_CONFIG (กัน field หาย)
  FIELD_CONFIG.forEach(({ key }) => {
    if (!(key in out)) out[key] = LAND_KEYS.includes(key) ? 0 : ""
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
        const res = await fetch(`${API_BASE}/member/members/search?q=${encodeURIComponent(term)}`)
        if (!res.ok) throw new Error(await res.text())
        const data = await res.json()
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
    const r = normalizeRecord(row) // กัน key หาย/ชื่อไม่ตรง
    setActive(r)

    // เตรียม draft สำหรับแก้ไข (date -> yyyy-mm-dd แบบปลอดภัย)
    const d = {}
    FIELD_CONFIG.forEach(({ key, type }) => {
      let v = r[key]
      if (LAND_KEYS.includes(key)) v = typeof v === "number" ? v : 0
      else if (type === "date" || type === "date-optional") v = toInputDateSafely(v)
      else if (type === "cid") v = onlyDigits(String(v)).slice(0, 13)
      else v = v ?? ""
      d[key] = v
    })
    setDraft(d)
    setRowError("")
    setEditing(false)
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

  // (ตัวอย่าง) บันทึกแบบ PATCH — คุณอาจต้องเปลี่ยน path/id ให้ตรง backend จริง
  const save = async () => {
    if (!active) return
    setRowError("")
    setSaving(true)
    try {
      // สร้าง diff แบบง่าย
      const diff = {}
      FIELD_CONFIG.forEach(({ key, type }) => {
        const oldV = active[key]
        let newV = draft[key]
        if (type === "date" || type === "date-optional") {
          newV = newV ? new Date(newV).toISOString() : null
        } else if (type === "number" || type === "decimal" || LAND_KEYS.includes(key)) {
          newV = newV === "" || newV == null ? 0 : Number(newV)
        }
        if (oldV !== newV) diff[key] = newV
      })

      // อัพเดต optimistically
      const idForPatch = active.member_id ?? active.id
      if (!idForPatch) throw new Error("ไม่พบรหัสสมาชิกสำหรับบันทึก")

      const prev = rows
      setRows((cur) => cur.map((x) => (x.member_id === active.member_id ? { ...x, ...diff } : x)))

      const res = await fetch(`${API_BASE}/member/members/${idForPatch}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(diff),
      })
      if (!res.ok) {
        setRows(prev) // rollback
        throw new Error((await res.text()) || "บันทึกไม่สำเร็จ")
      }

      const updated = normalizeRecord(await res.json())
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
      setDraft(nd)
      setEditing(false)
    } catch (e) {
      setRowError(e?.message || "บันทึกไม่สำเร็จ")
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="min-h-screen rounded-2xl bg-white text-black dark:bg-slate-900 dark:text-white">
      <div className="mx-auto max-w-6xl p-4 md:p-6">
        <h1 className="mb-4 text-2xl font-bold">🔎 ค้นหาสมาชิก</h1>

        {/* การ์ดค้นหา */}
        <div className="rounded-2xl border border-slate-200/60 bg-white/85 p-4 shadow-sm backdrop-blur dark:border-white/10 dark:bg-slate-900/40">
          <label className="mb-2 block text-sm text-slate-700 dark:text-slate-300">คำค้นหา</label>
          <div className="relative">
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="ค้นหาตามชื่อหรือนามสกุล"
              className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-2.5 pr-10 text-sm outline-none transition placeholder:text-slate-400 focus:border-emerald-400 focus:ring-2 focus:ring-emerald-200 dark:border-white/10 dark:bg-slate-800 dark:placeholder:text-slate-400 dark:focus:border-emerald-500 dark:focus:ring-emerald-500/20"
            />
            <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-500">
              🔍
            </span>
          </div>
          <div className="mt-2 text-xs text-slate-500 dark:text-slate-400">
            {dq ? (loading ? <>กำลังค้นหา “{dq}”...</> : <>ผลลัพธ์ {rows.length.toLocaleString()} รายการ</>) : <>พิมพ์อย่างน้อย 1 ตัวอักษรเพื่อค้นหา</>}
          </div>
        </div>

        {/* ตาราง */}
        <div className="mt-5 rounded-2xl border border-slate-200/60 bg-white/85 shadow-sm backdrop-blur dark:border-white/10 dark:bg-slate-900/40">
          <div className="overflow-x-auto rounded-2xl">
            <table className="w-full text-sm tabular-nums">
              <thead className="text-slate-700 dark:text-slate-100">
                <tr className="sticky top-0 z-10 bg-slate-50/95 supports-[backdrop-filter]:bg-slate-50/60 dark:bg-slate-700/60">
                  {TABLE_COLUMNS.map((c) => (
                    <th key={c.key} className="whitespace-nowrap px-4 py-3 text-left text-[13px] font-semibold">
                      {c.label}
                    </th>
                  ))}
                  <th className="px-4 py-3 text-right text-[13px] font-semibold">การกระทำ</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200/70 dark:divide-white/8">
                {loading &&
                  Array.from({ length: 8 }).map((_, i) => (
                    <tr key={`sk-${i}`} className="animate-pulse dark:odd:bg-slate-800/30 dark:even:bg-slate-800/20">
                      {Array.from({ length: 7 }).map((__, j) => (
                        <td key={j} className="px-4 py-3">
                          <div className="h-3.5 w-24 rounded bg-slate-200/70 dark:bg-slate-700/60" />
                        </td>
                      ))}
                    </tr>
                  ))}

                {!loading && dq && rows.length === 0 && (
                  <tr className="odd:bg-white/90 even:bg-slate-50/70 dark:odd:bg-slate-800/40 dark:even:bg-slate-800/25">
                    <td className="px-4 py-6 text-center text-slate-500 dark:text-slate-300" colSpan={7}>
                      ไม่พบข้อมูลที่ตรงกับ “{dq}”
                    </td>
                  </tr>
                )}

                {!loading &&
                  rows.map((r) => (
                    <tr
                      key={r.member_id ?? r.id ?? r.citizen_id}
                      className="odd:bg-white/90 even:bg-slate-50/70 hover:bg-emerald-50/70 dark:odd:bg-slate-800/40 dark:even:bg-slate-800/25 dark:hover:bg-emerald-400/10 transition-colors"
                    >
                      {TABLE_COLUMNS.map((c) => (
                        <td key={c.key} className="px-4 py-3">
                          {c.render ? c.render(r[c.key]) : (r[c.key] ?? "-")}
                        </td>
                      ))}
                      <td className="px-4 py-3 text-right">
                        <button
                          type="button"
                          onClick={() => openModal(r)}
                          className="rounded-xl bg-emerald-600/90 px-3 py-1.5 text-sm font-medium text-white shadow-sm ring-1 ring-emerald-700/50 hover:bg-emerald-600 active:scale-[.98] dark:bg-emerald-500/85 dark:hover:bg-emerald-500"
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
        <div className="absolute inset-0 flex items-center justify-center p-2 sm:p-4">
          <div className={`h-[85vh] w-[95vw] max-w-[1200px] transform overflow-hidden rounded-2xl bg-white text-black shadow-2xl transition-all dark:bg-slate-800 dark:text-white ${open ? "scale-100 opacity-100" : "scale-95 opacity-0"}`}>
            <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3 dark:border-slate-700">
              <div className="text-lg font-semibold">
                {active ? `รายละเอียดสมาชิก #${active.member_id ?? active.id ?? "-"}` : "รายละเอียดสมาชิก"}
              </div>
              <button type="button" onClick={closeModal} className="rounded-lg border border-slate-300 px-3 py-1 hover:bg-slate-50 dark:border-slate-600 dark:hover:bg-slate-700">
                ปิด
              </button>
            </div>

            <div className="h-[calc(85vh-56px)] overflow-y-auto p-4">
              {!active ? (
                <div className="text-slate-600 dark:text-slate-300">ไม่มีข้อมูล</div>
              ) : (
                <>
                  <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                    <div className="text-sm text-slate-600 dark:text-slate-300">
                      สร้างเมื่อ: {formatDate(active.regis_date)} • ซื้อครั้งล่าสุด: {formatDate(active.last_bought_date)}
                    </div>
                    {!editing ? (
                      <button type="button" onClick={() => setEditing(true)} className="rounded-xl bg-emerald-600 px-3 py-1.5 text-white hover:bg-emerald-700 active:scale-[.98]">
                        แก้ไข
                      </button>
                    ) : (
                      <div className="flex gap-2">
                        <button type="button" onClick={save} disabled={saving} className="rounded-xl bg-emerald-600 px-3 py-1.5 text-white hover:bg-emerald-700 active:scale-[.98] disabled:opacity-60">
                          {saving ? "กำลังบันทึก..." : "บันทึก"}
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setEditing(false)
                            openModal(active) // รีเซ็ต draft ให้ตรง active ปัจจุบัน
                          }}
                          className="rounded-xl border border-slate-300 px-3 py-1.5 hover:bg-slate-50 dark:border-slate-600 dark:hover:bg-slate-700"
                        >
                          ยกเลิก
                        </button>
                      </div>
                    )}
                  </div>

                  {rowError && (
                    <div className="mb-3 rounded-lg border border-red-200 bg-red-50 p-2 text-sm text-red-700 dark:border-red-400 dark:bg-red-900/20 dark:text-red-200">
                      {rowError}
                    </div>
                  )}

                  {/* ข้อมูลทั่วไป */}
                  <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
                    {FIELD_CONFIG.filter(f => !LAND_KEYS.includes(f.key)).map((f) => {
                      const val = editing ? draft?.[f.key] ?? "" : active?.[f.key]
                      return (
                        <div key={f.key}>
                          <label className="mb-1 block text-xs font-medium text-slate-600 dark:text-slate-300">{f.label}</label>
                          {!editing ? (
                            <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-700/60">
                              {f.type === "date" || f.type === "date-optional" ? formatDate(val) : (val ?? "-")}
                            </div>
                          ) : f.type === "select" ? (
                            <select
                              className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-black outline-none focus:border-emerald-500 dark:border-slate-600 dark:bg-slate-700 dark:text-white"
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
                              className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-black outline-none focus:border-emerald-500 dark:border-slate-600 dark:bg-slate-700 dark:text-white"
                              value={val ?? ""}
                              onChange={(e) => onChangeField(f.key, e.target.value)}
                            />
                          ) : (
                            <input
                              className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-black placeholder:text-slate-400 outline-none focus:border-emerald-500 dark:border-slate-600 dark:bg-slate-700 dark:text-white"
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
                  <div className="mt-6 rounded-2xl border border-emerald-200 bg-emerald-50/60 p-4 dark:border-emerald-400 dark:bg-emerald-900/10">
                    <div className="mb-3 text-base font-semibold text-emerald-800 dark:text-emerald-200">🌾 ข้อมูลที่ดิน</div>

                    {[
                      { title: "ถือครอง", keys: ["own_rai","own_ngan","own_wa"] },
                      { title: "เช่าทำกิน", keys: ["rent_rai","rent_ngan","rent_wa"] },
                      { title: "อื่นๆ", keys: ["other_rai","other_ngan","other_wa"] },
                    ].map((sec) => (
                      <div key={sec.title} className="mb-4 last:mb-0">
                        <div className="mb-1 text-sm font-medium text-slate-700 dark:text-slate-300">{sec.title}</div>
                        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                          {sec.keys.map((k) => {
                            const label = k.endsWith("_rai") ? "ไร่" : k.endsWith("_ngan") ? "งาน" : "ตารางวา"
                            const val = editing ? draft?.[k] ?? 0 : (active?.[k] ?? 0)
                            return (
                              <div key={k}>
                                {!editing ? (
                                  <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-700/60">
                                    {val}
                                  </div>
                                ) : (
                                  <input
                                    inputMode="numeric"
                                    className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-black outline-none focus:border-emerald-500 dark:border-slate-600 dark:bg-slate-700 dark:text-white"
                                    value={val}
                                    onChange={(e) => onChangeField(k, e.target.value)}
                                    placeholder={label}
                                  />
                                )}
                                <div className="mt-1 text-xs text-slate-500 dark:text-slate-400">
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
