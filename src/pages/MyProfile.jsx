// src/pages/MyProfile.jsx
// หน้าข้อมูลส่วนตัวของผู้ใช้ปัจจุบัน
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

function InfoRow({ label, value }) {
  if (!value && value !== 0) return null
  return (
    <div className="flex flex-col sm:flex-row sm:gap-4 py-2.5 border-b border-gray-100 dark:border-gray-700/60 last:border-0">
      <span className="text-xs font-medium text-gray-500 dark:text-gray-400 sm:w-40 shrink-0">{label}</span>
      <span className="text-sm text-gray-900 dark:text-gray-100 mt-0.5 sm:mt-0">{value}</span>
    </div>
  )
}

export default function MyProfile() {
  const localUser = getUser() || {}
  const roleId = getRoleId()
  const roleLabel = ROLE_LABEL[roleId] ?? `Role ${roleId}`
  const displayName = `${localUser.username || "ผู้ใช้"}`
  const avatarLetter = (displayName[0] || "U").toUpperCase()

  const [profile, setProfile] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")

  useEffect(() => {
    apiAuth("/me")
      .then(setProfile)
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

  return (
    <div className="max-w-2xl mx-auto space-y-5 pb-10">
      <h1 className="text-xl font-bold text-gray-900 dark:text-gray-100">ข้อมูลส่วนตัว</h1>

      {/* Avatar Card */}
      <div className="rounded-2xl bg-gradient-to-br from-indigo-500 to-indigo-700 p-6 text-white shadow-md">
        <div className="flex items-center gap-4">
          <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl bg-white/20 text-2xl font-bold shadow-inner">
            {avatarLetter}
          </div>
          <div>
            <p className="text-lg font-bold leading-tight">
              {profile?.first_name && profile?.last_name
                ? `${profile.first_name} ${profile.last_name}`
                : displayName}
            </p>
            <span className="mt-1.5 inline-block rounded-full bg-white/20 px-3 py-0.5 text-xs font-semibold">
              {roleLabel}
            </span>
          </div>
        </div>
      </div>

      {error && (
        <div className="rounded-xl bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 px-4 py-3 text-sm text-amber-700 dark:text-amber-300">
          ⚠️ {error} — แสดงข้อมูลจาก session ที่มีอยู่
        </div>
      )}

      {/* Account info */}
      <div className="rounded-2xl bg-white dark:bg-gray-800 shadow-sm ring-1 ring-gray-200/70 dark:ring-gray-700/70 p-5">
        <h2 className="text-sm font-semibold text-indigo-700 dark:text-indigo-300 uppercase tracking-wide mb-3">
          ข้อมูลบัญชี
        </h2>
        <InfoRow label="Username" value={localUser.username} />
        <InfoRow label="รหัสผู้ใช้" value={localUser.id} />
        <InfoRow label="สิทธิ์การใช้งาน" value={roleLabel} />
        {profile?.email && <InfoRow label="Email" value={profile.email} />}
      </div>

      {/* Personal info from /me */}
      {profile && (
        <div className="rounded-2xl bg-white dark:bg-gray-800 shadow-sm ring-1 ring-gray-200/70 dark:ring-gray-700/70 p-5">
          <h2 className="text-sm font-semibold text-indigo-700 dark:text-indigo-300 uppercase tracking-wide mb-3">
            ข้อมูลทั่วไป
          </h2>
          <InfoRow label="ชื่อ-นามสกุล"
            value={profile.first_name && profile.last_name
              ? `${profile.first_name} ${profile.last_name}`
              : undefined}
          />
          <InfoRow label="ตำแหน่ง" value={profile.position_title ?? profile.position} />
          <InfoRow label="สาขา" value={profile.branch_location} />
          <InfoRow label="วันที่เริ่มงาน" value={profile.hired} />
          <InfoRow label="เบอร์โทร" value={profile.p_number} />
          <InfoRow label="Line ID" value={profile.line_id} />
          <InfoRow label="เบอร์ฉุกเฉิน" value={profile.e_contact} />
        </div>
      )}

      <p className="text-xs text-center text-gray-400 dark:text-gray-600">
        หากต้องการแก้ไขข้อมูล กรุณาติดต่อฝ่ายบุคคล
      </p>
    </div>
  )
}
