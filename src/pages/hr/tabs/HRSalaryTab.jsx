// src/pages/hr/tabs/HRSalaryTab.jsx
// บัญชีเงินเดือน + เลื่อนขั้นเงินเดือน + ประวัติ (3D)
// API: GET /hr/salary-ladder?tier= · PATCH /hr/salary-ladder/{id} · GET /hr/salary-ladder/lookup
//      POST /hr/employees/{id}/salary-step-award · GET /hr/employees/{id}/salary-history
import { useState } from "react"
import { useNavigate } from "react-router-dom"
import SalaryLadderPanel from "../../../components/hr/SalaryLadderPanel"
import SalaryStepPanel from "../../../components/hr/SalaryStepPanel"
import SalaryHistoryTable from "../../../components/hr/SalaryHistoryTable"
import EmployeePicker from "../../../components/hr/EmployeePicker"
import usePositions from "../../../components/hr/usePositions"
import { cardCls } from "../../../components/hr/positionUtils"

const SUB_TABS = [
  ["step", "เลื่อนขั้น"],
  ["ladder", "บัญชีเงินเดือน"],
  ["history", "ประวัติรายบุคคล"],
]

export default function HRSalaryTab({ onGoToPositions }) {
  const [subTab, setSubTab] = useState("step")
  const navigate = useNavigate()
  // HRDashboard อ่านแท็บจาก ?tab= → ลิงก์ไปแท็บตำแหน่งงานได้โดยไม่ต้องแก้ HRDashboard
  const goToPositions = onGoToPositions ?? (() => navigate("/hr/dashboard?tab=positions"))

  return (
    <div className="space-y-4">
      <div role="tablist" aria-label="เงินเดือน" className="flex gap-1 rounded-xl bg-gray-100 dark:bg-gray-800 p-1 w-fit flex-wrap">
        {SUB_TABS.map(([v, label]) => (
          <button
            key={v}
            type="button"
            role="tab"
            aria-selected={subTab === v}
            onClick={() => setSubTab(v)}
            className={`px-4 py-2 rounded-lg text-sm font-semibold transition-colors duration-200 cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 ${subTab === v ? "bg-white dark:bg-gray-700 text-indigo-700 dark:text-indigo-300 shadow-sm" : "text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200"}`}
          >
            {label}
          </button>
        ))}
      </div>

      <div role="tabpanel">
        {subTab === "step" && <SalaryStepPanel onGoToPositions={goToPositions} />}
        {subTab === "ladder" && <SalaryLadderPanel />}
        {subTab === "history" && <HistoryByEmployee />}
      </div>
    </div>
  )
}

function HistoryByEmployee() {
  const { byId } = usePositions()
  const [empId, setEmpId] = useState("")
  return (
    <div className="space-y-4">
      <div className={cardCls + " p-4 max-w-2xl"}>
        <EmployeePicker id="hist-emp" value={empId} onChange={(v) => setEmpId(v)} positionsById={byId} />
      </div>
      {empId ? (
        <SalaryHistoryTable employeeId={empId} />
      ) : (
        <p className="text-sm text-gray-500 dark:text-gray-400">เลือกเจ้าหน้าที่เพื่อดูประวัติขั้นเงินเดือน</p>
      )}
    </div>
  )
}
