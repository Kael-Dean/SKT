// src/pages/onboarding/sectionFlow.js
// Shared save → confirm flow of one onboarding section (no JSX here: react-refresh rule).
//
//   const flow = useSectionFlow("personal", { onDone, onLocked, onFailed })
//   flow.submit(body)   PUT body (only when it has keys) then POST confirm
//   flow.busy · flow.problem { missing: string[], message } · flow.shake ("a" | "b" | "")
//   flow.clearField(k)  drop k from the 422 problem list once the user edits it
import { useCallback, useState } from "react"
import { confirmSection, isLockedForEdits, readValidation, saveSection } from "../../lib/onboarding"

export const blank = (v) => v == null || (typeof v === "string" && !v.trim())

export function useSectionFlow(key, { onDone, onLocked, onFailed } = {}) {
  const [busy, setBusy] = useState(false)
  const [problem, setProblem] = useState(null)
  const [shake, setShake] = useState("")

  const fail = useCallback(
    (v) => {
      setProblem(v)
      setShake((s) => (s === "a" ? "b" : "a"))
      onFailed?.(key, v)
    },
    [key, onFailed],
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

  return { submit, busy, problem, shake, clearField, setProblem }
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

/** Only non-blank keys for a new row; only changed keys for an edit. */
export function rowBody(columns, form, original) {
  const out = {}
  for (const c of columns) {
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
  columns.filter((c) => c.required && (isNew || c.key in form) && blank(form[c.key])).map((c) => c.key)
