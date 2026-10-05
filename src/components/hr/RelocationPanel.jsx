// src/components/hr/RelocationPanel.jsx
// 3E — การ์ด "ย้ายสาขา" สำหรับหน้าโปรไฟล์เจ้าหน้าที่ (HRPersonnelDetail)
// self-contained: โหลดชื่อ/สาขาปัจจุบันเอง, ปุ่มย้ายสาขาโดยตรง (role 1/3), ประวัติย้ายสาขา
// usage: <RelocationPanel userId={id} />
import { useCallback, useEffect, useState } from "react"
import { apiAuth } from "../../lib/api"
import { getRoleId } from "../../lib/auth"
import RelocationTransferModal from "./RelocationTransferModal"
import RelocationHistoryList from "./RelocationHistoryList"

const CAN_TRANSFER_ROLES = [1, 3] // ADMIN, HR — ตาม API: POST /hr/employees/{id}/relocations

export default function RelocationPanel({ userId }) {
  const canTransfer = CAN_TRANSFER_ROLES.includes(getRoleId())
  const [person, setPerson] = useState(null)
  const [branchName, setBranchName] = useState(null)
  const [open, setOpen] = useState(false)
  const [refreshKey, setRefreshKey] = useState(0)

  const loadPerson = useCallback(() => {
    if (!userId) return
    apiAuth(`/hr/personnel/${userId}`)
      .then((p) => setPerson(p || null))
      .catch(() => setPerson(null))
  }, [userId])

  useEffect(() => { loadPerson() }, [loadPerson, refreshKey])

  useEffect(() => {
    if (person?.branch_location == null) return
    let cancelled = false
    apiAuth("/order/branch/search")
      .then((data) => {
        if (cancelled) return
        const b = (Array.isArray(data) ? data : []).find((x) => String(x.id) === String(person.branch_location))
        setBranchName(b?.branch_name ?? null)
      })
      .catch(() => {})
    return () => { cancelled = true }
  }, [person?.branch_location])

  const fullName = person ? `${person.first_name ?? ""} ${person.last_name ?? ""}`.trim() : ""

  return (
    <section
      aria-labelledby="relocation-panel-title"
      className="rounded-2xl bg-white dark:bg-gray-800 ring-1 ring-gray-200/70 dark:ring-gray-700/70 shadow-sm p-5"
    >
      <div className="flex items-start justify-between gap-3 flex-wrap mb-3 pb-2 border-b border-indigo-100 dark:border-indigo-900/40">
        <div>
          <h3 id="relocation-panel-title" className="text-sm font-semibold text-indigo-700 dark:text-indigo-300">
            ย้ายสาขา
          </h3>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
            สาขาปัจจุบัน: <span className="font-medium text-gray-700 dark:text-gray-300">{branchName ?? (person ? "—" : "…")}</span>
          </p>
        </div>
        {canTransfer && (
          <button
            type="button"
            onClick={() => setOpen(true)}
            disabled={!person}
            className="inline-flex items-center gap-1.5 h-9 px-3.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-semibold shadow-sm transition-colors duration-200 cursor-pointer disabled:opacity-60 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-gray-800"
          >
            <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4">
              <path d="M7 7h11l-3-3M17 17H6l3 3" />
            </svg>
            ย้ายสาขาโดยตรง
          </button>
        )}
      </div>

      <RelocationHistoryList userId={userId} refreshKey={refreshKey} />

      {open && person && (
        <RelocationTransferModal
          employee={{ id: person.id ?? userId, name: fullName, branchId: person.branch_location }}
          onClose={() => setOpen(false)}
          onDone={() => setRefreshKey((k) => k + 1)}
        />
      )}
    </section>
  )
}
