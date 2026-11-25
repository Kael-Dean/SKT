// src/components/signature/SignatureRequestItem.jsx
// 1 แถวในประวัติการเปลี่ยนลายเซ็น — ใช้ทั้งหน้า "ลายเซ็นของฉัน" และประวัติรายคนของ HR
//   image = { loader, key } | null   (key=null → ไม่มีรูป)
import useSignatureImage from "../../hooks/useSignatureImage"
import { requestSourceLabel, thaiDateTime } from "../../lib/signatures"
import RequestStatusBadge from "./RequestStatusBadge"
import SignaturePaper from "./SignaturePaper"

export default function SignatureRequestItem({ r, image, showRequester = false }) {
  const { src, loading } = useSignatureImage(image?.loader ?? (() => null), image?.key ?? null)
  const removed = r.kind === "remove"
  const self = r.source === "self_request"
  return (
    <li className="flex flex-wrap items-start gap-3 px-4 py-3 sm:flex-nowrap">
      <SignaturePaper
        size="sm"
        src={src}
        loading={loading}
        alt="ลายเซ็นในรายการนี้"
        empty={removed ? "ลบลายเซ็น" : "ไม่มีรูป"}
      />
      <div className="min-w-0 flex-1 basis-56 space-y-1 text-sm">
        <p className="flex flex-wrap items-center gap-2">
          <span className="font-medium text-gray-900 dark:text-gray-100">{requestSourceLabel(r)}</span>
          <RequestStatusBadge status={r.status} />
        </p>
        <p className="text-xs text-gray-500 dark:text-gray-400">
          {self ? "ยื่นเมื่อ" : "เมื่อ"} {thaiDateTime(r.requested_at)}
          {showRequester && r.requested_by_name && <> · โดย {r.requested_by_name}</>}
        </p>
        {r.reason && <p className="text-gray-700 dark:text-gray-200">เหตุผล: {r.reason}</p>}
        {self && r.decided_at && (
          <p className="text-xs text-gray-500 dark:text-gray-400">
            {r.status === "approved" ? "อนุมัติ" : "พิจารณา"}โดย {r.decided_by_name || "—"} · {thaiDateTime(r.decided_at)}
          </p>
        )}
        {r.cancelled_at && <p className="text-xs text-gray-500 dark:text-gray-400">ยกเลิกเมื่อ {thaiDateTime(r.cancelled_at)}</p>}
        {r.decision_note && (
          <p className={r.status === "rejected" ? "text-red-700 dark:text-red-300" : "text-gray-700 dark:text-gray-200"}>
            หมายเหตุ: {r.decision_note}
          </p>
        )}
      </div>
    </li>
  )
}
