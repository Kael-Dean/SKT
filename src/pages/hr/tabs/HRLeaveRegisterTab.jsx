// src/pages/hr/tabs/HRLeaveRegisterTab.jsx
// 13C — Leave Register: annual summary table + 2 PDF downloads
import { useEffect, useState, useCallback } from "react"
import { apiAuth, apiDownload } from "../../../lib/api"

// ปีงบประมาณไทย (Apr→Mar): ปัจจุบัน
function currentFiscalYear() {
  const now = new Date()
  const m = now.getMonth() + 1  // 1-based
  const y = now.getFullYear() + 543  // CE→BE
  return m >= 4 ? y : y - 1
}

const LEAVE_COLS = [
  { key: "sick_leave_days",       label: "ลาป่วย" },
  { key: "business_leave_days",   label: "ลากิจ" },
  { key: "annual_leave_days",     label: "ลาพักผ่อน" },
  { key: "maternity_leave_days",  label: "ลาคลอด" },
  { key: "paternity_leave_days",  label: "ลาบิดา" },
  { key: "religious_leave_days",  label: "ลาบวช" },
  { key: "military_leave_days",   label: "ลาทหาร" },
  { key: "training_leave_days",   label: "ลาอบรม" },
  { key: "ow_leave_days",         label: "ลา อว." },
  { key: "accompany_leave_days",  label: "ลาติดตาม" },
  { key: "rehab_leave_days",      label: "ลาฟื้นฟู" },
  { key: "absent_days",           label: "ขาดงาน" },
  { key: "total_days",            label: "รวม" },
]

export default function HRLeaveRegisterTab() {
  const [fiscalYear, setFiscalYear] = useState(currentFiscalYear())
  const [rows,       setRows]       = useState([])
  const [loading,    setLoading]    = useState(false)
  const [error,      setError]      = useState("")

  const [pdfLoading, setPdfLoading] = useState({})
  const [pdfErr,     setPdfErr]     = useState("")

  const fetchSummary = useCallback(() => {
    setLoading(true)
    setError("")
    apiAuth(`/hr/leave/annual-summary?fiscal_year=${fiscalYear}`)
      .then(setRows)
      .catch((e) => setError(e.message || "โหลดข้อมูลไม่สำเร็จ"))
      .finally(() => setLoading(false))
  }, [fiscalYear])

  useEffect(() => { fetchSummary() }, [fetchSummary])

  const downloadPdf = async (type) => {
    // type: "summary" | "register"
    setPdfLoading((p) => ({ ...p, [type]: true }))
    setPdfErr("")
    try {
      const ep = type === "summary" ? "annual-summary-pdf" : "register-pdf"
      const { blob, filename } = await apiDownload(`/hr/leave/${ep}?fiscal_year=${fiscalYear}`)
      const url = URL.createObjectURL(blob)
      const a = document.createElement("a")
      a.href = url
      a.download = filename || `leave-${type}-${fiscalYear}.pdf`
      a.click()
      URL.revokeObjectURL(url)
    } catch (e) {
      setPdfErr(`❌ ${e.message || "ดาวน์โหลดไม่สำเร็จ"}`)
    } finally {
      setPdfLoading((p) => ({ ...p, [type]: false }))
    }
  }

  return (
    <div className="space-y-4">
      {/* Filter bar */}
      <div className="rounded-2xl bg-white dark:bg-gray-800 ring-1 ring-gray-200/70 dark:ring-gray-700/70 shadow-sm p-4 flex flex-wrap items-end gap-3">
        <div>
          <label className="text-xs font-medium text-gray-600 dark:text-gray-400 block mb-1">ปีงบประมาณ (พ.ศ.)</label>
          <input
            type="number"
            value={fiscalYear}
            onChange={(e) => setFiscalYear(Number(e.target.value))}
            min={2560}
            max={2580}
            className="w-28 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-3 py-2 text-sm text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-indigo-500/60"
          />
        </div>
        <button onClick={fetchSummary} className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-semibold transition cursor-pointer">
          ค้นหา
        </button>
        <button
          onClick={() => downloadPdf("summary")}
          disabled={pdfLoading["summary"]}
          className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-sm font-semibold transition disabled:opacity-60 cursor-pointer"
        >
          {pdfLoading["summary"] ? "..." : "📄 สรุปประจำปี"}
        </button>
        <button
          onClick={() => downloadPdf("register")}
          disabled={pdfLoading["register"]}
          className="px-4 py-2 rounded-xl bg-purple-600 hover:bg-purple-500 text-white text-sm font-semibold transition disabled:opacity-60 cursor-pointer"
        >
          {pdfLoading["register"] ? "กำลังสร้าง PDF..." : "📋 ทะเบียนการลา (รายบุคคล)"}
        </button>
      </div>
      {pdfErr && (
        <div className="rounded-xl bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 px-4 py-3 text-sm text-red-700 dark:text-red-300">{pdfErr}</div>
      )}

      {error && (
        <div className="rounded-xl bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 px-4 py-3 text-sm text-red-700 dark:text-red-300">{error}</div>
      )}

      {loading ? (
        <div className="flex justify-center py-16">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-gray-200 border-t-indigo-500 dark:border-gray-700 dark:border-t-indigo-400" />
        </div>
      ) : rows.length === 0 ? (
        <div className="rounded-2xl bg-white dark:bg-gray-800 ring-1 ring-gray-200/70 dark:ring-gray-700/70 shadow-sm p-12 text-center">
          <p className="text-3xl mb-3">📅</p>
          <p className="text-sm text-gray-500 dark:text-gray-400">ไม่มีข้อมูลการลาในปีงบประมาณ {fiscalYear}</p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-2xl bg-white dark:bg-gray-800 ring-1 ring-gray-200/70 dark:ring-gray-700/70 shadow-sm">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200 dark:border-gray-700">
                <th className="text-left text-xs font-semibold text-gray-500 dark:text-gray-400 px-3 py-3 whitespace-nowrap sticky left-0 bg-white dark:bg-gray-800">ชื่อ-สกุล</th>
                <th className="text-left text-xs font-semibold text-gray-500 dark:text-gray-400 px-3 py-3 whitespace-nowrap">รหัสเดิม</th>
                <th className="text-left text-xs font-semibold text-gray-500 dark:text-gray-400 px-3 py-3 whitespace-nowrap">ตำแหน่ง</th>
                <th className="text-left text-xs font-semibold text-gray-500 dark:text-gray-400 px-3 py-3 whitespace-nowrap">สาขา</th>
                {LEAVE_COLS.map((c) => (
                  <th key={c.key} className="text-center text-xs font-semibold text-gray-500 dark:text-gray-400 px-2 py-3 whitespace-nowrap">{c.label}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row, i) => (
                <tr key={row.user_id} className={i % 2 === 1 ? "bg-gray-50 dark:bg-gray-700/30" : ""}>
                  <td className="px-3 py-2 font-medium text-gray-900 dark:text-gray-100 whitespace-nowrap sticky left-0 bg-inherit">{row.full_name}</td>
                  <td className="px-3 py-2 text-gray-500 dark:text-gray-400 text-xs">{row.legacy_user_id ?? "—"}</td>
                  <td className="px-3 py-2 text-gray-700 dark:text-gray-300">{row.position_title ?? "—"}</td>
                  <td className="px-3 py-2 text-gray-700 dark:text-gray-300 whitespace-nowrap">{row.branch_name}</td>
                  {LEAVE_COLS.map((c) => (
                    <td key={c.key} className={`px-2 py-2 text-center ${c.key === "total_days" ? "font-bold text-indigo-700 dark:text-indigo-300" : "text-gray-700 dark:text-gray-300"} ${row[c.key] > 0 && c.key !== "total_days" ? "text-amber-600 dark:text-amber-400 font-medium" : ""}`}>
                      {row[c.key] > 0 ? row[c.key] : ""}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <p className="text-xs text-gray-400 dark:text-gray-500 text-center">
        ปีงบประมาณ {fiscalYear} (1 เม.ย. {fiscalYear - 543} — 31 มี.ค. {fiscalYear - 542}) • นับเฉพาะวันลาที่อนุมัติแล้ว
      </p>
    </div>
  )
}
