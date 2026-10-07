// src/components/hr/salaryData.js
// Data hooks for the salary step / history views (no Context — hooks + module caches only).
//   useEmployeeSalary(empId, refreshKey, positionsById)  GET /hr/personnel/{id}
//   useSalaryLookup(tierId, level, { debounce })           GET /hr/salary-ladder/lookup?tier&level
//   useLadderMax(tierId)                                   GET /hr/salary-ladder?tier=
//   useSalaryRoster(positionsById)                         GET /hr/salary-roster (1 request)
//
// Every result is keyed by its input (employee id / "tier:level" / tier). A result
// whose key doesn't match the current input is never returned, so switching
// employee can't flash the previous person's level, salary or preview. Each
// effect also carries an `alive` flag so late responses are dropped.
// apiAuth has no AbortSignal support, hence alive flags instead of AbortController.
import { useCallback, useEffect, useMemo, useState } from "react"
import { apiAuth } from "../../lib/api"
import { errText, tierQuery } from "./positionUtils"

// ─── Module caches ──────────────────────────────────────────────────────────
const lookupPromises = new Map() // "tier:level" → Promise<number|null>
const lookupResolved = new Map() // "tier:level" → number|null (sync read in render)
const ladderPromises = new Map() // tier → Promise<Map<level, amount|null>>
const ladderResolved = new Map() // tier → Map<level, amount|null> (sync read in render)

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

const toAmount = (amt) => (amt == null || amt === "" || Number.isNaN(Number(amt)) ? null : Number(amt))
const ladderMaxOf = (ladder) => (ladder && ladder.size ? Math.max(...ladder.keys()) : null)

/**
 * Whole ladder of one tier → Map<level:number, amount:number|null>. One request
 * per tier, used by useLadderMax (step preview).
 * Each row also seeds the per-level lookup cache (same `salary_level` table as
 * /salary-ladder/lookup), so a later useSalaryLookup for that tier is instant.
 */
function loadLadder(tier) {
  const k = String(Number(tier))
  if (!ladderPromises.has(k)) {
    const p = apiAuth(`/hr/salary-ladder?${tierQuery(k)}`)
      .then((rows) => {
        const ladder = new Map()
        for (const r of Array.isArray(rows) ? rows : []) {
          const level = Number(r?.level)
          if (!Number.isFinite(level)) continue
          const amount = toAmount(r?.salary_amount)
          ladder.set(level, amount)
          if (amount != null) {
            const lk = `${Number(k)}:${level}`
            lookupResolved.set(lk, amount)
            if (!lookupPromises.has(lk)) lookupPromises.set(lk, Promise.resolve(amount))
          }
        }
        ladderResolved.set(k, ladder)
        return ladder
      })
      .catch((e) => {
        ladderPromises.delete(k)
        throw e
      })
    ladderPromises.set(k, p)
  }
  return ladderPromises.get(k)
}

const loadLadderMax = (tier) => loadLadder(tier).then(ladderMaxOf)

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
  if (ladderResolved.has(key)) return { status: "ok", max: ladderMaxOf(ladderResolved.get(key)) }
  if (res.key !== key) return { status: "loading", max: null }
  return res
}

// ─── Salary roster (all active employees) ───────────────────────────────────
// GET /hr/salary-roster returns every active employee with branch, position,
// tier, level and the resolved monthly salary in ONE response (server already
// applies ladder → current_salary fallback; `salary_source` says which).
// The response is cached at module level: switching sub-tabs and coming back
// costs zero requests. invalidateRosterEmployee() (after a step award) marks the
// cache stale → the next view shows the cached rows and re-fetches in the
// background. refresh() always re-fetches.

let rosterCache = null // { list: raw rows[], stale: boolean }
let rosterGen = 0 // bumped on every invalidation; a response from an older gen lands as stale
let rosterInflight = null // { gen, promise } — dedupes overlapping loads of the same gen

const toLevel = (raw) => (raw == null || raw === "" || Number.isNaN(Number(raw)) ? null : Number(raw))

function fetchRoster() {
  if (!rosterInflight || rosterInflight.gen !== rosterGen) {
    const gen = rosterGen
    const entry = { gen, promise: null }
    entry.promise = apiAuth("/hr/salary-roster")
      .then((d) => {
        const list = Array.isArray(d) ? d : []
        rosterCache = { list, stale: gen !== rosterGen }
        return list
      })
      .finally(() => { if (rosterInflight === entry) rosterInflight = null })
    rosterInflight = entry
  }
  return rosterInflight.promise
}

/**
 * Mark the roster stale (call after anyone's level changes). The bulk endpoint
 * has no per-employee fetch, so the whole roster re-fetches on its next view.
 * The id argument is accepted for call-site compatibility and not needed.
 */
export function invalidateRosterEmployee() {
  rosterGen++
  if (rosterCache) rosterCache = { ...rosterCache, stale: true }
}

/** One API row → the roster row shape the panel renders. */
function toRosterRow(r, positionsById) {
  const id = String(r?.personnel_id)
  const positionId = r?.position_id ?? null
  const known = positionId != null ? positionsById?.[positionId] ?? null : null
  const position = known ?? (positionId != null && r?.position_title != null
    ? { id: positionId, title: r.position_title, position_tier_id: r?.position_tier ?? null }
    : null)
  const salary = toAmount(r?.salary_amount)
  return {
    id,
    person: r,
    name: (r?.name ?? "").trim() || `รหัส ${id}`,
    branchId: r?.branch_id ?? null,
    branchName: r?.branch_name ?? null,
    positionId,
    position,
    tierId: r?.position_tier ?? known?.position_tier_id ?? null,
    level: toLevel(r?.salary_level), // 0 is a real level
    detailStatus: "ok",
    salary,
    salaryStatus: salary != null ? "ok" : "none",
    salarySource: salary != null ? r?.salary_source ?? null : null,
  }
}

/**
 * Every active employee with position, tier, level and monthly salary — one
 * GET /hr/salary-roster per load / refresh.
 *
 * row: { id, person, name, branchId, branchName, positionId, position, tierId, level,
 *        detailStatus: "ok", salary, salaryStatus: ok|none, salarySource: ladder|financial|null }
 *
 * `positionsById` (optional) enriches `position` with the full position record;
 * without it the row still carries { id, title, position_tier_id } from the response.
 *
 * peopleStatus: loading (nothing to show yet) | ok | error (failed with no data).
 * A failed re-fetch while rows are on screen keeps them and sets peopleError.
 * Errors (401 / 403 / network) surface as the apiAuth message via errText.
 */
export function useSalaryRoster(positionsById = {}) {
  const [state, setState] = useState(() => ({
    list: rosterCache?.list ?? null,
    status: rosterCache ? "ok" : "loading",
    error: "",
    fetching: !rosterCache || rosterCache.stale,
  }))
  const [run, setRun] = useState(0)

  useEffect(() => {
    if (rosterCache && !rosterCache.stale) return // fresh module cache — zero requests
    let alive = true
    fetchRoster()
      .then((list) => { if (alive) setState({ list, status: "ok", error: "", fetching: false }) })
      .catch((e) => {
        if (alive) {
          setState((s) => ({
            ...s,
            status: s.list ? "ok" : "error",
            error: errText(e, "โหลดรายชื่อเงินเดือนไม่สำเร็จ"),
            fetching: false,
          }))
        }
      })
    return () => { alive = false }
  }, [run])

  const rows = useMemo(
    () => (state.list ?? []).map((r) => toRosterRow(r, positionsById)),
    [state.list, positionsById],
  )

  const refresh = useCallback(() => {
    invalidateRosterEmployee()
    setState((s) => ({ ...s, error: "", fetching: true }))
    setRun((n) => n + 1)
  }, [])

  const retryPeople = useCallback(() => {
    setState((s) => ({ ...s, status: s.list ? "ok" : "loading", error: "", fetching: true }))
    setRun((n) => n + 1)
  }, [])

  return {
    rows,
    total: rows.length,
    peopleStatus: state.status,
    peopleError: state.error,
    refreshing: state.fetching && state.list != null,
    refresh,
    retryPeople,
  }
}
