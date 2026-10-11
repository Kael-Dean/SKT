// src/hooks/useMediaQuery.js
// ─────────────────────────────────────────────────────────────────────────────
// The ONE phone/touch detector of the app (plan §A1). CSS breakpoints handle
// layout; use these hooks only when the React tree itself must differ
// (e.g. Buy/Sales render a stepper instead of the 3-card form on phones).
//
//   const isPhone  = useIsPhone()          // viewport < md (767.98px)
//   const isCoarse = useIsCoarsePointer()  // touch-first device (no hover)
//   const matches  = useMediaQuery("(orientation: landscape)")
//
// useSyncExternalStore + matchMedia — no Context, no resize listeners per page.
// ─────────────────────────────────────────────────────────────────────────────
import { useCallback, useSyncExternalStore } from "react"

/** Phone breakpoint — mirrors Tailwind's `md` (768px) so JS and CSS agree. */
export const PHONE = "(max-width: 767.98px)"
/** Touch-first pointer (phones, tablets). Hover-only affordances are useless here. */
export const COARSE = "(pointer: coarse)"

const canMatch = typeof window !== "undefined" && typeof window.matchMedia === "function"

export function useMediaQuery(query) {
  const subscribe = useCallback(
    (onChange) => {
      if (!canMatch) return () => {}
      const mql = window.matchMedia(query)
      mql.addEventListener("change", onChange)
      return () => mql.removeEventListener("change", onChange)
    },
    [query],
  )
  const getSnapshot = useCallback(() => (canMatch ? window.matchMedia(query).matches : false), [query])
  const getServerSnapshot = useCallback(() => false, [])
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot)
}

export function useIsPhone() {
  return useMediaQuery(PHONE)
}

export function useIsCoarsePointer() {
  return useMediaQuery(COARSE)
}

export default useMediaQuery
