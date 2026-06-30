import { useEffect, useState } from "react"
import { apiAuth } from "../../../lib/api"
import Portal from "../../../components/Portal"
import SelectDropdown from "../../../components/SelectDropdown"
import {
  cx, cardCls, pageTitleCls, labelCls, baseField,
  submitBtnCls, secondaryBtnCls, modalCardCls, modalTitleCls,
} from "../../../lib/styles"
import { PageLoader, ErrorState } from "../../../components/ui"
import { getRoleId } from "../../../lib/auth"
import { canManagePrograms } from "../debt/debtEntryMeta"
import BranchDebtTable from "./BranchDebtTable"
import AllBranchesTable from "./AllBranchesTable"

/** Line-art building icon — branch / per-unit debt entry card. */
function BranchIcon() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="size-7"
    >
      <path d="M3 21h18" />
      <path d="M5 21V7l8-4v18" />
      <path d="M19 21V11l-6-4" />
      <path d="M9 9v.01M9 12v.01M9 15v.01M9 18v.01" />
    </svg>
  )
}

/** Line-art layered-stack icon — all-branches aggregated debt card. */
function AllBranchesIcon() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="size-7"
    >
      <path d="M12 2 2 7l10 5 10-5-10-5Z" />
      <path d="m2 17 10 5 10-5" />
      <path d="m2 12 10 5 10-5" />
    </svg>
  )
}

export default function DebtReport() {
  const canAddProgram = canManagePrograms(getRoleId())
  const [view, setView]                   = useState(null)
  const [programs, setPrograms]           = useState([])
  const [fiscalYears, setFiscalYears]     = useState([])
  const [branches, setBranches]           = useState([])
  const [loadingRefs, setLoadingRefs]     = useState(true)
  const [errorRefs, setErrorRefs]         = useState("")
  const [modal, setModal]                 = useState(null)
  const [progForm, setProgForm]           = useState({ prog_name: "", description: "" })
  const [saving, setSaving]               = useState(false)
  const [saveMsg, setSaveMsg]             = useState("")

  // Only reference data is loaded here; the actual debt figures are derived
  // server-side and fetched per view from GET /debt/report (v4 waterfall).
  async function fetchAll() {
    setLoadingRefs(true)
    setErrorRefs("")
    const [branchesRes, yearsRes, progsRes] = await Promise.allSettled([
      apiAuth("/debt/lookup/branches"),
      apiAuth("/debt/lookup/fiscal-years"),
      apiAuth("/debt/programs"),
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

    const errors = [branchesRes, yearsRes, progsRes]
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
    } catch {
      // Silent: a failed background refresh keeps the last good program list.
    }
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
      <div className="py-2">
        <PageLoader variant="cards" rows={2} message="กำลังโหลดข้อมูลหนี้…" />
      </div>
    )
  }

  if (view === "branch") {
    return (
      <BranchDebtTable
        programs={programs}
        fiscalYears={fiscalYears}
        branches={branches}
        onBack={() => setView(null)}
      />
    )
  }

  if (view === "all") {
    return (
      <AllBranchesTable
        programs={programs}
        fiscalYears={fiscalYears}
        onBack={() => setView(null)}
      />
    )
  }

  return (
    <div className="mx-auto max-w-7xl space-y-5 py-2">
      <div className="flex items-start justify-between">
        <div>
          <h1 className={pageTitleCls}>ตารางหนี้</h1>
          <p className="mt-0.5 text-sm text-gray-500 dark:text-gray-400">
            บันทึกและดูข้อมูลหนี้คงค้างรายสาขา
          </p>
        </div>
        {canAddProgram && (
          <button
            onClick={openAddProgram}
            className={cx(secondaryBtnCls, "!py-2 !px-4 !text-sm cursor-pointer")}
          >
            + เพิ่มโครงการ
          </button>
        )}
      </div>

      {errorRefs && (
        <ErrorState
          message={`โหลดข้อมูลบางส่วนไม่สำเร็จ: ${errorRefs}`}
          onRetry={fetchAll}
        />
      )}

      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
        <button
          type="button"
          onClick={() => setView("branch")}
          className={cx(
            cardCls,
            "group p-8 text-left transition-all duration-150 cursor-pointer",
            "hover:ring-2 hover:ring-indigo-400 dark:hover:ring-indigo-500",
            "focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-gray-900"
          )}
        >
          <span className="mb-3 inline-flex size-12 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600 dark:bg-indigo-900/30 dark:text-indigo-300">
            <BranchIcon />
          </span>
          <h2 className="text-lg font-bold text-gray-900 dark:text-gray-100">ตารางหนี้แยกสาขา</h2>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            ดูและกรอกข้อมูลหนี้แยกตามหน่วยงาน
          </p>
        </button>
        <button
          type="button"
          onClick={() => setView("all")}
          className={cx(
            cardCls,
            "group p-8 text-left transition-all duration-150 cursor-pointer",
            "hover:ring-2 hover:ring-indigo-400 dark:hover:ring-indigo-500",
            "focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-gray-900"
          )}
        >
          <span className="mb-3 inline-flex size-12 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600 dark:bg-indigo-900/30 dark:text-indigo-300">
            <AllBranchesIcon />
          </span>
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
