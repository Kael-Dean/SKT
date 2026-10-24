// src/lib/leaveCalendar.js
// ปฏิทินการลาแยกตามสาขา (3H) — โหลด + แปลงข้อมูลให้เป็นรูปเดียวกันไม่ว่าจะมาจาก endpoint ไหน
//
// 1) GET /hr/leave-calendar/days?from_date&to_date[&branch_id]  (backend PR 42 — ยังไม่ merge)
//    ได้ grid รายวันพร้อม headcount ต่อสาขา + วันหยุด (3N) มาเลย
// 2) ถ้า /days ตอบ 404/405 (staging ยังไม่มี PR 42) → fallback
//    GET /hr/leave-calendar?from_date&to_date (รายการลาที่อนุมัติแล้ว จัดกลุ่มตามสาขา)
//    + GET /hr/holidays?fiscal_year=… แล้วกระจายใบลาเป็นรายวันฝั่งหน้าเว็บ
//    (ไม่มี headcount → แสดงจำนวนคนลาอย่างเดียว)
//
// ขอบเขตสาขา: backend จำกัดเองตามตำแหน่ง (หัวหน้าสาขาเห็นเฉพาะสาขาบ้าน + สาขาที่ได้รับมอบหมาย,
// ขอ branch_id อื่น = 403). หน้าเว็บจึงโหลดแบบไม่ส่ง branch_id แล้วกรองสาขาฝั่ง client —
// ไม่มีทางขอเกินขอบเขต และสลับสาขาได้ทันทีไม่ต้องโหลดใหม่

import { apiAuth } from "./api"
import { currentFiscalYearBE, parseDays } from "./leaveDays"

/* ───────────────────────── dates (local, no TZ drift) ───────────────────────── */

const pad = (n) => String(n).padStart(2, "0")

/** Date → "YYYY-MM-DD" (local) */
export function toISO(d) {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

/** "YYYY-MM-DD" → Date (local midnight) | null */
export function parseISO(iso) {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(iso || ""))
  if (!m) return null
  return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]))
}

export function todayISO() {
  return toISO(new Date())
}

/** { from, to } ของเดือน (month0 = 0–11) */
export function monthRange(year, month0) {
  return { from: toISO(new Date(year, month0, 1)), to: toISO(new Date(year, month0 + 1, 0)) }
}

/** 0 = จันทร์ … 6 = อาทิตย์ (ตรงกับ `weekday` ของ backend) */
export function weekdayMon0(d) {
  return (d.getDay() + 6) % 7
}

export const WEEKDAY_SHORT = ["จ.", "อ.", "พ.", "พฤ.", "ศ.", "ส.", "อา."]
export const WEEKDAY_LONG = ["จันทร์", "อังคาร", "พุธ", "พฤหัสบดี", "ศุกร์", "เสาร์", "อาทิตย์"]

export function fmtMonthTH(year, month0) {
  return new Date(year, month0, 1).toLocaleDateString("th-TH", { month: "long", year: "numeric" })
}

/** "วันจันทร์ที่ 2 พฤศจิกายน 2569" */
export function fmtDayLongTH(iso) {
  const d = parseISO(iso)
  if (!d) return iso || "—"
  const rest = d.toLocaleDateString("th-TH", { day: "numeric", month: "long", year: "numeric" })
  return `วัน${WEEKDAY_LONG[weekdayMon0(d)]}ที่ ${rest}`
}

/** "2 พ.ย." */
export function fmtDayShortTH(iso) {
  const d = parseISO(iso)
  if (!d) return iso || "—"
  return d.toLocaleDateString("th-TH", { day: "numeric", month: "short" })
}

/** "08:30:00" → "08:30" */
export function fmtTime(t) {
  return t ? String(t).slice(0, 5) : ""
}

/** Every ISO date from..to inclusive */
function eachDay(fromISO, toISO_) {
  const out = []
  const d = parseISO(fromISO)
  const end = parseISO(toISO_)
  if (!d || !end) return out
  while (d <= end) {
    out.push(toISO(d))
    d.setDate(d.getDate() + 1)
  }
  return out
}

/* ───────────────────────── leave-type colours ───────────────────────── */

// สีประจำประเภทการลา — ใช้เป็นจุดสี/แถบเล็กเท่านั้น (ตัวหนังสือยังเป็นสีเทาเข้มเสมอ เพื่อ contrast)
// ประเภทที่รู้จักผูกสีตายตัว; ประเภทอื่นเลือกจาก hash ของชื่อ จึงไม่เปลี่ยนสีข้ามเดือน
const KNOWN_TYPE_TONE = [
  [/ป่วย/, "sky"],
  [/กิจ/, "amber"],
  [/พักผ่อน/, "emerald"],
  [/คลอด/, "pink"],
  [/บวช|อุปสมบท|ฮัจญ์/, "orange"],
  [/ทหาร|ตรวจเลือก/, "slate"],
  [/ศึกษา|อบรม|ดูงาน/, "violet"],
]
const FALLBACK_TONES = ["teal", "indigo", "rose", "lime", "cyan", "fuchsia"]

// class strings ต้องเขียนเต็ม (Tailwind สแกนแบบ static)
const TONE_DOT = {
  sky: "bg-sky-500 dark:bg-sky-400",
  amber: "bg-amber-500 dark:bg-amber-400",
  emerald: "bg-emerald-500 dark:bg-emerald-400",
  pink: "bg-pink-500 dark:bg-pink-400",
  orange: "bg-orange-500 dark:bg-orange-400",
  slate: "bg-slate-500 dark:bg-slate-400",
  violet: "bg-violet-500 dark:bg-violet-400",
  teal: "bg-teal-500 dark:bg-teal-400",
  indigo: "bg-indigo-500 dark:bg-indigo-400",
  rose: "bg-rose-500 dark:bg-rose-400",
  lime: "bg-lime-600 dark:bg-lime-400",
  cyan: "bg-cyan-500 dark:bg-cyan-400",
  fuchsia: "bg-fuchsia-500 dark:bg-fuchsia-400",
}
const TONE_RING = {
  sky: "ring-sky-500 dark:ring-sky-400",
  amber: "ring-amber-500 dark:ring-amber-400",
  emerald: "ring-emerald-500 dark:ring-emerald-400",
  pink: "ring-pink-500 dark:ring-pink-400",
  orange: "ring-orange-500 dark:ring-orange-400",
  slate: "ring-slate-500 dark:ring-slate-400",
  violet: "ring-violet-500 dark:ring-violet-400",
  teal: "ring-teal-500 dark:ring-teal-400",
  indigo: "ring-indigo-500 dark:ring-indigo-400",
  rose: "ring-rose-500 dark:ring-rose-400",
  lime: "ring-lime-600 dark:ring-lime-400",
  cyan: "ring-cyan-500 dark:ring-cyan-400",
  fuchsia: "ring-fuchsia-500 dark:ring-fuchsia-400",
}

function toneOf(type) {
  const s = String(type || "")
  for (const [re, tone] of KNOWN_TYPE_TONE) if (re.test(s)) return tone
  let h = 5381
  for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) | 0
  return FALLBACK_TONES[Math.abs(h) % FALLBACK_TONES.length]
}

/** class ของจุดสีประเภทการลา — ครึ่งวัน = วงแหวน (ไม่เติมสี) */
export function leaveTypeDotCls(type, halfDay = false) {
  const tone = toneOf(type)
  return halfDay ? `ring-2 ring-inset ${TONE_RING[tone]} bg-transparent` : TONE_DOT[tone]
}

/* ───────────────────────── normalisation ───────────────────────── */

const num = (v) => (v == null || v === "" ? null : Number.isFinite(Number(v)) ? Number(v) : null)

function personName(p) {
  return (
    p.employee_name ||
    p.user_display_name ||
    p.full_name ||
    p.display_name ||
    p.name ||
    [p.first_name, p.last_name].filter(Boolean).join(" ") ||
    (p.employee_id ?? p.user_id ? `รหัส ${p.employee_id ?? p.user_id}` : "ไม่ระบุชื่อ")
  )
}

function normPerson(p, i) {
  const totalDays = parseDays(p.total_days ?? p.days)
  const halfDay = Boolean(p.half_day ?? p.is_half_day ?? (totalDays === 0.5))
  return {
    key: `${p.leave_id ?? p.id ?? "x"}-${p.employee_id ?? p.user_id ?? i}`,
    leaveId: p.leave_id ?? p.id ?? null,
    employeeId: p.employee_id ?? p.user_id ?? null,
    name: personName(p),
    leaveType: p.leave_type || p.leave_type_name || p.type_name || "ไม่ระบุประเภท",
    halfDay,
    fromTime: p.from_time || null,
    toTime: p.to_time || null,
    fromDate: p.from_date || p.start_date || null,
    toDate: p.to_date || p.end_date || null,
  }
}

function normHoliday(h) {
  if (!h) return null
  if (typeof h === "string") return { name: h, type: null }
  return { name: h.name || h.holiday_name || "วันหยุด", type: h.type || h.holiday_type || null }
}

/** Response ของ /hr/leave-calendar/days → รูปกลาง */
export function normalizeDaysResponse(data) {
  const branches = (Array.isArray(data?.branches) ? data.branches : []).map((b) => ({
    id: num(b.branch_id ?? b.id),
    name: b.branch_name || b.name || `สาขา ${b.branch_id ?? b.id}`,
    headcount: num(b.headcount),
  }))
  const headcountOf = new Map(branches.map((b) => [b.id, b.headcount]))
  const days = (Array.isArray(data?.days) ? data.days : []).map((d) => {
    const date = parseISO(d.date)
    const wd = d.weekday ?? (date ? weekdayMon0(date) : 0)
    const isWeekend = d.is_weekend ?? wd >= 5
    const holiday = normHoliday(d.holiday)
    const dayBranches = (Array.isArray(d.branches) ? d.branches : []).map((b) => {
      const id = num(b.branch_id ?? b.id)
      const people = (Array.isArray(b.people) ? b.people : []).map(normPerson)
      return {
        id,
        name: b.branch_name || b.name || `สาขา ${id}`,
        headcount: num(b.headcount) ?? headcountOf.get(id) ?? null,
        onLeave: num(b.on_leave) ?? people.length,
        halfDay: num(b.half_day) ?? people.filter((p) => p.halfDay).length,
        people,
      }
    })
    return {
      date: d.date,
      weekday: wd,
      isWeekend,
      holiday,
      isWorkingDay: d.is_working_day ?? (!isWeekend && !holiday),
      onLeave: num(d.on_leave) ?? dayBranches.reduce((s, b) => s + b.onLeave, 0),
      branches: dayBranches,
    }
  })
  return { source: "days", from: data?.from_date, to: data?.to_date, branches, days }
}

const LEAVE_ARRAY_KEYS = ["leaves", "items", "people", "records", "rows", "employees", "data"]

function leavesOfGroup(g) {
  for (const k of LEAVE_ARRAY_KEYS) if (Array.isArray(g?.[k])) return g[k]
  return []
}

/**
 * Response ของ /hr/leave-calendar (รายการเดิม "grouped by branch") → [{ id, name, headcount, leaves[] }]
 * ไม่มีสัญญารูปแบบที่แน่ชัด จึงรับได้ทั้ง array ของกลุ่ม, { branches: [...] }, map ชื่อสาขา → รายการ,
 * หรือ array แบน ๆ ของใบลาที่มี branch_id/branch_name ติดมา
 */
function listGroups(data) {
  let raw = data
  if (!Array.isArray(raw)) {
    raw = raw?.branches ?? raw?.groups ?? raw?.items ?? raw?.data ?? raw
  }
  // map: { "สาขาเมือง": [...] } หรือ { "3": {...} }
  if (raw && !Array.isArray(raw) && typeof raw === "object") {
    raw = Object.entries(raw).map(([k, v]) =>
      Array.isArray(v) ? { branch_name: k, leaves: v } : { branch_name: k, ...(v || {}) },
    )
  }
  if (!Array.isArray(raw)) return []

  const looksFlat = raw.length > 0 && raw.every((r) => (r?.from_date || r?.start_date) && leavesOfGroup(r).length === 0)
  if (looksFlat) {
    const byBranch = new Map()
    for (const l of raw) {
      const id = num(l.branch_id ?? l.branch?.id)
      const key = id ?? l.branch_name ?? "?"
      if (!byBranch.has(key)) byBranch.set(key, { id, name: l.branch_name || l.branch?.branch_name || (id != null ? `สาขา ${id}` : "ไม่ระบุสาขา"), headcount: null, leaves: [] })
      byBranch.get(key).leaves.push(l)
    }
    return [...byBranch.values()]
  }

  return raw.map((g) => {
    const id = num(g.branch_id ?? g.id ?? g.branch?.id)
    return {
      id,
      name: g.branch_name || g.name || g.branch?.branch_name || (id != null ? `สาขา ${id}` : "ไม่ระบุสาขา"),
      headcount: num(g.headcount),
      leaves: leavesOfGroup(g),
    }
  })
}

/** สร้าง grid รายวันจากรายการใบลา (fallback) */
export function buildDaysFromList(data, holidays, from, to) {
  const groups = listGroups(data)
  const holidayByDate = new Map()
  for (const h of Array.isArray(holidays) ? holidays : []) {
    if (h?.is_active === false || !h?.holiday_date) continue
    holidayByDate.set(h.holiday_date, { name: h.name || "วันหยุด", type: h.holiday_type || null })
  }

  const dates = eachDay(from, to)
  // date → branchId → { …, people[] }
  const perDay = new Map(dates.map((d) => [d, new Map()]))

  groups.forEach((g, gi) => {
    const bKey = g.id ?? `g${gi}`
    g.leaves.forEach((raw, i) => {
      const p = normPerson(raw, i)
      const lFrom = p.fromDate || raw.date
      const lTo = p.toDate || lFrom
      if (!lFrom) return
      const start = lFrom < from ? from : lFrom
      const end = lTo > to ? to : lTo
      for (const d of eachDay(start, end)) {
        const m = perDay.get(d)
        if (!m) continue
        if (!m.has(bKey)) m.set(bKey, { id: g.id, name: g.name, headcount: g.headcount, onLeave: 0, halfDay: 0, people: [] })
        const b = m.get(bKey)
        // ครึ่งวันมีผลเฉพาะใบลาวันเดียว
        const person = { ...p, halfDay: p.halfDay && (p.fromDate || lFrom) === (p.toDate || lTo) }
        b.people.push(person)
        b.onLeave += 1
        if (person.halfDay) b.halfDay += 1
      }
    })
  })

  const days = dates.map((date) => {
    const d = parseISO(date)
    const wd = weekdayMon0(d)
    const isWeekend = wd >= 5
    const holiday = holidayByDate.get(date) || null
    const branches = [...perDay.get(date).values()].sort((a, b) => a.name.localeCompare(b.name, "th"))
    return {
      date,
      weekday: wd,
      isWeekend,
      holiday,
      isWorkingDay: !isWeekend && !holiday,
      onLeave: branches.reduce((s, b) => s + b.onLeave, 0),
      branches,
    }
  })

  return {
    source: "list",
    from,
    to,
    branches: groups.filter((g) => g.id != null || g.leaves.length).map((g) => ({ id: g.id, name: g.name, headcount: g.headcount })),
    days,
  }
}

/* ───────────────────────── fetching ───────────────────────── */

const qs = (o) =>
  Object.entries(o)
    .filter(([, v]) => v != null && v !== "")
    .map(([k, v]) => `${k}=${encodeURIComponent(v)}`)
    .join("&")

const isMissingEndpoint = (e) => e?.status === 404 || e?.status === 405

async function fetchHolidays(from, to) {
  const fys = [...new Set([currentFiscalYearBE(parseISO(from)), currentFiscalYearBE(parseISO(to))])]
  const lists = await Promise.all(
    fys.map((fy) => apiAuth(`/hr/holidays?${qs({ fiscal_year: fy })}`).catch(() => [])),
  )
  return lists.flatMap((l) => (Array.isArray(l) ? l : []))
}

/**
 * โหลดปฏิทินช่วง from..to (≤ 93 วัน) — คืนรูปกลาง { source, branches[], days[] }
 * source = "days" (endpoint ใหม่) | "list" (fallback)
 */
export async function fetchLeaveCalendar({ from, to, branchId } = {}) {
  const q = qs({ from_date: from, to_date: to, branch_id: branchId })
  try {
    const data = await apiAuth(`/hr/leave-calendar/days?${q}`)
    return normalizeDaysResponse(data)
  } catch (e) {
    if (!isMissingEndpoint(e)) throw e
  }
  const [list, holidays] = await Promise.all([apiAuth(`/hr/leave-calendar?${q}`), fetchHolidays(from, to)])
  return buildDaysFromList(list, holidays, from, to)
}

/** สาขาที่ผู้ใช้เข้าถึงได้ (GET /auth/my-branches) → [{ id, name }] */
export async function fetchMyBranches() {
  const data = await apiAuth("/auth/my-branches")
  return (Array.isArray(data) ? data : [])
    .map((b) => ({ id: num(b.id ?? b.branch_id), name: b.branch_name || b.name || `สาขา ${b.id ?? b.branch_id}` }))
    .filter((b) => b.id != null)
}

/* ───────────────────────── derived ───────────────────────── */

/** สัดส่วนคนลา 0–1 (null เมื่อไม่รู้ headcount) */
export function leaveRatio(onLeave, headcount) {
  if (!headcount || headcount <= 0) return null
  return Math.min(1, onLeave / headcount)
}

/**
 * ระดับความหนาแน่น 0–3 สำหรับไล่สี: ใช้สัดส่วนเมื่อรู้ headcount (<15% / <30% / ≥30%),
 * ไม่รู้ (fallback) ใช้จำนวนคน (1 / 2 / ≥3)
 */
export function pressureLevel(onLeave, headcount) {
  if (!onLeave) return 0
  const r = leaveRatio(onLeave, headcount)
  if (r == null) return onLeave >= 3 ? 3 : onLeave
  if (r >= 0.3) return 3
  if (r >= 0.15) return 2
  return 1
}

/** ตัดข้อมูลให้เหลือเฉพาะสาขาที่เลือก (branchId null = ทุกสาขา) */
export function filterDays(days, branchId) {
  if (branchId == null) return days
  return days.map((d) => {
    const branches = d.branches.filter((b) => b.id === branchId)
    return { ...d, branches, onLeave: branches.reduce((s, b) => s + b.onLeave, 0) }
  })
}

/** สรุปประเภทการลาที่พบ: [{ type, personDays, halfDays }] เรียงมาก → น้อย */
export function leaveTypeSummary(days) {
  const m = new Map()
  for (const d of days)
    for (const b of d.branches)
      for (const p of b.people) {
        const row = m.get(p.leaveType) || { type: p.leaveType, personDays: 0, halfDays: 0 }
        row.personDays += 1
        if (p.halfDay) row.halfDays += 1
        m.set(p.leaveType, row)
      }
  return [...m.values()].sort((a, b) => b.personDays - a.personDays || a.type.localeCompare(b.type, "th"))
}
