// src/pages/work/buy/BuyCustomerSection.jsx
// ─────────────────────────────────────────────────────────────────────────────
// "ข้อมูลลูกค้า" — buyer type, form template, payment / date / scale ticket,
// person (search by citizen id / member id / name + address) or company
// (search by name / tax id). Markup is the desktop card moved verbatim out of
// Buy.jsx; all state, refs and handlers arrive in the `form` props-bag.
// ─────────────────────────────────────────────────────────────────────────────
import ComboBox from "../../../components/ComboBox"
import { cx, baseField, labelCls, helpTextCls, errorTextCls, compactInput } from "../../../lib/styles"
import { onlyDigits, validateThaiCitizenId, focusRefWithRetry } from "./buyShared"
import DateInput from "./DateInput"

export default function BuyCustomerSection({ form }) {
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
          <label className={labelCls}>ประเภทผู้ซื้อ</label>
          <ComboBox
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
          <label className={labelCls}>ฟอร์มสำเร็จรูป</label>
          <ComboBox
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
          <label className={labelCls}>วิธีชำระเงิน</label>
          <ComboBox
            options={paymentOptions}
            value={order.paymentMethodId || ""}
            onChange={(id, found) =>
              setOrder((p) => ({ ...p, paymentMethod: found?.label ?? "", paymentMethodId: id }))}
            placeholder="— เลือกวิธีชำระเงิน —"
            buttonRef={refs.payment}
            onEnterNext={() => focusRefWithRetry(refs.paymentRefNo)}
            searchable={false}
            title="วิธีชำระเงิน"
            ariaLabel="วิธีชำระเงิน"
          />
        </div>

        <div>
          <label className={labelCls}>ลงวันที่</label>
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
        </div>

        <div>
          <label className={labelCls}>เลขที่ใบชั่ง/ใบเบิกเงิน</label>
          <input
            ref={refs.paymentRefNo}
            className={cx(baseField, redFieldCls("paymentRefNo"))}
            value={order.paymentRefNo}
            onChange={(e) => updateOrder("paymentRefNo", e.target.value)}
            onFocus={() => { clearHint("paymentRefNo"); clearError("paymentRefNo") }}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.isComposing) {
                e.preventDefault()
                const targetKey = buyerType === "person" ? "fullName" : "companyName"
                focusRefWithRetry(refs[targetKey])
              }
            }}
            placeholder="เช่น 011-0000123456"
          />
          {errors.paymentRefNo && <p className={errorTextCls}>{errors.paymentRefNo}</p>}
        </div>
      </div>

      {/* ========== ฟิลด์ลูกค้าในกรอบเดียว ========== */}
      {buyerType === "person" ? (
        <div className="mt-4 grid gap-4 md:grid-cols-3">
          <div>
            <label className={labelCls}>เลขที่บัตรประชาชน (เพื่อค้นหาที่อยู่)</label>
            <input
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
            <label className={labelCls}>รหัสสมาชิก (member_id)</label>
            <input
              ref={refs.memberId}
              inputMode="numeric"
              className={cx(baseField, redFieldCls("memberId"))}
              value={customer.memberId}
              onChange={(e) => updateCustomer("memberId", onlyDigits(e.target.value))}
              onFocus={() => clearError("memberId")}
              onKeyDown={onEnter("memberId")}
              placeholder="เช่น 100234"
              aria-invalid={errors.memberId ? true : undefined}
            />
            {!!memberMeta.memberId && (
              <p className={helpTextCls}>พบสมาชิก: member_id {memberMeta.memberId}</p>
            )}
            {errors.memberId && <p className={errorTextCls}>{errors.memberId}</p>}
          </div>

          <div className="md:col-span-1" />

          <div className="md:col-span-2" ref={nameBoxRef}>
            <label className={labelCls}>ชื่อ–สกุล (พิมพ์เพื่อค้นหาอัตโนมัติ)</label>
            <input
              ref={(el) => {
                refs.fullName.current = el
                nameInputRef.current = el
              }}
              className={cx(baseField, redFieldCls("fullName"))}
              value={customer.fullName}
              onChange={(e) => {
                updateCustomer("fullName", e.target.value)
                if (e.target.value.trim().length >= 2) {
                  setShowNameList(true)
                } else {
                  setShowNameList(false)
                  setHighlightedIndex(-1)
                }
              }}
              onFocus={() => {
                clearHint("fullName")
                clearError("fullName")
              }}
              onKeyDown={handleNameKeyDown}
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
              <label className={labelCls}>{label}</label>
              <input
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
            <label className={labelCls}>รหัสไปรษณีย์</label>
            <input
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
            <label className={labelCls}>เบอร์โทรศัพท์ </label>
            <input
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
        <div className="mt-4 md:col-span-2" ref={companyBoxRef}>
          <label className={labelCls}>ชื่อบริษัท / นิติบุคคล</label>
          <input
            ref={(el) => {
              refs.companyName.current = el
              companyInputRef.current = el
            }}
            className={cx(baseField, redFieldCls("companyName"))}
            value={customer.companyName}
            onChange={(e) => {
              updateCustomer("companyName", e.target.value)
              if (buyerType === "company") {
                if (e.target.value.trim().length >= 2) {
                  setShowCompanyList(true)
                } else {
                  setShowCompanyList(false)
                  setCompanyHighlighted(-1)
                }
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
      )}
      {/* ========== จบฟิลด์ลูกค้าในกรอบเดียว ========== */}
    </div>
  )
}
