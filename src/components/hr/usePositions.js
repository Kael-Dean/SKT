// src/components/hr/usePositions.js
// Load all positions (active + inactive) once per mount → { positions, byId, active, loading, error, reload }
import { useCallback, useEffect, useMemo, useState } from "react"
import { apiAuth } from "../../lib/api"
import { POSITIONS_PATH, errText } from "./positionUtils"

export default function usePositions() {
  const [positions, setPositions] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")

  const reload = useCallback(() => {
    setLoading(true)
    setError("")
    return apiAuth(POSITIONS_PATH)
      .then((d) => setPositions(Array.isArray(d) ? d : []))
      .catch((e) => setError(errText(e, "โหลดรายการตำแหน่งไม่สำเร็จ")))
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => { reload() }, [reload])

  const byId = useMemo(() => Object.fromEntries(positions.map((p) => [p.id, p])), [positions])
  const active = useMemo(
    () => positions.filter((p) => p.is_active !== false).sort((a, b) =>
      (a.position_tier_id ?? 99) - (b.position_tier_id ?? 99) || String(a.title).localeCompare(String(b.title), "th")),
    [positions],
  )

  return { positions, byId, active, loading, error, reload }
}
