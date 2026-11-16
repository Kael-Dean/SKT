// src/pages/hr/tabs/HRDisciplineClausesSection.jsx
// ─────────────────────────────────────────────────────────────────────────────
// ตั้งค่าวินัย › ข้อระเบียบ (AMC 2026-11-16) — ข้อระเบียบที่หนังสือ/บันทึกวินัยอ้างถึง
//   GET   /hr/discipline/clauses?include_inactive=true   Clause[] (ปีใหม่สุด → sort_order → code)
//   POST  /hr/discipline/clauses  { code, text, regulation_year=2561, sort_order=0 }   409 = code ซ้ำในปีเดียวกัน
//   PATCH /hr/discipline/clauses/{id}  { code?, text?, regulation_year?, sort_order?, is_active? }  (ไม่มีลบ — ปิดใช้แทน)
//   PUT   /hr/discipline/topics/{id}/clauses  { clause_ids }  ข้อที่ติ๊กไว้ล่วงหน้าของหัวข้อ (TopicClausesSheet)
// แก้ไขได้เมื่อมี hr.discipline.topics
// ─────────────────────────────────────────────────────────────────────────────
import { useEffect, useMemo, useState } from "react"
import { Pencil, Plus } from "lucide-react"
import { apiAuth } from "../../../lib/api"
import { apiDetail } from "../../../lib/apiErrors"
import { asArray, clauseCode } from "../../../lib/discipline"
import { cx, baseField, cardCls, errorTextCls, focusRingCls, neutralBtnCls, primaryBtnCls } from "../../../lib/styles"
import { Badge, EmptyState, ErrorState, Sheet, Skeleton, toast } from "../../../components/ui"
import ClausePicker from "../../../components/hr/discipline/ClausePicker"
import { invalidateClauses } from "../../../components/hr/discipline/disciplineData"

const inputCls = cx(baseField, "!rounded-lg !px-3 !py-2 md:!text-sm")
const smallLabel = "mb-1 block text-xs font-medium text-gray-600 dark:text-gray-400"
const linkBtn = cx(
  "inline-flex min-h-touch items-center gap-1 rounded-lg px-2.5 text-sm font-medium transition-colors duration-150 cursor-pointer md:pointer-fine:min-h-8",
  focusRingCls,
)

function ClauseSheet({ clause, onClose, onSaved }) {
  const isNew = clause?.id == null
  const [f, setF] = useState(() => ({
    code: clause?.code ?? "", text: clause?.text ?? "",
    regulation_year: String(clause?.regulation_year ?? 2561), sort_order: String(clause?.sort_order ?? 0),
  }))
  const [errors, setErrors] = useState({})
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState("")
  const set = (k, digits) => (e) => { setF((s) => ({ ...s, [k]: digits ? e.target.value.replace(/[^\d]/g, "") : e.target.value })); setErrors((x) => ({ ...x, [k]: "" })); setErr("") }

  const save = async (ev) => {
    ev.preventDefault()
    const e = {}
    if (!f.code.trim()) e.code = "ระบุเลขข้อ"
    if (!f.text.trim()) e.text = "ระบุข้อความ"
    if (!/^\d{4}$/.test(f.regulation_year)) e.regulation_year = "ปี พ.ศ. 4 หลัก"
    setErrors(e)
    if (Object.keys(e).length) { document.getElementById(`clause-${Object.keys(e)[0]}`)?.focus(); return }
    const payload = { code: f.code.trim(), text: f.text.trim(), regulation_year: Number(f.regulation_year), sort_order: Number(f.sort_order || 0) }
    const body = isNew ? payload : Object.fromEntries(Object.entries(payload).filter(([k, v]) => v !== clause[k]))
    setBusy(true); setErr("")
    try {
      if (isNew) await apiAuth("/hr/discipline/clauses", { method: "POST", body })
      else if (Object.keys(body).length) await apiAuth(`/hr/discipline/clauses/${clause.id}`, { method: "PATCH", body })
      toast.success(isNew ? "เพิ่มข้อระเบียบแล้ว" : "บันทึกข้อระเบียบแล้ว", { description: payload.code })
      onSaved()
    } catch (ex) {
      if (ex?.status === 409) setErrors({ code: apiDetail(ex) || "มีเลขข้อนี้ในปีเดียวกันอยู่แล้ว" })
      else setErr(apiDetail(ex) || "บันทึกไม่สำเร็จ")
    } finally {
      setBusy(false)
    }
  }

  const fe = (k) => errors[k] && <p id={`clause-${k}-err`} className={errorTextCls}>{errors[k]}</p>
  const aria = (k) => ({ "aria-invalid": errors[k] ? true : undefined, "aria-describedby": errors[k] ? `clause-${k}-err` : undefined })

  return (
    <Sheet open onClose={onClose} busy={busy} size="md" title={isNew ? "เพิ่มข้อระเบียบ" : "แก้ไขข้อระเบียบ"}
      footer={(
        <div className="grid grid-cols-2 gap-3 md:flex md:justify-end md:gap-2">
          <button type="button" onClick={onClose} disabled={busy} className={neutralBtnCls}>ยกเลิก</button>
          <button type="submit" form="disc-clause-form" disabled={busy} className={primaryBtnCls}>{busy ? "กำลังบันทึก…" : "บันทึก"}</button>
        </div>
      )}>
      <form id="disc-clause-form" onSubmit={save} noValidate className="space-y-4">
        <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_7rem_6rem]">
          <div className="min-w-0">
            <label htmlFor="clause-code" className={smallLabel}>เลขข้อ <span className="text-red-600 dark:text-red-400">*</span></label>
            <input id="clause-code" value={f.code} maxLength={50} onChange={set("code")} {...aria("code")} placeholder="ข้อ 53(16)"
              className={cx(inputCls, errors.code && "!border-red-500 dark:!border-red-400")} />
            {fe("code")}
          </div>
          <div className="min-w-0">
            <label htmlFor="clause-regulation_year" className={smallLabel}>ระเบียบปี</label>
            <input id="clause-regulation_year" inputMode="numeric" value={f.regulation_year} maxLength={4} onChange={set("regulation_year", true)} {...aria("regulation_year")}
              className={cx(inputCls, "tabular-nums", errors.regulation_year && "!border-red-500 dark:!border-red-400")} />
            {fe("regulation_year")}
          </div>
          <div className="min-w-0">
            <label htmlFor="clause-sort_order" className={smallLabel}>ลำดับ</label>
            <input id="clause-sort_order" inputMode="numeric" value={f.sort_order} maxLength={4} onChange={set("sort_order", true)} className={cx(inputCls, "text-right tabular-nums")} />
          </div>
        </div>
        <div>
          <label htmlFor="clause-text" className={smallLabel}>ข้อความ <span className="text-red-600 dark:text-red-400">*</span></label>
          <textarea id="clause-text" rows={4} maxLength={2000} value={f.text} onChange={set("text")} {...aria("text")}
            placeholder="ต้องมาปฏิบัติงานให้ตรงตามเวลา และลงบันทึกเวลาทำงานตามที่กำหนด"
            className={cx(inputCls, "resize-y leading-relaxed", errors.text && "!border-red-500 dark:!border-red-400")} />
          {fe("text")}
          <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">ข้อความนี้พิมพ์ลงในหนังสือตักเตือนและบันทึกวินัยตามตัวอักษร</p>
        </div>
        {err && <p role="alert" className={errorTextCls}>{err}</p>}
      </form>
    </Sheet>
  )
}

/** ข้อระเบียบที่ติ๊กไว้ล่วงหน้าของหัวข้อหนึ่ง → PUT /topics/{id}/clauses */
export function TopicClausesSheet({ topic, onClose, onSaved }) {
  const [ids, setIds] = useState(() => asArray(topic?.clause_ids).map(Number))
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState("")
  const save = async () => {
    setBusy(true); setErr("")
    try {
      await apiAuth(`/hr/discipline/topics/${topic.id}/clauses`, { method: "PUT", body: { clause_ids: ids } })
      toast.success("บันทึกข้อระเบียบเริ่มต้นแล้ว", { description: `${topic.name} · ${ids.length ? `${ids.length} ข้อ` : "ไม่มีข้อเริ่มต้น"}` })
      onSaved()
    } catch (e) {
      setErr(apiDetail(e) || "บันทึกไม่สำเร็จ")
    } finally {
      setBusy(false)
    }
  }
  return (
    <Sheet open onClose={onClose} busy={busy} size="md" title="ข้อระเบียบเริ่มต้น" subtitle={topic?.name}
      footer={(
        <div className="grid grid-cols-2 gap-3 md:flex md:justify-end md:gap-2">
          <button type="button" onClick={onClose} disabled={busy} className={neutralBtnCls}>ยกเลิก</button>
          <button type="button" onClick={save} disabled={busy} className={primaryBtnCls}>{busy ? "กำลังบันทึก…" : "บันทึก"}</button>
        </div>
      )}>
      <div className="space-y-3">
        <p className="text-sm leading-relaxed text-gray-600 dark:text-gray-400">ข้อที่เลือกจะถูกติ๊กไว้ล่วงหน้าในหนังสือตักเตือนและบันทึกวินัยของเรื่องหัวข้อนี้ ผู้ออกหนังสือแก้ได้</p>
        <ClausePicker id="topic-clauses" value={ids} onChange={setIds} disabled={busy} />
        {err && <p role="alert" className={errorTextCls}>{err}</p>}
      </div>
    </Sheet>
  )
}

export default function ClausesSection({ canEdit }) {
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [tick, setTick] = useState(0)
  const [showInactive, setShowInactive] = useState(false)
  const [editing, setEditing] = useState(null)
  const [rowBusy, setRowBusy] = useState(null)

  useEffect(() => {
    let alive = true
    setLoading(true); setError("")
    apiAuth("/hr/discipline/clauses?include_inactive=true")
      .then((d) => { if (alive) setRows(asArray(d)) })
      .catch((e) => { if (alive) setError(apiDetail(e) || "โหลดข้อระเบียบไม่สำเร็จ") })
      .finally(() => { if (alive) setLoading(false) })
    return () => { alive = false }
  }, [tick])
  const reload = () => { invalidateClauses(); setTick((t) => t + 1) }

  const inactiveCount = rows.filter((c) => c.is_active === false).length
  const visible = useMemo(() => (showInactive ? rows : rows.filter((c) => c.is_active !== false)), [rows, showInactive])

  // จัดกลุ่มตามปีระเบียบ (server เรียงไว้แล้ว)
  const groups = useMemo(() => {
    const m = new Map()
    for (const c of visible) { const y = c.regulation_year ?? "—"; if (!m.has(y)) m.set(y, []); m.get(y).push(c) }
    return [...m.entries()]
  }, [visible])

  const toggleActive = async (c) => {
    setRowBusy(c.id)
    const on = c.is_active === false
    try {
      await apiAuth(`/hr/discipline/clauses/${c.id}`, { method: "PATCH", body: { is_active: on } })
      toast.success(on ? "เปิดใช้ข้อระเบียบแล้ว" : "ปิดใช้ข้อระเบียบแล้ว", { description: on ? c.code : `${c.code} — หนังสือเดิมที่อ้างข้อนี้ยังแสดงครบ` })
      reload()
    } catch (e) {
      toast.error("บันทึกไม่สำเร็จ", { description: apiDetail(e) })
    } finally {
      setRowBusy(null)
    }
  }

  return (
    <section aria-labelledby="disc-clauses-h" aria-busy={loading || undefined} className={cx(cardCls, "p-5")}>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div className="min-w-0">
          <h2 id="disc-clauses-h" className="text-base font-semibold text-gray-900 dark:text-gray-100">
            ข้อระเบียบ
            {!loading && !error && <span className="ml-2 text-sm font-normal tabular-nums text-gray-500 dark:text-gray-400">{rows.length - inactiveCount} ข้อที่ใช้อยู่</span>}
          </h2>
          <p className="text-xs text-gray-500 dark:text-gray-400">ข้อที่หนังสือตักเตือนและบันทึกวินัยอ้างถึง · ตั้งข้อเริ่มต้นของแต่ละหัวข้อได้ที่ปุ่ม “ข้อระเบียบเริ่มต้น”</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {inactiveCount > 0 && (
            <button type="button" aria-pressed={showInactive} onClick={() => setShowInactive((v) => !v)}
              className={cx(linkBtn, "text-gray-700 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-white/[.06]")}>
              {showInactive ? "ซ่อนที่ปิดใช้" : `แสดงที่ปิดใช้ (${inactiveCount})`}
            </button>
          )}
          {canEdit && (
            <button type="button" onClick={() => setEditing({})} className={cx(primaryBtnCls, "md:pointer-fine:!h-9 !px-3 !text-sm")}>
              <Plus aria-hidden="true" className="size-4" /> เพิ่มข้อระเบียบ
            </button>
          )}
        </div>
      </div>

      {error ? (
        <ErrorState message={error} onRetry={reload} />
      ) : loading ? (
        <div className="space-y-2"><span className="sr-only">กำลังโหลด…</span>{[0, 1, 2].map((i) => <Skeleton key={i} className="h-12" rounded="rounded-lg" />)}</div>
      ) : visible.length === 0 ? (
        <EmptyState
          title="ยังไม่มีข้อระเบียบ"
          description="เพิ่มข้อจากระเบียบฯ 2561 (ข้อ 53) เพื่อให้หนังสือตักเตือนอ้างข้อที่ฝ่าฝืนได้"
          action={canEdit ? <button type="button" onClick={() => setEditing({})} className={primaryBtnCls}>เพิ่มข้อระเบียบ</button> : null}
          className="!py-10"
        />
      ) : (
        <div className="space-y-4">
          {groups.map(([year, list]) => (
            <div key={year}>
              <p className="mb-1 text-xs font-semibold text-gray-500 dark:text-gray-400">ระเบียบฯ พ.ศ. {year}</p>
              <ul className="divide-y divide-gray-100 dark:divide-line">
                {list.map((c) => {
                  const inactive = c.is_active === false
                  return (
                    <li key={c.id} className={cx("grid gap-x-4 gap-y-1 py-2.5 sm:grid-cols-[8rem_minmax(0,1fr)_auto] sm:items-start", inactive && "opacity-70")}>
                      <p className="flex items-center gap-2 text-sm font-semibold tabular-nums text-gray-900 dark:text-gray-100">
                        {clauseCode({ ...c, regulation_year: 2561 })}
                        {inactive && <Badge tone="neutral">ปิดใช้</Badge>}
                      </p>
                      <p className="min-w-0 break-words text-sm leading-relaxed text-gray-700 dark:text-gray-300">{c.text}</p>
                      {canEdit && (
                        <div className="flex shrink-0 items-center gap-1">
                          {!inactive && (
                            <button type="button" onClick={() => setEditing(c)} aria-label={`แก้ไข ${c.code}`}
                              className={cx(linkBtn, "text-indigo-700 hover:bg-indigo-50 dark:text-indigo-300 dark:hover:bg-indigo-500/10")}>
                              <Pencil aria-hidden="true" className="size-3.5" /> แก้ไข
                            </button>
                          )}
                          <button type="button" onClick={() => toggleActive(c)} disabled={rowBusy === c.id}
                            aria-label={`${inactive ? "เปิดใช้" : "ปิดใช้"} ${c.code}`}
                            className={cx(linkBtn, "disabled:opacity-60", inactive
                              ? "text-emerald-700 hover:bg-emerald-50 dark:text-emerald-300 dark:hover:bg-emerald-500/10"
                              : "text-red-700 hover:bg-red-50 dark:text-red-300 dark:hover:bg-red-500/10")}>
                            {rowBusy === c.id ? "กำลังบันทึก…" : inactive ? "เปิดใช้" : "ปิดใช้"}
                          </button>
                        </div>
                      )}
                    </li>
                  )
                })}
              </ul>
            </div>
          ))}
        </div>
      )}

      {editing && (
        <ClauseSheet key={editing.id ?? "new"} clause={editing.id != null ? editing : null}
          onClose={() => setEditing(null)} onSaved={() => { setEditing(null); reload() }} />
      )}
    </section>
  )
}
