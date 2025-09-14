// src/lib/auth.js
export function decodeJwt(token) {
  try {
    const [, payload] = token.split(".")
    const json = atob(payload.replace(/-/g, "+").replace(/_/g, "/"))
    return JSON.parse(json)
  } catch {
    return null
  }
}

export function saveAuth(token) {
  const payload = decodeJwt(token) || {}
  const user = {
    username: payload.sub || "",
    role: payload.role || "",   // แบ็กเอนด์ส่ง role เป็น str(user.role_id)
    exp: payload.exp || 0,      // epoch seconds
  }
  localStorage.setItem("token", token)
  localStorage.setItem("user", JSON.stringify(user))
  return user
}

export function getToken() {
  return localStorage.getItem("token")
}

export function getUser() {
  const s = localStorage.getItem("user")
  if (!s) return null
  try { return JSON.parse(s) } catch { return null }
}

export function isTokenExpired() {
  const u = getUser()
  if (!u?.exp) return true
  const now = Math.floor(Date.now() / 1000)
  return now >= u.exp
}

export function logout() {
  localStorage.removeItem("token")
  localStorage.removeItem("user")
}
