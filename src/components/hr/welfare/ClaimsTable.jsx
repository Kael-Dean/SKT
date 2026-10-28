// src/components/hr/welfare/ClaimsTable.jsx
// ─────────────────────────────────────────────────────────────────────────────
// ตารางคำขอเบิกสวัสดิการ (ClaimOut[]) — desktop = ตาราง, มือถือ = <DataList>
// ใช้ใน HRWelfareTab (มีคอลัมน์เจ้าหน้าที่ + ปุ่มขั้นถัดไป) และ MyWelfare (showPerson=false, ไม่มี action)
//
//   <ClaimsTable claims={rows} loading={…} nameOf={(c) => …} patientOf={(c) => …}
//                onOpen={(c) => …} action={(c) => node|null} empty={<EmptyState …/>} />
//
// ยอดใน ClaimOut เป็น decimal string → money() · ตามสิทธิ์ < ขอเบิก = ไอคอนเตือนสีเหลือง
// ─────────────────────────────────────────────────────────────────────────────
import { TriangleAlert } from "lucide-react"
import { cx, cardCls } from "../../../lib/styles"
import { claimStatusLabel, claimStatusTone, claimTypeLabel, claimWhen, isCapped, money } from "../../../lib/welfare"
import { Badge, DataList, SkeletonTableRows } from "../../ui"
import { useIsPhone } from "../../../hooks/useMediaQuery"

function EligibleCell({ c }) {
  const capped = isCapped(c)
  return (
    <span className={cx("inline-flex items-center justify-end gap-1", capped && "text-amber-700 dark:text-amber-300")}>
      {capped && <TriangleAlert aria-hidden="true" className="size-3.5 shrink-0" />}
      {money(c.eligible_amount)}
      {capped && <span className="sr-only"> (ต่ำกว่ายอดที่ขอ)</span>}
    </span>
  )
}

export default function ClaimsTable({
  claims, loading, nameOf, patientOf, onOpen, action, empty, showPerson = true, skeletonRows = 5,
}) {
  const isPhone = useIsPhone()

  if (isPhone) {
    return (
      <DataList
        items={claims}
        loading={loading}
        skeletonRows={Math.min(skeletonRows, 4)}
        keyOf={(c) => c.id}
        title={(c) => (showPerson ? nameOf(c) : claimTypeLabel(c))}
        subtitle={(c) => [showPerson ? claimTypeLabel(c) : null, patientOf(c), claimWhen(c)].filter(Boolean).join(" · ")}
        badge={(c) => <Badge tone={claimStatusTone(c)}>{claimStatusLabel(c)}</Badge>}
        fields={[
          { label: "ขอเบิก", value: (c) => money(c.requested_amount), align: "right" },
          { label: "ตามสิทธิ์", value: (c) => <EligibleCell c={c} />, align: "right" },
          { label: "อนุมัติ", value: (c) => money(c.approved_amount), align: "right", emphasis: true },
        ]}
        onClick={onOpen}
        actions={action ? (c) => action(c) : undefined}
        emptyState={empty}
      />
    )
  }

  const th = "px-3 py-3 text-xs font-semibold text-gray-500 dark:text-gray-400 whitespace-nowrap"
  const cols = showPerson ? 8 : 7
  return (
    <div className={cx(cardCls, "overflow-x-auto")}>
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-gray-100 bg-gray-50 dark:border-line dark:bg-white/[.03]">
            <th scope="col" className={cx(th, "pl-4 text-left")}>{showPerson ? "เจ้าหน้าที่ / ผู้รับบริการ" : "ประเภท / ผู้รับบริการ"}</th>
            {showPerson && <th scope="col" className={cx(th, "text-left")}>ประเภท</th>}
            <th scope="col" className={cx(th, "text-left")}>วันที่รับบริการ</th>
            <th scope="col" className={cx(th, "text-right")}>ขอเบิก</th>
            <th scope="col" className={cx(th, "text-right")}>ตามสิทธิ์</th>
            <th scope="col" className={cx(th, "text-right")}>อนุมัติ</th>
            <th scope="col" className={cx(th, "text-left")}>สถานะ</th>
            <th scope="col" className={cx(th, "pr-4")}><span className="sr-only">ขั้นถัดไป</span></th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100 dark:divide-line">
          {loading ? (
            <SkeletonTableRows rows={skeletonRows} cols={cols} />
          ) : claims.length === 0 ? (
            <tr><td colSpan={cols} className="p-0">{empty}</td></tr>
          ) : claims.map((c) => (
            <tr key={c.id} className="transition-colors duration-150 hover:bg-gray-50 dark:hover:bg-white/[.03]">
              <td className="py-2.5 pl-4 pr-3">
                <button type="button" onClick={() => onOpen(c)}
                  className="cursor-pointer rounded text-left font-medium text-gray-900 hover:text-indigo-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 dark:text-gray-100 dark:hover:text-indigo-300">
                  {showPerson ? nameOf(c) : claimTypeLabel(c)}
                </button>
                <p className="text-xs text-gray-500 dark:text-gray-400">#{c.id} · {patientOf(c)}</p>
              </td>
              {showPerson && <td className="px-3 py-2.5 whitespace-nowrap text-gray-700 dark:text-gray-300">{claimTypeLabel(c)}</td>}
              <td className="px-3 py-2.5 whitespace-nowrap text-gray-700 dark:text-gray-300">{claimWhen(c)}</td>
              <td className="px-3 py-2.5 text-right tabular-nums text-gray-700 dark:text-gray-300">{money(c.requested_amount)}</td>
              <td className="px-3 py-2.5 text-right tabular-nums text-gray-700 dark:text-gray-300"><EligibleCell c={c} /></td>
              <td className="px-3 py-2.5 text-right font-semibold tabular-nums text-gray-900 dark:text-gray-100">{money(c.approved_amount)}</td>
              <td className="px-3 py-2.5 whitespace-nowrap"><Badge tone={claimStatusTone(c)}>{claimStatusLabel(c)}</Badge></td>
              <td className="py-2.5 pl-3 pr-4 text-right">{action?.(c)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
