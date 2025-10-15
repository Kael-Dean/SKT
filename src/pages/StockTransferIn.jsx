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
    weight_in: "",   // กก. (จำนวนเต็ม)
    weight_out: "",  // กก. (จำนวนเต็ม)
    quality_note: "",

    // สิ่งเจือปน (%)
    impurity_percent: "",

    // จากคำขอ (แสดงอย่างเดียว)
    price_per_kilo: "", // ราคาต้นทุน/กก. จากคำขอฝั่งโอนออก (ถ้ามี)
    dest_quality: "",   // คุณภาพ (ตัวเลข)
  })
  const update = (k, v) => setForm((p) => ({ ...p, [k]: v }))

  const weightIn = useMemo(() => toInt(form.weight_in), [form.weight_in])
  const weightOut = useMemo(() => toInt(form.weight_out), [form.weight_out])
  const netWeightInt = useMemo(() => Math.max(weightIn - weightOut, 0), [weightIn, weightOut])

  const pricePerKilo = useMemo(() => Number(form.price_per_kilo || 0), [form.price_per_kilo])
  const totalCost = useMemo(() => pricePerKilo * netWeightInt, [pricePerKilo, netWeightInt])

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
    update("price_per_kilo", req?.price_per_kilo != null ? String(req.price_per_kilo) : "")
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
    if (form.weight_in === "" || weightIn <= 0) m.weight_in = true
    if (form.weight_out === "" || weightOut < 0) m.weight_out = true
    if (netWeightInt <= 0) m.net_weight = true
    return m
  }

  const validate = () => {
    const e = {}
    if (!form.transfer_date) e.transfer_date = "กรุณาเลือกวันที่รับเข้า"
    if (!form.transfer_id) e.transfer_id = "กรุณาเลือกคำขอโอนจากรายการด้านบนก่อน"
    if (form.weight_in === "" || weightIn <= 0) e.weight_in = "น้ำหนักชั่งเข้า ต้องเป็นจำนวนเต็มมากกว่า 0"
    if (form.weight_out === "" || weightOut < 0) e.weight_out = "น้ำหนักชั่งออก ต้องเป็นจำนวนเต็ม (≥ 0)"
    if (netWeightInt <= 0) e.net_weight = "น้ำหนักสุทธ้องมากกว่า 0 (ชั่งเข้า − ชั่งออก)"
    if (form.impurity_percent !== "") {
      const ip = Number(form.impurity_percent)
      if (!isFinite(ip) || ip < 0 || ip > 100) e.impurity_percent = "กรุณากรอก 0–100"
    }
    if (form.dest_quality !== "") {
      const q = Number(form.dest_quality)
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

    // สร้าง payload ตรงกับ TransferConfirm (ฝั่ง BE)
    const payload = {
      action: "ACCEPT",
      dest_entry_weight: weightIn,                 // จำนวนเต็ม
      dest_exit_weight: weightOut,                 // จำนวนเต็ม
      dest_weight: netWeightInt,                   // จำนวนเต็ม (สำคัญ! TempStock เป็น Integer)
      dest_impurity: form.impurity_percent === "" ? null : Number(form.impurity_percent),
      dest_quality: form.dest_quality === "" ? null : Number(form.dest_quality),
      receiver_note: form.quality_note?.trim() || null,
      // ช่วยส่ง dest_price ให้ BE เก็บประกอบ ถ้ามี price_per_kilo
      dest_price: pricePerKilo ? pricePerKilo * netWeightInt : null,
    }

    setSubmitting(true)
    try {
      await post(`/transfer/confirm/${encodeURIComponent(form.transfer_id)}`, payload)
      alert("บันทึกรับเข้าสำเร็จ ✅")

      // ล้างฟอร์ม
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

      // รีโหลดรายการรอรับเข้า
      try {
        const data = await get(`/transfer/pending/incoming`)
        setRequests(Array.isArray(data) ? data : [])
      } catch {}
    } catch (err) {
      console.error(err)
      const msg = err?.message || ""
      // กรณี BE โยนข้อความเรื่อง TempStock เป็น Integer
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

        {/* ฟอร์มรับเข้า */}
        <form onSubmit={handleSubmit}>
          {/* กล่อง: ข้อมูลการรับเข้า */}
          <div className="mb-6 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-700 dark:bg-slate-800">
            <h2 className="mb-3 text-xl font-semibold">ข้อมูลการรับเข้า</h2>

            <div className="grid gap-4 md:grid-cols-3">
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
                  inputMode="numeric"
                  pattern="[0-9]*"
                  className={cx(baseField, redFieldCls("weight_in"))}
                  value={form.weight_in}
                  onChange={(e) => update("weight_in", onlyDigits(e.target.value))}
                  onFocus={() => {
                    clearError("weight_in")
                    clearHint("weight_in")
                  }}
                  placeholder="เช่น 15000"
                  aria-invalid={errors.weight_in ? true : undefined}
                />
                {errors.weight_in && <p className={errorTextCls}>{errors.weight_in}</p>}
                <p className={helpTextCls}>* ต้องเป็นจำนวนเต็มกิโลกรัม</p>
              </div>

              <div>
                <label className={labelCls}>น้ำหนักชั่งออก (กก.)</label>
                <input
                  inputMode="numeric"
                  pattern="[0-9]*"
                  className={cx(baseField, redFieldCls("weight_out"))}
                  value={form.weight_out}
                  onChange={(e) => update("weight_out", onlyDigits(e.target.value))}
                  onFocus={() => {
                    clearError("weight_out")
                    clearHint("weight_out")
                  }}
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
                <label className={labelCls}>คุณภาพ</label>
                <input
                  inputMode="numeric"
                  pattern="[0-9]*"
                  className={cx(baseField, errors.dest_quality && "border-red-400")}
                  value={form.dest_quality}
                  onChange={(e) => update("dest_quality", onlyDigits(e.target.value))}
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
                  onChange={(e) => {
                    const v = e.target.value.replace(/[^\d.]/g, "")
                    // อนุญาตทศนิยม แต่จะส่งเป็น Number (ไม่บังคับ)
                    update("impurity_percent", v)
                  }}
                  onFocus={() => clearError("impurity_percent")}
                  placeholder="เช่น 2.5"
                  aria-invalid={errors.impurity_percent ? true : undefined}
                />
                {errors.impurity_percent && <p className={errorTextCls}>{errors.impurity_percent}</p>}
                <p className={helpTextCls}>กรอกเป็นตัวเลข 0–100 (เว้นว่างได้)</p>
              </div>
            </div>
          </div>

          {/* กล่อง: ต้นทุนและคุณภาพ */}
          <div className="mb-6 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-700 dark:bg-slate-800">
            <h2 className="mb-3 text-xl font-semibold">ต้นทุนและคุณภาพ</h2>
            <div className="grid gap-4 md:grid-cols-3">
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
                <p className={helpTextCls}>ออโต้ฟิลจากคำขอฝั่งโอนออก (ถ้ามี)</p>
              </div>

              <div>
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
