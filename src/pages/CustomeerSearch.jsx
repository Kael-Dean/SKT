// src/pages/CustomeerSearch.jsx
import { useEffect, useMemo, useState } from "react"
import { apiAuth } from "../lib/api"   // ✅ ใช้ helper แนบโทเคนอัตโนมัติ (เหมือน MemberSearch)

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

/** ---------- ฟิลด์ของ "ลูกค้าทั่วไป" ตามสคีมาฝั่ง BE ---------- */
/**
 * Customer fields (individual):
 * - first_name, last_name, citizen_id, address, mhoo, sub_district, district, province, postal_code
 * - phone_number?, fid?, fid_owner?, fid_relationship?
 * (จะไม่มีฟิลด์เฉพาะสมาชิก เช่น member_id, โครงการ, ที่ดิน ฯลฯ)
 * อ้างอิงสคีมาและเอ็นด์พอยท์ /member/customer/search และ /member/members/fid_relationship
 */
const CUSTOMER_FIELD_KEYS = [
  "first_name", "last_name", "citizen_id", "phone_number",
  "address", "mhoo", "sub_district", "district", "province", "postal_code",
  "fid", "fid_owner", "fid_relationship",
]

/** ทำให้เรคคอร์ดจาก BE "ครบคีย์" และสะอาด */
function normalizeCustomerRecord(raw = {}) {
  const out = {
    asso_id: raw.asso_id ?? raw.assoId ?? raw.id ?? null,

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

    fid: raw.fid ?? null,
    fid_owner: raw.fid_owner ?? "",
    fid_relationship: raw.fid_relationship ?? null,

    // กันไว้เผื่อ BE ให้ timestamp มาด้วย
    created_at: raw.created_at ?? raw.regis_date ?? null,
  }

  // เติมให้ครบคีย์
  CUSTOMER_FIELD_KEYS.forEach((k) => {
    if (!(k in out)) out[k] = ""
  })
  return out
}

/** ---------- คอลัมน์ตาราง (เหมือน MemberSearch แต่ตัดฟิลด์เฉพาะสมาชิกออก) ---------- */
const TABLE_COLUMNS = [
  { key: "first_name",   label: "ชื่อ",              render: (row) => row.first_name || "-" },
  { key: "last_name",    label: "นามสกุล",          render: (row) => row.last_name || "-" },
  { key: "citizen_id",   label: "เลขบัตรประชาชน",   render: (row) => row.citizen_id || "-" },
  { key: "phone_number", label: "โทรศัพท์",          render: (row) => row.phone_number || "-" },
  { key: "province",     label: "จังหวัด",           render: (row) => row.province || "-" },
  { key: "district",     label: "อำเภอ",             render: (row) => row.district || "-" },
]

/** ---------- ตัวแผนที่ id -> ข้อความความสัมพันธ์ FID ---------- */
function useFIDRelationshipMap() {
  const [map, setMap] = useState({})
  useEffect(() => {
    const run = async () => {
      try {
        const rows = await apiAuth("/member/members/fid_relationship") // คืน [{ id, fid_relationship }]
        const m = {}
        ;(Array.isArray(rows) ? rows : []).forEach((r) => {
          if (r?.id != null) m[r.id] = r?.fid_relationship ?? String(r.id)
        })
        setMap(m)
      } catch {
        // เงียบๆ ถ้าดึงไม่ได้ ให้โชว์เป็นตัวเลขเดิม
      }
    }
    run()
  }, [])
  return map
}

/** ---------- หน้าค้นหา ลูกค้าทั่วไป ---------- */
const CustomeerSearch = () => {
  const [q, setQ] = useState("")
  const dq = useDebounce(q, 450)

  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")

  // modal
  const [open, setOpen] = useState(false)
  const [active, setActive] = useState(null)

  // FID relationship map
  const fidMap = useFIDRelationshipMap()

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
    setActive(normalizeCustomerRecord(row))
    setOpen(true)
  }

  const closeModal = () => {
    setOpen(false)
    setActive(null)
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

      {/* Modal (อ่านอย่างเดียว) */}
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
                  {/* แถวข้อมูลทั่วไป */}
                  <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
                    {/* ชื่อ */}
                    <div>
                      <label className="mb-1.5 block text-sm md:text-base font-medium text-slate-600 dark:text-slate-300">
                        ชื่อ
                      </label>
                      <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-base dark:border-slate-700 dark:bg-slate-700/60">
                        {active.first_name || "-"}
                      </div>
                    </div>

                    {/* นามสกุล */}
                    <div>
                      <label className="mb-1.5 block text-sm md:text-base font-medium text-slate-600 dark:text-slate-300">
                        นามสกุล
                      </label>
                      <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-base dark:border-slate-700 dark:bg-slate-700/60">
                        {active.last_name || "-"}
                      </div>
                    </div>

                    {/* เลขบัตรประชาชน */}
                    <div>
                      <label className="mb-1.5 block text-sm md:text-base font-medium text-slate-600 dark:text-slate-300">
                        เลขบัตรประชาชน
                      </label>
                      <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-base dark:border-slate-700 dark:bg-slate-700/60 break-all">
                        {active.citizen_id || "-"}
                      </div>
                    </div>

                    {/* เบอร์โทรศัพท์ */}
                    <div>
                      <label className="mb-1.5 block text-sm md:text-base font-medium text-slate-600 dark:text-slate-300">
                        โทรศัพท์
                      </label>
                      <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-base dark:border-slate-700 dark:bg-slate-700/60">
                        {active.phone_number || "-"}
                      </div>
                    </div>
                  </div>

                  {/* ที่อยู่ */}
                  <div className="mt-7 rounded-2xl border border-emerald-200 bg-emerald-50/60 p-5 dark:border-emerald-400 dark:bg-emerald-900/10">
                    <div className="mb-3 text-lg font-semibold text-emerald-800 dark:text-emerald-200">📍 ที่อยู่</div>
                    <div className="grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-3">
                      <div>
                        <label className="mb-1.5 block text-sm md:text-base font-medium text-slate-600 dark:text-slate-300">ที่อยู่</label>
                        <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-base dark:border-slate-700 dark:bg-slate-700/60">
                          {active.address || "-"}
                        </div>
                      </div>
                      <div>
                        <label className="mb-1.5 block text-sm md:text-base font-medium text-slate-600 dark:text-slate-300">หมู่</label>
                        <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-base dark:border-slate-700 dark:bg-slate-700/60">
                          {active.mhoo || "-"}
                        </div>
                      </div>
                      <div>
                        <label className="mb-1.5 block text-sm md:text-base font-medium text-slate-600 dark:text-slate-300">ตำบล</label>
                        <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-base dark:border-slate-700 dark:bg-slate-700/60">
                          {active.sub_district || "-"}
                        </div>
                      </div>
                      <div>
                        <label className="mb-1.5 block text-sm md:text-base font-medium text-slate-600 dark:text-slate-300">อำเภอ</label>
                        <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-base dark:border-slate-700 dark:bg-slate-700/60">
                          {active.district || "-"}
                        </div>
                      </div>
                      <div>
                        <label className="mb-1.5 block text-sm md:text-base font-medium text-slate-600 dark:text-slate-300">จังหวัด</label>
                        <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-base dark:border-slate-700 dark:bg-slate-700/60">
                          {active.province || "-"}
                        </div>
                      </div>
                      <div>
                        <label className="mb-1.5 block text-sm md:text-base font-medium text-slate-600 dark:text-slate-300">รหัสไปรษณีย์</label>
                        <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-base dark:border-slate-700 dark:bg-slate-700/60">
                          {active.postal_code || "-"}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* ข้อมูล FID */}
                  {(active.fid || active.fid_owner || active.fid_relationship != null) && (
                    <div className="mt-7 rounded-2xl border border-emerald-200 bg-emerald-50/60 p-5 dark:border-emerald-400 dark:bg-emerald-900/10">
                      <div className="mb-3 text-lg font-semibold text-emerald-800 dark:text-emerald-200">🧾 ข้อมูล FID</div>
                      <div className="grid grid-cols-1 gap-5 md:grid-cols-3">
                        <div>
                          <label className="mb-1.5 block text-sm md:text-base font-medium text-slate-600 dark:text-slate-300">FID</label>
                          <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-base dark:border-slate-700 dark:bg-slate-700/60">
                            {active.fid ?? "-"}
                          </div>
                        </div>
                        <div>
                          <label className="mb-1.5 block text-sm md:text-base font-medium text-slate-600 dark:text-slate-300">ชื่อผู้ถือ FID</label>
                          <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-base dark:border-slate-700 dark:bg-slate-700/60">
                            {active.fid_owner || "-"}
                          </div>
                        </div>
                        <div>
                          <label className="mb-1.5 block text-sm md:text-base font-medium text-slate-600 dark:text-slate-300">ความสัมพันธ์</label>
                          <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-base dark:border-slate-700 dark:bg-slate-700/60">
                            {active.fid_relationship != null
                              ? (fidMap?.[active.fid_relationship] ?? active.fid_relationship)
                              : "-"}
                          </div>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* เผื่ออนาคตแสดงวันที่สร้าง */}
                  {active.created_at && (
                    <div className="mt-4 text-sm md:text-base text-slate-500 dark:text-slate-400">
                      วันที่สร้างข้อมูล: {formatDate(active.created_at)}
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default CustomeerSearch
