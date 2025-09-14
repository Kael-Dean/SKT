// src/pages/Documents.jsx
import { useEffect, useMemo, useRef, useState, forwardRef, useImperativeHandle } from "react"
import { apiAuth } from "../lib/api"   // ✅ ใช้ helper แนบโทเคนอัตโนมัติ

/** ---------- Utils ---------- */
const cx = (...a) => a.filter(Boolean).join(" ")
const toNumber = (v) => (v === "" || v === null || v === undefined ? 0 : Number(v))

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
          else { el.focus(); el.click?.() }
        }}
        aria-label="เปิดตัวเลือกวันที่"
        className="absolute right-2 top-1/2 -translate-y-1/2 inline-flex h-9 w-9 items-center justify-center rounded-xl
                   transition-transform hover:scale-110 active:scale-95 focus:outline-none cursor-pointer
                   bg-transparent"
      >
        <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor" className="text-slate-600 dark:text-slate-200">
          <path d="M7 2a1 1 0 0 1 1 1v1h8V3a1 1 0 1 1 2 0v1h1a2 2 0 0 1 2 2v3H3V6a2 2 0 0 1 2-2h1V3a1 1 0 1 1 1-1zm14 9v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-7h18zM7 14h2v2H7v-2zm4 0h2v2h-2v-2z" />
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

  const [productOptions, setProductOptions] = useState([])
  const [riceOptions, setRiceOptions] = useState([])
  const [branchOptions, setBranchOptions] = useState([])
  const [klangOptions, setKlangOptions] = useState([])

  const today = new Date().toISOString().slice(0, 10)
  const firstDayThisMonth = useMemo(() => {
    const d = new Date()
    d.setDate(1)
    return d.toISOString().slice(0, 10)
  }, [])

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
          apiAuth("/order/product/search"),
          apiAuth("/order/branch/search"),
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
        const arr = (await apiAuth(`/order/rice/search?product_id=${encodeURIComponent(pid)}`)) || []
        setRiceOptions(
          arr.map((x) => ({ id: String(x.id ?? x.rice_id ?? ""), label: String(x.rice_type ?? x.name ?? "").trim() }))
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
        const arr = (await apiAuth(`/order/klang/search?branch_id=${encodeURIComponent(bId)}`)) || []
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

    try {
      setDownloading(true)
      // ใช้ apiAuth เพื่อให้แนบ token อัตโนมัติ
      const res = await apiAuth(`/report/orders/purchase-excel?${params.toString()}`, { method: "GET" })
      // apiAuth จะ parse JSON อัตโนมัติ ซึ่งไม่เหมาะกับไฟล์ binary → ใช้ fetch ตรงแต่ดึง token จาก localStorage ดีกว่า
    } catch {
      // 👉 สำหรับไฟล์ Excel ต้องใช้ fetch + blob ตรง ๆ
    }

    try {
      setDownloading(true)
      const token = localStorage.getItem("token")
      const res = await fetch(`/api/report/orders/purchase-excel?${params.toString()}`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      })
      if (!res.ok) throw new Error(await res.text())
      const blob = await res.blob()
      const cd = res.headers.get("content-disposition")
      let filename = `purchase_report_${filters.startDate}_${filters.endDate}.xlsx`
      if (cd && /filename="?([^"]+)"?/.test(cd)) {
        filename = decodeURIComponent(cd.match(/filename="?([^"]+)"?/)[1])
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

  /** ---------- UI (เหมือนเดิม) ---------- */
  return (
    <div className="min-h-screen bg-white text-black dark:bg-slate-900 dark:text-white rounded-2xl text-[15px] md:text-base">
      {/* ... UI เดิมทั้งหมด ... */}
    </div>
  )
}

export default Documents
