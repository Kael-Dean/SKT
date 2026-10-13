// src/components/ProductFormPicker.jsx
// ─────────────────────────────────────────────────────────────────────────────
// ตัวเลือก "ฟอร์มสินค้า" ตัวเดียวทุกหน้า (handoff F30) — แบบเดียวกับซื้อข้าว:
// dropdown ค้นหาได้ 1 ช่อง + สเปคของฟอร์มเป็นชิปอ่านอย่างเดียวด้านล่าง.
//
//   const pf = useProductForms()
//   <ProductFormPicker forms={pf} value={formId} onChange={(id, form) => …}
//                      storageKey="damageOut.formTemplate" error={errors.form} />
//   payload.spec = specFromForm(pf.findForm(formId))
//
// storageKey → จำฟอร์มล่าสุดของหน้านั้น และเลือกให้เองตอนเปิดหน้า (ถ้ายังไม่มีค่า)
// ─────────────────────────────────────────────────────────────────────────────
import { useEffect, useRef } from "react"
import ComboBox from "./ComboBox"
import { cx, labelCls, errorTextCls, helpTextCls } from "../lib/styles"

const NO_FORM_HINT = "ไม่พบฟอร์มที่ต้องการ? ติดต่อผู้ดูแลระบบ/ฝ่ายบัญชีเพื่อเพิ่มรหัสข้าว"

const readSaved = (key) => {
  try { return key ? localStorage.getItem(key) : null } catch { return null }
}
const rememberForm = (key, id) => {
  try { if (key && id) localStorage.setItem(key, String(id)) } catch { /* storage blocked */ }
}

/** ชิปสเปคอ่านอย่างเดียว — ใช้ทั้งใต้ตัวเลือกและในแผงสรุป */
export function SpecChips({ chips, className = "", id }) {
  if (!chips?.length) return null
  return (
    <dl id={id} aria-label="สเปคสินค้าตามฟอร์ม" className={cx("flex flex-wrap items-center gap-1.5", className)}>
      {chips.map((c) => (
        <div
          key={c.key}
          title={c.name}
          className="inline-flex items-center rounded-lg bg-gray-100 px-2 py-0.5 text-sm text-gray-700 dark:bg-gray-700/60 dark:text-gray-200"
        >
          <dt className="sr-only">{c.name}</dt>
          <dd>{c.value}</dd>
        </div>
      ))}
    </dl>
  )
}

export default function ProductFormPicker({
  forms,            // ผลจาก useProductForms()
  value,
  onChange,
  storageKey,
  label = "ฟอร์มสินค้า",
  required = false, // แสดง * สีแดงหลัง label
  id = "product-form",
  error,            // string | boolean
  hintRed = false,
  clearHint,
  disabled = false,
  buttonRef,
  onEnterNext,
  showChips = true,
  className = "",
}) {
  const { forms: list = [], status, findForm, chipsFor } = forms || {}
  const selected = findForm?.(value)
  const chips = selected ? chipsFor(selected.spec) : []
  const autoPicked = useRef(false)

  // คืนค่าฟอร์มล่าสุดของหน้านี้ (ครั้งเดียว หลังโหลดเสร็จ)
  useEffect(() => {
    if (autoPicked.current || status !== "ready") return
    autoPicked.current = true
    if (value) return
    const saved = readSaved(storageKey)
    const found = saved ? findForm(saved) : null
    if (found) onChange?.(found.id, found)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status])

  const errId = `${id}-error`
  const hintId = `${id}-hint`
  const errMsg = typeof error === "string" ? error : ""

  return (
    <div className={className}>
      <label className={labelCls} htmlFor={id}>
        {label}{required && <span className="text-red-500"> *</span>}
      </label>
      <ComboBox
        id={id}
        options={list}
        value={value ?? ""}
        getValue={(o) => o.id}
        onChange={(v, found) => {
          rememberForm(storageKey, v)
          onChange?.(v, found || null)
        }}
        searchable
        placeholder={status === "loading" ? "กำลังโหลดฟอร์มสินค้า…" : "ค้นหา/เลือกฟอร์มสินค้า"}
        searchPlaceholder="พิมพ์ชื่อ เช่น 105, นาปี, ชะลอ"
        emptyText="ไม่พบฟอร์มที่ตรงกับคำค้น"
        loading={status === "loading"}
        disabled={disabled}
        error={!!error}
        hintRed={hintRed}
        clearHint={clearHint}
        buttonRef={buttonRef}
        onEnterNext={onEnterNext}
        ariaDescribedBy={errMsg ? errId : hintId}
        title={label}
        ariaLabel={label}
      />
      {errMsg && <p id={errId} className={errorTextCls}>{errMsg}</p>}
      {status === "error" && (
        <p className={errorTextCls}>โหลดฟอร์มสินค้าไม่สำเร็จ รีเฟรชหน้าแล้วลองใหม่</p>
      )}
      {showChips && chips.length > 0 && <SpecChips chips={chips} className="mt-2" />}
      {showChips && !selected && status === "ready" && !errMsg && (
        <p className={helpTextCls}>เลือกฟอร์มสินค้าเพื่อกำหนดสเปค</p>
      )}
      <p id={hintId} className="mt-1 text-xs text-slate-500 dark:text-slate-400">{NO_FORM_HINT}</p>
    </div>
  )
}
