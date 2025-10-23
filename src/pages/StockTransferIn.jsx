// src/pages/StockTransferIn.jsx
import { useEffect, useMemo, useRef, useState, forwardRef, useImperativeHandle } from "react"
import { get, post } from "../lib/api"

/** ---------- Utils ---------- */
const onlyDigits = (s = "") => s.replace(/\D+/g, "")
const toInt = (v) => {
  const n = Number(onlyDigits(String(v ?? "")))
  return Number.isFinite(n) ? n : 0
}
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

/** ---------- Main Page (รับเข้า) + FormGuard ---------- */
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
    weight_in: "",   // กก. (จำนวนเต็ม)
    weight_out: "",  // กก. (จำนวนเต็ม)
    quality_note: "",

    // ต้องกรอก
    dest_quality: "",        // คุณภาพ (0–100)
    impurity_percent: "",    // สิ่งเจือปน (0–100)
    price_per_kilo: "",      // ราคาต้นทุน/กก. (> 0)
  })
  const update = (k, v) => setForm((p) => ({ ...p, [k]: v }))

  const weightIn = useMemo(() => toInt(form.weight_in), [form.weight_in])
  const weightOut = useMemo(() => toInt(form.weight_out), [form.weight_out])
  const netWeightInt = useMemo(() => Math.max(weightIn - weightOut, 0), [weightIn, weightOut])

  const pricePerKilo = useMemo(() => Number(form.price_per_kilo || 0), [form.price_per_kilo])
  const totalCost = useMemo(() => pricePerKilo * netWeightInt, [pricePerKilo, netWeightInt])

  /** ---------- FormGuard: state ---------- */
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
  const requestsBoxRef = useRef(null)
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
    update("price_per_kilo", req?.price_per_kilo != null ? String(req.price_per_kilo) : "")
    update("weight_in", "")
    update("weight_out", "")
    update("impurity_percent", "")
    update("quality_note", "")
    update("dest_quality", "")
    setErrors({})
    setMissingHints({})
  }

  /** ---------- FormGuard: Enter-next + focus order ---------- */
  const dateRef = useRef(null)
  const weightInRef = useRef(null)
  const weightOutRef = useRef(null)
  const destQualityRef = useRef(null)
  const impurityRef = useRef(null)
  const priceRef = useRef(null)

  // Anchor (โฟกัสได้) สำหรับช่องรวมต้นทุน (disabled)
  const totalCostAnchorRef = useRef(null)

  const noteRef = useRef(null)
  const submitBtnRef = useRef(null)

  // ORDER ตามต้องการ: weight_out → dest_quality → impurity → price_per_kilo → total_cost → submit
  const orderedRefs = [
    dateRef,
    weightInRef,
    weightOutRef,
    destQualityRef,
    impurityRef,
    priceRef,
    totalCostAnchorRef,
    submitBtnRef,
  ]

  const focusNext = (refObj) => {
    const idx = orderedRefs.findIndex((r) => r === refObj)
    if (idx === -1) return
    for (let i = idx + 1; i < orderedRefs.length; i++) {
      const el = orderedRefs[i]?.current
      if (el && typeof el.focus === "function") {
        el.focus()
        return
      } else if (el?.querySelector) {
        // โฟกัสลูกที่โฟกัสได้ (เช่นภายใน container)
        const focusable = el.querySelector('input,button,select,textarea,[tabindex]:not([tabindex="-1"])')
        if (focusable) {
          focusable.focus()
          return
        }
      }
    }
  }

  const onEnterKey = (e, currentRef) => {
    if (e.key === "Enter") {
      e.preventDefault()
      focusNext(currentRef)
    }
  }

  /** ---------- FormGuard: validate + scroll-to-first-invalid ---------- */
  const computeMissingHints = () => {
    const m = {}
    if (!form.transfer_id) m.transfer_id = true
    if (!form.transfer_date) m.transfer_date = true
    if (form.weight_in === "" || weightIn <= 0) m.weight_in = true
    if (form.weight_out === "" || weightOut < 0) m.weight_out = true
    if (netWeightInt <= 0) m.net_weight = true

    const dq = Number(form.dest_quality)
    if (form.dest_quality === "" || !isFinite(dq) || dq < 0 || dq > 100) m.dest_quality = true

    const ip = Number(form.impurity_percent)
    if (form.impurity_percent === "" || !isFinite(ip) || ip < 0 || ip > 100) m.impurity_percent = true

    const ppk = Number(form.price_per_kilo)
    if (form.price_per_kilo === "" || !isFinite(ppk) || ppk <= 0) m.price_per_kilo = true

    return m
  }

  const validate = () => {
    const e = {}
    if (!form.transfer_date) e.transfer_date = "กรุณาเลือกวันที่รับเข้า"
    if (!form.transfer_id) e.transfer_id = "กรุณาเลือกคำขอโอนจากรายการด้านบนก่อน"
    if (form.weight_in === "" || weightIn <= 0) e.weight_in = "น้ำหนักชั่งเข้า ต้องเป็นจำนวนเต็มมากกว่า 0"
    if (form.weight_out === "" || weightOut < 0) e.weight_out = "น้ำหนักชั่งออก ต้องเป็นจำนวนเต็ม (≥ 0)"
    if (netWeightInt <= 0) e.net_weight = "น้ำหนักสุทธ้องมากกว่า 0 (ชั่งเข้า − ชั่งออก)"

    const dq = Number(form.dest_quality)
    if (form.dest_quality === "") e.dest_quality = "กรุณากรอกคุณภาพ (0–100)"
    else if (!isFinite(dq) || dq < 0 || dq > 100) e.dest_quality = "คุณภาพต้องเป็นตัวเลข 0–100"

    const ip = Number(form.impurity_percent)
    if (form.impurity_percent === "") e.impurity_percent = "กรุณากรอกสิ่งเจือปน (%)"
    else if (!isFinite(ip) || ip < 0 || ip > 100) e.impurity_percent = "สิ่งเจือปนต้องเป็นตัวเลข 0–100"

    const ppk = Number(form.price_per_kilo)
    if (form.price_per_kilo === "") e.price_per_kilo = "กรุณากรอกราคาต้นทุน/กก."
    else if (!isFinite(ppk) || ppk <= 0) e.price_per_kilo = "ราคาต้นทุน/กก. ต้องมากกว่า 0"

    setErrors(e)
    return { ok: Object.keys(e).length === 0, e }
  }

  const fieldRefByKey = {
    transfer_id: requestsBoxRef,   // ชี้ไปที่กล่องรายการคำขอ
    transfer_date: dateRef,
    weight_in: weightInRef,
    weight_out: weightOutRef,
    net_weight: weightInRef,       // ให้ไปเริ่มที่ชั่งเข้า
    dest_quality: destQualityRef,
    impurity_percent: impurityRef,
    price_per_kilo: priceRef,
  }

  const scrollAndFocus = (ref) => {
    const el = ref?.current
    if (!el) return
    try {
      el.scrollIntoView({ behavior: "smooth", block: "center" })
      if (typeof el.focus === "function") {
        el.focus({ preventScroll: true })
      } else if (el.querySelector) {
        const focusable = el.querySelector('input,button,select,textarea,[tabindex]:not([tabindex="-1"])')
        focusable?.focus({ preventScroll: true })
      }
    } catch {}
  }

  const focusFirstInvalid = (hints, e) => {
    const order = [
      "transfer_id",
      "transfer_date",
      "weight_in",
      "weight_out",
      "net_weight",
      "dest_quality",
      "impurity_percent",
      "price_per_kilo",
    ]
    const firstKey = order.find((k) => hints[k] || e[k])
    if (!firstKey) return
    setMissingHints((prev) => ({ ...prev, [firstKey]: true }))
    const ref = fieldRefByKey[firstKey]
    setTimeout(() => scrollAndFocus(ref), 0)
  }

  /** ---------- Submit (ACCEPT) + FormGuard flow ---------- */
  const handleSubmit = async (e) => {
    e.preventDefault()
    const hints = computeMissingHints()
    setMissingHints(hints)
    const { ok, e: ev } = validate()
    if (!ok) {
      focusFirstInvalid(hints, ev)
      alert("กรุณากรอกข้อมูลที่บังคับให้ครบ (ดูช่องกรอบแดง)")
      return
    }

    // payload สำหรับยืนยันรับเข้า
    const payload = {
      action: "ACCEPT",
      dest_entry_weight: weightIn,                 // จำนวนเต็ม
      dest_exit_weight: weightOut,                 // จำนวนเต็ม
      dest_weight: netWeightInt,                   // จำนวนเต็ม (สำคัญ! TempStock เป็น Integer)
      dest_impurity: Number(form.impurity_percent),
      dest_quality: Number(form.dest_quality),
      receiver_note: form.quality_note?.trim() || null,
      dest_price: pricePerKilo * netWeightInt,
    }

    setSubmitting(true)
    try {
      await post(`/transfer/confirm/${encodeURIComponent(form.transfer_id)}`, payload)
      alert("บันทึกรับเข้าสำเร็จ ✅")

      // ล้างฟอร์ม (ยกเว้นวันที่), รีโหลดรายการ, เด้งไปบนสุด + โฟกัสวันที่
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
      setErrors({})
      setMissingHints({})
      window.scrollTo({ top: 0, behavior: "smooth" })
      setTimeout(() => dateRef.current?.focus(), 200)

      // รีโหลดรายการรอรับเข้า
      try {
        const data = await get(`/transfer/pending/incoming`)
        setRequests(Array.isArray(data) ? data : [])
      } catch {}
    } catch (err) {
      console.error(err)
      const msg = err?.message || ""
      if (/Integer|จำนวนเต็ม|whole kg|move quantity/i.test(msg)) {
        alert("ต้องกรอกน้ำหนักเป็น ‘จำนวนเต็มกก.’ เท่านั้น (TempStock เป็น Integer)")
      } else if (/Insufficient stock|409/.test(msg)) {
        alert("สต็อกต้นทางไม่พอ กรุณาติดต่อสาขาต้นทาง")
      } else {
        alert(msg || "เกิดข้อผิดพลาดระหว่างบันทึก")
      }
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

        {/* คำขอที่รอเข้าจาก backend */}
        <div
          ref={requestsBoxRef}
          className={cx(
            "mb-6 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-700 dark:bg-slate-800",
            (errors.transfer_id || missingHints.transfer_id) && "ring-2 ring-red-300"
          )}
        >
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
          {errors.transfer_id && requests.length > 0 && (
            <p className="mt-3 text-sm text-red-500">{errors.transfer_id}</p>
          )}
        </div>

        {/* ฟอร์มรับเข้า */}
        <form onSubmit={handleSubmit}>
          {/* กล่อง: ข้อมูลการรับเข้า */}
          <div className="mb-6 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-700 dark:bg-slate-800">
            <h2 className="mb-3 text-xl font-semibold">ข้อมูลการรับเข้า</h2>

            <div className="grid gap-4 md:grid-cols-3">
              <div>
                <label className={labelCls}>วันที่รับเข้า</label>
                <DateInput
                  ref={dateRef}
                  value={form.transfer_date}
                  onChange={(e) => {
                    clearError("transfer_date")
                    clearHint("transfer_date")
                    update("transfer_date", e.target.value)
                  }}
                  onKeyDown={(e) => onEnterKey(e, dateRef)}
                  error={!!errors.transfer_date}
                  className={redHintCls("transfer_date")}
                  aria-invalid={errors.transfer_date ? true : undefined}
                />
                {errors.transfer_date && <p className={errorTextCls}>{errors.transfer_date}</p>}
              </div>

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
                  ref={weightInRef}
                  inputMode="numeric"
                  pattern="[0-9]*"
                  className={cx(baseField, redFieldCls("weight_in"))}
                  value={form.weight_in}
                  onChange={(e) => update("weight_in", onlyDigits(e.target.value))}
                  onFocus={() => {
                    clearError("weight_in")
                    clearHint("weight_in")
                  }}
                  onKeyDown={(e) => onEnterKey(e, weightInRef)}
                  placeholder="เช่น 15000"
                  aria-invalid={errors.weight_in ? true : undefined}
                />
                {errors.weight_in && <p className={errorTextCls}>{errors.weight_in}</p>}
                <p className={helpTextCls}>* ต้องเป็นจำนวนเต็มกิโลกรัม</p>
              </div>

              <div>
                <label className={labelCls}>น้ำหนักชั่งออก (กก.)</label>
                <input
                  ref={weightOutRef}
                  inputMode="numeric"
                  pattern="[0-9]*"
                  className={cx(baseField, redFieldCls("weight_out"))}
                  value={form.weight_out}
                  onChange={(e) => update("weight_out", onlyDigits(e.target.value))}
                  onFocus={() => {
                    clearError("weight_out")
                    clearHint("weight_out")
                  }}
                  onKeyDown={(e) => onEnterKey(e, weightOutRef)}
                  placeholder="เช่น 2000"
                  aria-invalid={errors.weight_out ? true : undefined}
                />
                {errors.weight_out && <p className={errorTextCls}>{errors.weight_out}</p>}
                <p className={helpTextCls}>* ต้องเป็นจำนวนเต็มกิโลกรัม</p>
              </div>

              <div>
                <label className={labelCls}>น้ำหนักสุทธิ (กก.)</label>
                <input
                  disabled
                  className={cx(baseField, fieldDisabled)}
                  value={netWeightInt}
                />
                {errors.net_weight && <p className={errorTextCls}>{errors.net_weight}</p>}
                <p className={helpTextCls}>คำนวณ = ชั่งเข้า − ชั่งออก</p>
              </div>
            </div>

            {/* แถวที่ 2: คุณภาพ & สิ่งเจือปน */}
            <div className="mt-4 grid gap-4 md:grid-cols-3">
              <div>
                <label className={labelCls}>คุณภาพ <span className="text-red-500">*</span></label>
                <input
                  ref={destQualityRef}
                  inputMode="numeric"
                  pattern="[0-9]*"
                  className={cx(baseField, redFieldCls("dest_quality"))}
                  value={form.dest_quality}
                  onChange={(e) => update("dest_quality", onlyDigits(e.target.value))}
                  onFocus={() => { clearError("dest_quality"); clearHint("dest_quality") }}
                  onKeyDown={(e) => onEnterKey(e, destQualityRef)}
                  placeholder="กรอก 0–100"
                  aria-invalid={errors.dest_quality ? true : undefined}
                />
                {errors.dest_quality && <p className={errorTextCls}>{errors.dest_quality}</p>}
              </div>

              <div>
                <label className={labelCls}>สิ่งเจือปน (%) <span className="text-red-500">*</span></label>
                <input
                  ref={impurityRef}
                  inputMode="decimal"
                  className={cx(baseField, redFieldCls("impurity_percent"))}
                  value={form.impurity_percent}
                  onChange={(e) => {
                    const v = e.target.value.replace(/[^\d.]/g, "")
                    update("impurity_percent", v)
                  }}
                  onFocus={() => { clearError("impurity_percent"); clearHint("impurity_percent") }}
                  onKeyDown={(e) => onEnterKey(e, impurityRef)}
                  placeholder="กรอก 0–100"
                  aria-invalid={errors.impurity_percent ? true : undefined}
                />
                {errors.impurity_percent && <p className={errorTextCls}>{errors.impurity_percent}</p>}
                <p className={helpTextCls}>กรอกเป็นตัวเลข 0–100</p>
              </div>
            </div>
          </div>

          {/* กล่อง: ต้นทุนและคุณภาพ */}
          <div className="mb-6 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-700 dark:bg-slate-800">
            <h2 className="mb-3 text-xl font-semibold">ต้นทุนและคุณภาพ</h2>
            <div className="grid gap-4 md:grid-cols-3">
              <div>
                <label className={labelCls}>ราคาต้นทุน/กก. (บาท) <span className="text-red-500">*</span></label>
                <input
                  ref={priceRef}
                  inputMode="decimal"
                  className={cx(baseField, redFieldCls("price_per_kilo"))}
                  value={form.price_per_kilo}
                  onChange={(e) => update("price_per_kilo", e.target.value.replace(/[^\d.]/g, ""))}
                  onFocus={() => { clearError("price_per_kilo"); clearHint("price_per_kilo") }}
                  onKeyDown={(e) => onEnterKey(e, priceRef)}
                  placeholder="เช่น 9.50"
                  aria-invalid={errors.price_per_kilo ? true : undefined}
                />
                {errors.price_per_kilo && <p className={errorTextCls}>{errors.price_per_kilo}</p>}
                <p className={helpTextCls}>ต้องมากกว่า 0</p>
              </div>

              {/* Anchor (focusable) ครอบช่องรวมต้นทุน */}
              <div
                ref={totalCostAnchorRef}
                tabIndex={0}
                role="group"
                onKeyDown={(e) => onEnterKey(e, totalCostAnchorRef)}
                className="focus:outline-none focus:ring-2 focus:ring-emerald-500/30 rounded-2xl"
              >
                <label className={labelCls}>รวมต้นทุน (ประมาณ)</label>
                <input disabled className={cx(baseField, fieldDisabled)} value={thb(totalCost)} placeholder="—" />
                <p className={helpTextCls}>คำนวณ = ราคาต้นทุน/กก. × น้ำหนักสุทธิ</p>
              </div>
            </div>
          </div>

          {/* บันทึกเพิ่มเติม */}
          <div className="mb-6 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-700 dark:bg-slate-800">
            <div className="grid gap-4 md:grid-cols-3">
              <div className="md:col-span-3">
                <label className={labelCls}>บันทึกเพิ่มเติม / เหตุผล (ผู้รับ)</label>
                <input
                  ref={noteRef}
                  className={baseField}
                  value={form.quality_note}
                  onChange={(e) => update("quality_note", e.target.value)}
                  placeholder="เช่น ความชื้นสูง แกลบเยอะ หรือเหตุผลกรณีปฏิเสธ"
                />
              </div>
            </div>
          </div>

          {/* ปุ่ม */}
          <div className="mt-6 flex flex-col gap-3 sm:flex-row">
            <button
              ref={submitBtnRef}
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
