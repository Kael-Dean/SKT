// src/components/hr/EmployeeHistoryCard.jsx
// ─────────────────────────────────────────────────────────────────────────────
// การ์ด "ประวัติ" ของพนักงาน 1 คน — 4 ส่วน อ่านอย่างเดียว (handoff 2026-11-17 ส่วนที่ 5)
//   ตำแหน่ง      GET {base}/position-history     (เก่า → ใหม่ · แสดงใหม่สุดก่อน)
//   โยกย้าย      GET {base}/relocation-history
//   การลา        GET {base}/leave-history        (รายปีงบ ใหม่ → เก่า · กดขยายดู items)
//   ขั้นเงินเดือน GET {base}/salary-steps          (รายปีงบ ใหม่ → เก่า)
// base = "/personnel/me" (ตัวเอง) | `/hr/employees/${id}` (HR — แต่ละส่วนเช็คสิทธิ์แยกด้วย `allow`)
// source: "register" = ทะเบียนกระดาษเดิมของ AMC → ป้ายเล็ก "จากทะเบียนเดิม"
// รายการว่าง = empty state (พนักงานใหม่ / staging) ไม่ใช่ error
// ─────────────────────────────────────────────────────────────────────────────
import { useCallback, useEffect, useMemo, useState } from "react"
import { ArrowRight, ChevronDown } from "lucide-react"
import { apiAuth } from "../../lib/api"
import { apiDetail } from "../../lib/apiErrors"
import { cx } from "../../lib/styles"
import { Badge, ErrorState, Skeleton, Tabs, panelId, tabId } from "../ui"

const CARD = "rounded-2xl bg-white dark:bg-surface ring-1 ring-gray-200/70 dark:ring-line shadow-sm p-4 md:p-5"
const MUTED = "text-gray-500 dark:text-gray-400"

function fmtDate(value) {
  if (!value) return "—"
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(value))
  const d = m ? new Date(+m[1], +m[2] - 1, +m[3]) : new Date(value)
  if (Number.isNaN(d.getTime())) return String(value)
  return d.toLocaleDateString("th-TH", { day: "numeric", month: "short", year: "numeric" })
}

/** Decimal-as-string → "3.5" · "4.0" → "4" · null → "—" */
function fmtNum(v) {
  if (v == null || v === "") return "—"
  const n = Number(v)
  if (!Number.isFinite(n)) return String(v)
  return n.toLocaleString("th-TH", { maximumFractionDigits: 2 })
}

const fmtMoney = (v) => (v == null || v === "" ? "—" : `${fmtNum(v)} บาท`)

function RegisterTag() {
  return (
    <span className="inline-flex shrink-0 items-center rounded-md bg-gray-100 px-1.5 py-0.5 text-[11px] font-medium text-gray-600 dark:bg-field dark:text-gray-400">
      จากทะเบียนเดิม
    </span>
  )
}

/** โหลดรายการ 1 endpoint — เฉพาะ request ล่าสุดเขียน state ได้ */
function useList(path, enabled) {
  const [state, setState] = useState({ path: null, rows: null, error: "" })
  const [nonce, setNonce] = useState(0)
  useEffect(() => {
    if (!enabled || !path) return undefined
    let alive = true
    apiAuth(path)
      .then((d) => { if (alive) setState({ path, rows: Array.isArray(d) ? d : [], error: "" }) })
      .catch((e) => { if (alive) setState({ path, rows: [], error: apiDetail(e) || e?.message || "โหลดข้อมูลไม่สำเร็จ" }) })
    return () => { alive = false }
  }, [path, enabled, nonce])
  const ready = state.path === path
  return { rows: ready ? state.rows : null, error: ready ? state.error : "", reload: useCallback(() => { setState((s) => ({ ...s, path: null })); setNonce((n) => n + 1) }, []) }
}

function Frame({ list, emptyText, children }) {
  if (list.rows === null) {
    return (
      <div className="space-y-2" aria-busy="true">
        <Skeleton className="h-12 w-full" />
        <Skeleton className="h-12 w-full" />
      </div>
    )
  }
  if (list.error) return <ErrorState message={list.error} onRetry={list.reload} />
  if (list.rows.length === 0) return <p className={cx("py-3 text-sm", MUTED)}>{emptyText}</p>
  return children
}

// ─── ตำแหน่ง ────────────────────────────────────────────────────────────────
function PositionSection({ base }) {
  const list = useList(`${base}/position-history`, true)
  const rows = useMemo(() => {
    const dateOf = (r) => String(r.promotion_date ?? r.effective_date ?? r.date ?? "")
    return [...(list.rows ?? [])].sort((a, b) => dateOf(b).localeCompare(dateOf(a)) || (b.id ?? 0) - (a.id ?? 0))
  }, [list.rows])
  return (
    <Frame list={list} emptyText="ยังไม่มีประวัติตำแหน่ง">
      <ol className="divide-y divide-gray-100 dark:divide-line">
        {rows.map((h, i) => {
          // position_text = ชื่อตำแหน่งตามคำสั่ง (ถ้ามี แสดงแทน new_position_title)
          const title = h.position_text || h.new_position_title || h.title || "ไม่ระบุตำแหน่ง"
          return (
            <li key={h.id ?? i} className="grid gap-1 py-2.5 text-sm sm:grid-cols-[8rem_minmax(0,1fr)] sm:gap-4">
              <span className={cx("whitespace-nowrap tabular-nums", MUTED)}>{fmtDate(h.promotion_date ?? h.effective_date ?? h.date)}</span>
              <div className="min-w-0">
                <p className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1 text-gray-900 dark:text-gray-100">
                  <span className="min-w-0 break-words font-semibold">{title}</span>
                  {h.is_acting && <Badge tone="pending">รักษาการ</Badge>}
                </p>
                {(h.order_reference || h.sub_unit) && (
                  <p className={cx("break-words text-xs", MUTED)}>
                    {[h.order_reference, h.sub_unit && `หน่วย ${h.sub_unit}`].filter(Boolean).join(" · ")}
                  </p>
                )}
              </div>
            </li>
          )
        })}
      </ol>
    </Frame>
  )
}

// ─── โยกย้าย ────────────────────────────────────────────────────────────────
function RelocationSection({ base }) {
  const list = useList(`${base}/relocation-history`, true)
  const rows = useMemo(
    () => [...(list.rows ?? [])].sort((a, b) => String(b.date ?? "").localeCompare(String(a.date ?? "")) || (b.id ?? 0) - (a.id ?? 0)),
    [list.rows],
  )
  return (
    <Frame list={list} emptyText="ยังไม่มีประวัติการโยกย้าย">
      <ol className="divide-y divide-gray-100 dark:divide-line">
        {rows.map((r, i) => (
          <li key={r.id ?? i} className="grid gap-1 py-2.5 text-sm sm:grid-cols-[8rem_minmax(0,1fr)] sm:gap-4">
            <span className={cx("whitespace-nowrap tabular-nums", MUTED)}>
              {fmtDate(r.date)}
              {r.date_to ? <span className="block text-xs">ถึง {fmtDate(r.date_to)}</span> : null}
            </span>
            <div className="min-w-0">
              <p className="break-words text-gray-900 dark:text-gray-100">
                {r.from_branch_name ? (
                  <>
                    <span className={MUTED}>{r.from_branch_name}</span>{" "}
                    <ArrowRight aria-hidden="true" className="inline size-3.5 align-[-2px] text-gray-400 dark:text-gray-500" strokeWidth={1.75} />
                    <span className="sr-only">ไป</span>{" "}
                  </>
                ) : null}
                <span className="font-semibold">{r.to_branch_name ?? "—"}</span>
                {r.sub_unit ? <span className={MUTED}> / {r.sub_unit}</span> : null}
                {/* นำเข้าจากทะเบียน: แถวแรกไม่มีสาขาต้นทาง = บรรจุครั้งแรก */}
                {!r.from_branch_name && !r.from_branch_id ? <span className="ml-2 align-middle"><Badge tone="info">บรรจุครั้งแรก</Badge></span> : null}
              </p>
              {(r.order_reference || r.reason) && (
                <p className={cx("break-words text-xs", MUTED)}>{[r.order_reference, r.reason].filter(Boolean).join(" · ")}</p>
              )}
            </div>
          </li>
        ))}
      </ol>
    </Frame>
  )
}

// ─── การลา (รายปีงบ · กดขยาย) ───────────────────────────────────────────────
function LeaveYearRow({ y }) {
  const [open, setOpen] = useState(false)
  const items = Array.isArray(y.items) ? y.items : []
  const panel = `leave-year-${y.fiscal_year}-${y.source}`
  return (
    <li>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-controls={panel}
        className="flex min-h-touch w-full min-w-0 cursor-pointer items-center gap-3 rounded-lg px-1 py-2.5 text-left text-sm transition-colors duration-150 hover:bg-gray-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 dark:hover:bg-white/[.04] md:min-h-0"
      >
        <span className="w-16 shrink-0 font-semibold tabular-nums text-gray-900 dark:text-gray-100">{y.fiscal_year}</span>
        <span className="flex min-w-0 flex-1 flex-wrap items-center gap-x-2 gap-y-1">
          <span className="tabular-nums text-gray-700 dark:text-gray-300">{fmtNum(y.total_days)} วัน</span>
          {y.position && <span className={cx("min-w-0 truncate text-xs", MUTED)}>{y.position}</span>}
          {y.source === "register" && <RegisterTag />}
        </span>
        <ChevronDown aria-hidden="true" className={cx("size-4 shrink-0 text-gray-400 transition-transform duration-200", open && "rotate-180")} strokeWidth={1.75} />
      </button>
      {open && (
        <div id={panel} className="pb-3 pl-[4.75rem] pr-1">
          {items.length === 0 ? (
            <p className={cx("text-xs", MUTED)}>ไม่มีรายการ</p>
          ) : (
            <dl className="grid grid-cols-[minmax(0,1fr)_auto] gap-x-4 gap-y-1 text-sm">
              {items.map((it, i) => (
                <div key={`${it.leave_type_id ?? "x"}-${i}`} className="contents">
                  <dt className="min-w-0 break-words text-gray-600 dark:text-gray-400">{it.leave_type_name}</dt>
                  <dd className={cx("text-right tabular-nums", Number(it.days) === 0 ? "text-gray-400 dark:text-gray-500" : "text-gray-900 dark:text-gray-100")}>{fmtNum(it.days)}</dd>
                </div>
              ))}
            </dl>
          )}
        </div>
      )}
    </li>
  )
}

function LeaveSection({ base }) {
  const list = useList(`${base}/leave-history`, true)
  const rows = useMemo(() => [...(list.rows ?? [])].sort((a, b) => (b.fiscal_year ?? 0) - (a.fiscal_year ?? 0)), [list.rows])
  return (
    <Frame list={list} emptyText="ยังไม่มีประวัติการลา">
      <ul className="divide-y divide-gray-100 dark:divide-line">
        {rows.map((y) => <LeaveYearRow key={`${y.fiscal_year}-${y.source}`} y={y} />)}
      </ul>
    </Frame>
  )
}

// ─── ขั้นเงินเดือน (รายปีงบ) ────────────────────────────────────────────────
function SalaryStepsSection({ base }) {
  const list = useList(`${base}/salary-steps`, true)
  // backend เรียงปีใหม่ → เก่า และแถว system มาก่อน register ในปีเดียวกันอยู่แล้ว — คงลำดับนั้น
  const rows = list.rows ?? []
  return (
    <Frame list={list} emptyText="ยังไม่มีประวัติขั้นเงินเดือน">
      <ul className="divide-y divide-gray-100 dark:divide-line">
        {rows.map((s, i) => (
          <li key={`${s.fiscal_year}-${s.source}-${i}`} className="grid gap-1 py-2.5 text-sm sm:grid-cols-[4rem_minmax(0,1fr)] sm:gap-4">
            <span className="font-semibold tabular-nums text-gray-900 dark:text-gray-100">{s.fiscal_year}</span>
            <div className="min-w-0">
              <p className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1 text-gray-900 dark:text-gray-100">
                {s.steps != null ? (
                  <span className="tabular-nums">{Number(s.steps) === 0 ? "ไม่ได้ขั้น" : `${fmtNum(s.steps)} ขั้น`}</span>
                ) : (
                  // steps: null → โชว์ note (เช่น "ลาออก")
                  <span>{s.note || "—"}</span>
                )}
                {s.source === "register" && <RegisterTag />}
              </p>
              <p className={cx("break-words text-xs", MUTED)}>
                {[
                  s.steps != null && s.note ? s.note : null,
                  s.level_from != null && s.level_to != null ? `ระดับ ${fmtNum(s.level_from)} → ${fmtNum(s.level_to)}` : null,
                  s.salary_snapshot != null ? `เงินเดือน ณ 31 มี.ค. 2569: ${fmtMoney(s.salary_snapshot)}` : null,
                  s.position,
                ].filter(Boolean).join(" · ")}
              </p>
            </div>
          </li>
        ))}
      </ul>
    </Frame>
  )
}

const SECTIONS = [
  { key: "position", label: "ตำแหน่ง", Comp: PositionSection },
  { key: "relocation", label: "โยกย้าย", Comp: RelocationSection },
  { key: "leave", label: "การลา", Comp: LeaveSection },
  { key: "salary", label: "ขั้นเงินเดือน", Comp: SalaryStepsSection },
]

/**
 * @param {string}  base   "/personnel/me" | `/hr/employees/${id}`
 * @param {object}  allow  { position, relocation, leave, salary } → false = ซ่อนส่วนนั้น (ไม่มีสิทธิ์ฝั่ง HR). ไม่ส่ง = ทุกส่วน
 */
export default function EmployeeHistoryCard({ base, allow, className }) {
  const visible = SECTIONS.filter((s) => allow?.[s.key] !== false)
  const [tab, setTab] = useState(visible[0]?.key ?? "position")
  if (visible.length === 0) return null
  const active = visible.find((s) => s.key === tab) ?? visible[0]
  const Comp = active.Comp
  return (
    <section className={cx(CARD, className)} aria-labelledby="emp-history-h">
      <h3 id="emp-history-h" className="mb-3 border-b border-indigo-100 pb-1 text-xs font-semibold uppercase tracking-wide text-indigo-700 dark:border-indigo-900/40 dark:text-indigo-300">
        ประวัติ
      </h3>
      <Tabs
        items={visible.map((s) => ({ value: s.key, label: s.label }))}
        value={active.key}
        onChange={setTab}
        ariaLabel="ประวัติพนักงาน"
        idBase="emp-history"
      />
      <div
        role="tabpanel"
        id={panelId("emp-history", active.key)}
        aria-labelledby={tabId("emp-history", active.key)}
        tabIndex={0}
        className="mt-3 focus:outline-none"
      >
        {/* key = base+tab → เปลี่ยนคน/แท็บแล้วโหลดใหม่เอง */}
        <Comp key={`${base}:${active.key}`} base={base} />
      </div>
    </section>
  )
}
