// src/components/hr/kpi/useKpi.js
// Data hooks for the KPI tab (React hooks only — no Context, project rule).
//   useFiscalYearInfo(fy)        GET /hr/kpi/fiscal-years/{fy}
//   useEvaluations(fy, status?)  GET /hr/kpi/evaluations?fiscal_year=&status=
//   useKpiPeople()               names + senior-position flag from /hr/personnel + /hr/positions
import { useCallback, useEffect, useMemo, useState } from "react"
import { apiAuth } from "../../../lib/api"
import { getCachedPersonnel, loadPersonnel } from "../personnelCache"
import { POSITIONS_PATH, employeeName, errText } from "../positionUtils"

export function useFiscalYearInfo(fy) {
  const [info, setInfo] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")

  const reload = useCallback(() => {
    setLoading(true)
    setError("")
    return apiAuth(`/hr/kpi/fiscal-years/${Number(fy)}`)
      .then((d) => setInfo(d && typeof d === "object" ? d : null))
      .catch((e) => { setInfo(null); setError(errText(e, "โหลดข้อมูลปีบัญชีไม่สำเร็จ")) })
      .finally(() => setLoading(false))
  }, [fy])

  useEffect(() => { reload() }, [reload])
  return { info, setInfo, loading, error, reload }
}

export function useEvaluations(fy, status) {
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")

  const reload = useCallback(() => {
    setLoading(true)
    setError("")
    const q = new URLSearchParams({ fiscal_year: String(Number(fy)) })
    if (status) q.set("status", status)
    return apiAuth(`/hr/kpi/evaluations?${q}`)
      .then((d) => setRows(Array.isArray(d) ? d : []))
      .catch((e) => { setRows([]); setError(errText(e, "โหลดรายการประเมินไม่สำเร็จ")) })
      .finally(() => setLoading(false))
  }, [fy, status])

  useEffect(() => { reload() }, [reload])
  return { rows, loading, error, reload }
}

// ─── 3L rework ───────────────────────────────────────────────────────────────
// GET /hr/kpi/form-items — the static catalogue (12 items, 3 groups, month order,
// grade bands, schemes). Any logged-in user. Cached for the session (module level).
let catalogueCache = null
let cataloguePromise = null

function loadCatalogue() {
  if (catalogueCache) return Promise.resolve(catalogueCache)
  if (!cataloguePromise) {
    cataloguePromise = apiAuth("/hr/kpi/form-items")
      .then((d) => {
        catalogueCache = d && typeof d === "object" ? d : null
        return catalogueCache
      })
      .finally(() => { cataloguePromise = null })
  }
  return cataloguePromise
}

export function useFormItems() {
  const [data, setData] = useState(catalogueCache)
  const [loading, setLoading] = useState(!catalogueCache)
  const [error, setError] = useState("")
  const [attempt, setAttempt] = useState(0)

  useEffect(() => {
    if (catalogueCache) return undefined
    let alive = true
    setLoading(true)
    loadCatalogue()
      .then((d) => { if (alive) { setData(d); setError("") } })
      .catch((e) => { if (alive) setError(errText(e, "โหลดรายการแบบประเมินไม่สำเร็จ")) })
      .finally(() => { if (alive) setLoading(false) })
    return () => { alive = false }
  }, [attempt])

  const retry = useCallback(() => setAttempt((n) => n + 1), [])
  return { catalogue: data, loading, error, retry }
}

/** GET /hr/employees/{id}/kpi/form?fiscal_year= — items × months grid (null id = idle) */
export function useMonthlyForm(userId, fy) {
  const [form, setForm] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")

  const reload = useCallback(() => {
    if (!userId) { setForm(null); setError(""); return Promise.resolve() }
    setLoading(true)
    setError("")
    return apiAuth(`/hr/employees/${Number(userId)}/kpi/form?fiscal_year=${Number(fy)}`)
      .then((d) => setForm(d && typeof d === "object" ? d : null))
      .catch((e) => { setForm(null); setError(errText(e, "โหลดแบบประเมินรายเดือนไม่สำเร็จ")) })
      .finally(() => setLoading(false))
  }, [userId, fy])

  useEffect(() => { reload() }, [reload])
  return { form, setForm, loading, error, reload }
}

/**
 * GET /hr/kpi/evaluations/{id}/self-assessment?fiscal_year= — evaluator view.
 * `null` body = the employee hasn't submitted. Skipped when `enabled` is false
 * (no permission → don't fire a 403 toast).
 */
export function useEvaluateeSelfAssessment(userId, fy, enabled) {
  const [state, setState] = useState({ data: null, loading: false, error: "", key: "" })
  const key = enabled && userId ? `${userId}:${fy}` : ""

  useEffect(() => {
    if (!key) return undefined
    let alive = true
    setState({ data: null, loading: true, error: "", key })
    apiAuth(`/hr/kpi/evaluations/${Number(userId)}/self-assessment?fiscal_year=${Number(fy)}`)
      .then((d) => { if (alive) setState({ data: d && typeof d === "object" ? d : null, loading: false, error: "", key }) })
      .catch((e) => {
        if (!alive) return
        // 404 = no evaluation yet → treat like "not submitted"
        setState({ data: null, loading: false, error: e?.status === 404 ? "" : errText(e, "โหลดแบบประเมินตนเองไม่สำเร็จ"), key })
      })
    return () => { alive = false }
  }, [key, userId, fy])

  return state.key === key ? state : { data: null, loading: !!key, error: "", key }
}

const SENIOR_TITLE =/^(ผู้ช่วยผู้จัดการ|ผู้จัดการ)/

/**
 * Directory for showing names instead of bare ids. Both requests may be
 * forbidden for some roles (e.g. 7) — then names fall back to "รหัส {id}".
 */
export function useKpiPeople() {
  const [people, setPeople] = useState(() => getCachedPersonnel() ?? [])
  const [positions, setPositions] = useState([])

  useEffect(() => {
    let alive = true
    loadPersonnel().then((list) => { if (alive) setPeople(list) }).catch(() => {})
    apiAuth(POSITIONS_PATH)
      .then((d) => { if (alive && Array.isArray(d)) setPositions(d) })
      .catch(() => {})
    return () => { alive = false }
  }, [])

  return useMemo(() => {
    const byId = new Map(people.map((p) => [String(p.id), p]))
    const posById = new Map(positions.map((p) => [String(p.id), p]))
    const positionOf = (id) => {
      const rec = byId.get(String(id))
      return rec ? posById.get(String(rec.position)) ?? null : null
    }
    return {
      nameOf: (id) => {
        const rec = byId.get(String(id))
        return rec ? employeeName(rec) : `รหัส ${id}`
      },
      titleOf: (id) => positionOf(id)?.title ?? "",
      /** ผช.ผจก. / ผจก. — approval needs board_reference */
      isSenior: (id) => {
        const pos = positionOf(id)
        if (!pos) return false
        const tier = Number(pos.position_tier_id)
        return tier === 8 || tier === 9 || SENIOR_TITLE.test(String(pos.title ?? ""))
      },
    }
  }, [people, positions])
}
