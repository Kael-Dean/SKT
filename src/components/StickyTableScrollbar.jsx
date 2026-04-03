import { useEffect, useRef, useCallback, useState } from "react"
import ReactDOM from "react-dom"

const H_H = 28    // horizontal bar height (px)
const V_W = 20    // vertical bar width (px)
const BTN_H = 28  // arrow button height for V bar
const BTN_W = 32  // arrow button width for H bar
const STEP = 200
const REPEAT_DELAY = 400
const REPEAT_INTERVAL = 60

export default function StickyTableScrollbar({ tableRef }) {
  // ─── Container position (relative to viewport) ───
  const [pos, setPos] = useState({ left: 0, right: 0, top: 0, bottom: 0 })

  // ─── Horizontal ───
  const hTrackRef = useRef(null)
  const hThumbRef = useRef(null)
  const [hVis, setHVis] = useState(false)
  const [hThumb, setHThumb] = useState({ left: 0, width: 0 })

  // ─── Vertical ───
  const vTrackRef = useRef(null)
  const vThumbRef = useRef(null)
  const [vVis, setVVis] = useState(false)
  const [vThumb, setVThumb] = useState({ top: 0, height: 0 })

  const rafRef = useRef(null)
  const repeatRef = useRef(null)

  // ─── Sync container position ───
  const syncPos = useCallback(() => {
    const el = tableRef?.current
    if (!el) return
    const r = el.getBoundingClientRect()
    setPos({
      left: r.left,
      right: window.innerWidth - r.right,
      top: r.top,
      bottom: window.innerHeight - r.bottom,
    })
  }, [tableRef])

  // ─── Sync thumb positions ───
  const sync = useCallback(() => {
    const el = tableRef?.current
    if (!el) return
    syncPos()

    const { scrollLeft, scrollWidth, clientWidth, scrollTop, scrollHeight, clientHeight } = el
    const hasH = scrollWidth > clientWidth + 1
    const hasV = scrollHeight > clientHeight + 1

    setHVis(hasH)
    setVVis(hasV)

    if (hasH) {
      requestAnimationFrame(() => {
        const track = hTrackRef.current
        if (!track) return
        const aw = Math.max(1, track.clientWidth - BTN_W * 2)
        const tw = Math.max(28, aw * (clientWidth / scrollWidth))
        const maxS = scrollWidth - clientWidth
        const pct = maxS > 0 ? scrollLeft / maxS : 0
        setHThumb({ left: pct * (aw - tw), width: tw })
      })
    }

    if (hasV) {
      requestAnimationFrame(() => {
        const track = vTrackRef.current
        if (!track) return
        const ah = Math.max(1, track.clientHeight - BTN_H * 2)
        const th = Math.max(28, ah * (clientHeight / scrollHeight))
        const maxS = scrollHeight - clientHeight
        const pct = maxS > 0 ? scrollTop / maxS : 0
        setVThumb({ top: pct * (ah - th), height: th })
      })
    }
  }, [tableRef, syncPos])

  // ─── Hide native scrollbars when custom ones are active ───
  useEffect(() => {
    const el = tableRef?.current
    if (!el) return
    if (hVis || vVis) {
      el.classList.add("_scsb-hide")
    } else {
      el.classList.remove("_scsb-hide")
    }
  }, [tableRef, hVis, vVis])

  // ─── Listen scroll ───
  useEffect(() => {
    const el = tableRef?.current
    if (!el) return
    const onScroll = () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current)
      rafRef.current = requestAnimationFrame(sync)
    }
    el.addEventListener("scroll", onScroll, { passive: true })
    sync()
    return () => {
      el.removeEventListener("scroll", onScroll)
      if (rafRef.current) cancelAnimationFrame(rafRef.current)
    }
  }, [tableRef, sync])

  // ─── ResizeObserver ───
  useEffect(() => {
    const el = tableRef?.current
    if (!el) return
    const ro = new ResizeObserver(sync)
    ro.observe(el)
    const tbl = el.querySelector("table")
    if (tbl) ro.observe(tbl)
    return () => ro.disconnect()
  }, [tableRef, sync])

  // ─── MutationObserver ───
  useEffect(() => {
    const el = tableRef?.current
    if (!el) return
    const mo = new MutationObserver(sync)
    mo.observe(el, { childList: true, subtree: true, attributes: false })
    return () => mo.disconnect()
  }, [tableRef, sync])

  // ─── Window events ───
  useEffect(() => {
    window.addEventListener("scroll", syncPos, { passive: true })
    window.addEventListener("resize", sync, { passive: true })
    return () => {
      window.removeEventListener("scroll", syncPos)
      window.removeEventListener("resize", sync)
    }
  }, [syncPos, sync])

  // ─── Repeat press ───
  const startRepeat = useCallback((fn) => {
    fn()
    repeatRef.current = setTimeout(() => {
      repeatRef.current = setInterval(fn, REPEAT_INTERVAL)
    }, REPEAT_DELAY)
  }, [])
  const stopRepeat = useCallback(() => {
    clearTimeout(repeatRef.current)
    clearInterval(repeatRef.current)
  }, [])
  useEffect(() => () => stopRepeat(), [stopRepeat])

  // ─── Scroll helpers ───
  const scrollH = useCallback((delta) => {
    const el = tableRef?.current
    if (!el) return
    el.scrollLeft = Math.max(0, Math.min(el.scrollLeft + delta, el.scrollWidth - el.clientWidth))
    sync()
  }, [tableRef, sync])

  const scrollV = useCallback((delta) => {
    const el = tableRef?.current
    if (!el) return
    el.scrollTop = Math.max(0, Math.min(el.scrollTop + delta, el.scrollHeight - el.clientHeight))
    sync()
  }, [tableRef, sync])

  // ─── H drag ───
  useEffect(() => {
    const thumb = hThumbRef.current
    const track = hTrackRef.current
    if (!thumb || !track) return
    let startX = 0, startSL = 0
    const onMove = (e) => {
      const el = tableRef?.current
      if (!el) return
      const aw = Math.max(1, track.clientWidth - BTN_W * 2)
      const cx = e.touches ? e.touches[0].clientX : e.clientX
      const dx = cx - startX
      const maxS = el.scrollWidth - el.clientWidth
      el.scrollLeft = Math.max(0, Math.min(startSL + (dx / Math.max(1, aw - hThumb.width)) * maxS, maxS))
    }
    const onUp = () => {
      window.removeEventListener("mousemove", onMove)
      window.removeEventListener("mouseup", onUp)
      window.removeEventListener("touchmove", onMove)
      window.removeEventListener("touchend", onUp)
      document.body.style.userSelect = ""
    }
    const onDown = (e) => {
      e.preventDefault()
      startX = e.touches ? e.touches[0].clientX : e.clientX
      startSL = tableRef?.current?.scrollLeft ?? 0
      document.body.style.userSelect = "none"
      window.addEventListener("mousemove", onMove)
      window.addEventListener("mouseup", onUp)
      window.addEventListener("touchmove", onMove, { passive: false })
      window.addEventListener("touchend", onUp)
    }
    thumb.addEventListener("mousedown", onDown)
    thumb.addEventListener("touchstart", onDown, { passive: false })
    return () => {
      thumb.removeEventListener("mousedown", onDown)
      thumb.removeEventListener("touchstart", onDown)
    }
  }, [tableRef, hThumb])

  // ─── V drag ───
  useEffect(() => {
    const thumb = vThumbRef.current
    const track = vTrackRef.current
    if (!thumb || !track) return
    let startY = 0, startST = 0
    const onMove = (e) => {
      const el = tableRef?.current
      if (!el) return
      const ah = Math.max(1, track.clientHeight - BTN_H * 2)
      const cy = e.touches ? e.touches[0].clientY : e.clientY
      const dy = cy - startY
      const maxS = el.scrollHeight - el.clientHeight
      el.scrollTop = Math.max(0, Math.min(startST + (dy / Math.max(1, ah - vThumb.height)) * maxS, maxS))
    }
    const onUp = () => {
      window.removeEventListener("mousemove", onMove)
      window.removeEventListener("mouseup", onUp)
      window.removeEventListener("touchmove", onMove)
      window.removeEventListener("touchend", onUp)
      document.body.style.userSelect = ""
    }
    const onDown = (e) => {
      e.preventDefault()
      startY = e.touches ? e.touches[0].clientY : e.clientY
      startST = tableRef?.current?.scrollTop ?? 0
      document.body.style.userSelect = "none"
      window.addEventListener("mousemove", onMove)
      window.addEventListener("mouseup", onUp)
      window.addEventListener("touchmove", onMove, { passive: false })
      window.addEventListener("touchend", onUp)
    }
    thumb.addEventListener("mousedown", onDown)
    thumb.addEventListener("touchstart", onDown, { passive: false })
    return () => {
      thumb.removeEventListener("mousedown", onDown)
      thumb.removeEventListener("touchstart", onDown)
    }
  }, [tableRef, vThumb])

  // ─── H track click ───
  const onHTrackClick = useCallback((e) => {
    const track = hTrackRef.current
    const el = tableRef?.current
    if (!track || !el) return
    const rect = track.getBoundingClientRect()
    const cx = e.clientX - rect.left - BTN_W
    if (cx >= hThumb.left && cx <= hThumb.left + hThumb.width) return
    const aw = Math.max(1, track.clientWidth - BTN_W * 2)
    const ratio = Math.max(0, Math.min((cx - hThumb.width / 2) / Math.max(1, aw - hThumb.width), 1))
    el.scrollLeft = ratio * (el.scrollWidth - el.clientWidth)
    sync()
  }, [tableRef, hThumb, sync])

  // ─── V track click ───
  const onVTrackClick = useCallback((e) => {
    const track = vTrackRef.current
    const el = tableRef?.current
    if (!track || !el) return
    const rect = track.getBoundingClientRect()
    const cy = e.clientY - rect.top - BTN_H
    if (cy >= vThumb.top && cy <= vThumb.top + vThumb.height) return
    const ah = Math.max(1, track.clientHeight - BTN_H * 2)
    const ratio = Math.max(0, Math.min((cy - vThumb.height / 2) / Math.max(1, ah - vThumb.height), 1))
    el.scrollTop = ratio * (el.scrollHeight - el.clientHeight)
    sync()
  }, [tableRef, vThumb, sync])

  if (!hVis && !vVis) return null

  // ─── Computed positions ───
  const hLeft   = pos.left
  const hRight  = pos.right + (vVis ? V_W : 0)
  const hBottom = pos.bottom
  const vTop    = pos.top
  const vBottom = pos.bottom + (hVis ? H_H : 0)
  const vRight  = pos.right

  const barBg  = "bg-slate-100/95 dark:bg-slate-800/95 border-slate-200 dark:border-slate-700 backdrop-blur-sm select-none"
  const btnCls = "flex items-center justify-center text-slate-500 hover:text-slate-700 hover:bg-slate-200/80 dark:text-slate-400 dark:hover:text-slate-200 dark:hover:bg-slate-700/80 transition-colors cursor-pointer"

  return ReactDOM.createPortal(
    <>
      {/* ─── Horizontal scrollbar ─── */}
      {hVis && (
        <div
          ref={hTrackRef}
          onClick={onHTrackClick}
          style={{ position: "fixed", left: hLeft, right: hRight, bottom: hBottom, height: H_H, zIndex: 10000 }}
          className={`flex items-center border-t ${barBg}`}
        >
          {/* ← */}
          <button
            type="button"
            style={{ width: BTN_W, height: "100%", flexShrink: 0 }}
            className={btnCls}
            onMouseDown={() => startRepeat(() => scrollH(-STEP))}
            onMouseUp={stopRepeat} onMouseLeave={stopRepeat}
            onTouchStart={() => startRepeat(() => scrollH(-STEP))}
            onTouchEnd={stopRepeat}
            aria-label="เลื่อนซ้าย"
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <polyline points="15 18 9 12 15 6"/>
            </svg>
          </button>

          {/* Track */}
          <div className="relative flex-1" style={{ height: 10 }}>
            <div className="absolute inset-0 rounded-full bg-slate-200 dark:bg-slate-700"/>
            <div
              ref={hThumbRef}
              style={{ position: "absolute", left: hThumb.left, width: hThumb.width, top: 0, bottom: 0 }}
              className="rounded-full bg-slate-400 hover:bg-slate-500 dark:bg-slate-500 dark:hover:bg-slate-400 cursor-grab active:cursor-grabbing transition-colors"
            />
          </div>

          {/* → */}
          <button
            type="button"
            style={{ width: BTN_W, height: "100%", flexShrink: 0 }}
            className={btnCls}
            onMouseDown={() => startRepeat(() => scrollH(STEP))}
            onMouseUp={stopRepeat} onMouseLeave={stopRepeat}
            onTouchStart={() => startRepeat(() => scrollH(STEP))}
            onTouchEnd={stopRepeat}
            aria-label="เลื่อนขวา"
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <polyline points="9 18 15 12 9 6"/>
            </svg>
          </button>
        </div>
      )}

      {/* ─── Vertical scrollbar ─── */}
      {vVis && (
        <div
          ref={vTrackRef}
          onClick={onVTrackClick}
          style={{ position: "fixed", top: vTop, bottom: vBottom, right: vRight, width: V_W, zIndex: 10000 }}
          className={`flex flex-col items-center border-l ${barBg}`}
        >
          {/* ↑ */}
          <button
            type="button"
            style={{ height: BTN_H, width: "100%", flexShrink: 0 }}
            className={btnCls}
            onMouseDown={() => startRepeat(() => scrollV(-STEP))}
            onMouseUp={stopRepeat} onMouseLeave={stopRepeat}
            onTouchStart={() => startRepeat(() => scrollV(-STEP))}
            onTouchEnd={stopRepeat}
            aria-label="เลื่อนขึ้น"
          >
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <polyline points="18 15 12 9 6 15"/>
            </svg>
          </button>

          {/* Track */}
          <div className="relative flex-1" style={{ width: 10 }}>
            <div className="absolute inset-0 rounded-full bg-slate-200 dark:bg-slate-700"/>
            <div
              ref={vThumbRef}
              style={{ position: "absolute", top: vThumb.top, height: vThumb.height, left: 0, right: 0 }}
              className="rounded-full bg-slate-400 hover:bg-slate-500 dark:bg-slate-500 dark:hover:bg-slate-400 cursor-grab active:cursor-grabbing transition-colors"
            />
          </div>

          {/* ↓ */}
          <button
            type="button"
            style={{ height: BTN_H, width: "100%", flexShrink: 0 }}
            className={btnCls}
            onMouseDown={() => startRepeat(() => scrollV(STEP))}
            onMouseUp={stopRepeat} onMouseLeave={stopRepeat}
            onTouchStart={() => startRepeat(() => scrollV(STEP))}
            onTouchEnd={stopRepeat}
            aria-label="เลื่อนลง"
          >
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <polyline points="6 9 12 15 18 9"/>
            </svg>
          </button>
        </div>
      )}

      {/* ─── Corner piece ─── */}
      {hVis && vVis && (
        <div
          style={{
            position: "fixed",
            right: pos.right,
            bottom: pos.bottom,
            width: V_W,
            height: H_H,
            zIndex: 10000,
          }}
          className={`border-t border-l ${barBg}`}
        />
      )}
    </>,
    document.body
  )
}
