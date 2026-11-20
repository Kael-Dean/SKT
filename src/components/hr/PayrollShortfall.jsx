// src/components/hr/PayrollShortfall.jsx
// ─────────────────────────────────────────────────────────────────────────────
// เงินเดือนสุทธิติดลบ — รายชื่อส่งการเงิน + บันทึกการชำระส่วนขาด (api-handoff PR 107)
//   GET    /hr/payroll/shortfalls?year&month           รายชื่อ (ติดลบ + ชำระแล้วในเดือนนี้)
//   GET    /hr/payroll/shortfalls/pdf?year&month      PDF ส่งการเงิน
//   POST   /hr/payroll/{payroll_id}/shortfall-payment { paid_on, note }   บันทึกว่าชำระเต็มจำนวน → สุทธิ = 0 (409 = ไม่มียอดค้าง)
//   DELETE /hr/payroll/{payroll_id}/shortfall-payment ยกเลิก (เฉพาะงวดร่าง)
// บันทึก/ยกเลิกได้เมื่อมีสิทธิ์ hr.payroll.adjust และงวดเป็นร่างเท่านั้น
// ─────────────────────────────────────────────────────────────────────────────
import { useCallback, useEffect, useId, useState } from "react"
import { Printer } from "lucide-react"
import { apiAuth } from "../../lib/api"
import { downloadShortfallPdf } from "../../lib/shortfall"
import { fmtPayMonth, money, toNum } from "../../lib/payroll"
import { thaiDate } from "../../lib/loans"
import { baseField, cx, errorTextCls, focusRingCls, labelCls, neutralBtnCls, primaryBtnCls, submitBtnCls } from "../../lib/styles"
import { Badge, EmptyState, ErrorState, Sheet, SkeletonText, toast } from "../ui"
import ThaiDateField from "../ThaiDateField"

const inputCls = cx(baseField, "!rounded-lg !px-3 !py-2 md:!text-sm")
const btnCls = "h-12 md:h-10"

const todayIso = () => {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`
}

/** ป้าย "ชำระส่วนขาดแล้ว" ในรายการเงินเดือน */
export function ShortfallPaidChip({ record, className }) {
  if (toNum(record?.shortfall_paid) <= 0) return null
  return (
    <span className={cx("inline-flex items-center rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-900 dark:bg-emerald-400/15 dark:text-emerald-200", className)}>
      ชำระส่วนขาดแล้ว
    </span>
  )
}

// ─── ฟอร์มบันทึกการชำระ ──────────────────────────────────────────────────────
function PaymentSheet({ row, onClose, onSaved }) {
  const uid = useId()
  const [paidOn, setPaidOn] = useState(todayIso())
  const [note, setNote] = useState("")
  const [err, setErr] = useState("")
  const [busy, setBusy] = useState(false)

  useEffect(() => { setPaidOn(todayIso()); setNote(""); setErr("") }, [row?.payroll_id])

  const save = async () => {
    if (!paidOn) { setErr("เลือกวันที่ชำระ"); return }
    setBusy(true)
    setErr("")
    try {
      await apiAuth(`/hr/payroll/${row.payroll_id}/shortfall-payment`, {
        method: "POST",
        body: { paid_on: paidOn, ...(note.trim() ? { note: note.trim() } : {}) },
      })
      toast.success("บันทึกการชำระส่วนขาดแล้ว", { description: `${row.employee_name} · ${money(row.outstanding)} บาท` })
      onSaved()
    } catch (e) {
      setErr(e.message || "บันทึกไม่สำเร็จ")
      if (e.status === 409) onSaved({ keepOpen: true }) // ไม่มียอดค้างแล้ว → รีเฟรชรายการ
    } finally {
      setBusy(false)
    }
  }

  return (
    <Sheet
      open={!!row}
      onClose={onClose}
      title="บันทึกการชำระส่วนขาด"
      subtitle={row?.employee_name}
      size="sm"
      busy={busy}
      footer={
        <div className="grid grid-cols-2 gap-3 md:flex md:justify-end md:gap-2">
          <button type="button" onClick={onClose} disabled={busy} className={cx(neutralBtnCls, btnCls)}>ยกเลิก</button>
          <button type="button" onClick={save} disabled={busy} className={cx(submitBtnCls, btnCls, "!rounded-xl !px-4 !py-0 md:!text-sm")}>
            {busy ? "กำลังบันทึก…" : "บันทึกการชำระ"}
          </button>
        </div>
      }
    >
      <form className="space-y-4" noValidate onSubmit={(e) => { e.preventDefault(); save() }}>
        <p className="rounded-xl bg-gray-50 px-4 py-3 text-sm text-gray-700 ring-1 ring-inset ring-gray-200/70 dark:bg-white/[.03] dark:text-gray-300 dark:ring-line">
          บันทึกว่าเจ้าหน้าที่ชำระส่วนขาด <span className="font-semibold tabular-nums">{money(row?.outstanding)}</span> บาท ครบแล้ว — เงินเดือนสุทธิจะเป็น 0
        </p>
        <div className="min-w-0">
          <label htmlFor={`${uid}-date`} className={cx(labelCls, "md:!text-sm")}>วันที่ชำระ</label>
          <ThaiDateField id={`${uid}-date`} value={paidOn} onChange={(e) => setPaidOn(e.target.value)} className={inputCls} aria-invalid={err && !paidOn ? true : undefined} />
        </div>
        <div>
          <label htmlFor={`${uid}-note`} className={cx(labelCls, "md:!text-sm")}>หมายเหตุ (ไม่บังคับ)</label>
          <input id={`${uid}-note`} type="text" value={note} onChange={(e) => setNote(e.target.value)} placeholder="เช่น ใบเสร็จการเงินเลขที่ 123" className={inputCls} />
        </div>
        {err && <p role="alert" className={errorTextCls}>{err}</p>}
        <button type="submit" hidden aria-hidden="true" tabIndex={-1} />
      </form>
    </Sheet>
  )
}

// ─── รายชื่อ ────────────────────────────────────────────────────────────────
/**
 * @param {boolean} canPay  มีสิทธิ์ hr.payroll.adjust และงวดเป็นร่าง → แสดงปุ่มบันทึก/ยกเลิก
 * @param {() => void} onChanged  เรียกหลังบันทึก/ยกเลิก เพื่อรีเฟรชงวดและรายการเงินเดือน
 */
export default function PayrollShortfallSheet({ open, onClose, year, month, canPay, onChanged }) {
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")
  const [paying, setPaying] = useState(null)
  const [undoId, setUndoId] = useState(null)
  const [busyId, setBusyId] = useState(null)
  const [printing, setPrinting] = useState(false)
  const label = fmtPayMonth(year, month, { long: true })

  const load = useCallback(() => {
    setLoading(true)
    setError("")
    apiAuth(`/hr/payroll/shortfalls?year=${year}&month=${month}`)
      .then((d) => setRows(Array.isArray(d) ? d : Array.isArray(d?.items) ? d.items : []))
      .catch((e) => setError(e.message || "โหลดรายชื่อไม่สำเร็จ"))
      .finally(() => setLoading(false))
  }, [year, month])

  useEffect(() => { if (open) { setUndoId(null); load() } }, [open, load])

  const undo = async (row) => {
    setBusyId(row.payroll_id)
    try {
      await apiAuth(`/hr/payroll/${row.payroll_id}/shortfall-payment`, { method: "DELETE" })
      toast.success("ยกเลิกการชำระส่วนขาดแล้ว", { description: row.employee_name })
      setUndoId(null)
      load()
      onChanged?.()
    } catch (e) {
      toast.error("ยกเลิกไม่สำเร็จ", { description: e.message || undefined })
    } finally {
      setBusyId(null)
    }
  }

  const print = async () => {
    setPrinting(true)
    await downloadShortfallPdf({ year, month })
    setPrinting(false)
  }

  const unpaid = rows.filter((r) => r.status !== "paid")
  const totalOutstanding = rows.reduce((s, r) => s + toNum(r.outstanding), 0)

  return (
    <>
      <Sheet
        open={open && !paying}
        onClose={onClose}
        title="เจ้าหน้าที่ที่เงินเดือนสุทธิติดลบ"
        subtitle={label}
        size="lg"
        footer={
          <div className="grid grid-cols-2 gap-3 md:flex md:justify-end md:gap-2">
            <button type="button" onClick={onClose} className={cx(neutralBtnCls, btnCls)}>ปิด</button>
            <button type="button" onClick={print} disabled={printing || rows.length === 0} className={cx(primaryBtnCls, btnCls)}>
              <Printer aria-hidden="true" className="size-4" strokeWidth={1.75} />
              {printing ? "กำลังโหลด…" : "พิมพ์รายชื่อส่งการเงิน"}
            </button>
          </div>
        }
      >
        {loading ? (
          <SkeletonText lines={6} />
        ) : error ? (
          <ErrorState message={error} onRetry={load} />
        ) : rows.length === 0 ? (
          <EmptyState className="!py-8" title="ไม่มีใครที่เงินเดือนสุทธิติดลบ" description={`งวด ${label} ส่งตรวจสอบได้ตามปกติ`} />
        ) : (
          <div className="space-y-3">
            <p className="text-sm text-gray-600 dark:text-gray-400">
              พิมพ์รายชื่อส่งการเงินเพื่อเรียกเก็บจากเจ้าหน้าที่ แล้วบันทึกการชำระที่นี่ — ส่งตรวจสอบได้เมื่อไม่มีใครติดลบ
              {unpaid.length > 0 && <> · ค้างชำระ <span className="font-semibold tabular-nums">{unpaid.length}</span> คน รวม <span className="font-semibold tabular-nums">{money(totalOutstanding)}</span> บาท</>}
            </p>
            <ul className="divide-y divide-gray-100 dark:divide-line">
              {rows.map((r) => {
                const paid = r.status === "paid"
                return (
                  <li key={r.payroll_id} className="py-3">
                    <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-2">
                      <div className="min-w-0">
                        <p className="font-medium text-gray-900 dark:text-gray-100">
                          {r.employee_name}
                          <Badge tone={paid ? "success" : "danger"} className="ml-2 align-middle">{paid ? "ชำระแล้ว" : "ยังไม่ชำระ"}</Badge>
                        </p>
                        <p className="text-xs text-gray-500 dark:text-gray-400">
                          {r.branch_name || `รหัส ${r.employee_id}`} · รายได้ {money(r.gross)} · หัก {money(r.deductions)} · สุทธิก่อนชำระ <span className="tabular-nums text-red-700 dark:text-red-300">{money(r.net_before)}</span>
                        </p>
                        {paid && (
                          <p className="mt-0.5 text-xs text-emerald-800 dark:text-emerald-300">
                            ชำระ {money(r.paid)} บาท{r.paid_on && ` เมื่อ ${thaiDate(r.paid_on)}`}{r.paid_note && ` · ${r.paid_note}`}
                          </p>
                        )}
                      </div>
                      <div className="text-right">
                        <p className="text-xs text-gray-500 dark:text-gray-400">{paid && toNum(r.outstanding) === 0 ? "ต้องชำระ" : "ค้างชำระ"}</p>
                        <p className="font-semibold tabular-nums text-gray-900 dark:text-gray-100">{money(paid && toNum(r.outstanding) === 0 ? r.shortfall : r.outstanding)}</p>
                      </div>
                    </div>
                    {canPay && (
                      <div className="mt-2 flex flex-wrap items-center justify-end gap-2">
                        {toNum(r.outstanding) > 0 && (
                          <button type="button" onClick={() => setPaying(r)} className={cx(primaryBtnCls, "!h-10 !px-3 !text-sm")}>บันทึกการชำระ</button>
                        )}
                        {toNum(r.paid) > 0 && (undoId === r.payroll_id ? (
                          <>
                            <span className="text-sm text-gray-600 dark:text-gray-400">ยกเลิกการชำระของ {r.employee_name}?</span>
                            <button type="button" onClick={() => setUndoId(null)} disabled={busyId === r.payroll_id} className={cx(neutralBtnCls, "!h-10 !px-3 !text-sm")}>ไม่ยกเลิก</button>
                            <button type="button" onClick={() => undo(r)} disabled={busyId === r.payroll_id} className={cx(neutralBtnCls, "!h-10 !px-3 !text-sm !text-red-700 dark:!text-red-300")}>
                              {busyId === r.payroll_id ? "กำลังยกเลิก…" : "ยืนยันยกเลิก"}
                            </button>
                          </>
                        ) : (
                          <button
                            type="button"
                            onClick={() => setUndoId(r.payroll_id)}
                            className={cx("min-h-touch md:pointer-fine:min-h-0 rounded px-2 text-sm font-medium text-gray-600 hover:underline dark:text-gray-400 cursor-pointer", focusRingCls)}
                          >
                            ยกเลิก
                          </button>
                        ))}
                      </div>
                    )}
                  </li>
                )
              })}
            </ul>
          </div>
        )}
      </Sheet>

      <PaymentSheet
        row={paying}
        onClose={() => setPaying(null)}
        onSaved={(opts) => {
          if (!opts?.keepOpen) setPaying(null)
          load()
          onChanged?.()
        }}
      />
    </>
  )
}
