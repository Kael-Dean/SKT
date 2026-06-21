// src/components/BranchSwitcher.jsx
// สลับสาขาที่กำลังดู (active branch) สำหรับเจ้าหน้าที่ที่เข้าถึงได้หลายสาขา
// flow: GET /auth/my-branches → POST /auth/switch-branch → saveAuth(token ใหม่) → reload
// ถ้าผู้ใช้เข้าถึงได้สาขาเดียว component นี้จะไม่แสดงอะไรเลย
import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { apiAuth } from "../lib/api"
import { saveAuth, getActiveBranch } from "../lib/auth"

export default function BranchSwitcher() {
  const [branches, setBranches] = useState([])
  const [loading, setLoading] = useState(true)
  const [open, setOpen] = useState(false)
  const [switchingId, setSwitchingId] = useState(null)
  const [error, setError] = useState("")
  const ref = useRef(null)

  const activeId = getActiveBranch()

  const loadBranches = useCallback(() => {
    setLoading(true)
    apiAuth("/auth/my-branches")
      .then((data) => setBranches(Array.isArray(data) ? data : []))
      .catch(() => setBranches([]))
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => { loadBranches() }, [loadBranches])

  // ปิดเมื่อคลิกนอกกล่อง
  useEffect(() => {
    if (!open) return
    const onDown = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false) }
    const onKey = (e) => { if (e.key === "Escape") setOpen(false) }
    document.addEventListener("mousedown", onDown)
    document.addEventListener("keydown", onKey)
    return () => {
      document.removeEventListener("mousedown", onDown)
      document.removeEventListener("keydown", onKey)
    }
  }, [open])

  const active = useMemo(
    () => branches.find((b) => Number(b.id) === Number(activeId)) ?? null,
    [branches, activeId]
  )
  const activeName = active?.branch_name ?? "เลือกสาขา"

  const handleSwitch = async (branch) => {
    if (Number(branch.id) === Number(activeId)) { setOpen(false); return }
    setSwitchingId(branch.id)
    setError("")
    try {
      const resp = await apiAuth("/auth/switch-branch", {
        method: "POST",
        body: { branch_id: branch.id },
      })
      // ⚠️ ต้องแทน token เดิมด้วย token ใหม่ที่ branch เปลี่ยนแล้ว
      saveAuth(resp.access_token)
      // โหลดหน้าใหม่ทั้งหมด — ข้อมูลทุกหน้าจะถูก filter ตามสาขาใหม่อัตโนมัติ
      window.location.reload()
    } catch (err) {
      setSwitchingId(null)
      if (err.status === 403) {
        setError("ไม่มีสิทธิ์เข้าถึงสาขานี้")
        loadBranches() // refresh รายการสาขาที่เข้าถึงได้
      } else if (err.status === 404) {
        setError("ไม่พบสาขาที่เลือก")
        loadBranches()
      } else {
        setError(err.message || "สลับสาขาไม่สำเร็จ")
      }
    }
  }

  // ผู้ใช้สาขาเดียว (หรือยังไม่มีข้อมูล) → ซ่อน switcher
  if (loading || branches.length <= 1) return null

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="listbox"
        aria-expanded={open}
        title={`สาขาที่กำลังดู: ${activeName}`}
        className="inline-flex max-w-[11rem] items-center gap-2 rounded-xl border border-gray-200/80 bg-white px-2.5 py-1.5 text-gray-600 shadow-sm transition-all duration-150 hover:bg-gray-50 hover:text-gray-900 active:scale-95 focus:outline-none focus:ring-2 focus:ring-indigo-500 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700 dark:hover:text-white cursor-pointer"
      >
        <svg className="h-4 w-4 shrink-0 text-indigo-500 dark:text-indigo-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
          <path strokeLinecap="round" strokeLinejoin="round" d="M17.657 16.657L13.414 20.9a2 2 0 01-2.828 0l-4.243-4.243a8 8 0 1111.314 0z" />
          <path strokeLinecap="round" strokeLinejoin="round" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
        </svg>
        <span className="hidden truncate text-[13px] font-semibold sm:block">{activeName}</span>
        <svg className={`h-3 w-3 shrink-0 text-gray-400 transition-transform duration-200 ${open ? "rotate-180" : ""}`} fill="currentColor" viewBox="0 0 20 20">
          <path fillRule="evenodd" d="M5.23 7.21a.75.75 0 011.06.02L10 11.168l3.71-3.938a.75.75 0 111.08 1.04l-4.25 4.5a.75.75 0 01-1.08 0l-4.25-4.5a.75.75 0 01.02-1.06z" clipRule="evenodd" />
        </svg>
      </button>

      {open && (
        <div
          role="listbox"
          aria-label="เลือกสาขา"
          className="absolute right-0 z-40 mt-2 w-64 origin-top-right overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-xl ring-1 ring-black/5 dark:border-gray-700 dark:bg-gray-800 dark:ring-white/10"
        >
          <div className="border-b border-gray-100 px-4 py-2.5 dark:border-gray-700/60">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-400 dark:text-gray-500">สลับสาขาที่กำลังดู</p>
          </div>

          {error && (
            <div className="mx-3 mt-2 rounded-lg bg-red-50 px-3 py-2 text-xs text-red-600 dark:bg-red-900/25 dark:text-red-300">
              {error}
            </div>
          )}

          <div className="max-h-72 overflow-auto overscroll-contain p-1.5">
            {branches.map((b) => {
              const isActive = Number(b.id) === Number(activeId)
              const isBusy = switchingId === b.id
              return (
                <button
                  key={b.id}
                  type="button"
                  role="option"
                  aria-selected={isActive}
                  disabled={switchingId != null}
                  onClick={() => handleSwitch(b)}
                  className={[
                    "flex w-full items-center gap-2.5 rounded-xl px-3 py-2.5 text-left text-sm transition-colors disabled:cursor-not-allowed",
                    isActive
                      ? "bg-indigo-50 font-semibold text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-300"
                      : "text-gray-700 hover:bg-gray-50 dark:text-gray-200 dark:hover:bg-gray-700/60",
                  ].join(" ")}
                >
                  <span className="flex-1 min-w-0">
                    <span className="block truncate">{b.branch_name}</span>
                    {b.is_home && (
                      <span className="mt-0.5 inline-flex items-center gap-1 text-[11px] font-medium text-gray-400 dark:text-gray-500">
                        <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
                        </svg>
                        สาขาหลัก
                      </span>
                    )}
                  </span>
                  {isBusy ? (
                    <span className="h-4 w-4 shrink-0 animate-spin rounded-full border-2 border-indigo-400/40 border-t-indigo-500" />
                  ) : isActive ? (
                    <svg className="h-4 w-4 shrink-0 text-indigo-600 dark:text-indigo-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                    </svg>
                  ) : null}
                </button>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
