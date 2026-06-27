import { useEffect, useMemo, useState } from "react"
import { apiAuth } from "../../../lib/api"
import Portal from "../../../components/Portal"
import SelectDropdown from "../../../components/SelectDropdown"
import ThaiDatePicker from "../../../components/ThaiDatePicker"
import {
  cx, baseField, labelCls, modalCardCls, modalTitleCls,
  submitBtnCls, resetBtnCls, badgeCls,
} from "../../../lib/styles"
import {
  ENTRY_TYPES, ENTRY_META, ENTRY_BADGE_CLS, entryLabel,
  PAYMENT_METHODS, fiscalYearOptionsFor,
  validateEntry, buildEntryBody, buildEntryPatchBody,
} from "./debtEntryMeta"

const sanitizeDecimal = (s) => {
  const clean = String(s ?? "").replace(/[^0-9.]/g, "")
  const parts = clean.split(".")
  return parts.length > 2 ? parts[0] + "." + parts.slice(1).join("") : clean
}
const sanitizeInt = (s) => String(s ?? "").replace(/\D/g, "")
const todayISO = () => new Date().toISOString().split("T")[0]

function emptyForm(entryType, branchLock) {
  return {
    entry_type: entryType,
    branch_id: branchLock ? String(branchLock.id) : "",
    program_id: "",
    fiscal_year_id: "",
    payment_method: ENTRY_META[entryType]?.needsPaymentMethod ? "cash" : "",
    amount: "",
    count: "",
    produce_id: "",
    produce_weight: "",
    produce_value: "",
    entry_date: todayISO(),
    note: "",
  }
}

function formFromRecord(rec) {
  return {
    entry_type: rec.entry_type,
    branch_id: rec.branch_id != null ? String(rec.branch_id) : "",
    program_id: rec.program_id != null ? String(rec.program_id) : "",
    fiscal_year_id: rec.fiscal_year_id != null ? String(rec.fiscal_year_id) : "",
    payment_method: rec.payment_method || "",
    amount: rec.amount != null ? String(rec.amount) : "",
    count: rec.count != null ? String(rec.count) : "",
    produce_id: rec.produce_id != null ? String(rec.produce_id) : "",
    produce_weight: rec.produce_weight != null ? String(rec.produce_weight) : "",
    produce_value: rec.produce_value != null ? String(rec.produce_value) : "",
    entry_date: rec.entry_date || todayISO(),
    note: rec.note || "",
  }
}

/**
 * Shared create/edit modal for v5 debt entries. One unified form whose fields
 * adapt to the chosen entry_type (count, payment method, produce, fiscal year
 * filtering). Used by both the DebtTracking tabs and the report tables.
 *
 * Props:
 *  - mode: "add" | "edit"
 *  - record: existing DebtEntryOut (edit only)
 *  - branches, programs, fiscalYears: reference lists
 *  - branchLock: { id, name } | null — fixes the branch (role 5 / selected branch)
 *  - initialType: default entry_type for add (default "new_debt")
 *  - onClose(), onSaved()
 */
export default function DebtEntryModal({
  mode = "add",
  record,
  branches = [],
  programs = [],
  fiscalYears = [],
  branchLock = null,
  initialType = "new_debt",
  onClose,
  onSaved,
}) {
  const isEdit = mode === "edit"
  const [form, setForm] = useState(() =>
    isEdit && record ? formFromRecord(record) : emptyForm(initialType, branchLock)
  )
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState("")
  const [produceTypes, setProduceTypes] = useState([])

  const meta = ENTRY_META[form.entry_type] || {}
  const isProduce = meta.needsPaymentMethod && form.payment_method === "produce_trade"

  function setF(key, val) { setForm((f) => ({ ...f, [key]: val })) }

  // Lazy-load produce types the first time a produce_trade form is shown.
  useEffect(() => {
    if (isProduce && produceTypes.length === 0) {
      apiAuth("/debt/lookup/produce-types")
        .then((data) => setProduceTypes(Array.isArray(data) ? data : []))
        .catch(() => {})
    }
  }, [isProduce, produceTypes.length])

  // Changing entry type on add: reset the fiscal-year choice + payment defaults
  // so an out-of-range year can't carry over from the previous type.
  function changeType(t) {
    setForm((f) => ({
      ...f,
      entry_type: t,
      fiscal_year_id: "",
      payment_method: ENTRY_META[t]?.needsPaymentMethod ? (f.payment_method || "cash") : "",
      count: ENTRY_META[t]?.needsCount ? f.count : "",
    }))
  }

  const typeOpts = ENTRY_TYPES.map((t) => ({ value: t, label: entryLabel(t) }))
  const branchOpts = branches.map((b) => ({ value: String(b.id), label: b.name }))
  const programOpts = programs
    .filter((p) => p.is_active !== false)
    .map((p) => ({ value: String(p.id), label: p.prog_name }))
  const fyOpts = useMemo(
    () => fiscalYearOptionsFor(form.entry_type, fiscalYears).map((y) => ({
      value: String(y.id), label: y.year_name,
    })),
    [form.entry_type, fiscalYears]
  )
  const produceTypeOpts = produceTypes.map((t) => ({
    value: String(t.id),
    label: t.product_type || t.name || `ผลผลิต ${t.id}`,
  }))

  function fyLabel(id) {
    return fiscalYears.find((y) => y.id === Number(id))?.year_name || String(id)
  }

  async function handleSubmit(e) {
    e?.preventDefault?.()
    const err = validateEntry(form)
    if (err) { setMsg(err); return }
    setSaving(true); setMsg("")
    try {
      if (isEdit) {
        await apiAuth(`/debt/entries/${record.id}`, {
          method: "PATCH",
          body: buildEntryPatchBody(form),
        })
      } else {
        await apiAuth("/debt/entries", { method: "POST", body: buildEntryBody(form) })
      }
      onSaved?.()
      onClose?.()
    } catch (e2) {
      setMsg(e2.message || "บันทึกไม่สำเร็จ")
    } finally {
      setSaving(false)
    }
  }

  return (
    <Portal>
      <div
        className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4"
        onClick={(e) => { if (e.target === e.currentTarget) onClose?.() }}
      >
        <div className={cx(modalCardCls, "max-w-lg w-full max-h-[90vh] overflow-y-auto")}>
          <h2 className={cx(modalTitleCls, "mb-1")}>
            {isEdit ? "แก้ไขรายการหนี้" : "บันทึกรายการหนี้"}
          </h2>

          {/* Type selector (add) or immutable badge (edit) */}
          {isEdit ? (
            <div className="mb-4 flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400">
              ประเภท:
              <span className={cx(badgeCls, ENTRY_BADGE_CLS[meta.tone] || "")}>{entryLabel(form.entry_type)}</span>
            </div>
          ) : (
            <div className="mb-4">
              <label className={labelCls}>ประเภทรายการ <span className="text-red-500">*</span></label>
              <SelectDropdown options={typeOpts} value={form.entry_type} onChange={changeType} />
            </div>
          )}

          {meta.hint && (
            <div className={cx(
              "mb-4 rounded-xl border px-4 py-2.5 text-sm",
              "border-gray-200 bg-gray-50 text-gray-600 dark:border-gray-700 dark:bg-gray-800/60 dark:text-gray-300"
            )}>
              {meta.hint}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Branch */}
            {branchLock ? (
              <div>
                <label className={labelCls}>สาขา</label>
                <p className="mt-0.5 text-sm font-medium text-slate-700 dark:text-slate-300">{branchLock.name}</p>
              </div>
            ) : isEdit ? (
              <div>
                <label className={labelCls}>สาขา</label>
                <p className="mt-0.5 text-sm font-medium text-slate-700 dark:text-slate-300">
                  {branches.find((b) => b.id === Number(form.branch_id))?.name || `สาขา ${form.branch_id}`}
                </p>
              </div>
            ) : (
              <div>
                <label className={labelCls}>สาขา <span className="text-red-500">*</span></label>
                <SelectDropdown
                  options={branchOpts}
                  value={form.branch_id}
                  onChange={(v) => setF("branch_id", v)}
                  placeholder="— เลือกสาขา —"
                />
              </div>
            )}

            {/* Program */}
            {isEdit ? (
              <div>
                <label className={labelCls}>โครงการ</label>
                <p className="mt-0.5 text-sm font-medium text-slate-700 dark:text-slate-300">
                  {programs.find((p) => p.id === Number(form.program_id))?.prog_name || `โครงการ ${form.program_id}`}
                </p>
              </div>
            ) : (
              <div>
                <label className={labelCls}>โครงการ <span className="text-red-500">*</span></label>
                <SelectDropdown
                  options={programOpts}
                  value={form.program_id}
                  onChange={(v) => setF("program_id", v)}
                  placeholder="— เลือกโครงการ —"
                />
              </div>
            )}

            {/* Fiscal year (origination) */}
            {isEdit ? (
              <div>
                <label className={labelCls}>ปีการผลิต (ต้นกำเนิดหนี้)</label>
                <p className="mt-0.5 text-sm font-medium text-slate-700 dark:text-slate-300">{fyLabel(form.fiscal_year_id)}</p>
              </div>
            ) : (
              <div>
                <label className={labelCls}>ปีการผลิต (ต้นกำเนิดหนี้) <span className="text-red-500">*</span></label>
                <SelectDropdown
                  options={fyOpts}
                  value={form.fiscal_year_id}
                  onChange={(v) => setF("fiscal_year_id", v)}
                  placeholder={fyOpts.length ? "— เลือกปี —" : "— ไม่มีปีที่เลือกได้ —"}
                />
                {fyOpts.length === 0 && (
                  <p className="mt-1 text-xs text-rose-500 dark:text-rose-400">
                    {form.entry_type === "seed"
                      ? "ไม่มีปีอดีตในระบบ — ให้ผู้ดูแลเพิ่มปีก่อน"
                      : form.entry_type === "new_debt"
                        ? "ไม่พบปีการผลิตปัจจุบันในระบบ — ให้ผู้ดูแลเพิ่มปีก่อน"
                        : "ไม่มีปีที่เลือกได้"}
                  </p>
                )}
              </div>
            )}

            {/* Payment method */}
            {meta.needsPaymentMethod && (
              <div>
                <label className={labelCls}>วิธีชำระ <span className="text-red-500">*</span></label>
                <SelectDropdown
                  options={PAYMENT_METHODS}
                  value={form.payment_method}
                  onChange={(v) => setF("payment_method", v)}
                  placeholder="— เลือกวิธีชำระ —"
                />
              </div>
            )}

            {/* Amount / produce */}
            {!isProduce && (
              <div>
                <label className={labelCls}>จำนวนเงิน (บาท) <span className="text-red-500">*</span></label>
                <input
                  className={baseField}
                  inputMode="decimal"
                  value={form.amount}
                  onChange={(e) => setF("amount", sanitizeDecimal(e.target.value))}
                  placeholder="0.00"
                />
              </div>
            )}
            {isProduce && (
              <>
                <div>
                  <label className={labelCls}>ประเภทผลผลิต <span className="text-red-500">*</span></label>
                  <SelectDropdown
                    options={produceTypeOpts}
                    value={form.produce_id}
                    onChange={(v) => setF("produce_id", v)}
                    placeholder="— เลือกประเภทผลผลิต —"
                  />
                </div>
                <div>
                  <label className={labelCls}>น้ำหนัก (กก.) <span className="text-red-500">*</span></label>
                  <input
                    className={baseField}
                    inputMode="decimal"
                    value={form.produce_weight}
                    onChange={(e) => setF("produce_weight", sanitizeDecimal(e.target.value))}
                    placeholder="0.00"
                  />
                </div>
                <div>
                  <label className={labelCls}>มูลค่าผลผลิต (บาท) <span className="text-red-500">*</span></label>
                  <input
                    className={baseField}
                    inputMode="decimal"
                    value={form.produce_value}
                    onChange={(e) => setF("produce_value", sanitizeDecimal(e.target.value))}
                    placeholder="0.00"
                  />
                  <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">มูลค่าผลผลิตจะถูกใช้เป็นยอดชำระจริง</p>
                </div>
              </>
            )}

            {/* Count */}
            {meta.needsCount && (
              <div>
                <label className={labelCls}>จำนวนราย <span className="text-red-500">*</span></label>
                <input
                  className={baseField}
                  inputMode="numeric"
                  value={form.count}
                  onChange={(e) => setF("count", sanitizeInt(e.target.value))}
                  placeholder="เช่น 10"
                />
                {form.entry_type === "full_payoff" && (
                  <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">เฉพาะรายที่ปิดบัญชีครบ (ชำระบางส่วนใช้ ‘ชำระบางส่วน’)</p>
                )}
              </div>
            )}

            {/* Date */}
            <div>
              <label className={labelCls}>วันที่บันทึก <span className="text-red-500">*</span></label>
              <ThaiDatePicker
                className={baseField}
                value={form.entry_date}
                onChange={(v) => setF("entry_date", v)}
              />
            </div>

            {/* Note */}
            <div>
              <label className={labelCls}>หมายเหตุ</label>
              <textarea
                className={cx(baseField, "resize-none")}
                rows={2}
                value={form.note}
                onChange={(e) => setF("note", e.target.value)}
                placeholder="หมายเหตุ (ไม่บังคับ)"
              />
            </div>

            {msg && <p className="text-sm text-red-500 dark:text-red-400">{msg}</p>}

            <div className="flex justify-end gap-3 pt-1">
              <button type="button" onClick={onClose} className={resetBtnCls} disabled={saving}>ยกเลิก</button>
              <button type="submit" className={submitBtnCls} disabled={saving}>
                {saving ? "กำลังบันทึก…" : "บันทึก"}
              </button>
            </div>
          </form>
        </div>
      </div>
    </Portal>
  )
}
