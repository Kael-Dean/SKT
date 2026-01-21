import { useEffect } from 'react'

const OperationPlan = () => {
  useEffect(() => {
    document.title = 'แผนปฏิบัติงาน (Operation Plan)'
  }, [])

  const mockRows = [
    { no: 1, topic: 'สรุปเป้าหมายรายเดือน', owner: 'ฝ่ายจัดการ', status: 'รอเริ่ม' },
    { no: 2, topic: 'แผนรับเข้า/โอนออก (ตัวอย่าง)', owner: 'คลังสินค้า', status: 'กำลังทำ' },
    { no: 3, topic: 'ตรวจสอบรายการสมาชิก/หุ้น (ตัวอย่าง)', owner: 'ทะเบียนสมาชิก', status: 'เสร็จแล้ว' },
  ]

  const statusPill = (s) => {
    const base =
      'inline-flex items-center rounded-full px-3 py-1 text-xs md:text-sm font-semibold ring-1'
    if (s === 'เสร็จแล้ว')
      return `${base} bg-emerald-100 text-emerald-800 ring-emerald-200 dark:bg-emerald-900/40 dark:text-emerald-200 dark:ring-emerald-800/60`
    if (s === 'กำลังทำ')
      return `${base} bg-amber-100 text-amber-800 ring-amber-200 dark:bg-amber-900/40 dark:text-amber-200 dark:ring-amber-800/60`
    return `${base} bg-gray-100 text-gray-800 ring-gray-200 dark:bg-gray-800/60 dark:text-gray-200 dark:ring-gray-700/70`
  }

  return (
    <div className="p-4 md:p-6">
      <div className="mx-auto max-w-5xl">
        <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold text-gray-900 dark:text-gray-100">
              🗺️ แผนปฏิบัติงาน (Operation Plan)
            </h1>
            <p className="mt-1 text-sm md:text-base text-gray-600 dark:text-gray-300">
              หน้านี้เป็น “หน้าจำลอง” สำหรับทดสอบว่า Route + Sidebar เปิดหน้านี้ได้จริง
            </p>
          </div>

          <span className="self-start sm:self-auto rounded-full bg-indigo-100 px-3 py-1 text-xs md:text-sm font-semibold text-indigo-800 ring-1 ring-indigo-200 dark:bg-indigo-900/40 dark:text-indigo-200 dark:ring-indigo-800/60">
            TEST PAGE
          </span>
        </div>

        <div className="rounded-2xl bg-white/80 dark:bg-gray-900/50 ring-1 ring-gray-200/80 dark:ring-gray-700/70 shadow-sm p-4 md:p-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="md:col-span-2">
              <div className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                สิ่งที่หน้านี้ใช้ทดสอบ
              </div>
              <ul className="mt-3 space-y-2 text-sm md:text-base text-gray-700 dark:text-gray-200">
                <li>✅ กดเมนู “แผนปฏิบัติงาน” ใน Sidebar แล้วเปิดหน้านี้ได้</li>
                <li>
                  ✅ URL เปลี่ยนเป็น{' '}
                  <span className="font-semibold">/operation-plan</span>
                </li>
                <li>✅ รีเฟรชหน้าแล้วยังอยู่หน้าเดิม (ไม่เด้งกลับ)</li>
                <li>✅ ไม่เรียก API / ไม่มีผลกับระบบจริง</li>
              </ul>
            </div>

            <div className="rounded-2xl bg-gray-50 dark:bg-gray-800/60 ring-1 ring-gray-200/70 dark:ring-gray-700/70 p-4">
              <div className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                หมายเหตุ
              </div>
              <p className="mt-2 text-sm text-gray-700 dark:text-gray-200">
                ถ้าต้องการให้หน้านี้ “ทำงานจริง” ภายหลัง ค่อยเพิ่มฟอร์ม/ตาราง/เรียก API
                ได้เลย แต่ตอนนี้ตั้งใจทำให้เป็น Mock เพื่อทดสอบการเปิดหน้าเท่านั้นครับ
              </p>
            </div>
          </div>
        </div>

        <div className="mt-4 rounded-2xl bg-white/80 dark:bg-gray-900/50 ring-1 ring-gray-200/80 dark:ring-gray-700/70 shadow-sm p-4 md:p-6">
          <div className="flex items-center justify-between gap-3">
            <div className="text-lg font-semibold text-gray-900 dark:text-gray-100">
              ตารางตัวอย่าง (Mock Data)
            </div>
            <div className="text-xs md:text-sm text-gray-500 dark:text-gray-400">
              แสดงข้อมูลจำลอง
            </div>
          </div>

          <div className="mt-3 overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="text-left text-gray-700 dark:text-gray-200">
                  <th className="py-2 pr-4">ลำดับ</th>
                  <th className="py-2 pr-4">หัวข้อ</th>
                  <th className="py-2 pr-4">ผู้รับผิดชอบ</th>
                  <th className="py-2 pr-4">สถานะ</th>
                </tr>
              </thead>
              <tbody>
                {mockRows.map((r) => (
                  <tr
                    key={r.no}
                    className="border-t border-gray-200/80 dark:border-gray-700/70"
                  >
                    <td className="py-3 pr-4 text-gray-900 dark:text-gray-100">{r.no}</td>
                    <td className="py-3 pr-4 text-gray-900 dark:text-gray-100">{r.topic}</td>
                    <td className="py-3 pr-4 text-gray-700 dark:text-gray-200">{r.owner}</td>
                    <td className="py-3 pr-4">
                      <span className={statusPill(r.status)}>{r.status}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="mt-4 text-xs md:text-sm text-gray-500 dark:text-gray-400">
            * ถ้าหน้านี้ขึ้นแปลว่า Route ทำงานถูกต้องแล้วครับ
          </div>
        </div>
      </div>
    </div>
  )
}

export default OperationPlan
