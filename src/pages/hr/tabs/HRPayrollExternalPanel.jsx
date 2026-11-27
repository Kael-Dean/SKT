// src/pages/hr/tabs/HRPayrollExternalPanel.jsx
// ─────────────────────────────────────────────────────────────────────────────
// บันทึกรายการหักภายนอกรายเดือนจากเอกสาร (กยศ. · สหกรณ์ออมทรัพย์ · ชมรมเจ้าหน้าที่ · อื่นๆ) — แท็บย่อย ?sub=external
//   GET /hr/payroll/external/{y}/{m}   [{ employee_id, employee_name, branch_name, keyed, slf, coop, club_loan, other, other_note, total }]
//   PUT /hr/payroll/external/{y}/{m}   { entries: [{ employee_id, slf, coop, club_loan, other, other_note }] } → ตอบรายการเดียวกับ GET
//     entry แทนที่ยอดทั้งสี่ของคนนั้น · 0 คือค่าที่บันทึกได้ · ทำได้เฉพาะงวดร่าง (อื่น ๆ 409) · ยอดสุทธิของคนนั้นเปลี่ยนทันที
//     คำนวณใหม่ทั้งงวดไม่ล้างยอดที่บันทึกแล้ว · ทุกคนต้อง keyed ก่อนส่งตรวจสอบ (external_missing บนการ์ดงวดโหลดใหม่เมื่อกลับไปแท็บงวด)
//   403 (ผช.ผจก./หัวหน้าฝ่ายบัญชี ก่อนการตรวจขั้นแรก) → แจ้งข้อความ backend แบบไม่ใช่ error · 404 = backend ยังไม่ deploy
//
//   ตัวเลขที่พิมพ์ค้าง: สลับเดือน/แท็บย่อยถาม ConfirmDialog (guardRef → HRPayrollTab). ปิดแท็บเบราว์เซอร์ → beforeunload.
//   ออกจากหน้าทางอื่น (เมนู, ปุ่มย้อนกลับ) ดักไม่ได้เพราะแอปใช้ BrowserRouter ไม่ใช่ data router
//   → เก็บร่างไว้ในหน่วยความจำ (ไม่ลง storage) แล้วกู้คืนพร้อมแจ้งเมื่อกลับมา
// ─────────────────────────────────────────────────────────────────────────────
import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react"
import { Info } from "lucide-react"
import { apiAuth } from "../../../lib/api"
import { getUser } from "../../../lib/auth"
import { useCan } from "../../../lib/permissions"
import { useIsPhone } from "../../../hooks/useMediaQuery"
import {
  EXTERNAL_AMOUNT_COLUMNS, amountCents, externalEntry, externalErrors, externalFormFrom, externalIsBlank, externalIsDirty,
  externalTotals, fmtPayMonth, money, moneyFromCents, periodLabel,
} from "../../../lib/payroll"
import { cardCls, cellInput, cx, baseField, fieldDisabled, labelCls, neutralBtnCls } from "../../../lib/styles"
import SelectDropdown from "../../../components/SelectDropdown"
import { Badge, ConfirmDialog, EmptyState, ErrorState, SkeletonCard, StickyActionBar, revealFirstInvalid, toast } from "../../../components/ui"
import StatusMsg from "../../../components/hr/StatusMsg"
import { NameHeaderCell } from "../../../components/hr/nameFilter"
import { useNameFilter } from "../../../components/hr/useNameFilter"

const rowsOf = (d) => (Array.isArray(d) ? d : Array.isArray(d?.items) ? d.items : [])
const nameOf = (r) => r.employee_name || `รหัส ${r.employee_id}`
const NOTE_MAX = 200

const denseAmountCls = cx(cellInput, "!py-1.5")
const denseNoteCls = cx(cellInput, "!py-1.5 !text-left")
const fieldCls = cx(baseField, "!rounded-lg !px-3 !py-2 md:!text-sm min-h-11 md:pointer-fine:min-h-0")
const errorCls = "mt-1 block text-xs font-medium text-red-600 dark:text-red-400"
const invalidCls = "!border-red-500 dark:!border-red-400"

/** ร่างที่ยังไม่บันทึกของแต่ละผู้ใช้+เดือน — อยู่ในหน่วยความจำเท่านั้น หายเมื่อรีเฟรช (ซึ่งมี beforeunload เตือนแล้ว) */
const drafts = new Map()

// ─── ช่องกรอก ────────────────────────────────────────────────────────────────

function CellInput({ row, col, index, label, value, err, className, disabled, readOnly, numeric, onCell, onNav, register, placeholder }) {
  const id = `ext-${row.employee_id}-${col}`
  return (
    <>
      <input
        ref={(el) => register(`${index}:${col}`, el)}
        id={id}
        type="text"
        inputMode={numeric ? "decimal" : "text"}
        enterKeyHint="next"
        autoComplete="off"
        maxLength={numeric ? undefined : NOTE_MAX}
        value={value ?? ""}
        disabled={disabled}
        readOnly={readOnly}
        placeholder={placeholder}
        onChange={(e) => onCell(row.employee_id, col, e.target.value)}
        onKeyDown={(e) => onNav(e, index, col)}
        onFocus={numeric ? (e) => e.target.select() : undefined}
        aria-label={label ? `${label} ของ ${nameOf(row)}` : undefined}
        aria-invalid={err ? true : undefined}
        aria-describedby={err ? `${id}-err` : undefined}
        className={cx(className, numeric && "tabular-nums", disabled && fieldDisabled, err && invalidCls)}
      />
      {err && <span id={`${id}-err`} className={errorCls}>{err}</span>}
    </>
  )
}

const KeyedBadge = ({ keyed }) => <Badge tone={keyed ? "success" : "pending"}>{keyed ? "บันทึกแล้ว" : "ยังไม่บันทึก"}</Badge>

const rowTotalText = (row, value, isBlank) => (isBlank && !row.keyed ? "—" : moneyFromCents(externalTotals([value]).total))

// ─── Desktop: หนึ่งแถว ────────────────────────────────────────────────────────

const DesktopRow = memo(function DesktopRow({ row, value, errs, index, editable, readOnly, dirty, onCell, onNav, register }) {
  const shared = { row, index, readOnly, onCell, onNav, register }
  const blank = externalIsBlank(value)
  return (
    <tr className={cx(dirty && "bg-indigo-50/50 dark:bg-indigo-500/[.06]")}>
      <th scope="row" className="px-3 py-2 text-left align-top font-normal">
        <span className="block font-medium text-gray-900 dark:text-gray-100">{nameOf(row)}</span>
        <span className="mt-1 block"><KeyedBadge keyed={row.keyed} /></span>
      </th>
      {EXTERNAL_AMOUNT_COLUMNS.map((c) => (
        <td key={c.key} className="px-2 py-2 text-right align-top">
          {editable ? (
            <CellInput {...shared} col={c.key} numeric label={c.label} value={value[c.key]} err={errs?.[c.key]} className={denseAmountCls} placeholder="—" />
          ) : (
            <span className="inline-block py-1.5 tabular-nums text-gray-700 dark:text-gray-300">{row.keyed ? money(row[c.key]) : "—"}</span>
          )}
        </td>
      ))}
      <td className="px-2 py-2 align-top">
        {editable ? (
          <CellInput
            {...shared}
            col="other_note"
            label="รายละเอียดอื่นๆ"
            value={value.other_note}
            err={errs?.other_note}
            className={denseNoteCls}
            disabled={!(amountCents(value.other) > 0)}
            placeholder={amountCents(value.other) > 0 ? "ระบุรายละเอียด" : "—"}
          />
        ) : (
          <span className="inline-block py-1.5 break-words text-gray-700 dark:text-gray-300">{row.other_note || "—"}</span>
        )}
      </td>
      <td className="px-3 py-2 text-right align-top">
        <span className="inline-block py-1.5 font-semibold tabular-nums text-gray-900 dark:text-gray-100">{rowTotalText(row, value, blank)}</span>
      </td>
    </tr>
  )
})

// ─── Phone: หนึ่งการ์ด ────────────────────────────────────────────────────────

const PhoneCard = memo(function PhoneCard({ row, value, errs, index, editable, readOnly, dirty, onCell, onNav, register }) {
  const shared = { row, index, readOnly, onCell, onNav, register }
  const noteOn = amountCents(value.other) > 0
  return (
    <li className={cx(cardCls, "p-4", dirty && "!bg-indigo-50/60 dark:!bg-indigo-500/[.08]")}>
      <div className="flex items-start justify-between gap-3">
        <p className="min-w-0 break-words font-medium text-gray-900 dark:text-gray-100">{nameOf(row)}</p>
        <span className="shrink-0"><KeyedBadge keyed={row.keyed} /></span>
      </div>
      {editable ? (
        <div className="mt-3 grid grid-cols-2 gap-x-3 gap-y-3">
          {EXTERNAL_AMOUNT_COLUMNS.map((c) => (
            <div key={c.key} className="flex flex-col justify-end">
              <label htmlFor={`ext-${row.employee_id}-${c.key}`} className={cx(labelCls, "!mb-1 !text-xs")}>{c.label}</label>
              <CellInput {...shared} col={c.key} numeric value={value[c.key]} err={errs?.[c.key]} className={cx(fieldCls, "text-right")} placeholder="—" />
            </div>
          ))}
          <div className="col-span-2">
            <label htmlFor={`ext-${row.employee_id}-other_note`} className={cx(labelCls, "!mb-1 !text-xs")}>รายละเอียดอื่นๆ</label>
            <CellInput
              {...shared}
              col="other_note"
              value={value.other_note}
              err={errs?.other_note}
              className={fieldCls}
              disabled={!noteOn}
              placeholder={noteOn ? "ระบุรายละเอียด" : "ใส่ยอด อื่นๆ ก่อน"}
            />
          </div>
        </div>
      ) : (
        <dl className="mt-2 divide-y divide-gray-100 text-sm dark:divide-line">
          {EXTERNAL_AMOUNT_COLUMNS.map((c) => (
            <div key={c.key} className="flex items-baseline justify-between gap-4 py-1.5">
              <dt className="min-w-0 text-gray-600 dark:text-gray-400">{c.key === "other" && row.other_note ? `${c.label} (${row.other_note})` : c.label}</dt>
              <dd className="shrink-0 tabular-nums text-gray-900 dark:text-gray-100">{row.keyed ? money(row[c.key]) : "—"}</dd>
            </div>
          ))}
        </dl>
      )}
      <p className="mt-3 flex items-baseline justify-between gap-4 border-t border-gray-100 pt-2 text-sm dark:border-line">
        <span className="text-gray-600 dark:text-gray-400">รวม</span>
        <span className="font-semibold tabular-nums text-gray-900 dark:text-gray-100">{rowTotalText(row, value, externalIsBlank(value))}</span>
      </p>
    </li>
  )
})

// ─── หนึ่งเดือน ───────────────────────────────────────────────────────────────

function ExternalMonth({ ym, guardRef, onOpenMonth }) {
  const { can } = useCan()
  const isPhone = useIsPhone()
  const canKey = can("hr.payroll.generate")
  const label = fmtPayMonth(ym.year, ym.month, { long: true })
  const draftKey = `${getUser()?.id ?? ""}:${ym.year}-${ym.month}`

  const [rows, setRows] = useState([])
  const [form, setForm] = useState({})
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState("")
  const [unsupported, setUnsupported] = useState(false)
  const [forbidden, setForbidden] = useState("")
  const [period, setPeriod] = useState(null)
  const [periodState, setPeriodState] = useState("loading") // loading | ready | error
  const [periodError, setPeriodError] = useState("")
  const [errors, setErrors] = useState({})
  const [msg, setMsg] = useState(null)
  const [saving, setSaving] = useState(false)
  const [restored, setRestored] = useState(0)
  const [query, setQuery] = useState("")
  const [onlyMissing, setOnlyMissing] = useState(false)
  const [confirmReset, setConfirmReset] = useState(false)
  const rootRef = useRef(null)
  const cells = useRef(new Map())

  const applyRows = useCallback((list, draft) => {
    const next = {}
    let count = 0
    for (const r of list) {
      const typed = draft?.[r.employee_id]
      if (typed && externalIsDirty(r, typed)) { next[r.employee_id] = typed; count += 1 }
      else next[r.employee_id] = externalFormFrom(r)
    }
    setRows(list)
    setForm(next)
    setErrors({})
    setRestored(count)
  }, [])

  const load = useCallback(() => {
    setLoading(true)
    setLoadError("")
    apiAuth(`/hr/payroll/external/${ym.year}/${ym.month}`)
      .then((d) => applyRows(rowsOf(d), drafts.get(draftKey)))
      .catch((e) => {
        if (e.status === 404) setUnsupported(true)
        else if (e.status === 403) setForbidden(e.message || "ยังดูงวดนี้ไม่ได้")
        else setLoadError(e.message || "โหลดรายการหักภายนอกไม่สำเร็จ")
      })
      .finally(() => setLoading(false))
  }, [ym.year, ym.month, draftKey, applyRows])

  const fetchPeriod = useCallback(() => {
    setPeriodState("loading")
    apiAuth(`/hr/payroll/periods/${ym.year}/${ym.month}`)
      .then((d) => { setPeriod(d && typeof d === "object" ? d : null); setPeriodState("ready") })
      .catch((e) => {
        setPeriod(null)
        if (e.status === 404) setPeriodState("ready") // ยังไม่มีงวด = ร่าง
        else if (e.status === 403) { setForbidden(e.message || "ยังดูงวดนี้ไม่ได้"); setPeriodState("ready") }
        else { setPeriodError(e.message || "โหลดสถานะงวดไม่สำเร็จ"); setPeriodState("error") }
      })
  }, [ym.year, ym.month])

  useEffect(() => { load(); fetchPeriod() }, [load, fetchPeriod])

  const status = periodState === "ready" ? (period?.status ?? "draft") : null
  const editable = canKey && status === "draft" && !forbidden

  const dirtyRows = useMemo(
    () => (editable ? rows.filter((r) => externalIsDirty(r, form[r.employee_id])) : []),
    [editable, rows, form],
  )
  const dirtyCount = dirtyRows.length
  const dirtyIds = useMemo(() => new Set(dirtyRows.map((r) => r.employee_id)), [dirtyRows])

  // เก็บร่างทุกครั้งที่พิมพ์ — โหลดไม่สำเร็จ/ยังไม่รู้สถานะงวด ห้ามแตะร่างที่มีอยู่
  useEffect(() => {
    if (loading || loadError || unsupported || forbidden || periodState !== "ready") return
    if (dirtyCount === 0) { drafts.delete(draftKey); return }
    drafts.set(draftKey, Object.fromEntries(dirtyRows.map((r) => [r.employee_id, form[r.employee_id]])))
  }, [loading, loadError, unsupported, forbidden, periodState, dirtyRows, dirtyCount, draftKey, form])

  const discard = useCallback(() => {
    drafts.delete(draftKey)
    setForm(Object.fromEntries(rows.map((r) => [r.employee_id, externalFormFrom(r)])))
    setErrors({})
    setRestored(0)
    setMsg(null)
  }, [draftKey, rows])

  // ให้ HRPayrollTab ถามก่อนสลับเดือน/แท็บย่อย
  useEffect(() => {
    if (!guardRef) return undefined
    guardRef.current = { dirty: dirtyCount, discard }
    return () => { guardRef.current = null }
  }, [guardRef, dirtyCount, discard])

  useEffect(() => {
    if (dirtyCount === 0) return undefined
    const warn = (e) => { e.preventDefault(); e.returnValue = "" }
    window.addEventListener("beforeunload", warn)
    return () => window.removeEventListener("beforeunload", warn)
  }, [dirtyCount])

  const onCell = useCallback((id, key, value) => {
    setForm((p) => ({ ...p, [id]: { ...p[id], [key]: value } }))
    setMsg(null)
    setErrors((e) => {
      const had = e[id]
      if (!had || !(had[key] || (key === "other" && had.other_note))) return e
      const { [key]: _drop, ...rest } = had
      if (key === "other") delete rest.other_note
      const next = { ...e }
      if (Object.keys(rest).length) next[id] = rest
      else delete next[id]
      return next
    })
  }, [])

  const register = useCallback((key, el) => {
    if (el) cells.current.set(key, el)
    else cells.current.delete(key)
  }, [])

  // Enter / ลูกศรขึ้น-ลง = ไปช่องเดียวกันของคนถัดไป (ข้ามช่องรายละเอียดที่ปิดอยู่) — กรอกจากเอกสารได้โดยไม่ใช้เมาส์
  const onNav = useCallback((e, index, col) => {
    if (e.nativeEvent.isComposing) return
    const step = e.key === "Enter" || e.key === "ArrowDown" ? 1 : e.key === "ArrowUp" ? -1 : 0
    if (!step) return
    e.preventDefault()
    for (let i = index + step; ; i += step) {
      const el = cells.current.get(`${i}:${col}`)
      if (!el) return
      if (!el.disabled) { el.focus(); el.select(); return }
    }
  }, [])

  // ─── จัดกลุ่ม ───
  const displayForm = useCallback((r) => (editable ? form[r.employee_id] : externalFormFrom(r)), [editable, form])

  const q = query.trim().toLowerCase()
  const isVisible = useCallback(
    (r) => (!onlyMissing || !r.keyed) && (!q || nameOf(r).toLowerCase().includes(q) || String(r.employee_id).includes(q)),
    [onlyMissing, q],
  )

  // ตัวกรอง/เรียงชื่อจากหัวคอลัมน์ "เจ้าหน้าที่" (ใช้ร่วมกันทุกตารางสาขา) — กรอง/เรียงภายในแต่ละสาขา
  const nameNf = useNameFilter(rows, { get: (r) => `${nameOf(r)} ${r.employee_id ?? ""}`, label: "เจ้าหน้าที่" })
  const nameIds = useMemo(() => new Set(nameNf.rows.map((r) => r.employee_id)), [nameNf.rows])

  // รวมยอดทุกคนในสาขาเสมอ — ตัวกรองซ่อนแถว แต่ไม่เปลี่ยนยอดรวม
  const groups = useMemo(() => {
    const byBranch = new Map()
    for (const r of rows) {
      const name = r.branch_name || "ไม่ระบุสาขา"
      if (!byBranch.has(name)) byBranch.set(name, [])
      byBranch.get(name).push(r)
    }
    const shown = new Map()
    for (const r of nameNf.rows) {
      if (!isVisible(r)) continue
      const name = r.branch_name || "ไม่ระบุสาขา"
      if (!shown.has(name)) shown.set(name, [])
      shown.get(name).push(r)
    }
    let index = 0
    return [...byBranch].map(([name, all]) => {
      const visible = (shown.get(name) ?? []).map((row) => ({ row, index: index++ }))
      return { name, all, visible, totals: externalTotals(all.map(displayForm)) }
    })
  }, [rows, nameNf.rows, isVisible, displayForm])

  const grand = useMemo(() => externalTotals(rows.map(displayForm)), [rows, displayForm])
  const keyedCount = rows.filter((r) => r.keyed).length
  const hiddenDirty = dirtyRows.filter((r) => !isVisible(r) || !nameIds.has(r.employee_id)).length
  const visibleCount = groups.reduce((n, g) => n + g.visible.length, 0)

  const blankRows = useCallback((list) => (editable ? list.filter((r) => !r.keyed && externalIsBlank(form[r.employee_id])) : []), [editable, form])
  const blankTotal = blankRows(rows).length

  const fillZero = (list) => {
    setForm((p) => {
      const next = { ...p }
      for (const r of list) next[r.employee_id] = { slf: "0", coop: "0", club_loan: "0", other: "0", other_note: "" }
      return next
    })
    setMsg(null)
  }

  const save = async () => {
    const errs = {}
    const entries = []
    for (const r of dirtyRows) {
      const f = form[r.employee_id]
      const e = externalErrors(f)
      if (Object.keys(e).length) errs[r.employee_id] = e
      else entries.push(externalEntry(r, f))
    }
    setErrors(errs)
    const badCount = Object.keys(errs).length
    if (badCount) {
      setQuery("")
      setOnlyMissing(false)
      nameNf.setFilter(null)
      setMsg({ tone: "warning", text: `ตรวจช่องที่มีข้อความสีแดงก่อนบันทึก (${badCount} คน)` })
      revealFirstInvalid(rootRef)
      return
    }
    if (entries.length === 0) return
    setSaving(true)
    setMsg(null)
    try {
      const res = await apiAuth(`/hr/payroll/external/${ym.year}/${ym.month}`, { method: "PUT", body: { entries } })
      drafts.delete(draftKey)
      const list = rowsOf(res)
      if (list.length) applyRows(list)
      else load()
      fetchPeriod()
      toast.success(`บันทึกรายการหักภายนอก ${entries.length} คนแล้ว`, { description: `งวด ${label} · ยอดสุทธิของคนที่แก้ปรับตามแล้ว` })
    } catch (err) {
      setMsg({ tone: "error", text: err.message || "บันทึกไม่สำเร็จ" })
    } finally {
      setSaving(false)
    }
  }

  // ─── สถานะที่ไม่มีตาราง ───
  if (unsupported) {
    return <EmptyState title="ยังไม่เปิดใช้" description="ระบบเบื้องหลังยังไม่รองรับการบันทึกรายการหักภายนอก ติดต่อผู้ดูแลระบบ" />
  }
  if (forbidden) return <EmptyState title="ยังดูงวดนี้ไม่ได้" description={forbidden} />
  if (loadError) return <ErrorState message={loadError} onRetry={load} />
  if (loading) return <div className="space-y-3"><SkeletonCard /><SkeletonCard /></div>
  if (rows.length === 0) {
    return (
      <EmptyState
        title="สร้างเงินเดือนก่อน"
        description={`งวด ${label} ยังไม่มีรายการเงินเดือน — รายการหักภายนอกบันทึกได้เมื่อสร้างเงินเดือนของเดือนนี้แล้ว`}
        action={canKey && onOpenMonth ? <button type="button" onClick={onOpenMonth} className={neutralBtnCls}>ไปงวดประจำเดือน</button> : undefined}
      />
    )
  }

  const notice = periodState === "ready" && !editable
    ? (status === "draft"
      ? "ดูได้อย่างเดียว — ฝ่ายบุคคลเป็นผู้บันทึกรายการหักภายนอก"
      : `งวด ${label} อยู่ในขั้น "${periodLabel(period)}" — ดูได้อย่างเดียว`)
    : null

  const rowProps = { editable, readOnly: saving, onCell, onNav, register }

  return (
    <div ref={rootRef} className="space-y-4">
      {periodState === "error" && <ErrorState message={periodError} onRetry={fetchPeriod} />}

      {notice && (
        <p className="flex items-start gap-1.5 text-sm text-gray-600 dark:text-gray-400">
          <Info aria-hidden="true" className="mt-0.5 size-4 shrink-0" strokeWidth={1.75} />
          <span>{notice}</span>
        </p>
      )}

      {restored > 0 && editable && (
        <StatusMsg msg={{ tone: "warning", text: `กู้คืนยอดที่พิมพ์ค้างไว้ ${restored} คน — ยังไม่ได้บันทึก` }} />
      )}

      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        <p className="text-sm text-gray-600 dark:text-gray-400" aria-live="polite">
          บันทึกแล้ว <span className="font-semibold tabular-nums text-gray-900 dark:text-gray-100">{keyedCount}</span> จาก{" "}
          <span className="tabular-nums">{rows.length}</span> คน
        </p>
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          aria-label="ค้นหาชื่อหรือรหัสเจ้าหน้าที่"
          placeholder="ค้นหาชื่อหรือรหัส"
          className={cx(fieldCls, "!w-full sm:!w-56")}
        />
        <button
          type="button"
          aria-pressed={onlyMissing}
          onClick={() => setOnlyMissing((v) => !v)}
          className={cx(neutralBtnCls, onlyMissing && "!border-indigo-400 !text-indigo-700 dark:!border-indigo-400 dark:!text-indigo-200")}
        >
          เฉพาะยังไม่บันทึก
        </button>
        {blankTotal > 0 && (
          <button type="button" onClick={() => fillZero(blankRows(rows))} className={cx(neutralBtnCls, "sm:ml-auto")}>
            ใส่ 0 ให้ {blankTotal} คนที่ยังว่าง
          </button>
        )}
      </div>

      {visibleCount === 0 && (
        <EmptyState
          title="ไม่พบรายชื่อตามตัวกรอง"
          description="ยอดที่พิมพ์ค้างไว้ยังอยู่ — ล้างตัวกรองเพื่อดูรายชื่อทั้งหมด"
          action={<button type="button" onClick={() => { setQuery(""); setOnlyMissing(false); nameNf.setFilter(null) }} className={neutralBtnCls}>ล้างตัวกรอง</button>}
        />
      )}

      {groups.filter((g) => g.visible.length > 0).map((g) => {
        const blanks = blankRows(g.all)
        const heading = (
          <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 px-4 py-2.5">
            <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">
              {g.name} <span className="font-normal tabular-nums text-gray-500 dark:text-gray-400">({g.all.length})</span>
            </h3>
            {blanks.length > 0 && groups.length > 1 && (
              <button type="button" onClick={() => fillZero(blanks)} className="min-h-touch rounded text-sm font-medium text-indigo-700 hover:underline cursor-pointer md:pointer-fine:min-h-0 dark:text-indigo-300">
                ใส่ 0 ให้ {blanks.length} คนที่ยังว่างในสาขานี้
              </button>
            )}
          </div>
        )

        if (isPhone) {
          return (
            <section key={g.name} aria-label={g.name} className="space-y-2">
              {heading}
              <ul className="space-y-3">
                {g.visible.map(({ row, index }) => (
                  <PhoneCard key={row.employee_id} row={row} index={index} value={displayForm(row)} errs={errors[row.employee_id]} dirty={dirtyIds.has(row.employee_id)} {...rowProps} />
                ))}
              </ul>
              <p className="flex items-baseline justify-between gap-4 px-4 text-sm">
                <span className="text-gray-600 dark:text-gray-400">รวม {g.name}</span>
                <span className="font-semibold tabular-nums text-gray-900 dark:text-gray-100">{moneyFromCents(g.totals.total)}</span>
              </p>
            </section>
          )
        }

        return (
          <section key={g.name} aria-label={g.name} className={cardCls}>
            <div className="sticky top-(--topbar-h) z-10 rounded-t-2xl border-b border-gray-100 bg-white dark:border-line dark:bg-surface">
              {heading}
            </div>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[54rem] table-fixed text-sm">
                <caption className="sr-only">รายการหักภายนอก {g.name} งวด {label}</caption>
                <colgroup>
                  <col className="w-[24%]" />
                  <col className="w-[11%]" /><col className="w-[12%]" /><col className="w-[12%]" /><col className="w-[11%]" />
                  <col className="w-[18%]" />
                  <col className="w-[12%]" />
                </colgroup>
                <thead>
                  <tr className="border-b border-gray-100 bg-gray-50 dark:border-line dark:bg-white/[.03]">
                    <NameHeaderCell nf={nameNf} label="เจ้าหน้าที่" />
                    {EXTERNAL_AMOUNT_COLUMNS.map((c) => (
                      <th key={c.key} scope="col" className="px-2 py-2.5 text-right text-xs font-semibold text-gray-600 dark:text-gray-400">{c.short}</th>
                    ))}
                    <th scope="col" className="px-2 py-2.5 text-left text-xs font-semibold text-gray-600 dark:text-gray-400">รายละเอียด</th>
                    <th scope="col" className="px-3 py-2.5 text-right text-xs font-semibold text-gray-600 dark:text-gray-400">รวม</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-line">
                  {g.visible.map(({ row, index }) => (
                    <DesktopRow key={row.employee_id} row={row} index={index} value={displayForm(row)} errs={errors[row.employee_id]} dirty={dirtyIds.has(row.employee_id)} {...rowProps} />
                  ))}
                </tbody>
                <tfoot>
                  <tr className="border-t border-gray-200 bg-gray-50 font-semibold dark:border-line-strong dark:bg-white/[.03]">
                    <th scope="row" className="px-3 py-2.5 text-left text-gray-700 dark:text-gray-300">รวม {g.all.length} คน</th>
                    {EXTERNAL_AMOUNT_COLUMNS.map((c) => (
                      <td key={c.key} className="px-2 py-2.5 text-right tabular-nums text-gray-900 dark:text-gray-100">{moneyFromCents(g.totals[c.key])}</td>
                    ))}
                    <td />
                    <td className="px-3 py-2.5 text-right tabular-nums text-gray-900 dark:text-gray-100">{moneyFromCents(g.totals.total)}</td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </section>
        )
      })}

      <section aria-label="รวมทุกสาขา" className={cx(cardCls, "p-4")}>
        <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">รวมทุกสาขา <span className="font-normal tabular-nums text-gray-500 dark:text-gray-400">({rows.length} คน)</span></h3>
        <dl className="mt-2 grid grid-cols-2 gap-x-6 gap-y-2 text-sm sm:flex sm:flex-wrap sm:justify-between">
          {EXTERNAL_AMOUNT_COLUMNS.map((c) => (
            <div key={c.key}>
              <dt className="text-xs text-gray-500 dark:text-gray-400">{c.short}</dt>
              <dd className="tabular-nums text-gray-900 dark:text-gray-100">{moneyFromCents(grand[c.key])}</dd>
            </div>
          ))}
          <div className="col-span-2">
            <dt className="text-xs text-gray-500 dark:text-gray-400">รวมรายการหักภายนอก</dt>
            <dd className="font-semibold tabular-nums text-gray-900 dark:text-gray-100">{moneyFromCents(grand.total)}</dd>
          </div>
        </dl>
      </section>

      {editable && (
        <StickyActionBar
          className="md:sticky md:bottom-3 md:z-20 md:rounded-2xl md:bg-white md:px-4 md:py-3 md:shadow-md md:ring-1 md:ring-gray-200/70 md:dark:bg-raised md:dark:shadow-none md:dark:ring-line"
          summary={
            <div className="space-y-1">
              <p className="text-sm text-gray-600 dark:text-gray-400" aria-live="polite">
                {dirtyCount ? `แก้ไข ${dirtyCount} คน ยังไม่บันทึก` : "ยังไม่มีการแก้ไข"}
                {hiddenDirty > 0 && ` (${hiddenDirty} คนถูกตัวกรองซ่อนอยู่)`}
              </p>
              {msg && <StatusMsg msg={msg} />}
            </div>
          }
          secondary={dirtyCount ? { label: "คืนค่าเดิม", onClick: () => setConfirmReset(true), disabled: saving } : undefined}
          primary={{ label: saving ? "กำลังบันทึก…" : "บันทึกรายการหักภายนอก", onClick: save, disabled: dirtyCount === 0 || saving, loading: saving }}
        />
      )}

      <ConfirmDialog
        open={confirmReset}
        title="คืนค่าเดิม"
        description={`ยอดที่พิมพ์ของ ${dirtyCount} คนจะหายไปและกู้คืนไม่ได้`}
        confirmLabel="คืนค่าเดิม"
        cancelLabel="กลับไปแก้ต่อ"
        tone="danger"
        onConfirm={() => { discard(); setConfirmReset(false) }}
        onCancel={() => setConfirmReset(false)}
      />
    </div>
  )
}

/**
 * filterMonth ใช้ร่วมกับแท็บงวดประจำเดือน — onMonthChange ผ่านด่าน ConfirmDialog ของ HRPayrollTab
 * guardRef.current = { dirty, discard } ให้ HRPayrollTab ถามก่อนออกจากแท็บนี้
 */
export default function HRPayrollExternalPanel({ filterMonth, ym, monthOptions, onMonthChange, guardRef, onOpenMonth }) {
  return (
    <div className="space-y-4">
      <div className="w-44">
        <SelectDropdown value={filterMonth} onChange={onMonthChange} options={monthOptions} placeholder="เลือกเดือน" />
      </div>
      {/* key: เปลี่ยนเดือน = เริ่ม state ใหม่หมด ไม่มีทางที่ตัวเลขเดือนหนึ่งจะค้างไปอีกเดือน */}
      <ExternalMonth key={filterMonth} ym={ym} guardRef={guardRef} onOpenMonth={onOpenMonth} />
    </div>
  )
}
