// src/pages/dev/DevMobileKit.jsx
// Dev-only gallery of the mobile primitives (registered in App.jsx only when
// import.meta.env.DEV, outside the login guard so QA can hit it directly):
//   http://localhost:5173/#/dev/mobile-kit
// Every primitive from plan §B2 is exercised here in light + dark so it can be
// QA'd (playwright-cli) before any trading page consumes it.
import { useEffect, useMemo, useRef, useState } from "react"
import { Link } from "react-router-dom"
import { Moon, Sun, Trash2 } from "lucide-react"
import {
  Badge,
  DataList,
  EmptyState,
  ResultSheet,
  SearchField,
  Sheet,
  StickyActionBar,
  Stepper,
  Toaster,
  toast,
} from "../../components/ui"
import ComboBox from "../../components/ComboBox"
import SelectDropdown from "../../components/SelectDropdown"
import ThaiDatePicker from "../../components/ThaiDatePicker"
import StickyTableScrollbar from "../../components/StickyTableScrollbar"
import { useIsPhone, useIsCoarsePointer } from "../../hooks/useMediaQuery"
import useVisualViewport from "../../hooks/useVisualViewport"
import {
  cx,
  baseField,
  labelCls,
  cardPaddedCls,
  sectionTitleCls,
  primaryBtnCls,
  neutralBtnCls,
  dangerBtnCls,
  submitBtnCls,
  iconBtnCls,
  segmentedCls,
  segmentedItemCls,
  segmentedItemActiveCls,
  readonlyFieldCls,
  cellInput,
} from "../../lib/styles"

const nf = (n) => Number(n ?? 0).toLocaleString("th-TH")
const thb = (n) => `฿${Number(n ?? 0).toLocaleString("th-TH", { minimumFractionDigits: 2 })}`

const STEPS = [
  { key: "customer", label: "ข้อมูลลูกค้า", shortLabel: "ลูกค้า" },
  { key: "spec", label: "สเปค / คลัง", shortLabel: "สเปค" },
  { key: "weigh", label: "ชั่งน้ำหนักและคำนวณ", shortLabel: "ชั่ง" },
  { key: "review", label: "ตรวจสอบและบันทึก", shortLabel: "บันทึก" },
]

const ORDERS = Array.from({ length: 12 }, (_, i) => ({
  id: 1000 + i,
  customer: ["นายสมชาย ใจดี", "นางสาวพิมพ์ใจ รักษ์ดี", "บริษัท รวมข้าวไทย จำกัด", "นายประเสริฐ ศรีสุข"][i % 4],
  date: `2568-10-${String(1 + i).padStart(2, "0")}`,
  orderNo: `BUY-${2568}/${String(12 + i).padStart(4, "0")}`,
  rice: ["ข้าวหอมมะลิ 105 · ชั้น 1", "ข้าวเหนียว กข6", "ข้าวปทุมธานี 1", "ข้าวหอมมะลิ 105 · ชั้น 2"][i % 4],
  netKg: 1240 + i * 137,
  deductKg: 12 + i,
  unitPrice: 12.5 + (i % 3) * 0.25,
  amount: (1240 + i * 137) * (12.5 + (i % 3) * 0.25),
  branch: ["สำนักงานใหญ่", "สาขาปราสาท", "สาขาสังขะ"][i % 3],
}))

const MEMBERS = [
  { id: "1309900123456", name: "นายสมชาย ใจดี", memberId: "M-0001", village: "บ้านโคกสะอาด" },
  { id: "1309900234567", name: "นางสาวพิมพ์ใจ รักษ์ดี", memberId: "M-0002", village: "บ้านหนองบัว" },
  { id: "3320100345678", name: "นายประเสริฐ ศรีสุข", memberId: "M-0003", village: "บ้านตาเมือง" },
  { id: "3320100456789", name: "นางมาลี สุขใจ", memberId: "M-0004", village: "บ้านโคกสะอาด" },
  { id: "1100200567890", name: "นายวิชัย ทองดี", memberId: "M-0005", village: "บ้านดงบัง" },
]

const BRANCHES = [
  { value: "1", label: "สำนักงานใหญ่" },
  { value: "2", label: "สาขาปราสาท" },
  { value: "3", label: "สาขาสังขะ" },
]

const RICE_SPECS = Array.from({ length: 14 }, (_, i) => ({
  id: i + 1,
  label: ["ข้าวหอมมะลิ 105", "ข้าวเหนียว กข6", "ข้าวปทุมธานี 1", "ข้าวขาวดอกมะลิ", "ข้าวไรซ์เบอร์รี่", "ข้าว กข15", "ข้าวสังข์หยด"][i % 7] + (i >= 7 ? " (เก่า)" : ""),
  subLabel: `ชั้น ${(i % 3) + 1} · ปี 2568`,
}))

const PAYMENTS = [
  { value: "cash", label: "เงินสด" },
  { value: "transfer", label: "โอนเงิน" },
  { value: "credit", label: "เครดิต" },
]

function Section({ id, title, note, children }) {
  return (
    <section id={id} className={cx(cardPaddedCls, "scroll-mt-20")}>
      <h2 className={sectionTitleCls}>{title}</h2>
      {note && <p className="mb-4 text-sm leading-relaxed text-gray-500 dark:text-gray-400">{note}</p>}
      {children}
    </section>
  )
}

export default function DevMobileKit() {
  const [dark, setDark] = useState(() => document.documentElement.classList.contains("dark"))
  useEffect(() => {
    document.documentElement.classList.toggle("dark", dark)
  }, [dark])

  const isPhone = useIsPhone()
  const isCoarse = useIsCoarsePointer()
  const vv = useVisualViewport()

  // Stepper
  const [step, setStep] = useState(0)
  const [maxStep, setMaxStep] = useState(1)
  const [errorSteps, setErrorSteps] = useState([])

  // Sheets
  const [sheet, setSheet] = useState(null) // 'sm' | 'md' | 'lg' | 'full' | 'form'
  const [busy, setBusy] = useState(false)
  const [result, setResult] = useState(null) // 'success' | 'error'

  // Fields
  const [buyerType, setBuyerType] = useState("person")
  const [branch, setBranch] = useState("")
  const [spec, setSpec] = useState("")
  const [payment, setPayment] = useState("")
  const [date, setDate] = useState("")
  const [weight, setWeight] = useState("")
  const [comboInSheet, setComboInSheet] = useState("")
  const [comboOverBar, setComboOverBar] = useState("")
  const comboRef = useRef(null)
  const nextFieldRef = useRef(null)

  // Search
  const [q, setQ] = useState("")
  const [hi, setHi] = useState(-1)
  const [picked, setPicked] = useState(null)
  const [searching, setSearching] = useState(false)
  const hits = useMemo(() => {
    const s = q.trim().toLowerCase()
    if (s.length < 2) return []
    return MEMBERS.filter((m) => m.name.includes(s) || m.id.includes(s) || m.memberId.toLowerCase().includes(s))
  }, [q])
  useEffect(() => {
    if (q.trim().length < 2) return
    setSearching(true)
    const t = setTimeout(() => setSearching(false), 400)
    return () => clearTimeout(t)
  }, [q])

  // DataList
  const [listMode, setListMode] = useState("data") // data | loading | empty

  // StickyTableScrollbar demo
  const tableRef = useRef(null)

  const pageVars = { "--topbar-h": "0px" }

  return (
    <div style={pageVars} className="min-h-dvh bg-gray-50 text-gray-900 dark:bg-gray-950 dark:text-gray-100">
      <Toaster />
      <header className="sticky top-0 z-20 border-b border-gray-200/70 bg-white/80 backdrop-blur-md dark:border-gray-800 dark:bg-gray-900/70">
        <div className="mx-auto flex max-w-5xl items-center gap-3 px-4 py-2.5 md:px-6">
          <h1 className="min-w-0 flex-1 truncate text-base font-bold">Mobile Kit — primitives (dev)</h1>
          <span className="hidden text-xs text-gray-500 dark:text-gray-400 sm:inline" data-testid="env">
            {isPhone ? "phone" : "desktop"} · {isCoarse ? "coarse" : "fine"} · vv {vv.height}px{vv.keyboardOpen ? " · kb" : ""}
          </span>
          <button type="button" onClick={() => setDark((d) => !d)} aria-label={dark ? "สลับเป็นโหมดสว่าง" : "สลับเป็นโหมดมืด"} className={iconBtnCls}>
            {dark ? <Sun aria-hidden="true" className="size-5" strokeWidth={1.75} /> : <Moon aria-hidden="true" className="size-5" strokeWidth={1.75} />}
          </button>
        </div>
      </header>

      <main className="mx-auto max-w-5xl space-y-6 px-4 py-5 md:px-6">
        <nav aria-label="ไปยังส่วน" className="flex flex-wrap gap-2 text-sm">
          {["foundation", "stepper", "sheet", "combobox", "search", "datalist", "scrollbar", "actionbar"].map((s) => (
            <a key={s} href={`#${s}`} className="rounded-full bg-white px-3 py-1.5 ring-1 ring-gray-200 hover:bg-gray-100 dark:bg-gray-800 dark:ring-gray-700 dark:hover:bg-gray-700">
              {s}
            </a>
          ))}
          <Link to="/dev/hr" className="rounded-full px-3 py-1.5 text-indigo-600 hover:underline dark:text-indigo-300">/dev/hr</Link>
        </nav>

        {/* ── Foundation ─────────────────────────────────────────────── */}
        <Section id="foundation" title="Foundation — fields / buttons / segmented" note="input ต้องคำนวณได้ ≥16px ที่ <768px (unlayered rule) ยกเว้น .cell-input; ปุ่ม h-11 บนมือถือ">
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <label htmlFor="kit-weight" className={labelCls}>น้ำหนักขาเข้า (กก.)</label>
              <input id="kit-weight" data-testid="input-base" inputMode="decimal" value={weight} onChange={(e) => setWeight(e.target.value)} className={baseField} placeholder="0.00" />
            </div>
            <div>
              <label htmlFor="kit-small" className={labelCls}>input class text-xs (ต้องยังได้ 16px บนมือถือ)</label>
              <input id="kit-small" data-testid="input-xs" className={cx(baseField, "text-xs md:text-xs")} placeholder="text-xs" />
            </div>
            <div>
              <label htmlFor="kit-cell" className={labelCls}>cellInput (.cell-input — ยกเว้นกฎ)</label>
              <input id="kit-cell" data-testid="input-cell" className={cx(cellInput, "max-w-32")} defaultValue="1,250" />
            </div>
            <div>
              <label htmlFor="kit-readonly" className={labelCls}>readonlyFieldCls</label>
              <div id="kit-readonly" className={readonlyFieldCls}>สำนักงานใหญ่</div>
            </div>
            <div>
              <span className={labelCls}>Segmented (buyer type)</span>
              <div role="radiogroup" aria-label="ประเภทผู้ขาย" className={segmentedCls}>
                {[["person", "บุคคล"], ["company", "บริษัท"]].map(([v, l]) => (
                  <button key={v} type="button" role="radio" aria-checked={buyerType === v} onClick={() => setBuyerType(v)} className={cx(segmentedItemCls, buyerType === v && segmentedItemActiveCls)}>
                    {l}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label htmlFor="kit-date" className={labelCls}>ThaiDatePicker (portal / Sheet บนมือถือ)</label>
              <ThaiDatePicker id="kit-date" value={date} onChange={setDate} className={baseField} />
            </div>
            <div>
              <label htmlFor="kit-select" className={labelCls}>SelectDropdown searchable (ไม่ autofocus บน touch)</label>
              <SelectDropdown id="kit-select" searchable options={BRANCHES} value={branch} onChange={setBranch} ariaLabel="สาขา" />
            </div>
          </div>
          <div className="mt-5 flex flex-wrap gap-2">
            <button type="button" className={primaryBtnCls}>primaryBtnCls</button>
            <button type="button" className={neutralBtnCls}>neutralBtnCls</button>
            <button type="button" className={dangerBtnCls}>dangerBtnCls</button>
            <button type="button" className={submitBtnCls}>submitBtnCls</button>
            <button type="button" className={iconBtnCls} aria-label="ลบ"><Trash2 aria-hidden="true" className="size-5" strokeWidth={1.75} /></button>
            <button type="button" className={neutralBtnCls} onClick={() => toast.success("บันทึกแล้ว", { description: "เลขที่ BUY-2568/0012 · ฿15,500.00" })}>toast.success</button>
            <button
              type="button"
              className={neutralBtnCls}
              onClick={() =>
                toast.error("กรอกไม่ครบ", {
                  description: "ยังไม่ได้กรอก: น้ำหนักขาเข้า, ความชื้น และอีก 2 ช่อง",
                  action: { label: "ไปที่ขั้น 3", onClick: () => setStep(2) },
                })
              }
            >
              toast.error + action
            </button>
          </div>
        </Section>

        {/* ── Stepper ───────────────────────────────────────────────── */}
        <Section id="stepper" title="Stepper" note="sticky top-(--topbar-h); กดย้อนได้เฉพาะ ≤ maxReached; dot แดงเมื่อ errorSteps">
          <Stepper steps={STEPS} current={step} maxReached={maxStep} errorSteps={errorSteps} onSelect={setStep} className="-mx-5 px-5" />
          <div className="mt-4 flex flex-wrap gap-2">
            <button type="button" className={neutralBtnCls} onClick={() => setStep((s) => Math.max(0, s - 1))}>ย้อนกลับ</button>
            <button type="button" className={primaryBtnCls} onClick={() => { const n = Math.min(STEPS.length - 1, step + 1); setStep(n); setMaxStep((m) => Math.max(m, n)) }}>ถัดไป</button>
            <button type="button" className={neutralBtnCls} onClick={() => setErrorSteps((e) => (e.length ? [] : [1]))}>toggle error step 2</button>
          </div>
        </Section>

        {/* ── Sheet ─────────────────────────────────────────────────── */}
        <Section id="sheet" title="Sheet / ResultSheet" note="<md bottom sheet (handle, max-h ตาม visualViewport); ≥md centered. ComboBox/DatePicker ข้างในต้องเปิดทับ sheet ได้">
          <div className="flex flex-wrap gap-2">
            {["sm", "md", "lg", "full"].map((s) => (
              <button key={s} type="button" className={neutralBtnCls} onClick={() => setSheet(s)}>Sheet {s}</button>
            ))}
            <button type="button" className={primaryBtnCls} data-testid="open-form-sheet" onClick={() => setSheet("form")}>Sheet + form (keyboard test)</button>
            <button type="button" className={cx(neutralBtnCls, "text-emerald-700 dark:text-emerald-300")} onClick={() => setResult("success")}>ResultSheet success</button>
            <button type="button" className={cx(neutralBtnCls, "text-red-700 dark:text-red-300")} onClick={() => setResult("error")}>ResultSheet error</button>
          </div>

          <Sheet
            open={sheet !== null && sheet !== "form"}
            onClose={() => setSheet(null)}
            title={`Sheet size=${sheet}`}
            subtitle="subtitle · ข้อความรองใต้หัวข้อ"
            size={sheet ?? "sm"}
            footer={
              <div className="grid grid-cols-2 gap-3 md:flex md:justify-end md:gap-2">
                <button type="button" className={cx(neutralBtnCls, "h-12 md:h-10")} onClick={() => setSheet(null)}>ยกเลิก</button>
                <button type="button" className={cx(primaryBtnCls, "h-12 md:h-10")} onClick={() => setSheet(null)}>ตกลง</button>
              </div>
            }
          >
            <dl className="divide-y divide-gray-100 dark:divide-gray-700/70">
              {ORDERS.slice(0, sheet === "sm" ? 3 : 12).map((o) => (
                <div key={o.id} className="flex items-baseline justify-between gap-4 py-2.5">
                  <dt className="text-sm text-gray-500 dark:text-gray-400">{o.customer}</dt>
                  <dd className="text-sm font-semibold tabular-nums">{thb(o.amount)}</dd>
                </div>
              ))}
            </dl>
          </Sheet>

          <Sheet
            open={sheet === "form"}
            onClose={() => !busy && setSheet(null)}
            title="แก้ไขออเดอร์ #1012"
            subtitle="นายสมชาย ใจดี · 1 ต.ค. 2568"
            size="full"
            busy={busy}
            hideHandle
            footer={
              <div className="grid grid-cols-2 gap-3 md:flex md:justify-end md:gap-2">
                <button type="button" className={cx(neutralBtnCls, "h-12 md:h-10")} disabled={busy} onClick={() => setSheet(null)}>ยกเลิก</button>
                <button type="button" className={cx(submitBtnCls, "h-12 py-0 md:h-10")} disabled={busy} onClick={() => { setBusy(true); setTimeout(() => { setBusy(false); setSheet(null); setResult("success") }, 900) }}>
                  {busy ? "กำลังบันทึก…" : "บันทึกการแก้ไข"}
                </button>
              </div>
            }
          >
            <div className="space-y-4">
              <div>
                <label htmlFor="sheet-combo" className={labelCls}>ชนิดข้าว (ComboBox ใน Sheet — เปิดทับ sheet)</label>
                <ComboBox id="sheet-combo" title="ชนิดข้าว" options={RICE_SPECS} value={comboInSheet} onChange={(v) => setComboInSheet(v)} placeholder="— เลือกชนิดข้าว —" ariaLabel="ชนิดข้าว" />
              </div>
              <div>
                <label htmlFor="sheet-date" className={labelCls}>วันที่</label>
                <ThaiDatePicker id="sheet-date" value={date} onChange={setDate} className={baseField} />
              </div>
              {["น้ำหนักขาเข้า", "น้ำหนักขาออก", "ความชื้น (%)", "สิ่งเจือปน (%)", "ราคา/กก.", "หมายเหตุ"].map((l, i) => (
                <div key={l}>
                  <label htmlFor={`sheet-f${i}`} className={labelCls}>{l}</label>
                  <input id={`sheet-f${i}`} data-testid={`sheet-input-${i}`} inputMode={i < 5 ? "decimal" : undefined} className={baseField} placeholder={l} />
                </div>
              ))}
            </div>
          </Sheet>

          <ResultSheet
            open={result === "success"}
            tone="success"
            title="บันทึกออเดอร์แล้ว"
            description="เลขที่ BUY-2568/0012"
            lines={[
              { label: "ลูกค้า", value: "นายสมชาย ใจดี" },
              { label: "น้ำหนักสุทธิ", value: "1,240 กก." },
              { label: "เป็นเงิน", value: thb(15500) },
            ]}
            primary={{ label: "ทำรายการใหม่", onClick: () => setResult(null) }}
            secondary={{ label: "ดูออเดอร์", onClick: () => setResult(null) }}
            onClose={() => setResult(null)}
          />
          <ResultSheet
            open={result === "error"}
            tone="error"
            title="บันทึกไม่สำเร็จ 1/2 รายการ"
            description="รายการที่บันทึกแล้วจะไม่ถูกบันทึกซ้ำ"
            lines={[
              { label: "คันที่ 1", value: "บันทึกแล้ว", tone: "success" },
              { label: "คันที่ 2", value: "น้ำหนักพ่วงหลังต้องมากกว่า 0", tone: "error" },
            ]}
            primary={{ label: "แก้ไขคันที่ 2", onClick: () => setResult(null) }}
            secondary={{ label: "ปิด", onClick: () => setResult(null) }}
            onClose={() => setResult(null)}
          />
        </Section>

        {/* ── ComboBox ──────────────────────────────────────────────── */}
        <Section id="combobox" title="ComboBox (shared, portaled)" note="desktop: listbox fixed z 10050 + keyboard เหมือน Buy.jsx; <md: picker Sheet full + search (>8 options) + row 44px. Enter หลังเลือก → onEnterNext (desktop เท่านั้น)">
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <label htmlFor="kit-combo-spec" className={labelCls}>ชนิดข้าว (14 รายการ → searchable auto)</label>
              <ComboBox
                ref={comboRef}
                id="kit-combo-spec"
                title="ชนิดข้าว"
                options={RICE_SPECS}
                value={spec}
                onChange={(v, opt) => { setSpec(v); toast.info("onChange", { description: `${v} · ${opt?.label}` }) }}
                placeholder="— เลือกชนิดข้าว —"
                ariaLabel="ชนิดข้าว"
                onEnterNext={() => nextFieldRef.current?.focus()}
              />
            </div>
            <div>
              <label htmlFor="kit-combo-pay" className={labelCls}>วิธีชำระเงิน (3 รายการ → ไม่มี search; error state)</label>
              <ComboBox id="kit-combo-pay" title="วิธีชำระเงิน" options={PAYMENTS} value={payment} onChange={(v) => setPayment(v)} placeholder="— เลือก —" ariaLabel="วิธีชำระเงิน" error={!payment} searchable={false} />
            </div>
            <div>
              <label htmlFor="kit-next" className={labelCls}>field ถัดไป (รับ focus จาก onEnterNext)</label>
              <input id="kit-next" ref={nextFieldRef} className={baseField} placeholder="focus มาที่นี่หลัง Enter บน desktop" />
            </div>
            <div>
              <label htmlFor="kit-combo-dis" className={labelCls}>disabled</label>
              <ComboBox id="kit-combo-dis" options={BRANCHES} value="" onChange={() => {}} placeholder="— กำลังโหลด… —" ariaLabel="สาขา" disabled />
            </div>
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            <button type="button" className={neutralBtnCls} onClick={() => comboRef.current?.focus()}>ref.focus()</button>
            <button type="button" className={neutralBtnCls} onClick={() => comboRef.current?.open()}>ref.open()</button>
          </div>
        </Section>

        {/* ── SearchField ───────────────────────────────────────────── */}
        <Section id="search" title="SearchField" note="desktop: ผลลัพธ์ portaled; <md: inline ใต้ช่อง (keyboard ไม่หุบ). minChars=2, ↑↓ Enter Esc">
          <label htmlFor="kit-search" className={labelCls}>ค้นหาสมาชิก (เลขบัตร / รหัส / ชื่อ)</label>
          <SearchField
            id="kit-search"
            value={q}
            onChange={(v) => { setQ(v); setHi(v.trim().length >= 2 ? 0 : -1) }}
            placeholder="พิมพ์อย่างน้อย 2 ตัวอักษร เช่น สม"
            loading={searching}
            results={hits}
            highlightedIndex={hi}
            onHighlight={setHi}
            onPick={(m) => { setPicked(m); setQ(""); setHi(-1) }}
            listId="kit-member-results"
            emptyText="ไม่พบสมาชิก"
            renderResult={(m) => (
              <div className="flex items-baseline justify-between gap-3">
                <span className="truncate font-medium">{m.name}</span>
                <span className="shrink-0 text-xs tabular-nums text-gray-500 dark:text-gray-400">{m.memberId} · {m.id}</span>
              </div>
            )}
          />
          {picked && (
            <dl className="mt-3 grid grid-cols-2 gap-2 rounded-2xl bg-gray-50 p-3 text-sm dark:bg-gray-900/40">
              <dt className="text-gray-500 dark:text-gray-400">ชื่อ</dt><dd className="font-medium">{picked.name}</dd>
              <dt className="text-gray-500 dark:text-gray-400">รหัสสมาชิก</dt><dd className="font-medium tabular-nums">{picked.memberId}</dd>
              <dt className="text-gray-500 dark:text-gray-400">หมู่บ้าน</dt><dd className="font-medium">{picked.village}</dd>
            </dl>
          )}
        </Section>

        {/* ── DataList ──────────────────────────────────────────────── */}
        <Section id="datalist" title="DataList" note="card list แทนตารางบนมือถือ — title/subtitle/badge/fields(dl 2 col, span 2)/actions/onClick(chevron)/loading/empty">
          <div role="radiogroup" aria-label="โหมดตัวอย่าง" className={cx(segmentedCls, "mb-4 max-w-sm")}>
            {[["data", "ข้อมูล"], ["loading", "loading"], ["empty", "empty"]].map(([v, l]) => (
              <button key={v} type="button" role="radio" aria-checked={listMode === v} onClick={() => setListMode(v)} className={cx(segmentedItemCls, listMode === v && segmentedItemActiveCls)}>{l}</button>
            ))}
          </div>
          <DataList
            items={listMode === "empty" ? [] : ORDERS.slice(0, 5)}
            loading={listMode === "loading"}
            keyOf={(o) => o.id}
            title={(o) => o.customer}
            subtitle={(o) => `${o.date} · ${o.orderNo}`}
            badge={(o) => <Badge tone="neutral">{o.branch}</Badge>}
            fields={[
              { label: "ชนิดข้าว", value: "rice", span: 2 },
              { label: "นน.สุทธิ", value: (o) => `${nf(o.netKg)} กก.`, align: "right" },
              { label: "หัก นน.", value: (o) => `${nf(o.deductKg)} กก.`, align: "right" },
              { label: "ราคา/กก.", value: (o) => o.unitPrice.toFixed(2), align: "right" },
              { label: "เป็นเงิน", value: (o) => thb(o.amount), align: "right", emphasis: true },
            ]}
            onClick={(o) => toast.info(`เปิดออเดอร์ ${o.orderNo}`)}
            actions={(o) => (
              <button type="button" className={cx(neutralBtnCls, "h-11")} onClick={() => toast.info(`แก้ไข ${o.orderNo}`)}>แก้ไข</button>
            )}
            emptyState={<EmptyState title="ไม่พบออเดอร์" description="ลองเปลี่ยนช่วงวันที่หรือสาขา" />}
          />
        </Section>

        {/* ── StickyTableScrollbar + ComboBox above it ──────────────── */}
        <Section id="scrollbar" title="StickyTableScrollbar + ComboBox เปิดเหนือ scrollbar" note="desktop: แถบเลื่อนลอย z 10000 — panel ComboBox (10050) ต้องอยู่เหนือและกดเลือกได้; touch: ไม่ render แถบ, scroll native">
          <div className="mb-3 max-w-sm">
            <label htmlFor="kit-combo-bar" className={labelCls}>สาขา (เปิดแล้ว panel ทับ scrollbar ด้านล่าง)</label>
            <ComboBox id="kit-combo-bar" title="สาขา" options={BRANCHES} value={comboOverBar} onChange={(v) => setComboOverBar(v)} placeholder="— เลือกสาขา —" ariaLabel="สาขา" />
          </div>
          <div ref={tableRef} data-testid="wide-table" className="max-h-64 overflow-auto rounded-2xl ring-1 ring-gray-200 dark:ring-gray-700">
            <table className="min-w-[1400px] text-sm">
              <thead className="sticky top-0 bg-gray-50 dark:bg-gray-900">
                <tr>
                  {Array.from({ length: 14 }, (_, c) => (
                    <th key={c} className="whitespace-nowrap px-3 py-2 text-left font-semibold">คอลัมน์ {c + 1}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {Array.from({ length: 20 }, (_, r) => (
                  <tr key={r} className="even:bg-gray-50 dark:even:bg-gray-700/30">
                    {Array.from({ length: 14 }, (_, c) => (
                      <td key={c} className="whitespace-nowrap px-3 py-2 tabular-nums">{nf((r + 1) * (c + 1) * 137)}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <StickyTableScrollbar tableRef={tableRef} />
        </Section>

        {/* ── StickyActionBar ───────────────────────────────────────── */}
        <Section id="actionbar" title="StickyActionBar" note="<md: fixed bottom (portal) + spacer, ซ่อนตอน keyboard เปิด; ≥md inline. ลองพิมพ์ในช่องด้านล่างบนมือถือ">
          <label htmlFor="kit-last" className={labelCls}>ช่องสุดท้ายของฟอร์ม (ต้องเลื่อนขึ้นเหนือ bar ได้)</label>
          <input id="kit-last" data-testid="last-input" inputMode="decimal" className={baseField} placeholder="ราคา/กก." />
          <StickyActionBar
            summary={
              <div className="flex items-baseline justify-between gap-3">
                <span>สุทธิ <b className="tabular-nums">6,850 กก.</b></span>
                <span className="font-semibold tabular-nums">{thb(85625)}</span>
              </div>
            }
            secondary={{ label: "ย้อนกลับ", onClick: () => setStep((s) => Math.max(0, s - 1)) }}
            primary={{ label: "ถัดไป", tone: "primary", onClick: () => toast.success("ถัดไป", { description: "validator ของขั้นผ่าน" }) }}
          />
        </Section>
      </main>
    </div>
  )
}
