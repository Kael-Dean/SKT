// src/pages/StockDamageOut.jsx
import { useEffect, useMemo, useState } from "react"
import { get, post } from "../../lib/api"
import {
  cx,
  baseField,
  fieldDisabled,
  labelCls,
  helpTextCls,
  errorTextCls,
  cardCls,
  sectionTitleCls,
  resetBtnCls,
  spinnerCls,
} from "../../lib/styles"
import ComboBox from "../../components/ComboBox"
import ProductFormPicker from "../../components/ProductFormPicker"
import useProductForms, { specFromForm } from "../../lib/useProductForms"
import { StickyActionBar, toast } from "../../components/ui"
import { useIsPhone } from "../../hooks/useMediaQuery"
import { getActiveBranch } from "../../lib/auth"
import { describeApiError } from "../../lib/apiErrors"
import DateInput from "../../components/ThaiDateField"

/** ---------- Utils ---------- */
const toNumber = (v) => (v === "" || v === null || v === undefined ? 0 : Number(v))
const nf = (n) =>
  new Intl.NumberFormat("th-TH", { maximumFractionDigits: 2 }).format(isFinite(n) ? Number(n) : 0)
const thb = (n) =>
  new Intl.NumberFormat("th-TH", { style: "currency", currency: "THB", maximumFractionDigits: 2 }).format(
    isFinite(n) ? n : 0
  )

/** ชื่อฟิลด์สั้นสำหรับ toast "กรอกไม่ครบ" (mobile-copy §3.3) */
const FIELD_LABELS = {
  damage_date: "วันที่ตัดเสียหาย",
  branch_id: "สาขา",
  klang_id: "คลัง",
  form_id: "ฟอร์มสินค้า",
  weight_out: "น้ำหนักที่ตัดออก",
  cost_per_kg: "ค่าเสียหาย/กก.",
}
const MISSING_ORDER = ["damage_date", "branch_id", "klang_id", "form_id", "weight_out", "cost_per_kg"]
const missingDescription = (keys) => {
  const names = keys.map((k) => FIELD_LABELS[k]).filter(Boolean)
  const rest = names.length - 3
  return `ยังไม่ได้กรอก: ${names.slice(0, 3).join(", ")}${rest > 0 ? ` และอีก ${rest} ช่อง` : ""}`
}

/** ---------- DateInput ---------- */
// ช่องวันที่ไทย (วัน เดือน พ.ศ.) ตัวกลาง — API เหมือน input เดิม (handoff F25)

/** วันที่วันนี้ตามเวลาเครื่อง (YYYY-MM-DD) — ไม่ผ่าน UTC */
const todayLocal = () => {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`
}

/** ---------- Page: ตัดเสียหาย (นำออกจากคลัง) ---------- */
const StockDamageOut = () => {
  const isPhone = useIsPhone()
  const [submitting, setSubmitting] = useState(false)
  const productForms = useProductForms()

  /** สาขา: backend รับเฉพาะสาขาที่ใช้งานอยู่ (แถบบน) — สลับสาขาที่แถบบนแทน */
  const activeBranchId = getActiveBranch()

  /** ---------- Dropdown options ---------- */
  const [branchOptions, setBranchOptions] = useState([])
  const [branchStatus, setBranchStatus] = useState("loading")
  const [klangOptions, setKlangOptions] = useState([])
  const [klangStatus, setKlangStatus] = useState("idle")

  /** ---------- Form ---------- */
  const [form, setForm] = useState({
    damage_date: todayLocal(),
    branch_id: activeBranchId,
    branch_name: "",
    klang_id: null,
    klang_name: "",
    form_id: "",
    weight_out: "",
    cost_per_kg: "",
    reason: "",
  })
  const update = (k, v) => setForm((p) => ({ ...p, [k]: v }))

  const selectedForm = productForms.findForm(form.form_id)

  /** ---------- Derived ---------- */
  const weightOut = useMemo(() => toNumber(form.weight_out), [form.weight_out])
  const damagePerKg = useMemo(() => toNumber(form.cost_per_kg), [form.cost_per_kg])
  const totalDamage = useMemo(() => weightOut * damagePerKg, [weightOut, damagePerKg])

  /** ---------- Errors / hints ---------- */
  const [errors, setErrors] = useState({})
  const [missingHints, setMissingHints] = useState({})
  const redFieldCls = (key) =>
    errors[key] || missingHints[key] ? "border-red-500 ring-2 ring-red-300 focus:ring-0 focus:border-red-500" : ""
  const redHintCls = (key) =>
    missingHints[key] ? "border-red-400 ring-2 ring-red-300 focus:border-red-400 animate-pulse" : ""
  const clearHint = (key) => setMissingHints((prev) => (prev[key] ? { ...prev, [key]: false } : prev))
  const clearError = (key) =>
    setErrors((prev) => {
      if (!(key in prev)) return prev
      const { [key]: _omit, ...rest } = prev
      return rest
    })

  /** ---------- Load branches ---------- */
  useEffect(() => {
    let alive = true
    get("/order/branch/search")
      .then((branches) => {
        if (!alive) return
        setBranchOptions((branches || []).map((b) => ({ id: b.id, label: b.branch_name })))
        setBranchStatus("ready")
      })
      .catch((e) => {
        console.error("load branches error:", e)
        if (alive) { setBranchOptions([]); setBranchStatus("error") }
      })
    return () => { alive = false }
  }, [])

  // ชื่อสาขาที่ใช้งานอยู่
  useEffect(() => {
    const found = branchOptions.find((b) => String(b.id) === String(form.branch_id ?? ""))
    if (found && found.label !== form.branch_name) update("branch_name", found.label)
  }, [branchOptions, form.branch_id, form.branch_name])

  // branch -> klang
  useEffect(() => {
    const bid = form.branch_id
    if (bid == null) {
      setKlangOptions([])
      setKlangStatus("idle")
      return
    }
    let alive = true
    setKlangStatus("loading")
    get(`/order/klang/search?branch_id=${bid}`)
      .then((arr) => {
        if (!alive) return
        setKlangOptions((arr || []).map((k) => ({ id: k.id, label: k.klang_name })))
        setKlangStatus("ready")
      })
      .catch((e) => {
        console.error("Load klang error:", e)
        if (alive) { setKlangOptions([]); setKlangStatus("error") }
      })
    return () => { alive = false }
  }, [form.branch_id])

  /** ---------- Validate ---------- */
  const computeMissingHints = () => {
    const m = {}
    if (!form.damage_date) m.damage_date = true
    if (!form.branch_id) m.branch_id = true
    if (!form.klang_id) m.klang_id = true
    if (!form.form_id) m.form_id = true
    if (!form.weight_out || Number(form.weight_out) <= 0) m.weight_out = true
    if (form.cost_per_kg === "" || Number(form.cost_per_kg) < 0) m.cost_per_kg = true
    return m
  }

  const validate = () => {
    const e = {}
    if (!form.damage_date) e.damage_date = "กรุณาเลือกวันที่ตัดเสียหาย"
    if (!form.branch_id) e.branch_id = "ยังไม่มีสาขาที่ใช้งานอยู่ เลือกสาขาที่แถบด้านบน"
    if (!form.klang_id) e.klang_id = "กรุณาเลือกคลัง"
    if (!form.form_id) e.form_id = "กรุณาเลือกฟอร์มสินค้า"
    else if (!selectedForm) e.form_id = "ฟอร์มสินค้านี้ใช้งานไม่ได้แล้ว เลือกฟอร์มอื่น"
    if (toNumber(form.weight_out) <= 0) e.weight_out = "น้ำหนักต้องมากกว่า 0"
    if (form.cost_per_kg === "" || toNumber(form.cost_per_kg) < 0) e.cost_per_kg = "ค่าเสียหาย/กก. ต้องไม่ติดลบ"
    setErrors(e)
    return { ok: Object.keys(e).length === 0, e }
  }

  /** ---------- Submit ---------- */
  const handleSubmit = async (e) => {
    e?.preventDefault?.()
    const hints = computeMissingHints()
    setMissingHints(hints)
    const { ok: okForm, e: ev } = validate()

    if (!okForm || Object.values(hints).some(Boolean)) {
      const missingKeys = MISSING_ORDER.filter((k) => hints[k] && (form[k] === "" || form[k] == null))
      if (missingKeys.length) toast.error("กรอกไม่ครบ", { description: missingDescription(missingKeys) })
      else toast.error("ข้อมูลไม่ถูกต้อง", { description: Object.values(ev)[0] || "ตรวจช่องที่มีกรอบสีแดง" })
      return
    }

    setSubmitting(true)
    try {
      const priceVal = toNumber(form.cost_per_kg)
      const amountVal = toNumber(form.weight_out)

      // POST /cutloss/create — price = บาท/กก. (backend ตัดมูลค่า = price × กก.)
      const payload = {
        date: form.damage_date,
        spec: specFromForm(selectedForm),
        cl_branch: Number(form.branch_id),
        cl_klang: Number(form.klang_id),
        cl_amount: amountVal,
        price: priceVal,
        comment: form.reason?.trim() || null,
      }

      await post("/cutloss/create", payload)

      toast.success("บันทึกตัดเสียหายแล้ว", {
        description: `${selectedForm.label} · ตัด ${nf(amountVal)} กก. · ${thb(totalDamage)}`,
      })

      // คงสาขา/คลัง/ฟอร์มสินค้าไว้ (มักตัดสินค้าเดิมซ้ำ)
      setForm((f) => ({ ...f, weight_out: "", cost_per_kg: "", reason: "" }))
    } catch (err) {
      console.error(err)
      const { title, description } = describeApiError(err)
      toast.error(title, { description })
    } finally {
      setSubmitting(false)
    }
  }

  const handleReset = () =>
    setForm((f) => ({ ...f, form_id: "", weight_out: "", cost_per_kg: "", reason: "" }))

  /** ---------- Sticky bar summary (<md) ---------- */
  const barSummary = (
    <div className="min-w-0">
      <p className="truncate text-gray-900 dark:text-gray-100">
        {weightOut > 0 || form.klang_name
          ? [`ตัด ${nf(weightOut)} กก.`, form.klang_name].filter(Boolean).join(" · ")
          : "ยังไม่ได้กรอกน้ำหนัก"}
      </p>
      <p className="tabular-nums text-gray-500 dark:text-gray-400">มูลค่าเสียหาย {thb(totalDamage)}</p>
    </div>
  )

  const cardSectionCls = cx(cardCls, "p-4 md:p-5 mb-4 md:mb-6")

  return (
    <div className="min-h-screen bg-white text-black dark:bg-slate-900 dark:text-white rounded-2xl text-[15px] md:text-base">
      <div className="mx-auto max-w-7xl p-4 md:p-6 lg:p-8">
        <h1 className="mb-4 flex items-center gap-2.5 text-xl md:text-3xl font-bold text-gray-900 dark:text-white">
          <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="size-6 md:size-7 text-red-600 dark:text-red-400">
            <path d="m21.73 18-8-14a2 2 0 0 0-3.46 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z" />
            <line x1="12" y1="9" x2="12" y2="13" />
            <line x1="12" y1="17" x2="12.01" y2="17" />
          </svg>
          ตัดเสียหาย
        </h1>

        <form onSubmit={handleSubmit}>
          {/* กรอบที่ 1: ที่ตั้ง (สาขา/คลัง) & วันที่ */}
          <div className={cardSectionCls}>
            <h2 className={sectionTitleCls}>ข้อมูลตัดเสียหาย</h2>
            <div className="grid gap-4 md:grid-cols-3">
              <div>
                <label htmlFor="damage_date" className={labelCls}>วันที่ตัดเสียหาย</label>
                <DateInput
                  id="damage_date"
                  value={form.damage_date}
                  onChange={(e) => {
                    clearError("damage_date")
                    clearHint("damage_date")
                    update("damage_date", e.target.value)
                  }}
                  error={!!errors.damage_date}
                  className={redHintCls("damage_date")}
                  aria-invalid={errors.damage_date ? true : undefined}
                />
                {errors.damage_date && <p className={errorTextCls}>{errors.damage_date}</p>}
              </div>

              <div>
                <span className={labelCls}>สาขา</span>
                <div className={cx(baseField, fieldDisabled, (errors.branch_id || missingHints.branch_id) && "border-red-500")}>
                  {branchStatus === "loading" ? "กำลังโหลด…" : form.branch_name || (form.branch_id ? `สาขา #${form.branch_id}` : "—")}
                </div>
                {errors.branch_id
                  ? <p className={errorTextCls}>{errors.branch_id}</p>
                  : <p className={helpTextCls}>ตัดเสียหายได้เฉพาะสาขาที่ใช้งานอยู่ — สลับสาขาที่แถบด้านบน</p>}
              </div>

              <div>
                <label className={labelCls}>คลัง</label>
                <ComboBox
                  title="คลัง"
                  ariaLabel="คลัง"
                  options={klangOptions}
                  value={form.klang_id}
                  getValue={(o) => o.id}
                  onChange={(_v, found) => {
                    clearError("klang_id")
                    clearHint("klang_id")
                    update("klang_id", found?.id ?? null)
                    update("klang_name", found?.label ?? "")
                  }}
                  placeholder={klangStatus === "loading" ? "กำลังโหลดคลัง…" : "— เลือกคลัง —"}
                  loading={klangStatus === "loading"}
                  emptyText="สาขานี้ยังไม่มีคลัง"
                  disabled={!form.branch_id}
                  error={!!errors.klang_id}
                  hintRed={!!missingHints.klang_id}
                  clearHint={() => clearHint("klang_id")}
                />
                {errors.klang_id && <p className={errorTextCls}>{errors.klang_id}</p>}
                {klangStatus === "error" && <p className={errorTextCls}>โหลดรายการคลังไม่สำเร็จ รีเฟรชหน้าแล้วลองใหม่</p>}
              </div>
            </div>
          </div>

          {/* กรอบที่ 2: สินค้า — ฟอร์มสินค้าตัวเดียว + ชิปสเปค */}
          <div className={cardSectionCls}>
            <h2 className={sectionTitleCls}>สินค้า</h2>
            <ProductFormPicker
              id="damage-form"
              forms={productForms}
              value={form.form_id}
              storageKey="damageOut.formTemplate"
              onChange={(id) => {
                clearError("form_id")
                clearHint("form_id")
                update("form_id", id)
              }}
              error={errors.form_id}
              hintRed={!!missingHints.form_id}
              clearHint={() => clearHint("form_id")}
              className="md:max-w-2xl"
            />
          </div>

          {/* กรอบที่ 3: น้ำหนักและค่าเสียหาย */}
          <div className={cardSectionCls}>
            <h2 className={sectionTitleCls}>น้ำหนักและค่าเสียหาย</h2>
            <div className="grid gap-4 md:grid-cols-4">
              <div>
                <label htmlFor="weight_out" className={labelCls}>น้ำหนักที่ตัดออก (กก.)</label>
                <input
                  id="weight_out"
                  inputMode="decimal"
                  className={cx(baseField, "tabular-nums", redFieldCls("weight_out"))}
                  value={form.weight_out}
                  onChange={(e) => update("weight_out", e.target.value.replace(/[^\d.]/g, ""))}
                  onFocus={() => {
                    clearError("weight_out")
                    clearHint("weight_out")
                  }}
                  placeholder="เช่น 1000"
                  aria-invalid={errors.weight_out ? true : undefined}
                />
                {errors.weight_out && <p className={errorTextCls}>{errors.weight_out}</p>}
              </div>

              <div>
                <label htmlFor="cost_per_kg" className={labelCls}>ค่าเสียหาย / กก. (บาท)</label>
                <input
                  id="cost_per_kg"
                  inputMode="decimal"
                  className={cx(baseField, "tabular-nums", redFieldCls("cost_per_kg"))}
                  value={form.cost_per_kg}
                  onChange={(e) => update("cost_per_kg", e.target.value.replace(/[^\d.]/g, ""))}
                  onFocus={() => {
                    clearError("cost_per_kg")
                    clearHint("cost_per_kg")
                  }}
                  placeholder="เช่น 2.50"
                  aria-invalid={errors.cost_per_kg ? true : undefined}
                />
                {errors.cost_per_kg && <p className={errorTextCls}>{errors.cost_per_kg}</p>}
              </div>

              <div>
                <label className={labelCls}>มูลค่าเสียหายรวม (บาท)</label>
                <input disabled aria-label="มูลค่าเสียหายรวม (บาท)" className={cx(baseField, fieldDisabled, "tabular-nums font-semibold")} value={thb(totalDamage)} />
                <p className={helpTextCls}>คำนวณ = น้ำหนัก × ค่าเสียหาย/กก.</p>
              </div>

              <div className="md:col-span-4">
                <label htmlFor="damage_reason" className={labelCls}>เหตุผล / บันทึกเพิ่มเติม</label>
                <textarea
                  id="damage_reason"
                  className={baseField}
                  rows={3}
                  value={form.reason}
                  onChange={(e) => update("reason", e.target.value)}
                  placeholder="เช่น เสียหายจากความชื้นสูง / ศัตรูพืช / ขนส่ง"
                />
              </div>
            </div>
          </div>

          {/* ปุ่ม — <md: แถบติดล่าง (UI-SPEC §7) · ≥md: ปุ่มเดิม (type=submit ใน <form>) */}
          {isPhone ? (
            <StickyActionBar
              summary={barSummary}
              secondary={{ label: "ล้างฟอร์ม", onClick: handleReset, disabled: submitting }}
              primary={{ label: submitting ? "กำลังบันทึก…" : "บันทึก", onClick: handleSubmit, loading: submitting }}
            />
          ) : (
            <div className="mt-6 flex flex-col gap-3 sm:flex-row">
              <button
                type="submit"
                disabled={submitting}
                className="inline-flex items-center justify-center gap-2 rounded-2xl
                  bg-red-600 px-6 py-3 text-base font-semibold text-white shadow-sm cursor-pointer
                  transition-all duration-200
                  hover:bg-red-700 hover:shadow-[0_8px_20px_rgba(220,38,38,0.35)] hover:scale-[1.02]
                  active:scale-[.97]
                  disabled:opacity-60 disabled:cursor-not-allowed disabled:hover:scale-100
                  focus:outline-none focus-visible:ring-2 focus-visible:ring-red-500 focus-visible:ring-offset-2
                  dark:focus-visible:ring-offset-slate-900"
                aria-busy={submitting ? "true" : "false"}
              >
                {submitting && <span className={spinnerCls} aria-hidden="true" />}
                {submitting ? "กำลังบันทึก..." : "บันทึก"}
              </button>

              <button
                type="button"
                onClick={handleReset}
                className={resetBtnCls}
              >
                รีเซ็ต
              </button>
            </div>
          )}
        </form>
      </div>
    </div>
  )
}

export default StockDamageOut
