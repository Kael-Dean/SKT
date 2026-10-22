// src/pages/hr/tabs/PersonnelDisciplineTab.jsx
// ช่องในโปรไฟล์พนักงาน (HRPersonnelDetail): ประวัติการตักเตือน (3Q)
//   GET /hr/employees/{id}/discipline · PDF ต่อแถว GET /hr/discipline/actions/{id}/pdf (blob)
// props: { employeeId, employeeName }
// รายการโทษเท่านั้น — ไม่มีผู้แจ้งเรื่อง (HR ไม่เห็นผู้แจ้งตามนโยบาย)
import { useCallback, useEffect, useState } from "react"
import { apiAuth } from "../../../lib/api"
import { apiDetail } from "../../../lib/apiErrors"
import { asArray } from "../../../lib/discipline"
import { cardPaddedCls } from "../../../lib/styles"
import DisciplineHistory from "../../../components/hr/DisciplineHistory"

export default function PersonnelDisciplineTab({ employeeId, employeeName }) {
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")

  const load = useCallback(() => {
    if (employeeId == null) return undefined
    let alive = true
    setLoading(true)
    setError("")
    apiAuth(`/hr/employees/${encodeURIComponent(employeeId)}/discipline`)
      .then((d) => { if (alive) setRows(asArray(d)) })
      .catch((e) => { if (alive) setError(apiDetail(e) || "โหลดประวัติการตักเตือนไม่สำเร็จ") })
      .finally(() => { if (alive) setLoading(false) })
    return () => { alive = false }
  }, [employeeId])

  useEffect(() => load(), [load])

  const suspensions = rows.filter((a) => Number(a.step) >= 6).length

  return (
    <section aria-labelledby="pd-discipline-h" aria-busy={loading || undefined} className={cardPaddedCls}>
      <div className="mb-3 flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
        <h2 id="pd-discipline-h" className="text-sm font-semibold text-gray-900 dark:text-gray-100">ประวัติการตักเตือน</h2>
        {!loading && !error && rows.length > 0 && (
          <p className="text-xs tabular-nums text-gray-500 dark:text-gray-400">
            {rows.length} ครั้ง{suspensions > 0 ? ` · พักงานขึ้นไป ${suspensions} ครั้ง` : ""}
          </p>
        )}
      </div>
      <DisciplineHistory
        actions={rows}
        loading={loading}
        error={error}
        onRetry={load}
        emptyTitle="ไม่มีประวัติการตักเตือน"
        emptyDescription={employeeName ? `${employeeName} ยังไม่เคยถูกลงโทษทางวินัย` : "พนักงานคนนี้ยังไม่เคยถูกลงโทษทางวินัย"}
      />
    </section>
  )
}
