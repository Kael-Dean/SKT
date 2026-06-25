import { useEffect, useMemo, useRef, useState } from "react"
import { apiAuth } from "../../../lib/api"
import Portal from "../../../components/Portal"
import SelectDropdown from "../../../components/SelectDropdown"
import StickyTableScrollbar from "../../../components/StickyTableScrollbar"
import ThaiDatePicker from "../../../components/ThaiDatePicker"
import {
  cx, baseField, labelCls, submitBtnCls, secondaryBtnCls,
  modalCardCls, modalTitleCls,
} from "../../../lib/styles"
import { EmptyState, ErrorState } from "../../../components/ui"
import {
  findCurrentFiscalYear,
  findCurrentFiscalYearId,
  getCurrentFiscalYearString,
  selectableAppliedFiscalYears,
  isDateInPastFiscalYear,
  isDateInCurrentFiscalYear,
  getFiscalYearStringForDate,
} from "../../../lib/debtFiscalYear"
import { buildReportRows, computeColTotals } from "./buildReportRows"
import { printDebtTable } from "./printDebtTable"

/** Line-art printer icon for the export button (currentColor, no emoji). */
function PrinterIcon() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="size-4"
    >
      <path d="M6 9V2h12v7" />
      <path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2" />
      <rect x="6" y="14" width="12" height="8" rx="1" />
    </svg>
  )
}

const fmtMoney = (v) =>
  new Intl.NumberFormat("th-TH", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(parseFloat(v) || 0)

const sanitizeDecimal = (s) => {
  const clean = String(s ?? "").replace(/[^0-9.]/g, "")
  const parts = clean.split(".")
  return parts.length > 2 ? parts[0] + "." + parts.slice(1).join("") : clean
}

function todayISO() {
  return new Date().toISOString().split("T")[0]
}

const STRIPE = {
  head: "bg-slate-100 dark:bg-slate-700",
  cell: "bg-white dark:bg-slate-900",
  alt: "bg-slate-50 dark:bg-slate-800",
  foot: "bg-emerald-100 dark:bg-emerald-900",
}

export default function BranchDebtTable({
  programs,
  fiscalYears,
  branches,
  onBack,
}) {
  const [selectedBranchId, setSelectedBranchId] = useState("")
  const [reportRows, setReportRows]              = useState([])
  const [loading, setLoading]                    = useState(false)
  const [error, setError]                        = useState("")
  const [reloadKey, setReloadKey]                = useState(0)
  const [modal, setModal]                        = useState(null)
  const [form, setForm]                          = useState({})
  const [saving, setSaving]                      = useState(false)
  const [saveMsg, setSaveMsg]                    = useState("")
  const [produceTypes, setProduceTypes]          = useState([])

  const tableWrapRef = useRef(null)

  // Fetch the derived report for the selected branch (or all branches).
  useEffect(() => {
    let alive = true
    setLoading(true)
    setError("")
    ;(async () => {
      try {
        const url = `/debt/report${selectedBranchId ? `?branch_id=${selectedBranchId}` : ""}`
        const data = await apiAuth(url)
        if (alive) setReportRows(Array.isArray(data) ? data : [])
      } catch (e) {
        if (alive) setError(e.message || "โหลดรายงานไม่สำเร็จ")
      } finally {
        if (alive) setLoading(false)
      }
    })()
    return () => { alive = false }
  }, [selectedBranchId, reloadKey])

  function refetchReport() { setReloadKey((k) => k + 1) }

  const tableRows = useMemo(
    () => buildReportRows(programs, fiscalYears, reportRows),
    [programs, fiscalYears, reportRows]
  )
  const colTotals = useMemo(() => computeColTotals(tableRows), [tableRows])

  function branchName(id) {
    return branches.find((b) => b.id === Number(id))?.name || `สาขา ${id}`
  }

  function setF(key, val) {
    setForm((f) => ({ ...f, [key]: val }))
  }

  function closeModal() {
    setModal(null)
    setSaveMsg("")
    setForm({})
  }

  function openModal(mode) {
    setSaveMsg("")
    if (mode === "add_payment") {
      setForm({
        branch_id: selectedBranchId || "",
        program_id: "",
        applied_fiscal_year_id: findCurrentFiscalYearId(fiscalYears) ? String(findCurrentFiscalYearId(fiscalYears)) : "",
        payment_method: "cash",
        amount: "",
        produce_id: "",
        produce_weight: "",
        produce_value: "",
        transaction_date: todayISO(),
        note: "",
      })
      if (produceTypes.length === 0) {
        apiAuth("/debt/lookup/produce-types")
          .then((data) => setProduceTypes(Array.isArray(data) ? data : []))
          .catch(() => {})
      }
    } else if (mode === "add_new_debt") {
      setForm({
        branch_id: selectedBranchId || "",
        program_id: "",
        amount: "",
        transaction_date: todayISO(),
        note: "",
      })
    } else if (mode === "add_old_debt") {
      setForm({
        branch_id: selectedBranchId || "",
        program_id: "",
        amount: "",
        transaction_date: "",
        note: "",
      })
    }
    setModal({ mode })
  }

  const currentFYString = getCurrentFiscalYearString()

  async function handleSubmit(e) {
    e.preventDefault()
    setSaving(true)
    setSaveMsg("")
    try {
      if (modal.mode === "add_payment") {
        if (!form.branch_id)              { setSaveMsg("กรุณาเลือกสาขา"); setSaving(false); return }
        if (!form.program_id)             { setSaveMsg("กรุณาเลือกโครงการ"); setSaving(false); return }
        if (!form.applied_fiscal_year_id) { setSaveMsg("กรุณาเลือกปีที่ตัดชำระ"); setSaving(false); return }
        if (!isDateInCurrentFiscalYear(form.transaction_date)) {
          setSaveMsg(`วันที่ต้องอยู่ในปีการผลิตปัจจุบัน (${currentFYString})`); setSaving(false); return
        }
        const isProduce = form.payment_method === "produce_trade"
        await apiAuth("/debt/transactions/payment", {
          method: "POST",
          body: {
            branch_id: Number(form.branch_id),
            program_id: Number(form.program_id),
            applied_fiscal_year_id: Number(form.applied_fiscal_year_id),
            payment_method: form.payment_method,
            amount: isProduce ? form.produce_value : form.amount,
            transaction_date: form.transaction_date,
            note: form.note.trim() || null,
            produce_id: isProduce ? Number(form.produce_id) : null,
            produce_weight: isProduce ? form.produce_weight : null,
            produce_value: isProduce ? form.produce_value : null,
          },
        })
      } else if (modal.mode === "add_new_debt") {
        if (!form.branch_id)  { setSaveMsg("กรุณาเลือกสาขา"); setSaving(false); return }
        if (!form.program_id) { setSaveMsg("กรุณาเลือกโครงการ"); setSaving(false); return }
        if (!isDateInCurrentFiscalYear(form.transaction_date)) {
          setSaveMsg(`วันที่ต้องอยู่ในปีการผลิตปัจจุบัน (${currentFYString})`); setSaving(false); return
        }
        await apiAuth("/debt/transactions/new-debt", {
          method: "POST",
          body: {
            branch_id: Number(form.branch_id),
            program_id: Number(form.program_id),
            amount: form.amount,
            transaction_date: form.transaction_date,
            note: form.note.trim() || null,
          },
        })
      } else if (modal.mode === "add_old_debt") {
        if (!form.branch_id)  { setSaveMsg("กรุณาเลือกสาขา"); setSaving(false); return }
        if (!form.program_id) { setSaveMsg("กรุณาเลือกโครงการ"); setSaving(false); return }
        if (!form.transaction_date) { setSaveMsg("กรุณาเลือกวันที่ (ปีอดีต)"); setSaving(false); return }
        if (!isDateInPastFiscalYear(form.transaction_date)) {
          setSaveMsg(`วันที่ต้องอยู่ในปีอดีต — ปีปัจจุบันคือ ${currentFYString} (ใช้ “เพิ่มในปี” สำหรับปีปัจจุบัน)`)
          setSaving(false); return
        }
        await apiAuth("/debt/transactions/old-debt", {
          method: "POST",
          body: {
            branch_id: Number(form.branch_id),
            program_id: Number(form.program_id),
            amount: form.amount,
            transaction_date: form.transaction_date,
            note: form.note.trim() || null,
          },
        })
      }
      closeModal()
      refetchReport()
    } catch (err) {
      setSaveMsg(err.message || "บันทึกไม่สำเร็จ")
    } finally {
      setSaving(false)
    }
  }

  const programOpts = programs
    .filter((p) => p.is_active !== false)
    .map((p) => ({ value: String(p.id), label: p.prog_name }))

  const appliedYearOpts = selectableAppliedFiscalYears(fiscalYears).map((y) => ({
    value: String(y.id),
    label: y.year_name,
  }))

  const branchOpts = [
    { value: "", label: "ทุกสาขา" },
    ...branches.map((b) => ({ value: String(b.id), label: b.name })),
  ]

  const payMethodOpts = [
    { value: "cash", label: "เงินสด" },
    { value: "mobile_banking", label: "โอนผ่านมือถือ" },
    { value: "produce_trade", label: "ชำระด้วยผลผลิต" },
  ]

  const produceTypeOpts = produceTypes.map((t) => ({
    value: String(t.id),
    label: t.name || t.produce_name || String(t.id),
  }))

  const branchModalOpts = branches.map((b) => ({ value: String(b.id), label: b.name }))

  const currentFY = findCurrentFiscalYear(fiscalYears)

  return (
    <div>
      <div className="flex flex-wrap items-center gap-3 mb-4">
        <button
          onClick={onBack}
          className="inline-flex items-center gap-1.5 rounded-xl border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 py-2 text-sm font-medium text-gray-700 dark:text-gray-200 shadow-sm hover:bg-gray-50 hover:border-gray-400 dark:hover:bg-gray-700 dark:hover:border-gray-500 active:scale-95 transition-all duration-200 cursor-pointer"
        >
          ← กลับ
        </button>
        <h2 className="text-base font-bold text-gray-900 dark:text-gray-100 flex-1">
          ตารางหนี้แยกสาขา
        </h2>
      </div>
      <div className="flex flex-wrap items-center gap-3 mb-4">
        <div className="w-64">
          <SelectDropdown
            options={branchOpts}
            value={selectedBranchId}
            onChange={setSelectedBranchId}
            placeholder="— เลือกสาขา —"
          />
        </div>
        <button
          onClick={() => openModal("add_old_debt")}
          className={cx(
            "inline-flex items-center justify-center rounded-2xl border border-amber-300 bg-amber-50 px-4 py-2 text-sm font-semibold text-amber-700 cursor-pointer transition-all duration-200 hover:bg-amber-100 hover:scale-[1.02] active:scale-[.98] dark:border-amber-700/60 dark:bg-amber-900/20 dark:text-amber-300 dark:hover:bg-amber-900/40"
          )}
        >
          + บันทึกยอดยกมา/หนี้เก่า
        </button>
        <button
          onClick={() => openModal("add_new_debt")}
          className={cx(secondaryBtnCls, "!py-2 !px-4 !text-sm cursor-pointer")}
        >
          + บันทึกเพิ่มในปี
        </button>
        <button
          onClick={() => openModal("add_payment")}
          className={cx(secondaryBtnCls, "!py-2 !px-4 !text-sm cursor-pointer")}
        >
          + บันทึกรับชำระ
        </button>
        <button
          onClick={() =>
            printDebtTable({
              title: "ตารางหนี้แยกสาขา",
              subtitle: selectedBranchId
                ? `สาขา: ${branches.find((b) => b.id === Number(selectedBranchId))?.name || ""}`
                : "ทุกสาขา",
              tableRows,
              colTotals,
            })
          }
          className={cx(secondaryBtnCls, "!py-2 !px-4 !text-sm cursor-pointer")}
        >
          <PrinterIcon />
          พิมพ์ PDF
        </button>
      </div>

      {error && !loading && (
        <div className="mb-4">
          <ErrorState message={error} onRetry={refetchReport} />
        </div>
      )}

      <div
        ref={tableWrapRef}
        className="overflow-auto rounded-2xl border border-slate-200 dark:border-slate-700"
      >
        <table
          className="border-collapse text-sm"
          style={{ tableLayout: "fixed", minWidth: "1400px" }}
        >
          <thead className="sticky top-0 z-20">
            <tr className={cx(STRIPE.head, "text-slate-800 dark:text-slate-100")}>
              <th
                rowSpan={3}
                className="border border-slate-300 dark:border-slate-600 px-1 py-2 text-center text-[11px] font-bold sticky left-0 z-10 bg-slate-100 dark:bg-slate-700"
                style={{ width: 50, minWidth: 50 }}
              >
                ลำดับ
              </th>
              <th
                rowSpan={3}
                className="border border-slate-300 dark:border-slate-600 px-2 py-2 text-left text-[11px] font-bold sticky left-[50px] z-10 bg-slate-100 dark:bg-slate-700"
                style={{ width: 180, minWidth: 180 }}
              >
                โครงการ
              </th>
              <th
                rowSpan={3}
                className="border border-slate-300 dark:border-slate-600 px-1 py-2 text-center text-[11px] font-bold sticky left-[230px] z-10 bg-slate-100 dark:bg-slate-700"
                style={{ width: 80, minWidth: 80 }}
              >
                ปีการผลิต
              </th>
              <th colSpan={2} className="border border-slate-300 dark:border-slate-600 px-1 py-1.5 text-center text-[11px] font-bold">
                ยอดยกมา
              </th>
              <th colSpan={2} className="border border-slate-300 dark:border-slate-600 px-1 py-1.5 text-center text-[11px] font-bold">
                เพิ่มในปี
              </th>
              <th colSpan={2} className="border border-slate-300 dark:border-slate-600 px-1 py-1.5 text-center text-[11px] font-bold">
                รับชำระ
              </th>
              <th colSpan={2} className="border border-slate-300 dark:border-slate-600 px-1 py-1.5 text-center text-[11px] font-bold">
                คงเหลือ
              </th>
              <th colSpan={6} className="border border-slate-300 dark:border-slate-600 px-1 py-1.5 text-center text-[11px] font-bold bg-indigo-50 dark:bg-indigo-900/20">
                วิธีชำระหนี้
              </th>
              <th
                rowSpan={3}
                className="border border-slate-300 dark:border-slate-600 px-1 py-2 text-center text-[11px] font-bold"
                style={{ width: 100, minWidth: 100 }}
              >
                หมายเหตุ
              </th>
            </tr>
            <tr className={cx(STRIPE.head, "text-slate-800 dark:text-slate-100")}>
              {Array(8).fill(null).map((_, i) => (
                <th
                  key={i}
                  className="border border-slate-300 dark:border-slate-600"
                  style={{ width: 80, minWidth: 80 }}
                />
              ))}
              <th colSpan={2} className="border border-slate-300 dark:border-slate-600 px-0.5 py-1 text-center text-[10px] font-semibold bg-indigo-50 dark:bg-indigo-900/20">
                โอนผ่านมือถือ
              </th>
              <th colSpan={2} className="border border-slate-300 dark:border-slate-600 px-0.5 py-1 text-center text-[10px] font-semibold bg-indigo-50 dark:bg-indigo-900/20">
                เงินสด
              </th>
              <th colSpan={2} className="border border-slate-300 dark:border-slate-600 px-0.5 py-1 text-center text-[10px] font-semibold bg-indigo-50 dark:bg-indigo-900/20">
                ชำระด้วยผลผลิต
              </th>
            </tr>
            <tr className={cx(STRIPE.head, "text-slate-700 dark:text-slate-300")}>
              {Array(7).fill(null).flatMap((_, i) => [
                <th
                  key={`a${i}`}
                  className="border border-slate-300 dark:border-slate-600 px-0.5 py-1 text-center text-[10px]"
                  style={{ width: 80, minWidth: 80 }}
                >
                  จำนวน(บาท)
                </th>,
                <th
                  key={`b${i}`}
                  className="border border-slate-300 dark:border-slate-600 px-0.5 py-1 text-center text-[10px]"
                  style={{ width: 65, minWidth: 65 }}
                >
                  จำนวนราย
                </th>,
              ])}
            </tr>
          </thead>

          <tbody>
            {tableRows.length === 0 ? (
              <tr>
                <td colSpan={18} className={cx(STRIPE.cell, "p-0")}>
                  <EmptyState
                    title={loading ? "กำลังโหลด…" : "ยังไม่มีโครงการ"}
                    description={loading ? "กำลังดึงรายงานหนี้" : "ยังไม่มีโครงการหนี้ในระบบ — กลับไปหน้าตารางหนี้แล้วกด “เพิ่มโครงการ” ก่อนบันทึกยอดหนี้"}
                    action={
                      <button
                        type="button"
                        onClick={onBack}
                        className={cx(secondaryBtnCls, "!py-2 !px-4 !text-sm cursor-pointer")}
                      >
                        กลับไปหน้าตารางหนี้
                      </button>
                    }
                  />
                </td>
              </tr>
            ) : (
              tableRows.map((group, gi) => {
                const rowBg = gi % 2 === 0 ? STRIPE.cell : STRIPE.alt
                return group.yearRows.map((yr, yi) => (
                  <tr key={`${group.program.id}-${yr.fiscalYear.id}`} className={rowBg}>
                    {yi === 0 && (
                      <>
                        <td
                          rowSpan={group.yearRows.length}
                          className={cx(
                            "border border-slate-200 dark:border-slate-700 px-1 py-2 text-center text-xs sticky left-0 z-10",
                            rowBg
                          )}
                        >
                          {gi + 1}
                        </td>
                        <td
                          rowSpan={group.yearRows.length}
                          className={cx(
                            "border border-slate-200 dark:border-slate-700 px-2 py-2 text-xs font-medium sticky left-[50px] z-10",
                            rowBg
                          )}
                        >
                          {group.program.prog_name}
                        </td>
                      </>
                    )}
                    <td
                      className={cx(
                        "border border-slate-200 dark:border-slate-700 px-1 py-2 text-center text-xs sticky left-[230px] z-10",
                        rowBg
                      )}
                    >
                      {yr.fiscalYear.year_name}
                    </td>
                    {[
                      yr.carry_amount, yr.carry_count,
                      yr.new_amount, yr.new_count,
                      yr.paid_amount, yr.paid_count,
                      yr.remain_amount, yr.remain_count,
                      yr.mobile_amount, yr.mobile_count,
                      yr.cash_amount, yr.cash_count,
                      yr.produce_amount, yr.produce_count,
                    ].map((val, ci) => (
                      <td
                        key={ci}
                        className="border border-slate-200 dark:border-slate-700 px-1 py-2 text-right text-xs tabular-nums"
                      >
                        {ci % 2 === 0 ? fmtMoney(val) : val || 0}
                      </td>
                    ))}
                    <td className="border border-slate-200 dark:border-slate-700 px-1 py-2 text-xs text-gray-500 dark:text-gray-400">
                      {yr.note || ""}
                    </td>
                  </tr>
                ))
              })
            )}
          </tbody>

          <tfoot>
            <tr className={STRIPE.foot}>
              <td
                colSpan={3}
                className={cx(
                  "border border-slate-300 dark:border-slate-600 px-2 py-2 text-xs font-bold sticky left-0 z-10",
                  STRIPE.foot
                )}
              >
                รวมทั้งหมด
              </td>
              {[
                colTotals.carry_amount, colTotals.carry_count,
                colTotals.new_amount, colTotals.new_count,
                colTotals.paid_amount, colTotals.paid_count,
                colTotals.remain_amount, colTotals.remain_count,
                colTotals.mobile_amount, colTotals.mobile_count,
                colTotals.cash_amount, colTotals.cash_count,
                colTotals.produce_amount, colTotals.produce_count,
              ].map((val, ci) => (
                <td
                  key={ci}
                  className={cx(
                    "border border-slate-300 dark:border-slate-600 px-1 py-2 text-right text-xs font-bold tabular-nums",
                    STRIPE.foot
                  )}
                >
                  {ci % 2 === 0 ? fmtMoney(val) : val || 0}
                </td>
              ))}
              <td className={cx("border border-slate-300 dark:border-slate-600", STRIPE.foot)} />
            </tr>
          </tfoot>
        </table>
      </div>
      <StickyTableScrollbar tableRef={tableWrapRef} />

      {modal && (
        <Portal>
          <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4"
            onClick={(e) => { if (e.target === e.currentTarget) closeModal() }}
          >
            <div className={cx(modalCardCls, "max-w-lg w-full max-h-[90vh] overflow-y-auto")}>
              {modal.mode === "add_payment" && (
                <>
                  <h2 className={cx(modalTitleCls, "mb-4")}>บันทึกชำระหนี้</h2>
                  <div className="mb-4 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-2.5 text-sm text-emerald-700 dark:border-emerald-700/40 dark:bg-emerald-900/20 dark:text-emerald-300">
                    รับชำระตัดยอด <span className="font-bold">ปีปัจจุบัน</span> เสมอ — “ปีที่ตัดชำระ” เป็นป้ายอ้างอิงเท่านั้น
                  </div>
                  <form onSubmit={handleSubmit} className="space-y-4">
                    {selectedBranchId ? (
                      <div>
                        <label className={labelCls}>สาขา</label>
                        <p className="text-sm text-slate-700 dark:text-slate-300 mt-0.5">{branchName(selectedBranchId)}</p>
                      </div>
                    ) : (
                      <div>
                        <label className={labelCls}>สาขา <span className="text-red-500">*</span></label>
                        <SelectDropdown
                          options={branchModalOpts}
                          value={form.branch_id || ""}
                          onChange={(v) => setF("branch_id", v)}
                          placeholder="— เลือกสาขา —"
                        />
                      </div>
                    )}
                    <div>
                      <label className={labelCls}>โครงการ <span className="text-red-500">*</span></label>
                      <SelectDropdown
                        options={programOpts}
                        value={form.program_id || ""}
                        onChange={(v) => setF("program_id", v)}
                        placeholder="— เลือกโครงการ —"
                      />
                    </div>
                    <div>
                      <label className={labelCls}>ปีที่ตัดชำระ (อ้างอิง) <span className="text-red-500">*</span></label>
                      <SelectDropdown
                        options={appliedYearOpts}
                        value={form.applied_fiscal_year_id || ""}
                        onChange={(v) => setF("applied_fiscal_year_id", v)}
                        placeholder="— เลือกปี —"
                      />
                    </div>
                    <div>
                      <label className={labelCls}>วิธีชำระ <span className="text-red-500">*</span></label>
                      <SelectDropdown
                        options={payMethodOpts}
                        value={form.payment_method || "cash"}
                        onChange={(v) => setF("payment_method", v)}
                        placeholder="— เลือกวิธีชำระ —"
                      />
                    </div>
                    {form.payment_method !== "produce_trade" && (
                      <div>
                        <label className={labelCls}>จำนวนเงิน (บาท) <span className="text-red-500">*</span></label>
                        <input
                          className={baseField}
                          value={form.amount || ""}
                          onChange={(e) => setF("amount", sanitizeDecimal(e.target.value))}
                          placeholder="0.00"
                          required
                        />
                      </div>
                    )}
                    {form.payment_method === "produce_trade" && (
                      <>
                        <div>
                          <label className={labelCls}>ประเภทผลผลิต <span className="text-red-500">*</span></label>
                          <SelectDropdown
                            options={produceTypeOpts}
                            value={form.produce_id || ""}
                            onChange={(v) => setF("produce_id", v)}
                            placeholder="— เลือกประเภทผลผลิต —"
                          />
                        </div>
                        <div>
                          <label className={labelCls}>น้ำหนัก (กก.) <span className="text-red-500">*</span></label>
                          <input
                            className={baseField}
                            value={form.produce_weight || ""}
                            onChange={(e) => setF("produce_weight", sanitizeDecimal(e.target.value))}
                            placeholder="0.00"
                            required
                          />
                        </div>
                        <div>
                          <label className={labelCls}>มูลค่าผลผลิต (บาท) <span className="text-red-500">*</span></label>
                          <input
                            className={baseField}
                            value={form.produce_value || ""}
                            onChange={(e) => setF("produce_value", sanitizeDecimal(e.target.value))}
                            placeholder="0.00"
                            required
                          />
                          <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">มูลค่าผลผลิตจะถูกใช้เป็นยอดชำระจริง</p>
                        </div>
                      </>
                    )}
                    <div>
                      <label className={labelCls}>วันที่ <span className="text-red-500">*</span></label>
                      <ThaiDatePicker
                        className={baseField}
                        value={form.transaction_date || ""}
                        onChange={(val) => setF("transaction_date", val)}
                      />
                      <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">ต้องอยู่ในปีการผลิตปัจจุบัน ({currentFYString})</p>
                    </div>
                    <div>
                      <label className={labelCls}>หมายเหตุ</label>
                      <textarea
                        className={cx(baseField, "resize-none")}
                        rows={2}
                        value={form.note || ""}
                        onChange={(e) => setF("note", e.target.value)}
                        placeholder="หมายเหตุ (ไม่บังคับ)"
                      />
                    </div>
                    {saveMsg && <p className="text-sm text-red-500 dark:text-red-400">{saveMsg}</p>}
                    <div className="flex gap-3 justify-end pt-1">
                      <button
                        type="button"
                        onClick={closeModal}
                        className="inline-flex items-center rounded-xl px-4 py-2 text-sm text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors cursor-pointer"
                      >
                        ยกเลิก
                      </button>
                      <button
                        type="submit"
                        disabled={saving}
                        className={cx(submitBtnCls, "!py-2 !px-5 !text-sm cursor-pointer disabled:cursor-not-allowed")}
                      >
                        {saving ? "กำลังบันทึก..." : "บันทึก"}
                      </button>
                    </div>
                  </form>
                </>
              )}

              {modal.mode === "add_new_debt" && (
                <>
                  <h2 className={cx(modalTitleCls, "mb-4")}>บันทึกหนี้เพิ่มในปี</h2>
                  <div className={cx(
                    "mb-4 rounded-xl border px-4 py-2.5 text-sm",
                    currentFY
                      ? "bg-indigo-50 dark:bg-indigo-900/20 border-indigo-200 dark:border-indigo-700 text-indigo-700 dark:text-indigo-300"
                      : "bg-rose-50 dark:bg-rose-900/20 border-rose-200 dark:border-rose-700 text-rose-700 dark:text-rose-300"
                  )}>
                    {currentFY
                      ? <>บันทึกได้เฉพาะปีการผลิตปัจจุบัน — <span className="font-bold">{currentFY.year_name}</span> (ระบบตัดปีจากวันที่จริง)</>
                      : <>ไม่พบปีการผลิต <span className="font-bold">{currentFYString}</span> ในระบบ — โปรดให้ผู้ดูแลเพิ่มปีก่อน</>
                    }
                  </div>
                  <form onSubmit={handleSubmit} className="space-y-4">
                    {selectedBranchId ? (
                      <div>
                        <label className={labelCls}>สาขา</label>
                        <p className="text-sm text-slate-700 dark:text-slate-300 mt-0.5">{branchName(selectedBranchId)}</p>
                      </div>
                    ) : (
                      <div>
                        <label className={labelCls}>สาขา <span className="text-red-500">*</span></label>
                        <SelectDropdown
                          options={branchModalOpts}
                          value={form.branch_id || ""}
                          onChange={(v) => setF("branch_id", v)}
                          placeholder="— เลือกสาขา —"
                        />
                      </div>
                    )}
                    <div>
                      <label className={labelCls}>โครงการ <span className="text-red-500">*</span></label>
                      <SelectDropdown
                        options={programOpts}
                        value={form.program_id || ""}
                        onChange={(v) => setF("program_id", v)}
                        placeholder="— เลือกโครงการ —"
                      />
                    </div>
                    <div>
                      <label className={labelCls}>จำนวนเงิน (บาท) <span className="text-red-500">*</span></label>
                      <input
                        className={baseField}
                        value={form.amount || ""}
                        onChange={(e) => setF("amount", sanitizeDecimal(e.target.value))}
                        placeholder="0.00"
                        required
                      />
                    </div>
                    <div>
                      <label className={labelCls}>วันที่ <span className="text-red-500">*</span></label>
                      <ThaiDatePicker
                        className={baseField}
                        value={form.transaction_date || ""}
                        onChange={(val) => setF("transaction_date", val)}
                      />
                      <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">ต้องอยู่ในปีการผลิตปัจจุบัน ({currentFYString})</p>
                    </div>
                    <div>
                      <label className={labelCls}>หมายเหตุ</label>
                      <textarea
                        className={cx(baseField, "resize-none")}
                        rows={2}
                        value={form.note || ""}
                        onChange={(e) => setF("note", e.target.value)}
                        placeholder="หมายเหตุ (ไม่บังคับ)"
                      />
                    </div>
                    {saveMsg && <p className="text-sm text-red-500 dark:text-red-400">{saveMsg}</p>}
                    <div className="flex gap-3 justify-end pt-1">
                      <button
                        type="button"
                        onClick={closeModal}
                        className="inline-flex items-center rounded-xl px-4 py-2 text-sm text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors cursor-pointer"
                      >
                        ยกเลิก
                      </button>
                      <button
                        type="submit"
                        disabled={saving || !currentFY}
                        className={cx(submitBtnCls, "!py-2 !px-5 !text-sm cursor-pointer disabled:cursor-not-allowed")}
                      >
                        {saving ? "กำลังบันทึก..." : "บันทึก"}
                      </button>
                    </div>
                  </form>
                </>
              )}

              {modal.mode === "add_old_debt" && (
                <>
                  <h2 className={cx(modalTitleCls, "mb-4")}>บันทึกยอดยกมา / หนี้เก่า</h2>
                  <div className="mb-4 rounded-xl bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700 px-4 py-2.5 text-sm text-amber-700 dark:text-amber-300">
                    หนี้เก่าของ <span className="font-bold">ปีอดีต</span> เท่านั้น — ระบบตัดปีจากวันที่ แล้วยอดจะไหลมารวมเป็นยอดยกมาของปีปัจจุบัน
                  </div>
                  <form onSubmit={handleSubmit} className="space-y-4">
                    {selectedBranchId ? (
                      <div>
                        <label className={labelCls}>สาขา</label>
                        <p className="text-sm text-slate-700 dark:text-slate-300 mt-0.5">{branchName(selectedBranchId)}</p>
                      </div>
                    ) : (
                      <div>
                        <label className={labelCls}>สาขา <span className="text-red-500">*</span></label>
                        <SelectDropdown
                          options={branchModalOpts}
                          value={form.branch_id || ""}
                          onChange={(v) => setF("branch_id", v)}
                          placeholder="— เลือกสาขา —"
                        />
                      </div>
                    )}
                    <div>
                      <label className={labelCls}>โครงการ <span className="text-red-500">*</span></label>
                      <SelectDropdown
                        options={programOpts}
                        value={form.program_id || ""}
                        onChange={(v) => setF("program_id", v)}
                        placeholder="— เลือกโครงการ —"
                      />
                    </div>
                    <div>
                      <label className={labelCls}>จำนวนเงิน (บาท) <span className="text-red-500">*</span></label>
                      <input
                        className={baseField}
                        value={form.amount || ""}
                        onChange={(e) => setF("amount", sanitizeDecimal(e.target.value))}
                        placeholder="0.00"
                        required
                      />
                    </div>
                    <div>
                      <label className={labelCls}>วันที่ (ปีอดีต) <span className="text-red-500">*</span></label>
                      <ThaiDatePicker
                        className={baseField}
                        value={form.transaction_date || ""}
                        onChange={(val) => setF("transaction_date", val)}
                      />
                      <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                        {form.transaction_date
                          ? (isDateInPastFiscalYear(form.transaction_date)
                              ? `ปีการผลิตของหนี้นี้: ${getFiscalYearStringForDate(form.transaction_date)}`
                              : `ต้องเป็นปีอดีต — ปีปัจจุบันคือ ${currentFYString}`)
                          : `ปีปัจจุบันคือ ${currentFYString} — เลือกวันที่ในปีก่อนหน้า`}
                      </p>
                    </div>
                    <div>
                      <label className={labelCls}>หมายเหตุ</label>
                      <textarea
                        className={cx(baseField, "resize-none")}
                        rows={2}
                        value={form.note || ""}
                        onChange={(e) => setF("note", e.target.value)}
                        placeholder="หมายเหตุ (ไม่บังคับ)"
                      />
                    </div>
                    {saveMsg && <p className="text-sm text-red-500 dark:text-red-400">{saveMsg}</p>}
                    <div className="flex gap-3 justify-end pt-1">
                      <button
                        type="button"
                        onClick={closeModal}
                        className="inline-flex items-center rounded-xl px-4 py-2 text-sm text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors cursor-pointer"
                      >
                        ยกเลิก
                      </button>
                      <button
                        type="submit"
                        disabled={saving}
                        className={cx(submitBtnCls, "!py-2 !px-5 !text-sm cursor-pointer disabled:cursor-not-allowed")}
                      >
                        {saving ? "กำลังบันทึก..." : "บันทึก"}
                      </button>
                    </div>
                  </form>
                </>
              )}
            </div>
          </div>
        </Portal>
      )}
    </div>
  )
}
