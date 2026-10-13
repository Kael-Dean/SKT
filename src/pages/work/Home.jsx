// src/pages/Home.jsx
import { useEffect, useMemo, useState } from "react"
import { useNavigate } from "react-router-dom"
import { apiAuth } from "../../lib/api"
import { getUser, getRoleId } from "../../lib/auth"
import { myRoleLabel } from "../../lib/permissions"
import { useMyPermissionsVersion } from "../../lib/myPermissions"
import { ALL_FUNCTIONS, ALL_ITEMS, canAccessItem, lucideFor } from "../../lib/homeFunctions"
import { getRecent } from "../../lib/recentRoutes"
import { cx, focusRingCls } from "../../lib/styles"
import { Skeleton, SkeletonStat } from "../../components/ui"
import { useIsPhone } from "../../hooks/useMediaQuery"

/** Pinned shortcuts, in this order (UI-SPEC §2.1): ซื้อ · ขาย · คลัง · ออเดอร์ */
const PINNED_PATHS = ["/Buy", "/sales", "/stock", "/order"]
const TRADING_GROUP_NAME = "ธุรกิจรวบรวมผลผลิต"

/** Lucide icon in a soft square (same anatomy as PageSection's icon chip) */
function IconChip({ path, className = "" }) {
  const Icon = lucideFor(path)
  return (
    <span
      aria-hidden="true"
      className={cx(
        "flex size-9 shrink-0 items-center justify-center rounded-xl bg-gray-100 text-gray-700 dark:bg-gray-700/60 dark:text-gray-200",
        className,
      )}
    >
      <Icon className="size-5" strokeWidth={1.75} />
    </span>
  )
}

/** Phone-only horizontal strip: pinned functions, then recent ones (no dupes). */
function ShortcutStrip({ roleId, permVersion, onOpen }) {
  const items = useMemo(() => {
    const byPath = (p) => ALL_ITEMS.find((i) => i.path === p)
    const pinned = PINNED_PATHS.map(byPath).filter(Boolean).map((i) => ({ ...i, kind: "pinned" }))
    const recent = getRecent()
      .filter((p) => !PINNED_PATHS.includes(p))
      .map(byPath)
      .filter(Boolean)
      .map((i) => ({ ...i, kind: "recent" }))
    return [...pinned, ...recent].filter((i) => canAccessItem(i, roleId))
    // eslint-disable-next-line react-hooks/exhaustive-deps -- permVersion: คำนวณใหม่เมื่อสิทธิ์จาก backend เปลี่ยน
  }, [roleId, permVersion])

  if (items.length === 0) return null
  const hasBoth = items.some((i) => i.kind === "pinned") && items.some((i) => i.kind === "recent")

  return (
    <nav aria-labelledby="home-shortcuts-title" className="md:hidden">
      <h2 id="home-shortcuts-title" className="mb-2 text-[13px] font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
        ทางลัด
        <span className="sr-only"> ไปฟังก์ชันที่ใช้บ่อย</span>
      </h2>
      <ul className="-mx-4 flex snap-x snap-mandatory scroll-px-4 gap-2 overflow-x-auto px-4 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {items.map((item) => (
          <li key={item.path} className="flex shrink-0 snap-start">
            <button
              type="button"
              onClick={() => onOpen(item.path)}
              aria-label={hasBoth ? `${item.label} (${item.kind === "pinned" ? "ปักหมุด" : "ใช้ล่าสุด"})` : item.label}
              className={cx(
                "flex h-full min-h-touch w-[4.75rem] cursor-pointer flex-col items-center gap-1.5 rounded-2xl bg-white px-1.5 py-2.5 ring-1 ring-gray-200/70 shadow-sm",
                "transition-colors duration-150 active:bg-gray-50 dark:bg-gray-800 dark:ring-gray-700/70 dark:active:bg-gray-700/60",
                focusRingCls,
              )}
            >
              <IconChip path={item.path} />
              <span className="text-center text-xs font-medium leading-snug text-balance text-gray-700 dark:text-gray-200">{item.label}</span>
            </button>
          </li>
        ))}
      </ul>
    </nav>
  )
}

/** Phone tile — trading group: 2 columns, icon left, label left-aligned (14px).
 *  Other groups: 3 columns, icon on top, label 12px. */
function PhoneTile({ item, onClick, wide }) {
  return (
    <button
      type="button"
      onClick={() => onClick(item.path)}
      className={cx(
        "flex min-h-touch w-full cursor-pointer rounded-2xl bg-white ring-1 ring-gray-200/70 shadow-sm",
        "transition-colors duration-150 active:bg-gray-50 dark:bg-gray-800 dark:ring-gray-700/70 dark:active:bg-gray-700/60",
        wide ? "items-center gap-3 p-3 text-left" : "flex-col items-center gap-1.5 px-1.5 py-3 text-center",
        focusRingCls,
      )}
    >
      <IconChip path={item.path} />
      <span
        className={cx(
          "font-medium text-gray-800 dark:text-gray-100",
          wide ? "min-w-0 text-sm leading-relaxed" : "text-xs leading-snug text-balance",
        )}
      >
        {item.label}
      </span>
    </button>
  )
}

// Line-art group icons (currentColor) — replaces decorative emoji headers.
const groupIconPaths = {
  "ธุรกิจรวบรวมผลผลิต":
    "M7 21h10M12 3v4m0 0c-3 0-5 1.5-5 4 0 2 1 3 2.5 4M12 7c3 0 5 1.5 5 4 0 2-1 3-2.5 4",
  "ทะเบียนสมาชิก":
    "M9 7a3 3 0 1 0 0 6 3 3 0 0 0 0-6ZM3 19a6 6 0 0 1 12 0M16 11h5M16 15h5",
  "ออเดอร์ & คลังสินค้า":
    "M3.27 6.96 12 12l8.73-5.04M12 22V12M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16Z",
  "รายงาน & แผน":
    "M3 3v18h18M8 17V9M13 17V5M18 17v-6",
  "งานบุคคล":
    "M17 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2M9.5 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8ZM23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75",
}

function GroupIcon({ group, className }) {
  const d = groupIconPaths[group]
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      <path d={d} />
    </svg>
  )
}

// ALL_FUNCTIONS / canAccessItem ย้ายไป src/lib/homeFunctions.js (ใช้ร่วมกับ Sidebar + recentRoutes)

function FunctionCard({ item, onClick }) {
  return (
    <button
      onClick={() => onClick(item.path)}
      className="group flex min-h-[78px] flex-col items-center justify-center gap-2 rounded-xl bg-gray-50 p-3 ring-1 ring-gray-200/60 transition-all duration-150 hover:bg-indigo-50 hover:shadow-sm hover:ring-indigo-200 hover:scale-[1.03] active:scale-[0.97] focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 dark:bg-gray-800/60 dark:ring-gray-700/60 dark:hover:bg-indigo-900/25 dark:hover:ring-indigo-700/60 cursor-pointer"
    >
      <span className="text-xl leading-none transition-transform duration-150 group-hover:scale-110 group-active:scale-100">{item.icon}</span>
      <span className="text-center text-[11px] font-medium leading-tight text-gray-600 transition-colors duration-150 group-hover:text-indigo-700 dark:text-gray-400 dark:group-hover:text-indigo-300">
        {item.label}
      </span>
    </button>
  )
}

export default function Home() {
  const navigate = useNavigate()
  const isPhone = useIsPhone()
  const [apiUser, setApiUser] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    apiAuth("/personnel/me")
      .then(setApiUser)
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  const localUser = getUser() || {}
  const roleId = getRoleId()
  const permVersion = useMyPermissionsVersion() // การ์ดฟังก์ชันอัปเดตเมื่อสิทธิ์โหลดเสร็จ/เปลี่ยน
  const roleLabel = myRoleLabel()

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
      <div role="status" aria-busy="true" aria-live="polite" className="space-y-5 py-2">
        <span className="sr-only">กำลังโหลด…</span>
        {/* Welcome card skeleton */}
        <div
          aria-hidden="true"
          className="flex items-center gap-4 rounded-2xl bg-white p-6 shadow-sm ring-1 ring-gray-200/70 dark:bg-gray-800 dark:ring-gray-700/70"
        >
          <div className="h-14 w-14 shrink-0 animate-pulse rounded-full bg-slate-200 dark:bg-slate-700" />
          <div className="flex-1 space-y-2.5">
            <div className="h-3.5 w-24 animate-pulse rounded bg-slate-200 dark:bg-slate-700" />
            <div className="h-5 w-44 animate-pulse rounded-md bg-slate-200 dark:bg-slate-700" />
          </div>
        </div>
        {/* Shortcut strip skeleton (phone only) */}
        <div aria-hidden="true" className="flex gap-2 overflow-hidden md:hidden">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-[4.5rem] w-[4.75rem] shrink-0" rounded="rounded-2xl" />
          ))}
        </div>
        {/* Group skeletons */}
        {Array.from({ length: 3 }).map((_, gi) => (
          <SkeletonStat key={gi} />
        ))}
      </div>
    )
  }

  // กรอง group ที่มีอย่างน้อย 1 item ที่ user เข้าถึงได้
  const visibleGroups = ALL_FUNCTIONS
    .map((group) => ({
      ...group,
      items: group.items.filter((item) => canAccessItem(item, roleId)),
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

      {/* ทางลัด — phone only */}
      {isPhone && <ShortcutStrip roleId={roleId} permVersion={permVersion} onOpen={navigate} />}

      {/* Function cards by group */}
      {visibleGroups.map((group, gi) => (
        <div
          key={group.group}
          className={`animate-fade-up stagger-${Math.min(gi + 1, 5)} rounded-2xl bg-white dark:bg-gray-800 shadow-sm ring-1 ring-gray-200/70 dark:ring-gray-700/70 p-4 sm:p-5`}
        >
          <div className="mb-3.5 flex items-center gap-2.5">
            <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-indigo-50 text-indigo-600 dark:bg-indigo-900/30 dark:text-indigo-300">
              <GroupIcon group={group.group} className="h-4 w-4" />
            </span>
            <h2 className="text-[13px] font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">{group.group}</h2>
          </div>
          {isPhone ? (
            <div className={cx("grid gap-2.5", group.group === TRADING_GROUP_NAME ? "grid-cols-2" : "grid-cols-3")}>
              {group.items.map((item) => (
                <PhoneTile key={item.path} item={item} onClick={navigate} wide={group.group === TRADING_GROUP_NAME} />
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-3 gap-2.5 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6">
              {group.items.map((item) => (
                <FunctionCard key={item.path} item={item} onClick={navigate} />
              ))}
            </div>
          )}
        </div>
      ))}

    </div>
  )
}
