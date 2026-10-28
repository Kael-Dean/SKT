// src/pages/work/sales/SalesCustomerSection.jsx
// ─────────────────────────────────────────────────────────────────────────────
// Sales "ลูกค้า" section. The default export is the DESKTOP card (round 2,
// same structure as Buy: header with status + segmented buyer type, payment
// row, credit terms, person/company row).
// The product-form picker moved to SalesSpecSection ("สินค้าและคลัง").
// The named sub-components are the same inputs, exported so
// SalesMobileStepper can lay them out one column at a time while sharing the
// controller's refs and handlers (plan §A2). `form` = props-bag from Sales.jsx.
// ─────────────────────────────────────────────────────────────────────────────
import { useRef } from "react"
import ComboBox from "../../../components/ComboBox"
import Badge from "../../../components/ui/Badge"
import {
  cx, baseField, fieldDisabled, labelCls, helpTextCls, errorTextCls, cardCls,
  segmentedCls, segmentedItemCls, segmentedItemActiveCls,
} from "../../../lib/styles"
import DateInput from "./DateInput"
import { isEnabledInput, isCreditLabel, onlyDigits, buyerTypeOptions, refDocLabel, fieldId, errId, describedBy } from "./salesShared"

/* ---------- status chip next to the heading ---------- */
// Same wording/tones as Buy's CustomerStatus (round 2).
export function CustomerStatusChip({ form }) {
  const { buyerType, memberMeta, customerFound } = form
  let tone = "pending"
  let text = "ยังไม่ได้เลือกลูกค้า"
  if (buyerType !== "person") { tone = "info"; text = "บริษัท / นิติบุคคล" }
  else if (memberMeta.type === "member") { tone = "success"; text = memberMeta.memberId ? `สมาชิก · รหัส ${memberMeta.memberId}` : "สมาชิก" }
  else if (memberMeta.type === "customer" && (customerFound === true || memberMeta.assoId)) { tone = "info"; text = "ลูกค้าทั่วไป" }
  return (
    <span role="status" aria-live="polite" className="inline-flex">
      <Badge tone={tone}>{text}</Badge>
    </span>
  )
}

/* ---------- ฟอร์มสำเร็จรูป ---------- */
export function TemplateCombo({ form, error = false, describedById, title = "ฟอร์มสำเร็จรูป" }) {
  const { templateOptions, formTemplate, setFormTemplate, templateSubLabel, setSelectedTemplateLabel, applyTemplateBySpec, refs } = form
  return (
    <ComboBox
      id={fieldId("formTemplate")}
      error={error}
      ariaDescribedBy={describedById}
      options={templateOptions}
      value={formTemplate}
      // sub-line (ชั้นย่อย) only in the list — the selected form's spec is shown as chips
      getSubLabel={(o) => (String(o.id) === String(formTemplate) ? "" : templateSubLabel(o))}
      onChange={(id, found) => {
        const idStr = String(id)
        setFormTemplate(idStr)
        const label = found?.label ?? ""
        setSelectedTemplateLabel(label)
        try {
          localStorage.setItem("shared.formTemplate", JSON.stringify({ id: idStr, label }))
          localStorage.setItem("sales.formTemplate", idStr)
        } catch {}
        if (found?.spec) applyTemplateBySpec(found.spec)
      }}
      buttonRef={refs.formTemplate}
      searchable
      placeholder="ค้นหา/เลือกฟอร์มสินค้า"
      title={title}
      ariaLabel={title}
      panelMinW={480}
      panelMaxW={640}
      wrapLabels
    />
  )
}

/* ---------- วิธีชำระเงิน ---------- */
/** `describedById`: the caller's error text id (the phone `Field` renders it; desktop shows no payment error text). */
export function PaymentCombo({ form, describedById, desktop = false }) {
  const { paymentOptions, order, setOrder, refs } = form
  return (
    <ComboBox
      id={fieldId("payment")}
      ariaDescribedBy={describedById}
      options={paymentOptions}
      value={paymentOptions.find((o) => o.label === order.paymentMethod)?.id ?? ""}
      onChange={(_id, found) => {
        // Set the cash/credit flag in the same update (not only via the
        // controller effect) so the right ref-doc input is mounted before
        // onEnterNext moves focus into it.
        const label = found?.label ?? ""
        const credit = isCreditLabel(label)
        setOrder((p) => ({ ...p, paymentMethod: label, __isCredit: credit, __isCash: !credit }))
        form.clearError("payment")
      }}
      placeholder="— เลือกวิธีชำระเงิน —"
      buttonRef={refs.payment}
      searchable={false}
      title="วิธีชำระเงิน"
      ariaLabel="วิธีชำระเงิน"
      enterMovesWhenFilled={desktop}
      error={!!form.errors.payment}
      hintRed={!!form.missingHints.payment}
      clearHint={() => form.clearHint("payment")}
      onEnterNext={() => {
        // Only one of the two ref-doc inputs is mounted; `order` here is the
        // pre-pick closure (credit/cash flag not updated yet) → try both refs.
        const tryFocusDoc = () => {
          const el = refs.creditInvoiceNo?.current || refs.cashReceiptNo?.current
          if (el && isEnabledInput(el)) {
            try { el.scrollIntoView({ block: "center" }) } catch {}
            el.focus?.(); try { el.select?.() } catch {}
            return true
          }
          return false
        }
        if (tryFocusDoc()) return
        setTimeout(tryFocusDoc, 60)
        setTimeout(tryFocusDoc, 160)
      }}
    />
  )
}

/* ---------- ลงวันที่ ---------- */
export function IssueDateField({ form }) {
  const { refs, order, setOrder, clearHint, errors, redHintCls, onEnter } = form
  return (
    <>
      <DateInput
        id={fieldId("issueDate")}
        ref={refs.issueDate}
        value={order.issueDate}
        onChange={(e) => setOrder((p) => ({ ...p, issueDate: e.target.value }))}
        onFocus={() => clearHint("issueDate")}
        error={!!errors.issueDate}
        className={redHintCls("issueDate")}
        onKeyDown={onEnter("issueDate")}
        aria-invalid={errors.issueDate ? true : undefined}
        aria-describedby={describedBy(errors, "issueDate")}
      />
      {errors.issueDate && <p id={errId("issueDate")} className={errorTextCls}>{errors.issueDate}</p>}
    </>
  )
}

/* ---------- เอกสารอ้างอิง (ส่งเป็น sale_id) ---------- */
export function RefDocField({ form, mobile = false }) {
  const { refs, order, updateOrder, buyerType, focusNext, focusKlangOrBranchOrTrailer } = form
  const goName = () => {
    // Desktop: forward — credit terms (credit sale) → คลัง → จำนวนรถพ่วง.
    // Phone keeps the original jump to the name field.
    if (!mobile) {
      const credit = refs.deptAllowed?.current
      if (order.__isCredit && credit && isEnabledInput(credit)) { credit.focus(); try { credit.select() } catch { /* ignore */ } return true }
      return focusKlangOrBranchOrTrailer()
    }
    const key = buyerType === "person" ? "fullName" : "companyName"
    const el = refs[key]?.current
    if (el && isEnabledInput(el)) {
      try { el.scrollIntoView({ block: "center" }) } catch {}
      el.focus?.(); try { el.select?.() } catch {}
      return true
    }
    return false
  }
  if (order.__isCredit) {
    return (
      <input
        key="credit"
        id={fieldId("refDoc")}
        ref={refs.creditInvoiceNo}
        className={baseField}
        value={order.creditInvoiceNo}
        onChange={(e) => updateOrder("creditInvoiceNo", e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && !e.isComposing) {
            e.preventDefault()
            if (goName()) return
            const fn = () => focusNext("creditInvoiceNo")
            fn(); setTimeout(fn, 60)
          }
        }}
        placeholder={mobile ? "เช่น INV-2025-000456" : "เช่น INV-2025-000456 (ไม่บังคับ)"}
      />
    )
  }
  if (order.__isCash) {
    return (
      <input
        key="cash"
        id={fieldId("refDoc")}
        ref={refs.cashReceiptNo}
        className={baseField}
        value={order.cashReceiptNo}
        onChange={(e) => updateOrder("cashReceiptNo", e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && !e.isComposing) {
            e.preventDefault()
            if (goName()) return
            const fn = () => focusNext("cashReceiptNo")
            fn(); setTimeout(fn, 60)
          }
        }}
        placeholder={mobile ? "เช่น RC-2025-000789" : "เช่น RC-2025-000789 (ไม่บังคับ)"}
      />
    )
  }
  return <input key="none" id={fieldId("refDoc")} className={cx(baseField, fieldDisabled)} readOnly placeholder={mobile ? "เลือกวิธีชำระเงินก่อน" : "เลือกวิธีชำระเงินก่อน"} />
}

/* ---------- เงื่อนไขเครดิต — 3 fields (card chrome is the caller's) ---------- */
export function CreditTermsFields({ form, mobile = false }) {
  const { refs, dept, setDept, focusKlangOrBranchOrTrailer } = form
  // After the credit terms: phone → ลงวันที่ (original); desktop → คลัง → …
  const after = () => (mobile ? refs.issueDate?.current?.focus() : focusKlangOrBranchOrTrailer())
  const allowedInput = (
    <input
      id={fieldId("deptAllowed")}
      ref={refs.deptAllowed}
      inputMode="numeric"
      className={cx(baseField, !mobile && "text-right tabular-nums")}
      value={String(dept.allowedPeriod ?? 0)}
      onChange={(e) => setDept((p) => ({ ...p, allowedPeriod: Number((e.target.value || '').replace(/\D+/g, '')) }))}
      onKeyDown={(e) => { if (e.key === "Enter" && !e.isComposing) { e.preventDefault(); refs.deptPostpone?.current?.focus(); } }}
      placeholder="เช่น 30"
    />
  )
  const postponeBox = (
    <input
      id={fieldId("deptPostpone")}
      ref={refs.deptPostpone}
      type="checkbox"
      className="size-5 accent-indigo-600"
      checked={!!dept.postpone}
      onChange={(e) => setDept((p) => ({ ...p, postpone: e.target.checked }))}
      onKeyDown={(e) => {
        if (e.key === "Enter" && !e.isComposing) {
          e.preventDefault()
          if (dept.postpone) refs.deptPostponePeriod?.current?.focus()
          else after()
        }
      }}
    />
  )
  const periodLabel = mobile ? "ปลอดดอกเบี้ย (วัน)" : "ระยะปลอดดอกเบี้ย (วัน)"
  const periodInput = (
    <input
      id={fieldId("deptPostponePeriod")}
      ref={refs.deptPostponePeriod}
      inputMode="numeric"
      className={cx(baseField, !mobile && "text-right tabular-nums")}
      value={String(dept.postponePeriod ?? 0)}
      onChange={(e) => setDept((p) => ({ ...p, postponePeriod: Number((e.target.value || '').replace(/\D+/g, '')) }))}
      onKeyDown={(e) => { if (e.key === "Enter" && !e.isComposing) { e.preventDefault(); after() } }}
      placeholder="เช่น 15"
    />
  )

  if (!mobile) {
    // Desktop: one row of 3 — days | checkbox (aligned to the inputs) | period
    return (
      <>
        <div>
          <label className={labelCls} htmlFor={fieldId("deptAllowed")}>กำหนดชำระ (วัน)</label>
          {allowedInput}
        </div>
        <div className="flex md:pt-7">
          <label className="flex min-h-12 cursor-pointer items-center gap-3 text-[15px] text-gray-800 dark:text-gray-200">
            {postponeBox}
            <span>ปลอดดอกเบี้ยชั่วคราว</span>
          </label>
        </div>
        {dept.postpone && (
          <div>
            <label className={labelCls} htmlFor={fieldId("deptPostponePeriod")}>{periodLabel}</label>
            {periodInput}
          </div>
        )}
      </>
    )
  }

  return (
    <>
      <div>
        <label className={labelCls} htmlFor={fieldId("deptAllowed")}>กำหนดชำระ (วัน)</label>
        {allowedInput}
      </div>

      <div>
        <label className="flex min-h-touch cursor-pointer items-center gap-3">
          {postponeBox}
          <span>ปลอดดอกเบี้ยชั่วคราว</span>
        </label>

        {dept.postpone && (
          <div className="mt-3">
            <label className={labelCls} htmlFor={fieldId("deptPostponePeriod")}>{periodLabel}</label>
            {periodInput}
          </div>
        )}
      </div>
    </>
  )
}

/* ---------- บุคคล: บัตร / รหัสสมาชิก / ชื่อ (+ผลค้นหา) ---------- */
export function CitizenIdField({ form }) {
  const { refs, customer, updateCustomer, clearHint, onEnter, loadingCustomer } = form
  return (
    <>
      <input
        id={fieldId("citizenId")}
        ref={refs.citizenId}
        inputMode="numeric" maxLength={13}
        className={cx(baseField)}
        value={customer.citizenId}
        onChange={(e) => updateCustomer("citizenId", onlyDigits(e.target.value))}
        onFocus={() => clearHint("citizenId")}
        placeholder="เช่น 1234567890123"
        onKeyDown={onEnter("citizenId")}
      />
      <div className={helpTextCls}>{loadingCustomer && "กำลังค้นหาลูกค้า..."}</div>
    </>
  )
}

export function MemberIdField({ form }) {
  const { refs, customer, updateCustomer, clearError, onEnter, errors, redFieldCls, memberMeta } = form
  return (
    <>
      <input
        id={fieldId("memberId")}
        ref={refs.memberId}
        inputMode="numeric"
        className={cx(baseField, redFieldCls("memberId"))}
        value={customer.memberId}
        onChange={(e) => { updateCustomer("memberId", onlyDigits(e.target.value)); clearError("memberId") }}
        onKeyDown={onEnter("memberId")}
        placeholder="เช่น 001234" // เปลี่ยนตัวอย่างให้เห็นศูนย์นำหน้า
        aria-invalid={errors.memberId ? true : undefined}
        aria-describedby={describedBy(errors, "memberId")}
      />
      {!!memberMeta.memberId && <p className={helpTextCls}>พบสมาชิก · รหัส {memberMeta.memberId}</p>}
      {errors.memberId && <p id={errId("memberId")} className={errorTextCls}>{errors.memberId}</p>}
    </>
  )
}

/** ชื่อ–สกุล input + inline listbox. Caller wraps in a div with `ref={nameBoxRef}`. */
export function FullNameField({ form, placeholder = "เช่น นายสมชาย ใจดี" }) {
  const {
    refs, nameInputRef, customer, updateCustomer, setShowNameList, setHighlightedIndex,
    clearHint, clearError, handleFullNameKeyDown, showNameList, nameResults, errors, redFieldCls,
    listContainerRef, highlightedIndex, itemRefs, pickNameResult, scrollHighlightedIntoView2,
    focusAfterCustomer,
  } = form
  return (
    <>
      <input
        id={fieldId("fullName")}
        ref={(el) => { refs.fullName.current = el; nameInputRef.current = el }}
        className={cx(baseField, redFieldCls("fullName"))}
        value={customer.fullName}
        onChange={(e) => {
          updateCustomer("fullName", e.target.value)
          clearError("fullName")
          if (e.target.value.trim().length >= 2) setShowNameList(true)
          else { setShowNameList(false); setHighlightedIndex(-1) }
        }}
        onFocus={() => clearHint("fullName")}
        onKeyDown={handleFullNameKeyDown}
        placeholder={placeholder}
        aria-expanded={showNameList}
        aria-controls="name-results"
        role="combobox"
        aria-autocomplete="list"
        aria-invalid={errors.fullName ? true : undefined}
        aria-describedby={describedBy(errors, "fullName")}
      />
      {errors.fullName && <p id={errId("fullName")} className={errorTextCls}>{errors.fullName}</p>}

      {showNameList && nameResults.length > 0 && (
        <div
          id="name-results"
          ref={listContainerRef}
          className={"mt-1 max-h-72 w-full overflow-auto rounded-2xl border border-slate-200 bg-white text-black shadow-sm dark:border-slate-700 dark:bg-slate-800 dark:text-white"}
          role="listbox"
        >
          {nameResults.map((r, idx) => {
            const isActive = idx === highlightedIndex
            const full = `${r.first_name ?? ""} ${r.last_name ?? ""}`.trim()
            return (
              <button
                type="button"
                ref={(el) => (itemRefs.current[idx] = el)}
                key={`${r.type}-${r.asso_id}-${idx}`}
                onClick={async () => {
                  await pickNameResult(r)
                  requestAnimationFrame(() => { focusAfterCustomer() })
                }}
                onMouseEnter={() => { setHighlightedIndex(idx); requestAnimationFrame(() => scrollHighlightedIntoView2(idx)) }}
                role="option"
                aria-selected={isActive}
                className={cx(
                  "relative flex w-full min-h-touch items-start gap-3 px-3 py-2.5 text-left transition rounded-xl cursor-pointer",
                  isActive ? "bg-emerald-100 ring-1 ring-emerald-300 dark:bg-emerald-400/20 dark:ring-emerald-500"
                           : "hover:bg-emerald-50 dark:hover:bg-emerald-900/30"
                )}
              >
                <div className="flex-1">
                  <div className="font-medium">{full || "(ไม่มีชื่อ)"}</div>
                  <div className="text-sm text-slate-600 dark:text-slate-300">
                    {r.type === "member" ? `สมาชิก · รหัส ${r.member_id ?? "-"}` : `ลูกค้าทั่วไป · บัตร ${r.citizen_id ?? "-"}`}
                  </div>
                </div>
              </button>
            )
          })}
        </div>
      )}
    </>
  )
}

/** ชื่อบริษัท input + inline listbox. Caller wraps in a div with `ref={companyBoxRef}`. */
export function CompanyNameField({ form }) {
  const {
    refs, companyInputRef, customer, updateCustomer, buyerType, setShowCompanyList, setCompanyHighlighted,
    clearError, handleCompanyKeyDown, onEnter, showCompanyList, errors, redFieldCls,
    companyResults, companyHighlighted, companyItemRefs, pickCompanyResult,
  } = form
  return (
    <>
      <input
        id={fieldId("companyName")}
        ref={(el) => { refs.companyName.current = el; companyInputRef.current = el }}
        className={cx(baseField, redFieldCls("companyName"))}
        value={customer.companyName}
        onChange={(e) => {
          updateCustomer("companyName", e.target.value)
          clearError("companyName")
          if (buyerType === "company") {
            if (e.target.value.trim().length >= 2) setShowCompanyList(true)
            else { setShowCompanyList(false); setCompanyHighlighted(-1) }
          }
        }}
        onKeyDown={handleCompanyKeyDown}
        onKeyDownCapture={onEnter("companyName")}
        placeholder="เช่น บริษัท ตัวอย่าง จำกัด"
        aria-expanded={showCompanyList}
        aria-controls="company-results"
        role="combobox"
        aria-autocomplete="list"
        aria-invalid={errors.companyName ? true : undefined}
        aria-describedby={describedBy(errors, "companyName")}
      />
      {errors.companyName && <p id={errId("companyName")} className={errorTextCls}>{errors.companyName}</p>}

      {buyerType === "company" && showCompanyList && companyResults.length > 0 && (
        <div
          id="company-results"
          className={"mt-1 max-h-72 w-full overflow-auto rounded-2xl border border-slate-200 bg-white text-black shadow-sm dark:border-slate-700 dark:bg-slate-800 dark:text-white"}
          role="listbox"
        >
          {companyResults.map((r, idx) => {
            const isActive = idx === companyHighlighted
            const name = r.company_name ?? r.companyName ?? "(ไม่มีชื่อ)"
            const tid = r.tax_id ?? "-"
            return (
              <button
                type="button"
                ref={(el) => (companyItemRefs.current[idx] = el)}
                key={`${r.asso_id}-${tid}-${idx}`}
                onClick={async () => await pickCompanyResult(r)}
                onMouseEnter={() => { setCompanyHighlighted(idx); requestAnimationFrame(() => { try { companyItemRefs.current[idx]?.scrollIntoView({ block: "nearest" }) } catch {} }) }}
                role="option"
                aria-selected={isActive}
                className={cx(
                  "relative flex w-full min-h-touch items-start gap-3 px-3 py-2.5 text-left transition rounded-xl cursor-pointer",
                  isActive ? "bg-indigo-100 ring-1 ring-indigo-300 dark:bg-indigo-400/20 dark:ring-indigo-500"
                           : "hover:bg-indigo-50 dark:hover:bg-indigo-900/30"
                )}
              >
                <div className="flex-1">
                  <div className="font-medium">{name}</div>
                  <div className="text-sm text-slate-600 dark:text-slate-300">เลขผู้เสียภาษี {tid} · โทร {r.phone_number ?? "-"}</div>
                </div>
              </button>
            )
          })}
        </div>
      )}
    </>
  )
}

/* ---------- บริษัท: เลขผู้เสียภาษี (บังคับ — salesValidation) + เบอร์โทร ---------- */
export function TaxIdField({ form }) {
  const { refs, customer, updateCustomer, clearError, clearHint, onEnter, errors, redFieldCls } = form
  return (
    <>
      <input
        id={fieldId("taxId")}
        ref={refs.taxId}
        inputMode="numeric"
        maxLength={13}
        className={cx(baseField, "tabular-nums", redFieldCls("taxId"))}
        value={customer.taxId}
        onChange={(e) => { updateCustomer("taxId", onlyDigits(e.target.value)); clearError("taxId") }}
        onFocus={() => clearHint("taxId")}
        onKeyDown={onEnter("taxId")}
        placeholder="13 หลัก"
        aria-invalid={errors.taxId ? true : undefined}
        aria-describedby={describedBy(errors, "taxId")}
      />
      {errors.taxId && <p id={errId("taxId")} className={errorTextCls}>{errors.taxId}</p>}
    </>
  )
}

export function CompanyPhoneField({ form }) {
  const { refs, customer, updateCustomer, onEnter, focusAfterCustomer } = form
  return (
    <input
      id={fieldId("companyPhone")}
      ref={refs.companyPhone}
      type="tel"
      inputMode="tel"
      className={cx(baseField, "tabular-nums")}
      value={customer.companyPhone}
      onChange={(e) => updateCustomer("companyPhone", e.target.value)}
      onKeyDown={(e) => {
        if (e.key === "Enter" && !e.isComposing) { e.preventDefault(); if (!focusAfterCustomer()) onEnter("companyPhone")(e) }
      }}
      placeholder="ไม่บังคับ"
    />
  )
}

/* ---------- ประเภทผู้ซื้อ (desktop segmented, roving tabindex) ---------- */
function BuyerTypeSegmented({ form }) {
  const { buyerType, setBuyerType, refs } = form
  const btnRefs = useRef([])
  const pick = (j) => {
    setBuyerType(buyerTypeOptions[j].id)
    btnRefs.current[j]?.focus()
  }
  const onKeyDown = (e, i) => {
    const n = buyerTypeOptions.length
    if (e.key === "ArrowRight" || e.key === "ArrowDown") { e.preventDefault(); pick((i + 1) % n) }
    else if (e.key === "ArrowLeft" || e.key === "ArrowUp") { e.preventDefault(); pick((i - 1 + n) % n) }
    else if (e.key === "Home") { e.preventDefault(); pick(0) }
    else if (e.key === "End") { e.preventDefault(); pick(n - 1) }
  }
  return (
    <div role="radiogroup" aria-label="ประเภทผู้ซื้อ" className={cx(segmentedCls, "w-auto")}>
      {buyerTypeOptions.map((o, i) => {
        const on = buyerType === o.id
        return (
          <button
            key={o.id}
            type="button"
            role="radio"
            aria-checked={on}
            tabIndex={on ? 0 : -1}
            ref={(el) => { btnRefs.current[i] = el; if (on) refs.buyerType.current = el }}
            onClick={() => setBuyerType(o.id)}
            onKeyDown={(e) => onKeyDown(e, i)}
            className={cx(segmentedItemCls, "flex-none whitespace-nowrap px-4", on && segmentedItemActiveCls)}
          >
            {o.label}
          </button>
        )
      })}
    </div>
  )
}

const sectionTitle = "text-lg font-semibold leading-snug text-gray-900 dark:text-gray-100"

/* ============================ DESKTOP CARD ============================ */
// Round 2: header (title · status · buyer type), person / company row, then
// payment row (+ credit terms). Desktop Enter runs top → bottom through the
// whole page: customer → วิธีชำระเงิน → เอกสารอ้างอิง → [เครดิต] → คลัง → …
export default function SalesCustomerSection({ form }) {
  const { buyerType, order, errors, isCreditPayment, nameBoxRef, companyBoxRef } = form
  return (
    <section aria-labelledby="sales-sec-customer" className={cx(cardCls, "p-5")}>
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
        <h2 id="sales-sec-customer" className={sectionTitle}>ลูกค้า</h2>
        <CustomerStatusChip form={form} />
        <div className="ml-auto">
          <BuyerTypeSegmented form={form} />
        </div>
      </div>

      {buyerType === "person" ? (
        <div className="mt-4 grid gap-4 md:grid-cols-3">
          <div>
            <label className={labelCls} htmlFor={fieldId("citizenId")}>เลขบัตรประชาชน</label>
            <CitizenIdField form={form} />
          </div>
          <div>
            <label className={labelCls} htmlFor={fieldId("memberId")}>รหัสสมาชิก</label>
            <MemberIdField form={form} />
          </div>
          <div ref={nameBoxRef}>
            <label className={labelCls} htmlFor={fieldId("fullName")}>ชื่อ–สกุล</label>
            <FullNameField form={form} placeholder="พิมพ์ชื่อเพื่อค้นหา" />
          </div>
        </div>
      ) : (
        <div className="mt-4 grid gap-4 md:grid-cols-3">
          <div ref={companyBoxRef}>
            <label className={labelCls} htmlFor={fieldId("companyName")}>ชื่อบริษัท / นิติบุคคล</label>
            <CompanyNameField form={form} />
          </div>
          <div>
            <label className={labelCls} htmlFor={fieldId("taxId")}>เลขประจำตัวผู้เสียภาษี</label>
            <TaxIdField form={form} />
          </div>
          <div>
            <label className={labelCls} htmlFor={fieldId("companyPhone")}>เบอร์โทร</label>
            <CompanyPhoneField form={form} />
          </div>
        </div>
      )}

      {/* วิธีชำระเงิน | ลงวันที่ | เอกสารอ้างอิง */}
      <div className="mt-4 grid gap-4 md:grid-cols-3">
        <div>
          <label className={labelCls} htmlFor={fieldId("payment")}>วิธีชำระเงิน</label>
          <PaymentCombo form={form} describedById={describedBy(errors, "payment")} desktop />
          {errors.payment && <p id={errId("payment")} className={errorTextCls}>{errors.payment}</p>}
        </div>
        <div>
          <label className={labelCls} htmlFor={fieldId("issueDate")}>ลงวันที่</label>
          <IssueDateField form={form} />
        </div>
        <div>
          <label className={labelCls} htmlFor={fieldId("refDoc")}>{refDocLabel(order)}</label>
          <RefDocField form={form} />
        </div>
      </div>

      {isCreditPayment() && (
        <div className="mt-4 rounded-xl bg-gray-50 p-4 dark:bg-gray-900/40">
          <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">เงื่อนไขขายเชื่อ</h3>
          <div className="mt-3 grid gap-4 md:grid-cols-3">
            <CreditTermsFields form={form} />
          </div>
        </div>
      )}
    </section>
  )
}
