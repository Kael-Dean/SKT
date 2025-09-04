import { useEffect, useMemo, useState } from "react"

/** ---------- ENV ---------- */
const API_BASE = import.meta.env.VITE_API_BASE || ""

/** ---------- Utils ---------- */
const nf = (n) =>
  new Intl.NumberFormat("th-TH", {
    maximumFractionDigits: 2,
  }).format(isFinite(n) ? Number(n) : 0)

const detailOptions = [
  { value: "rice_subrice", label: "สรุป: ข้าว → ชนิดย่อย" },
  { value: "rice_subrice_year", label: "สรุป: ข้าว → ชนิดย่อย → ปี" },
  { value: "rice_subrice_year_condition", label: "ละเอียด: ข้าว → ชนิดย่อย → ปี → สภาพ" },
]

/** ---------- Helpers ---------- */
function sumTotal(payload = [], detail = "rice_subrice_year_condition") {
  // รวมยอดทั้งหมดจากรูปแบบ tree ที่ backend ส่งกลับ
  let total = 0
  for (const rice of payload) {
    total += Number(rice.total || 0)
  }
  return total
}

function countNodes(payload = []) {
  let riceCount = payload.length
  let subriceCount = 0
  let yearCount = 0
  let conditionCount = 0

  for (const r of payload) {
    subriceCount += (r.items || []).length
    for (const s of r.items || []) {
      yearCount += (s.items || []).length
      for (const y of s.items || []) {
        conditionCount += (y.items || []).length
      }
    }
  }
  return { riceCount, subriceCount, yearCount, conditionCount }
}

/** ---------- UI Chips ---------- */
function Pill({ children }) {
  return (
    <span className="inline-flex items-center rounded-full bg-emerald-50 dark:bg-emerald-900/30 px-3 py-1 text-xs font-medium text-emerald-700 dark:text-emerald-200 ring-1 ring-emerald-200/70 dark:ring-emerald-800/60">
      {children}
    </span>
  )
}

/** ---------- Tree Rows ---------- */
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
          {/* ปี (หรือถ้า detail เป็นแค่ subrice ก็จะว่าง) */}
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
  // Required
  const [productId, setProductId] = useState("")
  const [branchId, setBranchId] = useState("")
  // Optional
  const [klangId, setKlangId] = useState("")
  const [riceId, setRiceId] = useState("")
  const [subriceId, setSubriceId] = useState("")
  const [yearId, setYearId] = useState("")
  const [conditionId, setConditionId] = useState("")
  const [detail, setDetail] = useState("rice_subrice_year_condition")

  const [search, setSearch] = useState("")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")
  const [data, setData] = useState([])

  // ดึงข้อมูลเมื่อกดปุ่ม (ไม่ auto เพื่อควบคุมโหลด)
  const fetchTree = async () => {
    setError("")
    // validate
    if (!productId || !branchId) {
      setError("กรุณากรอก Product ID และ Branch ID (จำเป็น)")
      return
    }
    setLoading(true)
    try {
      const params = new URLSearchParams()
      params.set("product_id", String(productId))
      params.set("branch_id", String(branchId))
      params.set("detail", detail)
      if (klangId) params.set("klang_id", String(klangId))
      if (riceId) params.set("rice_id", String(riceId))
      if (subriceId) params.set("subrice_id", String(subriceId))
      if (yearId) params.set("year_id", String(yearId))
      if (conditionId) params.set("condition_id", String(conditionId))

      const res = await fetch(`${API_BASE}/stock/tree?` + params.toString(), {
        headers: { "Content-Type": "application/json" },
      })
      if (!res.ok) {
        const text = await res.text()
        throw new Error(text || `HTTP ${res.status}`)
      }
      const json = await res.json()
      setData(Array.isArray(json) ? json : [])
    } catch (e) {
      setError(e?.message || "โหลดข้อมูลไม่สำเร็จ")
      setData([])
    } finally {
      setLoading(false)
    }
  }

  // สถิติรวม
  const stats = useMemo(() => {
    const total = sumTotal(data, detail)
    const { riceCount, subriceCount, yearCount, conditionCount } = countNodes(data)
    return { total, riceCount, subriceCount, yearCount, conditionCount }
  }, [data, detail])

  // filter คำค้นหาด้วยชื่อข้าว/ชนิดย่อย
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return data
    return (data || [])
      .map((r) => {
        const matchRice = (r.rice_type || "").toLowerCase().includes(q)
        const filteredSubs = (r.items || []).filter((s) =>
          (s.sub_class || "").toLowerCase().includes(q)
        )
        if (matchRice) return r // ถ้าชื่อข้าวโดน ให้ทั้งก้อน
        if (filteredSubs.length > 0) return { ...r, items: filteredSubs, total: r.total }
        return null
      })
      .filter(Boolean)
  }, [data, search])

  // เติมตัวอย่างค่า dev ให้ทดสอบเร็ว (ลบหรือแก้ตามโปรดักชันได้)
  useEffect(() => {
    if (import.meta.env.DEV) {
      // ใส่ค่า mock ที่เจอบ่อยในระบบคุณได้ตามจริง
      setDetail("rice_subrice_year_condition")
    }
  }, [])

  return (
    <div className="p-4 sm:p-6">
      {/* Heading */}
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-2xl sm:text-3xl font-bold">
          คลังสินค้า
          <span className="block text-sm font-normal text-gray-500">
            ดูจำนวนและราคาข้าวตามสาขา/คลัง ตามโครงสร้างที่กำหนดโดย backend
          </span>
        </h1>
        <div className="hidden sm:flex items-center gap-2">
          <Pill>API: /stock/tree</Pill>
          <Pill>Method: GET</Pill>
        </div>
      </div>

      {/* Controls */}
      <div className="grid lg:grid-cols-12 gap-4 mb-4">
        <div className="lg:col-span-9">
          <div className="rounded-2xl border border-gray-200 dark:border-gray-700 bg-white/70 dark:bg-gray-900/60 shadow-sm p-4">
            <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
              <div>
                <label className="block text-sm text-gray-600 mb-1">Product ID (จำเป็น)</label>
                <input
                  value={productId}
                  onChange={(e) => setProductId(e.target.value)}
                  type="number"
                  className="w-full rounded-xl border border-gray-300 dark:border-gray-700 bg-white/80 dark:bg-gray-900 px-3 py-2 outline-none focus:ring-2 focus:ring-emerald-400"
                  placeholder="เช่น 1"
                />
              </div>
              <div>
                <label className="block text-sm text-gray-600 mb-1">Branch ID (จำเป็น)</label>
                <input
                  value={branchId}
                  onChange={(e) => setBranchId(e.target.value)}
                  type="number"
                  className="w-full rounded-xl border border-gray-300 dark:border-gray-700 bg-white/80 dark:bg-gray-900 px-3 py-2 outline-none focus:ring-2 focus:ring-emerald-400"
                  placeholder="เช่น 1"
                />
              </div>
              <div>
                <label className="block text-sm text-gray-600 mb-1">Klang ID (ถ้ามี)</label>
                <input
                  value={klangId}
                  onChange={(e) => setKlangId(e.target.value)}
                  type="number"
                  className="w-full rounded-xl border border-gray-300 dark:border-gray-700 bg-white/80 dark:bg-gray-900 px-3 py-2 outline-none focus:ring-2 focus:ring-emerald-400"
                  placeholder="กรองตามคลัง (ทางเลือก)"
                />
              </div>
              <div>
                <label className="block text-sm text-gray-600 mb-1">Detail</label>
                <select
                  value={detail}
                  onChange={(e) => setDetail(e.target.value)}
                  className="w-full rounded-xl border border-gray-300 dark:border-gray-700 bg-white/80 dark:bg-gray-900 px-3 py-2 outline-none focus:ring-2 focus:ring-emerald-400"
                >
                  {detailOptions.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3 mt-3">
              <div>
                <label className="block text-sm text-gray-600 mb-1">Rice ID (ถ้ามี)</label>
                <input
                  value={riceId}
                  onChange={(e) => setRiceId(e.target.value)}
                  type="number"
                  className="w-full rounded-xl border border-gray-300 dark:border-gray-700 bg-white/80 dark:bg-gray-900 px-3 py-2 outline-none focus:ring-2 focus:ring-emerald-400"
                  placeholder="กรองตามข้าว"
                />
              </div>
              <div>
                <label className="block text-sm text-gray-600 mb-1">Subrice ID (ถ้ามี)</label>
                <input
                  value={subriceId}
                  onChange={(e) => setSubriceId(e.target.value)}
                  type="number"
                  className="w-full rounded-xl border border-gray-300 dark:border-gray-700 bg-white/80 dark:bg-gray-900 px-3 py-2 outline-none focus:ring-2 focus:ring-emerald-400"
                  placeholder="กรองชนิดย่อย"
                />
              </div>
              <div>
                <label className="block text-sm text-gray-600 mb-1">Year ID (ถ้ามี)</label>
                <input
                  value={yearId}
                  onChange={(e) => setYearId(e.target.value)}
                  type="number"
                  className="w-full rounded-xl border border-gray-300 dark:border-gray-700 bg-white/80 dark:bg-gray-900 px-3 py-2 outline-none focus:ring-2 focus:ring-emerald-400"
                  placeholder="กรองปี"
                />
              </div>
              <div>
                <label className="block text-sm text-gray-600 mb-1">Condition ID (ถ้ามี)</label>
                <input
                  value={conditionId}
                  onChange={(e) => setConditionId(e.target.value)}
                  type="number"
                  className="w-full rounded-xl border border-gray-300 dark:border-gray-700 bg-white/80 dark:bg-gray-900 px-3 py-2 outline-none focus:ring-2 focus:ring-emerald-400"
                  placeholder="กรองสภาพ"
                />
              </div>
            </div>

            <div className="mt-4 flex flex-col sm:flex-row gap-3 items-stretch sm:items-end">
              <div className="flex-1">
                <label className="block text-sm text-gray-600 mb-1">ค้นหา (ชื่อข้าว/ชนิดย่อย)</label>
                <input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  type="text"
                  className="w-full rounded-xl border border-gray-300 dark:border-gray-700 bg-white/80 dark:bg-gray-900 px-3 py-2 outline-none focus:ring-2 focus:ring-emerald-400"
                  placeholder="พิมพ์เพื่อกรองผลลัพธ์"
                />
              </div>
              <button
                onClick={fetchTree}
                className="whitespace-nowrap rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-semibold px-5 py-2 shadow"
              >
                {loading ? "กำลังดึงข้อมูล…" : "ดึงข้อมูล"}
              </button>
            </div>

            {/* Error */}
            {error && (
              <div className="mt-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                {error}
              </div>
            )}

            {/* Active Filters */}
            <div className="mt-3 flex flex-wrap gap-2">
              {productId && <Pill>Product: {productId}</Pill>}
              {branchId && <Pill>Branch: {branchId}</Pill>}
              {klangId && <Pill>Klang: {klangId}</Pill>}
              {riceId && <Pill>Rice: {riceId}</Pill>}
              {subriceId && <Pill>Subrice: {subriceId}</Pill>}
              {yearId && <Pill>Year: {yearId}</Pill>}
              {conditionId && <Pill>Condition: {conditionId}</Pill>}
              <Pill>
                Detail: {detailOptions.find((d) => d.value === detail)?.label || detail}
              </Pill>
            </div>
          </div>
        </div>

        {/* Summary */}
        <div className="lg:col-span-3">
          <div className="grid sm:grid-cols-2 lg:grid-cols-1 gap-3">
            <div className="rounded-2xl border border-gray-200 dark:border-gray-700 bg-white/70 dark:bg-gray-900/60 shadow-sm p-4">
              <div className="text-sm text-gray-500">ปริมาณรวม</div>
              <div className="text-2xl font-bold mt-1 tabular-nums">{nf(stats.total)} กก.</div>
              <div className="text-xs text-gray-400 mt-1">
                มาจากยอดรวมทุกระดับตามผลลัพธ์ปัจจุบัน
              </div>
            </div>
            <div className="rounded-2xl border border-gray-200 dark:border-gray-700 bg-white/70 dark:bg-gray-900/60 shadow-sm p-4">
              <div className="text-sm text-gray-500">จำนวนรายการ</div>
              <div className="mt-2 grid grid-cols-2 gap-2 text-sm">
                <div className="flex items-center justify-between">
                  <span className="text-gray-600">ชนิดข้าว</span>
                  <span className="font-semibold tabular-nums">{nf(stats.riceCount)}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-gray-600">ชนิดย่อย</span>
                  <span className="font-semibold tabular-nums">{nf(stats.subriceCount)}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-gray-600">ปี</span>
                  <span className="font-semibold tabular-nums">{nf(stats.yearCount)}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-gray-600">สภาพ</span>
                  <span className="font-semibold tabular-nums">{nf(stats.conditionCount)}</span>
                </div>
              </div>
            </div>
            <div className="rounded-2xl border border-gray-200 dark:border-gray-700 bg-white/70 dark:bg-gray-900/60 shadow-sm p-4">
              <div className="text-sm text-gray-500">ทิป</div>
              <ul className="mt-2 space-y-1 text-xs text-gray-500 leading-relaxed">
                <li>• ใส่ Klang ID เพื่อแยกดูเฉพาะคลังในสาขาเดียวกัน</li>
                <li>• เปลี่ยน Detail เพื่อดูความลึกที่ต้องการ</li>
                <li>• ช่องค้นหาช่วยกรองด้วยชื่อข้าว/ชนิดย่อย</li>
              </ul>
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

        {!loading && filtered.length === 0 && (
          <div className="rounded-2xl border border-gray-200 dark:border-gray-700 bg-white/70 dark:bg-gray-900/60 p-6 text-gray-500">
            ยังไม่มีข้อมูล แก้เงื่อนไขแล้วกด “ดึงข้อมูล”
          </div>
        )}

        {!loading &&
          filtered.map((r) => (
            <RiceRow key={`${r.rice_id}-${r.rice_type}`} node={r} />
          ))}
      </div>
    </div>
  )
}

export default Stock
