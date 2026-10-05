// src/components/hr/SalaryLadderPanel.jsx
// บัญชีขั้นเงินเดือนรายกระบอก — GET /hr/salary-ladder?tier= · PATCH /hr/salary-ladder/{id} {salary_amount}
// + เครื่องมือค้นเงินเดือนจากขั้น — GET /hr/salary-ladder/lookup?tier=&level=
import { useCallback, useEffect, useMemo, useState } from "react"
import { apiAuth } from "../../lib/api"
import SelectDropdown from "../SelectDropdown"
import { SkeletonTableRows, ErrorState, EmptyState } from "../ui"
import HrModal, { Notice } from "./HrModal"
import {
  TIER_OPTIONS, tierName, thb, fmtLevel, errText, tierQuery,
  inputCls, labelCls, primaryBtn, secondaryBtn, linkBtn, cardCls, thCls,
} from "./positionUtils"

export default function SalaryLadderPanel({ defaultTier = "1" }) {
  const [tier, setTier] = useState(String(defaultTier))
  const [ladder, setLadder] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")
  const [flash, setFlash] = useState("")

  const [editRow, setEditRow] = useState(null)
  const [editVal, setEditVal] = useState("")
  const [saving, setSaving] = useState(false)
  const [editError, setEditError] = useState("")

  const fetchLadder = useCallback((t) => {
    if (!t) return
    setLoading(true)
    setError("")
    apiAuth(`/hr/salary-ladder?${tierQuery(t)}`)
      .then((d) => setLadder(Array.isArray(d) ? [...d].sort((a, b) => Number(a.level) - Number(b.level)) : []))
      .catch((e) => { setLadder([]); setError(errText(e, "โหลดบัญชีเงินเดือนไม่สำเร็จ")) })
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => { fetchLadder(tier) }, [tier, fetchLadder])

  useEffect(() => {
    if (!flash) return
    const t = setTimeout(() => setFlash(""), 4000)
    return () => clearTimeout(t)
  }, [flash])

  const range = useMemo(() => {
    if (ladder.length === 0) return null
    const amounts = ladder.map((r) => Number(r.salary_amount))
    return {
      minLevel: ladder[0].level,
      maxLevel: ladder[ladder.length - 1].level,
      min: Math.min(...amounts),
      max: Math.max(...amounts),
    }
  }, [ladder])

  const openEdit = (row) => {
    setEditRow(row)
    setEditVal(row.salary_amount != null ? String(Number(row.salary_amount)) : "")
    setEditError("")
  }

  const saveEdit = async (e) => {
    e?.preventDefault()
    const amount = Number(editVal)
    if (editVal === "" || !Number.isFinite(amount) || amount <= 0) {
      return setEditError("กรุณากรอกจำนวนเงินที่มากกว่า 0")
    }
    setSaving(true)
    setEditError("")
    try {
      await apiAuth(`/hr/salary-ladder/${editRow.id}`, { method: "PATCH", body: { salary_amount: amount } })
      setFlash(`บันทึกขั้น ${fmtLevel(editRow.level)} เป็น ${thb(amount)} บาทแล้ว`)
      setEditRow(null)
      fetchLadder(tier)
    } catch (err) {
      setEditError(errText(err, "บันทึกไม่สำเร็จ"))
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-4">
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_20rem] lg:items-start">
        {/* Ladder */}
        <div className="space-y-3 min-w-0">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <span id="ladder-tier-label" className="text-sm text-gray-600 dark:text-gray-400 whitespace-nowrap">กระบอกเงินเดือน</span>
            <div className="sm:w-80" aria-labelledby="ladder-tier-label">
              <SelectDropdown options={TIER_OPTIONS} value={tier} onChange={setTier} />
            </div>
          </div>

          {flash && <Notice tone="success">{flash}</Notice>}
          {error && <ErrorState message={error} onRetry={() => fetchLadder(tier)} />}

          <div className={cardCls + " overflow-hidden"}>
            <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 px-4 py-3 border-b border-gray-100 dark:border-gray-700">
              <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">{tierName(tier)}</p>
              <p className="text-xs text-gray-500 dark:text-gray-400 tabular-nums">
                {loading ? "กำลังโหลด…" : range
                  ? `${ladder.length} ขั้น · ขั้น ${fmtLevel(range.minLevel)}–${fmtLevel(range.maxLevel)} · ${thb(range.min)}–${thb(range.max)} บาท`
                  : "0 ขั้น"}
              </p>
            </div>
            <div className="overflow-x-auto max-h-[32rem] overflow-y-auto">
              <table className="w-full text-sm">
                <caption className="sr-only">บัญชีขั้นเงินเดือน {tierName(tier)}</caption>
                <thead className="sticky top-0 z-[1]">
                  <tr className="border-b border-gray-100 dark:border-gray-700 bg-gray-50 dark:bg-gray-900">
                    <th scope="col" className={thCls + " text-left w-28"}>ขั้น</th>
                    <th scope="col" className={thCls + " text-right"}>เงินเดือน (บาท)</th>
                    <th scope="col" className={thCls + " text-right w-24"}><span className="sr-only">จัดการ</span></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-gray-700/50">
                  {loading ? (
                    <SkeletonTableRows rows={8} cols={3} />
                  ) : error ? null : ladder.length === 0 ? (
                    <tr>
                      <td colSpan={3} className="p-0">
                        <EmptyState title="กระบอกนี้ยังไม่มีขั้นเงินเดือน" description="ข้อมูลขั้นเงินเดือนจะถูกนำเข้าจากทะเบียนเงินเดือนของ สกต. ตอนเริ่มใช้งานระบบ" />
                      </td>
                    </tr>
                  ) : ladder.map((row, i) => (
                    <tr key={row.id} className={`hover:bg-gray-50 dark:hover:bg-gray-700/30 transition-colors ${i === ladder.length - 1 ? "bg-indigo-50/40 dark:bg-indigo-900/10" : ""}`}>
                      <td className="px-4 py-2 tabular-nums text-gray-700 dark:text-gray-300">
                        {fmtLevel(row.level)}
                        {i === ladder.length - 1 && <span className="ml-2 text-xs text-indigo-600 dark:text-indigo-400">ขั้นสูงสุด</span>}
                      </td>
                      <td className="px-4 py-2 text-right tabular-nums font-semibold text-gray-900 dark:text-gray-100">{thb(row.salary_amount)}</td>
                      <td className="px-4 py-2 text-right">
                        <button type="button" onClick={() => openEdit(row)} className={linkBtn} aria-label={`แก้ไขเงินเดือนขั้น ${fmtLevel(row.level)}`}>แก้ไข</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        <SalaryLookup />
      </div>

      {editRow && (
        <HrModal
          title="แก้ไขเงินเดือนในบัญชี"
          subtitle={`${tierName(editRow.position_tier_id ?? tier)} · ขั้น ${fmtLevel(editRow.level)}`}
          onClose={() => setEditRow(null)}
          busy={saving}
          footer={
            <>
              <button type="button" onClick={() => setEditRow(null)} disabled={saving} className={secondaryBtn + " flex-1"}>ยกเลิก</button>
              <button type="submit" form="ladder-edit-form" disabled={saving} className={primaryBtn + " flex-1"}>{saving ? "กำลังบันทึก…" : "บันทึก"}</button>
            </>
          }
        >
          <form id="ladder-edit-form" onSubmit={saveEdit} className="space-y-3" noValidate>
            <div>
              <label htmlFor="ladder-amount" className={labelCls}>เงินเดือน (บาท)</label>
              <input
                id="ladder-amount"
                type="number"
                inputMode="decimal"
                min="0"
                step="0.01"
                value={editVal}
                onChange={(e) => setEditVal(e.target.value)}
                className={inputCls + " text-right tabular-nums"}
              />
              <p className="mt-1 text-xs text-gray-500 dark:text-gray-400 tabular-nums">ค่าปัจจุบัน {thb(editRow.salary_amount)} บาท</p>
            </div>
            <Notice tone="info">ค่าที่แก้มีผลกับทุกคนที่อยู่ขั้นนี้ของกระบอกนี้ และกับการเทียบขั้นเมื่อสอบเลื่อนตำแหน่ง</Notice>
            {editError && <Notice tone="error">{editError}</Notice>}
          </form>
        </HrModal>
      )}
    </div>
  )
}

/** ค้นเงินเดือนจากกระบอก + ขั้น — GET /hr/salary-ladder/lookup */
function SalaryLookup() {
  const [tier, setTier] = useState("")
  const [level, setLevel] = useState("")
  const [result, setResult] = useState(null)
  const [error, setError] = useState("")
  const [loading, setLoading] = useState(false)

  const run = async (e) => {
    e.preventDefault()
    setResult(null)
    setError("")
    if (!tier || level === "") return setError("เลือกกระบอกและกรอกขั้นก่อน")
    setLoading(true)
    try {
      const d = await apiAuth(`/hr/salary-ladder/lookup?${tierQuery(tier)}&level=${encodeURIComponent(level)}`)
      setResult(d)
    } catch (err) {
      setError(errText(err, "ไม่พบข้อมูล"))
    } finally {
      setLoading(false)
    }
  }

  return (
    <form onSubmit={run} className={cardCls + " p-4 space-y-3"} noValidate>
      <div>
        <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">ค้นเงินเดือนจากขั้น</h3>
        <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">ดูว่าขั้นที่ระบุของกระบอกใดได้เงินเดือนเท่าไร</p>
      </div>
      <div>
        <span id="lookup-tier-label" className={labelCls}>กระบอก</span>
        <div aria-labelledby="lookup-tier-label">
          <SelectDropdown options={TIER_OPTIONS} value={tier} onChange={(v) => { setTier(v); setResult(null) }} placeholder="— เลือกกระบอก —" />
        </div>
      </div>
      <div>
        <label htmlFor="lookup-level" className={labelCls}>ขั้น</label>
        <input id="lookup-level" type="number" inputMode="decimal" min="0" step="0.5" value={level}
          onChange={(e) => { setLevel(e.target.value); setResult(null) }} className={inputCls + " tabular-nums"} placeholder="เช่น 4.5" />
      </div>
      <button type="submit" disabled={loading} className={secondaryBtn + " w-full"}>{loading ? "กำลังค้น…" : "ค้นเงินเดือน"}</button>
      <div aria-live="polite">
        {result && (
          <div className="rounded-xl bg-gray-50 dark:bg-gray-900/40 px-3.5 py-3">
            <p className="text-xs text-gray-500 dark:text-gray-400">{tierName(result.position_tier_id ?? tier)} · ขั้น {fmtLevel(result.level ?? level)}</p>
            <p className="text-xl font-semibold tabular-nums text-gray-900 dark:text-gray-100">{thb(result.salary_amount)} <span className="text-sm font-normal text-gray-500 dark:text-gray-400">บาท</span></p>
          </div>
        )}
        {error && <Notice tone="error">{error}</Notice>}
      </div>
    </form>
  )
}
