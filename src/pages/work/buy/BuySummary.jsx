// src/pages/work/buy/BuySummary.jsx
// ─────────────────────────────────────────────────────────────────────────────
// Order summary. Desktop (≥md): the tile grid moved verbatim out of Buy.jsx.
// ─────────────────────────────────────────────────────────────────────────────
import { thb, toNumber, moneyToNumber } from "./buyShared"

export default function BuySummary({ form }) {
  const { buyerType, customer, memberMeta, order, grossFromScale, autoDeduct, netWeight } = form

  return (
    <div className="mt-6 grid gap-4 md:grid-cols-5">
      {/* ผู้ซื้อ */}
      {buyerType === "person" ? (
        <>
          <div className="rounded-2xl bg-white p-4 text-black shadow-sm ring-1 ring-slate-200 dark:bg-slate-800 dark:text-white dark:ring-slate-700">
            <div className="text-slate-600 dark:text-slate-300">ผู้ซื้อ</div>
            {/* ← เพิ่ม break-words */}
            <div className="text-lg md:text-xl font-semibold whitespace-pre-line break-words">
              {customer.fullName || "—"}
            </div>
          </div>
          <div className="rounded-2xl bg-white p-4 text-black shadow-sm ring-1 ring-slate-200 dark:bg-slate-800 dark:text-white dark:ring-slate-700">
            <div className="text-slate-600 dark:text-slate-300">member_id</div>
            <div className="text-lg md:text-xl font-semibold">{memberMeta.memberId ?? (customer.memberId?.trim() || "-")}</div>
          </div>
        </>
      ) : (
        <>
          <div className="rounded-2xl bg-white p-4 text-black shadow-sm ring-1 ring-slate-200 dark:bg-slate-800 dark:text-white dark:ring-slate-700">
            <div className="text-slate-600 dark:text-slate-300">บริษัท/นิติบุคคล</div>
            {/* ← เพิ่ม break-words */}
            <div className="text-lg md:text-xl font-semibold break-words">{customer.companyName || "—"}</div>
          </div>
          <div className="rounded-2xl bg-white p-4 text-black shadow-sm ring-1 ring-slate-200 dark:bg-slate-800 dark:text-white dark:ring-slate-700">
            <div className="text-slate-600 dark:text-slate-300">เลขที่ผู้เสียภาษี</div>
            <div className="text-lg md:text-xl font-semibold">{customer.taxId || "—"}</div>
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
        { label: "ประเภทธุรกิจ", value: order.businessType || "—" },
        {
          label: "สาขา / คลัง",
          value: (
            <ul className="list-disc pl-5">
              <li>{order.branchName || "—"}</li>
              {order.klangName && <li>{order.klangName}</li>}
            </ul>
          ),
        },
        { label: "ก่อนชั่ง", value: Math.round(toNumber(order.entryWeightKg) * 100) / 100 + " กก." },
        { label: "หลังชั่ง", value: Math.round(toNumber(order.exitWeightKg) * 100) / 100 + " กก." },
        { label: "จากตาชั่ง", value: Math.round(grossFromScale * 100) / 100 + " กก." },
        { label: "หัก (ความชื้น+สิ่งเจือปน)", value: Math.round(toNumber(autoDeduct) * 100) / 100 + " กก." },
        { label: "สุทธิ", value: Math.round(netWeight * 100) / 100 + " กก." },
        { label: "ราคาต่อหน่วย", value: order.unitPrice ? `${Number(order.unitPrice).toFixed(2)} บาท/กก.` : "—" },
        { label: "ยอดเงิน", value: order.amountTHB ? thb(moneyToNumber(order.amountTHB)) : "—" },
        { label: "เลขที่ใบชั่ง/ใบเบิกเงิน", value: order.paymentRefNo || "—" },
        { label: "หมายเหตุ / คอมเมนต์", value: order.comment || "—" },
      ].map((c) => (
        <div
          key={c.label}
          className="rounded-2xl bg-white p-4 text-black shadow-sm ring-1 ring-slate-200 dark:bg-slate-800 dark:text-white dark:ring-slate-700"
        >
          <div className="text-slate-600 dark:text-slate-300">{c.label}</div>
          {/* ← แก้ให้ทุกช่องสรุปตัดคำยาว ๆ ได้ */}
          <div className="text-lg md:text-xl font-semibold whitespace-pre-line break-words tabular-nums">
            {typeof c.value === "string" ? c.value : c.value}
          </div>
        </div>
      ))}
    </div>
  )
}
