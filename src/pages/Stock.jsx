import { useEffect, useMemo, useRef, useState } from "react"

/** ---------- ENV ---------- */
const API_BASE = import.meta.env.VITE_API_BASE || ""

/** ---------- Auth header ---------- */
const authHeader = () => {
  const token = localStorage.getItem("token")
  return {
    "Content-Type": "application/json",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  }
}

/** ---------- Utils ---------- */
const nf = (n) =>
  new Intl.NumberFormat("th-TH", { maximumFractionDigits: 2 }).format(isFinite(n) ? Number(n) : 0)
const thb = (n) =>
  new Intl.NumberFormat("th-TH", { style: "currency", currency: "THB", maximumFractionDigits: 2 }).format(
    isFinite(n) ? Number(n) : 0
  )

/** รวม “กิโล” จาก tree ของ /stock/tree */
function sumWeight(payload = []) {
  let total = 0
  for (const rice of payload || []) total += Number(rice.total || 0)
  return total
}

/** พยายามคำนวณ “มูลค่ารวม” ถ้า API มีข้อมูลราคา/มูลค่าให้
 *  รองรับกุญแจที่อาจพบ: value, price_total, total_value, avg_price_per_kg, price_per_kg, unit_price
 *  ถ้าไม่มีข้อมูลราคาพอ -> คืน null (ไปแสดง “—” ที่ UI)
 */
function sumValue(payload = []) {
  let total = 0
  let foundAnyPrice = false

  const add = (amt) => {
    const v = Number(amt)
    if (isFinite(v)) {
      total += v
      foundAnyPrice = true
    }
  }

  for (const r of payload || []) {
    // มูลค่าที่ระดับ rice (ถ้ามี)
    add(r.value ?? r.price_total ?? r.total_value)

    for (const s of r.items || []) {
      add(s.value ?? s.price_total ?? s.total_value)

      for (const y of s.items || []) {
        // ระดับปี: อาจเป็น leaf (available) หรือมี condition แยก
        if (Array.isArray(y.items) && y.items.length > 0) {
          for (const c of y.items) {
            if (c.value ?? c.price_total ?? c.total_value) {
              add(c.value ?? c.price_total ?? c.total_value)
            } else if (c.available && (c.avg_price_per_kg ?? c.price_per_kg ?? c.unit_price)) {
              add(Number(c.available) * Number(c.avg_price_per_kg ?? c.price_per_kg ?? c.unit_price))
            }
          }
        } else {
          // leaf กรณี detail=rice_subrice_year (ไม่มี condition)
          if (y.value ?? y.price_total ?? y.total_value) {
            add(y.value ?? y.price_total ?? y.total_value)
          } else if (y.available && (y.avg_price_per_kg ?? y.price_per_kg ?? y.unit_price)) {
            add(Number(y.available) * Number(y.avg_price_per_kg ?? y.price_per_kg ?? y.unit_price))
          }
        }
      }
    }
  }

  return foundAnyPrice ? total : null
}

/** ---------- ComboBox (เหมือนหน้า Order) ---------- */
function ComboBox({
  options = [],
  value,
  onChange,
  placeholder = "— เลือก —",
  getLabel = (o) => o?.label ?? "",
  getValue = (o) => o?.id ?? o?.value ?? "",
  disabled = false,
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

  return (
    <div className="relative" ref={boxRef}>
      <button
        type="button"
        ref={btnRef}
        disabled={disabled}
        onClick={() => !disabled && setOpen((o) => !o)}
        className={[
          "w-full rounded-2xl border p-3 text-left text-[15px] md:text-base outline-none transition shadow-none",
          disabled ? "bg-slate-100 cursor-not-allowed" : "bg-slate-100 hover:bg-slate-200 cursor-pointer",
          "border-slate-300 focus:border-emerald-600 focus:ring-2 focus:ring-emerald-500/30",
          "text-black placeholder:text-slate-500",
          "dark:border-slate-500/40 dark:bg-slate-700/80 dark:text-slate-100 dark:hover:bg-slate-700/70 dark:placeholder:text-slate-300 dark:focus:border-emerald-400 dark:focus:ring-emerald-400/30",
        ].join(" ")}
        aria-haspopup="listbox"
        aria-expanded={open}
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
            const isChosen = String(getValue(opt)) === String(value)
            return (
              <button
                key={String(getValue(opt)) || label || idx}
                type="button"
                role="option"
                aria-selected={isChosen}
                onMouseEnter={() => setHighlight(idx)}
                onClick={() => commit(opt)}
                className={[
                  "relative flex w-full items-center gap-2 px-3 py-2.5 text-left text-[15px] md:text-base transition rounded-xl cursor-pointer",
                  idx === highlight
                    ? "bg-emerald-100 ring-1 ring-emerald-300 dark:bg-emerald-400/20 dark:ring-emerald-500"
                    : "hover:bg-emerald-50 dark:hover:bg-emerald-900/30",
                ].join(" ")}
              >
                {idx === highlight && (
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

/** ---------- UI Bits ---------- */
function Pill({ children }) {
  return (
    <span className="inline-flex items-center rounded-full bg-emerald-50 dark:bg-emerald-900/30 px-3 py-1 text-xs font-medium text-emerald-700 dark:text-emerald-200 ring-1 ring-emerald-200/70 dark:ring-emerald-800/60">
      {children}
    </span>
  )
}

/** ---------- Tree Rows (เหมือนเดิม) ---------- */
function RiceRow({ node }) {
  return (
    <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white/70 dark:bg-gray-900/60 shadow-sm">
      <details className="group open:!bg-white dark:open:!bg-gray-900 rounded-xl">
        <summary className="cursor-pointer list-none px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="size-2.5 rounded-full bg-emerald-500/80"></div>
            <div className="font-semibold">
              {node.rice_type ?? "—"}{" "}
              <span className="text-gray-400 text-sm ml-2">#{node.rice_id ?? "-"}</span>
            </div>
          </div>
          <div className="text-right tabular-nums font-semibold">{nf(node.total)} กก.</div>
        </summary>
        <div className="px-4 pb-3">
          {(node.items || []).map((sub) => (
            <SubriceRow key={`${sub.subrice_id}-${sub.sub_class}`} node={sub} />
          ))}
        </div>
      </details>
    </div>
  )
}

function SubriceRow({ node }) {
  return (
    <div className="ml-2 my-2 rounded-lg border border-gray-100 dark:border-gray-800 bg-gray-50/60 dark:bg-gray-800/40">
      <details className="group open:!bg-white/70 dark:open:!bg-gray-900/60 rounded-lg">
        <summary className="cursor-pointer list-none px-3 py-2 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="size-2 rounded-full bg-teal-400/80"></div>
            <div className="font-medium">
              {node.sub_class ?? "—"}{" "}
              <span className="text-gray-400 text-xs ml-2">#{node.subrice_id ?? "-"}</span>
            </div>
          </div>
          <div className="text-right tabular-nums">{nf(node.total)} กก.</div>
        </summary>
        <div className="px-3 pb-2">
          {(node.items || []).map((y) => (
            <YearRow key={`${y.year_id}-${y.year}`} node={y} />
          ))}
        </div>
      </details>
    </div>
  )
}

function YearRow({ node }) {
  const hasCondition = Array.isArray(node.items) && node.items.length > 0
  return (
    <div className="ml-2 my-1 rounded-md border border-gray-100 dark:border-gray-800">
      <div className="px-3 py-2 flex items-center justify-between">
        <div className="flex items-center gap-2 text-sm">
          <div className="size-1.5 rounded-full bg-cyan-400/80"></div>
          <div className="font-medium">ปี {node.year ?? "—"}</div>
        </div>
        <div className="text-right tabular-nums text-sm font-medium">
          {nf(node.total ?? node.available ?? 0)} กก.
        </div>
      </div>
      {hasCondition && (
        <div className="px-3 pb-2">
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-2">
            {node.items.map((c) => (
              <div
                key={`${c.condition_id}-${c.condition}`}
                className="rounded-md border border-gray-100 dark:border-gray-800 px-3 py-2 flex items-center justify-between"
              >
                <div className="text-xs text-gray-600 dark:text-gray-300">
                  {c.condition ?? "—"}{" "}
                  <span className="text-gray-400">#{c.condition_id ?? "-"}</span>
                </div>
                <div className="tabular-nums text-sm font-medium">{nf(c.available)} กก.</div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

/** ---------- Main Page ---------- */
const Stock = () => {
  /** dropdown options */
  const [branchOptions, setBranchOptions] = useState([]) // [{id,label}]
  const [klangOptions, setKlangOptions] = useState([])   // [{id,label}]
  const [defaultProductId, setDefaultProductId] = useState("") // ต้องส่งให้ /stock/tree

  /** selections */
  const [branchId, setBranchId] = useState("")
  const [branchName, setBranchName] = useState("")
  const [klangId, setKlangId] = useState("")
  const [klangName, setKlangName] = useState("")

  /** data */
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")
  const [data, setData] = useState([])

  /** load branches + pick default product (อัตโนมัติ) */
  useEffect(() => {
    const loadInitial = async () => {
      try {
        const [bRes, pRes] = await Promise.all([
          fetch(`${API_BASE}/order/branch/search`, { headers: authHeader() }),
          fetch(`${API_BASE}/order/product/search`, { headers: authHeader() }),
        ])

        const branches = bRes.ok ? await bRes.json() : []
        setBranchOptions(
          (Array.isArray(branches) ? branches : []).map((x) => ({ id: String(x.id), label: x.branch_name }))
        )

        const products = pRes.ok ? await pRes.json() : []
        // เลือก product ที่ชื่อมีคำว่า "ข้าว" ก่อน ถ้าไม่เจอใช้ตัวแรก
        let chosen = products.find((x) => (x.product_type || "").includes("ข้าว")) || products[0]
        if (chosen?.id) setDefaultProductId(String(chosen.id))
      } catch (e) {
        console.error(e)
      }
    }
    loadInitial()
  }, [])

  /** load klang เมื่อเลือกสาขา */
  useEffect(() => {
    const loadKlangs = async () => {
      setKlangOptions([])
      setKlangId("")
      setKlangName("")
      if (!branchId) return
      try {
        const r = await fetch(`${API_BASE}/order/klang/search?branch_id=${branchId}`, { headers: authHeader() })
        const arr = r.ok ? await r.json() : []
        setKlangOptions((Array.isArray(arr) ? arr : []).map((x) => ({ id: String(x.id), label: x.klang_name })))
      } catch (e) {
        console.error("load klang failed:", e)
      }
    }
    loadKlangs()
  }, [branchId])

  /** fetch stock tree (เรียกเมื่อมี branchId และรู้ defaultProductId; ถ้าเลือกคลังจะส่ง klang_id ด้วย) */
  useEffect(() => {
    const fetchTree = async () => {
      setError("")
      setData([])
      if (!branchId || !defaultProductId) return

      setLoading(true)
      try {
        const params = new URLSearchParams()
        params.set("product_id", String(defaultProductId))
        params.set("branch_id", String(branchId))
        params.set("detail", "rice_subrice_year_condition")
        if (klangId) params.set("klang_id", String(klangId))

        const res = await fetch(`${API_BASE}/stock/tree?` + params.toString(), { headers: authHeader() })
        if (!res.ok) {
          const t = await res.text()
          throw new Error(t || `HTTP ${res.status}`)
        }
        const json = await res.json()
        setData(Array.isArray(json) ? json : [])
      } catch (e) {
        setError(e?.message || "โหลดข้อมูลไม่สำเร็จ")
      } finally {
        setLoading(false)
      }
    }
    fetchTree()
  }, [API_BASE, branchId, klangId, defaultProductId])

  /** totals */
  const totals = useMemo(() => {
    const weight = sumWeight(data)
    const value = sumValue(data) // อาจเป็น null ถ้า API ไม่มีราคาพอ
    return { weight, value }
  }, [data])

  /** UI */
  return (
    <div className="p-4 sm:p-6">
      {/* Header */}
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-2xl sm:text-3xl font-bold">
          คลังสินค้า
          <span className="block text-sm font-normal text-gray-500">
            สรุปรวมตาม <span className="font-medium">สาขา</span> และ <span className="font-medium">คลัง</span> (ถ้าเลือก)
          </span>
        </h1>
        <div className="hidden sm:flex items-center gap-2">
          <Pill>API: /stock/tree</Pill>
          <Pill>Method: GET</Pill>
        </div>
      </div>

      {/* Controls: มีแค่ สาขา / คลัง */}
      <div className="grid lg:grid-cols-12 gap-4 mb-4">
        <div className="lg:col-span-9">
          <div className="rounded-2xl border border-gray-200 dark:border-gray-700 bg-white/70 dark:bg-gray-900/60 shadow-sm p-4">
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
              <div>
                <label className="block text-sm text-gray-600 mb-1">สาขา</label>
                <ComboBox
                  options={branchOptions}
                  value={branchId}
                  onChange={(id, found) => {
                    setBranchId(id || "")
                    setBranchName(found?.label ?? "")
                  }}
                  placeholder="— เลือกสาขา —"
                />
              </div>
              <div>
                <label className="block text-sm text-gray-600 mb-1">คลัง (ทางเลือก)</label>
                <ComboBox
                  options={klangOptions}
                  value={klangId}
                  onChange={(id, found) => {
                    setKlangId(id || "")
                    setKlangName(found?.label ?? "")
                  }}
                  placeholder="— เลือกคลัง —"
                  disabled={!branchId}
                />
              </div>
              <div className="flex items-end">
                <div className="flex flex-wrap gap-2">
                  {branchId && <Pill>สาขา: {branchName || branchId}</Pill>}
                  {klangId && <Pill>คลัง: {klangName || klangId}</Pill>}
                </div>
              </div>
            </div>

            {/* Error */}
            {error && (
              <div className="mt-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                {error}
              </div>
            )}
          </div>
        </div>

        {/* Summary */}
        <div className="lg:col-span-3">
          <div className="grid sm:grid-cols-2 lg:grid-cols-1 gap-3">
            <div className="rounded-2xl border border-gray-200 dark:border-gray-700 bg-white/70 dark:bg-gray-900/60 shadow-sm p-4">
              <div className="text-sm text-gray-500">
                ปริมาณรวม {klangId ? "(คลังที่เลือก)" : "(ทุกคลังในสาขา)"}
              </div>
              <div className="text-2xl font-bold mt-1 tabular-nums">{nf(totals.weight)} กก.</div>
            </div>

            <div className="rounded-2xl border border-gray-200 dark:border-gray-700 bg-white/70 dark:bg-gray-900/60 shadow-sm p-4">
              <div className="text-sm text-gray-500">
                มูลค่ารวม {klangId ? "(คลังที่เลือก)" : "(ทุกคลังในสาขา)"}
              </div>
              <div className="text-2xl font-bold mt-1 tabular-nums">
                {totals.value === null ? "—" : thb(totals.value)}
              </div>
              {totals.value === null && (
                <div className="text-xs text-gray-400 mt-1">
                  ไม่พบข้อมูลราคาจาก API (value/price_per_kg) — จะแสดงเมื่อ backend ส่งราคามา
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Data */}
      <div className="space-y-3">
        {loading && (
          <div className="rounded-2xl border border-gray-200 dark:border-gray-700 bg-white/70 dark:bg-gray-900/60 p-6 animate-pulse text-gray-500">
            กำลังโหลดข้อมูลจากเซิร์ฟเวอร์…
          </div>
        )}

        {!loading && (!data || data.length === 0) && (
          <div className="rounded-2xl border border-gray-200 dark:border-gray-700 bg-white/70 dark:bg-gray-900/60 p-6 text-gray-500">
            {branchId ? "ไม่พบข้อมูลสต็อกสำหรับเงื่อนไขปัจจุบัน" : "กรุณาเลือกสาขา"}
          </div>
        )}

        {!loading && data && data.length > 0 && data.map((r) => (
          <RiceRow key={`${r.rice_id}-${r.rice_type}`} node={r} />
        ))}
      </div>
    </div>
  )
}

export default Stock
