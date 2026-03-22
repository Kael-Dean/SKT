// src/pages/MyProfile.jsx
// หน้าข้อมูลส่วนตัวของผู้ใช้ปัจจุบัน — ดึงจาก GET /hr/me
import { useEffect, useState } from "react"
import { apiAuth } from "../lib/api"
import { getUser, getRoleId } from "../lib/auth"

const ROLE_LABEL = {
  1: "ผู้ดูแลระบบ",
  2: "ผู้จัดการ",
  3: "ฝ่ายบุคคล",
  4: "หัวหน้าบัญชี",
  5: "การตลาด",
}

const GENDER_LABEL = { M: "ชาย", F: "หญิง", other: "อื่นๆ" }
const MARITAL_LABEL = {
  single: "โสด",
  married: "สมรส",
  divorced: "หย่าร้าง",
  widowed: "หม้าย",
}

// Mock data ใช้แสดงเมื่อยังไม่มีข้อมูลจริงในระบบ
const MOCK_FINANCIAL = {
  current_salary: 25000,
  job_age: 2,
  current_loan: 0,
  current_ss: 750,
  current_prov: 1250,
  current_reserve: 0,
}

const MOCK_LEAVE_QUOTA = {
  year: new Date().getFullYear(),
  sick_leave: 30,
  business_leave: 7,
  annual_leave: 10,
  maternity_leave: 98,
  paternity_leave: 15,
}

const MOCK_POSITION_HISTORY = [
  { position: "พนักงานทั่วไป", branch: "สำนักงานใหญ่", from_date: "2023-04-01", to_date: null, is_current: true },
  { position: "ผู้ช่วยฝ่ายปฏิบัติการ", branch: "สำนักงานใหญ่", from_date: "2022-04-01", to_date: "2023-03-31", is_current: false },
]

function MockBadge() {
  return (
    <span className="ml-2 inline-flex items-center rounded-full bg-amber-100 dark:bg-amber-900/30 px-2 py-0.5 text-[10px] font-semibold text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-700">
      Mock
    </span>
  )
}

function MockBanner() {
  return (
    <div className="flex items-start gap-2 rounded-lg bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700 px-3 py-2 mb-3">
      <span className="text-amber-500 mt-0.5">⚠️</span>
      <p className="text-xs text-amber-700 dark:text-amber-300">
        ข้อมูลส่วนนี้ยังไม่มีในระบบ — แสดงข้อมูลตัวอย่างไว้ก่อน รอกรอกข้อมูลจริงจากฝ่าย HR
      </p>
    </div>
  )
}

function SectionTitle({ children, mock }) {
  return (
    <h3 className="text-xs font-semibold text-indigo-700 dark:text-indigo-300 uppercase tracking-wide mb-3 pb-1 border-b border-indigo-100 dark:border-indigo-900/40 flex items-center">
      {children}
      {mock && <MockBadge />}
    </h3>
  )
}

function InfoRow({ label, value, mono, mock }) {
  if (value === null || value === undefined || value === "") return null
  return (
    <div className="flex flex-col sm:flex-row sm:gap-4 py-2 border-b border-gray-100 dark:border-gray-700/50 last:border-0">
      <span className="text-xs font-medium text-gray-500 dark:text-gray-400 sm:w-44 shrink-0">{label}</span>
      <span className={`text-sm text-gray-900 dark:text-gray-100 mt-0.5 sm:mt-0 flex items-center gap-1.5 ${mono ? "font-mono" : ""}`}>
        {value}
        {mock && <span className="text-[10px] text-amber-500 font-semibold">(mock)</span>}
      </span>
    </div>
  )
}

function formatDate(d) {
  if (!d) return null
  try {
    return new Date(d).toLocaleDateString("th-TH", { year: "numeric", month: "long", day: "numeric" })
  } catch {
    return d
  }
}

function formatMoney(n) {
  if (n == null) return null
  return Number(n).toLocaleString("th-TH", { minimumFractionDigits: 2 }) + " บาท"
}

function maskCID(cid) {
  if (!cid || cid.length < 4) return cid
  return cid.slice(0, 1) + "X".repeat(cid.length - 4) + cid.slice(-3)
}

export default function MyProfile() {
  const localUser = getUser() || {}
  const roleId = getRoleId()
  const roleLabel = ROLE_LABEL[roleId] ?? `Role ${roleId}`

  const [profile, setProfile] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")

  useEffect(() => {
    apiAuth("/hr/me")
      .then(setProfile)
      .catch(() => setError("ไม่สามารถโหลดข้อมูลโปรไฟล์ HR ได้"))
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

  const displayName =
    profile?.first_name && profile?.last_name
      ? `${profile.first_name} ${profile.last_name}`
      : localUser.username || "ผู้ใช้"
  const avatarLetter = (displayName[0] || "U").toUpperCase()

  // Build full address string
  const addr = profile?.address
  const addressParts = addr
    ? [addr.h_address, addr.mhoo ? `หมู่ ${addr.mhoo}` : null, addr.soi ? `ซ.${addr.soi}` : null,
       addr.road ? `ถ.${addr.road}` : null, addr.sub_district, addr.district, addr.province, addr.postal_code]
        .filter(Boolean).join(" ")
    : null

  // Use real data or fallback to mock
  const financial = profile?.financial ?? MOCK_FINANCIAL
  const isMockFinancial = !profile?.financial
  const leaveQuota = profile?.leave_quota ?? MOCK_LEAVE_QUOTA
  const isMockLeave = !profile?.leave_quota
  const positionHistory = MOCK_POSITION_HISTORY // always mock until backend provides endpoint

  return (
    <div className="max-w-2xl mx-auto space-y-5 pb-10">
      <h1 className="text-xl font-bold text-gray-900 dark:text-gray-100">ข้อมูลส่วนตัว</h1>

      {/* Avatar Card */}
      <div className="rounded-2xl bg-gradient-to-br from-indigo-500 to-indigo-700 p-6 text-white shadow-md">
        <div className="flex items-center gap-4">
          <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl bg-white/20 text-2xl font-bold shadow-inner">
            {avatarLetter}
          </div>
          <div className="min-w-0">
            <p className="text-lg font-bold leading-tight">{displayName}</p>
            {profile?.position_title && (
              <p className="text-sm text-indigo-200 mt-0.5">{profile.position_title}</p>
            )}
            <div className="mt-2 flex flex-wrap gap-2">
              <span className="inline-block rounded-full bg-white/20 px-3 py-0.5 text-xs font-semibold">
                {roleLabel}
              </span>
              {profile?.branch_name && (
                <span className="inline-block rounded-full bg-white/20 px-3 py-0.5 text-xs font-semibold">
                  {profile.branch_name}
                </span>
              )}
              {profile?.is_active === false && (
                <span className="inline-block rounded-full bg-red-400/70 px-3 py-0.5 text-xs font-semibold">
                  ไม่ใช้งาน
                </span>
              )}
            </div>
          </div>
        </div>
      </div>

      {error && (
        <div className="rounded-xl bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 px-4 py-3 text-sm text-amber-700 dark:text-amber-300">
          ⚠️ {error} — แสดงข้อมูลจาก session ที่มีอยู่เท่านั้น
        </div>
      )}

      {/* ─── ข้อมูลบัญชี ─── */}
      <div className="rounded-2xl bg-white dark:bg-gray-800 shadow-sm ring-1 ring-gray-200/70 dark:ring-gray-700/70 p-5">
        <SectionTitle>ข้อมูลบัญชี</SectionTitle>
        <InfoRow label="Username" value={profile?.username ?? localUser.username} mono />
        <InfoRow label="รหัสพนักงาน" value={profile?.id ?? localUser.id} />
        <InfoRow label="ชื่อ-นามสกุล"
          value={profile?.first_name && profile?.last_name
            ? `${profile.first_name} ${profile.last_name}` : undefined}
        />
        <InfoRow label="Email" value={profile?.email} />
        <InfoRow label="ตำแหน่งงาน" value={profile?.position_title} />
        <InfoRow label="สาขา" value={profile?.branch_name} />
        <InfoRow label="สิทธิ์ผู้ใช้" value={roleLabel} />
      </div>

      {/* ─── ข้อมูลส่วนบุคคล ─── */}
      <div className="rounded-2xl bg-white dark:bg-gray-800 shadow-sm ring-1 ring-gray-200/70 dark:ring-gray-700/70 p-5">
        <SectionTitle>ข้อมูลส่วนบุคคล</SectionTitle>
        <InfoRow label="วันที่เริ่มงาน" value={formatDate(profile?.hired)} />
        <InfoRow label="เลขบัตรประชาชน" value={profile?.cid ? maskCID(profile.cid) : null} mono />
        <InfoRow label="วันเกิด" value={formatDate(profile?.birthday)} />
        <InfoRow label="อายุ" value={profile?.age != null ? `${profile.age} ปี` : null} />
        <InfoRow label="เพศ" value={GENDER_LABEL[profile?.gender] ?? profile?.gender} />
        <InfoRow label="สถานภาพสมรส" value={MARITAL_LABEL[profile?.m_status] ?? profile?.m_status} />
        <InfoRow label="จำนวนบุตร" value={profile?.children_number != null ? `${profile.children_number} คน` : null} />
        <InfoRow label="เบอร์โทรศัพท์" value={profile?.p_number} />
        <InfoRow label="Line ID" value={profile?.line_id} />
        <InfoRow label="เบอร์ฉุกเฉิน" value={profile?.e_contact} />
        <InfoRow label="เลขบัญชีธนาคาร" value={profile?.bank_no} mono />
        {!profile?.hired && !profile?.cid && !profile?.p_number && (
          <p className="text-xs text-gray-400 dark:text-gray-500 text-center py-3 italic">
            ยังไม่มีข้อมูลส่วนบุคคล — กรุณาติดต่อฝ่าย HR เพื่อกรอกข้อมูล
          </p>
        )}
      </div>

      {/* ─── ที่อยู่ ─── */}
      <div className="rounded-2xl bg-white dark:bg-gray-800 shadow-sm ring-1 ring-gray-200/70 dark:ring-gray-700/70 p-5">
        <SectionTitle>ที่อยู่</SectionTitle>
        {addressParts
          ? <p className="text-sm text-gray-800 dark:text-gray-200 leading-relaxed">{addressParts}</p>
          : <p className="text-xs text-gray-400 dark:text-gray-500 text-center py-3 italic">ยังไม่มีข้อมูลที่อยู่ — กรุณาติดต่อฝ่าย HR เพื่อกรอกข้อมูล</p>
        }
      </div>

      {/* ─── ประวัติการศึกษา ─── */}
      <div className="rounded-2xl bg-white dark:bg-gray-800 shadow-sm ring-1 ring-gray-200/70 dark:ring-gray-700/70 p-5">
        <SectionTitle>ประวัติการศึกษา</SectionTitle>
        {profile?.education?.length > 0
          ? (
            <div className="space-y-3">
              {profile.education.map((edu, i) => (
                <div key={i} className="rounded-xl bg-gray-50 dark:bg-gray-700/40 p-3 text-sm space-y-1">
                  <p className="font-semibold text-gray-800 dark:text-gray-200">{edu.ed_level ?? "—"}</p>
                  {edu.inst_name && <p className="text-gray-600 dark:text-gray-400">{edu.inst_name}</p>}
                  {(edu.from_date || edu.to_date) && (
                    <p className="text-xs text-gray-500 dark:text-gray-500">
                      {formatDate(edu.from_date)} {edu.from_date && edu.to_date ? "–" : ""} {formatDate(edu.to_date)}
                    </p>
                  )}
                </div>
              ))}
            </div>
          )
          : <p className="text-xs text-gray-400 dark:text-gray-500 text-center py-3 italic">ยังไม่มีข้อมูลการศึกษา — กรุณาติดต่อฝ่าย HR เพื่อกรอกข้อมูล</p>
        }
      </div>

      {/* ─── ประวัติตำแหน่ง ─── */}
      <div className="rounded-2xl bg-white dark:bg-gray-800 shadow-sm ring-1 ring-gray-200/70 dark:ring-gray-700/70 p-5">
        <SectionTitle mock>ประวัติตำแหน่ง / การเลื่อนขั้น</SectionTitle>
        <MockBanner />
        <div className="relative">
          <div className="absolute left-3.5 top-0 bottom-0 w-px bg-indigo-100 dark:bg-indigo-900/40" />
          <div className="space-y-4">
            {positionHistory.map((pos, i) => (
              <div key={i} className="relative flex gap-4 pl-10">
                <div className={`absolute left-2 top-1 h-3 w-3 rounded-full border-2 ${pos.is_current ? "bg-indigo-500 border-indigo-500" : "bg-gray-300 dark:bg-gray-600 border-gray-300 dark:border-gray-600"}`} />
                <div className="flex-1 rounded-xl bg-gray-50 dark:bg-gray-700/40 p-3 text-sm space-y-0.5">
                  <div className="flex items-center justify-between gap-2 flex-wrap">
                    <p className="font-semibold text-gray-800 dark:text-gray-200">{pos.position}</p>
                    {pos.is_current && (
                      <span className="rounded-full bg-indigo-100 dark:bg-indigo-900/40 px-2 py-0.5 text-xs font-semibold text-indigo-700 dark:text-indigo-300">
                        ปัจจุบัน
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-gray-500 dark:text-gray-400">{pos.branch}</p>
                  <p className="text-xs text-gray-400 dark:text-gray-500">
                    {formatDate(pos.from_date)} {pos.to_date ? `– ${formatDate(pos.to_date)}` : "– ปัจจุบัน"}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ─── ข้อมูลทางการเงิน ─── */}
      <div className="rounded-2xl bg-white dark:bg-gray-800 shadow-sm ring-1 ring-gray-200/70 dark:ring-gray-700/70 p-5">
        <SectionTitle mock={isMockFinancial}>ข้อมูลทางการเงิน</SectionTitle>
        {isMockFinancial && <MockBanner />}
        <InfoRow label="เงินเดือนปัจจุบัน" value={formatMoney(financial.current_salary)} mock={isMockFinancial} />
        <InfoRow label="อายุงาน" value={financial.job_age != null ? `${financial.job_age} ปี` : null} mock={isMockFinancial} />
        <InfoRow label="เงินกู้สหกรณ์" value={formatMoney(financial.current_loan)} mock={isMockFinancial} />
        <InfoRow label="ประกันสังคม" value={formatMoney(financial.current_ss)} mock={isMockFinancial} />
        <InfoRow label="กองทุนสำรองเลี้ยงชีพ" value={formatMoney(financial.current_prov)} mock={isMockFinancial} />
      </div>

      {/* ─── สิทธิ์การลา ─── */}
      <div className="rounded-2xl bg-white dark:bg-gray-800 shadow-sm ring-1 ring-gray-200/70 dark:ring-gray-700/70 p-5">
        <SectionTitle mock={isMockLeave}>สิทธิ์การลา ปีงบประมาณ {leaveQuota.year}</SectionTitle>
        {isMockLeave && <MockBanner />}
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
          {[
            { label: "ลาป่วย", days: leaveQuota.sick_leave },
            { label: "ลากิจ", days: leaveQuota.business_leave },
            { label: "ลาพักร้อน", days: leaveQuota.annual_leave },
            { label: "ลาคลอด", days: leaveQuota.maternity_leave },
            { label: "ลาเลี้ยงดูบุตร", days: leaveQuota.paternity_leave },
          ].filter((q) => q.days > 0).map((q) => (
            <div key={q.label} className="rounded-xl bg-indigo-50 dark:bg-indigo-900/20 p-3 text-center">
              <p className="text-xs text-gray-500 dark:text-gray-400">{q.label}</p>
              <p className="text-lg font-bold text-indigo-700 dark:text-indigo-300 mt-0.5">{q.days}</p>
              <p className="text-xs text-gray-400">วัน/ปี</p>
            </div>
          ))}
        </div>
      </div>

      <p className="text-xs text-center text-gray-400 dark:text-gray-600">
        หากต้องการแก้ไขข้อมูล กรุณาติดต่อฝ่ายบุคคล
      </p>
    </div>
  )
}
