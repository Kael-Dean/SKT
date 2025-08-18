import { useEffect, useMemo, useState } from "react"

/** ---------- ENV ---------- */
const API_BASE = import.meta.env.VITE_API_BASE || ""

/** ---------- Utils ---------- */
const onlyDigits = (s = "") => s.replace(/\D+/g, "")
const toNumber = (v) => (v === "" || v === null || v === undefined ? 0 : Number(v))
const thb = (n) =>
  new Intl.NumberFormat("th-TH", { style: "currency", currency: "THB", maximumFractionDigits: 2 }).format(
    isFinite(n) ? n : 0
  )

function useDebounce(value, delay = 400) {
  const [debounced, setDebounced] = useState(value)
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delay)
    return () => clearTimeout(t)
  }, [value, delay])
  return debounced
}

/** ---------- Auth header ---------- */
const authHeader = () => {
  const token = localStorage.getItem("token")
  return {
    "Content-Type": "application/json",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  }
}

const Order = () => {
  /** ---------- Dates (default: this month) ---------- */
  const today = new Date().toISOString().slice(0, 10)
  const firstDayThisMonth = new Date(new Date().getFullYear(), new Date().getMonth(), 1)
    .toISOString()
    .slice(0, 10)

  /** ---------- State ---------- */
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(false)

  const [branchOptions, setBranchOptions] = useState([]) // [{id, branch_name}]
  const [klangOptions, setKlangOptions] = useState([])   // [{id, klang_name}]

  const [filters, setFilters] = useState({
    startDate: firstDayThisMonth,
    endDate: today,
    branchId: "",
    klangId: "",
    q: "",
  })

  const debouncedQ = useDebounce(filters.q, 500)

  /** ---------- Dropdown: Branch ---------- */
  useEffect(() => {
    const loadBranch = async () => {
      try {
        const r = await fetch(`${API_BASE}/order/branch/search`, { headers: authHeader() })
        const data = r.ok ? await r.json() : []
        setBranchOptions(Array.isArray(data) ? data : [])
      } catch (e) {
        console.error("load branch failed:", e)
        setBranchOptions([])
      }
    }
    loadBranch()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  /** ---------- Dropdown: Klang (depends on branch) ---------- */
  useEffect(() => {
    const loadKlang = async () => {
      if (!filters.branchId) {
        setKlangOptions([])
        setFilters((p) => ({ ...p, klangId: "" }))
        return
      }
      try {
        const r = await fetch(`${API_BASE}/order/klang/search?branch_id=${filters.branchId}`, {
          headers: authHeader(),
        })
        const data = r.ok ? await r.json() : []
        setKlangOptions(Array.isArray(data) ? data : [])
      } catch (e) {
        console.error("load klang failed:", e)
        setKlangOptions([])
      }
    }
    loadKlang()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters.branchId])

  /** ---------- Fetch orders ---------- */
  const fetchOrders = async () => {
    try {
      setLoading(true)
      const params = new URLSearchParams()
      params.set("start_date", filters.startDate)
      params.set("end_date", filters.endDate)
      if (filters.branchId) params.set("branch_id", filters.branchId)
      if (filters.klangId) params.set("klang_id", filters.klangId)
      if (filters.q?.trim()) params.set("q", filters.q.trim())

      const r = await fetch(`${API_BASE}/order/orders/report?${params.toString()}`, { headers: authHeader() })
      const data = r.ok ? await r.json() : []
      setRows(Array.isArray(data) ? data : [])
    } catch (e) {
      console.error(e)
      setRows([])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchOrders()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  /** ---------- Auto-refresh on debounced search ---------- */
  useEffect(() => {
    if (filters.q.length >= 2 || filters.q.length === 0) {
      fetchOrders()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedQ])

  /** ---------- Totals ---------- */
  const totals = useMemo(() => {
    let weight = 0
    let revenue = 0
    rows.forEach((x) => {
      weight += toNumber(x.weight)
      revenue += toNumber(x.price)
    })
    return { weight, revenue }
  }, [rows])

  /** ---------- Reset ---------- */
  const resetFilters = () => {
    setFilters({
      startDate: firstDayThisMonth,
      endDate: today,
      branchId: "",
      klangId: "",
      q: "",
    })
  }

  /** ---------- UI (ภายนอกมืด, ข้างในล็อกขาว) ---------- */
  return (
    // พื้นหลังรอบนอก dark
    <div className="min-h-screen bg-slate-900 text-slate-100 dark:bg-slate-900 dark:text-slate-100">
      <div className="mx-auto max-w-7xl p-4 md:p-6">
        <h1 className="mb-4 text-2xl font-bold">📦 รายการออเดอร์ซื้อข้าวเปลือก</h1>

        {/* Filters: การ์ดขาวตัวดำ */}
        <div className="mb-4 rounded-2xl border border-slate-200 bg-white p-4 text-black shadow-sm dark:border-slate-200 dark:bg-white dark:text-black">
          <div className="grid gap-3 md:grid-cols-6">
            <div>
              <label className="mb-1 block text-sm text-slate-700">วันที่เริ่ม</label>
              <input
                type="date"
                className="w-full rounded-xl border border-slate-300 bg-white p-2 text-black outline-none placeholder:text-slate-400 focus:border-emerald-500 dark:bg-white dark:text-black"
                value={filters.startDate}
                onChange={(e) => setFilters((p) => ({ ...p, startDate: e.target.value }))}
              />
            </div>
            <div>
              <label className="mb-1 block text-sm text-slate-700">วันที่สิ้นสุด</label>
              <input
                type="date"
                className="w-full rounded-xl border border-slate-300 bg-white p-2 text-black outline-none placeholder:text-slate-400 focus:border-emerald-500 dark:bg-white dark:text-black"
                value={filters.endDate}
                onChange={(e) => setFilters((p) => ({ ...p, endDate: e.target.value }))}
              />
            </div>

            <div>
              <label className="mb-1 block text-sm text-slate-700">สาขา</label>
              <select
                className="w-full rounded-xl border border-slate-300 bg-white p-2 text-black outline-none focus:border-emerald-500 dark:bg-white dark:text-black"
                value={filters.branchId}
                onChange={(e) => setFilters((p) => ({ ...p, branchId: e.target.value, klangId: "" }))}
              >
                <option value="">ทุกสาขา</option>
                {branchOptions.map((b) => (
                  <option key={b.id ?? b.branch_name} value={b.id ?? ""}>
                    {b.branch_name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="mb-1 block text-sm text-slate-700">คลัง</label>
              <select
                className="w-full rounded-xl border border-slate-300 bg-white p-2 text-black outline-none focus:border-emerald-500 disabled:opacity-60 dark:bg-white dark:text-black"
                value={filters.klangId}
                onChange={(e) => setFilters((p) => ({ ...p, klangId: e.target.value }))}
                disabled={!filters.branchId}
              >
                <option value="">ทุกคลัง</option>
                {klangOptions.map((k) => (
                  <option key={k.id ?? k.klang_name} value={k.id ?? ""}>
                    {k.klang_name}
                  </option>
                ))}
              </select>
            </div>

            <div className="md:col-span-2">
              <label className="mb-1 block text-sm text-slate-700">ค้นหา (ชื่อ / ปชช. / เลขที่ใบสำคัญ)</label>
              <input
                className="w-full rounded-xl border border-slate-300 bg-white p-2 text-black outline-none placeholder:text-slate-400 focus:border-emerald-500 dark:bg-white dark:text-black"
                value={filters.q}
                onChange={(e) => setFilters((p) => ({ ...p, q: e.target.value }))}
                placeholder="พิมพ์อย่างน้อย 2 ตัวอักษร แล้วระบบจะค้นหาอัตโนมัติ"
              />
            </div>

            <div className="flex items-end gap-2 md:col-span-6">
              <button
                onClick={fetchOrders}
                className="inline-flex h-10 items-center justify-center rounded-xl bg-emerald-600 px-4 text-white hover:bg-emerald-700 active:scale-[.98]"
              >
                ค้นหา
              </button>
              <button
                onClick={resetFilters}
                className="inline-flex h-10 items-center justify-center rounded-xl border border-slate-300 bg-white px-4 text-slate-700 hover:bg-slate-50 active:scale-[.98]"
              >
                รีเซ็ต
              </button>
            </div>
          </div>
        </div>

        {/* Summary: การ์ดขาวตัวดำ */}
        <div className="mb-4 grid gap-3 md:grid-cols-3">
          <div className="rounded-2xl bg-white p-4 text-black shadow-sm ring-1 ring-slate-200 dark:bg-white dark:text-black">
            <div className="text-slate-500">จำนวนรายการ</div>
            <div className="text-2xl font-semibold">{rows.length.toLocaleString()}</div>
          </div>
          <div className="rounded-2xl bg-white p-4 text-black shadow-sm ring-1 ring-slate-200 dark:bg-white dark:text-black">
            <div className="text-slate-500">น้ำหนักรวม (กก.)</div>
            <div className="text-2xl font-semibold">{Math.round(toNumber(totals.weight) * 100) / 100}</div>
          </div>
          <div className="rounded-2xl bg-white p-4 text-black shadow-sm ring-1 ring-slate-200 dark:bg-white dark:text-black">
            <div className="text-slate-500">มูลค่ารวม</div>
            <div className="text-2xl font-semibold">{thb(toNumber(totals.revenue))}</div>
          </div>
        </div>

        {/* Table: กล่องขาว, ตัวดำ */}
        <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white text-black shadow-sm dark:border-slate-200 dark:bg-white dark:text-black">
          <table className="min-w-full text-left text-sm">
            <thead className="bg-slate-50 text-slate-700">
              <tr>
                <th className="px-3 py-2">วันที่</th>
                <th className="px-3 py-2">เลขที่ใบสำคัญ</th>
                <th className="px-3 py-2">ลูกค้า</th>
                <th className="px-3 py-2">ปชช.</th>
                <th className="px-3 py-2">ชนิดข้าว</th>
                <th className="px-3 py-2">สาขา</th>
                <th className="px-3 py-2">คลัง</th>
                <th className="px-3 py-2 text-right">น้ำหนัก (กก.)</th>
                <th className="px-3 py-2 text-right">เป็นเงิน</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td className="px-3 py-3" colSpan={9}>กำลังโหลด...</td></tr>
              ) : rows.length === 0 ? (
                <tr><td className="px-3 py-3" colSpan={9}>ไม่พบข้อมูล</td></tr>
              ) : (
                rows.map((r) => (
                  <tr key={r.id} className="odd:bg-white even:bg-slate-50 hover:bg-emerald-50">
                    <td className="px-3 py-2">
                      {r.date ? new Date(r.date).toLocaleDateString("th-TH") : "—"}
                    </td>
                    <td className="px-3 py-2">{r.order_serial || "—"}</td>
                    <td className="px-3 py-2">{`${r.first_name ?? ""} ${r.last_name ?? ""}`.trim()}</td>
                    <td className="px-3 py-2">{r.citizen_id || r.citizenId || "—"}</td>
                    <td className="px-3 py-2">{r.rice_type || "—"}</td>
                    <td className="px-3 py-2">{r.branch_name || "—"}</td>
                    <td className="px-3 py-2">{r.klang_name || "—"}</td>
                    <td className="px-3 py-2 text-right">{toNumber(r.weight).toLocaleString()}</td>
                    <td className="px-3 py-2 text-right">{thb(toNumber(r.price))}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

export default Order
