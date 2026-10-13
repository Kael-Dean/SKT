// src/lib/myPermissions.js
// ─────────────────────────────────────────────────────────────────────────────
// สิทธิ์ของผู้ใช้ที่ล็อกอินอยู่ จาก GET /auth/me/permissions (backend PR #13 — RBAC matrix)
//
//   { role_id, role_name, scope: "all" | "own_branch", senior, permissions: string[] }
//
// - เก็บในหน่วยความจำ + localStorage (ผูกกับ token ที่ใช้โหลด) — token เปลี่ยน (login / switch-branch /
//   logout) = ค่าเก่าใช้ไม่ได้ทันที ไม่ต้องสั่งล้างเอง
// - โหลดใหม่เมื่อ: login, เปิดแอป/reload, กลับมาที่แท็บ (focus), และทุกครั้งที่ API ตอบ 403
// - backend ที่ยังไม่มี endpoint นี้ (404) → status "unsupported" แล้ว permissions.js ใช้ตาราง role เดิมแทน
//
// การเช็คสิทธิ์ให้ใช้ can()/useCan()/<Can>/<RequirePermission> จาก permissions.js — ไฟล์นี้แค่ถือข้อมูล
// ─────────────────────────────────────────────────────────────────────────────
import { useSyncExternalStore } from "react"
import { apiAuth, API_FORBIDDEN_EVENT } from "./api"
import { getToken } from "./auth"

export const MY_PERMISSIONS_STORAGE_KEY = "my_permissions"

const FOCUS_REFRESH_MS = 60_000

/** @type {{ token: string|null, status: "idle"|"loading"|"ready"|"unsupported"|"error", data: object|null }} */
let state = readStored()
let version = 0
let inflight = null
let lastLoadedAt = 0
const listeners = new Set()

function readStored() {
  try {
    const raw = localStorage.getItem(MY_PERMISSIONS_STORAGE_KEY)
    const s = raw ? JSON.parse(raw) : null
    if (s && typeof s === "object" && s.token) return { token: s.token, status: s.status, data: s.data ?? null }
  } catch {
    // ค่าเสีย/อ่านไม่ได้ → เริ่มใหม่
  }
  return { token: null, status: "idle", data: null }
}

function setState(next) {
  state = next
  version += 1
  try {
    if (next.token && (next.status === "ready" || next.status === "unsupported")) {
      localStorage.setItem(MY_PERMISSIONS_STORAGE_KEY, JSON.stringify(next))
    } else if (!next.token) {
      localStorage.removeItem(MY_PERMISSIONS_STORAGE_KEY)
    }
  } catch {
    // storage เต็ม/ถูกปิด — ใช้ค่าในหน่วยความจำต่อได้
  }
  listeners.forEach((fn) => fn())
}

function normalize(d) {
  if (!d || typeof d !== "object") return null
  const roleId = Number(d.role_id)
  return {
    role_id: Number.isFinite(roleId) ? roleId : 0,
    role_name: String(d.role_name ?? ""),
    scope: d.scope === "all" ? "all" : "own_branch",
    senior: Boolean(d.senior),
    permissions: Array.isArray(d.permissions) ? d.permissions.map(String) : [],
  }
}

function sameData(a, b) {
  if (!a || !b) return false
  if (a.role_id !== b.role_id || a.scope !== b.scope || a.senior !== b.senior || a.role_name !== b.role_name) return false
  if (a.permissions.length !== b.permissions.length) return false
  const set = new Set(a.permissions)
  return b.permissions.every((p) => set.has(p))
}

/** state ที่ยังใช้ได้กับ token ปัจจุบัน (token ไม่ตรง = ของคนก่อน/ก่อนสลับสาขา → ทิ้ง) */
function current() {
  const token = getToken()
  if (!token || state.token !== token) return { token, status: "idle", data: null }
  return state
}

/** ข้อมูลสิทธิ์ที่โหลดแล้ว (null = ยังไม่ได้โหลด / backend ไม่รองรับ / ไม่ได้ล็อกอิน) */
export function getMyPermissions() {
  const s = current()
  return s.status === "ready" ? s.data : null
}

/** "idle" | "loading" | "ready" | "unsupported" | "error" */
export function getMyPermissionsStatus() {
  return current().status
}

/**
 * โหลดสิทธิ์จาก backend (ซ้ำกันได้ — คำขอที่ค้างอยู่จะถูกใช้ร่วมกัน)
 * @param {{ force?: boolean }} [opts] force = ข้ามแคช (ใช้หลัง 403)
 */
export function loadMyPermissions({ force = false } = {}) {
  const token = getToken()
  if (!token) {
    if (state.token) setState({ token: null, status: "idle", data: null })
    return Promise.resolve(null)
  }
  const s = current()
  if (!force && (s.status === "ready" || s.status === "unsupported") && Date.now() - lastLoadedAt < FOCUS_REFRESH_MS) {
    return Promise.resolve(s.data)
  }
  if (inflight && inflight.token === token) return inflight.promise

  if (s.status !== "ready") setState({ token, status: "loading", data: null })
  const promise = apiAuth("/auth/me/permissions")
    .then((d) => {
      if (getToken() !== token) return null // ผู้ใช้เปลี่ยน token ระหว่างรอ
      const data = normalize(d)
      lastLoadedAt = Date.now()
      // ไม่เปลี่ยน = ไม่แจ้ง listener (กันหน้าเว็บ refetch วนหลัง 403 ที่สิทธิ์ยังเหมือนเดิม)
      const prev = current()
      if (prev.status === "ready" && sameData(prev.data, data)) return prev.data
      setState({ token, status: "ready", data })
      return data
    })
    .catch((err) => {
      if (getToken() !== token) return null
      lastLoadedAt = Date.now()
      if (err?.status === 404 || err?.status === 405) {
        // backend รุ่นก่อน PR #13 — ใช้ตาราง role เดิมใน permissions.js
        setState({ token, status: "unsupported", data: null })
      } else if (state.token === token && state.status === "ready") {
        // โหลดซ้ำไม่สำเร็จ (เน็ตหลุด ฯลฯ) — ใช้ค่าเดิมต่อ
      } else {
        setState({ token, status: "error", data: null })
      }
      return null
    })
    .finally(() => {
      if (inflight?.promise === promise) inflight = null
    })
  inflight = { token, promise }
  return promise
}

export function subscribeMyPermissions(fn) {
  listeners.add(fn)
  return () => listeners.delete(fn)
}

/** เลข version — เปลี่ยนทุกครั้งที่สิทธิ์เปลี่ยน (ใช้เป็น dependency ของ useMemo) */
export function getMyPermissionsVersion() {
  return version
}

/** Hook: re-render เมื่อสิทธิ์ของผู้ใช้โหลดเสร็จ/เปลี่ยน — คืนค่า version */
export function useMyPermissionsVersion() {
  return useSyncExternalStore(subscribeMyPermissions, getMyPermissionsVersion, getMyPermissionsVersion)
}

// ─── รีเฟรชอัตโนมัติ ─────────────────────────────────────────────────────────
if (typeof window !== "undefined") {
  // 403 = สิทธิ์ที่ถืออยู่อาจเก่าแล้ว (HR เปลี่ยนตำแหน่ง) → โหลดใหม่; route guard จะพากลับหน้าหลักเองถ้าหน้านี้ใช้ไม่ได้แล้ว
  let lastForbiddenReload = 0
  window.addEventListener(API_FORBIDDEN_EVENT, () => {
    if (Date.now() - lastForbiddenReload < 3_000) return // 403 หลายตัวพร้อมกัน → โหลดครั้งเดียว
    lastForbiddenReload = Date.now()
    loadMyPermissions({ force: true })
  })
  window.addEventListener("focus", () => {
    if (getToken()) loadMyPermissions()
  })
  // แท็บอื่น login/logout → sync
  window.addEventListener("storage", (e) => {
    if (e.key === MY_PERMISSIONS_STORAGE_KEY || e.key === "token") {
      state = readStored()
      version += 1
      listeners.forEach((fn) => fn())
    }
  })
}
