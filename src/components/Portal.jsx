// src/components/Portal.jsx
// Renders children into <body> and locks the page scroll while mounted.
//
// Ref-counted: two stacked overlays (Sheet + date-picker Sheet, modal +
// ConfirmDialog) share one lock — the page unlocks only when the LAST one
// unmounts. While locked, body carries `data-sheet-open` (index.css uses it
// for overscroll-behavior) and the scrollbar width is padded so desktop
// content does not shift sideways when the scrollbar disappears.
import { useEffect } from "react"
import { createPortal } from "react-dom"

let locks = 0
let saved = { overflow: "", paddingRight: "" }

function lock() {
  if (locks++ > 0) return
  const body = document.body
  saved = { overflow: body.style.overflow, paddingRight: body.style.paddingRight }
  const gutter = window.innerWidth - document.documentElement.clientWidth
  if (gutter > 0) body.style.paddingRight = `${gutter}px`
  body.style.overflow = "hidden"
  body.dataset.sheetOpen = "1"
}

function unlock() {
  if (--locks > 0) return
  locks = 0
  const body = document.body
  body.style.overflow = saved.overflow
  body.style.paddingRight = saved.paddingRight
  delete body.dataset.sheetOpen
}

export default function Portal({ children }) {
  useEffect(() => {
    lock()
    return unlock
  }, [])
  return createPortal(children, document.body)
}
