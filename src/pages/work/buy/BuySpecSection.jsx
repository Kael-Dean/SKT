// src/pages/work/buy/BuySpecSection.jsx
// ─────────────────────────────────────────────────────────────────────────────
// Spec + สาขา / คลัง. Phone (<md): spec summary card + the 8 locked spec
// ComboBoxes in a <details>. Desktop (≥md, R2): "สินค้าและคลัง" card — ฟอร์มสินค้า
// picker | สาขา | คลัง + read-only spec chips (no spec ComboBoxes).
// ─────────────────────────────────────────────────────────────────────────────
import { ChevronDown } from "lucide-react"
import ComboBox from "../../../components/ComboBox"
import { Badge } from "../../../components/ui"
import {
  cx, labelCls, helpTextCls, errorTextCls, cardCls, sectionTitleCls, secondaryBtnCls, readonlyFieldCls,
} from "../../../lib/styles"
import { focusRefWithRetry, fieldId, errId, describedBy, sectionH2Cls, SPEC_LOCKED_KEYS } from "./buyShared"

export default function BuySpecSection({ form }) {
  return form.isPhone ? <PhoneSpecSection form={form} /> : <DesktopSpecSection form={form} />
}

/* ═══════════════════════════════ PHONE (<md) — UI-SPEC §3.2 ═══════════════════════════════ */

const phoneLabelCls = "mb-1 block text-sm font-medium leading-relaxed text-gray-600 dark:text-gray-300"

function PhoneSpecSection({ form }) {
  const {
    order, setOrder, refs, errors, missingHints, clearHint, clearError, LOCK_SPEC,
    productOptions, riceOptions, subriceOptions, conditionOptions, fieldTypeOptions,
    yearOptions, businessOptions, programOptions, branchOptions, klangOptions, branchLocked,
    formTemplate, selectedTemplateLabel, templateOptions, onGoToStep,
  } = form

  const templateLabel = selectedTemplateLabel || templateOptions.find((o) => String(o.id) === String(formTemplate))?.label || ""
  const locked = !!formTemplate
  const specRows = [
    ["ประเภทสินค้า", order.productName, "product"],
    ["ชนิดข้าว", order.riceType, "riceType"],
    ["ชั้นย่อย", order.subriceName, "subrice"],
    ["สภาพ/เงื่อนไข", order.condition, "condition"],
    ["ประเภทนา", order.fieldType, "fieldType"],
    ["ปี/ฤดูกาล", order.riceYear, "riceYear"],
    ["ประเภทธุรกิจ", order.businessType, "businessType"],
    ["โปรแกรม", order.programName, "program"],
  ]
  const specErrors = specRows.filter(([, , k]) => errors[k])

  // The 8 spec ComboBoxes stay mounted (disabled by LOCK_SPEC) so refs / lock
  // semantics are untouched; they live in a collapsed <details>.
  const combo = (key, label, options, value, onChange, getValue, extra = {}) => (
    <div key={key}>
      <label className={phoneLabelCls} htmlFor={fieldId(key)}>{label}</label>
      <ComboBox
        id={fieldId(key)}
        ariaDescribedBy={describedBy(errors, key)}
        options={options}
        value={value}
        getValue={getValue}
        onChange={onChange}
        placeholder="ล็อกตามฟอร์มสำเร็จรูป"
        error={!!errors[key]}
        hintRed={!!missingHints[key]}
        clearHint={() => clearHint(key)}
        buttonRef={refs[key]}
        disabled={LOCK_SPEC}
        title={label}
        ariaLabel={label}
        {...extra}
      />
      {errors[key] && <p id={errId(key)} className={errorTextCls}>{errors[key]}</p>}
    </div>
  )

  return (
    <div className="space-y-4">
      {/* สเปคสินค้า */}
      <section className={cx(cardCls, "p-4")}>
        <div className={cx(sectionTitleCls, "flex items-center justify-between gap-2")}>
          <span>สเปคสินค้า</span>
          {locked ? <Badge tone="info">ล็อกตามฟอร์ม</Badge> : <Badge tone="pending">ยังไม่ล็อกฟอร์ม</Badge>}
        </div>
        {locked ? (
          <>
            <p className="text-sm font-medium leading-relaxed text-gray-900 dark:text-gray-100">ฟอร์ม: {templateLabel || "—"}</p>
            <dl className="mt-3 grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 border-t border-gray-100 pt-3 dark:border-gray-700/70">
              {specRows.map(([l, v, k]) => (
                <div key={k} className="contents">
                  <dt className="text-sm leading-relaxed text-gray-500 dark:text-gray-400">{l}</dt>
                  <dd className={cx("text-base leading-relaxed", v ? "text-gray-900 dark:text-gray-100" : "text-red-600 dark:text-red-400")}>
                    {v || (errors[k] ? "ไม่มีในฟอร์ม" : "—")}
                  </dd>
                </div>
              ))}
            </dl>
            {specErrors.length > 0 && (
              <p className={errorTextCls}>ฟอร์มสำเร็จรูปนี้ยังไม่มี: {specErrors.map(([l]) => l).join(", ")} เลือกฟอร์มอื่นในขั้น 1</p>
            )}
          </>
        ) : (
          <p className="text-sm leading-relaxed text-gray-600 dark:text-gray-300">เลือกฟอร์มสำเร็จรูปในขั้น 1 เพื่อล็อกสเปคสินค้า</p>
        )}
        <div className="mt-3 border-t border-gray-100 pt-3 dark:border-gray-700/70">
          <button type="button" className={cx(secondaryBtnCls, "h-11 w-full py-0 text-sm")} onClick={() => onGoToStep?.(0, "formTemplate")}>
            {locked ? "เปลี่ยนฟอร์ม" : "เลือกฟอร์ม"}
          </button>
        </div>
      </section>

      <details className={cx(cardCls, "group overflow-hidden")}>
        <summary className="flex min-h-touch cursor-pointer list-none items-center gap-2 px-4 text-sm text-gray-700 select-none dark:text-gray-200 [&::-webkit-details-marker]:hidden">
          <span className="flex-1">ดูสเปครายตัว</span>
          <ChevronDown aria-hidden="true" className="size-5 shrink-0 text-gray-400 transition-transform duration-150 group-open:rotate-180 dark:text-gray-500" />
        </summary>
        <div className="space-y-3 border-t border-gray-200 px-4 py-4 dark:border-gray-700">
          <p className={helpTextCls + " mt-0"}>ล็อกตามฟอร์มสำเร็จรูป</p>
          {combo("product", "ประเภทสินค้า", productOptions, order.productId, (id, found) =>
            setOrder((p) => ({ ...p, productId: id, productName: found?.label ?? "", riceId: "", riceType: "", subriceId: "", subriceName: "" })))}
          {combo("riceType", "ชนิดข้าว", riceOptions, order.riceId, (id, found) =>
            setOrder((p) => ({ ...p, riceId: id, riceType: found?.label ?? "", subriceId: "", subriceName: "" })), undefined, { searchable: true })}
          {combo("subrice", "ชั้นย่อย", subriceOptions, order.subriceId, (id, found) =>
            setOrder((p) => ({ ...p, subriceId: id, subriceName: found?.label ?? "" })), undefined, { searchable: true })}
          {combo("condition", "สภาพ/เงื่อนไข", conditionOptions, order.conditionId, (_id, found) =>
            setOrder((p) => ({ ...p, conditionId: found?.id ?? "", condition: found?.label ?? "" })), (o) => o.id)}
          {combo("fieldType", "ประเภทนา", fieldTypeOptions, order.fieldTypeId, (_id, found) =>
            setOrder((p) => ({ ...p, fieldTypeId: found?.id ?? "", fieldType: found?.label ?? "" })), (o) => o.id)}
          {combo("riceYear", "ปี/ฤดูกาล", yearOptions, order.riceYearId, (_id, found) =>
            setOrder((p) => ({ ...p, riceYearId: found?.id ?? "", riceYear: found?.label ?? "" })), (o) => o.id)}
          {combo("businessType", "ประเภทธุรกิจ", businessOptions, order.businessTypeId, (_id, found) =>
            setOrder((p) => ({ ...p, businessTypeId: found?.id ?? "", businessType: found?.label ?? "" })), (o) => o.id)}
          {combo("program", "โปรแกรม", programOptions, order.programId, (_id, found) =>
            setOrder((p) => ({ ...p, programId: found?.id ?? "", programName: found?.label ?? "" })), (o) => o.id, { clearHint: () => { clearHint("program"); clearError("program") } })}
        </div>
      </details>

      {/* สาขาและคลัง */}
      <section className={cx(cardCls, "space-y-4 p-4")}>
        <h3 className={sectionTitleCls}>สาขาและคลัง</h3>
        <div>
          <label className={phoneLabelCls} htmlFor={branchLocked && order.branchId != null ? undefined : fieldId("branchName")}>สาขา</label>
          {branchLocked && order.branchId != null ? (
            <div className={cx(readonlyFieldCls, "flex items-center justify-between gap-3")}>
              <span className="truncate">{order.branchName || "—"}</span>
              <Badge tone="neutral">ตามสิทธิ์</Badge>
            </div>
          ) : (
            <ComboBox
              id={fieldId("branchName")}
              ariaDescribedBy={describedBy(errors, "branchName")}
              options={branchOptions}
              value={order.branchId}
              getValue={(o) => o.id}
              onChange={(_val, found) => {
                setOrder((p) => ({ ...p, branchId: found?.id ?? null, branchName: found?.label ?? "", klangName: "", klangId: null }))
                clearError("branchName")
              }}
              placeholder="เลือกสาขา"
              error={!!errors.branchName}
              hintRed={!!missingHints.branchName}
              clearHint={() => clearHint("branchName")}
              buttonRef={refs.branchName}
              loading={branchOptions.length === 0}
              title="สาขา"
              ariaLabel="สาขา"
            />
          )}
          {errors.branchName && <p id={errId("branchName")} className={errorTextCls}>{errors.branchName}</p>}
        </div>
        <div>
          <label className={phoneLabelCls} htmlFor={fieldId("klangName")}>คลัง</label>
          <ComboBox
            id={fieldId("klangName")}
            ariaDescribedBy={describedBy(errors, "klangName")}
            options={klangOptions}
            value={order.klangId}
            getValue={(o) => o.id}
            onChange={(_val, found) => {
              setOrder((p) => ({ ...p, klangId: found?.id ?? null, klangName: found?.label ?? "" }))
              clearError("klangName")
            }}
            placeholder={!order.branchId ? "เลือกสาขาก่อน" : klangOptions.length === 0 ? "กำลังโหลดตัวเลือก…" : "เลือกคลัง"}
            disabled={!order.branchId}
            loading={!!order.branchId && klangOptions.length === 0}
            error={!!errors.klangName}
            hintRed={!!missingHints.klangName}
            clearHint={() => clearHint("klangName")}
            buttonRef={refs.klangName}
            title="คลัง"
            ariaLabel="คลัง"
          />
          {errors.klangName && <p id={errId("klangName")} className={errorTextCls}>{errors.klangName}</p>}
        </div>
      </section>
    </div>
  )
}

/* ═══════════════════════════════ DESKTOP (≥md) — R2 "สินค้าและคลัง" ═══════════════════════════════
 * One row: ฟอร์มสินค้า | สาขา | คลัง, then the 8 template-locked spec values as
 * read-only chips. The 8 spec ComboBoxes are no longer rendered on desktop —
 * their refs stay null so useEnterNavigation drops them; validation and the
 * payload read `order.*Id` state, never the DOM. Any spec error is reported once,
 * at the ฟอร์มสินค้า picker (scrollToFirstError focuses refs.formTemplate).
 * ════════════════════════════════════════════════════════════════════════════════════════════════ */

/** [order label key, order id key, field name] in the order the spec reads */
const SPEC_CHIPS = [
  ["productName", "productId", "ประเภทสินค้า"],
  ["riceType", "riceId", "ชนิดข้าว"],
  ["subriceName", "subriceId", "ชั้นย่อย"],
  ["condition", "conditionId", "สภาพ/เงื่อนไข"],
  ["fieldType", "fieldTypeId", "ประเภทนา"],
  ["riceYear", "riceYearId", "ปี/ฤดูกาล"],
  ["businessType", "businessTypeId", "ประเภทธุรกิจ"],
  ["programName", "programId", "โปรแกรม"],
]

function DesktopSpecSection({ form }) {
  const {
    order, setOrder, refs, errors, missingHints, clearHint, clearError,
    branchOptions, klangOptions, branchLocked,
    formTemplate, templateOptions, templateSubLabel, onTemplateChange, templatesStatus, klangStatus,
  } = form

  const specError = SPEC_LOCKED_KEYS.some((k) => errors[k] || missingHints[k])
  const templatesLoaded = templateOptions.length > 0
  const templatesFailed = templatesStatus === "error" || (templatesStatus === "ready" && !templatesLoaded)
  const klangEmpty = !!order.branchId && klangStatus !== "loading" && klangOptions.length === 0
  // ids come straight from the template (sync) — a null id means the template itself lacks it
  const missingInTemplate = formTemplate && templatesLoaded ? SPEC_CHIPS.filter(([, idKey]) => !order[idKey]) : []
  const chips = SPEC_CHIPS.filter(([labelKey]) => order[labelKey])
  const templateMsgId = specError ? errId("formTemplate") : templatesFailed ? "buy-formTemplate-load" : missingInTemplate.length ? "buy-formTemplate-warn" : "buy-spec-chips"
  const branchReadOnly = branchLocked && order.branchId != null

  const clearSpecFlags = () => SPEC_LOCKED_KEYS.forEach((k) => { clearError(k); clearHint(k) })

  return (
    <section aria-labelledby="buy-sec-spec" className={cx(cardCls, "p-5")}>
      <h2 id="buy-sec-spec" className={sectionH2Cls}>สินค้าและคลัง</h2>

      <div className="mt-4 grid gap-4 md:grid-cols-3">
        {/* ฟอร์มสินค้า (ฟอร์มสำเร็จรูป) — กำหนดสเปคทั้ง 8 ค่า */}
        <div>
          <label className={labelCls} htmlFor={fieldId("formTemplate")}>ฟอร์มสินค้า</label>
          <ComboBox
            id={fieldId("formTemplate")}
            options={templateOptions}
            value={formTemplate}
            // sub-line (ชั้นย่อย) only in the list — the selected form's spec is already shown as chips below
            getSubLabel={(o) => (String(o.id) === String(formTemplate) ? "" : templateSubLabel(o))}
            onChange={(id, found) => { onTemplateChange(id, found); clearSpecFlags() }}
            onEnterNext={() => focusRefWithRetry(refs.klangName)}
            buttonRef={refs.formTemplate}
            searchable
            placeholder="เลือกฟอร์มสินค้า"
            loading={templatesStatus === "loading"}
            error={specError}
            ariaDescribedBy={templateMsgId}
            title="ฟอร์มสินค้า"
            ariaLabel="ฟอร์มสินค้า"
          />
          {specError ? (
            <p id={errId("formTemplate")} className={errorTextCls}>
              {formTemplate ? "ฟอร์มสินค้านี้ข้อมูลไม่ครบ เลือกฟอร์มอื่น" : "เลือกฟอร์มสินค้า"}
            </p>
          ) : templatesFailed ? (
            <p id="buy-formTemplate-load" className={errorTextCls}>
              {templatesStatus === "error" ? "โหลดฟอร์มสินค้าไม่สำเร็จ รีเฟรชหน้าแล้วลองใหม่" : "ยังไม่มีฟอร์มสินค้า แจ้งผู้ดูแลระบบให้สร้างฟอร์ม"}
            </p>
          ) : missingInTemplate.length > 0 ? (
            <p id="buy-formTemplate-warn" className="mt-1 text-sm text-amber-700 dark:text-amber-300">
              ฟอร์มนี้ไม่มี{missingInTemplate.map(([, , l]) => l).join(", ")}
            </p>
          ) : null}
        </div>

        {/* สาขา — ตามสิทธิ์ผู้ใช้ = แสดงอย่างเดียว */}
        <div>
          {branchReadOnly ? (
            <>
              <span className={labelCls} id="buy-branchName-label">สาขา</span>
              <div
                role="group"
                aria-labelledby="buy-branchName-label"
                title="สาขาตามบัญชีผู้ใช้"
                className={cx(readonlyFieldCls, "truncate")}
              >
                {order.branchName || "—"}
              </div>
            </>
          ) : (
            <>
              <label className={labelCls} htmlFor={fieldId("branchName")}>สาขา</label>
              <ComboBox
                id={fieldId("branchName")}
                ariaDescribedBy={describedBy(errors, "branchName")}
                options={branchOptions}
                value={order.branchId}
                getValue={(o) => o.id}
                onChange={(_val, found) => {
                  setOrder((p) => ({ ...p, branchId: found?.id ?? null, branchName: found?.label ?? "", klangName: "", klangId: null }))
                  clearError("branchName")
                }}
                placeholder="เลือกสาขา"
                error={!!errors.branchName}
                hintRed={!!missingHints.branchName}
                clearHint={() => clearHint("branchName")}
                buttonRef={refs.branchName}
                onEnterNext={() => focusRefWithRetry(refs.klangName)}
                loading={branchOptions.length === 0}
                title="สาขา"
                ariaLabel="สาขา"
              />
            </>
          )}
          {errors.branchName && <p id={errId("branchName")} className={errorTextCls}>{errors.branchName}</p>}
        </div>

        {/* คลัง — Enter บนช่องที่เลือกแล้วไปช่องถัดไปเลย */}
        <div>
          <label className={labelCls} htmlFor={fieldId("klangName")}>คลัง</label>
          <ComboBox
            id={fieldId("klangName")}
            ariaDescribedBy={describedBy(errors, "klangName")}
            options={klangOptions}
            value={order.klangId}
            getValue={(o) => o.id}
            onChange={(_val, found) => {
              setOrder((p) => ({ ...p, klangId: found?.id ?? null, klangName: found?.label ?? "" }))
              clearError("klangName")
            }}
            placeholder={!order.branchId ? "เลือกสาขาก่อน" : "เลือกคลัง"}
            disabled={!order.branchId}
            loading={!!order.branchId && klangStatus === "loading"}
            emptyText="สาขานี้ยังไม่มีคลัง"
            error={!!errors.klangName}
            hintRed={!!missingHints.klangName}
            clearHint={() => clearHint("klangName")}
            buttonRef={refs.klangName}
            enterMovesWhenFilled
            onEnterNext={() => focusRefWithRetry(refs.entryWeightKg)}
            title="คลัง"
            ariaLabel="คลัง"
          />
          {errors.klangName ? (
            <p id={errId("klangName")} className={errorTextCls}>{errors.klangName}</p>
          ) : klangEmpty ? (
            <p className="mt-1 text-sm text-amber-700 dark:text-amber-300">
              {klangStatus === "error" ? "โหลดรายการคลังไม่สำเร็จ รีเฟรชหน้าแล้วลองใหม่" : "สาขานี้ยังไม่มีคลัง แจ้งผู้ดูแลระบบ"}
            </p>
          ) : null}
        </div>
      </div>

      {/* สเปคตามฟอร์ม — อ่านอย่างเดียว */}
      {chips.length > 0 ? (
        <dl id="buy-spec-chips" aria-label="สเปคสินค้าตามฟอร์ม" className="mt-3 flex flex-wrap items-center gap-1.5">
          {chips.map(([labelKey, , name]) => (
            <div
              key={labelKey}
              title={name}
              className="inline-flex items-center rounded-lg bg-gray-100 px-2 py-0.5 text-sm text-gray-700 dark:bg-gray-700/60 dark:text-gray-200"
            >
              <dt className="sr-only">{name}</dt>
              <dd>{order[labelKey]}</dd>
            </div>
          ))}
        </dl>
      ) : templatesFailed ? null : (
        <p id="buy-spec-chips" className="mt-3 text-sm text-gray-500 dark:text-gray-400">
          {formTemplate ? "กำลังโหลดสเปค…" : "เลือกฟอร์มสินค้าเพื่อกำหนดสเปค"}
        </p>
      )}
    </section>
  )
}

