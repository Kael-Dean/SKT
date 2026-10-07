// src/components/hr/RelocationTransferModal.jsx
// 3E — ย้ายสาขาโดยตรง (HR/Admin บันทึกเอง ไม่ต้องมีคำขอจากพนักงาน)
// POST /hr/employees/{id}/relocations  body: {to_branch_id, effective_date?, reason, order_reference?, sub_unit?}
// → {relocation_id, from_branch_id, to_branch_id, effective_date, applied}
//
// props:
//   employee  — { id, name, branchId? } ถ้าส่งมา จะล็อกพนักงานไว้ (ใช้จากหน้าโปรไฟล์)
//               ถ้าไม่ส่ง จะมีช่องค้นหาพนักงาน (ใช้จากแท็บย้ายสาขา)
//   onClose() — ปิด modal
//   onDone(result) — เรียกหลังบันทึกสำเร็จ (ให้ parent refresh ข้อมูล)
import { useEffect, useMemo, useRef, useState } from "react"
import { apiAuth } from "../../lib/api"
import Portal from "../Portal"
import useModalDismiss from "../../lib/useModalDismiss"
import SelectDropdown from "../SelectDropdown"

const inputCls =
  "w-full rounded-xl border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-3 py-2 text-sm " +
  "text-gray-900 dark:text-gray-100 placeholder:text-gray-400 dark:placeholder:text-gray-500 " +
  "focus:outline-none focus:ring-2 focus:ring-indigo-500/40 focus:border-indigo-500 transition-colors duration-200"
const labelCls = "block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1"

function todayISO() {
  const d = new Date()
  const p = (n) => String(n).padStart(2, "0")
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`
}

// "YYYY-MM-DD" → "7 ตุลาคม 2569" (parse เป็น local date กัน timezone เลื่อนวัน)
function fmtThaiDateLong(iso) {
  if (!iso) return "—"
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(iso))
  const d = m ? new Date(+m[1], +m[2] - 1, +m[3]) : new Date(iso)
  if (Number.isNaN(d.getTime())) return String(iso)
  return d.toLocaleDateString("th-TH", { day: "numeric", month: "long", year: "numeric" })
}

export default function RelocationTransferModal({ employee = null, onClose, onDone }) {
  const locked = !!employee
  const dialogRef = useRef(null)

  // ─── Branches ───────────────────────────────────────────────
  const [branches, setBranches] = useState([])
  const [loadingBranches, setLoadingBranches] = useState(true)
  useEffect(() => {
    apiAuth("/order/branch/search")
      .then((data) => setBranches((Array.isArray(data) ? data : []).map((b) => ({ value: String(b.id), label: b.branch_name }))))
      .catch(() => setBranches([]))
      .finally(() => setLoadingBranches(false))
  }, [])
  const branchName = useMemo(() => {
    const m = new Map(branches.map((b) => [b.value, b.label]))
    return (id) => (id == null ? null : m.get(String(id)) ?? null)
  }, [branches])

  // ─── Employee search (เฉพาะกรณีไม่ได้ล็อกพนักงาน) ───────────
  const [query, setQuery] = useState("")
  const [people, setPeople] = useState([])
  const [searching, setSearching] = useState(false)
  const [searchError, setSearchError] = useState("")
  const [employeeId, setEmployeeId] = useState(locked ? String(employee.id) : "")

  useEffect(() => {
    if (locked) return
    let cancelled = false
    const t = setTimeout(() => {
      setSearching(true)
      setSearchError("")
      const params = new URLSearchParams({ is_active: "true" })
      if (query.trim()) params.set("name", query.trim())
      apiAuth(`/hr/personnel?${params.toString()}`)
        .then((data) => { if (!cancelled) setPeople(Array.isArray(data) ? data : []) })
        .catch((e) => { if (!cancelled) { setPeople([]); setSearchError(e.message || "ค้นหาพนักงานไม่สำเร็จ") } })
        .finally(() => { if (!cancelled) setSearching(false) })
    }, 300)
    return () => { cancelled = true; clearTimeout(t) }
  }, [query, locked])

  const selectedPerson = locked ? null : people.find((p) => String(p.id) === employeeId) ?? null
  const currentBranchId = locked ? employee.branchId : selectedPerson?.branch_location
  const employeeName = locked
    ? employee.name
    : selectedPerson ? `${selectedPerson.first_name ?? ""} ${selectedPerson.last_name ?? ""}`.trim() : ""

  const personOptions = useMemo(() => people.map((p) => ({
    value: String(p.id),
    label: `${p.first_name ?? ""} ${p.last_name ?? ""}`.trim() || `#${p.id}`,
    sublabel: branchName(p.branch_location) ?? undefined,
  })), [people, branchName])

  const branchOptions = useMemo(
    () => branches.filter((b) => currentBranchId == null || b.value !== String(currentBranchId)),
    [branches, currentBranchId],
  )

  // ─── Form ───────────────────────────────────────────────────
  const [toBranchId, setToBranchId] = useState("")
  const [effectiveDate, setEffectiveDate] = useState(todayISO())
  const [reason, setReason] = useState("")
  const [orderRef, setOrderRef] = useState("")
  const [subUnit, setSubUnit] = useState("")
  const [errors, setErrors] = useState({})
  const [submitting, setSubmitting] = useState(false)
  const [apiError, setApiError] = useState("")
  const [result, setResult] = useState(null) // { ...response, toName, employeeName }

  const isFuture = effectiveDate && effectiveDate > todayISO()

  // Esc / คลิกนอก modal ปิด (ไม่ปิดระหว่างบันทึก)
  const { backdropProps } = useModalDismiss(onClose, { disabled: submitting })

  useEffect(() => {
    const root = dialogRef.current
    const el = root?.querySelector("input, textarea, button[aria-haspopup]") ?? root?.querySelector("button")
    el?.focus()
  }, [result])

  const resetForNext = () => {
    setResult(null)
    setEmployeeId("")
    setToBranchId("")
    setEffectiveDate(todayISO())
    setReason("")
    setOrderRef("")
    setSubUnit("")
    setErrors({})
    setApiError("")
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    const errs = {}
    if (!employeeId) errs.employee = "เลือกพนักงานที่จะย้าย"
    if (!toBranchId) errs.branch = "เลือกสาขาปลายทาง"
    else if (currentBranchId != null && toBranchId === String(currentBranchId)) errs.branch = "สาขาปลายทางต้องไม่ใช่สาขาปัจจุบัน"
    if (!reason.trim()) errs.reason = "ระบุเหตุผลการย้าย"
    setErrors(errs)
    if (Object.keys(errs).length) return

    setSubmitting(true)
    setApiError("")
    try {
      const body = {
        to_branch_id: Number(toBranchId),
        reason: reason.trim(),
        effective_date: effectiveDate || null,
        order_reference: orderRef.trim() || null,
        sub_unit: subUnit.trim() || null,
      }
      const res = await apiAuth(`/hr/employees/${employeeId}/relocations`, { method: "POST", body })
      const out = {
        ...(res || {}),
        employeeName,
        fromName: branchName(res?.from_branch_id ?? currentBranchId),
        toName: branchName(res?.to_branch_id ?? toBranchId),
        effective_date: res?.effective_date ?? effectiveDate,
      }
      setResult(out)
      onDone?.(out)
    } catch (err) {
      // แสดง detail จาก backend ตามที่ส่งมา (เช่น 404 ไม่พบพนักงาน/สาขา)
      setApiError(err.message || "บันทึกการย้ายสาขาไม่สำเร็จ")
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Portal>
      <div
        className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm"
        {...backdropProps}
      >
        <div
          ref={dialogRef}
          role="dialog"
          aria-modal="true"
          aria-labelledby="relocation-transfer-title"
          className="w-full max-w-lg max-h-[90vh] overflow-y-auto rounded-2xl bg-white dark:bg-gray-800 shadow-2xl"
        >
          <div className="px-6 pt-5 pb-4 border-b border-gray-100 dark:border-gray-700">
            <h3 id="relocation-transfer-title" className="text-lg font-bold text-gray-900 dark:text-gray-100">
              ย้ายสาขาโดยตรง
            </h3>
            <p className="mt-0.5 text-sm text-gray-500 dark:text-gray-400">
              บันทึกการย้ายตามคำสั่ง โดยไม่ต้องรอคำขอจากพนักงาน
            </p>
          </div>

          {result ? (
            <div className="px-6 py-5 space-y-4">
              <div
                role="status"
                className={`rounded-xl px-4 py-3 text-sm ${result.applied === false
                  ? "bg-amber-50 text-amber-800 ring-1 ring-amber-200 dark:bg-amber-900/20 dark:text-amber-200 dark:ring-amber-800/60"
                  : "bg-emerald-50 text-emerald-800 ring-1 ring-emerald-200 dark:bg-emerald-900/20 dark:text-emerald-200 dark:ring-emerald-800/60"}`}
              >
                <p className="font-semibold">
                  {result.applied === false
                    ? `บันทึกแล้ว — มีผลวันที่ ${fmtThaiDateLong(result.effective_date)}`
                    : "ย้ายสาขาเรียบร้อย มีผลทันที"}
                </p>
                <p className="mt-1">
                  {result.employeeName || "พนักงาน"}: {result.fromName ?? "สาขาเดิม"} → {result.toName ?? "สาขาใหม่"}
                </p>
                {result.applied === false && (
                  <p className="mt-1 text-xs opacity-90">
                    ระบบจะเปลี่ยนสาขาให้อัตโนมัติเมื่อถึงวันที่มีผล (รอบประมวลผลรายวัน)
                  </p>
                )}
              </div>
              <div className="flex justify-end gap-2">
                {!locked && (
                  <button
                    type="button"
                    onClick={resetForNext}
                    className="h-10 px-4 rounded-xl border border-gray-300 dark:border-gray-600 text-sm font-semibold text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors duration-200 cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
                  >
                    ย้ายพนักงานคนอื่น
                  </button>
                )}
                <button
                  type="button"
                  onClick={onClose}
                  className="h-10 px-5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-semibold transition-colors duration-200 cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-gray-800"
                >
                  ปิด
                </button>
              </div>
            </div>
          ) : (
            <form onSubmit={handleSubmit} noValidate className="px-6 py-5 space-y-4">
              {/* พนักงาน */}
              {locked ? (
                <div>
                  <p className={labelCls}>พนักงาน</p>
                  <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">{employee.name || `#${employee.id}`}</p>
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    สาขาปัจจุบัน: {branchName(employee.branchId) ?? (loadingBranches ? "…" : "—")}
                  </p>
                </div>
              ) : (
                <div className="space-y-2">
                  <div>
                    <label htmlFor="rt-search" className={labelCls}>ค้นหาพนักงาน</label>
                    <input
                      id="rt-search"
                      type="search"
                      value={query}
                      onChange={(e) => setQuery(e.target.value)}
                      placeholder="พิมพ์ชื่อหรือนามสกุล"
                      autoComplete="off"
                      className={inputCls}
                    />
                  </div>
                  <div>
                    <p className={labelCls} id="rt-employee-label">
                      พนักงาน <span className="text-red-500">*</span>
                    </p>
                    <div aria-labelledby="rt-employee-label" role="group">
                      <SelectDropdown
                        options={personOptions}
                        value={employeeId}
                        onChange={(v) => { setEmployeeId(v); setErrors((x) => ({ ...x, employee: undefined })) }}
                        placeholder={searching ? "กำลังค้นหา…" : personOptions.length ? `เลือกจาก ${personOptions.length} คน` : "ไม่พบพนักงาน ลองพิมพ์ชื่ออื่น"}
                        loading={searching}
                        error={!!errors.employee}
                      />
                    </div>
                    {searchError && <p className="mt-1 text-xs text-red-600 dark:text-red-400">{searchError}</p>}
                    {errors.employee && <p className="mt-1 text-xs text-red-600 dark:text-red-400" role="alert">{errors.employee}</p>}
                    {selectedPerson && (
                      <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                        สาขาปัจจุบัน: {branchName(selectedPerson.branch_location) ?? "—"}
                      </p>
                    )}
                  </div>
                </div>
              )}

              {/* สาขาปลายทาง */}
              <div>
                <p className={labelCls} id="rt-branch-label">
                  ย้ายไปสาขา <span className="text-red-500">*</span>
                </p>
                <div aria-labelledby="rt-branch-label" role="group">
                  <SelectDropdown
                    options={branchOptions}
                    value={toBranchId}
                    onChange={(v) => { setToBranchId(v); setErrors((x) => ({ ...x, branch: undefined })) }}
                    placeholder={loadingBranches ? "กำลังโหลดสาขา…" : "เลือกสาขาปลายทาง"}
                    loading={loadingBranches}
                    error={!!errors.branch}
                  />
                </div>
                {errors.branch && <p className="mt-1 text-xs text-red-600 dark:text-red-400" role="alert">{errors.branch}</p>}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label htmlFor="rt-date" className={labelCls}>วันที่มีผล</label>
                  <input
                    id="rt-date"
                    type="date"
                    value={effectiveDate}
                    onChange={(e) => setEffectiveDate(e.target.value)}
                    aria-describedby="rt-date-hint"
                    className={inputCls}
                  />
                </div>
                <div>
                  <label htmlFor="rt-order" className={labelCls}>เลขคำสั่ง</label>
                  <input
                    id="rt-order"
                    type="text"
                    value={orderRef}
                    onChange={(e) => setOrderRef(e.target.value)}
                    placeholder="เช่น 123/2569"
                    className={inputCls}
                  />
                </div>
              </div>
              <p id="rt-date-hint" className="-mt-2 text-xs text-gray-500 dark:text-gray-400">
                {isFuture
                  ? `ถ้าเป็นวันในอนาคต ระบบจะเปลี่ยนสาขาให้อัตโนมัติวันที่ ${fmtThaiDateLong(effectiveDate)} (รอบประมวลผลรายวัน)`
                  : "วันนี้หรือย้อนหลังจะเปลี่ยนสาขาทันที ถ้าเลือกวันในอนาคต ระบบจะเปลี่ยนให้เมื่อถึงวันนั้น (รอบประมวลผลรายวัน)"}
              </p>

              <div>
                <label htmlFor="rt-subunit" className={labelCls}>หน่วยงานย่อย</label>
                <input
                  id="rt-subunit"
                  type="text"
                  value={subUnit}
                  onChange={(e) => setSubUnit(e.target.value)}
                  placeholder="ถ้ามี"
                  className={inputCls}
                />
              </div>

              <div>
                <label htmlFor="rt-reason" className={labelCls}>
                  เหตุผลการย้าย <span className="text-red-500">*</span>
                </label>
                <textarea
                  id="rt-reason"
                  rows={3}
                  value={reason}
                  onChange={(e) => { setReason(e.target.value); setErrors((x) => ({ ...x, reason: undefined })) }}
                  aria-invalid={!!errors.reason}
                  aria-describedby={errors.reason ? "rt-reason-err" : undefined}
                  className={`${inputCls} resize-y ${errors.reason ? "border-red-400 dark:border-red-500" : ""}`}
                />
                {errors.reason && <p id="rt-reason-err" className="mt-1 text-xs text-red-600 dark:text-red-400" role="alert">{errors.reason}</p>}
              </div>

              {apiError && (
                <p role="alert" className="rounded-xl bg-red-50 dark:bg-red-900/20 px-3 py-2 text-sm text-red-700 dark:text-red-300 ring-1 ring-red-200 dark:ring-red-800/60">
                  {apiError}
                </p>
              )}

              <div className="flex justify-end gap-2 pt-1">
                <button
                  type="button"
                  onClick={onClose}
                  disabled={submitting}
                  className="h-10 px-4 rounded-xl border border-gray-300 dark:border-gray-600 text-sm font-semibold text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors duration-200 cursor-pointer disabled:opacity-60 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
                >
                  ยกเลิก
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="h-10 px-5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-semibold shadow-sm transition-colors duration-200 cursor-pointer disabled:opacity-60 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-gray-800"
                >
                  {submitting ? "กำลังบันทึก…" : "บันทึกการย้าย"}
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </Portal>
  )
}
