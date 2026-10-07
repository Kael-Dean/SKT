// src/pages/hr/tabs/HRKpiTab.jsx
// KPI v1.4.0 — ประเมิน · สรุปผล · ผช.ผจก. ตรวจสอบ · ผจก. อนุมัติ · ผลประกอบการ · KPI รายเดือน
// (handoff/api-handoff-kpi-v1.4.0.md). Sub-tab in &sub=, fiscal year in &fy= (both replace).
// Only the sub-tabs the current role can use are shown (getRoleId → getKpiPerms).
// Rendered inside HRDashboard (roles 1·3) and standalone at /hr/kpi (roles 1·2·3·7, see App.jsx).
import { useCallback, useMemo } from "react"
import { useSearchParams } from "react-router-dom"
import { cx, tabPanelCls } from "../../../lib/styles"
import { EmptyState, Tabs, panelId, tabId, useSubTab } from "../../../components/ui"
import FiscalYearHeader from "../../../components/hr/kpi/FiscalYearHeader"
import ScoresPanel from "../../../components/hr/kpi/ScoresPanel"
import FinalizePanel from "../../../components/hr/kpi/FinalizePanel"
import AsstReviewPanel from "../../../components/hr/kpi/AsstReviewPanel"
import ManagerApprovePanel from "../../../components/hr/kpi/ManagerApprovePanel"
import ProfitResultPanel from "../../../components/hr/kpi/ProfitResultPanel"
import MonthlyKpiPanel from "../../../components/hr/kpi/MonthlyKpiPanel"
import { useFiscalYearInfo, useKpiPeople } from "../../../components/hr/kpi/useKpi"
import { currentFiscalYear, getKpiPerms, num, windowPhase } from "../../../components/hr/kpi/kpiUtils"

const ID_BASE = "hr-kpi"

export default function HRKpiTab() {
  const perms = useMemo(() => getKpiPerms(), [])
  const [params, setParams] = useSearchParams()
  const fyRaw = params.get("fy")
  const fy = /^\d{4}$/.test(fyRaw ?? "") ? Number(fyRaw) : currentFiscalYear()
  const setFy = useCallback(
    (next) => setParams((prev) => {
      const p = new URLSearchParams(prev)
      p.set("fy", String(next))
      return p
    }, { replace: true }),
    [setParams]
  )

  const fyState = useFiscalYearInfo(fy)
  const { info, reload: reloadInfo } = fyState
  const phase = windowPhase(info)
  const people = useKpiPeople()
  const counts = info?.counts ?? {}

  const items = useMemo(() => {
    const all = [
      { value: "scores", label: "ประเมิน", show: perms.viewList },
      { value: "finalize", label: "สรุปผล", show: perms.finalize },
      { value: "asst", label: "ผช.ผจก. ตรวจสอบ", show: perms.asstReview, count: num(counts.finalized) || null },
      { value: "approve", label: "ผจก. อนุมัติ", show: perms.managerApprove, count: num(counts.asst_reviewed) || null },
      { value: "profit", label: "ผลประกอบการ", show: perms.profit },
      { value: "monthly", label: "KPI รายเดือน", show: perms.monthly },
    ]
    return all.filter((t) => t.show).map((t) => ({ value: t.value, label: t.label, count: t.count }))
  }, [perms, counts.finalized, counts.asst_reviewed])

  const [sub, setSub] = useSubTab(items.map((t) => t.value), items[0]?.value)

  if (items.length === 0) {
    return <EmptyState title="ไม่มีสิทธิ์ใช้งานส่วนนี้" description="บัญชีของคุณไม่มีสิทธิ์ดูหรือบันทึกการประเมิน KPI" />
  }

  const shared = { fy, info, phase, perms, people, onChanged: reloadInfo }

  return (
    <div className="space-y-4">
      <FiscalYearHeader fy={fy} onFyChange={setFy} fyState={fyState} canEditWindow={perms.editWindow} />

      <Tabs items={items} value={sub} onChange={setSub} ariaLabel="KPI" idBase={ID_BASE} />

      <div
        role="tabpanel"
        id={panelId(ID_BASE, sub)}
        aria-labelledby={tabId(ID_BASE, sub)}
        tabIndex={0}
        className={cx("space-y-4", tabPanelCls)}
      >
        {sub === "scores" && <ScoresPanel key={fy} {...shared} />}
        {sub === "finalize" && <FinalizePanel key={fy} {...shared} />}
        {sub === "asst" && <AsstReviewPanel key={fy} {...shared} />}
        {sub === "approve" && <ManagerApprovePanel key={fy} {...shared} />}
        {sub === "profit" && <ProfitResultPanel key={fy} {...shared} />}
        {sub === "monthly" && <MonthlyKpiPanel key={fy} {...shared} />}
      </div>
    </div>
  )
}
