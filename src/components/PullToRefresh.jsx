// src/components/PullToRefresh.jsx
// ─────────────────────────────────────────────────────────────────────────────
// ดึงหน้าจอลงเพื่อรีเฟรช (แบบแอปทั่วไป) — เปิดเฉพาะตอนเปิดเป็นแอปที่ติดตั้งแล้ว (PWA standalone)
// บนจอสัมผัส: ใน Safari / Chrome แบบแท็บ เบราว์เซอร์มีดึงรีเฟรชของตัวเองอยู่แล้ว ไม่ซ้อนกัน.
// ตอน dev เปิดบนจอสัมผัสทุกแบบ เพื่อทดสอบได้ใน emulator.
//
// เริ่มนับเมื่อ: หน้าอยู่บนสุด · ไม่มี Sheet/modal เปิด (body[data-sheet-open]) · ไม่ได้แตะในช่องกรอก ·
// ไม่ได้แตะในกล่องที่เลื่อนแนวตั้งได้และยังไม่อยู่บนสุด · ลากลงเป็นหลัก (ไม่ใช่ปัดซ้าย/ขวา).
// ปล่อยเมื่อเกินเกณฑ์ → window.location.reload() (ได้ข้อมูลใหม่ + เวอร์ชันแอปล่าสุด).
// หน้าไหนไม่อยากให้ดึงรีเฟรชในบางส่วน ใส่ data-no-ptr ที่ element นั้น.
//
// ไม่ขยับเนื้อหาหน้า (transform บน ancestor จะทำให้ position:fixed ข้างในเพี้ยน) — ขยับแค่ป้ายบอก.
// ─────────────────────────────────────────────────────────────────────────────
import { useEffect, useRef, useState } from "react"
import { ArrowDown, RefreshCw } from "lucide-react"
import { isStandalone } from "../lib/pwa"
import { cx } from "../lib/styles"

const THRESHOLD = 72 // px (หลังหน่วง) ที่ปล่อยแล้วรีเฟรช
const MAX_PULL = 120
const DAMPING = 0.5
const EDITABLE = "input, textarea, select, [contenteditable=''], [contenteditable='true']"

function isEnabled() {
  if (typeof window === "undefined") return false
  const coarse = window.matchMedia?.("(pointer: coarse)")?.matches
  if (!coarse) return false
  return isStandalone() || import.meta.env.DEV
}

// กล่องที่เลื่อนแนวตั้งได้และยังไม่อยู่บนสุด → ปล่อยให้กล่องนั้นเลื่อนเอง
function insideScrolledBox(el) {
  for (let n = el; n && n !== document.body && n !== document.documentElement; n = n.parentElement) {
    if (n.scrollTop > 0) {
      const oy = getComputedStyle(n).overflowY
      if (oy === "auto" || oy === "scroll") return true
    }
  }
  return false
}

export default function PullToRefresh() {
  const [enabled] = useState(isEnabled)
  const [phase, setPhase] = useState("idle") // idle | pulling | armed | refreshing
  const pillRef = useRef(null)
  const iconRef = useRef(null)

  useEffect(() => {
    if (!enabled) return
    let startX = 0
    let startY = 0
    let tracking = false // touchstart ผ่านเงื่อนไข
    let pulling = false // ยืนยันแล้วว่าเป็นการลากลง
    let dist = 0
    let raf = 0
    let current = "idle"
    const reduce = window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches

    const setP = (p) => { if (p !== current) { current = p; setPhase(p) } }

    const paint = () => {
      raf = 0
      const pill = pillRef.current
      if (!pill) return
      const progress = Math.min(dist / THRESHOLD, 1)
      pill.style.transition = "none"
      pill.style.transform = `translate(-50%, ${dist - 56}px)`
      pill.style.opacity = String(Math.min(1, dist / 32))
      if (iconRef.current) iconRef.current.style.transform = `rotate(${progress >= 1 ? 180 : 0}deg)`
    }
    const schedule = () => { if (!raf) raf = requestAnimationFrame(paint) }

    const settle = (to) => {
      const pill = pillRef.current
      if (!pill) return
      pill.style.transition = reduce ? "none" : "transform 300ms cubic-bezier(0.22,1,0.36,1), opacity 200ms ease-out"
      pill.style.transform = `translate(-50%, ${to - 56}px)`
      pill.style.opacity = to > 0 ? "1" : "0"
    }

    const reset = () => {
      tracking = false
      pulling = false
      dist = 0
      if (raf) { cancelAnimationFrame(raf); raf = 0 }
      settle(0)
      setP("idle")
    }

    const onStart = (e) => {
      if (current === "refreshing" || e.touches.length !== 1) return
      tracking = false
      if (window.scrollY > 0 || document.body.dataset.sheetOpen) return
      const t = e.target
      if (!(t instanceof Element)) return
      if (t.closest(EDITABLE) || t.closest("[data-no-ptr]")) return
      if (document.activeElement?.matches?.(EDITABLE)) return
      if (insideScrolledBox(t)) return
      startX = e.touches[0].clientX
      startY = e.touches[0].clientY
      tracking = true
      pulling = false
      dist = 0
    }

    const onMove = (e) => {
      if (!tracking) return
      const dx = e.touches[0].clientX - startX
      const dy = e.touches[0].clientY - startY
      if (!pulling) {
        if (Math.abs(dx) < 6 && Math.abs(dy) < 6) return
        if (dy <= 0 || Math.abs(dx) > Math.abs(dy) || window.scrollY > 0) { tracking = false; return }
        pulling = true
        startY = e.touches[0].clientY // เริ่มนับจากจุดที่ยืนยันว่าลากลง ไม่ให้ป้ายกระตุก
      }
      if (e.cancelable) e.preventDefault() // กัน iOS เด้ง/เลื่อนหน้าระหว่างดึง
      dist = Math.min(MAX_PULL, Math.max(0, (e.touches[0].clientY - startY) * DAMPING))
      setP(dist >= THRESHOLD ? "armed" : "pulling")
      schedule()
    }

    const onEnd = () => {
      if (!tracking) return
      if (pulling && dist >= THRESHOLD) {
        tracking = false
        pulling = false
        setP("refreshing")
        settle(THRESHOLD * 0.75)
        // ให้ป้าย "กำลังรีเฟรช" ขึ้นก่อนค่อยโหลดใหม่
        setTimeout(() => window.location.reload(), 250)
        return
      }
      reset()
    }

    window.addEventListener("touchstart", onStart, { passive: true })
    window.addEventListener("touchmove", onMove, { passive: false })
    window.addEventListener("touchend", onEnd, { passive: true })
    window.addEventListener("touchcancel", reset, { passive: true })
    return () => {
      window.removeEventListener("touchstart", onStart)
      window.removeEventListener("touchmove", onMove)
      window.removeEventListener("touchend", onEnd)
      window.removeEventListener("touchcancel", reset)
      if (raf) cancelAnimationFrame(raf)
    }
  }, [enabled])

  if (!enabled) return null

  const label = phase === "refreshing" ? "กำลังรีเฟรช…" : phase === "armed" ? "ปล่อยเพื่อรีเฟรช" : "ดึงลงเพื่อรีเฟรช"

  return (
    <>
      <div
        ref={pillRef}
        aria-hidden="true"
        className="pointer-events-none fixed left-1/2 z-[9985] flex items-center gap-2 rounded-full bg-white px-3.5 py-2 text-sm font-medium text-gray-700 shadow-md ring-1 ring-gray-200/80 dark:bg-raised dark:text-gray-100 dark:ring-line-strong"
        style={{ top: "var(--topbar-h, 56px)", transform: "translate(-50%, -56px)", opacity: 0 }}
      >
        <span
          ref={iconRef}
          className={cx(
            "grid size-5 place-items-center",
            phase === "armed" || phase === "refreshing" ? "text-indigo-600 dark:text-indigo-300" : "text-gray-500 dark:text-gray-400",
          )}
          style={{ transition: "transform 200ms cubic-bezier(0.22,1,0.36,1)" }}
        >
          {phase === "refreshing" ? (
            <RefreshCw className="size-4 animate-spin motion-reduce:animate-none" strokeWidth={2} />
          ) : (
            <ArrowDown className="size-4" strokeWidth={2} />
          )}
        </span>
        <span>{label}</span>
      </div>
      <span className="sr-only" role="status" aria-live="polite">
        {phase === "refreshing" ? "กำลังรีเฟรชหน้า" : ""}
      </span>
    </>
  )
}
