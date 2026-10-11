// src/lib/useFocusTrap.js
// ─────────────────────────────────────────────────────────────────────────────
// Focus management for dialogs / sheets — lifted from HrModal.jsx so every
// modal surface (Sheet, ResultSheet, …) behaves the same:
//   • on activate: focus the first match of `initialSelector` inside the panel
//     (default: [data-autofocus], then the first field/button); pass `null`
//     to focus the panel itself (phones: keeps the keyboard closed until the
//     user taps a field)
//   • Tab / Shift+Tab wrap inside the panel (aria-modal)
//   • on deactivate: focus returns to the element that was focused before
//
//   const panelRef = useRef(null)
//   useFocusTrap(panelRef, { active: open, initialSelector: null })
//   <div ref={panelRef} role="dialog" aria-modal="true" tabIndex={-1}>…</div>
//
// Focus inside a *portaled* child (ComboBox/SelectDropdown listbox lives on
// <body>) is left alone — that popover manages its own focus and returns it.
// ─────────────────────────────────────────────────────────────────────────────
import { useEffect } from "react"

export const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), ' +
  'textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'

const DEFAULT_INITIAL =
  "[data-autofocus], input:not([disabled]):not([type=hidden]), select:not([disabled]), " +
  "textarea:not([disabled]), button:not([disabled])"

const isVisible = (n) => n.offsetParent !== null || n === document.activeElement

export default function useFocusTrap(panelRef, { active = true, initialSelector, restoreFocus = true } = {}) {
  useEffect(() => {
    if (!active) return
    const panel = panelRef.current
    if (!panel) return

    const opener = document.activeElement
    const selector = initialSelector === undefined ? DEFAULT_INITIAL : initialSelector
    const first = selector ? panel.querySelector(selector) : null
    ;(first || panel).focus({ preventScroll: true })

    const onKey = (e) => {
      if (e.key !== "Tab" || e.defaultPrevented) return
      const nodes = [...panel.querySelectorAll(FOCUSABLE)].filter(isVisible)
      const current = document.activeElement
      if (nodes.length === 0) {
        e.preventDefault()
        panel.focus({ preventScroll: true })
        return
      }
      const firstNode = nodes[0]
      const lastNode = nodes[nodes.length - 1]
      if (!panel.contains(current)) {
        // Focus is on <body> (lost) → pull it back in; inside a portaled
        // popover → leave it to that popover.
        if (!current || current === document.body) {
          e.preventDefault()
          ;(e.shiftKey ? lastNode : firstNode).focus()
        }
        return
      }
      if (e.shiftKey && (current === firstNode || current === panel)) {
        e.preventDefault()
        lastNode.focus()
      } else if (!e.shiftKey && current === lastNode) {
        e.preventDefault()
        firstNode.focus()
      }
    }
    document.addEventListener("keydown", onKey)
    return () => {
      document.removeEventListener("keydown", onKey)
      if (restoreFocus && opener && typeof opener.focus === "function" && document.contains(opener)) {
        opener.focus({ preventScroll: true })
      }
    }
  }, [active, panelRef, initialSelector, restoreFocus])
}
