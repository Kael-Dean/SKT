// src/pages/work/MyPayslips.jsx
// สลิปเงินเดือนของฉัน (3G) — ตัวรายการ/รายละเอียด/ดาวน์โหลดอยู่ใน components/hr/MyPayslipsPanel
// (ใช้ร่วมกับหน้า "ข้อมูลการเงินของฉัน" /my-financial)
import { Link } from "react-router-dom"
import { ChevronRight } from "lucide-react"
import MyPayslipsPanel from "../../components/hr/MyPayslipsPanel"
import { focusRingCls } from "../../lib/styles"

export default function MyPayslips() {
  return (
    <div className="mx-auto max-w-4xl space-y-5 pb-10">
      <div className="flex flex-wrap items-end justify-between gap-x-4 gap-y-2">
        <div>
          <h1 className="text-xl font-bold text-gray-900 dark:text-gray-100">สลิปเงินเดือนของฉัน</h1>
          <p className="mt-0.5 text-sm text-gray-500 dark:text-gray-400">สลิปของแต่ละเดือนจะแสดงที่นี่หลังผู้จัดการอนุมัติงวดเงินเดือนของเดือนนั้น</p>
        </div>
        <Link
          to="/my-financial"
          className={`inline-flex min-h-touch md:min-h-0 items-center gap-1 rounded text-sm font-medium text-indigo-700 hover:underline dark:text-indigo-300 ${focusRingCls}`}
        >
          เงินเดือนและรายการหักที่บันทึกไว้ <ChevronRight aria-hidden="true" className="size-4" />
        </Link>
      </div>
      <MyPayslipsPanel />
    </div>
  )
}
