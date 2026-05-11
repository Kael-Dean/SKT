import { useEffect, useState } from "react"
import { apiAuth } from "../../../lib/api"
import Portal from "../../../components/Portal"
import SelectDropdown from "../../../components/SelectDropdown"
import {
  cx, cardCls, pageTitleCls, labelCls, baseField,
  submitBtnCls, secondaryBtnCls, modalCardCls, modalTitleCls, pageSpinnerCls,
} from "../../../lib/styles"
import BranchDebtTable from "./BranchDebtTable"
import AllBranchesTable from "./AllBranchesTable"

export default function DebtReport() {
  const [view, setView]                   = useState(null)
  const [programs, setPrograms]           = useState([])
  const [fiscalYears, setFiscalYears]     = useState([])
  const [branches, setBranches]           = useState([])
  const [allTotals, setAllTotals]         = useState([])
  const [allTransactions, setAllTransactions] = useState([])
  const [loadingRefs, setLoadingRefs]     = useState(true)
  const [errorRefs, setErrorRefs]         = useState("")
  const [modal, setModal]                 = useState(null)
  const [progForm, setProgForm]           = useState({ prog_name: "", description: "" })
  const [saving, setSaving]               = useState(false)
  const [saveMsg, setSaveMsg]             = useState("")

  async function fetchAll() {
    setLoadingRefs(true)
    setErrorRefs("")
    const [branchesRes, yearsRes, progsRes, totalsRes, txRes] = await Promise.allSettled([
      apiAuth("/debt/lookup/branches"),
      apiAuth("/debt/lookup/fiscal-years"),
      apiAuth("/debt/programs"),
      apiAuth("/debt/totals"),
      apiAuth("/debt/transactions"),
    ])

    if (branchesRes.status === "fulfilled") {
      const rows = Array.isArray(branchesRes.value) ? branchesRes.value : []
      setBranches(
        rows
          .map((r) => ({ id: Number(r.id), name: r.branch_name || `สาขา ${r.id}` }))
          .filter((r) => r.id > 0)
      )
    }
    if (yearsRes.status === "fulfilled") {
      const rows = Array.isArray(yearsRes.value) ? yearsRes.value : []
      setFiscalYears(
        rows
          .map((r) => ({ id: Number(r.id), year_name: r.year || r.year_name || String(r.id) }))
          .filter((r) => r.id > 0)
      )
    }
    if (progsRes.status === "fulfilled") {
      setPrograms(Array.isArray(progsRes.value) ? progsRes.value : [])
    }
    if (totalsRes.status === "fulfilled") {
      setAllTotals(
        Array.isArray(totalsRes.value)
          ? totalsRes.value.filter((r) => r.is_active !== false)
          : []
      )
    }
    if (txRes.status === "fulfilled") {
      setAllTransactions(
        Array.isArray(txRes.value)
          ? txRes.value.filter((r) => r.is_active !== false)
          : []
      )
    }

    const errors = [branchesRes, yearsRes, progsRes, totalsRes, txRes]
      .filter((r) => r.status === "rejected")
      .map((r) => r.reason?.message || "โหลดข้อมูลไม่สำเร็จ")
    if (errors.length) setErrorRefs(errors[0])

    setLoadingRefs(false)
  }

  useEffect(() => {
    fetchAll()
  }, [])

  async function reloadPrograms() {
    try {
      const data = await apiAuth("/debt/programs")
      setPrograms(Array.isArray(data) ? data : [])
    } catch {}
  }

  async function reloadAll() {
    await fetchAll()
  }

  function openAddProgram() {
    setProgForm({ prog_name: "", description: "" })
    setSaveMsg("")
    setModal({ mode: "add_program" })
  }

  function closeModal() {
    setModal(null)
    setSaveMsg("")
  }

  async function handleAddProgram(e) {
    e.preventDefault()
    if (!progForm.prog_name.trim()) return
    setSaving(true)
    setSaveMsg("")
    try {
      await apiAuth("/debt/programs", {
        method: "POST",
        body: {
          prog_name: progForm.prog_name.trim(),
          description: progForm.description.trim() || null,
        },
      })
      closeModal()
      await reloadPrograms()
    } catch (err) {
      setSaveMsg(err.message || "บันทึกไม่สำเร็จ")
    } finally {
      setSaving(false)
    }
  }

  if (loadingRefs) {
    return (
      <div className="flex items-center justify-center py-24">
        <div className={pageSpinnerCls} />
      </div>
    )
  }

  if (view === "branch") {
    return (
      <BranchDebtTable
        programs={programs}
        fiscalYears={fiscalYears}
        branches={branches}
        allTotals={allTotals}
        allTransactions={allTransactions}
        onDataChanged={reloadAll}
        onBack={() => setView(null)}
      />
    )
  }

  if (view === "all") {
    return (
      <AllBranchesTable
        programs={programs}
        fiscalYears={fiscalYears}
        allTotals={allTotals}
        allTransactions={allTransactions}
        onBack={() => setView(null)}
      />
    )
  }

  return (
    <div className="space-y-5 py-2">
      <div className="flex items-start justify-between">
        <div>
          <h1 className={pageTitleCls}>ตารางหนี้</h1>
          <p className="mt-0.5 text-sm text-gray-500 dark:text-gray-400">
            บันทึกและดูข้อมูลหนี้คงค้างรายสาขา
          </p>
        </div>
        <button
          onClick={openAddProgram}
          className={cx(secondaryBtnCls, "!py-2 !px-4 !text-sm cursor-pointer")}
        >
          + เพิ่มโครงการ
        </button>
      </div>

      {errorRefs && (
        <div className="rounded-xl bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700 px-4 py-3 text-sm text-amber-700 dark:text-amber-300">
          {errorRefs}
        </div>
      )}

      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
        <button
          onClick={() => setView("branch")}
          className={cx(cardCls, "p-8 text-left hover:ring-2 hover:ring-indigo-400 transition-all cursor-pointer")}
        >
          <div className="text-4xl mb-3">🏢</div>
          <h2 className="text-lg font-bold text-gray-900 dark:text-gray-100">ตารางหนี้แยกสาขา</h2>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            ดูและกรอกข้อมูลหนี้แยกตามหน่วยงาน
          </p>
        </button>
        <button
          onClick={() => setView("all")}
          className={cx(cardCls, "p-8 text-left hover:ring-2 hover:ring-indigo-400 transition-all cursor-pointer")}
        >
          <div className="text-4xl mb-3">🏗️</div>
          <h2 className="text-lg font-bold text-gray-900 dark:text-gray-100">ตารางหนี้รวมทุกสาขา</h2>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            ดูข้อมูลหนี้รวมทุกหน่วยงานและโครงการ
          </p>
        </button>
      </div>

      {modal?.mode === "add_program" && (
        <Portal>
          <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4"
            onClick={(e) => { if (e.target === e.currentTarget) closeModal() }}
          >
            <div className={cx(modalCardCls, "max-w-md w-full")}>
              <h2 className={cx(modalTitleCls, "mb-4")}>เพิ่มโครงการ</h2>
              <form onSubmit={handleAddProgram} className="space-y-4">
                <div>
                  <label className={labelCls}>ชื่อโครงการ <span className="text-red-500">*</span></label>
                  <input
                    className={baseField}
                    value={progForm.prog_name}
                    onChange={(e) => setProgForm((f) => ({ ...f, prog_name: e.target.value }))}
                    placeholder="ชื่อโครงการ"
                    required
                  />
                </div>
                <div>
                  <label className={labelCls}>คำอธิบาย</label>
                  <textarea
                    className={cx(baseField, "resize-none")}
                    rows={2}
                    value={progForm.description}
                    onChange={(e) => setProgForm((f) => ({ ...f, description: e.target.value }))}
                    placeholder="คำอธิบาย (ไม่บังคับ)"
                  />
                </div>
                {saveMsg && (
                  <p className="text-sm text-red-500 dark:text-red-400">{saveMsg}</p>
                )}
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
                    disabled={saving || !progForm.prog_name.trim()}
                    className={cx(submitBtnCls, "!py-2 !px-5 !text-sm cursor-pointer disabled:cursor-not-allowed")}
                  >
                    {saving ? "กำลังบันทึก..." : "บันทึก"}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </Portal>
      )}
    </div>
  )
}
