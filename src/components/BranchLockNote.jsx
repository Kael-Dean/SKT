// Helper text under a branch picker that is locked to the active branch (scope "own_branch").
import { Lock } from "lucide-react"
import { cx } from "../lib/styles"

export default function BranchLockNote({ id, className = "" }) {
  return (
    <p id={id} className={cx("mt-1 flex items-center gap-1 text-sm text-slate-500 dark:text-slate-400", className)}>
      <Lock aria-hidden="true" className="size-3.5 shrink-0" strokeWidth={2} />
      ล็อกที่สาขาที่ใช้งานอยู่
    </p>
  )
}
