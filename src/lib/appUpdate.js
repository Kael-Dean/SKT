// src/lib/appUpdate.js
// ─────────────────────────────────────────────────────────────────────────────
// อัปเดตเป็นเวอร์ชันใหม่เมื่อมีการ deploy ระหว่างที่แอป/แท็บเปิดค้างไว้
//
// วิธีตรวจ: Vite ใส่ hash ในชื่อ entry script (assets/index-<hash>.js) ทุกครั้งที่ build —
// ดึง index.html ล่าสุด (no-store + query กัน cache) แล้วเทียบชื่อ entry กับของหน้าที่เปิดอยู่.
//
// ทำไมต้อง reload ให้เอง: แอปที่ติดตั้ง (PWA) บนมือถือไม่ได้โหลดหน้าใหม่ตอนแตะไอคอน — iOS/Android แค่ปลุก
// แอปเดิมที่ค้างใน memory ขึ้นมา (บางเครื่องค้างเป็นสัปดาห์) และไม่มีปุ่มรีเฟรชของเบราว์เซอร์. ถ้ารอให้ผู้ใช้
// กด toast เครื่องส่วนใหญ่จะติดเวอร์ชันเก่าไปเรื่อย ๆ. จึง reload ให้เองในจังหวะที่ข้อมูลไม่หาย:
//   1. เปลี่ยนหน้าภายในแอป (ผู้ใช้กำลังออกจากหน้าเดิมอยู่แล้ว) → โหลดหน้าปลายทางจากเวอร์ชันใหม่
//   2. แอปที่ติดตั้ง กลับมาจากพื้นหลัง (ซ่อน ≥ RESUME_MIN_HIDDEN_MS) → reload ทันที
//   ทั้งสองข้อข้ามถ้าหน้านั้นมีการพิมพ์ค้าง / โฟกัสช่องกรอก / เปิด Sheet อยู่ (กันข้อมูลในฟอร์มหาย)
//   ไม่เข้าเงื่อนไข → toast ค้างไว้พร้อมปุ่ม "รีเฟรชตอนนี้" เหมือนเดิม
//
// ตรวจทุก CHECK_INTERVAL_MS ตอนมองเห็นอยู่ + ทันทีเมื่อกลับมาที่แอป/แท็บ / เน็ตกลับมา. DEV ไม่ทำงาน (ไม่มี hash).
// Mount ครั้งเดียวที่ App.jsx (ครอบทุก route รวมหน้า login / onboarding ไม่ใช่แค่ใต้ AppLayout).
//
// หมายเหตุ deploy: index.html / sw.js บน bucket ต้องเป็น `Cache-Control: no-cache` (deploy.yml ตั้งไว้แล้ว)
// ─────────────────────────────────────────────────────────────────────────────
import { useEffect, useRef } from "react"
import { useLocation } from "react-router-dom"
import { toast } from "../components/ui/toast"
import { hardReload } from "./chunkReload"
import { isStandalone } from "./pwa"

const CHECK_INTERVAL_MS = 60_000
const RESUME_MIN_HIDDEN_MS = 30_000
const TOAST_ID = "app-update"
const ENTRY_RE = /assets\/index-[\w-]+\.js/
const EDITABLE = "input, textarea, select, [contenteditable=''], [contenteditable='true']"

// ผู้ใช้พิมพ์อะไรไปแล้วในหน้านี้ (reset เมื่อเปลี่ยนหน้า) — ห้าม reload เองทับข้อมูลที่ยังไม่บันทึก
let typedOnThisPage = false

function isBusy() {
  if (typedOnThisPage) return true
  if (document.body?.hasAttribute("data-sheet-open")) return true
  const el = document.activeElement
  return !!el && el !== document.body && el.matches?.(EDITABLE) === true
}

function currentEntry() {
  for (const s of document.querySelectorAll('script[type="module"][src]')) {
    const m = s.getAttribute("src").match(ENTRY_RE)
    if (m) return m[0]
  }
  return null
}

async function fetchLatestEntry() {
  const url = new URL(import.meta.env.BASE_URL, window.location.origin)
  url.hash = ""
  url.searchParams.set("_v", String(Date.now()))
  const res = await fetch(url, { cache: "no-store", credentials: "same-origin" })
  if (!res.ok) return null
  return (await res.text()).match(ENTRY_RE)?.[0] ?? null
}

/**
 * The new index.html can be live before its assets are (mid-deploy, or an older deploy
 * script). Reloading then gets a 404 entry script → stuck boot screen. Only offer the
 * refresh once the new entry script really loads: a 404 from the bucket is index.html.
 */
async function entryIsLive(entry) {
  try {
    const res = await fetch(new URL(entry, new URL(import.meta.env.BASE_URL, window.location.origin)), {
      method: "HEAD", // headers are enough; the service worker only handles GET
      cache: "no-store",
      credentials: "same-origin",
    })
    const type = res.headers.get("content-type") || ""
    return res.ok && !type.includes("text/html")
  } catch {
    return false
  }
}

function showUpdateToast() {
  toast.info("มีเวอร์ชันใหม่ของระบบ", {
    id: TOAST_ID,
    description: "รีเฟรชหน้าเพื่อใช้งานเวอร์ชันล่าสุด — บันทึกข้อมูลที่กรอกค้างไว้ก่อนรีเฟรช",
    duration: Infinity,
    // plain reload() can get the old index.html back from the CDN cache → stuck boot screen
    action: { label: "รีเฟรชตอนนี้", onClick: hardReload },
  })
}

/** Mount ONCE (App.jsx, inside the Router) — finds a newer deploy and moves onto it at a safe moment. */
export function useAppUpdateCheck() {
  const { pathname, state } = useLocation()
  const updateFound = useRef(false)
  const firstPath = useRef(true)

  // 1) navigating inside the app = leaving the old page anyway → load the new page from the new version.
  //    Skipped for drill-downs: their back label lives in history state, which a full load drops.
  useEffect(() => {
    if (firstPath.current) {
      firstPath.current = false
      return
    }
    const wasBusy = typedOnThisPage || document.body?.hasAttribute("data-sheet-open")
    typedOnThisPage = false
    if (!updateFound.current || wasBusy || state?.backLabel) return
    hardReload()
  }, [pathname]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (import.meta.env.DEV) return
    const running = currentEntry()
    if (!running) return

    let inFlight = false
    let hiddenAt = 0

    const markTyped = (e) => {
      if (e.target?.matches?.(EDITABLE)) typedOnThisPage = true
    }

    // 2) the installed app woke up from the background with nothing half-typed → just reload.
    const applyOrNotify = (resumedAfterMs) => {
      if (isStandalone() && resumedAfterMs >= RESUME_MIN_HIDDEN_MS && !isBusy()) {
        hardReload()
        return
      }
      showUpdateToast()
    }

    const check = async (resumedAfterMs = 0) => {
      if (document.visibilityState !== "visible" || !navigator.onLine) return
      if (updateFound.current) {
        applyOrNotify(resumedAfterMs) // re-show after the user closed it
        return
      }
      if (inFlight) return
      inFlight = true
      try {
        const latest = await fetchLatestEntry()
        if (latest && latest !== running && (await entryIsLive(latest))) {
          updateFound.current = true
          applyOrNotify(resumedAfterMs)
        }
      } catch {
        // offline / transient network error — try again next tick
      } finally {
        inFlight = false
      }
    }

    const timer = setInterval(() => {
      if (!updateFound.current) check()
    }, CHECK_INTERVAL_MS)
    const onVisibility = () => {
      if (document.visibilityState === "hidden") {
        hiddenAt = Date.now()
        return
      }
      const hiddenFor = hiddenAt ? Date.now() - hiddenAt : 0
      hiddenAt = 0
      check(hiddenFor)
    }
    // the page can also come back from the back/forward cache without a visibilitychange
    const onPageShow = (e) => {
      if (e.persisted) check(RESUME_MIN_HIDDEN_MS)
    }
    const onOnline = () => check()
    document.addEventListener("visibilitychange", onVisibility)
    document.addEventListener("input", markTyped, true)
    window.addEventListener("pageshow", onPageShow)
    window.addEventListener("online", onOnline)

    return () => {
      clearInterval(timer)
      document.removeEventListener("visibilitychange", onVisibility)
      document.removeEventListener("input", markTyped, true)
      window.removeEventListener("pageshow", onPageShow)
      window.removeEventListener("online", onOnline)
    }
  }, [])
}
