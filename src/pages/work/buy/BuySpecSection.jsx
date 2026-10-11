// src/pages/work/buy/BuySpecSection.jsx
// ─────────────────────────────────────────────────────────────────────────────
// "รายละเอียดการซื้อ" spec block: the 8 template-locked spec ComboBoxes +
// สาขา / คลัง. Desktop markup moved verbatim out of Buy.jsx's <form> (two
// grids, returned as a fragment so the parent tree is node-identical).
// ─────────────────────────────────────────────────────────────────────────────
import { ChevronDown } from "lucide-react"
import ComboBox from "../../../components/ComboBox"
import { Badge } from "../../../components/ui"
import {
  cx, labelCls, helpTextCls, errorTextCls, cardCls, sectionTitleCls, secondaryBtnCls, readonlyFieldCls,
} from "../../../lib/styles"
import { focusRefWithRetry } from "./buyShared"

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
      <label className={phoneLabelCls}>{label}</label>
      <ComboBox
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
      {errors[key] && <p className={errorTextCls}>{errors[key]}</p>}
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
          <label className={phoneLabelCls}>สาขา</label>
          {branchLocked && order.branchId != null ? (
            <div className={cx(readonlyFieldCls, "flex items-center justify-between gap-3")}>
              <span className="truncate">{order.branchName || "—"}</span>
              <Badge tone="neutral">ตามสิทธิ์</Badge>
            </div>
          ) : (
            <ComboBox
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
          {errors.branchName && <p className={errorTextCls}>{errors.branchName}</p>}
        </div>
        <div>
          <label className={phoneLabelCls}>คลัง</label>
          <ComboBox
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
          {errors.klangName && <p className={errorTextCls}>{errors.klangName}</p>}
        </div>
      </section>
    </div>
  )
}

/* ═══════════════════════════════ DESKTOP (≥md) — unchanged tree ═══════════════════════════════ */

function DesktopSpecSection({ form }) {
  const {
    order, setOrder, refs, errors, missingHints, clearHint, clearError, LOCK_SPEC,
    productOptions, riceOptions, subriceOptions, conditionOptions, fieldTypeOptions,
    yearOptions, businessOptions, programOptions, branchOptions, klangOptions, branchLocked,
  } = form

  return (
    <>
      {/* เลือกประเภท/ปี/โปรแกรม/ธุรกิจ */}
      <div className="grid gap-4 md:grid-cols-3">
        <div>
          <label className={labelCls}>ประเภทสินค้า</label>
          <ComboBox
            options={productOptions}
            value={order.productId}
            onChange={(id, found) => {
              setOrder((p) => ({
                ...p,
                productId: id,
                productName: found?.label ?? "",
                riceId: "",
                riceType: "",
                subriceId: "",
                subriceName: "",
              }))}
            }
            placeholder="— ล็อกโดยฟอร์มสำเร็จรูป —"
            error={!!errors.product}
            hintRed={!!missingHints.product}
            clearHint={() => clearHint("product")}
            buttonRef={refs.product}
            disabled={LOCK_SPEC}
            title="ประเภทสินค้า"
            ariaLabel="ประเภทสินค้า"
          />
          {errors.product && <p className={errorTextCls}>{errors.product}</p>}
        </div>

        <div>
          <label className={labelCls}>ชนิดข้าว</label>
          <ComboBox
            options={riceOptions}
            value={order.riceId}
            onChange={(id, found) => {
              setOrder((p) => ({
                ...p,
                riceId: id,
                riceType: found?.label ?? "",
                subriceId: "",
                subriceName: "",
              }))}
            }
            placeholder="— ล็อกโดยฟอร์มสำเร็จรูป —"
            disabled={LOCK_SPEC}
            error={!!errors.riceType}
            hintRed={!!missingHints.riceType}
            clearHint={() => clearHint("riceType")}
            buttonRef={refs.riceType}
            searchable
            title="ชนิดข้าว"
            ariaLabel="ชนิดข้าว"
          />
          {errors.riceType && <p className={errorTextCls}>{errors.riceType}</p>}
        </div>

        <div>
          <label className={labelCls}>ชั้นย่อย (Sub-class)</label>
          <ComboBox
            options={subriceOptions}
            value={order.subriceId}
            onChange={(id, found) => {
              setOrder((p) => ({ ...p, subriceId: id, subriceName: found?.label ?? "" }))}
            }
            placeholder="— ล็อกโดยฟอร์มสำเร็จรูป —"
            disabled={LOCK_SPEC}
            error={!!errors.subrice}
            hintRed={!!missingHints.subrice}
            clearHint={() => clearHint("subrice")}
            buttonRef={refs.subrice}
            searchable
            title="ชั้นย่อย"
            ariaLabel="ชั้นย่อย"
          />
          {errors.subrice && <p className={errorTextCls}>{errors.subrice}</p>}
        </div>

        <div>
          <label className={labelCls}>สภาพ/เงื่อนไข</label>
          <ComboBox
            options={conditionOptions}
            value={order.conditionId}
            getValue={(o) => o.id}
            onChange={(_id, found) =>
              setOrder((p) => ({
                ...p,
                conditionId: found?.id ?? "",
                condition: found?.label ?? "",
              }))}
            placeholder="— ล็อกโดยฟอร์มสำเร็จรูป —"
            error={!!errors.condition}
            hintRed={!!missingHints.condition}
            clearHint={() => clearHint("condition")}
            buttonRef={refs.condition}
            disabled={LOCK_SPEC}
            title="สภาพ/เงื่อนไข"
            ariaLabel="สภาพ/เงื่อนไข"
          />
          {errors.condition && <p className={errorTextCls}>{errors.condition}</p>}
        </div>

        <div>
          <label className={labelCls}>ประเภทนา</label>
          <ComboBox
            options={fieldTypeOptions}
            value={order.fieldTypeId}
            getValue={(o) => o.id}
            onChange={(_id, found) =>
              setOrder((p) => ({
                ...p,
                fieldTypeId: found?.id ?? "",
                fieldType: found?.label ?? "",
              }))}
            placeholder="— ล็อกโดยฟอร์มสำเร็จรูป —"
            error={!!errors.fieldType}
            hintRed={!!missingHints.fieldType}
            clearHint={() => clearHint("fieldType")}
            buttonRef={refs.fieldType}
            disabled={LOCK_SPEC}
            title="ประเภทนา"
            ariaLabel="ประเภทนา"
          />
          {errors.fieldType && <p className={errorTextCls}>{errors.fieldType}</p>}
        </div>

        <div>
          <label className={labelCls}>ปี/ฤดูกาล</label>
          <ComboBox
            options={yearOptions}
            value={order.riceYearId}
            getValue={(o) => o.id}
            onChange={(_id, found) =>
              setOrder((p) => ({
                ...p,
                riceYearId: found?.id ?? "",
                riceYear: found?.label ?? "",
              }))}
            placeholder="— ล็อกโดยฟอร์มสำเร็จรูป —"
            error={!!errors.riceYear}
            hintRed={!!missingHints.riceYear}
            clearHint={() => clearHint("riceYear")}
            buttonRef={refs.riceYear}
            disabled={LOCK_SPEC}
            title="ปี/ฤดูกาล"
            ariaLabel="ปี/ฤดูกาล"
          />
          {errors.riceYear && <p className={errorTextCls}>{errors.riceYear}</p>}
        </div>

        {/* ประเภทธุรกิจ */}
        <div>
          <label className={labelCls}>ประเภทธุรกิจ</label>
          <ComboBox
            options={businessOptions}
            value={order.businessTypeId}
            getValue={(o) => o.id}
            onChange={(_id, found) =>
              setOrder((p) => ({
                ...p,
                businessTypeId: found?.id ?? "",
                businessType: found?.label ?? "",
              }))}
            placeholder="— ล็อกโดยฟอร์มสำเร็จรูป —"
            error={!!errors.businessType}
            hintRed={!!missingHints.businessType}
            clearHint={() => clearHint("businessType")}
            buttonRef={refs.businessType}
            disabled={LOCK_SPEC}
            title="ประเภทธุรกิจ"
            ariaLabel="ประเภทธุรกิจ"
          />
          {errors.businessType && <p className={errorTextCls}>{errors.businessType}</p>}
        </div>

        <div>
          <label className={labelCls}>โปรแกรม</label>
          <ComboBox
            options={programOptions}
            value={order.programId}
            getValue={(o) => o.id}
            onChange={(_id, found) =>
              setOrder((p) => ({
                ...p,
                programId: found?.id ?? "",
                programName: found?.label ?? "",
              }))}
            placeholder="— ล็อกโดยฟอร์มสำเร็จรูป —"
            buttonRef={refs.program}
            error={!!errors.program}
            hintRed={!!missingHints.program}
            clearHint={() => { clearHint("program"); clearError("program") }}
            disabled={LOCK_SPEC}
            title="โปรแกรม"
            ariaLabel="โปรแกรม"
          />

          {errors.program && <p className={errorTextCls}>{errors.program}</p>}
        </div>
      </div>

      {/* สาขา + คลัง */}
      <div className="mt-4 grid gap-4 md:grid-cols-3">
        <div>
          <label className={labelCls}>สาขา</label>
          <ComboBox
            options={
              branchLocked && order.branchId != null
                ? branchOptions.filter((o) => String(o.id) === String(order.branchId))
                : branchOptions
            }
            value={order.branchId}
            getValue={(o) => o.id}
            onChange={(_val, found) => {
              setOrder((p) => ({
                ...p,
                branchId: found?.id ?? null,
                branchName: found?.label ?? "",
                klangName: "",
                klangId: null,
              }))
            }}
            placeholder="— เลือกสาขา —"
            error={!!errors.branchName}
            hintRed={!!missingHints.branchName}
            clearHint={() => clearHint("branchName")}
            buttonRef={refs.branchName}
            onEnterNext={() => focusRefWithRetry(refs.klangName)}
            disabled={branchLocked}
            title="สาขา"
            ariaLabel="สาขา"
          />
          {branchLocked && <p className={helpTextCls}>สาขาถูกล็อกตามรหัสผู้ใช้</p>}
          {errors.branchName && <p className={errorTextCls}>{errors.branchName}</p>}
        </div>

        <div>
          <label className={labelCls}>คลัง</label>
          <ComboBox
            options={klangOptions}
            value={order.klangId}
            getValue={(o) => o.id}
            onChange={(_val, found) => {
              setOrder((p) => ({
                ...p,
                klangId: found?.id ?? null,
                klangName: found?.label ?? "",
              }))
            }}
            placeholder="— เลือกคลัง —"
            disabled={!order.branchId}
            error={!!errors.klangName}
            hintRed={!!missingHints.klangName}
            clearHint={() => clearHint("klangName")}
            buttonRef={refs.klangName}
            onEnterNext={() => focusRefWithRetry(refs.entryWeightKg)}
            title="คลัง"
            ariaLabel="คลัง"
          />
          {errors.klangName && <p className={errorTextCls}>{errors.klangName}</p>}
        </div>
      </div>
    </>
  )
}
