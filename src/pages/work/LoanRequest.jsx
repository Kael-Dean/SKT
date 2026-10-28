// src/pages/work/LoanRequest.jsx
// ─────────────────────────────────────────────────────────────────────────────
// ขอกู้เงินกองทุนสงเคราะห์เจ้าหน้าที่ (3K, backend PR #30 — ระเบียบ 15)
//
//   GET  /personnel/me/loans/eligibility   วงเงินสูงสุด (max_amount) + เหตุผล + warnings[]
//   GET  /personnel/me/loans/preview?amount=&repayment_months=&monthly_principal=
//        ตารางผ่อนโดยประมาณ (live, debounce) — ต้นเท่ากัน + ดอก 5%/ปี ตามวันจริง ปัดขึ้นเป็นบาท
//   POST /personnel/me/loans               + external_deductions, monthly_principal (ไม่บังคับ)
//   GET  /personnel/me/loans               ประวัติ (status_label, monthly_principal, disbursed_on)
//
// กฎวงเงิน/เงินเหลือรับ ≥ 2,000/ผู้ค้ำไม่ใช่คู่สมรส/งวดสุดท้ายก่อนเกษียณ ตรวจที่ backend — 422 แสดง detail ตามที่ส่งมา
// ─────────────────────────────────────────────────────────────────────────────
import { useCallback, useEffect, useId, useMemo, useState } from "react"
import { apiAuth } from "../../lib/api"
import { apiDetail } from "../../lib/apiErrors"
import {
  cx, baseField, cardCls, labelCls, helpTextCls, errorTextCls, primaryBtnCls, neutralBtnCls,
  segmentedCls, segmentedItemCls, segmentedItemActiveCls,
} from "../../lib/styles"
import { Badge, EmptyState, ErrorState, Skeleton, Tabs, panelId, tabId } from "../../components/ui"
import {
  LOAN_PURPOSE_LABEL, LOAN_PURPOSE_OPTIONS, asList, guarantorText, loanStatusLabel, loanStatusTone,
  money, thaiDate, warningList,
} from "../../lib/loans"
import PageTitle from "../../components/PageTitle"

const MAX_MONTHS = 180
const PREVIEW_DELAY = 450
const ID_BASE = "loan-request"

const fieldCls = cx(baseField, "!rounded-xl !px-3 !py-2 md:!text-sm")
const errBorder = "!border-red-500 dark:!border-red-400"

const EMPTY_FORM = {
  purpose_code: "",
  purpose: "",
  amount: "",
  term_mode: "months", // months = กำหนดจำนวนงวด · principal = กำหนดต้นเงินต่องวด
  repayment_months: "",
  monthly_principal: "",
  external_deductions: "",
  guarantor_1_id: "",
  guarantor_2_id: "",
}

const num = (v) => {
  const s = String(v ?? "").replace(/,/g, "").trim()
  return s === "" ? null : Number(s)
}

function Warnings({ items, className }) {
  if (!items.length) return null
  return (
    <ul role="status" className={cx("space-y-1 rounded-xl bg-amber-50 px-4 py-3 text-sm leading-relaxed text-amber-900 dark:bg-amber-500/10 dark:text-amber-200", className)}>
      {items.map((w) => <li key={w}>{w}</li>)}
    </ul>
  )
}

function Stat({ label, children, hint, strong }) {
  return (
    <div>
      <dt className="text-xs text-gray-500 dark:text-gray-400">{label}</dt>
      <dd className={cx("mt-0.5 tabular-nums", strong ? "text-lg font-bold text-indigo-700 dark:text-indigo-300" : "text-sm font-medium text-gray-900 dark:text-gray-100")}>{children}</dd>
      {hint && <dd className="text-xs text-gray-500 dark:text-gray-400">{hint}</dd>}
    </div>
  )
}

// ─── สิทธิ์กู้ ───────────────────────────────────────────────────────────────

function EligibilityCard({ data, loading, error, onRetry }) {
  if (loading) return <Skeleton className="h-36" rounded="rounded-2xl" />
  if (error) return <ErrorState message={`ตรวจสิทธิ์กู้ไม่สำเร็จ: ${error}`} onRetry={onRetry} />
  if (!data) return null
  const max = Number(data.max_amount)
  const blocked = Number.isFinite(max) && max <= 0
  return (
    <section aria-labelledby="loan-elig-h" className={cx(cardCls, "space-y-4 p-5")}>
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 id="loan-elig-h" className="text-base font-semibold text-gray-900 dark:text-gray-100">วงเงินที่กู้ได้</h2>
        <p className={cx("text-2xl font-bold tabular-nums", blocked ? "text-gray-500 dark:text-gray-400" : "text-indigo-700 dark:text-indigo-300")}>
          {money(data.max_amount)} <span className="text-sm font-medium">บาท</span>
        </p>
      </div>
      <dl className="grid grid-cols-2 gap-x-4 gap-y-3 sm:grid-cols-4">
        <Stat label="อายุงาน">{data.service_months != null ? `${data.service_months} เดือน` : "—"}</Stat>
        <Stat label="เพดานตามอายุงาน">{money(data.service_cap)}</Stat>
        <Stat label="เพดานตามเงินเดือน" hint={data.multiple != null && data.salary != null ? `${money(data.salary)} × ${data.multiple}` : undefined}>{money(data.income_cap)}</Stat>
        <Stat label="เงินได้สุทธิล่าสุด">{money(data.latest_net_pay)}</Stat>
        {data.retirement_date && <Stat label="วันเกษียณ">{thaiDate(data.retirement_date, { long: true })}</Stat>}
      </dl>
      <Warnings items={warningList(data)} />
      {blocked && !warningList(data).length && (
        <p className="text-sm text-gray-600 dark:text-gray-300">ตอนนี้ยังไม่มีวงเงินให้กู้ ติดต่อฝ่ายบุคคลหากข้อมูลไม่ถูกต้อง</p>
      )}
    </section>
  )
}

// ─── ประมาณการผ่อน ───────────────────────────────────────────────────────────

function PreviewPanel({ preview, loading, error, ready }) {
  const [showAll, setShowAll] = useState(false)
  const rows = asList(preview, "rows")
  if (!ready) {
    return <p className="rounded-xl bg-gray-50 px-4 py-3 text-sm text-gray-600 dark:bg-white/[.03] dark:text-gray-300">กรอกจำนวนเงินและจำนวนงวด (หรือต้นเงินต่องวด) เพื่อดูค่างวดโดยประมาณ</p>
  }
  if (error) return <p role="alert" className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700 dark:bg-red-500/10 dark:text-red-300">{error}</p>
  if (!preview) return <Skeleton className="h-24" rounded="rounded-xl" />
  const first = rows[0]
  const last = rows[rows.length - 1]
  const visible = showAll ? rows : rows.slice(0, 3)
  return (
    <div aria-live="polite" aria-busy={loading || undefined} className={cx("space-y-3 rounded-xl bg-gray-50 p-4 transition-opacity duration-200 dark:bg-white/[.03]", loading && "opacity-60")}>
      <dl className="grid grid-cols-2 gap-x-4 gap-y-3 sm:grid-cols-4">
        <Stat label="จำนวนงวด">{preview.instalments ?? rows.length ?? "—"}</Stat>
        <Stat label="ต้นเงินต่องวด">{money(preview.monthly_principal)}</Stat>
        <Stat label="ค่างวดสูงสุด" strong>{money(preview.max_installment)}</Stat>
        <Stat label="ดอกเบี้ยรวม">{money(preview.total_interest)}</Stat>
        {first?.due_date && <Stat label="ชำระงวดแรก">{thaiDate(first.due_date, { long: true })}</Stat>}
        {last?.due_date && <Stat label="ชำระงวดสุดท้าย">{thaiDate(last.due_date, { long: true })}</Stat>}
      </dl>
      <Warnings items={warningList(preview)} />
      {rows.length > 0 && (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <caption className="sr-only">ตารางผ่อนโดยประมาณ</caption>
            <thead>
              <tr className="text-xs text-gray-500 dark:text-gray-400">
                <th scope="col" className="py-1.5 pr-3 text-left font-medium">วันชำระ</th>
                <th scope="col" className="py-1.5 px-3 text-right font-medium">เงินต้น</th>
                <th scope="col" className="py-1.5 px-3 text-right font-medium">ดอกเบี้ย</th>
                <th scope="col" className="py-1.5 pl-3 text-right font-medium">ค่างวด</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200/70 dark:divide-line">
              {visible.map((r, i) => (
                <tr key={r.id ?? i}>
                  <td className="py-1.5 pr-3 text-gray-700 dark:text-gray-300">{r.due_date ? thaiDate(r.due_date) : `งวด ${i + 1}`}</td>
                  <td className="py-1.5 px-3 text-right tabular-nums text-gray-700 dark:text-gray-300">{money(r.principal)}</td>
                  <td className="py-1.5 px-3 text-right tabular-nums text-gray-700 dark:text-gray-300">{money(r.interest)}</td>
                  <td className="py-1.5 pl-3 text-right font-medium tabular-nums text-gray-900 dark:text-gray-100">{money(r.installment_amount)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {rows.length > 3 && (
            <button type="button" onClick={() => setShowAll((v) => !v)} aria-expanded={showAll}
              className="mt-2 cursor-pointer rounded text-sm font-medium text-indigo-700 hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 dark:text-indigo-300">
              {showAll ? "ย่อตาราง" : `ดูทั้ง ${rows.length} งวด`}
            </button>
          )}
        </div>
      )}
      <p className="text-xs text-gray-500 dark:text-gray-400">ดอกเบี้ย 5% ต่อปี คิดตามจำนวนวันจริง ชำระวันทำการสุดท้ายของเดือน ยอดจริงคำนวณอีกครั้งเมื่อจ่ายเงินกู้</p>
    </div>
  )
}

// ─── ประวัติ ─────────────────────────────────────────────────────────────────

function HistoryCard({ loan }) {
  const [open, setOpen] = useState(false)
  const schedule = asList(loan.schedule ?? loan.schedule_rows ?? loan.instalments)
  const reason = loan.rejected_reason || loan.reject_reason || loan.rejection_reason
  return (
    <article className={cx(cardCls, "space-y-3 p-4")}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="font-semibold text-gray-900 dark:text-gray-100">
          {LOAN_PURPOSE_LABEL[loan.purpose_code] ?? loan.purpose_code ?? "เงินกู้กองทุนสงเคราะห์"}
          <span className="ml-2 text-xs font-normal tabular-nums text-gray-500 dark:text-gray-400">#{loan.id}</span>
        </h3>
        <Badge tone={loanStatusTone(loan)}>{loanStatusLabel(loan)}</Badge>
      </div>
      <dl className="grid grid-cols-2 gap-x-4 gap-y-2 sm:grid-cols-4">
        <Stat label="วงเงิน">{money(loan.loan_amount ?? loan.amount)}</Stat>
        <Stat label="จำนวนงวด">{loan.repayment_months ?? "—"}</Stat>
        <Stat label="ต้นเงินต่องวด">{money(loan.monthly_principal)}</Stat>
        <Stat label={loan.disbursed_on ? "วันที่ได้รับเงิน" : "วันที่ยื่น"}>{thaiDate(loan.disbursed_on || loan.created_at)}</Stat>
      </dl>
      <p className="text-xs text-gray-500 dark:text-gray-400">ผู้ค้ำประกัน: {guarantorText(loan)}</p>
      {loan.status === "rejected" && reason && (
        <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-800 dark:bg-red-500/10 dark:text-red-200">เหตุผล: {reason}</p>
      )}
      {schedule.length > 0 && (
        <div>
          <button type="button" onClick={() => setOpen((v) => !v)} aria-expanded={open}
            className="cursor-pointer rounded text-sm font-medium text-indigo-700 hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 dark:text-indigo-300">
            {open ? "ซ่อนตารางผ่อน" : `ตารางผ่อน ${schedule.length} งวด`}
          </button>
          {open && (
            <div className="mt-2 max-h-80 overflow-auto">
              <table className="w-full text-sm">
                <thead className="sticky top-0 bg-white dark:bg-surface">
                  <tr className="text-xs text-gray-500 dark:text-gray-400">
                    <th scope="col" className="py-1.5 pr-3 text-left font-medium">วันชำระ</th>
                    <th scope="col" className="py-1.5 px-3 text-right font-medium">ค่างวด</th>
                    <th scope="col" className="py-1.5 px-3 text-right font-medium">คงเหลือ</th>
                    <th scope="col" className="py-1.5 pl-3 text-right font-medium">สถานะ</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-line">
                  {schedule.map((r, i) => (
                    <tr key={r.id ?? i}>
                      <td className="py-1.5 pr-3 text-gray-700 dark:text-gray-300">{r.due_date ? thaiDate(r.due_date) : `${r.month}/${r.year}`}</td>
                      <td className="py-1.5 px-3 text-right tabular-nums text-gray-900 dark:text-gray-100">{money(r.installment_amount)}</td>
                      <td className="py-1.5 px-3 text-right tabular-nums text-gray-600 dark:text-gray-300">{money(r.remaining_balance)}</td>
                      <td className="py-1.5 pl-3 text-right text-xs">
                        {r.paid ? <span className="text-emerald-700 dark:text-emerald-300">ชำระแล้ว</span> : <span className="text-gray-500 dark:text-gray-400">รอชำระ</span>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </article>
  )
}

// ─── หน้า ────────────────────────────────────────────────────────────────────

export default function LoanRequest() {
  const uid = useId()
  const [tab, setTab] = useState("form")

  const [elig, setElig] = useState(null)
  const [eligLoading, setEligLoading] = useState(true)
  const [eligErr, setEligErr] = useState("")
  const [myId, setMyId] = useState(null)

  const [form, setForm] = useState(EMPTY_FORM)
  const [errors, setErrors] = useState({})
  const [submitting, setSubmitting] = useState(false)
  const [formError, setFormError] = useState("")
  const [result, setResult] = useState(null) // response ของ POST

  const [preview, setPreview] = useState(null)
  const [previewLoading, setPreviewLoading] = useState(false)
  const [previewErr, setPreviewErr] = useState("")

  const [history, setHistory] = useState([])
  const [loadingHistory, setLoadingHistory] = useState(false)
  const [historyError, setHistoryError] = useState("")

  const loadElig = useCallback(() => {
    setEligLoading(true)
    setEligErr("")
    apiAuth("/personnel/me/loans/eligibility")
      .then(setElig)
      .catch((e) => setEligErr(apiDetail(e) || "ลองใหม่อีกครั้ง"))
      .finally(() => setEligLoading(false))
  }, [])

  useEffect(() => {
    loadElig()
    apiAuth("/personnel/me").then((p) => setMyId(p?.id ?? p?.user_id ?? null)).catch(() => {})
  }, [loadElig])

  const fetchHistory = useCallback(() => {
    setLoadingHistory(true)
    setHistoryError("")
    apiAuth("/personnel/me/loans")
      .then((d) => setHistory(asList(d)))
      .catch((e) => setHistoryError(apiDetail(e) || "โหลดประวัติไม่สำเร็จ"))
      .finally(() => setLoadingHistory(false))
  }, [])

  useEffect(() => { if (tab === "history") fetchHistory() }, [tab, fetchHistory])

  const setField = (k, v) => setForm((f) => ({ ...f, [k]: v }))

  // ── live preview (debounce) ──
  const amount = num(form.amount)
  const months = form.term_mode === "months" ? num(form.repayment_months) : null
  const principal = form.term_mode === "principal" ? num(form.monthly_principal) : null
  const previewReady = amount > 0 && (months > 0 || principal > 0)
  const previewQuery = useMemo(() => {
    if (!previewReady) return ""
    const q = new URLSearchParams({ amount: String(amount) })
    if (months > 0) q.set("repayment_months", String(Math.round(months)))
    if (principal > 0) q.set("monthly_principal", String(principal))
    return q.toString()
  }, [previewReady, amount, months, principal])

  useEffect(() => {
    if (!previewQuery) { setPreview(null); setPreviewErr(""); return }
    let alive = true
    setPreviewLoading(true)
    const t = setTimeout(() => {
      apiAuth(`/personnel/me/loans/preview?${previewQuery}`)
        .then((d) => { if (alive) { setPreview(d); setPreviewErr("") } })
        .catch((e) => { if (alive) { setPreview(null); setPreviewErr(apiDetail(e) || "คำนวณค่างวดไม่สำเร็จ") } })
        .finally(() => { if (alive) setPreviewLoading(false) })
    }, PREVIEW_DELAY)
    return () => { alive = false; clearTimeout(t) }
  }, [previewQuery])

  const maxAmount = elig?.max_amount != null ? Number(elig.max_amount) : null

  const validate = () => {
    const e = {}
    if (!form.purpose_code) e.purpose_code = "เลือกวัตถุประสงค์"
    if (!(amount > 0)) e.amount = "กรอกจำนวนเงินที่ขอกู้"
    else if (maxAmount != null && Number.isFinite(maxAmount) && amount > maxAmount) e.amount = `เกินวงเงินที่กู้ได้ (${money(maxAmount)} บาท)`
    if (form.term_mode === "months") {
      if (!(months > 0) || !Number.isInteger(months)) e.repayment_months = "กรอกจำนวนงวดเป็นจำนวนเต็ม"
      else if (months > MAX_MONTHS) e.repayment_months = `ผ่อนได้ไม่เกิน ${MAX_MONTHS} งวด`
    } else if (!(principal > 0)) e.monthly_principal = "กรอกต้นเงินต่องวด"
    const ext = num(form.external_deductions)
    if (ext != null && !(ext >= 0)) e.external_deductions = "กรอกเป็นจำนวนเงิน (0 ขึ้นไป)"
    const g1 = form.guarantor_1_id.trim()
    const g2 = form.guarantor_2_id.trim()
    if (!g1) e.guarantor_1_id = "ต้องมีผู้ค้ำประกันคนที่ 1"
    else if (!/^\d+$/.test(g1)) e.guarantor_1_id = "กรอกรหัสเจ้าหน้าที่เป็นตัวเลข"
    if (!g2) e.guarantor_2_id = "ต้องมีผู้ค้ำประกันคนที่ 2"
    else if (!/^\d+$/.test(g2)) e.guarantor_2_id = "กรอกรหัสเจ้าหน้าที่เป็นตัวเลข"
    else if (g1 && g1 === g2) e.guarantor_2_id = "ผู้ค้ำประกันต้องเป็นคนละคนกัน"
    if (myId != null) {
      if (String(myId) === g1) e.guarantor_1_id = "ค้ำประกันตัวเองไม่ได้"
      if (String(myId) === g2) e.guarantor_2_id = "ค้ำประกันตัวเองไม่ได้"
    }
    setErrors(e)
    if (Object.keys(e).length) {
      const first = ["purpose_code", "amount", "repayment_months", "monthly_principal", "external_deductions", "guarantor_1_id", "guarantor_2_id"].find((k) => e[k])
      document.getElementById(`${uid}-${first}`)?.focus()
      return false
    }
    return true
  }

  const handleSubmit = async (ev) => {
    ev.preventDefault()
    setFormError("")
    if (!validate()) return
    setSubmitting(true)
    try {
      const ext = num(form.external_deductions)
      const res = await apiAuth("/personnel/me/loans", {
        method: "POST",
        body: {
          purpose: form.purpose.trim() || LOAN_PURPOSE_LABEL[form.purpose_code],
          purpose_code: form.purpose_code,
          amount: amount.toFixed(2),
          ...(form.term_mode === "months"
            ? { repayment_months: months }
            : { monthly_principal: principal.toFixed(2), ...(preview?.instalments ? { repayment_months: preview.instalments } : {}) }),
          ...(ext != null && ext > 0 ? { external_deductions: ext.toFixed(2) } : {}),
          guarantor_1_id: Number(form.guarantor_1_id),
          guarantor_2_id: Number(form.guarantor_2_id),
        },
      })
      setResult(res || {})
    } catch (err) {
      const detail = apiDetail(err)
      setFormError(detail || (err.status === 409 ? "คุณมีคำขอกู้ที่ยังรอพิจารณาอยู่แล้ว" : "ยื่นคำขอไม่สำเร็จ ลองใหม่อีกครั้ง"))
      window.scrollTo({ top: 0, behavior: "smooth" })
    } finally {
      setSubmitting(false)
    }
  }

  const resetForm = () => {
    setForm(EMPTY_FORM)
    setErrors({})
    setFormError("")
    setResult(null)
    setPreview(null)
  }

  const fieldProps = (k) => ({
    id: `${uid}-${k}`,
    "aria-invalid": !!errors[k] || undefined,
    "aria-describedby": errors[k] ? `${uid}-${k}-err` : undefined,
  })
  const errMsg = (field) => (errors[field] ? <p id={`${uid}-${field}-err`} className={errorTextCls}>{errors[field]}</p> : null)
  const req = <span className="text-red-600 dark:text-red-400"> *</span>

  if (result) {
    const warns = warningList(result)
    return (
      <div className="mx-auto mt-6 max-w-lg space-y-4 pb-10">
        <div className={cx(cardCls, "space-y-5 p-6")}>
          <div className="text-center">
            <div className="mx-auto flex size-14 items-center justify-center rounded-full bg-emerald-100 dark:bg-emerald-500/15">
              <svg aria-hidden="true" className="size-7 text-emerald-700 dark:text-emerald-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <h1 className="mt-3 text-lg font-bold text-gray-900 dark:text-gray-100">ยื่นคำขอกู้แล้ว</h1>
            <p className="mt-1 text-sm text-gray-600 dark:text-gray-300">
              สถานะ: <strong>{result.status_label || loanStatusLabel({ status: result.loan_status ?? result.status })}</strong>
            </p>
          </div>
          <dl className="grid grid-cols-2 gap-x-4 gap-y-3">
            <Stat label="จำนวนงวด">{result.repayment_months ?? "—"}</Stat>
            <Stat label="ต้นเงินต่องวด">{money(result.monthly_principal)}</Stat>
            <Stat label="งวดแรก (ประมาณ)">{thaiDate(result.first_due_date, { long: true })}</Stat>
            <Stat label="งวดสุดท้าย (ประมาณ)">{thaiDate(result.last_due_date, { long: true })}</Stat>
            <Stat label="ดอกเบี้ยรวมโดยประมาณ">{money(result.total_interest_estimate)}</Stat>
          </dl>
          <Warnings items={warns} />
          <div className="grid grid-cols-2 gap-3">
            <button type="button" onClick={resetForm} className={neutralBtnCls}>ยื่นคำขอใหม่</button>
            <button type="button" onClick={() => { resetForm(); setTab("history") }} className={primaryBtnCls}>ติดตามสถานะ</button>
          </div>
        </div>
      </div>
    )
  }

  const tabs = [{ value: "form", label: "ยื่นคำขอ" }, { value: "history", label: "ประวัติคำขอ" }]

  return (
    <div className="mx-auto max-w-2xl space-y-5 pb-10">
      <PageTitle title="ขอกู้เงินกองทุนสงเคราะห์" />

      <Tabs items={tabs} value={tab} onChange={setTab} ariaLabel="ขอกู้เงิน" idBase={ID_BASE} />

      <div role="tabpanel" id={panelId(ID_BASE, tab)} aria-labelledby={tabId(ID_BASE, tab)} tabIndex={0} className="space-y-5 rounded-2xl focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500/40">
        {tab === "form" && (
          <>
            <div data-tour="loan">
              <EligibilityCard data={elig} loading={eligLoading} error={eligErr} onRetry={loadElig} />
            </div>

            {formError && <ErrorState message={formError} />}

            <form onSubmit={handleSubmit} noValidate className="space-y-4">
              <section aria-labelledby={`${uid}-purpose-h`} className={cx(cardCls, "space-y-3 p-5")}>
                <h2 id={`${uid}-purpose-h`} className="text-base font-semibold text-gray-900 dark:text-gray-100">วัตถุประสงค์</h2>
                <div>
                  <label htmlFor={`${uid}-purpose_code`} className={labelCls}>ประเภทการกู้{req}</label>
                  <select {...fieldProps("purpose_code")} value={form.purpose_code} onChange={(e) => setField("purpose_code", e.target.value)}
                    className={cx(fieldCls, errors.purpose_code && errBorder)}>
                    <option value="">เลือกวัตถุประสงค์</option>
                    {LOAN_PURPOSE_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                  </select>
                  {errMsg("purpose_code")}
                </div>
                <div>
                  <label htmlFor={`${uid}-purpose`} className={labelCls}>รายละเอียดเพิ่มเติม</label>
                  <textarea id={`${uid}-purpose`} rows={2} value={form.purpose} onChange={(e) => setField("purpose", e.target.value)}
                    className={cx(fieldCls, "resize-none")} placeholder="อธิบายเหตุผลการกู้โดยย่อ" />
                </div>
              </section>

              <section aria-labelledby={`${uid}-amount-h`} className={cx(cardCls, "space-y-4 p-5")}>
                <h2 id={`${uid}-amount-h`} className="text-base font-semibold text-gray-900 dark:text-gray-100">วงเงินและการผ่อนชำระ</h2>
                <div>
                  <label htmlFor={`${uid}-amount`} className={labelCls}>จำนวนเงินที่ขอกู้ (บาท){req}</label>
                  <input {...fieldProps("amount")} type="text" inputMode="decimal" value={form.amount}
                    onChange={(e) => setField("amount", e.target.value)} placeholder="0"
                    className={cx(fieldCls, "tabular-nums", errors.amount && errBorder)} />
                  {errors.amount ? errMsg("amount") : maxAmount != null && <p className={helpTextCls}>กู้ได้ไม่เกิน {money(maxAmount)} บาท</p>}
                </div>

                <fieldset className="space-y-2">
                  <legend className={labelCls}>กำหนดการผ่อนด้วย</legend>
                  <div role="radiogroup" aria-label="กำหนดการผ่อนด้วย" className={segmentedCls}>
                    {[["months", "จำนวนงวด"], ["principal", "ต้นเงินต่องวด"]].map(([v, l]) => (
                      <button key={v} type="button" role="radio" aria-checked={form.term_mode === v} onClick={() => setField("term_mode", v)}
                        className={cx(segmentedItemCls, form.term_mode === v && segmentedItemActiveCls)}>
                        {l}
                      </button>
                    ))}
                  </div>
                  {form.term_mode === "months" ? (
                    <div>
                      <label htmlFor={`${uid}-repayment_months`} className="sr-only">จำนวนงวด (เดือน)</label>
                      <input {...fieldProps("repayment_months")} type="text" inputMode="numeric" value={form.repayment_months}
                        onChange={(e) => setField("repayment_months", e.target.value)} placeholder={`จำนวนงวด (ไม่เกิน ${MAX_MONTHS})`}
                        className={cx(fieldCls, "tabular-nums", errors.repayment_months && errBorder)} />
                      {errMsg("repayment_months")}
                    </div>
                  ) : (
                    <div>
                      <label htmlFor={`${uid}-monthly_principal`} className="sr-only">ต้นเงินต่องวด (บาท)</label>
                      <input {...fieldProps("monthly_principal")} type="text" inputMode="decimal" value={form.monthly_principal}
                        onChange={(e) => setField("monthly_principal", e.target.value)} placeholder="ต้นเงินต่องวด เช่น 15000"
                        className={cx(fieldCls, "tabular-nums", errors.monthly_principal && errBorder)} />
                      {errors.monthly_principal ? errMsg("monthly_principal") : <p className={helpTextCls}>จำนวนงวดคำนวณจากยอดนี้</p>}
                    </div>
                  )}
                </fieldset>

                <div>
                  <label htmlFor={`${uid}-external_deductions`} className={labelCls}>ผ่อนชำระหนี้ที่อื่นต่อเดือน (บาท)</label>
                  <input {...fieldProps("external_deductions")} type="text" inputMode="decimal" value={form.external_deductions}
                    onChange={(e) => setField("external_deductions", e.target.value)} placeholder="0"
                    className={cx(fieldCls, "tabular-nums", errors.external_deductions && errBorder)} />
                  {errors.external_deductions ? errMsg("external_deductions") : (
                    <p className={helpTextCls}>เช่น ธนาคาร ชมรม สหกรณ์ — ใช้ตรวจว่าเงินเดือนเหลือรับไม่น้อยกว่า 2,000 บาท</p>
                  )}
                </div>

                <PreviewPanel preview={preview} loading={previewLoading} error={previewErr} ready={previewReady} />
              </section>

              <section aria-labelledby={`${uid}-guar-h`} className={cx(cardCls, "space-y-3 p-5")}>
                <h2 id={`${uid}-guar-h`} className="text-base font-semibold text-gray-900 dark:text-gray-100">ผู้ค้ำประกัน</h2>
                <p className="text-sm leading-relaxed text-gray-600 dark:text-gray-300">
                  เจ้าหน้าที่ 2 คน คนละคนกัน ไม่ใช่ตัวผู้กู้และไม่ใช่คู่สมรสของผู้กู้
                </p>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  {[1, 2].map((n) => (
                    <div key={n}>
                      <label htmlFor={`${uid}-guarantor_${n}_id`} className={labelCls}>ผู้ค้ำประกันคนที่ {n}{req}</label>
                      <input {...fieldProps(`guarantor_${n}_id`)} type="text" inputMode="numeric" value={form[`guarantor_${n}_id`]}
                        onChange={(e) => setField(`guarantor_${n}_id`, e.target.value)} placeholder="รหัสเจ้าหน้าที่"
                        className={cx(fieldCls, "tabular-nums", errors[`guarantor_${n}_id`] && errBorder)} />
                      {errMsg(`guarantor_${n}_id`)}
                    </div>
                  ))}
                </div>
              </section>

              <button type="submit" disabled={submitting} className={cx(primaryBtnCls, "w-full !h-12")}>
                {submitting ? "กำลังยื่นคำขอ…" : "ยื่นคำขอกู้"}
              </button>
            </form>
          </>
        )}

        {tab === "history" && (
          <>
            {historyError && <ErrorState message={historyError} onRetry={fetchHistory} />}
            {loadingHistory ? (
              <div className="space-y-3">{[0, 1, 2].map((i) => <Skeleton key={i} className="h-32" rounded="rounded-2xl" />)}</div>
            ) : !historyError && history.length === 0 ? (
              <div className={cardCls}>
                <EmptyState title="ยังไม่เคยยื่นคำขอกู้" description="คำขอที่ยื่นแล้วจะแสดงที่นี่พร้อมสถานะการพิจารณา" />
              </div>
            ) : (
              <div className="space-y-3">{history.map((l) => <HistoryCard key={l.id} loan={l} />)}</div>
            )}
          </>
        )}
      </div>
    </div>
  )
}
