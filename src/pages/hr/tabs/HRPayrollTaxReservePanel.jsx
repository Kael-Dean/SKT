// src/pages/hr/tabs/HRPayrollTaxReservePanel.jsx
// ─────────────────────────────────────────────────────────────────────────────
// ภาษี / เงินสะสม ของงวดเงินเดือน + กำหนดยอดเฉพาะเดือน (PR 116) — แท็บย่อย ?sub=taxReserve
//   GET /hr/payroll/month-override/{y}/{m}   [{ payroll_id, employee_id, employee_name, base_salary,
//        deduct_reserve, reserve_source, reserve_source_label, income_tax, tax_source, tax_source_label,
//        standing_reserve, standing_tax, override_reserve, override_tax, override_reason, override_by, override_at }]
//   PUT /hr/payroll/month-override/{y}/{m}   { entries: [{ employee_id, reserve_amount?, tax_amount?, reason? }] }
//        field ที่ไม่ส่ง = ไม่เปลี่ยน · ตัวเลข = กำหนด · null = ล้าง (กลับไปใช้ยอดที่ตั้งไว้) · ตัวเลขต้องมี reason
//        ตอบรายการเดียวกับ GET (ยอดสุทธิของคนนั้นปรับแล้ว) · 409 = งวดไม่ใช่ร่างแล้ว · 422 = detail ไทย
//   ปีเป็น ค.ศ. · override_at เป็น UTC ไม่มี offset → fmtServerDateTime
//
//   หัวหน้าฝ่ายบัญชี (payroll.month_override) เปิดงวดร่างที่นี่ได้ แม้ GET /hr/payroll/periods/{y}/{m}
//   จะตอบ 403 ให้เขา (งวดที่ยังไม่ผ่านการตรวจขั้นแรก = ร่าง หรือ รอหัวหน้าฝ่ายอำนวยการตรวจ — แยกกันไม่ได้)
//   → ถือว่า "อาจเป็นร่าง" ให้แก้ได้ แล้วพึ่ง 409 ของ backend (_require_draft) ถ้าไม่ใช่ร่าง → ล็อกเป็นดูอย่างเดียว
//   แผงอื่นของงวดร่างยังซ่อนจากเขาเหมือนเดิม (backend 403 ที่ /hr/payroll, /periods, /external)
// ─────────────────────────────────────────────────────────────────────────────
import { useCallback, useEffect, useId, useMemo, useState } from "react"
import { Info } from "lucide-react"
import { apiAuth } from "../../../lib/api"
import { useCan } from "../../../lib/permissions"
import { useIsPhone } from "../../../hooks/useMediaQuery"
import { amountCents, fmtPayMonth, money, periodLabel, toNum } from "../../../lib/payroll"
import { fmtServerDateTime } from "../../../lib/serverTime"
import {
  cardCls, cx, baseField, editBtnCls, errorTextCls, fieldErrorCls, helpTextCls, labelCls, neutralBtnCls, submitBtnCls,
} from "../../../lib/styles"
import SelectDropdown from "../../../components/SelectDropdown"
import { DataList, EmptyState, ErrorState, Sheet, SkeletonCard, toast } from "../../../components/ui"
import StatusMsg from "../../../components/hr/StatusMsg"
import { NameFilterChips, NameHeaderCell, NameNoMatch, NameSearchField } from "../../../components/hr/nameFilter"
import { useNameFilter } from "../../../components/hr/useNameFilter"

const rowsOf = (d) => (Array.isArray(d) ? d : Array.isArray(d?.items) ? d.items : [])
const nameOf = (r) => r.employee_name || `รหัส ${r.employee_id}`
const isOverride = (src) => src === "override"
const hasOverride = (r) => r.override_reserve != null || r.override_tax != null
const REASON_MAX = 300
const MAX_CENTS = 999999999999
const inputCls = cx(baseField, "!rounded-lg !px-3 !py-2 md:!text-sm tabular-nums")
const sheetBtn = "h-12 md:pointer-fine:h-10"
const thCls = "px-3 py-2.5 text-right text-xs font-semibold text-gray-600 dark:text-gray-400"

/** "11/2569" — รูปแบบในข้อความแจ้งของ handoff */
const shortPeriod = (ym) => `${ym.month}/${ym.year + 543}`

const FIELDS = [
  { key: "reserve", body: "reserve_amount", label: "เงินสะสม", amount: "deduct_reserve", source: "reserve_source", sourceLabel: "reserve_source_label", standing: "standing_reserve", override: "override_reserve" },
  { key: "tax", body: "tax_amount", label: "ภาษีหัก ณ ที่จ่าย", short: "ภาษี", amount: "income_tax", source: "tax_source", sourceLabel: "tax_source_label", standing: "standing_tax", override: "override_tax" },
]

const inputText = (v) => {
  if (v == null || v === "") return ""
  const n = toNum(v)
  return Number.isInteger(n) ? String(n) : n.toFixed(2)
}
const centsOf = (v) => Math.round(toNum(v) * 100)
const dropKey = (obj, key) => { const next = { ...obj }; delete next[key]; return next }

// ─── ยอดในตาราง: ยอดที่ใช้จริง + ที่มา (+ ยอดที่ตั้งไว้ขีดฆ่าเมื่อกำหนดเฉพาะเดือน) ──────────

function AmountCell({ row, f, align = "right" }) {
  const ov = isOverride(row[f.source])
  return (
    <div className={cx("min-w-0", align === "right" ? "text-right" : "text-left")}>
      <span className="block font-medium tabular-nums text-gray-900 dark:text-gray-100">{money(row[f.amount])}</span>
      {ov && row[f.standing] != null && (
        <span className="block text-xs tabular-nums text-gray-500 dark:text-gray-400">
          <span className="sr-only">ยอดที่ตั้งไว้ </span><s>{money(row[f.standing])}</s>
        </span>
      )}
      <span className={cx("block text-xs", ov ? "font-medium text-amber-700 dark:text-amber-300" : "text-gray-500 dark:text-gray-400")}>
        {row[f.sourceLabel] || "—"}
      </span>
    </div>
  )
}

function OverrideNote({ row }) {
  if (!hasOverride(row) || !row.override_reason) return null
  return (
    <p className="mt-1 break-words text-xs text-gray-600 dark:text-gray-400">
      <span className="font-medium text-amber-700 dark:text-amber-300">เฉพาะเดือนนี้:</span> {row.override_reason}
      {row.override_at && <span className="text-gray-500 dark:text-gray-400"> · {fmtServerDateTime(row.override_at)}</span>}
    </p>
  )
}

// ─── Sheet แก้ไขรายคน ─────────────────────────────────────────────────────────

function OverrideSheet({ row, ym, onClose, onSaved, onConflict }) {
  const uid = useId()
  // mount ใหม่ทุกครั้งที่เปิด (key = employee_id) → ค่าเริ่มต้นจากยอดเฉพาะเดือนที่มีอยู่ หรือว่าง
  const [form, setForm] = useState(() => Object.fromEntries(FIELDS.map((f) => [f.key, inputText(row[f.override])])))
  const [reason, setReason] = useState(() => row.override_reason ?? "")
  const [errors, setErrors] = useState({})
  const [msg, setMsg] = useState(null)
  const [busy, setBusy] = useState(null) // "save" | "clear" | null

  const period = shortPeriod(ym)

  const send = async (entry, kind) => {
    setBusy(kind)
    setMsg(null)
    try {
      const res = await apiAuth(`/hr/payroll/month-override/${ym.year}/${ym.month}`, { method: "PUT", body: { entries: [entry] } })
      onSaved(rowsOf(res))
      toast.success(kind === "clear" ? "ล้างยอดเฉพาะเดือนแล้ว" : "บันทึกยอดเฉพาะเดือนแล้ว", {
        description: `${nameOf(row)} · งวด ${period} · ยอดสุทธิปรับตามแล้ว`,
      })
      onClose()
    } catch (err) {
      if (err.status === 409) {
        toast.error("งวดนี้แก้ไขไม่ได้แล้ว", { description: err.message || undefined })
        onConflict()
        onClose()
      } else {
        setMsg({ tone: "error", text: err.message || "บันทึกไม่สำเร็จ" })
      }
    } finally {
      setBusy(null)
    }
  }

  const save = () => {
    const errs = {}
    const entry = { employee_id: row.employee_id }
    const kept = {} // ยอดที่จะยังกำหนดอยู่หลังบันทึก (ใช้เมื่อแก้แค่เหตุผล)
    for (const f of FIELDS) {
      const raw = String(form[f.key] ?? "").trim()
      const had = row[f.override]
      if (raw === "") {
        if (had != null) entry[f.body] = null // ลบช่องที่เคยกำหนด = กลับไปใช้ยอดที่ตั้งไว้
        continue
      }
      const c = amountCents(raw)
      if (!Number.isFinite(c) || c < 0) { errs[f.key] = "ใส่จำนวนเงิน เช่น 1500 หรือ 1500.50"; continue }
      if (c > MAX_CENTS) { errs[f.key] = "จำนวนเงินมากเกินไป"; continue }
      const value = (c / 100).toFixed(2)
      kept[f.body] = value
      if (had == null || centsOf(had) !== c) entry[f.body] = value // ส่งเฉพาะช่องที่เปลี่ยน
    }
    const reasonText = reason.trim()
    const reasonChanged = reasonText !== (row.override_reason ?? "").trim()
    // แก้แค่เหตุผล → ส่งยอดที่ยังกำหนดอยู่ไปพร้อมเหตุผลใหม่ (backend ต้องมียอดอย่างน้อยหนึ่งช่องใน entry)
    if (!FIELDS.some((f) => f.body in entry) && reasonChanged) Object.assign(entry, kept)
    if (FIELDS.some((f) => entry[f.body] != null) && !reasonText) errs.reason = "ระบุเหตุผลที่กำหนดยอดเฉพาะเดือนนี้"
    setErrors(errs)
    if (Object.keys(errs).length) return
    if (!FIELDS.some((f) => f.body in entry)) {
      setMsg({ tone: "warning", text: "ยังไม่มีการเปลี่ยนแปลง" })
      return
    }
    if (FIELDS.some((f) => entry[f.body] != null)) entry.reason = reasonText
    send(entry, "save")
  }

  const clearAll = () => {
    const entry = { employee_id: row.employee_id }
    for (const f of FIELDS) if (row[f.override] != null) entry[f.body] = null
    send(entry, "clear")
  }

  const setField = (key, v) => {
    setForm((p) => ({ ...p, [key]: v }))
    setMsg(null)
    if (errors[key]) setErrors((e) => dropKey(e, key))
  }

  const anyOverride = hasOverride(row)
  const saving = busy != null

  return (
    <Sheet
      open
      onClose={onClose}
      busy={saving}
      size="md"
      title="ภาษี / เงินสะสม เฉพาะเดือน"
      subtitle={`${nameOf(row)} · งวด ${fmtPayMonth(ym.year, ym.month, { long: true })}`}
      footer={
        <div className={cx("grid gap-3 md:flex md:justify-end md:gap-2", anyOverride ? "grid-cols-2" : "grid-cols-1")}>
          {anyOverride && (
            <button type="button" onClick={clearAll} disabled={saving} className={cx(neutralBtnCls, sheetBtn)}>
              {busy === "clear" ? "กำลังล้าง…" : "ล้างค่าเฉพาะเดือน"}
            </button>
          )}
          <button type="button" onClick={save} disabled={saving} className={cx(submitBtnCls, sheetBtn)}>
            {busy === "save" ? "กำลังบันทึก…" : "บันทึก"}
          </button>
        </div>
      }
    >
      <div className="space-y-4">
        <p role="note" className="flex items-start gap-2 rounded-xl bg-amber-50 px-3 py-2.5 text-sm text-amber-900 ring-1 ring-inset ring-amber-200 dark:bg-amber-500/10 dark:text-amber-100 dark:ring-amber-400/25">
          <Info aria-hidden="true" className="mt-0.5 size-4 shrink-0" strokeWidth={1.75} />
          <span>ยอดนี้ใช้เฉพาะงวด {period} · ถ้าต้องการเปลี่ยนถาวร ให้พนักงานยื่นคำขอ</span>
        </p>

        <p className="text-sm text-gray-600 dark:text-gray-400">
          เงินเดือนฐาน <span className="font-medium tabular-nums text-gray-900 dark:text-gray-100">{money(row.base_salary)}</span> บาท
        </p>

        {FIELDS.map((f) => {
          const id = `${uid}-${f.key}`
          const err = errors[f.key]
          return (
            <div key={f.key} className="min-w-0">
              <label htmlFor={id} className={labelCls}>{f.label} เฉพาะเดือนนี้ (บาท)</label>
              <input
                id={id}
                type="text"
                inputMode="decimal"
                autoComplete="off"
                value={form[f.key] ?? ""}
                onChange={(e) => setField(f.key, e.target.value)}
                onFocus={(e) => e.target.select()}
                placeholder={row[f.standing] != null ? money(row[f.standing]) : "—"}
                disabled={saving}
                aria-invalid={err ? true : undefined}
                aria-describedby={`${id}-hint${err ? ` ${id}-err` : ""}`}
                className={cx(inputCls, err && fieldErrorCls)}
              />
              <p id={`${id}-hint`} className={helpTextCls}>
                เว้นว่าง = ใช้ยอดที่ตั้งไว้ <span className="tabular-nums">{money(row[f.standing])}</span> บาท
                {row[f.source] && !isOverride(row[f.source]) && row[f.sourceLabel] ? ` (${row[f.sourceLabel]})` : ""}
              </p>
              {err && <p id={`${id}-err`} className={errorTextCls}>{err}</p>}
            </div>
          )
        })}

        <div className="min-w-0">
          <label htmlFor={`${uid}-reason`} className={labelCls}>เหตุผล</label>
          <textarea
            id={`${uid}-reason`}
            rows={3}
            maxLength={REASON_MAX}
            value={reason}
            onChange={(e) => { setReason(e.target.value); setMsg(null); if (errors.reason) setErrors((e) => dropKey(e, "reason")) }}
            placeholder="เช่น เดือนนี้ขอลดเงินสะสม"
            disabled={saving}
            aria-invalid={errors.reason ? true : undefined}
            aria-describedby={`${uid}-reason-hint${errors.reason ? ` ${uid}-reason-err` : ""}`}
            className={cx(baseField, "!rounded-lg !px-3 !py-2 md:!text-sm", errors.reason && fieldErrorCls)}
          />
          <p id={`${uid}-reason-hint`} className={helpTextCls}>ต้องระบุเมื่อกำหนดยอดอย่างน้อยหนึ่งช่อง</p>
          {errors.reason && <p id={`${uid}-reason-err`} className={errorTextCls}>{errors.reason}</p>}
        </div>

        {msg && <StatusMsg msg={msg} />}
      </div>
    </Sheet>
  )
}

// ─── หนึ่งเดือน ───────────────────────────────────────────────────────────────

function TaxReserveMonth({ ym, onOpenMonth, onChanged }) {
  const { can } = useCan()
  const isPhone = useIsPhone()
  const canEdit = can("hr.payroll.monthOverride.edit")
  const label = fmtPayMonth(ym.year, ym.month, { long: true })

  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState("")
  const [unsupported, setUnsupported] = useState(false)
  const [forbidden, setForbidden] = useState("")
  const [period, setPeriod] = useState(null)
  // loading | ready | hidden (403 แต่ถือสิทธิ์กำหนดยอด — อาจเป็นร่าง) | error
  const [periodState, setPeriodState] = useState("loading")
  const [periodError, setPeriodError] = useState("")
  // 409 จาก PUT ตอนที่ไม่รู้สถานะงวด → งวดนี้ไม่ใช่ร่างแน่นอน
  const [locked, setLocked] = useState(false)
  const [editing, setEditing] = useState(null)

  const load = useCallback(() => {
    setLoading(true)
    setLoadError("")
    apiAuth(`/hr/payroll/month-override/${ym.year}/${ym.month}`)
      .then((d) => setRows(rowsOf(d)))
      .catch((e) => {
        setRows([])
        if (e.status === 404) setUnsupported(true)
        else if (e.status === 403) setForbidden(e.message || "ยังดูงวดนี้ไม่ได้")
        else setLoadError(e.message || "โหลดภาษี / เงินสะสมไม่สำเร็จ")
      })
      .finally(() => setLoading(false))
  }, [ym.year, ym.month])

  const fetchPeriod = useCallback(() => {
    setPeriodState("loading")
    setPeriodError("")
    apiAuth(`/hr/payroll/periods/${ym.year}/${ym.month}`)
      .then((d) => { setPeriod(d && typeof d === "object" ? d : null); setPeriodState("ready") })
      .catch((e) => {
        setPeriod(null)
        if (e.status === 404) setPeriodState("ready") // ยังไม่มีงวด = ร่าง
        else if (e.status === 403) setPeriodState("hidden")
        else { setPeriodError(e.message || "โหลดสถานะงวดไม่สำเร็จ"); setPeriodState("error") }
      })
  }, [ym.year, ym.month])

  useEffect(() => { load(); fetchPeriod() }, [load, fetchPeriod])

  const status = periodState === "ready" ? (period?.status ?? "draft") : null
  const editable = canEdit && !forbidden && (status === "draft" || (periodState === "hidden" && !locked))

  const nf = useNameFilter(rows, { get: (r) => `${nameOf(r)} ${r.employee_id ?? ""}`, label: "พนักงาน" })

  const totals = useMemo(() => ({
    base: rows.reduce((s, r) => s + toNum(r.base_salary), 0),
    reserve: rows.reduce((s, r) => s + toNum(r.deduct_reserve), 0),
    tax: rows.reduce((s, r) => s + toNum(r.income_tax), 0),
  }), [rows])
  const overrideCount = rows.filter(hasOverride).length

  const onSaved = (list) => {
    if (list.length) setRows(list)
    else load()
    onChanged?.()
  }
  const onConflict = () => {
    setLocked(true)
    load()
    fetchPeriod()
    onChanged?.()
  }

  if (unsupported) {
    return <EmptyState title="ยังไม่เปิดใช้" description="ระบบเบื้องหลังยังไม่รองรับภาษี / เงินสะสมรายเดือน ติดต่อผู้ดูแลระบบ" />
  }
  if (forbidden) return <EmptyState title={`ยังดูงวด ${label} ไม่ได้`} description={forbidden} />
  if (loadError) return <ErrorState message={loadError} onRetry={load} />
  if (loading) return <div className="space-y-3"><SkeletonCard /><SkeletonCard /></div>
  if (rows.length === 0) {
    return (
      <EmptyState
        title="ยังไม่มีรายการเงินเดือน"
        description={`งวด ${label} ยังไม่มีรายการเงินเดือน — ภาษี / เงินสะสมจะแสดงเมื่อสร้างเงินเดือนของเดือนนี้แล้ว`}
        action={can("hr.payroll.generate") && onOpenMonth ? <button type="button" onClick={onOpenMonth} className={neutralBtnCls}>ไปงวดประจำเดือน</button> : undefined}
      />
    )
  }

  let notice = null
  if (periodState === "hidden" && canEdit && !locked) {
    notice = "กำหนดยอดเฉพาะเดือนได้เฉพาะงวดที่ยังเป็นร่าง — ถ้างวดนี้ส่งตรวจสอบแล้ว ระบบจะแจ้งตอนบันทึก"
  } else if (!editable && (periodState === "ready" || periodState === "hidden")) {
    if (locked) notice = `งวด ${label} ไม่ใช่ร่างแล้ว — ดูได้อย่างเดียว`
    else if (status && status !== "draft") notice = `งวด ${label} อยู่ในขั้น "${periodLabel(period)}" — ดูได้อย่างเดียว`
    else notice = "ดูได้อย่างเดียว — ฝ่ายบุคคล / หัวหน้าฝ่ายบัญชีเป็นผู้กำหนดยอดเฉพาะเดือน"
  }

  const editBtn = (r) => (
    <button type="button" onClick={() => setEditing(r)} className={editBtnCls} aria-label={`แก้ไขภาษี / เงินสะสมของ ${nameOf(r)}`}>
      แก้ไข
    </button>
  )

  return (
    <div className="space-y-4">
      {periodState === "error" && <ErrorState message={periodError} onRetry={fetchPeriod} />}

      {notice && (
        <p className="flex items-start gap-1.5 text-sm text-gray-600 dark:text-gray-400">
          <Info aria-hidden="true" className="mt-0.5 size-4 shrink-0" strokeWidth={1.75} />
          <span>{notice}</span>
        </p>
      )}

      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        <p className="text-sm text-gray-600 dark:text-gray-400" role="status" aria-live="polite">
          {nf.filtering
            ? <>แสดง <span className="tabular-nums">{nf.rows.length}</span> จาก <span className="tabular-nums">{nf.total}</span> คน</>
            : <><span className="tabular-nums">{rows.length}</span> คน</>}
          {overrideCount > 0 && (
            <> · กำหนดเฉพาะเดือนนี้ <span className="font-semibold tabular-nums text-amber-700 dark:text-amber-300">{overrideCount}</span> คน</>
          )}
        </p>
        {!isPhone && <NameFilterChips nf={nf} />}
      </div>

      {isPhone && <NameSearchField nf={nf} placeholder="ค้นหาชื่อหรือรหัสพนักงาน" />}

      {nf.rows.length === 0 && nf.total > 0 ? (
        <NameNoMatch nf={nf} />
      ) : isPhone ? (
        <DataList
          items={nf.rows}
          keyOf={(r) => r.employee_id}
          title={(r) => <span className="block min-w-0 break-words">{nameOf(r)}</span>}
          subtitle={(r) => (hasOverride(r) && r.override_reason ? <OverrideNote row={r} /> : null)}
          fields={[
            { label: "เงินเดือนฐาน", value: (r) => money(r.base_salary), align: "right", span: 2 },
            ...FIELDS.map((f) => ({ label: f.short ?? f.label, value: (r) => <AmountCell row={r} f={f} />, align: "right" })),
          ]}
          actions={editable ? editBtn : undefined}
        />
      ) : (
        <section aria-label={`ภาษี / เงินสะสม งวด ${label}`} className={cardCls}>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[46rem] table-fixed text-sm">
              <caption className="sr-only">ภาษีและเงินสะสมรายคน งวด {label}</caption>
              <colgroup>
                <col className={editable ? "w-[34%]" : "w-[40%]"} />
                <col className="w-[18%]" />
                <col className="w-[18%]" />
                <col className="w-[18%]" />
                {editable && <col className="w-[12%]" />}
              </colgroup>
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50 dark:border-line dark:bg-white/[.03]">
                  <NameHeaderCell nf={nf} label="พนักงาน" />
                  <th scope="col" className={thCls}>เงินเดือนฐาน</th>
                  <th scope="col" className={thCls}>เงินสะสม</th>
                  <th scope="col" className={thCls}>ภาษี</th>
                  {editable && <th scope="col" className={thCls}><span className="sr-only">แก้ไข</span></th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-line">
                {nf.rows.map((r) => (
                  <tr key={r.employee_id} className={cx(hasOverride(r) && "bg-amber-50/40 dark:bg-amber-500/[.05]")}>
                    <th scope="row" className="px-3 py-2.5 text-left align-top font-normal">
                      <span className="block break-words font-medium text-gray-900 dark:text-gray-100">{nameOf(r)}</span>
                      <OverrideNote row={r} />
                    </th>
                    <td className="px-3 py-2.5 text-right align-top tabular-nums text-gray-700 dark:text-gray-300">{money(r.base_salary)}</td>
                    {FIELDS.map((f) => (
                      <td key={f.key} className="px-3 py-2.5 align-top"><AmountCell row={r} f={f} /></td>
                    ))}
                    {editable && <td className="px-3 py-2.5 text-right align-top">{editBtn(r)}</td>}
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t border-gray-200 bg-gray-50 font-semibold dark:border-line-strong dark:bg-white/[.03]">
                  <th scope="row" className="px-3 py-2.5 text-left text-gray-700 dark:text-gray-300">รวม {rows.length} คน</th>
                  <td className="px-3 py-2.5 text-right tabular-nums text-gray-900 dark:text-gray-100">{money(totals.base)}</td>
                  <td className="px-3 py-2.5 text-right tabular-nums text-gray-900 dark:text-gray-100">{money(totals.reserve)}</td>
                  <td className="px-3 py-2.5 text-right tabular-nums text-gray-900 dark:text-gray-100">{money(totals.tax)}</td>
                  {editable && <td />}
                </tr>
              </tfoot>
            </table>
          </div>
        </section>
      )}

      {isPhone && (
        <section aria-label="รวมทั้งงวด" className={cx(cardCls, "p-4")}>
          <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">รวม <span className="font-normal tabular-nums text-gray-500 dark:text-gray-400">({rows.length} คน)</span></h3>
          <dl className="mt-2 grid grid-cols-2 gap-x-6 gap-y-2 text-sm">
            <div><dt className="text-xs text-gray-500 dark:text-gray-400">เงินสะสม</dt><dd className="tabular-nums text-gray-900 dark:text-gray-100">{money(totals.reserve)}</dd></div>
            <div><dt className="text-xs text-gray-500 dark:text-gray-400">ภาษี</dt><dd className="tabular-nums text-gray-900 dark:text-gray-100">{money(totals.tax)}</dd></div>
          </dl>
        </section>
      )}

      {editable && editing && (
        <OverrideSheet key={editing.employee_id} row={editing} ym={ym} onClose={() => setEditing(null)} onSaved={onSaved} onConflict={onConflict} />
      )}
    </div>
  )
}

/**
 * filterMonth ใช้ร่วมกับแท็บงวดประจำเดือน · onChanged = ยอดสุทธิของงวดเปลี่ยน (ให้ HRPayrollTab นับ/โหลดใหม่)
 */
export default function HRPayrollTaxReservePanel({ filterMonth, ym, monthOptions, onMonthChange, onOpenMonth, onChanged }) {
  return (
    <div className="space-y-4">
      <div className="w-44">
        <SelectDropdown value={filterMonth} onChange={onMonthChange} options={monthOptions} placeholder="เลือกเดือน" />
      </div>
      {/* key: เปลี่ยนเดือน = เริ่ม state ใหม่ (สถานะ locked / sheet ที่เปิดค้าง ไม่ข้ามเดือน) */}
      <TaxReserveMonth key={filterMonth} ym={ym} onOpenMonth={onOpenMonth} onChanged={onChanged} />
    </div>
  )
}
