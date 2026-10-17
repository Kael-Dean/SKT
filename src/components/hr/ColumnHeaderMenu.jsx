// src/components/hr/ColumnHeaderMenu.jsx
// ─────────────────────────────────────────────────────────────────────────────
// Popover ของหัวคอลัมน์: เรียงลำดับ + ตัวกรองตามชนิดคอลัมน์ (text / enum / number / date)
//
//   <ColumnHeaderMenu open anchorRef={btnRef} onClose={…} column={col}
//     sort={sort} onSort={(dir|null) => …}
//     filter={value} onFilter={(value|null) => …} options={enumOptions} />
//
// • portal เข้า <body> แบบ position:fixed (useAnchoredPanel) z 10050 → ไม่โดน overflow ของตารางตัด
// • focus เข้า panel ตอนเปิด, Tab วนใน panel, Esc ปิดแล้ว focus กลับปุ่มหัวคอลัมน์ (useFocusTrap)
// • คลิกนอก panel (ภายในแอป) = ปิด; คลิกใน popover ที่ portal แยก (ปฏิทิน ThaiDatePicker) ไม่ปิด
//
// ColumnFilterControl / SortControl export แยกเพื่อใช้ซ้ำใน Sheet ตัวกรองบนมือถือ
// ─────────────────────────────────────────────────────────────────────────────
import { useEffect, useId, useMemo, useRef, useState } from "react"
import { createPortal } from "react-dom"
import { ArrowDownWideNarrow, ArrowUpNarrowWide, Search, X } from "lucide-react"
import useAnchoredPanel from "../../lib/useAnchoredPanel"
import useFocusTrap from "../../lib/useFocusTrap"
import { baseField, cx, errorTextCls, focusRingCls, helpTextCls } from "../../lib/styles"
import ThaiDateField from "../ThaiDateField"
import { isFilterActive, sortLabels } from "./columnFilters"

const PANEL_Z = 10050
const fieldCls = cx(baseField, "!rounded-lg !px-3 !py-2 md:!text-sm")
const sectionLabelCls = "text-xs font-semibold text-gray-600 dark:text-gray-300"
const linkBtnCls =
  "rounded text-xs font-semibold text-indigo-700 hover:underline disabled:cursor-not-allowed disabled:opacity-50 disabled:no-underline dark:text-indigo-300 cursor-pointer " +
  focusRingCls

// ─── Sort ───────────────────────────────────────────────────────────────────
export function SortControl({ column, sort, onSort }) {
  const labels = column.sortLabels ?? sortLabels(column.type)
  const active = sort?.key === column.key ? sort.dir : null
  const ICONS = { asc: ArrowUpNarrowWide, desc: ArrowDownWideNarrow }
  const btn = (dir) => {
    const Icon = ICONS[dir]
    return (
    <button
      type="button"
      aria-pressed={active === dir}
      data-sort-first={dir === "asc" ? "" : undefined}
      onClick={() => onSort(active === dir ? null : dir)}
      className={cx(
        "inline-flex min-h-11 md:min-h-9 flex-1 items-center justify-center gap-1.5 rounded-lg px-2 text-sm font-medium transition-colors duration-150 cursor-pointer",
        active === dir
          ? "bg-indigo-50 text-indigo-700 ring-1 ring-inset ring-indigo-300 dark:bg-indigo-500/15 dark:text-indigo-200 dark:ring-indigo-400/40"
          : "text-gray-700 ring-1 ring-inset ring-gray-200 hover:bg-gray-50 dark:text-gray-200 dark:ring-line-strong dark:hover:bg-white/[.06]",
        focusRingCls,
      )}
    >
      <Icon aria-hidden="true" className="size-4 shrink-0" strokeWidth={1.75} />
      <span className="whitespace-nowrap">{labels[dir]}</span>
    </button>
    )
  }
  return (
    <div role="group" aria-label={`เรียง ${column.label}`} className="flex gap-2">
      {btn("asc")}
      {btn("desc")}
    </div>
  )
}

// ─── Filter controls ────────────────────────────────────────────────────────
function TextFilter({ column, value, onChange, idBase }) {
  return (
    <div className="space-y-1">
      <label htmlFor={`${idBase}-q`} className="sr-only">ค้นหาใน{column.label}</label>
      <input
        id={`${idBase}-q`}
        type="search"
        value={value ?? ""}
        onChange={(e) => onChange(e.target.value === "" ? null : e.target.value)}
        placeholder={`พิมพ์คำใน${column.label}`}
        autoComplete="off"
        className={fieldCls}
      />
    </div>
  )
}

function EnumFilter({ column, value, onChange, options, idBase }) {
  const [q, setQ] = useState("")
  const selected = useMemo(() => new Set(value ?? []), [value])
  const shown = useMemo(() => {
    const s = q.trim().toLowerCase()
    return s ? options.filter((o) => o.label.toLowerCase().includes(s)) : options
  }, [options, q])
  const allShownSelected = shown.length > 0 && shown.every((o) => selected.has(o.value))

  const commit = (set) => onChange(set.size ? options.filter((o) => set.has(o.value)).map((o) => o.value) : null)
  const toggle = (v) => {
    const next = new Set(selected)
    if (next.has(v)) next.delete(v)
    else next.add(v)
    commit(next)
  }
  const selectShown = () => {
    const next = new Set(selected)
    if (allShownSelected) shown.forEach((o) => next.delete(o.value))
    else shown.forEach((o) => next.add(o.value))
    commit(next)
  }

  return (
    <div className="space-y-2">
      {options.length > 6 && (
        <div className="relative">
          <label htmlFor={`${idBase}-s`} className="sr-only">ค้นหาตัวเลือก{column.label}</label>
          <Search aria-hidden="true" className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-gray-400 dark:text-gray-500" strokeWidth={1.75} />
          <input
            id={`${idBase}-s`}
            type="search"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="ค้นหาในรายการ"
            autoComplete="off"
            className={cx(fieldCls, "!pl-9")}
          />
        </div>
      )}
      <div className="flex items-center justify-between gap-3">
        <button type="button" onClick={selectShown} disabled={!shown.length} className={linkBtnCls}>
          {allShownSelected ? "ยกเลิกที่เลือก" : q.trim() ? "เลือกทั้งหมดที่ค้นเจอ" : "เลือกทั้งหมด"}
        </button>
        <span className="text-xs tabular-nums text-gray-500 dark:text-gray-400">
          {selected.size ? `เลือก ${selected.size}` : "ไม่เลือก = แสดงทุกค่า"}
        </span>
      </div>
      <ul
        role="group"
        aria-label={`ค่าของ${column.label}`}
        className="max-h-56 overflow-y-auto overscroll-contain rounded-lg ring-1 ring-inset ring-gray-200 py-1 dark:ring-line"
      >
        {shown.length === 0 ? (
          <li className="px-3 py-4 text-center text-sm text-gray-500 dark:text-gray-400">ไม่พบรายการ</li>
        ) : (
          shown.map((o) => {
            const id = `${idBase}-o-${o.value}`
            return (
              <li key={o.value}>
                <label
                  htmlFor={id}
                  className="flex min-h-11 md:min-h-9 cursor-pointer items-center gap-2.5 px-3 text-sm text-gray-800 hover:bg-gray-50 dark:text-gray-200 dark:hover:bg-white/[.05]"
                >
                  <input
                    id={id}
                    type="checkbox"
                    checked={selected.has(o.value)}
                    onChange={() => toggle(o.value)}
                    className="size-4 shrink-0 cursor-pointer rounded border-gray-300 accent-indigo-600 dark:accent-indigo-400"
                  />
                  <span className="min-w-0 flex-1 truncate" title={o.label}>{o.label}</span>
                  <span className="shrink-0 text-xs tabular-nums text-gray-500 dark:text-gray-400">{o.count}</span>
                </label>
              </li>
            )
          })
        )}
      </ul>
    </div>
  )
}

const toNum = (s) => {
  if (s === "" || s == null) return null
  const n = Number(s)
  return Number.isFinite(n) ? n : null
}

/** ช่วง ต่ำสุด–สูงสุด / ตั้งแต่–ถึง: เก็บร่างไว้ในตัว, ส่งขึ้นเมื่อถูกต้องเท่านั้น */
function RangeFilter({ column, value, onChange, idBase }) {
  const isDate = column.type === "date"
  const fromKey = isDate ? "from" : "min"
  const toKey = isDate ? "to" : "max"
  const toDraft = (v) => ({ a: v?.[fromKey] ?? "", b: v?.[toKey] ?? "" })
  const [draft, setDraft] = useState(() => toDraft(value))
  const [prevValue, setPrevValue] = useState(value)
  if (value !== prevValue) {
    // ถูกล้างจากภายนอก (chip / ล้างทั้งหมด) → ร่างตามค่าจริง
    setPrevValue(value)
    setDraft(toDraft(value))
  }

  const parse = (d) => (isDate ? { a: d.a || null, b: d.b || null } : { a: toNum(d.a), b: toNum(d.b) })
  const p = parse(draft)
  const badNumber = !isDate && ((draft.a !== "" && p.a == null) || (draft.b !== "" && p.b == null))
  const reversed = p.a != null && p.b != null && p.a > p.b
  const error = badNumber
    ? "กรอกเป็นตัวเลข"
    : reversed
      ? isDate
        ? "วันที่เริ่มต้องไม่เลยวันที่สิ้นสุด"
        : "ค่าต่ำสุดต้องไม่มากกว่าค่าสูงสุด"
      : ""

  const update = (k, raw) => {
    const next = { ...draft, [k]: raw }
    setDraft(next)
    const np = parse(next)
    const nBad = !isDate && ((next.a !== "" && np.a == null) || (next.b !== "" && np.b == null))
    if (nBad || (np.a != null && np.b != null && np.a > np.b)) return
    const out = np.a == null && np.b == null ? null : { [fromKey]: np.a, [toKey]: np.b }
    setPrevValue(out)
    onChange(out)
  }

  const errId = `${idBase}-err`
  const labels = isDate ? ["ตั้งแต่", "ถึง"] : ["ต่ำสุด", "สูงสุด"]
  const field = (k, label) => {
    const id = `${idBase}-${k}`
    return (
      <div className="min-w-0 flex-1 space-y-1">
        <label htmlFor={id} className="text-xs font-medium text-gray-600 dark:text-gray-300">
          {label}
          {!isDate && column.unit ? ` (${column.unit})` : ""}
        </label>
        {isDate ? (
          <ThaiDateField
            id={id}
            value={draft[k]}
            onChange={(e) => update(k, e.target.value)}
            error={!!error}
            aria-describedby={error ? errId : undefined}
            className="!rounded-lg !px-3 !py-2 md:!text-sm"
          />
        ) : (
          <input
            id={id}
            type="number"
            inputMode="decimal"
            step="any"
            value={draft[k]}
            onChange={(e) => update(k, e.target.value)}
            aria-invalid={error ? true : undefined}
            aria-describedby={error ? errId : undefined}
            className={cx(fieldCls, "tabular-nums", error && "!border-red-500 dark:!border-red-400")}
          />
        )}
      </div>
    )
  }

  return (
    <div className="space-y-1.5">
      <div className={cx("flex gap-2", isDate && "flex-col")}>
        {field("a", labels[0])}
        {field("b", labels[1])}
      </div>
      {error ? (
        <p id={errId} role="alert" className={errorTextCls}>{error}</p>
      ) : (
        <p className={helpTextCls}>เว้นว่างด้านใดด้านหนึ่งได้</p>
      )}
    </div>
  )
}

export function ColumnFilterControl({ column, value, onChange, options = [] }) {
  const idBase = useId()
  if (column.type === "text") return <TextFilter column={column} value={value} onChange={onChange} idBase={idBase} />
  if (column.type === "enum")
    return <EnumFilter column={column} value={value} onChange={onChange} options={options} idBase={idBase} />
  return <RangeFilter column={column} value={value} onChange={onChange} idBase={idBase} />
}

// ─── Popover ────────────────────────────────────────────────────────────────
export default function ColumnHeaderMenu({
  open,
  anchorRef,
  onClose,
  column,
  sort,
  onSort,
  filter,
  onFilter,
  options,
  panelId,
}) {
  const panelRef = useRef(null)
  const titleId = useId()
  const { style } = useAnchoredPanel(anchorRef, { open, maxH: 400, minW: 280, maxW: 320 })
  // focus แรก: คอลัมน์ที่พิมพ์ค้น (text / enum ยาว) → ช่องค้นหา; อื่น ๆ → ปุ่มเรียงปุ่มแรก
  const typeFirst = column.type === "text" || (column.type === "enum" && (options?.length ?? 0) > 6)
  useFocusTrap(panelRef, { active: open, initialSelector: typeFirst ? "input[type=search]" : "[data-sort-first]" })

  // คลิกนอก panel ภายในแอป → ปิด (popover ที่ portal แยก เช่นปฏิทิน อยู่นอก #root → ไม่ปิด)
  useEffect(() => {
    if (!open) return
    const onDown = (e) => {
      const t = e.target
      if (panelRef.current?.contains(t) || anchorRef.current?.contains(t)) return
      const root = document.getElementById("root")
      if (root && !root.contains(t)) return
      onClose()
    }
    // bubble phase: ปฏิทิน / dropdown ด้านในจับ Esc ไว้ก่อน (preventDefault) → ไม่ปิด panel นี้
    const onKey = (e) => {
      if (e.key !== "Escape" || e.defaultPrevented || e.isComposing) return
      e.preventDefault()
      onClose()
    }
    document.addEventListener("mousedown", onDown)
    document.addEventListener("keydown", onKey)
    return () => {
      document.removeEventListener("mousedown", onDown)
      document.removeEventListener("keydown", onKey)
    }
  }, [open, onClose, anchorRef])

  if (!open) return null
  const filterOn = isFilterActive(column.type, filter)

  return createPortal(
    <div
      ref={panelRef}
      id={panelId}
      role="dialog"
      aria-labelledby={titleId}
      tabIndex={-1}
      style={{ ...style, zIndex: PANEL_Z }}
      className="flex flex-col overflow-hidden rounded-2xl border border-gray-200 bg-white text-left font-normal normal-case tracking-normal shadow-xl shadow-gray-900/10 focus:outline-none dark:border-line-strong dark:bg-raised dark:shadow-2xl dark:shadow-black/60"
    >
      <div className="flex items-center justify-between gap-2 border-b border-gray-100 py-1.5 pl-4 pr-1.5 dark:border-line">
        <h2 id={titleId} className="truncate text-sm font-semibold text-gray-900 dark:text-gray-100">{column.label}</h2>
        <button type="button" onClick={onClose} aria-label="ปิด" className={cx("inline-flex size-9 shrink-0 items-center justify-center rounded-lg text-gray-500 hover:bg-gray-100 hover:text-gray-900 dark:text-gray-400 dark:hover:bg-white/[.08] dark:hover:text-gray-100 cursor-pointer", focusRingCls)}>
          <X aria-hidden="true" className="size-4" strokeWidth={2} />
        </button>
      </div>

      <div className="min-h-0 flex-1 space-y-4 overflow-y-auto overscroll-contain p-4">
        <section className="space-y-2">
          <h3 className={sectionLabelCls}>เรียงลำดับ</h3>
          <SortControl column={column} sort={sort} onSort={onSort} />
        </section>

        {column.filterable !== false && (
          <section className="space-y-2">
            <div className="flex items-center justify-between gap-2">
              <h3 className={sectionLabelCls}>ตัวกรอง</h3>
              {filterOn && (
                <button type="button" onClick={() => onFilter(null)} className={linkBtnCls}>
                  ล้างตัวกรอง
                </button>
              )}
            </div>
            <ColumnFilterControl column={column} value={filter} onChange={onFilter} options={options} />
          </section>
        )}
      </div>
    </div>,
    document.body,
  )
}
