import { useEffect, useMemo, useRef, useState } from "react"

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

/** ---------- Reusable ComboBox (เหมือนหน้า Sales) ---------- */
function ComboBox({
  options = [],
  value,
  onChange, // (newValue, optionObj) => void
  placeholder = "— เลือก —",
  getLabel = (o) => o?.label ?? "",
  getValue = (o) => o?.value ?? o?.id ?? "",
  disabled = false,
  error = false,
}) {
  const [open, setOpen] = useState(false)
  const [highlight, setHighlight] = useState(-1)
  const boxRef = useRef(null)
  const listRef = useRef(null)
  const btnRef = useRef(null)

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
    requestAnimationFrame(() => btnRef.current?.focus())
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
        ref={btnRef}
        disabled={disabled}
        onClick={() => !disabled && setOpen((o) => !o)}
        onKeyDown={onKeyDown}
        className={`w-full rounded-xl border p-2 text-left outline-none transition shadow-none
          ${disabled ? "bg-slate-100 cursor-not-allowed" : "bg-white hover:bg-slate-50"}
          ${error ? "border-red-400" : "border-slate-300 focus:border-emerald-500"}
          dark:border-slate-500/40 dark:bg-slate-700/80 dark:text-slate-100 dark:hover:bg-slate-700/70`}
        aria-haspopup="listbox"
        aria-expanded={open}
      >
        {selectedLabel || <span className="text-slate-400">{placeholder}</span>}
      </button>

      {open && (
        <div
          ref={listRef}
          role="listbox"
          className="absolute z-20 mt-1 max-h-60 w-full overflow-auto rounded-xl border border-slate-200 bg-white text-black shadow dark:border-slate-700 dark:bg-slate-800 dark:text-white"
        >
          {options.length === 0 && (
            <div className="px-3 py-2 text-sm text-slate-500 dark:text-slate-300">ไม่มีตัวเลือก</div>
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
                className={`relative flex w-full items-center gap-2 px-3 py-2 text-left text-sm transition
                  ${isActive
                    ? "bg-emerald-100 ring-1 ring-emerald-300 dark:bg-emerald-400/20 dark:ring-emerald-500"
                    : "hover:bg-emerald-50 dark:hover:bg-emerald-900/30"}`}
              >
                {isActive && (
                  <span className="absolute left-0 top-0 h-full w-1 bg-emerald-500 dark:bg-emerald-400/60 rounded-l-xl" />
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

/** ---------- Page: Order ---------- */
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
  const [riceOptions, setRiceOptions]   = useState([])   // [{id, rice_type}]

  const [filters, setFilters] = useState({
    startDate: firstDayThisMonth,
    endDate: today,
    branchId: "",     // ใช้เก็บ id จริง
    branchName: "",   // เก็บชื่อไว้จับคู่กับ ComboBox (สะดวก map label)
    klangId: "",
    klangName: "",
    riceId: "",
    riceName: "",
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
  }, [])

  /** ---------- Dropdown: Rice (load all) ---------- */
  useEffect(() => {
    const loadRice = async () => {
      try {
        const r = await fetch(`${API_BASE}/order/rice/search`, { headers: authHeader() })
        const data = r.ok ? await r.json() : []
        setRiceOptions(Array.isArray(data) ? data : [])
      } catch (e) {
        console.error("load rice failed:", e)
        setRiceOptions([])
      }
    }
    loadRice()
  }, [])

  /** ---------- Dropdown: Klang (depends on branch) ---------- */
  useEffect(() => {
    const loadKlang = async () => {
      if (!filters.branchId) {
        setKlangOptions([])
        setFilters((p) => ({ ...p, klangId: "", klangName: "" }))
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
      if (filters.riceId)  params.set("rice_id", filters.riceId) // <<— ส่ง rice_id ด้วย
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
      branchName: "",
      klangId: "",
      klangName: "",
      riceId: "",
      riceName: "",
      q: "",
    })
  }

  /** ----------- UI ----------- */
  return (
    // พื้นหลังหลัก: Light = ขาว, Dark = slate-900 + มุมมนสไตล์เดียวกับหน้า Sales
    <div className="min-h-screen bg-white text-black dark:bg-slate-900 dark:text-white rounded-2xl">
      <div className="mx-auto max-w-7xl p-4 md:p-6">
        {/* หัวข้อเข้ากับทุกโหมด */}
        <h1 className="mb-4 text-2xl font-bold text-gray-900 dark:text-white">
          📦 รายการออเดอร์ซื้อข้าวเปลือก
        </h1>

        {/* Filters: การ์ด + ComboBox แบบเดียวกับ Sales */}
        <div className="mb-4 rounded-2xl border border-slate-200 bg-white p-4 text-black shadow-sm dark:border-slate-700 dark:bg-slate-800 dark:text-white">
          <div className="grid gap-3 md:grid-cols-6">
            <div>
              <label className="mb-1 block text-sm text-slate-700 dark:text-slate-300">วันที่เริ่ม</label>
              <input
                type="date"
                className="w-full rounded-xl border border-slate-300 bg-white p-2 text-black outline-none placeholder:text-slate-400 focus:border-emerald-500
                dark:border-slate-500/40 dark:bg-slate-700/80 dark:text-slate-100 dark:placeholder:text-slate-400 shadow-none"
                value={filters.startDate}
                onChange={(e) => setFilters((p) => ({ ...p, startDate: e.target.value }))}
              />
            </div>
            <div>
              <label className="mb-1 block text-sm text-slate-700 dark:text-slate-300">วันที่สิ้นสุด</label>
              <input
                type="date"
                className="w-full rounded-xl border border-slate-300 bg-white p-2 text-black outline-none placeholder:text-slate-400 focus:border-emerald-500
                dark:border-slate-500/40 dark:bg-slate-700/80 dark:text-slate-100 dark:placeholder:text-slate-400 shadow-none"
                value={filters.endDate}
                onChange={(e) => setFilters((p) => ({ ...p, endDate: e.target.value }))}
              />
            </div>

            {/* สาขา: ใช้ ComboBox */}
            <div>
              <label className="mb-1 block text-sm text-slate-700 dark:text-slate-300">สาขา</label>
              <ComboBox
                options={branchOptions.map((b) => ({ id: b.id, label: b.branch_name }))}
                value={filters.branchName}
                getValue={(o) => o.label} // เก็บค่าเป็นชื่อเพื่อโชว์ label ตรง ๆ
                onChange={(_val, found) =>
                  setFilters((p) => ({
                    ...p,
                    branchName: found?.label ?? "",
                    branchId: found?.id ?? "",
                    // reset คลังเมื่อเปลี่ยนสาขา
                    klangId: "",
                    klangName: "",
                  }))
                }
                placeholder="— เลือกสาขา —"
              />
            </div>

            {/* คลัง: ใช้ ComboBox */}
            <div>
              <label className="mb-1 block text-sm text-slate-700 dark:text-slate-300">คลัง</label>
              <ComboBox
                options={klangOptions.map((k) => ({ id: k.id, label: k.klang_name }))}
                value={filters.klangName}
                getValue={(o) => o.label}
                onChange={(_val, found) =>
                  setFilters((p) => ({
                    ...p,
                    klangName: found?.label ?? "",
                    klangId: found?.id ?? "",
                  }))
                }
                placeholder="— เลือกคลัง —"
                disabled={!filters.branchId}
              />
            </div>

            {/* ประเภทข้าว: ใช้ ComboBox */}
            <div>
              <label className="mb-1 block text-sm text-slate-700 dark:text-slate-300">ประเภทข้าว</label>
              <ComboBox
                options={riceOptions.map((r) => ({ id: r.id, label: r.rice_type }))}
                value={filters.riceName}
                getValue={(o) => o.label}
                onChange={(_val, found) =>
                  setFilters((p) => ({
                    ...p,
                    riceName: found?.label ?? "",
                    riceId: found?.id ?? "",
                  }))
                }
                placeholder="— เลือกประเภทข้าว —"
              />
            </div>

            <div className="md:col-span-2">
              <label className="mb-1 block text-sm text-slate-700 dark:text-slate-300">ค้นหา (ชื่อ / ปชช. / เลขที่ใบสำคัญ)</label>
              <input
                className="w-full rounded-xl border border-slate-300 bg-white p-2 text-black outline-none placeholder:text-slate-400 focus:border-emerald-500
                dark:border-slate-500/40 dark:bg-slate-700/80 dark:text-slate-100 dark:placeholder:text-slate-400 shadow-none"
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
                className="inline-flex h-10 items-center justify-center rounded-xl border border-slate-300 bg-white px-4 text-slate-700 hover:bg-slate-50 active:scale-[.98] dark:border-slate-600 dark:bg-slate-700/60 dark:text-white dark:hover:bg-slate-700/50 shadow-none"
              >
                รีเซ็ต
              </button>
            </div>
          </div>
        </div>

        {/* Summary: การ์ดปรับตามโหมด */}
        <div className="mb-4 grid gap-3 md:grid-cols-3">
          <div className="rounded-2xl bg-white p-4 text-black shadow-sm ring-1 ring-slate-200 dark:bg-slate-800 dark:text-white dark:ring-slate-700">
            <div className="text-slate-500 dark:text-slate-400">จำนวนรายการ</div>
            <div className="text-2xl font-semibold">{rows.length.toLocaleString()}</div>
          </div>
          <div className="rounded-2xl bg-white p-4 text-black shadow-sm ring-1 ring-slate-200 dark:bg-slate-800 dark:text-white dark:ring-slate-700">
            <div className="text-slate-500 dark:text-slate-400">น้ำหนักรวม (กก.)</div>
            <div className="text-2xl font-semibold">
              {Math.round(toNumber(totals.weight) * 100) / 100}
            </div>
          </div>
          <div className="rounded-2xl bg-white p-4 text-black shadow-sm ring-1 ring-slate-200 dark:bg-slate-800 dark:text-white dark:ring-slate-700">
            <div className="text-slate-500 dark:text-slate-400">มูลค่ารวม</div>
            <div className="text-2xl font-semibold">{thb(toNumber(totals.revenue))}</div>
          </div>
        </div>

        {/* Table: ปรับตามโหมด */}
        <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white text-black shadow-sm dark:border-slate-700 dark:bg-slate-800 dark:text-white">
          <table className="min-w-full text-left text-sm">
            <thead className="bg-slate-50 text-slate-700 dark:bg-slate-700 dark:text-slate-200">
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
                  <tr
                    key={r.id}
                    className="odd:bg-white even:bg-slate-50 hover:bg-emerald-50 dark:odd:bg-slate-800 dark:even:bg-slate-700 dark:hover:bg-slate-700/70"
                  >
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
