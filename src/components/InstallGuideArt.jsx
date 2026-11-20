// src/components/InstallGuideArt.jsx
// ─────────────────────────────────────────────────────────────────────────────
// Schematic pictures for the install guide. Part of its lazy chunk.
// Generic frames drawn here, one control highlighted: not screenshots and not browser artwork,
// because those menus change between versions. Colours are theme classes, so dark mode just works.
// aria-hidden: lib/installGuideContent.js carries all the meaning in text.
//
// Every scene shares the 240x120 viewBox. Non-highlighted rows are grey bars on purpose: the
// reader should look for the one labelled thing, not read a fake menu.
// ─────────────────────────────────────────────────────────────────────────────
import { ChevronDown, Ellipsis, EllipsisVertical, Menu as MenuIcon, MonitorDown, Share } from "lucide-react"

const SHELL = "fill-white stroke-gray-300 dark:fill-raised dark:stroke-line-strong"
const BAR = "fill-gray-100 dark:fill-white/[.06]"
const PILL = "fill-white stroke-gray-300 dark:fill-white/[.08] dark:stroke-line"
const BONE = "fill-gray-200 dark:fill-white/15"
const INK = "text-gray-500 dark:text-gray-400"
const LABEL = "fill-gray-600 dark:fill-gray-300"
const HOT = "fill-indigo-600 dark:fill-indigo-500"
const HALO = "fill-indigo-500/20 dark:fill-indigo-400/25"
const TINT = "fill-indigo-100 dark:fill-indigo-500/25"
const TINT_LABEL = "fill-indigo-700 dark:fill-indigo-200"

const FONT = 10

function Stage({ children }) {
  return (
    <div
      aria-hidden="true"
      className="w-full max-w-60 overflow-hidden rounded-xl bg-gray-50 ring-1 ring-inset ring-gray-200/70 dark:bg-field dark:ring-line"
    >
      <svg viewBox="0 0 240 120" focusable="false" className="block h-auto w-full">
        {children}
      </svg>
    </div>
  )
}

function Icon({ icon, cx, cy, size = 12, className = INK }) {
  const Glyph = icon
  return <Glyph x={cx - size / 2} y={cy - size / 2} size={size} strokeWidth={2} className={className} />
}

/** The control to press: a filled dot with a soft halo. */
function HotIcon({ icon, cx, cy }) {
  return (
    <g>
      <circle cx={cx} cy={cy} r={15} className={HALO} />
      <circle cx={cx} cy={cy} r={10.5} className={HOT} />
      <Icon icon={icon} cx={cx} cy={cy} className="text-white" />
    </g>
  )
}

function Bones({ x, y, widths, step = 16 }) {
  return widths.map((w, i) => <rect key={i} x={x} y={y + i * step} width={w} height={4} rx={2} className={BONE} />)
}

/** rows: width of a grey bar, or { label, tone: "hot" | "soft" }. */
function Menu({ x, y, w, rows, center = false }) {
  const h = rows.length * 17 + 6
  return (
    <g>
      <rect x={x} y={y} width={w} height={h} rx={7} className={SHELL} />
      {rows.map((row, i) => {
        const top = y + 3 + i * 17
        if (typeof row === "number") return <rect key={i} x={x + 10} y={top + 6} width={row} height={4} rx={2} className={BONE} />
        const hot = row.tone === "hot"
        return (
          <g key={i}>
            <rect x={x + 3} y={top} width={w - 6} height={16} rx={4} className={hot ? HOT : TINT} />
            <text
              x={center ? x + w / 2 : x + 9}
              y={top + 11.5}
              fontSize={FONT}
              textAnchor={center ? "middle" : "start"}
              className={hot ? "fill-white font-semibold" : `${TINT_LABEL} font-medium`}
            >
              {row.label}
            </text>
          </g>
        )
      })}
    </g>
  )
}

/** A labelled pill button. */
function HotButton({ x, y, w = 44, label }) {
  return (
    <g>
      <rect x={x - 4} y={y - 4} width={w + 8} height={26} rx={10} className={HALO} />
      <rect x={x} y={y} width={w} height={18} rx={6} className={HOT} />
      <text x={x + w / 2} y={y + 12.5} fontSize={FONT} textAnchor="middle" className="fill-white font-semibold">
        {label}
      </text>
    </g>
  )
}

// ── Desktop browser window, running off the bottom ──────────────────────────────
function Window({ dots = EllipsisVertical, hotDots = false, hotInstall = false, children }) {
  return (
    <>
      <rect x={8} y={8} width={224} height={130} rx={8} className={SHELL} />
      <path d="M9 26V16a7 7 0 0 1 7-7h208a7 7 0 0 1 7 7v10z" className={BAR} />
      <rect x={16} y={13} width={52} height={13} rx={3} className="fill-white dark:fill-white/[.08]" />
      <circle cx={20} cy={37} r={3} className={BONE} />
      <circle cx={32} cy={37} r={3} className={BONE} />
      <rect x={42} y={29} width={156} height={16} rx={8} className={PILL} />
      <rect x={52} y={35} width={58} height={4} rx={2} className={BONE} />
      {hotInstall ? <HotIcon icon={MonitorDown} cx={184} cy={37} /> : null}
      {hotDots ? <HotIcon icon={dots} cx={215} cy={37} /> : <Icon icon={dots} cx={215} cy={37} />}
      {children}
    </>
  )
}

function WindowWithDialog({ label, dots }) {
  return (
    <Stage>
      <Window dots={dots} />
      <rect x={8} y={8} width={224} height={130} rx={8} className="fill-gray-900/10 dark:fill-black/35" />
      <rect x={50} y={32} width={140} height={78} rx={9} className={SHELL} />
      <rect x={60} y={42} width={20} height={20} rx={5} className={TINT} />
      <Bones x={87} y={45} widths={[78, 54]} step={10} />
      <rect x={84} y={82} width={36} height={18} rx={6} className={BAR} />
      <HotButton x={128} y={82} w={50} label={label} />
    </Stage>
  )
}

// ── Mac menu bar ────────────────────────────────────────────────────────────────
function MacBar({ hot = false }) {
  return (
    <>
      <rect x={0} y={0} width={240} height={24} className={BAR} />
      <text x={14} y={16} fontSize={FONT} className={`${LABEL} font-semibold`}>
        Safari
      </text>
      {hot ? (
        <>
          <rect x={45} y={0} width={36} height={24} className={HALO} />
          <rect x={49} y={4} width={28} height={16} rx={4} className={HOT} />
        </>
      ) : (
        <rect x={49} y={4} width={28} height={16} rx={4} className={TINT} />
      )}
      <text x={63} y={16} fontSize={FONT} textAnchor="middle" className={hot ? "fill-white font-semibold" : `${TINT_LABEL} font-medium`}>
        File
      </text>
      <rect x={90} y={10} width={22} height={4} rx={2} className={BONE} />
      <rect x={122} y={10} width={22} height={4} rx={2} className={BONE} />
      <rect x={154} y={10} width={22} height={4} rx={2} className={BONE} />
    </>
  )
}

// ── Phone crops: only the end of the phone that matters ─────────────────────────
function PhoneTop({ hotDots = false, children }) {
  return (
    <>
      <rect x={52} y={8} width={136} height={130} rx={16} className={SHELL} />
      <rect x={62} y={20} width={92} height={18} rx={9} className={PILL} />
      <rect x={72} y={27} width={46} height={4} rx={2} className={BONE} />
      {hotDots ? <HotIcon icon={EllipsisVertical} cx={170} cy={29} /> : <Icon icon={EllipsisVertical} cx={170} cy={29} />}
      {children}
    </>
  )
}

function PhoneBottom({ children }) {
  return (
    <>
      <rect x={52} y={-20} width={136} height={132} rx={16} className={SHELL} />
      {children}
    </>
  )
}

function PhoneDim() {
  return <rect x={52} y={8} width={136} height={130} rx={16} className="fill-gray-900/10 dark:fill-black/35" />
}

/** Safari's "add" page shared by the iOS scenes. */
function IosAddPage({ toggle = false, hotToggle = false, hotAdd = false }) {
  return (
    <PhoneBottom>
      <rect x={62} y={14} width={24} height={4} rx={2} className={BONE} />
      {hotAdd ? (
        <HotButton x={146} y={7} w={34} label="เพิ่ม" />
      ) : (
        <text x={163} y={19.5} fontSize={FONT} textAnchor="middle" className={`${LABEL} font-semibold`}>
          เพิ่ม
        </text>
      )}
      <rect x={62} y={34} width={22} height={22} rx={5} className={TINT} />
      <text x={92} y={43} fontSize={FONT} className={LABEL}>
        AMC สกต.สุรินทร์
      </text>
      <rect x={92} y={49} width={70} height={4} rx={2} className={BONE} />
      {toggle ? (
        <>
          {hotToggle && <rect x={56} y={65} width={128} height={30} rx={9} className={HALO} />}
          <rect x={60} y={69} width={120} height={22} rx={6} className={BAR} />
          <text x={66} y={83.5} fontSize={FONT} className={hotToggle ? `${TINT_LABEL} font-semibold` : LABEL}>
            เปิดเป็นเว็บแอป
          </text>
          <rect x={150} y={73} width={26} height={14} rx={7} className={HOT} />
          <circle cx={169} cy={80} r={5.5} className="fill-white" />
        </>
      ) : (
        <rect x={62} y={73} width={100} height={4} rx={2} className={BONE} />
      )}
    </PhoneBottom>
  )
}

const SCENES = {
  // ── Chrome / Edge on a computer ───────────────────────────────────────────────
  desktopInstallIcon: () => (
    <Stage>
      <Window hotInstall />
    </Stage>
  ),
  chromeKebab: () => (
    <Stage>
      <Window hotDots />
    </Stage>
  ),
  chromeMenu: () => (
    <Stage>
      <Window>
        <Menu x={96} y={48} w={128} rows={[64, { label: "Cast, save, and share", tone: "hot" }, 82, 50]} />
      </Window>
    </Stage>
  ),
  chromeSubmenu: () => (
    <Stage>
      <Window>
        <Menu x={136} y={48} w={92} rows={[50, { label: "Cast, save…", tone: "soft" }, 62, 40]} />
        <Menu x={22} y={60} w={118} rows={[{ label: "Install page as app", tone: "hot" }, 76, 58]} />
      </Window>
    </Stage>
  ),
  desktopConfirm: () => <WindowWithDialog label="Install" />,
  edgeConfirm: () => <WindowWithDialog label="Install" dots={Ellipsis} />,
  edgeDots: () => (
    <Stage>
      <Window dots={Ellipsis} hotDots />
    </Stage>
  ),
  edgeMenu: () => (
    <Stage>
      <Window dots={Ellipsis}>
        <Menu x={118} y={48} w={106} rows={[66, 50, { label: "Apps", tone: "hot" }, 58]} />
      </Window>
    </Stage>
  ),
  edgeSubmenu: () => (
    <Stage>
      <Window dots={Ellipsis}>
        <Menu x={166} y={48} w={62} rows={[36, 28, { label: "Apps", tone: "soft" }, 32]} />
        <Menu x={16} y={66} w={154} rows={[{ label: "Install this site as an app", tone: "hot" }, 80]} />
      </Window>
    </Stage>
  ),

  // ── Safari on a Mac ───────────────────────────────────────────────────────────
  macFile: () => (
    <Stage>
      <MacBar hot />
      <rect x={20} y={40} width={200} height={100} rx={8} className={SHELL} />
      <rect x={32} y={54} width={110} height={4} rx={2} className={BONE} />
    </Stage>
  ),
  macFileMenu: () => (
    <Stage>
      <MacBar />
      <rect x={20} y={40} width={200} height={100} rx={8} className={SHELL} />
      <Menu x={44} y={25} w={116} rows={[70, 52, { label: "Add to Dock", tone: "hot" }, 62]} />
    </Stage>
  ),
  macConfirm: () => (
    <Stage>
      <MacBar />
      <rect x={20} y={40} width={200} height={100} rx={8} className={SHELL} />
      <rect x={58} y={34} width={124} height={76} rx={9} className={SHELL} />
      <rect x={68} y={44} width={20} height={20} rx={5} className={TINT} />
      <Bones x={95} y={47} widths={[66, 44]} step={10} />
      <rect x={92} y={84} width={36} height={18} rx={6} className={BAR} />
      <HotButton x={134} y={84} w={38} label="Add" />
    </Stage>
  ),

  // ── Android: Chrome ───────────────────────────────────────────────────────────
  androidKebab: () => (
    <Stage>
      <PhoneTop hotDots />
    </Stage>
  ),
  androidMenu: () => (
    <Stage>
      <PhoneTop>
        <Menu x={62} y={42} w={118} rows={[60, { label: "Add to Home screen", tone: "hot" }, 76, 50]} />
      </PhoneTop>
    </Stage>
  ),
  androidConfirm: () => (
    <Stage>
      <PhoneTop />
      <PhoneDim />
      <rect x={60} y={36} width={120} height={72} rx={10} className={SHELL} />
      <rect x={70} y={46} width={18} height={18} rx={5} className={TINT} />
      <Bones x={94} y={49} widths={[60, 40]} step={9} />
      <HotButton x={122} y={80} w={48} label="Install" />
    </Stage>
  ),
  androidHome: () => (
    <Stage>
      <rect x={52} y={8} width={136} height={130} rx={16} className={SHELL} />
      {[70, 102, 134].map((x) => (
        <rect key={x} x={x} y={24} width={20} height={20} rx={5} className={BAR} />
      ))}
      {[102, 134].map((x) => (
        <rect key={x} x={x} y={66} width={20} height={20} rx={5} className={BAR} />
      ))}
      <rect x={64} y={60} width={32} height={32} rx={10} className={HALO} />
      <rect x={70} y={66} width={20} height={20} rx={5} className={HOT} />
      <text x={80} y={105} fontSize={FONT} textAnchor="middle" className={`${LABEL} font-semibold`}>
        AMC สกต.สุรินทร์
      </text>
    </Stage>
  ),

  // ── Android: Samsung Internet ─────────────────────────────────────────────────
  samsungButton: () => (
    <Stage>
      <PhoneBottom>
        <rect x={62} y={6} width={116} height={18} rx={9} className={PILL} />
        <rect x={52.5} y={72} width={135} height={1} className={BONE} />
        {[70, 96, 122, 148].map((x) => (
          <circle key={x} cx={x} cy={92} r={3.5} className={BONE} />
        ))}
        <HotIcon icon={MenuIcon} cx={170} cy={90} />
      </PhoneBottom>
    </Stage>
  ),
  samsungMenu: () => (
    <Stage>
      <PhoneBottom>
        <Menu x={60} y={18} w={120} rows={[62, 78, { label: "Add page to", tone: "hot" }, 54]} />
        <Icon icon={MenuIcon} cx={170} cy={99} />
      </PhoneBottom>
    </Stage>
  ),
  samsungTarget: () => (
    <Stage>
      <PhoneBottom>
        <Menu x={60} y={28} w={120} rows={[52, { label: "Home screen", tone: "hot" }, 70]} />
      </PhoneBottom>
    </Stage>
  ),

  // ── iPhone / iPad: Safari ─────────────────────────────────────────────────────
  ios26Dots: () => (
    <Stage>
      <PhoneBottom>
        <rect x={60} y={78} width={88} height={22} rx={11} className={PILL} />
        <rect x={72} y={87} width={44} height={4} rx={2} className={BONE} />
        <HotIcon icon={Ellipsis} cx={167} cy={89} />
      </PhoneBottom>
    </Stage>
  ),
  ios26Share: () => (
    <Stage>
      <PhoneBottom>
        <Menu x={72} y={18} w={106} rows={[{ label: "แชร์ (Share)", tone: "hot" }, 62, 48]} />
        <rect x={60} y={84} width={88} height={18} rx={9} className={PILL} />
        <Icon icon={Ellipsis} cx={167} cy={93} />
        <Icon icon={Share} cx={165} cy={27} className="text-white" />
      </PhoneBottom>
    </Stage>
  ),
  iosSheet: () => (
    <Stage>
      <PhoneBottom>
        <Menu x={56} y={18} w={128} rows={[64, 80, { label: "เพิ่มไปยังหน้าจอโฮม", tone: "hot" }, 58, 72]} />
      </PhoneBottom>
    </Stage>
  ),
  iosToggle: () => (
    <Stage>
      <IosAddPage toggle hotToggle />
    </Stage>
  ),
  iosAdd26: () => (
    <Stage>
      <IosAddPage toggle hotAdd />
    </Stage>
  ),
  iosAddOld: () => (
    <Stage>
      <IosAddPage hotAdd />
    </Stage>
  ),
  // ── iPhone / iPad: Chrome ─────────────────────────────────────────────────────
  chromeIosShare: () => (
    <Stage>
      <ChromeIosTop hotShare />
    </Stage>
  ),
  chromeIosMore: () => (
    <Stage>
      <ChromeIosTop />
      <PhoneDim />
      <rect x={56} y={44} width={128} height={76} rx={12} className={SHELL} />
      <rect x={66} y={54} width={60} height={4} rx={2} className={BONE} />
      {[74, 102, 130].map((x) => (
        <circle key={x} cx={x} cy={80} r={10} className={BAR} />
      ))}
      <HotIcon icon={ChevronDown} cx={160} cy={80} />
      <text x={160} y={106} fontSize={FONT} textAnchor="middle" className={`${TINT_LABEL} font-semibold`}>
        View More
      </text>
    </Stage>
  ),
  chromeIosAdd: () => (
    <Stage>
      <ChromeIosTop />
      <PhoneDim />
      <Menu x={56} y={44} w={128} rows={[58, { label: "Add to Home Screen", tone: "hot" }, 70, 50]} />
    </Stage>
  ),
  iosShareOld: () => (
    <Stage>
      {/* iPhone: bottom of the screen */}
      <rect x={14} y={-20} width={92} height={130} rx={14} className={SHELL} />
      <rect x={22} y={8} width={76} height={4} rx={2} className={BONE} />
      {[28, 92].map((x) => (
        <circle key={x} cx={x} cy={88} r={3.5} className={BONE} />
      ))}
      <HotIcon icon={Share} cx={60} cy={86} />
      {/* iPad: top right of the screen */}
      <rect x={118} y={14} width={140} height={120} rx={10} className={SHELL} />
      <rect x={128} y={28} width={46} height={12} rx={6} className={PILL} />
      <HotIcon icon={Share} cx={203} cy={34} />
    </Stage>
  ),
}

/** Chrome on iPhone / iPad: the address bar sits on top, with Share at its right end. */
function ChromeIosTop({ hotShare = false }) {
  return (
    <>
      <rect x={52} y={8} width={136} height={130} rx={16} className={SHELL} />
      <rect x={62} y={20} width={92} height={18} rx={9} className={PILL} />
      <rect x={84} y={27} width={46} height={4} rx={2} className={BONE} />
      {hotShare ? <HotIcon icon={Share} cx={170} cy={29} /> : <Icon icon={Share} cx={170} cy={29} />}
    </>
  )
}

export default function InstallGuideArt({ name }) {
  const Scene = SCENES[name]
  return Scene ? <Scene /> : null
}
