// src/dev/onboardingMock.js — DEV ONLY (imported from main.jsx behind import.meta.env.DEV)
// ─────────────────────────────────────────────────────────────────────────────
// In-memory fake backend for the onboarding flow (PR 59) so the screens can be walked
// end-to-end without the real API. Turn on with  http://localhost:5173/?mockOnboarding=1
// (role via &mockRole=5 staff | 3 HR; default 5), off with ?mockOnboarding=0.
// Login with any username/password. Unmatched requests answer 200 [] so pages render.
// State resets on reload unless ?mockKeep=1 (kept in sessionStorage).
// ─────────────────────────────────────────────────────────────────────────────
const FLAG = "mock_onboarding"
const ROLE_FLAG = "mock_onboarding_role"
const STORE = "mock_onboarding_state"

const SECTION_KEYS = ["account", "personal", "address", "family", "education", "work", "criminal"]
const M_STATUS = ["โสด", "สมรส", "หย่า", "หม้าย", "แยกกันอยู่"]
const NEW_ROW_KEY = { education: ["ed_level", "inst_name"], work: ["company_name"], criminal: ["charge"], family: ["first_name", "relationship"] }
const ROW_COLS = {
  education: ["ed_level", "inst_name", "from_date", "to_date"],
  work: ["company_name", "position", "from_date", "to_date"],
  criminal: ["charge", "court", "case_date", "outcome"],
  family: ["first_name", "last_name", "relationship", "birthday", "is_twin"],
}
const SCALAR_COLS = {
  account: ["first_name", "last_name", "email", "th_first_name", "th_last_name"],
  personal: ["birthday", "gender", "m_status", "p_number", "line_id", "e_contact", "children_number", "bank_no", "underlying_disease"],
  address: ["h_address", "mhoo", "soi", "road", "district", "sub_district", "province", "postal_code"],
}

function seed() {
  return {
    completed_at: null,
    tour_completed_at: null,
    exempt: false,
    confirmed: { account: "2026-10-23T03:11:20+00:00" },
    none: { work: false, criminal: false },
    nextId: 100,
    values: {
      account: { first_name: "Somchai", last_name: "Jaidee", email: null, th_first_name: "นายสมชาย", th_last_name: "ใจดี" },
      personal: { birthday: "1990-05-01", gender: "ชาย", m_status: null, p_number: "0812345678", line_id: null, e_contact: "0899999999",
        children_number: 1, bank_no: "1234567890", underlying_disease: null, cid: "1234567890123", hired: "2020-04-01" },
      address: { h_address: null, mhoo: null, soi: null, road: null, district: null, sub_district: null, province: null, postal_code: null },
      family: [
        { id: 11, first_name: "สมหญิง", last_name: "ใจดี", relationship: "คู่สมรส", birthday: "1992-01-01", is_twin: false, hr_verified: true, can_delete: false },
        { id: 12, first_name: "สมศรี", last_name: "ใจดี", relationship: "มารดา (เลี้ยง)", birthday: "1960-03-02", is_twin: false, hr_verified: true, can_delete: false },
      ],
      education: [{ id: 5, ed_level: "ปริญญาตรี", inst_name: "มหาวิทยาลัยราชภัฏสุรินทร์", from_date: "2008-06-01", to_date: "2012-03-31" }],
      work: [],
      criminal: [],
    },
  }
}

let db = null
function load() {
  if (db) return db
  try {
    const raw = sessionStorage.getItem(STORE)
    if (raw && new URLSearchParams(location.search).get("mockKeep") === "1") db = JSON.parse(raw)
  } catch { /* ignore */ }
  db = db ?? seed()
  return db
}
function persist() {
  try { sessionStorage.setItem(STORE, JSON.stringify(db)) } catch { /* ignore */ }
}

const blank = (v) => v == null || (typeof v === "string" && !v.trim())

function missingOf(key) {
  const v = db.values
  switch (key) {
    case "account": return ["first_name", "last_name", "th_first_name", "th_last_name"].filter((k) => blank(v.account[k]))
    case "personal": {
      const m = ["birthday", "gender", "m_status", "p_number", "e_contact", "bank_no", "underlying_disease"].filter((k) => blank(v.personal[k]))
      if (v.personal.children_number == null || v.personal.children_number < 0) m.push("children_number")
      return m
    }
    case "address": {
      const m = ["h_address", "sub_district", "district", "province", "postal_code"].filter((k) => blank(v.address[k]))
      if (!m.includes("postal_code") && !/^\d{5}$/.test(v.address.postal_code)) m.push("postal_code")
      return m
    }
    case "family": {
      const m = []
      if (v.personal.m_status === "สมรส" && !v.family.some((r) => r.relationship === "คู่สมรส")) m.push("spouse_row")
      if ((v.personal.children_number ?? 0) !== v.family.filter((r) => r.relationship === "บุตร").length) m.push("children_count")
      return m
    }
    case "education": return v.education.length ? [] : ["rows"]
    case "work":
    case "criminal": return v[key].length || db.none[key] ? [] : ["rows"]
    default: return []
  }
}

function payload() {
  const sections = {}
  for (const k of SECTION_KEYS) {
    const missing = missingOf(k)
    if (missing.length && db.confirmed[k]) delete db.confirmed[k] // data changed under a confirmed section
    sections[k] = { confirmed_at: db.confirmed[k] ?? null, missing }
  }
  const allConfirmed = SECTION_KEYS.every((k) => sections[k].confirmed_at)
  persist()
  return {
    onboarded: Boolean(db.completed_at || db.exempt),
    unlocked: Boolean(db.completed_at || db.exempt || allConfirmed),
    exempt: db.exempt,
    completed_at: db.completed_at,
    tour_completed_at: db.tour_completed_at,
    sections,
    values: JSON.parse(JSON.stringify(db.values)),
    none_flags: { ...db.none },
    m_status_choices: M_STATUS,
  }
}

const json = (status, body) => new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } })
const err422 = (msg, field) => json(422, { detail: [{ loc: ["body", field ?? "x"], msg, type: "value_error" }] })

function fakeJwt(role) {
  const b64 = (o) => btoa(JSON.stringify(o)).replace(/=+$/, "")
  return `${b64({ alg: "none" })}.${b64({ sub: "mock", user_id: 42, username: "mock", role_id: role, branch: 3, exp: 4102444800 })}.x`
}

function putSection(key, body) {
  if (db.completed_at) return json(409, { detail: "ใช้เมนูแจ้งแก้ไขข้อมูล" })
  if (SCALAR_COLS[key]) {
    for (const k of Object.keys(body)) if (!SCALAR_COLS[key].includes(k)) return err422(`extra field not permitted`, k)
    if (key === "personal" && body.m_status != null && !M_STATUS.includes(body.m_status)) return err422("m_status ไม่ถูกต้อง", "m_status")
    if (key === "address" && body.postal_code != null && !/^\d{5}$/.test(body.postal_code)) return err422("รหัสไปรษณีย์ต้องเป็นตัวเลข 5 หลัก", "postal_code")
    Object.assign(db.values[key], body)
    return json(200, payload())
  }
  const rows = db.values[key]
  if (!rows) return json(404, { detail: "ไม่พบหัวข้อ" })
  if ("none" in body && !["work", "criminal"].includes(key)) return json(422, { detail: "none ใช้ได้เฉพาะ work และ criminal" })
  for (const id of body.delete_ids ?? []) {
    const row = rows.find((r) => r.id === id)
    if (!row) return json(404, { detail: "ไม่พบข้อมูล" })
    if (key === "family" && !row.can_delete) return json(403, { detail: "ลบได้เฉพาะข้อมูลที่ท่านเพิ่มเองและยังไม่ได้ตรวจสอบ — แจ้ง HR" })
  }
  for (const r of body.rows ?? []) {
    for (const k of Object.keys(r)) if (k !== "id" && !ROW_COLS[key].includes(k)) return err422("extra field not permitted", k)
    if (key === "family" && r.relationship != null && !["บิดา", "มารดา", "คู่สมรส", "บุตร"].includes(r.relationship)) return err422("relationship ไม่ถูกต้อง", "relationship")
    if (r.id == null) {
      for (const k of NEW_ROW_KEY[key]) if (blank(r[k])) return json(422, { detail: `${k} จำเป็นสำหรับรายการใหม่ (${key})` })
    }
  }
  db.values[key] = rows.filter((r) => !(body.delete_ids ?? []).includes(r.id))
  for (const r of body.rows ?? []) {
    if (r.id == null) {
      const row = { id: db.nextId++, ...Object.fromEntries(ROW_COLS[key].map((c) => [c, r[c] ?? null])) }
      if (key === "family") Object.assign(row, { is_twin: Boolean(r.is_twin), hr_verified: false, can_delete: true })
      db.values[key].push(row)
    } else {
      const row = db.values[key].find((x) => x.id === r.id)
      if (!row) return json(404, { detail: "ไม่พบข้อมูล" })
      Object.assign(row, r)
      if (key === "family") row.hr_verified = false
    }
  }
  if ("none" in body) db.none[key] = Boolean(body.none)
  return json(200, payload())
}

// ─── HR fixtures ─────────────────────────────────────────────────────────────
const HR_ROWS = [
  { user_id: 42, name: "สมชาย ใจดี", branch_id: 3, branch_name: "สาขาเมือง", status: "in_progress", sections_confirmed: 4, tour_done: false, completed_at: null, exempt_reason: null },
  { user_id: 43, name: "วิภา แสงทอง", branch_id: 3, branch_name: "สาขาเมือง", status: "done", sections_confirmed: 7, tour_done: true, completed_at: "2026-10-24T08:00:00+00:00", exempt_reason: null },
  { user_id: 44, name: "ประเสริฐ ดีงาม", branch_id: 5, branch_name: "สาขาปราสาท", status: "not_started", sections_confirmed: 0, tour_done: false, completed_at: null, exempt_reason: null },
  { user_id: 45, name: "อำไพ ศรีสุข", branch_id: 5, branch_name: "สาขาปราสาท", status: "exempt", sections_confirmed: 2, tour_done: false, completed_at: null, exempt_reason: "ลาป่วยระยะยาว" },
  { user_id: 46, name: "ธนา มั่นคง", branch_id: 7, branch_name: "สาขาศีขรภูมิ", status: "done", sections_confirmed: 7, tour_done: true, completed_at: "2026-10-25T02:30:00+00:00", exempt_reason: null },
]
let UNVERIFIED = [
  { id: 101, user_id: 42, employee_name: "สมชาย ใจดี", branch_id: 3, branch_name: "สาขาเมือง", first_name: "ด.ช.ภูมิ", last_name: "ใจดี", relationship: "บุตร", birthday: "2018-02-10", is_twin: false, added_by: 42, created_at: "2026-10-23T03:11:20+00:00" },
  { id: 102, user_id: 44, employee_name: "ประเสริฐ ดีงาม", branch_id: 5, branch_name: "สาขาปราสาท", first_name: "มาลี", last_name: "ดีงาม", relationship: "คู่สมรส", birthday: "1991-07-07", is_twin: false, added_by: 44, created_at: "2026-10-24T05:00:00+00:00" },
]

async function handle(url, init) {
  const u = new URL(url, location.origin)
  // strip the dev base (/api, /api-proxy from .env.development.local)
  const path = u.pathname.replace(/^\/api(-proxy)?(?=\/)/, "")
  const method = (init?.method || "GET").toUpperCase()
  const body = init?.body && typeof init.body === "string" ? JSON.parse(init.body) : {}
  const role = Number(localStorage.getItem(ROLE_FLAG) || 5)
  load()
  await new Promise((r) => setTimeout(r, 250)) // feel real latency

  if (path === "/auth/login_json") return json(200, { access_token: fakeJwt(role), token_type: "bearer", account_status: "register" })
  if (path === "/auth/me/permissions") return json(404, { detail: "Not Found" }) // → role-table fallback
  if (path === "/personnel/me") return json(200, { first_name: "สมชาย", last_name: "ใจดี", username: "mock", role_id: role, personnel_info: db.values.personal })
  if (path === "/personnel/me/report-issue/fields") return json(200, [
    { category: "personal_info", category_label: "ข้อมูลส่วนตัว", fields: [
      { field: "cid", label: "เลขบัตรประชาชน", input_type: "text" }, { field: "hired", label: "วันเริ่มงาน", input_type: "date" },
      { field: "th_first_name", label: "ชื่อ (ภาษาไทย)", input_type: "text" }, { field: "underlying_disease", label: "โรคประจำตัว", input_type: "text" }] },
    { category: "family", category_label: "ครอบครัว", fields: [{ field: "family_other", label: "ข้อมูลครอบครัวไม่ถูกต้อง (ระบุในรายละเอียด)", input_type: "textarea" }] },
  ])
  if (path === "/personnel/me/report-issue") return json(200, { status: "created", id: 1 })
  if (path === "/personnel/me/leave-balance") return json(200, [
    { leave_type: "ลาป่วย", quota: "30", used: "2", remaining: "28" },
    { leave_type: "ลากิจส่วนตัว", quota: "6", used: "1", remaining: "5" },
    { leave_type: "ลาพักผ่อน", quota: "10", used: "0", remaining: "10" },
  ])

  // employee onboarding
  if (path === "/personnel/me/onboarding" && method === "GET") return json(200, payload())
  const m = path.match(/^\/personnel\/me\/onboarding\/([a-z-]+)(\/confirm)?$/)
  if (m) {
    const [, key, confirm] = m
    if (key === "tour-complete") { db.tour_completed_at ??= new Date().toISOString(); return json(200, payload()) }
    if (key === "complete") {
      const p = payload()
      const sections = SECTION_KEYS.filter((k) => !p.sections[k].confirmed_at)
      if (sections.length || !db.tour_completed_at) return json(422, { detail: { sections, tour: !db.tour_completed_at } })
      db.completed_at ??= new Date().toISOString()
      return json(200, payload())
    }
    if (!SECTION_KEYS.includes(key)) return json(404, { detail: "ไม่พบหัวข้อ" })
    if (confirm) {
      if (db.completed_at) return json(409, { detail: "ใช้เมนูแจ้งแก้ไขข้อมูล" })
      const missing = missingOf(key)
      if (missing.length) return json(422, { detail: { section: key, missing } })
      db.confirmed[key] = new Date().toISOString()
      return json(200, payload())
    }
    if (method === "PUT") return putSection(key, body)
  }

  // gate: self-service before unlock
  const gated = /^\/(personnel\/)?me\/(leaves|leave-balance|leave-defaults|out-of-office|payroll|salary-cert|loans|welfare|relocation|kpi|discipline|activities|financial|issues)/
  if (gated.test(path.replace(/^\/personnel/, "/personnel")) && !payload().unlocked) {
    return json(403, { detail: { code: "ONBOARDING_REQUIRED", message: "กรุณากรอกข้อมูลให้ครบก่อนใช้งาน" } })
  }

  // HR
  if (path === "/hr/onboarding") {
    const st = u.searchParams.get("status")
    const b = u.searchParams.get("branch_id")
    return json(200, HR_ROWS.filter((r) => (!st || r.status === st) && (!b || String(r.branch_id) === b)))
  }
  const hr = path.match(/^\/hr\/employees\/(\d+)\/onboarding\/(reopen|exempt)$/)
  if (hr) {
    const row = HR_ROWS.find((r) => r.user_id === Number(hr[1]))
    if (!row) return json(404, { detail: "ไม่พบพนักงาน" })
    if (hr[2] === "reopen") { if (row.status !== "exempt") Object.assign(row, { status: "not_started", sections_confirmed: 0, tour_done: false, completed_at: null }); return json(200, { user_id: row.user_id, status: row.status }) }
    if (method === "DELETE") { if (row.status !== "exempt") return json(409, { detail: "ยังไม่ได้รับการยกเว้น" }); Object.assign(row, { status: "in_progress", exempt_reason: null }); return json(200, { user_id: row.user_id, status: row.status }) }
    if (blank(body.reason)) return err422("reason ห้ามเว้นว่าง", "reason")
    Object.assign(row, { status: "exempt", exempt_reason: body.reason })
    return json(200, { user_id: row.user_id, status: "exempt", exempt_reason: body.reason })
  }
  if (path === "/hr/dependants/unverified") return json(200, UNVERIFIED)
  const ver = path.match(/^\/hr\/dependants\/(\d+)\/verify$/)
  if (ver) {
    const row = UNVERIFIED.find((r) => r.id === Number(ver[1]))
    UNVERIFIED = UNVERIFIED.filter((r) => r.id !== Number(ver[1]))
    return row ? json(200, { ...row, hr_verified: true }) : json(404, { detail: "ไม่พบข้อมูล" })
  }
  const deps = path.match(/^\/hr\/employees\/(\d+)\/dependants$/)
  if (deps) return json(200, UNVERIFIED.filter((r) => r.user_id === Number(deps[1])).map((r) => ({ ...r, hr_verified: false })))
  if (path === "/hr/dashboard") return json(200, { total_employees: 178, status_breakdown: { onboarding: { done: 120, in_progress: 30, not_started: 25, exempt: 3 } } })

  return json(200, method === "GET" ? [] : {})
}

export function installOnboardingMock() {
  const qs = new URLSearchParams(location.search)
  if (qs.has("mockOnboarding")) {
    if (qs.get("mockOnboarding") === "1") localStorage.setItem(FLAG, "1")
    else localStorage.removeItem(FLAG)
  }
  if (qs.has("mockRole")) localStorage.setItem(ROLE_FLAG, qs.get("mockRole"))
  if (localStorage.getItem(FLAG) !== "1") return
  const real = window.fetch.bind(window)
  window.fetch = (input, init) => {
    const url = typeof input === "string" ? input : input.url
    // same-origin static files (thai address json, vite assets) go to the real server
    if (url.startsWith(location.origin) || url.startsWith("/data/") || url.startsWith("/src/") || url.startsWith("/@")) return real(input, init)
    return handle(url, init)
  }
  console.info("[mock] onboarding backend mock ON — ?mockOnboarding=0 to turn off")
}
