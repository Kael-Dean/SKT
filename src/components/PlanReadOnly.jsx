// src/components/PlanReadOnly.jsx
// โหมด "ดูอย่างเดียว" ของตารางแผนรายปี (organization/cost, organization/sell)
//
//   const canWrite = useCan().can("plan.costs.edit")   // useCan จาก src/lib/permissions.js
//   return (
//     <ReadOnlyFieldset readOnly={!canWrite}>
//       {!canWrite && <ReadOnlyNotice />}
//       …ตารางเดิม…   {canWrite && <ปุ่มรีเซ็ต/บันทึก />}
//     </ReadOnlyFieldset>
//   )
//
// ReadOnlyFieldset ใช้ <fieldset disabled> แบบ display: contents — ไม่เปลี่ยน layout เดิม
// แต่ปิดทุก input ข้างในพร้อมกัน (ไม่ต้องแก้ input ทีละช่อง) และแสดงค่าเป็นตัวเลขธรรมดา
import { Lock } from "lucide-react"

export function ReadOnlyNotice({ className = "" }) {
  return (
    <p
      role="note"
      className={
        "mb-3 flex items-start gap-2 rounded-xl bg-slate-100 px-3 py-2 text-sm text-slate-700 ring-1 ring-slate-200 " +
        "dark:bg-slate-800 dark:text-slate-200 dark:ring-slate-700 " +
        className
      }
    >
      <Lock aria-hidden="true" strokeWidth={1.75} className="mt-0.5 size-4 shrink-0 text-slate-500 dark:text-slate-400" />
      <span>ดูได้อย่างเดียว — บทบาทของคุณไม่มีสิทธิ์แก้ไขข้อมูลในตารางนี้</span>
    </p>
  )
}

export function ReadOnlyFieldset({ readOnly, children }) {
  return (
    <fieldset
      disabled={readOnly}
      className={
        readOnly
          ? // ช่องกรอกแสดงเป็นตัวเลขธรรมดา (ไม่มีกรอบ/พื้น) ให้ไม่ดูเหมือนแก้ได้ แต่ยังอ่านชัด
            "contents [&_input:disabled]:cursor-default [&_input:disabled]:opacity-100 " +
            "[&_input:disabled]:border-transparent [&_input:disabled]:bg-transparent [&_input:disabled]:shadow-none " +
            "dark:[&_input:disabled]:bg-transparent"
          : "contents"
      }
    >
      {children}
    </fieldset>
  )
}
