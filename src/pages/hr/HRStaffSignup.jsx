// src/pages/hr/HRStaffSignup.jsx
// Phase 3B — ลงทะเบียนเจ้าหน้าที่ใหม่ (เฉพาะ role 1 หรือ 3)
import { useEffect, useState } from "react"
import { apiAuth } from "../../lib/api"
import SelectDropdown from "../../components/SelectDropdown"
import { baseField, labelCls, sectionTitleCls, submitBtnCls } from "../../lib/styles"

const ED_LEVEL_OPTIONS = [
  { value: "มัธยมศึกษาตอนต้น", label: "มัธยมศึกษาตอนต้น (ม.3)" },
  { value: "มัธยมศึกษาตอนปลาย", label: "มัธยมศึกษาตอนปลาย (ม.6)" },
  { value: "ปวช.", label: "ปวช. (ประกาศนียบัตรวิชาชีพ)" },
  { value: "ปวส.", label: "ปวส. (ประกาศนียบัตรวิชาชีพชั้นสูง)" },
  { value: "อนุปริญญา", label: "อนุปริญญา" },
  { value: "ปริญญาตรี", label: "ปริญญาตรี" },
  { value: "ปริญญาโท", label: "ปริญญาโท" },
  { value: "ปริญญาเอก", label: "ปริญญาเอก" },
]

const GENDER_OPTIONS = [
  { value: "M", label: "ชาย" },
  { value: "F", label: "หญิง" },
  { value: "other", label: "อื่นๆ" },
]

const MARITAL_OPTIONS = [
  { value: "single", label: "โสด" },
  { value: "married", label: "สมรส" },
  { value: "divorced", label: "หย่าร้าง" },
  { value: "widowed", label: "หม้าย" },
]

const ROLE_OPTIONS = [
  { value: 2, label: "ผู้จัดการ" },
  { value: 3, label: "ฝ่ายบุคคล" },
  { value: 4, label: "หัวหน้าบัญชี" },
  { value: 5, label: "การตลาด" },
]

function SectionTitle({ children }) {
  return <h3 className={sectionTitleCls}>{children}</h3>
}

function Field({ label, required, children }) {
  return (
    <div className="flex flex-col gap-1">
      <label className={labelCls}>
        {label}{required && <span className="text-red-500 ml-0.5">*</span>}
      </label>
      {children}
    </div>
  )
}

const MARRIAGE_STATUS_OPTIONS = [
  { value: "registered", label: "จดทะเบียนสมรส" },
  { value: "unregistered", label: "ไม่ได้จดทะเบียน" },
]
const CHILD_GENDER_OPTIONS = [
  { value: "male", label: "ชาย" },
  { value: "female", label: "หญิง" },
]
const CHILD_LEGAL_STATUS_OPTIONS = [
  { value: "legitimate", label: "บุตรชอบด้วยกฎหมาย" },
  { value: "illegitimate", label: "บุตรนอกกฎหมาย" },
  { value: "adopted", label: "บุตรบุญธรรม" },
]
const PARENT_TYPE_OPTIONS = [
  { value: "father", label: "บิดา" },
  { value: "mother", label: "มารดา" },
]
const PARENT_EMP_STATUS_OPTIONS = [
  { value: "working", label: "ทำงาน" },
  { value: "retired", label: "เกษียณ" },
  { value: "deceased", label: "เสียชีวิต" },
  { value: "unknown", label: "ไม่ทราบ" },
]

const emptyEdu = () => ({ ed_level: "", inst_name: "", from_date: "", to_date: "" })
const emptyWork = () => ({ company_name: "", position: "", from_date: "", to_date: "" })
const emptyCrime = () => ({ charge: "", court: "", case_date: "", outcome: "" })
const emptyChild = () => ({ child_name: "", child_birthday: "", child_gender: "", child_legal_status: "" })
const emptyParent = () => ({ parent_type: "", parent_name: "", parent_birthday: "", parent_employment_status: "" })

export default function HRStaffSignup() {
  const [positions, setPositions] = useState([])
  const [loadingPositions, setLoadingPositions] = useState(true)
  const [branchOptions, setBranchOptions] = useState([])
  const [loadingBranches, setLoadingBranches] = useState(true)

  const [form, setForm] = useState({
    first_name: "",
    last_name: "",
    cid: "",
    role_id: "",
    branch_location: "",
    position: "",
    email: "",
    hired: "",
    bank_no: "",
    p_number: "",
    e_contact: "",
    birthday: "",
    age: "",
    gender: "",
    m_status: "",
    children_number: "0",
    h_address: "",
    mhoo: "",
    soi: "",
    road: "",
    district: "",
    sub_district: "",
    province: "",
    postal_code: "",
    current_salary: "",
    underlying_disease: "",
  })

  const [education, setEducation] = useState([emptyEdu()])
  const [workExperiences, setWorkExperiences] = useState([emptyWork()])
  const [criminalRecords, setCriminalRecords] = useState([emptyCrime()])

  // Family state
  const [hasSpouse, setHasSpouse] = useState(false)
  const [spouse, setSpouse] = useState({
    spouse_name: "", spouse_occupation: "", spouse_birthday: "",
    spouse_marriage_status: "", spouse_phone: ""
  })
  const [children, setChildren] = useState([])
  const [parents, setParents] = useState([])

  const [submitting, setSubmitting] = useState(false)
  const [result, setResult] = useState(null) // { id, username, fiscal_year, notified_via }
  const [error, setError] = useState("")

  useEffect(() => {
    apiAuth("/hr/positions")
      .then(setPositions)
      .catch(() => setPositions([]))
      .finally(() => setLoadingPositions(false))
  }, [])

  useEffect(() => {
    apiAuth("/order/branch/search")
      .then((data) => {
        const opts = (data || []).map((b) => ({
          value: b.id,
          label: b.branch_name,
        }))
        if (opts.length > 0) setBranchOptions(opts)
      })
      .catch(() => {})
      .finally(() => setLoadingBranches(false))
  }, [])

  const set = (field) => (e) => {
    setForm((prev) => ({ ...prev, [field]: e.target.value }))
  }
  // สำหรับ SelectDropdown ที่ส่ง value โดยตรง (ไม่ใช่ event)
  const setField = (field) => (val) => {
    setForm((prev) => ({ ...prev, [field]: val }))
  }

  const setEdu = (index, field) => (e) => {
    setEducation((prev) => {
      const next = [...prev]
      next[index] = { ...next[index], [field]: e.target.value }
      return next
    })
  }
  const setEduField = (index, field) => (val) => {
    setEducation((prev) => {
      const next = [...prev]
      next[index] = { ...next[index], [field]: val }
      return next
    })
  }

  const addEdu = () => setEducation((prev) => [...prev, emptyEdu()])
  const removeEdu = (i) => setEducation((prev) => prev.filter((_, idx) => idx !== i))

  const setWork = (index, field) => (e) => {
    setWorkExperiences((prev) => {
      const next = [...prev]
      next[index] = { ...next[index], [field]: e.target.value }
      return next
    })
  }
  const addWork = () => setWorkExperiences((prev) => [...prev, emptyWork()])
  const removeWork = (i) => setWorkExperiences((prev) => prev.filter((_, idx) => idx !== i))

  const setCrime = (index, field) => (e) => {
    setCriminalRecords((prev) => {
      const next = [...prev]
      next[index] = { ...next[index], [field]: e.target.value }
      return next
    })
  }
  const addCrime = () => setCriminalRecords((prev) => [...prev, emptyCrime()])
  const removeCrime = (i) => setCriminalRecords((prev) => prev.filter((_, idx) => idx !== i))

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError("")
    setResult(null)
    setSubmitting(true)

    try {
      const payload = {
        first_name: form.first_name.trim(),
        last_name: form.last_name.trim(),
        cid: form.cid.trim(),
        ...(form.role_id && { role_id: Number(form.role_id) }),
        ...(form.branch_location && { branch_location: Number(form.branch_location) }),
        ...(form.position && { position: Number(form.position) }),
        ...(form.email && { email: form.email.trim() }),
        ...(form.hired && { hired: form.hired }),
        ...(form.bank_no && { bank_no: form.bank_no.trim() }),
        ...(form.p_number && { p_number: form.p_number.trim() }),
        ...(form.e_contact && { e_contact: form.e_contact.trim() }),
        ...(form.birthday && { birthday: form.birthday }),
        ...(form.age && { age: Number(form.age) }),
        ...(form.gender && { gender: form.gender }),
        ...(form.m_status && { m_status: form.m_status }),
        children_number: Number(form.children_number) || 0,
        ...(form.h_address && { h_address: form.h_address.trim() }),
        ...(form.mhoo && { mhoo: form.mhoo.trim() }),
        ...(form.soi && { soi: form.soi.trim() }),
        ...(form.road && { road: form.road.trim() }),
        ...(form.district && { district: form.district.trim() }),
        ...(form.sub_district && { sub_district: form.sub_district.trim() }),
        ...(form.province && { province: form.province.trim() }),
        ...(form.postal_code && { postal_code: form.postal_code.trim() }),
        education: education
          .filter((e) => e.ed_level || e.inst_name || e.from_date || e.to_date)
          .map((e) => ({
            ...(e.ed_level && { ed_level: e.ed_level }),
            ...(e.inst_name && { inst_name: e.inst_name }),
            ...(e.from_date && { from_date: e.from_date }),
            ...(e.to_date && { to_date: e.to_date }),
          })),
        ...(form.underlying_disease && { underlying_disease: form.underlying_disease.trim() }),
        work_experiences: workExperiences
          .filter((w) => w.company_name || w.position || w.from_date || w.to_date)
          .map((w) => ({
            ...(w.company_name && { company_name: w.company_name }),
            ...(w.position && { position: w.position }),
            ...(w.from_date && { from_date: w.from_date }),
            ...(w.to_date && { to_date: w.to_date }),
          })),
        criminal_records: criminalRecords
          .filter((c) => c.charge || c.court || c.case_date || c.outcome)
          .map((c) => ({
            ...(c.charge && { charge: c.charge }),
            ...(c.court && { court: c.court }),
            ...(c.case_date && { case_date: c.case_date }),
            ...(c.outcome && { outcome: c.outcome }),
          })),
        ...(form.current_salary && { current_salary: parseFloat(form.current_salary) }),
      }

      // Build family payload
      const spousePayload = hasSpouse && spouse.spouse_name.trim()
        ? {
            spouse_name: spouse.spouse_name.trim(),
            ...(spouse.spouse_occupation && { spouse_occupation: spouse.spouse_occupation.trim() }),
            ...(spouse.spouse_birthday && { spouse_birthday: spouse.spouse_birthday }),
            ...(spouse.spouse_marriage_status && { spouse_marriage_status: spouse.spouse_marriage_status }),
            ...(spouse.spouse_phone && { spouse_phone: spouse.spouse_phone.trim() }),
          }
        : null

      const childrenPayload = children
        .filter(c => c.child_name.trim() && c.child_birthday)
        .map(c => ({
          child_name: c.child_name.trim(),
          child_birthday: c.child_birthday,
          ...(c.child_gender && { child_gender: c.child_gender }),
          ...(c.child_legal_status && { child_legal_status: c.child_legal_status }),
        }))

      const parentsPayload = parents
        .filter(p => p.parent_type && p.parent_name.trim())
        .map(p => ({
          parent_type: p.parent_type,
          parent_name: p.parent_name.trim(),
          ...(p.parent_birthday && { parent_birthday: p.parent_birthday }),
          ...(p.parent_employment_status && { parent_employment_status: p.parent_employment_status }),
        }))

      if (spousePayload) payload.spouse = spousePayload
      if (childrenPayload.length > 0) payload.children = childrenPayload
      if (parentsPayload.length > 0) payload.parents = parentsPayload

      const data = await apiAuth("/hr/signup", { method: "POST", body: payload })
      setResult(data)
    } catch (err) {
      if (err.status === 409) setError("มีบันทึกบุคลากรที่ใช้เลขบัตรประชาชนนี้อยู่แล้ว")
      else if (err.status === 403) setError("คุณไม่มีสิทธิ์ดำเนินการนี้")
      else setError(err.message || "เกิดข้อผิดพลาด กรุณาลองใหม่")
    } finally {
      setSubmitting(false)
    }
  }

  const handleReset = () => {
    setResult(null)
    setError("")
    setForm({
      first_name: "", last_name: "", cid: "", role_id: "", branch_location: "",
      position: "", email: "", hired: "", bank_no: "", p_number: "",
      e_contact: "", birthday: "", age: "", gender: "", m_status: "",
      children_number: "0", h_address: "", mhoo: "", soi: "", road: "",
      district: "", sub_district: "", province: "", postal_code: "", current_salary: "",
      underlying_disease: "",
    })
    setEducation([emptyEdu()])
    setWorkExperiences([emptyWork()])
    setCriminalRecords([emptyCrime()])
    setHasSpouse(false)
    setSpouse({ spouse_name: "", spouse_occupation: "", spouse_birthday: "", spouse_marriage_status: "", spouse_phone: "" })
    setChildren([])
    setParents([])
  }

  // --- Success screen ---
  if (result) {
    const notifyMsg =
      result.notified_via === "line"
        ? "ส่งข้อมูลรหัสผ่านทาง Line แล้ว"
        : result.notified_via === "email"
        ? "ส่งข้อมูลรหัสผ่านทาง Email แล้ว"
        : "ไม่มีช่องทางแจ้งเตือน — กรุณาแจ้งรหัสผ่านด้วยตนเอง"

    return (
      <div className="max-w-lg mx-auto mt-10">
        <div className="rounded-2xl bg-white dark:bg-gray-800 shadow-md ring-1 ring-gray-200/70 dark:ring-gray-700/70 p-8 text-center space-y-4">
          <div className="flex h-14 w-14 mx-auto items-center justify-center rounded-full bg-emerald-100 dark:bg-emerald-900/30 text-3xl">
            ✅
          </div>
          <h2 className="text-lg font-bold text-gray-900 dark:text-gray-100">
            ลงทะเบียนเจ้าหน้าที่สำเร็จ!
          </h2>
          <div className="rounded-xl bg-indigo-50 dark:bg-indigo-900/20 p-4 text-left space-y-2">
            <p className="text-sm text-gray-700 dark:text-gray-300">
              <span className="font-semibold">Username:</span>{" "}
              <span className="font-mono text-indigo-700 dark:text-indigo-300 text-base">{result.username}</span>
            </p>
            <p className="text-sm text-gray-700 dark:text-gray-300">
              <span className="font-semibold">รหัสเจ้าหน้าที่:</span> {result.id}
            </p>
            <p className="text-sm text-gray-700 dark:text-gray-300">
              <span className="font-semibold">ปีงบประมาณ:</span> {result.fiscal_year}
            </p>
            <p className="text-sm text-gray-700 dark:text-gray-300">
              <span className="font-semibold">แจ้งเตือน:</span> {notifyMsg}
            </p>
          </div>
          {result.notified_via === "none" && (
            <div className="rounded-xl bg-amber-50 dark:bg-amber-900/20 p-3 text-sm text-amber-700 dark:text-amber-300">
              ⚠️ รหัสผ่านถูกสร้างอัตโนมัติ กรุณาแจ้งเจ้าหน้าที่ใหม่ด้วยตนเอง
            </div>
          )}
          <button
            onClick={handleReset}
            className="mt-2 w-full h-11 rounded-xl bg-indigo-600 text-white font-semibold hover:bg-indigo-500 transition cursor-pointer"
          >
            ลงทะเบียนเจ้าหน้าที่คนถัดไป
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-3xl mx-auto space-y-5 pb-10">
      <div>
        <h1 className="text-xl font-bold text-gray-900 dark:text-gray-100">ลงทะเบียนเจ้าหน้าที่ใหม่</h1>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
          ระบบจะสร้าง username และ password อัตโนมัติ และส่งผ่าน Line / Email ให้เจ้าหน้าที่
        </p>
      </div>

      {error && (
        <div className="flex items-start gap-2.5 rounded-xl bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 px-4 py-3 text-sm text-red-700 dark:text-red-300">
          <svg className="mt-0.5 h-4 w-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
          </svg>
          <span>{error}</span>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-5">
        {/* ─── ข้อมูลพื้นฐาน ─── */}
        <div className="rounded-2xl bg-white dark:bg-gray-800 shadow-sm ring-1 ring-gray-200/70 dark:ring-gray-700/70 p-5 space-y-4">
          <SectionTitle>ข้อมูลพื้นฐาน</SectionTitle>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Field label="ชื่อ" required>
              <input className={baseField} value={form.first_name} onChange={set("first_name")} required placeholder="ชื่อจริง" />
            </Field>
            <Field label="นามสกุล" required>
              <input className={baseField} value={form.last_name} onChange={set("last_name")} required placeholder="นามสกุล" />
            </Field>
            <Field label="เลขบัตรประชาชน (CID)" required>
              <input className={baseField} value={form.cid} onChange={set("cid")} required maxLength={13} placeholder="13 หลัก" />
            </Field>
            <Field label="วันที่เริ่มงาน">
              <input type="date" className={baseField} value={form.hired} onChange={set("hired")} />
            </Field>
            <Field label="Role">
              <SelectDropdown
                value={form.role_id}
                onChange={setField("role_id")}
                placeholder="— เลือก Role —"
                options={ROLE_OPTIONS.map((r) => ({ value: r.value, label: r.label }))}
              />
            </Field>
            <Field label="ตำแหน่ง (Position)">
              <SelectDropdown
                value={form.position}
                onChange={setField("position")}
                placeholder="— เลือกตำแหน่ง —"
                loading={loadingPositions}
                options={positions.map((p) => ({ value: p.id, label: p.title }))}
              />
            </Field>
            <Field label="สาขา">
              <SelectDropdown
                value={form.branch_location}
                onChange={setField("branch_location")}
                placeholder="— เลือกสาขา —"
                loading={loadingBranches}
                options={branchOptions}
              />
            </Field>
            <Field label="Email">
              <input type="email" className={baseField} value={form.email} onChange={set("email")} placeholder="example@email.com" />
            </Field>
          </div>
        </div>

        {/* ─── ข้อมูลส่วนบุคคล ─── */}
        <div className="rounded-2xl bg-white dark:bg-gray-800 shadow-sm ring-1 ring-gray-200/70 dark:ring-gray-700/70 p-5 space-y-4">
          <SectionTitle>ข้อมูลส่วนบุคคล</SectionTitle>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Field label="เบอร์โทรศัพท์">
              <input className={baseField} value={form.p_number} onChange={set("p_number")} placeholder="08XXXXXXXX" />
            </Field>
            <Field label="เบอร์ติดต่อฉุกเฉิน">
              <input className={baseField} value={form.e_contact} onChange={set("e_contact")} placeholder="08XXXXXXXX" />
            </Field>
            <Field label="วันเกิด">
              <input type="date" className={baseField} value={form.birthday} onChange={set("birthday")} />
            </Field>
            <Field label="อายุ">
              <input type="number" min="18" max="70" className={baseField} value={form.age} onChange={set("age")} placeholder="อายุ (ปี)" />
            </Field>
            <Field label="เพศ">
              <SelectDropdown
                value={form.gender}
                onChange={setField("gender")}
                placeholder="— เลือกเพศ —"
                options={GENDER_OPTIONS.map((g) => ({ value: g.value, label: g.label }))}
              />
            </Field>
            <Field label="สถานภาพสมรส">
              <SelectDropdown
                value={form.m_status}
                onChange={setField("m_status")}
                placeholder="— เลือกสถานภาพ —"
                options={MARITAL_OPTIONS.map((m) => ({ value: m.value, label: m.label }))}
              />
            </Field>
            <Field label="จำนวนบุตร">
              <input type="number" min="0" className={baseField} value={form.children_number} onChange={set("children_number")} />
            </Field>
            <Field label="โรคประจำตัว">
              <input className={baseField} value={form.underlying_disease} onChange={set("underlying_disease")} placeholder="ระบุโรคประจำตัว (ถ้ามี)" />
            </Field>
          </div>
        </div>

        {/* ─── ข้อมูลการเงิน ─── */}
        <div className="rounded-2xl bg-white dark:bg-gray-800 shadow-sm ring-1 ring-gray-200/70 dark:ring-gray-700/70 p-5 space-y-4">
          <SectionTitle>ข้อมูลการเงิน</SectionTitle>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Field label="เลขบัญชีธนาคาร">
              <input className={baseField} value={form.bank_no} onChange={set("bank_no")} placeholder="XXX-X-XXXXX-X" />
            </Field>
            <Field label="เงินเดือนเริ่มต้น (บาท)">
              <input type="number" min="0" step="0.01" className={baseField} value={form.current_salary} onChange={set("current_salary")} placeholder="0.00" />
            </Field>
          </div>
        </div>

        {/* ─── ที่อยู่ ─── */}
        <div className="rounded-2xl bg-white dark:bg-gray-800 shadow-sm ring-1 ring-gray-200/70 dark:ring-gray-700/70 p-5 space-y-4">
          <SectionTitle>ที่อยู่ (ถ้ามี)</SectionTitle>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Field label="บ้านเลขที่">
              <input className={baseField} value={form.h_address} onChange={set("h_address")} placeholder="123 หมู่..." />
            </Field>
            <Field label="หมู่ที่">
              <input className={baseField} value={form.mhoo} onChange={set("mhoo")} placeholder="4" />
            </Field>
            <Field label="ซอย">
              <input className={baseField} value={form.soi} onChange={set("soi")} />
            </Field>
            <Field label="ถนน">
              <input className={baseField} value={form.road} onChange={set("road")} />
            </Field>
            <Field label="ตำบล/แขวง">
              <input className={baseField} value={form.sub_district} onChange={set("sub_district")} />
            </Field>
            <Field label="อำเภอ/เขต">
              <input className={baseField} value={form.district} onChange={set("district")} />
            </Field>
            <Field label="จังหวัด">
              <input className={baseField} value={form.province} onChange={set("province")} placeholder="สุรินทร์" />
            </Field>
            <Field label="รหัสไปรษณีย์">
              <input className={baseField} value={form.postal_code} onChange={set("postal_code")} maxLength={5} placeholder="32000" />
            </Field>
          </div>
        </div>

        {/* ─── ประวัติการศึกษา ─── */}
        <div className="rounded-2xl bg-white dark:bg-gray-800 shadow-sm ring-1 ring-gray-200/70 dark:ring-gray-700/70 p-5 space-y-4">
          <div className="flex items-center justify-between">
            <SectionTitle>ประวัติการศึกษา (ถ้ามี)</SectionTitle>
            <button
              type="button"
              onClick={addEdu}
              className="text-xs font-medium text-indigo-600 dark:text-indigo-400 hover:underline cursor-pointer"
            >
              + เพิ่มรายการ
            </button>
          </div>
          {education.map((edu, i) => (
            <div key={i} className="rounded-xl bg-gray-50 dark:bg-gray-700/40 p-4 space-y-3 relative">
              {education.length > 1 && (
                <button
                  type="button"
                  onClick={() => removeEdu(i)}
                  className="absolute top-3 right-3 text-xs text-red-500 hover:text-red-700 cursor-pointer"
                >
                  ✕ ลบ
                </button>
              )}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <Field label="ระดับการศึกษา">
                  <SelectDropdown
                    value={edu.ed_level}
                    onChange={setEduField(i, "ed_level")}
                    placeholder="— เลือกระดับการศึกษา —"
                    options={ED_LEVEL_OPTIONS}
                  />
                </Field>
                <Field label="สถาบัน">
                  <input className={baseField} value={edu.inst_name} onChange={setEdu(i, "inst_name")} placeholder="ชื่อสถาบัน" />
                </Field>
                <Field label="ตั้งแต่">
                  <input type="date" className={baseField} value={edu.from_date} onChange={setEdu(i, "from_date")} />
                </Field>
                <Field label="ถึง">
                  <input type="date" className={baseField} value={edu.to_date} onChange={setEdu(i, "to_date")} />
                </Field>
              </div>
            </div>
          ))}
        </div>

        {/* ─── ประวัติการทำงาน ─── */}
        <div className="rounded-2xl bg-white dark:bg-gray-800 shadow-sm ring-1 ring-gray-200/70 dark:ring-gray-700/70 p-5 space-y-4">
          <div className="flex items-center justify-between">
            <SectionTitle>ประวัติการทำงาน (ถ้ามี)</SectionTitle>
            <button
              type="button"
              onClick={addWork}
              className="text-xs font-medium text-indigo-600 dark:text-indigo-400 hover:underline cursor-pointer"
            >
              + เพิ่มรายการ
            </button>
          </div>
          {workExperiences.map((w, i) => (
            <div key={i} className="rounded-xl bg-gray-50 dark:bg-gray-700/40 p-4 space-y-3 relative">
              {workExperiences.length > 1 && (
                <button
                  type="button"
                  onClick={() => removeWork(i)}
                  className="absolute top-3 right-3 text-xs text-red-500 hover:text-red-700 cursor-pointer"
                >
                  ✕ ลบ
                </button>
              )}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <Field label="ชื่อบริษัท/สถานที่ทำงาน">
                  <input className={baseField} value={w.company_name} onChange={setWork(i, "company_name")} placeholder="ชื่อบริษัท" />
                </Field>
                <Field label="ตำแหน่ง">
                  <input className={baseField} value={w.position} onChange={setWork(i, "position")} placeholder="ตำแหน่งที่ทำ" />
                </Field>
                <Field label="ตั้งแต่">
                  <input type="date" className={baseField} value={w.from_date} onChange={setWork(i, "from_date")} />
                </Field>
                <Field label="ถึง">
                  <input type="date" className={baseField} value={w.to_date} onChange={setWork(i, "to_date")} />
                </Field>
              </div>
            </div>
          ))}
        </div>

        {/* ─── ประวัติอาชญากรรม ─── */}
        <div className="rounded-2xl bg-white dark:bg-gray-800 shadow-sm ring-1 ring-gray-200/70 dark:ring-gray-700/70 p-5 space-y-4">
          <div className="flex items-center justify-between">
            <SectionTitle>ประวัติอาชญากรรม (ถ้ามี)</SectionTitle>
            <button
              type="button"
              onClick={addCrime}
              className="text-xs font-medium text-indigo-600 dark:text-indigo-400 hover:underline cursor-pointer"
            >
              + เพิ่มรายการ
            </button>
          </div>
          {criminalRecords.map((c, i) => (
            <div key={i} className="rounded-xl bg-gray-50 dark:bg-gray-700/40 p-4 space-y-3 relative">
              {criminalRecords.length > 1 && (
                <button
                  type="button"
                  onClick={() => removeCrime(i)}
                  className="absolute top-3 right-3 text-xs text-red-500 hover:text-red-700 cursor-pointer"
                >
                  ✕ ลบ
                </button>
              )}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <Field label="ข้อหา">
                  <input className={baseField} value={c.charge} onChange={setCrime(i, "charge")} placeholder="ระบุข้อหา" />
                </Field>
                <Field label="ศาล">
                  <input className={baseField} value={c.court} onChange={setCrime(i, "court")} placeholder="ชื่อศาล" />
                </Field>
                <Field label="วันที่คดี">
                  <input type="date" className={baseField} value={c.case_date} onChange={setCrime(i, "case_date")} />
                </Field>
                <Field label="ผลการตัดสิน">
                  <input className={baseField} value={c.outcome} onChange={setCrime(i, "outcome")} placeholder="ผลคดี" />
                </Field>
              </div>
            </div>
          ))}
        </div>

        {/* ─── ข้อมูลครอบครัว ─── */}
        <div className="rounded-2xl bg-white dark:bg-gray-800 shadow-sm ring-1 ring-gray-200/70 dark:ring-gray-700/70 p-5 space-y-5">
          <SectionTitle>ข้อมูลครอบครัว (ถ้ามี)</SectionTitle>

          {/* Spouse */}
          <div className="rounded-xl border border-indigo-200 dark:border-indigo-800 overflow-hidden">
            <label className="flex items-center gap-3 px-4 py-3 bg-indigo-50 dark:bg-indigo-900/30 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={hasSpouse}
                onChange={(e) => setHasSpouse(e.target.checked)}
                className="h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer"
              />
              <span className="text-sm font-semibold text-indigo-700 dark:text-indigo-300">💑 คู่สมรส</span>
              {!hasSpouse && <span className="ml-auto text-xs text-gray-400">คลิกเพื่อเพิ่ม</span>}
            </label>
            {hasSpouse && (
              <div className="p-4 grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Field label="ชื่อ-นามสกุลคู่สมรส" required>
                  <input
                    className={baseField}
                    value={spouse.spouse_name}
                    onChange={(e) => setSpouse((p) => ({ ...p, spouse_name: e.target.value }))}
                    required
                    placeholder="ชื่อ-นามสกุล"
                  />
                </Field>
                <Field label="อาชีพคู่สมรส">
                  <input
                    className={baseField}
                    value={spouse.spouse_occupation}
                    onChange={(e) => setSpouse((p) => ({ ...p, spouse_occupation: e.target.value }))}
                    placeholder="อาชีพ"
                  />
                </Field>
                <Field label="วันเกิดคู่สมรส">
                  <input
                    type="date"
                    className={baseField}
                    value={spouse.spouse_birthday}
                    onChange={(e) => setSpouse((p) => ({ ...p, spouse_birthday: e.target.value }))}
                  />
                </Field>
                <Field label="สถานภาพการสมรส">
                  <SelectDropdown
                    value={spouse.spouse_marriage_status}
                    onChange={(val) => setSpouse((p) => ({ ...p, spouse_marriage_status: val }))}
                    placeholder="— เลือกสถานภาพ —"
                    options={MARRIAGE_STATUS_OPTIONS}
                  />
                </Field>
                <Field label="เบอร์โทรคู่สมรส">
                  <input
                    className={baseField}
                    value={spouse.spouse_phone}
                    onChange={(e) => setSpouse((p) => ({ ...p, spouse_phone: e.target.value }))}
                    placeholder="08XXXXXXXX"
                  />
                </Field>
              </div>
            )}
          </div>

          {/* Children */}
          <div className="rounded-xl border border-amber-200 dark:border-amber-800 overflow-hidden">
            <div className="flex items-center justify-between px-4 py-3 bg-amber-50 dark:bg-amber-900/30">
              <span className="text-sm font-semibold text-amber-700 dark:text-amber-300">👶 บุตร {children.length > 0 && <span className="ml-1 text-xs font-normal">({children.length} คน)</span>}</span>
              <button
                type="button"
                onClick={() => setChildren((prev) => [...prev, emptyChild()])}
                className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-600 text-white text-xs font-semibold transition cursor-pointer"
              >
                + เพิ่มบุตร
              </button>
            </div>
            {children.length === 0 && (
              <p className="px-4 py-3 text-xs text-gray-400 dark:text-gray-500">ยังไม่มีข้อมูลบุตร — กด "+ เพิ่มบุตร" เพื่อเพิ่ม</p>
            )}
            {children.map((child, i) => (
              <div key={i} className="border-t border-amber-100 dark:border-amber-900/50 p-4 relative">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-xs font-semibold text-amber-600 dark:text-amber-400">บุตรคนที่ {i + 1}</span>
                  <button
                    type="button"
                    onClick={() => setChildren((prev) => prev.filter((_, idx) => idx !== i))}
                    className="flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-medium text-red-500 hover:bg-red-50 dark:hover:bg-red-900/30 hover:text-red-700 transition cursor-pointer"
                  >
                    ✕ ลบ
                  </button>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <Field label="ชื่อ-นามสกุลบุตร" required>
                    <input
                      className={baseField}
                      value={child.child_name}
                      onChange={(e) => setChildren((prev) => { const next = [...prev]; next[i] = { ...next[i], child_name: e.target.value }; return next })}
                      required
                      placeholder="ชื่อ-นามสกุล"
                    />
                  </Field>
                  <Field label="วันเกิดบุตร" required>
                    <input
                      type="date"
                      className={baseField}
                      value={child.child_birthday}
                      onChange={(e) => setChildren((prev) => { const next = [...prev]; next[i] = { ...next[i], child_birthday: e.target.value }; return next })}
                      required
                    />
                  </Field>
                  <Field label="เพศ">
                    <SelectDropdown
                      value={child.child_gender}
                      onChange={(val) => setChildren((prev) => { const next = [...prev]; next[i] = { ...next[i], child_gender: val }; return next })}
                      placeholder="— เลือกเพศ —"
                      options={CHILD_GENDER_OPTIONS}
                    />
                  </Field>
                  <Field label="สถานะบุตร">
                    <SelectDropdown
                      value={child.child_legal_status}
                      onChange={(val) => setChildren((prev) => { const next = [...prev]; next[i] = { ...next[i], child_legal_status: val }; return next })}
                      placeholder="— เลือกสถานะ —"
                      options={CHILD_LEGAL_STATUS_OPTIONS}
                    />
                    <p className="text-xs text-gray-400 mt-1">บุตรชอบ = จดทะเบียน · บุตรนอก = ไม่ได้จดทะเบียน · บุตรบุญธรรม = รับเลี้ยง</p>
                  </Field>
                </div>
              </div>
            ))}
          </div>

          {/* Parents */}
          <div className="rounded-xl border border-emerald-200 dark:border-emerald-800 overflow-hidden">
            <div className="flex items-center justify-between px-4 py-3 bg-emerald-50 dark:bg-emerald-900/30">
              <span className="text-sm font-semibold text-emerald-700 dark:text-emerald-300">👨‍👩‍ บิดา-มารดา {parents.length > 0 && <span className="ml-1 text-xs font-normal">({parents.length}/2)</span>}</span>
              <button
                type="button"
                onClick={() => setParents((prev) => [...prev, emptyParent()])}
                disabled={parents.length >= 2}
                className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-emerald-500 hover:bg-emerald-600 text-white text-xs font-semibold transition cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
              >
                + เพิ่ม
              </button>
            </div>
            {parents.length === 0 && (
              <p className="px-4 py-3 text-xs text-gray-400 dark:text-gray-500">ยังไม่มีข้อมูลบิดา-มารดา — กด "+ เพิ่ม" เพื่อเพิ่ม (สูงสุด 2 คน)</p>
            )}
            {parents.map((parent, i) => {
              const usedTypes = parents.filter((_, j) => j !== i).map((p) => p.parent_type)
              const availableParentTypes = PARENT_TYPE_OPTIONS.filter((o) => !usedTypes.includes(o.value))
              return (
                <div key={i} className="border-t border-emerald-100 dark:border-emerald-900/50 p-4 relative">
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-xs font-semibold text-emerald-600 dark:text-emerald-400">
                      {parent.parent_type === "father" ? "👨 บิดา" : parent.parent_type === "mother" ? "👩 มารดา" : `รายการที่ ${i + 1}`}
                    </span>
                    <button
                      type="button"
                      onClick={() => setParents((prev) => prev.filter((_, idx) => idx !== i))}
                      className="flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-medium text-red-500 hover:bg-red-50 dark:hover:bg-red-900/30 hover:text-red-700 transition cursor-pointer"
                    >
                      ✕ ลบ
                    </button>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <Field label="ประเภท" required>
                      <SelectDropdown
                        value={parent.parent_type}
                        onChange={(val) => setParents((prev) => { const next = [...prev]; next[i] = { ...next[i], parent_type: val }; return next })}
                        placeholder="— เลือก —"
                        options={availableParentTypes}
                      />
                    </Field>
                    <Field label="ชื่อ-นามสกุล" required>
                      <input
                        className={baseField}
                        value={parent.parent_name}
                        onChange={(e) => setParents((prev) => { const next = [...prev]; next[i] = { ...next[i], parent_name: e.target.value }; return next })}
                        required
                        placeholder="ชื่อ-นามสกุล"
                      />
                    </Field>
                    <Field label="วันเกิด">
                      <input
                        type="date"
                        className={baseField}
                        value={parent.parent_birthday}
                        onChange={(e) => setParents((prev) => { const next = [...prev]; next[i] = { ...next[i], parent_birthday: e.target.value }; return next })}
                      />
                    </Field>
                    <Field label="สถานะการทำงาน">
                      <SelectDropdown
                        value={parent.parent_employment_status}
                        onChange={(val) => setParents((prev) => { const next = [...prev]; next[i] = { ...next[i], parent_employment_status: val }; return next })}
                        placeholder="— เลือกสถานะ —"
                        options={PARENT_EMP_STATUS_OPTIONS}
                      />
                    </Field>
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        {/* ─── Submit ─── */}
        <button
          type="submit"
          disabled={submitting}
          className={submitBtnCls + " w-full"}
        >
          {submitting ? "กำลังบันทึก..." : "ลงทะเบียนเจ้าหน้าที่"}
        </button>
      </form>
    </div>
  )
}
