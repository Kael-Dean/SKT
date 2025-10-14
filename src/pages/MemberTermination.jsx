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

/** ---------- สไตล์พื้นฐาน (อิงจาก MemberSignup.jsx) ---------- */
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

/** ---------- Result Row (รายการสมาชิก) ---------- */
function MemberRow({ item, onPick, isActive = false }) {
  return (
    <button
      type="button"
      onClick={() => onPick?.(item)}
      className={cx(
        "w-full text-left px-3 py-2.5 rounded-xl transition flex items-center gap-3",
        isActive
          ? "bg-emerald-100 ring-1 ring-emerald-300 dark:bg-emerald-400/20 dark:ring-emerald-500"
          : "hover:bg-emerald-50 dark:hover:bg-slate-700/60"
      )}
    >
      <div className="flex-1">
        <div className="font-medium">
          {item.first_name || "-"} {item.last_name || "-"}{" "}
          <span className="text-xs text-slate-500">#{item.member_id}</span>
        </div>
        <div className="text-xs text-slate-600 dark:text-slate-300">
          บัตร: {item.citizen_id || "-"} • โทร: {item.phone_number || "-"}
        </div>
      </div>
      <div className="text-xs px-2 py-1 rounded-lg bg-slate-100 dark:bg-slate-700">
        {item.province || item.district || "—"}
      </div>
    </button>
  )
}

/** ---------- หน้า MemberTermination ---------- */
function MemberTermination() {
  const [mode, setMode] = useState("") // "resigned" | "passed"
  const [query, setQuery] = useState("")
  const [results, setResults] = useState([])
  const [loading, setLoading] = useState(false)
  const [picked, setPicked] = useState(null)
  const [errors, setErrors] = useState({})
  const [submitting, setSubmitting] = useState(false)
  const topRef = useRef(null)

  const debQ = useDebounce(query, 350)

  // ค้นหาสมาชิก
  useEffect(() => {
    const q = (debQ || "").trim()
    if (!q || q.length < 2) {
      setResults([])
      return
    }

    let aborted = false
    ;(async () => {
      try {
        setLoading(true)
        const data = await apiAuth(`/member/members/search?q=${encodeURIComponent(q)}`)
        if (!aborted) setResults(Array.isArray(data) ? data.slice(0, 20) : [])
      } catch (e) {
        if (!aborted) setResults([])
      } finally {
        if (!aborted) setLoading(false)
      }
    })()
    return () => { aborted = true }
  }, [debQ])

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
    requestAnimationFrame(() => {
      try {
        topRef.current?.scrollIntoView({ behavior: "smooth", block: "start" })
      } catch {}
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

  const ModeButton = ({ value, label, icon }) => {
    const active = mode === value
    return (
      <button
        type="button"
        onClick={() => { setMode(value); setErrors((p) => ({ ...p, mode: undefined })) }}
        className={cx(
          "flex-1 min-h-[64px] rounded-2xl border px-4 py-3 text-left transition",
          active
            ? "border-emerald-400 ring-2 ring-emerald-300 bg-emerald-50 dark:ring-emerald-500 dark:bg-emerald-400/10"
            : "border-slate-200 hover:border-emerald-300/70 hover:shadow-sm dark:border-slate-700"
        )}
      >
        <div className="flex items-center gap-3">
          <span className="text-xl">{icon}</span>
          <div className="font-semibold">{label}</div>
        </div>
      </button>
    )
  }

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
          <div className="flex flex-col gap-3 sm:flex-row">
            <ModeButton value="resigned" label="ลาออก" icon="📤" />
            <ModeButton value="passed" label="เสียชีวิต" icon="🕯️" />
          </div>
          {errors.mode && <p className={errorTextCls}>{errors.mode}</p>}
          <p className={helpTextCls}>ระบบจะส่งค่า <code>status</code> = <code>{mode || "resigned|passed"}</code> ไปยัง API <code>PATCH /member/members/{{member_id}}/status</code></p>
        </SectionCard>

        {/* ค้นหา/เลือกสมาชิก */}
        <SectionCard title="เลือกสมาชิก" className="mb-6">
          <label className={labelCls}>ค้นหาสมาชิกจากชื่อ-นามสกุล หรือเลขบัตรประชาชน</label>
          <input
            className={cx(baseField, errors.picked && fieldError)}
            value={query}
            onChange={(e) => {
              setQuery(e.target.value)
              setErrors((p) => ({ ...p, picked: undefined }))
              setPicked(null)
            }}
            placeholder="ตัวอย่าง: สมชาย ใจดี หรือ 1234567890123"
            aria-invalid={errors.picked ? true : undefined}
          />
          {errors.picked && <p className={errorTextCls}>{errors.picked}</p>}

          <div className="mt-3 rounded-2xl border border-slate-200 dark:border-slate-700 overflow-hidden">
            <div className="px-3 py-2 text-sm bg-slate-50 dark:bg-slate-700/60">
              {loading ? "กำลังค้นหา..." : results.length ? `ผลลัพธ์ ${results.length} รายการ` : "ยังไม่มีผลลัพธ์"}
            </div>
            <div className="max-h-80 overflow-auto p-2 bg-white dark:bg-slate-800">
              {results.map((r) => (
                <MemberRow key={`${r.member_id}-${r.citizen_id}`} item={r} onPick={setPicked} isActive={picked?.member_id === r.member_id} />
              ))}
            </div>
          </div>

          {/* แสดงรายการที่เลือก */}
          <div className="mt-4">
            <div className="text-sm text-slate-600 dark:text-slate-300">สมาชิกที่เลือก</div>
            <div
              className={cx(
                "mt-1 rounded-xl px-3 py-2 text-[15px]",
                picked ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-200" : "bg-slate-100 text-slate-700 dark:bg-slate-800/60 dark:text-slate-200"
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
