// src/components/hr/kpi/BranchKpiPanel.jsx
// Sub-tab "ผลงานสาขา" (hr.kpi.branch → backend kpi.branch). Yearly KPI of each branch/ฝ่าย out of 100;
// it feeds the `branch` component of every staff/head evaluation (28 / 30 points).
//   GET  /hr/kpi/branch?fiscal_year=   → [{ id, branch_id, fiscal_year, <6 scores>, total_score, submitted_by, submitted_at }]
//   POST /hr/kpi/branch { branch_id, fiscal_year, <6 scores> } (upsert)
//        → 201 { …row, evaluations_updated: [user ids], needs_reopen: [user ids] }
// Backend does not validate the scores — maxima / 2 decimals / all-required are enforced here.
// Entry is open all year until window_end (409 "ปิดรับข้อมูลแล้ว…" afterwards → lock the year).
import { useCallback, useEffect, useMemo, useState } from "react"
import { AlertTriangle, Lock, RotateCcw, Search, X } from "lucide-react"
import SelectDropdown from "../../SelectDropdown"
import { Notice } from "../HrModal"
import { apiAuth } from "../../../lib/api"
import { apiDetail, describeApiError } from "../../../lib/apiErrors"
import { useDrill } from "../../../lib/drill"
import { fetchMyBranches } from "../../../lib/leaveCalendar"
import { canPickAnyBranch } from "../../../lib/permissions"
import { baseField, cellInput, cx, fieldDisabled, iconBtnCls, primaryBtnCls } from "../../../lib/styles"
import { useIsPhone } from "../../../hooks/useMediaQuery"
import { EmptyState, ErrorState, SkeletonCard, SkeletonTableRows, toast } from "../../ui"
import { cardCls, errText, fmtDate, linkBtn, nf, thCls } from "../positionUtils"
import { BRANCH_KPI_FIELDS, BRANCH_KPI_TOTAL, branchKpiError, fmtDay, fmtScore, num } from "./kpiUtils"

const FILTERS = [
  { value: "", label: "ทุกสาขา/ฝ่าย" },
  { value: "missing", label: "ยังไม่บันทึก" },
  { value: "saved", label: "บันทึกแล้ว" },
]
const COLS = BRANCH_KPI_FIELDS.length + 4

/** copy of `obj` without `key` */
const omit = (obj, key) => {
  const next = { ...obj }
  delete next[key]
  return next
}

const round2 = (n) => Math.round(n * 100) / 100

/** saved row → { field: "9" } (strings for the inputs) */
const toDraft = (saved) =>
  Object.fromEntries(BRANCH_KPI_FIELDS.map((f) => [f.key, saved && num(saved[f.key]) != null ? fmtScore(saved[f.key]) : ""]))

/** branch list in the user's scope — same source as the HR dashboard filter */
function useBranchList() {
  const [state, setState] = useState({ list: [], loading: true, error: "" })
  const [attempt, setAttempt] = useState(0)
  useEffect(() => {
    let alive = true
    setState((s) => ({ ...s, loading: true, error: "" }))
    const load = canPickAnyBranch()
      ? apiAuth("/order/branch/search").then((d) =>
          (Array.isArray(d) ? d : []).map((b) => ({ id: Number(b.id), name: b.branch_name || `สาขา ${b.id}` })))
      : fetchMyBranches()
    load
      .then((list) => { if (alive) setState({ list: list.filter((b) => Number.isFinite(b.id)), loading: false, error: "" }) })
      .catch((e) => { if (alive) setState({ list: [], loading: false, error: errText(e, "โหลดรายชื่อสาขาไม่สำเร็จ") }) })
    return () => { alive = false }
  }, [attempt])
  const retry = useCallback(() => setAttempt((n) => n + 1), [])
  return { ...state, retry }
}

export default function BranchKpiPanel({ fy, info, phase, perms, people, onChanged }) {
  const isPhone = useIsPhone()
  const { drillParams } = useDrill()
  const branches = useBranchList()

  const [saved, setSaved] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [drafts, setDrafts] = useState({}) // { [branchId]: { field: string } } — edited rows only
  const [touched, setTouched] = useState({}) // { [branchId]: { field: true } }
  const [savingId, setSavingId] = useState(null)
  const [closedDetail, setClosedDetail] = useState("") // 409 from the server
  const [reopen, setReopen] = useState({}) // { [branchId]: [user ids] } — needs_reopen of the last save
  const [q, setQ] = useState("")
  const [filter, setFilter] = useState("")

  const load = useCallback(() => {
    setLoading(true)
    setError("")
    return apiAuth(`/hr/kpi/branch?fiscal_year=${Number(fy)}`)
      .then((d) => setSaved(Array.isArray(d) ? d : []))
      .catch((e) => { setSaved([]); setError(errText(e, "โหลดคะแนนผลงานสาขาไม่สำเร็จ")) })
      .finally(() => setLoading(false))
  }, [fy])
  useEffect(() => { load() }, [load])

  const savedById = useMemo(() => new Map(saved.map((r) => [Number(r.branch_id), r])), [saved])

  // branch list ∪ branches that already have a saved row (keeps old/hidden branches visible)
  const rows = useMemo(() => {
    const out = branches.list.map((b) => ({ id: b.id, name: b.name }))
    const known = new Set(out.map((b) => b.id))
    for (const r of saved) {
      const id = Number(r.branch_id)
      if (Number.isFinite(id) && !known.has(id)) { out.push({ id, name: `สาขา ${id}` }); known.add(id) }
    }
    return out
  }, [branches.list, saved])
  const nameOfBranch = useCallback((id) => rows.find((b) => b.id === Number(id))?.name ?? `สาขา ${id}`, [rows])

  const windowClosed = phase === "after"
  const locked = windowClosed || !!closedDetail

  // ── per-row derived state ────────────────────────────────────────────────
  const rowState = useCallback((id) => {
    const base = savedById.get(id) ?? null
    const values = drafts[id] ?? toDraft(base)
    const baseVals = toDraft(base)
    const dirty = !!drafts[id] && BRANCH_KPI_FIELDS.some((f) => {
      const a = String(values[f.key]).trim()
      const b = baseVals[f.key]
      return a === "" || b === "" ? a !== b : Number(a) !== Number(b)
    })
    const errors = Object.fromEntries(BRANCH_KPI_FIELDS.map((f) => [f.key, branchKpiError(values[f.key], f.max)]))
    const valid = Object.values(errors).every((e) => !e)
    const total = round2(BRANCH_KPI_FIELDS.reduce((s, f) => s + (errors[f.key] ? 0 : Number(values[f.key])), 0))
    const filled = BRANCH_KPI_FIELDS.filter((f) => !errors[f.key]).length
    return { base, values, dirty, errors, valid, total, filled }
  }, [drafts, savedById])

  /** message shown under a field ("" = none). Empty fields only complain once the row is being edited. */
  const visibleError = (id, key, st) => {
    const e = st.errors[key]
    if (!e) return ""
    if (e === "required") return st.dirty && touched[id]?.[key] ? "จำเป็น" : ""
    return e
  }

  const setValue = (id, key, value) => {
    setDrafts((m) => ({ ...m, [id]: { ...(m[id] ?? toDraft(savedById.get(id))), [key]: value } }))
  }
  const touch = (id, key) => setTouched((m) => ({ ...m, [id]: { ...(m[id] ?? {}), [key]: true } }))
  const resetRow = (id) => {
    setDrafts((m) => omit(m, id))
    setTouched((m) => omit(m, id))
  }

  const save = async (id) => {
    const st = rowState(id)
    if (locked || savingId != null) return
    if (!st.dirty || !st.valid) {
      // reveal every problem in the row; nothing is sent
      setTouched((m) => ({ ...m, [id]: Object.fromEntries(BRANCH_KPI_FIELDS.map((f) => [f.key, true])) }))
      return
    }
    const body = { branch_id: id, fiscal_year: Number(fy) }
    for (const f of BRANCH_KPI_FIELDS) body[f.key] = Number(String(st.values[f.key]).trim())
    setSavingId(id)
    try {
      const res = await apiAuth("/hr/kpi/branch", { method: "POST", body })
      const { evaluations_updated: updated, needs_reopen: needs, ...row } = res ?? {}
      setSaved((list) => [...list.filter((r) => Number(r.branch_id) !== id), { ...body, ...row, branch_id: id }])
      resetRow(id)
      const nUpdated = Array.isArray(updated) ? updated.length : 0
      const needIds = Array.isArray(needs) ? needs : []
      setReopen((m) => (needIds.length ? { ...m, [id]: needIds } : omit(m, id)))
      toast.success(`อัปเดตคะแนนผลงานสาขาให้ ${nf(nUpdated)} คน`, {
        description: `${nameOfBranch(id)} รวม ${fmtScore(row.total_score ?? st.total)}/${BRANCH_KPI_TOTAL}${needIds.length ? ` · ยังไม่ถึง ${nf(needIds.length)} คน ดูคำเตือนด้านบน` : ""}`,
      })
      onChanged?.()
    } catch (e) {
      const detail = apiDetail(e)
      if (e?.status === 409) {
        setClosedDetail(detail || "ปิดรับข้อมูลแล้ว ช่วงเวลาประเมินสิ้นสุดแล้ว")
        toast.error("บันทึกไม่ได้", { description: detail || "ปิดรับข้อมูลแล้ว" })
      } else {
        const d = describeApiError(e)
        toast.error(d.title, { description: detail || d.description })
      }
    } finally {
      setSavingId(null)
    }
  }

  const onKeyDown = (e, id) => {
    if (e.key === "Enter") { e.preventDefault(); save(id) }
    else if (e.key === "Escape" && drafts[id]) { e.preventDefault(); resetRow(id) }
  }

  // ── filtering ───────────────────────────────────────────────────────────
  const savedCount = rows.filter((b) => savedById.has(b.id)).length
  const visible = useMemo(() => {
    const needle = q.trim().toLowerCase()
    return rows.filter((b) => {
      if (filter === "missing" && savedById.has(b.id)) return false
      if (filter === "saved" && !savedById.has(b.id)) return false
      return !needle || b.name.toLowerCase().includes(needle) || String(b.id) === needle
    })
  }, [rows, q, filter, savedById])

  const reopenEntries = Object.entries(reopen)
  const reopenCount = reopenEntries.reduce((s, [, ids]) => s + ids.length, 0)
  const isLoading = loading || branches.loading
  const loadError = error || (!rows.length && branches.error)

  const lastSaved = (base) =>
    base?.submitted_at ? (
      <>
        <span className="tabular-nums">{fmtDate(base.submitted_at)}</span>
        {base.submitted_by != null && <span className="block text-gray-500 dark:text-gray-400">{people.nameOf(base.submitted_by)}</span>}
      </>
    ) : (
      <span className="text-gray-500 dark:text-gray-400">ยังไม่บันทึก</span>
    )

  const inputProps = (b, f, st, compact) => {
    const inputId = `bkpi-${b.id}-${f.key}`
    const err = visibleError(b.id, f.key, st)
    return {
      id: inputId,
      type: "text",
      inputMode: "decimal",
      autoComplete: "off",
      value: st.values[f.key],
      disabled: locked || savingId === b.id,
      onChange: (e) => setValue(b.id, f.key, e.target.value),
      onBlur: () => touch(b.id, f.key),
      onKeyDown: (e) => onKeyDown(e, b.id),
      "aria-invalid": err ? true : undefined,
      "aria-describedby": err ? `${inputId}-err` : undefined,
      className: cx(
        compact ? cx(cellInput, "!w-16 !py-1.5") : cx(baseField, "!rounded-lg !px-3 !py-2 text-right tabular-nums md:!text-sm"),
        err && "!border-red-500 dark:!border-red-400",
        locked && fieldDisabled,
      ),
      err,
    }
  }

  const saveBtn = (b, st, full) => (
    <button
      type="button"
      className={cx(primaryBtnCls, full ? "w-full" : "md:!h-8 !px-3 text-xs")}
      disabled={locked || !st.dirty || !st.valid || savingId != null}
      onClick={() => save(b.id)}
    >
      {savingId === b.id ? "กำลังบันทึก…" : "บันทึก"}
    </button>
  )

  return (
    <div className="space-y-4">
      {locked ? (
        <Notice tone={closedDetail ? "error" : "info"}>
          <span className="inline-flex items-start gap-1.5">
            <Lock aria-hidden="true" className="mt-0.5 size-4 shrink-0" strokeWidth={1.75} />
            <span>
              {closedDetail || `ปิดรับข้อมูลแล้ว ช่วงประเมินปีบัญชี ${fy} สิ้นสุด ${fmtDay(info?.window_end)}`}
            </span>
          </span>
        </Notice>
      ) : (
        <p className="text-sm text-gray-600 dark:text-gray-400 text-pretty">
          คะแนน KPI ของสาขา/ฝ่ายเต็ม {BRANCH_KPI_TOTAL} ใช้คำนวณส่วน "ผลงานสาขา" ของทุกคนในสาขาโดยอัตโนมัติ
          {info?.window_end ? ` แก้ไขได้ถึง ${fmtDay(info.window_end)}` : ""}
        </p>
      )}

      {reopenCount > 0 && (
        <Notice tone="warning" title={`คะแนนใหม่ยังไม่ถึง ${nf(reopenCount)} คน`}>
          <div className="space-y-2">
            <p>
              ผลของคนเหล่านี้สรุปผลหรือผ่านผู้ช่วยผู้จัดการตรวจสอบแล้ว จึงยังใช้คะแนนผลงานสาขาเดิม
              ต้องส่งกลับแก้ไข (reopen) แล้วสรุปผลใหม่
            </p>
            <ul className="space-y-1">
              {reopenEntries.map(([bid, ids]) => (
                <li key={bid}>
                  <span className="font-semibold">{nameOfBranch(bid)}:</span> {ids.map((uid) => people.nameOf(uid)).join(", ")}
                </li>
              ))}
            </ul>
            <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
              {perms.finalize && (
                <button
                  type="button"
                  className={cx(linkBtn, "text-sm text-amber-900 dark:text-amber-100 underline")}
                  onClick={() => drillParams((p) => { p.set("sub", "finalize"); return p }, "ผลงานสาขา")}
                >
                  ไปแท็บสรุปผล
                </button>
              )}
              <button
                type="button"
                className={cx(linkBtn, "inline-flex items-center gap-1 text-sm text-amber-900 dark:text-amber-100")}
                onClick={() => setReopen({})}
              >
                <X aria-hidden="true" className="size-3.5" strokeWidth={2} />
                ปิดคำเตือน
              </button>
            </div>
          </div>
        </Notice>
      )}

      <div className="flex flex-wrap items-center gap-2">
        <div className="relative w-full sm:w-72">
          <Search aria-hidden="true" className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-gray-400 dark:text-gray-500" strokeWidth={1.75} />
          <input
            type="search"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="ค้นหาสาขา/ฝ่าย"
            aria-label="ค้นหาสาขา/ฝ่าย"
            className={cx(baseField, "!rounded-lg !py-2 !pl-9 !pr-3 md:!text-sm")}
          />
        </div>
        <div className="w-full sm:w-52">
          <SelectDropdown options={FILTERS} value={filter} onChange={setFilter} ariaLabel="กรองสถานะการบันทึก" showSwatch={false} size="sm" />
        </div>
        {!isLoading && rows.length > 0 && (
          <p className="text-sm text-gray-600 dark:text-gray-400 sm:ml-auto" aria-live="polite">
            บันทึกแล้ว <span className="font-semibold tabular-nums text-gray-900 dark:text-gray-100">{nf(savedCount)}</span> จาก{" "}
            <span className="tabular-nums">{nf(rows.length)}</span> สาขา/ฝ่าย
          </p>
        )}
      </div>

      {loadError ? (
        <ErrorState message={loadError} onRetry={() => { load(); branches.retry() }} />
      ) : !isLoading && rows.length === 0 ? (
        <div className={cx(cardCls, "p-2")}>
          <EmptyState title="ไม่พบสาขา/ฝ่าย" description="บัญชีนี้ไม่มีสาขาหรือฝ่ายที่ดูแล" />
        </div>
      ) : !isLoading && visible.length === 0 ? (
        <div className={cx(cardCls, "p-2")}>
          <EmptyState title="ไม่พบสาขา/ฝ่ายที่ตรงเงื่อนไข" description="ลองล้างคำค้นหรือเปลี่ยนตัวกรอง" />
        </div>
      ) : isPhone ? (
        // ── phone: one card per branch ─────────────────────────────────────
        <ul className="space-y-3" aria-label="คะแนนผลงานสาขา">
          {isLoading
            ? Array.from({ length: 3 }, (_, i) => <li key={i}><SkeletonCard /></li>)
            : visible.map((b) => {
                const st = rowState(b.id)
                return (
                  <li key={b.id} className={cx(cardCls, "p-4 space-y-3")}>
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <h3 className="font-semibold text-gray-900 dark:text-gray-100 break-words">{b.name}</h3>
                        <p className="text-xs text-gray-600 dark:text-gray-400">
                          {st.dirty ? <span className="font-medium text-amber-700 dark:text-amber-300">แก้ไขแล้ว ยังไม่บันทึก</span> : lastSaved(st.base)}
                        </p>
                      </div>
                      <Total st={st} />
                    </div>
                    <div className="divide-y divide-gray-100 dark:divide-gray-700/60">
                      {BRANCH_KPI_FIELDS.map((f) => {
                        const { err, ...p } = inputProps(b, f, st, false)
                        return (
                          <div key={f.key} className="grid grid-cols-[1fr_6.5rem] items-center gap-3 py-2">
                            <label htmlFor={p.id} className="text-sm text-gray-800 dark:text-gray-200">
                              {f.label}
                              <span className="block text-xs text-gray-500 dark:text-gray-400">เต็ม {f.max}</span>
                            </label>
                            <div>
                              <input {...p} />
                              {err && <p id={`${p.id}-err`} className="mt-1 text-right text-xs font-medium text-red-600 dark:text-red-400">{err}</p>}
                            </div>
                          </div>
                        )
                      })}
                    </div>
                    {!locked && (
                      <div className="flex gap-2">
                        {st.dirty && (
                          <button type="button" className={iconBtnCls} aria-label={`คืนค่าเดิม ${b.name}`} onClick={() => resetRow(b.id)}>
                            <RotateCcw aria-hidden="true" className="size-4" strokeWidth={1.75} />
                          </button>
                        )}
                        {saveBtn(b, st, true)}
                      </div>
                    )}
                  </li>
                )
              })}
        </ul>
      ) : (
        // ── desktop: table ─────────────────────────────────────────────────
        <div className={cx(cardCls, "overflow-hidden")}>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <caption className="sr-only">คะแนน KPI ผลงานสาขา ปีบัญชี {fy}</caption>
              <thead className="border-b border-gray-100 bg-gray-50 dark:border-gray-700 dark:bg-gray-900/30">
                <tr>
                  <th scope="col" className={cx(thCls, "text-left align-bottom")}>สาขา/ฝ่าย</th>
                  {BRANCH_KPI_FIELDS.map((f) => (
                    <th key={f.key} scope="col" className={cx(thCls, "!px-2 text-right align-bottom font-semibold")}>
                      <span className="block max-w-[7.5rem] ml-auto leading-snug text-balance">{f.label}</span>
                      <span className="block font-normal text-gray-500 dark:text-gray-400 tabular-nums">เต็ม {f.max}</span>
                    </th>
                  ))}
                  <th scope="col" className={cx(thCls, "!px-3 text-right align-bottom whitespace-nowrap")}>
                    รวม
                    <span className="block font-normal text-gray-500 dark:text-gray-400 tabular-nums">เต็ม {BRANCH_KPI_TOTAL}</span>
                  </th>
                  <th scope="col" className={cx(thCls, "text-left align-bottom whitespace-nowrap")}>บันทึกล่าสุด</th>
                  <th scope="col" className={thCls}><span className="sr-only">การทำงาน</span></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-700/50">
                {isLoading ? (
                  <SkeletonTableRows rows={6} cols={COLS} />
                ) : (
                  visible.map((b) => {
                    const st = rowState(b.id)
                    return (
                      <tr key={b.id} className={cx("align-top", st.dirty ? "bg-amber-50/60 dark:bg-amber-500/[.06]" : "even:bg-gray-50 dark:even:bg-gray-700/30")}>
                        <th scope="row" className="px-4 py-2.5 text-left font-medium text-gray-900 dark:text-gray-100">
                          <span className="block min-w-[8rem]">{b.name}</span>
                          {st.dirty && <span className="block text-xs font-normal text-amber-700 dark:text-amber-300">ยังไม่บันทึก</span>}
                        </th>
                        {BRANCH_KPI_FIELDS.map((f) => {
                          const { err, ...p } = inputProps(b, f, st, true)
                          return (
                            <td key={f.key} className="px-2 py-2.5 text-right">
                              <input {...p} aria-label={`${f.label} (เต็ม ${f.max}) ${b.name}`} className={cx(p.className, "ml-auto")} />
                              {err && <p id={`${p.id}-err`} className="mt-1 text-xs font-medium text-red-600 dark:text-red-400 whitespace-nowrap">{err}</p>}
                            </td>
                          )
                        })}
                        <td className="px-3 py-2.5 text-right"><Total st={st} /></td>
                        <td className="px-4 py-2.5 text-xs text-gray-700 dark:text-gray-300 whitespace-nowrap">{lastSaved(st.base)}</td>
                        <td className="px-4 py-2 text-right whitespace-nowrap">
                          {!locked && (
                            <div className="inline-flex items-center gap-1">
                              {st.dirty && (
                                <button type="button" className={iconBtnCls} aria-label={`คืนค่าเดิม ${b.name}`} title="คืนค่าเดิม (Esc)" onClick={() => resetRow(b.id)}>
                                  <RotateCcw aria-hidden="true" className="size-4" strokeWidth={1.75} />
                                </button>
                              )}
                              {saveBtn(b, st, false)}
                            </div>
                          )}
                        </td>
                      </tr>
                    )
                  })
                )}
              </tbody>
            </table>
          </div>
          {!locked && !isLoading && (
            <p className="border-t border-gray-100 px-4 py-2 text-xs text-gray-500 dark:border-gray-700 dark:text-gray-400">
              กด Enter ในช่องเพื่อบันทึกแถวนั้น · Esc คืนค่าเดิม · ทศนิยมไม่เกิน 2 ตำแหน่ง
            </p>
          )}
        </div>
      )}
    </div>
  )
}

/** live total "/100" — muted until all six are valid */
function Total({ st }) {
  const complete = st.filled === BRANCH_KPI_FIELDS.length
  return (
    <span className="whitespace-nowrap tabular-nums">
      {complete ? (
        <span className="text-base font-semibold text-gray-900 dark:text-gray-100">{fmtScore(st.total)}</span>
      ) : st.filled > 0 ? (
        <span className="inline-flex items-center gap-1 text-gray-500 dark:text-gray-400" title={`กรอกแล้ว ${st.filled} จาก ${BRANCH_KPI_FIELDS.length} ช่อง`}>
          <AlertTriangle aria-hidden="true" className="size-3.5" strokeWidth={1.75} />
          {fmtScore(st.total)}
        </span>
      ) : (
        <span className="text-gray-500 dark:text-gray-400">—</span>
      )}
      <span className="text-xs text-gray-500 dark:text-gray-400">/{BRANCH_KPI_TOTAL}</span>
    </span>
  )
}
