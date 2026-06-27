import { useEffect, useState } from "react"
import { useSearchParams } from "react-router-dom"
import { apiAuth } from "../../../lib/api"
import { getRoleId } from "../../../lib/auth"
import { cx, cardCls, pageTitleCls } from "../../../lib/styles"
import { PageLoader, ErrorState } from "../../../components/ui"
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

  // ─── Shared reference data ────────────────────────────────────────────────
  const [branches, setBranches]       = useState([])
  const [fiscalYears, setFiscalYears] = useState([])
  const [programs, setPrograms]       = useState([])
  const [loadingRefs, setLoadingRefs] = useState(true)
  const [errorRefs, setErrorRefs]     = useState("")
  // Bumping this re-runs the reference-data effect (used by ErrorState retry).
  const [reloadKey, setReloadKey]     = useState(0)

  useEffect(() => {
    let alive = true
    setLoadingRefs(true)
    setErrorRefs("")
    ;(async () => {
      try {
        const [branchesData, yearsData, progsData] = await Promise.allSettled([
          apiAuth("/debt/lookup/branches"),
          apiAuth("/debt/lookup/fiscal-years"),
          apiAuth("/debt/programs"),
        ])
        if (!alive) return

        if (branchesData.status === "fulfilled") {
          const rows = Array.isArray(branchesData.value) ? branchesData.value : []
          setBranches(rows.map((r) => ({
            id: Number(r.id || 0),
            name: r.branch_name || `สาขา ${r.id}`,
          })).filter((r) => r.id > 0))
        }
        if (yearsData.status === "fulfilled") {
          const rows = Array.isArray(yearsData.value) ? yearsData.value : []
          setFiscalYears(rows.map((r) => ({
            id: Number(r.id || 0),
            year_name: r.year || r.year_name || String(r.id),
          })).filter((r) => r.id > 0))
        }
        if (progsData.status === "fulfilled") {
          setPrograms(Array.isArray(progsData.value) ? progsData.value : [])
        }
        // Surface a problem only if every reference call failed (otherwise the
        // page still renders with whatever loaded — preserves prior behavior).
        const allFailed = [branchesData, yearsData, progsData].every(
          (r) => r.status === "rejected"
        )
        if (allFailed) {
          const first = [branchesData, yearsData, progsData].find((r) => r.status === "rejected")
          setErrorRefs(first?.reason?.message || "โหลดข้อมูลอ้างอิงไม่สำเร็จ")
        }
      } catch (e) {
        if (alive) setErrorRefs(e.message || "โหลดข้อมูลอ้างอิงไม่สำเร็จ")
      } finally {
        if (alive) setLoadingRefs(false)
      }
    })()
    return () => { alive = false }
  }, [reloadKey])

  async function reloadPrograms() {
    try {
      const data = await apiAuth("/debt/programs")
      setPrograms(Array.isArray(data) ? data : [])
    } catch {
      // Silent: a failed background refresh keeps the last good list.
    }
  }

  const TABS = [
    { key: "totals",       label: "ยอดหนี้คงค้าง" },
    { key: "transactions", label: "ธุรกรรม" },
    ...(canManagePrograms ? [{ key: "programs", label: "โปรแกรมหนี้" }] : []),
  ]

  return (
    <div className="space-y-5 py-2">
      {/* Page header */}
      <div>
        <h1 className={pageTitleCls}>ติดตามผลหนี้</h1>
        <p className="mt-0.5 text-sm text-gray-500 dark:text-gray-400">
          บันทึกและติดตามยอดหนี้คงค้างของสมาชิก
        </p>
      </div>

      {errorRefs && (
        <ErrorState
          message={`โหลดข้อมูลอ้างอิงไม่สำเร็จ: ${errorRefs}`}
          onRetry={() => setReloadKey((k) => k + 1)}
        />
      )}

      {/* Tab bar — segmented control with ARIA tablist semantics */}
      <div className={cx(cardCls, "p-1 flex gap-1")} role="tablist" aria-label="มุมมองติดตามผลหนี้">
        {TABS.map((t) => {
          const isActive = activeTab === t.key
          return (
            <button
              key={t.key}
              type="button"
              role="tab"
              aria-selected={isActive}
              onClick={() => setTab(t.key)}
              className={cx(
                "flex-1 rounded-xl px-4 py-2.5 text-sm font-medium transition-colors duration-150 cursor-pointer",
                "focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-1 dark:focus-visible:ring-offset-gray-800",
                isActive
                  ? "bg-indigo-600 text-white shadow-sm"
                  : "text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700/60"
              )}
            >
              {t.label}
            </button>
          )
        })}
      </div>

      {/* Tab content — all tabs receive the same top-level layout slot */}
      {loadingRefs ? (
        <PageLoader variant="table" rows={6} message="กำลังโหลดข้อมูลหนี้…" />
      ) : errorRefs ? null : (
        <>
          {activeTab === "totals" && (
            <DebtTotalsTab
              branches={branches}
              programs={programs}
              fiscalYears={fiscalYears}
            />
          )}
          {activeTab === "transactions" && (
            <DebtTransactionsTab
              roleId={roleId}
              branches={branches}
              programs={programs}
              fiscalYears={fiscalYears}
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
