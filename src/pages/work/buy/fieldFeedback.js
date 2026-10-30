// src/pages/work/buy/fieldFeedback.js
// ─────────────────────────────────────────────────────────────────────────────
// Failed-submit feedback shared by Buy + Sales (desktop): bring the first
// invalid field to the middle of the viewport (clear of the sticky Topbar),
// focus it, and shake its field wrapper once.
//
// The shake is a DOM class toggle (animate-ob-shake-a / -b from index.css), not
// React state: the wrapper markup belongs to many section components and the
// effect is fire-and-forget. Toggling a ↔ b restarts it on a repeat failure;
// the class is removed on animationend so React's own className stays intact.
// Reduced motion: smooth scroll becomes instant and index.css drops the shake.
// ─────────────────────────────────────────────────────────────────────────────

const prefersReducedMotion = () => {
  try { return window.matchMedia("(prefers-reduced-motion: reduce)").matches } catch { return false }
}

/** Nearest ancestor (≤3 levels) that holds the field's <label> — the
 *  label + control + helper text block. Falls back to the control itself. */
function fieldWrapperOf(el) {
  let node = el
  for (let i = 0; i < 3 && node?.parentElement; i++) {
    node = node.parentElement
    if (node === document.body) break
    for (const child of node.children) {
      if (child.tagName === "LABEL") return node
    }
  }
  return el
}

/** Restart the one-shot shake on `target`. */
export function shakeOnce(target) {
  if (!target?.classList) return
  const next = target.classList.contains("animate-ob-shake-a") ? "animate-ob-shake-b" : "animate-ob-shake-a"
  target.classList.remove("animate-ob-shake-a", "animate-ob-shake-b")
  target.classList.add(next)
  target.addEventListener("animationend", () => target.classList.remove(next), { once: true })
}

/** Scroll the field to the viewport centre, focus (+select) it, shake its
 *  wrapper. The shake waits a frame so the red error re-render lands first. */
export function revealInvalidField(el, { select = true } = {}) {
  if (!el || typeof el.focus !== "function") return false
  try {
    el.scrollIntoView({ block: "center", behavior: prefersReducedMotion() ? "auto" : "smooth" })
  } catch { /* ignore */ }
  try { el.focus({ preventScroll: true }) } catch { el.focus() }
  if (select) { try { el.select?.() } catch { /* ignore */ } }
  const wrapper = fieldWrapperOf(el)
  requestAnimationFrame(() => shakeOnce(wrapper))
  return true
}
