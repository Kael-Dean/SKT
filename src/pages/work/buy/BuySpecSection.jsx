// src/pages/work/buy/BuySpecSection.jsx
// ─────────────────────────────────────────────────────────────────────────────
// "รายละเอียดการซื้อ" spec block: the 8 template-locked spec ComboBoxes +
// สาขา / คลัง. Desktop markup moved verbatim out of Buy.jsx's <form> (two
// grids, returned as a fragment so the parent tree is node-identical).
// ─────────────────────────────────────────────────────────────────────────────
import ComboBox from "../../../components/ComboBox"
import { labelCls, helpTextCls, errorTextCls } from "../../../lib/styles"
import { focusRefWithRetry } from "./buyShared"

export default function BuySpecSection({ form }) {
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
