// src/pages/work/LeaveRequest.jsx
import { cx, baseField, readonlyFieldCls } from "../../lib/styles"
// ยื่นใบลา + ประวัติใบลา — PUT /personnel/me/leaves, GET /personnel/me/leaves/{id}/pdf
import { useEffect, useState, useCallback, useId, Children, cloneElement, isValidElement } from "react"
import { apiAuth, apiDownload } from "../../lib/api"
import { countLeaveDays, countsCalendarDays, fmtDays, fmtLeaveDuration, fmtLeaveRowDuration, currentFiscalYearBE } from "../../lib/leaveDays"
import { sortLeaveTypes } from "../../lib/leaveTypes"
import { printPage } from "../../lib/files"
import { getUser } from "../../lib/auth"
import useFormDefaults from "../../hooks/useFormDefaults"
import { STATUS_LABEL as APPROVAL_STATUS_LABEL, isPendingStatus } from "../../lib/approval"
import { StageBadge, JustificationBadge } from "../../components/ApprovalBadges"
import { Skeleton, ErrorState, EmptyState, toast } from "../../components/ui"
import PageTitle from "../../components/PageTitle"
import ThaiDateField from "../../components/ThaiDateField"

// ─── shared style tokens ────────────────────────────────────────────────────
const inputCls = cx(baseField, "!rounded-lg !px-3 !py-2 md:!text-sm")
const readonlyCls = cx(readonlyFieldCls, "!rounded-lg !px-3 !py-2 md:!text-sm cursor-default focus:outline-none placeholder:text-gray-400 dark:placeholder:text-gray-500")
const NO_DATA = "ยังไม่มีข้อมูลในระบบ"

const cardCls =
  "rounded-2xl bg-white dark:bg-gray-800 shadow-sm ring-1 ring-gray-200/70 dark:ring-gray-700/70 p-5"

// labels from the shared approval chain (งวด 2) + legacy "pending"
const STATUS_LABEL = { pending: "รอดำเนินการ", ...APPROVAL_STATUS_LABEL }
const STATUS_COLOR = {
  pending:                   "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300",
  pending_branch_head:       "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300",
  pending_assistant_manager: "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-300",
  pending_manager:           "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300",
  approved:                  "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300",
  rejected:                  "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300",
  denied:                    "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300",
  cancelled:                 "bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400",
}

// ─── print stylesheet (injected once on mount) ───────────────────────────────
const PRINT_CSS = `
@media print {
  body * { visibility: hidden !important; }

  #leave-print-root {
    visibility: visible !important;
    position: fixed !important;
    top: 0 !important;
    left: 0 !important;
    width: 100% !important;
    font-family: 'Sarabun', 'TH Sarabun New', 'Cordia New', serif;
    font-size: 14pt;
    line-height: 1.6;
    color: #000;
    padding: 20mm 20mm 15mm 25mm;
    box-sizing: border-box;
    background: #fff;
  }

  #leave-print-root * { visibility: visible !important; }

  .print-header-org {
    text-align: center;
    font-size: 16pt;
    font-weight: 700;
    margin-bottom: 2pt;
  }
  .print-header-title {
    text-align: center;
    font-size: 26pt;
    font-weight: 700;
    letter-spacing: 0.04em;
    margin-bottom: 14pt;
  }
  .print-date-row {
    display: flex !important;
    justify-content: flex-end;
    margin-bottom: 8pt;
    font-size: 13pt;
  }
  .print-line {
    display: flex !important;
    flex-wrap: wrap;
    align-items: baseline;
    gap: 4pt;
    margin-bottom: 6pt;
    font-size: 13pt;
  }
  .print-label { white-space: nowrap; }
  .print-val {
    border-bottom: 1.5px dotted #555;
    min-width: 120pt;
    flex: 1;
    padding-bottom: 1pt;
  }
  .print-val-sm {
    border-bottom: 1.5px dotted #555;
    min-width: 60pt;
    padding-bottom: 1pt;
  }
  .print-val-lg {
    border-bottom: 1.5px dotted #555;
    min-width: 200pt;
    flex: 1;
    padding-bottom: 1pt;
  }
  .print-datetime-row {
    display: flex !important;
    flex-wrap: wrap;
    align-items: baseline;
    gap: 6pt;
    margin-bottom: 6pt;
    font-size: 13pt;
  }
  .print-total-box {
    display: inline-flex !important;
    align-items: baseline;
    gap: 4pt;
  }
  .print-total-val {
    border-bottom: 1.5px dotted #555;
    min-width: 50pt;
    text-align: center;
    font-weight: 700;
  }
  .print-address-grid {
    display: grid !important;
    grid-template-columns: repeat(4, 1fr);
    gap: 6pt 12pt;
    margin-bottom: 6pt;
  }
  .print-address-item {
    display: flex !important;
    align-items: baseline;
    gap: 3pt;
    font-size: 12pt;
  }
  .print-address-val {
    border-bottom: 1.5px dotted #555;
    flex: 1;
    min-width: 40pt;
    padding-bottom: 1pt;
  }
  .print-sig-area {
    margin-top: 20pt;
    text-align: center;
  }
  .print-sig-line {
    display: inline-block !important;
    border-bottom: 1.5px solid #333;
    min-width: 180pt;
    margin-bottom: 4pt;
  }
  .print-footer-table {
    width: 100%;
    border-collapse: collapse;
    font-size: 11pt;
    margin-top: 28pt;
  }
  .print-footer-table th,
  .print-footer-table td {
    border: 1px solid #333;
    padding: 3pt 5pt;
    text-align: center;
  }
  .print-footer-table th { font-weight: 700; background: #f0f0f0; }
  .print-footer-table td.row-header { text-align: left; font-weight: 600; }
  .no-print { display: none !important; }
  @page { margin: 0; }
}
`

// ─── utils ──────────────────────────────────────────────────────────────────
function today() {
  return new Date().toISOString().slice(0, 10)
}

// นับเฉพาะวันทำงาน — ตัดเสาร์-อาทิตย์และวันหยุดที่สหกรณ์ประกาศไว้
// ยกเว้นลาคลอด (calendarDays) นับทุกวันตามปฏิทิน (ระเบียบ 10 ข้อ 51 ค)
// เป็นเพียงการประมาณการฝั่งหน้าจอ ยอดจริงคำนวณโดยระบบตอนบันทึก
function workingDays(start, end, holidays, isHalfDay = false, calendarDays = false) {
  if (!start || !end) return 0
  return countLeaveDays({ from: start, to: end, isHalfDay, holidays, calendarDays })
}

function diffDays(start, end) {
  if (!start || !end) return 0
  const s = new Date(start)
  const e = new Date(end)
  if (e < s) return 0
  return Math.round((e - s) / (1000 * 60 * 60 * 24)) + 1
}

function fmtDateTh(iso) {
  if (!iso) return ""
  try {
    return new Date(iso).toLocaleDateString("th-TH", {
      day: "numeric",
      month: "long",
      year: "numeric",
    })
  } catch {
    return iso
  }
}

function fmtDateShort(iso) {
  if (!iso) return "—"
  try { return new Date(iso).toLocaleDateString("th-TH") } catch { return iso }
}

// ช่วงเวลาลาแบบตายตัว — ผู้ใช้เลือกแค่ เต็มวัน / ครึ่งเช้า / ครึ่งบ่าย ไม่ต้องกรอกเวลาเอง
const DAY_PARTS = {
  full:      { label: "เต็มวัน",   hint: "ลาทั้งวัน",       from: null,    to: null },
  morning:   { label: "ครึ่งเช้า",  hint: "08:30–12:00", from: "08:30", to: "12:00" },
  afternoon: { label: "ครึ่งบ่าย",  hint: "13:00–16:30", from: "13:00", to: "16:30" },
}
const DAY_PART_KEYS = ["full", "morning", "afternoon"]

function fmtTime(t) {
  if (!t) return null
  return t.slice(0, 5)
}


// ─── sub-components ──────────────────────────────────────────────────────────
// ผูก <label> กับช่องกรอกตัวแรก (input/textarea) ด้วย htmlFor/id — screen reader อ่านชื่อช่องได้ (WCAG 1.3.1 / 4.1.2)
const LABELABLE = new Set(["input", "textarea", "select"])
function Field({ label, required, children, className = "" }) {
  const autoId = useId()
  let controlId
  const kids = Children.map(children, (c) => {
    if (controlId === undefined && isValidElement(c) && LABELABLE.has(c.type)) {
      controlId = c.props.id || autoId
      return c.props.id ? c : cloneElement(c, { id: controlId, "aria-required": required || undefined })
    }
    return c
  })
  return (
    <div className={`flex flex-col gap-1 ${className}`}>
      <label htmlFor={controlId} className="text-xs font-medium text-gray-600 dark:text-gray-400">
        {label}
        {required && <span aria-hidden="true" className="text-red-500 ml-0.5">*</span>}
      </label>
      {kids}
    </div>
  )
}

function SectionTitle({ children }) {
  return (
    <p className="text-xs font-semibold text-indigo-600 dark:text-indigo-400 uppercase tracking-wider mb-3 flex items-center gap-2">
      <span className="flex-1 h-px bg-indigo-100 dark:bg-indigo-900/40" />
      {children}
      <span className="flex-1 h-px bg-indigo-100 dark:bg-indigo-900/40" />
    </p>
  )
}

// ─── print document component ────────────────────────────────────────────────
function PrintDocument({ form, totalDays }) {
  return (
    <div id="leave-print-root" style={{ position: "absolute", left: "-99999px", top: 0, width: "210mm" }} aria-hidden="true">
      {/* Header */}
      <div className="print-header-org">
        สหกรณ์การเกษตรเพื่อการตลาดลูกค้า ธ.ก.ส.สุรินทร์ จำกัด
      </div>
      <div className="print-header-title">ใบลา</div>

      {/* Date top-right */}
      <div className="print-date-row">
        <span>วันที่&nbsp;</span>
        <span className="print-val-sm">&nbsp;{fmtDateTh(form.docDate)}&nbsp;</span>
      </div>

      {/* ข้าพเจ้า / ตำแหน่ง / สังกัด */}
      <div className="print-line">
        <span className="print-label">ข้าพเจ้า</span>
        <span className="print-val">&nbsp;{form.fullName}&nbsp;</span>
        <span className="print-label">ตำแหน่ง</span>
        <span className="print-val">&nbsp;{form.position}&nbsp;</span>
      </div>
      <div className="print-line">
        <span className="print-label">สังกัด</span>
        <span className="print-val-lg">&nbsp;{form.department}&nbsp;</span>
      </div>

      {/* ประเภทการลา */}
      <div className="print-line">
        <span className="print-label">มีความประสงค์จะขอลา</span>
        <span className="print-val">&nbsp;{form.leaveTypeName || "—"}&nbsp;</span>
      </div>

      {/* เนื่องจาก */}
      <div className="print-line">
        <span className="print-label">เนื่องจาก</span>
        <span className="print-val-lg">&nbsp;{form.reason}&nbsp;</span>
      </div>

      {/* ช่วงวันที่ 1 */}
      <div className="print-datetime-row">
        <span className="print-label">ตั้งแต่วันที่</span>
        <span className="print-val-sm">&nbsp;{fmtDateTh(form.fromDate)}&nbsp;</span>
        <span className="print-label">เวลา</span>
        <span className="print-val-sm">&nbsp;{DAY_PARTS[form.dayPart]?.from || "—"}&nbsp;</span>
        <span className="print-label">น. ถึงวันที่</span>
        <span className="print-val-sm">&nbsp;{fmtDateTh(form.toDate)}&nbsp;</span>
        <span className="print-label">เวลา</span>
        <span className="print-val-sm">&nbsp;{DAY_PARTS[form.dayPart]?.to || "—"}&nbsp;</span>
        <span className="print-label">น.</span>
      </div>

      {/* รวมระยะเวลา */}
      <div className="print-line">
        <span className="print-label">รวมระยะเวลา</span>
        <div className="print-total-box">
          <span className="print-total-val">&nbsp;{totalDays}&nbsp;</span>
          <span>วัน</span>
        </div>
      </div>

      {/* ที่อยู่ระหว่างลา */}
      <div className="print-line" style={{ marginBottom: "4pt" }}>
        <span className="print-label">
          ในระหว่างลาหยุดงานสามารถติดต่อข้าพเจ้าได้ที่
        </span>
      </div>
      <div className="print-line">
        <span className="print-label">ที่อยู่</span>
        <span className="print-val-lg">&nbsp;{form.addressDuringLeave}&nbsp;</span>
      </div>
      <div className="print-line">
        <span className="print-label">หมายเลขโทรศัพท์</span>
        <span className="print-val">&nbsp;{form.contactDuringLeave}&nbsp;</span>
      </div>

      {/* เหตุที่ยื่นใบลาล่าช้า */}
      {form.lateReason && (
        <div className="print-line">
          <span className="print-label">
            กรณีไม่ได้เสนอใบลาล่วงหน้า ข้าพเจ้าขอชี้แจงว่า
          </span>
          <span className="print-val-lg">&nbsp;{form.lateReason}&nbsp;</span>
        </div>
      )}

      {/* ลงชื่อผู้ขออนุญาต */}
      <div className="print-sig-area">
        <div>
          <span>ลงชื่อ&nbsp;</span>
          <span className="print-sig-line">&nbsp;{form.signatureName}&nbsp;</span>
          <span>&nbsp;ผู้ขออนุญาตลา</span>
        </div>
        <div style={{ marginTop: "6pt", fontSize: "12pt" }}>
          <span>(</span>
          <span className="print-sig-line" style={{ minWidth: "160pt" }}>
            &nbsp;{form.fullName}&nbsp;
          </span>
          <span>)</span>
        </div>
      </div>

      {/* Footer table */}
      <table className="print-footer-table">
        <thead>
          <tr>
            <th>รายการลา (วัน)</th>
            <th>พักผ่อน</th>
            <th>ป่วย</th>
            <th>กิจส่วนตัว</th>
            <th>คลอดบุตร</th>
            <th>อื่นๆ</th>
          </tr>
        </thead>
        <tbody>
          {["ลามาแล้ว", "ลาครั้งนี้", "รวมวันลา", "คงเหลือ"].map((row) => (
            <tr key={row}>
              <td className="row-header">{row}</td>
              <td></td>
              <td></td>
              <td></td>
              <td></td>
              <td></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

// ─── main component ──────────────────────────────────────────────────────────
export default function LeaveRequest() {
  const user = getUser() || {}

  useEffect(() => {
    if (document.getElementById("leave-print-css")) return
    const style = document.createElement("style")
    style.id = "leave-print-css"
    style.textContent = PRINT_CSS
    document.head.appendChild(style)
    return () => {
      const el = document.getElementById("leave-print-css")
      if (el) el.remove()
    }
  }, [])

  const [tab, setTab] = useState("form")
  const [leaveTypes, setLeaveTypes] = useState([])

  useEffect(() => {
    apiAuth("/hr/leave-types")
      .then((data) => {
        const arr = Array.isArray(data) ? data : []
        setLeaveTypes(sortLeaveTypes(arr.filter((t) => t.is_active !== false)))
      })
      .catch(() => {})
  }, [])

  useEffect(() => {
    apiAuth("/personnel/me/leave-defaults")
      .then((d) => {
        setForm((prev) => ({
          ...prev,
          addressDuringLeave: d.address_during_leave ?? "",
          contactDuringLeave: d.contact_during_leave ?? "",
        }))
      })
      .catch(() => {})
  }, [])

  const getLeaveTypeName = (lt) =>
    lt?.leave_name ?? lt?.type ?? lt?.name ?? lt?.title ?? lt?.label ?? ""

  // ── form state ──────────────────────────────────────────────────────────
  // หัวฟอร์ม (ข้าพเจ้า / ตำแหน่ง / สังกัด) เติมจากข้อมูลบุคลากร — แก้ได้เสมอ; แผนกยังไม่มีที่มา ผู้ใช้พิมพ์ต่อท้ายเอง
  const { defaults } = useFormDefaults()
  const fallbackName = user.full_name || user.username || ""
  const blankForm = () => ({
    docDate: today(),
    fullName: defaults.name || fallbackName,
    position: defaults.position,
    department: [defaults.branch, defaults.department].filter(Boolean).join(" / "),
    leaveTypeId: null,
    leaveTypeName: "",
    reason: "",
    dayPart: "full",
    fromDate: "",
    toDate: "",
    addressDuringLeave: "",
    contactDuringLeave: "",
    lateReason: "",
    signatureName: defaults.name || fallbackName,
  })

  const [form, setForm] = useState(blankForm)

  // ค่าจากระบบมาถึงทีหลัง — ชื่อ/ตำแหน่ง/สังกัดแก้ในหน้านี้ไม่ได้ จึงใช้ค่าจากระบบเสมอ
  useEffect(() => {
    const { name, position, branch, department } = defaults
    if (!name && !position && !branch) return
    const untouchedName = (v) => !v || v === fallbackName
    const unit = [branch, department].filter(Boolean).join(" / ")
    setForm((prev) => ({
      ...prev,
      fullName: name || prev.fullName,
      signatureName: name && untouchedName(prev.signatureName) ? name : prev.signatureName,
      position: position || prev.position,
      department: unit || prev.department,
    }))
  }, [defaults, fallbackName])
  const [holidays, setHolidays] = useState([])
  const [errors, setErrors] = useState({})
  const [submitted, setSubmitted] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState("")

  // ── history state ───────────────────────────────────────────────────────
  const [history, setHistory] = useState([])
  const [loadingHistory, setLoadingHistory] = useState(false)
  const [historyError, setHistoryError] = useState("")
  const [cancellingId, setCancellingId] = useState(null)
  const [downloadingId, setDownloadingId] = useState(null)

  useEffect(() => {
    apiAuth(`/hr/holidays?fiscal_year=${currentFiscalYearBE()}`)
      .then((d) => setHolidays(Array.isArray(d) ? d : []))
      .catch(() => setHolidays([]))
  }, [])

  const fetchHistory = useCallback(() => {
    setLoadingHistory(true)
    setHistoryError("")
    apiAuth("/personnel/me/leaves")
      .then(setHistory)
      .catch((e) => setHistoryError(e.message || "โหลดประวัติไม่สำเร็จ"))
      .finally(() => setLoadingHistory(false))
  }, [])

  useEffect(() => {
    if (tab === "history") fetchHistory()
  }, [tab, fetchHistory])

  const handleCancel = async (id) => {
    setCancellingId(id)
    try {
      await apiAuth(`/personnel/me/leaves/${id}/cancel`, { method: "POST", body: {} })
      fetchHistory()
    } catch (err) {
      if (err?.onboardingRequired) return // gate 403 → AppLayout redirects to /onboarding
      toast.error("ยกเลิกไม่สำเร็จ", { description: err.message || "เกิดข้อผิดพลาด" })
    } finally {
      setCancellingId(null)
    }
  }

  const handlePdfDownload = async (leaveId) => {
    setDownloadingId(leaveId)
    try {
      const { blob, filename } = await apiDownload(`/personnel/me/leaves/${leaveId}/pdf`)
      const url = URL.createObjectURL(blob)
      const a = document.createElement("a")
      a.href = url
      a.download = filename || `leave_${leaveId}.pdf`
      a.click()
      URL.revokeObjectURL(url)
    } catch (err) {
      toast.error("ดาวน์โหลด PDF ไม่สำเร็จ", { description: err.message || "เกิดข้อผิดพลาด" })
    } finally {
      setDownloadingId(null)
    }
  }

  // ── derived values ──────────────────────────────────────────────────────
  const period = DAY_PARTS[form.dayPart] ?? DAY_PARTS.full
  const halfDayActive = form.dayPart !== "full" && Boolean(form.fromDate)
  const selectedType = leaveTypes.find((t) => t.id === form.leaveTypeId) ?? null
  const calendarDays = countsCalendarDays(selectedType ?? form.leaveTypeName)
  const days1 = workingDays(form.fromDate, form.toDate, holidays, halfDayActive, calendarDays)
  const totalDays = days1
  const rawDays1 = diffDays(form.fromDate, form.toDate)
  const excludedDays = rawDays1 > 0 && !calendarDays ? rawDays1 - workingDays(form.fromDate, form.toDate, holidays) : 0
  // เพดานวันลาต่อครั้ง/ปี จากรายการประเภทการลา (เช่น ลาคลอด 98) — ไม่ hard-code ตัวเลข
  const maxDays = selectedType?.max_days != null ? Number(selectedType.max_days) : null
  const overMax = maxDays != null && Number.isFinite(maxDays) && totalDays > maxDays

  // ── helpers ─────────────────────────────────────────────────────────────
  const set = (field) => (e) =>
    setForm((prev) => ({ ...prev, [field]: e.target.value }))

  // ครึ่งวัน = วันเดียวเสมอ → วันสิ้นสุดตามวันเริ่ม
  const selectDayPart = (dayPart) =>
    setForm((prev) => (dayPart === "full"
      ? { ...prev, dayPart }
      : { ...prev, dayPart, toDate: prev.fromDate }))

  // เลือกวันเริ่ม: ครึ่งวันตั้งวันสิ้นสุดให้เท่ากัน; เต็มวันเติมวันสิ้นสุดให้ถ้ายังว่างหรืออยู่ก่อนวันเริ่ม
  const setFromDate = (e) => {
    const v = e.target.value
    setForm((prev) => ({
      ...prev,
      fromDate: v,
      toDate: prev.dayPart !== "full" || !prev.toDate || (v && prev.toDate < v) ? v : prev.toDate,
    }))
  }

  const selectLeaveType = (lt) =>
    setForm((prev) => ({ ...prev, leaveTypeId: lt.id, leaveTypeName: getLeaveTypeName(lt) }))

  // ── validation ──────────────────────────────────────────────────────────
  const validate = () => {
    const errs = {}
    if (!form.leaveTypeId)       errs.leaveTypeId = "กรุณาเลือกประเภทการลา"
    if (!form.fromDate)          errs.fromDate    = "กรุณาระบุวันที่เริ่มลา"
    if (!form.toDate)            errs.toDate      = "กรุณาระบุวันที่สิ้นสุด"
    if (form.fromDate && form.toDate && new Date(form.toDate) < new Date(form.fromDate)) {
      errs.toDate = "วันที่สิ้นสุดต้องไม่อยู่ก่อนวันที่เริ่มต้น"
    }
    setErrors(errs)
    return Object.keys(errs).length === 0
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!validate()) return
    setSubmitting(true)
    setSubmitError("")
    try {
      await apiAuth("/personnel/me/leaves", {
        method: "PUT",
        body: {
          leave_type_id:        form.leaveTypeId,
          from_date:            form.fromDate,
          to_date:              form.toDate,
          from_time:            period.from,
          to_time:              period.to,
          comment:              form.reason   || null,
          address_during_leave: form.addressDuringLeave || null,
          contact_during_leave: form.contactDuringLeave || null,
          is_half_day: halfDayActive,
        },
      })
      setSubmitted(true)
    } catch (err) {
      setSubmitError(
        err.status === 409 ? (err.message || "มีใบลาในช่วงวันดังกล่าวอยู่แล้ว กรุณาตรวจสอบประวัติการลา")
        : err.status === 422 ? `ข้อมูลไม่ผ่านการตรวจสอบ: ${err.message || "จำนวนวันลาต้องเป็นจำนวนเต็มหรือครึ่งวัน (.5) เท่านั้น"}`
        : err.message || "ยื่นใบลาไม่สำเร็จ กรุณาลองใหม่"
      )
    } finally {
      setSubmitting(false)
    }
  }

  const resetForm = () => {
    setSubmitted(false)
    setErrors({})
    setSubmitError("")
    setForm(blankForm())
  }

  const handlePrint = () => printPage()

  const ErrMsg = ({ field }) =>
    errors[field] ? (
      <p className="text-xs text-red-500 mt-0.5">{errors[field]}</p>
    ) : null

  // ── submitted success state ───────────────────────────────────────────────
  if (submitted) {
    return (
      <>
        <PrintDocument form={form} totalDays={totalDays} />
        <div className="max-w-lg mx-auto mt-10 no-print">
          <div className={`${cardCls} text-center space-y-5`}>
            <div className="flex h-16 w-16 mx-auto items-center justify-center rounded-full bg-emerald-100 dark:bg-emerald-900/30">
              <svg className="w-8 h-8 text-emerald-600 dark:text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <div>
              <h2 className="text-lg font-bold text-gray-900 dark:text-gray-100">ยื่นใบลาสำเร็จ</h2>
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                ใบลาของคุณถูกบันทึกแล้ว รอผู้บังคับบัญชาอนุมัติ
              </p>
            </div>
            <div className="rounded-xl bg-indigo-50 dark:bg-indigo-900/20 p-4 text-left space-y-1.5 text-sm">
              <p><span className="font-semibold text-gray-700 dark:text-gray-300">ผู้ยื่น:</span> <span className="text-gray-900 dark:text-gray-100">{form.fullName}</span></p>
              <p><span className="font-semibold text-gray-700 dark:text-gray-300">ประเภทการลา:</span> <span className="text-gray-900 dark:text-gray-100">{form.leaveTypeName}</span></p>
              <p><span className="font-semibold text-gray-700 dark:text-gray-300">ช่วงวันลา:</span> <span className="text-gray-900 dark:text-gray-100">{fmtDateShort(form.fromDate)} – {fmtDateShort(form.toDate)}</span></p>
              <p><span className="font-semibold text-gray-700 dark:text-gray-300">รวม:</span> <span className="font-bold text-indigo-700 dark:text-indigo-300">{fmtLeaveDuration(totalDays, { fromTime: period.from })}</span></p>
            </div>
            <div className="flex gap-3">
              <button
                onClick={handlePrint}
                className="flex-1 h-11 rounded-xl bg-indigo-600 text-white font-semibold hover:bg-indigo-500 active:bg-indigo-700 transition shadow-sm cursor-pointer flex items-center justify-center gap-2"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
                </svg>
                พิมพ์ใบลา
              </button>
              <button
                onClick={resetForm}
                className="flex-1 h-11 rounded-xl border border-gray-300 dark:border-gray-600 text-sm font-semibold text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700 transition cursor-pointer"
              >
                ยื่นใบลาอีกครั้ง
              </button>
            </div>
            <button
              onClick={() => { resetForm(); setTab("history") }}
              className="w-full text-sm text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300 transition cursor-pointer"
            >
              ดูประวัติใบลา →
            </button>
          </div>
        </div>
      </>
    )
  }

  // ── main UI ───────────────────────────────────────────────────────────────
  return (
    <>
      {/* Hidden print document (always in DOM after first render) */}
      <PrintDocument form={form} totalDays={totalDays} />

      <div className="space-y-5 pb-12 no-print">
        {/* Page title */}
        <PageTitle title="ใบลา" />

        {/* Tabs */}
        <div className="flex gap-1 rounded-xl bg-gray-100 dark:bg-gray-800 p-1 w-fit">
          {[["form", "ยื่นใบลา"], ["history", "ประวัติใบลา"]].map(([v, label]) => (
            <button
              key={v}
              onClick={() => setTab(v)}
              className={`px-4 py-2 rounded-lg text-sm font-semibold transition-all cursor-pointer ${
                tab === v
                  ? "bg-white dark:bg-gray-700 text-indigo-700 dark:text-indigo-300 shadow-sm"
                  : "text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200"
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        {/* ══════════ FORM TAB ══════════ */}
        {tab === "form" && (
          <form onSubmit={handleSubmit} className="space-y-4" noValidate>

            {/* ─ Section 1: Document info ─ */}
            <div className={cardCls}>
              <SectionTitle>ข้อมูลทั่วไป</SectionTitle>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Field label="วันที่" required>
                  <ThaiDateField className={inputCls} value={form.docDate} onChange={set("docDate")} />
                </Field>
                <div />
                {/* ดึงจากข้อมูลบุคลากรในระบบ — ดูได้อย่างเดียว (ไม่ได้ส่งไป backend ใช้พิมพ์ใบลา) */}
                <Field label="ข้าพเจ้า (ชื่อ-นามสกุล)" className="sm:col-span-2">
                  <input type="text" readOnly className={readonlyCls} value={form.fullName} placeholder={NO_DATA} />
                </Field>
                <Field label="ตำแหน่ง">
                  <input type="text" readOnly className={readonlyCls} value={form.position} placeholder={NO_DATA} />
                </Field>
                <Field label="สังกัด / แผนก">
                  <input type="text" readOnly className={readonlyCls} value={form.department} placeholder={NO_DATA} />
                </Field>
                <p className="sm:col-span-2 -mt-1 text-xs text-gray-500 dark:text-gray-400">
                  ข้อมูลนี้ดึงจากระบบอัตโนมัติ ถ้าไม่ถูกต้องแจ้งฝ่ายบุคคลให้แก้ไข
                </p>
              </div>
            </div>

            {/* ─ Section 2: Leave type ─ */}
            <div className={cardCls} data-tour="leave">
              <SectionTitle>ประเภทการลา</SectionTitle>
              {errors.leaveTypeId && (
                <p className="text-xs text-red-500 mb-2">{errors.leaveTypeId}</p>
              )}
              {leaveTypes.length === 0 ? (
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3" role="status" aria-busy="true">
                  <span className="sr-only">กำลังโหลดประเภทการลา…</span>
                  {Array.from({ length: 6 }).map((_, i) => (
                    <Skeleton key={i} rounded="rounded-xl" className="h-12" />
                  ))}
                </div>
              ) : (
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  {leaveTypes.map((lt) => {
                    const isSelected = form.leaveTypeId === lt.id
                    return (
                      <label
                        key={lt.id}
                        className={`flex items-center gap-2.5 rounded-xl border px-4 py-3 cursor-pointer transition-all select-none ${
                          isSelected
                            ? "border-indigo-500 bg-indigo-50 dark:bg-indigo-900/25 ring-1 ring-indigo-400"
                            : "border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50 hover:border-indigo-300 dark:hover:border-indigo-700"
                        }`}
                      >
                        <input
                          type="radio"
                          name="leaveType"
                          value={lt.id}
                          checked={isSelected}
                          onChange={() => selectLeaveType(lt)}
                          className="sr-only"
                        />
                        <span
                          className={`flex-shrink-0 w-4 h-4 rounded-full border-2 flex items-center justify-center transition-all ${
                            isSelected
                              ? "border-indigo-600 bg-indigo-600"
                              : "border-gray-300 dark:border-gray-600"
                          }`}
                        >
                          {isSelected && <span className="w-1.5 h-1.5 rounded-full bg-white" />}
                        </span>
                        <span
                          className={`text-sm font-medium ${
                            isSelected
                              ? "text-indigo-700 dark:text-indigo-300"
                              : "text-gray-700 dark:text-gray-300"
                          }`}
                        >
                          {getLeaveTypeName(lt)}
                        </span>
                      </label>
                    )
                  })}
                </div>
              )}

              {/* reason */}
              <div className="mt-4">
                <Field label="เนื่องจาก (เหตุผลการลา)">
                  <textarea
                    className={`${inputCls} resize-none`}
                    rows={3}
                    placeholder="อธิบายเหตุผลการลา"
                    value={form.reason}
                    onChange={set("reason")}
                  />
                </Field>
              </div>
            </div>

            {/* ─ Section 3: Date & time range ─ */}
            <div className={cardCls}>
              <SectionTitle>วันที่ลา</SectionTitle>

              {/* ช่วงเวลาการลา — เลือกครั้งเดียว ไม่ต้องกรอกเวลา */}
              <fieldset className="mb-4">
                <legend className="text-xs font-medium text-gray-600 dark:text-gray-400 mb-2">
                  ช่วงเวลาการลา<span aria-hidden="true" className="text-red-500 ml-0.5">*</span>
                </legend>
                <div className="grid grid-cols-3 gap-2">
                  {DAY_PART_KEYS.map((key) => {
                    const p = DAY_PARTS[key]
                    const active = form.dayPart === key
                    return (
                      <label
                        key={key}
                        className={`relative flex min-h-touch cursor-pointer flex-col items-center justify-center rounded-xl border px-2 py-2.5 text-center transition-colors duration-200 has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-indigo-400 ${
                          active
                            ? "border-indigo-500 bg-indigo-50 text-indigo-700 dark:border-indigo-400 dark:bg-indigo-500/15 dark:text-indigo-200"
                            : "border-gray-200 bg-white text-gray-700 hover:bg-gray-50 dark:border-line-field dark:bg-field dark:text-gray-200 dark:hover:bg-gray-700/40"
                        }`}
                      >
                        <input
                          type="radio"
                          name="dayPart"
                          value={key}
                          checked={active}
                          onChange={() => selectDayPart(key)}
                          className="sr-only"
                        />
                        <span className="text-sm font-semibold">{p.label}</span>
                        <span className={`text-xs tabular-nums ${active ? "text-indigo-600 dark:text-indigo-300" : "text-gray-500 dark:text-gray-400"}`}>
                          {p.hint}
                        </span>
                      </label>
                    )
                  })}
                </div>
              </fieldset>

              {form.dayPart === "full" ? (
                <div className="grid grid-cols-2 gap-3">
                  <Field label="ตั้งแต่วันที่" required>
                    <ThaiDateField
                      className={`${inputCls} ${errors.fromDate ? "!border-red-400 dark:!border-red-500 focus:!ring-red-400" : ""}`}
                      value={form.fromDate}
                      onChange={setFromDate}
                    />
                    <ErrMsg field="fromDate" />
                  </Field>
                  <Field label="ถึงวันที่" required>
                    <ThaiDateField
                      className={`${inputCls} ${errors.toDate ? "!border-red-400 dark:!border-red-500 focus:!ring-red-400" : ""}`}
                      value={form.toDate}
                      min={form.fromDate || undefined}
                      onChange={set("toDate")}
                    />
                    <ErrMsg field="toDate" />
                  </Field>
                </div>
              ) : (
                <Field label="วันที่ลา" required>
                  <ThaiDateField
                    className={`${inputCls} ${errors.fromDate ? "!border-red-400 dark:!border-red-500 focus:!ring-red-400" : ""}`}
                    value={form.fromDate}
                    onChange={setFromDate}
                  />
                  <ErrMsg field="fromDate" />
                </Field>
              )}

              {/* Total */}
              {totalDays > 0 && (
                <div className="mt-4 rounded-xl bg-indigo-50 dark:bg-indigo-900/20 px-4 py-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-semibold text-indigo-700 dark:text-indigo-300">
                      รวมระยะเวลาลาทั้งหมด
                    </span>
                    <span className="text-lg font-bold text-indigo-700 dark:text-indigo-300 tabular-nums">
                      {fmtLeaveDuration(totalDays, { fromTime: period.from })}
                    </span>
                  </div>
                  {calendarDays ? (
                    <p className="mt-1 text-xs text-indigo-700/90 dark:text-indigo-300/90">
                      ลาคลอดนับทุกวันตามปฏิทิน รวมวันเสาร์-อาทิตย์และวันหยุด
                    </p>
                  ) : excludedDays > 0 && (
                    <p className="mt-1 text-xs text-indigo-700/90 dark:text-indigo-300/90">
                      ไม่นับวันเสาร์-อาทิตย์และวันหยุดที่ประกาศไว้ {excludedDays} วัน
                    </p>
                  )}
                  {overMax && (
                    <p role="alert" className="mt-1.5 text-xs font-medium text-red-700 dark:text-red-300">
                      เกินจำนวนวันลาสูงสุดของ{form.leaveTypeName || "ประเภทนี้"} ({fmtDays(maxDays)} วัน) — ระบบจะไม่รับใบลานี้
                    </p>
                  )}
                  <p className="mt-1 text-xs text-gray-600 dark:text-gray-400 leading-relaxed">
                    {calendarDays
                      ? "เป็นการประมาณการ ระบบจะยืนยันจำนวนวันจริงเมื่อบันทึกใบลา"
                      : "เป็นการประมาณการจากปฏิทินวันหยุดปัจจุบัน ระบบจะยืนยันจำนวนวันจริงเมื่อบันทึกใบลา"}
                    {" "}หากลาเกินสิทธิ์ จะงดจ่ายเงินสำหรับวันที่เกิน
                  </p>
                </div>
              )}
            </div>

            {/* ─ Section 4: Contact during leave ─ */}
            <div className={cardCls}>
              <SectionTitle>ที่อยู่ติดต่อระหว่างลา</SectionTitle>
              <div className="space-y-3">
                <Field label="ที่อยู่ระหว่างลา">
                  <textarea
                    className={`${inputCls} resize-none`}
                    rows={3}
                    placeholder="ที่อยู่ที่ติดต่อได้ระหว่างลา"
                    value={form.addressDuringLeave}
                    onChange={set("addressDuringLeave")}
                  />
                </Field>
                <Field label="หมายเลขโทรศัพท์">
                  <input
                    type="tel"
                    className={inputCls}
                    placeholder="0XX-XXX-XXXX"
                    value={form.contactDuringLeave}
                    onChange={set("contactDuringLeave")}
                  />
                </Field>
              </div>
            </div>

            {/* ─ Section 5: Late filing reason ─ */}
            <div className={cardCls}>
              <SectionTitle>กรณียื่นใบลาล่าช้า (ถ้ามี)</SectionTitle>
              <Field label="กรณีไม่ได้เสนอใบลาล่วงหน้า หรือในวันเริ่มลา ข้าพเจ้าขอชี้แจงว่า">
                <textarea
                  className={`${inputCls} resize-none`}
                  rows={3}
                  placeholder="อธิบายเหตุผล (ถ้ามี)"
                  value={form.lateReason}
                  onChange={set("lateReason")}
                />
              </Field>
            </div>

            {/* ─ Section 6: Signature ─ */}
            <div className={cardCls}>
              <SectionTitle>ลงชื่อผู้ขออนุญาตลา</SectionTitle>
              <Field label="ลงชื่อ (ชื่อ-นามสกุล)">
                <input
                  type="text"
                  className={inputCls}
                  placeholder="ชื่อ-นามสกุล ผู้ขออนุญาตลา"
                  value={form.signatureName}
                  onChange={set("signatureName")}
                />
              </Field>
            </div>

            {submitError && <ErrorState message={submitError} />}

            {/* Submit */}
            <button
              type="submit"
              disabled={submitting}
              className="w-full h-12 rounded-xl bg-indigo-600 text-white font-semibold text-base hover:bg-indigo-500 active:bg-indigo-700 disabled:opacity-60 disabled:cursor-not-allowed transition shadow-sm cursor-pointer flex items-center justify-center gap-2"
            >
              {submitting ? (
                <>
                  <span className="h-4 w-4 rounded-full border-2 border-white/40 border-t-white animate-spin" />
                  กำลังส่ง...
                </>
              ) : (
                "ยื่นใบลา"
              )}
            </button>
          </form>
        )}

        {/* ══════════ HISTORY TAB ══════════ */}
        {tab === "history" && (
          <div className="space-y-3">
            {loadingHistory ? (
              <div className="space-y-3" role="status" aria-busy="true">
                <span className="sr-only">กำลังโหลดประวัติใบลา…</span>
                {Array.from({ length: 3 }).map((_, i) => (
                  <div key={i} className={`${cardCls} space-y-3`}>
                    <div className="flex items-center justify-between gap-2">
                      <Skeleton rounded="rounded-md" className="h-4 w-1/3" />
                      <Skeleton rounded="rounded-full" className="h-5 w-20" />
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <Skeleton rounded="rounded-md" className="h-3.5 w-3/4" />
                      <Skeleton rounded="rounded-md" className="h-3.5 w-1/2" />
                    </div>
                  </div>
                ))}
              </div>
            ) : historyError ? (
              <ErrorState message={historyError} onRetry={fetchHistory} />
            ) : history.length === 0 ? (
              <div className={cardCls}>
                <EmptyState
                  title="ยังไม่มีประวัติใบลา"
                  description='เมื่อคุณยื่นใบลา รายการจะแสดงที่นี่ เริ่มได้จากแท็บ "ยื่นใบลา"'
                />
              </div>
            ) : (
              history.map((r) => (
                <div key={r.id} className={`${cardCls} space-y-2`}>
                  <div className="flex items-center justify-between gap-2 flex-wrap">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="font-semibold text-gray-900 dark:text-gray-100">
                        {r.leave_type_name}
                      </p>
                      {r.status === "pending" ? (
                        <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${STATUS_COLOR.pending ?? "bg-gray-100 text-gray-600"}`}>
                          {STATUS_LABEL.pending}
                        </span>
                      ) : (
                        <StageBadge req={r} />
                      )}
                      <JustificationBadge req={r} />
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => handlePdfDownload(r.id)}
                        disabled={downloadingId === r.id}
                        className="px-3 py-1.5 rounded-lg bg-indigo-100 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300 text-xs font-semibold hover:bg-indigo-200 dark:hover:bg-indigo-900/50 disabled:opacity-60 disabled:cursor-not-allowed transition cursor-pointer flex items-center gap-1.5"
                      >
                        {downloadingId === r.id ? (
                          <>
                            <span className="h-3 w-3 rounded-full border-2 border-indigo-400/40 border-t-indigo-500 animate-spin" />
                            กำลังโหลด
                          </>
                        ) : (
                          <>
                            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                            </svg>
                            PDF
                          </>
                        )}
                      </button>
                      {(r.status === "pending" || isPendingStatus(r.status)) && (
                        <button
                          onClick={() => handleCancel(r.id)}
                          disabled={cancellingId === r.id}
                          className="px-3 py-1.5 rounded-lg bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300 text-xs font-semibold hover:bg-red-200 dark:hover:bg-red-900/50 disabled:opacity-60 disabled:cursor-not-allowed transition cursor-pointer"
                        >
                          {cancellingId === r.id ? "กำลังยกเลิก..." : "ยกเลิก"}
                        </button>
                      )}
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-sm">
                    <div>
                      <p className="text-xs text-gray-400 dark:text-gray-500">ช่วงวันลา</p>
                      <p className="font-medium text-gray-800 dark:text-gray-200">
                        {fmtDateShort(r.from_date)} – {fmtDateShort(r.to_date)}
                      </p>
                      {(r.from_time || r.to_time) && (
                        <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                          เวลา {fmtTime(r.from_time) ?? "—"} – {fmtTime(r.to_time) ?? "—"} น.
                        </p>
                      )}
                    </div>
                    <div>
                      <p className="text-xs text-gray-400 dark:text-gray-500">จำนวนวัน</p>
                      <p className="font-bold text-indigo-700 dark:text-indigo-300">
                        {fmtLeaveRowDuration(r)}
                      </p>
                    </div>
                  </div>
                  {r.address_during_leave && (
                    <p className="text-xs text-gray-500 dark:text-gray-400 bg-gray-50 dark:bg-gray-700/40 rounded-lg px-3 py-1.5">
                      ที่อยู่ระหว่างลา: {r.address_during_leave}
                      {r.contact_during_leave && ` · โทร. ${r.contact_during_leave}`}
                    </p>
                  )}
                  {r.comment && (
                    <p className="text-xs text-gray-500 dark:text-gray-400 bg-gray-50 dark:bg-gray-700/40 rounded-lg px-3 py-1.5">
                      เหตุผล: {r.comment}
                    </p>
                  )}
                  {r.justification === "unjust" && r.justification_note && (
                    <p className="text-xs text-rose-700 dark:text-rose-300 bg-rose-50 dark:bg-rose-900/20 rounded-lg px-3 py-1.5">
                      ผลตรวจ ไม่อนุมัติ: {r.justification_note}
                    </p>
                  )}
                  {(r.status === "rejected" || r.status === "denied") && (r.reject_reason || r.hr_comment) ? (
                    <p className="text-xs text-red-700 dark:text-red-300 bg-red-50 dark:bg-red-900/20 rounded-lg px-3 py-1.5">
                      เหตุผลที่ไม่อนุมัติ: {r.reject_reason || r.hr_comment}
                    </p>
                  ) : r.hr_comment && (
                    <p className="text-xs text-indigo-700 dark:text-indigo-300 bg-indigo-50 dark:bg-indigo-900/20 rounded-lg px-3 py-1.5">
                      ความเห็นผู้พิจารณา: {r.hr_comment}
                    </p>
                  )}
                  {r.extra_leave_days > 0 && (
                    <p className="text-xs text-amber-700 dark:text-amber-300 bg-amber-50 dark:bg-amber-900/20 rounded-lg px-3 py-1.5">
                      ลาเกินสิทธิ์ {r.extra_leave_days} วัน — งดจ่ายเงินส่วนที่เกิน
                    </p>
                  )}
                </div>
              ))
            )}
          </div>
        )}
      </div>
    </>
  )
}
