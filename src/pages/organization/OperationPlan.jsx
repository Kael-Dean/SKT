import { useEffect, useMemo, useState } from "react"
import { apiAuth } from "../../lib/api"
import ProcurementPlanDetail from "./ProcurementPlanDetail"

const cx = (...a) => a.filter(Boolean).join(" ")

const baseField =
  "w-full rounded-2xl border border-slate-300 bg-slate-100 p-3 text-[15px] md:text-base " +
  "text-black outline-none placeholder:text-slate-500 focus:border-emerald-600 focus:ring-2 focus:ring-emerald-500/30 shadow-none " +
  "dark:border-slate-500/40 dark:bg-slate-700/80 dark:text-slate-100 dark:placeholder:text-slate-300 dark:focus:border-emerald-400 dark:focus:ring-emerald-400/30"

const TABLES = [
  {
    key: "procurement-plan-detail",
    label: "รายละเอียดแผนการจัดหาสินค้า",
    description: "ตารางกรอกข้อมูลตามแบบ Excel (เม.ย.–มี.ค. | ปร/รับ/พร) + คำนวณยอดให้",
    Component: ProcurementPlanDetail,
  },
  // เพิ่มตารางอื่นในอนาคตได้ที่นี่:
  // { key: "xxx", label: "ชื่อตาราง", description: "...", Component: YourTableComponent },
]

const OperationPlan = () => {
  useEffect(() => {
    document.title = "แผนปฏิบัติงาน (Operation Plan)"
  }, [])

  const [yearBE, setYearBE] = useState("2568")

  // branches
  const [loadingBranches, setLoadingBranches] = useState(false)
  const [branchOptions, setBranchOptions] = useState([])
  const [branchId, setBranchId] = useState("")

  // selected table
  const [tableKey, setTableKey] = useState(TABLES[0]?.key || "")

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

  const branchName = useMemo(() => {
    return branchOptions.find((b) => String(b.id) === String(branchId))?.label || ""
  }, [branchOptions, branchId])

  const activeTable = useMemo(() => {
    return TABLES.find((t) => t.key === tableKey) || null
  }, [tableKey])

  const ActiveComponent = activeTable?.Component || null

  const canShowTable = !!branchId && !!ActiveComponent

  return (
    <div className="min-h-screen bg-white text-black dark:bg-slate-900 dark:text-white rounded-2xl">
      <div className="mx-auto max-w-[1400px] p-4 md:p-6">
        {/* Header */}
        <div className="mb-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-800">
          <div className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
            <div>
              <h1 className="text-2xl md:text-3xl font-extrabold">🗺️ แผนปฏิบัติงาน</h1>
              <div className="mt-1 text-sm text-slate-600 dark:text-slate-300">
                เลือกสาขา → เลือกตาราง → กรอกข้อมูล (ตารางถูกแยกเป็นไฟล์ย่อยเรียกใช้งานได้)
              </div>
            </div>

            <div className="inline-flex items-center rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-semibold text-slate-700 dark:border-slate-700 dark:bg-slate-900/30 dark:text-slate-200">
              MODE: Form Entry
            </div>
          </div>

          {/* Controls */}
          <div className="mt-4 grid gap-3 md:grid-cols-12">
            <div className="md:col-span-3">
              <label className="mb-1 block text-sm text-slate-700 dark:text-slate-300">
                ปี (พ.ศ.)
              </label>
              <input
                className={baseField}
                value={yearBE}
                onChange={(e) => setYearBE(e.target.value)}
                placeholder="เช่น 2568"
              />
            </div>

            <div className="md:col-span-5">
              <label className="mb-1 block text-sm text-slate-700 dark:text-slate-300">
                เลือกสาขา (ดึงจาก API เดิม)
              </label>
              <select
                className={baseField}
                value={branchId}
                onChange={(e) => setBranchId(e.target.value)}
                disabled={loadingBranches}
              >
                <option value="">
                  {loadingBranches ? "กำลังโหลดสาขา..." : "— เลือกสาขา —"}
                </option>
                {branchOptions.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.label}
                  </option>
                ))}
              </select>

              {!branchId && (
                <div className="mt-2 text-sm text-red-600 dark:text-red-400">
                  * กรุณาเลือกสาขาก่อน
                </div>
              )}
            </div>

            <div className="md:col-span-4">
              <label className="mb-1 block text-sm text-slate-700 dark:text-slate-300">
                เลือกตารางที่จะกรอก
              </label>
              <select
                className={baseField}
                value={tableKey}
                onChange={(e) => setTableKey(e.target.value)}
              >
                {TABLES.map((t) => (
                  <option key={t.key} value={t.key}>
                    {t.label}
                  </option>
                ))}
              </select>

              <div className="mt-2 text-sm text-slate-600 dark:text-slate-300">
                {activeTable?.description || ""}
              </div>
            </div>
          </div>

          {/* Quick summary line */}
          <div className="mt-4 flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
            <div className="text-sm text-slate-700 dark:text-slate-200">
              <span className="font-semibold">สาขา:</span>{" "}
              {branchName ? branchName : "—"}
              <span className="mx-2 text-slate-400">|</span>
              <span className="font-semibold">ตาราง:</span>{" "}
              {activeTable?.label || "—"}
            </div>

            <button
              type="button"
              onClick={() => {
                setBranchId("")
                // ไม่ reset tableKey เพราะปกติคนจะใช้ตารางเดิม
              }}
              className="inline-flex items-center justify-center rounded-2xl border border-slate-300 bg-white px-5 py-2.5 text-sm font-semibold text-slate-800
                         hover:bg-slate-100 hover:scale-[1.02] active:scale-[.98] transition cursor-pointer
                         dark:border-slate-600 dark:bg-slate-700/60 dark:text-white dark:hover:bg-slate-700/40"
            >
              เปลี่ยนสาขา
            </button>
          </div>
        </div>

        {/* Content */}
        {!canShowTable ? (
          <div className="rounded-2xl border border-slate-200 bg-white p-6 text-center shadow-sm dark:border-slate-700 dark:bg-slate-800">
            <div className="text-lg font-bold">ยังไม่พร้อมกรอกตาราง</div>
            <div className="mt-2 text-slate-600 dark:text-slate-300">
              กรุณาเลือก <span className="font-semibold">สาขา</span> ก่อน แล้วระบบจะแสดงตารางที่เลือกไว้ให้กรอก
            </div>
          </div>
        ) : (
          <div className="mt-2">
            {/* ✅ เรียกใช้งาน “ไฟล์แยก” ตรงนี้ */}
            <ActiveComponent
              key={`${tableKey}-${branchId}-${yearBE}`} // remount เมื่อเปลี่ยนสาขาหรือปี เพื่อไม่ให้ค่าค้าง
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
