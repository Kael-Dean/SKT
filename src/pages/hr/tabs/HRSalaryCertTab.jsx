// src/pages/hr/tabs/HRSalaryCertTab.jsx
// 13G + PR 44 — คำขอหนังสือรับรองเงินเดือน: รายการ + ผู้จัดการอนุมัติ/ไม่อนุมัติ + PDF
//   GET   /hr/salary-cert-requests?status=pending   (pending = pending_supervisor + pending_manager)
//   PATCH /hr/salary-cert-requests/{id}/approve|deny { comment }  → manager_comment (deny บังคับ)
//         ทำได้จากทั้งสองขั้นที่รอ — ผู้จัดการไม่ต้องรอความเห็นหัวหน้า แต่ต้องเห็นความเห็นก่อนตัดสิน
//   GET   …/{id}/certificate-pdf (approved) · …/{id}/request-form-pdf
// สิทธิ์: hr.salaryCert.decide = ปุ่มอนุมัติ/ไม่อนุมัติ · hr.salaryCert.print = ปุ่ม PDF
import { useEffect, useId, useState, useCallback } from "react"
import { apiAuth } from "../../../lib/api"
import { apiDetail } from "../../../lib/apiErrors"
import { useCan } from "../../../lib/permissions"
import { fmtDateTimeTh, requestNotificationsRefresh } from "../../../lib/approvalActions"
import {
  SALARY_CERT_STATUS as S, downloadSalaryCertPdf, isSalaryCertPending,
  salaryCertPurposeLabel, salaryCertStatusLabel, salaryCertStatusTone,
} from "../../../lib/salaryCert"
import { SalaryCertProgress, SupervisorOpinionNote } from "../../../components/hr/SalaryCertParts"
import { PageLoader, ErrorState, EmptyState, Badge, Tabs, Sheet, toast, tabId, panelId, useSubTab } from "../../../components/ui"
import {
  cx, tabPanelCls, baseField, labelCls, errorTextCls, neutralBtnCls, submitBtnCls, dangerBtnCls,
} from "../../../lib/styles"

function fmtDate(d) {
  if (!d) return "—"
  try { return new Date(d).toLocaleDateString("th-TH") } catch { return d }
}

const smBtn = "!h-11 md:!h-9 !px-3 !text-xs"

// ─── ผู้จัดการตัดสิน (เห็นความเห็นหัวหน้าก่อน) ────────────────────────────────
function DecisionSheet({ req, action, onClose, onDone }) {
  const uid = useId()
  const [comment, setComment] = useState("")
  const [error, setError] = useState("")
  const [busy, setBusy] = useState(false)
  const isDeny = action === "deny"

  const submit = async (ev) => {
    ev?.preventDefault()
    const text = comment.trim()
    if (isDeny && !text) {
      setError("ระบุเหตุผลที่ไม่อนุมัติ")
      document.getElementById(`${uid}-comment`)?.focus()
      return
    }
    setBusy(true)
    try {
      await apiAuth(`/hr/salary-cert-requests/${req.id}/${isDeny ? "deny" : "approve"}`, {
        method: "PATCH",
        body: text ? { comment: text } : {},
      })
      toast.success(isDeny ? "บันทึกไม่อนุมัติแล้ว" : "อนุมัติแล้ว", { description: `คำขอของ ${req.user_name ?? `#${req.id}`}` })
      requestNotificationsRefresh()
      onDone()
    } catch (e) {
      setError(apiDetail(e) || e?.message || "ดำเนินการไม่สำเร็จ")
    } finally {
      setBusy(false)
    }
  }

  return (
    <Sheet
      open
      onClose={onClose}
      busy={busy}
      size="md"
      title={isDeny ? "ไม่อนุมัติคำขอ" : "อนุมัติคำขอ"}
      subtitle={`${req.user_name ?? "พนักงาน"} · ${salaryCertPurposeLabel(req.purpose_type)} · ${req.copies_count ?? 1} ฉบับ`}
      footer={
        <div className="grid grid-cols-2 gap-3 md:flex md:justify-end md:gap-2">
          <button type="button" onClick={onClose} disabled={busy} className={cx(neutralBtnCls, "h-12 md:h-10")}>ยกเลิก</button>
          <button type="submit" form={`${uid}-form`} disabled={busy} className={cx(isDeny ? dangerBtnCls : submitBtnCls, "h-12 md:h-10")}>
            {busy ? "กำลังบันทึก…" : isDeny ? "ยืนยันไม่อนุมัติ" : "ยืนยันอนุมัติ"}
          </button>
        </div>
      }
    >
      <form id={`${uid}-form`} onSubmit={submit} noValidate className="space-y-4">
        <SupervisorOpinionNote r={req} />
        <div>
          <label htmlFor={`${uid}-comment`} className={labelCls}>
            {isDeny ? "เหตุผลที่ไม่อนุมัติ" : "ความเห็นผู้จัดการ"}
            {isDeny
              ? <span className="text-red-600 dark:text-red-400" aria-hidden="true"> *</span>
              : <span className="font-normal text-gray-500 dark:text-gray-400"> (ถ้ามี)</span>}
          </label>
          <textarea
            id={`${uid}-comment`}
            rows={3}
            maxLength={500}
            value={comment}
            onChange={(e) => { setComment(e.target.value); if (error) setError("") }}
            aria-required={isDeny || undefined}
            aria-invalid={!!error || undefined}
            aria-describedby={error ? `${uid}-comment-err` : undefined}
            placeholder={isDeny ? "ผู้ยื่นจะเห็นเหตุผลนี้" : "ความเห็นเพิ่มเติม"}
            className={cx(baseField, "!rounded-lg !px-3 !py-2 md:!text-sm resize-y", error && "!border-red-500 dark:!border-red-400")}
          />
          {error && <p id={`${uid}-comment-err`} role="alert" className={errorTextCls}>{error}</p>}
        </div>
      </form>
    </Sheet>
  )
}

// ─── แถว ─────────────────────────────────────────────────────────────────────
function RequestCard({ r, canDecide, canPrint, pdfLoading, onDecide, onPdf }) {
  const pending = isSalaryCertPending(r.status)
  const decided = r.status === S.APPROVED || r.status === S.DENIED
  return (
    <div className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-gray-200/70 dark:bg-surface dark:shadow-none dark:ring-line">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 flex-1 space-y-2.5">
          <div className="flex flex-wrap items-center gap-2">
            <p className="font-semibold text-gray-900 dark:text-gray-100">{r.user_name}</p>
            <Badge tone={salaryCertStatusTone(r.status)}>{salaryCertStatusLabel(r.status)}</Badge>
          </div>
          <div className="grid grid-cols-2 gap-2 text-sm sm:grid-cols-4">
            {[
              ["สาขา", r.branch_name || "—"],
              ["จุดประสงค์", salaryCertPurposeLabel(r.purpose_type)],
              ["จำนวนฉบับ", `${r.copies_count ?? 1} ฉบับ`],
              ["วันที่ยื่น", fmtDate(r.requested_at)],
            ].map(([k, v]) => (
              <div key={k}>
                <p className="text-xs text-gray-500 dark:text-gray-400">{k}</p>
                <p className="font-medium text-gray-800 dark:text-gray-200">{v}</p>
              </div>
            ))}
          </div>

          <SalaryCertProgress r={r} />

          {/* ผู้จัดการต้องเห็นความเห็นหัวหน้าก่อนตัดสิน — แถวที่ตัดสินแล้วแสดงเมื่อมีเท่านั้น */}
          <SupervisorOpinionNote r={r} emptyText={pending ? undefined : null} />

          {decided && (r.manager_comment || r.approved_by || r.approved_at) && (
            <div className={cx(
              "rounded-lg px-3 py-2 text-sm",
              r.status === S.DENIED
                ? "bg-red-50 text-red-800 dark:bg-red-500/10 dark:text-red-200"
                : "bg-indigo-50 text-indigo-900 dark:bg-indigo-500/10 dark:text-indigo-100",
            )}>
              <p className="flex flex-wrap items-baseline gap-x-2">
                <span className="font-medium">{r.status === S.DENIED ? "ไม่อนุมัติโดย" : "อนุมัติโดย"}</span>
                <span>{r.approved_by || "—"}</span>
                {r.approved_at && <span className="text-xs tabular-nums text-gray-600 dark:text-gray-400">{fmtDateTimeTh(r.approved_at)}</span>}
              </p>
              {r.manager_comment && <p className="break-words">ความเห็น: {r.manager_comment}</p>}
            </div>
          )}
        </div>

        <div className="flex shrink-0 flex-col gap-2">
          {pending && canDecide && (
            <div className="flex gap-2">
              <button type="button" onClick={() => onDecide(r, "approve")} className={cx(submitBtnCls, smBtn)} aria-label={`อนุมัติคำขอของ ${r.user_name ?? `#${r.id}`}`}>อนุมัติ</button>
              <button type="button" onClick={() => onDecide(r, "deny")} className={cx(dangerBtnCls, smBtn)} aria-label={`ไม่อนุมัติคำขอของ ${r.user_name ?? `#${r.id}`}`}>ไม่อนุมัติ</button>
            </div>
          )}
          {canPrint && (
            <div className="flex flex-wrap gap-2">
              {r.status === S.APPROVED && (
                <button type="button" onClick={() => onPdf(r.id, "certificate")} disabled={pdfLoading[`${r.id}_certificate`]} className={cx(neutralBtnCls, smBtn)}>
                  {pdfLoading[`${r.id}_certificate`] ? "กำลังโหลด…" : "หนังสือรับรอง (PDF)"}
                </button>
              )}
              <button type="button" onClick={() => onPdf(r.id, "form")} disabled={pdfLoading[`${r.id}_form`]} className={cx(neutralBtnCls, smBtn)}>
                {pdfLoading[`${r.id}_form`] ? "กำลังโหลด…" : "แบบฟอร์มคำขอ (PDF)"}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// ─── แท็บ ────────────────────────────────────────────────────────────────────
export default function HRSalaryCertTab() {
  const { can } = useCan()
  const canDecide = can("hr.salaryCert.decide")
  const canPrint = can("hr.salaryCert.print")

  const [subTab, setSubTab] = useSubTab(["pending", "all"], "pending")
  const [requests, setRequests] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [decision, setDecision] = useState(null) // { req, action }
  const [pdfLoading, setPdfLoading] = useState({}) // { [id_type]: bool }

  const fetchRequests = useCallback(() => {
    setLoading(true)
    setError("")
    apiAuth(subTab === "pending" ? "/hr/salary-cert-requests?status=pending" : "/hr/salary-cert-requests")
      .then((d) => setRequests(Array.isArray(d) ? d : d?.items ?? []))
      .catch((e) => setError(apiDetail(e) || e?.message || "โหลดข้อมูลไม่สำเร็จ"))
      .finally(() => setLoading(false))
  }, [subTab])

  useEffect(() => { fetchRequests() }, [fetchRequests])

  const downloadPdf = async (id, type) => {
    const key = `${id}_${type}`
    setPdfLoading((p) => ({ ...p, [key]: true }))
    try {
      const ep = type === "certificate" ? "certificate-pdf" : "request-form-pdf"
      await downloadSalaryCertPdf(`/hr/salary-cert-requests/${id}/${ep}`, `salary_cert_${id}.pdf`)
    } catch (e) {
      toast.error("ดาวน์โหลดไม่สำเร็จ", { description: apiDetail(e) || e?.message })
    } finally {
      setPdfLoading((p) => ({ ...p, [key]: false }))
    }
  }

  const pendingCount = subTab === "all" ? requests.filter((r) => isSalaryCertPending(r.status)).length : requests.length

  return (
    <div className="space-y-4">
      <Tabs
        items={[
          { value: "pending", label: "รอพิจารณา", count: pendingCount > 0 ? pendingCount : null },
          { value: "all", label: "ทั้งหมด" },
        ]}
        value={subTab}
        onChange={setSubTab}
        ariaLabel="สถานะคำขอหนังสือรับรองเงินเดือน"
        idBase="hr-salary-cert"
      />

      <div role="tabpanel" id={panelId("hr-salary-cert", subTab)} aria-labelledby={tabId("hr-salary-cert", subTab)} tabIndex={0} className={cx("space-y-4", tabPanelCls)}>
        {error && <ErrorState message={error} onRetry={fetchRequests} />}

        {loading ? (
          <PageLoader variant="cards" rows={3} message="กำลังโหลดคำขอหนังสือรับรอง…" />
        ) : !error && requests.length === 0 ? (
          <div className="rounded-2xl bg-white shadow-sm ring-1 ring-gray-200/70 dark:bg-surface dark:ring-line">
            <EmptyState
              title="ไม่มีคำขอหนังสือรับรองเงินเดือน"
              description={subTab === "pending" ? "ยังไม่มีคำขอที่รอพิจารณาในขณะนี้" : "ยังไม่มีคำขอหนังสือรับรองเงินเดือนในระบบ"}
            />
          </div>
        ) : (
          <div className="space-y-3">
            {requests.map((r) => (
              <RequestCard
                key={r.id}
                r={r}
                canDecide={canDecide}
                canPrint={canPrint}
                pdfLoading={pdfLoading}
                onDecide={(req, action) => setDecision({ req, action })}
                onPdf={downloadPdf}
              />
            ))}
          </div>
        )}
      </div>

      {decision && (
        <DecisionSheet
          key={`${decision.req.id}-${decision.action}`}
          req={decision.req}
          action={decision.action}
          onClose={() => setDecision(null)}
          onDone={() => { setDecision(null); fetchRequests() }}
        />
      )}
    </div>
  )
}
