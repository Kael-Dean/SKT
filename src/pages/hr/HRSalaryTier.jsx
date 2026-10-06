// src/pages/hr/HRSalaryTier.jsx
// หน้า /hr/salary-tier — บัญชีเงินเดือน, เลื่อนขั้น และตำแหน่งงาน (3D)
// Auth: Role 1 (ADMIN) หรือ 3 (HR) — guard อยู่ที่ App.jsx
// ใช้ component กลางใน src/components/hr/ + Tabs/useSubTab ตัวเดียวกับแท็บใน HRDashboard
// (หน้านี้ไม่มี ?tab= — sub-tab เก็บใน &sub=ladder|step|positions)
import SalaryLadderPanel from "../../components/hr/SalaryLadderPanel"
import SalaryStepPanel from "../../components/hr/SalaryStepPanel"
import PositionsManager from "../../components/hr/PositionsManager"
import { Tabs, panelId, tabId, useSubTab } from "../../components/ui"

const ID_BASE = "salary-tier"
const TABS = [
  { value: "ladder", label: "บัญชีเงินเดือน" },
  { value: "step", label: "เลื่อนขั้น" },
  { value: "positions", label: "ตำแหน่งงาน" },
]
const TAB_VALUES = TABS.map((t) => t.value)

export default function HRSalaryTier() {
  const [tab, setTab] = useSubTab(TAB_VALUES, "ladder")

  return (
    <div className="space-y-5 pb-10">
      <div>
        <h1 className="text-xl font-bold text-gray-900 dark:text-gray-100">บัญชีเงินเดือนและตำแหน่ง</h1>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
          ดูและแก้เงินเดือนแต่ละขั้นของกระบอก เลื่อนขั้นเจ้าหน้าที่ และกำหนดระดับของตำแหน่งงาน
        </p>
      </div>

      <Tabs items={TABS} value={tab} onChange={setTab} ariaLabel="บัญชีเงินเดือนและตำแหน่ง" idBase={ID_BASE} />

      <div
        role="tabpanel"
        id={panelId(ID_BASE, tab)}
        aria-labelledby={tabId(ID_BASE, tab)}
        tabIndex={0}
        className="rounded-2xl focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500/40"
      >
        {tab === "ladder" && <SalaryLadderPanel />}
        {tab === "step" && <SalaryStepPanel onGoToPositions={() => setTab("positions")} />}
        {tab === "positions" && <PositionsManager />}
      </div>
    </div>
  )
}
