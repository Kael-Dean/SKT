// src/components/hr/GratuityBlocks.jsx
// ─────────────────────────────────────────────────────────────────────────────
// บำเหน็จเจ้าหน้าที่ — ชิ้นแสดงผลที่ใช้ร่วมกัน (API + ป้ายอยู่ใน src/lib/gratuity.js)
//   DiffAmount              ผลต่างเทียบปีก่อน (+/− พร้อมลูกศร)
//   GratuityEstimate        ประมาณการหากออก (exit_amount / exit_years_counted / exit_eligible)
//   GratuityHistory         ประวัติรายปีบัญชี — desktop = ตาราง, มือถือ = <DataList>
//   EmployeeGratuityPanel   HR · โปรไฟล์เจ้าหน้าที่ (GET /hr/employees/{id}/gratuity?exit_date=)
//   MyGratuitySection       พนักงาน · ข้อมูลการเงินของฉัน (GET /personnel/me/gratuity) — 403/404 = ไม่แสดง
// ─────────────────────────────────────────────────────────────────────────────
import { useCallback, useEffect, useId, useState } from "react"
import { ArrowDownRight, ArrowUpRight, Info } from "lucide-react"
import { money, thaiDate, todayIso } from "../../lib/loans"
import {
  GRATUITY_MIN_DAYS, GRATUITY_MIN_YEARS, diffDirection, fetchEmployeeGratuity, fetchMyGratuity,
  fiscalYearRangeText, sortHistoryDesc, sourceLabel, sourceTone, statusLabel, statusTone, toNum,
} from "../../lib/gratuity"
import { cardCls, cx, labelCls } from "../../lib/styles"
import { Badge, EmptyState, ErrorState, SkeletonText } from "../ui"
import { useIsPhone } from "../../hooks/useMediaQuery"
import ThaiDateField from "../ThaiDateField"

const TH = "px-3 py-2 text-xs font-medium text-gray-500 dark:text-gray-400 whitespace-nowrap"
const TD = "px-3 py-2.5 tabular-nums"

// ─── ผลต่าง ──────────────────────────────────────────────────────────────────

/** ผลต่างเทียบปีก่อน — เพิ่ม = emerald, ลด = amber, null = "—" */
export function DiffAmount({ value, className }) {
  const dir = diffDirection(value)
  if (dir == null) return <span className={cx("text-gray-400 dark:text-gray-500", className)}>—</span>
  if (dir === "flat") return <span className={cx("text-gray-500 dark:text-gray-400", className)}>ไม่เปลี่ยน</span>
  const up = dir === "up"
  const Icon = up ? ArrowUpRight : ArrowDownRight
  return (
    <span className={cx("inline-flex items-center justify-end gap-0.5 tabular-nums whitespace-nowrap", up ? "text-emerald-700 dark:text-emerald-400" : "text-amber-700 dark:text-amber-300", className)}>
      <Icon aria-hidden="true" className="size-3.5 shrink-0" />
      <span className="sr-only">{up ? "เพิ่มขึ้น " : "ลดลง "}</span>
      {up ? "+" : "−"}{money(Math.abs(toNum(value)))}
    </span>
  )
}

// ─── ประมาณการหากออก ─────────────────────────────────────────────────────────

function Line({ label, hint, children, strong }) {
  return (
    <div className="flex items-baseline justify-between gap-4 py-2.5 text-sm">
      <dt className={cx("min-w-0", strong ? "font-medium text-gray-900 dark:text-gray-100" : "text-gray-700 dark:text-gray-300")}>
        {label}
        {hint && <span className="block text-xs font-normal text-gray-500 dark:text-gray-400">{hint}</span>}
      </dt>
      <dd className={cx("shrink-0 text-right tabular-nums text-gray-900 dark:text-gray-100", strong && "text-lg font-semibold")}>{children}</dd>
    </div>
  )
}

/**
 * @param {{ data: { exit_date?: string, exit_years_counted?: number|null, exit_amount?: string|null, exit_eligible?: boolean },
 *           self?: boolean }} props   self = ข้อความสำหรับเจ้าของข้อมูล ("คุณ")
 */
export function GratuityEstimate({ data, self = false }) {
  const years = data?.exit_years_counted
  const eligible = Boolean(data?.exit_eligible)

  if (years == null) {
    return (
      <p className="rounded-xl bg-gray-50 px-4 py-3 text-sm text-gray-600 ring-1 ring-inset ring-gray-200/70 dark:bg-white/[.03] dark:text-gray-400 dark:ring-line">
        ยังประมาณการไม่ได้ — ทะเบียนยังไม่มีวันที่เริ่มงาน{self ? " ติดต่อฝ่ายบุคคลเพื่อบันทึกข้อมูล" : ""}
      </p>
    )
  }

  const short = Math.max(0, GRATUITY_MIN_YEARS - Number(years))
  return (
    <div>
      <dl className="divide-y divide-gray-100 dark:divide-line">
        <Line label="บำเหน็จที่จะได้รับ" strong>
          {eligible ? `${money(data.exit_amount)} บาท` : <span className="text-gray-500 dark:text-gray-400">ยังไม่มีสิทธิ์</span>}
        </Line>
        <Line label="จำนวนปีที่นับ" hint={`นับเฉพาะปีที่ทำงานสุทธิอย่างน้อย ${GRATUITY_MIN_DAYS} วัน`}>
          {years} ปี
        </Line>
      </dl>
      {!eligible && (
        <p role="note" className="mt-2 flex gap-2 rounded-xl bg-amber-50 px-3 py-2.5 text-sm leading-relaxed text-amber-800 ring-1 ring-inset ring-amber-200 dark:bg-amber-500/10 dark:text-amber-200 dark:ring-amber-400/25">
          <Info aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
          <span>
            ต้องนับได้ครบ {GRATUITY_MIN_YEARS} ปีจึงมีสิทธิ์รับบำเหน็จ
            {short > 0 && <> — {self ? "ขาดอีก" : "ยังขาดอีก"} <span className="tabular-nums font-medium">{short}</span> ปี</>}
          </span>
        </p>
      )}
    </div>
  )
}

// ─── ประวัติรายปีบัญชี ───────────────────────────────────────────────────────

/** @param {{ history: object[], showSource?: boolean }} props */
export function GratuityHistory({ history, showSource = false }) {
  const isPhone = useIsPhone()
  const rows = sortHistoryDesc(history)

  if (rows.length === 0) {
    return <p className="py-2 text-sm text-gray-500 dark:text-gray-400">ยังไม่มีรายการบำเหน็จรายปี</p>
  }

  // มือถือ: รายการแบนในการ์ดเดิม (บล็อกนี้อยู่ในการ์ดอยู่แล้ว — DataList จะกลายเป็นการ์ดซ้อนการ์ด)
  if (isPhone) {
    return (
      <ul className="divide-y divide-gray-100 dark:divide-line">
        {rows.map((r) => (
          <li key={r.id ?? r.fiscal_year} className="py-3">
            <div className="flex items-baseline justify-between gap-3">
              <p className="min-w-0 font-medium text-gray-900 dark:text-gray-100">
                ปีบัญชี {r.fiscal_year}
                {r.status === "left" && <Badge tone={statusTone(r.status)} className="ml-2 align-middle">{statusLabel(r.status)}</Badge>}
              </p>
              <p className="shrink-0 text-base font-semibold tabular-nums text-gray-900 dark:text-gray-100">{money(r.amount)}</p>
            </div>
            <div className="mt-0.5 flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5 text-sm text-gray-500 dark:text-gray-400">
              <span className="tabular-nums">{money(r.last_salary)} × {r.years_counted ?? "—"} ปี</span>
              <DiffAmount value={r.difference} className="text-sm" />
            </div>
            {showSource && r.source && r.source !== "calc" && (
              <p className="mt-1"><Badge tone={sourceTone(r.source)}>{sourceLabel(r.source)}</Badge></p>
            )}
          </li>
        ))}
      </ul>
    )
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-gray-200 text-left dark:border-line">
            <th scope="col" className={cx(TH, "pl-0")}>ปีบัญชี</th>
            <th scope="col" className={cx(TH, "text-right")}>เงินเดือนเดือนสุดท้าย</th>
            <th scope="col" className={cx(TH, "text-right")}>ปีที่นับ</th>
            <th scope="col" className={cx(TH, "text-right")}>บำเหน็จ</th>
            <th scope="col" className={cx(TH, "text-right")}>เทียบปีก่อน</th>
            <th scope="col" className={cx(TH, "pr-0")}>สถานะ</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100 dark:divide-line">
          {rows.map((r) => (
            <tr key={r.id ?? r.fiscal_year} className="text-gray-800 dark:text-gray-200">
              <td className={cx(TD, "pl-0 whitespace-nowrap")}>
                <span className="font-medium text-gray-900 dark:text-gray-100">{r.fiscal_year}</span>
                <span className="block text-xs text-gray-500 dark:text-gray-400">{fiscalYearRangeText(r.fiscal_year)}</span>
              </td>
              <td className={cx(TD, "text-right")}>{money(r.last_salary)}</td>
              <td className={cx(TD, "text-right")}>{r.years_counted ?? "—"}</td>
              <td className={cx(TD, "text-right font-semibold text-gray-900 dark:text-gray-100")}>{money(r.amount)}</td>
              <td className={cx(TD, "text-right")}><DiffAmount value={r.difference} /></td>
              <td className={cx(TD, "pr-0")}>
                <span className="inline-flex flex-wrap gap-1">
                  <Badge tone={statusTone(r.status)}>{statusLabel(r.status)}</Badge>
                  {showSource && r.source && r.source !== "calc" && <Badge tone={sourceTone(r.source)}>{sourceLabel(r.source)}</Badge>}
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

// ─── HR · โปรไฟล์เจ้าหน้าที่ ─────────────────────────────────────────────────

/** ประวัติบำเหน็จ + ประมาณการหากออกวันที่ที่เลือก (ค่าเริ่มต้น = วันนี้) — ไม่มีหัวข้อของตัวเอง */
export function EmployeeGratuityPanel({ employeeId }) {
  const uid = useId()
  const [exitDate, setExitDate] = useState(todayIso)
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")

  const load = useCallback(() => {
    if (!employeeId) return undefined
    let alive = true
    setLoading(true)
    setError("")
    fetchEmployeeGratuity(employeeId, exitDate || undefined)
      .then((d) => { if (alive) setData(d) })
      .catch((e) => { if (alive) setError(e.message || "โหลดข้อมูลบำเหน็จไม่สำเร็จ") })
      .finally(() => { if (alive) setLoading(false) })
    return () => { alive = false }
  }, [employeeId, exitDate])
  useEffect(() => load(), [load])

  return (
    <div className="space-y-5">
      <section aria-labelledby={`${uid}-est-h`}>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <h4 id={`${uid}-est-h`} className="text-sm font-semibold text-gray-900 dark:text-gray-100">ประมาณการบำเหน็จหากออกวันที่…</h4>
          <div className="w-full min-w-0 sm:w-56">
            <label htmlFor={`${uid}-exit`} className={cx(labelCls, "!text-xs !mb-1 text-gray-600 dark:text-gray-300")}>วันที่ออก</label>
            <ThaiDateField
              id={`${uid}-exit`}
              value={exitDate}
              onChange={(e) => setExitDate(e.target.value || todayIso())}
              className="!rounded-lg !px-3 !py-2 md:!text-sm"
            />
          </div>
        </div>
        <div className="mt-2" aria-live="polite" aria-busy={loading || undefined}>
          {loading && !data ? (
            <SkeletonText lines={2} />
          ) : error ? (
            <ErrorState message={error} onRetry={load} />
          ) : (
            <div className={cx(loading && "opacity-60 transition-opacity duration-200")}>
              <GratuityEstimate data={data} />
              {data?.exit_date && (
                <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                  ประมาณการ ณ {thaiDate(data.exit_date, { long: true })} · ใช้เงินเดือนปัจจุบันในทะเบียน
                </p>
              )}
            </div>
          )}
        </div>
      </section>

      {!error && data && (
        <section aria-labelledby={`${uid}-hist-h`} className="border-t border-gray-100 pt-4 dark:border-line">
          <h4 id={`${uid}-hist-h`} className="mb-1 text-sm font-semibold text-gray-900 dark:text-gray-100">ประวัติบำเหน็จรายปีบัญชี</h4>
          <GratuityHistory history={data.history} showSource />
        </section>
      )}
    </div>
  )
}

// ─── พนักงาน · บำเหน็จของฉัน ────────────────────────────────────────────────

/** บล็อก "บำเหน็จของฉัน" ในหน้าข้อมูลการเงินของฉัน — 403/404 (ยังไม่เปิดใช้ / ไม่มีสิทธิ์) = ไม่แสดงทั้งบล็อก */
export function MyGratuitySection() {
  const [data, setData] = useState(null)
  const [state, setState] = useState("loading") // loading | ready | hidden | error
  const [error, setError] = useState("")

  const load = useCallback(() => {
    let alive = true
    setState("loading")
    setError("")
    fetchMyGratuity()
      .then((d) => { if (!alive) return; setData(d); setState("ready") })
      .catch((e) => {
        if (!alive) return
        if (e?.status === 403 || e?.status === 404) return setState("hidden")
        setError(e.message || "โหลดข้อมูลบำเหน็จไม่สำเร็จ")
        setState("error")
      })
    return () => { alive = false }
  }, [])
  useEffect(() => load(), [load])

  if (state === "hidden") return null

  return (
    <section aria-labelledby="fin-gratuity-h" className="space-y-3">
      <div>
        <h2 id="fin-gratuity-h" className="text-base font-semibold text-gray-900 dark:text-gray-100">บำเหน็จของฉัน</h2>
        <p className="mt-0.5 text-sm text-gray-500 dark:text-gray-400">
          บำเหน็จ = เงินเดือนเดือนสุดท้าย × จำนวนปีที่นับ · ต้องนับได้ครบ {GRATUITY_MIN_YEARS} ปีจึงมีสิทธิ์รับ
        </p>
      </div>
      <div className={cx(cardCls, "p-5")}>
        {state === "loading" ? (
          <SkeletonText lines={4} />
        ) : state === "error" ? (
          <ErrorState message={error} onRetry={load} />
        ) : (
          <div className="grid gap-6 md:grid-cols-[minmax(0,2fr)_minmax(0,3fr)] md:gap-8">
            <section aria-labelledby="fin-gratuity-est-h" className="min-w-0">
              <h3 id="fin-gratuity-est-h" className="text-xs font-semibold text-gray-500 dark:text-gray-400">หากลาออกวันนี้</h3>
              <div className="mt-1">
                <GratuityEstimate data={data} self />
              </div>
              <p className="mt-2 text-xs leading-relaxed text-gray-500 dark:text-gray-400">
                เป็นตัวเลขประมาณการจากเงินเดือนปัจจุบัน ปีที่ทำงานสุทธิ (หักวันลาป่วย ลากิจ ลาคลอด) ไม่ถึง {GRATUITY_MIN_DAYS} วันจะไม่นับปีนั้น
              </p>
            </section>
            <section aria-labelledby="fin-gratuity-hist-h" className="min-w-0">
              <h3 id="fin-gratuity-hist-h" className="text-xs font-semibold text-gray-500 dark:text-gray-400">ยอดสำรองรายปีบัญชี</h3>
              <div className="mt-1">
                {Array.isArray(data?.history) && data.history.length > 0 ? (
                  <GratuityHistory history={data.history} />
                ) : (
                  <EmptyState className="!py-6" title="ยังไม่มียอดสำรองรายปี" description="ฝ่ายบุคคลคำนวณบำเหน็จเมื่อสิ้นปีบัญชี (31 มี.ค.) รายการจะแสดงที่นี่" />
                )}
              </div>
            </section>
          </div>
        )}
      </div>
    </section>
  )
}
