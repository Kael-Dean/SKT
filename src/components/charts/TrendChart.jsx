// src/components/charts/TrendChart.jsx
// ─────────────────────────────────────────────────────────────────────────────
// กราฟแท่งแนวตั้งชุดเดียว (time series) — SVG เขียนเอง ไม่มี dependency
//
//   <TrendChart
//     items={[{ key, value, label, subLabel, empty, highlight }]}   // เก่า → ใหม่, value = number (ใช้คำนวณรูปเท่านั้น)
//     ariaLabel="สรุปสำหรับ screen reader"
//     formatTick={(n) => "2.5 ล้าน"}
//     renderTooltip={(item, i) => <div>…</div>}
//   />
//
// • วัดความกว้างจริงด้วย ResizeObserver → ตัวอักษรไม่ถูกย่อ/ขยายตาม viewBox
// • ช่องแคบ (<36px) แสดงป้ายเดือนเว้นช่อง (ป้ายที่มี subLabel แสดงเสมอ)
// • แท่ง ≤24px ปลายมน 4px ฐานเหลี่ยม · แท่ง highlight = สีเข้ม (เดือนล่าสุด) ที่เหลือสีจาง
// • empty = ช่องว่าง (ไม่มีข้อมูล) — วาดแค่ขีดสั้นบนเส้นฐาน
// • Hover (เมาส์) / แตะ (มือถือ) / โฟกัส + ลูกศรซ้าย-ขวา, Home/End → tooltip; Esc ปิด
// • role="img" + aria-label — ข้อมูลครบให้ผู้ใช้ screen reader ผ่านตารางที่หน้าเรียกใช้เตรียมไว้
// ─────────────────────────────────────────────────────────────────────────────
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react"
import { cx } from "../../lib/styles"

const PAD = { top: 12, right: 8, bottom: 40, left: 56 }
const MAX_BAR = 24
const RADIUS = 4

/** ขั้นแกน y แบบเลขกลม (1 / 2 / 2.5 / 5 × 10^k) */
function niceTicks(max, count = 4) {
  if (!(max > 0)) return [0]
  const raw = max / count
  const pow = 10 ** Math.floor(Math.log10(raw))
  const step = [1, 2, 2.5, 5, 10].map((m) => m * pow).find((s) => s >= raw) ?? 10 * pow
  const top = Math.ceil(max / step) * step
  const out = []
  for (let v = 0; v <= top + step / 2; v += step) out.push(v)
  return out
}

/** แท่งปลายมนด้านบน ฐานเหลี่ยม */
function barPath(x, y, w, h) {
  const r = Math.min(RADIUS, w / 2, h)
  return `M${x},${y + h}V${y + r}Q${x},${y} ${x + r},${y}H${x + w - r}Q${x + w},${y} ${x + w},${y + r}V${y + h}Z`
}

function useWidth(ref) {
  const [w, setW] = useState(0)
  useLayoutEffect(() => {
    const el = ref.current
    if (!el) return undefined
    setW(el.clientWidth)
    if (typeof ResizeObserver === "undefined") return undefined
    const ro = new ResizeObserver(([entry]) => setW(Math.round(entry.contentRect.width)))
    ro.observe(el)
    return () => ro.disconnect()
  }, [ref])
  return w
}

export default function TrendChart({
  items,
  ariaLabel,
  formatTick = (n) => String(n),
  renderTooltip,
  height = 220,
  className = "",
}) {
  const wrapRef = useRef(null)
  const tipRef = useRef(null)
  const width = useWidth(wrapRef)
  const [active, setActive] = useState(null)
  const [tipX, setTipX] = useState(null)

  const n = items.length
  const plotW = Math.max(0, width - PAD.left - PAD.right)
  const plotH = height - PAD.top - PAD.bottom
  const slot = n ? plotW / n : 0
  const barW = Math.max(4, Math.min(MAX_BAR, slot * 0.6))
  const labelEvery = slot >= 36 ? 1 : slot >= 20 ? 2 : 3

  const ticks = useMemo(() => niceTicks(Math.max(0, ...items.map((d) => (d.empty ? 0 : d.value || 0)))), [items])
  const top = ticks[ticks.length - 1] || 1
  const yOf = (v) => PAD.top + plotH - (Math.max(0, v) / top) * plotH
  const cxOf = (i) => PAD.left + slot * i + slot / 2

  // วาง tooltip ไม่ให้ล้นกรอบ (วัดหลัง render)
  useLayoutEffect(() => {
    if (active == null || !tipRef.current || !width) {
      setTipX(null)
      return
    }
    const tw = tipRef.current.offsetWidth
    const center = PAD.left + slot * active + slot / 2
    setTipX(Math.min(Math.max(0, center - tw / 2), Math.max(0, width - tw)))
  }, [active, width, slot])

  // แตะนอกกราฟ (มือถือ) → ปิด tooltip
  useEffect(() => {
    if (active == null) return undefined
    const onDown = (e) => { if (wrapRef.current && !wrapRef.current.contains(e.target)) setActive(null) }
    document.addEventListener("pointerdown", onDown)
    return () => document.removeEventListener("pointerdown", onDown)
  }, [active])

  const indexAt = useCallback(
    (clientX) => {
      const rect = wrapRef.current?.getBoundingClientRect()
      if (!rect || !slot) return null
      const i = Math.floor((clientX - rect.left - PAD.left) / slot)
      return i >= 0 && i < n ? i : null
    },
    [slot, n],
  )

  const onKeyDown = (e) => {
    if (!n) return
    const cur = active ?? n - 1
    const next = { ArrowLeft: cur - 1, ArrowRight: cur + 1, Home: 0, End: n - 1 }[e.key]
    if (e.key === "Escape") { setActive(null); return }
    if (next == null) return
    e.preventDefault()
    setActive(Math.min(n - 1, Math.max(0, next)))
  }

  return (
    <div
      ref={wrapRef}
      className={cx("relative w-full select-none rounded-lg focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500", className)}
      style={{ height }}
      role="img"
      aria-label={ariaLabel}
      tabIndex={0}
      onKeyDown={onKeyDown}
      onFocus={() => setActive((a) => a ?? (n ? n - 1 : null))}
      onBlur={() => setActive(null)}
      onPointerMove={(e) => { if (e.pointerType === "mouse") setActive(indexAt(e.clientX)) }}
      onPointerLeave={(e) => { if (e.pointerType === "mouse") setActive(null) }}
      onPointerDown={(e) => { if (e.pointerType !== "mouse") setActive(indexAt(e.clientX)) }}
    >
      {width > 0 && (
        <svg width={width} height={height} aria-hidden="true" className="block overflow-visible">
          {/* grid + y ticks */}
          {ticks.map((t) => (
            <g key={t}>
              <line
                x1={PAD.left}
                x2={width - PAD.right}
                y1={yOf(t)}
                y2={yOf(t)}
                strokeWidth="1"
                className={t === 0 ? "stroke-gray-300 dark:stroke-white/20" : "stroke-gray-100 dark:stroke-white/[.07]"}
              />
              <text x={PAD.left - 8} y={yOf(t)} dy="0.32em" textAnchor="end" className="fill-gray-500 text-[11px] tabular-nums dark:fill-gray-400">
                {formatTick(t)}
              </text>
            </g>
          ))}

          {items.map((d, i) => {
            const x = cxOf(i)
            const isActive = active === i
            const showLabel = d.subLabel || i % labelEvery === (n - 1) % labelEvery
            const h = d.empty ? 0 : Math.max(1, yOf(0) - yOf(d.value))
            return (
              <g key={d.key}>
                {isActive && (
                  <rect x={PAD.left + slot * i} y={PAD.top} width={slot} height={plotH} className="fill-gray-100 dark:fill-white/[.05]" />
                )}
                {d.empty ? (
                  <line x1={x - barW / 2} x2={x + barW / 2} y1={yOf(0) - 1} y2={yOf(0) - 1} strokeWidth="2" strokeLinecap="round" className="stroke-gray-300 dark:stroke-white/20" />
                ) : (
                  <path
                    d={barPath(x - barW / 2, yOf(0) - h, barW, h)}
                    className={cx(
                      "transition-[fill] duration-150",
                      d.highlight
                        ? "fill-indigo-700 dark:fill-indigo-300"
                        : isActive
                          ? "fill-indigo-600 dark:fill-indigo-400"
                          : "fill-indigo-500 dark:fill-indigo-500",
                    )}
                  />
                )}
                {showLabel && (
                  <text x={x} y={yOf(0) + 16} textAnchor="middle" className={cx("text-[11px]", isActive ? "fill-gray-900 font-semibold dark:fill-gray-100" : "fill-gray-500 dark:fill-gray-400")}>
                    {d.label}
                  </text>
                )}
                {d.subLabel && (
                  <text x={x} y={yOf(0) + 30} textAnchor="middle" className="fill-gray-500 text-[10px] tabular-nums dark:fill-gray-400">
                    {d.subLabel}
                  </text>
                )}
              </g>
            )
          })}
        </svg>
      )}

      {active != null && items[active] && renderTooltip && (
        <div
          ref={tipRef}
          aria-hidden="true"
          className={cx(
            "pointer-events-none absolute top-0 z-10 w-max max-w-[min(18rem,100%)] rounded-xl bg-white px-3 py-2.5 text-xs shadow-lg ring-1 ring-gray-200",
            "dark:bg-raised dark:ring-line-strong",
            tipX == null && "invisible",
          )}
          style={{ left: tipX ?? 0 }}
        >
          {renderTooltip(items[active], active)}
        </div>
      )}
    </div>
  )
}
