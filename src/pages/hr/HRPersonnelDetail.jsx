// src/pages/hr/HRPersonnelDetail.jsx
// โปรไฟล์เจ้าหน้าที่แบบเต็ม — GET /hr/personnel/{user_id}
import { useEffect, useState } from "react"
import ReactDOM from "react-dom"
import { useParams, useNavigate } from "react-router-dom"
import { apiAuth } from "../../lib/api"
import lineIcon from "../../assets/line-icon.png"

const ROLE_LABEL = { 1: "ผู้ดูแลระบบ", 2: "ผู้จัดการ", 3: "ฝ่ายบุคคล", 4: "หัวหน้าบัญชี", 5: "การตลาด" }

function fmt(n) {
  if (n == null) return "—"
  return Number(n).toLocaleString("th-TH", { minimumFractionDigits: 2 }) + " บาท"
}

function fmtDate(d) {
  if (!d) return "—"
  try { return new Date(d).toLocaleDateString("th-TH", { year: "numeric", month: "long", day: "numeric" }) }
  catch { return d }
}

function SectionTitle({ children }) {
  return (
    <h3 className="text-xs font-semibold text-indigo-700 dark:text-indigo-300 uppercase tracking-wide mb-3 pb-1 border-b border-indigo-100 dark:border-indigo-900/40">
      {children}
    </h3>
  )
}

function InfoRow({ label, value }) {
  if (value == null || value === "") return null
  return (
    <div className="flex flex-col sm:flex-row sm:gap-4 py-2 border-b border-gray-100 dark:border-gray-700/50 last:border-0">
      <span className="text-xs font-medium text-gray-500 dark:text-gray-400 sm:w-44 shrink-0">{label}</span>
      <span className="text-sm text-gray-900 dark:text-gray-100 mt-0.5 sm:mt-0">{value}</span>
    </div>
  )
}

const inputCls = "w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-3 py-2 text-sm text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-indigo-500"

export default function HRPersonnelDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")

  // Financial edit modal
  const [editModal, setEditModal] = useState(false)
  const [editForm, setEditForm] = useState({ current_salary: "", current_loan: "", job_age: "" })
  const [saving, setSaving] = useState(false)
  const [saveMsg, setSaveMsg] = useState("")

  // Family edit modal
  const [familyModal, setFamilyModal] = useState(false)
  const [familyForm, setFamilyForm] = useState({ spouse: null, hasSpouse: false, children: [], parents: [] })
  const [familySaving, setFamilySaving] = useState(false)
  const [familySaveMsg, setFamilySaveMsg] = useState("")

  const fetchDetail = () => {
    setLoading(true)
    apiAuth(`/hr/personnel/${id}`)
      .then(setData)
      .catch((e) => setError(e.message || "โหลดข้อมูลไม่สำเร็จ"))
      .finally(() => setLoading(false))
  }

  useEffect(() => { fetchDetail() }, [id])

  const openEditModal = () => {
    const fin = data?.financial ?? {}
    setEditForm({
      current_salary: fin.current_salary ?? "",
      current_loan: fin.current_loan ?? "",
      job_age: fin.job_age ?? "",
    })
    setSaveMsg("")
    setEditModal(true)
  }

  const handleSaveFinancial = async () => {
    setSaving(true)
    setSaveMsg("")
    try {
      const body = {}
      if (editForm.current_salary !== "") body.current_salary = parseFloat(editForm.current_salary)
      if (editForm.current_loan !== "") body.current_loan = parseFloat(editForm.current_loan)
      if (editForm.job_age !== "") body.job_age = parseInt(editForm.job_age)
      await apiAuth(`/hr/financial/${id}`, { method: "POST", body })
      setSaveMsg("✅ บันทึกสำเร็จ")
      setTimeout(() => { setEditModal(false); fetchDetail() }, 800)
    } catch (err) {
      setSaveMsg(`❌ ${err.message || "บันทึกไม่สำเร็จ"}`)
    } finally {
      setSaving(false)
    }
  }

  const openFamilyModal = () => {
    const s = data.spouse
    setFamilyForm({
      hasSpouse: s != null,
      spouse: s ? {
        spouse_name: s.spouse_name ?? "",
        spouse_occupation: s.spouse_occupation ?? "",
        spouse_birthday: s.spouse_birthday ?? "",
        spouse_marriage_status: s.spouse_marriage_status ?? "",
        spouse_phone: s.spouse_phone ?? "",
      } : { spouse_name: "", spouse_occupation: "", spouse_birthday: "", spouse_marriage_status: "", spouse_phone: "" },
      children: (data.children ?? []).map(c => ({
        child_name: c.child_name ?? "",
        child_birthday: c.child_birthday ?? "",
        child_gender: c.child_gender ?? "",
        child_legal_status: c.child_legal_status ?? "",
      })),
      parents: (data.parents ?? []).map(p => ({
        parent_type: p.parent_type ?? "",
        parent_name: p.parent_name ?? "",
        parent_birthday: p.parent_birthday ?? "",
        parent_employment_status: p.parent_employment_status ?? "",
      })),
    })
    setFamilySaveMsg("")
    setFamilyModal(true)
  }

  const handleSaveFamily = async () => {
    setFamilySaving(true)
    setFamilySaveMsg("")
    try {
      const spousePayload = familyForm.hasSpouse && familyForm.spouse?.spouse_name?.trim()
        ? {
            spouse_name: familyForm.spouse.spouse_name.trim(),
            ...(familyForm.spouse.spouse_occupation && { spouse_occupation: familyForm.spouse.spouse_occupation.trim() }),
            ...(familyForm.spouse.spouse_birthday && { spouse_birthday: familyForm.spouse.spouse_birthday }),
            ...(familyForm.spouse.spouse_marriage_status && { spouse_marriage_status: familyForm.spouse.spouse_marriage_status }),
            ...(familyForm.spouse.spouse_phone && { spouse_phone: familyForm.spouse.spouse_phone.trim() }),
          }
        : null

      const body = {
        spouse: spousePayload,
        children: familyForm.children
          .filter(c => c.child_name.trim() && c.child_birthday)
          .map(c => ({
            child_name: c.child_name.trim(),
            child_birthday: c.child_birthday,
            ...(c.child_gender && { child_gender: c.child_gender }),
            ...(c.child_legal_status && { child_legal_status: c.child_legal_status }),
          })),
        parents: familyForm.parents
          .filter(p => p.parent_type && p.parent_name.trim())
          .map(p => ({
            parent_type: p.parent_type,
            parent_name: p.parent_name.trim(),
            ...(p.parent_birthday && { parent_birthday: p.parent_birthday }),
            ...(p.parent_employment_status && { parent_employment_status: p.parent_employment_status }),
          })),
      }

      await apiAuth(`/hr/employees/${id}/personal`, { method: "PATCH", body })
      setFamilySaveMsg("✅ บันทึกสำเร็จ")
      setTimeout(() => { setFamilyModal(false); fetchDetail() }, 800)
    } catch (err) {
      setFamilySaveMsg(`❌ ${err.message || "บันทึกไม่สำเร็จ"}`)
    } finally {
      setFamilySaving(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-gray-200 border-t-indigo-500 dark:border-gray-700 dark:border-t-indigo-400" />
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex items-start gap-2.5 rounded-xl bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 px-4 py-3 text-sm text-red-700 dark:text-red-300">
          <svg className="mt-0.5 h-4 w-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
          </svg>
          <span>{error}</span>
        </div>
    )
  }

  if (!data) return null

  const pi = data.personnel_info ?? {}
  const addr = data.address ?? {}
  const fin = data.financial ?? {}
  const quota = data.leave_quota ?? {}
  const edu = data.education ?? []
  const relHist = data.relocation_history ?? []
  const workExp = data.work_experiences ?? []
  const crimeRec = data.criminal_records ?? []
  const spouse = data.spouse ?? null
  const childrenList = data.children ?? []
  const parentsList = data.parents ?? []

  return (
    <div className="space-y-5 pb-10 max-w-4xl">
      {/* Header */}
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-3">
          <div className="h-12 w-12 rounded-2xl bg-indigo-100 dark:bg-indigo-900/30 flex items-center justify-center text-xl font-bold text-indigo-700 dark:text-indigo-300">
            {data.first_name?.[0] ?? "?"}
          </div>
          <div>
            <h1 className="text-xl font-bold text-gray-900 dark:text-gray-100">
              {data.first_name} {data.last_name}
            </h1>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              @{data.username} · {ROLE_LABEL[data.role_id] ?? `Role ${data.role_id}`}
              {!data.is_active && (
                <span className="ml-2 rounded-full bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300 px-2 py-0.5 text-xs font-semibold">
                  ไม่ใช้งาน
                </span>
              )}
            </p>
          </div>
        </div>
        <div className="flex gap-2 flex-wrap">
          <button
            onClick={openEditModal}
            className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-semibold transition shadow-sm cursor-pointer"
          >
            แก้ไขข้อมูลการเงิน
          </button>
          <button
            onClick={openFamilyModal}
            className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-semibold transition shadow-sm cursor-pointer"
          >
            แก้ไขข้อมูลครอบครัว
          </button>
          {data.is_active && (
            <button
              onClick={() => navigate("/hr/dashboard?tab=termination")}
              className="px-4 py-2 rounded-xl bg-red-600 hover:bg-red-500 text-white text-sm font-semibold transition shadow-sm cursor-pointer"
            >
              🚪 ออกจากงาน
            </button>
          )}
        </div>
      </div>

      {/* ข้อมูลบัญชี */}
      <div className="rounded-2xl bg-white dark:bg-gray-800 ring-1 ring-gray-200/70 dark:ring-gray-700/70 shadow-sm p-5">
        <SectionTitle>ข้อมูลบัญชี</SectionTitle>
        <InfoRow label="Email" value={data.email} />
        <InfoRow label="สาขา" value={data.branch_location} />
        <InfoRow label="ตำแหน่ง" value={data.position} />
        <InfoRow label="สถานะบัญชี" value={data.account_status} />
      </div>

      {/* ข้อมูลส่วนตัว */}
      {Object.keys(pi).length > 0 && (
        <div className="rounded-2xl bg-white dark:bg-gray-800 ring-1 ring-gray-200/70 dark:ring-gray-700/70 shadow-sm p-5">
          <SectionTitle>ข้อมูลส่วนตัว</SectionTitle>
          <InfoRow label="เลขบัตรประชาชน" value={pi.cid} />
          <InfoRow label="วันเกิด" value={fmtDate(pi.birthday)} />
          <InfoRow label="อายุ" value={pi.age ? `${pi.age} ปี` : null} />
          <InfoRow label="เพศ" value={pi.gender} />
          <InfoRow label="สถานภาพสมรส" value={pi.m_status} />
          <InfoRow label="จำนวนบุตร" value={pi.children_number != null ? `${pi.children_number} คน` : null} />
          <InfoRow label="เบอร์โทรศัพท์" value={pi.p_number} />
          <InfoRow label={<span className="flex items-center gap-1"><img src={lineIcon} alt="LINE" className="h-3.5 w-3.5 object-contain" />Line ID</span>} value={pi.line_id} />
          <InfoRow label="เบอร์ฉุกเฉิน" value={pi.e_contact} />
          <InfoRow label="เลขบัญชีธนาคาร" value={pi.bank_no} />
          <InfoRow label="วันที่เริ่มงาน" value={fmtDate(pi.hired)} />
          <InfoRow label="โรคประจำตัว" value={pi.underlying_disease} />
        </div>
      )}

      {/* ที่อยู่ */}
      {Object.keys(addr).length > 0 && (
        <div className="rounded-2xl bg-white dark:bg-gray-800 ring-1 ring-gray-200/70 dark:ring-gray-700/70 shadow-sm p-5">
          <SectionTitle>ที่อยู่</SectionTitle>
          <InfoRow label="บ้านเลขที่" value={addr.h_address} />
          <InfoRow label="หมู่" value={addr.mhoo} />
          <InfoRow label="ซอย" value={addr.soi} />
          <InfoRow label="ถนน" value={addr.road} />
          <InfoRow label="ตำบล/แขวง" value={addr.sub_district} />
          <InfoRow label="อำเภอ/เขต" value={addr.district} />
          <InfoRow label="จังหวัด" value={addr.province} />
          <InfoRow label="รหัสไปรษณีย์" value={addr.postal_code} />
        </div>
      )}

      {/* ข้อมูลการเงิน */}
      {Object.keys(fin).length > 0 && (
        <div className="rounded-2xl bg-white dark:bg-gray-800 ring-1 ring-gray-200/70 dark:ring-gray-700/70 shadow-sm p-5">
          <SectionTitle>ข้อมูลการเงิน</SectionTitle>
          <InfoRow label="เงินเดือนปัจจุบัน" value={fmt(fin.current_salary)} />
          <InfoRow label="เงินกู้คงเหลือ" value={fmt(fin.current_loan)} />
          <InfoRow label="อายุงาน" value={fin.job_age != null ? `${fin.job_age} ปี` : null} />
          <InfoRow label="ประกันสังคม" value={fmt(fin.current_ss)} />
          <InfoRow label="กองทุนสำรอง" value={fmt(fin.current_prov)} />
        </div>
      )}

      {/* โควต้าการลา */}
      {Object.keys(quota).length > 0 && (
        <div className="rounded-2xl bg-white dark:bg-gray-800 ring-1 ring-gray-200/70 dark:ring-gray-700/70 shadow-sm p-5">
          <SectionTitle>โควต้าการลา (ปี {quota.year})</SectionTitle>
          <InfoRow label="ลาป่วย" value={quota.sick_leave != null ? `${quota.sick_leave} วัน` : null} />
          <InfoRow label="ลากิจ" value={quota.business_leave != null ? `${quota.business_leave} วัน` : null} />
          <InfoRow label="ลาพักร้อน" value={quota.annual_leave != null ? `${quota.annual_leave} วัน` : null} />
        </div>
      )}

      {/* ประวัติการศึกษา */}
      {edu.length > 0 && (
        <div className="rounded-2xl bg-white dark:bg-gray-800 ring-1 ring-gray-200/70 dark:ring-gray-700/70 shadow-sm p-5">
          <SectionTitle>ประวัติการศึกษา</SectionTitle>
          {edu.map((e, i) => (
            <div key={i} className="py-2 border-b border-gray-100 dark:border-gray-700/50 last:border-0">
              <p className="font-semibold text-sm text-gray-900 dark:text-gray-100">{e.ed_level ?? "—"}</p>
              <p className="text-xs text-gray-500 dark:text-gray-400">{e.inst_name}</p>
              {(e.from_date || e.to_date) && (
                <p className="text-xs text-gray-400">{fmtDate(e.from_date)} — {e.to_date ? fmtDate(e.to_date) : "ปัจจุบัน"}</p>
              )}
            </div>
          ))}
        </div>
      )}

      {/* ประวัติการทำงาน */}
      {workExp.length > 0 && (
        <div className="rounded-2xl bg-white dark:bg-gray-800 ring-1 ring-gray-200/70 dark:ring-gray-700/70 shadow-sm p-5">
          <SectionTitle>ประวัติการทำงาน</SectionTitle>
          {workExp.map((w, i) => (
            <div key={i} className="py-2 border-b border-gray-100 dark:border-gray-700/50 last:border-0">
              <p className="font-semibold text-sm text-gray-900 dark:text-gray-100">{w.company_name ?? "—"}</p>
              {w.position && <p className="text-xs text-gray-500 dark:text-gray-400">ตำแหน่ง: {w.position}</p>}
              {(w.from_date || w.to_date) && (
                <p className="text-xs text-gray-400">{fmtDate(w.from_date)} — {w.to_date ? fmtDate(w.to_date) : "ปัจจุบัน"}</p>
              )}
            </div>
          ))}
        </div>
      )}

      {/* ประวัติอาชญากรรม */}
      {crimeRec.length > 0 && (
        <div className="rounded-2xl bg-white dark:bg-gray-800 ring-1 ring-gray-200/70 dark:ring-gray-700/70 shadow-sm p-5">
          <SectionTitle>ประวัติอาชญากรรม</SectionTitle>
          {crimeRec.map((c, i) => (
            <div key={i} className="py-2 border-b border-gray-100 dark:border-gray-700/50 last:border-0">
              <p className="font-semibold text-sm text-gray-900 dark:text-gray-100">{c.charge ?? "—"}</p>
              {c.court && <p className="text-xs text-gray-500 dark:text-gray-400">ศาล: {c.court}</p>}
              {c.case_date && <p className="text-xs text-gray-400">วันที่คดี: {fmtDate(c.case_date)}</p>}
              {c.outcome && <p className="text-xs text-gray-500 dark:text-gray-400">ผล: {c.outcome}</p>}
            </div>
          ))}
        </div>
      )}

      {/* คู่สมรส */}
      {spouse && (
        <div className="rounded-2xl bg-white dark:bg-gray-800 ring-1 ring-gray-200/70 dark:ring-gray-700/70 shadow-sm p-5">
          <SectionTitle>คู่สมรส</SectionTitle>
          <InfoRow label="ชื่อ-นามสกุล" value={spouse.spouse_name} />
          <InfoRow label="อาชีพ" value={spouse.spouse_occupation} />
          <InfoRow label="วันเกิด" value={fmtDate(spouse.spouse_birthday)} />
          <InfoRow label="อายุ" value={spouse.spouse_age != null ? `${spouse.spouse_age} ปี` : null} />
          <InfoRow label="สถานภาพการสมรส" value={spouse.spouse_marriage_status === "registered" ? "จดทะเบียนสมรส" : spouse.spouse_marriage_status === "unregistered" ? "ไม่ได้จดทะเบียน" : null} />
          <InfoRow label="เบอร์โทร" value={spouse.spouse_phone} />
        </div>
      )}

      {/* บุตร */}
      {childrenList.length > 0 && (
        <div className="rounded-2xl bg-white dark:bg-gray-800 ring-1 ring-gray-200/70 dark:ring-gray-700/70 shadow-sm p-5">
          <SectionTitle>บุตร ({childrenList.length} คน)</SectionTitle>
          {childrenList.map((c, i) => (
            <div key={c.id ?? i} className="py-2 border-b border-gray-100 dark:border-gray-700/50 last:border-0">
              <p className="font-semibold text-sm text-gray-900 dark:text-gray-100">{c.child_name}</p>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                วันเกิด: {fmtDate(c.child_birthday)}
                {c.child_age != null && ` · ${c.child_age} ปี`}
              </p>
              {c.child_gender && <p className="text-xs text-gray-400">เพศ: {c.child_gender === "male" ? "ชาย" : "หญิง"}</p>}
              {c.child_legal_status && (
                <p className="text-xs text-gray-400">
                  สถานะ: {c.child_legal_status === "legitimate" ? "บุตรชอบด้วยกฎหมาย" : c.child_legal_status === "illegitimate" ? "บุตรนอกกฎหมาย" : "บุตรบุญธรรม"}
                </p>
              )}
            </div>
          ))}
        </div>
      )}

      {/* บิดา-มารดา */}
      {parentsList.length > 0 && (
        <div className="rounded-2xl bg-white dark:bg-gray-800 ring-1 ring-gray-200/70 dark:ring-gray-700/70 shadow-sm p-5">
          <SectionTitle>บิดา-มารดา</SectionTitle>
          {parentsList.map((p, i) => (
            <div key={p.id ?? i} className="py-2 border-b border-gray-100 dark:border-gray-700/50 last:border-0">
              <p className="font-semibold text-sm text-gray-900 dark:text-gray-100">
                {p.parent_type === "father" ? "บิดา" : "มารดา"}: {p.parent_name}
              </p>
              {p.parent_birthday && (
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  วันเกิด: {fmtDate(p.parent_birthday)}
                  {p.parent_age != null && ` · ${p.parent_age} ปี`}
                </p>
              )}
              {p.parent_employment_status && (
                <p className="text-xs text-gray-400">
                  สถานะ: {
                    p.parent_employment_status === "working" ? "ทำงาน" :
                    p.parent_employment_status === "retired" ? "เกษียณ" :
                    p.parent_employment_status === "deceased" ? "เสียชีวิต" : "ไม่ทราบ"
                  }
                </p>
              )}
            </div>
          ))}
        </div>
      )}

      {/* ประวัติย้ายสาขา */}
      {relHist.length > 0 && (
        <div className="rounded-2xl bg-white dark:bg-gray-800 ring-1 ring-gray-200/70 dark:ring-gray-700/70 shadow-sm p-5">
          <SectionTitle>ประวัติย้ายสาขา</SectionTitle>
          {relHist.map((r, i) => (
            <div key={i} className="py-2 border-b border-gray-100 dark:border-gray-700/50 last:border-0 flex items-center gap-3 text-sm">
              <span className="text-gray-600 dark:text-gray-400">{fmtDate(r.date)}</span>
              <span className="text-gray-400">→</span>
              <span className="font-semibold text-gray-900 dark:text-gray-100">{r.location_id}</span>
            </div>
          ))}
        </div>
      )}

      {/* Family Edit Modal */}
      {familyModal && ReactDOM.createPortal(
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="w-full max-w-2xl rounded-2xl bg-white dark:bg-gray-800 shadow-2xl p-6 space-y-4 max-h-[90vh] overflow-y-auto">
            <h3 className="text-lg font-bold text-gray-900 dark:text-gray-100">แก้ไขข้อมูลครอบครัว</h3>
            <p className="text-sm text-gray-500 dark:text-gray-400">{data.first_name} {data.last_name}</p>

            {/* Spouse */}
            <div>
              <label className="flex items-center gap-2 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={familyForm.hasSpouse}
                  onChange={(e) => setFamilyForm((p) => ({ ...p, hasSpouse: e.target.checked }))}
                  className="h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                />
                <span className="text-sm font-medium text-gray-700 dark:text-gray-300">มีคู่สมรส</span>
              </label>
              {familyForm.hasSpouse && (
                <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-medium text-gray-600 dark:text-gray-400 block mb-1">ชื่อ-นามสกุลคู่สมรส</label>
                    <input
                      className={inputCls}
                      value={familyForm.spouse?.spouse_name ?? ""}
                      onChange={(e) => setFamilyForm((p) => ({ ...p, spouse: { ...p.spouse, spouse_name: e.target.value } }))}
                      placeholder="ชื่อ-นามสกุล"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-medium text-gray-600 dark:text-gray-400 block mb-1">อาชีพคู่สมรส</label>
                    <input
                      className={inputCls}
                      value={familyForm.spouse?.spouse_occupation ?? ""}
                      onChange={(e) => setFamilyForm((p) => ({ ...p, spouse: { ...p.spouse, spouse_occupation: e.target.value } }))}
                      placeholder="อาชีพ"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-medium text-gray-600 dark:text-gray-400 block mb-1">วันเกิดคู่สมรส</label>
                    <input
                      type="date"
                      className={inputCls}
                      value={familyForm.spouse?.spouse_birthday ?? ""}
                      onChange={(e) => setFamilyForm((p) => ({ ...p, spouse: { ...p.spouse, spouse_birthday: e.target.value } }))}
                    />
                  </div>
                  <div>
                    <label className="text-xs font-medium text-gray-600 dark:text-gray-400 block mb-1">สถานภาพการสมรส</label>
                    <select
                      className={inputCls}
                      value={familyForm.spouse?.spouse_marriage_status ?? ""}
                      onChange={(e) => setFamilyForm((p) => ({ ...p, spouse: { ...p.spouse, spouse_marriage_status: e.target.value } }))}
                    >
                      <option value="">— เลือกสถานภาพ —</option>
                      <option value="registered">จดทะเบียนสมรส</option>
                      <option value="unregistered">ไม่ได้จดทะเบียน</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-xs font-medium text-gray-600 dark:text-gray-400 block mb-1">เบอร์โทรคู่สมรส</label>
                    <input
                      className={inputCls}
                      value={familyForm.spouse?.spouse_phone ?? ""}
                      onChange={(e) => setFamilyForm((p) => ({ ...p, spouse: { ...p.spouse, spouse_phone: e.target.value } }))}
                      placeholder="08XXXXXXXX"
                    />
                  </div>
                </div>
              )}
            </div>

            {/* Children */}
            <div className="border-t border-gray-100 dark:border-gray-700/50 pt-4">
              <div className="flex items-center justify-between mb-3">
                <span className="text-sm font-semibold text-gray-700 dark:text-gray-300">บุตร</span>
                <button
                  type="button"
                  onClick={() => setFamilyForm((p) => ({ ...p, children: [...p.children, { child_name: "", child_birthday: "", child_gender: "", child_legal_status: "" }] }))}
                  className="text-xs font-medium text-indigo-600 dark:text-indigo-400 hover:underline cursor-pointer"
                >
                  + เพิ่มบุตร
                </button>
              </div>
              {familyForm.children.map((child, i) => (
                <div key={i} className="mb-3 rounded-xl bg-gray-50 dark:bg-gray-700/40 p-4 relative">
                  <button
                    type="button"
                    onClick={() => setFamilyForm((p) => ({ ...p, children: p.children.filter((_, idx) => idx !== i) }))}
                    className="absolute top-3 right-3 text-xs text-red-500 hover:text-red-700 cursor-pointer"
                  >
                    ✕ ลบ
                  </button>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="text-xs font-medium text-gray-600 dark:text-gray-400 block mb-1">ชื่อ-นามสกุลบุตร</label>
                      <input
                        className={inputCls}
                        value={child.child_name}
                        onChange={(e) => setFamilyForm((p) => { const next = [...p.children]; next[i] = { ...next[i], child_name: e.target.value }; return { ...p, children: next } })}
                        placeholder="ชื่อ-นามสกุล"
                      />
                    </div>
                    <div>
                      <label className="text-xs font-medium text-gray-600 dark:text-gray-400 block mb-1">วันเกิดบุตร</label>
                      <input
                        type="date"
                        className={inputCls}
                        value={child.child_birthday}
                        onChange={(e) => setFamilyForm((p) => { const next = [...p.children]; next[i] = { ...next[i], child_birthday: e.target.value }; return { ...p, children: next } })}
                      />
                    </div>
                    <div>
                      <label className="text-xs font-medium text-gray-600 dark:text-gray-400 block mb-1">เพศ</label>
                      <select
                        className={inputCls}
                        value={child.child_gender}
                        onChange={(e) => setFamilyForm((p) => { const next = [...p.children]; next[i] = { ...next[i], child_gender: e.target.value }; return { ...p, children: next } })}
                      >
                        <option value="">— เลือกเพศ —</option>
                        <option value="male">ชาย</option>
                        <option value="female">หญิง</option>
                      </select>
                    </div>
                    <div>
                      <label className="text-xs font-medium text-gray-600 dark:text-gray-400 block mb-1">สถานะบุตร</label>
                      <select
                        className={inputCls}
                        value={child.child_legal_status}
                        onChange={(e) => setFamilyForm((p) => { const next = [...p.children]; next[i] = { ...next[i], child_legal_status: e.target.value }; return { ...p, children: next } })}
                      >
                        <option value="">— เลือกสถานะ —</option>
                        <option value="legitimate">บุตรชอบด้วยกฎหมาย</option>
                        <option value="illegitimate">บุตรนอกกฎหมาย</option>
                        <option value="adopted">บุตรบุญธรรม</option>
                      </select>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Parents */}
            <div className="border-t border-gray-100 dark:border-gray-700/50 pt-4">
              <div className="flex items-center justify-between mb-3">
                <span className="text-sm font-semibold text-gray-700 dark:text-gray-300">บิดา-มารดา</span>
                <button
                  type="button"
                  onClick={() => setFamilyForm((p) => ({ ...p, parents: [...p.parents, { parent_type: "", parent_name: "", parent_birthday: "", parent_employment_status: "" }] }))}
                  disabled={familyForm.parents.length >= 2}
                  className="text-xs font-medium text-indigo-600 dark:text-indigo-400 hover:underline cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  + เพิ่ม
                </button>
              </div>
              {familyForm.parents.map((parent, i) => {
                const usedTypes = familyForm.parents.filter((_, j) => j !== i).map((p) => p.parent_type)
                return (
                  <div key={i} className="mb-3 rounded-xl bg-gray-50 dark:bg-gray-700/40 p-4 relative">
                    <button
                      type="button"
                      onClick={() => setFamilyForm((p) => ({ ...p, parents: p.parents.filter((_, idx) => idx !== i) }))}
                      className="absolute top-3 right-3 text-xs text-red-500 hover:text-red-700 cursor-pointer"
                    >
                      ✕ ลบ
                    </button>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className="text-xs font-medium text-gray-600 dark:text-gray-400 block mb-1">ประเภท</label>
                        <select
                          className={inputCls}
                          value={parent.parent_type}
                          onChange={(e) => setFamilyForm((p) => { const next = [...p.parents]; next[i] = { ...next[i], parent_type: e.target.value }; return { ...p, parents: next } })}
                        >
                          <option value="">— เลือก —</option>
                          {!usedTypes.includes("father") || parent.parent_type === "father" ? <option value="father">บิดา</option> : null}
                          {!usedTypes.includes("mother") || parent.parent_type === "mother" ? <option value="mother">มารดา</option> : null}
                        </select>
                      </div>
                      <div>
                        <label className="text-xs font-medium text-gray-600 dark:text-gray-400 block mb-1">ชื่อ-นามสกุล</label>
                        <input
                          className={inputCls}
                          value={parent.parent_name}
                          onChange={(e) => setFamilyForm((p) => { const next = [...p.parents]; next[i] = { ...next[i], parent_name: e.target.value }; return { ...p, parents: next } })}
                          placeholder="ชื่อ-นามสกุล"
                        />
                      </div>
                      <div>
                        <label className="text-xs font-medium text-gray-600 dark:text-gray-400 block mb-1">วันเกิด</label>
                        <input
                          type="date"
                          className={inputCls}
                          value={parent.parent_birthday}
                          onChange={(e) => setFamilyForm((p) => { const next = [...p.parents]; next[i] = { ...next[i], parent_birthday: e.target.value }; return { ...p, parents: next } })}
                        />
                      </div>
                      <div>
                        <label className="text-xs font-medium text-gray-600 dark:text-gray-400 block mb-1">สถานะการทำงาน</label>
                        <select
                          className={inputCls}
                          value={parent.parent_employment_status}
                          onChange={(e) => setFamilyForm((p) => { const next = [...p.parents]; next[i] = { ...next[i], parent_employment_status: e.target.value }; return { ...p, parents: next } })}
                        >
                          <option value="">— เลือกสถานะ —</option>
                          <option value="working">ทำงาน</option>
                          <option value="retired">เกษียณ</option>
                          <option value="deceased">เสียชีวิต</option>
                          <option value="unknown">ไม่ทราบ</option>
                        </select>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>

            {familySaveMsg && (
              <p className={`text-sm text-center ${familySaveMsg.startsWith("✅") ? "text-emerald-600" : "text-red-600"}`}>{familySaveMsg}</p>
            )}
            <div className="flex gap-3">
              <button onClick={() => setFamilyModal(false)} className="flex-1 h-10 rounded-xl border border-gray-300 dark:border-gray-600 text-sm font-semibold text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700 transition cursor-pointer">ยกเลิก</button>
              <button onClick={handleSaveFamily} disabled={familySaving} className="flex-1 h-10 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-60 text-white text-sm font-semibold transition cursor-pointer disabled:cursor-not-allowed">
                {familySaving ? "กำลังบันทึก..." : "บันทึก"}
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* Financial Edit Modal */}
      {editModal && ReactDOM.createPortal(
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="w-full max-w-sm rounded-2xl bg-white dark:bg-gray-800 shadow-2xl p-6 space-y-4">
            <h3 className="text-lg font-bold text-gray-900 dark:text-gray-100">แก้ไขข้อมูลการเงิน</h3>
            <p className="text-sm text-gray-500 dark:text-gray-400">{data.first_name} {data.last_name}</p>
            <div className="space-y-3">
              <div>
                <label className="text-xs font-medium text-gray-600 dark:text-gray-400 block mb-1">เงินเดือน (บาท)</label>
                <input type="number" value={editForm.current_salary} onChange={(e) => setEditForm((p) => ({ ...p, current_salary: e.target.value }))} className={inputCls} placeholder="25000" />
              </div>
              <div>
                <label className="text-xs font-medium text-gray-600 dark:text-gray-400 block mb-1">เงินกู้คงเหลือ (บาท)</label>
                <input type="number" value={editForm.current_loan} onChange={(e) => setEditForm((p) => ({ ...p, current_loan: e.target.value }))} className={inputCls} placeholder="0" />
              </div>
              <div>
                <label className="text-xs font-medium text-gray-600 dark:text-gray-400 block mb-1">อายุงาน (ปี)</label>
                <input type="number" min="0" value={editForm.job_age} onChange={(e) => setEditForm((p) => ({ ...p, job_age: e.target.value }))} className={inputCls} placeholder="0" />
              </div>
            </div>
            {saveMsg && (
              <p className={`text-sm text-center ${saveMsg.startsWith("✅") ? "text-emerald-600" : "text-red-600"}`}>{saveMsg}</p>
            )}
            <div className="flex gap-3">
              <button onClick={() => setEditModal(false)} className="flex-1 h-10 rounded-xl border border-gray-300 dark:border-gray-600 text-sm font-semibold text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700 transition cursor-pointer">ยกเลิก</button>
              <button onClick={handleSaveFinancial} disabled={saving} className="flex-1 h-10 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-60 text-white text-sm font-semibold transition cursor-pointer">
                {saving ? "กำลังบันทึก..." : "บันทึก"}
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  )
}
