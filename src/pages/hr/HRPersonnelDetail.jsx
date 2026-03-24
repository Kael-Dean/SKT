// src/pages/hr/HRPersonnelDetail.jsx
// โปรไฟล์พนักงานแบบเต็ม — GET /hr/personnel/{user_id}
import { useEffect, useState } from "react"
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
            onClick={() => navigate("/hr/users")}
            className="px-4 py-2 rounded-xl border border-gray-300 dark:border-gray-600 text-sm font-semibold text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700 transition cursor-pointer"
          >
            ← กลับรายชื่อ
          </button>
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

      {/* Financial Edit Modal */}
      {editModal && (
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
        </div>
      )}
    </div>
  )
}
