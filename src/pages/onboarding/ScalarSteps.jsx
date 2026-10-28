// src/pages/onboarding/ScalarSteps.jsx
// The three "one form" sections: account · personal · address.
// Each step: prefill from data.values[key] → edit → "บันทึกและไปต่อ" = PUT (only the changed
// keys) + confirm. Missing fields (data.sections[key].missing, or the confirm 422) get the
// amber frame until filled.
import { useMemo, useState } from "react"
import { CalendarDays, IdCard, Plus, X } from "lucide-react"
import SelectDropdown from "../../components/SelectDropdown"
import DateInput from "../../components/ThaiDateField"
import ThaiAddressFields from "../../components/ThaiAddressFields"
import { StickyActionBar } from "../../components/ui"
import { GENDERS, diffBody, sectionMeta } from "../../lib/onboarding"
import { baseField, cx, focusRingCls, helpTextCls, readonlyFieldCls } from "../../lib/styles"
import { blank, thaiDate, useSectionFlow } from "./sectionFlow"
import { Field, Frame, MissingHint, ProblemPanel, SectionCard, StepHeader } from "./shared"

const pick = (obj, keys) => Object.fromEntries(keys.map((k) => [k, obj?.[k] ?? ""]))

/** Common wiring: form state, flags, submit. */
function useScalarSection(sectionKey, keys, data, handlers) {
  const original = useMemo(() => data?.values?.[sectionKey] ?? {}, [data, sectionKey])
  const [form, setForm] = useState(() => pick(original, keys))
  const flow = useSectionFlow(sectionKey, handlers)
  const serverMissing = data?.sections?.[sectionKey]?.missing ?? []
  const problemMissing = flow.problem?.missing ?? []

  const set = (k) => (v) => {
    setForm((p) => ({ ...p, [k]: v }))
    flow.clearField(k)
  }
  const flagged = (k) => problemMissing.includes(k) || (serverMissing.includes(k) && blank(form[k]))
  return { original, form, setForm, set, flagged, flow }
}

function StepShell({ sectionKey, flow, onSubmit, onBack, children }) {
  const meta = sectionMeta(sectionKey)
  const headingId = `ob-${sectionKey}-title`
  return (
    <form
      noValidate
      aria-labelledby={headingId}
      onSubmit={(e) => {
        e.preventDefault()
        onSubmit()
      }}
    >
      <StepHeader id={headingId} title={meta.label} purpose={meta.purpose} />
      <div className={flow.shake ? `animate-ob-shake-${flow.shake}` : undefined}>
        <SectionCard>{children}</SectionCard>
      </div>
      <ProblemPanel problem={flow.problem} />
      {/* hidden submit so Enter in a field saves */}
      <button type="submit" className="sr-only" tabIndex={-1} aria-hidden="true">บันทึก</button>
      <StickyActionBar
        secondary={onBack ? { label: "ย้อนกลับ", onClick: onBack, disabled: flow.busy } : undefined}
        primary={{ label: "บันทึกและไปต่อ", tone: "primary", onClick: onSubmit, loading: flow.busy }}
      />
    </form>
  )
}

// ─── account ─────────────────────────────────────────────────────────────────
const ACCOUNT_KEYS = ["th_first_name", "th_last_name", "first_name", "last_name", "email"]

export function AccountStep({ data, handlers, onBack }) {
  const { original, form, set, flagged, flow } = useScalarSection("account", ACCOUNT_KEYS, data, handlers)
  const input = (k, extra = {}) => (
    <input
      id={`ob-${k}`}
      type="text"
      className={baseField}
      value={form[k]}
      onChange={(e) => set(k)(e.target.value)}
      aria-describedby={flagged(k) ? `ob-${k}-hint` : undefined}
      aria-invalid={flagged(k) || undefined}
      {...extra}
    />
  )
  return (
    <StepShell sectionKey="account" flow={flow} onBack={onBack} onSubmit={() => flow.submit(diffBody(original, form, ACCOUNT_KEYS))}>
      <fieldset>
        <legend className="mb-3 text-[15px] font-semibold text-gray-900 dark:text-gray-100">ภาษาไทย</legend>
        <div className="grid gap-5 md:grid-cols-2">
          <Field
            id="ob-th_first_name"
            label="คำนำหน้าและชื่อ"
            required
            flagged={flagged("th_first_name")}
            help={<p className={helpTextCls}>เช่น นายสมชาย หรือ นางสาวสมหญิง</p>}
          >
            {input("th_first_name", { autoComplete: "given-name" })}
          </Field>
          <Field id="ob-th_last_name" label="นามสกุล" required flagged={flagged("th_last_name")}>
            {input("th_last_name", { autoComplete: "family-name" })}
          </Field>
        </div>
      </fieldset>
      <fieldset className="mt-7 border-t border-gray-100 pt-6 dark:border-line">
        <legend className="sr-only">ภาษาอังกฤษ</legend>
        <p aria-hidden="true" className="mb-3 text-[15px] font-semibold text-gray-900 dark:text-gray-100">
          ภาษาอังกฤษ
          <span className="ml-2 text-sm font-normal text-gray-500 dark:text-gray-400">ตามบัตรประชาชน</span>
        </p>
        <div className="grid gap-5 md:grid-cols-2">
          <Field id="ob-first_name" label="ชื่อ" required flagged={flagged("first_name")}>
            {input("first_name", { lang: "en", autoCapitalize: "words" })}
          </Field>
          <Field id="ob-last_name" label="นามสกุล" required flagged={flagged("last_name")}>
            {input("last_name", { lang: "en", autoCapitalize: "words" })}
          </Field>
        </div>
      </fieldset>
      <div className="mt-7 border-t border-gray-100 pt-6 dark:border-line">
        <Field id="ob-email" label="อีเมล" optional flagged={flagged("email")} className="md:max-w-md">
          {input("email", { type: "email", inputMode: "email", autoComplete: "email", lang: "en" })}
        </Field>
      </div>
    </StepShell>
  )
}

// ─── personal ────────────────────────────────────────────────────────────────
const PERSONAL_KEYS = [
  "birthday",
  "gender",
  "m_status",
  "children_number",
  "p_number",
  "e_contact",
  "line_id",
  "bank_no",
  "underlying_disease",
]

function ReadOnlyFact({ icon, label, value, onReport }) {
  const Icon = icon
  return (
    <div className="min-w-0">
      <p className="mb-1 text-[15px] font-medium text-slate-700 md:text-base dark:text-slate-200">{label}</p>
      <div className={cx(readonlyFieldCls, "flex items-center gap-2 tabular-nums")}>
        <Icon aria-hidden="true" className="size-4 shrink-0 text-gray-400" strokeWidth={1.75} />
        <span className="truncate">{value || "ยังไม่มีข้อมูล"}</span>
      </div>
      <button
        type="button"
        onClick={onReport}
        className={cx(
          "mt-1 inline-flex min-h-touch items-center rounded-lg text-sm font-medium text-indigo-700 underline-offset-4 hover:underline md:min-h-8 dark:text-indigo-300",
          focusRingCls,
        )}
      >
        แจ้ง HR ว่าไม่ถูกต้อง
      </button>
    </div>
  )
}

// ─── โรคประจำตัว: several diseases as chips, stored as one comma-separated string ──
const NONE = "ไม่มี"
const splitDiseases = (v) =>
  String(v ?? "")
    .split(/\s*[,，]\s*/)
    .map((x) => x.trim())
    .filter((x) => x && x !== NONE)

function DiseaseField({ id, value, onChange, invalid }) {
  const [draft, setDraft] = useState("")
  const items = splitDiseases(value)
  const isNone = String(value ?? "").trim() === NONE
  const commit = (list) => onChange(list.join(", "))
  const add = () => {
    const parts = splitDiseases(draft)
    if (!parts.length) return
    commit([...items, ...parts.filter((p) => !items.includes(p))])
    setDraft("")
  }
  return (
    <div className="space-y-3">
      <div className="flex items-stretch gap-2">
        <input
          id={id}
          type="text"
          className={baseField}
          value={draft}
          placeholder={items.length ? "เพิ่มโรคอื่น" : "เช่น ความดันโลหิตสูง"}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.nativeEvent.isComposing) {
              e.preventDefault()
              add()
            }
          }}
          onBlur={add}
          aria-invalid={invalid || undefined}
          aria-describedby={`${id}-help`}
        />
        <button
          type="button"
          onClick={add}
          disabled={!draft.trim()}
          aria-label="เพิ่มโรคประจำตัว"
          className={cx(
            "inline-flex shrink-0 cursor-pointer items-center gap-1.5 rounded-2xl bg-gray-100 px-4 text-[15px] font-semibold text-gray-800 ring-1 ring-inset ring-gray-200 transition-colors duration-150 hover:bg-gray-200",
            "disabled:cursor-not-allowed disabled:opacity-50 dark:bg-white/[.06] dark:text-gray-100 dark:ring-line-strong dark:hover:bg-white/[.1]",
            focusRingCls,
          )}
        >
          <Plus aria-hidden="true" className="size-4" strokeWidth={2} />
          <span className="hidden sm:inline">เพิ่ม</span>
        </button>
        <button
          type="button"
          aria-pressed={isNone}
          onClick={() => {
            setDraft("")
            onChange(isNone ? "" : NONE)
          }}
          className={cx(
            "shrink-0 cursor-pointer rounded-2xl px-4 text-[15px] font-semibold transition-colors duration-150 active:scale-[.97]",
            isNone
              ? "bg-indigo-600 text-white dark:bg-indigo-500"
              : "bg-gray-100 text-gray-800 ring-1 ring-inset ring-gray-200 hover:bg-gray-200 dark:bg-white/[.06] dark:text-gray-100 dark:ring-line-strong dark:hover:bg-white/[.1]",
            focusRingCls,
          )}
        >
          ไม่มี
        </button>
      </div>
      {items.length > 0 && (
        <ul className="flex flex-wrap gap-2" aria-label="โรคประจำตัวที่เพิ่มแล้ว">
          {items.map((d) => (
            <li
              key={d}
              className="inline-flex items-center gap-1 rounded-full bg-indigo-50 py-1 pl-3.5 pr-1 text-[15px] font-medium text-indigo-800 ring-1 ring-inset ring-indigo-200 dark:bg-indigo-500/15 dark:text-indigo-100 dark:ring-indigo-400/30"
            >
              {d}
              <button
                type="button"
                onClick={() => commit(items.filter((x) => x !== d))}
                aria-label={`ลบ ${d}`}
                className={cx(
                  "inline-flex size-8 cursor-pointer items-center justify-center rounded-full text-indigo-600 hover:bg-indigo-100 dark:text-indigo-200 dark:hover:bg-white/[.1]",
                  focusRingCls,
                )}
              >
                <X aria-hidden="true" className="size-4" strokeWidth={2} />
              </button>
            </li>
          ))}
        </ul>
      )}
      <p id={`${id}-help`} className={helpTextCls}>
        มีหลายโรค พิมพ์ทีละโรคแล้วกด “เพิ่ม” หรือ Enter ถ้าไม่มีโรคประจำตัวให้กด “ไม่มี”
      </p>
    </div>
  )
}

export function PersonalStep({ data, handlers, onBack, onReport }) {
  const { original, form, set, flagged, flow } = useScalarSection("personal", PERSONAL_KEYS, data, handlers)
  const values = data?.values?.personal ?? {}
  const mChoices = data?.m_status_choices ?? ["โสด", "สมรส", "หย่า", "หม้าย", "แยกกันอยู่"]

  const submit = () => {
    const raw = String(form.children_number ?? "").trim()
    const n = raw === "" ? null : Number(raw)
    if (n !== null && (!Number.isInteger(n) || n < 0)) {
      flow.setProblem({ missing: [], message: "จำนวนบุตรต้องเป็นตัวเลขจำนวนเต็ม 0 ขึ้นไป" })
      return
    }
    flow.submit(diffBody(original, { ...form, children_number: n }, PERSONAL_KEYS))
  }

  const text = (k, extra = {}) => (
    <input
      id={`ob-${k}`}
      type="text"
      className={baseField}
      value={form[k] ?? ""}
      onChange={(e) => set(k)(e.target.value)}
      aria-describedby={flagged(k) ? `ob-${k}-hint` : undefined}
      aria-invalid={flagged(k) || undefined}
      {...extra}
    />
  )

  return (
    <StepShell sectionKey="personal" flow={flow} onBack={onBack} onSubmit={submit}>
      <div className="grid gap-5 md:grid-cols-2">
        <Field id="ob-birthday" label="วันเกิด" required flagged={flagged("birthday")}>
          <DateInput id="ob-birthday" value={form.birthday} onChange={(e) => set("birthday")(e.target.value)} ariaLabel="วันเกิด" />
        </Field>
        <Field id="ob-gender" label="เพศ" required flagged={flagged("gender")}>
          <SelectDropdown
            id="ob-gender"
            options={GENDERS.map((g) => ({ value: g, label: g }))}
            value={form.gender}
            onChange={set("gender")}
            placeholder="เลือกเพศ"
            showSwatch={false}
            required
          />
        </Field>
        <Field
          id="ob-m_status"
          label="สถานภาพสมรส"
          required
          flagged={flagged("m_status")}
          hint="ยังไม่ได้เลือก"
        >
          <SelectDropdown
            id="ob-m_status"
            options={mChoices.map((m) => ({ value: m, label: m }))}
            value={form.m_status}
            onChange={set("m_status")}
            placeholder="เลือกสถานภาพ"
            showSwatch={false}
            required
          />
        </Field>
        <Field
          id="ob-children_number"
          label="จำนวนบุตร"
          required
          flagged={flagged("children_number")}
          help={<p className={helpTextCls}>ไม่มีบุตร ใส่ 0</p>}
        >
          {text("children_number", { inputMode: "numeric", className: cx(baseField, "tabular-nums md:max-w-40") })}
        </Field>
      </div>

      <div className="mt-7 grid gap-5 border-t border-gray-100 pt-6 md:grid-cols-2 dark:border-line">
        <Field id="ob-p_number" label="เบอร์โทรศัพท์" required flagged={flagged("p_number")}>
          {text("p_number", { type: "tel", inputMode: "tel", autoComplete: "tel", className: cx(baseField, "tabular-nums") })}
        </Field>
        <Field
          id="ob-e_contact"
          label="เบอร์ติดต่อฉุกเฉิน"
          required
          flagged={flagged("e_contact")}
          help={<p className={helpTextCls}>ญาติหรือคนใกล้ชิดที่ติดต่อได้</p>}
        >
          {text("e_contact", { type: "tel", inputMode: "tel", className: cx(baseField, "tabular-nums") })}
        </Field>
        <Field id="ob-line_id" label="LINE ID" optional flagged={flagged("line_id")}>
          {text("line_id", { autoCapitalize: "none", lang: "en" })}
        </Field>
        <Field
          id="ob-bank_no"
          label="เลขบัญชีธนาคาร"
          required
          flagged={flagged("bank_no")}
          help={<p className={helpTextCls}>บัญชีที่ใช้รับเงินเดือน</p>}
        >
          {text("bank_no", { inputMode: "numeric", className: cx(baseField, "tabular-nums") })}
        </Field>
      </div>

      <div className="mt-7 border-t border-gray-100 pt-6 dark:border-line">
        <Field
          id="ob-underlying_disease"
          label="โรคประจำตัว"
          required
          flagged={flagged("underlying_disease")}
          hint="ยังไม่ได้กรอก ถ้าไม่มีให้กด “ไม่มี”"
        >
          <DiseaseField
            id="ob-underlying_disease"
            value={form.underlying_disease ?? ""}
            onChange={set("underlying_disease")}
            invalid={flagged("underlying_disease")}
          />
        </Field>
      </div>

      <div className="mt-7 border-t border-gray-100 pt-6 dark:border-line">
        <p className="mb-3 text-sm leading-relaxed text-gray-600 dark:text-gray-300">
          ข้อมูลด้านล่าง HR เป็นผู้บันทึก ถ้าไม่ถูกต้องให้แจ้ง HR แก้ไข
        </p>
        <div className="grid gap-5 md:grid-cols-2">
          <ReadOnlyFact
            icon={IdCard}
            label="เลขบัตรประชาชน"
            value={values.cid}
            onReport={() => onReport?.("personal_info", "cid", values.cid ?? "")}
          />
          <ReadOnlyFact
            icon={CalendarDays}
            label="วันเริ่มงาน"
            value={thaiDate(values.hired, "long")}
            onReport={() => onReport?.("personal_info", "hired", values.hired ?? "")}
          />
        </div>
      </div>
    </StepShell>
  )
}

// ─── address ─────────────────────────────────────────────────────────────────
const ADDRESS_KEYS = ["h_address", "mhoo", "soi", "road", "province", "district", "sub_district", "postal_code"]
const ADDRESS_REQUIRED = ["h_address", "province", "district", "sub_district", "postal_code"]

export function AddressStep({ data, handlers, onBack }) {
  const { original, form, setForm, flagged, flow } = useScalarSection("address", ADDRESS_KEYS, data, handlers)

  const submit = () => {
    if (form.postal_code && !/^\d{5}$/.test(form.postal_code)) {
      flow.setProblem({ missing: ["postal_code"], message: "" })
      return
    }
    flow.submit(diffBody(original, form, ADDRESS_KEYS))
  }

  return (
    <StepShell sectionKey="address" flow={flow} onBack={onBack} onSubmit={submit}>
      <ThaiAddressFields
        idPrefix="ob-addr"
        value={form}
        required={ADDRESS_REQUIRED}
        onChange={(patch) => {
          setForm((p) => ({ ...p, ...patch }))
          Object.keys(patch).forEach(flow.clearField)
        }}
        frame={(k, node) => <Frame flagged={flagged(k)}>{node}</Frame>}
        renderHint={(k) =>
          flagged(k) ? (
            <MissingHint>{k === "postal_code" && form.postal_code ? "ต้องเป็นตัวเลข 5 หลัก" : "ยังไม่ได้กรอก"}</MissingHint>
          ) : null
        }
      />
    </StepShell>
  )
}
