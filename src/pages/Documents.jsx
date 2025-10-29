// src/pages/Documents.jsx
import { useEffect, useMemo, useRef, useState, forwardRef, useImperativeHandle } from "react"
import { apiAuth, apiDownload } from "../lib/api"   // ✅ helper แนบ token + BASE URL

/** ---------- Utils ---------- */
const cx = (...a) => a.filter(Boolean).join(" ")
const toNumber = (v) => (v === "" || v === null || v === undefined ? 0 : Number(v))

/** ---------- Styles ---------- */
const baseField =
  "w-full rounded-2xl border border-slate-300 bg-slate-100 p-3 text-[15px] md:text-base " +
  "text-black outline-none placeholder:text-slate-500 focus:border-emerald-600 focus:ring-2 focus:ring-emerald-500/30 shadow-none " +
  "dark:border-slate-500 dark:bg-slate-700 dark:text-slate-100 dark:placeholder:text-slate-300 dark:focus:border-emerald-400 dark:focus:ring-emerald-400/30"
const labelCls = "mb-1 block text-[15px] md:text-base font-medium text-slate-700 dark:text-slate-200"
const helpTextCls = "mt-1 text-sm text-slate-600 dark:text-slate-300"
const errorTextCls = "mt-1 text-sm text-red-500"

/** ---------- DateInput ---------- */
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
                   transition-transform hover:scale-110 active:scale-95 focus:outline-none cursor-pointer bg-transparent"
      >
        <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor" className="text-slate-600 dark:text-slate-200">
          <path d="M7 2a1 1 0 0 1 1 1v1h8V3a1 1 0 1 1 2 0v1h1a2 2 0 0 1 2 2v3H3V6a2 2 0 0 1 2-2h1V3a1 1 0 1 1 1-1zm14 9v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-7h18zM7 14h2v2H7v-2zm4 0h2v2h-2v-2z" />
        </svg>
      </button>
    </div>
  )
})

/** ---------- รายการรายงาน / mapping ไป BE ---------- */
const REPORTS = [
  {
    key: "purchaseGrouped",
    title: "ซื้อ/ขาย แยกราคาต่อกก. (Excel)",
    desc: "สรุปซื้อ-ขายตามราคาต่อกก. ช่วงวันที่ที่กำหนด",
    endpoint: "/report/orders/purchase-excel", // requires: start_date, end_date, spec_id; optional: branch_id, klang_id
    type: "excel",
    require: ["startDate", "endDate", "specId"],
    optional: ["branchId", "klangId"],
  },
  {
    key: "salesDaily",
    title: "ขายรายวัน (Excel)",
    desc: "รายการขายแบบแยกวันต่อวัน",
    endpoint: "/report/sales/daily-excel", // requires: start_date, end_date, branch_id; optional: spec_id
    type: "excel",
    require: ["startDate", "endDate", "branchId"],
    optional: ["specId"],
  },
  {
    key: "purchasesDaily",
    title: "ซื้อรายวัน (Excel)",
    desc: "รายการซื้อแบบแยกวันต่อวัน",
    endpoint: "/report/purchases/daily-excel", // requires: start_date, end_date, branch_id; optional: spec_id
    type: "excel",
    require: ["startDate", "endDate", "branchId"],
    optional: ["specId"],
  },
  {
    key: "registerPurchase",
    title: "ทะเบียนรับซื้อ (Excel)",
    desc: "ทะเบียนรับซื้อพร้อมค้นหาสายพันธุ์/ที่อยู่",
    endpoint: "/report/orders/register-excel", // requires: start_date, end_date; optional: branch_id, klang_id, species_like, addr_line4, addr_line5
    type: "excel",
    require: ["startDate", "endDate"],
    optional: ["branchId", "klangId", "speciesLike", "addrLine4", "addrLine5"],
  },
  {
    key: "branchRx",
    title: "สรุปสาขา (RX) (Excel)",
    desc: "ซื้อ-ขาย-รับโอน-โอน-ส่งสี-ตัดเสียหาย ตามสาขา",
    endpoint: "/report/branch-rx.xlsx", // requires: start_date, end_date, branch_id, spec_id
    type: "excel",
    require: ["startDate", "endDate", "branchId", "specId"],
    optional: [],
  },
  {
    key: "riceSummary",
    title: "สรุปซื้อขายรวม (Excel)",
    desc: "รวมทุกสาขา/ชนิดข้าวหลัก ช่วงวันที่ที่กำหนด",
    endpoint: "/report/rice-summary.xlsx", // requires: start_date, end_date
    type: "excel",
    require: ["startDate", "endDate"],
    optional: [],
  },
  {
    key: "stockTree",
    title: "โครงสร้างสต๊อก (JSON)",
    desc: "ภาพรวมสต๊อกแบบ Tree (product → species → …)",
    endpoint: "/report/stock/tree", // requires: branch_id, product_id; optional: klang_id, species_id, variant_id, …
    type: "json",
    require: ["branchId", "productId"],
    optional: ["klangId"],
  },
]

function Documents() {
  /** ---------- โหลดตัวเลือกพื้นฐาน ---------- */
  const [loadingOptions, setLoadingOptions] = useState(false)
  const [downloading, setDownloading] = useState(false)
  const [errors, setErrors] = useState({})
  const [activeReport, setActiveReport] = useState(null) // key ของ REPORTS

  const [productOptions, setProductOptions] = useState([])
  const [specOptions, setSpecOptions] = useState([]) // << ‘ชนิดข้าว (spec)’ จาก /order/rice/search?product_id
  const [branchOptions, setBranchOptions] = useState([])
  const [klangOptions, setKlangOptions] = useState([])

  const [previewJson, setPreviewJson] = useState(null) // สำหรับ stock/tree

  const today = new Date().toISOString().slice(0, 10)
  const firstDayThisMonth = useMemo(() => {
    const d = new Date(); d.setDate(1); return d.toISOString().slice(0, 10)
  }, [])

  /** ---------- State ฟิลเตอร์กลาง + ต่อรายงาน ---------- */
  const [filters, setFilters] = useState({
    // กลาง
    startDate: firstDayThisMonth,
    endDate: today,
    // ผูก options
    productId: "",
    specId: "",
    branchId: "",
    klangId: "",
    // register-excel
    speciesLike: "",
    addrLine4: "",
    addrLine5: "",
    // stock-tree เฉพาะ (ไม่มีวันที่)
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
            .map((x) => ({
              id: String(x.id ?? x.product_id ?? ""),
              label: String(x.product_type ?? x.name ?? "").trim(),
            }))
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

  /** product → spec (ชนิดข้าว / spec_id) */
  useEffect(() => {
    const pid = filters.productId
    if (!pid) {
      setSpecOptions([])
      setFilters((p) => ({ ...p, specId: "" }))
      return
    }
    const loadSpecs = async () => {
      try {
        const arr = (await apiAuth(`/order/rice/search?product_id=${encodeURIComponent(pid)}`)) || []
        // id ที่ได้ จะถือเป็น spec_id สำหรับฝั่งรายงาน
        setSpecOptions(
          arr.map((x) => ({
            id: String(x.id ?? x.rice_id ?? ""),
            label: String(x.rice_type ?? x.name ?? "").trim(),
          }))
          .filter((o) => o.id && o.label)
        )
      } catch (e) {
        console.error("load spec error:", e)
        setSpecOptions([])
      }
    }
    loadSpecs()
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

  /** ---------- Validation ตามรายงาน ---------- */
  const validate = (report) => {
    const e = {}
    if (!report) return e

    const needDate = report.require.includes("startDate") || report.require.includes("endDate")
    if (needDate) {
      if (!filters.startDate) e.startDate = "กรุณาเลือกวันที่เริ่มต้น"
      if (!filters.endDate) e.endDate = "กรุณาเลือกวันที่สิ้นสุด"
      if (filters.startDate && filters.endDate) {
        const s = new Date(filters.startDate)
        const ed = new Date(filters.endDate)
        if (ed < s) e.endDate = "วันสิ้นสุดต้องไม่ก่อนวันเริ่มต้น"
      }
    }
    for (const field of report.require) {
      if (["startDate", "endDate"].includes(field)) continue
      if (!filters[field]) {
        e[field] = "จำเป็นต้องระบุ"
      }
    }
    setErrors(e)
    return e
  }

  /** ---------- Map ฟิลด์ → QueryString ---------- */
  const buildParams = (report) => {
    const p = new URLSearchParams()
    // วันที่ (บางรายงานไม่ใช้ เช่น stock/tree)
    if (report.require.includes("startDate") || report.optional?.includes?.("startDate")) {
      p.set("start_date", filters.startDate)
    }
    if (report.require.includes("endDate") || report.optional?.includes?.("endDate")) {
      p.set("end_date", filters.endDate)
    }
    // ส่วนกลาง
    if (filters.branchId) p.set("branch_id", filters.branchId)
    if (filters.klangId) p.set("klang_id", filters.klangId)
    if (filters.specId) p.set("spec_id", filters.specId)
    if (filters.productId && report.key === "stockTree") p.set("product_id", filters.productId)

    // เฉพาะ register-excel
    if (report.key === "registerPurchase") {
      if (filters.speciesLike) p.set("species_like", filters.speciesLike.trim())
      if (filters.addrLine4) p.set("addr_line4", filters.addrLine4.trim())
      if (filters.addrLine5) p.set("addr_line5", filters.addrLine5.trim())
    }

    return p
  }

  /** ---------- Download / Preview ---------- */
  const doDownload = async (report) => {
    const errs = validate(report)
    if (Object.keys(errs).length) return

    try {
      setDownloading(true)
      const params = buildParams(report)
      if (report.type === "excel") {
        const { blob, filename } = await apiDownload(`${report.endpoint}?${params.toString()}`)
        const link = document.createElement("a")
        link.href = URL.createObjectURL(blob)
        link.download = filename || `${report.key}_${filters.startDate || ""}_${filters.endDate || ""}.xlsx`
        document.body.appendChild(link)
        link.click()
        link.remove()
        setTimeout(() => URL.revokeObjectURL(link.href), 3000)
      } else if (report.type === "json") {
        const json = await apiAuth(`${report.endpoint}?${params.toString()}`)
        setPreviewJson(json)
        // สร้างไฟล์ .json ให้ดาวน์โหลดด้วย
        const blob = new Blob([JSON.stringify(json, null, 2)], { type: "application/json" })
        const link = document.createElement("a")
        link.href = URL.createObjectURL(blob)
        link.download = `${report.key}.json`
        document.body.appendChild(link)
        link.click()
        link.remove()
        setTimeout(() => URL.revokeObjectURL(link.href), 3000)
      }
    } catch (err) {
      console.error(err)
      alert("เกิดข้อผิดพลาดในการดึงรายงาน")
    } finally {
      setDownloading(false)
    }
  }

  const resetForm = () =>
    setFilters({
      startDate: firstDayThisMonth,
      endDate: new Date().toISOString().slice(0, 10),
      productId: "",
      specId: "",
      branchId: "",
      klangId: "",
      speciesLike: "",
      addrLine4: "",
      addrLine5: "",
    })

  /** ---------- UI helper ---------- */
  const FieldError = ({ name }) =>
    errors[name] ? <div className={errorTextCls}>{errors[name]}</div> : null

  const FormDates = ({ report }) => {
    if (!(report.require.includes("startDate") || report.require.includes("endDate"))) return null
    return (
      <>
        <div>
          <label className={labelCls}>วันที่เริ่มต้น</label>
          <DateInput
            value={filters.startDate}
            onChange={(e) => setFilter("startDate", e.target.value)}
            error={!!errors.startDate}
            aria-invalid={errors.startDate ? true : undefined}
          />
          <FieldError name="startDate" />
        </div>
        <div>
          <label className={labelCls}>วันที่สิ้นสุด</label>
          <DateInput
            value={filters.endDate}
            onChange={(e) => setFilter("endDate", e.target.value)}
            error={!!errors.endDate}
            aria-invalid={errors.endDate ? true : undefined}
          />
          <FieldError name="endDate" />
        </div>
      </>
    )
  }

  const FormProductSpec = ({ requiredSpec = false, showProduct = true }) => (
    <>
      {showProduct && (
        <div>
          <label className={labelCls}>ประเภทสินค้า</label>
          <select
            className={baseField}
            value={filters.productId}
            onChange={(e) => setFilter("productId", e.target.value)}
          >
            <option value="">— เลือก —</option>
            {productOptions.map((o) => (
              <option key={o.id} value={o.id}>{o.label}</option>
            ))}
          </select>
        </div>
      )}
      <div>
        <label className={labelCls}>
          ชนิดข้าว (spec){requiredSpec && <span className="text-red-500"> *</span>}
        </label>
        <select
          className={cx(baseField, requiredSpec && errors.specId && "border-red-400 ring-2 ring-red-300/70")}
          value={filters.specId}
          onChange={(e) => setFilter("specId", e.target.value)}
          disabled={specOptions.length === 0}
        >
          <option value="">{specOptions.length ? "— เลือก —" : "— เลือกประเภทสินค้าก่อน —"}</option>
          {specOptions.map((o) => (
            <option key={o.id} value={o.id}>{o.label}</option>
          ))}
        </select>
        {requiredSpec && <FieldError name="specId" />}
      </div>
    </>
  )

  const FormBranchKlang = ({ requireBranch = false }) => (
    <>
      <div>
        <label className={labelCls}>
          สาขา{requireBranch && <span className="text-red-500"> *</span>}
        </label>
        <select
          className={cx(baseField, requireBranch && errors.branchId && "border-red-400 ring-2 ring-red-300/70")}
          value={filters.branchId}
          onChange={(e) => setFilter("branchId", e.target.value)}
        >
          <option value="">— เลือก —</option>
          {branchOptions.map((o) => (
            <option key={o.id} value={o.id}>{o.label}</option>
          ))}
        </select>
        {requireBranch && <FieldError name="branchId" />}
      </div>
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
            <option key={o.id} value={o.id}>{o.label}</option>
          ))}
        </select>
      </div>
    </>
  )

  const renderReportForm = (report) => {
    if (!report) return null

    if (report.key === "purchaseGrouped") {
      return (
        <>
          <div className="grid gap-4 md:grid-cols-3">
            <FormDates report={report} />
            <FormProductSpec requiredSpec showProduct />
            <FormBranchKlang requireBranch={false} />
          </div>
        </>
      )
    }
    if (report.key === "salesDaily" || report.key === "purchasesDaily") {
      return (
        <>
          <div className="grid gap-4 md:grid-cols-3">
            <FormDates report={report} />
            <FormBranchKlang requireBranch />
            {/* spec เป็นตัวเลือกเสริม */}
            <div>
              <label className={labelCls}>ชนิดข้าว (spec) – ไม่บังคับ</label>
              <select
                className={baseField}
                value={filters.specId}
                onChange={(e) => setFilter("specId", e.target.value)}
                disabled={specOptions.length === 0}
              >
                <option value="">{specOptions.length ? "— เลือก —" : "— เลือกประเภทสินค้าก่อน —"}</option>
                {specOptions.map((o) => (
                  <option key={o.id} value={o.id}>{o.label}</option>
                ))}
              </select>
              <p className={helpTextCls}>ถ้าไม่เลือก จะออกรวมทุกชนิดข้าวในสาขานั้น</p>
            </div>
          </div>
        </>
      )
    }
    if (report.key === "registerPurchase") {
      return (
        <>
          <div className="grid gap-4 md:grid-cols-3">
            <FormDates report={report} />
            <FormBranchKlang requireBranch={false} />
            <div>
              <label className={labelCls}>ค้นหาชื่อสายพันธุ์ (`species_like`)</label>
              <input
                className={baseField}
                placeholder="เช่น มะลิ"
                value={filters.speciesLike}
                onChange={(e) => setFilter("speciesLike", e.target.value)}
              />
            </div>
            <div>
              <label className={labelCls}>ที่อยู่ บรรทัด 4 (`addr_line4`)</label>
              <input
                className={baseField}
                value={filters.addrLine4}
                onChange={(e) => setFilter("addrLine4", e.target.value)}
              />
            </div>
            <div>
              <label className={labelCls}>ที่อยู่ บรรทัด 5 (`addr_line5`)</label>
              <input
                className={baseField}
                value={filters.addrLine5}
                onChange={(e) => setFilter("addrLine5", e.target.value)}
              />
            </div>
          </div>
        </>
      )
    }
    if (report.key === "branchRx") {
      return (
        <>
          <div className="grid gap-4 md:grid-cols-3">
            <FormDates report={report} />
            <FormBranchKlang requireBranch />
            <FormProductSpec requiredSpec showProduct />
          </div>
        </>
      )
    }
    if (report.key === "riceSummary") {
      return (
        <>
          <div className="grid gap-4 md:grid-cols-3">
            <FormDates report={report} />
          </div>
        </>
      )
    }
    if (report.key === "stockTree") {
      return (
        <>
          <div className="grid gap-4 md:grid-cols-3">
            <FormBranchKlang requireBranch />
            <div>
              <label className={labelCls}>ประเภทสินค้า (product_id) *</label>
              <select
                className={cx(baseField, errors.productId && "border-red-400 ring-2 ring-red-300/70")}
                value={filters.productId}
                onChange={(e) => setFilter("productId", e.target.value)}
              >
                <option value="">— เลือก —</option>
                {productOptions.map((o) => (
                  <option key={o.id} value={o.id}>{o.label}</option>
                ))}
              </select>
              <FieldError name="productId" />
            </div>
          </div>
          {previewJson && (
            <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm dark:border-slate-700 dark:bg-slate-800">
              <div className="mb-2 font-semibold">ตัวอย่างผลลัพธ์ (JSON)</div>
              <pre className="max-h-80 overflow-auto whitespace-pre-wrap break-words">{JSON.stringify(previewJson, null, 2)}</pre>
            </div>
          )}
        </>
      )
    }
    return null
  }

  /** ---------- Render ---------- */
  const reportObj = REPORTS.find((r) => r.key === activeReport)

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

        {/* --------------------------- เลือกรายงาน --------------------------- */}
        {!reportObj && (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {REPORTS.map((r) => (
              <button
                key={r.key}
                type="button"
                onClick={() => { setActiveReport(r.key); setPreviewJson(null); setErrors({}); }}
                className="group rounded-2xl border border-slate-200 bg-white p-5 text-left shadow-sm transition-all hover:shadow-md hover:scale-[1.01] dark:border-slate-700 dark:bg-slate-800"
              >
                <div className="mb-2 flex items-center justify-between">
                  <div className="text-lg font-semibold">{r.title}</div>
                  <span className={cx(
                    "rounded-full px-2.5 py-1 text-xs font-medium",
                    r.type === "excel"
                      ? "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200 dark:bg-emerald-900/20 dark:text-emerald-200 dark:ring-emerald-700/60"
                      : "bg-sky-50 text-sky-700 ring-1 ring-sky-200 dark:bg-sky-900/20 dark:text-sky-200 dark:ring-sky-700/60"
                  )}>
                    {r.type.toUpperCase()}
                  </span>
                </div>
                <p className="text-slate-600 dark:text-slate-300">{r.desc}</p>
              </button>
            ))}
          </div>
        )}

        {/* --------------------------- ฟอร์มของรายงาน --------------------------- */}
        {reportObj && (
          <form
            onSubmit={(e) => { e.preventDefault(); doDownload(reportObj) }}
            className="rounded-2xl border border-slate-200 bg-white p-5 text-black shadow-sm dark:border-slate-700 dark:bg-slate-800 dark:text-white mt-2"
          >
            <div className="mb-5 flex items-center justify-between gap-3">
              <div>
                <div className="text-xl font-semibold">{reportObj.title}</div>
                <div className={helpTextCls}>{reportObj.desc}</div>
              </div>
              <button
                type="button"
                onClick={() => { setActiveReport(null); setPreviewJson(null); setErrors({}); }}
                className="inline-flex items-center justify-center rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 shadow-sm transition-all hover:bg-slate-100 dark:border-slate-600 dark:bg-slate-700/60 dark:text-white"
              >
                ← เลือกรายงานอื่น
              </button>
            </div>

            {renderReportForm(reportObj)}

            <div className="mt-6 flex flex-wrap items-center gap-3">
              <button
                type="submit"
                disabled={downloading}
                className={cx(
                  "inline-flex items-center justify-center rounded-2xl bg-emerald-600 px-6 py-3 text-base font-semibold text-white " +
                  "shadow-[0_6px_16px_rgba(16,185,129,0.35)] transition-all duration-300 ease-out " +
                  "hover:bg-emerald-700 hover:shadow-[0_8px_20px_rgba(16,185,129,0.45)] hover:scale-[1.05] active:scale-[.97] cursor-pointer",
                  downloading && "opacity-70 cursor-wait hover:scale-100 hover:shadow-none"
                )}
              >
                {reportObj.type === "excel" ? (downloading ? "กำลังเตรียมไฟล์..." : "⬇️ ดาวน์โหลด Excel") : (downloading ? "กำลังดึงข้อมูล..." : "👁️‍🗨️ พรีวิว + ดาวน์โหลด JSON")}
              </button>

              <button
                type="button"
                onClick={resetForm}
                className={
                  "inline-flex items-center justify-center rounded-2xl border border-slate-300 bg-white px-6 py-3 text-base " +
                  "font-medium text-slate-700 shadow-sm transition-all duration-300 ease-out hover:bg-slate-100 hover:shadow-md " +
                  "hover:scale-[1.03] active:scale-[.97] dark:border-slate-600 dark:bg-slate-700/60 dark:text-white " +
                  "dark:hover:bg-slate-700/50 dark:hover:shadow-lg cursor-pointer"
                }
              >
                รีเซ็ตตัวกรอง
              </button>
            </div>
          </form>
        )}

        {/* หมายเหตุ / วิธีเพิ่มรายงานใหม่ */}
        <div className="mt-6 rounded-2xl border border-dashed border-slate-300 p-5 text-slate-600 dark:border-slate-600 dark:text-slate-300">
          <div className="font-medium">เพิ่มรายงานใหม่</div>
          <div className="mt-1 text-sm">
            ให้หลังบ้านเปิด endpoint ภายใต้ <code className="px-1 rounded bg-slate-100 dark:bg-slate-700">/report/…</code> แล้วเพิ่มรายการในอาร์เรย์ <code>REPORTS</code> พร้อมกำหนด <code>require</code>/<code>optional</code> ให้ตรงกับพารามิเตอร์ของ BE
          </div>
        </div>
      </div>
    </div>
  )
}

export default Documents
