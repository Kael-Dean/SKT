// src/lib/files.js
// ─────────────────────────────────────────────────────────────────────────────
// Shared upload service (งวด 4 · 3F) — POST/GET/DELETE /files, GET /files/{id}/meta
// Used by <FileUploader> / <AttachmentList> and later by 3B (ใบรับรองแพทย์) and 3Q.
//
//   const meta = await uploadFile(file, { onProgress: (pct) => …, signal })
//   await deleteFile(meta.id)                     // before the record claims it
//   const { blob, filename } = await fetchFileBlob(id)
//
// Server rules (mirror them on the client with validateFile / validateFiles):
//   PDF, JPG, PNG, WEBP only (type sniffed from content — HEIC is refused)
//   ≤ 5 MB per file · ≤ 5 files per record · unattached files expire after 24 h
// Errors are `{detail: "<Thai message>"}` → thrown Error.message = detail, .status = HTTP code.
// ─────────────────────────────────────────────────────────────────────────────
import { apiAuth, apiDownload, apiUrl } from "./api"
import { getToken, logout } from "./auth"

export const FILE_MAX_BYTES = 5 * 1024 * 1024
export const FILE_MAX_COUNT = 5
export const FILE_ACCEPT = "image/jpeg,image/png,image/webp,application/pdf"
export const FILE_ALLOWED_TYPES = ["application/pdf", "image/jpeg", "image/png", "image/webp"]
const ALLOWED_EXT = ["pdf", "jpg", "jpeg", "png", "webp"]

/** "183 KB" / "1.2 MB" */
export function formatBytes(n) {
  const b = Number(n)
  if (!Number.isFinite(b) || b < 0) return ""
  if (b < 1024) return `${b} B`
  if (b < 1024 * 1024) return `${Math.round(b / 1024)} KB`
  return `${(b / (1024 * 1024)).toFixed(1)} MB`
}

export const isImageType = (ct) => typeof ct === "string" && ct.startsWith("image/")
export const isPdfType = (ct) => ct === "application/pdf"

/**
 * Client-side check for one file. Returns a Thai error string, or "" when OK.
 * Same wording as the server so the user sees one voice.
 */
export function validateFile(file, { maxBytes = FILE_MAX_BYTES, allowedTypes = FILE_ALLOWED_TYPES } = {}) {
  if (!file) return "ไม่พบไฟล์"
  if (file.size === 0) return "ไฟล์ว่างเปล่า"
  const ext = String(file.name || "").split(".").pop()?.toLowerCase() || ""
  const typeOk = file.type ? allowedTypes.includes(file.type) : ALLOWED_EXT.includes(ext)
  if (!typeOk || /^hei[cf]$/.test(ext)) return "รองรับเฉพาะไฟล์ PDF, JPG, PNG หรือ WEBP"
  if (file.size > maxBytes) return `ไฟล์ใหญ่เกิน ${formatBytes(maxBytes)}`
  return ""
}

/**
 * Upload one file with progress. Resolves to FileMeta
 * `{id, filename, content_type, size_bytes, ref_type, ref_id, created_at}`.
 * XHR (not fetch) because fetch has no upload progress.
 */
export function uploadFile(file, { onProgress, signal } = {}) {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest()
    xhr.open("POST", apiUrl("/files"))
    const token = getToken()
    if (token) xhr.setRequestHeader("Authorization", `Bearer ${token}`)
    xhr.responseType = "text"

    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable && onProgress) onProgress(Math.min(99, Math.round((e.loaded / e.total) * 100)))
    }
    xhr.onload = () => {
      let data = null
      try { data = xhr.responseText ? JSON.parse(xhr.responseText) : null } catch { data = xhr.responseText }
      if (xhr.status >= 200 && xhr.status < 300) {
        onProgress?.(100)
        resolve(data)
        return
      }
      const detail = data && typeof data === "object" ? data.detail : null
      const msg =
        typeof detail === "string" ? detail
          : Array.isArray(detail) ? detail.map((d) => d?.msg).filter(Boolean).join(" | ")
            : xhr.status === 413 ? "ไฟล์ใหญ่เกิน 5 MB"
              : xhr.status === 401 ? "เซสชันหมดอายุ กรุณาเข้าสู่ระบบใหม่"
                : `อัปโหลดไม่สำเร็จ (HTTP ${xhr.status})`
      const err = new Error(msg)
      err.status = xhr.status
      err.data = data
      if (xhr.status === 401 && token) {
        // same behaviour as apiAuth: clear the session and go to login
        logout()
        localStorage.setItem("session_expired", "1")
        window.location.hash = "#/login"
      }
      reject(err)
    }
    xhr.onerror = () => {
      const err = new Error("เชื่อมต่อเซิร์ฟเวอร์ไม่สำเร็จ กรุณาตรวจสอบอินเทอร์เน็ตแล้วลองใหม่")
      err.status = 0
      reject(err)
    }
    xhr.onabort = () => {
      const err = new Error("ยกเลิกการอัปโหลดแล้ว")
      err.name = "AbortError"
      err.status = 0
      reject(err)
    }
    if (signal) {
      if (signal.aborted) { xhr.abort(); return }
      signal.addEventListener("abort", () => xhr.abort(), { once: true })
    }

    const fd = new FormData()
    fd.append("file", file)
    xhr.send(fd)
  })
}

/** DELETE /files/{id} — uploader only, and only while unattached (409 once attached). */
export function deleteFile(id) {
  return apiAuth(`/files/${encodeURIComponent(id)}`, { method: "DELETE" })
}

/** GET /files/{id}/meta */
export function getFileMeta(id) {
  return apiAuth(`/files/${encodeURIComponent(id)}/meta`)
}

/** GET /files/{id} as a blob (needs the bearer token — a plain <img src> won't work). */
export function fetchFileBlob(id) {
  return apiDownload(`/files/${encodeURIComponent(id)}`)
}

/** Save a blob under a filename (download). */
export function saveBlob(blob, filename) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement("a")
  a.href = url
  a.download = filename || "file"
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}
