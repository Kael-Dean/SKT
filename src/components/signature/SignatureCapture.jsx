// src/components/signature/SignatureCapture.jsx
// เลือก/ถ่ายรูปลายเซ็น → แปลงเป็น PNG โปร่งใสในเครื่อง → พรีวิวบนพื้นกระดาษ
//   <SignatureCapture value={result} onChange={setResult} />   result = { file, url } | null
import { useEffect, useRef, useState } from "react"
import { Camera, CircleAlert, RotateCcw } from "lucide-react"
import { SIGNATURE_INPUT_ACCEPT, toTransparentSignature } from "../../lib/signatureImage"
import { cx, helpTextCls, neutralBtnCls } from "../../lib/styles"
import SignaturePaper from "./SignaturePaper"

export default function SignatureCapture({ value, onChange, disabled = false, id = "signature-capture" }) {
  const inputRef = useRef(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState("")

  // คืน object URL ของพรีวิวเก่าเมื่อเปลี่ยนรูป / ออกจากหน้า
  useEffect(() => () => { if (value?.url) URL.revokeObjectURL(value.url) }, [value?.url])

  const pick = async (file) => {
    if (!file) return
    setBusy(true)
    setError("")
    try {
      const r = await toTransparentSignature(file)
      onChange({ file: r.file, url: r.url })
    } catch (e) {
      setError(e?.message || "แปลงรูปไม่สำเร็จ")
      onChange(null)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="space-y-3">
      <input
        ref={inputRef}
        id={id}
        type="file"
        accept={SIGNATURE_INPUT_ACCEPT}
        hidden
        onChange={(e) => { pick(e.target.files?.[0]); e.target.value = "" }}
      />
      {value?.url ? (
        <div className="space-y-2">
          <SignaturePaper size="lg" src={value.url} alt="ลายเซ็นที่จะส่ง" />
          <p className={helpTextCls}>ตัดพื้นหลังให้แล้ว นี่คือหน้าตาลายเซ็นที่จะปรากฏในเอกสาร</p>
          <button type="button" className={cx(neutralBtnCls, "!h-11 gap-2")} onClick={() => inputRef.current?.click()} disabled={disabled || busy}>
            <RotateCcw className="size-4" aria-hidden="true" /> เลือกรูปใหม่
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={disabled || busy}
          aria-describedby={`${id}-hint`}
          className="flex w-full flex-col items-center gap-2 rounded-2xl border-2 border-dashed border-gray-300 px-4 py-8 text-center transition-colors duration-200 hover:border-indigo-400 hover:bg-indigo-50/40 disabled:opacity-60 dark:border-line-strong dark:hover:border-indigo-400 dark:hover:bg-indigo-500/5"
        >
          <Camera className="size-8 text-indigo-500 dark:text-indigo-300" aria-hidden="true" />
          <span className="font-medium text-gray-900 dark:text-gray-100">{busy ? "กำลังตัดพื้นหลัง…" : "ถ่ายรูป / เลือกรูปลายเซ็น"}</span>
          <span id={`${id}-hint`} className={helpTextCls}>
            เซ็นด้วยปากกาสีเข้มบนกระดาษขาว ถ่ายตรง ๆ ในที่สว่าง ไม่ให้มีเงา · JPG หรือ PNG
          </span>
        </button>
      )}
      {error && (
        <p role="alert" className="flex items-start gap-1.5 text-sm text-red-600 dark:text-red-400">
          <CircleAlert className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
          {error}
        </p>
      )}
    </div>
  )
}
