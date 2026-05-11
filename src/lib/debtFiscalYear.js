// Helpers for resolving the current Thai fiscal year (Oct–Sep, BE) from the
// real calendar date. Matches the backend v2 rule for /debt/transactions/new-debt:
// the BE rejects any fiscal_year_id that does not correspond to today's FY,
// even if a future year exists in productyear.

export function getCurrentFiscalYearString(date = new Date()) {
  const ceYear = date.getFullYear()
  const month = date.getMonth() + 1
  const beStart = month >= 10 ? ceYear + 543 : ceYear + 542
  return `${beStart}/${beStart + 1}`
}

const normalize = (s) => String(s ?? "").replace(/\s+/g, "").trim()

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
