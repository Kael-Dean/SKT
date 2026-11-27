// src/components/hr/GratuityCalcSheet.jsx
// ─────────────────────────────────────────────────────────────────────────────
// คำนวณบำเหน็จประจำปีบัญชี (HR · gratuity.record)
//   1) เปิด → POST /hr/gratuity/{fy}/calculate?dry_run=true   ดูตัวอย่าง ไม่บันทึกอะไร
//   2) สลับ "คำนวณทับรายการที่แก้ไขเอง/นำเข้า" → ดูตัวอย่างใหม่ด้วย overwrite=true
//   3) ยืนยัน (ConfirmDialog) → dry_run=false → toast + onDone() ให้หน้าโหลดใหม่
// CalcRow: { user_id, name, hired_on, last_salary, years_counted, amount, previous_amount,
//            net_days, year_counts, basis ("prev" | "hire"), kept }
// ─────────────────────────────────────────────────────────────────────────────
import { useCallback, useEffect, useId, useMemo, useState } from "react"
import { calculateGratuity, fiscalYearRangeText, GRATUITY_MIN_DAYS, toNum } from "../../lib/gratuity"
import { money, thaiDate } from "../../lib/loans"
import { apiErrorText } from "../../lib/apiErrors"
import { cx, neutralBtnCls, primaryBtnCls } from "../../lib/styles"
import { Badge, ConfirmDialog, ErrorState, Sheet, SkeletonText, toast } from "../ui"
import { useIsPhone } from "../../hooks/useMediaQuery"
import { NameHeaderCell, NameNoMatch, NameSearchField } from "./nameFilter"
import { useNameFilter } from "./useNameFilter"

const btnCls = "h-12 md:pointer-fine:h-10 md:!px-5 md:!py-0 md:!text-sm"
const TH = "px-3 py-2 text-xs font-medium text-gray-500 dark:text-gray-400 whitespace-nowrap"
const TD = "px-3 py-2 tabular-nums whitespace-nowrap"

function Switch({ id, checked, onChange, disabled, describedBy }) {
  return (
    <button
      id={id} type="button" role="switch" aria-checked={checked} aria-describedby={describedBy} disabled={disabled}
      onClick={() => onChange(!checked)}
      className={cx(
        "relative inline-flex h-6 w-11 shrink-0 cursor-pointer items-center rounded-full transition-colors duration-200",
        "focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-surface",
        "disabled:cursor-not-allowed disabled:opacity-60",
        checked ? "bg-indigo-600" : "bg-gray-300 dark:bg-white/20",
      )}
    >
      <span aria-hidden="true" className={cx("inline-block size-5 rounded-full bg-white shadow transition-transform duration-200 ease-out", checked ? "translate-x-5" : "translate-x-0.5")} />
    </button>
  )
}

/** ป้ายข้อสังเกตของแต่ละแถว */
function RowFlags({ r }) {
  return (
    <span className="inline-flex flex-wrap gap-1">
      {r.kept && <Badge tone="pending">คงค่าเดิม</Badge>}
      {r.basis === "hire" && <Badge tone="info">นับจากวันเริ่มงาน</Badge>}
      {r.year_counts === false && <Badge tone="neutral">ปีนี้ไม่นับ</Badge>}
    </span>
  )
}

export default function GratuityCalcSheet({ open, fiscalYear, onClose, onDone }) {
  const uid = useId()
  const isPhone = useIsPhone()
  const [overwrite, setOverwrite] = useState(false)
  const [preview, setPreview] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState("")

  const load = useCallback(() => {
    if (!open || !fiscalYear) return undefined
    let alive = true
    setLoading(true)
    setError("")
    calculateGratuity(fiscalYear, { dryRun: true, overwrite })
      .then((d) => { if (alive) setPreview(d) })
      .catch((e) => { if (alive) setError(apiErrorText(e, { action: "คำนวณตัวอย่าง" })) })
      .finally(() => { if (alive) setLoading(false) })
    return () => { alive = false }
  }, [open, fiscalYear, overwrite])
  useEffect(() => load(), [load])

  // ปิดแล้วล้างค่า — เปิดใหม่ทุกครั้งเริ่มจากไม่ทับรายการเดิม
  useEffect(() => {
    if (open) return
    setOverwrite(false)
    setPreview(null)
    setConfirmOpen(false)
    setSaveError("")
  }, [open])

  const rows = useMemo(() => (Array.isArray(preview?.rows) ? preview.rows : []), [preview])
  const stats = useMemo(() => ({
    kept: rows.filter((r) => r.kept).length,
    hire: rows.filter((r) => r.basis === "hire").length,
    notCounted: rows.filter((r) => r.year_counts === false).length,
  }), [rows])
  const nf = useNameFilter(rows, { get: (r) => r.name, label: "เจ้าหน้าที่" })
  const noMatch = nf.rows.length === 0 && nf.total > 0
  // ปิด sheet แล้วล้างตัวกรองชื่อด้วย — เปิดใหม่เห็นครบทุกคน
  const clearName = nf.clear
  useEffect(() => { if (!open) clearName() }, [open, clearName])

  const save = async () => {
    setSaving(true)
    setSaveError("")
    try {
      const res = await calculateGratuity(fiscalYear, { dryRun: false, overwrite })
      const n = Array.isArray(res?.rows) ? res.rows.length : rows.length
      toast.success(`บันทึกบำเหน็จปีบัญชี ${fiscalYear} แล้ว`, { description: `${n} คน · ยอดรวม ${money(res?.total ?? preview?.total)} บาท` })
      setConfirmOpen(false)
      onDone?.()
      onClose()
    } catch (e) {
      setSaveError(apiErrorText(e))
    } finally {
      setSaving(false)
    }
  }

  const ready = !loading && !error && preview
  const busy = saving

  return (
    <>
      <Sheet
        open={open}
        onClose={onClose}
        title={`คำนวณบำเหน็จ ปีบัญชี ${fiscalYear}`}
        subtitle={`ตัวอย่างผลคำนวณ ยังไม่บันทึก · ${fiscalYearRangeText(fiscalYear)}`}
        size="full"
        busy={busy}
        initialFocus={null}
        footer={
          <div className="grid grid-cols-2 gap-3 md:flex md:justify-end md:gap-2">
            <button type="button" onClick={onClose} disabled={busy} className={cx(neutralBtnCls, btnCls)}>ยกเลิก</button>
            <button
              type="button"
              onClick={() => { setSaveError(""); setConfirmOpen(true) }}
              disabled={!ready || rows.length === 0 || busy}
              className={cx(primaryBtnCls, btnCls)}
            >
              บันทึกผลคำนวณ
            </button>
          </div>
        }
      >
        <div className="space-y-4">
          <div className="flex items-start justify-between gap-4 rounded-xl bg-gray-50 px-4 py-3 ring-1 ring-inset ring-gray-200/70 dark:bg-white/[.03] dark:ring-line">
            <div className="min-w-0">
              <label htmlFor={`${uid}-ow`} className="text-sm font-medium text-gray-900 dark:text-gray-100">คำนวณทับรายการที่แก้ไขเองหรือนำเข้า</label>
              <p id={`${uid}-ow-hint`} className="mt-0.5 text-xs leading-relaxed text-gray-500 dark:text-gray-400">
                ปิดไว้ = คงค่าที่ฝ่ายบุคคลแก้ไขหรือนำเข้าไว้ตามเดิม · เปิด = แทนที่ด้วยผลคำนวณใหม่ทั้งหมด
              </p>
            </div>
            <Switch id={`${uid}-ow`} checked={overwrite} onChange={setOverwrite} disabled={loading || busy} describedBy={`${uid}-ow-hint`} />
          </div>

          <div aria-live="polite" aria-busy={loading || undefined}>
            {loading && !preview ? (
              <SkeletonText lines={6} />
            ) : error ? (
              <ErrorState message={error} onRetry={load} />
            ) : rows.length === 0 ? (
              <p className="py-6 text-center text-sm text-gray-500 dark:text-gray-400">ไม่มีเจ้าหน้าที่ที่ต้องคำนวณในปีบัญชีนี้</p>
            ) : (
              <div className={cx("space-y-3", loading && "opacity-60 transition-opacity duration-200")}>
                <dl className="flex flex-wrap gap-x-6 gap-y-2 text-sm">
                  <div><dt className="text-xs text-gray-500 dark:text-gray-400">จำนวน</dt><dd className="font-semibold tabular-nums text-gray-900 dark:text-gray-100">{rows.length} คน</dd></div>
                  <div><dt className="text-xs text-gray-500 dark:text-gray-400">ยอดรวม</dt><dd className="font-semibold tabular-nums text-gray-900 dark:text-gray-100">{money(preview.total)} บาท</dd></div>
                  {stats.kept > 0 && <div><dt className="text-xs text-gray-500 dark:text-gray-400">คงค่าเดิม</dt><dd className="font-semibold tabular-nums text-amber-700 dark:text-amber-300">{stats.kept} คน</dd></div>}
                  {stats.hire > 0 && <div><dt className="text-xs text-gray-500 dark:text-gray-400">นับจากวันเริ่มงาน</dt><dd className="font-semibold tabular-nums text-indigo-700 dark:text-indigo-300">{stats.hire} คน</dd></div>}
                  {stats.notCounted > 0 && <div><dt className="text-xs text-gray-500 dark:text-gray-400">ปีนี้ไม่นับ</dt><dd className="font-semibold tabular-nums text-gray-700 dark:text-gray-300">{stats.notCounted} คน</dd></div>}
                </dl>
                <ul className="space-y-0.5 text-xs leading-relaxed text-gray-500 dark:text-gray-400">
                  <li><span className="font-medium text-amber-700 dark:text-amber-300">คงค่าเดิม</span> — รายการที่นำเข้าหรือแก้ไขเอง ระบบไม่คำนวณทับ</li>
                  <li><span className="font-medium text-indigo-700 dark:text-indigo-300">นับจากวันเริ่มงาน</span> — ไม่มีรายการของปีก่อน จึงนับปีจากวันที่เริ่มงาน</li>
                  <li><span className="font-medium text-gray-700 dark:text-gray-300">ปีนี้ไม่นับ</span> — ทำงานสุทธิไม่ถึง {GRATUITY_MIN_DAYS} วัน (หักวันลาป่วย ลากิจ ลาคลอด)</li>
                </ul>

                {isPhone ? (
                  <>
                  <NameSearchField nf={nf} />
                  {noMatch ? <NameNoMatch nf={nf} /> : (
                  <ul className="divide-y divide-gray-100 border-t border-gray-100 dark:divide-line dark:border-line">
                    {nf.rows.map((r) => (
                      <li key={r.user_id} className="py-3">
                        <div className="flex items-baseline justify-between gap-3">
                          <p className="min-w-0 break-words font-medium text-gray-900 dark:text-gray-100">{r.name}</p>
                          <p className="shrink-0 font-semibold tabular-nums text-gray-900 dark:text-gray-100">{money(r.amount)}</p>
                        </div>
                        <p className="mt-0.5 text-sm tabular-nums text-gray-500 dark:text-gray-400">
                          {money(r.last_salary)} × {r.years_counted} ปี · เริ่มงาน {thaiDate(r.hired_on)}
                        </p>
                        <p className="text-sm tabular-nums text-gray-500 dark:text-gray-400">ปีก่อน {money(r.previous_amount)} · ทำงานสุทธิ {toNum(r.net_days) ?? "—"} วัน</p>
                        <div className="mt-1"><RowFlags r={r} /></div>
                      </li>
                    ))}
                  </ul>
                  )}
                  </>
                ) : (
                  <div className="overflow-x-auto rounded-xl ring-1 ring-gray-200/70 dark:ring-line">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-gray-100 bg-gray-50 text-left dark:border-line dark:bg-white/[.03]">
                          <NameHeaderCell nf={nf} label="เจ้าหน้าที่" />
                          <th scope="col" className={TH}>เริ่มงาน</th>
                          <th scope="col" className={cx(TH, "text-right")}>เงินเดือน</th>
                          <th scope="col" className={cx(TH, "text-right")}>วันทำงานสุทธิ</th>
                          <th scope="col" className={cx(TH, "text-right")}>ปีที่นับ</th>
                          <th scope="col" className={cx(TH, "text-right")}>บำเหน็จ</th>
                          <th scope="col" className={cx(TH, "text-right")}>ปีก่อน</th>
                          <th scope="col" className={TH}><span className="sr-only">ข้อสังเกต</span></th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100 dark:divide-line">
                        {noMatch ? (
                          <tr><td colSpan={8} className="p-0"><NameNoMatch nf={nf} /></td></tr>
                        ) : nf.rows.map((r) => (
                          <tr key={r.user_id} className="text-gray-800 dark:text-gray-200">
                            <td className="whitespace-nowrap px-3 py-2 font-medium text-gray-900 dark:text-gray-100">{r.name}</td>
                            <td className={cx(TD, "whitespace-nowrap")}>{thaiDate(r.hired_on)}</td>
                            <td className={cx(TD, "text-right")}>{money(r.last_salary)}</td>
                            <td className={cx(TD, "text-right", r.year_counts === false && "text-amber-700 dark:text-amber-300")}>{toNum(r.net_days) ?? "—"}</td>
                            <td className={cx(TD, "text-right")}>{r.years_counted}</td>
                            <td className={cx(TD, "text-right font-semibold text-gray-900 dark:text-gray-100")}>{money(r.amount)}</td>
                            <td className={cx(TD, "text-right text-gray-500 dark:text-gray-400")}>{money(r.previous_amount)}</td>
                            <td className="px-3 py-2"><RowFlags r={r} /></td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </Sheet>

      <ConfirmDialog
        open={confirmOpen}
        title={`บันทึกบำเหน็จปีบัญชี ${fiscalYear}`}
        description={
          overwrite
            ? "ผลคำนวณจะแทนที่รายการของปีนี้ทั้งหมด รวมถึงรายการที่แก้ไขเองหรือนำเข้า"
            : "ผลคำนวณจะบันทึกเป็นยอดสำรองของปีนี้ รายการที่แก้ไขเองหรือนำเข้าจะคงค่าเดิม"
        }
        confirmLabel="บันทึก"
        tone="primary"
        loading={saving}
        error={saveError}
        onConfirm={save}
        onCancel={() => { if (!saving) setConfirmOpen(false) }}
      >
        <p className="text-sm tabular-nums text-gray-700 dark:text-gray-300">{rows.length} คน · ยอดรวม {money(preview?.total)} บาท</p>
      </ConfirmDialog>
    </>
  )
}
