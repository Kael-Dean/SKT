// src/pages/work/MyProfile.jsx
// ข้อมูลส่วนตัวของผู้ใช้ปัจจุบัน — GET /personnel/me + GET /personnel/me/financial
import { useEffect, useState } from "react"
import ReactDOM from "react-dom"
import { apiAuth } from "../../lib/api"
import { getUser, getRoleId } from "../../lib/auth"
import SelectDropdown from "../../components/SelectDropdown"
import lineIcon from "../../assets/line-icon.png"

const ROLE_LABEL = { 1: "ผู้ดูแลระบบ", 2: "ผู้จัดการ", 3: "ฝ่ายบุคคล", 4: "หัวหน้าบัญชี", 5: "การตลาด" }
const GENDER_LABEL = { M: "ชาย", F: "หญิง", other: "อื่นๆ" }
const MARITAL_LABEL = { single: "โสด", married: "สมรส", divorced: "หย่าร้าง", widowed: "หม้าย" }

const REPORT_CATEGORIES = {
  personal_info: {
    label: "ข้อมูลส่วนตัว",
    fields: ["hired", "cid", "bank_no", "p_number", "line_id", "e_contact", "birthday", "age", "gender", "m_status", "children_number"],
  },
  address: {
    label: "ที่อยู่",
    fields: ["h_address", "mhoo", "soi", "road", "district", "sub_district", "province", "postal_code"],
  },
  financial: {
    label: "ข้อมูลการเงิน",
    fields: ["current_salary", "current_loan", "current_slf", "current_wg", "current_ss", "current_reserve", "current_prov", "current_pending", "job_age", "current_pension"],
  },
  account: { label: "บัญชีผู้ใช้", fields: ["email", "first_name", "last_name"] },
}

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
      <span className={`text-sm text-gray-900 dark:text-gray-100 mt-0.5 sm:mt-0 ${mono ? "font-mono" : ""}`}>{value}</span>
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

const inputCls = "w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 py-2 text-sm text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-indigo-500"

export default function MyProfile() {
  const localUser = getUser() || {}
  const roleId = getRoleId()

  const [profile, setProfile] = useState(null)
  const [financial, setFinancial] = useState(null)
  const [positions, setPositions] = useState([])
  const [branches, setBranches] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")

  // Report-issue modal
  const [reportModal, setReportModal] = useState(false)
  const [reportForm, setReportForm] = useState({ category: "", field_name: "", current_value: "", correct_value: "", description: "" })
  const [reportSubmitting, setReportSubmitting] = useState(false)
  const [reportMsg, setReportMsg] = useState("")

  useEffect(() => {
    setLoading(true)
    Promise.all([
      apiAuth("/personnel/me"),
      apiAuth("/personnel/me/financial").catch(() => null),
      apiAuth("/hr/positions").catch(() => []),
      apiAuth("/order/branch/search").catch(() => []),
    ])
      .then(([prof, fin, pos, bch]) => {
        setProfile(prof)
        setFinancial(fin)
        setPositions(Array.isArray(pos) ? pos : [])
        setBranches(Array.isArray(bch) ? bch : [])
      })
      .catch(() => setError("ไม่สามารถโหลดข้อมูลโปรไฟล์ได้"))
      .finally(() => setLoading(false))
  }, [])

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <div className="flex flex-col items-center gap-3">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-gray-200 border-t-indigo-500 dark:border-gray-700 dark:border-t-indigo-400" />
          <span className="text-sm text-gray-400 dark:text-gray-500">กำลังโหลดข้อมูล...</span>
        </div>
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
  const roleLabel = ROLE_LABEL[profile?.role_id ?? roleId] ?? `Role ${profile?.role_id ?? roleId}`

  const addressParts = Object.keys(addr).length > 0
    ? [addr.h_address, addr.mhoo ? `หมู่ ${addr.mhoo}` : null, addr.soi ? `ซ.${addr.soi}` : null,
       addr.road ? `ถ.${addr.road}` : null, addr.sub_district, addr.district, addr.province, addr.postal_code]
        .filter(Boolean).join(" ")
    : null

  const openReportModal = () => {
    setReportForm({ category: "", field_name: "", current_value: "", correct_value: "", description: "" })
    setReportMsg("")
    setReportModal(true)
  }

  const handleReport = async (e) => {
    e.preventDefault()
    if (!reportForm.category || !reportForm.field_name || !reportForm.correct_value) {
      setReportMsg("⚠️ กรุณากรอกข้อมูลให้ครบ")
      return
    }
    setReportSubmitting(true)
    setReportMsg("")
    try {
      await apiAuth("/personnel/me/report-issue", { method: "POST", body: reportForm })
      setReportMsg("✅ ส่งคำร้องสำเร็จ รอ HR ตรวจสอบ")
      setTimeout(() => setReportModal(false), 1500)
    } catch (err) {
      if (err.status === 409) setReportMsg("⚠️ มีคำร้องสำหรับ field นี้รออยู่แล้ว")
      else setReportMsg(`❌ ${err.message || "ส่งคำร้องไม่สำเร็จ"}`)
    } finally {
      setReportSubmitting(false)
    }
  }

  const selectedCategoryFields = REPORT_CATEGORIES[reportForm.category]?.fields ?? []

  return (
    <div className="max-w-2xl mx-auto space-y-5 pb-10">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <h1 className="text-xl font-bold text-gray-900 dark:text-gray-100">ข้อมูลส่วนตัว</h1>
        <button
          onClick={openReportModal}
          className="px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-white text-sm font-semibold transition shadow-sm cursor-pointer"
        >
          🔧 แจ้งแก้ไขข้อมูล
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

      {error && (
        <div className="rounded-xl bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 px-4 py-3 text-sm text-amber-700 dark:text-amber-300">
          ⚠️ {error}
        </div>
      )}

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

      {/* โควต้าการลา */}
      {financial && Object.keys(quota).length > 0 && (
        <div className="rounded-2xl bg-white dark:bg-gray-800 shadow-sm ring-1 ring-gray-200/70 dark:ring-gray-700/70 p-5">
          <SectionTitle>สิทธิ์การลา ปีงบประมาณ {quota.year}</SectionTitle>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {[
              { label: "ลาป่วย", days: quota.sick_leave },
              { label: "ลากิจ", days: quota.business_leave },
              { label: "ลาพักร้อน", days: quota.annual_leave },
              { label: "ลาคลอด", days: quota.maternity_leave },
              { label: "ลาเลี้ยงดูบุตร", days: quota.paternity_leave },
            ].filter((q) => q.days > 0).map((q) => (
              <div key={q.label} className="rounded-xl bg-indigo-50 dark:bg-indigo-900/20 p-3 text-center">
                <p className="text-xs text-gray-500 dark:text-gray-400">{q.label}</p>
                <p className="text-lg font-bold text-indigo-700 dark:text-indigo-300 mt-0.5">{q.days}</p>
                <p className="text-xs text-gray-400">วัน/ปี</p>
              </div>
            ))}
          </div>
        </div>
      )}

      <p className="text-xs text-center text-gray-400 dark:text-gray-600">
        หากข้อมูลไม่ถูกต้อง กรุณาใช้ปุ่ม "แจ้งแก้ไขข้อมูล" ด้านบน
      </p>

      {/* Report Issue Modal */}
      {reportModal && ReactDOM.createPortal(
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-2xl bg-white dark:bg-gray-800 shadow-2xl p-6">
            <h3 className="text-lg font-bold text-gray-900 dark:text-gray-100 mb-4">🔧 แจ้งแก้ไขข้อมูล</h3>
            <form onSubmit={handleReport} className="space-y-4">
              <div>
                <label className="text-xs font-medium text-gray-600 dark:text-gray-400 block mb-1">หมวดหมู่ <span className="text-red-500">*</span></label>
                <SelectDropdown
                  value={reportForm.category}
                  onChange={(val) => setReportForm((p) => ({ ...p, category: val, field_name: "" }))}
                  placeholder="— เลือกหมวดหมู่ —"
                  options={Object.entries(REPORT_CATEGORIES).map(([k, v]) => ({ value: k, label: v.label }))}
                />
              </div>
              {reportForm.category && (
                <div>
                  <label className="text-xs font-medium text-gray-600 dark:text-gray-400 block mb-1">ชื่อ Field <span className="text-red-500">*</span></label>
                  <SelectDropdown
                    value={reportForm.field_name}
                    onChange={(val) => setReportForm((p) => ({ ...p, field_name: val }))}
                    placeholder="— เลือก field —"
                    options={selectedCategoryFields.map((f) => ({ value: f, label: f }))}
                  />
                </div>
              )}
              <div>
                <label className="text-xs font-medium text-gray-600 dark:text-gray-400 block mb-1">ค่าปัจจุบัน (ที่ผิด)</label>
                <input type="text" value={reportForm.current_value} onChange={(e) => setReportForm((p) => ({ ...p, current_value: e.target.value }))} className={inputCls} placeholder="ค่าที่แสดงอยู่ตอนนี้" />
              </div>
              <div>
                <label className="text-xs font-medium text-gray-600 dark:text-gray-400 block mb-1">ค่าที่ถูกต้อง <span className="text-red-500">*</span></label>
                <input type="text" value={reportForm.correct_value} onChange={(e) => setReportForm((p) => ({ ...p, correct_value: e.target.value }))} className={inputCls} placeholder="ค่าที่ควรจะเป็น" required />
              </div>
              <div>
                <label className="text-xs font-medium text-gray-600 dark:text-gray-400 block mb-1">รายละเอียดเพิ่มเติม</label>
                <textarea value={reportForm.description} onChange={(e) => setReportForm((p) => ({ ...p, description: e.target.value }))} className={inputCls + " resize-none"} rows={2} placeholder="อธิบายเพิ่มเติม (ถ้ามี)" />
              </div>
              {reportMsg && (
                <p className={`text-sm text-center ${reportMsg.startsWith("✅") ? "text-emerald-600" : "text-amber-600 dark:text-amber-400"}`}>{reportMsg}</p>
              )}
              <div className="flex gap-3">
                <button type="button" onClick={() => setReportModal(false)} className="flex-1 h-10 rounded-xl border border-gray-300 dark:border-gray-600 text-sm font-semibold text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700 transition cursor-pointer">ยกเลิก</button>
                <button type="submit" disabled={reportSubmitting} className="flex-1 h-10 rounded-xl bg-amber-500 hover:bg-amber-400 disabled:opacity-60 text-white text-sm font-semibold transition cursor-pointer">
                  {reportSubmitting ? "กำลังส่ง..." : "ส่งคำร้อง"}
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
