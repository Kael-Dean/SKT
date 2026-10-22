// src/hooks/useFileUploads.js
// ─────────────────────────────────────────────────────────────────────────────
// State + side effects for <FileUploader>. The page owns the hook so it can read
// the ids at submit time and decide what happens on cancel.
//
//   const uploads = useFileUploads()                 // defaults: 5 files, 5 MB, PDF/JPG/PNG/WEBP
//   <FileUploader uploads={uploads} label="ไฟล์แนบ" />
//
//   uploads.ids        number[]  server ids of finished uploads → send as attachment_ids
//   uploads.busy       boolean   an upload is still running (disable submit)
//   uploads.hasErrors  boolean   a row is in the error state (let the user fix/remove it)
//   uploads.reset()    clear the list after a successful submit (files are now attached — no DELETE)
//   uploads.discard()  user cancelled the form → abort running uploads + DELETE /files/{id} for finished ones
//
// Options: { maxFiles = 5, maxBytes = 5 MB, deleteOnRemove = true }
//   deleteOnRemove — removing a finished row calls DELETE /files/{id} (handoff: "If the user
//   removes a file before submitting, call DELETE /files/{id}").
//
// Item shape (uploads.items):
//   { key, name, size, type, status: "uploading" | "done" | "error", progress: 0-100,
//     error: string, retryable: boolean, previewUrl: string | null (local image preview),
//     meta: FileMeta | null (server response — use meta.id / meta.content_type, never the local guess) }
// ─────────────────────────────────────────────────────────────────────────────
import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { FILE_MAX_BYTES, FILE_MAX_COUNT, deleteFile, uploadFile, validateFile } from "../lib/files"

let seq = 0
const nextKey = () => `up${Date.now().toString(36)}${++seq}`

export default function useFileUploads({ maxFiles = FILE_MAX_COUNT, maxBytes = FILE_MAX_BYTES, deleteOnRemove = true } = {}) {
  const [items, setItems] = useState([])
  const [notice, setNotice] = useState("")
  const itemsRef = useRef(items)
  const controllers = useRef(new Map())

  useEffect(() => { itemsRef.current = items }, [items])

  // abort running uploads + free local previews on unmount
  useEffect(() => {
    const ctrls = controllers.current
    return () => {
      ctrls.forEach((c) => c.abort())
      ctrls.clear()
      itemsRef.current.forEach((it) => it.previewUrl && URL.revokeObjectURL(it.previewUrl))
    }
  }, [])

  const patch = useCallback((key, p) => {
    setItems((list) => list.map((it) => (it.key === key ? { ...it, ...p } : it)))
  }, [])

  const start = useCallback((key, file) => {
    const ctrl = new AbortController()
    controllers.current.set(key, ctrl)
    patch(key, { status: "uploading", progress: 0, error: "", retryable: false })
    uploadFile(file, { signal: ctrl.signal, onProgress: (progress) => patch(key, { progress }) })
      .then((meta) => patch(key, { status: "done", progress: 100, meta }))
      .catch((err) => {
        if (err?.name === "AbortError") return
        // 400/413/415 = the file itself is wrong → retry won't help
        const retryable = !err?.status || err.status >= 500
        patch(key, { status: "error", error: err?.message || "อัปโหลดไม่สำเร็จ", retryable })
      })
      .finally(() => controllers.current.delete(key))
  }, [patch])

  /** Add files from an <input type=file> or a drop. Invalid files show as error rows. */
  const add = useCallback((fileList) => {
    const files = Array.from(fileList || [])
    if (!files.length) return
    const used = itemsRef.current.filter((it) => it.status !== "error").length
    let room = Math.max(0, maxFiles - used)
    const fresh = []
    let skipped = 0
    for (const file of files) {
      const error = validateFile(file, { maxBytes })
      if (!error && room <= 0) { skipped++; continue }
      const isImg = !error && file.type?.startsWith("image/")
      const item = {
        key: nextKey(), name: file.name, size: file.size, type: file.type, file,
        status: error ? "error" : "uploading", progress: 0, error, retryable: false,
        previewUrl: isImg ? URL.createObjectURL(file) : null, meta: null,
      }
      if (!error) room--
      fresh.push(item)
    }
    setNotice(skipped ? `แนบได้สูงสุด ${maxFiles} ไฟล์ — ไม่ได้เพิ่ม ${skipped} ไฟล์` : "")
    if (!fresh.length) return
    setItems((list) => [...list, ...fresh])
    fresh.forEach((it) => { if (it.status === "uploading") start(it.key, it.file) })
  }, [maxFiles, maxBytes, start])

  const retry = useCallback((key) => {
    const it = itemsRef.current.find((x) => x.key === key)
    if (it?.file) start(key, it.file)
  }, [start])

  /** Remove one row. Running upload → abort; finished → DELETE /files/{id} (best effort). */
  const remove = useCallback(async (key) => {
    const it = itemsRef.current.find((x) => x.key === key)
    if (!it) return
    controllers.current.get(key)?.abort()
    controllers.current.delete(key)
    if (it.status === "done" && it.meta?.id != null && deleteOnRemove) {
      try {
        await deleteFile(it.meta.id)
      } catch (err) {
        // 404 = already gone/expired → fine to drop. 409 = attached → keep it, tell the user.
        if (err?.status === 409) {
          patch(key, { error: err.message || "ไฟล์ถูกแนบกับคำขอแล้ว ลบไม่ได้" })
          return
        }
      }
    }
    if (it.previewUrl) URL.revokeObjectURL(it.previewUrl)
    setItems((list) => list.filter((x) => x.key !== key))
    setNotice("")
  }, [deleteOnRemove, patch])

  const clearLocal = useCallback(() => {
    controllers.current.forEach((c) => c.abort())
    controllers.current.clear()
    itemsRef.current.forEach((it) => it.previewUrl && URL.revokeObjectURL(it.previewUrl))
    setItems([])
    setNotice("")
  }, [])

  /** After a successful submit: files are attached to the record now — just clear. */
  const reset = clearLocal

  /** Form cancelled: delete what we uploaded so it doesn't linger for 24 h. */
  const discard = useCallback(() => {
    const done = itemsRef.current.filter((it) => it.status === "done" && it.meta?.id != null)
    clearLocal()
    if (deleteOnRemove) done.forEach((it) => deleteFile(it.meta.id).catch(() => {}))
  }, [clearLocal, deleteOnRemove])

  return useMemo(() => {
    const ids = items.filter((it) => it.status === "done" && it.meta?.id != null).map((it) => it.meta.id)
    return {
      items, notice, maxFiles, maxBytes,
      ids,
      count: items.filter((it) => it.status !== "error").length,
      busy: items.some((it) => it.status === "uploading"),
      hasErrors: items.some((it) => it.status === "error"),
      add, remove, retry, reset, discard,
    }
  }, [items, notice, maxFiles, maxBytes, add, remove, retry, reset, discard])
}
