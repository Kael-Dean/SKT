// src/components/ui/MascotRive.jsx
// ─────────────────────────────────────────────────────────────────────────────
// The animated half of <Mascot>. Loaded ONLY through React.lazy from Mascot.jsx,
// so @rive-app/react-canvas (+ its wasm) stays out of the main bundle.
//
// Spec: handoff/mascot-homthong.md. Artboard + state machine are both "HomThong".
// Control is via the artboard's VIEW MODEL (not legacy SM inputs):
//   number  mood      0 idle · 1 onboard · 2 empty · 3 loading · 4 success
//   number  pointDir  0 side · 1 up · 2 down   (only used while pointing in onboard)
// autoBind binds the default instance at load, so rive.viewModelInstance is the
// live one by the time useRive hands us `rive`.
//
// The wasm is self-hosted (hashed asset from node_modules) instead of the runtime's
// default unpkg/jsdelivr URLs: no third-party CDN at runtime, cached with the build.
// ─────────────────────────────────────────────────────────────────────────────
import { useEffect, useRef } from "react"
import {
  Alignment,
  Fit,
  Layout,
  RuntimeLoader,
  useRive,
  useViewModelInstanceNumber,
} from "@rive-app/react-canvas"
import riveWasmUrl from "@rive-app/canvas/rive.wasm?url"

RuntimeLoader.setWasmUrl(riveWasmUrl)
// The fallback build only matters for very old browsers; never reach out to a CDN.
RuntimeLoader.setWasmFallbackUrl(null)

const asset = (p) => `${import.meta.env.BASE_URL.replace(/\/+$/, "")}${p}`

export default function MascotRive({ mood, pointDir = 0, cover, onReady, onError }) {
  // Callbacks / first mood are read once by the Rive constructor; keep them in refs
  // so a parent re-render never re-creates the instance.
  const moodRef = useRef(mood)
  const pointRef = useRef(pointDir)
  const readyRef = useRef(onReady)
  const errorRef = useRef(onError)
  useEffect(() => {
    moodRef.current = mood
    pointRef.current = pointDir
    readyRef.current = onReady
    errorRef.current = onError
  })

  const { rive, RiveComponent } = useRive({
    src: asset("/mascot/homthong.riv"),
    artboard: "HomThong",
    stateMachine: "HomThong",
    autoplay: true,
    autoBind: true,
    layout: new Layout({ fit: cover ? Fit.Cover : Fit.Contain, alignment: Alignment.Center }),
    onLoadError: () => errorRef.current?.(),
    onRiveReady: (r) => {
      // Set the starting pose before the first visible frame, so an empty state
      // does not flash Idle → Search.
      const prop = r.viewModelInstance?.number("mood")
      if (!prop) {
        errorRef.current?.()
        return
      }
      prop.value = moodRef.current
      const point = r.viewModelInstance.number("pointDir")
      if (point) point.value = pointRef.current
      readyRef.current?.()
    },
  })

  const { setValue: setMood } = useViewModelInstanceNumber("mood", rive?.viewModelInstance ?? null)
  useEffect(() => {
    if (rive) setMood(mood)
  }, [rive, mood, setMood])

  // pointDir is optional in the .riv (older files lack it), so set it directly
  // instead of through the hook, which expects the property to exist.
  useEffect(() => {
    const point = rive?.viewModelInstance?.number("pointDir")
    if (point) point.value = pointDir
  }, [rive, pointDir])

  return <RiveComponent className="size-full" />
}
