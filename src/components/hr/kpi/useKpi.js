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

const SENIOR_TITLE = /^(ผู้ช่วยผู้จัดการ|ผู้จัดการ)/

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
