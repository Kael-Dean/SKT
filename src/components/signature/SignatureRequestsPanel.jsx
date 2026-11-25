// src/components/signature/SignatureRequestsPanel.jsx
// HR — คำขอเปลี่ยนลายเซ็น: วางลายเซ็นปัจจุบัน | ที่ขอ เทียบกัน · อนุมัติ / ไม่อนุมัติ (ต้องมีเหตุผล)
//   GET /hr/signature-requests?status= · PATCH …/{id}/approve · PATCH …/{id}/reject
// ห้ามอนุมัติคำขอของตัวเอง (backend บังคับ 403 — FE ซ่อนปุ่มไว้ก่อน)
import { useCallback, useEffect, useState } from "react"
import { ArrowRight, Check, X } from "lucide-react"
import { ConfirmDialog, EmptyState, ErrorState, SkeletonTableRows, toast } from "../ui"
import useSignatureImage, { clearSignatureImageCache } from "../../hooks/useSignatureImage"
import { apiDetail } from "../../lib/apiErrors"
import { getUser } from "../../lib/auth"
import {
  approveSignatureRequest,
  listSignatureRequests,
  loadRequestImage,
  loadSignatureImage,
  rejectSignatureRequest,
  thaiDateTime,
} from "../../lib/signatures"
import { baseField, cx, helpTextCls, labelCls, neutralBtnCls, segmentedCls, segmentedItemActiveCls, segmentedItemCls, submitBtnCls } from "../../lib/styles"
import RequestStatusBadge from "./RequestStatusBadge"
import SignaturePaper from "./SignaturePaper"

const errMsg = (e, fallback) => apiDetail(e) || e?.message || fallback

function RequestCard({ r, isMine, onApprove, onReject }) {
  const current = useSignatureImage(() => loadSignatureImage(r.user_id), r.has_current_signature === false ? null : `cur:${r.user_id}:${r.previous_signature_id ?? ""}`)
  const requested = useSignatureImage(() => loadRequestImage(r.id), r.has_image === false ? null : `req:${r.id}`)
  const pending = r.status === "pending"
  return (
    <li className="space-y-3 px-4 py-4">
      <div className="flex flex-wrap items-start gap-x-3 gap-y-1">
        <div className="min-w-0 flex-1">
          <p className="truncate font-medium text-gray-900 dark:text-gray-100">{r.user_name || `รหัส ${r.user_id}`}</p>
          <p className="truncate text-xs text-gray-500 dark:text-gray-400">
            {[r.position, r.branch_name].filter(Boolean).join(" · ") || "—"} · ยื่นเมื่อ {thaiDateTime(r.requested_at)}
          </p>
        </div>
        <RequestStatusBadge status={r.status} />
      </div>

      <div className="grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-2 sm:max-w-xl">
        <figure className="min-w-0 space-y-1">
          <SignaturePaper size="md" className="!max-w-none" src={current.src} loading={current.loading} alt="ลายเซ็นปัจจุบัน" empty="ยังไม่มีลายเซ็น" />
          <figcaption className="text-center text-xs text-gray-500 dark:text-gray-400">ปัจจุบัน</figcaption>
        </figure>
        <ArrowRight className="size-4 text-gray-400" aria-hidden="true" />
        <figure className="min-w-0 space-y-1">
          <SignaturePaper size="md" className="!max-w-none" src={requested.src} loading={requested.loading} alt="ลายเซ็นที่ขอ" />
          <figcaption className="text-center text-xs font-medium text-indigo-700 dark:text-indigo-300">ที่ขอเปลี่ยน</figcaption>
        </figure>
      </div>

      <p className="text-sm text-gray-700 dark:text-gray-200">เหตุผล: {r.reason || "—"}</p>
      {!pending && r.decided_at && (
        <p className="text-xs text-gray-500 dark:text-gray-400">
          {r.status === "approved" ? "อนุมัติ" : r.status === "rejected" ? "ไม่อนุมัติ" : "ปิด"}โดย {r.decided_by_name || "—"} · {thaiDateTime(r.decided_at)}
          {r.decision_note && <> · “{r.decision_note}”</>}
        </p>
      )}
      {r.status === "cancelled" && <p className="text-xs text-gray-500 dark:text-gray-400">ผู้ยื่นยกเลิกเอง {thaiDateTime(r.cancelled_at)}</p>}

      {pending && (
        isMine ? (
          <p className={helpTextCls}>คำขอของคุณเอง — ต้องให้ฝ่ายบุคคลคนอื่นหรือผู้ดูแลระบบอนุมัติ</p>
        ) : (
          <div className="flex flex-wrap gap-2">
            <button type="button" className={cx(submitBtnCls, "!h-11 gap-1.5 md:!h-10")} onClick={() => onApprove(r)}>
              <Check className="size-4" aria-hidden="true" /> อนุมัติ
            </button>
            <button type="button" className={cx(neutralBtnCls, "!h-11 gap-1.5 text-red-700 md:!h-10 dark:text-red-300")} onClick={() => onReject(r)}>
              <X className="size-4" aria-hidden="true" /> ไม่อนุมัติ
            </button>
          </div>
        )
      )}
    </li>
  )
}

export default function SignatureRequestsPanel({ onChanged }) {
  const me = getUser()
  const [filter, setFilter] = useState("pending")
  const [data, setData] = useState({ loading: true, error: "", ready: true, rows: [] })
  const [attempt, setAttempt] = useState(0)
  const [action, setAction] = useState(null) // { type: "approve"|"reject", r }
  const [note, setNote] = useState("")
  const [actState, setActState] = useState({ loading: false, error: "" })

  useEffect(() => {
    let alive = true
    setData((d) => ({ ...d, loading: true, error: "" }))
    listSignatureRequests(filter === "pending" ? "pending" : null)
      .then((res) => alive && setData({ loading: false, error: "", ...res }))
      .catch((e) => alive && setData((d) => ({ ...d, loading: false, error: errMsg(e, "โหลดคำขอไม่สำเร็จ") })))
    return () => { alive = false }
  }, [filter, attempt])

  const open = useCallback((type, r) => {
    setNote("")
    setActState({ loading: false, error: "" })
    setAction({ type, r })
  }, [])

  const confirm = async () => {
    const { type, r } = action
    if (type === "reject" && !note.trim()) {
      setActState({ loading: false, error: "กรุณาระบุเหตุผลที่ไม่อนุมัติ" })
      return
    }
    setActState({ loading: true, error: "" })
    try {
      if (type === "approve") await approveSignatureRequest(r.id, note.trim())
      else await rejectSignatureRequest(r.id, note.trim())
      toast.success(type === "approve" ? `อนุมัติลายเซ็นใหม่ของ ${r.user_name || "พนักงาน"} แล้ว` : "บันทึกไม่อนุมัติแล้ว", {
        description: type === "approve" ? "เอกสารที่พิมพ์หลังจากนี้ใช้ลายเซ็นใหม่" : "ผู้ยื่นจะได้รับแจ้งพร้อมเหตุผล",
      })
      setAction(null)
      clearSignatureImageCache()
      setAttempt((n) => n + 1)
      onChanged?.()
    } catch (e) {
      setActState({ loading: false, error: errMsg(e, "บันทึกไม่สำเร็จ") })
    }
  }

  const rows = data.rows
  return (
    <div className="space-y-3">
      <div className={cx(segmentedCls, "sm:!w-auto")} role="group" aria-label="กรองคำขอ">
        {[["pending", "รออนุมัติ"], ["all", "ทั้งหมด"]].map(([k, l]) => (
          <button key={k} type="button" aria-pressed={filter === k} onClick={() => setFilter(k)} className={cx(segmentedItemCls, "whitespace-nowrap", filter === k && segmentedItemActiveCls)}>
            {l}
          </button>
        ))}
      </div>

      {data.error ? (
        <ErrorState message={data.error} onRetry={() => setAttempt((n) => n + 1)} />
      ) : data.loading ? (
        <SkeletonTableRows rows={4} />
      ) : !data.ready ? (
        <EmptyState title="ยังรับคำขอไม่ได้" description="คำขอเปลี่ยนลายเซ็นจะแสดงที่นี่เมื่อระบบหลังบ้านพร้อม" />
      ) : !rows.length ? (
        <EmptyState title={filter === "pending" ? "ไม่มีคำขอที่รออนุมัติ" : "ยังไม่มีคำขอเปลี่ยนลายเซ็น"} description="พนักงานยื่นคำขอได้ที่เมนู “ลายเซ็นของฉัน”" />
      ) : (
        <ul className="divide-y divide-gray-100 overflow-hidden rounded-xl ring-1 ring-gray-200/70 dark:divide-line dark:ring-line">
          {rows.map((r) => (
            <RequestCard
              key={r.id}
              r={r}
              isMine={me?.id != null && String(r.user_id) === String(me.id)}
              onApprove={(x) => open("approve", x)}
              onReject={(x) => open("reject", x)}
            />
          ))}
        </ul>
      )}

      <ConfirmDialog
        open={!!action}
        title={action?.type === "approve" ? "อนุมัติลายเซ็นใหม่?" : "ไม่อนุมัติคำขอนี้?"}
        description={
          action?.type === "approve"
            ? `ลายเซ็นใหม่ของ ${action?.r?.user_name || "พนักงาน"} จะใช้ในเอกสารทันที ลายเซ็นเดิมเก็บไว้ในประวัติ`
            : "ผู้ยื่นจะเห็นเหตุผลนี้ และยื่นคำขอใหม่ได้"
        }
        confirmLabel={action?.type === "approve" ? "อนุมัติ" : "ไม่อนุมัติ"}
        tone={action?.type === "approve" ? "primary" : "danger"}
        loading={actState.loading}
        loadingLabel="กำลังบันทึก…"
        error={actState.error}
        onConfirm={confirm}
        onCancel={() => setAction(null)}
      >
        <label htmlFor="sig-decision-note" className={labelCls}>
          {action?.type === "approve" ? "หมายเหตุ (ไม่บังคับ)" : "เหตุผลที่ไม่อนุมัติ"}
          {action?.type === "reject" && <span className="text-red-500"> *</span>}
        </label>
        <textarea
          id="sig-decision-note"
          rows={3}
          maxLength={500}
          value={note}
          onChange={(e) => setNote(e.target.value)}
          aria-required={action?.type === "reject" ? "true" : undefined}
          placeholder={action?.type === "reject" ? "เช่น ลายเซ็นไม่ตรงกับเอกสารที่เคยเซ็น, รูปไม่ชัด" : ""}
          aria-invalid={action?.type === "reject" && !note.trim() && actState.error ? "true" : undefined}
          className={cx(baseField, "!rounded-lg !px-3 !py-2 md:!text-sm", action?.type === "reject" && !note.trim() && actState.error && "!border-red-400")}
        />
      </ConfirmDialog>
    </div>
  )
}
