// TableScrollButtons.jsx
// Drag/swipe เลื่อนตาราง - ติดหน้าจอด้านบน (sticky)

import { useEffect, useRef } from "react"

export default function TableScrollButtons({ tableRef, isVisible = true }) {
  const startXRef = useRef(0)
  const isDraggingRef = useRef(false)

  useEffect(() => {
    if (!isVisible || !tableRef?.current) return

    const table = tableRef.current
    let startX = 0
    let scrollStartLeft = 0

    const handleMouseDown = (e) => {
      isDraggingRef.current = true
      startXRef.current = e.clientX
      scrollStartLeft = table.scrollLeft
      e.preventDefault()
    }

    const handleMouseMove = (e) => {
      if (!isDraggingRef.current) return
      const deltaX = e.clientX - startXRef.current
      table.scrollLeft = scrollStartLeft - deltaX
    }

    const handleMouseUp = () => {
      isDraggingRef.current = false
    }

    // Touch support
    const handleTouchStart = (e) => {
      isDraggingRef.current = true
      startXRef.current = e.touches[0]?.clientX || 0
      scrollStartLeft = table.scrollLeft
    }

    const handleTouchMove = (e) => {
      if (!isDraggingRef.current) return
      const deltaX = e.touches[0]?.clientX || 0 - startXRef.current
      table.scrollLeft = scrollStartLeft - deltaX
    }

    const handleTouchEnd = () => {
      isDraggingRef.current = false
    }

    table.addEventListener("mousedown", handleMouseDown)
    document.addEventListener("mousemove", handleMouseMove)
    document.addEventListener("mouseup", handleMouseUp)
    table.addEventListener("touchstart", handleTouchStart)
    document.addEventListener("touchmove", handleTouchMove)
    document.addEventListener("touchend", handleTouchEnd)

    return () => {
      table.removeEventListener("mousedown", handleMouseDown)
      document.removeEventListener("mousemove", handleMouseMove)
      document.removeEventListener("mouseup", handleMouseUp)
      table.removeEventListener("touchstart", handleTouchStart)
      document.removeEventListener("touchmove", handleTouchMove)
      document.removeEventListener("touchend", handleTouchEnd)
    }
  }, [tableRef, isVisible])

  if (!isVisible) return null

  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 flex items-center justify-center bg-white dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700 py-2 px-4">
      <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
        <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
          <path d="M15 19l-7-7 7-7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" fill="none" />
        </svg>
        <span className="hidden sm:inline">ลากซ้ายขวาเพื่อเลื่อนตาราง</span>
        <span className="sm:hidden">ลากเพื่อเลื่อน</span>
        <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
          <path d="M9 5l7 7-7 7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" fill="none" />
        </svg>
      </div>
    </div>
  )
}
