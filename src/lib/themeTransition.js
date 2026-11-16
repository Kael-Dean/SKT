// src/lib/themeTransition.js
// ─────────────────────────────────────────────────────────────────────────────
// สลับโหมดมืด/สว่างแบบ "วงกลมจากปุ่ม" (View Transitions API)
//   → มืด:   วงกลมสีมืดขยายออกจากปุ่ม เริ่มช้าแล้วเร่ง จนเต็มจอ
//   → สว่าง: วงกลมสีมืดหดกลับเข้าปุ่ม
//
//   onClick={(e) => switchTheme(setDarkMode, e.currentTarget)}
//
// • เบราว์เซอร์ที่ไม่รองรับ / ผู้ใช้ตั้ง prefers-reduced-motion → สลับทันที
// • กดซ้ำระหว่างเล่น → transition เดิมถูกข้าม แล้วเริ่มอันใหม่จากสถานะปัจจุบัน
// • CSS คู่กันอยู่ที่ index.css (html[data-theme-transition])
// ─────────────────────────────────────────────────────────────────────────────
import { flushSync } from "react-dom"

const DURATION = 650
const EASE_IN = "cubic-bezier(0.7, 0, 0.84, 0)" // ขยาย: ช้า → เร่ง (คล้าย exponential)
const EASE_OUT = "cubic-bezier(0.16, 1, 0.3, 1)" // หด: เร็ว → ค่อย ๆ จบที่ปุ่ม

// เป้าหมายที่ยังไม่ถูก apply (กดซ้ำเร็ว ๆ ก่อน callback ของ transition ก่อนหน้าจะทำงาน)
// callback ของ transition ที่ถูกข้ามอาจรันไม่เรียงลำดับ → ทุก callback apply "เป้าหมายล่าสุด" เสมอ
let latestDark = false
let inflight = 0

export function switchTheme(setDarkMode, originEl) {
  const root = document.documentElement
  const next = !(inflight ? latestDark : root.classList.contains("dark"))
  latestDark = next
  const apply = () => {
    root.classList.toggle("dark", latestDark)
    flushSync(() => setDarkMode(latestDark))
  }

  const reduce = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches
  if (typeof document.startViewTransition !== "function" || reduce) {
    apply()
    return
  }

  const target = originEl?.querySelector?.("svg") ?? originEl
  const r = target?.getBoundingClientRect?.()
  const w = window.innerWidth
  const h = window.innerHeight
  const x = r ? r.left + r.width / 2 : w / 2
  const y = r ? r.top + r.height / 2 : 0
  const radius = Math.hypot(Math.max(x, w - x), Math.max(y, h - y))

  root.dataset.themeTransition = next ? "to-dark" : "to-light"
  inflight++
  const vt = document.startViewTransition(apply)
  let clip = null

  vt.ready
    .then(() => {
      const small = `circle(0px at ${x}px ${y}px)`
      const big = `circle(${radius}px at ${x}px ${y}px)`
      clip = root.animate(
        { clipPath: next ? [small, big] : [big, small] },
        {
          duration: DURATION,
          easing: next ? EASE_IN : EASE_OUT,
          // ต้องค้างที่เฟรมสุดท้าย: ไม่งั้นเฟรมก่อน transition ถูกรื้อ clip-path หลุด
          // → ภาพเก่า (มืด) ที่อยู่ชั้นบนตอนสลับเป็นสว่างโผล่เต็มจอ = จอกระพริบ
          fill: "forwards",
          pseudoElement: next ? "::view-transition-new(root)" : "::view-transition-old(root)",
        },
      )
    })
    .catch(() => {})

  vt.finished.catch(() => {}).finally(() => {
    inflight--
    clip?.cancel()
    // transition ใหม่ที่เริ่มทับอาจตั้งค่าไว้แล้ว — ลบเฉพาะของรอบนี้
    if (root.dataset.themeTransition === (next ? "to-dark" : "to-light")) delete root.dataset.themeTransition
  })
}
