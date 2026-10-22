// src/components/FileUploader.jsx
// ─────────────────────────────────────────────────────────────────────────────
// Shared file picker + upload list (งวด 4 · 3F; reused by 3B ใบรับรองแพทย์ and 3Q หลักฐาน).
// Uploads each file to POST /files as soon as it is picked, shows progress, and
// lets the user remove (DELETE /files/{id}) or retry before the form is sent.
//
//   import FileUploader from "../components/FileUploader"
//   import useFileUploads from "../hooks/useFileUploads"
//
//   const uploads = useFileUploads()                     // { maxFiles, maxBytes, deleteOnRemove }
//   <FileUploader uploads={uploads} label="ไฟล์แนบ" hint="เช่น สำเนาบัตรประชาชน" />
//   …submit: disabled={uploads.busy}; body.attachment_ids = uploads.ids; then uploads.reset()
//   …cancel: uploads.discard()
//
// Props
//   uploads    (required) the object returned by useFileUploads()
//   label      field label (default "ไฟล์แนบ"); rendered as the group's accessible name
//   hint       one line under the label (e.g. what to attach)
//   optional   show "(ไม่บังคับ)" after the label (default true)
//   disabled   lock the picker and the remove buttons (e.g. while the form submits)
//   accept     input accept list (default PDF/JPG/PNG/WEBP — lets iPhones convert HEIC → JPEG)
//   id         base id for label/description wiring (default useId())
//   className  wrapper class
//
// Client checks (lib/files.js validateFile): type, empty file, size; the count cap
// is enforced by the hook. Server messages (413/415/400) are shown as-is.
// No optimistic UI: a row counts only after the server returns its id.
// ─────────────────────────────────────────────────────────────────────────────
import { useId, useRef, useState } from "react"
import { CircleAlert, FileText, LoaderCircle, Paperclip, RotateCw, X } from "lucide-react"
import { cx, focusRingCls, iconBtnCls } from "../lib/styles"
import { FILE_ACCEPT, formatBytes, isPdfType } from "../lib/files"

function RowIcon({ item }) {
  if (item.previewUrl) {
    return (
      <img
        src={item.previewUrl}
        alt=""
        className="size-10 shrink-0 rounded-lg object-cover ring-1 ring-gray-200 dark:ring-line"
      />
    )
  }
  const pdf = isPdfType(item.meta?.content_type || item.type)
  return (
    <span
      aria-hidden="true"
      className={cx(
        "flex size-10 shrink-0 items-center justify-center rounded-lg ring-1",
        item.status === "error"
          ? "bg-red-50 text-red-600 ring-red-200 dark:bg-red-500/10 dark:text-red-300 dark:ring-red-400/20"
          : pdf
            ? "bg-rose-50 text-rose-700 ring-rose-200/70 dark:bg-rose-500/10 dark:text-rose-300 dark:ring-rose-400/20"
            : "bg-gray-50 text-gray-500 ring-gray-200 dark:bg-white/[.04] dark:text-gray-400 dark:ring-line"
      )}
    >
      {item.status === "error" ? <CircleAlert className="size-5" /> : <FileText className="size-5" />}
    </span>
  )
}

function UploadRow({ item, onRemove, onRetry, disabled }) {
  const uploading = item.status === "uploading"
  const failed = item.status === "error"
  return (
    <li className="flex items-center gap-3 py-2.5">
      <RowIcon item={item} />
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-gray-900 dark:text-gray-100" title={item.name}>
          {item.meta?.filename || item.name}
        </p>
        {uploading ? (
          <div className="mt-1.5 flex items-center gap-2">
            <div
              role="progressbar"
              aria-label={`กำลังอัปโหลด ${item.name}`}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={item.progress}
              className="h-1.5 flex-1 overflow-hidden rounded-full bg-gray-200 dark:bg-white/10"
            >
              <div
                className="h-full rounded-full bg-indigo-500 transition-[width] duration-200 ease-out dark:bg-indigo-400"
                style={{ width: `${item.progress}%` }}
              />
            </div>
            <span className="w-9 text-right text-xs tabular-nums text-gray-500 dark:text-gray-400">{item.progress}%</span>
          </div>
        ) : failed || item.error ? (
          <p className="mt-0.5 text-xs text-red-600 dark:text-red-400">{item.error}</p>
        ) : (
          <p className="mt-0.5 text-xs tabular-nums text-gray-500 dark:text-gray-400">
            {formatBytes(item.meta?.size_bytes ?? item.size)} · อัปโหลดแล้ว
          </p>
        )}
      </div>
      {uploading && <LoaderCircle aria-hidden="true" className="size-4 shrink-0 animate-spin text-indigo-500 dark:text-indigo-300" />}
      {failed && item.retryable && (
        <button type="button" onClick={() => onRetry(item.key)} disabled={disabled} className={iconBtnCls} aria-label={`ลองอัปโหลด ${item.name} อีกครั้ง`}>
          <RotateCw aria-hidden="true" className="size-4" />
        </button>
      )}
      <button
        type="button"
        onClick={() => onRemove(item.key)}
        disabled={disabled}
        className={iconBtnCls}
        aria-label={uploading ? `ยกเลิกอัปโหลด ${item.name}` : `นำ ${item.name} ออก`}
      >
        <X aria-hidden="true" className="size-4" />
      </button>
    </li>
  )
}

export default function FileUploader({
  uploads,
  label = "ไฟล์แนบ",
  hint,
  optional = true,
  disabled = false,
  accept = FILE_ACCEPT,
  id,
  className = "",
}) {
  const autoId = useId()
  const baseId = id || `fu${autoId.replace(/:/g, "")}`
  const inputRef = useRef(null)
  const [dragOver, setDragOver] = useState(false)
  const { items, notice, maxFiles, maxBytes, count } = uploads
  const full = count >= maxFiles
  const locked = disabled || full

  const pick = () => { if (!locked) inputRef.current?.click() }
  const onInput = (e) => {
    uploads.add(e.target.files)
    e.target.value = "" // allow picking the same file again after removing it
  }
  const onDrop = (e) => {
    e.preventDefault()
    setDragOver(false)
    if (!locked) uploads.add(e.dataTransfer?.files)
  }

  const rules = `PDF, JPG, PNG หรือ WEBP · ไม่เกิน ${formatBytes(maxBytes)} ต่อไฟล์ · สูงสุด ${maxFiles} ไฟล์`

  return (
    <div role="group" aria-labelledby={`${baseId}-label`} aria-describedby={`${baseId}-rules`} className={className}>
      <div className="mb-1 flex items-baseline justify-between gap-2">
        <span id={`${baseId}-label`} className="text-xs font-medium text-gray-600 dark:text-gray-400">
          {label}
          {optional && <span className="font-normal text-gray-500 dark:text-gray-400"> (ไม่บังคับ)</span>}
        </span>
        <span className="text-xs tabular-nums text-gray-500 dark:text-gray-400" aria-label={`แนบแล้ว ${count} จาก ${maxFiles} ไฟล์`}>
          {count}/{maxFiles}
        </span>
      </div>
      {hint && <p className="mb-2 text-xs text-gray-500 dark:text-gray-400">{hint}</p>}

      <input
        ref={inputRef}
        id={`${baseId}-input`}
        type="file"
        multiple
        accept={accept}
        onChange={onInput}
        disabled={locked}
        className="sr-only"
        tabIndex={-1}
        aria-hidden="true"
      />
      <button
        type="button"
        onClick={pick}
        disabled={locked}
        onDragOver={(e) => { e.preventDefault(); if (!locked) setDragOver(true) }}
        onDragLeave={() => setDragOver(false)}
        onDrop={onDrop}
        className={cx(
          "flex w-full min-h-touch items-center gap-3 rounded-xl border border-dashed px-3 py-3 text-left",
          "transition-colors duration-150 cursor-pointer disabled:cursor-not-allowed",
          dragOver
            ? "border-indigo-500 bg-indigo-50 dark:border-indigo-400 dark:bg-indigo-500/10"
            : "border-gray-300 bg-gray-50 hover:border-indigo-400 hover:bg-indigo-50/60 dark:border-line-field dark:bg-field dark:hover:border-indigo-400/60 dark:hover:bg-indigo-500/[.06]",
          locked && "opacity-60 hover:border-gray-300 hover:bg-gray-50 dark:hover:border-line-field dark:hover:bg-field",
          focusRingCls
        )}
      >
        <span aria-hidden="true" className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-white text-indigo-600 ring-1 ring-gray-200 dark:bg-white/[.06] dark:text-indigo-300 dark:ring-line">
          <Paperclip className="size-4" />
        </span>
        <span className="min-w-0">
          <span className="block text-sm font-semibold text-gray-800 dark:text-gray-100">
            {full ? `แนบครบ ${maxFiles} ไฟล์แล้ว` : "เลือกไฟล์หรือถ่ายรูป"}
            {!full && <span className="hidden font-normal text-gray-500 md:inline dark:text-gray-400"> หรือลากไฟล์มาวางที่นี่</span>}
          </span>
          <span id={`${baseId}-rules`} className="block text-xs text-gray-500 dark:text-gray-400">{rules}</span>
        </span>
      </button>

      <p aria-live="polite" className={cx("text-xs text-amber-700 dark:text-amber-300", notice ? "mt-1.5" : "sr-only")}>
        {notice}
      </p>

      {items.length > 0 && (
        <ul aria-label={label} className="mt-1 divide-y divide-gray-100 dark:divide-line">
          {items.map((it) => (
            <UploadRow key={it.key} item={it} onRemove={uploads.remove} onRetry={uploads.retry} disabled={disabled} />
          ))}
        </ul>
      )}
    </div>
  )
}
