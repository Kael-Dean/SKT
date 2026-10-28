// src/pages/onboarding/RowEditor.jsx
// Add / edit one row of a list section (family, education, work, criminal) in a <Sheet>,
// plus the row list item used by both list steps.
import { useId, useState } from "react"
import { Pencil, Trash2 } from "lucide-react"
import SelectDropdown from "../../components/SelectDropdown"
import DateInput from "../../components/ThaiDateField"
import { Sheet } from "../../components/ui"
import { baseField, cx, focusRingCls, helpTextCls, iconBtnCls, neutralBtnCls, submitBtnCls } from "../../lib/styles"
import { Field } from "./shared"

const emptyOf = (columns) =>
  Object.fromEntries(columns.map((c) => [c.key, c.type === "checkbox" ? false : ""]))

function EditorBody({ columns, initial, formId, onSubmit, error, missing }) {
  const [form, setForm] = useState(() => ({ ...emptyOf(columns), ...(initial ?? {}) }))
  const uid = useId()
  const set = (k, v) => setForm((p) => ({ ...p, [k]: v }))
  return (
    <form
      id={formId}
      noValidate
      onSubmit={(e) => {
        e.preventDefault()
        onSubmit(form)
      }}
      className="grid gap-5 md:grid-cols-2"
    >
      {columns.map((c) => {
        const id = `${uid}-${c.key}`
        const flagged = missing.includes(c.key)
        if (c.type === "checkbox") {
          return (
            <label
              key={c.key}
              htmlFor={id}
              className="flex min-h-touch cursor-pointer items-center gap-3 rounded-2xl bg-gray-50 px-4 py-3 ring-1 ring-gray-200/70 md:col-span-2 dark:bg-white/[.03] dark:ring-line"
            >
              <input
                id={id}
                type="checkbox"
                checked={Boolean(form[c.key])}
                onChange={(e) => set(c.key, e.target.checked)}
                className="size-5 shrink-0 cursor-pointer rounded accent-indigo-600"
              />
              <span className="text-[15px] font-medium text-gray-800 dark:text-gray-100">{c.label}</span>
              {c.help && <span className="ml-auto text-sm text-gray-500 dark:text-gray-400">{c.help}</span>}
            </label>
          )
        }
        return (
          <Field
            key={c.key}
            id={id}
            label={c.label}
            required={c.required}
            flagged={flagged}
            className={c.wide ? "md:col-span-2" : ""}
            help={c.help ? <p className={helpTextCls}>{c.help}</p> : null}
          >
            {c.type === "select" ? (
              <SelectDropdown
                id={id}
                options={c.options.map((o) => ({ value: o, label: o }))}
                value={form[c.key] ?? ""}
                onChange={(v) => set(c.key, v)}
                placeholder={c.placeholder ?? "เลือก"}
                showSwatch={false}
                required={c.required}
              />
            ) : c.type === "date" ? (
              <DateInput id={id} value={form[c.key] ?? ""} onChange={(e) => set(c.key, e.target.value)} ariaLabel={c.label} />
            ) : (
              <input
                id={id}
                type="text"
                className={baseField}
                value={form[c.key] ?? ""}
                placeholder={c.placeholder}
                onChange={(e) => set(c.key, e.target.value)}
                aria-invalid={flagged || undefined}
              />
            )}
          </Field>
        )
      })}
      {error && (
        <p role="alert" className="rounded-xl bg-red-50 px-3 py-2.5 text-sm leading-relaxed text-red-700 md:col-span-2 dark:bg-red-500/10 dark:text-red-300">
          {error}
        </p>
      )}
    </form>
  )
}

/**
 * <RowEditorSheet open title columns initial busy error missing onSubmit(form) onClose />
 * `initial` = the row being edited (null → add). The body remounts per open/row.
 */
export function RowEditorSheet({ open, title, subtitle, columns, initial, busy, error, missing = [], onSubmit, onClose, openKey }) {
  const formId = useId()
  return (
    <Sheet
      open={open}
      onClose={onClose}
      title={title}
      subtitle={subtitle}
      busy={busy}
      size="md"
      footer={
        <div className="grid grid-cols-2 gap-3 md:flex md:justify-end md:gap-2">
          <button type="button" onClick={onClose} disabled={busy} className={cx(neutralBtnCls, "h-12 md:h-10")}>
            ยกเลิก
          </button>
          <button
            type="submit"
            form={formId}
            disabled={busy}
            aria-busy={busy || undefined}
            className={cx(submitBtnCls, "h-12 rounded-xl px-5 py-0 text-[15px] md:h-10 md:text-sm hover:scale-100")}
          >
            {busy ? "กำลังบันทึก…" : "บันทึก"}
          </button>
        </div>
      }
    >
      {open && (
        <EditorBody
          key={openKey}
          columns={columns}
          initial={initial}
          formId={formId}
          onSubmit={onSubmit}
          error={error}
          missing={missing}
        />
      )}
    </Sheet>
  )
}

/** One row in a list section. `badge` / `extra` slots for family. */
export function RowItem({ title, lines = [], badge, extra, onEdit, onDelete, editLabel, deleteLabel }) {
  return (
    <li className="flex items-start gap-3 py-4 first:pt-1 last:pb-1">
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <p className="text-base font-semibold leading-relaxed text-gray-900 dark:text-gray-100">{title}</p>
          {badge}
        </div>
        {lines.filter(Boolean).map((l, i) => (
          <p key={i} className="text-[15px] leading-relaxed text-gray-600 dark:text-gray-300">
            {l}
          </p>
        ))}
        {extra}
      </div>
      <div className="flex shrink-0 items-center gap-1">
        {onEdit && (
          <button type="button" onClick={onEdit} aria-label={editLabel} className={iconBtnCls}>
            <Pencil aria-hidden="true" className="size-[18px]" strokeWidth={1.75} />
          </button>
        )}
        {onDelete && (
          <button
            type="button"
            onClick={onDelete}
            aria-label={deleteLabel}
            className={cx(iconBtnCls, "hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-500/10 dark:hover:text-red-400")}
          >
            <Trash2 aria-hidden="true" className="size-[18px]" strokeWidth={1.75} />
          </button>
        )}
      </div>
    </li>
  )
}

/** Dashed "add" button that sits under (or instead of) the list. */
export function AddRowButton({ onClick, children, disabled }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={cx(
        "flex min-h-12 w-full cursor-pointer items-center justify-center gap-2 rounded-2xl border border-dashed border-gray-300 px-4 py-3",
        "text-[15px] font-semibold text-indigo-700 transition-colors duration-150 hover:border-indigo-400 hover:bg-indigo-50/60",
        "disabled:cursor-not-allowed disabled:opacity-50 dark:border-white/15 dark:text-indigo-300 dark:hover:border-indigo-400/60 dark:hover:bg-indigo-500/10",
        focusRingCls,
      )}
    >
      {children}
    </button>
  )
}
