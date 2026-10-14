// src/pages/work/MyProfile.jsx
import { cx, baseField } from "../../lib/styles"
// ข้อมูลส่วนตัวของผู้ใช้ปัจจุบัน — GET /personnel/me + GET /personnel/me/financial
import { useEffect, useState } from "react"
import ReactDOM from "react-dom"
import { apiAuth } from "../../lib/api"
import { getUser } from "../../lib/auth"
import SelectDropdown from "../../components/SelectDropdown"
import { PageLoader, ErrorState, toast } from "../../components/ui"
import DateInput from "../../components/ThaiDateField"
import { fmtDays, parseDays } from "../../lib/leaveDays"
import lineIcon from "../../assets/line-icon.png"
import useModalDismiss from "../../lib/useModalDismiss"
import { roleLabel as getRoleLabel } from "../../lib/roles"
import { can, myRoleLabel } from "../../lib/permissions"

// LeaveQuotaOut (backend v1.1.0) — ทุกค่าเป็นทศนิยม ส่งมาเป็น string
// สิทธิ์เป็นค่าคงที่ ระบบคำนวณ "วันที่ใช้ไป" จากใบลาที่อนุมัติแล้วในปีงบประมาณเดียวกัน
const QUOTA_ROWS = [
  { key: "sick_leave",      label: "ลาป่วย" },
  { key: "business_leave",  label: "ลากิจส่วนตัว" },
  { key: "maturity_leave",  label: "ลาคลอดบุตร" },
  { key: "paternity_leave", label: "ลาช่วยภริยาคลอดบุตร" },
  { key: "religious_leave", label: "ลาอุปสมบท" },
  { key: "military_leave",  label: "ลารับราชการทหาร" },
  { key: "training_leave",  label: "ลาไปฝึกอบรม" },
  { key: "ow_leave",        label: "ลา อว." },
  { key: "accompany_leave", label: "ลาติดตามคู่สมรส" },
  { key: "rehab_leave",     label: "ลาฟื้นฟูสมรรถภาพ" },
  { key: "other_leave",     label: "อื่นๆ" },
  { key: "absent",          label: "ขาดงาน" },
]

const GENDER_LABEL = { M: "ชาย", F: "หญิง", other: "อื่นๆ" }
const MARITAL_LABEL = { single: "โสด", married: "สมรส", divorced: "หย่าร้าง", widowed: "หม้าย" }

/** สถานะคำร้องแจ้งแก้ไขข้อมูล (รายการของฉัน) */
const ISSUE_STATUS = {
  pending: { label: "รอ HR ตรวจสอบ", cls: "bg-amber-100 text-amber-800 dark:bg-amber-500/15 dark:text-amber-300" },
  approved: { label: "แก้ไขแล้ว", cls: "bg-emerald-100 text-emerald-800 dark:bg-emerald-500/15 dark:text-emerald-300" },
  applied: { label: "บันทึกแล้ว", cls: "bg-emerald-100 text-emerald-800 dark:bg-emerald-500/15 dark:text-emerald-300" },
  denied: { label: "ไม่อนุมัติ", cls: "bg-rose-100 text-rose-800 dark:bg-rose-500/15 dark:text-rose-300" },
  rejected: { label: "ไม่อนุมัติ", cls: "bg-rose-100 text-rose-800 dark:bg-rose-500/15 dark:text-rose-300" },
}
const FINANCIAL_OTHER = "financial_other"

function SectionTitle({ children }) {
  return (
    <h3 className="text-xs font-semibold text-indigo-700 dark:text-indigo-300 uppercase tracking-wide mb-3 pb-1 border-b border-indigo-100 dark:border-indigo-900/40">
      {children}
    </h3>
  )
}

function InfoRow({ label, value, mono }) {
  if (value == null || value === "") return null
  return (
    <div className="flex flex-col sm:flex-row sm:gap-4 py-2 border-b border-gray-100 dark:border-gray-700/50 last:border-0">
      <span className="text-xs font-medium text-gray-500 dark:text-gray-400 sm:w-44 shrink-0">{label}</span>
      <span className={`text-sm text-gray-900 dark:text-gray-100 mt-0.5 sm:mt-0 ${mono ? "font-mono tabular-nums" : ""}`}>{value}</span>
    </div>
  )
}

function fmtDate(d) {
  if (!d) return null
  try { return new Date(d).toLocaleDateString("th-TH", { year: "numeric", month: "long", day: "numeric" }) }
  catch { return d }
}
function fmtMoney(n) {
  if (n == null) return null
  return Number(n).toLocaleString("th-TH", { minimumFractionDigits: 2 }) + " บาท"
}
function maskCID(c) {
  if (!c || c.length < 4) return c
  return c[0] + "X".repeat(c.length - 4) + c.slice(-3)
}

const inputCls = cx(baseField, "!rounded-lg !px-3 !py-2 md:!text-sm")

export default function MyProfile() {
  const localUser = getUser() || {}

  const [profile, setProfile] = useState(null)
  const [financial, setFinancial] = useState(null)
  const [positions, setPositions] = useState([])
  const [branches, setBranches] = useState([])
  const [myBranches, setMyBranches] = useState(null) // { home_branch, extra_branches }
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")

  // Report-issue modal
  const [reportModal, setReportModal] = useState(false)
  const [reportForm, setReportForm] = useState({ category: "", field_name: "", current_value: "", correct_value: "", description: "" })
  const [reportSubmitting, setReportSubmitting] = useState(false)
  const [reportMsg, setReportMsg] = useState("")
  // หมวดหมู่ + ข้อมูลที่แก้ได้ จาก backend (ป้ายไทย, เรียงตามที่แสดง) — api-handoff-4 §4
  const [issueFields, setIssueFields] = useState({ status: "idle", list: [] })
  // คำร้องของฉัน + สถานะ
  const [myIssues, setMyIssues] = useState({ status: "loading", list: [] })
  const loadMyIssues = () => {
    setMyIssues((p) => ({ ...p, status: "loading" }))
    apiAuth("/personnel/me/issues")
      .then((d) => setMyIssues({ status: "ready", list: Array.isArray(d) ? d : Array.isArray(d?.items) ? d.items : [] }))
      .catch(() => setMyIssues({ status: "error", list: [] }))
  }
  useEffect(() => { loadMyIssues() }, [])
  const { backdropProps: reportBackdrop } = useModalDismiss(() => setReportModal(false), { open: reportModal, disabled: reportSubmitting })

  const loadProfile = () => {
    setLoading(true)
    setError("")
    Promise.all([
      apiAuth("/personnel/me"),
      apiAuth("/personnel/me/financial").catch(() => null),
      // GET /hr/positions ต้องมีสิทธิ์ตำแหน่ง/HR (backend PR #13) — พนักงานทั่วไปอ่านตำแหน่งตัวเองจาก /personnel/me/position
      can("hr.positions.view")
        ? apiAuth("/hr/positions").catch(() => [])
        : apiAuth("/personnel/me/position").then((p) => (p && typeof p === "object" && !Array.isArray(p) ? [p] : p)).catch(() => []),
      apiAuth("/order/branch/search").catch(() => []),
      apiAuth("/personnel/me/branches").catch(() => null),
    ])
      .then(([prof, fin, pos, bch, myBch]) => {
        setProfile(prof)
        setFinancial(fin)
        setPositions(Array.isArray(pos) ? pos : [])
        setBranches(Array.isArray(bch) ? bch : [])
        setMyBranches(myBch)
      })
      .catch(() => setError("ไม่สามารถโหลดข้อมูลโปรไฟล์ได้"))
      .finally(() => setLoading(false))
  }

  useEffect(() => { loadProfile() }, [])

  if (loading) {
    return (
      <div className="max-w-2xl mx-auto pb-10">
        <PageLoader variant="cards" rows={4} message="กำลังโหลดข้อมูลโปรไฟล์…" />
      </div>
    )
  }

  const pi = profile?.personnel_info ?? {}
  const addr = profile?.address ?? {}
  const edu = profile?.education ?? []
  const workExp = profile?.work_experiences ?? []
  const crimeRec = profile?.criminal_records ?? []
  const fin = financial?.financial ?? {}
  const quota = financial?.leave_quota ?? {}

  const positionName = positions.find((p) => p.id === profile?.position || String(p.id) === String(profile?.position))?.title ?? profile?.position
  const branchName = branches.find((b) => b.id === profile?.branch_location || String(b.id) === String(profile?.branch_location))?.branch_name ?? profile?.branch_location

  const displayName = profile?.first_name && profile?.last_name
    ? `${profile.first_name} ${profile.last_name}`
    : localUser.username || "ผู้ใช้"
  const avatarLetter = (displayName[0] || "U").toUpperCase()
  const roleLabel = profile?.role_id ? getRoleLabel(profile.role_id) : myRoleLabel()

  const addressParts = Object.keys(addr).length > 0
    ? [addr.h_address, addr.mhoo ? `หมู่ ${addr.mhoo}` : null, addr.soi ? `ซ.${addr.soi}` : null,
       addr.road ? `ถ.${addr.road}` : null, addr.sub_district, addr.district, addr.province, addr.postal_code]
        .filter(Boolean).join(" ")
    : null

  const openReportModal = () => {
    setReportForm({ category: "", field_name: "", current_value: "", correct_value: "", description: "" })
    setReportMsg("")
    setReportModal(true)
    if (issueFields.status !== "ready") {
      setIssueFields({ status: "loading", list: [] })
      apiAuth("/personnel/me/report-issue/fields")
        .then((d) => setIssueFields({ status: "ready", list: Array.isArray(d) ? d : [] }))
        .catch(() => setIssueFields({ status: "error", list: [] }))
    }
  }

  const handleReport = async (e) => {
    e.preventDefault()
    const isFinOther = reportForm.field_name === FINANCIAL_OTHER
    if (!reportForm.category || !reportForm.field_name) {
      setReportMsg("⚠️ กรุณาเลือกหมวดหมู่และข้อมูลที่ต้องการแก้")
      return
    }
    if (isFinOther ? !reportForm.description.trim() : !String(reportForm.correct_value).trim()) {
      setReportMsg(isFinOther ? "⚠️ กรุณาระบุรายละเอียด" : "⚠️ กรุณากรอกค่าที่ถูกต้อง")
      return
    }
    setReportSubmitting(true)
    setReportMsg("")
    try {
      // financial_other: ไม่มีค่าที่ถูกต้องเดียว — ส่ง "-" และใช้รายละเอียดแทน
      const body = { ...reportForm, correct_value: isFinOther ? "-" : String(reportForm.correct_value).trim() }
      const res = await apiAuth("/personnel/me/report-issue", { method: "POST", body })
      // applied = บันทึกทันที (ช่วงแก้ไขเองได้) · created = รอ HR
      if (res?.status === "applied") toast.success("บันทึกแล้ว", { description: "ข้อมูลของคุณถูกแก้ไขเรียบร้อย" })
      else toast.success("ส่งให้ฝ่าย HR แล้ว", { description: "ติดตามสถานะได้ที่ “คำร้องของฉัน”" })
      setReportModal(false)
      loadMyIssues()
      if (res?.status === "applied") setTimeout(() => window.location.reload(), 800)
    } catch (err) {
      if (err.status === 409) setReportMsg("⚠️ มีคำร้องสำหรับข้อมูลนี้รออยู่แล้ว")
      else setReportMsg(`❌ ${err.message || "ส่งคำร้องไม่สำเร็จ"}`)
    } finally {
      setReportSubmitting(false)
    }
  }

  const selectedCategory = issueFields.list.find((c) => c.category === reportForm.category)
  const selectedCategoryFields = selectedCategory?.fields ?? []
  const selectedField = selectedCategoryFields.find((f) => f.field === reportForm.field_name)
  const inputType = selectedField?.input_type || "text"
  const isFinOther = reportForm.field_name === FINANCIAL_OTHER

  return (
    <div className="max-w-2xl mx-auto space-y-5 pb-10">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <h1 className="text-xl font-bold text-gray-900 dark:text-gray-100">ข้อมูลส่วนตัว</h1>
        <button
          onClick={openReportModal}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-600 text-white text-sm font-semibold transition-all duration-200 shadow-sm hover:shadow-md active:scale-[0.97] cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-500 focus-visible:ring-offset-2"
        >
          <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="size-4">
            <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76Z" />
          </svg>
          แจ้งแก้ไขข้อมูล
        </button>
      </div>

      {/* Avatar Card */}
      <div className="rounded-2xl bg-gradient-to-br from-indigo-500 to-indigo-700 p-6 text-white shadow-md">
        <div className="flex items-center gap-4">
          <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl bg-white/20 text-2xl font-bold shadow-inner">
            {avatarLetter}
          </div>
          <div className="min-w-0">
            <p className="text-lg font-bold leading-tight">{displayName}</p>
            {positionName && <p className="text-sm text-indigo-200 mt-0.5">{positionName}</p>}
            <div className="mt-2 flex flex-wrap gap-2">
              <span className="inline-block rounded-full bg-white/20 px-3 py-0.5 text-xs font-semibold">{roleLabel}</span>
              {branchName && (
                <span className="inline-block rounded-full bg-white/20 px-3 py-0.5 text-xs font-semibold">{branchName}</span>
              )}
            </div>
          </div>
        </div>
      </div>

      {error && <ErrorState message={error} onRetry={loadProfile} />}

      {/* ข้อมูลบัญชี */}
      <div className="rounded-2xl bg-white dark:bg-gray-800 shadow-sm ring-1 ring-gray-200/70 dark:ring-gray-700/70 p-5">
        <SectionTitle>ข้อมูลบัญชี</SectionTitle>
        <InfoRow label="Username" value={profile?.username ?? localUser.username} mono />
        <InfoRow label="รหัสเจ้าหน้าที่" value={profile?.id ?? localUser.id} />
        <InfoRow label="ชื่อ-นามสกุล" value={displayName !== localUser.username ? displayName : null} />
        <InfoRow label="Email" value={profile?.email} />
        <InfoRow label="ตำแหน่งงาน" value={positionName} />
        <InfoRow label="สาขา" value={branchName} />
        <InfoRow label="สิทธิ์ผู้ใช้" value={roleLabel} />
        <InfoRow label="สถานะบัญชี" value={profile?.account_status} />
      </div>

      {/* สาขาที่เข้าถึงได้ — แสดงเฉพาะผู้ใช้ที่มีสาขาเพิ่มเติม */}
      {myBranches?.extra_branches?.length > 0 && (
        <div className="rounded-2xl bg-white dark:bg-gray-800 shadow-sm ring-1 ring-gray-200/70 dark:ring-gray-700/70 p-5">
          <SectionTitle>สาขาที่เข้าถึงได้</SectionTitle>
          <div className="flex flex-wrap gap-2">
            {myBranches.home_branch && (
              <span className="inline-flex items-center gap-1.5 rounded-xl bg-indigo-50 px-3 py-1.5 text-sm font-semibold text-indigo-700 ring-1 ring-indigo-200/70 dark:bg-indigo-900/30 dark:text-indigo-300 dark:ring-indigo-800/50">
                <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
                </svg>
                {myBranches.home_branch.branch_name}
                <span className="text-[11px] font-normal text-indigo-400 dark:text-indigo-300/70">สาขาหลัก</span>
              </span>
            )}
            {myBranches.extra_branches.map((b) => (
              <span key={b.id} className="inline-flex items-center rounded-xl bg-gray-100 px-3 py-1.5 text-sm font-medium text-gray-700 ring-1 ring-gray-200 dark:bg-gray-700/50 dark:text-gray-200 dark:ring-gray-600">
                {b.branch_name}
              </span>
            ))}
          </div>
          <p className="mt-3 text-xs text-gray-400 dark:text-gray-500">
            สลับสาขาที่กำลังดูได้จากเมนูสาขาด้านบนขวา
          </p>
        </div>
      )}

      {/* ข้อมูลส่วนบุคคล */}
      <div className="rounded-2xl bg-white dark:bg-gray-800 shadow-sm ring-1 ring-gray-200/70 dark:ring-gray-700/70 p-5">
        <SectionTitle>ข้อมูลส่วนบุคคล</SectionTitle>
        <InfoRow label="วันที่เริ่มงาน" value={fmtDate(pi.hired)} />
        <InfoRow label="เลขบัตรประชาชน" value={pi.cid ? maskCID(pi.cid) : null} mono />
        <InfoRow label="วันเกิด" value={fmtDate(pi.birthday)} />
        <InfoRow label="อายุ" value={pi.age != null ? `${pi.age} ปี` : null} />
        <InfoRow label="เพศ" value={GENDER_LABEL[pi.gender] ?? pi.gender} />
        <InfoRow label="สถานภาพสมรส" value={MARITAL_LABEL[pi.m_status] ?? pi.m_status} />
        <InfoRow label="จำนวนบุตร" value={pi.children_number != null ? `${pi.children_number} คน` : null} />
        <InfoRow label="เบอร์โทรศัพท์" value={pi.p_number} />
        <InfoRow label={<span className="flex items-center gap-1"><img src={lineIcon} alt="LINE" className="h-3.5 w-3.5 object-contain" />Line ID</span>} value={pi.line_id} />
        <InfoRow label="เบอร์ฉุกเฉิน" value={pi.e_contact} />
        <InfoRow label="เลขบัญชีธนาคาร" value={pi.bank_no} mono />
        <InfoRow label="โรคประจำตัว" value={pi.underlying_disease} />
        {!pi.hired && !pi.cid && !pi.p_number && (
          <p className="text-xs text-gray-400 dark:text-gray-500 text-center py-3 italic">ยังไม่มีข้อมูลส่วนบุคคล — กรุณาติดต่อฝ่าย HR</p>
        )}
      </div>

      {/* ที่อยู่ */}
      <div className="rounded-2xl bg-white dark:bg-gray-800 shadow-sm ring-1 ring-gray-200/70 dark:ring-gray-700/70 p-5">
        <SectionTitle>ที่อยู่</SectionTitle>
        {addressParts
          ? <p className="text-sm text-gray-800 dark:text-gray-200 leading-relaxed">{addressParts}</p>
          : <p className="text-xs text-gray-400 dark:text-gray-500 text-center py-3 italic">ยังไม่มีข้อมูลที่อยู่</p>
        }
      </div>

      {/* ประวัติการศึกษา */}
      <div className="rounded-2xl bg-white dark:bg-gray-800 shadow-sm ring-1 ring-gray-200/70 dark:ring-gray-700/70 p-5">
        <SectionTitle>ประวัติการศึกษา</SectionTitle>
        {edu.length > 0 ? (
          <div className="space-y-3">
            {edu.map((e, i) => (
              <div key={i} className="rounded-xl bg-gray-50 dark:bg-gray-700/40 p-3 text-sm space-y-0.5">
                <p className="font-semibold text-gray-800 dark:text-gray-200">{e.ed_level ?? "—"}</p>
                {e.inst_name && <p className="text-gray-600 dark:text-gray-400">{e.inst_name}</p>}
                {(e.from_date || e.to_date) && (
                  <p className="text-xs text-gray-500">{fmtDate(e.from_date)} – {e.to_date ? fmtDate(e.to_date) : "ปัจจุบัน"}</p>
                )}
              </div>
            ))}
          </div>
        ) : (
          <p className="text-xs text-gray-400 dark:text-gray-500 text-center py-3 italic">ยังไม่มีข้อมูลการศึกษา</p>
        )}
      </div>

      {/* ประวัติการทำงาน */}
      <div className="rounded-2xl bg-white dark:bg-gray-800 shadow-sm ring-1 ring-gray-200/70 dark:ring-gray-700/70 p-5">
        <SectionTitle>ประวัติการทำงาน</SectionTitle>
        {workExp.length > 0 ? (
          <div className="space-y-3">
            {workExp.map((w, i) => (
              <div key={i} className="rounded-xl bg-gray-50 dark:bg-gray-700/40 p-3 text-sm space-y-0.5">
                <p className="font-semibold text-gray-800 dark:text-gray-200">{w.company_name ?? "—"}</p>
                {w.position && <p className="text-gray-600 dark:text-gray-400">ตำแหน่ง: {w.position}</p>}
                {(w.from_date || w.to_date) && (
                  <p className="text-xs text-gray-500">{fmtDate(w.from_date)} – {w.to_date ? fmtDate(w.to_date) : "ปัจจุบัน"}</p>
                )}
              </div>
            ))}
          </div>
        ) : (
          <p className="text-xs text-gray-400 dark:text-gray-500 text-center py-3 italic">ยังไม่มีข้อมูลประวัติการทำงาน</p>
        )}
      </div>

      {/* ประวัติอาชญากรรม */}
      <div className="rounded-2xl bg-white dark:bg-gray-800 shadow-sm ring-1 ring-gray-200/70 dark:ring-gray-700/70 p-5">
        <SectionTitle>ประวัติอาชญากรรม</SectionTitle>
        {crimeRec.length > 0 ? (
          <div className="space-y-3">
            {crimeRec.map((c, i) => (
              <div key={i} className="rounded-xl bg-gray-50 dark:bg-gray-700/40 p-3 text-sm space-y-0.5">
                <p className="font-semibold text-gray-800 dark:text-gray-200">{c.charge ?? "—"}</p>
                {c.court && <p className="text-gray-600 dark:text-gray-400">ศาล: {c.court}</p>}
                {c.case_date && <p className="text-xs text-gray-500">วันที่คดี: {fmtDate(c.case_date)}</p>}
                {c.outcome && <p className="text-gray-600 dark:text-gray-400">ผล: {c.outcome}</p>}
              </div>
            ))}
          </div>
        ) : (
          <p className="text-xs text-gray-400 dark:text-gray-500 text-center py-3 italic">ไม่มีประวัติอาชญากรรม</p>
        )}
      </div>

      {/* ข้อมูลการเงิน */}
      {financial && (
        <div className="rounded-2xl bg-white dark:bg-gray-800 shadow-sm ring-1 ring-gray-200/70 dark:ring-gray-700/70 p-5">
          <SectionTitle>ข้อมูลทางการเงิน</SectionTitle>
          <InfoRow label="เงินเดือนปัจจุบัน" value={fmtMoney(fin.current_salary)} />
          <InfoRow label="อายุงาน" value={fin.job_age != null ? `${fin.job_age} ปี` : null} />
          <InfoRow label="เงินกู้สหกรณ์" value={fmtMoney(fin.current_loan)} />
          <InfoRow label="ประกันสังคม" value={fmtMoney(fin.current_ss)} />
          <InfoRow label="กองทุนสำรองเลี้ยงชีพ" value={fmtMoney(fin.current_prov)} />
        </div>
      )}

      {/* สิทธิ์การลา — LeaveQuotaOut (backend v1.1.0) */}
      {financial && Object.keys(quota).length > 0 && (
        <div className="rounded-2xl bg-white dark:bg-gray-800 shadow-sm ring-1 ring-gray-200/70 dark:ring-gray-700/70 p-5">
          <SectionTitle>สิทธิ์การลา ปีงบประมาณ {quota.year}</SectionTitle>

          {/* ลาพักผ่อน: สิทธิ์ปีนี้ + ยกมาจากปีก่อน = สิทธิ์รวม — อ่านแบบเดียวกับงบดุลของสหกรณ์ */}
          <div className="rounded-xl bg-indigo-50 dark:bg-indigo-900/20 p-4 mb-3">
            <p className="text-xs font-semibold text-indigo-900 dark:text-indigo-200 mb-2">ลาพักผ่อนประจำปี</p>
            <div className="space-y-1 text-sm">
              <div className="flex items-baseline justify-between">
                <span className="text-gray-600 dark:text-gray-400">สิทธิ์ปีนี้</span>
                <span className="font-medium text-gray-900 dark:text-gray-100 tabular-nums">{fmtDays(quota.annual_leave)} วัน</span>
              </div>
              <div className="flex items-baseline justify-between">
                <span className="text-gray-600 dark:text-gray-400">ยกมาจากปีก่อน</span>
                <span className="font-medium text-gray-900 dark:text-gray-100 tabular-nums">{fmtDays(quota.annual_leave_carried_over)} วัน</span>
              </div>
              <div className="flex items-baseline justify-between border-t border-indigo-200/70 dark:border-indigo-800/60 pt-1 mt-1">
                <span className="font-semibold text-indigo-900 dark:text-indigo-200">สิทธิ์รวม</span>
                <span className="text-lg font-bold text-indigo-700 dark:text-indigo-300 tabular-nums">
                  {fmtDays((parseDays(quota.annual_leave) ?? 0) + (parseDays(quota.annual_leave_carried_over) ?? 0))} วัน
                </span>
              </div>
            </div>
            {parseDays(quota.annual_leave) === 0 && (
              <p className="mt-2 text-xs text-gray-500 dark:text-gray-400 leading-relaxed">
                พนักงานที่บรรจุระหว่างปีงบประมาณจะยังไม่มีสิทธิ์ลาพักผ่อนในปีแรก
              </p>
            )}
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {QUOTA_ROWS.map((q) => (
              <div key={q.key} className="rounded-xl bg-gray-50 dark:bg-gray-700/40 p-3 text-center">
                <p className="text-xs text-gray-500 dark:text-gray-400">{q.label}</p>
                <p className="text-lg font-bold text-gray-800 dark:text-gray-100 mt-0.5 tabular-nums">{fmtDays(quota[q.key])}</p>
                <p className="text-xs text-gray-400 dark:text-gray-500">วัน/ปี</p>
              </div>
            ))}
            <div className="rounded-xl bg-gray-50 dark:bg-gray-700/40 p-3 text-center">
              <p className="text-xs text-gray-500 dark:text-gray-400">ลาทำหมัน</p>
              <p className="text-sm font-semibold text-gray-800 dark:text-gray-100 mt-1.5">ตามแพทย์สั่ง</p>
              <p className="text-xs text-gray-400 dark:text-gray-500">ไม่จำกัดวัน</p>
            </div>
          </div>

          <p className="mt-3 text-xs text-gray-400 dark:text-gray-500 leading-relaxed">
            ตัวเลขข้างต้นคือสิทธิ์ทั้งปี วันคงเหลือคำนวณจากใบลาที่อนุมัติแล้วในปีงบประมาณเดียวกัน
            ลาเกินสิทธิ์ทำได้ โดยส่วนที่เกินจะถูกหักจากเงินเดือน
          </p>
        </div>
      )}

      {/* คำร้องแจ้งแก้ไขข้อมูลของฉัน + สถานะ — GET /personnel/me/issues */}
      <div className="rounded-2xl bg-white dark:bg-gray-800 shadow-sm ring-1 ring-gray-200/70 dark:ring-gray-700/70 p-5">
        <SectionTitle>คำร้องแจ้งแก้ไขข้อมูลของฉัน</SectionTitle>
        {myIssues.status === "loading" ? (
          <p className="text-sm text-gray-500 dark:text-gray-400">กำลังโหลด…</p>
        ) : myIssues.status === "error" ? (
          <p className="text-sm text-red-600 dark:text-red-400">โหลดคำร้องไม่สำเร็จ</p>
        ) : myIssues.list.length === 0 ? (
          <p className="text-sm text-gray-500 dark:text-gray-400">ยังไม่มีคำร้อง</p>
        ) : (
          <ul className="divide-y divide-gray-100 dark:divide-gray-700/60">
            {myIssues.list.map((it) => {
              const st = ISSUE_STATUS[it.status] || { label: it.status || "-", cls: "bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300" }
              return (
                <li key={it.id} className="flex flex-wrap items-start justify-between gap-2 py-2.5">
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-gray-900 dark:text-gray-100">
                      {it.field_label || it.field_name}
                      <span className="font-normal text-gray-500 dark:text-gray-400"> · {it.category_label || it.category}</span>
                    </p>
                    {it.correct_value && it.correct_value !== "-" && (
                      <p className="text-xs text-gray-600 dark:text-gray-300 break-words">แก้เป็น: {it.correct_value}</p>
                    )}
                    {it.description && <p className="text-xs text-gray-500 dark:text-gray-400 break-words">{it.description}</p>}
                    {(it.hr_comment || it.deny_reason) && (
                      <p className="text-xs text-rose-700 dark:text-rose-300 break-words">HR: {it.hr_comment || it.deny_reason}</p>
                    )}
                  </div>
                  <div className="flex flex-col items-end gap-1">
                    <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${st.cls}`}>{st.label}</span>
                    {it.created_at && <span className="text-xs text-gray-400 dark:text-gray-500">{fmtDate(it.created_at)}</span>}
                  </div>
                </li>
              )
            })}
          </ul>
        )}
      </div>

      <p className="text-xs text-center text-gray-400 dark:text-gray-600">
        หากข้อมูลไม่ถูกต้อง กรุณาใช้ปุ่ม "แจ้งแก้ไขข้อมูล" ด้านบน
      </p>

      {/* Report Issue Modal */}
      {reportModal && ReactDOM.createPortal(
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm" {...reportBackdrop}>
          <div role="dialog" aria-modal="true" className="w-full max-w-md rounded-2xl bg-white dark:bg-gray-800 shadow-2xl p-6">
            <h3 className="flex items-center gap-2 text-lg font-bold text-gray-900 dark:text-gray-100 mb-4">
              <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="size-5 text-amber-500">
                <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76Z" />
              </svg>
              แจ้งแก้ไขข้อมูล
            </h3>
            <form onSubmit={handleReport} className="space-y-4">
              <div>
                <label className="text-xs font-medium text-gray-600 dark:text-gray-400 block mb-1">หมวดหมู่ <span className="text-red-500">*</span></label>
                <SelectDropdown
                  value={reportForm.category}
                  onChange={(val) => setReportForm((p) => ({ ...p, category: val, field_name: "" }))}
                  placeholder="— เลือกหมวดหมู่ —"
                  options={issueFields.list.filter((c) => (c.fields || []).length > 0).map((c) => ({ value: c.category, label: c.category_label || c.category }))}
                />
                {issueFields.status === "loading" && <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">กำลังโหลดรายการ…</p>}
                {issueFields.status === "error" && <p className="mt-1 text-xs text-red-600 dark:text-red-400">โหลดรายการไม่สำเร็จ ปิดแล้วเปิดใหม่อีกครั้ง</p>}
              </div>
              {reportForm.category && (
                <div>
                  <label className="text-xs font-medium text-gray-600 dark:text-gray-400 block mb-1">ข้อมูลที่ต้องการแก้ <span className="text-red-500">*</span></label>
                  <SelectDropdown
                    value={reportForm.field_name}
                    onChange={(val) => setReportForm((p) => ({ ...p, field_name: val, correct_value: "" }))}
                    placeholder="— เลือกข้อมูล —"
                    options={selectedCategoryFields.map((f) => ({ value: f.field, label: f.label || f.field }))}
                  />
                </div>
              )}
              {!isFinOther && (
                <>
                  <div>
                    <label className="text-xs font-medium text-gray-600 dark:text-gray-400 block mb-1">ค่าปัจจุบัน (ที่ผิด)</label>
                    <input type="text" value={reportForm.current_value} onChange={(e) => setReportForm((p) => ({ ...p, current_value: e.target.value }))} className={inputCls} placeholder="ค่าที่แสดงอยู่ตอนนี้" />
                  </div>
                  <div>
                    <label htmlFor="report-correct" className="text-xs font-medium text-gray-600 dark:text-gray-400 block mb-1">ค่าที่ถูกต้อง <span className="text-red-500">*</span></label>
                    {inputType === "date" ? (
                      <DateInput id="report-correct" ariaLabel="ค่าที่ถูกต้อง" value={reportForm.correct_value} onChange={(e) => setReportForm((p) => ({ ...p, correct_value: e.target.value }))} />
                    ) : inputType === "textarea" ? (
                      <textarea id="report-correct" rows={3} value={reportForm.correct_value} onChange={(e) => setReportForm((p) => ({ ...p, correct_value: e.target.value }))} className={inputCls + " resize-none"} placeholder="ค่าที่ควรจะเป็น" />
                    ) : (
                      <input
                        id="report-correct"
                        type={inputType === "int" ? "number" : "text"}
                        inputMode={inputType === "int" ? "numeric" : undefined}
                        step={inputType === "int" ? 1 : undefined}
                        value={reportForm.correct_value}
                        onChange={(e) => setReportForm((p) => ({ ...p, correct_value: e.target.value }))}
                        className={inputCls}
                        placeholder="ค่าที่ควรจะเป็น"
                      />
                    )}
                  </div>
                </>
              )}
              <div>
                <label htmlFor="report-desc" className="text-xs font-medium text-gray-600 dark:text-gray-400 block mb-1">
                  รายละเอียด{isFinOther ? <span className="text-red-500"> *</span> : " เพิ่มเติม"}
                </label>
                <textarea id="report-desc" value={reportForm.description} onChange={(e) => setReportForm((p) => ({ ...p, description: e.target.value }))} className={inputCls + " resize-none"} rows={isFinOther ? 4 : 2} placeholder={isFinOther ? "อธิบายว่าข้อมูลการเงินส่วนไหนไม่ถูกต้อง และควรเป็นอย่างไร" : "อธิบายเพิ่มเติม (ถ้ามี)"} />
              </div>
              {reportMsg && (
                <p className={`text-sm text-center ${reportMsg.startsWith("✅") ? "text-emerald-600" : "text-amber-600 dark:text-amber-400"}`}>{reportMsg}</p>
              )}
              <div className="flex gap-3">
                <button type="button" onClick={() => setReportModal(false)} className="flex-1 h-10 rounded-xl border border-gray-300 dark:border-gray-600 text-sm font-semibold text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 active:scale-[0.98] transition duration-200 cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2">ยกเลิก</button>
                <button type="submit" disabled={reportSubmitting} className="flex-1 inline-flex items-center justify-center gap-2 h-10 rounded-xl bg-amber-500 hover:bg-amber-600 disabled:opacity-60 disabled:cursor-not-allowed disabled:hover:scale-100 text-white text-sm font-semibold transition-all duration-200 active:scale-[0.97] cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-500 focus-visible:ring-offset-2">
                  {reportSubmitting ? (
                    <>
                      <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white" />
                      กำลังส่ง…
                    </>
                  ) : "ส่งคำร้อง"}
                </button>
              </div>
            </form>
          </div>
        </div>,
        document.body
      )}
    </div>
  )
}
