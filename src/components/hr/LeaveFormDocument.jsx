// src/components/hr/LeaveFormDocument.jsx
// ─────────────────────────────────────────────────────────────────────────────
// ใบลา แบบกระดาษ A4 — วาดจากข้อมูล JSON (lib/leaveForm.js) แทน PDF ของ backend
// หัวกระดาษตรา สกต. แบบเดียวกับหนังสือรับรองเงินเดือน · ตารางสถิติการลาในปีงบ ·
// ส่วนท้าย 2 คอลัมน์ (ความเห็นผู้บังคับบัญชา | บันทึกผู้ตรวจสอบ) เป็น grid เดียว → ทุกบรรทัดตรงกันเสมอ
//
//   <LeaveFormSheet data={loadLeaveForm(...)} printedAt={Date} />
//
// สี/ฟอนต์ตายตัว (ไม่ตาม dark mode) เพราะเป็นภาพของกระดาษจริง
// ─────────────────────────────────────────────────────────────────────────────
import { ORG_LETTERHEAD, thaiLongDate } from "../../lib/salaryCert"
import { FORM_LEAVE_KINDS } from "../../lib/leaveForm"
import { fmtDays, fmtLeaveDuration } from "../../lib/leaveDays"

const INK = "#1d2420"
const MUTED = "#5b6660"
const RULE = "#9aa39d"
const BRAND = "#1f7a3a" // เขียวตรา สกต.
const TINT = "#eef6f0"

const NOTE_LINES = 3
const LINE_H = "7.2mm"

const STATUS_TEXT = {
  approved: "อนุมัติแล้ว",
  rejected: "ไม่อนุมัติ",
  cancelled: "ยกเลิกแล้ว",
}
const statusText = (s) => STATUS_TEXT[s] ?? (String(s ?? "").startsWith("pending") ? "รออนุมัติ" : "")

const hhmm = (t) => (t ? `${String(t).slice(0, 5)} น.` : "")
const shortDate = (v) => {
  if (!v) return ""
  const d = new Date(String(v).length <= 10 ? `${v}T00:00:00` : v)
  return Number.isNaN(d.getTime()) ? "" : d.toLocaleDateString("th-TH", { day: "numeric", month: "short", year: "numeric" })
}
const dayCell = (n) => (n == null || n === 0 ? "–" : fmtDays(n))

/** ค่าบนเส้นจุดแบบแบบฟอร์ม — ว่าง = เส้นจุดเปล่าให้เขียนมือ */
function Field({ children, min = "6em", grow = false, align = "center" }) {
  const empty = children == null || children === ""
  return (
    <span
      style={{
        display: "inline-block",
        minWidth: min,
        flex: grow ? 1 : undefined,
        padding: "0 1.5mm",
        borderBottom: `1.2px dotted ${RULE}`,
        textAlign: align,
        fontWeight: empty ? 400 : 600,
        lineHeight: 1.45,
      }}
    >
      {empty ? " " : children}
    </span>
  )
}

/** บรรทัดแบบ flex — ป้ายกับค่าบนเส้นเดียวกัน ตัดบรรทัดได้ */
function Line({ children, style }) {
  return (
    <div style={{ display: "flex", flexWrap: "wrap", alignItems: "baseline", columnGap: "2mm", rowGap: "1.5mm", ...style }}>
      {children}
    </div>
  )
}

function Box({ checked }) {
  return (
    <span
      aria-hidden="true"
      style={{
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        width: "3.6mm",
        height: "3.6mm",
        marginRight: "1.2mm",
        border: `1.2px solid ${checked ? BRAND : MUTED}`,
        borderRadius: "0.6mm",
        background: checked ? BRAND : "transparent",
        color: "#fff",
        fontSize: "9pt",
        lineHeight: 1,
        transform: "translateY(0.4mm)",
      }}
    >
      {checked ? "✓" : ""}
    </span>
  )
}

/** กล่องบันทึกมีเส้นบรรทัด — สูงคงที่ NOTE_LINES บรรทัด ทั้งสองฝั่งจึงเท่ากัน */
function NoteBox({ lines }) {
  return (
    <div
      style={{
        height: `calc(${LINE_H} * ${NOTE_LINES})`,
        overflow: "hidden",
        lineHeight: LINE_H,
        fontSize: "11.5pt",
        backgroundImage: `repeating-linear-gradient(to bottom, transparent 0, transparent calc(${LINE_H} - 1px), ${RULE} calc(${LINE_H} - 1px), ${RULE} ${LINE_H})`,
        backgroundSize: `100% ${LINE_H}`,
        printColorAdjust: "exact",
        WebkitPrintColorAdjust: "exact",
      }}
    >
      {lines.map((l, i) => (
        <div key={i} style={{ color: l.muted ? MUTED : INK, overflowWrap: "anywhere" }}>
          {l.text}
        </div>
      ))}
    </div>
  )
}

/** แถวลงชื่อ 1 คู่ (ซ้าย/ขวา) ใน grid — 2 เซลล์ต่อแถว จึงอยู่บรรทัดเดียวกันเสมอ */
function SignRow({ left, right }) {
  const cell = (c) => (
    <div style={{ display: "flex", alignItems: "baseline", gap: "2mm", padding: "0 3mm" }}>{c}</div>
  )
  return (
    <>
      {cell(left)}
      {cell(right)}
    </>
  )
}

const signLine = (role) => (
  <>
    <span>ลงชื่อ</span>
    <span aria-hidden="true" style={{ flex: 1, borderBottom: `1.2px dotted ${RULE}`, height: "1.1em" }} />
    <span>{role}</span>
  </>
)
const nameLine = (name) => (
  <>
    <span>(</span>
    <span style={{ flex: 1, textAlign: "center", borderBottom: `1.2px dotted ${RULE}`, fontWeight: name ? 600 : 400 }}>{name || " "}</span>
    <span>)</span>
  </>
)
const labeledLine = (label, value) => (
  <>
    <span>{label}</span>
    <span style={{ flex: 1, textAlign: "center", borderBottom: `1.2px dotted ${RULE}` }}>{value || " "}</span>
  </>
)

export function LeaveFormSheet({ data, printedAt = new Date() }) {
  const created = thaiLongDate(data.createdAt)
  const status = statusText(data.status)
  const otherKind = data.kind === "other"
  const duration = fmtLeaveDuration(data.totalDays, { fromTime: data.fromTime, toTime: data.toTime })

  const finalApproval = [...data.approvals].reverse().find((a) => /APPROVE|REJECT/.test(a.action)) ?? data.approvals[data.approvals.length - 1]
  const leftLines = data.approvals.flatMap((a) => [
    { text: `${a.label}${a.name ? ` — ${a.name}` : ""}${a.position ? ` (${a.position})` : ""}${a.at ? ` · ${shortDate(a.at)}` : ""}` },
    ...(a.comment ? [{ text: `“${a.comment}”`, muted: true }] : []),
  ])
  const rightLines = data.review.note
    ? [{ text: data.review.note }, ...(data.review.at ? [{ text: `ตรวจเมื่อ ${shortDate(data.review.at)}`, muted: true }] : [])]
    : []

  const th = { padding: "1.1mm 2.5mm", fontWeight: 600, fontSize: "11.5pt", borderBottom: `1.2px solid ${BRAND}`, textAlign: "right", whiteSpace: "nowrap" }
  const td = { padding: "0.8mm 2.5mm", textAlign: "right", fontVariantNumeric: "tabular-nums", borderBottom: `0.6px solid #d8ddd9` }

  return (
    <article
      aria-label={`ใบลาเลขที่ ${data.docNo}`}
      style={{
        position: "relative",
        width: "210mm",
        height: "297mm",
        padding: "11mm 17mm 10mm 19mm",
        boxSizing: "border-box",
        overflow: "hidden",
        background: "#fff",
        color: INK,
        fontFamily: "'Sarabun', 'TH Sarabun New', sans-serif",
        fontSize: "12.5pt",
        lineHeight: 1.45,
        printColorAdjust: "exact",
        WebkitPrintColorAdjust: "exact",
        display: "flex",
        flexDirection: "column",
      }}
    >
      {/* ลายน้ำตรา */}
      <img
        src={ORG_LETTERHEAD.sealSrc}
        alt=""
        aria-hidden="true"
        draggable="false"
        style={{ position: "absolute", left: "50%", top: "50%", width: "120mm", height: "120mm", transform: "translate(-50%, -50%)", opacity: 0.05, pointerEvents: "none" }}
      />

      <div style={{ position: "relative", display: "flex", flexDirection: "column", flex: 1 }}>
        {/* หัวกระดาษ */}
        <header style={{ display: "flex", alignItems: "center", gap: "4mm" }}>
          <img src={ORG_LETTERHEAD.sealSrc} alt="ตรา สกต.สุรินทร์" style={{ width: "16mm", height: "16mm", flexShrink: 0 }} />
          <div style={{ minWidth: 0, flex: 1, lineHeight: 1.35 }}>
            <p style={{ margin: 0, fontSize: "14.5pt", fontWeight: 600 }}>{ORG_LETTERHEAD.nameTh}</p>
            <p style={{ margin: 0, fontSize: "10.5pt", color: MUTED }}>{ORG_LETTERHEAD.addressTh}</p>
            <p style={{ margin: "0.6mm 0 0", fontSize: "9.5pt", fontWeight: 600, letterSpacing: "0.12em", textTransform: "uppercase", color: BRAND }}>
              {ORG_LETTERHEAD.nameEn}
            </p>
          </div>
          <div style={{ flexShrink: 0, textAlign: "right", lineHeight: 1.35, fontSize: "10.5pt", color: MUTED }}>
            <p style={{ margin: 0 }}>ใบลาเลขที่</p>
            <p style={{ margin: 0, fontSize: "15pt", fontWeight: 700, color: INK, fontVariantNumeric: "tabular-nums" }}>{data.docNo}</p>
            {status && (
              <p style={{ margin: "0.8mm 0 0", display: "inline-block", padding: "0 2.5mm", borderRadius: "1mm", background: TINT, color: BRAND, fontWeight: 600 }}>
                {status}
              </p>
            )}
          </div>
        </header>
        <div aria-hidden="true" style={{ marginTop: "2.5mm", borderTop: `2px solid ${BRAND}` }} />
        <div aria-hidden="true" style={{ marginTop: "0.7mm", borderTop: `0.5px solid ${BRAND}` }} />

        {/* ชื่อเอกสาร + วันที่ */}
        <h1 style={{ margin: "3mm 0 0", textAlign: "center", fontSize: "19pt", fontWeight: 700, letterSpacing: "0.04em", lineHeight: 1.3 }}>ใบลา</h1>

        <Line style={{ marginTop: "1mm" }}>
          <span style={{ fontWeight: 600, width: "12mm" }}>เรื่อง</span>
          <span>ขออนุญาตลาหยุดงาน{data.typeName ? ` (${data.typeName})` : ""}</span>
          <span style={{ marginLeft: "auto" }}>วันที่</span>
          <Field min="38mm">{created}</Field>
        </Line>
        <Line>
          <span style={{ fontWeight: 600, width: "12mm" }}>เรียน</span>
          <span>ผู้จัดการ {ORG_LETTERHEAD.short}</span>
        </Line>

        {/* เนื้อความ */}
        <div style={{ marginTop: "2mm", display: "grid", rowGap: "1.3mm" }}>
          <Line style={{ paddingLeft: "12mm" }}>
            <span>ข้าพเจ้า</span>
            <Field min="40mm" grow>{data.name}</Field>
            <span>ตำแหน่ง</span>
            <Field min="32mm" grow>{data.position}</Field>
            <span>สังกัด</span>
            <Field min="26mm" grow>{data.branch}</Field>
          </Line>
          <Line>
            <span style={{ marginRight: "1mm" }}>ขออนุญาตลา</span>
            {FORM_LEAVE_KINDS.map((k) => (
              <span key={k.key} style={{ whiteSpace: "nowrap", marginRight: "2mm" }}>
                <Box checked={data.kind === k.key} />
                {k.label}
              </span>
            ))}
            <span style={{ whiteSpace: "nowrap" }}>
              <Box checked={otherKind} />
              อื่น ๆ
            </span>
            {otherKind && <Field min="25mm">{data.typeName}</Field>}
          </Line>
          <Line>
            <span>เนื่องจาก</span>
            <Field min="80mm" grow align="left">{data.reason}</Field>
          </Line>
          <Line>
            <span>ตั้งแต่วันที่</span>
            <Field min="34mm">{thaiLongDate(data.fromDate)}</Field>
            {data.fromTime && (<><span>เวลา</span><Field min="16mm">{hhmm(data.fromTime)}</Field></>)}
            <span>ถึงวันที่</span>
            <Field min="34mm">{thaiLongDate(data.toDate)}</Field>
            {data.toTime && (<><span>เวลา</span><Field min="16mm">{hhmm(data.toTime)}</Field></>)}
            <span>รวม</span>
            <Field min="20mm">{duration !== "—" ? duration : ""}</Field>
            {data.extraDays > 0 && (
              <span style={{ fontSize: "11.5pt", color: MUTED }}>(เกินสิทธิ์ {fmtDays(data.extraDays)} วัน)</span>
            )}
          </Line>
          <Line>
            <span>ระหว่างลาติดต่อได้ที่</span>
            <Field min="70mm" grow align="left">{data.address}</Field>
            <span>โทรศัพท์</span>
            <Field min="40mm">{data.phone}</Field>
          </Line>
        </div>

        {/* จึงเรียน + ผู้ขอลา — แถวเดียวกัน */}
        <div style={{ marginTop: "1.5mm", display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: "6mm" }}>
          <p style={{ margin: 0, paddingLeft: "15mm" }}>จึงเรียนมาเพื่อโปรดพิจารณา</p>
          <div style={{ width: "80mm", flexShrink: 0, textAlign: "center", lineHeight: 1.5 }}>
            <p style={{ margin: 0 }}>ขอแสดงความนับถือ</p>
            <Line style={{ marginTop: "5mm", flexWrap: "nowrap" }}>{signLine("ผู้ขออนุญาตลา")}</Line>
            <Line style={{ flexWrap: "nowrap" }}>{nameLine(data.name)}</Line>
          </div>
        </div>

        {/* สถิติการลา */}
        <section style={{ marginTop: "3mm" }}>
          <p style={{ margin: "0 0 1mm", fontSize: "12.5pt", fontWeight: 600, color: BRAND }}>
            สถิติการลาในปีงบประมาณ {data.fiscalYear ?? "—"}
            <span style={{ fontWeight: 400, color: MUTED }}> (หน่วย: วัน)</span>
          </p>
          {data.stats.length ? (
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "12pt" }}>
              <thead>
                <tr style={{ background: TINT }}>
                  <th style={{ ...th, textAlign: "left" }}>ประเภทการลา</th>
                  <th style={th}>สิทธิ์</th>
                  <th style={th}>ลามาแล้ว</th>
                  <th style={th}>ลาครั้งนี้</th>
                  <th style={th}>รวม</th>
                  <th style={th}>คงเหลือ</th>
                </tr>
              </thead>
              <tbody>
                {data.stats.map((s) => (
                  <tr key={s.key} style={s.isThis ? { background: "#f6faf7" } : undefined}>
                    <td style={{ ...td, textAlign: "left", fontWeight: s.isThis ? 600 : 400 }}>{s.label}</td>
                    <td style={td}>
                      {s.entitled == null ? "–" : fmtDays(s.entitled)}
                      {s.carried ? <span style={{ color: MUTED, fontSize: "10.5pt" }}> +ยกมา {fmtDays(s.carried)}</span> : null}
                    </td>
                    <td style={td}>{dayCell(s.before)}</td>
                    <td style={{ ...td, fontWeight: s.now ? 700 : 400 }}>{dayCell(s.now)}</td>
                    <td style={td}>{dayCell(s.total)}</td>
                    <td style={{ ...td, fontWeight: 600, color: s.remaining != null && s.remaining < 0 ? "#b42318" : INK }}>
                      {s.remaining == null ? "–" : fmtDays(s.remaining)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <p style={{ margin: 0, color: MUTED, fontSize: "12pt" }}>ไม่มีข้อมูลสิทธิ์การลาของปีนี้</p>
          )}
        </section>

        {/* ความเห็น / ตรวจสอบ — grid 2 คอลัมน์ แถวต่อแถว */}
        <section
          style={{
            marginTop: "4mm",
            display: "grid",
            gridTemplateColumns: "minmax(0, 1fr) minmax(0, 1fr)",
            rowGap: "1.6mm",
            border: `1px solid ${RULE}`,
            borderRadius: "1.5mm",
            padding: "0 0 3mm",
            backgroundImage: `linear-gradient(${RULE}, ${RULE})`,
            backgroundSize: "1px 100%",
            backgroundPosition: "center",
            backgroundRepeat: "no-repeat",
          }}
        >
          <h2 style={{ margin: 0, padding: "1.2mm 3mm", fontSize: "12pt", fontWeight: 600, color: BRAND, background: TINT, borderTopLeftRadius: "1.5mm" }}>
            ความเห็นผู้บังคับบัญชา
          </h2>
          <h2 style={{ margin: 0, padding: "1.2mm 3mm", fontSize: "12pt", fontWeight: 600, color: BRAND, background: TINT, borderTopRightRadius: "1.5mm" }}>
            บันทึกผู้ตรวจสอบ (ฝ่ายบุคคล)
          </h2>
          <div style={{ padding: "0 3mm" }}><NoteBox lines={leftLines} /></div>
          <div style={{ padding: "0 3mm" }}><NoteBox lines={rightLines} /></div>
          <div aria-hidden="true" style={{ height: "2mm" }} />
          <div aria-hidden="true" style={{ height: "2mm" }} />
          <SignRow left={signLine("ผู้บันทึก")} right={signLine("ผู้ตรวจ")} />
          <SignRow left={nameLine(finalApproval?.name)} right={nameLine(data.review.name)} />
          <SignRow left={labeledLine("ตำแหน่ง", finalApproval?.position)} right={labeledLine("ตำแหน่ง", data.review.position)} />
          <SignRow left={labeledLine("วันที่", shortDate(finalApproval?.at))} right={labeledLine("วันที่", shortDate(data.review.at))} />
        </section>

        <p style={{ margin: "auto 0 0", paddingTop: "3mm", textAlign: "right", fontSize: "9pt", color: MUTED }}>
          ใบลาเลขที่ {data.docNo} · พิมพ์จากระบบ AMC {ORG_LETTERHEAD.short} เมื่อ{" "}
          {printedAt.toLocaleString("th-TH", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" })}
        </p>
      </div>
    </article>
  )
}
