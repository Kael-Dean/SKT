// src/pages/MemberTermination.jsx
import { useEffect, useMemo, useRef, useState } from "react"
import { apiAuth } from "../lib/api" // ✅ แนบ token อัตโนมัติ + JSON ให้แล้ว

/** ---------- Utils ---------- */
const onlyDigits = (s = "") => s.replace(/\D+/g, "")
const cx = (...a) => a.filter(Boolean).join(" ")
function useDebounce(value, delay = 350) {
  const [debounced, setDebounced] = useState(value)
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delay)
    return () => clearTimeout(t)
  }, [value, delay])
  return debounced
}

// ใช้เทียบว่าข้อความในช่องเท่ากับสมาชิกที่เลือกแล้วหรือไม่
const norm = (s = "") => s.trim().replace(/\s+/g, " ")
const isQueryEqualPicked = (q, picked) => {
  if (!picked) return false
  const full = norm(`${picked.first_name ?? ""} ${picked.last_name ?? ""}`)
  return norm(q) === full || q === picked.citizen_id
}

/** ---------- สไตล์พื้นฐาน ---------- */
const baseField =
  "w-full rounded-2xl border border-slate-300 bg-slate-100 p-3 text-[15px] md:text-base " +
  "text-black outline-none placeholder:text-slate-500 focus:border-emerald-600 focus:ring-2 focus:ring-emerald-500/30 shadow-none " +
  "dark:border-slate-500 dark:bg-slate-700 dark:text-slate-100 dark:placeholder:text-slate-300 dark:focus:border-emerald-400 dark:focus:ring-emerald-400/30"
const fieldError = "border-red-500 ring-2 ring-red-300 focus:ring-0 focus:border-red-500"
const labelCls = "mb-1 block text-[15px] md:text-base font-medium text-slate-700 dark:text-slate-200"
const helpTextCls = "mt-1 text-sm text-slate-600 dark:text-slate-300"
const errorTextCls = "mt-1 text-sm text-red-500"

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
      {subtitle && <p className="mb-4 text-sm text-slate-600 dark:text-slate-300">{subtitle}</p>}
      {children}
    </div>
  )
}

/** ---------- การ์ดเลือกโหมด (toggle style) ---------- */
function ChoiceCard({ active = false, icon, label, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cx(
        "group relative flex items-center gap-4 rounded-3xl border p-4 sm:p-5 min-h-[78px] w-full text-left transition-all",
        "border-slate-200 bg-white/85 shadow-[0_4px_14px_rgba(0,0,0,0.06)]",
        "hover:border-emerald-300/70 hover:shadow-[0_10px_26px_rgba(0,0,0,0.12)]",
        "dark:border-slate-700 dark:bg-slate-700/40",
        active
          ? "ring-2 ring-emerald-400 shadow-[0_12px_30px_rgba(16,185,129,0.25)] bg-emerald-50/60 dark:ring-emerald-500 dark:bg-emerald-400/10"
          : "ring-0"
      )}
    >
      <span
        className={cx(
          "relative inline-flex h-8 w-14 flex-shrink-0 items-center rounded-full transition-colors",
          active ? "bg-emerald-600" : "bg-slate-300 dark:bg-slate-600"
        )}
        aria-hidden="true"
      >
        <span
          className={cx(
            "inline-block h-7 w-7 transform rounded-full bg-white shadow transition",
            "shadow-[0_3px_10px_rgba(0,0,0,0.25)]",
            active ? "translate-x-7" : "translate-x-1",
            "group-hover:scale-105"
          )}
        />
      </span>
      <div className="flex items-center gap-3">
        <span className="text-xl">{icon}</span>
        <span className="text-[15px] md:text-base font-semibold text-slate-800 dark:text-slate-100">{label}</span>
      </div>
      <span
        className={cx(
          "pointer-events-none absolute inset-0 rounded-3xl transition-opacity",
          "bg-emerald-100/30 dark:bg-emerald-400/10",
          active ? "opacity-100" : "opacity-0 group-hover:opacity-100"
        )}
        aria-hidden="true"
      />
    </button>
  )
}

/** ---------- หน้า MemberTermination ---------- */
function MemberTermination() {
  const [mode, setMode] = useState("") // "resigned" | "passed"
  const [query, setQuery] = useState("")
  const debQ = useDebounce(query, 350)

  const [results, setResults] = useState([])
  const [loading, setLoading] = useState(false)

  const [showList, setShowList] = useState(false)
  const [highlighted, setHighlighted] = useState(-1)
  const listBoxRef = useRef(null)
  const itemRefs = useRef([])
  const inputRef = useRef(null)

  const [picked, setPicked] = useState(null)
  const [errors, setErrors] = useState({})
  const [submitting, setSubmitting] = useState(false)
  const topRef = useRef(null)

  // ค้นหา
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
          // ❗️อย่าเปิดลิสต์ถ้า query เท่ากับสมาชิกที่เลือกอยู่แล้ว
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
    return () => { aborted = true }
  }, [debQ, picked])

  // ปิดดรอปดาวน์ถ้าคลิกนอก
  useEffect(() => {
    function onDocClick(e) {
      if (!listBoxRef.current && !inputRef.current) return
      if (listBoxRef.current?.contains(e.target) || inputRef.current?.contains(e.target)) return
      setShowList(false)
    }
    document.addEventListener("mousedown", onDocClick)
    return () => document.removeEventListener("mousedown", onDocClick)
  }, [])

  // scroll ให้ item ที่ไฮไลต์โชว์เสมอ
  const scrollIntoView = (idx) => {
    try {
      itemRefs.current[idx]?.scrollIntoView({ block: "nearest" })
    } catch {}
  }

  // เลือกเรคคอร์ด
  const pickResult = (r) => {
    setPicked(r)
    setQuery(`${r.first_name ?? ""} ${r.last_name ?? ""}`.trim() || r.citizen_id || "")
    setErrors((p) => ({ ...p, picked: undefined }))
    setShowList(false)
  }

  // คีย์บอร์ดบนช่องค้นหา
  const onKeyDown = (e) => {
    if (!showList || results.length === 0) return
    if (e.key === "ArrowDown") {
      e.preventDefault()
      const next = (highlighted + 1) % results.length
      setHighlighted(next)
      requestAnimationFrame(() => scrollIntoView(next))
    } else if (e.key === "ArrowUp") {
      e.preventDefault()
      const next = (highlighted - 1 + results.length) % results.length
      setHighlighted(next)
      requestAnimationFrame(() => scrollIntoView(next))
    } else if (e.key === "Enter") {
      e.preventDefault()
      const idx = highlighted >= 0 ? highlighted : 0
      if (results[idx]) pickResult(results[idx])
    } else if (e.key === "Escape") {
      setShowList(false)
    }
  }

  // validator
  const validate = () => {
    const e = {}
    if (!mode) e.mode = "เลือกประเภทการสิ้นสภาพสมาชิก"
    if (!picked) e.picked = "เลือกสมาชิก"
    setErrors(e)
    return Object.keys(e).length === 0
  }

  const reset = () => {
    setMode("")
    setQuery("")
    setResults([])
    setPicked(null)
    setErrors({})
    setShowList(false)
    setHighlighted(-1)
    requestAnimationFrame(() => {
      try { topRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }) } catch {}
    })
  }

  const submit = async () => {
    if (!validate()) return
    try {
      setSubmitting(true)
      await apiAuth(`/member/members/${picked.member_id}/status`, {
        method: "PATCH",
        body: { status: mode }, // "resigned" | "passed"
      })
      alert(mode === "resigned" ? "บันทึกการลาออกเรียบร้อย ✅" : "บันทึกการเสียชีวิตเรียบร้อย ✅")
      reset()
    } catch (err) {
      console.error(err)
      alert(`บันทึกล้มเหลว: ${err?.message || "ไม่ทราบสาเหตุ"}`)
    } finally {
      setSubmitting(false)
    }
  }

  const actionLabel = mode === "passed" ? "บันทึกการเสียชีวิต" : "บันทึกการลาออก"

  const pickedPreview = useMemo(() => {
    if (!picked) return ""
    return `#${picked.member_id} • ${picked.first_name || "-"} ${picked.last_name || "-"} • ${picked.citizen_id || "-"}`
  }, [picked])

  /** ---------- UI ---------- */
  return (
    <div className="min-h-screen bg-white text-black dark:bg-slate-900 dark:text-white rounded-2xl text-[15px] md:text-base">
      <div className="mx-auto max-w-5xl p-5 md:p-6 lg:p-8">
        <h1 ref={topRef} tabIndex={-1} className="mb-1 text-3xl font-bold">
          👥 สมาชิกสิ้นสภาพ
        </h1>
        <p className="mb-5 text-slate-600 dark:text-slate-300">
          เลือกประเภท <span className="font-medium">“ลาออก”</span> หรือ <span className="font-medium">“เสียชีวิต”</span> (เลือกได้อย่างใดอย่างหนึ่ง)
          แล้วค้นหาและเลือกสมาชิกเพื่อบันทึกสถานะไปยังระบบ
        </p>

        {/* เลือกโหมด */}
        <SectionCard title="ประเภทการสิ้นสภาพ" className="mb-6">
          <div className="grid gap-3 sm:grid-cols-2">
            <ChoiceCard
              active={mode === "resigned"}
              icon=""
              label="ลาออก"
              onClick={() => { setMode("resigned"); setErrors((p) => ({ ...p, mode: undefined })) }}
            />
            <ChoiceCard
              active={mode === "passed"}
              icon=""
              label="เสียชีวิต"
              onClick={() => { setMode("passed"); setErrors((p) => ({ ...p, mode: undefined })) }}
            />
          </div>
          {errors.mode && <p className={errorTextCls}>{errors.mode}</p>}
        </SectionCard>

        {/* ค้นหา/เลือกสมาชิก (ดรอปดาวน์สไตล์เดียวกับหน้า “ซื้อ”) */}
        <SectionCard title="เลือกสมาชิก" className="mb-6">
          <label className={labelCls}>ค้นหาสมาชิกจากชื่อ-นามสกุล หรือเลขบัตรประชาชน</label>
          <input
            ref={inputRef}
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
              if (query.trim().length >= 2 && results.length > 0 && !isQueryEqualPicked(query, picked)) {
                setShowList(true)
              }
            }}
            onKeyDown={onKeyDown}
            placeholder="ตัวอย่าง: สมชาย ใจดี หรือ 1234567890123"
            aria-expanded={showList}
            aria-controls="member-results"
            role="combobox"
            aria-autocomplete="list"
            aria-invalid={errors.picked ? true : undefined}
          />
          {errors.picked && <p className={errorTextCls}>{errors.picked}</p>}
          <div className="mt-1 text-xs md:text-sm text-slate-500 dark:text-slate-400">
            {query.trim()
              ? (loading ? "กำลังค้นหา..." : `ผลลัพธ์ ${results.length} รายการ`)
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

          {/* แสดงรายการที่เลือก */}
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

        {/* ปุ่มดำเนินการ */}
        <div className="flex flex-col gap-3 sm:flex-row">
          <button
            type="button"
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
          >
            {submitting ? "กำลังบันทึก..." : actionLabel}
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
      </div>
    </div>
  )
}

export default MemberTermination
