// src/pages/hr/tabs/HRSalaryTab.jsx
// เงินเดือน: เลื่อนขั้น · บัญชีเงินเดือน · ประวัติรายบุคคล (3D) — sub-tab อยู่ใน URL (&sub=step|ladder|history)
// API: GET /hr/salary-ladder?tier= · PATCH /hr/salary-ladder/{id} · GET /hr/salary-ladder/lookup
//      POST /hr/employees/{id}/salary-step-award · GET /hr/employees/{id}/salary-history
// PageSection header (ชื่อ/คำอธิบาย) มาจาก HRDashboard (HR_NAV) — ไฟล์นี้เริ่มที่ Tabs
import { useState } from "react"
import { useNavigate } from "react-router-dom"
import { UserSearch } from "lucide-react"
import SalaryLadderPanel from "../../../components/hr/SalaryLadderPanel"
import SalaryStepPanel from "../../../components/hr/SalaryStepPanel"
import SalaryHistoryTable from "../../../components/hr/SalaryHistoryTable"
import SalarySummaryCard from "../../../components/hr/SalarySummaryCard"
import EmployeePicker from "../../../components/hr/EmployeePicker"
import usePositions from "../../../components/hr/usePositions"
import { useEmployeeSalary } from "../../../components/hr/salaryData"
import { cardCls } from "../../../components/hr/positionUtils"
import { EmptyState, ErrorState, Tabs, panelId, tabId, useSubTab } from "../../../components/ui"

const ID_BASE = "salary"
const SUB_TABS = [
  { value: "step", label: "เลื่อนขั้น" },
  { value: "ladder", label: "บัญชีเงินเดือน" },
  { value: "history", label: "ประวัติรายบุคคล" },
]
const SUB_VALUES = SUB_TABS.map((t) => t.value)

export default function HRSalaryTab({ onGoToPositions }) {
  const [sub, setSub] = useSubTab(SUB_VALUES, "step")
  const navigate = useNavigate()
  // HRDashboard ส่ง onGoToPositions มา (rail navigation); ถ้าไม่มีใช้ ?tab= ตรง ๆ แทน
  const goToPositions = onGoToPositions ?? (() => navigate("/hr/dashboard?tab=positions"))

  return (
    <div className="space-y-5">
      <Tabs items={SUB_TABS} value={sub} onChange={setSub} ariaLabel="เงินเดือน" idBase={ID_BASE} />

      <div
        role="tabpanel"
        id={panelId(ID_BASE, sub)}
        aria-labelledby={tabId(ID_BASE, sub)}
        tabIndex={0}
        className="rounded-2xl focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500/40"
      >
        {sub === "step" && <SalaryStepPanel onGoToPositions={goToPositions} />}
        {sub === "ladder" && <SalaryLadderPanel />}
        {sub === "history" && <HistoryByEmployee onGoToPositions={goToPositions} />}
      </div>
    </div>
  )
}

function HistoryByEmployee({ onGoToPositions }) {
  const { byId, loading: positionsLoading, error: positionsError, reload } = usePositions()
  const [empId, setEmpId] = useState("")
  const [emp, setEmp] = useState(null)
  const info = useEmployeeSalary(empId, 0, byId, emp)

  return (
    <div className="max-w-4xl space-y-4">
      <EmployeePicker
        id="hist-emp"
        value={empId}
        onChange={(v, record) => { setEmpId(v); setEmp(record) }}
        positionsById={byId}
      />
      {positionsError && <ErrorState message={positionsError} onRetry={reload} />}
      {empId ? (
        <>
          <SalarySummaryCard emp={emp} info={info} positionsLoading={positionsLoading} onGoToPositions={onGoToPositions} />
          <SalaryHistoryTable employeeId={empId} title="ประวัติการเลื่อนขั้น" />
        </>
      ) : (
        <div className={cardCls}>
          <EmptyState
            icon={<UserSearch aria-hidden="true" className="size-10" strokeWidth={1.5} />}
            title="เลือกเจ้าหน้าที่เพื่อดูประวัติการเลื่อนขั้น"
          />
        </div>
      )}
    </div>
  )
}
