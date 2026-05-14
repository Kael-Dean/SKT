// src/pages/work/MyRelocation.jsx
// คำขอย้ายสาขา — PUT /personnel/me/relocation (extended 13F) + GET /personnel/me/relocations
import { useEffect, useState, useCallback } from "react"
import { apiAuth } from "../../lib/api"
import SelectDropdown from "../../components/SelectDropdown"

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

const inputCls = "w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-3 py-2 text-sm text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-indigo-500/60"
const selectCls = inputCls

const EMPTY_FORM = {
  branch_pref_1: "", branch_pref_2: "", branch_pref_3: "", branch_pref_4: "", branch_pref_5: "",
  reason: "", reason_2: "", reason_3: "",
  family_address: "",
  family_father_status: "", family_father_occupation: "", family_father_province: "",
  family_mother_status: "", family_mother_occupation: "", family_mother_province: "",
  family_spouse_status: "", family_spouse_occupation: "", family_spouse_province: "",
  children_count: "", children_with_self: "", children_with_spouse: "", children_with_relatives_province: "",
  siblings_total: "", siblings_deceased: "",
  position_pref_1: "", position_pref_2: "", position_pref_3: "", position_pref_4: "", position_pref_5: "",
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

  const setField = (k, v) => setForm((f) => ({ ...f, [k]: v }))

  const buildBody = () => {
    const body = {}
    // branch prefs
    for (let n = 1; n <= 5; n++) {
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
    // position prefs (optional section)
    if (showPosition) {
      for (let n = 1; n <= 5; n++) {
        const v = form[`position_pref_${n}`]
        body[`position_pref_${n}`] = v ? parseInt(v) : null
      }
    }
    return body
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!form.branch_pref_1) { setFormError("กรุณาเลือกสาขาที่ต้องการ (อันดับ 1)"); return }
    setFormError("")
    setSubmitting(true)
    try {
      await apiAuth("/personnel/me/relocation", { method: "PUT", body: buildBody() })
      setSubmitted(true)
    } catch (err) {
      if (err.status === 409) setFormError("มีคำขอย้ายสาขาที่รออนุมัติอยู่แล้ว กรุณารอผลก่อน")
      else if (err.status === 400) setFormError("ไม่สามารถยื่นคำขอย้ายไปสาขาปัจจุบันได้")
      else setFormError(err.message || "เกิดข้อผิดพลาด กรุณาลองใหม่")
    } finally {
      setSubmitting(false)
    }
  }

  if (submitted) {
    return (
      <div className="max-w-lg mx-auto mt-10">
        <div className="rounded-2xl bg-white dark:bg-gray-800 shadow-md ring-1 ring-gray-200/70 dark:ring-gray-700/70 p-8 text-center space-y-4">
          <div className="flex h-14 w-14 mx-auto items-center justify-center rounded-full bg-emerald-100 dark:bg-emerald-900/30 text-3xl">✅</div>
          <h2 className="text-lg font-bold text-gray-900 dark:text-gray-100">ยื่นคำขอย้ายสาขาสำเร็จ!</h2>
          <p className="text-sm text-gray-500 dark:text-gray-400">คำขอของคุณถูกส่งแล้ว รอ HR อนุมัติ</p>
          <div className="flex gap-3">
            <button onClick={() => { setSubmitted(false); setForm(EMPTY_FORM) }} className="flex-1 h-11 rounded-xl bg-indigo-600 text-white font-semibold hover:bg-indigo-500 transition cursor-pointer">
              ยื่นคำขอใหม่
            </button>
            <button onClick={() => { setSubmitted(false); setTab("history") }} className="flex-1 h-11 rounded-xl border border-gray-300 dark:border-gray-600 text-sm font-semibold text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700 transition cursor-pointer">
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
          {formError && (
            <div className="rounded-xl bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 px-4 py-3 text-sm text-red-700 dark:text-red-300">❌ {formError}</div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Branch prefs */}
            <div className="rounded-2xl bg-white dark:bg-gray-800 shadow-sm ring-1 ring-gray-200/70 dark:ring-gray-700/70 p-5 space-y-3">
              <p className="text-xs font-semibold text-indigo-700 dark:text-indigo-300 uppercase tracking-wide">สาขาที่ต้องการ (เรียงลำดับ)</p>
              {[1,2,3,4,5].map((n) => (
                <div key={n} className="flex flex-col gap-1">
                  <label className="text-xs font-medium text-gray-600 dark:text-gray-400">
                    อันดับ {n} {n === 1 && <span className="text-red-500">*</span>}
                  </label>
                  <SelectDropdown
                    value={form[`branch_pref_${n}`]}
                    onChange={(val) => setField(`branch_pref_${n}`, val)}
                    placeholder={loadingBranches ? "กำลังโหลด..." : "— ไม่ระบุ —"}
                    loading={loadingBranches}
                    options={branches.map((b) => ({ value: b.id, label: b.name ?? b.branch_name ?? `สาขา ${b.id}` }))}
                  />
                </div>
              ))}
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
              <button type="button" onClick={() => setShowFamily((v) => !v)}
                className="flex items-center gap-2 text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wide cursor-pointer">
                <span>{showFamily ? "▾" : "▸"}</span> ข้อมูลครอบครัว (ถ้ามี)
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
              <button type="button" onClick={() => setShowPosition((v) => !v)}
                className="flex items-center gap-2 text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wide cursor-pointer">
                <span>{showPosition ? "▾" : "▸"}</span> ตำแหน่งที่ต้องการ (ถ้ามี)
              </button>
              {showPosition && (
                <div className="space-y-2 pt-1">
                  {[1,2,3,4,5].map((n) => (
                    <div key={n} className="flex items-center gap-2">
                      <label className="text-xs text-gray-500 dark:text-gray-400 w-16 shrink-0">อันดับ {n}</label>
                      <input type="number" value={form[`position_pref_${n}`]} onChange={(e) => setField(`position_pref_${n}`, e.target.value)}
                        placeholder="รหัสตำแหน่ง" className={inputCls} />
                    </div>
                  ))}
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
            <div className="flex justify-center py-16">
              <div className="h-8 w-8 animate-spin rounded-full border-2 border-gray-200 border-t-indigo-500 dark:border-gray-700 dark:border-t-indigo-400" />
            </div>
          ) : historyError ? (
            <div className="rounded-xl bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 px-4 py-3 text-sm text-red-700 dark:text-red-300">❌ {historyError}</div>
          ) : history.length === 0 ? (
            <div className="rounded-2xl bg-white dark:bg-gray-800 ring-1 ring-gray-200/70 dark:ring-gray-700/70 shadow-sm p-12 text-center">
              <p className="text-3xl mb-3">🚌</p>
              <p className="text-sm text-gray-500 dark:text-gray-400">ยังไม่มีประวัติคำขอย้ายสาขา</p>
            </div>
          ) : (
            history.map((r) => (
              <div key={r.id} className="rounded-2xl bg-white dark:bg-gray-800 ring-1 ring-gray-200/70 dark:ring-gray-700/70 shadow-sm p-4 space-y-2">
                <div className="flex items-center gap-2 flex-wrap">
                  <p className="font-semibold text-indigo-700 dark:text-indigo-300">
                    {r.branch_pref_1_name ?? r.requested_branch_name ?? r.branch_name ?? `สาขาอันดับ 1`}
                  </p>
                  <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${STATUS_COLOR[r.status] ?? "bg-gray-100 text-gray-600"}`}>
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
