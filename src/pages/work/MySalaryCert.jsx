// src/pages/work/MySalaryCert.jsx
// ─────────────────────────────────────────────────────────────────────────────
// ขอหนังสือรับรองเงินเดือน — ฝั่งพนักงาน (3M · 13G, handoff "3M Client Document Integration")
//
//   POST /personnel/me/salary-cert-requests   { copies_count, purpose_type, ...ช่องตามวัตถุประสงค์ }
//        purpose_type ∈ document | loan_self | loan_guarantee (ค่าอื่น → 422) → 201 { status, id }
//   GET  /personnel/me/salary-cert-requests   ประวัติของฉัน (status pending|approved|denied, supervisor_comment)
//
// ฝั่ง HR (อนุมัติ/ปฏิเสธ/พิมพ์ PDF) อยู่ที่ HRSalaryCertTab — ตัวหนังสือรับรองออกจาก HR เท่านั้น
// (backend ไม่มี endpoint ให้พนักงานดาวน์โหลดเอง) → อนุมัติแล้วบอกให้รับที่ฝ่ายบุคคล; ผู้ที่มีสิทธิ์
// hr.salaryCert.print (HR/ผู้จัดการ) ดาวน์โหลดหนังสือของตัวเองได้จากรายการนี้เลย
// ─────────────────────────────────────────────────────────────────────────────
import { useCallback, useEffect, useId, useState } from "react"
import { apiAuth, apiDownload } from "../../lib/api"
import { apiDetail } from "../../lib/apiErrors"
import { useCan } from "../../lib/permissions"
import { money, thaiDate } from "../../lib/loans"
import {
  cx, baseField, cardCls, labelCls, helpTextCls, errorTextCls, primaryBtnCls, neutralBtnCls, focusRingCls,
} from "../../lib/styles"
import { Badge, EmptyState, ErrorState, Skeleton, toast } from "../../components/ui"
import PageTitle from "../../components/PageTitle"
import FormApplicantHeader from "../../components/FormApplicantHeader"

const MAX_COPIES = 10

const PURPOSE_OPTIONS = Object.freeze([
  { value: "document",       label: "เพื่อใช้เป็นหลักฐาน",     hint: "ยื่นประกอบเอกสาร เช่น ขอวีซ่า เช่าที่อยู่" },
  { value: "loan_self",      label: "เพื่อกู้เงิน",            hint: "ใช้ยื่นธนาคาร/สถาบันการเงินในนามตัวเอง" },
  { value: "loan_guarantee", label: "เพื่อค้ำประกันเงินกู้",   hint: "ค้ำประกันเงินกู้ให้ผู้อื่น" },
])
const PURPOSE_LABEL = Object.fromEntries(PURPOSE_OPTIONS.map((o) => [o.value, o.label]))

const STATUS_LABEL = { pending: "รออนุมัติ", approved: "อนุมัติแล้ว", denied: "ไม่อนุมัติ" }
const STATUS_TONE = { pending: "pending", approved: "success", denied: "danger" }

const fieldCls = cx(baseField, "!rounded-lg !px-3 !py-2 md:!text-sm")
const errBorder = "!border-red-500 dark:!border-red-400"

const EMPTY_FORM = {
  copies_count: "1",
  purpose_type: "",
  purpose_detail: "",
  recipient_name: "",
  loan_bank: "",
  loan_branch_name: "",
  loan_purpose: "",
  loan_amount: "",
  guarantor_for_name: "",
}

// ช่องที่ใช้ต่อวัตถุประสงค์ — ส่งเฉพาะช่องของวัตถุประสงค์ที่เลือก
const FIELDS_BY_PURPOSE = {
  document:       ["purpose_detail", "recipient_name"],
  loan_self:      ["loan_bank", "loan_branch_name", "loan_purpose", "loan_amount"],
  loan_guarantee: ["guarantor_for_name", "loan_bank", "loan_branch_name", "loan_amount"],
}
const FIELD_ORDER = ["copies_count", "purpose_type", "purpose_detail", "guarantor_for_name", "loan_bank", "loan_amount"]

const num = (v) => {
  const s = String(v ?? "").replace(/,/g, "").trim()
  return s === "" ? null : Number(s)
}

// ─── ประวัติ ─────────────────────────────────────────────────────────────────

function RequestDetail({ r }) {
  const rows = []
  if (r.purpose_type === "document") {
    if (r.purpose_detail) rows.push(["ใช้เพื่อ", r.purpose_detail])
    if (r.recipient_name) rows.push(["ยื่นต่อ", r.recipient_name])
  } else {
    if (r.guarantor_for_name) rows.push(["ค้ำประกันให้", r.guarantor_for_name])
    const bank = [r.loan_bank, r.loan_branch_name].filter(Boolean).join(" ")
    if (bank) rows.push(["สถาบันการเงิน", bank])
    if (r.loan_purpose) rows.push(["กู้เพื่อ", r.loan_purpose])
    if (r.loan_amount != null && r.loan_amount !== "") rows.push(["วงเงินกู้", `${money(r.loan_amount)} บาท`])
  }
  if (!rows.length) return null
  return (
    <dl className="grid grid-cols-[auto_minmax(0,1fr)] gap-x-3 gap-y-0.5 text-sm">
      {rows.map(([k, v]) => (
        <div key={k} className="contents">
          <dt className="text-gray-500 dark:text-gray-400">{k}</dt>
          <dd className={cx("break-words text-gray-800 dark:text-gray-200", k === "วงเงินกู้" && "tabular-nums")}>{v}</dd>
        </div>
      ))}
    </dl>
  )
}

function HistoryItem({ r, canPrint, downloading, onDownload, highlight }) {
  const status = r.status
  return (
    <li className={cx("space-y-2 py-3.5 transition-colors duration-300 first:pt-0 last:pb-0", highlight && "-mx-2 rounded-lg bg-emerald-50/70 px-2 dark:bg-emerald-500/5")}>
      <div className="flex flex-wrap items-start justify-between gap-x-3 gap-y-1">
        <div className="min-w-0">
          <p className="font-semibold text-gray-900 dark:text-gray-100">
            {PURPOSE_LABEL[r.purpose_type] ?? r.purpose_type ?? "หนังสือรับรองเงินเดือน"}
          </p>
          <p className="text-xs tabular-nums text-gray-500 dark:text-gray-400">
            ยื่น {thaiDate(r.requested_at || r.created_at, { long: true })} · {r.copies_count ?? 1} ฉบับ · #{r.id}
          </p>
        </div>
        <Badge tone={STATUS_TONE[status] ?? "neutral"}>{STATUS_LABEL[status] ?? status ?? "—"}</Badge>
      </div>

      <RequestDetail r={r} />

      {r.supervisor_comment && (
        <p className={cx(
          "rounded-lg px-3 py-1.5 text-sm break-words",
          status === "denied"
            ? "bg-red-50 text-red-800 dark:bg-red-500/10 dark:text-red-200"
            : "bg-gray-50 text-gray-700 dark:bg-white/[.04] dark:text-gray-300",
        )}>
          {status === "denied" ? "เหตุผลที่ไม่อนุมัติ" : "ความเห็นฝ่ายบุคคล"}: {r.supervisor_comment}
        </p>
      )}

      {status === "approved" && (
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-sm text-emerald-700 dark:text-emerald-300">
            หนังสือพร้อมแล้ว รับฉบับจริงที่ฝ่ายบุคคล
          </p>
          {canPrint && (
            <button
              type="button"
              onClick={() => onDownload(r.id)}
              disabled={downloading}
              className={cx(neutralBtnCls, "md:!h-9 !px-3 !text-sm")}
              aria-label={`ดาวน์โหลดหนังสือรับรองเงินเดือน คำขอ #${r.id}`}
            >
              {downloading ? "กำลังดาวน์โหลด…" : "ดาวน์โหลด PDF"}
            </button>
          )}
        </div>
      )}
      {status === "denied" && (
        <p className="text-xs text-gray-500 dark:text-gray-400">แก้ตามเหตุผลแล้วยื่นคำขอใหม่ได้</p>
      )}
    </li>
  )
}

// ─── หน้า ────────────────────────────────────────────────────────────────────

export default function MySalaryCert() {
  const uid = useId()
  const { can } = useCan()
  const canPrint = can("hr.salaryCert.print")

  const [form, setForm] = useState(EMPTY_FORM)
  const [errors, setErrors] = useState({})
  const [submitting, setSubmitting] = useState(false)
  const [formError, setFormError] = useState("")

  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [listError, setListError] = useState("")
  const [downloadingId, setDownloadingId] = useState(null)
  const [highlightId, setHighlightId] = useState(null)

  const fetchList = useCallback(() => {
    setLoading(true)
    setListError("")
    apiAuth("/personnel/me/salary-cert-requests")
      .then((d) => {
        const list = Array.isArray(d) ? d : (d?.items ?? [])
        // ใหม่สุดก่อน (backend ไม่ได้ระบุลำดับ)
        setItems([...list].sort((a, b) => String(b.created_at || b.requested_at || "").localeCompare(String(a.created_at || a.requested_at || "")) || (b.id ?? 0) - (a.id ?? 0)))
      })
      .catch((e) => setListError(apiDetail(e) || "โหลดประวัติคำขอไม่สำเร็จ"))
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => { fetchList() }, [fetchList])

  const setField = (k, v) => {
    setForm((f) => ({ ...f, [k]: v }))
    setErrors((e) => (e[k] ? { ...e, [k]: undefined } : e))
    setFormError("")
  }

  const copies = num(form.copies_count)
  const loanAmount = num(form.loan_amount)
  const purpose = form.purpose_type
  const usesField = (k) => (FIELDS_BY_PURPOSE[purpose] ?? []).includes(k)

  const validate = () => {
    const e = {}
    if (!(copies >= 1) || !Number.isInteger(copies)) e.copies_count = "ระบุจำนวนฉบับเป็นจำนวนเต็ม"
    else if (copies > MAX_COPIES) e.copies_count = `ขอได้ไม่เกิน ${MAX_COPIES} ฉบับต่อครั้ง`
    if (!FIELDS_BY_PURPOSE[purpose]) e.purpose_type = "เลือกวัตถุประสงค์"
    if (purpose === "document" && !form.purpose_detail.trim()) e.purpose_detail = "ระบุว่าจะนำไปใช้ทำอะไร"
    if (purpose === "loan_guarantee" && !form.guarantor_for_name.trim()) e.guarantor_for_name = "ระบุชื่อผู้กู้ที่คุณค้ำประกันให้"
    if ((purpose === "loan_self" || purpose === "loan_guarantee") && !form.loan_bank.trim()) e.loan_bank = "ระบุธนาคารหรือสถาบันการเงิน"
    if (usesField("loan_amount") && loanAmount != null && !(loanAmount > 0)) e.loan_amount = "กรอกวงเงินเป็นตัวเลขมากกว่า 0"
    setErrors(e)
    const first = FIELD_ORDER.find((k) => e[k])
    if (first) {
      document.getElementById(`${uid}-${first}`)?.focus()
      return false
    }
    return true
  }

  const buildBody = () => {
    const body = { copies_count: copies, purpose_type: purpose }
    for (const k of FIELDS_BY_PURPOSE[purpose]) {
      if (k === "loan_amount") {
        if (loanAmount > 0) body.loan_amount = loanAmount.toFixed(2)
        continue
      }
      const v = form[k].trim()
      if (v) body[k] = v
    }
    return body
  }

  const handleSubmit = async (ev) => {
    ev.preventDefault()
    setFormError("")
    if (!validate()) return
    setSubmitting(true)
    try {
      const res = await apiAuth("/personnel/me/salary-cert-requests", { method: "POST", body: buildBody() })
      toast.success("ยื่นคำขอแล้ว", { description: "ฝ่ายบุคคลจะพิจารณาและแจ้งผลในรายการคำขอของฉัน" })
      setForm(EMPTY_FORM)
      setErrors({})
      setHighlightId(res?.id ?? null)
      fetchList()
    } catch (err) {
      setFormError(apiDetail(err) || err?.message || "ยื่นคำขอไม่สำเร็จ ลองใหม่อีกครั้ง")
    } finally {
      setSubmitting(false)
    }
  }

  const downloadPdf = async (id) => {
    setDownloadingId(id)
    try {
      const { blob, filename } = await apiDownload(`/hr/salary-cert-requests/${id}/certificate-pdf`)
      const url = URL.createObjectURL(blob)
      const a = document.createElement("a")
      a.href = url
      a.download = filename || `salary_cert_${id}.pdf`
      a.click()
      setTimeout(() => URL.revokeObjectURL(url), 1000)
    } catch (e) {
      toast.error("ดาวน์โหลดไม่สำเร็จ", { description: apiDetail(e) || e?.message })
    } finally {
      setDownloadingId(null)
    }
  }

  // ล้างไฮไลต์แถวใหม่หลังผู้ใช้เห็นแล้ว
  useEffect(() => {
    if (highlightId == null) return
    const t = setTimeout(() => setHighlightId(null), 4000)
    return () => clearTimeout(t)
  }, [highlightId])

  const fieldProps = (k) => ({
    id: `${uid}-${k}`,
    "aria-invalid": !!errors[k] || undefined,
    "aria-describedby": errors[k] ? `${uid}-${k}-err` : undefined,
  })
  const errMsg = (k) => (errors[k] ? <p id={`${uid}-${k}-err`} className={errorTextCls}>{errors[k]}</p> : null)
  const req = <span className="text-red-600 dark:text-red-400" aria-hidden="true"> *</span>
  const textField = (k, label, { required, placeholder, hint, inputMode } = {}) => (
    <div>
      <label htmlFor={`${uid}-${k}`} className={labelCls}>{label}{required && req}</label>
      <input {...fieldProps(k)} type="text" inputMode={inputMode} value={form[k]} maxLength={255}
        onChange={(e) => setField(k, e.target.value)} placeholder={placeholder} aria-required={required || undefined}
        className={cx(fieldCls, inputMode === "decimal" && "tabular-nums", errors[k] && errBorder)} />
      {errors[k] ? errMsg(k) : hint ? <p className={helpTextCls}>{hint}</p> : null}
    </div>
  )

  const pendingCount = items.filter((r) => r.status === "pending").length

  return (
    <div className="mx-auto max-w-6xl space-y-5 pb-12">
      <PageTitle title="ขอหนังสือรับรองเงินเดือน" />

      <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,420px)_minmax(0,1fr)]">
        {/* ══════════ FORM ══════════ */}
        <form onSubmit={handleSubmit} noValidate aria-labelledby={`${uid}-form-h`} className={cx(cardCls, "space-y-4 p-5")}>
          <h2 id={`${uid}-form-h`} className="text-base font-semibold text-gray-900 dark:text-gray-100">ยื่นคำขอใหม่</h2>

          <FormApplicantHeader />

          <fieldset aria-describedby={errors.purpose_type ? `${uid}-purpose_type-err` : undefined}>
            <legend className={labelCls}>วัตถุประสงค์{req}</legend>
            <div className="mt-1 space-y-2">
              {PURPOSE_OPTIONS.map((o, i) => {
                const active = purpose === o.value
                return (
                  <label
                    key={o.value}
                    className={cx(
                      "flex cursor-pointer items-start gap-3 rounded-xl border px-3 py-2.5 transition-colors duration-200",
                      "has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-indigo-500",
                      active
                        ? "border-indigo-500 bg-indigo-50 dark:border-indigo-400 dark:bg-indigo-500/10"
                        : "border-gray-300 hover:bg-gray-50 dark:border-line-field dark:hover:bg-white/[.03]",
                      errors.purpose_type && !purpose && "!border-red-400 dark:!border-red-500",
                    )}
                  >
                    <input
                      id={i === 0 ? `${uid}-purpose_type` : undefined}
                      type="radio"
                      name={`${uid}-purpose_type`}
                      value={o.value}
                      checked={active}
                      onChange={() => setField("purpose_type", o.value)}
                      className="mt-1 accent-indigo-600"
                    />
                    <span className="min-w-0">
                      <span className={cx("block text-sm font-medium", active ? "text-indigo-800 dark:text-indigo-200" : "text-gray-800 dark:text-gray-200")}>{o.label}</span>
                      <span className="block text-xs text-gray-500 dark:text-gray-400">{o.hint}</span>
                    </span>
                  </label>
                )
              })}
            </div>
            {errMsg("purpose_type")}
          </fieldset>

          {purpose === "document" && (
            <div className="space-y-3">
              {textField("purpose_detail", "ใช้เพื่อ", { required: true, placeholder: "เช่น ประกอบการขอวีซ่า" })}
              {textField("recipient_name", "ยื่นต่อ", { placeholder: "หน่วยงาน/บุคคลที่จะยื่น (ถ้ามี)" })}
            </div>
          )}

          {(purpose === "loan_self" || purpose === "loan_guarantee") && (
            <div className="space-y-3">
              {purpose === "loan_guarantee" && textField("guarantor_for_name", "ค้ำประกันให้", { required: true, placeholder: "ชื่อ-นามสกุลผู้กู้" })}
              <div className="grid gap-3 sm:grid-cols-2">
                {textField("loan_bank", "ธนาคาร/สถาบันการเงิน", { required: true, placeholder: "เช่น ธนาคารออมสิน" })}
                {textField("loan_branch_name", "สาขา", { placeholder: "เช่น สาขาสุรินทร์" })}
              </div>
              {purpose === "loan_self" && textField("loan_purpose", "กู้เพื่อ", { placeholder: "เช่น ปลูกสร้างบ้าน" })}
              {textField("loan_amount", "วงเงินกู้ (บาท)", {
                inputMode: "decimal",
                placeholder: "0.00",
                hint: loanAmount > 0 ? `${money(loanAmount)} บาท` : "ไม่บังคับ",
              })}
            </div>
          )}

          <div className="max-w-[10rem]">
            <label htmlFor={`${uid}-copies_count`} className={labelCls}>จำนวน (ฉบับ){req}</label>
            <input {...fieldProps("copies_count")} type="number" inputMode="numeric" min={1} max={MAX_COPIES} step={1}
              value={form.copies_count} onChange={(e) => setField("copies_count", e.target.value)} aria-required="true"
              className={cx(fieldCls, "tabular-nums", errors.copies_count && errBorder)} />
            {errMsg("copies_count")}
          </div>

          {formError && <ErrorState message={formError} />}

          <button type="submit" disabled={submitting} className={cx(primaryBtnCls, "w-full !h-11")}>
            {submitting ? "กำลังยื่นคำขอ…" : "ยื่นคำขอ"}
          </button>
        </form>

        {/* ══════════ MY REQUESTS ══════════ */}
        <section aria-labelledby={`${uid}-list-h`} aria-busy={loading || undefined} className={cx(cardCls, "space-y-4 p-5")}>
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h2 id={`${uid}-list-h`} className="text-base font-semibold text-gray-900 dark:text-gray-100">
              คำขอของฉัน
              {!loading && !listError && (
                <span className="ml-2 text-sm font-normal tabular-nums text-gray-500 dark:text-gray-400">
                  {items.length} รายการ{pendingCount > 0 && ` · รออนุมัติ ${pendingCount}`}
                </span>
              )}
            </h2>
            {!loading && (
              <button type="button" onClick={fetchList}
                className={cx("inline-flex min-h-touch cursor-pointer items-center rounded px-1 text-sm font-medium text-indigo-700 hover:underline md:min-h-0 dark:text-indigo-300", focusRingCls)}>
                รีเฟรช
              </button>
            )}
          </div>

          {listError && <ErrorState message={listError} onRetry={fetchList} />}

          {loading ? (
            <div className="space-y-3">
              <span className="sr-only">กำลังโหลดคำขอ…</span>
              {[0, 1, 2].map((i) => <Skeleton key={i} className="h-20" rounded="rounded-xl" />)}
            </div>
          ) : !listError && items.length === 0 ? (
            <EmptyState
              title="ยังไม่เคยขอหนังสือรับรองเงินเดือน"
              description="คำขอที่ยื่นแล้วจะแสดงที่นี่ พร้อมสถานะการพิจารณาของฝ่ายบุคคล"
            />
          ) : (
            <ul className="divide-y divide-gray-100 dark:divide-line">
              {items.map((r) => (
                <HistoryItem key={r.id} r={r} highlight={highlightId != null && highlightId === r.id}
                  canPrint={canPrint} downloading={downloadingId === r.id} onDownload={downloadPdf} />
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  )
}
