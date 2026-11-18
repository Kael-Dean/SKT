// src/components/reports/PurchaseTotalPanel.jsx
// Live purchase total for the current report filters, shown before printing/downloading.
// The P22 report has no JSON endpoint, so this reads /order/orders/buy-report (same date,
// branch and klang semantics) and repeats the report's amount and species rules on the client.
import { useEffect, useMemo, useRef, useState } from "react"
import { apiAuth } from "../../lib/api"
import { cx, focusRingCls } from "../../lib/styles"
import { nf, thb } from "../hr/positionUtils"

const DEBOUNCE_MS = 400
const FIGURES_MIN_H = "min-h-14" // = primary (h-8) + gap (mt-1) + secondary (h-5): states swap without a jump

const toNumber = (v) => Number(v) || 0

// The report uses COALESCE(price, weight * price_per_kilo); the JSON serialises a null price as 0.
const rowAmount = (row) => {
  const price = toNumber(row.price)
  return price > 0 ? price : toNumber(row.weight) * toNumber(row.price_per_kilo)
}

// The report filters on the species name ("หอมมะลิ"), but buy-report only returns the spec's
// prod_name ("ข้าวเปลือกหอมมะลิสด - CP ปกติ นาปี 2569/2570"). Matching prod_name directly would count
// "สด" or "CP", which the report answers with nothing, so reduce prod_name to its species first.
// Specs can't be mapped by id instead: /order/form/search lists active specs only, and most
// historical purchases sit on inactive ones.
const speciesOf = (prodName, speciesNames) => {
  const name = String(prodName || "").trim().toLowerCase()
  return speciesNames.find((species) => name.includes(species)) ?? name
}

const summarize = (rows, needle, speciesNames) => {
  const totals = { amount: 0, weight: 0, count: 0 }
  for (const row of rows) {
    if (needle && !speciesOf(row.species, speciesNames).includes(needle)) continue
    totals.amount += rowAmount(row)
    totals.weight += toNumber(row.weight)
    totals.count += 1
  }
  return totals
}

// nf() keeps up to 3 decimals, so round first: weights show at most 2.
const formatWeight = (kg) => nf(Math.round(kg * 100) / 100)

// Same rule as the report errors on this page: show Thai backend detail, hide raw English/codes.
const errorMessage = (err) => {
  const raw = String(err?.message || "")
  return /[฀-๿]/.test(raw) ? raw.slice(0, 200) : "โหลดยอดรวมไม่สำเร็จ"
}

const skeletonCls = "animate-pulse rounded bg-emerald-100 motion-reduce:animate-none dark:bg-white/10"

/**
 * @param {string}  query        buy-report query string (without species_like)
 * @param {string}  speciesLike  applied client-side; changing it never refetches
 * @param {string[]|null} speciesNames  every species name; null while loading
 * @param {boolean} speciesFailed  the species list could not be loaded
 * @param {() => void} [onRetrySpecies]  reload the species list
 * @param {boolean} datesInvalid show a hint instead of fetching
 */
export default function PurchaseTotalPanel({
  query,
  speciesLike,
  speciesNames = null,
  speciesFailed = false,
  onRetrySpecies,
  datesInvalid = false,
}) {
  const [attempt, setAttempt] = useState(0)
  const [result, setResult] = useState({ key: null, rows: [], error: "" })
  const latestRequest = useRef(0)

  const needle = String(speciesLike || "").trim().toLowerCase()
  // Longest first, so "ข้าวโพดข้าวเหนียว" wins over "เหนียว".
  const normalizedSpecies = useMemo(
    () => speciesNames && [...new Set(speciesNames.map((n) => String(n || "").trim().toLowerCase()).filter(Boolean))]
      .sort((a, b) => b.length - a.length),
    [speciesNames]
  )
  const speciesError = needle && speciesFailed ? "โหลดรายชื่อพันธุ์ข้าวไม่สำเร็จ" : ""

  // Loading is derived: as soon as the filters differ from the last result, old figures are hidden.
  const requestKey = datesInvalid ? "" : `${query}#${attempt}`
  const speciesPending = !!needle && !normalizedSpecies && !speciesFailed
  const loading = !!requestKey && (result.key !== requestKey || speciesPending)

  useEffect(() => {
    const requestId = ++latestRequest.current // also expires anything in flight when dates turn invalid
    if (!requestKey) return undefined

    const timer = setTimeout(async () => {
      try {
        const data = await apiAuth(`/order/orders/buy-report?${query}`)
        if (requestId !== latestRequest.current) return
        // An unexpected shape must surface as an error, never as a believable 0.00.
        if (!Array.isArray(data)) throw new Error("Unexpected buy-report response")
        setResult({ key: requestKey, rows: data, error: "" })
      } catch (err) {
        if (requestId !== latestRequest.current) return
        console.error(err)
        setResult({ key: requestKey, rows: [], error: errorMessage(err) })
      }
    }, DEBOUNCE_MS)

    return () => clearTimeout(timer)
  }, [requestKey, query])

  const totals = useMemo(
    () => summarize(result.rows, needle, normalizedSpecies || []),
    [result.rows, needle, normalizedSpecies]
  )
  const shownError = result.error || speciesError
  const failed = !loading && !datesInvalid && !!shownError

  return (
    <section
      aria-label="ยอดรับซื้อตามตัวกรอง"
      className="mt-5 rounded-2xl bg-gray-50 p-4 ring-1 ring-inset ring-gray-200 dark:bg-surface dark:ring-line"
    >
      <div className="text-sm font-medium text-gray-700 dark:text-gray-300">ยอดรับซื้อตามตัวกรอง</div>

      <div className="mt-1 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div aria-live="polite" aria-busy={loading} className={cx("min-w-0", FIGURES_MIN_H)}>
          {datesInvalid ? (
            <p className="text-sm leading-6 text-slate-600 dark:text-gray-300">
              เลือกวันที่เริ่มต้นและวันที่สิ้นสุดให้ถูกต้อง เพื่อดูยอดรวม
            </p>
          ) : loading ? (
            <>
              <span className="sr-only">กำลังคำนวณยอดรวม</span>
              <div aria-hidden="true" className={cx("h-8 w-48 max-w-full", skeletonCls)} />
              <div aria-hidden="true" className={cx("mt-1 h-5 w-40 max-w-full", skeletonCls)} />
            </>
          ) : failed ? (
            <p className="text-sm leading-6 text-red-600 dark:text-red-400">{shownError}</p>
          ) : (
            <>
              <div className="text-2xl font-semibold leading-8 tabular-nums text-gray-900 dark:text-white">
                {thb(totals.amount)} <span className="text-base font-medium">บาท</span>
              </div>
              <div className="mt-1 flex flex-wrap gap-x-2 text-sm leading-5 tabular-nums text-slate-600 dark:text-gray-300">
                <span>{formatWeight(totals.weight)} กก.</span>
                <span aria-hidden="true">·</span>
                <span>{nf(totals.count)} รายการ</span>
                {totals.count === 0 && <span className="w-full md:w-auto md:before:mr-2 md:before:content-['·']">ไม่พบรายการรับซื้อตามตัวกรองนี้</span>}
              </div>
            </>
          )}
        </div>

        {failed && (
          <button
            type="button"
            onClick={() => {
              if (speciesError) onRetrySpecies?.()
              if (result.error) setAttempt((n) => n + 1)
            }}
            className={cx(
              "inline-flex min-h-touch shrink-0 cursor-pointer items-center justify-center self-start rounded-xl bg-white px-4 text-sm font-medium text-slate-700 ring-1 ring-inset ring-slate-300 transition-colors duration-200 hover:bg-slate-100 md:pointer-fine:min-h-9 md:self-auto dark:bg-white/[.04] dark:text-gray-100 dark:ring-line-strong dark:hover:bg-white/[.08]",
              focusRingCls
            )}
          >
            ลองใหม่
          </button>
        )}
      </div>
    </section>
  )
}
