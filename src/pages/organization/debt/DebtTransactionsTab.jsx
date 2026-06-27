import { useEffect, useState } from "react"
import { apiAuth } from "../../../lib/api"
import Portal from "../../../components/Portal"
import SelectDropdown from "../../../components/SelectDropdown"
import {
  cx, baseField, modalCardCls, modalTitleCls,
  resetBtnCls, secondaryBtnCls, cardCls, badgeCls,
} from "../../../lib/styles"
import { SkeletonTableRows, ErrorState, EmptyState } from "../../../components/ui"
import { getHomeBranch } from "../../../lib/auth"
import DebtEntryModal from "./DebtEntryModal"
import {
  ENTRY_TYPES, ENTRY_META, ENTRY_BADGE_CLS, entryLabel,
  PM_LABEL, canWriteEntries, ROLE_GENERAL_STAFF,
} from "./debtEntryMeta"

// Column count for the entries table — keep in sync with the header below.
const TX_COLS = 9

const fmtMoney = (v) =>
  new Intl.NumberFormat("th-TH", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(parseFloat(v) || 0)

export default function DebtTransactionsTab({ roleId, branches, programs, fiscalYears }) {
  const canWrite = canWriteEntries(roleId)
  const isGeneralStaff = roleId === ROLE_GENERAL_STAFF
  const homeBranch = getHomeBranch()

  const [entries, setEntries]   = useState([])
  const [loading, setLoading]   = useState(false)
  const [error, setError]       = useState("")
  const [reloadKey, setReloadKey] = useState(0)

  const [typeFilter, setTypeFilter] = useState("")
  const [dateFrom, setDateFrom]     = useState("")
  const [dateTo, setDateTo]         = useState("")

  const [modal, setModal]     = useState(null) // {mode:'add'|'edit'|'delete', record?}
  const [deleting, setDeleting] = useState(false)
  const [deleteMsg, setDeleteMsg] = useState("")

  useEffect(() => {
    let alive = true
    setLoading(true)
    setError("")
    ;(async () => {
      try {
        const params = new URLSearchParams()
        if (typeFilter) params.set("entry_type", typeFilter)
        if (dateFrom)   params.set("date_from", dateFrom)
        if (dateTo)     params.set("date_to", dateTo)
        const data = await apiAuth(`/debt/entries${params.toString() ? "?" + params.toString() : ""}`)
        if (alive) setEntries(Array.isArray(data) ? data.filter((r) => r.is_active !== false) : [])
      } catch (e) {
        if (alive) setError(e.message || "โหลดข้อมูลไม่สำเร็จ")
      } finally {
        if (alive) setLoading(false)
      }
    })()
    return () => { alive = false }
  }, [typeFilter, dateFrom, dateTo, reloadKey])

  function refetch() { setReloadKey((k) => k + 1) }

  function branchName(id) { return branches.find((b) => b.id === Number(id))?.name || `สาขา ${id}` }
  function programName(id) { return programs.find((p) => p.id === Number(id))?.prog_name || `โครงการ ${id}` }
  function fyName(id) { return fiscalYears.find((y) => y.id === Number(id))?.year_name || String(id) }

  // Role 5 may only edit/delete entries on their own branch; role 1 unrestricted.
  function canMutate(rec) {
    if (!canWrite) return false
    if (isGeneralStaff) return homeBranch != null && Number(rec.branch_id) === Number(homeBranch)
    return true
  }

  async function handleDelete() {
    setDeleting(true); setDeleteMsg("")
    try {
      await apiAuth(`/debt/entries/${modal.record.id}`, { method: "DELETE" })
      setEntries((prev) => prev.filter((r) => r.id !== modal.record.id))
      setModal(null)
    } catch (e) {
      setDeleteMsg(e.message || "ลบไม่สำเร็จ")
    } finally {
      setDeleting(false)
    }
  }

  const typeFilterOpts = [
    { value: "", label: "ทุกประเภท" },
    ...ENTRY_TYPES.map((t) => ({ value: t, label: entryLabel(t) })),
  ]

  const hasFilters = typeFilter || dateFrom || dateTo
  const addBranchLock = isGeneralStaff && homeBranch != null
    ? { id: homeBranch, name: branchName(homeBranch) }
    : null

  return (
    <div className="space-y-4">
      {/* Filter bar */}
      <div className={cx(cardCls, "p-4")}>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <div>
            <label className="mb-1 block text-xs font-medium text-gray-500 dark:text-gray-400">ประเภท</label>
            <SelectDropdown options={typeFilterOpts} value={typeFilter} onChange={setTypeFilter} />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-gray-500 dark:text-gray-400">วันที่เริ่ม</label>
            <input type="date" className={baseField} value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-gray-500 dark:text-gray-400">วันที่สิ้นสุด</label>
            <input type="date" className={baseField} value={dateTo} onChange={(e) => setDateTo(e.target.value)} />
          </div>
        </div>
        {hasFilters && (
          <div className="mt-3 flex justify-end">
            <button
              onClick={() => { setTypeFilter(""); setDateFrom(""); setDateTo("") }}
              className="rounded-xl px-3 py-1.5 text-sm text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-700 cursor-pointer transition-colors"
            >
              ล้างตัวกรอง
            </button>
          </div>
        )}
      </div>

      <div className="flex items-center justify-between">
        <p className="text-sm text-gray-500 dark:text-gray-400">
          {loading ? "กำลังโหลด…" : `พบ ${entries.length} รายการ`}
        </p>
        {canWrite && (
          <button onClick={() => setModal({ mode: "add" })} className={cx(secondaryBtnCls, "!py-2 !px-4 !text-sm cursor-pointer")}>
            + บันทึกรายการหนี้
          </button>
        )}
      </div>

      {error && !loading && (
        <ErrorState message={error} onRetry={refetch} />
      )}

      {!error && !loading && entries.length === 0 ? (
        <div className={cx(cardCls, "overflow-hidden")}>
          <EmptyState
            title="ไม่พบรายการหนี้"
            description={
              hasFilters
                ? "ไม่มีรายการที่ตรงกับตัวกรอง — ลองล้างตัวกรองหรือเปลี่ยนช่วงวันที่"
                : "ยังไม่มีรายการหนี้ในระบบ — บันทึกยอดยกมา เพิ่มในปี หรือการชำระเพื่อเริ่มต้น"
            }
            action={
              hasFilters ? (
                <button
                  type="button"
                  onClick={() => { setTypeFilter(""); setDateFrom(""); setDateTo("") }}
                  className={cx(secondaryBtnCls, "!py-2 !px-4 !text-sm cursor-pointer")}
                >
                  ล้างตัวกรอง
                </button>
              ) : canWrite ? (
                <button
                  type="button"
                  onClick={() => setModal({ mode: "add" })}
                  className={cx(secondaryBtnCls, "!py-2 !px-4 !text-sm cursor-pointer")}
                >
                  + บันทึกรายการหนี้
                </button>
              ) : null
            }
          />
        </div>
      ) : !error ? (
        <div className={cx(cardCls, "overflow-hidden")}>
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/60">
                  {["วันที่", "ประเภท", "สาขา", "โครงการ", "ปีการผลิต", "วิธีชำระ", "จำนวน (บาท)", "ราย", "จัดการ"].map((h) => (
                    <th key={h} className={cx("px-4 py-3 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide whitespace-nowrap", (h === "จัดการ" || h === "จำนวน (บาท)" || h === "ราย") ? "text-right" : "text-left")}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-700/60">
                {loading ? (
                  <SkeletonTableRows rows={6} cols={TX_COLS} />
                ) : (
                  entries.map((e) => {
                    const meta = ENTRY_META[e.entry_type] || {}
                    return (
                      <tr key={e.id} className="hover:bg-gray-50 dark:hover:bg-gray-800/40 transition-colors">
                        <td className="px-4 py-3 text-gray-700 dark:text-gray-300 whitespace-nowrap">{e.entry_date}</td>
                        <td className="px-4 py-3 whitespace-nowrap">
                          <span className={cx(badgeCls, ENTRY_BADGE_CLS[meta.tone] || "bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300")}>
                            {entryLabel(e.entry_type)}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-gray-700 dark:text-gray-300 whitespace-nowrap">{branchName(e.branch_id)}</td>
                        <td className="px-4 py-3 text-gray-700 dark:text-gray-300 whitespace-nowrap">{programName(e.program_id)}</td>
                        <td className="px-4 py-3 text-gray-600 dark:text-gray-400 whitespace-nowrap">{fyName(e.fiscal_year_id)}</td>
                        <td className="px-4 py-3 text-gray-600 dark:text-gray-400 whitespace-nowrap">
                          {e.payment_method ? (PM_LABEL[e.payment_method] || e.payment_method) : "—"}
                        </td>
                        <td className="px-4 py-3 text-right tabular-nums font-semibold text-gray-900 dark:text-gray-100 whitespace-nowrap">
                          ฿{fmtMoney(e.amount)}
                          {e.payment_method === "produce_trade" && e.produce_weight && (
                            <span className="block text-xs font-normal text-gray-400 dark:text-gray-500">({e.produce_weight} กก.)</span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-right tabular-nums text-gray-600 dark:text-gray-400 whitespace-nowrap">
                          {e.count != null ? e.count : "—"}
                        </td>
                        <td className="px-4 py-3 text-right">
                          {canMutate(e) ? (
                            <div className="inline-flex items-center gap-2">
                              <button onClick={() => setModal({ mode: "edit", record: e })} className="rounded-lg px-3 py-1.5 text-xs font-medium text-indigo-600 hover:bg-indigo-50 dark:text-indigo-400 dark:hover:bg-indigo-900/20 transition-colors cursor-pointer">
                                แก้ไข
                              </button>
                              <button onClick={() => { setDeleteMsg(""); setModal({ mode: "delete", record: e }) }} className="rounded-lg px-3 py-1.5 text-xs font-medium text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-900/20 transition-colors cursor-pointer">
                                ลบ
                              </button>
                            </div>
                          ) : (
                            <span className="text-xs text-gray-300 dark:text-gray-600">—</span>
                          )}
                        </td>
                      </tr>
                    )
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      ) : null}

      {(modal?.mode === "add" || modal?.mode === "edit") && (
        <DebtEntryModal
          mode={modal.mode}
          record={modal.record}
          branches={branches}
          programs={programs}
          fiscalYears={fiscalYears}
          branchLock={modal.mode === "add" ? addBranchLock : null}
          onClose={() => setModal(null)}
          onSaved={refetch}
        />
      )}

      {modal?.mode === "delete" && (
        <Portal>
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
            <div className={cx(modalCardCls, "max-w-sm w-full")}>
              <h2 className={cx(modalTitleCls, "mb-2")}>ยืนยันลบรายการ</h2>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                ต้องการลบรายการ{" "}
                <span className={cx(badgeCls, ENTRY_BADGE_CLS[ENTRY_META[modal.record.entry_type]?.tone] || "")}>
                  {entryLabel(modal.record.entry_type)}
                </span>{" "}
                จำนวน <span className="font-semibold text-gray-900 dark:text-gray-100">฿{fmtMoney(modal.record.amount)}</span> ใช่หรือไม่?
              </p>
              <p className="mt-2 text-xs text-amber-600 dark:text-amber-400">ยอดในรายงานจะถูกคำนวณใหม่อัตโนมัติ</p>
              {deleteMsg && <p className="mt-3 text-sm text-red-500 dark:text-red-400">{deleteMsg}</p>}
              <div className="mt-6 flex justify-end gap-3">
                <button onClick={() => setModal(null)} className={resetBtnCls} disabled={deleting}>ปิด</button>
                <button
                  onClick={handleDelete}
                  disabled={deleting}
                  className="inline-flex items-center justify-center gap-2 rounded-2xl bg-red-600 px-6 py-3 text-base font-semibold text-white shadow-sm cursor-pointer hover:bg-red-700 disabled:opacity-60 disabled:cursor-not-allowed transition-all duration-200"
                >
                  {deleting ? "กำลังลบ…" : "ยืนยันลบ"}
                </button>
              </div>
            </div>
          </div>
        </Portal>
      )}
    </div>
  )
}
