// สร้าง index.html จาก content.mjs  →  node build.mjs
import { writeFileSync } from "node:fs"
import { SECTIONS } from "./content.mjs"

const FOOT = "คู่มือการใช้งาน ระบบบริหารทรัพยากรบุคคล (HR) งวดที่ 4 · สัญญาเลขที่ 002/2569"
const PAGES = [] // { html }

// ---------- เนื้อหาหน้าต่าง ๆ ----------
const cover = `
<div class="cover">
  <div class="cover-bar"></div>
  <div class="cover-body">
    <div class="eyebrow">คู่มือการใช้งาน · งวดที่ 4 จาก 6</div>
    <h1>ระบบบริหารทรัพยากรบุคคล (HR)</h1>
    <div class="grp">กลุ่มกำกับดูแลและวินัย</div>
    <ul class="cover-list">
      <li><b>ระบบประเมินผล KPI</b><span>TOR ข้อ 3.12</span></li>
      <li><b>ระบบตักเตือนพนักงานเรื่องระเบียบ</b><span>สัญญาข้อ 7.1 งวดที่ 4</span></li>
      <li><b>ระบบรายงานปัญหาและการแก้ไขข้อมูล</b><span>TOR ข้อ 3.6</span></li>
    </ul>
    <dl class="meta">
      <dt>สัญญาเลขที่</dt><dd>002/2569 (ลงวันที่ 4 กันยายน 2569)</dd>
      <dt>ผู้ว่าจ้าง</dt><dd>สหกรณ์การเกษตรเพื่อการตลาดลูกค้า ธ.ก.ส.สุรินทร์ จำกัด</dd>
      <dt>ชื่อแอป</dt><dd>AMC สกต.สุรินทร์</dd>
      <dt>ภาพประกอบ</dt><dd>ถ่ายจากระบบทดสอบ (staging) ด้วยข้อมูลทดสอบ เมื่อวันที่ 17–18 พฤศจิกายน 2569 (หมวดวินัยถ่ายใหม่ตามระบบเวอร์ชันล่าสุด)</dd>
    </dl>
  </div>
</div>`

function toc(startPage) {
  let p = startPage
  const rows = []
  for (const s of SECTIONS) {
    rows.push(`<tr class="sec"><td colspan="2">${s.title}<small>${s.ref}</small></td></tr>`)
    for (const pg of s.pages) { rows.push(`<tr><td>${pg.title}</td><td class="r">${p++}</td></tr>`) }
  }
  return `<h2 class="h2">สารบัญ</h2><table class="toc">${rows.join("")}</table>
  <div class="note"><b>วิธีอ่านภาพ</b> กรอบแดงและวงกลมเลขแดงในภาพคือจุดที่อธิบาย เลขในวงกลมตรงกับรายการหมายเลขใต้ภาพ</div>`
}

function figHtml(f, two) {
  const legend = f.legend.map((t, i) => `<li><span class="n">${i + 1}</span><span>${t}</span></li>`).join("")
  return `<figure class="fig ${two ? "two" : ""}">
    ${f.caption ? `<figcaption>${f.caption}</figcaption>` : ""}
    <img src="img/${f.img}.jpg" alt="">
    <ol class="legend">${legend}</ol>
  </figure>`
}

function featurePage(sec, pg, idx) {
  const two = pg.figs.length > 1
  return `
  <div class="secbar"><span>${sec.title}</span><span>${sec.ref}</span></div>
  <div class="head"><div class="num">${idx}</div><h2>${pg.title}</h2><div class="pill">ผู้ใช้: ${pg.role}</div></div>
  <div class="crumb">เมนู: ${pg.path.map((x, i) => (i === pg.path.length - 1 ? `<b>${x}</b>` : x)).join(" → ")}</div>
  ${pg.figs.map((f) => figHtml(f, two)).join("")}
  ${pg.tip ? `<div class="note">${pg.tip}</div>` : ""}`
}

function closing() {
  return `<h2 class="h2">หมายเหตุการใช้งานและข้อมูลที่ใช้ถ่ายภาพ</h2>
  <ul class="notes">
    <li>ภาพประกอบทั้งหมดถ่ายจากระบบทดสอบ (staging) ด้วยบัญชีผู้ดูแลระบบ และข้อมูลทดสอบ ไม่ใช่ข้อมูลจริงของสหกรณ์</li>
    <li>สิทธิ์ของแต่ละบทบาทเป็นไปตามตาราง \"สิทธิ์ตามบทบาท\" ในระบบ (เมนู สิทธิ์ตามบทบาท — ผู้ดูแลระบบเปิดดูได้) ผู้ใช้ที่ไม่มีสิทธิ์จะไม่เห็นเมนูหรือปุ่มนั้น</li>
    <li>ชื่อผู้แจ้งเรื่องวินัยเป็นความลับ: ผู้ถูกแจ้งและฝ่ายบุคคลไม่เห็นชื่อผู้แจ้ง</li>
    <li>ข้อความเกี่ยวกับการหักค่าจ้างจากการพักงานใช้คำว่า "งดจ่าย" ตามที่ TOR กำหนด</li>
    <li>ภาพที่เป็นหน้าต่างยืนยัน (ลงโทษ / บันทึกผลประกอบการ / ส่งเรื่อง) ถ่ายเพื่อแสดงขั้นตอนโดยไม่กดบันทึก เพื่อไม่ให้ข้อมูลทดสอบเปลี่ยน</li>
    <li>หากพบข้อมูลไม่ถูกต้องในระบบ ให้ใช้ปุ่ม \"แจ้งแก้ไขข้อมูล\" ในหน้า ข้อมูลส่วนตัว</li>
  </ul>`
}

// ---------- ประกอบหน้า ----------
PAGES.push({ cls: "p-cover", html: cover, nofoot: true })
PAGES.push({ cls: "", html: "__TOC__" })
for (const s of SECTIONS) {
  s.pages.forEach((pg, i) => PAGES.push({ cls: "p-feat", html: featurePage(s, pg, i + 1) }))
}
PAGES.push({ cls: "", html: closing() })
PAGES[1].html = toc(3)

const N = PAGES.length
const body = PAGES.map((p, i) => `<section class="page ${p.cls}">${p.html}${p.nofoot ? "" : `<div class="foot"><span>${FOOT}</span><span>หน้า ${i + 1} / ${N}</span></div>`}</section>`).join("\n")

const css = `
@import url('https://fonts.googleapis.com/css2?family=Sarabun:wght@400;500;600;700&display=swap');
@page{size:A4;margin:0}
:root{--ink:#1f2937;--mut:#6b7280;--indigo:#3730a3;--indigo2:#4f46e5;--line:#e5e7eb;--amber-bg:#fffbeb;--amber:#b45309;--red:#dc2626}
*{box-sizing:border-box}
html,body{margin:0;background:#fff;color:var(--ink);font-family:'Sarabun','Leelawadee UI','Tahoma',sans-serif;font-size:10.5pt;line-height:1.45}
.page{width:210mm;height:297mm;position:relative;overflow:hidden;padding:12mm 14mm 16mm;page-break-after:always;break-after:page}
.foot{position:absolute;left:14mm;right:14mm;bottom:7mm;display:flex;justify-content:space-between;font-size:8pt;color:var(--mut);border-top:1px solid var(--line);padding-top:2mm}
.secbar{display:flex;justify-content:space-between;background:var(--indigo);color:#fff;padding:2.2mm 4mm;border-radius:2mm;font-weight:600;font-size:10pt}
.secbar span+span{font-weight:400;opacity:.85}
.head{display:flex;align-items:center;gap:3mm;margin:4mm 0 1.5mm}
.num{flex:none;width:8mm;height:8mm;border-radius:2mm;background:#1e1b4b;color:#fff;font-weight:700;display:flex;align-items:center;justify-content:center}
.head h2{margin:0;font-size:15pt;line-height:1.25;flex:1}
.pill{flex:none;max-width:70mm;text-align:right;font-size:8pt;color:var(--indigo);background:#eef2ff;border-radius:99px;padding:1mm 3mm;line-height:1.3}
.crumb{font-size:9pt;color:var(--mut);padding-bottom:2mm;border-bottom:1.2px solid #1e1b4b;margin-bottom:3mm}
.crumb b{color:var(--ink)}
.fig{margin:0 0 3mm}
.fig figcaption{font-weight:600;font-size:9.5pt;color:var(--indigo);margin-bottom:1.5mm}
.fig img{display:block;width:100%;border:1px solid var(--line);border-radius:2mm;box-shadow:0 1px 3px rgba(0,0,0,.08)}
.fig.two img{width:150mm;margin:0 auto}
.legend{list-style:none;margin:2.2mm 0 0;padding:0;display:grid;grid-template-columns:1fr 1fr;gap:1.2mm 5mm;font-size:9pt}
.fig.two .legend{font-size:8.5pt;gap:.8mm 5mm}
.legend li{display:flex;gap:2mm;align-items:flex-start;break-inside:avoid}
.legend .n{flex:none;width:4.6mm;height:4.6mm;border-radius:50%;background:var(--red);color:#fff;font-size:7.5pt;font-weight:700;display:flex;align-items:center;justify-content:center;margin-top:.5mm}
.note{background:var(--amber-bg);border-left:1.2mm solid #f59e0b;color:#78350f;padding:2.2mm 3.5mm;border-radius:1.5mm;font-size:9pt;margin-top:2mm}
.note b{color:var(--amber)}
.h2{font-size:17pt;margin:6mm 0 4mm;color:#1e1b4b}
.toc{width:100%;border-collapse:collapse;font-size:9pt}
.toc td{padding:.55mm 2mm;border-bottom:1px dotted #cbd5e1}
.toc td.r{text-align:right;width:14mm;color:var(--mut)}
.toc tr.sec td{background:#eef2ff;color:var(--indigo);font-weight:700;border:0;padding:1.3mm 2mm}
.toc tr.sec small{float:right;font-weight:400;color:var(--mut)}
.notes{padding-left:5mm;line-height:1.7}
.p-cover{padding:0;background:#fff}
.cover-bar{height:60mm;background:linear-gradient(135deg,#312e81,#4f46e5);}
.cover-body{padding:14mm 18mm}
.eyebrow{color:var(--indigo2);font-weight:600;letter-spacing:.3px;margin-bottom:3mm}
.cover h1{font-size:26pt;line-height:1.2;margin:0 0 2mm;color:#1e1b4b}
.grp{font-size:17pt;color:var(--indigo);font-weight:600;margin-bottom:8mm}
.cover-list{list-style:none;padding:0;margin:0 0 10mm}
.cover-list li{display:flex;justify-content:space-between;padding:3mm 4mm;border:1px solid var(--line);border-radius:2mm;margin-bottom:2.5mm;font-size:12pt}
.cover-list span{color:var(--mut);font-size:10pt}
.meta{display:grid;grid-template-columns:30mm 1fr;gap:2mm 4mm;font-size:10.5pt}
.meta dt{color:var(--mut)}.meta dd{margin:0}
`

writeFileSync(new URL("./index.html", import.meta.url), `<!doctype html><html lang="th"><head><meta charset="utf-8"><title>SKT-HR คู่มือการใช้งาน งวด 4</title><style>${css}</style></head><body>${body}</body></html>`)
console.log("pages", N)
