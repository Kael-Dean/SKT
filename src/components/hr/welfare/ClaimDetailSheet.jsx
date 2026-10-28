// src/components/hr/welfare/ClaimDetailSheet.jsx
// ─────────────────────────────────────────────────────────────────────────────
// รายละเอียดคำขอเบิกสวัสดิการ 1 รายการ — GET /hr/welfare/claims/{id} (ดึงค่าล่าสุดทับแถวในตาราง)
// ปุ่มด้านล่าง = ขั้นที่ผู้ใช้ทำได้ตอนนี้ (workflowActions) → เปิด ClaimActionSheet ที่หน้าแม่
// readOnly = หน้าพนักงาน (ไม่ยิง API เพิ่ม ไม่มีปุ่ม)
// ─────────────────────────────────────────────────────────────────────────────
import { useEffect, useState } from "react"
import { TriangleAlert } from "lucide-react"
import { apiAuth } from "../../../lib/api"
import { cx, dangerBtnCls, neutralBtnCls, primaryBtnCls } from "../../../lib/styles"
import { thaiDate } from "../../../lib/loans"
import {
  FACILITY_LABEL, INSTITUTION_LABEL, PATIENT_LABEL, PAYOUT_LABEL,
  claimStatusLabel, claimStatusTone, claimTypeLabel, educationLevelLabel, isCapped, money,
  payMonthLabel, payoutNote, workflowActions,
} from "../../../lib/welfare"
import { Badge, Sheet } from "../../ui"

const btnCls = "h-12 md:h-10 md:!px-5 md:!py-0 md:!text-sm"

function Row({ label, children }) {
  if (children == null || children === "" || children === "—") return null
  return (
    <div className="flex items-baseline justify-between gap-4 py-2">
      <dt className="shrink-0 text-sm text-gray-500 dark:text-gray-400">{label}</dt>
      <dd className="min-w-0 text-right text-sm text-gray-900 dark:text-gray-100">{children}</dd>
    </div>
  )
}

function Group({ title, children }) {
  return (
    <section>
      <h3 className="mb-1 text-xs font-semibold text-gray-500 dark:text-gray-400">{title}</h3>
      <dl className="divide-y divide-gray-100 dark:divide-line">{children}</dl>
    </section>
  )
}

/**
 * @param {{ claim: object, personName?: string, patientName?: string, ctx?: object, readOnly?: boolean,
 *           onClose: () => void, onAction?: (claim: object, mode: string) => void }} props
 *   ctx = { canApprove, canSubmit, canBoard, boardRequired, meId } (ดู workflowActions)
 */
export default function ClaimDetailSheet({ claim: initial, personName, patientName, ctx, readOnly = false, onClose, onAction }) {
  const [claim, setClaim] = useState(initial)

  useEffect(() => {
    setClaim(initial)
    if (readOnly || !initial?.id) return
    let alive = true
    apiAuth(`/hr/welfare/claims/${initial.id}`)
      .then((d) => { if (alive && d && typeof d === "object") setClaim((c) => ({ ...c, ...d })) })
      .catch(() => { /* ใช้ข้อมูลจากตาราง */ })
    return () => { alive = false }
  }, [initial, readOnly])

  const c = claim || {}
  const acts = readOnly || !ctx ? [] : workflowActions(c, ctx)
  const note = payoutNote(c, ctx?.boardRequired)
  const rejectReason = c.reject_reason ?? c.rejected_reason ?? c.reason ?? null
  const isMedical = c.claim_type === "medical"
  const isEdu = c.claim_type === "education"

  return (
    <Sheet
      open
      onClose={onClose}
      title={`${claimTypeLabel(c)} #${c.id}`}
      subtitle={personName}
      size="md"
      footer={acts.length ? (
        <div className="flex flex-wrap gap-3 md:justify-end md:gap-2">
          {acts.map((a) => (
            <button key={a.mode} type="button" onClick={() => onAction?.(c, a.mode)}
              className={cx(a.mode === "reject" ? dangerBtnCls : a.primary ? primaryBtnCls : neutralBtnCls, btnCls, "flex-1 md:flex-none")}>
              {a.label}
            </button>
          ))}
        </div>
      ) : undefined}
    >
      <div className="space-y-5">
        <div className="flex flex-wrap items-center gap-2">
          <Badge tone={claimStatusTone(c)}>{claimStatusLabel(c)}</Badge>
          {c.cap_year && <span className="text-xs tabular-nums text-gray-500 dark:text-gray-400">นับวงเงินปี {c.cap_year}</span>}
        </div>

        <dl className="grid grid-cols-3 gap-2 rounded-xl bg-gray-50 p-3 text-center dark:bg-white/[.03]">
          <div>
            <dt className="text-xs text-gray-500 dark:text-gray-400">ขอเบิก</dt>
            <dd className="font-semibold tabular-nums text-gray-900 dark:text-gray-100">{money(c.requested_amount)}</dd>
          </div>
          <div>
            <dt className="text-xs text-gray-500 dark:text-gray-400">ตามสิทธิ์</dt>
            <dd className={cx("font-semibold tabular-nums", isCapped(c) ? "text-amber-700 dark:text-amber-300" : "text-gray-900 dark:text-gray-100")}>{money(c.eligible_amount)}</dd>
          </div>
          <div>
            <dt className="text-xs text-gray-500 dark:text-gray-400">อนุมัติ</dt>
            <dd className="font-semibold tabular-nums text-gray-900 dark:text-gray-100">{money(c.approved_amount)}</dd>
          </div>
        </dl>

        {isCapped(c) && c.status === "submitted" && (
          <p role="note" className="flex items-start gap-2 rounded-xl bg-amber-50 p-3 text-sm text-amber-800 dark:bg-amber-500/10 dark:text-amber-200">
            <TriangleAlert aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
            ยอดตามสิทธิ์ต่ำกว่าที่ขอเบิก เพราะวงเงินคงเหลือไม่พอหรือเกินเพดานของรายการ
          </p>
        )}
        {c.status === "rejected" && rejectReason && (
          <p className="rounded-xl bg-red-50 p-3 text-sm text-red-800 dark:bg-red-500/10 dark:text-red-200">เหตุผลที่ไม่อนุมัติ: {rejectReason}</p>
        )}
        {note && <p className="rounded-xl bg-indigo-50 p-3 text-sm text-indigo-800 dark:bg-indigo-500/10 dark:text-indigo-200">{note}</p>}

        <Group title="รายการเบิก">
          <Row label="ผู้รับบริการ">{patientName}</Row>
          {isMedical && <Row label="สถานพยาบาล">{[FACILITY_LABEL[c.facility_type], PATIENT_LABEL[c.patient_type]].filter(Boolean).join(" · ")}</Row>}
          {c.claim_type === "checkup" && <Row label="สถานพยาบาล">{FACILITY_LABEL[c.facility_type]}</Row>}
          {!isEdu && <Row label={c.claim_type === "checkup" ? "วันที่ตรวจ" : "วันที่รับบริการ"}>{c.service_date ? thaiDate(c.service_date, { long: true }) : null}</Row>}
          {isMedical && c.patient_type === "ipd" && <Row label="วันที่ออกจาก รพ.">{c.discharge_date ? thaiDate(c.discharge_date, { long: true }) : null}</Row>}
          {isMedical && <Row label="ค่ารักษา">{c.treatment_amount != null ? <span className="tabular-nums">{money(c.treatment_amount)}</span> : null}</Row>}
          {isMedical && c.patient_type === "ipd" && (
            <Row label="ค่าห้องและค่าอาหาร">
              {c.room_amount != null ? <span className="tabular-nums">{money(c.room_amount)}{c.room_days ? ` (${c.room_days} วัน)` : ""}</span> : null}
            </Row>
          )}
          {c.claim_type === "checkup" && <Row label="ค่าตรวจสุขภาพ">{c.checkup_amount != null ? <span className="tabular-nums">{money(c.checkup_amount)}</span> : null}</Row>}
          {isEdu && (
            <>
              <Row label="ปีการศึกษา">{c.academic_year ? String(c.academic_year) : null}</Row>
              <Row label="สถานศึกษา">{[c.institution_name, INSTITUTION_LABEL[c.institution_type]].filter(Boolean).join(" · ")}</Row>
              <Row label="ระดับ">{c.education_level ? educationLevelLabel(c.education_level) : null}</Row>
              <Row label="ค่าการศึกษา">{c.education_amount != null ? <span className="tabular-nums">{money(c.education_amount)}</span> : null}</Row>
            </>
          )}
          <Row label="ใบเสร็จ">{[c.receipt_no ? `เลขที่ ${c.receipt_no}` : null, c.receipt_date ? thaiDate(c.receipt_date) : null].filter(Boolean).join(" · ")}</Row>
          <Row label="หมายเหตุ">{c.note}</Row>
        </Group>

        {(c.payout_route || c.board_meeting_ref || c.paid_on) && (
          <Group title="การอนุมัติและการจ่าย">
            <Row label="เส้นทางจ่าย">{PAYOUT_LABEL[c.payout_route]}</Row>
            <Row label="งวดเงินเดือน">{payMonthLabel(c.payroll_month)}</Row>
            <Row label="มติคณะกรรมการ">{[c.board_meeting_ref, c.board_meeting_date ? thaiDate(c.board_meeting_date) : null].filter(Boolean).join(" · ")}</Row>
            <Row label="วันที่จ่าย">{c.paid_on ? thaiDate(c.paid_on, { long: true }) : null}</Row>
          </Group>
        )}
      </div>
    </Sheet>
  )
}
