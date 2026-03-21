// src/pages/Home.jsx
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

function Home() {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchUser = async () => {
      try {
        const data = await apiAuth("/me")  // 👈 endpoint profile ผู้ใช้
        setUser(data)
      } catch (err) {
        console.error("โหลดข้อมูลผู้ใช้ล้มเหลว:", err)
      } finally {
        setLoading(false)
      }
    }
    fetchUser()
  }, [])

  const localUser = getUser() || {}
  const roleId = getRoleId()
  const roleLabel = ROLE_LABEL[roleId] ?? `Role ${roleId}`
  const displayName = user?.name || localUser?.username || "ผู้ใช้"
  const avatarLetter = (displayName[0] || "U").toUpperCase()

  const now = new Date()
  const hour = now.getHours()
  const greeting = hour < 12 ? "อรุณสวัสดิ์" : hour < 17 ? "สวัสดีตอนบ่าย" : "สวัสดีตอนเย็น"
  const dateStr = now.toLocaleDateString("th-TH", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  })

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
    <div className="space-y-5 py-2">

      {/* Welcome Card */}
      <div className="rounded-2xl bg-gradient-to-br from-indigo-500 to-indigo-700 p-6 text-white shadow-md">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
          <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-white/20 text-xl font-bold shadow-inner">
            {avatarLetter}
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium text-indigo-100">{greeting} 👋</p>
            <h1 className="mt-0.5 text-xl font-bold leading-tight">{displayName}</h1>
            <span className="mt-2 inline-block rounded-full bg-white/20 px-3 py-0.5 text-xs font-semibold">
              {roleLabel}
            </span>
          </div>
          <div className="hidden shrink-0 text-right text-sm text-indigo-100 sm:block">
            <p>{dateStr}</p>
          </div>
        </div>
      </div>

      {/* Date — mobile only */}
      <div className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-gray-200/70 dark:bg-gray-800 dark:ring-gray-700/70 sm:hidden">
        <div className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400">
          <span>📅</span>
          <span>{dateStr}</span>
        </div>
      </div>

      {/* System status */}
      <div className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-gray-200/70 dark:bg-gray-800 dark:ring-gray-700/70">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-emerald-100 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-400 text-base font-bold">
            ✓
          </div>
          <div>
            <p className="text-sm font-semibold text-gray-800 dark:text-gray-100">ระบบพร้อมใช้งาน</p>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              สหกรณ์การเกษตรเพื่อการตลาดลูกค้า ธ.ก.ส. สุรินทร์
            </p>
          </div>
        </div>
      </div>

    </div>
  )
}

export default Home
