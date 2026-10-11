// src/pages/work/buy/BuySummary.jsx
// ─────────────────────────────────────────────────────────────────────────────
// Order summary. Desktop (≥md): the tile grid moved verbatim out of Buy.jsx.
// Phone (<md, UI-SPEC §3.4): four cards of <dl> rows with a "แก้ไข" link per
// group (→ onEdit(stepIndex)); the amount row is the one big number.
// ─────────────────────────────────────────────────────────────────────────────
import { cx, cardCls, sectionTitleCls, focusRingCls } from "../../../lib/styles"
import { thb, nf, toNumber, moneyToNumber, maskId13 } from "./buyShared"

export default function BuySummary({ form, onEdit }) {
  return form.isPhone ? <PhoneSummary form={form} onEdit={onEdit} /> : <DesktopSummary form={form} />
}

/* ═══════════════════════════════ PHONE ═══════════════════════════════ */

function Group({ title, step, onEdit, children }) {
  return (
    <section className={cx(cardCls, "p-4")}>
      <div className={cx(sectionTitleCls, "flex items-center justify-between")}>
        <span>{title}</span>
        {onEdit && (
          <button
            type="button"
            onClick={() => onEdit(step)}
            className={cx("-my-2 -mr-2 inline-flex min-h-touch items-center rounded-lg px-2 text-sm font-medium normal-case tracking-normal text-indigo-600 dark:text-indigo-300", focusRingCls)}
            aria-label={`แก้ไข${title}`}
          >
            แก้ไข
          </button>
        )}
      </div>
      <dl className="grid grid-cols-[minmax(0,7.5rem)_1fr] gap-x-3 gap-y-1.5">{children}</dl>
    </section>
  )
}

function Row({ label, value, bold = false, hide = false }) {
  if (hide) return null
  return (
    <>
      <dt className="text-sm leading-relaxed text-gray-500 dark:text-gray-400">{label}</dt>
      <dd className={cx("min-w-0 truncate text-base leading-relaxed tabular-nums text-gray-900 dark:text-gray-100", bold ? "font-bold" : "font-medium")}>
        {value || "—"}
      </dd>
    </>
  )
}

function PhoneSummary({ form, onEdit }) {
  const { buyerType, customer, memberMeta, order, grossFromScale, autoDeduct, netWeight, selectedTemplateLabel } = form
  const isPerson = buyerType === "person"
  const addr = isPerson
    ? [customer.houseNo, customer.moo && `ม.${customer.moo}`, customer.subdistrict && `ต.${customer.subdistrict}`, customer.district && `อ.${customer.district}`, customer.province && `จ.${customer.province}`]
    : [customer.hqHouseNo, customer.hqMoo && `ม.${customer.hqMoo}`, customer.hqSubdistrict && `ต.${customer.hqSubdistrict}`, customer.hqDistrict && `อ.${customer.hqDistrict}`, customer.hqProvince && `จ.${customer.hqProvince}`]
  const amount = moneyToNumber(order.amountTHB)

  return (
    <div className="space-y-4">
      <Group title="ลูกค้า" step={0} onEdit={onEdit}>
        <Row label="ประเภท" value={isPerson ? "บุคคล" : "บริษัท"} />
        <Row label={isPerson ? "ชื่อ-สกุล" : "ชื่อบริษัท"} value={isPerson ? customer.fullName : customer.companyName} />
        <Row label={isPerson ? "เลขบัตร" : "เลขผู้เสียภาษี"} value={maskId13(isPerson ? customer.citizenId : customer.taxId)} hide={isPerson ? !customer.citizenId : !customer.taxId} />
        <Row label="รหัสสมาชิก" value={memberMeta.memberId ?? customer.memberId?.trim()} hide={!isPerson} />
        <Row label="ที่อยู่" value={addr.filter(Boolean).join(" ")} />
        <Row label="โทร" value={isPerson ? customer.phone : customer.companyPhone} />
        <Row label="วิธีชำระ" value={order.paymentMethod} />
        <Row label="ลงวันที่" value={order.issueDate} />
        <Row label="เลขที่ใบชั่ง" value={order.paymentRefNo} />
      </Group>

      <Group title="สเปคและคลัง" step={1} onEdit={onEdit}>
        <Row label="ฟอร์ม" value={selectedTemplateLabel} />
        <Row label="ชนิดข้าว" value={order.riceType} />
        <Row label="ชั้นย่อย" value={order.subriceName} />
        <Row label="สภาพ" value={order.condition} />
        <Row label="ประเภทนา" value={order.fieldType} />
        <Row label="ปี/ฤดูกาล" value={order.riceYear} />
        <Row label="ประเภทธุรกิจ" value={order.businessType} />
        <Row label="โปรแกรม" value={order.programName} />
        <Row label="สาขา / คลัง" value={[order.branchName, order.klangName].filter(Boolean).join(" / ")} />
      </Group>

      <Group title="น้ำหนัก" step={2} onEdit={onEdit}>
        <Row label="น้ำหนักเข้า" value={`${nf(toNumber(order.entryWeightKg))} กก.`} />
        <Row label="น้ำหนักออก" value={`${nf(toNumber(order.exitWeightKg))} กก.`} />
        <Row label="จากตาชั่ง" value={`${nf(grossFromScale)} กก.`} />
        <Row label={`หัก (ชื้น ${order.moisturePct || 0}% + เจือปน ${order.impurityPct || 0}%)`} value={`${nf(toNumber(autoDeduct))} กก.`} />
        <Row label="สุทธิ" value={`${nf(netWeight)} กก.`} bold />
        <Row label="คุณภาพ (gram)" value={order.gram} />
      </Group>

      <Group title="เงิน" step={2} onEdit={onEdit}>
        <Row label="ราคาต่อกก." value={order.unitPrice ? `${Number(order.unitPrice).toFixed(2)} บาท/กก.` : ""} />
        <dt className="col-span-2 pt-1 text-sm leading-relaxed text-gray-500 dark:text-gray-400">ยอดเงิน</dt>
        <dd className="col-span-2 text-right text-2xl font-bold tabular-nums text-gray-900 dark:text-gray-100">{amount > 0 ? thb(amount) : "—"}</dd>
      </Group>
    </div>
  )
}

/* ═══════════════════════════════ DESKTOP (≥md) — unchanged tree ═══════════════════════════════ */

function DesktopSummary({ form }) {
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
