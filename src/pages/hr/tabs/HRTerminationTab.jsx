// src/pages/hr/tabs/HRTerminationTab.jsx
// 13E — Termination Settlement: ค้นหาพนักงาน → GET prefill → POST/PATCH → PDF
import { useState, useCallback } from "react"
import { apiAuth, apiDownload } from "../../../lib/api"
import Portal from "../../../components/Portal"
import { ErrorState, EmptyState } from "../../../components/ui"

const EXIT_TYPES = [
  { value: "resign",  label: "ลาออก" },
  { value: "dismiss", label: "ไล่ออก" },
  { value: "retire",  label: "เกษียณอายุ" },
]

function fmt(n) {
  if (n == null || n === "") return "—"
  return Number(n).toLocaleString("th-TH", { minimumFractionDigits: 2 }) + " บาท"
}

function fmtNum(n) {
  if (n == null) return "—"
  return Number(n).toLocaleString("th-TH")
}

const inputCls = "w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-3 py-2 text-sm text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-indigo-500/60"

export default function HRTerminationTab() {
  const [searchInput, setSearchInput]   = useState("")
  const [employees,   setEmployees]     = useState([])
  const [searching,   setSearching]     = useState(false)
  const [searchErr,   setSearchErr]     = useState("")

  const [selectedEmp, setSelectedEmp]   = useState(null)
  const [record,      setRecord]        = useState(null)
  const [loadingRec,  setLoadingRec]    = useState(false)
  const [recErr,      setRecErr]        = useState("")

  const [form, setForm] = useState({})
  const [saving,    setSaving]    = useState(false)
  const [saveMsg,   setSaveMsg]   = useState(null) // { ok: boolean, text: string } | null

  const [pdfLoading, setPdfLoading] = useState(false)
  const [pdfErr,     setPdfErr]     = useState("")

  const [confirmModal, setConfirmModal] = useState(false)

  // ─── 1. ค้นหาพนักงาน ────────────────────────────────────────────
  const handleSearch = useCallback(async () => {
    const q = searchInput.trim()
    if (!q) return
    setSearching(true)
    setSearchErr("")
    setEmployees([])
    setSelectedEmp(null)
    setRecord(null)
    try {
      const data = await apiAuth(`/hr/users?search=${encodeURIComponent(q)}&is_active=true`)
      setEmployees(Array.isArray(data) ? data : (data.items ?? []))
    } catch (e) {
      setSearchErr(e.message || "ค้นหาไม่สำเร็จ")
    } finally {
      setSearching(false)
    }
  }, [searchInput])

  // ─── 2. โหลด termination record ────────────────────────────────
  const loadRecord = useCallback(async (emp) => {
    setSelectedEmp(emp)
    setRecord(null)
    setRecErr("")
    setForm({})
    setSaveMsg(null)
    setPdfErr("")
    setLoadingRec(true)
    try {
      const data = await apiAuth(`/hr/employees/${emp.id}/termination-record`)
      setRecord(data)
      // ถ้า record มีอยู่แล้ว (id != null) ให้ prefill ฟอร์มจาก record
      if (data.id != null) {
        setForm({
          exit_type:              data.exit_type ?? "",
          exit_date:              data.exit_date ?? "",
          committee_set_no:       data.committee_set_no ?? "",
          committee_meeting_no:   data.committee_meeting_no ?? "",
          committee_meeting_date: data.committee_meeting_date ?? "",
          severance_pay:          data.severance_pay ?? "",
          accumulated_fund:       data.accumulated_fund ?? "",
          work_guarantee_bond:    data.work_guarantee_bond ?? "",
          loan_outstanding:       data.loan_outstanding ?? "",
          loan_interest_estimate: data.loan_interest_estimate ?? "",
          bank_guarantee_ref:     data.bank_guarantee_ref ?? "",
          bank_guarantee_date:    data.bank_guarantee_date ?? "",
          bank_guarantee_amount:  data.bank_guarantee_amount ?? "",
        })
      } else {
        setForm({
          exit_type: "",
          exit_date: data.exit_date ?? "",
          committee_set_no: "",
          committee_meeting_no: "",
          committee_meeting_date: "",
          severance_pay: "",
          accumulated_fund: "",
          work_guarantee_bond: "",
          loan_outstanding: "",
          loan_interest_estimate: "",
          bank_guarantee_ref: "",
          bank_guarantee_date: "",
          bank_guarantee_amount: "",
        })
      }
    } catch (e) {
      setRecErr(e.message || "โหลดข้อมูลไม่สำเร็จ")
    } finally {
      setLoadingRec(false)
    }
  }, [])

  const setField = (k, v) => setForm((f) => ({ ...f, [k]: v }))

  // ─── 3. บันทึก (POST หรือ PATCH) ────────────────────────────────
  const handleSave = async () => {
    if (!selectedEmp || !record) return
    if (!form.exit_type) { setSaveMsg({ ok: false, text: "กรุณาเลือกประเภทการออก" }); return }
    if (!form.exit_date)  { setSaveMsg({ ok: false, text: "กรุณาระบุวันที่ออก" }); return }

    const isNew = record.id == null
    if (isNew) { setConfirmModal(true); return }

    // PATCH
    setSaving(true)
    setSaveMsg(null)
    try {
      await apiAuth(`/hr/employees/${selectedEmp.id}/termination-record`, {
        method: "PATCH",
        body: form,
      })
      setSaveMsg({ ok: true, text: "บันทึกสำเร็จ" })
      await loadRecord(selectedEmp)
    } catch (e) {
      setSaveMsg({ ok: false, text: e.message || "บันทึกไม่สำเร็จ" })
    } finally {
      setSaving(false)
    }
  }

  // ─── POST (ใหม่) หลังยืนยัน ─────────────────────────────────────
  const handleConfirmPost = async () => {
    setConfirmModal(false)
    setSaving(true)
    setSaveMsg(null)
    try {
      await apiAuth(`/hr/employees/${selectedEmp.id}/termination-record`, {
        method: "POST",
        body: form,
      })
      setSaveMsg({ ok: true, text: "บันทึกสำเร็จ — พนักงานถูก deactivate แล้ว" })
      await loadRecord(selectedEmp)
    } catch (e) {
      setSaveMsg({ ok: false, text: e.message || "บันทึกไม่สำเร็จ" })
    } finally {
      setSaving(false)
    }
  }

  // ─── 4. ดาวน์โหลด PDF ───────────────────────────────────────────
  const handleDownloadPdf = async () => {
    if (!selectedEmp || !record?.id) return
    setPdfLoading(true)
    setPdfErr("")
    try {
      const { blob, filename } = await apiDownload(`/hr/employees/${selectedEmp.id}/termination-record/pdf`)
      const url = URL.createObjectURL(blob)
      const a   = document.createElement("a")
      a.href     = url
      a.download = filename || `termination_${record.id}.pdf`
      a.click()
      URL.revokeObjectURL(url)
    } catch (e) {
      setPdfErr(e.message || "ดาวน์โหลดไม่สำเร็จ")
    } finally {
      setPdfLoading(false)
    }
  }

  const isNew = record?.id == null

  return (
    <div className="space-y-4">
      {/* ─── ค้นหาพนักงาน ─── */}
      <div className="rounded-2xl bg-white dark:bg-gray-800 ring-1 ring-gray-200/70 dark:ring-gray-700/70 shadow-sm p-4 space-y-3">
        <h3 className="flex items-center gap-1.5 text-sm font-semibold text-gray-700 dark:text-gray-300">
          <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="size-4 text-gray-400 dark:text-gray-500">
            <circle cx="11" cy="11" r="8" />
            <path d="m21 21-4.3-4.3" />
          </svg>
          ค้นหาพนักงาน
        </h3>
        <div className="flex gap-2">
          <input
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSearch()}
            placeholder="ชื่อ / นามสกุล / รหัสพนักงาน"
            aria-label="ค้นหาพนักงาน"
            className={inputCls + " flex-1"}
          />
          <button
            onClick={handleSearch}
            disabled={searching}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-semibold transition duration-200 disabled:opacity-60 cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-1 dark:focus-visible:ring-offset-gray-800"
          >
            {searching && <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white" aria-hidden="true" />}
            {searching ? "กำลังค้นหา..." : "ค้นหา"}
          </button>
        </div>
        {searchErr && <p role="alert" className="text-sm text-red-600 dark:text-red-400">{searchErr}</p>}
        {!searching && !searchErr && searchInput.trim() && employees.length === 0 && (
          <EmptyState
            className="py-8"
            title="ไม่พบพนักงาน"
            description="ลองค้นด้วยชื่อ นามสกุล หรือรหัสพนักงานอื่น"
          />
        )}
        {employees.length > 0 && (
          <div className="space-y-1 max-h-60 overflow-y-auto">
            {employees.map((emp) => (
              <button
                key={emp.id}
                onClick={() => loadRecord(emp)}
                aria-pressed={selectedEmp?.id === emp.id}
                className={`w-full text-left px-3 py-2 rounded-lg text-sm transition duration-150 cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 ${
                  selectedEmp?.id === emp.id
                    ? "bg-indigo-100 dark:bg-indigo-900/40 text-indigo-800 dark:text-indigo-200 font-semibold"
                    : "hover:bg-gray-50 dark:hover:bg-gray-700/50 text-gray-800 dark:text-gray-200"
                }`}
              >
                <span className="font-medium">{emp.first_name} {emp.last_name}</span>
                <span className="ml-2 text-gray-400 dark:text-gray-500 text-xs">{emp.branch_name}</span>
                {!emp.is_active && (
                  <span className="ml-2 rounded-full bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300 text-xs px-2 py-0.5">ไม่ active</span>
                )}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* ─── Loading record ─── */}
      {loadingRec && (
        <div role="status" aria-busy="true" className="flex items-center justify-center gap-3 py-8">
          <span className="h-7 w-7 animate-spin rounded-full border-2 border-gray-200 border-t-indigo-500 dark:border-gray-700 dark:border-t-indigo-400" aria-hidden="true" />
          <span className="text-sm text-slate-500 dark:text-slate-400">กำลังโหลดข้อมูลพนักงาน…</span>
        </div>
      )}
      {recErr && <ErrorState message={recErr} onRetry={selectedEmp ? () => loadRecord(selectedEmp) : undefined} />}

      {/* ─── ฟอร์ม ─── */}
      {record && selectedEmp && (
        <div className="rounded-2xl bg-white dark:bg-gray-800 ring-1 ring-gray-200/70 dark:ring-gray-700/70 shadow-sm p-4 space-y-4">
          {/* Header */}
          <div className="flex items-start justify-between gap-3 flex-wrap">
            <div>
              <h3 className="font-bold text-gray-900 dark:text-gray-100">
                {selectedEmp.first_name} {selectedEmp.last_name}
              </h3>
              <p className="text-xs text-gray-400 dark:text-gray-500">{selectedEmp.branch_name}</p>
            </div>
            <div className="flex gap-2 flex-wrap">
              {record.id != null && (
                <button
                  onClick={handleDownloadPdf}
                  disabled={pdfLoading}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-semibold transition duration-200 disabled:opacity-60 cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-rose-500 focus-visible:ring-offset-1 dark:focus-visible:ring-offset-gray-800"
                >
                  {pdfLoading ? (
                    <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-white/40 border-t-white" aria-hidden="true" />
                  ) : (
                    <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="size-3.5">
                      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                      <path d="M14 2v6h6" />
                    </svg>
                  )}
                  {pdfLoading ? "กำลังดาวน์โหลด..." : "ดาวน์โหลด PDF"}
                </button>
              )}
            </div>
          </div>
          {pdfErr && <p role="alert" className="text-xs text-red-600 dark:text-red-400">{pdfErr}</p>}

          {/* ข้อมูลคำนวณ (read-only) */}
          <div className="rounded-xl bg-indigo-50 dark:bg-indigo-900/20 p-3 space-y-2">
            <p className="text-xs font-semibold text-indigo-700 dark:text-indigo-300 uppercase tracking-wide mb-2">ข้อมูลคำนวณ (อัตโนมัติ)</p>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-sm">
              <div>
                <p className="text-xs text-gray-400 dark:text-gray-500">อายุงาน</p>
                <p className="font-medium text-gray-800 dark:text-gray-200 tabular-nums">
                  {record.tenure_years != null ? `${fmtNum(record.tenure_years)} ปี ${fmtNum(record.tenure_days)} วัน` : "—"}
                </p>
              </div>
              <div>
                <p className="text-xs text-gray-400 dark:text-gray-500">วันลาทั้งหมด</p>
                <p className="font-medium text-gray-800 dark:text-gray-200 tabular-nums">{record.total_leave_days ?? "—"}</p>
              </div>
              <div>
                <p className="text-xs text-gray-400 dark:text-gray-500">วันลาพักผ่อน</p>
                <p className="font-medium text-gray-800 dark:text-gray-200 tabular-nums">{record.total_annual_leave_days ?? "—"}</p>
              </div>
              <div>
                <p className="text-xs text-gray-400 dark:text-gray-500">เงินเดือนล่าสุด</p>
                <p className="font-semibold text-indigo-700 dark:text-indigo-300 tabular-nums">{fmt(record.last_salary)}</p>
              </div>
            </div>
          </div>

          {/* ─── กรอกข้อมูล ─── */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-medium text-gray-600 dark:text-gray-400 block mb-1">ประเภทการออก <span className="text-red-500">*</span></label>
              <select
                value={form.exit_type ?? ""}
                onChange={(e) => setField("exit_type", e.target.value)}
                className={inputCls}
              >
                <option value="">— เลือก —</option>
                {EXIT_TYPES.map((t) => (
                  <option key={t.value} value={t.value}>{t.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-xs font-medium text-gray-600 dark:text-gray-400 block mb-1">วันที่ออก <span className="text-red-500">*</span></label>
              <input type="date" value={form.exit_date ?? ""} onChange={(e) => setField("exit_date", e.target.value)} className={inputCls} />
            </div>
            <div>
              <label className="text-xs font-medium text-gray-600 dark:text-gray-400 block mb-1">ชุดที่คณะกรรมการ</label>
              <input type="number" value={form.committee_set_no ?? ""} onChange={(e) => setField("committee_set_no", e.target.value)} className={inputCls} />
            </div>
            <div>
              <label className="text-xs font-medium text-gray-600 dark:text-gray-400 block mb-1">ครั้งที่คณะกรรมการ</label>
              <input type="number" value={form.committee_meeting_no ?? ""} onChange={(e) => setField("committee_meeting_no", e.target.value)} className={inputCls} />
            </div>
            <div>
              <label className="text-xs font-medium text-gray-600 dark:text-gray-400 block mb-1">วันที่ประชุมคณะกรรมการ</label>
              <input type="date" value={form.committee_meeting_date ?? ""} onChange={(e) => setField("committee_meeting_date", e.target.value)} className={inputCls} />
            </div>
          </div>

          {/* การเงิน */}
          <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide pt-2 border-t border-gray-100 dark:border-gray-700">ข้อมูลการเงิน</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {[
              { key: "severance_pay",          label: "เงินชดเชย" },
              { key: "accumulated_fund",        label: "กองทุนสะสม" },
              { key: "work_guarantee_bond",     label: "เงินประกันการทำงาน" },
              { key: "loan_outstanding",        label: "เงินกู้คงเหลือ" },
              { key: "loan_interest_estimate",  label: "ดอกเบี้ยเงินกู้ประมาณ" },
              { key: "bank_guarantee_ref",      label: "อ้างอิงหนังสือค้ำ", type: "text" },
              { key: "bank_guarantee_date",     label: "วันที่หนังสือค้ำ", type: "date" },
              { key: "bank_guarantee_amount",   label: "วงเงินค้ำประกัน" },
            ].map(({ key, label, type = "number" }) => (
              <div key={key}>
                <label htmlFor={`term-${key}`} className="text-xs font-medium text-gray-600 dark:text-gray-400 block mb-1">{label}</label>
                <input
                  id={`term-${key}`}
                  type={type}
                  step={type === "number" ? "0.01" : undefined}
                  value={form[key] ?? ""}
                  onChange={(e) => setField(key, e.target.value)}
                  className={type === "text" ? inputCls : inputCls + " tabular-nums"}
                />
              </div>
            ))}
          </div>

          {saveMsg && (
            <p
              role="status"
              className={`text-sm text-center font-medium ${saveMsg.ok ? "text-emerald-600 dark:text-emerald-400" : "text-red-600 dark:text-red-400"}`}
            >
              {saveMsg.text}
            </p>
          )}

          <div className="flex gap-2 justify-end pt-2">
            {isNew ? (
              <button
                onClick={handleSave}
                disabled={saving}
                className="inline-flex items-center gap-2 px-5 py-2 rounded-xl bg-red-600 hover:bg-red-500 text-white text-sm font-semibold transition duration-200 disabled:opacity-60 cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-red-500 focus-visible:ring-offset-1 dark:focus-visible:ring-offset-gray-800"
              >
                {saving && <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white" aria-hidden="true" />}
                {saving ? "กำลังบันทึก..." : "บันทึกและออกจากงาน (POST)"}
              </button>
            ) : (
              <button
                onClick={handleSave}
                disabled={saving}
                className="inline-flex items-center gap-2 px-5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-semibold transition duration-200 disabled:opacity-60 cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-1 dark:focus-visible:ring-offset-gray-800"
              >
                {saving && <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white" aria-hidden="true" />}
                {saving ? "กำลังบันทึก..." : "แก้ไขข้อมูล (PATCH)"}
              </button>
            )}
          </div>

          {isNew && (
            <p className="flex items-start justify-center gap-1.5 text-xs text-center text-red-500 dark:text-red-400">
              <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="size-3.5 shrink-0 mt-0.5">
                <path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0Z" />
                <line x1="12" y1="9" x2="12" y2="13" />
                <line x1="12" y1="17" x2="12.01" y2="17" />
              </svg>
              <span>การบันทึกครั้งแรกจะ <strong>deactivate</strong> account พนักงานทันที — กระทำไม่ได้ย้อนกลับ</span>
            </p>
          )}
        </div>
      )}

      {/* ─── Confirm modal ─── */}
      {confirmModal && (
        <Portal>
          <div
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
            onClick={() => setConfirmModal(false)}
          >
            <div
              role="dialog"
              aria-modal="true"
              aria-labelledby="term-confirm-title"
              onClick={(e) => e.stopPropagation()}
              className="w-full max-w-sm rounded-2xl bg-white dark:bg-gray-800 shadow-2xl p-6 space-y-4"
            >
              <h3 id="term-confirm-title" className="flex items-center gap-2 text-lg font-bold text-red-600 dark:text-red-400">
                <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="size-5 shrink-0">
                  <path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0Z" />
                  <line x1="12" y1="9" x2="12" y2="13" />
                  <line x1="12" y1="17" x2="12.01" y2="17" />
                </svg>
                ยืนยันการออกจากงาน
              </h3>
              <p className="text-sm text-gray-700 dark:text-gray-300">
                การดำเนินการนี้จะ <strong>ปิดการใช้งาน account</strong> ของ{" "}
                <span className="font-bold text-gray-900 dark:text-gray-100">{selectedEmp?.first_name} {selectedEmp?.last_name}</span>{" "}
                ทันที และไม่สามารถย้อนกลับได้
              </p>
              <div className="flex gap-3">
                <button type="button" autoFocus onClick={() => setConfirmModal(false)} className="flex-1 h-10 rounded-xl border border-gray-300 dark:border-gray-600 text-sm font-semibold text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700 transition duration-200 cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-1 dark:focus-visible:ring-offset-gray-800">
                  ยกเลิก
                </button>
                <button type="button" onClick={handleConfirmPost} className="flex-1 h-10 rounded-xl bg-red-600 hover:bg-red-500 text-white text-sm font-semibold transition duration-200 cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-red-500 focus-visible:ring-offset-1 dark:focus-visible:ring-offset-gray-800">
                  ยืนยัน
                </button>
              </div>
            </div>
          </div>
        </Portal>
      )}
    </div>
  )
}
