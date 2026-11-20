// src/components/hr/discipline/ClausePicker.jsx
// ─────────────────────────────────────────────────────────────────────────────
// เลือกข้อระเบียบที่ฝ่าฝืน (หลายข้อ) — ใช้ในหนังสือตักเตือน (punish / PATCH action) และบันทึกวินัย
//   GET /hr/discipline/clauses  (ทุกคนที่ล็อกอิน · active เท่านั้น · server เรียงปีใหม่สุด → sort_order → code)
//   pre-tick ด้วย case.default_clauses (ส่งมาเป็น value เริ่มต้นจากหน้าเรียก)
//
//   <ClausePicker id value={[ids]} onChange={(ids) => …} extra={[Clause]} error />
//   extra = ข้อที่ติดมากับเอกสารเดิมแต่ถูกปิดใช้แล้ว — ยังแสดงให้เห็น/เอาออกได้
// ─────────────────────────────────────────────────────────────────────────────
import { useMemo, useState } from "react"
import { Check, Search } from "lucide-react"
import { asArray, clauseCode } from "../../../lib/discipline"
import { cx, baseField, errorTextCls } from "../../../lib/styles"
import { Skeleton } from "../../ui"
import { useClauses } from "./disciplineData"

export default function ClausePicker({ id, value = [], onChange, extra = [], error = "", describedBy, disabled = false }) {
  const { list, loading, error: loadErr, retry } = useClauses()
  const [q, setQ] = useState("")
  const selected = useMemo(() => new Set(value.map(Number)), [value])

  const all = useMemo(() => {
    const seen = new Set(list.map((c) => Number(c.id)))
    return [...list, ...extra.filter((c) => c && !seen.has(Number(c.id)))]
  }, [list, extra])

  const shown = useMemo(() => {
    const s = q.trim().toLowerCase()
    if (!s) return all
    return all.filter((c) => `${c.code} ${c.text}`.toLowerCase().includes(s) || selected.has(Number(c.id)))
  }, [all, q, selected])

  const toggle = (cid) => {
    const n = Number(cid)
    onChange(selected.has(n) ? value.filter((v) => Number(v) !== n) : [...value.map(Number), n])
  }

  const errId = error ? `${id}-err` : undefined

  return (
    <div className="min-w-0">
      {all.length > 6 && (
        <div className="relative mb-2">
          <Search aria-hidden="true" className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-gray-400" />
          <input type="search" value={q} onChange={(e) => setQ(e.target.value)} aria-label="ค้นหาข้อระเบียบ" placeholder="ค้นหาเลขข้อหรือข้อความ"
            className={cx(baseField, "!rounded-lg !py-2 !pl-9 !pr-3 md:!text-sm")} disabled={disabled} />
        </div>
      )}
      <div id={id} role="group" aria-describedby={[errId, describedBy].filter(Boolean).join(" ") || undefined}
        className={cx(
          "max-h-60 overflow-y-auto rounded-xl border bg-white dark:bg-field",
          error ? "border-red-500 dark:border-red-400" : "border-gray-300 dark:border-line-field",
        )}>
        {loading ? (
          <div className="space-y-2 p-3"><span className="sr-only">กำลังโหลดข้อระเบียบ…</span><Skeleton className="h-8" /><Skeleton className="h-8" /></div>
        ) : loadErr ? (
          <div className="flex flex-wrap items-center justify-between gap-2 p-3 text-sm text-red-700 dark:text-red-300">
            {loadErr}
            <button type="button" onClick={retry} className="font-medium text-indigo-700 underline-offset-2 hover:underline dark:text-indigo-300">ลองใหม่</button>
          </div>
        ) : all.length === 0 ? (
          <p className="p-3 text-sm text-gray-600 dark:text-gray-400">ยังไม่มีข้อระเบียบในระบบ — ฝ่ายบุคคลเพิ่มได้ที่ ตั้งค่าวินัย › ข้อระเบียบ</p>
        ) : shown.length === 0 ? (
          <p className="p-3 text-sm text-gray-600 dark:text-gray-400">ไม่พบข้อที่ตรงกับ “{q}”</p>
        ) : (
          <ul className="divide-y divide-gray-100 dark:divide-line">
            {shown.map((c) => {
              const on = selected.has(Number(c.id))
              return (
                <li key={c.id}>
                  <label className={cx(
                    "flex cursor-pointer items-start gap-3 px-3 py-2.5 transition-colors duration-150 has-[:focus-visible]:bg-indigo-50 dark:has-[:focus-visible]:bg-indigo-500/10",
                    on ? "bg-indigo-50/70 dark:bg-indigo-500/10" : "hover:bg-gray-50 dark:hover:bg-white/[.03]",
                  )}>
                    <input type="checkbox" checked={on} onChange={() => toggle(c.id)} disabled={disabled} className="peer sr-only" />
                    <span aria-hidden="true" className={cx(
                      "mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-md border transition-colors duration-150",
                      on ? "border-indigo-600 bg-indigo-600 text-white dark:border-indigo-400 dark:bg-indigo-500" : "border-gray-300 dark:border-line-field",
                    )}>
                      {on && <Check className="size-3.5" strokeWidth={3} />}
                    </span>
                    <span className="min-w-0 text-sm leading-relaxed">
                      <span className="font-semibold text-gray-900 dark:text-gray-100">{clauseCode(c)}</span>
                      {c.is_active === false && <span className="ml-1.5 text-xs text-gray-500 dark:text-gray-400">(ปิดใช้แล้ว)</span>}
                      <span className="block text-gray-600 dark:text-gray-400">{c.text}</span>
                    </span>
                  </label>
                </li>
              )
            })}
          </ul>
        )}
      </div>
      <div className="mt-1 flex items-center justify-between gap-2">
        {error ? <p id={errId} className={errorTextCls}>{error}</p> : <span />}
        {selected.size > 0 && <p className="text-xs tabular-nums text-gray-500 dark:text-gray-400">เลือก {selected.size} ข้อ</p>}
      </div>
    </div>
  )
}

/** แสดงข้อระเบียบแบบอ่านอย่างเดียว */
export function ClauseList({ clauses }) {
  const list = asArray(clauses)
  if (!list.length) return null
  return (
    <ul className="space-y-1 text-sm leading-relaxed">
      {list.map((c) => (
        <li key={c.id} className="text-gray-700 dark:text-gray-300">
          <span className="font-semibold text-gray-900 dark:text-gray-100">{clauseCode(c)}</span> {c.text}
        </li>
      ))}
    </ul>
  )
}
