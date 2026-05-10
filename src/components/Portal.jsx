import { useEffect } from "react"
import { createPortal } from "react-dom"

export default function Portal({ children }) {
  useEffect(() => {
    const prev = document.body.style.overflow
    document.body.style.overflow = "hidden"
    return () => { document.body.style.overflow = prev }
  }, [])
  return createPortal(children, document.body)
}
