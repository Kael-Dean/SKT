// src/pages/work/MySalaryCertificate.jsx
// ─────────────────────────────────────────────────────────────────────────────
// หนังสือรับรองเงินเดือนของฉัน — แผ่น A4 แบบเดียวกับที่ HR ออก (หัวกระดาษ + ลายน้ำตรา สกต.)
// แทน PDF จาก backend (certificate-pdf) ที่ยังจัดหน้าไม่ตรงแบบและไม่มีลายน้ำ
//
//   /my-salary-cert/certificate?request=<id>   (เฉพาะคำขอที่อนุมัติแล้ว)
//     GET /personnel/me/salary-cert-requests     แถวคำขอ (วัตถุประสงค์)
//     GET /personnel/me/form-defaults            ชื่อพร้อมคำนำหน้า · ตำแหน่ง · สาขา
//     GET /personnel/me                          personnel_info.hired (วันบรรจุ)
//     GET /personnel/me/financial                financial.current_salary
// พนักงานแก้ข้อความไม่ได้ — ช่องที่ทะเบียนยังไม่มีพิมพ์เป็นเส้นจุด + บอกให้ติดต่อฝ่ายบุคคล
// ─────────────────────────────────────────────────────────────────────────────
import { useEffect, useState } from "react"
import { useSearchParams } from "react-router-dom"
import { Info, Printer } from "lucide-react"
import { apiAuth } from "../../lib/api"
import { apiDetail } from "../../lib/apiErrors"
import { currentPositionLabel } from "../../components/hr/positionUtils"
import { SALARY_CERT_STATUS as S, certPurposeText, todayIso } from "../../lib/salaryCert"
import { SalaryCertificateSheet, ScaledSheet, PrintPortal } from "../../components/hr/SalaryCertificateDocument"
import PageTitle from "../../components/PageTitle"
import { ErrorState, Skeleton } from "../../components/ui"
import { cx, cardCls, helpTextCls, primaryBtnCls } from "../../lib/styles"

const s = (v) => (v == null ? "" : String(v).trim())
const list = (d) => (Array.isArray(d) ? d : d?.items ?? [])

async function loadMine(requestId) {
  const [rows, fd, me, fin, pos] = await Promise.all([
    apiAuth("/personnel/me/salary-cert-requests"),
    apiAuth("/personnel/me/form-defaults").catch(() => null),
    apiAuth("/personnel/me").catch(() => null),
    apiAuth("/personnel/me/financial").catch(() => null),
    apiAuth("/personnel/me/position").catch(() => null),
  ])
  const req = list(rows).find((r) => String(r.id) === String(requestId))
  if (!req) throw new Error(`ไม่พบคำขอ #${requestId}`)
  const p = Array.isArray(pos) ? pos[0] : pos
  const salary = fin?.financial?.current_salary ?? fin?.current_salary
  return {
    req,
    data: {
      docNo: "",
      issueDate: s(req.approved_at).slice(0, 10) || todayIso(),
      name: s(fd?.full_name) || [s(me?.first_name), s(me?.last_name)].filter(Boolean).join(" "),
      appointedDate: s(me?.personnel_info?.hired).slice(0, 10),
      position: s(fd?.position_title) || s(currentPositionLabel(p, p?.position_title ?? "")),
      unit: s(fd?.branch_name),
      salary: salary != null && Number(salary) > 0 ? String(salary) : "",
      purpose: certPurposeText(req),
    },
  }
}

export default function MySalaryCertificate() {
  const [params] = useSearchParams()
  const requestId = params.get("request")
  const [state, setState] = useState({ loading: true, error: "", req: null, data: null })
  const [attempt, setAttempt] = useState(0)

  useEffect(() => {
    let alive = true
    setState((st) => ({ ...st, loading: true, error: "" }))
    loadMine(requestId)
      .then((r) => alive && setState({ loading: false, error: "", ...r }))
      .catch((e) => alive && setState({ loading: false, error: apiDetail(e) || e?.message || "โหลดหนังสือรับรองไม่สำเร็จ", req: null, data: null }))
    return () => { alive = false }
  }, [requestId, attempt])

  const { loading, error, req, data } = state
  const approved = req?.status === S.APPROVED
  const missing = data
    ? [["appointedDate", "วันที่บรรจุ"], ["salary", "อัตราเงินเดือน"], ["position", "ตำแหน่ง"], ["unit", "สังกัด"]]
      .filter(([k]) => !s(data[k])).map(([, l]) => l)
    : []

  const print = () => {
    const prev = document.title
    document.title = `หนังสือรับรองเงินเดือน ${data?.name || ""}`.trim()
    window.print()
    document.title = prev
  }

  return (
    <div className="w-full space-y-5 pb-12">
      <PageTitle title="หนังสือรับรองเงินเดือนของฉัน" />

      {loading ? (
        <div className="space-y-4" aria-busy="true">
          <span className="sr-only">กำลังโหลดหนังสือรับรอง…</span>
          <Skeleton className="h-16" rounded="rounded-2xl" />
          <Skeleton className="mx-auto h-[60vh] max-w-[794px]" rounded="rounded-lg" />
        </div>
      ) : error ? (
        <ErrorState message={error} onRetry={() => setAttempt((n) => n + 1)} />
      ) : (
        <>
          <div className={cx(cardCls, "flex flex-wrap items-center justify-between gap-3 p-4")}>
            <div className="min-w-0 space-y-1">
              {!approved ? (
                <p className="flex gap-2 text-sm text-amber-800 dark:text-amber-300">
                  <Info className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
                  คำขอนี้ยังไม่ได้รับอนุมัติ — พิมพ์ได้หลังผู้จัดการอนุมัติ
                </p>
              ) : missing.length > 0 ? (
                <p className="flex gap-2 text-sm text-amber-800 dark:text-amber-300">
                  <Info className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
                  <span>ทะเบียนยังไม่มี: {missing.join(" · ")} — ช่องนี้จะพิมพ์เป็นเส้นจุด ติดต่อฝ่ายบุคคลเพื่อเพิ่มข้อมูลหรือรับฉบับที่กรอกครบ</span>
                </p>
              ) : (
                <p className="text-sm text-gray-600 dark:text-gray-300">ฉบับจริงที่มีลายมือชื่อผู้จัดการ รับได้ที่ฝ่ายบุคคล</p>
              )}
              <p className={helpTextCls}>ในหน้าต่างพิมพ์ เลือก "บันทึกเป็น PDF" เพื่อดาวน์โหลดไฟล์ · กระดาษ A4</p>
            </div>
            <button type="button" onClick={print} disabled={!approved} className={cx(primaryBtnCls, "!h-11 gap-2")}>
              <Printer className="size-4" aria-hidden="true" />
              พิมพ์ / บันทึกเป็น PDF
            </button>
          </div>

          <section aria-label="ตัวอย่างหนังสือรับรอง" className="rounded-2xl bg-gray-100 p-3 ring-1 ring-gray-200/70 sm:p-6 dark:bg-canvas dark:ring-line">
            <ScaledSheet className="mx-auto max-w-[794px]">
              <SalaryCertificateSheet data={data} />
            </ScaledSheet>
          </section>

          {approved && (
            <PrintPortal>
              <SalaryCertificateSheet data={data} />
            </PrintPortal>
          )}
        </>
      )}
    </div>
  )
}
