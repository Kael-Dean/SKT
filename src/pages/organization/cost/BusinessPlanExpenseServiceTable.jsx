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
const fmtMoney0 = (n) =>
  new Intl.NumberFormat("th-TH", { maximumFractionDigits: 0 }).format(toNumber(n))

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

// ✅ ตามรูปนี้มี 1 คอลัมน์สาขา (ศูนย์โคออม) + รวม
const COLS = [{ key: "center", label: "ศูนย์โคออม" }]

const ROWS = [
  { code: "8", label: "ค่าใช้จ่ายเฉพาะ ธุรกิจบริการ", kind: "section" },

  { code: "8.1", label: "เงินเดือนและค่าจ้าง", kind: "item" },
  { code: "8.2", label: "ค่าเบี้ยเลี้ยงทำงานวันหยุด", kind: "item" },
  { code: "8.3", label: "ค่าเครื่องเขียนแบบพิมพ์", kind: "item" },
  { code: "8.4", label: "ค่าของใช้สำนักงาน", kind: "item" },
  { code: "8.5", label: "ค่าวัสดุสนง.", kind: "item" },
  { code: "8.6", label: "ค่าโทรศัพท์", kind: "item" },
  { code: "8.7", label: "ค่าไฟฟ้า", kind: "item" },
  { code: "8.8", label: "ค่าใช้จ่ายยานพาหนะ", kind: "item" },
  { code: "8.9", label: "ค่าซ่อมแซมบำรุงรักษาครุภัณฑ์", kind: "item" },
  { code: "8.10", label: "ค่าเสื่อมราคาครุภัณฑ์", kind: "item" },
  { code: "8.11", label: "ค่าเสื่อมราคาอาคาร", kind: "item" },
  { code: "8.12", label: "ค่าป้ายหนัง จนท", kind: "item" },
  { code: "8.13", label: "ค่าตกแต่งภูมิทัศน์", kind: "item" },
  { code: "8.14", label: "สวัสดิการจนท.", kind: "item" },
  { code: "8.15", label: "ค่าน้ำมันเชื้อเพลิง", kind: "item" },
  { code: "8.16", label: "ค่าตอบแทนประจำตำแหน่ง", kind: "item" },
  { code: "8.17", label: "ค่าใช้จ่ายงานบ้านงานครัว", kind: "item" },
  { code: "8.18", label: "ค่าเบี้ยประกันภัย", kind: "item" },
  { code: "8.19", label: "ค่าซ่อมแซมบำรุงรักษาอาคาร", kind: "item" },
  { code: "8.20", label: "ค่าซ่อมแซมบำรุงรักษายานพาหนะ", kind: "item" },
  { code: "8.21", label: "ค่าธรรมเนียมในการโอนเงิน", kind: "item" },

  // ✅ ในรูป “ข้าม 8.22”
  { code: "8.23", label: "เงินสมทบกองทุนประกันสังคม", kind: "item" },
  { code: "8.24", label: "ค่าภาษีโรงเรือน", kind: "item" },
  { code: "8.25", label: "ค่าของขวัญสมาคม", kind: "item" },
  { code: "8.26", label: "ค่าจ้างทำความสะอาด สนง.", kind: "item" },
  { code: "8.27", label: "ค่าใช้จ่ายเบ็ดเตล็ด", kind: "item" },
]

function buildInitialValues() {
  const out = {}
  ROWS.forEach((r) => {
    if (r.kind !== "item") return
    out[r.code] = { center: "" }
  })
  return out
}

/** lock width ให้ตรงกันทุกส่วน */
const COL_W = { code: 72, item: 420, cell: 180, total: 140 }
const LEFT_W = COL_W.code + COL_W.item
const RIGHT_W = COLS.length * COL_W.cell + COL_W.total
const TOTAL_W = LEFT_W + RIGHT_W

const STRIPE = {
  head: "bg-slate-100/90 dark:bg-slate-700/70",
  cell: "bg-white dark:bg-slate-900",
  alt: "bg-slate-50 dark:bg-slate-800",
  foot: "bg-emerald-100/55 dark:bg-emerald-900/20",
}

const BusinessPlanExpenseServiceTable = () => {
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

  /** ✅ เก็บ scrollLeft ของ body เพื่อให้ footer ขวาเลื่อนตาม 1:1 */
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

  /** ================== ✅ Arrow navigation + auto scroll ================== */
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
      const row = { ...(next[code] || { center: "" }) }
      row[colKey] = nextValue
      next[code] = row
      return next
    })
  }

  const computed = useMemo(() => {
    const rowTotal = {}
    const colTotal = { center: 0 }
    let grand = 0

    itemRows.forEach((r) => {
      const v = valuesByCode[r.code] || { center: 0 }
      const a = toNumber(v.center)
      const sum = a

      rowTotal[r.code] = { center: a, total: sum }
      colTotal.center += a
      grand += sum
    })

    return { rowTotal, colTotal, grand }
  }, [valuesByCode, itemRows])

  const resetAll = () => {
    if (!confirm("ล้างข้อมูลที่กรอกทั้งหมด?")) return
    setValuesByCode(buildInitialValues())
  }

  const payload = useMemo(() => {
    return {
      table_code: "BUSINESS_PLAN_EXPENSES_SERVICE",
      table_name: "ค่าใช้จ่ายเฉพาะ ธุรกิจบริการ",
      period,
      columns: [...COLS.map((c) => ({ key: c.key, label: c.label })), { key: "total", label: "รวม" }],
      rows: ROWS.map((r) => {
        if (r.kind !== "item") return { code: r.code, label: r.label, kind: r.kind }
        const t = computed.rowTotal[r.code] || { center: 0, total: 0 }
        return {
          code: r.code,
          label: r.label,
          kind: r.kind,
          values: { center: t.center, total: t.total },
        }
      }),
      totals: {
        center: computed.colTotal.center,
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

  /** ✅ sticky ซ้ายทึบ + z-index */
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
              <div className="text-lg font-bold">ประมาณการรายได้/ค่าใช้จ่าย</div>
              <div className="mt-1 text-sm text-slate-600 dark:text-slate-300">({period})</div>
              <div className="mt-2 text-base font-extrabold text-slate-900 dark:text-slate-100">
                8) ค่าใช้จ่ายเฉพาะ ธุรกิจบริการ
              </div>
            </div>

            <div className="mt-4 grid gap-3 md:grid-cols-3">
              <div className="md:col-span-2">
                <label className="mb-1 block text-sm text-slate-700 dark:text-slate-300">
                  ช่วงเวลา (แก้ได้)
                </label>
                <input
                  className={baseField}
                  value={period}
                  onChange={(e) => setPeriod(e.target.value)}
                  placeholder="เช่น 1 เม.ย.68-31 มี.ค.69"
                />
              </div>

              <div className="md:col-span-1">
                <label className="mb-1 block text-sm text-slate-700 dark:text-slate-300">
                  รวมทั้งหมด (บาท)
                </label>
                <div className={cx(baseField, "flex items-center justify-end font-extrabold")}>
                  {fmtMoney0(computed.grand)}
                </div>
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
          <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 p-3 text-xs text-slate-800
                          dark:border-slate-700 dark:bg-slate-900/40 dark:text-slate-100">
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
            <div className="text-base md:text-lg font-bold">ตารางค่าใช้จ่าย (กรอกได้)</div>
            <div className="text-sm text-slate-600 dark:text-slate-300">
              * พิมพ์ตัวเลขได้เลย (Arrow keys วิ่งข้ามช่องได้)
            </div>
          </div>
        </div>

        {/* BODY scroll */}
        <div
          ref={bodyScrollRef}
          onScroll={onBodyScroll}
          className="flex-1 overflow-auto border-t border-slate-200 dark:border-slate-700"
        >
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
                <th
                  rowSpan={2}
                  className={cx(
                    "border border-slate-300 px-2 py-2 text-center font-bold dark:border-slate-600",
                    stickyCodeHeader
                  )}
                />
                <th
                  rowSpan={2}
                  className={cx(
                    "border border-slate-300 px-3 py-2 text-left font-bold dark:border-slate-600",
                    stickyLeftHeader,
                    "left-[72px]"
                  )}
                  style={{ left: COL_W.code }}
                >
                  รายการ
                </th>

                <th
                  colSpan={COLS.length + 1}
                  className="border border-slate-300 px-3 py-2 text-center font-extrabold dark:border-slate-600"
                >
                  สกต.สาขา
                </th>
              </tr>

              <tr className={cx("text-slate-800 dark:text-slate-100", STRIPE.head)}>
                {COLS.map((c) => (
                  <th
                    key={c.key}
                    className="border border-slate-300 px-2 py-2 text-center text-xs md:text-sm dark:border-slate-600"
                  >
                    {c.label}
                  </th>
                ))}
                <th className="border border-slate-300 px-2 py-2 text-center text-xs md:text-sm font-extrabold dark:border-slate-600">
                  รวม
                </th>
              </tr>
            </thead>

            <tbody>
              {ROWS.map((r) => {
                if (r.kind === "section") {
                  return (
                    <tr key={r.code} className="bg-slate-200/70 dark:bg-slate-700/55">
                      <td
                        className={cx(
                          "border border-slate-300 px-2 py-2 text-center font-bold dark:border-slate-600",
                          stickyCodeCell,
                          "bg-slate-200/70 dark:bg-slate-700/55"
                        )}
                      >
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
                const rowBg = idx % 2 === 1 ? STRIPE.alt : STRIPE.cell
                const t = computed.rowTotal[r.code] || { center: 0, total: 0 }

                return (
                  <tr key={r.code} className={rowBg}>
                    <td
                      className={cx(
                        "border border-slate-300 px-2 py-2 text-center text-xs md:text-sm dark:border-slate-600",
                        stickyCodeCell,
                        rowBg
                      )}
                    >
                      {r.code}
                    </td>

                    <td
                      className={cx(
                        "border border-slate-300 px-3 py-2 text-left font-semibold dark:border-slate-600",
                        "sticky z-[50]",
                        rowBg
                      )}
                      style={{ left: COL_W.code }}
                    >
                      {r.label}
                    </td>

                    {COLS.map((c, colIdx) => (
                      <td key={`${r.code}-${c.key}`} className="border border-slate-300 px-2 py-2 dark:border-slate-600">
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
                      </td>
                    ))}

                    <td className="border border-slate-300 px-2 py-2 text-right font-extrabold dark:border-slate-600">
                      {fmtMoney0(t.total)}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>

        {/* FOOTER totals (sync horizontal) */}
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
                    <td className="border border-slate-200 px-3 py-2 dark:border-slate-700 text-center">รวม</td>
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
                      <td className="border border-slate-200 px-2 py-2 text-right dark:border-slate-700">
                        {fmtMoney0(computed.colTotal.center)}
                      </td>
                      <td className="border border-slate-200 px-2 py-2 text-right dark:border-slate-700">
                        {fmtMoney0(computed.grand)}
                      </td>
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

export default BusinessPlanExpenseServiceTable
