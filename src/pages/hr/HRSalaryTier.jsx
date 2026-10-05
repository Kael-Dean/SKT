// src/pages/hr/HRSalaryTier.jsx
// หน้า /hr/salary-tier — บัญชีเงินเดือน, เลื่อนขั้น และตำแหน่งงาน (3D)
// Auth: Role 1 (ADMIN) หรือ 3 (HR) — guard อยู่ที่ App.jsx
// ใช้ component กลางใน src/components/hr/ ตัวเดียวกับแท็บใน HRDashboard
import { useState } from "react"
import SalaryLadderPanel from "../../components/hr/SalaryLadderPanel"
import SalaryStepPanel from "../../components/hr/SalaryStepPanel"
import PositionsManager from "../../components/hr/PositionsManager"

const TABS = [
  { key: "ladder", label: "บัญชีเงินเดือน" },
  { key: "step", label: "เลื่อนขั้น" },
  { key: "positions", label: "ตำแหน่งงาน" },
]

export default function HRSalaryTier() {
  const [tab, setTab] = useState("ladder")

  return (
    <div className="space-y-5 pb-10">
      <div>
        <h1 className="text-xl font-bold text-gray-900 dark:text-gray-100">บัญชีเงินเดือนและตำแหน่ง</h1>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
          ดูและแก้เงินเดือนแต่ละขั้นของกระบอก เลื่อนขั้นเจ้าหน้าที่ และกำหนดระดับของตำแหน่งงาน
        </p>
      </div>

      <div role="tablist" aria-label="บัญชีเงินเดือนและตำแหน่ง" className="flex gap-1 rounded-xl bg-gray-100 dark:bg-gray-800 p-1 w-fit flex-wrap">
        {TABS.map(({ key, label }) => (
          <button
            key={key}
            type="button"
            role="tab"
            aria-selected={tab === key}
            onClick={() => setTab(key)}
            className={`px-4 py-1.5 rounded-lg text-sm font-semibold transition-colors duration-200 cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 ${
              tab === key
                ? "bg-white dark:bg-gray-700 text-indigo-700 dark:text-indigo-300 shadow-sm"
                : "text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      <div role="tabpanel">
        {tab === "ladder" && <SalaryLadderPanel />}
        {tab === "step" && <SalaryStepPanel onGoToPositions={() => setTab("positions")} />}
        {tab === "positions" && <PositionsManager />}
      </div>
    </div>
  )
}
