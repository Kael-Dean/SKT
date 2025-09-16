// src/components/Topbar.jsx
import { useEffect, useMemo, useState } from "react"

function safeDecodeJwt(token) {
  try {
    const base64Url = token.split(".")[1]
    if (!base64Url) return null
    const base64 = base64Url.replace(/-/g, "+").replace(/_/g, "/")
    const json = decodeURIComponent(
      atob(base64)
        .split("")
        .map((c) => "%" + ("00" + c.charCodeAt(0).toString(16)).slice(-2))
        .join("")
    )
    return JSON.parse(json)
  } catch {
    return null
  }
}

const Topbar = ({ onToggleSidebar, isSidebarOpen, darkMode, setDarkMode }) => {
  const [userInfo, setUserInfo] = useState({ username: "", id: null, role: null })

  useEffect(() => {
    const readToken = () => {
      const token = localStorage.getItem("token")
      const payload = token ? safeDecodeJwt(token) : null
      setUserInfo({
        username: payload?.sub || "",
        id: payload?.id ?? null,
        role: payload?.role ?? null,
      })
    }
    readToken()
    const onStorage = (e) => e.key === "token" && readToken()
    window.addEventListener("storage", onStorage)
    return () => window.removeEventListener("storage", onStorage)
  }, [])

  const toggleLabel = useMemo(
    () => (darkMode ? "สลับเป็นโหมดสว่าง" : "สลับเป็นโหมดมืด"),
    [darkMode]
  )
  const sidebarBtnLabel = isSidebarOpen ? "ซ่อนเมนู" : "แสดงเมนู"
  const sidebarBtnIcon = isSidebarOpen ? "⟨" : "☰"
  const asset = (p) => `${import.meta.env.BASE_URL.replace(/\/+$/, "")}${p}`

  const displayName = userInfo.username || "ไม่พบผู้ใช้"
  const displayRole =
    userInfo.role === "1" ? "Admin" :
    userInfo.role === "2" ? "Manager" :
    userInfo.role ? `Role ${userInfo.role}` : "—"
  const avatarLetter = (displayName[0] || "U").toUpperCase()

  return (
    <header className="sticky top-0 z-20 border-b border-gray-200/70 bg-white/80 backdrop-blur-md transition-colors duration-300 dark:border-gray-800 dark:bg-gray-900/70">
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-3 px-4 py-3 md:px-6">
        {/* Left */}
        <div className="flex items-center gap-3">
          <button
            onClick={onToggleSidebar}
            className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-gray-200 bg-white text-gray-700 shadow-sm transition active:scale-95 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-indigo-500 dark:border-gray-800 dark:bg-gray-800 dark:text-gray-100 dark:hover:bg-gray-700"
            aria-label={sidebarBtnLabel}
            title={sidebarBtnLabel}
            type="button"
          >
            {sidebarBtnIcon}
          </button>

          <div className="hidden select-none items-center gap-2 md:flex">
            <img
              src={darkMode ? asset("/logo/skt-logo-dark.png") : asset("/logo/skt-logo.png")}
              onError={(e) => {
                const cur = e.currentTarget.src
                const alt = cur.includes("skt-logo-dark")
                  ? asset("/logo/skt-logo.png")
                  : asset("/logo/skt-logo-dark.png")
                if (cur !== alt) e.currentTarget.src = alt
              }}
              alt="โลโก้องค์กร"
              className="h-10 w-auto rounded object-contain transition-opacity duration-200"
              loading="eager"
              decoding="async"
              fetchpriority="high"
            />
            {/* ชื่อองค์กรยาวขึ้น + ไม่ตัดบรรทัด */}
            <span className="whitespace-nowrap text-[15px] font-bold tracking-tight md:text-lg">
              สหกรณ์การเกษตรเพื่อการตลาดลูกค้า ธ.ก.ส.สุรินทร์
            </span>
          </div>
        </div>

        {/* Center search: ทำให้สั้นลงแบบ responsive */}
        <div className="flex min-w-0 flex-1 justify-center px-2">
          <div className="relative w-full max-w-[22rem] md:max-w-[26rem] lg:max-w-[30rem]">
            <input
              type="text"
              placeholder="ค้นหา ( / )"
              className="w-full rounded-2xl border border-gray-200 bg-white px-4 py-2.5 pr-10 text-sm shadow-sm outline-none ring-0 transition placeholder:text-gray-400 focus:border-indigo-400 focus:ring-2 focus:ring-indigo-200 dark:border-gray-800 dark:bg-gray-800 dark:placeholder:text-gray-500 dark:focus:border-indigo-500 dark:focus:ring-indigo-500/20"
              onKeyDown={(e) => e.key === "Escape" && e.currentTarget.blur()}
              aria-label="ค้นหา"
            />
            <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 dark:text-gray-500">
              🔍
            </span>
          </div>
        </div>

        {/* Right: theme + profile */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => setDarkMode((v) => !v)}
            aria-label={toggleLabel}
            title={toggleLabel}
            className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-gray-200 bg-white text-xl shadow-sm transition active:scale-95 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-indigo-500 dark:border-gray-800 dark:bg-gray-800"
            type="button"
          >
            {darkMode ? "☀️" : "🌙"}
          </button>

          <div className="mx-1 hidden h-6 w-px bg-gray-200 dark:bg-gray-800 md:block" />

          <button
            className="group inline-flex items-center gap-3 rounded-2xl border border-gray-200 bg-white px-3 py-2 shadow-sm transition hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-indigo-500 dark:border-gray-800 dark:bg-gray-800 dark:hover:bg-gray-700"
            title="โปรไฟล์ฉัน"
            type="button"
          >
            <div className="relative">
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-indigo-500 text-white">
                {avatarLetter}
              </div>
              <span className="absolute -right-0.5 -top-0.5 block h-2.5 w-2.5 rounded-full bg-emerald-500 ring-2 ring-white dark:ring-gray-900" />
            </div>
            <div className="hidden text-left md:block">
              <div className="text-sm font-semibold leading-4">
                {displayName}
              </div>
              <div className="text-xs text-gray-500 dark:text-gray-400">{displayRole}</div>
            </div>
            <span className="ml-1 hidden text-gray-400 group-hover:text-gray-600 dark:text-gray-500 md:block">
              ▼
            </span>
          </button>
        </div>
      </div>
    </header>
  )
}

export default Topbar
