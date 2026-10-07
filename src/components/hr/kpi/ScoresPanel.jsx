// src/components/hr/kpi/ScoresPanel.jsx
// Sub-tab "ประเมิน": every evaluation of the year with status, breakdown (42/28/20/10),
// composite and step; opens ScoreDialog. Read-only for roles without a score permission (e.g. HR).
import { useMemo, useState } from "react"
import { Plus, Search } from "lucide-react"
import SelectDropdown from "../../SelectDropdown"
import { Notice } from "../HrModal"
import { cx } from "../../../lib/styles"
import { EmptyState, ErrorState, SkeletonTableRows } from "../../ui"
import { cardCls, inputCls, linkBtn, primaryBtn, thCls } from "../positionUtils"
import ScoreDialog from "./ScoreDialog"
import { PendingBadge, StatusBadge, StepCell } from "./KpiBits"
import { COMPONENTS, STATUS, STATUS_ORDER, canEditScores, fmtDay, fmtScore, num, partialTotal } from "./kpiUtils"
import { useEvaluations } from "./useKpi"

const STATUS_FILTER = [
  { value: "", label: "ทุกสถานะ" },
  ...STATUS_ORDER.map((k) => ({ value: k, label: STATUS[k].label })),
]

export default function ScoresPanel({ fy, info, phase, perms, people, onChanged }) {
  const { rows, loading, error, reload } = useEvaluations(fy)
  const [q, setQ] = useState("")
  const [status, setStatus] = useState("")
  const [dialog, setDialog] = useState(null) // { ev } | { ev: null } (new)

  const canScore = perms.scoreBranchHead || perms.scoreAsst || perms.scoreManager || perms.boardScore
  const { nameOf } = people

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase()
    return rows.filter((ev) => {
      if (status && ev.status !== status) return false
      if (!needle) return true
      return String(ev.user_id).includes(needle) || nameOf(ev.user_id).toLowerCase().includes(needle)
    })
  }, [rows, q, status, nameOf])

  const returnedCount = rows.filter((r) => r.status === "returned").length

  const afterSave = (opts) => {
    if (!opts?.keepOpen) setDialog(null)
    reload()
    onChanged?.()
  }

  return (
    <div className="space-y-3">
      {phase && phase !== "open" && (
        <Notice tone={returnedCount ? "warning" : "info"}>
          ปิดรับคะแนนแล้ว ช่วงประเมินคือ {fmtDay(info?.window_start)} – {fmtDay(info?.window_end)}
          {returnedCount > 0 ? ` แก้คะแนนได้เฉพาะรายการที่ส่งกลับแก้ไข (${returnedCount} คน)` : ""}
        </Notice>
      )}
      {canScore && (
        <p className="text-xs text-gray-500 dark:text-gray-400">
          บันทึก KPI สาขาก่อนให้คะแนนรายบุคคล คะแนนผลงานสาขา (28) จะเติมให้อัตโนมัติ ถ้ายังไม่มีจะสรุปผลไม่ผ่าน
        </p>
      )}

      <div className="flex flex-wrap items-end gap-2">
        <div className="relative w-full sm:w-72">
          <Search aria-hidden="true" className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-gray-400" strokeWidth={1.75} />
          <input
            type="search"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="ค้นหาชื่อหรือรหัส"
            aria-label="ค้นหาเจ้าหน้าที่"
            className={cx(inputCls, "pl-9")}
          />
        </div>
        <div className="w-full sm:w-60">
          <SelectDropdown options={STATUS_FILTER} value={status} onChange={setStatus} ariaLabel="กรองสถานะ" showSwatch={false} />
        </div>
        {canScore && phase === "open" && (
          <button type="button" className={cx(primaryBtn, "sm:ml-auto")} onClick={() => setDialog({ ev: null })}>
            <Plus aria-hidden="true" className="size-4" strokeWidth={2} />
            ให้คะแนนเจ้าหน้าที่
          </button>
        )}
      </div>

      {error ? (
        <ErrorState message={error} onRetry={reload} />
      ) : !loading && rows.length === 0 ? (
        <div className={cx(cardCls, "p-2")}>
          <EmptyState
            title="ยังไม่มีการประเมินในปีบัญชีนี้"
            description={canScore && phase === "open" ? "กด “ให้คะแนนเจ้าหน้าที่” เพื่อเริ่มบันทึกคะแนนคนแรก" : `ปีบัญชี ${fy} ยังไม่มีข้อมูลการประเมิน`}
          />
        </div>
      ) : (
        <div className={cx(cardCls, "overflow-hidden")}>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <caption className="sr-only">รายการประเมิน KPI ปีบัญชี {fy}</caption>
              <thead className="border-b border-gray-100 bg-gray-50 dark:border-gray-700 dark:bg-gray-900/30">
                <tr>
                  <th scope="col" className={cx(thCls, "whitespace-nowrap text-left")}>เจ้าหน้าที่</th>
                  {COMPONENTS.map((c) => (
                    <th key={c.key} scope="col" className={cx(thCls, "whitespace-nowrap text-right hidden md:table-cell whitespace-nowrap")}>
                      {c.label}
                      <span className="block font-normal text-gray-400 dark:text-gray-500">≤{c.max}</span>
                    </th>
                  ))}
                  <th scope="col" className={cx(thCls, "whitespace-nowrap text-right")}>รวม</th>
                  <th scope="col" className={cx(thCls, "whitespace-nowrap text-left")}>ขั้น</th>
                  <th scope="col" className={thCls}><span className="sr-only">การทำงาน</span></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-700/50">
                {loading ? (
                  <SkeletonTableRows rows={6} cols={8} />
                ) : filtered.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="px-4 py-8 text-center text-sm text-gray-500 dark:text-gray-400">ไม่พบรายการที่ตรงกับการค้นหา</td>
                  </tr>
                ) : (
                  filtered.map((ev) => (
                    <ScoreRow
                      key={ev.id ?? ev.user_id}
                      ev={ev}
                      name={nameOf(ev.user_id)}
                      editable={canScore && canEditScores(ev, phase)}
                      canScore={canScore}
                      onOpen={() => setDialog({ ev })}
                    />
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {dialog && (
        <ScoreDialog
          fy={fy}
          ev={dialog.ev}
          info={info}
          phase={phase}
          perms={perms}
          nameOf={nameOf}
          onClose={() => setDialog(null)}
          onSaved={afterSave}
        />
      )}
    </div>
  )
}

function ScoreRow({ ev, name, editable, canScore, onOpen }) {
  const composite = num(ev.composite_score)
  const partial = partialTotal(ev)
  return (
    <tr className="hover:bg-gray-50 dark:hover:bg-gray-700/30">
      <td className="px-4 py-3 align-top">
        <p className="font-medium text-gray-900 dark:text-gray-100">{name}</p>
        <div className="mt-1 flex flex-wrap items-center gap-1">
          <StatusBadge status={ev.status} />
          <PendingBadge status={ev.pending_status} />
        </div>
        <p className="mt-1 text-xs text-gray-500 dark:text-gray-400 tabular-nums md:hidden">
          {COMPONENTS.map((c) => `${c.short} ${fmtScore(ev[c.key])}`).join(" / ")}
        </p>
      </td>
      {COMPONENTS.map((c) => (
        <td key={c.key} className="px-4 py-3 text-right align-top text-gray-700 dark:text-gray-300 tabular-nums hidden md:table-cell">
          {fmtScore(ev[c.key])}
        </td>
      ))}
      <td className="px-4 py-3 text-right align-top tabular-nums">
        {composite != null ? (
          <span className="font-bold text-indigo-700 dark:text-indigo-300">{fmtScore(composite)}</span>
        ) : (
          <span className="text-gray-500 dark:text-gray-400" title="ผลรวมชั่วคราว ยังไม่สรุปผล">{partial != null ? fmtScore(partial) : "—"}</span>
        )}
      </td>
      <td className="px-4 py-3 align-top"><StepCell ev={ev} /></td>
      <td className="px-4 py-3 text-right align-top whitespace-nowrap">
        {canScore && (
          <button type="button" className={linkBtn} onClick={onOpen}>
            {editable ? "บันทึกคะแนน" : "ดูคะแนน"}
          </button>
        )}
      </td>
    </tr>
  )
}
