// src/components/ui/Mascot.jsx
// ─────────────────────────────────────────────────────────────────────────────
// "น้องหอมทอง" — the co-op's rice-grain mascot (handoff/mascot-homthong.md).
//
//   <Mascot mood="empty" size={96} />
//
//   mood       "idle" | "onboard" | "empty" | "loading" | "success"   (→ view model mood 0–4)
//   size       px, the box is always square and reserved up front (no layout shift)
//   deferMs    wait this long before fetching the Rive runtime (default: next idle
//              moment). PageLoader uses it so quick loads never pull the wasm.
//   className  extra classes on the box
//
// Behaviour
// - Decorative: aria-hidden. The surrounding copy carries the meaning.
// - The static homthong.svg paints immediately and stays as the permanent fallback
//   when Rive fails to load, and is the ONLY thing shown under prefers-reduced-motion
//   (the runtime is not even requested). Same when the page CSP forbids wasm:
//   index.html script-src needs 'wasm-unsafe-eval' for the animated version.
// - Rive lives in ./MascotRive.jsx behind React.lazy → its own chunk.
// - size ≤ 64: Fit.Cover on a 1.3× stage cropped by the box. The character only fills
//   ~60% of its 512 artboard (head-room for the jump), so at avatar sizes we zoom in.
// ─────────────────────────────────────────────────────────────────────────────
import { Component, lazy, Suspense, useEffect, useState } from "react"
import useMediaQuery from "../../hooks/useMediaQuery"
import { cx } from "../../lib/styles"

const MascotRive = lazy(() => import("./MascotRive"))

const MASCOT_MOODS = { idle: 0, onboard: 1, empty: 2, loading: 3, success: 4 }
const REDUCED = "(prefers-reduced-motion: reduce)"
const SMALL = 64
const SMALL_ZOOM = 1.3

const asset = (p) => `${import.meta.env.BASE_URL.replace(/\/+$/, "")}${p}`

// Can this page compile WebAssembly at all? A CSP without 'wasm-unsafe-eval' in
// script-src (or no wasm support) makes the Rive runtime fail after downloading
// ~830 kB and spam the console. Compiling the 8-byte empty module is synchronous,
// silent, and answers the question up front; we then stay on the static pose.
let wasmOk = null
function canCompileWasm() {
  if (wasmOk === null) {
    try {
      new WebAssembly.Module(new Uint8Array([0x00, 0x61, 0x73, 0x6d, 0x01, 0x00, 0x00, 0x00]))
      wasmOk = true
    } catch {
      wasmOk = false
    }
  }
  return wasmOk
}

/** Chunk/wasm failures inside the lazy half must not take the page down. */
class RiveBoundary extends Component {
  state = { failed: false }
  static getDerivedStateFromError() {
    return { failed: true }
  }
  componentDidCatch() {
    this.props.onError?.()
  }
  render() {
    return this.state.failed ? null : this.props.children
  }
}

/** Mount the runtime only once the browser is idle (or after `ms`). */
function useDeferred(enabled, ms) {
  const [go, setGo] = useState(false)
  useEffect(() => {
    if (!enabled) return undefined
    if (ms != null) {
      const t = setTimeout(() => setGo(true), ms)
      return () => clearTimeout(t)
    }
    if (typeof window.requestIdleCallback === "function") {
      const id = window.requestIdleCallback(() => setGo(true), { timeout: 600 })
      return () => window.cancelIdleCallback(id)
    }
    const t = setTimeout(() => setGo(true), 120)
    return () => clearTimeout(t)
  }, [enabled, ms])
  return go
}

export default function Mascot({ mood = "idle", size = 96, deferMs, className = "" }) {
  const reduced = useMediaQuery(REDUCED)
  const [failed, setFailed] = useState(false)
  const [ready, setReady] = useState(false)
  const animate = !reduced && !failed && canCompileWasm()
  const mount = useDeferred(animate, deferMs)

  const moodValue = MASCOT_MOODS[mood] ?? MASCOT_MOODS.idle
  const small = size <= SMALL
  const stage = small ? Math.round(size * SMALL_ZOOM) : size
  const offset = (size - stage) / 2
  // Zoom toward the body, not the empty jump space above the head.
  const stageStyle = small
    ? { width: stage, height: stage, left: offset, top: offset * 0.4 }
    : { inset: 0 }

  const showCanvas = animate && ready

  return (
    <div
      aria-hidden="true"
      className={cx("relative shrink-0 select-none overflow-hidden", className)}
      style={{ width: size, height: size }}
    >
      <div className="absolute" style={stageStyle}>
        <img
          src={asset("/mascot/homthong.svg")}
          alt=""
          width={stage}
          height={stage}
          decoding="async"
          draggable="false"
          className={cx(
            "absolute inset-0 size-full transition-opacity duration-200 ease-out",
            showCanvas ? "opacity-0" : "opacity-100",
          )}
        />
        {animate && mount && (
          <div
            className={cx(
              "absolute inset-0 transition-opacity duration-200 ease-out",
              showCanvas ? "opacity-100" : "opacity-0",
            )}
          >
            <RiveBoundary onError={() => setFailed(true)}>
              <Suspense fallback={null}>
                <MascotRive
                  mood={moodValue}
                  cover={small}
                  onReady={() => setReady(true)}
                  onError={() => setFailed(true)}
                />
              </Suspense>
            </RiveBoundary>
          </div>
        )}
      </div>
    </div>
  )
}
