// src/lib/useAnchoredPanel.js
// ─────────────────────────────────────────────────────────────────────────────
// Positions a *portaled* popover panel (position: fixed on <body>) relative to
// its trigger — lifted from SelectDropdown.jsx so SelectDropdown, ComboBox,
// SearchField and ThaiDatePicker all flip/clamp the same way.
//
//   const { rect, openUp, style, reposition } =
//     useAnchoredPanel(triggerRef, { open, maxH: 288, minW: 288, maxW: 512 })
//   <div style={{ ...style, zIndex: 10050 }} className="…">
//
//   rect   { left, top, width, openUp, maxHeight }   — top = trigger edge used
//   style  { position:'fixed', left, width, maxHeight, top | bottom }
//
// • flips above the trigger when there is more room there than below
// • clamps to the viewport with an 8px edge, width ∈ [minW, maxW]
// • repositions on scroll (capture, so inner scrollers count) and resize
//   while `open`. Nothing is measured while closed.
// ─────────────────────────────────────────────────────────────────────────────
import { useCallback, useEffect, useLayoutEffect, useState } from "react"

const EMPTY = { left: 0, top: 0, width: 0, openUp: false, maxHeight: 288 }

export default function useAnchoredPanel(
  triggerRef,
  { open = false, maxH = 288, minW = 288, maxW = 512, gap = 6, edge = 8 } = {},
) {
  const [rect, setRect] = useState(EMPTY)

  const reposition = useCallback(() => {
    const el = triggerRef.current
    if (!el) return
    const r = el.getBoundingClientRect()
    const vw = window.innerWidth
    const vh = window.innerHeight
    const width = Math.min(Math.max(r.width, minW), maxW, vw - edge * 2)
    const left = Math.max(edge, Math.min(r.left, vw - width - edge))
    const spaceBelow = vh - r.bottom
    const spaceAbove = r.top
    const openUp = spaceBelow < maxH + gap && spaceAbove > spaceBelow
    const room = (openUp ? spaceAbove : spaceBelow) - gap - edge
    const maxHeight = Math.max(120, Math.min(maxH, room))
    setRect((prev) => {
      const next = { left, top: openUp ? r.top : r.bottom, width, openUp, maxHeight }
      return prev.left === next.left && prev.top === next.top && prev.width === next.width &&
        prev.openUp === next.openUp && prev.maxHeight === next.maxHeight
        ? prev
        : next
    })
  }, [triggerRef, maxH, minW, maxW, gap, edge])

  // Measure before paint so the panel never flashes at (0,0).
  useLayoutEffect(() => {
    if (open) reposition()
  }, [open, reposition])

  // Stay glued to the trigger while the page / an inner container scrolls.
  useEffect(() => {
    if (!open) return
    const handle = () => reposition()
    window.addEventListener("scroll", handle, true)
    window.addEventListener("resize", handle)
    window.visualViewport?.addEventListener("resize", handle)
    return () => {
      window.removeEventListener("scroll", handle, true)
      window.removeEventListener("resize", handle)
      window.visualViewport?.removeEventListener("resize", handle)
    }
  }, [open, reposition])

  const style = {
    position: "fixed",
    left: rect.left,
    width: rect.width,
    maxHeight: rect.maxHeight,
    ...(rect.openUp
      ? { bottom: (typeof window !== "undefined" ? window.innerHeight : 0) - rect.top + gap }
      : { top: rect.top + gap }),
  }

  return { rect, openUp: rect.openUp, style, reposition }
}
