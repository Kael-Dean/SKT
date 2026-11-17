// src/pages/hr/tabs/HRLeaveTypesTab.jsx
import { cx, baseField, errorTextCls, neutralBtnCls, primaryBtnCls } from "../../../lib/styles"
// จัดการประเภทการลา — GET /hr/leave-types, PATCH update/toggle, POST สร้างประเภทใหม่ (โควตาของตัวเอง ไม่มี quota_column)
import { useEffect, useId, useState, useCallback } from "react"
import { apiAuth } from "../../../lib/api"
import Can from "../../../components/Can"
import { apiDetail } from "../../../lib/apiErrors"
import { leaveTypeLabel } from "../../../lib/leaveDays"
import { SkeletonTableRows, ErrorState, EmptyState, Badge, Sheet, toast } from "../../../components/ui"

const inputCls = cx(baseField, "!w-24 !rounded-lg !px-3 !py-1.5 md:!text-sm text-right")
const nameInputCls = cx(baseField, "!rounded-lg !px-3 !py-1.5 md:!text-sm")
const NAME_MAX = 100

// GET /hr/leave-types returns the Leaves row as-is: { id, type, days, max_days, is_active, display_name? }
// `type` = key ของ logic (ห้ามแก้), `display_name` = ชื่อที่ HR ตั้ง — handoff/leave-type-rename-backend.md
const leaveName = (lt) => leaveTypeLabel(lt)
const leaveDays = (lt) => lt?.days ?? lt?.days_allowed ?? null

function PencilBtn({ label, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      className="inline-flex shrink-0 items-center justify-center rounded-lg p-1 text-gray-400 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 cursor-pointer transition-colors duration-150 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
    >
      <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="size-3.5">
        <path d="M12 20h9" />
        <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4Z" />
      </svg>
    </button>
  )
}

const sheetInputCls = cx(baseField, "!rounded-lg !px-3 !py-2 md:!text-sm")
const sheetLabelCls = "mb-1 block text-xs font-medium text-gray-600 dark:text-gray-400"

/** เพิ่มประเภทการลา → POST /hr/leave-types { type, days (≥0), max_days (≥1 | null) } → 201 · 409 ชื่อซ้ำ (รวมชื่อในตัว เช่น ลาฟื้นฟู) */
function AddLeaveTypeSheet({ existing, onClose, onCreated }) {
  const uid = useId()
  const [name, setName] = useState("")
  const [days, setDays] = useState("")
  const [maxDays, setMaxDays] = useState("")
  const [errs, setErrs] = useState({})
  const [err, setErr] = useState("")
  const [busy, setBusy] = useState(false)

  const save = async (ev) => {
    ev?.preventDefault()
    const n = name.trim()
    const next = {}
    if (!n) next.name = "กรอกชื่อประเภทการลา"
    else if (n.length > NAME_MAX) next.name = `ชื่อยาวได้ไม่เกิน ${NAME_MAX} ตัวอักษร`
    else if (existing.some((o) => leaveTypeLabel(o) === n || o.type === n)) next.name = "มีประเภทการลาชื่อนี้แล้ว"
    const d = days === "" ? NaN : Number(days)
    if (!Number.isInteger(d) || d < 0) next.days = "กรอกจำนวนวันต่อปีเป็นจำนวนเต็ม ตั้งแต่ 0 ขึ้นไป"
    const m = maxDays === "" ? null : Number(maxDays)
    if (m !== null && (!Number.isInteger(m) || m < 1)) next.max = "ลาได้สูงสุดต่อครั้งต้องเป็นจำนวนเต็ม ตั้งแต่ 1 ขึ้นไป"
    setErrs(next)
    if (Object.keys(next).length) return
    setBusy(true); setErr("")
    try {
      const body = { type: n, days: d }
      if (m !== null) body.max_days = m
      const res = await apiAuth("/hr/leave-types", { method: "POST", body })
      toast.success(`เพิ่มประเภทการลา "${res?.type ?? n}" แล้ว`, { description: "พนักงานทุกคนได้สิทธิ์ตามจำนวนวันต่อปี · ตั้งเฉพาะรายคนได้ที่หน้าพนักงาน" })
      onCreated?.(res)
    } catch (e) {
      setErr(apiDetail(e) || "เพิ่มประเภทการลาไม่สำเร็จ") // 409 → "มีประเภทการลาชื่อนี้แล้ว"
    } finally {
      setBusy(false)
    }
  }

  const fieldErr = (k) => (errs[k] ? <p id={`${uid}-${k}-err`} role="alert" className={errorTextCls}>{errs[k]}</p> : null)

  return (
    <Sheet open onClose={onClose} busy={busy} size="md" title="เพิ่มประเภทการลา"
      subtitle="ประเภทที่เพิ่มมีโควตาของตัวเอง ไม่ปนกับประเภทอื่น"
      footer={(
        <div className="grid grid-cols-2 gap-3 md:flex md:justify-end md:gap-2">
          <button type="button" onClick={onClose} disabled={busy} className={neutralBtnCls}>ยกเลิก</button>
          <button type="submit" form={`${uid}-form`} disabled={busy} className={primaryBtnCls}>{busy ? "กำลังบันทึก…" : "เพิ่มประเภท"}</button>
        </div>
      )}>
      <form id={`${uid}-form`} onSubmit={save} noValidate className="space-y-4">
        <div className="min-w-0">
          <label htmlFor={`${uid}-name`} className={sheetLabelCls}>ชื่อประเภทการลา <span className="text-red-600 dark:text-red-400">*</span></label>
          <input id={`${uid}-name`} value={name} maxLength={NAME_MAX} autoFocus disabled={busy} autoComplete="off"
            placeholder="เช่น ลาไปช่วยราชการ"
            aria-required="true" aria-invalid={errs.name ? true : undefined} aria-describedby={errs.name ? `${uid}-name-err` : undefined}
            onChange={(e) => { setName(e.target.value); setErrs((s) => ({ ...s, name: "" })); setErr("") }}
            className={cx(sheetInputCls, errs.name && "!border-red-500 dark:!border-red-400")} />
          {fieldErr("name")}
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="min-w-0">
            <label htmlFor={`${uid}-days`} className={sheetLabelCls}>จำนวนวัน/ปี <span className="text-red-600 dark:text-red-400">*</span></label>
            <input id={`${uid}-days`} type="number" inputMode="numeric" min="0" step="1" value={days} disabled={busy}
              aria-required="true" aria-invalid={errs.days ? true : undefined} aria-describedby={errs.days ? `${uid}-days-err` : undefined}
              onChange={(e) => { setDays(e.target.value); setErrs((s) => ({ ...s, days: "" })) }}
              className={cx(sheetInputCls, "tabular-nums", errs.days && "!border-red-500 dark:!border-red-400")} />
            {fieldErr("days")}
          </div>
          <div className="min-w-0">
            <label htmlFor={`${uid}-max`} className={sheetLabelCls}>ลาได้สูงสุดต่อครั้ง (วัน)</label>
            <input id={`${uid}-max`} type="number" inputMode="numeric" min="1" step="1" value={maxDays} disabled={busy}
              placeholder="ไม่จำกัด"
              aria-invalid={errs.max ? true : undefined} aria-describedby={errs.max ? `${uid}-max-err` : undefined}
              onChange={(e) => { setMaxDays(e.target.value); setErrs((s) => ({ ...s, max: "" })) }}
              className={cx(sheetInputCls, "tabular-nums", errs.max && "!border-red-500 dark:!border-red-400")} />
            {fieldErr("max")}
          </div>
        </div>
        <p className="text-xs leading-relaxed text-gray-500 dark:text-gray-400">
          นับเป็นวันทำงาน · ลบประเภทไม่ได้ (ใบลาเก่าอ้างถึงอยู่) ใช้ปุ่ม "ปิดใช้งาน" แทน
        </p>
        {err && <p role="alert" className={errorTextCls}>{err}</p>}
      </form>
    </Sheet>
  )
}

export default function HRLeaveTypesTab() {
  const [addOpen, setAddOpen] = useState(false)
  const [leaveTypes, setLeaveTypes] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [editingId, setEditingId] = useState(null)
  const [editVal, setEditVal] = useState("")
  const [saving, setSaving] = useState(null)
  const [toggling, setToggling] = useState(null)
  const [msg, setMsg] = useState(null) // { ok: boolean, text: string } | null

  const fetchLeaveTypes = useCallback(() => {
    setLoading(true)
    setError("")
    apiAuth("/hr/leave-types")
      .then(setLeaveTypes)
      .catch((e) => setError(e.message || "โหลดข้อมูลไม่สำเร็จ"))
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => { fetchLeaveTypes() }, [fetchLeaveTypes])

  const startEdit = (lt) => {
    setEditingId(lt.id)
    setEditVal(String(leaveDays(lt) ?? ""))
    setMsg(null)
  }

  const saveDays = async (id) => {
    setSaving(id)
    setMsg(null)
    try {
      await apiAuth(`/hr/leave-types/${id}`, {
        method: "PATCH",
        body: { days: Number(editVal) },
      })
      setMsg({ ok: true, text: "บันทึกสำเร็จ" })
      setEditingId(null)
      fetchLeaveTypes()
    } catch (err) {
      setMsg({ ok: false, text: err.message || "บันทึกไม่สำเร็จ" })
    } finally {
      setSaving(null)
    }
  }

  // แก้ชื่อ — ปุ่มโผล่เองเมื่อ backend ส่ง display_name มาใน GET (ยังไม่มี = ซ่อน ไม่ยิง PATCH ที่ backend ไม่รู้จัก)
  const renameSupported = leaveTypes.some((lt) => lt && typeof lt === "object" && "display_name" in lt)
  const [nameEditId, setNameEditId] = useState(null)
  const [nameVal, setNameVal] = useState("")
  const [nameErr, setNameErr] = useState("")
  const [nameSaving, setNameSaving] = useState(false)

  const startRename = (lt) => {
    setNameEditId(lt.id)
    setNameVal(leaveTypeLabel(lt))
    setNameErr("")
    setMsg(null)
  }
  const cancelRename = () => {
    setNameEditId(null)
    setNameErr("")
  }

  // ส่ง null = กลับไปแสดงชื่อในระบบ (`type`) — พิมพ์ชื่อในระบบกลับมาเองก็ส่ง null เช่นกัน
  const saveName = async (lt, reset = false) => {
    const name = reset ? (lt.type ?? "") : nameVal.trim()
    if (!name) return setNameErr("กรอกชื่อประเภทการลา")
    if (name.length > NAME_MAX) return setNameErr(`ชื่อยาวได้ไม่เกิน ${NAME_MAX} ตัวอักษร`)
    if (name === leaveTypeLabel(lt)) return cancelRename()
    // กติกาเดียวกับ backend (409): ห้ามซ้ำกับชื่อที่แสดงของประเภทอื่น (display_name ถ้ามี ไม่งั้น type)
    const clash = leaveTypes.some((o) => o.id !== lt.id && leaveTypeLabel(o) === name)
    if (clash) return setNameErr("มีประเภทการลาชื่อนี้แล้ว")
    const displayName = lt.type && name === lt.type ? null : name
    setNameSaving(true)
    setNameErr("")
    try {
      await apiAuth(`/hr/leave-types/${lt.id}`, { method: "PATCH", body: { display_name: displayName } })
      setMsg({ ok: true, text: displayName == null ? `กลับไปใช้ชื่อ "${name}" แล้ว` : `เปลี่ยนชื่อเป็น "${name}" แล้ว` })
      setNameEditId(null)
      fetchLeaveTypes()
    } catch (err) {
      setNameErr(err.message || "เปลี่ยนชื่อไม่สำเร็จ")
    } finally {
      setNameSaving(false)
    }
  }

  const toggleActive = async (lt) => {
    setToggling(lt.id)
    setMsg(null)
    try {
      await apiAuth(`/hr/leave-types/${lt.id}/toggle`, { method: "PATCH" })
      fetchLeaveTypes()
    } catch (err) {
      setMsg({ ok: false, text: err.message || "ไม่สำเร็จ" })
    } finally {
      setToggling(null)
    }
  }

  return (
    <div className="space-y-4">
      {error && <ErrorState message={error} onRetry={fetchLeaveTypes} />}
      <Can perm="hr.leaveTypes.manage">
        <div className="flex justify-end">
          <button type="button" onClick={() => setAddOpen(true)} className={primaryBtnCls}>เพิ่มประเภทการลา</button>
        </div>
      </Can>
      {addOpen && (
        <AddLeaveTypeSheet
          existing={leaveTypes}
          onClose={() => setAddOpen(false)}
          onCreated={() => { setAddOpen(false); fetchLeaveTypes() }}
        />
      )}
      {msg && (
        <p
          role="status"
          className={`text-sm font-medium ${msg.ok ? "text-emerald-600 dark:text-emerald-400" : "text-red-600 dark:text-red-400"}`}
        >
          {msg.text}
        </p>
      )}

      {!loading && !error && leaveTypes.length === 0 ? (
        <div className="rounded-2xl bg-white dark:bg-gray-800 ring-1 ring-gray-200/70 dark:ring-gray-700/70 shadow-sm">
          <EmptyState
            title="ยังไม่มีประเภทการลา"
            description="ประเภทการลาจะถูกตั้งค่าจากระบบ — ติดต่อผู้ดูแลหากต้องการเพิ่ม"
          />
        </div>
      ) : (
        <div className="rounded-2xl bg-white dark:bg-gray-800 ring-1 ring-gray-200/70 dark:ring-gray-700/70 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/30">
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 dark:text-gray-400">ประเภทการลา</th>
                  <th className="text-right px-4 py-3 text-xs font-semibold whitespace-nowrap text-gray-500 dark:text-gray-400">จำนวนวัน/ปี</th>
                  <th className="text-center px-4 py-3 text-xs font-semibold whitespace-nowrap text-gray-500 dark:text-gray-400">สถานะ</th>
                  <th className="px-4 py-3 w-28"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-700/50" aria-busy={loading}>
                {loading ? (
                  <SkeletonTableRows rows={6} cols={4} />
                ) : leaveTypes.map((lt) => (
                  <tr key={lt.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/30 transition-colors duration-150">
                    <td className="px-4 py-3 min-w-0">
                      {nameEditId === lt.id ? (
                        <form
                          className="flex min-w-0 flex-wrap items-center gap-2"
                          onSubmit={(e) => { e.preventDefault(); saveName(lt) }}
                        >
                          <input
                            id={`lt-name-${lt.id}`}
                            value={nameVal}
                            onChange={(e) => { setNameVal(e.target.value); setNameErr("") }}
                            onKeyDown={(e) => { if (e.key === "Escape") cancelRename() }}
                            maxLength={NAME_MAX}
                            autoFocus
                            aria-label={`ชื่อประเภทการลา (เดิม ${leaveTypeLabel(lt)})`}
                            aria-invalid={nameErr ? true : undefined}
                            aria-describedby={nameErr ? `lt-name-err-${lt.id}` : undefined}
                            className={cx(nameInputCls, "min-w-0 flex-1 basis-48", nameErr && "!border-red-500 dark:!border-red-400")}
                          />
                          <button type="submit" disabled={nameSaving}
                            className="text-xs text-emerald-600 dark:text-emerald-400 hover:underline cursor-pointer disabled:opacity-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 rounded">
                            {nameSaving ? "..." : "บันทึก"}
                          </button>
                          <button type="button" onClick={cancelRename} className="text-xs text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 rounded">ยกเลิก</button>
                          {lt.type && leaveTypeLabel(lt) !== lt.type && (
                            <button type="button" onClick={() => saveName(lt, true)} disabled={nameSaving}
                              className="text-xs text-indigo-600 dark:text-indigo-400 hover:underline cursor-pointer disabled:opacity-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 rounded">
                              ใช้ชื่อในระบบ ({lt.type})
                            </button>
                          )}
                          {nameErr && (
                            <p id={`lt-name-err-${lt.id}`} role="alert" className="basis-full text-xs text-red-600 dark:text-red-400">{nameErr}</p>
                          )}
                        </form>
                      ) : (
                        <div className="flex min-w-0 items-center gap-1.5">
                          <span className="truncate font-medium text-gray-900 dark:text-gray-100">{leaveName(lt) || "—"}</span>
                          {lt.is_custom && <Badge tone="info">เพิ่มโดย HR</Badge>}
                          {renameSupported && <PencilBtn label={`แก้ชื่อ ${leaveName(lt)}`} onClick={() => startRename(lt)} />}
                        </div>
                      )}
                      {leaveName(lt) !== lt.type && lt.type && nameEditId !== lt.id && (
                        <div className="text-xs text-gray-500 dark:text-gray-400">ชื่อในระบบ: {lt.type}</div>
                      )}
                      {lt.max_days != null && (
                        <div className="text-xs text-gray-500 dark:text-gray-400 tabular-nums">ลาได้สูงสุด {lt.max_days} วัน</div>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right">
                      {editingId === lt.id ? (
                        <div className="flex items-center justify-end gap-2">
                          <input
                            type="number"
                            value={editVal}
                            onChange={(e) => setEditVal(e.target.value)}
                            className={inputCls + " tabular-nums"}
                            min="0"
                            autoFocus
                            aria-label={`จำนวนวัน/ปี ของ ${leaveName(lt)}`}
                          />
                          <button onClick={() => saveDays(lt.id)} disabled={saving === lt.id}
                            className="text-xs text-emerald-600 dark:text-emerald-400 hover:underline cursor-pointer disabled:opacity-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 rounded">
                            {saving === lt.id ? "..." : "บันทึก"}
                          </button>
                          <button onClick={() => setEditingId(null)} className="text-xs text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 rounded">ยกเลิก</button>
                        </div>
                      ) : (
                        <div className="flex items-center justify-end gap-2">
                          <span className="font-semibold whitespace-nowrap text-indigo-700 dark:text-indigo-300 tabular-nums">{leaveDays(lt) ?? "—"} วัน</span>
                          <PencilBtn label={`แก้ไขจำนวนวัน ${leaveName(lt)}`} onClick={() => startEdit(lt)} />
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <Badge tone={lt.is_active !== false ? "success" : "neutral"}>
                        {lt.is_active !== false ? "เปิด" : "ปิด"}
                      </Badge>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <button
                        onClick={() => toggleActive(lt)}
                        disabled={toggling === lt.id}
                        className={`text-xs font-medium rounded-lg px-3 py-1 transition duration-150 cursor-pointer disabled:opacity-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-1 dark:focus-visible:ring-offset-gray-800 ${lt.is_active !== false ? "bg-gray-100 text-gray-600 hover:bg-red-100 hover:text-red-700 focus-visible:ring-red-500 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-red-900/30 dark:hover:text-red-300" : "bg-emerald-100 text-emerald-700 hover:bg-emerald-200 focus-visible:ring-emerald-500 dark:bg-emerald-900/30 dark:text-emerald-300 dark:hover:bg-emerald-900/50"}`}
                      >
                        {toggling === lt.id ? "..." : lt.is_active !== false ? "ปิดใช้งาน" : "เปิดใช้งาน"}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
