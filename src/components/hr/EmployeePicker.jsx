// src/components/hr/EmployeePicker.jsx
// เลือกเจ้าหน้าที่ (active) — GET /hr/personnel?is_active=true
// ช่องค้นหากรองรายชื่อ แล้วเลือกผ่าน SelectDropdown ตัวเดิมของโปรเจค (ไม่สร้าง dropdown ใหม่)
import { useEffect, useMemo, useState } from "react"
import { apiAuth } from "../../lib/api"
import SelectDropdown from "../SelectDropdown"
import { inputCls, errText, employeeName } from "./positionUtils"

const MAX_OPTIONS = 150

// แคชรายชื่อไว้ระดับ module — หลายแผงในหน้าเดียวกันไม่ต้องยิงซ้ำ
let cache = null
let inflight = null
function loadPersonnel() {
  if (cache) return Promise.resolve(cache)
  if (!inflight) {
    inflight = apiAuth("/hr/personnel?is_active=true")
      .then((d) => { cache = Array.isArray(d) ? d : []; return cache })
      .finally(() => { inflight = null })
  }
  return inflight
}

export default function EmployeePicker({ value, onChange, positionsById, label = "เจ้าหน้าที่", id = "emp-picker" }) {
  const [people, setPeople] = useState(cache ?? [])
  const [loading, setLoading] = useState(!cache)
  const [error, setError] = useState("")
  const [q, setQ] = useState("")

  useEffect(() => {
    let alive = true
    loadPersonnel()
      .then((d) => { if (alive) setPeople(d) })
      .catch((e) => { if (alive) setError(errText(e, "โหลดรายชื่อเจ้าหน้าที่ไม่สำเร็จ")) })
      .finally(() => { if (alive) setLoading(false) })
    return () => { alive = false }
  }, [])

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase()
    const list = s
      ? people.filter((p) => employeeName(p).toLowerCase().includes(s) || String(p.id) === s)
      : people
    return list.slice(0, MAX_OPTIONS)
  }, [people, q])

  const options = useMemo(() => {
    const opts = filtered.map((p) => ({
      value: String(p.id),
      label: employeeName(p),
      sublabel: [`รหัส ${p.id}`, positionsById?.[p.position]?.title].filter(Boolean).join(" · "),
    }))
    // คงคนที่เลือกไว้ในรายการเสมอ แม้ไม่ตรงคำค้น
    if (value && !opts.some((o) => o.value === String(value))) {
      const sel = people.find((p) => String(p.id) === String(value))
      if (sel) opts.unshift({ value: String(sel.id), label: employeeName(sel), sublabel: `รหัส ${sel.id}` })
    }
    return opts
  }, [filtered, people, value, positionsById])

  const total = q.trim()
    ? people.filter((p) => employeeName(p).toLowerCase().includes(q.trim().toLowerCase()) || String(p.id) === q.trim()).length
    : people.length

  return (
    <div className="space-y-1.5">
      <span id={`${id}-label`} className="text-xs font-medium text-gray-600 dark:text-gray-400 block">{label}</span>
      <div className="grid gap-2 sm:grid-cols-[12rem_minmax(0,1fr)]">
        <input
          type="search"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="ค้นชื่อหรือรหัส"
          aria-label={`ค้นหา${label}`}
          className={inputCls}
        />
        <div aria-labelledby={`${id}-label`}>
          <SelectDropdown
            options={options}
            value={value ?? ""}
            onChange={(v) => onChange?.(v, people.find((p) => String(p.id) === v) ?? null)}
            placeholder={loading ? "กำลังโหลดรายชื่อ…" : "— เลือกเจ้าหน้าที่ —"}
            loading={loading}
            error={!!error}
          />
        </div>
      </div>
      {error ? (
        <p role="alert" className="text-xs text-red-600 dark:text-red-400">{error}</p>
      ) : total > MAX_OPTIONS ? (
        <p className="text-xs text-gray-500 dark:text-gray-400">แสดง {MAX_OPTIONS} จาก {total} คน — พิมพ์ชื่อเพื่อค้นให้แคบลง</p>
      ) : null}
    </div>
  )
}
