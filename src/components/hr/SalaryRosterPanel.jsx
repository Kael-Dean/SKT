// src/components/hr/SalaryRosterPanel.jsx
// รายชื่อทั้งหมด — เจ้าหน้าที่ active ทุกคน + ตำแหน่ง / กระบอก / ขั้น / เงินเดือนปัจจุบัน
// Data: useSalaryRoster (salaryData.js) — GET /hr/salary-roster ครั้งเดียว ได้ครบทุกคน
//       (สาขา/ตำแหน่ง/กระบอก/ขั้น/เงินเดือน รวมชื่อสาขาใน response แล้ว)
// Layout: md+ ตาราง (หัวตาราง sticky ในกรอบเลื่อน) · < md รายการการ์ดซ้อนกัน + ตัวเลือกการเรียง
import { useDeferredValue, useId, useMemo, useState } from "react"
import { ChevronDown, ChevronUp, ChevronsUpDown, RefreshCw, Search, Users } from "lucide-react"
import { cx, neutralBtnCls } from "../../lib/styles"
import SelectDropdown from "../SelectDropdown"
import { EmptyState, ErrorState, Skeleton, SkeletonTableRows } from "../ui"
import usePositions from "./usePositions"
import { useSalaryRoster } from "./salaryData"
import { POSITION_TIERS, cardCls, fmtLevel, linkBtn, thCls, thb, tierName } from "./positionUtils"

const branchLabel = (r) => (r.branchId == null ? "ไม่ระบุสาขา" : r.branchName ?? `สาขา ${r.branchId}`)

// ─── Sorting ────────────────────────────────────────────────────────────────
const collator = new Intl.Collator("th")
const valueOf = {
  name: (r) => r.name,
  tier: (r) => r.tierId,
  level: (r) => r.level,
  salary: (r) => (r.salaryStatus === "ok" ? r.salary : null),
}

function sortRows(rows, { key, dir }) {
  const sign = dir === "desc" ? -1 : 1
  const get = valueOf[key]
  return [...rows].sort((a, b) => {
    const va = get(a)
    const vb = get(b)
    const na = va == null || va === ""
    const nb = vb == null || vb === ""
    if (na !== nb) return na ? 1 : -1 // missing / still loading always last
    const primary = na ? 0 : (key === "name" ? collator.compare(va, vb) : Number(va) - Number(vb)) * sign
    return primary || collator.compare(a.name, b.name)
  })
}

const MOBILE_SORTS = [
  { value: "name:asc", label: "ชื่อ ก–ฮ" },
  { value: "tier:asc", label: "กระบอก ต่ำ → สูง" },
  { value: "level:desc", label: "ขั้น มาก → น้อย" },
  { value: "salary:desc", label: "เงินเดือน มาก → น้อย" },
  { value: "salary:asc", label: "เงินเดือน น้อย → มาก" },
]

const NONE = "__none"
const TIER_FILTER_OPTIONS = [
  { value: "", label: "ทุกกระบอก" },
  ...POSITION_TIERS.map((t) => ({ value: String(t.id), label: t.name })),
  { value: NONE, label: "ยังไม่กำหนดกระบอก" },
]

const searchCls =
  "h-10 w-full rounded-xl border border-gray-300 bg-white pl-9 pr-3 text-sm text-gray-900 placeholder:text-gray-400 " +
  "focus:outline-none focus:ring-2 focus:ring-indigo-500 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100 dark:placeholder:text-gray-500"

// ─── Component ──────────────────────────────────────────────────────────────
export default function SalaryRosterPanel({ onOpenEmployee }) {
  const uid = useId()
  const { byId: positionsById, loading: positionsLoading, error: positionsError, reload: reloadPositions } = usePositions()
  const roster = useSalaryRoster(positionsById)

  const [query, setQuery] = useState("")
  const [branch, setBranch] = useState("")
  const [tier, setTier] = useState("")
  const [sort, setSort] = useState({ key: "name", dir: "asc" })
  const deferredQuery = useDeferredValue(query)

  const branchOptions = useMemo(() => {
    const labels = new Map()
    let hasNone = false
    for (const r of roster.rows) {
      if (r.branchId == null) hasNone = true
      else if (!labels.has(String(r.branchId))) labels.set(String(r.branchId), branchLabel(r))
    }
    const opts = [...labels]
      .map(([value, label]) => ({ value, label }))
      .sort((a, b) => collator.compare(a.label, b.label))
    return [{ value: "", label: "ทุกสาขา" }, ...opts, ...(hasNone ? [{ value: NONE, label: "ไม่ระบุสาขา" }] : [])]
  }, [roster.rows])

  const filtered = useMemo(() => {
    const q = deferredQuery.trim().toLowerCase()
    const list = roster.rows.filter((r) => {
      if (branch && (branch === NONE ? r.branchId != null : String(r.branchId) !== branch)) return false
      if (tier && (tier === NONE ? r.tierId != null : String(r.tierId) !== tier)) return false
      if (!q) return true
      return `${r.name} ${r.id} ${r.position?.title ?? ""}`.toLowerCase().includes(q)
    })
    return sortRows(list, sort)
  }, [roster.rows, deferredQuery, branch, tier, sort])

  // summary over the filtered rows that already have a salary
  const summary = useMemo(() => {
    let sum = 0
    let paid = 0
    for (const r of filtered) {
      if (r.salaryStatus === "ok") { sum += r.salary; paid++ }
    }
    return { count: filtered.length, sum, paid, missing: filtered.length - paid, avg: paid ? sum / paid : null }
  }, [filtered])

  const hasFilters = !!query || !!branch || !!tier
  const clearFilters = () => { setQuery(""); setBranch(""); setTier("") }

  const toggleSort = (key) =>
    setSort((s) => (s.key === key ? { key, dir: s.dir === "asc" ? "desc" : "asc" } : { key, dir: key === "name" || key === "tier" ? "asc" : "desc" }))

  const refreshAll = () => {
    roster.refresh()
    reloadPositions()
  }

  const firstLoad = roster.peopleStatus === "loading"
  const busy = firstLoad || roster.refreshing || positionsLoading

  if (roster.peopleStatus === "error") {
    return <ErrorState message={roster.peopleError || "โหลดรายชื่อเจ้าหน้าที่ไม่สำเร็จ"} onRetry={roster.retryPeople} />
  }

  const COLS = 7
  const searchId = `${uid}-q`

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className={cx(cardCls, "flex flex-col gap-3 p-4 sm:flex-row sm:flex-wrap sm:items-center")}>
        <div className="relative min-w-0 sm:flex-1 sm:min-w-[14rem]">
          <label htmlFor={searchId} className="sr-only">ค้นหาเจ้าหน้าที่</label>
          <Search aria-hidden="true" className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-gray-400 dark:text-gray-500" strokeWidth={1.75} />
          <input
            id={searchId}
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="ค้นหาชื่อ รหัส หรือตำแหน่ง"
            className={searchCls}
            autoComplete="off"
          />
        </div>
        <div className="grid grid-cols-2 gap-3 sm:contents">
          <div className="min-w-0 sm:w-44">
            <SelectDropdown value={branch} onChange={setBranch} options={branchOptions} placeholder="ทุกสาขา" ariaLabel="กรองตามสาขา" showSwatch={false} searchable={branchOptions.length > 8} />
          </div>
          <div className="min-w-0 sm:w-60">
            <SelectDropdown value={tier} onChange={setTier} options={TIER_FILTER_OPTIONS} placeholder="ทุกกระบอก" ariaLabel="กรองตามกระบอก" showSwatch={false} />
          </div>
        </div>
        <button type="button" onClick={refreshAll} disabled={roster.refreshing} className={cx(neutralBtnCls, "sm:ml-auto")}>
          <RefreshCw aria-hidden="true" className={cx("size-4", busy && "motion-safe:animate-spin")} strokeWidth={1.75} />
          รีเฟรช
        </button>
      </div>

      {positionsError && <ErrorState message={positionsError} onRetry={reloadPositions} />}
      {roster.peopleError && roster.peopleStatus === "ok" && (
        <ErrorState message={`${roster.peopleError} — แสดงรายชื่อชุดเดิมอยู่`} onRetry={roster.retryPeople} />
      )}

      {/* Summary strip */}
      <dl className={cx(cardCls, "grid grid-cols-1 divide-y divide-gray-100 sm:grid-cols-3 sm:divide-x sm:divide-y-0 dark:divide-gray-700")}>
        <SummaryItem label={hasFilters ? "จำนวนคน (ตามตัวกรอง)" : "จำนวนคน"} loading={firstLoad}>
          {summary.count.toLocaleString("th-TH")} <Unit>คน</Unit>
        </SummaryItem>
        <SummaryItem label="เงินเดือนรวม/เดือน" loading={firstLoad}>
          {summary.paid ? <>{thb(summary.sum)} <Unit>บาท</Unit></> : "—"}
        </SummaryItem>
        <SummaryItem label="เฉลี่ยต่อคน" loading={firstLoad}>
          {summary.avg != null ? <>{thb(summary.avg)} <Unit>บาท</Unit></> : "—"}
        </SummaryItem>
      </dl>
      {!firstLoad && summary.missing > 0 && (
        <p className="-mt-2 px-1 text-xs text-gray-500 dark:text-gray-400">
          ไม่รวม {summary.missing.toLocaleString("th-TH")} คนที่ยังไม่มีข้อมูลเงินเดือน
        </p>
      )}

      {/* List */}
      <div className={cx(cardCls, "overflow-hidden")}>
        <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 border-b border-gray-100 px-4 py-3 dark:border-gray-700">
          <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">
            เจ้าหน้าที่ที่ใช้งานอยู่
            {!firstLoad && (
              <span className="ml-2 text-xs font-normal tabular-nums text-gray-500 dark:text-gray-400">
                {hasFilters
                  ? `แสดง ${filtered.length.toLocaleString("th-TH")} จาก ${roster.total.toLocaleString("th-TH")} คน`
                  : `${roster.total.toLocaleString("th-TH")} คน`}
              </span>
            )}
          </h3>
          <div className="flex items-center gap-3">
            <div className="w-48 md:hidden">
              <SelectDropdown
                value={`${sort.key}:${sort.dir}`}
                onChange={(v) => { const [key, dir] = v.split(":"); setSort({ key, dir }) }}
                options={MOBILE_SORTS.some((o) => o.value === `${sort.key}:${sort.dir}`) ? MOBILE_SORTS : [...MOBILE_SORTS, { value: `${sort.key}:${sort.dir}`, label: "กำหนดเอง" }]}
                ariaLabel="เรียงลำดับ"
                showSwatch={false}
              />
            </div>
          </div>
          <p role="status" className="sr-only">
            {firstLoad ? "กำลังโหลดรายชื่อ" : roster.refreshing ? "กำลังรีเฟรชข้อมูลเงินเดือน" : `โหลดข้อมูลเงินเดือนครบ ${roster.total} คน`}
          </p>
        </div>

        {!firstLoad && filtered.length === 0 ? (
          <EmptyState
            icon={<Users aria-hidden="true" className="size-10" strokeWidth={1.5} />}
            title={hasFilters ? "ไม่พบเจ้าหน้าที่ที่ตรงกับตัวกรอง" : "ยังไม่มีเจ้าหน้าที่ที่ใช้งานอยู่"}
            description={hasFilters ? "ลองค้นด้วยคำอื่น หรือล้างตัวกรองเพื่อดูทั้งหมด" : "เมื่อลงทะเบียนเจ้าหน้าที่ที่แท็บเจ้าหน้าที่ รายชื่อจะแสดงที่นี่"}
            action={hasFilters ? (
              <button type="button" onClick={clearFilters} className={neutralBtnCls}>ล้างตัวกรอง</button>
            ) : null}
          />
        ) : (
          <>
            {/* md+: table */}
            <div className="hidden max-h-[70vh] overflow-auto md:block">
              <table className="w-full text-sm">
                <caption className="sr-only">รายชื่อเจ้าหน้าที่พร้อมขั้นและเงินเดือนปัจจุบัน</caption>
                <thead className="sticky top-0 z-[1] bg-gray-50 shadow-[0_1px_0_0] shadow-gray-100 dark:bg-gray-900 dark:shadow-gray-700">
                  <tr>
                    <SortTh label="ชื่อ-นามสกุล" col="name" sort={sort} onSort={toggleSort} />
                    <th scope="col" className={cx(thCls, "hidden text-left lg:table-cell")}>สาขา</th>
                    <th scope="col" className={cx(thCls, "text-left")}>ตำแหน่ง</th>
                    <SortTh label="กระบอก" col="tier" sort={sort} onSort={toggleSort} />
                    <SortTh label="ขั้น" col="level" sort={sort} onSort={toggleSort} align="right" />
                    <SortTh label="เงินเดือน (บาท)" col="salary" sort={sort} onSort={toggleSort} align="right" />
                    <th scope="col" className={cx(thCls, "text-right")}><span className="sr-only">การทำงาน</span></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-gray-700/50">
                  {firstLoad ? (
                    <SkeletonTableRows rows={8} cols={COLS} />
                  ) : filtered.map((r) => (
                    <tr key={r.id} className="transition-colors hover:bg-gray-50 dark:hover:bg-gray-700/30">
                      <td className="px-4 py-2.5">
                        <div className="flex items-center gap-2.5">
                          <Avatar name={r.name} />
                          <div className="min-w-0">
                            <p className="truncate font-semibold text-gray-900 dark:text-gray-100">{r.name}</p>
                            <p className="truncate text-xs tabular-nums text-gray-500 dark:text-gray-400">
                              รหัส {r.id}<span className="lg:hidden"> · {branchLabel(r)}</span>
                            </p>
                          </div>
                        </div>
                      </td>
                      <td className="hidden whitespace-nowrap px-4 py-2.5 text-gray-600 lg:table-cell dark:text-gray-300">{branchLabel(r)}</td>
                      <td className="px-4 py-2.5 text-gray-700 dark:text-gray-300">
                        <PositionText row={r} loading={positionsLoading} />
                      </td>
                      <td className="px-4 py-2.5 text-gray-700 dark:text-gray-300">
                        <TierText row={r} loading={positionsLoading} />
                      </td>
                      <td className="px-4 py-2.5 text-right tabular-nums text-gray-900 dark:text-gray-100">
                        <LevelText row={r} />
                      </td>
                      <td className="px-4 py-2.5 text-right font-semibold tabular-nums text-gray-900 dark:text-gray-100">
                        <SalaryText row={r} />
                      </td>
                      <td className="px-4 py-2.5 text-right whitespace-nowrap">
                        <RowActions row={r} onOpenEmployee={onOpenEmployee} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* < md: stacked cards */}
            <ul className="divide-y divide-gray-100 md:hidden dark:divide-gray-700/60">
              {firstLoad
                ? Array.from({ length: 5 }).map((_, i) => (
                    <li key={i} className="space-y-2 px-4 py-3" aria-hidden="true">
                      <Skeleton rounded="rounded-md" className="h-4 w-2/3" />
                      <Skeleton rounded="rounded-md" className="h-3 w-1/2" />
                    </li>
                  ))
                : filtered.map((r) => (
                    <li key={r.id} className="px-4 py-3">
                      <div className="flex items-start gap-3">
                        <Avatar name={r.name} />
                        <div className="min-w-0 flex-1">
                          <p className="font-semibold text-gray-900 dark:text-gray-100">{r.name}</p>
                          <p className="text-xs tabular-nums text-gray-500 dark:text-gray-400">รหัส {r.id} · {branchLabel(r)}</p>
                          <p className="mt-1 text-sm text-gray-700 dark:text-gray-300">
                            <PositionText row={r} loading={positionsLoading} />
                          </p>
                          <p className="text-xs text-gray-500 dark:text-gray-400">
                            <TierText row={r} loading={positionsLoading} />
                          </p>
                        </div>
                      </div>
                      <dl className="mt-2.5 grid grid-cols-2 gap-3 pl-[2.625rem] text-sm">
                        <div>
                          <dt className="text-xs text-gray-500 dark:text-gray-400">ขั้น</dt>
                          <dd className="tabular-nums text-gray-900 dark:text-gray-100"><LevelText row={r} /></dd>
                        </div>
                        <div>
                          <dt className="text-xs text-gray-500 dark:text-gray-400">เงินเดือน (บาท)</dt>
                          <dd className="font-semibold tabular-nums text-gray-900 dark:text-gray-100"><SalaryText row={r} /></dd>
                        </div>
                      </dl>
                      <div className="mt-2 flex gap-4 pl-[2.625rem]">
                        <RowActions row={r} onOpenEmployee={onOpenEmployee} />
                      </div>
                    </li>
                  ))}
            </ul>
          </>
        )}
      </div>
    </div>
  )
}

// ─── Pieces ─────────────────────────────────────────────────────────────────

function Unit({ children }) {
  return <span className="text-sm font-normal text-gray-500 dark:text-gray-400">{children}</span>
}

function SummaryItem({ label, loading, children }) {
  return (
    <div className="px-5 py-3.5">
      <dt className="text-xs font-medium text-gray-500 dark:text-gray-400">{label}</dt>
      <dd className="mt-0.5 text-lg font-semibold tabular-nums text-gray-900 dark:text-gray-100">
        {loading ? <Skeleton rounded="rounded-md" className="mt-1 h-6 w-32" /> : children}
      </dd>
    </div>
  )
}

function SortTh({ label, col, sort, onSort, align = "left" }) {
  const active = sort.key === col
  const Icon = !active ? ChevronsUpDown : sort.dir === "asc" ? ChevronUp : ChevronDown
  return (
    <th
      scope="col"
      aria-sort={active ? (sort.dir === "asc" ? "ascending" : "descending") : undefined}
      className={cx(thCls, "whitespace-nowrap", align === "right" ? "text-right" : "text-left")}
    >
      <button
        type="button"
        onClick={() => onSort(col)}
        className={cx(
          "-mx-1 inline-flex items-center gap-1 rounded px-1 cursor-pointer transition-colors duration-150",
          "hover:text-gray-900 dark:hover:text-gray-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500",
          active && "text-gray-900 dark:text-gray-100",
          align === "right" && "flex-row-reverse",
        )}
      >
        {label}
        <Icon aria-hidden="true" className={cx("size-3.5", active ? "text-indigo-600 dark:text-indigo-400" : "text-gray-400 dark:text-gray-500")} strokeWidth={2} />
      </button>
    </th>
  )
}

function Avatar({ name }) {
  return (
    <div aria-hidden="true" className="flex size-8 shrink-0 items-center justify-center rounded-xl bg-indigo-100 text-xs font-bold text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-300">
      {name?.trim()?.[0] ?? "?"}
    </div>
  )
}

const Muted = ({ children }) => <span className="text-gray-400 dark:text-gray-500">{children}</span>

function PositionText({ row, loading }) {
  if (row.positionId == null) return <Muted>ยังไม่มีตำแหน่ง</Muted>
  if (row.position) return row.position.title ?? `ตำแหน่ง ${row.positionId}`
  return loading ? <Skeleton rounded="rounded-md" className="inline-block h-3.5 w-24 align-middle" /> : `ตำแหน่ง ${row.positionId}`
}

function TierText({ row, loading }) {
  if (row.positionId == null) return <Muted>—</Muted>
  if (loading && !row.position) return <Skeleton rounded="rounded-md" className="inline-block h-3.5 w-20 align-middle" />
  return row.tierId != null ? tierName(row.tierId) : <Muted>ยังไม่กำหนดกระบอก</Muted>
}

function LevelText({ row }) {
  return row.level != null ? fmtLevel(row.level) : <Muted>—</Muted> // level 0 is real → fmtLevel
}

function SalaryText({ row }) {
  if (row.salaryStatus === "ok") {
    return row.salarySource === "financial" ? (
      <span title="จากข้อมูลการเงินของเจ้าหน้าที่ (ไม่พบในบัญชีเงินเดือน)">{thb(row.salary)}</span>
    ) : thb(row.salary)
  }
  const why = "ไม่มีข้อมูลเงินเดือน"
  return <span title={why}><Muted>—</Muted><span className="sr-only">{why}</span></span>
}

function RowActions({ row, onOpenEmployee }) {
  if (!onOpenEmployee) return null
  return (
    <span className="inline-flex gap-4">
      <button type="button" onClick={() => onOpenEmployee("step", row.id)} className={linkBtn} aria-label={`เลื่อนขั้น ${row.name}`}>
        เลื่อนขั้น
      </button>
      <button type="button" onClick={() => onOpenEmployee("history", row.id)} className={linkBtn} aria-label={`ประวัติ ${row.name}`}>
        ประวัติ
      </button>
    </span>
  )
}
