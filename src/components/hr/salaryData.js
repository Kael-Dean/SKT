// src/components/hr/salaryData.js
// Data hooks for the salary step / history views (no Context — hooks + module caches only).
//   useEmployeeSalary(empId, refreshKey, positionsById)  GET /hr/personnel/{id}
//   useSalaryLookup(tierId, level, { debounce })           GET /hr/salary-ladder/lookup?tier&level
//   useLadderMax(tierId)                                   GET /hr/salary-ladder?tier=
//   useSalaryRoster(positionsById)                         GET /hr/personnel?is_active=true
//                                                          + GET /hr/personnel/{id} × N (pool of 6)
//                                                          + GET /hr/salary-ladder?tier= × distinct tiers
//     TODO(backend): switch useSalaryRoster to GET /hr/salary-roster (1 request) once it ships —
//     see handoff/backend-request-salary-roster.md
//
// Every result is keyed by its input (employee id / "tier:level" / tier). A result
// whose key doesn't match the current input is never returned, so switching
// employee can't flash the previous person's level, salary or preview. Each
// effect also carries an `alive` flag so late responses are dropped.
// apiAuth has no AbortSignal support, hence alive flags instead of AbortController.
import { useCallback, useEffect, useMemo, useState } from "react"
import { apiAuth } from "../../lib/api"
import { employeeName, errText, tierQuery } from "./positionUtils"
import { getCachedPersonnel, loadPersonnel, refreshPersonnel, subscribePersonnel } from "./personnelCache"

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
 * per tier, shared by useLadderMax (step preview) and useSalaryRoster (roster).
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
// No bulk endpoint yet, so level comes from GET /hr/personnel/{id} per person
// (pool of ROSTER_CONCURRENCY) and the amount from each tier's ladder.
// Details are cached per employee id at module level: switching sub-tabs and
// coming back costs zero requests. Call invalidateRosterEmployee(id) after a
// step award; refresh() drops everything.

const ROSTER_CONCURRENCY = 6
const rosterDetail = new Map() // id → { level, positionId, financialSalary }
const rosterInflight = new Map() // id → Promise (dedupes overlapping runs)

const toLevel = (raw) => (raw == null || raw === "" || Number.isNaN(Number(raw)) ? null : Number(raw))

function loadRosterDetail(id) {
  if (rosterDetail.has(id)) return Promise.resolve(rosterDetail.get(id))
  if (!rosterInflight.has(id)) {
    const p = apiAuth(`/hr/personnel/${id}`)
      .then((d) => {
        const v = {
          level: toLevel(d?.personnel_info?.salary_level),
          positionId: d?.position ?? null,
          financialSalary: toAmount(d?.financial?.current_salary),
        }
        rosterDetail.set(id, v)
        return v
      })
      .finally(() => rosterInflight.delete(id))
    rosterInflight.set(id, p)
  }
  return rosterInflight.get(id)
}

/** Forget one employee's cached roster row (call after their level changes). */
export function invalidateRosterEmployee(id) {
  if (id != null && id !== "") rosterDetail.delete(String(id))
}

const detailsFromCache = () => {
  const out = {}
  rosterDetail.forEach((v, id) => { out[id] = { status: "ok", ...v } })
  return out
}
const laddersFromCache = () => {
  const out = {}
  ladderResolved.forEach((ladder, k) => { out[k] = { status: "ok", ladder } })
  return out
}

/**
 * Every active employee with position, tier, level and monthly salary.
 * Rows stream in: a row's level/salary is "loading" until its detail lands.
 *
 * row: { id, person, name, branchId, positionId, position, tierId, level,
 *        detailStatus: loading|ok|error,
 *        salary, salaryStatus: loading|ok|none|error, salarySource: ladder|financial|null }
 *
 * Salary = ladder amount for (tier, level); falls back to financial.current_salary
 * when the person has no tier/level or the ladder has no such level.
 */
export function useSalaryRoster(positionsById = {}, { positionsReady = true } = {}) {
  const [people, setPeople] = useState(() => {
    const cached = getCachedPersonnel()
    return { list: cached, status: cached ? "ok" : "loading", error: "" }
  })
  const [peopleAttempt, setPeopleAttempt] = useState(0)
  const [details, setDetails] = useState(detailsFromCache)
  const [ladders, setLadders] = useState(laddersFromCache)
  const [run, setRun] = useState(0)
  const [refreshing, setRefreshing] = useState(false)

  // 1) active personnel list (shared module cache with EmployeePicker)
  useEffect(() => {
    let alive = true
    const unsubscribe = subscribePersonnel((fresh) => {
      if (alive && fresh) setPeople({ list: fresh, status: "ok", error: "" })
    })
    loadPersonnel()
      .then((d) => { if (alive) setPeople({ list: d, status: "ok", error: "" }) })
      .catch((e) => {
        if (alive) {
          setPeople((s) => ({ ...s, status: s.list ? "ok" : "error", error: errText(e, "โหลดรายชื่อเจ้าหน้าที่ไม่สำเร็จ") }))
        }
      })
    return () => {
      alive = false
      unsubscribe()
    }
  }, [peopleAttempt])

  const ids = useMemo(() => (people.list ?? []).map((p) => String(p.id)), [people.list])

  // 2) per-employee detail through a fixed-size pool; late responses after
  //    unmount / refresh still fill the module cache but never touch state.
  useEffect(() => {
    let alive = true
    setDetails((d) => {
      let changed = false
      const next = { ...d }
      for (const id of ids) {
        if (next[id]?.status !== "ok" && rosterDetail.has(id)) {
          next[id] = { status: "ok", ...rosterDetail.get(id) }
          changed = true
        }
      }
      return changed ? next : d
    })
    const queue = ids.filter((id) => !rosterDetail.has(id))
    let cursor = 0
    const worker = async () => {
      while (alive && cursor < queue.length) {
        const id = queue[cursor++]
        try {
          const v = await loadRosterDetail(id)
          if (alive) setDetails((d) => ({ ...d, [id]: { status: "ok", ...v } }))
        } catch (e) {
          if (alive) setDetails((d) => ({ ...d, [id]: { status: "error", error: errText(e, "โหลดข้อมูลไม่สำเร็จ") } }))
        }
      }
    }
    for (let i = 0; i < Math.min(ROSTER_CONCURRENCY, queue.length); i++) worker()
    return () => { alive = false }
  }, [ids, run])

  // 3) one ladder request per distinct tier in use
  const tierKey = useMemo(() => {
    const tiers = new Set()
    for (const p of people.list ?? []) {
      const det = details[String(p.id)]
      const pid = (det?.status === "ok" ? det.positionId : null) ?? p.position
      const t = pid != null ? positionsById?.[pid]?.position_tier_id : null
      if (t != null && t !== "") tiers.add(String(Number(t)))
    }
    return [...tiers].sort().join(",")
  }, [people.list, details, positionsById])

  useEffect(() => {
    if (!tierKey) return
    let alive = true
    for (const k of tierKey.split(",")) {
      if (ladderResolved.has(k)) {
        const ladder = ladderResolved.get(k)
        setLadders((l) => (l[k]?.ladder === ladder ? l : { ...l, [k]: { status: "ok", ladder } }))
        continue
      }
      loadLadder(k)
        .then((ladder) => { if (alive) setLadders((l) => ({ ...l, [k]: { status: "ok", ladder } })) })
        .catch(() => { if (alive) setLadders((l) => ({ ...l, [k]: { status: "error", ladder: null } })) })
    }
    return () => { alive = false }
  }, [tierKey, run])

  const rows = useMemo(
    () => (people.list ?? []).map((p) => {
      const id = String(p.id)
      const det = details[id]
      const detailStatus = det ? det.status : "loading"
      const ok = detailStatus === "ok"
      const positionId = (ok ? det.positionId : null) ?? p.position ?? null
      const position = positionId != null ? positionsById?.[positionId] ?? null : null
      const tierId = position?.position_tier_id ?? null
      const level = ok ? det.level : null

      let salary = null
      let salarySource = null
      let salaryStatus = "loading"
      if (detailStatus === "error") salaryStatus = "error"
      else if (ok && positionsReady) {
        const lad = tierId != null && tierId !== "" ? ladders[String(Number(tierId))] : null
        if (tierId != null && level != null && !lad) {
          salaryStatus = "loading" // ladder for this tier still on its way
        } else {
          const fromLadder = lad?.status === "ok" && level != null ? lad.ladder.get(level) ?? null : null
          if (fromLadder != null) { salary = fromLadder; salarySource = "ladder" }
          else if (det.financialSalary != null) { salary = det.financialSalary; salarySource = "financial" }
          salaryStatus = salary != null ? "ok" : "none"
        }
      }

      return {
        id,
        person: p,
        name: employeeName(p),
        branchId: p.branch_location ?? null,
        positionId,
        position,
        tierId,
        level,
        detailStatus,
        salary,
        salaryStatus,
        salarySource,
      }
    }),
    [people.list, details, ladders, positionsById, positionsReady],
  )

  const done = rows.reduce((n, r) => n + (r.detailStatus !== "loading" ? 1 : 0), 0)
  const failed = rows.reduce((n, r) => n + (r.detailStatus === "error" ? 1 : 0), 0)

  const refresh = useCallback(() => {
    rosterDetail.clear()
    clearSalaryCaches()
    setDetails({})
    setLadders({})
    setRefreshing(true)
    refreshPersonnel()
      .catch((e) => setPeople((s) => ({ ...s, status: s.list ? "ok" : "error", error: errText(e, "โหลดรายชื่อเจ้าหน้าที่ไม่สำเร็จ") })))
      .finally(() => setRefreshing(false))
    setRun((n) => n + 1)
  }, [])

  /** Re-request only the rows (and ladders) that failed. */
  const retryFailed = useCallback(() => {
    setDetails((d) => Object.fromEntries(Object.entries(d).filter(([, v]) => v.status !== "error")))
    setLadders((l) => Object.fromEntries(Object.entries(l).filter(([, v]) => v.status !== "error")))
    setRun((n) => n + 1)
  }, [])

  const retryPeople = useCallback(() => {
    setPeople((s) => ({ ...s, status: s.list ? "ok" : "loading", error: "" }))
    setPeopleAttempt((n) => n + 1)
  }, [])

  return {
    rows,
    total: rows.length,
    done,
    failed,
    peopleStatus: people.status,
    peopleError: people.error,
    refreshing,
    refresh,
    retryFailed,
    retryPeople,
  }
}
