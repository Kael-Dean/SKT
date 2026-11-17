// src/components/hr/CustomLeaveQuotaCard.jsx
// ─────────────────────────────────────────────────────────────────────────────
// โควตาของประเภทการลาที่ HR เพิ่มเอง (is_custom) — รายคน รายปีงบ (handoff 2026-11-17 ส่วนที่ 4)
//   GET   /hr/employees/{id}/leave-quota → { year, …คอลัมน์เดิม, custom: [{ leave_type_id, type, name, days, overridden }] }
//   PATCH /hr/employees/{id}/leave-quota { leave_type: <type — ไม่ใช่ชื่อที่แสดง>, days: "5.5", year }
//         สิทธิ์ leave.quota.edit (หน้าเว็บซ่อนปุ่มด้วย can("hr.leave.quota.edit"); server ตัดสินจริง)
//   overridden=false → days คือค่าเริ่มต้นของประเภท · ยังไม่มีเรียก "ลบ override" → ตั้งกลับเป็นค่าเริ่มต้นแทน
//   ไม่มี custom เลย / โหลดไม่ได้ (ไม่มีสิทธิ์ดู) → ไม่แสดงการ์ด
// ─────────────────────────────────────────────────────────────────────────────
import { useCallback, useEffect, useState } from "react"
import { apiAuth } from "../../lib/api"
import { apiDetail } from "../../lib/apiErrors"
import { can } from "../../lib/permissions"
import { cx, baseField, errorTextCls } from "../../lib/styles"
import { Badge, toast } from "../ui"

const inputCls = cx(baseField, "!w-24 !rounded-lg !px-3 !py-1.5 md:!text-sm text-right tabular-nums")

const fmtDays = (v) => {
  const n = Number(v)
  return Number.isFinite(n) ? n.toLocaleString("th-TH", { maximumFractionDigits: 1 }) : String(v ?? "—")
}

export default function CustomLeaveQuotaCard({ employeeId }) {
  const [data, setData] = useState(null)
  const [editing, setEditing] = useState(null) // leave_type_id
  const [val, setVal] = useState("")
  const [err, setErr] = useState("")
  const [busy, setBusy] = useState(false)
  const canEdit = can("hr.leave.quota.edit")

  const load = useCallback(() => {
    let alive = true
    apiAuth(`/hr/employees/${employeeId}/leave-quota`)
      .then((d) => { if (alive) setData(d) })
      .catch(() => { if (alive) setData(null) })
    return () => { alive = false }
  }, [employeeId])
  useEffect(() => load(), [load])

  const rows = Array.isArray(data?.custom) ? data.custom : []
  if (rows.length === 0) return null

  const start = (r) => { setEditing(r.leave_type_id); setVal(String(r.days ?? "")); setErr("") }
  const save = async (r) => {
    const n = Number(val)
    // ครึ่งวันเป็นขั้น (0.5) เหมือน PATCH เดิม
    if (val === "" || !Number.isFinite(n) || n < 0 || Math.round(n * 2) !== n * 2) { setErr("กรอกจำนวนวัน ตั้งแต่ 0 ขึ้นไป (ครึ่งวันได้)"); return }
    setBusy(true); setErr("")
    try {
      await apiAuth(`/hr/employees/${employeeId}/leave-quota`, {
        method: "PATCH",
        body: { leave_type: r.type, days: String(n), year: data.year },
      })
      toast.success(`ตั้งโควตา${r.name}แล้ว`, { description: `ปีงบประมาณ ${data.year}` })
      setEditing(null)
      load()
    } catch (e) {
      setErr(apiDetail(e) || "บันทึกไม่สำเร็จ")
    } finally {
      setBusy(false)
    }
  }

  return (
    <section className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-gray-200/70 dark:bg-surface dark:ring-line md:p-5" aria-labelledby="custom-quota-h">
      <h3 id="custom-quota-h" className="mb-3 border-b border-indigo-100 pb-1 text-xs font-semibold uppercase tracking-wide text-indigo-700 dark:border-indigo-900/40 dark:text-indigo-300">
        โควตาประเภทการลาที่ HR เพิ่ม (ปีงบประมาณ {data?.year})
      </h3>
      <ul className="divide-y divide-gray-100 dark:divide-line">
        {rows.map((r) => (
          <li key={r.leave_type_id} className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-2 py-2.5 text-sm">
            <span className="min-w-0 flex-1 basis-40 break-words font-medium text-gray-900 dark:text-gray-100">{r.name || r.type}</span>
            {editing === r.leave_type_id ? (
              <form className="flex items-center gap-2" onSubmit={(e) => { e.preventDefault(); save(r) }}>
                <input type="number" inputMode="decimal" min="0" step="0.5" value={val} autoFocus disabled={busy}
                  aria-label={`โควตา${r.name} (วัน)`} aria-invalid={err ? true : undefined}
                  onChange={(e) => { setVal(e.target.value); setErr("") }} className={inputCls} />
                <button type="submit" disabled={busy} className="cursor-pointer rounded text-xs text-emerald-600 hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 disabled:opacity-50 dark:text-emerald-400">{busy ? "…" : "บันทึก"}</button>
                <button type="button" onClick={() => setEditing(null)} disabled={busy} className="cursor-pointer rounded text-xs text-gray-400 hover:text-gray-600 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 dark:hover:text-gray-300">ยกเลิก</button>
              </form>
            ) : (
              <>
                <span className="font-semibold tabular-nums text-indigo-700 dark:text-indigo-300">{fmtDays(r.days)} วัน</span>
                {r.overridden && <Badge tone="info">ตั้งเฉพาะคนนี้</Badge>}
                {canEdit && (
                  <button type="button" onClick={() => start(r)}
                    className="min-h-touch cursor-pointer rounded px-2 text-xs text-indigo-600 hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 dark:text-indigo-400 md:min-h-0">
                    แก้โควตา
                  </button>
                )}
              </>
            )}
          </li>
        ))}
      </ul>
      {err && <p role="alert" className={cx("mt-2", errorTextCls)}>{err}</p>}
      <p className="mt-2 text-xs leading-relaxed text-gray-500 dark:text-gray-400">
        ไม่ได้ตั้งเฉพาะคน = ใช้จำนวนวันเริ่มต้นของประเภท · ค่าที่ตั้งใช้เฉพาะปีนี้ ปีหน้าเริ่มที่ค่าเริ่มต้นใหม่
      </p>
    </section>
  )
}
