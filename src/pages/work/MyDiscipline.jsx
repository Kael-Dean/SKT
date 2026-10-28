// src/pages/work/MyDiscipline.jsx
// ─────────────────────────────────────────────────────────────────────────────
// แจ้งเรื่อง/ประวัติการตักเตือนของฉัน (งวด 4 · 3Q)
//   ?view=report  (default) แบบฟอร์มแจ้งเรื่อง  — POST /personnel/me/discipline-reports
//   ?view=reports เรื่องที่ฉันแจ้ง (สถานะเท่านั้น) — GET /personnel/me/discipline-reports
//   ?view=history ประวัติการตักเตือนของฉัน + PDF — GET /personnel/me/discipline (&id=<action id> จากการแจ้งเตือน)
//
// หลักฐาน: อัปโหลดทีละไฟล์ที่ POST /files (useFileUploads) แล้วส่ง attachment_ids (สูงสุด 5)
// ข้อผิดพลาดจาก server (422 แจ้งตัวเอง/ผจก., 404, 409 แจ้งซ้ำ, 429 เกินโควตา, 400 ไฟล์) แสดง detail ตามที่ได้รับ
//
// เลือกผู้ถูกแจ้ง: backend ยังไม่มีรายชื่อเพื่อนร่วมงานสำหรับพนักงานทั่วไป (GET /hr/personnel ต้องมี
// hr.employee.list) → ผู้ที่มีสิทธิ์เห็นรายชื่อใช้ EmployeePicker, คนอื่นกรอกรหัสเจ้าหน้าที่
// ─────────────────────────────────────────────────────────────────────────────
import { useCallback, useEffect, useId, useMemo, useState } from "react"
import { useSearchParams } from "react-router-dom"
import { EyeOff, Route, ShieldCheck } from "lucide-react"
import { apiAuth } from "../../lib/api"
import { apiDetail } from "../../lib/apiErrors"
import { getUser } from "../../lib/auth"
import { useCan } from "../../lib/permissions"
import { keepBackState } from "../../lib/drill"
import {
  cx, baseField, cardCls, labelCls, helpTextCls, errorTextCls, primaryBtnCls, neutralBtnCls, focusRingCls, tabPanelCls,
} from "../../lib/styles"
import { asArray, fmtDate, fmtDateTime, nowBangkok, reportStatus, stageLabel, toIncidentIso } from "../../lib/discipline"
import { Badge, EmptyState, ErrorState, Skeleton, Tabs, panelId, tabId, toast } from "../../components/ui"
import PageTitle from "../../components/PageTitle"
import SelectDropdown from "../../components/SelectDropdown"
import ThaiDateField from "../../components/ThaiDateField"
import FileUploader from "../../components/FileUploader"
import useFileUploads from "../../hooks/useFileUploads"
import EmployeePicker from "../../components/hr/EmployeePicker"
import DisciplineHistory from "../../components/hr/DisciplineHistory"

const VIEWS = ["report", "reports", "history"]
const DETAILS_MAX = 2000
const fieldCls = cx(baseField, "!rounded-lg !px-3 !py-2 md:!text-sm")
const errBorder = "!border-red-500 dark:!border-red-400"
const FIELD_ORDER = ["accused_id", "topic_id", "incident_date", "incident_time", "details"]

const emptyForm = () => {
  const now = nowBangkok()
  return { accused_id: "", topic_id: "", incident_date: now.date, incident_time: now.time, details: "" }
}

function useListLoader(path, enabled) {
  const [state, setState] = useState({ rows: [], loading: true, error: "", loaded: false })
  const [tick, setTick] = useState(0)
  useEffect(() => {
    if (!enabled) return undefined
    let alive = true
    setState((s) => ({ ...s, loading: true, error: "" }))
    apiAuth(path)
      .then((d) => { if (alive) setState({ rows: asArray(d), loading: false, error: "", loaded: true }) })
      .catch((e) => { if (alive) setState((s) => ({ ...s, loading: false, error: apiDetail(e) || "โหลดข้อมูลไม่สำเร็จ", loaded: true })) })
    return () => { alive = false }
  }, [path, enabled, tick])
  const reload = useCallback(() => setTick((t) => t + 1), [])
  return { ...state, reload }
}

// ─── แบบฟอร์มแจ้งเรื่อง ─────────────────────────────────────────────────────

function ReportForm({ onSubmitted }) {
  const uid = useId()
  const { can } = useCan()
  const canListStaff = can("hr.employees.list")
  const myId = getUser()?.id
  const uploads = useFileUploads()

  const [form, setForm] = useState(emptyForm)
  const [errors, setErrors] = useState({})
  const [formError, setFormError] = useState("")
  const [submitting, setSubmitting] = useState(false)

  const [topics, setTopics] = useState([])
  const [topicsLoading, setTopicsLoading] = useState(true)
  const [topicsError, setTopicsError] = useState("")
  const [topicsTick, setTopicsTick] = useState(0)

  useEffect(() => {
    let alive = true
    setTopicsLoading(true)
    setTopicsError("")
    apiAuth("/hr/discipline/topics")
      .then((d) => { if (alive) setTopics(asArray(d).filter((t) => t.is_active !== false)) })
      .catch((e) => { if (alive) setTopicsError(apiDetail(e) || "โหลดหัวข้อระเบียบไม่สำเร็จ") })
      .finally(() => { if (alive) setTopicsLoading(false) })
    return () => { alive = false }
  }, [topicsTick])

  const topicOptions = useMemo(
    () => topics.map((t) => ({
      value: String(t.id),
      label: t.name,
      sublabel: [t.is_serious ? "ร้ายแรง" : null, t.description].filter(Boolean).join(" · ") || undefined,
    })),
    [topics],
  )

  const setField = (k, v) => {
    setForm((f) => ({ ...f, [k]: v }))
    setErrors((e) => (e[k] ? { ...e, [k]: undefined } : e))
    setFormError("")
  }

  const validate = () => {
    const e = {}
    const acc = String(form.accused_id).trim()
    if (!acc) e.accused_id = "เลือกผู้ที่ต้องการแจ้ง"
    else if (!/^\d+$/.test(acc)) e.accused_id = "กรอกรหัสเจ้าหน้าที่เป็นตัวเลข"
    else if (myId != null && String(myId) === acc) e.accused_id = "แจ้งเรื่องของตัวเองไม่ได้"
    if (!form.topic_id) e.topic_id = "เลือกหัวข้อระเบียบที่ฝ่าฝืน"
    const now = nowBangkok()
    if (!form.incident_date) e.incident_date = "ระบุวันที่เกิดเหตุ"
    else if (form.incident_date > now.date) e.incident_date = "วันที่เกิดเหตุต้องไม่เกินวันนี้"
    if (!form.incident_time) e.incident_time = "ระบุเวลาโดยประมาณ"
    else if (form.incident_date === now.date && form.incident_time > now.time) e.incident_time = "เวลาเกิดเหตุต้องไม่เกินเวลาปัจจุบัน"
    if (!form.details.trim()) e.details = "เล่าสิ่งที่เกิดขึ้น เช่น ใคร ทำอะไร ที่ไหน มีใครเห็นบ้าง"
    setErrors(e)
    const first = FIELD_ORDER.find((k) => e[k])
    if (first) {
      document.getElementById(`${uid}-${first}`)?.focus()
      return false
    }
    return true
  }

  const reset = () => {
    uploads.discard()
    setForm(emptyForm())
    setErrors({})
    setFormError("")
  }

  const submit = async (ev) => {
    ev.preventDefault()
    setFormError("")
    if (uploads.busy) return
    if (!validate()) return
    setSubmitting(true)
    try {
      const res = await apiAuth("/personnel/me/discipline-reports", {
        method: "POST",
        body: {
          accused_id: Number(form.accused_id),
          topic_id: Number(form.topic_id),
          incident_at: toIncidentIso(form.incident_date, form.incident_time),
          details: form.details.trim(),
          attachment_ids: uploads.ids,
        },
      })
      uploads.reset()
      setForm(emptyForm())
      setErrors({})
      toast.success("ส่งเรื่องแล้ว", {
        description: `เรื่องอยู่ที่ขั้น${stageLabel(res?.stage, res?.stage_label)} — ติดตามสถานะได้ที่ "เรื่องที่ฉันแจ้ง"`,
      })
      onSubmitted?.(res?.id ?? null)
    } catch (err) {
      // 429 เกินโควตา · 409 แจ้งซ้ำ · 422 แจ้งตัวเอง/ผจก. · 404 ไม่พบ · 400 ไฟล์แนบ — แสดงข้อความของ server
      const detail = apiDetail(err)
      if (err?.status === 429) setFormError(detail || "วันนี้/สัปดาห์นี้แจ้งเรื่องครบจำนวนที่กำหนดแล้ว ลองใหม่ภายหลัง")
      else if (err?.status === 409) setFormError(detail || "คุณมีเรื่องของบุคคลนี้ในหัวข้อเดียวกันที่ยังพิจารณาอยู่")
      else setFormError(detail || "ส่งเรื่องไม่สำเร็จ ลองใหม่อีกครั้ง ข้อมูลที่กรอกยังอยู่")
    } finally {
      setSubmitting(false)
    }
  }

  const fieldProps = (k) => ({
    id: `${uid}-${k}`,
    "aria-invalid": !!errors[k] || undefined,
    "aria-describedby": errors[k] ? `${uid}-${k}-err` : undefined,
  })
  const errMsg = (k) => (errors[k] ? <p id={`${uid}-${k}-err`} className={errorTextCls}>{errors[k]}</p> : null)
  const req = <span className="text-red-600 dark:text-red-400" aria-hidden="true"> *</span>
  const locked = submitting

  return (
    <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,1fr)_18rem]">
      <form onSubmit={submit} noValidate aria-labelledby={`${uid}-h`} className={cx(cardCls, "space-y-4 p-5")}>
        <h2 id={`${uid}-h`} className="text-base font-semibold text-gray-900 dark:text-gray-100">แจ้งการกระทำผิดระเบียบ</h2>

        {/* ผู้ถูกแจ้ง */}
        {canListStaff ? (
          <div>
            <EmployeePicker
              id={`${uid}-accused_id`}
              label={<>ผู้ที่ต้องการแจ้ง{req}</>}
              value={form.accused_id}
              onChange={(v) => setField("accused_id", v)}
              disabled={locked}
              className="!max-w-none"
            />
            {errMsg("accused_id")}
          </div>
        ) : (
          <div className="max-w-xs">
            <label htmlFor={`${uid}-accused_id`} className={labelCls}>รหัสเจ้าหน้าที่ของผู้ที่ต้องการแจ้ง{req}</label>
            <input {...fieldProps("accused_id")} type="text" inputMode="numeric" autoComplete="off" value={form.accused_id}
              onChange={(e) => setField("accused_id", e.target.value.replace(/[^\d]/g, ""))} disabled={locked}
              aria-required="true" placeholder="เช่น 123"
              className={cx(fieldCls, "tabular-nums", errors.accused_id && errBorder)} />
            {errors.accused_id ? errMsg("accused_id") : <p className={helpTextCls}>ไม่ทราบรหัส สอบถามฝ่ายบุคคลได้ (ไม่ต้องบอกเหตุผล)</p>}
          </div>
        )}

        {/* หัวข้อ */}
        <div>
          <label id={`${uid}-topic-label`} htmlFor={`${uid}-topic_id`} className={labelCls}>หัวข้อระเบียบที่ฝ่าฝืน{req}</label>
          <SelectDropdown
            id={`${uid}-topic_id`}
            ariaLabelledby={`${uid}-topic-label`}
            ariaDescribedby={errors.topic_id ? `${uid}-topic_id-err` : undefined}
            size="sm"
            required
            options={topicOptions}
            value={form.topic_id}
            onChange={(v) => setField("topic_id", v)}
            placeholder={topicsLoading ? "กำลังโหลดหัวข้อ…" : topicOptions.length ? "เลือกหัวข้อ" : "ยังไม่มีหัวข้อระเบียบ"}
            loading={topicsLoading}
            disabled={locked || (!topicsLoading && !topicOptions.length)}
            error={!!errors.topic_id || !!topicsError}
            searchable={topicOptions.length > 8}
            searchPlaceholder="ค้นหาหัวข้อ"
            showSwatch={false}
            showSublabelInTrigger
          />
          {errors.topic_id ? errMsg("topic_id") : topicsError ? (
            <p role="alert" className={errorTextCls}>
              {topicsError}{" "}
              <button type="button" onClick={() => setTopicsTick((t) => t + 1)} className={cx("cursor-pointer rounded font-medium underline", focusRingCls)}>ลองใหม่</button>
            </p>
          ) : null}
        </div>

        {/* วันเวลา */}
        <fieldset>
          <legend className={labelCls}>วันและเวลาที่เกิดเหตุ{req}</legend>
          <div className="grid grid-cols-[minmax(0,1fr)_8.5rem] gap-3">
            <div>
              <ThaiDateField
                id={`${uid}-incident_date`}
                ariaLabel="วันที่เกิดเหตุ"
                value={form.incident_date}
                onChange={(e) => setField("incident_date", e.target.value)}
                error={!!errors.incident_date}
                disabled={locked}
                aria-describedby={errors.incident_date ? `${uid}-incident_date-err` : undefined}
                className="!rounded-lg !px-3 !py-2 md:!text-sm"
              />
              {errMsg("incident_date")}
            </div>
            <div>
              <input {...fieldProps("incident_time")} type="time" aria-label="เวลาที่เกิดเหตุ" value={form.incident_time}
                onChange={(e) => setField("incident_time", e.target.value)} disabled={locked}
                className={cx(fieldCls, "tabular-nums", errors.incident_time && errBorder)} />
              {errMsg("incident_time")}
            </div>
          </div>
        </fieldset>

        {/* รายละเอียด */}
        <div>
          <label htmlFor={`${uid}-details`} className={labelCls}>รายละเอียด{req}</label>
          <textarea {...fieldProps("details")} rows={5} maxLength={DETAILS_MAX} value={form.details}
            onChange={(e) => setField("details", e.target.value)} disabled={locked} aria-required="true"
            placeholder="เล่าตามจริง: เกิดอะไรขึ้น ที่ไหน มีใครเห็นเหตุการณ์บ้าง"
            className={cx(fieldCls, "resize-y", errors.details && errBorder)} />
          {errors.details ? errMsg("details") : (
            <p className={cx(helpTextCls, "flex justify-between gap-3")}>
              <span>เขียนเฉพาะข้อเท็จจริง ผู้พิจารณาจะอ่านเรื่องนี้ทั้งหมด</span>
              <span className="shrink-0 tabular-nums">{form.details.length}/{DETAILS_MAX}</span>
            </p>
          )}
        </div>

        <FileUploader uploads={uploads} id={`${uid}-files`} label="หลักฐาน" hint="รูปถ่าย หรือเอกสาร PDF ไม่เกิน 5 ไฟล์" disabled={locked} />

        {formError && <ErrorState message={formError} />}

        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <button type="button" onClick={reset} disabled={locked} className={cx(neutralBtnCls, "!h-11")}>ล้างแบบฟอร์ม</button>
          <button type="submit" disabled={locked || uploads.busy} className={cx(primaryBtnCls, "!h-11 sm:min-w-40")}>
            {submitting ? "กำลังส่งเรื่อง…" : uploads.busy ? "รออัปโหลดไฟล์…" : "ส่งเรื่อง"}
          </button>
        </div>
      </form>

      <aside aria-labelledby={`${uid}-aside-h`} className="space-y-3 rounded-2xl bg-gray-50 p-4 text-sm text-gray-700 ring-1 ring-gray-200/70 dark:bg-white/[.03] dark:text-gray-300 dark:ring-line">
        <h2 id={`${uid}-aside-h`} className="font-semibold text-gray-900 dark:text-gray-100">หลังจากส่งเรื่อง</h2>
        <ul className="space-y-3">
          <li className="flex gap-2.5">
            <EyeOff aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-gray-500 dark:text-gray-400" />
            <span>ชื่อของคุณเห็นได้เฉพาะหัวหน้าของผู้ถูกแจ้ง ผช.ผจก. และ ผจก. — ฝ่ายบุคคลและผู้ถูกแจ้งไม่เห็น</span>
          </li>
          <li className="flex gap-2.5">
            <Route aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-gray-500 dark:text-gray-400" />
            <span>เรื่องส่งถึงหัวหน้าของผู้ถูกแจ้งก่อน เรื่องร้ายแรงส่งตรงถึง ผช.ผจก.</span>
          </li>
          <li className="flex gap-2.5">
            <ShieldCheck aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-gray-500 dark:text-gray-400" />
            <span>คุณจะได้รับแจ้งเมื่อพิจารณาแล้ว โดยไม่แสดงผลการลงโทษ</span>
          </li>
        </ul>
      </aside>
    </div>
  )
}

// ─── เรื่องที่ฉันแจ้ง ───────────────────────────────────────────────────────

function MyReports({ list, highlightId }) {
  const { rows, loading, error, reload } = list
  const sorted = useMemo(
    () => [...rows].sort((a, b) => String(b.created_at || "").localeCompare(String(a.created_at || "")) || (b.id ?? 0) - (a.id ?? 0)),
    [rows],
  )
  return (
    <section aria-label="เรื่องที่ฉันแจ้ง" aria-busy={loading || undefined} className={cx(cardCls, "space-y-3 p-5")}>
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <p className="text-sm text-gray-600 dark:text-gray-400">แสดงเฉพาะสถานะ ผลการพิจารณาเป็นความลับของผู้ถูกแจ้ง</p>
        {!loading && (
          <button type="button" onClick={reload} className={cx("inline-flex min-h-touch cursor-pointer items-center rounded px-1 text-sm font-medium text-indigo-700 hover:underline md:min-h-0 dark:text-indigo-300", focusRingCls)}>
            รีเฟรช
          </button>
        )}
      </div>
      {error ? (
        <ErrorState message={error} onRetry={reload} />
      ) : loading ? (
        <div className="space-y-3"><span className="sr-only">กำลังโหลด…</span>{[0, 1].map((i) => <Skeleton key={i} className="h-16" rounded="rounded-xl" />)}</div>
      ) : sorted.length === 0 ? (
        <EmptyState title="ยังไม่เคยแจ้งเรื่อง" description="เรื่องที่คุณแจ้งจะแสดงที่นี่ พร้อมสถานะการพิจารณา" className="!py-10" />
      ) : (
        <ul className="divide-y divide-gray-100 dark:divide-line">
          {sorted.map((r) => {
            const st = reportStatus(r.status)
            const hi = highlightId != null && String(highlightId) === String(r.id)
            return (
              <li key={r.id} className={cx("flex flex-wrap items-start justify-between gap-x-3 gap-y-1 py-3 first:pt-0 last:pb-0", hi && "-mx-2 rounded-lg bg-emerald-50/70 px-2 first:pt-3 dark:bg-emerald-500/5")}>
                <div className="min-w-0">
                  <p className="font-medium text-gray-900 dark:text-gray-100">{r.accused_name || `รหัส ${r.accused_id}`}</p>
                  <p className="text-sm text-gray-700 dark:text-gray-300">{r.topic || "—"}</p>
                  <p className="text-xs tabular-nums text-gray-500 dark:text-gray-400">
                    เกิดเหตุ {fmtDateTime(r.incident_at)} · แจ้งเมื่อ {fmtDate(r.created_at)} · #{r.id}
                  </p>
                </div>
                <Badge tone={st.tone}>{st.label}</Badge>
              </li>
            )
          })}
        </ul>
      )}
    </section>
  )
}

// ─── หน้า ────────────────────────────────────────────────────────────────────

export default function MyDiscipline() {
  const [params, setParams] = useSearchParams()
  const rawView = params.get("view")
  const view = VIEWS.includes(rawView) ? rawView : "report"
  const linkId = params.get("id")
  const [justSentId, setJustSentId] = useState(null)

  const reports = useListLoader("/personnel/me/discipline-reports", view === "reports")
  const history = useListLoader("/personnel/me/discipline", view === "history")

  const setView = useCallback((v) => {
    setParams((prev) => {
      const p = new URLSearchParams(prev)
      p.set("view", v)
      p.delete("id")
      return p
    }, { replace: true, state: keepBackState() })
  }, [setParams])

  useEffect(() => {
    if (justSentId == null) return undefined
    const t = setTimeout(() => setJustSentId(null), 5000)
    return () => clearTimeout(t)
  }, [justSentId])

  const openCount = reports.loaded ? reports.rows.filter((r) => r.status === "open").length : null
  const tabs = [
    { value: "report", label: "แจ้งเรื่อง" },
    { value: "reports", label: "เรื่องที่ฉันแจ้ง", count: openCount || null },
    { value: "history", label: "ประวัติการตักเตือนของฉัน" },
  ]

  return (
    <div className="w-full space-y-4 pb-12">
      <PageTitle title="แจ้งเรื่องและประวัติการตักเตือน" />
      <Tabs items={tabs} value={view} onChange={setView} ariaLabel="แจ้งเรื่องและประวัติการตักเตือน" idBase="my-disc" />

      <div role="tabpanel" id={panelId("my-disc", view)} aria-labelledby={tabId("my-disc", view)} tabIndex={-1} className={tabPanelCls}>
        {view === "report" && (
          <ReportForm onSubmitted={(id) => { setJustSentId(id); setView("reports") }} />
        )}
        {view === "reports" && <MyReports list={reports} highlightId={justSentId} />}
        {view === "history" && (
          <section aria-label="ประวัติการตักเตือนของฉัน" aria-busy={history.loading || undefined} className={cx(cardCls, "space-y-3 p-5")}>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              โทษที่ได้รับและหนังสือแต่ละฉบับ การพักงานหรือโทษที่หนักกว่าในปีงบประมาณมีผลต่อการเลื่อนขั้นประจำปี
            </p>
            <DisciplineHistory
              actions={history.rows}
              loading={history.loading}
              error={history.error}
              onRetry={history.reload}
              highlightId={linkId}
              emptyTitle="ไม่มีประวัติการตักเตือน"
              emptyDescription="คุณยังไม่เคยได้รับโทษทางวินัย"
            />
          </section>
        )}
      </div>
    </div>
  )
}
