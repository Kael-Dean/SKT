// src/components/ExcelDownloadButton.jsx
// "Excel" button that sits beside a report's PDF button. It owns its own
// loading state (independent of the PDF button), derives the xlsx URL from the
// PDF path via excelUrl(), saves the attachment as a blob, and reports errors
// through toast — an error response is never saved as a file.
import { useRef, useState } from "react"
import { FileSpreadsheet } from "lucide-react"
import { cx, neutralBtnCls } from "../lib/styles"
import { downloadExcel, excelErrorMessage, EXCEL_HINT } from "../lib/reportFormat"
import { toast } from "./ui"

/** Spinner tinted for neutral/outline buttons (spinnerCls is white-on-colour). */
const neutralSpinnerCls =
  "size-4 shrink-0 animate-spin rounded-full border-2 border-gray-300 border-t-gray-700 " +
  "dark:border-white/20 dark:border-t-gray-100"

/**
 * @param {() => string | null | undefined} getPdfPath
 *   Returns the exact PDF path (with query string) the PDF button would request,
 *   or a falsy value to abort (the caller has already shown its validation message).
 * @param {string} [fallbackName]  filename when the response has none (".pdf" is swapped for ".xlsx")
 * @param {string} [label]         button text
 * @param {string} [className]     button classes (default: neutralBtnCls — 44px on phones)
 */
export default function ExcelDownloadButton({
  getPdfPath,
  fallbackName,
  label = "Excel",
  className = neutralBtnCls,
  disabled = false,
}) {
  const [loading, setLoading] = useState(false)
  const busyRef = useRef(false) // guards double-clicks before the re-render lands

  const onClick = async () => {
    if (busyRef.current) return
    const pdfPath = getPdfPath?.()
    if (!pdfPath) return
    busyRef.current = true
    setLoading(true)
    try {
      const name = await downloadExcel(pdfPath, { fallbackName })
      toast.success("ดาวน์โหลด Excel แล้ว", { description: `${name} · ${EXCEL_HINT}` })
    } catch (err) {
      console.error(err)
      toast.error("ดาวน์โหลด Excel ไม่สำเร็จ", { description: excelErrorMessage(err) })
    } finally {
      busyRef.current = false
      setLoading(false)
    }
  }

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      title={EXCEL_HINT}
      className={cx(className, loading && "cursor-wait")}
    >
      {loading ? (
        <span className={neutralSpinnerCls} aria-hidden="true" />
      ) : (
        <FileSpreadsheet aria-hidden="true" className="size-4 shrink-0 text-emerald-700 dark:text-emerald-400" strokeWidth={2} />
      )}
      {loading ? "กำลังสร้าง Excel…" : label}
    </button>
  )
}
