// src/components/signature/SignaturePaper.jsx
// กล่อง "กระดาษ" แสดงลายเซ็น — พื้นสว่างทั้งสองโหมด (หมึกน้ำเงินเข้มมองไม่เห็นบนพื้นมืด)
import { cx } from "../../lib/styles"

const PAPER = "bg-[#f7f5ef] ring-1 ring-inset ring-black/5 dark:bg-[#e9e6dc]"

const SIZES = {
  sm: "h-12 w-28 sm:w-36",
  md: "h-20 w-full max-w-56",
  lg: "h-32 w-full max-w-sm",
}

export default function SignaturePaper({ src, loading = false, alt = "ลายมือชื่อ", empty = "ไม่มีรูป", size = "md", className }) {
  return (
    <div className={cx("flex shrink-0 items-center justify-center overflow-hidden rounded-lg", PAPER, SIZES[size], className)}>
      {src ? (
        <img src={src} alt={alt} className="max-h-[85%] max-w-[92%] object-contain" draggable="false" />
      ) : loading ? (
        <span className="h-3 w-16 animate-pulse rounded bg-black/10" aria-hidden="true" />
      ) : (
        <span className="px-2 text-center text-xs text-[#857f70]">{empty}</span>
      )}
    </div>
  )
}
