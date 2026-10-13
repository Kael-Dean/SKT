// src/pages/work/sales/SalesMobileStepper.jsx
// ─────────────────────────────────────────────────────────────────────────────
// Phone (<md) layout of the Sales page — UI-SPEC §4. Four steps, local step
// state (plan §A4):
//   0 ลูกค้า (+เครดิต) → 1 สเปคและคลัง → 2 รถพ่วง (accordion) → 3 ตรวจสอบ
// Step 0/1 mount the same inputs as the desktop sections (same refs → same
// Enter chain inside a step). Step 2 keeps EVERY trailer card body mounted
// (`hidden` when collapsed) so `trailerRefs` stay valid; the controller
// calls `beforeFocusTrailerRef` before focusing a field so the card opens
// first (P6). "ถัดไป" runs that step's validator (salesValidation.js) and
// refuses to move while it fails: errors go to the controller, the Stepper
// dot turns red, a toast lists the missing fields, the first bad field is
// scrolled into view. "บันทึกออเดอร์" calls the controller's handleSubmit,
// which reports back through `form.stepApiRef` ({ showErrors, goTo,
// openTrailer }) so a validateAll failure jumps to the right step.
// ─────────────────────────────────────────────────────────────────────────────
import { useEffect, useMemo, useRef, useState } from "react"
import { ChevronDown } from "lucide-react"
import { Stepper, StickyActionBar, ConfirmDialog, DataList, Badge, toast } from "../../../components/ui"
import {
  cx, labelCls, helpTextCls, errorTextCls, cardCls, sectionTitleCls, neutralBtnCls, secondaryBtnCls,
  segmentedCls, segmentedItemCls, segmentedItemActiveCls, focusRingCls, baseField,
} from "../../../lib/styles"
import { validateCustomer, validateSpec, validateTrailers, trailersHaveErrors, describeErrors, STEP_OF_KEY, TRAILER_ERROR_KEY_ORDER } from "./salesValidation"
import { nf, thb, round2, onlyDigits, refDocLabel, fieldId, errId, describedBy } from "./salesShared"
import {
  CustomerStatusChip, TemplateCombo, PaymentCombo, IssueDateField, RefDocField, CreditTermsFields,
  CitizenIdField, MemberIdField, FullNameField, CompanyNameField,
} from "./SalesCustomerSection"
import { SpecCombos, BranchKlangFields } from "./SalesSpecSection"
import { TrailerCountCombo, TrailerSideFields } from "./SalesTrailerSection"
import { SalesCommentField } from "./SalesSummary"

const STEPS = [
  { key: "customer", label: "ลูกค้า", shortLabel: "ลูกค้า" },
  { key: "spec", label: "สเปคและคลัง", shortLabel: "สเปค" },
  { key: "trailers", label: "รถพ่วง", shortLabel: "รถพ่วง" },
  { key: "review", label: "ตรวจสอบ", shortLabel: "ตรวจ" },
]
const STEP_TOAST_ID = "sales-step-error"
const STEP1_KEYS = ["fullName", "memberId", "companyName", "taxId", "payment", "issueDate"]
const STEP2_KEYS = ["product", "riceType", "subrice", "condition", "fieldType", "riceYear", "businessType", "program", "branchName", "klangName"]

const dash = (v) => (v === undefined || v === null || String(v).trim() === "" ? "—" : v)
const trailerIsEmpty = (t = {}) => Object.values(t).every((v) => String(v ?? "").trim() === "")

/* ---------- small building blocks ---------- */
/** `htmlFor` = the control's id; `errorId` = id for the error text (pair it with the control's aria-describedby). */
function Field({ label, children, hint, error, htmlFor, errorId }) {
  return (
    <div>
      <label className={labelCls} htmlFor={htmlFor}>{label}</label>
      {children}
      {hint && !error && <p className={helpTextCls}>{hint}</p>}
      {error && <p id={errorId} className={errorTextCls}>{error}</p>}
    </div>
  )
}

function ReviewCard({ title, onEdit, children }) {
  return (
    <section className={cx(cardCls, "p-4")}>
      <div className="mb-3 flex items-center justify-between gap-3 border-b border-indigo-100 pb-1 dark:border-indigo-900/40">
        <h3 className={cx(sectionTitleCls, "mb-0 border-b-0 pb-0")}>{title}</h3>
        {onEdit && (
          <button type="button" onClick={onEdit} className={cx("-my-2 min-h-touch px-2 text-sm font-medium text-indigo-600 dark:text-indigo-400", focusRingCls, "rounded-lg")}>
            แก้ไข
          </button>
        )}
      </div>
      {children}
    </section>
  )
}

function Dl({ rows }) {
  return (
    <dl className="grid grid-cols-[minmax(0,7.5rem)_1fr] gap-x-3 gap-y-1.5 text-sm">
      {rows.map(([k, v, cls]) => (
        <div key={k} className="contents">
          <dt className="text-gray-500 dark:text-gray-400">{k}</dt>
          <dd className={cx("min-w-0 truncate text-gray-900 dark:text-gray-100", cls)}>{dash(v)}</dd>
        </div>
      ))}
    </dl>
  )
}

/* ============================ STEPPER ============================ */
export default function SalesMobileStepper({ form }) {
  const {
    refs, errors, setErrors, buyerType, setBuyerType, customer, updateCustomer, memberMeta, order, dept,
    trailers, trailersCount, trailerSummary, formTemplate, templateOptions, selectedTemplateLabel,
    isCreditPayment, resolvePaymentId, handleSubmit, handleReset, scrollToPageTop, submitting,
    stepApiRef, beforeFocusTrailerRef, focusTrailerField, nameBoxRef, companyBoxRef, clearError,
  } = form

  const [current, setCurrent] = useState(0)
  const [maxReached, setMaxReached] = useState(0)
  const [errorSteps, setErrorSteps] = useState([])
  const [openTrailer, setOpenTrailer] = useState(0)
  const [confirmReset, setConfirmReset] = useState(false)
  const bodyRefs = useRef([])

  const ctx = { buyerType, customer, memberMeta, order, trailers, paymentId: resolvePaymentId() }

  // ---------- navigation ----------
  const goTo = (i) => {
    toast.dismiss(STEP_TOAST_ID)
    setCurrent(i)
    setMaxReached((m) => Math.max(m, i))
    requestAnimationFrame(() => scrollToPageTop())
  }
  const markStep = (i, bad) => setErrorSteps((prev) => (bad ? (prev.includes(i) ? prev : [...prev, i]) : prev.filter((x) => x !== i)))

  /** Scroll + focus a field by ref key (opens an enclosing <details> first). */
  const focusKey = (key) => {
    const el = refs[key]?.current
    if (!el) return false
    const details = el.closest("details")
    if (details && !details.open) details.open = true
    try { el.scrollIntoView({ block: "center", behavior: "smooth" }) } catch { /* ignore */ }
    try { el.focus?.({ preventScroll: true }) } catch { /* ignore */ }
    return true
  }
  const focusLater = (fn) => requestAnimationFrame(() => setTimeout(fn, 60))

  // P6: open the trailer card before the controller focuses a field in it.
  useEffect(() => {
    beforeFocusTrailerRef.current = (i) => setOpenTrailer(i)
    return () => { beforeFocusTrailerRef.current = null }
  }, [beforeFocusTrailerRef])

  // ---------- errors → toast + dot + scroll ----------
  const showErrors = (eObj, { jump = false } = {}) => {
    const { text, firstKey, firstTrailer } = describeErrors(eObj, buyerType)
    const stepIdx = firstKey ? STEP_OF_KEY[firstKey] - 1 : firstTrailer != null ? 2 : current
    const badSteps = new Set()
    Object.keys(eObj).forEach((k) => { if (STEP_OF_KEY[k]) badSteps.add(STEP_OF_KEY[k] - 1) })
    setErrorSteps(Array.from(badSteps))
    const sameStep = stepIdx === current
    const willJump = jump && !sameStep
    // Jump BEFORE showing the toast — goTo() dismisses STEP_TOAST_ID.
    if (willJump) goTo(stepIdx)
    const action = !sameStep && !willJump ? { label: `แตะเพื่อไปที่ขั้น ${stepIdx + 1}`, onClick: () => { goTo(stepIdx); focusLater(() => focusFirst(firstKey, firstTrailer, eObj)) } } : undefined
    // Fixed id: repeated presses replace the toast instead of stacking.
    toast.error(jump ? "บันทึกไม่สำเร็จ" : "กรอกไม่ครบ", { id: STEP_TOAST_ID, description: text || undefined, action })
    focusLater(() => focusFirst(firstKey, firstTrailer, eObj))
  }
  const focusFirst = (firstKey, firstTrailer, eObj) => {
    if (firstKey) { focusKey(firstKey); return }
    if (firstTrailer != null) {
      const te = eObj.trailers?.[firstTrailer] || {}
      const k = TRAILER_ERROR_KEY_ORDER.find((x) => x in te && x !== "_net") || "scaleNoFront"
      setOpenTrailer(firstTrailer)
      requestAnimationFrame(() => focusTrailerField(firstTrailer, k))
    }
  }

  // Let the controller (handleSubmit → validateAll) drive the stepper.
  useEffect(() => {
    stepApiRef.current = {
      showErrors: (eObj) => showErrors(eObj, { jump: true }),
      goTo,
      openTrailer: (i) => setOpenTrailer(i),
      reset: () => { setCurrent(0); setMaxReached(0); setErrorSteps([]); setOpenTrailer(0) },
    }
    return () => { stepApiRef.current = null }
  })

  // ---------- per-step "ถัดไป" ----------
  const next = () => {
    let e = {}
    if (current === 0) e = validateCustomer(ctx)
    else if (current === 1) e = validateSpec(ctx)
    else if (current === 2) {
      const tErr = validateTrailers(trailers)
      if (trailersHaveErrors(tErr)) e = { trailers: tErr }
    }
    const keysOfStep = current === 0 ? STEP1_KEYS : current === 1 ? STEP2_KEYS : ["trailers"]
    setErrors((prev) => {
      const rest = { ...prev }
      keysOfStep.forEach((k) => delete rest[k])
      return { ...rest, ...e }
    })
    const bad = Object.keys(e).length > 0
    markStep(current, bad)
    if (bad) { showErrors(e); return }
    goTo(current + 1)
  }
  const back = () => goTo(current - 1)

  // ---------- derived summaries ----------
  const customerName = buyerType === "person" ? customer.fullName : customer.companyName
  const paymentWord = order.paymentMethod ? (isCreditPayment() ? "ขายเชื่อ" : "ขายสด") : ""
  const templateLabel = templateOptions.find((o) => String(o.id) === String(formTemplate))?.label || selectedTemplateLabel
  const totals = trailerSummary.totals
  const n = trailers.length

  const trailerStatus = useMemo(() => {
    const tErr = validateTrailers(trailers)
    return trailers.map((t, i) => {
      const errCount = Object.keys(errors?.trailers?.[i] || {}).length
      if (errCount > 0) return { tone: "danger", text: `${errCount} ช่อง` }
      if (trailerIsEmpty(t)) return { tone: "neutral", text: "ยังไม่ได้กรอก" }
      if (Object.keys(tErr[i] || {}).length === 0) return { tone: "success", text: "ครบ" }
      return { tone: "pending", text: "กรอกบางส่วน" }
    })
  }, [trailers, errors])

  // Once trailer errors are showing, re-validate live so the red text and the
  // "n ช่อง" badge clear as the user fixes each field (phone only).
  const hasTrailerErrors = !!errors?.trailers
  useEffect(() => {
    if (!hasTrailerErrors) return
    const tErr = validateTrailers(trailers)
    setErrors((prev) => {
      const rest = { ...prev }
      if (trailersHaveErrors(tErr)) rest.trailers = tErr
      else delete rest.trailers
      return rest
    })
    if (!trailersHaveErrors(tErr)) markStep(2, false)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [trailers, hasTrailerErrors])

  // Changing the count → open the first trailer that is not complete.
  useEffect(() => {
    const idx = trailerStatus.findIndex((s) => s.tone !== "success")
    setOpenTrailer(idx === -1 ? Math.max(0, trailers.length - 1) : idx)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [trailersCount])

  const summaryStep3 = `${n} คัน · รวม ${nf(totals.net)} กก. · ${thb(totals.amount)}`

  const summaryNode = (() => {
    if (current === 0) {
      return customerName
        ? <div className="flex min-w-0 items-baseline gap-2"><span className="min-w-0 truncate font-medium text-gray-900 dark:text-gray-100">{customerName}</span>{paymentWord && <span className="shrink-0 text-gray-500 dark:text-gray-400">· {paymentWord}</span>}</div>
        : <span className="text-gray-500 dark:text-gray-400">ยังไม่ได้เลือกลูกค้า</span>
    }
    if (current === 1) {
      return order.riceType
        ? <div className="flex min-w-0 items-baseline gap-2"><span className="min-w-0 truncate font-medium text-gray-900 dark:text-gray-100">{order.riceType}</span>{order.klangName && <span className="shrink-0 text-gray-500 dark:text-gray-400">· คลัง {order.klangName}</span>}</div>
        : <span className="text-gray-500 dark:text-gray-400">ยังไม่ได้เลือกสเปค</span>
    }
    return <span className="tabular-nums font-medium text-gray-900 dark:text-gray-100">{summaryStep3}</span>
  })()

  const primary = current < 3
    ? { label: "ถัดไป", onClick: next, tone: "primary" }
    : { label: submitting ? "กำลังบันทึก…" : "บันทึกออเดอร์", onClick: (e) => handleSubmit(e), loading: submitting, disabled: submitting }
  const secondary = current > 0 ? { label: "ย้อนกลับ", onClick: back, disabled: submitting } : undefined

  const doReset = () => {
    setConfirmReset(false)
    handleReset()
    setCurrent(0); setMaxReached(0); setErrorSteps([]); setOpenTrailer(0)
  }

  // ---------- trailer helpers ----------
  const openNextTrailer = (i) => {
    setOpenTrailer(i + 1)
    requestAnimationFrame(() => focusTrailerField(i + 1, "scaleNoFront"))
  }
  const trailerHasBack = (t = {}) => ["backWeightKg", "licensePlateBack", "scaleNoBack", "unitPriceBack", "gramBack"].some((k) => String(t[k] ?? "").trim() !== "")

  return (
    <div className="pb-2">
      <div className="mb-2 flex items-center justify-between gap-3 px-4 pt-3">
        <h1 className="text-xl font-bold text-gray-900 dark:text-gray-100">บันทึกออเดอร์ขาย</h1>
        <button type="button" onClick={() => setConfirmReset(true)} className={cx("-mr-2 min-h-touch px-2 text-sm text-gray-500 dark:text-gray-400", focusRingCls, "rounded-lg")}>
          ล้างฟอร์ม
        </button>
      </div>

      <div className="px-4">
        <Stepper steps={STEPS} current={current} maxReached={maxReached} errorSteps={errorSteps} onSelect={(i) => { if (i <= maxReached) goTo(i) }} />
      </div>

      <form
        onSubmit={(e) => { e.preventDefault(); if (current === 3) handleSubmit(e) }}
        onKeyDown={(e) => { if (submitting && e.key === "Enter") e.preventDefault() }}
        className="space-y-4 p-4"
      >
        {/* ================= STEP 1 — ลูกค้า + เครดิต ================= */}
        {current === 0 && (
          <>
            <section className={cx(cardCls, "space-y-4 p-4")}>
              <div>
                <span className={labelCls}>ประเภทผู้ซื้อ</span>
                <div role="radiogroup" aria-label="ประเภทผู้ซื้อ" className={segmentedCls}>
                  {[["person", "บุคคล"], ["company", "บริษัท"]].map(([v, l], i) => (
                    <button
                      key={v}
                      type="button"
                      role="radio"
                      aria-checked={buyerType === v}
                      ref={i === 0 ? refs.buyerType : undefined}
                      onClick={() => setBuyerType(v)}
                      className={cx(segmentedItemCls, buyerType === v && segmentedItemActiveCls)}
                    >
                      {l}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <div className="mb-1 flex items-center justify-between gap-2">
                  <label className={cx(labelCls, "mb-0")} htmlFor={fieldId("formTemplate")}>ฟอร์มสินค้า</label>
                  {formTemplate && <Badge tone="info">สเปคตามฟอร์ม</Badge>}
                </div>
                <TemplateCombo form={form} title="ฟอร์มสินค้า" />
                <p className={helpTextCls}>สเปคสินค้าจะใช้ตามฟอร์มนี้ · ไม่พบฟอร์มที่ต้องการ? ติดต่อผู้ดูแลระบบ/ฝ่ายบัญชีเพื่อเพิ่มรหัสข้าว</p>
              </div>

              <div><CustomerStatusChip form={form} /></div>

              {buyerType === "person" ? (
                <>
                  <Field label="เลขบัตรประชาชน" htmlFor={fieldId("citizenId")}><CitizenIdField form={form} /></Field>
                  <Field label="รหัสสมาชิก" htmlFor={fieldId("memberId")}><MemberIdField form={form} /></Field>
                  <div ref={nameBoxRef}>
                    <label className={labelCls} htmlFor={fieldId("fullName")}>ชื่อ–สกุล</label>
                    <FullNameField form={form} />
                    {!errors.fullName && <p className={helpTextCls}>พิมพ์ 2 ตัวอักษรเพื่อค้นหา</p>}
                  </div>
                </>
              ) : (
                <>
                  <div ref={companyBoxRef}>
                    <label className={labelCls} htmlFor={fieldId("companyName")}>ชื่อบริษัท / นิติบุคคล</label>
                    <CompanyNameField form={form} />
                    {!errors.companyName && <p className={helpTextCls}>พิมพ์ 2 ตัวอักษรเพื่อค้นหา</p>}
                  </div>
                  <Field label="เลขผู้เสียภาษี" error={errors.taxId} htmlFor={fieldId("taxId")} errorId={errId("taxId")}>
                    <input
                      id={fieldId("taxId")}
                      ref={refs.taxId}
                      inputMode="numeric"
                      maxLength={13}
                      className={cx(baseField, errors.taxId && "border-red-500 ring-2 ring-red-300")}
                      value={customer.taxId}
                      onChange={(e) => { updateCustomer("taxId", onlyDigits(e.target.value)); clearError("taxId") }}
                      placeholder="13 หลัก"
                      aria-invalid={errors.taxId ? true : undefined}
                      aria-describedby={describedBy(errors, "taxId")}
                    />
                  </Field>
                </>
              )}
            </section>

            <section className={cx(cardCls, "space-y-4 p-4")}>
              <Field label="วิธีชำระเงิน" error={errors.payment} htmlFor={fieldId("payment")} errorId={errId("payment")}>
                <PaymentCombo form={form} describedById={describedBy(errors, "payment")} />
              </Field>
              <Field label="ลงวันที่" htmlFor={fieldId("issueDate")}><IssueDateField form={form} /></Field>
              <Field label={refDocLabel(order, true)} hint={order.paymentMethod ? "ไม่บังคับ" : undefined} htmlFor={fieldId("refDoc")}>
                <RefDocField form={form} mobile />
              </Field>
            </section>

            {isCreditPayment() && (
              <section className={cx(cardCls, "space-y-4 p-4")}>
                <h3 className={sectionTitleCls}>เงื่อนไขขายเชื่อ</h3>
                <CreditTermsFields form={form} mobile />
              </section>
            )}
          </>
        )}

        {/* ================= STEP 2 — สเปคและคลัง ================= */}
        {current === 1 && (
          <>
            <section className={cx(cardCls, "p-4")}>
              <div className="mb-2 flex items-center justify-between gap-2">
                <h3 className={cx(sectionTitleCls, "mb-0 border-b-0 pb-0")}>สเปคสินค้า</h3>
                <Badge tone="info">ตามฟอร์ม</Badge>
              </div>
              <p className="mb-3 text-sm font-medium text-gray-900 dark:text-gray-100">ฟอร์ม: {dash(templateLabel)}</p>
              <Dl rows={[
                ["ประเภทสินค้า", order.productName],
                ["ชนิดข้าว", order.riceType],
                ["ชั้นย่อย", order.subriceName],
                ["สภาพ/เงื่อนไข", order.condition],
                ["ประเภทนา", order.fieldType],
                ["ปี/ฤดูกาล", order.riceYear],
                ["ประเภทธุรกิจ", order.businessType],
                ["โปรแกรม", order.programName],
              ]} />
              <button
                type="button"
                onClick={() => { goTo(0); focusLater(() => focusKey("formTemplate")) }}
                className={cx(secondaryBtnCls, "mt-4 h-11 w-full py-0 text-sm")}
              >
                เปลี่ยนฟอร์ม
              </button>
              {/* The 8 locked ComboBoxes stay mounted (refs + force-included `product`). */}
              <details className="mt-3 group">
                <summary className={cx("flex min-h-touch cursor-pointer list-none items-center justify-between gap-2 text-sm text-gray-700 dark:text-gray-200", focusRingCls, "rounded-lg")}>
                  ดูสเปครายตัว
                  <ChevronDown aria-hidden="true" className="size-5 text-gray-400 transition-transform duration-150 group-open:rotate-180 dark:text-gray-500" />
                </summary>
                <div className="mt-2 grid gap-4">
                  <SpecCombos form={form} />
                </div>
              </details>
            </section>

            <section className={cx(cardCls, "p-4")}>
              <h3 className={sectionTitleCls}>สาขาและคลัง</h3>
              <div className="grid gap-4">
                <BranchKlangFields form={form} />
              </div>
            </section>
          </>
        )}

        {/* ================= STEP 3 — รถพ่วง ================= */}
        {current === 2 && (
          <>
            <section className={cx(cardCls, "p-4")}>
              <Field label="จำนวนรถพ่วง" htmlFor={fieldId("trailerCount")}><TrailerCountCombo form={form} /></Field>
            </section>

            <div id="trailers-block" className="space-y-3">
              {trailers.map((t, idx) => {
                const row = trailerSummary.rows[idx]
                const open = openTrailer === idx
                const st = trailerStatus[idx]
                const terr = errors?.trailers?.[idx] || {}
                const bodyId = `trailer-body-${idx}`
                return (
                  <section key={idx} className={cx(cardCls, open && "ring-indigo-300 dark:ring-indigo-500/50")}>
                    <h3 className="m-0">
                      <button
                        type="button"
                        aria-expanded={open}
                        aria-controls={bodyId}
                        onClick={() => setOpenTrailer(open ? -1 : idx)}
                        className={cx("flex min-h-touch w-full items-center gap-3 rounded-2xl px-4 py-3 text-left", focusRingCls)}
                      >
                        <span className="min-w-0 flex-1">
                          <span className="block text-base font-semibold text-gray-900 dark:text-gray-100">คันที่ {idx + 1}</span>
                          <span className="block truncate text-sm tabular-nums text-gray-500 dark:text-gray-400">
                            {row && row.net > 0 ? `${nf(row.net)} กก. · ${thb(row.amount)}` : "ยังไม่ได้กรอก"}
                            {trailerHasBack(t) ? " · หน้า + หลัง" : ""}
                          </span>
                        </span>
                        <Badge tone={st.tone}>{st.text}</Badge>
                        <ChevronDown aria-hidden="true" className={cx("size-5 shrink-0 text-gray-400 transition-transform duration-150 dark:text-gray-500", open && "rotate-180")} />
                      </button>
                    </h3>

                    <div id={bodyId} ref={(el) => (bodyRefs.current[idx] = el)} hidden={!open} className="border-t border-gray-100 px-4 pb-4 pt-3 dark:border-gray-700/70">
                      <div className="mb-2 flex items-center gap-2 text-sm font-semibold text-gray-900 dark:text-gray-100">
                        <span className="inline-flex size-2 rounded-full bg-emerald-500" aria-hidden="true" />
                        พ่วงหน้า
                      </div>
                      <div className="grid gap-3">
                        <TrailerSideFields form={form} idx={idx} side="front" amount={row?.front.amount ?? 0} mobile />
                      </div>

                      <div className="mb-2 mt-5 flex items-center gap-2 text-sm font-semibold text-gray-900 dark:text-gray-100">
                        <span className="inline-flex size-2 rounded-full bg-slate-500" aria-hidden="true" />
                        พ่วงหลัง
                        <span className="text-xs font-normal text-gray-500 dark:text-gray-400">ไม่บังคับ</span>
                      </div>
                      <div className="grid gap-3">
                        <TrailerSideFields form={form} idx={idx} side="back" amount={row?.back.amount ?? 0} mobile />
                      </div>

                      <div className="mt-4 flex items-baseline justify-between gap-3 border-t border-gray-100 pt-3 dark:border-gray-700/70">
                        <span className="text-sm text-gray-500 dark:text-gray-400">รวมคันนี้</span>
                        <span className="text-base font-semibold tabular-nums text-gray-900 dark:text-gray-100">{nf(row?.net ?? 0)} กก. · {thb(row?.amount ?? 0)}</span>
                      </div>
                      {terr._net && <p className={errorTextCls}>{terr._net}</p>}

                      {idx < n - 1 && (
                        <button type="button" onClick={() => openNextTrailer(idx)} className={cx(neutralBtnCls, "mt-3 h-11 w-full")}>
                          ไปคันถัดไป
                        </button>
                      )}
                    </div>
                  </section>
                )
              })}
            </div>
          </>
        )}

        {/* ================= STEP 4 — ตรวจสอบ ================= */}
        {current === 3 && (
          <>
            <ReviewCard title="ลูกค้า" onEdit={() => goTo(0)}>
              <Dl rows={
                buyerType === "person"
                  ? [["ประเภท", "บุคคล"], ["ชื่อ-สกุล", customer.fullName], ["รหัสสมาชิก", memberMeta.memberId || customer.memberId], ["วิธีชำระ", order.paymentMethod], ["ลงวันที่", order.issueDate], [refDocLabel(order, true), order.__isCredit ? order.creditInvoiceNo : order.cashReceiptNo],
                     ...(isCreditPayment() ? [["กำหนดชำระ", `${dept.allowedPeriod} วัน`], ["ปลอดดอกเบี้ย", dept.postpone ? `${dept.postponePeriod} วัน` : "ไม่"]] : [])]
                  : [["ประเภท", "บริษัท"], ["ชื่อบริษัท", customer.companyName], ["เลขผู้เสียภาษี", customer.taxId], ["วิธีชำระ", order.paymentMethod], ["ลงวันที่", order.issueDate], [refDocLabel(order, true), order.__isCredit ? order.creditInvoiceNo : order.cashReceiptNo],
                     ...(isCreditPayment() ? [["กำหนดชำระ", `${dept.allowedPeriod} วัน`], ["ปลอดดอกเบี้ย", dept.postpone ? `${dept.postponePeriod} วัน` : "ไม่"]] : [])]
              } />
            </ReviewCard>

            <ReviewCard title="สเปคและคลัง" onEdit={() => goTo(1)}>
              <Dl rows={[
                ["ฟอร์ม", templateLabel],
                ["ชนิดข้าว", order.riceType],
                ["ชั้นย่อย", order.subriceName],
                ["สภาพ", order.condition],
                ["ประเภทนา", order.fieldType],
                ["ปี/ฤดูกาล", order.riceYear],
                ["ประเภทธุรกิจ", order.businessType],
                ["โปรแกรม", order.programName],
                ["สาขา / คลัง", [order.branchName, order.klangName].filter(Boolean).join(" / ")],
              ]} />
            </ReviewCard>

            <section>
              <h3 className={cx(sectionTitleCls, "px-1")}>รถพ่วง ({n} คัน)</h3>
              <DataList
                items={trailerSummary.rows}
                keyOf={(r) => r.index}
                title={(r) => `คันที่ ${r.index}`}
                subtitle={(r) => `หน้า ${r.front.plate || "—"} · หลัง ${r.back.plate || "—"}`}
                badge={(r) => (trailerStatus[r.index - 1]?.tone === "success" ? <Badge tone="success">ครบ</Badge> : <Badge tone="danger">ขาดข้อมูล</Badge>)}
                fields={[
                  // `value` must be a function — a string is read as an item key by DataList.
                  { label: "นน.หน้า", value: (r) => `${nf(r.front.weight)} กก.`, align: "right" },
                  { label: "นน.หลัง", value: (r) => (r.back.weight > 0 ? `${nf(r.back.weight)} กก.` : "—"), align: "right" },
                  { label: "ราคา/กก.", value: (r) => (r.weightedUnit > 0 ? `${nf(r.weightedUnit)} บ.` : "—"), align: "right" },
                  { label: "เป็นเงิน", value: (r) => thb(r.amount), align: "right", emphasis: true },
                ]}
                onClick={(r) => { setOpenTrailer(r.index - 1); goTo(2) }}
              />
            </section>

            <section className={cx(cardCls, "p-4")}>
              <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
                <div><dt className="text-xs text-gray-500 dark:text-gray-400">รวมพ่วงหน้า</dt><dd className="tabular-nums text-gray-900 dark:text-gray-100">{nf(totals.frontWeight)} กก.</dd></div>
                <div><dt className="text-xs text-gray-500 dark:text-gray-400">รวมพ่วงหลัง</dt><dd className="tabular-nums text-gray-900 dark:text-gray-100">{nf(totals.backWeight)} กก.</dd></div>
                <div><dt className="text-xs text-gray-500 dark:text-gray-400">สุทธิรวม</dt><dd className="font-bold tabular-nums text-gray-900 dark:text-gray-100">{nf(totals.net)} กก.</dd></div>
                <div><dt className="text-xs text-gray-500 dark:text-gray-400">ราคาเฉลี่ย (บ./กก.)</dt><dd className="tabular-nums text-gray-900 dark:text-gray-100">{totals.weightedUnit > 0 ? nf(round2(totals.weightedUnit)) : "—"}</dd></div>
                <div><dt className="text-xs text-gray-500 dark:text-gray-400">คุณภาพเฉลี่ย (กรัม)</dt><dd className="tabular-nums text-gray-900 dark:text-gray-100">{totals.weightedGram > 0 ? totals.weightedGram : "—"}</dd></div>
                <div className="col-span-2 mt-1 border-t border-gray-100 pt-2 text-right dark:border-gray-700/70">
                  <dt className="text-xs text-gray-500 dark:text-gray-400">เป็นเงินรวม</dt>
                  <dd className="text-2xl font-bold tabular-nums text-gray-900 dark:text-gray-100">{thb(totals.amount)}</dd>
                </div>
              </dl>
            </section>

            <section className={cx(cardCls, "p-4")}>
              <SalesCommentField form={form} mobile />
              <p className="mt-3 text-xs text-gray-500 dark:text-gray-400">ตรวจสอบยอดเงินกับลูกค้าก่อนกดบันทึก</p>
            </section>
          </>
        )}

        <StickyActionBar summary={summaryNode} primary={primary} secondary={secondary} />
      </form>

      <ConfirmDialog
        open={confirmReset}
        title="ล้างข้อมูลที่กรอกไว้"
        description="ข้อมูลทุกขั้นจะหายและกลับไปขั้น 1"
        confirmLabel="ล้างฟอร์ม"
        cancelLabel="เก็บไว้"
        tone="danger"
        onConfirm={doReset}
        onCancel={() => setConfirmReset(false)}
      />
    </div>
  )
}
