// src/lib/uiFlags.js
// ─────────────────────────────────────────────────────────────────────────────
// Per-ACCOUNT "already seen" flags for one-time intros, so an intro seen on one device does not
// show again on another device signed in to the same account. Spec: handoff/api-ui-flags.md
//
//   GET  /auth/me/ui-flags          → { flags: { "<key>": "<ISO time seen>", … } }
//   POST /auth/me/ui-flags/{key}    → idempotent, same body back
//
// Until the backend ships it (404/405) the status is "unsupported" and callers fall back to their
// own per-device localStorage key, exactly as before. Same store pattern as myPermissions.js:
// in memory, bound to the token that loaded it, so a logout or account switch starts over.
//
// Status: "idle" | "loading" | "ready" | "unsupported" | "error"
//   ready / unsupported  final answers: callers may decide
//   error                server unreachable: optional intros hold back and retry on the next load
// ─────────────────────────────────────────────────────────────────────────────
import { useSyncExternalStore } from "react"
import { apiAuth } from "./api"
import { getToken } from "./auth"
import { isPreviewActive } from "./previewMode"

const PATH = "/auth/me/ui-flags"
const TIMEOUT_MS = 15_000

/** Keys the backend should accept. Keep in sync with handoff/api-ui-flags.md. */
export const UI_FLAG = {
  SEARCH_INTRO: "search_intro",
}

const IDLE = { token: null, status: "idle", flags: {} }
let state = IDLE
let inflight = null
const pending = new Map() // key → ISO time: marked here, server hasn't confirmed yet
const listeners = new Set()

function setState(next) {
  state = next
  listeners.forEach((fn) => fn())
}

function current() {
  const token = getToken()
  if (!token || state.token !== token) return { ...IDLE, token }
  return state
}

const asFlags = (data) => {
  const f = data?.flags
  return f && typeof f === "object" && !Array.isArray(f) ? f : {}
}

/** Loads the flags once per token (later calls reuse the answer or the request in flight). */
export function loadUiFlags({ force = false } = {}) {
  const token = getToken()
  if (!token) return Promise.resolve(null)
  const s = current()
  if (!force && (s.status === "ready" || s.status === "unsupported")) return Promise.resolve(s.flags)
  if (inflight && inflight.token === token) return inflight.promise

  setState({ token, status: "loading", flags: s.flags })
  const promise = apiAuth(PATH, { timeoutMs: TIMEOUT_MS })
    .then((data) => {
      if (getToken() !== token) return null
      // The server's answer, plus marks whose POST hasn't landed yet.
      const flags = { ...asFlags(data), ...Object.fromEntries(pending) }
      setState({ token, status: "ready", flags })
      return flags
    })
    .catch((err) => {
      if (getToken() !== token) return null
      const unsupported = err?.status === 404 || err?.status === 405
      setState({ token, status: unsupported ? "unsupported" : "error", flags: Object.fromEntries(pending) })
      return null
    })
    .finally(() => {
      if (inflight?.promise === promise) inflight = null
    })
  inflight = { token, promise }
  return promise
}

/** "idle" | "loading" | "ready" | "unsupported" | "error" */
export const getUiFlagsStatus = () => current().status

/** true / false when the server answered; null when it can't say (unsupported, loading, error). */
export function hasUiFlag(key) {
  const s = current()
  if (key in s.flags) return true
  return s.status === "ready" ? false : null
}

/**
 * Records `key` as seen for this account. Updates memory at once, then tells the server;
 * a failed write is not retried here (the caller's localStorage key still holds it on this device).
 */
export function markUiFlag(key) {
  if (isPreviewActive()) return Promise.resolve()
  const token = getToken()
  if (!token) return Promise.resolve()
  const s = current()
  if (s.status === "unsupported") return Promise.resolve()
  const at = new Date().toISOString()
  pending.set(key, at)
  if (!(key in s.flags)) setState({ ...s, token, flags: { ...s.flags, [key]: at } })
  return apiAuth(`${PATH}/${encodeURIComponent(key)}`, { method: "POST", timeoutMs: TIMEOUT_MS })
    .then((data) => {
      pending.delete(key)
      if (getToken() !== token) return
      const now = current()
      setState({ ...now, flags: { ...now.flags, ...asFlags(data) } })
    })
    .catch((err) => {
      pending.delete(key)
      if (getToken() !== token) return
      if (err?.status === 404 || err?.status === 405) setState({ ...current(), status: "unsupported" })
    })
}

function subscribe(fn) {
  listeners.add(fn)
  return () => listeners.delete(fn)
}
const snapshot = () => {
  const s = current()
  return `${s.token}|${s.status}|${Object.keys(s.flags).join(",")}`
}

/** Re-render when the flags load or change. Returns nothing: read with hasUiFlag / getUiFlagsStatus. */
export function useUiFlagsVersion() {
  return useSyncExternalStore(subscribe, snapshot, snapshot)
}
