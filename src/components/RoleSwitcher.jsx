// src/components/RoleSwitcher.jsx
// Super Admin "act as role" — Sheet เลือก role (เปิดจากปุ่มโปรไฟล์ใน Topbar) + แถบเตือนตอนกำลังสวม role อยู่
// แสดงเฉพาะบัญชีที่เป็น Super Admin ใน DB (real_role_id === 1). logic อยู่ที่ src/lib/actAsRole.js
import { useEffect, useMemo, useState } from "react"
import { Check, FlaskConical, Undo2 } from "lucide-react"
import Sheet from "./ui/Sheet"
import { useMyPermissionsVersion, getMyPermissions } from "../lib/myPermissions"
import { actAsRole, actAsRoleErrorMessage, isActingAsRole, isRealSuperAdmin, listActAsRoles } from "../lib/actAsRole"
import { myRoleLabel } from "../lib/permissions"
import { SUPER_ADMIN } from "../lib/roles"
import { baseField, cx } from "../lib/styles"
import { toast } from "./ui/toast"

const SCOPE_LABEL = { all: "ทุกสาขา", own_branch: "เฉพาะสาขาของตน" }

/** เปิดจากปุ่มโปรไฟล์ใน Topbar (เฉพาะ isRealSuperAdmin()) */
export function RoleSwitcherSheet({ open, onClose }) {
  const [roles, setRoles] = useState([])
  const [status, setStatus] = useState("idle") // idle | loading | ready | error
  const [error, setError] = useState("")
  const [query, setQuery] = useState("")
  const [switchingId, setSwitchingId] = useState(null)

  useEffect(() => {
    if (!open) return
    let alive = true
    setQuery("")
    setError("")
    setStatus("loading")
    listActAsRoles()
      .then((list) => { if (alive) { setRoles(list); setStatus("ready") } })
      .catch((err) => { if (alive) { setError(actAsRoleErrorMessage(err, "โหลดรายการบทบาทไม่สำเร็จ")); setStatus("error") } })
    return () => { alive = false }
  }, [open])

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return roles
    return roles.filter((r) => String(r.role_name ?? "").toLowerCase().includes(q) || String(r.role_id).includes(q))
  }, [roles, query])

  const pick = async (role) => {
    if (role.current) { onClose(); return }
    setSwitchingId(role.role_id)
    setError("")
    try {
      await actAsRole(role.role_id) // สำเร็จ = โหลดหน้าใหม่ที่ /home
    } catch (err) {
      setSwitchingId(null)
      setError(actAsRoleErrorMessage(err, "สลับบทบาทไม่สำเร็จ"))
    }
  }

  const busy = switchingId != null

  return (
    <Sheet
      open={open}
      onClose={onClose}
      busy={busy}
      size="md"
      title="ทดสอบในบทบาทอื่น"
      subtitle="เมนูและสิทธิ์จะเป็นของบทบาทที่เลือก สาขาที่ใช้งานอยู่คงเดิม — สิ่งที่บันทึก/อนุมัติระหว่างนี้เป็นข้อมูลจริง"
    >
      <div className="flex flex-col gap-3">
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="ค้นหาบทบาท หรือเลข role"
          aria-label="ค้นหาบทบาท"
          disabled={status !== "ready"}
          className={cx(baseField, "!rounded-xl !px-3 !py-2.5 md:!text-sm")}
        />

        {error && (
          <p role="alert" className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-500/10 dark:text-red-300">
            {error}
          </p>
        )}

        {status === "loading" && (
          <ul aria-hidden="true" className="flex flex-col gap-1.5">
            {Array.from({ length: 6 }, (_, i) => (
              <li key={i} className="h-12 animate-pulse rounded-xl bg-gray-100 dark:bg-white/[.04]" />
            ))}
          </ul>
        )}

        {status === "ready" && filtered.length === 0 && (
          <p className="px-1 py-6 text-center text-sm text-gray-500 dark:text-gray-400">ไม่พบบทบาทที่ตรงกับ “{query}”</p>
        )}

        {status === "ready" && filtered.length > 0 && (
          <ul aria-label="บทบาท" className="-mx-1 flex flex-col gap-0.5">
            {filtered.map((r) => {
              const isSuper = Number(r.role_id) === SUPER_ADMIN
              const isBusy = switchingId === r.role_id
              return (
                <li key={r.role_id}>
                  <button
                    type="button"
                    onClick={() => pick(r)}
                    disabled={busy}
                    aria-current={r.current ? "true" : undefined}
                    className={cx(
                      "flex min-h-12 w-full items-center gap-3 rounded-xl px-3 py-2 text-left transition-colors duration-150 cursor-pointer disabled:cursor-not-allowed",
                      "focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500",
                      r.current
                        ? "bg-indigo-50 text-indigo-800 dark:bg-indigo-500/15 dark:text-indigo-200"
                        : "text-gray-800 hover:bg-gray-50 dark:text-gray-100 dark:hover:bg-white/[.06]",
                      isSuper && !r.current && "mb-1",
                    )}
                  >
                    <span className="w-9 shrink-0 font-mono text-xs tabular-nums text-gray-400 dark:text-gray-500">{r.role_id}</span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-semibold">{r.role_name}</span>
                      <span className="block text-xs text-gray-500 dark:text-gray-400">
                        {isSuper ? "บัญชีจริง · สิทธิ์ทั้งหมด" : SCOPE_LABEL[r.scope] ?? r.scope}
                      </span>
                    </span>
                    {isBusy ? (
                      <span className="size-4 shrink-0 animate-spin rounded-full border-2 border-indigo-400/40 border-t-indigo-500" />
                    ) : r.current ? (
                      <Check aria-hidden="true" className="size-4 shrink-0 text-indigo-600 dark:text-indigo-300" strokeWidth={2.5} />
                    ) : null}
                  </button>
                </li>
              )
            })}
          </ul>
        )}
      </div>
    </Sheet>
  )
}

/** แถบเตือนใต้ Topbar ตอนกำลังสวม role — ติดตลอดจนกว่าจะกด "กลับเป็น Super Admin" */
export function ActingRoleBanner() {
  useMyPermissionsVersion()
  const [leaving, setLeaving] = useState(false)
  if (!isRealSuperAdmin() || !isActingAsRole()) return null
  const roleName = getMyPermissions()?.role_name || myRoleLabel()

  const stop = async () => {
    setLeaving(true)
    try {
      await actAsRole(null)
    } catch (err) {
      setLeaving(false)
      toast.error(actAsRoleErrorMessage(err, "กลับเป็น Super Admin ไม่สำเร็จ"))
    }
  }

  return (
    <div
      role="status"
      className="flex items-center gap-3 border-t border-amber-200 bg-amber-50 px-3 py-1.5 text-amber-900 md:px-6 dark:border-amber-400/20 dark:bg-amber-400/10 dark:text-amber-200"
    >
      <FlaskConical aria-hidden="true" className="hidden size-4 shrink-0 sm:block" strokeWidth={2} />
      <p className="min-w-0 flex-1 text-[13px] leading-snug">
        <span className="font-semibold">กำลังทดสอบในบทบาท: {roleName}</span>
        <span className="hidden text-amber-800/80 dark:text-amber-200/70 md:inline"> · สิ่งที่บันทึกระหว่างนี้เป็นข้อมูลจริง</span>
      </p>
      <button
        type="button"
        onClick={stop}
        disabled={leaving}
        className="inline-flex min-h-11 shrink-0 cursor-pointer items-center gap-1.5 rounded-lg px-2.5 text-[13px] font-semibold text-amber-900 transition-colors duration-150 hover:bg-amber-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-500 disabled:cursor-not-allowed disabled:opacity-60 md:min-h-8 dark:text-amber-100 dark:hover:bg-amber-400/15"
      >
        {leaving ? (
          <span className="size-3.5 animate-spin rounded-full border-2 border-amber-500/40 border-t-amber-600" />
        ) : (
          <Undo2 aria-hidden="true" className="size-3.5" strokeWidth={2.25} />
        )}
        กลับเป็น Super Admin
      </button>
    </div>
  )
}
