// src/pages/work/buy/BuyCustomerSection.jsx
// ─────────────────────────────────────────────────────────────────────────────
// "ข้อมูลลูกค้า" — buyer type, form template, payment / date / scale ticket,
// person (search by citizen id / member id / name + address) or company
// (search by name / tax id). Markup is the desktop card moved verbatim out of
// Buy.jsx; all state, refs and handlers arrive in the `form` props-bag.
// ─────────────────────────────────────────────────────────────────────────────
import { useEffect, useRef } from "react"
import { ChevronDown } from "lucide-react"
import ComboBox from "../../../components/ComboBox"
import { Badge, SearchResults } from "../../../components/ui"
import {
  cx, baseField, labelCls, helpTextCls, errorTextCls, compactInput, cardCls,
  segmentedCls, segmentedItemCls, segmentedItemActiveCls,
} from "../../../lib/styles"
import { onlyDigits, validateThaiCitizenId, validateThaiTaxId, focusRefWithRetry, fieldId, errId, describedBy } from "./buyShared"
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

/* ═══════════════════════════════ DESKTOP (≥md) — unchanged tree ═══════════════════════════════ */

function DesktopCustomerSection({ form }) {
  const {
    buyerType, setBuyerType, buyerTypeOptions,
    templateOptions, formTemplate, onTemplateChange, templateSubLabel,
    paymentOptions, order, setOrder, updateOrder,
    customer, updateCustomer, memberMeta, customerFound, loadingCustomer,
    refs, errors, clearHint, clearError, redFieldCls, redHintCls, onEnter,
    nameBoxRef, nameInputRef, listContainerRef, itemRefs,
    showNameList, setShowNameList, nameResults, highlightedIndex, setHighlightedIndex,
    handleNameKeyDown, pickNameResult, scrollHighlightedIntoView2,
    companyBoxRef, companyInputRef, companyItemRefs,
    showCompanyList, setShowCompanyList, companyResults, companyHighlighted, setCompanyHighlighted,
    handleCompanyKeyDown, pickCompanyResult,
  } = form

  return (
    <div className="mb-6 rounded-2xl border border-slate-200 bg-white p-5 text-black shadow-sm dark:border-slate-700 dark:bg-slate-800 dark:text-white">
      {/* แถบหัวข้อ + สถานะ + ดรอปดาวฟอร์ม + ประเภทผู้ซื้อ */}
      <div className="mb-3 flex flex-wrap items-start gap-2">
        <h2 className="text-xl font-semibold">ข้อมูลลูกค้า</h2>

        {/* Badge สถานะ — เฉพาะโหมดบุคคล */}
        {buyerType === "person" ? (
          memberMeta.type === "member" ? (
            <span className="inline-flex items-center gap-2 rounded-full bg-emerald-50 px-3 py-1.5 text-emerald-700 ring-1 ring-emerald-200 dark:bg-emerald-900/20 dark:text-emerald-200 dark:ring-emerald-700/60 self-start">
              <span className="h-2 w-2 rounded-full bg-emerald-500" />
              สมาชิก • member_id {memberMeta.memberId ?? "-"}
            </span>
          ) : customerFound === true && memberMeta.type === "customer" ? (
            <span className="inline-flex items-center gap-2 rounded-full bg-sky-50 px-3 py-1.5 text-sky-700 ring-1 ring-sky-200 dark:bg-sky-900/20 dark:text-sky-200 dark:ring-sky-700/60 self-start">
              <span className="h-2 w-2 rounded-full bg-sky-500" />
              ลูกค้าทั่วไป • asso {memberMeta.assoId ?? "-"}
            </span>
          ) : memberMeta.type === "customer" ? (
            <span className="inline-flex items-center gap-2 rounded-full bg-slate-100 px-3 py-1.5 text-slate-700 ring-1 ring-slate-200 dark:bg-slate-700/60 dark:text-slate-200 dark:ring-slate-600 self-start">
              <span className="h-2 w-2 rounded-full bg-slate-500" />
              ลูกค้าทั่วไป (เลือกจากรายชื่อเพื่อใช้ asso_id)
            </span>
          ) : (
            <span className="inline-flex items-center gap-2 rounded-full bg-amber-50 px-3 py-1.5 text-amber-700 ring-1 ring-amber-200 dark:bg-amber-900/20 dark:text-amber-200 dark:ring-amber-700/60 self-start">
              <span className="h-2 w-2 rounded-full bg-amber-500" />
              โปรดกรอก <b>member_id</b> หรือค้นหาชื่อเพื่อเลือกบุคคล
            </span>
          )
        ) : (
          <span className="inline-flex items-center gap-2 rounded-full bg-indigo-50 px-3 py-1.5 text-indigo-700 ring-1 ring-indigo-200 dark:bg-indigo-900/20 dark:text-indigo-200 dark:ring-indigo-700/60 self-start">
            <span className="h-2 w-2 rounded-full bg-indigo-500" />
            บริษัท / นิติบุคคล
          </span>
        )}

        {/* ดรอปดาว: ประเภทผู้ซื้อ */}
        <div className="ml-auto w-full sm:w-64 self-start">
          <label className={labelCls} htmlFor={fieldId("buyerType")}>ประเภทผู้ซื้อ</label>
          <ComboBox
            id={fieldId("buyerType")}
            options={buyerTypeOptions}
            value={buyerType}
            onChange={(id) => setBuyerType(String(id))}
            buttonRef={refs.buyerType}
            searchable={false}
            title="ประเภทผู้ซื้อ"
            ariaLabel="ประเภทผู้ซื้อ"
          />
        </div>

        {/* ดรอปดาวฟอร์มสำเร็จรูป (มุมขวา) — โหลดจาก BE (โหมดล็อกสเปก) */}
        <div className="w-full sm:w-72 self-start">
          <label className={labelCls} htmlFor={fieldId("formTemplate")}>ฟอร์มสำเร็จรูป</label>
          <ComboBox
            id={fieldId("formTemplate")}
            options={templateOptions}
            value={formTemplate}
            /** ⭐ เพิ่มบรรทัดย่อยใต้ชื่อ: ชื่อชั้นย่อยของ template */
            getSubLabel={(o) => templateSubLabel(o)}
            onChange={onTemplateChange}
            buttonRef={refs.formTemplate}
            searchable
            title="ฟอร์มสำเร็จรูป"
            ariaLabel="ฟอร์มสำเร็จรูป"
          />

          <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
            ระบบ <b>ล็อกสเปกจากฟอร์มสำเร็จรูป</b> เท่านั้น:
            <b> ประเภทสินค้า</b>, <b>ชนิดข้าว</b>, <b>ชั้นย่อย</b>, <b>เงื่อนไข</b>, <b>ประเภทนา</b>, <b>ปี/ฤดูกาล</b>, <b>โปรแกรม</b>, <b>ประเภทธุรกิจ</b> จะไม่สามารถแก้จากแบบฟอร์มด้านล่างได้
          </p>
        </div>
      </div>

      {/* วิธีชำระเงิน + วันที่ + ใบชั่ง/ใบเบิกเงิน */}
      <div className="grid gap-4 md:grid-cols-3">
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
            placeholder="— เลือกวิธีชำระเงิน —"
            buttonRef={refs.payment}
            onEnterNext={() => focusRefWithRetry(refs.paymentRefNo)}
            searchable={false}
            error={!!errors.payment}
            hintRed={!!form.missingHints.payment}
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
                const targetKey = buyerType === "person" ? "fullName" : "companyName"
                focusRefWithRetry(refs[targetKey])
              }
            }}
            placeholder="เช่น 011-0000123456"
            aria-invalid={errors.paymentRefNo ? true : undefined}
            aria-describedby={describedBy(errors, "paymentRefNo")}
          />
          {errors.paymentRefNo && <p id={errId("paymentRefNo")} className={errorTextCls}>{errors.paymentRefNo}</p>}
        </div>
      </div>

      {/* ========== ฟิลด์ลูกค้าในกรอบเดียว ========== */}
      {buyerType === "person" ? (
        <div className="mt-4 grid gap-4 md:grid-cols-3">
          <div>
            <label className={labelCls} htmlFor={fieldId("citizenId")}>เลขที่บัตรประชาชน (เพื่อค้นหาที่อยู่)</label>
            <input
              id={fieldId("citizenId")}
              ref={refs.citizenId}
              inputMode="numeric"
              maxLength={13}
              className={cx(baseField, errors.citizenId && "border-amber-400")}
              value={customer.citizenId}
              onChange={(e) => updateCustomer("citizenId", onlyDigits(e.target.value))}
              onFocus={() => clearHint("citizenId")}
              placeholder="เช่น 1234567890123"
              onKeyDown={onEnter("citizenId")}
              aria-invalid={errors.citizenId ? true : undefined}
            />
            <div className={helpTextCls}>
              {loadingCustomer && "กำลังค้นหาลูกค้า..."}
              {customer.citizenId.length === 13 && !validateThaiCitizenId(customer.citizenId) && (
                <span className="text-amber-600 dark:text-amber-300"> เลขบัตรอาจไม่ถูกต้อง</span>
              )}
            </div>
          </div>

          {/* ⭐ member_id */}
          <div>
            <label className={labelCls} htmlFor={fieldId("memberId")}>รหัสสมาชิก (member_id)</label>
            <input
              id={fieldId("memberId")}
              ref={refs.memberId}
              inputMode="numeric"
              className={cx(baseField, redFieldCls("memberId"))}
              value={customer.memberId}
              onChange={(e) => { updateCustomer("memberId", onlyDigits(e.target.value)); clearError("memberId") }}
              onKeyDown={onEnter("memberId")}
              placeholder="เช่น 100234"
              aria-invalid={errors.memberId ? true : undefined}
              aria-describedby={describedBy(errors, "memberId")}
            />
            {!!memberMeta.memberId && (
              <p className={helpTextCls}>พบสมาชิก: member_id {memberMeta.memberId}</p>
            )}
            {errors.memberId && <p id={errId("memberId")} className={errorTextCls}>{errors.memberId}</p>}
          </div>

          <div className="md:col-span-1" />

          <div className="md:col-span-2" ref={nameBoxRef}>
            <label className={labelCls} htmlFor={fieldId("fullName")}>ชื่อ–สกุล (พิมพ์เพื่อค้นหาอัตโนมัติ)</label>
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
                if (e.target.value.trim().length >= 2) {
                  setShowNameList(true)
                } else {
                  setShowNameList(false)
                  setHighlightedIndex(-1)
                }
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
            {errors.fullName && <p id={errId("fullName")} className={errorTextCls}>{errors.fullName}</p>}

            {showNameList && nameResults.length > 0 && (
              <div
                id="name-results"
                ref={listContainerRef}
                className={
                  "mt-1 max-h-72 w-full overflow-auto rounded-2xl border border-slate-200 bg-white text-black shadow-sm " +
                  "dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                }
                role="listbox"
              >
                {nameResults.map((r, idx) => {
                  const isActive = idx === highlightedIndex
                  const full = `${r.first_name ?? ""} ${r.last_name ?? ""}`.trim()
                  return (
                    <button
                      type="button"
                      ref={(el) => (itemRefs.current[idx] = el)}
                      key={`${r.type}-${r.asso_id}-${r.citizen_id}-${idx}`}
                      onClick={async () => await pickNameResult(r)}
                      onMouseEnter={() => {
                        setHighlightedIndex(idx)
                        requestAnimationFrame(() => scrollHighlightedIntoView2(idx))
                      }}
                      role="option"
                      aria-selected={isActive}
                      className={cx(
                        "relative flex w-full items-start gap-3 px-3 py-2.5 text-left transition rounded-xl cursor-pointer",
                        isActive
                          ? "bg-indigo-50 ring-1 ring-indigo-200 dark:bg-indigo-500/15 dark:ring-indigo-500/40"
                          : "hover:bg-slate-50 dark:hover:bg-slate-700/60"
                      )}
                    >
                      <div className="flex-1">
                        <div className="font-medium">{full || "(ไม่มีชื่อ)"}</div>
                        <div className="text-sm text-slate-600 dark:text-slate-300">
                          {r.type === "member"
                            ? `สมาชิก • member_id ${r.member_id ?? "-"}`
                            : `ลูกค้าทั่วไป • ปชช. ${r.citizen_id ?? "-"}`}
                        </div>
                      </div>
                    </button>
                  )
                })}
              </div>
            )}
          </div>

          {[
            ["houseNo", "บ้านเลขที่", "เช่น 99/1"],
            ["moo", "หมู่", "เช่น 4"],
            ["subdistrict", "ตำบล", "เช่น หนองปลาไหล"],
            ["district", "อำเภอ", "เช่น เมือง"],
            ["province", "จังหวัด", "เช่น ขอนแก่น"],
          ].map(([k, label, ph]) => (
            <div key={k}>
              <label className={labelCls} htmlFor={fieldId(k)}>{label}</label>
              <input
                id={fieldId(k)}
                ref={refs[k]}
                className={cx(baseField, compactInput)}
                value={customer[k]}
                onChange={(e) => updateCustomer(k, e.target.value)}
                onFocus={() => clearHint(k)}
                onKeyDown={onEnter(k)}
                placeholder={ph}
              />
            </div>
          ))}

          <div>
            <label className={labelCls} htmlFor={fieldId("postalCode")}>รหัสไปรษณีย์</label>
            <input
              id={fieldId("postalCode")}
              ref={refs.postalCode}
              inputMode="numeric"
              maxLength={5}
              className={cx(baseField, compactInput)}
              value={customer.postalCode}
              onChange={(e) => updateCustomer("postalCode", onlyDigits(e.target.value))}
              onFocus={() => clearHint("postalCode")}
              onKeyDown={onEnter("postalCode")}
              placeholder="เช่น 40000"
            />
          </div>

          <div>
            <label className={labelCls} htmlFor={fieldId("phone")}>เบอร์โทรศัพท์ </label>
            <input
              id={fieldId("phone")}
              ref={refs.phone}
              inputMode="tel"
              maxLength={20}
              className={cx(baseField, compactInput)}
              value={customer.phone}
              onChange={(e) => updateCustomer("phone", e.target.value.replace(/[^\d+]/g, ""))}
              onKeyDown={onEnter("phone")}
              placeholder="เช่น 0812345678"
            />
            <p className={helpTextCls}></p>
          </div>
        </div>
      ) : (
        /* -------------------- โหมดบริษัท -------------------- */
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
              if (buyerType === "company") {
                if (e.target.value.trim().length >= 2) {
                  setShowCompanyList(true)
                } else {
                  setShowCompanyList(false)
                  setCompanyHighlighted(-1)
                }
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
              className={
                "mt-1 max-h-72 w-full overflow-auto rounded-2xl border border-slate-200 bg-white text-black shadow-sm " +
                "dark:border-slate-700 dark:bg-slate-800 dark:text-white"
              }
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
                    onMouseEnter={() => {
                      setCompanyHighlighted(idx)
                      requestAnimationFrame(() => {
                        try { companyItemRefs.current[idx]?.scrollIntoView({ block: "nearest" }) } catch { /* ignore */ }
                      })
                    }}
                    role="option"
                    aria-selected={isActive}
                    className={cx(
                      "relative flex w-full items-start gap-3 px-3 py-2.5 text-left transition rounded-xl cursor-pointer",
                      isActive
                        ? "bg-indigo-50 ring-1 ring-indigo-200 dark:bg-indigo-500/15 dark:ring-indigo-500/40"
                        : "hover:bg-slate-50 dark:hover:bg-slate-700/60"
                    )}
                  >
                    <div className="flex-1">
                      <div className="font-medium">{name}</div>
                      <div className="text-sm text-slate-600 dark:text-slate-300">
                        ภาษี {tid} • โทร {r.phone_number ?? "-"}
                      </div>
                    </div>
                  </button>
                )
              })}
            </div>
          )}
        </div>

        <div>
          <label className={labelCls} htmlFor={fieldId("taxId")}>เลขประจำตัวผู้เสียภาษี</label>
          <input
            id={fieldId("taxId")}
            ref={refs.taxId}
            inputMode="numeric"
            maxLength={13}
            className={cx(baseField, redFieldCls("taxId"))}
            value={customer.taxId}
            onChange={(e) => { updateCustomer("taxId", onlyDigits(e.target.value)); clearError("taxId") }}
            onFocus={() => clearHint("taxId")}
            onKeyDown={onEnter("taxId")}
            placeholder="13 หลัก"
            aria-invalid={errors.taxId ? true : undefined}
            aria-describedby={errors.taxId ? errId("taxId") : "buy-taxId-help"}
          />
          {errors.taxId
            ? <p id={errId("taxId")} className={errorTextCls}>{errors.taxId}</p>
            : <p id="buy-taxId-help" className={helpTextCls}>
                {customer.taxId.length > 0 && !validateThaiTaxId(customer.taxId) ? `กรอกแล้ว ${customer.taxId.length} จาก 13 หลัก` : "13 หลัก ค้นหาบริษัทให้อัตโนมัติ"}
              </p>}
        </div>

        <div>
          <label className={labelCls} htmlFor={fieldId("companyPhone")}>เบอร์โทร</label>
          <input
            id={fieldId("companyPhone")}
            ref={refs.companyPhone}
            inputMode="tel"
            maxLength={20}
            className={baseField}
            value={customer.companyPhone}
            onChange={(e) => updateCustomer("companyPhone", e.target.value.replace(/[^\d+]/g, ""))}
            onKeyDown={onEnter("companyPhone")}
            placeholder="เช่น 044123456"
          />
        </div>
        </div>
      )}
      {/* ========== จบฟิลด์ลูกค้าในกรอบเดียว ========== */}
    </div>
  )
}
