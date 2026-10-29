// src/lib/scrollLock.js
// Locks the page (body) scroll while an overlay is open.
//
// Ref-counted: two stacked overlays (Sheet + date-picker Sheet, modal +
// ConfirmDialog, sidebar drawer + dialog) share one lock — the page unlocks
// only when the LAST one releases. While locked, body carries
// `data-sheet-open` (index.css uses it for overscroll-behavior) and the
// scrollbar width is padded so desktop content does not shift sideways when
// the scrollbar disappears.

let locks = 0
let saved = { overflow: "", paddingRight: "" }

export function lockBodyScroll() {
  if (locks++ > 0) return
  const body = document.body
  saved = { overflow: body.style.overflow, paddingRight: body.style.paddingRight }
  const gutter = window.innerWidth - document.documentElement.clientWidth
  if (gutter > 0) body.style.paddingRight = `${gutter}px`
  body.style.overflow = "hidden"
  body.dataset.sheetOpen = "1"
}

export function unlockBodyScroll() {
  if (--locks > 0) return
  locks = 0
  const body = document.body
  body.style.overflow = saved.overflow
  body.style.paddingRight = saved.paddingRight
  delete body.dataset.sheetOpen
}
