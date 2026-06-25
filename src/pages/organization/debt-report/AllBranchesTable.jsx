import { useEffect, useMemo, useRef, useState } from "react"
import { apiAuth } from "../../../lib/api"
import StickyTableScrollbar from "../../../components/StickyTableScrollbar"
import { cx, secondaryBtnCls } from "../../../lib/styles"
import { Badge, EmptyState, ErrorState } from "../../../components/ui"
import { buildReportRows, computeColTotals } from "./buildReportRows"
import { printDebtTable } from "./printDebtTable"

/** Line-art printer icon for the export button (currentColor, no emoji). */
function PrinterIcon() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="size-4"
    >
      <path d="M6 9V2h12v7" />
      <path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2" />
      <rect x="6" y="14" width="12" height="8" rx="1" />
    </svg>
  )
}

const fmtMoney = (v) =>
  new Intl.NumberFormat("th-TH", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(parseFloat(v) || 0)

const STRIPE = {
  head: "bg-slate-100 dark:bg-slate-700",
  cell: "bg-white dark:bg-slate-900",
  alt: "bg-slate-50 dark:bg-slate-800",
  foot: "bg-emerald-100 dark:bg-emerald-900",
}

export default function AllBranchesTable({ programs, fiscalYears, onBack }) {
  const tableWrapRef = useRef(null)

  const [reportRows, setReportRows] = useState([])
  const [loading, setLoading]       = useState(false)
  const [error, setError]           = useState("")
  const [reloadKey, setReloadKey]   = useState(0)

  useEffect(() => {
    let alive = true
    setLoading(true)
    setError("")
    ;(async () => {
      try {
        const data = await apiAuth("/debt/report")
        if (alive) setReportRows(Array.isArray(data) ? data : [])
      } catch (e) {
        if (alive) setError(e.message || "โหลดรายงานไม่สำเร็จ")
      } finally {
        if (alive) setLoading(false)
      }
    })()
    return () => { alive = false }
  }, [reloadKey])

  const tableRows = useMemo(
    () => buildReportRows(programs, fiscalYears, reportRows),
    [programs, fiscalYears, reportRows]
  )
  const colTotals = useMemo(() => computeColTotals(tableRows), [tableRows])

  return (
    <div>
      <div className="flex flex-wrap items-center gap-3 mb-4">
        <button
          onClick={onBack}
          className="inline-flex items-center gap-1.5 rounded-xl border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 py-2 text-sm font-medium text-gray-700 dark:text-gray-200 shadow-sm hover:bg-gray-50 hover:border-gray-400 dark:hover:bg-gray-700 dark:hover:border-gray-500 active:scale-95 transition-all duration-200 cursor-pointer"
        >
          ← กลับ
        </button>
        <h2 className="text-base font-bold text-gray-900 dark:text-gray-100 flex-1">
          ตารางหนี้รวมทุกสาขา
        </h2>
        <Badge tone="neutral">ดูข้อมูลรวม — ไม่สามารถแก้ไขได้</Badge>
        <button
          type="button"
          onClick={() =>
            printDebtTable({
              title: "ตารางหนี้รวมทุกสาขา",
              subtitle: "รวมทุกหน่วยงาน",
              tableRows,
              colTotals,
            })
          }
          className={cx(secondaryBtnCls, "!py-2 !px-4 !text-sm cursor-pointer")}
        >
          <PrinterIcon />
          พิมพ์ PDF
        </button>
      </div>

      {error && !loading && (
        <div className="mb-4">
          <ErrorState message={error} onRetry={() => setReloadKey((k) => k + 1)} />
        </div>
      )}

      <div
        ref={tableWrapRef}
        className="overflow-auto rounded-2xl border border-slate-200 dark:border-slate-700"
      >
        <table
          className="border-collapse text-sm"
          style={{ tableLayout: "fixed", minWidth: "1400px" }}
        >
          <thead className="sticky top-0 z-20">
            <tr className={cx(STRIPE.head, "text-slate-800 dark:text-slate-100")}>
              <th
                rowSpan={3}
                className="border border-slate-300 dark:border-slate-600 px-1 py-2 text-center text-[11px] font-bold sticky left-0 z-10 bg-slate-100 dark:bg-slate-700"
                style={{ width: 50, minWidth: 50 }}
              >
                ลำดับ
              </th>
              <th
                rowSpan={3}
                className="border border-slate-300 dark:border-slate-600 px-2 py-2 text-left text-[11px] font-bold sticky left-[50px] z-10 bg-slate-100 dark:bg-slate-700"
                style={{ width: 180, minWidth: 180 }}
              >
                โครงการ
              </th>
              <th
                rowSpan={3}
                className="border border-slate-300 dark:border-slate-600 px-1 py-2 text-center text-[11px] font-bold sticky left-[230px] z-10 bg-slate-100 dark:bg-slate-700"
                style={{ width: 80, minWidth: 80 }}
              >
                ปีการผลิต
              </th>
              <th colSpan={2} className="border border-slate-300 dark:border-slate-600 px-1 py-1.5 text-center text-[11px] font-bold">
                ยอดยกมา
              </th>
              <th colSpan={2} className="border border-slate-300 dark:border-slate-600 px-1 py-1.5 text-center text-[11px] font-bold">
                เพิ่มในปี
              </th>
              <th colSpan={2} className="border border-slate-300 dark:border-slate-600 px-1 py-1.5 text-center text-[11px] font-bold">
                รับชำระ
              </th>
              <th colSpan={2} className="border border-slate-300 dark:border-slate-600 px-1 py-1.5 text-center text-[11px] font-bold">
                คงเหลือ
              </th>
              <th colSpan={6} className="border border-slate-300 dark:border-slate-600 px-1 py-1.5 text-center text-[11px] font-bold bg-indigo-50 dark:bg-indigo-900/20">
                วิธีชำระหนี้
              </th>
              <th
                rowSpan={3}
                className="border border-slate-300 dark:border-slate-600 px-1 py-2 text-center text-[11px] font-bold"
                style={{ width: 100, minWidth: 100 }}
              >
                หมายเหตุ
              </th>
            </tr>
            <tr className={cx(STRIPE.head, "text-slate-800 dark:text-slate-100")}>
              {Array(8).fill(null).map((_, i) => (
                <th
                  key={i}
                  className="border border-slate-300 dark:border-slate-600"
                  style={{ width: 80, minWidth: 80 }}
                />
              ))}
              <th colSpan={2} className="border border-slate-300 dark:border-slate-600 px-0.5 py-1 text-center text-[10px] font-semibold bg-indigo-50 dark:bg-indigo-900/20">
                โอนผ่านมือถือ
              </th>
              <th colSpan={2} className="border border-slate-300 dark:border-slate-600 px-0.5 py-1 text-center text-[10px] font-semibold bg-indigo-50 dark:bg-indigo-900/20">
                เงินสด
              </th>
              <th colSpan={2} className="border border-slate-300 dark:border-slate-600 px-0.5 py-1 text-center text-[10px] font-semibold bg-indigo-50 dark:bg-indigo-900/20">
                ชำระด้วยผลผลิต
              </th>
            </tr>
            <tr className={cx(STRIPE.head, "text-slate-700 dark:text-slate-300")}>
              {Array(7).fill(null).flatMap((_, i) => [
                <th
                  key={`a${i}`}
                  className="border border-slate-300 dark:border-slate-600 px-0.5 py-1 text-center text-[10px]"
                  style={{ width: 80, minWidth: 80 }}
                >
                  จำนวน(บาท)
                </th>,
                <th
                  key={`b${i}`}
                  className="border border-slate-300 dark:border-slate-600 px-0.5 py-1 text-center text-[10px]"
                  style={{ width: 65, minWidth: 65 }}
                >
                  จำนวนราย
                </th>,
              ])}
            </tr>
          </thead>

          <tbody>
            {tableRows.length === 0 ? (
              <tr>
                <td colSpan={18} className={cx(STRIPE.cell, "p-0")}>
                  <EmptyState
                    title={loading ? "กำลังโหลด…" : "ยังไม่มีข้อมูลหนี้"}
                    description={loading ? "กำลังดึงรายงานหนี้" : "ยังไม่มีโครงการหรือยอดหนี้ในระบบ — เพิ่มโครงการและบันทึกยอดหนี้ที่หน้าตารางหนี้แยกสาขา"}
                  />
                </td>
              </tr>
            ) : (
              tableRows.map((group, gi) => {
                const rowBg = gi % 2 === 0 ? STRIPE.cell : STRIPE.alt
                return group.yearRows.map((yr, yi) => (
                  <tr key={`${group.program.id}-${yr.fiscalYear.id}`} className={rowBg}>
                    {yi === 0 && (
                      <>
                        <td
                          rowSpan={group.yearRows.length}
                          className={cx(
                            "border border-slate-200 dark:border-slate-700 px-1 py-2 text-center text-xs sticky left-0 z-10",
                            rowBg
                          )}
                        >
                          {gi + 1}
                        </td>
                        <td
                          rowSpan={group.yearRows.length}
                          className={cx(
                            "border border-slate-200 dark:border-slate-700 px-2 py-2 text-xs font-medium sticky left-[50px] z-10",
                            rowBg
                          )}
                        >
                          {group.program.prog_name}
                        </td>
                      </>
                    )}
                    <td
                      className={cx(
                        "border border-slate-200 dark:border-slate-700 px-1 py-2 text-center text-xs sticky left-[230px] z-10",
                        rowBg
                      )}
                    >
                      {yr.fiscalYear.year_name}
                    </td>
                    {[
                      yr.carry_amount, yr.carry_count,
                      yr.new_amount, yr.new_count,
                      yr.paid_amount, yr.paid_count,
                      yr.remain_amount, yr.remain_count,
                      yr.mobile_amount, yr.mobile_count,
                      yr.cash_amount, yr.cash_count,
                      yr.produce_amount, yr.produce_count,
                    ].map((val, ci) => (
                      <td
                        key={ci}
                        className="border border-slate-200 dark:border-slate-700 px-1 py-2 text-right text-xs tabular-nums"
                      >
                        {ci % 2 === 0 ? fmtMoney(val) : val || 0}
                      </td>
                    ))}
                    <td className="border border-slate-200 dark:border-slate-700 px-1 py-2 text-xs text-gray-500 dark:text-gray-400">
                      {yr.note || ""}
                    </td>
                  </tr>
                ))
              })
            )}
          </tbody>

          <tfoot>
            <tr className={STRIPE.foot}>
              <td
                colSpan={3}
                className={cx(
                  "border border-slate-300 dark:border-slate-600 px-2 py-2 text-xs font-bold sticky left-0 z-10",
                  STRIPE.foot
                )}
              >
                รวมทั้งหมด
              </td>
              {[
                colTotals.carry_amount, colTotals.carry_count,
                colTotals.new_amount, colTotals.new_count,
                colTotals.paid_amount, colTotals.paid_count,
                colTotals.remain_amount, colTotals.remain_count,
                colTotals.mobile_amount, colTotals.mobile_count,
                colTotals.cash_amount, colTotals.cash_count,
                colTotals.produce_amount, colTotals.produce_count,
              ].map((val, ci) => (
                <td
                  key={ci}
                  className={cx(
                    "border border-slate-300 dark:border-slate-600 px-1 py-2 text-right text-xs font-bold tabular-nums",
                    STRIPE.foot
                  )}
                >
                  {ci % 2 === 0 ? fmtMoney(val) : val || 0}
                </td>
              ))}
              <td className={cx("border border-slate-300 dark:border-slate-600", STRIPE.foot)} />
            </tr>
          </tfoot>
        </table>
      </div>
      <StickyTableScrollbar tableRef={tableWrapRef} />
    </div>
  )
}
