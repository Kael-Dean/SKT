// src/pages/work/MyPayslips.jsx
// ─────────────────────────────────────────────────────────────────────────────
// สลิปเงินเดือนของฉัน (3G) — เห็นเฉพาะเดือนที่ผู้จัดการอนุมัติแล้ว/ปิดงวดแล้ว
//   GET /personnel/me/payroll                     รายการเดือน (id, month, gross_income, final_payout)
//   GET /personnel/me/payroll/{id}                รายละเอียด (404 = ยังไม่เผยแพร่)
//   GET /personnel/me/payroll/{id}/payslip        PDF (apiDownload)
// Desktop: รายการเดือนซ้าย + สลิปขวา · มือถือ: รายการ → แตะเปิด Sheet
// ─────────────────────────────────────────────────────────────────────────────
import { useCallback, useEffect, useState } from "react"
import { ChevronRight, Download } from "lucide-react"
import { apiAuth, apiDownload } from "../../lib/api"
import { useIsPhone } from "../../hooks/useMediaQuery"
import { fmtPayMonth, money, parsePayMonth } from "../../lib/payroll"
import { cx, focusRingCls, neutralBtnCls, primaryBtnCls } from "../../lib/styles"
import { EmptyState, ErrorState, Sheet, SkeletonCard, SkeletonText, toast } from "../../components/ui"
import PayoutLines from "../../components/hr/PayoutLines"

const listOf = (d) => (Array.isArray(d) ? d : Array.isArray(d?.items) ? d.items : [])
const monthKey = (r) => { const p = parsePayMonth(r.month); return p ? p.year * 100 + p.month : 0 }
const monthText = (r, long = true) => { const p = parsePayMonth(r?.month); return p ? fmtPayMonth(p.year, p.month, { long }) : "—" }

function useDownload() {
  const [busy, setBusy] = useState(null)
  const download = async (row) => {
    setBusy(row.id)
    try {
      const { blob, filename } = await apiDownload(`/personnel/me/payroll/${row.id}/payslip`)
      const url = URL.createObjectURL(blob)
      const a = document.createElement("a")
      a.href = url
      const p = parsePayMonth(row.month)
      a.download = filename || `payslip_${p ? `${p.year + 543}-${String(p.month).padStart(2, "0")}` : row.id}.pdf`
      a.click()
      URL.revokeObjectURL(url)
    } catch (err) {
      toast.error("ดาวน์โหลดสลิปไม่สำเร็จ", { description: err.message || undefined })
    } finally {
      setBusy(null)
    }
  }
  return [busy, download]
}

function SlipDetail({ row, detail, loading, error, onRetry }) {
  if (error) return <ErrorState message={error} onRetry={onRetry} />
  if (loading || !detail) return <SkeletonText lines={7} />
  return <PayoutLines record={{ ...row, ...detail }} />
}

export default function MyPayslips() {
  const isPhone = useIsPhone()
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [selected, setSelected] = useState(null)
  const [detail, setDetail] = useState(null)
  const [detailLoading, setDetailLoading] = useState(false)
  const [detailError, setDetailError] = useState("")
  const [downloading, download] = useDownload()

  const load = useCallback(() => {
    setLoading(true)
    setError("")
    apiAuth("/personnel/me/payroll")
      .then((d) => setRows(listOf(d).slice().sort((a, b) => monthKey(b) - monthKey(a))))
      .catch((e) => setError(e.message || "โหลดสลิปเงินเดือนไม่สำเร็จ"))
      .finally(() => setLoading(false))
  }, [])
  useEffect(() => { load() }, [load])

  // desktop: เลือกเดือนล่าสุดให้อัตโนมัติ
  useEffect(() => {
    if (!isPhone && !selected && rows.length) setSelected(rows[0])
  }, [isPhone, rows, selected])

  const loadDetail = useCallback((row) => {
    if (!row) return
    setDetail(null)
    setDetailError("")
    setDetailLoading(true)
    apiAuth(`/personnel/me/payroll/${row.id}`)
      .then(setDetail)
      .catch((e) => setDetailError(e.message || "โหลดรายละเอียดสลิปไม่สำเร็จ"))
      .finally(() => setDetailLoading(false))
  }, [])
  useEffect(() => { loadDetail(selected) }, [selected, loadDetail])

  const header = (
    <div>
      <h1 className="text-xl font-bold text-gray-900 dark:text-gray-100">สลิปเงินเดือนของฉัน</h1>
      <p className="mt-0.5 text-sm text-gray-500 dark:text-gray-400">สลิปของแต่ละเดือนจะแสดงที่นี่หลังผู้จัดการอนุมัติงวดเงินเดือนของเดือนนั้น</p>
    </div>
  )

  if (error) return <div className="mx-auto max-w-4xl space-y-5 pb-10">{header}<ErrorState message={error} onRetry={load} /></div>

  const empty = (
    <div className="rounded-2xl bg-white ring-1 ring-gray-200/70 shadow-sm dark:bg-surface dark:ring-line dark:shadow-none">
      <EmptyState
        title="ยังไม่มีสลิปเงินเดือน"
        description="เมื่อฝ่ายบุคคลคำนวณเงินเดือนและผู้จัดการอนุมัติงวดของเดือนนั้นแล้ว สลิปจะขึ้นที่นี่ และดาวน์โหลดเป็น PDF ได้"
      />
    </div>
  )

  const list = (
    <ul aria-label="เดือนที่มีสลิป" className="divide-y divide-gray-100 overflow-hidden rounded-2xl bg-white ring-1 ring-gray-200/70 shadow-sm dark:divide-line dark:bg-surface dark:ring-line dark:shadow-none">
      {rows.map((r) => {
        const active = !isPhone && selected?.id === r.id
        return (
          <li key={r.id}>
            <button
              type="button"
              onClick={() => setSelected(r)}
              aria-current={active ? "true" : undefined}
              className={cx(
                "flex w-full min-h-touch items-center gap-3 px-4 py-3 text-left transition-colors duration-150 cursor-pointer",
                active ? "bg-indigo-50 dark:bg-indigo-500/10" : "hover:bg-gray-50 dark:hover:bg-white/[.03]",
                focusRingCls, "focus-visible:ring-inset focus-visible:ring-offset-0",
              )}
            >
              <span className="min-w-0 flex-1">
                <span className={cx("block font-medium", active ? "text-indigo-800 dark:text-indigo-200" : "text-gray-900 dark:text-gray-100")}>{monthText(r)}</span>
                <span className="block text-xs text-gray-500 dark:text-gray-400">รายได้รวม {money(r.gross_income)}</span>
              </span>
              <span className="text-right">
                <span className="block text-xs text-gray-500 dark:text-gray-400">สุทธิ</span>
                <span className="block font-semibold tabular-nums text-gray-900 dark:text-gray-100">{money(r.final_payout ?? r.net_payout)}</span>
              </span>
              <ChevronRight aria-hidden="true" className={cx("size-4 shrink-0", active ? "text-indigo-500 dark:text-indigo-300" : "text-gray-400")} />
            </button>
          </li>
        )
      })}
    </ul>
  )

  const downloadBtn = selected && (
    <button type="button" onClick={() => download(selected)} disabled={downloading === selected.id} className={cx(primaryBtnCls, isPhone && "h-12 w-full")}>
      <Download aria-hidden="true" className="size-4" strokeWidth={1.75} />
      {downloading === selected.id ? "กำลังดาวน์โหลด…" : isPhone ? "ดาวน์โหลด PDF" : "ดาวน์โหลดสลิป PDF"}
    </button>
  )

  return (
    <div className="mx-auto max-w-4xl space-y-5 pb-10">
      {header}

      {loading ? (
        <div className="grid gap-4 md:grid-cols-[18rem_minmax(0,1fr)]"><SkeletonCard /><SkeletonCard /></div>
      ) : rows.length === 0 ? (
        empty
      ) : isPhone ? (
        <>
          {list}
          <Sheet
            open={!!selected}
            onClose={() => setSelected(null)}
            title={`สลิปเงินเดือน ${monthText(selected)}`}
            size="md"
            footer={
              <div className="grid grid-cols-2 gap-3">
                <button type="button" onClick={() => setSelected(null)} className={cx(neutralBtnCls, "h-12")}>ปิด</button>
                {downloadBtn}
              </div>
            }
          >
            <SlipDetail row={selected} detail={detail} loading={detailLoading} error={detailError} onRetry={() => loadDetail(selected)} />
          </Sheet>
        </>
      ) : (
        <div className="grid items-start gap-4 md:grid-cols-[18rem_minmax(0,1fr)]">
          {list}
          <section aria-labelledby="my-slip-h" className="rounded-2xl bg-white p-5 ring-1 ring-gray-200/70 shadow-sm dark:bg-surface dark:ring-line dark:shadow-none">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
              <h2 id="my-slip-h" className="text-base font-semibold text-gray-900 dark:text-gray-100">สลิปเงินเดือน {monthText(selected)}</h2>
              {downloadBtn}
            </div>
            <SlipDetail row={selected} detail={detail} loading={detailLoading} error={detailError} onRetry={() => loadDetail(selected)} />
          </section>
        </div>
      )}
    </div>
  )
}
