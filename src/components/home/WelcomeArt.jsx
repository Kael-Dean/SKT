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

/* ── งานช้างสุรินทร์ (กลาง–ปลาย พ.ย.): ขบวนช้างเอเชียแต่งเครื่องทรงแดง-ทอง ─────────
   ฉากหลัง = ปราสาทศีขรภูมิ + ต้นตาลอีสาน (เงาจาง) · แสงเย็นอุ่นจากขวาบน
   ช้างหันซ้าย เท้าที่ y=0 กว้าง ~150 (x −88…66) สูงหัว ~97 — ทรงช้างเอเชีย: หัวโหนกคู่ หูเล็ก
   หลังโค้ง ผิวมีรอยย่นงวง/เข่า + จุดด่างชมพูที่หู/โคนงวง; แสงเงาใช้ gradient userSpaceOnUse
   ร่วมกันทุกชิ้น (ตัว/ขา/งวง) ให้รอยต่อไม่เห็น */

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

/* ปรางค์ทรงขอม (ศีขรภูมิ): เรือนธาตุ + ชั้นซ้อนลดหลั่น มีกลีบขนุนที่มุม + ยอดดอกบัวตูม */
function Prang({ x, y, w, h }) {
  const bodyH = h * 0.4
  const th = h * 0.1
  const tiers = Array.from({ length: 5 }, (_, i) => ({ i, tw: w * (0.96 - 0.15 * i), y0: y - bodyH - i * th }))
  const top = y - bodyH - 5 * th
  return (
    <g transform={`translate(${x} 0)`}>
      <rect x={-w / 2} y={y - bodyH} width={w} height={bodyH} />
      <rect x={-w / 2 - 3} y={y - bodyH - 2} width={w + 6} height="3" />
      {tiers.map(({ i, tw, y0 }) => (
        <g key={i}>
          <path d={`M${-tw / 2},${y0} L${-tw * 0.44},${y0 - th} L${tw * 0.44},${y0 - th} L${tw / 2},${y0}Z`} />
          <path d={`M${-tw / 2 - 1},${y0} l2.5,${-th * 1.15} l2.5,${th * 1.15}Z M${tw / 2 + 1},${y0} l-2.5,${-th * 1.15} l-2.5,${th * 1.15}Z`} />
        </g>
      ))}
      <ellipse cy={top - 3} rx={w * 0.12} ry="4.5" />
      <path d={`M-1.2,${top - 6} L0,${top - 15} L1.2,${top - 6}Z`} />
    </g>
  )
}

/* ต้นตาลโตนด: ลำต้นสูงเรียว + ทรงพุ่มใบพัดกลม + ใบแห้งห้อย */
function Palm({ x, h, lean = 0 }) {
  const tx = x + lean
  const ty = 186 - h
  const leaves = Array.from({ length: 13 }, (_, k) => {
    const a = Math.PI + (k / 12) * Math.PI * 1.25 - 0.12
    const r = 15 + (k % 3) * 2
    const p = (t, m = 1) => `${(r * m * Math.cos(t)).toFixed(1)},${(r * m * Math.sin(t)).toFixed(1)}`
    return `M0,0 L${p(a - 0.17)} Q${p(a, 1.18)} ${p(a + 0.17)}Z`
  })
  return (
    <g>
      <path d={`M${x} 186 Q${x + lean * 0.3} ${186 - h / 2} ${tx} ${ty}`} stroke="#fff" strokeWidth="2.4" fill="none" />
      <g transform={`translate(${tx} ${ty})`}>
        {leaves.map((d, k) => (
          <path key={k} d={d} />
        ))}
        <path d="M-3,2 L-8,16 L-1,4Z M3,2 L7,15 L1,4Z" />
        <circle r="3.5" />
      </g>
    </g>
  )
}

// รอยย่นตามงวง: [y, cx, ครึ่งความกว้าง]
const TRUNK_RINGS = [[-50, -69, 6.2], [-44, -70.5, 5.8], [-38, -72, 5.3], [-32, -73.2, 4.8], [-26, -74.3, 4.3], [-20, -75.2, 3.9], [-14, -75.8, 3.4]]
// ชายครุยทองใต้ผ้าคลุม (ไล่ตามขอบล่างที่โค้ง)
const FRINGE = Array.from({ length: 12 }, (_, i) => {
  const x = -20 + i * 5.7
  return { x, y: -50 + 4 * Math.sin((Math.PI * (x + 22)) / 67) }
})

function Mahout() {
  // ควาญนั่งคอช้าง: เสื้อขาวนวล · ผ้าขาวม้าคาดเอว · ผ้าโพกหัวแดง · ถือขอ
  return (
    <g transform="translate(-27 -91)">
      <path d="M-1,-1 C-6,1 -10,5 -9,12 L-6,13 C-6,8 -3,4 1,2Z" fill="#3b2f5a" />
      <path d="M-9,12 L-5,12 L-4,14 L-10,14Z" fill="#2a2140" />
      <path d="M-4,-1 C-5,-8 -4,-13 0,-15 C4,-14 5,-8 4,-1Z" fill="#f5efe3" />
      <path d="M-4,-4 L4,-6 L4.3,-3.5 L-4.2,-1.6Z" fill="#dc2626" />
      <path d="M-2,-4.6 L-1,-2 M1.2,-5.2 L2.2,-2.7" stroke="#fff" strokeWidth=".7" />
      <path d="M-1,-12 C-5,-10 -8,-7 -9,-5" stroke="#f5efe3" strokeWidth="2.4" strokeLinecap="round" fill="none" />
      <path d="M-11,-12 L-8,3 M-11,-12 q-2.4,0 -2.4,2.2" stroke="#a16207" strokeWidth="1.1" strokeLinecap="round" fill="none" />
      <circle cx="-9.2" cy="-5" r="1.4" fill="#c58f67" />
      <circle cx=".3" cy="-19" r="3.8" fill="#c58f67" />
      <path d="M-3.6,-19.5 C-3.6,-24.5 4.2,-24.5 4.2,-19.5 Q.3,-21 -3.6,-19.5Z" fill="#dc2626" />
      <path d="M4,-21 l3.2,1.6 l-2.6,1.2Z" fill="#dc2626" />
    </g>
  )
}

const UMBRELLA_TIERS = [[-131, 30], [-139.5, 21], [-146.5, 12]]

function Howdah() {
  // สัปคับไม้ปิดทองบนหลัง + ฉัตร 3 ชั้น
  return (
    <g>
      <path d="M-18,-92 C-4,-97 22,-96 36,-90 L35,-94 C20,-100 -4,-101 -18,-96Z" fill="#f59e0b" />
      <path d="M-14,-97 L32,-97 L33,-108 L-15,-108Z" fill="#7f1d1d" opacity=".75" />
      {[-13, -1.5, 10, 21.5, 31].map((px) => (
        <path key={px} d={`M${px},-96 L${px},-109`} stroke="#fbbf24" strokeWidth="1.5" />
      ))}
      <path d="M-16,-96.5 L34,-96.5 M-16,-109 L34,-109" stroke="#fbbf24" strokeWidth="2" strokeLinecap="round" />
      <path d="M-15,-102.5 L33,-102.5" stroke="#fde68a" strokeWidth=".7" strokeDasharray="1.6 2" />
      <path d="M10,-109 L10,-151" stroke="#fbbf24" strokeWidth="1.4" />
      {UMBRELLA_TIERS.map(([ty, w]) => (
        <g key={ty} transform={`translate(10 ${ty})`}>
          <path d={`M${-w / 2},0 Q0,${-w * 0.3} ${w / 2},0Z`} fill="#fdf8ec" />
          <path d={`M${-w / 2},0 Q0,${-w * 0.3} ${w / 2},0`} stroke="#fbbf24" strokeWidth=".9" fill="none" />
          <path d={`M${-w / 2},0 ${"q1.5,2.6 3,0 ".repeat(w / 3)}`} stroke="#fbbf24" strokeWidth=".9" fill="none" />
        </g>
      ))}
      <circle cx="10" cy="-152" r="1.6" fill="#fde68a" />
    </g>
  )
}

const ELE_BODY =
  "M-50,-90 C-45,-97 -36,-96 -31,-89 C-12,-95 28,-93 50,-79 C63,-70 67,-55 63,-40 C60,-31 54,-27 46,-26 C25,-23 -12,-23 -32,-27 C-42,-29 -50,-34 -56,-42 C-62,-50 -70,-56 -72,-66 C-73,-78 -62,-89 -50,-90Z"
const WRINKLE = { stroke: "#4a4053", fill: "none", strokeLinecap: "round" }

function Elephant({ x, y, s = 1, d = 0, rider = null, calf = false }) {
  return (
    <g transform={`translate(${x} ${y}) scale(${s})`}>
      <ellipse cx="-4" cy="1" rx="66" ry="4.5" fill="#1e1b4b" opacity=".32" />
      {/* ฝุ่นลานดินใต้เท้า */}
      {[[50, -2], [-30, -1.3]].map(([px, dd]) => (
        <g key={px} transform={`translate(${px} -3)`}>
          <circle r="6" fill="#f3d9b1" opacity=".3" className="wa-smoke" style={delay(d + dd)} />
        </g>
      ))}
      <g className="wa-walk" style={delay(d)}>
        {/* ขาฝั่งไกล (เงาเข้มกว่า) */}
        <path d="M-34,-38 C-33,-24 -31,-12 -31,-4 Q-31,0 -28,0 L-19,0 Q-16,0 -17,-4 C-18,-14 -19,-26 -18,-34Z" fill="url(#wa-ele-far)" />
        <path d="M22,-36 C26,-26 27,-16 25,-4 Q25,0 28,0 L36,0 Q39,0 38,-4 C37,-14 37,-24 36,-32Z" fill="url(#wa-ele-far)" />
        {/* หาง */}
        <path d="M62,-60 Q68,-46 64,-30" stroke="#7d7186" strokeWidth="2" fill="none" strokeLinecap="round" />
        <path d="M62.5,-31 q1.5,5 3.5,6 q.5,-4 -1.4,-7Z" fill="#3f3647" />
        {/* ลำตัว + หัว: สีผิว → เงาใต้ท้อง → แสงอุ่นบนหลัง → เส้นแสงขอบ */}
        <path d={ELE_BODY} fill="url(#wa-ele-skin)" />
        <path d={ELE_BODY} fill="url(#wa-ele-ao)" />
        <path d={ELE_BODY} fill="url(#wa-ele-sheen)" />
        <path d="M-50,-90 C-45,-97 -36,-96 -31,-89 C-12,-95 28,-93 50,-79 C63,-70 67,-55 64,-44" stroke="#f5eef3" strokeWidth="1.2" fill="none" opacity=".45" />
        <g {...WRINKLE} strokeWidth=".8" opacity=".35">
          <path d="M-30,-58 C-27,-50 -27,-42 -30,-34" />
          <path d="M-25,-52 C-23,-46 -23,-40 -25,-35" />
          <path d="M33,-62 C40,-55 43,-44 41,-34" />
        </g>
        {/* ขาฝั่งใกล้ + รอยย่นเข่า + กำไลทอง + เล็บ */}
        <path d="M-52,-44 C-51,-28 -50,-14 -51,-4 Q-51,0 -47,0 L-36,0 Q-33,0 -33,-4 C-34,-14 -34,-28 -32,-40Z" fill="url(#wa-ele-skin)" />
        <path d="M34,-48 C40,-40 44,-30 40,-18 C39,-10 40,-5 40,-3 Q40,0 43,0 L54,0 Q57,0 56,-4 C55,-14 57,-24 60,-34 C62,-42 60,-50 56,-56Z" fill="url(#wa-ele-skin)" />
        <g {...WRINKLE} strokeWidth=".75" opacity=".4">
          <path d="M-50,-17 Q-42,-15 -34,-17 M-50,-13.5 Q-43,-12 -34,-13.5" />
          <path d="M41,-18 Q48,-16 56,-18 M41,-14.5 Q48,-13 56,-14.5" />
        </g>
        {!calf && (
          <g fill="#fbbf24">
            <rect x="-51" y="-8" width="18" height="2.6" rx="1.2" />
            <rect x="40" y="-8" width="16.4" height="2.6" rx="1.2" />
          </g>
        )}
        {[-47, -42, -37, 44, 48.5, 53].map((nx) => (
          <path key={nx} d={`M${nx - 1.8},0 a1.8,1.7 0 0 1 3.6,0Z`} fill="#ece4d6" />
        ))}
        {/* หูเล็กแบบช้างเอเชีย (โบกช้า ๆ) + จุดด่างชมพู */}
        <g className="wa-ear" style={delay(d * 2)}>
          <path d="M-40,-84 C-26,-88 -18,-76 -20,-62 C-21,-52 -28,-46 -34,-44 C-38,-50 -40,-60 -42,-68 C-43,-76 -42,-82 -40,-84Z" fill="url(#wa-ele-ear)" />
          <path d="M-40,-84 C-26,-88 -18,-76 -20,-62 C-21,-54 -25,-49 -29,-46" stroke="#f1e7ee" strokeWidth=".9" fill="none" opacity=".5" />
          <path d="M-36,-78 C-30,-72 -29,-62 -32,-52" {...WRINKLE} strokeWidth=".7" opacity=".35" />
          <g fill="#ebb8b3" opacity=".6">
            <circle cx="-23" cy="-64" r="1.1" />
            <circle cx="-24" cy="-58" r=".9" />
            <circle cx="-27" cy="-52" r="1" />
            <circle cx="-21.6" cy="-69" r=".8" />
          </g>
        </g>
        {/* งวง (แกว่งเบา ๆ) + รอยย่นเป็นวง + ปลายงวงม้วน */}
        <g className="wa-trunk" style={delay(d)}>
          <path
            d="M-73,-64 C-78,-48 -80,-30 -79,-16 C-79,-11 -81,-8 -85,-8.5 C-88,-8.6 -88.4,-4.4 -84.6,-3.2 C-78.6,-1.8 -73,-6 -72,-14 C-71,-28 -68,-44 -58,-52Z"
            fill="url(#wa-ele-skin)"
          />
          <path d="M-73,-64 C-78,-48 -80,-30 -79,-16" stroke="#f5eef3" strokeWidth=".8" fill="none" opacity=".35" />
          <g {...WRINKLE} strokeWidth=".7" opacity=".38">
            {TRUNK_RINGS.map(([ry, cx, hw]) => (
              <path key={ry} d={`M${cx - hw},${ry} Q${cx},${ry + 1.8} ${cx + hw},${ry}`} />
            ))}
          </g>
          <g fill="#ebb8b3" opacity=".6">
            <circle cx="-71.5" cy="-60" r="1.1" />
            <circle cx="-69" cy="-56" r=".9" />
            <circle cx="-72.4" cy="-54" r=".8" />
            <circle cx="-66.5" cy="-57.5" r=".8" />
          </g>
        </g>
        {/* งา (ตัวผู้) */}
        {!calf && (
          <>
            <path d="M-56,-47.5 C-60,-38 -67,-33 -79,-31.5 C-68,-35.5 -62,-41 -59.5,-49Z" fill="#f3ead6" />
            <path d="M-58,-42 C-63,-36 -69,-33.5 -77,-32.4" stroke="#b9a988" strokeWidth=".6" fill="none" opacity=".7" />
          </>
        )}
        {/* ตา + ปาก */}
        <path d="M-63,-73 Q-59,-76 -55,-72.6" {...WRINKLE} strokeWidth=".8" opacity=".5" />
        <ellipse cx="-59" cy="-70" rx="1.7" ry="1.25" fill="#211a2b" />
        <circle cx="-59.5" cy="-70.4" r=".45" fill="#fff" opacity=".8" />
        <path d="M-60,-46 Q-56,-43 -52,-44" {...WRINKLE} strokeWidth=".8" opacity=".45" />
        {!calf && (
          <>
            {/* เชือกคอ + กระดิ่งทอง (แกว่ง) */}
            <path d="M-29,-90 C-31,-72 -38,-52 -46,-39" stroke="#b45309" strokeWidth="2.2" fill="none" strokeLinecap="round" />
            <path d="M-29,-90 C-31,-72 -38,-52 -46,-39" stroke="#fbbf24" strokeWidth=".7" strokeDasharray="1.4 1.8" fill="none" />
            <g transform="translate(-46.5 -39)">
              <g className="wa-flag" style={delay(d)}>
                <path d="M-.6,0 L.6,0 L.6,2 L-.6,2Z M-2.6,2 Q0,.6 2.6,2 L4,8 L-4,8Z" fill="#f59e0b" />
                <path d="M-2.6,2 Q0,.6 2.6,2 L3,4 Q0,3 -3,4Z" fill="#fde68a" />
                <circle cy="9" r="1.1" fill="#92400e" />
              </g>
            </g>
            {/* ผ้าคลุมหลังกำมะหยี่แดง: รอยพับผ้า · ขอบทอง · ลายข้าวหลามตัด · ดวงตราทอง · ชายครุย */}
            <path d="M-24,-92 C-6,-97 28,-94 47,-81 L45,-50 C26,-46 -2,-46 -22,-50Z" fill="url(#wa-ele-cloth)" />
            <path d="M-8,-94 L-7,-48 M10,-94.5 L10,-47 M28,-91 L27,-47 M40,-85 L39,-49" stroke="#450a0a" strokeWidth=".8" opacity=".3" fill="none" />
            <path d="M-24,-92 C-6,-97 28,-94 47,-81" stroke="#fbbf24" strokeWidth="2" fill="none" />
            <path d="M-24,-92 L-22,-50 M47,-81 L45,-50" stroke="#fbbf24" strokeWidth="1.6" fill="none" />
            <path d="M-22,-50 C-2,-46 26,-46 45,-50" stroke="#fbbf24" strokeWidth="4" fill="none" />
            <path d="M-21,-56.5 C-1,-52.5 25,-52.5 44.5,-56.5" stroke="#fde68a" strokeWidth=".8" fill="none" opacity=".8" />
            {FRINGE.slice(0, 11).map(({ x: fx, y: fy }, i) => (
              <path key={i} d={`M${(fx + 2.6).toFixed(1)},${(fy - 6.4).toFixed(1)} l2,-2.2 l2,2.2 l-2,2.2Z`} fill="#fde68a" opacity=".9" />
            ))}
            <g transform="translate(12 -73)">
              <path d="M0,-10 L8,0 L0,10 L-8,0Z" fill="#fbbf24" />
              <path d="M0,-6 L4.8,0 L0,6 L-4.8,0Z" fill="#b91c1c" />
              <circle r="2" fill="#fde68a" />
              <path d="M-12,0 L-8,0 M8,0 L12,0" stroke="#fbbf24" strokeWidth="1" />
            </g>
            {FRINGE.map(({ x: fx, y: fy }, i) => (
              <g key={i}>
                <path d={`M${fx.toFixed(1)},${fy.toFixed(1)} l0,4.6`} stroke="#f59e0b" strokeWidth="1.1" />
                <circle cx={fx.toFixed(1)} cy={(fy + 5.4).toFixed(1)} r="1.2" fill="#fbbf24" />
              </g>
            ))}
            {/* ผ้าโพกหัว + ตาข่ายหน้าผาก + พู่ */}
            <path d="M-66,-80 C-60,-92 -46,-97 -32,-91 L-36,-85 C-46,-89 -56,-85 -62,-75Z" fill="#b91c1c" />
            <path d="M-66,-80 C-60,-92 -46,-97 -32,-91" stroke="#fbbf24" strokeWidth="1.4" fill="none" />
            <path d="M-69.5,-77 L-60.5,-86 L-66.5,-57Z" fill="#b91c1c" stroke="#fbbf24" strokeWidth="1" strokeLinejoin="round" />
            <g fill="#fde68a">
              <circle cx="-65.5" cy="-77" r=".9" />
              <circle cx="-66" cy="-70" r=".9" />
              <circle cx="-66.4" cy="-63.5" r=".8" />
            </g>
            <circle cx="-66.6" cy="-55" r="2.6" fill="#ef4444" />
            <circle cx="-66.6" cy="-55" r="1.1" fill="#fbbf24" />
          </>
        )}
        {rider === "howdah" && <Howdah />}
        {rider && <Mahout />}
      </g>
    </g>
  )
}

function ElephantFestival() {
  return (
    <>
      <defs>
        <linearGradient id="wa-ele-skin" gradientUnits="userSpaceOnUse" x1="0" y1="-97" x2="0" y2="0">
          <stop offset="0" stopColor="#d6ced6" />
          <stop offset=".55" stopColor="#a99eab" />
          <stop offset="1" stopColor="#71667a" />
        </linearGradient>
        <linearGradient id="wa-ele-far" gradientUnits="userSpaceOnUse" x1="0" y1="-40" x2="0" y2="0">
          <stop offset="0" stopColor="#7e7388" />
          <stop offset="1" stopColor="#544a5e" />
        </linearGradient>
        <linearGradient id="wa-ele-ear" gradientUnits="userSpaceOnUse" x1="-42" y1="-86" x2="-22" y2="-44">
          <stop offset="0" stopColor="#c4b9c3" />
          <stop offset="1" stopColor="#857a8d" />
        </linearGradient>
        <linearGradient id="wa-ele-ao" gradientUnits="userSpaceOnUse" x1="0" y1="-52" x2="0" y2="-24">
          <stop offset="0" stopColor="#231a2e" stopOpacity="0" />
          <stop offset="1" stopColor="#231a2e" stopOpacity=".5" />
        </linearGradient>
        <radialGradient id="wa-ele-sheen" gradientUnits="userSpaceOnUse" cx="30" cy="-90" r="48">
          <stop offset="0" stopColor="#fff7ed" stopOpacity=".35" />
          <stop offset="1" stopColor="#fff7ed" stopOpacity="0" />
        </radialGradient>
        <linearGradient id="wa-ele-cloth" gradientUnits="userSpaceOnUse" x1="0" y1="-96" x2="0" y2="-48">
          <stop offset="0" stopColor="#e23b3b" />
          <stop offset="1" stopColor="#8f1616" />
        </linearGradient>
        <linearGradient id="wa-ele-ground" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#f6d8a6" stopOpacity=".24" />
          <stop offset="1" stopColor="#f6d8a6" stopOpacity=".06" />
        </linearGradient>
        <radialGradient id="wa-sunwarm">
          <stop offset="0" stopColor="#fde68a" stopOpacity=".55" />
          <stop offset="1" stopColor="#fde68a" stopOpacity="0" />
        </radialGradient>
      </defs>
      <circle cx="760" cy="70" r="240" fill="url(#wa-sunwarm)" opacity=".55" />
      {/* ฉากหลังจาง: ปราสาทศีขรภูมิ + ต้นตาล */}
      <g fill="#fff" opacity=".1">
        <rect x="610" y="178" width="170" height="8" />
        <Prang x={695} y={178} w={30} h={92} />
        <Prang x={648} y={178} w={22} h={60} />
        <Prang x={742} y={178} w={22} h={60} />
      </g>
      <g fill="#fff" opacity=".11">
        <Palm x={470} h={112} lean={-4} />
        <Palm x={492} h={84} lean={6} />
        <Palm x={880} h={96} lean={-3} />
        <Palm x={255} h={78} lean={3} />
      </g>
      <Bunting x0={60} y0={8} cx={460} cy={58} x1={880} y1={6} n={19} />
      {/* ลานดินงานแสดงช้าง */}
      <path d="M-1200 200 V184 L0 184 Q300 176 600 182 T1300 180 V200Z" fill="url(#wa-ele-ground)" />
      <Sparkle x={200} y={70} s={0.6} d={0} />
      <Sparkle x={890} y={120} s={0.55} d={-1.2} fill="#fff" />
      <Sparkle x={330} y={128} s={0.5} d={-2} fill="#fff" />
      {/* ขบวน: ตัวไกลจางลงนิด (บรรยากาศ) · ตัวนำมีสัปคับ + ฉัตร · ลูกช้างเดินนำหน้า */}
      <g opacity=".86">
        <Elephant x={790} y={186} s={0.6} d={-0.9} rider="mahout" />
      </g>
      <Elephant x={580} y={189} s={0.8} d={-0.45} rider="mahout" />
      <Elephant x={360} y={190} s={0.9} d={0} rider="howdah" />
      <Elephant x={190} y={191} s={0.46} d={-0.2} calf />
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

/** tile: ภาพย่อในแกลเลอรีลาย (ไม่มีข้อความทับ → ไม่ต้องจางซ้าย, ตัดเฉพาะช่วงที่มีลาย) */
export default function WelcomeArt({ season, tile = false }) {
  const phone = useIsPhone()
  const Scene = SCENES[season] ?? Rain
  const fade = tile ? "none" : phone ? FADE_PHONE : FADE_DESKTOP
  const viewBox = tile ? "60 0 860 200" : phone ? `${PHONE_X[season] ?? 380} 0 440 200` : "0 0 1200 200"
  const aspect = tile || phone ? "xMidYMid slice" : "xMaxYMid meet"
  return (
    <div
      aria-hidden="true"
      className="welcome-art pointer-events-none absolute inset-y-0 right-0 w-full"
      style={{ WebkitMaskImage: fade, maskImage: fade }}
    >
      <svg
        className="h-full w-full"
        // desktop: ฉากกว้างชิดขวา · มือถือ: ตัดเฉพาะส่วนกลางของฉาก
        viewBox={viewBox}
        preserveAspectRatio={aspect}
        focusable="false"
      >
        <Rings />
        <Scene />
      </svg>
    </div>
  )
}
