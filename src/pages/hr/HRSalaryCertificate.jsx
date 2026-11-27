// src/pages/hr/HRSalaryCertificate.jsx
// ─────────────────────────────────────────────────────────────────────────────
// ออกหนังสือรับรองเงินเดือน (HR) — พรีวิวแผ่น A4 ตามแบบ "หนังสือรับรองเงินเดือน.docx" + ลายน้ำตรา สกต.
// แล้วพิมพ์ / บันทึกเป็น PDF จากเบราว์เซอร์ (window.print → เหลือแผ่นเดียวด้วย CSS ใน index.css)
//
//   /hr/salary-cert/certificate?request=<id>   เติมข้อมูลจากคำขอ + ประวัติเจ้าหน้าที่ให้อัตโนมัติ
//       GET /hr/salary-cert-requests            (ยังไม่มี GET รายตัว — หาแถวจากรายการ)
//       GET /hr/personnel/{user_id}             ชื่อ · personnel_info.hired · position_display · financial.current_salary
//   /hr/salary-cert/certificate                 ออกเองโดยไม่มีคำขอ (กรอกทุกช่องเอง)
//
// ทุกช่องแก้ได้เสมอ — backend ยังไม่ส่งบางค่า (เลขที่หนังสือ, วันบรรจุ) ก็ให้ HR กรอกเองได้ทันที
// ถ้ามี PDF จากระบบ (certificate-pdf) ยังมีปุ่มสำรองให้ดาวน์โหลด
// ─────────────────────────────────────────────────────────────────────────────
import { useEffect, useId, useState } from "react"
import { useSearchParams } from "react-router-dom"
import { Printer, Download, RotateCcw, Info } from "lucide-react"
import { apiAuth } from "../../lib/api"
import { loadDocSignatures, pickSignature } from "../../lib/signatures"
import { apiDetail } from "../../lib/apiErrors"
import { useCan } from "../../lib/permissions"
import {
  DEFAULT_SIGNER, SALARY_CERT_STATUS as S, bahtText, certPurposeText, downloadSalaryCertPdf, moneyText,
  salaryCertPurposeLabel, salaryCertStatusLabel, salaryCertStatusTone, todayIso,
} from "../../lib/salaryCert"
import { currentPositionLabel } from "../../components/hr/positionUtils"
import { SalaryCertificateSheet, ScaledSheet, PrintPortal } from "../../components/hr/SalaryCertificateDocument"
import ThaiDateField from "../../components/ThaiDateField"
import PageTitle from "../../components/PageTitle"
import { Badge, ErrorState, Skeleton, toast } from "../../components/ui"
import { cx, baseField, cardCls, labelCls, helpTextCls, primaryBtnCls, neutralBtnCls } from "../../lib/styles"

const fieldCls = cx(baseField, "!rounded-lg !px-3 !py-2 md:!text-sm")
const s = (v) => (v == null ? "" : String(v).trim())

const EMPTY = {
  docNo: "",
  issueDate: todayIso(),
  name: "",
  appointedDate: "",
  position: "",
  unit: "",
  salary: "",
  purpose: "",
  signerName: DEFAULT_SIGNER.name,
  signerTitle: DEFAULT_SIGNER.title,
}

/** คำขอ + ประวัติเจ้าหน้าที่ → ค่าเริ่มต้นของหนังสือ */
function prefillFrom(req, person) {
  const pi = person?.personnel_info ?? {}
  const fin = person?.financial ?? {}
  const name = [s(person?.first_name), s(person?.last_name)].filter(Boolean).join(" ") || s(req?.user_name)
  return {
    ...EMPTY,
    name,
    appointedDate: s(pi.hired).slice(0, 10),
    position: s(currentPositionLabel(person, person?.position_title ?? person?.position_name ?? "")),
    unit: s(req?.branch_name ?? person?.home_branch?.branch_name ?? person?.branch_name),
    salary: fin.current_salary != null && fin.current_salary !== "" ? String(fin.current_salary) : "",
    purpose: certPurposeText(req),
  }
}

function SectionLabel({ children }) {
  return <p className="text-xs font-semibold tracking-wide text-gray-500 uppercase dark:text-gray-400">{children}</p>
}

export default function HRSalaryCertificate() {
  const uid = useId()
  const { can } = useCan()
  const [params] = useSearchParams()
  const requestId = params.get("request")

  const [req, setReq] = useState(null)
  const [approverSig, setApproverSig] = useState(null)
  const [form, setForm] = useState(EMPTY)
  const [prefilled, setPrefilled] = useState(EMPTY)
  const [loading, setLoading] = useState(!!requestId)
  const [loadError, setLoadError] = useState("")
  const [attempt, setAttempt] = useState(0)
  const [pdfLoading, setPdfLoading] = useState(false)

  useEffect(() => {
    if (!requestId) return
    let alive = true
    setLoading(true)
    setLoadError("")
    ;(async () => {
      try {
        const list = await apiAuth("/hr/salary-cert-requests")
        const rows = Array.isArray(list) ? list : (list?.items ?? [])
        const found = rows.find((r) => String(r.id) === String(requestId)) ?? null
        if (!found) throw new Error(`ไม่พบคำขอ #${requestId}`)
        const [person, sigs] = await Promise.all([
          found.user_id != null ? apiAuth(`/hr/personnel/${found.user_id}`).catch(() => null) : null,
          // PR 111: ผู้จัดการที่อนุมัติจริง (ชื่อ/ตำแหน่ง/ลายเซ็นรุ่นที่ใช้ตอนอนุมัติ) — เฉพาะคำขอที่อนุมัติแล้ว
          found.status === S.APPROVED
            ? loadDocSignatures(`/hr/salary-cert-requests/${found.id}/signatures`, { keepUnsigned: true })
            : [],
        ])
        if (!alive) return
        const approver = pickSignature(sigs, { role: "approver", userId: found.approved_by })
        const base = prefillFrom(found, person)
        const next = {
          ...base,
          ...(approver?.name?.trim() && { signerName: approver.name.trim() }),
          ...(approver?.position?.trim() && { signerTitle: approver.position.trim() }),
        }
        setApproverSig(approver?.image ? { name: next.signerName, image: approver.image } : null)
        setReq(found)
        setForm(next)
        setPrefilled(next)
      } catch (e) {
        if (alive) setLoadError(apiDetail(e) || e?.message || "โหลดข้อมูลคำขอไม่สำเร็จ")
      } finally {
        if (alive) setLoading(false)
      }
    })()
    return () => { alive = false }
  }, [requestId, attempt])

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }))
  // ลายเซ็นผู้อนุมัติพิมพ์เฉพาะตอนชื่อผู้ลงนามยังเป็นคนเดิม — HR เปลี่ยนชื่อเป็นคนอื่น = เส้นจุดให้เซ็นมือ
  const sheetData = approverSig && form.signerName?.trim() === approverSig.name
    ? { ...form, signature: { image: approverSig.image } }
    : form

  const missing = [
    ["name", "ชื่อ-นามสกุล"], ["appointedDate", "วันที่บรรจุ"], ["position", "ตำแหน่ง"],
    ["unit", "ประจำ (สาขา/ฝ่าย)"], ["salary", "อัตราเงินเดือน"], ["docNo", "เลขที่หนังสือ"],
  ].filter(([k]) => !s(form[k])).map(([, label]) => label)

  const approved = !req || req.status === S.APPROVED
  const salaryWords = bahtText(form.salary)

  const print = () => {
    if (!approved) return
    const prev = document.title
    document.title = `หนังสือรับรองเงินเดือน ${form.name || ""}`.trim()
    window.print()
    document.title = prev
  }

  const downloadSystemPdf = async () => {
    setPdfLoading(true)
    try {
      await downloadSalaryCertPdf(`/hr/salary-cert-requests/${req.id}/certificate-pdf`, `salary_cert_${req.id}.pdf`)
    } catch (e) {
      toast.error("ดาวน์โหลดไม่สำเร็จ", { description: apiDetail(e) || e?.message })
    } finally {
      setPdfLoading(false)
    }
  }

  const input = (k, label, opts = {}) => (
    <div className={cx("min-w-0", opts.className)}>
      <label htmlFor={`${uid}-${k}`} className={labelCls}>{label}</label>
      <input
        id={`${uid}-${k}`}
        type="text"
        value={form[k]}
        onChange={set(k)}
        inputMode={opts.inputMode}
        placeholder={opts.placeholder}
        maxLength={200}
        className={cx(fieldCls, opts.inputMode === "decimal" && "tabular-nums", !s(form[k]) && "!border-amber-400 dark:!border-amber-500/70")}
      />
      {opts.hint && <p className={helpTextCls}>{opts.hint}</p>}
    </div>
  )

  return (
    <div className="w-full space-y-5 pb-12">
      <PageTitle title="ออกหนังสือรับรองเงินเดือน" />

      <div className="grid items-start gap-5 xl:grid-cols-[minmax(0,380px)_minmax(0,1fr)]">
        {/* ══════════ ข้อมูลในหนังสือ ══════════ */}
        <section aria-labelledby={`${uid}-h`} className={cx(cardCls, "space-y-5 p-5 xl:sticky xl:top-[calc(var(--topbar-h,64px)+1rem)]")}>
          <div className="space-y-1">
            <h2 id={`${uid}-h`} className="text-base font-semibold text-gray-900 dark:text-gray-100">ข้อมูลในหนังสือ</h2>
            {req ? (
              <div className="flex flex-wrap items-center gap-2 text-sm text-gray-600 dark:text-gray-300">
                <span>คำขอ #{req.id} · {salaryCertPurposeLabel(req.purpose_type)}</span>
                <Badge tone={salaryCertStatusTone(req.status)}>{salaryCertStatusLabel(req.status)}</Badge>
              </div>
            ) : !requestId ? (
              <p className="text-sm text-gray-600 dark:text-gray-300">ออกหนังสือโดยไม่อ้างอิงคำขอ — กรอกข้อมูลเองทุกช่อง</p>
            ) : null}
          </div>

          {loading ? (
            <div className="space-y-3" aria-busy="true">
              <span className="sr-only">กำลังโหลดข้อมูลคำขอ…</span>
              {[0, 1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-14" rounded="rounded-lg" />)}
            </div>
          ) : (
            <>
              {loadError && (
                <ErrorState
                  message={`${loadError} — ยังกรอกข้อมูลเองแล้วพิมพ์ได้`}
                  onRetry={() => setAttempt((n) => n + 1)}
                />
              )}

              {!approved && (
                <p className="flex gap-2 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-900 dark:bg-amber-500/10 dark:text-amber-200">
                  <Info className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
                  คำขอนี้ยังไม่ได้รับอนุมัติ — ดูตัวอย่างได้ แต่พิมพ์ได้หลังผู้จัดการอนุมัติ
                </p>
              )}

              <div className="space-y-3">
                <SectionLabel>เลขที่และวันที่</SectionLabel>
                <div className="grid grid-cols-2 gap-3">
                  {input("docNo", "ที่ สกต.", { placeholder: "เช่น 125/2569" })}
                  <div className="min-w-0">
                    <label htmlFor={`${uid}-issueDate`} className={labelCls}>ให้ไว้ ณ วันที่</label>
                    <ThaiDateField id={`${uid}-issueDate`} value={form.issueDate} onChange={set("issueDate")} className={fieldCls} />
                  </div>
                </div>
              </div>

              <div className="space-y-3">
                <SectionLabel>ผู้ได้รับการรับรอง</SectionLabel>
                {input("name", "ชื่อ-นามสกุล (พร้อมคำนำหน้า)", { placeholder: "เช่น นางสาวสมใจ ใจดี" })}
                <div className="min-w-0">
                  <label htmlFor={`${uid}-appointedDate`} className={labelCls}>บรรจุแต่งตั้งเมื่อวันที่</label>
                  <ThaiDateField
                    id={`${uid}-appointedDate`}
                    value={form.appointedDate}
                    onChange={set("appointedDate")}
                    placeholder="เลือกวันที่บรรจุ"
                    className={cx(fieldCls, !form.appointedDate && "!border-amber-400 dark:!border-amber-500/70")}
                  />
                </div>
                <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-1 2xl:grid-cols-2">
                  {input("position", "ตำแหน่ง", { placeholder: "เช่น เจ้าหน้าที่การเงิน" })}
                  {input("unit", "ประจำ", { placeholder: "เช่น สำนักงานใหญ่" })}
                </div>
                {input("salary", "อัตราเงินเดือน (บาท)", {
                  inputMode: "decimal",
                  placeholder: "0.00",
                  hint: salaryWords ? `${moneyText(form.salary)} บาท · ${salaryWords}` : undefined,
                })}
              </div>

              <div className="space-y-1.5">
                <label htmlFor={`${uid}-purpose`} className={labelCls}>ออกให้เพื่อ (ไม่บังคับ)</label>
                <textarea
                  id={`${uid}-purpose`}
                  rows={2}
                  value={form.purpose}
                  onChange={set("purpose")}
                  maxLength={300}
                  placeholder="เช่น ใช้ประกอบหลักฐานการกู้เงินกับ ธ.ก.ส. สาขาสุรินทร์"
                  className={cx(fieldCls, "resize-y")}
                />
                <p className={helpTextCls}>ขึ้นเป็นย่อหน้า "หนังสือรับรองฉบับนี้ออกให้เพื่อ…" — เว้นว่างได้</p>
              </div>

              <div className="space-y-3">
                <SectionLabel>ผู้ลงนาม</SectionLabel>
                <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-1 2xl:grid-cols-2">
                  {input("signerName", "ชื่อผู้ลงนาม")}
                  {input("signerTitle", "ตำแหน่งผู้ลงนาม")}
                </div>
              </div>

              {missing.length > 0 && (
                <p className="text-sm text-amber-800 dark:text-amber-300">
                  ยังว่าง: {missing.join(" · ")} — ช่องที่ว่างจะพิมพ์เป็นเส้นจุดให้เขียนด้วยมือ
                </p>
              )}

              <div className="flex flex-col gap-2">
                <button type="button" onClick={print} disabled={!approved} className={cx(primaryBtnCls, "w-full !h-11 gap-2")}>
                  <Printer className="size-4" aria-hidden="true" />
                  พิมพ์ / บันทึกเป็น PDF
                </button>
                <div className="flex flex-wrap gap-2">
                  {req && req.status === S.APPROVED && can("hr.salaryCert.print") && (
                    <button type="button" onClick={downloadSystemPdf} disabled={pdfLoading} className={cx(neutralBtnCls, "flex-1 gap-2 !text-sm")}>
                      <Download className="size-4" aria-hidden="true" />
                      {pdfLoading ? "กำลังโหลด…" : "PDF จากระบบ"}
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => setForm(prefilled)}
                    disabled={JSON.stringify(form) === JSON.stringify(prefilled)}
                    className={cx(neutralBtnCls, "flex-1 gap-2 !text-sm")}
                  >
                    <RotateCcw className="size-4" aria-hidden="true" />
                    คืนค่าเริ่มต้น
                  </button>
                </div>
                <p className={helpTextCls}>ในหน้าต่างพิมพ์ เลือกปลายทาง "บันทึกเป็น PDF" เพื่อดาวน์โหลดไฟล์ · กระดาษ A4 · ไม่ต้องย่อขนาด</p>
              </div>
            </>
          )}
        </section>

        {/* ══════════ พรีวิวแผ่นจริง ══════════ */}
        <section aria-label="ตัวอย่างหนังสือรับรอง" className="min-w-0 rounded-2xl bg-gray-100 p-3 ring-1 ring-gray-200/70 sm:p-6 dark:bg-canvas dark:ring-line">
          <ScaledSheet className="mx-auto max-w-[794px]">
            <SalaryCertificateSheet data={sheetData} />
          </ScaledSheet>
        </section>
      </div>

      {approved && (
        <PrintPortal>
          <SalaryCertificateSheet data={sheetData} />
        </PrintPortal>
      )}
    </div>
  )
}
