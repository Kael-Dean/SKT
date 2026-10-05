// src/hooks/useNotifications.js
// In-app notification inbox (api-handoff งวด 2 §3). No push / LINE — poll.
//   GET  /personnel/me/notifications?limit=50
//   POST /personnel/me/notifications/{id}/read
//   POST /personnel/me/notifications/read-all
// Polls every 60 s while the tab is visible, and refetches on window focus /
// visibilitychange. All calls use redirectOn401:false so a background poll can
// never trigger the session-expired redirect loop; on 401 polling just stops
// until the token changes.
import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { apiAuth } from "../lib/api"
import { getToken } from "../lib/auth"
import { NOTIFICATIONS_REFRESH_EVENT } from "../lib/approvalActions"

const POLL_MS = 60_000
const LIST_PATH = "/personnel/me/notifications?limit=50"
const OPTS = { redirectOn401: false }

export default function useNotifications({ intervalMs = POLL_MS } = {}) {
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(false)
  const [loaded, setLoaded] = useState(false)
  const [error, setError] = useState("")

  const inFlight = useRef(false)
  const unauthorized = useRef(false) // token rejected → stop polling
  const lastToken = useRef(getToken())
  const mounted = useRef(true)

  const refresh = useCallback(async () => {
    const token = getToken()
    if (!token) {
      setItems([])
      return
    }
    if (token !== lastToken.current) {
      lastToken.current = token
      unauthorized.current = false
    }
    if (unauthorized.current || inFlight.current) return
    inFlight.current = true
    setLoading(true)
    try {
      const data = await apiAuth(LIST_PATH, OPTS)
      if (!mounted.current) return
      setItems(Array.isArray(data) ? data : [])
      setError("")
      setLoaded(true)
    } catch (err) {
      if (!mounted.current) return
      if (err?.status === 401) unauthorized.current = true
      setError(err?.message || "โหลดการแจ้งเตือนไม่สำเร็จ")
      setLoaded(true)
    } finally {
      inFlight.current = false
      if (mounted.current) setLoading(false)
    }
  }, [])

  useEffect(() => {
    mounted.current = true
    refresh()

    const tick = () => {
      if (document.visibilityState === "visible") refresh()
    }
    const id = window.setInterval(tick, intervalMs)
    const onVisible = () => {
      if (document.visibilityState === "visible") refresh()
    }
    window.addEventListener("focus", refresh)
    document.addEventListener("visibilitychange", onVisible)
    window.addEventListener(NOTIFICATIONS_REFRESH_EVENT, refresh)
    return () => {
      mounted.current = false
      window.clearInterval(id)
      window.removeEventListener("focus", refresh)
      document.removeEventListener("visibilitychange", onVisible)
      window.removeEventListener(NOTIFICATIONS_REFRESH_EVENT, refresh)
    }
  }, [refresh, intervalMs])

  const unreadCount = useMemo(() => items.filter((n) => !n.read_at).length, [items])

  const markRead = useCallback(
    async (id) => {
      const target = items.find((n) => n.id === id)
      if (!target || target.read_at) return
      const stamp = new Date().toISOString()
      setItems((prev) => prev.map((n) => (n.id === id ? { ...n, read_at: stamp } : n)))
      try {
        await apiAuth(`/personnel/me/notifications/${id}/read`, { method: "POST", ...OPTS })
      } catch {
        refresh() // resync with server truth (e.g. 404)
      }
    },
    [items, refresh],
  )

  const markAllRead = useCallback(async () => {
    const stamp = new Date().toISOString()
    setItems((prev) => prev.map((n) => (n.read_at ? n : { ...n, read_at: stamp })))
    try {
      await apiAuth("/personnel/me/notifications/read-all", { method: "POST", ...OPTS })
    } catch (err) {
      setError(err?.message || "ทำเครื่องหมายว่าอ่านแล้วไม่สำเร็จ")
      refresh()
    }
  }, [refresh])

  return { items, unreadCount, loading, loaded, error, markRead, markAllRead, refresh }
}
