// src/pages/CustomerSearch.jsx
import { useEffect, useMemo, useState } from "react"
import { apiAuth } from "../lib/api"

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

/** แสดงวันที่แบบไทย (สำรองเผื่ออนาคต) */
function formatDate(v) {
  if (!v) return "-"
  try {
    const d = new Date(v)
    if (isNaN(d)) return "-"
    return d.toLocaleDateString("th-TH", { day: "2-digit", month: "2-digit", year: "numeric" })
  } catch {
    return "-"
  }
}

/** ---------- ค่าคำนำหน้า + sex ---------- */
const PREFIX_OPTIONS = [
  { value: "", label: "— เลือก —" },
  { value: "1", label: "นาย" },
  { value: "2", label: "นาง" },
  { value: "3", label: "นางสาว" },
]
const sexFromPrefix = (pre) => (pre === "1" ? "M" : pre === "2" || pre === "3" ? "F" : "")

/** ---------- ฟิลด์ของ "ลูกค้าทั่วไป" ตามฝั่ง BE ---------- */
const CUSTOMER_FIELD_KEYS = [
  "precode", "sex",
  "first_name", "last_name", "citizen_id", "phone_number",
  "address", "mhoo", "sub_district", "district", "province", "postal_code",
  "fid", "fid_owner", "fid_relationship",
]

/** ทำให้เรคคอร์ดจาก BE "ครบคีย์" และสะอาด */
function normalizeCustomerRecord(raw = {}) {
  const out = {
    asso_id: raw.asso_id ?? raw.assoId ?? raw.id ?? null,

    precode: raw.precode ?? null,
    sex: raw.sex ?? "",

    first_name: raw.first_name ?? raw.firstname ?? "",
    last_name:  raw.last_name  ?? raw.lastname  ?? "",
    citizen_id: onlyDigits(raw.citizen_id ?? raw.citizenId ?? "") || null,

    phone_number: raw.phone_number ?? raw.phone ?? "",

    address: raw.address ?? "",
    mhoo: raw.mhoo ?? raw.moo ?? "",
    sub_district: raw.sub_district ?? raw.subdistrict ?? "",
    district: raw.district ?? "",
    province: raw.province ?? "",
    postal_code: raw.postal_code ?? raw.postalCode ?? "",

    // ✅ เก็บเป็น string/null เพื่อให้ UI และ diff ทำงานถูกต้อง
    fid: raw.fid != null ? String(raw.fid) : null,
    fid_owner: raw.fid_owner ?? "",
    fid_relationship: raw.fid_relationship ?? null,

    created_at: raw.created_at ?? raw.regis_date ?? null,
  }

  // เติมให้ครบคีย์
  CUSTOMER_FIELD_KEYS.forEach((k) => {
    if (!(k in out)) out[k] = ""
  })
  return out
}

/** ---------- คอลัมน์ตาราง ---------- */
const TABLE_COLUMNS = [
  { key: "first_name",   label: "ชื่อ",              render: (row) => row.first_name || "-" },
  { key: "last_name",    label: "นามสกุล",          render: (row) => row.last_name || "-" },
  { key: "citizen_id",   label: "เลขบัตรประชาชน",   render: (row) => row.citizen_id || "-" },
  { key: "phone_number", label: "โทรศัพท์",          render: (row) => row.phone_number || "-" },
  { key: "province",     label: "จังหวัด",           render: (row) => row.province || "-" },
  { key: "district",     label: "อำเภอ",             render: (row) => row.district || "-" },
]

/** ---------- ตัวแผนที่ id -> ข้อความความสัมพันธ์ FID + options ---------- */
function useFIDRelationshipMap() {
  const [map, setMap] = useState({})
  useEffect(() => {
    const run = async () => {
      try {
        const rows = await apiAuth("/member/members/fid_relationship") // [{ id, fid_relationship }]
        const m = {}
        ;(Array.isArray(rows) ? rows : []).forEach((r) => {
          if (r?.id != null) m[r.id] = r?.fid_relationship ?? String(r.id)
        })
        setMap(m)
      } catch {
        // ถ้าดึงไม่ได้ ให้โชว์เป็นตัวเลขเดิม
      }
    }
    run()
  }, [])
  return map
}
function useFIDRelationshipOptions(fidMap) {
  return useMemo(
    () =>
      Object.entries(fidMap || {}).map(([id, label]) => ({
        value: String(id),
        label: String(label),
      })),
    [fidMap]
  )
}

/** ---------- PATCH helper: ใช้ endpoint เดียวเพื่อตัด 404 ---------- */
async function patchCustomer(id, body) {
  return await apiAuth(`/member/customers/${id}`, { method: "PATCH", body })
}

/** ---------- หน้าค้นหา ลูกค้าทั่วไป (แก้ไขได้) ---------- */
const CustomerSearch = () => {
  const [q, setQ] = useState("")
  const dq = useDebounce(q, 450)

  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")

  // modal
  const [open, setOpen] = useState(false)
  const [active, setActive] = useState(null)   // normalized row (ของจริง)
  const [draft, setDraft] = useState(null)     // ค่าที่แก้ไขอยู่
  const [editing, setEditing] = useState(false)
  const [saving, setSaving] = useState(false)
  const [rowError, setRowError] = useState("")

  // FID relationship
  const fidMap = useFIDRelationshipMap()
  const fidOptions = useFIDRelationshipOptions(fidMap)

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
        // ✅ เรียก BE: /member/customer/search?q=...
        const data = await apiAuth(`/member/customer/search?q=${encodeURIComponent(term)}`)
        const normalized = (Array.isArray(data) ? data : []).map(normalizeCustomerRecord)
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
    const r = normalizeCustomerRecord(row)
    setActive(r)

    // เตรียม draft เริ่มต้น (เป็น string/รูปแบบพร้อมแก้)
    const d = {}
    CUSTOMER_FIELD_KEYS.forEach((key) => {
      let v = r[key]
      if (key === "citizen_id") v = onlyDigits(String(v || "")).slice(0, 13)
      else if (["postal_code", "precode", "fid_relationship"].includes(key)) v = v == null ? "" : String(v)
      else v = v ?? ""
      d[key] = v
    })
    // ล็อก sex จาก precode (กรณีไม่มีในข้อมูลเดิม)
    d.sex = sexFromPrefix(d.precode) || d.sex || ""
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
    if (!draft) return
    if (key === "citizen_id") val = onlyDigits(val).slice(0, 13)
    // ❌ เดิม: บังคับ digits ให้รวม 'fid' → ทำให้พิมพ์อักษรไม่ได้
    // ✅ ใหม่: เอา 'fid' ออก ให้เป็นข้อความอิสระ
    if (["postal_code", "precode", "fid_relationship"].includes(key)) val = onlyDigits(String(val))
    // เปลี่ยน precode ⇒ อัปเดต sex อัตโนมัติ
    if (key === "precode") {
      const sx = sexFromPrefix(val)
      setDraft((p) => ({ ...p, precode: val, sex: sx }))
    } else {
      setDraft((p) => ({ ...p, [key]: val }))
    }
  }

  // บันทึก: สร้าง diff เฉพาะฟิลด์ที่เปลี่ยน และส่ง PATCH
  const save = async () => {
    if (!active || !draft) return
    setRowError("")
    setSaving(true)
    try {
      const diff = {}
      const keysToCheck = [...CUSTOMER_FIELD_KEYS]

      keysToCheck.forEach((key) => {
        let newV = draft[key]
        let oldV = active[key]

        // แปลงประเภทค่าก่อนเทียบ (ให้เข้ารูปแบบที่ BE ใช้)
        if (key === "citizen_id") {
          newV = onlyDigits(newV || "") || null
          oldV = onlyDigits(oldV || "") || null
        } else if (["postal_code", "precode", "fid_relationship"].includes(key)) {
          newV = newV === "" || newV == null ? null : Number(newV)
          oldV = oldV === "" || oldV == null ? null : Number(oldV)
        } else if (key === "fid") {
          // ✅ สำคัญ: FID เป็นสตริงเสมอ (ถ้าว่างให้เป็น null)
          newV = newV === "" || newV == null ? null : String(newV).trim()
          oldV = oldV === "" || oldV == null ? null : String(oldV).trim()
        } else {
          newV = newV ?? ""
          oldV = oldV ?? ""
        }

        if (oldV !== newV) diff[key] = newV
      })

      const idForPatch = active.asso_id ?? active.id
      if (!idForPatch && idForPatch !== 0) throw new Error("ไม่พบรหัสลูกค้า (id) สำหรับบันทึก")

      // optimistic update
      const prev = rows
      setRows((cur) => cur.map((x) => ((x.asso_id ?? x.id) === idForPatch ? { ...x, ...diff } : x)))

      // เรียก PATCH
      const updatedRaw = await patchCustomer(idForPatch, diff)
      const updated = normalizeCustomerRecord(updatedRaw)

      // sync กลับเข้าตาราง + active + draft
      setRows((cur) => cur.map((x) => ((x.asso_id ?? x.id) === idForPatch ? updated : x)))
      setActive(updated)

      const nd = {}
      CUSTOMER_FIELD_KEYS.forEach((key) => {
        let v = updated[key]
        if (key === "citizen_id") v = onlyDigits(String(v || "")).slice(0, 13)
        else if (["postal_code", "precode", "fid_relationship"].includes(key)) v = v == null ? "" : String(v)
        else v = v ?? ""
        nd[key] = v
      })
      nd.sex = sexFromPrefix(nd.precode) || nd.sex || ""
      setDraft(nd)

      setEditing(false)
    } catch (e) {
      setRowError(e?.message || "บันทึกไม่สำเร็จ")
    } finally {
      setSaving(false)
    }
  }

  const loaderCols = TABLE_COLUMNS.length + 1 // + Actions column

  return (
    <div className="min-h-screen rounded-2xl bg-white text-black dark:bg-slate-900 dark:text-white">
      <div className="mx-auto max-w-6xl p-4 md:p-6 text-base md:text-lg">
        <h1 className="mb-4 text-2xl md:text-3xl font-bold">🔎 ค้นหาลูกค้าทั่วไป</h1>

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
                      key={r.asso_id ?? r.citizen_id ?? Math.random()}
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
          <div className={`h-[88vh] w-[96vw] max-w-[1100px] transform overflow-hidden rounded-2xl bg-white text-black shadow-2xl transition-all dark:bg-slate-800 dark:text-white ${open ? "scale-100 opacity-100" : "scale-95 opacity-0"}`}>
            <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4 dark:border-slate-700">
              <div className="text-xl md:text-2xl font-semibold">
                รายละเอียดลูกค้า {active?.first_name || active?.last_name ? `• ${active?.first_name ?? ""} ${active?.last_name ?? ""}` : ""}
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
                      วันที่สร้างข้อมูล: {formatDate(active.created_at)}
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

                  {rowError && (
                    <div className="mb-4 rounded-xl border border-red-200 bg-red-50 p-3 text-base text-red-700 dark:border-red-400 dark:bg-red-900/20 dark:text-red-200">
                      {rowError}
                    </div>
                  )}

                  {/* แถวแรก: ชื่อ นามสกุล */}
                  <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
                    {/* ชื่อ */}
                    <div>
                      <label className="mb-1.5 block text-sm md:text-base font-medium text-slate-600 dark:text-slate-300">ชื่อ</label>
                      {!editing ? (
                        <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-base dark:border-slate-700 dark:bg-slate-700/60">
                          {active.first_name || "-"}
                        </div>
                      ) : (
                        <input
                          className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-base text-black outline-none focus:border-emerald-500 dark:border-slate-600 dark:bg-slate-700 dark:text-white"
                          value={draft.first_name ?? ""}
                          onChange={(e) => onChangeField("first_name", e.target.value)}
                          placeholder="ชื่อ"
                        />
                      )}
                    </div>

                    {/* นามสกุล */}
                    <div>
                      <label className="mb-1.5 block text-sm md:text-base font-medium text-slate-600 dark:text-slate-300">นามสกุล</label>
                      {!editing ? (
                        <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-base dark:border-slate-700 dark:bg-slate-700/60">
                          {active.last_name || "-"}
                        </div>
                      ) : (
                        <input
                          className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-base text-black outline-none focus:border-emerald-500 dark:border-slate-600 dark:bg-slate-700 dark:text-white"
                          value={draft.last_name ?? ""}
                          onChange={(e) => onChangeField("last_name", e.target.value)}
                          placeholder="นามสกุล"
                        />
                      )}
                    </div>
                  </div>

                  {/* คำนำหน้า + เพศ + เลขบัตร + โทรศัพท์ */}
                  <div className="mt-5 grid grid-cols-1 gap-5 md:grid-cols-4">
                    {/* precode */}
                    <div>
                      <label className="mb-1.5 block text-sm md:text-base font-medium text-slate-600 dark:text-slate-300">คำนำหน้า (precode)</label>
                      {!editing ? (
                        <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-base dark:border-slate-700 dark:bg-slate-700/60">
                          {PREFIX_OPTIONS.find(op => op.value === String(active.precode))?.label || "-"}
                        </div>
                      ) : (
                        <select
                          className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-base text-black outline-none focus:border-emerald-500 dark:border-slate-600 dark:bg-slate-700 dark:text-white"
                          value={draft.precode ?? ""}
                          onChange={(e) => onChangeField("precode", e.target.value)}
                        >
                          {PREFIX_OPTIONS.map(op => <option key={op.value} value={op.value}>{op.label}</option>)}
                        </select>
                      )}
                    </div>

                    {/* sex (ล็อกจาก precode) */}
                    <div>
                      <label className="mb-1.5 block text-sm md:text-base font-medium text-slate-600 dark:text-slate-300">เพศ (กำหนดจากคำนำหน้า)</label>
                      <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-base dark:border-slate-700 dark:bg-slate-700/60">
                        {(editing ? sexFromPrefix(draft.precode) : active.sex) || "-"}
                      </div>
                    </div>

                    {/* citizen_id */}
                    <div>
                      <label className="mb-1.5 block text-sm md:text-base font-medium text-slate-600 dark:text-slate-300">เลขบัตรประชาชน</label>
                      {!editing ? (
                        <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-base dark:border-slate-700 dark:bg-slate-700/60 break-all">
                          {active.citizen_id || "-"}
                        </div>
                      ) : (
                        <input
                          inputMode="numeric"
                          maxLength={13}
                          className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-base text-black outline-none focus:border-emerald-500 dark:border-slate-600 dark:bg-slate-700 dark:text-white"
                          value={draft.citizen_id ?? ""}
                          onChange={(e) => onChangeField("citizen_id", e.target.value)}
                          placeholder="13 หลัก"
                        />
                      )}
                    </div>

                    {/* phone */}
                    <div>
                      <label className="mb-1.5 block text-sm md:text-base font-medium text-slate-600 dark:text-slate-300">โทรศัพท์</label>
                      {!editing ? (
                        <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-base dark:border-slate-700 dark:bg-slate-700/60">
                          {active.phone_number || "-"}
                        </div>
                      ) : (
                        <input
                          className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-base text-black outline-none focus:border-emerald-500 dark:border-slate-600 dark:bg-slate-700 dark:text-white"
                          value={draft.phone_number ?? ""}
                          onChange={(e) => onChangeField("phone_number", e.target.value)}
                          placeholder="08x-xxx-xxxx"
                        />
                      )}
                    </div>
                  </div>

                  {/* ที่อยู่ */}
                  <div className="mt-7 rounded-2xl border border-emerald-200 bg-emerald-50/60 p-5 dark:border-emerald-400 dark:bg-emerald-900/10">
                    <div className="mb-3 text-lg font-semibold text-emerald-800 dark:text-emerald-200">📍 ที่อยู่</div>
                    <div className="grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-3">
                      {[
                        { key: "address", label: "ที่อยู่" },
                        { key: "mhoo", label: "หมู่" },
                        { key: "sub_district", label: "ตำบล" },
                        { key: "district", label: "อำเภอ" },
                        { key: "province", label: "จังหวัด" },
                        { key: "postal_code", label: "รหัสไปรษณีย์", numeric: true },
                      ].map(({ key, label, numeric }) => (
                        <div key={key}>
                          <label className="mb-1.5 block text-sm md:text-base font-medium text-slate-600 dark:text-slate-300">{label}</label>
                          {!editing ? (
                            <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-base dark:border-slate-700 dark:bg-slate-700/60">
                              {active[key] || "-"}
                            </div>
                          ) : (
                            <input
                              inputMode={numeric ? "numeric" : undefined}
                              className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-base text-black outline-none focus:border-emerald-500 dark:border-slate-600 dark:bg-slate-700 dark:text-white"
                              value={draft[key] ?? ""}
                              onChange={(e) => onChangeField(key, e.target.value)}
                              placeholder={label}
                            />
                          )}
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* ข้อมูล FID */}
                  <div className="mt-7 rounded-2xl border border-emerald-200 bg-emerald-50/60 p-5 dark:border-emerald-400 dark:bg-emerald-900/10">
                    <div className="mb-3 text-lg font-semibold text-emerald-800 dark:text-emerald-200">🧾 ข้อมูล FID</div>
                    <div className="grid grid-cols-1 gap-5 md:grid-cols-3">
                      {/* fid */}
                      <div>
                        <label className="mb-1.5 block text-sm md:text-base font-medium text-slate-600 dark:text-slate-300">FID</label>
                        {!editing ? (
                          <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-base dark:border-slate-700 dark:bg-slate-700/60">
                            {active.fid ?? "-"}
                          </div>
                        ) : (
                          <input
                            className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-base text-black outline-none focus:border-emerald-500 dark:border-slate-600 dark:bg-slate-700 dark:text-white"
                            value={draft.fid ?? ""}
                            onChange={(e) => onChangeField("fid", e.target.value)}
                            placeholder="เช่น FID-001234 หรือ 123456"
                          />
                        )}
                      </div>

                      {/* fid_owner */}
                      <div>
                        <label className="mb-1.5 block text-sm md:text-base font-medium text-slate-600 dark:text-slate-300">ชื่อผู้ถือ FID</label>
                        {!editing ? (
                          <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-base dark:border-slate-700 dark:bg-slate-700/60">
                            {active.fid_owner || "-"}
                          </div>
                        ) : (
                          <input
                            className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-base text-black outline-none focus:border-emerald-500 dark:border-slate-600 dark:bg-slate-700 dark:text-white"
                            value={draft.fid_owner ?? ""}
                            onChange={(e) => onChangeField("fid_owner", e.target.value)}
                            placeholder="เช่น นายสมชาย ใจดี"
                          />
                        )}
                      </div>

                      {/* fid_relationship */}
                      <div>
                        <label className="mb-1.5 block text-sm md:text-base font-medium text-slate-600 dark:text-slate-300">ความสัมพันธ์</label>
                        {!editing ? (
                          <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-base dark:border-slate-700 dark:bg-slate-700/60">
                            {active.fid_relationship != null
                              ? (fidMap?.[active.fid_relationship] ?? active.fid_relationship)
                              : "-"}
                          </div>
                        ) : (
                          <select
                            className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-base text-black outline-none focus:border-emerald-500 dark:border-slate-600 dark:bg-slate-700 dark:text-white"
                            value={draft.fid_relationship ?? ""}
                            onChange={(e) => onChangeField("fid_relationship", e.target.value)}
                          >
                            <option value="">— เลือก —</option>
                            {fidOptions.map((op) => (
                              <option key={op.value} value={op.value}>{op.label}</option>
                            ))}
                          </select>
                        )}
                      </div>
                    </div>
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

export default CustomerSearch
