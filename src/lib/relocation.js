// Relocation helpers shared by the employee form (MyRelocation) and the HR approval/history tabs.
//
// AMC meeting fixes (#29) — PUT /personnel/me/relocation:
//   - at most 2 branch choices (branch_pref_1..2) and 2 optional position choices (position_pref_1..2);
//     sending pref 3..5 returns 422
//   - accept_without_position_change (bool) is REQUIRED when a position is requested and must be
//     OMITTED otherwise (sending it without a position also returns 422)
// The flag comes back on the employee's own and the HR relocation outputs.
import { useCallback, useEffect, useMemo, useState } from "react"
import { apiAuth } from "./api"
import { can } from "./permissions"

export const MAX_BRANCH_PREFS = 2
export const MAX_POSITION_PREFS = 2

export const ACCEPT_WITHOUT_POSITION_QUESTION = "ถ้าเปลี่ยนตำแหน่งไม่ได้ ยังจะย้ายหรือไม่"

export const ACCEPT_WITHOUT_POSITION_OPTIONS = [
  { value: "true", label: "ย้าย" },
  { value: "false", label: "ไม่ย้าย" },
]

/** true → "ย้าย", false → "ไม่ย้าย", anything else → null (not asked) */
export function acceptWithoutPositionLabel(v) {
  if (v === true) return "ย้าย"
  if (v === false) return "ไม่ย้าย"
  return null
}

/** Branch pref ids in order. Older rows may still carry pref 3..5 — keep showing them. */
export function branchPrefIds(r) {
  if (!r) return []
  return [1, 2, 3, 4, 5].map((n) => r[`branch_pref_${n}`]).filter((v) => v != null && v !== "")
}

/** Position prefs as [{ n, id, name }] — `name` is whatever label the row already carries. */
export function positionPrefs(r) {
  if (!r) return []
  return [1, 2, 3, 4, 5]
    .map((n) => ({
      n,
      id: r[`position_pref_${n}`],
      name: r[`position_pref_${n}_name`] ?? r[`position_pref_${n}_title`] ?? null,
    }))
    .filter((p) => p.id != null && p.id !== "")
}

/** Active + retired positions. Retired ones (e.g. the old branch-named "หัวหน้าสาขาปราสาท") are needed to
 * resolve ids on existing requests; the dropdown only offers active ones. */
const POSITIONS_ALL_PATH = "/hr/positions?include_inactive=true"

/**
 * Position list for dropdowns / id → title lookup. GET /hr/positions needs `position.view`
 * (checked through the permission registry); without it the list stays empty and callers fall
 * back to the raw id.
 *   positions     → active only (pick lists)
 *   positionName  → resolves any id, retired ones included (request history / approval screens)
 */
export function usePositionLookup() {
  const allowed = can("hr.positions.view")
  const [all, setAll] = useState([])
  const [loading, setLoading] = useState(allowed)

  useEffect(() => {
    if (!allowed) return
    let alive = true
    apiAuth(POSITIONS_ALL_PATH)
      .then((d) => { if (alive) setAll(Array.isArray(d) ? d.filter(Boolean) : []) })
      .catch(() => { if (alive) setAll([]) })
      .finally(() => { if (alive) setLoading(false) })
    return () => { alive = false }
  }, [allowed])

  const positions = useMemo(() => all.filter((p) => p.is_active !== false), [all])
  const byId = useMemo(
    () => new Map(all.map((p) => [String(p.id), p.title ?? p.name ?? p.position_title ?? `ตำแหน่ง #${p.id}`])),
    [all],
  )
  const positionName = useCallback(
    (id, fallback) => (id == null || id === "" ? "—" : fallback || byId.get(String(id)) || `ตำแหน่ง #${id}`),
    [byId],
  )

  return { positions, loading, positionName }
}
