import { useEffect, useMemo, useState } from "react"

/** ---------- ENV ---------- */
const API_BASE = import.meta.env.VITE_API_BASE || ""

/** ---------- Utils ---------- */
const onlyDigits = (s = "") => s.replace(/\D+/g, "")
const toNumber = (v) => (v === "" || v === null || v === undefined ? 0 : Number(v))

function useDebounce(value, delay = 400) {
  const [debounced, setDebounced] = useState(value)
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delay)
    return () => clearTimeout(t)
  }, [value, delay])
  return debounced
}

const authHeader = () => {
  const token = localStorage.getItem("token")
  return {
    "Content-Type": "application/json",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  }
}

// แปลง "YYYY-MM-DD" หรือ ISO เป็น "DD/MM/BBBB (พ.ศ.)"
function toThaiDate(d) {
  if (!d) return "-"
  const dt = new Date(d)
  if (isNaN(dt)) return "-"
  const dd = String(dt.getDate()).padStart(2, "0")
  const mm = String(dt.getMonth() + 1).padStart(2, "0")
  const yyyyBE = dt.getFullYear() + 543
  return `${dd}/${mm}/${yyyyBE}`
}

/** ---------- Row item mapper ---------- */
function mapRow(r = {}) {
  return {
    id: r.id ?? r.member_pk ?? null,
    member_id: r.member_id ?? null,
    first_name: r.first_name ?? "",
    last_name: r.last_name ?? "",
    citizen_id: onlyDigits(r.citizen_id ?? r.citizenId ?? ""),
    phone: r.phone_number ?? r.phone ?? "-",
    province: r.province ?? "-",
    regis_date: r.regis_date ?? r.created_at ?? null,
  }
}

/** ---------- Component ---------- */
const PAGE_SIZE = 20

export default function MemberSearch() {
  const [q, setQ] = useState("")
  const dq = useDebounce(q.trim(), 400)

  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")
  const [page, setPage] = useState(1)

  const total = rows.length
  const maxPage = Math.max(1, Math.ceil(total / PAGE_SIZE))
  const current = useMemo(() => {
    const start = (page - 1) * PAGE_SIZE
    return rows.slice(start, start + PAGE_SIZE)
  }, [rows, page])

  useEffect(() => {
    // reset page เมื่อเปลี่ยนคำค้น
    setPage(1)
  }, [dq])

  useEffect(() => {
    const fetchMembers = async () => {
      if (dq.length < 1) {
        setRows([])
        setError("")
        return
      }
      try {
        setLoading(true)
        setError("")
        const url = `${API_BASE}/member/members/search?q=${encodeURIComponent(dq)}`
        const res = await fetch(url, { headers: authHeader() })
        if (!res.ok) {
          const t = await res.text()
          throw new Error(t || `ค้นหาล้มเหลว (${res.status})`)
        }
        const arr = (await res.json()) || []
        setRows(arr.map(mapRow))
      } catch (e) {
        console.error(e)
        setError(e.message || "เกิดข้อผิดพลาด")
        setRows([])
      } finally {
        setLoading(false)
      }
    }
    fetchMembers()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dq])

  const viewDetail = (r) => {
    // ปรับเส้นทางตามระบบคุณได้เลย
    if (r?.id) window.location.href = `/members/${r.id}`
    else if (r?.member_id) window.location.href = `/members?member_id=${r.member_id}`
    else alert("ยังไม่มีเส้นทางสำหรับรายการนี้")
  }

  return (
    <div className="min-h-screen rounded-2xl bg-white text-black dark:bg-slate-900 dark:text-white">
      <div className="mx-auto max-w-7xl p-4 md:p-6">
        {/* หัวข้อ */}
        <h1 className="mb-4 flex items-center gap-2 text-2xl font-bold">
          <span>🔎</span> <span>ค้นหาสมาชิก</span>
        </h1>

        {/* การ์ดค้นหา */}
        <div className="mb-5 rounded-2xl border border-slate-200/60 bg-white/85 p-4 shadow-sm backdrop-blur dark:border-white/10 dark:bg-slate-900/40">
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

          {/* สถานะผลลัพธ์ */}
          <div className="mt-2 text-xs text-slate-500 dark:text-slate-400">
            {dq ? (
              loading ? (
                <>กำลังค้นหา “{dq}”...</>
              ) : error ? (
                <>เกิดข้อผิดพลาด: {error}</>
              ) : (
                <>พบ {total.toLocaleString()} รายการ</>
              )
            ) : (
              <>พิมพ์อย่างน้อย 1 ตัวอักษรเพื่อค้นหา</>
            )}
          </div>
        </div>

        {/* กล่องตาราง */}
        <div className="rounded-2xl border border-slate-200/60 bg-white/85 shadow-sm backdrop-blur dark:border-white/10 dark:bg-slate-900/40">
          <div className="overflow-x-auto rounded-2xl">
            <table className="w-full text-sm tabular-nums">
              {/* หัวตาราง */}
              <thead className="text-slate-700 dark:text-slate-100">
                <tr className="sticky top-0 z-10 bg-slate-50/95 supports-[backdrop-filter]:bg-slate-50/60 dark:bg-slate-700/60">
                  {["ชื่อ", "นามสกุล", "เลขบัตรประชาชน", "โทรศัพท์", "จังหวัด", "วันที่สมัคร", "การกระทำ"].map((h) => (
                    <th key={h} className="whitespace-nowrap px-4 py-3 text-left text-[13px] font-semibold">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>

              {/* เนื้อหา */}
              <tbody className="divide-y divide-slate-200/70 dark:divide-white/8">
                {/* Loading skeleton */}
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

                {!loading && current.length === 0 && dq && !error && (
                  <tr className="odd:bg-white/90 even:bg-slate-50/70 dark:odd:bg-slate-800/40 dark:even:bg-slate-800/25">
                    <td className="px-4 py-6 text-center text-slate-500 dark:text-slate-300" colSpan={7}>
                      ไม่พบข้อมูลที่ตรงกับ “{dq}”
                    </td>
                  </tr>
                )}

                {!loading &&
                  current.map((r) => (
                    <tr
                      key={`${r.id ?? r.member_id ?? r.citizen_id}`}
                      className="odd:bg-white/90 even:bg-slate-50/70 hover:bg-emerald-50/70 dark:odd:bg-slate-800/40 dark:even:bg-slate-800/25 dark:hover:bg-emerald-400/10 transition-colors"
                    >
                      <td className="px-4 py-3">{r.first_name || "-"}</td>
                      <td className="px-4 py-3">{r.last_name || "-"}</td>
                      <td className="px-4 py-3 tracking-wider">{r.citizen_id || "-"}</td>
                      <td className="px-4 py-3">{r.phone || "-"}</td>
                      <td className="px-4 py-3">{r.province || "-"}</td>
                      <td className="px-4 py-3">{toThaiDate(r.regis_date)}</td>
                      <td className="px-4 py-3">
                        <button
                          onClick={() => viewDetail(r)}
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

          {/* แถบแบ่งหน้า */}
          {!loading && total > 0 && (
            <div className="flex items-center justify-between gap-3 border-t border-slate-200/70 px-3 py-3 text-sm dark:border-white/10 md:px-4">
              <div className="text-slate-500 dark:text-slate-400">
                หน้า {page} / {maxPage} • ทั้งหมด {total.toLocaleString()} รายการ
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page <= 1}
                  className="rounded-xl border border-slate-300 bg-white px-3 py-1.5 text-slate-700 shadow-sm transition hover:bg-slate-50 disabled:opacity-50 dark:border-slate-700 dark:bg-slate-800 dark:text-white dark:hover:bg-slate-700"
                >
                  ก่อนหน้า
                </button>
                <button
                  onClick={() => setPage((p) => Math.min(maxPage, p + 1))}
                  disabled={page >= maxPage}
                  className="rounded-xl border border-slate-300 bg-white px-3 py-1.5 text-slate-700 shadow-sm transition hover:bg-slate-50 disabled:opacity-50 dark:border-slate-700 dark:bg-slate-800 dark:text-white dark:hover:bg-slate-700"
                >
                  ถัดไป
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
