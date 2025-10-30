// src/pages/Documents.jsx
import { useEffect, useMemo, useRef, useState, forwardRef, useImperativeHandle } from "react"
import { apiAuth, apiDownload } from "../lib/api"   // helper แนบ token + BASE URL

/** ---------- Utils ---------- */
const cx = (...a) => a.filter(Boolean).join(" ")

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

/** ---------- ComboBox (สไตล์เดียวกับหน้า Buy) ---------- */
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
    if (!open && e.key === "Enter") {
      e.preventDefault()
      setOpen(true)
      return
    }
    if (!open && (e.key === " " || e.key === "ArrowDown")) {
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
      if (highlight >= 0 && highlight < options.length) {
        commit(options[highlight], { navigate: true })
      }
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
    endpoint: "/report/orders/purchase-excel", // requires: start_date, end_date; optional: spec_id, branch_id, klang_id
    type: "excel",
    require: ["startDate", "endDate"],         // <— spec เป็นทางเลือก ตาม BE
    optional: ["specId", "branchId", "klangId"],
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
    optional: ["specId"],                      // <— แก้คีย์สะกดให้ตรง (ไม่ใช่ SpecId)
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
    require: ["startDate", "endDate", "branchId", "specId"],  // <— ต้องเลือกชนิดข้าว ตาม BE
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
    endpoint: "/report/stock/tree", // requires: branch_id, product_id; optional: klang_id
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
  const [activeReport, setActiveReport] = useState(REPORTS[0].key)

  const [productOptions, setProductOptions] = useState([])
  const [specOptions, setSpecOptions] = useState([]) // ‘ชนิดข้าว (spec)’ จาก /order/rice/search?product_id
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
    if (filters.specId) p.set("spec_id", filters.specId) // ส่ง spec_id ตรงตาม BE
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

  // helper สำหรับเติม option “ค่าว่าง” เพื่อให้ล้างค่าได้เหมือน select เดิม
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

  const FormProductSpec = ({ requiredSpec = false, showProduct = true, hintOptional = false }) => (
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
              ? [] // ยังไม่มีตัวเลือก (ให้ placeholder บอกให้เลือกประเภทสินค้าก่อน)
              : withEmpty(specOptions, "— เลือก —")
          }
          value={filters.specId}
          onChange={(v) => setFilter("specId", v)}
          placeholder={specOptions.length ? "— เลือก —" : "— เลือกประเภทสินค้าก่อน —"}
          disabled={specOptions.length === 0}
          error={!!(requiredSpec && errors.specId)}
        />
        {requiredSpec && <FieldError name="specId" />}
        {hintOptional && <p className={helpTextCls}>ถ้าไม่เลือก ระบบจะออกรวมทุกชนิดข้าว</p>}
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

  const currentReport = useMemo(() => REPORTS.find(r => r.key === activeReport), [activeReport])

  const renderReportForm = (report) => {
    if (!report) return null

    if (report.key === "purchaseGrouped") {
      return (
        <div className="grid gap-4 md:grid-cols-3">
          <FormDates report={report} />
          <FormProductSpec requiredSpec={false} showProduct hintOptional />
          <FormBranchKlang requireBranch={false} />
        </div>
      )
    }

    if (report.key === "salesDaily" || report.key === "purchasesDaily") {
      return (
        <>
          <div className="grid gap-4 md:grid-cols-3">
            <FormDates report={report} />
            <FormBranchKlang requireBranch />
            <FormProductSpec requiredSpec={false} showProduct hintOptional />
          </div>
        </>
      )
    }

    if (report.key === "registerPurchase") {
      return (
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
      )
    }

    if (report.key === "branchRx") {
      return (
        <div className="grid gap-4 md:grid-cols-3">
          <FormDates report={report} />
          <FormBranchKlang requireBranch />
          <FormProductSpec requiredSpec showProduct />
        </div>
      )
    }

    if (report.key === "riceSummary") {
      return (
        <div className="grid gap-4 md:grid-cols-3">
          <FormDates report={report} />
          <div className="md:col-span-2" />
        </div>
      )
    }

    if (report.key === "stockTree") {
      return (
        <div className="grid gap-4 md:grid-cols-3">
          <FormBranchKlang requireBranch />
          <div>
            <label className={labelCls}>ประเภทสินค้า *</label>
            <ComboBox
              options={withEmpty(productOptions, "— เลือก —")}
              value={filters.productId}
              onChange={(v) => setFilter("productId", v)}
              placeholder="— เลือก —"
              error={!filters.productId && !!errors.productId}
            />
          </div>
        </div>
      )
    }

    return null
  }

  return (
    <div className="p-6 md:p-10">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl md:text-3xl font-semibold text-slate-800 dark:text-slate-100">
          คลังเอกสาร & รายงาน
        </h1>
        <span className="rounded-full bg-emerald-100 text-emerald-700 px-3 py-1 text-sm">พร้อมใช้งาน</span>
      </div>

      {/* เลือกรายงาน */}
      <div className="mb-6 flex flex-wrap gap-2">
        {REPORTS.map((r) => (
          <button
            key={r.key}
            onClick={() => setActiveReport(r.key)}
            className={cx(
              "rounded-full px-4 py-2 text-sm md:text-[15px] border",
              activeReport === r.key
                ? "bg-emerald-600 text-white border-emerald-600"
                : "bg-white text-slate-700 border-slate-300 hover:bg-slate-100 dark:bg-slate-800 dark:text-slate-200"
            )}
          >
            {r.title}
          </button>
        ))}
      </div>

      {/* ฟอร์มพารามิเตอร์ */}
      <div className="rounded-3xl border border-slate-200 bg-white p-5 md:p-7 shadow-sm dark:border-slate-700 dark:bg-slate-800">
        <div className="mb-1 text-slate-700 dark:text-slate-200">{currentReport?.desc}</div>

        <div className="mt-4">
          {renderReportForm(currentReport)}
        </div>

        <div className="mt-6 flex flex-wrap gap-3">
          <button
            onClick={() => doDownload(currentReport)}
            disabled={downloading || loadingOptions}
            className={cx(
              "inline-flex items-center gap-2 rounded-2xl px-4 py-2 text-white bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800",
              (downloading || loadingOptions) && "opacity-60 cursor-not-allowed"
            )}
          >
            <span>⬇</span> ดาวน์โหลด {currentReport?.type === "json" ? "JSON" : "Excel"}
          </button>
          <button
            onClick={resetForm}
            className="rounded-2xl border border-slate-300 px-4 py-2 hover:bg-slate-100 dark:border-slate-600 dark:hover:bg-slate-700"
          >
            รีเซ็ตตัวกรอง
          </button>
        </div>

        {currentReport?.key === "stockTree" && previewJson && (
          <pre className="mt-6 max-h-96 overflow-auto rounded-2xl bg-slate-900 p-4 text-slate-100 text-sm">
            {JSON.stringify(previewJson, null, 2)}
          </pre>
        )}

        <p className="mt-6 text-sm text-slate-500 dark:text-slate-300">
          เพิ่มรายงานใหม่ ให้หลังบ้านเปิด endpoint ภายใต้ <code>/report/…</code> แล้วนิยามรายการในตัวแปร <code>REPORTS</code> กำหนด
          <code>require</code>/<code>optional</code> ให้ตรงกับ BE จากนั้น FE จะสร้าง query string ให้อัตโนมัติ
        </p>
      </div>
    </div>
  )
}

export default Documents
