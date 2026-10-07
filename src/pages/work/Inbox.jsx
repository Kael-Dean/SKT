// src/pages/work/Inbox.jsx
// กล่องงานรออนุมัติ — real approval queue for 3B (leave) + 3O (out-of-office).
// api-handoff งวด 2 §1–§4.
//   leave: GET /hr/leave-requests            → approve/deny per stage
//   3O   : GET /hr/out-of-office?status=…    → approve/reject per stage
// Deep link (?type=leave|out_of_office&id=N) from NotificationBell opens the
// detail after re-checking the request's *current* status (notifications can
// be stale). One source failing (e.g. 403 for the role) never hides the other.
import { useCallback, useEffect, useMemo, useState } from "react"
import { useNavigate, useSearchParams } from "react-router-dom"
import Portal from "../../components/Portal"
import DecisionModal from "../../components/DecisionModal"
import { EmptyState } from "../../components/ui"
import { getRoleId, getUser } from "../../lib/auth"
import { apiAuth } from "../../lib/api"
import {
  APPROVAL_ROLE,
  ROLE_LABEL,
  STAGE_APPROVE_LABEL,
  OOO_TYPE_LABEL,
  hhmm,
  isApproverRole,
  isPendingStatus,
  myStageStatus,
  statusLabel,
  statusTone,
  canActOn,
} from "../../lib/approval"
import {
  KIND,
  KIND_LABEL,
  canDecide,
  fmtDateTh,
  fmtDateTimeTh,
  relativeTimeTh,
  rejectionReason,
  requesterName,
  requestNotificationsRefresh,
} from "../../lib/approvalActions"
import useModalDismiss from "../../lib/useModalDismiss"

const cardCls =
  "rounded-2xl bg-white dark:bg-gray-800 shadow-sm ring-1 ring-gray-200/70 dark:ring-gray-700/70 p-5"

// ─── icons ──────────────────────────────────────────────────────────────────
const iconBase = {
  "aria-hidden": "true",
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.8,
  strokeLinecap: "round",
  strokeLinejoin: "round",
}
function IconLeave({ className = "size-5" }) {
  return (
    <svg {...iconBase} className={className}>
      <path d="M9 5H7a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-2" />
      <rect x="9" y="3" width="6" height="4" rx="1" />
      <path d="m9 14 2 2 4-4" />
    </svg>
  )
}
function IconOut({ className = "size-5" }) {
  return (
    <svg {...iconBase} className={className}>
      <path d="M12 21s-6-5.33-6-10a6 6 0 1 1 12 0c0 4.67-6 10-6 10Z" />
      <circle cx="12" cy="11" r="2.2" />
    </svg>
  )
}
function IconInbox({ className = "size-5" }) {
  return (
    <svg {...iconBase} className={className}>
      <path d="M22 12h-6l-2 3h-4l-2-3H2" />
      <path d="M5.45 5.11 2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z" />
    </svg>
  )
}
function IconRefresh({ className = "size-4" }) {
  return (
    <svg {...iconBase} className={className}>
      <path d="M21 12a9 9 0 0 1-15.5 6.2L3 16" />
      <path d="M3 12a9 9 0 0 1 15.5-6.2L21 8" />
      <path d="M21 3v5h-5M3 21v-5h5" />
    </svg>
  )
}
function IconClose({ className = "size-4" }) {
  return (
    <svg {...iconBase} strokeWidth={2} className={className}>
      <path d="M18 6 6 18M6 6l12 12" />
    </svg>
  )
}
const KindIcon = ({ kind, className }) =>
  kind === KIND.OOO ? <IconOut className={className} /> : <IconLeave className={className} />

// ─── normalisation ─────────────────────────────────────────────────────────
function toItem(kind, r) {
  if (kind === KIND.OOO) {
    return {
      key: `${kind}-${r.id}`,
      kind,
      req: r,
      name: requesterName(r),
      title: OOO_TYPE_LABEL[r.request_type] || "ขอออกนอกสถานที่",
      when: `${fmtDateTh(r.request_date)} เวลา ${hhmm(r.time_out)}–${hhmm(r.time_back)} น.`,
      place: r.place,
      reason: r.reason,
      submittedAt: r.created_at,
    }
  }
  const time = r.from_time || r.to_time ? ` (${hhmm(r.from_time)}–${hhmm(r.to_time)} น.)` : ""
  const range = r.from_date === r.to_date ? fmtDateTh(r.from_date) : `${fmtDateTh(r.from_date)} – ${fmtDateTh(r.to_date)}`
  return {
    key: `${kind}-${r.id}`,
    kind,
    req: r,
    name: requesterName(r),
    title: `${r.leave_type_name || "ใบลา"}${r.total_days != null ? ` ${r.total_days} วัน` : ""}`,
    when: `${range}${time}`,
    place: r.address_during_leave,
    reason: r.comment,
    submittedAt: r.created_at,
  }
}

const isMine = (req) => {
  const me = getUser()
  return me?.id != null && req?.user_id != null && Number(me.id) === Number(req.user_id)
}

/** Explains why the opened request is not actionable for this user (null = actionable). */
function stateNotice(req, roleId) {
  if (!req) return null
  const label = statusLabel(req.status)
  if (!isPendingStatus(req.status)) return { tone: "done", text: `คำขอนี้ดำเนินการไปแล้ว (${label})` }
  if (canDecide(req)) return null
  if (roleId !== APPROVAL_ROLE.ADMIN && isMine(req)) {
    return { tone: "info", text: `เป็นคำขอของคุณเอง พิจารณาเองไม่ได้ (${label})` }
  }
  if (!myStageStatus(roleId)) return { tone: "info", text: `สถานะปัจจุบัน: ${label}` }
  // stage check passes but branch doesn't → branch head outside their branches
  if (canActOn({ status: req.status, user_id: req.user_id })) {
    return { tone: "info", text: "คำขอนี้อยู่นอกสาขาที่คุณดูแล" }
  }
  return { tone: "done", text: `คำขอนี้ดำเนินการไปแล้ว (${label})` }
}

const asList = (data) => (Array.isArray(data) ? data : Array.isArray(data?.items) ? data.items : [])

// ─── small pieces ───────────────────────────────────────────────────────────
function StatusBadge({ status }) {
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${statusTone(status)}`}>
      {statusLabel(status)}
    </span>
  )
}

function Notice({ tone = "info", children, onDismiss }) {
  const toneCls = {
    success: "bg-emerald-50 text-emerald-800 ring-emerald-200 dark:bg-emerald-500/10 dark:text-emerald-200 dark:ring-emerald-500/30",
    error: "bg-red-50 text-red-800 ring-red-200 dark:bg-red-500/10 dark:text-red-200 dark:ring-red-500/30",
    warn: "bg-amber-50 text-amber-900 ring-amber-200 dark:bg-amber-500/10 dark:text-amber-200 dark:ring-amber-500/30",
    info: "bg-sky-50 text-sky-900 ring-sky-200 dark:bg-sky-500/10 dark:text-sky-200 dark:ring-sky-500/30",
    done: "bg-gray-100 text-gray-800 ring-gray-200 dark:bg-gray-700/60 dark:text-gray-100 dark:ring-gray-600",
  }[tone]
  return (
    <div
      role={tone === "error" ? "alert" : "status"}
      className={`flex items-start gap-3 rounded-xl px-4 py-3 text-sm ring-1 ${toneCls}`}
    >
      <div className="min-w-0 flex-1 break-words">{children}</div>
      {onDismiss && (
        <button
          type="button"
          onClick={onDismiss}
          aria-label="ปิดข้อความ"
          className="-m-1 shrink-0 cursor-pointer rounded-lg p-1 opacity-70 transition hover:opacity-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
        >
          <IconClose className="size-3.5" />
        </button>
      )}
    </div>
  )
}

function InboxCard({ item, onView, onDecide }) {
  const { req } = item
  return (
    <article className={`${cardCls} space-y-3`}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-gray-500 dark:text-gray-400">
            <KindIcon kind={item.kind} className="size-4" />
          </span>
          <span className="rounded-lg bg-gray-100 px-2 py-0.5 text-xs font-semibold text-gray-600 dark:bg-gray-700 dark:text-gray-300">
            {KIND_LABEL[item.kind]}
          </span>
          <span className="text-xs text-gray-400 dark:text-gray-500 tabular-nums">#{req.id}</span>
        </div>
        <StatusBadge status={req.status} />
      </div>

      <div>
        <p className="text-sm font-semibold leading-snug text-gray-900 dark:text-gray-100">
          {item.name}
          <span className="font-normal text-gray-500 dark:text-gray-400"> ขอ</span>
          {item.title}
        </p>
        <p className="mt-1 text-sm text-gray-600 dark:text-gray-300">{item.when}</p>
        {item.kind === KIND.OOO && item.place && (
          <p className="mt-0.5 text-sm text-gray-600 dark:text-gray-300">สถานที่: {item.place}</p>
        )}
        {item.reason && (
          <p className="mt-2 line-clamp-2 rounded-lg bg-gray-50 px-3 py-1.5 text-xs text-gray-600 dark:bg-gray-700/40 dark:text-gray-300">
            เหตุผล: {item.reason}
          </p>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-2 border-t border-gray-100 pt-3 dark:border-gray-700/50">
        <span className="mr-auto text-xs text-gray-500 dark:text-gray-400" title={fmtDateTimeTh(item.submittedAt)}>
          ยื่นเมื่อ {relativeTimeTh(item.submittedAt) || "—"}
        </span>
        <button
          type="button"
          onClick={() => onView(item)}
          className="rounded-lg border border-indigo-300 px-3 py-1.5 text-xs font-semibold text-indigo-700 transition hover:bg-indigo-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 dark:border-indigo-700 dark:text-indigo-300 dark:hover:bg-indigo-900/20 cursor-pointer"
        >
          ดูรายละเอียด
        </button>
        <button
          type="button"
          onClick={() => onDecide(item, "reject")}
          className="rounded-lg border border-red-300 px-3 py-1.5 text-xs font-semibold text-red-700 transition hover:bg-red-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-red-500 dark:border-red-800 dark:text-red-300 dark:hover:bg-red-900/20 cursor-pointer"
        >
          ไม่อนุมัติ
        </button>
        <button
          type="button"
          onClick={() => onDecide(item, "approve")}
          className="rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white shadow-sm transition hover:bg-emerald-500 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-1 dark:focus-visible:ring-offset-gray-800 cursor-pointer"
        >
          {STAGE_APPROVE_LABEL[req.status] || "อนุมัติ"}
        </button>
      </div>
    </article>
  )
}

// ─── Detail modal ───────────────────────────────────────────────────────────
function DetailModal({ state, roleId, onClose, onDecide }) {
  const { backdropProps } = useModalDismiss(onClose)

  const { loading, item, error } = state
  const req = item?.req
  const notice = req ? stateNotice(req, roleId) : null
  const reason = rejectionReason(req)
  const actionable = req && !notice

  const rows = !item
    ? []
    : item.kind === KIND.OOO
      ? [
          ["ผู้ยื่น", item.name],
          ["ประเภท", item.title],
          ["วันและเวลา", item.when],
          ["สถานที่", req.place],
          ["เหตุผล", req.reason],
          ["วันที่ยื่น", fmtDateTimeTh(req.created_at)],
        ]
      : [
          ["ผู้ยื่น", item.name],
          ["ประเภทการลา", req.leave_type_name],
          ["ช่วงวันลา", item.when],
          ["จำนวนวัน", req.total_days != null ? `${req.total_days} วัน` : null],
          ["เหตุผล", req.comment],
          ["ที่อยู่ระหว่างลา", [req.address_during_leave, req.contact_during_leave && `โทร. ${req.contact_during_leave}`].filter(Boolean).join(" · ")],
          ["วันที่ยื่น", fmtDateTimeTh(req.created_at)],
        ]

  return (
    <Portal>
      <div className="fixed inset-0 z-[10055] flex items-center justify-center p-4" role="dialog" aria-modal="true" aria-labelledby="inbox-detail-title">
        <button type="button" aria-label="ปิด" tabIndex={-1} {...backdropProps} className="absolute inset-0 cursor-pointer bg-black/50 backdrop-blur-sm" />
        <div className="relative max-h-[90vh] w-full max-w-lg space-y-4 overflow-y-auto rounded-2xl bg-white p-6 shadow-2xl ring-1 ring-gray-200/70 dark:bg-gray-800 dark:ring-gray-700/70">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="mb-1 flex items-center gap-2 text-gray-500 dark:text-gray-400">
                <KindIcon kind={state.kind} className="size-4" />
                <span className="text-xs font-semibold">
                  {KIND_LABEL[state.kind]} <span className="tabular-nums">#{state.id}</span>
                </span>
              </div>
              <h2 id="inbox-detail-title" className="text-base font-bold leading-snug text-gray-900 dark:text-gray-100">
                {item ? `${item.name} ขอ${item.title}` : "รายละเอียดคำขอ"}
              </h2>
            </div>
            <button
              type="button"
              onClick={onClose}
              aria-label="ปิด"
              className="flex h-8 w-8 shrink-0 cursor-pointer items-center justify-center rounded-lg text-gray-400 transition hover:bg-gray-100 hover:text-gray-600 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 dark:hover:bg-gray-700 dark:hover:text-gray-200"
            >
              <IconClose />
            </button>
          </div>

          {loading ? (
            <div className="space-y-2" aria-busy="true">
              <p className="text-sm text-gray-500 dark:text-gray-400">กำลังตรวจสอบสถานะล่าสุด…</p>
              {[0, 1, 2, 3].map((i) => (
                <div key={i} className="h-8 animate-pulse rounded-lg bg-gray-100 motion-reduce:animate-none dark:bg-gray-700/60" />
              ))}
            </div>
          ) : error ? (
            <Notice tone="warn">{error}</Notice>
          ) : (
            <>
              {notice && <Notice tone={notice.tone}>{notice.text}</Notice>}

              <dl className="divide-y divide-gray-100 rounded-xl bg-gray-50 dark:divide-gray-700/50 dark:bg-gray-700/40">
                {rows
                  .filter(([, v]) => v)
                  .map(([k, v]) => (
                    <div key={k} className="flex items-baseline gap-3 px-4 py-2.5 text-sm">
                      <dt className="w-28 shrink-0 text-xs text-gray-500 dark:text-gray-400">{k}</dt>
                      <dd className="min-w-0 break-words font-medium text-gray-800 dark:text-gray-200">{v}</dd>
                    </div>
                  ))}
                <div className="flex items-center gap-3 px-4 py-2.5 text-sm">
                  <dt className="w-28 shrink-0 text-xs text-gray-500 dark:text-gray-400">สถานะ</dt>
                  <dd>
                    <StatusBadge status={req.status} />
                  </dd>
                </div>
                {reason && (
                  <div className="flex items-baseline gap-3 px-4 py-2.5 text-sm">
                    <dt className="w-28 shrink-0 text-xs text-gray-500 dark:text-gray-400">เหตุผลที่ไม่อนุมัติ</dt>
                    <dd className="min-w-0 break-words font-medium text-red-700 dark:text-red-300">{reason}</dd>
                  </div>
                )}
              </dl>
            </>
          )}

          <div className="flex flex-wrap gap-3 pt-1">
            {actionable ? (
              <>
                <button
                  type="button"
                  onClick={() => onDecide(item, "reject")}
                  className="h-10 flex-1 cursor-pointer rounded-xl border border-red-300 text-sm font-semibold text-red-700 transition duration-200 hover:bg-red-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-red-500 dark:border-red-800 dark:text-red-300 dark:hover:bg-red-900/20"
                >
                  ไม่อนุมัติ
                </button>
                <button
                  type="button"
                  onClick={() => onDecide(item, "approve")}
                  className="h-10 flex-1 cursor-pointer rounded-xl bg-emerald-600 text-sm font-semibold text-white shadow-sm transition duration-200 hover:bg-emerald-500 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-1 dark:focus-visible:ring-offset-gray-800"
                >
                  {STAGE_APPROVE_LABEL[req.status] || "อนุมัติ"}
                </button>
              </>
            ) : (
              <button
                type="button"
                onClick={onClose}
                className="h-10 w-full cursor-pointer rounded-xl border border-gray-300 text-sm font-semibold text-gray-600 transition duration-200 hover:bg-gray-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-700"
              >
                ปิด
              </button>
            )}
          </div>
        </div>
      </div>
    </Portal>
  )
}

// ─── data loading ───────────────────────────────────────────────────────────
async function loadQueue(kind, stage) {
  const base = kind === KIND.OOO ? "/hr/out-of-office" : "/hr/leave-requests"
  const data = await apiAuth(stage ? `${base}?status=${stage}` : base)
  return asList(data)
    .filter((r) => isPendingStatus(r.status))
    .filter((r) => canDecide(r))
    .map((r) => toItem(kind, r))
}

/** Fresh lookup of one request: HR list first, then the user's own list. */
async function lookupRequest(kind, id) {
  const hrPath = kind === KIND.OOO ? "/hr/out-of-office" : "/hr/leave-requests"
  const mePath = kind === KIND.OOO ? "/personnel/me/out-of-office" : "/personnel/me/leaves"
  const roleId = getRoleId()
  let firstErr = null
  const paths = isApproverRole(roleId) || roleId === APPROVAL_ROLE.HR ? [hrPath, mePath] : [mePath]
  for (const p of paths) {
    try {
      const found = asList(await apiAuth(p)).find((r) => String(r.id) === String(id))
      if (found) return found
    } catch (err) {
      firstErr = firstErr || err
    }
  }
  if (firstErr && firstErr.status !== 403) throw firstErr
  return null
}

const TABS = [
  { value: "all", label: "ทั้งหมด" },
  { value: KIND.LEAVE, label: "ใบลา" },
  { value: KIND.OOO, label: "ขอออกนอกสถานที่" },
]

// ─── page ───────────────────────────────────────────────────────────────────
export default function Inbox() {
  const navigate = useNavigate()
  const [params, setParams] = useSearchParams()
  const roleId = getRoleId()
  const approver = isApproverRole(roleId)
  const stage = myStageStatus(roleId)

  const [items, setItems] = useState({ [KIND.LEAVE]: [], [KIND.OOO]: [] })
  const [srcError, setSrcError] = useState({ [KIND.LEAVE]: "", [KIND.OOO]: "" })
  const [loading, setLoading] = useState(approver)
  const [tab, setTab] = useState("all")
  const [banner, setBanner] = useState(null) // {tone, text}
  const [detail, setDetail] = useState(null) // {kind, id, loading, item?, error?, fromLink}
  const [decision, setDecision] = useState(null) // {item, mode}

  const refetch = useCallback(async () => {
    if (!approver) return
    setLoading(true)
    const kinds = [KIND.LEAVE, KIND.OOO]
    const results = await Promise.allSettled(kinds.map((k) => loadQueue(k, stage)))
    const nextItems = {}
    const nextErr = {}
    results.forEach((r, i) => {
      const k = kinds[i]
      nextItems[k] = r.status === "fulfilled" ? r.value : []
      nextErr[k] = r.status === "rejected" ? r.reason?.message || "โหลดข้อมูลไม่สำเร็จ" : ""
    })
    setItems(nextItems)
    setSrcError(nextErr)
    setLoading(false)
  }, [approver, stage])

  useEffect(() => {
    refetch()
  }, [refetch])

  // auto-dismiss success banner
  useEffect(() => {
    if (banner?.tone !== "success") return
    const t = setTimeout(() => setBanner(null), 5000)
    return () => clearTimeout(t)
  }, [banner])

  // ── deep link ?type=&id= ──
  const linkType = params.get("type")
  const linkId = params.get("id")
  useEffect(() => {
    if (!linkId || (linkType !== KIND.LEAVE && linkType !== KIND.OOO)) return
    let alive = true
    setDetail({ kind: linkType, id: linkId, loading: true, fromLink: true })
    lookupRequest(linkType, linkId)
      .then((req) => {
        if (!alive) return
        setDetail({
          kind: linkType,
          id: linkId,
          loading: false,
          fromLink: true,
          item: req ? toItem(linkType, req) : null,
          error: req ? "" : "ไม่พบคำขอนี้ หรือคุณไม่มีสิทธิ์ดูคำขอนี้",
        })
      })
      .catch((err) => {
        if (!alive) return
        setDetail({ kind: linkType, id: linkId, loading: false, fromLink: true, error: err?.message || "โหลดคำขอไม่สำเร็จ" })
      })
    return () => {
      alive = false
    }
  }, [linkType, linkId])

  const detailFromLink = !!detail?.fromLink
  const closeDetail = useCallback(() => {
    if (detailFromLink) setParams({}, { replace: true })
    setDetail(null)
  }, [detailFromLink, setParams])

  const openDetail = (item) => {
    // re-check current status even for list items (list may be a minute old)
    setDetail({ kind: item.kind, id: item.req.id, loading: true, item })
    lookupRequest(item.kind, item.req.id)
      .then((req) =>
        setDetail((d) =>
          d && String(d.id) === String(item.req.id)
            ? { ...d, loading: false, item: req ? toItem(item.kind, req) : item }
            : d,
        ),
      )
      .catch(() => setDetail((d) => (d ? { ...d, loading: false } : d)))
  }

  const openDecision = (item, mode) => {
    if (detail) closeDetail()
    setDecision({ item, mode })
  }

  const onDecisionDone = (mode) => {
    const { item } = decision
    setDecision(null)
    setBanner({
      tone: "success",
      text:
        mode === "approve"
          ? `${STAGE_APPROVE_LABEL[item.req.status] || "อนุมัติ"}คำขอของ ${item.name} แล้ว`
          : `ไม่อนุมัติคำขอของ ${item.name} แล้ว`,
    })
    requestNotificationsRefresh()
    refetch()
  }

  const onDecisionConflict = (err) => {
    setDecision(null)
    setBanner({ tone: "error", text: err?.message || "คำขอนี้มีการเปลี่ยนแปลงแล้ว" })
    refetch()
  }

  const counts = {
    all: items[KIND.LEAVE].length + items[KIND.OOO].length,
    [KIND.LEAVE]: items[KIND.LEAVE].length,
    [KIND.OOO]: items[KIND.OOO].length,
  }

  const visible = useMemo(() => {
    const list = tab === "all" ? [...items[KIND.LEAVE], ...items[KIND.OOO]] : items[tab] || []
    // oldest first — whoever has waited longest is decided first
    return [...list].sort((a, b) => String(a.submittedAt || "").localeCompare(String(b.submittedAt || "")))
  }, [items, tab])

  const roleLine =
    roleId === APPROVAL_ROLE.ADMIN
      ? "คุณพิจารณาในฐานะผู้ดูแลระบบ ทำได้ทุกขั้น"
      : stage
        ? `คุณพิจารณาในฐานะ${ROLE_LABEL[roleId]} · ขั้น${statusLabel(stage)}`
        : "คำขอที่รอคุณพิจารณา"

  const errorKinds = [KIND.LEAVE, KIND.OOO].filter((k) => srcError[k])
  const bothFailed = errorKinds.length === 2

  return (
    <div className="mx-auto max-w-3xl space-y-5 pb-12">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-gray-900 dark:text-gray-100">กล่องงานรออนุมัติ</h1>
          <p className="mt-0.5 text-sm text-gray-500 dark:text-gray-400">{roleLine}</p>
        </div>
        {approver && (
          <button
            type="button"
            onClick={refetch}
            disabled={loading}
            className="inline-flex cursor-pointer items-center gap-1.5 rounded-xl border border-gray-200 bg-white px-3 py-2 text-xs font-semibold text-gray-600 shadow-sm transition duration-200 hover:bg-gray-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 disabled:cursor-wait disabled:opacity-60 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700"
          >
            <IconRefresh className={`size-3.5 ${loading ? "animate-spin motion-reduce:animate-none" : ""}`} />
            โหลดใหม่
          </button>
        )}
      </div>

      {banner && (
        <Notice tone={banner.tone} onDismiss={() => setBanner(null)}>
          {banner.text}
        </Notice>
      )}

      {!approver ? (
        <div className={cardCls}>
          <EmptyState
            icon={<IconInbox className="size-12" />}
            title="ไม่มีงานที่ต้องอนุมัติ"
            description={`บทบาท${ROLE_LABEL[roleId] ? ` "${ROLE_LABEL[roleId]}"` : "ของคุณ"} ไม่ได้อยู่ในสายอนุมัติใบลาหรือคำขอออกนอกสถานที่ ติดตามสถานะคำขอของคุณได้จากการแจ้งเตือนหรือหน้าใบลา`}
            action={
              <button
                type="button"
                onClick={() => navigate("/leave-request")}
                className="rounded-2xl border border-gray-300 bg-white px-4 py-2 text-sm font-semibold text-gray-700 shadow-sm transition-colors hover:bg-gray-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 dark:border-gray-600 dark:bg-gray-700/60 dark:text-gray-200 dark:hover:bg-gray-700/50"
              >
                ไปหน้าใบลาของฉัน
              </button>
            }
          />
        </div>
      ) : (
        <>
          {errorKinds.map((k) => (
            <Notice key={k} tone="warn">
              โหลด{KIND_LABEL[k]}ไม่สำเร็จ: {srcError[k]}
              {!bothFailed && <span className="text-xs opacity-80"> — แสดงเฉพาะรายการที่โหลดได้</span>}
            </Notice>
          ))}

          <div role="tablist" aria-label="ประเภทคำขอ" className="flex w-fit max-w-full gap-1 overflow-x-auto rounded-xl bg-gray-100 p-1 dark:bg-gray-800">
            {TABS.map((t) => (
              <button
                key={t.value}
                type="button"
                role="tab"
                aria-selected={tab === t.value}
                onClick={() => setTab(t.value)}
                className={`inline-flex shrink-0 cursor-pointer items-center gap-1.5 whitespace-nowrap rounded-lg px-4 py-2 text-sm font-semibold transition-all duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 ${
                  tab === t.value
                    ? "bg-white text-indigo-700 shadow-sm dark:bg-gray-700 dark:text-indigo-300"
                    : "text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
                }`}
              >
                {t.label}
                <span
                  className={`rounded-full px-1.5 py-0.5 text-[10px] font-bold tabular-nums ${
                    counts[t.value] > 0
                      ? "bg-amber-500 text-white"
                      : "bg-gray-200 text-gray-500 dark:bg-gray-700 dark:text-gray-400"
                  }`}
                >
                  {loading ? "…" : counts[t.value]}
                </span>
              </button>
            ))}
          </div>

          {loading && visible.length === 0 ? (
            <div className="space-y-3" aria-busy="true" aria-label="กำลังโหลดคำขอ">
              {[0, 1, 2].map((i) => (
                <div key={i} className={`${cardCls} space-y-3`}>
                  <div className="h-4 w-1/3 animate-pulse rounded bg-gray-100 motion-reduce:animate-none dark:bg-gray-700" />
                  <div className="h-4 w-2/3 animate-pulse rounded bg-gray-100 motion-reduce:animate-none dark:bg-gray-700" />
                  <div className="h-8 w-full animate-pulse rounded bg-gray-100 motion-reduce:animate-none dark:bg-gray-700" />
                </div>
              ))}
            </div>
          ) : visible.length === 0 ? (
            bothFailed ? null : (
              <div className={cardCls}>
                <EmptyState
                  icon={<IconInbox className="size-12" />}
                  title={tab === "all" ? "ไม่มีคำขอรอคุณพิจารณา" : `ไม่มี${KIND_LABEL[tab]}รอคุณพิจารณา`}
                  description="เมื่อมีคำขอใหม่ถึงขั้นของคุณ ระบบจะแจ้งเตือนที่กระดิ่งด้านบน"
                />
              </div>
            )
          ) : (
            <div className="space-y-3">
              {visible.map((item) => (
                <InboxCard key={item.key} item={item} onView={openDetail} onDecide={openDecision} />
              ))}
            </div>
          )}
        </>
      )}

      {detail && <DetailModal state={detail} roleId={roleId} onClose={closeDetail} onDecide={openDecision} />}

      {decision && (
        <DecisionModal
          mode={decision.mode}
          kind={decision.item.kind}
          req={decision.item.req}
          title={`${decision.item.name} — ${decision.item.title}`}
          summary={decision.item.when}
          onClose={() => setDecision(null)}
          onDone={onDecisionDone}
          onConflict={onDecisionConflict}
        />
      )}
    </div>
  )
}
