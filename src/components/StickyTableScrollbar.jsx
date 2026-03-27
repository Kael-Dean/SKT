import { useEffect, useRef, useCallback, useState } from "react"
import ReactDOM from "react-dom"

const STEP = 150
const REPEAT_DELAY = 400
const REPEAT_INTERVAL = 80

export default function StickyTableScrollbar({ tableRef }) {
  const trackRef = useRef(null)
  const thumbRef = useRef(null)
  const rafRef = useRef(null)
  const repeatTimerRef = useRef(null)

  const [visible, setVisible] = useState(false)
  const [thumbStyle, setThumbStyle] = useState({ left: 0, width: 0 })
  const [trackPos, setTrackPos] = useState({ left: 0, right: 0 })

  // คำนวณ position ของตาราง → ตั้ง left/right ของ scrollbar bar
  const syncPos = useCallback(() => {
    const el = tableRef?.current
    if (!el) return
    const rect = el.getBoundingClientRect()
    setTrackPos({ left: rect.left, right: window.innerWidth - rect.right })
  }, [tableRef])

  // คำนวณ thumb — แยก visible check ออกมา ไม่ต้องพึ่ง trackRef
  const syncThumb = useCallback(() => {
    const el = tableRef?.current
    if (!el) return

    syncPos()

    const { scrollLeft, scrollWidth, clientWidth } = el

    if (scrollWidth <= clientWidth) {
      setVisible(false)
      return
    }
    setVisible(true)

    requestAnimationFrame(() => {
      const track = trackRef.current
      if (!track) return
      const trackW = track.clientWidth - 64
      const ratio = clientWidth / scrollWidth
      const thumbW = Math.max(32, trackW * ratio)
      const maxScroll = scrollWidth - clientWidth
      const maxThumbLeft = trackW - thumbW
      const thumbLeft = maxScroll > 0 ? (scrollLeft / maxScroll) * maxThumbLeft : 0
      setThumbStyle({ left: thumbLeft, width: thumbW })
    })
  }, [tableRef, syncPos])

  const scrollBy = useCallback((delta) => {
    const el = tableRef?.current
    if (!el) return
    el.scrollLeft = Math.max(0, Math.min(el.scrollLeft + delta, el.scrollWidth - el.clientWidth))
    syncThumb()
  }, [tableRef, syncThumb])

  // ฟัง scroll event จากตาราง
  useEffect(() => {
    const el = tableRef?.current
    if (!el) return
    const onScroll = () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current)
      rafRef.current = requestAnimationFrame(syncThumb)
    }
    el.addEventListener("scroll", onScroll, { passive: true })
    syncThumb()
    return () => {
      el.removeEventListener("scroll", onScroll)
      if (rafRef.current) cancelAnimationFrame(rafRef.current)
    }
  }, [tableRef, syncThumb])

  // ResizeObserver — observe ทั้ง container และ table ข้างใน
  useEffect(() => {
    const el = tableRef?.current
    if (!el) return
    const ro = new ResizeObserver(syncThumb)
    ro.observe(el)
    const table = el.querySelector("table")
    if (table) ro.observe(table)
    return () => ro.disconnect()
  }, [tableRef, syncThumb])

  // MutationObserver — ดักจับเมื่อ DOM เปลี่ยน (rows/columns โหลดจาก API)
  useEffect(() => {
    const el = tableRef?.current
    if (!el) return
    const mo = new MutationObserver(syncThumb)
    mo.observe(el, { childList: true, subtree: true, attributes: false })
    return () => mo.disconnect()
  }, [tableRef, syncThumb])

  // อัปเดต position เมื่อ window scroll หรือ resize
  useEffect(() => {
    window.addEventListener("scroll", syncPos, { passive: true })
    window.addEventListener("resize", syncPos, { passive: true })
    return () => {
      window.removeEventListener("scroll", syncPos)
      window.removeEventListener("resize", syncPos)
    }
  }, [syncPos])

  // Drag thumb (mouse)
  useEffect(() => {
    const thumb = thumbRef.current
    const track = trackRef.current
    if (!thumb || !track) return

    let startX = 0
    let startScrollLeft = 0

    const onMouseMove = (e) => {
      const el = tableRef?.current
      if (!el) return
      const trackW = track.clientWidth - 64
      const thumbW = thumb.offsetWidth
      const maxThumbLeft = trackW - thumbW
      const dx = e.clientX - startX
      const ratio = dx / maxThumbLeft
      const maxScroll = el.scrollWidth - el.clientWidth
      el.scrollLeft = Math.max(0, Math.min(startScrollLeft + ratio * maxScroll, maxScroll))
    }

    const onMouseUp = () => {
      window.removeEventListener("mousemove", onMouseMove)
      window.removeEventListener("mouseup", onMouseUp)
      document.body.style.userSelect = ""
    }

    const onMouseDown = (e) => {
      e.preventDefault()
      startX = e.clientX
      startScrollLeft = tableRef?.current?.scrollLeft ?? 0
      document.body.style.userSelect = "none"
      window.addEventListener("mousemove", onMouseMove)
      window.addEventListener("mouseup", onMouseUp)
    }

    thumb.addEventListener("mousedown", onMouseDown)
    return () => thumb.removeEventListener("mousedown", onMouseDown)
  }, [tableRef, thumbStyle])

  // Touch drag thumb
  useEffect(() => {
    const thumb = thumbRef.current
    const track = trackRef.current
    if (!thumb || !track) return

    let startX = 0
    let startScrollLeft = 0

    const onTouchMove = (e) => {
      const el = tableRef?.current
      if (!el) return
      const trackW = track.clientWidth - 64
      const thumbW = thumb.offsetWidth
      const maxThumbLeft = trackW - thumbW
      const dx = e.touches[0].clientX - startX
      const ratio = dx / maxThumbLeft
      const maxScroll = el.scrollWidth - el.clientWidth
      el.scrollLeft = Math.max(0, Math.min(startScrollLeft + ratio * maxScroll, maxScroll))
    }

    const onTouchEnd = () => {
      window.removeEventListener("touchmove", onTouchMove)
      window.removeEventListener("touchend", onTouchEnd)
    }

    const onTouchStart = (e) => {
      startX = e.touches[0].clientX
      startScrollLeft = tableRef?.current?.scrollLeft ?? 0
      window.addEventListener("touchmove", onTouchMove, { passive: true })
      window.addEventListener("touchend", onTouchEnd)
    }

    thumb.addEventListener("touchstart", onTouchStart, { passive: true })
    return () => thumb.removeEventListener("touchstart", onTouchStart)
  }, [tableRef, thumbStyle])

  // คลิก track (นอก thumb) → jump scroll
  const onTrackClick = useCallback((e) => {
    const track = trackRef.current
    const thumb = thumbRef.current
    const el = tableRef?.current
    if (!track || !thumb || !el) return
    const trackRect = track.getBoundingClientRect()
    const clickX = e.clientX - trackRect.left - 32
    const trackW = track.clientWidth - 64
    const thumbW = thumb.offsetWidth
    const thumbLeft = parseFloat(thumb.style.left || 0)
    if (clickX < thumbLeft || clickX > thumbLeft + thumbW) {
      const ratio = (clickX - thumbW / 2) / (trackW - thumbW)
      const maxScroll = el.scrollWidth - el.clientWidth
      el.scrollLeft = Math.max(0, Math.min(ratio * maxScroll, maxScroll))
    }
  }, [tableRef])

  // ปุ่ม press & hold
  const startRepeat = useCallback((delta) => {
    scrollBy(delta)
    repeatTimerRef.current = setTimeout(() => {
      repeatTimerRef.current = setInterval(() => scrollBy(delta), REPEAT_INTERVAL)
    }, REPEAT_DELAY)
  }, [scrollBy])

  const stopRepeat = useCallback(() => {
    clearTimeout(repeatTimerRef.current)
    clearInterval(repeatTimerRef.current)
  }, [])

  useEffect(() => () => stopRepeat(), [stopRepeat])

  if (!visible) return null

  return ReactDOM.createPortal(
    <div
      ref={trackRef}
      onClick={onTrackClick}
      style={{ left: trackPos.left, right: trackPos.right, bottom: 0 }}
      className="fixed z-[9998] flex items-center h-7 bg-slate-100/95 dark:bg-slate-800/95 border-t border-slate-200 dark:border-slate-700 backdrop-blur-sm select-none"
    >
      {/* ปุ่ม ← */}
      <button
        type="button"
        onMouseDown={() => startRepeat(-STEP)}
        onMouseUp={stopRepeat}
        onMouseLeave={stopRepeat}
        onTouchStart={() => startRepeat(-STEP)}
        onTouchEnd={stopRepeat}
        className="flex-shrink-0 w-8 h-full flex items-center justify-center text-slate-500 hover:text-slate-700 hover:bg-slate-200 dark:text-slate-400 dark:hover:text-slate-200 dark:hover:bg-slate-700 transition-colors cursor-pointer"
        aria-label="เลื่อนซ้าย"
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="15 18 9 12 15 6" />
        </svg>
      </button>

      {/* Track */}
      <div className="relative flex-1 h-3 mx-0.5">
        <div className="absolute inset-0 rounded-full bg-slate-200 dark:bg-slate-700" />
        <div
          ref={thumbRef}
          style={{ left: thumbStyle.left, width: thumbStyle.width }}
          className="absolute top-0 h-full rounded-full bg-slate-400 hover:bg-slate-500 dark:bg-slate-500 dark:hover:bg-slate-400 cursor-grab active:cursor-grabbing transition-colors"
        />
      </div>

      {/* ปุ่ม → */}
      <button
        type="button"
        onMouseDown={() => startRepeat(STEP)}
        onMouseUp={stopRepeat}
        onMouseLeave={stopRepeat}
        onTouchStart={() => startRepeat(STEP)}
        onTouchEnd={stopRepeat}
        className="flex-shrink-0 w-8 h-full flex items-center justify-center text-slate-500 hover:text-slate-700 hover:bg-slate-200 dark:text-slate-400 dark:hover:text-slate-200 dark:hover:bg-slate-700 transition-colors cursor-pointer"
        aria-label="เลื่อนขวา"
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="9 18 15 12 9 6" />
        </svg>
      </button>
    </div>,
    document.body
  )
}
