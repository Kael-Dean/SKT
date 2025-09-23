// src/pages/Stock.jsx
import { useEffect, useMemo, useRef, useState } from "react"
import { apiAuth } from "../lib/api" // ← รวม base URL + token + JSON ให้แล้ว

/** ---------- Utils ---------- */
const nf = (n) =>
  new Intl.NumberFormat("th-TH", { maximumFractionDigits: 2 }).format(isFinite(n) ? Number(n) : 0)
const thb = (n) =>
  new Intl.NumberFormat("th-TH", { style: "currency", currency: "THB", maximumFractionDigits: 2 }).format(
    isFinite(n) ? Number(n) : 0
  )

/** คำนวณรวมจาก tree ที่ได้จาก /report/stock/tree (แบบ StockTreeResponse) */
function sumLeafQty(items = []) {
  let s = 0
  for (const it of items) s += Number(it?.qty_kg ?? 0)
  return s
}
function sumProgramList(programs = []) {
  let s = 0
  for (const p of programs) s += sumLeafQty(p?.items)
  return s
}
function sumFieldList(fields = []) {
  let s = 0
  for (const f of fields) s += sumProgramList(f?.programs)
  return s
}
function sumConditionList(conditions = []) {
  let s = 0
  for (const c of conditions) s += sumFieldList(c?.fields)
  return s
}
function sumYearList(years = []) {
  let s = 0
  for (const y of years) s += sumConditionList(y?.conditions)
  return s
}
function sumSubriceList(subrices = []) {
  let s = 0
  for (const srx of subrices) s += sumYearList(srx?.years)
  return s
}

/** สร้าง array ของ {condition_id, condition, available} ต่อปี เพื่อโชว์แถวเล็กๆ */
function aggregateConditions(yearNode) {
  const out = []
  for (const c of yearNode?.conditions ?? []) {
    const available = sumFieldList(c?.fields)
    out.push({
      condition_id: c?.condition_id,
      condition: c?.condition,
      available,
    })
  }
  return out
}

/** แปลง StockTreeResponse → โครงสร้างสำหรับ UI (array ของ rice) พร้อม total */
function transformTree(resp) {
  const rices = resp?.product?.rices ?? []
  return rices.map((r) => {
    const subrices = r?.subrices ?? []
    const tRice = sumSubriceList(subrices)

    const uiSub = subrices.map((s) => {
      const years = s?.years ?? []
      const tSub = sumYearList(years)
      const uiYears = years.map((y) => {
        const tYear = sumConditionList(y?.conditions ?? [])
        return {
          year_id: y?.year_id,
          year: y?.year,
          total: tYear,
          // สำหรับ YearRow: list เงื่อนไขที่รวมแล้ว
          items: aggregateConditions(y),
        }
      })
      return {
        subrice_id: s?.subrice_id,
        subrice: s?.subrice,
        total: tSub,
        items: uiYears,
      }
    })

    return {
      rice_id: r?.rice_id,
      rice: r?.rice,
      total: tRice,
      items: uiSub,
    }
  })
}

/** รวม “กิโล” จาก tree หลัง transform */
function sumWeightFromUI(riceArray = []) {
  let total = 0
  for (const r of riceArray) total += Number(r?.total ?? 0)
  return total
}

/** พยายามคำนวณ “มูลค่ารวม” (ตอนนี้ API สต็อกไม่ส่งราคา จึงมักเป็น null) */
function sumValueFromUI(/* riceArray */) {
  return null
}

/** ---------- ComboBox (reusable) ---------- */
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
  const btnRef = useRef(null)

  const selectedLabel = (() => {
    const found = options.find((o) => String(getValue(o)) === String(value))
    return found ? getLabel(found) : ""
  })()

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

/** ---------- Tree Rows (ใช้ field ชื่อใหม่: rice, subrice, year) ---------- */
function RiceRow({ node }) {
  return (
    <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white/70 dark:bg-gray-900/60 shadow-sm">
      <details className="group open:!bg-white dark:open:!bg-gray-900 rounded-xl">
        <summary className="cursor-pointer list-none px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="size-2.5 rounded-full bg-emerald-500/80"></div>
            <div className="font-semibold">
              {node.rice ?? "—"}{" "}
              <span className="text-gray-400 text-sm ml-2">#{node.rice_id ?? "-"}</span>
            </div>
          </div>
          <div className="text-right tabular-nums font-semibold">{nf(node.total)} กก.</div>
        </summary>
        <div className="px-4 pb-3">
          {(node.items || []).map((sub) => (
            <SubriceRow key={`${sub.subrice_id}-${sub.subrice}`} node={sub} />
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
              {node.subrice ?? "—"}{" "}
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
          {nf(node.total ?? 0)} กก.
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
  const [defaultProductId, setDefaultProductId] = useState("") // ต้องส่งให้ /report/stock/tree

  /** selections */
  const [branchId, setBranchId] = useState("")
  const [branchName, setBranchName] = useState("")
  const [klangId, setKlangId] = useState("")
  const [klangName, setKlangName] = useState("")

  /** data */
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")
  const [dataByKlang, setDataByKlang] = useState({}) // { [klangId]: riceArrayUI }
  const [dataSingle, setDataSingle] = useState([])   // riceArrayUI เมื่อเลือกคลังเดียว

  /** load branches + pick default product (อัตโนมัติ) */
  useEffect(() => {
    const loadInitial = async () => {
      try {
        const [branches, products] = await Promise.all([
          apiAuth(`/order/branch/search`),
          apiAuth(`/order/product/search`),
        ])

        setBranchOptions(
          (Array.isArray(branches) ? branches : []).map((x) => ({ id: String(x.id), label: x.branch_name }))
        )

        const list = Array.isArray(products) ? products : []
        let chosen = list.find((x) => (x.product_type || "").includes("ข้าว")) || list[0]
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
      setDataByKlang({})
      setDataSingle([])
      if (!branchId) return
      try {
        const arr = await apiAuth(`/order/klang/search?branch_id=${branchId}`)
        setKlangOptions((Array.isArray(arr) ? arr : []).map((x) => ({ id: String(x.id), label: x.klang_name })))
      } catch (e) {
        console.error("load klang failed:", e)
      }
    }
    loadKlangs()
  }, [branchId])

  /** helper: fetch tree จาก /report/stock/tree แล้ว transform */
  async function fetchTreeOnce({ branchId, klangId, productId }) {
    const params = new URLSearchParams()
    params.set("product_id", String(productId))
    params.set("branch_id", String(branchId))
    if (klangId) params.set("klang_id", String(klangId))
    const json = await apiAuth(`/report/stock/tree?` + params.toString())
    // json เป็น StockTreeResponse (object) → แปลงเป็น array ของ rice สำหรับ UI
    return transformTree(json)
  }

  /** fetch ตามเงื่อนไข:
   * - ถ้าเลือกคลัง -> ดึงแค่คลังเดียว
   * - ถ้าไม่เลือกคลัง -> ดึงทุกคลังของสาขามาแสดง “เห็นชนิดข้าวและกิโลในแต่ละคลัง”
   */
  useEffect(() => {
    const run = async () => {
      setError("")
      setDataByKlang({})
      setDataSingle([])
      if (!branchId || !defaultProductId) return
      setLoading(true)
      try {
        if (klangId) {
          // โหมด “เลือกคลังเดียว”
          const riceArrayUI = await fetchTreeOnce({ branchId, klangId, productId: defaultProductId })
          setDataSingle(riceArrayUI)
        } else {
          // โหมด “แสดงทุกคลังในสาขา”
          const map = {}
          for (const k of klangOptions) {
            try {
              const riceArrayUI = await fetchTreeOnce({ branchId, klangId: k.id, productId: defaultProductId })
              map[k.id] = riceArrayUI
            } catch (e) {
              console.error("fetch klang failed:", k, e)
              map[k.id] = []
            }
          }
          setDataByKlang(map)
        }
      } catch (e) {
        setError(e?.message || "โหลดข้อมูลไม่สำเร็จ")
      } finally {
        setLoading(false)
      }
    }
    run()
  }, [branchId, klangId, defaultProductId, klangOptions])

  /** totals */
  const totalSingle = useMemo(() => {
    const weight = sumWeightFromUI(dataSingle)
    const value = sumValueFromUI(dataSingle)
    return { weight, value }
  }, [dataSingle])

  const totalsByKlang = useMemo(() => {
    const out = {}
    for (const k of klangOptions) {
      const payload = dataByKlang[k.id] || []
      out[k.id] = { weight: sumWeightFromUI(payload), value: sumValueFromUI(payload) }
    }
    return out
  }, [dataByKlang, klangOptions])

  /** ---------- UI ---------- */
  return (
    <div className="p-4 sm:p-6">
      {/* Header */}
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-2xl sm:text-3xl font-bold">
          คลังสินค้า
          <span className="block text-sm font-normal text-gray-500">
            สรุปตาม <span className="font-medium">สาขา</span> และ <span className="font-medium">คลัง</span>
          </span>
        </h1>
        <div className="hidden sm:flex items-center gap-2">
          <Pill>API: /report/stock/tree</Pill>
          <Pill>Method: GET</Pill>
        </div>
      </div>

      {/* Controls */}
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
            {klangId ? (
              <>
                <div className="rounded-2xl border border-gray-200 dark:border-gray-700 bg-white/70 dark:bg-gray-900/60 shadow-sm p-4">
                  <div className="text-sm text-gray-500">ปริมาณรวม (คลังที่เลือก)</div>
                  <div className="text-2xl font-bold mt-1 tabular-nums">{nf(totalSingle.weight)} กก.</div>
                </div>
                <div className="rounded-2xl border border-gray-200 dark:border-gray-700 bg-white/70 dark:bg-gray-900/60 shadow-sm p-4">
                  <div className="text-sm text-gray-500">มูลค่ารวม (คลังที่เลือก)</div>
                  <div className="text-2xl font-bold mt-1 tabular-nums">
                    {totalSingle.value === null ? "—" : thb(totalSingle.value)}
                  </div>
                  {totalSingle.value === null && (
                    <div className="text-xs text-gray-400 mt-1">
                      ไม่พบข้อมูลราคาจาก API (value/price_per_kg)
                    </div>
                  )}
                </div>
              </>
            ) : (
              <div className="rounded-2xl border border-gray-200 dark:border-gray-700 bg-white/70 dark:bg-gray-900/60 shadow-sm p-4">
                <div className="text-sm text-gray-500">เลือกรายการด้านล่างเพื่อดูรวมรายคลัง</div>
                <div className="text-xs text-gray-400 mt-1">ตอนนี้จะแสดงแยก “แต่ละคลัง” ด้านล่าง</div>
              </div>
            )}
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

        {!loading && !branchId && (
          <div className="rounded-2xl border border-gray-200 dark:border-gray-700 bg-white/70 dark:bg-gray-900/60 p-6 text-gray-500">
            กรุณาเลือกสาขา
          </div>
        )}

        {!loading && branchId && klangId && dataSingle.length === 0 && (
          <div className="rounded-2xl border border-gray-200 dark:border-gray-700 bg-white/70 dark:bg-gray-900/60 p-6 text-gray-500">
            ไม่พบข้อมูลสต็อกสำหรับเงื่อนไขปัจจุบัน
          </div>
        )}

        {/* โหมดเลือกคลังเดียว */}
        {!loading && branchId && klangId && dataSingle.length > 0 && (
          <>
            <h2 className="text-lg font-semibold mb-1">คลัง: {klangName || klangId}</h2>
            {dataSingle.map((r) => (
              <RiceRow key={`${r.rice_id}-${r.rice}`} node={r} />
            ))}
          </>
        )}

        {/* โหมดแสดงทุกคลังในสาขา (แบ่งหัวข้อรายคลัง) */}
        {!loading && branchId && !klangId && (
          <>
            {klangOptions.length === 0 && (
              <div className="rounded-2xl border border-gray-200 dark:border-gray-700 bg-white/70 dark:bg-gray-900/60 p-6 text-gray-500">
                สาขานี้ยังไม่มีคลัง
              </div>
            )}
            {klangOptions.map((k) => {
              const payload = dataByKlang[k.id] || []
              const totals = totalsByKlang[k.id] || { weight: 0, value: null }
              return (
                <div key={k.id} className="rounded-2xl border border-gray-200 dark:border-gray-700 bg-white/70 dark:bg-gray-900/60 p-4">
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="text-base sm:text-lg font-semibold">คลัง: {k.label}</h3>
                    <div className="flex gap-3 text-sm">
                      <Pill>รวม: {nf(totals.weight)} กก.</Pill>
                      <Pill>{totals.value === null ? "มูลค่า: —" : `มูลค่า: ${thb(totals.value)}`}</Pill>
                    </div>
                  </div>
                  {payload.length === 0 ? (
                    <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white/60 dark:bg-gray-900/40 p-4 text-gray-500">
                      ไม่มีสต็อกในคลังนี้
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {payload.map((r) => (
                        <RiceRow key={`${k.id}-${r.rice_id}-${r.rice}`} node={r} />
                      ))}
                    </div>
                  )}
                </div>
              )
            })}
          </>
        )}
      </div>
    </div>
  )
}

export default Stock
