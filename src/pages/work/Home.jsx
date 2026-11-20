// src/pages/Home.jsx
import { useEffect, useMemo, useState } from "react"
import { Navigate, useNavigate } from "react-router-dom"
import { apiAuth } from "../../lib/api"
import { getUser, getRoleId } from "../../lib/auth"
import { HR_HUB_PERMS, can, canAny, myRoleLabel } from "../../lib/permissions"
import { useMyPermissionsVersion } from "../../lib/myPermissions"
import { ALL_FUNCTIONS, ALL_ITEMS, canAccessItem, iconToneFor, lucideFor } from "../../lib/homeFunctions"
import { getRecent } from "../../lib/recentRoutes"
import { cx, focusRingCls } from "../../lib/styles"
import { Skeleton, SkeletonStat } from "../../components/ui"
import { useIsPhone } from "../../hooks/useMediaQuery"
import { Lock } from "lucide-react"
import { useOnboarding } from "../../lib/onboarding"
import { goToOnboardingFromLocked } from "../../lib/onboardingGate"
import OnboardingBanner from "../../components/onboarding/OnboardingBanner"
import WelcomeArt from "../../components/home/WelcomeArt"
import { SEASON_LABEL, getSeason } from "../../lib/season"

const SELF_SERVICE_GROUP = "งานบุคคล"

/** Pinned shortcuts, in this order (UI-SPEC §2.1): ซื้อ · ขาย · คลัง · ออเดอร์ */
const PINNED_PATHS = ["/Buy", "/sales", "/stock", "/order"]
const TRADING_GROUP_NAME = "ธุรกิจรวบรวมผลผลิต"

/* Function tiles (desktop card, phone tile, shortcut) share one surface: a hairline
   plus a soft layered shadow, Apple-style. The dark semibold label and the icon are
   what identify the control, so the hairline stays quiet on purpose. */
const tileMotionCls =
  "group cursor-pointer transition-[background-color,border-color,box-shadow,transform] duration-200 motion-safe:active:translate-y-px"
const tileSurfaceCls =
  "border border-black/[.08] bg-white shadow-[0_1px_2px_rgb(0_0_0/0.05),0_2px_8px_rgb(0_0_0/0.05)] " +
  "hover:border-indigo-500/40 hover:bg-indigo-50/50 hover:shadow-[0_2px_4px_rgb(0_0_0/0.05),0_8px_20px_rgb(0_0_0/0.08)] " +
  "active:bg-indigo-50 active:shadow-[0_1px_2px_rgb(0_0_0/0.05)] " +
  "dark:border-line-strong dark:bg-raised dark:shadow-none dark:hover:border-indigo-400/60 dark:hover:bg-indigo-500/15 dark:hover:shadow-none dark:active:bg-indigo-500/25 dark:active:shadow-none"
/* Locked = dashed, flat and recessed, so it never reads as colour alone. Only the icon
   is dimmed: opacity on the whole tile took the label to 4.06:1 and faded the chip. */
const tileLockedCls =
  "border border-dashed border-gray-300 bg-gray-50 hover:bg-gray-100 active:bg-gray-200 " +
  "dark:border-line-strong dark:bg-transparent dark:hover:bg-white/[.04] dark:active:bg-white/[.08]"
const tileLabelCls =
  "text-gray-800 transition-colors duration-150 group-hover:text-indigo-700 dark:text-gray-100 dark:group-hover:text-indigo-200"
const tileLabelLockedCls = "text-gray-600 dark:text-gray-400"
const groupHeadingCls = "text-base font-bold leading-relaxed text-gray-900 dark:text-gray-100"

/** Lucide icon in a soft square (same anatomy as PageSection's icon chip) */
function IconChip({ path, className = "" }) {
  const Icon = lucideFor(path)
  return (
    <span
      aria-hidden="true"
      className={cx(
        "flex size-10 shrink-0 items-center justify-center rounded-xl bg-gray-100 text-gray-700 dark:bg-gray-700/60 dark:text-gray-200",
        className,
      )}
    >
      <Icon className="size-6" strokeWidth={1.75} />
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
      <h2 id="home-shortcuts-title" className={cx("mb-2", groupHeadingCls)}>
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
                "flex h-full min-h-touch w-[5.5rem] flex-col items-center justify-center gap-1.5 rounded-xl px-1.5 py-2.5",
                tileMotionCls,
                tileSurfaceCls,
                focusRingCls,
              )}
            >
              <IconChip path={item.path} />
              <span className={cx("w-full text-center text-[13px] font-semibold leading-relaxed text-balance [overflow-wrap:anywhere]", tileLabelCls)}>
                {item.label}
              </span>
            </button>
          </li>
        ))}
      </ul>
    </nav>
  )
}

/** Small lock chip for self-service items that open after onboarding (PR 59).
 *  Sits in the tile's flow rather than over it, so it cannot cover the icon or label. */
function LockChip({ className = "" }) {
  return (
    <span
      className={cx(
        "inline-flex shrink-0 items-center gap-1 rounded-full bg-gray-200/70 px-2 py-0.5 text-xs font-semibold leading-normal text-gray-700 dark:bg-white/[.08] dark:text-gray-300",
        className,
      )}
    >
      <Lock aria-hidden="true" className="size-3" strokeWidth={2.5} />
      ล็อก
    </span>
  )
}

/** Phone tile — trading group: 2 columns, icon left, label left-aligned (14px).
 *  Other groups: 3 columns, icon on top, label 13px. */
function PhoneTile({ item, onClick, wide, locked }) {
  return (
    <button
      type="button"
      onClick={() => onClick(item)}
      aria-disabled={locked || undefined}
      aria-label={locked ? `${item.label} (ล็อกไว้จนกว่าจะกรอกข้อมูลเริ่มต้นครบ)` : undefined}
      className={cx(
        "flex min-h-touch w-full rounded-xl",
        tileMotionCls,
        locked ? tileLockedCls : tileSurfaceCls,
        wide ? "items-center gap-3 p-3 text-left" : "flex-col items-center justify-center gap-1.5 px-1.5 py-3 text-center",
        focusRingCls,
      )}
    >
      <IconChip path={item.path} className={locked ? "opacity-60" : ""} />
      <span
        className={cx(
          "font-semibold [overflow-wrap:anywhere]",
          locked ? tileLabelLockedCls : tileLabelCls,
          wide ? "min-w-0 flex-1 text-sm leading-relaxed" : "w-full text-[13px] leading-relaxed text-balance",
        )}
      >
        {item.label}
      </span>
      {locked && <LockChip />}
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

function FunctionCard({ item, onClick, locked }) {
  const Icon = lucideFor(item.path)
  return (
    <button
      type="button"
      onClick={() => onClick(item)}
      aria-disabled={locked || undefined}
      aria-label={locked ? `${item.label} (ล็อกไว้จนกว่าจะกรอกข้อมูลเริ่มต้นครบ)` : undefined}
      className={cx(
        "flex min-h-[78px] flex-col items-center justify-center gap-2 rounded-xl p-3",
        tileMotionCls,
        locked ? tileLockedCls : tileSurfaceCls,
        focusRingCls,
      )}
    >
      <span
        aria-hidden="true"
        className={cx(
          "flex size-10 shrink-0 items-center justify-center rounded-xl",
          iconToneFor(item.path),
          locked && "opacity-60",
        )}
      >
        <Icon strokeWidth={1.75} className="size-6" />
      </span>
      <span
        className={cx(
          "w-full text-center text-sm font-semibold leading-relaxed text-balance [overflow-wrap:anywhere]",
          locked ? tileLabelLockedCls : tileLabelCls,
        )}
      >
        {item.label}
      </span>
      {locked && <LockChip />}
    </button>
  )
}

export default function Home() {
  const navigate = useNavigate()
  const isPhone = useIsPhone()
  const [apiUser, setApiUser] = useState(null)
  const [loading, setLoading] = useState(true)
  const { locked: onboardingLocked } = useOnboarding()
  // self-service items stay locked until onboarding is done (PR 59) → go fill the data instead
  const openItem = (item) => {
    if (item.gated && onboardingLocked) goToOnboardingFromLocked(navigate, item.label)
    else navigate(item.path)
  }

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
  const season = getSeason(now)
  const dateStr = now.toLocaleDateString("th-TH", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  })

  // ตำแหน่ง HR: หน้าหลัก = แดชบอร์ด HR อย่างเดียว (ไม่แสดงการ์ดซื้อขาย/สมาชิก ฯลฯ)
  if (can("home.hrDashboardOnly") && canAny(HR_HUB_PERMS)) return <Navigate to="/hr/dashboard" replace />

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
            <Skeleton key={i} className="h-[5.75rem] w-[5.5rem] shrink-0" rounded="rounded-xl" />
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
        <WelcomeArt season={season} />
        <div className="relative flex flex-col gap-4 sm:flex-row sm:items-center">
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
            <p className="mt-0.5 text-xs font-medium text-indigo-100/80">{SEASON_LABEL[season]}</p>
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

      {/* First-login onboarding: resume strip (hidden once done) */}
      <OnboardingBanner />

      {/* ทางลัด — phone only */}
      {isPhone && <ShortcutStrip roleId={roleId} permVersion={permVersion} onOpen={navigate} />}

      {/* Function cards by group */}
      {visibleGroups.map((group, gi) => (
        <div
          key={group.group}
          data-tour={group.group === SELF_SERVICE_GROUP ? "self-service" : undefined}
          className={`animate-fade-up stagger-${Math.min(gi + 1, 5)} rounded-2xl bg-white dark:bg-gray-800 shadow-sm ring-1 ring-gray-200/70 dark:ring-gray-700/70 p-4 sm:p-5`}
        >
          <div className="mb-3.5 flex items-center gap-2.5">
            <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-indigo-50 text-indigo-600 dark:bg-indigo-900/30 dark:text-indigo-300">
              <GroupIcon group={group.group} className="h-4 w-4" />
            </span>
            <h2 className={groupHeadingCls}>{group.group}</h2>
          </div>
          {isPhone ? (
            <div className={cx("grid gap-2.5", group.group === TRADING_GROUP_NAME ? "grid-cols-2" : "grid-cols-3")}>
              {group.items.map((item) => (
                <PhoneTile
                  key={item.path}
                  item={item}
                  onClick={openItem}
                  wide={group.group === TRADING_GROUP_NAME}
                  locked={Boolean(item.gated && onboardingLocked)}
                />
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-3 gap-2.5 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6">
              {group.items.map((item) => (
                <FunctionCard key={item.path} item={item} onClick={openItem} locked={Boolean(item.gated && onboardingLocked)} />
              ))}
            </div>
          )}
        </div>
      ))}

    </div>
  )
}
