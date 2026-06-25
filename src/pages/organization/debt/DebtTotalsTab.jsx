import { useEffect, useMemo, useState } from "react"
import { apiAuth } from "../../../lib/api"
import SelectDropdown from "../../../components/SelectDropdown"
import { cx, cardCls } from "../../../lib/styles"
import { SkeletonTableRows, ErrorState, EmptyState } from "../../../components/ui"

// Column count for the summary table — keep in sync with the header below.
const SUMMARY_COLS = 6

const fmtMoney = (v) =>
  new Intl.NumberFormat("th-TH", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(parseFloat(v) || 0)

/**
 * Read-only outstanding-debt view. Under the v4 waterfall model balances are
 * derived on read — there is no editable "totals" ledger. This tab simply
 * renders GET /debt/summary (per branch/program/year), filtered server-side by
 * branch/program and client-side by fiscal year.
 */
export default function DebtTotalsTab({ branches, programs, fiscalYears }) {
  const [filters, setFilters] = useState({ branch_id: "", program_id: "", fiscal_year_id: "" })
  function setFilter(key, val) { setFilters((f) => ({ ...f, [key]: val })) }
  const hasFilters = filters.branch_id || filters.program_id || filters.fiscal_year_id

  const [rows, setRows]       = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError]     = useState("")
  const [reloadKey, setReloadKey] = useState(0)

  useEffect(() => {
    let alive = true
    setLoading(true)
    setError("")
    ;(async () => {
      try {
        const params = new URLSearchParams()
        if (filters.branch_id)  params.set("branch_id", filters.branch_id)
        if (filters.program_id) params.set("program_id", filters.program_id)
        const url = `/debt/summary${params.toString() ? "?" + params.toString() : ""}`
        const data = await apiAuth(url)
        if (alive) setRows(Array.isArray(data) ? data : [])
      } catch (e) {
        if (alive) setError(e.message || "โหลดข้อมูลไม่สำเร็จ")
      } finally {
        if (alive) setLoading(false)
      }
    })()
    return () => { alive = false }
  // fiscal_year_id is applied client-side, so it does not re-fetch.
  }, [filters.branch_id, filters.program_id, reloadKey])

  const branchOpts = [
    { value: "", label: "ทุกสาขา" },
    ...branches.map((b) => ({ value: String(b.id), label: b.name })),
  ]
  const progOpts = [
    { value: "", label: "ทุกโปรแกรม" },
    ...programs.filter((p) => p.is_active !== false).map((p) => ({ value: String(p.id), label: p.prog_name })),
  ]
  const yearOpts = [
    { value: "", label: "ทุกปีงบประมาณ" },
    ...fiscalYears.map((y) => ({ value: String(y.id), label: y.year_name })),
  ]

  const visibleRows = useMemo(
    () => (filters.fiscal_year_id
      ? rows.filter((r) => Number(r.fiscal_year_id) === Number(filters.fiscal_year_id))
      : rows),
    [rows, filters.fiscal_year_id]
  )

  const totalOriginal  = visibleRows.reduce((s, r) => s + parseFloat(r.original_amount || 0), 0)
  const totalPaid      = visibleRows.reduce((s, r) => s + parseFloat(r.total_paid || 0), 0)
  const totalRemaining = visibleRows.reduce((s, r) => s + parseFloat(r.remaining_amount || 0), 0)

  return (
    <div className="space-y-4">
      {/* Filter bar */}
      <div className={cx(cardCls, "p-4")}>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <div>
            <label className="mb-1 block text-xs font-medium text-gray-500 dark:text-gray-400">สาขา</label>
            <SelectDropdown options={branchOpts} value={filters.branch_id} onChange={(val) => setFilter("branch_id", val)} />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-gray-500 dark:text-gray-400">โปรแกรมหนี้</label>
            <SelectDropdown options={progOpts} value={filters.program_id} onChange={(val) => setFilter("program_id", val)} />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-gray-500 dark:text-gray-400">ปีงบประมาณ</label>
            <SelectDropdown options={yearOpts} value={filters.fiscal_year_id} onChange={(val) => setFilter("fiscal_year_id", val)} />
          </div>
        </div>
        {hasFilters && (
          <div className="mt-3 flex justify-end">
            <button
              onClick={() => setFilters({ branch_id: "", program_id: "", fiscal_year_id: "" })}
              className="rounded-xl px-3 py-1.5 text-sm text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-700 cursor-pointer transition-colors"
            >
              ล้างตัวกรอง
            </button>
          </div>
        )}
      </div>

      {/* Summary cards */}
      {visibleRows.length > 0 && (
        <div className="grid grid-cols-3 gap-3">
          {[
            { label: "ยอดหนี้รวม (ยกมา+เพิ่มในปี)", value: totalOriginal,  color: "text-gray-900 dark:text-gray-100" },
            { label: "ชำระแล้ว",                    value: totalPaid,      color: "text-emerald-700 dark:text-emerald-400" },
            { label: "ยอดคงเหลือ",                   value: totalRemaining, color: "text-red-600 dark:text-red-400" },
          ].map((s) => (
            <div key={s.label} className={cx(cardCls, "p-4 text-center")}>
              <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">{s.label}</p>
              <p className={cx("text-base font-bold tabular-nums", s.color)}>฿{fmtMoney(s.value)}</p>
            </div>
          ))}
        </div>
      )}

      <div className="flex items-center justify-between">
        <p className="text-sm text-gray-500 dark:text-gray-400">
          {loading ? "กำลังโหลด…" : `พบ ${visibleRows.length} รายการ`}
        </p>
        <p className="text-xs text-gray-400 dark:text-gray-500">ยอดคำนวณจากธุรกรรมอัตโนมัติ (อ่านอย่างเดียว)</p>
      </div>

      {error && !loading && (
        <ErrorState message={error} onRetry={() => setReloadKey((k) => k + 1)} />
      )}

      {!error && !loading && visibleRows.length === 0 ? (
        <div className={cx(cardCls, "overflow-hidden")}>
          <EmptyState
            title="ไม่พบข้อมูลหนี้คงค้าง"
            description={
              hasFilters
                ? "ไม่มีรายการที่ตรงกับตัวกรอง — ลองล้างตัวกรองหรือเลือกเงื่อนไขอื่น"
                : "ยังไม่มีหนี้คงค้างในระบบ — บันทึกยอดยกมา/หนี้เก่า หรือหนี้เพิ่มในปี ที่แท็บ “ธุรกรรม”"
            }
          />
        </div>
      ) : !error ? (
        <div className={cx(cardCls, "overflow-hidden")}>
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/60">
                  {["สาขา","โปรแกรมหนี้","ปีงบประมาณ","ยอดหนี้รวม","ชำระแล้ว","ยอดคงเหลือ"].map((h, i) => (
                    <th key={h} className={cx("px-4 py-3 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide whitespace-nowrap", i >= 3 ? "text-right" : "text-left")}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-700/60">
                {loading ? (
                  <SkeletonTableRows rows={6} cols={SUMMARY_COLS} />
                ) : (
                  visibleRows.map((row, i) => (
                    <tr key={`${row.branch_id}-${row.program_id}-${row.fiscal_year_id}-${i}`} className="hover:bg-gray-50 dark:hover:bg-gray-800/40 transition-colors">
                      <td className="px-4 py-3 font-medium text-gray-900 dark:text-gray-100 whitespace-nowrap">{row.branch_name}</td>
                      <td className="px-4 py-3 text-gray-700 dark:text-gray-300 whitespace-nowrap">{row.program_name}</td>
                      <td className="px-4 py-3 text-gray-700 dark:text-gray-300 whitespace-nowrap">{row.fiscal_year}</td>
                      <td className="px-4 py-3 text-right tabular-nums text-gray-900 dark:text-gray-100 whitespace-nowrap">฿{fmtMoney(row.original_amount)}</td>
                      <td className="px-4 py-3 text-right tabular-nums text-emerald-600 dark:text-emerald-400 whitespace-nowrap">฿{fmtMoney(row.total_paid)}</td>
                      <td className={cx("px-4 py-3 text-right tabular-nums font-semibold whitespace-nowrap",
                        parseFloat(row.remaining_amount) > 0 ? "text-red-600 dark:text-red-400" : "text-emerald-600 dark:text-emerald-400"
                      )}>
                        ฿{fmtMoney(row.remaining_amount)}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      ) : null}
    </div>
  )
}
