// src/pages/Share.jsx
import {
  useEffect,
  useMemo,
  useRef,
  useState,
  forwardRef,
  useImperativeHandle,
} from "react"
import { apiAuth } from "../lib/api" // ✅ แนบ token + JSON ให้แล้ว
import { cx, baseField, labelCls, helpTextCls, errorTextCls } from "../lib/styles"

/** ---------- Utils ---------- */
// debounce สำหรับช่องค้นหา
function useDebounce(value, delay = 350) {
  const [debounced, setDebounced] = useState(value)
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delay)
    return () => clearTimeout(t)
  }, [value, delay])
  return debounced
}
// ทำให้ช่องจำนวนรับเฉพาะตัวเลขกับจุดทศนิยม และจำกัดทศนิยม N ตำแหน่ง
function keepDecimalPlaces(s = "", places = 3) {
  let v = (s + "").replace(/[^0-9.]/g, "")
  const parts = v.split(".")
  const int = parts.shift() ?? ""
  const dec = parts.join("") // รวมกรณีมีหลายจุด
  return dec ? `${int}.${dec.slice(0, places)}` : int
}
const norm = (s = "") => s.trim().replace(/\s+/g, " ")
const isQueryEqualPicked = (q, picked) => {
  if (!picked) return false
  const full = norm(`${picked.first_name ?? ""} ${picked.last_name ?? ""}`)
  return norm(q) === full || q === picked.citizen_id
}
// คืนวันที่ปัจจุบันแบบ "เวลาท้องถิ่น" ไม่ใช่ UTC (กันวันเพี้ยน)
function todayLocalISODate() {
  const d = new Date()
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, "0")
  const dd = String(d.getDate()).padStart(2, "0")
  return `${y}-${m}-${dd}`
}

/** ---------- สไตล์พื้นฐาน (อิงจาก MemberTermination) ---------- */
const fieldError = "border-red-500 ring-2 ring-red-300 focus:ring-0 focus:border-red-500"

/** ---------- Section Card ---------- */
function SectionCard({ title, subtitle, children, className = "" }) {
  return (
    <div
      className={cx(
        "rounded-2xl border border-slate-200 bg-white p-5 text-black shadow-sm",
        "dark:border-slate-700 dark:bg-slate-800 dark:text-white",
        className
      )}
    >
      {title && <h2 className="mb-1 text-xl font-semibold">{title}</h2>}
      {subtitle && (
        <p className="mb-4 text-sm text-slate-600 dark:text-slate-300">{subtitle}</p>
      )}
      {children}
    </div>
  )
}

/** ---------- DateInput (สไตล์เดียวกับหน้าอื่น) ---------- */
const DateInput = forwardRef(function DateInput(
  { error = false, className = "", ...props },
  ref
) {
  const inputRef = useRef(null)
  useImperativeHandle(ref, () => inputRef.current)

  return (
    <div className="relative">
      <style>{`input[type="date"]::-webkit-calendar-picker-indicator { opacity: 0; }`}</style>
      <input
        type="date"
        ref={inputRef}
        className={cx(baseField, "pr-12 cursor-pointer", error && fieldError, className)}
        {...props}
      />
      <button
        type="button"
        onClick={() => {
          const el = inputRef.current
          if (!el) return
          if (typeof el.showPicker === "function") el.showPicker()
          else {
            el.focus()
            el.click?.()
          }
        }}
        aria-label="เปิดตัวเลือกวันที่"
        className="absolute right-2 top-1/2 -translate-y-1/2 inline-flex h-9 w-9 items-center justify-center rounded-xl
                    transition-transform hover:scale-110 active:scale-95 focus:outline-none cursor-pointer bg-transparent"
      >
        <svg
          viewBox="0 0 24 24"
          width="20"
          height="20"
          fill="currentColor"
          className="text-slate-600 dark:text-slate-200"
        >
          <path d="M7 2a1 1 0 0 1 1 1v1h8V3a1 1 0 1 1 2 0v1h1a2 2 0 0 1 2 2v3H3V6a2 2 0 0 1 2-2h1V3a1 1 0 1 1 1-1zm14 9v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-7h18zM7 14h2v2H7v-2zm4 0h2v2h-2v-2z" />
        </svg>
      </button>
    </div>
  )
})

/** ---------- หน้า Share (ซื้อหุ้น) ---------- */
function Share() {
  /** --- ค้นหา/เลือกสมาชิก --- */
  const [query, setQuery] = useState("")
  const debQ = useDebounce(query, 350)
  const [results, setResults] = useState([])
  const [loading, setLoading] = useState(false)
  const [showList, setShowList] = useState(false)
  const [highlighted, setHighlighted] = useState(-1)

  const listBoxRef = useRef(null)
  const itemRefs = useRef([])
  const searchRef = useRef(null)

  const [picked, setPicked] = useState(null)

  // ฟิลด์ซื้อหุ้น
  const [buyDate, setBuyDate] = useState(todayLocalISODate())
  const [amountRaw, setAmountRaw] = useState("") // เก็บรูปแบบที่ผู้ใช้พิมพ์
  const [submitting, setSubmitting] = useState(false)
  const [receipt, setReceipt] = useState(null) // response จาก BE

  // error
  const [errors, setErrors] = useState({})

  // Refs สำหรับเลื่อนโฟกัสด้วย Enter
  const dateRef = useRef(null)
  const amountRef = useRef(null)
  const submitRef = useRef(null)
  const focusOrder = [searchRef, dateRef, amountRef, submitRef]
  const focusNextFromEl = (el) => {
    const i = focusOrder.findIndex((r) => r?.current === el)
    const next = focusOrder[Math.min(i + 1, focusOrder.length - 1)]
    try {
      next?.current?.focus()
    } catch {}
  }

  // ค้นหาสมาชิก
  useEffect(() => {
    const q = (debQ || "").trim()
    itemRefs.current = []
    setHighlighted(-1)

    if (!q || q.length < 2) {
      setResults([])
      setShowList(false)
      return
    }

    let aborted = false
    ;(async () => {
      try {
        setLoading(true)
        const data = await apiAuth(`/member/members/search?q=${encodeURIComponent(q)}`)
        if (!aborted) {
          const arr = Array.isArray(data) ? data.slice(0, 50) : []
          setResults(arr)
          setShowList(arr.length > 0 && !isQueryEqualPicked(q, picked))
        }
      } catch {
        if (!aborted) {
          setResults([])
          setShowList(false)
        }
      } finally {
        if (!aborted) setLoading(false)
      }
    })()
    return () => {
      aborted = true
    }
  }, [debQ, picked])

  // ปิดลิสต์เมื่อคลิกนอก
  useEffect(() => {
    function onDocClick(e) {
      if (!listBoxRef.current && !searchRef.current) return
      if (
        listBoxRef.current?.contains(e.target) ||
        searchRef.current?.contains(e.target)
      )
        return
      setShowList(false)
    }
    document.addEventListener("mousedown", onDocClick)
    return () => document.removeEventListener("mousedown", onDocClick)
  }, [])

  const scrollIntoView = (idx) => {
    try {
      itemRefs.current[idx]?.scrollIntoView({ block: "nearest" })
    } catch {}
  }

  const pickResult = (r) => {
    setPicked(r)
    setQuery(`${r.first_name ?? ""} ${r.last_name ?? ""}`.trim() || r.citizen_id || "")
    setErrors((p) => ({ ...p, picked: undefined }))
    setShowList(false)
    // ไปช่องถัดไป
    requestAnimationFrame(() => focusNextFromEl(searchRef.current))
  }

  const onSearchKeyDown = (e) => {
    if (showList && results.length > 0) {
      if (e.key === "ArrowDown") {
        e.preventDefault()
        const next = (highlighted + 1) % results.length
        setHighlighted(next)
        requestAnimationFrame(() => scrollIntoView(next))
        return
      } else if (e.key === "ArrowUp") {
        e.preventDefault()
        const next = (highlighted - 1 + results.length) % results.length
        setHighlighted(next)
        requestAnimationFrame(() => scrollIntoView(next))
        return
      } else if (e.key === "Escape") {
        setShowList(false)
        return
      } else if (e.key === "Enter") {
        e.preventDefault()
        const idx = highlighted >= 0 ? highlighted : 0
        if (results[idx]) pickResult(results[idx])
        return
      }
    }
    if (e.key === "Enter") {
      e.preventDefault()
      requestAnimationFrame(() => focusNextFromEl(e.currentTarget))
    }
  }

  // ดึง tgs_id กรณี search API ไม่คืนมา
  const ensureTgsId = async (member) => {
    if (member?.tgs_id) return member.tgs_id
    try {
      const detail = await apiAuth(`/member/members/${member.member_id}`)
      return detail?.tgs_id || ""
    } catch {
      return ""
    }
  }

  // ตรวจสอบ/เตรียมข้อมูลสำหรับส่ง
  const validate = () => {
    const e = {}
    if (!picked) e.picked = "เลือกสมาชิก"
    if (!buyDate) e.buyDate = "กรอกวันที่ซื้อ"
    const num = Number(amountRaw)
    if (!amountRaw || !isFinite(num) || num <= 0) {
      e.amount = "กรอกจำนวนที่ซื้อ (> 0) สามารถมีทศนิยมได้สูงสุด 3 ตำแหน่ง"
    } else {
      // ตรวจจำนวนทศนิยม
      const decimals = (amountRaw.split(".")[1] || "").length
      if (decimals > 3) e.amount = "ไม่ต่ำกว่า 100 บาท"
    }
    setErrors(e)
    return Object.keys(e).length === 0
  }

  const reset = () => {
    setQuery("")
    setResults([])
    setPicked(null)
    setErrors({})
    setShowList(false)
    setHighlighted(-1)
    setBuyDate(todayLocalISODate())
    setAmountRaw("")
    setReceipt(null)
    searchRef.current?.focus()
  }

  const submit = async () => {
    if (!validate()) return
    try {
      setSubmitting(true)
      let tgs = await ensureTgsId(picked)
      if (!tgs) {
        setErrors((p) => ({
          ...p,
          picked: "ไม่พบรหัสสมาชิก (tgs_id) ของรายการที่เลือก",
        }))
        return
      }

      // BE ต้องการ amount (Decimal, 3 ตำแหน่ง) + buy_date (YYYY-MM-DD)
      const payload = {
        amount: Number(amountRaw).toFixed(3),
        buy_date: buyDate,
      }

      const res = await apiAuth(`/share/${encodeURIComponent(tgs)}/buy-share`, {
        method: "POST",
        body: payload,
      })
      setReceipt(res) // แสดงใบเสร็จจาก BE
      // เคลียร์เฉพาะช่องจำนวนเพื่อพร้อมซื้อซ้ำสมาชิกเดิม
      setAmountRaw("")
    } catch (err) {
      console.error(err)
      alert(`บันทึกล้มเหลว: ${err?.message || "ไม่ทราบสาเหตุ"}`)
    } finally {
      setSubmitting(false)
    }
  }

  const pickedPreview = useMemo(() => {
    if (!picked) return ""
    return `#${picked.member_id ?? "?"} • ${picked.first_name || "-"} ${
      picked.last_name || "-"
    } • ${picked.citizen_id || "-"}${picked.tgs_id ? " • TGS " + picked.tgs_id : ""}`
  }, [picked])

  /** ---------- UI ---------- */
  return (
    <div className="min-h-screen bg-white text-black dark:bg-slate-900 dark:text-white rounded-2xl text-[15px] md:text-base">
      <div className="mx-auto max-w-5xl p-5 md:p-6 lg:p-8">
        <h1 className="mb-1 text-3xl font-bold">📈 ซื้อหุ้น</h1>
        <p className="mb-5 text-slate-600 dark:text-slate-300">
          ค้นหาและเลือกสมาชิก กรอกวันที่และจำนวนที่ซื้อ แล้วบันทึกเพื่อส่งไปยังระบบหลังบ้าน
        </p>

        {/* เลือกสมาชิก */}
        <SectionCard title="เลือกสมาชิก" className="mb-6">
          <label className={labelCls}>ค้นหาสมาชิกจากชื่อ-นามสกุล หรือเลขบัตรประชาชน</label>
          <input
            ref={searchRef}
            className={cx(baseField, errors.picked && fieldError)}
            value={query}
            onChange={(e) => {
              const v = e.target.value
              setQuery(v)
              setErrors((p) => ({ ...p, picked: undefined }))
              setPicked(null)
              setShowList(v.trim().length >= 2 && results.length > 0)
              setHighlighted(-1)
            }}
            onFocus={() => {
              if (
                query.trim().length >= 2 &&
                results.length > 0 &&
                !isQueryEqualPicked(query, picked)
              ) {
                setShowList(true)
              }
            }}
            onKeyDown={onSearchKeyDown}
            placeholder="ตัวอย่าง: สมชาย ใจดี หรือ 1234567890123"
            aria-expanded={showList}
            aria-controls="member-results"
            role="combobox"
            aria-autocomplete="list"
            aria-invalid={errors.picked ? true : undefined}
            autoComplete="off"
          />
          {errors.picked && <p className={errorTextCls}>{errors.picked}</p>}
          <div className="mt-1 text-xs md:text-sm text-slate-500 dark:text-slate-400">
            {query.trim()
              ? loading
                ? "กำลังค้นหา..."
                : `ผลลัพธ์ ${results.length} รายการ`
              : "พิมพ์อย่างน้อย 2 ตัวอักษรเพื่อค้นหา"}
          </div>

          {showList && results.length > 0 && (
            <div
              id="member-results"
              ref={listBoxRef}
              className="mt-1 max-h-80 w-full overflow-auto rounded-2xl border border-slate-200 bg-white text-black shadow-sm dark:border-slate-700 dark:bg-slate-800 dark:text-white"
              role="listbox"
            >
              {results.map((r, idx) => {
                const isActive = idx === highlighted
                const full = `${r.first_name ?? ""} ${r.last_name ?? ""}`.trim() || "(ไม่มีชื่อ)"
                return (
                  <button
                    type="button"
                    ref={(el) => (itemRefs.current[idx] = el)}
                    key={`${r.member_id}-${r.citizen_id}-${idx}`}
                    onClick={() => pickResult(r)}
                    onMouseEnter={() => {
                      setHighlighted(idx)
                      requestAnimationFrame(() => scrollIntoView(idx))
                    }}
                    role="option"
                    aria-selected={isActive}
                    className={cx(
                      "relative flex w-full items-start gap-3 px-3 py-2.5 text-left transition rounded-xl cursor-pointer",
                      isActive
                        ? "bg-emerald-100 ring-1 ring-emerald-300 dark:bg-emerald-400/20 dark:ring-emerald-500"
                        : "hover:bg-emerald-50 dark:hover:bg-emerald-900/30"
                    )}
                  >
                    {isActive && (
                      <span className="absolute left-0 top-0 h-full w-1 bg-emerald-600 dark:bg-emerald-400/70 rounded-l-xl" />
                    )}
                    <div className="flex-1">
                      <div className="font-medium">
                        {full} <span className="text-xs text-slate-500">#{r.member_id}</span>
                      </div>
                      <div className="text-sm text-slate-600 dark:text-slate-300">
                        บัตร {r.citizen_id ?? "-"} • โทร {r.phone_number ?? "-"}
                      </div>
                    </div>
                    <div className="text-xs px-2 py-1 rounded-lg bg-slate-100 dark:bg-slate-700">
                      {r.province || r.district || "—"}
                    </div>
                  </button>
                )
              })}
            </div>
          )}

          {/* แสดงสมาชิกที่เลือก */}
          <div className="mt-5">
            <div className="text-sm text-slate-600 dark:text-slate-300">สมาชิกที่เลือก</div>
            <div
              aria-live="polite"
              className={cx(
                "mt-2 rounded-2xl px-4 py-3 md:px-6 md:py-4 text-base md:text-lg leading-relaxed",
                "ring-1",
                picked
                  ? "bg-emerald-50 text-emerald-700 ring-emerald-200 dark:bg-emerald-900/20 dark:text-emerald-200 dark:ring-emerald-700/60"
                  : "bg-slate-100 text-slate-700 ring-slate-200 dark:bg-slate-800/60 dark:text-slate-200 dark:ring-slate-700/60"
              )}
            >
              {picked ? pickedPreview : "— ยังไม่ได้เลือก —"}
            </div>
          </div>
        </SectionCard>

        {/* รายละเอียดการซื้อหุ้น */}
        <SectionCard
          title="รายละเอียดการซื้อ"
          subtitle="ระบุวันที่และจำนวนที่จะซื้อ จากนั้นกด “ซื้อหุ้น” เพื่อบันทึก"
          className="mb-6"
        >
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className={labelCls}>วันที่ซื้อ</label>
              <DateInput
                ref={dateRef}
                value={buyDate}
                onChange={(e) => {
                  setBuyDate(e.target.value)
                  setErrors((p) => ({ ...p, buyDate: undefined }))
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault()
                    focusNextFromEl(e.currentTarget)
                  }
                }}
                error={!!errors.buyDate}
                aria-invalid={errors.buyDate ? true : undefined}
              />
              {errors.buyDate && <p className={errorTextCls}>{errors.buyDate}</p>}
            </div>

            <div>
              <label className={labelCls}>จำนวนที่ซื้อ (บาท)</label>
              <div className="relative">
                <input
                  ref={amountRef}
                  inputMode="decimal"
                  className={cx(baseField, "pr-12", errors.amount && fieldError)}
                  value={amountRaw}
                  onChange={(e) => {
                    const cleaned = keepDecimalPlaces(e.target.value, 3)
                    setAmountRaw(cleaned)
                    setErrors((p) => ({ ...p, amount: undefined }))
                  }}
                  placeholder="เช่น 500 หรือ 123.456"
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault()
                      focusNextFromEl(e.currentTarget)
                    }
                  }}
                  aria-invalid={errors.amount ? true : undefined}
                  autoComplete="off"
                />
                <div className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 dark:text-slate-300">
                  ฿
                </div>
              </div>
              <p className={helpTextCls}>รองรับทศนิยมไม่เกิน 3 ตำแหน่ง</p>
              {errors.amount && <p className={errorTextCls}>{errors.amount}</p>}
            </div>
          </div>
        </SectionCard>

        {/* ปุ่ม */}
        <div className="flex flex-col gap-3 sm:flex-row">
          <button
            type="button"
            ref={submitRef}
            disabled={submitting}
            onClick={submit}
            className="inline-flex items-center justify-center rounded-2xl 
                      bg-emerald-600 px-6 py-3 text-base font-semibold text-white
                      shadow-[0_6px_16px_rgba(16,185,129,0.35)]
                      transition-all duration-300 ease-out
                      hover:bg-emerald-700 hover:shadow-[0_8px_20px_rgba(16,185,129,0.45)]
                      hover:scale-[1.05] active:scale-[.97]
                      disabled:opacity-60 disabled:cursor-not-allowed cursor-pointer"
            aria-busy={submitting ? "true" : "false"}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault()
                submit()
              }
            }}
          >
            {submitting ? "กำลังบันทึก..." : "ซื้อหุ้น"}
          </button>

          <button
            type="button"
            onClick={reset}
            className="inline-flex items-center justify-center rounded-2xl 
                      border border-slate-300 bg-white px-6 py-3 text-base font-medium text-slate-700 
                      shadow-sm transition-all duration-300 ease-out
                      hover:bg-slate-100 hover:shadow-md hover:scale-[1.03]
                      active:scale-[.97]
                      dark:border-slate-600 dark:bg-slate-700/60 dark:text-white 
                      dark:hover:bg-slate-700/50 dark:hover:shadow-lg cursor-pointer"
          >
            รีเซ็ต
          </button>
        </div>

        {/* ใบเสร็จ/ผลลัพธ์จาก BE */}
        {receipt && (
          <SectionCard title="ผลการซื้อ / ใบเสร็จ" className="mt-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-[15px] md:text-base">
              <div>
                <div className="text-slate-500 dark:text-slate-300">รหัส TGS</div>
                <div className="font-semibold">{receipt.tgs_id ?? "—"}</div>
              </div>
              <div>
                <div className="text-slate-500 dark:text-slate-300">วันที่บันทึก</div>
                <div className="font-semibold">{receipt.buy_date ?? "—"}</div>
              </div>
              <div>
                <div className="text-slate-500 dark:text-slate-300">มูลค่าที่ซื้อ</div>
                <div className="font-semibold">{String(receipt.value_bought ?? "—")}</div>
              </div>
              <div>
                <div className="text-slate-500 dark:text-slate-300">ค่าธรรมเนียม</div>
                <div className="font-semibold">{String(receipt.fee ?? "0.00")}</div>
              </div>
              <div>
                <div className="text-slate-500 dark:text-slate-300">รวมต้องชำระ</div>
                <div className="font-semibold">{String(receipt.total_due ?? "—")}</div>
              </div>
              <div>
                <div className="text-slate-500 dark:text-slate-300">ยอดรวมหุ้นหลังซื้อ</div>
                <div className="font-semibold">
                  {String(receipt.total_share_after ?? "—")}
                </div>
              </div>
            </div>
            <p className="mt-3 text-sm text-slate-600 dark:text-slate-300">
              * ค่าธรรมเนียมจะคิดในกรณีเป็นการซื้อครั้งแรกของสมาชิก ตามสเปคฝั่ง BE.
            </p>
          </SectionCard>
        )}
      </div>
    </div>
  )
}

export default Share
