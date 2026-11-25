// src/lib/signatures.js
// ─────────────────────────────────────────────────────────────────────────────
// ลายเซ็นอิเล็กทรอนิกส์ — spec: handoff/api-handoff-e-signature.md
//
// กฎ: ลายเซ็นผูกกับ user_id (ไม่ใช่ชื่อ) และออกในเอกสารเฉพาะคนที่ทำ action นั้นจริง
// server เป็นคนตัดสินว่าใครมีลายเซ็นในเอกสารไหน (endpoint .../signatures ของเอกสาร)
// FE แค่วางรูปลงช่องตาม role / user_id
//
// endpoint ยังไม่มี (404 / 405 / 501) → คืนค่าว่าง → ช่องเซ็นเป็นเส้นจุดเหมือนเดิม ไม่มี error
// ─────────────────────────────────────────────────────────────────────────────
import { apiAuth, apiDownload } from "./api"

/** สถานะที่แปลว่า "backend ยังไม่รองรับ" — เงียบ ไม่ต้องแจ้งผู้ใช้ */
const NOT_READY = new Set([404, 405, 501])
export const isNotReady = (err) => NOT_READY.has(err?.status)

export const SIGNATURE_MAX_BYTES = 1024 * 1024

const blobToDataUrl = (blob) =>
  new Promise((resolve, reject) => {
    const r = new FileReader()
    r.onload = () => resolve(r.result)
    r.onerror = () => reject(r.error)
    r.readAsDataURL(blob)
  })

/** รูปลายเซ็นเป็น data URI (ไม่ต้อง revoke) — ไม่มี/ยังไม่รองรับ → null */
async function imageAt(path) {
  try {
    const { blob } = await apiDownload(path, { cache: "no-store" })
    if (!blob?.size || !/^image\/png/.test(blob.type || "image/png")) return null
    return await blobToDataUrl(blob)
  } catch (err) {
    if (isNotReady(err) || err?.status === 403) return null
    throw err
  }
}

// ─── ลายเซ็นของเอกสาร ─────────────────────────────────────────────────────────

/**
 * ลายเซ็นทุกคนที่ทำ action ในเอกสาร → [{ user_id, role, action, at, name, position, image }]
 * error ใด ๆ → [] (เอกสารต้องพิมพ์ได้เสมอ แม้ไม่มีลายเซ็น)
 */
export async function loadDocSignatures(path) {
  try {
    const d = await apiAuth(path, { redirectOn401: false })
    const rows = Array.isArray(d) ? d : Array.isArray(d?.signatures) ? d.signatures : []
    return rows.filter((r) => typeof r?.image === "string" && r.image.startsWith("data:image/png"))
  } catch (err) {
    if (!isNotReady(err) && import.meta.env.DEV) console.warn("[signatures]", path, err)
    return []
  }
}

/** หาลายเซ็นตาม role (และ user_id ถ้าระบุ) — ไม่เจอ = null */
export function pickSignature(rows, { role, userId } = {}) {
  const list = Array.isArray(rows) ? rows : []
  const byUser = (r) => userId == null || String(r.user_id) === String(userId)
  return (
    list.find((r) => (role == null || r.role === role) && byUser(r)) ??
    (userId != null ? list.find(byUser) : null) ??
    null
  )
}

export const leaveSignaturesPath = (leaveId) => `/hr/leave-requests/${leaveId}/signatures`
export const mySalaryCertSignaturesPath = (reqId) => `/personnel/me/salary-cert-requests/${reqId}/signatures`

// ─── ของตัวเอง ────────────────────────────────────────────────────────────────

export const loadMySignatureImage = () => imageAt("/personnel/me/signature/image")

// ─── จัดการ (HR) ─────────────────────────────────────────────────────────────

/** รายการลายเซ็นที่ใช้งานอยู่ → { ready, rows } · ready=false = backend ยังไม่มี endpoint */
export async function listSignatures() {
  try {
    const d = await apiAuth("/hr/signatures")
    return { ready: true, rows: Array.isArray(d) ? d : d?.items ?? [] }
  } catch (err) {
    if (isNotReady(err)) return { ready: false, rows: [] }
    throw err
  }
}

export const loadSignatureImage = (userId) => imageAt(`/hr/signatures/${userId}/image`)

export function uploadSignature(userId, file) {
  const body = new FormData()
  body.append("file", file, file.name || `signature-${userId}.png`)
  return apiAuth(`/hr/signatures/${userId}`, { method: "PUT", body })
}

export const deleteSignature = (userId) => apiAuth(`/hr/signatures/${userId}`, { method: "DELETE" })

/** ตรวจไฟล์ก่อนส่ง (server ตรวจซ้ำอีกชั้น) → ข้อความ error หรือ "" */
export async function checkSignatureFile(file) {
  if (!file) return "ไม่พบไฟล์"
  if (file.type && file.type !== "image/png") return "ต้องเป็นไฟล์ PNG"
  if (file.size > SIGNATURE_MAX_BYTES) return "ไฟล์ใหญ่เกิน 1 MB"
  const head = new Uint8Array(await file.slice(0, 8).arrayBuffer())
  const png = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]
  if (!png.every((b, i) => head[i] === b)) return "ไฟล์นี้ไม่ใช่ PNG จริง"
  return ""
}

// ─── จับคู่ชื่อไฟล์ ↔ ชื่อเจ้าหน้าที่ ───────────────────────────────────────────

const TITLES = ["นางสาว", "น.ส.", "นส.", "นาง", "นาย", "ว่าที่ร้อยตรี", "ว่าที่ร.ต.", "ดร."]

/** ชื่อสำหรับเทียบ: ตัดคำนำหน้า ช่องว่าง จุด แล้ว normalize */
export function normalizeName(raw) {
  let s = String(raw ?? "").normalize("NFC").trim()
  for (let changed = true; changed; ) {
    changed = false
    for (const t of TITLES) {
      if (s.startsWith(t)) {
        s = s.slice(t.length).trim()
        changed = true
      }
    }
  }
  return s.replace(/[\s.]+/g, "").replace(/\p{Cf}+/gu, "") // \p{Cf} = zero-width / format chars
}

/** "001.นางสาวกมลทิพย์  พิมพ์เสน_0.png" → "นางสาวกมลทิพย์ พิมพ์เสน" */
export function nameFromFilename(filename) {
  return String(filename ?? "")
    .replace(/\.[a-z0-9]+$/i, "")
    .replace(/^\s*\d+\s*[.\-_ )]\s*/, "")
    .replace(/[_-]\d+$/, "")
    .replace(/[_]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
}

const personKeys = (p) => {
  const info = p?.personnel_info ?? {}
  const pairs = [
    [p?.first_name, p?.last_name],
    [info.th_first_name ?? p?.th_first_name, info.th_last_name ?? p?.th_last_name],
  ]
  return pairs
    .filter(([f, l]) => f || l)
    .map(([f, l]) => ({ full: normalizeName(`${f ?? ""}${l ?? ""}`), first: normalizeName(f) }))
}

/**
 * จับคู่ไฟล์กับเจ้าหน้าที่จากชื่อ
 * → { person, confidence: "exact" | "first" | "none", candidates }
 *   exact = ชื่อ+สกุลตรงคนเดียว · first = ชื่อตรงคนเดียวแต่สกุลไม่ตรง (ให้ HR ตรวจ) · none = ไม่เจอหรือซ้ำหลายคน
 */
export function matchPerson(filename, people) {
  const target = normalizeName(nameFromFilename(filename))
  if (!target) return { person: null, confidence: "none", candidates: [] }
  const list = Array.isArray(people) ? people : []
  const exact = list.filter((p) => personKeys(p).some((k) => k.full && k.full === target))
  if (exact.length === 1) return { person: exact[0], confidence: "exact", candidates: exact }
  if (exact.length > 1) return { person: null, confidence: "none", candidates: exact }
  const first = list.filter((p) => personKeys(p).some((k) => k.first && target.startsWith(k.first)))
  if (first.length === 1) return { person: first[0], confidence: "first", candidates: first }
  return { person: null, confidence: "none", candidates: first }
}
