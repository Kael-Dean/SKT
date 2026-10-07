// src/components/hr/kpi/FiscalYearHeader.jsx
// Shared header for every KPI sub-tab: fiscal-year picker (with date range),
// evaluation window + open/closed badge, status progress bar from `counts`,
// and the edit-window dialog (PATCH /hr/kpi/fiscal-years/{fy}/window, roles 1·2·3).
import { useId, useState } from "react"
import { CalendarRange, Pencil } from "lucide-react"
import SelectDropdown from "../../SelectDropdown"
import HrModal, { Notice } from "../HrModal"
import { apiAuth } from "../../../lib/api"
import { cx } from "../../../lib/styles"
import { Badge, ErrorState, Skeleton, toast } from "../../ui"
import { errText, inputCls, labelCls, linkBtn, nf, primaryBtn, secondaryBtn } from "../positionUtils"
import { STATUS, STATUS_ORDER, fmtDay, fyOptions, fyRange, num, windowPhase } from "./kpiUtils"

const SEG = {
  open: "bg-gray-300 dark:bg-gray-600",
  returned: "bg-amber-400 dark:bg-amber-500",
  finalized: "bg-sky-400 dark:bg-sky-500",
  asst_reviewed: "bg-indigo-500 dark:bg-indigo-400",
  approved: "bg-emerald-500 dark:bg-emerald-400",
}

export default function FiscalYearHeader({ fy, onFyChange, fyState, canEditWindow }) {
  const { info, setInfo, loading, error, reload } = fyState
  const [editing, setEditing] = useState(false)
  const selectId = useId()
  const phase = windowPhase(info)
  const counts = info?.counts ?? {}
  const total = STATUS_ORDER.reduce((s, k) => s + (num(counts[k]) ?? 0), 0)
  const pendingHalf = num(counts.pending_half_steps) ?? 0

  return (
    <div className="space-y-4 rounded-2xl bg-gray-50 p-4 ring-1 ring-gray-200/70 dark:bg-gray-900/30 dark:ring-gray-700/60 sm:p-5">
      <div className="flex flex-wrap items-end gap-x-6 gap-y-3">
        <div className="w-full sm:w-56">
          <span id={selectId} className={labelCls}>ปีบัญชี</span>
          <SelectDropdown
            ariaLabelledby={selectId}
            options={fyOptions()}
            value={String(fy)}
            onChange={(v) => onFyChange(Number(v))}
            showSwatch={false}
            showSublabelInTrigger
          />
        </div>

        <div className="min-w-0 flex-1">
          <p className="text-sm text-gray-500 dark:text-gray-400">ช่วงประเมิน (ให้คะแนน)</p>
          {loading && !info ? (
            <Skeleton className="mt-1 h-6 w-64" />
          ) : info ? (
            <div className="mt-0.5 flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center gap-1.5 text-base font-semibold text-gray-900 dark:text-gray-100">
                <CalendarRange aria-hidden="true" className="size-4 text-gray-400 dark:text-gray-500" strokeWidth={1.75} />
                <span className="tabular-nums">{fmtDay(info.window_start)} – {fmtDay(info.window_end)}</span>
              </span>
              {phase === "open" ? (
                <Badge tone="success">เปิดรับคะแนน</Badge>
              ) : (
                <Badge tone="neutral">{phase === "before" ? "ปิดรับคะแนน (ยังไม่ถึงช่วง)" : "ปิดรับคะแนน"}</Badge>
              )}
              {info.window_is_default === false && <Badge tone="pending">ปรับจากค่าเริ่มต้น</Badge>}
              {canEditWindow && (
                <button type="button" className={cx(linkBtn, "inline-flex items-center gap-1")} onClick={() => setEditing(true)}>
                  <Pencil aria-hidden="true" className="size-3.5" strokeWidth={2} />
                  แก้ช่วงประเมิน
                </button>
              )}
            </div>
          ) : null}
        </div>
      </div>

      <p className="hidden text-xs text-gray-500 dark:text-gray-400 sm:block">
        ปีบัญชี {fy} หมายถึง {fyRange(fy)} (ตั้งชื่อตามปีที่เริ่มต้น)
      </p>

      {error && !info && <ErrorState message={error} onRetry={reload} />}

      {info && (
        <div>
          <div className="mb-1.5 flex flex-wrap items-baseline justify-between gap-2 text-sm">
            <span className="font-medium text-gray-700 dark:text-gray-300">
              ความคืบหน้า <span className="tabular-nums">{nf(num(counts.approved) ?? 0)}</span>
              <span className="text-gray-500 dark:text-gray-400">/{nf(total)} อนุมัติแล้ว</span>
            </span>
            {pendingHalf > 0 && (
              <span className="text-xs text-amber-700 dark:text-amber-300">
                รอผลประกอบการ +0.5 ขั้น <span className="tabular-nums font-semibold">{nf(pendingHalf)}</span> คน
              </span>
            )}
          </div>
          <div
            className="flex h-2.5 w-full overflow-hidden rounded-full bg-gray-100 dark:bg-gray-700/60"
            role="img"
            aria-label={STATUS_ORDER.map((k) => `${STATUS[k].label} ${num(counts[k]) ?? 0}`).join(", ")}
          >
            {total > 0 &&
              STATUS_ORDER.map((k) => {
                const n = num(counts[k]) ?? 0
                if (!n) return null
                return <span key={k} className={cx("h-full", SEG[k])} style={{ width: `${(n / total) * 100}%` }} />
              })}
          </div>
          <ul className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-gray-600 dark:text-gray-400">
            {STATUS_ORDER.map((k) => (
              <li key={k} className="inline-flex items-center gap-1.5">
                <span aria-hidden="true" className={cx("size-2 rounded-full", SEG[k])} />
                {STATUS[k].label}
                <span className="font-semibold tabular-nums text-gray-900 dark:text-gray-100">{nf(num(counts[k]) ?? 0)}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {editing && info && (
        <WindowDialog
          fy={fy}
          info={info}
          onClose={() => setEditing(false)}
          onSaved={(next) => { setInfo(next); setEditing(false) }}
        />
      )}
    </div>
  )
}

function WindowDialog({ fy, info, onClose, onSaved }) {
  const [start, setStart] = useState(String(info.window_start ?? "").slice(0, 10))
  const [end, setEnd] = useState(String(info.window_end ?? "").slice(0, 10))
  const [saving, setSaving] = useState(false)
  const [err, setErr] = useState("")
  const invalid = start && end && end < start

  const save = async () => {
    if (!start || !end) { setErr("กรุณาระบุวันเริ่มและวันสิ้นสุด"); return }
    if (invalid) { setErr("วันสิ้นสุดต้องไม่ก่อนวันเริ่ม"); return }
    setSaving(true)
    setErr("")
    try {
      const res = await apiAuth(`/hr/kpi/fiscal-years/${Number(fy)}/window`, {
        method: "PATCH",
        body: { window_start: start, window_end: end },
      })
      toast.success("บันทึกช่วงประเมินแล้ว", { description: `${fmtDay(start)} – ${fmtDay(end)}` })
      onSaved(res && typeof res === "object" ? res : { ...info, window_start: start, window_end: end })
    } catch (e) {
      setErr(errText(e))
    } finally {
      setSaving(false)
    }
  }

  return (
    <HrModal
      title="แก้ช่วงประเมิน"
      subtitle={`ปีบัญชี ${fy} (${fyRange(fy)})`}
      onClose={onClose}
      busy={saving}
      footer={
        <>
          <button type="button" className={cx(secondaryBtn, "flex-1")} onClick={onClose} disabled={saving}>ยกเลิก</button>
          <button type="button" className={cx(primaryBtn, "flex-1")} onClick={save} disabled={saving || invalid}>
            {saving ? "กำลังบันทึก…" : "บันทึกช่วงประเมิน"}
          </button>
        </>
      }
    >
      <p className="text-sm text-gray-600 dark:text-gray-400">
        ค่าเริ่มต้นคือ 1 มี.ค. – 10 เม.ย. ของปีที่ปีบัญชีสิ้นสุด ระหว่างช่วงนี้บันทึกคะแนนได้ หลังวันสิ้นสุดจึงสรุปผลได้
      </p>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div>
          <label htmlFor="kpi-win-start" className={labelCls}>วันเริ่ม</label>
          <input id="kpi-win-start" type="date" value={start} onChange={(e) => setStart(e.target.value)} className={inputCls} />
        </div>
        <div>
          <label htmlFor="kpi-win-end" className={labelCls}>วันสิ้นสุด</label>
          <input
            id="kpi-win-end"
            type="date"
            value={end}
            min={start || undefined}
            onChange={(e) => setEnd(e.target.value)}
            aria-invalid={invalid || undefined}
            className={cx(inputCls, invalid && "border-red-400 dark:border-red-500")}
          />
        </div>
      </div>
      {invalid && <p className="text-xs font-medium text-red-600 dark:text-red-400">วันสิ้นสุดต้องไม่ก่อนวันเริ่ม</p>}
      {err && <Notice tone="error">{err}</Notice>}
    </HrModal>
  )
}
