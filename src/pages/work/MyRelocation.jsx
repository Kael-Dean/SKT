// src/pages/work/MyRelocation.jsx
import { cx, baseField } from "../../lib/styles"
// คำขอย้ายสาขา — PUT /personnel/me/relocation (extended 13F) + GET /personnel/me/relocations
// AMC meeting fixes #29: สาขาที่ต้องการ ≤ 2, ตำแหน่งที่ต้องการ ≤ 2 (ไม่บังคับ) +
// accept_without_position_change (ถาม/ส่งเฉพาะเมื่อเลือกตำแหน่ง — ไม่เลือกต้องไม่ส่ง ไม่งั้น 422)
import { useEffect, useState, useCallback } from "react"
import { apiAuth } from "../../lib/api"
import SelectDropdown from "../../components/SelectDropdown"
import { Skeleton, ErrorState, EmptyState } from "../../components/ui"
import RelocationPositionPrefs from "../../components/hr/RelocationPositionPrefs"
import {
  MAX_BRANCH_PREFS,
  MAX_POSITION_PREFS,
  ACCEPT_WITHOUT_POSITION_QUESTION,
  ACCEPT_WITHOUT_POSITION_OPTIONS,
  usePositionLookup,
} from "../../lib/relocation"

const BRANCH_SLOTS = Array.from({ length: MAX_BRANCH_PREFS }, (_, i) => i + 1)
const POSITION_SLOTS = Array.from({ length: MAX_POSITION_PREFS }, (_, i) => i + 1)

const STATUS_LABEL = { pending: "รออนุมัติ", approved: "อนุมัติแล้ว", denied: "ปฏิเสธ", cancelled: "ยกเลิกแล้ว" }
const STATUS_COLOR = {
  pending:   "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300",
  approved:  "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300",
  denied:    "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300",
  cancelled: "bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400",
}
const FAMILY_STATUS_OPTIONS = [
  { value: "",         label: "— ไม่ระบุ —" },
  { value: "alive",    label: "ยังมีชีวิต" },
  { value: "deceased", label: "เสียชีวิตแล้ว" },
]

function fmtDate(d) {
  if (!d) return "—"
  try { return new Date(d).toLocaleDateString("th-TH") } catch { return d }
}

const inputCls = cx(baseField, "!rounded-lg !px-3 !py-2 md:!text-sm")
const selectCls = inputCls

const EMPTY_FORM = {
  branch_pref_1: "", branch_pref_2: "",
  reason: "", reason_2: "", reason_3: "",
  family_address: "",
  family_father_status: "", family_father_occupation: "", family_father_province: "",
  family_mother_status: "", family_mother_occupation: "", family_mother_province: "",
  family_spouse_status: "", family_spouse_occupation: "", family_spouse_province: "",
  children_count: "", children_with_self: "", children_with_spouse: "", children_with_relatives_province: "",
  siblings_total: "", siblings_deceased: "",
  position_pref_1: "", position_pref_2: "",
  accept_without_position_change: "", // "" = ยังไม่ตอบ | "true" | "false"
}

export default function MyRelocation() {
  const [tab, setTab] = useState("form")

  const [branches,        setBranches]        = useState([])
  const [loadingBranches, setLoadingBranches] = useState(true)

  const [form,       setForm]       = useState(EMPTY_FORM)
  const [submitting, setSubmitting] = useState(false)
  const [submitted,  setSubmitted]  = useState(false)
  const [formError,  setFormError]  = useState("")

  const [history,        setHistory]        = useState([])
  const [loadingHistory, setLoadingHistory] = useState(false)
  const [historyError,   setHistoryError]   = useState("")

  const [showFamily,   setShowFamily]   = useState(false)
  const [showPosition, setShowPosition] = useState(false)
  const [fieldErrors,  setFieldErrors]  = useState({})

  const { positions, loading: loadingPositions, positionName } = usePositionLookup()

  useEffect(() => {
    apiAuth("/order/branch/search")
      .then((data) => setBranches(Array.isArray(data) ? data : (data?.branches ?? [])))
      .catch(() => setBranches([]))
      .finally(() => setLoadingBranches(false))
  }, [])

  const fetchHistory = useCallback(() => {
    setLoadingHistory(true)
    setHistoryError("")
    apiAuth("/personnel/me/relocations")
      .then((data) => setHistory(Array.isArray(data) ? data : []))
      .catch((e) => setHistoryError(e.message || "โหลดประวัติไม่สำเร็จ"))
      .finally(() => setLoadingHistory(false))
  }, [])

  useEffect(() => {
    if (tab === "history") fetchHistory()
  }, [tab, fetchHistory])

  const setField = (k, v) => {
    setForm((f) => {
      const next = { ...f, [k]: v }
      // อันดับ 2 ซ้ำกับอันดับ 1 ไม่ได้ — เลือกอันดับ 1 ใหม่ให้ตรงกับอันดับ 2 → ล้างอันดับ 2
      if (k === "branch_pref_1" && v && String(v) === String(f.branch_pref_2)) next.branch_pref_2 = ""
      if (k === "position_pref_1" && v && String(v) === String(f.position_pref_2)) next.position_pref_2 = ""
      return next
    })
    setFieldErrors((e) => (e[k] ? { ...e, [k]: undefined } : e))
  }

  // เลือกตำแหน่งอย่างน้อย 1 อันดับ (และเปิดส่วนตำแหน่งอยู่) → ต้องตอบคำถาม "ถ้าเปลี่ยนตำแหน่งไม่ได้…"
  const hasPositionPref = showPosition && POSITION_SLOTS.some((n) => form[`position_pref_${n}`] !== "")

  const toggleShowPosition = () => {
    setShowPosition((v) => !v)
    setFieldErrors((e) => ({ ...e, accept_without_position_change: undefined }))
  }

  const buildBody = () => {
    const body = {}
    // branch prefs (max 2 — pref 3..5 → 422)
    for (const n of BRANCH_SLOTS) {
      const v = form[`branch_pref_${n}`]
      body[`branch_pref_${n}`] = v ? parseInt(v) : null
    }
    // reasons
    if (form.reason.trim())   body.reason   = form.reason.trim()
    if (form.reason_2.trim()) body.reason_2 = form.reason_2.trim()
    if (form.reason_3.trim()) body.reason_3 = form.reason_3.trim()
    // family (optional section)
    if (showFamily) {
      const famFields = [
        "family_address",
        "family_father_status", "family_father_occupation", "family_father_province",
        "family_mother_status", "family_mother_occupation", "family_mother_province",
        "family_spouse_status", "family_spouse_occupation", "family_spouse_province",
        "children_with_relatives_province",
      ]
      famFields.forEach((k) => { if (form[k]) body[k] = form[k] })
      ;["children_count","children_with_self","children_with_spouse","siblings_total","siblings_deceased"].forEach((k) => {
        if (form[k] !== "") body[k] = parseInt(form[k]) || 0
      })
    }
    // position prefs (optional, max 2) + accept_without_position_change — ส่งเฉพาะเมื่อเลือกตำแหน่ง
    // (ไม่เลือกตำแหน่งต้องไม่ส่ง flag นี้เลย มิฉะนั้น backend ตอบ 422)
    if (hasPositionPref) {
      for (const n of POSITION_SLOTS) {
        const v = form[`position_pref_${n}`]
        body[`position_pref_${n}`] = v ? parseInt(v) : null
      }
      body.accept_without_position_change = form.accept_without_position_change === "true"
    }
    return body
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    const errs = {}
    if (!form.branch_pref_1) errs.branch_pref_1 = "กรุณาเลือกสาขาที่ต้องการ (อันดับ 1)"
    if (hasPositionPref && form.accept_without_position_change === "") {
      errs.accept_without_position_change = "กรุณาตอบว่าถ้าเปลี่ยนตำแหน่งไม่ได้ ยังจะย้ายหรือไม่"
    }
    setFieldErrors(errs)
    if (Object.keys(errs).length > 0) {
      setFormError(Object.values(errs)[0])
      return
    }
    setFormError("")
    setSubmitting(true)
    try {
      await apiAuth("/personnel/me/relocation", { method: "PUT", body: buildBody() })
      setSubmitted(true)
    } catch (err) {
      if (err.status === 409) setFormError("มีคำขอย้ายสาขาที่รออนุมัติอยู่แล้ว กรุณารอผลก่อน")
      else if (err.status === 400) setFormError(err.message || "ไม่สามารถยื่นคำขอย้ายไปสาขาปัจจุบันได้")
      else setFormError(err.message || "เกิดข้อผิดพลาด กรุณาลองใหม่")
    } finally {
      setSubmitting(false)
    }
  }

  const branchOptions = branches.map((b) => ({ value: b.id, label: b.name ?? b.branch_name ?? `สาขา ${b.id}` }))
  const positionOptions = positions.map((p) => ({ value: p.id, label: positionName(p.id) }))

  if (submitted) {
    return (
      <div className="max-w-lg mx-auto mt-10">
        <div className="rounded-2xl bg-white dark:bg-gray-800 shadow-md ring-1 ring-gray-200/70 dark:ring-gray-700/70 p-8 text-center space-y-4">
          <div className="flex h-14 w-14 mx-auto items-center justify-center rounded-full bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400">
            <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="size-7"><path d="M20 6 9 17l-5-5" /></svg>
          </div>
          <h2 className="text-lg font-bold text-gray-900 dark:text-gray-100">ยื่นคำขอย้ายสาขาสำเร็จ</h2>
          <p className="text-sm text-gray-500 dark:text-gray-400">คำขอของคุณถูกส่งแล้ว รอ HR อนุมัติ</p>
          <div className="flex gap-3">
            <button onClick={() => { setSubmitted(false); setForm(EMPTY_FORM); setFieldErrors({}); setShowPosition(false) }}className="flex-1 h-11 rounded-xl bg-indigo-600 text-white font-semibold hover:bg-indigo-500 active:scale-[0.98] transition duration-200 cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2">
              ยื่นคำขอใหม่
            </button>
            <button onClick={() => { setSubmitted(false); setTab("history") }} className="flex-1 h-11 rounded-xl border border-gray-300 dark:border-gray-600 text-sm font-semibold text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition duration-200 cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2">
              ดูประวัติ
            </button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-2xl mx-auto space-y-5 pb-10">
      <div>
        <h1 className="text-xl font-bold text-gray-900 dark:text-gray-100">คำขอย้ายสาขา</h1>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">ยื่นคำขอย้ายสาขาและติดตามสถานะ</p>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 rounded-xl bg-gray-100 dark:bg-gray-800 p-1 w-fit">
        {[["form", "ยื่นคำขอ"], ["history", "ประวัติ"]].map(([v, label]) => (
          <button key={v} onClick={() => setTab(v)}
            className={`px-4 py-2 rounded-lg text-sm font-semibold transition-all cursor-pointer ${tab === v ? "bg-white dark:bg-gray-700 text-indigo-700 dark:text-indigo-300 shadow-sm" : "text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200"}`}>
            {label}
          </button>
        ))}
      </div>

      {/* ─── ฟอร์มยื่นคำขอ ─── */}
      {tab === "form" && (
        <>
          {formError && <ErrorState message={formError} />}

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Branch prefs */}
            <div className="rounded-2xl bg-white dark:bg-gray-800 shadow-sm ring-1 ring-gray-200/70 dark:ring-gray-700/70 p-5 space-y-3">
              <p className="text-xs font-semibold text-indigo-700 dark:text-indigo-300 uppercase tracking-wide">สาขาที่ต้องการ (เลือกได้ {MAX_BRANCH_PREFS} อันดับ)</p>
              {BRANCH_SLOTS.map((n) => {
                const key = `branch_pref_${n}`
                const labelId = `relo-branch-${n}-label`
                const errId = `relo-branch-${n}-err`
                const opts = n === 1
                  ? branchOptions
                  : [{ value: "", label: "— ไม่ระบุ —" }, ...branchOptions.filter((o) => String(o.value) !== String(form.branch_pref_1))]
                return (
                  <div key={n} className="flex flex-col gap-1">
                    <span id={labelId} className="text-xs font-medium text-gray-600 dark:text-gray-400">
                      อันดับ {n} {n === 1 ? <span className="text-red-500">*</span> : <span className="text-gray-400 dark:text-gray-500">(ถ้ามี)</span>}
                    </span>
                    <SelectDropdown
                      value={form[key]}
                      onChange={(val) => setField(key, val)}
                      placeholder={loadingBranches ? "กำลังโหลด..." : n === 1 ? "— เลือกสาขา —" : "— ไม่ระบุ —"}
                      loading={loadingBranches}
                      searchable={branchOptions.length > 8}
                      error={!!fieldErrors[key]}
                      ariaLabelledby={labelId}
                      ariaDescribedby={fieldErrors[key] ? errId : undefined}
                      options={opts}
                    />
                    {fieldErrors[key] && <p id={errId} className="text-xs text-red-600 dark:text-red-400">{fieldErrors[key]}</p>}
                  </div>
                )
              })}
            </div>

            {/* Reasons */}
            <div className="rounded-2xl bg-white dark:bg-gray-800 shadow-sm ring-1 ring-gray-200/70 dark:ring-gray-700/70 p-5 space-y-3">
              <p className="text-xs font-semibold text-indigo-700 dark:text-indigo-300 uppercase tracking-wide">เหตุผล</p>
              {[["reason","เหตุผลที่ 1"],["reason_2","เหตุผลที่ 2"],["reason_3","เหตุผลที่ 3"]].map(([k, label]) => (
                <div key={k} className="flex flex-col gap-1">
                  <label className="text-xs font-medium text-gray-600 dark:text-gray-400">{label}</label>
                  <input type="text" value={form[k]} onChange={(e) => setField(k, e.target.value)}
                    placeholder="ระบุเหตุผล (ถ้ามี)" className={inputCls} />
                </div>
              ))}
            </div>

            {/* ─── Family section (optional) ─── */}
            <div className="rounded-2xl bg-white dark:bg-gray-800 shadow-sm ring-1 ring-gray-200/70 dark:ring-gray-700/70 p-5 space-y-3">
              <button type="button" onClick={() => setShowFamily((v) => !v)} aria-expanded={showFamily}
                className="flex items-center gap-2 text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wide cursor-pointer hover:text-gray-800 dark:hover:text-gray-200 transition-colors">
                <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className={`size-3.5 transition-transform duration-200 ${showFamily ? "rotate-90" : ""}`}><path d="m9 18 6-6-6-6" /></svg>
                ข้อมูลครอบครัว (ถ้ามี)
              </button>
              {showFamily && (
                <div className="space-y-3 pt-1">
                  <div>
                    <label className="text-xs font-medium text-gray-600 dark:text-gray-400 block mb-1">ที่อยู่ครอบครัว</label>
                    <input type="text" value={form.family_address} onChange={(e) => setField("family_address", e.target.value)} className={inputCls} />
                  </div>
                  {[
                    { prefix: "family_father", label: "บิดา" },
                    { prefix: "family_mother", label: "มารดา" },
                    { prefix: "family_spouse", label: "คู่สมรส" },
                  ].map(({ prefix, label }) => (
                    <div key={prefix} className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                      <div>
                        <label className="text-xs font-medium text-gray-600 dark:text-gray-400 block mb-1">{label} — สถานะ</label>
                        <select value={form[`${prefix}_status`]} onChange={(e) => setField(`${prefix}_status`, e.target.value)} className={selectCls}>
                          {FAMILY_STATUS_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                        </select>
                      </div>
                      <div>
                        <label className="text-xs font-medium text-gray-600 dark:text-gray-400 block mb-1">อาชีพ</label>
                        <input type="text" value={form[`${prefix}_occupation`]} onChange={(e) => setField(`${prefix}_occupation`, e.target.value)} className={inputCls} />
                      </div>
                      <div>
                        <label className="text-xs font-medium text-gray-600 dark:text-gray-400 block mb-1">จังหวัด</label>
                        <input type="text" value={form[`${prefix}_province`]} onChange={(e) => setField(`${prefix}_province`, e.target.value)} className={inputCls} />
                      </div>
                    </div>
                  ))}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                    {[
                      { k: "children_count",          label: "บุตรทั้งหมด" },
                      { k: "children_with_self",       label: "อยู่กับตนเอง" },
                      { k: "children_with_spouse",     label: "อยู่กับคู่สมรส" },
                      { k: "siblings_total",           label: "พี่น้องทั้งหมด" },
                      { k: "siblings_deceased",        label: "พี่น้องเสียชีวิต" },
                    ].map(({ k, label }) => (
                      <div key={k}>
                        <label className="text-xs font-medium text-gray-600 dark:text-gray-400 block mb-1">{label}</label>
                        <input type="number" min="0" value={form[k]} onChange={(e) => setField(k, e.target.value)} className={inputCls} />
                      </div>
                    ))}
                    <div>
                      <label className="text-xs font-medium text-gray-600 dark:text-gray-400 block mb-1">บุตรอยู่กับญาติ (จังหวัด)</label>
                      <input type="text" value={form.children_with_relatives_province} onChange={(e) => setField("children_with_relatives_province", e.target.value)} className={inputCls} />
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* ─── Position prefs (optional) ─── */}
            <div className="rounded-2xl bg-white dark:bg-gray-800 shadow-sm ring-1 ring-gray-200/70 dark:ring-gray-700/70 p-5 space-y-3">
              <button type="button" onClick={toggleShowPosition} aria-expanded={showPosition} aria-controls="relo-position-section"
                className="flex items-center gap-2 text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wide cursor-pointer hover:text-gray-800 dark:hover:text-gray-200 transition-colors">
                <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className={`size-3.5 transition-transform duration-200 ${showPosition ? "rotate-90" : ""}`}><path d="m9 18 6-6-6-6" /></svg>
                ตำแหน่งที่ต้องการ (ถ้ามี — เลือกได้ {MAX_POSITION_PREFS} อันดับ)
              </button>
              {showPosition && (
                <div id="relo-position-section" className="space-y-3 pt-1">
                  {POSITION_SLOTS.map((n) => {
                    const key = `position_pref_${n}`
                    const labelId = `relo-position-${n}-label`
                    return (
                      <div key={n} className="flex flex-col gap-1">
                        <span id={labelId} className="text-xs font-medium text-gray-600 dark:text-gray-400">
                          อันดับ {n} <span className="text-gray-400 dark:text-gray-500">(ถ้ามี)</span>
                        </span>
                        {positionOptions.length > 0 || loadingPositions ? (
                          <SelectDropdown
                            value={form[key]}
                            onChange={(val) => setField(key, val)}
                            placeholder={loadingPositions ? "กำลังโหลด..." : "— ไม่ระบุ —"}
                            loading={loadingPositions}
                            searchable={positionOptions.length > 8}
                            ariaLabelledby={labelId}
                            options={[
                              { value: "", label: "— ไม่ระบุ —" },
                              ...(n === 1 ? positionOptions : positionOptions.filter((o) => String(o.value) !== String(form.position_pref_1))),
                            ]}
                          />
                        ) : (
                          // ไม่มีสิทธิ์อ่านรายการตำแหน่ง (GET /hr/positions) → กรอกรหัสตำแหน่งแทน
                          <input type="number" inputMode="numeric" min="1" value={form[key]} onChange={(e) => setField(key, e.target.value)}
                            aria-labelledby={labelId} placeholder="รหัสตำแหน่ง" className={inputCls} />
                        )}
                      </div>
                    )
                  })}

                  {hasPositionPref && (
                    <fieldset
                      className="rounded-xl bg-gray-50 dark:bg-gray-700/30 ring-1 ring-gray-200/70 dark:ring-line p-3 space-y-2"
                      aria-describedby={fieldErrors.accept_without_position_change ? "relo-accept-err" : undefined}
                    >
                      <legend className="sr-only">{ACCEPT_WITHOUT_POSITION_QUESTION}</legend>
                      <p aria-hidden="true" className="text-sm font-medium text-gray-800 dark:text-gray-200">
                        {ACCEPT_WITHOUT_POSITION_QUESTION} <span className="text-red-500">*</span>
                      </p>
                      <div className="flex flex-wrap gap-2">
                        {ACCEPT_WITHOUT_POSITION_OPTIONS.map((o) => (
                          <label key={o.value}
                            className={cx(
                              "inline-flex min-h-touch md:min-h-9 items-center gap-2 rounded-lg px-4 py-2 text-sm cursor-pointer ring-1 transition-colors duration-200",
                              "has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-indigo-500",
                              form.accept_without_position_change === o.value
                                ? "bg-indigo-50 ring-indigo-500 text-indigo-800 dark:bg-indigo-900/30 dark:text-indigo-200"
                                : "bg-white ring-gray-300 text-gray-700 hover:ring-indigo-300 dark:bg-gray-800 dark:ring-line-field dark:text-gray-200",
                              fieldErrors.accept_without_position_change && form.accept_without_position_change === "" && "!ring-red-400 dark:!ring-red-500",
                            )}>
                            <input type="radio" name="accept_without_position_change" value={o.value}
                              checked={form.accept_without_position_change === o.value}
                              onChange={(e) => setField("accept_without_position_change", e.target.value)}
                              className="accent-indigo-600" />
                            {o.label}
                          </label>
                        ))}
                      </div>
                      {fieldErrors.accept_without_position_change && (
                        <p id="relo-accept-err" className="text-xs text-red-600 dark:text-red-400">{fieldErrors.accept_without_position_change}</p>
                      )}
                    </fieldset>
                  )}
                </div>
              )}
            </div>

            <button type="submit" disabled={submitting || !form.branch_pref_1}
              className="w-full h-12 rounded-xl bg-indigo-600 text-white font-semibold text-base hover:bg-indigo-500 active:bg-indigo-700 disabled:opacity-60 disabled:cursor-not-allowed transition shadow-sm cursor-pointer">
              {submitting ? "กำลังส่ง..." : "ยื่นคำขอย้ายสาขา"}
            </button>
          </form>
        </>
      )}

      {/* ─── ประวัติ ─── */}
      {tab === "history" && (
        <div className="space-y-3">
          {loadingHistory ? (
            <div className="space-y-3" role="status" aria-busy="true">
              <span className="sr-only">กำลังโหลดประวัติคำขอย้ายสาขา…</span>
              {Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="rounded-2xl bg-white dark:bg-gray-800 ring-1 ring-gray-200/70 dark:ring-gray-700/70 shadow-sm p-4 space-y-3">
                  <div className="flex items-center gap-2">
                    <Skeleton rounded="rounded-md" className="h-4 w-1/3" />
                    <Skeleton rounded="rounded-full" className="h-5 w-16" />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <Skeleton rounded="rounded-md" className="h-3.5 w-3/4" />
                    <Skeleton rounded="rounded-md" className="h-3.5 w-1/2" />
                  </div>
                </div>
              ))}
            </div>
          ) : historyError ? (
            <ErrorState message={historyError} onRetry={fetchHistory} />
          ) : history.length === 0 ? (
            <div className="rounded-2xl bg-white dark:bg-gray-800 ring-1 ring-gray-200/70 dark:ring-gray-700/70 shadow-sm">
              <EmptyState
                title="ยังไม่มีประวัติคำขอย้ายสาขา"
                description='เมื่อคุณยื่นคำขอย้ายสาขา รายการจะแสดงที่นี่ เริ่มได้จากแท็บ "ยื่นคำขอ"'
              />
            </div>
          ) : (
            history.map((r) => (
              <div key={r.id} className="rounded-2xl bg-white dark:bg-gray-800 ring-1 ring-gray-200/70 dark:ring-gray-700/70 shadow-sm p-4 space-y-2">
                <div className="flex items-center gap-2 flex-wrap">
                  <p className="font-semibold text-indigo-700 dark:text-indigo-300">
                    {r.branch_pref_1_name ?? r.requested_branch_name ?? r.branch_name ?? `สาขาอันดับ 1`}
                  </p>
                  <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${STATUS_COLOR[r.status] ?? "bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300"}`}>
                    {STATUS_LABEL[r.status] ?? r.status}
                  </span>
                </div>
                <div className="grid grid-cols-2 gap-2 text-sm">
                  {r.created_at && (
                    <div>
                      <p className="text-xs text-gray-400 dark:text-gray-500">วันที่ยื่น</p>
                      <p className="font-medium text-gray-800 dark:text-gray-200">{fmtDate(r.created_at)}</p>
                    </div>
                  )}
                  {r.effective_date && (
                    <div>
                      <p className="text-xs text-gray-400 dark:text-gray-500">วันที่มีผล</p>
                      <p className="font-medium text-gray-800 dark:text-gray-200">{fmtDate(r.effective_date)}</p>
                    </div>
                  )}
                </div>
                {(r.branch_pref_2_name || r.branch_pref_2 != null) && (
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    สาขาอันดับ 2: <span className="text-gray-700 dark:text-gray-300">{r.branch_pref_2_name ?? branchOptions.find((o) => String(o.value) === String(r.branch_pref_2))?.label ?? `สาขา #${r.branch_pref_2}`}</span>
                  </p>
                )}
                <RelocationPositionPrefs req={r} positionName={positionName} />
                {r.reason && (
                  <p className="text-xs text-gray-500 dark:text-gray-400 bg-gray-50 dark:bg-gray-700/40 rounded-lg px-3 py-1.5">เหตุผล: {r.reason}</p>
                )}
                {r.hr_comment && (
                  <p className="text-xs text-indigo-700 dark:text-indigo-300 bg-indigo-50 dark:bg-indigo-900/20 rounded-lg px-3 py-1.5">ความเห็น HR: {r.hr_comment}</p>
                )}
              </div>
            ))
          )}
        </div>
      )}
    </div>
  )
}
