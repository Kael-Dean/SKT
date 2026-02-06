import { useCallback, useEffect, useMemo, useState } from "react"

/** ---------------- Utils ---------------- */
const cx = (...a) => a.filter(Boolean).join(" ")
const toNumber = (v) => {
  if (v === "" || v === null || v === undefined) return 0
  const n = Number(String(v).replace(/,/g, ""))
  return Number.isFinite(n) ? n : 0
}
const sanitizeNumberInput = (s, { maxDecimals = 3 } = {}) => {
  const cleaned = String(s ?? "").replace(/[^\d.]/g, "")
  if (!cleaned) return ""
  const parts = cleaned.split(".")
  const intPart = parts[0] ?? ""
  if (parts.length <= 1) return intPart
  const decRaw = parts.slice(1).join("")
  const dec = decRaw.slice(0, Math.max(0, maxDecimals))
  if (maxDecimals <= 0) return intPart
  return `${intPart}.${dec}`
}
const fmtMoney = (n, maxFractionDigits = 3) =>
  new Intl.NumberFormat("th-TH", { maximumFractionDigits: maxFractionDigits }).format(toNumber(n))

/** ---------------- API (token = localStorage.token) ---------------- */
const API_BASE_RAW =
  import.meta.env.VITE_API_BASE_CUSTOM ||
  import.meta.env.VITE_API_BASE ||
  import.meta.env.VITE_API_URL ||
  ""
const API_BASE = String(API_BASE_RAW || "").replace(/\/+$/, "")

class ApiError extends Error {
  constructor(message, meta = {}) {
    super(message)
    this.name = "ApiError"
    Object.assign(this, meta)
  }
}

const getToken = () => localStorage.getItem("token") || ""

async function apiAuth(path, { method = "GET", body } = {}) {
  if (!API_BASE) throw new ApiError("FE: ยังไม่ได้ตั้ง API Base (VITE_API_BASE...)", { status: 0 })
  const token = getToken()
  const url = `${API_BASE}${path}`

  let res
  try {
    res = await fetch(url, {
      method,
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: body != null ? JSON.stringify(body) : undefined,
      credentials: "include",
    })
  } catch (e) {
    throw new ApiError("FE: เชื่อมต่อเซิร์ฟเวอร์ไม่สำเร็จ (Network/CORS/DNS)", {
      status: 0,
      url,
      method,
      cause: e,
    })
  }

  const text = await res.text()
  let data = null
  try {
    data = text ? JSON.parse(text) : null
  } catch {
    data = text
  }

  if (!res.ok) {
    const msg =
      (data && (data.detail || data.message)) ||
      (typeof data === "string" && data) ||
      `HTTP ${res.status}`
    throw new ApiError(msg, { status: res.status, url, method, data })
  }
  return data
}

/** ---------------- UI styles ---------------- */
const pageWrap = "p-3 md:p-6"
const card =
  "rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-700 dark:bg-slate-900"
const cardHead = "flex flex-col gap-2 md:flex-row md:items-center md:justify-between p-4 md:p-5"
const title = "text-lg md:text-xl font-bold text-slate-900 dark:text-slate-100"
const sub = "text-xs md:text-sm text-slate-600 dark:text-slate-300"

const readonlyField =
  "w-full rounded-2xl border border-slate-300 bg-slate-100 p-3 text-[15px] md:text-base " +
  "text-black shadow-none dark:border-slate-500/40 dark:bg-slate-700/80 dark:text-slate-100"

const btn =
  "rounded-2xl px-4 py-2 text-sm font-semibold shadow-sm transition active:scale-[0.99] disabled:opacity-60 disabled:cursor-not-allowed"
const btnPrimary =
  "bg-emerald-600 text-white hover:bg-emerald-700 focus:outline-none focus:ring-2 focus:ring-emerald-500/40"
const btnGhost =
  "bg-slate-100 text-slate-900 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-100 dark:hover:bg-slate-700"

const cellInput =
  "w-full min-w-0 max-w-full box-border rounded-xl border border-slate-300 bg-white px-2 py-1.5 " +
  "text-right text-[12px] md:text-[13px] outline-none " +
  "focus:border-emerald-600 focus:ring-2 focus:ring-emerald-500/20 " +
  "dark:border-slate-600 dark:bg-slate-950 dark:text-slate-100"

const pill =
  "inline-flex items-center rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5 text-[11px] text-slate-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"

const tableWrap = "overflow-auto"
const table = "min-w-[980px] w-full border-separate border-spacing-0"
const th =
  "sticky top-0 z-10 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 text-[12px] font-semibold border-b border-slate-200 dark:border-slate-700 px-3 py-2 text-left"
const tdBase =
  "border-b border-slate-100 dark:border-slate-800 px-3 py-2 text-[12px] md:text-[13px] text-slate-900 dark:text-slate-100"
const trAlt = "bg-slate-50/70 dark:bg-slate-950/40"

/** ---------------- Config ---------------- */
const PROCUREMENT_GROUP_ID = 1 // ธุรกิจจัดหา

/**
 * Props (รองรับรูปแบบเดียวกับหน้าอื่น):
 * - yearBE (พ.ศ.)
 * - planId (optional)
 * - branchName (optional)
 */
function ProcurementPlanDetail({ yearBE, planId, branchName }) {
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState("")
  const [hint, setHint] = useState("")
  const [rawGroups, setRawGroups] = useState(null)

  // key = product_id => { sell_price, buy_price, comment }
  const [draft, setDraft] = useState(() => new Map())

  // Plan แบบแปลงปีเหมือนหน้าค่าใช้จ่าย: 2569 => 1, 2570 => 2 ...
  const effectivePlanId = useMemo(() => {
    const p = Number(planId || 0)
    if (Number.isFinite(p) && p > 0) return p
    const y = Number(yearBE || 0)
    return Number.isFinite(y) ? y - 2568 : 0
  }, [planId, yearBE])

  const effectiveYearBE = useMemo(() => {
    const y = Number(yearBE || 0)
    if (Number.isFinite(y) && y >= 2569) return y
    const p = Number(planId || 0)
    return Number.isFinite(p) && p > 0 ? 2568 + p : 0
  }, [yearBE, planId])

  const group = useMemo(() => {
    if (!rawGroups) return null
    const g = rawGroups[String(PROCUREMENT_GROUP_ID)] || rawGroups[PROCUREMENT_GROUP_ID]
    return g || null
  }, [rawGroups])

  const items = useMemo(() => {
    const arr = group?.items || []
    return Array.isArray(arr) ? arr : []
  }, [group])

  const hasChanges = useMemo(() => {
    if (!items.length) return false
    for (const it of items) {
      const pid = Number(it.product_id)
      const d = draft.get(pid)
      if (!d) continue
      const s0 = Number(it.sell_price ?? 0)
      const b0 = Number(it.buy_price ?? 0)
      const s1 = Number(d.sell_price ?? 0)
      const b1 = Number(d.buy_price ?? 0)
      const c0 = String(it.comment ?? "")
      const c1 = String(d.comment ?? "")
      if (s0 !== s1 || b0 !== b1 || c0 !== c1) return true
    }
    return false
  }, [items, draft])

  const load = useCallback(async () => {
    setError("")
    setHint("")
    setLoading(true)
    try {
      if (!effectivePlanId || effectivePlanId <= 0) {
        throw new Error(
          `FE: plan_id ไม่ถูกต้อง (ปี ${effectiveYearBE || "-"} => plan_id=${effectivePlanId})`
        )
      }

      const data = await apiAuth(`/lists/products-by-group-latest?plan_id=${effectivePlanId}`)
      setRawGroups(data || {})

      // reset draft ให้ตรงกับของล่าสุดที่โหลด
      const m = new Map()
      const g = (data && (data[String(PROCUREMENT_GROUP_ID)] || data[PROCUREMENT_GROUP_ID])) || null
      const its = g?.items || []
      for (const it of its) {
        const pid = Number(it.product_id)
        m.set(pid, {
          sell_price: it.sell_price ?? "",
          buy_price: it.buy_price ?? "",
          comment: it.comment ?? "",
        })
      }
      setDraft(m)
      setHint("โหลดข้อมูลล่าสุดแล้ว")
    } catch (e) {
      setError(e?.message || "โหลดข้อมูลไม่สำเร็จ")
    } finally {
      setLoading(false)
    }
  }, [effectivePlanId, effectiveYearBE])

  useEffect(() => {
    load()
  }, [load])

  const setDraftField = useCallback((productId, field, value) => {
    const pid = Number(productId)
    setDraft((prev) => {
      const next = new Map(prev)
      const cur = next.get(pid) || { sell_price: "", buy_price: "", comment: "" }
      next.set(pid, { ...cur, [field]: value })
      return next
    })
  }, [])

  const handleSave = useCallback(async () => {
    setError("")
    setHint("")
    setSaving(true)
    try {
      if (!effectivePlanId || effectivePlanId <= 0)
        throw new Error(`FE: plan_id ไม่ถูกต้อง (plan_id=${effectivePlanId})`)
      if (!items.length) throw new Error("ไม่มีรายการสินค้าให้บันทึก")

      // เก็บเฉพาะที่มีการเปลี่ยนจริง
      const changed = []
      for (const it of items) {
        const pid = Number(it.product_id)
        const d = draft.get(pid)
        if (!d) continue

        const s0 = Number(it.sell_price ?? 0)
        const b0 = Number(it.buy_price ?? 0)
        const c0 = String(it.comment ?? "")

        const s1 = toNumber(d.sell_price)
        const b1 = toNumber(d.buy_price)
        const c1 = String(d.comment ?? "")

        if (s0 !== s1 || b0 !== b1 || c0 !== c1) {
          changed.push({
            product_id: pid,
            sell_price: s1,
            buy_price: b1,
            comment: c1,
          })
        }
      }

      if (!changed.length) {
        setHint("ไม่มีการเปลี่ยนแปลง (ไม่ต้องบันทึกก็ได้ 😄)")
        return
      }

      // 1) ลอง bulk ก่อน
      try {
        await apiAuth(`/unit-prices/bulk`, {
          method: "PUT",
          body: {
            plan_id: effectivePlanId,
            items: changed,
          },
        })
      } catch (e) {
        const status = e?.status
        // ถ้า route ไม่ตรง/ไม่พบ -> fallback ยิงทีละรายการ
        if (status === 404 || status === 405) {
          for (const row of changed) {
            await apiAuth(`/unit-prices`, {
              method: "POST",
              body: {
                plan_id: effectivePlanId,
                product_id: row.product_id,
                sell_price: row.sell_price,
                buy_price: row.buy_price,
                comment: row.comment,
              },
            })
          }
        } else {
          throw e
        }
      }

      setHint(`บันทึกแล้ว ${changed.length} รายการ ✅`)
      await load() // reload เพื่อเอา "ราคาล่าสุด"
    } catch (e) {
      setError(e?.message || "บันทึกไม่สำเร็จ")
    } finally {
      setSaving(false)
    }
  }, [effectivePlanId, items, draft, load])

  return (
    <div className={pageWrap}>
      <div className={card}>
        <div className={cardHead}>
          <div className="min-w-0">
            <div className={title}>ยอดขาย — ธุรกิจจัดหา (ตั้งราคาขาย/ซื้อ)</div>
            <div className={sub}>
              ปีแผน (พ.ศ.) <span className={pill}>{effectiveYearBE || "-"}</span> ⇒ plan_id{" "}
              <span className={pill}>{effectivePlanId || "-"}</span>
              {branchName ? (
                <>
                  {" "}
                  • สาขา <span className={pill}>{branchName}</span>
                </>
              ) : null}
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button className={cx(btn, btnGhost)} onClick={load} disabled={loading || saving}>
              {loading ? "กำลังโหลด..." : "รีเฟรช"}
            </button>

            <button
              className={cx(btn, btnPrimary)}
              onClick={handleSave}
              disabled={saving || loading || !hasChanges}
              title={!hasChanges ? "ยังไม่มีการแก้ไข" : "บันทึกเพื่อให้เป็นราคาล่าสุด"}
            >
              {saving ? "กำลังบันทึก..." : "บันทึก"}
            </button>
          </div>
        </div>

        {(error || hint) && (
          <div className="px-4 pb-3 md:px-5">
            {error ? (
              <div className="rounded-2xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700 dark:border-rose-800 dark:bg-rose-950/40 dark:text-rose-200">
                {error}
              </div>
            ) : null}
            {hint ? (
              <div className="mt-2 rounded-2xl border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-200">
                {hint}
              </div>
            ) : null}
          </div>
        )}

        <div className="px-4 pb-4 md:px-5 md:pb-5">
          {!group ? (
            <div className={readonlyField}>
              {loading ? "กำลังโหลดรายการสินค้า..." : "ยังไม่พบสินค้าในธุรกิจจัดหา (group_id=1) สำหรับแผนนี้"}
            </div>
          ) : (
            <div className={cx(card, "border-none shadow-none")}>
              <div className="flex flex-wrap items-center justify-between gap-2 pb-3">
                <div className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                  กลุ่ม: {group.group_name} <span className={pill}>({items.length} รายการ)</span>
                </div>
                <div className="text-xs text-slate-600 dark:text-slate-300">
                  * แก้ราคาแล้วกด “บันทึก” เพื่อสร้างรายการราคาล่าสุด
                </div>
              </div>

              <div className={tableWrap}>
                <table className={table}>
                  <thead>
                    <tr>
                      <th className={th} style={{ minWidth: 280 }}>สินค้า</th>
                      <th className={th} style={{ minWidth: 90 }}>หน่วย</th>
                      <th className={th} style={{ minWidth: 160, textAlign: "right" }}>ราคาขาย</th>
                      <th className={th} style={{ minWidth: 160, textAlign: "right" }}>ราคาซื้อ</th>
                      <th className={th} style={{ minWidth: 220 }}>หมายเหตุ</th>
                      <th className={th} style={{ minWidth: 210 }}>อัปเดตล่าสุด</th>
                    </tr>
                  </thead>

                  <tbody>
                    {items.map((it, idx) => {
                      const pid = Number(it.product_id)
                      const d = draft.get(pid) || { sell_price: "", buy_price: "", comment: "" }

                      const s0 = Number(it.sell_price ?? 0)
                      const b0 = Number(it.buy_price ?? 0)
                      const s1 = toNumber(d.sell_price)
                      const b1 = toNumber(d.buy_price)
                      const dirty =
                        s0 !== s1 || b0 !== b1 || String(it.comment ?? "") !== String(d.comment ?? "")

                      return (
                        <tr key={`${pid}-${it.unitprice_id || idx}`} className={cx(idx % 2 === 1 && trAlt)}>
                          <td className={tdBase}>
                            <div className="font-semibold">{it.product_type}</div>
                            <div className="mt-1 text-[11px] text-slate-500 dark:text-slate-400">
                              product_id: {pid}{" "}
                              {dirty ? (
                                <span className="ml-2 text-amber-600 dark:text-amber-300">• แก้ไขแล้ว</span>
                              ) : null}
                            </div>
                          </td>

                          <td className={tdBase}>
                            <span className={pill}>{it.unit || "-"}</span>
                          </td>

                          <td className={tdBase} style={{ textAlign: "right" }}>
                            <input
                              className={cellInput}
                              value={String(d.sell_price ?? "")}
                              onChange={(e) =>
                                setDraftField(
                                  pid,
                                  "sell_price",
                                  sanitizeNumberInput(e.target.value, { maxDecimals: 3 })
                                )
                              }
                              inputMode="decimal"
                              placeholder={it.sell_price != null ? String(it.sell_price) : "0"}
                            />
                            <div className="mt-1 text-[11px] text-slate-500 dark:text-slate-400">
                              เดิม: {fmtMoney(it.sell_price ?? 0, 3)}
                            </div>
                          </td>

                          <td className={tdBase} style={{ textAlign: "right" }}>
                            <input
                              className={cellInput}
                              value={String(d.buy_price ?? "")}
                              onChange={(e) =>
                                setDraftField(
                                  pid,
                                  "buy_price",
                                  sanitizeNumberInput(e.target.value, { maxDecimals: 3 })
                                )
                              }
                              inputMode="decimal"
                              placeholder={it.buy_price != null ? String(it.buy_price) : "0"}
                            />
                            <div className="mt-1 text-[11px] text-slate-500 dark:text-slate-400">
                              เดิม: {fmtMoney(it.buy_price ?? 0, 3)}
                            </div>
                          </td>

                          <td className={tdBase}>
                            <input
                              className={cx(cellInput, "text-left")}
                              value={String(d.comment ?? "")}
                              onChange={(e) => setDraftField(pid, "comment", e.target.value)}
                              placeholder="หมายเหตุ (ถ้ามี)"
                            />
                          </td>

                          <td className={tdBase}>
                            <div className="text-[12px]">
                              {it.created_date ? new Date(it.created_date).toLocaleString("th-TH") : "-"}
                            </div>
                            <div className="mt-1 text-[11px] text-slate-500 dark:text-slate-400">
                              unitprice_id: {it.unitprice_id ?? "-"}
                            </div>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>

              <div className="mt-3 text-xs text-slate-600 dark:text-slate-300">
                บันทึกแล้วไม่เห็นล่าสุด = รีเฟรชอีกรอบ…เหมือนกด F5 ใส่ชีวิตตัวเอง 😄
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default ProcurementPlanDetail
