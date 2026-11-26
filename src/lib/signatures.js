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

/** รูปจาก server → data URI · รับทั้ง data:image/* และ base64 PNG เปล่า ๆ — อย่างอื่น = null */
function toDataUrl(v) {
  if (typeof v !== "string" || !v) return null
  if (/^data:image\/(png|jpe?g|webp);base64,/.test(v)) return v
  if (/^iVBORw0KGgo[A-Za-z0-9+/=\s]+$/.test(v)) return `data:image/png;base64,${v.replace(/\s+/g, "")}`
  return null
}

/**
 * เติมลายเซ็นของคนที่ทำ action จริงแต่ไม่มีแถวในเอกสาร (เอกสารที่ทำก่อนมีระบบลายเซ็น)
 * ด้วยลายเซ็น active ปัจจุบัน — ตรงกับที่ PDF จากระบบทำ · ไม่มีสิทธิ์/ไม่มีรูป = ข้าม
 * @param {Array} rows ผลจาก loadDocSignatures
 * @param {Array<{ role: string, userId: number|string|null|undefined }>} actors
 */
export async function withCurrentSignatures(rows, actors) {
  const list = Array.isArray(rows) ? [...rows] : []
  const has = (uid) => list.some((r) => String(r.user_id) === String(uid))
  const missing = [...new Map(
    actors.filter((a) => a.userId != null && !has(a.userId)).map((a) => [String(a.userId), a]),
  ).values()]
  const filled = await Promise.all(
    missing.map(async (a) => {
      const image = await imageAt(`/hr/signatures/${a.userId}/image`).catch(() => null)
      return image ? { user_id: a.userId, role: a.role, image, fallback: true } : null
    }),
  )
  return [...list, ...filled.filter(Boolean)]
}

/**
 * ลายเซ็นทุกคนที่ทำ action ในเอกสาร → [{ user_id, role, action, at, name, position, image }]
 * error ใด ๆ → [] (เอกสารต้องพิมพ์ได้เสมอ แม้ไม่มีลายเซ็น)
 */
// keepUnsigned: คืนแถวที่ยังไม่มีรูปลายเซ็นด้วย (image = null) — ใช้เอาชื่อ/ตำแหน่งผู้ลงนามจริงมาพิมพ์
export async function loadDocSignatures(path, { keepUnsigned = false } = {}) {
  try {
    const d = await apiAuth(path, { redirectOn401: false })
    const rows = Array.isArray(d) ? d : Array.isArray(d?.signatures) ? d.signatures : []
    return rows
      .map((r) => ({ ...r, image: toDataUrl(r?.image ?? r?.image_base64 ?? r?.data) }))
      .filter((r) => keepUnsigned || r.image)
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

/** source: "upload" (รายคน) | "import" (นำเข้าหลายไฟล์) — backend บันทึกเป็นประวัติการเปลี่ยนลายเซ็น */
export function uploadSignature(userId, file, { source = "upload" } = {}) {
  const body = new FormData()
  body.append("file", file, file.name || `signature-${userId}.png`)
  body.append("source", source)
  return apiAuth(`/hr/signatures/${userId}`, { method: "PUT", body })
}

export const deleteSignature = (userId) => apiAuth(`/hr/signatures/${userId}`, { method: "DELETE" })

// ─── คำขอเปลี่ยนลายเซ็น (handoff ส่วนที่ 7) ───────────────────────────────────

export const REQUEST_STATUS = {
  pending: { label: "รออนุมัติ", tone: "pending" },
  approved: { label: "อนุมัติแล้ว", tone: "success" },
  rejected: { label: "ไม่อนุมัติ", tone: "danger" },
  cancelled: { label: "ยกเลิกแล้ว", tone: "neutral" },
}

export const thaiDateTime = (v) => {
  if (!v) return ""
  const d = new Date(v)
  return Number.isNaN(d.getTime())
    ? ""
    : d.toLocaleString("th-TH", { day: "numeric", month: "short", year: "2-digit", hour: "2-digit", minute: "2-digit" })
}

/** ป้ายบอกว่าการเปลี่ยนนี้มาจากไหน */
export function requestSourceLabel(r) {
  if (r?.kind === "remove" || r?.source === "hr_remove") return "HR ลบลายเซ็น"
  if (r?.source === "hr_upload") return "HR อัปโหลดให้"
  if (r?.source === "hr_import") return "HR นำเข้าจากไฟล์"
  return "ยื่นคำขอเปลี่ยนลายเซ็น"
}

/** อ่านรายการ → { ready, rows } · ready=false = backend ยังไม่มี endpoint */
async function listAt(path) {
  try {
    const d = await apiAuth(path)
    return { ready: true, rows: Array.isArray(d) ? d : d?.items ?? [] }
  } catch (err) {
    if (isNotReady(err)) return { ready: false, rows: [] }
    throw err
  }
}

// ของฉัน
export async function loadMySignatureStatus() {
  try {
    return { ready: true, ...(await apiAuth("/personnel/me/signature")) }
  } catch (err) {
    if (isNotReady(err)) return { ready: false, has_signature: false }
    throw err
  }
}
export const listMySignatureRequests = () => listAt("/personnel/me/signature-requests")
export const loadMyRequestImage = (id) => imageAt(`/personnel/me/signature-requests/${id}/image`)
export function submitSignatureRequest(file, reason) {
  const body = new FormData()
  body.append("file", file, file.name || "signature.png")
  body.append("reason", reason)
  return apiAuth("/personnel/me/signature-requests", { method: "POST", body })
}
export const cancelSignatureRequest = (id) =>
  apiAuth(`/personnel/me/signature-requests/${id}/cancel`, { method: "PATCH" })

// HR
export const listSignatureRequests = (status) =>
  listAt(`/hr/signature-requests${status ? `?status=${encodeURIComponent(status)}` : ""}`)
export const loadRequestImage = (id) => imageAt(`/hr/signature-requests/${id}/image`)
export const loadSignatureVersionImage = (signatureId) => imageAt(`/hr/signatures/versions/${signatureId}/image`)
export const listSignatureHistory = (userId) => listAt(`/hr/signatures/${userId}/history`)
export const approveSignatureRequest = (id, note) =>
  apiAuth(`/hr/signature-requests/${id}/approve`, { method: "PATCH", body: { note: note || null } })
export const rejectSignatureRequest = (id, note) =>
  apiAuth(`/hr/signature-requests/${id}/reject`, { method: "PATCH", body: { note } })

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
  return s
    .replace(/[\s.]+/g, "")
    .replace(/\p{Cf}+/gu, "") // zero-width / format chars
    .replace(/เเ/g, "แ") // สระเอ 2 ตัวที่พิมพ์แทนสระแอ
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
    .map(([f, l]) => ({ full: normalizeName(`${f ?? ""}${l ?? ""}`), first: normalizeName(f), last: normalizeName(l) }))
}

/**
 * จับคู่ไฟล์กับเจ้าหน้าที่จากชื่อ
 * → { person, confidence: "exact" | "first" | "none", candidates }
 *   exact = ชื่อ+สกุลตรงคนเดียว
 *   first = ตรงบางส่วน (ชื่อตรงคนเดียว หรือนามสกุลตรงคนเดียว) — สะกดต่าง/เปลี่ยนสกุล ให้ HR ตรวจก่อน
 *   none  = ไม่เจอ หรือตรงหลายคน
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
  const parts = nameFromFilename(filename).split(" ")
  const lastName = parts.length > 1 ? normalizeName(parts[parts.length - 1]) : ""
  const byLast = lastName ? list.filter((p) => personKeys(p).some((k) => k.last && k.last === lastName)) : []
  if (byLast.length === 1) return { person: byLast[0], confidence: "first", candidates: byLast }
  return { person: null, confidence: "none", candidates: [...first, ...byLast] }
}
