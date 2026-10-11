// src/pages/work/buy/BuyMobileStepper.jsx
// ─────────────────────────────────────────────────────────────────────────────
// Phone (<md) layout of the Buy page — UI-SPEC §3. Four steps, one section
// mounted at a time (plan §A3), step index in local state (plan §A4):
//   0 ลูกค้า → 1 สเปคและคลัง → 2 ชั่งน้ำหนัก → 3 ตรวจสอบ
// "ถัดไป" runs that step's validator (buyValidation.js) and refuses to move
// while it fails: errors are set on the controller, the Stepper dot turns
// red, a toast lists the missing fields and the first bad field is scrolled
// into view (opening its <details> first). "บันทึกออเดอร์" calls the
// controller's handleSubmit — which reports back through `form.stepApiRef`
// (showErrors / goTo) so a validateAll failure jumps to the right step.
// ─────────────────────────────────────────────────────────────────────────────
import { useEffect, useRef, useState } from "react"
import { Stepper, StickyActionBar, ConfirmDialog, toast } from "../../../components/ui"
import useVisualViewport from "../../../hooks/useVisualViewport"
import { cx, baseField, helpTextCls, focusRingCls } from "../../../lib/styles"
import { STEP_VALIDATORS } from "./buyValidation"
import {
  STEP_KEYS, SPEC_LOCKED_KEYS, ERROR_SCAN_ORDER, describeMissing, thb, nf, moneyToNumber, isEnabledInput,
} from "./buyShared"
import BuyCustomerSection from "./BuyCustomerSection"
import BuySpecSection from "./BuySpecSection"
import BuyWeighSection from "./BuyWeighSection"
import BuySummary from "./BuySummary"

const BUY_STEPS = [
  { key: "customer", label: "ลูกค้า", shortLabel: "ลูกค้า" },
  { key: "spec", label: "สเปคและคลัง", shortLabel: "สเปค" },
  { key: "weigh", label: "ชั่งน้ำหนัก", shortLabel: "ชั่ง" },
  { key: "review", label: "ตรวจสอบ", shortLabel: "ตรวจ" },
]

const INVALID_RE = /ให้ถูกต้อง|ต้องมากกว่า/
const phoneLabelCls = "mb-1 block text-sm font-medium leading-relaxed text-gray-600 dark:text-gray-300"

/** Step index a field key belongs to (locked spec keys point at step 0 — the template) */
const stepOfKey = (key) => {
  if (SPEC_LOCKED_KEYS.includes(key)) return 0
  if (STEP_KEYS.customer.includes(key)) return 0
  if (STEP_KEYS.spec.includes(key)) return 1
  return 2
}

export default function BuyMobileStepper({ form }) {
  const {
    refs, setErrors, buyerType, customer, memberMeta, order, grossFromScale, resolvePaymentId,
    handleSubmit, handleReset, scrollToPageTop, submitting, stepApiRef, resetKey, netWeight, updateOrder,
  } = form
  const [current, setCurrent] = useState(0)
  const [maxReached, setMaxReached] = useState(0)
  const [errorSteps, setErrorSteps] = useState([])
  const [confirmReset, setConfirmReset] = useState(false)
  const { keyboardOpen } = useVisualViewport()
  const firstReset = useRef(true)
  const toastIdRef = useRef(null)

  const ctx = { buyerType, customer, memberMeta, order, grossFromScale, resolvePaymentId }

  /** Scroll + focus a field by ref key; opens an enclosing <details> first. */
  const focusKey = (key) => {
    const el = refs[key]?.current
    if (!el) return false
    const details = el.closest("details")
    if (details && !details.open) details.open = true
    try { el.scrollIntoView({ block: "center", behavior: "smooth" }) } catch { /* ignore */ }
    if (isEnabledInput(el)) el.focus?.({ preventScroll: true })
    return true
  }
  const focusLater = (key) => {
    if (!key) return
    requestAnimationFrame(() => setTimeout(() => focusKey(key), 60))
  }

  const goTo = (i, focus) => {
    const idx = Math.max(0, Math.min(BUY_STEPS.length - 1, i))
    setCurrent(idx)
    setMaxReached((m) => Math.max(m, idx))
    scrollToPageTop()
    focusLater(focus)
  }

  /** Called by the controller after validateAll (step 4 submit) or by a step's
   *  "ถัดไป". Marks steps, toasts, jumps to the first bad step + field. */
  const showErrors = (eObj, { title = "กรอกไม่ครบ", jump = true } = {}) => {
    const scan = ERROR_SCAN_ORDER(buyerType)
    const keys = scan.filter((k) => k in eObj)
    if (keys.length === 0) return
    const steps = [...new Set(keys.map(stepOfKey))].sort()
    setErrorSteps((s) => [...new Set([...s, ...steps])])

    const firstKey = keys[0]
    const targetStep = stepOfKey(firstKey)
    const specMissing = keys.filter((k) => SPEC_LOCKED_KEYS.includes(k))
    const invalidOnly = keys.every((k) => INVALID_RE.test(String(eObj[k])))
    const action = targetStep !== current ? { label: `ไปที่ขั้น ${targetStep + 1}`, onClick: () => goTo(targetStep, firstKey) } : undefined

    if (toastIdRef.current) toast.dismiss(toastIdRef.current)
    if (specMissing.length) {
      toastIdRef.current = toast.error(title, {
        description: `ฟอร์มสำเร็จรูปนี้ยังไม่มี: ${describeMissing(specMissing, "รายการ")}`,
        action: { label: "ไปที่ขั้น 1", onClick: () => goTo(0, "formTemplate") },
      })
    } else if (invalidOnly) {
      toastIdRef.current = toast.error("ข้อมูลไม่ถูกต้อง", { description: String(eObj[firstKey]), action })
    } else {
      toastIdRef.current = toast.error(title, { description: `ยังไม่ได้กรอก: ${describeMissing(keys.filter((k) => !INVALID_RE.test(String(eObj[k]))))}`, action })
    }

    if (jump && targetStep !== current) goTo(targetStep, specMissing.length ? "formTemplate" : firstKey)
    else focusLater(specMissing.length && targetStep === 0 ? "formTemplate" : firstKey)
  }

  // A step's "กรอกไม่ครบ" toast is stale once the user moves to another step.
  const dismissStepToast = () => {
    if (!toastIdRef.current) return
    toast.dismiss(toastIdRef.current)
    toastIdRef.current = null
  }

  // Once a step has been flagged, re-run its validator as the user edits and
  // drop the messages that are now satisfied (auto-fill from a member lookup
  // would otherwise leave "กรุณากรอกชื่อ–สกุล" red over a filled name). Only
  // removes errors — never adds new ones while typing.
  const stepKey = BUY_STEPS[current].key
  const validator = STEP_VALIDATORS[stepKey]
  const liveErrors = validator && errorSteps.includes(current) ? validator(ctx) : null
  const liveSig = liveErrors ? Object.keys(liveErrors).sort().join(",") : ""
  useEffect(() => {
    if (!liveErrors) return
    setErrors((prev) => {
      const stale = STEP_KEYS[stepKey].filter((k) => k in prev && !(k in liveErrors))
      if (!stale.length) return prev
      const nextErrors = { ...prev }
      for (const k of stale) delete nextErrors[k]
      return nextErrors
    })
    if (!liveSig) setErrorSteps((s) => s.filter((i) => i !== current))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [liveSig, current])

  // expose to the controller (handleSubmit → toast/jump instead of alert)
  useEffect(() => {
    if (!stepApiRef) return
    stepApiRef.current = { goTo, showErrors, current }
    return () => { stepApiRef.current = null }
  })

  // handleReset bumps resetKey → back to step 1 (template stays — controller never clears it)
  useEffect(() => {
    if (firstReset.current) { firstReset.current = false; return }
    setCurrent(0)
    setMaxReached(0)
    setErrorSteps([])
    scrollToPageTop()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resetKey])

  const next = () => {
    const stepKey = BUY_STEPS[current].key
    const e = STEP_VALIDATORS[stepKey](ctx)
    setErrors((prev) => {
      const nextErrors = { ...prev }
      for (const k of STEP_KEYS[stepKey]) delete nextErrors[k]
      return { ...nextErrors, ...e }
    })
    if (Object.keys(e).length > 0) {
      setErrorSteps((s) => (s.includes(current) ? s : [...s, current]))
      showErrors(e, { jump: false })
      return
    }
    setErrorSteps((s) => s.filter((i) => i !== current))
    dismissStepToast()
    const n = current + 1
    setMaxReached((m) => Math.max(m, n))
    setCurrent(n)
    scrollToPageTop()
    if (!keyboardOpen) {
      const first = n === 1 ? (order.branchId && !order.klangId ? "klangName" : null) : n === 2 ? "entryWeightKg" : null
      focusLater(first)
    }
  }
  const back = () => { dismissStepToast(); goTo(current - 1) }

  /* ── sticky bar summary per step (copy §2.2) ── */
  const customerName = buyerType === "person" ? customer.fullName.trim() : customer.companyName.trim()
  const amount = moneyToNumber(order.amountTHB)
  const summaryNode = (() => {
    if (current === 0) {
      return customerName ? (
        <p className="truncate"><span className="font-medium text-gray-900 dark:text-gray-100">{customerName}</span>{order.paymentMethod && ` · ${order.paymentMethod}`}</p>
      ) : (
        <p className="text-gray-500 dark:text-gray-400">ยังไม่ได้เลือกลูกค้า</p>
      )
    }
    if (current === 1) {
      return order.riceType ? (
        <p className="truncate"><span className="font-medium text-gray-900 dark:text-gray-100">{order.riceType}</span>{order.klangName && ` · คลัง ${order.klangName}`}</p>
      ) : (
        <p className="text-gray-500 dark:text-gray-400">ยังไม่ได้เลือกสเปค</p>
      )
    }
    if (current === 2) {
      return (
        <p className="flex items-baseline gap-2 tabular-nums">
          <span className="truncate">สุทธิ <b className="text-lg text-gray-900 dark:text-gray-100">{nf(netWeight)}</b> กก.</span>
          {amount > 0 && <span className="ml-auto shrink-0 text-lg font-bold text-gray-900 dark:text-gray-100">{thb(amount)}</span>}
        </p>
      )
    }
    return (
      <p className="flex items-baseline gap-2 tabular-nums">
        <span className="min-w-0 truncate">{customerName || "—"} · สุทธิ {nf(netWeight)} กก.</span>
        <span className="ml-auto shrink-0 text-xl font-bold text-gray-900 dark:text-gray-100">{thb(amount)}</span>
      </p>
    )
  })()

  const isLast = current === BUY_STEPS.length - 1
  const primary = isLast
    ? { label: submitting ? "กำลังบันทึก…" : "บันทึกออเดอร์", onClick: () => handleSubmit(), loading: submitting, disabled: submitting }
    : { label: "ถัดไป", onClick: next, tone: "primary" }
  const secondary = current > 0 ? { label: "ย้อนกลับ", onClick: back, disabled: submitting } : undefined

  return (
    <div>
      <Stepper
        steps={BUY_STEPS}
        current={current}
        maxReached={maxReached}
        errorSteps={errorSteps}
        onSelect={(i) => { if (i <= maxReached) goTo(i) }}
        className="-mx-4 px-4"
      />

      {current === 0 && (
        <div className="mb-3 flex justify-end">
          <button
            type="button"
            onClick={() => setConfirmReset(true)}
            className={cx("inline-flex min-h-touch items-center rounded-lg px-2 text-sm text-gray-500 dark:text-gray-400", focusRingCls)}
          >
            ล้างฟอร์ม
          </button>
        </div>
      )}

      <div className="pt-1">
        {current === 0 && <BuyCustomerSection form={form} />}
        {current === 1 && <BuySpecSection form={{ ...form, onGoToStep: goTo }} />}
        {current === 2 && <BuyWeighSection form={form} />}
        {current === 3 && (
          <div className="space-y-4">
            <BuySummary form={form} onEdit={(i) => goTo(i)} />
            <div>
              <label className={phoneLabelCls} htmlFor="buy-comment">หมายเหตุ</label>
              <textarea
                id="buy-comment"
                ref={refs.comment}
                rows={3}
                className={cx(baseField, "text-base")}
                value={order.comment}
                onChange={(e) => updateOrder("comment", e.target.value)}
                placeholder="ถ้ามี"
              />
              <p className={helpTextCls}>ข้อความนี้จะถูกส่งไปเก็บในออเดอร์ด้วย</p>
            </div>
            <p className="text-xs leading-relaxed text-gray-500 dark:text-gray-400">ตรวจสอบยอดเงินกับเกษตรกรก่อนกดบันทึก</p>
          </div>
        )}
      </div>

      <StickyActionBar summary={summaryNode} primary={primary} secondary={secondary} />

      <ConfirmDialog
        open={confirmReset}
        title="ล้างข้อมูลที่กรอกไว้"
        description="ข้อมูลทุกขั้นจะหายและกลับไปขั้น 1"
        confirmLabel="ล้างฟอร์ม"
        cancelLabel="เก็บไว้"
        tone="danger"
        onConfirm={() => { setConfirmReset(false); handleReset() }}
        onCancel={() => setConfirmReset(false)}
      />
    </div>
  )
}
