// src/pages/work/LoanRequest.jsx
// ขอสินเชื่อสวัสดิการ — POST /personnel/me/loans + GET /personnel/me/loans
//
// ระเบียบเงินกู้ของสหกรณ์ (api-handoff payment-1) ที่หน้าจอนี้ต้องบังคับให้ตรงกัน:
//   L1  อายุงานขั้นต่ำ 13 เดือนจึงกู้ได้
//   L9  ดอกเบี้ยคงที่ 5% ต่อปี — ไม่ใช่ค่าที่ผู้ขอหรือ HR กรอก
//   L11 ผ่อนได้ไม่เกิน 180 งวด
//   L17 วงเงินเกิน 500,000 บาท ต้องมีหลักประกัน
//   L18/L19 ผู้ค้ำประกันต้องมี 2 คน คนละคนกัน และไม่ใช่ผู้ขอเอง
import { useEffect, useState, useCallback } from "react"
import { apiAuth } from "../../lib/api"
import { ErrorState, EmptyState, Skeleton } from "../../components/ui"

const INTEREST_RATE_TEXT = "5.00 % ต่อปี"
const MAX_MONTHS = 180
const COLLATERAL_THRESHOLD = 500000
const MIN_SERVICE_MONTHS = 13

const PURPOSE_OPTIONS = [
  { value: "education",          label: "เพื่อการศึกษา" },
  { value: "medical",            label: "เพื่อการรักษาพยาบาล" },
  { value: "housing",            label: "เพื่อที่อยู่อาศัย" },
  { value: "occupation",         label: "เพื่อการประกอบอาชีพ" },
  { value: "family_necessity",   label: "เพื่อความจำเป็นของครอบครัว" },
  { value: "debt_consolidation", label: "เพื่อรวมหนี้" },
  { value: "ceremony",           label: "เพื่อการฌาปนกิจ/พิธีการ" },
  { value: "disaster",           label: "เพื่อบรรเทาสาธารณภัย" },
  { value: "other",              label: "อื่นๆ" },
]
const PURPOSE_LABEL = Object.fromEntries(PURPOSE_OPTIONS.map((o) => [o.value, o.label]))

const STATUS_LABEL = {
  pending: "รออนุมัติ", hr_approved: "HR อนุมัติแล้ว", active: "กำลังผ่อนชำระ",
  closed: "ปิดบัญชี", rejected: "ปฏิเสธ",
}
const STATUS_COLOR = {
  pending:     "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300",
  hr_approved: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300",
  active:      "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300",
  closed:      "bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400",
  rejected:    "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300",
}

const inputCls =
  "w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 py-2 text-sm text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition"

const money = (n) =>
  n == null || n === "" ? "—" : Number(n).toLocaleString("th-TH", { minimumFractionDigits: 2 })

function fmtDate(d) {
  if (!d) return "—"
  try { return new Date(d).toLocaleDateString("th-TH") } catch { return d }
}

/** เดือนที่ทำงานมาแล้วนับจากวันบรรจุ — รองรับวันที่ที่ส่งมาเป็น พ.ศ. */
function monthsOfService(hired) {
  if (!hired) return null
  const m = String(hired).match(/^(\d{4})-(\d{2})-(\d{2})/)
  if (!m) return null
  let year = Number(m[1])
  if (year > 2400) year -= 543 // ทะเบียนประวัติบางส่วนเก็บเป็นพุทธศักราช
  const now = new Date()
  return (now.getFullYear() - year) * 12 + (now.getMonth() + 1 - Number(m[2]))
}

/** ค่างวดต่อเดือนแบบคงต้นคงดอก (ประมาณการเพื่อให้ผู้ขอเห็นภาระก่อนยื่น) */
function estimateInstalment(amount, months) {
  const a = Number(amount)
  const m = Number(months)
  if (!(a > 0) || !(m > 0)) return null
  const totalInterest = (a * 0.05 * m) / 12
  return (a + totalInterest) / m
}

const EMPTY_FORM = {
  purpose_code: "",
  purpose: "",
  amount: "",
  repayment_months: "",
  guarantor_1_id: "",
  guarantor_2_id: "",
}

export default function LoanRequest() {
  const [tab, setTab] = useState("form")

  const [profile, setProfile] = useState(null)
  const [loadingProfile, setLoadingProfile] = useState(true)

  const [form, setForm] = useState(EMPTY_FORM)
  const [errors, setErrors] = useState({})
  const [submitting, setSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [formError, setFormError] = useState("")

  const [history, setHistory] = useState([])
  const [loadingHistory, setLoadingHistory] = useState(false)
  const [historyError, setHistoryError] = useState("")

  useEffect(() => {
    apiAuth("/personnel/me")
      .then(setProfile)
      .catch(() => setProfile(null))
      .finally(() => setLoadingProfile(false))
  }, [])

  const fetchHistory = useCallback(() => {
    setLoadingHistory(true)
    setHistoryError("")
    apiAuth("/personnel/me/loans")
      .then((d) => setHistory(Array.isArray(d) ? d : []))
      .catch((e) => setHistoryError(e.message || "โหลดประวัติไม่สำเร็จ"))
      .finally(() => setLoadingHistory(false))
  }, [])

  useEffect(() => { if (tab === "history") fetchHistory() }, [tab, fetchHistory])

  const setField = (k, v) => setForm((f) => ({ ...f, [k]: v }))

  const myId = profile?.id ?? profile?.user_id ?? null
  const hired = profile?.personnel_info?.hired ?? profile?.hired ?? null
  const service = monthsOfService(hired)
  const serviceOk = service == null ? true : service >= MIN_SERVICE_MONTHS

  const amountNum = Number(form.amount)
  const needsCollateral = amountNum > COLLATERAL_THRESHOLD
  const instalment = estimateInstalment(form.amount, form.repayment_months)

  const validate = () => {
    const e = {}
    if (!form.purpose_code) e.purpose_code = "กรุณาเลือกวัตถุประสงค์"
    if (!(amountNum > 0)) e.amount = "กรุณากรอกจำนวนเงินที่ขอกู้"
    const months = Number(form.repayment_months)
    if (!(months > 0)) e.repayment_months = "กรุณากรอกจำนวนงวด"
    else if (months > MAX_MONTHS) e.repayment_months = `ผ่อนได้ไม่เกิน ${MAX_MONTHS} งวด`
    if (!form.guarantor_1_id.trim()) e.guarantor_1_id = "ต้องมีผู้ค้ำประกันคนที่ 1"
    if (!form.guarantor_2_id.trim()) e.guarantor_2_id = "ต้องมีผู้ค้ำประกันคนที่ 2"
    if (form.guarantor_1_id.trim() && form.guarantor_1_id.trim() === form.guarantor_2_id.trim())
      e.guarantor_2_id = "ผู้ค้ำประกันต้องเป็นคนละคนกัน"
    if (myId != null) {
      if (String(myId) === form.guarantor_1_id.trim()) e.guarantor_1_id = "ผู้ขอกู้ค้ำประกันตัวเองไม่ได้"
      if (String(myId) === form.guarantor_2_id.trim()) e.guarantor_2_id = "ผู้ขอกู้ค้ำประกันตัวเองไม่ได้"
    }
    setErrors(e)
    return Object.keys(e).length === 0
  }

  const handleSubmit = async (ev) => {
    ev.preventDefault()
    setFormError("")
    if (!validate()) return

    setSubmitting(true)
    try {
      await apiAuth("/personnel/me/loans", {
        method: "POST",
        body: {
          purpose: form.purpose.trim() || PURPOSE_LABEL[form.purpose_code],
          purpose_code: form.purpose_code,
          amount: Number(form.amount).toFixed(2),
          repayment_months: Number(form.repayment_months),
          guarantor_1_id: Number(form.guarantor_1_id),
          guarantor_2_id: Number(form.guarantor_2_id),
        },
      })
      setSubmitted(true)
    } catch (err) {
      setFormError(
        err.status === 422 ? `ข้อมูลไม่ผ่านการตรวจสอบ: ${err.message || "กรุณาตรวจสอบผู้ค้ำประกันและจำนวนงวด"}`
        : err.status === 409 ? "คุณมีคำขอสินเชื่อที่ยังรอพิจารณาอยู่แล้ว"
        : err.status === 404 ? "ไม่พบรหัสผู้ค้ำประกันในระบบ"
        : err.message || "ยื่นคำขอไม่สำเร็จ กรุณาลองใหม่"
      )
    } finally {
      setSubmitting(false)
    }
  }

  const resetForm = () => {
    setForm(EMPTY_FORM)
    setErrors({})
    setFormError("")
    setSubmitted(false)
  }

  const ErrMsg = ({ field }) =>
    errors[field] ? <p className="text-xs text-red-500 mt-0.5">{errors[field]}</p> : null

  if (submitted) {
    return (
      <div className="max-w-lg mx-auto mt-10">
        <div className="rounded-2xl bg-white dark:bg-gray-800 shadow-sm ring-1 ring-gray-200/70 dark:ring-gray-700/70 p-6 text-center space-y-5">
          <div className="flex h-16 w-16 mx-auto items-center justify-center rounded-full bg-emerald-100 dark:bg-emerald-900/30">
            <svg className="w-8 h-8 text-emerald-600 dark:text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <div>
            <h2 className="text-lg font-bold text-gray-900 dark:text-gray-100">ยื่นคำขอสินเชื่อสำเร็จ</h2>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1 leading-relaxed">
              คำขอถูกส่งให้ฝ่ายบุคคลพิจารณาแล้ว ติดตามสถานะได้ที่แท็บประวัติคำขอ
            </p>
          </div>
          <div className="flex gap-3">
            <button onClick={resetForm} className="flex-1 h-10 rounded-xl border border-gray-300 dark:border-gray-600 text-sm font-semibold text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700 transition cursor-pointer">
              ยื่นคำขอใหม่
            </button>
            <button onClick={() => { resetForm(); setTab("history") }} className="flex-1 h-10 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-semibold transition shadow-sm cursor-pointer">
              ดูประวัติคำขอ
            </button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-2xl mx-auto space-y-5 pb-10">
      <div>
        <h1 className="text-xl font-bold text-gray-900 dark:text-gray-100">ขอสินเชื่อสวัสดิการ</h1>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">ยื่นคำขอกู้เงินสวัสดิการและติดตามสถานะ</p>
      </div>

      <div className="flex gap-1 rounded-xl bg-gray-100 dark:bg-gray-800 p-1 w-fit">
        {[["form", "ยื่นคำขอ"], ["history", "ประวัติคำขอ"]].map(([v, label]) => (
          <button key={v} onClick={() => setTab(v)}
            className={`px-4 py-2 rounded-lg text-sm font-semibold transition-all cursor-pointer ${tab === v ? "bg-white dark:bg-gray-700 text-indigo-700 dark:text-indigo-300 shadow-sm" : "text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200"}`}>
            {label}
          </button>
        ))}
      </div>

      {tab === "form" && (
        <>
          {!loadingProfile && !serviceOk && (
            <div className="rounded-2xl bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800/60 p-4">
              <p className="text-sm font-semibold text-amber-900 dark:text-amber-200">ยังไม่ครบเงื่อนไขการกู้</p>
              <p className="text-xs text-amber-800 dark:text-amber-300 mt-0.5 leading-relaxed">
                ระเบียบกำหนดให้มีอายุงานอย่างน้อย {MIN_SERVICE_MONTHS} เดือนจึงยื่นกู้ได้
                ปัจจุบันคุณมีอายุงาน {service} เดือน — ยื่นได้เมื่อครบกำหนด
              </p>
            </div>
          )}

          {formError && <ErrorState message={formError} />}

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* วัตถุประสงค์ */}
            <div className="rounded-2xl bg-white dark:bg-gray-800 shadow-sm ring-1 ring-gray-200/70 dark:ring-gray-700/70 p-5 space-y-3">
              <p className="text-xs font-semibold text-indigo-700 dark:text-indigo-300 uppercase tracking-wide">วัตถุประสงค์</p>
              <div>
                <label className="text-xs font-medium text-gray-600 dark:text-gray-400 block mb-1">
                  ประเภทการกู้ <span className="text-red-500">*</span>
                </label>
                <select value={form.purpose_code} onChange={(e) => setField("purpose_code", e.target.value)}
                  className={`${inputCls} ${errors.purpose_code ? "border-red-400 focus:ring-red-400" : ""}`}>
                  <option value="">— เลือกวัตถุประสงค์ —</option>
                  {PURPOSE_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
                <ErrMsg field="purpose_code" />
                {form.purpose_code === "other" && (
                  <p className="text-xs text-amber-600 dark:text-amber-400 mt-1 leading-relaxed">
                    การกู้ประเภทอื่นๆ ต้องผ่านการอนุมัติจากคณะกรรมการดำเนินการ อาจใช้เวลาพิจารณานานกว่าปกติ
                  </p>
                )}
              </div>
              <div>
                <label className="text-xs font-medium text-gray-600 dark:text-gray-400 block mb-1">รายละเอียดเพิ่มเติม</label>
                <textarea rows={2} value={form.purpose} onChange={(e) => setField("purpose", e.target.value)}
                  className={`${inputCls} resize-none`} placeholder="อธิบายเหตุผลการกู้โดยย่อ" />
              </div>
            </div>

            {/* วงเงินและการผ่อนชำระ */}
            <div className="rounded-2xl bg-white dark:bg-gray-800 shadow-sm ring-1 ring-gray-200/70 dark:ring-gray-700/70 p-5 space-y-3">
              <p className="text-xs font-semibold text-indigo-700 dark:text-indigo-300 uppercase tracking-wide">วงเงินและการผ่อนชำระ</p>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-medium text-gray-600 dark:text-gray-400 block mb-1">
                    จำนวนเงินที่ขอกู้ (บาท) <span className="text-red-500">*</span>
                  </label>
                  <input type="number" min="0" step="1000" value={form.amount} onChange={(e) => setField("amount", e.target.value)}
                    className={`${inputCls} tabular-nums ${errors.amount ? "border-red-400 focus:ring-red-400" : ""}`} placeholder="0" />
                  <ErrMsg field="amount" />
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-600 dark:text-gray-400 block mb-1">
                    จำนวนงวด (เดือน) <span className="text-red-500">*</span>
                  </label>
                  <input type="number" min="1" max={MAX_MONTHS} value={form.repayment_months} onChange={(e) => setField("repayment_months", e.target.value)}
                    className={`${inputCls} tabular-nums ${errors.repayment_months ? "border-red-400 focus:ring-red-400" : ""}`} placeholder={`ไม่เกิน ${MAX_MONTHS}`} />
                  <ErrMsg field="repayment_months" />
                </div>
              </div>

              {needsCollateral && (
                <p className="text-xs text-amber-600 dark:text-amber-400 leading-relaxed">
                  วงเงินเกิน {money(COLLATERAL_THRESHOLD)} บาท ต้องมีหลักประกันเพิ่มเติมนอกเหนือจากผู้ค้ำประกัน
                </p>
              )}

              <div className="rounded-xl bg-gray-50 dark:bg-gray-700/40 px-4 py-3 grid grid-cols-2 gap-3">
                <div>
                  <p className="text-xs text-gray-500 dark:text-gray-400">อัตราดอกเบี้ย</p>
                  <p className="font-semibold text-gray-800 dark:text-gray-200 tabular-nums">{INTEREST_RATE_TEXT}</p>
                  <p className="text-xs text-gray-400 dark:text-gray-500">กำหนดโดยระเบียบ ไม่สามารถแก้ไขได้</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500 dark:text-gray-400">ค่างวดโดยประมาณ</p>
                  <p className="font-semibold text-indigo-700 dark:text-indigo-300 tabular-nums">
                    {instalment ? `${money(instalment)} บาท/เดือน` : "—"}
                  </p>
                  <p className="text-xs text-gray-400 dark:text-gray-500">ยอดจริงคำนวณเมื่ออนุมัติ</p>
                </div>
              </div>
            </div>

            {/* ผู้ค้ำประกัน */}
            <div className="rounded-2xl bg-white dark:bg-gray-800 shadow-sm ring-1 ring-gray-200/70 dark:ring-gray-700/70 p-5 space-y-3">
              <p className="text-xs font-semibold text-indigo-700 dark:text-indigo-300 uppercase tracking-wide">ผู้ค้ำประกัน</p>
              <p className="text-xs text-gray-500 dark:text-gray-400 leading-relaxed">
                ต้องมีผู้ค้ำประกัน 2 คน เป็นเจ้าหน้าที่สหกรณ์คนละคนกัน และไม่ใช่ตัวผู้ขอกู้เอง
                ผู้ค้ำประกันหนึ่งคนค้ำได้ไม่เกิน 2 สัญญา และวงเงินค้ำรวมไม่เกิน {money(COLLATERAL_THRESHOLD)} บาท
              </p>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-medium text-gray-600 dark:text-gray-400 block mb-1">
                    ผู้ค้ำประกันคนที่ 1 <span className="text-red-500">*</span>
                  </label>
                  <input type="text" value={form.guarantor_1_id} onChange={(e) => setField("guarantor_1_id", e.target.value)}
                    className={`${inputCls} tabular-nums ${errors.guarantor_1_id ? "border-red-400 focus:ring-red-400" : ""}`} placeholder="รหัสเจ้าหน้าที่" />
                  <ErrMsg field="guarantor_1_id" />
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-600 dark:text-gray-400 block mb-1">
                    ผู้ค้ำประกันคนที่ 2 <span className="text-red-500">*</span>
                  </label>
                  <input type="text" value={form.guarantor_2_id} onChange={(e) => setField("guarantor_2_id", e.target.value)}
                    className={`${inputCls} tabular-nums ${errors.guarantor_2_id ? "border-red-400 focus:ring-red-400" : ""}`} placeholder="รหัสเจ้าหน้าที่" />
                  <ErrMsg field="guarantor_2_id" />
                </div>
              </div>
            </div>

            <button type="submit" disabled={submitting || !serviceOk}
              className="w-full h-11 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-semibold shadow-sm transition disabled:opacity-60 disabled:cursor-not-allowed cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-gray-900">
              {submitting ? "กำลังยื่นคำขอ..." : "ยื่นคำขอสินเชื่อ"}
            </button>
          </form>
        </>
      )}

      {tab === "history" && (
        <>
          {historyError && <ErrorState message={historyError} onRetry={fetchHistory} />}
          {loadingHistory ? (
            <div className="space-y-3">
              {[0, 1, 2].map((i) => <Skeleton key={i} className="h-28" rounded="rounded-2xl" />)}
            </div>
          ) : history.length === 0 ? (
            <EmptyState
              title="ยังไม่เคยยื่นคำขอสินเชื่อ"
              description="คำขอที่ยื่นแล้วจะแสดงที่นี่พร้อมสถานะการพิจารณา"
            />
          ) : (
            <div className="space-y-3">
              {history.map((l) => (
                <div key={l.id} className="rounded-2xl bg-white dark:bg-gray-800 shadow-sm ring-1 ring-gray-200/70 dark:ring-gray-700/70 p-4 space-y-2">
                  <div className="flex items-center justify-between gap-2 flex-wrap">
                    <p className="font-semibold text-gray-900 dark:text-gray-100">
                      {PURPOSE_LABEL[l.purpose_code] ?? l.purpose_code ?? "สินเชื่อสวัสดิการ"}
                    </p>
                    <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${STATUS_COLOR[l.status] ?? "bg-gray-100 text-gray-600"}`}>
                      {STATUS_LABEL[l.status] ?? l.status}
                    </span>
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-sm">
                    <div>
                      <p className="text-xs text-gray-400 dark:text-gray-500">จำนวนเงิน</p>
                      <p className="font-bold text-indigo-700 dark:text-indigo-300 tabular-nums">{money(l.loan_amount ?? l.amount)} ฿</p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-400 dark:text-gray-500">จำนวนงวด</p>
                      <p className="font-medium text-gray-800 dark:text-gray-200 tabular-nums">{l.repayment_months ?? "—"} เดือน</p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-400 dark:text-gray-500">งวดละ</p>
                      <p className="font-medium text-gray-800 dark:text-gray-200 tabular-nums">{money(l.monthly_installment)} ฿</p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-400 dark:text-gray-500">วันที่ยื่น</p>
                      <p className="font-medium text-gray-800 dark:text-gray-200">{fmtDate(l.created_at)}</p>
                    </div>
                  </div>
                  {l.purpose && (
                    <p className="text-xs text-gray-500 dark:text-gray-400 bg-gray-50 dark:bg-gray-700/40 rounded-lg px-3 py-1.5">
                      {l.purpose}
                    </p>
                  )}
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  )
}
