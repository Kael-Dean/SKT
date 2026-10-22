// src/pages/hr/tabs/HRDisciplineSettingsTab.jsx
// ─────────────────────────────────────────────────────────────────────────────
// ตั้งค่าวินัย (งวด 4 · 3Q) — เปิดจาก /hr/dashboard?tab=discipline-settings
//   หัวข้อระเบียบ  GET /hr/discipline/topics?include_inactive=true · POST · PATCH /{id} · DELETE /{id} (soft:
//                 ซ่อนจากผู้แจ้ง แต่ยังอยู่ในประวัติ — เปิดใช้คืนด้วย PATCH is_active=true)
//   เกณฑ์         GET/PATCH /hr/discipline/settings (ส่งเฉพาะช่องที่เปลี่ยน; min > max → 422)
// แก้ไขได้เมื่อมี hr.discipline.topics (discipline.topics) · hr.discipline.view อ่านอย่างเดียว
// ─────────────────────────────────────────────────────────────────────────────
import { useCallback, useEffect, useId, useMemo, useState } from "react"
import { Pencil, Plus } from "lucide-react"
import { apiAuth } from "../../../lib/api"
import { apiDetail } from "../../../lib/apiErrors"
import { useCan } from "../../../lib/permissions"
import { asArray, fmtDateTime } from "../../../lib/discipline"
import {
  cx, baseField, cardCls, errorTextCls, focusRingCls, neutralBtnCls, primaryBtnCls, readonlyFieldCls,
} from "../../../lib/styles"
import { Badge, ConfirmDialog, EmptyState, ErrorState, Sheet, Skeleton, toast } from "../../../components/ui"

const inputCls = cx(baseField, "!rounded-lg !px-3 !py-2 md:!text-sm")
const numCls = cx(inputCls, "text-right tabular-nums")
const smallLabel = "mb-1 block text-xs font-medium text-gray-600 dark:text-gray-400"
const linkBtn = cx(
  "inline-flex min-h-touch items-center gap-1 rounded-lg px-2.5 text-sm font-medium transition-colors duration-150 cursor-pointer md:min-h-8",
  focusRingCls,
)

function Switch({ id, checked, onChange, disabled, label, hint }) {
  return (
    <div className="flex items-start justify-between gap-4">
      <label htmlFor={id} className="min-w-0 text-sm font-medium text-gray-800 dark:text-gray-200">
        {label}
        {hint && <span className="block text-xs font-normal text-gray-500 dark:text-gray-400">{hint}</span>}
      </label>
      <button
        id={id} type="button" role="switch" aria-checked={checked} disabled={disabled}
        onClick={() => onChange(!checked)}
        className={cx(
          "relative inline-flex h-6 w-11 shrink-0 cursor-pointer items-center rounded-full transition-colors duration-200",
          "focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-surface",
          "disabled:cursor-not-allowed disabled:opacity-60",
          checked ? "bg-red-600 dark:bg-red-500" : "bg-gray-300 dark:bg-white/20",
        )}
      >
        <span aria-hidden="true" className={cx("inline-block size-5 rounded-full bg-white shadow transition-transform duration-200 ease-out", checked ? "translate-x-5" : "translate-x-0.5")} />
      </button>
    </div>
  )
}

// ─── หัวข้อระเบียบ ───────────────────────────────────────────────────────────

function TopicSheet({ topic, onClose, onSaved }) {
  const isNew = topic?.id == null
  const [name, setName] = useState(topic?.name ?? "")
  const [description, setDescription] = useState(topic?.description ?? "")
  const [serious, setSerious] = useState(!!topic?.is_serious)
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState("")
  const [nameErr, setNameErr] = useState("")

  const save = async (ev) => {
    ev?.preventDefault()
    if (!name.trim()) { setNameErr("ระบุชื่อหัวข้อ"); document.getElementById("disc-topic-name")?.focus(); return }
    setBusy(true); setErr("")
    try {
      if (isNew) {
        await apiAuth("/hr/discipline/topics", { method: "POST", body: { name: name.trim(), description: description.trim() || null, is_serious: serious } })
      } else {
        const body = {}
        if (name.trim() !== (topic.name ?? "")) body.name = name.trim()
        if (description.trim() !== (topic.description ?? "")) body.description = description.trim() || null
        if (serious !== !!topic.is_serious) body.is_serious = serious
        if (Object.keys(body).length) await apiAuth(`/hr/discipline/topics/${topic.id}`, { method: "PATCH", body })
      }
      toast.success(isNew ? "เพิ่มหัวข้อแล้ว" : "บันทึกหัวข้อแล้ว", { description: name.trim() })
      onSaved()
    } catch (e) {
      setErr(apiDetail(e) || "บันทึกไม่สำเร็จ")
    } finally {
      setBusy(false)
    }
  }

  return (
    <Sheet
      open
      onClose={onClose}
      busy={busy}
      size="md"
      title={isNew ? "เพิ่มหัวข้อระเบียบ" : "แก้ไขหัวข้อระเบียบ"}
      footer={(
        <div className="grid grid-cols-2 gap-3 md:flex md:justify-end md:gap-2">
          <button type="button" onClick={onClose} disabled={busy} className={neutralBtnCls}>ยกเลิก</button>
          <button type="submit" form="disc-topic-form" disabled={busy} className={primaryBtnCls}>{busy ? "กำลังบันทึก…" : "บันทึก"}</button>
        </div>
      )}
    >
      <form id="disc-topic-form" onSubmit={save} noValidate className="space-y-4">
        <div>
          <label htmlFor="disc-topic-name" className={smallLabel}>ชื่อหัวข้อ <span className="text-red-600 dark:text-red-400">*</span></label>
          <input id="disc-topic-name" value={name} maxLength={200} onChange={(e) => { setName(e.target.value); setNameErr("") }}
            aria-invalid={!!nameErr || undefined} aria-describedby={nameErr ? "disc-topic-name-err" : undefined}
            placeholder="เช่น มาทำงานสาย" className={cx(inputCls, nameErr && "!border-red-500 dark:!border-red-400")} />
          {nameErr && <p id="disc-topic-name-err" className={errorTextCls}>{nameErr}</p>}
        </div>
        <div>
          <label htmlFor="disc-topic-desc" className={smallLabel}>คำอธิบาย (ไม่บังคับ)</label>
          <textarea id="disc-topic-desc" rows={3} value={description} maxLength={1000} onChange={(e) => setDescription(e.target.value)}
            placeholder="ข้อระเบียบที่อ้างอิง หรือขอบเขตของหัวข้อ — ผู้แจ้งเห็นข้อความนี้ตอนเลือกหัวข้อ" className={cx(inputCls, "resize-y")} />
        </div>
        <Switch id="disc-topic-serious" checked={serious} onChange={setSerious} label="ความผิดร้ายแรง"
          hint="เรื่องเริ่มที่ ผช.ผจก. และผู้พิจารณาเลือกโทษข้ามขั้นได้ (ที่ขั้นถัดไปขึ้นไป)" />
        {err && <p role="alert" className={errorTextCls}>{err}</p>}
      </form>
    </Sheet>
  )
}

function TopicsSection({ canEdit }) {
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [tick, setTick] = useState(0)
  const [showInactive, setShowInactive] = useState(false)
  const [editing, setEditing] = useState(null) // topic | {} (new) | null
  const [confirm, setConfirm] = useState(null) // topic to deactivate
  const [confirmBusy, setConfirmBusy] = useState(false)
  const [confirmErr, setConfirmErr] = useState("")
  const [rowBusy, setRowBusy] = useState(null)

  useEffect(() => {
    let alive = true
    setLoading(true); setError("")
    apiAuth("/hr/discipline/topics?include_inactive=true")
      .then((d) => { if (alive) setRows(asArray(d)) })
      .catch((e) => { if (alive) setError(apiDetail(e) || "โหลดหัวข้อระเบียบไม่สำเร็จ") })
      .finally(() => { if (alive) setLoading(false) })
    return () => { alive = false }
  }, [tick])
  const reload = () => setTick((t) => t + 1)

  const inactiveCount = rows.filter((t) => t.is_active === false).length
  const visible = useMemo(() => {
    const list = showInactive ? rows : rows.filter((t) => t.is_active !== false)
    return [...list].sort((a, b) => (Number(b.is_active !== false) - Number(a.is_active !== false)) || String(a.name).localeCompare(String(b.name), "th"))
  }, [rows, showInactive])

  const deactivate = async () => {
    setConfirmBusy(true); setConfirmErr("")
    try {
      await apiAuth(`/hr/discipline/topics/${confirm.id}`, { method: "DELETE" })
      toast.success("ปิดใช้หัวข้อแล้ว", { description: `${confirm.name} — ผู้แจ้งจะไม่เห็นหัวข้อนี้ ประวัติเดิมยังอยู่` })
      setConfirm(null)
      reload()
    } catch (e) {
      setConfirmErr(apiDetail(e) || "ปิดใช้ไม่สำเร็จ")
    } finally {
      setConfirmBusy(false)
    }
  }

  const reactivate = async (t) => {
    setRowBusy(t.id)
    try {
      await apiAuth(`/hr/discipline/topics/${t.id}`, { method: "PATCH", body: { is_active: true } })
      toast.success("เปิดใช้หัวข้อแล้ว", { description: t.name })
      reload()
    } catch (e) {
      toast.error("เปิดใช้ไม่สำเร็จ", { description: apiDetail(e) })
    } finally {
      setRowBusy(null)
    }
  }

  return (
    <section aria-labelledby="disc-topics-h" aria-busy={loading || undefined} className={cx(cardCls, "p-5")}>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h2 id="disc-topics-h" className="text-base font-semibold text-gray-900 dark:text-gray-100">
          หัวข้อระเบียบ
          {!loading && !error && <span className="ml-2 text-sm font-normal tabular-nums text-gray-500 dark:text-gray-400">{rows.length - inactiveCount} หัวข้อที่ใช้อยู่</span>}
        </h2>
        <div className="flex flex-wrap items-center gap-2">
          {inactiveCount > 0 && (
            <button type="button" aria-pressed={showInactive} onClick={() => setShowInactive((v) => !v)}
              className={cx(linkBtn, "text-gray-700 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-white/[.06]")}>
              {showInactive ? "ซ่อนหัวข้อที่ปิดใช้" : `แสดงที่ปิดใช้ (${inactiveCount})`}
            </button>
          )}
          {canEdit && (
            <button type="button" onClick={() => setEditing({})} className={cx(primaryBtnCls, "!h-9 !px-3 !text-sm")}>
              <Plus aria-hidden="true" className="size-4" /> เพิ่มหัวข้อ
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
          title="ยังไม่มีหัวข้อระเบียบ"
          description="พนักงานต้องเลือกหัวข้อทุกครั้งที่แจ้งเรื่อง เพิ่มหัวข้อแรก เช่น มาทำงานสาย หรือ ขาดงานโดยไม่แจ้ง"
          action={canEdit ? <button type="button" onClick={() => setEditing({})} className={primaryBtnCls}>เพิ่มหัวข้อ</button> : null}
          className="!py-10"
        />
      ) : (
        <ul className="divide-y divide-gray-100 dark:divide-line">
          {visible.map((t) => {
            const inactive = t.is_active === false
            return (
              <li key={t.id} className={cx("flex flex-wrap items-start justify-between gap-x-4 gap-y-2 py-3 first:pt-0 last:pb-0", inactive && "opacity-70")}>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-medium text-gray-900 dark:text-gray-100">{t.name}</p>
                    {t.is_serious && <Badge tone="danger">ร้ายแรง</Badge>}
                    {inactive && <Badge tone="neutral">ปิดใช้</Badge>}
                  </div>
                  {t.description && <p className="mt-0.5 break-words text-sm text-gray-600 dark:text-gray-400">{t.description}</p>}
                </div>
                {canEdit && (
                  <div className="flex shrink-0 items-center gap-1">
                    {!inactive && (
                      <button type="button" onClick={() => setEditing(t)} aria-label={`แก้ไขหัวข้อ ${t.name}`}
                        className={cx(linkBtn, "text-indigo-700 hover:bg-indigo-50 dark:text-indigo-300 dark:hover:bg-indigo-500/10")}>
                        <Pencil aria-hidden="true" className="size-3.5" /> แก้ไข
                      </button>
                    )}
                    {inactive ? (
                      <button type="button" onClick={() => reactivate(t)} disabled={rowBusy === t.id}
                        className={cx(linkBtn, "text-emerald-700 hover:bg-emerald-50 disabled:opacity-60 dark:text-emerald-300 dark:hover:bg-emerald-500/10")}>
                        {rowBusy === t.id ? "กำลังเปิดใช้…" : "เปิดใช้"}
                      </button>
                    ) : (
                      <button type="button" onClick={() => { setConfirmErr(""); setConfirm(t) }} aria-label={`ปิดใช้หัวข้อ ${t.name}`}
                        className={cx(linkBtn, "text-red-700 hover:bg-red-50 dark:text-red-300 dark:hover:bg-red-500/10")}>
                        ปิดใช้
                      </button>
                    )}
                  </div>
                )}
              </li>
            )
          })}
        </ul>
      )}

      {editing && (
        <TopicSheet key={editing.id ?? "new"} topic={editing.id != null ? editing : null}
          onClose={() => setEditing(null)} onSaved={() => { setEditing(null); reload() }} />
      )}
      <ConfirmDialog
        open={!!confirm}
        title="ปิดใช้หัวข้อนี้?"
        description={confirm ? `"${confirm.name}" จะไม่แสดงให้ผู้แจ้งเลือกอีก เรื่องและประวัติโทษเดิมยังอยู่ครบ เปิดใช้คืนได้ภายหลัง` : ""}
        confirmLabel="ปิดใช้หัวข้อ"
        tone="danger"
        loading={confirmBusy}
        error={confirmErr}
        onConfirm={deactivate}
        onCancel={() => setConfirm(null)}
      />
    </section>
  )
}

// ─── เกณฑ์ ───────────────────────────────────────────────────────────────────

const SETTING_FIELDS = [
  { key: "reports_per_day", label: "แจ้งได้ต่อวัน", unit: "เรื่อง/คน", min: 1 },
  { key: "reports_per_week", label: "แจ้งได้ต่อสัปดาห์", unit: "เรื่อง/คน", min: 1 },
  { key: "counter_window_days", label: "นับโทษย้อนหลัง", unit: "วัน", min: 0, hint: "0 = นับตลอดอายุงาน" },
  { key: "suspension_min_days", label: "พักงานอย่างน้อย", unit: "วัน", min: 1 },
  { key: "suspension_max_days", label: "พักงานไม่เกิน", unit: "วัน", min: 1 },
]

function SettingsSection({ canEdit }) {
  const uid = useId()
  const [initial, setInitial] = useState(null)
  const [form, setForm] = useState({})
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [tick, setTick] = useState(0)
  const [errors, setErrors] = useState({})
  const [saving, setSaving] = useState(false)
  const [saveErr, setSaveErr] = useState("")

  const toForm = (d) => Object.fromEntries([...SETTING_FIELDS.map((f) => [f.key, d?.[f.key] ?? ""]), ["doc_prefix", d?.doc_prefix ?? ""]].map(([k, v]) => [k, String(v ?? "")]))

  const load = useCallback(() => {
    let alive = true
    setLoading(true); setError("")
    apiAuth("/hr/discipline/settings")
      .then((d) => { if (alive) { setInitial(d); setForm(toForm(d)) } })
      .catch((e) => { if (alive) setError(apiDetail(e) || "โหลดการตั้งค่าไม่สำเร็จ") })
      .finally(() => { if (alive) setLoading(false) })
    return () => { alive = false }
  }, [])
  useEffect(() => load(), [load, tick])

  const setField = (k, v) => { setForm((f) => ({ ...f, [k]: v })); setErrors((e) => ({ ...e, [k]: undefined })); setSaveErr("") }

  const base = initial ? toForm(initial) : {}
  const dirtyKeys = Object.keys(form).filter((k) => String(form[k]).trim() !== String(base[k] ?? "").trim())

  const save = async (ev) => {
    ev.preventDefault()
    const e = {}
    for (const f of SETTING_FIELDS) {
      const s = String(form[f.key]).trim()
      const n = Number(s)
      if (s === "" || !Number.isInteger(n)) e[f.key] = "กรอกจำนวนเต็ม"
      else if (n < f.min) e[f.key] = `ต้องไม่น้อยกว่า ${f.min}`
    }
    if (!e.suspension_min_days && !e.suspension_max_days && Number(form.suspension_min_days) > Number(form.suspension_max_days)) {
      e.suspension_max_days = "ต้องไม่น้อยกว่าจำนวนวันขั้นต่ำ"
    }
    if (!e.reports_per_day && !e.reports_per_week && Number(form.reports_per_day) > Number(form.reports_per_week)) {
      e.reports_per_week = "ต่อสัปดาห์ควรไม่น้อยกว่าต่อวัน"
    }
    if (!String(form.doc_prefix).trim()) e.doc_prefix = "ระบุคำนำหน้าเลขที่หนังสือ"
    setErrors(e)
    const first = [...SETTING_FIELDS.map((f) => f.key), "doc_prefix"].find((k) => e[k])
    if (first) { document.getElementById(`${uid}-${first}`)?.focus(); return }
    if (!dirtyKeys.length) { toast.info("ไม่มีค่าที่เปลี่ยน"); return }

    const body = {}
    for (const k of dirtyKeys) body[k] = k === "doc_prefix" ? String(form[k]).trim() : Number(form[k])
    setSaving(true); setSaveErr("")
    try {
      const d = await apiAuth("/hr/discipline/settings", { method: "PATCH", body })
      const next = d && typeof d === "object" && !Array.isArray(d) ? d : { ...initial, ...body }
      setInitial(next); setForm(toForm(next))
      toast.success("บันทึกการตั้งค่าแล้ว")
    } catch (err) {
      setSaveErr(apiDetail(err) || "บันทึกไม่สำเร็จ")
    } finally {
      setSaving(false)
    }
  }

  const numField = (f) => (
    <div key={f.key}>
      <label htmlFor={`${uid}-${f.key}`} className={smallLabel}>{f.label}</label>
      <div className="flex items-center gap-2">
        <input id={`${uid}-${f.key}`} type="text" inputMode="numeric" value={form[f.key] ?? ""} disabled={saving}
          onChange={(e) => setField(f.key, e.target.value.replace(/[^\d]/g, ""))}
          readOnly={!canEdit}
          aria-invalid={!!errors[f.key] || undefined} aria-describedby={errors[f.key] ? `${uid}-${f.key}-err` : f.hint ? `${uid}-${f.key}-hint` : undefined}
          className={cx(canEdit ? numCls : cx(readonlyFieldCls, "!rounded-lg !px-3 !py-2 text-right tabular-nums md:!text-sm"), "w-24", errors[f.key] && "!border-red-500 dark:!border-red-400")} />
        <span className="text-sm text-gray-600 dark:text-gray-400">{f.unit}</span>
      </div>
      {errors[f.key] ? <p id={`${uid}-${f.key}-err`} className={errorTextCls}>{errors[f.key]}</p>
        : f.hint ? <p id={`${uid}-${f.key}-hint`} className="mt-1 text-xs text-gray-500 dark:text-gray-400">{f.hint}</p> : null}
    </div>
  )

  return (
    <section aria-labelledby={`${uid}-h`} aria-busy={loading || undefined} className={cx(cardCls, "p-5")}>
      <h2 id={`${uid}-h`} className="text-base font-semibold text-gray-900 dark:text-gray-100">เกณฑ์การแจ้งเรื่องและการลงโทษ</h2>
      {initial?.updated_at && <p className="mt-0.5 text-xs tabular-nums text-gray-500 dark:text-gray-400">แก้ไขล่าสุด {fmtDateTime(initial.updated_at)}</p>}
      {!canEdit && !loading && !error && <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">ดูได้อย่างเดียว — แก้ไขได้เฉพาะฝ่ายบุคคล</p>}

      {error ? (
        <ErrorState message={error} onRetry={() => setTick((t) => t + 1)} className="mt-3" />
      ) : loading ? (
        <div className="mt-4 grid gap-3 sm:grid-cols-2"><span className="sr-only">กำลังโหลด…</span>{[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-14" rounded="rounded-lg" />)}</div>
      ) : (
        <form onSubmit={save} noValidate className="mt-4 space-y-5">
          <fieldset className="space-y-3">
            <legend className="mb-2 text-xs font-semibold text-gray-500 dark:text-gray-400">กันการแจ้งเรื่องถี่เกินไป</legend>
            <div className="grid gap-3 sm:grid-cols-2">{SETTING_FIELDS.slice(0, 2).map(numField)}</div>
          </fieldset>
          <fieldset className="space-y-3 border-t border-gray-100 pt-4 dark:border-line">
            <legend className="sr-only">การนับโทษ</legend>
            <p className="text-xs font-semibold text-gray-500 dark:text-gray-400">การนับโทษ</p>
            {numField(SETTING_FIELDS[2])}
          </fieldset>
          <fieldset className="space-y-3 border-t border-gray-100 pt-4 dark:border-line">
            <legend className="sr-only">การพักงาน</legend>
            <p className="text-xs font-semibold text-gray-500 dark:text-gray-400">พักงาน (ขั้น 6) — งดจ่ายค่าจ้างวันทำงานที่พัก</p>
            <div className="grid gap-3 sm:grid-cols-2">{SETTING_FIELDS.slice(3).map(numField)}</div>
          </fieldset>
          <div className="border-t border-gray-100 pt-4 dark:border-line">
            <label htmlFor={`${uid}-doc_prefix`} className={smallLabel}>คำนำหน้าเลขที่หนังสือ</label>
            <input id={`${uid}-doc_prefix`} value={form.doc_prefix ?? ""} maxLength={40} disabled={saving} readOnly={!canEdit}
              onChange={(e) => setField("doc_prefix", e.target.value)}
              aria-invalid={!!errors.doc_prefix || undefined} aria-describedby={`${uid}-doc_prefix-hint`}
              className={cx(canEdit ? inputCls : cx(readonlyFieldCls, "!rounded-lg !px-3 !py-2 md:!text-sm"), "max-w-xs", errors.doc_prefix && "!border-red-500 dark:!border-red-400")} />
            {errors.doc_prefix ? <p className={errorTextCls}>{errors.doc_prefix}</p> : (
              <p id={`${uid}-doc_prefix-hint`} className="mt-1 text-xs tabular-nums text-gray-500 dark:text-gray-400">
                ตัวอย่างเลขที่: {(form.doc_prefix || "").trim() || "—"} 12/2569
              </p>
            )}
          </div>

          {saveErr && <p role="alert" className={errorTextCls}>{saveErr}</p>}
          {canEdit && (
            <div className="flex flex-col-reverse gap-2 sm:flex-row sm:items-center sm:justify-end">
              {dirtyKeys.length > 0 && (
                <button type="button" onClick={() => { setForm(base); setErrors({}); setSaveErr("") }} disabled={saving} className={neutralBtnCls}>คืนค่าเดิม</button>
              )}
              <button type="submit" disabled={saving || !dirtyKeys.length} className={primaryBtnCls}>
                {saving ? "กำลังบันทึก…" : dirtyKeys.length ? `บันทึก (${dirtyKeys.length} ค่า)` : "บันทึก"}
              </button>
            </div>
          )}
        </form>
      )}
    </section>
  )
}

export default function HRDisciplineSettingsTab() {
  const { can } = useCan()
  const canEdit = can("hr.discipline.topics")
  return (
    <div className="grid items-start gap-4 xl:grid-cols-[minmax(0,1fr)_24rem]">
      <TopicsSection canEdit={canEdit} />
      <SettingsSection canEdit={canEdit} />
    </div>
  )
}
