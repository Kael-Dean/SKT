// src/components/AttachmentList.jsx
// ─────────────────────────────────────────────────────────────────────────────
// Read-only list of files already attached to a record (3F issue reports; 3B / 3Q later).
// GET /files/{id} needs the bearer token, so every open/download goes through
// fetch → blob → object URL (a plain <img src>/<a href> would 401/404).
//
//   <AttachmentList attachments={row.attachments} />                 // rows with thumbnails
//   <AttachmentList attachments={row.attachments} variant="compact" /> // chips, for table cells
//
// Props
//   attachments  [{ id, filename, content_type, size_bytes }]  (the API's Attachment shape)
//   variant      "list" (default) — rows, image thumbnails loaded lazily, open + download
//                "compact" — small chips (icon + name), click opens
//   emptyText    shown when there are no files; pass null to render nothing (default null)
//   className
//
// Open: images → preview sheet (with download); PDFs → new tab (falls back to download
// if the popup is blocked). 404 = missing or no permission (the API uses one code for both).
// ─────────────────────────────────────────────────────────────────────────────
import { useEffect, useState } from "react"
import { Download, FileText, Image as ImageIcon, LoaderCircle } from "lucide-react"
import { cx, focusRingCls, iconBtnCls, neutralBtnCls, primaryBtnCls } from "../lib/styles"
import { fetchFileBlob, formatBytes, isImageType, isPdfType, saveBlob } from "../lib/files"
import { Sheet, toast } from "./ui"

// Object URLs per file id for this session — attachments are immutable once attached.
const blobCache = new Map() // id → Promise<{ url, blob, filename }>

function loadBlob(id) {
  if (!blobCache.has(id)) {
    const p = fetchFileBlob(id)
      .then(({ blob, filename }) => ({ url: URL.createObjectURL(blob), blob, filename }))
      .catch((err) => { blobCache.delete(id); throw err })
    blobCache.set(id, p)
  }
  return blobCache.get(id)
}

const openErrorMessage = (err) =>
  err?.status === 404 ? "ไม่พบไฟล์ หรือคุณไม่มีสิทธิ์เปิดไฟล์นี้" : err?.message || "เปิดไฟล์ไม่สำเร็จ"

function TypeIcon({ type, className = "size-5" }) {
  return isImageType(type) ? <ImageIcon aria-hidden="true" className={className} /> : <FileText aria-hidden="true" className={className} />
}

function Thumb({ file }) {
  const [url, setUrl] = useState(null)
  useEffect(() => {
    if (!isImageType(file.content_type)) return
    let alive = true
    loadBlob(file.id).then((r) => alive && setUrl(r.url)).catch(() => {})
    return () => { alive = false }
  }, [file.id, file.content_type])

  if (url) return <img src={url} alt="" className="size-12 shrink-0 rounded-lg object-cover ring-1 ring-gray-200 dark:ring-line" />
  return (
    <span
      aria-hidden="true"
      className={cx(
        "flex size-12 shrink-0 items-center justify-center rounded-lg ring-1",
        isPdfType(file.content_type)
          ? "bg-rose-50 text-rose-700 ring-rose-200/70 dark:bg-rose-500/10 dark:text-rose-300 dark:ring-rose-400/20"
          : "bg-gray-50 text-gray-500 ring-gray-200 dark:bg-white/[.04] dark:text-gray-400 dark:ring-line"
      )}
    >
      <TypeIcon type={file.content_type} />
    </span>
  )
}

function ImagePreview({ preview, onClose }) {
  const download = () => saveBlob(preview.blob, preview.filename)
  return (
    <Sheet
      open
      onClose={onClose}
      title={preview.filename}
      size="lg"
      z={10045} // above a parent detail Sheet (10040), below dropdowns (10050)
      footer={
        <div className="grid grid-cols-2 gap-3 md:flex md:justify-end md:gap-2">
          <button type="button" onClick={onClose} className={neutralBtnCls}>ปิด</button>
          <button type="button" onClick={download} className={primaryBtnCls}>
            <Download aria-hidden="true" className="size-4" /> ดาวน์โหลด
          </button>
        </div>
      }
    >
      <img src={preview.url} alt={preview.filename} className="mx-auto max-h-[70dvh] w-auto rounded-lg object-contain" />
    </Sheet>
  )
}

export default function AttachmentList({ attachments, variant = "list", emptyText = null, className = "" }) {
  const [busyId, setBusyId] = useState(null)
  const [preview, setPreview] = useState(null)
  const files = Array.isArray(attachments) ? attachments.filter((a) => a && a.id != null) : []

  if (!files.length) {
    return emptyText ? <p className={cx("text-xs text-gray-500 dark:text-gray-400", className)}>{emptyText}</p> : null
  }

  const open = async (file) => {
    // PDFs: open the tab synchronously (inside the click) so popup blockers allow it
    const win = isPdfType(file.content_type) ? window.open("", "_blank") : null
    setBusyId(file.id)
    try {
      const r = await loadBlob(file.id)
      const name = file.filename || r.filename
      if (isImageType(file.content_type)) {
        setPreview({ url: r.url, blob: r.blob, filename: name })
      } else if (win) {
        win.location.href = r.url
      } else {
        saveBlob(r.blob, name)
      }
    } catch (err) {
      win?.close()
      toast.error("เปิดไฟล์ไม่สำเร็จ", { description: openErrorMessage(err) })
    } finally {
      setBusyId(null)
    }
  }

  const download = async (file) => {
    setBusyId(file.id)
    try {
      const r = await loadBlob(file.id)
      saveBlob(r.blob, file.filename || r.filename)
    } catch (err) {
      toast.error("ดาวน์โหลดไม่สำเร็จ", { description: openErrorMessage(err) })
    } finally {
      setBusyId(null)
    }
  }

  if (variant === "compact") {
    return (
      <ul className={cx("flex flex-wrap gap-1.5", className)} aria-label={`ไฟล์แนบ ${files.length} ไฟล์`}>
        {files.map((f) => (
          <li key={f.id} className="min-w-0">
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); open(f) }}
              aria-label={`เปิดไฟล์ ${f.filename}`}
              title={f.filename}
              className={cx(
                "inline-flex max-w-[12rem] min-h-8 items-center gap-1.5 rounded-lg px-2 text-xs font-medium",
                "bg-gray-100 text-gray-700 hover:bg-indigo-50 hover:text-indigo-700",
                "dark:bg-white/[.06] dark:text-gray-200 dark:hover:bg-indigo-500/15 dark:hover:text-indigo-200",
                "transition-colors duration-150 cursor-pointer",
                focusRingCls
              )}
            >
              {busyId === f.id
                ? <LoaderCircle aria-hidden="true" className="size-3.5 shrink-0 animate-spin" />
                : <TypeIcon type={f.content_type} className="size-3.5 shrink-0" />}
              <span className="truncate">{f.filename}</span>
            </button>
          </li>
        ))}
        {preview && <ImagePreview preview={preview} onClose={() => setPreview(null)} />}
      </ul>
    )
  }

  return (
    <>
      <ul className={cx("divide-y divide-gray-100 dark:divide-line", className)} aria-label={`ไฟล์แนบ ${files.length} ไฟล์`}>
        {files.map((f) => (
          <li key={f.id} className="flex items-center gap-3 py-2">
            <button
              type="button"
              onClick={() => open(f)}
              className={cx("flex min-w-0 flex-1 items-center gap-3 rounded-lg text-left cursor-pointer group", focusRingCls)}
            >
              <Thumb file={f} />
              <span className="min-w-0">
                <span className="block truncate text-sm font-medium text-gray-900 group-hover:text-indigo-700 group-hover:underline dark:text-gray-100 dark:group-hover:text-indigo-300">
                  {f.filename}
                </span>
                <span className="block text-xs tabular-nums text-gray-500 dark:text-gray-400">
                  {isPdfType(f.content_type) ? "PDF" : "รูปภาพ"} · {formatBytes(f.size_bytes)}
                </span>
              </span>
            </button>
            {busyId === f.id
              ? <LoaderCircle aria-label="กำลังโหลดไฟล์" className="size-4 shrink-0 animate-spin text-indigo-500" />
              : (
                <button type="button" onClick={() => download(f)} className={iconBtnCls} aria-label={`ดาวน์โหลด ${f.filename}`}>
                  <Download aria-hidden="true" className="size-4" />
                </button>
              )}
          </li>
        ))}
      </ul>
      {preview && <ImagePreview preview={preview} onClose={() => setPreview(null)} />}
    </>
  )
}
