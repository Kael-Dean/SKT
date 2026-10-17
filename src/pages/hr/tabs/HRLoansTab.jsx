// src/pages/hr/tabs/HRLoansTab.jsx
// ─────────────────────────────────────────────────────────────────────────────
// สินเชื่อเงินกองทุนสงเคราะห์เจ้าหน้าที่ (3K, backend PR #30) — แท็บ "สินเชื่อ" ใน /hr/dashboard
//
//   รอพิจารณา   GET /hr/loans/queue    (hr.loans.queue — หัวหน้า 110–124, ผช.ผจก., 101, 105)
//   ทั้งหมด     GET /hr/loans          (hr.loans.list — loan.view = 101 เท่านั้น)
//   ค้างชำระ    GET /hr/loans/overdue?as_of=  (hr.loans.overdue)
//   แถบเครื่องมือ: ตั้งค่ากองทุน (hr.loans.settings) · ทะเบียนคุมเงินกองทุน PDF (hr.loans.fundLedger, ปี พ.ศ.)
//
// ปุ่มพิจารณาของแต่ละแถวมาจาก stageActions() ตามสถานะ (lib/loans.js) · ข้อความสถานะ = status_label
// ─────────────────────────────────────────────────────────────────────────────
import { useCallback, useEffect, useId, useMemo, useState } from "react"
import { useSearchParams } from "react-router-dom"
import { RotateCw, Settings2 } from "lucide-react"
import { apiAuth } from "../../../lib/api"
import { apiDetail } from "../../../lib/apiErrors"
import { cx, baseField, cardCls, labelCls, neutralBtnCls, primaryBtnCls, iconBtnCls } from "../../../lib/styles"
import { Badge, DataList, EmptyState, ErrorState, SkeletonTableRows, Tabs, panelId, tabId } from "../../../components/ui"
import ThaiDateField from "../../../components/ThaiDateField"
import { useCan } from "../../../lib/permissions"
import { useIsPhone } from "../../../hooks/useMediaQuery"
import {
  LOAN_PURPOSE_LABEL, asList, borrowerName, loanStatusLabel, loanStatusTone, money, stageActions, thaiDate, todayIso,
} from "../../../lib/loans"
import { LoanDecisionSheet, LoanDetailSheet, LoanPdfButton, LoanSettingsSheet } from "./HRLoanSheets"

const ID_BASE = "hr-loans"
const fieldCls = cx(baseField, "!rounded-xl !px-3 !py-2 md:!text-sm")
const smallBtn = "!h-9 !px-3 !text-xs md:!text-sm"

const STATUS_FILTERS = [
  { value: "", label: "ทุกสถานะ" },
  { value: "pending", label: "รอผู้บังคับบัญชา" },
  { value: "supervisor_endorsed", label: "รอผู้จัดการ" },
  { value: "manager_forwarded", label: "รอคณะทำงานฯ" },
  { value: "active", label: "กำลังผ่อน" },
  { value: "closed", label: "ปิดบัญชี" },
  { value: "rejected", label: "ไม่อนุมัติ" },
]

const errText = (err, fallback) => apiDetail(err) || fallback

// ─── ตารางสัญญา (desktop table / phone DataList) ─────────────────────────────

function LoanList({ loans, loading, error, onRetry, onOpen, onAction, fromQueue, empty }) {
  const isPhone = useIsPhone()
  if (error) return <ErrorState message={error} onRetry={onRetry} />

  const actionsFor = (l) => {
    const acts = stageActions(l, { fromQueue })
    if (!acts.length) return null
    return (
      <div className="flex flex-wrap justify-end gap-2">
        {acts.map((a) => (
          <button key={a.mode} type="button" onClick={(e) => { e.stopPropagation(); onAction(l, a.mode) }}
            className={cx(a.danger ? neutralBtnCls : primaryBtnCls, smallBtn)}>
            {a.label}
          </button>
        ))}
      </div>
    )
  }

  if (isPhone) {
    return (
      <DataList
        items={loans}
        loading={loading}
        title={(l) => borrowerName(l)}
        subtitle={(l) => `#${l.id} · ${LOAN_PURPOSE_LABEL[l.purpose_code] ?? l.purpose_code ?? "เงินกู้กองทุนฯ"} · ยื่น ${thaiDate(l.created_at)}`}
        badge={(l) => <Badge tone={loanStatusTone(l)}>{loanStatusLabel(l)}</Badge>}
        fields={[
          { label: "วงเงิน", value: (l) => money(l.loan_amount ?? l.amount), align: "right", emphasis: true },
          { label: "งวด", value: (l) => (l.repayment_months != null ? `${l.repayment_months} งวด` : "—"), align: "right" },
        ]}
        onClick={onOpen}
        actions={actionsFor}
        emptyState={empty}
      />
    )
  }

  const th = "px-4 py-3 text-xs font-semibold text-gray-500 dark:text-gray-400"
  return (
    <div className={cx(cardCls, "overflow-x-auto")}>
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-gray-100 bg-gray-50 dark:border-line dark:bg-white/[.03]">
            <th scope="col" className={cx(th, "text-left")}>ผู้กู้ / วัตถุประสงค์</th>
            <th scope="col" className={cx(th, "text-right")}>วงเงิน</th>
            <th scope="col" className={cx(th, "text-right")}>งวด</th>
            <th scope="col" className={cx(th, "text-right")}>ต้นเงิน/งวด</th>
            <th scope="col" className={cx(th, "text-left")}>ยื่นเมื่อ</th>
            <th scope="col" className={cx(th, "text-left")}>สถานะ</th>
            <th scope="col" className={th}><span className="sr-only">การพิจารณา</span></th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100 dark:divide-line">
          {loading ? (
            <SkeletonTableRows rows={4} cols={7} />
          ) : loans.length === 0 ? (
            <tr><td colSpan={7} className="p-0">{empty}</td></tr>
          ) : loans.map((l) => (
            <tr key={l.id} className="transition-colors duration-150 hover:bg-gray-50 dark:hover:bg-white/[.03]">
              <td className="px-4 py-2.5">
                <button type="button" onClick={() => onOpen(l)}
                  className="cursor-pointer rounded text-left font-medium text-gray-900 hover:text-indigo-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 dark:text-gray-100 dark:hover:text-indigo-300">
                  {borrowerName(l)}
                </button>
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  #{l.id} · {LOAN_PURPOSE_LABEL[l.purpose_code] ?? l.purpose_code ?? "เงินกู้กองทุนฯ"}
                </p>
              </td>
              <td className="px-4 py-2.5 text-right font-semibold tabular-nums text-gray-900 dark:text-gray-100">{money(l.loan_amount ?? l.amount)}</td>
              <td className="px-4 py-2.5 text-right tabular-nums text-gray-700 dark:text-gray-300">{l.repayment_months ?? "—"}</td>
              <td className="px-4 py-2.5 text-right tabular-nums text-gray-700 dark:text-gray-300">{money(l.monthly_principal)}</td>
              <td className="px-4 py-2.5 whitespace-nowrap text-gray-700 dark:text-gray-300">{thaiDate(l.created_at)}</td>
              <td className="px-4 py-2.5"><Badge tone={loanStatusTone(l)}>{loanStatusLabel(l)}</Badge></td>
              <td className="px-4 py-2.5">{actionsFor(l)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

// ─── งวดค้างชำระ ─────────────────────────────────────────────────────────────

function OverduePanel({ onOpenLoan }) {
  const uid = useId()
  const isPhone = useIsPhone()
  const [asOf, setAsOf] = useState(todayIso())
  const [rows, setRows] = useState([])
  const [summary, setSummary] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")

  const load = useCallback(async (d) => {
    setLoading(true)
    setError("")
    try {
      const res = await apiAuth(`/hr/loans/overdue?as_of=${encodeURIComponent(d)}`)
      setRows(asList(res, "rows", "items", "instalments", "overdue"))
      setSummary(Array.isArray(res) ? null : res)
    } catch (err) {
      setError(errText(err, "โหลดงวดค้างชำระไม่สำเร็จ"))
    } finally {
      setLoading(false)
    }
  }, [])
  useEffect(() => { if (asOf) load(asOf) }, [asOf, load])

  const totalPenalty = rows.reduce((s, r) => s + (Number(r.penalty) || 0), 0)
  const totalDue = rows.reduce((s, r) => s + (Number(r.installment_amount ?? r.amount) || 0), 0)
  const empty = <EmptyState title="ไม่มีงวดค้างชำระ" description={`ทุกงวดที่ถึงกำหนดก่อน ${thaiDate(asOf, { long: true })} ชำระแล้ว`} />
  // แถวค้างชำระคือ "งวด" ไม่ใช่สัญญา — เปิดสัญญาด้วย loan_id (ตารางผ่อนโหลดเพิ่มใน sheet)
  const openLoan = (r) => r.loan_id != null && onOpenLoan({
    id: r.loan_id, status: r.loan_status ?? "active",
    user_display_name: r.user_display_name, borrower_name: r.borrower_name,
    user_first_name: r.user_first_name, user_last_name: r.user_last_name,
  })

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end gap-3">
        <div className="w-56">
          <label htmlFor={`${uid}-asof`} className={labelCls}>ณ วันที่</label>
          <ThaiDateField id={`${uid}-asof`} value={asOf} onChange={(e) => setAsOf(e.target.value)} className="!rounded-xl !px-3 !py-2 md:!text-sm" />
        </div>
        {!loading && rows.length > 0 && (
          <p className="pb-2 text-sm text-gray-600 dark:text-gray-300">
            ค้าง <strong className="tabular-nums text-gray-900 dark:text-gray-100">{rows.length}</strong> งวด
            · ค่างวดรวม <strong className="tabular-nums text-gray-900 dark:text-gray-100">{money(summary?.total_due ?? totalDue)}</strong>
            · เบี้ยปรับรวม <strong className="tabular-nums text-red-700 dark:text-red-300">{money(summary?.total_penalty ?? totalPenalty)}</strong> บาท
            <span className="text-gray-500 dark:text-gray-400"> (3% ต่อปี)</span>
          </p>
        )}
      </div>
      {error ? <ErrorState message={error} onRetry={() => load(asOf)} /> : isPhone ? (
        <DataList
          items={rows}
          loading={loading}
          keyOf={(r, i) => r.id ?? `${r.loan_id}-${r.due_date}-${i}`}
          title={(r) => borrowerName(r)}
          subtitle={(r) => `สัญญา #${r.loan_id ?? "—"} · ครบกำหนด ${thaiDate(r.due_date)}`}
          fields={[
            { label: "ค่างวด", value: (r) => money(r.installment_amount ?? r.amount), align: "right" },
            { label: "เบี้ยปรับ", value: (r) => money(r.penalty), align: "right", emphasis: true },
            { label: "เกินกำหนด", value: (r) => (r.days_overdue != null ? `${r.days_overdue} วัน` : "—"), align: "right" },
          ]}
          onClick={openLoan}
          emptyState={empty}
        />
      ) : (
        <div className={cx(cardCls, "overflow-x-auto")}>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50 text-xs font-semibold text-gray-500 dark:border-line dark:bg-white/[.03] dark:text-gray-400">
                <th scope="col" className="px-4 py-3 text-left">ผู้กู้</th>
                <th scope="col" className="px-4 py-3 text-left">สัญญา</th>
                <th scope="col" className="px-4 py-3 text-left">ครบกำหนด</th>
                <th scope="col" className="px-4 py-3 text-right">เกินกำหนด (วัน)</th>
                <th scope="col" className="px-4 py-3 text-right">ค่างวด</th>
                <th scope="col" className="px-4 py-3 text-right">เบี้ยปรับ</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-line">
              {loading ? <SkeletonTableRows rows={4} cols={6} /> : rows.length === 0 ? (
                <tr><td colSpan={6} className="p-0">{empty}</td></tr>
              ) : rows.map((r, i) => (
                <tr key={r.id ?? `${r.loan_id}-${r.due_date}-${i}`} className="hover:bg-gray-50 dark:hover:bg-white/[.03]">
                  <td className="px-4 py-2.5 font-medium text-gray-900 dark:text-gray-100">{borrowerName(r)}</td>
                  <td className="px-4 py-2.5">
                    {r.loan_id != null ? (
                      <button type="button" onClick={() => openLoan(r)} className="cursor-pointer rounded tabular-nums text-indigo-700 hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 dark:text-indigo-300">
                        #{r.loan_id}
                      </button>
                    ) : "—"}
                  </td>
                  <td className="px-4 py-2.5 whitespace-nowrap text-gray-700 dark:text-gray-300">{thaiDate(r.due_date)}</td>
                  <td className="px-4 py-2.5 text-right tabular-nums text-gray-700 dark:text-gray-300">{r.days_overdue ?? "—"}</td>
                  <td className="px-4 py-2.5 text-right tabular-nums text-gray-900 dark:text-gray-100">{money(r.installment_amount ?? r.amount)}</td>
                  <td className="px-4 py-2.5 text-right font-semibold tabular-nums text-red-700 dark:text-red-300">{money(r.penalty)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

// ─── แท็บหลัก ────────────────────────────────────────────────────────────────

export default function HRLoansTab() {
  const { can } = useCan()
  const uid = useId()
  const canQueue = can("hr.loans.queue")
  const canList = can("hr.loans.list")
  const canOverdue = can("hr.loans.overdue")
  const canSettings = can("hr.loans.settings")
  const canLedger = can("hr.loans.fundLedger")

  const [queue, setQueue] = useState([])
  const [queueLoading, setQueueLoading] = useState(canQueue)
  const [queueErr, setQueueErr] = useState("")
  const [all, setAll] = useState([])
  const [allLoading, setAllLoading] = useState(false)
  const [allErr, setAllErr] = useState("")
  const [allLoaded, setAllLoaded] = useState(false)
  const [statusFilter, setStatusFilter] = useState("")

  const [detail, setDetail] = useState(null)      // { loan, fromQueue }
  const [decision, setDecision] = useState(null)  // { loan, mode }
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [committeeChair, setCommitteeChair] = useState("")
  const [fiscalYear, setFiscalYear] = useState(String(new Date().getFullYear() + 543))

  const subs = useMemo(() => [
    canQueue && { value: "queue", label: "รอพิจารณา", count: queueLoading ? undefined : queue.length },
    canList && { value: "all", label: "สัญญาทั้งหมด" },
    canOverdue && { value: "overdue", label: "ค้างชำระ" },
  ].filter(Boolean), [canQueue, canList, canOverdue, queue.length, queueLoading])

  const [params, setParams] = useSearchParams()
  const raw = params.get("sub")
  const sub = subs.some((s) => s.value === raw) ? raw : subs[0]?.value
  const changeSub = (next) =>
    setParams((prev) => { const p = new URLSearchParams(prev); p.set("sub", String(next)); return p }, { replace: true })

  const loadQueue = useCallback(async () => {
    if (!canQueue) return
    setQueueLoading(true)
    setQueueErr("")
    try {
      setQueue(asList(await apiAuth("/hr/loans/queue")))
    } catch (err) {
      setQueueErr(errText(err, "โหลดรายการรอพิจารณาไม่สำเร็จ"))
    } finally {
      setQueueLoading(false)
    }
  }, [canQueue])

  const loadAll = useCallback(async () => {
    if (!canList) return
    setAllLoading(true)
    setAllErr("")
    try {
      setAll(asList(await apiAuth("/hr/loans")))
      setAllLoaded(true)
    } catch (err) {
      setAllErr(errText(err, "โหลดรายการสินเชื่อไม่สำเร็จ"))
    } finally {
      setAllLoading(false)
    }
  }, [canList])

  useEffect(() => { loadQueue() }, [loadQueue])
  useEffect(() => { if (sub === "all" && !allLoaded) loadAll() }, [sub, allLoaded, loadAll])

  // ชื่อประธานคณะทำงาน (ค่าเริ่มต้นของ finance-confirm) — โหลดเฉพาะผู้ที่บันทึกมติได้
  useEffect(() => {
    if (!canSettings || !can("hr.loans.approve.finance")) return
    let alive = true
    apiAuth("/hr/loans/settings").then((d) => { if (alive) setCommitteeChair(d?.committee_chair || "") }).catch(() => {})
    return () => { alive = false }
  }, [canSettings, can])

  const refresh = () => {
    loadQueue()
    if (allLoaded) loadAll()
  }

  const openAction = (loan, mode) => {
    setDetail(null)
    setDecision({ loan, mode })
  }

  const filteredAll = statusFilter ? all.filter((l) => l.status === statusFilter) : all
  const ledgerYearOk = /^25\d\d$/.test(fiscalYear)

  const toolbar = (canSettings || canLedger) && (
    <div className="flex flex-wrap items-end gap-2">
      {canLedger && (
        <div className="flex items-end gap-2">
          <div className="w-28">
            <label htmlFor={`${uid}-fy`} className="mb-1 block text-xs font-medium text-gray-600 dark:text-gray-300">ปีบัญชี (พ.ศ.)</label>
            <input id={`${uid}-fy`} type="text" inputMode="numeric" maxLength={4} value={fiscalYear}
              onChange={(e) => setFiscalYear(e.target.value.replace(/\D/g, ""))}
              aria-invalid={!ledgerYearOk || undefined}
              className={cx(fieldCls, "tabular-nums", !ledgerYearOk && "!border-red-500 dark:!border-red-400")} />
          </div>
          <LoanPdfButton path={`/hr/reports/loans/fund-ledger?fiscal_year=${fiscalYear}`} label="ทะเบียนคุมเงินกองทุน"
            fallbackName={`loan_fund_ledger_${fiscalYear}.pdf`} disabled={!ledgerYearOk} />
        </div>
      )}
      {canSettings && (
        <button type="button" onClick={() => setSettingsOpen(true)} className={neutralBtnCls}>
          <Settings2 aria-hidden="true" className="size-4" />
          ตั้งค่ากองทุน
        </button>
      )}
    </div>
  )

  const panel = (() => {
    if (sub === "queue") {
      return (
        <LoanList
          loans={queue} loading={queueLoading} error={queueErr} onRetry={loadQueue}
          onOpen={(l) => setDetail({ loan: l, fromQueue: true })} onAction={openAction} fromQueue
          empty={<EmptyState title="ไม่มีคำขอกู้รอคุณพิจารณา" description="คำขอที่ถึงขั้นของคุณจะแสดงที่นี่ทันทีที่ผู้กู้ยื่นหรือขั้นก่อนหน้าส่งต่อ" />}
        />
      )
    }
    if (sub === "all") {
      return (
        <div className="space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <label htmlFor={`${uid}-status`} className="sr-only">กรองตามสถานะ</label>
            <select id={`${uid}-status`} value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className={cx(fieldCls, "!w-auto")}>
              {STATUS_FILTERS.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
            </select>
            {!allLoading && allLoaded && (
              <p className="text-sm text-gray-500 dark:text-gray-400 tabular-nums">{filteredAll.length} จาก {all.length} สัญญา</p>
            )}
          </div>
          <LoanList
            loans={filteredAll} loading={allLoading} error={allErr} onRetry={loadAll}
            onOpen={(l) => setDetail({ loan: l, fromQueue: false })} onAction={openAction}
            empty={<EmptyState title={statusFilter ? "ไม่มีสัญญาในสถานะนี้" : "ยังไม่มีสัญญาเงินกู้"} description={statusFilter ? "เลือกสถานะอื่น หรือดูทุกสถานะ" : "คำขอกู้ที่เจ้าหน้าที่ยื่นจะแสดงที่นี่"} />}
          />
        </div>
      )
    }
    if (sub === "overdue") return <OverduePanel onOpenLoan={(l) => setDetail({ loan: l, fromQueue: false })} />
    return (
      <div className={cardCls}>
        <EmptyState title="ใช้ได้เฉพาะเครื่องมือด้านบน" description="บัญชีนี้ไม่มีสิทธิ์ดูรายการสัญญาหรือคิวพิจารณา" />
      </div>
    )
  })()

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="flex items-center gap-2">
          {subs.length > 1 && <Tabs items={subs} value={sub} onChange={changeSub} ariaLabel="สินเชื่อ" idBase={ID_BASE} />}
          {(sub === "queue" || sub === "all") && (
            <button type="button" onClick={refresh} aria-label="โหลดใหม่" title="โหลดใหม่" className={iconBtnCls}>
              <RotateCw aria-hidden="true" className={cx("size-4", (queueLoading || allLoading) && "animate-spin motion-reduce:animate-none")} />
            </button>
          )}
        </div>
        {toolbar}
      </div>

      {subs.length > 1 ? (
        <div role="tabpanel" id={panelId(ID_BASE, sub)} aria-labelledby={tabId(ID_BASE, sub)} tabIndex={0}
          className="rounded-2xl focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500/40">
          {panel}
        </div>
      ) : panel}

      {detail && (
        <LoanDetailSheet
          loan={detail.loan}
          fromQueue={detail.fromQueue}
          onClose={() => setDetail(null)}
          onAction={openAction}
          onChanged={refresh}
        />
      )}
      {decision && (
        <LoanDecisionSheet
          loan={decision.loan}
          mode={decision.mode}
          committeeChair={committeeChair}
          onClose={() => setDecision(null)}
          onDone={() => { setDecision(null); refresh() }}
        />
      )}
      {settingsOpen && (
        <LoanSettingsSheet
          onClose={() => setSettingsOpen(false)}
          onSaved={(d) => d?.committee_chair !== undefined && setCommitteeChair(d.committee_chair || "")}
        />
      )}
    </div>
  )
}
