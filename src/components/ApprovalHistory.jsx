// src/components/ApprovalHistory.jsx
// ประวัติการอนุมัติ (timeline) — GET /hr/{leave-requests|out-of-office}/{id}/history (api-handoff-4 §1)
//
// ⚠️ backend ยังไม่บันทึกเวลา `at` ของขั้นหลัง SUBMIT (มักเป็น null) — ใช้เวลาที่เชื่อถือได้จากแถว
// (branch_head_at / assistant_manager_at / action_at / justified_at) แทน ถ้าไม่มีแสดง "-"
import { useEffect, useState } from "react"
import { fetchApprovalHistory, fmtDateTimeTh } from "../lib/approvalActions"
import { JUSTIFICATION_LABEL, checkRoleLabel, REQUESTER_LEVEL_LABEL } from "../lib/approval"

/** เวลาสำรองตามชนิดขั้น เมื่อ step.at เป็น null */
function fallbackTime(action, req) {
  const a = String(action || "").toUpperCase()
  if (!req) return null
  if (a === "SUBMIT" || a.endsWith("_SUBMIT")) return req.created_at || null
  if (a.includes("CHECK") || a.includes("JUSTIF")) return req.justified_at || null
  if (a.includes("BRANCH_HEAD")) return req.branch_head_at || null
  if (a.includes("ASSIST") || a.includes("ASST")) return req.assistant_manager_at || null
  if (a.includes("MANAGER") || a.includes("APPROVE") || a.includes("DENY") || a.includes("REJECT")) return req.action_at || null
  return null
}

const dotTone = (action) => {
  const a = String(action || "").toUpperCase()
  if (a.includes("DENY") || a.includes("REJECT") || a.includes("UNJUST")) return "bg-rose-500"
  if (a.includes("CANCEL")) return "bg-gray-400"
  if (a.includes("CHECK") || a.includes("JUSTIF")) return "bg-teal-500"
  if (a.includes("APPROVE") || a.includes("CONFIRM")) return "bg-emerald-500"
  return "bg-indigo-500"
}

export default function ApprovalHistory({ kind, id, req, className = "" }) {
  const [state, setState] = useState({ loading: true, data: null, error: "" })

  useEffect(() => {
    if (id == null) return
    let alive = true
    setState({ loading: true, data: null, error: "" })
    fetchApprovalHistory(kind, id)
      .then((data) => alive && setState({ loading: false, data, error: "" }))
      .catch((e) => alive && setState({ loading: false, data: null, error: e?.message || "โหลดประวัติไม่สำเร็จ" }))
    return () => { alive = false }
  }, [kind, id])

  const { loading, data, error } = state
  const steps = Array.isArray(data?.steps) ? data.steps : []

  return (
    <section className={className} aria-labelledby={`hist-${kind}-${id}`}>
      <h3 id={`hist-${kind}-${id}`} className="mb-2 text-sm font-semibold text-gray-800 dark:text-gray-100">ประวัติการอนุมัติ</h3>
      {loading ? (
        <div className="space-y-2" aria-busy="true">
          {[0, 1].map((i) => <div key={i} className="h-10 animate-pulse rounded-lg bg-gray-100 motion-reduce:animate-none dark:bg-gray-700/60" />)}
        </div>
      ) : error ? (
        <p className="rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800 dark:bg-amber-500/10 dark:text-amber-200">{error}</p>
      ) : steps.length === 0 ? (
        <p className="text-xs text-gray-500 dark:text-gray-400">ยังไม่มีประวัติ</p>
      ) : (
        <>
          <ol className="relative space-y-3 border-l border-gray-200 pl-4 dark:border-gray-700">
            {steps.map((s, i) => {
              const at = s.at || fallbackTime(s.action, req)
              return (
                <li key={`${s.action}-${i}`} className="relative">
                  <span aria-hidden="true" className={`absolute -left-[21px] top-1.5 size-2.5 rounded-full ring-2 ring-white dark:ring-gray-800 ${dotTone(s.action)}`} />
                  <p className="text-sm font-medium text-gray-900 dark:text-gray-100">{s.label || s.action}</p>
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    {s.actor_name || (s.actor_id != null ? `รหัส ${s.actor_id}` : "-")} · {at ? fmtDateTimeTh(at) : "-"}
                  </p>
                  {s.comment && !/^extra_days=/.test(s.comment) && (
                    <p className="mt-0.5 text-xs text-gray-600 dark:text-gray-300">“{s.comment}”</p>
                  )}
                </li>
              )
            })}
          </ol>
          <dl className="mt-3 grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-xs">
            {data?.requester_level && (
              <>
                <dt className="text-gray-500 dark:text-gray-400">ระดับผู้ยื่น</dt>
                <dd className="text-gray-800 dark:text-gray-200">{REQUESTER_LEVEL_LABEL[data.requester_level] || data.requester_level}</dd>
              </>
            )}
            <dt className="text-gray-500 dark:text-gray-400">การตรวจสอบ</dt>
            <dd className="text-gray-800 dark:text-gray-200">
              {data?.justification
                ? `${JUSTIFICATION_LABEL[data.justification] || data.justification}${data.justification_note ? ` — ${data.justification_note}` : ""}`
                : data?.check_role ? `ยังไม่ตรวจ (${checkRoleLabel(data.check_role)})` : "–"}
            </dd>
          </dl>
        </>
      )}
    </section>
  )
}
