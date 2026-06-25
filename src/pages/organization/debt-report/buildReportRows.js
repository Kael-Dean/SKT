// Shared transform: GET /debt/report rows (DebtReportRow[]) → the program×year
// matrix shape consumed by BranchDebtTable / AllBranchesTable / printDebtTable.
//
// Under the v4 waterfall model the server already aggregates every column
// (ยอดยกมา/เพิ่มในปี/รับชำระ/คงเหลือ + payment-method breakdown), so the client
// only reshapes — no balance math here. Money fields arrive as decimal strings.

const num = (v) => parseFloat(v) || 0
const int = (v) => Number(v) || 0

const ZERO_CELL = {
  carry_amount: 0, carry_count: 0,
  new_amount: 0, new_count: 0,
  paid_amount: 0, paid_count: 0,
  remain_amount: 0, remain_count: 0,
  mobile_amount: 0, mobile_count: 0,
  cash_amount: 0, cash_count: 0,
  produce_amount: 0, produce_count: 0,
  note: "",
}

function cellFromReportRow(r) {
  return {
    carry_amount:   num(r.carryover_amount),    carry_count:   int(r.carryover_count),
    new_amount:     num(r.new_debt_amount),      new_count:     int(r.new_debt_count),
    paid_amount:    num(r.paid_amount),          paid_count:    int(r.paid_count),
    remain_amount:  num(r.remaining_amount),     remain_count:  int(r.remaining_count),
    mobile_amount:  num(r.mobile_banking_amount), mobile_count: int(r.mobile_banking_count),
    cash_amount:    num(r.cash_amount),          cash_count:    int(r.cash_count),
    produce_amount: num(r.produce_trade_amount), produce_count: int(r.produce_trade_count),
    note: "",
  }
}

/**
 * Build the grouped table model. Renders every active program × every known
 * fiscal year; cells without a matching report row show zeros so the layout
 * stays stable (the report itself only returns rows that have activity).
 */
export function buildReportRows(programs, fiscalYears, reportRows) {
  const byKey = new Map()
  for (const r of Array.isArray(reportRows) ? reportRows : []) {
    byKey.set(`${r.program_id}-${r.fiscal_year_id}`, r)
  }
  return (programs || [])
    .filter((p) => p.is_active !== false)
    .map((prog) => ({
      program: prog,
      yearRows: (fiscalYears || []).map((fy) => {
        const r = byKey.get(`${prog.id}-${fy.id}`)
        return { fiscalYear: fy, ...(r ? cellFromReportRow(r) : ZERO_CELL) }
      }),
    }))
}

const COL_KEYS = [
  "carry_amount", "carry_count", "new_amount", "new_count",
  "paid_amount", "paid_count", "remain_amount", "remain_count",
  "mobile_amount", "mobile_count", "cash_amount", "cash_count",
  "produce_amount", "produce_count",
]

/** Sum every numeric column across all year rows for the footer totals. */
export function computeColTotals(tableRows) {
  const all = tableRows.flatMap((g) => g.yearRows)
  const out = {}
  for (const k of COL_KEYS) out[k] = all.reduce((s, r) => s + (r[k] || 0), 0)
  return out
}
