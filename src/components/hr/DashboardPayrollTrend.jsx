// src/components/hr/DashboardPayrollTrend.jsx
// แนวโน้มรายได้รวม (gross) รายเดือน (3H) — GET /hr/dashboard/payroll-trend?months=12[&branch_id]
//
// • เงินเป็น decimal string (TOR 3H §5): parseFloat ใช้คำนวณความสูงแท่งเท่านั้น
//   ตัวเลขที่แสดงจัดรูปจาก string ตรง ๆ (คั่นหลักพัน + ทศนิยม 2 ตำแหน่ง) — ไม่ปัดผ่าน float
// • เดือนที่ไม่มีการจ่ายเงินเดือน (ศูนย์ทั้งหมด) = ช่องว่าง
// • ตัวเลขหลัก/กราฟ/"เทียบเดือนก่อน" ใช้รายได้รวม (total_gross_income) — ลูกค้าขอ พ.ย. 2026
//   backend ส่งแค่ change_net → คำนวณ change_gross / change_gross_pct เองที่หน้าเว็บ (หน่วยสตางค์)
//   = null เมื่อเป็นเดือนแรก / เดือนก่อนไม่มีการจ่าย (กฎเดียวกับ change_net ของ backend) → "—"
// • ข้อมูลครบในตาราง (สลับ "ดูเป็นตาราง") — กราฟเป็น role="img" + สรุปใน aria-label
import { useEffect, useMemo, useState } from "react"
import { ArrowDownRight, ArrowUpRight, ChartColumn, Minus, Table2 } from "lucide-react"
import { apiAuth } from "../../lib/api"
import { DraftBadge } from "./PayrollDraftBadge"
import { isDraftPeriod } from "../../lib/payrollStatus"
import { cx, cardCls, focusRingCls } from "../../lib/styles"
import { useIsPhone } from "../../hooks/useMediaQuery"
import { DataList, EmptyState, ErrorState, Skeleton } from "../ui"
import TrendChart from "../charts/TrendChart"

const MONTH_SHORT = ["ม.ค.", "ก.พ.", "มี.ค.", "เม.ย.", "พ.ค.", "มิ.ย.", "ก.ค.", "ส.ค.", "ก.ย.", "ต.ค.", "พ.ย.", "ธ.ค."]
const MONTH_LONG = ["มกราคม", "กุมภาพันธ์", "มีนาคม", "เมษายน", "พฤษภาคม", "มิถุนายน", "กรกฎาคม", "สิงหาคม", "กันยายน", "ตุลาคม", "พฤศจิกายน", "ธันวาคม"]

/** "2329730.75" → "2,329,730.75" (จาก string ตรง ๆ) · null/"" → "—" */
function fmtDecimal(v, digits = 2) {
  if (v == null || v === "") return "—"
  const s = String(v).trim()
  const m = /^([+-]?)(\d*)(?:\.(\d*))?$/.exec(s)
  if (!m) return s
  const [, sign, int = "", frac = ""] = m
  const grouped = (int.replace(/^0+(?=\d)/, "") || "0").replace(/\B(?=(\d{3})+(?!\d))/g, ",")
  const dec = digits > 0 ? "." + (frac + "0".repeat(digits)).slice(0, digits) : ""
  return `${sign === "-" ? "-" : ""}${grouped}${dec}`
}

const num = (v) => {
  const n = parseFloat(v)
  return Number.isFinite(n) ? n : 0
}

const compact = new Intl.NumberFormat("th-TH", { notation: "compact", maximumFractionDigits: 1 })
const beYear = (y) => Number(y) + 543
const monthLabel = (r) => `${MONTH_SHORT[r.month - 1] ?? r.month} ${beYear(r.year)}`
const monthLong = (r) => `${MONTH_LONG[r.month - 1] ?? r.month} ${beYear(r.year)}`

function isEmptyMonth(r) {
  return num(r.total_net_payout) === 0 && num(r.total_gross_income) === 0 && !Number(r.employees_processed)
}

const toSatang = (v) => Math.round(num(v) * 100)

/** เติม change_gross / change_gross_pct (string ทศนิยม 2 ตำแหน่ง) เทียบกับเดือนก่อนหน้าที่ติดกัน */
function withGrossChange(list) {
  return list.map((r, i) => {
    const prev = i > 0 ? list[i - 1] : null
    if (!prev || isEmptyMonth(r) || isEmptyMonth(prev)) return { ...r, change_gross: null, change_gross_pct: null }
    const cur = toSatang(r.total_gross_income)
    const before = toSatang(prev.total_gross_income)
    const diff = cur - before
    return {
      ...r,
      change_gross: (diff / 100).toFixed(2),
      change_gross_pct: before === 0 ? null : ((diff / before) * 100).toFixed(2),
    }
  })
}

/** ป้ายการเปลี่ยนแปลง — สีกลาง (เงินเดือนขึ้น/ลงไม่ใช่ดี/ร้าย) ทิศบอกด้วยไอคอน + เครื่องหมาย */
function ChangeBadge({ change, pct, className = "" }) {
  if (change == null && pct == null) {
    return <span className={cx("text-xs text-gray-500 dark:text-gray-400", className)}>ไม่มีเดือนก่อนให้เทียบ</span>
  }
  const dir = num(change ?? pct)
  const Icon = dir > 0 ? ArrowUpRight : dir < 0 ? ArrowDownRight : Minus
  const sign = dir > 0 ? "+" : ""
  return (
    <span className={cx("inline-flex items-center gap-1 rounded-md bg-gray-100 px-1.5 py-0.5 text-xs font-medium tabular-nums text-gray-700 dark:bg-white/[.07] dark:text-gray-200", className)}>
      <Icon aria-hidden="true" className="size-3.5" strokeWidth={2} />
      {change != null && <span>{sign}{fmtDecimal(change)}</span>}
      {pct != null && <span className="text-gray-500 dark:text-gray-400">({sign}{fmtDecimal(pct)}%)</span>}
    </span>
  )
}

function TooltipBody({ r }) {
  if (isEmptyMonth(r)) {
    return (
      <>
        <p className="font-semibold text-gray-900 dark:text-gray-100">{monthLong(r)}</p>
        <p className="mt-1 text-gray-500 dark:text-gray-400">ไม่มีการจ่ายเงินเดือน</p>
      </>
    )
  }
  const rows = [
    ["รายการหัก", fmtDecimal(r.total_deductions)],
    ["สุทธิ", fmtDecimal(r.total_net_payout)],
    ["จำนวนคน", `${Number(r.employees_processed || 0).toLocaleString("th-TH")} คน`],
  ]
  return (
    <>
      <p className="flex items-center justify-between gap-3">
        <span className="font-semibold text-gray-900 dark:text-gray-100">{monthLong(r)}</span>
        {r.period_status_label && <span className="text-gray-500 dark:text-gray-400">{r.period_status_label}</span>}
      </p>
      <p className="mt-1.5 text-sm font-semibold tabular-nums text-gray-900 dark:text-gray-100">
        {fmtDecimal(r.total_gross_income)} <span className="text-xs font-normal text-gray-500 dark:text-gray-400">บาท รายได้รวม</span>
      </p>
      <dl className="mt-1.5 grid grid-cols-[auto_auto] gap-x-4 gap-y-0.5">
        {rows.map(([k, v]) => (
          <div key={k} className="contents">
            <dt className="text-gray-500 dark:text-gray-400">{k}</dt>
            <dd className="text-right tabular-nums text-gray-800 dark:text-gray-200">{v}</dd>
          </div>
        ))}
      </dl>
      <div className="mt-2 border-t border-gray-100 pt-1.5 dark:border-line">
        <ChangeBadge change={r.change_gross} pct={r.change_gross_pct} />
      </div>
    </>
  )
}

function TrendTable({ rows }) {
  const isPhone = useIsPhone()
  const newestFirst = [...rows].reverse()
  if (isPhone) {
    return (
      <DataList
        items={newestFirst}
        keyOf={(r) => `${r.year}-${r.month}`}
        title={(r) => monthLong(r)}
        subtitle={(r) => (isEmptyMonth(r) ? "ไม่มีการจ่ายเงินเดือน" : r.period_status_label || null)}
        fields={(r) =>
          isEmptyMonth(r)
            ? []
            : [
                { label: "รายได้รวม", value: () => fmtDecimal(r.total_gross_income), align: "right", emphasis: true },
                { label: "รายการหัก", value: () => fmtDecimal(r.total_deductions), align: "right" },
                { label: "สุทธิ", value: () => fmtDecimal(r.total_net_payout), align: "right" },
                { label: "จำนวนคน", value: () => Number(r.employees_processed || 0).toLocaleString("th-TH"), align: "right" },
                { label: "เทียบเดือนก่อน", value: () => <ChangeBadge change={r.change_gross} pct={r.change_gross_pct} />, span: 2 },
              ]
        }
      />
    )
  }
  const th = "px-3 py-2 text-xs font-semibold text-gray-600 dark:text-gray-300"
  const td = "px-3 py-2 tabular-nums"
  return (
    <div className="overflow-x-auto rounded-xl ring-1 ring-gray-200/70 dark:ring-line">
      <table className="w-full min-w-[720px] text-sm">
        <caption className="sr-only">เงินเดือนรายเดือน (บาท) เรียงจากเดือนล่าสุด</caption>
        <thead className="bg-gray-50 dark:bg-white/[.03]">
          <tr>
            <th scope="col" className={cx(th, "text-left")}>เดือน</th>
            <th scope="col" className={cx(th, "text-left")}>สถานะงวด</th>
            <th scope="col" className={cx(th, "text-right")}>จำนวนคน</th>
            <th scope="col" className={cx(th, "text-right")}>รายได้รวม</th>
            <th scope="col" className={cx(th, "text-right")}>รายการหัก</th>
            <th scope="col" className={cx(th, "text-right")}>สุทธิ</th>
            <th scope="col" className={cx(th, "text-right")}>เทียบเดือนก่อน</th>
          </tr>
        </thead>
        <tbody className="text-gray-800 dark:text-gray-200">
          {newestFirst.map((r) => {
            const empty = isEmptyMonth(r)
            return (
              <tr key={`${r.year}-${r.month}`} className="border-t border-gray-100 even:bg-gray-50 dark:border-line dark:even:bg-gray-700/30">
                <th scope="row" className="px-3 py-2 text-left font-medium">{monthLabel(r)}</th>
                {empty ? (
                  <td colSpan={6} className="px-3 py-2 text-gray-500 dark:text-gray-400">ไม่มีการจ่ายเงินเดือน</td>
                ) : (
                  <>
                    <td className="px-3 py-2">{r.period_status_label || "—"}</td>
                    <td className={cx(td, "text-right")}>{Number(r.employees_processed || 0).toLocaleString("th-TH")}</td>
                    <td className={cx(td, "text-right font-semibold text-gray-900 dark:text-gray-100")}>{fmtDecimal(r.total_gross_income)}</td>
                    <td className={cx(td, "text-right")}>{fmtDecimal(r.total_deductions)}</td>
                    <td className={cx(td, "text-right")}>{fmtDecimal(r.total_net_payout)}</td>
                    <td className={cx(td, "text-right")}>
                      {r.change_gross == null && r.change_gross_pct == null ? "—" : <ChangeBadge change={r.change_gross} pct={r.change_gross_pct} />}
                    </td>
                  </>
                )}
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

export default function DashboardPayrollTrend({ branchId = null, months = 12, className = "" }) {
  const [rows, setRows] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [reload, setReload] = useState(0)
  const [asTable, setAsTable] = useState(false)

  useEffect(() => {
    let alive = true
    setLoading(true)
    setError("")
    const q = new URLSearchParams({ months: String(months) })
    if (branchId != null) q.set("branch_id", String(branchId))
    apiAuth(`/hr/dashboard/payroll-trend?${q}`)
      .then((d) => { if (alive) setRows(withGrossChange(Array.isArray(d?.months) ? d.months : [])) })
      .catch((e) => {
        if (!alive) return
        setRows(null)
        setError(e?.message || "โหลดแนวโน้มเงินเดือนไม่สำเร็จ")
      })
      .finally(() => { if (alive) setLoading(false) })
    return () => { alive = false }
  }, [branchId, months, reload])

  const latest = useMemo(() => (rows ? [...rows].reverse().find((r) => !isEmptyMonth(r)) ?? null : null), [rows])

  const items = useMemo(
    () =>
      (rows ?? []).map((r, i) => ({
        key: `${r.year}-${r.month}`,
        value: num(r.total_gross_income),
        label: MONTH_SHORT[r.month - 1] ?? String(r.month),
        subLabel: i === 0 || r.month === 1 ? String(beYear(r.year)) : null,
        empty: isEmptyMonth(r),
        highlight: latest != null && r === latest,
        row: r,
      })),
    [rows, latest],
  )

  const ariaLabel = useMemo(() => {
    if (!rows?.length) return "กราฟรายได้รวมรายเดือน — ไม่มีข้อมูล"
    const paid = rows.filter((r) => !isEmptyMonth(r))
    const first = rows[0]
    const last = rows[rows.length - 1]
    const parts = [`กราฟแท่งรายได้รวมรายเดือน ${monthLong(first)} ถึง ${monthLong(last)}`]
    if (latest) parts.push(`ล่าสุด ${monthLong(latest)} ${fmtDecimal(latest.total_gross_income)} บาท`)
    if (paid.length) {
      const max = paid.reduce((a, b) => (num(b.total_gross_income) > num(a.total_gross_income) ? b : a))
      parts.push(`สูงสุด ${monthLong(max)} ${fmtDecimal(max.total_gross_income)} บาท`)
    }
    const gaps = rows.length - paid.length
    if (gaps) parts.push(`ไม่มีการจ่าย ${gaps} เดือน`)
    parts.push("ดูตัวเลขทั้งหมดได้จากปุ่มดูเป็นตาราง")
    return parts.join(" · ")
  }, [rows, latest])

  const toggleCls = cx(
    "inline-flex h-11 items-center gap-1.5 rounded-lg px-2.5 text-xs font-medium text-gray-600 hover:bg-gray-100 hover:text-gray-900 md:pointer-fine:h-8 cursor-pointer transition-colors duration-150",
    "dark:text-gray-300 dark:hover:bg-white/[.06] dark:hover:text-gray-100",
    focusRingCls,
  )

  return (
    <section aria-labelledby="hr-trend-title" className={cx(cardCls, "min-w-0 p-4 lg:p-5", className)}>
      <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-2">
        <div className="min-w-0">
          <h3 id="hr-trend-title" className="text-sm font-semibold text-gray-900 dark:text-gray-100">
            รายได้รวม {months} เดือนล่าสุด
          </h3>
          {loading && !rows ? (
            <Skeleton rounded="rounded-md" className="mt-2 h-6 w-48" />
          ) : latest ? (
            <div className="mt-1 flex flex-wrap items-baseline gap-x-2 gap-y-1">
              <span className="text-xl font-semibold tabular-nums text-gray-900 dark:text-gray-100">{fmtDecimal(latest.total_gross_income)}</span>
              <span className="text-xs text-gray-500 dark:text-gray-400">บาท · {monthLong(latest)}</span>
              {isDraftPeriod(latest.period_status) && <DraftBadge />}
              <ChangeBadge change={latest.change_gross} pct={latest.change_gross_pct} />
            </div>
          ) : null}
        </div>
        {rows?.length > 0 && (
          <button type="button" onClick={() => setAsTable((v) => !v)} className={toggleCls}>
            {asTable ? <ChartColumn aria-hidden="true" className="size-4" strokeWidth={1.75} /> : <Table2 aria-hidden="true" className="size-4" strokeWidth={1.75} />}
            {asTable ? "ดูเป็นกราฟ" : "ดูเป็นตาราง"}
          </button>
        )}
      </div>

      <div className={cx("mt-4 transition-opacity duration-200", loading && rows && "opacity-60")} aria-busy={loading}>
        {error ? (
          <ErrorState message={error} onRetry={() => setReload((k) => k + 1)} />
        ) : loading && !rows ? (
          <Skeleton rounded="rounded-xl" className="h-[220px] w-full" />
        ) : !latest ? (
          <EmptyState title="ยังไม่มีข้อมูลเงินเดือน" description={`ไม่พบการจ่ายเงินเดือนใน ${months} เดือนที่ผ่านมา`} className="!py-8" />
        ) : asTable ? (
          <TrendTable rows={rows} />
        ) : (
          <TrendChart
            items={items}
            ariaLabel={ariaLabel}
            formatTick={(v) => (v === 0 ? "0" : compact.format(v))}
            renderTooltip={(it) => <TooltipBody r={it.row} />}
          />
        )}
      </div>
    </section>
  )
}
