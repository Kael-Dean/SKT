// src/pages/work/MyPayslips.jsx
// สลิปเงินเดือนของฉัน (3G) — ตัวรายการ/รายละเอียด/ดาวน์โหลดอยู่ใน components/hr/MyPayslipsPanel
// (ใช้ร่วมกับหน้า "ข้อมูลการเงินของฉัน" /my-financial)
import { Link } from "react-router-dom"
import { ChevronRight } from "lucide-react"
import MyPayslipsPanel from "../../components/hr/MyPayslipsPanel"
import { focusRingCls } from "../../lib/styles"
import PageTitle from "../../components/PageTitle"
import { backState } from "../../lib/drill"

export default function MyPayslips() {
  return (
    <div className="mx-auto max-w-4xl space-y-5 pb-10">
      <div className="flex flex-wrap items-end justify-between gap-x-4 gap-y-2">
        <PageTitle title="สลิปเงินเดือนของฉัน" />
        <Link
          to="/my-financial"
          state={backState("สลิปเงินเดือนของฉัน")}
          className={`inline-flex min-h-touch md:min-h-0 items-center gap-1 rounded text-sm font-medium text-indigo-700 hover:underline dark:text-indigo-300 ${focusRingCls}`}
        >
          เงินเดือนและรายการหักที่บันทึกไว้ <ChevronRight aria-hidden="true" className="size-4" />
        </Link>
      </div>
      <div data-tour="payslips">
        <MyPayslipsPanel />
      </div>
    </div>
  )
}
