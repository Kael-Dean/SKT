// src/lib/useFetch.js
// ─────────────────────────────────────────────────────────────────────────────
// Standardizes the loading/error/data boilerplate around apiAuth. Returns
// { data, isLoading, error, reload, setData }. `error` is the Error.message
// string so it drops straight into <ErrorState message={error} />.
//
//   const { data, isLoading, error, reload } = useFetch("/items", {
//     deps: [companyId],          // re-fetch when these change
//     transform: (r) => r.items,  // optional shape the payload
//   })
//
// Debouncing stays the caller's job — no timer is baked in.
// ─────────────────────────────────────────────────────────────────────────────
import { useCallback, useEffect, useRef, useState } from "react"
import { apiAuth } from "./api"

export default function useFetch(path, { auto = true, deps = [], transform } = {}) {
  const [data, setData] = useState(null)
  const [isLoading, setIsLoading] = useState(Boolean(auto && path))
  const [error, setError] = useState(null)

  // Keep the latest path/transform in refs so reload() stays stable and the
  // effect doesn't need them in its dependency array.
  const pathRef = useRef(path)
  const transformRef = useRef(transform)
  pathRef.current = path
  transformRef.current = transform

  // Guards setState after unmount and discards stale in-flight responses.
  const cancelledRef = useRef(false)
  const requestIdRef = useRef(0)

  useEffect(() => {
    cancelledRef.current = false
    return () => {
      cancelledRef.current = true
    }
  }, [])

  const run = useCallback(async () => {
    const p = pathRef.current
    if (!p) return undefined

    const reqId = ++requestIdRef.current
    setIsLoading(true)
    setError(null)
    try {
      const raw = await apiAuth(p)
      const result = transformRef.current ? transformRef.current(raw) : raw
      if (!cancelledRef.current && reqId === requestIdRef.current) {
        setData(result)
      }
      return result
    } catch (err) {
      if (!cancelledRef.current && reqId === requestIdRef.current) {
        setError(err?.message || "เกิดข้อผิดพลาด")
      }
      throw err
    } finally {
      if (!cancelledRef.current && reqId === requestIdRef.current) {
        setIsLoading(false)
      }
    }
  }, [])

  // Auto-fetch on mount and whenever path / deps change.
  useEffect(() => {
    if (!auto || !path) return
    // run() reads the current path from the ref; swallow rejections here so an
    // unhandled rejection isn't thrown on the effect (callers can still await reload()).
    run().catch(() => {})
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [auto, path, run, ...deps])

  return { data, isLoading, error, reload: run, setData }
}
