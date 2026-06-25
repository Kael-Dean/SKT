import { useEffect, useState } from "react"
import { apiAuth } from "../../../lib/api"
import Portal from "../../../components/Portal"
import SelectDropdown from "../../../components/SelectDropdown"
import ThaiDatePicker from "../../../components/ThaiDatePicker"
import {
  cx, baseField, labelCls, modalCardCls, modalTitleCls,
  submitBtnCls, secondaryBtnCls, resetBtnCls, cardCls,
  badgeCls,
} from "../../../lib/styles"
import { SkeletonTableRows, ErrorState, EmptyState } from "../../../components/ui"
import {
  findCurrentFiscalYear,
  getCurrentFiscalYearString,
  selectableAppliedFiscalYears,
  isDateInPastFiscalYear,
  isDateInCurrentFiscalYear,
  getFiscalYearStringForDate,
} from "../../../lib/debtFiscalYear"

// Column count for the transactions table — keep in sync with the header below.
const TX_COLS = 7

const ROLE = { ADMIN: 1, HA: 4, MKT: 5 }

const TX_TYPE_LABEL = {
  payment:   "รับชำระ",
  new_debt:  "เพิ่มในปี",
  old_debt:  "ยอดยกมา/หนี้เก่า",
  carryover: "ยอดยกมา (เดิม)", // legacy alias of old_debt — read-only history
}
const TX_TYPE_CLS   = {
  payment:   badgeCls + " bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300",
  new_debt:  badgeCls + " bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-300",
  old_debt:  badgeCls + " bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300",
  carryover: badgeCls + " bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300",
}
const PM_LABEL = { mobile_banking: "โอนเงิน", cash: "เงินสด", produce_trade: "ผลผลิต" }

const fmtMoney = (v) =>
  new Intl.NumberFormat("th-TH", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(parseFloat(v) || 0)

const sanitizeDecimal = (s) => {
  const clean = s.replace(/[^0-9.]/g, "")
  const parts = clean.split(".")
  return parts.length > 2 ? parts[0] + "." + parts.slice(1).join("") : clean
}

const todayISO = () => new Date().toISOString().split("T")[0]

const emptyPaymentForm = (appliedYearId = "") => ({
  branch_id: "", program_id: "", applied_fiscal_year_id: appliedYearId,
  payment_method: "cash", amount: "",
  produce_id: "", produce_weight: "", produce_value: "",
  transaction_date: todayISO(), note: "",
})

const emptyNewDebtForm = () => ({
  branch_id: "", program_id: "", amount: "",
  transaction_date: todayISO(), note: "",
})

// Old-debt (formerly "carryover"): no fiscal-year field — the server derives the
// past fiscal year from transaction_date.
const emptyOldDebtForm = () => ({
  branch_id: "", program_id: "", amount: "",
  transaction_date: "", note: "",
})

export default function DebtTransactionsTab({ roleId, branches, programs, fiscalYears }) {
  const canWrite  = [ROLE.ADMIN, ROLE.HA, ROLE.MKT].includes(roleId)
  const canManage = [ROLE.ADMIN, ROLE.HA].includes(roleId)

  const [transactions, setTransactions] = useState([])
  const [loading, setLoading]           = useState(false)
  const [error, setError]               = useState("")
  const [reloadKey, setReloadKey]       = useState(0)

  const [txTypeFilter, setTxTypeFilter] = useState("")
  const [dateFrom, setDateFrom]         = useState("")
  const [dateTo, setDateTo]             = useState("")

  const [modal, setModal]     = useState(null)
  const [form, setForm]       = useState(emptyPaymentForm())
  const [saving, setSaving]   = useState(false)
  const [saveMsg, setSaveMsg] = useState("")

  useEffect(() => {
    let alive = true
    setLoading(true)
    setError("")
    ;(async () => {
      try {
        const params = new URLSearchParams()
        if (txTypeFilter) params.set("transaction_type", txTypeFilter)
        if (dateFrom)     params.set("date_from", dateFrom)
        if (dateTo)       params.set("date_to", dateTo)
        const url = `/debt/transactions${params.toString() ? "?" + params.toString() : ""}`
        const data = await apiAuth(url)
        if (alive) setTransactions(Array.isArray(data) ? data.filter((r) => r.is_active !== false) : [])
      } catch (e) {
        if (alive) setError(e.message || "โหลดข้อมูลไม่สำเร็จ")
      } finally {
        if (alive) setLoading(false)
      }
    })()
    return () => { alive = false }
  }, [txTypeFilter, dateFrom, dateTo, reloadKey])

  async function refetchTransactions() {
    const params = new URLSearchParams()
    if (txTypeFilter) params.set("transaction_type", txTypeFilter)
    if (dateFrom)     params.set("date_from", dateFrom)
    if (dateTo)       params.set("date_to", dateTo)
    const url = `/debt/transactions${params.toString() ? "?" + params.toString() : ""}`
    const data = await apiAuth(url)
    setTransactions(Array.isArray(data) ? data.filter((r) => r.is_active !== false) : [])
  }

  function yearName(id)   { return fiscalYears?.find((y) => y.id === Number(id))?.year_name || String(id) }

  const pmOpts = [
    { value: "cash",          label: "เงินสด" },
    { value: "mobile_banking", label: "โอนเงิน" },
    { value: "produce_trade", label: "ชำระด้วยผลผลิต" },
  ]

  const txTypeOpts = [
    { value: "",          label: "ทั้งหมด" },
    { value: "old_debt",  label: "ยอดยกมา/หนี้เก่า" },
    { value: "new_debt",  label: "เพิ่มในปี" },
    { value: "payment",   label: "รับชำระ" },
  ]

  const branchModalOpts   = branches.map((b) => ({ value: String(b.id), label: b.name }))
  const programModalOpts  = programs
    .filter((p) => p.is_active !== false)
    .map((p) => ({ value: String(p.id), label: p.prog_name }))
  // Applied-year options for payments: never a future fiscal year (newest first).
  const appliedYearOpts = selectableAppliedFiscalYears(fiscalYears).map((y) => ({
    value: String(y.id),
    label: y.year_name,
  }))

  const currentFY = findCurrentFiscalYear(fiscalYears)
  const currentFYString = getCurrentFiscalYearString()

  function openAddPayment() {
    setForm(emptyPaymentForm(currentFY ? String(currentFY.id) : ""))
    setSaveMsg("")
    setModal({ mode: "add_payment" })
  }

  function openAddNewDebt() {
    setForm(emptyNewDebtForm())
    setSaveMsg("")
    setModal({ mode: "add_newdebt" })
  }

  function openAddOldDebt() {
    setForm(emptyOldDebtForm())
    setSaveMsg("")
    setModal({ mode: "add_olddebt" })
  }

  function openEdit(record) {
    setForm({
      branch_id: record.branch_id != null ? String(record.branch_id) : "",
      program_id: record.program_id != null ? String(record.program_id) : "",
      applied_fiscal_year_id: record.applied_fiscal_year_id != null ? String(record.applied_fiscal_year_id) : "",
      payment_method: record.payment_method || "cash",
      amount: record.amount,
      produce_id: record.produce_id != null ? String(record.produce_id) : "",
      produce_weight: record.produce_weight || "",
      produce_value: record.produce_value || "",
      transaction_date: record.transaction_date,
      note: record.note || "",
    })
    setSaveMsg("")
    setModal({ mode: "edit", record })
  }

  function openCancel(record) {
    setSaveMsg("")
    setModal({ mode: "cancel", record })
  }

  function closeModal() { setModal(null); setSaveMsg("") }

  const isProduce = form.payment_method === "produce_trade"

  async function handleSave() {
    setSaving(true); setSaveMsg("")
    try {
      if (modal.mode === "add_payment") {
        if (!form.branch_id)              { setSaveMsg("กรุณาเลือกสาขา"); setSaving(false); return }
        if (!form.program_id)             { setSaveMsg("กรุณาเลือกโปรแกรมหนี้"); setSaving(false); return }
        if (!form.applied_fiscal_year_id) { setSaveMsg("กรุณาเลือกปีที่ตัดชำระ"); setSaving(false); return }
        if (!form.transaction_date)       { setSaveMsg("กรุณาระบุวันที่"); setSaving(false); return }
        if (!isDateInCurrentFiscalYear(form.transaction_date)) {
          setSaveMsg(`วันที่ต้องอยู่ในปีการผลิตปัจจุบัน (${currentFYString})`); setSaving(false); return
        }
        if (isProduce) {
          if (!form.produce_id || !form.produce_weight || !form.produce_value) {
            setSaveMsg("กรุณากรอกข้อมูลผลผลิตให้ครบ"); setSaving(false); return
          }
        } else if (!form.amount || parseFloat(form.amount) <= 0) {
          setSaveMsg("กรุณากรอกจำนวนเงินที่ถูกต้อง"); setSaving(false); return
        }
        await apiAuth("/debt/transactions/payment", {
          method: "POST",
          body: {
            branch_id: Number(form.branch_id),
            program_id: Number(form.program_id),
            applied_fiscal_year_id: Number(form.applied_fiscal_year_id),
            payment_method: form.payment_method,
            amount: isProduce ? form.produce_value : form.amount,
            produce_id: isProduce ? Number(form.produce_id) : null,
            produce_weight: isProduce ? form.produce_weight : null,
            produce_value: isProduce ? form.produce_value : null,
            transaction_date: form.transaction_date,
            note: form.note.trim() || null,
          },
        })
      } else if (modal.mode === "add_newdebt") {
        if (!form.branch_id)                               { setSaveMsg("กรุณาเลือกสาขา"); setSaving(false); return }
        if (!form.program_id)                              { setSaveMsg("กรุณาเลือกโปรแกรมหนี้"); setSaving(false); return }
        if (!form.amount || parseFloat(form.amount) <= 0)  { setSaveMsg("กรุณากรอกจำนวนเงินที่ถูกต้อง"); setSaving(false); return }
        if (!form.transaction_date)                        { setSaveMsg("กรุณาระบุวันที่"); setSaving(false); return }
        if (!isDateInCurrentFiscalYear(form.transaction_date)) {
          setSaveMsg(`วันที่ต้องอยู่ในปีการผลิตปัจจุบัน (${currentFYString})`); setSaving(false); return
        }
        if (!currentFY) {
          setSaveMsg(`ไม่พบปีการผลิตปัจจุบัน (${currentFYString}) ใน productyear — ติดต่อผู้ดูแลระบบ`)
          setSaving(false); return
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
      } else if (modal.mode === "add_olddebt") {
        if (!form.branch_id)                               { setSaveMsg("กรุณาเลือกสาขา"); setSaving(false); return }
        if (!form.program_id)                              { setSaveMsg("กรุณาเลือกโปรแกรมหนี้"); setSaving(false); return }
        if (!form.amount || parseFloat(form.amount) <= 0)  { setSaveMsg("กรุณากรอกจำนวนเงินที่ถูกต้อง"); setSaving(false); return }
        if (!form.transaction_date)                        { setSaveMsg("กรุณาเลือกวันที่ (ปีอดีต)"); setSaving(false); return }
        if (!isDateInPastFiscalYear(form.transaction_date)) {
          setSaveMsg(`วันที่ต้องอยู่ในปีการผลิตอดีต — ปีปัจจุบันคือ ${currentFYString} (ใช้ “เพิ่มในปี” สำหรับปีปัจจุบัน)`)
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
      } else if (modal.mode === "edit") {
        await apiAuth(`/debt/transactions/${modal.record.id}`, {
          method: "PATCH",
          body: {
            payment_method: form.payment_method || null,
            amount: isProduce ? form.produce_value : (form.amount || null),
            produce_id: isProduce ? (Number(form.produce_id) || null) : null,
            produce_weight: isProduce ? (form.produce_weight || null) : null,
            produce_value: isProduce ? (form.produce_value || null) : null,
            transaction_date: form.transaction_date || null,
            note: form.note.trim() || null,
          },
        })
      }
      closeModal()
      await refetchTransactions()
    } catch (e) {
      setSaveMsg(e.message || "บันทึกไม่สำเร็จ")
    } finally {
      setSaving(false)
    }
  }

  async function handleCancel() {
    setSaving(true); setSaveMsg("")
    try {
      await apiAuth(`/debt/transactions/${modal.record.id}`, { method: "DELETE" })
      closeModal()
      setTransactions((prev) => prev.filter((r) => r.id !== modal.record.id))
    } catch (e) {
      setSaveMsg(e.message || "ยกเลิกไม่สำเร็จ")
    } finally {
      setSaving(false)
    }
  }

  // Editing a payment lets the user change method/amount/produce; new-debt and
  // old-debt edits only carry amount/date/note (no payment_method block).
  const editIsPayment = modal?.mode === "edit" && modal.record?.transaction_type === "payment"
  const showPaymentFields = modal?.mode === "add_payment" || editIsPayment

  return (
    <div className="space-y-4">
      {/* Filter bar */}
      <div className={cx(cardCls, "p-4")}>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <div>
            <label className="mb-1 block text-xs font-medium text-gray-500 dark:text-gray-400">ประเภท</label>
            <SelectDropdown
              options={txTypeOpts}
              value={txTypeFilter}
              onChange={setTxTypeFilter}
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-gray-500 dark:text-gray-400">วันที่เริ่ม</label>
            <input type="date" className={baseField} value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-gray-500 dark:text-gray-400">วันที่สิ้นสุด</label>
            <input type="date" className={baseField} value={dateTo} onChange={(e) => setDateTo(e.target.value)} />
          </div>
        </div>
        {(txTypeFilter || dateFrom || dateTo) && (
          <div className="mt-3 flex justify-end">
            <button
              onClick={() => { setTxTypeFilter(""); setDateFrom(""); setDateTo("") }}
              className="rounded-xl px-3 py-1.5 text-sm text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-700 cursor-pointer transition-colors"
            >
              ล้างตัวกรอง
            </button>
          </div>
        )}
      </div>

      <div className="flex items-center justify-between">
        <p className="text-sm text-gray-500 dark:text-gray-400">
          {loading ? "กำลังโหลด…" : `พบ ${transactions.length} รายการ`}
        </p>
        {canWrite && (
          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={openAddOldDebt}
              className={cx(
                "inline-flex items-center justify-center rounded-2xl border border-amber-300 bg-amber-50 px-4 py-2 text-sm font-semibold text-amber-700 cursor-pointer transition-all duration-200 hover:bg-amber-100 hover:scale-[1.02] active:scale-[.98] dark:border-amber-700/60 dark:bg-amber-900/20 dark:text-amber-300 dark:hover:bg-amber-900/40"
              )}
            >
              + บันทึกยอดยกมา/หนี้เก่า
            </button>
            <button onClick={openAddNewDebt} className={cx(resetBtnCls, "!py-2 !px-4 !text-sm")}>
              + บันทึกเพิ่มในปี
            </button>
            <button onClick={openAddPayment} className={cx(secondaryBtnCls, "!py-2 !px-4 !text-sm")}>
              + บันทึกรับชำระ
            </button>
          </div>
        )}
      </div>

      {error && !loading && (
        <ErrorState message={error} onRetry={() => setReloadKey((k) => k + 1)} />
      )}

      {!error && !loading && transactions.length === 0 ? (
        <div className={cx(cardCls, "overflow-hidden")}>
          <EmptyState
            title="ไม่พบรายการธุรกรรม"
            description={
              (txTypeFilter || dateFrom || dateTo)
                ? "ไม่มีธุรกรรมที่ตรงกับตัวกรอง — ลองล้างตัวกรองหรือเปลี่ยนช่วงวันที่"
                : "ยังไม่มีธุรกรรมหนี้ในระบบ — บันทึกยอดยกมา เพิ่มในปี หรือรับชำระเพื่อเริ่มต้น"
            }
            action={
              (txTypeFilter || dateFrom || dateTo) ? (
                <button
                  type="button"
                  onClick={() => { setTxTypeFilter(""); setDateFrom(""); setDateTo("") }}
                  className={cx(secondaryBtnCls, "!py-2 !px-4 !text-sm cursor-pointer")}
                >
                  ล้างตัวกรอง
                </button>
              ) : null
            }
          />
        </div>
      ) : !error ? (
        <div className={cx(cardCls, "overflow-hidden")}>
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/60">
                  {["วันที่", "ประเภท", "วิธีชำระ", "จำนวน (บาท)", "อ้างอิง", "หมายเหตุ", "จัดการ"].map((h) => (
                    <th key={h} className={cx("px-4 py-3 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide whitespace-nowrap", h === "จัดการ" ? "text-right" : "text-left")}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-700/60">
                {loading ? (
                  <SkeletonTableRows rows={6} cols={TX_COLS} />
                ) : (
                  transactions.map((tx) => (
                    <tr key={tx.id} className="hover:bg-gray-50 dark:hover:bg-gray-800/40 transition-colors">
                      <td className="px-4 py-3 text-gray-700 dark:text-gray-300 whitespace-nowrap">{tx.transaction_date}</td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <span className={TX_TYPE_CLS[tx.transaction_type] || (badgeCls + " bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300")}>
                          {TX_TYPE_LABEL[tx.transaction_type] || tx.transaction_type}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-gray-600 dark:text-gray-400 whitespace-nowrap">
                        {tx.payment_method ? (PM_LABEL[tx.payment_method] || tx.payment_method) : "—"}
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums font-semibold text-gray-900 dark:text-gray-100 whitespace-nowrap">
                        ฿{fmtMoney(tx.amount)}
                        {tx.payment_method === "produce_trade" && tx.produce_weight && (
                          <span className="block text-xs font-normal text-gray-400 dark:text-gray-500">({tx.produce_weight} กก.)</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-gray-500 dark:text-gray-400 whitespace-nowrap">
                        {tx.transaction_type === "payment" && tx.applied_fiscal_year_id != null
                          ? <>ตัดปี {yearName(tx.applied_fiscal_year_id)}</>
                          : <span className="text-gray-400 dark:text-gray-500">#{tx.debt_id}</span>}
                      </td>
                      <td className="px-4 py-3 text-gray-500 dark:text-gray-400 max-w-[160px] truncate">{tx.note || "—"}</td>
                      <td className="px-4 py-3 text-right">
                        {canManage && (
                          <div className="inline-flex items-center gap-2">
                            <button onClick={() => openEdit(tx)} className="rounded-lg px-3 py-1.5 text-xs font-medium text-indigo-600 hover:bg-indigo-50 dark:text-indigo-400 dark:hover:bg-indigo-900/20 transition-colors cursor-pointer">
                              แก้ไข
                            </button>
                            <button onClick={() => openCancel(tx)} className="rounded-lg px-3 py-1.5 text-xs font-medium text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-900/20 transition-colors cursor-pointer">
                              ยกเลิก
                            </button>
                          </div>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      ) : null}

      {/* Payment / Edit Modal */}
      {(modal?.mode === "add_payment" || modal?.mode === "edit") && (
        <Portal>
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
            <div className={cx(modalCardCls, "max-w-md w-full max-h-[90vh] overflow-y-auto")}>
              <h2 className={cx(modalTitleCls, "mb-5")}>
                {modal.mode === "add_payment" ? "บันทึกชำระหนี้" : "แก้ไขธุรกรรม"}
              </h2>
              <div className="space-y-4">
                {modal.mode === "add_payment" && (
                  <>
                    <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-2.5 text-sm text-emerald-700 dark:border-emerald-700/40 dark:bg-emerald-900/20 dark:text-emerald-300">
                      รับชำระตัดยอดของ <span className="font-bold">ปีปัจจุบัน</span> เสมอ — “ปีที่ตัดชำระ” เป็นเพียงป้ายอ้างอิงปีที่ตั้งใจชำระ
                    </div>
                    <div>
                      <label className={labelCls}>สาขา <span className="text-red-500">*</span></label>
                      <SelectDropdown
                        options={branchModalOpts}
                        value={form.branch_id}
                        onChange={(val) => setForm((f) => ({ ...f, branch_id: val }))}
                        placeholder="— เลือกสาขา —"
                      />
                    </div>
                    <div>
                      <label className={labelCls}>โปรแกรมหนี้ <span className="text-red-500">*</span></label>
                      <SelectDropdown
                        options={programModalOpts}
                        value={form.program_id}
                        onChange={(val) => setForm((f) => ({ ...f, program_id: val }))}
                        placeholder="— เลือกโปรแกรม —"
                      />
                    </div>
                    <div>
                      <label className={labelCls}>ปีที่ตัดชำระ (อ้างอิง) <span className="text-red-500">*</span></label>
                      <SelectDropdown
                        options={appliedYearOpts}
                        value={form.applied_fiscal_year_id}
                        onChange={(val) => setForm((f) => ({ ...f, applied_fiscal_year_id: val }))}
                        placeholder="— เลือกปี —"
                      />
                    </div>
                  </>
                )}
                <div>
                  <label className={labelCls}>วิธีชำระ <span className="text-red-500">*</span></label>
                  <SelectDropdown
                    options={pmOpts}
                    value={form.payment_method}
                    onChange={(val) => setForm((f) => ({ ...f, payment_method: val, produce_id: "", produce_weight: "", produce_value: "" }))}
                  />
                </div>
                {!isProduce && (
                  <div>
                    <label className={labelCls}>จำนวนเงิน (บาท) <span className="text-red-500">*</span></label>
                    <input className={baseField} inputMode="decimal" value={form.amount} onChange={(e) => setForm((f) => ({ ...f, amount: sanitizeDecimal(e.target.value) }))} placeholder="0.00" />
                  </div>
                )}
                {isProduce && (
                  <>
                    <div>
                      <label className={labelCls}>รหัสผลผลิต <span className="text-red-500">*</span></label>
                      <input className={baseField} inputMode="numeric" value={form.produce_id} onChange={(e) => setForm((f) => ({ ...f, produce_id: e.target.value.replace(/\D/g, "") }))} placeholder="เช่น 1" />
                    </div>
                    <div>
                      <label className={labelCls}>น้ำหนัก (กก.) <span className="text-red-500">*</span></label>
                      <input className={baseField} inputMode="decimal" value={form.produce_weight} onChange={(e) => setForm((f) => ({ ...f, produce_weight: sanitizeDecimal(e.target.value) }))} placeholder="0.000" />
                    </div>
                    <div>
                      <label className={labelCls}>มูลค่าผลผลิต (บาท) <span className="text-red-500">*</span></label>
                      <input className={baseField} inputMode="decimal" value={form.produce_value} onChange={(e) => setForm((f) => ({ ...f, produce_value: sanitizeDecimal(e.target.value) }))} placeholder="0.00" />
                      <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">มูลค่าผลผลิตจะถูกใช้เป็นยอดชำระจริง</p>
                    </div>
                  </>
                )}
                <div>
                  <label className={labelCls}>วันที่ <span className="text-red-500">*</span></label>
                  <ThaiDatePicker className={baseField} value={form.transaction_date} onChange={(val) => setForm((f) => ({ ...f, transaction_date: val }))} />
                  {showPaymentFields && (
                    <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">ต้องอยู่ในปีการผลิตปัจจุบัน ({currentFYString})</p>
                  )}
                </div>
                <div>
                  <label className={labelCls}>หมายเหตุ</label>
                  <textarea className={cx(baseField, "resize-none")} rows={2} value={form.note} onChange={(e) => setForm((f) => ({ ...f, note: e.target.value }))} placeholder="หมายเหตุ (ไม่จำเป็น)" />
                </div>
              </div>
              {saveMsg && <p className="mt-3 text-sm text-red-500 dark:text-red-400">{saveMsg}</p>}
              <div className="mt-6 flex justify-end gap-3">
                <button onClick={closeModal} className={resetBtnCls} disabled={saving}>ยกเลิก</button>
                <button onClick={handleSave} className={submitBtnCls} disabled={saving}>
                  {saving ? "กำลังบันทึก…" : "บันทึก"}
                </button>
              </div>
            </div>
          </div>
        </Portal>
      )}

      {/* New Debt Modal */}
      {modal?.mode === "add_newdebt" && (
        <Portal>
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
            <div className={cx(modalCardCls, "max-w-md w-full max-h-[90vh] overflow-y-auto")}>
              <h2 className={cx(modalTitleCls, "mb-3")}>บันทึกหนี้เพิ่มในปี</h2>
              <div className={cx(
                "mb-4 rounded-xl border px-4 py-2.5 text-sm",
                currentFY
                  ? "border-indigo-200 bg-indigo-50 text-indigo-700 dark:border-indigo-700/40 dark:bg-indigo-900/20 dark:text-indigo-300"
                  : "border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-700/40 dark:bg-rose-900/20 dark:text-rose-300"
              )}>
                {currentFY
                  ? <>ปีการผลิตปัจจุบัน: <span className="font-bold">{currentFY.year_name}</span> (ระบบตัดปีจากวันที่จริง)</>
                  : <>ไม่พบปีการผลิต <span className="font-bold">{currentFYString}</span> ในระบบ — โปรดให้ผู้ดูแลเพิ่มปีก่อน</>
                }
              </div>
              <div className="space-y-4">
                <div>
                  <label className={labelCls}>สาขา <span className="text-red-500">*</span></label>
                  <SelectDropdown
                    options={branchModalOpts}
                    value={form.branch_id}
                    onChange={(val) => setForm((f) => ({ ...f, branch_id: val }))}
                    placeholder="— เลือกสาขา —"
                  />
                </div>
                <div>
                  <label className={labelCls}>โปรแกรมหนี้ <span className="text-red-500">*</span></label>
                  <SelectDropdown
                    options={programModalOpts}
                    value={form.program_id}
                    onChange={(val) => setForm((f) => ({ ...f, program_id: val }))}
                    placeholder="— เลือกโปรแกรม —"
                  />
                </div>
                <div>
                  <label className={labelCls}>จำนวนเงิน (บาท) <span className="text-red-500">*</span></label>
                  <input className={baseField} inputMode="decimal" value={form.amount} onChange={(e) => setForm((f) => ({ ...f, amount: sanitizeDecimal(e.target.value) }))} placeholder="0.00" />
                </div>
                <div>
                  <label className={labelCls}>วันที่บันทึก <span className="text-red-500">*</span></label>
                  <ThaiDatePicker className={baseField} value={form.transaction_date} onChange={(val) => setForm((f) => ({ ...f, transaction_date: val }))} />
                  <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">ต้องอยู่ในปีการผลิตปัจจุบัน ({currentFYString})</p>
                </div>
                <div>
                  <label className={labelCls}>หมายเหตุ</label>
                  <textarea className={cx(baseField, "resize-none")} rows={2} value={form.note} onChange={(e) => setForm((f) => ({ ...f, note: e.target.value }))} placeholder="หมายเหตุ (ไม่จำเป็น)" />
                </div>
              </div>
              {saveMsg && <p className="mt-3 text-sm text-red-500 dark:text-red-400">{saveMsg}</p>}
              <div className="mt-6 flex justify-end gap-3">
                <button onClick={closeModal} className={resetBtnCls} disabled={saving}>ยกเลิก</button>
                <button onClick={handleSave} className={submitBtnCls} disabled={saving || !currentFY}>
                  {saving ? "กำลังบันทึก…" : "บันทึก"}
                </button>
              </div>
            </div>
          </div>
        </Portal>
      )}

      {/* Old-debt Modal */}
      {modal?.mode === "add_olddebt" && (
        <Portal>
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
            <div className={cx(modalCardCls, "max-w-md w-full max-h-[90vh] overflow-y-auto")}>
              <h2 className={cx(modalTitleCls, "mb-3")}>บันทึกยอดยกมา / หนี้เก่า</h2>
              <div className="mb-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-2.5 text-sm text-amber-700 dark:border-amber-700/40 dark:bg-amber-900/20 dark:text-amber-300">
                หนี้เก่าของ <span className="font-bold">ปีอดีต</span> เท่านั้น — ระบบจะตัดปีจากวันที่ที่เลือกให้อัตโนมัติ แล้วยอดจะไหล (waterfall) มารวมเป็นยอดยกมาของปีปัจจุบัน
              </div>
              <div className="space-y-4">
                <div>
                  <label className={labelCls}>สาขา <span className="text-red-500">*</span></label>
                  <SelectDropdown
                    options={branchModalOpts}
                    value={form.branch_id}
                    onChange={(val) => setForm((f) => ({ ...f, branch_id: val }))}
                    placeholder="— เลือกสาขา —"
                  />
                </div>
                <div>
                  <label className={labelCls}>โปรแกรมหนี้ <span className="text-red-500">*</span></label>
                  <SelectDropdown
                    options={programModalOpts}
                    value={form.program_id}
                    onChange={(val) => setForm((f) => ({ ...f, program_id: val }))}
                    placeholder="— เลือกโปรแกรม —"
                  />
                </div>
                <div>
                  <label className={labelCls}>จำนวนเงิน (บาท) <span className="text-red-500">*</span></label>
                  <input className={baseField} inputMode="decimal" value={form.amount} onChange={(e) => setForm((f) => ({ ...f, amount: sanitizeDecimal(e.target.value) }))} placeholder="0.00" />
                </div>
                <div>
                  <label className={labelCls}>วันที่ (ปีอดีต) <span className="text-red-500">*</span></label>
                  <ThaiDatePicker className={baseField} value={form.transaction_date} onChange={(val) => setForm((f) => ({ ...f, transaction_date: val }))} />
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
                  <textarea className={cx(baseField, "resize-none")} rows={2} value={form.note} onChange={(e) => setForm((f) => ({ ...f, note: e.target.value }))} placeholder="หมายเหตุ (ไม่จำเป็น)" />
                </div>
              </div>
              {saveMsg && <p className="mt-3 text-sm text-red-500 dark:text-red-400">{saveMsg}</p>}
              <div className="mt-6 flex justify-end gap-3">
                <button onClick={closeModal} className={resetBtnCls} disabled={saving}>ยกเลิก</button>
                <button onClick={handleSave} className={submitBtnCls} disabled={saving}>
                  {saving ? "กำลังบันทึก…" : "บันทึก"}
                </button>
              </div>
            </div>
          </div>
        </Portal>
      )}

      {/* Cancel Confirm Modal */}
      {modal?.mode === "cancel" && (
        <Portal>
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
            <div className={cx(modalCardCls, "max-w-sm w-full")}>
              <h2 className={cx(modalTitleCls, "mb-2")}>ยืนยันยกเลิกธุรกรรม</h2>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                ต้องการยกเลิกธุรกรรม{" "}
                <span className={TX_TYPE_CLS[modal.record.transaction_type]}>
                  {TX_TYPE_LABEL[modal.record.transaction_type] || modal.record.transaction_type}
                </span>{" "}
                จำนวน <span className="font-semibold text-gray-900 dark:text-gray-100">฿{fmtMoney(modal.record.amount)}</span> ใช่หรือไม่?
              </p>
              <p className="mt-2 text-xs text-amber-600 dark:text-amber-400">ยอดในรายงานจะถูกคำนวณใหม่อัตโนมัติ</p>
              {saveMsg && <p className="mt-3 text-sm text-red-500 dark:text-red-400">{saveMsg}</p>}
              <div className="mt-6 flex justify-end gap-3">
                <button onClick={closeModal} className={resetBtnCls} disabled={saving}>ปิด</button>
                <button
                  onClick={handleCancel}
                  disabled={saving}
                  className="inline-flex items-center justify-center gap-2 rounded-2xl bg-red-600 px-6 py-3 text-base font-semibold text-white shadow-sm cursor-pointer hover:bg-red-700 disabled:opacity-60 disabled:cursor-not-allowed transition-all duration-200"
                >
                  {saving ? "กำลังยกเลิก…" : "ยืนยันยกเลิก"}
                </button>
              </div>
            </div>
          </div>
        </Portal>
      )}
    </div>
  )
}
