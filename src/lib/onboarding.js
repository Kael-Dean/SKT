// src/lib/onboarding.js
// ─────────────────────────────────────────────────────────────────────────────
// First-login onboarding (backend PR 59 — api-handoff "first-login onboarding" 2026-10-23)
//
//   GET  /personnel/me/onboarding                    status + prefill of the 7 sections
//   PUT  /personnel/me/onboarding/{section}          save (writes live, returns the payload)
//   POST /personnel/me/onboarding/{section}/confirm  mark done (422 { detail: { section, missing } })
//   POST /personnel/me/onboarding/tour-complete      idempotent
//   POST /personnel/me/onboarding/complete           422 { detail: { sections, tour } }
//
// Out of scope (login-only accounts, Super Admin) → 404 → status "out_of_scope": never gated.
// Same store pattern as myPermissions.js: in-memory, bound to the token that loaded it.
//
// The gate itself (403 detail.code === "ONBOARDING_REQUIRED") is detected in api.js and
// dispatched as ONBOARDING_REQUIRED_EVENT; AppLayout listens and redirects to /onboarding.
// ─────────────────────────────────────────────────────────────────────────────
import { useSyncExternalStore } from "react"
import { apiAuth } from "./api"
import { getToken } from "./auth"

const BASE = "/personnel/me/onboarding"

/** Section keys in backend order + display data. Icons live in the page (no React here). */
export const SECTIONS = [
  { key: "account", label: "ชื่อและอีเมล", short: "ชื่อ", purpose: "ชื่อ-นามสกุลที่ใช้ในเอกสารและสลิปเงินเดือน" },
  { key: "personal", label: "ข้อมูลส่วนตัว", short: "ส่วนตัว", purpose: "วันเกิด สถานภาพ เบอร์โทร และบัญชีรับเงินเดือน" },
  { key: "address", label: "ที่อยู่ตามทะเบียนบ้าน", short: "ที่อยู่", purpose: "ใช้ส่งเอกสารและติดต่อในกรณีจำเป็น" },
  { key: "family", label: "ครอบครัว", short: "ครอบครัว", purpose: "บิดา มารดา คู่สมรส และบุตร ใช้คำนวณสวัสดิการ" },
  { key: "education", label: "การศึกษา", short: "การศึกษา", purpose: "วุฒิการศึกษาอย่างน้อย 1 รายการ" },
  { key: "work", label: "ประวัติการทำงาน", short: "การทำงาน", purpose: "ที่ทำงานก่อนหน้า หรือเลือก “ไม่มีประวัติ”" },
  { key: "criminal", label: "ประวัติคดีความ", short: "คดีความ", purpose: "ระบุตามจริง หรือเลือก “ไม่มีประวัติ”" },
]
export const SECTION_KEYS = SECTIONS.map((s) => s.key)
export const sectionMeta = (key) => SECTIONS.find((s) => s.key === key)

/** Thai labels for the field names that come back in `missing` / validation. */
export const FIELD_LABELS = {
  first_name: "ชื่อ (ภาษาอังกฤษ)",
  last_name: "นามสกุล (ภาษาอังกฤษ)",
  th_first_name: "คำนำหน้าและชื่อ (ภาษาไทย)",
  th_last_name: "นามสกุล (ภาษาไทย)",
  email: "อีเมล",
  birthday: "วันเกิด",
  gender: "เพศ",
  m_status: "สถานภาพสมรส",
  p_number: "เบอร์โทรศัพท์",
  line_id: "LINE ID",
  e_contact: "เบอร์ติดต่อฉุกเฉิน",
  children_number: "จำนวนบุตร",
  bank_no: "เลขบัญชีธนาคาร",
  underlying_disease: "โรคประจำตัว",
  cid: "เลขบัตรประชาชน",
  hired: "วันเริ่มงาน",
  h_address: "บ้านเลขที่",
  mhoo: "หมู่",
  soi: "ซอย",
  road: "ถนน",
  sub_district: "ตำบล/แขวง",
  district: "อำเภอ/เขต",
  province: "จังหวัด",
  postal_code: "รหัสไปรษณีย์",
  ed_level: "ระดับการศึกษา",
  inst_name: "ชื่อสถาบัน",
  company_name: "ชื่อที่ทำงาน",
  position: "ตำแหน่ง",
  charge: "ข้อหา",
  court: "ศาล",
  case_date: "วันที่",
  outcome: "ผลคดี",
  relationship: "ความสัมพันธ์",
  from_date: "ตั้งแต่",
  to_date: "ถึง",
}

/** `missing` codes that are not field names. */
export const MISSING_MESSAGES = {
  spouse_row: "ระบุคู่สมรสอย่างน้อย 1 คน (สถานภาพเป็น “สมรส”)",
  children_count: "จำนวนบุตรที่กรอกต้องเท่ากับจำนวนบุตรที่ระบุในข้อมูลส่วนตัว",
  rows: "เพิ่มอย่างน้อย 1 รายการ",
}
export const missingLabel = (code) => MISSING_MESSAGES[code] ?? FIELD_LABELS[code] ?? code

export const RELATIONSHIPS = ["บิดา", "มารดา", "คู่สมรส", "บุตร"]
export const GENDERS = ["ชาย", "หญิง"]
export const NONE_SECTIONS = ["work", "criminal"]
/** Read-only in onboarding — changed only through a 3F request (category personal_info). */
export const READ_ONLY_PERSONAL = ["cid", "hired"]

// ─── store ───────────────────────────────────────────────────────────────────
/** @type {{ token: string|null, status: "idle"|"loading"|"ready"|"out_of_scope"|"error", data: object|null, error?: string }} */
let state = { token: null, status: "idle", data: null }
let version = 0
let inflight = null
const listeners = new Set()

function setState(next) {
  state = next
  version += 1
  listeners.forEach((fn) => fn())
}

function current() {
  const token = getToken()
  if (!token || state.token !== token) return { token, status: "idle", data: null }
  return state
}

/** Replace the cached payload (every PUT/confirm/complete returns the full payload). */
function accept(data) {
  const token = getToken()
  if (data && typeof data === "object" && data.sections) setState({ token, status: "ready", data })
  return data
}

export function getOnboardingState() {
  return current()
}

export function loadOnboarding({ force = false } = {}) {
  const token = getToken()
  if (!token) {
    if (state.token) setState({ token: null, status: "idle", data: null })
    return Promise.resolve(null)
  }
  const s = current()
  if (!force && (s.status === "ready" || s.status === "out_of_scope")) return Promise.resolve(s.data)
  if (inflight && inflight.token === token) return inflight.promise

  if (s.status !== "ready") setState({ token, status: "loading", data: null })
  const promise = apiAuth(BASE)
    .then((d) => {
      if (getToken() !== token) return null
      return accept(d)
    })
    .catch((err) => {
      if (getToken() !== token) return null
      if (err?.status === 404) setState({ token, status: "out_of_scope", data: null })
      else if (state.token === token && state.status === "ready") {
        // keep the last good payload
      } else setState({ token, status: "error", data: null, error: err?.message })
      return null
    })
    .finally(() => {
      if (inflight?.promise === promise) inflight = null
    })
  inflight = { token, promise }
  return promise
}

export const saveSection = (key, body) => apiAuth(`${BASE}/${key}`, { method: "PUT", body }).then(accept)
export const confirmSection = (key) => apiAuth(`${BASE}/${key}/confirm`, { method: "POST" }).then(accept)
export const tourComplete = () => apiAuth(`${BASE}/tour-complete`, { method: "POST" }).then(accept)
export const completeOnboarding = () => apiAuth(`${BASE}/complete`, { method: "POST" }).then(accept)

function subscribe(fn) {
  listeners.add(fn)
  return () => listeners.delete(fn)
}
const getVersion = () => version

/**
 * Hook. `locked` = self-service menus should show locked (only when we positively know it).
 * `needsOnboarding` = in scope and not completed/exempt (spec §6.1 redirect rule).
 */
export function useOnboarding() {
  useSyncExternalStore(subscribe, getVersion, getVersion)
  const s = current()
  const data = s.status === "ready" ? s.data : null
  const sections = data?.sections ?? {}
  const confirmedCount = SECTION_KEYS.filter((k) => sections[k]?.confirmed_at).length
  return {
    status: s.status,
    error: s.error,
    data,
    sections,
    confirmedCount,
    onboarded: data ? Boolean(data.onboarded) : null,
    unlocked: data ? Boolean(data.unlocked) : null,
    needsOnboarding: Boolean(data && !data.onboarded),
    locked: Boolean(data && !data.unlocked),
    completed: Boolean(data?.completed_at),
    tourDone: Boolean(data?.tour_completed_at),
  }
}

// ─── helpers ─────────────────────────────────────────────────────────────────
/** First section that is not confirmed (or still missing something). */
export function firstOpenSection(data) {
  const sections = data?.sections ?? {}
  return SECTION_KEYS.find((k) => !sections[k]?.confirmed_at || sections[k]?.missing?.length) ?? null
}

const norm = (v) => (v === "" || v === undefined ? null : typeof v === "string" ? v.trim() || null : v)

/** Only the keys that changed (backend uses exclude_unset). Never sends read-only keys. */
export function diffBody(original = {}, form = {}, allowed = Object.keys(form)) {
  const body = {}
  for (const k of allowed) {
    if (READ_ONLY_PERSONAL.includes(k)) continue
    if (!(k in form)) continue
    const a = norm(original?.[k])
    const b = norm(form[k])
    if (a === b) continue
    // account names: explicit null → 422, so leave the key out instead
    if (b === null && ["first_name", "last_name", "th_first_name", "th_last_name"].includes(k)) continue
    body[k] = b
  }
  return body
}

/**
 * Read a 422 into `{ missing: string[], message: string }`.
 * confirm: detail = { section, missing }; pydantic: detail = [{ loc, msg }]; string detail = message.
 */
export function readValidation(err) {
  const d = err?.data?.detail
  if (d && !Array.isArray(d) && typeof d === "object" && Array.isArray(d.missing)) {
    return { missing: d.missing, message: "" }
  }
  if (Array.isArray(d)) {
    const missing = []
    const msgs = d.map((x) => {
      const field = Array.isArray(x?.loc) ? [...x.loc].reverse().find((p) => typeof p === "string" && p !== "body") : null
      if (field) missing.push(field)
      return field && FIELD_LABELS[field] ? `${FIELD_LABELS[field]}: ${x.msg}` : x?.msg
    })
    return { missing, message: msgs.filter(Boolean).join(" · ") }
  }
  return { missing: [], message: typeof d === "string" ? d : err?.message || "บันทึกไม่สำเร็จ" }
}

/** 409 after completion = edits go through 3F only. */
export const isLockedForEdits = (err) => err?.status === 409

// ─── session flags (cleared on logout via auth.js) ───────────────────────────
export const ONBOARDING_PROMPTED_KEY = "onboarding_prompted"
export const TOUR_STATE_KEY = "onboarding_tour"
