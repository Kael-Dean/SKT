// src/lib/auth.js
export function decodeJwt(token) {
  try {
    const [, payload] = token.split(".");
    const json = atob(payload.replace(/-/g, "+").replace(/_/g, "/"));
    return JSON.parse(json);
  } catch {
    return null;
  }
}

export function saveAuth(token) {
  const payload = decodeJwt(token) || {};
  const roleId = payload.role == null ? null : Number(payload.role);
  const user = {
    id: payload.id ?? null,
    username: payload.sub || "",
    role_id: Number.isFinite(roleId) ? roleId : null,
    exp: payload.exp || 0,
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

/** ✅ ดึง role_id แบบทนทาน: ใช้ user.role_id ก่อน ถ้าไม่มีค่อยสกัดจาก JWT */
export function getRoleId() {
  const u = getUser();
  if (u?.role_id != null) return Number(u.role_id) || 0;
  const t = getToken();
  const p = t ? decodeJwt(t) : null;
  const raw = p?.role ?? p?.role_id ?? p?.roleId ?? null;
  return raw == null ? 0 : Number(raw) || 0;
}

/**
 * ใช้เช็คสิทธิ์แสดงเมนู "เพิ่มบริษัท"
 * - ALLOW_ROLES = role ปกติที่ควรเห็นเมนู
 * - เพิ่มเคสพิเศษ: user ที่ username = "HA" และ role = 4 ให้เห็นเมนูได้ด้วย
 */
export function canSeeAddCompany() {
  const user = getUser();
  const roleId = getRoleId();

  // 👉 แก้รายการ role ให้ตรงกับระบบจริงของโปรเจกต์
  // เช่น ตอนนี้ถ้า role 1,2 เห็นเมนูอยู่ ก็ใช้ [1, 2]
  const ALLOW_ROLES = [1, 2];

  if (ALLOW_ROLES.includes(roleId)) return true;

  // เคสพิเศษ: user HA ที่มี role 4
  if (user?.username === "HA" && roleId === 4) return true;

  return false;
}
