import { useEffect, useMemo, useRef, useState } from "react"
import { apiAuth } from "../../lib/api"

import ProcurementPlanDetail from "./sell/ProcurementPlanDetail"
import AgriCollectionPlanTable from "./sell/AgriCollectionPlanTable"
import AgriProcessingPlanDetail from "./sell/AgriProcessingPlanDetail"
import SeedProjectSalesPlanDetail from "./sell/SeedProjectSalesPlanDetail"
import ServiceBusinessPlanDetail from "./sell/ServiceBusinessPlanDetail"
import BusinessPlanRevenueByBusinessTable from "./sell/BusinessPlanRevenueByBusinessTable"
import BusinessPlanOtherIncomeTable from "./sell/BusinessPlanOtherIncomeTable"

import BusinessPlanExpenseTable from "./cost/BusinessPlanExpenseTable"
import BusinessPlanExpenseOilTable from "./cost/BusinessPlanExpenseOilTable"
import BusinessPlanExpenseCollectionTable from "./cost/BusinessPlanExpenseCollectionTable"
import BusinessPlanExpenseProcessingTable from "./cost/BusinessPlanExpenseProcessingTable"
import BusinessPlanExpenseSeedProcessingTable from "./cost/BusinessPlanExpenseSeedProcessingTable"
import BusinessPlanExpenseServiceTable from "./cost/BusinessPlanExpenseServiceTable"
import BusinessPlanExpenseSupportWorkTable from "./cost/BusinessPlanExpenseSupportWorkTable"
import BusinessPlanRepCostSummaryTable from "./cost/BusinessPlanRepCostSummaryTable"
import Thonthun from "./thonthun/Thonthun"

// รายเดือน
import BusinessPlanExpenseTableDetail from "./cost/BusinessPlanExpenseTableDetail"
import BusinessPlanExpenseOilTableDetail from "./cost/BusinessPlanExpenseOilTableDetail"
import BusinessPlanExpenseCollectionTableDetail from "./cost/BusinessPlanExpenseCollectionTableDetail"
import BusinessPlanExpenseProcessingTableDetail from "./cost/BusinessPlanExpenseProcessingTableDetail"
import BusinessPlanExpenseSeedProcessingTableDetail from "./cost/BusinessPlanExpenseSeedProcessingTableDetail"
import BusinessPlanExpenseServiceTableDetail from "./cost/BusinessPlanExpenseServiceTableDetail"
import BusinessPlanExpenseSupportWorkTableDetail from "./cost/BusinessPlanExpenseSupportWorkTableDetail"
import BusinessPlanRepCostSummaryTableDetail from "./cost/BusinessPlanRepCostSummaryTableDetail"
import ThonthunDetail from "./thonthun/ThonthunDetail"


// ---------------- Styles ----------------
const cx = (...a) => a.filter(Boolean).join(" ")
const labelCls = "mb-1 block text-[15px] md:text-base font-medium text-slate-700 dark:text-slate-200"

const readonlyField =
  "w-full rounded-2xl border border-slate-300 bg-slate-100 p-3 text-[15px] md:text-base " +
  "text-black shadow-none dark:border-slate-500 dark:bg-slate-700 dark:text-slate-100"

// ---------------- Reusable ComboBox ----------------
function ComboBox({
  options = [],
  value,
  onChange,
  placeholder = "— เลือก —",
  getLabel = (o) => o?.label ?? "",
  getValue = (o) => o?.value ?? o?.id ?? "",
  getSubLabel = (o) => o?.subLabel ?? "",
  disabled = false,
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
    if (itemRect.top < listRect.top + buffer) listEl.scrollTop -= (listRect.top + buffer) - itemRect.top
    else if (itemRect.bottom > listRect.bottom - buffer) listEl.scrollTop += itemRect.bottom - (listRect.bottom - buffer)
  }

  const onKeyDown = (e) => {
    if (disabled) return
    if (!open && (e.key === "Enter" || e.key === " " || e.key === "ArrowDown")) {
      e.preventDefault()
      setOpen(true)
      setHighlight((h) => (h >= 0 ? h : 0))
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
    // ✅ ตอนเปิด dropdown ให้ยก z-index ของ wrapper ขึ้นมาชนะ sticky/table
    <div className={cx("relative", open && "z-[1000]")} ref={boxRef}>
      <button
        type="button"
        ref={controlRef}
        disabled={disabled}
        onClick={() => !disabled && setOpen((o) => !o)}
        onKeyDown={onKeyDown}
        className={cx(
          "w-full rounded-2xl border border-slate-300 bg-slate-100 p-3 text-left text-[15px] md:text-base outline-none transition shadow-none",
          disabled ? "cursor-not-allowed opacity-80" : "hover:bg-slate-200 cursor-pointer",
          "focus:border-emerald-600 focus:ring-2 focus:ring-emerald-500/30",
          "dark:border-slate-500 dark:bg-slate-700 dark:text-slate-100 dark:hover:bg-slate-700/80"
        )}
        aria-haspopup="listbox"
        aria-expanded={open}
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
          className="absolute z-[1100] mt-1 max-h-72 w-full overflow-auto overscroll-contain rounded-2xl border border-slate-200 bg-white text-black shadow-lg dark:border-slate-700 dark:bg-slate-800 dark:text-white"
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
                  isActive ? "bg-emerald-100 dark:bg-emerald-400/20" : "hover:bg-emerald-50 dark:hover:bg-emerald-900/30"
                )}
              >
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

/* ---------------- ประเภทตาราง ---------------- */
const PLAN_TYPES = [
  { id: "sell", label: "ยอดขาย", subLabel: "ตารางฝั่งรายได้/ยอดขาย" },
  { id: "cost", label: "ค่าใช้จ่าย", subLabel: "ตารางฝั่งต้นทุน/ค่าใช้จ่าย" },
  { id: "thonthun", label: "ต้นทุนสินค้า", subLabel: "ตารางฝั่งต้นทุนสินค้า" },
]

/* ---------------- ตาราง (เพิ่ม file ตามรูปโฟลเดอร์จริง) ---------------- */
const SALES_TABLES = [
  {
    key: "procurement-plan-detail",
    label: "รายละเอียดแผนการจัดหาสินค้า",
    file: "sell/ProcurementPlanDetail.jsx",
    Component: ProcurementPlanDetail,
  },
  {
    key: "agri-collection-plan-table",
    label: "รายละเอียดแผนการรวบรวมผลผลิตการเกษตร",
    file: "sell/AgriCollectionPlanTable.jsx",
    Component: AgriCollectionPlanTable,
  },
  {
    key: "agri-processing-plan-detail",
    label: "รายละเอียดแผนการแปรรูปผลผลิตการเกษตร (Detail)",
    file: "sell/AgriProcessingPlanDetail.jsx",
    Component: AgriProcessingPlanDetail,
  },
  {
    key: "seed-project-sales-plan-detail",
    label: "รายละเอียดแผนโครงการผลิตเมล็ดพันธุ์ (ยอดขาย)",
    file: "sell/SeedProjectSalesPlanDetail.jsx",
    Component: SeedProjectSalesPlanDetail,
  },
  {
    key: "service-business-plan-detail",
    label: "รายละเอียดแผนธุรกิจบริการ",
    file: "sell/ServiceBusinessPlanDetail.jsx",
    Component: ServiceBusinessPlanDetail,
  },
  {
    key: "business-plan-revenue-by-business",
    label: "รายได้เฉพาะธุรกิจ (สรุป)",
    file: "sell/BusinessPlanRevenueByBusinessTable.jsx",
    Component: BusinessPlanRevenueByBusinessTable,
  },
  {
    key: "business-plan-other-income",
    label: "รายได้อื่นๆ",
    file: "sell/BusinessPlanOtherIncomeTable.jsx",
    Component: BusinessPlanOtherIncomeTable,
  },
]

const COST_TABLES = [
  {
    key: "business-plan-expense-table",
    label: "ค่าใช้จ่ายเฉพาะ ธุรกิจจัดหาสินค้า",
    file: "cost/BusinessPlanExpenseTable.jsx",
    Component: BusinessPlanExpenseTable,
  },
  {
    key: "business-plan-expense-oil-table",
    label: "ค่าใช้จ่ายเฉพาะ ธุรกิจจัดหาสินค้า ปั๊มน้ำมัน",
    file: "cost/BusinessPlanExpenseOilTable.jsx",
    Component: BusinessPlanExpenseOilTable,
  },
  {
    key: "business-plan-expense-collection-table",
    label: "ค่าใช้จ่ายเฉพาะ ธุรกิจรวบรวม",
    file: "cost/BusinessPlanExpenseCollectionTable.jsx",
    Component: BusinessPlanExpenseCollectionTable,
  },
  {
    key: "business-plan-expense-processing-table",
    label: "ค่าใช้จ่ายเฉพาะ ธุรกิจแปรรูป",
    file: "cost/BusinessPlanExpenseProcessingTable.jsx",
    Component: BusinessPlanExpenseProcessingTable,
  },
  {
    key: "business-plan-expense-seed-processing-table",
    label: "ค่าใช้จ่ายเฉพาะ ธุรกิจแปรรูปเมล็ดพันธุ์",
    file: "cost/BusinessPlanExpenseSeedProcessingTable.jsx",
    Component: BusinessPlanExpenseSeedProcessingTable,
  },
  {
    key: "business-plan-expense-service-table",
    label: "ค่าใช้จ่ายเฉพาะ ธุรกิจบริการ",
    file: "cost/BusinessPlanExpenseServiceTable.jsx",
    Component: BusinessPlanExpenseServiceTable,
  },
  {
    key: "business-plan-expense-support-work-table",
    label: "ค่าใช้จ่ายดำเนินงาน",
    file: "cost/BusinessPlanExpenseSupportWorkTable.jsx",
    Component: BusinessPlanExpenseSupportWorkTable,
  },
  {
    key: "business-plan-rep-cost-summary",
    label: "ต้นทุนขายเฉพาะธุรกิจ",
    file: "cost/BusinessPlanRepCostSummaryTable.jsx",
    Component: BusinessPlanRepCostSummaryTable,
  },
  // รายเดือน
  {
    key: "business-plan-expense-table-detail",
    label: "ค่าใช้จ่ายเฉพาะ ธุรกิจจัดหาสินค้า (รายเดือน)",
    file: "cost/BusinessPlanExpenseTableDetail.jsx",
    Component: BusinessPlanExpenseTableDetail,
  },
  {
    key: "business-plan-expense-oil-table-detail",
    label: "ค่าใช้จ่ายเฉพาะ ธุรกิจจัดหาสินค้า ปั๊มน้ำมัน (รายเดือน)",
    file: "cost/BusinessPlanExpenseOilTableDetail.jsx",
    Component: BusinessPlanExpenseOilTableDetail,
  },
  {
    key: "business-plan-expense-collection-table-detail",
    label: "ค่าใช้จ่ายเฉพาะ ธุรกิจรวบรวม (รายเดือน)",
    file: "cost/BusinessPlanExpenseCollectionTableDetail.jsx",
    Component: BusinessPlanExpenseCollectionTableDetail,
  },
  {
    key: "business-plan-expense-processing-table-detail",
    label: "ค่าใช้จ่ายเฉพาะ ธุรกิจแปรรูป (รายเดือน)",
    file: "cost/BusinessPlanExpenseProcessingTableDetail.jsx",
    Component: BusinessPlanExpenseProcessingTableDetail,
  },
  {
    key: "business-plan-expense-seed-processing-table-detail",
    label: "ค่าใช้จ่ายเฉพาะ ธุรกิจแปรรูปเมล็ดพันธุ์ (รายเดือน)",
    file: "cost/BusinessPlanExpenseSeedProcessingTableDetail.jsx",
    Component: BusinessPlanExpenseSeedProcessingTableDetail,
  },
  {
    key: "business-plan-expense-service-table-detail",
    label: "ค่าใช้จ่ายเฉพาะ ธุรกิจบริการ (รายเดือน)",
    file: "cost/BusinessPlanExpenseServiceTableDetail.jsx",
    Component: BusinessPlanExpenseServiceTableDetail,
  },
  {
    key: "business-plan-expense-support-work-table-detail",
    label: "ค่าใช้จ่ายดำเนินงาน (รายเดือน)",
    file: "cost/BusinessPlanExpenseSupportWorkTableDetail.jsx",
    Component: BusinessPlanExpenseSupportWorkTableDetail,
  },
  {
    key: "business-plan-rep-cost-summary-detail",
    label: "ต้นทุนขายเฉพาะธุรกิจ (รายเดือน)",
    file: "cost/BusinessPlanRepCostSummaryTableDetail.jsx",
    Component: BusinessPlanRepCostSummaryTableDetail,
  },
]

const THONTHUN_TABLES = [
    { key: "thonthun", label: "ประมาณการต้นทุนสินค้า", file: "thonthun/Thonthun.jsx", Component: Thonthun },
    { key: "thonthun-detail", label: "ประมาณการต้นทุนสินค้า (รายเดือน)", file: "thonthun/ThonthunDetail.jsx", Component: ThonthunDetail },
]

const OperationPlan = () => {
  useEffect(() => {
    document.title = "แผนปฏิบัติงาน (Operation Plan)"
  }, [])

  // ปี 2569..2579
  const yearOptions = useMemo(() => {
    const start = 2569
    const count = 11
    return Array.from({ length: count }, (_, i) => {
      const y = String(start + i)
      return { id: y, label: y }
    })
  }, [])

  const [yearBE, setYearBE] = useState("2569")

  // planId: 2569=>1
  const planId = useMemo(() => {
    const y = Number(yearBE || 0)
    return Number.isFinite(y) ? y - 2568 : 0
  }, [yearBE])

  const [loadingBranches, setLoadingBranches] = useState(false)
  const [branchOptions, setBranchOptions] = useState([])
  const [branchId, setBranchId] = useState("")

  const [planType, setPlanType] = useState("")
  const [tableKey, setTableKey] = useState("")

  // ต้นทุนสินค้า = รวมทุกสาขา → ไม่บังคับเลือกสาขา
  useEffect(() => {
    if (planType === "thonthun") setBranchId("")
  }, [planType])

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

  const currentTables = useMemo(() => {
    if (planType === "sell") return SALES_TABLES
    if (planType === "cost") return COST_TABLES
    if (planType === "thonthun") return THONTHUN_TABLES
    return []
  }, [planType])

  useEffect(() => {
    if (!planType) {
      setTableKey("")
      return
    }
    const has = currentTables.some((t) => t.key === tableKey)
    if (!has) setTableKey(currentTables[0]?.key || "")
  }, [planType, currentTables, tableKey])

  const branchName = useMemo(() => {
    return branchOptions.find((b) => String(b.id) === String(branchId))?.label || ""
  }, [branchOptions, branchId])

  const isThonthun = planType === "thonthun"
  const branchRequired = planType === "sell" || planType === "cost"

  const branchNameDisplay = useMemo(() => {
    if (isThonthun) return "ทุกสาขา"
    return branchName || "—"
  }, [isThonthun, branchName])

  const planTypeLabel = useMemo(() => PLAN_TYPES.find((p) => p.id === planType)?.label || "", [planType])

  const activeTable = useMemo(() => currentTables.find((t) => t.key === tableKey) || null, [currentTables, tableKey])
  const ActiveComponent = activeTable?.Component || null
  const canShowTable = !!planType && !!ActiveComponent && (!branchRequired || !!branchId)

  const planTypeOptions = useMemo(() => PLAN_TYPES.map((p) => ({ id: p.id, label: p.label, subLabel: p.subLabel || "" })), [])

  // ✅ ดรอปดาวเลือกตาราง: subLabel = ไฟล์ที่มา
  const tableOptions = useMemo(() => {
    return currentTables.map((t) => ({
      id: t.key,
      label: t.label,
      subLabel: t.file ? `ไฟล์: ${t.file}` : "",
    }))
  }, [currentTables])

  const yearRef = useRef(null)
  const branchRef = useRef(null)
  const typeRef = useRef(null)
  const tableRef = useRef(null)

  return (
    <div className="min-h-screen bg-white text-black dark:bg-slate-900 dark:text-white rounded-2xl">
      <div className="mx-auto max-w-[1400px] p-4 md:p-6">
        <div className="mb-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-800">
          <div className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
            <div>
              <h1 className="text-2xl md:text-3xl font-extrabold">🗺️ แผนปฏิบัติงาน</h1>
              <div className="mt-1 text-sm text-slate-600 dark:text-slate-300">
                {planType === "thonthun"
                  ? "เลือกปี → เลือกประเภทตาราง → เลือกตาราง → กรอกข้อมูล"
                  : "เลือกปี → เลือกสาขา → เลือกประเภทตาราง → เลือกตาราง → กรอกข้อมูล"}
              </div>
            </div>

            <div className="inline-flex items-center rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-semibold text-slate-700 dark:border-slate-700 dark:bg-slate-900/30 dark:text-slate-200">
              MODE: Form Entry
            </div>
          </div>

          <div className="mt-4 grid gap-3 md:grid-cols-12">
            <div className="md:col-span-3">
              <label className={labelCls}>ปี (พ.ศ.)</label>
              <ComboBox
                options={yearOptions}
                value={yearBE}
                onChange={(id) => setYearBE(String(id))}
                placeholder="— เลือกปี —"
                buttonRef={yearRef}
                onEnterNext={() => (planType === "thonthun" ? typeRef.current?.focus?.() : branchRef.current?.focus?.())}
              />
            </div>

            <div className="md:col-span-4">
              <label className={labelCls}>เลือกสาขา</label>

              {planType === "thonthun" ? (
                <div className={readonlyField}>
                  <span>ทุกสาขา</span>
                  <span className="ml-2 text-[13px] text-slate-600 dark:text-slate-300">(ไม่ต้องเลือก)</span>
                </div>
              ) : (
                <ComboBox
                  options={branchOptions}
                  value={branchId}
                  onChange={(id) => setBranchId(String(id))}
                  placeholder={loadingBranches ? "กำลังโหลดสาขา..." : "— เลือกสาขา —"}
                  disabled={loadingBranches}
                  buttonRef={branchRef}
                  onEnterNext={() => typeRef.current?.focus?.()}
                />
              )}

              {branchRequired && !branchId && <div className="mt-2 text-sm text-red-600 dark:text-red-400">* กรุณาเลือกสาขาก่อน</div>}
            </div>

            <div className="md:col-span-5">
              <label className={labelCls}>ประเภทตาราง</label>
              <ComboBox
                options={planTypeOptions}
                value={planType}
                onChange={(id) => setPlanType(String(id))}
                placeholder="— เลือก: ยอดขาย / ค่าใช้จ่าย / ต้นทุนสินค้า —"
                getSubLabel={(o) => o?.subLabel || ""}
                buttonRef={typeRef}
                onEnterNext={() => tableRef.current?.focus?.()}
              />
            </div>
          </div>

          <div className="mt-3 grid gap-3 md:grid-cols-12">
            <div className="md:col-span-12">
              <label className={labelCls}>เลือกตาราง</label>
              <ComboBox
                options={tableOptions}
                value={tableKey}
                onChange={(id) => setTableKey(String(id))}
                placeholder={planType ? "— เลือกตาราง —" : "ต้องเลือกประเภทตารางก่อน"}
                disabled={!planType}
                getSubLabel={(o) => o?.subLabel || ""}
                buttonRef={tableRef}
              />
            </div>
          </div>

          <div className="mt-4 flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
            <div className="text-sm text-slate-700 dark:text-slate-200">
              <span className="font-semibold">ปี:</span> {yearBE}
              <span className="mx-2 text-slate-400">|</span>
              <span className="font-semibold">plan_id:</span> {planId || "-"}
              <span className="mx-2 text-slate-400">|</span>
              <span className="font-semibold">สาขา:</span> {branchNameDisplay}
              <span className="mx-2 text-slate-400">|</span>
              <span className="font-semibold">ประเภท:</span> {planTypeLabel || "—"}
              <span className="mx-2 text-slate-400">|</span>
              <span className="font-semibold">ตาราง:</span> {activeTable?.label || "—"}
              {activeTable?.file ? (
                <>
                  <span className="mx-2 text-slate-400">|</span>
                  <span className="font-semibold">ไฟล์:</span> {activeTable.file}
                </>
              ) : null}
            </div>

            <button
              type="button"
              onClick={() => {
                setBranchId("")
                setPlanType("")
                setTableKey("")
                setYearBE("2569")
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
        {!planType ? (
          <div className="rounded-2xl border border-slate-200 bg-white p-6 text-center shadow-sm dark:border-slate-700 dark:bg-slate-800">
            <div className="text-lg font-bold">ยังไม่พร้อมกรอกตาราง</div>
            <div className="mt-2 text-slate-600 dark:text-slate-300">
              กรุณาเลือก <span className="font-semibold">ประเภทตาราง</span> ก่อน
            </div>
          </div>
        ) : !tableKey ? (
          <div className="rounded-2xl border border-slate-200 bg-white p-6 text-center shadow-sm dark:border-slate-700 dark:bg-slate-800">
            <div className="text-lg font-bold">ยังไม่พร้อมกรอกตาราง</div>
            <div className="mt-2 text-slate-600 dark:text-slate-300">
              กรุณาเลือก <span className="font-semibold">ตาราง</span> ก่อน
            </div>
          </div>
        ) : branchRequired && !branchId ? (
          <div className="rounded-2xl border border-slate-200 bg-white p-6 text-center shadow-sm dark:border-slate-700 dark:bg-slate-800">
            <div className="text-lg font-bold">ยังไม่พร้อมกรอกตาราง</div>
            <div className="mt-2 text-slate-600 dark:text-slate-300">
              กรุณาเลือก <span className="font-semibold">สาขา</span> ก่อน
            </div>
          </div>
        ) : !canShowTable ? (
          <div className="rounded-2xl border border-slate-200 bg-white p-6 text-center shadow-sm dark:border-slate-700 dark:bg-slate-800">
            <div className="text-lg font-bold">ยังไม่พร้อมกรอกตาราง</div>
            <div className="mt-2 text-slate-600 dark:text-slate-300">กรุณาเลือกให้ครบ</div>
          </div>
        ) : (
          <div className="mt-2">
            <ActiveComponent
              key={`${planType}-${tableKey}-${branchRequired ? branchId : "all"}-${yearBE}`}
              branchId={branchId}
              branchName={branchNameDisplay}
              yearBE={yearBE}
              planId={planId}
            />
          </div>
        )}
      </div>
    </div>
  )
}

export default OperationPlan
