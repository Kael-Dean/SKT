// src/components/hr/kpi/ProfitResultPanel.jsx
// Sub-tab "ผลประกอบการ" (roles 1·2). Releases (profit) or cancels (loss) every held +0.5 of the year.
//   POST /hr/kpi/fiscal-years/{fy}/profit-result { is_profit, reference, settlement_month }
//     → { profit_result, settled: [{user_id, pending_status, level_after, back_pay_amount, back_pay_month}], skipped }
// Irreversible: ConfirmDialog names the result + month. The same result may be re-sent (retries skipped rows).
import { useState } from "react"
import { Lock, TrendingDown, TrendingUp } from "lucide-react"
import { Notice } from "../HrModal"
import { apiAuth } from "../../../lib/api"
import { cx } from "../../../lib/styles"
import { Badge, ConfirmDialog, toast } from "../../ui"
import { cardCls, errText, fmtDate, fmtLevel, inputCls, labelCls, nf, primaryBtn, secondaryBtn, thb, thCls } from "../positionUtils"
import { NoteField, PendingBadge, SkippedTable } from "./KpiBits"
import { PROFIT_LABEL, fmtMonthTH, fyRange, minSettlementMonth, num } from "./kpiUtils"

/** profit_result may be "profit" | "loss" | boolean */
const normResult = (v) => (v === true ? "profit" : v === false ? "loss" : v || null)

export default function ProfitResultPanel({ fy, info, people, onChanged }) {
  const recorded = normResult(info?.profit_result)
  const [isProfit, setIsProfit] = useState(null)
  const [reference, setReference] = useState("")
  const [month, setMonth] = useState("")
  const [touched, setTouched] = useState(false)
  const [confirm, setConfirm] = useState(null) // payload
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState("")
  const [result, setResult] = useState(null)

  const minMonth = minSettlementMonth(fy)
  const pendingCount = num(info?.counts?.pending_half_steps) ?? 0
  const errors = {
    result: isProfit == null ? "เลือกผลประกอบการ" : "",
    reference: !reference.trim() ? "กรุณาระบุเลขที่มติ/เอกสารอ้างอิง" : "",
    month: !month ? "เลือกเดือนที่มีผล" : month < minMonth ? `ต้องไม่ก่อน ${fmtMonthTH(minMonth)}` : "",
  }
  const invalid = Object.values(errors).some(Boolean)

  const review = () => {
    setTouched(true)
    if (invalid) return
    setErr("")
    setConfirm({ is_profit: isProfit, reference: reference.trim(), settlement_month: `${month}-01` })
  }

  const retry = () => {
    setErr("")
    setConfirm({
      is_profit: recorded === "profit",
      reference: info?.profit_reference ?? "",
      settlement_month: String(info?.settlement_month ?? "").slice(0, 10),
      retry: true,
    })
  }

  const submit = async () => {
    if (!confirm) return
    setBusy(true)
    setErr("")
    const body = { is_profit: confirm.is_profit, reference: confirm.reference, settlement_month: confirm.settlement_month }
    try {
      const res = await apiAuth(`/hr/kpi/fiscal-years/${Number(fy)}/profit-result`, { method: "POST", body })
      const settled = Array.isArray(res?.settled) ? res.settled : []
      const skipped = Array.isArray(res?.skipped) ? res.skipped : []
      setResult({ profit: normResult(res?.profit_result) ?? (body.is_profit ? "profit" : "loss"), settled, skipped })
      setConfirm(null)
      toast.success("บันทึกผลประกอบการแล้ว", { description: `ปรับ ${nf(settled.length)} คน${skipped.length ? `, ข้าม ${nf(skipped.length)} คน` : ""}` })
      onChanged?.()
    } catch (e) {
      setErr(errText(e))
    } finally {
      setBusy(false)
    }
  }

  const confirmProfit = confirm?.is_profit
  const backPayTotal = result?.settled.reduce((s, r) => s + (num(r.back_pay_amount) ?? 0), 0) ?? 0

  return (
    <div className="space-y-4">
      {recorded ? (
        <div className={cx(cardCls, "p-4 sm:p-5 space-y-3")}>
          <div className="flex flex-wrap items-center gap-2">
            <Lock aria-hidden="true" className="size-4 text-gray-500 dark:text-gray-400" strokeWidth={1.75} />
            <h3 className="font-semibold text-gray-900 dark:text-gray-100">บันทึกผลประกอบการของปีบัญชี {fy} แล้ว</h3>
            <Badge tone={recorded === "profit" ? "success" : "danger"}>{PROFIT_LABEL[recorded] ?? recorded}</Badge>
          </div>
          <dl className="grid grid-cols-1 gap-x-6 gap-y-2 text-sm sm:grid-cols-2">
            <Info label="เอกสารอ้างอิง" value={info.profit_reference} />
            <Info label="เดือนที่มีผล" value={fmtMonthTH(info.settlement_month)} />
            <Info label="บันทึกโดย" value={info.profit_recorded_by != null ? people.nameOf(info.profit_recorded_by) : "—"} />
            <Info label="บันทึกเมื่อ" value={fmtDate(info.profit_recorded_at)} />
          </dl>
          <p className="text-sm text-gray-600 dark:text-gray-400">แก้ไขไม่ได้ ถ้ามีรายการที่ถูกข้าม (เช่น อนุมัติภายหลัง) ประมวลผลซ้ำด้วยผลเดิมได้</p>
          <button type="button" className={secondaryBtn} onClick={retry}>ประมวลผลซ้ำด้วยผลเดิม</button>
        </div>
      ) : (
        <div className={cx(cardCls, "p-4 sm:p-5 space-y-4 max-w-2xl")}>
          <div>
            <h3 className="font-semibold text-gray-900 dark:text-gray-100">บันทึกผลประกอบการปีบัญชี {fy}</h3>
            <p className="mt-0.5 text-sm text-gray-600 dark:text-gray-400">
              {fyRange(fy)} มีผู้รอ +0.5 ขั้น <span className="font-semibold tabular-nums text-gray-900 dark:text-gray-100">{nf(pendingCount)}</span> คน
              บันทึกหลังปิดบัญชีปีก่อน
            </p>
          </div>

          <fieldset>
            <legend className={labelCls}>ผลประกอบการ<span className="text-red-600 dark:text-red-400"> *</span></legend>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              <ResultChoice checked={isProfit === true} onSelect={() => setIsProfit(true)} icon={<TrendingUp aria-hidden="true" className="size-4" strokeWidth={1.75} />} label="กำไร" help="ได้ +0.5 ขั้นตั้งแต่เดือนที่มีผล พร้อมเงินตกเบิกครั้งเดียว" />
              <ResultChoice checked={isProfit === false} onSelect={() => setIsProfit(false)} icon={<TrendingDown aria-hidden="true" className="size-4" strokeWidth={1.75} />} label="ขาดทุน" help="ยกเลิก +0.5 ขั้นที่รอไว้" />
            </div>
            {touched && errors.result && <p className="mt-1 text-xs font-medium text-red-600 dark:text-red-400">{errors.result}</p>}
          </fieldset>

          <NoteField
            label="เลขที่มติ/เอกสารอ้างอิง"
            value={reference}
            onChange={setReference}
            rows={2}
            placeholder="เช่น มติ คกก. ชุดที่ 35 ครั้งที่ 12"
            error={touched ? errors.reference : ""}
          />

          <div className="sm:w-64">
            <label htmlFor="kpi-settle-month" className={labelCls}>
              เดือนที่มีผล (งวดเงินเดือน)<span className="text-red-600 dark:text-red-400"> *</span>
            </label>
            <input
              id="kpi-settle-month"
              type="month"
              min={minMonth}
              value={month}
              onChange={(e) => setMonth(e.target.value)}
              aria-invalid={touched && errors.month ? true : undefined}
              aria-describedby="kpi-settle-month-help"
              className={cx(inputCls, touched && errors.month && "border-red-400 dark:border-red-500")}
            />
            <p id="kpi-settle-month-help" className={cx("mt-1 text-xs", touched && errors.month ? "font-medium text-red-600 dark:text-red-400" : "text-gray-500 dark:text-gray-400")}>
              {touched && errors.month ? errors.month : `ตั้งแต่ ${fmtMonthTH(minMonth)} เป็นต้นไป`}
            </p>
          </div>

          <button type="button" className={primaryBtn} onClick={review}>บันทึกผลประกอบการ</button>
        </div>
      )}

      {result && (
        <section aria-label="ผลการปรับ +0.5 ขั้น" aria-live="polite" className={cx(cardCls, "p-4 sm:p-5 space-y-4")}>
          <h3 className="font-semibold text-gray-900 dark:text-gray-100">
            ผล{PROFIT_LABEL[result.profit] ?? ""}: ปรับ <span className="tabular-nums">{nf(result.settled.length)}</span> คน
            {backPayTotal > 0 && <> เงินตกเบิกรวม <span className="tabular-nums text-emerald-700 dark:text-emerald-300">{thb(backPayTotal)}</span> บาท</>}
          </h3>
          {result.settled.length > 0 && (
            <div className="overflow-x-auto rounded-xl ring-1 ring-gray-200 dark:ring-gray-700">
              <table className="w-full text-sm">
                <caption className="sr-only">รายการที่ปรับแล้ว</caption>
                <thead className="bg-gray-50 dark:bg-gray-900/30">
                  <tr>
                    <th scope="col" className={cx(thCls, "whitespace-nowrap text-left")}>เจ้าหน้าที่</th>
                    <th scope="col" className={cx(thCls, "whitespace-nowrap text-left")}>สถานะ +0.5</th>
                    <th scope="col" className={cx(thCls, "whitespace-nowrap text-right")}>ขั้นหลังปรับ</th>
                    <th scope="col" className={cx(thCls, "whitespace-nowrap text-right")}>เงินตกเบิก (บาท)</th>
                    <th scope="col" className={cx(thCls, "whitespace-nowrap text-left")}>จ่ายในงวด</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-gray-700/50">
                  {result.settled.map((r) => (
                    <tr key={r.user_id}>
                      <td className="px-4 py-2.5 font-medium text-gray-900 dark:text-gray-100 whitespace-nowrap">{people.nameOf(r.user_id)}</td>
                      <td className="px-4 py-2.5 whitespace-nowrap"><PendingBadge status={r.pending_status} /></td>
                      <td className="px-4 py-2.5 text-right tabular-nums text-gray-700 dark:text-gray-300">{fmtLevel(r.level_after)}</td>
                      <td className="px-4 py-2.5 text-right tabular-nums font-semibold text-gray-900 dark:text-gray-100">
                        {num(r.back_pay_amount) ? thb(r.back_pay_amount) : "—"}
                      </td>
                      <td className="px-4 py-2.5 whitespace-nowrap text-gray-700 dark:text-gray-300">{r.back_pay_month ? fmtMonthTH(r.back_pay_month) : "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <SkippedTable items={result.skipped} nameOf={people.nameOf} title="ข้ามไป" />
        </section>
      )}

      <ConfirmDialog
        open={!!confirm}
        tone={confirmProfit === false ? "danger" : "primary"}
        title={confirm?.retry ? "ประมวลผลซ้ำด้วยผลเดิม" : `ยืนยันผลประกอบการ: ${confirmProfit ? "กำไร" : "ขาดทุน"}`}
        description={
          confirmProfit
            ? `ผู้รอ +0.5 ขั้นทั้งหมดจะได้รับตั้งแต่งวด ${fmtMonthTH(confirm?.settlement_month)} พร้อมเงินตกเบิกในงวดนั้น`
            : `ผู้รอ +0.5 ขั้นทั้งหมดจะถูกยกเลิก (งวด ${fmtMonthTH(confirm?.settlement_month)})`
        }
        confirmLabel={confirm?.retry ? "ประมวลผลซ้ำ" : `บันทึกผล${confirmProfit ? "กำไร" : "ขาดทุน"}`}
        loading={busy}
        error={err}
        onConfirm={submit}
        onCancel={() => setConfirm(null)}
      >
        {!confirm?.retry && (
          <Notice tone="warning">บันทึกแล้วแก้ไขหรือเปลี่ยนผลไม่ได้</Notice>
        )}
        <p className="mt-3 text-xs text-gray-600 dark:text-gray-400">อ้างอิง: {confirm?.reference || "—"}</p>
      </ConfirmDialog>
    </div>
  )
}

function Info({ label, value }) {
  return (
    <div>
      <dt className="text-xs text-gray-500 dark:text-gray-400">{label}</dt>
      <dd className="font-medium text-gray-900 dark:text-gray-100 break-words">{value || "—"}</dd>
    </div>
  )
}

function ResultChoice({ checked, onSelect, icon, label, help }) {
  return (
    <label
      className={cx(
        "flex cursor-pointer items-start gap-3 rounded-xl border px-3.5 py-3 transition-colors duration-200",
        checked
          ? "border-indigo-400 bg-indigo-50 dark:border-indigo-500 dark:bg-indigo-500/10"
          : "border-gray-200 hover:bg-gray-50 dark:border-gray-700 dark:hover:bg-gray-700/40"
      )}
    >
      <input type="radio" name="kpi-profit" checked={checked} onChange={onSelect} className="mt-1 accent-indigo-600" />
      <span>
        <span className="flex items-center gap-1.5 text-sm font-semibold text-gray-900 dark:text-gray-100">
          {icon}
          {label}
        </span>
        <span className="block text-xs text-gray-600 dark:text-gray-400">{help}</span>
      </span>
    </label>
  )
}
