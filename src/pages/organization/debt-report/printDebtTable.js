const fmtMoney = (v) =>
  new Intl.NumberFormat("th-TH", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(parseFloat(v) || 0)

function todayThai() {
  return new Date().toLocaleDateString("th-TH", { year: "numeric", month: "long", day: "numeric" })
}

export function printDebtTable({ title, subtitle, tableRows, colTotals }) {
  let bodyRows = ""
  tableRows.forEach((group, gi) => {
    const rowBg = gi % 2 === 0 ? "#ffffff" : "#f8fafc"
    group.yearRows.forEach((yr, yi) => {
      bodyRows += `<tr style="background:${rowBg}">`
      if (yi === 0) {
        bodyRows += `<td rowspan="${group.yearRows.length}" style="text-align:center;vertical-align:middle;border:1px solid #94a3b8;padding:3px 4px">${gi + 1}</td>`
        bodyRows += `<td rowspan="${group.yearRows.length}" style="vertical-align:middle;border:1px solid #94a3b8;padding:3px 6px;font-weight:500">${group.program.prog_name}</td>`
      }
      bodyRows += `<td style="text-align:center;border:1px solid #94a3b8;padding:3px 4px">${yr.fiscalYear.year_name}</td>`
      const vals = [
        yr.carry_amount,  yr.carry_count,
        yr.new_amount,    yr.new_count,
        yr.paid_amount,   yr.paid_count,
        yr.remain_amount, yr.remain_count,
        yr.mobile_amount, yr.mobile_count,
        yr.cash_amount,   yr.cash_count,
        yr.produce_amount, yr.produce_count,
      ]
      vals.forEach((val, ci) => {
        bodyRows += `<td style="text-align:right;border:1px solid #94a3b8;padding:3px 4px;font-variant-numeric:tabular-nums">${ci % 2 === 0 ? fmtMoney(val) : (val || 0)}</td>`
      })
      bodyRows += `<td style="border:1px solid #94a3b8;padding:3px 4px;color:#6b7280">${yr.note || ""}</td>`
      bodyRows += `</tr>`
    })
  })

  const footVals = [
    colTotals.carry_amount,  colTotals.carry_count,
    colTotals.new_amount,    colTotals.new_count,
    colTotals.paid_amount,   colTotals.paid_count,
    colTotals.remain_amount, colTotals.remain_count,
    colTotals.mobile_amount, colTotals.mobile_count,
    colTotals.cash_amount,   colTotals.cash_count,
    colTotals.produce_amount, colTotals.produce_count,
  ]
  const footCells = footVals.map((val, ci) =>
    `<td style="text-align:right;border:1px solid #6ee7b7;padding:3px 4px;font-weight:700;background:#d1fae5;font-variant-numeric:tabular-nums">${ci % 2 === 0 ? fmtMoney(val) : (val || 0)}</td>`
  ).join("")

  const html = `<!DOCTYPE html>
<html lang="th">
<head>
  <meta charset="UTF-8">
  <title>${title}</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: 'Sarabun', 'Noto Sans Thai', 'TH Sarabun New', sans-serif; font-size: 10px; color: #1e293b; padding: 16px; }
    .doc-header { text-align: center; margin-bottom: 14px; }
    .doc-header h1 { font-size: 15px; font-weight: 700; }
    .doc-header .sub { font-size: 11px; color: #475569; margin-top: 4px; }
    table { border-collapse: collapse; width: 100%; }
    th { border: 1px solid #94a3b8; padding: 3px 4px; font-size: 9px; background: #f1f5f9; font-weight: 600; text-align: center; }
    td { border: 1px solid #94a3b8; padding: 3px 4px; font-size: 9px; }
    .pay { background: #eef2ff; }
    @page { size: A3 landscape; margin: 1cm; }
    @media print { body { padding: 0; } }
  </style>
</head>
<body>
  <div class="doc-header">
    <h1>${title}</h1>
    <div class="sub">${subtitle ? subtitle + " &nbsp;|&nbsp; " : ""}วันที่พิมพ์: ${todayThai()}</div>
  </div>
  <table>
    <thead>
      <tr>
        <th rowspan="2" style="width:36px">ลำดับ</th>
        <th rowspan="2" style="min-width:150px;text-align:left">โครงการ</th>
        <th rowspan="2" style="width:72px">ปีการผลิต</th>
        <th colspan="2">ยอดยกมา</th>
        <th colspan="2">เพิ่มในปี</th>
        <th colspan="2">รับชำระ</th>
        <th colspan="2">คงเหลือ</th>
        <th colspan="2" class="pay">โอนผ่านมือถือ</th>
        <th colspan="2" class="pay">เงินสด</th>
        <th colspan="2" class="pay">ชำระด้วยผลผลิต</th>
        <th rowspan="2" style="width:80px">หมายเหตุ</th>
      </tr>
      <tr>
        <th>จำนวน(บาท)</th><th>จำนวนราย</th>
        <th>จำนวน(บาท)</th><th>จำนวนราย</th>
        <th>จำนวน(บาท)</th><th>จำนวนราย</th>
        <th>จำนวน(บาท)</th><th>จำนวนราย</th>
        <th class="pay">จำนวน(บาท)</th><th class="pay">จำนวนราย</th>
        <th class="pay">จำนวน(บาท)</th><th class="pay">จำนวนราย</th>
        <th class="pay">จำนวน(บาท)</th><th class="pay">จำนวนราย</th>
      </tr>
    </thead>
    <tbody>${bodyRows}</tbody>
    <tfoot>
      <tr>
        <td colspan="3" style="font-weight:700;background:#d1fae5;border:1px solid #6ee7b7;padding:3px 8px">รวมทั้งหมด</td>
        ${footCells}
        <td style="background:#d1fae5;border:1px solid #6ee7b7"></td>
      </tr>
    </tfoot>
  </table>
  <script>window.onload = function() { window.print() }</script>
</body>
</html>`

  const popup = window.open("", "_blank", "width=1400,height=900")
  if (popup) {
    popup.document.write(html)
    popup.document.close()
  }
}
