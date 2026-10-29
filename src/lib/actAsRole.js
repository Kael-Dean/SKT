// src/lib/actAsRole.js
// ─────────────────────────────────────────────────────────────────────────────
// Super Admin "act as role" (um_backend feat/admin-act-as-role) — ทดสอบเมนู/สิทธิ์ของแต่ละ role
// โดยไม่ต้องมีบัญชีแยก. บัญชีใน DB ไม่เปลี่ยน — role ที่สวมอยู่อยู่ใน JWT เท่านั้น
//
//   GET  /auth/act-as-role/roles  → [{ role_id, role_name, scope, current }]
//   POST /auth/act-as-role { role_id }  (null / 1 = กลับเป็น Super Admin) → { access_token, acting, … }
//   GET  /auth/me/permissions     → + { acting, real_role_id }
//
// - ปุ่มสลับแสดงเฉพาะ real_role_id === 1 (บัญชีจริงเป็น Super Admin) — สวม role อยู่ก็ยังสลับต่อได้
// - สลับแล้ว: เก็บ token ใหม่ → โหลดหน้าใหม่ที่ /home (หน้าเดิมอาจไม่มีสิทธิ์แล้ว + ล้างแคชรายการที่ผูกกับ role)
// - สาขาที่ใช้งานอยู่คงเดิม (backend จัดการ)
// ─────────────────────────────────────────────────────────────────────────────
import { apiAuth } from "./api"
import { decodeJwt, getToken, saveAuth } from "./auth"
import { getMyPermissions } from "./myPermissions"
import { SUPER_ADMIN } from "./roles"

function claims() {
  const token = getToken()
  return token ? decodeJwt(token) || {} : {}
}

/** บัญชีจริง (DB) เป็น Super Admin ไหม — จาก /auth/me/permissions, ระหว่างโหลดใช้ claim real_role ของ token ที่สวม role อยู่ */
export function isRealSuperAdmin() {
  const mine = getMyPermissions()
  if (mine?.real_role_id != null) return mine.real_role_id === SUPER_ADMIN
  return Number(claims().real_role) === SUPER_ADMIN
}

/** กำลังสวม role อื่นอยู่ไหม */
export function isActingAsRole() {
  const mine = getMyPermissions()
  if (mine) return mine.acting
  return claims().act_role != null
}

/** รายการ role ที่สลับได้ (Super Admin ก่อน ตามด้วย role ใน matrix เรียงตาม id) */
export async function listActAsRoles() {
  const data = await apiAuth("/auth/act-as-role/roles")
  return Array.isArray(data) ? data : []
}

/**
 * สวม role (null = กลับเป็น Super Admin) — สำเร็จแล้วเก็บ token ใหม่และโหลดแอปใหม่ที่หน้าหลัก
 * ไม่ทำ optimistic: เมนูเปลี่ยนหลังได้ token ใหม่เท่านั้น
 */
export async function actAsRole(roleId) {
  const resp = await apiAuth("/auth/act-as-role", {
    method: "POST",
    body: { role_id: roleId == null || Number(roleId) === SUPER_ADMIN ? null : Number(roleId) },
  })
  saveAuth(resp.access_token) // token เปลี่ยน = สิทธิ์ที่แคชไว้ (myPermissions) ใช้ไม่ได้ทันที
  window.location.assign("/home")
  return resp
}

/** ข้อความ error จาก backend (403/422 detail เป็นภาษาไทย) */
export function actAsRoleErrorMessage(err, fallback) {
  const detail = err?.data?.detail
  if (typeof detail === "string" && detail.trim()) return detail.trim()
  if (Array.isArray(detail) && detail[0]?.msg) return String(detail[0].msg)
  if (err?.status === 403) return "บัญชีนี้ไม่มีสิทธิ์สลับบทบาท"
  return err?.message || fallback
}
