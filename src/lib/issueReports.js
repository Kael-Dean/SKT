// src/lib/issueReports.js
// แจ้งแก้ไขข้อมูล (3F) — shared labels/helpers for the employee history (MyProfile)
// and the HR list (components/hr/IssueReportsPanel.jsx) + stats tab.

/** Status → Thai label + Badge tone. Current API: pending/resolved/rejected;
 *  approved/denied/applied kept for rows written by older backends. */
export const ISSUE_STATUS = {
  pending: { label: "ค้างพิจารณา", tone: "pending" },
  resolved: { label: "แก้ไขแล้ว", tone: "success" },
  approved: { label: "แก้ไขแล้ว", tone: "success" },
  applied: { label: "บันทึกแล้ว", tone: "success" },
  rejected: { label: "ปฏิเสธ", tone: "danger" },
  denied: { label: "ปฏิเสธ", tone: "danger" },
}

export const issueStatus = (s) => ISSUE_STATUS[s] || { label: s || "—", tone: "neutral" }
export const isResolvedStatus = (s) => s === "resolved" || s === "approved" || s === "applied"
export const isRejectedStatus = (s) => s === "rejected" || s === "denied"

/**
 * "ค่าเดิม" per handoff: old_value (real record value, set at approval) on resolved rows,
 * current_value (what the employee typed) on pending/rejected rows.
 * Returns { value, source: "record" | "employee" }.
 */
export function previousValueOf(row) {
  if (isResolvedStatus(row?.status) && row?.old_value != null && row.old_value !== "") {
    return { value: row.old_value, source: "record" }
  }
  return { value: row?.current_value ?? null, source: "employee" }
}

/** financial_other has no single value — the backend stores "-" as correct_value */
export const hasNewValue = (row) => row?.correct_value != null && row.correct_value !== "" && row.correct_value !== "-"

/** Short Thai date, e.g. "18 ต.ค. 69" */
export function fmtShortDate(d) {
  if (!d) return ""
  const dt = new Date(d)
  if (Number.isNaN(dt.getTime())) return String(d)
  return dt.toLocaleDateString("th-TH", { day: "numeric", month: "short", year: "2-digit" })
}

/** Age wording: pending → "รอ 4 วัน", resolved → "ใช้เวลา 2 วัน" */
export function ageText(row) {
  const d = row?.age_days
  if (d == null) return ""
  if (row.status === "pending") return d <= 0 ? "ส่งวันนี้" : `รอ ${d} วัน`
  return d <= 0 ? "เสร็จในวันเดียว" : `ใช้เวลา ${d} วัน`
}

export const fullName = (r) => [r?.user_first_name, r?.user_last_name].filter(Boolean).join(" ") || `ผู้ใช้ #${r?.user_id ?? "?"}`
