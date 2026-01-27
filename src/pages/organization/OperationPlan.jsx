import { useEffect, useMemo, useRef, useState } from "react"
import { apiAuth } from "../../lib/api"

import ProcurementPlanDetail from "./sell/ProcurementPlanDetail"
import AgriCollectionPlanTable from "./sell/AgriCollectionPlanTable"
import AgriProcessingPlanDetail from "./sell/AgriProcessingPlanDetail"
import SeedProjectSalesPlanDetail from "./sell/SeedProjectSalesPlanDetail"
import ServiceBusinessPlanDetail from "./sell/ServiceBusinessPlanDetail"

// ---------------- Styles (ให้เหมือนหน้า Sales) ----------------
const cx = (...a) => a.filter(Boolean).join(" ")
const baseField =
  "w-full rounded-2xl border border-slate-300 bg-slate-100 p-3 text-[15px] md:text-base " +
  "text-black outline-none placeholder:text-slate-500 focus:border-emerald-600 focus:ring-2 focus:ring-emerald-500/30 shadow-none " +
  "dark:border-slate-500 dark:bg-slate-700 dark:text-slate-100 dark:placeholder:text-slate-300 dark:focus:border-emerald-400 dark:focus:ring-emerald-400/30"

const labelCls = "mb-1 block text-[15px] md:text-base font-medium text-slate-700 dark:text-slate-200"

// ---------------- Reusable ComboBox (ยกทรงเดียวกับหน้า Sales) ----------------
function ComboBox({
  options = [],
  value,
  onChange,
  placeholder = "— เลือก —",
  getLabel = (o) => o?.label ?? "",
  getValue = (o) => o?.value ?? o?.id ?? "",
  getSubLabel = (o) => o?.subLabel ?? "",
  disabled = false,
  error = false,
  hintRed = false,
  clearHint = () => {},
  buttonRef = null,
  onEnterNext,
}) {
  const [open, setOpen] = useState(false)
  const [highlight, setHighlight] = useState(-1)
  const boxRef = useRef(null)
  const listRef = useRef(null)
  const internalBtnRef = useRef(null)
  const controlRef = buttonRef || internalBtnRef

  const selectedObj = useMemo(
    () => options.find((o) => String(getValue(o)) === String(value)),
    [options, value, getValue]
  )
  const selectedLabel = selectedObj ? getLabel(selectedObj) : ""
  const selectedSubLabel = selectedObj ? getSubLabel(selectedObj) || "" : ""

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
    requestAnimationFrame(() => {
      controlRef.current?.focus()
      onEnterNext?.()
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
        onClick={() => {
          if (!disabled) {
            setOpen((o) => !o)
            clearHint?.()
            setHighlight((h) => (h >= 0 ? h : 0))
          }
        }}
        onKeyDown={onKeyDown}
        onFocus={() => clearHint?.()}
        className={cx(
          "w-full rounded-2xl border p-3 text-left text-[15px] md:text-base outline-none transition shadow-none",
          disabled ? "bg-slate-100 cursor-not-allowed opacity-95" : "bg-slate-100 hover:bg-slate-200 cursor-pointer",
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
        {selectedLabel ? (
          <div className="flex flex-col">
            <span>{selectedLabel}</span>
            {selectedSubLabel && (
              <span className="text-[13px] text-slate-600 dark:text-slate-300">{selectedSubLabel}</span>
            )}
          </div>
        ) : (
          <span className="text-slate-500 dark:text-white/70">{placeholder}</span>
        )}
      </button>

      {open && (
        <div
          ref={listRef}
          role="listbox"
          className="absolute z-20 mt-1 max-h-72 w-full overflow-auto overscroll-contain rounded-2xl border border-slate-200 bg-white text-black shadow-lg dark:border-slate-700 dark:bg-slate-800 dark:text-white"
        >
          {options.length === 0 && (
            <div className="px-3 py-2 text-sm text-slate-600 dark:text-slate-300">ไม่มีตัวเลือก</div>
          )}
          {options.map((opt, idx) => {
            const label = getLabel(opt)
            const sub = getSubLabel(opt) || ""
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
                <span className="flex-1">
                  <div>{label}</div>
                  {sub && <div className="text-sm text-slate-600 dark:text-slate-300">{sub}</div>}
                </span>
                {isChosen && <span className="text-emerald-600 dark:text-emerald-300">✓</span>}
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}

/* ---------------- ประเภทตาราง (ต้องเลือกก่อน) ---------------- */
const PLAN_TYPES = [
  { id: "sell", label: "ยอดขาย", subLabel: "ตารางฝั่งรายได้/ยอดขาย (ที่ทำไว้แล้ว)" },
  { id: "cost", label: "ค่าใช้จ่าย", subLabel: "เดี๋ยวจะตามมาทีหลัง" },
]

/* ---------------- ตารางฝั่ง “ยอดขาย” (ของเดิมทั้งหมด) ---------------- */
const SALES_TABLES = [
  {
    key: "procurement-plan-detail",
    label: "รายละเอียดแผนการจัดหาสินค้า",
    description: "ไฟล์: sell/ProcurementPlanDetail.jsx (เม.ย.–มี.ค. | ปร/รับ/พร)",
    Component: ProcurementPlanDetail,
  },
  {
    key: "agri-collection-plan-table",
    label: "รายละเอียดแผนการรวบรวมผลผลิตการเกษตร",
    description: "ไฟล์: sell/AgriCollectionPlanTable.jsx (เม.ย.–มี.ค. | มีแถวรวมอัตโนมัติ)",
    Component: AgriCollectionPlanTable,
  },
  {
    key: "agri-processing-plan-detail",
    label: "รายละเอียดแผนการแปรรูปผลผลิตการเกษตร (Detail)",
    description: "ไฟล์: sell/AgriProcessingPlanDetail.jsx",
    Component: AgriProcessingPlanDetail,
  },
  {
    key: "seed-project-sales-plan-detail",
    label: "รายละเอียดแผนโครงการผลิตเมล็ดพันธุ์ (ยอดขาย)",
    description: "ไฟล์: sell/SeedProjectSalesPlanDetail.jsx",
    Component: SeedProjectSalesPlanDetail,
  },
  {
    key: "service-business-plan-detail",
    label: "รายละเอียดแผนธุรกิจบริการ",
    description: "ไฟล์: sell/ServiceBusinessPlanDetail.jsx",
    Component: ServiceBusinessPlanDetail,
  },
]

// ---------------- Page ----------------
const OperationPlan = () => {
  useEffect(() => {
    document.title = "แผนปฏิบัติงาน (Operation Plan)"
  }, [])

  const [yearBE, setYearBE] = useState("2568")

  // branches
  const [loadingBranches, setLoadingBranches] = useState(false)
  const [branchOptions, setBranchOptions] = useState([])
  const [branchId, setBranchId] = useState("")

  // ✅ NEW: ประเภทตาราง (ต้องเลือกก่อน)
  const [planType, setPlanType] = useState("") // "sell" | "cost"

  // selected table
  const [tableKey, setTableKey] = useState("")

  useEffect(() => {
    const loadBranches = async () => {
      try {
        setLoadingBranches(true)
        const branches = await apiAuth(`/order/branch/search`)
        const opts = (Array.isArray(branches) ? branches : [])
          .map((x) => ({
            id: String(x.id),
            label: String(x.branch_name || x.name || `สาขา #${x.id}`),
          }))
          .filter((o) => o.id && o.label)
        setBranchOptions(opts)
      } catch (e) {
        console.error("load branches failed:", e)
        setBranchOptions([])
      } finally {
        setLoadingBranches(false)
      }
    }
    loadBranches()
  }, [])

  // ✅ เมื่อเปลี่ยนประเภท: รีเซ็ต dropdown ตารางอัตโนมัติ
  useEffect(() => {
    if (planType === "sell") {
      setTableKey(SALES_TABLES[0]?.key || "")
    } else {
      setTableKey("")
    }
  }, [planType])

  const branchName = useMemo(() => {
    return branchOptions.find((b) => String(b.id) === String(branchId))?.label || ""
  }, [branchOptions, branchId])

  const planTypeLabel = useMemo(() => {
    return PLAN_TYPES.find((p) => p.id === planType)?.label || ""
  }, [planType])

  const currentTables = useMemo(() => {
    if (planType === "sell") return SALES_TABLES
    // cost จะตามมาทีหลัง
    return []
  }, [planType])

  const activeTable = useMemo(() => {
    return currentTables.find((t) => t.key === tableKey) || null
  }, [currentTables, tableKey])

  const ActiveComponent = activeTable?.Component || null

  const canShowTable = !!branchId && planType === "sell" && !!ActiveComponent

  const planTypeOptions = useMemo(
    () => PLAN_TYPES.map((p) => ({ id: p.id, label: p.label, subLabel: p.subLabel || "" })),
    []
  )

  const tableOptions = useMemo(() => {
    return currentTables.map((t) => ({
      id: t.key,
      label: t.label,
      subLabel: t.description || "",
    }))
  }, [currentTables])

  const branchRef = useRef(null)
  const typeRef = useRef(null)
  const tableRef = useRef(null)

  const tablePlaceholder = useMemo(() => {
    if (!planType) return "เลือกประเภทตารางก่อน"
    if (planType === "cost") return "ค่าใช้จ่ายเดี๋ยวจะตามมาทีหลัง"
    return "— เลือกตาราง —"
  }, [planType])

  const tableDisabled = useMemo(() => {
    if (!planType) return true
    if (planType === "cost") return true
    return false
  }, [planType])

  return (
    <div className="min-h-screen bg-white text-black dark:bg-slate-900 dark:text-white rounded-2xl">
      <div className="mx-auto max-w-[1400px] p-4 md:p-6">
        <div className="mb-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-800">
          <div className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
            <div>
              <h1 className="text-2xl md:text-3xl font-extrabold">🗺️ แผนปฏิบัติงาน</h1>
              <div className="mt-1 text-sm text-slate-600 dark:text-slate-300">
                เลือกสาขา → เลือกประเภทตาราง → เลือกตาราง → กรอกข้อมูล
              </div>
            </div>

            <div className="inline-flex items-center rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-semibold text-slate-700 dark:border-slate-700 dark:bg-slate-900/30 dark:text-slate-200">
              MODE: Form Entry
            </div>
          </div>

          {/* Controls */}
          <div className="mt-4 grid gap-3 md:grid-cols-12">
            <div className="md:col-span-3">
              <label className={labelCls}>ปี (พ.ศ.)</label>
              <input
                className={baseField}
                value={yearBE}
                onChange={(e) => setYearBE(e.target.value)}
                placeholder="เช่น 2568"
              />
            </div>

            <div className="md:col-span-4">
              <label className={labelCls}>เลือกสาขา</label>
              <ComboBox
                options={branchOptions}
                value={branchId}
                onChange={(id) => setBranchId(String(id))}
                placeholder={loadingBranches ? "กำลังโหลดสาขา..." : "— เลือกสาขา —"}
                disabled={loadingBranches}
                buttonRef={branchRef}
                onEnterNext={() => typeRef.current?.focus?.()}
              />
              {!branchId && <div className="mt-2 text-sm text-red-600 dark:text-red-400">* กรุณาเลือกสาขาก่อน</div>}
            </div>

            {/* ✅ NEW: ประเภทตาราง */}
            <div className="md:col-span-5">
              <label className={labelCls}>ประเภทตาราง</label>
              <ComboBox
                options={planTypeOptions}
                value={planType}
                onChange={(id) => setPlanType(String(id))}
                placeholder="— เลือก: ยอดขาย / ค่าใช้จ่าย —"
                getSubLabel={(o) => o?.subLabel || ""}
                buttonRef={typeRef}
                onEnterNext={() => tableRef.current?.focus?.()}
              />
              {!planType && (
                <div className="mt-2 text-sm text-amber-600 dark:text-amber-300">
                  * ต้องเลือก “ประเภทตาราง” ก่อน ถึงจะเลือกตารางย่อยได้
                </div>
              )}
              {planType === "cost" && (
                <div className="mt-2 text-sm text-slate-600 dark:text-slate-300">
                  โหมดค่าใช้จ่าย: เดี๋ยวจะตามมาทีหลัง (ตอนนี้ยังไม่เปิดให้เลือกตาราง)
                </div>
              )}
            </div>

            {/* ✅ ตารางย่อย (จะแสดง/ใช้งานได้เมื่อเลือกประเภทเป็น “ยอดขาย”) */}
            <div className="md:col-span-12">
              <label className={labelCls}>เลือกตารางที่จะกรอก</label>
              <ComboBox
                options={tableOptions}
                value={tableKey}
                onChange={(id) => setTableKey(String(id))}
                placeholder={tablePlaceholder}
                getSubLabel={(o) => o?.subLabel || ""}
                buttonRef={tableRef}
                disabled={tableDisabled}
              />
              <div className="mt-2 text-sm text-slate-600 dark:text-slate-300">
                {activeTable?.description || (planType === "cost" ? "ตารางค่าใช้จ่ายจะเพิ่มทีหลัง" : "")}
              </div>
            </div>
          </div>

          {/* Quick summary */}
          <div className="mt-4 flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
            <div className="text-sm text-slate-700 dark:text-slate-200">
              <span className="font-semibold">สาขา:</span> {branchName || "—"}
              <span className="mx-2 text-slate-400">|</span>
              <span className="font-semibold">ประเภท:</span> {planTypeLabel || "—"}
              <span className="mx-2 text-slate-400">|</span>
              <span className="font-semibold">ตาราง:</span> {activeTable?.label || "—"}
            </div>

            <button
              type="button"
              onClick={() => {
                setBranchId("")
                setPlanType("")
                setTableKey("")
              }}
              className="inline-flex items-center justify-center rounded-2xl border border-slate-300 bg-white px-5 py-2.5 text-sm font-semibold text-slate-800
                         hover:bg-slate-100 hover:scale-[1.02] active:scale-[.98] transition cursor-pointer
                         dark:border-slate-600 dark:bg-slate-700/60 dark:text-white dark:hover:bg-slate-700/40"
            >
              รีเซ็ตการเลือก
            </button>
          </div>
        </div>

        {/* Content */}
        {!branchId ? (
          <div className="rounded-2xl border border-slate-200 bg-white p-6 text-center shadow-sm dark:border-slate-700 dark:bg-slate-800">
            <div className="text-lg font-bold">ยังไม่พร้อมกรอกตาราง</div>
            <div className="mt-2 text-slate-600 dark:text-slate-300">
              กรุณาเลือก <span className="font-semibold">สาขา</span> ก่อน
            </div>
          </div>
        ) : planType === "cost" ? (
          <div className="rounded-2xl border border-slate-200 bg-white p-6 text-center shadow-sm dark:border-slate-700 dark:bg-slate-800">
            <div className="text-lg font-bold">โหมดค่าใช้จ่าย</div>
            <div className="mt-2 text-slate-600 dark:text-slate-300">
              ตารางค่าใช้จ่าย <span className="font-semibold">เดี๋ยวจะตามมาทีหลัง</span>
            </div>
          </div>
        ) : !planType ? (
          <div className="rounded-2xl border border-slate-200 bg-white p-6 text-center shadow-sm dark:border-slate-700 dark:bg-slate-800">
            <div className="text-lg font-bold">ยังไม่พร้อมกรอกตาราง</div>
            <div className="mt-2 text-slate-600 dark:text-slate-300">
              กรุณาเลือก <span className="font-semibold">ประเภทตาราง</span> ก่อน
            </div>
          </div>
        ) : !canShowTable ? (
          <div className="rounded-2xl border border-slate-200 bg-white p-6 text-center shadow-sm dark:border-slate-700 dark:bg-slate-800">
            <div className="text-lg font-bold">ยังไม่พร้อมกรอกตาราง</div>
            <div className="mt-2 text-slate-600 dark:text-slate-300">
              กรุณาเลือก <span className="font-semibold">ตาราง</span> ก่อน
            </div>
          </div>
        ) : (
          <div className="mt-2">
            <ActiveComponent
              key={`${planType}-${tableKey}-${branchId}-${yearBE}`}
              branchId={branchId}
              branchName={branchName}
              yearBE={yearBE}
              onYearBEChange={setYearBE}
            />
          </div>
        )}
      </div>
    </div>
  )
}

export default OperationPlan
