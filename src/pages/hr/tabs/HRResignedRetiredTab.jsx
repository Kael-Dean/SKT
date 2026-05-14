// src/pages/hr/tabs/HRResignedRetiredTab.jsx
// 13D — Resigned/Retired Staff: list + filter + PDF
import { useEffect, useState, useCallback } from "react"
import { apiAuth, apiDownload } from "../../../lib/api"

const EXIT_TYPE_OPTIONS = [
  { value: "",        label: "ทั้งหมด" },
  { value: "resign",  label: "ลาออก" },
  { value: "dismiss", label: "ไล่ออก" },
  { value: "retire",  label: "เกษียณอายุ" },
]

const EXIT_TYPE_LABEL = { resign: "ลาออก", dismiss: "ไล่ออก", retire: "เกษียณอายุ" }
const EXIT_TYPE_COLOR  = {
  resign:  "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300",
  dismiss: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300",
  retire:  "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300",
}

function fmtBE(d) {
  return d || "—"
}

export default function HRResignedRetiredTab() {
  const [exitType,   setExitType]   = useState("")
  const [fromDate,   setFromDate]   = useState("")
  const [toDate,     setToDate]     = useState("")
  const [rows,       setRows]       = useState([])
  const [loading,    setLoading]    = useState(false)
  const [error,      setError]      = useState("")
  const [pdfLoading, setPdfLoading] = useState(false)
  const [pdfErr,     setPdfErr]     = useState("")

  const buildQs = useCallback(() => {
    const p = new URLSearchParams()
    if (exitType) p.set("exit_type", exitType)
    if (fromDate) p.set("from_date", fromDate)
    if (toDate)   p.set("to_date", toDate)
    return p.toString()
  }, [exitType, fromDate, toDate])

  const fetchRows = useCallback(() => {
    setLoading(true)
    setError("")
    const qs = buildQs()
    apiAuth(`/hr/reports/resigned-retired${qs ? "?" + qs : ""}`)
      .then(setRows)
      .catch((e) => setError(e.message || "โหลดข้อมูลไม่สำเร็จ"))
      .finally(() => setLoading(false))
  }, [buildQs])

  useEffect(() => { fetchRows() }, [fetchRows])

  const downloadPdf = async () => {
    setPdfLoading(true)
    setPdfErr("")
    try {
      const qs = buildQs()
      const { blob, filename } = await apiDownload(`/hr/reports/resigned-retired-pdf${qs ? "?" + qs : ""}`)
      const url = URL.createObjectURL(blob)
      const a = document.createElement("a")
      a.href = url
      a.download = filename || "resigned-retired.pdf"
      a.click()
      URL.revokeObjectURL(url)
    } catch (e) {
      setPdfErr(`❌ ${e.message || "ดาวน์โหลดไม่สำเร็จ"}`)
    } finally {
      setPdfLoading(false)
    }
  }

  return (
    <div className="space-y-4">
      {/* Filter bar */}
      <div className="rounded-2xl bg-white dark:bg-gray-800 ring-1 ring-gray-200/70 dark:ring-gray-700/70 shadow-sm p-4 flex flex-wrap items-end gap-3">
        <div>
          <label className="text-xs font-medium text-gray-600 dark:text-gray-400 block mb-1">ประเภทการออก</label>
          <select
            value={exitType}
            onChange={(e) => setExitType(e.target.value)}
            className="w-36 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-3 py-2 text-sm text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-indigo-500/60"
          >
            {EXIT_TYPE_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="text-xs font-medium text-gray-600 dark:text-gray-400 block mb-1">ตั้งแต่วันที่</label>
          <input type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)}
            className="w-36 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-3 py-2 text-sm text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-indigo-500/60" />
        </div>
        <div>
          <label className="text-xs font-medium text-gray-600 dark:text-gray-400 block mb-1">ถึงวันที่</label>
          <input type="date" value={toDate} onChange={(e) => setToDate(e.target.value)}
            className="w-36 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-3 py-2 text-sm text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-indigo-500/60" />
        </div>
        <button onClick={fetchRows} className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-semibold transition cursor-pointer">
          ค้นหา
        </button>
        <button
          onClick={downloadPdf}
          disabled={pdfLoading}
          className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-sm font-semibold transition disabled:opacity-60 cursor-pointer"
        >
          {pdfLoading ? "กำลังสร้าง..." : "📄 ดาวน์โหลด PDF"}
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
          <p className="text-3xl mb-3">👋</p>
          <p className="text-sm text-gray-500 dark:text-gray-400">ไม่มีรายการพนักงานที่ลาออก / เกษียณ / ไล่ออก</p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-2xl bg-white dark:bg-gray-800 ring-1 ring-gray-200/70 dark:ring-gray-700/70 shadow-sm">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200 dark:border-gray-700">
                {["ชื่อ-สกุล", "รหัสเดิม", "รหัสประจำตัว", "วันเกิด", "การศึกษา", "ตำแหน่ง", "สาขา", "วันบรรจุ", "วันที่ออก", "ประเภท"].map((h) => (
                  <th key={h} className="text-left text-xs font-semibold text-gray-500 dark:text-gray-400 px-3 py-3 whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row, i) => (
                <tr key={row.user_id} className={i % 2 === 1 ? "bg-gray-50 dark:bg-gray-700/30" : ""}>
                  <td className="px-3 py-2 font-medium text-gray-900 dark:text-gray-100 whitespace-nowrap">{row.full_name}</td>
                  <td className="px-3 py-2 text-gray-500 dark:text-gray-400 text-xs">{row.legacy_user_id ?? "—"}</td>
                  <td className="px-3 py-2 text-gray-500 dark:text-gray-400 font-mono text-xs">{row.cid_masked}</td>
                  <td className="px-3 py-2 text-gray-600 dark:text-gray-400 whitespace-nowrap">{fmtBE(row.birthday)}</td>
                  <td className="px-3 py-2 text-gray-700 dark:text-gray-300">{row.education_level ?? "—"}</td>
                  <td className="px-3 py-2 text-gray-700 dark:text-gray-300">{row.position_title ?? "—"}</td>
                  <td className="px-3 py-2 text-gray-700 dark:text-gray-300 whitespace-nowrap">{row.branch_name}</td>
                  <td className="px-3 py-2 text-gray-600 dark:text-gray-400 whitespace-nowrap">{fmtBE(row.hired_date)}</td>
                  <td className="px-3 py-2 text-gray-600 dark:text-gray-400 whitespace-nowrap">{fmtBE(row.exit_date)}</td>
                  <td className="px-3 py-2 whitespace-nowrap">
                    {row.exit_type ? (
                      <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${EXIT_TYPE_COLOR[row.exit_type] ?? "bg-gray-100 text-gray-600"}`}>
                        {EXIT_TYPE_LABEL[row.exit_type] ?? row.exit_type}
                      </span>
                    ) : (
                      <span className="text-gray-400 text-xs">—</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <p className="text-xs text-gray-400 dark:text-gray-500 text-right">รวม {rows.length} รายการ</p>
    </div>
  )
}
