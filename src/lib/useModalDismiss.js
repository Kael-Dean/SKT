// src/lib/useModalDismiss.js
// ─────────────────────────────────────────────────────────────────────────────
// Shared "dismiss" behaviour for every modal / dialog / popup:
//   • Esc closes the TOP-most open modal only (module-level stack, so a
//     ConfirmDialog over a form closes alone).
//   • Clicking the backdrop closes — but only when the press both started and
//     ended on the backdrop itself (dragging a text selection out of an input
//     and releasing over the backdrop does NOT close).
//
//   const { backdropProps } = useModalDismiss(onClose, { open, disabled: saving })
//   <div className="fixed inset-0 …" {...backdropProps}>
//     <div role="dialog" aria-modal="true">…</div>
//   </div>
//
// Esc is ignored when:
//   • `disabled` (submitting / saving) — and it does not fall through to the
//     modal underneath either.
//   • the event was already handled (`e.defaultPrevented`), e.g. an open
//     SelectDropdown / ComboBox inside the modal closes itself first.
//   • the key press is part of an IME composition (Thai input).
// ─────────────────────────────────────────────────────────────────────────────
import { useCallback, useEffect, useLayoutEffect, useRef } from "react"

/** Open modals, bottom → top. Each entry is a unique token per hook instance. */
const stack = []

export default function useModalDismiss(onClose, { open = true, disabled = false } = {}) {
  const closeRef = useRef(onClose)
  const disabledRef = useRef(disabled)
  const pressStartedOnBackdrop = useRef(false)

  // Layout effect: refs are current before the browser can deliver the next key/click.
  useLayoutEffect(() => {
    closeRef.current = onClose
    disabledRef.current = disabled
  })

  useEffect(() => {
    if (!open) return
    const token = {}
    stack.push(token)

    const onKey = (e) => {
      if (e.key !== "Escape" && e.key !== "Esc") return
      if (e.defaultPrevented || e.isComposing || e.keyCode === 229) return
      if (stack[stack.length - 1] !== token) return
      // Top-most modal owns this Esc even while busy (don't leak to the one below).
      e.preventDefault()
      if (disabledRef.current) return
      closeRef.current?.()
    }

    document.addEventListener("keydown", onKey)
    return () => {
      document.removeEventListener("keydown", onKey)
      const i = stack.lastIndexOf(token)
      if (i !== -1) stack.splice(i, 1)
    }
  }, [open])

  const onMouseDown = useCallback((e) => {
    pressStartedOnBackdrop.current = e.target === e.currentTarget
  }, [])

  const onClick = useCallback((e) => {
    const started = pressStartedOnBackdrop.current
    pressStartedOnBackdrop.current = false
    if (!started || e.target !== e.currentTarget) return
    if (disabledRef.current) return
    closeRef.current?.()
  }, [])

  return { backdropProps: { onMouseDown, onClick } }
}
