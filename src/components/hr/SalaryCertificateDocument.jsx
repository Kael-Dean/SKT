// src/components/hr/SalaryCertificateDocument.jsx
// ─────────────────────────────────────────────────────────────────────────────
// หนังสือรับรองเงินเดือน แบบกระดาษ A4 — โครงตามไฟล์ "หนังสือรับรองเงินเดือน.docx" ของ สกต.
// หัวกระดาษ (ตรา + ชื่อไทย/อังกฤษ + ที่อยู่) · ลายน้ำตรา สกต. กลางหน้า · ข้อความรับรอง · ผู้ลงนาม
//
//   <SalaryCertificateSheet data={…} />          แผ่นเอกสารขนาดจริง 210×297mm (ใช้ทั้งพรีวิวและพิมพ์)
//   <ScaledSheet>…</ScaledSheet>                  ย่อแผ่นให้พอดีความกว้างการ์ดบนจอ (ไม่กระทบตอนพิมพ์)
//   <PrintPortal>…</PrintPortal>                  สำเนาแผ่นที่จะพิมพ์ — portal เข้า body, แสดงเฉพาะตอน print
//
// สีและฟอนต์ของแผ่นกำหนดตายตัว (ไม่ตาม dark mode) เพราะเป็นภาพของกระดาษจริง
// ─────────────────────────────────────────────────────────────────────────────
import { useLayoutEffect, useRef, useState } from "react"
import { createPortal } from "react-dom"
import { DEFAULT_SIGNER, ORG_LETTERHEAD, bahtText, moneyText, thaiDateParts, thaiLongDate } from "../../lib/salaryCert"

const SHEET_W_PX = 794 // 210mm @ 96dpi
const SHEET_H_PX = 1123 // 297mm @ 96dpi

const INK = "#1d2420"
const MUTED = "#55605a"
const BRAND = "#1f7a3a" // เขียวตรา สกต.

/** ค่าที่ยังไม่กรอก → เส้นจุดแบบแบบฟอร์ม (จะได้เห็นชัดว่ายังขาดอะไร) */
function Fill({ children, min = "8em" }) {
  const empty = children == null || children === ""
  if (!empty) return <span style={{ fontWeight: 600 }}>{children}</span>
  return (
    <span
      aria-label="ยังไม่ได้กรอก"
      style={{ display: "inline-block", minWidth: min, borderBottom: `1.5px dotted ${MUTED}`, transform: "translateY(-0.2em)" }}
    >
      &nbsp;
    </span>
  )
}

/**
 * @param {{ data: {
 *   docNo?: string, issueDate?: string, name?: string, appointedDate?: string,
 *   position?: string, unit?: string, salary?: string|number, purpose?: string,
 *   signerName?: string, signerTitle?: string,
 * } }} props
 */
export function SalaryCertificateSheet({ data }) {
  const issue = thaiDateParts(data.issueDate)
  const salary = moneyText(data.salary)
  const salaryWords = bahtText(data.salary)
  const signerName = data.signerName?.trim() || DEFAULT_SIGNER.name
  const signerTitle = data.signerTitle?.trim() || DEFAULT_SIGNER.title

  return (
    <article
      aria-label="หนังสือรับรองเงินเดือน"
      style={{
        position: "relative",
        width: "210mm",
        height: "297mm",
        padding: "18mm 22mm 20mm 25mm",
        boxSizing: "border-box",
        overflow: "hidden",
        background: "#fff",
        color: INK,
        fontFamily: "'Sarabun', 'TH Sarabun New', sans-serif",
        fontSize: "16pt",
        lineHeight: 1.75,
        printColorAdjust: "exact",
        WebkitPrintColorAdjust: "exact",
      }}
    >
      {/* ลายน้ำ — ตรา สกต. จาง ๆ กลางหน้า */}
      <img
        src={ORG_LETTERHEAD.sealSrc}
        alt=""
        aria-hidden="true"
        draggable="false"
        style={{
          position: "absolute",
          left: "50%",
          top: "55%",
          width: "135mm",
          height: "135mm",
          transform: "translate(-50%, -50%)",
          opacity: 0.07,
          pointerEvents: "none",
          userSelect: "none",
        }}
      />

      <div style={{ position: "relative" }}>
        {/* หัวกระดาษ */}
        <header style={{ display: "flex", alignItems: "center", gap: "5mm" }}>
          <img src={ORG_LETTERHEAD.sealSrc} alt="ตรา สกต.สุรินทร์" style={{ width: "24mm", height: "24mm", flexShrink: 0 }} />
          <div style={{ minWidth: 0, lineHeight: 1.35 }}>
            <p style={{ margin: 0, fontSize: "15.5pt", fontWeight: 600, color: INK }}>{ORG_LETTERHEAD.nameTh}</p>
            <p style={{ margin: 0, fontSize: "11.5pt", color: MUTED }}>{ORG_LETTERHEAD.addressTh}</p>
            <p style={{ margin: "1.2mm 0 0", fontSize: "10.5pt", fontWeight: 600, letterSpacing: "0.12em", textTransform: "uppercase", color: BRAND }}>
              {ORG_LETTERHEAD.nameEn}
            </p>
            <p style={{ margin: 0, fontSize: "10pt", color: MUTED }}>{ORG_LETTERHEAD.addressEn}</p>
          </div>
        </header>
        <div aria-hidden="true" style={{ marginTop: "4mm", borderTop: `2px solid ${BRAND}` }} />
        <div aria-hidden="true" style={{ marginTop: "0.8mm", borderTop: `0.5px solid ${BRAND}` }} />

        {/* ชื่อเรื่อง + เลขที่ */}
        <h1 style={{ margin: "14mm 0 0", textAlign: "center", fontSize: "22pt", fontWeight: 600, letterSpacing: "0.02em" }}>
          หนังสือรับรองเงินเดือน
        </h1>
        <p style={{ margin: "6mm 0 0" }}>
          ที่ สกต. <Fill min="5em">{data.docNo?.trim()}</Fill>
        </p>

        {/* ข้อความรับรอง */}
        <p
          style={{
            margin: "8mm 0 0",
            textIndent: "25mm",
            textAlign: "justify",

            lineHeight: 2,
          }}
        >
          หนังสือฉบับนี้ให้ไว้เพื่อรับรองว่า <Fill min="12em">{data.name?.trim()}</Fill>{" "}
          ได้รับการบรรจุแต่งตั้งเป็นเจ้าหน้าที่{ORG_LETTERHEAD.nameTh} เมื่อวันที่{" "}
          <Fill min="9em">{thaiLongDate(data.appointedDate)}</Fill>{" "}
          ปัจจุบันดำรงตำแหน่ง <Fill min="8em">{data.position?.trim()}</Fill>{" "}
          ประจำ <Fill min="6em">{data.unit?.trim()}</Fill>{" "}
          ได้รับเงินเดือนในอัตราเดือนละ <Fill min="6em">{salary}</Fill> บาท
          {salaryWords && <> ({salaryWords})</>}
        </p>

        {data.purpose?.trim() && (
          <p style={{ margin: "3mm 0 0", textIndent: "25mm", textAlign: "justify", lineHeight: 2 }}>
            หนังสือรับรองฉบับนี้ออกให้เพื่อ{data.purpose.trim()}
          </p>
        )}

        <p style={{ margin: "10mm 0 0", textAlign: "center" }}>
          ให้ไว้ ณ วันที่ <Fill min="2.5em">{issue?.day}</Fill> เดือน <Fill min="6em">{issue?.month}</Fill> พ.ศ. <Fill min="3.5em">{issue?.year}</Fill>
        </p>

        {/* ผู้ลงนาม */}
        <div style={{ margin: "24mm 0 0 auto", width: "85mm", textAlign: "center", lineHeight: 1.6 }}>
          <p style={{ margin: 0, display: "flex", alignItems: "flex-end", gap: "2mm" }}>
            <span>(ลงชื่อ)</span>
            <span aria-hidden="true" style={{ flex: 1, borderBottom: `1.5px dotted ${MUTED}`, height: "1.2em" }} />
          </p>
          <p style={{ margin: "2mm 0 0" }}>({signerName})</p>
          <p style={{ margin: 0 }}>{signerTitle}</p>
        </div>
      </div>
    </article>
  )
}

/** ย่อแผ่น A4 ให้พอดีความกว้างที่มี — ใช้แสดงบนจอเท่านั้น */
export function ScaledSheet({ children, className }) {
  const ref = useRef(null)
  const [scale, setScale] = useState(1)
  useLayoutEffect(() => {
    const el = ref.current
    if (!el) return
    const update = () => setScale(Math.min(1, el.clientWidth / SHEET_W_PX))
    update()
    const ro = new ResizeObserver(update)
    ro.observe(el)
    return () => ro.disconnect()
  }, [])
  return (
    <div ref={ref} className={className} style={{ height: SHEET_H_PX * scale }}>
      <div
        style={{
          width: SHEET_W_PX,
          transform: `scale(${scale})`,
          transformOrigin: "top left",
          boxShadow: "0 1px 2px rgb(0 0 0 / .08), 0 12px 32px -12px rgb(0 0 0 / .25)",
        }}
      >
        {children}
      </div>
    </div>
  )
}

/**
 * สำเนาสำหรับพิมพ์ — อยู่ใต้ body โดยตรง ซ่อนบนจอ และ @media print ใน index.css
 * ซ่อนทุกอย่างอื่นให้เหลือแผ่นนี้แผ่นเดียว (ไม่โดน transform ของพรีวิว)
 */
export function PrintPortal({ children }) {
  if (typeof document === "undefined") return null
  return createPortal(<div className="salary-cert-print">{children}</div>, document.body)
}
