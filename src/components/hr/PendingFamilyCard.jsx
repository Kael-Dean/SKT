// src/components/hr/PendingFamilyCard.jsx
// การ์ด "ข้อมูลครอบครัวรอตรวจสอบ" ในโปรไฟล์เจ้าหน้าที่ (onboarding PR 59)
//   GET  /hr/employees/{id}/dependants?verified=false
//   POST /hr/dependants/{id}/verify
// แสดงเฉพาะผู้มีสิทธิ์ hr.dependants.list และเมื่อมีรายการ — ว่าง/โหลดไม่สำเร็จ = ไม่แสดง (ไม่รบกวนหน้าโปรไฟล์)
import { useEffect, useState } from "react"
import { apiAuth } from "../../lib/api"
import { cardCls, cx } from "../../lib/styles"
import { useCan } from "../../lib/permissions"
import { thaiDate } from "../../lib/loans"
import { Badge } from "../ui"
import { VerifyDependantButton } from "../../pages/hr/tabs/HRDependantsVerifyTab"

export default function PendingFamilyCard({ userId }) {
  const { can } = useCan()
  const allowed = can("hr.dependants.list")
  const [rows, setRows] = useState([])

  useEffect(() => {
    if (!allowed || userId == null) return undefined
    let alive = true
    apiAuth(`/hr/employees/${userId}/dependants?verified=false`)
      .then((d) => { if (alive) setRows((Array.isArray(d) ? d : []).filter((r) => r.hr_verified !== true)) })
      .catch(() => { if (alive) setRows([]) })
    return () => { alive = false }
  }, [allowed, userId])

  if (!allowed || rows.length === 0) return null

  return (
    <section aria-labelledby="pending-family-title" className={cx(cardCls, "p-5")}>
      <div className="mb-3 flex items-center justify-between gap-3 border-b border-indigo-100 pb-1 dark:border-indigo-900/40">
        <h3 id="pending-family-title" className="text-xs font-semibold uppercase tracking-wide text-indigo-700 dark:text-indigo-300">
          ข้อมูลครอบครัวรอตรวจสอบ
        </h3>
        <Badge tone="pending">{rows.length} รายการ</Badge>
      </div>
      <p className="mb-2 text-sm leading-relaxed text-gray-600 dark:text-gray-300">
        พนักงานเพิ่มหรือแก้รายการเหล่านี้เอง สวัสดิการจะนับหลังตรวจสอบแล้วเท่านั้น
      </p>
      <ul className="divide-y divide-gray-100 dark:divide-line">
        {rows.map((d) => (
          <li key={d.id} className="flex flex-wrap items-center gap-x-4 gap-y-2 py-2.5">
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold text-gray-900 dark:text-gray-100">
                {d.display_name || [`${d.name_title ?? ""}${d.first_name ?? ""}`, d.last_name].filter(Boolean).join(" ") || "—"}
              </p>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                {[d.relationship || "—", d.legal_status].filter(Boolean).join(" · ")}
                {d.birthday && <> · เกิด <span className="tabular-nums">{thaiDate(d.birthday)}</span></>}
                {d.is_twin && " · แฝด"}
              </p>
            </div>
            <VerifyDependantButton
              dependant={d}
              onVerified={() => setRows((prev) => prev.filter((r) => r.id !== d.id))}
            />
          </li>
        ))}
      </ul>
    </section>
  )
}
