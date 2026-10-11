// src/pages/work/sales/SalesSpecSection.jsx
// ─────────────────────────────────────────────────────────────────────────────
// Sales "รายละเอียดการขาย" — the 8 template-locked spec ComboBoxes plus
// สาขา/คลัง. Default export = desktop grid (DOM identical to the pre-split
// page). `SpecCombos` / `BranchKlangFields` are the same nodes exported for
// the phone stepper (they must stay MOUNTED on phones too — plan §A3: the
// refs are part of the Enter chain and `product` is force-included).
// ─────────────────────────────────────────────────────────────────────────────
import ComboBox from "../../../components/ComboBox"
import { labelCls, helpTextCls, errorTextCls } from "../../../lib/styles"
import { isEnabledInput } from "./salesShared"

/** 8 locked spec fields — renders the field <div>s only (caller owns the grid). */
export function SpecCombos({ form }) {
  const {
    productOptions, riceOptions, subriceOptions, conditionOptions, fieldTypeOptions, yearOptions,
    businessOptions, programOptions, order, setOrder, errors, missingHints, clearHint, refs,
  } = form
  return (
    <>
      <div>
        <label className={labelCls}>ประเภทสินค้า</label>
        <ComboBox
          options={productOptions}
          value={order.productId}
          onChange={(id, found) => {
            setOrder((p) => ({ ...p, productId: id, productName: found?.label ?? "", riceId: "", riceType: "", subriceId: "", subriceName: "" }))
          }}
          placeholder="— ล็อกโดยฟอร์มสำเร็จรูป —"
          error={!!errors.product}
          hintRed={!!missingHints.product}
          clearHint={() => clearHint("product")}
          buttonRef={refs.product}
          disabled={true}
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
          onChange={(id, found) => setOrder((p) => ({ ...p, riceId: id, riceType: found?.label ?? "", subriceId: "", subriceName: "" }))}
          placeholder="— ล็อกโดยฟอร์มสำเร็จรูป —"
          disabled={true}
          error={!!errors.riceType}
          hintRed={!!missingHints.riceType}
          clearHint={() => clearHint("riceType")}
          buttonRef={refs.riceType}
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
          onChange={(id, found) => setOrder((p) => ({ ...p, subriceId: id, subriceName: found?.label ?? "" }))}
          placeholder="— ล็อกโดยฟอร์มสำเร็จรูป —"
          disabled={true}
          error={!!errors.subrice}
          hintRed={!!missingHints.subrice}
          clearHint={() => clearHint("subrice")}
          buttonRef={refs.subrice}
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
          onChange={(_id, found) => setOrder((p) => ({ ...p, conditionId: found?.id ?? "", condition: found?.label ?? "" }))}
          placeholder="— ล็อกโดยฟอร์มสำเร็จรูป —"
          error={!!errors.condition}
          hintRed={!!missingHints.condition}
          clearHint={() => clearHint("condition")}
          buttonRef={refs.condition}
          disabled={true}
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
          onChange={(_id, found) => setOrder((p) => ({ ...p, fieldTypeId: found?.id ?? "", fieldType: found?.label ?? "" }))}
          placeholder="— ล็อกโดยฟอร์มสำเร็จรูป —"
          error={!!errors.fieldType}
          hintRed={!!missingHints.fieldType}
          clearHint={() => clearHint("fieldType")}
          buttonRef={refs.fieldType}
          disabled={true}
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
          onChange={(_id, found) => setOrder((p) => ({ ...p, riceYearId: found?.id ?? "", riceYear: found?.label ?? "" }))}
          placeholder="— ล็อกโดยฟอร์มสำเร็จรูป —"
          error={!!errors.riceYear}
          hintRed={!!missingHints.riceYear}
          clearHint={() => clearHint("riceYear")}
          buttonRef={refs.riceYear}
          disabled={true}
          title="ปี/ฤดูกาล"
          ariaLabel="ปี/ฤดูกาล"
        />
        {errors.riceYear && <p className={errorTextCls}>{errors.riceYear}</p>}
      </div>

      <div>
        <label className={labelCls}>ประเภทธุรกิจ</label>
        <ComboBox
          options={businessOptions}
          value={order.businessTypeId}
          getValue={(o) => o.id}
          onChange={(_id, found) => setOrder((p) => ({ ...p, businessTypeId: found?.id ?? "", businessType: found?.label ?? "" }))}
          placeholder="— ล็อกโดยฟอร์มสำเร็จรูป —"
          error={!!errors.businessType}
          hintRed={!!missingHints.businessType}
          clearHint={() => clearHint("businessType")}
          buttonRef={refs.businessType}
          disabled={true}
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
          onChange={(_id, found) => setOrder((p) => ({ ...p, programId: found?.id ?? "", programName: found?.label ?? "" }))}
          placeholder="— ล็อกโดยฟอร์มสำเร็จรูป —"
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
export function BranchKlangFields({ form }) {
  const { branchLocked, order, setOrder, branchOptions, klangOptions, errors, missingHints, clearHint, refs, focusNext } = form
  return (
    <>
      <div>
        <label className={labelCls}>สาขา</label>
        <ComboBox
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
        {branchLocked && <p className={helpTextCls}>สาขาถูกล็อกตามรหัสผู้ใช้</p>}
        {errors.branchName && <p className={errorTextCls}>{errors.branchName}</p>}
      </div>
      <div>
        <label className={labelCls}>คลัง</label>
        <ComboBox
          options={klangOptions}
          value={order.klangId}
          getValue={(o) => o.id}
          onChange={(_val, found) => setOrder((p) => ({ ...p, klangId: found?.id ?? null, klangName: found?.label ?? "" }))}
          placeholder="— เลือกคลัง —"
          disabled={!order.branchId}
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
        {errors.klangName && <p className={errorTextCls}>{errors.klangName}</p>}
      </div>
    </>
  )
}

/* ============================ DESKTOP ============================ */
export default function SalesSpecSection({ form }) {
  return (
    <>
      {/* เลือกประเภท/ปี/โปรแกรม/ธุรกิจ */}
      <div className="grid gap-4 md:grid-cols-3">
        <SpecCombos form={form} />
      </div>

      {/* สาขา/คลัง */}
      <div className="mt-4 grid gap-4 md:grid-cols-3">
        <BranchKlangFields form={form} />
      </div>
    </>
  )
}
