// src/pages/work/MyKpi.jsx
// ผลการประเมินของฉัน (งวด 4 · 3L)
//   GET /personnel/me/kpi/result?fiscal_year=   { fiscal_year, window_start, window_end, status,
//        self_assessment, result }  — `result` stays null until ผจก. approves (then composite_score,
//        grade, grade_label, step_awarded, step_immediate, step_pending, pending_status, eligible,
//        level_before, level_after)
//   PUT /personnel/me/kpi/self-assessment { fiscal_year, items, comment } — partial OK, only while the
//        window is open (409 after). Never counts toward the score.
//   GET /hr/kpi/form-items — the 12 items + maximums (cached; any logged-in user).
// The older GET /personnel/me/kpi (scores before approval) is deliberately NOT used here.
import { useCallback, useEffect, useId, useMemo, useState } from "react"
import { CalendarRange, Lock } from "lucide-react"
import PageTitle from "../../components/PageTitle"
import SelectDropdown from "../../components/SelectDropdown"
import { Notice } from "../../components/hr/HrModal"
import { Badge, EmptyState, ErrorState, Skeleton, StickyActionBar, toast } from "../../components/ui"
import { GradeBadge, NoteField, PendingBadge, StatusBadge } from "../../components/hr/kpi/KpiBits"
import { useFormItems } from "../../components/hr/kpi/useKpi"
import {
  fmtDay,
  fmtScore,
  fmtStep,
  fyOptions,
  fyRange,
  itemError,
  latestWindowFiscalYear,
  num,
  windowPhase,
} from "../../components/hr/kpi/kpiUtils"
import { apiAuth } from "../../lib/api"
import { baseField, cardCls, cx, helpTextCls } from "../../lib/styles"
import { errText, fmtDate, fmtLevel } from "../../components/hr/positionUtils"

const toStr = (v) => (num(v) == null ? "" : String(num(v)))

export default function MyKpi() {
  const fySelectId = useId()
  const [fy, setFy] = useState(() => latestWindowFiscalYear())
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const { catalogue, loading: catLoading, error: catError, retry: catRetry } = useFormItems()

  const load = useCallback(() => {
    setLoading(true)
    setError("")
    return apiAuth(`/personnel/me/kpi/result?fiscal_year=${Number(fy)}`)
      .then((d) => setData(d && typeof d === "object" ? d : null))
      .catch((e) => { setData(null); setError(errText(e, "โหลดผลการประเมินไม่สำเร็จ")) })
      .finally(() => setLoading(false))
  }, [fy])

  useEffect(() => { load() }, [load])

  const phase = windowPhase(data)
  const result = data?.result ?? null

  return (
    <div className="mx-auto max-w-4xl space-y-5 p-4 pb-10 md:p-6">
      <PageTitle title="ผลการประเมินของฉัน" />

      <div className="flex flex-wrap items-end gap-x-6 gap-y-3">
        <div className="w-full sm:w-56">
          <span id={fySelectId} className="mb-1 block text-xs font-medium text-gray-600 dark:text-gray-400">ปีบัญชี</span>
          <SelectDropdown
            ariaLabelledby={fySelectId}
            options={fyOptions(latestWindowFiscalYear())}
            value={String(fy)}
            onChange={(v) => setFy(Number(v))}
            showSwatch={false}
            showSublabelInTrigger
          />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-xs text-gray-500 dark:text-gray-400">ช่วงประเมิน</p>
          {loading && !data ? (
            <Skeleton className="mt-1 h-6 w-60" />
          ) : data?.window_start ? (
            <div className="mt-0.5 flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center gap-1.5 text-base font-semibold text-gray-900 dark:text-gray-100">
                <CalendarRange aria-hidden="true" className="size-4 text-gray-400 dark:text-gray-500" strokeWidth={1.75} />
                <span className="tabular-nums">{fmtDay(data.window_start)} – {fmtDay(data.window_end)}</span>
              </span>
              {phase === "open" ? (
                <Badge tone="success">เปิดให้ประเมินตนเอง</Badge>
              ) : (
                <Badge tone="neutral">{phase === "before" ? "ยังไม่เปิด" : "ปิดแล้ว"}</Badge>
              )}
            </div>
          ) : (
            <p className="mt-0.5 text-sm text-gray-600 dark:text-gray-400">ปีบัญชี {fyRange(fy)}</p>
          )}
        </div>
      </div>

      {error ? (
        <ErrorState message={error} onRetry={load} />
      ) : loading && !data ? (
        <div className={cx(cardCls, "space-y-3 p-5")}>
          <Skeleton className="h-6 w-40" />
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-3/4" />
        </div>
      ) : (
        <>
          <ResultSection fy={fy} status={data?.status} result={result} />
          {catError ? (
            <ErrorState message={catError} onRetry={catRetry} />
          ) : catLoading && !catalogue ? (
            <div className={cx(cardCls, "space-y-2 p-5")}>
              {Array.from({ length: 6 }, (_, i) => <Skeleton key={i} className="h-8 w-full" />)}
            </div>
          ) : (
            <SelfAssessmentForm
              key={fy}
              fy={fy}
              phase={phase}
              windowStart={data?.window_start}
              windowEnd={data?.window_end}
              saved={data?.self_assessment ?? null}
              catalogue={catalogue}
              onSaved={(sa) => setData((d) => ({ ...(d ?? {}), self_assessment: sa }))}
            />
          )}
        </>
      )}
    </div>
  )
}

// ─── Result (after ผจก. approval) ────────────────────────────────────────────
function ResultSection({ fy, status, result }) {
  if (!result) {
    return (
      <section aria-labelledby="my-kpi-result" className={cx(cardCls, "p-5")}>
        <h2 id="my-kpi-result" className="text-base font-semibold text-gray-900 dark:text-gray-100">ผลการประเมิน ปีบัญชี {fy}</h2>
        <p className="mt-1 flex items-start gap-2 text-sm text-gray-600 dark:text-gray-400">
          <Lock aria-hidden="true" className="mt-0.5 size-4 shrink-0" strokeWidth={1.75} />
          ผลจะแสดงที่นี่หลังผู้จัดการอนุมัติ
        </p>
        {status && (
          <p className="mt-2 flex flex-wrap items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
            สถานะตอนนี้ <StatusBadge status={status} />
          </p>
        )}
      </section>
    )
  }

  const score = num(result.composite_score)
  const awarded = num(result.step_awarded)
  const imm = num(result.step_immediate)
  const pend = num(result.step_pending)
  const before = num(result.level_before)
  const after = num(result.level_after)

  return (
    <section aria-labelledby="my-kpi-result" className={cx(cardCls, "p-5")}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <h2 id="my-kpi-result" className="text-base font-semibold text-gray-900 dark:text-gray-100">ผลการประเมิน ปีบัญชี {fy}</h2>
        <Badge tone="success">อนุมัติแล้ว</Badge>
      </div>

      <div className="mt-4 flex flex-wrap items-end gap-x-8 gap-y-4">
        <div>
          <p className="text-xs text-gray-500 dark:text-gray-400">คะแนนรวม</p>
          <p className="text-4xl font-semibold leading-none tabular-nums text-gray-900 dark:text-gray-50">
            {fmtScore(score)}<span className="ml-1 text-base font-normal text-gray-500 dark:text-gray-400">/100</span>
          </p>
        </div>
        <div>
          <p className="text-xs text-gray-500 dark:text-gray-400">ระดับผล</p>
          <p className="mt-1"><GradeBadge grade={result.grade} label={result.grade_label} className="!text-sm" /></p>
        </div>
      </div>

      <dl className="mt-5 divide-y divide-gray-100 border-t border-gray-100 text-sm dark:divide-gray-700/60 dark:border-gray-700/60">
        <Row label="ขั้นเงินเดือนที่ได้">
          {result.eligible === false ? (
            <span className="text-gray-700 dark:text-gray-300">ไม่ได้เลื่อนขั้นปีนี้ (ไม่มีสิทธิ์ตามเกณฑ์)</span>
          ) : (
            <span className="tabular-nums">
              <b className="text-gray-900 dark:text-gray-100">{fmtStep(awarded)}</b> ขั้น
              {pend != null && pend > 0 && (
                <span className="text-gray-600 dark:text-gray-400"> (ได้ทันที {fmtStep(imm ?? (awarded ?? 0) - pend)} · อีก {fmtStep(pend)} รอผลประกอบการ)</span>
              )}
            </span>
          )}
        </Row>
        {pend != null && pend > 0 && (
          <Row label="ขั้นที่รอผลประกอบการ"><PendingBadge status={result.pending_status} /></Row>
        )}
        {(before != null || after != null) && (
          <Row label="ระดับขั้น">
            <span className="tabular-nums">
              {fmtLevel(before)} <span aria-hidden="true">→</span><span className="sr-only">เป็น</span>{" "}
              <b className="text-gray-900 dark:text-gray-100">{fmtLevel(after)}</b>
            </span>
          </Row>
        )}
      </dl>
    </section>
  )
}

function Row({ label, children }) {
  return (
    <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 py-2.5">
      <dt className="text-gray-600 dark:text-gray-400">{label}</dt>
      <dd className="text-right text-gray-800 dark:text-gray-200">{children}</dd>
    </div>
  )
}

// ─── Self-assessment (12 items, never counts) ────────────────────────────────
function SelfAssessmentForm({ fy, phase, windowStart, windowEnd, saved, catalogue, onSaved }) {
  const items = useMemo(() => (Array.isArray(catalogue?.items) ? catalogue.items : []), [catalogue])
  const groups = Array.isArray(catalogue?.groups) ? catalogue.groups : []
  const savedItems = saved?.items && typeof saved.items === "object" ? saved.items : {}
  const [draft, setDraft] = useState({})
  const [comment, setComment] = useState(null) // null = untouched
  const [saving, setSaving] = useState(false)
  const [err, setErr] = useState("")

  const editable = phase === "open"
  const value = (it) => draft[it.item] ?? toStr(savedItems[it.item])
  const errors = Object.fromEntries(items.map((it) => [it.item, itemError(value(it), num(it.max))]))
  const hasErrors = Object.values(errors).some(Boolean)
  const changed = items.filter((it) => draft[it.item] != null && draft[it.item] !== "" && draft[it.item] !== toStr(savedItems[it.item]))
  const commentValue = comment ?? saved?.comment ?? ""
  const commentChanged = comment != null && comment.trim() !== (saved?.comment ?? "").trim()
  const dirty = changed.length > 0 || commentChanged

  const total = items.reduce((s, it) => s + (num(value(it)) ?? 0), 0)
  const filled = items.filter((it) => num(value(it)) != null).length

  const save = async () => {
    if (!dirty || hasErrors) return
    setSaving(true)
    setErr("")
    try {
      const body = { fiscal_year: Number(fy), items: Object.fromEntries(changed.map((it) => [it.item, Number(value(it))])) }
      if (commentChanged || comment != null) body.comment = commentValue.trim()
      const res = await apiAuth("/personnel/me/kpi/self-assessment", { method: "PUT", body })
      onSaved(res && typeof res === "object" ? res : { ...(saved ?? {}), items: { ...savedItems, ...body.items }, comment: body.comment })
      setDraft({})
      setComment(null)
      toast.success("บันทึกแบบประเมินตนเองแล้ว", { description: "แก้ไขได้จนถึงวันปิดช่วงประเมิน" })
    } catch (e) {
      setErr(errText(e))
    } finally {
      setSaving(false)
    }
  }

  if (!items.length) {
    return (
      <div className={cx(cardCls, "p-2")}>
        <EmptyState title="ยังไม่มีแบบประเมิน" description="ระบบยังไม่ส่งรายการแบบประเมินมา ลองโหลดหน้าใหม่" />
      </div>
    )
  }

  if (!editable && !saved) {
    return (
      <section aria-labelledby="my-kpi-self" className={cx(cardCls, "p-5")}>
        <h2 id="my-kpi-self" className="text-base font-semibold text-gray-900 dark:text-gray-100">แบบประเมินตนเอง</h2>
        <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
          {phase === "before"
            ? `เปิดให้ประเมินตนเองวันที่ ${fmtDay(windowStart)} – ${fmtDay(windowEnd)}`
            : phase === "after"
              ? "ปิดรับแบบประเมินตนเองแล้ว คุณไม่ได้ส่งแบบประเมินในปีนี้"
              : "ยังไม่ได้กำหนดช่วงประเมินของปีนี้"}
        </p>
      </section>
    )
  }

  return (
    <section aria-labelledby="my-kpi-self" className={cx(cardCls, "p-5")}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 id="my-kpi-self" className="text-base font-semibold text-gray-900 dark:text-gray-100">แบบประเมินตนเอง</h2>
          <p className="mt-0.5 text-sm text-gray-600 dark:text-gray-400">
            ให้คะแนนตัวเอง 12 รายการ ผู้ประเมินเห็นประกอบการพิจารณา ไม่นำไปคิดคะแนนจริง
          </p>
        </div>
        <p className="whitespace-nowrap text-right tabular-nums">
          <span className="text-2xl font-semibold text-gray-900 dark:text-gray-50">{fmtScore(total)}</span>
          <span className="text-sm text-gray-500 dark:text-gray-400">/100</span>
          <span className="block text-xs text-gray-500 dark:text-gray-400">กรอกแล้ว {filled}/{items.length} รายการ</span>
        </p>
      </div>

      {!editable && (
        <Notice tone="info" className="mt-4">
          {phase === "before" ? `แก้ไขได้ตั้งแต่ ${fmtDay(windowStart)}` : `ปิดรับแล้วเมื่อ ${fmtDay(windowEnd)} แสดงคะแนนที่ส่งไว้`}
        </Notice>
      )}

      <div className="mt-5 space-y-6">
        {groups.map((g) => {
          const rows = items.filter((it) => Number(it.group) === Number(g.group))
          const sub = rows.reduce((s, it) => s + (num(value(it)) ?? 0), 0)
          return (
            <fieldset key={g.group}>
              <legend className="flex w-full items-baseline justify-between gap-3 border-b border-gray-100 pb-1.5 text-sm font-semibold text-gray-800 dark:border-gray-700/60 dark:text-gray-200">
                <span>{g.label}</span>
                <span className="font-normal tabular-nums text-gray-500 dark:text-gray-400">
                  <span className="font-semibold text-gray-800 dark:text-gray-200">{fmtScore(sub)}</span>/{fmtScore(g.max)}
                </span>
              </legend>
              <ul className="divide-y divide-gray-100 dark:divide-gray-700/40">
                {rows.map((it) => {
                  const id = `my-kpi-${it.item}`
                  const errId = `${id}-err`
                  const max = num(it.max)
                  return (
                    <li key={it.item} className="flex items-center gap-3 py-2.5">
                      <label htmlFor={id} className="min-w-0 flex-1 text-sm text-gray-800 dark:text-gray-200">
                        <span className="mr-1.5 tabular-nums text-gray-400 dark:text-gray-500">{it.item}</span>
                        {it.label}
                        {errors[it.item] && (
                          <span id={errId} className="block text-xs font-medium text-red-600 dark:text-red-400">ต้องอยู่ระหว่าง {errors[it.item]}</span>
                        )}
                      </label>
                      <div className="flex shrink-0 items-center gap-1.5">
                        <input
                          id={id}
                          type="text"
                          inputMode="decimal"
                          autoComplete="off"
                          value={value(it)}
                          onChange={(e) => setDraft((d) => ({ ...d, [it.item]: e.target.value.replace(",", ".") }))}
                          readOnly={!editable}
                          disabled={saving}
                          aria-invalid={errors[it.item] ? true : undefined}
                          aria-describedby={errors[it.item] ? errId : undefined}
                          className={cx(
                            baseField,
                            "!h-11 !w-20 !rounded-lg !px-3 !py-0 md:!h-9 md:!text-sm text-right tabular-nums",
                            !editable && "!bg-transparent !border-transparent",
                            errors[it.item] && "!border-red-500",
                          )}
                        />
                        <span className="w-8 text-xs tabular-nums text-gray-500 dark:text-gray-400">/{fmtScore(max)}</span>
                      </div>
                    </li>
                  )
                })}
              </ul>
            </fieldset>
          )
        })}

        {editable ? (
          <NoteField
            label="ความเห็นเพิ่มเติม"
            required={false}
            value={commentValue}
            onChange={setComment}
            rows={3}
            placeholder="ผลงานเด่น สิ่งที่อยากพัฒนา หรือเรื่องที่อยากให้ผู้ประเมินทราบ"
          />
        ) : saved?.comment ? (
          <div>
            <p className="text-xs font-medium text-gray-600 dark:text-gray-400">ความเห็นเพิ่มเติม</p>
            <p className="mt-1 whitespace-pre-line text-sm text-gray-800 dark:text-gray-200">{saved.comment}</p>
          </div>
        ) : null}

        {(saved?.updated_at || saved?.submitted_at) && (
          <p className={helpTextCls}>ส่งล่าสุด {fmtDate(saved.updated_at || saved.submitted_at)}</p>
        )}
        {err && <Notice tone="error">{err}</Notice>}
      </div>

      {editable && (
        <div className="mt-5">
          <StickyActionBar
            summary={dirty ? <>รวม <b className="tabular-nums">{fmtScore(total)}</b>/100 · ยังไม่บันทึก</> : "ไม่มีการแก้ไข"}
            primary={{ label: saving ? "กำลังบันทึก…" : "บันทึกแบบประเมินตนเอง", onClick: save, disabled: saving || !dirty || hasErrors, loading: saving }}
          />
        </div>
      )}
    </section>
  )
}
