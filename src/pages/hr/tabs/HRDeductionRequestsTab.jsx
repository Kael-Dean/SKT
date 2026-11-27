// src/pages/hr/tabs/HRDeductionRequestsTab.jsx
// คำขอเปลี่ยนภาษี / เงินสะสม (HR / หัวหน้าฝ่ายบัญชี) — backend PR 116 §B
//   GET  /hr/deduction-requests?status=   (ค่าเริ่มต้น pending · "ทั้งหมด" = ไม่ส่ง status)
//   POST /hr/deduction-requests/{id}/approve  { note? }  → ยอดใหม่เป็นยอดตั้งไว้ + อัปเดตงวดที่ยังเป็นร่างทันที
//   POST /hr/deduction-requests/{id}/reject   { note }   → บังคับเหตุผล
// พิจารณาคำขอของตัวเองไม่ได้ (403) → ซ่อนปุ่มเมื่อ user_id = ผู้ใช้ปัจจุบัน · 409 = ถูกพิจารณาไปแล้ว → แจ้ง + โหลดใหม่
// สิทธิ์: hr.deductionRequests.decide (gate ที่ HR_NAV)
import { useCallback, useEffect, useId, useState } from "react"
import { Check, Info, X } from "lucide-react"
import { Badge, ConfirmDialog, DataList, EmptyState, ErrorState, SkeletonTableRows, toast } from "../../../components/ui"
import SelectDropdown from "../../../components/SelectDropdown"
import DeductionChange from "../../../components/hr/DeductionChange"
import { useIsPhone } from "../../../hooks/useMediaQuery"
import { apiDetail } from "../../../lib/apiErrors"
import { getUser } from "../../../lib/auth"
import { fmtServerDateTime } from "../../../lib/serverTime"
import {
  DEDUCTION_FILTER_OPTIONS,
  DEDUCTION_STATUS,
  approveDeductionRequest,
  deductionStatusLabel,
  deductionStatusTone,
  listDeductionRequests,
  rejectDeductionRequest,
} from "../../../lib/deductions"
import { baseField, cardCls, cx, fieldErrorCls, helpTextCls, labelCls, neutralBtnCls, submitBtnCls } from "../../../lib/styles"

const errMsg = (e, fallback) => apiDetail(e) || e?.message || fallback
const thCls = "px-3 py-2.5 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 whitespace-nowrap"
const tdCls = "px-3 py-3 align-top text-sm text-gray-800 dark:text-gray-200"
const actBtn = "!h-11 gap-1.5 !px-3 md:pointer-fine:!h-9"

const nameOf = (r) => r.employee_name || `รหัส ${r.user_id}`

function DecisionInfo({ r }) {
  if (r.status !== DEDUCTION_STATUS.APPROVED && r.status !== DEDUCTION_STATUS.REJECTED) return null
  return (
    <div className="mt-1 space-y-0.5 text-xs text-gray-500 dark:text-gray-400">
      <p>
        {r.status === DEDUCTION_STATUS.APPROVED ? "อนุมัติ" : "ไม่อนุมัติ"}โดย {r.decided_by_name || "—"} ·{" "}
        <span className="tabular-nums">{fmtServerDateTime(r.decided_at, undefined, "—")}</span>
      </p>
      {r.decision_note && <p className="break-words">“{r.decision_note}”</p>}
    </div>
  )
}

function RowActions({ r, isMine, onDecide, className = "" }) {
  if (r.status !== DEDUCTION_STATUS.PENDING) return null
  if (isMine) return <p className={cx(helpTextCls, "!mt-0 text-xs", className)}>คำขอของคุณเอง — ให้ผู้พิจารณาคนอื่นอนุมัติ</p>
  return (
    <div className={cx("flex flex-wrap gap-2", className)}>
      <button type="button" className={cx(submitBtnCls, actBtn)} onClick={() => onDecide("approve", r)}>
        <Check className="size-4" aria-hidden="true" /> อนุมัติ
      </button>
      <button type="button" className={cx(neutralBtnCls, actBtn, "text-red-700 dark:text-red-300")} onClick={() => onDecide("reject", r)}>
        <X className="size-4" aria-hidden="true" /> ไม่อนุมัติ
      </button>
    </div>
  )
}

export default function HRDeductionRequestsTab() {
  const uid = useId()
  const isPhone = useIsPhone()
  const me = getUser()
  const isMine = (r) => me?.id != null && r?.user_id != null && String(r.user_id) === String(me.id)

  const [filter, setFilter] = useState(DEDUCTION_STATUS.PENDING)
  const [data, setData] = useState({ loading: true, error: "", rows: [] })
  const [attempt, setAttempt] = useState(0)
  const [action, setAction] = useState(null) // { type: "approve"|"reject", r }
  const [note, setNote] = useState("")
  const [actState, setActState] = useState({ loading: false, error: "" })

  useEffect(() => {
    let alive = true
    setData((d) => ({ ...d, loading: true, error: "" }))
    listDeductionRequests(filter)
      .then((rows) => alive && setData({ loading: false, error: "", rows }))
      .catch((e) => alive && setData({ loading: false, error: errMsg(e, "โหลดคำขอไม่สำเร็จ"), rows: [] }))
    return () => { alive = false }
  }, [filter, attempt])

  const reload = useCallback(() => setAttempt((n) => n + 1), [])

  const openDecision = useCallback((type, r) => {
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
      if (type === "approve") await approveDeductionRequest(r.id, note)
      else await rejectDeductionRequest(r.id, note)
      toast.success(
        type === "approve" ? `อนุมัติคำขอของ ${nameOf(r)} แล้ว` : "บันทึกไม่อนุมัติแล้ว",
        { description: type === "approve" ? "ยอดใหม่มีผลกับงวดที่ยังเป็นร่างทันที" : "ผู้ยื่นจะได้รับแจ้งพร้อมเหตุผล" },
      )
      setAction(null)
      reload()
    } catch (e) {
      if (e?.status === 409) {
        toast.error("คำขอนี้ถูกพิจารณาไปแล้ว", { description: errMsg(e, "โหลดรายการใหม่แล้ว") })
        setAction(null)
        reload()
        return
      }
      setActState({ loading: false, error: errMsg(e, "บันทึกไม่สำเร็จ") })
    }
  }

  const rows = data.rows
  const emptyTitle = filter === DEDUCTION_STATUS.PENDING ? "ไม่มีคำขอที่รอพิจารณา" : "ไม่พบคำขอในสถานะนี้"
  const noteId = `${uid}-note`
  const noteInvalid = action?.type === "reject" && !note.trim() && !!actState.error

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <p className="flex max-w-prose items-start gap-2 text-sm leading-relaxed text-gray-600 dark:text-gray-300">
          <Info aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-indigo-500 dark:text-indigo-400" strokeWidth={1.75} />
          <span>
            ภาษีและเงินสะสมหักเท่ากันทุกเดือน — เมื่ออนุมัติ ยอดใหม่จะเป็นยอดตั้งไว้ของพนักงาน และงวดเงินเดือนที่ยังเป็นร่างจะคำนวณใหม่ทันที
          </span>
        </p>
        <div className="w-full sm:w-52 sm:shrink-0">
          <SelectDropdown
            size="sm"
            value={filter}
            onChange={setFilter}
            ariaLabel="สถานะคำขอ"
            showSwatch={false}
            options={DEDUCTION_FILTER_OPTIONS}
          />
        </div>
      </div>

      {data.error ? (
        <ErrorState message={data.error} onRetry={reload} />
      ) : isPhone ? (
        <DataList
          items={rows}
          keyOf={(r) => r.id}
          loading={data.loading}
          skeletonRows={3}
          title={(r) => <span className="block min-w-0 truncate">{nameOf(r)}</span>}
          subtitle={(r) => `ยื่นเมื่อ ${fmtServerDateTime(r.created_at, undefined, "—")}`}
          badge={(r) => <Badge tone={deductionStatusTone(r.status)}>{deductionStatusLabel(r)}</Badge>}
          fields={(r) => [
            { label: "ภาษี", value: () => <DeductionChange current={r.current_tax} next={r.new_tax} />, span: 2 },
            { label: "เงินสะสม", value: () => <DeductionChange current={r.current_reserve} next={r.new_reserve} />, span: 2 },
            ...(r.note ? [{ label: "หมายเหตุ", value: () => <span className="block whitespace-normal break-words">{r.note}</span>, span: 2 }] : []),
            ...(r.status === DEDUCTION_STATUS.APPROVED || r.status === DEDUCTION_STATUS.REJECTED
              ? [{ label: "ผลพิจารณา", value: () => <div className="whitespace-normal"><DecisionInfo r={r} /></div>, span: 2 }]
              : []),
          ]}
          actions={(r) => (r.status === DEDUCTION_STATUS.PENDING
            ? <RowActions r={r} isMine={isMine(r)} onDecide={openDecision} className="w-full [&>button]:flex-1" />
            : null)}
          emptyState={<EmptyState title={emptyTitle} description="พนักงานยื่นคำขอได้ที่หน้า “ข้อมูลการเงินของฉัน”" />}
        />
      ) : data.loading ? (
        <SkeletonTableRows rows={4} cols={7} />
      ) : !rows.length ? (
        <EmptyState title={emptyTitle} description="พนักงานยื่นคำขอได้ที่หน้า “ข้อมูลการเงินของฉัน”" />
      ) : (
        <div className={cx(cardCls, "overflow-x-auto")}>
          <table className="w-full min-w-[920px]">
            <caption className="sr-only">คำขอเปลี่ยนภาษี / เงินสะสม</caption>
            <thead className="border-b border-gray-200 bg-gray-50/80 dark:border-line dark:bg-white/[.03]">
              <tr>
                <th scope="col" className={thCls}>พนักงาน</th>
                <th scope="col" className={cx(thCls, "text-right")}>ภาษี เดิม → ใหม่</th>
                <th scope="col" className={cx(thCls, "text-right")}>เงินสะสม เดิม → ใหม่</th>
                <th scope="col" className={thCls}>หมายเหตุ</th>
                <th scope="col" className={thCls}>วันที่ยื่น</th>
                <th scope="col" className={thCls}>สถานะ</th>
                <th scope="col" className={cx(thCls, "text-right")}><span className="sr-only">การดำเนินการ</span></th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} className="border-b border-gray-100 last:border-0 even:bg-gray-50 dark:border-line dark:even:bg-gray-700/30">
                  <td className={cx(tdCls, "max-w-[200px]")}>
                    <p className="truncate font-medium text-gray-900 dark:text-gray-100" title={nameOf(r)}>{nameOf(r)}</p>
                    <p className="text-xs tabular-nums text-gray-500 dark:text-gray-400">รหัส {r.user_id}</p>
                  </td>
                  <td className={cx(tdCls, "text-right")}><DeductionChange current={r.current_tax} next={r.new_tax} /></td>
                  <td className={cx(tdCls, "text-right")}><DeductionChange current={r.current_reserve} next={r.new_reserve} /></td>
                  <td className={cx(tdCls, "max-w-[240px]")}>
                    {r.note ? <p className="line-clamp-3 break-words" title={r.note}>{r.note}</p> : <span className="text-gray-400 dark:text-gray-500">—</span>}
                  </td>
                  <td className={cx(tdCls, "whitespace-nowrap tabular-nums")}>{fmtServerDateTime(r.created_at, undefined, "—")}</td>
                  <td className={cx(tdCls, "max-w-[220px]")}>
                    <Badge tone={deductionStatusTone(r.status)}>{deductionStatusLabel(r)}</Badge>
                    <DecisionInfo r={r} />
                  </td>
                  <td className={cx(tdCls, "text-right")}>
                    <RowActions r={r} isMine={isMine(r)} onDecide={openDecision} className="justify-end" />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <ConfirmDialog
        open={!!action}
        title={action?.type === "approve" ? "อนุมัติคำขอนี้?" : "ไม่อนุมัติคำขอนี้?"}
        description={
          action?.type === "approve"
            ? `ยอดใหม่ของ ${action?.r ? nameOf(action.r) : "พนักงาน"} จะเป็นยอดตั้งไว้ และมีผลกับงวดที่ยังเป็นร่างทันที`
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
        {action?.r && (
          <dl className="mb-3 grid grid-cols-[auto_minmax(0,1fr)] gap-x-3 gap-y-1 rounded-lg bg-gray-50 px-3 py-2 text-sm ring-1 ring-inset ring-gray-200/70 dark:bg-white/[.03] dark:ring-line">
            <dt className="text-gray-600 dark:text-gray-400">ภาษี</dt>
            <dd className="min-w-0"><DeductionChange current={action.r.current_tax} next={action.r.new_tax} /></dd>
            <dt className="text-gray-600 dark:text-gray-400">เงินสะสม</dt>
            <dd className="min-w-0"><DeductionChange current={action.r.current_reserve} next={action.r.new_reserve} /></dd>
          </dl>
        )}
        <label htmlFor={noteId} className={labelCls}>
          {action?.type === "approve" ? "หมายเหตุ (ไม่บังคับ)" : "เหตุผลที่ไม่อนุมัติ"}
          {action?.type === "reject" && <span className="text-red-600 dark:text-red-400" aria-hidden="true"> *</span>}
        </label>
        <textarea
          id={noteId}
          rows={3}
          maxLength={500}
          value={note}
          onChange={(e) => setNote(e.target.value)}
          aria-required={action?.type === "reject" ? "true" : undefined}
          aria-invalid={noteInvalid ? "true" : undefined}
          placeholder={action?.type === "reject" ? "เช่น เงินสะสมต่ำกว่าที่ระเบียบกำหนด" : ""}
          className={cx(baseField, "!rounded-lg !px-3 !py-2 md:!text-sm", noteInvalid && fieldErrorCls)}
        />
      </ConfirmDialog>
    </div>
  )
}
