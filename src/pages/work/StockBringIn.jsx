// src/pages/StockBringIn.jsx
import { useEffect, useMemo, useRef, useState } from "react"
import { get, post } from "../../lib/api"
import { describeApiError } from "../../lib/apiErrors"
import {
  cx,
  baseField,
  fieldDisabled,
  labelCls,
  helpTextCls,
  errorTextCls,
  cardCls,
  sectionTitleCls,
  submitBtnCls,
  resetBtnCls,
  spinnerCls,
} from "../../lib/styles"
import ComboBox from "../../components/ComboBox"
import ProductFormPicker from "../../components/ProductFormPicker"
import useProductForms, { specFromForm } from "../../lib/useProductForms"
import useBranchLock from "../../hooks/useBranchLock"
import BranchLockNote from "../../components/BranchLockNote"
import { getActiveBranch } from "../../lib/auth"
import { StickyActionBar, toast } from "../../components/ui"
import { useIsPhone } from "../../hooks/useMediaQuery"
import PageTitle from "../../components/PageTitle"

/** ---------- Utils ---------- */
const onlyDigits = (s = "") => s.replace(/[^\d]/g, "")
const toNumber = (v) => (v === "" || v === null || v === undefined ? 0 : Number(v))
const nf = (n) =>
  new Intl.NumberFormat("th-TH", { maximumFractionDigits: 2 }).format(isFinite(n) ? Number(n) : 0)
const thb = (n) =>
  new Intl.NumberFormat("th-TH", { style: "currency", currency: "THB", maximumFractionDigits: 2 }).format(
    isFinite(n) ? n : 0
  )
/** option value ของหน้านี้ = id ก่อน value (คง default ของ ComboBox copy เดิม) */
const getOptValue = (o) => o?.id ?? o?.value ?? ""

/** ชื่อฟิลด์สั้นสำหรับ toast "กรอกไม่ครบ" (mobile-copy §3.3 / §9.3) */
const FIELD_LABELS = {
  form_id: "ฟอร์มสินค้า",
  co_branch: "สาขา",
  co_klang: "คลังปลายทาง",
  co_available: "ปริมาณยกมา",
  prices: "ราคา 1 และ 2",
}
const missingDescription = (keys) => {
  const names = keys.map((k) => FIELD_LABELS[k]).filter(Boolean)
  const rest = names.length - 3
  return `ยังไม่ได้กรอก: ${names.slice(0, 3).join(", ")}${rest > 0 ? ` และอีก ${rest} ช่อง` : ""}`
}

/** แปลง error จากหลังบ้านเป็นข้อความไทย (mobile-copy §4.3–4.4) */
const SAVE_ERR_TH = [
  [/failed to fetch|networkerror|timeout/i, "เชื่อมต่อเซิร์ฟเวอร์ไม่ได้"],
  [/field required/i, "ข้อมูลบางช่องไม่ครบ"],
  [/value is not a valid|type_error/i, "รูปแบบข้อมูลบางช่องไม่ถูกต้อง"],
  [/greater than 0|ensure this value is greater/i, "น้ำหนักหรือราคาต้องมากกว่า 0"],
  [/not found[\s\S]*(klang|warehouse)|(klang|warehouse)[\s\S]*not found/i, "ไม่พบคลังที่เลือก"],
  [/duplicate|already exists/i, "รายการนี้มีอยู่แล้ว"],
]
function describeSaveError(err) {
  const status = err?.status
  // 403 พร้อม detail = กฎธุรกิจ, 409 = เช่น สต็อกไม่พอ → แสดง detail จาก backend (handoff F6/F7)
  if (status === 403 || status === 409) return describeApiError(err)
  const raw = String(err?.message || "")
  const isThai = /[฀-๿]/.test(raw)
  const hit = SAVE_ERR_TH.find(([re]) => re.test(raw))?.[1]
  if (hit) return { title: status === 422 ? "ข้อมูลไม่ผ่านการตรวจ" : "บันทึกไม่สำเร็จ", description: hit }
  if (!status) return { title: "บันทึกไม่สำเร็จ", description: "เชื่อมต่อเซิร์ฟเวอร์ไม่ได้ ตรวจสัญญาณแล้วลองใหม่ ข้อมูลที่กรอกยังอยู่" }
  if (status === 401) return { title: "หมดเวลาใช้งาน", description: "เข้าสู่ระบบใหม่แล้วลองอีกครั้ง" }
  if (status === 409) return { title: "รายการนี้มีอยู่แล้ว", description: isThai ? raw : "รายการนี้ถูกบันทึกไปแล้ว ตรวจก่อนบันทึกซ้ำ" }
  if (status === 422) return { title: "ข้อมูลไม่ผ่านการตรวจ", description: isThai ? raw : "เซิร์ฟเวอร์ปฏิเสธข้อมูลบางช่อง ตรวจค่าที่กรอกแล้วลองใหม่" }
  if (status >= 500) return { title: "เซิร์ฟเวอร์ขัดข้อง", description: "ยังไม่ได้บันทึก ลองใหม่ในอีกสักครู่ ถ้ายังไม่ได้ให้แจ้งผู้ดูแลระบบ" }
  return { title: "บันทึกไม่สำเร็จ", description: isThai ? raw : "เกิดข้อผิดพลาดที่ไม่คาดคิด ลองใหม่อีกครั้ง" }
}

/** ---------- Main Page: Carry Over (ยอดยกมาเข้าคลัง) ---------- */
function StockBringIn() {
  const isPhone = useIsPhone()
  const [loading, setLoading] = useState(false)
  const [errors, setErrors] = useState({})
  const [missingHints, setMissingHints] = useState({})

  // ⭐ จุดยึดบนสุด + ฟังก์ชันเลื่อนขึ้นบน (ให้เหมือนหน้า Sales)
  const pageTopRef = useRef(null)
  const scrollToPageTop = () => {
    try { pageTopRef.current?.scrollIntoView({ block: "start", behavior: "smooth" }) } catch { /* best-effort */ }
    const root = document.scrollingElement || document.documentElement || document.body
    try { root.scrollTo({ top: 0, behavior: "smooth" }) } catch { root.scrollTop = 0 }
  }

  // ฟอร์มสินค้า (handoff F30) + สาขา/คลัง (F23: คลังแยกตามสาขา)
  const productForms = useProductForms()
  const branchLock = useBranchLock()
  const [branchOptions, setBranchOptions] = useState([])
  const [branchStatus, setBranchStatus] = useState("loading")
  const [klangOptions, setKlangOptions] = useState([])
  const [klangStatus, setKlangStatus] = useState("idle")

  const initialForm = {
    form_id: "",

    // CarryOver (บังคับราคา 1 & 2, ปริมาณ, คลัง)
    co_branch: getActiveBranch() != null ? String(getActiveBranch()) : "",
    co_klang: "",
    price1: "",
    price2: "",
    co_available: "",
    comment: "", // ไม่บังคับ
  }

  const [form, setForm] = useState(initialForm)
  const update = (k, v) => setForm((p) => ({ ...p, [k]: v }))
  const selectedForm = productForms.findForm(form.form_id)

  /** ---------- Load branches ---------- */
  useEffect(() => {
    let alive = true
    get("/order/branch/search")
      .then((arr) => {
        if (!alive) return
        setBranchOptions((arr || []).map((b) => ({ id: String(b.id), label: String(b.branch_name ?? b.name ?? "") })))
        setBranchStatus("ready")
      })
      .catch(() => { if (alive) { setBranchOptions([]); setBranchStatus("error") } })
    return () => { alive = false }
  }, [])

  // ล็อกสาขา (scope own_branch) → สาขาที่ใช้งานอยู่
  useEffect(() => {
    if (!branchLock.locked || !branchLock.activeKey) return
    setForm((p) => (p.co_branch === branchLock.activeKey ? p : { ...p, co_branch: branchLock.activeKey, co_klang: "" }))
  }, [branchLock.locked, branchLock.activeKey])

  /** ---------- สาขา → คลัง ---------- */
  useEffect(() => {
    const bid = form.co_branch
    if (!bid) { setKlangOptions([]); setKlangStatus("idle"); return }
    let alive = true
    setKlangStatus("loading")
    get(`/order/klang/search?branch_id=${encodeURIComponent(bid)}`)
      .then((arr) => {
        if (!alive) return
        setKlangOptions((arr || []).map((k) => ({ id: String(k.id ?? k.klang_id ?? ""), label: String(k.klang_name ?? k.name ?? "ไม่ทราบชื่อคลัง") })))
        setKlangStatus("ready")
      })
      .catch(() => { if (alive) { setKlangOptions([]); setKlangStatus("error") } })
    return () => { alive = false }
  }, [form.co_branch])

  /** ---------- Derived ---------- */
  const pricesArr = useMemo(() => {
    const a = []
    const p1 = toNumber(form.price1)
    const p2 = toNumber(form.price2)
    if (form.price1 !== "" && p1 > 0) a.push(p1)
    if (form.price2 !== "" && p2 > 0) a.push(p2)
    return a
  }, [form.price1, form.price2])

  const totalValuation = useMemo(() => {
    const qty = toNumber(form.co_available)
    const price = pricesArr[0] ?? 0
    return qty > 0 && price > 0 ? qty * price : 0
  }, [pricesArr, form.co_available])

  const clearError = (key) =>
    setErrors((prev) => {
      if (!(key in prev)) return prev
      const { [key]: _omit, ...rest } = prev
      return rest
    })
  const clearHint = (key) => setMissingHints((prev) => (prev[key] ? { ...prev, [key]: false } : prev))

  /** ---------- Validate ---------- */
  const computeMissingHints = () => {
    const m = {}
    if (!form.form_id) m.form_id = true
    if (!form.co_branch) m.co_branch = true
    if (!form.co_klang) m.co_klang = true
    // บังคับราคา 1 และ 2 > 0
    if (!(toNumber(form.price1) > 0 && toNumber(form.price2) > 0)) m.prices = true
    // ปริมาณต้อง > 0
    if (form.co_available === "" || toNumber(form.co_available) <= 0) m.co_available = true
    return m
  }

  const validate = () => {
    const e = {}
    if (!form.form_id) e.form_id = "กรุณาเลือกฟอร์มสินค้า"
    else if (!selectedForm) e.form_id = "ฟอร์มสินค้านี้ใช้งานไม่ได้แล้ว เลือกฟอร์มอื่น"
    if (!form.co_branch) e.co_branch = "กรุณาเลือกสาขา"
    if (!form.co_klang) e.co_klang = "กรุณาเลือกคลังปลายทาง"
    // ต้องมีราคา 1 และ ราคา 2 และทั้งคู่ > 0
    if (!(toNumber(form.price1) > 0 && toNumber(form.price2) > 0)) {
      e.prices = "ต้องกรอกราคา 1 และ ราคา 2 มากกว่า 0"
    }
    if (form.co_available === "") e.co_available = "กรุณากรอกปริมาณยกมา"
    else if (toNumber(form.co_available) <= 0) e.co_available = "ปริมาณต้องมากกว่า 0"
    setErrors(e)
    return { ok: Object.keys(e).length === 0, e }
  }

  /** ---------- ===== Keyboard Flow: Enter ไล่โฟกัส + เปิด dropdown ถัดไป ===== ---------- */
  // refs เรียงซ้าย -> ขวา
  const productRef = useRef(null) // ฟอร์มสินค้า
  const branchRef = useRef(null)
  const klangRef = useRef(null)
  const coAvailableRef = useRef(null)
  const price1Ref = useRef(null)
  const price2Ref = useRef(null)
  const commentRef = useRef(null)
  const submitBtnRef = useRef(null)

  const orderedRefs = useMemo(
    () => [
      productRef,
      branchRef,
      klangRef,
      coAvailableRef,
      price1Ref,
      price2Ref,
      commentRef,
      submitBtnRef, // ปุ่ม
    ],
    []
  )

  const focusNextAndOpenIfCombo = (refObj) => {
    const idx = orderedRefs.findIndex((r) => r === refObj)
    if (idx === -1) return
    for (let i = idx + 1; i < orderedRefs.length; i++) {
      const el = orderedRefs[i]?.current
      if (el && !el.disabled && typeof el.focus === "function") {
        el.focus()
        // ถ้าเป็นปุ่มของ ComboBox ให้เปิด dropdown ทันที (ถ้ายังไม่เปิด)
        const hasPopup = el.getAttribute?.("aria-haspopup")
        if (hasPopup === "listbox") {
          const expanded = el.getAttribute("aria-expanded") === "true"
          if (!expanded) {
            // เปิดหลังจากโฟกัสแล้ว 1 เฟรม
            requestAnimationFrame(() => {
              if (el.getAttribute("aria-expanded") !== "true") el.click()
            })
          }
        }
        return
      }
    }
  }

  const onEnterKey = (e, currentRef) => {
    if (e.key === "Enter") {
      e.preventDefault()
      focusNextAndOpenIfCombo(currentRef)
    }
  }

  /** ---------- Helper: focus + scroll to first invalid ---------- */
  const fieldRefByKey = {
    form_id: productRef,
    co_branch: branchRef,
    co_klang: klangRef,
    co_available: coAvailableRef,
    prices: price1Ref,
  }

  const scrollAndFocus = (ref) => {
    const el = ref?.current
    if (!el) return
    try {
      el.scrollIntoView({ behavior: "smooth", block: "center" })
      // หากเป็น ComboBox (button) ให้โฟกัส + เปิดรายการเพื่อให้เลือกได้ทันที
      el.focus({ preventScroll: true })
      const hasPopup = el.getAttribute?.("aria-haspopup")
      if (hasPopup === "listbox" && el.getAttribute("aria-expanded") !== "true") {
        // เปิดหลังเลื่อนจบเล็กน้อย
        setTimeout(() => {
          if (el.getAttribute("aria-expanded") !== "true") el.click()
        }, 120)
      }
    } catch { /* scroll/focus best-effort */ }
  }

  const MISSING_ORDER = [
    "form_id",
    "co_branch",
    "co_klang",
    "co_available",
    "prices",
  ]

  const focusFirstInvalid = (hints, e) => {
    const firstKey = MISSING_ORDER.find((k) => hints[k] || e[k])
    if (!firstKey) return
    // ชี้แดงแบบ hint และโฟกัสช่องแรกที่ผิด
    setMissingHints((prev) => ({ ...prev, [firstKey]: true }))
    const ref = fieldRefByKey[firstKey]
    // รอให้ DOM อัปเดตแล้วค่อยเลื่อน
    setTimeout(() => scrollAndFocus(ref), 0)
  }

  /** ---------- Submit ---------- */
  const handleSubmit = async (e) => {
    e?.preventDefault?.()

    // เลื่อนขึ้นบนสุดให้เหมือนหน้า Sales
    scrollToPageTop()

    const hints = computeMissingHints()
    setMissingHints(hints)

    const { ok, e: ev } = validate()

    // แจ้งเตือนเมื่อฟอร์มไม่ผ่าน (toast แทน alert)
    if (!ok || Object.values(hints).some(Boolean)) {
      const missingKeys = MISSING_ORDER.filter((k) => hints[k])
      if (missingKeys.length) toast.error("กรอกไม่ครบ", { description: missingDescription(missingKeys) })
      else toast.error("ข้อมูลไม่ถูกต้อง", { description: Object.values(ev)[0] })
      focusFirstInvalid(hints, ev)
      return
    }

    const payload = {
      spec: specFromForm(selectedForm),
      co_klang: Number(form.co_klang),
      prices: pricesArr, // ต้องมี 2 ค่า (> 0)
      co_available: Number(form.co_available),
      comment: form.comment?.trim() || null,
    }

    setLoading(true)
    try {
      await post("/carryover/create", payload)

      toast.success("บันทึกยอดยกมาแล้ว", {
        description: `${nf(toNumber(form.co_available))} กก. · ${thb(totalValuation)}`,
      })

      // รีเซ็ตค่าทุกอย่าง + ล้าง error/hint + เด้งไปบนสุด + โฟกัสช่องแรก
      // คงฟอร์มสินค้า/สาขา/คลังไว้ (มักยกมาสินค้าเดิมซ้ำ)
      setForm((p) => ({ ...initialForm, form_id: p.form_id, co_branch: p.co_branch, co_klang: p.co_klang }))
      setErrors({})
      setMissingHints({})
      requestAnimationFrame(() => scrollToPageTop())
      try { submitBtnRef.current?.blur?.() } catch { /* blur best-effort */ }
      setTimeout(() => productRef.current?.focus(), 200)
    } catch (err) {
      console.error(err)
      const { title, description } = describeSaveError(err)
      toast.error(title, { description })
    } finally {
      setLoading(false)
    }
  }

  const handleReset = () => setForm((p) => ({ ...initialForm, co_branch: p.co_branch }))

  /** ---------- Sticky bar summary (<md) ---------- */
  const speciesLabel = selectedForm?.label
  const klangLabel = klangOptions.find((o) => String(o.id) === String(form.co_klang))?.label
  const barSummary = (
    <div className="min-w-0">
      <p className="truncate text-gray-900 dark:text-gray-100">
        {speciesLabel || klangLabel ? [speciesLabel, klangLabel].filter(Boolean).join(" · ") : "ยังไม่ได้เลือกฟอร์มสินค้า"}
      </p>
      <p className="tabular-nums text-gray-500 dark:text-gray-400">
        {nf(toNumber(form.co_available))} กก. · {thb(totalValuation)}
      </p>
    </div>
  )

  const cardSectionCls = cx(cardCls, "p-4 md:p-5 mb-4 md:mb-6")

  return (
    <div className="min-h-screen bg-white text-black dark:bg-slate-900 dark:text-white rounded-2xl text-[15px] md:text-base">
      <div className="mx-auto max-w-7xl p-4 md:p-6 lg:p-8">
        {/* จุดยึดสำหรับเลื่อนขึ้นบนสุด (เหมือนหน้า Sales) */}
        <div ref={pageTopRef} />

        <PageTitle title="ยอดยกมา" />

        {/* สินค้า — ฟอร์มสินค้าตัวเดียว + ชิปสเปค (handoff F30) */}
        <div className={cardSectionCls}>
          <h2 className={sectionTitleCls}>สินค้า</h2>
          <ProductFormPicker
            id="bringin-form"
            required
            forms={productForms}
            value={form.form_id}
            storageKey="bringIn.formTemplate"
            onChange={(id) => { clearError("form_id"); clearHint("form_id"); update("form_id", id) }}
            error={errors.form_id}
            hintRed={!!missingHints.form_id}
            clearHint={() => clearHint("form_id")}
            buttonRef={productRef}
            onEnterNext={() => focusNextAndOpenIfCombo(productRef)}
            className="md:max-w-2xl"
          />
        </div>

        {/* คลังปลายทาง & ปริมาณ */}
        <div className={cardSectionCls}>
          <h2 className={sectionTitleCls}>คลังปลายทางและปริมาณยกเข้า</h2>
          <div className="grid gap-4 md:grid-cols-3">
            <div>
              <label className={labelCls}>สาขา<span className="text-red-500"> *</span></label>
              <ComboBox
                title="สาขา"
                ariaLabel="สาขา"
                options={branchOptions}
                value={form.co_branch}
                getValue={getOptValue}
                onChange={(v) => { clearError("co_branch"); clearHint("co_branch"); setForm((p) => ({ ...p, co_branch: v, co_klang: "" })) }}
                error={!!errors.co_branch}
                hintRed={!!missingHints.co_branch}
                clearHint={() => clearHint("co_branch")}
                placeholder={branchStatus === "loading" ? "กำลังโหลดสาขา…" : "— เลือกสาขา —"}
                loading={branchStatus === "loading"}
                disabled={branchLock.locked}
                buttonRef={branchRef}
                enterMovesWhenFilled
                onEnterNext={() => focusNextAndOpenIfCombo(branchRef)}
              />
              {errors.co_branch && <p className={errorTextCls}>{errors.co_branch}</p>}
              {branchLock.locked && <BranchLockNote />}
            </div>

            <div>
              <label className={labelCls}>เลือกคลังปลายทาง<span className="text-red-500"> *</span></label>
              <ComboBox
                title="คลังปลายทาง"
                ariaLabel="คลังปลายทาง"
                options={klangOptions}
                value={form.co_klang}
                getValue={getOptValue}
                onChange={(v) => { clearError("co_klang"); clearHint("co_klang"); update("co_klang", v) }}
                error={!!errors.co_klang}
                hintRed={!!missingHints.co_klang}
                clearHint={() => clearHint("co_klang")}
                placeholder={!form.co_branch ? "เลือกสาขาก่อน" : klangStatus === "loading" ? "กำลังโหลดคลัง…" : "— เลือกคลัง —"}
                loading={klangStatus === "loading"}
                disabled={!form.co_branch}
                emptyText="สาขานี้ยังไม่มีคลัง"
                buttonRef={klangRef}
                enterMovesWhenFilled
                onEnterNext={() => focusNextAndOpenIfCombo(klangRef)}
              />
              {errors.co_klang && <p className={errorTextCls}>{errors.co_klang}</p>}
              {klangStatus === "error" && <p className={errorTextCls}>โหลดรายการคลังไม่สำเร็จ รีเฟรชหน้าแล้วลองใหม่</p>}
            </div>

            <div>
              <label htmlFor="co_available" className={labelCls}>ปริมาณยกมา (กก.)<span className="text-red-500"> *</span></label>
              <input
                id="co_available"
                ref={coAvailableRef}
                inputMode="decimal"
                className={cx(baseField, "tabular-nums", (errors.co_available || missingHints.co_available) && "border-red-500 ring-2 ring-red-300")}
                value={form.co_available}
                onChange={(e) => update("co_available", onlyDigits(e.target.value))}
                onFocus={() => { setErrors((p)=>({ ...p, co_available: undefined })); clearHint("co_available") }}
                onKeyDown={(e) => onEnterKey(e, coAvailableRef)}
                placeholder="เช่น 12000"
                aria-invalid={errors.co_available ? true : undefined}
              />
              {errors.co_available && <p className={errorTextCls}>{errors.co_available}</p>}
              <p className={helpTextCls}>ต้องมากกว่า 0</p>
            </div>
          </div>
        </div>

        {/* ราคายกเข้า */}
        <div className={cardSectionCls}>
          <h2 className={sectionTitleCls}>ราคายกเข้า<span className="text-red-500"> *</span></h2>
          <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
            <div>
              <label htmlFor="price1" className={labelCls}>ราคา 1 (บาท/กก.)</label>
              <input
                id="price1"
                ref={price1Ref}
                inputMode="decimal"
                className={cx(baseField, "tabular-nums", errors.prices && "border-red-400 ring-2 ring-red-300/70")}
                value={form.price1}
                onChange={(e) => update("price1", e.target.value.replace(/[^\d.]/g, ""))}
                onFocus={() => setErrors((p)=>({ ...p, prices: undefined }))}
                onKeyDown={(e) => onEnterKey(e, price1Ref)}
                placeholder="เช่น 9.50"
              />
              <p className={helpTextCls}>ต้องกรอกทั้ง 2 ช่อง</p>
            </div>

            <div>
              <label htmlFor="price2" className={labelCls}>ราคา 2 (บาท/กก.)</label>
              <input
                id="price2"
                ref={price2Ref}
                inputMode="decimal"
                className={cx(baseField, "tabular-nums", errors.prices && "border-red-400 ring-2 ring-red-300/70")}
                value={form.price2}
                onChange={(e) => update("price2", e.target.value.replace(/[^\d.]/g, ""))}
                onFocus={() => setErrors((p)=>({ ...p, prices: undefined }))}
                onKeyDown={(e) => onEnterKey(e, price2Ref)}
                placeholder="เช่น 15"
              />
            </div>

            <div className="col-span-2 md:col-span-1">
              <label className={labelCls}>มูลค่าประเมินรวม</label>
              <input disabled aria-label="มูลค่าประเมินรวม" className={cx(baseField, fieldDisabled, "tabular-nums")} value={thb(totalValuation)} />
              <p className={helpTextCls}>คำนวณจาก ราคา 1 × ปริมาณ</p>
            </div>
          </div>
          {errors.prices && <p className={errorTextCls}>{errors.prices}</p>}
        </div>

        {/* บันทึกเพิ่มเติม / เหตุผล (ผู้รับ) */}
        <div className={cardSectionCls}>
          <div className="grid gap-4 md:grid-cols-3">
            <div className="md:col-span-3">
              <label htmlFor="co_comment" className={labelCls}>บันทึกเพิ่มเติม / เหตุผล (ผู้รับ)</label>
              <input
                id="co_comment"
                ref={commentRef}
                className={baseField}
                value={form.comment}
                onChange={(e) => update("comment", e.target.value)}
                onKeyDown={(e) => onEnterKey(e, commentRef)}
                placeholder="เช่น ความชื้นสูง แกลบเยอะ หรือเหตุผลการที่ปฏิเสธ"
              />
            </div>
          </div>
        </div>

        {/* ปุ่ม — <md: แถบติดล่าง (UI-SPEC §7) · ≥md: ปุ่มเดิม (คง submitBtnRef สำหรับ Enter-flow) */}
        {isPhone ? (
          <StickyActionBar
            summary={barSummary}
            secondary={{ label: "ล้างฟอร์ม", onClick: handleReset, disabled: loading }}
            primary={{ label: loading ? "กำลังบันทึก…" : "บันทึก", onClick: handleSubmit, loading }}
          />
        ) : (
          <div className="mt-6 flex flex-col gap-3 sm:flex-row">
            <button
              ref={submitBtnRef}
              type="button"
              onClick={handleSubmit}
              onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); handleSubmit(e) } }}
              disabled={loading}
              className={submitBtnCls}
              aria-busy={loading ? "true" : "false"}
            >
              {loading && <span className={spinnerCls} aria-hidden="true" />}
              {loading ? "กำลังบันทึก..." : "บันทึก"}
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
      </div>
    </div>
  )
}

export default StockBringIn
