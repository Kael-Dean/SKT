// src/components/hr/MyDeductionsCard.jsx
// ภาษี / เงินสะสม ต่อเดือน (self-service, /my-financial) — backend PR 116 §A
//   A1 ยอดปัจจุบัน + ที่มาของยอด · A2 ขอเปลี่ยนยอด (Sheet) · A3 ประวัติคำขอ · A4 ยกเลิกคำขอที่รอพิจารณา
// ลิงก์จากการแจ้งเตือน deduction_request_decided → /my-financial?section=deductions (เลื่อนมาที่การ์ดนี้)
import { useCallback, useEffect, useId, useRef, useState } from "react"
import { useSearchParams } from "react-router-dom"
import { Clock, PencilLine } from "lucide-react"
import { Badge, ConfirmDialog, ErrorState, Sheet, SkeletonText, toast } from "../ui"
import DeductionChange from "./DeductionChange"
import { apiDetail } from "../../lib/apiErrors"
import { money } from "../../lib/payroll"
import { fmtServerDateTime } from "../../lib/serverTime"
import {
  DEDUCTIONS_SECTION,
  DEDUCTION_STATUS,
  cancelDeductionRequest,
  createDeductionRequest,
  deductionStatusLabel,
  deductionStatusTone,
  getMyDeductions,
  listMyDeductionRequests,
  parseAmountInput,
} from "../../lib/deductions"
import {
  baseField,
  cardCls,
  cx,
  errorTextCls,
  fieldErrorCls,
  helpTextCls,
  labelCls,
  neutralBtnCls,
  secondaryBtnCls,
  submitBtnCls,
} from "../../lib/styles"

const errMsg = (e, fallback) => apiDetail(e) || e?.message || fallback
const fieldCls = cx(baseField, "!rounded-lg !px-3 !py-2 md:!text-sm")

// ─── A1 ยอดต่อเดือน ──────────────────────────────────────────────────────────
function AmountBlock({ label, amount, source, hint }) {
  return (
    <div className="min-w-0 rounded-xl bg-gray-50 px-4 py-3 ring-1 ring-inset ring-gray-200/70 dark:bg-white/[.03] dark:ring-line">
      <p className="text-sm text-gray-600 dark:text-gray-400">{label}</p>
      <p className="mt-1 text-xl font-semibold tabular-nums text-gray-900 dark:text-gray-100">
        {money(amount)} <span className="text-sm font-normal text-gray-500 dark:text-gray-400">บาท</span>
      </p>
      {(source || hint) && (
        <p className="mt-0.5 text-xs text-gray-500 dark:text-gray-400">
          {[source, hint].filter(Boolean).join(" · ")}
        </p>
      )}
    </div>
  )
}

// ─── A2 ฟอร์มขอเปลี่ยนยอด ─────────────────────────────────────────────────────
function RequestSheet({ open, onClose, current, onSubmitted }) {
  const uid = useId()
  const [tax, setTax] = useState("")
  const [reserve, setReserve] = useState("")
  const [note, setNote] = useState("")
  const [errors, setErrors] = useState({})
  const [formError, setFormError] = useState("")
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!open) return
    setTax("")
    setReserve("")
    setNote("")
    setErrors({})
    setFormError("")
    setSaving(false)
  }, [open])

  const minimum = current?.reserve_minimum != null ? Number(current.reserve_minimum) : null

  const submit = async (e) => {
    e?.preventDefault?.()
    const newTax = parseAmountInput(tax)
    const newReserve = parseAmountInput(reserve)
    const next = {}
    if (newTax === undefined) next.tax = "กรอกเป็นตัวเลข ทศนิยมไม่เกิน 2 ตำแหน่ง"
    if (newReserve === undefined) next.reserve = "กรอกเป็นตัวเลข ทศนิยมไม่เกิน 2 ตำแหน่ง"
    else if (newReserve != null && minimum != null && Number(newReserve) < minimum) {
      next.reserve = `เงินสะสมต้องไม่ต่ำกว่า ${money(minimum)} บาท`
    }
    setErrors(next)
    if (Object.keys(next).length) {
      setFormError("")
      return
    }
    if (newTax == null && newReserve == null) {
      setFormError("ระบุยอดภาษีหรือเงินสะสมที่ต้องการอย่างน้อยหนึ่งรายการ")
      return
    }
    setFormError("")
    setSaving(true)
    try {
      await createDeductionRequest({ newTax, newReserve, note })
      toast.success("ส่งคำขอแล้ว", {
        description: "รอฝ่ายบุคคล/หัวหน้าฝ่ายบัญชีพิจารณา · ยอดใหม่จะใช้ตั้งแต่งวดเงินเดือนถัดไปที่ยังเป็นร่าง",
      })
      onSubmitted()
    } catch (err) {
      setSaving(false)
      const msg = errMsg(err, "ส่งคำขอไม่สำเร็จ")
      // 422 เงินสะสมต่ำกว่าขั้นต่ำ → ผูกกับช่องเงินสะสม; อื่น ๆ (422 ไม่ระบุยอด / 409 มีคำขอค้าง) แสดงรวม
      if (err?.status === 422 && /เงินสะสม/.test(msg) && newReserve != null) setErrors({ reserve: msg })
      else setFormError(msg)
      if (err?.status === 409) onSubmitted({ silent: true })
    }
  }

  const taxErrId = `${uid}-tax-err`
  const resErrId = `${uid}-res-err`
  const formErrId = `${uid}-form-err`

  return (
    <Sheet
      open={open}
      onClose={onClose}
      busy={saving}
      size="md"
      title="ขอเปลี่ยนยอดหักภาษี / เงินสะสม"
      subtitle="เว้นช่องที่ไม่ต้องการเปลี่ยนไว้ — ยอดใหม่ใช้ตั้งแต่งวดถัดไปที่ยังเป็นร่าง หลังได้รับอนุมัติ"
      footer={
        <div className="grid grid-cols-2 gap-3 md:flex md:justify-end md:gap-2">
          <button type="button" className={neutralBtnCls} onClick={onClose} disabled={saving}>
            ยกเลิก
          </button>
          <button type="submit" form={`${uid}-form`} className={submitBtnCls} disabled={saving} aria-describedby={formError ? formErrId : undefined}>
            {saving ? "กำลังส่ง…" : "ส่งคำขอ"}
          </button>
        </div>
      }
    >
      <form id={`${uid}-form`} noValidate onSubmit={submit} className="space-y-4">
        <div className="min-w-0">
          <label htmlFor={`${uid}-tax`} className={labelCls}>ภาษีหัก ณ ที่จ่าย ต่อเดือน (บาท)</label>
          <input
            id={`${uid}-tax`}
            type="text"
            inputMode="decimal"
            autoComplete="off"
            value={tax}
            onChange={(e) => { setTax(e.target.value); if (errors.tax) setErrors((x) => ({ ...x, tax: "" })) }}
            placeholder="ไม่เปลี่ยน"
            aria-invalid={errors.tax ? "true" : undefined}
            aria-describedby={cx(`${uid}-tax-hint`, errors.tax && taxErrId)}
            className={cx(fieldCls, "tabular-nums", errors.tax && fieldErrorCls)}
          />
          <p id={`${uid}-tax-hint`} className={helpTextCls}>
            ตอนนี้ <span className="tabular-nums">{money(current?.tax)}</span> บาท · ใส่ 0 = ไม่หักภาษี
          </p>
          {errors.tax && <p id={taxErrId} className={errorTextCls}>{errors.tax}</p>}
        </div>

        <div className="min-w-0">
          <label htmlFor={`${uid}-res`} className={labelCls}>เงินสะสม ต่อเดือน (บาท)</label>
          <input
            id={`${uid}-res`}
            type="text"
            inputMode="decimal"
            autoComplete="off"
            value={reserve}
            onChange={(e) => { setReserve(e.target.value); if (errors.reserve) setErrors((x) => ({ ...x, reserve: "" })) }}
            placeholder="ไม่เปลี่ยน"
            aria-invalid={errors.reserve ? "true" : undefined}
            aria-describedby={cx(`${uid}-res-hint`, errors.reserve && resErrId)}
            className={cx(fieldCls, "tabular-nums", errors.reserve && fieldErrorCls)}
          />
          <p id={`${uid}-res-hint`} className={helpTextCls}>
            ตอนนี้ <span className="tabular-nums">{money(current?.reserve)}</span> บาท
            {minimum != null && <> · ขั้นต่ำ <span className="tabular-nums">{money(minimum)}</span> บาท</>}
          </p>
          {errors.reserve && <p id={resErrId} className={errorTextCls}>{errors.reserve}</p>}
        </div>

        <div className="min-w-0">
          <label htmlFor={`${uid}-note`} className={labelCls}>
            หมายเหตุ <span className="font-normal text-gray-500 dark:text-gray-400">(ไม่บังคับ)</span>
          </label>
          <textarea
            id={`${uid}-note`}
            rows={2}
            maxLength={500}
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="เช่น ขึ้นเงินเดือน, ต้องการลดภาษีที่หัก"
            className={fieldCls}
          />
        </div>

        {formError && (
          <p id={formErrId} role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700 ring-1 ring-inset ring-red-200 dark:bg-red-500/10 dark:text-red-300 dark:ring-red-400/30">
            {formError}
          </p>
        )}
      </form>
    </Sheet>
  )
}

// ─── A3 ประวัติคำขอ ───────────────────────────────────────────────────────────
function RequestItem({ r, onCancel }) {
  const pending = r.status === DEDUCTION_STATUS.PENDING
  const decided = r.status === DEDUCTION_STATUS.APPROVED || r.status === DEDUCTION_STATUS.REJECTED
  return (
    <li className="space-y-2 px-4 py-3">
      <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
        <p className="text-xs text-gray-500 dark:text-gray-400">ยื่นเมื่อ {fmtServerDateTime(r.created_at, undefined, "—")}</p>
        <Badge tone={deductionStatusTone(r.status)}>{deductionStatusLabel(r)}</Badge>
      </div>
      <dl className="grid grid-cols-[auto_minmax(0,1fr)] gap-x-3 gap-y-1 text-sm">
        <dt className="text-gray-600 dark:text-gray-400">ภาษี</dt>
        <dd className="min-w-0"><DeductionChange current={r.current_tax} next={r.new_tax} /></dd>
        <dt className="text-gray-600 dark:text-gray-400">เงินสะสม</dt>
        <dd className="min-w-0"><DeductionChange current={r.current_reserve} next={r.new_reserve} /></dd>
      </dl>
      {r.note && <p className="break-words text-sm text-gray-700 dark:text-gray-300">หมายเหตุ: {r.note}</p>}
      {decided && (
        <p className="text-xs text-gray-500 dark:text-gray-400">
          {r.status === DEDUCTION_STATUS.APPROVED ? "อนุมัติ" : "ไม่อนุมัติ"}โดย {r.decided_by_name || "—"} · {fmtServerDateTime(r.decided_at, undefined, "—")}
        </p>
      )}
      {r.status === DEDUCTION_STATUS.REJECTED && r.decision_note && (
        <p className="break-words rounded-lg bg-red-50 px-3 py-2 text-sm text-red-800 ring-1 ring-inset ring-red-200 dark:bg-red-500/10 dark:text-red-200 dark:ring-red-400/30">
          เหตุผล: {r.decision_note}
        </p>
      )}
      {r.status === DEDUCTION_STATUS.APPROVED && r.decision_note && (
        <p className="break-words text-sm text-gray-700 dark:text-gray-300">หมายเหตุผู้อนุมัติ: {r.decision_note}</p>
      )}
      {pending && (
        <button type="button" onClick={() => onCancel(r)} className={cx(neutralBtnCls, "text-red-700 dark:text-red-300")}>
          ยกเลิกคำขอ
        </button>
      )}
    </li>
  )
}

// ─── การ์ดหลัก ────────────────────────────────────────────────────────────────
export default function MyDeductionsCard() {
  const [params] = useSearchParams()
  const sectionRef = useRef(null)
  const scrolledRef = useRef(false)
  const [current, setCurrent] = useState({ state: "loading", data: null, error: "" }) // loading | ready | missing | error
  const [history, setHistory] = useState({ loading: true, rows: [], error: "" })
  const [formOpen, setFormOpen] = useState(false)
  const [cancelling, setCancelling] = useState(null) // request row
  const [cancelState, setCancelState] = useState({ loading: false, error: "" })

  const loadCurrent = useCallback(() => {
    setCurrent((c) => ({ ...c, state: c.data ? c.state : "loading", error: "" }))
    return getMyDeductions()
      .then((d) => setCurrent({ state: "ready", data: d, error: "" }))
      .catch((e) => {
        if (e?.status === 404) setCurrent({ state: "missing", data: null, error: "" })
        else setCurrent({ state: "error", data: null, error: errMsg(e, "โหลดยอดภาษี / เงินสะสมไม่สำเร็จ") })
      })
  }, [])

  const loadHistory = useCallback(() => {
    setHistory((h) => ({ ...h, loading: true, error: "" }))
    return listMyDeductionRequests()
      .then((rows) => setHistory({ loading: false, rows, error: "" }))
      .catch((e) => setHistory({ loading: false, rows: [], error: errMsg(e, "โหลดประวัติคำขอไม่สำเร็จ") }))
  }, [])

  const reload = useCallback(() => { loadCurrent(); loadHistory() }, [loadCurrent, loadHistory])
  useEffect(() => { reload() }, [reload])

  // มาจากการแจ้งเตือนผลพิจารณา → เลื่อนมาที่การ์ดนี้ครั้งเดียวเมื่อโหลดเสร็จ
  const wantScroll = params.get("section") === DEDUCTIONS_SECTION
  useEffect(() => {
    if (!wantScroll || scrolledRef.current || current.state === "loading" || history.loading) return
    scrolledRef.current = true
    sectionRef.current?.scrollIntoView({ block: "start", behavior: "smooth" })
  }, [wantScroll, current.state, history.loading])

  const data = current.data
  const hasPending = data?.pending_request_id != null

  const confirmCancel = async () => {
    const r = cancelling
    setCancelState({ loading: true, error: "" })
    try {
      await cancelDeductionRequest(r.id)
      toast.success("ยกเลิกคำขอแล้ว", { description: "ยื่นคำขอใหม่ได้ทันที" })
      setCancelling(null)
      reload()
    } catch (e) {
      if (e?.status === 409) {
        toast.error("ยกเลิกไม่ได้", { description: errMsg(e, "คำขอนี้ถูกพิจารณาไปแล้ว") })
        setCancelling(null)
        reload()
        return
      }
      setCancelState({ loading: false, error: errMsg(e, "ยกเลิกคำขอไม่สำเร็จ") })
    }
  }

  return (
    <section
      ref={sectionRef}
      id="my-deductions"
      aria-labelledby="fin-deduct-h"
      style={{ scrollMarginTop: "calc(var(--topbar-h, 64px) + 1rem)" }}
      className={cx(cardCls, "p-5")}
    >
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
        <h2 id="fin-deduct-h" className="text-base font-semibold text-gray-900 dark:text-gray-100">ภาษี / เงินสะสม ต่อเดือน</h2>
        {current.state === "ready" && (
          hasPending ? (
            <Badge tone="pending" className="gap-1">
              <Clock aria-hidden="true" className="size-3.5" /> มีคำขอรอพิจารณา
            </Badge>
          ) : (
            <button type="button" onClick={() => setFormOpen(true)} className={cx(secondaryBtnCls, "w-full gap-1.5 sm:w-auto")}>
              <PencilLine aria-hidden="true" className="size-4" /> ขอเปลี่ยนยอด
            </button>
          )
        )}
      </div>
      <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
        หักเท่ากันทุกเดือน จนกว่าจะยื่นขอเปลี่ยนและได้รับอนุมัติจากฝ่ายบุคคลหรือหัวหน้าฝ่ายบัญชี
      </p>

      <div className="mt-4">
        {current.state === "loading" ? (
          <SkeletonText lines={3} />
        ) : current.state === "error" ? (
          <ErrorState message={current.error} onRetry={loadCurrent} />
        ) : current.state === "missing" ? (
          <p className="rounded-xl bg-gray-50 px-4 py-3 text-sm text-gray-600 ring-1 ring-inset ring-gray-200/70 dark:bg-white/[.03] dark:text-gray-400 dark:ring-line">
            ยังไม่มีข้อมูลการเงินในทะเบียน — ติดต่อฝ่ายบุคคลเพื่อบันทึกข้อมูล
          </p>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2">
            <AmountBlock label="ภาษีหัก ณ ที่จ่าย ต่อเดือน" amount={data?.tax} source={data?.tax_source_label} />
            <AmountBlock
              label="เงินสะสม ต่อเดือน"
              amount={data?.reserve}
              source={data?.reserve_source_label}
              hint={data?.reserve_minimum != null ? `ขั้นต่ำ ${money(data.reserve_minimum)} บาท` : null}
            />
          </div>
        )}
      </div>

      {current.state !== "missing" && (
        <div className="mt-5 border-t border-gray-100 pt-4 dark:border-line">
          <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">คำขอของฉัน</h3>
          <div className="mt-2">
            {history.loading && !history.rows.length ? (
              <SkeletonText lines={2} />
            ) : history.error ? (
              <ErrorState message={history.error} onRetry={loadHistory} />
            ) : !history.rows.length ? (
              <p className="text-sm text-gray-500 dark:text-gray-400">ยังไม่เคยยื่นคำขอเปลี่ยนยอด</p>
            ) : (
              <ul className="divide-y divide-gray-100 overflow-hidden rounded-xl ring-1 ring-gray-200/70 dark:divide-line dark:ring-line">
                {history.rows.map((r) => (
                  <RequestItem
                    key={r.id}
                    r={r}
                    onCancel={(x) => { setCancelState({ loading: false, error: "" }); setCancelling(x) }}
                  />
                ))}
              </ul>
            )}
          </div>
        </div>
      )}

      <RequestSheet
        open={formOpen}
        onClose={() => setFormOpen(false)}
        current={data}
        onSubmitted={(opts) => {
          if (!opts?.silent) setFormOpen(false)
          reload()
        }}
      />

      <ConfirmDialog
        open={!!cancelling}
        title="ยกเลิกคำขอนี้?"
        description="คำขอจะไม่ถูกพิจารณา ยอดหักยังเป็นยอดเดิม และยื่นคำขอใหม่ได้ทันที"
        confirmLabel="ยกเลิกคำขอ"
        cancelLabel="ไม่ยกเลิก"
        tone="danger"
        loading={cancelState.loading}
        loadingLabel="กำลังยกเลิก…"
        error={cancelState.error}
        onConfirm={confirmCancel}
        onCancel={() => setCancelling(null)}
      />
    </section>
  )
}
