// src/components/Portal.jsx
// Renders children into <body> and locks the page scroll while mounted
// (ref-counted lock — see src/lib/scrollLock.js).
import { useEffect } from "react"
import { createPortal } from "react-dom"
import { lockBodyScroll, unlockBodyScroll } from "../lib/scrollLock"

export default function Portal({ children }) {
  useEffect(() => {
    lockBodyScroll()
    return unlockBodyScroll
  }, [])
  return createPortal(children, document.body)
}
