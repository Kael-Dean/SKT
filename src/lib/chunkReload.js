// src/lib/chunkReload.js
// ─────────────────────────────────────────────────────────────────────────────
// หลัง deploy ใหม่ ไฟล์ chunk ชื่อเดิม (hash เก่า) หายจาก bucket → แท็บที่เปิดค้างไว้กดเข้าหน้า lazy แล้วได้
// "Failed to fetch dynamically imported module" → หน้าขาว. ทางแก้: reload หน้า 1 ครั้งให้ได้ index.html ชุดใหม่
//
//   installChunkReloadHandler()  — ฟัง `vite:preloadError` (modulepreload / CSS ของ chunk โหลดไม่ได้) เรียกครั้งเดียวใน main.jsx
//   lazyWithReload(factory)      — แทน React.lazy: ถ้า import() ล้มเพราะ chunk หาย → reload แทนการ throw ไป error boundary
//
// กันวน: จำเวลา reload ล่าสุดใน sessionStorage — reload ได้ไม่เกิน 1 ครั้งต่อ RELOAD_WINDOW_MS
// ถ้าเพิ่ง reload ไป (chunk หายจริง / เน็ตหลุด) จะปล่อย error ไปตามปกติ ไม่ reload ซ้ำ
// ─────────────────────────────────────────────────────────────────────────────
import { lazy } from "react"

const RELOAD_KEY = "amc:chunk-reload-at"
const RELOAD_WINDOW_MS = 10_000

// Chrome / Firefox / Safari ใช้ข้อความต่างกัน
const CHUNK_ERROR_RE =
  /Failed to fetch dynamically imported module|error loading dynamically imported module|Importing a module script failed|Unable to preload CSS|Loading (CSS )?chunk [\w-]+ failed/i

export function isChunkLoadError(err) {
  return CHUNK_ERROR_RE.test(String(err?.message ?? err ?? ""))
}

/** reload หน้า ถ้ายังไม่ได้ reload ในช่วง RELOAD_WINDOW_MS — คืน true เมื่อสั่ง reload แล้ว */
export function reloadOnceForStaleChunk() {
  try {
    const last = Number(sessionStorage.getItem(RELOAD_KEY)) || 0
    if (Date.now() - last < RELOAD_WINDOW_MS) return false
    sessionStorage.setItem(RELOAD_KEY, String(Date.now()))
  } catch {
    // sessionStorage ใช้ไม่ได้ (private mode บางเบราว์เซอร์) → ไม่ reload กันวนไม่รู้จบ
    return false
  }
  hardReload()
  return true
}

/**
 * Reload with a fresh `_r` query so the CDN / HTTP cache can't hand back the
 * pre-deploy index.html (whose asset hashes are gone → stuck boot screen).
 * src/main.jsx strips `_r` again before the router reads the URL.
 */
export function hardReload() {
  const url = new URL(window.location.href)
  url.searchParams.set("_r", String(Date.now()))
  window.location.replace(url.pathname + url.search + url.hash)
}

let installed = false

export function installChunkReloadHandler() {
  if (installed || typeof window === "undefined") return
  installed = true
  window.addEventListener("vite:preloadError", (event) => {
    if (reloadOnceForStaleChunk()) event.preventDefault() // กัน vite throw ต่อระหว่างกำลัง reload
  })
}

/** React.lazy ที่ reload หน้า 1 ครั้งเมื่อ chunk ของ route หาย (หลัง deploy) */
export function lazyWithReload(factory) {
  return lazy(() =>
    factory().catch((err) => {
      if (isChunkLoadError(err) && reloadOnceForStaleChunk()) {
        return new Promise(() => {}) // ค้าง Suspense fallback ไว้จนหน้า reload
      }
      throw err
    }),
  )
}
