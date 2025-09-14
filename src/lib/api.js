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

// public API (ไม่ต้องใช้ token)
export function api(path, opts) {
  return _call(path, opts)
}

// --------------------------------------------------
// protected API (แนบ token อัตโนมัติ + เด้ง login เมื่อ 401)
// --------------------------------------------------
import { getToken, logout } from "./auth"

export async function apiAuth(path, opts = {}) {
  const token = getToken()
  try {
    return await _call(path, {
      ...opts,
      headers: { ...(opts.headers || {}), ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    })
  } catch (err) {
    if (err.status === 401) {
      logout()
      // ถ้าใช้ HashRouter:
      window.location.hash = "#/login"
      // ถ้าใช้ BrowserRouter ให้ใช้: window.location.replace("/login")
    }
    throw err
  }
}

// --------------------------------------------------
// download helper (ไฟล์ binary: excel/pdf/zip ...)
// --------------------------------------------------
export async function apiDownload(path, opts = {}) {
  const token = getToken()

  const res = await fetch(`${API_BASE}${path}`, {
    ...opts,
    headers: {
      ...(opts.headers || {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      // ❌ อย่าใส่ Content-Type เอง ให้ browser จัดการ
    },
  })

  if (!res.ok) {
    const text = await res.text().catch(() => "")
    const err = new Error(text || res.statusText || "Download failed")
    err.status = res.status
    throw err
  }

  const blob = await res.blob()

  // ดึงชื่อไฟล์จาก header ถ้ามี
  let filename = "download"
  const cd = res.headers.get("content-disposition")
  if (cd) {
    const m = cd.match(/filename\*=UTF-8''([^;]+)|filename="?([^"]+)"?/i)
    const raw = m ? decodeURIComponent(m[1] || m[2] || "") : ""
    if (raw) filename = raw
  }
  return { blob, filename }
}

// shorthand helpers
export const get  = (p)       => apiAuth(p)
export const post = (p, body) => apiAuth(p, { method: "POST", body })
export const put  = (p, body) => apiAuth(p, { method: "PUT", body })
export const del  = (p, body) => apiAuth(p, { method: "DELETE", body })
