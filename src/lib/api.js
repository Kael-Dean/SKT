// src/lib/api.js

// เลือก BASE จาก .env ถ้ามี
const ENV_BASES = [
  import.meta.env.VITE_API_BASE,
  import.meta.env.VITE_API_BASE_RUNAPP,
  import.meta.env.VITE_API_BASE_CUSTOM,
].filter(Boolean);

function pickBase() {
  const first = ENV_BASES.find(Boolean);
  if (first) return first.replace(/\/$/, "");

  // ไม่มี .env → เดาตามสภาพแวดล้อม
  const host = typeof window !== "undefined" ? window.location.hostname : "";

  // โหมดพัฒนา: api รันที่ :8000 ตามดีฟอลต์ FastAPI
  if (host === "localhost" || host === "127.0.0.1") return "http://localhost:8000";

  // โปรดักชัน: สมมุติว่ามี reverse proxy แมป /api → FastAPI
  return "/api";
}
const API_BASE = pickBase();

/** join base + path ให้ปลอดภัยเรื่อง / ซ้อน */
function joinUrl(base, path) {
  const b = String(base || "").replace(/\/+$/, "");
  const p = String(path || "").replace(/^\/+/, "");
  return b ? `${b}/${p}` : `/${p}`;
}

// --------------------------------------------------
// internal fetch helper (JSON)
// --------------------------------------------------
async function _call(path, { method = "GET", body, headers } = {}) {
  const isJsonBody = body != null && !(body instanceof FormData);

  const res = await fetch(joinUrl(API_BASE, path), {
    method,
    headers: {
      ...(isJsonBody ? { "Content-Type": "application/json" } : {}),
      ...(headers || {}),
    },
    body: isJsonBody ? JSON.stringify(body) : body,
  });

  const ct = res.headers.get("content-type") || "";
  const data = ct.includes("application/json")
    ? await res.json().catch(() => ({}))
    : await res.text().catch(() => "");

  if (!res.ok) {
    // สกัดข้อความ error ให้เข้าใจง่าย (รองรับ FastAPI 422 detail)
    let msg = "Request failed";
    if (typeof data === "string" && data) msg = data;
    else if (data?.detail) {
      msg = Array.isArray(data.detail)
        ? data.detail.map((d) => (d.msg ? d.msg : JSON.stringify(d))).join(" | ")
        : (data.detail?.message || data.detail || msg);
    } else if (data?.message) msg = data.message;

    const error = new Error(msg || `HTTP ${res.status}`);
    error.status = res.status;
    error.data = data;
    throw error;
  }
  return data;
}

// public API
export function api(path, opts) {
  return _call(path, opts);
}

// --------------------------------------------------
// protected API (แนบ token อัตโนมัติ; เลือกได้ว่าจะ redirect เมื่อ 401 ไหม)
// --------------------------------------------------
import { getToken, logout } from "./auth"; // ใช้ชุด auth เดิมของคุณได้เลย :contentReference[oaicite:4]{index=4}

export async function apiAuth(path, opts = {}) {
  const token = getToken();
  const { redirectOn401 = false, ...rest } = opts;
  try {
    return await _call(path, {
      ...rest,
      headers: { ...(rest.headers || {}), ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    });
  } catch (err) {
    if (err.status === 401 && redirectOn401) {
      logout();
      // HashRouter:
      window.location.hash = "#/login";
      // BrowserRouter:
      // window.location.replace("/login")
    }
    throw err;
  }
}

// --------------------------------------------------
// download helper (binary)
// --------------------------------------------------
export async function apiDownload(path, opts = {}) {
  const token = getToken();
  const res = await fetch(joinUrl(API_BASE, path), {
    ...opts,
    headers: {
      ...(opts.headers || {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    const err = new Error(text || res.statusText || "Download failed");
    err.status = res.status;
    throw err;
  }
  const blob = await res.blob();
  let filename = "download";
  const cd = res.headers.get("content-disposition");
  if (cd) {
    const m = cd.match(/filename\*=UTF-8''([^;]+)|filename="?([^"]+)"?/i);
    const raw = m ? decodeURIComponent(m[1] || m[2] || "") : "";
    if (raw) filename = raw;
  }
  return { blob, filename };
}

// shorthand helpers
export const get  = (p, opts)       => apiAuth(p, opts);
export const post = (p, body, opts) => apiAuth(p, { method: "POST", body, ...(opts || {}) });
export const put  = (p, body, opts) => apiAuth(p, { method: "PUT",  body, ...(opts || {}) });
export const del  = (p, body, opts) => apiAuth(p, { method: "DELETE", body, ...(opts || {}) });
