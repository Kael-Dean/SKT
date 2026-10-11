// src/pages/work/sales/SalesSummary.jsx
// ─────────────────────────────────────────────────────────────────────────────
// `SalesCommentField` — the shared หมายเหตุ textarea (desktop: end of the
// รถพ่วง section; phone: step 4). Round 2 replaced the desktop tile summary
// with <OrderSummaryPanel> (Sales.jsx) — the per-trailer totals now live on
// each trailer card.
// ─────────────────────────────────────────────────────────────────────────────
import { baseField, labelCls } from "../../../lib/styles"
import { fieldId } from "./salesShared"

export function SalesCommentField({ form, mobile = false }) {
  const { refs, order, updateOrder, onEnter } = form
  return (
    <div className={mobile ? undefined : "mt-5"}>
      <label className={labelCls} htmlFor={fieldId("comment")}>{mobile ? "หมายเหตุ / คอมเมนต์ (ไม่บังคับ)" : "หมายเหตุ (ไม่บังคับ)"}</label>
      <textarea
        id={fieldId("comment")}
        ref={refs.comment}
        rows={mobile ? 3 : 2}
        className={baseField}
        value={order.comment}
        onChange={(e) => updateOrder("comment", e.target.value)}
        // Desktop: the note sits at the end of the form → Enter goes to the
        // save button (Shift+Enter = new line). Phone keeps the original chain.
        onKeyDown={mobile ? onEnter("comment") : (e) => {
          if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
            e.preventDefault()
            refs.submitBtn?.current?.focus()
          }
        }}
        placeholder="ระบุรายละเอียดเพิ่มเติม ถ้ามี"
      />
    </div>
  )
}
