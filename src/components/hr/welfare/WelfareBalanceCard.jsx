// src/components/hr/welfare/WelfareBalanceCard.jsx
// ─────────────────────────────────────────────────────────────────────────────
// สิทธิ์สวัสดิการคงเหลือของเจ้าหน้าที่ 1 คน (3P)
//   GET /hr/employees/{id}/welfare-balance?fiscal_year=&academic_year=
//   (หน้าพนักงานใช้ข้อมูลจาก GET /personnel/me/welfare → ส่ง `balance` เข้ามาตรง ๆ)
//
//   <WelfareBalanceCard employeeId={345} fiscalYear={2569} academicYear={2569} refreshKey={n} />
//   <WelfareBalanceView balance={data.balance} />            ← ไม่ยิง API
//
// ยอดในตัวนี้เป็น number (ต่างจาก ClaimOut ที่เป็น decimal string) — แสดงด้วย money()
// ─────────────────────────────────────────────────────────────────────────────
import { useEffect, useState } from "react"
import { apiAuth } from "../../../lib/api"
import { apiDetail } from "../../../lib/apiErrors"
import { cx } from "../../../lib/styles"
import { money } from "../../../lib/welfare"
import { Badge, Skeleton } from "../../ui"

const n = (v) => (Number.isFinite(Number(v)) ? Number(v) : 0)

/** แถบใช้ไป/วงเงิน — สีบอกระดับคงเหลือ (ไม่ใช่ของตกแต่ง: ตัวเลขจริงอยู่ข้าง ๆ เสมอ) */
function Meter({ used, cap }) {
  const pct = cap > 0 ? Math.min(100, Math.round((used / cap) * 100)) : 0
  const left = cap - used
  const tone = left <= 0 ? "bg-red-500 dark:bg-red-400" : left / Math.max(cap, 1) < 0.2 ? "bg-amber-500 dark:bg-amber-400" : "bg-indigo-500 dark:bg-indigo-400"
  return (
    <div className="h-1.5 w-full overflow-hidden rounded-full bg-gray-100 dark:bg-white/[.06]" aria-hidden="true">
      <div className={cx("h-full rounded-full transition-[width] duration-300 ease-out motion-reduce:transition-none", tone)} style={{ width: `${pct}%` }} />
    </div>
  )
}

function CapRow({ label, hint, bucket, strong = false }) {
  if (!bucket) return null
  const cap = n(bucket.cap)
  const used = n(bucket.used)
  const remaining = bucket.remaining != null ? n(bucket.remaining) : Math.max(0, cap - used)
  return (
    <div className="space-y-1.5">
      <div className="flex items-baseline justify-between gap-3">
        <dt className={cx("min-w-0 text-sm", strong ? "font-semibold text-gray-900 dark:text-gray-100" : "text-gray-700 dark:text-gray-300")}>
          {label}
          {hint && <span className="block text-xs font-normal text-gray-500 dark:text-gray-400">{hint}</span>}
        </dt>
        <dd className="shrink-0 text-right tabular-nums">
          <span className={cx("font-semibold", remaining <= 0 ? "text-red-700 dark:text-red-300" : "text-gray-900 dark:text-gray-100", strong ? "text-base" : "text-sm")}>
            {money(remaining)}
          </span>
          <span className="text-xs text-gray-500 dark:text-gray-400"> / {money(cap)}</span>
        </dd>
      </div>
      <Meter used={used} cap={cap} />
      <p className="text-xs tabular-nums text-gray-500 dark:text-gray-400">ใช้ไป {money(used)} บาท</p>
    </div>
  )
}

/** มุมมองอย่างเดียว (ไม่ยิง API) */
export function WelfareBalanceView({ balance, compact = false, className = "" }) {
  if (!balance) return null
  const edu = Array.isArray(balance.education) ? balance.education : []
  const chk = balance.checkup
  return (
    <div className={cx("space-y-4", className)}>
      <dl className="space-y-4">
        <CapRow strong label="ค่ารักษาพยาบาล" hint="วงเงินรวมตัวเจ้าหน้าที่และครอบครัว" bucket={balance.medical} />
        <div className={cx("grid gap-4", compact ? "grid-cols-1" : "sm:grid-cols-2")}>
          <CapRow label="รพ.เอกชน ผู้ป่วยนอก" bucket={balance.private_opd} />
          <CapRow label="รพ.เอกชน ผู้ป่วยใน" bucket={balance.private_ipd} />
        </div>
      </dl>

      {chk && (
        <div className="flex items-center justify-between gap-3 border-t border-gray-100 pt-3 dark:border-line">
          <div className="min-w-0 text-sm text-gray-700 dark:text-gray-300">
            ตรวจสุขภาพประจำปี
            <span className="block text-xs text-gray-500 dark:text-gray-400">ปีละครั้ง เฉพาะตัวเจ้าหน้าที่ · วงเงิน {money(chk.cap)} บาท</span>
          </div>
          {chk.taken
            ? <Badge tone="neutral">ใช้สิทธิ์แล้ว{n(chk.used) > 0 ? ` ${money(chk.used)}` : ""}</Badge>
            : <Badge tone="success">ยังไม่ใช้สิทธิ์</Badge>}
        </div>
      )}

      {edu.length > 0 && (
        <div className="space-y-2 border-t border-gray-100 pt-3 dark:border-line">
          <p className="text-sm text-gray-700 dark:text-gray-300">
            ค่าการศึกษาบุตร <span className="text-xs text-gray-500 dark:text-gray-400">ปีการศึกษา {edu[0]?.academic_year ?? "—"}</span>
          </p>
          <ul className="divide-y divide-gray-100 dark:divide-line">
            {edu.map((e) => (
              <li key={e.dependant_id ?? e.name} className="flex items-start justify-between gap-3 py-2 text-sm">
                <div className="min-w-0">
                  <p className="truncate text-gray-900 dark:text-gray-100">{e.name || "—"}</p>
                  {!e.eligible && e.reason && <p className="text-xs text-gray-500 dark:text-gray-400">{e.reason}</p>}
                </div>
                {e.eligible
                  ? <span className="shrink-0 text-right text-xs tabular-nums text-gray-600 dark:text-gray-300">เบิกแล้ว <span className="font-semibold text-gray-900 dark:text-gray-100">{money(e.used)}</span></span>
                  : <Badge tone="neutral">ไม่มีสิทธิ์</Badge>}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}

/**
 * การ์ดที่ดึงยอดเอง
 * @param {{ employeeId: number|string, fiscalYear?: number|string, academicYear?: number|string,
 *           refreshKey?: any, compact?: boolean, title?: string, className?: string, bare?: boolean }} props
 *   bare = ไม่ห่อกรอบการ์ด (วางในกล่องที่มีกรอบอยู่แล้ว เช่นใน Sheet)
 */
export default function WelfareBalanceCard({
  employeeId, fiscalYear, academicYear, refreshKey, compact = false, title = "สิทธิ์คงเหลือ", className = "", bare = false,
}) {
  const [state, setState] = useState({ key: null, data: null, error: "" })
  const key = employeeId ? `${employeeId}|${fiscalYear ?? ""}|${academicYear ?? ""}|${refreshKey ?? ""}` : null

  useEffect(() => {
    if (!key) return
    let alive = true
    const p = new URLSearchParams()
    if (fiscalYear) p.set("fiscal_year", String(fiscalYear))
    if (academicYear) p.set("academic_year", String(academicYear))
    const qs = p.toString()
    apiAuth(`/hr/employees/${encodeURIComponent(employeeId)}/welfare-balance${qs ? `?${qs}` : ""}`)
      .then((d) => { if (alive) setState({ key, data: d, error: "" }) })
      .catch((err) => { if (alive) setState({ key, data: null, error: apiDetail(err) || "โหลดสิทธิ์คงเหลือไม่สำเร็จ" }) })
    return () => { alive = false }
  }, [key, employeeId, fiscalYear, academicYear])

  const loading = key && state.key !== key
  const data = state.key === key ? state.data : null

  const body = !employeeId ? (
    <p className="text-sm text-gray-500 dark:text-gray-400">เลือกเจ้าหน้าที่เพื่อดูสิทธิ์คงเหลือ</p>
  ) : loading ? (
    <div className="space-y-3" aria-hidden="true">
      <Skeleton className="h-4 w-2/3" rounded="rounded" />
      <Skeleton className="h-1.5 w-full" rounded="rounded-full" />
      <Skeleton className="h-4 w-1/2" rounded="rounded" />
      <Skeleton className="h-1.5 w-full" rounded="rounded-full" />
    </div>
  ) : state.error ? (
    <p role="alert" className="text-sm text-red-600 dark:text-red-400">{state.error}</p>
  ) : (
    <WelfareBalanceView balance={data} compact={compact} />
  )

  return (
    <section
      aria-label={title}
      aria-busy={loading || undefined}
      className={cx(!bare && "rounded-2xl bg-white p-4 ring-1 ring-gray-200/70 shadow-sm dark:bg-surface dark:ring-line dark:shadow-none", className)}
    >
      <div className="mb-3 flex items-baseline justify-between gap-2">
        <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">{title}</h3>
        {data?.fiscal_year && <span className="text-xs tabular-nums text-gray-500 dark:text-gray-400">ปีงบประมาณ {data.fiscal_year}</span>}
      </div>
      {body}
    </section>
  )
}
