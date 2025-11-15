// src/pages/Login.jsx
import { useState, useMemo } from "react"
import { useNavigate, Navigate } from "react-router-dom"

/** ---- JWT helpers (decode ฝั่ง client) ---- */
function decodeJwtPayload(token) {
  try {
    const base64Url = token.split(".")[1]
    if (!base64Url) return null
    const base64 = base64Url.replace(/-/g, "+").replace(/_/g, "/")
    const json = decodeURIComponent(
      atob(base64)
        .split("")
        .map((c) => "%" + ("00" + c.charCodeAt(0).toString(16)).slice(-2))
        .join("")
    )
    return JSON.parse(json)
  } catch {
    return null
  }
}
function isTokenExpired(token) {
  const p = decodeJwtPayload(token)
  if (!p?.exp) return true
  const now = Math.floor(Date.now() / 1000)
  return now >= Number(p.exp)
}

/** ---- API calls (รองรับทั้ง JSON และ Form) ---- */
async function loginViaJson(username, password) {
  const res = await fetch("/auth/login_json", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username, password }),
  })
  if (!res.ok) {
    const msg = (await res.json().catch(() => ({})))?.detail || `HTTP ${res.status}`
    throw new Error(msg)
  }
  return res.json() // { access_token, token_type }
}
async function loginViaForm(username, password) {
  const body = new URLSearchParams()
  body.set("username", username)
  body.set("password", password)
  // OAuth2PasswordRequestForm รองรับฟิลด์อื่น ๆ ได้ แต่ไม่จำเป็น
  const res = await fetch("/auth/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  })
  if (!res.ok) {
    const msg = (await res.json().catch(() => ({})))?.detail || `HTTP ${res.status}`
    throw new Error(msg)
  }
  return res.json() // { access_token, token_type }
}

/** ---- UI ---- */
const Login = () => {
  // แบ็กเอนด์ใช้ "username" (ไม่ใช่ email)
  const [username, setUsername] = useState("")
  const [password, setPassword] = useState("")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")
  const navigate = useNavigate()

  // ถ้ามี token และยังไม่หมดอายุ ให้เด้งเข้าหน้าหลัก
  const token = useMemo(() => localStorage.getItem("token") || "", [])
  if (token && !isTokenExpired(token)) {
    return <Navigate to="/home" replace />
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError("")
    setLoading(true)
    try {
      // 1) พยายามล็อกอินแบบ JSON ก่อน
      let resp
      try {
        resp = await loginViaJson(username, password)
      } catch (err) {
        // 2) ถ้าไม่สำเร็จ (เช่น API นี้ไม่มี) fallback ไปแบบ form
        resp = await loginViaForm(username, password)
      }

      const accessToken = resp?.access_token
      if (!accessToken) throw new Error("ไม่มี access_token ที่ได้จากเซิร์ฟเวอร์")

      // บันทึก token
      localStorage.setItem("token", accessToken)

      // ถอด payload เพื่อเก็บ user ลง localStorage ให้ส่วนอื่นใช้งาน (เช่น Sidebar)
      const p = decodeJwtPayload(accessToken) || {}
      const roleId = p?.role == null ? null : Number(p.role) // role ใน JWT เป็น string จากฝั่งแบ็กเอนด์
      const user = {
        id: p?.id ?? null,
        username: p?.sub ?? username,
        role_id: Number.isFinite(roleId) ? roleId : null,
      }
      localStorage.setItem("user", JSON.stringify(user))

      // ไปหน้าแรก
      navigate("/home", { replace: true, state: { user } })
    } catch (err) {
      setError(err?.message || "เข้าสู่ระบบไม่สำเร็จ")
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-100 dark:bg-gray-900 px-4">
      <div className="w-full max-w-md rounded-2xl bg-white p-8 shadow-md dark:bg-gray-800">
        <h2 className="mb-6 text-center text-2xl font-bold text-gray-800 dark:text-gray-100">
          เข้าสู่ระบบ
        </h2>

        {error ? (
          <div className="mb-4 rounded-lg bg-red-50 px-4 py-2 text-sm text-red-700 dark:bg-red-900/30 dark:text-red-200">
            {error}
          </div>
        ) : null}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
              ชื่อผู้ใช้
            </label>
            <input
              type="text"
              className="mt-1 w-full rounded-md border px-4 py-2 dark:border-gray-600 dark:bg-gray-700 dark:text-white"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              autoComplete="username"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
              รหัสผ่าน
            </label>
            <input
              type="password"
              className="mt-1 w-full rounded-md border px-4 py-2 dark:border-gray-600 dark:bg-gray-700 dark:text-white"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
              required
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-md bg-emerald-600 py-2 font-medium text-white transition hover:bg-emerald-700 disabled:opacity-60"
          >
            {loading ? "กำลังเข้าสู่ระบบ..." : "เข้าสู่ระบบ"}
          </button>
        </form>
      </div>
    </div>
  )
}

export default Login
