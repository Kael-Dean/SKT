// src/pages/Documents.jsx
import { useEffect, useMemo, useRef, useState, forwardRef, useImperativeHandle } from "react"
import { apiAuth, apiDownload } from "../lib/api"   // helper แนบ token + BASE URL

/** ---------- Config: จำกัดจำนวนตัวเลือก ---------- */
const TOP_SPEC_LIMIT = 2     // ❗️แสดงเฉพาะ 2 ตัวบนสุดสำหรับ dropdown "ชนิดข้าว (spec)"
const limitOptions = (opts, n) => (Array.isArray(opts) ? opts.slice(0, n) : [])

/** ---------- Utils/Styles ---------- */
const cx = (...a) => a.filter(Boolean).join(" ")
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

/** ---------- ComboBox ---------- */
function ComboBox({
  options = [],
  value,
  onChange,
  placeholder = "— เลือก —",
  getLabel = (o) => o?.label ?? "",
  getValue = (o) => o?.value ?? o?.id ?? "",
  disabled = false,
  error = false,
  buttonRef = null,
  onEnterNext = null,
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

  const selectedIndex = useMemo(
    () => options.findIndex((o) => String(getValue(o)) === String(value)),
    [options, value, getValue]
  )

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

  useEffect(() => {
    if (open) {
      const idx = selectedIndex >= 0 ? selectedIndex : (options.length ? 0 : -1)
      setHighlight(idx)
      if (idx >= 0) {
        requestAnimationFrame(() => scrollHighlightedIntoView(idx))
      }
    }
  }, [open, selectedIndex, options])

  const commit = (opt, { navigate = false } = {}) => {
    const v = String(getValue(opt))
    onChange?.(v, opt)
    setOpen(false)
    setHighlight(-1)
    requestAnimationFrame(() => {
      controlRef.current?.focus()
      if (navigate) onEnterNext?.()
    })
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
      if (highlight >= 0 && highlight < options.length) commit(options[highlight], { navigate: true })
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
        onClick={() => {
          if (disabled) return
          setOpen((o) => {
            const willOpen = !o
            if (!o) {
              const idx = selectedIndex >= 0 ? selectedIndex : (options.length ? 0 : -1)
              setHighlight(idx)
            }
            return willOpen
          })
        }}
        onKeyDown={onKeyDown}
        data-combobox-btn="true"
        className={cx(
          "w-full rounded-2xl border p-3 text-left text-[15px] md:text-base outline-none transition shadow-none",
          disabled ? "bg-slate-200 cursor-not-allowed" : "bg-slate-100 hover:bg-slate-200 cursor-pointer",
          error ? "border-red-400 ring-2 ring-red-300/70"
                : "border-slate-300 focus:border-emerald-600 focus:ring-2 focus:ring-emerald-500/30",
          "dark:border-slate-500 dark:bg-slate-700 dark:text-slate-100 dark:hover:bg-slate-700/80"
        )}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-invalid={error ? true : undefined}
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
  /** ---------- state หลัก ---------- */
  const [loadingOptions, setLoadingOptions] = useState(false)
  const [downloading, setDownloading] = useState(false)
  const [errors, setErrors] = useState({})
  const [activeReport, setActiveReport] = useState(null)

  const [productOptions, setProductOptions] = useState([])
  const [specOptions, setSpecOptions] = useState([])   // << จะถูกจำกัดแค่ 2 ตัวบนสุด
  const [branchOptions, setBranchOptions] = useState([])
  const [klangOptions, setKlangOptions] = useState([])

  const [previewJson, setPreviewJson] = useState(null)

  const today = new Date().toISOString().slice(0, 10)
  const firstDayThisMonth = useMemo(() => {
    const d = new Date(); d.setDate(1); return d.toISOString().slice(0, 10)
  }, [])

  /** ---------- ฟิลเตอร์กลาง ---------- */
  const [filters, setFilters] = useState({
    startDate: firstDayThisMonth,
    endDate: today,
    productId: "",
    specId: "",
    branchId: "",
    klangId: "",
    speciesLike: "",
    addrLine4: "",
    addrLine5: "",
  })
  const setFilter = (k, v) => setFilters((p) => ({ ...p, [k]: v }))

  /** ---------- โหลด options พื้นฐาน ---------- */
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

  /** ---------- product → spec (ชนิดข้าว / spec_id) (จำกัด 2 ตัวบนสุด) ---------- */
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
        // id ที่ได้ = spec_id ของฝั่งรายงาน → จำกัด 2 ตัวบนสุด
        const mapped = arr
          .map((x) => ({
            id: String(x.id ?? x.rice_id ?? ""),
            label: String(x.rice_type ?? x.name ?? "").trim(),
          }))
          .filter((o) => o.id && o.label)

        setSpecOptions(limitOptions(mapped, TOP_SPEC_LIMIT))
      } catch (e) {
        console.error("load spec error:", e)
        setSpecOptions([])
      }
    }
    loadSpecs()
  }, [filters.productId])

  /** ---------- branch → klang ---------- */
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

  /** ---------- Validate ---------- */
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
      if (!filters[field]) e[field] = "จำเป็นต้องระบุ"
    }
    setErrors(e)
    return e
  }

  /** ---------- Map ฟิลด์ → QueryString ---------- */
  const buildParams = (report) => {
    const p = new URLSearchParams()
    if (report.require.includes("startDate") || report.optional?.includes?.("startDate")) {
      p.set("start_date", filters.startDate)
    }
    if (report.require.includes("endDate") || report.optional?.includes?.("endDate")) {
      p.set("end_date", filters.endDate)
    }
    // ส่วนกลางที่ BE รองรับ (spec_id, branch_id, klang_id …)
    if (filters.branchId) p.set("branch_id", filters.branchId)
    if (filters.klangId) p.set("klang_id", filters.klangId)
    if (filters.specId) p.set("spec_id", filters.specId)   // ← ส่งตาม BE
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

  /** ---------- UI helpers ---------- */
  const FieldError = ({ name }) =>
    errors[name] ? <div className={errorTextCls}>{errors[name]}</div> : null

  const withEmpty = (opts, emptyLabel = "— เลือก —") => [{ id: "", label: emptyLabel }, ...opts]

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
          <ComboBox
            options={withEmpty(productOptions, "— เลือก —")}
            value={filters.productId}
            onChange={(v) => setFilter("productId", v)}
            placeholder="— เลือก —"
          />
        </div>
      )}
      <div>
        <label className={labelCls}>
          ชนิดข้าว (spec){requiredSpec && <span className="text-red-500"> *</span>}
        </label>
        <ComboBox
          options={
            (specOptions.length === 0)
              ? [] // ยังไม่มีตัวเลือก (บังคับให้เลือกประเภทสินค้าก่อน)
              : withEmpty(specOptions, "— เลือก —")
          }
          value={filters.specId}
          onChange={(v) => setFilter("specId", v)}
          placeholder={specOptions.length ? "— เลือก —" : "— เลือกประเภทสินค้าก่อน —"}
          disabled={specOptions.length === 0}
          error={!!(requiredSpec && errors.specId)}
        />
        {requiredSpec && <FieldError name="specId" />}
        <p className={helpTextCls}>* แสดงเฉพาะ {TOP_SPEC_LIMIT} ตัวเลือกบนสุดจากข้อมูล BE</p>
      </div>
    </>
  )

  const FormBranchKlang = ({ requireBranch = false }) => (
    <>
      <div>
        <label className={labelCls}>
          สาขา{requireBranch && <span className="text-red-500"> *</span>}
        </label>
        <ComboBox
          options={withEmpty(branchOptions, "— เลือก —")}
          value={filters.branchId}
          onChange={(v) => setFilter("branchId", v)}
          placeholder="— เลือก —"
          error={!!(requireBranch && errors.branchId)}
        />
        {requireBranch && <FieldError name="branchId" />}
      </div>
      <div>
        <label className={labelCls}>คลัง (ไม่บังคับ)</label>
        <ComboBox
          options={withEmpty(klangOptions, "— ทั้งหมด —")}
          value={filters.klangId}
          onChange={(v) => setFilter("klangId", v)}
          placeholder="— ทั้งหมด —"
          disabled={!filters.branchId || klangOptions.length === 0}
        />
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
      // spec เป็นตัวเลือกเสริม (ยังคงจำกัด 2 ตัวบนสุด)
      return (
        <>
          <div className="grid gap-4 md:grid-cols-3">
            <FormDates report={report} />
            <FormBranchKlang requireBranch />
            <FormProductSpec requiredSpec={false} showProduct />
          </div>
          <p className={helpTextCls}>ถ้าไม่เลือกชนิดข้าว ระบบจะออกรวมทุกชนิดในสาขานั้น</p>
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
              <label className={labelCls}>ค้นหาชื่อสายพันธุ์ (ไม่บังคับ)</label>
              <input
                className={baseField}
                value={filters.speciesLike}
                onChange={(e) => setFilter("speciesLike", e.target.value)}
                placeholder="เช่น หอมมะลิ, กข..."
              />
              <p className={helpTextCls}>ปล่อยว่างเพื่อดึงทั้งหมด</p>
            </div>
            <div>
              <label className={labelCls}>ตำบล (ไม่บังคับ)</label>
              <input
                className={baseField}
                value={filters.addrLine4}
                onChange={(e) => setFilter("addrLine4", e.target.value)}
                placeholder="ตำบล/แขวง"
              />
            </div>
            <div>
              <label className={labelCls}>อำเภอ (ไม่บังคับ)</label>
              <input
                className={baseField}
                value={filters.addrLine5}
                onChange={(e) => setFilter("addrLine5", e.target.value)}
                placeholder="อำเภอ/เขต"
              />
            </div>
          </div>
        </>
      )
    }

    if (report.key === "branchRx" || report.key === "riceSummary") {
      return (
        <>
          <div className="grid gap-4 md:grid-cols-3">
            <FormDates report={report} />
            <FormBranchKlang requireBranch={report.key === "branchRx"} />
            <FormProductSpec requiredSpec={report.key === "branchRx"} showProduct />
          </div>
        </>
      )
    }

    if (report.key === "stockTree") {
      return (
        <>
          <div className="grid gap-4 md:grid-cols-3">
            <div>
              <label className={labelCls}>สาขา *</label>
              <ComboBox
                options={withEmpty(branchOptions, "— เลือก —")}
                value={filters.branchId}
                onChange={(v) => setFilter("branchId", v)}
                placeholder="— เลือก —"
                error={!!errors.branchId}
              />
              <FieldError name="branchId" />
            </div>
            <div>
              <label className={labelCls}>ประเภทสินค้า *</label>
              <ComboBox
                options={withEmpty(productOptions, "— เลือก —")}
                value={filters.productId}
                onChange={(v) => setFilter("productId", v)}
                placeholder="— เลือก —"
              />
            </div>
            <div>
              <label className={labelCls}>คลัง (ไม่บังคับ)</label>
              <ComboBox
                options={withEmpty(klangOptions, "— ทั้งหมด —")}
                value={filters.klangId}
                onChange={(v) => setFilter("klangId", v)}
                placeholder="— ทั้งหมด —"
                disabled={!filters.branchId || klangOptions.length === 0}
              />
            </div>
          </div>
          {previewJson && (
            <pre className="mt-4 max-h-80 overflow-auto rounded-2xl bg-slate-900 p-4 text-xs text-slate-100">
              {JSON.stringify(previewJson, null, 2)}
            </pre>
          )}
        </>
      )
    }

    return null
  }

  const currentReport = useMemo(
    () => REPORTS.find((r) => r.key === activeReport) || REPORTS[0],
    [activeReport]
  )

  return (
    <div className="mx-auto max-w-6xl px-4 py-6">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-slate-800 dark:text-slate-100">
          📚 คลังเอกสาร & รายงาน
        </h1>
        <div className="rounded-full bg-emerald-100 px-3 py-1 text-sm text-emerald-700">พร้อมใช้งาน</div>
      </div>

      {/* เลือกรายงาน */}
      <div className="mb-4 flex flex-wrap gap-2">
        {REPORTS.map((r) => (
          <button
            key={r.key}
            onClick={() => setActiveReport(r.key)}
            className={cx(
              "rounded-full border px-4 py-2 text-sm",
              currentReport.key === r.key
                ? "border-emerald-600 bg-emerald-50 text-emerald-700"
                : "border-slate-300 bg-white text-slate-700 hover:bg-slate-50"
            )}
          >
            {r.title}
          </button>
        ))}
      </div>

      {/* ฟอร์มของรายงาน */}
      <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-700 dark:bg-slate-800">
        <div className="mb-4">
          <div className="text-lg font-medium">{currentReport.title}</div>
          <div className="text-slate-600 dark:text-slate-300">{currentReport.desc}</div>
        </div>

        <div className="grid gap-4 md:gap-6">
          {renderReportForm(currentReport)}
        </div>

        <div className="mt-6 flex flex-wrap gap-3">
          <button
            onClick={() => doDownload(currentReport)}
            disabled={downloading}
            className="inline-flex items-center gap-2 rounded-2xl bg-emerald-600 px-4 py-2 text-white hover:bg-emerald-700 disabled:opacity-60"
          >
            <span>⬇️ ดาวน์โหลด</span>
          </button>
          <button
            onClick={resetForm}
            className="rounded-2xl border border-slate-300 bg-white px-4 py-2 text-slate-700 hover:bg-slate-50"
          >
            รีเซ็ตตัวกรอง
          </button>
        </div>

        <p className="mt-6 rounded-2xl border border-dashed border-slate-300 p-4 text-sm text-slate-600 dark:text-slate-300">
          เพิ่มรายงานใหม่ ให้หลังบ้านเปิด endpoint ภายใต้ <code>/report/…</code> แล้วเพิ่มรายการในตัวแปร
          <code> REPORTS </code> พร้อมกำหนด <code>require/optional</code> ให้ตรงกับ BE (หน้า FE จะสร้าง query string
          ให้อัตโนมัติ)
        </p>
      </div>
    </div>
  )
}

export default Documents
