import { useCallback, useEffect, useMemo, useState } from "react"

/** ---------------- Utils ---------------- */
const cx = (...a) => a.filter(Boolean).join(" ")
const toNumber = (v) => {
  if (v === "" || v === null || v === undefined) return 0
  const n = Number(String(v).replace(/,/g, ""))
  return Number.isFinite(n) ? n : 0
}
const sanitizeNumberInput = (s, { maxDecimals = 3 } = {}) => {
  const cleaned = String(s ?? "").replace(/[^\d.]/g, "")
  if (!cleaned) return ""
  const parts = cleaned.split(".")
  if (parts.length === 1) return parts[0]
  return `${parts[0]}.${parts.slice(1).join("").slice(0, maxDecimals)}`
}
const fmtMoney = (n) =>
  new Intl.NumberFormat("th-TH", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(toNumber(n))
const fmtInt = (n) => new Intl.NumberFormat("th-TH", { maximumFractionDigits: 0 }).format(toNumber(n))

/** ---------------- API Helper ---------------- */
async function apiAuth(path, { method = "GET", body, headers } = {}) {
  const token = localStorage.getItem("token")
  const res = await fetch(path, {
    method,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(headers || {}),
    },
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  })

  if (!res.ok) {
    let detail = ""
    try {
      const j = await res.json()
      detail = j?.detail ? (typeof j.detail === "string" ? j.detail : JSON.stringify(j.detail)) : JSON.stringify(j)
    } catch {
      try {
        detail = await res.text()
      } catch {
        detail = ""
      }
    }
    const err = new Error(detail || `HTTP ${res.status}`)
    err.status = res.status
    throw err
  }

  const ct = res.headers.get("content-type") || ""
  if (ct.includes("application/json")) return await res.json()
  return await res.text()
}

/** ---------------- Constants ---------------- */
const MONTHS = [
  { k: 1, label: "ม.ค." },
  { k: 2, label: "ก.พ." },
  { k: 3, label: "มี.ค." },
  { k: 4, label: "เม.ย." },
  { k: 5, label: "พ.ค." },
  { k: 6, label: "มิ.ย." },
  { k: 7, label: "ก.ค." },
  { k: 8, label: "ส.ค." },
  { k: 9, label: "ก.ย." },
  { k: 10, label: "ต.ค." },
  { k: 11, label: "พ.ย." },
  { k: 12, label: "ธ.ค." },
]

/** ---------------- Mapping: (earning_id + business_group) -> businessearnings.id ----------------
 * จากไฟล์ businessearnings (businessesearnings)
 */
const BUSINESS_EARNINGS_SEED = [
  { id: 1, earning_id: 1, business_group: 1 },
  { id: 2, earning_id: 2, business_group: 1 },
  { id: 3, earning_id: 3, business_group: 1 },
  { id: 4, earning_id: 4, business_group: 1 },
  { id: 5, earning_id: 5, business_group: 1 },
  { id: 6, earning_id: 6, business_group: 1 },
  { id: 7, earning_id: 6, business_group: 2 },
  { id: 8, earning_id: 8, business_group: 2 },
  { id: 9, earning_id: 2, business_group: 2 },
  { id: 10, earning_id: 7, business_group: 2 },
  { id: 11, earning_id: 6, business_group: 3 },
  { id: 12, earning_id: 15, business_group: 3 },
  { id: 13, earning_id: 14, business_group: 3 },
  { id: 14, earning_id: 13, business_group: 3 },
  { id: 15, earning_id: 12, business_group: 3 },
  { id: 16, earning_id: 11, business_group: 3 },
  { id: 17, earning_id: 10, business_group: 3 },
  { id: 18, earning_id: 9, business_group: 3 },
  { id: 19, earning_id: 6, business_group: 4 },
  { id: 20, earning_id: 18, business_group: 4 },
  { id: 21, earning_id: 17, business_group: 4 },
  { id: 22, earning_id: 16, business_group: 4 },
  { id: 23, earning_id: 14, business_group: 4 },
  { id: 24, earning_id: 12, business_group: 4 },
  { id: 25, earning_id: 11, business_group: 4 },
  { id: 26, earning_id: 10, business_group: 4 },
  { id: 27, earning_id: 9, business_group: 4 },
  { id: 28, earning_id: 22, business_group: 4 },
  { id: 29, earning_id: 4, business_group: 4 },
  { id: 30, earning_id: 6, business_group: 5 },
  { id: 31, earning_id: 4, business_group: 5 },
  { id: 32, earning_id: 21, business_group: 5 },
  { id: 33, earning_id: 20, business_group: 5 },
  { id: 34, earning_id: 10, business_group: 5 },
  { id: 35, earning_id: 9, business_group: 5 },
  { id: 36, earning_id: 19, business_group: 5 },
  { id: 45, earning_id: 22, business_group: 8 },
  { id: 46, earning_id: 23, business_group: 8 },
  { id: 47, earning_id: 6, business_group: 8 },
]

const BUSINESS_EARNING_ID_MAP = (() => {
  const m = new Map()
  for (const r of BUSINESS_EARNINGS_SEED) {
    const key = `${Number(r.earning_id)}:${Number(r.business_group)}`
    if (!m.has(key)) m.set(key, Number(r.id))
  }
  return m
})()

const resolveBusinessEarningId = (earningId, businessGroupId) =>
  BUSINESS_EARNING_ID_MAP.get(`${Number(earningId)}:${Number(businessGroupId)}`) ?? null

const resolveRowBusinessEarningId = (row) => {
  if (row?.business_earning_id) return Number(row.business_earning_id)
  if (!row?.earning_id || !row?.business_group) return null
  return resolveBusinessEarningId(row.earning_id, row.business_group)
}

/** ---------------- Rows (รายการรายได้) ---------------- */
const ROWS = [
  { code: "REV", label: "ประมาณการ รายได้เฉพาะธุรกิจ", kind: "title" },

  { code: "1", label: "รายได้เฉพาะ ธุรกิจจัดหา", kind: "section" },
  { code: "1.1", label: "ค่าตอบแทนจัดหาวัสดุ", kind: "item", business_group: 1, earning_id: 1 },
  { code: "1.2", label: "รายได้จากส่งเสริมการขาย", kind: "item", business_group: 1, earning_id: 2 },
  { code: "1.3", label: "ดอกเบี้ยรับ-ลูกหนี้การค้า", kind: "item", business_group: 1, earning_id: 3 },
  { code: "1.4", label: "ค่าธรรมเนียมอื่น ๆ", kind: "item", business_group: 1, earning_id: 4 },
  { code: "1.5", label: "กำไรจากการขายสินค้า", kind: "item", business_group: 1, earning_id: 5 },
  { code: "1.6", label: "รายได้เบ็ดเตล็ด", kind: "item", business_group: 1, earning_id: 6 },
  { code: "1.T", label: "รวมรายได้ธุรกิจจัดหา", kind: "subtotal", group: 1 },

  { code: "2", label: "รายได้เฉพาะ ธุรกิจจัดหา-ปั๊มน้ำมัน", kind: "section" },
  { code: "2.1", label: "รายได้เบ็ดเตล็ด", kind: "item", business_group: 2, earning_id: 6 },
  { code: "2.2", label: "รายได้ค่าบริการ", kind: "item", business_group: 2, earning_id: 8 },
  { code: "2.3", label: "รายได้จากส่งเสริมการขาย", kind: "item", business_group: 2, earning_id: 2 },
  { code: "2.4", label: "กำไรจากการขายน้ำมัน", kind: "item", business_group: 2, earning_id: 7 },
  { code: "2.T", label: "รวมรายได้ธุรกิจจัดหา-ปั๊มน้ำมัน", kind: "subtotal", group: 2 },

  { code: "3", label: "รายได้เฉพาะ ธุรกิจรวบรวม", kind: "section" },
  { code: "3.1", label: "รายได้เบ็ดเตล็ด", kind: "item", business_group: 3, earning_id: 6 },
  { code: "3.2", label: "รายได้ค่าฝากเก็บ/ค่ารักษาสภาพสินค้า", kind: "item", business_group: 3, earning_id: 15 },
  { code: "3.3", label: "รายได้ค่าตรวจคุณภาพ/ตรวจชื้น", kind: "item", business_group: 3, earning_id: 14 },
  { code: "3.4", label: "รายได้ค่าชั่ง/ค่าบริการชั่ง", kind: "item", business_group: 3, earning_id: 13 },
  { code: "3.5", label: "รายได้ค่ากระสอบ/วัสดุประกอบ", kind: "item", business_group: 3, earning_id: 12 },
  { code: "3.6", label: "รายได้ค่าธรรมเนียมอื่น ๆ", kind: "item", business_group: 3, earning_id: 11 },
  { code: "3.7", label: "รายได้ค่าบริการอื่น ๆ", kind: "item", business_group: 3, earning_id: 10 },
  { code: "3.8", label: "รายได้ค่าจัดการ", kind: "item", business_group: 3, earning_id: 9 },
  { code: "3.T", label: "รวมรายได้ธุรกิจรวบรวม", kind: "subtotal", group: 3 },

  { code: "4", label: "รายได้เฉพาะ ธุรกิจแปรรูป", kind: "section" },
  { code: "4.1", label: "รายได้เบ็ดเตล็ด", kind: "item", business_group: 4, earning_id: 6 },
  { code: "4.2", label: "รายได้ค่าบริการสีแปรสภาพ/แปรรูป", kind: "item", business_group: 4, earning_id: 18 },
  { code: "4.3", label: "รายได้ค่าบริการบรรจุ/แพ็ค", kind: "item", business_group: 4, earning_id: 17 },
  { code: "4.4", label: "รายได้ค่าบริการอบ/ลดความชื้น", kind: "item", business_group: 4, earning_id: 16 },
  { code: "4.5", label: "รายได้ค่าตรวจคุณภาพ/ตรวจชื้น", kind: "item", business_group: 4, earning_id: 14 },
  { code: "4.6", label: "รายได้ค่ากระสอบ/วัสดุประกอบ", kind: "item", business_group: 4, earning_id: 12 },
  { code: "4.7", label: "รายได้ค่าธรรมเนียมอื่น ๆ", kind: "item", business_group: 4, earning_id: 11 },
  { code: "4.8", label: "รายได้ค่าบริการอื่น ๆ", kind: "item", business_group: 4, earning_id: 10 },
  { code: "4.9", label: "รายได้ค่าจัดการ", kind: "item", business_group: 4, earning_id: 9 },
  { code: "4.10", label: "ดอกเบี้ยเงินฝาก", kind: "item", business_group: 4, earning_id: 22 },
  { code: "4.11", label: "รายได้จากส่งเสริมการขาย", kind: "item", business_group: 4, earning_id: 4 },
  { code: "4.T", label: "รวมรายได้ธุรกิจแปรรูป", kind: "subtotal", group: 4 },

  { code: "5", label: "รายได้เฉพาะ ธุรกิจเมล็ดพันธุ์", kind: "section" },
  { code: "5.1", label: "รายได้เบ็ดเตล็ด", kind: "item", business_group: 5, earning_id: 6 },
  { code: "5.2", label: "รายได้จากส่งเสริมการขาย", kind: "item", business_group: 5, earning_id: 4 },
  { code: "5.3", label: "รายได้ค่าบริการตรวจรับรอง/มาตรฐาน", kind: "item", business_group: 5, earning_id: 21 },
  { code: "5.4", label: "รายได้ค่าจัดการโครงการ", kind: "item", business_group: 5, earning_id: 20 },
  { code: "5.5", label: "รายได้ค่าบริการอื่น ๆ", kind: "item", business_group: 5, earning_id: 10 },
  { code: "5.6", label: "รายได้ค่าจัดการ", kind: "item", business_group: 5, earning_id: 9 },
  { code: "5.7", label: "รายได้จากรับรอง/สาธิต", kind: "item", business_group: 5, earning_id: 19 },
  { code: "5.T", label: "รวมรายได้ธุรกิจเมล็ดพันธุ์", kind: "subtotal", group: 5 },

  { code: "6", label: "รายได้เฉพาะ ธุรกิจบริการ", kind: "section" },
  { code: "6.1", label: "ดอกเบี้ยเงินฝาก", kind: "item", business_group: 8, earning_id: 22 },
  { code: "6.2", label: "รายได้ค่าจัดการ", kind: "item", business_group: 8, earning_id: 23 },
  { code: "6.3", label: "รายได้เบ็ดเตล็ด", kind: "item", business_group: 8, earning_id: 6 },
  { code: "6.T", label: "รวมรายได้ธุรกิจบริการ", kind: "subtotal", group: 8 },

  { code: "GT", label: "รวมรายได้เฉพาะธุรกิจทั้งหมด", kind: "grand" },
]

/** ---------------- Component (ตามฟอร์มที่ขอ: const ... = (props) => { ... } + export default ต่อท้าย) ---------------- */
const BusinessPlanOtherIncomeTable = (props) => {
  const { planId, branchId, yearBE } = props

  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState("")
  const [rowsData, setRowsData] = useState(() => {
    // state shape: { [rowCode]: { [month]: number } }
    const s = {}
    for (const r of ROWS) {
      if (r.kind === "item") {
        s[r.code] = {}
        for (const m of MONTHS) s[r.code][m.k] = 0
      }
    }
    return s
  })
  const [lastSavedAt, setLastSavedAt] = useState(null)

  const yearLabel = useMemo(() => {
    if (!yearBE) return ""
    return String(yearBE)
  }, [yearBE])

  const unmappedList = useMemo(() => {
    const misses = []
    for (const r of ROWS) {
      if (r.kind !== "item") continue
      const beId = resolveBusinessEarningId(r.earning_id, r.business_group)
      if (!beId) misses.push(`${r.code} (earning_id=${r.earning_id}, group=${r.business_group})`)
    }
    return misses
  }, [])

  const totalsByRow = useMemo(() => {
    const totals = {}
    for (const r of ROWS) {
      if (r.kind === "item") {
        totals[r.code] = MONTHS.reduce((acc, m) => acc + toNumber(rowsData?.[r.code]?.[m.k]), 0)
      }
    }
    return totals
  }, [rowsData])

  const subtotalByGroup = useMemo(() => {
    const map = {}
    for (const r of ROWS) {
      if (r.kind !== "item") continue
      const g = r.business_group
      if (!map[g]) map[g] = 0
      map[g] += toNumber(totalsByRow[r.code])
    }
    return map
  }, [totalsByRow])

  const grandTotal = useMemo(() => Object.values(subtotalByGroup).reduce((a, b) => a + toNumber(b), 0), [subtotalByGroup])

  const onChange = useCallback((rowCode, month, v) => {
    const cleaned = sanitizeNumberInput(v, { maxDecimals: 2 })
    setRowsData((prev) => ({
      ...prev,
      [rowCode]: { ...(prev[rowCode] || {}), [month]: cleaned === "" ? 0 : toNumber(cleaned) },
    }))
  }, [])

  const fetchLatest = useCallback(async () => {
    if (!planId || !branchId) return
    setLoading(true)
    setError("")
    try {
      // NOTE: เปลี่ยน path ให้ตรงกับ BE ของคุณได้เลย
      const data = await apiAuth(`/revenue/business-inputs/latest?plan_id=${planId}&branch_id=${branchId}`)
      // expected: array rows with fields { business_earning_id, month, value, earning_id?, business_group? }

      const next = {}
      for (const r of ROWS) {
        if (r.kind === "item") {
          next[r.code] = {}
          for (const m of MONTHS) next[r.code][m.k] = 0
        }
      }

      const items = Array.isArray(data) ? data : data?.items || []
      for (const it of items) {
        const month = Number(it?.month)
        if (!month || month < 1 || month > 12) continue

        const beId = it?.business_earning_id ? Number(it.business_earning_id) : resolveRowBusinessEarningId(it)
        if (!beId) continue

        const row = ROWS.find((r) => r.kind === "item" && resolveBusinessEarningId(r.earning_id, r.business_group) === beId)
        if (!row) continue

        next[row.code][month] = toNumber(it?.value)
      }

      setRowsData(next)
      setLastSavedAt(new Date().toISOString())
    } catch (e) {
      setError(e?.message || "โหลดข้อมูลไม่สำเร็จ")
    } finally {
      setLoading(false)
    }
  }, [planId, branchId])

  useEffect(() => {
    fetchLatest()
  }, [fetchLatest])

  const buildPayload = useCallback(() => {
    const payload = []
    for (const r of ROWS) {
      if (r.kind !== "item") continue
      const business_earning_id = resolveBusinessEarningId(r.earning_id, r.business_group)
      if (!business_earning_id) continue

      for (const m of MONTHS) {
        payload.push({
          plan_id: Number(planId),
          branch_id: Number(branchId),
          business_earning_id: Number(business_earning_id),
          month: Number(m.k),
          value: toNumber(rowsData?.[r.code]?.[m.k]),
        })
      }
    }
    return payload
  }, [planId, branchId, rowsData])

  const saveAll = useCallback(async () => {
    if (!planId || !branchId) return
    setSaving(true)
    setError("")
    try {
      const payload = buildPayload()
      await apiAuth(`/revenue/business-inputs/bulk`, { method: "PUT", body: payload })
      setLastSavedAt(new Date().toISOString())
      await fetchLatest()
    } catch (e) {
      setError(e?.message || "บันทึกไม่สำเร็จ")
    } finally {
      setSaving(false)
    }
  }, [planId, branchId, buildPayload, fetchLatest])

  return (
    <div className="w-full">
      <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="space-y-1">
            <div className="text-lg font-semibold text-slate-900">ประมาณการรายได้ (แยกตามธุรกิจ)</div>
            <div className="text-sm text-slate-500">
              plan_id: <span className="font-medium text-slate-700">{planId || "-"}</span> · branch_id:{" "}
              <span className="font-medium text-slate-700">{branchId || "-"}</span>
              {yearLabel ? (
                <>
                  {" "}
                  · ปี: <span className="font-medium text-slate-700">{yearLabel}</span>
                </>
              ) : null}
              {lastSavedAt ? (
                <>
                  {" "}
                  · อัปเดตล่าสุด:{" "}
                  <span className="font-medium text-slate-700">{new Date(lastSavedAt).toLocaleString("th-TH")}</span>
                </>
              ) : null}
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={fetchLatest}
              disabled={loading || saving}
              className={cx(
                "rounded-2xl border px-4 py-2 text-sm font-medium transition",
                loading || saving
                  ? "cursor-not-allowed border-slate-200 bg-slate-100 text-slate-400"
                  : "border-slate-300 bg-white text-slate-700 hover:bg-slate-50"
              )}
            >
              โหลดข้อมูลล่าสุด
            </button>

            <button
              type="button"
              onClick={saveAll}
              disabled={loading || saving}
              className={cx(
                "rounded-2xl px-4 py-2 text-sm font-semibold text-white shadow-sm transition",
                loading || saving ? "cursor-not-allowed bg-slate-300" : "bg-slate-900 hover:bg-slate-800"
              )}
            >
              {saving ? "กำลังบันทึก..." : "บันทึก"}
            </button>
          </div>
        </div>

        {unmappedList.length > 0 ? (
          <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
            <div className="font-semibold">⚠️ รายการที่ยังไม่แมพ (จะข้ามตอนบันทึกถ้าเป็น 0)</div>
            <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1">
              {unmappedList.map((t) => (
                <span key={t} className="font-medium">
                  {t}
                </span>
              ))}
            </div>
          </div>
        ) : null}

        {error ? <div className="mt-4 rounded-2xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700">{error}</div> : null}

        <div className="mt-4 overflow-auto rounded-2xl border border-slate-200">
          <table className="min-w-[1100px] w-full border-collapse">
            <thead className="sticky top-0 z-10 bg-slate-50">
              <tr className="border-b border-slate-200">
                <th className="w-[320px] px-3 py-3 text-left text-sm font-semibold text-slate-700">รายการ</th>
                {MONTHS.map((m) => (
                  <th key={m.k} className="min-w-[110px] px-3 py-3 text-right text-sm font-semibold text-slate-700">
                    {m.label}
                  </th>
                ))}
                <th className="min-w-[140px] px-3 py-3 text-right text-sm font-semibold text-slate-900">รวม (บาท)</th>
              </tr>
            </thead>

            <tbody>
              {ROWS.map((r) => {
                if (r.kind === "title") {
                  return (
                    <tr key={r.code} className="bg-white">
                      <td colSpan={MONTHS.length + 2} className="px-3 py-4 text-sm font-semibold text-slate-900">
                        {r.label}
                      </td>
                    </tr>
                  )
                }

                if (r.kind === "section") {
                  return (
                    <tr key={r.code} className="bg-slate-50">
                      <td colSpan={MONTHS.length + 2} className="px-3 py-3 text-sm font-semibold text-slate-800">
                        {r.label}
                      </td>
                    </tr>
                  )
                }

                if (r.kind === "subtotal") {
                  const g = r.group
                  const val = subtotalByGroup[g] || 0
                  return (
                    <tr key={r.code} className="bg-white border-t border-slate-100">
                      <td className="px-3 py-3 text-sm font-semibold text-slate-900">{r.label}</td>
                      {MONTHS.map((m) => (
                        <td key={m.k} className="px-3 py-3 text-right text-sm text-slate-400">
                          —
                        </td>
                      ))}
                      <td className="px-3 py-3 text-right text-sm font-semibold text-slate-900">{fmtMoney(val)}</td>
                    </tr>
                  )
                }

                if (r.kind === "grand") {
                  return (
                    <tr key={r.code} className="bg-slate-900">
                      <td className="px-3 py-3 text-sm font-semibold text-white">{r.label}</td>
                      {MONTHS.map((m) => (
                        <td key={m.k} className="px-3 py-3 text-right text-sm text-slate-400">
                          —
                        </td>
                      ))}
                      <td className="px-3 py-3 text-right text-sm font-semibold text-white">{fmtMoney(grandTotal)}</td>
                    </tr>
                  )
                }

                // item
                const rowSum = totalsByRow[r.code] || 0
                const beId = resolveBusinessEarningId(r.earning_id, r.business_group)
                const missing = !beId

                return (
                  <tr key={r.code} className={cx("bg-white border-t border-slate-100", missing && "bg-amber-50/40")}>
                    <td className="px-3 py-2 text-sm text-slate-700">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-slate-900">{r.code}</span>
                        <span>{r.label}</span>
                        {missing ? (
                          <span className="ml-auto rounded-full bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-900">
                            ยังไม่แมพ
                          </span>
                        ) : null}
                      </div>
                    </td>

                    {MONTHS.map((m) => (
                      <td key={m.k} className="px-3 py-2 text-right">
                        <input
                          value={rowsData?.[r.code]?.[m.k] ?? 0}
                          onChange={(e) => onChange(r.code, m.k, e.target.value)}
                          inputMode="decimal"
                          className={cx(
                            "w-full rounded-2xl border px-3 py-2 text-right text-sm outline-none transition",
                            missing
                              ? "border-amber-200 bg-amber-50 text-slate-700 placeholder:text-slate-400"
                              : "border-slate-200 bg-white text-slate-700 placeholder:text-slate-400 focus:border-slate-400"
                          )}
                          placeholder="0"
                          disabled={loading || saving}
                        />
                      </td>
                    ))}

                    <td className="px-3 py-2 text-right text-sm font-semibold text-slate-900">{fmtMoney(rowSum)}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>

        <div className="mt-3 text-xs text-slate-500">
          * ถ้าเห็น “ยังไม่แมพ” แปลว่า FE หา business_earning_id ไม่เจอ (ต้องมีคู่ค่า earning_id + business_group อยู่ในตาราง businessearnings)
        </div>

        {/* debug */}
        <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 p-3">
          <div className="mb-2 text-xs font-semibold text-slate-600">debug buildPayload()</div>
          <pre className="max-h-[520px] overflow-auto text-[11px] leading-5 text-slate-700">
            {(() => {
              try {
                return JSON.stringify(buildPayload(), null, 2)
              } catch (e) {
                return String(e?.message || e)
              }
            })()}
          </pre>
        </div>
      </div>
    </div>
  )
}

export default BusinessPlanOtherIncomeTable
