// Helpers for resolving the Thai fiscal year (ปีการผลิต) from a calendar date.
// Per api-handoff-v5-cohort: the Thai fiscal year runs **April–March**,
// Buddhist era, and is labelled "<beStart>/<beStart+1>" e.g. "2569/2570".
//
// Under the v5 cohort model the user picks fiscal_year_id (origination year)
// explicitly per entry — the backend enforces the rule (new_debt → current FY,
// seed → past FY, full_payoff/partial_payment → any year ≤ current). These
// helpers power the UI dropdown filtering + instant client-side validation so
// users get feedback before the request round-trips.

/** BE start-year of the fiscal year that a given date falls in (Apr–Mar). */
export function getFiscalYearBeStart(date = new Date()) {
  const ceYear = date.getFullYear()
  const month = date.getMonth() + 1 // 1–12
  // Apr–Dec → year started this calendar year; Jan–Mar → started last year.
  return month >= 4 ? ceYear + 543 : ceYear + 542
}

/** Fiscal year label e.g. "2569/2570" for the date (default: today). */
export function getCurrentFiscalYearString(date = new Date()) {
  const beStart = getFiscalYearBeStart(date)
  return `${beStart}/${beStart + 1}`
}

/** Same label, but for an arbitrary ISO date string ("YYYY-MM-DD"). */
export function getFiscalYearStringForDate(isoDate) {
  const d = parseISO(isoDate)
  return d ? getCurrentFiscalYearString(d) : ""
}

const normalize = (s) => String(s ?? "").replace(/\s+/g, "").trim()

/** Parse "YYYY-MM-DD" into a local Date, or null if malformed. */
function parseISO(isoDate) {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(isoDate || ""))
  if (!m) return null
  return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]))
}

/** The fiscalYears row whose label matches today's fiscal year, or null. */
export function findCurrentFiscalYear(fiscalYears) {
  const target = normalize(getCurrentFiscalYearString())
  return (
    (Array.isArray(fiscalYears) ? fiscalYears : []).find(
      (y) => normalize(y.year_name) === target
    ) || null
  )
}

export function findCurrentFiscalYearId(fiscalYears) {
  return findCurrentFiscalYear(fiscalYears)?.id ?? null
}

/** BE start-year parsed from a "2569/2570" label (NaN if unparseable). */
export function parseFiscalYearBeStart(yearName) {
  const m = /(\d{4})/.exec(String(yearName || ""))
  return m ? Number(m[1]) : NaN
}

/** True when the ISO date falls in the **current** fiscal year (payment/new-debt). */
export function isDateInCurrentFiscalYear(isoDate) {
  const d = parseISO(isoDate)
  if (!d) return false
  return getFiscalYearBeStart(d) === getFiscalYearBeStart()
}

/** True when the ISO date falls in a **past** fiscal year (old-debt only). */
export function isDateInPastFiscalYear(isoDate) {
  const d = parseISO(isoDate)
  if (!d) return false
  return getFiscalYearBeStart(d) < getFiscalYearBeStart()
}

/**
 * fiscalYears options that are **not in the future** — valid origination years
 * for a full_payoff / partial_payment (you may pay into any cohort ≤ current).
 * Newest first.
 */
export function selectableAppliedFiscalYears(fiscalYears) {
  const currentBeStart = getFiscalYearBeStart()
  return (Array.isArray(fiscalYears) ? fiscalYears : [])
    .filter((y) => {
      const be = parseFiscalYearBeStart(y.year_name)
      return Number.isNaN(be) || be <= currentBeStart
    })
    .slice()
    .sort((a, b) => parseFiscalYearBeStart(b.year_name) - parseFiscalYearBeStart(a.year_name))
}

/**
 * fiscalYears strictly **before** the current one — the only valid origination
 * years for a `seed` (historical carry-in) entry. Newest first.
 */
export function pastFiscalYears(fiscalYears) {
  const currentBeStart = getFiscalYearBeStart()
  return (Array.isArray(fiscalYears) ? fiscalYears : [])
    .filter((y) => {
      const be = parseFiscalYearBeStart(y.year_name)
      return !Number.isNaN(be) && be < currentBeStart
    })
    .slice()
    .sort((a, b) => parseFiscalYearBeStart(b.year_name) - parseFiscalYearBeStart(a.year_name))
}
