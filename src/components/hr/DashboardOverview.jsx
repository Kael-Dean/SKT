// src/components/hr/DashboardOverview.jsx
// ภาพรวมบนหน้า HR dashboard (3H) — ใต้แถบตัวเลขสรุป
//
//   <DashboardOverview stats={GET /hr/dashboard} loading error branchId branchOptions onBranchChange
//     showStatus={can("hr.dashboard.view")} showTrend={…} />
//
// • ตัวกรองสาขา: "ทุกสาขา" = ไม่ส่ง branch_id · ตัวเลือกจาก /auth/my-branches (scope own_branch)
//   หรือรายชื่อสาขาทั้งหมด (scope all) — หน้าแม่เป็นเจ้าของ state เพราะแถบตัวเลขสรุปใช้ branch_id เดียวกัน
// • สถานะพนักงาน: status_breakdown (ปีงบประมาณ 1 เม.ย. – 31 มี.ค.) · ไม่แสดงทดลองงาน (ระเบียบไม่มี — รอ AMC)
// • พนักงานต่อสาขา: employees_per_branch เรียงมาก → น้อย
// • ซ่อน/แสดงทั้งส่วนได้ (จำใน localStorage) — HR เปิดหน้านี้ทั้งวัน ไม่ต้องเลื่อนผ่านทุกครั้ง
import { useMemo, useState } from "react"
import { ChevronDown } from "lucide-react"
import { cx, cardCls, focusRingCls } from "../../lib/styles"
import SelectDropdown from "../SelectDropdown"
import { EmptyState, ErrorState, Skeleton } from "../ui"
import DashboardPayrollTrend from "./DashboardPayrollTrend"

export const ALL_BRANCHES = "all"
const COLLAPSE_KEY = "hr.dashboard.overview.collapsed"

const nf = (n) => Number(n || 0).toLocaleString("th-TH")

function readCollapsed() {
  try { return localStorage.getItem(COLLAPSE_KEY) === "1" } catch { return false }
}

/* ───────────────────────── สถานะพนักงาน ───────────────────────── */

function StatRow({ label, value, unit = "คน", children }) {
  return (
    <div className="py-2.5">
      <div className="flex items-baseline justify-between gap-3">
        <dt className="text-sm text-gray-600 dark:text-gray-300">{label}</dt>
        <dd className="shrink-0 text-sm font-semibold tabular-nums text-gray-900 dark:text-gray-100">
          {value == null ? <span className="font-normal text-gray-500 dark:text-gray-400">—</span> : <>{nf(value)} <span className="text-xs font-normal text-gray-500 dark:text-gray-400">{unit}</span></>}
        </dd>
      </div>
      {children}
    </div>
  )
}

function StatusCard({ data }) {
  const types = Array.isArray(data?.by_employment_type) ? data.by_employment_type : []
  const reasons = Array.isArray(data?.terminated_by_reason) ? data.terminated_by_reason.filter((r) => Number(r.count) > 0) : []
  const totalTyped = types.reduce((s, t) => s + Number(t.count || 0), 0)
  const fy = data?.fiscal_year

  return (
    <section aria-labelledby="hr-status-title" className={cx(cardCls, "min-w-0 p-4 lg:p-5")}>
      <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
        <h3 id="hr-status-title" className="text-sm font-semibold text-gray-900 dark:text-gray-100">สถานะพนักงาน</h3>
        {fy && <span className="text-xs text-gray-500 dark:text-gray-400">ปีงบประมาณ {fy} (เม.ย.–มี.ค.)</span>}
      </div>

      {!data ? (
        <p className="mt-3 text-sm text-gray-500 dark:text-gray-400">ระบบยังไม่ส่งข้อมูลสถานะพนักงาน</p>
      ) : (
        <>
          <h4 className="mt-4 text-xs font-medium text-gray-500 dark:text-gray-400">ตามประเภทการจ้าง</h4>
          {types.length === 0 ? (
            <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">ไม่มีข้อมูล</p>
          ) : (
            <ul className="mt-2 space-y-2">
              {types.map((t) => {
                const c = Number(t.count || 0)
                const pct = totalTyped ? (c / totalTyped) * 100 : 0
                return (
                  <li key={t.employment_type ?? t.label}>
                    <div className="flex items-baseline justify-between gap-3 text-sm">
                      <span className="min-w-0 truncate text-gray-700 dark:text-gray-200">{t.label || t.employment_type}</span>
                      <span className="shrink-0 font-semibold tabular-nums text-gray-900 dark:text-gray-100">{nf(c)}</span>
                    </div>
                    <div aria-hidden="true" className="mt-1 h-1.5 overflow-hidden rounded-full bg-gray-100 dark:bg-white/[.06]">
                      <div className="h-full rounded-full bg-indigo-500 dark:bg-indigo-400" style={{ width: `${pct}%` }} />
                    </div>
                  </li>
                )
              })}
            </ul>
          )}

          <dl className="mt-4 divide-y divide-gray-100 border-t border-gray-100 dark:divide-line dark:border-line">
            <StatRow label="พักงานวันนี้" value={data.suspended_today} />
            <StatRow label="พ้นสภาพในปีงบประมาณ" value={data.terminated_this_fy}>
              {reasons.length > 0 && (
                <ul className="mt-1 flex flex-wrap gap-x-3 gap-y-0.5 text-xs text-gray-500 dark:text-gray-400">
                  {reasons.map((r) => (
                    <li key={r.reason ?? r.label}>
                      {r.label || r.reason} <span className="tabular-nums text-gray-700 dark:text-gray-300">{nf(r.count)}</span>
                    </li>
                  ))}
                </ul>
              )}
            </StatRow>
            <StatRow label="เกษียณในปีงบประมาณ" value={data.retiring_this_fy} />
            <StatRow label="บัญชีผู้ใช้ใหม่" value={data.new_accounts} unit="บัญชี" />
          </dl>
        </>
      )}
    </section>
  )
}

/* ───────────────────────── พนักงานต่อสาขา ───────────────────────── */

function BranchBars({ rows }) {
  const sorted = useMemo(
    () => [...(Array.isArray(rows) ? rows : [])].sort((a, b) => Number(b.count || 0) - Number(a.count || 0) || String(a.branch_name).localeCompare(String(b.branch_name), "th")),
    [rows],
  )
  const max = Math.max(1, ...sorted.map((r) => Number(r.count || 0)))
  const total = sorted.reduce((s, r) => s + Number(r.count || 0), 0)

  return (
    <section aria-labelledby="hr-branch-title" className={cx(cardCls, "min-w-0 p-4 lg:p-5")}>
      <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
        <h3 id="hr-branch-title" className="text-sm font-semibold text-gray-900 dark:text-gray-100">พนักงานต่อสาขา</h3>
        {sorted.length > 0 && (
          <span className="text-xs tabular-nums text-gray-500 dark:text-gray-400">{sorted.length} สาขา · รวม {nf(total)} คน</span>
        )}
      </div>
      {sorted.length === 0 ? (
        <EmptyState title="ไม่มีข้อมูลพนักงานต่อสาขา" className="!py-8" />
      ) : (
        // tabIndex: กล่องเลื่อนได้ต้องเลื่อนด้วยคีย์บอร์ดได้ (Safari ไม่ให้โฟกัส scroller เอง)
        <ul tabIndex={0} aria-labelledby="hr-branch-title" className={cx("mt-4 max-h-[22rem] space-y-2.5 overflow-y-auto rounded-lg pr-1", focusRingCls)}>
          {sorted.map((r) => {
            const c = Number(r.count || 0)
            return (
              <li key={r.branch_id ?? r.branch_name} className="grid grid-cols-[minmax(0,9rem)_minmax(0,1fr)_auto] items-center gap-3 text-sm sm:grid-cols-[minmax(0,12rem)_minmax(0,1fr)_auto]">
                <span className="truncate text-gray-700 dark:text-gray-200" title={r.branch_name}>{r.branch_name || `สาขา ${r.branch_id}`}</span>
                <span aria-hidden="true" className="h-2 rounded-full bg-gray-100 dark:bg-white/[.06]">
                  <span className="block h-full rounded-full bg-indigo-500 dark:bg-indigo-400" style={{ width: `${(c / max) * 100}%` }} />
                </span>
                <span className="w-10 text-right font-semibold tabular-nums text-gray-900 dark:text-gray-100">{nf(c)}</span>
              </li>
            )
          })}
        </ul>
      )}
    </section>
  )
}

function CardSkeleton() {
  return (
    <div aria-hidden="true" className={cx(cardCls, "space-y-3 p-4 lg:p-5")}>
      <Skeleton rounded="rounded-md" className="h-4 w-32" />
      {[0, 1, 2, 3, 4].map((i) => <Skeleton key={i} rounded="rounded-md" className="h-3.5 w-full" />)}
    </div>
  )
}

/* ───────────────────────── section ───────────────────────── */

export default function DashboardOverview({
  stats,
  loading = false,
  error = "",
  onRetry,
  branch = ALL_BRANCHES,
  branchOptions = [],
  branchesLoading = false,
  scoped = false,
  onBranchChange,
  showStatus = true,
  showTrend = true,
}) {
  const [collapsed, setCollapsed] = useState(readCollapsed)
  const toggle = () => {
    setCollapsed((c) => {
      try { localStorage.setItem(COLLAPSE_KEY, c ? "0" : "1") } catch { /* private mode */ }
      return !c
    })
  }
  const branchId = branch === ALL_BRANCHES ? null : Number(branch)

  return (
    <section aria-labelledby="hr-overview-title" className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
        <h2 id="hr-overview-title" className="text-base font-semibold text-gray-900 dark:text-gray-100">
          <button
            type="button"
            onClick={toggle}
            aria-expanded={!collapsed}
            aria-controls={collapsed ? undefined : "hr-overview-body"}
            className={cx("-ml-1 inline-flex min-h-11 items-center gap-1.5 rounded-lg px-1 text-left cursor-pointer md:min-h-9", focusRingCls)}
          >
            <ChevronDown aria-hidden="true" className={cx("size-4 text-gray-500 transition-transform duration-200 dark:text-gray-400", collapsed && "-rotate-90")} strokeWidth={2} />
            ภาพรวมบุคลากร
          </button>
        </h2>
        <div className="flex w-full items-center gap-2 sm:w-auto">
          <label htmlFor="hr-overview-branch" className="shrink-0 text-sm text-gray-600 dark:text-gray-300">สาขา</label>
          <div className="min-w-0 flex-1 sm:w-64 sm:flex-none">
            <SelectDropdown
              id="hr-overview-branch"
              size="sm"
              options={[{ value: ALL_BRANCHES, label: scoped ? "ทุกสาขาที่ดูแล" : "ทุกสาขา" }, ...branchOptions]}
              value={branch}
              onChange={(v) => onBranchChange?.(v || ALL_BRANCHES)}
              searchable={branchOptions.length > 8}
              searchPlaceholder="ค้นหาสาขา"
              showSwatch={false}
              loading={branchesLoading}
            />
          </div>
        </div>
      </div>

      {!collapsed && (
        <div id="hr-overview-body" className="space-y-3">
          {showStatus && (
            error ? (
              <ErrorState message={error} onRetry={onRetry} />
            ) : loading && !stats ? (
              <div className="grid gap-3 lg:grid-cols-5">
                <div className="lg:col-span-2"><CardSkeleton /></div>
                <div className="lg:col-span-3"><CardSkeleton /></div>
              </div>
            ) : (
              <div className={cx("grid items-start gap-3 transition-opacity duration-200 lg:grid-cols-5", loading && "opacity-60")} aria-busy={loading}>
                <div className="min-w-0 lg:col-span-2"><StatusCard data={stats?.status_breakdown} /></div>
                <div className="min-w-0 lg:col-span-3"><BranchBars rows={stats?.employees_per_branch} /></div>
              </div>
            )
          )}
          {showTrend && <DashboardPayrollTrend branchId={branchId} />}
        </div>
      )}
    </section>
  )
}
