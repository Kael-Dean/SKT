// src/components/hr/DisciplineHistory.jsx
// ─────────────────────────────────────────────────────────────────────────────
// รายการโทษทางวินัยของพนักงานหนึ่งคน (3Q) — ใช้ร่วมกัน:
//   • โปรไฟล์พนักงาน (PersonnelDisciplineTab)   GET /hr/employees/{id}/discipline
//   • ประวัติการตักเตือนของฉัน (MyDiscipline)     GET /personnel/me/discipline
// แถวละ 1 โทษ: ขั้น · หัวข้อ · เลขที่หนังสือ · วันที่ · ช่วงพักงาน · หมายเหตุ · ปุ่ม PDF
// ไม่แสดงผู้แจ้งเรื่องในทุกกรณี (shape ของ action ไม่มีอยู่แล้ว)
//
//   <DisciplineHistory actions={rows} loading error onRetry highlightId showIssuer
//                      emptyTitle emptyDescription />
// ─────────────────────────────────────────────────────────────────────────────
import { useEffect, useRef, useState } from "react"
import { FileDown, LoaderCircle } from "lucide-react"
import { cx, focusRingCls } from "../../lib/styles"
import { Badge, EmptyState, ErrorState, Skeleton, toast } from "../ui"
import { apiDetail } from "../../lib/apiErrors"
import { SUSPENSION_STEP, clauseCode, downloadActionPdf, fmtDate, resolutionText, stepLabel, stepTone, suspensionText } from "../../lib/discipline"

function ActionRow({ a, highlight, showIssuer, busy, onPdf, onAck }) {
  const ref = useRef(null)
  const ack = a.refused_to_sign ? "ปฏิเสธการลงนามรับทราบ" : a.acknowledged_on ? `รับทราบ ${fmtDate(a.acknowledged_on)}` : ""
  useEffect(() => {
    if (highlight) ref.current?.scrollIntoView({ block: "center", behavior: "smooth" })
  }, [highlight])

  const step = Number(a.step)
  return (
    <li
      ref={ref}
      className={cx(
        "grid gap-x-4 gap-y-2 py-3.5 first:pt-0 last:pb-0 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-start",
        highlight && "-mx-2 rounded-lg bg-indigo-50/80 px-2 first:pt-3.5 last:pb-3.5 dark:bg-indigo-500/10",
      )}
    >
      <div className="min-w-0 space-y-1">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <Badge tone={stepTone(step)}>ขั้น {step || "—"}</Badge>
          <p className="font-semibold text-gray-900 dark:text-gray-100">{stepLabel(step, a.step_label)}</p>
        </div>
        <p className="text-sm text-gray-700 dark:text-gray-300">
          หัวข้อ: <span className="font-medium">{a.topic || "—"}</span>
        </p>
        <p className="text-xs tabular-nums text-gray-500 dark:text-gray-400">
          {a.doc_no ? `เลขที่ ${a.doc_no} · ` : ""}ออกเมื่อ {fmtDate(a.issued_on, { long: true })}
          {showIssuer && a.issued_by_name ? ` · โดย ${a.issued_by_name}` : ""}
        </p>
        {a.committee_resolution_no && (
          <p className="text-sm text-gray-700 dark:text-gray-300">{resolutionText(a)}</p>
        )}
        {step === SUSPENSION_STEP && a.suspension_start && (
          <p className="text-sm text-red-800 dark:text-red-200">
            พักงาน <span className="tabular-nums">{suspensionText(a)}</span>
            <span className="text-red-700/80 dark:text-red-300/80"> · งดจ่ายค่าจ้างวันทำงานที่พัก</span>
          </p>
        )}
        {a.note && <p className="whitespace-pre-wrap break-words text-sm text-gray-600 dark:text-gray-400">{a.note}</p>}
        {a.clauses?.length > 0 && (
          <p className="text-xs leading-relaxed text-gray-600 dark:text-gray-400">ข้อระเบียบ: {a.clauses.map(clauseCode).join(", ")}</p>
        )}
        {(ack || a.witness_1 || a.witness_2) && (
          <p className="text-xs text-gray-500 dark:text-gray-400">
            {ack}{ack && (a.witness_1 || a.witness_2) ? " · " : ""}
            {(a.witness_1 || a.witness_2) && `พยาน: ${[a.witness_1, a.witness_2].filter(Boolean).join(", ")}`}
          </p>
        )}
      </div>
      <div className="flex flex-wrap items-center gap-2 justify-self-start sm:justify-self-end">
      {onAck && (
        <button type="button" onClick={() => onAck(a)}
          className={cx(
            "inline-flex min-h-touch items-center rounded-lg px-3 text-sm font-medium text-gray-700 ring-1 ring-inset ring-gray-300 transition-colors duration-150 hover:bg-gray-50 cursor-pointer md:pointer-fine:min-h-9",
            "dark:text-gray-200 dark:ring-line-field dark:hover:bg-white/[.04]", focusRingCls,
          )}>
          บันทึกการรับทราบ
        </button>
      )}
      <button
        type="button"
        onClick={() => onPdf(a)}
        disabled={busy}
        aria-label={`ดาวน์โหลดหนังสือ ${stepLabel(step, a.step_label)}${a.doc_no ? ` เลขที่ ${a.doc_no}` : ""}`}
        className={cx(
          "inline-flex min-h-touch items-center justify-self-start gap-1.5 rounded-lg px-3 text-sm font-medium text-indigo-700 ring-1 ring-inset ring-indigo-200",
          "transition-colors duration-150 hover:bg-indigo-50 disabled:cursor-wait disabled:opacity-60 cursor-pointer md:pointer-fine:min-h-9",
          "dark:text-indigo-300 dark:ring-indigo-400/30 dark:hover:bg-indigo-500/10",
          focusRingCls,
        )}
      >
        {busy ? <LoaderCircle aria-hidden="true" className="size-4 animate-spin" /> : <FileDown aria-hidden="true" className="size-4" />}
        {busy ? "กำลังโหลด…" : "หนังสือ PDF"}
      </button>
      </div>
    </li>
  )
}

export default function DisciplineHistory({
  actions = [],
  loading = false,
  error = "",
  onRetry,
  highlightId = null,
  showIssuer = true,
  emptyTitle = "ไม่มีประวัติการตักเตือน",
  emptyDescription = "",
  canAck = null, // (action) => boolean — แสดงปุ่ม "บันทึกการรับทราบ"
  onAck = null,  // (action) => void
}) {
  const [busyId, setBusyId] = useState(null)

  const onPdf = async (a) => {
    setBusyId(a.id)
    try {
      await downloadActionPdf(a)
    } catch (e) {
      toast.error("เปิดหนังสือไม่สำเร็จ", { description: apiDetail(e) || "ลองใหม่อีกครั้ง" })
    } finally {
      setBusyId(null)
    }
  }

  if (error) return <ErrorState message={error} onRetry={onRetry} />
  if (loading) {
    return (
      <div className="space-y-3" aria-busy="true">
        <span className="sr-only">กำลังโหลดประวัติการตักเตือน…</span>
        {[0, 1].map((i) => <Skeleton key={i} className="h-16" rounded="rounded-xl" />)}
      </div>
    )
  }
  if (!actions.length) return <EmptyState title={emptyTitle} description={emptyDescription} className="!py-8" />

  // ใหม่สุดก่อน
  const sorted = [...actions].sort((a, b) => String(b.issued_on || "").localeCompare(String(a.issued_on || "")) || (b.id ?? 0) - (a.id ?? 0))
  return (
    <ul className="divide-y divide-gray-100 dark:divide-line">
      {sorted.map((a) => (
        <ActionRow key={a.id} a={a} showIssuer={showIssuer} busy={busyId === a.id} onPdf={onPdf}
          onAck={onAck && canAck?.(a) ? onAck : null}
          highlight={highlightId != null && String(highlightId) === String(a.id)} />
      ))}
    </ul>
  )
}
