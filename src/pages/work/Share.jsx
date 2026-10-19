// src/pages/Share.jsx
import { useEffect, useMemo, useRef, useState } from "react"
import { apiAuth } from "../../lib/api" // ✅ แนบ token + JSON ให้แล้ว
import { cx, baseField, labelCls, helpTextCls, errorTextCls } from "../../lib/styles"
import { ErrorState, SearchField, StickyActionBar, ResultSheet, ConfirmDialog, toast } from "../../components/ui"
import { useIsPhone } from "../../hooks/useMediaQuery"
import { describeApiError, thb } from "./buy/buyShared"
import DateInput from "../../components/ThaiDateField"
import PageTitle from "../../components/PageTitle"

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
/** ตรวจจำนวนเงินซื้อหุ้น: > 0 และทศนิยมไม่เกิน 3 ตำแหน่ง — ไม่แก้ค่าที่ผู้ใช้พิมพ์เอง (handoff F9) */
function amountError(raw = "") {
  const v = String(raw).trim().replace(/,/g, "")
  if (!v) return "กรอกจำนวนที่ซื้อ"
  if (/^-/.test(v)) return "จำนวนต้องมากกว่า 0 (ห้ามติดลบ)"
  if (!/^\d*\.?\d*$/.test(v) || v === ".") return "กรอกเป็นตัวเลขเท่านั้น เช่น 500 หรือ 123.456"
  if ((v.split(".")[1] || "").length > 3) return "ทศนิยมได้ไม่เกิน 3 ตำแหน่ง"
  if (!(Number(v) > 0)) return "จำนวนต้องมากกว่า 0"
  return ""
}
const amountValue = (raw = "") => String(raw).trim().replace(/,/g, "")
/** แสดงหุ้น/เงินจากใบเสร็จ 3 ตำแหน่ง (เช่น 206.234) */
const fmt3 = (v) => {
  if (v === null || v === undefined || v === "") return "—"
  const n = Number(v)
  return Number.isFinite(n) ? n.toLocaleString("th-TH", { minimumFractionDigits: 3, maximumFractionDigits: 3 }) : String(v)
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
// ช่องวันที่ไทย (วัน เดือน พ.ศ.) ตัวกลาง — API เหมือน input เดิม (handoff F25)

/** พิมพ์ใบเสร็จซื้อหุ้นในหน้าต่างใหม่ (เฉพาะใบเสร็จ ไม่รวมเมนู) */
function printShareReceipt(r) {
  const esc = (v) => String(v ?? "—").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]))
  const rows = [
    ["สมาชิก", r.__member_name || "—"],
    ["เลขสมาชิก", r.__member_id ?? "—"],
    ["รหัส TGS", r.tgs_id ?? "—"],
    ["วันที่บันทึก", r.buy_date ?? "—"],
    ["มูลค่าที่ซื้อ (บาท)", fmt3(r.value_bought)],
    ["ค่าธรรมเนียม (บาท)", fmt3(r.fee ?? 0)],
    ["รวมต้องชำระ (บาท)", fmt3(r.total_due)],
    ["ยอดรวมหุ้นหลังซื้อ", fmt3(r.total_share_after)],
  ]
  const w = window.open("", "_blank", "width=480,height=640")
  if (!w) {
    toast.error("เปิดหน้าพิมพ์ไม่ได้", { description: "เบราว์เซอร์บล็อกหน้าต่างใหม่ อนุญาตป๊อปอัปแล้วลองอีกครั้ง" })
    return
  }
  w.document.write(`<!doctype html><html lang="th"><head><meta charset="utf-8"><title>ใบเสร็จซื้อหุ้น</title>
<style>body{font-family:system-ui,"Sarabun",sans-serif;margin:24px;color:#111}h1{font-size:18px;margin:0 0 4px}
p{margin:0 0 16px;color:#555;font-size:13px}table{width:100%;border-collapse:collapse;font-size:14px}
td{padding:6px 0;border-bottom:1px solid #e5e7eb}td:last-child{text-align:right;font-variant-numeric:tabular-nums;font-weight:600}
.note{margin-top:12px;font-size:12px;color:#555}</style></head><body>
<h1>ใบเสร็จซื้อหุ้น</h1><p>สหกรณ์การเกษตรเพื่อการตลาดลูกค้า ธ.ก.ส. สุรินทร์</p>
<table>${rows.map(([k, v]) => `<tr><td>${esc(k)}</td><td>${esc(v)}</td></tr>`).join("")}</table>
<div class="note">* คิดค่าธรรมเนียมเฉพาะการซื้อครั้งแรกของสมาชิก</div>
<script>window.onload=function(){window.print()}</script></body></html>`)
  w.document.close()
}

/** ---------- หน้า Share (ซื้อหุ้น) ---------- */
function Share() {
  /** --- ค้นหา/เลือกสมาชิก --- */
  const [query, setQuery] = useState("")
  const debQ = useDebounce(query, 350)
  const [results, setResults] = useState([])
  const [loading, setLoading] = useState(false)
  const [searchError, setSearchError] = useState("")   // ข้อผิดพลาดตอนค้นหาสมาชิก
  const [searchReloadKey, setSearchReloadKey] = useState(0)
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
  const [failure, setFailure] = useState(null) // ResultSheet (แทน alert)
  const [confirmOpen, setConfirmOpen] = useState(false) // ยืนยันก่อนซื้อ (handoff F10)
  const isPhone = useIsPhone()
  const receiptRef = useRef(null)

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
      setSearchError("")
      return
    }

    let aborted = false
    ;(async () => {
      try {
        setLoading(true)
        setSearchError("")
        const data = await apiAuth(`/member/members/search?q=${encodeURIComponent(q)}`)
        if (!aborted) {
          const arr = Array.isArray(data) ? data.slice(0, 50) : []
          setResults(arr)
          setShowList(arr.length > 0 && !isQueryEqualPicked(q, picked))
        }
      } catch (err) {
        if (!aborted) {
          setResults([])
          setShowList(false)
          setSearchError(/[฀-๿]/.test(err?.message || "") ? err.message : "ค้นหาสมาชิกไม่สำเร็จ ลองใหม่อีกครั้ง")
        }
      } finally {
        if (!aborted) setLoading(false)
      }
    })()
    return () => {
      aborted = true
    }
  }, [debQ, picked, searchReloadKey])

  // ปิดลิสต์เมื่อคลิกนอก
  useEffect(() => {
    function onDocClick(e) {
      if (!listBoxRef.current && !searchRef.current) return
      if (
        listBoxRef.current?.contains(e.target) ||
        searchRef.current?.contains(e.target) ||
        e.target?.closest?.("#member-results") // SearchField portals the list on desktop
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
    const amtErr = amountError(amountRaw)
    if (amtErr) e.amount = amtErr
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
    setSearchError("")
    setBuyDate(todayLocalISODate())
    setAmountRaw("")
    setReceipt(null)
    searchRef.current?.focus()
  }

  /** กดซื้อหุ้น → ตรวจ แล้วเปิดกล่องยืนยัน (บันทึกแล้วย้อนกลับในหน้านี้ไม่ได้) */
  const askConfirm = () => {
    if (!validate()) return
    setConfirmOpen(true)
  }

  const submit = async () => {
    if (!validate()) return
    setConfirmOpen(false)
    try {
      setSubmitting(true)
      let tgs = await ensureTgsId(picked)
      if (!tgs) {
        setErrors((p) => ({
          ...p,
          picked: "สมาชิกที่เลือกยังไม่มีรหัส TGS จึงซื้อหุ้นไม่ได้",
        }))
        return
      }

      // BE ต้องการ amount (Decimal, 3 ตำแหน่ง) + buy_date (YYYY-MM-DD)
      const payload = {
        amount: Number(amountValue(amountRaw)).toFixed(3),
        buy_date: buyDate,
      }

      const res = await apiAuth(`/share/${encodeURIComponent(tgs)}/buy-share`, {
        method: "POST",
        body: payload,
      })
      // ใบเสร็จจาก BE + ชื่อ/เลขสมาชิก ณ ตอนซื้อ (handoff F27)
      setReceipt({
        ...res,
        __member_name: `${picked.first_name ?? ""} ${picked.last_name ?? ""}`.trim(),
        __member_id: picked.member_id ?? null,
      })
      // เคลียร์เฉพาะช่องจำนวนเพื่อพร้อมซื้อซ้ำสมาชิกเดิม
      setAmountRaw("")
      toast.success("บันทึกการซื้อหุ้นแล้ว", { description: "ดูใบเสร็จด้านล่าง" })
      requestAnimationFrame(() => {
        try { receiptRef.current?.scrollIntoView({ block: "start", behavior: "smooth" }) } catch { /* ignore */ }
      })
    } catch (err) {
      console.error(err)
      setFailure(describeApiError(err))
    } finally {
      setSubmitting(false)
    }
  }

  const pickedPreview = useMemo(() => {
    if (!picked) return ""
    return `${picked.member_id != null ? `เลขสมาชิก ${picked.member_id} • ` : ""}${picked.first_name || "-"} ${
      picked.last_name || "-"
    } • ${picked.citizen_id || "-"}${picked.tgs_id ? " • TGS " + picked.tgs_id : ""}`
  }, [picked])

  /** ---------- UI ---------- */
  return (
    <div className="min-h-screen bg-white text-black dark:bg-slate-900 dark:text-white rounded-2xl text-[15px] md:text-base">
      <div className="mx-auto max-w-5xl p-5 md:p-6 lg:p-8">
        <PageTitle title="ซื้อหุ้น" />

        {/* เลือกสมาชิก */}
        <SectionCard title="เลือกสมาชิก" className="mb-6">
          <label className={labelCls}>ค้นหาสมาชิกจากชื่อ-นามสกุล หรือเลขบัตรประชาชน</label>
          <SearchField
            inputRef={searchRef}
            id="share-member-q"
            value={query}
            onChange={(v) => {
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
            open={showList && results.length > 0}
            loading={loading}
            results={results}
            listId="member-results"
            highlightedIndex={highlighted}
            onHighlight={setHighlighted}
            onPick={(r) => pickResult(r)}
            ariaLabel="ค้นหาสมาชิกจากชื่อ-นามสกุล หรือเลขบัตรประชาชน"
            placeholder="ตัวอย่าง: สมชาย ใจดี หรือ 1234567890123"
            renderResult={(r) => (
              <div className="flex items-start gap-3">
                <div className="min-w-0 flex-1">
                  <div className="truncate font-medium">
                    {`${r.first_name ?? ""} ${r.last_name ?? ""}`.trim() || "(ไม่มีชื่อ)"}{" "}
                    {r.member_id != null && <span className="text-xs text-slate-500 dark:text-slate-400">เลขสมาชิก {r.member_id}</span>}
                  </div>
                  <div className="truncate text-sm text-slate-600 dark:text-slate-300">
                    บัตร {r.citizen_id ?? "-"} · โทร {r.phone_number ?? "-"}
                  </div>
                </div>
                <span className="shrink-0 rounded-lg bg-slate-100 px-2 py-1 text-xs dark:bg-slate-700">
                  {r.province || r.district || "—"}
                </span>
              </div>
            )}
          />
          {errors.picked && <p className={errorTextCls}>{errors.picked}</p>}
          <div className="mt-1 text-xs md:text-sm text-slate-500 dark:text-slate-400">
            {query.trim()
              ? loading
                ? "กำลังค้นหา..."
                : `ผลลัพธ์ ${results.length} รายการ`
              : "พิมพ์อย่างน้อย 2 ตัวอักษรเพื่อค้นหา"}
          </div>

          {/* ค้นหาล้มเหลว → ErrorState + ปุ่มลองใหม่ */}
          {searchError && (
            <ErrorState
              className="mt-3"
              message={searchError}
              onRetry={() => setSearchReloadKey((k) => k + 1)}
            />
          )}

          {/* ค้นหาแล้วไม่พบ (ยังไม่ได้เลือก) */}
          {!loading && !searchError && query.trim().length >= 2 && results.length === 0 && !picked && (
            <div className="mt-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600 dark:border-slate-700 dark:bg-slate-800/60 dark:text-slate-300">
              ไม่พบสมาชิกที่ตรงกับ “{query.trim()}” ลองตรวจการสะกด หรือค้นด้วยเลขบัตรประชาชน
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
              <span className="break-words">{picked ? pickedPreview : "— ยังไม่ได้เลือก —"}</span>
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
              <label className={labelCls} htmlFor="share-date">วันที่ซื้อ</label>
              <DateInput
                ref={dateRef}
                id="share-date"
                aria-describedby={errors.buyDate ? "share-date-err" : undefined}
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
              {errors.buyDate && <p id="share-date-err" className={errorTextCls}>{errors.buyDate}</p>}
            </div>

            <div>
              <label className={labelCls} htmlFor="share-amount">จำนวนที่ซื้อ (บาท)</label>
              <div className="relative">
                <input
                  ref={amountRef}
                  id="share-amount"
                  aria-describedby={errors.amount ? "share-amount-help share-amount-err" : "share-amount-help"}
                  inputMode="decimal"
                  className={cx(baseField, "pr-12", errors.amount && fieldError)}
                  value={amountRaw}
                  onChange={(e) => {
                    const v = e.target.value
                    setAmountRaw(v)
                    // แจ้งทันทีเมื่อพิมพ์ค่าที่ใช้ไม่ได้ (ไม่แก้ตัวเลขให้เอง)
                    const err = v.trim() ? amountError(v) : ""
                    setErrors((p) => ({ ...p, amount: err || undefined }))
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
              <p id="share-amount-help" className={helpTextCls}>รองรับทศนิยมไม่เกิน 3 ตำแหน่ง</p>
              {errors.amount && <p id="share-amount-err" className={errorTextCls}>{errors.amount}</p>}
            </div>
          </div>
        </SectionCard>

        {/* ปุ่ม — phone: StickyActionBar; desktop: เดิม */}
        {isPhone ? (
          <StickyActionBar
            summary={
              <p className="flex items-baseline gap-2">
                <span className="min-w-0 truncate">
                  {picked
                    ? `${picked.first_name ?? ""} ${picked.last_name ?? ""}`.trim() || "-"
                    : <span className="text-gray-500 dark:text-gray-400">ยังไม่ได้เลือกสมาชิก</span>}
                </span>
                {!amountError(amountRaw) && (
                  <span className="ml-auto shrink-0 text-lg font-bold tabular-nums text-gray-900 dark:text-gray-100">{thb(Number(amountValue(amountRaw)))}</span>
                )}
              </p>
            }
            secondary={{ label: "รีเซ็ต", onClick: reset, disabled: submitting }}
            primary={{ label: submitting ? "กำลังบันทึก…" : "ซื้อหุ้น", onClick: askConfirm, loading: submitting }}
          />
        ) : (
        <div className="flex flex-col gap-3 sm:flex-row">
          <button
            type="button"
            ref={submitRef}
            disabled={submitting}
            onClick={askConfirm}
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
                askConfirm()
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
        )}

        {/* ใบเสร็จ/ผลลัพธ์จาก BE */}
        {receipt && (
          <div ref={receiptRef} className="scroll-mt-[calc(var(--topbar-h)+1rem)]">
          <SectionCard title="ผลการซื้อ / ใบเสร็จ" className="mt-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-[15px] md:text-base">
              <div>
                <div className="text-slate-500 dark:text-slate-300">สมาชิก</div>
                <div className="font-semibold">{receipt.__member_name || "—"}</div>
              </div>
              <div>
                <div className="text-slate-500 dark:text-slate-300">เลขสมาชิก</div>
                <div className="font-semibold tabular-nums">{receipt.__member_id ?? "—"}</div>
              </div>
              <div>
                <div className="text-slate-500 dark:text-slate-300">รหัส TGS</div>
                <div className="font-semibold tabular-nums">{receipt.tgs_id ?? "—"}</div>
              </div>
              <div>
                <div className="text-slate-500 dark:text-slate-300">วันที่บันทึก</div>
                <div className="font-semibold tabular-nums">{receipt.buy_date ?? "—"}</div>
              </div>
              <div>
                <div className="text-slate-500 dark:text-slate-300">มูลค่าที่ซื้อ</div>
                <div className="font-semibold tabular-nums">{fmt3(receipt.value_bought)}</div>
              </div>
              <div>
                <div className="text-slate-500 dark:text-slate-300">ค่าธรรมเนียม</div>
                <div className="font-semibold tabular-nums">{fmt3(receipt.fee ?? 0)}</div>
              </div>
              <div>
                <div className="text-slate-500 dark:text-slate-300">รวมต้องชำระ</div>
                <div className="font-semibold tabular-nums">{fmt3(receipt.total_due)}</div>
              </div>
              <div>
                <div className="text-slate-500 dark:text-slate-300">ยอดรวมหุ้นหลังซื้อ</div>
                <div className="font-semibold tabular-nums">
                  {fmt3(receipt.total_share_after)}
                </div>
              </div>
            </div>
            <p className="mt-3 text-sm text-slate-600 dark:text-slate-300">
              * คิดค่าธรรมเนียมเฉพาะการซื้อครั้งแรกของสมาชิก
            </p>
            <button
              type="button"
              onClick={() => printShareReceipt(receipt)}
              className="mt-4 inline-flex min-h-touch items-center justify-center gap-2 rounded-2xl border border-slate-300 bg-white px-5 py-2.5 text-base font-medium text-slate-700 shadow-sm transition-colors duration-200 hover:bg-slate-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 cursor-pointer md:min-h-0 dark:border-slate-600 dark:bg-slate-700/60 dark:text-white dark:hover:bg-slate-700"
            >
              <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="size-5">
                <path d="M6 9V2h12v7" /><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2" /><path d="M6 14h12v8H6z" />
              </svg>
              พิมพ์ใบเสร็จ
            </button>
          </SectionCard>
          </div>
        )}
      </div>

      <ConfirmDialog
        open={confirmOpen}
        title="ยืนยันการซื้อหุ้น"
        description="ตรวจข้อมูลก่อนบันทึก — บันทึกแล้วแก้ไขในหน้านี้ไม่ได้"
        confirmLabel="ยืนยันซื้อหุ้น"
        loading={submitting}
        onConfirm={submit}
        onCancel={() => setConfirmOpen(false)}
      >
        {picked && (
          <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1.5 text-base">
            <dt className="text-slate-500 dark:text-slate-400">สมาชิก</dt>
            <dd className="font-medium text-slate-900 dark:text-slate-100">{`${picked.first_name ?? ""} ${picked.last_name ?? ""}`.trim() || "-"}</dd>
            <dt className="text-slate-500 dark:text-slate-400">เลขสมาชิก</dt>
            <dd className="tabular-nums text-slate-900 dark:text-slate-100">{picked.member_id ?? "-"}</dd>
            <dt className="text-slate-500 dark:text-slate-400">วันที่ซื้อ</dt>
            <dd className="tabular-nums text-slate-900 dark:text-slate-100">{buyDate}</dd>
            <dt className="text-slate-500 dark:text-slate-400">จำนวน</dt>
            <dd className="text-lg font-bold tabular-nums text-slate-900 dark:text-slate-100">{thb(Number(amountValue(amountRaw)) || 0)}</dd>
          </dl>
        )}
      </ConfirmDialog>

      <ResultSheet
        open={!!failure}
        tone="error"
        title={failure?.title ?? ""}
        description={failure?.description}
        lines={failure?.lines ?? []}
        primary={
          failure?.primary === "retry"
            ? { label: "ลองอีกครั้ง", onClick: () => { setFailure(null); setTimeout(submit, 0) } }
            : { label: "แก้ไขข้อมูล", onClick: () => setFailure(null) }
        }
        secondary={{ label: "ปิด", onClick: () => setFailure(null) }}
        onClose={() => setFailure(null)}
      />
    </div>
  )
}

export default Share
