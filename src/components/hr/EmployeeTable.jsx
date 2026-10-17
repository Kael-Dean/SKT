// src/components/hr/EmployeeTable.jsx
// ─────────────────────────────────────────────────────────────────────────────
// ตารางรายชื่อเจ้าหน้าที่ — ใช้ร่วม /hr/users (HRUserList) และแท็บเจ้าหน้าที่ใน /hr/dashboard
//
//   <EmployeeTable rows={personnel} branches={branchOptions} loading={loading}
//     onRowClick={(r) => navigate(`/hr/personnel/${r.id}`)}
//     emptyState={<EmptyState … />}
//     serverFiltersActive={hasActiveFilters} onClearServerFilters={clearFilters} />
//
// • หน้าเป็นเจ้าของ fetch + ตัวกรองฝั่ง server (ชื่อ / สาขา / สถานะ); ตารางนี้ enrich แถว
//   (useEmployeeRows) แล้ว sort / filter รายคอลัมน์ฝั่ง client (endpoint ไม่มี paging)
// • หัวคอลัมน์ = ปุ่มเปิด popover เรียง/กรอง (ColumnHeaderMenu, portal z 10050)
// • scroll container เดียว: หัวตาราง sticky top, รหัส + ชื่อ sticky left (มุมซ้ายบน z สูงสุด)
// • คอลัมน์ optional (ข้อมูลจาก /hr/employees/export หรือ field ที่ BE ยังไม่ส่ง) ซ่อนเองถ้าไม่มีแถวใดมีค่า
// • ปุ่ม "คอลัมน์" เลือกแสดง/ซ่อน จำใน localStorage
// • < md: การ์ด DataList + ตัวเลือกการเรียง + Sheet ตัวกรองชุดเดียวกัน
// ─────────────────────────────────────────────────────────────────────────────
import { useCallback, useEffect, useId, useMemo, useRef, useState } from "react"
import { createPortal } from "react-dom"
import { ChevronDown, ChevronUp, ChevronsUpDown, Columns3, SlidersHorizontal, Users, X } from "lucide-react"
import { badgeCls, cardCls, cx, focusRingCls, neutralBtnCls, primaryBtnCls } from "../../lib/styles"
import { sortRows, thaiCollator } from "../../lib/tableSort"
import useAnchoredPanel from "../../lib/useAnchoredPanel"
import useFocusTrap from "../../lib/useFocusTrap"
import { roleBadgeTone } from "../../lib/roles"
import { useIsPhone } from "../../hooks/useMediaQuery"
import { Badge, DataList, EmptyState, Sheet, Skeleton, SkeletonTableRows } from "../ui"
import SelectDropdown from "../SelectDropdown"
import ColumnHeaderMenu, { ColumnFilterControl } from "./ColumnHeaderMenu"
import { enumOptions, filterSummary, isFilterActive, matchFilter, sortLabels } from "./columnFilters"
import { fmtDate, fmtLevel } from "./positionUtils"
import useEmployeeRows from "./useEmployeeRows"

const has = (v) => v != null && v !== ""
const PANEL_Z = 10050
const STORAGE_KEY = "skt.hr.employeeTable.hiddenColumns.v1"

// ─── Cell renderers ─────────────────────────────────────────────────────────
const Muted = ({ children = "—" }) => <span className="text-gray-400 dark:text-gray-500">{children}</span>

function fmtTenure(years) {
  if (years == null) return null
  const total = Math.round(years * 12)
  const y = Math.floor(total / 12)
  const m = total % 12
  if (!y && !m) return "ไม่ถึง 1 เดือน"
  return [y ? `${y} ปี` : "", m ? `${m} เดือน` : ""].filter(Boolean).join(" ")
}

const ACCOUNT_TONE = { new: "pending", registered: "info" }

// ─── Column config ──────────────────────────────────────────────────────────
// type: text | enum | number | date · get(row) = ค่าที่ใช้กรอง/เรียง (enum = ป้ายที่แสดง)
// optional = ซ่อนอัตโนมัติถ้าไม่มีแถวใดมีค่า · always = ซ่อนไม่ได้ · defaultHidden = ปิดไว้ก่อน
const COLUMNS = [
  {
    key: "id", label: "รหัส", type: "number", get: (r) => r.id, align: "right", always: true, sticky: "first",
    render: (r) => <span className="tabular-nums text-gray-600 dark:text-gray-300">{r.id}</span>,
  },
  { key: "name", label: "ชื่อ-นามสกุล", type: "text", get: (r) => r.full_name, always: true, sticky: "second" },
  { key: "legacy_user_id", label: "รหัสเดิม", type: "text", get: (r) => r.legacy_user_id, optional: true },
  {
    key: "position", label: "ตำแหน่ง", type: "enum", get: (r) => r.position_title, minW: "min-w-[11rem]",
    render: (r, ctx) =>
      r.position_title ?? (r.position != null && ctx.positionsLoading
        ? <Skeleton rounded="rounded-md" className="inline-block h-3.5 w-24 align-middle" />
        : <Muted />),
  },
  {
    key: "tier", label: "ระดับ", type: "enum", get: (r) => r.tier_name, optional: true,
    sortGet: (r) => (has(r.position_tier_id) ? Number(r.position_tier_id) : null), sortNumeric: true,
    enumOrder: (r) => Number(r.position_tier_id), sortLabels: { asc: "ต่ำ → สูง", desc: "สูง → ต่ำ" },
  },
  { key: "branch", label: "สาขา", type: "enum", get: (r) => r.branch_name },
  { key: "sub_unit", label: "แผนก", type: "enum", get: (r) => r.sub_unit, optional: true },
  {
    key: "role", label: "Role", type: "enum", get: (r) => r.role_label,
    render: (r) => (r.role_label ? <span className={cx(badgeCls, roleBadgeTone(r.role_id))}>{r.role_label}</span> : <Muted />),
  },
  { key: "employment_type", label: "ประเภทการจ้าง", type: "enum", get: (r) => r.employment_type_label, optional: true },
  { key: "hire_date", label: "วันเริ่มงาน", type: "date", get: (r) => r.hire_date, optional: true, render: (r) => fmtDate(r.hire_date) },
  {
    key: "tenure", label: "อายุงาน", type: "number", unit: "ปี", get: (r) => r.tenure_years, align: "right", optional: true,
    render: (r) => fmtTenure(r.tenure_years), fmtNumber: (n) => Number(n).toLocaleString("th-TH", { maximumFractionDigits: 1 }),
  },
  {
    key: "salary_level", label: "ขั้นเงินเดือน", type: "number", get: (r) => r.salary_level, align: "right", optional: true,
    render: (r) => fmtLevel(r.salary_level), fmtNumber: fmtLevel,
  },
  { key: "p_number", label: "เบอร์โทร", type: "text", get: (r) => r.p_number, optional: true },
  { key: "email", label: "อีเมล", type: "text", get: (r) => r.email, optional: true, defaultHidden: true },
  { key: "gender", label: "เพศ", type: "enum", get: (r) => r.gender_label, optional: true, defaultHidden: true },
  { key: "birthday", label: "วันเกิด", type: "date", get: (r) => r.birthday, optional: true, defaultHidden: true, render: (r) => fmtDate(r.birthday) },
  { key: "termination_date", label: "วันพ้นสภาพ", type: "date", get: (r) => r.termination_date, optional: true, render: (r) => fmtDate(r.termination_date) },
  {
    key: "account_status", label: "สถานะบัญชี", type: "enum", get: (r) => r.account_status_label, optional: true,
    render: (r) => (r.account_status_label ? <Badge tone={ACCOUNT_TONE[r.account_status] ?? "neutral"}>{r.account_status_label}</Badge> : <Muted />),
  },
  {
    key: "active", label: "สถานะ", type: "enum", get: (r) => r.active_label,
    render: (r) => (r.active_label ? <Badge tone={r.is_active ? "success" : "danger"}>{r.active_label}</Badge> : <Muted />),
  },
]
const COLUMN_BY_KEY = Object.fromEntries(COLUMNS.map((c) => [c.key, c]))
const DEFAULT_HIDDEN = COLUMNS.filter((c) => c.defaultHidden).map((c) => c.key)
// การ์ดมือถือ: ชื่อ = หัวการ์ด, รหัส + ตำแหน่ง = บรรทัดรอง, สถานะ = badge
const CARD_SKIP = new Set(["id", "name", "position", "active"])

// ─── Persisted column visibility ────────────────────────────────────────────
function readHidden() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    const v = raw ? JSON.parse(raw) : null
    return Array.isArray(v) ? v.filter((k) => COLUMN_BY_KEY[k] && !COLUMN_BY_KEY[k].always) : DEFAULT_HIDDEN
  } catch {
    return DEFAULT_HIDDEN
  }
}

function useHiddenColumns() {
  const [hidden, setHidden] = useState(readHidden)
  const save = useCallback((next) => {
    setHidden(next)
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next))
    } catch {
      /* private mode / quota — แค่ไม่จำ */
    }
  }, [])
  const reset = useCallback(() => {
    setHidden(DEFAULT_HIDDEN)
    try {
      localStorage.removeItem(STORAGE_KEY)
    } catch {
      /* ignore */
    }
  }, [])
  return [hidden, save, reset]
}

// ─── Sorting ────────────────────────────────────────────────────────────────
const byName = (a, b) => thaiCollator.compare(a.full_name, b.full_name) || Number(a.id) - Number(b.id)

function applySort(rows, sort) {
  const col = sort && COLUMN_BY_KEY[sort.key]
  if (!col) return rows
  const numeric = col.sortNumeric || col.type === "number"
  return sortRows(rows, sort, {
    get: col.sortGet ?? col.get,
    text: !numeric && col.type !== "date",
    tiebreak: byName,
  })
}

// date: ISO string ใช้ text compare ได้ แต่ collator ไม่การันตีลำดับตัวเลข → แปลงเป็น timestamp
for (const c of COLUMNS) {
  if (c.type === "date" && !c.sortGet) {
    c.sortGet = (r) => {
      const v = c.get(r)
      if (!has(v)) return null
      const t = Date.parse(String(v).slice(0, 10))
      return Number.isNaN(t) ? null : t
    }
  }
}

// ─── Component ──────────────────────────────────────────────────────────────
export default function EmployeeTable({
  rows: rawRows,
  branches,
  loading = false,
  onRowClick,
  emptyState,
  serverFiltersActive = false,
  onClearServerFilters,
  caption = "รายชื่อเจ้าหน้าที่",
}) {
  const isPhone = useIsPhone()
  const { rows, positionsLoading } = useEmployeeRows(rawRows, branches)
  const [sort, setSort] = useState(null) // { key, dir } | null = ลำดับจาก server
  const [filters, setFilters] = useState({}) // { [colKey]: value }
  const [hidden, setHidden, resetHidden] = useHiddenColumns()
  const [sheetOpen, setSheetOpen] = useState(false)

  // คอลัมน์ที่มีข้อมูล (optional ที่ว่างทุกแถว → ซ่อน)
  const available = useMemo(
    () => COLUMNS.filter((c) => !c.optional || rows.some((r) => has(c.get(r)))),
    [rows],
  )
  const unavailable = useMemo(() => COLUMNS.filter((c) => !available.includes(c)), [available])
  const hiddenSet = useMemo(() => new Set(hidden), [hidden])
  const visible = useMemo(() => available.filter((c) => c.always || !hiddenSet.has(c.key)), [available, hiddenSet])

  const options = useMemo(() => {
    const out = {}
    for (const c of available) if (c.type === "enum") out[c.key] = enumOptions(c, rows)
    return out
  }, [available, rows])

  // filter ที่ใช้ได้จริง (คอลัมน์ต้องมีข้อมูล)
  const activeFilters = useMemo(
    () =>
      available
        .filter((c) => isFilterActive(c.type, filters[c.key]))
        .map((c) => ({ col: c, value: filters[c.key] })),
    [available, filters],
  )

  const result = useMemo(() => {
    const list = activeFilters.length
      ? rows.filter((r) => activeFilters.every(({ col, value }) => matchFilter(col, r, value)))
      : rows
    return applySort(list, sort)
  }, [rows, activeFilters, sort])

  const setFilter = useCallback((key, value) => {
    setFilters((f) => {
      const next = { ...f }
      if (value == null) delete next[key]
      else next[key] = value
      return next
    })
  }, [])
  const setSortFor = useCallback((key, dir) => setSort(dir ? { key, dir } : null), [])

  const clearAll = () => {
    setFilters({})
    if (serverFiltersActive) onClearServerFilters?.()
  }

  const ctx = { positionsLoading }
  const total = rows.length
  const shown = result.length
  const countText = loading
    ? "กำลังโหลดรายชื่อ…"
    : activeFilters.length
      ? `แสดง ${shown.toLocaleString("th-TH")} จาก ${total.toLocaleString("th-TH")} คน`
      : `${total.toLocaleString("th-TH")} คน`

  const filteredEmpty = (
    <EmptyState
      icon={<Users aria-hidden="true" className="size-10" strokeWidth={1.5} />}
      title="ไม่พบเจ้าหน้าที่ตามตัวกรองคอลัมน์"
      description="ลองปรับเงื่อนไขในหัวคอลัมน์ หรือล้างตัวกรองเพื่อดูทั้งหมด"
      action={<button type="button" onClick={() => setFilters({})} className={neutralBtnCls}>ล้างตัวกรองคอลัมน์</button>}
    />
  )
  const noData = !loading && total === 0
  const noMatch = !loading && total > 0 && shown === 0

  return (
    // มือถือ: ไม่ห่อเป็นการ์ด (DataList เป็นการ์ดอยู่แล้ว — ไม่ซ้อนการ์ด)
    <div className={cx("min-w-0", !isPhone && cardCls)}>
      {/* Toolbar: จำนวน · (มือถือ) เรียง + ตัวกรอง · (desktop) คอลัมน์ */}
      <div className={cx("flex flex-wrap items-center justify-between gap-x-4 gap-y-2", isPhone ? "pb-3" : "px-4 py-3")}>
        <p role="status" aria-live="polite" className="text-sm tabular-nums text-gray-600 dark:text-gray-300">
          {countText}
        </p>
        {isPhone ? (
          <MobileControls
            columns={visible}
            sort={sort}
            onSort={setSort}
            filterCount={activeFilters.length}
            onOpenFilters={() => setSheetOpen(true)}
          />
        ) : (
          <ColumnsMenu
            available={available}
            unavailable={unavailable}
            hiddenSet={hiddenSet}
            onToggle={(key) => setHidden(hiddenSet.has(key) ? hidden.filter((k) => k !== key) : [...hidden, key])}
            onReset={resetHidden}
          />
        )}
      </div>

      {/* Active filter chips */}
      {activeFilters.length > 0 && (
        <div className={cx("flex flex-wrap items-center gap-2", isPhone ? "pb-3" : "border-t border-gray-100 px-4 py-2.5 dark:border-line")}>
          <span className="text-xs font-medium text-gray-600 dark:text-gray-300">ตัวกรองที่ใช้</span>
          <ul className="contents">
            {activeFilters.map(({ col, value }) => (
              <li key={col.key}>
                <span className="inline-flex max-w-full items-center gap-1 rounded-full bg-indigo-50 py-1 pl-3 pr-1 text-xs text-indigo-800 ring-1 ring-inset ring-indigo-200 dark:bg-indigo-500/15 dark:text-indigo-200 dark:ring-indigo-400/30">
                  <span className="truncate">
                    <span className="font-semibold">{col.label}:</span> {filterSummary(col, value)}
                  </span>
                  <button
                    type="button"
                    onClick={() => setFilter(col.key, null)}
                    aria-label={`ล้างตัวกรอง ${col.label}`}
                    className={cx("inline-flex size-6 shrink-0 items-center justify-center rounded-full hover:bg-indigo-100 dark:hover:bg-indigo-400/20 cursor-pointer", focusRingCls)}
                  >
                    <X aria-hidden="true" className="size-3.5" strokeWidth={2} />
                  </button>
                </span>
              </li>
            ))}
          </ul>
          <button
            type="button"
            onClick={clearAll}
            className={cx("ml-1 rounded text-xs font-semibold text-indigo-700 hover:underline dark:text-indigo-300 cursor-pointer", focusRingCls)}
          >
            {serverFiltersActive ? "ล้างตัวกรองทั้งหมด" : "ล้างทั้งหมด"}
          </button>
        </div>
      )}

      {isPhone ? (
        <div>
          {noData ? (
            emptyState
          ) : (
            <DataList
              items={result}
              loading={loading}
              keyOf={(r) => r.id}
              title={(r) => r.full_name || `รหัส ${r.id}`}
              subtitle={(r) => [`รหัส ${r.id}`, r.position_title].filter(Boolean).join(" · ")}
              badge={(r) => COLUMN_BY_KEY.active.render(r, ctx)}
              fields={(r) =>
                visible
                  .filter((c) => !CARD_SKIP.has(c.key) && has(c.get(r)))
                  .map((c) => ({ key: c.key, label: c.label, value: () => (c.render ? c.render(r, ctx) : c.get(r)) }))
              }
              onClick={onRowClick}
              emptyState={filteredEmpty}
            />
          )}
          <FilterSheet
            open={sheetOpen}
            onClose={() => setSheetOpen(false)}
            columns={visible}
            filters={filters}
            onFilter={setFilter}
            options={options}
            shown={shown}
            onClearAll={() => setFilters({})}
            hasFilters={activeFilters.length > 0}
          />
        </div>
      ) : noData ? (
        <div className="border-t border-gray-100 dark:border-line">{emptyState}</div>
      ) : (
        <DesktopTable
          caption={caption}
          columns={visible}
          rows={result}
          loading={loading}
          noMatch={noMatch}
          filteredEmpty={filteredEmpty}
          sort={sort}
          onSort={setSortFor}
          filters={filters}
          onFilter={setFilter}
          options={options}
          onRowClick={onRowClick}
          ctx={ctx}
        />
      )}
    </div>
  )
}

// ─── Desktop table ──────────────────────────────────────────────────────────
const STICKY_W = "w-[5.5rem] min-w-[5.5rem] max-w-[5.5rem]" // คอลัมน์รหัส
const STICKY_LEFT_2 = "left-[5.5rem]"
const EDGE_SHADOW = "shadow-[6px_0_8px_-6px_rgb(15_23_42/0.18)] dark:shadow-[6px_0_8px_-6px_rgb(0_0_0/0.7)]"

function DesktopTable({ caption, columns, rows, loading, noMatch, filteredEmpty, sort, onSort, filters, onFilter, options, onRowClick, ctx }) {
  const [scrolledX, setScrolledX] = useState(false)
  const onScroll = (e) => {
    const x = e.currentTarget.scrollLeft > 0
    if (x !== scrolledX) setScrolledX(x)
  }

  const stickyCls = (col, header) => {
    if (col.sticky === "first") return cx("sticky left-0", STICKY_W, header ? "z-30" : "z-10")
    if (col.sticky === "second") return cx("sticky", STICKY_LEFT_2, header ? "z-30" : "z-10", scrolledX && EDGE_SHADOW)
    return header ? "z-20" : ""
  }

  return (
    <div
      onScroll={onScroll}
      aria-busy={loading ? "true" : "false"}
      className="max-h-[max(22rem,calc(100dvh-15rem))] overflow-auto overscroll-x-contain border-t border-gray-100 dark:border-line"
    >
      <table className="w-max min-w-full border-separate border-spacing-0 text-sm">
        <caption className="sr-only">{caption} — กดหัวคอลัมน์เพื่อเรียงหรือกรอง</caption>
        <thead>
          <tr>
            {columns.map((col) => (
              <HeaderCell
                key={col.key}
                col={col}
                className={stickyCls(col, true)}
                sort={sort}
                onSort={onSort}
                filter={filters[col.key]}
                onFilter={onFilter}
                options={options[col.key]}
              />
            ))}
          </tr>
        </thead>
        <tbody>
          {loading ? (
            <SkeletonTableRows rows={8} cols={columns.length} />
          ) : noMatch ? (
            <tr>
              <td colSpan={columns.length} className="p-0">
                {filteredEmpty}
              </td>
            </tr>
          ) : (
            rows.map((r) => (
              <tr
                key={r.id}
                onClick={onRowClick ? () => onRowClick(r) : undefined}
                className={cx(
                  "bg-white transition-colors duration-150 dark:bg-surface",
                  onRowClick && "cursor-pointer hover:bg-indigo-50 dark:hover:bg-raised",
                )}
              >
                {columns.map((col) => (
                  <td
                    key={col.key}
                    className={cx(
                      "whitespace-nowrap border-b border-gray-100 px-3 py-2.5 text-gray-700 dark:border-line dark:text-gray-300",
                      col.align === "right" && "text-right tabular-nums",
                      col.minW,
                      col.sticky && "bg-inherit",
                      stickyCls(col, false),
                    )}
                  >
                    {col.key === "name" ? (
                      <NameCell row={r} onOpen={onRowClick} />
                    ) : col.render ? (
                      col.render(r, ctx) ?? <Muted />
                    ) : has(col.get(r)) ? (
                      col.get(r)
                    ) : (
                      <Muted />
                    )}
                  </td>
                ))}
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  )
}

function NameCell({ row, onOpen }) {
  const name = row.full_name || `รหัส ${row.id}`
  const avatar = (
    <span aria-hidden="true" className="flex size-8 shrink-0 items-center justify-center rounded-xl bg-indigo-100 text-xs font-bold text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-300">
      {row.first_name?.trim()?.[0] ?? "?"}
    </span>
  )
  if (!onOpen) {
    return (
      <span className="flex min-w-[12rem] items-center gap-2.5">
        {avatar}
        <span className="font-semibold text-gray-900 dark:text-gray-100">{name}</span>
      </span>
    )
  }
  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation()
        onOpen(row)
      }}
      className={cx("-mx-1 flex min-w-[12rem] items-center gap-2.5 rounded-lg px-1 text-left cursor-pointer", focusRingCls)}
    >
      {avatar}
      <span className="font-semibold text-gray-900 dark:text-gray-100">{name}</span>
      <span className="sr-only">— ดูข้อมูลเจ้าหน้าที่</span>
    </button>
  )
}

function HeaderCell({ col, className, sort, onSort, filter, onFilter, options }) {
  const btnRef = useRef(null)
  const panelId = useId()
  const [open, setOpen] = useState(false)
  const close = useCallback(() => setOpen(false), [])
  const sorted = sort?.key === col.key ? sort.dir : null
  const filtered = isFilterActive(col.type, filter)
  const Icon = sorted === "asc" ? ChevronUp : sorted === "desc" ? ChevronDown : ChevronsUpDown
  const right = col.align === "right"
  const labels = col.sortLabels ?? sortLabels(col.type)

  return (
    <th
      scope="col"
      aria-sort={sorted ? (sorted === "asc" ? "ascending" : "descending") : undefined}
      className={cx(
        "sticky top-0 whitespace-nowrap border-b border-gray-200 bg-gray-50 p-0 text-xs font-semibold text-gray-600 dark:border-line-strong dark:bg-gray-900 dark:text-gray-300",
        right ? "text-right" : "text-left",
        className,
      )}
    >
      <button
        ref={btnRef}
        type="button"
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-controls={open ? panelId : undefined}
        onClick={() => setOpen((o) => !o)}
        onKeyDown={(e) => {
          if (e.key === "ArrowDown" && !open) {
            e.preventDefault()
            setOpen(true)
          }
        }}
        className={cx(
          "flex w-full items-center gap-1.5 px-3 py-2.5 transition-colors duration-150 cursor-pointer",
          "hover:bg-gray-100 hover:text-gray-900 dark:hover:bg-white/[.05] dark:hover:text-gray-100",
          "focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-indigo-500 dark:focus-visible:ring-indigo-400",
          (open || sorted || filtered) && "text-gray-900 dark:text-gray-100",
          open && "bg-gray-100 dark:bg-white/[.06]",
          right && "flex-row-reverse",
        )}
      >
        <span>{col.label}</span>
        {filtered && <span aria-hidden="true" className="size-1.5 shrink-0 rounded-full bg-indigo-600 dark:bg-indigo-400" />}
        <Icon
          aria-hidden="true"
          className={cx("size-3.5 shrink-0", sorted ? "text-indigo-600 dark:text-indigo-400" : "text-gray-400 dark:text-gray-500")}
          strokeWidth={2}
        />
        <span className="sr-only">
          {sorted ? `, เรียง ${labels[sorted]}` : ""}
          {filtered ? ", มีตัวกรอง" : ""}
        </span>
      </button>
      <ColumnHeaderMenu
        open={open}
        anchorRef={btnRef}
        onClose={close}
        panelId={panelId}
        column={col}
        sort={sort}
        onSort={(dir) => onSort(col.key, dir)}
        filter={filter}
        onFilter={(v) => onFilter(col.key, v)}
        options={options}
      />
    </th>
  )
}

// ─── Column visibility popover ──────────────────────────────────────────────
function ColumnsMenu({ available, unavailable, hiddenSet, onToggle, onReset }) {
  const btnRef = useRef(null)
  const panelRef = useRef(null)
  const panelId = useId()
  const titleId = useId()
  const [open, setOpen] = useState(false)
  const { style } = useAnchoredPanel(btnRef, { open, maxH: 440, minW: 260, maxW: 300 })
  useFocusTrap(panelRef, { active: open })
  const hiddenCount = available.filter((c) => !c.always && hiddenSet.has(c.key)).length

  useEffect(() => {
    if (!open) return
    const onDown = (e) => {
      if (panelRef.current?.contains(e.target) || btnRef.current?.contains(e.target)) return
      setOpen(false)
    }
    const onKey = (e) => {
      if (e.key !== "Escape" || e.defaultPrevented || e.isComposing) return
      e.preventDefault()
      setOpen(false)
    }
    document.addEventListener("mousedown", onDown)
    document.addEventListener("keydown", onKey)
    return () => {
      document.removeEventListener("mousedown", onDown)
      document.removeEventListener("keydown", onKey)
    }
  }, [open])

  return (
    <>
      <button
        ref={btnRef}
        type="button"
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-controls={open ? panelId : undefined}
        onClick={() => setOpen((o) => !o)}
        className={cx(neutralBtnCls, "!h-9 !px-3")}
      >
        <Columns3 aria-hidden="true" className="size-4" strokeWidth={1.75} />
        คอลัมน์
        {hiddenCount > 0 && <span className="text-xs font-normal tabular-nums text-gray-500 dark:text-gray-400">(ซ่อน {hiddenCount})</span>}
      </button>
      {open &&
        createPortal(
          <div
            ref={panelRef}
            id={panelId}
            role="dialog"
            aria-labelledby={titleId}
            tabIndex={-1}
            style={{ ...style, zIndex: PANEL_Z }}
            className="flex flex-col overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-xl shadow-gray-900/10 focus:outline-none dark:border-line-strong dark:bg-raised dark:shadow-2xl dark:shadow-black/60"
          >
            <div className="flex items-center justify-between gap-2 border-b border-gray-100 px-4 py-2.5 dark:border-line">
              <h2 id={titleId} className="text-sm font-semibold text-gray-900 dark:text-gray-100">แสดงคอลัมน์</h2>
              <button type="button" onClick={onReset} className={cx("rounded text-xs font-semibold text-indigo-700 hover:underline dark:text-indigo-300 cursor-pointer", focusRingCls)}>
                ค่าเริ่มต้น
              </button>
            </div>
            <ul className="min-h-0 flex-1 overflow-y-auto overscroll-contain py-1">
              {available.map((c) => (
                <li key={c.key}>
                  <label className={cx(
                    "flex min-h-9 items-center gap-2.5 px-4 text-sm",
                    c.always ? "cursor-not-allowed text-gray-500 dark:text-gray-400" : "cursor-pointer text-gray-800 hover:bg-gray-50 dark:text-gray-200 dark:hover:bg-white/[.05]",
                  )}>
                    <input
                      type="checkbox"
                      checked={c.always || !hiddenSet.has(c.key)}
                      disabled={c.always}
                      onChange={() => onToggle(c.key)}
                      className="size-4 shrink-0 cursor-pointer rounded border-gray-300 accent-indigo-600 disabled:cursor-not-allowed dark:accent-indigo-400"
                    />
                    <span className="flex-1">{c.label}</span>
                    {c.always && <span className="text-xs">ล็อกไว้</span>}
                  </label>
                </li>
              ))}
            </ul>
            {unavailable.length > 0 && (
              <p className="border-t border-gray-100 px-4 py-2.5 text-xs leading-relaxed text-gray-500 dark:border-line dark:text-gray-400">
                ยังไม่มีข้อมูลจากระบบ: {unavailable.map((c) => c.label).join(" · ")}
              </p>
            )}
          </div>,
          document.body,
        )}
    </>
  )
}

// ─── Mobile ─────────────────────────────────────────────────────────────────
const DEFAULT_SORT = "__default"

function MobileControls({ columns, sort, onSort, filterCount, onOpenFilters }) {
  const sortOptions = useMemo(() => {
    const opts = [{ value: DEFAULT_SORT, label: "ลำดับเริ่มต้น" }]
    for (const c of columns) {
      const l = c.sortLabels ?? sortLabels(c.type)
      opts.push({ value: `${c.key}:asc`, label: `${c.label} ${l.asc}` })
      opts.push({ value: `${c.key}:desc`, label: `${c.label} ${l.desc}` })
    }
    return opts
  }, [columns])

  return (
    <div className="flex w-full items-center gap-2">
      <div className="min-w-0 flex-1">
        <SelectDropdown
          value={sort ? `${sort.key}:${sort.dir}` : DEFAULT_SORT}
          onChange={(v) => {
            if (v === DEFAULT_SORT) return onSort(null)
            const [key, dir] = v.split(":")
            onSort({ key, dir })
          }}
          options={sortOptions}
          ariaLabel="เรียงลำดับ"
          searchable
          searchPlaceholder="ค้นหาคอลัมน์"
          showSwatch={false}
        />
      </div>
      <button type="button" onClick={onOpenFilters} className={cx(neutralBtnCls, "shrink-0 !h-12 !rounded-2xl")}>
        <SlidersHorizontal aria-hidden="true" className="size-4" strokeWidth={1.75} />
        ตัวกรอง
        {filterCount > 0 && (
          <span className="inline-flex min-w-5 items-center justify-center rounded-full bg-indigo-600 px-1.5 text-xs font-semibold tabular-nums text-white">
            {filterCount}
          </span>
        )}
      </button>
    </div>
  )
}

function FilterSheet({ open, onClose, columns, filters, onFilter, options, shown, onClearAll, hasFilters }) {
  return (
    <Sheet
      open={open}
      onClose={onClose}
      title="ตัวกรองรายชื่อ"
      size="md"
      initialFocus={null}
      footer={
        <div className="grid grid-cols-2 gap-3 border-t border-gray-100 px-4 py-3 dark:border-line">
          <button type="button" onClick={onClearAll} disabled={!hasFilters} className={cx(neutralBtnCls, "!h-12")}>
            ล้างทั้งหมด
          </button>
          <button type="button" onClick={onClose} className={cx(primaryBtnCls, "!h-12")}>
            ดู {shown.toLocaleString("th-TH")} คน
          </button>
        </div>
      }
    >
      <div className="divide-y divide-gray-100 dark:divide-line">
        {columns.map((c) => {
          const on = isFilterActive(c.type, filters[c.key])
          return (
            <details key={c.key} open={on || undefined} className="group py-1">
              <summary className="flex min-h-12 cursor-pointer list-none items-center justify-between gap-3 text-sm font-semibold text-gray-900 dark:text-gray-100 [&::-webkit-details-marker]:hidden">
                <span className="flex min-w-0 items-center gap-2">
                  {c.label}
                  {on && (
                    <span className="truncate text-xs font-normal text-indigo-700 dark:text-indigo-300">
                      {filterSummary(c, filters[c.key])}
                    </span>
                  )}
                </span>
                <ChevronDown aria-hidden="true" className="size-4 shrink-0 text-gray-400 transition-transform duration-200 group-open:rotate-180" strokeWidth={2} />
              </summary>
              <div className="space-y-4 pb-4 pt-1">
                <ColumnFilterControl column={c} value={filters[c.key]} onChange={(v) => onFilter(c.key, v)} options={options[c.key]} />
              </div>
            </details>
          )
        })}
      </div>
    </Sheet>
  )
}
