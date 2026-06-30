// Shared transform: GET /debt/report rows (DebtReportRowOut[]) → the
// program × cohort-year matrix the tables render.
//
// v5 cohort model (api-handoff-v5-cohort): the server returns one row per
// cohort = (branch × program × origination year), already fully aggregated
// (ยกมา / เพิ่มในปี / ชำระ / คงเหลือ + payment-method breakdown). We group by
// program and, within a program, by origination year — summing across branches
// so the single-branch and all-branches views share one shape. The report only
// returns cohorts that are still visible, so there is no zero-filling. Money
// fields arrive as decimal strings; ชำระ has a count (full payoffs only) while
// the method breakdown is amount-only.

const num = (v) => parseFloat(v) || 0
const int = (v) => Number(v) || 0

function emptyCell(fy) {
  return {
    fiscalYear: fy,
    carry_amount: 0, carry_count: 0,
    new_amount: 0, new_count: 0,
    paid_amount: 0, paid_count: 0,
    remain_amount: 0, remain_count: 0,
    mobile_amount: 0, cash_amount: 0, produce_amount: 0,
    note: "",
  }
}

/**
 * @param {DebtReportRowOut[]} rows — the `rows` array from DebtReportResponse.
 * @returns {{ program, yearRows }[]} grouped by program, year rows ascending.
 */
export function buildReportRows(rows) {
  const list = Array.isArray(rows) ? rows : []
  const progs = new Map() // program_id -> { program, years: Map(fy_id -> cell) }

  for (const r of list) {
    const pid = r.program_id
    if (!progs.has(pid)) {
      progs.set(pid, {
        program: { id: pid, prog_name: r.program_name || `โครงการ ${pid}` },
        years: new Map(),
      })
    }
    const g = progs.get(pid)
    const fyId = r.fiscal_year_id
    if (!g.years.has(fyId)) {
      g.years.set(fyId, emptyCell({ id: fyId, year_name: r.fiscal_year || String(fyId) }))
    }
    const c = g.years.get(fyId)
    c.carry_amount  += num(r.carry_in_amount);  c.carry_count  += int(r.carry_in_count)
    c.new_amount    += num(r.new_amount);        c.new_count    += int(r.new_count)
    c.paid_amount   += num(r.paid_amount);       c.paid_count   += int(r.paid_count)
    c.remain_amount += num(r.remaining_amount);  c.remain_count += int(r.remaining_count)
    c.mobile_amount  += num(r.paid_mobile_amount)
    c.cash_amount    += num(r.paid_cash_amount)
    c.produce_amount += num(r.paid_produce_amount)
  }

  return Array.from(progs.values())
    .map((g) => ({
      program: g.program,
      yearRows: Array.from(g.years.values()).sort(
        (a, b) => (a.fiscalYear.id || 0) - (b.fiscalYear.id || 0)
      ),
    }))
    .sort((a, b) => String(a.program.prog_name).localeCompare(String(b.program.prog_name), "th"))
}

const COL_KEYS = [
  "carry_amount", "carry_count", "new_amount", "new_count",
  "paid_amount", "paid_count", "remain_amount", "remain_count",
  "mobile_amount", "cash_amount", "produce_amount",
]

/** Sum every numeric column across an arbitrary set of cohort rows. */
export function sumRows(rows) {
  const out = {}
  for (const k of COL_KEYS) out[k] = rows.reduce((s, r) => s + (r[k] || 0), 0)
  return out
}

/** Sum every numeric column across all year rows for the footer totals. */
export function computeColTotals(tableRows) {
  return sumRows(tableRows.flatMap((g) => g.yearRows))
}
