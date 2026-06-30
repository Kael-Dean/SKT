import { sumRows } from "./buildReportRows"

const fmtMoney = (v) =>
  new Intl.NumberFormat("th-TH", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(parseFloat(v) || 0)

// 11 amount/count cells in render order, shared by year rows, subtotals, footer.
const cellVals = (t) => [
  { v: t.carry_amount, money: true },  { v: t.carry_count },
  { v: t.new_amount, money: true },    { v: t.new_count },
  { v: t.paid_amount, money: true },   { v: t.paid_count },
  { v: t.remain_amount, money: true }, { v: t.remain_count },
  { v: t.mobile_amount, money: true },
  { v: t.cash_amount, money: true },
  { v: t.produce_amount, money: true },
]

function todayThai() {
  return new Date().toLocaleDateString("th-TH", { year: "numeric", month: "long", day: "numeric" })
}

// Cooperative full name shown above every printed report.
const ORG_NAME = "สหกรณ์การเกษตรเพื่อการตลาดลูกค้า ธ.ก.ส. สุรินทร์ จำกัด"

export function printDebtTable({ title, subtitle, tableRows, colTotals }) {
  // The print popup is about:blank (no base href) → relative asset paths fail.
  // Build an absolute URL to the logo from the app's origin + Vite BASE_URL.
  const base = (import.meta.env.BASE_URL || "/").replace(/\/+$/, "")
  const logoUrl = `${window.location.origin}${base}/logo/skt-logo.png`

  let bodyRows = ""
  tableRows.forEach((group, gi) => {
    const rowBg = gi % 2 === 0 ? "#ffffff" : "#f8fafc"
    group.yearRows.forEach((yr, yi) => {
      bodyRows += `<tr style="background:${rowBg}">`
      if (yi === 0) {
        bodyRows += `<td rowspan="${group.yearRows.length}" style="text-align:center;vertical-align:middle;border:1px solid #94a3b8;padding:5px 6px">${gi + 1}</td>`
        bodyRows += `<td rowspan="${group.yearRows.length}" style="vertical-align:middle;border:1px solid #94a3b8;padding:5px 8px;font-weight:500">${group.program.prog_name}</td>`
      }
      bodyRows += `<td style="text-align:center;border:1px solid #94a3b8;padding:5px 6px">${yr.fiscalYear.year_name}</td>`
      // 8 amount/count pairs (ยกมา/เพิ่มในปี/ชำระ/คงเหลือ) then 3 amount-only
      // method columns (v5 method breakdown has no per-method count).
      cellVals(yr).forEach((c) => {
        bodyRows += `<td style="text-align:right;border:1px solid #94a3b8;padding:5px 6px;font-variant-numeric:tabular-nums">${c.money ? fmtMoney(c.v) : (c.v || 0)}</td>`
      })
      bodyRows += `<td style="border:1px solid #94a3b8;padding:5px 6px;color:#6b7280">${yr.note || ""}</td>`
      bodyRows += `</tr>`
    })
    // ผลรวมต่อโครงการ (subtotal) — แถบสีคราม indigo คั่นจาก row รวมทั้งหมด (เขียว)
    const gTot = sumRows(group.yearRows)
    bodyRows += `<tr>`
    bodyRows += `<td colspan="3" style="font-weight:700;background:#eef2ff;border:1px solid #c7d2fe;padding:5px 10px;color:#3730a3">รวม ${group.program.prog_name}</td>`
    cellVals(gTot).forEach((c) => {
      bodyRows += `<td style="text-align:right;border:1px solid #c7d2fe;padding:5px 6px;font-weight:700;background:#eef2ff;color:#3730a3;font-variant-numeric:tabular-nums">${c.money ? fmtMoney(c.v) : (c.v || 0)}</td>`
    })
    bodyRows += `<td style="background:#eef2ff;border:1px solid #c7d2fe"></td>`
    bodyRows += `</tr>`
  })

  const footCells = cellVals(colTotals).map((c) =>
    `<td style="text-align:right;border:1px solid #6ee7b7;padding:5px 6px;font-weight:700;background:#d1fae5;font-variant-numeric:tabular-nums">${c.money ? fmtMoney(c.v) : (c.v || 0)}</td>`
  ).join("")

  const html = `<!DOCTYPE html>
<html lang="th">
<head>
  <meta charset="UTF-8">
  <title>${title}</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: 'Sarabun', 'Noto Sans Thai', 'TH Sarabun New', sans-serif; font-size: 13px; color: #1e293b; padding: 16px; }
    .doc-header { text-align: center; margin-bottom: 16px; }
    .doc-header .doc-logo { height: 68px; width: auto; margin: 0 auto 6px; display: block; }
    .doc-header .org-name { font-size: 18px; font-weight: 700; color: #1e293b; }
    .doc-header h1 { font-size: 20px; font-weight: 700; margin-top: 2px; }
    .doc-header .sub { font-size: 13px; color: #475569; margin-top: 4px; }
    table { border-collapse: collapse; width: 100%; }
    th { border: 1px solid #94a3b8; padding: 5px 6px; font-size: 12px; background: #f1f5f9; font-weight: 600; text-align: center; }
    td { border: 1px solid #94a3b8; padding: 5px 6px; font-size: 12px; }
    .pay { background: #eef2ff; }
    .toolbar { position: sticky; top: 0; z-index: 10; background: #ffffff; border-bottom: 1px solid #e2e8f0; padding: 10px 0 12px; margin-bottom: 12px; text-align: center; }
    .toolbar button { font-family: inherit; font-size: 14px; font-weight: 600; color: #ffffff; background: #6366f1; border: none; border-radius: 10px; padding: 9px 22px; cursor: pointer; }
    .toolbar button:hover { background: #4f46e5; }
    @page { size: A4 landscape; margin: 0.8cm; }
    @media print { body { padding: 0; } .no-print { display: none !important; } }
  </style>
</head>
<body>
  <div class="toolbar no-print">
    <button type="button" onclick="window.print()">พิมพ์ / บันทึกเป็น PDF</button>
  </div>
  <div class="doc-header">
    <img class="doc-logo" src="${logoUrl}" alt="" />
    <div class="org-name">${ORG_NAME}</div>
    <h1>${title}</h1>
    <div class="sub">${subtitle ? subtitle + " &nbsp;|&nbsp; " : ""}วันที่พิมพ์: ${todayThai()}</div>
  </div>
  <table>
    <thead>
      <tr>
        <th rowspan="2" style="width:36px">ลำดับ</th>
        <th rowspan="2" style="min-width:150px;text-align:left">โครงการ</th>
        <th rowspan="2" style="width:72px">ปีการผลิต</th>
        <th colspan="2">ยกมา</th>
        <th colspan="2">เพิ่มในปี</th>
        <th colspan="2">ชำระ</th>
        <th colspan="2">คงเหลือ</th>
        <th rowspan="2" class="pay" style="width:80px">โอนผ่านมือถือ (บาท)</th>
        <th rowspan="2" class="pay" style="width:70px">เงินสด (บาท)</th>
        <th rowspan="2" class="pay" style="width:80px">ผลผลิต (บาท)</th>
        <th rowspan="2" style="width:80px">หมายเหตุ</th>
      </tr>
      <tr>
        <th>บาท</th><th>ราย</th>
        <th>บาท</th><th>ราย</th>
        <th>บาท</th><th>ราย</th>
        <th>บาท</th><th>ราย</th>
      </tr>
    </thead>
    <tbody>${bodyRows}</tbody>
    <tfoot>
      <tr>
        <td colspan="3" style="font-weight:700;background:#d1fae5;border:1px solid #6ee7b7;padding:5px 10px">รวมทั้งหมด</td>
        ${footCells}
        <td style="background:#d1fae5;border:1px solid #6ee7b7"></td>
      </tr>
    </tfoot>
  </table>
  <script>
    window.onload = function () {
      var img = document.querySelector('.doc-logo')
      var done = false
      function go() { if (done) return; done = true; window.print() }
      if (img && !img.complete) {
        img.onload = go
        img.onerror = go
        setTimeout(go, 1500) // fallback: never block printing on a slow/failed logo
      } else {
        go()
      }
    }
  </script>
</body>
</html>`

  // หมายเหตุความปลอดภัย: ไม่ใช้ feature "noopener" ตรงนี้ เพราะ noopener จะทำให้
  // window.open() คืนค่า null บนเบราว์เซอร์เป้าหมาย ซึ่งจะทำให้การพิมพ์พัง
  // (ต้องใช้ handle เพื่อ document.write/close แล้วสั่ง window.print()) — แทนที่จะใช้
  // noopener เราจึง null ค่า opener ด้วยตัวเองเพื่อปิดช่องโหว่ reverse-tabnabbing
  const popup = window.open("", "_blank", "width=1400,height=900")
  if (popup) {
    try {
      popup.opener = null
    } catch { /* ignore */ }
    popup.document.write(html)
    popup.document.close()
  }
}
