// src/pages/work/MySignature.jsx
// ลายเซ็นของฉัน — ดูลายเซ็นที่ระบบใช้ · ยื่นคำขอเปลี่ยนลายเซ็นให้ HR อนุมัติ · ประวัติการเปลี่ยน
//   GET   /personnel/me/signature, /personnel/me/signature/image
//   GET   /personnel/me/signature-requests            ประวัติ (รวมที่ HR เปลี่ยนให้)
//   POST  /personnel/me/signature-requests            file + reason
//   PATCH /personnel/me/signature-requests/{id}/cancel
// spec: handoff/api-handoff-e-signature.md ส่วนที่ 7 — backend ยังไม่พร้อม = แสดงข้อความรอระบบ
import { useEffect, useState } from "react"
import { CircleAlert, PenLine, Send } from "lucide-react"
import PageTitle from "../../components/PageTitle"
import SignaturePaper from "../../components/signature/SignaturePaper"
import SignatureCapture from "../../components/signature/SignatureCapture"
import SignatureRequestItem from "../../components/signature/SignatureRequestItem"
import RequestStatusBadge from "../../components/signature/RequestStatusBadge"
import { ConfirmDialog, ErrorState, Sheet, Skeleton, toast } from "../../components/ui"
import useSignatureImage, { clearSignatureImageCache } from "../../hooks/useSignatureImage"
import { apiDetail } from "../../lib/apiErrors"
import {
  cancelSignatureRequest,
  listMySignatureRequests,
  loadMyRequestImage,
  loadMySignatureImage,
  loadMySignatureStatus,
  submitSignatureRequest,
  thaiDateTime,
} from "../../lib/signatures"
import { baseField, cardCls, cx, errorTextCls, helpTextCls, labelCls, neutralBtnCls, primaryBtnCls, sectionTitleCls } from "../../lib/styles"

const REASON_MAX = 500
const errMsg = (e, fallback) => apiDetail(e) || e?.message || fallback
const requestImage = (r) => (r.has_image === false || r.kind === "remove" ? null : { loader: () => loadMyRequestImage(r.id), key: `my-req:${r.id}` })

function RequestSheet({ open, onClose, onSubmitted, hasSignature }) {
  const [capture, setCapture] = useState(null)
  const [reason, setReason] = useState("")
  const [touched, setTouched] = useState(false)
  const [state, setState] = useState({ busy: false, error: "" })

  useEffect(() => {
    if (!open) {
      setCapture(null)
      setReason("")
      setTouched(false)
      setState({ busy: false, error: "" })
    }
  }, [open])

  const reasonError = touched && !reason.trim() ? "กรุณาระบุเหตุผล" : ""

  const submit = async () => {
    setTouched(true)
    if (!capture || !reason.trim()) return
    setState({ busy: true, error: "" })
    try {
      await submitSignatureRequest(capture.file, reason.trim())
      toast.success("ส่งคำขอแล้ว", { description: "ฝ่ายบุคคลจะตรวจและอนุมัติ ระหว่างนี้เอกสารยังใช้ลายเซ็นเดิม" })
      onSubmitted()
    } catch (e) {
      setState({ busy: false, error: errMsg(e, "ส่งคำขอไม่สำเร็จ") })
    }
  }

  return (
    <Sheet
      open={open}
      onClose={onClose}
      busy={state.busy}
      size="md"
      title={hasSignature ? "ขอเปลี่ยนลายเซ็น" : "ขอเพิ่มลายเซ็นเข้าระบบ"}
      subtitle="ฝ่ายบุคคลจะตรวจเทียบกับลายเซ็นเดิมก่อนอนุมัติ"
      footer={
        <div className="grid grid-cols-2 gap-3 md:flex md:justify-end md:gap-2">
          <button type="button" className={cx(neutralBtnCls, "!h-12 md:!h-10")} onClick={onClose} disabled={state.busy}>ยกเลิก</button>
          <button type="button" className={cx(primaryBtnCls, "!h-12 gap-2 md:!h-10")} onClick={submit} disabled={state.busy || !capture}>
            <Send className="size-4" aria-hidden="true" />
            {state.busy ? "กำลังส่ง…" : "ส่งคำขอ"}
          </button>
        </div>
      }
    >
      <div className="space-y-5">
        <SignatureCapture value={capture} onChange={setCapture} disabled={state.busy} />
        <div>
          <label htmlFor="sig-reason" className={labelCls}>เหตุผลที่ขอ<span className="text-red-500"> *</span></label>
          <textarea
            id="sig-reason"
            rows={3}
            maxLength={REASON_MAX}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            onBlur={() => setTouched(true)}
            aria-required="true"
            aria-invalid={reasonError ? "true" : undefined}
            aria-describedby="sig-reason-hint"
            placeholder="เช่น ลายเซ็นเดิมไม่ชัด, เปลี่ยนชื่อ-สกุล, เปลี่ยนรูปแบบการเซ็น"
            className={cx(baseField, "!rounded-lg !px-3 !py-2 md:!text-sm", reasonError && "!border-red-400")}
            disabled={state.busy}
          />
          <p id="sig-reason-hint" className={reasonError ? errorTextCls : helpTextCls}>
            {reasonError || `${reason.length}/${REASON_MAX}`}
          </p>
        </div>
        {state.error && <p role="alert" className={errorTextCls}>{state.error}</p>}
      </div>
    </Sheet>
  )
}

export default function MySignature() {
  const [data, setData] = useState({ loading: true, error: "", ready: true, status: null, rows: [] })
  const [attempt, setAttempt] = useState(0)
  const [formOpen, setFormOpen] = useState(false)
  const [confirmCancel, setConfirmCancel] = useState(null)
  const [cancelState, setCancelState] = useState({ loading: false, error: "" })

  useEffect(() => {
    let alive = true
    setData((d) => ({ ...d, loading: true, error: "" }))
    Promise.all([loadMySignatureStatus(), listMySignatureRequests()])
      .then(([status, list]) => alive && setData({ loading: false, error: "", ready: status.ready && list.ready, status, rows: list.rows }))
      .catch((e) => alive && setData((d) => ({ ...d, loading: false, error: errMsg(e, "โหลดข้อมูลลายเซ็นไม่สำเร็จ") })))
    return () => { alive = false }
  }, [attempt])

  const reload = () => {
    clearSignatureImageCache()
    setAttempt((n) => n + 1)
  }

  const hasSignature = !!data.status?.has_signature
  const current = useSignatureImage(loadMySignatureImage, data.ready && hasSignature ? `my-current:${data.status?.uploaded_at ?? attempt}` : null)
  const pending = data.rows.find((r) => r.status === "pending")
  const pendingImg = useSignatureImage(() => loadMyRequestImage(pending?.id), pending ? `my-req:${pending.id}` : null)

  const doCancel = async () => {
    setCancelState({ loading: true, error: "" })
    try {
      await cancelSignatureRequest(confirmCancel.id)
      setConfirmCancel(null)
      setCancelState({ loading: false, error: "" })
      toast.success("ยกเลิกคำขอแล้ว")
      reload()
    } catch (e) {
      setCancelState({ loading: false, error: errMsg(e, "ยกเลิกคำขอไม่สำเร็จ") })
    }
  }

  return (
    <div className="mx-auto w-full max-w-3xl space-y-4 p-4 md:p-6">
      <PageTitle title="ลายเซ็นของฉัน" />

      {data.error ? (
        <ErrorState message={data.error} onRetry={() => setAttempt((n) => n + 1)} />
      ) : data.loading ? (
        <div className="space-y-4" aria-busy="true">
          <span className="sr-only">กำลังโหลดลายเซ็น…</span>
          <Skeleton className="h-48" rounded="rounded-2xl" />
          <Skeleton className="h-32" rounded="rounded-2xl" />
        </div>
      ) : (
        <>
          {!data.ready && (
            <div role="status" className="flex gap-3 rounded-2xl bg-amber-50 px-4 py-3 text-sm text-amber-900 ring-1 ring-amber-200 dark:bg-amber-500/10 dark:text-amber-200 dark:ring-amber-500/25">
              <CircleAlert className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
              <p>ระบบลายเซ็นอิเล็กทรอนิกส์ยังไม่เปิดใช้งาน — ยื่นคำขอได้เมื่อระบบหลังบ้านพร้อม</p>
            </div>
          )}

          <section className={cx(cardCls, "p-4 md:p-5")} aria-labelledby="my-sig-current">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
              <SignaturePaper
                size="lg"
                src={current.src}
                loading={current.loading}
                alt="ลายเซ็นปัจจุบันของฉัน"
                empty={data.ready ? "ยังไม่มีลายเซ็นในระบบ" : "—"}
                className="sm:w-72"
              />
              <div className="min-w-0 flex-1 space-y-2">
                <h2 id="my-sig-current" className={sectionTitleCls}>ลายเซ็นที่ใช้อยู่</h2>
                <p className="text-sm text-gray-600 dark:text-gray-300">
                  ระบบใส่ลายเซ็นนี้ในใบลาและหนังสือรับรองเงินเดือนให้อัตโนมัติ เฉพาะรายการที่คุณยื่นหรืออนุมัติเอง
                </p>
                {hasSignature && data.status?.uploaded_at && (
                  <p className={helpTextCls}>อัปเดตล่าสุด {thaiDateTime(data.status.uploaded_at)}</p>
                )}
                {!pending && (
                  <button type="button" className={cx(primaryBtnCls, "!h-11 gap-2")} onClick={() => setFormOpen(true)} disabled={!data.ready}>
                    <PenLine className="size-4" aria-hidden="true" />
                    {hasSignature ? "ขอเปลี่ยนลายเซ็น" : "ขอเพิ่มลายเซ็นเข้าระบบ"}
                  </button>
                )}
              </div>
            </div>
          </section>

          {pending && (
            <section className={cx(cardCls, "p-4 md:p-5")} aria-labelledby="my-sig-pending">
              <div className="flex flex-wrap items-center gap-2">
                <h2 id="my-sig-pending" className={sectionTitleCls}>คำขอที่รออนุมัติ</h2>
                <RequestStatusBadge status="pending" />
              </div>
              <div className="mt-3 flex flex-col gap-4 sm:flex-row sm:items-center">
                <SignaturePaper size="lg" src={pendingImg.src} loading={pendingImg.loading} alt="ลายเซ็นที่ขอเปลี่ยน" className="sm:w-72" />
                <div className="min-w-0 flex-1 space-y-1 text-sm">
                  <p className="text-gray-700 dark:text-gray-200">เหตุผล: {pending.reason || "—"}</p>
                  <p className={helpTextCls}>ยื่นเมื่อ {thaiDateTime(pending.requested_at)} · ระหว่างรอ เอกสารยังใช้ลายเซ็นเดิม</p>
                  <button
                    type="button"
                    className={cx(neutralBtnCls, "!h-11 mt-2")}
                    onClick={() => { setCancelState({ loading: false, error: "" }); setConfirmCancel(pending) }}
                  >
                    ยกเลิกคำขอ
                  </button>
                </div>
              </div>
            </section>
          )}

          <section className={cx(cardCls, "overflow-hidden")} aria-labelledby="my-sig-history">
            <h2 id="my-sig-history" className={cx(sectionTitleCls, "border-b border-gray-100 px-4 py-3 dark:border-line")}>ประวัติการเปลี่ยนลายเซ็น</h2>
            {data.rows.length ? (
              <ul className="divide-y divide-gray-100 dark:divide-line">
                {data.rows.map((r) => <SignatureRequestItem key={r.id} r={r} image={requestImage(r)} />)}
              </ul>
            ) : (
              <p className="px-4 py-6 text-sm text-gray-500 dark:text-gray-400">ยังไม่มีประวัติ</p>
            )}
          </section>
        </>
      )}

      <RequestSheet
        open={formOpen}
        onClose={() => setFormOpen(false)}
        hasSignature={hasSignature}
        onSubmitted={() => { setFormOpen(false); reload() }}
      />

      <ConfirmDialog
        open={!!confirmCancel}
        title="ยกเลิกคำขอเปลี่ยนลายเซ็น?"
        description="ลายเซ็นเดิมยังใช้ต่อ ถ้าต้องการเปลี่ยนภายหลังให้ยื่นคำขอใหม่"
        confirmLabel="ยกเลิกคำขอ"
        cancelLabel="ไม่ยกเลิก"
        tone="danger"
        loading={cancelState.loading}
        loadingLabel="กำลังยกเลิก…"
        error={cancelState.error}
        onConfirm={doCancel}
        onCancel={() => setConfirmCancel(null)}
      />
    </div>
  )
}
