import { useEffect, useState } from "react"
import { useSearchParams } from "react-router-dom"
import { apiAuth } from "../../../lib/api"
import { getUser, getRoleId } from "../../../lib/auth"
import { cx, baseField, cardCls, pageTitleCls } from "../../../lib/styles"
import DebtTotalsTab       from "./DebtTotalsTab"
import DebtTransactionsTab from "./DebtTransactionsTab"
import DebtProgramsTab     from "./DebtProgramsTab"

const ROLE = { ADMIN: 1, HA: 4, MKT: 5 }

export default function DebtTracking() {
  const roleId = getRoleId()
  const canManagePrograms = roleId === ROLE.ADMIN || roleId === ROLE.HA

  const [searchParams, setSearchParams] = useSearchParams()
  const rawTab = searchParams.get("tab") || "totals"
  const activeTab = rawTab === "programs" && !canManagePrograms ? "totals" : rawTab

  function setTab(key) {
    setSearchParams({ tab: key })
    window.scrollTo({ top: 0, behavior: "smooth" })
  }

  // ─── Shared reference data ───────────────────────────────────────────────
  const [units, setUnits]             = useState([])
  const [fiscalYears, setFiscalYears] = useState([])
  const [programs, setPrograms]       = useState([])
  const [allTotals, setAllTotals]     = useState([])
  const [loadingRefs, setLoadingRefs] = useState(true)
  const [errorRefs, setErrorRefs]     = useState("")

  useEffect(() => {
    let alive = true
    setLoadingRefs(true)
    setErrorRefs("")
    ;(async () => {
      try {
        const branchId = getUser()?.branch_id
        const [unitsData, yearsData, progsData, totalsData] = await Promise.allSettled([
          apiAuth(branchId ? `/lists/unit/search?branch_id=${branchId}` : "/lists/unit/search"),
          apiAuth("/productyear"),
          apiAuth("/debt/programs"),
          apiAuth("/debt/totals"),
        ])

        if (!alive) return

        if (unitsData.status === "fulfilled") {
          const rows = Array.isArray(unitsData.value) ? unitsData.value : []
          setUnits(rows.map((r) => ({
            id: Number(r.id || 0),
            name: r.unit_name || r.klang_name || r.unit || r.name || `หน่วย ${r.id}`,
          })).filter((r) => r.id > 0))
        }

        if (yearsData.status === "fulfilled") {
          const rows = Array.isArray(yearsData.value) ? yearsData.value : []
          setFiscalYears(rows.map((r) => ({
            id: Number(r.id || 0),
            year_name: r.year_name || r.year || String(r.id),
          })).filter((r) => r.id > 0))
        }

        if (progsData.status === "fulfilled") {
          setPrograms(Array.isArray(progsData.value) ? progsData.value : [])
        }

        if (totalsData.status === "fulfilled") {
          setAllTotals(Array.isArray(totalsData.value) ? totalsData.value.filter((r) => r.is_active !== false) : [])
        }
      } catch (e) {
        if (alive) setErrorRefs(e.message || "โหลดข้อมูลอ้างอิงไม่สำเร็จ")
      } finally {
        if (alive) setLoadingRefs(false)
      }
    })()
    return () => { alive = false }
  }, [])

  async function reloadPrograms() {
    try {
      const data = await apiAuth("/debt/programs")
      setPrograms(Array.isArray(data) ? data : [])
    } catch {}
  }

  async function reloadTotals() {
    try {
      const data = await apiAuth("/debt/totals")
      setAllTotals(Array.isArray(data) ? data.filter((r) => r.is_active !== false) : [])
    } catch {}
  }

  // ─── Filter bar state ────────────────────────────────────────────────────
  const [filters, setFilters] = useState({ unit_id: "", program_id: "", fiscal_year_id: "" })
  function setFilter(key, val) {
    setFilters((f) => ({ ...f, [key]: val }))
  }

  const TABS = [
    { key: "totals",       label: "ยอดหนี้คงค้าง" },
    { key: "transactions", label: "ธุรกรรม" },
    ...(canManagePrograms ? [{ key: "programs", label: "โปรแกรมหนี้" }] : []),
  ]

  return (
    <div className="space-y-5 py-2">
      {/* Page header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className={pageTitleCls}>ติดตามผลหนี้</h1>
          <p className="mt-0.5 text-sm text-gray-500 dark:text-gray-400">
            บันทึกและติดตามยอดหนี้คงค้างของสมาชิก
          </p>
        </div>
      </div>

      {/* Filter bar — only show on totals tab */}
      {activeTab === "totals" && (
        <div className={cx(cardCls, "p-4")}>
          <div className="flex flex-wrap items-end gap-3">
            <div className="flex-1 min-w-[140px]">
              <label className="mb-1 block text-xs font-medium text-gray-500 dark:text-gray-400">หน่วยงาน</label>
              <select className={cx(baseField, "!py-2 !text-sm")} value={filters.unit_id} onChange={(e) => setFilter("unit_id", e.target.value)}>
                <option value="">ทั้งหมด</option>
                {units.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
              </select>
            </div>
            <div className="flex-1 min-w-[140px]">
              <label className="mb-1 block text-xs font-medium text-gray-500 dark:text-gray-400">โปรแกรมหนี้</label>
              <select className={cx(baseField, "!py-2 !text-sm")} value={filters.program_id} onChange={(e) => setFilter("program_id", e.target.value)}>
                <option value="">ทั้งหมด</option>
                {programs.filter((p) => p.is_active !== false).map((p) => <option key={p.id} value={p.id}>{p.prog_name}</option>)}
              </select>
            </div>
            <div className="flex-1 min-w-[140px]">
              <label className="mb-1 block text-xs font-medium text-gray-500 dark:text-gray-400">ปีงบประมาณ</label>
              <select className={cx(baseField, "!py-2 !text-sm")} value={filters.fiscal_year_id} onChange={(e) => setFilter("fiscal_year_id", e.target.value)}>
                <option value="">ทั้งหมด</option>
                {fiscalYears.map((y) => <option key={y.id} value={y.id}>{y.year_name}</option>)}
              </select>
            </div>
            {(filters.unit_id || filters.program_id || filters.fiscal_year_id) && (
              <button
                onClick={() => setFilters({ unit_id: "", program_id: "", fiscal_year_id: "" })}
                className="rounded-xl px-3 py-2 text-sm text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-700 cursor-pointer transition-colors"
              >
                ล้างตัวกรอง
              </button>
            )}
          </div>
        </div>
      )}

      {errorRefs && (
        <div className="rounded-2xl bg-amber-50 dark:bg-amber-900/20 px-4 py-3 text-sm text-amber-700 dark:text-amber-400">
          โหลดข้อมูลอ้างอิงบางส่วนไม่สำเร็จ: {errorRefs}
        </div>
      )}

      {/* Tab bar */}
      <div className={cx(cardCls, "p-1 flex gap-1")}>
        {TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={cx(
              "flex-1 rounded-xl px-4 py-2.5 text-sm font-medium transition-all duration-150 cursor-pointer",
              activeTab === t.key
                ? "bg-indigo-600 text-white shadow-sm"
                : "text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700/60"
            )}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      {loadingRefs && activeTab !== "programs" ? (
        <div className="flex justify-center py-12">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-gray-200 border-t-indigo-500 dark:border-gray-700 dark:border-t-indigo-400" />
        </div>
      ) : (
        <>
          {activeTab === "totals" && (
            <DebtTotalsTab
              roleId={roleId}
              units={units}
              programs={programs}
              fiscalYears={fiscalYears}
              filters={filters}
              onTotalsChanged={reloadTotals}
            />
          )}
          {activeTab === "transactions" && (
            <DebtTransactionsTab
              roleId={roleId}
              totals={allTotals}
            />
          )}
          {activeTab === "programs" && canManagePrograms && (
            <DebtProgramsTab
              roleId={roleId}
              programs={programs}
              onProgramsChanged={reloadPrograms}
            />
          )}
        </>
      )}
    </div>
  )
}
