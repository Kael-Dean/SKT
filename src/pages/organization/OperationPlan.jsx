import { useEffect, useMemo, useRef, useState } from "react"
import ReactDOM from "react-dom"
import { apiAuth } from "../../lib/api"
import { EmptyState } from "../../components/ui"

import ProcurementPlanDetail from "./sell/ProcurementPlanDetail"
import AgriCollectionPlanTable from "./sell/AgriCollectionPlanTable"
import AgriProcessingPlanDetail from "./sell/AgriProcessingPlanDetail"
import SeedProjectSalesPlanDetail from "./sell/SeedProjectSalesPlanDetail"
import ServiceBusinessPlanDetail from "./sell/ServiceBusinessPlanDetail"
import BusinessPlanRevenueByBusinessTable from "./sell/BusinessPlanRevenueByBusinessTable"
import BusinessPlanOtherIncomeTable from "./sell/BusinessPlanOtherIncomeTable"

import BusinessPlanExpenseTableDetail from "./cost/BusinessPlanExpenseTableDetail"
import BusinessPlanExpenseOilTableDetail from "./cost/BusinessPlanExpenseOilTableDetail"
import BusinessPlanExpenseCollectionTableDetail from "./cost/BusinessPlanExpenseCollectionTableDetail"
import BusinessPlanExpenseProcessingTableDetail from "./cost/BusinessPlanExpenseProcessingTableDetail"
import BusinessPlanExpenseSeedProcessingTableDetail from "./cost/BusinessPlanExpenseSeedProcessingTableDetail"
import BusinessPlanExpenseServiceTableDetail from "./cost/BusinessPlanExpenseServiceTableDetail"
import BusinessPlanExpenseSupportWorkTableDetail from "./cost/BusinessPlanExpenseSupportWorkTableDetail"
import BusinessPlanRepCostSummaryTableDetail from "./cost/BusinessPlanRepCostSummaryTableDetail"
import Thonthun from "./thonthun/Thonthun"
import useModalDismiss from "../../lib/useModalDismiss"
import ComboBox from "../../components/ComboBox"

// ---------------- Styles ----------------
const labelCls = "mb-1 block text-[15px] md:text-base font-medium text-slate-700 dark:text-slate-200"

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
    label: "รายละเอียดแผนการแปรรูปผลผลิตการเกษตร",
    file: "sell/AgriProcessingPlanDetail.jsx",
    Component: AgriProcessingPlanDetail,
  },
  {
    key: "seed-project-sales-plan-detail",
    label: "รายละเอียดแผนโครงการผลิตเมล็ดพันธุ์",
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
    label: "รายได้เฉพาะธุรกิจ (สรุป รายเดือน)",
    file: "sell/BusinessPlanRevenueByBusinessTable.jsx",
    Component: BusinessPlanRevenueByBusinessTable,
  },
  {
    key: "business-plan-other-income",
    label: "รายได้อื่นๆ (รายเดือน)",
    file: "sell/BusinessPlanOtherIncomeTable.jsx",
    Component: BusinessPlanOtherIncomeTable,
  },
]

const COST_TABLES = [
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
  { key: "thonthun", label: "ประมาณการต้นทุนสินค้า (รายปี)", file: "thonthun/Thonthun.jsx", Component: Thonthun },
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
  const [modalOpen, setModalOpen] = useState(false)


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
    if (!has) setTableKey("")
  }, [planType, currentTables, tableKey])

  const branchName = useMemo(() => {
    return branchOptions.find((b) => String(b.id) === String(branchId))?.label || ""
  }, [branchOptions, branchId])

  const branchRequired = planType === "sell" || planType === "cost" || planType === "thonthun"

  const branchNameDisplay = useMemo(() => branchName || "—", [branchName])

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

  // Auto-open modal เมื่อเลือกตารางและครบทุก condition
  useEffect(() => {
    if (canShowTable) setModalOpen(true)
  }, [tableKey, canShowTable])

  // Escape key ปิด modal (full-screen — ไม่มี backdrop ให้คลิก)
  useModalDismiss(() => setModalOpen(false), { open: modalOpen && canShowTable })

  // Lock body scroll เมื่อ modal เปิด
  useEffect(() => {
    if (modalOpen) {
      document.body.style.overflow = "hidden"
    } else {
      document.body.style.overflow = ""
    }
    return () => { document.body.style.overflow = "" }
  }, [modalOpen])

  const yearRef = useRef(null)
  const branchRef = useRef(null)
  const typeRef = useRef(null)
  const tableRef = useRef(null)

  return (
    <>
      <div className="min-h-screen bg-white text-black dark:bg-slate-900 dark:text-white rounded-2xl">
        <div className="mx-auto max-w-[1400px] p-4 md:p-6">
          <div className="mb-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-800">
            <div className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
              <div>
                <h1 className="text-2xl md:text-3xl font-extrabold">🗺️ แผนปฏิบัติงาน</h1>
                <div className="mt-1 text-sm text-slate-600 dark:text-slate-300">
                  เลือกปี → เลือกประเภทตาราง → เลือกสาขา → เลือกตาราง → กรอกข้อมูล
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
                  onEnterNext={() => typeRef.current?.focus?.()}
                />
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
                  onEnterNext={() => branchRef.current?.focus?.()}
                />
              </div>

              <div className="md:col-span-4">
                <label className={labelCls}>เลือกสาขา</label>
                <ComboBox
                  options={branchOptions}
                  value={branchId}
                  onChange={(id) => setBranchId(String(id))}
                  placeholder={loadingBranches ? "กำลังโหลดสาขา..." : "— เลือกสาขา —"}
                  disabled={loadingBranches || !planType}
                  buttonRef={branchRef}
                  onEnterNext={() => tableRef.current?.focus?.()}
                />
                {branchRequired && !branchId && <div className="mt-2 text-sm text-red-600 dark:text-red-400">* กรุณาเลือกสาขาก่อน</div>}
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
                รีเซ็ต
              </button>
            </div>
          </div>

          {/* Content */}
          {!planType ? (
            <div className="rounded-2xl border border-slate-200 bg-white p-6 text-center shadow-sm dark:border-slate-700 dark:bg-slate-800">
              <div className="text-4xl mb-3">📋</div>
              <div className="text-lg font-bold">เริ่มต้นด้วยการเลือกข้อมูล</div>
              <div className="mt-2 text-slate-600 dark:text-slate-300">
                กรุณาเลือก <span className="font-semibold">ประเภทตาราง</span> ก่อน
              </div>
            </div>
          ) : !tableKey ? (
            <div className="rounded-2xl border border-slate-200 bg-white p-6 text-center shadow-sm dark:border-slate-700 dark:bg-slate-800">
              <div className="text-4xl mb-3">📊</div>
              <div className="text-lg font-bold">เลือกตารางที่ต้องการ</div>
              <div className="mt-2 text-slate-600 dark:text-slate-300">
                กรุณาเลือก <span className="font-semibold">ตาราง</span> จาก dropdown ด้านบน
              </div>
            </div>
          ) : branchRequired && !branchId ? (
            <div className="rounded-2xl border border-slate-200 bg-white p-6 text-center shadow-sm dark:border-slate-700 dark:bg-slate-800">
              <div className="text-4xl mb-3">🏢</div>
              <div className="text-lg font-bold">เลือกสาขาก่อน</div>
              <div className="mt-2 text-slate-600 dark:text-slate-300">
                กรุณาเลือก <span className="font-semibold">สาขา</span> ก่อนเพื่อเปิดตาราง
              </div>
            </div>
          ) : !canShowTable ? (
            <div className="rounded-2xl border border-slate-200 bg-white p-6 text-center shadow-sm dark:border-slate-700 dark:bg-slate-800">
              <div className="text-lg font-bold">ยังไม่พร้อมกรอกตาราง</div>
              <div className="mt-2 text-slate-600 dark:text-slate-300">กรุณาเลือกให้ครบ</div>
            </div>
          ) : (
            <div className="mt-2 rounded-2xl border border-indigo-200 bg-indigo-50 p-4 shadow-sm dark:border-indigo-700/50 dark:bg-indigo-900/20">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <div className="font-bold text-indigo-900 dark:text-indigo-100">{activeTable?.label}</div>
                  <div className="mt-1 text-sm text-indigo-700 dark:text-indigo-300">
                    ปี {yearBE} • สาขา {branchNameDisplay} • {planTypeLabel}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setModalOpen(true)}
                  className="flex-shrink-0 inline-flex items-center gap-2 rounded-2xl bg-indigo-500 px-5 py-2.5 text-sm font-semibold text-white hover:bg-indigo-600 active:scale-[.98] transition cursor-pointer"
                >
                  <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2.5">
                    <path d="M15 3h6v6M9 21H3v-6M21 3l-7 7M3 21l7-7" />
                  </svg>
                  เปิดตาราง
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Full-screen Table Modal */}
      {modalOpen && canShowTable && ReactDOM.createPortal(
        <div role="dialog" aria-modal="true" className="fixed inset-0 z-[9999] flex flex-col bg-white dark:bg-slate-900 overflow-hidden">

          {/* ── Modal top bar ── */}
          <div className="flex-shrink-0 px-4 md:px-6 pt-3 pb-3 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-700 shadow-sm">
            {/* Row 1: breadcrumb + close */}
            <div className="flex items-center justify-between gap-3 mb-1.5">
              <div className="flex items-center gap-1.5 min-w-0">
                <span className="text-[12px] font-medium text-slate-400 dark:text-slate-500 whitespace-nowrap">
                  {planTypeLabel}
                </span>
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="text-slate-300 dark:text-slate-600 flex-shrink-0">
                  <polyline points="9 18 15 12 9 6" />
                </svg>
                <span className="text-[12px] text-slate-400 dark:text-slate-500 truncate">
                  {activeTable?.label}
                </span>
              </div>
              <div className="flex items-center gap-2 flex-shrink-0">
                <span className="hidden md:block text-[11px] text-slate-400 dark:text-slate-500">
                  กด Esc เพื่อปิด
                </span>
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-1.5 text-[13px] font-semibold text-slate-700 dark:text-slate-200 hover:bg-red-50 hover:border-red-300 hover:text-red-600 dark:hover:bg-red-900/20 dark:hover:border-red-700 dark:hover:text-red-400 active:scale-[.97] transition cursor-pointer shadow-sm"
                >
                  <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2.5">
                    <path d="M18 6L6 18M6 6l12 12" />
                  </svg>
                  ปิด
                </button>
              </div>
            </div>
            {/* Row 2: title + badges */}
            <div className="flex items-center justify-center gap-3 flex-wrap">
              <h2 className="text-[17px] md:text-[19px] font-extrabold text-slate-800 dark:text-slate-100 leading-tight">
                {activeTable?.label}
              </h2>
              <div className="flex items-center gap-2 flex-wrap">
                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full bg-indigo-100 dark:bg-indigo-900/40 text-[12px] font-semibold text-indigo-700 dark:text-indigo-300">
                  ปี {yearBE}
                </span>
                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-[12px] font-medium text-slate-600 dark:text-slate-300">
                  {branchNameDisplay}
                </span>
                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-900/40 text-[12px] font-medium text-emerald-700 dark:text-emerald-300">
                  {planTypeLabel}
                </span>
              </div>
            </div>
          </div>

          {/* ── Table content — fills remaining height ── */}
          <div className="flex-1 min-h-0 overflow-y-auto _scsb-hide">
            <ActiveComponent
              key={`modal-${planType}-${tableKey}-${branchRequired ? branchId : "all"}-${yearBE}`}
              branchId={branchId}
              branchName={branchNameDisplay}
              yearBE={yearBE}
              planId={planId}
            />
          </div>
        </div>,
        document.body
      )}
    </>
  )
}

export default OperationPlan
