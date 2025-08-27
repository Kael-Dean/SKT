// src/pages/Documents.jsx
import { useEffect, useMemo, useRef, useState, forwardRef, useImperativeHandle } from "react"

/** ---------- ENV ---------- */
const API_BASE = import.meta.env.VITE_API_BASE || ""

/** ---------- Utils ---------- */
const cx = (...a) => a.filter(Boolean).join(" ")
const toNumber = (v) => (v === "" || v === null || v === undefined ? 0 : Number(v))

/** ---------- Auth header ---------- */
const authHeader = () => {
  const token = localStorage.getItem("token")
  return { ...(token ? { Authorization: `Bearer ${token}` } : {}) }
}

/** ---------- Styles (ให้เหมือนหน้า Sales) ---------- */
const baseField =
  "w-full rounded-2xl border border-slate-300 bg-slate-100 p-3 text-[15px] md:text-base " +
  "text-black outline-none placeholder:text-slate-500 focus:border-emerald-600 focus:ring-2 focus:ring-emerald-500/30 shadow-none " +
  "dark:border-slate-500 dark:bg-slate-700 dark:text-slate-100 dark:placeholder:text-slate-300 dark:focus:border-emerald-400 dark:focus:ring-emerald-400/30"
const labelCls = "mb-1 block text-[15px] md:text-base font-medium text-slate-700 dark:text-slate-200"
const helpTextCls = "mt-1 text-sm text-slate-600 dark:text-slate-300"
const errorTextCls = "mt-1 text-sm text-red-500"

/** ---------- DateInput: ปฏิทินซูมเมื่อโฮเวอร์ (เหมือน Sales) ---------- */
const DateInput = forwardRef(function DateInput(
  { error = false, className = "", ...props },
  ref
) {
  const inputRef = useRef(null)
  useImperativeHandle(ref, () => inputRef.current)

  return (
    <div className="relative">
      {/* ซ่อนไอคอน native ของ Chromium เพื่อใช้ไอคอน custom */}
      <style>{`
        input[type="date"]::-webkit-calendar-picker-indicator { opacity: 0; }
      `}</style>

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
          else { el.focus(); el.click?.() }
        }}
        aria-label="เปิดตัวเลือกวันที่"
        className="absolute right-2 top-1/2 -translate-y-1/2 inline-flex h-9 w-9 items-center justify-center rounded-xl
                   transition-transform hover:scale-110 active:scale-95 focus:outline-none cursor-pointer
                   bg-transparent"
      >
        <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor" className="text-slate-600 dark:text-slate-200">
          <path d="M7 2a1 1 0 0 1 1 1v1h8V3a1 1 0 1 1 2 0v1h1a2 2 0 0 1 2 2v3H3V6a2 2 0 0 1 2-2h1V3a1 1 0 0 1 1-1zm14 9v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-7h18zM7 14h2v2H7v-2zm4 0h2v2h-2v-2z" />
        </svg>
      </button>
    </div>
  )
})

/** ---------- Component ---------- */
function Documents() {
  const [loadingOptions, setLoadingOptions] = useState(false)
  const [downloading, setDownloading] = useState(false)
  const [errors, setErrors] = useState({})

  // dropdown options
  const [productOptions, setProductOptions] = useState([])
  const [riceOptions, setRiceOptions] = useState([])
  const [branchOptions, setBranchOptions] = useState([])
  const [klangOptions, setKlangOptions] = useState([])

  // default dates
  const today = new Date().toISOString().slice(0, 10)
  const firstDayThisMonth = useMemo(() => {
    const d = new Date()
    d.setDate(1)
    return d.toISOString().slice(0, 10)
  }, [])

  // form state
  const [filters, setFilters] = useState({
    startDate: firstDayThisMonth,
    endDate: today,
    productId: "",
    riceId: "",
    branchId: "",
    klangId: "",
    carryForwardKg: "",
  })

  const setFilter = (k, v) => setFilters((p) => ({ ...p, [k]: v }))

  /** ---------- Load base options ---------- */
  useEffect(() => {
    const loadOptions = async () => {
      try {
        setLoadingOptions(true)
        const [products, branches] = await Promise.all([
          fetch(`${API_BASE}/order/product/search`, { headers: authHeader() }).then((r) => (r.ok ? r.json() : [])),
          fetch(`${API_BASE}/order/branch/search`, { headers: authHeader() }).then((r) => (r.ok ? r.json() : [])),
        ])
        setProductOptions(
          (products || [])
            .map((x) => ({ id: String(x.id ?? x.product_id ?? ""), label: String(x.product_type ?? x.name ?? "").trim() }))
            .filter((o) => o.id && o.label)
        )
        setBranchOptions(
          (branches || [])
            .map((b) => ({ id: String(b.id), label: b.branch_name }))
            .filter((o) => o.id && o.label)
        )
      } catch (e) {
        console.error("loadOptions error:", e)
        setProductOptions([])
        setBranchOptions([])
      } finally {
        setLoadingOptions(false)
      }
    }
    loadOptions()
  }, [])

  /** product → rice */
  useEffect(() => {
    const pid = filters.productId
    if (!pid) {
      setRiceOptions([])
      setFilters((p) => ({ ...p, riceId: "" }))
      return
    }
    const loadRice = async () => {
      try {
        const r = await fetch(`${API_BASE}/order/rice/search?product_id=${encodeURIComponent(pid)}`, { headers: authHeader() })
        if (!r.ok) throw new Error(await r.text())
        const arr = (await r.json()) || []
        setRiceOptions(
          arr
            .map((x) => ({ id: String(x.id ?? x.rice_id ?? ""), label: String(x.rice_type ?? x.name ?? "").trim() }))
            .filter((o) => o.id && o.label)
        )
      } catch (e) {
        console.error("load rice error:", e)
        setRiceOptions([])
      }
    }
    loadRice()
  }, [filters.productId])

  /** branch → klang */
  useEffect(() => {
    const bId = filters.branchId
    if (!bId) {
      setKlangOptions([])
      setFilters((p) => ({ ...p, klangId: "" }))
      return
    }
    const loadKlang = async () => {
      try {
        const r = await fetch(`${API_BASE}/order/klang/search?branch_id=${encodeURIComponent(bId)}`, { headers: authHeader() })
        if (!r.ok) throw new Error(await r.text())
        const arr = (await r.json()) || []
        setKlangOptions(arr.map((x) => ({ id: String(x.id), label: x.klang_name })).filter((o) => o.id && o.label))
      } catch (e) {
        console.error("load klang error:", e)
        setKlangOptions([])
      }
    }
    loadKlang()
  }, [filters.branchId])

  /** ---------- Validation ---------- */
  const validate = () => {
    const e = {}
    if (!filters.startDate) e.startDate = "กรุณาเลือกวันที่เริ่มต้น"
    if (!filters.endDate) e.endDate = "กรุณาเลือกวันที่สิ้นสุด"
    if (filters.startDate && filters.endDate) {
      const s = new Date(filters.startDate)
      const eDate = new Date(filters.endDate)
      if (eDate < s) e.endDate = "วันสิ้นสุดต้องไม่ก่อนวันเริ่มต้น"
    }
    setErrors(e)
    return e
  }

  /** ---------- Submit (Download Excel) ---------- */
  const onSubmit = async (e) => {
    e.preventDefault()
    const eObj = validate()
    if (Object.keys(eObj).length) return

    const params = new URLSearchParams()
    params.set("start_date", filters.startDate)
    params.set("end_date", filters.endDate)
    if (filters.productId) params.set("product_id", filters.productId)
    if (filters.riceId) params.set("rice_id", filters.riceId)
    if (filters.branchId) params.set("branch_id", filters.branchId)
    if (filters.klangId) params.set("klang_id", filters.klangId)
    if (filters.carryForwardKg !== "") params.set("carry_forward_kg", String(toNumber(filters.carryForwardKg)))

    const url = `${API_BASE}/report/orders/purchase-excel?${params.toString()}`

    try {
      setDownloading(true)
      const res = await fetch(url, { headers: { ...authHeader() } })
      if (!res.ok) {
        const txt = await res.text()
        throw new Error(txt || "ดาวน์โหลดรายงานไม่สำเร็จ")
      }
      const blob = await res.blob()

      // filename from headers (optional)
      const cd = res.headers.get("Content-Disposition") || res.headers.get("content-disposition")
      let filename = `purchase_report_${filters.startDate}_${filters.endDate}.xlsx`
      if (cd && /filename\*=UTF-8''([^;]+)|filename="?([^"]+)"?/i.test(cd)) {
        const m = cd.match(/filename\*=UTF-8''([^;]+)|filename="?([^"]+)"?/i)
        const raw = decodeURIComponent(m[1] || m[2])
        if (raw) filename = raw
      }

      const link = document.createElement("a")
      link.href = URL.createObjectURL(blob)
      link.download = filename
      document.body.appendChild(link)
      link.click()
      link.remove()
      setTimeout(() => URL.revokeObjectURL(link.href), 3000)
    } catch (err) {
      console.error(err)
      alert("เกิดข้อผิดพลาดในการดาวน์โหลดรายงาน")
    } finally {
      setDownloading(false)
    }
  }

  const resetForm = () =>
    setFilters({
      startDate: firstDayThisMonth,
      endDate: new Date().toISOString().slice(0, 10),
      productId: "",
      riceId: "",
      branchId: "",
      klangId: "",
      carryForwardKg: "",
    })

  /** ---------- UI ---------- */
  return (
    <div className="min-h-screen bg-white text-black dark:bg-slate-900 dark:text-white rounded-2xl text-[15px] md:text-base">
      <div className="mx-auto max-w-6xl p-5 md:p-6 lg:p-8">
        <div className="mb-6 flex items-center gap-3">
          <h1 className="text-3xl font-bold">📚 คลังเอกสาร & รายงาน</h1>
          {!loadingOptions && (
            <span className="inline-flex items-center gap-2 rounded-full bg-emerald-50 px-3 py-1.5 text-emerald-700 ring-1 ring-emerald-200 dark:bg-emerald-900/20 dark:text-emerald-200 dark:ring-emerald-700/60">
              พร้อมใช้งาน
            </span>
          )}
        </div>

        {/* รายงานซื้อ-ขาย (Excel) */}
        <form
          onSubmit={onSubmit}
          className="rounded-2xl border border-slate-200 bg-white p-5 text-black shadow-sm dark:border-slate-700 dark:bg-slate-800 dark:text-white"
        >
          <div className="mb-4">
            <h2 className="text-xl font-semibold">รายงานซื้อ-ขาย (Excel)</h2>
            <p className={helpTextCls}>เลือกตัวกรอง แล้วกด “ดาวน์โหลด Excel” เพื่อสร้างไฟล์รายงาน</p>
          </div>

          <div className="grid gap-4 md:grid-cols-3">
            {/* วันที่ (ใช้ DateInput แบบหน้า Sales) */}
            <div>
              <label className={labelCls}>วันที่เริ่มต้น</label>
              <DateInput
                value={filters.startDate}
                onChange={(e) => setFilter("startDate", e.target.value)}
                error={!!errors.startDate}
                className=""
                aria-invalid={errors.startDate ? true : undefined}
              />
              {errors.startDate && <div className={errorTextCls}>{errors.startDate}</div>}
            </div>
            <div>
              <label className={labelCls}>วันที่สิ้นสุด</label>
              <DateInput
                value={filters.endDate}
                onChange={(e) => setFilter("endDate", e.target.value)}
                error={!!errors.endDate}
                className=""
                aria-invalid={errors.endDate ? true : undefined}
              />
              {errors.endDate && <div className={errorTextCls}>{errors.endDate}</div>}
            </div>

            {/* ยอดยกมา */}
            <div>
              <label className={labelCls}>ยอดมาจากที่แล้ว (กก.)</label>
              <input
                inputMode="decimal"
                className={baseField}
                value={filters.carryForwardKg}
                onChange={(e) => setFilter("carryForwardKg", e.target.value.replace(/[^\d.]/g, ""))}
                placeholder="เช่น 500"
              />
            </div>

            {/* Product */}
            <div>
              <label className={labelCls}>ประเภทสินค้า (ไม่บังคับ)</label>
              <select
                className={baseField}
                value={filters.productId}
                onChange={(e) => setFilter("productId", e.target.value)}
              >
                <option value="">— ทั้งหมด —</option>
                {productOptions.map((o) => (
                  <option key={o.id} value={o.id}>
                    {o.label}
                  </option>
                ))}
              </select>
            </div>

            {/* Rice */}
            <div>
              <label className={labelCls}>ชนิดข้าว (ไม่บังคับ)</label>
              <select
                className={baseField}
                value={filters.riceId}
                onChange={(e) => setFilter("riceId", e.target.value)}
                disabled={!filters.productId || riceOptions.length === 0}
              >
                <option value="">— ทั้งหมด —</option>
                {riceOptions.map((o) => (
                  <option key={o.id} value={o.id}>
                    {o.label}
                  </option>
                ))}
              </select>
            </div>

            {/* Branch */}
            <div>
              <label className={labelCls}>สาขา (ไม่บังคับ)</label>
              <select
                className={baseField}
                value={filters.branchId}
                onChange={(e) => setFilter("branchId", e.target.value)}
              >
                <option value="">— ทั้งหมด —</option>
                {branchOptions.map((o) => (
                  <option key={o.id} value={o.id}>
                    {o.label}
                  </option>
                ))}
              </select>
            </div>

            {/* Klang */}
            <div>
              <label className={labelCls}>คลัง (ไม่บังคับ)</label>
              <select
                className={baseField}
                value={filters.klangId}
                onChange={(e) => setFilter("klangId", e.target.value)}
                disabled={!filters.branchId || klangOptions.length === 0}
              >
                <option value="">— ทั้งหมด —</option>
                {klangOptions.map((o) => (
                  <option key={o.id} value={o.id}>
                    {o.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="mt-6 flex flex-wrap items-center gap-3">
            <button
              type="submit"
              disabled={downloading}
              className={cx(
                "inline-flex items-center justify-center rounded-2xl " +
                  "bg-emerald-600 px-6 py-3 text-base font-semibold text-white " +
                  "shadow-[0_6px_16px_rgba(16,185,129,0.35)] " +
                  "transition-all duration-300 ease-out " +
                  "hover:bg-emerald-700 hover:shadow-[0_8px_20px_rgba(16,185,129,0.45)] hover:scale-[1.05] " +
                  "active:scale-[.97] cursor-pointer",
                downloading && "opacity-70 cursor-wait hover:scale-100 hover:shadow-none"
              )}
            >
              {downloading ? "กำลังเตรียมไฟล์..." : "⬇️ ดาวน์โหลด Excel"}
            </button>

            <button
              type="button"
              onClick={resetForm}
              className={
                "inline-flex items-center justify-center rounded-2xl " +
                "border border-slate-300 bg-white px-6 py-3 text-base font-medium text-slate-700 " +
                "shadow-sm " +
                "transition-all duration-300 ease-out " +
                "hover:bg-slate-100 hover:shadow-md hover:scale-[1.03] " +
                "active:scale-[.97] " +
                "dark:border-slate-600 dark:bg-slate-700/60 dark:text-white " +
                "dark:hover:bg-slate-700/50 dark:hover:shadow-lg cursor-pointer"
              }
            >
              รีเซ็ตตัวกรอง
            </button>
          </div>
        </form>

        {/* เผื่อรายงานอื่นในอนาคต */}
        <div className="mt-6 rounded-2xl border border-dashed border-slate-300 p-5 text-slate-600 dark:border-slate-600 dark:text-slate-300">
          <div className="font-medium">รายงานอื่น ๆ (เพิ่มได้ภายหลัง)</div>
          <div className="mt-1 text-sm">
            ถ้าจะเพิ่มรายงานใหม่ ให้หลังบ้านเปิด endpoint ใต้ <code className="px-1 rounded bg-slate-100 dark:bg-slate-700">/report/…</code> แล้วจะนำฟอร์มกรองเดียวกันนี้ไปใช้ต่อได้
          </div>
        </div>
      </div>
    </div>
  )
}

export default Documents
