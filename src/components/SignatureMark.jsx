// src/components/SignatureMark.jsx
// เส้นจุดช่อง "ลงชื่อ" + ลายเซ็นวางทับ (ถ้ามี) — รูปลอยเหนือเส้นแบบ absolute จึงไม่ดันเลย์เอาต์ของแผ่น A4
// ใช้ในเอกสารที่เป็นภาพกระดาษ (สี/ขนาดตายตัว ไม่ตาม dark mode)
//
//   <SignatureMark src={dataUri} name="นายสมชาย ใจดี" rule="1.2px dotted #9aa39d" height="12mm" />

export default function SignatureMark({ src, name, rule, height = "12mm", lineHeight = "1.1em", style }) {
  return (
    <span
      style={{
        position: "relative",
        flex: 1,
        minWidth: 0,
        height: lineHeight,
        borderBottom: rule,
        ...style,
      }}
    >
      {src ? (
        <img
          src={src}
          alt={name ? `ลายมือชื่อ ${name}` : "ลายมือชื่อ"}
          draggable="false"
          onContextMenu={(e) => e.preventDefault()}
          style={{
            position: "absolute",
            left: "50%",
            bottom: "-1.2mm",
            height,
            width: "auto",
            maxWidth: "100%",
            objectFit: "contain",
            transform: "translateX(-50%)",
            pointerEvents: "none",
            userSelect: "none",
            printColorAdjust: "exact",
            WebkitPrintColorAdjust: "exact",
          }}
        />
      ) : null}
    </span>
  )
}
