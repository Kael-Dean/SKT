// src/pages/hr/tabs/HRResignedRetiredTab.jsx
// 13D — Resigned/Retired Staff: list + filter + PDF
import { useEffect, useState, useCallback } from "react"
import { apiAuth, apiDownload } from "../../../lib/api"
import { SkeletonTableRows, ErrorState, EmptyState, Badge } from "../../../components/ui"

const TABLE_HEADERS = ["ชื่อ-สกุล", "รหัสเดิม", "รหัสประจำตัว", "วันเกิด", "การศึกษา", "ตำแหน่ง", "สาขา", "วันบรรจุ", "วันที่ออก", "ประเภท"]

// 'success' tone reuses emerald (retire); resign keeps its amber 'pending' tone;
// dismiss keeps 'danger'. exit-type colors carry more meaning than the 5 tones,
// so map each to the closest Badge tone.
const EXIT_TYPE_TONE = { resign: "pending", dismiss: "danger", retire: "success" }

const EXIT_TYPE_OPTIONS = [
  { value: "",        label: "ทั้งหมด" },
  { value: "resign",  label: "ลาออก" },
  { value: "dismiss", label: "ไล่ออก" },
  { value: "retire",  label: "เกษียณอายุ" },
]

const EXIT_TYPE_LABEL = { resign: "ลาออก", dismiss: "ไล่ออก", retire: "เกษียณอายุ" }

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
      setPdfErr(e.message || "ดาวน์โหลดไม่สำเร็จ")
    } finally {
      setPdfLoading(false)
    }
  }

  const hasFilters = !!(exitType || fromDate || toDate)
  const clearFilters = () => {
    setExitType("")
    setFromDate("")
    setToDate("")
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
        <button onClick={fetchRows} className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-semibold transition duration-200 cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-1 dark:focus-visible:ring-offset-gray-800">
          ค้นหา
        </button>
        <button
          onClick={downloadPdf}
          disabled={pdfLoading}
          className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-sm font-semibold transition duration-200 disabled:opacity-60 cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-rose-500 focus-visible:ring-offset-1 dark:focus-visible:ring-offset-gray-800"
        >
          {pdfLoading ? (
            <>
              <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white" aria-hidden="true" />
              กำลังสร้าง...
            </>
          ) : (
            <>
              <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="size-4">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                <path d="M14 2v6h6" />
              </svg>
              ดาวน์โหลด PDF
            </>
          )}
        </button>
      </div>

      {pdfErr && <ErrorState message={pdfErr} />}

      {error ? (
        <ErrorState message={error} onRetry={fetchRows} />
      ) : !loading && rows.length === 0 ? (
        <EmptyState
          icon={
            <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="size-12">
              <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
              <circle cx="9" cy="7" r="4" />
              <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
              <path d="M16 3.13a4 4 0 0 1 0 7.75" />
            </svg>
          }
          title={hasFilters ? "ไม่พบรายการตามตัวกรอง" : "ยังไม่มีรายการพนักงานที่ออกจากงาน"}
          description={hasFilters ? "ลองปรับช่วงวันที่หรือประเภทการออก" : "รายการพนักงานที่ลาออก / เกษียณ / ไล่ออก จะแสดงที่นี่"}
          action={hasFilters ? (
            <button
              type="button"
              onClick={clearFilters}
              className="inline-flex items-center gap-1.5 rounded-2xl border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 shadow-sm transition duration-200 hover:bg-slate-100 cursor-pointer dark:border-slate-600 dark:bg-slate-700/60 dark:text-white dark:hover:bg-slate-700/50 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-1 dark:focus-visible:ring-offset-gray-800"
            >
              ล้างตัวกรอง
            </button>
          ) : undefined}
        />
      ) : (
        <div className="overflow-x-auto rounded-2xl bg-white dark:bg-gray-800 ring-1 ring-gray-200/70 dark:ring-gray-700/70 shadow-sm">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200 dark:border-gray-700">
                {TABLE_HEADERS.map((h) => (
                  <th key={h} className="text-left text-xs font-semibold text-gray-500 dark:text-gray-400 px-3 py-3 whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody aria-busy={loading}>
              {loading ? (
                <SkeletonTableRows rows={8} cols={TABLE_HEADERS.length} />
              ) : (
                rows.map((row, i) => (
                  <tr key={row.user_id} className={i % 2 === 1 ? "bg-gray-50 dark:bg-gray-700/30" : ""}>
                    <td className="px-3 py-2 font-medium text-gray-900 dark:text-gray-100 whitespace-nowrap">{row.full_name}</td>
                    <td className="px-3 py-2 text-gray-500 dark:text-gray-400 text-xs tabular-nums">{row.legacy_user_id ?? "—"}</td>
                    <td className="px-3 py-2 text-gray-500 dark:text-gray-400 font-mono text-xs tabular-nums">{row.cid_masked}</td>
                    <td className="px-3 py-2 text-gray-600 dark:text-gray-400 whitespace-nowrap tabular-nums">{fmtBE(row.birthday)}</td>
                    <td className="px-3 py-2 text-gray-700 dark:text-gray-300">{row.education_level ?? "—"}</td>
                    <td className="px-3 py-2 text-gray-700 dark:text-gray-300">{row.position_title ?? "—"}</td>
                    <td className="px-3 py-2 text-gray-700 dark:text-gray-300 whitespace-nowrap">{row.branch_name}</td>
                    <td className="px-3 py-2 text-gray-600 dark:text-gray-400 whitespace-nowrap tabular-nums">{fmtBE(row.hired_date)}</td>
                    <td className="px-3 py-2 text-gray-600 dark:text-gray-400 whitespace-nowrap tabular-nums">{fmtBE(row.exit_date)}</td>
                    <td className="px-3 py-2 whitespace-nowrap">
                      {row.exit_type ? (
                        <Badge tone={EXIT_TYPE_TONE[row.exit_type] ?? "neutral"}>
                          {EXIT_TYPE_LABEL[row.exit_type] ?? row.exit_type}
                        </Badge>
                      ) : (
                        <span className="text-gray-400 text-xs">—</span>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}
      <p className="text-xs text-gray-400 dark:text-gray-500 text-right tabular-nums">รวม {rows.length} รายการ</p>
    </div>
  )
}
