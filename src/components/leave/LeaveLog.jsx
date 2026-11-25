// src/components/leave/LeaveLog.jsx
// ประวัติการลารายครั้งของพนักงานหนึ่งคน — ใช้ทั้งฝั่งพนักงาน (GET /personnel/me/leaves) และ HR (GET /hr/employees/{id}/leaves)
// แสดงทุกสถานะรวมใบที่ยกเลิก (เก็บไว้ตรวจสอบ) · "ครั้งที่" นับเฉพาะใบที่อนุมัติแล้ว (ใบที่ยกเลิก/ไม่อนุมัติไม่นับเป็นการลา)
import { useEffect, useMemo, useState } from "react"
import { apiAuth } from "../../lib/api"
import { cx } from "../../lib/styles"
import { statusLabel, statusTone, isPendingStatus } from "../../lib/approval"
import { currentFiscalYearBE, fmtDays, fmtLeaveRowDuration, parseDays } from "../../lib/leaveDays"
import { useIsPhone } from "../../hooks/useMediaQuery"
import SelectDropdown from "../SelectDropdown"
import { CancelledNote } from "../LeaveCancel"
import { EmptyState, ErrorState, PageLoader } from "../ui"

const pill = "inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold whitespace-nowrap"

/** กลุ่มสถานะสำหรับตัวกรอง */
function group(s) {
  if (s === "approved") return "approved"
  if (s === "cancelled") return "cancelled"
  if (s === "rejected" || s === "denied") return "rejected"
  if (s === "pending" || isPendingStatus(s)) return "pending"
  return "other"
}

const FILTERS = [
  { key: "all", label: "ทั้งหมด" },
  { key: "approved", label: "อนุมัติ" },
  { key: "pending", label: "รออนุมัติ" },
  { key: "rejected", label: "ไม่อนุมัติ" },
  { key: "cancelled", label: "ยกเลิก" },
]

function fmtDate(d) {
  if (!d) return "—"
  try { return new Date(d).toLocaleDateString("th-TH", { day: "numeric", month: "short", year: "2-digit" }) } catch { return d }
}

function dateRange(r) {
  const a = fmtDate(r.from_date)
  const b = fmtDate(r.to_date)
  return a === b ? a : `${a} – ${b}`
}

const timeText = (r) => (r.from_time || r.to_time ? `${String(r.from_time ?? "").slice(0, 5) || "—"}–${String(r.to_time ?? "").slice(0, 5) || "—"} น.` : null)

function StatusPill({ status }) {
  return <span className={cx(pill, statusTone(status))}>{statusLabel(status)}</span>
}

/**
 * @param {string}  endpoint   เช่น "/personnel/me/leaves" หรือ `/hr/employees/${id}/leaves` (null = ยังไม่เลือกคน)
 * @param {number}  [year]     ปีงบ พ.ศ. (null = ทุกปี) — ควบคุมจากภายนอกได้ผ่าน onYearChange
 * @param {node}    [toolbar]  ช่องเลือกเพิ่มเติม (เช่น เลือกพนักงานฝั่ง HR) วางหน้าช่องปีงบ
 */
export default function LeaveLog({ endpoint, year, onYearChange, toolbar, emptyHint }) {
  const isPhone = useIsPhone()
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")
  const [attempt, setAttempt] = useState(0)
  const [filter, setFilter] = useState("all")

  const fy = currentFiscalYearBE()
  const yearOptions = useMemo(
    () => [{ value: "all", label: "ทุกปี" }, ...Array.from({ length: 6 }, (_, i) => ({ value: String(fy - i), label: `ปีงบประมาณ ${fy - i}` }))],
    [fy],
  )

  useEffect(() => {
    if (!endpoint) { setRows([]); return }
    let alive = true
    setLoading(true)
    setError("")
    apiAuth(year ? `${endpoint}?year=${year}` : endpoint)
      .then((d) => { if (alive) setRows(Array.isArray(d) ? d : []) })
      .catch((e) => { if (alive && !e?.onboardingRequired) setError(e.message || "โหลดประวัติการลาไม่สำเร็จ") })
      .finally(() => { if (alive) setLoading(false) })
    return () => { alive = false }
  }, [endpoint, year, attempt])

  // เรียงตามวันที่ลา เก่า → ใหม่ เพื่อนับ "ครั้งที่" แล้วแสดงใหม่ → เก่า
  const { list, counts, summary } = useMemo(() => {
    const asc = [...rows].sort((a, b) => String(a.from_date).localeCompare(String(b.from_date)) || (a.id - b.id))
    let n = 0
    const numbered = asc.map((r) => ({ ...r, _no: r.status === "approved" ? ++n : null, _group: group(r.status) }))
    const counts = { all: numbered.length, approved: 0, pending: 0, rejected: 0, cancelled: 0 }
    const byType = new Map()
    let days = 0
    for (const r of numbered) {
      if (counts[r._group] != null) counts[r._group] += 1
      if (r._group === "approved") {
        const d = parseDays(r.total_days) ?? 0
        days += d
        const k = r.leave_type_name || "อื่น ๆ"
        const t = byType.get(k) ?? { name: k, times: 0, days: 0 }
        t.times += 1
        t.days += d
        byType.set(k, t)
      }
    }
    return { list: numbered.reverse(), counts, summary: { times: n, days, byType: [...byType.values()].sort((a, b) => b.times - a.times) } }
  }, [rows])

  const shown = filter === "all" ? list : list.filter((r) => r._group === filter)

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end gap-3">
        {toolbar}
        <div className="w-full min-w-0 sm:w-56">
          <label htmlFor="leave-log-year" className="mb-1.5 block text-xs font-medium text-gray-600 dark:text-gray-400">ช่วงเวลา</label>
          <SelectDropdown
            id="leave-log-year"
            options={yearOptions}
            value={year ? String(year) : "all"}
            onChange={(v) => onYearChange?.(v === "all" ? null : Number(v))}
            showSwatch={false}
          />
        </div>
      </div>

      {!endpoint ? (
        <EmptyState title="เลือกพนักงาน" description={emptyHint || "เลือกพนักงานเพื่อดูการลาเป็นรายครั้ง"} />
      ) : error ? (
        <ErrorState message={error} onRetry={() => setAttempt((x) => x + 1)} />
      ) : loading ? (
        <PageLoader variant="cards" rows={3} message="กำลังโหลดประวัติการลา…" />
      ) : (
        <>
          {/* สรุป — ลากี่ครั้ง กี่วัน แยกประเภท */}
          <section aria-label="สรุปการลา" className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-gray-200/70 dark:bg-surface dark:ring-line">
            <p className="text-sm text-gray-600 dark:text-gray-400">
              {year ? `ปีงบประมาณ ${year}` : "ทุกปี"} · ลาที่อนุมัติแล้ว
            </p>
            <p className="mt-1 text-2xl font-bold text-gray-900 dark:text-gray-50">
              <span className="tabular-nums">{summary.times}</span> ครั้ง
              <span className="mx-2 font-normal text-gray-300 dark:text-gray-600">·</span>
              <span className="tabular-nums">{fmtDays(summary.days)}</span> วัน
            </p>
            {summary.byType.length > 0 && (
              <ul className="mt-3 flex flex-wrap gap-x-5 gap-y-1.5 text-sm">
                {summary.byType.map((t) => (
                  <li key={t.name} className="text-gray-700 dark:text-gray-300">
                    {t.name} <span className="font-semibold tabular-nums text-gray-900 dark:text-gray-100">{t.times}</span> ครั้ง
                    <span className="text-gray-500 dark:text-gray-400"> ({fmtDays(t.days)} วัน)</span>
                  </li>
                ))}
              </ul>
            )}
          </section>

          {/* ตัวกรองสถานะ */}
          <div role="group" aria-label="กรองตามสถานะ" className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1">
            {FILTERS.map((f) => {
              const active = filter === f.key
              return (
                <button
                  key={f.key}
                  type="button"
                  aria-pressed={active}
                  onClick={() => setFilter(f.key)}
                  className={cx(
                    "inline-flex min-h-touch shrink-0 cursor-pointer items-center gap-1.5 rounded-full px-3.5 text-sm font-medium transition-colors duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 md:min-h-9",
                    active
                      ? "bg-indigo-600 text-white dark:bg-indigo-500"
                      : "bg-white text-gray-700 ring-1 ring-gray-200 hover:bg-gray-50 dark:bg-surface dark:text-gray-300 dark:ring-line dark:hover:bg-raised",
                  )}
                >
                  {f.label}
                  <span className={cx("tabular-nums text-xs", active ? "text-indigo-100" : "text-gray-500 dark:text-gray-400")}>{counts[f.key]}</span>
                </button>
              )
            })}
          </div>

          {shown.length === 0 ? (
            <EmptyState
              title={rows.length === 0 ? "ยังไม่มีการลา" : "ไม่มีรายการในสถานะนี้"}
              description={rows.length === 0 ? (year ? `ไม่พบใบลาในปีงบประมาณ ${year}` : "ยังไม่เคยยื่นใบลา") : "ลองเลือกสถานะอื่น"}
            />
          ) : isPhone ? (
            <ol className="space-y-3">
              {shown.map((r) => (
                <li key={r.id} className={cx("rounded-2xl bg-white p-4 shadow-sm ring-1 ring-gray-200/70 dark:bg-surface dark:ring-line", r._group === "cancelled" && "opacity-90")}>
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-xs font-medium text-gray-500 dark:text-gray-400">{r._no ? `ครั้งที่ ${r._no}` : "ไม่นับเป็นการลา"}</p>
                      <p className={cx("mt-0.5 font-semibold text-gray-900 dark:text-gray-100", r._group === "cancelled" && "line-through decoration-gray-400")}>{dateRange(r)}</p>
                      {timeText(r) && <p className="text-xs text-gray-500 dark:text-gray-400">{timeText(r)}</p>}
                    </div>
                    <StatusPill status={r.status} />
                  </div>
                  <p className="mt-2 text-sm text-gray-700 dark:text-gray-300">
                    {r.leave_type_name ?? "—"} · <span className="font-semibold tabular-nums">{fmtLeaveRowDuration(r)}</span>
                  </p>
                  {r.comment && <p className="mt-1 break-words text-sm text-gray-500 dark:text-gray-400">เหตุผล: {r.comment}</p>}
                  <CancelledNote leave={r} className="mt-2" />
                </li>
              ))}
            </ol>
          ) : (
            <div className="overflow-x-auto rounded-2xl bg-white shadow-sm ring-1 ring-gray-200/70 dark:bg-surface dark:ring-line">
              <table className="w-full text-left text-sm">
                <caption className="sr-only">ประวัติการลารายครั้ง</caption>
                <thead className="bg-gray-50 text-xs text-gray-500 dark:bg-gray-700/40 dark:text-gray-400">
                  <tr>
                    <th scope="col" className="px-4 py-2.5 font-medium">ครั้งที่</th>
                    <th scope="col" className="px-4 py-2.5 font-medium">วันที่ลา</th>
                    <th scope="col" className="px-4 py-2.5 font-medium">ประเภท</th>
                    <th scope="col" className="px-4 py-2.5 text-right font-medium">จำนวน</th>
                    <th scope="col" className="px-4 py-2.5 font-medium">สถานะ</th>
                    <th scope="col" className="px-4 py-2.5 font-medium">เหตุผล / หมายเหตุ</th>
                    <th scope="col" className="px-4 py-2.5 font-medium">ยื่นเมื่อ</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-line">
                  {shown.map((r) => {
                    const cancelled = r._group === "cancelled"
                    return (
                      <tr key={r.id} className="align-top even:bg-gray-50/60 dark:even:bg-gray-700/20">
                        <td className="px-4 py-3 tabular-nums font-semibold text-gray-900 dark:text-gray-100">{r._no ?? <span className="font-normal text-gray-400 dark:text-gray-500">—</span>}</td>
                        <td className="whitespace-nowrap px-4 py-3">
                          <span className={cx("text-gray-900 dark:text-gray-100", cancelled && "text-gray-500 line-through decoration-gray-400 dark:text-gray-400")}>{dateRange(r)}</span>
                          {timeText(r) && <span className="block text-xs text-gray-500 dark:text-gray-400">{timeText(r)}</span>}
                        </td>
                        <td className="px-4 py-3 text-gray-700 dark:text-gray-300">{r.leave_type_name ?? "—"}</td>
                        <td className="whitespace-nowrap px-4 py-3 text-right tabular-nums text-gray-900 dark:text-gray-100">{fmtLeaveRowDuration(r)}</td>
                        <td className="px-4 py-3"><StatusPill status={r.status} /></td>
                        <td className="max-w-sm px-4 py-3 text-gray-600 dark:text-gray-400">
                          {r.comment && <p className="break-words">{r.comment}</p>}
                          {cancelled ? (
                            <CancelledNote leave={r} className="mt-1" />
                          ) : r.hr_comment ? (
                            <p className="mt-0.5 break-words text-xs text-gray-500 dark:text-gray-400">ผู้พิจารณา: {r.hr_comment}</p>
                          ) : null}
                          {!r.comment && !cancelled && !r.hr_comment && "—"}
                        </td>
                        <td className="whitespace-nowrap px-4 py-3 text-gray-500 dark:text-gray-400">{fmtDate(r.created_at)}</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </div>
  )
}
