// src/components/ui/toast.js
// ─────────────────────────────────────────────────────────────────────────────
// Module-level toast emitter (no Context — project rule). <Toaster/> is mounted
// once in AppLayout and subscribes here.
//
//   import { toast } from "../components/ui"
//   toast.success("บันทึกแล้ว", { description: "…" })
//   toast.error("บันทึกไม่สำเร็จ", { description: err.message })
//   const id = toast.info("…"); toast.dismiss(id)
//
// Duration: 4s default, 7s for errors. Pass `duration: Infinity` to keep it open.
// ─────────────────────────────────────────────────────────────────────────────

const listeners = new Set()
let seq = 0

const DEFAULT_DURATION = { success: 4000, info: 4000, warning: 4000, error: 7000 }

function emit(event) {
  listeners.forEach((fn) => fn(event))
}

function show(type, title, opts = {}) {
  const id = opts.id ?? `t${++seq}`
  emit({
    kind: "show",
    toast: {
      id,
      type,
      title,
      description: opts.description,
      duration: opts.duration ?? DEFAULT_DURATION[type] ?? 4000,
    },
  })
  return id
}

/** Subscribe to toast events; returns an unsubscribe function. */
export function subscribe(fn) {
  listeners.add(fn)
  return () => listeners.delete(fn)
}

export const toast = {
  success: (title, opts) => show("success", title, opts),
  error: (title, opts) => show("error", title, opts),
  warning: (title, opts) => show("warning", title, opts),
  info: (title, opts) => show("info", title, opts),
  /** Dismiss one toast by id, or all toasts when called without an id. */
  dismiss: (id) => emit({ kind: "dismiss", id }),
}

export default toast
