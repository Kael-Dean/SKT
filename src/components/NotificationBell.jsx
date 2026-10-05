// src/components/NotificationBell.jsx
// Topbar bell + notification panel (api-handoff งวด 2 §3).
// Panel is portaled to <body> with position:fixed from the trigger rect and
// z-index above StickyTableScrollbar — same pattern as SelectDropdown.jsx.
import { useEffect, useLayoutEffect, useRef, useState } from "react"
import { createPortal } from "react-dom"
import { useNavigate } from "react-router-dom"
import useNotifications from "../hooks/useNotifications"
import { inboxLink, relativeTimeTh, fmtDateTimeTh, KIND_LABEL } from "../lib/approvalActions"

const PANEL_Z = 10050
const PANEL_W = 380
const GAP = 8

const ico = {
  "aria-hidden": "true",
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.9,
  strokeLinecap: "round",
  strokeLinejoin: "round",
}

function BellIcon({ className }) {
  return (
    <svg {...ico} strokeWidth={2} className={className}>
      <path d="M6 8a6 6 0 1 1 12 0c0 7 3 9 3 9H3s3-2 3-9" />
      <path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" />
    </svg>
  )
}
function ActionIcon({ className }) {
  return (
    <svg {...ico} className={className}>
      <path d="M9 5H7a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-2" />
      <rect x="9" y="3" width="6" height="4" rx="1" />
      <path d="m9 14 2 2 4-4" />
    </svg>
  )
}
function InfoIcon({ className }) {
  return (
    <svg {...ico} className={className}>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 11v5M12 8h.01" />
    </svg>
  )
}

function NotificationRow({ n, onOpen }) {
  const isAction = n.kind === "action"
  const unread = !n.read_at
  return (
    <li>
      <button
        type="button"
        onClick={() => onOpen(n)}
        className={[
          "group relative flex w-full items-start gap-3 px-4 py-3 text-left transition-colors duration-150",
          "hover:bg-gray-50 focus-visible:bg-gray-50 focus:outline-none dark:hover:bg-gray-700/50 dark:focus-visible:bg-gray-700/50",
          unread ? "bg-indigo-50/50 dark:bg-indigo-500/[0.07]" : "",
        ].join(" ")}
      >
        {isAction && (
          <span aria-hidden="true" className="absolute inset-y-2 left-0 w-[3px] rounded-r bg-amber-500 dark:bg-amber-400" />
        )}
        <span
          className={[
            "mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-full",
            isAction
              ? "bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300"
              : "bg-gray-100 text-gray-500 dark:bg-gray-700 dark:text-gray-300",
          ].join(" ")}
        >
          {isAction ? <ActionIcon className="size-4" /> : <InfoIcon className="size-4" />}
        </span>
        <span className="min-w-0 flex-1">
          <span className="flex items-center gap-2">
            <span
              className={[
                "text-xs font-semibold",
                isAction ? "text-amber-700 dark:text-amber-300" : "text-gray-500 dark:text-gray-400",
              ].join(" ")}
            >
              {isAction ? "ต้องพิจารณา" : "แจ้งให้ทราบ"}
            </span>
            {KIND_LABEL[n.ref_type] && (
              <span className="text-xs text-gray-400 dark:text-gray-500">{KIND_LABEL[n.ref_type]}</span>
            )}
          </span>
          <span
            className={[
              "mt-0.5 block text-sm leading-snug break-words",
              unread ? "font-semibold text-gray-900 dark:text-gray-100" : "text-gray-600 dark:text-gray-300",
            ].join(" ")}
          >
            {n.message}
          </span>
          <span className="mt-1 block text-xs text-gray-400 dark:text-gray-500" title={fmtDateTimeTh(n.created_at)}>
            {relativeTimeTh(n.created_at)}
          </span>
        </span>
        {unread && (
          <span className="mt-2 size-2 shrink-0 rounded-full bg-indigo-500 dark:bg-indigo-400">
            <span className="sr-only">ยังไม่อ่าน</span>
          </span>
        )}
      </button>
    </li>
  )
}

export default function NotificationBell() {
  const navigate = useNavigate()
  const { items, unreadCount, loading, loaded, error, markRead, markAllRead, refresh } = useNotifications()
  const [open, setOpen] = useState(false)
  const [pos, setPos] = useState({ top: 0, right: 0, width: PANEL_W, maxH: 480 })
  const triggerRef = useRef(null)
  const panelRef = useRef(null)

  const reposition = () => {
    const el = triggerRef.current
    if (!el) return
    const r = el.getBoundingClientRect()
    const vw = window.innerWidth
    const width = Math.min(PANEL_W, vw - GAP * 2)
    // right-align to the trigger, but never past the left viewport edge
    let right = Math.max(GAP, vw - r.right)
    if (vw - right - width < GAP) right = vw - width - GAP
    const top = r.bottom + GAP
    setPos({ top, right, width, maxH: Math.max(240, window.innerHeight - top - GAP * 2) })
  }

  useLayoutEffect(() => {
    if (open) reposition()
  }, [open])

  useEffect(() => {
    if (!open) return
    const h = () => reposition()
    window.addEventListener("scroll", h, true)
    window.addEventListener("resize", h)
    return () => {
      window.removeEventListener("scroll", h, true)
      window.removeEventListener("resize", h)
    }
  }, [open])

  // outside click — panel is portaled, check trigger + panel
  useEffect(() => {
    if (!open) return
    const h = (e) => {
      if (triggerRef.current?.contains(e.target)) return
      if (panelRef.current?.contains(e.target)) return
      setOpen(false)
    }
    document.addEventListener("mousedown", h)
    return () => document.removeEventListener("mousedown", h)
  }, [open])

  useEffect(() => {
    if (!open) return
    const h = (e) => {
      if (e.key === "Escape") {
        setOpen(false)
        triggerRef.current?.focus()
      }
    }
    document.addEventListener("keydown", h)
    return () => document.removeEventListener("keydown", h)
  }, [open])

  const toggle = () => {
    if (!open) refresh()
    setOpen(!open)
  }

  const openNotification = (n) => {
    markRead(n.id)
    setOpen(false)
    navigate(inboxLink(n.ref_type, n.ref_id))
  }

  const badge = unreadCount > 99 ? "99+" : String(unreadCount)
  const label = unreadCount > 0 ? `การแจ้งเตือน (ยังไม่อ่าน ${unreadCount} รายการ)` : "การแจ้งเตือน"

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        onClick={toggle}
        aria-label={label}
        title="การแจ้งเตือน"
        aria-haspopup="dialog"
        aria-expanded={open}
        className="relative inline-flex h-9 w-9 cursor-pointer items-center justify-center rounded-xl border border-gray-200/80 bg-white text-gray-600 shadow-sm transition-all duration-150 hover:bg-gray-50 hover:text-gray-900 active:scale-95 focus:outline-none focus:ring-2 focus:ring-indigo-500 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700 dark:hover:text-white"
      >
        <BellIcon className="h-4 w-4" />
        {unreadCount > 0 && (
          <span
            aria-hidden="true"
            className="absolute -right-1.5 -top-1.5 flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold leading-none text-white tabular-nums ring-2 ring-white dark:ring-gray-900"
          >
            {badge}
          </span>
        )}
      </button>

      {open &&
        createPortal(
          <div
            ref={panelRef}
            role="dialog"
            aria-label="การแจ้งเตือน"
            style={{ position: "fixed", top: pos.top, right: pos.right, width: pos.width, zIndex: PANEL_Z }}
            className="flex flex-col overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-xl dark:border-gray-700 dark:bg-gray-800"
          >
            <div className="flex items-center justify-between gap-3 border-b border-gray-100 px-4 py-3 dark:border-gray-700">
              <div>
                <h2 className="text-sm font-bold text-gray-900 dark:text-gray-100">การแจ้งเตือน</h2>
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  {unreadCount > 0 ? `ยังไม่อ่าน ${unreadCount} รายการ` : "อ่านครบทุกรายการแล้ว"}
                </p>
              </div>
              <button
                type="button"
                onClick={markAllRead}
                disabled={unreadCount === 0}
                className="rounded-lg px-2.5 py-1.5 text-xs font-semibold text-indigo-600 transition-colors duration-150 hover:bg-indigo-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 disabled:cursor-not-allowed disabled:text-gray-300 disabled:hover:bg-transparent dark:text-indigo-300 dark:hover:bg-indigo-500/10 dark:disabled:text-gray-600"
              >
                อ่านทั้งหมด
              </button>
            </div>

            <div className="overflow-y-auto overscroll-contain" style={{ maxHeight: pos.maxH - 112 }}>
              {!loaded && loading ? (
                <ul aria-busy="true" className="divide-y divide-gray-100 dark:divide-gray-700/60">
                  {[0, 1, 2].map((i) => (
                    <li key={i} className="flex gap-3 px-4 py-3">
                      <span className="size-8 shrink-0 animate-pulse rounded-full bg-gray-100 motion-reduce:animate-none dark:bg-gray-700" />
                      <span className="flex-1 space-y-2">
                        <span className="block h-3 w-1/3 animate-pulse rounded bg-gray-100 motion-reduce:animate-none dark:bg-gray-700" />
                        <span className="block h-3 w-full animate-pulse rounded bg-gray-100 motion-reduce:animate-none dark:bg-gray-700" />
                      </span>
                    </li>
                  ))}
                </ul>
              ) : error && items.length === 0 ? (
                <div role="alert" className="space-y-3 px-4 py-6 text-center">
                  <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
                  <button
                    type="button"
                    onClick={refresh}
                    className="rounded-xl border border-gray-300 px-3 py-1.5 text-xs font-semibold text-gray-700 transition-colors hover:bg-gray-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 dark:border-gray-600 dark:text-gray-200 dark:hover:bg-gray-700"
                  >
                    ลองอีกครั้ง
                  </button>
                </div>
              ) : items.length === 0 ? (
                <div className="px-4 py-10 text-center">
                  <BellIcon className="mx-auto size-8 text-gray-300 dark:text-gray-600" />
                  <p className="mt-2 text-sm font-medium text-gray-700 dark:text-gray-200">ยังไม่มีการแจ้งเตือน</p>
                  <p className="mt-0.5 text-xs text-gray-500 dark:text-gray-400">
                    คำขอที่รอคุณพิจารณา และผลการพิจารณาคำขอของคุณจะแสดงที่นี่
                  </p>
                </div>
              ) : (
                <ul className="divide-y divide-gray-100 dark:divide-gray-700/60">
                  {items.map((n) => (
                    <NotificationRow key={n.id} n={n} onOpen={openNotification} />
                  ))}
                </ul>
              )}
            </div>

            <div className="border-t border-gray-100 dark:border-gray-700">
              <button
                type="button"
                onClick={() => {
                  setOpen(false)
                  navigate("/inbox")
                }}
                className="w-full px-4 py-2.5 text-center text-xs font-semibold text-gray-600 transition-colors hover:bg-gray-50 hover:text-gray-900 focus:outline-none focus-visible:bg-gray-50 dark:text-gray-300 dark:hover:bg-gray-700/50 dark:hover:text-white"
              >
                ไปที่กล่องงานรออนุมัติ
              </button>
            </div>
          </div>,
          document.body,
        )}
    </>
  )
}
