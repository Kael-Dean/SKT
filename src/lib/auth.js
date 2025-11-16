// src/lib/auth.js

// role constants ให้ใช้ร่วมกันทั้งแอป
export const ROLE = { ADMIN: 1, MNG: 2, HR: 3, HA: 4, MKT: 5 };

// ปลอดภัยกับ Base64URL
export function decodeJwt(token) {
  try {
    const [, payload] = String(token || "").split(".");
    if (!payload) return null;
    const base64 = payload.replace(/-/g, "+").replace(/_/g, "/");
    const json = decodeURIComponent(
      atob(base64)
        .split("")
        .map((c) => "%" + ("00" + c.charCodeAt(0).toString(16)).slice(-2))
        .join("")
    );
    return JSON.parse(json);
  } catch {
    return null;
  }
}

// กฎ alias: username รูปแบบ admin-xxx-0x = การตลาด (MKT)
function isMarketingAliasUsername(username) {
  if (!username) return false;
  return /^admin-[a-z0-9-]+-0\d$/i.test(String(username).trim());
}

export function saveAuth(token) {
  const payload = decodeJwt(token) || {};
  // รองรับทั้ง claim 'role_id' และ 'role'
  let roleId = payload.role_id ?? payload.role ?? null;
  roleId = Number(roleId);
  const user = {
    id: payload.id ?? null,
    username: payload.sub || "",
    role_id: Number.isFinite(roleId) ? roleId : null,
    exp: payload.exp || 0, // epoch seconds
  };
  localStorage.setItem("token", token);
  localStorage.setItem("user", JSON.stringify(user));
  return user;
}

export function getToken() {
  return localStorage.getItem("token");
}

export function getUser() {
  const s = localStorage.getItem("user");
  if (!s) return null;
  try {
    return JSON.parse(s);
  } catch {
    return null;
  }
}

// แหล่งความจริงเดียวของ role id (มี alias rule)
export function getRoleId() {
  const u = getUser();
  let id = Number(u?.role_id ?? 0);

  // fallback มาดูที่ token ถ้า user ไม่มี
  if (!id) {
    const p = decodeJwt(getToken() || "") || {};
    id = Number(p.role_id ?? p.role ?? 0);
  }

  // alias เป็น Marketing ได้จาก username
  const username = (u?.username ||
    (decodeJwt(getToken() || "")?.sub) ||
    "").toLowerCase();
  if (isMarketingAliasUsername(username)) return ROLE.MKT;

  return Number.isFinite(id) ? id : 0;
}

export function hasAnyRole(...ids) {
  const current = getRoleId();
  return ids.some((r) => r === current);
}

export function isTokenExpired() {
  const u = getUser();
  if (!u?.exp) return true;
  const now = Math.floor(Date.now() / 1000);
  return now >= u.exp;
}

export function logout() {
  localStorage.removeItem("token");
  localStorage.removeItem("user");
}
