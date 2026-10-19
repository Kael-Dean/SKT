// src/lib/drill.js
// "กระโดดลึก" (drill-down) — ไปมุมมองย่อยแล้วกลับมาที่เดิมได้
//   เช่น รายชื่อเงินเดือน → เลื่อนขั้นของคนนั้น, รายชื่อเจ้าหน้าที่ → โปรไฟล์, กล่องงาน → คิวสินเชื่อ
//
// การกระโดดแบบนี้ต้อง push history พร้อม state { backLabel } — AppLayout เห็นแล้วเปลี่ยนปุ่มย้อนกลับใน Topbar
// เป็น "‹ <backLabel>" ซึ่งพากลับ history -1 (คืนแท็บย่อย/ตัวกรองใน URL ครบ). เปิดลิงก์ตรง (ไม่มี state)
// → ปุ่มย้อนกลับใช้หน้าแม่ตามปกติ (PARENT_ROUTES / หน้าหลัก)
//
//   const { drillTo, drillParams } = useDrill()
//   drillTo(`/hr/personnel/${id}`, "เจ้าหน้าที่")                  // ไปหน้าอื่น
//   drillParams((p) => { p.set("sub", "step"); return p }, "รายชื่อเงินเดือน")   // เปลี่ยน search param ในหน้าเดิม
//   <Link to="/my-profile" state={backState("ข้อมูลการเงินของฉัน")}>…</Link>
//
// การสลับแท็บย่อยแบบ replace หลังกระโดดมาแล้ว ใช้ keepBackState() เพื่อไม่ให้ปุ่มย้อนกลับหายไป
import { useCallback } from "react"
import { useNavigate, useSearchParams } from "react-router-dom"
import { getCurrentPageTitle } from "./pageTitle"

/** state สำหรับ navigate/Link — ไม่ส่ง label = ใช้ชื่อหน้าปัจจุบัน */
export const backState = (label) => ({ backLabel: label || getCurrentPageTitle() || "หน้าก่อนหน้า" })

/** state ของ history entry ปัจจุบัน (react-router เก็บไว้ที่ history.state.usr) — ส่งต่อตอน replace */
export const keepBackState = () => window.history.state?.usr ?? undefined

/** ย้อนกลับได้จริงไหม (entry ปัจจุบันไม่ใช่ entry แรกของแท็บ) */
export const canGoBack = () => (window.history.state?.idx ?? 0) > 0

export function useDrill() {
  const navigate = useNavigate()
  const [, setParams] = useSearchParams()
  const drillTo = useCallback((to, label) => navigate(to, { state: backState(label) }), [navigate])
  const drillParams = useCallback(
    (updater, label) => {
      setParams((prev) => updater(new URLSearchParams(prev)), { state: backState(label) })
      // หน้าเดิม (ไม่ remount) — เริ่มมุมมองใหม่ที่บนสุด ไม่ค้างกลางหน้าตามตำแหน่งในรายชื่อ
      window.scrollTo({ top: 0 })
    },
    [setParams],
  )
  return { drillTo, drillParams }
}
