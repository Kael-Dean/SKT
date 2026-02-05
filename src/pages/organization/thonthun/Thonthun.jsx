import { useEffect } from "react"

const Thonthun = ({ branchId, branchName, yearBE, planId }) => {
  useEffect(() => {
    document.title = "ต้นทุนสินค้า (Thonthun)"
  }, [])

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-800">
      <div className="flex flex-col gap-1 md:flex-row md:items-baseline md:justify-between">
        <h2 className="text-xl md:text-2xl font-extrabold">📦 ต้นทุนสินค้า</h2>
        <div className="text-sm text-slate-600 dark:text-slate-300">
          ปี {yearBE} • plan_id {planId ?? "-"} • สาขา {branchName || branchId || "—"}
        </div>
      </div>

      <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-amber-900 dark:border-amber-900/40 dark:bg-amber-900/20 dark:text-amber-100">
        <div className="font-extrabold">ยังเป็นไฟล์ตั้งต้น (placeholder)</div>
        <div className="mt-1 text-sm leading-relaxed">
          ตอนนี้หน้าเลือกตารางสามารถเลือก <span className="font-semibold">ต้นทุนสินค้า</span> แล้วจะชี้มาที่ไฟล์นี้อัตโนมัติ
          — คุณสามารถเอาตารางต้นทุนสินค้า “ตัวจริง” มาวางแทนในไฟล์ <span className="font-semibold">Thonthun.jsx</span> ได้เลย
        </div>
      </div>

      <div className="mt-4 text-sm text-slate-600 dark:text-slate-300">
        Props ที่รับมา:
        <div className="mt-1 rounded-xl bg-slate-50 p-3 font-mono text-[12px] text-slate-700 dark:bg-slate-900/30 dark:text-slate-200">
          branchId={String(branchId ?? "")} | branchName={String(branchName ?? "")} | yearBE={String(yearBE ?? "")} | planId=
          {String(planId ?? "")}
        </div>
      </div>
    </div>
  )
}

export default Thonthun
