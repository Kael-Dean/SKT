// Leave types come from the backend `Leaves` table. Screens must not keep their own
// list of type names: use GET /hr/leave-types (the catalogue) or the leave-balance
// endpoints (the catalogue plus one person's figures).
import { useEffect, useState } from "react"
import { apiAuth } from "./api"
import { leaveTypeName, parseDays } from "./leaveDays"

// Display order only. Most-used first; "ขาดงาน" and "อื่นๆ" always last. Types not
// listed keep the backend order, between the known ones and the last two.
const LEAVE_TYPE_ORDER = [
  "ลาป่วย", "ลากิจ", "ลาพักผ่อน", "ลาพักชดเชย", "ลาคลอด", "ลาเพื่อดูแลบุตร", "ลาทำหมัน",
  "ลาอุปสมบท", "ลาฮัจย์", "ลาเกณฑ์ทหาร", "ลาฝึกอบรม", "ลาติดตามคู่สมรส", "ลาฟื้นฟู",
]
const LEAVE_TYPE_LAST = ["ขาดงาน", "อื่น"]

function leaveTypeRank(lt) {
  const n = String(leaveTypeName(lt)).trim()
  const last = LEAVE_TYPE_LAST.findIndex((k) => n.startsWith(k))
  if (last !== -1) return 1000 + last
  const i = LEAVE_TYPE_ORDER.findIndex((k) => n.startsWith(k))
  return i === -1 ? 500 : i
}

export const sortLeaveTypes = (list) =>
  list
    .map((t, i) => ({ t, i }))
    .sort((a, b) => leaveTypeRank(a.t) - leaveTypeRank(b.t) || a.i - b.i)
    .map(({ t }) => t)

/** ลาพักผ่อน — its figures include carry-over, so profile pages show it separately. */
export const isAnnualLeave = (name) => /^ลาพัก(ผ่อน|ร้อน)/.test(String(name ?? "").trim())

/** ลาทำหมัน is granted "ตามแพทย์สั่ง": no cap, so its quota figure means nothing. */
export const isPrescribedLeave = (name) => String(name ?? "").trim().startsWith("ลาทำหมัน")

/**
 * หลักเกณฑ์การลาตามระเบียบสหกรณ์ (ทะเบียนการลา) — จับจากชื่อประเภท เพราะ backend ยังไม่มี field นี้.
 * `cert` = ต้องแนบใบรับรองแพทย์ (string = เงื่อนไขเพิ่ม). ประเภทที่ไม่รู้จัก → null
 */
const LEAVE_CRITERIA = [
  [/^ลาพัก(ผ่อน|ร้อน)/, { rules: ["ทำงานครบ 1 ปี จึงลาได้ในปีถัดไป"] }],
  [/^ลากิจ/, { rules: ["จ่ายค่าจ้างตามที่อนุญาตให้ลา ไม่เกิน 10 วัน/ปี"] }],
  [/^ลาป่วย/, { rules: ["จ่ายตามจริง ไม่เกิน 30 วันทำงาน/ปี", "ไม่นับรวมวันหยุดและวันหยุดนักขัตฤกษ์"], cert: "ลา 3 วันขึ้นไป" }],
  [/^ลาคลอด/, { rules: ["จ่ายค่าจ้างตามวันลา ไม่เกิน 60 วัน/ปี", "นับรวมวันหยุดและวันหยุดนักขัตฤกษ์", "ใช้ได้ทั้งก่อน/หลังคลอด (รวมตรวจครรภ์)"], cert: true }],
  [/ภรรยา|ภริยา/, { rules: ["จ่ายค่าจ้างร้อยละ 100", "ลาได้ไม่เกิน 15 วัน (ก่อน/หลังคลอดภายใน 90 วัน)", "นับรวมวันหยุดและวันหยุดนักขัตฤกษ์"], cert: true }],
  [/เลี้ยงดูบุตร|ดูแลบุตร/, { rules: ["จ่ายค่าจ้างร้อยละ 50", "ลาได้ไม่เกิน 15 วัน", "นับรวมวันหยุดและวันหยุดนักขัตฤกษ์"], cert: true }],
  [/^ลาทำหมัน/, { rules: ["จ่ายตามที่แพทย์กำหนดและออกใบรับรอง"], cert: true }],
  [/ทหาร/, { rules: ["จ่ายค่าจ้างตามวันลา ไม่เกิน 60 วัน/ปี"] }],
  [/ฝึกอบรม|พัฒนา/, { rules: ["จ่ายค่าจ้างตามวันลา ไม่เกิน 15 วัน/ปี"] }],
  [/อุปสมบท|ศาสนา|ฮัจย์/, { rules: ["จ่ายค่าจ้างตามวันลา ไม่เกิน 15 วัน/ปี"] }],
  [/^ขาดงาน/, { rules: ["ไม่นับเป็นวันลา และไม่ได้รับค่าจ้าง"] }],
]

/**
 * ชื่อที่แสดงในทะเบียนการลา (ตามแบบฟอร์มสหกรณ์) — แสดงผลอย่างเดียว ห้ามใช้เป็น key:
 * ชื่อจาก backend (`Leaves.type`) ยังเป็น key ของ logic ทั้งสองฝั่ง
 */
const REGISTER_LABELS = [
  [/^ลาเกณฑ์ทหาร/, "ลาฝึกทหาร"],
  [/^ลาอุปสมบท$/, "ลาอุปสมบท/พิธีฮัจย์"],
]

export function registerLabel(name) {
  const n = String(name ?? "").trim()
  return REGISTER_LABELS.find(([re]) => re.test(n))?.[1] ?? n
}

export function leaveCriteria(name) {
  const n = String(name ?? "").trim()
  return LEAVE_CRITERIA.find(([re]) => re.test(n))?.[1] ?? null
}

/**
 * Normalise a leave-balance response: `{ year, balance: [{ leave_type_id,
 * leave_type_name, is_active, quota, used, remaining }] }`.
 * A switched-off type is dropped unless days were already taken against it.
 */
export function parseLeaveBalance(data, typeById) {
  const list = Array.isArray(data) ? data : data?.balance
  if (!Array.isArray(list)) return []
  return sortLeaveTypes(
    list
      .map((x) => ({
        id: x?.leave_type_id ?? null,
        // name = ชื่อที่แสดง (`leave_type_name` = display_name ?? type), type = key ของ logic.
        // leave-balance ไม่ส่ง `type` มา → หา key จาก catalogue ด้วย id ไม่งั้นแถวที่ HR เปลี่ยนชื่อแล้ว
        // จะจับคู่ logic (ลาพักผ่อน / ลาตามระเบียบ / หลักเกณฑ์) ด้วยชื่อใหม่แล้วผิด
        name: x?.leave_type_name ?? x?.leave_type ?? "",
        type: x?.leave_type ?? typeById?.get(x?.leave_type_id) ?? x?.leave_type_name ?? "",
        isActive: x?.is_active !== false,
        quota: x?.quota,
        used: x?.used,
        remaining: x?.remaining,
      }))
      .filter((x) => x.name && (x.isActive || (parseDays(x.used) ?? 0) > 0)),
  )
}

/**
 * @param {string|null} path  a leave-balance endpoint; null waits (nothing is fetched)
 * @returns {{ rows: object[]|null, error: string }} `rows` is null while loading
 */
export function useLeaveBalance(path) {
  const [state, setState] = useState({ path: null, rows: null, error: "" })
  useEffect(() => {
    if (!path) return undefined
    let alive = true
    // catalogue ใช้หา `type` (key) ของแต่ละแถว — โหลดไม่ได้ก็ยังแสดงยอดได้ (ตกไปใช้ชื่อที่แสดง)
    const catalogue = apiAuth("/hr/leave-types").catch(() => [])
    Promise.all([apiAuth(path), catalogue])
      .then(([d, types]) => {
        const typeById = new Map(
          (Array.isArray(types) ? types : []).filter((t) => t?.id != null).map((t) => [t.id, leaveTypeName(t)]),
        )
        if (alive) setState({ path, rows: parseLeaveBalance(d, typeById), error: "" })
      })
      .catch((e) => {
        if (alive) setState({ path, rows: [], error: e?.message || "โหลดประเภทการลาไม่สำเร็จ" })
      })
    return () => {
      alive = false
    }
  }, [path])
  return state.path === path ? state : { rows: null, error: "" }
}
