// src/components/hr/EmployeePicker.jsx
// เลือกเจ้าหน้าที่ (active) — GET /hr/personnel?is_active=true
// ช่องเดียว: SelectDropdown แบบ searchable (ค้นชื่อ รหัส รหัสพนักงาน ตำแหน่ง) แสดงครบทุกคน ไม่ตัดจำนวน
// รายชื่อแคชระดับ module ใน personnelCache.js — เรียก refreshPersonnel() (จากไฟล์นั้น) หลังข้อมูลเปลี่ยน
import { useEffect, useMemo, useState } from "react"
import SelectDropdown from "../SelectDropdown"
import { getCachedPersonnel, loadPersonnel, subscribePersonnel } from "./personnelCache"
import { errText, employeeName, linkBtn } from "./positionUtils"

/** รหัสพนักงาน ถ้า backend ส่งมา (ยังไม่มีใน contract ปัจจุบัน — เผื่อไว้) */
const staffCodeOf = (p) => p?.staff_code ?? p?.employee_code ?? p?.emp_code ?? null

export default function EmployeePicker({
  value,
  onChange,
  positionsById,
  label = "เจ้าหน้าที่",
  id = "emp-picker",
  className = "",
  disabled = false,
}) {
  const [people, setPeople] = useState(() => getCachedPersonnel() ?? [])
  const [loading, setLoading] = useState(() => !getCachedPersonnel())
  const [error, setError] = useState("")
  const [attempt, setAttempt] = useState(0)

  useEffect(() => {
    let alive = true
    const unsubscribe = subscribePersonnel((fresh) => {
      if (alive && fresh) {
        setPeople(fresh)
        setError("")
        setLoading(false)
      }
    })
    loadPersonnel()
      .then((d) => { if (alive) { setPeople(d); setError("") } })
      .catch((e) => { if (alive) setError(errText(e, "โหลดรายชื่อเจ้าหน้าที่ไม่สำเร็จ")) })
      .finally(() => { if (alive) setLoading(false) })
    return () => {
      alive = false
      unsubscribe()
    }
  }, [attempt])

  const retry = () => {
    setError("")
    setLoading(true)
    setAttempt((n) => n + 1)
  }

  const options = useMemo(
    () => people.map((p) => {
      const code = staffCodeOf(p)
      const title = positionsById?.[p.position]?.title
      return {
        value: String(p.id),
        label: employeeName(p),
        sublabel: [`รหัส ${p.id}`, code ? `รหัสพนักงาน ${code}` : null, title ?? "ยังไม่มีตำแหน่ง"]
          .filter(Boolean)
          .join(" · "),
        keywords: [String(p.id), code, title].filter(Boolean),
      }
    }),
    [people, positionsById],
  )

  const labelId = `${id}-label`
  const errId = `${id}-error`

  return (
    <div className={"space-y-1.5 max-w-xl " + className}>
      <span id={labelId} className="block text-xs font-medium text-gray-600 dark:text-gray-400">{label}</span>
      <SelectDropdown
        id={id}
        ariaLabelledby={labelId}
        ariaDescribedby={error ? errId : undefined}
        options={options}
        value={value ?? ""}
        onChange={(v) => onChange?.(v, people.find((p) => String(p.id) === v) ?? null)}
        placeholder={loading ? "กำลังโหลดรายชื่อ…" : "เลือกเจ้าหน้าที่"}
        loading={loading}
        error={!!error}
        disabled={disabled}
        searchable
        searchPlaceholder="ค้นหาชื่อ รหัส หรือตำแหน่ง"
        emptyText="ไม่พบเจ้าหน้าที่ที่ตรงกับคำค้น"
        showSwatch={false}
        showSublabelInTrigger
      />
      {error && (
        <p id={errId} role="alert" className="text-xs text-red-600 dark:text-red-400">
          โหลดรายชื่อเจ้าหน้าที่ไม่สำเร็จ{" "}
          <button type="button" onClick={retry} className={linkBtn + " !text-xs"}>ลองใหม่</button>
        </p>
      )}
    </div>
  )
}
