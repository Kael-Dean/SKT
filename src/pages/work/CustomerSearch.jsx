// src/pages/CustomerSearch.jsx
import { useEffect, useMemo, useState } from "react"
import { apiAuth } from "../../lib/api"
import {
  SkeletonTableRows,
  SkeletonText,
  ErrorState,
  EmptyState,
  Sheet,
  SearchField,
  DataList,
  toast,
} from "../../components/ui"
import ComboBox from "../../components/ComboBox"
import { useIsPhone } from "../../hooks/useMediaQuery"
import {
  cx,
  baseField,
  readonlyFieldCls,
  labelCls,
  neutralBtnCls,
  secondaryBtnCls,
  submitBtnCls,
  spinnerCls,
} from "../../lib/styles"
import PageTitle from "../../components/PageTitle"

/** ไอคอนแว่นขยาย (inline SVG — currentColor, ไม่มี emoji) */
function SearchIcon({ className = "size-5" }) {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      <circle cx="11" cy="11" r="8" />
      <path d="m21 21-4.3-4.3" />
    </svg>
  )
}

/** ---------- Utils ---------- */
const onlyDigits = (s = "") => s.replace(/\D+/g, "")

/** debounce */
function useDebounce(value, delay = 400) {
  const [debounced, setDebounced] = useState(value)
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delay)
    return () => clearTimeout(t)
  }, [value, delay])
  return debounced
}

/** แสดงวันที่แบบไทย (สำรองเผื่ออนาคต) */
function formatDate(v) {
  if (!v) return "-"
  try {
    const d = new Date(v)
    if (isNaN(d)) return "-"
    return d.toLocaleDateString("th-TH", { day: "2-digit", month: "2-digit", year: "numeric" })
  } catch {
    return "-"
  }
}

/** ---------- ค่าคำนำหน้า + sex ---------- */
const PREFIX_OPTIONS = [
  { value: "", label: "— เลือก —" },
  { value: "1", label: "นาย" },
  { value: "2", label: "นาง" },
  { value: "3", label: "นางสาว" },
]
const sexFromPrefix = (pre) => (pre === "1" ? "M" : pre === "2" || pre === "3" ? "F" : "")
const SEX_LABEL = { M: "ชาย", F: "หญิง" }

/** แสดงข้อความจาก backend เฉพาะเมื่อเป็นภาษาไทยแล้ว ไม่งั้นใช้ข้อความกลาง */
const friendly = (e, fallback) => (/[฀-๿]/.test(e?.message || "") ? e.message : fallback)

/** ---------- ฟิลด์ของ "ลูกค้าทั่วไป" ตามฝั่ง BE ---------- */
const CUSTOMER_FIELD_KEYS = [
  "precode", "sex",
  "first_name", "last_name", "citizen_id", "phone_number",
  "address", "mhoo", "sub_district", "district", "province", "postal_code",
  "fid", "fid_owner", "fid_relationship",
]

/** ทำให้เรคคอร์ดจาก BE "ครบคีย์" และสะอาด */
function normalizeCustomerRecord(raw = {}) {
  const out = {
    asso_id: raw.asso_id ?? raw.assoId ?? raw.id ?? null,

    precode: raw.precode != null ? String(raw.precode) : null,
    // เพศมาจาก API (M/F คำนวณจากคำนำหน้าฝั่ง backend) — ไม่มีค่อยเดาจากคำนำหน้า (handoff F14)
    sex: raw.sex || sexFromPrefix(raw.precode != null ? String(raw.precode) : "") || "",

    first_name: raw.first_name ?? raw.firstname ?? "",
    last_name:  raw.last_name  ?? raw.lastname  ?? "",
    citizen_id: onlyDigits(raw.citizen_id ?? raw.citizenId ?? "") || null,

    phone_number: raw.phone_number ?? raw.phone ?? "",

    address: raw.address ?? "",
    mhoo: raw.mhoo ?? raw.moo ?? "",
    sub_district: raw.sub_district ?? raw.subdistrict ?? "",
    district: raw.district ?? "",
    province: raw.province ?? "",
    postal_code: raw.postal_code ?? raw.postalCode ?? "",

    // ✅ เก็บเป็น string/null เพื่อให้ UI และ diff ทำงานถูกต้อง
    fid: raw.fid != null ? String(raw.fid) : null,
    fid_owner: raw.fid_owner ?? "",
    fid_relationship: raw.fid_relationship ?? null,

    // null = ลูกค้าที่สร้างก่อน 14 ต.ค. 2026 (ไม่มีบันทึกวันที่) → แสดง "-"
    created_at: raw.created_at ?? null,
  }

  // เติมให้ครบคีย์
  CUSTOMER_FIELD_KEYS.forEach((k) => {
    if (!(k in out)) out[k] = ""
  })
  return out
}

/** ---------- คอลัมน์ตาราง ---------- */
const TABLE_COLUMNS = [
  { key: "first_name",   label: "ชื่อ",              render: (row) => row.first_name || "-" },
  { key: "last_name",    label: "นามสกุล",          render: (row) => row.last_name || "-" },
  { key: "citizen_id",   label: "เลขบัตรประชาชน",   render: (row) => row.citizen_id || "-" },
  { key: "phone_number", label: "โทรศัพท์",          render: (row) => row.phone_number || "-" },
  { key: "province",     label: "จังหวัด",           render: (row) => row.province || "-" },
  { key: "district",     label: "อำเภอ",             render: (row) => row.district || "-" },
]

const fullName = (r) => [r?.first_name, r?.last_name].filter(Boolean).join(" ").trim()

/** ---------- ตัวแผนที่ id -> ข้อความความสัมพันธ์ FID + options ---------- */
function useFIDRelationshipMap() {
  const [map, setMap] = useState({})
  useEffect(() => {
    const run = async () => {
      try {
        const rows = await apiAuth("/member/members/fid_relationship") // [{ id, fid_relationship }]
        const m = {}
        ;(Array.isArray(rows) ? rows : []).forEach((r) => {
          if (r?.id != null) m[r.id] = r?.fid_relationship ?? String(r.id)
        })
        setMap(m)
      } catch {
        // ถ้าดึงไม่ได้ ให้โชว์เป็นตัวเลขเดิม
      }
    }
    run()
  }, [])
  return map
}
function useFIDRelationshipOptions(fidMap) {
  return useMemo(
    () =>
      Object.entries(fidMap || {}).map(([id, label]) => ({
        value: String(id),
        label: String(label),
      })),
    [fidMap]
  )
}

/** ---------- PATCH helper: ใช้ endpoint เดียวเพื่อตัด 404 ---------- */
async function patchCustomer(id, body) {
  return await apiAuth(`/member/customers/${id}`, { method: "PATCH", body })
}

/** ช่องแสดงผล/แก้ไข 1 ฟิลด์ใน Sheet (label + read-only หรือ input) */
function Field({ label, editing, display, children, className = "" }) {
  return (
    <div className={className}>
      <span className={labelCls}>{label}</span>
      {editing ? children : <div className={cx(readonlyFieldCls, "min-h-12 break-words")}>{display || "-"}</div>}
    </div>
  )
}

/** ---------- หน้าค้นหา ลูกค้าทั่วไป (แก้ไขได้) ---------- */
const CustomerSearch = () => {
  const isPhone = useIsPhone()
  const [q, setQ] = useState("")
  const dq = useDebounce(q, 450)

  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")
  const [reloadKey, setReloadKey] = useState(0)   // ↻ สำหรับปุ่ม "ลองใหม่"

  // detail sheet
  const [open, setOpen] = useState(false)
  const [active, setActive] = useState(null)   // normalized row (ของจริง)
  const [draft, setDraft] = useState(null)     // ค่าที่แก้ไขอยู่
  const [editing, setEditing] = useState(false)
  const [saving, setSaving] = useState(false)
  const [rowError, setRowError] = useState("")

  // FID relationship
  const fidMap = useFIDRelationshipMap()
  const fidOptions = useFIDRelationshipOptions(fidMap)

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
      const term = dq.trim()
      if (!term) return
      setLoading(true)
      try {
        // ✅ เรียก BE: /member/customer/search?q=...
        const data = await apiAuth(`/member/customer/search?q=${encodeURIComponent(term)}`)
        const normalized = (Array.isArray(data) ? data : []).map(normalizeCustomerRecord)
        setRows(normalized)
      } catch (e) {
        setError(friendly(e, "ค้นหาไม่สำเร็จ ลองใหม่อีกครั้ง"))
      } finally {
        setLoading(false)
      }
    }
    run()
  }, [dq, reloadKey])

  const draftFrom = (r) => {
    const d = {}
    CUSTOMER_FIELD_KEYS.forEach((key) => {
      let v = r[key]
      if (key === "citizen_id") v = onlyDigits(String(v || "")).slice(0, 13)
      else if (["postal_code", "precode", "fid_relationship"].includes(key)) v = v == null ? "" : String(v)
      else v = v ?? ""
      d[key] = v
    })
    // ล็อก sex จาก precode (กรณีไม่มีในข้อมูลเดิม)
    d.sex = sexFromPrefix(d.precode) || d.sex || ""
    return d
  }

  const openModal = (row, { edit = false } = {}) => {
    const r = normalizeCustomerRecord(row)
    setActive(r)
    setDraft(draftFrom(r))
    setRowError("")
    setEditing(edit)
    setOpen(true)
  }

  const closeModal = () => {
    setOpen(false)
    setActive(null)
    setDraft(null)
    setEditing(false)
    setSaving(false)
    setRowError("")
  }

  const cancelEdit = () => {
    if (!active) return
    setDraft(draftFrom(active))
    setRowError("")
    setEditing(false)
  }

  const onChangeField = (key, val) => {
    if (!draft) return
    if (key === "citizen_id") val = onlyDigits(val).slice(0, 13)
    // ❌ เดิม: บังคับ digits ให้รวม 'fid' → ทำให้พิมพ์อักษรไม่ได้
    // ✅ ใหม่: เอา 'fid' ออก ให้เป็นข้อความอิสระ
    if (["postal_code", "precode", "fid_relationship"].includes(key)) val = onlyDigits(String(val))
    // เปลี่ยน precode ⇒ อัปเดต sex อัตโนมัติ
    if (key === "precode") {
      const sx = sexFromPrefix(val)
      setDraft((p) => ({ ...p, precode: val, sex: sx }))
    } else {
      setDraft((p) => ({ ...p, [key]: val }))
    }
  }

  // บันทึก: สร้าง diff เฉพาะฟิลด์ที่เปลี่ยน และส่ง PATCH
  const save = async () => {
    if (!active || !draft) return
    setRowError("")
    setSaving(true)
    try {
      const diff = {}
      const keysToCheck = [...CUSTOMER_FIELD_KEYS]

      keysToCheck.forEach((key) => {
        let newV = draft[key]
        let oldV = active[key]

        // แปลงประเภทค่าก่อนเทียบ (ให้เข้ารูปแบบที่ BE ใช้)
        if (key === "citizen_id") {
          newV = onlyDigits(newV || "") || null
          oldV = onlyDigits(oldV || "") || null
        } else if (["postal_code", "precode", "fid_relationship"].includes(key)) {
          newV = newV === "" || newV == null ? null : Number(newV)
          oldV = oldV === "" || oldV == null ? null : Number(oldV)
        } else if (key === "fid") {
          // ✅ สำคัญ: FID เป็นสตริงเสมอ (ถ้าว่างให้เป็น null)
          newV = newV === "" || newV == null ? null : String(newV).trim()
          oldV = oldV === "" || oldV == null ? null : String(oldV).trim()
        } else {
          newV = newV ?? ""
          oldV = oldV ?? ""
        }

        if (oldV !== newV) diff[key] = newV
      })

      // เลขบัตรไม่บังคับ (ว่าง = null) แต่ถ้ากรอกต้องครบ 13 หลัก — api-handoff-4 §3
      if (diff.citizen_id != null && String(diff.citizen_id).length !== 13) {
        throw new Error("เลขบัตรประชาชนต้องครบ 13 หลัก หรือเว้นว่างไว้")
      }

      const idForPatch = active.asso_id ?? active.id
      if (!idForPatch && idForPatch !== 0) throw new Error("ไม่พบข้อมูลลูกค้ารายนี้ในระบบ จึงบันทึกการแก้ไขไม่ได้")

      // optimistic update
      setRows((cur) => cur.map((x) => ((x.asso_id ?? x.id) === idForPatch ? { ...x, ...diff } : x)))

      // เรียก PATCH
      const updatedRaw = await patchCustomer(idForPatch, diff)
      const updated = normalizeCustomerRecord(updatedRaw)

      // sync กลับเข้าตาราง + active + draft
      setRows((cur) => cur.map((x) => ((x.asso_id ?? x.id) === idForPatch ? updated : x)))
      setActive(updated)
      setDraft(draftFrom(updated))

      setEditing(false)
      toast.success("บันทึกแล้ว", { description: fullName(updated) || undefined })
    } catch (e) {
      setRowError(friendly(e, "บันทึกไม่สำเร็จ ลองใหม่อีกครั้ง"))
      toast.error("บันทึกไม่สำเร็จ", { description: friendly(e, "ข้อมูลที่แก้ยังอยู่ ลองบันทึกใหม่อีกครั้ง") })
    } finally {
      setSaving(false)
    }
  }

  const loaderCols = TABLE_COLUMNS.length + 1 // + Actions column

  /** ---------- states (ใช้ร่วม table ≥md / DataList <md) ---------- */
  const idleState = (
    <EmptyState
      icon={<SearchIcon className="size-12" />}
      title="ค้นหาลูกค้าทั่วไป"
      description="พิมพ์ชื่อ นามสกุล หรือเลขบัตรประชาชน"
    />
  )
  const notFoundState = (
    <EmptyState
      title={`ไม่พบลูกค้าที่ตรงกับ "${dq}"`}
      description="ลองพิมพ์แค่บางส่วนของชื่อ"
      action={
        <button type="button" onClick={() => setQ("")} className={neutralBtnCls}>
          ล้างคำค้นหา
        </button>
      }
    />
  )

  const inputCls = cx(baseField, "min-h-12")
  const sheetTitle = active ? fullName(active) || "รายละเอียดลูกค้า" : "รายละเอียดลูกค้า"

  const sheetFooter = active ? (
    editing ? (
      <div className="grid grid-cols-2 gap-3 md:flex md:justify-end md:gap-2">
        <button type="button" onClick={cancelEdit} disabled={saving} className={cx(neutralBtnCls, "h-12 md:h-10")}>
          ยกเลิก
        </button>
        <button
          type="button"
          onClick={save}
          disabled={saving}
          aria-busy={saving || undefined}
          className={cx(submitBtnCls, "h-12 md:h-10 !py-0 !text-sm hover:!scale-100")}
        >
          {saving && <span className={spinnerCls} aria-hidden="true" />}
          {saving ? "กำลังบันทึก…" : "บันทึก"}
        </button>
      </div>
    ) : (
      <div className="grid grid-cols-2 gap-3 md:flex md:justify-end md:gap-2">
        <button type="button" onClick={closeModal} className={cx(neutralBtnCls, "h-12 md:h-10")}>
          ปิด
        </button>
        <button type="button" onClick={() => setEditing(true)} className={cx(secondaryBtnCls, "h-12 md:h-10 !py-0 !text-sm")}>
          แก้ไข
        </button>
      </div>
    )
  ) : null

  return (
    <div className="min-h-screen rounded-2xl bg-white text-black dark:bg-slate-900 dark:text-white">
      <div className="w-full p-4 md:p-6 text-base md:text-lg">
        <PageTitle title="ค้นหาลูกค้าทั่วไป" />

        {/* การ์ดค้นหา */}
        <div className="rounded-2xl border border-slate-200/60 bg-white/85 p-4 md:p-6 shadow-sm dark:border-white/10 dark:bg-slate-900/40">
          <label htmlFor="customer-search-q" className="mb-2 block text-sm md:text-base text-slate-700 dark:text-slate-300">คำค้นหา</label>
          {/* ผลลัพธ์แสดงใน DataList/ตารางด้านล่าง ไม่ใช่ dropdown → open={false} */}
          <SearchField
            id="customer-search-q"
            value={q}
            onChange={setQ}
            open={false}
            loading={loading}
            minChars={1}
            placeholder="ค้นหาตามชื่อหรือนามสกุล หรือเลขบัตรประชาชน"
            ariaLabel="ค้นหาลูกค้าทั่วไป"
          />
          <div className="mt-2 text-sm text-slate-500 dark:text-slate-400" aria-live="polite">
            {dq ? (loading ? <>กำลังค้นหา "{dq}"…</> : <>พบ {rows.length.toLocaleString()} รายการ</>) : <>พิมพ์อย่างน้อย 1 ตัวอักษร</>}
          </div>
          {hint && !loading && dq && (
            <div className="mt-1 text-sm text-slate-500 dark:text-slate-400">{hint}</div>
          )}
          {error && (
            <ErrorState
              className="mt-3"
              message={error}
              onRetry={() => setReloadKey((k) => k + 1)}
            />
          )}
        </div>

        {/* ผลลัพธ์: <md = การ์ด (DataList) · ≥md = ตารางเดิม */}
        {isPhone ? (
          <div className="mt-4">
            {!error && (
              !dq ? (
                <div className="rounded-2xl bg-white ring-1 ring-gray-200/70 dark:bg-gray-800 dark:ring-gray-700/70">{idleState}</div>
              ) : (
                <DataList
                  items={rows}
                  keyOf={(r, i) => r.asso_id ?? r.citizen_id ?? i}
                  loading={loading}
                  skeletonRows={4}
                  emptyState={<div className="rounded-2xl bg-white ring-1 ring-gray-200/70 dark:bg-gray-800 dark:ring-gray-700/70">{notFoundState}</div>}
                  title={(r) => fullName(r) || "-"}
                  subtitle={(r) => <span className="tabular-nums">{r.citizen_id || "-"}</span>}
                  fields={[
                    { label: "โทรศัพท์", value: (r) => <span className="tabular-nums">{r.phone_number || "-"}</span> },
                    { label: "อำเภอ/จังหวัด", value: (r) => [r.district, r.province].filter(Boolean).join(", ") || "-" },
                  ]}
                  onClick={(r) => openModal(r)}
                  actions={(r) => (
                    <button type="button" onClick={() => openModal(r, { edit: true })} className={cx(secondaryBtnCls, "h-11 !py-0 !text-sm")}>
                      แก้ไข
                    </button>
                  )}
                />
              )
            )}
          </div>
        ) : (
          <div className="mt-5 rounded-2xl border border-slate-200/60 bg-white/85 shadow-sm dark:border-white/10 dark:bg-slate-900/40">
            <div className="overflow-x-auto rounded-2xl">
              <table className="w-full text-base tabular-nums">
                {/* sticky top-0: อยู่ใน overflow-x-auto wrapper (scroll container) — top-(--topbar-h) จะลอยทับแถวแรก */}
                <thead className="text-slate-700 dark:text-slate-100">
                  <tr className="sticky top-0 z-10 bg-slate-50/95 supports-[backdrop-filter]:bg-slate-50/60 dark:bg-slate-700/60">
                    {TABLE_COLUMNS.map((c) => (
                      <th key={c.key} className="whitespace-nowrap px-5 py-4 text-left text-[15px] md:text-base font-semibold">
                        {c.label}
                      </th>
                    ))}
                    <th className="px-5 py-4 text-right text-[15px] md:text-base font-semibold whitespace-nowrap min-w-[132px]">
                      การกระทำ
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200/70 dark:divide-white/8">
                  {loading && <SkeletonTableRows rows={8} cols={loaderCols} />}

                  {/* ก่อนเริ่มค้นหา — สอนขั้นตอนถัดไป */}
                  {!loading && !error && !dq && (
                    <tr>
                      <td colSpan={loaderCols} className="p-0">{idleState}</td>
                    </tr>
                  )}

                  {/* ค้นหาแล้วแต่ไม่พบผลลัพธ์ */}
                  {!loading && !error && dq && rows.length === 0 && (
                    <tr>
                      <td colSpan={loaderCols} className="p-0">{notFoundState}</td>
                    </tr>
                  )}

                  {!loading &&
                    rows.map((r, i) => (
                      <tr
                        key={r.asso_id ?? r.citizen_id ?? `row-${i}`}
                        className="odd:bg-white/90 even:bg-slate-50/70 hover:bg-emerald-50/70 dark:odd:bg-slate-800/40 dark:even:bg-slate-800/25 dark:hover:bg-emerald-400/10 transition-colors"
                      >
                        {TABLE_COLUMNS.map((c) => (
                          <td key={c.key} className="px-5 py-4">
                            {c.render ? c.render(r) : (r[c.key] ?? "-")}
                          </td>
                        ))}
                        <td className="px-5 py-4 text-right">
                          <button
                            type="button"
                            onClick={() => openModal(r)}
                            className="whitespace-nowrap rounded-2xl bg-emerald-600/90 px-4 py-2 text-sm md:text-base font-semibold text-white shadow-sm ring-1 ring-emerald-700/50 hover:bg-emerald-600 active:scale-[.98] dark:bg-emerald-500/85 dark:hover:bg-emerald-500 cursor-pointer"
                          >
                            ดูรายละเอียด
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

      {/* รายละเอียดลูกค้า — Sheet (bottom sheet <md / dialog ≥md), portal + focus trap */}
      <Sheet
        open={open}
        onClose={closeModal}
        title={sheetTitle}
        subtitle={active?.citizen_id ? `เลขบัตร ${active.citizen_id}` : undefined}
        size="lg"
        busy={saving}
        footer={sheetFooter}
      >
        {!active || !draft ? (
          <SkeletonText lines={6} />
        ) : (
          <div className="text-base">
            <p className="mb-4 text-sm text-slate-600 dark:text-slate-300">
              วันที่สร้างข้อมูล: {formatDate(active.created_at)}
            </p>

            {rowError && (
              <div role="alert" className="mb-4 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700 dark:border-red-400/60 dark:bg-red-900/20 dark:text-red-200">
                {rowError}
              </div>
            )}

            {/* ข้อมูลหลัก */}
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <Field label="ชื่อ" editing={editing} display={active.first_name}>
                <input aria-label="ชื่อ" className={inputCls} value={draft.first_name ?? ""} onChange={(e) => onChangeField("first_name", e.target.value)} placeholder="ชื่อ" />
              </Field>
              <Field label="นามสกุล" editing={editing} display={active.last_name}>
                <input aria-label="นามสกุล" className={inputCls} value={draft.last_name ?? ""} onChange={(e) => onChangeField("last_name", e.target.value)} placeholder="นามสกุล" />
              </Field>
              <Field label="คำนำหน้า" editing={editing} display={PREFIX_OPTIONS.find((op) => op.value === String(active.precode))?.label}>
                <ComboBox
                  title="คำนำหน้า"
                  ariaLabel="คำนำหน้า"
                  searchable={false}
                  options={PREFIX_OPTIONS}
                  value={draft.precode ?? ""}
                  onChange={(v) => onChangeField("precode", v)}
                  placeholder="— เลือก —"
                />
              </Field>
              <Field label="เพศ (กำหนดจากคำนำหน้า)" editing={false} display={SEX_LABEL[editing ? sexFromPrefix(draft.precode) : active.sex] || "-"} />
              <Field label="เลขบัตรประชาชน (ไม่บังคับ)" editing={editing} display={<span className="tabular-nums">{active.citizen_id}</span>}>
                <input aria-label="เลขบัตรประชาชน" inputMode="numeric" maxLength={13} className={cx(inputCls, "tabular-nums")} value={draft.citizen_id ?? ""} onChange={(e) => onChangeField("citizen_id", e.target.value)} placeholder="13 หลัก" />
              </Field>
              <Field label="โทรศัพท์" editing={editing} display={<span className="tabular-nums">{active.phone_number}</span>}>
                <input aria-label="โทรศัพท์" inputMode="tel" className={cx(inputCls, "tabular-nums")} value={draft.phone_number ?? ""} onChange={(e) => onChangeField("phone_number", e.target.value)} placeholder="08x-xxx-xxxx" />
              </Field>
            </div>

            {/* ที่อยู่ */}
            <section className="mt-6">
              <h3 className="mb-3 text-sm font-semibold text-gray-900 dark:text-gray-100">ที่อยู่</h3>
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                {[
                  { key: "address", label: "ที่อยู่" },
                  { key: "mhoo", label: "หมู่" },
                  { key: "sub_district", label: "ตำบล" },
                  { key: "district", label: "อำเภอ" },
                  { key: "province", label: "จังหวัด" },
                  { key: "postal_code", label: "รหัสไปรษณีย์", numeric: true },
                ].map(({ key, label, numeric }) => (
                  <Field key={key} label={label} editing={editing} display={active[key]}>
                    <input
                      aria-label={label}
                      inputMode={numeric ? "numeric" : undefined}
                      className={cx(inputCls, numeric && "tabular-nums")}
                      value={draft[key] ?? ""}
                      onChange={(e) => onChangeField(key, e.target.value)}
                      placeholder={label}
                    />
                  </Field>
                ))}
              </div>
            </section>

            {/* ข้อมูล FID */}
            <section className="mt-6">
              <h3 className="mb-3 text-sm font-semibold text-gray-900 dark:text-gray-100">ทะเบียนเกษตรกร</h3>
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <Field label="เลขทะเบียนเกษตรกร" editing={editing} display={active.fid}>
                  <input aria-label="เลขทะเบียนเกษตรกร" className={inputCls} value={draft.fid ?? ""} onChange={(e) => onChangeField("fid", e.target.value)} placeholder="เช่น 123456" />
                </Field>
                <Field label="ชื่อผู้ขึ้นทะเบียนเกษตรกร" editing={editing} display={active.fid_owner}>
                  <input aria-label="ชื่อผู้ขึ้นทะเบียนเกษตรกร" className={inputCls} value={draft.fid_owner ?? ""} onChange={(e) => onChangeField("fid_owner", e.target.value)} placeholder="เช่น นายสมชาย ใจดี" />
                </Field>
                <Field
                  label="ความสัมพันธ์กับผู้ขึ้นทะเบียน"
                  editing={editing}
                  display={active.fid_relationship != null ? (fidMap?.[active.fid_relationship] ?? "—") : "-"}
                >
                  <ComboBox
                    title="ความสัมพันธ์กับผู้ขึ้นทะเบียน"
                    ariaLabel="ความสัมพันธ์กับผู้ขึ้นทะเบียน"
                    options={fidOptions}
                    value={draft.fid_relationship ?? ""}
                    onChange={(v) => onChangeField("fid_relationship", v)}
                    placeholder="— เลือก —"
                    emptyText="ไม่มีตัวเลือก"
                  />
                </Field>
              </div>
            </section>
          </div>
        )}
      </Sheet>
    </div>
  )
}

export default CustomerSearch
