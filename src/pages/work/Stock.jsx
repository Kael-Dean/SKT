// src/pages/Stock.jsx
import { useEffect, useMemo, useRef, useState } from "react"
import { ChevronDown } from "lucide-react"
import { apiAuth } from "../../lib/api" // ← รวม base URL + token + JSON ให้แล้ว
import { cx, cardCls, secondaryBtnCls } from "../../lib/styles"
import Skeleton from "../../components/ui/Skeleton"
import { ErrorState, EmptyState } from "../../components/ui"
import ComboBox from "../../components/ComboBox"
import { useIsPhone } from "../../hooks/useMediaQuery"

/** option value ของหน้านี้ = id ก่อน value (คง default ของ ComboBox copy เดิม) */
const getOptValue = (o) => o?.id ?? o?.value ?? ""

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

/** ---------- UI Bits ---------- */
function Pill({ children }) {
  return (
    <span className="inline-flex items-center rounded-full bg-emerald-50 dark:bg-emerald-900/30 px-3 py-1 text-xs font-medium text-emerald-700 dark:text-emerald-200 ring-1 ring-emerald-200/70 dark:ring-emerald-800/60">
      {children}
    </span>
  )
}

/** Skeleton ที่จำลองหน้าตา RiceRow (ชื่อชนิดข้าว + ยอดกิโล) ขณะโหลด */
function StockTreeSkeleton({ rows = 4 }) {
  return (
    <div className="space-y-3" role="status" aria-busy="true" aria-live="polite">
      <span className="sr-only">กำลังโหลดคลังสินค้า…</span>
      {Array.from({ length: rows }).map((_, i) => (
        <div
          key={i}
          aria-hidden="true"
          className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white/70 dark:bg-gray-900/60 shadow-sm px-4 py-3 flex items-center justify-between gap-4"
        >
          <div className="flex items-center gap-3 min-w-0 flex-1">
            <span className="size-2.5 shrink-0 rounded-full bg-slate-200 dark:bg-slate-700" />
            <Skeleton rounded="rounded-md" className={cx("h-4", i % 2 === 0 ? "w-2/5" : "w-1/3")} />
          </div>
          <Skeleton rounded="rounded-md" className="h-4 w-24 shrink-0" />
        </div>
      ))}
    </div>
  )
}

/** ลูกศรของ <details> — หมุนเมื่อเปิด (ใช้ class `group` บน details) */
// ใช้ named group (group/rice, group/sub, group/klang) — details ซ้อนกัน 3 ชั้น
// ถ้าใช้ group-open เฉย ๆ ลูกศรชั้นในจะหมุนตามชั้นนอก
const CHEVRON_OPEN = {
  klang: "group-open/klang:rotate-180",
  rice: "group-open/rice:rotate-180",
  sub: "group-open/sub:rotate-180",
}
function Chevron({ group, className = "" }) {
  return (
    <ChevronDown
      aria-hidden="true"
      strokeWidth={1.75}
      className={cx(
        "shrink-0 text-gray-400 dark:text-gray-500 transition-transform duration-200 motion-reduce:transition-none",
        CHEVRON_OPEN[group],
        className
      )}
    />
  )
}

/** ---------- Tree Rows (ใช้ field ชื่อใหม่: rice, subrice, year) ---------- */
function RiceRow({ node }) {
  return (
    <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white/70 dark:bg-gray-900/60 shadow-sm">
      <details className="group/rice open:!bg-white dark:open:!bg-gray-900 rounded-xl">
        <summary className="cursor-pointer list-none min-h-touch px-4 py-3 flex items-center justify-between gap-3 [&::-webkit-details-marker]:hidden">
          <div className="flex items-center gap-3 min-w-0">
            <div className="size-2.5 shrink-0 rounded-full bg-emerald-500/80"></div>
            <div className="font-semibold leading-snug text-gray-900 dark:text-gray-100">
              {node.rice ?? "—"}{" "}
              <span className="text-gray-400 dark:text-gray-500 text-sm ml-2">#{node.rice_id ?? "-"}</span>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <div className="text-right tabular-nums font-semibold text-gray-900 dark:text-gray-100">{nf(node.total)} กก.</div>
            <Chevron group="rice" className="size-5" />
          </div>
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
      <details className="group/sub open:!bg-white/70 dark:open:!bg-gray-900/60 rounded-lg">
        <summary className="cursor-pointer list-none min-h-touch px-3 py-2 flex items-center justify-between gap-3 [&::-webkit-details-marker]:hidden">
          <div className="flex items-center gap-2 min-w-0">
            <div className="size-2 shrink-0 rounded-full bg-teal-400/80"></div>
            <div className="font-medium leading-snug text-gray-900 dark:text-gray-100">
              {node.subrice ?? "—"}{" "}
              <span className="text-gray-400 dark:text-gray-500 text-xs ml-2">#{node.subrice_id ?? "-"}</span>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <div className="text-right tabular-nums text-gray-900 dark:text-gray-100">{nf(node.total)} กก.</div>
            <Chevron group="sub" className="size-4" />
          </div>
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
      <div className="px-3 py-2 flex items-center justify-between gap-3">
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
                className="rounded-md border border-gray-100 dark:border-gray-800 px-3 py-2 flex items-center justify-between gap-3"
              >
                <div className="text-xs text-gray-600 dark:text-gray-300 min-w-0">
                  {c.condition ?? "—"}{" "}
                  <span className="text-gray-400 dark:text-gray-500">#{c.condition_id ?? "-"}</span>
                </div>
                <div className="tabular-nums text-sm font-medium shrink-0">{nf(c.available)} กก.</div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

/** การ์ด "คลัง" ในโหมดดูทั้งสาขา — บนมือถือหุบได้ (UI-SPEC §6.6), ≥md เปิดค้างแบบเดิม */
function KlangSection({ klang, payload, totals, isPhone }) {
  const pills = (
    <div className="flex flex-wrap gap-2 text-sm">
      <Pill>รวม: {nf(totals.weight)} กก.</Pill>
      <Pill>{totals.value === null ? "มูลค่า: —" : `มูลค่า: ${thb(totals.value)}`}</Pill>
    </div>
  )
  const body =
    payload.length === 0 ? (
      <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white/60 dark:bg-gray-900/40 p-4">
        <p className="text-sm font-medium text-gray-700 dark:text-gray-200">คลังนี้ยังไม่มีสต็อก</p>
        <p className="mt-0.5 text-sm text-gray-500 dark:text-gray-400">รายการจะปรากฏเมื่อมีซื้อข้าว รับเข้า หรือยกมาเข้าคลังนี้</p>
      </div>
    ) : (
      <div className="space-y-3">
        {payload.map((r) => (
          <RiceRow key={`${klang.id}-${r.rice_id}-${r.rice}`} node={r} />
        ))}
      </div>
    )

  if (isPhone) {
    return (
      <details className={cx(cardCls, "group/klang")}>
        <summary className="cursor-pointer list-none min-h-touch px-4 py-3 flex items-start justify-between gap-3 [&::-webkit-details-marker]:hidden">
          <div className="min-w-0 flex-1">
            <h3 className="text-base font-semibold leading-snug text-gray-900 dark:text-gray-100">คลัง: {klang.label}</h3>
            <div className="mt-1.5">{pills}</div>
          </div>
          <Chevron group="klang" className="size-5 mt-1" />
        </summary>
        <div className="px-4 pb-4">{body}</div>
      </details>
    )
  }

  return (
    <div className="rounded-2xl border border-gray-200 dark:border-gray-700 bg-white/70 dark:bg-gray-900/60 p-4">
      <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
        <h3 className="text-base sm:text-lg font-semibold">คลัง: {klang.label}</h3>
        {pills}
      </div>
      {body}
    </div>
  )
}

/** ---------- Main Page ---------- */
const Stock = () => {
  const isPhone = useIsPhone()
  const branchBoxRef = useRef(null)

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
  const [reloadKey, setReloadKey] = useState(0) // bump เพื่อ retry การโหลด tree
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
  }, [branchId, klangId, defaultProductId, klangOptions, reloadKey])

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

  const statTileCls =
    "rounded-2xl border border-gray-200 dark:border-gray-700 bg-white/70 dark:bg-gray-900/60 shadow-sm p-4 min-w-0"

  /** ---------- UI ---------- */
  return (
    <div className="p-4 sm:p-6">
      {/* Header */}
      <div className="mb-4 flex items-center justify-between gap-3">
        <h1 className="text-xl md:text-3xl font-bold text-gray-900 dark:text-gray-100">
          คลังสินค้า
          <span className="block text-sm font-normal text-gray-500 dark:text-gray-400">
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
                <label htmlFor="stock-branch" className="block text-sm text-gray-600 dark:text-gray-300 mb-1">สาขา</label>
                <ComboBox
                  ref={branchBoxRef}
                  id="stock-branch"
                  title="สาขา"
                  ariaLabel="สาขา"
                  options={branchOptions}
                  value={branchId}
                  getValue={getOptValue}
                  onChange={(id, found) => {
                    setBranchId(id || "")
                    setBranchName(found?.label ?? "")
                  }}
                  placeholder="— เลือกสาขา —"
                />
              </div>
              <div>
                <label htmlFor="stock-klang" className="block text-sm text-gray-600 dark:text-gray-300 mb-1">คลัง (ทางเลือก)</label>
                <ComboBox
                  id="stock-klang"
                  title="คลัง"
                  ariaLabel="คลัง (ทางเลือก)"
                  options={klangOptions}
                  value={klangId}
                  getValue={getOptValue}
                  onChange={(id, found) => {
                    setKlangId(id || "")
                    setKlangName(found?.label ?? "")
                  }}
                  placeholder="— เลือกคลัง —"
                  disabled={!branchId}
                />
                {!branchId && <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">เลือกสาขาก่อน</p>}
              </div>
              {(branchId || klangId) && (
                <div className="flex items-end">
                  <div className="flex flex-wrap gap-2">
                    {branchId && <Pill>สาขา: {branchName || branchId}</Pill>}
                    {klangId && <Pill>คลัง: {klangName || klangId}</Pill>}
                  </div>
                </div>
              )}
            </div>

            {/* Error */}
            {error && (
              <ErrorState
                className="mt-3"
                message={error}
                onRetry={() => setReloadKey((k) => k + 1)}
              />
            )}
          </div>
        </div>

        {/* Summary */}
        <div className="lg:col-span-3">
          <div className="grid grid-cols-2 lg:grid-cols-1 gap-3">
            {klangId ? (
              <>
                <div className={statTileCls}>
                  <div className="text-sm text-gray-500 dark:text-gray-400">ปริมาณรวม (คลังที่เลือก)</div>
                  <div className="text-xl md:text-2xl font-bold mt-1 tabular-nums text-gray-900 dark:text-gray-100">{nf(totalSingle.weight)} กก.</div>
                </div>
                <div className={statTileCls}>
                  <div className="text-sm text-gray-500 dark:text-gray-400">มูลค่ารวม (คลังที่เลือก)</div>
                  <div className="text-xl md:text-2xl font-bold mt-1 tabular-nums text-gray-900 dark:text-gray-100">
                    {totalSingle.value === null ? "—" : thb(totalSingle.value)}
                  </div>
                  {totalSingle.value === null && (
                    <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                      ไม่พบข้อมูลราคาจาก API (value/price_per_kg)
                    </div>
                  )}
                </div>
              </>
            ) : (
              <div className={cx(statTileCls, "col-span-2 lg:col-span-1")}>
                <div className="text-sm text-gray-500 dark:text-gray-400">เลือกรายการด้านล่างเพื่อดูรวมรายคลัง</div>
                <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">ตอนนี้จะแสดงแยก “แต่ละคลัง” ด้านล่าง</div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Data */}
      <div className="space-y-3">
        {loading && <StockTreeSkeleton rows={4} />}

        {!loading && !branchId && (
          <div className="rounded-2xl border border-gray-200 dark:border-gray-700 bg-white/70 dark:bg-gray-900/60">
            <EmptyState
              title="เลือกสาขาเพื่อดูคลัง"
              description="สต็อกจะแสดงแยกตามคลังของสาขาที่เลือก"
              action={
                <button
                  type="button"
                  className={cx(secondaryBtnCls, "h-11 !py-0")}
                  onClick={() => branchBoxRef.current?.open?.()}
                >
                  เลือกสาขา
                </button>
              }
              icon={
                <svg
                  aria-hidden="true"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="size-12"
                >
                  <path d="M3 9 12 4l9 5v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2Z" />
                  <path d="M9 21v-6h6v6" />
                </svg>
              }
            />
          </div>
        )}

        {!loading && branchId && klangId && dataSingle.length === 0 && (
          <div className="rounded-2xl border border-gray-200 dark:border-gray-700 bg-white/70 dark:bg-gray-900/60">
            <EmptyState
              title="ไม่พบสต็อกตามเงื่อนไข"
              description="ลองเลือกคลังอื่นหรือดูทั้งสาขา"
              action={
                <button
                  type="button"
                  className={cx(secondaryBtnCls, "h-11 !py-0")}
                  onClick={() => { setKlangId(""); setKlangName("") }}
                >
                  ดูทั้งสาขา
                </button>
              }
            />
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
              <div className="rounded-2xl border border-gray-200 dark:border-gray-700 bg-white/70 dark:bg-gray-900/60">
                <EmptyState
                  title="สาขานี้ยังไม่มีคลัง"
                  description="เพิ่มคลังได้ที่หน้าแก้ไขข้อมูลธุรกิจ"
                />
              </div>
            )}
            {klangOptions.map((k) => (
              <KlangSection
                key={k.id}
                klang={k}
                payload={dataByKlang[k.id] || []}
                totals={totalsByKlang[k.id] || { weight: 0, value: null }}
                isPhone={isPhone}
              />
            ))}
          </>
        )}
      </div>
    </div>
  )
}

export default Stock
