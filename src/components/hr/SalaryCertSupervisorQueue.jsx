// src/components/hr/SalaryCertSupervisorQueue.jsx
// ─────────────────────────────────────────────────────────────────────────────
// คิว "ให้ความเห็นผู้บังคับบัญชา" ของคำขอหนังสือรับรองเงินเดือน (3M · PR 44) — วางในกล่องงาน
//   GET   /hr/salary-cert-requests/supervisor-queue          ทุกคนที่ล็อกอินเรียกได้; ไม่ใช่หัวหน้า → []
//   PATCH /hr/salary-cert-requests/{id}/supervisor-opinion   { opinion: agree|disagree, comment }
//         comment บังคับเมื่อ disagree (422) · 403 ไม่ใช่หัวหน้าของผู้ยื่น · 400 ขั้นนี้ผ่านไปแล้ว
// คิวว่าง / โหลดไม่ได้ → ไม่แสดงอะไร (ส่วนนี้เป็นงานเสริมของกล่องงาน ไม่ควรบังงานหลัก)
// ─────────────────────────────────────────────────────────────────────────────
import { useCallback, useEffect, useId, useState } from "react"
import { apiAuth } from "../../lib/api"
import { apiDetail } from "../../lib/apiErrors"
import { thaiDate } from "../../lib/loans"
import { requestNotificationsRefresh } from "../../lib/approvalActions"
import { salaryCertPurposeLabel } from "../../lib/salaryCert"
import {
  cx, baseField, cardCls, labelCls, helpTextCls, errorTextCls, primaryBtnCls, neutralBtnCls,
  segmentedCls, segmentedItemCls, segmentedItemActiveCls,
} from "../../lib/styles"
import { Sheet, toast } from "../ui"

const OPINIONS = [
  { value: "agree", label: "เห็นด้วย" },
  { value: "disagree", label: "ไม่เห็นด้วย" },
]

function OpinionSheet({ req, onClose, onDone }) {
  const uid = useId()
  const [opinion, setOpinion] = useState("agree")
  const [comment, setComment] = useState("")
  const [error, setError] = useState("")
  const [busy, setBusy] = useState(false)

  const submit = async (ev) => {
    ev?.preventDefault()
    const text = comment.trim()
    if (opinion === "disagree" && !text) {
      setError("ระบุเหตุผลที่ไม่เห็นด้วย")
      document.getElementById(`${uid}-comment`)?.focus()
      return
    }
    setBusy(true)
    try {
      await apiAuth(`/hr/salary-cert-requests/${req.id}/supervisor-opinion`, {
        method: "PATCH",
        body: { opinion, comment: text || null },
      })
      toast.success("บันทึกความเห็นแล้ว", { description: "ส่งต่อให้ผู้จัดการพิจารณา" })
      requestNotificationsRefresh()
      onDone()
    } catch (e) {
      toast.error("บันทึกความเห็นไม่สำเร็จ", { description: apiDetail(e) || e?.message })
      // 403/400 = คำขอนี้ไม่ใช่ของเราแล้ว → โหลดคิวใหม่ให้ตรงกับ server
      if (e?.status === 403 || e?.status === 400) onDone()
    } finally {
      setBusy(false)
    }
  }

  const pick = (v) => {
    setOpinion(v)
    if (v === "agree") setError("")
  }

  const onKeyDownGroup = (e) => {
    if (!["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"].includes(e.key)) return
    e.preventDefault()
    const i = OPINIONS.findIndex((o) => o.value === opinion)
    const next = OPINIONS[(i + 1) % OPINIONS.length].value
    pick(next)
    document.getElementById(`${uid}-op-${next}`)?.focus()
  }

  return (
    <Sheet
      open
      onClose={onClose}
      busy={busy}
      size="sm"
      title="ความเห็นผู้บังคับบัญชา"
      subtitle={`${req.user_name ?? "พนักงาน"} · ${salaryCertPurposeLabel(req.purpose_type)}`}
      footer={
        <div className="grid grid-cols-2 gap-3 md:flex md:justify-end md:gap-2">
          <button type="button" onClick={onClose} disabled={busy} className={cx(neutralBtnCls, "h-12 md:h-10")}>ยกเลิก</button>
          <button type="submit" form={`${uid}-form`} disabled={busy} className={cx(primaryBtnCls, "h-12 md:h-10")}>
            {busy ? "กำลังบันทึก…" : "ส่งความเห็น"}
          </button>
        </div>
      }
    >
      <form id={`${uid}-form`} onSubmit={submit} noValidate className="space-y-4">
        <dl className="grid grid-cols-[auto_minmax(0,1fr)] gap-x-3 gap-y-1 text-sm">
          <dt className="text-gray-500 dark:text-gray-400">สาขา</dt>
          <dd className="text-gray-800 dark:text-gray-200">{req.branch_name || "—"}</dd>
          <dt className="text-gray-500 dark:text-gray-400">จำนวน</dt>
          <dd className="tabular-nums text-gray-800 dark:text-gray-200">{req.copies_count ?? 1} ฉบับ</dd>
          <dt className="text-gray-500 dark:text-gray-400">วันที่ยื่น</dt>
          <dd className="tabular-nums text-gray-800 dark:text-gray-200">{thaiDate(req.requested_at || req.created_at, { long: true })}</dd>
        </dl>

        <div>
          <p id={`${uid}-op-label`} className={labelCls}>ความเห็น</p>
          <div role="radiogroup" aria-labelledby={`${uid}-op-label`} onKeyDown={onKeyDownGroup} className={segmentedCls}>
            {OPINIONS.map((o) => {
              const active = opinion === o.value
              return (
                <button
                  key={o.value}
                  id={`${uid}-op-${o.value}`}
                  type="button"
                  role="radio"
                  aria-checked={active}
                  tabIndex={active ? 0 : -1}
                  onClick={() => pick(o.value)}
                  className={cx(
                    segmentedItemCls,
                    active && segmentedItemActiveCls,
                    active && o.value === "disagree" && "!text-amber-800 dark:!text-amber-200",
                  )}
                >
                  {o.label}
                </button>
              )
            })}
          </div>
          <p className={helpTextCls}>ไม่ว่าจะเห็นด้วยหรือไม่ คำขอจะส่งต่อให้ผู้จัดการเป็นผู้อนุมัติ</p>
        </div>

        <div>
          <label htmlFor={`${uid}-comment`} className={labelCls}>
            หมายเหตุ{opinion === "disagree"
              ? <span className="text-red-600 dark:text-red-400" aria-hidden="true"> *</span>
              : <span className="font-normal text-gray-500 dark:text-gray-400"> (ถ้ามี)</span>}
          </label>
          <textarea
            id={`${uid}-comment`}
            rows={3}
            maxLength={500}
            value={comment}
            onChange={(e) => { setComment(e.target.value); if (error) setError("") }}
            aria-required={opinion === "disagree" || undefined}
            aria-invalid={!!error || undefined}
            aria-describedby={error ? `${uid}-comment-err` : undefined}
            placeholder={opinion === "disagree" ? "เหตุผลที่ไม่เห็นด้วย" : "เช่น ทำงานดี มีวินัย"}
            className={cx(baseField, "!rounded-lg !px-3 !py-2 md:!text-sm resize-y", error && "!border-red-500 dark:!border-red-400")}
          />
          {error && <p id={`${uid}-comment-err`} className={errorTextCls}>{error}</p>}
        </div>
      </form>
    </Sheet>
  )
}

/**
 * ส่วน "ขอหนังสือรับรองเงินเดือน — รอความเห็นคุณ" ในกล่องงาน
 * `onCount(n)` แจ้งจำนวนรายการให้หน้ากล่องงาน (null = โหลดไม่ได้)
 */
export default function SalaryCertSupervisorQueue({ onCount }) {
  const uid = useId()
  const [items, setItems] = useState(null)
  const [active, setActive] = useState(null)

  const load = useCallback(() => {
    apiAuth("/hr/salary-cert-requests/supervisor-queue")
      .then((d) => {
        const list = Array.isArray(d) ? d : d?.items ?? []
        // รอนานสุดก่อน
        setItems([...list].sort((a, b) => String(a.requested_at || a.created_at || "").localeCompare(String(b.requested_at || b.created_at || ""))))
      })
      .catch(() => setItems([]))
  }, [])

  useEffect(() => { load() }, [load])
  useEffect(() => { if (items) onCount?.(items.length) }, [items, onCount])

  if (!items?.length) return null

  return (
    <section aria-labelledby={`${uid}-h`} className={cx(cardCls, "p-5")}>
      <h2 id={`${uid}-h`} className="text-base font-semibold text-gray-900 dark:text-gray-100">
        หนังสือรับรองเงินเดือน — รอความเห็นคุณ
        <span className="ml-2 text-sm font-normal tabular-nums text-gray-500 dark:text-gray-400">{items.length} รายการ</span>
      </h2>
      <p className="mt-0.5 text-sm text-gray-500 dark:text-gray-400">ในฐานะผู้บังคับบัญชา ให้ความเห็นก่อนส่งผู้จัดการอนุมัติ</p>

      <ul className="mt-3 divide-y divide-gray-100 dark:divide-line">
        {items.map((r) => (
          <li key={r.id} className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2 py-3 first:pt-0 last:pb-0">
            <div className="min-w-0">
              <p className="truncate font-medium text-gray-900 dark:text-gray-100">{r.user_name || `พนักงานรหัส ${r.user_id}`}</p>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                {[r.branch_name, salaryCertPurposeLabel(r.purpose_type), `${r.copies_count ?? 1} ฉบับ`].filter(Boolean).join(" · ")}
                {" · "}<span className="tabular-nums">ยื่น {thaiDate(r.requested_at || r.created_at)}</span>
              </p>
            </div>
            <button
              type="button"
              onClick={() => setActive(r)}
              className={cx(primaryBtnCls, "!h-11 md:!h-9 !px-3")}
              aria-label={`ให้ความเห็นคำขอของ ${r.user_name || `พนักงานรหัส ${r.user_id}`}`}
            >
              ให้ความเห็น
            </button>
          </li>
        ))}
      </ul>

      {active && (
        <OpinionSheet
          req={active}
          onClose={() => setActive(null)}
          onDone={() => { setActive(null); load() }}
        />
      )}
    </section>
  )
}
