// src/components/OOOWorkDetails.jsx
// 3O work details + attachments for one request (section28A1).
// Work rows: ในจังหวัด/ต่างจังหวัด · ตามแผน/ปรับแผน · แผน · การเดินทาง (ทะเบียน · ระยะทาง).
// Older work requests have every work field null → "—". Personal rows show attachments only.
//
//   <OOOWorkDetails req={r} />                     // list/detail
//   <OOOWorkDetails req={r} compact />             // table cell — chips for files
import AttachmentList from "./AttachmentList"
import { OOO_PLAN_STATUS_LABEL, OOO_WORK_AREA_LABEL, oooTransportText } from "../lib/approval"
import { cx } from "../lib/styles"

export default function OOOWorkDetails({ req, compact = false, className = "" }) {
  if (!req) return null
  const isWork = req.request_type === "work"
  const files = Array.isArray(req.attachments) ? req.attachments : []
  if (!isWork && !files.length) return null

  const area = OOO_WORK_AREA_LABEL[req.work_area]
  const plan = OOO_PLAN_STATUS_LABEL[req.plan_status]
  const trip = oooTransportText(req)

  return (
    <div className={cx("space-y-1.5", className)}>
      {isWork && (
        <div className="space-y-1 text-xs text-gray-600 dark:text-gray-300">
          {(area || plan) && (
            <div className="flex flex-wrap gap-1">
              {area && (
                <span className="inline-flex items-center rounded-full bg-sky-50 px-2 py-0.5 font-medium text-sky-800 ring-1 ring-sky-200/70 dark:bg-sky-500/10 dark:text-sky-200 dark:ring-sky-400/20">
                  {area}
                </span>
              )}
              {plan && (
                <span
                  className={cx(
                    "inline-flex items-center rounded-full px-2 py-0.5 font-medium ring-1",
                    req.plan_status === "adjusted"
                      ? "bg-amber-50 text-amber-800 ring-amber-200/70 dark:bg-amber-500/10 dark:text-amber-200 dark:ring-amber-400/20"
                      : "bg-emerald-50 text-emerald-800 ring-emerald-200/70 dark:bg-emerald-500/10 dark:text-emerald-200 dark:ring-emerald-400/20"
                  )}
                >
                  {plan}
                </span>
              )}
            </div>
          )}
          <p className="break-words">
            <span className="text-gray-500 dark:text-gray-400">แผน: </span>
            {req.plan_name || "—"}
          </p>
          <p className="break-words">
            <span className="text-gray-500 dark:text-gray-400">เดินทาง: </span>
            <span className="tabular-nums">{trip || "—"}</span>
          </p>
        </div>
      )}
      {files.length > 0 && <AttachmentList attachments={files} variant={compact ? "compact" : "list"} />}
    </div>
  )
}
