// src/components/hr/LeaveFormDialog.jsx
// ─────────────────────────────────────────────────────────────────────────────
// พรีวิวใบลา A4 + พิมพ์ / บันทึกเป็น PDF จากเบราว์เซอร์ (window.print — CSS .salary-cert-print ใน index.css
// ซ่อนทุกอย่างให้เหลือแผ่นเดียว) · ปุ่มสำรองดาวน์โหลด PDF เดิมของ backend
//
//   <LeaveFormDialog target={{ employeeId, leaveId, leave? }} onClose={() => setTarget(null)} />
// ─────────────────────────────────────────────────────────────────────────────
import { useEffect, useState } from "react"
import { Download, Printer } from "lucide-react"
import { apiDownload } from "../../lib/api"
import { saveBlob } from "../../lib/files"
import { loadLeaveForm } from "../../lib/leaveForm"
import { cx, neutralBtnCls, primaryBtnCls } from "../../lib/styles"
import { ErrorState, Sheet, Skeleton, toast } from "../ui"
import { PrintPortal, ScaledSheet } from "./SalaryCertificateDocument"
import { LeaveFormSheet } from "./LeaveFormDocument"

const btn = "h-12 md:pointer-fine:h-10 gap-2"

export default function LeaveFormDialog({ target, onClose }) {
  const open = !!target
  const [state, setState] = useState({ key: null, data: null, error: "" })
  const [reloadTick, setReloadTick] = useState(0)
  const [downloading, setDownloading] = useState(false)
  const [printedAt, setPrintedAt] = useState(() => new Date())
  const key = target ? `${target.employeeId}:${target.leaveId}:${reloadTick}` : null

  useEffect(() => {
    if (!target) return undefined
    let alive = true
    loadLeaveForm(target)
      .then((data) => { if (alive) setState({ key, data, error: "" }) })
      .catch((e) => { if (alive) setState({ key, data: null, error: e?.message || "โหลดข้อมูลใบลาไม่สำเร็จ" }) })
    return () => { alive = false }
  }, [target, key])

  const ready = state.key === key
  const data = ready ? state.data : null
  const error = ready ? state.error : ""

  const print = () => {
    setPrintedAt(new Date())
    // ให้ React วาดเวลาพิมพ์ใหม่ก่อนเปิดหน้าต่างพิมพ์
    requestAnimationFrame(() => requestAnimationFrame(() => window.print()))
  }

  const downloadPdf = async () => {
    setDownloading(true)
    try {
      const { blob, filename } = await apiDownload(`/hr/employees/${target.employeeId}/leaves/${target.leaveId}/pdf`)
      await saveBlob(blob, filename && filename !== "download" ? filename : `leave_${target.leaveId}.pdf`)
    } catch (err) {
      toast.error("ดาวน์โหลด PDF ไม่สำเร็จ", { description: err.message || "เกิดข้อผิดพลาด" })
    } finally {
      setDownloading(false)
    }
  }

  return (
    <>
      <Sheet
        open={open}
        onClose={onClose}
        title="ใบลา"
        subtitle={data ? `เลขที่ ${data.docNo} · ${data.name}` : target ? `เลขที่ ${target.leaveId}` : ""}
        size="full"
        initialFocus={null}
        footer={
          <div className="grid grid-cols-2 gap-3 md:flex md:justify-end md:gap-2">
            <button type="button" onClick={downloadPdf} disabled={downloading || !target} className={cx(neutralBtnCls, btn)}>
              <Download aria-hidden="true" className="size-4" strokeWidth={1.75} />
              {downloading ? "กำลังโหลด…" : "PDF จากระบบ"}
            </button>
            <button type="button" onClick={print} disabled={!data} className={cx(primaryBtnCls, btn)}>
              <Printer aria-hidden="true" className="size-4" strokeWidth={1.75} />
              พิมพ์ / บันทึก PDF
            </button>
          </div>
        }
      >
        {error ? (
          <ErrorState message={error} onRetry={() => setReloadTick((n) => n + 1)} />
        ) : data ? (
          <div className="rounded-xl bg-gray-100 p-3 md:p-5 dark:bg-canvas">
            <ScaledSheet className="mx-auto max-w-[794px]">
              <LeaveFormSheet data={data} printedAt={printedAt} />
            </ScaledSheet>
          </div>
        ) : (
          <div className="rounded-xl bg-gray-100 p-3 md:p-5 dark:bg-canvas" aria-busy="true">
            <Skeleton className="mx-auto block aspect-[210/297] w-full max-w-[794px]" />
            <span className="sr-only">กำลังโหลดใบลา…</span>
          </div>
        )}
      </Sheet>
      {open && data && (
        <PrintPortal>
          <LeaveFormSheet data={data} printedAt={printedAt} />
        </PrintPortal>
      )}
    </>
  )
}
