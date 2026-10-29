// src/lib/namePrefix.js
// คำนำหน้าชื่อ (ไทย) — ใช้กับช่องที่ backend เก็บ "คำนำหน้า+ชื่อ" เป็น string เดียว
// (เช่น th_first_name = "นายสมชาย", ชื่อครอบครัว/ผู้มีสิทธิ์ = "เด็กชายสมชาย").
// หน้าเว็บแยกเป็น dropdown คำนำหน้า + ช่องชื่อ แล้วต่อกลับก่อนส่ง (ไม่มีช่องว่าง ตามแบบบัตรประชาชน)

/** gender: ค่าที่ใช้ในช่อง "เพศ" ของ onboarding ("ชาย" / "หญิง") */
export const NAME_PREFIXES = [
  { value: "นาย", gender: "ชาย", adult: true },
  { value: "นาง", gender: "หญิง", adult: true },
  { value: "นางสาว", gender: "หญิง", adult: true },
  { value: "เด็กชาย", gender: "ชาย", adult: false },
  { value: "เด็กหญิง", gender: "หญิง", adult: false },
]

/** ตัวย่อที่เจอในข้อมูลเก่า → คำนำหน้าเต็ม */
const ALIASES = { "น.ส.": "นางสาว", "ด.ช.": "เด็กชาย", "ด.ญ.": "เด็กหญิง" }

// ยาวก่อน ("นางสาว" ต้องจับก่อน "นาง")
const MATCHERS = [...NAME_PREFIXES.map((p) => [p.value, p.value]), ...Object.entries(ALIASES)].sort(
  (a, b) => b[0].length - a[0].length,
)

export const ADULT_PREFIX_OPTIONS = NAME_PREFIXES.filter((p) => p.adult).map((p) => ({ value: p.value, label: p.value }))
export const ALL_PREFIX_OPTIONS = NAME_PREFIXES.map((p) => ({ value: p.value, label: p.value }))

/** "นายสมชาย" → { prefix: "นาย", name: "สมชาย" } · ไม่มีคำนำหน้า → { prefix: "", name } */
export function splitPrefixedName(full) {
  const s = String(full ?? "").trim()
  for (const [token, prefix] of MATCHERS) {
    if (s.startsWith(token) && s.length > token.length) return { prefix, name: s.slice(token.length).trim() }
  }
  return { prefix: "", name: s }
}

/** ต่อคำนำหน้า + ชื่อ (ไม่มีชื่อ → ""; ไม่มีคำนำหน้า → ชื่ออย่างเดียว) */
export function joinPrefixedName(prefix, name) {
  const n = String(name ?? "").trim()
  if (!n) return ""
  return `${prefix ?? ""}${n}`
}

export const prefixOf = (full) => splitPrefixedName(full).prefix
export const genderOfPrefix = (prefix) => NAME_PREFIXES.find((p) => p.value === prefix)?.gender ?? ""
