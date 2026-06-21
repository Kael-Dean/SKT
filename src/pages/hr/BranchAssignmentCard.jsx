// src/pages/hr/BranchAssignmentCard.jsx
// จัดการสิทธิ์เข้าถึงสาขาของเจ้าหน้าที่ (Super Admin / role 1 เท่านั้น)
//   GET    /admin/personnel/{id}/branch-assignments
//   POST   /admin/personnel/{id}/branch-assignments        { branch_id }
//   DELETE /admin/personnel/{id}/branch-assignments/{branch_id}
import { useCallback, useEffect, useMemo, useState } from "react"
import ReactDOM from "react-dom"
import { apiAuth } from "../../lib/api"
import { getRoleId } from "../../lib/auth"
import SelectDropdown from "../../components/SelectDropdown"

function SectionTitle({ children }) {
  return (
    <h3 className="text-xs font-semibold text-indigo-700 dark:text-indigo-300 uppercase tracking-wide mb-3 pb-1 border-b border-indigo-100 dark:border-indigo-900/40">
      {children}
    </h3>
  )
}

function fmtDateTime(d) {
  if (!d) return ""
  try {
    return new Date(d).toLocaleDateString("th-TH", { year: "numeric", month: "short", day: "numeric" })
  } catch { return "" }
}

export default function BranchAssignmentCard({ personnelId, personnelName }) {
  const isSuperAdmin = getRoleId() === 1

  const [data, setData] = useState(null) // { home_branch, extra_branches }
  const [allBranches, setAllBranches] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")

  const [addValue, setAddValue] = useState("")
  const [adding, setAdding] = useState(false)
  const [addMsg, setAddMsg] = useState("")

  const [removeTarget, setRemoveTarget] = useState(null) // { id, branch_name }
  const [removing, setRemoving] = useState(false)

  const load = useCallback(() => {
    setLoading(true)
    setError("")
    Promise.all([
      apiAuth(`/admin/personnel/${personnelId}/branch-assignments`),
      apiAuth("/order/branch/search").catch(() => []),
    ])
      .then(([assign, branches]) => {
        setData(assign)
        setAllBranches(Array.isArray(branches) ? branches : [])
      })
      .catch((e) => setError(e.message || "โหลดข้อมูลสาขาไม่สำเร็จ"))
      .finally(() => setLoading(false))
  }, [personnelId])

  useEffect(() => { if (isSuperAdmin) load() }, [isSuperAdmin, load])

  const homeBranch = data?.home_branch ?? null
  const extras = data?.extra_branches ?? []

  // ตัวเลือกสาขาที่ยังเพิ่มได้ = ทุกสาขา ลบ สาขาหลัก + สาขาที่กำหนดไว้แล้ว
  const addOptions = useMemo(() => {
    const home = data?.home_branch ?? null
    const taken = new Set([
      ...(home ? [Number(home.id)] : []),
      ...(data?.extra_branches ?? []).map((b) => Number(b.id)),
    ])
    return allBranches
      .filter((b) => !taken.has(Number(b.id)))
      .map((b) => ({ value: b.id, label: b.branch_name }))
  }, [allBranches, data])

  const handleAdd = async () => {
    if (!addValue) return
    setAdding(true)
    setAddMsg("")
    try {
      await apiAuth(`/admin/personnel/${personnelId}/branch-assignments`, {
        method: "POST",
        body: { branch_id: Number(addValue) },
      })
      setAddValue("")
      setAddMsg("✅ เพิ่มสาขาสำเร็จ")
      load()
      setTimeout(() => setAddMsg(""), 2000)
    } catch (err) {
      if (err.status === 409) setAddMsg("⚠️ สาขานี้ถูกกำหนดไว้แล้ว")
      else if (err.status === 400) setAddMsg("⚠️ เป็นสาขาหลักของผู้ใช้อยู่แล้ว")
      else if (err.status === 404) setAddMsg("❌ ไม่พบสาขาหรือผู้ใช้")
      else setAddMsg(`❌ ${err.message || "เพิ่มสาขาไม่สำเร็จ"}`)
    } finally {
      setAdding(false)
    }
  }

  const handleRemove = async () => {
    if (!removeTarget) return
    setRemoving(true)
    try {
      await apiAuth(`/admin/personnel/${personnelId}/branch-assignments/${removeTarget.id}`, {
        method: "DELETE",
      })
      setRemoveTarget(null)
      load()
    } catch (err) {
      setError(err.message || "ลบสาขาไม่สำเร็จ")
      setRemoveTarget(null)
    } finally {
      setRemoving(false)
    }
  }

  if (!isSuperAdmin) return null

  return (
    <div className="rounded-2xl bg-white dark:bg-gray-800 ring-1 ring-gray-200/70 dark:ring-gray-700/70 shadow-sm p-5">
      <SectionTitle>สิทธิ์เข้าถึงสาขา</SectionTitle>

      {loading ? (
        <div className="flex items-center gap-2 py-3 text-sm text-gray-400 dark:text-gray-500">
          <span className="h-4 w-4 animate-spin rounded-full border-2 border-indigo-400/40 border-t-indigo-500" />
          กำลังโหลด…
        </div>
      ) : error ? (
        <div className="flex items-center justify-between gap-3 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-600 dark:bg-red-900/25 dark:text-red-300">
          <span>{error}</span>
          <button onClick={load} className="shrink-0 font-semibold underline-offset-2 hover:underline cursor-pointer">ลองใหม่</button>
        </div>
      ) : (
        <div className="space-y-4">
          {/* สาขาหลัก */}
          <div>
            <p className="mb-1.5 text-xs font-medium text-gray-500 dark:text-gray-400">สาขาหลัก</p>
            {homeBranch ? (
              <span className="inline-flex items-center gap-1.5 rounded-xl bg-indigo-50 px-3 py-1.5 text-sm font-semibold text-indigo-700 ring-1 ring-indigo-200/70 dark:bg-indigo-900/30 dark:text-indigo-300 dark:ring-indigo-800/50">
                <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
                </svg>
                {homeBranch.branch_name}
              </span>
            ) : (
              <span className="text-sm text-gray-400 dark:text-gray-500 italic">— ยังไม่ได้กำหนดสาขาหลัก —</span>
            )}
          </div>

          {/* สาขาเพิ่มเติม */}
          <div>
            <p className="mb-1.5 text-xs font-medium text-gray-500 dark:text-gray-400">
              สาขาเพิ่มเติม {extras.length > 0 && <span className="text-gray-400">({extras.length})</span>}
            </p>
            {extras.length > 0 ? (
              <div className="flex flex-wrap gap-2">
                {extras.map((b) => (
                  <span
                    key={b.id}
                    className="group inline-flex items-center gap-2 rounded-xl bg-gray-100 px-3 py-1.5 text-sm font-medium text-gray-700 ring-1 ring-gray-200 dark:bg-gray-700/50 dark:text-gray-200 dark:ring-gray-600"
                  >
                    <span>{b.branch_name}</span>
                    {b.assigned_at && (
                      <span className="text-[11px] text-gray-400 dark:text-gray-500">{fmtDateTime(b.assigned_at)}</span>
                    )}
                    <button
                      type="button"
                      onClick={() => setRemoveTarget({ id: b.id, branch_name: b.branch_name })}
                      title="ลบสิทธิ์สาขานี้"
                      aria-label={`ลบสิทธิ์สาขา ${b.branch_name}`}
                      className="inline-flex h-5 w-5 items-center justify-center rounded-lg text-gray-400 transition-colors hover:bg-red-100 hover:text-red-600 dark:hover:bg-red-900/40 dark:hover:text-red-400 cursor-pointer"
                    >
                      <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5"><path strokeLinecap="round" strokeLinejoin="round" d="M6 6l12 12M6 18L18 6" /></svg>
                    </button>
                  </span>
                ))}
              </div>
            ) : (
              <p className="text-sm text-gray-400 dark:text-gray-500 italic">— ยังไม่มีสาขาเพิ่มเติม —</p>
            )}
          </div>

          {/* เพิ่มสาขา */}
          <div className="border-t border-gray-100 dark:border-gray-700/50 pt-4">
            <p className="mb-1.5 text-xs font-medium text-gray-500 dark:text-gray-400">มอบสิทธิ์เข้าถึงสาขาเพิ่ม</p>
            <div className="flex flex-col gap-2 sm:flex-row">
              <div className="flex-1">
                <SelectDropdown
                  value={addValue}
                  onChange={setAddValue}
                  options={addOptions}
                  placeholder={addOptions.length ? "— เลือกสาขา —" : "ไม่มีสาขาให้เพิ่ม"}
                  disabled={addOptions.length === 0}
                />
              </div>
              <button
                type="button"
                onClick={handleAdd}
                disabled={!addValue || adding}
                className="inline-flex items-center justify-center gap-2 rounded-2xl bg-indigo-600 px-5 py-3 text-sm font-semibold text-white shadow-sm transition-all duration-200 hover:bg-indigo-500 active:scale-[0.97] disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-gray-800"
              >
                {adding ? (
                  <>
                    <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white" />
                    กำลังเพิ่ม…
                  </>
                ) : "เพิ่มสาขา"}
              </button>
            </div>
            {addMsg && (
              <p className={`mt-2 text-sm ${addMsg.startsWith("✅") ? "text-emerald-600 dark:text-emerald-400" : "text-amber-600 dark:text-amber-400"}`}>{addMsg}</p>
            )}
          </div>
        </div>
      )}

      {/* Confirm remove dialog */}
      {removeTarget && ReactDOM.createPortal(
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="w-full max-w-sm rounded-2xl bg-white dark:bg-gray-800 shadow-2xl p-6 space-y-4">
            <h3 className="text-lg font-bold text-gray-900 dark:text-gray-100">ยืนยันลบสิทธิ์สาขา</h3>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              ลบสิทธิ์เข้าถึงสาขา{" "}
              <span className="font-semibold text-indigo-700 dark:text-indigo-300">{removeTarget.branch_name}</span>
              {personnelName ? <> ของ <span className="font-semibold">{personnelName}</span></> : null}?
            </p>
            <p className="text-xs text-gray-400 dark:text-gray-500">
              หากผู้ใช้กำลังสลับไปสาขานี้อยู่ Token เดิมจะใช้ได้จนหมดอายุ — มีผลเต็มเมื่อเข้าสู่ระบบครั้งถัดไป
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setRemoveTarget(null)}
                disabled={removing}
                className="flex-1 h-10 rounded-xl border border-gray-300 dark:border-gray-600 text-sm font-semibold text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700 transition cursor-pointer disabled:opacity-60"
              >
                ยกเลิก
              </button>
              <button
                onClick={handleRemove}
                disabled={removing}
                className="flex-1 inline-flex items-center justify-center gap-2 h-10 rounded-xl bg-red-600 hover:bg-red-500 disabled:opacity-60 text-white text-sm font-semibold transition cursor-pointer disabled:cursor-not-allowed"
              >
                {removing ? (
                  <>
                    <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white" />
                    กำลังลบ…
                  </>
                ) : "ลบสิทธิ์"}
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  )
}
