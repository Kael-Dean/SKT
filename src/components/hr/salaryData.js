// src/components/hr/salaryData.js
// Data hooks for the salary step / history views (no Context — hooks + module caches only).
//   useEmployeeSalary(empId, refreshKey, positionsById)  GET /hr/personnel/{id}
//   useSalaryLookup(tierId, level, { debounce })           GET /hr/salary-ladder/lookup?tier&level
//   useLadderMax(tierId)                                   GET /hr/salary-ladder?tier=
//
// Every result is keyed by its input (employee id / "tier:level" / tier). A result
// whose key doesn't match the current input is never returned, so switching
// employee can't flash the previous person's level, salary or preview. Each
// effect also carries an `alive` flag so late responses are dropped.
// apiAuth has no AbortSignal support, hence alive flags instead of AbortController.
import { useEffect, useState } from "react"
import { apiAuth } from "../../lib/api"
import { errText, tierQuery } from "./positionUtils"

// ─── Module caches ──────────────────────────────────────────────────────────
const lookupPromises = new Map() // "tier:level" → Promise<number|null>
const lookupResolved = new Map() // "tier:level" → number|null (sync read in render)
const ladderPromises = new Map() // tier → Promise<number|null> (max level)
const ladderResolved = new Map() // tier → number|null

const lookupKey = (tierId, level) => {
  if (tierId == null || tierId === "" || level == null || level === "") return null
  const n = Number(level)
  return Number.isFinite(n) ? `${Number(tierId)}:${n}` : null
}

function lookupSalary(key) {
  if (!lookupPromises.has(key)) {
    const [tier, level] = key.split(":")
    const p = apiAuth(`/hr/salary-ladder/lookup?${tierQuery(tier)}&level=${encodeURIComponent(level)}`)
      .then((row) => {
        const amt = row?.salary_amount
        const v = amt == null || Number.isNaN(Number(amt)) ? null : Number(amt)
        lookupResolved.set(key, v)
        return v
      })
      .catch((e) => {
        // Not cached: a failed lookup (404 or network) may succeed on the next try.
        lookupPromises.delete(key)
        throw e
      })
    lookupPromises.set(key, p)
  }
  return lookupPromises.get(key)
}

function loadLadderMax(tier) {
  const k = String(Number(tier))
  if (!ladderPromises.has(k)) {
    const p = apiAuth(`/hr/salary-ladder?${tierQuery(k)}`)
      .then((rows) => {
        const levels = (Array.isArray(rows) ? rows : []).map((r) => Number(r.level)).filter(Number.isFinite)
        const max = levels.length ? Math.max(...levels) : null
        ladderResolved.set(k, max)
        return max
      })
      .catch((e) => {
        ladderPromises.delete(k)
        throw e
      })
    ladderPromises.set(k, p)
  }
  return ladderPromises.get(k)
}

/** Drop cached ladder amounts (call after the ladder itself is edited). */
export function clearSalaryCaches() {
  lookupPromises.clear()
  lookupResolved.clear()
  ladderPromises.clear()
  ladderResolved.clear()
}

// ─── Hooks ──────────────────────────────────────────────────────────────────

/**
 * Personnel detail for one employee + derived position/tier/level.
 * A refresh of the same employee keeps the previous values on screen until the
 * new response lands (no skeleton flash); a different employee shows loading.
 */
export function useEmployeeSalary(empId, refreshKey = 0, positionsById = {}, listRecord = null) {
  const key = empId ? String(empId) : null
  const [res, setRes] = useState({ key: null, detail: null, error: "" })
  const [attempt, setAttempt] = useState(0)

  useEffect(() => {
    if (!key) return
    let alive = true
    apiAuth(`/hr/personnel/${key}`)
      .then((d) => { if (alive) setRes({ key, detail: d, error: "" }) })
      .catch((e) => { if (alive) setRes({ key, detail: null, error: errText(e, "โหลดข้อมูลเจ้าหน้าที่ไม่สำเร็จ") }) })
    return () => { alive = false }
  }, [key, refreshKey, attempt])

  const mine = key != null && res.key === key
  const detail = mine ? res.detail : null
  const error = mine ? res.error : ""
  const loading = key != null && !mine

  // detail first; the picker's list record is a fallback when detail omits `position`
  const positionId = detail ? detail.position ?? listRecord?.position ?? null : null
  const position = positionId != null ? positionsById?.[positionId] ?? null : null
  const tierId = position?.position_tier_id ?? null
  const rawLevel = detail?.personnel_info?.salary_level
  const currentLevel = rawLevel == null || rawLevel === "" || Number.isNaN(Number(rawLevel)) ? null : Number(rawLevel)

  const retry = () => {
    setRes({ key: null, detail: null, error: "" })
    setAttempt((n) => n + 1)
  }

  return { detail, loading, error, retry, positionId, position, tierId, currentLevel }
}

/**
 * Salary amount for tier + level. status: idle | loading | ok | missing.
 * Cached per "tier:level"; `debounce` (ms) applies only to uncached keys.
 */
export function useSalaryLookup(tierId, level, { debounce = 0 } = {}) {
  const key = lookupKey(tierId, level)
  const [res, setRes] = useState({ key: null, status: "idle", amount: null })

  useEffect(() => {
    if (!key || lookupResolved.has(key)) return
    let alive = true
    const t = setTimeout(() => {
      lookupSalary(key)
        .then((amount) => { if (alive) setRes({ key, status: amount == null ? "missing" : "ok", amount }) })
        .catch(() => { if (alive) setRes({ key, status: "missing", amount: null }) })
    }, debounce)
    return () => {
      alive = false
      clearTimeout(t)
    }
  }, [key, debounce])

  if (!key) return { status: "idle", amount: null }
  if (lookupResolved.has(key)) {
    const amount = lookupResolved.get(key)
    return { status: amount == null ? "missing" : "ok", amount }
  }
  if (res.key !== key) return { status: "loading", amount: null }
  return res
}

/** Highest level of a tier's ladder. status: idle | loading | ok | error. */
export function useLadderMax(tierId) {
  const key = tierId == null || tierId === "" ? null : String(Number(tierId))
  const [res, setRes] = useState({ key: null, status: "idle", max: null })

  useEffect(() => {
    if (!key || ladderResolved.has(key)) return
    let alive = true
    loadLadderMax(key)
      .then((max) => { if (alive) setRes({ key, status: "ok", max }) })
      .catch(() => { if (alive) setRes({ key, status: "error", max: null }) })
    return () => { alive = false }
  }, [key])

  if (!key) return { status: "idle", max: null }
  if (ladderResolved.has(key)) return { status: "ok", max: ladderResolved.get(key) }
  if (res.key !== key) return { status: "loading", max: null }
  return res
}
