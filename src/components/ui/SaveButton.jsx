// src/components/ui/SaveButton.jsx
// ─────────────────────────────────────────────────────────────────────────────
// ปุ่มบันทึกที่บอกผลในตัว: idle → (spinner) "กำลังบันทึก…" → (เส้นติ๊ก) "บันทึกแล้ว" → idle
// ทั้งสามหน้าซ้อนกันใน grid cell เดียว ปุ่มจึงกว้างเท่าข้อความที่ยาวที่สุดเสมอ (ไม่กระโดด)
//
//   const save = useSaveStatus()
//   const submit = async () => {
//     if (Object.keys(errs).length) { revealFirstInvalid(formRef); return }
//     save.start()
//     try { await api(...); save.succeed(() => { onSaved(); onClose() }, SHEET_SAVED_MS) }
//     catch { save.fail() }
//   }
//   <SaveButton status={save.status} onClick={submit}>บันทึก</SaveButton>
//
// - succeed(after?, holdMs = 1200): โชว์ "บันทึกแล้ว" holdMs แล้วกลับ idle จากนั้นเรียก after
//   (sheet ที่ปิดหลังบันทึกใช้ SHEET_SAVED_MS ให้เห็นติ๊กแวบหนึ่งก่อนปิด). ถ้า component
//   unmount ก่อนครบเวลา after จะถูกเรียกทันที (ไม่ทิ้ง onSaved)
// - ระหว่าง saving ปุ่ม disabled + aria-busy; ระหว่าง saved ปุ่ม aria-disabled และกดซ้ำไม่ได้
// - ประกาศสถานะผ่าน live region (sr-only) ข้างปุ่ม — position absolute ไม่กินช่องใน grid/flex
// - prefers-reduced-motion: ไม่มี crossfade/draw (ติ๊กโผล่ครบทันที — ดู index.css)
//
// revealFirstInvalid(rootOrRef): หลัง setErrors → เลื่อนไปช่องแรกที่ aria-invalid (หรือข้อความ
//   error id="…-err" ตัวแรก) แล้ว focus + สั่นหนึ่งครั้ง (.animate-ob-shake-a/-b)
// ─────────────────────────────────────────────────────────────────────────────
import { useCallback, useEffect, useRef, useState } from "react"
import { cx, spinnerCls, submitBtnCls } from "../../lib/styles"

export const SAVED_HOLD_MS = 1200
/** sheet ที่ปิดหลังบันทึก: ค้างติ๊กไว้สั้น ๆ พอให้เห็นผล แล้วปิด */
export const SHEET_SAVED_MS = 700

const reducedMotion = () =>
  typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches

// eslint-disable-next-line react-refresh/only-export-components -- hook/helper คู่กับปุ่ม เก็บไว้ไฟล์เดียว
export function useSaveStatus() {
  const [status, setStatus] = useState("idle") // idle | saving | saved
  const timer = useRef(0)
  const pending = useRef(null)

  useEffect(() => () => {
    clearTimeout(timer.current)
    const fn = pending.current
    pending.current = null
    fn?.()
  }, [])

  const start = useCallback(() => {
    clearTimeout(timer.current)
    setStatus("saving")
  }, [])
  const fail = useCallback(() => setStatus("idle"), [])
  const succeed = useCallback((after, holdMs = SAVED_HOLD_MS) => {
    clearTimeout(timer.current)
    pending.current = after || null
    setStatus("saved")
    timer.current = setTimeout(() => {
      const fn = pending.current
      pending.current = null
      setStatus("idle")
      fn?.()
    }, holdMs)
  }, [])

  return { status, saving: status === "saving", saved: status === "saved", start, succeed, fail }
}

function Face({ show, children }) {
  return (
    <span
      aria-hidden={show ? undefined : true}
      className={cx(
        "col-start-1 row-start-1 inline-flex items-center justify-center gap-2 whitespace-nowrap",
        "transition-[opacity,transform] duration-150 ease-[cubic-bezier(0.25,1,0.5,1)]",
        show ? "opacity-100" : "pointer-events-none translate-y-0.5 opacity-0",
      )}
    >
      {children}
    </span>
  )
}

/**
 * @param {{ status?: "idle"|"saving"|"saved", children: import("react").ReactNode,
 *           savingLabel?: string, savedLabel?: string, reserve?: string[], className?: string,
 *           disabled?: boolean, onClick?: Function, type?: "button"|"submit" }} props
 *   reserve = ข้อความ idle อื่นที่ปุ่มอาจแสดง (เช่น "กำลังอัปโหลด…") — จองความกว้างไว้ด้วย
 */
export default function SaveButton({
  status = "idle",
  children,
  savingLabel = "กำลังบันทึก…",
  savedLabel = "บันทึกแล้ว",
  reserve = [],
  className = "",
  disabled = false,
  onClick,
  type = "button",
  ...rest
}) {
  const saving = status === "saving"
  const saved = status === "saved"
  return (
    <>
      <button
        type={type}
        {...rest}
        onClick={(e) => {
          if (status !== "idle") { e.preventDefault(); return }
          onClick?.(e)
        }}
        disabled={disabled || saving}
        aria-disabled={saved || undefined}
        aria-busy={saving || undefined}
        className={cx(submitBtnCls, className, saved && "cursor-default")}
      >
        <span className="grid">
          {reserve.map((r) => (
            <span key={r} aria-hidden="true" className="invisible col-start-1 row-start-1 whitespace-nowrap">{r}</span>
          ))}
          <Face show={!saving && !saved}>{children}</Face>
          <Face show={saving}>
            <span className={cx(spinnerCls, "motion-reduce:animate-none")} aria-hidden="true" />
            {savingLabel}
          </Face>
          <Face show={saved}>
            <svg viewBox="0 0 24 24" className="size-4 shrink-0" fill="none" stroke="currentColor" strokeWidth={2.6}
              strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              {saved && <path className="hr-check-draw" pathLength="1" d="M5 12.5l4.5 4.5L19 7.5" />}
            </svg>
            {savedLabel}
          </Face>
        </span>
      </button>
      <span className="sr-only" role="status" aria-live="polite">
        {saving ? savingLabel : saved ? savedLabel : ""}
      </span>
    </>
  )
}

// ─── invalid field → scroll + focus + shake once ────────────────────────────
function shake(el) {
  if (reducedMotion()) return
  const next = el.classList.contains("animate-ob-shake-a") ? "animate-ob-shake-b" : "animate-ob-shake-a"
  el.classList.remove("animate-ob-shake-a", "animate-ob-shake-b")
  el.classList.add(next)
  const done = () => el.classList.remove(next)
  el.addEventListener("animationend", done, { once: true })
  setTimeout(done, 600) // safety: animationend may never fire (display:none, tab hidden)
}

const FOCUSABLE = "input:not([type=hidden]),textarea,select,button,[tabindex]:not([tabindex='-1'])"

/**
 * Call right after setErrors(errs) in a click/submit handler. Waits a frame for
 * the error state to render, then reveals the first invalid control inside root.
 * @param {Element|{ current: Element|null }|null} root
 */
// eslint-disable-next-line react-refresh/only-export-components -- hook/helper คู่กับปุ่ม เก็บไว้ไฟล์เดียว
export function revealFirstInvalid(root) {
  if (typeof window === "undefined") return
  requestAnimationFrame(() => {
    const scope = (root && "current" in root ? root.current : root) || document
    const hit = scope.querySelector?.('[aria-invalid="true"], [id$="-err"]')
    if (!hit) return
    let control = hit
    if (hit.getAttribute("aria-invalid") !== "true") {
      const byDesc = hit.id && scope.querySelector(`[aria-describedby~="${CSS.escape(hit.id)}"]`)
      control = byDesc || hit.parentElement?.querySelector(FOCUSABLE) || hit
    }
    const rect = control.getBoundingClientRect()
    const inView = rect.top >= 64 && rect.bottom <= window.innerHeight - 96
    control.focus?.({ preventScroll: true })
    if (!inView) control.scrollIntoView({ block: "center", behavior: reducedMotion() ? "auto" : "smooth" })
    setTimeout(() => shake(control), inView ? 0 : 280)
  })
}
