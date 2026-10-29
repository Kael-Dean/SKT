// src/lib/appUpdate.js
// ─────────────────────────────────────────────────────────────────────────────
// แจ้งผู้ใช้เมื่อมีการ deploy เวอร์ชันใหม่ระหว่างที่แท็บเปิดค้างไว้
//
// วิธีตรวจ: Vite ใส่ hash ในชื่อ entry script (assets/index-<hash>.js) ทุกครั้งที่ build —
// ดึง index.html ล่าสุด (no-store + query กัน cache) แล้วเทียบชื่อ entry กับของหน้าที่เปิดอยู่.
// ต่างกัน = มีเวอร์ชันใหม่ → toast ค้างไว้พร้อมปุ่ม "รีเฟรช" (ไม่ reload เอง กันข้อมูลในฟอร์มหาย)
//
// ตรวจทุก CHECK_INTERVAL_MS ตอนแท็บมองเห็นอยู่ + ทันทีเมื่อกลับมาที่แท็บ / เน็ตกลับมา.
// ถ้าผู้ใช้กดปิด toast จะขึ้นอีกครั้งเมื่อกลับมาที่แท็บ. DEV ไม่ทำงาน (ไม่มี hash).
//
// หมายเหตุ deploy: ควรตั้ง Cache-Control ของ index.html บน bucket เป็น `no-cache`
// ไม่งั้น CDN/GCS อาจส่ง index.html เก่าได้นานสูงสุดเท่า max-age (ค่า default 3600s)
// ─────────────────────────────────────────────────────────────────────────────
import { useEffect } from "react"
import { toast } from "../components/ui/toast"

const CHECK_INTERVAL_MS = 60_000
const TOAST_ID = "app-update"
const ENTRY_RE = /assets\/index-[\w-]+\.js/

function currentEntry() {
  for (const s of document.querySelectorAll('script[type="module"][src]')) {
    const m = s.getAttribute("src").match(ENTRY_RE)
    if (m) return m[0]
  }
  return null
}

async function fetchLatestEntry() {
  const url = new URL("./", window.location.href)
  url.hash = ""
  url.searchParams.set("_v", String(Date.now()))
  const res = await fetch(url, { cache: "no-store", credentials: "same-origin" })
  if (!res.ok) return null
  return (await res.text()).match(ENTRY_RE)?.[0] ?? null
}

function showUpdateToast() {
  toast.info("มีเวอร์ชันใหม่ของระบบ", {
    id: TOAST_ID,
    description: "รีเฟรชหน้าเพื่อใช้งานเวอร์ชันล่าสุด — บันทึกข้อมูลที่กรอกค้างไว้ก่อน",
    duration: Infinity,
    action: { label: "รีเฟรชตอนนี้", onClick: () => window.location.reload() },
  })
}

/** Mount ONCE (AppLayout) — polls for a newer deploy and shows a refresh toast. */
export function useAppUpdateCheck() {
  useEffect(() => {
    if (import.meta.env.DEV) return
    const running = currentEntry()
    if (!running) return

    let updateFound = false
    let inFlight = false

    const check = async () => {
      if (document.visibilityState !== "visible" || !navigator.onLine) return
      if (updateFound) {
        showUpdateToast() // re-show after the user closed it
        return
      }
      if (inFlight) return
      inFlight = true
      try {
        const latest = await fetchLatestEntry()
        if (latest && latest !== running) {
          updateFound = true
          showUpdateToast()
        }
      } catch {
        // offline / transient network error — try again next tick
      } finally {
        inFlight = false
      }
    }

    const timer = setInterval(() => {
      if (!updateFound) check()
    }, CHECK_INTERVAL_MS)
    const onVisible = () => {
      if (document.visibilityState === "visible") check()
    }
    document.addEventListener("visibilitychange", onVisible)
    window.addEventListener("online", check)

    return () => {
      clearInterval(timer)
      document.removeEventListener("visibilitychange", onVisible)
      window.removeEventListener("online", check)
    }
  }, [])
}
