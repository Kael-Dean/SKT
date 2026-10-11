// src/components/ui/DataList.jsx
// ─────────────────────────────────────────────────────────────────────────────
// Card list that replaces a wide <table> on phones (Order, MemberSearch,
// trailer summary…). Pages switch with `isPhone ? <DataList/> : <table/>` —
// not CSS hide — so 100 rows are not rendered twice.
//
//   <DataList
//     items={rows} keyOf={(r) => r.id}
//     title={(r) => r.customerName}
//     subtitle={(r) => `${fmtDate(r.date)} · ${r.orderNo}`}
//     badge={(r) => <Badge tone="info">{r.branch}</Badge>}
//     fields={[
//       { label: "นน.สุทธิ", value: (r) => nf(r.netKg), align: "right" },
//       { label: "เป็นเงิน", value: (r) => thb(r.amount), align: "right", emphasis: true },
//     ]}
//     onClick={(r) => openDetail(r)}
//     actions={(r) => <button className={neutralBtnCls}>แก้ไข</button>}
//     loading={loading} skeletonRows={4}
//     emptyState={<EmptyState title="ไม่พบออเดอร์" />} />
//
//   title / subtitle / badge / actions   node | (item) => node
//   fields   [{ label, value: key | (item) => node, align: 'left'|'right', emphasis, span: 1|2 }]
//            or (item) => [...]; numbers → align:'right' (tabular-nums);
//            span: 2 = full row of the 2-col dl (e.g. ชนิดข้าว)
//   onClick  makes the whole card a 44px+ tap target (stretched button) and
//            shows a chevron; `actions` stay independently clickable.
// ─────────────────────────────────────────────────────────────────────────────
import { ChevronRight } from "lucide-react"
import { cx } from "../../lib/styles"
import EmptyState from "./EmptyState"
import { SkeletonCard } from "./Skeleton"

const call = (v, item) => (typeof v === "function" ? v(item) : v)
const fieldValue = (f, item) => (typeof f.value === "function" ? f.value(item) : item?.[f.value])

export default function DataList({
  items = [],
  keyOf = (item, i) => item?.id ?? i,
  title,
  subtitle,
  fields = [],
  badge,
  onClick,
  actions,
  emptyState,
  loading = false,
  skeletonRows = 4,
  className = "",
}) {
  if (loading) {
    return (
      <div className={cx("space-y-3", className)} role="status" aria-live="polite" aria-label="กำลังโหลด">
        {Array.from({ length: skeletonRows }).map((_, i) => (
          <SkeletonCard key={i} className="p-4" />
        ))}
      </div>
    )
  }

  if (!items.length) {
    return emptyState ?? <EmptyState />
  }

  return (
    <ul className={cx("space-y-3", className)}>
      {items.map((item, i) => {
        const fs = call(fields, item) ?? []
        const t = call(title, item)
        const st = call(subtitle, item)
        const b = call(badge, item)
        const acts = call(actions, item)
        const clickable = typeof onClick === "function"
        return (
          <li
            key={keyOf(item, i)}
            className={cx(
              "relative rounded-2xl bg-white p-4 shadow-sm ring-1 ring-gray-200/70 dark:bg-gray-800 dark:ring-gray-700/70",
              clickable && "transition-colors duration-150 hover:bg-gray-50 has-[button:focus-visible]:ring-indigo-500 dark:hover:bg-gray-700/40",
            )}
          >
            <div className="flex items-start gap-3">
              <div className="min-w-0 flex-1">
                {clickable ? (
                  <button
                    type="button"
                    onClick={() => onClick(item)}
                    className={cx(
                      "block w-full cursor-pointer text-left text-base font-semibold leading-snug text-gray-900 dark:text-gray-100",
                      "after:absolute after:inset-0 after:rounded-2xl after:content-['']",
                      "focus:outline-none",
                    )}
                  >
                    {t}
                  </button>
                ) : (
                  <p className="text-base font-semibold leading-snug text-gray-900 dark:text-gray-100">{t}</p>
                )}
                {st && <p className="mt-0.5 text-sm text-gray-500 dark:text-gray-400">{st}</p>}
              </div>
              {b && <div className="shrink-0">{b}</div>}
              {clickable && (
                <ChevronRight
                  aria-hidden="true"
                  className="mt-0.5 size-5 shrink-0 text-gray-400 dark:text-gray-500"
                  strokeWidth={1.75}
                />
              )}
            </div>

            {fs.length > 0 && (
              <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-2">
                {fs.map((f, j) => {
                  const right = f.align === "right"
                  return (
                    <div key={f.key ?? f.label ?? j} className={cx("min-w-0", right && "text-right", f.span === 2 && "col-span-2")}>
                      <dt className="text-xs text-gray-500 dark:text-gray-400">{f.label}</dt>
                      <dd
                        className={cx(
                          "truncate",
                          right && "tabular-nums",
                          f.emphasis
                            ? "text-base font-semibold text-gray-900 dark:text-gray-100"
                            : "text-sm font-medium text-gray-800 dark:text-gray-200",
                        )}
                      >
                        {fieldValue(f, item) ?? "—"}
                      </dd>
                    </div>
                  )
                })}
              </dl>
            )}

            {acts && <div className="relative z-10 mt-3 flex flex-wrap justify-end gap-2">{acts}</div>}
          </li>
        )
      })}
    </ul>
  )
}
