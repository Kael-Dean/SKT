import { useIsPhone } from "../../hooks/useMediaQuery"

/**
 * ลายตกแต่งการ์ดต้อนรับหน้า Home ตามฤดูกาล/เทศกาลไทย
 * - SVG ล้วน (ไม่มีรูป/ไลบรารี) โปร่งใสบนพื้น indigo เดิม, จางหายทางซ้ายเพื่อไม่ให้ทับข้อความ
 * - เคลื่อนไหวเบา ๆ ด้วย CSS (keyframes `wa-*` ใน index.css); prefers-reduced-motion = ภาพนิ่ง
 * - เลือกฤดูด้วย getSeason() ที่ src/lib/season.js
 */

const sx = (x) => Math.round(60 + (x - 480) * 1.9)

/* ── ชิ้นส่วนใช้ซ้ำ ─────────────────────────────────────────────────────── */
// หมายเหตุ: CSS transform (ใน class wa-*) ทับ attribute transform บน element เดียวกัน
// จึงให้ <g transform> เป็นตัวจัดตำแหน่ง แล้วซ้อน element ที่ animate ไว้ข้างใน

const delay = (s) => ({ animationDelay: `${s}s` })

function Star({ x, y, r = 1.5, d = 0 }) {
  return <circle cx={x} cy={y} r={r} fill="#fff" className="wa-twinkle" style={delay(d)} />
}

function Sparkle({ x, y, s = 1, d = 0, fill = "#fde68a" }) {
  return (
    <g transform={`translate(${x} ${y}) scale(${s})`}>
      <path
        d="M0,-9 Q0,0 9,0 Q0,0 0,9 Q0,0 -9,0 Q0,0 0,-9Z"
        fill={fill}
        className="wa-twinkle"
        style={delay(d)}
      />
    </g>
  )
}

function wavePath(y, amp, width = 1400) {
  const x0 = -1400
  let d = `M${x0} ${y} Q${x0 + 50} ${y - amp} ${x0 + 100} ${y}`
  for (let x = x0 + 200; x <= width; x += 100) d += ` T${x} ${y}`
  return `${d} V200 H${x0}Z`
}

function Waves({ y = 172, tone = "#fff" }) {
  return (
    <>
      <path d={wavePath(y + 6, 7)} fill={tone} opacity=".07" className="wa-drift-slow" />
      <path d={wavePath(y + 14, 6)} fill={tone} opacity=".1" className="wa-drift" />
    </>
  )
}

// วงลายเส้นบาง ๆ ให้ทุกฤดูมีพื้นผิวร่วมกัน (guilloché เบา ๆ)
function Rings() {
  return (
    <g fill="none" stroke="#fff" strokeWidth="1" opacity=".07">
      {Array.from({ length: 9 }).map((_, i) => (
        <circle key={i} cx="980" cy="250" r={90 + i * 52} />
      ))}
    </g>
  )
}

function Lantern({ x, y, s = 1, d = 0 }) {
  return (
    <g transform={`translate(${x} ${y}) scale(${s})`}>
      <g className="wa-rise" style={{ animationDelay: `${d}s` }}>
        <circle cy="8" r="20" fill="#fde68a" opacity=".16" />
        <path d="M-9,-13 Q0,-19 9,-13 L11,9 Q0,14 -11,9Z" fill="url(#wa-lan)" />
        <path d="M-9,-13 Q0,-19 9,-13" stroke="#fff7d6" strokeWidth="1" fill="none" opacity=".7" />
        <circle cy="9" r="4" fill="#fff7d6" opacity=".85" />
      </g>
    </g>
  )
}

/* ── กระทงใบตอง (อ้างอิงกระทงจริง: กลีบใบตองพับแหลม · บานไม่รู้โรยม่วง · ดาวเรือง ·
   ดอกรักขาว · กรวยใบตอง · เทียนส้ม · ธูป 3 ดอก) วาดมุม 3/4 ฐานกว้าง ~150 หน่วย ──── */

const TAU = Math.PI * 2
// จุดบนวงรี (มุมมองเอียง) — แยกครึ่งหลัง/หน้าเพื่อวาดซ้อนให้ถูกลำดับ
function ring(n, rx, ry, cy = 0, phase = 0) {
  return Array.from({ length: n }, (_, i) => {
    const t = phase + (i / n) * TAU
    return { i, t, x: rx * Math.cos(t), y: cy + ry * Math.sin(t), front: Math.sin(t) >= 0 }
  })
}
const back = (pts) => pts.filter((p) => !p.front).sort((a, b) => a.y - b.y)
const front = (pts) => pts.filter((p) => p.front).sort((a, b) => a.y - b.y)

const LEAVES_OUT = ring(16, 46, 12, 0)
const LEAVES_IN = ring(16, 37, 9.5, -5, Math.PI / 16)
const AMARANTH = ring(16, 49, 12.5, 3, Math.PI / 16)
const MARIGOLD = ring(11, 30, 8, -24, 0.2)

function Leaf({ p, size = 30, detail = true }) {
  // กลีบใบตองพับแหลม "ตั้งขึ้น" เอียงออกนิด ๆ (ทรงมงกุฎแบบกระทงจริง) + ดอกเล็กขาวเรียงขอบ
  const dx = Math.cos(p.t) * 0.7
  const dy = -0.8 + Math.sin(p.t) * 0.22
  const a = (Math.atan2(dy, dx) * 180) / Math.PI + 90
  const len = size * (0.8 + 0.2 * Math.abs(Math.cos(p.t)))
  const w = 7.5
  return (
    <g transform={`translate(${p.x.toFixed(1)} ${p.y.toFixed(1)}) rotate(${a.toFixed(1)})`}>
      <path d={`M${-w},2 Q${-w - 1},${-len * 0.5} 0,${-len} Q${w + 1},${-len * 0.5} ${w},2 Q0,5 ${-w},2Z`} fill="url(#wa-leaf)" />
      <path d={`M0,${-len} Q${w * 0.55},${-len * 0.5} ${w * 0.6},2 L0,3Z`} fill="#14532d" opacity=".28" />
      <path d={`M0,1 L0,${-len * 0.9}`} stroke="#bbf7d0" strokeWidth=".9" opacity=".6" />
      {detail && (
        <g fill="#fffbeb">
          <circle cy={-len - 1} r="1.9" />
          <circle cx={-w * 0.75} cy={-len * 0.42} r="1.3" />
          <circle cx={w * 0.75} cy={-len * 0.42} r="1.3" />
        </g>
      )}
    </g>
  )
}

function Amaranth({ p }) {
  return (
    <g transform={`translate(${p.x.toFixed(1)} ${p.y.toFixed(1)})`}>
      <ellipse rx="4.6" ry="5.6" fill="url(#wa-ama)" />
      <ellipse cx="-1.4" cy="-2" rx="1.4" ry="1.8" fill="#f5d0fe" opacity=".75" />
    </g>
  )
}

function Marigold({ p }) {
  return (
    <g transform={`translate(${p.x.toFixed(1)} ${p.y.toFixed(1)})`}>
      <circle r="9.6" fill="url(#wa-mari)" />
      <circle r="7" fill="none" stroke="#c2410c" strokeWidth="1.1" strokeDasharray="1.2 1.8" opacity=".55" />
      <circle r="4.2" fill="none" stroke="#c2410c" strokeWidth="1" strokeDasharray="1.1 1.6" opacity=".45" />
      <circle cx="-2.6" cy="-3.6" r="2.4" fill="#fef08a" opacity=".7" />
    </g>
  )
}

function CrownFlower({ x, y, s = 1 }) {
  return (
    <g transform={`translate(${x} ${y}) scale(${s})`}>
      {[0, 72, 144, 216, 288].map((a) => (
        <ellipse key={a} cy="-2.6" rx="1.9" ry="3" fill="#fff" transform={`rotate(${a})`} />
      ))}
      <circle r="1.5" fill="#e9d5ff" />
    </g>
  )
}

const CROWN = [[-14, -21, 0.95], [14, -21, 0.95], [-7, -25, 1], [7, -25, 1], [0, -27, 0.9], [-19, -16, 0.85], [19, -16, 0.85], [-9, -17, 1], [9, -17, 1], [0, -19, 1.05]]

function KrathongDefs() {
  return (
    <defs>
      <linearGradient id="wa-leaf" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stopColor="#4ade80" />
        <stop offset=".55" stopColor="#16a34a" />
        <stop offset="1" stopColor="#14532d" />
      </linearGradient>
      <radialGradient id="wa-mari" cx=".4" cy=".35" r=".7">
        <stop offset="0" stopColor="#fde047" />
        <stop offset=".55" stopColor="#f59e0b" />
        <stop offset="1" stopColor="#ea580c" />
      </radialGradient>
      <radialGradient id="wa-ama" cx=".4" cy=".35" r=".75">
        <stop offset="0" stopColor="#e879f9" />
        <stop offset=".6" stopColor="#a21caf" />
        <stop offset="1" stopColor="#701a75" />
      </radialGradient>
      <linearGradient id="wa-candle" x1="0" y1="0" x2="1" y2="0">
        <stop offset="0" stopColor="#c2410c" />
        <stop offset=".35" stopColor="#fdba74" />
        <stop offset="1" stopColor="#ea580c" />
      </linearGradient>
      <radialGradient id="wa-halo">
        <stop offset="0" stopColor="#fef3c7" stopOpacity=".9" />
        <stop offset=".4" stopColor="#fde68a" stopOpacity=".35" />
        <stop offset="1" stopColor="#fde68a" stopOpacity="0" />
      </radialGradient>
      <linearGradient id="wa-trunk" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stopColor="#bef264" />
        <stop offset="1" stopColor="#4d7c0f" />
      </linearGradient>
    </defs>
  )
}

function Krathong({ x, y, s = 1, d = 0, detail = true }) {
  const incense = [
    [7, -24, 30, -98],
    [9, -24, 37, -94],
    [11, -24, 44, -90],
  ]
  return (
    <g transform={`translate(${x} ${y}) scale(${s})`}>
      {/* เงาสะท้อนแสงเทียนบนน้ำ (อยู่กับที่ ไม่โยกตามกระทง) */}
      <g opacity=".45">
        {[[8, 15, 0], [14, 10, -0.6], [20, 6, -1.2]].map(([yy, w, dd]) => (
          <g key={yy} transform={`translate(-3 ${yy})`}>
            <rect x={-w / 2} y="-1" width={w} height="2" rx="1" fill="#fde68a" className="wa-shimmer" style={delay(dd)} />
          </g>
        ))}
      </g>
      <g className="wa-bob" style={delay(d)}>
        <ellipse cy="9" rx="58" ry="7" fill="#1e1b4b" opacity=".22" />
        {/* ฐานหยวกกล้วย (มีความหนา) */}
        <ellipse cy="6" rx="46" ry="12" fill="url(#wa-trunk)" />
        <ellipse cy="2" rx="46" ry="12" fill="#d9f99d" />
        {/* ครึ่งหลัง (ไกลก่อน): บานไม่รู้โรย → กลีบนอก → กลีบใน → ดาวเรือง */}
        {back(AMARANTH).map((p) => <Amaranth key={`a${p.i}`} p={p} />)}
        {back(LEAVES_OUT).map((p) => <Leaf key={`o${p.i}`} p={p} detail={detail} />)}
        {back(LEAVES_IN).map((p) => <Leaf key={`n${p.i}`} p={p} size={24} detail={detail} />)}
        {back(MARIGOLD).map((p) => <Marigold key={`m${p.i}`} p={p} />)}
        {/* ยอดกองดาวเรือง + กรวยใบตอง + ดอกรัก */}
        {[[-11, -31], [11, -31], [0, -28]].map(([mx, my]) => (
          <Marigold key={`c${mx}`} p={{ x: mx, y: my }} />
        ))}
        <path d="M-10,-30 Q-7,-50 0,-61 Q7,-50 10,-30 Q0,-26 -10,-30Z" fill="url(#wa-leaf)" />
        <path d="M0,-32 L0,-58" stroke="#bbf7d0" strokeWidth=".9" opacity=".5" />
        {/* เทียน */}
        <rect x="-8" y="-104" width="8" height="80" rx="2.5" fill="url(#wa-candle)" />
        <ellipse cx="-4" cy="-104" rx="4" ry="1.4" fill="#fed7aa" />
        <path d="M-4,-104 L-4,-108" stroke="#3f3f46" strokeWidth="1" strokeLinecap="round" />
        <circle cx="-4" cy="-114" r="18" fill="url(#wa-halo)" />
        <g transform="translate(-4 -113)">
          <path d="M0,-9 C4,-3 4.2,2.5 0,5 C-4.2,2.5 -4,-3 0,-9Z" fill="#fbbf24" className="wa-flicker" style={delay(d)} />
        </g>
        <g transform="translate(-4 -112)">
          <path d="M0,-4.5 C2,-1.5 2.2,1.5 0,3 C-2.2,1.5 -2,-1.5 0,-4.5Z" fill="#fffbeb" className="wa-flicker" style={delay(d - 0.3)} />
        </g>
        {/* ธูป 3 ดอก + ควัน */}
        {incense.map(([x1, y1, x2, y2], i) => (
          <g key={i}>
            <line x1={x1} y1={y1} x2={x2} y2={y2} stroke="#a16207" strokeWidth="1.5" strokeLinecap="round" />
            <line x1={x1 + (x2 - x1) * 0.62} y1={y1 + (y2 - y1) * 0.62} x2={x2} y2={y2} stroke="#7f1d1d" strokeWidth="2" strokeLinecap="round" />
            <circle cx={x2} cy={y2} r="1.7" fill="#fb923c" className="wa-twinkle" style={delay(-i * 0.7)} />
            {detail && (
              <g transform={`translate(${x2} ${y2 - 2})`}>
                <path
                  d="M0,0 C-4,-7 4,-13 0,-21 C-4,-29 3,-35 0,-43"
                  stroke="#fff"
                  strokeWidth="1.3"
                  strokeLinecap="round"
                  fill="none"
                  opacity=".3"
                  className="wa-smoke"
                  style={delay(-i * 1.4)}
                />
              </g>
            )}
          </g>
        ))}
        {/* ครึ่งหน้า (ใกล้ทีหลัง): ดาวเรือง → กลีบใน → กลีบนอก → บานไม่รู้โรยที่ขอบฐาน */}
        {front(MARIGOLD).map((p) => <Marigold key={`M${p.i}`} p={p} />)}
        <g transform="translate(0 -11)">
          {CROWN.map(([cx, cy, cs], i) => <CrownFlower key={i} x={cx} y={cy} s={cs} />)}
        </g>
        {front(LEAVES_IN).map((p) => <Leaf key={`N${p.i}`} p={p} size={19} detail={detail} />)}
        {front(LEAVES_OUT).map((p) => <Leaf key={`O${p.i}`} p={p} detail={detail} />)}
        {front(AMARANTH).map((p) => <Amaranth key={`A${p.i}`} p={p} />)}
      </g>
    </g>
  )
}

/* ── ฉากแต่ละฤดู (viewBox 1200×200; โซนวันที่ขวาสุด x>870 เบาไว้) ──────────── */

function Loykrathong() {
  return (
    <>
      <defs>
        <radialGradient id="wa-moon">
          <stop offset="0" stopColor="#fff7d6" stopOpacity=".9" />
          <stop offset="1" stopColor="#fff7d6" stopOpacity="0" />
        </radialGradient>
        <linearGradient id="wa-lan" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#fde68a" />
          <stop offset="1" stopColor="#f59e0b" />
        </linearGradient>
      </defs>
      <KrathongDefs />
      {/* พระจันทร์เต็มดวงคืนเพ็ญเดือนสิบสอง */}
      <circle cx="420" cy="50" r="64" fill="url(#wa-moon)" opacity=".35" />
      <circle cx="420" cy="50" r="24" fill="#fff4cc" opacity=".94" />
      <circle cx="412" cy="44" r="4" fill="#f5e6b3" opacity=".6" />
      <circle cx="428" cy="58" r="3" fill="#f5e6b3" opacity=".5" />
      {[[150, 40, 0], [250, 72, 1.1], [330, 24, 2.2], [520, 30, 0.6], [690, 60, 1.7], [790, 28, 2.8], [200, 110, 1.4]].map(
        ([x, y, d], i) => <Star key={i} x={x} y={y} d={d} />,
      )}
      {[[170, 130, 0.8, -2], [300, 100, 0.65, -6], [500, 128, 0.75, -9], [720, 84, 0.6, -4], [800, 136, 0.55, -12]].map(
        ([x, y, s, d], i) => <Lantern key={i} x={x} y={y} s={s} d={d} />,
      )}
      <Waves y={168} />
      {/* กระทงเล็กลอยห่าง ๆ + กระทงหลักเต็มรายละเอียด */}
      <Krathong x={230} y={190} s={0.3} d={-2} detail={false} />
      <Krathong x={790} y={191} s={0.3} d={-3.5} detail={false} />
      <Krathong x={400} y={192} s={0.36} d={-1.2} detail={false} />
      <Krathong x={600} y={184} s={0.88} d={0} />
    </>
  )
}

/* ── งานช้างสุรินทร์ (กลาง–ปลาย พ.ย.): ขบวนช้างแต่งผ้าคลุมแดง-ทอง ใต้ธงราว ──────── */

const FLAG_COLORS = ["#ef4444", "#facc15", "#22c55e", "#f8fafc", "#3b82f6", "#f97316"]

function Bunting({ x0, y0, cx, cy, x1, y1, n = 22 }) {
  // ธงสามเหลี่ยมห้อยตามเส้นเชือกโค้ง (quadratic bezier)
  const pts = Array.from({ length: n }, (_, i) => {
    const t = (i + 0.5) / n
    const u = 1 - t
    return { i, x: u * u * x0 + 2 * u * t * cx + t * t * x1, y: u * u * y0 + 2 * u * t * cy + t * t * y1 }
  })
  return (
    <g>
      <path d={`M${x0} ${y0} Q${cx} ${cy} ${x1} ${y1}`} stroke="#e0e7ff" strokeWidth="1" fill="none" opacity=".5" />
      {pts.map((p) => (
        <g key={p.i} transform={`translate(${p.x.toFixed(1)} ${p.y.toFixed(1)})`}>
          <path
            d="M-6,0 L6,0 L0,13Z"
            fill={FLAG_COLORS[p.i % FLAG_COLORS.length]}
            opacity=".85"
            className="wa-flag"
            style={delay(-(p.i % 5) * 0.5)}
          />
        </g>
      ))}
    </g>
  )
}

function Elephant({ x, y, s = 1, d = 0, lead = false }) {
  // ช้างหันซ้าย เท้าอยู่ที่ y=0 กว้าง ~130 สูง ~88
  return (
    <g transform={`translate(${x} ${y}) scale(${s})`}>
      <ellipse cy="1" rx="58" ry="4" fill="#1e1b4b" opacity=".25" />
      <g className="wa-walk" style={delay(d)}>
        {/* ขาฝั่งไกล */}
        <path d="M-27,-34 L-26,0 L-15,0 L-14,-30Z" fill="#8f88bf" />
        <path d="M24,-34 L25,0 L36,0 L41,-38Z" fill="#8f88bf" />
        {/* หาง */}
        <path d="M58,-56 Q67,-44 63,-28" stroke="#a49dd0" strokeWidth="2.2" fill="none" strokeLinecap="round" />
        <ellipse cx="63" cy="-26" rx="2" ry="3" fill="#6e67a3" />
        {/* ลำตัว + หัว + งวง */}
        <path
          d="M44,-72 C24,-86 -14,-86 -30,-74 C-44,-82 -62,-76 -66,-60 C-70,-46 -68,-30 -72,-16 C-74,-8 -72,-2 -66,-2 C-61,-2 -61,-7 -63,-11 C-61,-24 -57,-36 -53,-44 C-50,-40 -45,-38 -41,-38 L-40,-30 C-20,-24 18,-24 34,-30 C50,-32 62,-44 60,-58 C58,-68 52,-72 44,-72Z"
          fill="url(#wa-ele)"
        />
        {/* ขาฝั่งใกล้ + กำไลทอง + เล็บ */}
        <path d="M-40,-36 L-38,0 L-26,0 L-24,-30Z" fill="url(#wa-ele)" />
        <path d="M33,-34 L35,0 L47,0 L52,-40Z" fill="url(#wa-ele)" />
        <rect x="-39" y="-10" width="14" height="3" rx="1" fill="#fbbf24" />
        <rect x="34.4" y="-10" width="13" height="3" rx="1" fill="#fbbf24" />
        {[-36, -31.5, -27, 37, 41.5, 46].map((nx) => (
          <path key={nx} d={`M${nx - 1.6},0 a1.6,1.6 0 0 1 3.2,0Z`} fill="#f5f3ff" />
        ))}
        {/* หู */}
        <path d="M-36,-72 C-22,-77 -15,-58 -20,-46 C-24,-38 -34,-40 -40,-48 C-42,-58 -40,-68 -36,-72Z" fill="#b3acdc" />
        <path d="M-36,-72 C-22,-77 -15,-58 -20,-46" stroke="#ede9fe" strokeWidth="1" fill="none" opacity=".6" />
        {/* งา + ตา */}
        <path d="M-46,-40 Q-52,-33 -61,-34" stroke="#fffbeb" strokeWidth="2.6" strokeLinecap="round" fill="none" />
        <circle cx="-54" cy="-62" r="1.7" fill="#312e81" />
        {/* ผ้าคลุมหลังแดง ขอบทอง ระบาย */}
        <path d="M-16,-81 C4,-88 30,-86 46,-73 L44,-48 L-14,-48Z" fill="#dc2626" />
        <path d="M-14,-53 L44,-53 L44,-48 L-14,-48Z" fill="#fbbf24" />
        <path d="M-16,-81 C4,-88 30,-86 46,-73" stroke="#fbbf24" strokeWidth="2" fill="none" />
        {Array.from({ length: 10 }, (_, i) => (
          <path key={i} d={`M${-14 + i * 5.8},-48 l2.9,4.5 l2.9,-4.5Z`} fill="#fbbf24" />
        ))}
        <path d="M15,-74 L22,-66 L15,-58 L8,-66Z" fill="#fbbf24" />
        <circle cx="15" cy="-66" r="2.2" fill="#dc2626" />
        {/* ผ้าหน้าผาก + พู่ */}
        <path d="M-60,-74 C-52,-83 -40,-81 -34,-75 L-46,-55Z" fill="#dc2626" />
        <path d="M-60,-74 C-52,-83 -40,-81 -34,-75" stroke="#fbbf24" strokeWidth="1.6" fill="none" />
        <circle cx="-46" cy="-54" r="2.4" fill="#fbbf24" />
        {/* ควาญบนคอ (เฉพาะตัวนำขบวน) */}
        {lead && (
          <g>
            <path d="M-32,-79 C-32,-90 -21,-90 -21,-79Z" fill="#f97316" />
            <circle cx="-26.5" cy="-93" r="4.2" fill="#fcd9b6" />
            <path d="M-31.5,-95 Q-26.5,-101 -21.5,-95Z" fill="#1e1b4b" />
          </g>
        )}
      </g>
    </g>
  )
}

function ElephantFestival() {
  return (
    <>
      <defs>
        <linearGradient id="wa-ele" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#ece9fb" />
          <stop offset="1" stopColor="#a8a1d4" />
        </linearGradient>
        <radialGradient id="wa-sunwarm">
          <stop offset="0" stopColor="#fde68a" stopOpacity=".55" />
          <stop offset="1" stopColor="#fde68a" stopOpacity="0" />
        </radialGradient>
      </defs>
      <circle cx="560" cy="120" r="200" fill="url(#wa-sunwarm)" opacity=".5" />
      <Bunting x0={60} y0={8} cx={460} cy={58} x1={880} y1={6} n={19} />
      {/* ลานดินงานแสดงช้าง */}
      <path d="M-1200 200 V186 L0 186 Q300 178 600 184 T1300 182 V200Z" fill="#fff" opacity=".1" />
      <Sparkle x={200} y={70} s={0.6} d={0} />
      <Sparkle x={890} y={88} s={0.55} d={-1.2} fill="#fff" />
      <Sparkle x={330} y={120} s={0.5} d={-2} fill="#fff" />
      <Elephant x={770} y={188} s={0.62} d={-0.9} />
      <Elephant x={565} y={188} s={0.82} d={-0.45} />
      <Elephant x={350} y={188} s={0.9} d={0} lead />
      <Elephant x={170} y={190} s={0.5} d={-0.2} />
    </>
  )
}

function Rain() {
  const streaks = Array.from({ length: 18 }).map((_, i) => ({
    x: sx(500) + i * 48 + (i % 3) * 9,
    y: 62 + ((i * 37) % 70),
    d: -((i * 0.37) % 1.6),
  }))
  const stalks = Array.from({ length: 20 }).map((_, i) => ({ x: sx(480) + i * 42 + (i % 2) * 6, h: 24 + ((i * 7) % 12) }))
  return (
    <>
      <g fill="#fff" opacity=".17" className="wa-float">
        <ellipse cx={sx(640)} cy="42" rx="56" ry="17" />
        <ellipse cx={sx(640) - 30} cy="33" rx="30" ry="16" />
        <ellipse cx={sx(640) + 34} cy="31" rx="33" ry="18" />
      </g>
      <g fill="#fff" opacity=".13" className="wa-float" style={delay(-3)}>
        <ellipse cx={sx(820)} cy="30" rx="60" ry="18" />
        <ellipse cx={sx(820) - 30} cy="21" rx="30" ry="15" />
        <ellipse cx={sx(820) + 32} cy="19" rx="33" ry="17" />
      </g>
      {streaks.map((s, i) => (
        <line
          key={i}
          x1={s.x}
          y1={s.y}
          x2={s.x - 5}
          y2={s.y + 16}
          stroke="#e0e7ff"
          strokeWidth="1.3"
          strokeLinecap="round"
          opacity=".55"
          className="wa-fall"
          style={delay(s.d)}
        />
      ))}
      {stalks.map((s, i) => (
        <g key={i} transform={`translate(${s.x} 200)`}>
          <path
            d={`M0 0 Q2 -${s.h * 0.6} 7 -${s.h}`}
            stroke="#d9f99d"
            strokeWidth="1.6"
            strokeLinecap="round"
            fill="none"
            opacity=".42"
            className="wa-sway"
            style={delay(-(i % 5) * 0.6)}
          />
        </g>
      ))}
      {[[600, 186, 0], [730, 191, -1.2], [850, 187, -2.4]].map(([x, y, d], i) => (
        <g key={i} transform={`translate(${sx(x)} ${y})`}>
          <ellipse rx="34" ry="6" fill="none" stroke="#fff" strokeWidth="1.2" opacity=".35" className="wa-ripple" style={delay(d)} />
        </g>
      ))}
    </>
  )
}

function Hot() {
  return (
    <>
      <defs>
        <radialGradient id="wa-sun">
          <stop offset="0" stopColor="#fde68a" stopOpacity=".85" />
          <stop offset="1" stopColor="#fde68a" stopOpacity="0" />
        </radialGradient>
      </defs>
      <circle cx={sx(790)} cy="62" r="74" fill="url(#wa-sun)" opacity=".5" />
      <g transform={`translate(${sx(790)} 62)`}>
        <g className="wa-spin">
          {Array.from({ length: 14 }).map((_, i) => (
            <line
              key={i}
              y1="-34"
              y2={i % 2 ? -42 : -50}
              stroke="#fde68a"
              strokeWidth="3"
              strokeLinecap="round"
              opacity=".8"
              transform={`rotate(${(360 / 14) * i})`}
            />
          ))}
        </g>
        <circle r="24" fill="#fde68a" opacity=".95" />
      </g>
      {[112, 138, 164].map((y, i) => (
        <g key={y} transform={`translate(${sx(500) + i * 70} ${y})`}>
          <path
            d="M0 0 Q20 -8 40 0 T80 0 T120 0 T160 0 T200 0 T240 0 T280 0 T320 0 T360 0"
            stroke="#fff"
            strokeWidth="1.6"
            fill="none"
            strokeLinecap="round"
            opacity=".2"
            className="wa-mist"
            style={delay(-i * 3)}
          />
        </g>
      ))}
      <g fill="#fff" opacity=".14" className="wa-float" style={delay(-2)}>
        <ellipse cx={sx(560)} cy="48" rx="44" ry="13" />
        <ellipse cx={sx(540)} cy="41" rx="24" ry="12" />
      </g>
    </>
  )
}

function Songkran() {
  const drops = [[560, 56, 1, 0], [640, 112, 0.8, -1.5], [740, 48, 1.1, -3], [830, 98, 0.9, -4.5], [905, 42, 0.7, -2.2], [690, 150, 0.7, -5]]
  const flowers = [[598, 150, 1, 0], [820, 138, 1.1, -2], [865, 84, 0.8, -4]]
  return (
    <>
      {drops.map(([x, y, s, d], i) => (
        <g key={i} transform={`translate(${sx(x)} ${y}) scale(${s * 1.15})`}>
          <path d="M0,-9 C6,-1 7,4 0,8 C-7,4 -6,-1 0,-9Z" fill="#bae6fd" opacity=".85" className="wa-float" style={delay(d)} />
        </g>
      ))}
      {flowers.map(([x, y, s, d], i) => (
        <g key={i} transform={`translate(${sx(x)} ${y}) scale(${s * 1.15})`}>
          <g className="wa-float" style={delay(d)}>
            {[0, 72, 144, 216, 288].map((a) => (
              <ellipse key={a} cy="-7" rx="3.6" ry="7.5" fill="#fff" opacity=".92" transform={`rotate(${a})`} />
            ))}
            <circle r="2.6" fill="#fde68a" />
          </g>
        </g>
      ))}
      {[[760, 176, 0], [760, 176, -1.2], [760, 176, -2.4]].map(([x, y, d], i) => (
        <g key={i} transform={`translate(${sx(x)} ${y})`}>
          <ellipse rx="90" ry="12" fill="none" stroke="#fff" strokeWidth="1.3" opacity=".4" className="wa-ripple" style={delay(d)} />
        </g>
      ))}
      <Waves y={170} tone="#e0f2fe" />
    </>
  )
}

function Cool() {
  return (
    <>
      <g transform={`translate(${sx(850)} 52)`}>
        <path d="M0,-20 A20,20 0 1,0 0,20 A15,15 0 1,1 0,-20Z" fill="#e0e7ff" opacity=".92" />
      </g>
      {[[560, 38, 0], [620, 76, 1.2], [690, 30, 2.1], [745, 64, 0.5], [930, 40, 1.6], [520, 88, 2.7]].map(([x, y, d], i) => (
        <Star key={i} x={sx(x)} y={y} d={d} />
      ))}
      <path
        d="M-1200 200 V190 L0 190 L120 140 L200 170 L330 95 L470 165 L590 120 L760 178 L930 145 L1100 172 L1200 150 V200Z"
        fill="#fff"
        opacity=".08"
      />
      <path
        d="M-1200 200 V196 L80 196 L220 160 L330 190 L470 140 L620 188 L760 152 L900 192 L1050 165 L1200 170 V200Z"
        fill="#fff"
        opacity=".12"
      />
      <ellipse cx={sx(640)} cy="162" rx="170" ry="10" fill="#fff" opacity=".14" className="wa-mist" />
      <ellipse cx={sx(830)} cy="178" rx="200" ry="9" fill="#fff" opacity=".12" className="wa-mist" style={delay(-6)} />
    </>
  )
}

function NewYear() {
  const bursts = [[620, 74, 1, 0], [770, 112, 0.8, -1.8], [880, 56, 0.9, -3.2]]
  return (
    <>
      {bursts.map(([x, y, s, d], i) => (
        <g key={i} transform={`translate(${sx(x)} ${y}) scale(${s * 1.15})`}>
          <g className="wa-burst" style={delay(d)}>
            {Array.from({ length: 14 }).map((_, k) => (
              <g key={k} transform={`rotate(${(360 / 14) * k})`}>
                <line y1="-9" y2={k % 2 ? -26 : -34} stroke="#fde68a" strokeWidth="2" strokeLinecap="round" />
                <circle cy={k % 2 ? -32 : -42} r="1.8" fill="#fff" />
              </g>
            ))}
          </g>
        </g>
      ))}
      <Sparkle x={sx(545)} y={150} s={1} d={0} />
      <Sparkle x={sx(695)} y={36} s={0.7} d={-1} fill="#fff" />
      <Sparkle x={sx(830)} y={160} s={1.1} d={-2} />
      <Sparkle x={sx(955)} y={128} s={0.8} d={-0.5} fill="#fff" />
      <Sparkle x={sx(585)} y={60} s={0.7} d={-1.6} fill="#fff" />
    </>
  )
}

const SCENES = {
  newyear: NewYear,
  cool: Cool,
  songkran: Songkran,
  hot: Hot,
  rain: Rain,
  loykrathong: Loykrathong,
  elephant: ElephantFestival,
}

// มือถือ: จุดเริ่ม crop (หน่วย viewBox) ต่อฉาก — ให้ของเด่นอยู่ราว 70% ทางขวาของการ์ด
const PHONE_X = { loykrathong: 300, elephant: 270 }

const FADE_DESKTOP = "linear-gradient(to right, transparent 0%, #000 34%)"
// มือถือ: ข้อความอยู่ซ้ายของการ์ด → ปล่อยลายไว้ครึ่งขวา
const FADE_PHONE = "linear-gradient(to right, transparent 30%, #000 70%)"

export default function WelcomeArt({ season }) {
  const phone = useIsPhone()
  const Scene = SCENES[season] ?? Rain
  const fade = phone ? FADE_PHONE : FADE_DESKTOP
  return (
    <div
      aria-hidden="true"
      className="welcome-art pointer-events-none absolute inset-y-0 right-0 w-full"
      style={{ WebkitMaskImage: fade, maskImage: fade }}
    >
      <svg
        className="h-full w-full"
        // desktop: ฉากกว้างชิดขวา · มือถือ: ตัดเฉพาะส่วนกลางของฉาก
        viewBox={phone ? `${PHONE_X[season] ?? 380} 0 440 200` : "0 0 1200 200"}
        preserveAspectRatio={phone ? "xMidYMid slice" : "xMaxYMid meet"}
        focusable="false"
      >
        <Rings />
        <Scene />
      </svg>
    </div>
  )
}
