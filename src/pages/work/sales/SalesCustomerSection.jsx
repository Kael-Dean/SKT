// src/pages/work/sales/SalesCustomerSection.jsx
// ─────────────────────────────────────────────────────────────────────────────
// Sales "ข้อมูลลูกค้า" card. The default export renders the DESKTOP card with
// the exact DOM the page had before the split (refs / Enter-chain / aria stay
// identical). The named sub-components are the same inputs, exported so
// SalesMobileStepper can lay them out one column at a time while sharing the
// controller's refs and handlers (plan §A2). `form` = props-bag from Sales.jsx.
// ─────────────────────────────────────────────────────────────────────────────
import ComboBox from "../../../components/ComboBox"
import { cx, baseField, fieldDisabled, labelCls, helpTextCls, errorTextCls } from "../../../lib/styles"
import DateInput from "./DateInput"
import { isEnabledInput, onlyDigits, buyerTypeOptions, refDocLabel } from "./salesShared"

/* ---------- status chip next to the heading ---------- */
export function CustomerStatusChip({ form }) {
  const { buyerType, memberMeta, customerFound } = form
  if (buyerType !== "person") {
    return (
      <span className="inline-flex items-center gap-2 rounded-full bg-indigo-50 px-3 py-1.5 text-indigo-700 ring-1 ring-indigo-200 dark:bg-indigo-900/20 dark:text-indigo-200 dark:ring-indigo-700/60 self-start">
        <span className="h-2 w-2 rounded-full bg-indigo-500" />
        บริษัท / นิติบุคคล
      </span>
    )
  }
  if (memberMeta.type === "member") {
    return (
      <span className="inline-flex items-center gap-2 rounded-full bg-emerald-50 px-3 py-1.5 text-emerald-700 ring-1 ring-emerald-200 dark:bg-emerald-900/20 dark:text-emerald-200 dark:ring-emerald-700/60 self-start">
        <span className="h-2 w-2 rounded-full bg-emerald-500" />
        สมาชิก • member_id {memberMeta.memberId ?? "-"}
      </span>
    )
  }
  if (customerFound === true && memberMeta.type === "customer") {
    return (
      <span className="inline-flex items-center gap-2 rounded-full bg-sky-50 px-3 py-1.5 text-sky-700 ring-1 ring-sky-200 dark:bg-sky-900/20 dark:text-sky-200 dark:ring-sky-700/60 self-start">
        <span className="h-2 w-2 rounded-full bg-sky-500" />
        ลูกค้าทั่วไป • asso {memberMeta.assoId ?? "-"}
      </span>
    )
  }
  if (memberMeta.type === "customer") {
    return (
      <span className="inline-flex items-center gap-2 rounded-full bg-slate-100 px-3 py-1.5 text-slate-700 ring-1 ring-slate-200 dark:bg-slate-700/60 dark:text-slate-200 dark:ring-slate-600 self-start">
        <span className="h-2 w-2 rounded-full bg-slate-500" />
        ลูกค้าทั่วไป (เลือกจากรายชื่อเพื่อใช้ asso_id)
      </span>
    )
  }
  return (
    <span className="inline-flex items-center gap-2 rounded-full bg-amber-50 px-3 py-1.5 text-amber-700 ring-1 ring-amber-200 dark:bg-amber-900/20 dark:text-amber-200 dark:ring-amber-700/60 self-start">
      <span className="h-2 w-2 rounded-full bg-amber-500" />
      <span>โปรดกรอก <b>member_id</b> หรือค้นหาชื่อเพื่อเลือกบุคคล</span>
    </span>
  )
}

/* ---------- ประเภทผู้ซื้อ ---------- */
export function BuyerTypeCombo({ form }) {
  const { buyerType, setBuyerType, refs } = form
  return (
    <ComboBox
      options={buyerTypeOptions}
      value={buyerType}
      onChange={(id) => setBuyerType(String(id))}
      buttonRef={refs.buyerType}
      searchable={false}
      title="ประเภทผู้ซื้อ"
      ariaLabel="ประเภทผู้ซื้อ"
    />
  )
}

/* ---------- ฟอร์มสำเร็จรูป ---------- */
export function TemplateCombo({ form }) {
  const { templateOptions, formTemplate, setFormTemplate, templateSubLabel, setSelectedTemplateLabel, applyTemplateBySpec, refs } = form
  return (
    <ComboBox
      options={templateOptions}
      value={formTemplate}
      getSubLabel={(o) => templateSubLabel(o)}
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
      title="ฟอร์มสำเร็จรูป"
      ariaLabel="ฟอร์มสำเร็จรูป"
    />
  )
}

/* ---------- วิธีชำระเงิน ---------- */
export function PaymentCombo({ form }) {
  const { paymentOptions, order, setOrder, refs } = form
  return (
    <ComboBox
      options={paymentOptions}
      value={paymentOptions.find((o) => o.label === order.paymentMethod)?.id ?? ""}
      onChange={(_id, found) => setOrder((p) => ({ ...p, paymentMethod: found?.label ?? "" }))}
      placeholder="— เลือกวิธีชำระเงิน —"
      buttonRef={refs.payment}
      searchable={false}
      title="วิธีชำระเงิน"
      ariaLabel="วิธีชำระเงิน"
      error={!!form.errors.payment}
      hintRed={!!form.missingHints.payment}
      clearHint={() => form.clearHint("payment")}
      onEnterNext={() => {
        const tryFocusDoc = () => {
          const el = order.__isCredit ? refs.creditInvoiceNo?.current : refs.cashReceiptNo?.current
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
        ref={refs.issueDate}
        value={order.issueDate}
        onChange={(e) => setOrder((p) => ({ ...p, issueDate: e.target.value }))}
        onFocus={() => clearHint("issueDate")}
        error={!!errors.issueDate}
        className={redHintCls("issueDate")}
        onKeyDown={onEnter("issueDate")}
        aria-invalid={errors.issueDate ? true : undefined}
      />
      {errors.issueDate && <p className={errorTextCls}>{errors.issueDate}</p>}
    </>
  )
}

/* ---------- เอกสารอ้างอิง (sale_id) ---------- */
export function RefDocField({ form, mobile = false }) {
  const { refs, order, updateOrder, buyerType, focusNext } = form
  const goName = () => {
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
  return <input key="none" className={cx(baseField, fieldDisabled)} readOnly placeholder={mobile ? "เลือกวิธีชำระเงินก่อน" : "โปรดเลือกวิธีชำระเงินก่อน"} />
}

/* ---------- เงื่อนไขเครดิต — 3 fields (card chrome is the caller's) ---------- */
export function CreditTermsFields({ form, mobile = false }) {
  const { refs, dept, setDept } = form
  return (
    <>
      <div>
        <label className={labelCls}>กำหนดชำระ (วัน)</label>
        <input
          ref={refs.deptAllowed}
          inputMode="numeric"
          className={baseField}
          value={String(dept.allowedPeriod ?? 0)}
          onChange={(e) => setDept((p) => ({ ...p, allowedPeriod: Number((e.target.value || '').replace(/\D+/g, '')) }))}
          onKeyDown={(e) => { if (e.key === "Enter" && !e.isComposing) { e.preventDefault(); refs.deptPostpone?.current?.focus(); } }}
          placeholder="เช่น 30"
        />
      </div>

      <div className={mobile ? undefined : "md:col-span-2"}>
        {!mobile && <label className={labelCls}>ตัวเลือก</label>}
        <label className={cx("flex items-center gap-3", mobile && "min-h-touch cursor-pointer")}>
          <input
            ref={refs.deptPostpone}
            type="checkbox"
            className={mobile ? "size-5 accent-indigo-600" : undefined}
            checked={!!dept.postpone}
            onChange={(e) => setDept((p) => ({ ...p, postpone: e.target.checked }))}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.isComposing) {
                e.preventDefault()
                if (dept.postpone) refs.deptPostponePeriod?.current?.focus()
                else refs.issueDate?.current?.focus()
              }
            }}
          />
          <span>{mobile ? "ปลอดดอกเบี้ยชั่วคราว" : "อนุญาตให้ปลอดดอกเบี้ยชั่วคราว"}</span>
        </label>

        {dept.postpone && (
          <div className="mt-3">
            <label className={labelCls}>{mobile ? "ปลอดดอกเบี้ย (วัน)" : "ระยะเวลาปลอดดอกเบี้ย (วัน)"}</label>
            <input
              ref={refs.deptPostponePeriod}
              inputMode="numeric"
              className={baseField}
              value={String(dept.postponePeriod ?? 0)}
              onChange={(e) => setDept((p) => ({ ...p, postponePeriod: Number((e.target.value || '').replace(/\D+/g, '')) }))}
              onKeyDown={(e) => { if (e.key === "Enter" && !e.isComposing) { e.preventDefault(); refs.issueDate?.current?.focus(); } }}
              placeholder="เช่น 15"
            />
          </div>
        )}
      </div>
    </>
  )
}

/* ---------- บุคคล: บัตร / member_id / ชื่อ (+ผลค้นหา) ---------- */
export function CitizenIdField({ form }) {
  const { refs, customer, updateCustomer, clearHint, onEnter, loadingCustomer } = form
  return (
    <>
      <input
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
        ref={refs.memberId}
        inputMode="numeric"
        className={cx(baseField, redFieldCls("memberId"))}
        value={customer.memberId}
        onChange={(e) => updateCustomer("memberId", onlyDigits(e.target.value))}
        onFocus={() => clearError("memberId")}
        onKeyDown={onEnter("memberId")}
        placeholder="เช่น 001234" // เปลี่ยนตัวอย่างให้เห็นศูนย์นำหน้า
        aria-invalid={errors.memberId ? true : undefined}
      />
      {!!memberMeta.memberId && <p className={helpTextCls}>พบสมาชิก: member_id {memberMeta.memberId}</p>}
      {errors.memberId && <p className={errorTextCls}>{errors.memberId}</p>}
    </>
  )
}

/** ชื่อ–สกุล input + inline listbox. Caller wraps in a div with `ref={nameBoxRef}`. */
export function FullNameField({ form }) {
  const {
    refs, nameInputRef, customer, updateCustomer, setShowNameList, setHighlightedIndex,
    clearHint, clearError, handleFullNameKeyDown, showNameList, nameResults, errors, redFieldCls,
    listContainerRef, highlightedIndex, itemRefs, pickNameResult, scrollHighlightedIntoView2,
  } = form
  return (
    <>
      <input
        ref={(el) => { refs.fullName.current = el; nameInputRef.current = el }}
        className={cx(baseField, redFieldCls("fullName"))}
        value={customer.fullName}
        onChange={(e) => {
          updateCustomer("fullName", e.target.value)
          if (e.target.value.trim().length >= 2) setShowNameList(true)
          else { setShowNameList(false); setHighlightedIndex(-1) }
        }}
        onFocus={() => { clearHint("fullName"); clearError("fullName") }}
        onKeyDown={handleFullNameKeyDown}
        placeholder="เช่น นายสมชาย ใจดี"
        aria-expanded={showNameList}
        aria-controls="name-results"
        role="combobox"
        aria-autocomplete="list"
        aria-invalid={errors.fullName ? true : undefined}
      />
      {errors.fullName && <p className={errorTextCls}>{errors.fullName}</p>}

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
                  requestAnimationFrame(() => {
                    const elP = refs.product?.current
                    if (elP && isEnabledInput(elP)) {
                      try { elP.scrollIntoView({ block: "center" }) } catch {}
                      elP.focus?.()
                    }
                  })
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
                    {r.type === "member" ? `สมาชิก • member_id ${r.member_id ?? "-"}` : `ลูกค้าทั่วไป • ปชช. ${r.citizen_id ?? "-"}`}
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
        ref={(el) => { refs.companyName.current = el; companyInputRef.current = el }}
        className={cx(baseField, redFieldCls("companyName"))}
        value={customer.companyName}
        onChange={(e) => {
          updateCustomer("companyName", e.target.value)
          if (buyerType === "company") {
            if (e.target.value.trim().length >= 2) setShowCompanyList(true)
            else { setShowCompanyList(false); setCompanyHighlighted(-1) }
          }
        }}
        onFocus={() => clearError("companyName")}
        onKeyDown={handleCompanyKeyDown}
        onKeyDownCapture={onEnter("companyName")}
        placeholder="เช่น บริษัท ตัวอย่าง จำกัด"
        aria-expanded={showCompanyList}
        aria-controls="company-results"
        role="combobox"
        aria-autocomplete="list"
        aria-invalid={errors.companyName ? true : undefined}
      />
      {errors.companyName && <p className={errorTextCls}>{errors.companyName}</p>}

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
                  <div className="text-sm text-slate-600 dark:text-slate-300">ภาษี {tid} • โทร {r.phone_number ?? "-"}</div>
                </div>
              </button>
            )
          })}
        </div>
      )}
    </>
  )
}

/* ============================ DESKTOP CARD ============================ */
export default function SalesCustomerSection({ form }) {
  const { buyerType, order, isCreditPayment, nameBoxRef, companyBoxRef } = form
  return (
    <div className="mb-6 rounded-2xl border border-slate-200 bg-white p-5 text-black shadow-sm dark:border-slate-700 dark:bg-slate-800 dark:text-white">
      <div className="mb-3 flex flex-wrap items-start gap-2">
        <h2 className="text-xl font-semibold">ข้อมูลลูกค้า</h2>

        <CustomerStatusChip form={form} />

        {/* ประเภทผู้ซื้อ */}
        <div className="ml-auto w-full sm:w-64 self-start">
          <label className={labelCls}>ประเภทผู้ซื้อ</label>
          <BuyerTypeCombo form={form} />
        </div>

        {/* ฟอร์มสำเร็จรูป (จาก BE, โหมดล็อก) */}
        <div className="w-full sm:w-72 self-start">
          <label className={labelCls}>ฟอร์มสำเร็จรูป</label>
          <TemplateCombo form={form} />
          <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
            ระบบ <b>ล็อกสเปกจากฟอร์มสำเร็จรูป</b> เท่านั้น:
            <b> ประเภทสินค้า</b>, <b>ชนิดข้าว</b>, <b>ชั้นย่อย</b>, <b>เงื่อนไข</b>, <b>ประเภทนา</b>, <b>ปี/ฤดูกาล</b>, <b>โปรแกรม</b>, <b>ประเภทธุรกิจ</b> จะไม่สามารถแก้จากแบบฟอร์มด้านล่างได้
          </p>
        </div>
      </div>

      {/* วิธีชำระเงิน + วันที่ + เอกสารอ้างอิง */}
      <div className="grid gap-4 md:grid-cols-3">
        <div>
          <label className={labelCls}>วิธีชำระเงิน</label>
          <PaymentCombo form={form} />
        </div>

        <div>
          <label className={labelCls}>ลงวันที่</label>
          <IssueDateField form={form} />
        </div>

        <div>
          <label className={labelCls}>{refDocLabel(order)}</label>
          <RefDocField form={form} />
          <div className={helpTextCls}>* ค่านี้จะถูกส่งไปหลังบ้านเป็น <code>sale_id</code></div>
        </div>
      </div>

      {/* เงื่อนไขเครดิต */}
      {isCreditPayment() && (
        <div className="md:col-span-3 mt-2">
          <div className="rounded-2xl border border-amber-300 bg-amber-50 p-4 text-amber-900 shadow-sm dark:border-amber-600 dark:bg-amber-900/20 dark:text-amber-100">
            <div className="mb-2 flex items-center gap-2">
              <svg viewBox="0 0 24 24" width="18" height="18" className="opacity-80" fill="currentColor">
                <path d="M3 5a2 2 0 0 0-2 2v2h22V7a2 2 0 0 0 2-2H3zm20 6H1v6a2 2 0 0 0 2 2h18a2 2 0 0 0 2-2v-6zM4 17h6v-2H4v2z"/>
              </svg>
              <div className="font-semibold">รายละเอียดเครดิต (ขายเชื่อ)</div>
            </div>

            <div className="grid gap-4 md:grid-cols-3">
              <CreditTermsFields form={form} />
            </div>

            <p className="mt-2 text-sm opacity-80">
              ค่านี้จะถูกส่งไปหลังบ้านเป็น <code>allowed_period</code>, <code>postpone</code>, <code>postpone_period</code>
            </p>
          </div>
        </div>
      )}

      {/* ส่วนฟอร์มลูกค้า */}
      {buyerType === "person" ? (
        <div className="mt-4 grid gap-4 md:grid-cols-3">
          <div>
            <label className={labelCls}>เลขที่บัตรประชาชน (เพื่อค้นหาที่อยู่)</label>
            <CitizenIdField form={form} />
          </div>
          <div>
            <label className={labelCls}>รหัสสมาชิก (member_id)</label>
            <MemberIdField form={form} />
          </div>
          <div className="md:col-span-1" />
          <div className="md:col-span-2" ref={nameBoxRef}>
            <label className={labelCls}>ชื่อ–สกุล (พิมพ์เพื่อค้นหาอัตโนมัติ)</label>
            <FullNameField form={form} />
          </div>
        </div>
      ) : (
        // ---------------- บริษัท ----------------
        <div className="md:col-span-2" ref={companyBoxRef}>
          <label className={labelCls}>ชื่อบริษัท / นิติบุคคล</label>
          <CompanyNameField form={form} />
        </div>
      )}
    </div>
  )
}
