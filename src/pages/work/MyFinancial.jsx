// src/pages/work/MyFinancial.jsx
// ─────────────────────────────────────────────────────────────────────────────
// ข้อมูลการเงินของฉัน (self-service) — api-handoff 2026-10-17 §2
//   a) GET /personnel/me/financial        เงินสะสม + เงินกู้ (การ์ดเงินเดือน/รายการหักประจำเอาออกแล้ว พ.ย. 2026 — ดูจากสลิปแทน)
//   b) GET /personnel/me/payroll[/{id}]   สลิปรายเดือน (เฉพาะงวดที่อนุมัติ/ปิดแล้ว) → MyPayslipsPanel
//   c) GET /personnel/me/salary-history   ประวัติการเลื่อนขั้น (เป็น "ขั้น" ไม่ใช่บาท)
//   d) GET /personnel/me/gratuity         บำเหน็จของฉัน → MyGratuitySection (403/404 = ไม่แสดง)
// ยอดจริงของแต่ละเดือนมาจากสลิป (b) — การ์ดบน (a) เป็นค่าตั้งต้นในทะเบียน ไม่คำนวณยอดสุทธิจากการ์ดนี้
// ─────────────────────────────────────────────────────────────────────────────
import { useCallback, useEffect, useState } from "react"
import { Link } from "react-router-dom"
import { ChevronRight } from "lucide-react"
import { apiAuth } from "../../lib/api"
import { useCan } from "../../lib/permissions"
import { SavingsBlock, LoansBlock } from "../../components/hr/FinanceSavingsLoans"
import { MyGratuitySection } from "../../components/hr/GratuityBlocks"
import { fmtDate, fmtLevel, reasonLabel } from "../../components/hr/positionUtils"
import { cardCls, cx, focusRingCls } from "../../lib/styles"
import { EmptyState, ErrorState, SkeletonText } from "../../components/ui"
import MyPayslipsPanel from "../../components/hr/MyPayslipsPanel"
import PageTitle from "../../components/PageTitle"
import { backState } from "../../lib/drill"
import { getTenure, tenureText } from "../../lib/tenure"

// ─── a) เงินสะสม + เงินกู้ในทะเบียน ─────────────────────────────────────────────
function fmtUpdated(iso) {
  if (!iso) return null
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return null
  return d.toLocaleDateString("th-TH", { day: "numeric", month: "short", year: "numeric" })
}

function OnFileCard() {
  const { can } = useCan()
  const [data, setData] = useState(null)
  const [state, setState] = useState("loading") // loading | ready | missing | error
  const [error, setError] = useState("")
  // อายุงานระดับวัน (3G) มากับ GET /personnel/me — ไม่ใช้ financial.job_age แล้ว
  const [tenure, setTenure] = useState(null)

  useEffect(() => {
    let alive = true
    apiAuth("/personnel/me")
      .then((me) => { if (alive) setTenure(getTenure(me)) })
      .catch(() => { /* ไม่มีอายุงาน → ไม่แสดง */ })
    return () => { alive = false }
  }, [])

  const load = useCallback(() => {
    setState("loading")
    setError("")
    apiAuth("/personnel/me/financial")
      .then((d) => {
        const fin = d?.financial ?? null
        setData(fin)
        setState(fin ? "ready" : "missing")
      })
      .catch((e) => {
        if (e?.status === 404) return setState("missing")
        setError(e.message || "โหลดข้อมูลการเงินไม่สำเร็จ")
        setState("error")
      })
  }, [])
  useEffect(() => { load() }, [load])

  const updated = fmtUpdated(data?.updated_at)

  return (
    <section aria-labelledby="fin-onfile-h" className={cx(cardCls, "p-5")}>
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <h2 id="fin-onfile-h" className="text-base font-semibold text-gray-900 dark:text-gray-100">เงินสะสมและเงินกู้</h2>
        {state === "ready" && (
          <p className="text-xs text-gray-500 dark:text-gray-400">
            {tenure && <>อายุงาน <span className="tabular-nums">{tenureText(tenure)}</span></>}
            {tenure && updated && " · "}
            {updated && <>ปรับปรุงล่าสุด {updated}</>}
          </p>
        )}
      </div>
      <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
        ข้อมูลที่ฝ่ายบุคคลบันทึกไว้ในทะเบียน — ยอดหักจริงของแต่ละเดือนดูจากสลิปเงินเดือนด้านบน
      </p>

      <div className="mt-4">
        {state === "loading" ? (
          <SkeletonText lines={6} />
        ) : state === "error" ? (
          <ErrorState message={error} onRetry={load} />
        ) : state === "missing" ? (
          <p className="rounded-xl bg-gray-50 px-4 py-3 text-sm text-gray-600 ring-1 ring-inset ring-gray-200/70 dark:bg-white/[.03] dark:text-gray-400 dark:ring-line">
            ยังไม่มีข้อมูลการเงินในทะเบียน — ติดต่อฝ่ายบุคคลเพื่อบันทึกข้อมูล
          </p>
        ) : (
          <div className="grid gap-5 md:grid-cols-2 md:gap-8">
            <SavingsBlock fin={data} />
            <LoansBlock fin={data} />
          </div>
        )}
      </div>

      {state === "ready" && can("self.issue.report") && (
        <p className="mt-4 border-t border-gray-100 pt-3 text-sm text-gray-600 dark:border-line dark:text-gray-400">
          ข้อมูลไม่ตรงกับที่ได้รับจริง?{" "}
          <Link to="/my-profile" state={backState("ข้อมูลการเงินของฉัน")} className={cx("inline-flex min-h-touch md:pointer-fine:min-h-0 items-center gap-0.5 rounded font-medium text-indigo-700 hover:underline dark:text-indigo-300", focusRingCls)}>
            แจ้งแก้ไขที่หน้าข้อมูลส่วนตัว <ChevronRight aria-hidden="true" className="size-4" />
          </Link>
        </p>
      )}
    </section>
  )
}

// ─── c) ประวัติการเลื่อนขั้น ──────────────────────────────────────────────────
function StepHistory() {
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")

  const load = useCallback(() => {
    setLoading(true)
    setError("")
    apiAuth("/personnel/me/salary-history")
      .then((d) => {
        const list = Array.isArray(d) ? [...d] : Array.isArray(d?.items) ? [...d.items] : []
        list.sort((a, b) => String(b.effective_date ?? "").localeCompare(String(a.effective_date ?? "")) || (b.id ?? 0) - (a.id ?? 0))
        setRows(list)
      })
      .catch((e) => setError(e.message || "โหลดประวัติการเลื่อนขั้นไม่สำเร็จ"))
      .finally(() => setLoading(false))
  }, [])
  useEffect(() => { load() }, [load])

  return (
    <section aria-labelledby="fin-steps-h" className="space-y-3">
      <div>
        <h2 id="fin-steps-h" className="text-base font-semibold text-gray-900 dark:text-gray-100">ประวัติการเลื่อนขั้น</h2>
        <p className="mt-0.5 text-sm text-gray-500 dark:text-gray-400">แสดงเป็นขั้นเงินเดือน ไม่ใช่จำนวนเงิน</p>
      </div>
      <div className={cx(cardCls, "p-5")}>
        {loading ? (
          <SkeletonText lines={4} />
        ) : error ? (
          <ErrorState message={error} onRetry={load} />
        ) : rows.length === 0 ? (
          <EmptyState className="!py-8" title="ยังไม่มีประวัติการเลื่อนขั้น" description="เมื่อได้เลื่อนขั้นหรือปรับขั้นเงินเดือน รายการจะแสดงที่นี่" />
        ) : (
          <ol className="relative ml-1.5 border-l border-gray-200 dark:border-line">
            {rows.map((h, i) => {
              const diff = h.old_level != null && h.new_level != null ? Number(h.new_level) - Number(h.old_level) : null
              const verb = diff != null && diff < 0 ? "ปรับขั้น" : "เลื่อนขั้น"
              return (
                <li key={h.id ?? i} className="relative pb-5 pl-5 last:pb-0">
                  <span
                    aria-hidden="true"
                    className={cx(
                      "absolute -left-[5px] top-1.5 size-2.5 rounded-full ring-4 ring-white dark:ring-surface",
                      i === 0 ? "bg-indigo-500 dark:bg-indigo-400" : "bg-gray-300 dark:bg-gray-500",
                    )}
                  />
                  <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-0.5">
                    <p className="font-medium text-gray-900 dark:text-gray-100">
                      {verb} <span className="tabular-nums">{fmtLevel(h.old_level)}</span>
                      <span aria-hidden="true" className="mx-1.5 text-gray-400 dark:text-gray-500">→</span>
                      <span className="sr-only">เป็น </span>
                      <span className="tabular-nums">{fmtLevel(h.new_level)}</span>
                      {diff != null && diff !== 0 && (
                        <span className={cx("ml-2 text-xs font-semibold tabular-nums", diff > 0 ? "text-emerald-700 dark:text-emerald-400" : "text-amber-700 dark:text-amber-300")}>
                          {diff > 0 ? "+" : ""}{diff.toFixed(1)}
                        </span>
                      )}
                    </p>
                    <p className="text-sm text-gray-500 dark:text-gray-400">มีผล {fmtDate(h.effective_date)}</p>
                  </div>
                  {h.reason && <p className="mt-0.5 text-sm text-gray-600 dark:text-gray-400 break-words">{reasonLabel(h.reason)}</p>}
                </li>
              )
            })}
          </ol>
        )}
      </div>
    </section>
  )
}

export default function MyFinancial() {
  const { can } = useCan()
  return (
    <div className="space-y-8 pb-10">
      <PageTitle title="ข้อมูลการเงินของฉัน" />

      <section aria-labelledby="fin-slips-h" className="space-y-3">
        <div>
          <h2 id="fin-slips-h" className="text-base font-semibold text-gray-900 dark:text-gray-100">สลิปเงินเดือน</h2>
          <p className="mt-0.5 text-sm text-gray-500 dark:text-gray-400">เฉพาะเดือนที่ผู้จัดการอนุมัติงวดเงินเดือนแล้ว ย้อนหลังได้ถึงเดือนแรกที่คำนวณในระบบนี้</p>
        </div>
        <MyPayslipsPanel detailHeadingAs="h3" />
      </section>

      <OnFileCard />

      {can("self.gratuity.view") && <MyGratuitySection />}

      {can("self.history.view") && <StepHistory />}
    </div>
  )
}
