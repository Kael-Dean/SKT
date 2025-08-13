import { useEffect, useMemo, useState } from "react"

const API_BASE = import.meta.env.VITE_API_BASE

const onlyDigits = (s = "") => s.replace(/\D+/g, "")

function useDebounce(value, delay = 400) {
  const [debounced, setDebounced] = useState(value)
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delay)
    return () => clearTimeout(t)
  }, [value, delay])
  return debounced
}

function formatDate(d) {
  if (!d) return "-"
  try {
    const dt = new Date(d)
    if (isNaN(dt.getTime())) return "-"
    return dt.toLocaleDateString("th-TH", { year: "numeric", month: "2-digit", day: "2-digit" })
  } catch {
    return "-"
  }
}

const EDITABLE_COLUMNS = {
  first_name: { label: "ชื่อ", type: "text" },
  last_name: { label: "นามสกุล", type: "text" },
  citizen_id: { label: "เลขบัตรประชาชน", type: "cid" },
  phone_number: { label: "โทรศัพท์", type: "text" },
  province: { label: "จังหวัด", type: "text" },
  tgs_group: { label: "กลุ่ม", type: "number" },
  normal_share: { label: "หุ้นปกติ", type: "number" },
}

const MemberSearch = () => {
  const [q, setQ] = useState("")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")
  const [rows, setRows] = useState([])

  // inline edit states
  const [editId, setEditId] = useState(null) // member_id ที่กำลังแก้
  const [draft, setDraft] = useState({}) // ค่าที่แก้ระหว่างแก้ไข
  const [rowError, setRowError] = useState("") // error รายแถว
  const [saving, setSaving] = useState(false)

  const debouncedQ = useDebounce(q, 450)

  const hint = useMemo(() => {
    const digits = onlyDigits(q)
    if (digits.length === 13) return "ค้นหาตามเลขบัตรประชาชน"
    if (q.trim().includes(" ")) return "ค้นหาตามชื่อและนามสกุล"
    if (q.trim().length >= 2) return "ค้นหาตามชื่อหรือนามสกุล"
    return "พิมพ์ชื่อ/นามสกุล หรือเลขบัตรประชาชน"
  }, [q])

  useEffect(() => {
    const run = async () => {
      setError("")
      setRows([])
      const term = debouncedQ.trim()
      if (!term) return

      setLoading(true)
      try {
        const url = `${API_BASE}/member/members/search?q=${encodeURIComponent(term)}`
        const res = await fetch(url)
        if (!res.ok) throw new Error(await res.text())
        const data = await res.json()
        setRows(Array.isArray(data) ? data : [])
      } catch (e) {
        setError(e?.message || "ค้นหาไม่สำเร็จ")
      } finally {
        setLoading(false)
      }
    }
    run()
  }, [debouncedQ])

  const startEdit = (r) => {
    setEditId(r.member_id)
    // เก็บเฉพาะคอลัมน์ที่แก้ไขได้เป็นค่าเริ่ม
    const initial = {}
    Object.keys(EDITABLE_COLUMNS).forEach((k) => (initial[k] = r[k] ?? ""))
    setDraft(initial)
    setRowError("")
  }

  const cancelEdit = () => {
    setEditId(null)
    setDraft({})
    setSaving(false)
    setRowError("")
  }

  const onChangeField = (key, val) => {
    // บังคับเลข 13 หลักให้ citizen_id และตัวเลขให้ number fields
    const cfg = EDITABLE_COLUMNS[key]
    if (cfg?.type === "cid") {
      val = onlyDigits(val).slice(0, 13)
    } else if (cfg?.type === "number") {
      // อนุญาตทศนิยม
      val = val.replace(/[^\d.]+/g, "")
    }
    setDraft((d) => ({ ...d, [key]: val }))
  }

  const computeDiff = (original, edited) => {
    const diff = {}
    for (const k of Object.keys(EDITABLE_COLUMNS)) {
      const ov = original[k]
      let ev = edited[k]
      // แปลง number
      if (EDITABLE_COLUMNS[k].type === "number") {
        ev = ev === "" ? null : Number(ev)
      }
      if (ov !== ev) diff[k] = ev
    }
    return diff
  }

  const saveRow = async (r) => {
    setRowError("")
    setSaving(true)
    try {
      const diff = computeDiff(r, draft)
      if (Object.keys(diff).length === 0) {
        cancelEdit()
        return
      }

      // optimistic update
      const prevRows = rows
      const nextRows = rows.map((row) =>
        row.member_id === r.member_id ? { ...row, ...diff } : row
      )
      setRows(nextRows)

      const url = `${API_BASE}/member/members/${r.member_id}`
      const res = await fetch(url, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(diff),
      })
      if (!res.ok) {
        const msg = await res.text()
        setRows(prevRows) // rollback
        throw new Error(msg || "บันทึกไม่สำเร็จ")
      }

      // ใช้ข้อมูลจาก server (กันกรณีมีการแก้ไข/normalize เพิ่ม)
      const updated = await res.json()
      setRows((cur) => cur.map((row) => (row.member_id === r.member_id ? updated : row)))
      cancelEdit()
    } catch (e) {
      setRowError(e?.message || "บันทึกไม่สำเร็จ")
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="mx-auto max-w-6xl p-4 md:p-6">
      <h1 className="mb-4 text-2xl font-bold text-white">🔎 ค้นหาสมาชิก</h1>

      <div className="rounded-2xl border border-emerald-200 bg-white p-4 shadow-sm">
        <div className="mb-3">
          <label className="mb-1 block text-sm font-medium text-black">คำค้นหา</label>
          <input
            className="w-full rounded-xl border border-slate-300 p-2 text-black outline-none focus:border-emerald-500"
            placeholder="เช่น สมชาย ใจดี หรือ 1234567890123"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
          <p className="mt-1 text-xs text-slate-500">{hint}</p>
        </div>

        {loading && (
          <div className="mt-4 rounded-xl border border-emerald-100 bg-emerald-50 p-3 text-emerald-700">
            กำลังค้นหา...
          </div>
        )}
        {error && !loading && (
          <div className="mt-4 rounded-xl border border-red-200 bg-red-50 p-3 text-red-700">{error}</div>
        )}

        {!loading && !error && debouncedQ.trim() && (
          <div className="mt-4 overflow-x-auto">
            {rows.length === 0 ? (
              <div className="rounded-xl border border-slate-200 p-4 text-slate-600">
                ไม่พบข้อมูลที่ตรงกับ “{debouncedQ}”
              </div>
            ) : (
              <table className="min-w-full overflow-hidden rounded-xl border border-slate-200 text-left text-sm text-black">
                <thead className="bg-slate-50 text-slate-700">
                  <tr>
                    <th className="px-3 py-2">ชื่อ</th>
                    <th className="px-3 py-2">นามสกุล</th>
                    <th className="px-3 py-2">เลขบัตรประชาชน</th>
                    <th className="px-3 py-2">โทรศัพท์</th>
                    <th className="px-3 py-2">จังหวัด</th>
                    <th className="px-3 py-2">วันที่สมัคร</th>
                    <th className="px-3 py-2">กลุ่ม</th>
                    <th className="px-3 py-2">หุ้นปกติ</th>
                    <th className="px-3 py-2 text-right">การกระทำ</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r) => {
                    const isEditing = editId === r.member_id
                    return (
                      <tr key={r.id ?? r.member_id} className="odd:bg-white even:bg-slate-50 hover:bg-emerald-50">
                        {/* first_name */}
                        <td className="px-3 py-2">
                          {isEditing ? (
                            <input
                              className="w-full rounded border border-slate-300 px-2 py-1"
                              value={draft.first_name ?? ""}
                              onChange={(e) => onChangeField("first_name", e.target.value)}
                            />
                          ) : (
                            r.first_name || "-"
                          )}
                        </td>
                        {/* last_name */}
                        <td className="px-3 py-2">
                          {isEditing ? (
                            <input
                              className="w-full rounded border border-slate-300 px-2 py-1"
                              value={draft.last_name ?? ""}
                              onChange={(e) => onChangeField("last_name", e.target.value)}
                            />
                          ) : (
                            r.last_name || "-"
                          )}
                        </td>
                        {/* citizen_id */}
                        <td className="px-3 py-2 whitespace-nowrap">
                          {isEditing ? (
                            <input
                              className="w-full rounded border border-slate-300 px-2 py-1"
                              value={draft.citizen_id ?? ""}
                              onChange={(e) => onChangeField("citizen_id", e.target.value)}
                              placeholder="13 หลัก"
                            />
                          ) : (
                            r.citizen_id || "-"
                          )}
                        </td>
                        {/* phone_number */}
                        <td className="px-3 py-2">
                          {isEditing ? (
                            <input
                              className="w-full rounded border border-slate-300 px-2 py-1"
                              value={draft.phone_number ?? ""}
                              onChange={(e) => onChangeField("phone_number", e.target.value)}
                            />
                          ) : (
                            r.phone_number || "-"
                          )}
                        </td>
                        {/* province */}
                        <td className="px-3 py-2">
                          {isEditing ? (
                            <input
                              className="w-full rounded border border-slate-300 px-2 py-1"
                              value={draft.province ?? ""}
                              onChange={(e) => onChangeField("province", e.target.value)}
                            />
                          ) : (
                            r.province || "-"
                          )}
                        </td>
                        {/* regis_date (read-only) */}
                        <td className="px-3 py-2">{formatDate(r.regis_date)}</td>
                        {/* tgs_group */}
                        <td className="px-3 py-2">
                          {isEditing ? (
                            <input
                              className="w-28 rounded border border-slate-300 px-2 py-1"
                              value={draft.tgs_group ?? ""}
                              onChange={(e) => onChangeField("tgs_group", e.target.value)}
                            />
                          ) : (
                            r.tgs_group ?? "-"
                          )}
                        </td>
                        {/* normal_share */}
                        <td className="px-3 py-2">
                          {isEditing ? (
                            <input
                              className="w-28 rounded border border-slate-300 px-2 py-1"
                              value={draft.normal_share ?? ""}
                              onChange={(e) => onChangeField("normal_share", e.target.value)}
                            />
                          ) : (
                            r.normal_share ?? "-"
                          )}
                        </td>
                        {/* actions */}
                        <td className="px-3 py-2 text-right">
                          {isEditing ? (
                            <div className="flex items-center justify-end gap-2">
                              <button
                                className="rounded-lg bg-emerald-600 px-3 py-1 text-white hover:bg-emerald-700 disabled:opacity-60"
                                onClick={() => saveRow(r)}
                                disabled={saving}
                              >
                                {saving ? "กำลังบันทึก..." : "บันทึก"}
                              </button>
                              <button
                                className="rounded-lg bg-slate-200 px-3 py-1 text-slate-700 hover:bg-slate-300"
                                onClick={cancelEdit}
                                disabled={saving}
                              >
                                ยกเลิก
                              </button>
                            </div>
                          ) : (
                            <button
                              className="rounded-lg bg-emerald-50 px-3 py-1 text-emerald-700 hover:bg-emerald-100"
                              onClick={() => startEdit(r)}
                            >
                              แก้ไข
                            </button>
                          )}
                          {isEditing && rowError && (
                            <div className="mt-2 text-xs text-red-600">{rowError}</div>
                          )}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

export default MemberSearch
