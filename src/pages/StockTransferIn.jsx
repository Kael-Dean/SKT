// src/pages/StockTransferIn.jsx
import { useEffect, useMemo, useRef, useState, forwardRef, useImperativeHandle } from "react"
import { get, post } from "../lib/api"

/** ---------- Utils ---------- */
const toNumber = (v) => (v === "" || v === null || v === undefined ? 0 : Number(v))
const thb = (n) =>
  new Intl.NumberFormat("th-TH", { style: "currency", currency: "THB", maximumFractionDigits: 2 }).format(
    isFinite(n) ? n : 0
  )
const cx = (...a) => a.filter(Boolean).join(" ")

/** ---------- Styles ---------- */
const baseField =
  "w-full rounded-2xl border border-slate-300 bg-slate-100 p-3 text-[15px] md:text-base " +
  "text-black outline-none placeholder:text-slate-500 focus:border-emerald-600 focus:ring-2 focus:ring-emerald-500/30 shadow-none " +
  "dark:border-slate-500 dark:bg-slate-700 dark:text-slate-100 dark:placeholder:text-slate-300 dark:focus:border-emerald-400 dark:focus:ring-emerald-400/30"

const fieldDisabled =
  "bg-slate-100 text-slate-600 cursor-not-allowed opacity-95 dark:bg-slate-700/70 dark:text-slate-300"
const labelCls = "mb-1 block text-[15px] md:text-base font-medium text-slate-700 dark:text-slate-200"
const helpTextCls = "mt-1 text-sm text-slate-600 dark:text-slate-300"
const errorTextCls = "mt-1 text-sm text-red-500"

/** ---------- ComboBox (generic) ---------- */
function ComboBox({
  options = [],
  value,
  onChange,
  placeholder = "— เลือก —",
  getLabel = (o) => o?.label ?? "",
  getValue = (o) => o?.id ?? o?.value ?? "",
  disabled = false,
  error = false,
  buttonRef = null,
  hintRed = false,
  clearHint = () => {},
}) {
  const [open, setOpen] = useState(false)
  const [highlight, setHighlight] = useState(-1)
  const boxRef = useRef(null)
  const listRef = useRef(null)
  const internalBtnRef = useRef(null)
  const controlRef = buttonRef || internalBtnRef

  const selectedLabel = useMemo(() => {
    const found = options.find((o) => String(getValue(o)) === String(value))
    return found ? getLabel(found) : ""
  }, [options, value, getLabel, getValue])

  useEffect(() => {
    const onClick = (e) => {
      if (!boxRef.current) return
      if (!boxRef.current.contains(e.target)) {
        setOpen(false)
        setHighlight(-1)
      }
    }
    document.addEventListener("click", onClick)
    return () => document.removeEventListener("click", onClick)
  }, [])

  const commit = (opt) => {
    const v = String(getValue(opt))
    onChange?.(v, opt)
    setOpen(false)
    setHighlight(-1)
    clearHint?.()
    requestAnimationFrame(() => controlRef.current?.focus())
  }

  const scrollHighlightedIntoView = (index) => {
    const listEl = listRef.current
    const itemEl = listEl?.children?.[index]
    if (!listEl || !itemEl) return
    const itemRect = itemEl.getBoundingClientRect()
    const listRect = listEl.getBoundingClientRect()
    const buffer = 6
    if (itemRect.top < listRect.top + buffer) {
      listEl.scrollTop -= (listRect.top + buffer) - itemRect.top
    } else if (itemRect.bottom > listRect.bottom - buffer) {
      listEl.scrollTop += itemRect.bottom - (listRect.bottom - buffer)
    }
  }

  const onKeyDown = (e) => {
    if (disabled) return
    if (!open && (e.key === "Enter" || e.key === " " || e.key === "ArrowDown")) {
      e.preventDefault()
      setOpen(true)
      setHighlight((h) => (h >= 0 ? h : 0))
      clearHint?.()
      return
    }
    if (!open) return

    if (e.key === "ArrowDown") {
      e.preventDefault()
      setHighlight((h) => {
        const next = h < options.length - 1 ? h + 1 : 0
        requestAnimationFrame(() => scrollHighlightedIntoView(next))
        return next
      })
    } else if (e.key === "ArrowUp") {
      e.preventDefault()
      setHighlight((h) => {
        const prev = h > 0 ? h - 1 : options.length - 1
        requestAnimationFrame(() => scrollHighlightedIntoView(prev))
        return prev
      })
    } else if (e.key === "Enter") {
      e.preventDefault()
      if (highlight >= 0 && highlight < options.length) commit(options[highlight])
    } else if (e.key === "Escape") {
      e.preventDefault()
      setOpen(false)
      setHighlight(-1)
    }
  }

  return (
    <div className="relative" ref={boxRef}>
      <button
        type="button"
        ref={controlRef}
        disabled={disabled}
        onClick={() => !disabled && setOpen((o) => !o)}
        onKeyDown={onKeyDown}
        className={cx(
          "w-full rounded-2xl border p-3 text-left text-[15px] md:text-base outline-none transition shadow-none",
          disabled ? "bg-slate-100 cursor-not-allowed" : "bg-slate-100 hover:bg-slate-200 cursor-pointer",
          error
            ? "border-red-400 ring-2 ring-red-300/70"
            : "border-slate-300 focus:border-emerald-600 focus:ring-2 focus:ring-emerald-500/30",
          "dark:border-slate-500 dark:bg-slate-700 dark:text-slate-100 dark:hover:bg-slate-700/80",
          hintRed && "ring-2 ring-red-300 animate-pulse"
        )}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-invalid={error || hintRed ? true : undefined}
      >
        {selectedLabel || <span className="text-slate-500 dark:text-white/70">{placeholder}</span>}
      </button>

      {open && (
        <div
          ref={listRef}
          role="listbox"
          className="absolute z-20 mt-1 max-h-72 w-full overflow-auto rounded-2xl border border-slate-200 bg-white text-black shadow-lg dark:border-slate-700 dark:bg-slate-800 dark:text-white"
        >
          {options.length === 0 && (
            <div className="px-3 py-2 text-sm text-slate-600 dark:text-slate-300">ไม่มีตัวเลือก</div>
          )}
          {options.map((opt, idx) => {
            const label = getLabel(opt)
            const isActive = idx === highlight
            const isChosen = String(getValue(opt)) === String(value)
            return (
              <button
                key={String(getValue(opt)) || label || idx}
                type="button"
                role="option"
                aria-selected={isChosen}
                onMouseEnter={() => setHighlight(idx)}
                onClick={() => commit(opt)}
                className={cx(
                  "relative flex w-full items-center gap-2 px-3 py-2.5 text-left text-[15px] md:text-base transition rounded-xl cursor-pointer",
                  isActive
                    ? "bg-emerald-100 ring-1 ring-emerald-300 dark:bg-emerald-400/20 dark:ring-emerald-500"
                    : "hover:bg-emerald-50 dark:hover:bg-emerald-900/30"
                )}
              >
                {isActive && (
                  <span className="absolute left-0 top-0 h-full w-1 bg-emerald-600 dark:bg-emerald-400/70 rounded-l-xl" />
                )}
                <span className="flex-1">{label}</span>
                {isChosen && <span className="text-emerald-600 dark:text-emerald-300">✓</span>}
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}

/** ---------- DateInput ---------- */
const DateInput = forwardRef(function DateInput({ error = false, className = "", ...props }, ref) {
  const inputRef = useRef(null)
  useImperativeHandle(ref, () => inputRef.current)

  return (
    <div className="relative">
      <style>{`input[type="date"]::-webkit-calendar-picker-indicator { opacity: 0; }`}</style>
      <input
        type="date"
        ref={inputRef}
        className={cx(
          baseField,
          "pr-12 cursor-pointer",
          error && "border-red-400 ring-2 ring-red-300/70",
          className
        )}
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
        <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor" className="text-slate-600 dark:text-slate-200">
          <path d="M7 2a1 1 0 0 1 1 1v1h8V3a1 1 0 1 1 2 0v1h1a2 2 0 0 1 2 2v3H3V6a2 2 0 0 1 2-2h1V3a1 1 0 1 1 1-1zm14 9v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-7h18zM7 14h2v2H7v-2zm4 0h2v2h-2v-2z" />
        </svg>
      </button>
    </div>
  )
})

/** ---------- Main Page ---------- */
function StockTransferIn() {
  const [submitting, setSubmitting] = useState(false)

  /** ---------- Requests (inbox) ---------- */
  const [loadingRequests, setLoadingRequests] = useState(false)
  const [requests, setRequests] = useState([])

  /** ---------- Form ---------- */
  const [form, setForm] = useState({
    transfer_id: null,
    transfer_date: new Date().toISOString().slice(0, 10),

    // ชั่ง/หมายเหตุฝั่งผู้รับ
    weight_in: "",
    weight_out: "",
    quality_note: "",

    // สิ่งเจือปน (%)
    impurity_percent: "",

    // เพิ่มตาม transferout
    price_per_kilo: "", // ราคาต้นทุน/กก. — ออโต้ฟิลจากคำขอ
    dest_quality: "",   // คุณภาพ (ตัวเลข/คะแนนหรือ %)
  })
  const update = (k, v) => setForm((p) => ({ ...p, [k]: v }))

  const weightIn = useMemo(() => toNumber(form.weight_in), [form.weight_in])
  const weightOut = useMemo(() => toNumber(form.weight_out), [form.weight_out])
  const netWeight = useMemo(() => Math.max(weightIn - weightOut, 0), [weightIn, weightOut])

  // รวมต้นทุน (เพื่อแสดงผลเหมือน transferout)
  const totalCost = useMemo(() => toNumber(form.price_per_kilo) * netWeight, [form.price_per_kilo, netWeight])

  const [errors, setErrors] = useState({})
  const [missingHints, setMissingHints] = useState({})
  const redFieldCls = (key) =>
    errors[key] || missingHints[key] ? "border-red-500 ring-2 ring-red-300 focus:ring-0 focus:border-red-500" : ""
  const redHintCls = (key) =>
    missingHints[key] ? "border-red-400 ring-2 ring-red-300 focus:border-red-400 animate-pulse" : ""
  const clearError = (key) =>
    setErrors((prev) => {
      if (!(key in prev)) return prev
      const { [key]: _omit, ...rest } = prev
      return rest
    })
  const clearHint = (key) => setMissingHints((prev) => (prev[key] ? { ...prev, [key]: false } : prev))

  /** ---------- โหลดรายการคำขอ ---------- */
  useEffect(() => {
    let timer = null
    let alive = true
    async function fetchRequests() {
      try {
        setLoadingRequests(true)
        const data = await get(`/transfer/pending/incoming`)
        if (alive) setRequests(Array.isArray(data) ? data : [])
      } catch (e) {
        if (alive) setRequests([])
      } finally {
        if (alive) setLoadingRequests(false)
      }
    }
    fetchRequests()
    timer = setInterval(fetchRequests, 20000)
    return () => {
      alive = false
      if (timer) clearInterval(timer)
    }
  }, [])

  /** ---------- เลือกคำขอ ---------- */
  const pickRequest = (req) => {
    update("transfer_id", req.id ?? null)

    // ออโต้ฟิลราคาต้นทุน/กก. จากคำขอฝั่งโอนออก
    update("price_per_kilo", req?.price_per_kilo != null ? String(req.price_per_kilo) : "")

    // reset ช่องผู้รับ
    update("weight_in", "")
    update("weight_out", "")
    update("impurity_percent", "")
    update("quality_note", "")
    update("dest_quality", "")
    setErrors({})
    setMissingHints({})
  }

  /** ---------- Validate ---------- */
  const computeMissingHints = () => {
    const m = {}
    if (!form.transfer_date) m.transfer_date = true
    if (!form.transfer_id) m.transfer_id = true
    if (!form.weight_in || Number(form.weight_in) <= 0) m.weight_in = true
    if (form.weight_out === "" || Number(form.weight_out) < 0) m.weight_out = true
    if (netWeight <= 0) m.net_weight = true
    return m
  }

  const validate = () => {
    const e = {}
    if (!form.transfer_date) e.transfer_date = "กรุณาเลือกวันที่รับเข้า"
    if (!form.transfer_id) e.transfer_id = "กรุณาเลือกคำขอโอนจากรายการด้านบนก่อน"
    if (weightIn <= 0) e.weight_in = "น้ำหนักชั่งเข้า ต้องมากกว่า 0"
    if (weightOut < 0) e.weight_out = "น้ำหนักชั่งออก ต้องไม่ติดลบ"
    if (netWeight <= 0) e.net_weight = "น้ำหนักสุทธิต้องมากกว่า 0 (ตรวจค่าชั่งเข้า/ออก)"
    if (form.impurity_percent !== "") {
      const ip = toNumber(form.impurity_percent)
      if (!isFinite(ip) || ip < 0 || ip > 100) e.impurity_percent = "กรุณากรอก 0–100"
    }
    if (form.dest_quality !== "") {
      const q = toNumber(form.dest_quality)
      if (!isFinite(q)) e.dest_quality = "กรุณากรอกตัวเลข"
    }
    setErrors(e)
    return Object.keys(e).length === 0
  }

  /** ---------- Submit (ACCEPT) ---------- */
  const handleSubmit = async (e) => {
    e.preventDefault()
    const hints = computeMissingHints()
    setMissingHints(hints)
    if (!validate()) return

    setSubmitting(true)
    try {
      const payload = {
        action: "ACCEPT",
        dest_entry_weight: toNumber(form.weight_in),
        dest_exit_weight: toNumber(form.weight_out),
        dest_weight: netWeight,
        dest_impurity: form.impurity_percent === "" ? null : toNumber(form.impurity_percent),
        dest_quality: form.dest_quality === "" ? null : toNumber(form.dest_quality),
        receiver_note: form.quality_note?.trim() || null,
        // ไม่ส่ง price ไป เพราะ backend ยังไม่รับฟิลด์นี้ใน TransferConfirm
      }

      await post(`/transfer/confirm/${encodeURIComponent(form.transfer_id)}`, payload)

      alert("บันทึกรับเข้าสำเร็จ ✅")

      // เคลียร์ฟอร์ม
      setForm((f) => ({
        ...f,
        transfer_id: null,
        weight_in: "",
        weight_out: "",
        quality_note: "",
        impurity_percent: "",
        price_per_kilo: "",
        dest_quality: "",
      }))

      // refresh กล่องคำขอ
      try {
        const data = await get(`/transfer/pending/incoming`)
        setRequests(Array.isArray(data) ? data : [])
      } catch {}
    } catch (err) {
      console.error(err)
      alert(err?.message || "เกิดข้อผิดพลาดระหว่างบันทึก")
    } finally {
      setSubmitting(false)
    }
  }

  /** ---------- Reject ---------- */
  const handleReject = async (reqId) => {
    if (!reqId) return
    const note = prompt("ระบุเหตุผลที่ปฏิเสธ (ถ้ามี):") ?? ""
    try {
      await post(`/transfer/confirm/${encodeURIComponent(reqId)}`, {
        action: "REJECT",
        receiver_note: note.trim() || null,
      })
      alert("ปฏิเสธคำขอเรียบร้อย")
      const data = await get(`/transfer/pending/incoming`)
      setRequests(Array.isArray(data) ? data : [])
    } catch (e) {
      console.error(e)
      alert(e?.message || "ปฏิเสธไม่สำเร็จ")
    }
  }

  return (
    <div className="min-h-screen bg-white text-black dark:bg-slate-900 dark:text-white rounded-2xl text-[15px] md:text-base">
      <div className="mx-auto max-w-7xl p-5 md:p-6 lg:p-8">
        <h1 className="mb-4 text-3xl font-bold text-gray-900 dark:text-white">📦 รับเข้าข้าวเปลือก</h1>

        {/* คำขอที่รอเข้าจาก backend ใหม่ */}
        <div className="mb-6 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-700 dark:bg-slate-800">
          <div className="mb-3 flex items-center gap-3">
            <h2 className="text-xl font-semibold">คำขอโอนเข้าที่รอดำเนินการ</h2>
            <span className="inline-flex items-center justify-center rounded-full bg-emerald-100 px-3 py-1.5 text-emerald-700 ring-1 ring-emerald-200 dark:bg-emerald-900/20 dark:text-emerald-200 dark:ring-emerald-700/60">
              {loadingRequests ? "กำลังโหลด..." : `ทั้งหมด ${requests.length} รายการ`}
            </span>
          </div>

          {requests.length === 0 ? (
            <div className="text-slate-600 dark:text-slate-300">ยังไม่มีคำขอโอนเข้ามาในสาขาของคุณ</div>
          ) : (
            <div className="grid gap-3 md:grid-cols-2">
              {requests.map((req) => (
                <div
                  key={req.id}
                  className="rounded-2xl bg-white p-4 text-black shadow-sm ring-1 ring-slate-200 dark:bg-slate-800 dark:text-white dark:ring-slate-700"
                >
                  <div className="flex items-center justify-between gap-3">
                    <div className="font-semibold">เลขคำขอ: {req.id}</div>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => handleReject(req.id)}
                        className="rounded-xl border border-red-300 px-3 py-1.5 text-red-600 font-medium hover:bg-red-50 dark:hover:bg-red-900/20"
                      >
                        ปฏิเสธ
                      </button>
                      <button
                        type="button"
                        onClick={() => pickRequest(req)}
                        className="rounded-xl bg-emerald-600 px-3 py-1.5 text-white font-medium hover:bg-emerald-700 active:scale-[.98]"
                      >
                        รับเข้า
                      </button>
                    </div>
                  </div>
                  <div className="mt-2 text-sm text-slate-700 dark:text-slate-300">
                    <div>จากคลัง (ID): {req.from_klang ?? "-"}</div>
                    <div>ไปคลัง (ID): {req.to_klang ?? "-"}</div>
                    <div>สถานะ: {req.status ?? "-"}</div>
                    {req.price_per_kilo != null && (
                      <div>ราคาต้นทุน/กก. ที่เสนอ: {Number(req.price_per_kilo).toFixed(2)} บาท</div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* ฟอร์มรับเข้า (ผู้รับกรอกเฉพาะข้อมูลปลายทาง) */}
        <form onSubmit={handleSubmit}>
          {/* กล่อง: ข้อมูลการรับเข้า */}
          <div className="mb-6 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-700 dark:bg-slate-800">
            <h2 className="mb-3 text-xl font-semibold">ข้อมูลการรับเข้า</h2>

            <div className="grid gap-4 md:grid-cols-3">
              {/* วันที่รับเข้า */}
              <div>
                <label className={labelCls}>วันที่รับเข้า</label>
                <DateInput
                  value={form.transfer_date}
                  onChange={(e) => {
                    clearError("transfer_date")
                    clearHint("transfer_date")
                    update("transfer_date", e.target.value)
                  }}
                  error={!!errors.transfer_date}
                  className={redHintCls("transfer_date")}
                  aria-invalid={errors.transfer_date ? true : undefined}
                />
                {errors.transfer_date && <p className={errorTextCls}>{errors.transfer_date}</p>}
              </div>

              {/* แสดงเลขคำขอที่เลือก */}
              <div>
                <label className={labelCls}>เลขคำขอที่เลือก</label>
                <input
                  disabled
                  className={cx(baseField, fieldDisabled)}
                  value={form.transfer_id ?? ""}
                  placeholder="ยังไม่ได้เลือก"
                />
                {errors.transfer_id && <p className={errorTextCls}>{errors.transfer_id}</p>}
              </div>
            </div>
          </div>

          {/* กล่อง: ชั่งน้ำหนักและบันทึก */}
          <div className="mb-6 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-700 dark:bg-slate-800">
            <h2 className="mb-3 text-xl font-semibold">ชั่งน้ำหนักและบันทึก</h2>

            {/* แถวที่ 1: น้ำหนักเข้า/ออก/สุทธิ */}
            <div className="grid gap-4 md:grid-cols-3">
              <div>
                <label className={labelCls}>น้ำหนักชั่งเข้า (กก.)</label>
                <input
                  inputMode="decimal"
                  className={cx(baseField, redFieldCls("weight_in"))}
                  value={form.weight_in}
                  onChange={(e) => update("weight_in", e.target.value.replace(/[^\d.]/g, ""))}
                  onFocus={() => {
                    clearError("weight_in")
                    clearHint("weight_in")
                  }}
                  placeholder="เช่น 15000"
                  aria-invalid={errors.weight_in ? true : undefined}
                />
                {errors.weight_in && <p className={errorTextCls}>{errors.weight_in}</p>}
              </div>

              <div>
                <label className={labelCls}>น้ำหนักชั่งออก (กก.)</label>
                <input
                  inputMode="decimal"
                  className={cx(baseField, redFieldCls("weight_out"))}
                  value={form.weight_out}
                  onChange={(e) => update("weight_out", e.target.value.replace(/[^\d.]/g, ""))}
                  onFocus={() => {
                    clearError("weight_out")
                    clearHint("weight_out")
                  }}
                  placeholder="เช่น 2000"
                  aria-invalid={errors.weight_out ? true : undefined}
                />
                {errors.weight_out && <p className={errorTextCls}>{errors.weight_out}</p>}
              </div>

              <div>
                <label className={labelCls}>น้ำหนักสุทธิ (กก.)</label>
                <input
                  disabled
                  className={cx(baseField, fieldDisabled)}
                  value={Math.round(Math.max(weightIn - weightOut, 0) * 100) / 100}
                />
                {errors.net_weight && <p className={errorTextCls}>{errors.net_weight}</p>}
                <p className={helpTextCls}>คำนวณ = ชั่งเข้า − ชั่งออก</p>
              </div>
            </div>

            {/* แถวที่ 2: คุณภาพ & สิ่งเจือปน */}
            <div className="mt-4 grid gap-4 md:grid-cols-4">
              <div>
                <label className={labelCls}>คุณภาพ</label>
                <input
                  inputMode="decimal"
                  className={cx(baseField, errors.dest_quality && "border-red-400")}
                  value={form.dest_quality}
                  onChange={(e) => update("dest_quality", e.target.value.replace(/[^\d.]/g, ""))}
                  onFocus={() => clearError("dest_quality")}
                  placeholder="กรอกตัวเลข เช่น 95"
                  aria-invalid={errors.dest_quality ? true : undefined}
                />
                {errors.dest_quality && <p className={errorTextCls}>{errors.dest_quality}</p>}
              </div>

              <div>
                <label className={labelCls}>สิ่งเจือปน (%)</label>
                <input
                  inputMode="decimal"
                  className={cx(baseField, errors.impurity_percent && "border-red-400")}
                  value={form.impurity_percent}
                  onChange={(e) => update("impurity_percent", e.target.value.replace(/[^\d.]/g, ""))}
                  onFocus={() => clearError("impurity_percent")}
                  placeholder="เช่น 2.5"
                  aria-invalid={errors.impurity_percent ? true : undefined}
                />
                {errors.impurity_percent && <p className={errorTextCls}>{errors.impurity_percent}</p>}
                <p className={helpTextCls}>กรอกเป็นตัวเลข 0–100 (เว้นว่างได้)</p>
              </div>
            </div>

            {/* แถวสุดท้าย: บันทึกเพิ่มเติม */}
            <div className="mt-4">
              <label className={labelCls}>บันทึกเพิ่มเติม / เหตุผล (ผู้รับ)</label>
              <input
                className={baseField}
                value={form.quality_note}
                onChange={(e) => update("quality_note", e.target.value)}
                placeholder="เช่น ความชื้นสูง แกลบเยอะ หรือเหตุผลกรณีปฏิเสธ"
              />
            </div>
          </div>

          {/* กล่อง: ต้นทุนและคุณภาพ (เลย์เอาต์เหมือน transferout) */}
          <div className="mb-6 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-700 dark:bg-slate-800">
            <h2 className="mb-3 text-xl font-semibold">ต้นทุนและคุณภาพ</h2>
            <div className="grid gap-4 md:grid-cols-4">
              <div>
                <label className={labelCls}>ราคาต้นทุน/กก. (บาท)</label>
                <input
                  inputMode="decimal"
                  className={cx(baseField, fieldDisabled, "bg-slate-100 dark:bg-slate-700")}
                  value={form.price_per_kilo}
                  onChange={(e) => update("price_per_kilo", e.target.value.replace(/[^\d.]/g, ""))}
                  placeholder="ออโต้จากคำขอ"
                  disabled
                />
                <p className={helpTextCls}>ออโต้ฟิลจากคำขอฝั่งโอนออก</p>
              </div>

              <div>
                <label className={labelCls}>รวมต้นทุน (ประมาณ)</label>
                <input disabled className={cx(baseField, fieldDisabled)} value={thb(totalCost)} placeholder="—" />
                <p className={helpTextCls}>คำนวณ = ราคาต้นทุน/กก. × น้ำหนักสุทธิ</p>
              </div>
            </div>
          </div>

          {/* ปุ่ม */}
          <div className="mt-6 flex flex-col gap-3 sm:flex-row">
            <button
              type="submit"
              disabled={submitting}
              className="inline-flex items-center justify-center rounded-2xl 
                bg-emerald-600 px-6 py-3 text-base font-semibold text-white
                shadow-[0_6px_16px_rgba(16,185,129,0.35)]
                transition-all duration-300 ease-out
                hover:bg-emerald-700 hover:shadow-[0_8px_20px_rgba(16,185,129,0.45)]
                hover:scale-[1.05] active:scale-[.97]
                disabled:opacity-60 disabled:cursor-not-allowed cursor-pointer"
              aria-busy={submitting ? "true" : "false"}
            >
              {submitting ? "กำลังบันทึก..." : "บันทึกรับเข้า (ACCEPT)"}
            </button>

            <button
              type="button"
              onClick={async () => {
                if (!form.transfer_id) {
                  alert("กรุณาเลือกคำขอเพื่อปฏิเสธ")
                  return
                }
                await handleReject(form.transfer_id)
              }}
              className="inline-flex items-center justify-center rounded-2xl 
                border border-red-300 bg-white px-6 py-3 text-base font-semibold text-red-600 
                shadow-sm transition-all duration-300 ease-out
                hover:bg-red-50 hover:shadow-md hover:scale-[1.03]
                active:scale-[.97] cursor-pointer"
            >
              ปฏิเสธคำขอ (REJECT)
            </button>

            <button
              type="button"
              onClick={() =>
                setForm((f) => ({
                  ...f,
                  transfer_id: null,
                  weight_in: "",
                  weight_out: "",
                  quality_note: "",
                  impurity_percent: "",
                  price_per_kilo: "",
                  dest_quality: "",
                }))
              }
              className="inline-flex items-center justify-center rounded-2xl 
                border border-slate-300 bg-white px-6 py-3 text-base font-medium text-slate-700 
                shadow-sm
                transition-all duration-300 ease-out
                hover:bg-slate-100 hover:shadow-md hover:scale-[1.03]
                active:scale-[.97]
                dark:border-slate-600 dark:bg-slate-700/60 dark:text-white 
                dark:hover:bg-slate-700/50 dark:hover:shadow-lg cursor-pointer"
            >
              ล้างฟอร์ม
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

export default StockTransferIn
