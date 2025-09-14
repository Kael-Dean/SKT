// src/pages/StockTransferMill.jsx
import { useEffect, useMemo, useState, useRef, forwardRef, useImperativeHandle } from "react"
import { get, post } from "../lib/api"   // ✅ ใช้ helper API ใหม่

/** ---------- Utils ---------- */
const toNumber = (v) => (v === "" || v === null || v === undefined ? 0 : Number(v))
const thb = (n) =>
  new Intl.NumberFormat("th-TH", { style: "currency", currency: "THB", maximumFractionDigits: 2 }).format(
    isFinite(n) ? n : 0
  )
const cx = (...a) => a.filter(Boolean).join(" ")

const baseField =
  "w-full rounded-2xl border border-slate-300 bg-slate-100 p-3 text-[15px] md:text-base " +
  "text-black outline-none placeholder:text-slate-500 focus:border-emerald-600 focus:ring-2 focus:ring-emerald-500/30 shadow-none " +
  "dark:border-slate-500 dark:bg-slate-700 dark:text-slate-100 dark:placeholder:text-slate-300 dark:focus:border-emerald-400 dark:focus:ring-emerald-400/30"

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

/** ---------- Main Component ---------- */
function StockTransferMill() {
  const [form, setForm] = useState({
    transfer_date: new Date().toISOString().slice(0, 10),
    branch_id: "",
    klang_id: "",
    rice_id: "",
    weight_in: "",
    milling_fee: "",
    note: "",
  })
  const update = (k, v) => setForm((p) => ({ ...p, [k]: v }))

  const [branchOptions, setBranchOptions] = useState([])
  const [klangOptions, setKlangOptions] = useState([])
  const [riceOptions, setRiceOptions] = useState([])
  const [errors, setErrors] = useState({})
  const [submitting, setSubmitting] = useState(false)

  /** ---------- Load dropdown options ---------- */
  useEffect(() => {
    const loadOptions = async () => {
      try {
        const [branches, rice] = await Promise.all([
          get("/order/branch/search"),
          get("/order/rice/search"),
        ])
        setBranchOptions((branches || []).map((b) => ({ id: b.id, label: b.branch_name })))
        setRiceOptions((rice || []).map((r) => ({ id: r.id, label: r.rice_type })))
      } catch (err) {
        console.error("loadOptions error", err)
      }
    }
    loadOptions()
  }, [])

  /** ---------- Load Klang by branch ---------- */
  useEffect(() => {
    if (!form.branch_id) {
      setKlangOptions([])
      return
    }
    const loadKlang = async () => {
      try {
        const arr = await get(`/order/klang/search?branch_id=${form.branch_id}`)
        setKlangOptions((arr || []).map((k) => ({ id: k.id, label: k.klang_name })))
      } catch (err) {
        console.error("loadKlang error", err)
      }
    }
    loadKlang()
  }, [form.branch_id])

  /** ---------- Validation ---------- */
  const validate = () => {
    const e = {}
    if (!form.transfer_date) e.transfer_date = "กรุณาเลือกวันที่"
    if (!form.branch_id) e.branch_id = "กรุณาเลือกสาขา"
    if (!form.klang_id) e.klang_id = "กรุณาเลือกคลัง"
    if (!form.rice_id) e.rice_id = "กรุณาเลือกชนิดข้าว"
    if (!form.weight_in || Number(form.weight_in) <= 0) e.weight_in = "น้ำหนักต้องมากกว่า 0"
    setErrors(e)
    return Object.keys(e).length === 0
  }

  /** ---------- Submit ---------- */
  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!validate()) return
    setSubmitting(true)
    try {
      await post("/api/stock/transfer/mill", {
        transfer_date: form.transfer_date,
        branch_id: form.branch_id,
        klang_id: form.klang_id,
        rice_id: form.rice_id,
        weight_in: toNumber(form.weight_in),
        milling_fee: form.milling_fee ? Number(form.milling_fee) : null,
        note: form.note?.trim() || null,
      })
      alert("บันทึกส่งสีสำเร็จ ✅")
      setForm({
        transfer_date: new Date().toISOString().slice(0, 10),
        branch_id: "",
        klang_id: "",
        rice_id: "",
        weight_in: "",
        milling_fee: "",
        note: "",
      })
    } catch (err) {
      console.error(err)
      alert(err.message || "เกิดข้อผิดพลาด")
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="min-h-screen bg-white text-black dark:bg-slate-900 dark:text-white rounded-2xl p-6 text-[15px] md:text-base">
      <h1 className="mb-6 text-3xl font-bold">🏭 ส่งสี</h1>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* วันที่ */}
        <div>
          <label className={labelCls}>วันที่ส่งสี</label>
          <DateInput
            value={form.transfer_date}
            onChange={(e) => update("transfer_date", e.target.value)}
            error={!!errors.transfer_date}
          />
          {errors.transfer_date && <p className={errorTextCls}>{errors.transfer_date}</p>}
        </div>

        {/* Branch & Klang */}
        <div>
          <label className={labelCls}>สาขา</label>
          <select
            className={baseField}
            value={form.branch_id}
            onChange={(e) => update("branch_id", e.target.value)}
          >
            <option value="">— เลือกสาขา —</option>
            {branchOptions.map((o) => (
              <option key={o.id} value={o.id}>{o.label}</option>
            ))}
          </select>
          {errors.branch_id && <p className={errorTextCls}>{errors.branch_id}</p>}
        </div>

        <div>
          <label className={labelCls}>คลัง</label>
          <select
            className={baseField}
            value={form.klang_id}
            onChange={(e) => update("klang_id", e.target.value)}
            disabled={!form.branch_id}
          >
            <option value="">— เลือกคลัง —</option>
            {klangOptions.map((o) => (
              <option key={o.id} value={o.id}>{o.label}</option>
            ))}
          </select>
          {errors.klang_id && <p className={errorTextCls}>{errors.klang_id}</p>}
        </div>

        {/* Rice */}
        <div>
          <label className={labelCls}>ชนิดข้าว</label>
          <select
            className={baseField}
            value={form.rice_id}
            onChange={(e) => update("rice_id", e.target.value)}
          >
            <option value="">— เลือกชนิดข้าว —</option>
            {riceOptions.map((o) => (
              <option key={o.id} value={o.id}>{o.label}</option>
            ))}
          </select>
          {errors.rice_id && <p className={errorTextCls}>{errors.rice_id}</p>}
        </div>

        {/* Weight */}
        <div>
          <label className={labelCls}>น้ำหนัก (กก.)</label>
          <input
            inputMode="decimal"
            className={baseField}
            value={form.weight_in}
            onChange={(e) => update("weight_in", e.target.value.replace(/[^\d.]/g, ""))}
            placeholder="เช่น 5000"
          />
          {errors.weight_in && <p className={errorTextCls}>{errors.weight_in}</p>}
        </div>

        {/* Milling fee */}
        <div>
          <label className={labelCls}>ค่าบริการสีข้าว (บาท/กก.)</label>
          <input
            inputMode="decimal"
            className={baseField}
            value={form.milling_fee}
            onChange={(e) => update("milling_fee", e.target.value.replace(/[^\d.]/g, ""))}
            placeholder="เช่น 2"
          />
          <p className={helpTextCls}>ถ้าไม่ใส่จะถือว่า 0</p>
        </div>

        {/* Note */}
        <div>
          <label className={labelCls}>บันทึกเพิ่มเติม</label>
          <textarea
            className={baseField}
            rows={3}
            value={form.note}
            onChange={(e) => update("note", e.target.value)}
            placeholder="เช่น สีที่โรงสี A"
          />
        </div>

        <div className="flex gap-3">
          <button
            type="submit"
            disabled={submitting}
            className="rounded-2xl bg-emerald-600 px-6 py-3 text-white font-semibold shadow hover:bg-emerald-700 disabled:opacity-60"
          >
            {submitting ? "กำลังบันทึก..." : "บันทึกส่งสี"}
          </button>
          <button
            type="button"
            onClick={() =>
              setForm({
                transfer_date: new Date().toISOString().slice(0, 10),
                branch_id: "",
                klang_id: "",
                rice_id: "",
                weight_in: "",
                milling_fee: "",
                note: "",
              })
            }
            className="rounded-2xl border border-slate-300 px-6 py-3 font-medium text-slate-700 hover:bg-slate-100 dark:text-white dark:border-slate-600 dark:hover:bg-slate-700"
          >
            ล้างฟอร์ม
          </button>
        </div>
      </form>
    </div>
  )
}

export default StockTransferMill
