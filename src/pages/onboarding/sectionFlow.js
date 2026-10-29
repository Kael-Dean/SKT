// src/pages/onboarding/sectionFlow.js
// Shared save → confirm flow of one onboarding section (no JSX here: react-refresh rule).
//
//   const flow = useSectionFlow("personal", { onDone, onLocked, onFailed })
//   flow.submit(body)   PUT body (only when it has keys) then POST confirm
//   flow.busy · flow.problem { missing: string[], message } · flow.shake ("a" | "b" | "")
//   flow.clearField(k)  drop k from the 422 problem list once the user edits it
//   flow.fail(problem)  client-side rejection: same summary / shake / focus as a server 422
//
// problem = { missing: string[], message, hints?: { [key]: "inline text" } }.
// Every failure toasts a short summary and focuses the first flagged field
// (`fieldId(key)` → DOM id; unknown keys fall back to `fallbackId`, default the problem panel).
import { useCallback, useState } from "react"
import { reportInvalid } from "../../lib/formErrors"
import { confirmSection, isLockedForEdits, missingLabel, readValidation, saveSection } from "../../lib/onboarding"

export const blank = (v) => v == null || (typeof v === "string" && !v.trim())

/** id of the step's <ProblemPanel> — focus fallback when no field matches. */
export const PROBLEM_PANEL_ID = "ob-problem"

/** Red border on a plain baseField input once a save rejected it. */
export const invalidInputCls = "!border-red-500 dark:!border-red-400"

/** Toast + focus for a failed save. `fieldId(k)` → DOM id or null (non-field codes). */
export function reportProblem(problem, fieldId, fallbackId = PROBLEM_PANEL_ID) {
  const missing = problem?.missing ?? []
  const ids = missing.map((k) => fieldId?.(k)).filter(Boolean)
  const fieldsOnly = ids.length === missing.length
  reportInvalid({
    ids,
    count: missing.length,
    fallbackId,
    ...(problem?.message
      ? { title: "ข้อมูลไม่ถูกต้อง", description: problem.message }
      : fieldsOnly
        ? {}
        : { title: "ยังกรอกไม่ครบ", description: missing.map(missingLabel).join(" · ") }),
  })
}

/** Inline Thai error for an empty required column: "เลือก…" for pickers, "กรอก…" for text. */
export const requiredHint = (c) =>
  `${["select", "year", "date", "prefixedName"].includes(c.type) ? "เลือก" : "กรอก"}${c.label}`

export function useSectionFlow(key, { onDone, onLocked, onFailed, fieldId, fallbackId } = {}) {
  const [busy, setBusy] = useState(false)
  const [problem, setProblem] = useState(null)
  const [shake, setShake] = useState("")

  const fail = useCallback(
    (v) => {
      setProblem(v)
      setShake((s) => (s === "a" ? "b" : "a"))
      reportProblem(v, fieldId, fallbackId)
      onFailed?.(key, v)
    },
    [key, onFailed, fieldId, fallbackId],
  )

  const submit = useCallback(
    async (body) => {
      if (busy) return
      setBusy(true)
      setProblem(null)
      try {
        if (body && Object.keys(body).length) await saveSection(key, body)
        const payload = await confirmSection(key)
        onDone?.(payload)
      } catch (err) {
        if (err?.onboardingRequired) return
        if (isLockedForEdits(err)) onLocked?.()
        else fail(readValidation(err))
      } finally {
        setBusy(false)
      }
    },
    [busy, key, onDone, onLocked, fail],
  )

  const clearField = useCallback((k) => {
    setProblem((p) => (p && p.missing.includes(k) ? { ...p, missing: p.missing.filter((m) => m !== k) } : p))
  }, [])

  return { submit, busy, problem, shake, clearField, setProblem, fail }
}

/** Thai date "1 พ.ค. 2533" from YYYY-MM-DD (null-safe). */
export function thaiDate(iso, month = "short") {
  if (!iso) return ""
  const d = new Date(`${String(iso).slice(0, 10)}T00:00:00`)
  if (Number.isNaN(d.getTime())) return String(iso)
  return d.toLocaleDateString("th-TH", { day: "numeric", month, year: "numeric" })
}

/** "มิ.ย. 2551" (month + BE year) for row ranges. */
export function thaiMonthYear(iso) {
  if (!iso) return ""
  const d = new Date(`${String(iso).slice(0, 10)}T00:00:00`)
  if (Number.isNaN(d.getTime())) return String(iso)
  return d.toLocaleDateString("th-TH", { month: "short", year: "numeric" })
}

/** "นายสมชาย" → "สมชาย" for a friendly greeting. */
export function firstNameOnly(thFirst) {
  return String(thFirst ?? "")
    .replace(/^(นางสาว|นาย|นาง|น\.ส\.|ด\.ช\.|ด\.ญ\.|ดร\.|ว่าที่\s*ร\.ต\.)\s*/, "")
    .trim()
}

const hiddenIn = (c, form) => Boolean(c.showIf && !c.showIf(form))

/**
 * Only non-blank keys for a new row; only changed keys for an edit.
 * A hidden (showIf false) non-checkbox column is left out — on an edit it is cleared (null)
 * when the stored row still holds a value (e.g. lifetime license → no expiry date).
 */
export function rowBody(columns, form, original) {
  const out = {}
  for (const c of columns) {
    if (c.type !== "checkbox" && hiddenIn(c, form)) {
      if (original && !blank(original[c.key])) out[c.key] = null
      continue
    }
    let v = form[c.key]
    if (typeof v === "string") v = v.trim()
    if (c.type === "checkbox") v = Boolean(v)
    if (original) {
      const before = original[c.key] ?? (c.type === "checkbox" ? false : "")
      if ((before ?? "") === (v ?? "")) continue
      out[c.key] = v === "" ? null : v
    } else if (!blank(v) || c.type === "checkbox") out[c.key] = v === "" ? null : v
  }
  return out
}

/** Client check for the key fields of a new row (backend rule §3.3). */
export const missingKeys = (columns, form, isNew) =>
  columns.filter((c) => c.required && !hiddenIn(c, form) && (isNew || c.key in form) && blank(form[c.key])).map((c) => c.key)
