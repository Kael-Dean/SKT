// src/pages/hr/tabs/HRRelocationHistoryTab.jsx
// 13B — Org-wide Relocation History: list + filter + PDF
// 13F (HR side) — ดู detail + ดาวน์โหลด PDF ฟอร์มย้ายสาขา
import { useEffect, useState, useCallback } from "react"
import { apiAuth, apiDownload } from "../../../lib/api"
import Portal from "../../../components/Portal"

function fmtBE(d) {
  // วันที่จาก BE มาเป็น "DD/MM/BBBB" แล้ว — แสดงตรงๆ
  return d || "—"
}

export default function HRRelocationHistoryTab() {
  const [subTab, setSubTab] = useState("history")  // "history" | "requests"

  // ─── 13B: Relocation History ────────────────────────────────────
  const [history,      setHistory]      = useState([])
  const [histLoading,  setHistLoading]  = useState(false)
  const [histError,    setHistError]    = useState("")
  const [fromDate,     setFromDate]     = useState("")
  const [toDate,       setToDate]       = useState("")
  const [pdfLoading,   setPdfLoading]   = useState(false)
  const [pdfErr,       setPdfErr]       = useState("")

  const fetchHistory = useCallback(() => {
    setHistLoading(true)
    setHistError("")
    const params = new URLSearchParams()
    if (fromDate) params.set("from_date", fromDate)
    if (toDate)   params.set("to_date", toDate)
    const qs = params.toString()
    apiAuth(`/hr/reports/relocation-history${qs ? "?" + qs : ""}`)
      .then(setHistory)
      .catch((e) => setHistError(e.message || "โหลดข้อมูลไม่สำเร็จ"))
      .finally(() => setHistLoading(false))
  }, [fromDate, toDate])

  useEffect(() => { if (subTab === "history") fetchHistory() }, [subTab, fetchHistory])

  const downloadHistoryPdf = async () => {
    setPdfLoading(true)
    setPdfErr("")
    try {
      const params = new URLSearchParams()
      if (fromDate) params.set("from_date", fromDate)
      if (toDate)   params.set("to_date", toDate)
      const qs = params.toString()
      const { blob, filename } = await apiDownload(`/hr/reports/relocation-history-pdf${qs ? "?" + qs : ""}`)
      const url = URL.createObjectURL(blob)
      const a = document.createElement("a")
      a.href = url
      a.download = filename || "relocation-history.pdf"
      a.click()
      URL.revokeObjectURL(url)
    } catch (e) {
      setPdfErr(`❌ ${e.message || "ดาวน์โหลดไม่สำเร็จ"}`)
    } finally {
      setPdfLoading(false)
    }
  }

  // ─── 13F: HR Relocation Requests detail + form PDF ───────────────
  const [reloRequests,   setReloRequests]   = useState([])
  const [reloLoading,    setReloLoading]    = useState(false)
  const [reloError,      setReloError]      = useState("")
  const [detailModal,    setDetailModal]    = useState(null)  // full RelocationRequestOut
  const [detailLoading,  setDetailLoading]  = useState(false)
  const [detailPdfLoad,  setDetailPdfLoad]  = useState(false)
  const [detailPdfErr,   setDetailPdfErr]   = useState("")

  const fetchReloRequests = useCallback(() => {
    setReloLoading(true)
    setReloError("")
    apiAuth("/hr/relocation-requests")
      .then(setReloRequests)
      .catch((e) => setReloError(e.message || "โหลดข้อมูลไม่สำเร็จ"))
      .finally(() => setReloLoading(false))
  }, [])

  useEffect(() => { if (subTab === "requests") fetchReloRequests() }, [subTab, fetchReloRequests])

  const openDetail = async (id) => {
    setDetailModal(null)
    setDetailLoading(true)
    setDetailPdfErr("")
    try {
      const data = await apiAuth(`/hr/relocation-requests/${id}`)
      setDetailModal(data)
    } catch (e) {
      setReloError(e.message || "โหลด detail ไม่สำเร็จ")
    } finally {
      setDetailLoading(false)
    }
  }

  const downloadFormPdf = async (id) => {
    setDetailPdfLoad(true)
    setDetailPdfErr("")
    try {
      const { blob, filename } = await apiDownload(`/hr/relocation-requests/${id}/form-pdf`)
      const url = URL.createObjectURL(blob)
      const a = document.createElement("a")
      a.href = url
      a.download = filename || `relocation_form_${id}.pdf`
      a.click()
      URL.revokeObjectURL(url)
    } catch (e) {
      setDetailPdfErr(`❌ ${e.message || "ดาวน์โหลดไม่สำเร็จ"}`)
    } finally {
      setDetailPdfLoad(false)
    }
  }

  const FAMILY_STATUS_LABEL = { alive: "ยังมีชีวิต", deceased: "เสียชีวิตแล้ว" }
  const fmtFamStatus = (s) => FAMILY_STATUS_LABEL[s] ?? (s || "—")

  return (
    <div className="space-y-4">
      {/* Sub-tabs */}
      <div className="flex gap-1 rounded-xl bg-gray-100 dark:bg-gray-800 p-1 w-fit">
        {[["history", "📋 ประวัติการย้าย"], ["requests", "📂 คำขอย้ายสาขา"]].map(([v, label]) => (
          <button
            key={v}
            onClick={() => setSubTab(v)}
            className={`px-4 py-2 rounded-lg text-sm font-semibold transition-all cursor-pointer ${
              subTab === v
                ? "bg-white dark:bg-gray-700 text-indigo-700 dark:text-indigo-300 shadow-sm"
                : "text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {/* ─── 13B: History ─── */}
      {subTab === "history" && (
        <div className="space-y-3">
          <div className="rounded-2xl bg-white dark:bg-gray-800 ring-1 ring-gray-200/70 dark:ring-gray-700/70 shadow-sm p-4 space-y-3">
            <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">กรองข้อมูล</p>
            <div className="flex gap-3 flex-wrap">
              <div className="flex-1 min-w-32">
                <label className="text-xs text-gray-500 dark:text-gray-400 block mb-1">ตั้งแต่วันที่</label>
                <input type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)}
                  className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-3 py-2 text-sm text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-indigo-500/60" />
              </div>
              <div className="flex-1 min-w-32">
                <label className="text-xs text-gray-500 dark:text-gray-400 block mb-1">ถึงวันที่</label>
                <input type="date" value={toDate} onChange={(e) => setToDate(e.target.value)}
                  className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-3 py-2 text-sm text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-indigo-500/60" />
              </div>
              <div className="flex items-end gap-2">
                <button onClick={fetchHistory} className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-semibold transition cursor-pointer">
                  ค้นหา
                </button>
                <button
                  onClick={downloadHistoryPdf}
                  disabled={pdfLoading}
                  className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-sm font-semibold transition disabled:opacity-60 cursor-pointer"
                >
                  {pdfLoading ? "..." : "📄 PDF"}
                </button>
              </div>
            </div>
            {pdfErr && <p className="text-xs text-red-600 dark:text-red-400">{pdfErr}</p>}
          </div>

          {histError && (
            <div className="rounded-xl bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 px-4 py-3 text-sm text-red-700 dark:text-red-300">{histError}</div>
          )}

          {histLoading ? (
            <div className="flex justify-center py-16">
              <div className="h-8 w-8 animate-spin rounded-full border-2 border-gray-200 border-t-indigo-500" />
            </div>
          ) : history.length === 0 ? (
            <div className="rounded-2xl bg-white dark:bg-gray-800 ring-1 ring-gray-200/70 dark:ring-gray-700/70 shadow-sm p-12 text-center">
              <p className="text-3xl mb-3">🚌</p>
              <p className="text-sm text-gray-500 dark:text-gray-400">ไม่มีประวัติการย้ายสาขา</p>
            </div>
          ) : (
            <div className="overflow-x-auto rounded-2xl bg-white dark:bg-gray-800 ring-1 ring-gray-200/70 dark:ring-gray-700/70 shadow-sm">
              <table className="min-w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-200 dark:border-gray-700">
                    {["ชื่อ-สกุล", "รหัสประจำตัว", "วันที่บรรจุ", "วันที่ย้าย", "ตำแหน่ง", "สาขา", "คำสั่ง", "เหตุผล"].map((h) => (
                      <th key={h} className="text-left text-xs font-semibold text-gray-500 dark:text-gray-400 px-3 py-3 whitespace-nowrap">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {history.map((row, i) => (
                    <tr key={row.id} className={i % 2 === 1 ? "bg-gray-50 dark:bg-gray-700/30" : ""}>
                      <td className="px-3 py-2 font-medium text-gray-900 dark:text-gray-100 whitespace-nowrap">{row.full_name}</td>
                      <td className="px-3 py-2 text-gray-600 dark:text-gray-400 font-mono text-xs">{row.cid_masked}</td>
                      <td className="px-3 py-2 text-gray-700 dark:text-gray-300 whitespace-nowrap">{fmtBE(row.hired_date)}</td>
                      <td className="px-3 py-2 text-gray-700 dark:text-gray-300 whitespace-nowrap">{fmtBE(row.transfer_date)}</td>
                      <td className="px-3 py-2 text-gray-700 dark:text-gray-300">{row.position_title ?? "—"}</td>
                      <td className="px-3 py-2 text-gray-700 dark:text-gray-300 whitespace-nowrap">{row.branch_name}</td>
                      <td className="px-3 py-2 text-gray-600 dark:text-gray-400 text-xs">{row.order_reference ?? "—"}</td>
                      <td className="px-3 py-2 text-gray-600 dark:text-gray-400 max-w-xs truncate">{row.reason ?? "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ─── 13F: Requests ─── */}
      {subTab === "requests" && (
        <div className="space-y-3">
          {reloError && (
            <div className="rounded-xl bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 px-4 py-3 text-sm text-red-700 dark:text-red-300">{reloError}</div>
          )}
          {reloLoading ? (
            <div className="flex justify-center py-16">
              <div className="h-8 w-8 animate-spin rounded-full border-2 border-gray-200 border-t-indigo-500" />
            </div>
          ) : reloRequests.length === 0 ? (
            <div className="rounded-2xl bg-white dark:bg-gray-800 ring-1 ring-gray-200/70 dark:ring-gray-700/70 shadow-sm p-12 text-center">
              <p className="text-3xl mb-3">📂</p>
              <p className="text-sm text-gray-500 dark:text-gray-400">ไม่มีคำขอย้ายสาขา</p>
            </div>
          ) : (
            <div className="space-y-2">
              {detailLoading && (
                <div className="flex justify-center py-4">
                  <div className="h-6 w-6 animate-spin rounded-full border-2 border-gray-200 border-t-indigo-500" />
                </div>
              )}
              {reloRequests.map((r) => (
                <div key={r.id} className="rounded-2xl bg-white dark:bg-gray-800 ring-1 ring-gray-200/70 dark:ring-gray-700/70 shadow-sm p-4 flex items-center justify-between gap-3">
                  <div>
                    <p className="font-semibold text-gray-900 dark:text-gray-100">{r.user_first_name} {r.user_last_name}</p>
                    <p className="text-xs text-gray-400 dark:text-gray-500">{r.branch_name ?? r.requested_branch_name}</p>
                  </div>
                  <button
                    onClick={() => openDetail(r.id)}
                    className="px-3 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold transition cursor-pointer"
                  >
                    ดูรายละเอียด
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ─── Detail Modal ─── */}
      {detailModal && (
        <Portal>
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm overflow-y-auto">
            <div className="w-full max-w-lg rounded-2xl bg-white dark:bg-gray-800 shadow-2xl p-6 space-y-4 my-4">
              <div className="flex items-start justify-between gap-3">
                <h3 className="text-lg font-bold text-gray-900 dark:text-gray-100">
                  {detailModal.user_first_name} {detailModal.user_last_name}
                </h3>
                <button onClick={() => setDetailModal(null)} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 cursor-pointer text-xl leading-none">×</button>
              </div>

              {/* Branch prefs */}
              <div>
                <p className="text-xs font-semibold text-indigo-700 dark:text-indigo-300 uppercase tracking-wide mb-2">สาขาที่ต้องการ</p>
                <div className="flex flex-wrap gap-2">
                  {[1,2,3,4,5].map((n) => detailModal[`branch_pref_${n}`] && (
                    <span key={n} className="rounded-full bg-indigo-100 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300 text-xs px-2.5 py-1 font-medium">
                      {n}. {detailModal[`branch_pref_${n}`]}
                    </span>
                  ))}
                </div>
              </div>

              {/* Position prefs */}
              {[1,2,3,4,5].some((n) => detailModal[`position_pref_${n}`]) && (
                <div>
                  <p className="text-xs font-semibold text-indigo-700 dark:text-indigo-300 uppercase tracking-wide mb-2">ตำแหน่งที่ต้องการ</p>
                  <div className="flex flex-wrap gap-2">
                    {[1,2,3,4,5].map((n) => detailModal[`position_pref_${n}`] && (
                      <span key={n} className="rounded-full bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 text-xs px-2.5 py-1 font-medium">
                        {n}. รหัส {detailModal[`position_pref_${n}`]}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Reasons */}
              {(detailModal.reason || detailModal.reason_2 || detailModal.reason_3) && (
                <div>
                  <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-2">เหตุผล</p>
                  <ul className="space-y-1 text-sm text-gray-800 dark:text-gray-200">
                    {[detailModal.reason, detailModal.reason_2, detailModal.reason_3].filter(Boolean).map((r, i) => (
                      <li key={i} className="flex gap-2"><span className="text-gray-400">•</span>{r}</li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Family */}
              {detailModal.family_address && (
                <div>
                  <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-2">ข้อมูลครอบครัว</p>
                  <div className="text-sm space-y-1 text-gray-700 dark:text-gray-300">
                    <p>ที่อยู่ครอบครัว: {detailModal.family_address}</p>
                    {detailModal.family_father_status && <p>บิดา: {fmtFamStatus(detailModal.family_father_status)}{detailModal.family_father_province ? ` — จ.${detailModal.family_father_province}` : ""}</p>}
                    {detailModal.family_mother_status && <p>มารดา: {fmtFamStatus(detailModal.family_mother_status)}{detailModal.family_mother_province ? ` — จ.${detailModal.family_mother_province}` : ""}</p>}
                    {detailModal.family_spouse_status && <p>คู่สมรส: {fmtFamStatus(detailModal.family_spouse_status)}{detailModal.family_spouse_province ? ` — จ.${detailModal.family_spouse_province}` : ""}</p>}
                    {detailModal.children_count != null && <p>บุตร: {detailModal.children_count} คน (อยู่กับตนเอง {detailModal.children_with_self})</p>}
                  </div>
                </div>
              )}

              {detailPdfErr && <p className="text-xs text-red-600 dark:text-red-400">{detailPdfErr}</p>}

              <div className="flex gap-3 pt-2">
                <button onClick={() => setDetailModal(null)} className="flex-1 h-10 rounded-xl border border-gray-300 dark:border-gray-600 text-sm font-semibold text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700 transition cursor-pointer">
                  ปิด
                </button>
                <button
                  onClick={() => downloadFormPdf(detailModal.id)}
                  disabled={detailPdfLoad}
                  className="flex-1 h-10 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-sm font-semibold transition disabled:opacity-60 cursor-pointer"
                >
                  {detailPdfLoad ? "กำลังดาวน์โหลด..." : "📄 ดาวน์โหลด PDF"}
                </button>
              </div>
            </div>
          </div>
        </Portal>
      )}
    </div>
  )
}
