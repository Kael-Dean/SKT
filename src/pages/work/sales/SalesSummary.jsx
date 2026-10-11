// src/pages/work/sales/SalesSummary.jsx
// ─────────────────────────────────────────────────────────────────────────────
// Desktop summary of the Sales form: buyer / order tiles, the per-trailer
// table and the totals strip — lifted from Sales.jsx with the same markup.
// `SalesCommentField` is the shared textarea (desktop: above the summary;
// phone: step 4). Phone step 4 uses DataList instead (SalesMobileStepper).
// ─────────────────────────────────────────────────────────────────────────────
import { baseField, labelCls } from "../../../lib/styles"
import { round2, thb, fieldId } from "./salesShared"

const tileCls = "rounded-2xl bg-white p-4 text-black shadow-sm ring-1 ring-slate-200 dark:bg-slate-800 dark:text-white dark:ring-slate-700"

export function SalesCommentField({ form, mobile = false }) {
  const { refs, order, updateOrder, onEnter } = form
  return (
    <div className={mobile ? undefined : "mt-4"}>
      <label className={labelCls} htmlFor={fieldId("comment")}>{mobile ? "หมายเหตุ / คอมเมนต์ (ไม่บังคับ)" : "หมายเหตุ / คอมเมนต์"}</label>
      <textarea
        id={fieldId("comment")}
        ref={refs.comment}
        rows={3}
        className={baseField}
        value={order.comment}
        onChange={(e) => updateOrder("comment", e.target.value)}
        onKeyDown={onEnter("comment")}
        placeholder="ระบุรายละเอียดเพิ่มเติม ถ้ามี"
      />
    </div>
  )
}

export default function SalesSummary({ form }) {
  const { buyerType, customer, memberMeta, order, trailerSummary } = form
  return (
    <div className="mt-6 grid gap-4 md:grid-cols-5">
      {buyerType === "person" ? (
        <>
          <div className={tileCls}>
            <div className="text-slate-600 dark:text-slate-300">ผู้ซื้อ</div>
            <div className="text-lg md:text-xl font-semibold whitespace-pre-wrap break-words">
              {customer.fullName || "—"}
            </div>
          </div>
          <div className={tileCls}>
            <div className="text-slate-600 dark:text-slate-300">member_id</div>
            <div className="text-lg md:text-xl font-semibold">
              {memberMeta.memberId ?? (customer.memberId?.trim() || "-")}
            </div>
          </div>
        </>
      ) : (
        <>
          <div className={tileCls}>
            <div className="text-slate-600 dark:text-slate-300">บริษัท/นิติบุคคล</div>
            <div className="text-lg md:text-xl font-semibold whitespace-pre-wrap break-words">
              {customer.companyName || "—"}
            </div>
          </div>
          <div className={tileCls}>
            <div className="text-slate-600 dark:text-slate-300">เลขที่ผู้เสียภาษี</div>
            <div className="text-lg md:text-xl font-semibold whitespace-pre-wrap break-words">
              {customer.taxId || "—"}
            </div>
          </div>
        </>
      )}

      {[
        { label: "ลงวันที่", value: order.issueDate || "—" },
        { label: "วิธีชำระเงิน", value: order.paymentMethod || "—" },
        { label: "สินค้า", value: order.productName || "—" },
        { label: "ชนิดข้าว", value: order.riceType || "—" },
        { label: "ชั้นย่อย", value: order.subriceName || "—" },
        { label: "เงื่อนไข", value: order.condition || "—" },
        { label: "ประเภทนา", value: order.fieldType || "—" },
        { label: "ปี/ฤดูกาล", value: order.riceYear || "—" },
        {
          label: "สาขา / คลัง",
          value: (
            <ul className="list-disc pl-5">
              <li className="break-words">{order.branchName || "—"}</li>
              {order.klangName && <li className="break-words">{order.klangName}</li>}
            </ul>
          ),
        },
        { label: "หมายเหตุ / คอมเมนต์", value: order.comment || "—" },
      ].map((c) => (
        <div key={c.label} className={tileCls}>
          <div className="text-slate-600 dark:text-slate-300">{c.label}</div>
          <div className="text-lg md:text-xl font-semibold whitespace-pre-wrap break-words">{c.value}</div>
        </div>
      ))}

      <div className="md:col-span-5 rounded-2xl bg-white p-4 text-black shadow-sm ring-1 ring-slate-200 dark:bg-slate-800 dark:text-white dark:ring-slate-700">
        <div className="mb-2 flex items-center justify-between">
          <div className="text-slate-600 dark:text-slate-300">สรุปรถพ่วง</div>
          <div className="flex items-center gap-4 text-xs md:text-sm opacity-80">
            <span className="inline-flex items-center gap-2">
              <span className="h-2 w-2 rounded-full bg-emerald-500" />พ่วงหน้า
            </span>
            <span className="inline-flex items-center gap-2">
              <span className="h-2 w-2 rounded-full bg-slate-500" />พ่วงหลัง
            </span>
          </div>
        </div>

        {!trailerSummary.hasData ? (
          <div className="text-sm text-slate-500 dark:text-slate-300">ยังไม่มีข้อมูลรถพ่วง</div>
        ) : (
          <>
            <div className="-mx-2 overflow-x-auto md:mx-0">
              <table className="min-w-full text-sm tabular-nums">
                <thead className="text-xs uppercase tracking-wide text-slate-500 dark:text-slate-300">
                  <tr>
                    <th className="px-2 py-2 text-left">คัน</th>
                    <th className="px-2 py-2 text-left">ทะเบียน</th>
                    <th className="px-2 py-2 text-left">น้ำหนัก (กก.)</th>
                    <th className="px-2 py-2 text-left">ราคา/กก. (บาท)</th>
                    <th className="px-2 py-2 text-left">เป็นเงิน</th>
                    <th className="px-2 py-2 text-left">สรุปคัน</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
                  {trailerSummary.rows.map((row) => (
                    <tr key={row.index} className="align-top">
                      <td className="px-2 py-3 font-semibold">#{row.index}</td>
                      <td className="px-2 py-3">
                        <div className="flex flex-col gap-1">
                          <span className="inline-flex items-center gap-2">
                            <span className="h-2 w-2 rounded-full bg-emerald-500" />
                            <span className="break-words">{row.front.plate || "—"}</span>
                          </span>
                          <span className="inline-flex items-center gap-2 text-slate-600 dark:text-slate-300">
                            <span className="h-2 w-2 rounded-full bg-slate-500" />
                            <span className="break-words">{row.back.plate || "—"}</span>
                          </span>
                        </div>
                      </td>
                      <td className="px-2 py-3">
                        <div className="flex flex-col gap-1">
                          <span className="inline-flex items-center gap-2">
                            <span className="h-2 w-2 rounded-full bg-emerald-500" />
                            <span>{row.front.weight > 0 ? `${round2(row.front.weight)} กก.` : "—"}</span>
                          </span>
                          <span className="inline-flex items-center gap-2 text-slate-600 dark:text-slate-300">
                            <span className="h-2 w-2 rounded-full bg-slate-500" />
                            <span>{row.back.weight > 0 ? `${round2(row.back.weight)} กก.` : "—"}</span>
                          </span>
                        </div>
                      </td>
                      <td className="px-2 py-3">
                        <div className="flex flex-col gap-1">
                          <span className="inline-flex items-center gap-2">
                            <span className="h-2 w-2 rounded-full bg-emerald-500" />
                            <span>{row.front.price > 0 ? `${round2(row.front.price)} บ.` : "—"}</span>
                          </span>
                          <span className="inline-flex items-center gap-2 text-slate-600 dark:text-slate-300">
                            <span className="h-2 w-2 rounded-full bg-slate-500" />
                            <span>{row.back.price > 0 ? `${round2(row.back.price)} บ.` : "—"}</span>
                          </span>
                        </div>
                      </td>
                      <td className="px-2 py-3">
                        <div className="flex flex-col gap-1">
                          <span className="inline-flex items-center gap-2">
                            <span className="h-2 w-2 rounded-full bg-emerald-500" />
                            <span>{row.front.amount > 0 ? thb(row.front.amount) : "—"}</span>
                          </span>
                          <span className="inline-flex items-center gap-2 text-slate-600 dark:text-slate-300">
                            <span className="h-2 w-2 rounded-full bg-slate-500" />
                            <span>{row.back.amount > 0 ? thb(row.back.amount) : "—"}</span>
                          </span>
                        </div>
                      </td>
                      <td className="px-2 py-3">
                        <div className="space-y-1 text-[13px] leading-relaxed md:text-sm">
                          <div>
                            น้ำหนักรวม: <b>{row.net > 0 ? `${round2(row.net)} กก.` : "—"}</b>
                          </div>
                          <div>
                            ราคาเฉลี่ย: <b>{row.weightedUnit > 0 ? `${round2(row.weightedUnit)} บ./กก.` : "—"}</b>
                          </div>
                          <div>
                            gram เฉลี่ย: <b>{row.weightedGram > 0 ? row.weightedGram : "—"}</b>
                          </div>
                          <div>
                            ยอดรวม: <b>{row.amount > 0 ? thb(row.amount) : "—"}</b>
                          </div>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="mt-4 grid gap-3 md:grid-cols-3 xl:grid-cols-5">
              <div className="rounded-xl bg-emerald-50 p-3 text-emerald-900 ring-1 ring-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-100 dark:ring-emerald-700/60">
                <div className="text-xs uppercase tracking-wide opacity-70">รวมพ่วงหน้า</div>
                <div className="text-lg font-semibold tabular-nums">{round2(trailerSummary.totals.frontWeight)} กก.</div>
              </div>
              <div className="rounded-xl bg-slate-100 p-3 text-slate-800 ring-1 ring-slate-200 dark:bg-slate-900/40 dark:text-slate-100 dark:ring-slate-700/60">
                <div className="text-xs uppercase tracking-wide opacity-70">รวมพ่วงหลัง</div>
                <div className="text-lg font-semibold tabular-nums">{round2(trailerSummary.totals.backWeight)} กก.</div>
              </div>
              <div className="rounded-xl bg-white p-3 text-slate-900 ring-1 ring-slate-200 dark:bg-slate-900/60 dark:text-white dark:ring-slate-700/60">
                <div className="text-xs uppercase tracking-wide opacity-70">น้ำหนักสุทธิรวม</div>
                <div className="text-lg font-semibold tabular-nums">{round2(trailerSummary.totals.net)} กก.</div>
              </div>
              <div className="rounded-xl bg-white p-3 text-amber-950 ring-1 ring-amber-200 dark:bg-amber-900/40 dark:text-amber-100 dark:ring-amber-700/60">
                <div className="text-xs uppercase tracking-wide opacity-70">ยอดเงินรวม</div>
                <div className="text-lg font-semibold tabular-nums">{thb(trailerSummary.totals.amount)}</div>
              </div>
              <div className="rounded-xl bg-white p-3 text-slate-900 ring-1 ring-emerald-200 dark:bg-slate-900/60 dark:text-white dark:ring-emerald-700/60">
                <div className="text-xs uppercase tracking-wide opacity-70">ราคา/คุณภาพเฉลี่ยรวม</div>
                <div className="text-lg font-semibold tabular-nums">
                  {trailerSummary.totals.weightedUnit > 0 ? `${round2(trailerSummary.totals.weightedUnit)} บ./กก.` : "—"}
                </div>
                <div className="text-sm text-slate-600 dark:text-slate-300 tabular-nums">
                  gram เฉลี่ย: {trailerSummary.totals.weightedGram > 0 ? trailerSummary.totals.weightedGram : "—"}
                </div>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
