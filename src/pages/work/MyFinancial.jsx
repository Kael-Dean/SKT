// src/pages/work/MyFinancial.jsx
// ─────────────────────────────────────────────────────────────────────────────
// ข้อมูลการเงินของฉัน (self-service) — api-handoff 2026-10-17 §2
//   a) GET /personnel/me/financial        ค่าที่บันทึกไว้: เงินเดือน ค่าตำแหน่ง และรายการหักประจำ
//   b) GET /personnel/me/payroll[/{id}]   สลิปรายเดือน (เฉพาะงวดที่อนุมัติ/ปิดแล้ว) → MyPayslipsPanel
//   c) GET /personnel/me/salary-history   ประวัติการเลื่อนขั้น (เป็น "ขั้น" ไม่ใช่บาท)
// ยอดจริงของแต่ละเดือนมาจากสลิป (b) — การ์ดบน (a) เป็นค่าตั้งต้นในทะเบียน ไม่คำนวณยอดสุทธิจากการ์ดนี้
// ─────────────────────────────────────────────────────────────────────────────
import { useCallback, useEffect, useState } from "react"
import { Link } from "react-router-dom"
import { ChevronRight } from "lucide-react"
import { apiAuth } from "../../lib/api"
import { useCan } from "../../lib/permissions"
import { money, toNum } from "../../lib/payroll"
import { fmtDate, fmtLevel, reasonLabel } from "../../components/hr/positionUtils"
import { cardCls, cx, focusRingCls } from "../../lib/styles"
import { EmptyState, ErrorState, SkeletonText } from "../../components/ui"
import MyPayslipsPanel from "../../components/hr/MyPayslipsPanel"
import PageTitle from "../../components/PageTitle"

// ─── a) ค่าที่บันทึกไว้ ────────────────────────────────────────────────────────
// `always` = แสดงแม้เป็น 0 (ให้เห็นว่าไม่มีรายการนี้), ไม่งั้นแสดงเฉพาะที่มีค่า
const INCOME_ON_FILE = [
  { key: "current_salary", label: "เงินเดือน", always: true, strong: true },
  { key: "position_allowance", label: "ค่าตำแหน่ง", always: true },
  { key: "current_pending", label: "เงินเพิ่มอื่น ๆ" },
]

const DEDUCTIONS_ON_FILE = [
  { key: "current_ss", label: "ประกันสังคม", always: true },
  // 0 = ใช้อัตรา % ตามการตั้งค่าการคำนวณเงินเดือน (ดู FinancialEditSheet)
  { key: "current_reserve", label: "เงินสะสม", always: true, zeroText: "ตามอัตรา % ที่ตั้งไว้" },
  { key: "current_prov", label: "กองทุนสำรองเลี้ยงชีพ", always: true },
  { key: "current_loan", label: "เงินกู้สหกรณ์", always: true },
  { key: "current_slf", label: "กยศ.", always: true },
  { key: "current_wg", label: "รายการหักอื่น ๆ" },
]

function fmtUpdated(iso) {
  if (!iso) return null
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return null
  return d.toLocaleDateString("th-TH", { day: "numeric", month: "short", year: "numeric" })
}

function OnFileLines({ title, lines, fin, minus }) {
  const shown = lines.filter((l) => l.always || toNum(fin[l.key]) !== 0)
  return (
    <section aria-label={title}>
      <h3 className="text-xs font-semibold text-gray-500 dark:text-gray-400">{title}</h3>
      <dl className="mt-1.5 divide-y divide-gray-100 dark:divide-line">
        {shown.map((l) => {
          const v = fin[l.key]
          const zero = toNum(v) === 0
          return (
            <div key={l.key} className="flex items-baseline justify-between gap-4 py-2 text-sm">
              <dt className={cx(l.strong ? "font-medium text-gray-900 dark:text-gray-100" : "text-gray-700 dark:text-gray-300")}>{l.label}</dt>
              <dd
                className={cx(
                  "tabular-nums text-right",
                  zero && !l.strong ? "text-gray-500 dark:text-gray-400" : "text-gray-900 dark:text-gray-100",
                  l.strong && "text-base font-semibold",
                )}
              >
                {v == null && !l.strong ? "—" : zero && l.zeroText ? l.zeroText : zero && !l.strong ? "ไม่มี" : `${minus ? "−" : ""}${money(v ?? 0)}`}
              </dd>
            </div>
          )
        })}
      </dl>
    </section>
  )
}

function OnFileCard() {
  const { can } = useCan()
  const [data, setData] = useState(null)
  const [state, setState] = useState("loading") // loading | ready | missing | error
  const [error, setError] = useState("")

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
        <h2 id="fin-onfile-h" className="text-base font-semibold text-gray-900 dark:text-gray-100">เงินเดือนและรายการหักประจำ</h2>
        {state === "ready" && (
          <p className="text-xs text-gray-500 dark:text-gray-400">
            {data.job_age != null && <>อายุงาน <span className="tabular-nums">{data.job_age}</span> ปี</>}
            {data.job_age != null && updated && " · "}
            {updated && <>ปรับปรุงล่าสุด {updated}</>}
          </p>
        )}
      </div>
      <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
        ค่าที่ฝ่ายบุคคลบันทึกไว้ในทะเบียน (บาท/เดือน) — ยอดที่ได้รับจริงของแต่ละเดือนดูจากสลิปเงินเดือนด้านล่าง
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
            <OnFileLines title="รายได้ประจำ" lines={INCOME_ON_FILE} fin={data} />
            <OnFileLines title="รายการหักประจำ" lines={DEDUCTIONS_ON_FILE} fin={data} minus />
          </div>
        )}
      </div>

      {state === "ready" && can("self.issue.report") && (
        <p className="mt-4 border-t border-gray-100 pt-3 text-sm text-gray-600 dark:border-line dark:text-gray-400">
          ข้อมูลไม่ตรงกับที่ได้รับจริง?{" "}
          <Link to="/my-profile" className={cx("inline-flex min-h-touch md:min-h-0 items-center gap-0.5 rounded font-medium text-indigo-700 hover:underline dark:text-indigo-300", focusRingCls)}>
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
    <div className="mx-auto max-w-4xl space-y-8 pb-10">
      <PageTitle title="ข้อมูลการเงินของฉัน" />

      <OnFileCard />

      <section aria-labelledby="fin-slips-h" className="space-y-3">
        <div>
          <h2 id="fin-slips-h" className="text-base font-semibold text-gray-900 dark:text-gray-100">สลิปเงินเดือน</h2>
          <p className="mt-0.5 text-sm text-gray-500 dark:text-gray-400">เฉพาะเดือนที่ผู้จัดการอนุมัติงวดเงินเดือนแล้ว ย้อนหลังได้ถึงเดือนแรกที่คำนวณในระบบนี้</p>
        </div>
        <MyPayslipsPanel detailHeadingAs="h3" />
      </section>

      {can("self.history.view") && <StepHistory />}
    </div>
  )
}
