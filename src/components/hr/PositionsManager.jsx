// src/components/hr/PositionsManager.jsx
// 3D ตำแหน่งงาน — GET /hr/positions · POST /hr/positions · PATCH /hr/positions/{id}
// · PATCH /hr/positions/{id}/deactivate (409 ถ้าปิดไปแล้ว → แสดง detail ตาม backend)
// UAT D1: สร้าง / เปลี่ยนชื่อ / ปิดใช้งาน / ปิดซ้ำ = 409
import { useCallback, useEffect, useMemo, useState } from "react"
import { apiAuth } from "../../lib/api"
import SelectDropdown from "../SelectDropdown"
import { SkeletonTableRows, ErrorState, EmptyState, Badge } from "../ui"
import HrModal, { Notice } from "./HrModal"
import {
  TIER_OPTIONS, tierName, errText, POSITIONS_PATH,
  inputCls, labelCls, primaryBtn, secondaryBtn, dangerBtn, linkBtn, cardCls, thCls,
} from "./positionUtils"

const COLS = 4
const STATUS_FILTERS = [
  ["active", "ใช้งาน"],
  ["inactive", "ปิดแล้ว"],
  ["all", "ทั้งหมด"],
]

export default function PositionsManager() {
  const [positions, setPositions] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")

  const [query, setQuery] = useState("")
  const [statusFilter, setStatusFilter] = useState("active")

  const [form, setForm] = useState(null) // { mode: "create"|"edit", id?, title, position_tier_id }
  const [saving, setSaving] = useState(false)
  const [formError, setFormError] = useState("")

  const [confirmPos, setConfirmPos] = useState(null)
  const [deactivating, setDeactivating] = useState(false)
  const [deactivateError, setDeactivateError] = useState("")

  const [flash, setFlash] = useState("")

  const fetchPositions = useCallback(() => {
    setLoading(true)
    setError("")
    apiAuth(POSITIONS_PATH)
      .then((d) => setPositions(Array.isArray(d) ? d : []))
      .catch((e) => setError(errText(e, "โหลดรายการตำแหน่งไม่สำเร็จ")))
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => { fetchPositions() }, [fetchPositions])

  useEffect(() => {
    if (!flash) return
    const t = setTimeout(() => setFlash(""), 4000)
    return () => clearTimeout(t)
  }, [flash])

  const counts = useMemo(() => ({
    active: positions.filter((p) => p.is_active !== false).length,
    inactive: positions.filter((p) => p.is_active === false).length,
    noTier: positions.filter((p) => p.is_active !== false && p.position_tier_id == null).length,
  }), [positions])

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase()
    return positions
      .filter((p) =>
        statusFilter === "all" ? true : statusFilter === "active" ? p.is_active !== false : p.is_active === false)
      .filter((p) => !q || String(p.title ?? "").toLowerCase().includes(q))
      .sort((a, b) => (a.position_tier_id ?? 99) - (b.position_tier_id ?? 99) || String(a.title).localeCompare(String(b.title), "th"))
  }, [positions, query, statusFilter])

  // ─── Create / Edit ───────────────────────────────────────────────────────
  const openCreate = () => {
    setForm({ mode: "create", title: "", position_tier_id: "" })
    setFormError("")
  }
  const openEdit = (p) => {
    setForm({ mode: "edit", id: p.id, original: p, title: p.title ?? "", position_tier_id: p.position_tier_id != null ? String(p.position_tier_id) : "" })
    setFormError("")
  }

  const handleSave = async (e) => {
    e?.preventDefault()
    const title = form.title.trim()
    if (!title) return setFormError("กรุณากรอกชื่อตำแหน่ง")
    setSaving(true)
    setFormError("")
    try {
      if (form.mode === "create") {
        const body = { title }
        if (form.position_tier_id) body.position_tier_id = Number(form.position_tier_id)
        await apiAuth("/hr/positions", { method: "POST", body })
        setFlash(`เพิ่มตำแหน่ง "${title}" แล้ว`)
      } else {
        const body = {}
        if (title !== form.original.title) body.title = title
        const tierNow = form.position_tier_id ? Number(form.position_tier_id) : null
        if (tierNow != null && tierNow !== form.original.position_tier_id) body.position_tier_id = tierNow
        if (Object.keys(body).length === 0) {
          setForm(null)
          return
        }
        await apiAuth(`/hr/positions/${form.id}`, { method: "PATCH", body })
        setFlash(`บันทึกตำแหน่ง "${title}" แล้ว`)
      }
      setForm(null)
      fetchPositions()
    } catch (err) {
      setFormError(errText(err, "บันทึกไม่สำเร็จ"))
    } finally {
      setSaving(false)
    }
  }

  // ─── Deactivate ──────────────────────────────────────────────────────────
  const openDeactivate = (p) => {
    setConfirmPos(p)
    setDeactivateError("")
  }

  const handleDeactivate = async () => {
    setDeactivating(true)
    setDeactivateError("")
    try {
      await apiAuth(`/hr/positions/${confirmPos.id}/deactivate`, { method: "PATCH" })
      setFlash(`ปิดใช้งานตำแหน่ง "${confirmPos.title}" แล้ว`)
      setConfirmPos(null)
      fetchPositions()
    } catch (err) {
      // 409 = ปิดไปแล้ว — แสดง detail ตามที่ backend ส่งมา แล้วโหลดรายการใหม่ให้สถานะตรงกับระบบ
      setDeactivateError(errText(err, "ปิดใช้งานไม่สำเร็จ"))
      if (err?.status === 409) fetchPositions()
    } finally {
      setDeactivating(false)
    }
  }

  const editingInactive = form?.mode === "edit" && form.original?.is_active === false

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <div role="radiogroup" aria-label="กรองสถานะตำแหน่ง" className="flex gap-1 rounded-xl bg-gray-100 dark:bg-gray-800 p-1 w-fit">
            {STATUS_FILTERS.map(([v, label]) => {
              const n = v === "all" ? positions.length : counts[v]
              const on = statusFilter === v
              return (
                <button
                  key={v}
                  type="button"
                  role="radio"
                  aria-checked={on}
                  onClick={() => setStatusFilter(v)}
                  className={`px-3 py-1.5 rounded-lg text-sm font-semibold transition-colors duration-200 cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 ${on ? "bg-white dark:bg-gray-700 text-indigo-700 dark:text-indigo-300 shadow-sm" : "text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200"}`}
                >
                  {label} <span className="tabular-nums font-normal opacity-70">{loading ? "" : n}</span>
                </button>
              )
            })}
          </div>
          <label className="sr-only" htmlFor="pos-search">ค้นหาตำแหน่ง</label>
          <input
            id="pos-search"
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="ค้นหาชื่อตำแหน่ง"
            className={inputCls + " sm:w-60"}
          />
        </div>
        <button type="button" onClick={openCreate} className={primaryBtn}>
          <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" className="size-4"><path d="M12 5v14M5 12h14" /></svg>
          เพิ่มตำแหน่ง
        </button>
      </div>

      {flash && <Notice tone="success">{flash}</Notice>}

      {!loading && counts.noTier > 0 && (
        <Notice tone="warning">
          มี {counts.noTier} ตำแหน่งที่ยังไม่ได้กำหนดระดับ (กระบอกเงินเดือน) — เจ้าหน้าที่ในตำแหน่งเหล่านี้จะเลื่อนขั้นเงินเดือนไม่ได้จนกว่าจะกำหนดระดับ
        </Notice>
      )}

      {error && <ErrorState message={error} onRetry={fetchPositions} />}

      <div className={cardCls + " overflow-hidden"}>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <caption className="sr-only">รายการตำแหน่งงาน</caption>
            <thead>
              <tr className="border-b border-gray-100 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/30">
                <th scope="col" className={thCls + " text-left"}>ชื่อตำแหน่ง</th>
                <th scope="col" className={thCls + " text-left hidden sm:table-cell"}>ระดับ (กระบอกเงินเดือน)</th>
                <th scope="col" className={thCls + " text-left"}>สถานะ</th>
                <th scope="col" className={thCls + " text-right"}><span className="sr-only">จัดการ</span></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-700/50">
              {loading ? (
                <SkeletonTableRows rows={6} cols={COLS} />
              ) : error ? null : visible.length === 0 ? (
                <tr>
                  <td colSpan={COLS} className="p-0">
                    {positions.length === 0 ? (
                      <EmptyState title="ยังไม่มีตำแหน่งงาน" description="กด “เพิ่มตำแหน่ง” เพื่อสร้างตำแหน่งแรก แล้วกำหนดระดับให้ตรงกับกระบอกเงินเดือน" />
                    ) : (
                      <EmptyState title="ไม่พบตำแหน่งที่ตรงกับตัวกรอง" description="ลองเปลี่ยนคำค้นหาหรือเลือกสถานะ “ทั้งหมด”" />
                    )}
                  </td>
                </tr>
              ) : visible.map((p) => {
                const active = p.is_active !== false
                const tier = tierName(p.position_tier_id)
                return (
                  <tr key={p.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/30 transition-colors">
                    <td className="px-4 py-3">
                      <p className={`font-medium break-words ${active ? "text-gray-900 dark:text-gray-100" : "text-gray-500 dark:text-gray-400"}`}>{p.title}</p>
                      <p className="sm:hidden text-xs mt-0.5 text-gray-500 dark:text-gray-400">{tier ?? "ยังไม่กำหนดระดับ"}</p>
                    </td>
                    <td className="px-4 py-3 hidden sm:table-cell">
                      {tier ? (
                        <span className="text-gray-700 dark:text-gray-300">
                          <span className="tabular-nums text-gray-400 dark:text-gray-500 mr-1.5">{p.position_tier_id}</span>{tier}
                        </span>
                      ) : (
                        <span className="text-amber-700 dark:text-amber-300">ยังไม่กำหนด</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      {active ? <Badge tone="success">ใช้งาน</Badge> : <Badge tone="neutral">ปิดแล้ว</Badge>}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-4 whitespace-nowrap">
                        <button type="button" onClick={() => openEdit(p)} className={linkBtn} aria-label={`แก้ไขตำแหน่ง ${p.title}`}>แก้ไข</button>
                        {active && (
                          <button
                            type="button"
                            onClick={() => openDeactivate(p)}
                            className="text-xs font-semibold text-red-600 dark:text-red-400 hover:underline cursor-pointer rounded focus:outline-none focus-visible:ring-2 focus-visible:ring-red-500 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-gray-800"
                            aria-label={`ปิดใช้งานตำแหน่ง ${p.title}`}
                          >
                            ปิดใช้งาน
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Create / Edit */}
      {form && (
        <HrModal
          title={form.mode === "create" ? "เพิ่มตำแหน่งใหม่" : "แก้ไขตำแหน่ง"}
          onClose={() => setForm(null)}
          busy={saving}
          footer={
            <>
              <button type="button" onClick={() => setForm(null)} disabled={saving} className={secondaryBtn + " flex-1"}>ยกเลิก</button>
              <button type="submit" form="position-form" disabled={saving} className={primaryBtn + " flex-1"}>
                {saving ? "กำลังบันทึก…" : form.mode === "create" ? "เพิ่มตำแหน่ง" : "บันทึก"}
              </button>
            </>
          }
        >
          <form id="position-form" onSubmit={handleSave} className="space-y-3" noValidate>
            <div>
              <label htmlFor="pos-title" className={labelCls}>ชื่อตำแหน่ง <span className="text-red-500" aria-hidden="true">*</span></label>
              <input
                id="pos-title"
                type="text"
                required
                aria-invalid={formError && !form.title.trim() ? "true" : undefined}
                value={form.title}
                onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
                className={inputCls}
                placeholder="เช่น เจ้าหน้าที่การเงิน"
                maxLength={120}
              />
            </div>
            <div>
              <span className={labelCls} id="pos-tier-label">ระดับ (กระบอกเงินเดือน)</span>
              <SelectDropdown
                id="pos-tier"
                ariaLabelledby="pos-tier-label"
                options={TIER_OPTIONS}
                value={form.position_tier_id}
                onChange={(v) => setForm((f) => ({ ...f, position_tier_id: v }))}
                placeholder="— ยังไม่กำหนด —"
              />
              <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                ระดับใช้คำนวณขั้นเงินเดือน ถ้าไม่กำหนด เจ้าหน้าที่ในตำแหน่งนี้จะเลื่อนขั้นไม่ได้
              </p>
            </div>
            {editingInactive && (
              <Notice tone="info">ตำแหน่งนี้ปิดใช้งานแล้ว แก้ชื่อหรือระดับได้ แต่จะมอบหมายให้เจ้าหน้าที่ไม่ได้</Notice>
            )}
            {formError && <Notice tone="error">{formError}</Notice>}
          </form>
        </HrModal>
      )}

      {/* Deactivate confirm */}
      {confirmPos && (
        <HrModal
          title="ปิดใช้งานตำแหน่งนี้?"
          subtitle={confirmPos.title}
          onClose={() => setConfirmPos(null)}
          busy={deactivating}
          footer={
            <>
              <button type="button" data-autofocus onClick={() => setConfirmPos(null)} disabled={deactivating} className={secondaryBtn + " flex-1"}>
                {deactivateError ? "ปิด" : "ยกเลิก"}
              </button>
              <button type="button" onClick={handleDeactivate} disabled={deactivating} className={dangerBtn + " flex-1"}>
                {deactivating ? "กำลังปิดใช้งาน…" : "ปิดใช้งาน"}
              </button>
            </>
          }
        >
          <p className="text-sm text-gray-600 dark:text-gray-300 text-pretty">
            ตำแหน่งที่ปิดแล้วจะเลือกให้เจ้าหน้าที่หรือใช้เป็นตำแหน่งเป้าหมายการสอบไม่ได้ ผู้ที่ดำรงตำแหน่งนี้อยู่แล้วยังคงอยู่ในตำแหน่งเดิม
          </p>
          {deactivateError && <Notice tone="error">{deactivateError}</Notice>}
        </HrModal>
      )}
    </div>
  )
}
