import { useState, useEffect } from "react"

const THAI_MONTHS = [
  "มกราคม", "กุมภาพันธ์", "มีนาคม", "เมษายน",
  "พฤษภาคม", "มิถุนายน", "กรกฎาคม", "สิงหาคม",
  "กันยายน", "ตุลาคม", "พฤศจิกายน", "ธันวาคม",
]

/**
 * ThaiDateInput — a date picker that shows/accepts Buddhist Era (พ.ศ.) years.
 *
 * Props:
 *   value     — ISO date string "YYYY-MM-DD" (CE) or ""
 *   onChange  — called with ISO "YYYY-MM-DD" (CE) when complete, or "" when cleared
 *   className — forwarded to the wrapper div (use baseField for form compatibility)
 */
export default function ThaiDateInput({ value = "", onChange, className = "" }) {
  // Parse incoming CE ISO value into day/month/beYear parts
  function parseISO(iso) {
    if (!iso) return { day: "", month: "", beYear: "" }
    const [y, m, d] = iso.split("-")
    return {
      day: d ? String(parseInt(d, 10)) : "",
      month: m ? String(parseInt(m, 10)) : "",
      beYear: y ? String(parseInt(y, 10) + 543) : "",
    }
  }

  const parsed = parseISO(value)
  const [day, setDay]       = useState(parsed.day)
  const [month, setMonth]   = useState(parsed.month)
  const [beYear, setBeYear] = useState(parsed.beYear)

  // Sync internal state when the parent changes the value externally
  useEffect(() => {
    const p = parseISO(value)
    setDay(p.day)
    setMonth(p.month)
    setBeYear(p.beYear)
  }, [value])

  function emit(d, m, y) {
    const dayNum   = parseInt(d, 10)
    const monthNum = parseInt(m, 10)
    const ceYear   = parseInt(y, 10) - 543

    if (
      d && m && y &&
      !isNaN(dayNum) && !isNaN(monthNum) && !isNaN(ceYear) &&
      dayNum >= 1 && dayNum <= 31 &&
      monthNum >= 1 && monthNum <= 12 &&
      ceYear > 0 && y.length === 4
    ) {
      const mm = String(monthNum).padStart(2, "0")
      const dd = String(dayNum).padStart(2, "0")
      onChange?.(`${ceYear}-${mm}-${dd}`)
    } else {
      onChange?.("")
    }
  }

  function handleDay(e) {
    const v = e.target.value.replace(/\D/g, "").slice(0, 2)
    setDay(v)
    emit(v, month, beYear)
  }

  function handleMonth(e) {
    const v = e.target.value
    setMonth(v)
    emit(day, v, beYear)
  }

  function handleYear(e) {
    const v = e.target.value.replace(/\D/g, "").slice(0, 4)
    setBeYear(v)
    emit(day, month, v)
  }

  // Strip out sizing classes that clash with our internal layout,
  // then apply the rest (colors, border, ring, etc.)
  const wrapperCls =
    className
      .split(" ")
      .filter((c) => !c.startsWith("w-") && c !== "block" && c !== "p-3")
      .join(" ")

  return (
    <div
      className={
        "flex items-center gap-1 px-3 py-2.5 " + wrapperCls
      }
    >
      {/* Day */}
      <input
        type="number"
        min={1}
        max={31}
        inputMode="numeric"
        placeholder="วว"
        value={day}
        onChange={handleDay}
        className="w-10 text-center bg-transparent outline-none border-none p-0 [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none text-sm"
      />

      <span className="text-gray-400 select-none">/</span>

      {/* Month */}
      <select
        value={month}
        onChange={handleMonth}
        className="flex-1 bg-transparent outline-none border-none p-0 text-sm cursor-pointer text-inherit dark:text-inherit"
      >
        <option value="">— เดือน —</option>
        {THAI_MONTHS.map((name, i) => (
          <option key={i + 1} value={String(i + 1)}>
            {name}
          </option>
        ))}
      </select>

      <span className="text-gray-400 select-none">/</span>

      {/* Year (BE) */}
      <input
        type="number"
        inputMode="numeric"
        placeholder="ปปปป"
        value={beYear}
        onChange={handleYear}
        className="w-16 text-center bg-transparent outline-none border-none p-0 [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none text-sm"
      />
    </div>
  )
}
