// src/lib/recentRoutes.js
// ─────────────────────────────────────────────────────────────────────────────
// "ทางลัด" memory for the Home shortcut strip (plan §A8): the last trading
// routes the user opened, newest first, max 6, in localStorage.
//
//   recordVisit(pathname)   AppLayout calls this on every route change; only
//                           paths in TRADING_PATHS (lib/homeFunctions) are kept
//   getRecent()             → ["/Buy", "/order", …]  (still-valid paths only)
//   clearRecent()
// ─────────────────────────────────────────────────────────────────────────────
import { TRADING_PATHS } from "./homeFunctions"

export const RECENT_KEY = "skt.recentRoutes"
export const RECENT_MAX = 6

function read() {
  try {
    const raw = localStorage.getItem(RECENT_KEY)
    const list = raw ? JSON.parse(raw) : []
    return Array.isArray(list) ? list.filter((p) => typeof p === "string") : []
  } catch {
    return []
  }
}

function write(list) {
  try {
    localStorage.setItem(RECENT_KEY, JSON.stringify(list))
  } catch {
    /* storage full / private mode — shortcuts are a nicety, never an error */
  }
}

export function recordVisit(path) {
  if (!path || !TRADING_PATHS.has(path)) return
  const list = read().filter((p) => p !== path)
  list.unshift(path)
  write(list.slice(0, RECENT_MAX))
}

export function getRecent() {
  return read().filter((p) => TRADING_PATHS.has(p)).slice(0, RECENT_MAX)
}

export function clearRecent() {
  write([])
}
