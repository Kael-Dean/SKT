// src/components/hr/TerminationForm.jsx
// 13E — บันทึกการพ้นสภาพ (ออกจากงาน) ของพนักงานหนึ่งคน
//   GET   /hr/employees/{id}/termination-record      → ค่าที่บันทึกไว้ หรือ preview (id = null)
//   POST  /hr/employees/{id}/termination-record      → สร้างบันทึก + ปิดการใช้งานบัญชี (is_active=false)
//   PATCH /hr/employees/{id}/termination-record      → แก้บันทึกเดิม (ส่งเฉพาะช่องที่เปลี่ยน)
//   GET   /hr/employees/{id}/termination-record/pdf  → ใบสรุปการพ้นสภาพ
// ใช้ทั้งในแท็บ "บันทึกออกจากงาน" และ popup ปุ่ม "ออกจากงาน" หน้าโปรไฟล์เจ้าหน้าที่ (<TerminationSheet>)
import { useCallback, useEffect, useRef, useState } from "react"
import { apiAuth, apiDownload } from "../../lib/api"
import { apiDetail } from "../../lib/apiErrors"
import { borrowerName, money, thaiDate, todayIso, warningList } from "../../lib/loans"
import { cx, baseField } from "../../lib/styles"
import { ConfirmDialog, ErrorState, Sheet } from "../ui"
import SelectDropdown from "../SelectDropdown"

// TerminationReason (backend v1.1.0). สามค่าแรกคือค่าที่พบจริงในข้อมูลย้อนหลัง
// ของสหกรณ์ — เรียงไว้ก่อนเพื่อให้ HR เลือกได้เร็ว
const EXIT_TYPES = [
  { value: "retired",          label: "เกษียณอายุ" },
  { value: "deceased",         label: "เสียชีวิต" },
  { value: "resigned",         label: "ลาออก" },
  { value: "dismissed",        label: "ไล่ออก" },
  { value: "failed_probation", label: "ไม่ผ่านทดลองงาน" },
  { value: "contract_end",     label: "สิ้นสุดสัญญาจ้าง" },
]

const FORM_KEYS = [
  "exit_type", "exit_date", "committee_set_no", "committee_meeting_no", "committee_meeting_date",
  "severance_pay", "accumulated_fund", "work_guarantee_bond", "loan_outstanding", "loan_interest_estimate",
  "bank_guarantee_ref", "bank_guarantee_date", "bank_guarantee_amount",
]

const MONEY_FIELDS = [
  { key: "severance_pay",          label: "เงินชดเชย" },
  { key: "accumulated_fund",       label: "กองทุนสะสม" },
  { key: "work_guarantee_bond",    label: "เงินประกันการทำงาน" },
  { key: "loan_outstanding",       label: "เงินกู้คงเหลือ" },
  { key: "loan_interest_estimate", label: "ดอกเบี้ยเงินกู้ประมาณ" },
  { key: "bank_guarantee_ref",     label: "อ้างอิงหนังสือค้ำ", type: "text" },
  { key: "bank_guarantee_date",    label: "วันที่หนังสือค้ำ", type: "date" },
  { key: "bank_guarantee_amount",  label: "วงเงินค้ำประกัน" },
]

const inputCls = cx(baseField, "!rounded-lg !px-3 !py-2 md:!text-sm")
const labelCls = "mb-1 block text-xs font-medium text-gray-600 dark:text-gray-400"

function fmt(n) {
  if (n == null || n === "") return "—"
  return Number(n).toLocaleString("th-TH", { minimumFractionDigits: 2 }) + " บาท"
}

function fmtNum(n) {
  if (n == null) return "—"
  return Number(n).toLocaleString("th-TH")
}

// 3Q termination_prefill ส่ง exit_type "dismiss" (เชิญออก/ไล่ออก) — ค่าใน TerminationReason คือ "dismissed"
const PREFILL_EXIT_TYPE = { dismiss: "dismissed" }

/** record จาก GET → ค่าในฟอร์ม (null → "" เพื่อให้ input เป็น controlled) */
function toForm(record, prefill) {
  const f = {}
  for (const k of FORM_KEYS) f[k] = record?.id != null ? record[k] ?? "" : ""
  // preview (ยังไม่มีบันทึก) — backend เติม exit_date = วันนี้มาให้
  if (record?.id == null) f.exit_date = record?.exit_date ?? todayIso()
  // 3Q: เปิดจากการลงโทษขั้น 7/8 — เติมเฉพาะตอนยังไม่มีบันทึก
  if (record?.id == null && prefill) {
    const t = PREFILL_EXIT_TYPE[prefill.exit_type] ?? prefill.exit_type
    if (EXIT_TYPES.some((o) => o.value === t)) f.exit_type = t
    if (prefill.severance_pay != null && prefill.severance_pay !== "") f.severance_pay = String(prefill.severance_pay)
  }
  return f
}

/** ช่องว่าง "" ต้องไม่ถูกส่ง — backend เป็น Pydantic int/Decimal/date → "" = 422 */
function createPayload(form) {
  const body = {}
  for (const k of FORM_KEYS) {
    const v = typeof form[k] === "string" ? form[k].trim() : form[k]
    if (v !== "" && v != null) body[k] = v
  }
  return body
}

/** PATCH ส่งเฉพาะช่องที่เปลี่ยน — ช่องที่ล้างเป็นค่าว่างส่ง null (backend ใช้ exclude_unset) */
function patchPayload(form, initial) {
  const body = {}
  for (const k of FORM_KEYS) {
    if (String(form[k] ?? "") === String(initial[k] ?? "")) continue
    const v = typeof form[k] === "string" ? form[k].trim() : form[k]
    body[k] = v === "" ? null : v
  }
  return body
}

// 3K (backend PR #30) — GET /hr/employees/{id}/loan-exposure?as_of= : เงินกู้คงค้าง + สัญญาที่ยังค้ำประกันอยู่
// แสดงตอนสร้างบันทึกการพ้นสภาพ (ช่องเงินกู้ที่เว้นว่าง backend เติมให้อัตโนมัติ). 403/404 = ซ่อนเงียบ
function LoanExposurePanel({ employeeId, asOf }) {
  const [state, setState] = useState({ loading: true, data: null, error: "" })
  useEffect(() => {
    let alive = true
    setState((s) => ({ ...s, loading: true, error: "" }))
    const t = setTimeout(() => {
      apiAuth(`/hr/employees/${employeeId}/loan-exposure?as_of=${encodeURIComponent(asOf)}`)
        .then((data) => alive && setState({ loading: false, data, error: "" }))
        .catch((e) => alive && setState({ loading: false, data: null, error: e.status === 403 || e.status === 404 ? "" : apiDetail(e) || "ตรวจภาระเงินกู้ไม่สำเร็จ" }))
    }, 250)
    return () => { alive = false; clearTimeout(t) }
  }, [employeeId, asOf])

  const { loading, data, error } = state
  if (loading && !data) return <p role="status" className="text-sm text-gray-500 dark:text-gray-400">กำลังตรวจภาระเงินกู้และการค้ำประกัน…</p>
  if (error) return <p role="alert" className="text-sm text-red-600 dark:text-red-400">{error}</p>
  if (!data) return null
  const warns = warningList(data)
  const guar = Array.isArray(data.guarantor_of) ? data.guarantor_of : []
  const outstanding = Number(data.loan_outstanding) || 0
  if (!warns.length && !guar.length && !outstanding) {
    return <p className="text-sm text-gray-600 dark:text-gray-300">ไม่มีเงินกู้คงค้างและไม่ได้ค้ำประกันสัญญาใด ณ {thaiDate(asOf, { long: true })}</p>
  }
  return (
    <section aria-labelledby={`term-loan-h-${employeeId}`} className="space-y-2 rounded-xl bg-amber-50 p-3 text-sm text-amber-950 dark:bg-amber-500/10 dark:text-amber-100">
      <h4 id={`term-loan-h-${employeeId}`} className="font-semibold">ภาระเงินกู้กองทุนฯ ณ {thaiDate(asOf, { long: true })}</h4>
      {warns.length > 0 && <ul className="list-disc space-y-0.5 pl-5">{warns.map((w) => <li key={w}>{w}</li>)}</ul>}
      {outstanding > 0 && (
        <p>เงินกู้คงเหลือ <strong className="tabular-nums">{money(data.loan_outstanding)}</strong> บาท · ดอกเบี้ยประมาณ <strong className="tabular-nums">{money(data.loan_interest_estimate)}</strong> บาท
          <span className="text-amber-800 dark:text-amber-200/80"> (เว้นช่องเงินกู้ว่างไว้ ระบบจะเติมยอดนี้ให้)</span></p>
      )}
      {guar.length > 0 && (
        <div>
          <p className="font-medium">ยังเป็นผู้ค้ำประกัน {guar.length} สัญญา:</p>
          <ul className="mt-1 space-y-0.5">
            {guar.map((g, i) => (
              <li key={g.loan_id ?? g.id ?? i} className="tabular-nums">
                สัญญา #{g.loan_id ?? g.id ?? "—"} · {borrowerName(g)}
                {g.outstanding != null || g.loan_outstanding != null ? ` · คงเหลือ ${money(g.outstanding ?? g.loan_outstanding)} บาท` : ""}
                {g.status_label ? ` · ${g.status_label}` : ""}
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  )
}

/**
 * ฟอร์มบันทึกออกจากงานของพนักงาน 1 คน
 * @param employee  { id, first_name, last_name }
 * @param onSaved   ({ created }) => void — created = true เมื่อสร้างบันทึกใหม่ (บัญชีถูกปิดใช้งานแล้ว)
 * @param prefill   (3Q) termination_prefill จากการลงโทษขั้น 7/8 { exit_type, reason, reference, severance_pay, note }
 *                  ใช้เติมฟอร์มเฉพาะตอนยังไม่มีบันทึก; reason/reference/note แสดงเป็นข้อมูลอ้างอิง
 */
export default function TerminationForm({ employee, onSaved, showHeader = true, prefill = null }) {
  const empId = employee?.id
  const empName = `${employee?.first_name ?? ""} ${employee?.last_name ?? ""}`.trim() || `รหัส ${empId}`

  const [record, setRecord] = useState(null)
  const [loading, setLoading] = useState(true)
  const [loadErr, setLoadErr] = useState("")
  const [form, setForm] = useState({})
  const initialRef = useRef({})
  // prefill อ่านตอนโหลดเท่านั้น (ไม่ใส่ใน deps — กัน object ใหม่ทุก render ทำให้โหลดซ้ำ)
  const prefillRef = useRef(prefill)
  prefillRef.current = prefill

  const [saving, setSaving] = useState(false)
  const [saveMsg, setSaveMsg] = useState(null) // { ok, text } | null
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [confirmErr, setConfirmErr] = useState("")

  const [pdfLoading, setPdfLoading] = useState(false)
  const [pdfErr, setPdfErr] = useState("")

  const load = useCallback(async () => {
    setLoading(true)
    setLoadErr("")
    try {
      const data = await apiAuth(`/hr/employees/${empId}/termination-record`)
      const f = toForm(data, prefillRef.current)
      initialRef.current = f
      setRecord(data)
      setForm(f)
    } catch (e) {
      setLoadErr(apiDetail(e) || "โหลดข้อมูลการออกจากงานไม่สำเร็จ")
    } finally {
      setLoading(false)
    }
  }, [empId])

  useEffect(() => {
    setRecord(null)
    setSaveMsg(null)
    setPdfErr("")
    load()
  }, [load])

  const setField = (k, v) => setForm((f) => ({ ...f, [k]: v }))
  const isNew = record?.id == null

  const validate = () => {
    if (!form.exit_type) return "เลือกประเภทการออก"
    if (!form.exit_date) return "ระบุวันที่ออก"
    return ""
  }

  const handleSave = async () => {
    const err = validate()
    if (err) { setSaveMsg({ ok: false, text: err }); return }
    setSaveMsg(null)
    if (isNew) { setConfirmErr(""); setConfirmOpen(true); return }

    const body = patchPayload(form, initialRef.current)
    if (Object.keys(body).length === 0) { setSaveMsg({ ok: true, text: "ไม่มีข้อมูลที่เปลี่ยน" }); return }
    setSaving(true)
    try {
      await apiAuth(`/hr/employees/${empId}/termination-record`, { method: "PATCH", body })
      await load()
      setSaveMsg({ ok: true, text: "บันทึกการแก้ไขแล้ว" })
      onSaved?.({ created: false })
    } catch (e) {
      setSaveMsg({ ok: false, text: apiDetail(e) || "บันทึกไม่สำเร็จ" })
    } finally {
      setSaving(false)
    }
  }

  const handleConfirmCreate = async () => {
    setSaving(true)
    setConfirmErr("")
    try {
      await apiAuth(`/hr/employees/${empId}/termination-record`, { method: "POST", body: createPayload(form) })
      setConfirmOpen(false)
      await load()
      setSaveMsg({ ok: true, text: `บันทึกออกจากงานแล้ว — ปิดการใช้งานบัญชีของ ${empName} แล้ว` })
      onSaved?.({ created: true })
    } catch (e) {
      setConfirmErr(apiDetail(e) || "บันทึกไม่สำเร็จ")
    } finally {
      setSaving(false)
    }
  }

  const handleDownloadPdf = async () => {
    if (!record?.id) return
    setPdfLoading(true)
    setPdfErr("")
    try {
      const { blob, filename } = await apiDownload(`/hr/employees/${empId}/termination-record/pdf`)
      const url = URL.createObjectURL(blob)
      const a = document.createElement("a")
      a.href = url
      a.download = filename || `termination_${record.id}.pdf`
      a.click()
      URL.revokeObjectURL(url)
    } catch (e) {
      setPdfErr(apiDetail(e) || "ดาวน์โหลดไม่สำเร็จ")
    } finally {
      setPdfLoading(false)
    }
  }

  if (loading && !record) {
    return (
      <div role="status" aria-busy="true" className="flex items-center justify-center gap-3 py-8">
        <span className="h-7 w-7 animate-spin rounded-full border-2 border-gray-200 border-t-indigo-500 dark:border-gray-700 dark:border-t-indigo-400" aria-hidden="true" />
        <span className="text-sm text-gray-500 dark:text-gray-400">กำลังโหลดข้อมูลพนักงาน…</span>
      </div>
    )
  }
  if (loadErr) return <ErrorState message={loadErr} onRetry={load} />
  if (!record) return null

  const exitLabel = EXIT_TYPES.find((t) => t.value === form.exit_type)?.label

  return (
    <div className="space-y-4">
      {(showHeader || record.id != null) && (
        <div className="flex flex-wrap items-start justify-between gap-3">
          {showHeader ? (
            <div>
              <h3 className="font-bold text-gray-900 dark:text-gray-100">{empName}</h3>
              {employee?.branch_name && <p className="text-xs text-gray-500 dark:text-gray-400">{employee.branch_name}</p>}
            </div>
          ) : <span />}
          {record.id != null && (
            <button
              type="button"
              onClick={handleDownloadPdf}
              disabled={pdfLoading}
              className="inline-flex min-h-touch items-center gap-1.5 rounded-xl bg-rose-600 px-3 py-1.5 text-xs font-semibold text-white transition duration-200 hover:bg-rose-500 disabled:opacity-60 cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-rose-500 focus-visible:ring-offset-1 md:min-h-0 dark:focus-visible:ring-offset-gray-800"
            >
              {pdfLoading ? (
                <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-white/40 border-t-white" aria-hidden="true" />
              ) : (
                <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="size-3.5">
                  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                  <path d="M14 2v6h6" />
                </svg>
              )}
              {pdfLoading ? "กำลังดาวน์โหลด..." : "ดาวน์โหลดใบสรุป PDF"}
            </button>
          )}
        </div>
      )}
      {pdfErr && <p role="alert" className="text-xs text-red-600 dark:text-red-400">{pdfErr}</p>}

      {record.id != null && (
        <p className="rounded-xl bg-gray-50 px-3 py-2 text-sm text-gray-700 dark:bg-gray-700/40 dark:text-gray-200">
          ออกจากงานแล้ว — บัญชีถูกปิดการใช้งาน แก้ไขรายละเอียดบันทึกได้ด้านล่าง
        </p>
      )}

      {isNew && prefill && (
        <div className="rounded-xl bg-amber-50 px-3 py-2 text-sm text-amber-950 dark:bg-amber-500/10 dark:text-amber-100">
          <p className="font-semibold">เติมจากการลงโทษทางวินัย{prefill.reason ? ` — ${prefill.reason}` : ""}</p>
          <p className="tabular-nums">
            {prefill.reference ? `อ้างอิงหนังสือเลขที่ ${prefill.reference}` : "ไม่มีเลขที่หนังสืออ้างอิง"}
            {prefill.severance_pay === 0 || prefill.severance_pay === "0" ? " · ไม่จ่ายเงินชดเชย (ค่าเริ่มต้นกรณีไล่ออก)" : ""}
          </p>
          {prefill.note && <p className="mt-0.5 whitespace-pre-wrap break-words text-amber-900 dark:text-amber-200/90">{prefill.note}</p>}
        </div>
      )}

      {/* ข้อมูลคำนวณ (read-only) */}
      <div className="space-y-2 rounded-xl bg-indigo-50 p-3 dark:bg-indigo-900/20">
        <p className="text-xs font-semibold text-indigo-700 dark:text-indigo-300">ระบบคำนวณให้</p>
        <dl className="grid grid-cols-2 gap-2 text-sm sm:grid-cols-4">
          <div>
            <dt className="text-xs text-gray-500 dark:text-gray-400">อายุงาน</dt>
            <dd className="font-medium tabular-nums text-gray-800 dark:text-gray-200">
              {record.tenure_years != null ? `${fmtNum(record.tenure_years)} ปี ${fmtNum(record.tenure_days)} วัน` : "—"}
            </dd>
          </div>
          <div>
            <dt className="text-xs text-gray-500 dark:text-gray-400">วันลาทั้งหมด</dt>
            <dd className="font-medium tabular-nums text-gray-800 dark:text-gray-200">{record.total_leave_days ?? "—"}</dd>
          </div>
          <div>
            <dt className="text-xs text-gray-500 dark:text-gray-400">วันลาพักผ่อน</dt>
            <dd className="font-medium tabular-nums text-gray-800 dark:text-gray-200">{record.total_annual_leave_days ?? "—"}</dd>
          </div>
          <div>
            <dt className="text-xs text-gray-500 dark:text-gray-400">เงินเดือนล่าสุด</dt>
            <dd className="font-semibold tabular-nums text-indigo-700 dark:text-indigo-300">{fmt(record.last_salary)}</dd>
          </div>
        </dl>
      </div>

      {/* การออกจากงาน */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div>
          <label htmlFor={`term-exit_type-${empId}`} className={labelCls}>ประเภทการออก <span className="text-red-500">*</span></label>
          <SelectDropdown
            id={`term-exit_type-${empId}`}
            options={EXIT_TYPES}
            value={form.exit_type ?? ""}
            onChange={(v) => setField("exit_type", v)}
            placeholder="— เลือก —"
            size="sm"
            showSwatch={false}
            required
          />
        </div>
        <div>
          <label htmlFor={`term-exit_date-${empId}`} className={labelCls}>วันที่ออก (วันที่มีผล) <span className="text-red-500">*</span></label>
          <input id={`term-exit_date-${empId}`} type="date" value={form.exit_date ?? ""} onChange={(e) => setField("exit_date", e.target.value)} className={inputCls} />
        </div>
        <div>
          <label htmlFor={`term-committee_set_no-${empId}`} className={labelCls}>คณะกรรมการชุดที่</label>
          <input id={`term-committee_set_no-${empId}`} type="number" inputMode="numeric" value={form.committee_set_no ?? ""} onChange={(e) => setField("committee_set_no", e.target.value)} className={inputCls} />
        </div>
        <div>
          <label htmlFor={`term-committee_meeting_no-${empId}`} className={labelCls}>ประชุมครั้งที่</label>
          <input id={`term-committee_meeting_no-${empId}`} type="number" inputMode="numeric" value={form.committee_meeting_no ?? ""} onChange={(e) => setField("committee_meeting_no", e.target.value)} className={inputCls} />
        </div>
        <div>
          <label htmlFor={`term-committee_meeting_date-${empId}`} className={labelCls}>วันที่ประชุมคณะกรรมการ</label>
          <input id={`term-committee_meeting_date-${empId}`} type="date" value={form.committee_meeting_date ?? ""} onChange={(e) => setField("committee_meeting_date", e.target.value)} className={inputCls} />
        </div>
      </div>

      {/* การเงิน */}
      <p className="border-t border-gray-100 pt-3 text-xs font-semibold text-gray-500 dark:border-line dark:text-gray-400">ข้อมูลการเงิน (ไม่บังคับ)</p>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {MONEY_FIELDS.map(({ key, label, type = "number" }) => (
          <div key={key}>
            <label htmlFor={`term-${key}-${empId}`} className={labelCls}>{label}</label>
            <input
              id={`term-${key}-${empId}`}
              type={type}
              step={type === "number" ? "0.01" : undefined}
              inputMode={type === "number" ? "decimal" : undefined}
              value={form[key] ?? ""}
              onChange={(e) => setField(key, e.target.value)}
              className={type === "number" ? cx(inputCls, "tabular-nums") : inputCls}
            />
          </div>
        ))}
      </div>

      {isNew && <LoanExposurePanel employeeId={empId} asOf={form.exit_date || todayIso()} />}

      {saveMsg && (
        <p role={saveMsg.ok ? "status" : "alert"} className={cx("text-sm font-medium", saveMsg.ok ? "text-emerald-600 dark:text-emerald-400" : "text-red-600 dark:text-red-400")}>
          {saveMsg.text}
        </p>
      )}

      <div className="flex flex-col-reverse gap-2 pt-1 sm:flex-row sm:items-center sm:justify-between">
        {isNew ? (
          <p className="text-xs text-red-600 dark:text-red-400">
            เมื่อบันทึก บัญชีของพนักงานคนนี้จะถูก<strong>ปิดการใช้งานทันที</strong> และย้อนกลับไม่ได้
          </p>
        ) : <span />}
        <button
          type="button"
          onClick={handleSave}
          disabled={saving}
          className={cx(
            "inline-flex min-h-touch shrink-0 items-center justify-center gap-2 rounded-xl px-5 py-2 text-sm font-semibold text-white transition duration-200 disabled:opacity-60 cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-1 md:min-h-0 dark:focus-visible:ring-offset-gray-800",
            isNew ? "bg-red-600 hover:bg-red-500 focus-visible:ring-red-500" : "bg-indigo-600 hover:bg-indigo-500 focus-visible:ring-indigo-500",
          )}
        >
          {saving && <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white" aria-hidden="true" />}
          {saving ? "กำลังบันทึก..." : isNew ? "บันทึกออกจากงาน" : "บันทึกการแก้ไข"}
        </button>
      </div>

      <ConfirmDialog
        open={confirmOpen}
        title="ยืนยันการออกจากงาน"
        description={`ปิดการใช้งานบัญชีของ ${empName} ทันที — ย้อนกลับไม่ได้`}
        confirmLabel="ยืนยันออกจากงาน"
        tone="danger"
        loading={saving}
        error={confirmErr}
        onConfirm={handleConfirmCreate}
        onCancel={() => setConfirmOpen(false)}
      >
        <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-sm">
          <dt className="text-gray-500 dark:text-gray-400">ประเภท</dt>
          <dd className="font-medium text-gray-900 dark:text-gray-100">{exitLabel ?? "—"}</dd>
          <dt className="text-gray-500 dark:text-gray-400">วันที่มีผล</dt>
          <dd className="font-medium text-gray-900 dark:text-gray-100">{form.exit_date ? thaiDate(form.exit_date, { long: true }) : "—"}</dd>
        </dl>
      </ConfirmDialog>
    </div>
  )
}

/** Popup ออกจากงาน (หน้าโปรไฟล์เจ้าหน้าที่) — bottom sheet บนมือถือ, dialog กลางจอบน desktop */
export function TerminationSheet({ open, onClose, employee, onSaved, prefill = null }) {
  const name = `${employee?.first_name ?? ""} ${employee?.last_name ?? ""}`.trim()
  return (
    <Sheet open={open} onClose={onClose} title="บันทึกออกจากงาน" subtitle={name || undefined} size="lg">
      {open && employee?.id != null && <TerminationForm employee={employee} onSaved={onSaved} showHeader={false} prefill={prefill} />}
    </Sheet>
  )
}
