// src/lib/pendingCounts.js
// ─────────────────────────────────────────────────────────────────────────────
// ตัวนับ "งานที่รอฉัน" กลางของทั้งแอป — ป้ายตัวเลขบนเมนู (Sidebar: กล่องงานรออนุมัติ,
// ปุ่มเมนูใน Topbar, เมนูข้างของหน้า HR) ใช้แหล่งเดียวกัน
//
// backend ส่งตัวนับมาให้แค่ 3 ตัวใน GET /hr/dashboard (ลา / ย้ายสาขา / รายงานปัญหา) ที่เหลือ
// นับจากรายการจริงของแต่ละคิว (เรียกเฉพาะคิวที่ผู้ใช้มีสิทธิ์):
//   inboxLeave       GET /hr/leave-requests?mine=true      แถวที่ฉันอนุมัติ/ตรวจได้ตอนนี้
//   inboxOoo         GET /hr/out-of-office?mine=true
//   certSupervisor   GET /hr/salary-cert-requests/supervisor-queue   (ทุกคน; ไม่ใช่หัวหน้า → [])
//   salaryCert       GET /hr/salary-cert-requests?status=pending     hr.salaryCert.list
//   loans            GET /hr/loans/queue                             hr.loans.queue
//   ooo              GET /hr/out-of-office?status=pending            hr.ooo.list
//   welfare          GET /hr/welfare/claims  → status=submitted      hr.welfare.view
//   discipline       GET /hr/discipline/cases?status=open            hr.discipline.cases
//
// store ระดับ module: ทุก component ที่เรียก usePendingCounts() ใช้ผลชุดเดียว (ไม่ยิงซ้ำ)
// โหลดใหม่ทุก 60 วิ ขณะแท็บเปิดอยู่ · เมื่อกลับมาที่แท็บ · และเมื่อมีการอนุมัติ/ตัดสิน
// (requestNotificationsRefresh() → NOTIFICATIONS_REFRESH_EVENT)
// คิวไหนโหลดไม่ได้ = ไม่แสดงตัวเลข (ไม่ใช่ 0) — ไม่ให้ป้ายหลอก
// ─────────────────────────────────────────────────────────────────────────────
import { useEffect, useSyncExternalStore } from "react"
import { apiAuth } from "./api"
import { getToken } from "./auth"
import { can } from "./permissions"
import { KIND, NOTIFICATIONS_REFRESH_EVENT, canCheck, canDecide } from "./approvalActions"

const POLL_MS = 60_000
const OPTS = { redirectOn401: false }

const list = (d) => (Array.isArray(d) ? d : d?.items ?? d?.results ?? d?.loans ?? [])

/** แต่ละตัวนับ: ต้องมีสิทธิ์อะไร + นับยังไง */
const SOURCES = {
  inboxLeave: {
    allowed: () => true,
    count: async () => list(await apiAuth("/hr/leave-requests?mine=true", OPTS))
      .filter((r) => canDecide(r, KIND.LEAVE) || canCheck(r)).length,
  },
  inboxOoo: {
    allowed: () => true,
    count: async () => list(await apiAuth("/hr/out-of-office?mine=true", OPTS))
      .filter((r) => canDecide(r, KIND.OOO) || canCheck(r)).length,
  },
  certSupervisor: {
    allowed: () => true,
    count: async () => list(await apiAuth("/hr/salary-cert-requests/supervisor-queue", OPTS)).length,
  },
  salaryCert: {
    allowed: () => can("hr.salaryCert.list"),
    count: async () => list(await apiAuth("/hr/salary-cert-requests?status=pending", OPTS)).length,
  },
  loans: {
    allowed: () => can("hr.loans.queue"),
    count: async () => list(await apiAuth("/hr/loans/queue", OPTS)).length,
  },
  ooo: {
    allowed: () => can("hr.ooo.list"),
    count: async () => list(await apiAuth("/hr/out-of-office?status=pending", OPTS)).length,
  },
  welfare: {
    allowed: () => can("hr.welfare.view"),
    count: async () => list(await apiAuth("/hr/welfare/claims", OPTS)).filter((c) => c.status === "submitted").length,
  },
  discipline: {
    allowed: () => can("hr.discipline.cases"),
    count: async () => list(await apiAuth("/hr/discipline/cases?status=open", OPTS)).length,
  },
}

// ─── store ───────────────────────────────────────────────────────────────────
let state = Object.freeze({})
let lastToken = null
let inFlight = null
let lastLoadAt = 0
const listeners = new Set()
const emit = () => listeners.forEach((l) => l())

async function load() {
  const token = getToken()
  if (!token) { state = Object.freeze({}); emit(); return }
  if (inFlight) return inFlight
  inFlight = (async () => {
    const entries = await Promise.all(
      Object.entries(SOURCES).map(async ([key, s]) => {
        if (!s.allowed()) return [key, undefined]
        try { return [key, await s.count()] } catch { return [key, undefined] }
      }),
    )
    // ผู้ใช้เปลี่ยนระหว่างรอ → ทิ้งผล
    if (getToken() !== token) return
    lastToken = token
    lastLoadAt = Date.now()
    state = Object.freeze(Object.fromEntries(entries))
    emit()
  })().finally(() => { inFlight = null })
  return inFlight
}

/** สั่งโหลดตัวนับใหม่ทันที (เช่น หลังอนุมัติ/ตัดสินคำขอ) */
export function refreshPendingCounts() {
  return load()
}

let timer = null
let wired = false
function start() {
  if (wired) return
  wired = true
  const onWake = () => {
    if (document.visibilityState !== "visible") return
    if (getToken() !== lastToken || Date.now() - lastLoadAt > 15_000) load()
  }
  window.addEventListener(NOTIFICATIONS_REFRESH_EVENT, load)
  window.addEventListener("focus", onWake)
  document.addEventListener("visibilitychange", onWake)
  timer = setInterval(() => { if (document.visibilityState === "visible") load() }, POLL_MS)
  load()
}
function stop() {
  if (!wired || listeners.size) return
  wired = false
  clearInterval(timer)
  window.removeEventListener(NOTIFICATIONS_REFRESH_EVENT, load)
}

function subscribe(l) {
  listeners.add(l)
  start()
  return () => { listeners.delete(l); stop() }
}
const snapshot = () => state

/**
 * @returns {{ inbox?: number, salaryCert?: number, loans?: number, ooo?: number, welfare?: number,
 *             discipline?: number, inboxLeave?: number, inboxOoo?: number, certSupervisor?: number }}
 * ตัวเลขที่ยังโหลดไม่เสร็จ/โหลดไม่ได้/ไม่มีสิทธิ์ = undefined
 */
export function usePendingCounts() {
  const s = useSyncExternalStore(subscribe, snapshot, snapshot)
  // token เปลี่ยน (login คนใหม่บนเครื่องเดิม) → โหลดใหม่ ไม่ใช้ตัวเลขของคนก่อน
  useEffect(() => { if (getToken() !== lastToken) load() }, [])
  return withTotals(s)
}

const sum = (...xs) => {
  const known = xs.filter((x) => typeof x === "number")
  return known.length ? known.reduce((a, b) => a + b, 0) : undefined
}

function withTotals(s) {
  // กล่องงาน = ใบลา + ออกนอกสถานที่ + ความเห็นหัวหน้า (หนังสือรับรอง) + สินเชื่อรอพิจารณา
  //          + หนังสือรับรองรอผู้จัดการ (เฉพาะผู้ตัดสินได้)
  const certForMe = can("hr.salaryCert.decide") ? s.salaryCert : undefined
  return { ...s, inbox: sum(s.inboxLeave, s.inboxOoo, s.certSupervisor, s.loans, certForMe) }
}

/** ตัวเลขบนป้าย: 0/ไม่รู้ → null, เกิน 99 → "99+" */
export const badgeLabel = (n) => (typeof n === "number" && n > 0 ? (n > 99 ? "99+" : String(n)) : null)
