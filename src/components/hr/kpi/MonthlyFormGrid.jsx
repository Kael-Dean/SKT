// src/components/hr/kpi/MonthlyFormGrid.jsx
// Sub-tab "แบบประเมินรายเดือน" (3L rework — replaces MonthlyKpiPanel / POST /hr/kpi/monthly).
//   GET /hr/employees/{id}/kpi/form?fiscal_year=   items × months grid (kpi.monthly · kpi.view · branch head)
//   PUT /hr/kpi/monthly-form { user_id, fiscal_year, month, items }  one month, changed items only
//     → the full grid again; we re-render from it (no local math for averages/totals).
// Editing model: one month column is "active" (click its header / pick it on phones).
// Drafts are kept per month so switching columns never loses typing; Save sends the
// active month. 422 (range/unknown item) · 409 (window closed) · 403 (other branch) shown verbatim.
// Evaluators with hr.kpi.selfAssessment.view also see the employee's own score per item.
import { Fragment, useId, useMemo, useState } from "react"
import { Save } from "lucide-react"
import EmployeePicker from "../EmployeePicker"
import SelectDropdown from "../../SelectDropdown"
import { Notice } from "../HrModal"
import { apiAuth } from "../../../lib/api"
import { baseField, cardCls, cellInput, cx, helpTextCls, primaryBtnCls } from "../../../lib/styles"
import { EmptyState, ErrorState, Skeleton, StickyActionBar, toast } from "../../ui"
import { useIsPhone } from "../../../hooks/useMediaQuery"
import { errText, nf } from "../positionUtils"
import {
  DEFAULT_MONTH_ORDER,
  currentFiscalYear,
  fmtDay,
  fmtScore,
  fyMonthLabel,
  itemError,
  num,
} from "./kpiUtils"
import { useEvaluateeSelfAssessment, useMonthlyForm } from "./useKpi"

const toStr = (v) => (num(v) == null ? "" : String(num(v)))

export default function MonthlyFormGrid({ fy, info, phase, perms, catalogue }) {
  const isPhone = useIsPhone()
  const monthSelectId = useId()
  const [empId, setEmpId] = useState("")
  const { form, setForm, loading, error, reload } = useMonthlyForm(empId, fy)
  const self = useEvaluateeSelfAssessment(empId, fy, perms.selfView)
  const [pickedMonth, setPickedMonth] = useState(null)
  const [drafts, setDrafts] = useState({}) // { [month]: { [item]: "4.5" } }
  const [saving, setSaving] = useState(false)
  const [saveErr, setSaveErr] = useState("")

  const canEdit = !!perms.monthlyForm && phase !== "after"
  const monthOrder = Array.isArray(form?.month_order) && form.month_order.length ? form.month_order : catalogue?.month_order ?? DEFAULT_MONTH_ORDER

  // reset drafts when the employee / year changes (render-time reset, no effect)
  const scope = `${empId}:${fy}`
  const [draftScope, setDraftScope] = useState(scope)
  if (draftScope !== scope) {
    setDraftScope(scope)
    setDrafts({})
    setPickedMonth(null)
    setSaveErr("")
  }

  const items = useMemo(() => (Array.isArray(form?.items) ? form.items : []), [form])
  const groups = useMemo(() => {
    const fromForm = Array.isArray(form?.groups) ? form.groups : []
    const base = fromForm.length ? fromForm : Array.isArray(catalogue?.groups) ? catalogue.groups : []
    return base.map((g) => ({ ...g, items: items.filter((it) => Number(it.group) === Number(g.group)) }))
  }, [form, catalogue, items])

  // default active month: this month inside the current fiscal year, else the first empty month
  const activeMonth = useMemo(() => {
    if (pickedMonth != null) return pickedMonth
    if (Number(fy) === currentFiscalYear()) return new Date().getMonth() + 1
    const totals = form?.month_totals ?? {}
    return monthOrder.find((m) => num(totals[String(m)]) == null) ?? monthOrder[monthOrder.length - 1]
  }, [pickedMonth, fy, form, monthOrder])

  const serverValue = (it, m) => toStr(it?.months?.[String(m)])
  const cellValue = (it, m) => drafts[m]?.[it.item] ?? serverValue(it, m)
  const dirtyOf = (m) => items.filter((it) => {
    const d = drafts[m]?.[it.item]
    return d != null && d !== "" && d !== serverValue(it, m)
  })
  const activeDirty = dirtyOf(activeMonth)
  const activeErrors = Object.fromEntries(items.map((it) => [it.item, itemError(cellValue(it, activeMonth), num(it.max))]))
  const hasErrors = Object.values(activeErrors).some(Boolean)
  const dirtyMonths = monthOrder.filter((m) => dirtyOf(m).length > 0)

  const setCell = (item, v) => setDrafts((d) => ({ ...d, [activeMonth]: { ...(d[activeMonth] ?? {}), [item]: v } }))

  const save = async () => {
    if (!canEdit || hasErrors || activeDirty.length === 0) return
    setSaving(true)
    setSaveErr("")
    try {
      const body = {
        user_id: Number(empId),
        fiscal_year: Number(fy),
        month: Number(activeMonth),
        items: Object.fromEntries(activeDirty.map((it) => [it.item, Number(cellValue(it, activeMonth))])),
      }
      const res = await apiAuth("/hr/kpi/monthly-form", { method: "PUT", body })
      if (res && typeof res === "object" && Array.isArray(res.items)) setForm(res)
      else await reload()
      setDrafts((d) => {
        const next = { ...d }
        delete next[activeMonth]
        return next
      })
      toast.success(`บันทึกเดือน ${fyMonthLabel(fy, activeMonth)} แล้ว`, { description: `${nf(activeDirty.length)} รายการ` })
    } catch (e) {
      setSaveErr(errText(e))
    } finally {
      setSaving(false)
    }
  }

  const selfItems = self.data?.items && typeof self.data.items === "object" ? self.data.items : null
  const showSelfCol = perms.selfView && !!selfItems
  const saveLabel = saving ? "กำลังบันทึก…" : `บันทึก ${fyMonthLabel(fy, activeMonth)}`
  const monthOptions = monthOrder.map((m) => ({
    value: String(m),
    label: fyMonthLabel(fy, m),
    sublabel: dirtyOf(m).length ? "ยังไม่บันทึก" : num(form?.month_totals?.[String(m)]) != null ? `รวม ${fmtScore(form.month_totals[String(m)])}` : "ยังไม่มีข้อมูล",
  }))

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end gap-x-6 gap-y-3">
        <div className="w-full sm:w-80">
          <EmployeePicker id="kpi-form-emp" value={empId} onChange={(v) => setEmpId(v)} />
        </div>
        {form && (
          <dl className="flex flex-wrap items-end gap-x-6 gap-y-2">
            <div>
              <dt className="text-xs text-gray-500 dark:text-gray-400">คะแนนส่วนบุคคล</dt>
              <dd className="text-2xl font-semibold tabular-nums text-gray-900 dark:text-gray-50">
                {fmtScore(form.individual_score)}
                <span className="text-sm font-normal text-gray-500 dark:text-gray-400">/100</span>
              </dd>
            </div>
            <div>
              <dt className="text-xs text-gray-500 dark:text-gray-400">บันทึกแล้ว</dt>
              <dd className="text-sm font-medium tabular-nums text-gray-800 dark:text-gray-200">{nf(num(form.months_entered) ?? 0)}/12 เดือน</dd>
            </div>
            {groups.map((g) => (
              <div key={g.group} className="hidden sm:block">
                <dt className="text-xs text-gray-500 dark:text-gray-400">{g.label}</dt>
                <dd className="text-sm font-medium tabular-nums text-gray-800 dark:text-gray-200">
                  {fmtScore(g.average)}<span className="font-normal text-gray-500 dark:text-gray-400">/{fmtScore(g.max)}</span>
                </dd>
              </div>
            ))}
          </dl>
        )}
      </div>

      {phase === "after" && perms.monthlyForm && (
        <Notice tone="warning">ปิดรับแบบประเมินรายเดือนแล้ว ช่วงประเมินสิ้นสุด {fmtDay(info?.window_end)}</Notice>
      )}

      {!empId ? (
        <div className={cx(cardCls, "p-2")}>
          <EmptyState
            title="เลือกเจ้าหน้าที่"
            description="แบบประเมิน 12 รายการ บันทึกทุกเดือน เม.ย.–มี.ค. คะแนนเฉลี่ยของแต่ละรายการรวมเป็นคะแนนส่วนบุคคล (เต็ม 100)"
          />
        </div>
      ) : error ? (
        <ErrorState message={error} onRetry={reload} />
      ) : loading && !form ? (
        <div className={cx(cardCls, "space-y-2 p-4")}>
          {Array.from({ length: 8 }, (_, i) => <Skeleton key={i} className="h-7 w-full" />)}
        </div>
      ) : !form || items.length === 0 ? (
        <div className={cx(cardCls, "p-2")}>
          <EmptyState title="ไม่พบแบบประเมิน" description="ระบบไม่ส่งรายการแบบประเมินกลับมา ลองโหลดใหม่อีกครั้ง" />
        </div>
      ) : isPhone ? (
        <PhoneMonth
          fy={fy}
          groups={groups}
          activeMonth={activeMonth}
          monthOptions={monthOptions}
          monthSelectId={monthSelectId}
          onMonth={(m) => setPickedMonth(Number(m))}
          canEdit={canEdit}
          busy={saving}
          cellValue={cellValue}
          errors={activeErrors}
          onCell={setCell}
          selfItems={showSelfCol ? selfItems : null}
        />
      ) : (
        <GridTable
          fy={fy}
          form={form}
          groups={groups}
          monthOrder={monthOrder}
          activeMonth={activeMonth}
          dirtyMonths={dirtyMonths}
          onMonth={setPickedMonth}
          canEdit={canEdit}
          busy={saving}
          cellValue={cellValue}
          errors={activeErrors}
          onCell={setCell}
          onEnterSave={save}
          selfItems={showSelfCol ? selfItems : null}
        />
      )}

      {form && items.length > 0 && (
        <>
          {saveErr && <Notice tone="error">{saveErr}</Notice>}
          {dirtyMonths.length > 1 && (
            <p className={helpTextCls}>
              ยังไม่บันทึก: {dirtyMonths.map((m) => fyMonthLabel(fy, m)).join(", ")} บันทึกทีละเดือน
            </p>
          )}
          {canEdit && (
            isPhone ? (
              <StickyActionBar
                summary={activeDirty.length ? <>แก้ไข <b className="tabular-nums">{nf(activeDirty.length)}</b> รายการ</> : "ยังไม่มีการแก้ไข"}
                primary={{ label: saveLabel, onClick: save, disabled: saving || hasErrors || activeDirty.length === 0, loading: saving }}
              />
            ) : (
              <div className="flex flex-wrap items-center justify-end gap-3">
                <p className={helpTextCls}>
                  {activeDirty.length
                    ? <>แก้ไข <span className="tabular-nums">{nf(activeDirty.length)}</span> รายการในเดือน {fyMonthLabel(fy, activeMonth)}</>
                    : "เลือกเดือนที่หัวคอลัมน์ แล้วกรอกคะแนน ช่องว่าง = ไม่เปลี่ยน"}
                </p>
                <button
                  type="button"
                  className={primaryBtnCls}
                  onClick={save}
                  disabled={saving || hasErrors || activeDirty.length === 0}
                >
                  <Save aria-hidden="true" className="size-4" strokeWidth={2} />
                  {saveLabel}
                </button>
              </div>
            )
          )}
        </>
      )}
    </div>
  )
}

// ─── Desktop / tablet: 12 items × 12 months ──────────────────────────────────
function GridTable({ fy, form, groups, monthOrder, activeMonth, dirtyMonths, onMonth, canEdit, busy, cellValue, errors, onCell, onEnterSave, selfItems }) {
  const totals = form.month_totals ?? {}
  const flat = groups.flatMap((g) => g.items)
  const colCount = 1 + monthOrder.length + 1 + (selfItems ? 1 : 0)
  const stickyCell = "sticky left-0 z-[1] bg-white dark:bg-gray-800"
  const activeCol = "bg-indigo-50/70 dark:bg-indigo-500/10"

  const focusRow = (idx) => document.getElementById(`kpi-cell-${activeMonth}-${idx}`)?.focus()
  const onKeyDown = (e, idx) => {
    if (e.key === "Enter") {
      e.preventDefault()
      if (idx + 1 < flat.length) focusRow(idx + 1)
      else onEnterSave()
    } else if (e.key === "ArrowDown") { e.preventDefault(); focusRow(Math.min(idx + 1, flat.length - 1)) }
    else if (e.key === "ArrowUp") { e.preventDefault(); focusRow(Math.max(idx - 1, 0)) }
  }

  return (
    <div className={cx(cardCls, "overflow-hidden")}>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[60rem] border-separate border-spacing-0 text-sm">
          <caption className="sr-only">แบบประเมินรายเดือน 12 รายการ ปีบัญชี {fy} คอลัมน์ที่เลือกแก้ไขได้</caption>
          <thead>
            <tr className="bg-gray-50 dark:bg-gray-900/40">
              <th scope="col" className={cx(stickyCell, "!bg-gray-50 dark:!bg-gray-900 w-64 border-b border-gray-200 px-3 py-2 text-left text-xs font-semibold text-gray-500 dark:border-gray-700 dark:text-gray-400")}>
                รายการ
              </th>
              {monthOrder.map((m) => {
                const on = m === activeMonth
                const dirty = dirtyMonths.includes(m)
                return (
                  <th key={m} scope="col" className={cx("border-b border-gray-200 p-1 dark:border-gray-700", on && activeCol)}>
                    <button
                      type="button"
                      aria-pressed={on}
                      onClick={() => onMonth(m)}
                      className={cx(
                        "relative w-full whitespace-nowrap rounded-md px-1.5 py-1 text-xs font-semibold tabular-nums transition-colors duration-200 cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500",
                        on ? "bg-indigo-600 text-white dark:bg-indigo-500" : "text-gray-600 hover:bg-gray-200/70 dark:text-gray-300 dark:hover:bg-gray-700/60",
                      )}
                    >
                      {fyMonthLabel(fy, m)}
                      {dirty && (
                        <>
                          <span aria-hidden="true" className="absolute -right-0.5 -top-0.5 size-2 rounded-full bg-amber-500 ring-2 ring-white dark:ring-gray-900" />
                          <span className="sr-only"> (ยังไม่บันทึก)</span>
                        </>
                      )}
                    </button>
                  </th>
                )
              })}
              <th scope="col" className="border-b border-l border-gray-200 px-3 py-2 text-right text-xs font-semibold text-gray-700 dark:border-gray-700 dark:text-gray-200">เฉลี่ย</th>
              {selfItems && (
                <th scope="col" className="border-b border-gray-200 px-3 py-2 text-right text-xs font-semibold text-gray-500 dark:border-gray-700 dark:text-gray-400">
                  ประเมินตนเอง
                </th>
              )}
            </tr>
          </thead>
          <tbody>
            {groups.map((g) => (
              <Fragment key={g.group}>
                <tr>
                  <th
                    scope="colgroup"
                    colSpan={colCount}
                    className="border-b border-gray-100 bg-gray-50/60 px-3 pb-1.5 pt-3 text-left text-xs font-semibold text-gray-700 dark:border-gray-700/60 dark:bg-gray-900/20 dark:text-gray-200"
                  >
                    <span className="sticky left-3">
                      {g.label}
                      <span className="ml-2 font-normal tabular-nums text-gray-500 dark:text-gray-400">
                        เฉลี่ย {fmtScore(g.average)}/{fmtScore(g.max)}
                      </span>
                    </span>
                  </th>
                </tr>
                {g.items.map((it) => {
                  const idx = flat.indexOf(it)
                  const max = num(it.max)
                  return (
                    <tr key={it.item} className="group">
                      <th scope="row" className={cx(stickyCell, "border-b border-gray-100 px-3 py-1.5 text-left align-middle font-normal dark:border-gray-700/50")}>
                        <span className="flex items-baseline gap-2">
                          <span className="w-7 shrink-0 text-xs tabular-nums text-gray-500 dark:text-gray-400">{it.item}</span>
                          <span className="min-w-0 flex-1 text-gray-800 dark:text-gray-200">{it.label}</span>
                          <span className="shrink-0 text-xs tabular-nums text-gray-500 dark:text-gray-400">/{fmtScore(max)}</span>
                        </span>
                      </th>
                      {monthOrder.map((m) => {
                        const on = m === activeMonth
                        if (on && canEdit) {
                          const id = `kpi-cell-${m}-${idx}`
                          const errMsg = errors[it.item]
                          return (
                            <td key={m} className={cx("border-b border-gray-100 px-1 py-1 align-middle dark:border-gray-700/50", activeCol)}>
                              <input
                                id={id}
                                type="text"
                                inputMode="decimal"
                                autoComplete="off"
                                value={cellValue(it, m)}
                                disabled={busy}
                                onChange={(e) => onCell(it.item, e.target.value.replace(",", "."))}
                                onKeyDown={(e) => onKeyDown(e, idx)}
                                onFocus={(e) => e.target.select()}
                                aria-label={`${it.label} เดือน ${fyMonthLabel(fy, m)} (เต็ม ${fmtScore(max)})`}
                                aria-invalid={errMsg ? true : undefined}
                                title={errMsg ? `ต้องอยู่ระหว่าง ${errMsg}` : undefined}
                                className={cx(cellInput, "!w-14 mx-auto block", errMsg && "!border-red-500 !ring-2 !ring-red-500/20")}
                              />
                            </td>
                          )
                        }
                        const v = num(it.months?.[String(m)])
                        return (
                          <td
                            key={m}
                            className={cx(
                              "border-b border-gray-100 px-2 py-1.5 text-center align-middle tabular-nums dark:border-gray-700/50",
                              on && activeCol,
                              v == null ? "text-gray-300 dark:text-gray-600" : "text-gray-700 dark:text-gray-300",
                            )}
                          >
                            {v == null ? "·" : fmtScore(v)}
                          </td>
                        )
                      })}
                      <td className="border-b border-l border-gray-100 px-3 py-1.5 text-right align-middle font-semibold tabular-nums text-gray-900 dark:border-gray-700/50 dark:text-gray-100">
                        {fmtScore(it.average)}
                      </td>
                      {selfItems && (
                        <td className="border-b border-gray-100 px-3 py-1.5 text-right align-middle tabular-nums text-gray-500 dark:border-gray-700/50 dark:text-gray-400">
                          {fmtScore(selfItems[it.item])}
                        </td>
                      )}
                    </tr>
                  )
                })}
              </Fragment>
            ))}
          </tbody>
          <tfoot>
            <tr className="bg-gray-50 dark:bg-gray-900/40">
              <th scope="row" className={cx(stickyCell, "!bg-gray-50 dark:!bg-gray-900 px-3 py-2 text-left text-xs font-semibold text-gray-700 dark:text-gray-200")}>
                รวมรายเดือน
              </th>
              {monthOrder.map((m) => {
                const t = num(totals[String(m)])
                return (
                  <td key={m} className={cx("px-2 py-2 text-center text-xs font-semibold tabular-nums", m === activeMonth && activeCol, t == null ? "text-gray-300 dark:text-gray-600" : "text-gray-800 dark:text-gray-200")}>
                    {t == null ? "·" : fmtScore(t)}
                  </td>
                )
              })}
              <td className="border-l border-gray-200 px-3 py-2 text-right tabular-nums dark:border-gray-700">
                <span className="text-base font-bold text-indigo-700 dark:text-indigo-300">{fmtScore(form.individual_score)}</span>
              </td>
              {selfItems && <td />}
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  )
}

// ─── Phone: one month at a time as a list ────────────────────────────────────
function PhoneMonth({ fy, groups, activeMonth, monthOptions, monthSelectId, onMonth, canEdit, busy, cellValue, errors, onCell, selfItems }) {
  return (
    <div className="space-y-4">
      <div>
        <span id={monthSelectId} className="mb-1 block text-xs font-medium text-gray-600 dark:text-gray-400">เดือน</span>
        <SelectDropdown
          ariaLabelledby={monthSelectId}
          options={monthOptions}
          value={String(activeMonth)}
          onChange={onMonth}
          showSwatch={false}
          showSublabelInTrigger
        />
      </div>
      {groups.map((g) => (
        <section key={g.group} className={cx(cardCls, "p-3")} aria-labelledby={`kpi-g-${g.group}`}>
          <h3 id={`kpi-g-${g.group}`} className="flex items-baseline justify-between gap-2 text-sm font-semibold text-gray-900 dark:text-gray-100">
            {g.label}
            <span className="text-xs font-normal tabular-nums text-gray-500 dark:text-gray-400">เฉลี่ย {fmtScore(g.average)}/{fmtScore(g.max)}</span>
          </h3>
          <ul className="mt-2 divide-y divide-gray-100 dark:divide-gray-700/60">
            {g.items.map((it) => {
              const max = num(it.max)
              const id = `kpi-m-${it.item}`
              const errMsg = errors[it.item]
              const v = num(it.months?.[String(activeMonth)])
              return (
                <li key={it.item} className="flex items-center gap-3 py-2">
                  <div className="min-w-0 flex-1">
                    <label htmlFor={canEdit ? id : undefined} className="block text-sm text-gray-800 dark:text-gray-200">
                      <span className="tabular-nums text-gray-500 dark:text-gray-400">{it.item}</span> {it.label}
                    </label>
                    <p className="text-xs tabular-nums text-gray-500 dark:text-gray-400">
                      เต็ม {fmtScore(max)} · เฉลี่ย {fmtScore(it.average)}
                      {selfItems && <> · ตนเอง {fmtScore(selfItems[it.item])}</>}
                    </p>
                    {errMsg && <p className="text-xs font-medium text-red-600 dark:text-red-400">ต้องอยู่ระหว่าง {errMsg}</p>}
                  </div>
                  {canEdit ? (
                    <input
                      id={id}
                      type="text"
                      inputMode="decimal"
                      autoComplete="off"
                      value={cellValue(it, activeMonth)}
                      disabled={busy}
                      onChange={(e) => onCell(it.item, e.target.value.replace(",", "."))}
                      aria-invalid={errMsg ? true : undefined}
                      className={cx(baseField, "!h-11 !w-20 !rounded-lg !px-2 !py-0 text-right tabular-nums", errMsg && "!border-red-500")}
                    />
                  ) : (
                    <span className="w-16 text-right tabular-nums text-gray-800 dark:text-gray-200">{v == null ? "—" : fmtScore(v)}</span>
                  )}
                </li>
              )
            })}
          </ul>
        </section>
      ))}
      <p className="text-xs text-gray-500 dark:text-gray-400">เดือน {fyMonthLabel(fy, activeMonth)} · ช่องว่าง = ไม่เปลี่ยน</p>
    </div>
  )
}
