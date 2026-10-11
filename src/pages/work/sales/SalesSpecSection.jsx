// src/pages/work/sales/SalesSpecSection.jsx
// ─────────────────────────────────────────────────────────────────────────────
// Sales "สินค้าและคลัง". Default export = DESKTOP section (round 2): one row
// ฟอร์มสินค้า | สาขา | คลัง + the template's 8 spec values as read-only chips.
// The 8 spec ComboBoxes are always disabled (spec comes from the product
// form — LOCK_SPEC), so desktop no longer renders them; spec errors are shown
// on the product-form picker instead. `SpecCombos` / `BranchKlangFields` stay
// exported for the phone stepper (they must stay MOUNTED on phones — plan §A3).
// ─────────────────────────────────────────────────────────────────────────────
import ComboBox from "../../../components/ComboBox"
import { cx, cardCls, labelCls, helpTextCls, errorTextCls, readonlyFieldCls } from "../../../lib/styles"
import { isEnabledInput, fieldId, errId, describedBy, SPEC_KEYS } from "./salesShared"
import { SHORT_LABEL } from "./salesValidation"
import { TemplateCombo } from "./SalesCustomerSection"

/** 8 locked spec fields — renders the field <div>s only (caller owns the grid). */
export function SpecCombos({ form }) {
  const {
    productOptions, riceOptions, subriceOptions, conditionOptions, fieldTypeOptions, yearOptions,
    businessOptions, programOptions, order, setOrder, errors, missingHints, clearHint, refs,
  } = form
  return (
    <>
      <div>
        <label className={labelCls} htmlFor={fieldId("product")}>ประเภทสินค้า</label>
        <ComboBox
          id={fieldId("product")}
          ariaDescribedBy={describedBy(errors, "product")}
          options={productOptions}
          value={order.productId}
          onChange={(id, found) => {
            setOrder((p) => ({ ...p, productId: id, productName: found?.label ?? "", riceId: "", riceType: "", subriceId: "", subriceName: "" }))
          }}
          placeholder="— ตามฟอร์มสินค้า —"
          error={!!errors.product}
          hintRed={!!missingHints.product}
          clearHint={() => clearHint("product")}
          buttonRef={refs.product}
          disabled={true}
          title="ประเภทสินค้า"
          ariaLabel="ประเภทสินค้า"
        />
        {errors.product && <p id={errId("product")} className={errorTextCls}>{errors.product}</p>}
      </div>

      <div>
        <label className={labelCls} htmlFor={fieldId("riceType")}>ชนิดข้าว</label>
        <ComboBox
          id={fieldId("riceType")}
          ariaDescribedBy={describedBy(errors, "riceType")}
          options={riceOptions}
          value={order.riceId}
          onChange={(id, found) => setOrder((p) => ({ ...p, riceId: id, riceType: found?.label ?? "", subriceId: "", subriceName: "" }))}
          placeholder="— ตามฟอร์มสินค้า —"
          disabled={true}
          error={!!errors.riceType}
          hintRed={!!missingHints.riceType}
          clearHint={() => clearHint("riceType")}
          buttonRef={refs.riceType}
          title="ชนิดข้าว"
          ariaLabel="ชนิดข้าว"
        />
        {errors.riceType && <p id={errId("riceType")} className={errorTextCls}>{errors.riceType}</p>}
      </div>

      <div>
        <label className={labelCls} htmlFor={fieldId("subrice")}>ชั้นย่อย</label>
        <ComboBox
          id={fieldId("subrice")}
          ariaDescribedBy={describedBy(errors, "subrice")}
          options={subriceOptions}
          value={order.subriceId}
          onChange={(id, found) => setOrder((p) => ({ ...p, subriceId: id, subriceName: found?.label ?? "" }))}
          placeholder="— ตามฟอร์มสินค้า —"
          disabled={true}
          error={!!errors.subrice}
          hintRed={!!missingHints.subrice}
          clearHint={() => clearHint("subrice")}
          buttonRef={refs.subrice}
          title="ชั้นย่อย"
          ariaLabel="ชั้นย่อย"
        />
        {errors.subrice && <p id={errId("subrice")} className={errorTextCls}>{errors.subrice}</p>}
      </div>

      <div>
        <label className={labelCls} htmlFor={fieldId("condition")}>สภาพ/เงื่อนไข</label>
        <ComboBox
          id={fieldId("condition")}
          ariaDescribedBy={describedBy(errors, "condition")}
          options={conditionOptions}
          value={order.conditionId}
          getValue={(o) => o.id}
          onChange={(_id, found) => setOrder((p) => ({ ...p, conditionId: found?.id ?? "", condition: found?.label ?? "" }))}
          placeholder="— ตามฟอร์มสินค้า —"
          error={!!errors.condition}
          hintRed={!!missingHints.condition}
          clearHint={() => clearHint("condition")}
          buttonRef={refs.condition}
          disabled={true}
          title="สภาพ/เงื่อนไข"
          ariaLabel="สภาพ/เงื่อนไข"
        />
        {errors.condition && <p id={errId("condition")} className={errorTextCls}>{errors.condition}</p>}
      </div>

      <div>
        <label className={labelCls} htmlFor={fieldId("fieldType")}>ประเภทนา</label>
        <ComboBox
          id={fieldId("fieldType")}
          ariaDescribedBy={describedBy(errors, "fieldType")}
          options={fieldTypeOptions}
          value={order.fieldTypeId}
          getValue={(o) => o.id}
          onChange={(_id, found) => setOrder((p) => ({ ...p, fieldTypeId: found?.id ?? "", fieldType: found?.label ?? "" }))}
          placeholder="— ตามฟอร์มสินค้า —"
          error={!!errors.fieldType}
          hintRed={!!missingHints.fieldType}
          clearHint={() => clearHint("fieldType")}
          buttonRef={refs.fieldType}
          disabled={true}
          title="ประเภทนา"
          ariaLabel="ประเภทนา"
        />
        {errors.fieldType && <p id={errId("fieldType")} className={errorTextCls}>{errors.fieldType}</p>}
      </div>

      <div>
        <label className={labelCls} htmlFor={fieldId("riceYear")}>ปี/ฤดูกาล</label>
        <ComboBox
          id={fieldId("riceYear")}
          ariaDescribedBy={describedBy(errors, "riceYear")}
          options={yearOptions}
          value={order.riceYearId}
          getValue={(o) => o.id}
          onChange={(_id, found) => setOrder((p) => ({ ...p, riceYearId: found?.id ?? "", riceYear: found?.label ?? "" }))}
          placeholder="— ตามฟอร์มสินค้า —"
          error={!!errors.riceYear}
          hintRed={!!missingHints.riceYear}
          clearHint={() => clearHint("riceYear")}
          buttonRef={refs.riceYear}
          disabled={true}
          title="ปี/ฤดูกาล"
          ariaLabel="ปี/ฤดูกาล"
        />
        {errors.riceYear && <p id={errId("riceYear")} className={errorTextCls}>{errors.riceYear}</p>}
      </div>

      <div>
        <label className={labelCls} htmlFor={fieldId("businessType")}>ประเภทธุรกิจ</label>
        <ComboBox
          id={fieldId("businessType")}
          ariaDescribedBy={describedBy(errors, "businessType")}
          options={businessOptions}
          value={order.businessTypeId}
          getValue={(o) => o.id}
          onChange={(_id, found) => setOrder((p) => ({ ...p, businessTypeId: found?.id ?? "", businessType: found?.label ?? "" }))}
          placeholder="— ตามฟอร์มสินค้า —"
          error={!!errors.businessType}
          hintRed={!!missingHints.businessType}
          clearHint={() => clearHint("businessType")}
          buttonRef={refs.businessType}
          disabled={true}
          title="ประเภทธุรกิจ"
          ariaLabel="ประเภทธุรกิจ"
        />
        {errors.businessType && <p id={errId("businessType")} className={errorTextCls}>{errors.businessType}</p>}
      </div>

      <div>
        <label className={labelCls} htmlFor={fieldId("program")}>โปรแกรม</label>
        <ComboBox
          id={fieldId("program")}
          options={programOptions}
          value={order.programId}
          getValue={(o) => o.id}
          onChange={(_id, found) => setOrder((p) => ({ ...p, programId: found?.id ?? "", programName: found?.label ?? "" }))}
          placeholder="— ตามฟอร์มสินค้า —"
          buttonRef={refs.program}
          disabled={true}
          title="โปรแกรม"
          ariaLabel="โปรแกรม"
        />
      </div>
    </>
  )
}

/** สาขา + คลัง — renders the two field <div>s (caller owns the grid). */
export function BranchKlangFields({ form, desktop = false }) {
  const { branchLocked, order, setOrder, branchOptions, klangOptions, errors, missingHints, clearHint, refs, focusNext } = form
  return (
    <>
      {desktop && branchLocked ? (
        // Desktop: a locked branch is a fact, not a choice → read-only field
        <div>
          <label className={labelCls} htmlFor={fieldId("branchName")}>สาขา</label>
          <input
            id={fieldId("branchName")}
            readOnly
            tabIndex={-1}
            value={order.branchName || ""}
            title="สาขาตามบัญชีผู้ใช้"
            className={cx(readonlyFieldCls, "truncate")}
          />
        </div>
      ) : (
      <div>
        <label className={labelCls} htmlFor={fieldId("branchName")}>สาขา</label>
        <ComboBox
          id={fieldId("branchName")}
          ariaDescribedBy={describedBy(errors, "branchName")}
          options={branchLocked && order.branchId != null ? branchOptions.filter((o) => String(o.id) === String(order.branchId)) : branchOptions}
          value={order.branchId}
          getValue={(o) => o.id}
          onChange={(_val, found) => setOrder((p) => ({ ...p, branchId: found?.id ?? null, branchName: found?.label ?? "", klangName: "", klangId: null }))}
          placeholder="— เลือกสาขา —"
          error={!!errors.branchName}
          hintRed={!!missingHints.branchName}
          clearHint={() => clearHint("branchName")}
          buttonRef={refs.branchName}
          title="สาขา"
          ariaLabel="สาขา"
          onEnterNext={() => {
            const tryFocus = () => {
              const el = refs.klangName?.current
              if (el && isEnabledInput(el)) {
                try { el.scrollIntoView({ block: "center" }) } catch {}
                el.focus?.()
                try { el.select?.() } catch {}
                return true
              }
              return false
            }
            if (tryFocus()) return
            setTimeout(tryFocus, 60)
            setTimeout(tryFocus, 180)
          }}
          disabled={branchLocked}
        />
        {branchLocked && <p className={helpTextCls}>สาขาตามบัญชีผู้ใช้</p>}
        {errors.branchName && <p id={errId("branchName")} className={errorTextCls}>{errors.branchName}</p>}
      </div>
      )}
      <div>
        <label className={labelCls} htmlFor={fieldId("klangName")}>คลัง</label>
        <ComboBox
          id={fieldId("klangName")}
          ariaDescribedBy={describedBy(errors, "klangName")}
          options={klangOptions}
          value={order.klangId}
          getValue={(o) => o.id}
          onChange={(_val, found) => setOrder((p) => ({ ...p, klangId: found?.id ?? null, klangName: found?.label ?? "" }))}
          placeholder="— เลือกคลัง —"
          disabled={!order.branchId}
          enterMovesWhenFilled={desktop}
          error={!!errors.klangName}
          hintRed={!!missingHints.klangName}
          clearHint={() => clearHint("klangName")}
          buttonRef={refs.klangName}
          title="คลัง"
          ariaLabel="คลัง"
          onEnterNext={() => {
            const goTrailerCount = () => {
              const el = refs.trailerCount?.current
              if (el && isEnabledInput(el)) {
                try { el.scrollIntoView({ block: "center" }) } catch {}
                el.focus?.()
                return true
              }
              return false
            }
            if (!goTrailerCount()) {
              focusNext("klangName")
            }
          }}
        />
        {errors.klangName && <p id={errId("klangName")} className={errorTextCls}>{errors.klangName}</p>}
      </div>
    </>
  )
}

/* ============================ DESKTOP ============================ */
const SPEC_ROWS = [
  ["product", "ประเภทสินค้า", "productName"],
  ["riceType", "ชนิดข้าว", "riceType"],
  ["subrice", "ชั้นย่อย", "subriceName"],
  ["condition", "สภาพ/เงื่อนไข", "condition"],
  ["fieldType", "ประเภทนา", "fieldType"],
  ["riceYear", "ปี/ฤดูกาล", "riceYear"],
  ["businessType", "ประเภทธุรกิจ", "businessType"],
  ["program", "โปรแกรม", "programName"],
]
const SPEC_ERR_ID = "sales-spec-err"

export default function SalesSpecSection({ form }) {
  const { order, errors, missingHints } = form
  const missing = SPEC_KEYS.filter((k) => errors[k] || missingHints[k])
  const missingNames = missing.map((k) => SHORT_LABEL[k] || k).join(", ")
  return (
    <section aria-labelledby="sales-sec-spec" className={cx(cardCls, "p-5")}>
      <h2 id="sales-sec-spec" className="text-lg font-semibold leading-snug text-gray-900 dark:text-gray-100">สินค้าและคลัง</h2>

      <div className="mt-4 grid gap-4 md:grid-cols-3">
        <div>
          <label className={labelCls} htmlFor={fieldId("formTemplate")}>ฟอร์มสินค้า</label>
          <TemplateCombo
            form={form}
            title="ฟอร์มสินค้า"
            error={missing.length > 0}
            describedById={missing.length > 0 ? SPEC_ERR_ID : undefined}
          />
          {missing.length > 0 && (
            <p id={SPEC_ERR_ID} className={errorTextCls}>ฟอร์มนี้ไม่ได้กำหนด{missingNames} · เลือกฟอร์มอื่น</p>
          )}
        </div>
        <BranchKlangFields form={form} desktop />
      </div>

      {/* สเปคตามฟอร์ม — อ่านอย่างเดียว (chip เดียวกับ Buy; ค่าที่ขาดแสดงเป็นสีแดงเมื่อมี error) */}
      <dl aria-label="สเปคสินค้าตามฟอร์ม" className="mt-3 flex flex-wrap items-center gap-1.5">
        {SPEC_ROWS.map(([key, label, field]) => {
          const bad = missing.includes(key)
          if (!order[field] && !bad) return null
          return (
            <div
              key={key}
              title={label}
              className={cx(
                "inline-flex items-center rounded-lg px-2 py-0.5 text-sm",
                bad
                  ? "bg-red-50 text-red-700 ring-1 ring-inset ring-red-200 dark:bg-red-900/20 dark:text-red-300 dark:ring-red-800/60"
                  : "bg-gray-100 text-gray-700 dark:bg-gray-700/60 dark:text-gray-200",
              )}
            >
              <dt className={bad ? "mr-1" : "sr-only"}>{label}</dt>
              <dd>{order[field] || "—"}</dd>
            </div>
          )
        })}
      </dl>
    </section>
  )
}
