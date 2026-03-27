// TableScrollButtons.jsx
// แถบเลื่อนแนวนอนแบบ custom ติดด้านล่างหน้าจอ

import { useEffect, useRef, useState } from "react"

export default function TableScrollButtons({ tableRef, isVisible = true }) {
  const [scrollLeft, setScrollLeft] = useState(0)
  const [scrollWidth, setScrollWidth] = useState(0)
  const [clientWidth, setClientWidth] = useState(0)
  const scrollBarRef = useRef(null)
  const thumbRef = useRef(null)
  const isDraggingRef = useRef(false)

  useEffect(() => {
    if (!isVisible || !tableRef?.current) return

    const table = tableRef.current

    const updateScrollBar = () => {
      setScrollLeft(table.scrollLeft)
      setScrollWidth(table.scrollWidth)
      setClientWidth(table.clientWidth)
    }

    table.addEventListener("scroll", updateScrollBar)
    window.addEventListener("resize", updateScrollBar)
    updateScrollBar()

    return () => {
      table.removeEventListener("scroll", updateScrollBar)
      window.removeEventListener("resize", updateScrollBar)
    }
  }, [tableRef, isVisible])

  const handleThumbMouseDown = (e) => {
    isDraggingRef.current = true
    e.preventDefault()
  }

  useEffect(() => {
    if (!isDraggingRef.current) return

    const handleMouseMove = (e) => {
      if (!tableRef?.current || !scrollBarRef.current) return

      const scrollBarRect = scrollBarRef.current.getBoundingClientRect()
      const thumbWidth = (clientWidth / scrollWidth) * scrollBarRect.width
      const maxThumbLeft = scrollBarRect.width - thumbWidth

      const mouseX = e.clientX - scrollBarRect.left
      const newThumbLeft = Math.max(0, Math.min(mouseX - thumbWidth / 2, maxThumbLeft))
      const scrollPercentage = newThumbLeft / maxThumbLeft

      tableRef.current.scrollLeft = scrollPercentage * (scrollWidth - clientWidth)
    }

    const handleMouseUp = () => {
      isDraggingRef.current = false
    }

    document.addEventListener("mousemove", handleMouseMove)
    document.addEventListener("mouseup", handleMouseUp)

    return () => {
      document.removeEventListener("mousemove", handleMouseMove)
      document.removeEventListener("mouseup", handleMouseUp)
    }
  }, [tableRef, scrollWidth, clientWidth])

  if (!isVisible || scrollWidth <= clientWidth) return null

  const thumbWidth = (clientWidth / scrollWidth) * 100
  const thumbLeft = (scrollLeft / (scrollWidth - clientWidth)) * (100 - thumbWidth)

  return (
    <div className="fixed bottom-0 left-0 right-0 z-40 bg-white dark:bg-slate-800 border-t border-slate-200 dark:border-slate-700 py-3 px-4 pointer-events-auto">
      <div
        ref={scrollBarRef}
        className="w-full h-2.5 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden cursor-pointer"
      >
        <div
          ref={thumbRef}
          onMouseDown={handleThumbMouseDown}
          style={{
            width: `${thumbWidth}%`,
            left: `${thumbLeft}%`,
            transform: "translateX(-50%)",
            cursor: isDraggingRef.current ? "grabbing" : "grab",
          }}
          className="h-full bg-purple-500 hover:bg-purple-600 rounded-full transition-colors"
        />
      </div>
    </div>
  )
}
