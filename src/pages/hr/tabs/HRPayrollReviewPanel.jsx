// src/pages/hr/tabs/HRPayrollReviewPanel.jsx
// ─────────────────────────────────────────────────────────────────────────────
// ผู้จัดการ: งวดเงินเดือนที่รออนุมัติ (ตรวจสอบ) + งวดที่อนุมัติแล้วแต่ยังไม่ปิด (ส่งกลับได้)
//   GET  /hr/payroll/periods?year=YYYY (ค.ศ.)
//   POST /hr/payroll/periods/{y}/{m}/approve      ตรวจสอบ → อนุมัติ
//   POST /hr/payroll/periods/{y}/{m}/return        ตรวจสอบ/อนุมัติ → ร่าง (ReturnPeriodSheet)
//   ขั้นผิด → 409 + detail ไทย — แสดงตามที่ backend ส่งมา
// ─────────────────────────────────────────────────────────────────────────────
import { useCallback, useEffect, useState } from "react"
import { apiAuth } from "../../../lib/api"
import { useCan } from "../../../lib/permissions"
import { fmtDateTime, fmtPayMonth, money, periodList } from "../../../lib/payroll"
import { cx, neutralBtnCls, primaryBtnCls } from "../../../lib/styles"
import SelectDropdown from "../../../components/SelectDropdown"
import { Badge, ConfirmDialog, EmptyState, ErrorState, SkeletonCard, toast } from "../../../components/ui"
import ReturnPeriodSheet from "../../../components/hr/ReturnPeriodSheet"

const THIS_YEAR = new Date().getFullYear()
const YEAR_OPTIONS = [THIS_YEAR, THIS_YEAR - 1].map((y) => ({ value: String(y), label: `ปี ${y + 543}` }))

function PeriodRow({ p, canApprove, onApprove, onReturn, onOpen }) {
  const review = p.status === "review"
  return (
    <li className="flex flex-col gap-3 px-4 py-3.5 md:flex-row md:items-center md:gap-6">
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <p className="font-semibold text-gray-900 dark:text-gray-100">{fmtPayMonth(p.year, p.month, { long: true })}</p>
          <Badge tone={review ? "pending" : "info"}>{p.status_label || (review ? "ตรวจสอบ" : "อนุมัติ")}</Badge>
        </div>
        <p className="mt-0.5 text-xs text-gray-500 dark:text-gray-400">
          {review ? `ส่งตรวจสอบ ${fmtDateTime(p.submitted_at)}` : `อนุมัติ ${fmtDateTime(p.approved_at)} · รอฝ่ายบุคคลปิดงวด`}
        </p>
      </div>
      <dl className="flex gap-6 text-sm md:text-right">
        <div>
          <dt className="text-xs text-gray-500 dark:text-gray-400">จำนวนคน</dt>
          <dd className="tabular-nums text-gray-900 dark:text-gray-100">{p.payouts ?? "—"}</dd>
        </div>
        <div>
          <dt className="text-xs text-gray-500 dark:text-gray-400">ยอดจ่ายสุทธิรวม</dt>
          <dd className="font-semibold tabular-nums text-gray-900 dark:text-gray-100">{money(p.total_net)}</dd>
        </div>
      </dl>
      <div className="grid grid-cols-2 gap-2 md:flex md:shrink-0">
        <button type="button" onClick={() => onOpen(p)} className={cx(neutralBtnCls, "col-span-2 md:col-span-1")}>ดูรายการ</button>
        {canApprove && (
          <>
            <button type="button" onClick={() => onReturn(p)} className={neutralBtnCls}>ส่งกลับแก้ไข</button>
            {review ? (
              <button type="button" onClick={() => onApprove(p)} className={primaryBtnCls}>อนุมัติ</button>
            ) : <span className="hidden" />}
          </>
        )}
      </div>
    </li>
  )
}

/** onOpenMonth(year, month) → สลับไปแท็บ "งวดประจำเดือน" ของเดือนนั้น */
export default function HRPayrollReviewPanel({ onOpenMonth, onCountChange }) {
  const { can } = useCan()
  const canApprove = can("hr.payroll.period.approve")
  const [year, setYear] = useState(String(THIS_YEAR))
  const [periods, setPeriods] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [approving, setApproving] = useState(null)
  const [approveBusy, setApproveBusy] = useState(false)
  const [approveErr, setApproveErr] = useState("")
  const [returning, setReturning] = useState(null)

  const load = useCallback(() => {
    setLoading(true)
    setError("")
    apiAuth(`/hr/payroll/periods?year=${year}`)
      .then((d) => setPeriods(periodList(d)))
      .catch((e) => setError(e.message || "โหลดงวดเงินเดือนไม่สำเร็จ"))
      .finally(() => setLoading(false))
  }, [year])

  useEffect(() => { load() }, [load])

  const review = periods.filter((p) => p.status === "review")
  const approved = periods.filter((p) => p.status === "approved")

  useEffect(() => {
    if (String(THIS_YEAR) === year) onCountChange?.(review.length)
  }, [review.length, year, onCountChange])

  const approve = async () => {
    const p = approving
    setApproveBusy(true)
    setApproveErr("")
    try {
      await apiAuth(`/hr/payroll/periods/${p.year}/${p.month}/approve`, { method: "POST" })
      toast.success("อนุมัติงวดเงินเดือนแล้ว", { description: `${fmtPayMonth(p.year, p.month, { long: true })} — พนักงานเห็นสลิปของเดือนนี้แล้ว` })
      setApproving(null)
      load()
    } catch (err) {
      setApproveErr(err.message || "อนุมัติไม่สำเร็จ")
    } finally {
      setApproveBusy(false)
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-gray-600 dark:text-gray-400">
          ตรวจยอดแต่ละงวดก่อนอนุมัติ — เมื่ออนุมัติแล้วพนักงานจะเห็นและดาวน์โหลดสลิปของเดือนนั้นได้
        </p>
        <div className="w-36">
          <SelectDropdown value={year} onChange={setYear} options={YEAR_OPTIONS} placeholder="เลือกปี" />
        </div>
      </div>

      {error ? (
        <ErrorState message={error} onRetry={load} />
      ) : loading ? (
        <div className="space-y-3"><SkeletonCard /><SkeletonCard /></div>
      ) : (
        <>
          <section aria-labelledby="payroll-review-h" className="rounded-2xl bg-white ring-1 ring-gray-200/70 shadow-sm dark:bg-surface dark:ring-line dark:shadow-none">
            <h3 id="payroll-review-h" className="border-b border-gray-100 px-4 py-3 text-sm font-semibold text-gray-900 dark:border-line dark:text-gray-100">
              รออนุมัติ <span className="font-normal tabular-nums text-gray-500 dark:text-gray-400">({review.length})</span>
            </h3>
            {review.length === 0 ? (
              <EmptyState title="ไม่มีงวดที่รออนุมัติ" description={`ปี ${Number(year) + 543} ไม่มีงวดเงินเดือนที่ฝ่ายบุคคลส่งตรวจสอบ`} className="!py-10" />
            ) : (
              <ul className="divide-y divide-gray-100 dark:divide-line">
                {review.map((p) => (
                  <PeriodRow key={`${p.year}-${p.month}`} p={p} canApprove={canApprove}
                    onApprove={(x) => { setApproveErr(""); setApproving(x) }} onReturn={setReturning}
                    onOpen={(x) => onOpenMonth(x.year, x.month)} />
                ))}
              </ul>
            )}
          </section>

          {approved.length > 0 && (
            <section aria-labelledby="payroll-approved-h" className="rounded-2xl bg-white ring-1 ring-gray-200/70 shadow-sm dark:bg-surface dark:ring-line dark:shadow-none">
              <h3 id="payroll-approved-h" className="border-b border-gray-100 px-4 py-3 text-sm font-semibold text-gray-900 dark:border-line dark:text-gray-100">
                อนุมัติแล้ว รอปิดงวด <span className="font-normal tabular-nums text-gray-500 dark:text-gray-400">({approved.length})</span>
              </h3>
              <ul className="divide-y divide-gray-100 dark:divide-line">
                {approved.map((p) => (
                  <PeriodRow key={`${p.year}-${p.month}`} p={p} canApprove={canApprove}
                    onApprove={() => {}} onReturn={setReturning} onOpen={(x) => onOpenMonth(x.year, x.month)} />
                ))}
              </ul>
            </section>
          )}
        </>
      )}

      <ConfirmDialog
        open={!!approving}
        title={approving ? `อนุมัติงวด ${fmtPayMonth(approving.year, approving.month, { long: true })}` : "อนุมัติงวด"}
        description="เมื่ออนุมัติ พนักงานจะเห็นสลิปของเดือนนี้ทันที และฝ่ายบุคคลจะแก้ไขเงินเดือนไม่ได้จนกว่าจะส่งกลับ"
        confirmLabel="อนุมัติ"
        loading={approveBusy}
        loadingLabel="กำลังอนุมัติ…"
        error={approveErr}
        onConfirm={approve}
        onCancel={() => setApproving(null)}
      >
        {approving && (
          <dl className="grid grid-cols-2 gap-3 rounded-xl bg-gray-50 p-3 text-sm dark:bg-white/[.03]">
            <div><dt className="text-xs text-gray-500 dark:text-gray-400">จำนวนคน</dt><dd className="tabular-nums text-gray-900 dark:text-gray-100">{approving.payouts ?? "—"}</dd></div>
            <div><dt className="text-xs text-gray-500 dark:text-gray-400">ยอดจ่ายสุทธิรวม</dt><dd className="font-semibold tabular-nums text-gray-900 dark:text-gray-100">{money(approving.total_net)}</dd></div>
          </dl>
        )}
      </ConfirmDialog>

      <ReturnPeriodSheet period={returning} onClose={() => setReturning(null)} onDone={load} />
    </div>
  )
}
