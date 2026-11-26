// src/pages/work/MySalaryCert.jsx
// ─────────────────────────────────────────────────────────────────────────────
// ขอหนังสือรับรองเงินเดือน — ฝั่งพนักงาน (3M · 13G, handoff "3M Client Document Integration")
//
//   POST /personnel/me/salary-cert-requests   { copies_count, purpose_type, ...ช่องตามวัตถุประสงค์ }
//        purpose_type ∈ document | loan_self | loan_guarantee (ค่าอื่น → 422) → 201 { status, id }
//   GET  /personnel/me/salary-cert-requests   ประวัติของฉัน — status pending_supervisor | pending_manager |
//        approved | denied + supervisor_opinion/comment/at (ความเห็นหัวหน้า), manager_comment, approved_at
//   GET  /personnel/me/salary-cert-requests/{id}/certificate-pdf   หนังสือของฉัน (เฉพาะ approved; อื่น ๆ 400)
//
// ขั้นตอน (PR 44): ผู้บังคับบัญชาให้ความเห็น → ผู้จัดการอนุมัติ — ป้าย/สีสถานะอยู่ที่ src/lib/salaryCert.js
// ฝั่งผู้จัดการ/HR อยู่ที่ HRSalaryCertTab · ฝั่งหัวหน้าอยู่ในกล่องงาน (SalaryCertSupervisorQueue)
// ─────────────────────────────────────────────────────────────────────────────
import { useCallback, useEffect, useId, useState } from "react"
import { apiAuth } from "../../lib/api"
import { apiDetail } from "../../lib/apiErrors"
import { money, thaiDate } from "../../lib/loans"
import {
  cx, baseField, cardCls, labelCls, helpTextCls, errorTextCls, primaryBtnCls, neutralBtnCls, focusRingCls,
} from "../../lib/styles"
import { Badge, EmptyState, ErrorState, Skeleton, toast } from "../../components/ui"
import PageTitle from "../../components/PageTitle"
import useFormDefaults from "../../hooks/useFormDefaults"
import { getUser } from "../../lib/auth"
import { useDrill } from "../../lib/drill"
import { SalaryCertProgress, SupervisorOpinionNote } from "../../components/hr/SalaryCertParts"
import {
  SALARY_CERT_STATUS as S, ORG_LETTERHEAD, bahtText, isSalaryCertPending, moneyText,
  salaryCertStatusLabel, salaryCertStatusTone, thaiLongDate, todayIso,
} from "../../lib/salaryCert"
import { fmtDateTimeTh } from "../../lib/approvalActions"

// จำนวนฉบับ — พนักงานระบุเอง (TOR) ขั้นต่ำ 1 (backend ปฏิเสธ 0) · เพดานกันพิมพ์ผิด
const MIN_COPIES = 1
const MAX_COPIES = 10

// formLabel = ถ้อยคำตามแบบฟอร์มกระดาษ · label = ป้ายสั้นในประวัติ
const PURPOSE_OPTIONS = Object.freeze([
  { value: "document",       label: "เพื่อใช้เป็นหลักฐาน",   formLabel: "ประกอบหลักฐาน",           hint: "ยื่นประกอบเอกสารกับร้าน บริษัท หรือหน่วยงาน เช่น ขอวีซ่า เช่าที่พัก" },
  { value: "loan_self",      label: "เพื่อกู้เงิน",          formLabel: "ประกอบหลักฐานการกู้เงิน", hint: "ยื่นธนาคารหรือสถาบันการเงินเพื่อกู้ในนามตัวเอง" },
  { value: "loan_guarantee", label: "เพื่อค้ำประกันเงินกู้", formLabel: "ค้ำประกันการกู้เงิน",     hint: "เป็นผู้ค้ำประกันเงินกู้ให้ผู้อื่น" },
])
const PURPOSE_LABEL = Object.fromEntries(PURPOSE_OPTIONS.map((o) => [o.value, o.label]))

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
  loan_guarantee: ["guarantor_for_name", "loan_bank", "loan_branch_name", "loan_purpose", "loan_amount"],
}
const FIELD_ORDER = ["copies_count", "purpose_type", "purpose_detail", "guarantor_for_name", "loan_bank", "loan_amount"]

const num = (v) => {
  const s = String(v ?? "").replace(/,/g, "").trim()
  return s === "" ? null : Number(s)
}

// ─── ชิ้นส่วนฟอร์ม ───────────────────────────────────────────────────────────

function FormStep({ n, title, note, required, children }) {
  return (
    <section className="space-y-3">
      <div className="flex flex-wrap items-baseline gap-x-2.5 gap-y-0.5">
        <span aria-hidden="true" className="grid size-6 shrink-0 translate-y-[-1px] place-items-center rounded-full bg-indigo-600 text-xs font-semibold text-white tabular-nums dark:bg-indigo-500">{n}</span>
        <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">
          {title}{required && <span className="text-red-600 dark:text-red-400" aria-hidden="true"> *</span>}
        </h3>
        {note && <span className="text-xs text-gray-500 dark:text-gray-400">{note}</span>}
      </div>
      <div className="sm:pl-8.5">{children}</div>
    </section>
  )
}

function ReadItem({ label, value, wide, muted }) {
  return (
    <div className={cx("min-w-0", wide && "col-span-2")}>
      <dt className="text-xs text-gray-500 dark:text-gray-400">{label}</dt>
      <dd className={cx("mt-0.5 break-words text-sm", muted ? "text-gray-500 dark:text-gray-400" : "font-medium text-gray-900 dark:text-gray-100")}>
        {value || <span className="font-normal text-gray-400 dark:text-gray-500">—</span>}
      </dd>
    </div>
  )
}

/** ค่าที่ยังไม่กรอกในข้อความตรวจทาน → เส้นจุดแบบแบบฟอร์ม */
function Blank({ children }) {
  const v = typeof children === "string" ? children.trim() : children
  if (v) return <span className="font-semibold text-gray-900 underline decoration-indigo-300 decoration-dotted underline-offset-4 dark:text-gray-50 dark:decoration-indigo-400/60">{v}</span>
  return <span aria-label="ยังไม่ได้กรอก" className="inline-block w-24 translate-y-[-0.3em] border-b border-dotted border-gray-400 align-baseline dark:border-gray-500" />
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

function HistoryItem({ r, onDownload, highlight }) {
  const status = r.status
  const approved = status === S.APPROVED
  const denied = status === S.DENIED
  return (
    <li className={cx("space-y-2.5 py-3.5 transition-colors duration-300 first:pt-0 last:pb-0", highlight && "-mx-2 rounded-lg bg-emerald-50/70 px-2 dark:bg-emerald-500/5")}>
      <div className="flex flex-wrap items-start justify-between gap-x-3 gap-y-1">
        <div className="min-w-0">
          <p className="font-semibold text-gray-900 dark:text-gray-100">
            {PURPOSE_LABEL[r.purpose_type] ?? r.purpose_type ?? "หนังสือรับรองเงินเดือน"}
          </p>
          <p className="text-xs tabular-nums text-gray-500 dark:text-gray-400">
            ยื่น {thaiDate(r.requested_at || r.created_at, { long: true })} · {r.copies_count ?? 1} ฉบับ · #{r.id}
          </p>
        </div>
        <Badge tone={salaryCertStatusTone(status)}>{salaryCertStatusLabel(status)}</Badge>
      </div>

      <RequestDetail r={r} />

      <SalaryCertProgress r={r} />

      {/* ความเห็นหัวหน้า — แสดงเมื่อมีแล้วเท่านั้น (ขั้นรอยังเห็นจากตัวบอกขั้นตอนด้านบน) */}
      <SupervisorOpinionNote r={r} showName={false} emptyText={null} />

      {(r.manager_comment || (denied && r.supervisor_comment && !r.supervisor_opinion)) && (
        <p className={cx(
          "rounded-lg px-3 py-2 text-sm break-words",
          denied
            ? "bg-red-50 text-red-800 dark:bg-red-500/10 dark:text-red-200"
            : "bg-gray-50 text-gray-700 dark:bg-white/[.04] dark:text-gray-300",
        )}>
          <span className="font-medium">{denied ? "เหตุผลที่ไม่อนุมัติ" : "ความเห็นผู้จัดการ"}:</span>{" "}
          {/* แถวเก่าก่อน PR 44 เก็บความเห็นผู้อนุมัติไว้ใน supervisor_comment */}
          {r.manager_comment || r.supervisor_comment}
        </p>
      )}

      {approved && (
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-sm text-emerald-700 dark:text-emerald-300">
            อนุมัติแล้ว{r.approved_at && <span className="tabular-nums"> {fmtDateTimeTh(r.approved_at)}</span>} · ดาวน์โหลดได้ หรือรับฉบับจริงที่ฝ่ายบุคคล
          </p>
          <button
            type="button"
            onClick={() => onDownload(r.id)}
            className={cx(neutralBtnCls, "md:pointer-fine:!h-9 !px-3 !text-sm")}
            aria-label={`ดูและพิมพ์หนังสือรับรองเงินเดือน คำขอ #${r.id}`}
          >
            ดูและพิมพ์หนังสือรับรอง
          </button>
        </div>
      )}
      {denied && (
        <p className="text-xs text-gray-500 dark:text-gray-400">แก้ตามเหตุผลแล้วยื่นคำขอใหม่ได้</p>
      )}
    </li>
  )
}

// ─── หน้า ────────────────────────────────────────────────────────────────────

export default function MySalaryCert() {
  const uid = useId()

  const [form, setForm] = useState(EMPTY_FORM)
  const [errors, setErrors] = useState({})
  const [submitting, setSubmitting] = useState(false)
  const [formError, setFormError] = useState("")

  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [listError, setListError] = useState("")
  const [highlightId, setHighlightId] = useState(null)

  const { defaults, loading: defaultsLoading } = useFormDefaults()
  const user = getUser() || {}
  const applicantName = defaults.name || user.full_name || user.username || ""
  const unitText = [defaults.department, defaults.branch].filter(Boolean).join(" / ")

  // อัตราเงินเดือนของตัวเอง (ถ้า backend ส่งมา) — แสดงอย่างเดียว ไม่ได้ส่งไปกับคำขอ
  const [mySalary, setMySalary] = useState(null)
  useEffect(() => {
    let alive = true
    apiAuth("/personnel/me/financial")
      .then((d) => {
        const v = d?.financial?.current_salary ?? d?.current_salary
        if (alive && v != null && Number(v) > 0) setMySalary(v)
      })
      .catch(() => {})
    return () => { alive = false }
  }, [])

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

  const loanAmount = num(form.loan_amount)
  const purpose = form.purpose_type
  const usesField = (k) => (FIELDS_BY_PURPOSE[purpose] ?? []).includes(k)

  const validate = () => {
    const e = {}
    const copies = Number(form.copies_count)
    if (!Number.isInteger(copies) || copies < MIN_COPIES) e.copies_count = `ระบุจำนวนอย่างน้อย ${MIN_COPIES} ฉบับ`
    else if (copies > MAX_COPIES) e.copies_count = `ขอได้ครั้งละไม่เกิน ${MAX_COPIES} ฉบับ`
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
    const body = { copies_count: Number(form.copies_count), purpose_type: purpose }
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
      toast.success("ยื่นคำขอแล้ว", {
        description: res?.request_status === S.PENDING_SUPERVISOR
          ? "ส่งให้ผู้บังคับบัญชาให้ความเห็น แล้วผู้จัดการจะพิจารณา"
          : "ส่งให้ผู้จัดการพิจารณาแล้ว ติดตามผลได้ในรายการคำขอของฉัน",
      })
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

  // หนังสือแบบใหม่ (หัวกระดาษ + ลายน้ำ) — พิมพ์/บันทึก PDF จากหน้านั้น
  const { drillTo } = useDrill()
  const openCertificate = (id) => drillTo(`/my-salary-cert/certificate?request=${id}`, "ขอหนังสือรับรองเงินเดือน")

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
  const textField = (k, label, { required, placeholder, hint, inputMode, wide } = {}) => (
    <div className={cx("min-w-0", wide && "sm:col-span-2")}>
      <label htmlFor={`${uid}-${k}`} className={labelCls}>{label}{required && req}</label>
      <input {...fieldProps(k)} type="text" inputMode={inputMode} value={form[k]} maxLength={255}
        onChange={(e) => setField(k, e.target.value)} placeholder={placeholder} aria-required={required || undefined}
        className={cx(fieldCls, inputMode === "decimal" && "tabular-nums", errors[k] && errBorder)} />
      {errors[k] ? errMsg(k) : hint ? <p className={helpTextCls}>{hint}</p> : null}
    </div>
  )

  const pendingCount = items.filter((r) => isSalaryCertPending(r.status)).length

  const amountText = loanAmount > 0 ? `${money(loanAmount)} บาท` : ""
  const purposeSentence = purpose === "document" ? (
    <> ประกอบหลักฐาน <Blank>{form.purpose_detail}</Blank> กับ <Blank>{form.recipient_name}</Blank></>
  ) : purpose === "loan_self" ? (
    <> ประกอบหลักฐานการกู้เงินกับ <Blank>{form.loan_bank}</Blank> สาขา <Blank>{form.loan_branch_name}</Blank>{" "}
      วัตถุประสงค์การกู้เงินเพื่อ <Blank>{form.loan_purpose}</Blank> วงเงิน <Blank>{amountText}</Blank></>
  ) : purpose === "loan_guarantee" ? (
    <> ค้ำประกันการกู้เงินของ <Blank>{form.guarantor_for_name}</Blank> กับ <Blank>{form.loan_bank}</Blank>{" "}
      สาขา <Blank>{form.loan_branch_name}</Blank> วัตถุประสงค์การกู้เงินเพื่อ <Blank>{form.loan_purpose}</Blank> วงเงิน <Blank>{amountText}</Blank></>
  ) : (
    <> <span className="text-gray-500 dark:text-gray-400">(เลือกกรณีในข้อ 2)</span></>
  )

  return (
    <div className="w-full space-y-5 pb-12" data-tour="salary-cert">
      <PageTitle title="ขอหนังสือรับรองเงินเดือน" />

      <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,400px)] xl:grid-cols-[minmax(0,1fr)_minmax(0,460px)]">
        {/* ══════════ FORM (โครงตามแบบฟอร์มกระดาษ "คำขอหนังสือรับรองเงินเดือน") ══════════ */}
        <form onSubmit={handleSubmit} noValidate aria-labelledby={`${uid}-form-h`} className={cx(cardCls, "overflow-hidden")}>
          <header className="border-b border-gray-100 bg-gray-50/70 px-5 py-4 dark:border-line dark:bg-white/[.02]">
            <div className="flex flex-wrap items-start justify-between gap-x-6 gap-y-2">
              <div className="min-w-0">
                <p className="text-xs text-gray-500 dark:text-gray-400">{ORG_LETTERHEAD.nameTh}</p>
                <h2 id={`${uid}-form-h`} className="mt-0.5 text-lg font-semibold text-gray-900 dark:text-gray-100">คำขอหนังสือรับรองเงินเดือน</h2>
              </div>
              <dl className="grid grid-cols-[auto_auto] gap-x-2 text-xs text-gray-600 sm:text-right dark:text-gray-300">
                <dt className="text-gray-500 dark:text-gray-400">เขียนที่</dt>
                <dd>{defaults.branch || ORG_LETTERHEAD.short}</dd>
                <dt className="text-gray-500 dark:text-gray-400">วันที่</dt>
                <dd className="tabular-nums">{thaiLongDate(todayIso())}</dd>
              </dl>
            </div>
            <dl className="mt-3 grid grid-cols-[3.5rem_minmax(0,1fr)] gap-y-0.5 text-sm">
              <dt className="text-gray-500 dark:text-gray-400">เรื่อง</dt>
              <dd className="text-gray-800 dark:text-gray-200">ขอหนังสือรับรองเงินเดือน</dd>
              <dt className="text-gray-500 dark:text-gray-400">เรียน</dt>
              <dd className="text-gray-800 dark:text-gray-200">ผู้จัดการ {ORG_LETTERHEAD.short}</dd>
            </dl>
          </header>

          <div className="space-y-7 p-5">
            {/* 1 — ผู้ขอ */}
            <FormStep n={1} title="ข้อมูลผู้ขอ" note="ระบบเติมให้จากทะเบียนเจ้าหน้าที่">
              {defaultsLoading ? (
                <div className="grid grid-cols-2 gap-3" aria-hidden="true">
                  {[0, 1, 2, 3].map((i) => <Skeleton key={i} rounded="rounded-lg" className="h-11" />)}
                </div>
              ) : (
                <dl className="grid grid-cols-2 gap-x-4 gap-y-3 rounded-xl bg-gray-50 px-4 py-3 ring-1 ring-gray-200/70 dark:bg-white/[.03] dark:ring-line">
                  <ReadItem label="ด้วยข้าพเจ้า" value={applicantName} wide />
                  <ReadItem label="ตำแหน่ง" value={defaults.position} />
                  <ReadItem label="สังกัด (แผนก/ฝ่าย/สาขา)" value={unitText} />
                  <ReadItem label="อัตราเงินเดือน" value={mySalary ? `${moneyText(mySalary)} บาท` : "ฝ่ายบุคคลกรอกตามทะเบียน"} muted={!mySalary} />
                </dl>
              )}
              <div className="mt-4 max-w-[12rem] min-w-0">
                <label htmlFor={`${uid}-copies_count`} className={labelCls}>จำนวนที่ขอ (ฉบับ){req}</label>
                <input
                  {...fieldProps("copies_count")}
                  type="number"
                  inputMode="numeric"
                  min={MIN_COPIES}
                  max={MAX_COPIES}
                  step={1}
                  value={form.copies_count}
                  onChange={(e) => setField("copies_count", e.target.value.replace(/[^\d]/g, ""))}
                  aria-required="true"
                  className={cx(fieldCls, "tabular-nums", errors.copies_count && errBorder)}
                />
                {errMsg("copies_count")}
              </div>
            </FormStep>

            {/* 2 — กรณีที่ใช้ */}
            <FormStep n={2} title="เพื่อนำไปใช้ในกรณี" required>
              <fieldset aria-describedby={errors.purpose_type ? `${uid}-purpose_type-err` : undefined}>
                <legend className="sr-only">เพื่อนำไปใช้ในกรณี</legend>
                <div className="space-y-2.5">
                  {PURPOSE_OPTIONS.map((o, i) => {
                    const active = purpose === o.value
                    return (
                      <div
                        key={o.value}
                        className={cx(
                          "rounded-xl border transition-colors duration-200",
                          active
                            ? "border-indigo-500 bg-indigo-50/60 dark:border-indigo-400 dark:bg-indigo-500/[.07]"
                            : "border-gray-300 hover:bg-gray-50 dark:border-line-field dark:hover:bg-white/[.03]",
                          errors.purpose_type && !purpose && "!border-red-400 dark:!border-red-500",
                        )}
                      >
                        <label className="flex min-h-touch cursor-pointer items-start gap-3 rounded-xl px-3.5 py-3 has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-indigo-500">
                          <input
                            id={i === 0 ? `${uid}-purpose_type` : undefined}
                            type="radio"
                            name={`${uid}-purpose_type`}
                            value={o.value}
                            checked={active}
                            onChange={() => setField("purpose_type", o.value)}
                            className="mt-1 size-4 shrink-0 accent-indigo-600"
                          />
                          <span className="min-w-0">
                            <span className={cx("block text-sm font-semibold", active ? "text-indigo-800 dark:text-indigo-200" : "text-gray-800 dark:text-gray-200")}>{o.formLabel}</span>
                            <span className="block text-xs text-gray-500 dark:text-gray-400">{o.hint}</span>
                          </span>
                        </label>

                        {active && (
                          <div className="grid gap-3 border-t border-indigo-200/70 px-3.5 pt-3 pb-4 sm:grid-cols-2 dark:border-indigo-400/20">
                            {o.value === "document" && (
                              <>
                                {textField("purpose_detail", "ประกอบหลักฐาน", { required: true, placeholder: "เช่น การขอวีซ่า, การเช่าที่พัก", wide: true })}
                                {textField("recipient_name", "กับ (ร้าน/บริษัท/หน่วยงาน)", { placeholder: "เช่น สถานทูตญี่ปุ่น", wide: true })}
                              </>
                            )}
                            {o.value === "loan_guarantee" && textField("guarantor_for_name", "ค้ำประกันการกู้เงินของ", { required: true, placeholder: "ชื่อ-นามสกุลผู้กู้", wide: true })}
                            {(o.value === "loan_self" || o.value === "loan_guarantee") && (
                              <>
                                {textField("loan_bank", o.value === "loan_self" ? "กู้เงินกับ" : "กับ (สถาบันการเงิน)", { required: true, placeholder: "เช่น ธ.ก.ส., ธนาคารออมสิน" })}
                                {textField("loan_branch_name", "สาขา", { placeholder: "เช่น สาขาสุรินทร์" })}
                                {textField("loan_purpose", "วัตถุประสงค์การกู้เงินเพื่อ", { placeholder: "เช่น ปลูกสร้างบ้าน", wide: true })}
                                {textField("loan_amount", "วงเงิน (บาท)", {
                                  inputMode: "decimal",
                                  placeholder: "0.00",
                                  hint: loanAmount > 0 ? `${money(loanAmount)} บาท · ${bahtText(loanAmount)}` : "ไม่บังคับ",
                                  wide: true,
                                })}
                              </>
                            )}
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
                {errMsg("purpose_type")}
              </fieldset>
            </FormStep>

            {/* 3 — ตรวจทาน */}
            <FormStep n={3} title="ตรวจทานข้อความในคำขอ">
              <div className="rounded-xl bg-[#fbfaf6] px-4 py-4 text-[15px] leading-8 text-gray-800 ring-1 ring-[#e8e3d3] dark:bg-white/[.03] dark:text-gray-200 dark:ring-line">
                <p className="indent-10">
                  ด้วยข้าพเจ้า <Blank>{applicantName}</Blank> ตำแหน่ง <Blank>{defaults.position}</Blank>{" "}
                  สังกัด <Blank>{unitText}</Blank> มีความประสงค์ขอรับหนังสือรับรองเงินเดือน จำนวน <Blank>{Number(form.copies_count) >= MIN_COPIES ? form.copies_count : ""}</Blank> ฉบับ{" "}
                  เพื่อนำไปใช้ในกรณี{purposeSentence}
                </p>
                <p className="mt-1 indent-10">จึงเรียนมาเพื่อโปรดพิจารณา</p>
              </div>
            </FormStep>

            {formError && <ErrorState message={formError} />}

            <div className="space-y-2">
              <button type="submit" disabled={submitting} className={cx(primaryBtnCls, "w-full !h-11")}>
                {submitting ? "กำลังยื่นคำขอ…" : "ยื่นคำขอ"}
              </button>
              <p className="text-center text-xs text-gray-500 dark:text-gray-400">
                ผู้บังคับบัญชาให้ความเห็น → ผู้จัดการอนุมัติ → ดาวน์โหลดหรือรับฉบับจริงที่ฝ่ายบุคคล
              </p>
            </div>
          </div>
        </form>

        {/* ══════════ MY REQUESTS ══════════ */}
        <section aria-labelledby={`${uid}-list-h`} aria-busy={loading || undefined} className={cx(cardCls, "space-y-4 p-5")}>
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h2 id={`${uid}-list-h`} className="text-base font-semibold text-gray-900 dark:text-gray-100">
              คำขอของฉัน
              {!loading && !listError && (
                <span className="ml-2 text-sm font-normal tabular-nums text-gray-500 dark:text-gray-400">
                  {items.length} รายการ{pendingCount > 0 && ` · รอพิจารณา ${pendingCount}`}
                </span>
              )}
            </h2>
            {!loading && (
              <button type="button" onClick={fetchList}
                className={cx("inline-flex min-h-touch cursor-pointer items-center rounded px-1 text-sm font-medium text-indigo-700 hover:underline md:pointer-fine:min-h-0 dark:text-indigo-300", focusRingCls)}>
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
              description="คำขอที่ยื่นแล้วจะแสดงที่นี่ พร้อมขั้นตอนการพิจารณา"
            />
          ) : (
            <ul className="divide-y divide-gray-100 dark:divide-line">
              {items.map((r) => (
                <HistoryItem key={r.id} r={r} highlight={highlightId != null && highlightId === r.id}
                  onDownload={openCertificate} />
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  )
}
