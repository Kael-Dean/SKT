// src/components/hr/FinanceSavingsLoans.jsx
// ─────────────────────────────────────────────────────────────────────────────
// เงินสะสม + เงินกู้กองทุนสงเคราะห์ — แสดงจาก financial object เดิม (api-handoff PR 105, 2026-11-20)
//   ใช้ร่วม: MyFinancial (GET /personnel/me/financial) และ HRPersonnelDetail (GET /hr/personnel/{id})
//   field ใหม่: savings_balance, savings_monthly, savings{…recent[]}, loan_outstanding, loan_monthly, loans[]
// ─────────────────────────────────────────────────────────────────────────────
import { useState } from "react"
import { ChevronDown } from "lucide-react"
import { money } from "../../lib/payroll"
import { thaiDate } from "../../lib/loans"
import { cx, focusRingCls } from "../../lib/styles"

const KIND_LABEL = {
  opening: "ยอดยกมา",
  deposit: "ฝากเงินสะสม",
  interest: "ดอกเบี้ย",
  withdrawal: "ถอน",
  adjustment: "ปรับปรุงยอด",
}

const H3 = "text-xs font-semibold text-gray-500 dark:text-gray-400"
const TH = "px-2 py-1.5 text-xs font-medium text-gray-500 dark:text-gray-400"
const TD = "px-2 py-2 tabular-nums"

function Line({ label, value, strong, hint }) {
  return (
    <div className="flex items-baseline justify-between gap-4 py-2 text-sm">
      <dt className={cx(strong ? "font-medium text-gray-900 dark:text-gray-100" : "text-gray-700 dark:text-gray-300")}>
        {label}
        {hint && <span className="block text-xs font-normal text-gray-500 dark:text-gray-400">{hint}</span>}
      </dt>
      <dd className={cx("tabular-nums text-right text-gray-900 dark:text-gray-100", strong && "text-base font-semibold")}>{value}</dd>
    </div>
  )
}

function ExpandBtn({ open, onClick, children }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-expanded={open}
      className={cx("mt-1 inline-flex min-h-touch md:pointer-fine:min-h-0 items-center gap-1 rounded px-1 text-sm font-medium text-indigo-700 hover:underline dark:text-indigo-300 cursor-pointer", focusRingCls)}
    >
      {children}
      <ChevronDown aria-hidden="true" className={cx("size-4 transition-transform duration-200", open && "rotate-180")} />
    </button>
  )
}

// ─── เงินสะสม ────────────────────────────────────────────────────────────────
export function SavingsBlock({ fin }) {
  const [all, setAll] = useState(false)
  const s = fin?.savings
  const balance = fin?.savings_balance ?? s?.balance
  const monthly = fin?.savings_monthly ?? s?.monthly_deposit
  if (balance == null && !s) {
    return (
      <section aria-label="เงินสะสม">
        <h3 className={H3}>เงินสะสม</h3>
        <p className="mt-1.5 py-2 text-sm text-gray-500 dark:text-gray-400">ยังไม่มีบัญชีเงินสะสม</p>
      </section>
    )
  }
  const recent = Array.isArray(s?.recent) ? s.recent : []
  const rows = all ? recent : recent.slice(0, 6)
  return (
    <section aria-label="เงินสะสม">
      <h3 className={H3}>เงินสะสม</h3>
      <dl className="mt-1.5 divide-y divide-gray-100 dark:divide-line">
        <Line label="ยอดเงินสะสมทั้งหมด" value={money(balance)} strong />
        <Line label="หักต่อเดือน" value={monthly == null ? "—" : money(monthly)} />
        {s?.accrued_interest != null && (
          <Line label="ดอกเบี้ยสะสม" hint="ยังไม่เข้าบัญชี — เข้าตอนสิ้นปีบัญชี 31 มี.ค." value={money(s.accrued_interest)} />
        )}
        {s?.deposits_this_fy != null && <Line label="ฝากในปีบัญชีนี้" value={money(s.deposits_this_fy)} />}
      </dl>
      {s?.as_of && <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">ยอด ณ {thaiDate(s.as_of)}</p>}

      {recent.length > 0 && (
        <div className="mt-3">
          <p className={H3}>รายการล่าสุด</p>
          <div className="mt-1 overflow-x-auto">
            <table className="w-full min-w-[26rem] text-sm">
              <thead>
                <tr className="border-b border-gray-200 text-left dark:border-line">
                  <th scope="col" className={TH}>วันที่</th>
                  <th scope="col" className={TH}>รายการ</th>
                  <th scope="col" className={cx(TH, "text-right")}>จำนวน</th>
                  <th scope="col" className={cx(TH, "text-right")}>คงเหลือ</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-line">
                {rows.map((r, i) => (
                  <tr key={`${r.txn_date}-${i}`} className="text-gray-800 dark:text-gray-200">
                    <td className={cx(TD, "whitespace-nowrap")}>{thaiDate(r.txn_date)}</td>
                    <td className="px-2 py-2">{KIND_LABEL[r.kind] ?? r.kind}</td>
                    <td className={cx(TD, "text-right")}>{money(r.amount)}</td>
                    <td className={cx(TD, "text-right")}>{money(r.balance_after)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {recent.length > 6 && (
            <ExpandBtn open={all} onClick={() => setAll((v) => !v)}>
              {all ? "แสดงน้อยลง" : `ดูทั้งหมด ${recent.length} รายการ`}
            </ExpandBtn>
          )}
        </div>
      )}
    </section>
  )
}

// ─── เงินกู้ (หนึ่งสัญญา) ─────────────────────────────────────────────────────
function LoanItem({ loan }) {
  const [all, setAll] = useState(false)
  const [openHist, setOpenHist] = useState(false)
  const next = loan.next_instalment
  const hist = Array.isArray(loan.paid_history) ? loan.paid_history : []
  const rows = all ? hist : hist.slice(0, 6)
  return (
    <div className="py-3 first:pt-1">
      <p className="text-sm font-medium text-gray-900 dark:text-gray-100">
        สัญญาเลขที่ {loan.contract_no ?? "—"}
        {loan.disbursed_on && <span className="font-normal text-gray-500 dark:text-gray-400"> · รับเงิน {thaiDate(loan.disbursed_on)}</span>}
      </p>
      <dl className="mt-1 divide-y divide-gray-100 dark:divide-line">
        <Line label="ต้นเงินคงเหลือ" value={money(loan.outstanding)} strong />
        <Line label="วงเงินกู้" value={money(loan.amount)} />
        <Line
          label="ชำระต้นแล้ว"
          hint={loan.instalments_total ? `${loan.instalments_paid ?? 0}/${loan.instalments_total} งวด` : undefined}
          value={money(loan.repaid)}
        />
        <Line label="ต้นเงินหักต่อเดือน" value={money(loan.monthly_principal)} />
        {next && (
          <Line
            label="งวดถัดไป (ต้น + ดอกเบี้ย)"
            hint={`ครบกำหนด ${thaiDate(next.due_date)} · ดอกเบี้ย ${money(next.interest)}`}
            value={money(next.installment)}
          />
        )}
        {loan.last_due_date && <Line label="งวดสุดท้าย" value={thaiDate(loan.last_due_date)} />}
      </dl>

      {hist.length > 0 ? (
        <div className="mt-2">
          <ExpandBtn open={openHist} onClick={() => setOpenHist((v) => !v)}>
            ประวัติการหัก ({hist.length} งวด)
          </ExpandBtn>
          {openHist && (
            <div className="mt-1">
              <div className="overflow-x-auto">
                <table className="w-full min-w-[30rem] text-sm">
                  <thead>
                    <tr className="border-b border-gray-200 text-left dark:border-line">
                      <th scope="col" className={TH}>เดือน</th>
                      <th scope="col" className={cx(TH, "text-right")}>ต้น</th>
                      <th scope="col" className={cx(TH, "text-right")}>ดอกเบี้ย</th>
                      <th scope="col" className={cx(TH, "text-right")}>รวม</th>
                      <th scope="col" className={cx(TH, "text-right")}>คงเหลือ</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 dark:divide-line">
                    {rows.map((r) => (
                      <tr key={r.due_date} className="text-gray-800 dark:text-gray-200">
                        <td className={cx(TD, "whitespace-nowrap")}>{thaiDate(r.due_date)}</td>
                        <td className={cx(TD, "text-right")}>{money(r.principal)}</td>
                        <td className={cx(TD, "text-right")}>{money(r.interest)}</td>
                        <td className={cx(TD, "text-right")}>{money(r.installment)}</td>
                        <td className={cx(TD, "text-right")}>{money(r.remaining_balance)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {hist.length > 6 && (
                <ExpandBtn open={all} onClick={() => setAll((v) => !v)}>
                  {all ? "แสดงน้อยลง" : `ดูทั้งหมด ${hist.length} งวด`}
                </ExpandBtn>
              )}
              <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                ข้อมูลก่อน ต.ค. 2569 คำนวณจากยอดคงเหลือ — ยอดรวมและยอดคงเหลือปัจจุบันเป็นตัวเลขจริงจาก AMC
              </p>
            </div>
          )}
        </div>
      ) : (
        <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">ยังไม่มีงวดที่หักแล้ว</p>
      )}
    </div>
  )
}

export function LoansBlock({ fin }) {
  const loans = Array.isArray(fin?.loans) ? fin.loans : []
  return (
    <section aria-label="เงินกู้กองทุนสงเคราะห์">
      <h3 className={H3}>เงินกู้กองทุนสงเคราะห์</h3>
      {loans.length === 0 ? (
        <p className="mt-1.5 py-2 text-sm text-gray-500 dark:text-gray-400">ไม่มีเงินกู้</p>
      ) : (
        <div className="mt-1 divide-y divide-gray-200 dark:divide-line">
          {loans.map((l) => <LoanItem key={l.loan_id ?? l.contract_no} loan={l} />)}
        </div>
      )}
    </section>
  )
}

/** ทั้งสองบล็อกต่อกัน — ใช้ใน HRPersonnelDetail */
export default function FinanceSavingsLoans({ fin, className }) {
  return (
    <div className={cx("space-y-5", className)}>
      <SavingsBlock fin={fin} />
      <LoansBlock fin={fin} />
    </div>
  )
}
