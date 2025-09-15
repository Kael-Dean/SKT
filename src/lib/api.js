// src/lib/api.js
export const API_BASE = import.meta.env.VITE_API_BASE || ""

// --------------------------------------------------
// internal fetch helper (JSON)
// --------------------------------------------------
async function _call(path, { method = "GET", body, headers } = {}) {
  const isJsonBody = body != null && !(body instanceof FormData)

  const res = await fetch(`${API_BASE}${path}`, {
    method,
    headers: {
      ...(isJsonBody ? { "Content-Type": "application/json" } : {}),
      ...(headers || {}),
    },
    body: isJsonBody ? JSON.stringify(body) : body,
  })

  const ct = res.headers.get("content-type") || ""
  const data = ct.includes("application/json") ? await res.json() : await res.text()

  if (!res.ok) {
    const msg = typeof data === "string" ? data : (data?.detail || "Request failed")
    const error = new Error(msg)
    error.status = res.status
    error.data = data
    throw error
  }
  return data
}

// public API
export function api(path, opts) {
  return _call(path, opts)
}

// --------------------------------------------------
// protected API (แนบ token อัตโนมัติ; เลือกได้ว่าจะ redirect เมื่อ 401 ไหม)
// --------------------------------------------------
import { getToken, logout } from "./auth"

export async function apiAuth(path, opts = {}) {
  const token = getToken()
  const { redirectOn401 = false, ...rest } = opts   // <-- ค่าเริ่มต้น: ไม่ redirect
  try {
    return await _call(path, {
      ...rest,
      headers: { ...(rest.headers || {}), ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    })
  } catch (err) {
    if (err.status === 401 && redirectOn401) {
      logout()
      window.location.hash = "#/login"  // ถ้าใช้ HashRouter
      // window.location.replace("/login") // ถ้าใช้ BrowserRouter
    }
    throw err
  }
}

// --------------------------------------------------
// download helper (binary)
// --------------------------------------------------
export async function apiDownload(path, opts = {}) {
  const token = getToken()
  const res = await fetch(`${API_BASE}${path}`, {
    ...opts,
    headers: {
      ...(opts.headers || {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
  })
  if (!res.ok) {
    const text = await res.text().catch(() => "")
    const err = new Error(text || res.statusText || "Download failed")
    err.status = res.status
    throw err
  }
  const blob = await res.blob()
  let filename = "download"
  const cd = res.headers.get("content-disposition")
  if (cd) {
    const m = cd.match(/filename\*=UTF-8''([^;]+)|filename="?([^"]+)"?/i)
    const raw = m ? decodeURIComponent(m[1] || m[2] || "") : ""
    if (raw) filename = raw
  }
  return { blob, filename }
}

// shorthand helpers (ไม่ redirect 401 โดยอัตโนมัติ)
export const get  = (p, opts)       => apiAuth(p, opts)
export const post = (p, body, opts) => apiAuth(p, { method: "POST", body, ...(opts || {}) })
export const put  = (p, body, opts) => apiAuth(p, { method: "PUT",  body, ...(opts || {}) })
export const del  = (p, body, opts) => apiAuth(p, { method: "DELETE", body, ...(opts || {}) })
