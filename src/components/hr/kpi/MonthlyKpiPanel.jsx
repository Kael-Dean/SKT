// src/components/hr/kpi/MonthlyKpiPanel.jsx
// Sub-tab "บันทึก KPI รายเดือน" (roles 1·3) — POST /hr/kpi/monthly (shape unchanged).
// v1.4.0: returns 409 "ปิดรับข้อมูลแล้ว — ช่วงเวลาประเมินสิ้นสุด …" after window_end (shown verbatim).
import { useId, useState } from "react"
import SelectDropdown from "../../SelectDropdown"
import StatusMsg from "../StatusMsg"
import { Notice } from "../HrModal"
import { apiAuth } from "../../../lib/api"
import { cx } from "../../../lib/styles"
import { cardCls, errText, inputCls, labelCls, primaryBtn } from "../positionUtils"
import { fmtDay } from "./kpiUtils"

const MONTHS = ["ม.ค.", "ก.พ.", "มี.ค.", "เม.ย.", "พ.ค.", "มิ.ย.", "ก.ค.", "ส.ค.", "ก.ย.", "ต.ค.", "พ.ย.", "ธ.ค."]
const MONTH_OPTIONS = MONTHS.map((m, i) => ({ value: String(i + 1), label: m }))
const SECTION_OPTIONS = [1, 2, 3].map((n) => ({ value: String(n), label: `หมวด ${n}` }))

export default function MonthlyKpiPanel({ fy, info, phase }) {
  const ids = { month: useId(), section: useId() }
  const [form, setForm] = useState({ employee_id: "", month: String(new Date().getMonth() + 1), section: "1", metric: "", value: "" })
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState(null)
  const closed = phase === "after"
  const set = (k) => (v) => setForm((f) => ({ ...f, [k]: v }))

  const submit = async (e) => {
    e.preventDefault()
    if (!form.employee_id || !form.metric || form.value === "") {
      setMsg({ tone: "warning", text: "กรุณากรอกรหัสเจ้าหน้าที่ ตัวชี้วัด และค่า" })
      return
    }
    setBusy(true)
    setMsg(null)
    try {
      await apiAuth("/hr/kpi/monthly", {
        method: "POST",
        body: {
          user_id: Number(form.employee_id),
          fiscal_year: Number(fy),
          month: Number(form.month),
          section: Number(form.section),
          metric_name: form.metric,
          value: parseFloat(form.value),
        },
      })
      setMsg({ tone: "success", text: "บันทึก KPI สำเร็จ" })
      setForm((f) => ({ ...f, metric: "", value: "" }))
    } catch (err) {
      setMsg({ tone: "error", text: errText(err, "ไม่สำเร็จ") })
    } finally {
      setBusy(false)
    }
  }

  return (
    <form onSubmit={submit} className={cx(cardCls, "p-5 sm:p-6 space-y-4 max-w-lg")} noValidate>
      <h3 className="font-semibold text-gray-900 dark:text-gray-100">บันทึก KPI รายเดือน ปีบัญชี {fy}</h3>
      {closed && <Notice tone="warning">ปิดรับข้อมูลแล้ว ช่วงประเมินสิ้นสุด {fmtDay(info?.window_end)}</Notice>}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor="kpi-m-emp" className={labelCls}>รหัสเจ้าหน้าที่</label>
          <input id="kpi-m-emp" type="text" inputMode="numeric" value={form.employee_id} onChange={(e) => set("employee_id")(e.target.value)} className={inputCls} placeholder="รหัสเจ้าหน้าที่" />
        </div>
        <div>
          <span id={ids.month} className={labelCls}>เดือน</span>
          <SelectDropdown ariaLabelledby={ids.month} options={MONTH_OPTIONS} value={form.month} onChange={set("month")} showSwatch={false} />
        </div>
        <div>
          <span id={ids.section} className={labelCls}>หมวด</span>
          <SelectDropdown ariaLabelledby={ids.section} options={SECTION_OPTIONS} value={form.section} onChange={set("section")} showSwatch={false} />
        </div>
        <div>
          <label htmlFor="kpi-m-value" className={labelCls}>ค่า</label>
          <input id="kpi-m-value" type="number" step="0.01" value={form.value} onChange={(e) => set("value")(e.target.value)} className={cx(inputCls, "tabular-nums")} placeholder="0.00" />
        </div>
        <div className="sm:col-span-2">
          <label htmlFor="kpi-m-metric" className={labelCls}>ตัวชี้วัด</label>
          <input id="kpi-m-metric" type="text" value={form.metric} onChange={(e) => set("metric")(e.target.value)} className={inputCls} placeholder="ชื่อตัวชี้วัด" />
        </div>
      </div>
      {msg && <StatusMsg msg={msg} />}
      <button type="submit" disabled={busy} className={cx(primaryBtn, "w-full")}>
        {busy ? "กำลังบันทึก…" : "บันทึก KPI"}
      </button>
    </form>
  )
}
