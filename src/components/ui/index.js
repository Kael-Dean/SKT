// src/components/ui/index.js
// ─────────────────────────────────────────────────────────────────────────────
// Barrel for the foundation UI primitives. Import via relative path, e.g.
//   import { PageLoader, ErrorState, EmptyState, Card } from "../components/ui"
// (this project has no "@" alias — keep imports relative.)
// ─────────────────────────────────────────────────────────────────────────────
export {
  default as Skeleton,
  SkeletonText,
  SkeletonTableRows,
  SkeletonCard,
  SkeletonStat,
} from "./Skeleton"

export { default as PageLoader } from "./PageLoader"
export { default as ErrorState } from "./ErrorState"
export { default as EmptyState } from "./EmptyState"
export { default as Card, CardHeader } from "./Card"
export { default as Badge } from "./Badge"
