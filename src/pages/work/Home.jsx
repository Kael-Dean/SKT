// src/pages/Home.jsx
import { useEffect, useState } from "react"
import { useNavigate } from "react-router-dom"
import { apiAuth } from "../../lib/api"
import { getUser, getRoleId, canSeeAddCompany } from "../../lib/auth"

const ROLE = { ADMIN: 1, MNG: 2, HR: 3, HA: 4, MKT: 5 }

const ROLE_LABEL = {
  1: "ผู้ดูแลระบบ",
  2: "ผู้จัดการ",
  3: "ฝ่ายบุคคล",
  4: "หัวหน้าบัญชี",
  5: "การตลาด",
}

// ฟังก์ชันทั้งหมดที่ใช้ในการทำงาน (แสดงตาม role)
const ALL_FUNCTIONS = [
  {
    group: "ธุรกิจรวบรวมผลผลิตต",
    icon: "🌾",
    color: "from-green-400 to-emerald-500",
    items: [
      { label: "ยกมา", path: "/bring-in", icon: "📤", roles: [ROLE.ADMIN, ROLE.MNG, ROLE.HR, ROLE.MKT] },
      { label: "ยกเข้าโรงสี", path: "/bring-in-mill", icon: "🏭", roles: "special" },
      { label: "ซื้อข้าว", path: "/Buy", icon: "🛒", roles: [ROLE.ADMIN, ROLE.MNG, ROLE.HR, ROLE.MKT] },
      { label: "ขายข้าว", path: "/sales", icon: "💰", roles: [ROLE.ADMIN, ROLE.MNG, ROLE.HR, ROLE.MKT] },
      { label: "รับเข้า", path: "/transfer-in", icon: "📥", roles: [ROLE.ADMIN, ROLE.MNG, ROLE.HR, ROLE.MKT] },
      { label: "โอนออก", path: "/transfer-out", icon: "📦", roles: [ROLE.ADMIN, ROLE.MNG, ROLE.HR, ROLE.MKT] },
      { label: "ส่งสี", path: "/transfer-mill", icon: "🔄", roles: [ROLE.ADMIN, ROLE.MNG, ROLE.HR, ROLE.MKT] },
      { label: "ตัดเสียหาย", path: "/damage-out", icon: "⚠️", roles: [ROLE.ADMIN, ROLE.MNG, ROLE.HR, ROLE.MKT] },
    ],
  },
  {
    group: "ทะเบียนสมาชิก",
    icon: "🪪",
    color: "from-blue-400 to-indigo-500",
    items: [
      { label: "สมัครสมาชิก", path: "/member-signup", icon: "📝", roles: [ROLE.ADMIN, ROLE.MNG, ROLE.MKT] },
      { label: "เพิ่มลูกค้าทั่วไป", path: "/customer-add", icon: "📝", roles: [ROLE.ADMIN, ROLE.MNG, ROLE.MKT] },
      { label: "เพิ่มบริษัท", path: "/company-add", icon: "📝", roles: "company" },
      { label: "ค้นหาสมาชิก", path: "/search", icon: "🔎", roles: [ROLE.ADMIN, ROLE.MNG, ROLE.HA, ROLE.MKT] },
      { label: "ค้นหาลูกค้าทั่วไป", path: "/customer-search", icon: "🔎", roles: [ROLE.ADMIN, ROLE.MNG, ROLE.HA, ROLE.MKT] },
      { label: "สมาชิกสิ้นสภาพ", path: "/member-termination", icon: "🪪", roles: [ROLE.ADMIN, ROLE.MNG, ROLE.MKT] },
      { label: "ซื้อหุ้น", path: "/share", icon: "📈", roles: [ROLE.ADMIN, ROLE.MNG, ROLE.HA, ROLE.MKT] },
    ],
  },
  {
    group: "ออเดอร์ & คลังสินค้า",
    icon: "📦",
    color: "from-orange-400 to-amber-500",
    items: [
      { label: "ดูออเดอร์ซื้อขาย", path: "/order", icon: "📝", roles: [ROLE.ADMIN, ROLE.MNG, ROLE.HR, ROLE.HA, ROLE.MKT] },
      { label: "แก้ไขออเดอร์", path: "/order-correction", icon: "🛠️", roles: [ROLE.ADMIN, ROLE.MNG, ROLE.HR, ROLE.HA, ROLE.MKT] },
      { label: "คลังสินค้า", path: "/stock", icon: "🏭", roles: [ROLE.ADMIN, ROLE.MNG, ROLE.HR, ROLE.MKT] },
      { label: "เพิ่มรหัสข้าว", path: "/spec/create", icon: "🌾", roles: [ROLE.ADMIN, ROLE.HA, ROLE.MKT] },
    ],
  },
  {
    group: "รายงาน & แผน",
    icon: "📊",
    color: "from-purple-400 to-violet-500",
    items: [
      { label: "รายงาน", path: "/documents", icon: "📝", roles: [ROLE.ADMIN, ROLE.MNG, ROLE.HA] },
      { label: "แผนปฏิบัติงานรายปี", path: "/operation-plan", icon: "🗺️", roles: "all" },
      { label: "แก้ไขข้อมูลธุรกิจ", path: "/business-edit", icon: "⚙️", roles: "all" },
    ],
  },
  {
    group: "HR — บุคลากร",
    icon: "👥",
    color: "from-rose-400 to-pink-500",
    items: [
      { label: "ลงทะเบียนพนักงาน", path: "/hr/staff-signup",  icon: "➕", roles: [ROLE.ADMIN, ROLE.HR] },
      { label: "รายชื่อพนักงาน",    path: "/hr/users",         icon: "📋", roles: [ROLE.ADMIN, ROLE.HR] },
      { label: "อนุมัติใบลา",       path: "/hr/leaves",        icon: "📅", roles: [ROLE.ADMIN, ROLE.HR] },
      { label: "ข้อมูลการเงิน",     path: "/hr/finance",       icon: "💰", roles: [ROLE.ADMIN] },
      { label: "ย้ายสาขา",          path: "/hr/relocation",    icon: "🏢", roles: [ROLE.ADMIN] },
    ],
  },
]

function canAccessItem(item, roleId, uid, canCompany) {
  if (item.path === "/bring-in-mill") {
    return uid === 17 || uid === 18
  }
  if (item.roles === "all") return true
  if (item.roles === "company") return canCompany
  if (Array.isArray(item.roles)) return item.roles.includes(roleId)
  return false
}

function FunctionCard({ item, onClick }) {
  return (
    <button
      onClick={() => onClick(item.path)}
      className="group flex flex-col items-center justify-center gap-2 rounded-xl bg-gray-50 p-3 ring-1 ring-gray-200/60 transition-all duration-150 hover:bg-indigo-50 hover:ring-indigo-200 hover:shadow-sm hover:scale-[1.04] active:scale-[0.97] focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 dark:bg-gray-800/60 dark:ring-gray-700/60 dark:hover:bg-indigo-900/25 dark:hover:ring-indigo-700/60 cursor-pointer min-h-[76px]"
    >
      <span className="text-xl leading-none transition-transform duration-150 group-hover:scale-110">{item.icon}</span>
      <span className="text-[11px] font-medium text-gray-600 dark:text-gray-400 text-center leading-tight group-hover:text-indigo-700 dark:group-hover:text-indigo-300 transition-colors duration-150">
        {item.label}
      </span>
    </button>
  )
}

export default function Home() {
  const navigate = useNavigate()
  const [apiUser, setApiUser] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    apiAuth("/me")
      .then(setApiUser)
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  const localUser = getUser() || {}
  const roleId = getRoleId()
  const roleLabel = ROLE_LABEL[roleId] ?? `Role ${roleId}`
  const uid = Number(localUser.id ?? 0)
  const canCompany = canSeeAddCompany()

  const displayName =
    apiUser?.first_name && apiUser?.last_name
      ? `${apiUser.first_name} ${apiUser.last_name}`
      : localUser.username || "ผู้ใช้"
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
          <div className="h-7 w-7 animate-spin rounded-full border-2 border-gray-200 border-t-indigo-500 dark:border-gray-700 dark:border-t-indigo-400" />
          <span className="text-sm text-gray-400 dark:text-gray-500">กำลังโหลด...</span>
        </div>
      </div>
    )
  }

  // กรอง group ที่มีอย่างน้อย 1 item ที่ user เข้าถึงได้
  const visibleGroups = ALL_FUNCTIONS
    .map((group) => ({
      ...group,
      items: group.items.filter((item) => canAccessItem(item, roleId, uid, canCompany)),
    }))
    .filter((group) => group.items.length > 0)

  return (
    <div className="space-y-5 py-2">

      {/* Welcome Card */}
      <div className="animate-fade-up relative overflow-hidden rounded-2xl bg-gradient-to-br from-indigo-500 to-indigo-700 p-6 text-white shadow-lg">
        <div className="welcome-shimmer pointer-events-none absolute inset-0" aria-hidden="true" />
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
          <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-white/20 text-xl font-bold ring-2 ring-white/30">
            {avatarLetter}
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-sm text-indigo-200">{greeting}</p>
            <h1 className="mt-0.5 text-xl font-bold leading-tight tracking-tight">{displayName}</h1>
            <span className="mt-2 inline-block rounded-full bg-white/15 px-3 py-0.5 text-xs font-semibold ring-1 ring-white/20">
              {roleLabel}
            </span>
          </div>
          <div className="hidden shrink-0 text-right sm:block">
            <p className="text-sm text-indigo-200">{dateStr}</p>
          </div>
        </div>
      </div>

      {/* Date — mobile only */}
      <div className="rounded-2xl bg-white p-3.5 shadow-sm ring-1 ring-gray-200/70 dark:bg-gray-800 dark:ring-gray-700/70 sm:hidden">
        <div className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400">
          <svg className="h-4 w-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5">
            <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 9v7.5" />
          </svg>
          <span>{dateStr}</span>
        </div>
      </div>

      {/* Function cards by group */}
      {visibleGroups.map((group, gi) => (
        <div
          key={group.group}
          className={`animate-fade-up stagger-${Math.min(gi + 1, 5)} rounded-2xl bg-white dark:bg-gray-800 shadow-sm ring-1 ring-gray-200/70 dark:ring-gray-700/70 p-5`}
        >
          <div className="mb-3 flex items-center gap-2.5">
            <span className="text-lg leading-none">{group.icon}</span>
            <h2 className="text-[13px] font-semibold tracking-wide text-gray-500 dark:text-gray-400 uppercase">{group.group}</h2>
          </div>
          <div className="grid grid-cols-3 gap-2 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6">
            {group.items.map((item) => (
              <FunctionCard key={item.path} item={item} onClick={navigate} />
            ))}
          </div>
        </div>
      ))}

    </div>
  )
}
