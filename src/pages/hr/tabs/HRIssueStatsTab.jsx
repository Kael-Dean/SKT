// src/pages/hr/tabs/HRIssueStatsTab.jsx
// สถิติคำร้องแจ้งแก้ไขข้อมูล (3F) — GET /hr/issue-reports/stats?year=<พ.ศ.>&month=<1-12 | ไม่ส่ง = ทั้งปี>
// เปิดจาก /hr/dashboard?tab=issue-stats · สิทธิ์ hr.issues.stats (issue.view)
// นับตามวันที่ "ส่ง" คำร้อง. resolved = อนุมัติ + ปฏิเสธ; by_status แยกให้
import { useEffect, useId, useMemo, useState } from "react"
import { apiAuth } from "../../../lib/api"
import { cx, cardCls } from "../../../lib/styles"
import SelectDropdown from "../../../components/SelectDropdown"
import { EmptyState, ErrorState, SkeletonStat, Skeleton } from "../../../components/ui"

const MONTHS_TH = ["มกราคม", "กุมภาพันธ์", "มีนาคม", "เมษายน", "พฤษภาคม", "มิถุนายน", "กรกฎาคม", "สิงหาคม", "กันยายน", "ตุลาคม", "พฤศจิกายน", "ธันวาคม"]
const MONTHS_SHORT = ["ม.ค.", "ก.พ.", "มี.ค.", "เม.ย.", "พ.ค.", "มิ.ย.", "ก.ค.", "ส.ค.", "ก.ย.", "ต.ค.", "พ.ย.", "ธ.ค."]
const nf = (n) => Number(n ?? 0).toLocaleString("th-TH")

function fmtHours(h) {
  if (h == null) return "—"
  const v = Number(h)
  if (v >= 48) return `${(v / 24).toLocaleString("th-TH", { maximumFractionDigits: 1 })} วัน`
  return `${v.toLocaleString("th-TH", { maximumFractionDigits: 1 })} ชม.`
}

/** One cell of the summary strip */
function Stat({ label, value, note, tone = "default" }) {
  return (
    <div className="min-w-0 bg-white px-4 py-3 dark:bg-surface">
      <dt className="text-xs font-medium text-gray-500 dark:text-gray-400">{label}</dt>
      <dd className={cx(
        "mt-1 text-2xl font-semibold tabular-nums",
        tone === "danger" ? "text-red-700 dark:text-red-300" : tone === "good" ? "text-emerald-700 dark:text-emerald-300" : "text-gray-900 dark:text-gray-100"
      )}>
        {value}
      </dd>
      {note && <dd className="mt-0.5 text-xs text-gray-500 dark:text-gray-400">{note}</dd>}
    </div>
  )
}

/** Horizontal bar list — label, bar, count. Values stay readable as text. */
function BarList({ title, items, emptyText = "ไม่มีข้อมูล" }) {
  const max = Math.max(1, ...items.map((i) => i.count))
  const hid = useId()
  return (
    <section className={cx(cardCls, "p-4")} aria-labelledby={hid}>
      <h3 id={hid} className="mb-3 text-sm font-semibold text-gray-900 dark:text-gray-100">{title}</h3>
      {items.length === 0 ? (
        <p className="text-sm text-gray-500 dark:text-gray-400">{emptyText}</p>
      ) : (
        <ul className="space-y-2.5">
          {items.map((i) => (
            <li key={i.key} className="grid grid-cols-[minmax(0,9rem)_1fr_2.5rem] items-center gap-3 text-sm">
              <span className="truncate text-gray-700 dark:text-gray-300" title={i.label}>
                {i.label}
                {i.sub && <span className="block truncate text-xs text-gray-500 dark:text-gray-400">{i.sub}</span>}
              </span>
              <span aria-hidden="true" className="h-2.5 overflow-hidden rounded-full bg-gray-100 dark:bg-white/[.06]">
                <span className="block h-full rounded-full bg-indigo-500 dark:bg-indigo-400" style={{ width: `${(i.count / max) * 100}%` }} />
              </span>
              <span className="text-right font-semibold tabular-nums text-gray-900 dark:text-gray-100">{nf(i.count)}</span>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}

/** 12 columns for the whole-year view */
function MonthColumns({ data, yearBE }) {
  const max = Math.max(1, ...data.map((d) => d.count))
  return (
    <section className={cx(cardCls, "p-4")} aria-labelledby="issue-by-month">
      <h3 id="issue-by-month" className="mb-3 text-sm font-semibold text-gray-900 dark:text-gray-100">คำร้องรายเดือน ปี {yearBE}</h3>
      <ol className="grid h-44 grid-cols-12 items-end gap-1.5 sm:gap-2.5">
        {data.map((d) => (
          <li key={d.month} className="flex h-full flex-col items-center justify-end gap-1" aria-label={`${MONTHS_TH[d.month - 1]} ${nf(d.count)} คำร้อง`}>
            <span aria-hidden="true" className="text-[11px] font-semibold tabular-nums text-gray-700 dark:text-gray-300">{d.count || ""}</span>
            <span
              aria-hidden="true"
              className={cx("w-full rounded-t-md", d.count ? "bg-indigo-500 dark:bg-indigo-400" : "bg-gray-100 dark:bg-white/[.06]")}
              style={{ height: d.count ? `${Math.max(4, (d.count / max) * 100)}%` : "2px" }}
            />
            <span aria-hidden="true" className="text-[11px] text-gray-500 dark:text-gray-400">{MONTHS_SHORT[d.month - 1]}</span>
          </li>
        ))}
      </ol>
    </section>
  )
}

export default function HRIssueStatsTab() {
  const now = new Date()
  const thisYearBE = now.getFullYear() + 543
  const [yearBE, setYearBE] = useState(String(thisYearBE))
  const [month, setMonth] = useState(String(now.getMonth() + 1)) // "" = ทั้งปี
  const [state, setState] = useState({ status: "loading", data: null, error: "" })
  const [reloadKey, setReloadKey] = useState(0)

  const yearOptions = useMemo(
    () => Array.from({ length: 5 }, (_, i) => String(thisYearBE - i)).map((y) => ({ value: y, label: `พ.ศ. ${y}` })),
    [thisYearBE]
  )
  const monthOptions = useMemo(
    () => [{ value: "", label: "ทั้งปี" }, ...MONTHS_TH.map((m, i) => ({ value: String(i + 1), label: m }))],
    []
  )

  useEffect(() => {
    let alive = true
    setState((s) => ({ ...s, status: "loading", error: "" }))
    const q = new URLSearchParams({ year: yearBE })
    if (month) q.set("month", month)
    apiAuth(`/hr/issue-reports/stats?${q}`)
      .then((data) => alive && setState({ status: "ready", data, error: "" }))
      .catch((e) => alive && setState({ status: "error", data: null, error: e.message || "โหลดสถิติไม่สำเร็จ" }))
    return () => { alive = false }
  }, [yearBE, month, reloadKey])

  const d = state.data
  const periodLabel = month ? `${MONTHS_TH[Number(month) - 1]} ${yearBE}` : `ทั้งปี ${yearBE}`
  const resolved = d?.resolved ?? 0
  const withinPct = resolved ? Math.round(((d?.resolved_within_sla ?? 0) / resolved) * 100) : null

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end gap-2">
        <div className="w-36">
          <label id="issue-stats-year" className="mb-1 block text-xs font-medium text-gray-600 dark:text-gray-400">ปี</label>
          <SelectDropdown size="sm" ariaLabelledby="issue-stats-year" value={yearBE} onChange={setYearBE} options={yearOptions} showSwatch={false} />
        </div>
        <div className="w-40">
          <label id="issue-stats-month" className="mb-1 block text-xs font-medium text-gray-600 dark:text-gray-400">เดือน</label>
          <SelectDropdown size="sm" ariaLabelledby="issue-stats-month" value={month} onChange={setMonth} options={monthOptions} showSwatch={false} />
        </div>
        <p className="pb-2 text-xs text-gray-500 dark:text-gray-400" aria-live="polite">
          {state.status === "ready" ? `นับตามวันที่ส่งคำร้อง · ${periodLabel}` : ""}
        </p>
      </div>

      {state.status === "error" ? (
        <ErrorState message={state.error} onRetry={() => setReloadKey((k) => k + 1)} />
      ) : state.status === "loading" ? (
        <div className="space-y-4" aria-busy="true" aria-label="กำลังโหลดสถิติ">
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            {Array.from({ length: 4 }, (_, i) => <SkeletonStat key={i} />)}
          </div>
          <Skeleton className="h-56 w-full" rounded="rounded-2xl" />
        </div>
      ) : !d || d.total === 0 ? (
        <div className={cx(cardCls, "p-2")}>
          <EmptyState title={`ไม่มีคำร้องใน${month ? "เดือน" : "ปี"}นี้`} description={`ยังไม่มีพนักงานส่งคำร้องแจ้งแก้ไขข้อมูลช่วง ${periodLabel}`} />
        </div>
      ) : (
        <>
          <dl className={cx(cardCls, "grid grid-cols-2 gap-px overflow-hidden !bg-gray-200/70 lg:grid-cols-4 dark:!bg-line-strong")}>
            <Stat
              label="คำร้องทั้งหมด"
              value={nf(d.total)}
              note={`ค้าง ${nf(d.by_status?.pending)} · แก้ไขแล้ว ${nf(d.by_status?.resolved)} · ปฏิเสธ ${nf(d.by_status?.rejected)}`}
            />
            <Stat
              label={`พิจารณาทันกำหนด (${d.sla_days ?? 3} วัน)`}
              value={withinPct == null ? "—" : `${withinPct}%`}
              note={resolved ? `${nf(d.resolved_within_sla)} จาก ${nf(resolved)} คำร้องที่พิจารณาแล้ว` : "ยังไม่มีคำร้องที่พิจารณาแล้ว"}
              tone={withinPct != null && withinPct >= 90 ? "good" : "default"}
            />
            <Stat
              label="ค้างเกินกำหนด"
              value={nf(d.overdue_pending)}
              note={d.overdue_pending ? "ดูได้ที่แท็บคำร้อง › เกินกำหนด" : "ไม่มีคำร้องค้างนาน"}
              tone={d.overdue_pending ? "danger" : "default"}
            />
            <Stat label="เวลาพิจารณาเฉลี่ย" value={fmtHours(d.avg_resolution_hours)} note="นับจากส่งจนอนุมัติ/ปฏิเสธ" />
          </dl>

          {!month && Array.isArray(d.by_month) && <MonthColumns data={d.by_month} yearBE={d.year_be ?? yearBE} />}

          <div className="grid gap-4 lg:grid-cols-2">
            <BarList
              title="ข้อมูลที่แจ้งแก้บ่อย"
              items={(d.by_field || []).slice().sort((a, b) => b.count - a.count).map((f) => ({
                key: `${f.category}:${f.field_name}`, label: f.field_label || f.field_name, count: f.count,
              }))}
            />
            <BarList
              title="ตามสาขา"
              items={(d.by_branch || []).slice().sort((a, b) => b.count - a.count).map((b) => ({
                key: String(b.branch_id ?? "none"), label: b.branch_name || (b.branch_id == null ? "ไม่ระบุสาขา" : `สาขา #${b.branch_id}`), count: b.count,
              }))}
            />
          </div>
          {(d.by_category || []).length > 1 && (
            <BarList
              title="ตามหมวดหมู่"
              items={d.by_category.slice().sort((a, b) => b.count - a.count).map((c) => ({ key: c.category, label: c.category_label || c.category, count: c.count }))}
            />
          )}
        </>
      )}
    </div>
  )
}
