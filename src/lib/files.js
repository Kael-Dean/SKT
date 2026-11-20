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
import { apiAuth, apiDownload, apiUrl, expireSession } from "./api"
import { getToken } from "./auth"
import { isIOSLike, isMobileStandalone, isStandalone } from "./pwa"
import { toast } from "../components/ui/toast"

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
        expireSession()
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

/** Plain <a download> save. Use saveBlob/deliverBlob from pages — this one breaks in the iOS installed app. */
function anchorSave(blob, filename) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement("a")
  a.href = url
  a.download = filename || "file"
  a.rel = "noopener"
  document.body.appendChild(a)
  a.click()
  a.remove()
  // Revoke later — revoking right away can cancel the download (Safari, slow phones).
  setTimeout(() => URL.revokeObjectURL(url), 60_000)
}

/** Save a blob under a filename — works on desktop, Android, iPhone/iPad (browser and installed app). */
export function saveBlob(blob, filename) {
  return deliverBlob(blob, filename)
}

// ─── Popups and print in the installed app ───────────────────────────────────
// On a phone/tablet the installed app (display-mode: standalone) has no tabs:
// window.open lands outside the app, where a blob URL does not load and the opener
// handle is unreliable, and window.print may do nothing. These helpers keep the
// browser behaviour everywhere else and hand over a file on those devices.
// Desktop installed apps open popups normally.

/**
 * window.open that returns null when a popup can't work. Call it synchronously
 * inside the click (popup blockers), and treat null like a blocked popup.
 */
export function openPopup(url = "", features) {
  if (isMobileStandalone()) return null
  return window.open(url, "_blank", features)
}

async function shareBlobFile(file) {
  await navigator.share({ files: [file], title: file.name })
}

/**
 * Hand a blob to the user when no popup is available. iOS standalone gets the
 * share sheet (a[download] on a blob is unreliable there); everything else saves.
 * Share needs a fresh tap, which a slow download can use up: then ask for one more.
 */
export async function deliverBlob(blob, filename) {
  const name = filename || "file"
  const file = isStandalone() && isIOSLike() && typeof File === "function" ? new File([blob], name, { type: blob.type }) : null
  if (!file || !navigator.canShare?.({ files: [file] })) {
    anchorSave(blob, name)
    // The installed app can't preview, so opening a document leaves a copy on the device.
    if (isMobileStandalone()) {
      toast.info("บันทึกไฟล์ลงเครื่องแล้ว", {
        description: "ถ้าใช้เครื่องนี้ร่วมกับคนอื่น ให้ลบไฟล์หลังใช้งาน",
        duration: 10_000,
      })
    }
    return
  }
  try {
    await shareBlobFile(file)
  } catch (err) {
    if (err?.name === "AbortError") return // user closed the share sheet
    if (err?.name !== "NotAllowedError") {
      anchorSave(blob, name)
      return
    }
    // The download outlived the tap. iOS share sheet = preview + "Save to Files" + Print.
    toast.info("ไฟล์พร้อมแล้ว", {
      description: `${name} — กด "เปิด / บันทึก" เพื่อดูหรือเก็บลงเครื่อง`,
      duration: 30_000,
      action: { label: "เปิด / บันทึก", onClick: () => shareBlobFile(file).catch(() => {}) },
    })
  }
}

const isAndroid = () => /Android/i.test(window.navigator.userAgent)

/**
 * Open a tab for a document that is still downloading. Call synchronously inside the
 * click, before any await (Safari blocks window.open after one). Returns null where a
 * tab can't show it — Android (Chrome there downloads a blob PDF and leaves a blank tab)
 * and the phone/tablet installed app — and showBlob then hands the file over instead.
 */
export function prepareDocWindow(title = "รายงาน") {
  if (isAndroid()) return null
  // No "noopener": we need the handle to load the file. Clear opener by hand (reverse-tabnabbing).
  const win = openPopup()
  if (!win) return null
  try {
    win.opener = null
  } catch { /* ignore */ }
  try {
    const doc = win.document
    doc.title = title
    const isDark = document.documentElement.classList.contains("dark")
    if (isDark) {
      doc.documentElement.style.colorScheme = "dark"
      doc.body.style.background = "#0B0B0F"
      doc.body.style.color = "#EDEDF0"
    }
    const wrap = doc.createElement("div")
    wrap.style.cssText = "font-family:sans-serif;padding:16px"
    const heading = doc.createElement("div")
    heading.style.cssText = "font-size:16px;font-weight:600"
    heading.textContent = "กำลังเตรียมไฟล์…"
    const hint = doc.createElement("div")
    hint.style.cssText = `margin-top:6px;color:${isDark ? "#9A9AA5" : "#64748b"}`
    hint.textContent = "ถ้าหน้านี้ไม่เปลี่ยนเป็นไฟล์ ให้กลับไปหน้าเดิมเพื่อดูสาเหตุ"
    wrap.append(heading, hint)
    doc.body.replaceChildren(wrap)
  } catch { /* ignore */ }
  return win
}

/** Close a tab from prepareDocWindow (on error). */
export function closeDocWindow(win) {
  try {
    win?.close?.()
  } catch { /* ignore */ }
}

/**
 * Show a downloaded document: in the tab from prepareDocWindow when there is one,
 * otherwise save it / open the share sheet (iPhone/iPad app) so it still reaches the user.
 */
export async function showBlob(blob, filename, win) {
  if (win && !win.closed) {
    const url = URL.createObjectURL(blob)
    try {
      win.location.href = url
      setTimeout(() => URL.revokeObjectURL(url), 5 * 60_000)
      return
    } catch {
      URL.revokeObjectURL(url)
      closeDocWindow(win)
    }
  }
  await deliverBlob(blob, filename)
}

/**
 * Print a standalone HTML document. Prints straight from this click: the app's CSP
 * also covers the popup, so a script inside `html` would not run.
 * On a phone/tablet installed app the document is handed over as a file to print from
 * there. Anywhere else no popup means the browser blocked it: say so, never save a
 * report to disk the user didn't ask for.
 */
export function printHtml(html, { filename = "document.html", features } = {}) {
  // No "noopener": window.open would return null and we need the handle to write
  // and print. Clear opener by hand instead (reverse-tabnabbing).
  const popup = openPopup("", features)
  if (!popup) {
    if (isMobileStandalone()) {
      deliverBlob(new Blob([html], { type: "text/html;charset=utf-8" }), filename)
    } else {
      toast.warning("เบราว์เซอร์กันหน้าต่างพิมพ์ไว้", {
        description: "อนุญาตป๊อปอัปสำหรับเว็บนี้ แล้วกดพิมพ์อีกครั้ง",
        duration: 10_000,
      })
    }
    return
  }
  try {
    popup.opener = null
  } catch { /* ignore */ }
  popup.document.write(html)
  popup.document.close()
  // Synchronous on purpose: deferring to onload loses the click's user activation in Chrome.
  try {
    popup.focus()
    popup.print()
  } catch { /* ignore */ }
}

/** Print the current page. If the installed app shows no print dialog, say what to do instead. */
export function printPage() {
  if (!isMobileStandalone()) {
    window.print()
    return
  }
  let opened = false
  window.addEventListener("beforeprint", () => { opened = true }, { once: true })
  window.print()
  setTimeout(() => {
    if (opened) return
    toast.warning("พิมพ์จากแอปบนเครื่องนี้ไม่ได้", {
      description: "แคปหน้าจอเก็บไว้ หรือเปิดระบบในเบราว์เซอร์แล้วพิมพ์จากที่นั่น",
      duration: 10_000,
    })
  }, 800)
}
