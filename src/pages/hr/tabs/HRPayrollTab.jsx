// src/pages/hr/tabs/HRPayrollTab.jsx
// ─────────────────────────────────────────────────────────────────────────────
// จ่ายเงินเดือน (งวด 3 · 3C) — งวดประจำเดือน ร่าง → ตรวจสอบ → อนุมัติ → ปิดงวด
//   GET  /hr/payroll?month&year                      รายการเงินเดือนของเดือน
//   GET  /hr/payroll/periods/{y}/{m}                  สถานะงวด (404 = ยังไม่มีงวด → ถือเป็นร่าง)
//   POST /hr/payroll/generate {employee_id,month,year} · POST /hr/payroll/generate-bulk {month,year}
//   POST /hr/payroll/periods/{y}/{m}/recalculate | submit | approve | close   (+ return ใน ReturnPeriodSheet)
//   ปีเป็น ค.ศ. ทุก route · สร้าง/แก้ได้เฉพาะงวดร่าง (นอกนั้น backend ตอบ 409 — ปุ่มปิดไว้ก่อน)
//   ผู้จัดการ (hr.payroll.period.approve) มีแท็บย่อย "รออนุมัติ" (HRPayrollReviewPanel)
// ─────────────────────────────────────────────────────────────────────────────
import { useCallback, useEffect, useId, useState } from "react"
import { useSearchParams } from "react-router-dom"
import { ChevronRight, Info, RotateCcw } from "lucide-react"
import { apiAuth, apiDownload } from "../../../lib/api"
import { useCan } from "../../../lib/permissions"
import { useIsPhone } from "../../../hooks/useMediaQuery"
import {
  PERIOD_TONE, fmtDateTime, fmtPayMonth, money, netOf, periodLabel, periodList, toNum, totalDeductions,
} from "../../../lib/payroll"
import { cx, baseField, errorTextCls, labelCls, neutralBtnCls, primaryBtnCls, focusRingCls } from "../../../lib/styles"
import SelectDropdown from "../../../components/SelectDropdown"
import {
  Badge, ConfirmDialog, DataList, EmptyState, ErrorState, Sheet, Skeleton, SkeletonTableRows, Tabs, panelId, tabId, toast,
} from "../../../components/ui"
import PayPeriodStepper from "../../../components/hr/PayPeriodStepper"
import ReturnPeriodSheet from "../../../components/hr/ReturnPeriodSheet"
import StatusMsg from "../../../components/hr/StatusMsg"
import HRPayrollPayoutSheet from "./HRPayrollPayoutSheet"
import HRPayrollReviewPanel from "./HRPayrollReviewPanel"
import { keepBackState, useDrill } from "../../../lib/drill"

const PAYROLL_COLS = 5
const ID_BASE = "payroll"
const inputCls = cx(baseField, "!rounded-lg !px-3 !py-2 md:!text-sm")
const sheetBtn = "h-12 md:h-10"

const now = new Date()
const MONTH_OPTIONS = Array.from({ length: 24 }, (_, i) => {
  const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
  return {
    value: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`,
    label: fmtPayMonth(d.getFullYear(), d.getMonth() + 1),
  }
})
const splitMonth = (v) => { const [y, m] = v.split("-"); return { year: Number(y), month: Number(m) } }

/** ปุ่มขั้นงวด — ข้อความยืนยันทั้งหมดอยู่ที่นี่ที่เดียว */
const ACTIONS = {
  bulk: {
    path: () => "/hr/payroll/generate-bulk",
    body: ({ year, month }) => ({ month, year }),
    title: (l) => `สร้างเงินเดือนทั้งหมด ${l}`,
    description: "คำนวณเงินเดือนของเจ้าหน้าที่ที่ยังปฏิบัติงานทุกคนในเดือนนี้จากข้อมูลและการตั้งค่าปัจจุบัน",
    confirmLabel: "สร้างทั้งหมด", loadingLabel: "กำลังสร้าง…", success: "สร้างเงินเดือนทั้งหมดแล้ว",
  },
  recalc: {
    path: ({ year, month }) => `/hr/payroll/periods/${year}/${month}/recalculate`,
    title: (l) => `คำนวณเงินเดือน ${l} ใหม่ทั้งงวด`,
    description: "ระบบจะคำนวณทุกรายการใหม่จากข้อมูลและการตั้งค่าปัจจุบัน การปรับรายการด้วยมือในงวดนี้จะถูกเขียนทับทั้งหมด และย้อนคืนไม่ได้",
    confirmLabel: "คำนวณใหม่ทั้งงวด", loadingLabel: "กำลังคำนวณ…", tone: "danger", success: "คำนวณใหม่แล้ว",
  },
  submit: {
    path: ({ year, month }) => `/hr/payroll/periods/${year}/${month}/submit`,
    title: (l) => `ส่งงวด ${l} ให้ผู้จัดการตรวจสอบ`,
    description: "ระหว่างรอตรวจสอบจะสร้างหรือแก้ไขเงินเดือนของเดือนนี้ไม่ได้ ถ้าผู้จัดการส่งกลับ งวดจะกลับเป็นร่างพร้อมเหตุผล",
    confirmLabel: "ส่งตรวจสอบ", loadingLabel: "กำลังส่ง…", success: "ส่งตรวจสอบแล้ว",
  },
  approve: {
    path: ({ year, month }) => `/hr/payroll/periods/${year}/${month}/approve`,
    title: (l) => `อนุมัติงวด ${l}`,
    description: "เมื่ออนุมัติ พนักงานจะเห็นสลิปของเดือนนี้ทันที และฝ่ายบุคคลจะแก้ไขเงินเดือนไม่ได้จนกว่าจะส่งกลับ",
    confirmLabel: "อนุมัติ", loadingLabel: "กำลังอนุมัติ…", success: "อนุมัติงวดแล้ว",
  },
  close: {
    path: ({ year, month }) => `/hr/payroll/periods/${year}/${month}/close`,
    title: (l) => `ปิดงวด ${l}`,
    description: "ปิดงวดเป็นขั้นสุดท้าย ย้อนกลับไม่ได้ และระบบจะบันทึกค่างวดเงินกู้ของเดือนนี้เป็น \"ชำระแล้ว\"",
    confirmLabel: "ปิดงวด", loadingLabel: "กำลังปิดงวด…", tone: "danger", success: "ปิดงวดแล้ว",
  },
}

// ─── Period card ─────────────────────────────────────────────────────────────

function PeriodCard({ ym, period, loading, error, onRetry, rows, perms, onAction, onReturn, onGenerateOne }) {
  const status = period?.status ?? "draft"
  const isDraft = status === "draft"
  const label = fmtPayMonth(ym.year, ym.month, { long: true })
  const count = period?.payouts ?? rows.length
  const totalNet = period?.total_net ?? (rows.length ? rows.reduce((s, r) => s + toNum(netOf(r)), 0) : null)

  const meta = [
    period?.submitted_at && `ส่งตรวจสอบ ${fmtDateTime(period.submitted_at)}`,
    period?.approved_at && `อนุมัติ ${fmtDateTime(period.approved_at)}`,
    period?.closed_at && `ปิดงวด ${fmtDateTime(period.closed_at)}`,
  ].filter(Boolean)

  const hrBtns = []
  const mgrBtns = []
  if (isDraft) {
    if (perms.generate) hrBtns.push(<button key="one" type="button" onClick={onGenerateOne} className={neutralBtnCls}>สร้างรายคน</button>)
    if (perms.bulk) hrBtns.push(<button key="bulk" type="button" onClick={() => onAction("bulk")} className={neutralBtnCls}>สร้างทั้งหมด</button>)
    if (perms.generate && count > 0) {
      hrBtns.push(
        <button key="recalc" type="button" onClick={() => onAction("recalc")} className={neutralBtnCls}>
          <RotateCcw aria-hidden="true" className="size-4" strokeWidth={1.75} /> คำนวณใหม่
        </button>,
      )
      hrBtns.push(<button key="submit" type="button" onClick={() => onAction("submit")} className={primaryBtnCls}>ส่งตรวจสอบ</button>)
    }
  }
  if (status === "approved" && perms.generate) {
    hrBtns.push(<button key="close" type="button" onClick={() => onAction("close")} className={primaryBtnCls}>ปิดงวด</button>)
  }
  if ((status === "review" || status === "approved") && perms.approve) {
    mgrBtns.push(<button key="return" type="button" onClick={onReturn} className={neutralBtnCls}>ส่งกลับแก้ไข</button>)
    if (status === "review") mgrBtns.push(<button key="approve" type="button" onClick={() => onAction("approve")} className={primaryBtnCls}>อนุมัติ</button>)
  }
  const buttons = [...hrBtns, ...mgrBtns]

  let note = null
  if (status === "review" && !perms.approve) note = "รอผู้จัดการตรวจสอบ — ระหว่างนี้สร้างหรือแก้ไขเงินเดือนของเดือนนี้ไม่ได้"
  else if (status === "approved" && !perms.generate) note = "อนุมัติแล้ว รอฝ่ายบุคคลปิดงวด"
  else if (status === "approved") note = "อนุมัติแล้ว — พนักงานเห็นสลิปของเดือนนี้แล้ว แก้ไขไม่ได้จนกว่าผู้จัดการจะส่งกลับ"
  else if (status === "closed") note = "ปิดงวดแล้ว — ค่างวดเงินกู้ของเดือนนี้ถูกบันทึกเป็นชำระแล้ว"
  else if (isDraft && count === 0 && (perms.bulk || perms.generate)) note = "ยังไม่มีรายการ — สร้างเงินเดือนก่อน แล้วจึงส่งตรวจสอบได้"

  return (
    <section aria-labelledby="payroll-period-h" className="rounded-2xl bg-white p-4 ring-1 ring-gray-200/70 shadow-sm dark:bg-surface dark:ring-line dark:shadow-none md:p-5">
      <div className="flex flex-wrap items-start justify-between gap-x-6 gap-y-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h3 id="payroll-period-h" className="text-base font-semibold text-gray-900 dark:text-gray-100">งวด {label}</h3>
            {loading ? <Skeleton className="h-5 w-14 rounded-full" /> : <Badge tone={PERIOD_TONE[status] ?? "neutral"}>{periodLabel(period ?? { status })}</Badge>}
          </div>
          {meta.length > 0 && <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">{meta.join(" · ")}</p>}
        </div>
        <dl className="flex gap-6 text-sm sm:text-right">
          <div>
            <dt className="text-xs text-gray-500 dark:text-gray-400">จำนวนคน</dt>
            <dd className="font-medium tabular-nums text-gray-900 dark:text-gray-100">{loading ? "…" : count}</dd>
          </div>
          <div>
            <dt className="text-xs text-gray-500 dark:text-gray-400">ยอดจ่ายสุทธิรวม</dt>
            <dd className="font-semibold tabular-nums text-gray-900 dark:text-gray-100">{loading ? "…" : money(totalNet)}</dd>
          </div>
        </dl>
      </div>

      <PayPeriodStepper status={status} className="mt-4" />

      {error && <ErrorState message={error} onRetry={onRetry} className="mt-4" />}

      {isDraft && period?.returned_reason && (
        <div role="note" className="mt-4 rounded-xl bg-amber-50 px-4 py-3 text-sm text-amber-900 ring-1 ring-inset ring-amber-200 dark:bg-amber-500/10 dark:text-amber-100 dark:ring-amber-400/25">
          <p className="font-semibold">ผู้จัดการส่งกลับให้แก้ไข</p>
          <p className="mt-0.5 whitespace-pre-line">{period.returned_reason}</p>
        </div>
      )}

      {(buttons.length > 0 || note) && (
        <div className="mt-4 flex flex-col gap-3 border-t border-gray-100 pt-4 dark:border-line md:flex-row md:items-center md:justify-between">
          {note ? (
            <p className="flex items-start gap-1.5 text-sm text-gray-600 dark:text-gray-400">
              <Info aria-hidden="true" className="mt-0.5 size-4 shrink-0" strokeWidth={1.75} />
              <span>{note}</span>
            </p>
          ) : <span />}
          {buttons.length > 0 && <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap sm:justify-end [&>*:last-child:nth-child(odd)]:col-span-2">{buttons}</div>}
        </div>
      )}
    </section>
  )
}

// ─── Generate one ────────────────────────────────────────────────────────────

function GenerateOneSheet({ open, ym, onClose, onDone }) {
  const id = useId()
  const [employeeId, setEmployeeId] = useState("")
  const [err, setErr] = useState("")
  const [msg, setMsg] = useState(null)
  const [busy, setBusy] = useState(false)
  const label = fmtPayMonth(ym.year, ym.month, { long: true })

  useEffect(() => { if (open) { setEmployeeId(""); setErr(""); setMsg(null) } }, [open])

  const submit = async () => {
    if (!/^\d+$/.test(employeeId.trim())) { setErr("กรอกรหัสเจ้าหน้าที่เป็นตัวเลข"); return }
    setErr("")
    setBusy(true)
    setMsg(null)
    try {
      await apiAuth("/hr/payroll/generate", { method: "POST", body: { employee_id: Number(employeeId), month: ym.month, year: ym.year } })
      toast.success("สร้างเงินเดือนแล้ว", { description: `รหัส ${employeeId} · ${label}` })
      onDone()
      onClose()
    } catch (e) {
      setMsg({ tone: "error", text: e.message || "สร้างไม่สำเร็จ" })
    } finally {
      setBusy(false)
    }
  }

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title="สร้างเงินเดือนรายคน"
      subtitle={`งวด ${label}`}
      size="sm"
      busy={busy}
      footer={
        <div className="grid grid-cols-2 gap-3 md:flex md:justify-end md:gap-2">
          <button type="button" onClick={onClose} disabled={busy} className={cx(neutralBtnCls, sheetBtn)}>ยกเลิก</button>
          <button type="button" onClick={submit} disabled={busy} className={cx(primaryBtnCls, sheetBtn)}>{busy ? "กำลังสร้าง…" : "สร้างเงินเดือน"}</button>
        </div>
      }
    >
      <form className="space-y-3" noValidate onSubmit={(e) => { e.preventDefault(); submit() }}>
        <div>
          <label htmlFor={id} className={cx(labelCls, "md:!text-sm")}>รหัสเจ้าหน้าที่</label>
          <input
            id={id}
            type="text"
            inputMode="numeric"
            value={employeeId}
            onChange={(e) => setEmployeeId(e.target.value)}
            placeholder="เช่น 123"
            aria-invalid={err ? true : undefined}
            aria-describedby={err ? `${id}-err` : undefined}
            className={cx(inputCls, "tabular-nums", err && "!border-red-500 dark:!border-red-400")}
          />
          {err && <p id={`${id}-err`} className={errorTextCls}>{err}</p>}
        </div>
        {msg && <StatusMsg msg={msg} />}
        <button type="submit" hidden aria-hidden="true" tabIndex={-1} />
      </form>
    </Sheet>
  )
}

// ─── Month view ──────────────────────────────────────────────────────────────

function PayrollMonthPanel({ filterMonth, setFilterMonth }) {
  const { can } = useCan()
  const isPhone = useIsPhone()
  const perms = {
    generate: can("hr.payroll.generate"),
    bulk: can("hr.payroll.generateBulk"),
    approve: can("hr.payroll.period.approve"),
    slip: can("hr.payroll.payslip"),
  }
  const ym = splitMonth(filterMonth)
  const monthLabel = fmtPayMonth(ym.year, ym.month, { long: true })

  const [payrolls, setPayrolls] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")
  const [period, setPeriod] = useState(null)
  const [periodLoading, setPeriodLoading] = useState(false)
  const [periodError, setPeriodError] = useState("")

  const [action, setAction] = useState(null)
  const [actionBusy, setActionBusy] = useState(false)
  const [actionErr, setActionErr] = useState("")
  const [returning, setReturning] = useState(null)
  const [genOpen, setGenOpen] = useState(false)
  const [detail, setDetail] = useState(null)
  const [downloading, setDownloading] = useState(null)

  const fetchPayrolls = useCallback(() => {
    const { year, month } = splitMonth(filterMonth)
    setLoading(true)
    setError("")
    apiAuth(`/hr/payroll?month=${month}&year=${year}`)
      .then((data) => setPayrolls(Array.isArray(data) ? data : []))
      .catch((e) => setError(e.message || "โหลดข้อมูลไม่สำเร็จ"))
      .finally(() => setLoading(false))
  }, [filterMonth])

  const fetchPeriod = useCallback(() => {
    const { year, month } = splitMonth(filterMonth)
    setPeriodLoading(true)
    setPeriodError("")
    apiAuth(`/hr/payroll/periods/${year}/${month}`)
      .then((d) => setPeriod(d && typeof d === "object" ? d : null))
      .catch((e) => {
        setPeriod(null)
        if (e.status !== 404) setPeriodError(e.message || "โหลดสถานะงวดไม่สำเร็จ") // 404 = ยังไม่มีงวด → ร่าง
      })
      .finally(() => setPeriodLoading(false))
  }, [filterMonth])

  const refresh = useCallback(() => { fetchPayrolls(); fetchPeriod() }, [fetchPayrolls, fetchPeriod])
  useEffect(() => { refresh() }, [refresh])

  const status = period?.status ?? "draft"
  const isDraft = status === "draft"

  const runAction = async () => {
    const a = ACTIONS[action]
    setActionBusy(true)
    setActionErr("")
    try {
      const res = await apiAuth(a.path(ym), { method: "POST", ...(a.body ? { body: a.body(ym) } : {}) })
      const n = res && typeof res === "object" ? (res.created ?? res.generated ?? res.count ?? null) : null
      toast.success(a.success, { description: n != null ? `${monthLabel} · ${n} รายการ` : monthLabel })
      setAction(null)
      refresh()
    } catch (err) {
      setActionErr(err.message || "ทำรายการไม่สำเร็จ")
    } finally {
      setActionBusy(false)
    }
  }

  const downloadPayslip = async (id) => {
    setDownloading(id)
    try {
      const { blob, filename } = await apiDownload(`/hr/payroll/${id}/payslip`)
      const url = URL.createObjectURL(blob)
      const a = document.createElement("a")
      a.href = url
      a.download = filename || `payslip_${id}.pdf`
      a.click()
      URL.revokeObjectURL(url)
    } catch (err) {
      toast.error("ดาวน์โหลดสลิปไม่สำเร็จ", { description: err.message || undefined })
    } finally {
      setDownloading(null)
    }
  }

  const gross = (p) => p.gross_income ?? null
  const ded = (p) => totalDeductions(p)
  const sum = (fn) => {
    const vals = payrolls.map(fn)
    return vals.some((v) => v == null) ? null : vals.reduce((s, v) => s + Number(v), 0)
  }
  const emptyState = (
    <EmptyState
      title="ยังไม่มีรายการเงินเดือน"
      description={
        isDraft && (perms.bulk || perms.generate)
          ? `กด "สร้างทั้งหมด" เพื่อคำนวณเงินเดือนของทุกคนในงวด ${monthLabel}`
          : `ยังไม่มีรายการเงินเดือนของงวด ${monthLabel}`
      }
    />
  )
  const a = action ? ACTIONS[action] : null

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <div className="w-44">
          <SelectDropdown value={filterMonth} onChange={setFilterMonth} options={MONTH_OPTIONS} placeholder="เลือกเดือน" />
        </div>
        <p className="text-sm text-gray-500 dark:text-gray-400" aria-live="polite">
          {loading ? "กำลังโหลด…" : `${payrolls.length} รายการ`}
        </p>
      </div>

      <PeriodCard
        ym={ym}
        period={period}
        loading={periodLoading}
        error={periodError}
        onRetry={fetchPeriod}
        rows={payrolls}
        perms={perms}
        onAction={(k) => { setActionErr(""); setAction(k) }}
        onReturn={() => setReturning(ym)}
        onGenerateOne={() => setGenOpen(true)}
      />

      {error && <ErrorState message={error} onRetry={fetchPayrolls} />}

      {isPhone ? (
        <DataList
          items={payrolls}
          keyOf={(p) => p.id}
          title={(p) => p.employee_name}
          subtitle={(p) => p.branch_name || `รหัส ${p.user_id}`}
          fields={[
            { label: "รายได้รวม", value: (p) => money(gross(p)), align: "right" },
            { label: "รายการหัก", value: (p) => (ded(p) == null ? "—" : money(ded(p))), align: "right" },
            { label: "สุทธิ", value: (p) => money(netOf(p)), align: "right", emphasis: true, span: 2 },
          ]}
          onClick={(p) => setDetail(p)}
          loading={loading}
          skeletonRows={4}
          emptyState={emptyState}
        />
      ) : (
        <div className="overflow-hidden rounded-2xl bg-white ring-1 ring-gray-200/70 shadow-sm dark:bg-surface dark:ring-line dark:shadow-none">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <caption className="sr-only">รายการเงินเดือนงวด {monthLabel}</caption>
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50 dark:border-line dark:bg-white/[.03]">
                  <th scope="col" className="px-4 py-3 text-left text-xs font-semibold text-gray-500 dark:text-gray-400">เจ้าหน้าที่ / สาขา</th>
                  <th scope="col" className="px-4 py-3 text-right text-xs font-semibold text-gray-500 dark:text-gray-400">รายได้รวม</th>
                  <th scope="col" className="px-4 py-3 text-right text-xs font-semibold text-gray-500 dark:text-gray-400">รายการหัก</th>
                  <th scope="col" className="px-4 py-3 text-right text-xs font-semibold text-gray-500 dark:text-gray-400">สุทธิ</th>
                  <th scope="col" className="w-28 px-4 py-3"><span className="sr-only">สลิป</span></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-line">
                {loading ? (
                  <SkeletonTableRows rows={6} cols={PAYROLL_COLS} />
                ) : payrolls.length === 0 ? (
                  <tr><td colSpan={PAYROLL_COLS} className="p-0">{emptyState}</td></tr>
                ) : payrolls.map((p) => (
                  <tr key={p.id} className="transition-colors duration-150 hover:bg-gray-50 dark:hover:bg-white/[.03]">
                    <td className="px-4 py-2.5">
                      <button type="button" onClick={() => setDetail(p)} className={cx("group flex items-center gap-1 rounded text-left cursor-pointer", focusRingCls)}>
                        <span>
                          <span className="block font-medium text-gray-900 group-hover:text-indigo-700 dark:text-gray-100 dark:group-hover:text-indigo-300">{p.employee_name}</span>
                          <span className="block text-xs text-gray-500 dark:text-gray-400">{p.branch_name || `รหัส ${p.user_id}`}</span>
                        </span>
                        <ChevronRight aria-hidden="true" className="size-4 text-gray-400 opacity-0 transition-opacity duration-150 group-hover:opacity-100 group-focus-visible:opacity-100" />
                      </button>
                    </td>
                    <td className="px-4 py-2.5 text-right tabular-nums text-gray-700 dark:text-gray-300">{money(gross(p))}</td>
                    <td className="px-4 py-2.5 text-right tabular-nums text-gray-700 dark:text-gray-300">{ded(p) == null ? "—" : money(ded(p))}</td>
                    <td className="px-4 py-2.5 text-right font-semibold tabular-nums text-gray-900 dark:text-gray-100">{money(netOf(p))}</td>
                    <td className="px-4 py-2.5 text-right">
                      {perms.slip && (
                        <button
                          type="button"
                          onClick={() => downloadPayslip(p.id)}
                          disabled={downloading === p.id}
                          className={cx("rounded text-xs font-medium text-indigo-700 hover:underline cursor-pointer disabled:cursor-not-allowed disabled:opacity-50 dark:text-indigo-300", focusRingCls)}
                        >
                          {downloading === p.id ? "กำลังโหลด…" : "สลิป PDF"}
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
              {!loading && payrolls.length > 0 && (
                <tfoot>
                  <tr className="border-t border-gray-200 bg-gray-50 font-semibold dark:border-line-strong dark:bg-white/[.03]">
                    <th scope="row" className="px-4 py-3 text-left text-gray-700 dark:text-gray-300">รวม {payrolls.length} คน</th>
                    <td className="px-4 py-3 text-right tabular-nums text-gray-900 dark:text-gray-100">{money(sum(gross))}</td>
                    <td className="px-4 py-3 text-right tabular-nums text-gray-900 dark:text-gray-100">{money(sum(ded))}</td>
                    <td className="px-4 py-3 text-right tabular-nums text-gray-900 dark:text-gray-100">{money(sum(netOf))}</td>
                    <td />
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
        </div>
      )}

      <ConfirmDialog
        open={!!a}
        title={a ? a.title(monthLabel) : ""}
        description={a?.description}
        confirmLabel={a?.confirmLabel}
        loadingLabel={a?.loadingLabel}
        tone={a?.tone ?? "primary"}
        loading={actionBusy}
        error={actionErr}
        onConfirm={runAction}
        onCancel={() => setAction(null)}
      />

      <GenerateOneSheet open={genOpen} ym={ym} onClose={() => setGenOpen(false)} onDone={refresh} />
      <ReturnPeriodSheet period={returning} onClose={() => setReturning(null)} onDone={refresh} />
      <HRPayrollPayoutSheet
        payout={detail}
        isDraft={isDraft}
        periodLabel={periodLabel(period ?? { status })}
        onClose={() => setDetail(null)}
        onSaved={refresh}
        onDownload={downloadPayslip}
        downloading={detail != null && downloading === detail.id}
      />
    </div>
  )
}

// ─── Tab root ────────────────────────────────────────────────────────────────

export default function HRPayrollTab() {
  const { can } = useCan()
  const canApprove = can("hr.payroll.period.approve")
  const canList = can("hr.payroll.list")
  const [params, setParams] = useSearchParams()
  const [filterMonth, setFilterMonth] = useState(MONTH_OPTIONS[0].value)
  const [reviewCount, setReviewCount] = useState(null)

  // แท็บย่อย "รออนุมัติ" เฉพาะผู้อนุมัติ — ผู้อนุมัติที่ไม่ได้สร้างเงินเดือนเริ่มที่รออนุมัติ
  const subs = [
    ...(canList ? [{ value: "month", label: "งวดประจำเดือน" }] : []),
    ...(canApprove ? [{ value: "review", label: "รออนุมัติ", count: reviewCount || undefined }] : []),
  ]
  const fallback = canApprove && !can("hr.payroll.generate") ? "review" : subs[0]?.value
  const raw = params.get("sub")
  const sub = subs.some((s) => s.value === raw) ? raw : fallback

  const changeSub = (next) =>
    setParams((prev) => { const p = new URLSearchParams(prev); p.set("sub", String(next)); return p }, { replace: true, state: keepBackState() })

  // รออนุมัติ → งวดของเดือนนั้น = drill-down: Topbar "‹ งวดรออนุมัติ" พากลับ
  const { drillParams } = useDrill()
  const openMonth = (year, month) => {
    setFilterMonth(`${year}-${String(month).padStart(2, "0")}`)
    drillParams((p) => { p.set("sub", "month"); return p }, "งวดรออนุมัติ")
  }

  const onCountChange = useCallback((n) => setReviewCount(n), [])

  // จำนวนงวดที่รออนุมัติของปีนี้ บนหัวแท็บย่อย (แผง "รออนุมัติ" อัปเดตต่อเองเมื่ออนุมัติ/ส่งกลับ)
  useEffect(() => {
    if (!canApprove) return
    let alive = true
    apiAuth(`/hr/payroll/periods?year=${now.getFullYear()}`)
      .then((d) => { if (alive) setReviewCount(periodList(d).filter((p) => p.status === "review").length) })
      .catch(() => {})
    return () => { alive = false }
  }, [canApprove])

  if (subs.length <= 1) {
    return sub === "review"
      ? <HRPayrollReviewPanel onOpenMonth={openMonth} onCountChange={onCountChange} />
      : <PayrollMonthPanel filterMonth={filterMonth} setFilterMonth={setFilterMonth} />
  }

  return (
    <div className="space-y-5">
      <Tabs items={subs} value={sub} onChange={changeSub} ariaLabel="จ่ายเงินเดือน" idBase={ID_BASE} />
      <div role="tabpanel" id={panelId(ID_BASE, sub)} aria-labelledby={tabId(ID_BASE, sub)} tabIndex={0}
        className="rounded-2xl focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500/40">
        {sub === "review"
          ? <HRPayrollReviewPanel onOpenMonth={openMonth} onCountChange={onCountChange} />
          : <PayrollMonthPanel filterMonth={filterMonth} setFilterMonth={setFilterMonth} />}
      </div>
    </div>
  )
}
