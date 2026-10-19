// src/lib/pageTitle.js
// ชื่อหน้าปัจจุบัน → แสดงใน Topbar (sticky) แทนหัวข้อใหญ่ในหน้า
//   <PageTitle title="ใบลา" />            (components/PageTitle.jsx) — h1 แบบ sr-only + ตั้งชื่อใน Topbar
//   usePageTitle("ข้อมูลเจ้าหน้าที่")       — ตั้งชื่อใน Topbar อย่างเดียว (หน้าที่หัวข้อในหน้าเป็นข้อมูล เช่นชื่อพนักงาน)
// หน้าไหนไม่ได้ตั้ง → AppLayout ใช้ชื่อเมนูจาก homeFunctions (ALL_ITEMS) แทน
import { useEffect, useSyncExternalStore } from "react"

let current = null // { id, title }
const listeners = new Set()
const emit = () => listeners.forEach((fn) => fn())

function subscribe(fn) {
  listeners.add(fn)
  return () => listeners.delete(fn)
}

/** ตั้งชื่อหน้าใน Topbar ระหว่างที่ component นี้ mount อยู่ */
export function usePageTitle(title) {
  useEffect(() => {
    if (!title) return undefined
    const id = Symbol("page-title")
    current = { id, title }
    emit()
    return () => {
      if (current?.id === id) {
        current = null
        emit()
      }
    }
  }, [title])
}

/** ชื่อหน้าปัจจุบัน (อ่านครั้งเดียว ไม่ re-render) — ใช้ตั้งป้ายปุ่มย้อนกลับตอนกระโดดไปหน้าอื่น */
export const getCurrentPageTitle = () => current?.title ?? null

/** ชื่อหน้าที่หน้าปัจจุบันตั้งไว้ (null = ไม่ได้ตั้ง) */
export function useCurrentPageTitle() {
  return useSyncExternalStore(subscribe, () => current?.title ?? null)
}
