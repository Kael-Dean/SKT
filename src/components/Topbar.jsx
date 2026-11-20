// src/components/Topbar.jsx
// Sticky app header. Measures its own height into `--topbar-h` (index.css)
// so page-level `sticky top-(--topbar-h)` elements (Stepper, table headers)
// stack under it now that <body> is the scroller.
//
// <md layout:  [back ◀ 44px][☰ 44px][page title …] [branch (compact)][🔔][avatar]
// ≥md layout:  [☰][logo][‹ back][page title]  [find a function]  [branch][🔔][dark][profile*]
//              (*Super Admin: กดโปรไฟล์ = เปลี่ยนบทบาท act-as-role; ตอนสวม role มีแถบเตือนใต้ header)
//              (หน้าหลัก: [☰][logo + org name] — ไม่มี back / title)
// ชื่อหน้า (title) มาจาก <PageTitle> ในหน้า ผ่าน AppLayout — h1 จริงอยู่ในหน้า (sr-only),
// ข้อความที่นี่จึง aria-hidden เพื่อไม่ให้ screen reader อ่านซ้ำ
import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ChevronLeft, Maximize, Menu, Minimize, Moon, Sun, X } from "lucide-react";
import { getUser, getRoleId } from "../lib/auth";
import BranchSwitcher from "./BranchSwitcher";
import GlobalFunctionSearch from "./GlobalFunctionSearch";
import NotificationBell from "./NotificationBell";
import { ActingRoleBanner, RoleSwitcherSheet } from "./RoleSwitcher";
import { myRoleLabel } from "../lib/permissions";
import { useMyPermissionsVersion } from "../lib/myPermissions";
import { isActingAsRole, isRealSuperAdmin } from "../lib/actAsRole";
import { canGoBack } from "../lib/drill";
import { switchTheme } from "../lib/themeTransition"

// Shared chrome for the icon buttons; display + size are set per button so
// `hidden md:inline-flex` on the dark toggle is not out-ranked by `inline-flex`.
const chromeBtnBase =
  "shrink-0 items-center justify-center rounded-xl border border-gray-200/80 bg-white text-gray-600 shadow-sm " +
  "transition-all duration-150 hover:bg-gray-50 hover:text-gray-900 active:scale-95 cursor-pointer " +
  "focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 " +
  "dark:border-line-strong dark:bg-white/[.04] dark:text-gray-300 dark:shadow-none dark:hover:bg-white/[.08] dark:hover:text-white";
const chromeBtnCls = `inline-flex size-11 md:pointer-fine:size-10 ${chromeBtnBase}`;

const Topbar = ({ onToggleSidebar, isSidebarOpen, darkMode, setDarkMode, back = null, title = null }) => {
  const navigate = useNavigate();
  const headerRef = useRef(null);
  const [userInfo, setUserInfo] = useState({ username: "", id: null, roleId: 0 });
  // Super Admin (DB) กดปุ่มโปรไฟล์ → เลือกบทบาทที่จะทดสอบ (act-as-role); คนอื่นปุ่มนี้แสดงข้อมูลอย่างเดียว
  useMyPermissionsVersion();
  const [roleSheetOpen, setRoleSheetOpen] = useState(false);
  const canSwitchRole = isRealSuperAdmin();
  const acting = canSwitchRole && isActingAsRole();

  useEffect(() => {
    const refresh = () => {
      const u = getUser() || {};
      setUserInfo({
        username: u.username || "",
        id: u.id ?? null,
        roleId: getRoleId(), // ✅ แหล่งความจริงเดียว
      });
    };
    refresh();
    const onStorage = (e) => {
      if (e.key === "user" || e.key === "token") refresh();
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  // Publish the real header height as --topbar-h (default 64px in index.css).
  useEffect(() => {
    const el = headerRef.current;
    if (!el) return;
    const root = document.documentElement;
    const publish = () => root.style.setProperty("--topbar-h", `${Math.round(el.getBoundingClientRect().height)}px`);
    publish();
    const ro = new ResizeObserver(publish);
    // border-box: the safe-area padding counts toward the height, and rotating the
    // device can change only that padding (the default content-box would not fire).
    ro.observe(el, { box: "border-box" });
    return () => {
      ro.disconnect();
      root.style.removeProperty("--topbar-h");
    };
  }, []);

  // Fullscreen toggle (desktop). Browsers only allow entering fullscreen from a click,
  // so this can't happen on app launch; Esc / F11 leave it and fullscreenchange keeps the icon in sync.
  const fullscreenSupported = typeof document !== "undefined" && document.fullscreenEnabled === true;
  const [isFullscreen, setIsFullscreen] = useState(() => typeof document !== "undefined" && !!document.fullscreenElement);
  useEffect(() => {
    if (!fullscreenSupported) return;
    const sync = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener("fullscreenchange", sync);
    return () => document.removeEventListener("fullscreenchange", sync);
  }, [fullscreenSupported]);
  const toggleFullscreen = () => {
    const p = document.fullscreenElement
      ? document.exitFullscreen()
      : document.documentElement.requestFullscreen({ navigationUI: "hide" });
    p?.catch?.(() => {});
  };
  const fullscreenLabel = isFullscreen ? "ออกจากโหมดเต็มจอ" : "เต็มจอ";

  const toggleLabel = useMemo(
    () => (darkMode ? "สลับเป็นโหมดสว่าง" : "สลับเป็นโหมดมืด"),
    [darkMode]
  );
  const sidebarBtnLabel = isSidebarOpen ? "ซ่อนเมนู" : "แสดงเมนู";
  const asset = (p) => `${import.meta.env.BASE_URL.replace(/\/+$/, "")}${p}`;

  const displayName = userInfo.username || "ไม่พบผู้ใช้";
  const displayRole = myRoleLabel(); // role_name จาก /auth/me/permissions (DB) — ไม่ใช่ claim ใน JWT ที่อาจเก่า
  const avatarLetter = (displayName[0] || "U").toUpperCase();
  // back.history = มาจาก drill-down → กลับ entry ก่อนหน้า (คืนแท็บย่อย/ตัวกรอง); เปิดลิงก์ตรง → ไปหน้าแม่
  const goBack = () => (back?.history && canGoBack() ? navigate(-1) : navigate(back.to));

  return (
    <header
      ref={headerRef}
      className="wco-titlebar sticky top-0 z-20 border-b border-gray-200/70 bg-white/80 pt-safe pl-safe pr-safe backdrop-blur-md transition-colors duration-300 dark:border-line dark:bg-canvas/80"
    >
      <div className="wco-titlebar-row flex items-center justify-between gap-2 px-3 py-2 md:gap-4 md:px-6 md:py-3 short-touch:py-1">

        {/* Left: back (phone) + hamburger + logo + back/title (desktop) */}
        <div className="flex min-w-0 flex-1 items-center gap-2 md:flex-initial md:gap-4">
          {back && (
            <button
              type="button"
              onClick={goBack}
              aria-label={`ย้อนกลับไป ${back.label}`}
              title={back.label}
              className={`${chromeBtnCls} md:hidden`}
            >
              <ChevronLeft aria-hidden="true" className="size-5" strokeWidth={2} />
            </button>
          )}

          <button
            onClick={onToggleSidebar}
            data-sidebar-toggle
            className={chromeBtnCls}
            aria-label={sidebarBtnLabel}
            title={sidebarBtnLabel}
            type="button"
          >
            {isSidebarOpen ? (
              <X aria-hidden="true" className="size-5" strokeWidth={2} />
            ) : (
              <Menu aria-hidden="true" className="size-5" strokeWidth={2} />
            )}
          </button>

          {/* Phone: page title */}
          {title && (
            <p aria-hidden="true" className="min-w-0 truncate text-[15px] font-semibold text-gray-900 dark:text-gray-100 md:hidden">
              {title}
            </p>
          )}

          <div className="hidden min-w-0 select-none items-center gap-3 md:flex">
            <img
              src={darkMode ? asset("/logo/amc-logo-dark.png") : asset("/logo/amc-logo.png")}
              onError={(e) => {
                const cur = e.currentTarget.src;
                const alt = cur.includes("amc-logo-dark")
                  ? asset("/logo/amc-logo.png")
                  : asset("/logo/amc-logo-dark.png");
                if (cur !== alt) e.currentTarget.src = alt;
              }}
              alt="โลโก้องค์กร"
              title="สหกรณ์การเกษตรเพื่อการตลาดลูกค้า ธ.ก.ส.สุรินทร์ จำกัด"
              className="h-9 w-auto shrink-0 rounded object-contain"
              loading="eager"
              decoding="async"
              fetchPriority="high"
            />
            <div className="h-5 w-px shrink-0 bg-gray-200 dark:bg-gray-700" />
            {title ? (
              <div className="flex min-w-0 items-center gap-2.5">
                {back && (
                  <button
                    type="button"
                    onClick={goBack}
                    aria-label={`ย้อนกลับไป ${back.label}`}
                    className="inline-flex h-8 pointer-coarse:h-11 shrink-0 cursor-pointer items-center gap-1 rounded-lg px-2 text-sm font-medium text-gray-500 transition-colors duration-150 hover:bg-gray-100 hover:text-gray-900 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 dark:text-gray-400 dark:hover:bg-white/[.08] dark:hover:text-white"
                  >
                    <ChevronLeft aria-hidden="true" className="size-4" strokeWidth={2.25} />
                    <span className="max-w-[10rem] truncate">{back.label}</span>
                  </button>
                )}
                <p aria-hidden="true" title={title} className="min-w-0 truncate text-base font-semibold tracking-tight text-gray-900 dark:text-gray-100">
                  {title}
                </p>
              </div>
            ) : (
              <span className="whitespace-nowrap text-sm font-semibold tracking-tight text-gray-700 dark:text-gray-200 lg:text-[15px] short-touch:hidden max-lg:pointer-coarse:hidden">
                สหกรณ์การเกษตรเพื่อการตลาดลูกค้า ธ.ก.ส.สุรินทร์ จำกัด
              </span>
            )}
          </div>
        </div>

        {/* Center: find a function (desktop only) */}
        <div className="hidden min-w-0 flex-1 justify-center px-4 md:flex pointer-coarse:min-w-44 max-lg:pointer-coarse:px-0">
          <GlobalFunctionSearch />
        </div>

        {/* Right: branch switcher + inbox bell + dark mode (desktop) + profile */}
        <div className="flex shrink-0 items-center gap-1.5 md:gap-2">
          {/* Branch switcher — แสดงเฉพาะผู้ใช้ที่เข้าถึงได้หลายสาขา; บีบความกว้างบนมือถือ */}
          <div className="min-w-0 max-w-[7rem] md:max-w-none">
            <BranchSwitcher />
          </div>

          {/* Notification bell — polls /personnel/me/notifications */}
          <NotificationBell />

          <button
            onClick={(e) => switchTheme(setDarkMode, e.currentTarget)}
            aria-label={toggleLabel}
            title={toggleLabel}
            className={`hidden md:inline-flex size-11 md:pointer-fine:size-9 ${chromeBtnBase}`}
            type="button"
          >
            {darkMode ? (
              <Sun aria-hidden="true" className="size-[18px]" strokeWidth={1.75} />
            ) : (
              <Moon aria-hidden="true" className="size-[18px]" strokeWidth={1.75} />
            )}
          </button>

          {fullscreenSupported && (
            <button
              onClick={toggleFullscreen}
              aria-label={fullscreenLabel}
              aria-pressed={isFullscreen}
              title={`${fullscreenLabel} (F11)`}
              className={`hidden md:inline-flex size-11 md:pointer-fine:size-9 ${chromeBtnBase}`}
              type="button"
            >
              {isFullscreen ? (
                <Minimize aria-hidden="true" className="size-[18px]" strokeWidth={1.75} />
              ) : (
                <Maximize aria-hidden="true" className="size-[18px]" strokeWidth={1.75} />
              )}
            </button>
          )}

          <div className="hidden h-5 w-px bg-gray-200 dark:bg-gray-700 md:block" />

          <button
            className="group inline-flex min-h-11 items-center gap-2.5 rounded-xl border border-gray-200/80 bg-white px-2 py-1.5 shadow-sm transition-all duration-150 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-indigo-500 dark:border-line-strong dark:bg-white/[.04] dark:shadow-none dark:hover:bg-white/[.08] md:pointer-fine:min-h-0 md:px-2.5"
            title={canSwitchRole ? "เปลี่ยนบทบาทที่ใช้ทดสอบ" : "โปรไฟล์ฉัน"}
            aria-label={`โปรไฟล์: ${displayName} · ${displayRole}${acting ? " (กำลังทดสอบ)" : ""}${canSwitchRole ? " — เปลี่ยนบทบาท" : ""}`}
            aria-haspopup={canSwitchRole ? "dialog" : undefined}
            onClick={canSwitchRole ? () => setRoleSheetOpen(true) : undefined}
            type="button"
          >
            <div className="relative shrink-0">
              <div className="flex h-7 w-7 items-center justify-center rounded-full bg-indigo-500 text-xs font-bold text-white">
                {avatarLetter}
              </div>
              <span className="status-ping absolute -right-0.5 -top-0.5 block h-2 w-2 rounded-full bg-emerald-500 text-emerald-500 ring-1 ring-white dark:ring-gray-800" />
            </div>
            <div className="hidden text-left md:block max-lg:pointer-coarse:hidden">
              <div className="text-[13px] font-semibold leading-4 text-gray-800 dark:text-gray-100">{displayName}</div>
              <div className={acting ? "text-[11px] font-semibold text-amber-700 dark:text-amber-300" : "text-[11px] text-gray-500 dark:text-gray-400"}>{displayRole}</div>
            </div>
            <svg className="ml-0.5 hidden h-3 w-3 text-gray-400 transition-colors group-hover:text-gray-600 dark:text-gray-500 max-lg:pointer-coarse:hidden md:block" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M5.23 7.21a.75.75 0 011.06.02L10 11.168l3.71-3.938a.75.75 0 111.08 1.04l-4.25 4.5a.75.75 0 01-1.08 0l-4.25-4.5a.75.75 0 01.02-1.06z" clipRule="evenodd" />
            </svg>
          </button>
        </div>
      </div>
      {/* สวม role อยู่ → แถบเตือนติดใต้ header (นับรวมใน --topbar-h) */}
      <ActingRoleBanner />
      {canSwitchRole && <RoleSwitcherSheet open={roleSheetOpen} onClose={() => setRoleSheetOpen(false)} />}
    </header>
  );
};

export default Topbar;
