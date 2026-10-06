// src/lib/useSubTab.js
// ─────────────────────────────────────────────────────────────────────────────
// Sub-tab state stored in the URL as `&sub=<value>` (HashRouter search params).
//
//   const [sub, setSub] = useSubTab(["step", "ladder", "history"], "step")
//
// - Missing / invalid `sub` → returns `fallback` (or the first valid value) and
//   does NOT rewrite the URL.
// - setSub writes `sub` with `replace` (sub-tab clicks add no history entries)
//   and keeps `tab` plus every other existing param.
// ─────────────────────────────────────────────────────────────────────────────
import { useCallback } from "react"
import { useSearchParams } from "react-router-dom"

export default function useSubTab(validValues = [], fallback) {
  const [params, setParams] = useSearchParams()
  const valid = validValues.map(String)
  const raw = params.get("sub")
  const def = fallback != null ? String(fallback) : valid[0]
  const sub = raw != null && valid.includes(raw) ? raw : def

  const setSub = useCallback(
    (next) => {
      setParams(
        (prev) => {
          const p = new URLSearchParams(prev)
          if (next == null || next === "") p.delete("sub")
          else p.set("sub", String(next))
          return p
        },
        { replace: true }
      )
    },
    [setParams]
  )

  return [sub, setSub]
}
