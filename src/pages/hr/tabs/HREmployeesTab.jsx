// src/pages/hr/tabs/HREmployeesTab.jsx
// รายชื่อพนักงาน + ลงทะเบียนพนักงานใหม่
import { useEffect, useState, useCallback } from "react"
import { useNavigate } from "react-router-dom"
import { apiAuth } from "../../../lib/api"
import SelectDropdown from "../../../components/SelectDropdown"
import Portal from "../../../components/Portal"

const ROLE_LABEL = { 1: "ผู้ดูแลระบบ", 2: "ผู้จัดการ", 3: "ฝ่ายบุคคล", 4: "หัวหน้าบัญชี", 5: "การตลาด" }
const ROLE_COLOR = {
  1: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300",
  2: "bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-300",
  3: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300",
  4: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300",
  5: "bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300",
}

const ROLE_OPTIONS = [
  { value: 2, label: "ผู้จัดการ" },
  { value: 3, label: "ฝ่ายบุคคล" },
  { value: 4, label: "หัวหน้าบัญชี" },
  { value: 5, label: "การตลาด" },
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

const inputCls = "w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-3 py-2 text-sm text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-indigo-500"

function Field({ label, required, children }) {
  return (
    <div className="flex flex-col gap-1">
      <label className="text-xs font-medium text-gray-600 dark:text-gray-400">
        {label}{required && <span className="text-red-500 ml-0.5">*</span>}
      </label>
      {children}
    </div>
  )
}

const emptyForm = () => ({
  first_name: "", last_name: "", cid: "", role_id: "", branch_location: "", position: "",
  email: "", hired: "", bank_no: "", p_number: "", e_contact: "", birthday: "", age: "",
  gender: "", m_status: "", children_number: "0", underlying_disease: "",
  h_address: "", mhoo: "", soi: "", road: "", sub_district: "", district: "", province: "", postal_code: "",
})
const emptyWork = () => ({ company_name: "", position: "", from_date: "", to_date: "" })
const emptyCrime = () => ({ charge: "", court: "", case_date: "", outcome: "" })

export default function HREmployeesTab() {
  const navigate = useNavigate()
  const [users, setUsers] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")

  const [search, setSearch] = useState("")
  const [filterBranch, setFilterBranch] = useState("")
  const [filterActive, setFilterActive] = useState("true")
  const [branches, setBranches] = useState([])
  const [positions, setPositions] = useState([])

  const [showSignup, setShowSignup] = useState(false)
  const [form, setForm] = useState(emptyForm())
  const [workExperiences, setWorkExperiences] = useState([emptyWork()])
  const [criminalRecords, setCriminalRecords] = useState([emptyCrime()])
  const [submitting, setSubmitting] = useState(false)
  const [submitMsg, setSubmitMsg] = useState("")

  useEffect(() => {
    apiAuth("/order/branch/search")
      .then((data) => setBranches((data || []).map((b) => ({ value: String(b.id), label: b.branch_name }))))
      .catch(() => {})
    apiAuth("/hr/positions")
      .then((data) => setPositions((data || []).map((p) => ({ value: p.position_name, label: p.position_name }))))
      .catch(() => {})
  }, [])

  const fetchUsers = useCallback(() => {
    setLoading(true)
    setError("")
    const params = new URLSearchParams()
    if (search) params.set("name", search)
    if (filterBranch) params.set("branch_id", filterBranch)
    if (filterActive !== "") params.set("is_active", filterActive)
    apiAuth(`/hr/personnel?${params.toString()}`)
      .then(setUsers)
      .catch((e) => setError(e.message || "โหลดข้อมูลไม่สำเร็จ"))
      .finally(() => setLoading(false))
  }, [search, filterBranch, filterActive])

  useEffect(() => {
    const t = setTimeout(fetchUsers, 300)
    return () => clearTimeout(t)
  }, [fetchUsers])

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target ? e.target.value : e }))

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

  const handleSignup = async () => {
    if (!form.first_name || !form.last_name || !form.cid || !form.role_id || !form.branch_location) {
      setSubmitMsg("⚠️ กรุณากรอกข้อมูลที่จำเป็น (ชื่อ, นามสกุล, เลขบัตร, ตำแหน่ง, สาขา)")
      return
    }
    setSubmitting(true)
    setSubmitMsg("")
    try {
      const body = {
        ...form,
        role_id: Number(form.role_id),
        age: form.age ? Number(form.age) : undefined,
        children_number: Number(form.children_number ?? 0),
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
      }
      await apiAuth("/hr/signup", { method: "POST", body })
      setSubmitMsg("✅ ลงทะเบียนสำเร็จ!")
      setTimeout(() => {
        setShowSignup(false)
        setForm(emptyForm())
        setWorkExperiences([emptyWork()])
        setCriminalRecords([emptyCrime()])
        setSubmitMsg("")
        fetchUsers()
      }, 1000)
    } catch (err) {
      setSubmitMsg(`❌ ${err.message || "ลงทะเบียนไม่สำเร็จ"}`)
    } finally {
      setSubmitting(false)
    }
  }

  const activeCount = users.filter((u) => u.is_active).length

  return (
    <div className="space-y-4">
      {/* Controls */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <p className="text-sm text-gray-500 dark:text-gray-400">
          {loading ? "กำลังโหลด..." : `พนักงาน ${users.length} คน · ใช้งานอยู่ ${activeCount} คน`}
        </p>
        <button
          onClick={() => { setShowSignup(true); setSubmitMsg("") }}
          className="flex items-center gap-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 px-4 py-2 text-sm font-semibold text-white shadow-sm transition cursor-pointer"
        >
          ➕ ลงทะเบียนพนักงาน
        </button>
      </div>

      {/* Filters */}
      <div className="rounded-2xl bg-white dark:bg-gray-800 ring-1 ring-gray-200/70 dark:ring-gray-700/70 shadow-sm p-4 flex flex-wrap gap-3">
        <input
          type="text" placeholder="ค้นหา ชื่อ-นามสกุล..." value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="flex-1 min-w-[200px] rounded-xl border border-slate-300 bg-slate-100 px-3 py-2 text-sm text-slate-900 outline-none placeholder:text-slate-400 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/25 transition dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100 dark:placeholder:text-slate-400 dark:focus:border-indigo-400"
        />
        <div className="w-44 shrink-0">
          <SelectDropdown value={filterBranch} onChange={setFilterBranch} placeholder="ทุกสาขา"
            options={[{ value: "", label: "ทุกสาขา" }, ...branches]} />
        </div>
        <div className="w-36 shrink-0">
          <SelectDropdown value={filterActive} onChange={setFilterActive} placeholder="ทุกสถานะ"
            options={[{ value: "", label: "ทุกสถานะ" }, { value: "true", label: "ใช้งาน" }, { value: "false", label: "ไม่ใช้งาน" }]} />
        </div>
      </div>

      {error && (
        <div className="rounded-xl bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 px-4 py-3 text-sm text-red-700 dark:text-red-300">{error}</div>
      )}

      {/* Table */}
      <div className="rounded-2xl bg-white dark:bg-gray-800 ring-1 ring-gray-200/70 dark:ring-gray-700/70 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/30">
                <th className="text-left px-4 py-3 font-semibold text-gray-600 dark:text-gray-400 text-xs uppercase tracking-wide">รหัส</th>
                <th className="text-left px-4 py-3 font-semibold text-gray-600 dark:text-gray-400 text-xs uppercase tracking-wide">ชื่อ-นามสกุล</th>
                <th className="text-left px-4 py-3 font-semibold text-gray-600 dark:text-gray-400 text-xs uppercase tracking-wide hidden md:table-cell">ตำแหน่ง</th>
                <th className="text-left px-4 py-3 font-semibold text-gray-600 dark:text-gray-400 text-xs uppercase tracking-wide hidden lg:table-cell">สาขา</th>
                <th className="text-left px-4 py-3 font-semibold text-gray-600 dark:text-gray-400 text-xs uppercase tracking-wide">Role</th>
                <th className="text-left px-4 py-3 font-semibold text-gray-600 dark:text-gray-400 text-xs uppercase tracking-wide">สถานะ</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-700/50">
              {loading ? (
                <tr><td colSpan={6} className="text-center py-10">
                  <div className="flex justify-center">
                    <div className="h-6 w-6 animate-spin rounded-full border-2 border-gray-200 border-t-indigo-500 dark:border-gray-700 dark:border-t-indigo-400" />
                  </div>
                </td></tr>
              ) : users.length === 0 ? (
                <tr><td colSpan={6} className="text-center py-10 text-sm text-gray-400 dark:text-gray-500">ไม่พบข้อมูลพนักงาน</td></tr>
              ) : users.map((u) => (
                <tr
                  key={u.id}
                  onClick={() => navigate(`/hr/personnel/${u.id}`)}
                  className="hover:bg-indigo-50 dark:hover:bg-indigo-900/10 transition-colors cursor-pointer"
                >
                  <td className="px-4 py-3 font-mono text-gray-500 dark:text-gray-400 text-xs">{u.id}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2.5">
                      <div className="h-8 w-8 shrink-0 rounded-xl bg-indigo-100 dark:bg-indigo-900/30 flex items-center justify-center text-xs font-bold text-indigo-700 dark:text-indigo-300">
                        {u.first_name?.[0] ?? "?"}
                      </div>
                      <p className="font-semibold text-gray-900 dark:text-gray-100">{u.first_name} {u.last_name}</p>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-gray-600 dark:text-gray-400 hidden md:table-cell">{u.position ?? "—"}</td>
                  <td className="px-4 py-3 text-gray-600 dark:text-gray-400 hidden lg:table-cell">{u.branch_location ?? "—"}</td>
                  <td className="px-4 py-3">
                    <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${ROLE_COLOR[u.role_id] ?? "bg-gray-100 text-gray-600"}`}>
                      {ROLE_LABEL[u.role_id] ?? `Role ${u.role_id}`}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${u.is_active ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300" : "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300"}`}>
                      {u.is_active ? "ใช้งาน" : "ไม่ใช้งาน"}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Signup Modal */}
      {showSignup && (
        <Portal>
        <div className="fixed inset-0 z-50 flex items-start justify-center p-4 pt-12 bg-black/50 backdrop-blur-sm overflow-y-auto">
          <div className="w-full max-w-2xl rounded-2xl bg-white dark:bg-gray-800 shadow-2xl p-6 space-y-5 mb-12">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-bold text-gray-900 dark:text-gray-100">➕ ลงทะเบียนพนักงานใหม่</h3>
              <button onClick={() => setShowSignup(false)} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition text-xl cursor-pointer">✕</button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Field label="ชื่อ" required>
                <input type="text" value={form.first_name} onChange={set("first_name")} className={inputCls} placeholder="ชื่อจริง" />
              </Field>
              <Field label="นามสกุล" required>
                <input type="text" value={form.last_name} onChange={set("last_name")} className={inputCls} placeholder="นามสกุล" />
              </Field>
              <Field label="เลขบัตรประชาชน" required>
                <input type="text" value={form.cid} onChange={set("cid")} className={inputCls} placeholder="13 หลัก" maxLength={13} />
              </Field>
              <Field label="วันเกิด">
                <input type="date" value={form.birthday} onChange={set("birthday")} className={inputCls} />
              </Field>
              <Field label="เพศ">
                <SelectDropdown value={form.gender} onChange={(v) => setForm(f => ({ ...f, gender: v }))} placeholder="เลือกเพศ" options={GENDER_OPTIONS} />
              </Field>
              <Field label="สถานภาพ">
                <SelectDropdown value={form.m_status} onChange={(v) => setForm(f => ({ ...f, m_status: v }))} placeholder="เลือกสถานภาพ" options={MARITAL_OPTIONS} />
              </Field>
              <Field label="ตำแหน่ง/Role" required>
                <SelectDropdown value={form.role_id} onChange={(v) => setForm(f => ({ ...f, role_id: v }))} placeholder="เลือก Role" options={ROLE_OPTIONS} />
              </Field>
              <Field label="สาขา" required>
                <SelectDropdown value={form.branch_location} onChange={(v) => setForm(f => ({ ...f, branch_location: v }))} placeholder="เลือกสาขา" options={branches} />
              </Field>
              <Field label="ตำแหน่งงาน">
                <SelectDropdown value={form.position} onChange={(v) => setForm(f => ({ ...f, position: v }))} placeholder="เลือกตำแหน่ง" options={positions} />
              </Field>
              <Field label="วันที่เริ่มงาน">
                <input type="date" value={form.hired} onChange={set("hired")} className={inputCls} />
              </Field>
              <Field label="อีเมล">
                <input type="email" value={form.email} onChange={set("email")} className={inputCls} placeholder="example@email.com" />
              </Field>
              <Field label="เบอร์โทรศัพท์">
                <input type="tel" value={form.p_number} onChange={set("p_number")} className={inputCls} placeholder="08x-xxx-xxxx" />
              </Field>
              <Field label="เลขบัญชีธนาคาร">
                <input type="text" value={form.bank_no} onChange={set("bank_no")} className={inputCls} placeholder="เลขบัญชี" />
              </Field>
              <Field label="ผู้ติดต่อฉุกเฉิน">
                <input type="text" value={form.e_contact} onChange={set("e_contact")} className={inputCls} placeholder="ชื่อ-เบอร์ผู้ติดต่อ" />
              </Field>
              <Field label="โรคประจำตัว">
                <input type="text" value={form.underlying_disease} onChange={set("underlying_disease")} className={inputCls} placeholder="ระบุโรคประจำตัว (ถ้ามี)" />
              </Field>
            </div>

            <div>
              <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-3">ที่อยู่</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Field label="บ้านเลขที่">
                  <input type="text" value={form.h_address} onChange={set("h_address")} className={inputCls} />
                </Field>
                <Field label="หมู่">
                  <input type="text" value={form.mhoo} onChange={set("mhoo")} className={inputCls} />
                </Field>
                <Field label="ซอย">
                  <input type="text" value={form.soi} onChange={set("soi")} className={inputCls} />
                </Field>
                <Field label="ถนน">
                  <input type="text" value={form.road} onChange={set("road")} className={inputCls} />
                </Field>
                <Field label="ตำบล/แขวง">
                  <input type="text" value={form.sub_district} onChange={set("sub_district")} className={inputCls} />
                </Field>
                <Field label="อำเภอ/เขต">
                  <input type="text" value={form.district} onChange={set("district")} className={inputCls} />
                </Field>
                <Field label="จังหวัด">
                  <input type="text" value={form.province} onChange={set("province")} className={inputCls} />
                </Field>
                <Field label="รหัสไปรษณีย์">
                  <input type="text" value={form.postal_code} onChange={set("postal_code")} className={inputCls} />
                </Field>
              </div>
            </div>

            {/* ประวัติการทำงาน */}
            <div>
              <div className="flex items-center justify-between mb-3">
                <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">ประวัติการทำงาน (ถ้ามี)</p>
                <button type="button" onClick={addWork} className="text-xs font-medium text-indigo-600 dark:text-indigo-400 hover:underline cursor-pointer">+ เพิ่มรายการ</button>
              </div>
              {workExperiences.map((w, i) => (
                <div key={i} className="rounded-xl bg-gray-50 dark:bg-gray-700/40 p-4 space-y-3 relative mb-3">
                  {workExperiences.length > 1 && (
                    <button type="button" onClick={() => removeWork(i)} className="absolute top-3 right-3 text-xs text-red-500 hover:text-red-700 cursor-pointer">✕ ลบ</button>
                  )}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <Field label="ชื่อบริษัท/สถานที่ทำงาน">
                      <input type="text" value={w.company_name} onChange={setWork(i, "company_name")} className={inputCls} placeholder="ชื่อบริษัท" />
                    </Field>
                    <Field label="ตำแหน่ง">
                      <input type="text" value={w.position} onChange={setWork(i, "position")} className={inputCls} placeholder="ตำแหน่งที่ทำ" />
                    </Field>
                    <Field label="ตั้งแต่">
                      <input type="date" value={w.from_date} onChange={setWork(i, "from_date")} className={inputCls} />
                    </Field>
                    <Field label="ถึง">
                      <input type="date" value={w.to_date} onChange={setWork(i, "to_date")} className={inputCls} />
                    </Field>
                  </div>
                </div>
              ))}
            </div>

            {/* ประวัติอาชญากรรม */}
            <div>
              <div className="flex items-center justify-between mb-3">
                <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">ประวัติอาชญากรรม (ถ้ามี)</p>
                <button type="button" onClick={addCrime} className="text-xs font-medium text-indigo-600 dark:text-indigo-400 hover:underline cursor-pointer">+ เพิ่มรายการ</button>
              </div>
              {criminalRecords.map((c, i) => (
                <div key={i} className="rounded-xl bg-gray-50 dark:bg-gray-700/40 p-4 space-y-3 relative mb-3">
                  {criminalRecords.length > 1 && (
                    <button type="button" onClick={() => removeCrime(i)} className="absolute top-3 right-3 text-xs text-red-500 hover:text-red-700 cursor-pointer">✕ ลบ</button>
                  )}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <Field label="ข้อหา">
                      <input type="text" value={c.charge} onChange={setCrime(i, "charge")} className={inputCls} placeholder="ระบุข้อหา" />
                    </Field>
                    <Field label="ศาล">
                      <input type="text" value={c.court} onChange={setCrime(i, "court")} className={inputCls} placeholder="ชื่อศาล" />
                    </Field>
                    <Field label="วันที่คดี">
                      <input type="date" value={c.case_date} onChange={setCrime(i, "case_date")} className={inputCls} />
                    </Field>
                    <Field label="ผลการตัดสิน">
                      <input type="text" value={c.outcome} onChange={setCrime(i, "outcome")} className={inputCls} placeholder="ผลคดี" />
                    </Field>
                  </div>
                </div>
              ))}
            </div>

            {submitMsg && (
              <p className={`text-sm text-center font-medium ${submitMsg.startsWith("✅") ? "text-emerald-600 dark:text-emerald-400" : "text-red-600 dark:text-red-400"}`}>
                {submitMsg}
              </p>
            )}
            <div className="flex gap-3 pt-2">
              <button onClick={() => setShowSignup(false)} className="flex-1 h-10 rounded-xl border border-gray-300 dark:border-gray-600 text-sm font-semibold text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700 transition cursor-pointer">
                ยกเลิก
              </button>
              <button onClick={handleSignup} disabled={submitting}
                className="flex-1 h-10 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-semibold transition shadow-sm disabled:opacity-60 cursor-pointer">
                {submitting ? "กำลังบันทึก..." : "ลงทะเบียน"}
              </button>
            </div>
          </div>
        </div>
        </Portal>
      )}
    </div>
  )
}
