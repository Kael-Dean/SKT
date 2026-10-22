// src/components/hr/kpi/SelfAssessmentCard.jsx
// Read-only view of an employee's self-assessment (3L). Shown to evaluators beside
// their score inputs, labelled "ผู้ถูกประเมินประเมินตนเอง". It NEVER counts toward
// the score — the label says so. Data: GET /hr/kpi/evaluations/{id}/self-assessment
// ({ items: {"2.1": 5}, total, comment, submitted_at, updated_at } | null).
import { UserRound } from "lucide-react"
import { cx } from "../../../lib/styles"
import { Skeleton } from "../../ui"
import { fmtDate } from "../positionUtils"
import { fmtScore, num } from "./kpiUtils"

export default function SelfAssessmentCard({ data, loading, error, catalogue, className = "" }) {
  const items = Array.isArray(catalogue?.items) ? catalogue.items : []
  const groups = Array.isArray(catalogue?.groups) ? catalogue.groups : []
  const values = data?.items && typeof data.items === "object" ? data.items : {}
  const total = num(data?.total)
  const stamp = data?.updated_at || data?.submitted_at

  return (
    <section
      aria-labelledby="kpi-self-title"
      className={cx("rounded-xl bg-gray-50 p-3 ring-1 ring-gray-200/80 dark:bg-gray-900/40 dark:ring-gray-700/70", className)}
    >
      <div className="flex items-start justify-between gap-3">
        <h3 id="kpi-self-title" className="inline-flex items-center gap-1.5 text-sm font-semibold text-gray-900 dark:text-gray-100">
          <UserRound aria-hidden="true" className="size-4 text-gray-500 dark:text-gray-400" strokeWidth={1.75} />
          ผู้ถูกประเมินประเมินตนเอง
        </h3>
        {total != null && (
          <p className="whitespace-nowrap text-sm tabular-nums text-gray-900 dark:text-gray-100">
            <span className="font-semibold">{fmtScore(total)}</span>
            <span className="text-gray-500 dark:text-gray-400">/100</span>
          </p>
        )}
      </div>
      <p className="mt-0.5 text-xs text-gray-500 dark:text-gray-400">ใช้ประกอบการพิจารณาเท่านั้น ไม่นำไปคิดคะแนน</p>

      {loading ? (
        <div className="mt-3 space-y-2">
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-5/6" />
          <Skeleton className="h-4 w-4/6" />
        </div>
      ) : error ? (
        <p role="alert" className="mt-3 text-sm text-red-700 dark:text-red-300">{error}</p>
      ) : !data ? (
        <p className="mt-3 text-sm text-gray-600 dark:text-gray-400">ยังไม่ได้ส่งแบบประเมินตนเอง</p>
      ) : (
        <div className="mt-3 space-y-3">
          {groups.map((g) => {
            const rows = items.filter((it) => Number(it.group) === Number(g.group))
            const sub = rows.reduce((s, it) => s + (num(values[it.item]) ?? 0), 0)
            return (
              <div key={g.group}>
                <p className="flex items-baseline justify-between gap-2 text-xs font-semibold text-gray-700 dark:text-gray-300">
                  <span>{g.label}</span>
                  <span className="tabular-nums">{fmtScore(sub)}<span className="font-normal text-gray-500 dark:text-gray-400">/{fmtScore(g.max)}</span></span>
                </p>
                <dl className="mt-1 space-y-0.5">
                  {rows.map((it) => (
                    <div key={it.item} className="flex items-baseline justify-between gap-3 text-xs">
                      <dt className="min-w-0 text-gray-600 dark:text-gray-400">
                        <span className="tabular-nums text-gray-400 dark:text-gray-500">{it.item}</span> {it.label}
                      </dt>
                      <dd className="shrink-0 tabular-nums text-gray-900 dark:text-gray-100">
                        {fmtScore(values[it.item])}
                        <span className="text-gray-400 dark:text-gray-500">/{fmtScore(it.max)}</span>
                      </dd>
                    </div>
                  ))}
                </dl>
              </div>
            )
          })}
          {data.comment && (
            <blockquote className="border-t border-gray-200 pt-2 text-xs text-gray-700 dark:border-gray-700 dark:text-gray-300 whitespace-pre-line">
              {data.comment}
            </blockquote>
          )}
          {stamp && <p className="text-xs text-gray-500 dark:text-gray-400">ส่งล่าสุด {fmtDate(stamp)}</p>}
        </div>
      )}
    </section>
  )
}
