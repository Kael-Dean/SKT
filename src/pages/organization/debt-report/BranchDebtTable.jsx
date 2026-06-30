import { Fragment, useEffect, useMemo, useRef, useState } from "react"
import { apiAuth } from "../../../lib/api"
import SelectDropdown from "../../../components/SelectDropdown"
import StickyTableScrollbar from "../../../components/StickyTableScrollbar"
import { cx, secondaryBtnCls } from "../../../lib/styles"
import { EmptyState, ErrorState } from "../../../components/ui"
import { getRoleId, getHomeBranch } from "../../../lib/auth"
import { buildReportRows, computeColTotals, sumRows } from "./buildReportRows"
import { printDebtTable } from "./printDebtTable"
import DebtEntryModal from "../debt/DebtEntryModal"
import { canWriteEntries, ROLE_GENERAL_STAFF } from "../debt/debtEntryMeta"

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
  sub: "bg-indigo-50 dark:bg-indigo-900/30",
  foot: "bg-emerald-100 dark:bg-emerald-900",
}

// Data cells per cohort row, in render order. money=true → format as ฿.
const cellsOf = (yr) => [
  { v: yr.carry_amount, money: true }, { v: yr.carry_count },
  { v: yr.new_amount, money: true },   { v: yr.new_count },
  { v: yr.paid_amount, money: true },  { v: yr.paid_count },
  { v: yr.remain_amount, money: true }, { v: yr.remain_count },
  { v: yr.mobile_amount, money: true },
  { v: yr.cash_amount, money: true },
  { v: yr.produce_amount, money: true },
]

const totalCells = (t) => [
  { v: t.carry_amount, money: true }, { v: t.carry_count },
  { v: t.new_amount, money: true },   { v: t.new_count },
  { v: t.paid_amount, money: true },  { v: t.paid_count },
  { v: t.remain_amount, money: true }, { v: t.remain_count },
  { v: t.mobile_amount, money: true },
  { v: t.cash_amount, money: true },
  { v: t.produce_amount, money: true },
]

/** Shared three-row column header — identical across branch / all-branches. */
function ReportHead() {
  return (
    <thead className="sticky top-0 z-20">
      <tr className={cx(STRIPE.head, "text-slate-800 dark:text-slate-100")}>
        <th rowSpan={3} className="border border-slate-300 dark:border-slate-600 px-1 py-2 text-center text-[11px] font-bold sticky left-0 z-10 bg-slate-100 dark:bg-slate-700" style={{ width: 50, minWidth: 50 }}>ลำดับ</th>
        <th rowSpan={3} className="border border-slate-300 dark:border-slate-600 px-2 py-2 text-left text-[11px] font-bold sticky left-[50px] z-10 bg-slate-100 dark:bg-slate-700" style={{ width: 180, minWidth: 180 }}>โครงการ</th>
        <th rowSpan={3} className="border border-slate-300 dark:border-slate-600 px-1 py-2 text-center text-[11px] font-bold sticky left-[230px] z-10 bg-slate-100 dark:bg-slate-700" style={{ width: 90, minWidth: 90 }}>ปีการผลิต</th>
        <th colSpan={2} className="border border-slate-300 dark:border-slate-600 px-1 py-1.5 text-center text-[11px] font-bold">ยกมา</th>
        <th colSpan={2} className="border border-slate-300 dark:border-slate-600 px-1 py-1.5 text-center text-[11px] font-bold">เพิ่มในปี</th>
        <th colSpan={2} className="border border-slate-300 dark:border-slate-600 px-1 py-1.5 text-center text-[11px] font-bold">ชำระ</th>
        <th colSpan={2} className="border border-slate-300 dark:border-slate-600 px-1 py-1.5 text-center text-[11px] font-bold">คงเหลือ</th>
        <th colSpan={3} className="border border-slate-300 dark:border-slate-600 px-1 py-1.5 text-center text-[11px] font-bold bg-indigo-50 dark:bg-indigo-900/20">ชำระแยกตามวิธี (บาท)</th>
        <th rowSpan={3} className="border border-slate-300 dark:border-slate-600 px-1 py-2 text-center text-[11px] font-bold" style={{ width: 100, minWidth: 100 }}>หมายเหตุ</th>
      </tr>
      <tr className={cx(STRIPE.head, "text-slate-800 dark:text-slate-100")}>
        {Array(8).fill(null).map((_, i) => (
          <th key={i} className="border border-slate-300 dark:border-slate-600" style={{ width: 80, minWidth: 80 }} />
        ))}
        <th rowSpan={2} className="border border-slate-300 dark:border-slate-600 px-0.5 py-1 text-center text-[10px] font-semibold bg-indigo-50 dark:bg-indigo-900/20" style={{ width: 90, minWidth: 90 }}>โอนผ่านมือถือ</th>
        <th rowSpan={2} className="border border-slate-300 dark:border-slate-600 px-0.5 py-1 text-center text-[10px] font-semibold bg-indigo-50 dark:bg-indigo-900/20" style={{ width: 90, minWidth: 90 }}>เงินสด</th>
        <th rowSpan={2} className="border border-slate-300 dark:border-slate-600 px-0.5 py-1 text-center text-[10px] font-semibold bg-indigo-50 dark:bg-indigo-900/20" style={{ width: 90, minWidth: 90 }}>ชำระด้วยผลผลิต</th>
      </tr>
      <tr className={cx(STRIPE.head, "text-slate-700 dark:text-slate-300")}>
        {Array(4).fill(null).flatMap((_, i) => [
          <th key={`a${i}`} className="border border-slate-300 dark:border-slate-600 px-0.5 py-1 text-center text-[10px]" style={{ width: 85, minWidth: 85 }}>บาท</th>,
          <th key={`b${i}`} className="border border-slate-300 dark:border-slate-600 px-0.5 py-1 text-center text-[10px]" style={{ width: 60, minWidth: 60 }}>ราย</th>,
        ])}
      </tr>
    </thead>
  )
}

/** Shared tbody/tfoot renderer — branch & all-branches differ only in chrome. */
export function ReportBody({ tableRows, colTotals, loading, emptyDescription, emptyAction }) {
  return (
    <>
      <tbody>
        {tableRows.length === 0 ? (
          <tr>
            <td colSpan={15} className={cx(STRIPE.cell, "p-0")}>
              <EmptyState
                title={loading ? "กำลังโหลด…" : "ยังไม่มีข้อมูลหนี้"}
                description={loading ? "กำลังดึงรายงานหนี้" : emptyDescription}
                action={loading ? null : emptyAction}
              />
            </td>
          </tr>
        ) : (
          tableRows.map((group, gi) => {
            const rowBg = gi % 2 === 0 ? STRIPE.cell : STRIPE.alt
            const groupTotal = sumRows(group.yearRows)
            return (
              <Fragment key={group.program.id}>
                {group.yearRows.map((yr, yi) => (
                  <tr key={`${group.program.id}-${yr.fiscalYear.id}`} className={rowBg}>
                    {yi === 0 && (
                      <>
                        <td rowSpan={group.yearRows.length} className={cx("border border-slate-200 dark:border-slate-700 px-1 py-2 text-center text-xs sticky left-0 z-10", rowBg)}>{gi + 1}</td>
                        <td rowSpan={group.yearRows.length} className={cx("border border-slate-200 dark:border-slate-700 px-2 py-2 text-xs font-medium sticky left-[50px] z-10", rowBg)}>{group.program.prog_name}</td>
                      </>
                    )}
                    <td className={cx("border border-slate-200 dark:border-slate-700 px-1 py-2 text-center text-xs sticky left-[230px] z-10", rowBg)}>{yr.fiscalYear.year_name}</td>
                    {cellsOf(yr).map((c, ci) => (
                      <td key={ci} className="border border-slate-200 dark:border-slate-700 px-1 py-2 text-right text-xs tabular-nums">
                        {c.money ? fmtMoney(c.v) : (c.v || 0)}
                      </td>
                    ))}
                    <td className="border border-slate-200 dark:border-slate-700 px-1 py-2 text-xs text-gray-500 dark:text-gray-400">{yr.note || ""}</td>
                  </tr>
                ))}
                <tr key={`${group.program.id}-subtotal`} className={STRIPE.sub}>
                  <td colSpan={3} className={cx("border border-slate-300 dark:border-slate-600 px-2 py-2 text-xs font-bold text-indigo-900 dark:text-indigo-200 sticky left-0 z-10", STRIPE.sub)}>
                    รวม {group.program.prog_name}
                  </td>
                  {totalCells(groupTotal).map((c, ci) => (
                    <td key={ci} className={cx("border border-slate-300 dark:border-slate-600 px-1 py-2 text-right text-xs font-bold text-indigo-900 dark:text-indigo-200 tabular-nums", STRIPE.sub)}>
                      {c.money ? fmtMoney(c.v) : (c.v || 0)}
                    </td>
                  ))}
                  <td className={cx("border border-slate-300 dark:border-slate-600", STRIPE.sub)} />
                </tr>
              </Fragment>
            )
          })
        )}
      </tbody>
      <tfoot>
        <tr className={STRIPE.foot}>
          <td colSpan={3} className={cx("border border-slate-300 dark:border-slate-600 px-2 py-2 text-xs font-bold sticky left-0 z-10", STRIPE.foot)}>รวมทั้งหมด</td>
          {totalCells(colTotals).map((c, ci) => (
            <td key={ci} className={cx("border border-slate-300 dark:border-slate-600 px-1 py-2 text-right text-xs font-bold tabular-nums", STRIPE.foot)}>
              {c.money ? fmtMoney(c.v) : (c.v || 0)}
            </td>
          ))}
          <td className={cx("border border-slate-300 dark:border-slate-600", STRIPE.foot)} />
        </tr>
      </tfoot>
    </>
  )
}

export { ReportHead, STRIPE }

export default function BranchDebtTable({ programs, fiscalYears, branches, onBack }) {
  const roleId = getRoleId()
  const canWrite = canWriteEntries(roleId)
  const isGeneralStaff = roleId === ROLE_GENERAL_STAFF
  const homeBranch = getHomeBranch()

  // Role 5 is branch-locked: pin the view to their own branch.
  const lockedToOwnBranch = isGeneralStaff && homeBranch != null
  const [selectedBranchId, setSelectedBranchId] = useState(
    lockedToOwnBranch ? String(homeBranch) : ""
  )
  const [reportRows, setReportRows] = useState([])
  const [loading, setLoading]       = useState(false)
  const [error, setError]           = useState("")
  const [reloadKey, setReloadKey]   = useState(0)
  const [modal, setModal]           = useState(null)

  const tableWrapRef = useRef(null)

  useEffect(() => {
    let alive = true
    setLoading(true)
    setError("")
    ;(async () => {
      try {
        const url = `/debt/report${selectedBranchId ? `?branch_id=${selectedBranchId}` : ""}`
        const data = await apiAuth(url)
        if (alive) setReportRows(Array.isArray(data?.rows) ? data.rows : [])
      } catch (e) {
        if (alive) setError(e.message || "โหลดรายงานไม่สำเร็จ")
      } finally {
        if (alive) setLoading(false)
      }
    })()
    return () => { alive = false }
  }, [selectedBranchId, reloadKey])

  function refetchReport() { setReloadKey((k) => k + 1) }

  const tableRows = useMemo(() => buildReportRows(reportRows), [reportRows])
  const colTotals = useMemo(() => computeColTotals(tableRows), [tableRows])

  function branchName(id) {
    return branches.find((b) => b.id === Number(id))?.name || `สาขา ${id}`
  }

  // Branch the new entry is locked to: role 5 → own branch; else the selected
  // branch (null = let the user pick inside the modal).
  const addBranchLock = lockedToOwnBranch
    ? { id: homeBranch, name: branchName(homeBranch) }
    : selectedBranchId
      ? { id: Number(selectedBranchId), name: branchName(selectedBranchId) }
      : null

  const branchOpts = [
    { value: "", label: "ทุกสาขา" },
    ...branches.map((b) => ({ value: String(b.id), label: b.name })),
  ]

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
          ตารางหนี้แยกสาขา
        </h2>
      </div>

      <div className="flex flex-wrap items-center gap-3 mb-4">
        {!lockedToOwnBranch && (
          <div className="w-64">
            <SelectDropdown
              options={branchOpts}
              value={selectedBranchId}
              onChange={setSelectedBranchId}
              placeholder="— เลือกสาขา —"
            />
          </div>
        )}
        {lockedToOwnBranch && (
          <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-4 py-2 text-sm text-slate-700 dark:text-slate-300">
            สาขา: <span className="font-semibold">{branchName(homeBranch)}</span>
          </div>
        )}
        {canWrite && (
          <button
            onClick={() => setModal({ mode: "add" })}
            className={cx(secondaryBtnCls, "!py-2 !px-4 !text-sm cursor-pointer")}
          >
            + บันทึกรายการหนี้
          </button>
        )}
        <button
          onClick={() =>
            printDebtTable({
              title: "ตารางหนี้แยกสาขา",
              subtitle: selectedBranchId ? `สาขา: ${branchName(selectedBranchId)}` : "ทุกสาขา",
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
          <ErrorState message={error} onRetry={refetchReport} />
        </div>
      )}

      <div className="relative left-1/2 w-screen max-w-[100vw] -translate-x-1/2 px-4 md:px-6">
        <div ref={tableWrapRef} className="overflow-auto rounded-2xl border border-slate-200 dark:border-slate-700">
          <table className="border-collapse text-sm" style={{ tableLayout: "fixed", minWidth: "1200px", width: "100%" }}>
          <ReportHead />
          <ReportBody
            tableRows={tableRows}
            colTotals={colTotals}
            loading={loading}
            emptyDescription={
              canWrite
                ? "ยังไม่มีรายการหนี้ในมุมมองนี้ — กด “บันทึกรายการหนี้” เพื่อเริ่มต้น"
                : "ยังไม่มีรายการหนี้ในมุมมองนี้"
            }
            emptyAction={
              canWrite ? (
                <button
                  type="button"
                  onClick={() => setModal({ mode: "add" })}
                  className={cx(secondaryBtnCls, "!py-2 !px-4 !text-sm cursor-pointer")}
                >
                  + บันทึกรายการหนี้
                </button>
              ) : null
            }
          />
          </table>
        </div>
        <StickyTableScrollbar tableRef={tableWrapRef} hidden={!!modal} />
      </div>

      {modal?.mode === "add" && (
        <DebtEntryModal
          mode="add"
          branches={branches}
          programs={programs}
          fiscalYears={fiscalYears}
          branchLock={addBranchLock}
          onClose={() => setModal(null)}
          onSaved={refetchReport}
        />
      )}
    </div>
  )
}
