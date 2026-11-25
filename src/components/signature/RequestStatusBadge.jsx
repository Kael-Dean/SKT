// src/components/signature/RequestStatusBadge.jsx
import { REQUEST_STATUS } from "../../lib/signatures"
import { badgeDanger, badgeNeutral, badgePending, badgeSuccess } from "../../lib/styles"

const TONE = { pending: badgePending, success: badgeSuccess, danger: badgeDanger, neutral: badgeNeutral }

export default function RequestStatusBadge({ status }) {
  const s = REQUEST_STATUS[status] ?? { label: status || "—", tone: "neutral" }
  return <span className={TONE[s.tone]}>{s.label}</span>
}
