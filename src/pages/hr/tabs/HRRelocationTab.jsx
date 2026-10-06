// src/pages/hr/tabs/HRRelocationTab.jsx
// 3E — คำขอย้ายสาขาของพนักงาน + ย้ายสาขาโดยตรง
//
// Endpoints (ตรวจกับ OpenAPI ของ backend แล้ว):
//   GET  /hr/relocation-requests?status=<status>          (ไม่ส่ง status = pending_branch_head)
//   POST /hr/relocation-requests/{id}/branch-head-approve  {branch_head_comment?}
//   POST /hr/relocation-requests/{id}/branch-head-deny     {branch_head_comment?}
//   POST /hr/relocation-requests/{id}/manager-approve      {selected_branch_id, move_date, manager_reason, order_reference?}
//   POST /hr/relocation-requests/{id}/manager-deny         {manager_reason}
//   POST /hr/employees/{id}/relocations                    (ย้ายโดยตรง — ดู RelocationTransferModal)
import { useEffect, useMemo, useState, useCallback } from "react"
import { apiAuth } from "../../../lib/api"
import { getRoleId } from "../../../lib/auth"
import { cardCls, cx, tabPanelCls } from "../../../lib/styles"
import { PageLoader, ErrorState, EmptyState, Tabs, tabId, panelId, useSubTab } from "../../../components/ui"
import Portal from "../../../components/Portal"
import RelocationTransferModal from "../../../components/hr/RelocationTransferModal"

const TABS = [
  { key: "pending_branch_head", label: "รอหัวหน้าสาขา" },
  { key: "pending_manager",     label: "รอผู้จัดการ" },
  { key: "approved",            label: "อนุมัติแล้ว" },
  { key: "denied",              label: "ไม่อนุมัติ" },
]

const STATUS_LABEL = {
  pending: "รออนุมัติ",
  pending_branch_head: "รอหัวหน้าสาขา",
  pending_manager: "รอผู้จัดการ",
  approved: "อนุมัติแล้ว",
  denied: "ไม่อนุมัติ",
  rejected: "ไม่อนุมัติ",
  cancelled: "ยกเลิก",
}
const STATUS_COLOR = {
  pending: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300",
  pending_branch_head: "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300",
  pending_manager: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300",
  approved: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300",
  denied: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300",
  rejected: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300",
  cancelled: "bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400",
}

const CAN_TRANSFER_ROLES = [1, 3] // ADMIN, HR

const inputCls =
  "w-full rounded-xl border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-3 py-2 text-sm " +
  "text-gray-900 dark:text-gray-100 placeholder:text-gray-400 dark:placeholder:text-gray-500 " +
  "focus:outline-none focus:ring-2 focus:ring-indigo-500/40 focus:border-indigo-500 transition-colors duration-200"
const labelCls = "block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1"

function fmtDate(value) {
  if (!value) return "—"
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(value))
  const d = m ? new Date(+m[1], +m[2] - 1, +m[3]) : new Date(value)
  if (Number.isNaN(d.getTime())) return String(value)
  return d.toLocaleDateString("th-TH", { day: "numeric", month: "short", year: "numeric" })
}

function todayISO() {
  const d = new Date()
  const p = (n) => String(n).padStart(2, "0")
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`
}

const prefIds = (r) => [r.branch_pref_1, r.branch_pref_2, r.branch_pref_3, r.branch_pref_4, r.branch_pref_5].filter((v) => v != null)

// action: "bh_approve" | "bh_deny" | "mgr_approve" | "mgr_deny"
const ACTION_META = {
  bh_approve:  { title: "หัวหน้าสาขาเห็นชอบ ส่งต่อผู้จัดการ", ep: "branch-head-approve", tone: "approve", confirm: "ส่งต่อผู้จัดการ" },
  bh_deny:     { title: "หัวหน้าสาขาไม่เห็นชอบ",              ep: "branch-head-deny",    tone: "deny",    confirm: "ไม่อนุมัติ" },
  mgr_approve: { title: "ผู้จัดการอนุมัติย้ายสาขา",            ep: "manager-approve",     tone: "approve", confirm: "อนุมัติย้ายสาขา" },
  mgr_deny:    { title: "ผู้จัดการไม่อนุมัติ",                 ep: "manager-deny",        tone: "deny",    confirm: "ไม่อนุมัติ" },
}

export default function HRRelocationTab() {
  const canTransfer = CAN_TRANSFER_ROLES.includes(getRoleId())
  const [subTab, setSubTab] = useSubTab(TABS.map((t) => t.key), "pending_branch_head")
  const [requests, setRequests] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")

  const [branches, setBranches] = useState([])
  useEffect(() => {
    apiAuth("/order/branch/search")
      .then((data) => setBranches(Array.isArray(data) ? data : []))
      .catch(() => setBranches([]))
  }, [])
  const branchMap = useMemo(() => new Map(branches.map((b) => [String(b.id), b.branch_name])), [branches])
  const branchName = useCallback((id) => (id == null ? "—" : branchMap.get(String(id)) ?? `สาขา #${id}`), [branchMap])

  const [transferOpen, setTransferOpen] = useState(false)
  const [notice, setNotice] = useState("")

  // action modal
  const [modal, setModal] = useState(null) // { req, action }
  const [comment, setComment] = useState("")
  const [selectedBranch, setSelectedBranch] = useState("")
  const [moveDate, setMoveDate] = useState("")
  const [orderRef, setOrderRef] = useState("")
  const [submitting, setSubmitting] = useState(false)
  const [submitMsg, setSubmitMsg] = useState("")

  const fetchRequests = useCallback(() => {
    setLoading(true)
    setError("")
    apiAuth(`/hr/relocation-requests?status=${encodeURIComponent(subTab)}`)
      .then((data) => setRequests(Array.isArray(data) ? data : []))
      .catch((e) => setError(e.message || "โหลดข้อมูลไม่สำเร็จ"))
      .finally(() => setLoading(false))
  }, [subTab])

  useEffect(() => { fetchRequests() }, [fetchRequests])

  const openModal = (req, action) => {
    setModal({ req, action })
    setComment("")
    setSelectedBranch(String(prefIds(req)[0] ?? ""))
    setMoveDate(todayISO())
    setOrderRef("")
    setSubmitMsg("")
  }

  useEffect(() => {
    if (!modal) return
    const onKey = (e) => { if (e.key === "Escape" && !submitting) setModal(null) }
    document.addEventListener("keydown", onKey)
    return () => document.removeEventListener("keydown", onKey)
  }, [modal, submitting])

  const handleConfirm = async () => {
    if (!modal) return
    const { req, action } = modal
    let body
    if (action === "bh_approve" || action === "bh_deny") {
      body = { branch_head_comment: comment.trim() || null }
    } else if (action === "mgr_approve") {
      if (!selectedBranch) { setSubmitMsg("เลือกสาขาที่อนุมัติให้ย้าย"); return }
      if (!moveDate) { setSubmitMsg("ระบุวันที่ย้าย"); return }
      if (!comment.trim()) { setSubmitMsg("ระบุเหตุผลการอนุมัติ"); return }
      body = {
        selected_branch_id: Number(selectedBranch),
        move_date: moveDate,
        manager_reason: comment.trim(),
        order_reference: orderRef.trim() || null,
      }
    } else {
      if (!comment.trim()) { setSubmitMsg("ระบุเหตุผลที่ไม่อนุมัติ"); return }
      body = { manager_reason: comment.trim() }
    }
    setSubmitting(true)
    setSubmitMsg("")
    try {
      await apiAuth(`/hr/relocation-requests/${req.id}/${ACTION_META[action].ep}`, { method: "POST", body })
      setModal(null)
      fetchRequests()
    } catch (err) {
      setSubmitMsg(err.message || "ดำเนินการไม่สำเร็จ")
    } finally {
      setSubmitting(false)
    }
  }

  const meta = modal ? ACTION_META[modal.action] : null
  const isMgrApprove = modal?.action === "mgr_approve"
  const commentRequired = modal && (modal.action === "mgr_approve" || modal.action === "mgr_deny")
  const commentLabel = modal
    ? (modal.action.startsWith("bh_") ? "ความเห็นหัวหน้าสาขา" : modal.action === "mgr_approve" ? "เหตุผลการอนุมัติ" : "เหตุผลที่ไม่อนุมัติ")
    : ""

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <Tabs
          items={TABS.map((t) => ({
            value: t.key,
            label: t.label,
            count:
              subTab === t.key && !loading && t.key.startsWith("pending") && requests.length > 0
                ? requests.length
                : null,
          }))}
          value={subTab}
          onChange={setSubTab}
          ariaLabel="สถานะคำขอย้ายสาขา"
          idBase="hr-relocation"
        />

        {canTransfer && (
          <div className="flex flex-col items-end gap-1">
            <button
              type="button"
              onClick={() => { setNotice(""); setTransferOpen(true) }}
              className="inline-flex items-center gap-1.5 h-10 px-4 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-semibold shadow-sm transition-colors duration-200 cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-gray-900"
            >
              <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4">
                <path d="M7 7h11l-3-3M17 17H6l3 3" />
              </svg>
              ย้ายสาขาโดยตรง
            </button>
            <p className="text-xs text-gray-500 dark:text-gray-400">ถ้าลงวันที่ในอนาคต ระบบจะเปลี่ยนสาขาให้ในรอบประมวลผลรายวัน</p>
          </div>
        )}
      </div>

      <div role="tabpanel" id={panelId("hr-relocation", subTab)} aria-labelledby={tabId("hr-relocation", subTab)} tabIndex={0} className={cx("space-y-4", tabPanelCls)}>
      {notice && (
        <p role="status" className="rounded-xl bg-emerald-50 dark:bg-emerald-900/20 px-4 py-2.5 text-sm text-emerald-800 dark:text-emerald-200 ring-1 ring-emerald-200 dark:ring-emerald-800/60">
          {notice}
        </p>
      )}

      {error && <ErrorState message={error} onRetry={fetchRequests} />}

      {loading ? (
        <PageLoader variant="cards" rows={3} message="กำลังโหลดคำขอย้ายสาขา…" />
      ) : !error && requests.length === 0 ? (
        <div className={cardCls + " p-2"}>
          <EmptyState
            title={`ไม่มีคำขอ${TABS.find((t) => t.key === subTab)?.label ?? ""}`}
            description={subTab.startsWith("pending") ? "ไม่มีคำขอที่ค้างอยู่ในขั้นนี้" : "ยังไม่มีคำขอในสถานะนี้"}
          />
        </div>
      ) : (
        <div className="space-y-3">
          {requests.map((r) => {
            const prefs = prefIds(r)
            return (
              <div key={r.id} className="rounded-2xl bg-white dark:bg-gray-800 ring-1 ring-gray-200/70 dark:ring-gray-700/70 shadow-sm p-4">
                <div className="flex items-start justify-between gap-3 flex-wrap">
                  <div className="flex-1 min-w-0 space-y-2">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="font-semibold text-gray-900 dark:text-gray-100">{r.user_first_name} {r.user_last_name}</p>
                      <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${STATUS_COLOR[r.status] ?? "bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300"}`}>
                        {STATUS_LABEL[r.status] ?? r.status}
                      </span>
                      <span className="text-xs text-gray-400 dark:text-gray-500">ยื่นเมื่อ {fmtDate(r.created_at)}</span>
                    </div>

                    <div className="text-sm">
                      <p className="text-xs text-gray-400 dark:text-gray-500 mb-1">สาขาที่ขอ (ตามลำดับ)</p>
                      {prefs.length === 0 ? (
                        <p className="text-gray-500 dark:text-gray-400">—</p>
                      ) : (
                        <ol className="flex flex-wrap gap-1.5">
                          {prefs.map((bid, i) => (
                            <li
                              key={`${bid}-${i}`}
                              className={`rounded-lg px-2 py-0.5 text-xs ${r.selected_branch_id != null && String(r.selected_branch_id) === String(bid)
                                ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-200 font-semibold"
                                : "bg-gray-100 text-gray-700 dark:bg-gray-700/60 dark:text-gray-200"}`}
                            >
                              {i + 1}. {branchName(bid)}
                            </li>
                          ))}
                        </ol>
                      )}
                    </div>

                    {(r.selected_branch_id != null || r.move_date) && (
                      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-sm">
                        {r.selected_branch_id != null && (
                          <div>
                            <p className="text-xs text-gray-400 dark:text-gray-500">สาขาที่อนุมัติ</p>
                            <p className="font-semibold text-indigo-700 dark:text-indigo-300">{branchName(r.selected_branch_id)}</p>
                          </div>
                        )}
                        {r.move_date && (
                          <div>
                            <p className="text-xs text-gray-400 dark:text-gray-500">วันที่ย้าย</p>
                            <p className="font-medium text-gray-800 dark:text-gray-200">{fmtDate(r.move_date)}</p>
                          </div>
                        )}
                      </div>
                    )}

                    {r.reason && (
                      <p className="text-xs text-gray-600 dark:text-gray-400 bg-gray-50 dark:bg-gray-700/40 rounded-lg px-3 py-1.5">
                        เหตุผล: {r.reason}
                      </p>
                    )}
                    {r.branch_head_comment && (
                      <p className="text-xs text-orange-800 dark:text-orange-200 bg-orange-50 dark:bg-orange-900/20 rounded-lg px-3 py-1.5">
                        ความเห็นหัวหน้าสาขา: {r.branch_head_comment}
                      </p>
                    )}
                    {r.manager_reason && (
                      <p className="text-xs text-indigo-700 dark:text-indigo-300 bg-indigo-50 dark:bg-indigo-900/20 rounded-lg px-3 py-1.5">
                        ความเห็นผู้จัดการ: {r.manager_reason}
                      </p>
                    )}
                  </div>

                  {(r.status === "pending_branch_head" || r.status === "pending_manager") && (
                    <div className="flex gap-2 shrink-0">
                      <button
                        onClick={() => openModal(r, r.status === "pending_branch_head" ? "bh_approve" : "mgr_approve")}
                        className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-semibold transition-colors duration-200 shadow-sm cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-gray-800"
                      >
                        <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4"><path d="M20 6 9 17l-5-5" /></svg>
                        {r.status === "pending_branch_head" ? "เห็นชอบ" : "อนุมัติ"}
                      </button>
                      <button
                        onClick={() => openModal(r, r.status === "pending_branch_head" ? "bh_deny" : "mgr_deny")}
                        className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-red-600 hover:bg-red-500 text-white text-sm font-semibold transition-colors duration-200 shadow-sm cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-red-500 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-gray-800"
                      >
                        <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4"><path d="M18 6 6 18M6 6l12 12" /></svg>
                        ไม่อนุมัติ
                      </button>
                    </div>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}
      </div>

      {modal && meta && (
        <Portal>
          <div
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm"
            onMouseDown={(e) => { if (e.target === e.currentTarget && !submitting) setModal(null) }}
          >
            <div
              role="dialog"
              aria-modal="true"
              aria-labelledby="relo-action-title"
              className="w-full max-w-md max-h-[90vh] overflow-y-auto rounded-2xl bg-white dark:bg-gray-800 shadow-2xl p-6 space-y-4"
            >
              <h3 id="relo-action-title" className="text-lg font-bold text-gray-900 dark:text-gray-100">{meta.title}</h3>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                <span className="font-semibold text-gray-900 dark:text-gray-100">{modal.req.user_first_name} {modal.req.user_last_name}</span>
                {" "}ขอย้ายสาขา
              </p>

              {isMgrApprove && (
                <>
                  <fieldset>
                    <legend className={labelCls}>สาขาที่อนุมัติให้ย้าย <span className="text-red-500">*</span></legend>
                    {prefIds(modal.req).length === 0 ? (
                      <p className="text-sm text-red-600 dark:text-red-400">คำขอนี้ไม่มีสาขาที่ขอไว้</p>
                    ) : (
                      <div className="space-y-1.5">
                        {prefIds(modal.req).map((bid, i) => (
                          <label key={`${bid}-${i}`} className="flex items-center gap-2 rounded-lg px-3 py-2 ring-1 ring-gray-200 dark:ring-gray-700 cursor-pointer has-[:checked]:ring-indigo-500 has-[:checked]:bg-indigo-50 dark:has-[:checked]:bg-indigo-900/20 transition-colors duration-200">
                            <input
                              type="radio"
                              name="relo-selected-branch"
                              value={String(bid)}
                              checked={selectedBranch === String(bid)}
                              onChange={(e) => setSelectedBranch(e.target.value)}
                              className="accent-indigo-600"
                            />
                            <span className="text-sm text-gray-800 dark:text-gray-200">
                              <span className="text-gray-400 dark:text-gray-500 mr-1">อันดับ {i + 1}</span>{branchName(bid)}
                            </span>
                          </label>
                        ))}
                      </div>
                    )}
                  </fieldset>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label htmlFor="relo-move-date" className={labelCls}>วันที่ย้าย <span className="text-red-500">*</span></label>
                      <input id="relo-move-date" type="date" value={moveDate} onChange={(e) => setMoveDate(e.target.value)} className={inputCls} />
                    </div>
                    <div>
                      <label htmlFor="relo-order-ref" className={labelCls}>เลขคำสั่ง</label>
                      <input id="relo-order-ref" type="text" value={orderRef} onChange={(e) => setOrderRef(e.target.value)} placeholder="เช่น 123/2569" className={inputCls} />
                    </div>
                  </div>
                </>
              )}

              <div>
                <label htmlFor="relo-comment" className={labelCls}>
                  {commentLabel} {commentRequired ? <span className="text-red-500">*</span> : <span className="text-gray-400">(ถ้ามี)</span>}
                </label>
                <textarea
                  id="relo-comment"
                  rows={2}
                  value={comment}
                  onChange={(e) => setComment(e.target.value)}
                  autoFocus={!isMgrApprove}
                  className={`${inputCls} resize-y`}
                />
              </div>

              {submitMsg && (
                <p role="alert" className="rounded-xl bg-red-50 dark:bg-red-900/20 px-3 py-2 text-sm text-red-700 dark:text-red-300 ring-1 ring-red-200 dark:ring-red-800/60">
                  {submitMsg}
                </p>
              )}
              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => setModal(null)}
                  disabled={submitting}
                  className="flex-1 h-10 rounded-xl border border-gray-300 dark:border-gray-600 text-sm font-semibold text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors duration-200 cursor-pointer disabled:opacity-60 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
                >
                  ยกเลิก
                </button>
                <button
                  type="button"
                  onClick={handleConfirm}
                  disabled={submitting || (isMgrApprove && prefIds(modal.req).length === 0)}
                  className={`flex-1 h-10 rounded-xl text-white text-sm font-semibold transition-colors duration-200 shadow-sm disabled:opacity-60 cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-gray-800 ${meta.tone === "approve" ? "bg-emerald-600 hover:bg-emerald-500 focus-visible:ring-emerald-500" : "bg-red-600 hover:bg-red-500 focus-visible:ring-red-500"}`}
                >
                  {submitting ? "กำลังดำเนินการ…" : meta.confirm}
                </button>
              </div>
            </div>
          </div>
        </Portal>
      )}

      {transferOpen && (
        <RelocationTransferModal
          onClose={() => setTransferOpen(false)}
          onDone={(res) => {
            setNotice(res.applied === false
              ? `บันทึกการย้าย ${res.employeeName || ""} ไป ${res.toName ?? "สาขาใหม่"} แล้ว มีผลวันที่ ${fmtDate(res.effective_date)}`
              : `ย้าย ${res.employeeName || ""} ไป ${res.toName ?? "สาขาใหม่"} เรียบร้อย`)
          }}
        />
      )}
    </div>
  )
}
