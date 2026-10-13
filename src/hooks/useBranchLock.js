// src/hooks/useBranchLock.js
// ─────────────────────────────────────────────────────────────────────────────
// Branch-scope lock for "which branch's data" pickers (backend PR #13 RBAC).
//
//   scope "all" / Super Admin / old backend → canPickAnyBranch() = true → nothing changes
//   scope "own_branch"                      → picker locked to the active branch (JWT)
//
//   const branchLock = useBranchLock()      // { locked, activeId, activeKey }
//   <ComboBox disabled={branchLock.locked} … />  {branchLock.locked && <BranchLockNote />}
//   params.set("branch_id", scopedBranchId(filters.branchId))   // never sends another branch
//
// Only for view/filter/report/record-against pickers. Destination / assignment pickers
// (relocation target, new-staff branch, transfer destination, BranchSwitcher) stay free.
// ─────────────────────────────────────────────────────────────────────────────
import { canPickAnyBranch, useCan } from "../lib/permissions"
import { getActiveBranch } from "../lib/auth"

/** Re-renders when permissions load. `activeKey` = active branch id as string ("" if none). */
export default function useBranchLock() {
  const { canPickAnyBranch: canPick } = useCan()
  const locked = !canPick()
  const activeId = locked ? getActiveBranch() : null
  return { locked, activeId, activeKey: activeId == null ? "" : String(activeId) }
}

/**
 * Branch id to put in a request, read fresh (safe inside stale closures).
 * Unlocked → `picked` unchanged. Locked → the active branch, in the same shape as `picked`
 * (string stays string, otherwise number; no active branch → `picked`'s empty value).
 */
export function scopedBranchId(picked) {
  if (canPickAnyBranch()) return picked
  const a = getActiveBranch()
  if (typeof picked === "string") return a == null ? "" : String(a)
  return a
}
