import { useMemo, useRef, useState } from "react"
import { apiAuth } from "../../../lib/api"
import Portal from "../../../components/Portal"
import SelectDropdown from "../../../components/SelectDropdown"
import StickyTableScrollbar from "../../../components/StickyTableScrollbar"
import ThaiDatePicker from "../../../components/ThaiDatePicker"
import {
  cx, baseField, labelCls, submitBtnCls, secondaryBtnCls,
  modalCardCls, modalTitleCls,
} from "../../../lib/styles"
import {
  findCurrentFiscalYear,
  getCurrentFiscalYearString,
} from "../../../lib/debtFiscalYear"
import { printDebtTable } from "./printDebtTable"

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

function buildTxLookup(transactions) {
  const map = new Map()
  for (const tx of transactions) {
    if (!map.has(tx.debt_id)) {
      map.set(tx.debt_id, {
        new_debt_amount: 0,
        new_debt_count: 0,
        payments: {
          mobile_banking: { amount: 0, count: 0 },
          cash: { amount: 0, count: 0 },
          produce_trade: { amount: 0, count: 0 },
          total_amount: 0,
          total_count: 0,
        },
      })
    }
    const e = map.get(tx.debt_id)
    if (tx.transaction_type === "new_debt") {
      e.new_debt_amount += parseFloat(tx.amount || 0)
      e.new_debt_count += 1
    } else if (tx.transaction_type === "payment") {
      const amt = parseFloat(
        tx.payment_method === "produce_trade"
          ? tx.produce_value || tx.amount || 0
          : tx.amount || 0
      )
      const pm = tx.payment_method || "cash"
      if (e.payments[pm]) {
        e.payments[pm].amount += amt
        e.payments[pm].count += 1
      }
      e.payments.total_amount += amt
      e.payments.total_count += 1
    }
  }
  return map
}

function buildTableRows(programs, fiscalYears, totals, txLookup) {
  return programs
    .filter((p) => p.is_active !== false)
    .map((prog) => ({
      program: prog,
      yearRows: fiscalYears.map((fy) => {
        const total = totals.find((t) => t.program_id === prog.id && t.fiscal_year_id === fy.id) || null
        const tx = total ? txLookup.get(total.id) || null : null
        const newDebtAmt = tx ? tx.new_debt_amount : 0
        // Per v2: carry_amount = original_amount - SUM(new_debt txns)
        // because BE upserts both new_debt AND carryover into original_amount
        const originalAmt = total ? parseFloat(total.original_amount || 0) : 0
        const carryAmt = Math.max(0, originalAmt - newDebtAmt)
        const remainAmt = total ? parseFloat(total.remaining_amount || 0) : 0
        return {
          fiscalYear: fy,
          total,
          carry_amount: carryAmt,
          carry_count: total && carryAmt > 0 ? 1 : 0,
          new_amount: newDebtAmt,
          new_count: tx ? tx.new_debt_count : 0,
          paid_amount: tx ? tx.payments.total_amount : 0,
          paid_count: tx ? tx.payments.total_count : 0,
          remain_amount: remainAmt,
          remain_count: remainAmt > 0 ? 1 : 0,
          mobile_amount: tx ? tx.payments.mobile_banking.amount : 0,
          mobile_count: tx ? tx.payments.mobile_banking.count : 0,
          cash_amount: tx ? tx.payments.cash.amount : 0,
          cash_count: tx ? tx.payments.cash.count : 0,
          produce_amount: tx ? tx.payments.produce_trade.amount : 0,
          produce_count: tx ? tx.payments.produce_trade.count : 0,
          note: total?.comment || "",
        }
      }),
    }))
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
  units,
  allTotals,
  allTransactions,
  onDataChanged,
  onBack,
}) {
  const [selectedUnitId, setSelectedUnitId] = useState("")
  const [modal, setModal]                   = useState(null)
  const [form, setForm]                     = useState({})
  const [saving, setSaving]                 = useState(false)
  const [saveMsg, setSaveMsg]               = useState("")
  const [produceTypes, setProduceTypes]     = useState([])

  const tableWrapRef = useRef(null)

  const unitTotals = useMemo(
    () => (selectedUnitId ? allTotals.filter((t) => t.unit_id === Number(selectedUnitId)) : allTotals),
    [allTotals, selectedUnitId]
  )
  const relevantDebtIds = useMemo(() => new Set(unitTotals.map((t) => t.id)), [unitTotals])
  const unitTransactions = useMemo(
    () => allTransactions.filter((tx) => relevantDebtIds.has(tx.debt_id)),
    [allTransactions, relevantDebtIds]
  )
  const txLookup = useMemo(() => buildTxLookup(unitTransactions), [unitTransactions])
  const tableRows = useMemo(
    () => buildTableRows(programs, fiscalYears, unitTotals, txLookup),
    [programs, fiscalYears, unitTotals, txLookup]
  )

  const colTotals = useMemo(() => {
    const all = tableRows.flatMap((g) => g.yearRows)
    return {
      carry_amount:   all.reduce((s, r) => s + r.carry_amount, 0),
      carry_count:    all.reduce((s, r) => s + r.carry_count, 0),
      new_amount:     all.reduce((s, r) => s + r.new_amount, 0),
      new_count:      all.reduce((s, r) => s + r.new_count, 0),
      paid_amount:    all.reduce((s, r) => s + r.paid_amount, 0),
      paid_count:     all.reduce((s, r) => s + r.paid_count, 0),
      remain_amount:  all.reduce((s, r) => s + r.remain_amount, 0),
      remain_count:   all.reduce((s, r) => s + r.remain_count, 0),
      mobile_amount:  all.reduce((s, r) => s + r.mobile_amount, 0),
      mobile_count:   all.reduce((s, r) => s + r.mobile_count, 0),
      cash_amount:    all.reduce((s, r) => s + r.cash_amount, 0),
      cash_count:     all.reduce((s, r) => s + r.cash_count, 0),
      produce_amount: all.reduce((s, r) => s + r.produce_amount, 0),
      produce_count:  all.reduce((s, r) => s + r.produce_count, 0),
    }
  }, [tableRows])

  function progName(id) {
    return programs.find((p) => p.id === Number(id))?.prog_name || `โปรแกรม ${id}`
  }
  function yearName(id) {
    return fiscalYears.find((y) => y.id === Number(id))?.year_name || String(id)
  }
  function unitName(id) {
    return units.find((u) => u.id === Number(id))?.name || `หน่วย ${id}`
  }

  function setF(key, val) {
    setForm((f) => ({ ...f, [key]: val }))
  }

  function closeModal() {
    setModal(null)
    setSaveMsg("")
    setForm({})
  }

  function openModal(mode, record = null) {
    setSaveMsg("")
    if (mode === "add_total") {
      setForm({
        unit_id: selectedUnitId,
        program_id: "",
        fiscal_year_id: "",
        original_amount: "",
        comment: "",
      })
    } else if (mode === "edit_total" && record) {
      setForm({
        original_amount: String(record.original_amount ?? ""),
        comment: record.comment || "",
      })
    } else if (mode === "add_payment") {
      setForm({
        debt_id: "",
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
        unit_id: selectedUnitId || "",
        program_id: "",
        amount: "",
        transaction_date: todayISO(),
        note: "",
      })
    } else if (mode === "add_carryover") {
      setForm({
        unit_id: selectedUnitId || "",
        program_id: "",
        fiscal_year_id: "",
        amount: "",
        transaction_date: todayISO(),
        note: "",
      })
    }
    setModal({ mode, record })
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setSaving(true)
    setSaveMsg("")
    try {
      if (modal.mode === "add_total") {
        await apiAuth("/debt/totals", {
          method: "POST",
          body: {
            unit_id: Number(form.unit_id),
            program_id: Number(form.program_id),
            fiscal_year_id: Number(form.fiscal_year_id),
            amount: form.original_amount,
            comment: form.comment.trim() || null,
          },
        })
      } else if (modal.mode === "edit_total" && modal.record) {
        await apiAuth(`/debt/totals/${modal.record.id}`, {
          method: "PATCH",
          body: {
            original_amount: form.original_amount,
            comment: form.comment.trim() || null,
          },
        })
      } else if (modal.mode === "add_payment") {
        await apiAuth("/debt/transactions/payment", {
          method: "POST",
          body: {
            debt_id: Number(form.debt_id),
            payment_method: form.payment_method,
            amount: form.payment_method === "produce_trade" ? form.produce_value : form.amount,
            transaction_date: form.transaction_date,
            note: form.note.trim() || null,
            produce_id: form.payment_method === "produce_trade" ? Number(form.produce_id) : null,
            produce_weight: form.payment_method === "produce_trade" ? form.produce_weight : null,
            produce_value: form.payment_method === "produce_trade" ? form.produce_value : null,
          },
        })
      } else if (modal.mode === "add_new_debt") {
        const currentFY = findCurrentFiscalYear(fiscalYears)
        if (!currentFY) {
          setSaveMsg(`ไม่พบปีงบประมาณปัจจุบัน (${getCurrentFiscalYearString()}) ในระบบ — ติดต่อผู้ดูแลให้เพิ่มปีก่อน`)
          setSaving(false)
          return
        }
        await apiAuth("/debt/transactions/new-debt", {
          method: "POST",
          body: {
            unit_id: Number(form.unit_id),
            program_id: Number(form.program_id),
            fiscal_year_id: currentFY.id,
            amount: form.amount,
            transaction_date: form.transaction_date,
            note: form.note.trim() || null,
          },
        })
      } else if (modal.mode === "add_carryover") {
        await apiAuth("/debt/transactions/carryover", {
          method: "POST",
          body: {
            unit_id: Number(form.unit_id),
            program_id: Number(form.program_id),
            fiscal_year_id: Number(form.fiscal_year_id),
            amount: form.amount,
            transaction_date: form.transaction_date,
            note: form.note.trim() || null,
          },
        })
      }
      closeModal()
      await onDataChanged()
    } catch (err) {
      setSaveMsg(err.message || "บันทึกไม่สำเร็จ")
    } finally {
      setSaving(false)
    }
  }

  const debtSelectOpts = (selectedUnitId ? unitTotals : allTotals).map((t) => ({
    value: String(t.id),
    label: `${progName(t.program_id)} — ปี ${yearName(t.fiscal_year_id)} (คงเหลือ: ฿${fmtMoney(t.remaining_amount)})`,
  }))

  const programOpts = programs
    .filter((p) => p.is_active !== false)
    .map((p) => ({ value: String(p.id), label: p.prog_name }))

  const yearOpts = fiscalYears.map((y) => ({
    value: String(y.id),
    label: y.year_name,
  }))

  const unitOpts = [
    { value: "", label: "ทุกหน่วยงาน" },
    ...units.map((u) => ({ value: String(u.id), label: u.name })),
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

  const unitModalOpts = units.map((u) => ({ value: String(u.id), label: u.name }))

  return (
    <div>
      <div className="flex flex-wrap items-center gap-3 mb-4">
        <button
          onClick={onBack}
          className="inline-flex items-center gap-1.5 rounded-xl px-3 py-2 text-sm text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors cursor-pointer"
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
            options={unitOpts}
            value={selectedUnitId}
            onChange={setSelectedUnitId}
            placeholder="— เลือกหน่วยงาน —"
          />
        </div>
        <button
          onClick={() => openModal("add_total")}
          className={cx(secondaryBtnCls, "!py-2 !px-4 !text-sm cursor-pointer")}
        >
          + บันทึกยอดหนี้
        </button>
        <button
          onClick={() => openModal("add_carryover")}
          className={cx(
            "inline-flex items-center justify-center rounded-2xl border border-amber-300 bg-amber-50 px-4 py-2 text-sm font-semibold text-amber-700 cursor-pointer transition-all duration-200 hover:bg-amber-100 hover:scale-[1.02] active:scale-[.98] dark:border-amber-700/60 dark:bg-amber-900/20 dark:text-amber-300 dark:hover:bg-amber-900/40"
          )}
        >
          + บันทึกยอดยกมา
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
              subtitle: selectedUnitId
                ? `หน่วยงาน: ${units.find((u) => u.id === Number(selectedUnitId))?.name || ""}`
                : "ทุกหน่วยงาน",
              tableRows,
              colTotals,
            })
          }
          className={cx(secondaryBtnCls, "!py-2 !px-4 !text-sm cursor-pointer")}
        >
          🖨️ พิมพ์ PDF
        </button>
      </div>

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
                <td
                  colSpan={18}
                  className={cx(
                    STRIPE.cell,
                    "px-4 py-12 text-center text-sm text-gray-400 dark:text-gray-500"
                  )}
                >
                  ไม่พบโครงการ — กลับไปเพิ่มโครงการที่หน้าเลือก
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
              {(modal.mode === "add_total" || modal.mode === "edit_total") && (
                <>
                  <h2 className={cx(modalTitleCls, "mb-4")}>
                    {modal.mode === "add_total" ? "บันทึกยอดหนี้" : "แก้ไขยอดหนี้"}
                  </h2>
                  <form onSubmit={handleSubmit} className="space-y-4">
                    {modal.mode === "add_total" ? (
                      <>
                        {selectedUnitId ? (
                          <div>
                            <label className={labelCls}>หน่วยงาน</label>
                            <p className="text-sm text-slate-700 dark:text-slate-300 mt-0.5">
                              {unitName(selectedUnitId)}
                            </p>
                          </div>
                        ) : (
                          <div>
                            <label className={labelCls}>หน่วยงาน <span className="text-red-500">*</span></label>
                            <SelectDropdown
                              options={unitModalOpts}
                              value={form.unit_id || ""}
                              onChange={(v) => setF("unit_id", v)}
                              placeholder="— เลือกหน่วยงาน —"
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
                          <label className={labelCls}>ปีงบประมาณ <span className="text-red-500">*</span></label>
                          <SelectDropdown
                            options={yearOpts}
                            value={form.fiscal_year_id || ""}
                            onChange={(v) => setF("fiscal_year_id", v)}
                            placeholder="— เลือกปีงบประมาณ —"
                          />
                        </div>
                      </>
                    ) : (
                      <div className="rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 p-3 text-sm space-y-1">
                        <p className="text-slate-500 dark:text-slate-400 text-xs">แก้ไขรายการ</p>
                        <p className="font-medium text-slate-800 dark:text-slate-200">
                          {progName(modal.record?.program_id)} — ปี {yearName(modal.record?.fiscal_year_id)}
                        </p>
                        <p className="text-slate-600 dark:text-slate-300">
                          {unitName(modal.record?.unit_id)}
                        </p>
                      </div>
                    )}
                    <div>
                      <label className={labelCls}>จำนวนเงิน (บาท) <span className="text-red-500">*</span></label>
                      <input
                        className={baseField}
                        value={form.original_amount || ""}
                        onChange={(e) => setF("original_amount", sanitizeDecimal(e.target.value))}
                        placeholder="0.00"
                        required
                      />
                    </div>
                    <div>
                      <label className={labelCls}>หมายเหตุ</label>
                      <textarea
                        className={cx(baseField, "resize-none")}
                        rows={2}
                        value={form.comment || ""}
                        onChange={(e) => setF("comment", e.target.value)}
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

              {modal.mode === "add_payment" && (
                <>
                  <h2 className={cx(modalTitleCls, "mb-4")}>บันทึกชำระหนี้</h2>
                  <form onSubmit={handleSubmit} className="space-y-4">
                    <div>
                      <label className={labelCls}>รายการหนี้ <span className="text-red-500">*</span></label>
                      <SelectDropdown
                        options={debtSelectOpts}
                        value={form.debt_id || ""}
                        onChange={(v) => setF("debt_id", v)}
                        placeholder="— เลือกรายการหนี้ —"
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
                          <label className={labelCls}>น้ำหนัก (กก.)</label>
                          <input
                            className={baseField}
                            value={form.produce_weight || ""}
                            onChange={(e) => setF("produce_weight", sanitizeDecimal(e.target.value))}
                            placeholder="0.00"
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
                        </div>
                      </>
                    )}
                    <div>
                      <label className={labelCls}>วันที่</label>
                      <ThaiDatePicker
                        className={baseField}
                        value={form.transaction_date || ""}
                        onChange={(val) => setF("transaction_date", val)}
                      />
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
                  {(() => {
                    const cy = findCurrentFiscalYear(fiscalYears)
                    return (
                      <div className={cx(
                        "mb-4 rounded-xl border px-4 py-2.5 text-sm",
                        cy
                          ? "bg-indigo-50 dark:bg-indigo-900/20 border-indigo-200 dark:border-indigo-700 text-indigo-700 dark:text-indigo-300"
                          : "bg-rose-50 dark:bg-rose-900/20 border-rose-200 dark:border-rose-700 text-rose-700 dark:text-rose-300"
                      )}>
                        {cy
                          ? <>บันทึกได้เฉพาะปีงบประมาณปัจจุบัน — <span className="font-bold">{cy.year_name}</span> (ระบบเช็คตามวันที่จริง)</>
                          : <>ไม่พบปีงบประมาณ <span className="font-bold">{getCurrentFiscalYearString()}</span> ในระบบ — โปรดให้ผู้ดูแลเพิ่มปีก่อน</>
                        }
                      </div>
                    )
                  })()}
                  <form onSubmit={handleSubmit} className="space-y-4">
                    {selectedUnitId ? (
                      <div>
                        <label className={labelCls}>หน่วยงาน</label>
                        <p className="text-sm text-slate-700 dark:text-slate-300 mt-0.5">
                          {unitName(selectedUnitId)}
                        </p>
                      </div>
                    ) : (
                      <div>
                        <label className={labelCls}>หน่วยงาน <span className="text-red-500">*</span></label>
                        <SelectDropdown
                          options={unitModalOpts}
                          value={form.unit_id || ""}
                          onChange={(v) => setF("unit_id", v)}
                          placeholder="— เลือกหน่วยงาน —"
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
                      <label className={labelCls}>วันที่</label>
                      <ThaiDatePicker
                        className={baseField}
                        value={form.transaction_date || ""}
                        onChange={(val) => setF("transaction_date", val)}
                      />
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
                        disabled={saving || !findCurrentFiscalYear(fiscalYears)}
                        className={cx(submitBtnCls, "!py-2 !px-5 !text-sm cursor-pointer disabled:cursor-not-allowed")}
                      >
                        {saving ? "กำลังบันทึก..." : "บันทึก"}
                      </button>
                    </div>
                  </form>
                </>
              )}

              {modal.mode === "add_carryover" && (
                <>
                  <h2 className={cx(modalTitleCls, "mb-4")}>บันทึกยอดยกมา</h2>
                  <div className="mb-4 rounded-xl bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700 px-4 py-2.5 text-sm text-amber-700 dark:text-amber-300">
                    ยอดค้างชำระยกมาจากปีก่อน — เลือกได้ทุกปีงบประมาณ
                  </div>
                  <form onSubmit={handleSubmit} className="space-y-4">
                    {selectedUnitId ? (
                      <div>
                        <label className={labelCls}>หน่วยงาน</label>
                        <p className="text-sm text-slate-700 dark:text-slate-300 mt-0.5">
                          {unitName(selectedUnitId)}
                        </p>
                      </div>
                    ) : (
                      <div>
                        <label className={labelCls}>หน่วยงาน <span className="text-red-500">*</span></label>
                        <SelectDropdown
                          options={unitModalOpts}
                          value={form.unit_id || ""}
                          onChange={(v) => setF("unit_id", v)}
                          placeholder="— เลือกหน่วยงาน —"
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
                      <label className={labelCls}>ปีงบประมาณ (ปีของหนี้ค้าง) <span className="text-red-500">*</span></label>
                      <SelectDropdown
                        options={yearOpts}
                        value={form.fiscal_year_id || ""}
                        onChange={(v) => setF("fiscal_year_id", v)}
                        placeholder="— เลือกปีงบประมาณ —"
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
                      <label className={labelCls}>วันที่บันทึก</label>
                      <ThaiDatePicker
                        className={baseField}
                        value={form.transaction_date || ""}
                        onChange={(val) => setF("transaction_date", val)}
                      />
                      <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">วันที่ทำรายการบันทึก ไม่ใช่ปีของหนี้</p>
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
