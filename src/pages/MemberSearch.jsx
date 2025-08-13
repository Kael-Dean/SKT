import { useEffect, useMemo, useState } from "react"

const API_BASE = import.meta.env.VITE_API_BASE

const onlyDigits = (s = "") => s.replace(/\D+/g, "")
const toISO = (d) => (d ? new Date(d).toISOString() : null)

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

/** ฟิลด์ทั้งหมด (ตรงกับ MemberSignup + Backend) */
const FIELD_CONFIG = [
  { key: "member_id", label: "เลขสมาชิก", type: "number" },
  { key: "precode", label: "คำนำหน้า (รหัส)", type: "number" },
  { key: "first_name", label: "ชื่อ", type: "text" },
  { key: "last_name", label: "นามสกุล", type: "text" },
  { key: "citizen_id", label: "เลขบัตรประชาชน", type: "cid" },
  { key: "sex", label: "เพศ (M/F)", type: "select", options: ["", "M", "F"] },
  { key: "phone_number", label: "โทรศัพท์", type: "text" },
  { key: "address", label: "ที่อยู่", type: "text" },
  { key: "mhoo", label: "หมู่", type: "text" },
  { key: "sub_district", label: "ตำบล", type: "text" },
  { key: "district", label: "อำเภอ", type: "text" },
  { key: "province", label: "จังหวัด", type: "text" },
  { key: "postal_code", label: "รหัสไปรษณีย์", type: "number" },
  { key: "subprov", label: "อำเภอย่อย/รหัสอำเภอ", type: "number" },
  { key: "salary", label: "เงินเดือน", type: "decimal" },
  { key: "tgs_group", label: "กลุ่ม", type: "number" },
  { key: "share_per_month", label: "ส่งหุ้น/เดือน", type: "decimal" },
  { key: "ar_limit", label: "วงเงินสินเชื่อ", type: "number" },
  { key: "normal_share", label: "หุ้นปกติ", type: "decimal" },
  { key: "bank_account", label: "บัญชีธนาคาร", type: "text" },
  { key: "tgs_id", label: "รหัสสมาชิกในระบบ (tgs_id)", type: "text" },
  { key: "spouce_name", label: "ชื่อคู่สมรส", type: "text" },
  { key: "orders_placed", label: "จำนวนครั้งที่ซื้อ", type: "number" },

  // วันที่ 3 รายการ (อ่าน/แก้ไขได้)
  { key: "regis_date", label: "วันที่สมัคร", type: "date" },
  { key: "last_bought_date", label: "วันที่ซื้อครั้งล่าสุด", type: "date" },
  { key: "transfer_date", label: "วันที่โอน (ไม่ระบุก็ได้)", type: "date-optional" },
]

// คอลัมน์สั้นๆ ในตารางหลัก
const TABLE_COLUMNS = [
  { key: "first_name", label: "ชื่อ" },
  { key: "last_name", label: "นามสกุล" },
  { key: "citizen_id", label: "เลขบัตรประชาชน" },
  { key: "phone_number", label: "โทรศัพท์" },
  { key: "province", label: "จังหวัด" },
  { key: "regis_date", label: "วันที่สมัคร", render: (v) => formatDate(v) },
]

const MemberSearch = () => {
  const [q, setQ] = useState("")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")
  const [rows, setRows] = useState([])

  const debouncedQ = useDebounce(q, 450)

  // Drawer state
  const [open, setOpen] = useState(false)
  const [active, setActive] = useState(null) // แถวที่เลือก (object เต็ม)
  const [draft, setDraft] = useState(null) // แบบแก้ไข
  const [editing, setEditing] = useState(false)
  const [saving, setSaving] = useState(false)
  const [rowError, setRowError] = useState("")

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

  const openDrawer = (row) => {
    setActive(row)
    // draft เริ่มจากทุกฟิลด์
    const init = {}
    FIELD_CONFIG.forEach(({ key }) => (init[key] = row[key] ?? (key.includes("date") ? "" : "")))
    // แปลงวันที่ให้เป็น yyyy-mm-dd ถ้าแก้ไขได้สะดวก
    ;["regis_date", "last_bought_date", "transfer_date"].forEach((k) => {
      if (row[k]) {
        try {
          const d = new Date(row[k])
          if (!isNaN(d.getTime())) init[k] = d.toISOString().slice(0, 10)
        } catch {}
      }
    })
    setDraft(init)
    setRowError("")
    setEditing(false)
    setOpen(true)
  }

  const closeDrawer = () => {
    setOpen(false)
    setActive(null)
    setDraft(null)
    setEditing(false)
    setSaving(false)
    setRowError("")
  }

  const onChangeField = (key, val) => {
    const cfg = FIELD_CONFIG.find((f) => f.key === key)
    if (!cfg) return
    if (cfg.type === "cid") {
      val = onlyDigits(val).slice(0, 13)
    } else if (cfg.type === "number") {
      val = onlyDigits(val)
    } else if (cfg.type === "decimal") {
      val = val.replace(/[^\d.]/g, "")
    }
    setDraft((d) => ({ ...d, [key]: val }))
  }

  const computeDiff = (original, edited) => {
    const diff = {}
    FIELD_CONFIG.forEach(({ key, type }) => {
      let ov = original[key]
      let ev = edited[key]

      // ย้อนแปลงรูปแบบวันจาก yyyy-mm-dd เป็น ISO ให้ backend
      if (type === "date" || type === "date-optional") {
        ev = ev ? toISO(ev) : null
      }

      // ตัวเลข
      if (type === "number") {
        ev = ev === "" || ev === null ? null : Number(ev)
      }
      if (type === "decimal") {
        ev = ev === "" || ev === null ? null : Number(ev)
      }

      if (ov !== ev) diff[key] = ev
    })
    return diff
  }

  const save = async () => {
    if (!active) return
    setRowError("")
    setSaving(true)
    try {
      // สร้าง original ที่ normalize วันที่เป็น ISO ก่อนเทียบ
      const original = { ...active }
      ;["regis_date", "last_bought_date", "transfer_date"].forEach((k) => {
        if (original[k]) {
          try {
            original[k] = toISO(original[k])
          } catch {}
        } else {
          original[k] = null
        }
      })

      const diff = computeDiff(original, draft)

      if (Object.keys(diff).length === 0) {
        setEditing(false)
        setSaving(false)
        return
      }

      // optimistic update ในตารางหลัก
      const prevRows = rows
      const optimistic = rows.map((r) =>
        r.member_id === active.member_id ? { ...r, ...diff } : r
      )
      setRows(optimistic)

      const res = await fetch(`${API_BASE}/member/members/${active.member_id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(diff),
      })

      if (!res.ok) {
        const msg = await res.text()
        setRows(prevRows) // rollback
        throw new Error(msg || "บันทึกไม่สำเร็จ")
      }

      const updated = await res.json()
      // อัปเดตทั้งตารางและ active/draft จากข้อมูลจริงของ server
      setRows((cur) => cur.map((r) => (r.member_id === updated.member_id ? updated : r)))
      setActive(updated)

      const nextDraft = {}
      FIELD_CONFIG.forEach(({ key }) => (nextDraft[key] = updated[key] ?? ""))
      ;["regis_date", "last_bought_date", "transfer_date"].forEach((k) => {
        if (updated[k]) {
          try {
            const d = new Date(updated[k])
            if (!isNaN(d.getTime())) nextDraft[k] = d.toISOString().slice(0, 10)
          } catch {}
        } else nextDraft[k] = ""
      })
      setDraft(nextDraft)
      setEditing(false)
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
                    {TABLE_COLUMNS.map((c) => (
                      <th key={c.key} className="px-3 py-2">
                        {c.label}
                      </th>
                    ))}
                    <th className="px-3 py-2 text-right">การกระทำ</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r) => (
                    <tr key={r.id ?? r.member_id} className="odd:bg-white even:bg-slate-50 hover:bg-emerald-50">
                      {TABLE_COLUMNS.map((c) => (
                        <td key={c.key} className="px-3 py-2">
                          {c.render ? c.render(r[c.key]) : r[c.key] ?? "-"}
                        </td>
                      ))}
                      <td className="px-3 py-2 text-right">
                        <button
                          className="rounded-lg bg-emerald-50 px-3 py-1 text-emerald-700 hover:bg-emerald-100"
                          onClick={() => openDrawer(r)}
                        >
                          ดูรายละเอียด
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        )}
      </div>

      {/* Drawer / Side Panel */}
      <div
        className={`fixed inset-0 z-50 transition ${open ? "pointer-events-auto" : "pointer-events-none"}`}
        aria-hidden={!open}
      >
        {/* backdrop */}
        <div
          className={`absolute inset-0 bg-black/40 transition-opacity ${open ? "opacity-100" : "opacity-0"}`}
          onClick={closeDrawer}
        />
        {/* panel */}
        <div
          className={`absolute right-0 top-0 h-full w-full max-w-xl transform bg-white shadow-2xl transition-transform ${
            open ? "translate-x-0" : "translate-x-full"
          }`}
        >
          <div className="flex items-center justify-between border-b px-4 py-3">
            <div className="text-lg font-semibold">
              {active ? `รายละเอียดสมาชิก #${active.member_id}` : "รายละเอียดสมาชิก"}
            </div>
            <button
              className="rounded-lg border px-3 py-1 text-slate-700 hover:bg-slate-50"
              onClick={closeDrawer}
            >
              ปิด
            </button>
          </div>

          <div className="h-[calc(100%-56px)] overflow-y-auto p-4">
            {!active ? (
              <div className="text-slate-500">ไม่มีข้อมูล</div>
            ) : (
              <>
                <div className="mb-3 flex items-center justify-between">
                  <div className="text-sm text-slate-500">
                    สร้างเมื่อ: {formatDate(active.regis_date)} | ซื้อครั้งล่าสุด: {formatDate(active.last_bought_date)}
                  </div>
                  {!editing ? (
                    <button
                      className="rounded-lg bg-emerald-600 px-3 py-1 text-white hover:bg-emerald-700"
                      onClick={() => setEditing(true)}
                    >
                      แก้ไข
                    </button>
                  ) : (
                    <div className="flex gap-2">
                      <button
                        className="rounded-lg bg-emerald-600 px-3 py-1 text-white hover:bg-emerald-700 disabled:opacity-60"
                        onClick={save}
                        disabled={saving}
                      >
                        {saving ? "กำลังบันทึก..." : "บันทึก"}
                      </button>
                      <button
                        className="rounded-lg bg-slate-200 px-3 py-1 text-slate-700 hover:bg-slate-300"
                        onClick={() => {
                          setEditing(false)
                          // รีเซ็ต draft กลับจาก active
                          const reset = {}
                          FIELD_CONFIG.forEach(({ key }) => (reset[key] = active[key] ?? ""))
                          ;["regis_date", "last_bought_date", "transfer_date"].forEach((k) => {
                            if (active[k]) {
                              try {
                                const d = new Date(active[k])
                                if (!isNaN(d.getTime())) reset[k] = d.toISOString().slice(0, 10)
                              } catch {}
                            } else reset[k] = ""
                          })
                          setDraft(reset)
                          setRowError("")
                        }}
                      >
                        ยกเลิก
                      </button>
                    </div>
                  )}
                </div>

                {rowError && (
                  <div className="mb-3 rounded-lg border border-red-200 bg-red-50 p-2 text-sm text-red-700">
                    {rowError}
                  </div>
                )}

                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                  {FIELD_CONFIG.map((f) => {
                    const val = editing ? draft?.[f.key] ?? "" : active?.[f.key]
                    return (
                      <div key={f.key}>
                        <label className="mb-1 block text-xs font-medium text-slate-600">{f.label}</label>
                        {!editing ? (
                          <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm">
                            {f.type === "date" || f.type === "date-optional"
                              ? formatDate(val)
                              : (val ?? "-")}
                          </div>
                        ) : f.type === "select" ? (
                          <select
                            className="w-full rounded-lg border border-slate-300 px-3 py-2"
                            value={val ?? ""}
                            onChange={(e) => onChangeField(f.key, e.target.value)}
                          >
                            {f.options.map((op) => (
                              <option key={op} value={op}>
                                {op === "" ? "— เลือก —" : op}
                              </option>
                            ))}
                          </select>
                        ) : f.type === "date" || f.type === "date-optional" ? (
                          <input
                            type="date"
                            className="w-full rounded-lg border border-slate-300 px-3 py-2"
                            value={val ?? ""}
                            onChange={(e) => onChangeField(f.key, e.target.value)}
                          />
                        ) : (
                          <input
                            className="w-full rounded-lg border border-slate-300 px-3 py-2"
                            value={val ?? ""}
                            onChange={(e) => onChangeField(f.key, e.target.value)}
                            placeholder={f.type === "cid" ? "13 หลัก" : ""}
                          />
                        )}
                      </div>
                    )
                  })}
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

export default MemberSearch
