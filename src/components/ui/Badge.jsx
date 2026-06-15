// src/components/ui/Badge.jsx
// ─────────────────────────────────────────────────────────────────────────────
// Pill badge. Maps a `tone` to the existing badge* constants in styles.js —
// no colors are redefined here.
// ─────────────────────────────────────────────────────────────────────────────
import {
  cx,
  badgeNeutral,
  badgePending,
  badgeSuccess,
  badgeDanger,
  badgeInfo,
} from "../../lib/styles"

const TONES = {
  neutral: badgeNeutral,
  pending: badgePending,
  success: badgeSuccess,
  danger: badgeDanger,
  info: badgeInfo,
}

/** Status pill. `tone`: neutral | pending | success | danger | info. */
export default function Badge({ tone = "neutral", className = "", children }) {
  return <span className={cx(TONES[tone] || badgeNeutral, className)}>{children}</span>
}
