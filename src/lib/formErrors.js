// src/lib/formErrors.js
// ─────────────────────────────────────────────────────────────────────────────
// Shared "the form has errors" behaviour: scroll to + focus the first invalid
// field (also inside a scrolling <Sheet> body) and show a short toast summary.
//
//   focusFirstError(["ob-first_name", "ob-gender"])       // ids in any order → first in DOM order
//   reportInvalid({ ids, count: 2 })                       // toast "กรอกข้อมูลไม่ครบ 2 ช่อง" + focus
//   reportInvalid({ ids, title: "บันทึกไม่สำเร็จ", description: msg })
//
// Works with every control that puts `id` on its focusable element: plain
// inputs, SelectDropdown / ComboBox triggers, ThaiDateInput's button,
// PrefixedNameInput (`${id}` = name input, `${id}-prefix` = prefix trigger).
// The scroll target is the field's wrapper ([data-field]) so its label shows too.
// ─────────────────────────────────────────────────────────────────────────────
import { toast } from "../components/ui"

let lastToastId = null

const reducedMotion = () =>
  typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches

/** First element (document order) among `ids`; ids that are not rendered are skipped. */
export function firstInDom(ids = []) {
  const els = ids.map((id) => (id ? document.getElementById(id) : null)).filter(Boolean)
  if (!els.length) return null
  return els.reduce((a, b) => (a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_PRECEDING ? b : a))
}

/** Bring `el` (or its field wrapper) into view and focus it. */
export function focusElement(el) {
  if (!el) return false
  const target = el.closest?.("[data-field]") ?? el
  target.scrollIntoView({ block: "center", behavior: reducedMotion() ? "auto" : "smooth" })
  if (!el.matches?.("input, select, textarea, button, [href], [tabindex]")) el.setAttribute("tabindex", "-1")
  el.focus({ preventScroll: true })
  return true
}

/**
 * Focus the first invalid field among `ids` once React has painted the error
 * state (two frames). `fallbackId` = e.g. the error summary when no field matches.
 */
export function focusFirstError(ids, { fallbackId } = {}) {
  let done = false
  const run = () => {
    if (done) return
    done = true
    if (!focusElement(firstInDom(ids)) && fallbackId) focusElement(document.getElementById(fallbackId))
  }
  requestAnimationFrame(() => requestAnimationFrame(run))
  setTimeout(run, 120) // rAF is paused in background tabs
}

/** Thai summary for `count` invalid fields. */
export const invalidCountTitle = (count) => (count > 0 ? `กรอกข้อมูลไม่ครบ ${count} ช่อง` : "กรอกข้อมูลไม่ถูกต้อง")

/**
 * Toast + focus in one call. `title` defaults to the count summary; one toast at a
 * time (re-submitting replaces the previous one instead of stacking).
 */
export function reportInvalid({ ids = [], count = ids.length, title, description, fallbackId } = {}) {
  // a fresh id each time: reusing one would let the previous toast's timer close the new one
  if (lastToastId) toast.dismiss(lastToastId)
  lastToastId = toast.error(title ?? invalidCountTitle(count), { description })
  focusFirstError(ids, { fallbackId })
}
