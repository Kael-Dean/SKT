// src/components/hr/EmployeePositionCard.jsx
// ตำแหน่งของเจ้าหน้าที่ 1 คน (หน้า HRPersonnelDetail)
// PATCH /hr/employees/{id}/position {new_position_id, reason, effective_date?}
// GET   /hr/employees/{id}/position-history
import { useCallback, useEffect, useMemo, useState } from "react"
import { apiAuth } from "../../lib/api"
import SelectDropdown from "../SelectDropdown"
import ThaiDateInput from "../ThaiDateInput"
import { ErrorState, Skeleton } from "../ui"
import HrModal, { Notice } from "./HrModal"
import usePositions from "./usePositions"
import {
  tierName, fmtDate, fmtLevel, errText, todayISO, reasonLabel,
  inputCls, labelCls, primaryBtn, secondaryBtn, cardCls,
} from "./positionUtils"

export default function EmployeePositionCard({ employeeId, employeeName, positionId, positionEnteredDate, salaryLevel, onChanged }) {
  const { byId, active, loading: posLoading, error: posError, reload: reloadPositions } = usePositions()

  const [history, setHistory] = useState([])
  const [histLoading, setHistLoading] = useState(true)
  const [histError, setHistError] = useState("")

  const [modal, setModal] = useState(false)
  const [form, setForm] = useState({ new_position_id: "", reason: "", effective_date: todayISO() })
  const [saving, setSaving] = useState(false)
  const [formError, setFormError] = useState("")
  const [flash, setFlash] = useState("")
  // หลังเปลี่ยนตำแหน่ง แสดงค่าล่าสุดทันทีโดยไม่ต้องโหลดทั้งหน้าใหม่ (parent ยังเรียก onChanged ได้ถ้าต้องการ)
  const [override, setOverride] = useState(null) // { positionId, enteredDate }
  useEffect(() => { setOverride(null) }, [positionId, positionEnteredDate])
  const curPositionId = override?.positionId ?? positionId
  const curEntered = override?.enteredDate ?? positionEnteredDate

  const loadHistory = useCallback(() => {
    setHistLoading(true)
    setHistError("")
    apiAuth(`/hr/employees/${employeeId}/position-history`)
      .then((d) => {
        const list = Array.isArray(d) ? [...d] : []
        const dateOf = (r) => String(r.promotion_date ?? r.effective_date ?? r.date ?? "")
        list.sort((a, b) => dateOf(b).localeCompare(dateOf(a)) || (b.id ?? 0) - (a.id ?? 0))
        setHistory(list)
      })
      .catch((e) => { setHistory([]); setHistError(errText(e, "โหลดประวัติตำแหน่งไม่สำเร็จ")) })
      .finally(() => setHistLoading(false))
  }, [employeeId])

  useEffect(() => { loadHistory() }, [loadHistory])

  useEffect(() => {
    if (!flash) return
    const t = setTimeout(() => setFlash(""), 5000)
    return () => clearTimeout(t)
  }, [flash])

  const current = curPositionId != null ? byId[curPositionId] : null

  const options = useMemo(
    () => active
      .filter((p) => p.id !== Number(curPositionId))
      .map((p) => ({ value: String(p.id), label: p.title, sublabel: tierName(p.position_tier_id) ?? "ยังไม่กำหนดระดับ" })),
    [active, curPositionId],
  )

  const target = form.new_position_id ? byId[form.new_position_id] : null

  const openModal = () => {
    setForm({ new_position_id: "", reason: "", effective_date: todayISO() })
    setFormError("")
    setModal(true)
  }

  const submit = async (e) => {
    e?.preventDefault()
    if (!form.new_position_id) return setFormError("เลือกตำแหน่งใหม่")
    if (!form.reason.trim()) return setFormError("กรอกเหตุผลการเปลี่ยนตำแหน่ง")
    setSaving(true)
    setFormError("")
    try {
      const body = { new_position_id: Number(form.new_position_id), reason: form.reason.trim() }
      if (form.effective_date) body.effective_date = form.effective_date
      await apiAuth(`/hr/employees/${employeeId}/position`, { method: "PATCH", body })
      setFlash(`เปลี่ยนตำแหน่งเป็น “${target?.title ?? form.new_position_id}” แล้ว มีผล ${fmtDate(form.effective_date || todayISO())}`)
      setModal(false)
      setOverride({ positionId: body.new_position_id, enteredDate: body.effective_date ?? todayISO() })
      loadHistory()
      onChanged?.()
    } catch (err) {
      setFormError(errText(err, "เปลี่ยนตำแหน่งไม่สำเร็จ"))
    } finally {
      setSaving(false)
    }
  }

  return (
    <section aria-labelledby="pos-card-title" className={cardCls + " p-5"}>
      <div className="flex items-start justify-between gap-3 mb-3 pb-1 border-b border-indigo-100 dark:border-indigo-900/40">
        <h3 id="pos-card-title" className="text-xs font-semibold text-indigo-700 dark:text-indigo-300 tracking-wide">ตำแหน่งและขั้นเงินเดือน</h3>
        <button type="button" onClick={openModal} disabled={posLoading || !!posError} className="text-xs font-semibold text-indigo-600 dark:text-indigo-400 hover:underline cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed rounded focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500">
          เปลี่ยนตำแหน่ง
        </button>
      </div>

      {posError && <ErrorState message={posError} onRetry={reloadPositions} className="mb-3" />}
      {flash && <Notice tone="success" className="mb-3">{flash}</Notice>}

      {/* Current */}
      <dl className="grid gap-x-6 gap-y-3 sm:grid-cols-4 text-sm">
        <div className="sm:col-span-2 min-w-0">
          <dt className="text-xs text-gray-500 dark:text-gray-400">ตำแหน่งปัจจุบัน</dt>
          <dd className="mt-0.5 font-semibold text-gray-900 dark:text-gray-100 break-words">
            {posLoading ? <Skeleton className="h-5 w-40" /> : current?.title ?? (curPositionId != null ? `ตำแหน่ง #${curPositionId}` : "ยังไม่มีตำแหน่ง")}
            {current && current.is_active === false && <span className="ml-2 text-xs font-normal text-gray-500 dark:text-gray-400">(ตำแหน่งนี้ปิดใช้งานแล้ว)</span>}
          </dd>
        </div>
        <div>
          <dt className="text-xs text-gray-500 dark:text-gray-400">กระบอก</dt>
          <dd className={`mt-0.5 ${current && current.position_tier_id == null ? "text-amber-700 dark:text-amber-300" : "text-gray-900 dark:text-gray-100"}`}>
            {posLoading ? "…" : current ? tierName(current.position_tier_id) ?? "ยังไม่กำหนด" : "—"}
          </dd>
        </div>
        <div>
          <dt className="text-xs text-gray-500 dark:text-gray-400">ขั้นเงินเดือน</dt>
          <dd className="mt-0.5 tabular-nums text-gray-900 dark:text-gray-100">{fmtLevel(salaryLevel)}</dd>
        </div>
        <div className="sm:col-span-4">
          <dt className="text-xs text-gray-500 dark:text-gray-400">ดำรงตำแหน่งตั้งแต่</dt>
          <dd className="mt-0.5 text-gray-900 dark:text-gray-100">{fmtDate(curEntered)}</dd>
        </div>
      </dl>

      {/* History */}
      <div className="mt-5">
        <h4 className="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-2">ประวัติตำแหน่ง</h4>
        {histError ? (
          <ErrorState message={histError} onRetry={loadHistory} />
        ) : histLoading ? (
          <div className="space-y-2"><Skeleton className="h-10 w-full" /><Skeleton className="h-10 w-full" /></div>
        ) : history.length === 0 ? (
          <p className="text-sm text-gray-500 dark:text-gray-400">ยังไม่มีการเปลี่ยนตำแหน่ง</p>
        ) : (
          <ol className="divide-y divide-gray-100 dark:divide-gray-700/50">
            {history.map((h, i) => {
              const oldTitle = h.old_position_title ?? (h.old_position_id != null ? byId[h.old_position_id]?.title ?? `#${h.old_position_id}` : null)
              const newId = h.new_position_id ?? h.title
              const newTitle = h.new_position_title ?? (newId != null ? byId[newId]?.title ?? `#${newId}` : "—")
              return (
                <li key={h.id ?? i} className="py-2.5 grid gap-1 sm:grid-cols-[8rem_minmax(0,1fr)] sm:gap-4 text-sm">
                  <span className="text-gray-500 dark:text-gray-400 whitespace-nowrap">{fmtDate(h.promotion_date ?? h.effective_date ?? h.date)}</span>
                  <div className="min-w-0">
                    <p className="text-gray-900 dark:text-gray-100 break-words">
                      {oldTitle ? <><span className="text-gray-500 dark:text-gray-400">{oldTitle}</span> <span aria-hidden="true" className="text-gray-400">→</span><span className="sr-only">เป็น</span> </> : null}
                      <span className="font-semibold">{newTitle}</span>
                    </p>
                    {h.reason && <p className="text-xs text-gray-500 dark:text-gray-400 break-words">{reasonLabel(h.reason)}</p>}
                  </div>
                </li>
              )
            })}
          </ol>
        )}
      </div>

      {modal && (
        <HrModal
          title="เปลี่ยนตำแหน่ง"
          subtitle={employeeName}
          onClose={() => setModal(false)}
          busy={saving}
          size="md"
          footer={
            <>
              <button type="button" onClick={() => setModal(false)} disabled={saving} className={secondaryBtn + " flex-1"}>ยกเลิก</button>
              <button type="submit" form="change-position-form" disabled={saving} className={primaryBtn + " flex-1"}>{saving ? "กำลังบันทึก…" : "เปลี่ยนตำแหน่ง"}</button>
            </>
          }
        >
          <form id="change-position-form" onSubmit={submit} className="space-y-3" noValidate>
            <p className="text-sm text-gray-600 dark:text-gray-300">
              ปัจจุบัน: <span className="font-semibold text-gray-900 dark:text-gray-100">{current?.title ?? "ยังไม่มีตำแหน่ง"}</span>
            </p>
            <div>
              <span id="new-pos-label" className={labelCls}>ตำแหน่งใหม่ <span className="text-red-500" aria-hidden="true">*</span></span>
              <div aria-labelledby="new-pos-label">
                <SelectDropdown
                  options={options}
                  value={form.new_position_id}
                  onChange={(v) => setForm((f) => ({ ...f, new_position_id: v }))}
                  placeholder="— เลือกตำแหน่ง (เฉพาะที่ใช้งาน) —"
                />
              </div>
              {target && target.position_tier_id == null && (
                <p className="mt-1 text-xs text-amber-700 dark:text-amber-300">ตำแหน่งนี้ยังไม่กำหนดระดับ — หลังย้ายจะเลื่อนขั้นเงินเดือนไม่ได้จนกว่าจะกำหนด</p>
              )}
            </div>
            <div>
              <label htmlFor="pos-reason" className={labelCls}>เหตุผล <span className="text-red-500" aria-hidden="true">*</span></label>
              <input id="pos-reason" type="text" value={form.reason} maxLength={255}
                onChange={(e) => setForm((f) => ({ ...f, reason: e.target.value }))}
                className={inputCls} placeholder="เช่น ตามคำสั่ง สกต. ที่ 12/2569" />
            </div>
            <div>
              <span className={labelCls}>วันที่มีผล</span>
              <ThaiDateInput value={form.effective_date} onChange={(v) => setForm((f) => ({ ...f, effective_date: v }))} />
              <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">เว้นว่าง = มีผลวันนี้ · วันที่ดำรงตำแหน่งจะเริ่มนับใหม่จากวันนี้</p>
            </div>
            <Notice tone="info">การเปลี่ยนตำแหน่งตรงนี้ไม่ปรับขั้นเงินเดือนให้อัตโนมัติ ถ้าเป็นการเลื่อนตำแหน่งจากการสอบ ให้บันทึกผลสอบที่แท็บ “เลื่อนตำแหน่ง” แทน</Notice>
            {formError && <Notice tone="error">{formError}</Notice>}
          </form>
        </HrModal>
      )}
    </section>
  )
}
