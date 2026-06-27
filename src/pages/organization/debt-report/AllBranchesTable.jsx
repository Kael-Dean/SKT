import { useEffect, useMemo, useRef, useState } from "react"
import { apiAuth } from "../../../lib/api"
import StickyTableScrollbar from "../../../components/StickyTableScrollbar"
import { cx, secondaryBtnCls } from "../../../lib/styles"
import { Badge, ErrorState } from "../../../components/ui"
import { buildReportRows, computeColTotals } from "./buildReportRows"
import { printDebtTable } from "./printDebtTable"
import { ReportHead, ReportBody } from "./BranchDebtTable"

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

export default function AllBranchesTable({ onBack }) {
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
        // No branch_id → every cohort across all branches; buildReportRows
        // aggregates them per (program × origination year).
        const data = await apiAuth("/debt/report")
        if (alive) setReportRows(Array.isArray(data?.rows) ? data.rows : [])
      } catch (e) {
        if (alive) setError(e.message || "โหลดรายงานไม่สำเร็จ")
      } finally {
        if (alive) setLoading(false)
      }
    })()
    return () => { alive = false }
  }, [reloadKey])

  const tableRows = useMemo(() => buildReportRows(reportRows), [reportRows])
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
        <Badge tone="neutral">ยอดรวมทุกสาขา (per ปีต้นกำเนิดหนี้)</Badge>
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

      <div ref={tableWrapRef} className="overflow-auto rounded-2xl border border-slate-200 dark:border-slate-700">
        <table className="border-collapse text-sm" style={{ tableLayout: "fixed", minWidth: "1200px" }}>
          <ReportHead />
          <ReportBody
            tableRows={tableRows}
            colTotals={colTotals}
            loading={loading}
            emptyDescription="ยังไม่มียอดหนี้ในระบบ — บันทึกรายการที่หน้าตารางหนี้แยกสาขา"
          />
        </table>
      </div>
      <StickyTableScrollbar tableRef={tableWrapRef} />
    </div>
  )
}
