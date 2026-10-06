// src/pages/hr/tabs/HRSalaryTab.jsx
// เงินเดือน: รายชื่อทั้งหมด · เลื่อนขั้น · บัญชีเงินเดือน · ประวัติรายบุคคล (3D)
//   sub-tab อยู่ใน URL (&sub=roster|step|ladder|history) · เลือกคนไว้ล่วงหน้าด้วย &emp=<id> (step/history)
// API: GET /hr/salary-ladder?tier= · PATCH /hr/salary-ladder/{id} · GET /hr/salary-ladder/lookup
//      POST /hr/employees/{id}/salary-step-award · GET /hr/employees/{id}/salary-history
// PageSection header (ชื่อ/คำอธิบาย) มาจาก HRDashboard (HR_NAV) — ไฟล์นี้เริ่มที่ Tabs
import { useEffect, useState } from "react"
import { useNavigate, useSearchParams } from "react-router-dom"
import { UserSearch } from "lucide-react"
import SalaryLadderPanel from "../../../components/hr/SalaryLadderPanel"
import SalaryStepPanel from "../../../components/hr/SalaryStepPanel"
import SalaryHistoryTable from "../../../components/hr/SalaryHistoryTable"
import SalarySummaryCard from "../../../components/hr/SalarySummaryCard"
import SalaryRosterPanel from "../../../components/hr/SalaryRosterPanel"
import EmployeePicker from "../../../components/hr/EmployeePicker"
import usePositions from "../../../components/hr/usePositions"
import { useEmployeeSalary } from "../../../components/hr/salaryData"
import { getCachedPersonnel, loadPersonnel } from "../../../components/hr/personnelCache"
import { cardCls } from "../../../components/hr/positionUtils"
import { EmptyState, ErrorState, Tabs, panelId, tabId, useSubTab } from "../../../components/ui"

const ID_BASE = "salary"
const SUB_TABS = [
  { value: "roster", label: "รายชื่อทั้งหมด" },
  { value: "step", label: "เลื่อนขั้น" },
  { value: "ladder", label: "บัญชีเงินเดือน" },
  { value: "history", label: "ประวัติรายบุคคล" },
]
const SUB_VALUES = SUB_TABS.map((t) => t.value)

export default function HRSalaryTab({ onGoToPositions }) {
  const [sub] = useSubTab(SUB_VALUES, "roster")
  const [, setParams] = useSearchParams()
  const navigate = useNavigate()
  const empParam = useEmpParam()

  // tab click: switch sub-tab and drop any preselected employee (one URL write — replace)
  const changeSub = (next) =>
    setParams((prev) => {
      const p = new URLSearchParams(prev)
      p.set("sub", String(next))
      p.delete("emp")
      return p
    }, { replace: true })

  // roster row action → step/history with that person preselected (push, so Back returns to the roster)
  const openEmployee = (next, id) =>
    setParams((prev) => {
      const p = new URLSearchParams(prev)
      p.set("sub", next)
      p.set("emp", String(id))
      return p
    })

  // picking someone inside step/history keeps &emp= in sync (no remount: the panels read it only at mount)
  const syncEmp = (id) =>
    setParams((prev) => {
      const p = new URLSearchParams(prev)
      if (id) p.set("emp", String(id))
      else p.delete("emp")
      return p
    }, { replace: true })
  // HRDashboard ส่ง onGoToPositions มา (rail navigation); ถ้าไม่มีใช้ ?tab= ตรง ๆ แทน
  const goToPositions = onGoToPositions ?? (() => navigate("/hr/dashboard?tab=positions"))

  return (
    <div className="space-y-5">
      <Tabs items={SUB_TABS} value={sub} onChange={changeSub} ariaLabel="เงินเดือน" idBase={ID_BASE} />

      <div
        role="tabpanel"
        id={panelId(ID_BASE, sub)}
        aria-labelledby={tabId(ID_BASE, sub)}
        tabIndex={0}
        className="rounded-2xl focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500/40"
      >
        {sub === "roster" && <SalaryRosterPanel onOpenEmployee={openEmployee} />}
        {sub === "step" && (
          <SalaryStepPanel onGoToPositions={goToPositions} initialEmployeeId={empParam} onEmployeeChange={syncEmp} />
        )}
        {sub === "ladder" && <SalaryLadderPanel />}
        {sub === "history" && (
          <HistoryByEmployee onGoToPositions={goToPositions} initialEmployeeId={empParam} onEmployeeChange={syncEmp} />
        )}
      </div>
    </div>
  )
}

/** `&emp=` when it is a plain numeric id, else "" */
function useEmpParam() {
  const [params] = useSearchParams()
  const raw = params.get("emp") ?? ""
  return /^\d+$/.test(raw) ? raw : ""
}

const cachedRecord = (id) =>
  id ? getCachedPersonnel()?.find((p) => String(p.id) === String(id)) ?? null : null

function HistoryByEmployee({ onGoToPositions, initialEmployeeId = "", onEmployeeChange }) {
  const { byId, loading: positionsLoading, error: positionsError, reload } = usePositions()
  const [empId, setEmpId] = useState(initialEmployeeId)
  const [emp, setEmp] = useState(() => cachedRecord(initialEmployeeId))

  // deep link before the personnel list was cached
  useEffect(() => {
    if (!empId || emp) return
    let alive = true
    loadPersonnel()
      .then((list) => {
        const rec = list.find((p) => String(p.id) === String(empId)) ?? null
        if (alive && rec) setEmp((cur) => cur ?? rec)
      })
      .catch(() => {})
    return () => { alive = false }
  }, [empId, emp])
  const info = useEmployeeSalary(empId, 0, byId, emp)

  return (
    <div className="max-w-4xl space-y-4">
      <EmployeePicker
        id="hist-emp"
        value={empId}
        onChange={(v, record) => { setEmpId(v); setEmp(record); onEmployeeChange?.(v) }}
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
