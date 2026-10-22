// src/components/hr/IssueReportsPanel.jsx
// ─────────────────────────────────────────────────────────────────────────────
// HR / ผู้จัดการ: คำร้องแจ้งแก้ไขข้อมูลจากพนักงาน (3F)
//   GET  /hr/issue-reports?status=&category=&overdue=true
//   POST /hr/issue-reports/{id}/approve  → { old_value, new_value }  (toast "ค่าเดิม → ค่าใหม่")
//   POST /hr/issue-reports/{id}/deny     { hr_comment }
// Rendered by HRIssueTab (HR dashboard ?tab=issues) and the standalone page HRIssueReports (/hr/issues).
// Deep link: `?id=<report id>` (notification bell, lib/approvalActions.js) opens that report.
// ─────────────────────────────────────────────────────────────────────────────
import { useCallback, useEffect, useMemo, useState } from "react"
import { useSearchParams } from "react-router-dom"
import { ArrowRight, Clock, Paperclip } from "lucide-react"
import { apiAuth } from "../../lib/api"
import { useCan } from "../../lib/permissions"
import { keepBackState } from "../../lib/drill"
import { cx, baseField, cardCls, dangerBtnCls, focusRingCls, neutralBtnCls, submitBtnCls, tabPanelCls, errorTextCls } from "../../lib/styles"
import { useIsPhone } from "../../hooks/useMediaQuery"
import { Badge, DataList, EmptyState, ErrorState, Sheet, SkeletonTableRows, Tabs, panelId, tabId, toast, useSubTab } from "../ui"
import SelectDropdown from "../SelectDropdown"
import AttachmentList from "../AttachmentList"
import {
  ageText, fmtShortDate, fullName, hasNewValue, issueStatus, previousValueOf,
} from "../../lib/issueReports"

const STATUS_TABS = ["pending", "resolved", "rejected", "all"]
const inputCls = cx(baseField, "!rounded-lg !px-3 !py-2 md:!text-sm")

function OverdueBadge() {
  return (
    <Badge tone="danger" className="gap-1">
      <Clock aria-hidden="true" className="size-3" />
      เกินกำหนด
    </Badge>
  )
}

/** ค่าเดิม → ค่าใหม่ (one line; wraps on narrow cells) */
function ValueChange({ row }) {
  if (!hasNewValue(row)) {
    return <span className="text-gray-500 dark:text-gray-400">ดูรายละเอียด</span>
  }
  const prev = previousValueOf(row)
  return (
    <span className="inline-flex min-w-0 flex-wrap items-center gap-x-1.5 gap-y-0.5 text-sm">
      <span className="break-all text-gray-500 line-through decoration-gray-400/70 dark:text-gray-400">{prev.value || "ว่าง"}</span>
      <ArrowRight aria-label="เปลี่ยนเป็น" className="size-3.5 shrink-0 text-gray-400" />
      <span className="break-all font-semibold text-gray-900 dark:text-gray-100">{row.correct_value}</span>
    </span>
  )
}

function DetailRow({ label, children }) {
  return (
    <div className="grid grid-cols-[7.5rem_1fr] gap-3 py-2 text-sm">
      <dt className="text-gray-500 dark:text-gray-400">{label}</dt>
      <dd className="min-w-0 text-gray-900 dark:text-gray-100">{children}</dd>
    </div>
  )
}

function ReportSheet({ report, branchName, canDecide, onClose, onDone }) {
  const [mode, setMode] = useState("view") // view | deny
  const [comment, setComment] = useState("")
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState("")
  const pending = report.status === "pending"
  const st = issueStatus(report.status)
  const prev = previousValueOf(report)

  const approve = async () => {
    setBusy(true); setMsg("")
    try {
      const res = await apiAuth(`/hr/issue-reports/${report.id}/approve`, { method: "POST", body: {} })
      const oldV = res?.old_value ?? report.current_value
      const newV = res?.new_value ?? report.correct_value
      toast.success("อนุมัติแล้ว — บันทึกข้อมูลใหม่ให้พนักงาน", {
        description: `${report.field_label || report.field_name}: ${oldV || "ว่าง"} → ${newV || "—"}`,
      })
      onDone()
    } catch (err) {
      if (err.status === 409) {
        toast.info("คำร้องนี้ได้รับการพิจารณาไปแล้ว", { description: err.message })
        onDone()
      } else {
        setMsg(err.message || "อนุมัติไม่สำเร็จ")
      }
    } finally {
      setBusy(false)
    }
  }

  const deny = async () => {
    if (!comment.trim()) { setMsg("กรุณาระบุเหตุผล พนักงานจะได้รับข้อความนี้ในการแจ้งเตือน"); return }
    setBusy(true); setMsg("")
    try {
      await apiAuth(`/hr/issue-reports/${report.id}/deny`, { method: "POST", body: { hr_comment: comment.trim() } })
      toast.success("ปฏิเสธคำร้องแล้ว", { description: "แจ้งเหตุผลให้พนักงานทราบแล้ว" })
      onDone()
    } catch (err) {
      if (err.status === 409) {
        toast.info("คำร้องนี้ได้รับการพิจารณาไปแล้ว", { description: err.message })
        onDone()
      } else {
        setMsg(err.message || "ปฏิเสธไม่สำเร็จ")
      }
    } finally {
      setBusy(false)
    }
  }

  const footer = pending && canDecide ? (
    mode === "deny" ? (
      <div className="grid grid-cols-2 gap-3 md:flex md:justify-end md:gap-2">
        <button type="button" onClick={() => { setMode("view"); setMsg("") }} disabled={busy} className={neutralBtnCls}>ย้อนกลับ</button>
        <button type="button" onClick={deny} disabled={busy} className={dangerBtnCls}>
          {busy ? "กำลังบันทึก…" : "ยืนยันปฏิเสธ"}
        </button>
      </div>
    ) : (
      <div className="grid grid-cols-2 gap-3 md:flex md:justify-end md:gap-2">
        <button type="button" onClick={() => { setMode("deny"); setMsg("") }} disabled={busy} className={neutralBtnCls}>ปฏิเสธ</button>
        <button type="button" onClick={approve} disabled={busy} className={cx(submitBtnCls, "!h-11 md:!h-10 !rounded-xl !px-4 !py-0 !text-sm hover:!scale-100 hover:!shadow-sm")}>
          {busy ? "กำลังอนุมัติ…" : "อนุมัติและบันทึก"}
        </button>
      </div>
    )
  ) : (
    <div className="flex justify-end">
      <button type="button" onClick={onClose} className={neutralBtnCls}>ปิด</button>
    </div>
  )

  return (
    <Sheet
      open
      onClose={onClose}
      busy={busy}
      size="md"
      title={report.field_label || report.field_name || "คำร้องแจ้งแก้ไขข้อมูล"}
      subtitle={`${fullName(report)}${branchName ? ` · ${branchName}` : ""}`}
      initialFocus={mode === "deny" ? "#issue-deny-comment" : undefined}
      footer={footer}
    >
      <div className="space-y-4">
        <div className="flex flex-wrap items-center gap-2">
          <Badge tone={st.tone}>{st.label}</Badge>
          {report.overdue && <OverdueBadge />}
          {report.category_label && <Badge tone="neutral">{report.category_label}</Badge>}
        </div>

        {hasNewValue(report) && (
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-[1fr_auto_1fr] sm:items-stretch">
            <div className="rounded-xl bg-gray-50 px-3 py-2.5 ring-1 ring-gray-200/70 dark:bg-white/[.03] dark:ring-line">
              <p className="text-xs text-gray-500 dark:text-gray-400">
                {prev.source === "record" ? "ค่าเดิม (ในระบบ)" : "ค่าเดิม (ที่พนักงานเห็น)"}
              </p>
              <p className="mt-0.5 break-all text-sm font-medium text-gray-700 dark:text-gray-300">{prev.value || "ว่าง"}</p>
            </div>
            <ArrowRight aria-hidden="true" className="hidden size-4 self-center text-gray-400 sm:block" />
            <div className="rounded-xl bg-emerald-50 px-3 py-2.5 ring-1 ring-emerald-200/70 dark:bg-emerald-500/10 dark:ring-emerald-400/20">
              <p className="text-xs text-emerald-800 dark:text-emerald-300">ค่าใหม่</p>
              <p className="mt-0.5 break-all text-sm font-semibold text-emerald-900 dark:text-emerald-100">{report.correct_value}</p>
            </div>
          </div>
        )}

        <dl className="divide-y divide-gray-100 dark:divide-line">
          <DetailRow label="ส่งเมื่อ">
            {fmtShortDate(report.created_at)}
            {report.age_days != null && <span className="text-gray-500 dark:text-gray-400"> · {ageText(report)}</span>}
          </DetailRow>
          {report.resolved_at && <DetailRow label="พิจารณาเมื่อ">{fmtShortDate(report.resolved_at)}</DetailRow>}
          {report.description && <DetailRow label="รายละเอียด"><span className="whitespace-pre-wrap break-words">{report.description}</span></DetailRow>}
          {report.hr_comment && <DetailRow label="เหตุผล / ความเห็น"><span className="whitespace-pre-wrap break-words">{report.hr_comment}</span></DetailRow>}
        </dl>

        <section aria-labelledby="issue-files-h">
          <h3 id="issue-files-h" className="mb-1 text-xs font-semibold text-gray-600 dark:text-gray-400">
            ไฟล์แนบ {report.attachments?.length ? `(${report.attachments.length})` : ""}
          </h3>
          <AttachmentList attachments={report.attachments} emptyText="ไม่มีไฟล์แนบ" />
        </section>

        {pending && canDecide && mode === "deny" && (
          <div>
            <label htmlFor="issue-deny-comment" className="mb-1 block text-xs font-medium text-gray-600 dark:text-gray-400">
              เหตุผลที่ปฏิเสธ <span className="text-red-600 dark:text-red-400">*</span>
            </label>
            <textarea
              id="issue-deny-comment"
              rows={3}
              value={comment}
              onChange={(e) => { setComment(e.target.value); if (msg) setMsg("") }}
              aria-invalid={!!msg && !comment.trim()}
              aria-describedby="issue-deny-help"
              className={cx(inputCls, "resize-none", msg && !comment.trim() && "!border-red-500")}
              placeholder="เช่น เอกสารแนบไม่ชัด กรุณาแนบสำเนาบัตรใหม่"
            />
            <p id="issue-deny-help" className="mt-1 text-xs text-gray-500 dark:text-gray-400">พนักงานจะเห็นข้อความนี้ในการแจ้งเตือน</p>
          </div>
        )}
        {msg && <p role="alert" className={errorTextCls}>{msg}</p>}
      </div>
    </Sheet>
  )
}

export default function IssueReportsPanel({ idBase = "hr-issues" }) {
  const { can } = useCan()
  const canDecide = can("hr.issues.decide")
  const isPhone = useIsPhone()
  const [params, setParams] = useSearchParams()
  const [status, setStatus] = useSubTab(STATUS_TABS, "pending")
  const [overdueOnly, setOverdueOnly] = useState(false)
  const [category, setCategory] = useState("")
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [reloadKey, setReloadKey] = useState(0)
  const [categories, setCategories] = useState([])
  const [branches, setBranches] = useState({})
  const [openId, setOpenId] = useState(() => params.get("id"))
  const [openRow, setOpenRow] = useState(null)

  // lookups (best effort — the list works without them)
  useEffect(() => {
    apiAuth("/personnel/me/report-issue/fields")
      .then((d) => setCategories((Array.isArray(d) ? d : []).map((c) => ({ value: c.category, label: c.category_label || c.category }))))
      .catch(() => {})
    apiAuth("/order/branch/search")
      .then((d) => setBranches(Object.fromEntries((Array.isArray(d) ? d : []).map((b) => [String(b.id), b.branch_name]))))
      .catch(() => {})
  }, [])

  const query = useMemo(() => {
    const q = new URLSearchParams()
    q.set("status", status === "all" ? "" : status)
    if (status === "pending" && overdueOnly) q.set("overdue", "true")
    if (category) q.set("category", category)
    return q.toString()
  }, [status, overdueOnly, category])

  useEffect(() => {
    let alive = true
    setLoading(true)
    setError("")
    apiAuth(`/hr/issue-reports?${query}`)
      .then((d) => { if (alive) setRows(Array.isArray(d) ? d : Array.isArray(d?.items) ? d.items : []) })
      .catch((e) => { if (alive) setError(e.message || "โหลดคำร้องไม่สำเร็จ") })
      .finally(() => { if (alive) setLoading(false) })
    return () => { alive = false }
  }, [query, reloadKey])

  const reload = useCallback(() => setReloadKey((k) => k + 1), [])

  // pending: oldest first (SLA). others: newest first.
  const sorted = useMemo(() => {
    const list = [...rows]
    if (status === "pending") list.sort((a, b) => (Number(!!b.overdue) - Number(!!a.overdue)) || ((b.age_days ?? 0) - (a.age_days ?? 0)))
    else list.sort((a, b) => String(b.created_at || "").localeCompare(String(a.created_at || "")))
    return list
  }, [rows, status])

  const overdueCount = status === "pending" && !overdueOnly ? rows.filter((r) => r.overdue).length : null

  // resolve the open report: from the list, else fetch everything once (deep link to a decided report)
  useEffect(() => {
    if (openId == null) { setOpenRow(null); return }
    const hit = rows.find((r) => String(r.id) === String(openId))
    if (hit) { setOpenRow(hit); return }
    if (loading) return
    let alive = true
    apiAuth("/hr/issue-reports?status=")
      .then((d) => {
        if (!alive) return
        const all = Array.isArray(d) ? d : Array.isArray(d?.items) ? d.items : []
        const found = all.find((r) => String(r.id) === String(openId))
        if (found) setOpenRow(found)
        else { toast.info("ไม่พบคำร้องที่ต้องการ", { description: "อาจถูกลบหรือคุณไม่มีสิทธิ์ดู" }); setOpenId(null) }
      })
      .catch(() => setOpenId(null))
    return () => { alive = false }
  }, [openId, rows, loading])

  const openReport = (r) => setOpenId(String(r.id))
  const closeReport = () => {
    setOpenId(null)
    if (params.get("id")) {
      setParams((prev) => { const p = new URLSearchParams(prev); p.delete("id"); return p }, { replace: true, state: keepBackState() })
    }
  }

  const statusItems = [
    { value: "pending", label: "ค้างพิจารณา", count: status === "pending" && !overdueOnly && !category && rows.length ? rows.length : null },
    { value: "resolved", label: "แก้ไขแล้ว" },
    { value: "rejected", label: "ปฏิเสธ" },
    { value: "all", label: "ทั้งหมด" },
  ]

  const branchOf = (r) => (r.branch_id != null ? branches[String(r.branch_id)] : null)
  const decideLabel = (r) => (r.status === "pending" && canDecide ? "พิจารณา" : "ดู")

  const emptyTitle = overdueOnly
    ? "ไม่มีคำร้องที่เกินกำหนด"
    : status === "pending" ? "ไม่มีคำร้องค้างพิจารณา" : "ไม่พบคำร้อง"
  const emptyDesc = overdueOnly
    ? "ทุกคำร้องได้รับการพิจารณาภายในกำหนด"
    : status === "pending" ? "คำร้องใหม่จากพนักงานจะแสดงที่นี่" : category ? "ลองเปลี่ยนหมวดหมู่" : "ยังไม่มีคำร้องในสถานะนี้"

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <Tabs items={statusItems} value={status} onChange={(v) => { setStatus(v); if (v !== "pending") setOverdueOnly(false) }} ariaLabel="สถานะคำร้อง" idBase={idBase} />
        {status === "pending" && (
          <button
            type="button"
            aria-pressed={overdueOnly}
            onClick={() => setOverdueOnly((v) => !v)}
            className={cx(
              "inline-flex h-9 items-center gap-1.5 rounded-full px-3 text-sm font-medium ring-1 ring-inset transition-colors duration-150 cursor-pointer",
              overdueOnly
                ? "bg-red-600 text-white ring-red-600 hover:bg-red-500 dark:bg-red-500/90 dark:ring-red-400"
                : "bg-white text-red-700 ring-red-200 hover:bg-red-50 dark:bg-transparent dark:text-red-300 dark:ring-red-400/30 dark:hover:bg-red-500/10",
              focusRingCls
            )}
          >
            <Clock aria-hidden="true" className="size-3.5" />
            เกินกำหนด
            {overdueCount != null && <span className="tabular-nums">({overdueCount})</span>}
          </button>
        )}
        {categories.length > 0 && (
          <div className="w-full sm:ml-auto sm:w-56">
            <SelectDropdown
              size="sm"
              ariaLabel="กรองตามหมวดหมู่"
              value={category}
              onChange={setCategory}
              showSwatch={false}
              options={[{ value: "", label: "ทุกหมวดหมู่" }, ...categories]}
            />
          </div>
        )}
      </div>

      <div role="tabpanel" id={panelId(idBase, status)} aria-labelledby={tabId(idBase, status)} tabIndex={0} className={cx("space-y-3", tabPanelCls)}>
        {error ? (
          <ErrorState message={error} onRetry={reload} />
        ) : isPhone ? (
          <DataList
            items={sorted}
            keyOf={(r) => r.id}
            loading={loading}
            skeletonRows={3}
            title={(r) => r.field_label || r.field_name}
            subtitle={(r) => `${fullName(r)}${branchOf(r) ? ` · ${branchOf(r)}` : ""}`}
            badge={(r) => (r.overdue ? <OverdueBadge /> : <Badge tone={issueStatus(r.status).tone}>{issueStatus(r.status).label}</Badge>)}
            fields={[
              { label: "ค่าเดิม → ค่าใหม่", value: (r) => <ValueChange row={r} />, span: 2 },
              { label: "ส่งเมื่อ", value: (r) => `${fmtShortDate(r.created_at)} · ${ageText(r)}` },
              { label: "ไฟล์แนบ", value: (r) => (r.attachments?.length ? `${r.attachments.length} ไฟล์` : "—"), align: "right" },
            ]}
            onClick={openReport}
            emptyState={<EmptyState title={emptyTitle} description={emptyDesc} />}
          />
        ) : (
          <div className={cx(cardCls, "overflow-x-auto")}>
            <table className="w-full min-w-[56rem] text-sm">
              <caption className="sr-only">รายการคำร้องแจ้งแก้ไขข้อมูล</caption>
              <thead className="border-b border-gray-200 text-left text-xs font-semibold text-gray-500 dark:border-line dark:text-gray-400">
                <tr>
                  <th scope="col" className="px-4 py-2.5">พนักงาน</th>
                  <th scope="col" className="px-4 py-2.5">ข้อมูลที่แจ้ง</th>
                  <th scope="col" className="px-4 py-2.5">ค่าเดิม → ค่าใหม่</th>
                  <th scope="col" className="px-4 py-2.5">ไฟล์แนบ</th>
                  <th scope="col" className="px-4 py-2.5">ส่งเมื่อ</th>
                  <th scope="col" className="px-4 py-2.5">สถานะ</th>
                  <th scope="col" className="px-4 py-2.5"><span className="sr-only">การดำเนินการ</span></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-line">
                {loading ? (
                  <tr><td colSpan={7} className="p-3"><SkeletonTableRows rows={4} cols={6} /></td></tr>
                ) : sorted.length === 0 ? (
                  <tr><td colSpan={7}><EmptyState title={emptyTitle} description={emptyDesc} /></td></tr>
                ) : sorted.map((r) => {
                  const st = issueStatus(r.status)
                  return (
                    <tr
                      key={r.id}
                      onClick={() => openReport(r)}
                      className={cx(
                        "align-top cursor-pointer transition-colors duration-150 hover:bg-gray-50 dark:hover:bg-white/[.03]",
                        r.overdue && "bg-red-50/40 dark:bg-red-500/[.04]"
                      )}
                    >
                      <td className="px-4 py-3">
                        <p className="font-medium text-gray-900 dark:text-gray-100">{fullName(r)}</p>
                        {branchOf(r) && <p className="text-xs text-gray-500 dark:text-gray-400">{branchOf(r)}</p>}
                      </td>
                      <td className="px-4 py-3">
                        <p className="text-gray-900 dark:text-gray-100">{r.field_label || r.field_name}</p>
                        <p className="text-xs text-gray-500 dark:text-gray-400">{r.category_label || r.category}</p>
                      </td>
                      <td className="max-w-[18rem] px-4 py-3"><ValueChange row={r} /></td>
                      <td className="px-4 py-3">
                        {r.attachments?.length ? (
                          <span className="inline-flex items-center gap-1 tabular-nums text-gray-700 dark:text-gray-300">
                            <Paperclip aria-hidden="true" className="size-3.5" /> {r.attachments.length}
                            <span className="sr-only">ไฟล์</span>
                          </span>
                        ) : <span className="text-gray-400 dark:text-gray-500">—</span>}
                      </td>
                      <td className="whitespace-nowrap px-4 py-3">
                        <p className="tabular-nums text-gray-900 dark:text-gray-100">{fmtShortDate(r.created_at)}</p>
                        <p className={cx("text-xs tabular-nums", r.overdue ? "font-semibold text-red-700 dark:text-red-300" : "text-gray-500 dark:text-gray-400")}>{ageText(r)}</p>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex flex-col items-start gap-1">
                          <Badge tone={st.tone}>{st.label}</Badge>
                          {r.overdue && <OverdueBadge />}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <button
                          type="button"
                          onClick={(e) => { e.stopPropagation(); openReport(r) }}
                          aria-label={`${decideLabel(r)}คำร้องของ ${fullName(r)} — ${r.field_label || r.field_name}`}
                          className={cx(
                            r.status === "pending" && canDecide
                              ? "inline-flex h-9 items-center rounded-lg bg-indigo-600 px-3 text-sm font-semibold text-white hover:bg-indigo-500"
                              : "inline-flex h-9 items-center rounded-lg px-3 text-sm font-medium text-indigo-700 hover:bg-indigo-50 dark:text-indigo-300 dark:hover:bg-indigo-500/10",
                            "transition-colors duration-150 cursor-pointer",
                            focusRingCls
                          )}
                        >
                          {decideLabel(r)}
                        </button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {openRow && (
        <ReportSheet
          key={openRow.id}
          report={openRow}
          branchName={branchOf(openRow)}
          canDecide={canDecide}
          onClose={closeReport}
          onDone={() => { closeReport(); reload() }}
        />
      )}
    </div>
  )
}
