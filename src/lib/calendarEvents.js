// src/lib/calendarEvents.js
// ปฏิทินกิจกรรมของสหกรณ์ (ประชุม / อบรม / กิจกรรม) — backend PR #112 (handoff "Company calendar")
//
//   GET    /calendar/events?from=YYYY-MM-DD&to=YYYY-MM-DD   ทุกคนที่ล็อกอิน (server กรองตามสาขาให้แล้ว)
//   POST   /hr/calendar/events                              holiday.edit → 201 CalendarEventOut
//   PATCH  /hr/calendar/events/{id}                         partial · null = ล้างค่า · branch_ids แทนทั้งรายการ
//   DELETE /hr/calendar/events/{id}                         ยกเลิก (soft delete) → { status: "cancelled", id }
//
// CalendarEventOut: { id, title, event_type, start_date, end_date, start_time "HH:MM"|null, end_time,
//                     location, detail, branch_ids[], created_by_name, updated_at }
// กิจกรรมไม่กระทบวันลา/วันทำงาน — แยกจากวันหยุดโดยสิ้นเชิง
import { apiAuth } from "./api"

export const EVENT_TYPES = [
  { value: "meeting", label: "ประชุม" },
  { value: "training", label: "อบรม" },
  { value: "activity", label: "กิจกรรม" },
  { value: "other", label: "อื่น ๆ" },
]
export const eventTypeLabel = (t) => EVENT_TYPES.find((o) => o.value === t)?.label ?? "กิจกรรม"

/** ช่วงที่ขอได้ไม่เกิน 400 วัน — ปีงบ (เม.ย.–มี.ค.) พอดี */
export const fiscalYearRange = (fyBE) => {
  const ce = Number(fyBE) - 543
  return { from: `${ce}-04-01`, to: `${ce + 1}-03-31` }
}

/** 404 "Not Found" ของ route = backend ยังไม่ deploy PR 112 → ถือว่าไม่มีกิจกรรม (ไม่ใช่ error) */
const notDeployed = (err) => err?.status === 404 && /^not found$/i.test(err?.message || "")

/** → { events: [], available: boolean } · error อื่น throw ตามปกติ */
export async function fetchCalendarEvents(from, to) {
  try {
    const d = await apiAuth(`/calendar/events?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`)
    return { events: Array.isArray(d) ? d : Array.isArray(d?.items) ? d.items : [], available: true }
  } catch (err) {
    if (notDeployed(err)) return { events: [], available: false }
    throw err
  }
}

export const createCalendarEvent = (body) => apiAuth("/hr/calendar/events", { method: "POST", body })
export const updateCalendarEvent = (id, body) => apiAuth(`/hr/calendar/events/${id}`, { method: "PATCH", body })
export const cancelCalendarEvent = (id) => apiAuth(`/hr/calendar/events/${id}`, { method: "DELETE" })

const pad = (n) => String(n).padStart(2, "0")
const isoOf = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`

/** วันที่ทุกวันที่กิจกรรมครอบ (server ส่งกิจกรรมหลายวันมาครั้งเดียว — กระจายเอง) */
export function eventDates(e) {
  const start = String(e?.start_date ?? "").slice(0, 10)
  if (!start) return []
  const end = String(e?.end_date ?? "").slice(0, 10) || start
  const out = []
  const d = new Date(`${start}T00:00:00`)
  const last = new Date(`${end < start ? start : end}T00:00:00`)
  for (let i = 0; d <= last && i < 400; i++) {
    out.push(isoOf(d))
    d.setDate(d.getDate() + 1)
  }
  return out
}

/** "09:00–12:00 น." · "ตั้งแต่ 13:30 น." · "ทั้งวัน" */
export function eventTimeText(e) {
  const s = e?.start_time ? String(e.start_time).slice(0, 5) : ""
  const t = e?.end_time ? String(e.end_time).slice(0, 5) : ""
  if (!s) return "ทั้งวัน"
  return t ? `${s}–${t} น.` : `ตั้งแต่ ${s} น.`
}

/** เรียงในวันเดียว: ทั้งวันก่อน แล้วตามเวลาเริ่ม */
export const compareEvents = (a, b) =>
  String(a.start_date).localeCompare(String(b.start_date)) ||
  (a.start_time ? 1 : 0) - (b.start_time ? 1 : 0) ||
  String(a.start_time ?? "").localeCompare(String(b.start_time ?? ""))

/** ตัวเลือกเวลา ทุก 15 นาที 06:00–21:45 (ใช้ดรอปดาวตกแต่งแทน input type="time") */
export const TIME_OPTIONS = Array.from({ length: 64 }, (_, i) => {
  const m = 6 * 60 + i * 15
  const v = `${pad(Math.floor(m / 60))}:${pad(m % 60)}`
  return { value: v, label: `${v} น.` }
})
