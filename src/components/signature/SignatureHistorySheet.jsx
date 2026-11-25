// src/components/signature/SignatureHistorySheet.jsx
// HR — ประวัติการเปลี่ยนลายเซ็นของ 1 คน (คำขอ + การอัปโหลด/นำเข้า/ลบโดย HR) · GET /hr/signatures/{user_id}/history
import { useEffect, useState } from "react"
import { EmptyState, ErrorState, Sheet, SkeletonTableRows } from "../ui"
import { apiDetail } from "../../lib/apiErrors"
import { listSignatureHistory, loadRequestImage, loadSignatureVersionImage } from "../../lib/signatures"
import SignatureRequestItem from "./SignatureRequestItem"

/** รูปของแต่ละแถว: อนุมัติแล้ว = เวอร์ชันที่ได้จริง · อื่น ๆ = ไฟล์ที่ขอ */
const imageOf = (r) => {
  if (r.kind === "remove") return null
  if (r.resulting_signature_id != null) {
    return { loader: () => loadSignatureVersionImage(r.resulting_signature_id), key: `ver:${r.resulting_signature_id}` }
  }
  return r.has_image === false ? null : { loader: () => loadRequestImage(r.id), key: `req:${r.id}` }
}

export default function SignatureHistorySheet({ person, onClose }) {
  const [data, setData] = useState({ loading: true, error: "", ready: true, rows: [] })
  const [attempt, setAttempt] = useState(0)
  const userId = person?.id

  useEffect(() => {
    if (userId == null) return
    let alive = true
    setData((d) => ({ ...d, loading: true, error: "" }))
    listSignatureHistory(userId)
      .then((res) => alive && setData({ loading: false, error: "", ...res }))
      .catch((e) => alive && setData((d) => ({ ...d, loading: false, error: apiDetail(e) || e?.message || "โหลดประวัติไม่สำเร็จ" })))
    return () => { alive = false }
  }, [userId, attempt])

  return (
    <Sheet open={!!person} onClose={onClose} size="lg" title="ประวัติการเปลี่ยนลายเซ็น" subtitle={person?.name}>
      {data.error ? (
        <ErrorState message={data.error} onRetry={() => setAttempt((n) => n + 1)} />
      ) : data.loading ? (
        <SkeletonTableRows rows={3} />
      ) : !data.ready ? (
        <EmptyState title="ยังดูประวัติไม่ได้" description="ประวัติจะแสดงเมื่อระบบหลังบ้านพร้อม" />
      ) : !data.rows.length ? (
        <EmptyState title="ยังไม่มีประวัติ" />
      ) : (
        <ul className="-mx-4 divide-y divide-gray-100 dark:divide-line">
          {data.rows.map((r) => <SignatureRequestItem key={r.id} r={r} image={imageOf(r)} showRequester />)}
        </ul>
      )}
    </Sheet>
  )
}
