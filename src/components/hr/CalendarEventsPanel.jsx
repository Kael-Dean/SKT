// src/components/hr/CalendarEventsPanel.jsx
// ─────────────────────────────────────────────────────────────────────────────
// ประชุม / อบรม / กิจกรรมของสหกรณ์ — ส่วนจัดการในแท็บ "ปฏิทินวันหยุด" ของ HR (backend PR #112)
//   รายการตามปีงบที่เลือก + เพิ่ม/แก้ไข (Sheet) + ยกเลิก (ConfirmDialog)
//   สิทธิ์แก้ไข = holiday.edit (`hr.holidays.manage`) — ผู้แก้ไขเห็นกิจกรรมทุกสาขา จึงแสดงชิปสาขาให้รู้ว่าอันไหนเฉพาะสาขา
//   กิจกรรมไม่กระทบวันลา/วันทำงาน
// ─────────────────────────────────────────────────────────────────────────────
import { useCallback, useEffect, useId, useMemo, useState } from "react"
import { CalendarPlus } from "lucide-react"
import { apiAuth } from "../../lib/api"
import { apiDetail } from "../../lib/apiErrors"
import {
  EVENT_TYPES, TIME_OPTIONS, cancelCalendarEvent, compareEvents, createCalendarEvent, eventTimeText,
  eventTypeLabel, fetchCalendarEvents, fiscalYearRange, updateCalendarEvent,
} from "../../lib/calendarEvents"
import { cx, baseField, cardCls, editBtnCls, errorTextCls, helpTextCls, labelCls, neutralBtnCls, primaryBtnCls, submitBtnCls } from "../../lib/styles"
import SelectDropdown from "../SelectDropdown"
import ThaiDateField from "../ThaiDateField"
import { Badge, ConfirmDialog, EmptyState, ErrorState, Sheet, Skeleton, toast } from "../ui"

const fieldCls = cx(baseField, "!rounded-lg !px-3 !py-2 md:!text-sm")
const errBorder = "!border-red-500 dark:!border-red-400"
const TYPE_TONE = { meeting: "info", training: "pending", activity: "success", other: "neutral" }

const EMPTY = {
  title: "", event_type: "meeting", start_date: "", end_date: "", allDay: true, start_time: "", end_time: "",
  location: "", detail: "", scope: "all", branch_ids: [],
}

const th = (iso, opts) => (iso ? new Date(`${String(iso).slice(0, 10)}T00:00:00`).toLocaleDateString("th-TH", opts) : "")

function dateRangeText(e) {
  const a = th(e.start_date, { day: "numeric", month: "short", year: "numeric" })
  if (!e.end_date || e.end_date === e.start_date) return a
  return `${th(e.start_date, { day: "numeric", month: "short" })} – ${th(e.end_date, { day: "numeric", month: "short", year: "numeric" })}`
}

function toForm(e) {
  if (!e) return EMPTY
  const branches = Array.isArray(e.branch_ids) ? e.branch_ids.map(String) : []
  return {
    title: e.title ?? "",
    event_type: e.event_type ?? "meeting",
    start_date: String(e.start_date ?? "").slice(0, 10),
    end_date: e.end_date && e.end_date !== e.start_date ? String(e.end_date).slice(0, 10) : "",
    allDay: !e.start_time,
    start_time: e.start_time ? String(e.start_time).slice(0, 5) : "",
    end_time: e.end_time ? String(e.end_time).slice(0, 5) : "",
    location: e.location ?? "",
    detail: e.detail ?? "",
    scope: branches.length ? "some" : "all",
    branch_ids: branches,
  }
}

/** ฟอร์ม → body ของ API (ค่าว่าง = null เพื่อให้ PATCH ล้างค่าได้) */
function toBody(f) {
  const t = (v) => (v?.trim() ? v.trim() : null)
  return {
    title: f.title.trim(),
    event_type: f.event_type,
    start_date: f.start_date,
    end_date: f.end_date && f.end_date !== f.start_date ? f.end_date : null,
    start_time: f.allDay ? null : f.start_time || null,
    end_time: f.allDay ? null : f.end_time || null,
    location: t(f.location),
    detail: t(f.detail),
    branch_ids: f.scope === "some" ? f.branch_ids.map(Number) : [],
  }
}

function validate(f) {
  const e = {}
  if (!f.title.trim()) e.title = "ระบุชื่อกิจกรรม"
  if (!f.start_date) e.start_date = "เลือกวันที่"
  if (f.end_date && f.start_date && f.end_date < f.start_date) e.end_date = "วันสิ้นสุดต้องไม่ก่อนวันเริ่ม"
  if (!f.allDay) {
    if (!f.start_time) e.start_time = "เลือกเวลาเริ่ม หรือเลือก “ทั้งวัน”"
    const oneDay = !f.end_date || f.end_date === f.start_date
    if (f.start_time && f.end_time && oneDay && f.end_time <= f.start_time) e.end_time = "เวลาสิ้นสุดต้องหลังเวลาเริ่ม"
  }
  if (f.scope === "some" && f.branch_ids.length === 0) e.branch_ids = "เลือกอย่างน้อย 1 สาขา หรือเลือก “ทุกสาขา”"
  return e
}

function EventForm({ open, editing, branches, onClose, onSaved }) {
  const uid = useId()
  const [form, setForm] = useState(EMPTY)
  const [errors, setErrors] = useState({})
  const [saving, setSaving] = useState(false)
  const [formError, setFormError] = useState("")

  useEffect(() => {
    if (!open) return
    setForm(toForm(editing))
    setErrors({})
    setFormError("")
    setSaving(false)
  }, [open, editing])

  const set = (k, v) => {
    setForm((f) => ({ ...f, [k]: v }))
    setErrors((e) => (e[k] ? { ...e, [k]: undefined } : e))
    setFormError("")
  }
  const toggleBranch = (id) =>
    set("branch_ids", form.branch_ids.includes(id) ? form.branch_ids.filter((b) => b !== id) : [...form.branch_ids, id])

  const submit = async () => {
    const e = validate(form)
    setErrors(e)
    const first = Object.keys(e)[0]
    if (first) {
      document.getElementById(`${uid}-${first}`)?.focus()
      return
    }
    setSaving(true)
    try {
      const body = toBody(form)
      const saved = editing ? await updateCalendarEvent(editing.id, body) : await createCalendarEvent(body)
      onSaved(saved, !!editing)
    } catch (err) {
      setFormError(apiDetail(err) || err?.message || "บันทึกไม่สำเร็จ")
      setSaving(false)
    }
  }

  const err = (k) => (errors[k] ? <p id={`${uid}-${k}-err`} className={errorTextCls}>{errors[k]}</p> : null)
  const aria = (k) => ({ "aria-invalid": !!errors[k] || undefined, "aria-describedby": errors[k] ? `${uid}-${k}-err` : undefined })
  const req = <span className="text-red-600 dark:text-red-400" aria-hidden="true"> *</span>
  const segBtn = (active) =>
    cx(
      "min-h-touch md:min-h-9 flex-1 rounded-lg px-3 text-sm font-medium transition-colors duration-200 cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500",
      active
        ? "bg-white text-gray-900 shadow-sm ring-1 ring-gray-200 dark:bg-raised dark:text-gray-50 dark:ring-line"
        : "text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-100",
    )

  return (
    <Sheet
      open={open}
      onClose={onClose}
      busy={saving}
      size="md"
      title={editing ? "แก้ไขกิจกรรม" : "เพิ่มประชุม / กิจกรรม"}
      subtitle="แสดงในปฏิทินของพนักงาน · ไม่กระทบวันลาและวันทำงาน"
      footer={
        <div className="grid grid-cols-2 gap-3 md:flex md:justify-end md:gap-2">
          <button type="button" onClick={onClose} disabled={saving} className={neutralBtnCls}>ยกเลิก</button>
          <button type="button" onClick={submit} disabled={saving} className={submitBtnCls}>
            {saving ? "กำลังบันทึก…" : editing ? "บันทึกการแก้ไข" : "เพิ่มกิจกรรม"}
          </button>
        </div>
      }
    >
      <div className="space-y-4">
        {formError && (
          <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-500/10 dark:text-red-200">{formError}</p>
        )}

        <div className="min-w-0">
          <label htmlFor={`${uid}-title`} className={labelCls}>ชื่อกิจกรรม{req}</label>
          <input id={`${uid}-title`} type="text" value={form.title} maxLength={200} onChange={(e) => set("title", e.target.value)}
            placeholder="เช่น ประชุมคณะกรรมการดำเนินการ ครั้งที่ 8" aria-required="true" {...aria("title")}
            className={cx(fieldCls, errors.title && errBorder)} />
          {err("title")}
        </div>

        <div className="min-w-0">
          <span id={`${uid}-type-l`} className={labelCls}>ประเภท</span>
          <SelectDropdown id={`${uid}-event_type`} ariaLabelledby={`${uid}-type-l`} size="sm" showSwatch={false}
            options={EVENT_TYPES} value={form.event_type} onChange={(v) => set("event_type", v)} />
        </div>

        <div className="grid min-w-0 grid-cols-1 gap-3 sm:grid-cols-2">
          <div className="min-w-0">
            <label htmlFor={`${uid}-start_date`} className={labelCls}>วันที่{req}</label>
            <ThaiDateField id={`${uid}-start_date`} value={form.start_date} onChange={(e) => set("start_date", e.target.value)}
              error={!!errors.start_date} aria-describedby={errors.start_date ? `${uid}-start_date-err` : undefined} className={fieldCls} />
            {err("start_date")}
          </div>
          <div className="min-w-0">
            <label htmlFor={`${uid}-end_date`} className={labelCls}>ถึงวันที่ <span className="font-normal text-gray-400 dark:text-gray-500">(ถ้าหลายวัน)</span></label>
            <ThaiDateField id={`${uid}-end_date`} value={form.end_date} min={form.start_date || undefined}
              onChange={(e) => set("end_date", e.target.value)} placeholder="วันเดียว"
              error={!!errors.end_date} aria-describedby={errors.end_date ? `${uid}-end_date-err` : undefined} className={fieldCls} />
            {err("end_date")}
          </div>
        </div>

        <fieldset className="min-w-0">
          <legend className={labelCls}>เวลา</legend>
          <div className="flex gap-1 rounded-xl bg-gray-100 p-1 dark:bg-white/[.04]" role="radiogroup">
            <button type="button" role="radio" aria-checked={form.allDay} className={segBtn(form.allDay)} onClick={() => set("allDay", true)}>ทั้งวัน</button>
            <button type="button" role="radio" aria-checked={!form.allDay} className={segBtn(!form.allDay)} onClick={() => set("allDay", false)}>ระบุเวลา</button>
          </div>
          {!form.allDay && (
            <div className="mt-3 grid min-w-0 grid-cols-2 gap-3">
              <div className="min-w-0">
                <span id={`${uid}-st-l`} className={labelCls}>เริ่ม{req}</span>
                <SelectDropdown id={`${uid}-start_time`} ariaLabelledby={`${uid}-st-l`} size="sm" searchable title="เวลาเริ่ม"
                  options={TIME_OPTIONS} value={form.start_time} onChange={(v) => set("start_time", v)} placeholder="— เลือก —" error={!!errors.start_time} />
                {err("start_time")}
              </div>
              <div className="min-w-0">
                <span id={`${uid}-et-l`} className={labelCls}>สิ้นสุด</span>
                <SelectDropdown id={`${uid}-end_time`} ariaLabelledby={`${uid}-et-l`} size="sm" searchable title="เวลาสิ้นสุด"
                  options={TIME_OPTIONS} value={form.end_time} onChange={(v) => set("end_time", v)} placeholder="ไม่ระบุ"
                  onClear={() => set("end_time", "")} error={!!errors.end_time} />
                {err("end_time")}
              </div>
            </div>
          )}
        </fieldset>

        <div className="min-w-0">
          <label htmlFor={`${uid}-location`} className={labelCls}>สถานที่</label>
          <input id={`${uid}-location`} type="text" value={form.location} maxLength={200} onChange={(e) => set("location", e.target.value)}
            placeholder="เช่น ห้องประชุมสำนักงานใหญ่" className={fieldCls} />
        </div>

        <div className="min-w-0">
          <label htmlFor={`${uid}-detail`} className={labelCls}>รายละเอียด</label>
          <textarea id={`${uid}-detail`} rows={3} value={form.detail} maxLength={2000} onChange={(e) => set("detail", e.target.value)}
            placeholder="วาระ / สิ่งที่ต้องเตรียม" className={cx(fieldCls, "resize-y")} />
        </div>

        <fieldset className="min-w-0" aria-describedby={errors.branch_ids ? `${uid}-branch_ids-err` : undefined}>
          <legend className={labelCls}>ผู้ที่เห็นในปฏิทิน</legend>
          <div className="flex gap-1 rounded-xl bg-gray-100 p-1 dark:bg-white/[.04]" role="radiogroup">
            <button id={`${uid}-branch_ids`} type="button" role="radio" aria-checked={form.scope === "all"} className={segBtn(form.scope === "all")} onClick={() => set("scope", "all")}>ทุกสาขา</button>
            <button type="button" role="radio" aria-checked={form.scope === "some"} className={segBtn(form.scope === "some")} onClick={() => set("scope", "some")}>เฉพาะบางสาขา</button>
          </div>
          {form.scope === "some" && (
            <div className="mt-2 flex flex-wrap gap-1.5">
              {branches.length === 0 && <p className={helpTextCls}>กำลังโหลดรายชื่อสาขา…</p>}
              {branches.map((b) => {
                const on = form.branch_ids.includes(String(b.id))
                return (
                  <button key={b.id} type="button" aria-pressed={on} onClick={() => toggleBranch(String(b.id))}
                    className={cx(
                      "min-h-touch md:min-h-8 rounded-full px-3 text-xs font-medium ring-1 transition-colors duration-200 cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500",
                      on
                        ? "bg-indigo-600 text-white ring-indigo-600 dark:bg-indigo-500 dark:ring-indigo-500"
                        : "bg-white text-gray-700 ring-gray-300 hover:bg-gray-50 dark:bg-white/[.04] dark:text-gray-200 dark:ring-line-strong dark:hover:bg-white/[.08]",
                    )}>
                    {b.name}
                  </button>
                )
              })}
            </div>
          )}
          {err("branch_ids")}
        </fieldset>
      </div>
    </Sheet>
  )
}

export default function CalendarEventsPanel({ fiscalYear, canManage }) {
  const [state, setState] = useState({ loading: true, error: "", events: [], available: true })
  const [reload, setReload] = useState(0)
  const [branches, setBranches] = useState([])
  const [formOpen, setFormOpen] = useState(false)
  const [editing, setEditing] = useState(null)
  const [cancelTarget, setCancelTarget] = useState(null)
  const [cancelling, setCancelling] = useState(false)
  const [cancelErr, setCancelErr] = useState("")

  useEffect(() => {
    let alive = true
    const { from, to } = fiscalYearRange(fiscalYear)
    setState((s) => ({ ...s, loading: true, error: "" }))
    fetchCalendarEvents(from, to)
      .then(({ events, available }) => alive && setState({ loading: false, error: "", events: [...events].sort(compareEvents), available }))
      .catch((e) => alive && setState((s) => ({ ...s, loading: false, error: apiDetail(e) || e?.message || "โหลดกิจกรรมไม่สำเร็จ" })))
    return () => { alive = false }
  }, [fiscalYear, reload])

  useEffect(() => {
    apiAuth("/order/branch/search")
      .then((d) => setBranches((Array.isArray(d) ? d : []).map((b) => ({ id: b.id, name: b.branch_name ?? b.name ?? `สาขา ${b.id}` }))))
      .catch(() => setBranches([]))
  }, [])
  const branchName = useMemo(() => {
    const m = new Map(branches.map((b) => [String(b.id), b.name]))
    return (id) => m.get(String(id)) ?? `สาขา #${id}`
  }, [branches])

  const refetch = useCallback(() => setReload((n) => n + 1), [])
  const openCreate = () => { setEditing(null); setFormOpen(true) }
  const openEdit = (e) => { setEditing(e); setFormOpen(true) }
  const onSaved = (saved, wasEdit) => {
    setFormOpen(false)
    setEditing(null)
    toast.success(wasEdit ? "บันทึกการแก้ไขแล้ว" : "เพิ่มกิจกรรมแล้ว", { description: saved?.title ?? undefined })
    refetch()
  }
  const confirmCancel = async () => {
    setCancelling(true)
    setCancelErr("")
    try {
      await cancelCalendarEvent(cancelTarget.id)
      toast.success("ยกเลิกกิจกรรมแล้ว", { description: cancelTarget.title })
      setCancelTarget(null)
      refetch()
    } catch (e) {
      setCancelErr(apiDetail(e) || e?.message || "ยกเลิกไม่สำเร็จ")
    } finally {
      setCancelling(false)
    }
  }

  const { loading, error, events, available } = state
  // backend ยังไม่เปิดใช้ → ซ่อนทั้งส่วน (ไม่ให้เห็นปุ่มที่กดแล้วพัง)
  if (!loading && !available) return null

  return (
    <section aria-labelledby="hr-cal-events-h" className="space-y-3">
      <div className="flex flex-wrap items-end justify-between gap-3 pt-2">
        <div className="min-w-0">
          <h3 id="hr-cal-events-h" className="text-base font-semibold text-gray-900 dark:text-gray-100">ประชุม / อบรม / กิจกรรม</h3>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            {loading ? "กำลังโหลด…" : `ปีงบประมาณ ${fiscalYear} · ${events.length} รายการ`}
          </p>
        </div>
        {canManage && (
          <button type="button" onClick={openCreate} className={primaryBtnCls}>
            <CalendarPlus aria-hidden="true" className="size-4" strokeWidth={2} />
            เพิ่มประชุม / กิจกรรม
          </button>
        )}
      </div>

      {error ? (
        <ErrorState message={error} onRetry={refetch} />
      ) : (
        <div className={cx(cardCls, "!p-0 overflow-hidden")}>
          {loading ? (
            <div className="space-y-2 p-4">{[0, 1, 2].map((i) => <Skeleton key={i} className="h-12" />)}</div>
          ) : events.length === 0 ? (
            <EmptyState
              title={`ยังไม่มีกิจกรรมในปีงบประมาณ ${fiscalYear}`}
              description={canManage ? "เพิ่มวันประชุม อบรม หรือกิจกรรม แล้วพนักงานจะเห็นในหน้าปฏิทินทันที" : "ฝ่ายบุคคลยังไม่ได้ลงกิจกรรมของปีงบประมาณนี้"}
            />
          ) : (
            <ul className="divide-y divide-gray-100 dark:divide-line">
              {events.map((e) => (
                <li key={e.id} className="flex flex-col gap-2 px-4 py-3 sm:flex-row sm:items-start sm:gap-4">
                  <div className="w-full shrink-0 sm:w-44">
                    <p className="text-sm font-medium tabular-nums text-gray-900 dark:text-gray-100">{dateRangeText(e)}</p>
                    <p className="text-xs tabular-nums text-gray-500 dark:text-gray-400">{eventTimeText(e)}</p>
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="flex flex-wrap items-center gap-2">
                      <span className="break-words text-sm font-semibold text-gray-900 dark:text-gray-100">{e.title}</span>
                      <Badge tone={TYPE_TONE[e.event_type] ?? "neutral"}>{eventTypeLabel(e.event_type)}</Badge>
                    </p>
                    {e.location && <p className="text-xs text-gray-600 dark:text-gray-300">สถานที่: {e.location}</p>}
                    <p className="mt-1 flex flex-wrap gap-1">
                      {Array.isArray(e.branch_ids) && e.branch_ids.length > 0 ? (
                        e.branch_ids.map((b) => (
                          <span key={b} className="rounded-full bg-gray-100 px-2 py-0.5 text-[11px] font-medium text-gray-700 dark:bg-white/[.06] dark:text-gray-200">{branchName(b)}</span>
                        ))
                      ) : (
                        <span className="text-[11px] text-gray-500 dark:text-gray-400">ทุกสาขา</span>
                      )}
                    </p>
                  </div>
                  {canManage && (
                    <div className="flex shrink-0 items-center gap-4 sm:pt-0.5">
                      <button type="button" onClick={() => openEdit(e)} className={editBtnCls}>แก้ไข</button>
                      <button type="button" onClick={() => { setCancelTarget(e); setCancelErr("") }}
                        className="min-h-touch md:min-h-0 rounded text-xs font-medium text-red-600 hover:underline cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-red-500 dark:text-red-400">
                        ยกเลิก
                      </button>
                    </div>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {canManage && (
        <EventForm open={formOpen} editing={editing} branches={branches} onClose={() => { if (!formOpen) return; setFormOpen(false); setEditing(null) }} onSaved={onSaved} />
      )}

      <ConfirmDialog
        open={!!cancelTarget}
        tone="danger"
        title="ยกเลิกกิจกรรมนี้?"
        description={cancelTarget ? `“${cancelTarget.title}” · ${dateRangeText(cancelTarget)} จะหายจากปฏิทินของทุกคน` : ""}
        confirmLabel="ยกเลิกกิจกรรม"
        cancelLabel="ไม่ยกเลิก"
        loading={cancelling}
        loadingLabel="กำลังยกเลิก…"
        error={cancelErr}
        onConfirm={confirmCancel}
        onCancel={() => setCancelTarget(null)}
      />
    </section>
  )
}
