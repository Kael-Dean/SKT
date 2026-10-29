// src/pages/onboarding/ScalarSteps.jsx
// The three "one form" sections: account · personal · address.
// Each step: prefill from data.values[key] → edit → "บันทึกและไปต่อ" = PUT (only the changed
// keys) + confirm. Missing fields (data.sections[key].missing, or the confirm 422) get the
// amber frame until filled; fields a save rejected turn red, the first one gets focus and a
// toast sums them up (sectionFlow → lib/formErrors).
import { useMemo, useState } from "react"
import { CalendarDays, IdCard, Plus, X } from "lucide-react"
import SelectDropdown from "../../components/SelectDropdown"
import DateInput from "../../components/ThaiDateField"
import ThaiAddressFields from "../../components/ThaiAddressFields"
import { StickyActionBar } from "../../components/ui"
import PrefixedNameInput from "../../components/PrefixedNameInput"
import { genderOfPrefix, prefixOf } from "../../lib/namePrefix"
import { GENDERS, diffBody, sectionMeta } from "../../lib/onboarding"
import { baseField, cx, focusRingCls, helpTextCls, readonlyFieldCls } from "../../lib/styles"
import { blank, invalidInputCls, thaiDate, useSectionFlow } from "./sectionFlow"
import { Field, Frame, MissingHint, ProblemPanel, SectionCard, StepHeader } from "./shared"

const pick = (obj, keys) => Object.fromEntries(keys.map((k) => [k, obj?.[k] ?? ""]))

/** `ob-<key>`, or the prefix trigger when that part is the invalid one. */
const scalarFieldId = (k) => {
  const prefix = document.getElementById(`ob-${k}-prefix`)
  return prefix?.getAttribute("aria-invalid") === "true" ? prefix.id : `ob-${k}`
}

/**
 * Common wiring: form state, flags, submit.
 * flagged(k) = still empty per server (amber) or rejected by the last save (red: tone(k) "error").
 * hint(k) = the inline message; describedBy(k) = aria-describedby for the control.
 */
function useScalarSection(sectionKey, keys, data, handlers, seed, fieldId = scalarFieldId) {
  const original = useMemo(() => data?.values?.[sectionKey] ?? {}, [data, sectionKey])
  const [form, setForm] = useState(() => ({ ...pick(original, keys), ...seed?.(original) }))
  const flow = useSectionFlow(sectionKey, { ...handlers, fieldId })
  const serverMissing = data?.sections?.[sectionKey]?.missing ?? []
  const problemMissing = flow.problem?.missing ?? []

  const set = (k) => (v) => {
    setForm((p) => ({ ...p, [k]: v }))
    flow.clearField(k)
  }
  const flagged = (k) => problemMissing.includes(k) || (serverMissing.includes(k) && blank(form[k]))
  const tone = (k) => (problemMissing.includes(k) ? "error" : "warn")
  const hint = (k, empty = "ยังไม่ได้กรอก") =>
    flow.problem?.hints?.[k] ?? (blank(form[k]) || tone(k) === "warn" ? empty : "ตรวจสอบข้อมูลช่องนี้")
  const describedBy = (k) => (flagged(k) ? `ob-${k}-hint` : undefined)
  const inputCls = (k, extra) => cx(baseField, extra, flagged(k) && tone(k) === "error" && invalidInputCls)
  return { original, form, setForm, set, flagged, tone, hint, describedBy, inputCls, flow }
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
  const { original, form, set, flagged, tone, hint, describedBy, inputCls, flow } = useScalarSection(
    "account",
    ACCOUNT_KEYS,
    data,
    handlers,
  )
  const input = (k, extra = {}) => (
    <input
      id={`ob-${k}`}
      type="text"
      className={inputCls(k)}
      value={form[k]}
      onChange={(e) => set(k)(e.target.value)}
      aria-describedby={describedBy(k)}
      aria-invalid={flagged(k) || undefined}
      {...extra}
    />
  )
  const field = (k) => ({ flagged: flagged(k), tone: tone(k), hint: hint(k) })
  const noPrefix = !blank(form.th_first_name) && !prefixOf(form.th_first_name)
  const submit = () => {
    if (noPrefix) {
      flow.fail({ missing: ["th_first_name"], message: "", hints: { th_first_name: "เลือกคำนำหน้าชื่อ (นาย / นาง / นางสาว)" } })
      return
    }
    flow.submit(diffBody(original, form, ACCOUNT_KEYS))
  }
  return (
    <StepShell sectionKey="account" flow={flow} onBack={onBack} onSubmit={submit}>
      <fieldset>
        <legend className="mb-3 text-[15px] font-semibold text-gray-900 dark:text-gray-100">ภาษาไทย</legend>
        <div className="grid gap-5 md:grid-cols-2">
          <Field
            id="ob-th_first_name"
            label="คำนำหน้าและชื่อ"
            required
            {...field("th_first_name")}
            hint={noPrefix ? hint("th_first_name", "ยังไม่ได้เลือกคำนำหน้า") : hint("th_first_name")}
          >
            <PrefixedNameInput
              id="ob-th_first_name"
              value={form.th_first_name}
              onChange={set("th_first_name")}
              placeholder="ชื่อ"
              autoComplete="given-name"
              invalid={flagged("th_first_name")}
              prefixInvalid={flagged("th_first_name") && noPrefix}
              describedBy={describedBy("th_first_name")}
              inputClassName={flagged("th_first_name") && tone("th_first_name") === "error" && !noPrefix ? invalidInputCls : undefined}
            />
          </Field>
          <Field id="ob-th_last_name" label="นามสกุล" required {...field("th_last_name")}>
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
          <Field id="ob-first_name" label="ชื่อ" required {...field("first_name")}>
            {input("first_name", { lang: "en", autoCapitalize: "words" })}
          </Field>
          <Field id="ob-last_name" label="นามสกุล" required {...field("last_name")}>
            {input("last_name", { lang: "en", autoCapitalize: "words" })}
          </Field>
        </div>
      </fieldset>
      <div className="mt-7 border-t border-gray-100 pt-6 dark:border-line">
        <Field id="ob-email" label="อีเมล" optional {...field("email")} className="md:max-w-md">
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

function DiseaseField({ id, value, onChange, invalid, error }) {
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
          className={cx(baseField, error && invalidInputCls)}
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
          aria-describedby={invalid ? `${id}-hint ${id}-help` : `${id}-help`}
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
  // เพศยังว่าง → ตั้งตามคำนำหน้าชื่อที่เลือกไว้ในขั้น "ชื่อและอีเมล" (ผู้ใช้เปลี่ยนได้)
  const { original, form, set, flagged, tone, hint, describedBy, inputCls, flow } = useScalarSection("personal", PERSONAL_KEYS, data, handlers, (o) => {
    const g = genderOfPrefix(prefixOf(data?.values?.account?.th_first_name))
    return blank(o.gender) && g ? { gender: g } : {}
  })
  const values = data?.values?.personal ?? {}
  const mChoices = data?.m_status_choices ?? ["โสด", "สมรส", "หย่า", "หม้าย", "แยกกันอยู่"]

  const submit = () => {
    const raw = String(form.children_number ?? "").trim()
    const n = raw === "" ? null : Number(raw)
    if (n !== null && (!Number.isInteger(n) || n < 0)) {
      flow.fail({
        missing: ["children_number"],
        message: "จำนวนบุตรต้องเป็นตัวเลขจำนวนเต็ม 0 ขึ้นไป",
        hints: { children_number: "ต้องเป็นตัวเลขจำนวนเต็ม 0 ขึ้นไป" },
      })
      return
    }
    flow.submit(diffBody(original, { ...form, children_number: n }, PERSONAL_KEYS))
  }

  const text = (k, { inputClassName, ...extra } = {}) => (
    <input
      id={`ob-${k}`}
      type="text"
      className={inputCls(k, inputClassName)}
      value={form[k] ?? ""}
      onChange={(e) => set(k)(e.target.value)}
      aria-describedby={describedBy(k)}
      aria-invalid={flagged(k) || undefined}
      {...extra}
    />
  )
  const field = (k, empty) => ({ flagged: flagged(k), tone: tone(k), hint: hint(k, empty) })
  const errorOf = (k) => flagged(k) && tone(k) === "error"

  return (
    <StepShell sectionKey="personal" flow={flow} onBack={onBack} onSubmit={submit}>
      <div className="grid gap-5 md:grid-cols-2">
        <Field id="ob-birthday" label="วันเกิด" required {...field("birthday", "ยังไม่ได้เลือก")}>
          <DateInput
            id="ob-birthday"
            value={form.birthday}
            onChange={(e) => set("birthday")(e.target.value)}
            ariaLabel="วันเกิด"
            error={errorOf("birthday")}
            aria-describedby={describedBy("birthday")}
          />
        </Field>
        <Field id="ob-gender" label="เพศ" required {...field("gender", "ยังไม่ได้เลือก")}>
          <SelectDropdown
            id="ob-gender"
            options={GENDERS.map((g) => ({ value: g, label: g }))}
            value={form.gender}
            onChange={set("gender")}
            placeholder="เลือกเพศ"
            showSwatch={false}
            required
            error={errorOf("gender")}
            ariaDescribedby={describedBy("gender")}
          />
        </Field>
        <Field
          id="ob-m_status"
          label="สถานภาพสมรส"
          required
          {...field("m_status", "ยังไม่ได้เลือก")}
        >
          <SelectDropdown
            id="ob-m_status"
            options={mChoices.map((m) => ({ value: m, label: m }))}
            value={form.m_status}
            onChange={set("m_status")}
            placeholder="เลือกสถานภาพ"
            showSwatch={false}
            required
            error={errorOf("m_status")}
            ariaDescribedby={describedBy("m_status")}
          />
        </Field>
        <Field
          id="ob-children_number"
          label="จำนวนบุตร"
          required
          {...field("children_number")}
          help={<p className={helpTextCls}>ไม่มีบุตร ใส่ 0</p>}
        >
          {text("children_number", { inputMode: "numeric", inputClassName: "tabular-nums md:max-w-40" })}
        </Field>
      </div>

      <div className="mt-7 grid gap-5 border-t border-gray-100 pt-6 md:grid-cols-2 dark:border-line">
        <Field id="ob-p_number" label="เบอร์โทรศัพท์" required {...field("p_number")}>
          {text("p_number", { type: "tel", inputMode: "tel", autoComplete: "tel", inputClassName: "tabular-nums" })}
        </Field>
        <Field
          id="ob-e_contact"
          label="เบอร์ติดต่อฉุกเฉิน"
          required
          {...field("e_contact")}
          help={<p className={helpTextCls}>ญาติหรือคนใกล้ชิดที่ติดต่อได้</p>}
        >
          {text("e_contact", { type: "tel", inputMode: "tel", inputClassName: "tabular-nums" })}
        </Field>
        <Field id="ob-line_id" label="LINE ID" optional {...field("line_id")}>
          {text("line_id", { autoCapitalize: "none", lang: "en" })}
        </Field>
        <Field
          id="ob-bank_no"
          label="เลขบัญชีธนาคาร"
          required
          {...field("bank_no")}
          help={<p className={helpTextCls}>บัญชีที่ใช้รับเงินเดือน</p>}
        >
          {text("bank_no", { inputMode: "numeric", inputClassName: "tabular-nums" })}
        </Field>
      </div>

      <div className="mt-7 border-t border-gray-100 pt-6 dark:border-line">
        <Field
          id="ob-underlying_disease"
          label="โรคประจำตัว"
          required
          {...field("underlying_disease", "ยังไม่ได้กรอก ถ้าไม่มีให้กด “ไม่มี”")}
        >
          <DiseaseField
            id="ob-underlying_disease"
            value={form.underlying_disease ?? ""}
            onChange={set("underlying_disease")}
            invalid={flagged("underlying_disease")}
            error={errorOf("underlying_disease")}
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
  const { original, form, setForm, flagged, tone, hint, flow } = useScalarSection(
    "address",
    ADDRESS_KEYS,
    data,
    handlers,
    undefined,
    (k) => `ob-addr-${k}`,
  )

  const submit = () => {
    if (form.postal_code && !/^\d{5}$/.test(form.postal_code)) {
      flow.fail({
        missing: ["postal_code"],
        message: "รหัสไปรษณีย์ต้องเป็นตัวเลข 5 หลัก",
        hints: { postal_code: "ต้องเป็นตัวเลข 5 หลัก" },
      })
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
        frame={(k, node) => (
          <div data-field className="scroll-mt-24 scroll-mb-28">
            <Frame flagged={flagged(k)} tone={tone(k)}>{node}</Frame>
          </div>
        )}
        renderHint={(k) =>
          flagged(k) ? (
            <MissingHint id={`ob-addr-${k}-hint`} tone={tone(k)}>
              {hint(k, ["province", "district", "sub_district"].includes(k) ? "ยังไม่ได้เลือก" : "ยังไม่ได้กรอก")}
            </MissingHint>
          ) : null
        }
      />
    </StepShell>
  )
}
