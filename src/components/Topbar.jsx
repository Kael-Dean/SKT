// src/components/Topbar.jsx
import { useEffect, useMemo, useState } from "react";
import { getUser, getRoleId } from "../lib/auth";

const ROLE_TITLE = {
  1: "admin",
  2: "manager",
  3: "Human Resources",
  4: "Head Accounting",
  5: "Marketing",
};

const Topbar = ({ onToggleSidebar, isSidebarOpen, darkMode, setDarkMode }) => {
  const [userInfo, setUserInfo] = useState({ username: "", id: null, roleId: 0 });

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

  const toggleLabel = useMemo(
    () => (darkMode ? "สลับเป็นโหมดสว่าง" : "สลับเป็นโหมดมืด"),
    [darkMode]
  );
  const sidebarBtnLabel = isSidebarOpen ? "ซ่อนเมนู" : "แสดงเมนู";
  const asset = (p) => `${import.meta.env.BASE_URL.replace(/\/+$/, "")}${p}`;

  const displayName = userInfo.username || "ไม่พบผู้ใช้";
  const displayRole =
    ROLE_TITLE[userInfo.roleId] ??
    (userInfo.roleId ? `Role ${userInfo.roleId}` : "—");
  const avatarLetter = (displayName[0] || "U").toUpperCase();

  return (
    <header className="sticky top-0 z-20 border-b border-gray-200/70 bg-white/80 backdrop-blur-md transition-colors duration-300 dark:border-gray-800 dark:bg-gray-900/70">
      <div className="flex items-center justify-between gap-4 px-4 py-3 md:px-6">

        {/* Left: hamburger + logo */}
        <div className="flex items-center gap-4">
          <button
            onClick={onToggleSidebar}
            className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-gray-200/80 bg-white text-gray-600 shadow-sm transition-all duration-150 hover:bg-gray-50 hover:text-gray-900 active:scale-95 focus:outline-none focus:ring-2 focus:ring-indigo-500 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700 dark:hover:text-white"
            aria-label={sidebarBtnLabel}
            title={sidebarBtnLabel}
            type="button"
          >
            {isSidebarOpen ? (
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
              </svg>
            ) : (
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            )}
          </button>

          <div className="hidden select-none items-center gap-3 md:flex">
            <img
              src={darkMode ? asset("/logo/skt-logo-dark.png") : asset("/logo/skt-logo.png")}
              onError={(e) => {
                const cur = e.currentTarget.src;
                const alt = cur.includes("skt-logo-dark")
                  ? asset("/logo/skt-logo.png")
                  : asset("/logo/skt-logo-dark.png");
                if (cur !== alt) e.currentTarget.src = alt;
              }}
              alt="โลโก้องค์กร"
              className="h-9 w-auto rounded object-contain"
              loading="eager"
              decoding="async"
              fetchpriority="high"
            />
            <div className="h-5 w-px bg-gray-200 dark:bg-gray-700" />
            <span className="whitespace-nowrap text-sm font-semibold tracking-tight text-gray-700 dark:text-gray-200 lg:text-[15px]">
              สหกรณ์การเกษตรเพื่อการตลาดลูกค้า ธ.ก.ส.สุรินทร์ จำกัด
            </span>
          </div>
        </div>

        {/* Center: search */}
        <div className="flex min-w-0 flex-1 justify-center px-4">
          <div className="relative w-full max-w-xs md:max-w-sm lg:max-w-md">
            <input
              type="text"
              placeholder="ค้นหา"
              className="w-full rounded-xl border border-gray-200 bg-gray-50 py-2 pl-9 pr-4 text-sm outline-none transition-all duration-150 placeholder:text-gray-400 focus:border-indigo-400 focus:bg-white focus:ring-2 focus:ring-indigo-500/20 dark:border-gray-700 dark:bg-gray-800 dark:placeholder:text-gray-500 dark:focus:border-indigo-500 dark:focus:bg-gray-750 dark:focus:ring-indigo-500/20"
              onKeyDown={(e) => e.key === "Escape" && e.currentTarget.blur()}
              aria-label="ค้นหา"
            />
            <svg className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400 dark:text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
              <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-4.35-4.35M17 11A6 6 0 1 1 5 11a6 6 0 0 1 12 0z" />
            </svg>
          </div>
        </div>

        {/* Right: dark mode + profile */}
        <div className="flex shrink-0 items-center gap-2">
          <button
            onClick={() => setDarkMode((v) => !v)}
            aria-label={toggleLabel}
            title={toggleLabel}
            className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-gray-200/80 bg-white text-lg shadow-sm transition-all duration-150 hover:bg-gray-50 active:scale-95 focus:outline-none focus:ring-2 focus:ring-indigo-500 dark:border-gray-700 dark:bg-gray-800"
            type="button"
          >
            {darkMode ? "☀️" : "🌙"}
          </button>

          <div className="hidden h-5 w-px bg-gray-200 dark:bg-gray-700 md:block" />

          <button
            className="group inline-flex items-center gap-2.5 rounded-xl border border-gray-200/80 bg-white px-2.5 py-1.5 shadow-sm transition-all duration-150 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-indigo-500 dark:border-gray-700 dark:bg-gray-800 dark:hover:bg-gray-700"
            title="โปรไฟล์ฉัน"
            type="button"
          >
            <div className="relative shrink-0">
              <div className="flex h-7 w-7 items-center justify-center rounded-full bg-indigo-500 text-xs font-bold text-white">
                {avatarLetter}
              </div>
              <span className="status-ping absolute -right-0.5 -top-0.5 block h-2 w-2 rounded-full bg-emerald-500 text-emerald-500 ring-1 ring-white dark:ring-gray-800" />
            </div>
            <div className="hidden text-left md:block">
              <div className="text-[13px] font-semibold leading-4 text-gray-800 dark:text-gray-100">{displayName}</div>
              <div className="text-[11px] text-gray-400 dark:text-gray-500">{displayRole}</div>
            </div>
            <svg className="ml-0.5 hidden h-3 w-3 text-gray-400 transition-colors group-hover:text-gray-600 dark:text-gray-500 md:block" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M5.23 7.21a.75.75 0 011.06.02L10 11.168l3.71-3.938a.75.75 0 111.08 1.04l-4.25 4.5a.75.75 0 01-1.08 0l-4.25-4.5a.75.75 0 01.02-1.06z" clipRule="evenodd" />
            </svg>
          </button>
        </div>
      </div>
    </header>
  );
};

export default Topbar;
