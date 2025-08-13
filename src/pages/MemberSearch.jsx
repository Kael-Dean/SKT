import { useEffect, useMemo, useState } from "react"

const API_BASE = import.meta.env.VITE_API_BASE // ต้องมีใน .env

/** ---------- Utils ---------- */
const onlyDigits = (s = "") => s.replace(/\D+/g, "")

function useDebounce(value, delay = 400) {
  const [debounced, setDebounced] = useState(value)
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delay)
    return () => clearTimeout(t)
  }, [value, delay])
  return debounced
}

function formatDate(d) {
  if (!d) return "-"
  try {
    // รองรับทั้ง ISO string และ datetime ที่ backend serialize มา
    const dt = new Date(d)
    if (isNaN(dt.getTime())) return "-"
    return dt.toLocaleDateString("th-TH", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    })
  } catch {
    return "-"
  }
}

/** ---------- Component ---------- */
const MemberSearch = () => {
  const [q, setQ] = useState("")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")
  const [rows, setRows] = useState([])

  const debouncedQ = useDebounce(q, 450)

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
      const term = debouncedQ.trim()
      if (!term) return

      setLoading(true)
      try {
        const url = `${API_BASE}/member/members/search?q=${encodeURIComponent(term)}`
        const res = await fetch(url)
        if (!res.ok) throw new Error(await res.text())
        const data = await res.json()
        setRows(Array.isArray(data) ? data : [])
      } catch (e) {
        setError(e?.message || "ค้นหาไม่สำเร็จ")
      } finally {
        setLoading(false)
      }
    }
    run()
  }, [debouncedQ])

  return (
    <div className="mx-auto max-w-6xl p-4 md:p-6">
      <h1 className="mb-4 text-2xl font-bold text-white">🔎 ค้นหาสมาชิก</h1>

      <div className="rounded-2xl border border-emerald-200 bg-white p-4 shadow-sm">
        <div className="mb-3">
          <label className="mb-1 block text-sm font-medium text-black">คำค้นหา</label>
          <input
            className="w-full rounded-xl border border-slate-300 p-2 text-black outline-none focus:border-emerald-500"
            placeholder="เช่น สมชาย ใจดี หรือ 1234567890123"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
          <p className="mt-1 text-xs text-slate-500">{hint}</p>
        </div>

        {/* states */}
        {loading && (
          <div className="mt-4 rounded-xl border border-emerald-100 bg-emerald-50 p-3 text-emerald-700">
            กำลังค้นหา...
          </div>
        )}
        {error && !loading && (
          <div className="mt-4 rounded-xl border border-red-200 bg-red-50 p-3 text-red-700">
            {error}
          </div>
        )}

        {/* results */}
        {!loading && !error && debouncedQ.trim() && (
          <div className="mt-4 overflow-x-auto">
            {rows.length === 0 ? (
              <div className="rounded-xl border border-slate-200 p-4 text-slate-600">
                ไม่พบข้อมูลที่ตรงกับ “{debouncedQ}”
              </div>
            ) : (
              <table className="min-w-full overflow-hidden rounded-xl border border-slate-200 text-left text-sm text-black">
                <thead className="bg-slate-50 text-slate-700">
                  <tr>
                    <th className="px-3 py-2">ชื่อ</th>
                    <th className="px-3 py-2">นามสกุล</th>
                    <th className="px-3 py-2">เลขบัตรประชาชน</th>
                    <th className="px-3 py-2">โทรศัพท์</th>
                    <th className="px-3 py-2">จังหวัด</th>
                    <th className="px-3 py-2">วันที่สมัคร</th>
                    <th className="px-3 py-2">กลุ่ม</th>
                    <th className="px-3 py-2">หุ้นปกติ</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r, idx) => (
                    <tr key={idx} className="odd:bg-white even:bg-slate-50 hover:bg-emerald-50">
                      <td className="px-3 py-2">{r.first_name || "-"}</td>
                      <td className="px-3 py-2">{r.last_name || "-"}</td>
                      <td className="px-3 py-2 whitespace-nowrap">{r.citizen_id || "-"}</td>
                      <td className="px-3 py-2">{r.phone_number || "-"}</td>
                      <td className="px-3 py-2">{r.province || "-"}</td>
                      <td className="px-3 py-2">{formatDate(r.regis_date)}</td>
                      <td className="px-3 py-2">{r.tgs_group ?? "-"}</td>
                      <td className="px-3 py-2">{r.normal_share ?? "-"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

export default MemberSearch
