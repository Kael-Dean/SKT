import { useCallback, useEffect, useMemo, useRef, useState } from "react"

/** ---------------- Utils ---------------- */
const cx = (...a) => a.filter(Boolean).join(" ")
const toNumber = (v) => {
  if (v === "" || v === null || v === undefined) return 0
  const n = Number(String(v).replace(/,/g, ""))
  return Number.isFinite(n) ? n : 0
}
const sanitizeNumberInput = (s) => {
  const cleaned = String(s ?? "").replace(/[^\d.]/g, "")
  const parts = cleaned.split(".")
  if (parts.length <= 2) return cleaned
  return `${parts[0]}.${parts.slice(1).join("")}`
}
const fmtMoney0 = (n) => new Intl.NumberFormat("th-TH", { maximumFractionDigits: 0 }).format(toNumber(n))

/** ---------------- UI styles ---------------- */
const baseField =
  "w-full rounded-2xl border border-slate-300 bg-slate-100 p-3 text-[15px] md:text-base " +
  "text-black outline-none placeholder:text-slate-500 focus:border-emerald-600 focus:ring-2 focus:ring-emerald-500/30 shadow-none " +
  "dark:border-slate-500/40 dark:bg-slate-700/80 dark:text-slate-100 dark:placeholder:text-slate-300 dark:focus:border-emerald-400 dark:focus:ring-emerald-400/30"

const cellInput =
  "w-full min-w-0 max-w-full box-border rounded-lg border border-slate-300 bg-white px-2 py-1 " +
  "text-right text-[13px] md:text-sm outline-none " +
  "focus:border-emerald-600 focus:ring-2 focus:ring-emerald-500/20 " +
  "dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100"

/** ---------------- Table definition ---------------- */
const PERIOD_DEFAULT = "1 เม.ย.68-31 มี.ค.69"

const COLS = [
  { key: "hq", label: "สาขา" },
  { key: "surin", label: "สุรินทร์" },
  { key: "nonnarai", label: "โนนนารายณ์" },
]

/**
 * หมายเหตุ: รายการถอดตามรูปที่ส่งมา (บางคำอาจต่างเล็กน้อย)
 * โครง/ฟังก์ชันเหมือนตารางเดิมทุกอย่าง
 */
const ROWS = [
  { code: "REV", label: "ประมาณการ รายได้เฉพาะธุรกิจ", kind: "title" },

  { code: "1", label: "รายได้เฉพาะ ธุรกิจจัดหา", kind: "section" },
  { code: "1.1", label: "ค่าตอบแทนจัดหาวัสดุ", kind: "item" },
  { code: "1.2", label: "รายได้จากส่งเสริมการขาย", kind: "item" },
  { code: "1.3", label: "ดอกเบี้ยรับ-ลูกหนี้การค้า", kind: "item" },
  { code: "1.4", label: "กำไรจากการตีราคาสินค้าเพิ่มขึ้น", kind: "item" },
  { code: "1.5", label: "รางวัล สกต.ดีเด่น", kind: "item" },
  { code: "1.6", label: "รายได้เบ็ดเตล็ด", kind: "item" },
  { code: "1.T", label: "รวมธุรกิจจัดหา", kind: "subtotal" },

  { code: "2", label: "รายได้เฉพาะ ธุรกิจจัดหา-ปั๊มน้ำมัน", kind: "section" },
  { code: "2.1", label: "รางวัลคุณภาพ", kind: "item" },
  { code: "2.2", label: "รายได้ค่าส่งเสริมการขาย", kind: "item" },
  { code: "2.3", label: "รายได้ค่าบริการสมาชิก", kind: "item" },
  { code: "2.4", label: "รายได้เบ็ดเตล็ด", kind: "item" },
  { code: "2.T", label: "รวมธุรกิจจัดหา-ปั๊มน้ำมัน", kind: "subtotal" },

  { code: "3", label: "รายได้เฉพาะธุรกิจรวบรวม", kind: "section" },
  { code: "3.1", label: "รายได้จากบริการ", kind: "item" },
  { code: "3.2", label: "รายได้จากการชะลอ", kind: "item" },
  { code: "3.3", label: "รายได้จากการส่งออกคุณภาพข้าวเปลือก", kind: "item" },
  { code: "3.4", label: "รายได้จากกระสอบ", kind: "item" },
  { code: "3.5", label: "รายได้ค่าบริการตลาดกลาง", kind: "item" },
  { code: "3.6", label: "เงินชดเชยดอกเบี้ยประกัน", kind: "item" },
  { code: "3.7", label: "รายได้เงินอุดหนุน", kind: "item" },
  { code: "3.8", label: "รายได้เบ็ดเตล็ด", kind: "item" },
  { code: "3.T", label: "รวมธุรกิจรวบรวม", kind: "subtotal" },

  { code: "4", label: "รายได้เฉพาะ ธุรกิจแปรรูป", kind: "section" },
  { code: "4.1", label: "กำไรจากการตีราคาสินค้าเพิ่มขึ้น", kind: "item" },
  { code: "4.2", label: "ดอกเบี้ยเงินฝาก", kind: "item" },
  { code: "4.3", label: "รายได้รถบรรทุก", kind: "item" },
  { code: "4.4", label: "รายได้โครงการชะลอ", kind: "item" },
  { code: "4.5", label: "รายได้จากการรับจ้างสี", kind: "item" },
  { code: "4.6", label: "รายได้จากกระสอบ", kind: "item" },
  { code: "4.7", label: "เงินชดเชยดอกเบี้ยประกัน", kind: "item" },
  { code: "4.8", label: "รายได้เงินอุดหนุน-การจำหน่ายข้าวสาร", kind: "item" },
  { code: "4.9", label: "รายได้เงินอุดหนุน-ซื้อเครื่องจักร", kind: "item" },
  { code: "4.10", label: "รายได้จากการตรวจสอบคุณภาพข้าวเปลือก", kind: "item" },
  { code: "4.11", label: "รายได้เบ็ดเตล็ด", kind: "item" },
  { code: "4.T", label: "รวมธุรกิจแปรรูป", kind: "subtotal" },

  { code: "5", label: "รายได้เฉพาะ ธุรกิจแปรรูป-เมล็ดพันธุ์", kind: "section" },
  { code: "5.1", label: "เมล็ดพันธุ์ขาดบัญชีได้รับชดใช้", kind: "item" },
  { code: "5.2", label: "รายได้รถบรรทุก", kind: "item" },
  { code: "5.3", label: "รายได้โครงการชะลอ", kind: "item" },
  { code: "5.4", label: "รายได้เงินอุดหนุนจากการผลิตเมล็ดพันธุ์", kind: "item" },
  { code: "5.5", label: "รายได้เกษตรกร", kind: "item" },
  { code: "5.6", label: "กำไรจากการตีราคาสินค้าเพิ่มขึ้น", kind: "item" },
  { code: "5.7", label: "รายได้เบ็ดเตล็ด", kind: "item" },
  { code: "5.T", label: "รวมธุรกิจแปรรูป-เมล็ดพันธุ์", kind: "subtotal" },

  { code: "6", label: "รายได้ศูนย์โคออม", kind: "section" },
  { code: "6.1", label: "ดอกเบี้ยเงินฝาก", kind: "item" },
  { code: "6.2", label: "รายได้ค่าจัดการ", kind: "item" },
  { code: "6.3", label: "รายได้เบ็ดเตล็ด", kind: "item" },
  { code: "6.T", label: "รวมศูนย์โคออม", kind: "subtotal" },

  { code: "G.T", label: "รวมรายได้", kind: "grandtotal" },
]

function buildInitialValues() {
  const out = {}
  ROWS.forEach((r) => {
    if (r.kind !== "item") return
    out[r.code] = { hq: "", surin: "", nonnarai: "" }
  })
  return out
}

/** lock width ให้ตรงกันทุกส่วน */
const COL_W = { code: 72, item: 420, cell: 120, total: 120 }
const LEFT_W = COL_W.code + COL_W.item
const RIGHT_W = COLS.length * COL_W.cell + COL_W.total
const TOTAL_W = LEFT_W + RIGHT_W

const STRIPE = {
  head: "bg-slate-100/90 dark:bg-slate-700/70",
  cell: "bg-white dark:bg-slate-900",
  alt: "bg-slate-50 dark:bg-slate-800",
  foot: "bg-emerald-100/55 dark:bg-emerald-900/20",
}

const BusinessPlanRevenueByBusinessTable = () => {
  const [period, setPeriod] = useState(PERIOD_DEFAULT)
  const [valuesByCode, setValuesByCode] = useState(() => buildInitialValues())
  const [showPayload, setShowPayload] = useState(false)

  /** ✅ ขยายความสูงตารางให้มากขึ้น */
  const tableCardRef = useRef(null)
  const [tableCardHeight, setTableCardHeight] = useState(900)

  const recalcTableCardHeight = useCallback(() => {
    const el = tableCardRef.current
    if (!el) return
    const rect = el.getBoundingClientRect()
    const vh = window.innerHeight || 900
    const bottomPadding = 6
    const h = Math.max(860, Math.floor(vh - rect.top - bottomPadding))
    setTableCardHeight(h)
  }, [])

  useEffect(() => {
    recalcTableCardHeight()
    window.addEventListener("resize", recalcTableCardHeight)
    return () => window.removeEventListener("resize", recalcTableCardHeight)
  }, [recalcTableCardHeight])

  useEffect(() => {
    requestAnimationFrame(() => recalcTableCardHeight())
  }, [showPayload, period, recalcTableCardHeight])

  /** ✅ sync footer with horizontal scroll */
  const bodyScrollRef = useRef(null)
  const [scrollLeft, setScrollLeft] = useState(0)
  const rafRef = useRef(0)

  const onBodyScroll = () => {
    const b = bodyScrollRef.current
    if (!b) return
    const x = b.scrollLeft || 0
    if (rafRef.current) cancelAnimationFrame(rafRef.current)
    rafRef.current = requestAnimationFrame(() => setScrollLeft(x))
  }

  useEffect(() => {
    requestAnimationFrame(() => {
      const b = bodyScrollRef.current
      if (b) setScrollLeft(b.scrollLeft || 0)
    })
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current)
    }
  }, [])

  /** ================== ✅ Arrow navigation ================== */
  const inputRefs = useRef(new Map())
  const itemRows = useMemo(() => ROWS.filter((r) => r.kind === "item"), [])
  const totalCols = COLS.length

  const registerInput = useCallback((row, col) => {
    const key = `${row}|${col}`
    return (el) => {
      if (!el) inputRefs.current.delete(key)
      else inputRefs.current.set(key, el)
    }
  }, [])

  const ensureInView = useCallback((el) => {
    const container = bodyScrollRef.current
    if (!container || !el) return
    const pad = 12
    const frozenLeft = LEFT_W
    const crect = container.getBoundingClientRect()
    const erect = el.getBoundingClientRect()

    const visibleLeft = crect.left + frozenLeft + pad
    const visibleRight = crect.right - pad
    const visibleTop = crect.top + pad
    const visibleBottom = crect.bottom - pad

    if (erect.left < visibleLeft) container.scrollLeft -= visibleLeft - erect.left
    else if (erect.right > visibleRight) container.scrollLeft += erect.right - visibleRight

    if (erect.top < visibleTop) container.scrollTop -= visibleTop - erect.top
    else if (erect.bottom > visibleBottom) container.scrollTop += erect.bottom - visibleBottom
  }, [])

  const handleArrowNav = useCallback(
    (e) => {
      const k = e.key
      if (!["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"].includes(k)) return

      const row = Number(e.currentTarget.dataset.row ?? 0)
      const col = Number(e.currentTarget.dataset.col ?? 0)

      let nextRow = row
      let nextCol = col

      if (k === "ArrowLeft") nextCol = col - 1
      if (k === "ArrowRight") nextCol = col + 1
      if (k === "ArrowUp") nextRow = row - 1
      if (k === "ArrowDown") nextRow = row + 1

      if (nextRow < 0) nextRow = 0
      if (nextRow > itemRows.length - 1) nextRow = itemRows.length - 1
      if (nextCol < 0) nextCol = 0
      if (nextCol > totalCols - 1) nextCol = totalCols - 1

      const target = inputRefs.current.get(`${nextRow}|${nextCol}`)
      if (!target) return

      e.preventDefault()
      target.focus()
      try {
        target.select()
      } catch {}
      requestAnimationFrame(() => ensureInView(target))
    },
    [ensureInView, itemRows.length, totalCols]
  )
  /** ===================================================================== */

  const setCell = (code, colKey, nextValue) => {
    setValuesByCode((prev) => {
      const next = { ...prev }
      const row = { ...(next[code] || { hq: "", surin: "", nonnarai: "" }) }
      row[colKey] = nextValue
      next[code] = row
      return next
    })
  }

  const sumCodes = (codes) => {
    let hq = 0,
      surin = 0,
      nonnarai = 0
    codes.forEach((c) => {
      const v = valuesByCode[c] || { hq: 0, surin: 0, nonnarai: 0 }
      hq += toNumber(v.hq)
      surin += toNumber(v.surin)
      nonnarai += toNumber(v.nonnarai)
    })
    return { hq, surin, nonnarai, total: hq + surin + nonnarai }
  }

  const sectionMap = useMemo(
    () => ({
      "1.T": ["1.1", "1.2", "1.3", "1.4", "1.5", "1.6"],
      "2.T": ["2.1", "2.2", "2.3", "2.4"],
      "3.T": ["3.1", "3.2", "3.3", "3.4", "3.5", "3.6", "3.7", "3.8"],
      "4.T": ["4.1", "4.2", "4.3", "4.4", "4.5", "4.6", "4.7", "4.8", "4.9", "4.10", "4.11"],
      "5.T": ["5.1", "5.2", "5.3", "5.4", "5.5", "5.6", "5.7"],
      "6.T": ["6.1", "6.2", "6.3"],
    }),
    []
  )

  const computed = useMemo(() => {
    const rowTotal = {}

    // item rows
    itemRows.forEach((r) => {
      const v = valuesByCode[r.code] || { hq: 0, surin: 0, nonnarai: 0 }
      const a = toNumber(v.hq)
      const b = toNumber(v.surin)
      const c = toNumber(v.nonnarai)
      rowTotal[r.code] = { hq: a, surin: b, nonnarai: c, total: a + b + c }
    })

    // subtotals
    Object.keys(sectionMap).forEach((k) => {
      rowTotal[k] = sumCodes(sectionMap[k])
    })

    // grand total
    const allItems = Object.values(sectionMap).flat()
    rowTotal["G.T"] = sumCodes(allItems)

    const colTotal = { hq: rowTotal["G.T"].hq, surin: rowTotal["G.T"].surin, nonnarai: rowTotal["G.T"].nonnarai }
    const grand = rowTotal["G.T"].total

    return { rowTotal, colTotal, grand }
  }, [valuesByCode, itemRows, sectionMap])

  const resetAll = () => {
    if (!confirm("ล้างข้อมูลที่กรอกทั้งหมด?")) return
    setValuesByCode(buildInitialValues())
  }

  const payload = useMemo(() => {
    return {
      table_code: "BUSINESS_PLAN_REVENUE_BY_BUSINESS",
      table_name: "รายได้เฉพาะธุรกิจ",
      period,
      columns: [...COLS.map((c) => ({ key: c.key, label: c.label })), { key: "total", label: "รวม" }],
      rows: ROWS.map((r) => {
        const t = computed.rowTotal[r.code]
        if (!t) return { code: r.code, label: r.label, kind: r.kind }
        return {
          code: r.code,
          label: r.label,
          kind: r.kind,
          values: { hq: t.hq, surin: t.surin, nonnarai: t.nonnarai, total: t.total },
        }
      }),
      totals: {
        hq: computed.colTotal.hq,
        surin: computed.colTotal.surin,
        nonnarai: computed.colTotal.nonnarai,
        total: computed.grand,
      },
    }
  }, [period, computed])

  const copyPayload = async () => {
    try {
      await navigator.clipboard.writeText(JSON.stringify(payload, null, 2))
      alert("คัดลอก JSON payload แล้ว ✅")
    } catch (e) {
      console.error(e)
      alert("คัดลอกไม่สำเร็จ — เปิด payload แล้ว copy เองได้ครับ")
      setShowPayload(true)
    }
  }

  const stickyLeftHeader =
    "sticky left-0 z-[90] bg-slate-100 dark:bg-slate-700 shadow-[2px_0_0_rgba(0,0,0,0.06)]"
  const stickyCodeHeader =
    "sticky left-0 z-[95] bg-slate-100 dark:bg-slate-700 shadow-[2px_0_0_rgba(0,0,0,0.06)]"
  const stickyCodeCell = "sticky left-0 z-[70] shadow-[2px_0_0_rgba(0,0,0,0.06)]"

  return (
    <div className="space-y-3">
      {/* Header */}
      <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-800">
        <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
          <div className="flex-1">
            <div className="text-center md:text-left">
              <div className="text-lg font-bold">ประมาณการรายได้เฉพาะธุรกิจ</div>
              <div className="mt-1 text-sm text-slate-600 dark:text-slate-300">({period})</div>
            </div>

            <div className="mt-4 grid gap-3 md:grid-cols-3">
              <div className="md:col-span-2">
                <label className="mb-1 block text-sm text-slate-700 dark:text-slate-300">ช่วงเวลา (แก้ได้)</label>
                <input className={baseField} value={period} onChange={(e) => setPeriod(e.target.value)} />
              </div>

              <div className="md:col-span-1">
                <label className="mb-1 block text-sm text-slate-700 dark:text-slate-300">รวมรายได้ (บาท)</label>
                <div className={cx(baseField, "flex items-center justify-end font-extrabold")}>{fmtMoney0(computed.grand)}</div>
              </div>
            </div>
          </div>

          <div className="flex flex-wrap gap-2 md:justify-end">
            <button
              type="button"
              onClick={copyPayload}
              className="inline-flex items-center justify-center rounded-2xl bg-emerald-600 px-5 py-3 text-sm font-semibold text-white
                         shadow-[0_6px_16px_rgba(16,185,129,0.35)]
                         hover:bg-emerald-700 hover:scale-[1.03] active:scale-[.98] transition cursor-pointer"
            >
              คัดลอก JSON
            </button>

            <button
              type="button"
              onClick={() => setShowPayload((v) => !v)}
              className="inline-flex items-center justify-center rounded-2xl border border-slate-300 bg-white px-5 py-3 text-sm font-semibold text-slate-800
                         hover:bg-slate-100 hover:scale-[1.02] active:scale-[.98] transition cursor-pointer
                         dark:border-slate-600 dark:bg-slate-700/60 dark:text-white dark:hover:bg-slate-700/40"
            >
              {showPayload ? "ซ่อน payload" : "ดู payload"}
            </button>

            <button
              type="button"
              onClick={resetAll}
              className="inline-flex items-center justify-center rounded-2xl border border-slate-300 bg-white px-5 py-3 text-sm font-semibold text-slate-800
                         hover:bg-slate-100 hover:scale-[1.02] active:scale-[.98] transition cursor-pointer
                         dark:border-slate-600 dark:bg-slate-700/60 dark:text-white dark:hover:bg-slate-700/40"
            >
              ล้างข้อมูล
            </button>
          </div>
        </div>

        {showPayload && (
          <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 p-3 text-xs text-slate-800 dark:border-slate-700 dark:bg-slate-900/40 dark:text-slate-100">
            <pre className="max-h-72 overflow-auto">{JSON.stringify(payload, null, 2)}</pre>
          </div>
        )}
      </div>

      {/* Table Card */}
      <div
        ref={tableCardRef}
        className="rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-700 dark:bg-slate-800 overflow-hidden flex flex-col"
        style={{ height: tableCardHeight }}
      >
        <div className="p-2 md:p-3 shrink-0">
          <div className="flex flex-col gap-1 md:flex-row md:items-center md:justify-between">
            <div className="text-base md:text-lg font-bold">ตารางรายได้ (กรอกได้)</div>
            <div className="text-sm text-slate-600 dark:text-slate-300">* Arrow keys วิ่งข้ามช่องได้</div>
          </div>
        </div>

        <div ref={bodyScrollRef} onScroll={onBodyScroll} className="flex-1 overflow-auto border-t border-slate-200 dark:border-slate-700">
          <table className="border-collapse text-sm" style={{ width: TOTAL_W, tableLayout: "fixed" }}>
            <colgroup>
              <col style={{ width: COL_W.code }} />
              <col style={{ width: COL_W.item }} />
              {COLS.map((c) => (
                <col key={c.key} style={{ width: COL_W.cell }} />
              ))}
              <col style={{ width: COL_W.total }} />
            </colgroup>

            <thead className="sticky top-0 z-[80]">
              <tr className={cx("text-slate-800 dark:text-slate-100", STRIPE.head)}>
                <th rowSpan={2} className={cx("border border-slate-300 px-2 py-2 text-center font-bold dark:border-slate-600", stickyCodeHeader)} />
                <th
                  rowSpan={2}
                  className={cx("border border-slate-300 px-3 py-2 text-left font-bold dark:border-slate-600", stickyLeftHeader, "left-[72px]")}
                  style={{ left: COL_W.code }}
                >
                  รายการ
                </th>

                <th colSpan={COLS.length + 1} className="border border-slate-300 px-3 py-2 text-center font-extrabold dark:border-slate-600">
                  สกต. สาขา
                </th>
              </tr>

              <tr className={cx("text-slate-800 dark:text-slate-100", STRIPE.head)}>
                {COLS.map((c) => (
                  <th key={c.key} className="border border-slate-300 px-2 py-2 text-center text-xs md:text-sm dark:border-slate-600">
                    {c.label}
                  </th>
                ))}
                <th className="border border-slate-300 px-2 py-2 text-center text-xs md:text-sm font-extrabold dark:border-slate-600">รวม</th>
              </tr>
            </thead>

            <tbody>
              {ROWS.map((r) => {
                const t = computed.rowTotal[r.code]

                if (r.kind === "title") {
                  return (
                    <tr key={r.code} className="bg-slate-200/70 dark:bg-slate-700/55">
                      <td className={cx("border border-slate-300 px-2 py-2 text-center font-bold dark:border-slate-600", stickyCodeCell)} />
                      <td
                        colSpan={COLS.length + 2}
                        className={cx(
                          "border border-slate-300 px-3 py-2 font-extrabold dark:border-slate-600",
                          "sticky left-[72px] z-[55] bg-slate-200/70 dark:bg-slate-700/55"
                        )}
                        style={{ left: COL_W.code }}
                      >
                        {r.label}
                      </td>
                    </tr>
                  )
                }

                if (r.kind === "section") {
                  return (
                    <tr key={r.code} className="bg-slate-200/70 dark:bg-slate-700/55">
                      <td className={cx("border border-slate-300 px-2 py-2 text-center font-bold dark:border-slate-600", stickyCodeCell)}>
                        {r.code}
                      </td>
                      <td
                        colSpan={COLS.length + 2}
                        className={cx(
                          "border border-slate-300 px-3 py-2 font-extrabold dark:border-slate-600",
                          "sticky left-[72px] z-[55] bg-slate-200/70 dark:bg-slate-700/55"
                        )}
                        style={{ left: COL_W.code }}
                      >
                        {r.label}
                      </td>
                    </tr>
                  )
                }

                const idx = itemRows.findIndex((x) => x.code === r.code)
                const isSubtotal = r.kind === "subtotal"
                const isGrand = r.kind === "grandtotal"

                const rowBg = idx % 2 === 1 ? STRIPE.alt : STRIPE.cell
                const rowCls = isGrand ? "bg-emerald-200/60 dark:bg-emerald-900/35" : isSubtotal ? "bg-emerald-50 dark:bg-emerald-900/20" : rowBg
                const font = isGrand || isSubtotal ? "font-extrabold" : "font-semibold"

                return (
                  <tr key={r.code} className={rowCls}>
                    <td className={cx("border border-slate-300 px-2 py-2 text-center text-xs md:text-sm dark:border-slate-600", stickyCodeCell, rowCls, font)}>
                      {isSubtotal || isGrand ? "" : r.code}
                    </td>

                    <td
                      className={cx("border border-slate-300 px-3 py-2 text-left dark:border-slate-600", "sticky z-[50]", rowCls, font)}
                      style={{ left: COL_W.code }}
                    >
                      {r.label}
                    </td>

                    {COLS.map((c, colIdx) => (
                      <td key={`${r.code}-${c.key}`} className="border border-slate-300 px-2 py-2 dark:border-slate-600">
                        {r.kind === "item" ? (
                          <input
                            ref={registerInput(idx, colIdx)}
                            data-row={idx}
                            data-col={colIdx}
                            onKeyDown={handleArrowNav}
                            className={cellInput}
                            value={valuesByCode?.[r.code]?.[c.key] ?? ""}
                            inputMode="numeric"
                            placeholder="0"
                            onChange={(e) => setCell(r.code, c.key, sanitizeNumberInput(e.target.value))}
                          />
                        ) : (
                          <div className={cx("text-right", font)}>{fmtMoney0(t?.[c.key] ?? 0)}</div>
                        )}
                      </td>
                    ))}

                    <td className={cx("border border-slate-300 px-2 py-2 text-right dark:border-slate-600", font)}>
                      {fmtMoney0(t?.total ?? 0)}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>

        {/* FOOTER totals */}
        <div className="shrink-0 border-t border-slate-200 dark:border-slate-700 bg-emerald-50 dark:bg-emerald-900/20">
          <div className="flex w-full">
            <div className="shrink-0" style={{ width: LEFT_W }}>
              <table className="border-collapse text-sm" style={{ width: LEFT_W, tableLayout: "fixed" }}>
                <colgroup>
                  <col style={{ width: COL_W.code }} />
                  <col style={{ width: COL_W.item }} />
                </colgroup>
                <tbody>
                  <tr className={cx("font-extrabold text-slate-900 dark:text-emerald-100", STRIPE.foot)}>
                    <td className="border border-slate-200 px-2 py-2 text-center dark:border-slate-700" />
                    <td className="border border-slate-200 px-3 py-2 dark:border-slate-700 text-center">รวมรายได้</td>
                  </tr>
                </tbody>
              </table>
            </div>

            <div className="flex-1 overflow-hidden">
              <div style={{ width: RIGHT_W, transform: `translateX(-${scrollLeft}px)`, willChange: "transform" }}>
                <table className="border-collapse text-sm" style={{ width: RIGHT_W, tableLayout: "fixed" }}>
                  <colgroup>
                    {COLS.map((c) => (
                      <col key={`f-${c.key}`} style={{ width: COL_W.cell }} />
                    ))}
                    <col style={{ width: COL_W.total }} />
                  </colgroup>
                  <tbody>
                    <tr className={cx("font-extrabold text-slate-900 dark:text-emerald-100", STRIPE.foot)}>
                      <td className="border border-slate-200 px-2 py-2 text-right dark:border-slate-700">{fmtMoney0(computed.colTotal.hq)}</td>
                      <td className="border border-slate-200 px-2 py-2 text-right dark:border-slate-700">{fmtMoney0(computed.colTotal.surin)}</td>
                      <td className="border border-slate-200 px-2 py-2 text-right dark:border-slate-700">{fmtMoney0(computed.colTotal.nonnarai)}</td>
                      <td className="border border-slate-200 px-2 py-2 text-right dark:border-slate-700">{fmtMoney0(computed.grand)}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>

        <div className="shrink-0 p-3 md:p-4 text-sm text-slate-600 dark:text-slate-300">
          หมายเหตุ: ตารางนี้เป็น mock สำหรับกรอก/รวมยอด/เตรียม JSON (ยังไม่ผูก BE)
        </div>
      </div>
    </div>
  )
}

export default BusinessPlanRevenueByBusinessTable
