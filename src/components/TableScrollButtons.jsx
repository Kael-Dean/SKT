// TableScrollButtons.jsx
// ปุ่มเลื่อนซ้ายขวาสำหรับตาราง - ติดหน้าจอด้านล่าง

import { useEffect, useRef, useState } from "react"

export default function TableScrollButtons({ tableRef, isVisible = true }) {
  const [canScrollLeft, setCanScrollLeft] = useState(false)
  const [canScrollRight, setCanScrollRight] = useState(false)
  const checkTimeoutRef = useRef(null)

  const checkScroll = () => {
    if (!tableRef?.current) return
    const el = tableRef.current
    setCanScrollLeft(el.scrollLeft > 0)
    setCanScrollRight(el.scrollLeft < el.scrollWidth - el.clientWidth - 10)
  }

  useEffect(() => {
    checkScroll()
    const table = tableRef?.current
    if (!table) return

    table.addEventListener("scroll", checkScroll)
    window.addEventListener("resize", checkScroll)

    return () => {
      table.removeEventListener("scroll", checkScroll)
      window.removeEventListener("resize", checkScroll)
      if (checkTimeoutRef.current) clearTimeout(checkTimeoutRef.current)
    }
  }, [tableRef])

  const scroll = (direction) => {
    if (!tableRef?.current) return
    const el = tableRef.current
    const distance = 300
    const duration = 300

    const startPos = el.scrollLeft
    const endPos = direction === "left" ? startPos - distance : startPos + distance
    const startTime = performance.now()

    const animate = (now) => {
      const elapsed = now - startTime
      const progress = Math.min(elapsed / duration, 1)
      el.scrollLeft = startPos + (endPos - startPos) * progress

      if (progress < 1) {
        requestAnimationFrame(animate)
      } else {
        checkScroll()
      }
    }

    requestAnimationFrame(animate)
  }

  if (!isVisible) return null

  return (
    <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-40 flex gap-3 bg-white dark:bg-gray-800 rounded-2xl shadow-lg p-2 border border-gray-200 dark:border-gray-700">
      <button
        onClick={() => scroll("left")}
        disabled={!canScrollLeft}
        className={`p-3 rounded-xl transition-all duration-200 ${
          canScrollLeft
            ? "bg-indigo-500 hover:bg-indigo-600 text-white cursor-pointer hover:scale-110"
            : "bg-gray-200 dark:bg-gray-700 text-gray-400 cursor-not-allowed"
        }`}
        title="เลื่อนซ้าย"
        aria-label="เลื่อนซ้าย"
      >
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
        </svg>
      </button>

      <button
        onClick={() => scroll("right")}
        disabled={!canScrollRight}
        className={`p-3 rounded-xl transition-all duration-200 ${
          canScrollRight
            ? "bg-indigo-500 hover:bg-indigo-600 text-white cursor-pointer hover:scale-110"
            : "bg-gray-200 dark:bg-gray-700 text-gray-400 cursor-not-allowed"
        }`}
        title="เลื่อนขวา"
        aria-label="เลื่อนขวา"
      >
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
        </svg>
      </button>
    </div>
  )
}
