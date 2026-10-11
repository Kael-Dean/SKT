// src/pages/work/buy/BuyCustomerSection.jsx
// ─────────────────────────────────────────────────────────────────────────────
// "ลูกค้า" — buyer type, payment / date / scale ticket, person (search by
// citizen id / member id / name; address + phone in a <details>) or company
// (name / tax id / phone). Phone (<md) = stepper step 1 incl. the form-template
// picker; desktop (≥md, R2) = one compact card — the template picker lives in
// BuySpecSection there. State, refs and handlers arrive in the `form` props-bag.
// ─────────────────────────────────────────────────────────────────────────────
import { useEffect, useRef } from "react"
import { ChevronDown } from "lucide-react"
import ComboBox from "../../../components/ComboBox"
import { Badge, SearchResults } from "../../../components/ui"
import {
  cx, baseField, labelCls, helpTextCls, errorTextCls, cardCls,
  segmentedCls, segmentedItemCls, segmentedItemActiveCls,
} from "../../../lib/styles"
import {
  onlyDigits, validateThaiCitizenId, validateThaiTaxId, focusRefWithRetry, fieldId, errId, describedBy, sectionH2Cls,
} from "./buyShared"
import DateInput from "./DateInput"

export default function BuyCustomerSection({ form }) {
  return form.isPhone ? <PhoneCustomerSection form={form} /> : <DesktopCustomerSection form={form} />
}

/* ═══════════════════════════════ PHONE (<md) — UI-SPEC §3.1 ═══════════════════════════════ */

const phoneLabelCls = "mb-1 block text-sm font-medium leading-relaxed text-gray-600 dark:text-gray-300"
const summaryCls =
  "flex min-h-touch cursor-pointer list-none items-center gap-2 px-4 text-sm text-gray-700 select-none " +
  "dark:text-gray-200 [&::-webkit-details-marker]:hidden"
const addrLine = (parts) => parts.filter(Boolean).join(" ")

/** <details> disclosure for an address block. Uncontrolled so the stepper can
 *  force it open (el.open = true) before scrolling to a field inside. */
function AddressDisclosure({ title, summary, empty, openRef, defaultOpen = false, children }) {
  return (
    <details ref={openRef} open={defaultOpen || undefined} className={cx(cardCls, "group overflow-hidden")}>
      <summary className={summaryCls}>
        <span className="min-w-0 flex-1 truncate">
          <span className="font-medium text-gray-900 dark:text-gray-100">{title}</span>
          <span className="text-gray-500 dark:text-gray-400"> · {summary || "ยังไม่มีข้อมูล"}</span>
        </span>
        {empty && <Badge tone="pending">กรอกเอง</Badge>}
        <ChevronDown aria-hidden="true" className="size-5 shrink-0 text-gray-400 transition-transform duration-150 group-open:rotate-180 dark:text-gray-500" />
      </summary>
      <div className="space-y-3 border-t border-gray-200 px-4 py-4 dark:border-gray-700">{children}</div>
    </details>
  )
}

function PhoneCustomerSection({ form }) {
  const {
    buyerType, setBuyerType,
    templateOptions, formTemplate, onTemplateChange, templateSubLabel,
    paymentOptions, order, setOrder, updateOrder,
    customer, updateCustomer, memberMeta, customerFound, loadingCustomer,
    refs, errors, clearHint, clearError, redFieldCls, redHintCls, onEnter,
    nameBoxRef, nameInputRef, itemRefs,
    showNameList, setShowNameList, nameResults, highlightedIndex, setHighlightedIndex,
    handleNameKeyDown, pickNameResult,
    companyBoxRef, companyInputRef,
    showCompanyList, setShowCompanyList, companyResults, companyHighlighted, setCompanyHighlighted,
    handleCompanyKeyDown, pickCompanyResult,
  } = form

  const addrRef = useRef(null)
  const hqRef = useRef(null)
  const hasAddr = !!(customer.houseNo || customer.moo || customer.subdistrict || customer.district || customer.province)
  const addrComplete = !!(customer.subdistrict && customer.district && customer.province)
  const hasHq = !!(customer.hqHouseNo || customer.hqSubdistrict || customer.hqDistrict || customer.hqProvince)

  // Auto-open when a lookup finished without an address (or nothing matched);
  // auto-close once auto-fill delivered a complete address.
  useEffect(() => {
    const d = addrRef.current
    if (!d || buyerType !== "person") return
    if (customerFound === true && addrComplete) d.open = false
    else if (customerFound === false || (customerFound === true && !hasAddr)) d.open = true
  }, [customerFound, addrComplete, hasAddr, buyerType])
  useEffect(() => {
    const d = hqRef.current
    if (!d || buyerType !== "company") return
    if (memberMeta.type === "company" && hasHq) d.open = false
  }, [memberMeta.type, hasHq, buyerType])

  const statusBadge =
    buyerType !== "person" ? null : memberMeta.type === "member" ? (
      <Badge tone="success">สมาชิก · member_id {memberMeta.memberId ?? "-"}</Badge>
    ) : customerFound === true && memberMeta.type === "customer" ? (
      <Badge tone="info">ลูกค้าทั่วไป · asso {memberMeta.assoId ?? "-"}</Badge>
    ) : memberMeta.type === "customer" ? (
      <Badge tone="neutral">ลูกค้าทั่วไป</Badge>
    ) : null

  const field = (key, label, props = {}, extra = null) => (
    <div>
      <label className={phoneLabelCls} htmlFor={fieldId(key)}>{label}</label>
      <input
        id={fieldId(key)}
        ref={refs[key]}
        className={cx(baseField, redFieldCls(key))}
        value={customer[key]}
        onChange={(e) => { updateCustomer(key, props.digits ? onlyDigits(e.target.value) : e.target.value); clearError(key) }}
        onFocus={() => clearHint(key)}
        onKeyDown={onEnter(key)}
        inputMode={props.inputMode}
        maxLength={props.maxLength}
        placeholder={props.placeholder}
        aria-invalid={errors[key] ? true : undefined}
        aria-describedby={describedBy(errors, key)}
      />
      {extra}
      {errors[key] && <p id={errId(key)} className={errorTextCls}>{errors[key]}</p>}
    </div>
  )

  const addressFields = (prefix, keys) =>
    keys.map(([k, label, ph, extraProps]) => (
      <div key={k}>
        <label className={phoneLabelCls} htmlFor={fieldId(k)}>{label}</label>
        <input
          id={fieldId(k)}
          ref={refs[k]}
          className={baseField}
          value={customer[k]}
          onChange={(e) => updateCustomer(k, extraProps?.digits ? onlyDigits(e.target.value) : extraProps?.tel ? e.target.value.replace(/[^\d+]/g, "") : e.target.value)}
          onFocus={() => clearHint(k)}
          onKeyDown={onEnter(k)}
          inputMode={extraProps?.inputMode}
          maxLength={extraProps?.maxLength}
          placeholder={ph}
        />
      </div>
    ))

  return (
    <div className="space-y-4">
      {/* 1. ประเภทผู้ซื้อ — segmented */}
      <div>
        <div className="mb-1 flex items-center justify-between gap-2">
          <span className={phoneLabelCls + " mb-0"} id="buy-buyerType-label">ประเภทผู้ซื้อ</span>
          {statusBadge}
        </div>
        <div className={segmentedCls} role="radiogroup" aria-labelledby="buy-buyerType-label">
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

      {/* 2. ฟอร์มสำเร็จรูป */}
      <div>
        <div className="mb-1 flex items-center justify-between gap-2">
          <label className={phoneLabelCls + " mb-0"} htmlFor={fieldId("formTemplate")}>ฟอร์มสำเร็จรูป</label>
          {formTemplate && <Badge tone="info">ล็อกสเปคแล้ว</Badge>}
        </div>
        <ComboBox
          id={fieldId("formTemplate")}
          options={templateOptions}
          value={formTemplate}
          getSubLabel={(o) => templateSubLabel(o)}
          onChange={onTemplateChange}
          buttonRef={refs.formTemplate}
          searchable
          placeholder="เลือกฟอร์มสำเร็จรูป"
          title="ฟอร์มสำเร็จรูป"
          ariaLabel="ฟอร์มสำเร็จรูป"
          loading={templateOptions.length === 0}
        />
        <p className={helpTextCls}>ฟอร์มจะล็อกสเปคสินค้าในขั้นถัดไป</p>
      </div>

      {buyerType === "person" ? (
        <>
          {/* 3a เลขบัตรประชาชน */}
          {field("citizenId", "เลขบัตรประชาชน", { inputMode: "numeric", maxLength: 13, digits: true, placeholder: "เช่น 1234567890123" }, (
            <p className={helpTextCls}>
              {loadingCustomer
                ? "กำลังค้นหาลูกค้า…"
                : customer.citizenId.length === 13 && !validateThaiCitizenId(customer.citizenId)
                  ? <span className="text-amber-700 dark:text-amber-300">เลขบัตรอาจไม่ถูกต้อง</span>
                  : "กรอกเพื่อดึงที่อยู่อัตโนมัติ"}
            </p>
          ))}

          {/* 3b รหัสสมาชิก */}
          {field("memberId", "รหัสสมาชิก", { inputMode: "numeric", digits: true, placeholder: "เช่น 100234" }, (
            memberMeta.memberId ? <p className={helpTextCls}>พบสมาชิก: member_id {memberMeta.memberId}</p> : null
          ))}

          {/* 3c ชื่อ-สกุล + ผลค้นหา inline */}
          <div ref={nameBoxRef}>
            <label className={phoneLabelCls} htmlFor="buy-fullName">ชื่อ-สกุล</label>
            <input
              id="buy-fullName"
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
              onKeyDown={handleNameKeyDown}
              placeholder="เช่น นายสมชาย ใจดี"
              aria-expanded={showNameList}
              aria-controls="name-results"
              role="combobox"
              aria-autocomplete="list"
              aria-invalid={errors.fullName ? true : undefined}
              aria-describedby={describedBy(errors, "fullName")}
            />
            {!errors.fullName && <p className={helpTextCls}>พิมพ์แล้วเลือกจากรายชื่อ</p>}
            {errors.fullName && <p id={errId("fullName")} className={errorTextCls}>{errors.fullName}</p>}
            <SearchResults
              open={showNameList && nameResults.length > 0}
              inline
              results={nameResults}
              listId="name-results"
              highlightedIndex={highlightedIndex}
              onHighlight={setHighlightedIndex}
              onPick={(r) => pickNameResult(r)}
              loading={loadingCustomer}
              emptyText="ไม่พบ กรอกข้อมูลเองได้"
              ariaLabel="ผลค้นหาชื่อ"
              renderResult={(r, { active }) => {
                const full = `${r.first_name ?? ""} ${r.last_name ?? ""}`.trim()
                return (
                  <div ref={(el) => (itemRefs.current[nameResults.indexOf(r)] = el)} className={cx(active && "font-medium")}>
                    <div className="truncate text-base">{full || "(ไม่มีชื่อ)"}</div>
                    <div className="truncate text-sm text-gray-500 dark:text-gray-400">
                      {r.type === "member" ? `สมาชิก · member_id ${r.member_id ?? "-"}` : `ลูกค้าทั่วไป · ปชช. ${r.citizen_id ?? "-"}`}
                    </div>
                  </div>
                )
              }}
            />
          </div>

          {/* 3d ที่อยู่ */}
          <AddressDisclosure
            title="ที่อยู่"
            openRef={addrRef}
            empty={!hasAddr}
            summary={hasAddr ? addrLine([customer.houseNo, customer.moo && `ม.${customer.moo}`, customer.subdistrict && `ต.${customer.subdistrict}`, customer.district && `อ.${customer.district}`, customer.province && `จ.${customer.province}`]) : ""}
          >
            {addressFields("", [
              ["houseNo", "บ้านเลขที่", "เช่น 99/1"],
              ["moo", "หมู่", "เช่น 4"],
              ["subdistrict", "ตำบล", "เช่น หนองปลาไหล"],
              ["district", "อำเภอ", "เช่น เมือง"],
              ["province", "จังหวัด", "เช่น สุรินทร์"],
              ["postalCode", "รหัสไปรษณีย์", "เช่น 32000", { inputMode: "numeric", maxLength: 5, digits: true }],
              ["phone", "เบอร์โทร", "เช่น 0812345678", { inputMode: "tel", maxLength: 20, tel: true }],
            ])}
          </AddressDisclosure>
        </>
      ) : (
        <>
          {/* 4a ชื่อบริษัท + ผลค้นหา */}
          <div ref={companyBoxRef}>
            <label className={phoneLabelCls} htmlFor="buy-companyName">ชื่อบริษัท</label>
            <input
              id="buy-companyName"
              ref={(el) => { refs.companyName.current = el; companyInputRef.current = el }}
              className={cx(baseField, redFieldCls("companyName"))}
              value={customer.companyName}
              onChange={(e) => {
                updateCustomer("companyName", e.target.value)
                clearError("companyName")
                if (e.target.value.trim().length >= 2) setShowCompanyList(true)
                else { setShowCompanyList(false); setCompanyHighlighted(-1) }
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
            <SearchResults
              open={showCompanyList && companyResults.length > 0}
              inline
              results={companyResults}
              listId="company-results"
              highlightedIndex={companyHighlighted}
              onHighlight={setCompanyHighlighted}
              onPick={(r) => pickCompanyResult(r)}
              loading={loadingCustomer}
              emptyText="ไม่พบ กรอกข้อมูลเองได้"
              ariaLabel="ผลค้นหาบริษัท"
              renderResult={(r) => (
                <div>
                  <div className="truncate text-base">{r.company_name ?? r.companyName ?? "(ไม่มีชื่อ)"}</div>
                  <div className="truncate text-sm text-gray-500 dark:text-gray-400">ภาษี {r.tax_id ?? "-"} · โทร {r.phone_number ?? "-"}</div>
                </div>
              )}
            />
          </div>

          {field("taxId", "เลขผู้เสียภาษี", { inputMode: "numeric", maxLength: 13, digits: true, placeholder: "13 หลัก" }, !errors.taxId && <p className={helpTextCls}>13 หลัก</p>)}
          {field("companyPhone", "เบอร์โทร", { inputMode: "tel", maxLength: 20, placeholder: "เช่น 044123456" })}

          <AddressDisclosure
            title="สำนักงานใหญ่"
            openRef={hqRef}
            empty={!hasHq}
            summary={hasHq ? addrLine([customer.hqHouseNo, customer.hqMoo && `ม.${customer.hqMoo}`, customer.hqSubdistrict && `ต.${customer.hqSubdistrict}`, customer.hqDistrict && `อ.${customer.hqDistrict}`, customer.hqProvince && `จ.${customer.hqProvince}`]) : ""}
          >
            {addressFields("hq", [
              ["hqHouseNo", "บ้านเลขที่", "เช่น 1"],
              ["hqMoo", "หมู่", "เช่น 2"],
              ["hqSubdistrict", "ตำบล", ""],
              ["hqDistrict", "อำเภอ", ""],
              ["hqProvince", "จังหวัด", ""],
              ["hqPostalCode", "รหัสไปรษณีย์", "", { inputMode: "numeric", maxLength: 5, digits: true }],
            ])}
          </AddressDisclosure>
          <AddressDisclosure
            title="ที่อยู่สาขา"
            summary={customer.brProvince ? addrLine([customer.brHouseNo, customer.brSubdistrict && `ต.${customer.brSubdistrict}`, customer.brDistrict && `อ.${customer.brDistrict}`, customer.brProvince && `จ.${customer.brProvince}`]) : "ไม่บังคับ"}
          >
            {addressFields("br", [
              ["brHouseNo", "บ้านเลขที่", ""],
              ["brMoo", "หมู่", ""],
              ["brSubdistrict", "ตำบล", ""],
              ["brDistrict", "อำเภอ", ""],
              ["brProvince", "จังหวัด", ""],
              ["brPostalCode", "รหัสไปรษณีย์", "", { inputMode: "numeric", maxLength: 5, digits: true }],
            ])}
          </AddressDisclosure>
        </>
      )}

      {/* 5. วิธีชำระเงิน */}
      <div>
        <label className={phoneLabelCls} htmlFor={fieldId("payment")}>วิธีชำระเงิน</label>
        <ComboBox
          id={fieldId("payment")}
          ariaDescribedBy={describedBy(errors, "payment")}
          options={paymentOptions}
          value={order.paymentMethodId || ""}
          onChange={(id, found) => {
            setOrder((p) => ({ ...p, paymentMethod: found?.label ?? "", paymentMethodId: id }))
            clearError("payment")
          }}
          placeholder="เลือกวิธีชำระเงิน"
          buttonRef={refs.payment}
          onEnterNext={() => focusRefWithRetry(refs.paymentRefNo)}
          searchable={false}
          error={!!errors.payment}
          title="วิธีชำระเงิน"
          ariaLabel="วิธีชำระเงิน"
        />
        {errors.payment && <p id={errId("payment")} className={errorTextCls}>{errors.payment}</p>}
      </div>

      {/* 6. ลงวันที่ */}
      <div>
        <label className={phoneLabelCls} htmlFor={fieldId("issueDate")}>ลงวันที่</label>
        <DateInput
          id={fieldId("issueDate")}
          aria-describedby={describedBy(errors, "issueDate")}
          ref={refs.issueDate}
          value={order.issueDate}
          onChange={(e) => setOrder((p) => ({ ...p, issueDate: e.target.value }))}
          onFocus={() => clearHint("issueDate")}
          error={!!errors.issueDate}
          className={redHintCls("issueDate")}
          onKeyDown={onEnter("issueDate")}
          aria-invalid={errors.issueDate ? true : undefined}
        />
        {errors.issueDate && <p id={errId("issueDate")} className={errorTextCls}>{errors.issueDate}</p>}
      </div>

      {/* 7. เลขที่ใบชั่ง */}
      <div>
        <label className={phoneLabelCls} htmlFor={fieldId("paymentRefNo")}>เลขที่ใบชั่ง</label>
        <input
          id={fieldId("paymentRefNo")}
          ref={refs.paymentRefNo}
          className={cx(baseField, redFieldCls("paymentRefNo"))}
          value={order.paymentRefNo}
          onChange={(e) => { updateOrder("paymentRefNo", e.target.value); clearError("paymentRefNo") }}
          onFocus={() => clearHint("paymentRefNo")}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.isComposing) {
              e.preventDefault()
              e.currentTarget.blur()
            }
          }}
          autoCapitalize="characters"
          placeholder="เช่น 011-0000123456"
          aria-invalid={errors.paymentRefNo ? true : undefined}
          aria-describedby={describedBy(errors, "paymentRefNo")}
        />
        {!errors.paymentRefNo && <p className={helpTextCls}>หรือเลขที่ใบเบิกเงิน</p>}
        {errors.paymentRefNo && <p id={errId("paymentRefNo")} className={errorTextCls}>{errors.paymentRefNo}</p>}
      </div>
    </div>
  )
}

/* ═══════════════════════════════ DESKTOP (≥md) — R2 compact card ═══════════════════════════════
 * Header row: title · status chip · buyer-type segmented (←/→).
 * Row: วิธีชำระเงิน | ลงวันที่ | เลขที่ใบชั่ง.  Row: person (บัตร | รหัสสมาชิก | ชื่อ) or
 * company (ชื่อ | เลขผู้เสียภาษี | เบอร์โทร). Person address + phone sit in a closed
 * <details>; the Enter-flow skips them (ชื่อ → คลัง) exactly as before.
 * ═══════════════════════════════════════════════════════════════════════════════════════════════ */

const BUYER_TYPES = [["person", "บุคคลธรรมดา"], ["company", "บริษัท / นิติบุคคล"]]

/** Two-option radiogroup. Roving tabindex; ←/→ (and ↑/↓, Home/End) select + move focus. */
function BuyerTypeSegmented({ value, onChange, firstRef }) {
  const btns = useRef([])
  const onKeyDown = (e) => {
    const keys = ["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown", "Home", "End"]
    if (!keys.includes(e.key)) return
    e.preventDefault()
    const i = Math.max(0, BUYER_TYPES.findIndex(([v]) => v === value))
    const step = e.key === "ArrowLeft" || e.key === "ArrowUp" ? -1 : 1
    const n = e.key === "Home" ? 0 : e.key === "End" ? BUYER_TYPES.length - 1 : (i + step + BUYER_TYPES.length) % BUYER_TYPES.length
    onChange(BUYER_TYPES[n][0])
    btns.current[n]?.focus()
  }
  return (
    <div role="radiogroup" aria-label="ประเภทผู้ซื้อ" className={cx(segmentedCls, "w-auto")} onKeyDown={onKeyDown}>
      {BUYER_TYPES.map(([v, l], i) => (
        <button
          key={v}
          type="button"
          role="radio"
          aria-checked={value === v}
          tabIndex={value === v ? 0 : -1}
          ref={(el) => {
            btns.current[i] = el
            if (i === 0 && firstRef) firstRef.current = el
          }}
          onClick={() => onChange(v)}
          className={cx(segmentedItemCls, "flex-none whitespace-nowrap px-4", value === v && segmentedItemActiveCls)}
        >
          {l}
        </button>
      ))}
    </div>
  )
}

function CustomerStatus({ buyerType, memberMeta }) {
  let tone = "pending"
  let text = "ยังไม่ได้เลือกลูกค้า"
  if (buyerType !== "person") {
    tone = "info"
    text = "บริษัท / นิติบุคคล"
  } else if (memberMeta.type === "member") {
    tone = "success"
    text = memberMeta.memberId ? `สมาชิก · รหัส ${memberMeta.memberId}` : "สมาชิก"
  } else if (memberMeta.type === "customer" && memberMeta.assoId) {
    tone = "info"
    text = "ลูกค้าทั่วไป"
  }
  return (
    <span role="status" aria-live="polite" className="inline-flex">
      <Badge tone={tone}>{text}</Badge>
    </span>
  )
}

const resultListCls =
  "mt-1 max-h-72 w-full overflow-auto rounded-xl bg-white p-1 shadow-lg ring-1 ring-gray-200 " +
  "dark:bg-gray-800 dark:ring-gray-700"
const resultItemCls = (active) =>
  cx(
    "flex w-full flex-col items-start rounded-lg px-3 py-2 text-left cursor-pointer transition-colors duration-150",
    active
      ? "bg-indigo-50 text-gray-900 dark:bg-indigo-500/15 dark:text-gray-100"
      : "text-gray-900 hover:bg-gray-50 dark:text-gray-100 dark:hover:bg-gray-700/60",
  )
const detailsSummaryCls =
  "flex cursor-pointer list-none items-center gap-3 rounded-xl px-3 py-2.5 text-sm select-none " +
  "text-gray-700 hover:bg-gray-50 dark:text-gray-200 dark:hover:bg-gray-700/40 " +
  "focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 [&::-webkit-details-marker]:hidden"

function DesktopCustomerSection({ form }) {
  const {
    buyerType, setBuyerType,
    paymentOptions, order, setOrder, updateOrder,
    customer, updateCustomer, memberMeta, loadingCustomer,
    refs, errors, missingHints, clearHint, clearError, redFieldCls, redHintCls, onEnter,
    nameBoxRef, nameInputRef, listContainerRef, itemRefs,
    showNameList, setShowNameList, nameResults, highlightedIndex, setHighlightedIndex,
    handleNameKeyDown, pickNameResult, scrollHighlightedIntoView2,
    companyBoxRef, companyInputRef, companyItemRefs,
    showCompanyList, setShowCompanyList, companyResults, companyHighlighted, setCompanyHighlighted,
    handleCompanyKeyDown, pickCompanyResult,
  } = form

  const isPerson = buyerType === "person"
  const citizenBad = customer.citizenId.length === 13 && !validateThaiCitizenId(customer.citizenId)
  const taxPartial = customer.taxId.length > 0 && !validateThaiTaxId(customer.taxId)
  const addrText = addrLine([
    customer.houseNo, customer.moo && `ม.${customer.moo}`, customer.subdistrict && `ต.${customer.subdistrict}`,
    customer.district && `อ.${customer.district}`, customer.province && `จ.${customer.province}`, customer.postalCode,
  ])
  const addrSummary = [addrText, customer.phone && `โทร ${customer.phone}`].filter(Boolean).join(" · ")

  /** text input row helper (label + input + help/error), desktop sizing */
  const textField = (key, label, { digits = false, tel = false, inputMode, maxLength, placeholder, help, numeric = false, red = true } = {}) => {
    const helpId = `buy-${key}-help`
    return (
      <div key={key}>
        <label className={labelCls} htmlFor={fieldId(key)}>{label}</label>
        <input
          id={fieldId(key)}
          ref={refs[key]}
          inputMode={inputMode}
          maxLength={maxLength}
          className={cx(baseField, numeric && "tabular-nums", red && redFieldCls(key))}
          value={customer[key]}
          onChange={(e) => {
            const v = e.target.value
            updateCustomer(key, digits ? onlyDigits(v) : tel ? v.replace(/[^\d+]/g, "") : v)
            clearError(key)
          }}
          onFocus={() => clearHint(key)}
          onKeyDown={onEnter(key)}
          placeholder={placeholder}
          aria-invalid={errors[key] ? true : undefined}
          aria-describedby={errors[key] ? errId(key) : help ? helpId : undefined}
        />
        {errors[key]
          ? <p id={errId(key)} className={errorTextCls}>{errors[key]}</p>
          : help ? <p id={helpId} className={helpTextCls}>{help}</p> : null}
      </div>
    )
  }

  return (
    <section aria-labelledby="buy-sec-customer" className={cx(cardCls, "p-5")}>
      {/* หัวการ์ด: ชื่อ · สถานะ · ประเภทผู้ซื้อ */}
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
        <h2 id="buy-sec-customer" className={sectionH2Cls}>ลูกค้า</h2>
        <CustomerStatus buyerType={buyerType} memberMeta={memberMeta} />
        <div className="ml-auto">
          <BuyerTypeSegmented value={buyerType} onChange={(v) => setBuyerType(String(v))} firstRef={refs.buyerType} />
        </div>
      </div>

      {/* วิธีชำระเงิน | ลงวันที่ | เลขที่ใบชั่ง */}
      <div className="mt-4 grid gap-4 md:grid-cols-3">
        <div>
          <label className={labelCls} htmlFor={fieldId("payment")}>วิธีชำระเงิน</label>
          <ComboBox
            id={fieldId("payment")}
            options={paymentOptions}
            value={order.paymentMethodId || ""}
            onChange={(id, found) => {
              setOrder((p) => ({ ...p, paymentMethod: found?.label ?? "", paymentMethodId: id }))
              clearError("payment")
            }}
            placeholder="เลือกวิธีชำระเงิน"
            buttonRef={refs.payment}
            onEnterNext={() => focusRefWithRetry(refs.paymentRefNo)}
            searchable={false}
            error={!!errors.payment}
            hintRed={!!missingHints.payment}
            clearHint={() => clearHint("payment")}
            ariaDescribedBy={describedBy(errors, "payment")}
            title="วิธีชำระเงิน"
            ariaLabel="วิธีชำระเงิน"
          />
          {errors.payment && <p id={errId("payment")} className={errorTextCls}>{errors.payment}</p>}
        </div>

        <div>
          <label className={labelCls} htmlFor={fieldId("issueDate")}>ลงวันที่</label>
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
        </div>

        <div>
          <label className={labelCls} htmlFor={fieldId("paymentRefNo")}>เลขที่ใบชั่ง/ใบเบิกเงิน</label>
          <input
            id={fieldId("paymentRefNo")}
            ref={refs.paymentRefNo}
            className={cx(baseField, redFieldCls("paymentRefNo"))}
            value={order.paymentRefNo}
            onChange={(e) => { updateOrder("paymentRefNo", e.target.value); clearError("paymentRefNo") }}
            onFocus={() => clearHint("paymentRefNo")}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.isComposing) {
                e.preventDefault()
                focusRefWithRetry(refs[isPerson ? "fullName" : "companyName"])
              }
            }}
            placeholder="เช่น 011-0000123456"
            aria-invalid={errors.paymentRefNo ? true : undefined}
            aria-describedby={describedBy(errors, "paymentRefNo")}
          />
          {errors.paymentRefNo && <p id={errId("paymentRefNo")} className={errorTextCls}>{errors.paymentRefNo}</p>}
        </div>
      </div>

      {isPerson ? (
        <>
          {/* เลขบัตร | รหัสสมาชิก | ชื่อ–สกุล */}
          <div className="mt-4 grid gap-4 md:grid-cols-3">
            <div>
              <label className={labelCls} htmlFor={fieldId("citizenId")}>เลขบัตรประชาชน</label>
              <input
                id={fieldId("citizenId")}
                ref={refs.citizenId}
                inputMode="numeric"
                maxLength={13}
                className={cx(baseField, "tabular-nums", (errors.citizenId || citizenBad) && "border-amber-500 dark:border-amber-400")}
                value={customer.citizenId}
                onChange={(e) => updateCustomer("citizenId", onlyDigits(e.target.value))}
                onFocus={() => clearHint("citizenId")}
                placeholder="13 หลัก"
                onKeyDown={onEnter("citizenId")}
                aria-invalid={errors.citizenId ? true : undefined}
                aria-describedby="buy-citizenId-help"
              />
              <p id="buy-citizenId-help" className={helpTextCls} aria-live="polite">
                {loadingCustomer
                  ? "กำลังค้นหา…"
                  : citizenBad
                    ? <span className="text-amber-700 dark:text-amber-300">เลขบัตรอาจไม่ถูกต้อง</span>
                    : null}
              </p>
            </div>

            <div>
              <label className={labelCls} htmlFor={fieldId("memberId")}>รหัสสมาชิก</label>
              <input
                id={fieldId("memberId")}
                ref={refs.memberId}
                inputMode="numeric"
                className={cx(baseField, "tabular-nums", redFieldCls("memberId"))}
                value={customer.memberId}
                onChange={(e) => { updateCustomer("memberId", onlyDigits(e.target.value)); clearError("memberId") }}
                onKeyDown={onEnter("memberId")}
                placeholder="เช่น 100234"
                aria-invalid={errors.memberId ? true : undefined}
                aria-describedby={errors.memberId ? errId("memberId") : memberMeta.memberId ? "buy-memberId-help" : undefined}
              />
              {errors.memberId
                ? <p id={errId("memberId")} className={errorTextCls}>{errors.memberId}</p>
                : memberMeta.memberId
                  ? <p id="buy-memberId-help" className={helpTextCls}>พบสมาชิก รหัส {memberMeta.memberId}</p>
                  : null}
            </div>

            <div ref={nameBoxRef}>
              <label className={labelCls} htmlFor={fieldId("fullName")}>ชื่อ–สกุล</label>
              <input
                id={fieldId("fullName")}
                ref={(el) => {
                  refs.fullName.current = el
                  nameInputRef.current = el
                }}
                className={cx(baseField, redFieldCls("fullName"))}
                value={customer.fullName}
                onChange={(e) => {
                  updateCustomer("fullName", e.target.value)
                  clearError("fullName")
                  if (e.target.value.trim().length >= 2) setShowNameList(true)
                  else { setShowNameList(false); setHighlightedIndex(-1) }
                }}
                onFocus={() => clearHint("fullName")}
                onKeyDown={handleNameKeyDown}
                placeholder="พิมพ์ชื่อเพื่อค้นหา"
                autoComplete="off"
                aria-expanded={showNameList && nameResults.length > 0}
                aria-controls="name-results"
                role="combobox"
                aria-autocomplete="list"
                aria-activedescendant={showNameList && highlightedIndex >= 0 ? `name-opt-${highlightedIndex}` : undefined}
                aria-invalid={errors.fullName ? true : undefined}
                aria-describedby={describedBy(errors, "fullName")}
              />
              {errors.fullName && <p id={errId("fullName")} className={errorTextCls}>{errors.fullName}</p>}

              {showNameList && nameResults.length > 0 && (
                <div id="name-results" ref={listContainerRef} className={resultListCls} role="listbox" aria-label="ผลค้นหาชื่อ">
                  {nameResults.map((r, idx) => {
                    const isActive = idx === highlightedIndex
                    const full = `${r.first_name ?? ""} ${r.last_name ?? ""}`.trim()
                    return (
                      <button
                        type="button"
                        id={`name-opt-${idx}`}
                        tabIndex={-1}
                        ref={(el) => (itemRefs.current[idx] = el)}
                        key={`${r.type}-${r.asso_id}-${r.citizen_id}-${idx}`}
                        onClick={async () => await pickNameResult(r)}
                        onMouseEnter={() => {
                          setHighlightedIndex(idx)
                          requestAnimationFrame(() => scrollHighlightedIntoView2(idx))
                        }}
                        role="option"
                        aria-selected={isActive}
                        className={resultItemCls(isActive)}
                      >
                        <span className="font-medium">{full || "(ไม่มีชื่อ)"}</span>
                        <span className="text-sm tabular-nums text-gray-600 dark:text-gray-300">
                          {r.type === "member" ? `สมาชิก · รหัส ${r.member_id ?? "-"}` : `ลูกค้าทั่วไป · บัตร ${r.citizen_id ?? "-"}`}
                        </span>
                      </button>
                    )
                  })}
                </div>
              )}
            </div>
          </div>

          {/* ที่อยู่ + เบอร์โทร — หุบไว้ (auto-fill จากเลขบัตร/ชื่อ) */}
          <details className="group mt-4 rounded-xl ring-1 ring-gray-200 dark:ring-gray-700">
            <summary className={detailsSummaryCls}>
              <span className="shrink-0 font-medium text-gray-900 dark:text-gray-100">ที่อยู่และเบอร์โทร</span>
              <span className="min-w-0 flex-1 truncate text-gray-500 dark:text-gray-400">{addrSummary || "—"}</span>
              <ChevronDown aria-hidden="true" className="size-4 shrink-0 text-gray-400 transition-transform duration-150 group-open:rotate-180 dark:text-gray-500" />
            </summary>
            <div className="grid gap-4 border-t border-gray-200 p-3 md:grid-cols-4 dark:border-gray-700">
              {textField("houseNo", "บ้านเลขที่", { placeholder: "เช่น 99/1", red: false })}
              {textField("moo", "หมู่", { placeholder: "เช่น 4", red: false })}
              {textField("subdistrict", "ตำบล", { placeholder: "เช่น หนองปลาไหล", red: false })}
              {textField("district", "อำเภอ", { placeholder: "เช่น เมือง", red: false })}
              {textField("province", "จังหวัด", { placeholder: "เช่น สุรินทร์", red: false })}
              {textField("postalCode", "รหัสไปรษณีย์", { inputMode: "numeric", maxLength: 5, digits: true, numeric: true, placeholder: "เช่น 32000", red: false })}
              {textField("phone", "เบอร์โทร", { inputMode: "tel", maxLength: 20, tel: true, numeric: true, placeholder: "เช่น 0812345678", red: false })}
            </div>
          </details>
        </>
      ) : (
        /* ชื่อบริษัท | เลขผู้เสียภาษี | เบอร์โทร */
        <div className="mt-4 grid gap-4 md:grid-cols-3">
          <div ref={companyBoxRef}>
            <label className={labelCls} htmlFor={fieldId("companyName")}>ชื่อบริษัท / นิติบุคคล</label>
            <input
              id={fieldId("companyName")}
              ref={(el) => {
                refs.companyName.current = el
                companyInputRef.current = el
              }}
              className={cx(baseField, redFieldCls("companyName"))}
              value={customer.companyName}
              onChange={(e) => {
                updateCustomer("companyName", e.target.value)
                clearError("companyName")
                if (e.target.value.trim().length >= 2) setShowCompanyList(true)
                else { setShowCompanyList(false); setCompanyHighlighted(-1) }
              }}
              onFocus={() => clearHint("companyName")}
              onKeyDown={handleCompanyKeyDown}
              onKeyDownCapture={onEnter("companyName")}
              placeholder="พิมพ์ชื่อเพื่อค้นหา"
              autoComplete="off"
              aria-expanded={showCompanyList && companyResults.length > 0}
              aria-controls="company-results"
              role="combobox"
              aria-autocomplete="list"
              aria-activedescendant={showCompanyList && companyHighlighted >= 0 ? `company-opt-${companyHighlighted}` : undefined}
              aria-invalid={errors.companyName ? true : undefined}
              aria-describedby={describedBy(errors, "companyName")}
            />
            {errors.companyName && <p id={errId("companyName")} className={errorTextCls}>{errors.companyName}</p>}

            {showCompanyList && companyResults.length > 0 && (
              <div id="company-results" className={resultListCls} role="listbox" aria-label="ผลค้นหาบริษัท">
                {companyResults.map((r, idx) => {
                  const isActive = idx === companyHighlighted
                  return (
                    <button
                      type="button"
                      id={`company-opt-${idx}`}
                      tabIndex={-1}
                      ref={(el) => (companyItemRefs.current[idx] = el)}
                      key={`${r.asso_id}-${r.tax_id}-${idx}`}
                      onClick={async () => await pickCompanyResult(r)}
                      onMouseEnter={() => {
                        setCompanyHighlighted(idx)
                        requestAnimationFrame(() => {
                          try { companyItemRefs.current[idx]?.scrollIntoView({ block: "nearest" }) } catch { /* ignore */ }
                        })
                      }}
                      role="option"
                      aria-selected={isActive}
                      className={resultItemCls(isActive)}
                    >
                      <span className="font-medium">{r.company_name ?? r.companyName ?? "(ไม่มีชื่อ)"}</span>
                      <span className="text-sm tabular-nums text-gray-600 dark:text-gray-300">
                        เลขผู้เสียภาษี {r.tax_id ?? "-"} · โทร {r.phone_number ?? "-"}
                      </span>
                    </button>
                  )
                })}
              </div>
            )}
          </div>

          {textField("taxId", "เลขประจำตัวผู้เสียภาษี", {
            inputMode: "numeric", maxLength: 13, digits: true, numeric: true, placeholder: "13 หลัก",
            help: taxPartial ? `กรอกแล้ว ${customer.taxId.length} จาก 13 หลัก` : "13 หลัก ค้นหาบริษัทให้อัตโนมัติ",
          })}
          {textField("companyPhone", "เบอร์โทร", { inputMode: "tel", maxLength: 20, tel: true, numeric: true, placeholder: "เช่น 044123456", red: false })}
        </div>
      )}
    </section>
  )
}

