// src/lib/api.js
export const API_BASE = import.meta.env.VITE_API_BASE || ""

async function _call(path, { method = "GET", body, headers } = {}) {
  const res = await fetch(`${API_BASE}${path}`, {
    method,
    headers: {
      "Content-Type": "application/json",
      ...(headers || {}),
    },
    body: body ? JSON.stringify(body) : undefined,
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

// ใช้เรียก public API (ไม่ต้องใช้ token)
export function api(path, opts) {
  return _call(path, opts)
}

// ⬇️ ใช้เรียก protected API (แนบ token อัตโนมัติ + auto redirect เมื่อ 401)
import { getToken, logout } from "./auth"
export async function apiAuth(path, opts = {}) {
  const token = getToken()
  try {
    return await _call(path, {
      ...opts,
      headers: { ...(opts.headers || {}), Authorization: `Bearer ${token}` },
    })
  } catch (err) {
    if (err.status === 401) {
      logout()
      // เด้งไปหน้า login (HashRouter)
      window.location.hash = "#/login"
    }
    throw err
  }
}

// helper สั้นๆ
export const get  = (p)        => apiAuth(p)
export const post = (p, body)  => apiAuth(p, { method: "POST", body })
export const put  = (p, body)  => apiAuth(p, { method: "PUT", body })
export const del  = (p, body)  => apiAuth(p, { method: "DELETE", body })
