// src/hooks/useVisualViewport.js
// ─────────────────────────────────────────────────────────────────────────────
// Tracks the *visual* viewport (what is actually visible once the on-screen
// keyboard is up). iOS does not resize the layout viewport for the keyboard,
// so `100dvh` sheets and `fixed bottom-0` bars sit under it unless they read
// this.
//
//   const { height, offsetTop, keyboardOpen } = useVisualViewport()
//   keyboardOpen === height < window.innerHeight * 0.75
//
// useSyncExternalStore with a cached snapshot object (same reference while the
// numbers are unchanged) so consumers do not re-render on every scroll event.
// ─────────────────────────────────────────────────────────────────────────────
import { useSyncExternalStore } from "react"

const KEYBOARD_RATIO = 0.75

let snapshot = { height: 0, offsetTop: 0, keyboardOpen: false }
const serverSnapshot = snapshot

function read() {
  if (typeof window === "undefined") return serverSnapshot
  const vv = window.visualViewport
  const height = Math.round(vv?.height ?? window.innerHeight)
  const offsetTop = Math.round(vv?.offsetTop ?? 0)
  const keyboardOpen = height < window.innerHeight * KEYBOARD_RATIO
  if (
    snapshot.height !== height ||
    snapshot.offsetTop !== offsetTop ||
    snapshot.keyboardOpen !== keyboardOpen
  ) {
    snapshot = { height, offsetTop, keyboardOpen }
  }
  return snapshot
}

function subscribe(onChange) {
  if (typeof window === "undefined") return () => {}
  const vv = window.visualViewport
  vv?.addEventListener("resize", onChange)
  vv?.addEventListener("scroll", onChange)
  window.addEventListener("resize", onChange)
  return () => {
    vv?.removeEventListener("resize", onChange)
    vv?.removeEventListener("scroll", onChange)
    window.removeEventListener("resize", onChange)
  }
}

export default function useVisualViewport() {
  return useSyncExternalStore(subscribe, read, () => serverSnapshot)
}
