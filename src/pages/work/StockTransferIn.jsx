// src/pages/StockTransferIn.jsx
import { useEffect, useMemo, useRef, useState } from "react"
import { get, post } from "../../lib/api"
import { describeApiError } from "../../lib/apiErrors"
import { cx, baseField, fieldDisabled, labelCls, helpTextCls, errorTextCls, secondaryBtnCls } from "../../lib/styles"
import { PageLoader, EmptyState, ErrorState, Badge, DataList, StickyActionBar, toast } from "../../components/ui"
import { useIsPhone } from "../../hooks/useMediaQuery"
import DateInput from "../../components/ThaiDateField"
import PageTitle from "../../components/PageTitle"

/** ---------- Utils ---------- */
const onlyDigits = (s = "") => s.replace(/\D+/g, "")
const toInt = (v) => {
  const n = Number(onlyDigits(String(v ?? "")))
  return Number.isFinite(n) ? n : 0
}
const nf = (n) =>
  new Intl.NumberFormat("th-TH", { maximumFractionDigits: 2 }).format(isFinite(n) ? Number(n) : 0)
const thb = (n) =>
  new Intl.NumberFormat("th-TH", { style: "currency", currency: "THB", maximumFractionDigits: 2 }).format(
    isFinite(n) ? n : 0
  )

/** ชื่อฟิลด์สั้นสำหรับ toast "กรอกไม่ครบ" (mobile-copy §3.3) */
const FIELD_LABELS = {
  transfer_id: "คำขอที่จะรับเข้า",
  transfer_date: "วันที่รับเข้า",
  weight_in: "ชั่งเข้า",
  weight_out: "ชั่งออก",
  net_weight: "น้ำหนักสุทธิ",
  dest_quality: "คุณภาพ",
  impurity_percent: "สิ่งเจือปน",
  price_per_kilo: "ราคาต้นทุน/กก.",
}
const MISSING_ORDER = ["transfer_id", "transfer_date", "weight_in", "weight_out", "net_weight", "dest_quality", "impurity_percent", "price_per_kilo"]
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

/** แสดงข้อความจาก backend เฉพาะเมื่อเป็นภาษาไทยแล้ว ไม่งั้นใช้ข้อความกลาง */
const friendly = (e, fallback) => (/[฀-๿]/.test(e?.message || "") ? e.message : fallback)

/** สถานะคำขอโอน → ภาษาไทย (ค่าที่ไม่รู้จักแสดงตามเดิม) */
const TRANSFER_STATUS_TH = { pending: "รอรับ", approved: "รับแล้ว", confirmed: "รับแล้ว", rejected: "ปฏิเสธ" }
const statusLabel = (s) => TRANSFER_STATUS_TH[String(s ?? "").toLowerCase()] || s || "—"

/** ชื่อคลังจากคำขอ ถ้า backend ส่งมาแค่เลข id จะได้ค่าว่าง (ไม่แสดงเลข id) */
const klangNameOf = (r, side) => r?.[`${side}_klang_name`] || r?.[`${side}_klang`]?.klang_name || ""
const routeLabel = (r) => {
  const from = klangNameOf(r, "from")
  const to = klangNameOf(r, "to")
  return from || to ? `${from || "—"} → ${to || "—"}` : ""
}

/** ---------- Styles ---------- */
const sectionCardCls =
  "mb-4 md:mb-6 rounded-2xl border border-slate-200 bg-white p-4 md:p-5 shadow-sm dark:border-slate-700 dark:bg-slate-800"
const sectionTitleTextCls = "mb-3 text-lg md:text-xl font-semibold"
const rejectBtnCls =
  "inline-flex items-center justify-center rounded-xl border border-red-300 px-3 py-1.5 text-red-600 font-medium transition-colors duration-150 hover:bg-red-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-red-400 dark:border-red-800/70 dark:text-red-300 dark:hover:bg-red-900/20 cursor-pointer"

/** ---------- DateInput ---------- */
// ช่องวันที่ไทย (วัน เดือน พ.ศ.) ตัวกลาง — API เหมือน input เดิม (handoff F25)

/** ---------- Main Page (รับเข้า) + FormGuard ---------- */
function StockTransferIn() {
  const isPhone = useIsPhone()
  const [submitting, setSubmitting] = useState(false)

  /** ---------- Requests (inbox) ---------- */
  const [loadingRequests, setLoadingRequests] = useState(true)
  const [requests, setRequests] = useState([])
  const [requestsError, setRequestsError] = useState("")
  const [requestsLoadedOnce, setRequestsLoadedOnce] = useState(false)

  /** ---------- Form ---------- */
  const [form, setForm] = useState({
    transfer_id: null,
    transfer_date: new Date().toISOString().slice(0, 10),

    // ชั่ง/หมายเหตุฝั่งผู้รับ
    weight_in: "",   // กก. (จำนวนเต็ม)
    weight_out: "",  // กก. (จำนวนเต็ม)
    quality_note: "",

    // ต้องกรอก
    dest_quality: "",        // คุณภาพ (0–100)
    impurity_percent: "",    // สิ่งเจือปน (0–100)
    price_per_kilo: "",      // ราคาต้นทุน/กก. (> 0)
  })
  const update = (k, v) => setForm((p) => ({ ...p, [k]: v }))

  const weightIn = useMemo(() => toInt(form.weight_in), [form.weight_in])
  const weightOut = useMemo(() => toInt(form.weight_out), [form.weight_out])
  const netWeightInt = useMemo(() => Math.max(weightIn - weightOut, 0), [weightIn, weightOut])

  const pricePerKilo = useMemo(() => Number(form.price_per_kilo || 0), [form.price_per_kilo])
  const totalCost = useMemo(() => pricePerKilo * netWeightInt, [pricePerKilo, netWeightInt])

  /** ---------- FormGuard: state ---------- */
  const [errors, setErrors] = useState({})
  const [missingHints, setMissingHints] = useState({})

  const redFieldCls = (key) =>
    errors[key] || missingHints[key] ? "border-red-500 ring-2 ring-red-300 focus:ring-0 focus:border-red-500" : ""
  const redHintCls = (key) =>
    missingHints[key] ? "border-red-400 ring-2 ring-red-300 focus:border-red-400 animate-pulse" : ""
  const clearError = (key) =>
    setErrors((prev) => {
      if (!(key in prev)) return prev
      const { [key]: _omit, ...rest } = prev
      return rest
    })
  const clearHint = (key) => setMissingHints((prev) => (prev[key] ? { ...prev, [key]: false } : prev))

  /** ---------- โหลดรายการคำขอ ---------- */
  const requestsBoxRef = useRef(null)
  const reloadTokenRef = useRef(0)

  // ดึงรายการคำขอ — background=true สำหรับ polling (ไม่โชว์ skeleton/error ทับของเดิม)
  const loadRequests = async ({ background = false } = {}) => {
    const token = ++reloadTokenRef.current
    if (!background) {
      setLoadingRequests(true)
      setRequestsError("")
    }
    try {
      const data = await get(`/transfer/pending/incoming`)
      if (token !== reloadTokenRef.current) return
      setRequests(Array.isArray(data) ? data : [])
      setRequestsError("")
    } catch (err) {
      if (token !== reloadTokenRef.current) return
      // โพลล์พื้นหลังที่ล้มเหลว: เก็บข้อมูลเดิมไว้ ไม่ต้องโชว์ error ทับ
      if (!background) {
        setRequests([])
        setRequestsError(friendly(err, "โหลดคำขอโอนเข้าไม่สำเร็จ ลองใหม่อีกครั้ง"))
      }
    } finally {
      if (token === reloadTokenRef.current) {
        setLoadingRequests(false)
        setRequestsLoadedOnce(true)
      }
    }
  }

  useEffect(() => {
    loadRequests()
    const timer = setInterval(() => loadRequests({ background: true }), 20000)
    return () => clearInterval(timer)
  }, [])

  /** ---------- เลือกคำขอ ---------- */
  const pickRequest = (req) => {
    update("transfer_id", req.id ?? null)
    update("price_per_kilo", req?.price_per_kilo != null ? String(req.price_per_kilo) : "")
    update("weight_in", "")
    update("weight_out", "")
    update("impurity_percent", "")
    update("quality_note", "")
    update("dest_quality", "")
    setErrors({})
    setMissingHints({})
  }

  /** ---------- FormGuard: Enter-next + focus order ---------- */
  const dateRef = useRef(null)
  const weightInRef = useRef(null)
  const weightOutRef = useRef(null)
  const destQualityRef = useRef(null)
  const impurityRef = useRef(null)
  const priceRef = useRef(null)

  // Anchor (โฟกัสได้) สำหรับช่องรวมต้นทุน (disabled)
  const totalCostAnchorRef = useRef(null)

  const noteRef = useRef(null)
  const submitBtnRef = useRef(null)

  // ORDER ตามต้องการ: weight_out → dest_quality → impurity → price_per_kilo → total_cost → submit
  const orderedRefs = [
    dateRef,
    weightInRef,
    weightOutRef,
    destQualityRef,
    impurityRef,
    priceRef,
    totalCostAnchorRef,
    submitBtnRef,
  ]

  const focusNext = (refObj) => {
    const idx = orderedRefs.findIndex((r) => r === refObj)
    if (idx === -1) return
    for (let i = idx + 1; i < orderedRefs.length; i++) {
      const el = orderedRefs[i]?.current
      if (el && typeof el.focus === "function") {
        el.focus()
        return
      } else if (el?.querySelector) {
        // โฟกัสลูกที่โฟกัสได้ (เช่นภายใน container)
        const focusable = el.querySelector('input,button,select,textarea,[tabindex]:not([tabindex="-1"])')
        if (focusable) {
          focusable.focus()
          return
        }
      }
    }
  }

  const onEnterKey = (e, currentRef) => {
    if (e.key === "Enter") {
      e.preventDefault()
      focusNext(currentRef)
    }
  }

  /** ---------- FormGuard: validate + scroll-to-first-invalid ---------- */
  const computeMissingHints = () => {
    const m = {}
    if (!form.transfer_id) m.transfer_id = true
    if (!form.transfer_date) m.transfer_date = true
    if (form.weight_in === "" || weightIn <= 0) m.weight_in = true
    if (form.weight_out === "" || weightOut < 0) m.weight_out = true
    if (netWeightInt <= 0) m.net_weight = true

    const dq = Number(form.dest_quality)
    if (form.dest_quality === "" || !isFinite(dq) || dq < 0 || dq > 100) m.dest_quality = true

    const ip = Number(form.impurity_percent)
    if (form.impurity_percent === "" || !isFinite(ip) || ip < 0 || ip > 100) m.impurity_percent = true

    const ppk = Number(form.price_per_kilo)
    if (form.price_per_kilo === "" || !isFinite(ppk) || ppk <= 0) m.price_per_kilo = true

    return m
  }

  const validate = () => {
    const e = {}
    if (!form.transfer_date) e.transfer_date = "กรุณาเลือกวันที่รับเข้า"
    if (!form.transfer_id) e.transfer_id = "กรุณาเลือกคำขอโอนจากรายการด้านบนก่อน"
    if (form.weight_in === "" || weightIn <= 0) e.weight_in = "น้ำหนักชั่งเข้า ต้องเป็นจำนวนเต็มมากกว่า 0"
    if (form.weight_out === "" || weightOut < 0) e.weight_out = "น้ำหนักชั่งออก ต้องเป็นจำนวนเต็ม (≥ 0)"
    if (netWeightInt <= 0) e.net_weight = "น้ำหนักสุทธิต้องมากกว่า 0 (ชั่งเข้า − ชั่งออก)"

    const dq = Number(form.dest_quality)
    if (form.dest_quality === "") e.dest_quality = "กรุณากรอกคุณภาพ (0–100)"
    else if (!isFinite(dq) || dq < 0 || dq > 100) e.dest_quality = "คุณภาพต้องเป็นตัวเลข 0–100"

    const ip = Number(form.impurity_percent)
    if (form.impurity_percent === "") e.impurity_percent = "กรุณากรอกสิ่งเจือปน (%)"
    else if (!isFinite(ip) || ip < 0 || ip > 100) e.impurity_percent = "สิ่งเจือปนต้องเป็นตัวเลข 0–100"

    const ppk = Number(form.price_per_kilo)
    if (form.price_per_kilo === "") e.price_per_kilo = "กรุณากรอกราคาต้นทุน/กก."
    else if (!isFinite(ppk) || ppk <= 0) e.price_per_kilo = "ราคาต้นทุน/กก. ต้องมากกว่า 0"

    setErrors(e)
    return { ok: Object.keys(e).length === 0, e }
  }

  const fieldRefByKey = {
    transfer_id: requestsBoxRef,   // ชี้ไปที่กล่องรายการคำขอ
    transfer_date: dateRef,
    weight_in: weightInRef,
    weight_out: weightOutRef,
    net_weight: weightInRef,       // ให้ไปเริ่มที่ชั่งเข้า
    dest_quality: destQualityRef,
    impurity_percent: impurityRef,
    price_per_kilo: priceRef,
  }

  const scrollAndFocus = (ref) => {
    const el = ref?.current
    if (!el) return
    try {
      el.scrollIntoView({ behavior: "smooth", block: "center" })
      if (typeof el.focus === "function") {
        el.focus({ preventScroll: true })
      } else if (el.querySelector) {
        const focusable = el.querySelector('input,button,select,textarea,[tabindex]:not([tabindex="-1"])')
        focusable?.focus({ preventScroll: true })
      }
    } catch { /* scroll/focus best-effort */ }
  }

  const focusFirstInvalid = (hints, e) => {
    const firstKey = MISSING_ORDER.find((k) => hints[k] || e[k])
    if (!firstKey) return
    setMissingHints((prev) => ({ ...prev, [firstKey]: true }))
    const ref = fieldRefByKey[firstKey]
    setTimeout(() => scrollAndFocus(ref), 0)
  }

  /** ---------- Submit (ACCEPT) + FormGuard flow ---------- */
  const handleSubmit = async (e) => {
    e?.preventDefault?.()
    const hints = computeMissingHints()
    setMissingHints(hints)
    const { ok, e: ev } = validate()
    if (!ok) {
      focusFirstInvalid(hints, ev)
      const missingKeys = MISSING_ORDER.filter((k) => hints[k] && k !== "net_weight" && (form[k] === "" || form[k] == null))
      if (missingKeys.length) toast.error("กรอกไม่ครบ", { description: missingDescription(missingKeys) })
      else toast.error("ข้อมูลไม่ถูกต้อง", { description: Object.values(ev)[0] })
      return
    }

    // payload สำหรับยืนยันรับเข้า
    const payload = {
      action: "ACCEPT",
      dest_entry_weight: weightIn,                 // จำนวนเต็ม
      dest_exit_weight: weightOut,                 // จำนวนเต็ม
      dest_weight: netWeightInt,                   // จำนวนเต็ม (สำคัญ! TempStock เป็น Integer)
      dest_impurity: Number(form.impurity_percent),
      dest_quality: Number(form.dest_quality),
      receiver_note: form.quality_note?.trim() || null,
      dest_price: pricePerKilo * netWeightInt,
    }

    setSubmitting(true)
    try {
      await post(`/transfer/confirm/${encodeURIComponent(form.transfer_id)}`, payload)
      toast.success("รับเข้าแล้ว", {
        description: `คำขอ #${form.transfer_id} · สุทธิ ${nf(netWeightInt)} กก. · ${thb(totalCost)}`,
      })

      // ล้างฟอร์ม (ยกเว้นวันที่), รีโหลดรายการ, เด้งไปบนสุด + โฟกัสวันที่
      setForm((f) => ({
        ...f,
        transfer_id: null,
        weight_in: "",
        weight_out: "",
        quality_note: "",
        impurity_percent: "",
        price_per_kilo: "",
        dest_quality: "",
      }))
      setErrors({})
      setMissingHints({})
      window.scrollTo({ top: 0, behavior: "smooth" })
      setTimeout(() => dateRef.current?.focus(), 200)

      // รีโหลดรายการรอรับเข้า (background: เก็บรายการเดิมไว้ถ้าล้มเหลว)
      loadRequests({ background: true })
    } catch (err) {
      console.error(err)
      const msg = err?.message || ""
      if (/Integer|จำนวนเต็ม|whole kg|move quantity/i.test(msg)) {
        toast.error("บันทึกไม่สำเร็จ", { description: "ต้องกรอกน้ำหนักเป็นจำนวนเต็มกก. เท่านั้น" })
      } else if (/Insufficient stock|409/.test(msg)) {
        toast.error("สต็อกต้นทางไม่พอ", { description: "ติดต่อสาขาต้นทางก่อนรับเข้า" })
      } else {
        const { title, description } = describeSaveError(err)
        toast.error(title, { description })
      }
    } finally {
      setSubmitting(false)
    }
  }

  const handleReset = () =>
    setForm((f) => ({
      ...f,
      transfer_id: null,
      weight_in: "",
      weight_out: "",
      quality_note: "",
      impurity_percent: "",
      price_per_kilo: "",
      dest_quality: "",
    }))

  /** ---------- Reject ---------- */
  const handleReject = async (reqId) => {
    if (!reqId) return
    const note = prompt("ระบุเหตุผลที่ปฏิเสธ (ถ้ามี):") ?? ""
    try {
      await post(`/transfer/confirm/${encodeURIComponent(reqId)}`, {
        action: "REJECT",
        receiver_note: note.trim() || null,
      })
      toast.success("ปฏิเสธคำขอแล้ว", { description: `คำขอ #${reqId}` })
      loadRequests({ background: true })
    } catch (e) {
      console.error(e)
      const { title, description } = describeSaveError(e)
      toast.error(title === "บันทึกไม่สำเร็จ" ? "ปฏิเสธไม่สำเร็จ" : title, { description })
    }
  }

  const rejectSelected = () => {
    if (!form.transfer_id) {
      toast.warning("ยังไม่ได้เลือกรายการ", { description: "เลือกคำขอก่อน แล้วค่อยปฏิเสธ" })
      return
    }
    handleReject(form.transfer_id)
  }

  const requestsEmpty = (
    <EmptyState
      title="ไม่มีรายการรอรับเข้า"
      description="เมื่อสาขาอื่นโอนออกมาที่สาขาที่ใช้งานอยู่ รายการจะขึ้นที่นี่ · ดูของสาขาอื่นให้สลับสาขาที่แถบด้านบน"
      action={
        <button type="button" className={cx(secondaryBtnCls, "h-11 !py-0")} onClick={() => loadRequests()}>
          รีเฟรช
        </button>
      }
    />
  )

  /** ---------- Sticky bar summary (<md) ---------- */
  const barSummary = (
    <div className="min-w-0">
      <p className="truncate text-gray-900 dark:text-gray-100">
        {form.transfer_id ? `คำขอ #${form.transfer_id} · สุทธิ ${nf(netWeightInt)} กก.` : "ยังไม่ได้เลือกรายการ"}
      </p>
      <p className="tabular-nums text-gray-500 dark:text-gray-400">รวมต้นทุน {thb(totalCost)}</p>
    </div>
  )

  return (
    <div className="min-h-screen bg-white text-black dark:bg-slate-900 dark:text-white rounded-2xl text-[15px] md:text-base">
      <div className="mx-auto max-w-7xl p-4 md:p-6 lg:p-8">
        <PageTitle title="รับเข้าข้าวเปลือก" />

        {/* คำขอที่รอเข้าจาก backend */}
        <div
          ref={requestsBoxRef}
          className={cx(
            sectionCardCls,
            "transition-shadow duration-150",
            (errors.transfer_id || missingHints.transfer_id) && "ring-2 ring-red-300"
          )}
        >
          <div className="mb-3 flex flex-wrap items-center gap-x-3 gap-y-1">
            <h2 className="text-lg md:text-xl font-semibold">คำขอโอนเข้าที่รอดำเนินการ</h2>
            <p className="basis-full text-sm text-slate-500 dark:text-slate-400">
              แสดงเฉพาะรายการที่โอนมายังสาขาที่ใช้งานอยู่ (แถบด้านบน) — ต้องการดูของสาขาอื่น ให้สลับสาขาที่แถบด้านบน
            </p>
            {loadingRequests && !requestsLoadedOnce ? (
              <Badge tone="neutral">กำลังโหลด…</Badge>
            ) : requestsError ? (
              <Badge tone="danger">โหลดไม่สำเร็จ</Badge>
            ) : (
              <Badge tone="success">ทั้งหมด {requests.length} รายการ</Badge>
            )}
          </div>

          {isPhone ? (
            requestsError && !(loadingRequests && !requestsLoadedOnce) ? (
              <ErrorState message={requestsError} onRetry={() => loadRequests()} />
            ) : (
              <DataList
                items={requests}
                keyOf={(r) => r.id}
                loading={loadingRequests && !requestsLoadedOnce}
                skeletonRows={2}
                emptyState={requestsEmpty}
                title={(r) => `คำขอ #${r.id}`}
                subtitle={(r) => [routeLabel(r), statusLabel(r.status)].filter(Boolean).join(" · ")}
                badge={(r) => (String(form.transfer_id ?? "") === String(r.id) ? <Badge tone="success">เลือกแล้ว</Badge> : null)}
                fields={(r) =>
                  r.price_per_kilo != null
                    ? [{ label: "ราคาต้นทุน/กก. ที่เสนอ", value: () => `${Number(r.price_per_kilo).toFixed(2)} บาท`, align: "right", span: 2 }]
                    : []
                }
                actions={(r) => (
                  <>
                    <button type="button" onClick={() => handleReject(r.id)} className={cx(rejectBtnCls, "h-11 px-4")}>
                      ปฏิเสธ
                    </button>
                    <button type="button" onClick={() => pickRequest(r)} className={cx(secondaryBtnCls, "h-11 !py-0")}>
                      เลือก
                    </button>
                  </>
                )}
              />
            )
          ) : loadingRequests && !requestsLoadedOnce ? (
            <PageLoader variant="cards" rows={2} message="กำลังโหลดรายการโอนเข้า…" />
          ) : requestsError ? (
            <ErrorState message={requestsError} onRetry={() => loadRequests()} />
          ) : requests.length === 0 ? (
            requestsEmpty
          ) : (
            <div className="grid gap-3 md:grid-cols-2">
              {requests.map((req) => {
                const isPicked = String(form.transfer_id ?? "") === String(req.id)
                return (
                <div
                  key={req.id}
                  className={cx(
                    "rounded-2xl bg-white p-4 text-black shadow-sm ring-1 transition-shadow duration-150 dark:bg-slate-800 dark:text-white",
                    isPicked
                      ? "ring-2 ring-emerald-400 dark:ring-emerald-500"
                      : "ring-slate-200 dark:ring-slate-700 hover:shadow-md"
                  )}
                >
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2 font-semibold">
                      เลขคำขอ: {req.id}
                      {isPicked && <Badge tone="success">เลือกแล้ว</Badge>}
                    </div>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => handleReject(req.id)}
                        className={rejectBtnCls}
                      >
                        ปฏิเสธ
                      </button>
                      <button
                        type="button"
                        onClick={() => pickRequest(req)}
                        className="rounded-xl bg-emerald-600 px-3 py-1.5 text-white font-medium transition-colors duration-150 hover:bg-emerald-700 active:scale-[.98] focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-slate-800 cursor-pointer"
                      >
                        รับเข้า
                      </button>
                    </div>
                  </div>
                  <div className="mt-2 space-y-0.5 text-sm text-slate-700 dark:text-slate-300">
                    {klangNameOf(req, "from") && <div>จากคลัง: {klangNameOf(req, "from")}</div>}
                    {klangNameOf(req, "to") && <div>ไปคลัง: {klangNameOf(req, "to")}</div>}
                    <div>สถานะ: {statusLabel(req.status)}</div>
                    {req.price_per_kilo != null && (
                      <div>ราคาต้นทุน/กก. ที่เสนอ: <span className="tabular-nums">{Number(req.price_per_kilo).toFixed(2)}</span> บาท</div>
                    )}
                  </div>
                </div>
                )
              })}
            </div>
          )}
          {errors.transfer_id && requests.length > 0 && (
            <p className="mt-3 text-sm text-red-600 dark:text-red-400">{errors.transfer_id}</p>
          )}
        </div>

        {/* ฟอร์มรับเข้า */}
        <form onSubmit={handleSubmit}>
          {/* กล่อง: ข้อมูลการรับเข้า */}
          <div className={sectionCardCls}>
            <h2 className={sectionTitleTextCls}>ข้อมูลการรับเข้า</h2>

            <div className="grid gap-4 md:grid-cols-3">
              <div>
                <label htmlFor="transfer_date" className={labelCls}>วันที่รับเข้า</label>
                <DateInput
                  id="transfer_date"
                  ref={dateRef}
                  value={form.transfer_date}
                  onChange={(e) => {
                    clearError("transfer_date")
                    clearHint("transfer_date")
                    update("transfer_date", e.target.value)
                  }}
                  onKeyDown={(e) => onEnterKey(e, dateRef)}
                  error={!!errors.transfer_date}
                  className={redHintCls("transfer_date")}
                  aria-invalid={errors.transfer_date ? true : undefined}
                />
                {errors.transfer_date && <p className={errorTextCls}>{errors.transfer_date}</p>}
              </div>

              <div>
                <label htmlFor="transfer_id_display" className={labelCls}>เลขคำขอที่เลือก</label>
                <input
                  id="transfer_id_display"
                  disabled
                  className={cx(baseField, fieldDisabled)}
                  value={form.transfer_id ?? ""}
                  placeholder="ยังไม่ได้เลือกรายการ"
                />
                {!form.transfer_id && !errors.transfer_id && <p className={helpTextCls}>แตะรายการด้านบนเพื่อรับเข้า</p>}
                {errors.transfer_id && <p className={errorTextCls}>{errors.transfer_id}</p>}
              </div>
            </div>
          </div>

          {/* กล่อง: ชั่งน้ำหนักและบันทึก */}
          <div className={sectionCardCls}>
            <h2 className={sectionTitleTextCls}>ชั่งน้ำหนักและบันทึก</h2>

            {/* แถวที่ 1: น้ำหนักเข้า/ออก/สุทธิ */}
            <div className="grid grid-cols-2 gap-4 md:grid-cols-3">
              <div>
                <label htmlFor="weight_in" className={labelCls}>น้ำหนักชั่งเข้า (กก.)</label>
                <input
                  id="weight_in"
                  ref={weightInRef}
                  inputMode="numeric"
                  pattern="[0-9]*"
                  className={cx(baseField, "tabular-nums", redFieldCls("weight_in"))}
                  value={form.weight_in}
                  onChange={(e) => update("weight_in", onlyDigits(e.target.value))}
                  onFocus={() => {
                    clearError("weight_in")
                    clearHint("weight_in")
                  }}
                  onKeyDown={(e) => onEnterKey(e, weightInRef)}
                  placeholder="เช่น 15000"
                  aria-invalid={errors.weight_in ? true : undefined}
                />
                {errors.weight_in && <p className={errorTextCls}>{errors.weight_in}</p>}
                <p className={helpTextCls}>* ต้องเป็นจำนวนเต็มกิโลกรัม</p>
              </div>

              <div>
                <label htmlFor="weight_out" className={labelCls}>น้ำหนักชั่งออก (กก.)</label>
                <input
                  id="weight_out"
                  ref={weightOutRef}
                  inputMode="numeric"
                  pattern="[0-9]*"
                  className={cx(baseField, "tabular-nums", redFieldCls("weight_out"))}
                  value={form.weight_out}
                  onChange={(e) => update("weight_out", onlyDigits(e.target.value))}
                  onFocus={() => {
                    clearError("weight_out")
                    clearHint("weight_out")
                  }}
                  onKeyDown={(e) => onEnterKey(e, weightOutRef)}
                  placeholder="เช่น 2000"
                  aria-invalid={errors.weight_out ? true : undefined}
                />
                {errors.weight_out && <p className={errorTextCls}>{errors.weight_out}</p>}
                <p className={helpTextCls}>* ต้องเป็นจำนวนเต็มกิโลกรัม</p>
              </div>

              <div className="col-span-2 md:col-span-1">
                {isPhone ? (
                  <div
                    className={cx(
                      "rounded-2xl bg-gray-50 p-4 ring-1 ring-indigo-200/60 dark:bg-gray-800/60 dark:ring-indigo-500/30",
                      errors.net_weight && "ring-red-300 dark:ring-red-500/50"
                    )}
                    role="status"
                    aria-live="polite"
                  >
                    <p className="text-sm text-gray-500 dark:text-gray-400">น้ำหนักสุทธิ</p>
                    <p className="mt-0.5 text-xl font-bold tabular-nums text-gray-900 dark:text-gray-100">{nf(netWeightInt)} กก.</p>
                    <p className={helpTextCls}>คำนวณ = ชั่งเข้า − ชั่งออก</p>
                  </div>
                ) : (
                  <>
                    <label className={labelCls}>น้ำหนักสุทธิ (กก.)</label>
                    <input
                      disabled
                      aria-label="น้ำหนักสุทธิ (กก.)"
                      className={cx(baseField, fieldDisabled)}
                      value={netWeightInt}
                    />
                    <p className={helpTextCls}>คำนวณ = ชั่งเข้า − ชั่งออก</p>
                  </>
                )}
                {errors.net_weight && <p className={errorTextCls}>{errors.net_weight}</p>}
              </div>
            </div>

            {/* แถวที่ 2: คุณภาพ & สิ่งเจือปน */}
            <div className="mt-4 grid grid-cols-2 gap-4 md:grid-cols-3">
              <div>
                <label htmlFor="dest_quality" className={labelCls}>คุณภาพ <span className="text-red-500">*</span></label>
                <input
                  id="dest_quality"
                  ref={destQualityRef}
                  inputMode="numeric"
                  pattern="[0-9]*"
                  className={cx(baseField, "tabular-nums", redFieldCls("dest_quality"))}
                  value={form.dest_quality}
                  onChange={(e) => update("dest_quality", onlyDigits(e.target.value))}
                  onFocus={() => { clearError("dest_quality"); clearHint("dest_quality") }}
                  onKeyDown={(e) => onEnterKey(e, destQualityRef)}
                  placeholder="กรอก 0–100"
                  aria-invalid={errors.dest_quality ? true : undefined}
                />
                {errors.dest_quality && <p className={errorTextCls}>{errors.dest_quality}</p>}
              </div>

              <div>
                <label htmlFor="impurity_percent" className={labelCls}>สิ่งเจือปน (%) <span className="text-red-500">*</span></label>
                <input
                  id="impurity_percent"
                  ref={impurityRef}
                  inputMode="decimal"
                  className={cx(baseField, "tabular-nums", redFieldCls("impurity_percent"))}
                  value={form.impurity_percent}
                  onChange={(e) => {
                    const v = e.target.value.replace(/[^\d.]/g, "")
                    update("impurity_percent", v)
                  }}
                  onFocus={() => { clearError("impurity_percent"); clearHint("impurity_percent") }}
                  onKeyDown={(e) => onEnterKey(e, impurityRef)}
                  placeholder="กรอก 0–100"
                  aria-invalid={errors.impurity_percent ? true : undefined}
                />
                {errors.impurity_percent && <p className={errorTextCls}>{errors.impurity_percent}</p>}
                <p className={helpTextCls}>กรอกเป็นตัวเลข 0–100</p>
              </div>
            </div>
          </div>

          {/* กล่อง: ต้นทุนและคุณภาพ */}
          <div className={sectionCardCls}>
            <h2 className={sectionTitleTextCls}>ต้นทุนและคุณภาพ</h2>
            <div className="grid gap-4 md:grid-cols-3">
              <div>
                <label htmlFor="price_per_kilo" className={labelCls}>ราคาต้นทุน/กก. (บาท) <span className="text-red-500">*</span></label>
                <input
                  id="price_per_kilo"
                  ref={priceRef}
                  inputMode="decimal"
                  className={cx(baseField, "tabular-nums", redFieldCls("price_per_kilo"))}
                  value={form.price_per_kilo}
                  onChange={(e) => update("price_per_kilo", e.target.value.replace(/[^\d.]/g, ""))}
                  onFocus={() => { clearError("price_per_kilo"); clearHint("price_per_kilo") }}
                  onKeyDown={(e) => onEnterKey(e, priceRef)}
                  placeholder="เช่น 9.50"
                  aria-invalid={errors.price_per_kilo ? true : undefined}
                />
                {errors.price_per_kilo && <p className={errorTextCls}>{errors.price_per_kilo}</p>}
                <p className={helpTextCls}>ต้องมากกว่า 0</p>
              </div>

              {/* Anchor (focusable) ครอบช่องรวมต้นทุน */}
              <div
                ref={totalCostAnchorRef}
                tabIndex={0}
                role="group"
                aria-label="รวมต้นทุน (ประมาณ)"
                onKeyDown={(e) => onEnterKey(e, totalCostAnchorRef)}
                className="focus:outline-none focus:ring-2 focus:ring-indigo-500/30 rounded-2xl"
              >
                <label className={labelCls}>รวมต้นทุน (ประมาณ)</label>
                <input disabled aria-label="รวมต้นทุน (ประมาณ)" className={cx(baseField, fieldDisabled, "tabular-nums")} value={thb(totalCost)} placeholder="—" />
                <p className={helpTextCls}>คำนวณ = ราคาต้นทุน/กก. × น้ำหนักสุทธิ</p>
              </div>
            </div>
          </div>

          {/* บันทึกเพิ่มเติม */}
          <div className={sectionCardCls}>
            <div className="grid gap-4 md:grid-cols-3">
              <div className="md:col-span-3">
                <label htmlFor="quality_note" className={labelCls}>บันทึกเพิ่มเติม / เหตุผล (ผู้รับ)</label>
                <input
                  id="quality_note"
                  ref={noteRef}
                  className={baseField}
                  value={form.quality_note}
                  onChange={(e) => update("quality_note", e.target.value)}
                  placeholder="เช่น ความชื้นสูง แกลบเยอะ หรือเหตุผลกรณีปฏิเสธ"
                />
              </div>
            </div>
            {isPhone && (
              <button type="button" onClick={rejectSelected} className={cx(rejectBtnCls, "mt-4 h-11 w-full px-4")}>
                ปฏิเสธคำขอที่เลือก
              </button>
            )}
          </div>

          {/* ปุ่ม — <md: แถบติดล่าง (UI-SPEC §7) · ≥md: ปุ่มเดิม (submitBtnRef อยู่ใน Enter chain) */}
          {isPhone ? (
            <StickyActionBar
              summary={barSummary}
              secondary={{ label: "ล้างฟอร์ม", onClick: handleReset, disabled: submitting }}
              primary={{ label: submitting ? "กำลังบันทึก…" : "รับเข้า", onClick: handleSubmit, loading: submitting }}
            />
          ) : (
            <div className="mt-6 flex flex-col gap-3 sm:flex-row">
              <button
                ref={submitBtnRef}
                type="submit"
                disabled={submitting}
                className="inline-flex items-center justify-center rounded-2xl
                  bg-emerald-600 px-6 py-3 text-base font-semibold text-white
                  shadow-[0_6px_16px_rgba(16,185,129,0.35)]
                  transition-all duration-300 ease-out
                  hover:bg-emerald-700 hover:shadow-[0_8px_20px_rgba(16,185,129,0.45)]
                  hover:scale-[1.05] active:scale-[.97]
                  disabled:opacity-60 disabled:cursor-not-allowed cursor-pointer"
                aria-busy={submitting ? "true" : "false"}
              >
                {submitting ? "กำลังบันทึก..." : "บันทึก"}
              </button>

              <button
                type="button"
                onClick={rejectSelected}
                className="inline-flex items-center justify-center rounded-2xl
                  border border-red-300 bg-white px-6 py-3 text-base font-semibold text-red-600
                  shadow-sm transition-all duration-300 ease-out
                  hover:bg-red-50 hover:shadow-md hover:scale-[1.03]
                  active:scale-[.97] cursor-pointer
                  dark:border-red-500/40 dark:bg-red-500/10 dark:text-red-300
                  dark:hover:bg-red-500/20"
              >
                ปฏิเสธคำขอ
              </button>

              <button
                type="button"
                onClick={handleReset}
                className="inline-flex items-center justify-center rounded-2xl
                  border border-slate-300 bg-white px-6 py-3 text-base font-medium text-slate-700
                  shadow-sm
                  transition-all duration-300 ease-out
                  hover:bg-slate-100 hover:shadow-md hover:scale-[1.03]
                  active:scale-[.97]
                  dark:border-slate-600 dark:bg-slate-700/60 dark:text-white
                  dark:hover:bg-slate-700/50 dark:hover:shadow-lg cursor-pointer"
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

export default StockTransferIn
