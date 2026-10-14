// src/components/ReportPdfButton.jsx
// ปุ่ม "PDF" ที่ดึงไฟล์ PDF จาก backend (คู่กับ ExcelDownloadButton) — เปิดในแท็บใหม่
// ถ้าแท็บถูกบล็อกจะดาวน์โหลดแทน · error แสดงผ่าน toast (404 ที่มี detail แสดงตามนั้น)
import { useRef, useState } from "react"
import { FileText } from "lucide-react"
import { apiDownload } from "../lib/api"
import { cx, neutralBtnCls } from "../lib/styles"
import { excelErrorMessage, saveBlob } from "../lib/reportFormat"
import { toast } from "./ui"

const neutralSpinnerCls =
  "size-4 shrink-0 animate-spin rounded-full border-2 border-gray-300 border-t-gray-700 dark:border-white/20 dark:border-t-gray-100"

export default function ReportPdfButton({ getPath, fallbackName = "report.pdf", label = "PDF", className = neutralBtnCls, disabled = false }) {
  const [loading, setLoading] = useState(false)
  const busyRef = useRef(false)

  const onClick = async () => {
    if (busyRef.current) return
    const path = getPath?.()
    if (!path) return
    busyRef.current = true
    setLoading(true)
    try {
      const { blob, filename } = await apiDownload(path)
      const url = URL.createObjectURL(blob)
      const win = window.open(url, "_blank")
      if (!win) saveBlob(blob, filename && filename !== "download" ? filename : fallbackName)
      setTimeout(() => URL.revokeObjectURL(url), 60_000)
    } catch (err) {
      console.error(err)
      toast.error("เปิด PDF ไม่สำเร็จ", { description: excelErrorMessage(err).replace("ไฟล์ Excel", "PDF") })
    } finally {
      busyRef.current = false
      setLoading(false)
    }
  }

  return (
    <button type="button" onClick={onClick} disabled={disabled || loading} aria-busy={loading || undefined} className={cx(className, loading && "cursor-wait")}>
      {loading ? (
        <span className={neutralSpinnerCls} aria-hidden="true" />
      ) : (
        <FileText aria-hidden="true" className="size-4 shrink-0 text-rose-600 dark:text-rose-400" strokeWidth={2} />
      )}
      {loading ? "กำลังสร้าง PDF…" : label}
    </button>
  )
}
