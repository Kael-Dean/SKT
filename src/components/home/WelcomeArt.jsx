import { useIsPhone } from "../../hooks/useMediaQuery"

/**
 * ลายตกแต่งการ์ดต้อนรับหน้า Home ตามฤดูกาล/เทศกาลไทย
 * - SVG ล้วน (ไม่มีรูป/ไลบรารี) โปร่งใสบนพื้น indigo เดิม, จางหายทางซ้ายเพื่อไม่ให้ทับข้อความ
 * - เคลื่อนไหวเบา ๆ ด้วย CSS (keyframes `wa-*` ใน index.css); prefers-reduced-motion = ภาพนิ่ง
 * - เลือกฤดูด้วย getSeason() ที่ src/lib/season.js
 */

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
  let d = `M0 ${y} Q50 ${y - amp} 100 ${y}`
  for (let x = 200; x <= width; x += 100) d += ` T${x} ${y}`
  return `${d} V200 H0Z`
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

function Krathong({ x, y, s = 1, d = 0 }) {
  return (
    <g transform={`translate(${x} ${y}) scale(${s})`}>
      <g className="wa-bob" style={delay(d)}>
        <ellipse rx="26" ry="5" fill="#d9f99d" opacity=".5" />
        <g transform="translate(0 -2)">
          {[-64, -32, 0, 32, 64].map((a) => (
            <ellipse key={a} cy="-8" rx="4.6" ry="9" fill="#fff" opacity=".88" transform={`rotate(${a})`} />
          ))}
          {[-34, 0, 34].map((a) => (
            <ellipse key={a} cy="-5" rx="3.2" ry="6.5" fill="#fbcfe8" opacity=".95" transform={`rotate(${a})`} />
          ))}
        </g>
        <rect x="-1" y="-17" width="2" height="9" rx="1" fill="#fff" />
        <circle cy="-20" r="9" fill="#fde68a" opacity=".22" />
        <ellipse cy="-20" rx="1.8" ry="3.2" fill="#fde68a" className="wa-flicker" style={delay(d)} />
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
      <circle cx="800" cy="52" r="62" fill="url(#wa-moon)" opacity=".35" />
      <circle cx="800" cy="52" r="23" fill="#fff4cc" opacity=".92" />
      {[[560, 34, 0], [615, 70, 1.1], [680, 28, 2.2], [735, 62, 0.6], [905, 36, 1.7], [520, 78, 2.8], [955, 70, 0.3]].map(
        ([x, y, d], i) => <Star key={i} x={x} y={y} d={d} />,
      )}
      {[[560, 150, 1, -2], [620, 120, 0.8, -6], [690, 165, 1.1, -9], [760, 130, 0.7, -4], [840, 160, 0.9, -12], [510, 105, 0.6, -7]].map(
        ([x, y, s, d], i) => <Lantern key={i} x={x} y={y} s={s} d={d} />,
      )}
      <Waves y={168} />
      <Krathong x={650} y={178} s={1} d={0} />
      <Krathong x={790} y={188} s={0.62} d={-2} />
      <Krathong x={560} y={190} s={0.5} d={-3} />
    </>
  )
}

function Rain() {
  const streaks = Array.from({ length: 18 }).map((_, i) => ({
    x: 500 + i * 26 + (i % 3) * 7,
    y: 62 + ((i * 37) % 70),
    d: -((i * 0.37) % 1.6),
  }))
  const stalks = Array.from({ length: 20 }).map((_, i) => ({ x: 480 + i * 22 + (i % 2) * 5, h: 24 + ((i * 7) % 12) }))
  return (
    <>
      <g fill="#fff" opacity=".17" className="wa-float">
        <ellipse cx="640" cy="42" rx="50" ry="16" />
        <ellipse cx="610" cy="34" rx="28" ry="15" />
        <ellipse cx="672" cy="32" rx="30" ry="17" />
      </g>
      <g fill="#fff" opacity=".13" className="wa-float" style={delay(-3)}>
        <ellipse cx="820" cy="30" rx="56" ry="17" />
        <ellipse cx="792" cy="22" rx="28" ry="14" />
        <ellipse cx="850" cy="20" rx="30" ry="16" />
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
        <g key={i} transform={`translate(${x} ${y})`}>
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
      <circle cx="790" cy="62" r="74" fill="url(#wa-sun)" opacity=".5" />
      <g transform="translate(790 62)">
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
        <g key={y} transform={`translate(${500 + i * 36} ${y})`}>
          <path
            d="M0 0 Q20 -8 40 0 T80 0 T120 0 T160 0 T200 0 T240 0"
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
        <ellipse cx="560" cy="48" rx="40" ry="12" />
        <ellipse cx="540" cy="42" rx="22" ry="11" />
      </g>
    </>
  )
}

function Songkran() {
  const drops = [[560, 56, 1, 0], [640, 112, 0.8, -1.5], [740, 48, 1.1, -3], [830, 98, 0.9, -4.5], [905, 42, 0.7, -2.2], [690, 150, 0.7, -5]]
  const flowers = [[598, 150, 1, 0], [820, 138, 1.1, -2], [925, 84, 0.8, -4]]
  return (
    <>
      {drops.map(([x, y, s, d], i) => (
        <g key={i} transform={`translate(${x} ${y}) scale(${s})`}>
          <path d="M0,-9 C6,-1 7,4 0,8 C-7,4 -6,-1 0,-9Z" fill="#bae6fd" opacity=".85" className="wa-float" style={delay(d)} />
        </g>
      ))}
      {flowers.map(([x, y, s, d], i) => (
        <g key={i} transform={`translate(${x} ${y}) scale(${s})`}>
          <g className="wa-float" style={delay(d)}>
            {[0, 72, 144, 216, 288].map((a) => (
              <ellipse key={a} cy="-7" rx="3.6" ry="7.5" fill="#fff" opacity=".92" transform={`rotate(${a})`} />
            ))}
            <circle r="2.6" fill="#fde68a" />
          </g>
        </g>
      ))}
      {[[760, 176, 0], [760, 176, -1.2], [760, 176, -2.4]].map(([x, y, d], i) => (
        <g key={i} transform={`translate(${x} ${y})`}>
          <ellipse rx="64" ry="10" fill="none" stroke="#fff" strokeWidth="1.3" opacity=".4" className="wa-ripple" style={delay(d)} />
        </g>
      ))}
      <Waves y={170} tone="#e0f2fe" />
    </>
  )
}

function Cool() {
  return (
    <>
      <g transform="translate(850 52)">
        <path d="M0,-20 A20,20 0 1,0 0,20 A15,15 0 1,1 0,-20Z" fill="#e0e7ff" opacity=".92" />
      </g>
      {[[560, 38, 0], [620, 76, 1.2], [690, 30, 2.1], [745, 64, 0.5], [930, 40, 1.6], [520, 88, 2.7]].map(([x, y, d], i) => (
        <Star key={i} x={x} y={y} d={d} />
      ))}
      <path
        d="M420 200 L520 130 L580 165 L680 90 L780 160 L860 115 L980 175 L1100 140 L1200 170 V200Z"
        fill="#fff"
        opacity=".08"
      />
      <path
        d="M480 200 L580 165 L660 190 L760 140 L860 185 L960 150 L1060 190 L1200 160 V200Z"
        fill="#fff"
        opacity=".12"
      />
      <ellipse cx="640" cy="162" rx="120" ry="9" fill="#fff" opacity=".14" className="wa-mist" />
      <ellipse cx="830" cy="178" rx="150" ry="8" fill="#fff" opacity=".12" className="wa-mist" style={delay(-6)} />
    </>
  )
}

function NewYear() {
  const bursts = [[620, 74, 1, 0], [770, 112, 0.8, -1.8], [880, 56, 0.9, -3.2]]
  return (
    <>
      {bursts.map(([x, y, s, d], i) => (
        <g key={i} transform={`translate(${x} ${y}) scale(${s})`}>
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
      <Sparkle x={545} y={150} s={1} d={0} />
      <Sparkle x={695} y={36} s={0.7} d={-1} fill="#fff" />
      <Sparkle x={830} y={160} s={1.1} d={-2} />
      <Sparkle x={955} y={128} s={0.8} d={-0.5} fill="#fff" />
      <Sparkle x={585} y={60} s={0.7} d={-1.6} fill="#fff" />
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
}

const FADE_LEFT = "linear-gradient(to right, transparent 0%, #000 34%)"

export default function WelcomeArt({ season }) {
  const phone = useIsPhone()
  const Scene = SCENES[season] ?? Rain
  return (
    <div
      aria-hidden="true"
      className="welcome-art pointer-events-none absolute inset-y-0 right-0 w-full"
      style={{ WebkitMaskImage: FADE_LEFT, maskImage: FADE_LEFT }}
    >
      <svg
        className="h-full w-full"
        // desktop: ฉากกว้างชิดขวา · มือถือ: ตัดเฉพาะส่วนกลางของฉาก
        viewBox={phone ? "500 0 420 200" : "0 0 1200 200"}
        preserveAspectRatio={phone ? "xMidYMid slice" : "xMaxYMid meet"}
        focusable="false"
      >
        <Rings />
        <Scene />
      </svg>
    </div>
  )
}
