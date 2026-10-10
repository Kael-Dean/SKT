// src/lib/auth.js
import { ROLE } from './roles';

export function decodeJwt(token) {
  try {
    const [, payload] = token.split('.');
    const json = atob(payload.replace(/-/g, '+').replace(/_/g, '/'));
    return JSON.parse(json);
  } catch {
    return null;
  }
}

export function saveAuth(token) {
  const payload = decodeJwt(token) || {};
  // รองรับหลาย field name: role, role_id, roleId, position_id
  const rawRole = payload.role ?? payload.role_id ?? payload.roleId ?? payload.position_id ?? null;
  const roleId = rawRole == null ? null : Number(Array.isArray(rawRole) ? rawRole[0] : rawRole);
  // active branch (เปลี่ยนได้เมื่อ switch) + home branch (สาขาถาวร)
  const toBranch = (v) => (v == null ? null : Number(v));
  const user = {
    id: payload.id ?? payload.user_id ?? null,
    username: payload.sub || payload.username || '',
    role_id: Number.isFinite(roleId) ? roleId : null,
    branch: toBranch(payload.branch ?? payload.branch_location ?? null),
    home_branch: toBranch(payload.home_branch ?? null),
    exp: payload.exp || 0,
  };
  localStorage.setItem('token', token);
  localStorage.setItem('user', JSON.stringify(user));
  return user;
}

export function getToken() {
  return localStorage.getItem('token');
}

export function getUser() {
  const s = localStorage.getItem('user');
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

// ทุก localStorage key ที่อาจเก็บ auth state หรือ PII ของผู้ใช้ (รวม key รุ่นเก่า
// ที่เคยใช้). logout() ต้องล้างให้ครบทุกตัว เพื่อไม่ให้เหลือ token/ข้อมูลค้างไว้ให้
// XSS หรือเครื่องที่ใช้ร่วมกันเข้าถึงได้. ไม่ล้าง 'darkMode' (UI pref) และ
// 'session_expired' (flag ชั่วคราวที่หน้า Login อ่านเพื่อแจ้งเตือน).
const AUTH_STORAGE_KEYS = [
  'token', 'access_token', 'jwt', 'role',
  'user', 'userdata', 'profile', 'account', 'current_user',
];

export function logout() {
  for (const k of AUTH_STORAGE_KEYS) localStorage.removeItem(k);
}

// ─── Role reader (แหล่งเดียวของ role id ฝั่งหน้าเว็บ) ─────────────────────────
// ลำดับ: user.role_id (จาก saveAuth) → object ผู้ใช้รุ่นเก่าใน localStorage →
// claim ใน JWT → key "role" ลอย ๆ. รองรับค่าที่เป็นชื่อ role (legacy) ด้วย
// เลข role ดู src/lib/roles.js — การเช็คสิทธิ์ให้ใช้ can() จาก src/lib/permissions.js

// ชื่อ role แบบข้อความ (token/ข้อมูลรุ่นเก่า) → role id ของ backend
const ROLE_NAME_ALIASES = {
  ADMIN: ROLE.ADMIN, AD: ROLE.ADMIN, SUPERADMIN: ROLE.ADMIN,
  MNG: ROLE.MANAGER, MANAGER: ROLE.MANAGER,
  HR: ROLE.HR, HUMANRESOURCES: ROLE.HR, HUMAN_RESOURCES: ROLE.HR,
  HA: ROLE.HEAD_ACCOUNTANT, ACCOUNT: ROLE.HEAD_ACCOUNTANT, ACCOUNTING: ROLE.HEAD_ACCOUNTANT,
  "HEAD ACCOUNTING": ROLE.HEAD_ACCOUNTANT, "HEAD-ACCOUNTING": ROLE.HEAD_ACCOUNTANT, HEADACCOUNTING: ROLE.HEAD_ACCOUNTANT,
  STAFF: ROLE.STAFF, EMPLOYEE: ROLE.STAFF,
  // legacy: หน้าเว็บรุ่นเก่าเรียก role 5 ว่า MKT/Marketing
  MKT: ROLE.STAFF, MARKETING: ROLE.STAFF,
  BRANCH: ROLE.BRANCH_HEAD, BRANCH_HEAD: ROLE.BRANCH_HEAD, "BRANCH HEAD": ROLE.BRANCH_HEAD,
  ASST: ROLE.ASSISTANT_MANAGER, ASSISTANT_MANAGER: ROLE.ASSISTANT_MANAGER, "ASSISTANT MANAGER": ROLE.ASSISTANT_MANAGER,
}

/** แปลงค่า role (เลข / สตริงเลข / ชื่อ) → role id; ไม่รู้จัก → 0 */
export function normalizeRoleId(raw) {
  if (raw == null) return 0
  if (typeof raw === "number") return Number.isFinite(raw) && raw > 0 ? raw : 0
  const s = String(raw).trim()
  if (!s) return 0
  if (/^\d+$/.test(s)) return Number(s)
  const up = s.toUpperCase()
  if (ROLE_NAME_ALIASES[up]) return ROLE_NAME_ALIASES[up]
  if (up.includes("ASSIST")) return ROLE.ASSISTANT_MANAGER
  if (up.includes("ACCOUNT")) return ROLE.HEAD_ACCOUNTANT
  if (up.includes("MARKET")) return ROLE.STAFF
  if (up.includes("MANAG")) return ROLE.MANAGER
  if (up.includes("ADMIN")) return ROLE.ADMIN
  if (up.includes("HUMAN")) return ROLE.HR
  return 0
}

const LEGACY_USER_KEYS = ["user", "userdata", "profile", "account", "current_user"]
const USER_ROLE_FIELDS = [
  "role_id", "roleId", "role", "role_code", "roleCode", "role_name", "roleName",
  "position", "position_code", "positionCode",
]

function roleFromUserObjects() {
  for (const k of LEGACY_USER_KEYS) {
    let u = null
    try {
      const raw = localStorage.getItem(k)
      u = raw ? JSON.parse(raw) : null
    } catch {
      u = null
    }
    if (!u || typeof u !== "object") continue
    for (const f of USER_ROLE_FIELDS) {
      const id = normalizeRoleId(u[f])
      if (id) return id
    }
  }
  return 0
}

function roleFromJwt() {
  const t = getToken() || localStorage.getItem("access_token") || localStorage.getItem("jwt")
  const p = t ? decodeJwt(t) : null
  if (!p) return 0
  for (const c of [p.role, p.role_id, p.roleId, p.roles, p.authorities, p.scope, p.position_id]) {
    const id = normalizeRoleId(Array.isArray(c) ? c[0] : c)
    if (id) return id
  }
  return 0
}

/** role id ของผู้ใช้ที่ล็อกอินอยู่ (0 = ไม่รู้ / ยังไม่ล็อกอิน) */
export function getRoleId() {
  const u = getUser()
  const direct = normalizeRoleId(u?.role_id)
  if (direct) return direct
  return roleFromUserObjects() || roleFromJwt() || normalizeRoleId(localStorage.getItem("role"))
}

/** สาขาที่กำลังดูอยู่ (active branch) — เปลี่ยนได้หลัง switch-branch */
export function getActiveBranch() {
  const u = getUser();
  if (u?.branch != null) return Number(u.branch) || null;
  const t = getToken();
  const p = t ? decodeJwt(t) : null;
  const raw = p?.branch ?? p?.branch_location ?? null;
  return raw == null ? null : Number(raw) || null;
}

/** สาขาบ้าน (home branch) — สาขาถาวรของผู้ใช้ ไม่เปลี่ยน */
export function getHomeBranch() {
  const u = getUser();
  if (u?.home_branch != null) return Number(u.home_branch) || null;
  const t = getToken();
  const p = t ? decodeJwt(t) : null;
  const raw = p?.home_branch ?? null;
  return raw == null ? null : Number(raw) || null;
}
