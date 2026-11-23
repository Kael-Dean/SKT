// src/pages/hr/tabs/HRGratuityTab.jsx
// ─────────────────────────────────────────────────────────────────────────────
// บำเหน็จเจ้าหน้าที่ — /hr/dashboard?tab=gratuity (hr.gratuity.view)
//   GET /hr/gratuity?fiscal_year=  → { fiscal_year, count, total, previous_total, difference, rows[] }
//   ยอดรวม (total / previous_total) นับเฉพาะ status "active" — คำนวณที่ backend
//   hr.gratuity.record: ปุ่ม "คำนวณบำเหน็จ" (GratuityCalcSheet) + แก้ไขรายแถว (GratuityEditSheet)
// ─────────────────────────────────────────────────────────────────────────────
import { useCallback, useEffect, useId, useMemo, useState } from "react"
import { Calculator, RotateCw, Search } from "lucide-react"
import { useCan } from "../../../lib/permissions"
import { useDrill } from "../../../lib/drill"
import { money, thaiDate } from "../../../lib/loans"
import { apiErrorText } from "../../../lib/apiErrors"
import {
  fetchGratuityList, fiscalYearOptions, fiscalYearRangeText, gratuityFiscalYear,
  sourceHint, sourceLabel, sourceTone, statusLabel, statusTone,
} from "../../../lib/gratuity"
import { cx, baseField, cardCls, editBtnCls, iconBtnCls, neutralBtnCls, primaryBtnCls } from "../../../lib/styles"
import { Badge, DataList, EmptyState, ErrorState, SkeletonTableRows, Skeleton } from "../../../components/ui"
import SelectDropdown from "../../../components/SelectDropdown"
import { DiffAmount } from "../../../components/hr/GratuityBlocks"
import GratuityCalcSheet from "../../../components/hr/GratuityCalcSheet"
import GratuityEditSheet from "../../../components/hr/GratuityEditSheet"
import { useIsPhone } from "../../../hooks/useMediaQuery"

const TH = "px-3 py-3 text-xs font-semibold text-gray-500 dark:text-gray-400 whitespace-nowrap"
const TD = "px-3 py-2.5 tabular-nums"
const norm = (s) => String(s ?? "").toLowerCase().replace(/\s+/g, "")

function SourceBadge({ source }) {
  if (!source) return null
  return (
    <span title={sourceHint(source)}>
      <Badge tone={sourceTone(source)}>{sourceLabel(source)}</Badge>
    </span>
  )
}

/** แถบสรุปของปี — แถวเดียวในการ์ดเดียว (ไม่ใช่การ์ดสถิติแยกกัน) */
function SummaryStrip({ data, loading, leftCount }) {
  const items = [
    { label: "จำนวนในทะเบียน", value: data ? `${data.count} คน` : "—", hint: leftCount > 0 ? `พ้นสภาพ ${leftCount} คน` : null },
    { label: "ยอดสำรองบำเหน็จ (บาท)", value: data ? money(data.total) : "—", strong: true, hint: "เฉพาะผู้ที่ยังทำงาน" },
    { label: `ปีบัญชี ${data ? data.fiscal_year - 1 : "ก่อน"} (บาท)`, value: data ? money(data.previous_total) : "—" },
    { label: "เทียบปีก่อน (บาท)", value: data ? <DiffAmount value={data.difference} /> : "—" },
  ]
  return (
    <dl className={cx(cardCls, "grid grid-cols-2 lg:grid-cols-4")}>
      {items.map((it, i) => (
        <div key={i} className={cx(
          "min-w-0 border-gray-100 px-4 py-3.5 lg:px-5 dark:border-line",
          i % 2 === 1 && "border-l",
          i > 0 && "lg:border-l",
          i >= 2 && "border-t lg:border-t-0",
        )}>
          <dt className="text-xs text-gray-500 dark:text-gray-400">{it.label}</dt>
          <dd className={cx("mt-1 tabular-nums text-gray-900 [overflow-wrap:anywhere] dark:text-gray-100", it.strong ? "text-base font-bold sm:text-lg" : "text-base font-semibold")}>
            {loading ? <Skeleton className="block h-6 w-24" /> : it.value}
          </dd>
          {it.hint && !loading && <dd className="mt-0.5 text-xs text-gray-500 dark:text-gray-400">{it.hint}</dd>}
        </div>
      ))}
    </dl>
  )
}

export default function HRGratuityTab() {
  const uid = useId()
  const { can } = useCan()
  const { drillTo } = useDrill()
  const isPhone = useIsPhone()
  const canRecord = can("hr.gratuity.record")
  const canOpenProfile = can("hr.employees.view")

  const currentFy = useMemo(() => gratuityFiscalYear(), [])
  const [fy, setFy] = useState(String(currentFy))
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [query, setQuery] = useState("")
  const [calcOpen, setCalcOpen] = useState(false)
  const [editRow, setEditRow] = useState(null)

  const load = useCallback(() => {
    let alive = true
    setLoading(true)
    setError("")
    fetchGratuityList(fy)
      .then((d) => { if (alive) setData(d) })
      .catch((e) => { if (alive) { setData(null); setError(apiErrorText(e, { action: "โหลดทะเบียนบำเหน็จ" })) } })
      .finally(() => { if (alive) setLoading(false) })
    return () => { alive = false }
  }, [fy])
  useEffect(() => load(), [load])

  const allRows = useMemo(() => (Array.isArray(data?.rows) ? data.rows : []), [data])
  const leftCount = useMemo(() => allRows.filter((r) => r.status === "left").length, [allRows])
  const rows = useMemo(() => {
    const q = norm(query)
    if (!q) return allRows
    return allRows.filter((r) => norm(r.name).includes(q) || norm(r.position).includes(q))
  }, [allRows, query])

  const fyNum = Number(fy)
  const fyOptions = useMemo(() => fiscalYearOptions(currentFy, { back: 6, ahead: 1 }), [currentFy])

  const openProfile = (r) => drillTo(`/hr/personnel/${r.user_id}`, "บำเหน็จเจ้าหน้าที่")
  const canDrill = (r) => canOpenProfile && r.user_id != null

  const onSaved = (updated) => {
    // แทนแถวเดิมทันที แล้วโหลดใหม่เพื่อให้ยอดรวมตรงกับ backend
    if (updated?.id != null) {
      setData((d) => (d ? { ...d, rows: d.rows.map((r) => (r.id === updated.id ? { ...r, ...updated } : r)) } : d))
    }
    load()
  }

  const emptyState = query && allRows.length > 0 ? (
    <EmptyState title="ไม่พบชื่อที่ค้นหา" description={`ไม่มีเจ้าหน้าที่ชื่อ “${query}” ในปีบัญชี ${fy}`}
      action={<button type="button" onClick={() => setQuery("")} className={neutralBtnCls}>ล้างคำค้นหา</button>} />
  ) : (
    <EmptyState
      title={`ยังไม่มีรายการบำเหน็จปีบัญชี ${fy}`}
      description={canRecord
        ? "กด “คำนวณบำเหน็จ” เพื่อดูตัวอย่างผลคำนวณจากเงินเดือนและวันลาของทุกคน ระบบยังไม่บันทึกจนกว่าจะยืนยัน"
        : "ฝ่ายบุคคลยังไม่ได้คำนวณบำเหน็จของปีนี้"}
      action={canRecord ? (
        <button type="button" onClick={() => setCalcOpen(true)} className={primaryBtnCls}>
          <Calculator aria-hidden="true" className="size-4" />คำนวณบำเหน็จ
        </button>
      ) : undefined}
    />
  )

  const nameCell = (r) => (canDrill(r) ? (
    <button type="button" onClick={() => openProfile(r)}
      className="cursor-pointer rounded text-left font-medium text-gray-900 hover:text-indigo-700 hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 dark:text-gray-100 dark:hover:text-indigo-300">
      {r.name ?? "—"}
    </button>
  ) : (
    <span className="font-medium text-gray-900 dark:text-gray-100">{r.name ?? "—"}</span>
  ))

  return (
    <div className="space-y-4">
      {/* แถวเครื่องมือ */}
      <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div className="flex min-w-0 flex-col gap-3 sm:flex-row sm:items-end">
          <div className="w-full min-w-0 sm:w-60">
            <span id={`${uid}-fy-l`} className="mb-1 block text-xs font-medium text-gray-600 dark:text-gray-300">ปีบัญชี</span>
            <SelectDropdown id={`${uid}-fy`} size="sm" showSwatch={false} showSublabelInTrigger ariaLabelledby={`${uid}-fy-l`}
              options={fyOptions} value={fy} onChange={setFy} />
          </div>
          <div className="relative w-full min-w-0 sm:w-64">
            <label htmlFor={`${uid}-q`} className="sr-only">ค้นหาชื่อเจ้าหน้าที่</label>
            <Search aria-hidden="true" strokeWidth={1.75} className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-gray-400" />
            <input id={`${uid}-q`} type="search" value={query} onChange={(e) => setQuery(e.target.value)}
              placeholder="ค้นหาชื่อหรือตำแหน่ง" autoComplete="off"
              className={cx(baseField, "!rounded-lg !py-2 !pl-9 !pr-3 md:!text-sm")} />
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button type="button" onClick={load} aria-label="โหลดใหม่" title="โหลดใหม่" className={iconBtnCls}>
            <RotateCw aria-hidden="true" className={cx("size-4", loading && "animate-spin motion-reduce:animate-none")} />
          </button>
          {canRecord && (
            <button type="button" onClick={() => setCalcOpen(true)} disabled={!Number.isFinite(fyNum)}
              className={cx(primaryBtnCls, "flex-1 md:flex-none md:pointer-fine:!h-10")}>
              <Calculator aria-hidden="true" className="size-4" />คำนวณบำเหน็จ
            </button>
          )}
        </div>
      </div>

      <p className="text-xs text-gray-500 dark:text-gray-400">
        {fiscalYearRangeText(fyNum)} · บำเหน็จ = เงินเดือนเดือนสุดท้าย × จำนวนปีที่นับ · ทำงานไม่ถึง 5 ปีไม่มีสิทธิ์รับเมื่อออก
      </p>

      {error ? (
        <ErrorState message={error} onRetry={load} />
      ) : (
        <>
          <SummaryStrip data={data} loading={loading && !data} leftCount={leftCount} />

          {!loading && allRows.length > 0 && (
            <p className="text-sm tabular-nums text-gray-500 dark:text-gray-400" aria-live="polite">
              {query ? `พบ ${rows.length} จาก ${allRows.length} คน` : `${allRows.length} คน · เรียงตามวันที่เริ่มงาน`}
            </p>
          )}

          {isPhone ? (
            <DataList
              items={rows}
              loading={loading && !data}
              skeletonRows={4}
              keyOf={(r) => r.id ?? r.user_id}
              title={(r) => r.name ?? "—"}
              subtitle={(r) => [r.position, r.hired_on ? `เริ่มงาน ${thaiDate(r.hired_on)}` : null].filter(Boolean).join(" · ")}
              badge={(r) => (
                <span className="inline-flex flex-wrap justify-end gap-1">
                  <Badge tone={statusTone(r.status)}>{statusLabel(r.status)}</Badge>
                  {r.source !== "calc" && <SourceBadge source={r.source} />}
                </span>
              )}
              fields={[
                { label: "เงินเดือน", value: (r) => money(r.last_salary), align: "right" },
                { label: "ปีที่นับ", value: (r) => `${r.years_counted ?? "—"} ปี`, align: "right" },
                { label: "ปีก่อน", value: (r) => money(r.previous_amount), align: "right" },
                { label: "ผลต่าง", value: (r) => <DiffAmount value={r.difference} />, align: "right" },
                { label: "แหล่งเงิน", value: (r) => r.funding ?? "—" },
                { label: "บำเหน็จ", value: (r) => money(r.amount), align: "right", emphasis: true },
              ]}
              onClick={canOpenProfile ? (r) => { if (r.user_id != null) openProfile(r) } : undefined}
              actions={canRecord ? (r) => (
                <button type="button" onClick={() => setEditRow(r)} aria-label={`แก้ไขบำเหน็จของ ${r.name ?? ""}`} className={editBtnCls}>แก้ไข</button>
              ) : undefined}
              emptyState={emptyState}
            />
          ) : (
            <div className={cx(cardCls, "overflow-x-auto")}>
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-100 bg-gray-50 text-left dark:border-line dark:bg-white/[.03]">
                    <th scope="col" className={cx(TH, "pl-4")}>เจ้าหน้าที่</th>
                    <th scope="col" className={TH}>เริ่มงาน</th>
                    <th scope="col" className={cx(TH, "text-right")}>เงินเดือนเดือนสุดท้าย</th>
                    <th scope="col" className={cx(TH, "text-right")}>ปีที่นับ</th>
                    <th scope="col" className={cx(TH, "text-right")}>บำเหน็จ</th>
                    <th scope="col" className={cx(TH, "text-right")}>ปีก่อน</th>
                    <th scope="col" className={cx(TH, "text-right")}>ผลต่าง</th>
                    <th scope="col" className={TH}>แหล่งเงิน</th>
                    <th scope="col" className={TH}>สถานะ</th>
                    {canRecord && <th scope="col" className={cx(TH, "pr-4")}><span className="sr-only">จัดการ</span></th>}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-line">
                  {loading && !data ? (
                    <SkeletonTableRows rows={6} cols={canRecord ? 10 : 9} />
                  ) : rows.length === 0 ? (
                    <tr><td colSpan={canRecord ? 10 : 9} className="p-0">{emptyState}</td></tr>
                  ) : rows.map((r) => (
                    <tr key={r.id ?? r.user_id}
                      className={cx("transition-colors duration-150 hover:bg-gray-50 dark:hover:bg-white/[.03]", r.status === "left" && "text-gray-500 dark:text-gray-400")}>
                      <td className="max-w-[16rem] py-2.5 pl-4 pr-3">
                        {nameCell(r)}
                        {r.position && <p className="truncate text-xs text-gray-500 dark:text-gray-400" title={r.position}>{r.position}</p>}
                        {r.note && <p className="truncate text-xs italic text-gray-500 dark:text-gray-400" title={r.note}>{r.note}</p>}
                      </td>
                      <td className={cx(TD, "whitespace-nowrap text-gray-700 dark:text-gray-300")}>{thaiDate(r.hired_on)}</td>
                      <td className={cx(TD, "text-right text-gray-700 dark:text-gray-300")}>{money(r.last_salary)}</td>
                      <td className={cx(TD, "text-right text-gray-700 dark:text-gray-300")}>{r.years_counted ?? "—"}</td>
                      <td className={cx(TD, "text-right font-semibold text-gray-900 dark:text-gray-100")}>{money(r.amount)}</td>
                      <td className={cx(TD, "text-right text-gray-500 dark:text-gray-400")}>{money(r.previous_amount)}</td>
                      <td className={cx(TD, "text-right")}><DiffAmount value={r.difference} /></td>
                      <td className="whitespace-nowrap px-3 py-2.5 text-gray-700 dark:text-gray-300">{r.funding ?? <span className="text-gray-400 dark:text-gray-500">—</span>}</td>
                      <td className="px-3 py-2.5">
                        <span className="inline-flex flex-wrap gap-1 whitespace-nowrap">
                          <Badge tone={statusTone(r.status)}>{statusLabel(r.status)}</Badge>
                          {r.source !== "calc" && <SourceBadge source={r.source} />}
                        </span>
                      </td>
                      {canRecord && (
                        <td className="py-2.5 pl-3 pr-4 text-right">
                          <button type="button" onClick={() => setEditRow(r)} aria-label={`แก้ไขบำเหน็จของ ${r.name ?? ""}`} className={editBtnCls}>แก้ไข</button>
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}

      {canRecord && (
        <>
          <GratuityCalcSheet open={calcOpen} fiscalYear={fyNum} onClose={() => setCalcOpen(false)} onDone={load} />
          <GratuityEditSheet open={!!editRow} row={editRow} onClose={() => setEditRow(null)} onSaved={onSaved} />
        </>
      )}
    </div>
  )
}
