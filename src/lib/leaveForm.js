// src/lib/leaveForm.js
// ─────────────────────────────────────────────────────────────────────────────
// ข้อมูลของ "ใบลา" แบบกระดาษ — ประกอบจาก API JSON แล้วให้หน้าเว็บวาดเอง (LeaveFormDocument)
// แทน PDF จาก backend (/hr/employees/{id}/leaves/{id}/pdf ยังเป็นปุ่มสำรอง)
//
//   GET /hr/leave-requests                         ใบลา (ไม่มี GET รายตัว — หาแถวจากรายการ)
//   GET /hr/leave-requests/{id}/history            steps: { action, label, actor_id, actor_name, at, comment }
//   GET /hr/personnel/{user_id}                    ชื่อไทย · ตำแหน่ง · เบอร์ · leave_quota (ยกมา)
//   GET /hr/employees/{user_id}/leave-balance?year {quota, used, remaining} ต่อประเภท ในปีงบ (เม.ย.–มี.ค.)
//   GET /hr/personnel/{actor_id}                   ตำแหน่งของผู้อนุมัติ/ผู้ตรวจ (โหลดไม่ได้ = ไม่แสดง)
//
//   GET /hr/leave-requests/{id}/signatures         ลายเซ็นของคนที่ทำ action แล้ว (handoff/api-handoff-e-signature.md)
//
// "ลามาแล้ว" = ยอด used ของปีงบ − ใบลาที่อนุมัติแล้วซึ่งเริ่มตั้งแต่ใบนี้เป็นต้นไป (รวมใบนี้ถ้าอนุมัติแล้ว)
// ─────────────────────────────────────────────────────────────────────────────
import { apiAuth } from "./api"
import { currentFiscalYearBE, parseDays } from "./leaveDays"
import { isAnnualLeave, parseLeaveBalance } from "./leaveTypes"
import { leaveSignaturesPath, loadDocSignatures, pickSignature } from "./signatures"

/** ช่องติ๊กประเภทการลาบนแบบฟอร์ม — ประเภทอื่นติ๊ก "อื่น ๆ" พร้อมชื่อ */
export const FORM_LEAVE_KINDS = [
  { key: "annual", label: "พักผ่อน", match: (n) => isAnnualLeave(n) },
  { key: "sick", label: "ป่วย", match: (n) => /^ลาป่วย/.test(n) },
  { key: "business", label: "กิจส่วนตัว", match: (n) => /^ลากิจ/.test(n) },
  { key: "maternity", label: "คลอดบุตร", match: (n) => /^ลาคลอด/.test(n) },
]

/** แถวของตารางสถิติการลาบนแบบฟอร์ม (ประเภทของใบนี้ถ้าไม่อยู่ในนี้จะถูกเพิ่มต่อท้าย) */
const STAT_KINDS = ["annual", "sick", "business"]

const fullName = (first, last) => [first, last].map((s) => String(s ?? "").trim()).filter(Boolean).join(" ")
const iso = (d) => (d ? String(d).slice(0, 10) : "")
const fyOf = (dateIso) => (dateIso ? currentFiscalYearBE(new Date(`${iso(dateIso)}T00:00:00`)) : null)
const kindOf = (name) => FORM_LEAVE_KINDS.find((k) => k.match(String(name ?? "").trim()))?.key ?? "other"
/** ตัดส่วนที่ระบบเขียนเอง ("final; extra_days=1.0; check=assistant_manager") ออก เหลือแต่ข้อความของคน */
const humanComment = (c) =>
  String(c ?? "")
    .split(";")
    .map((t) => t.trim())
    .filter((t) => t && t !== "final" && !/^[a-z_]+=\S*$/i.test(t))
    .join("; ")

/** step.at เป็น null ได้ — ใช้เวลาของขั้นนั้นจากตัวใบลา/ประวัติแทน */
function stepTimeFallback(action, r) {
  const a = String(action ?? "")
  if (/BRANCH_HEAD/.test(a)) return r?.branch_head_at ?? null
  if (/ASSIST/.test(a)) return r?.assistant_manager_at ?? null
  return r?.action_at ?? null
}

async function personnel(id) {
  if (id == null) return null
  try {
    return await apiAuth(`/hr/personnel/${id}`)
  } catch {
    return null
  }
}

/**
 * โหลดทุกอย่างที่ใบลาต้องใช้
 * @param {{ employeeId: number|string, leaveId: number|string, leave?: object }} p
 *   leave = แถวจาก /hr/leave-requests ถ้ามีอยู่แล้ว (ไม่ต้องโหลดรายการซ้ำเพื่อหาแถว แต่ยังใช้รายการคำนวณ "ลามาแล้ว")
 */
export async function loadLeaveForm({ employeeId, leaveId, leave: given }) {
  const [list, history, person, sigRows] = await Promise.all([
    apiAuth("/hr/leave-requests").catch(() => []),
    apiAuth(`/hr/leave-requests/${leaveId}/history`).catch(() => null),
    personnel(employeeId),
    loadDocSignatures(leaveSignaturesPath(leaveId)),
  ])
  const rows = Array.isArray(list) ? list : []
  const leave = given ?? rows.find((r) => String(r.id) === String(leaveId))
  if (!leave) throw new Error("ไม่พบใบลานี้ในระบบ")

  const fy = fyOf(leave.from_date)
  const quota = person?.leave_quota ?? null
  const [balanceRaw, types] = await Promise.all([
    fy ? apiAuth(`/hr/employees/${employeeId}/leave-balance?year=${fy}`).catch(() => null) : null,
    apiAuth("/hr/leave-types").catch(() => []),
  ])
  const typeById = new Map((Array.isArray(types) ? types : []).filter((t) => t?.id != null).map((t) => [t.id, t.type ?? t.display_name]))
  const balance = parseLeaveBalance(balanceRaw, typeById)

  // ผู้อนุมัติ / ผู้ตรวจ — ตำแหน่งจากประวัติเจ้าหน้าที่
  const steps = (Array.isArray(history?.steps) ? history.steps : []).filter((s) => s?.action !== "SUBMIT")
  const justifiedBy = history?.justified_by ?? leave.justified_by ?? null
  const actorIds = [...new Set([...steps.map((s) => s.actor_id), justifiedBy].filter((v) => v != null))]
  const actors = new Map(
    (await Promise.all(actorIds.map(async (id) => [id, await personnel(id)]))).filter(([, p]) => p),
  )
  const positionOf = (id) => actors.get(id)?.position_display ?? actors.get(id)?.position ?? ""
  const nameOf = (id) => {
    const p = actors.get(id)
    return p ? fullName(p.personnel_info?.th_first_name ?? p.first_name, p.personnel_info?.th_last_name ?? p.last_name) : ""
  }

  // ─── สถิติการลาในปีงบ ───
  const thisKey = leave.leave_type_id
  const thisDays = parseDays(leave.total_days) ?? 0
  const thisStart = iso(leave.from_date)
  const isLaterOrThis = (r) => iso(r.from_date) > thisStart || (iso(r.from_date) === thisStart && Number(r.id) >= Number(leave.id))
  const laterApproved = (typeId) =>
    rows
      .filter((r) => String(r.user_id) === String(employeeId) && r.leave_type_id === typeId && r.status === "approved"
        && fyOf(r.from_date) === fy && isLaterOrThis(r))
      .reduce((s, r) => s + (parseDays(r.total_days) ?? 0), 0)

  const statRow = (b, kind) => {
    const isThis = b.id != null ? b.id === thisKey : false
    const used = parseDays(b.used) ?? 0
    const before = Math.max(0, used - laterApproved(b.id))
    const now = isThis ? thisDays : 0
    const annual = kind === "annual"
    const fromQuota = annual && quota && Number(quota.year) === fy
    const entitled = fromQuota ? parseDays(quota.annual_leave) : parseDays(b.quota)
    const carried = fromQuota ? parseDays(quota.annual_leave_carried_over) : null
    const cap = (entitled ?? 0) + (carried ?? 0)
    return {
      key: b.id ?? b.name,
      label: b.name,
      entitled,
      carried,
      before,
      now,
      total: before + now,
      remaining: cap > 0 ? cap - before - now : null,
      isThis,
    }
  }
  const byKind = new Map()
  for (const b of balance) {
    const k = kindOf(b.type || b.name)
    if (STAT_KINDS.includes(k) && !byKind.has(k)) byKind.set(k, b)
  }
  const stats = STAT_KINDS.map((k) => byKind.get(k)).filter(Boolean).map((b) => statRow(b, kindOf(b.type || b.name)))
  if (!stats.some((s) => s.isThis)) {
    const own = balance.find((b) => b.id === thisKey)
    if (own) stats.push(statRow(own, kindOf(own.type || own.name)))
  }

  const info = person?.personnel_info ?? {}
  const typeName = leave.leave_type_name ?? ""
  // ช่อง "ผู้บันทึก" = step สุดท้ายที่อนุมัติ/ไม่อนุมัติ (กฎเดียวกับ LeaveFormSheet)
  const finalStep = [...steps].reverse().find((s) => /APPROVE|REJECT/.test(s.action ?? "")) ?? steps[steps.length - 1]
  const sig = (row) => (row ? { image: row.image, name: row.name || nameOf(row.user_id) } : null)
  const signatures = {
    requester: sig(pickSignature(sigRows, { role: "requester", userId: leave.user_id ?? employeeId })),
    approver: finalStep?.actor_id != null ? sig(pickSignature(sigRows, { role: "approver", userId: finalStep.actor_id })) : null,
    reviewer: justifiedBy != null ? sig(pickSignature(sigRows, { role: "reviewer", userId: justifiedBy })) : null,
  }
  return {
    signatures,
    docNo: leave.id,
    createdAt: leave.created_at,
    status: leave.status,
    name: fullName(info.th_first_name ?? leave.user_th_first_name ?? leave.user_first_name, info.th_last_name ?? leave.user_th_last_name ?? leave.user_last_name)
      || leave.user_display_name || "",
    position: person?.position_display ?? person?.position ?? "",
    branch: leave.branch_name ?? "",
    typeName,
    kind: kindOf(typeById.get(leave.leave_type_id) ?? typeName),
    reason: leave.comment ?? "",
    fromDate: leave.from_date,
    toDate: leave.to_date,
    fromTime: leave.from_time,
    toTime: leave.to_time,
    totalDays: leave.total_days,
    extraDays: parseDays(leave.extra_leave_days) || 0,
    address: leave.address_during_leave ?? "",
    phone: leave.contact_during_leave ?? info.p_number ?? "",
    fiscalYear: fy,
    stats,
    approvals: steps.map((s) => ({
      action: s.action ?? "",
      label: s.label || s.action,
      name: s.actor_name || nameOf(s.actor_id),
      position: positionOf(s.actor_id),
      at: s.at ?? stepTimeFallback(s.action, history ?? leave),
      comment: humanComment(s.comment),
    })),
    review: {
      note: [history?.justification_note ?? leave.justification_note, leave.hr_comment].filter(Boolean).join(" · "),
      name: justifiedBy != null ? nameOf(justifiedBy) : "",
      position: justifiedBy != null ? positionOf(justifiedBy) : "",
      at: history?.justified_at ?? leave.justified_at ?? null,
    },
  }
}
