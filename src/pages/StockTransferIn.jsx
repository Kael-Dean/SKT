// src/pages/StockTransferIn.jsx
import { useEffect, useMemo, useRef, useState, forwardRef, useImperativeHandle } from "react"

/** ---------- ENV ---------- */
const API_BASE = import.meta.env.VITE_API_BASE || ""

/** ---------- Utils ---------- */
const toNumber = (v) => (v === "" || v === null || v === undefined ? 0 : Number(v))
const thb = (n) =>
  new Intl.NumberFormat("th-TH", { style: "currency", currency: "THB", maximumFractionDigits: 2 }).format(
    isFinite(n) ? n : 0
  )
const cx = (...a) => a.filter(Boolean).join(" ")

/** ---------- Styles ---------- */
const baseField =
  "w-full rounded-2xl border border-slate-300 bg-slate-100 p-3 text-[15px] md:text-base " +
  "text-black outline-none placeholder:text-slate-500 focus:border-emerald-600 focus:ring-2 focus:ring-emerald-500/30 shadow-none " +
  "dark:border-slate-500 dark:bg-slate-700 dark:text-slate-100 dark:placeholder:text-slate-300 dark:focus:border-emerald-400 dark:focus:ring-emerald-400/30"

const fieldDisabled =
  "bg-slate-100 text-slate-600 cursor-not-allowed opacity-95 dark:bg-slate-700/70 dark:text-slate-300"
const labelCls = "mb-1 block text-[15px] md:text-base font-medium text-slate-700 dark:text-slate-200"
const helpTextCls = "mt-1 text-sm text-slate-600 dark:text-slate-300"
const errorTextCls = "mt-1 text-sm text-red-500"

/** ---------- Auth + helpers ---------- */
const authHeader = () => {
  const token = localStorage.getItem("token")
  return {
    "Content-Type": "application/json",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  }
}

// ยิง path แรกที่ ok แล้วคืน json
const fetchFirstOkJson = async (paths = []) => {
  for (const p of paths) {
    try {
      const r = await fetch(`${API_BASE}${p}`, { headers: authHeader() })
      if (r.ok) {
        const data = await r.json()
        if (Array.isArray(data)) return data
        if (data && typeof data === "object") return data
      }
    } catch (_) {}
  }
  return Array.isArray(paths) ? [] : {}
}

/** ---------- ComboBox ---------- */
function ComboBox({
  options = [],
  value,
  onChange,
  placeholder = "— เลือก —",
  getLabel = (o) => o?.label ?? "",
  getValue = (o) => o?.id ?? o?.value ?? "",
  disabled = false,
  error = false,
  buttonRef = null,
  hintRed = false,
  clearHint = () => {},
}) {
  const [open, setOpen] = useState(false)
  const [highlight, setHighlight] = useState(-1)
  const boxRef = useRef(null)
  const listRef = useRef(null)
  const internalBtnRef = useRef(null)
  const controlRef = buttonRef || internalBtnRef

  const selectedLabel = useMemo(() => {
    const found = options.find((o) => String(getValue(o)) === String(value))
    return found ? getLabel(found) : ""
  }, [options, value, getLabel, getValue])

  useEffect(() => {
    const onClick = (e) => {
      if (!boxRef.current) return
      if (!boxRef.current.contains(e.target)) {
        setOpen(false)
        setHighlight(-1)
      }
    }
    document.addEventListener("click", onClick)
    return () => document.removeEventListener("click", onClick)
  }, [])

  const commit = (opt) => {
    const v = String(getValue(opt))
    onChange?.(v, opt)
    setOpen(false)
    setHighlight(-1)
    clearHint?.()
    requestAnimationFrame(() => controlRef.current?.focus())
  }

  const scrollHighlightedIntoView = (index) => {
    const listEl = listRef.current
    const itemEl = listEl?.children?.[index]
    if (!listEl || !itemEl) return
    const itemRect = itemEl.getBoundingClientRect()
    const listRect = listEl.getBoundingClientRect()
    const buffer = 6
    if (itemRect.top < listRect.top + buffer) {
      listEl.scrollTop -= (listRect.top + buffer) - itemRect.top
    } else if (itemRect.bottom > listRect.bottom - buffer) {
      listEl.scrollTop += itemRect.bottom - (listRect.bottom - buffer)
    }
  }

  const onKeyDown = (e) => {
    if (disabled) return
    if (!open && (e.key === "Enter" || e.key === " " || e.key === "ArrowDown")) {
      e.preventDefault()
      setOpen(true)
      setHighlight((h) => (h >= 0 ? h : 0))
      clearHint?.()
      return
    }
    if (!open) return

    if (e.key === "ArrowDown") {
      e.preventDefault()
      setHighlight((h) => {
        const next = h < options.length - 1 ? h + 1 : 0
        requestAnimationFrame(() => scrollHighlightedIntoView(next))
        return next
      })
    } else if (e.key === "ArrowUp") {
      e.preventDefault()
      setHighlight((h) => {
        const prev = h > 0 ? h - 1 : options.length - 1
        requestAnimationFrame(() => scrollHighlightedIntoView(prev))
        return prev
      })
    } else if (e.key === "Enter") {
      e.preventDefault()
      if (highlight >= 0 && highlight < options.length) commit(options[highlight])
    } else if (e.key === "Escape") {
      e.preventDefault()
      setOpen(false)
      setHighlight(-1)
    }
  }

  return (
    <div className="relative" ref={boxRef}>
      <button
        type="button"
        ref={controlRef}
        disabled={disabled}
        onClick={() => {
          if (!disabled) {
            setOpen((o) => !o)
            clearHint?.()
          }
        }}
        onKeyDown={onKeyDown}
        onFocus={() => clearHint?.()}
        className={cx(
          "w-full rounded-2xl border p-3 text-left text-[15px] md:text-base outline-none transition shadow-none",
          disabled ? "bg-slate-100 cursor-not-allowed" : "bg-slate-100 hover:bg-slate-200 cursor-pointer",
          error
            ? "border-red-400 ring-2 ring-red-300/70"
            : "border-slate-300 focus:border-emerald-600 focus:ring-2 focus:ring-emerald-500/30",
          "dark:border-slate-500 dark:bg-slate-700 dark:text-slate-100 dark:hover:bg-slate-700/80",
          hintRed && "ring-2 ring-red-300 animate-pulse"
        )}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-invalid={error || hintRed ? true : undefined}
      >
        {selectedLabel || <span className="text-slate-500 dark:text-white/70">{placeholder}</span>}
      </button>

      {open && (
        <div
          ref={listRef}
          role="listbox"
          className="absolute z-20 mt-1 max-h-72 w-full overflow-auto rounded-2xl border border-slate-200 bg-white text-black shadow-lg dark:border-slate-700 dark:bg-slate-800 dark:text-white"
        >
          {options.length === 0 && (
            <div className="px-3 py-2 text-sm text-slate-600 dark:text-slate-300">ไม่มีตัวเลือก</div>
          )}
          {options.map((opt, idx) => {
            const label = getLabel(opt)
            const isActive = idx === highlight
            const isChosen = String(getValue(opt)) === String(value)
            return (
              <button
                key={String(getValue(opt)) || label || idx}
                type="button"
                role="option"
                aria-selected={isChosen}
                onMouseEnter={() => setHighlight(idx)}
                onClick={() => commit(opt)}
                className={cx(
                  "relative flex w-full items-center gap-2 px-3 py-2.5 text-left text-[15px] md:text-base transition rounded-xl cursor-pointer",
                  isActive
                    ? "bg-emerald-100 ring-1 ring-emerald-300 dark:bg-emerald-400/20 dark:ring-emerald-500"
                    : "hover:bg-emerald-50 dark:hover:bg-emerald-900/30"
                )}
              >
                {isActive && (
                  <span className="absolute left-0 top-0 h-full w-1 bg-emerald-600 dark:bg-emerald-400/70 rounded-l-xl" />
                )}
                <span className="flex-1">{label}</span>
                {isChosen && <span className="text-emerald-600 dark:text-emerald-300">✓</span>}
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}

/** ---------- DateInput ---------- */
const DateInput = forwardRef(function DateInput({ error = false, className = "", ...props }, ref) {
  const inputRef = useRef(null)
  useImperativeHandle(ref, () => inputRef.current)

  return (
    <div className="relative">
      <style>{`input[type="date"]::-webkit-calendar-picker-indicator { opacity: 0; }`}</style>
      <input
        type="date"
        ref={inputRef}
        className={cx(
          baseField,
          "pr-12 cursor-pointer",
          error && "border-red-400 ring-2 ring-red-300/70",
          className
        )}
        {...props}
      />
      <button
        type="button"
        onClick={() => {
          const el = inputRef.current
          if (!el) return
          if (typeof el.showPicker === "function") el.showPicker()
          else {
            el.focus()
            el.click?.()
          }
        }}
        aria-label="เปิดตัวเลือกวันที่"
        className="absolute right-2 top-1/2 -translate-y-1/2 inline-flex h-9 w-9 items-center justify-center rounded-xl
        transition-transform hover:scale-110 active:scale-95 focus:outline-none cursor-pointer bg-transparent"
      >
        <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor" className="text-slate-600 dark:text-slate-200">
          <path d="M7 2a1 1 0 0 1 1 1v1h8V3a1 1 0 1 1 2 0v1h1a2 2 0 0 1 2 2v3H3V6a2 2 0 0 1 2-2h1V3a1 1 0 1 1 1-1zm14 9v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-7h18zM7 14h2v2H7v-2zm4 0h2v2h-2v-2z" />
        </svg>
      </button>
    </div>
  )
})

/** ---------- Main Page ---------- */
function StockTransferIn() {
  const [submitting, setSubmitting] = useState(false)
  const [viewBranchId, setViewBranchId] = useState(null)

  const [branchOptions, setBranchOptions] = useState([])
  const [productOptions, setProductOptions] = useState([])
  const [riceOptions, setRiceOptions] = useState([])
  const [subriceOptions, setSubriceOptions] = useState([])

  const [loadingRequests, setLoadingRequests] = useState(false)
  const [requests, setRequests] = useState([])

  const [form, setForm] = useState({
    transfer_id: null,
    transfer_date: new Date().toISOString().slice(0, 10),

    from_branch_id: null,
    from_branch_name: "",
    from_klang_id: null,
    from_klang_name: "",

    to_branch_id: null,
    to_branch_name: "",
    to_klang_id: null,
    to_klang_name: "",

    product_id: "",
    product_name: "",
    rice_id: "",
    rice_type: "",
    subrice_id: "",
    subrice_name: "",

    weight_in: "",
    weight_out: "",
    cost_per_kg: "",
    quality_note: "",
  })
  const update = (k, v) => setForm((p) => ({ ...p, [k]: v }))

  const weightIn = useMemo(() => toNumber(form.weight_in), [form.weight_in])
  const weightOut = useMemo(() => toNumber(form.weight_out), [form.weight_out])
  const netWeight = useMemo(() => Math.max(weightIn - weightOut, 0), [weightIn, weightOut])
  const totalCost = useMemo(() => toNumber(form.cost_per_kg) * netWeight, [form.cost_per_kg, netWeight])

  const [errors, setErrors] = useState({})
  const [missingHints, setMissingHints] = useState({})
  const hasRed = (key) => !!errors[key] || !!missingHints[key]
  const redFieldCls = (key) => (hasRed(key) ? "border-red-500 ring-2 ring-red-300 focus:ring-0 focus:border-red-500" : "")
  const redHintCls = (key) => (missingHints[key] ? "border-red-400 ring-2 ring-red-300 focus:border-red-400 animate-pulse" : "")
  const clearHint = (key) => setMissingHints((prev) => (prev[key] ? { ...prev, [key]: false } : prev))
  const clearError = (key) =>
    setErrors((prev) => {
      if (!(key in prev)) return prev
      const { [key]: _omit, ...rest } = prev
      return rest
    })

  /** ---------- Static dropdowns ---------- */
  useEffect(() => {
    const loadStatic = async () => {
      try {
        const [branches, products] = await Promise.all([
          fetchFirstOkJson(["/order/branch/search"]),
          fetchFirstOkJson(["/order/product/search"]),
        ])
        setBranchOptions((branches || []).map((b) => ({ id: b.id, label: b.branch_name })))
        setProductOptions(
          (products || [])
            .map((x) => ({
              id: String(x.id ?? x.product_id ?? x.value ?? ""),
              label: String(x.product_type ?? x.name ?? x.label ?? "").trim(),
            }))
            .filter((o) => o.id && o.label)
        )
      } catch (e) {
        console.error("loadStatic error:", e)
        setBranchOptions([])
        setProductOptions([])
      }
    }
    loadStatic()
  }, [])

  /** ---------- Requests (inbox) ---------- */
  useEffect(() => {
    let timer = null
    let alive = true
    async function fetchRequests() {
      if (!viewBranchId) {
        setRequests([])
        return
      }
      try {
        setLoadingRequests(true)
        const q1 = `/api/stock/transfer/requests?to_branch_id=${encodeURIComponent(viewBranchId)}`
        const q2 = `/api/stock/transfer/list?to_branch_id=${encodeURIComponent(viewBranchId)}&status=REQUESTED`
        const data = await fetchFirstOkJson([q1, q2])
        const list = Array.isArray(data) ? data : data?.data || []
        if (alive) setRequests(list)
      } catch (e) {
        if (alive) setRequests([])
      } finally {
        if (alive) setLoadingRequests(false)
      }
    }
    fetchRequests()
    timer = setInterval(fetchRequests, 20000)
    return () => {
      alive = false
      if (timer) clearInterval(timer)
    }
  }, [viewBranchId])

  /** ---------- Rice/Subrice dependent ---------- */
  useEffect(() => {
    const pid = form.product_id
    if (!pid) {
      setRiceOptions([])
      update("rice_id", "")
      update("rice_type", "")
      update("subrice_id", "")
      update("subrice_name", "")
      return
    }
    const loadRice = async () => {
      try {
        const url = `${API_BASE}/order/rice/search?product_id=${encodeURIComponent(pid)}`
        const r = await fetch(url, { headers: authHeader() })
        if (!r.ok) throw new Error(await r.text())
        const arr = (await r.json()) || []
        const mapped = arr
          .map((x) => ({
            id: String(x.id ?? x.rice_id ?? x.value ?? ""),
            label: String(x.rice_type ?? x.name ?? x.label ?? "").trim(),
          }))
          .filter((o) => o.id && o.label)
        setRiceOptions(mapped)
      } catch (e) {
        console.error("load rice error:", e)
        setRiceOptions([])
      }
    }
    loadRice()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form.product_id])

  useEffect(() => {
    const rid = form.rice_id
    if (!rid) {
      setSubriceOptions([])
      update("subrice_id", "")
      update("subrice_name", "")
      return
    }
    const loadSub = async () => {
      try {
        const url = `${API_BASE}/order/sub-rice/search?rice_id=${encodeURIComponent(rid)}`
        const r = await fetch(url, { headers: authHeader() })
        if (!r.ok) throw new Error(await r.text())
        const arr = (await r.json()) || []
        const mapped = arr
          .map((x) => ({
            id: String(x.id ?? x.subrice_id ?? x.value ?? ""),
            label: String(x.sub_class ?? x.name ?? x.label ?? "").trim(),
          }))
          .filter((o) => o.id && o.label)
        setSubriceOptions(mapped)
      } catch (e) {
        console.error("load subrice error:", e)
        setSubriceOptions([])
      }
    }
    loadSub()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form.rice_id])

  /** ---------- Helper: resolve klang name by id (if request lacks name) ---------- */
  const resolveKlangName = async (branchId, klangId, which /* 'from' | 'to' */) => {
    if (!branchId || !klangId) return
    try {
      const res = await fetch(`${API_BASE}/order/klang/search?branch_id=${encodeURIComponent(branchId)}`, {
        headers: authHeader(),
      })
      if (!res.ok) return
      const arr = (await res.json()) || []
      const found = (arr || []).find((k) => String(k.id) === String(klangId))
      if (found) {
        update(`${which}_klang_name`, found.klang_name || "")
      }
    } catch {}
  }

  /** ---------- Fill form from selected request ---------- */
  const pickRequest = (req) => {
    update("transfer_id", req.id ?? req.transfer_id ?? null)
    update("transfer_date", new Date().toISOString().slice(0, 10))

    update("from_branch_id", req.from_branch_id ?? null)
    update("from_branch_name", req.from_branch_name ?? "")
    update("from_klang_id", req.from_klang_id ?? null)
    update("from_klang_name", req.from_klang_name ?? "")

    update("to_branch_id", req.to_branch_id ?? null)
    update("to_branch_name", req.to_branch_name ?? "")
    update("to_klang_id", req.to_klang_id ?? null)
    update("to_klang_name", req.to_klang_name ?? "")

    update("product_id", String(req.product_id ?? ""))
    update("product_name", req.product_name ?? "")
    update("rice_id", String(req.rice_id ?? ""))
    update("rice_type", req.rice_type ?? "")
    update("subrice_id", String(req.subrice_id ?? ""))
    update("subrice_name", req.subrice_name ?? "")

    update("weight_in", req.weight_in != null ? String(req.weight_in) : "")
    update("weight_out", req.weight_out != null ? String(req.weight_out) : "")
    update("cost_per_kg", req.cost_per_kg != null ? String(req.cost_per_kg) : "")

    update("quality_note", "")
    setErrors({})
    setMissingHints({})

    // ถ้าไม่มีชื่อคลัง ให้ลอง resolve จาก API
    if (!req.from_klang_name && req.from_branch_id && req.from_klang_id) {
      resolveKlangName(req.from_branch_id, req.from_klang_id, "from")
    }
    if (!req.to_klang_name && req.to_branch_id && req.to_klang_id) {
      resolveKlangName(req.to_branch_id, req.to_klang_id, "to")
    }
  }

  /** ---------- Validate ---------- */
  const computeMissingHints = () => {
    const m = {}
    if (!form.transfer_date) m.transfer_date = true
    if (!viewBranchId) m.view_branch = true

    if (!form.product_id) m.product_id = true
    if (!form.rice_id) m.rice_id = true
    if (!form.subrice_id) m.subrice_id = true

    if (!form.weight_in || Number(form.weight_in) <= 0) m.weight_in = true
    if (form.weight_out === "" || Number(form.weight_out) < 0) m.weight_out = true
    if (netWeight <= 0) m.net_weight = true

    return m
  }

  const validate = () => {
    const e = {}
    if (!form.transfer_date) e.transfer_date = "กรุณาเลือกวันที่รับเข้า"
    if (!viewBranchId) e.view_branch = "กรุณาเลือกสาขาที่กำลังดู"

    if (!form.product_id) e.product_id = "กรุณาเลือกประเภทสินค้า"
    if (!form.rice_id) e.rice_id = "กรุณาเลือกชนิดข้าว"
    if (!form.subrice_id) e.subrice_id = "กรุณาเลือกชั้นย่อย"

    if (weightIn <= 0) e.weight_in = "น้ำหนักชั่งเข้า ต้องมากกว่า 0"
    if (weightOut < 0) e.weight_out = "น้ำหนักชั่งออก ต้องไม่ติดลบ"
    if (netWeight <= 0) e.net_weight = "น้ำหนักสุทธิต้องมากกว่า 0 (ตรวจค่าชั่งเข้า/ออก)"

    setErrors(e)
    return Object.keys(e).length === 0
  }

  /** ---------- Submit ---------- */
  const handleSubmit = async (e) => {
    e.preventDefault()
    const hints = computeMissingHints()
    setMissingHints(hints)
    if (!validate()) return

    if (!form.transfer_id) {
      alert("กรุณาเลือกคำขอโอนที่จะรับเข้าจากรายการด้านบนก่อน")
      return
    }

    setSubmitting(true)
    try {
      const payload = {
        transfer_date: form.transfer_date,
        to_branch_id: form.to_branch_id,
        to_klang_id: form.to_klang_id,
        product_id: /^\d+$/.test(form.product_id) ? Number(form.product_id) : form.product_id,
        rice_id: /^\d+$/.test(form.rice_id) ? Number(form.rice_id) : form.rice_id,
        subrice_id: /^\d+$/.test(form.subrice_id) ? Number(form.subrice_id) : form.subrice_id,
        weight_in: toNumber(form.weight_in),
        weight_out: toNumber(form.weight_out),
        net_weight: netWeight,
        cost_per_kg: form.cost_per_kg === "" ? null : Number(form.cost_per_kg),
        total_cost: totalCost,
        quality_note: form.quality_note?.trim() || null,
      }

      const r = await fetch(`${API_BASE}/api/stock/transfer/${encodeURIComponent(form.transfer_id)}/receive`, {
        method: "POST",
        headers: authHeader(),
        body: JSON.stringify(payload),
      })
      if (!r.ok) throw new Error(await r.text())

      alert("บันทึกรับเข้าสำเร็จ ✅")

      setForm((f) => ({
        ...f,
        transfer_id: null,
        product_id: "",
        product_name: "",
        rice_id: "",
        rice_type: "",
        subrice_id: "",
        subrice_name: "",
        weight_in: "",
        weight_out: "",
        cost_per_kg: "",
        quality_note: "",
        from_branch_id: null,
        from_branch_name: "",
        from_klang_id: null,
        from_klang_name: "",
        to_branch_id: null,
        to_branch_name: "",
        to_klang_id: null,
        to_klang_name: "",
      }))

      try {
        const q1 = `/api/stock/transfer/requests?to_branch_id=${encodeURIComponent(viewBranchId)}`
        const q2 = `/api/stock/transfer/list?to_branch_id=${encodeURIComponent(viewBranchId)}&status=REQUESTED`
        const data = await fetchFirstOkJson([q1, q2])
        const list = Array.isArray(data) ? data : data?.data || []
        setRequests(list)
      } catch {}
    } catch (err) {
      console.error(err)
      alert(err?.message || "เกิดข้อผิดพลาดระหว่างบันทึก")
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="min-h-screen bg-white text-black dark:bg-slate-900 dark:text-white rounded-2xl text-[15px] md:text-base">
      <div className="mx-auto max-w-7xl p-5 md:p-6 lg:p-8">
        <h1 className="mb-4 text-3xl font-bold text-gray-900 dark:text-white">📦 รับเข้าข้าวเปลือก</h1>

        {/* เลือกสาขา */}
        <div className="mb-6 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-700 dark:bg-slate-800">
          <h2 className="mb-3 text-xl font-semibold">เลือกสาขาเพื่อรับเข้า</h2>
          <div className="grid gap-4 md:grid-cols-3">
            <div>
              <label className={labelCls}>สาขาที่กำลังดู</label>
              <ComboBox
                options={branchOptions}
                value={viewBranchId}
                getValue={(o) => o.id}
                onChange={(_v, found) => {
                  clearError("view_branch")
                  setViewBranchId(found?.id ?? null)
                }}
                placeholder="— เลือกสาขา —"
                error={!!errors.view_branch}
                hintRed={!!missingHints.view_branch}
              />
              {errors.view_branch && <p className={errorTextCls}>{errors.view_branch}</p>}
            </div>
          </div>
        </div>

        {/* คำขอที่รอ */}
        <div className="mb-6 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-700 dark:bg-slate-800">
          <div className="mb-3 flex items-center gap-3">
            <h2 className="text-xl font-semibold">คำขอโอนเข้าที่รออนุมัติ</h2>
            <span className="inline-flex items-center justify-center rounded-full bg-emerald-100 px-3 py-1.5 text-emerald-700 ring-1 ring-emerald-200 dark:bg-emerald-900/20 dark:text-emerald-200 dark:ring-emerald-700/60">
              {loadingRequests ? "กำลังโหลด..." : `ทั้งหมด ${requests.length} รายการ`}
            </span>
          </div>

          {requests.length === 0 ? (
            <div className="text-slate-600 dark:text-slate-300">ยังไม่มีคำขอโอนเข้ามาที่สาขานี้</div>
          ) : (
            <div className="grid gap-3 md:grid-cols-2">
              {requests.map((req) => (
                <div
                  key={req.id}
                  className="rounded-2xl bg-white p-4 text-black shadow-sm ring-1 ring-slate-200 dark:bg-slate-800 dark:text-white dark:ring-slate-700"
                >
                  <div className="flex items-center justify-between">
                    <div className="font-semibold">
                      จากสาขา: {req.from_branch_name ?? req.from_branch_id}
                    </div>
                    <button
                      type="button"
                      onClick={() => pickRequest(req)}
                      className="rounded-xl bg-emerald-600 px-3 py-1.5 text-white font-medium hover:bg-emerald-700 active:scale-[.98]"
                    >
                      รับเข้า
                    </button>
                  </div>
                  <div className="mt-2 text-sm text-slate-700 dark:text-slate-300">
                    <div>สินค้า: {req.product_name ?? req.product_id}</div>
                    <div>ชนิด/ชั้น: {(req.rice_type ?? req.rice_id) + (req.subrice_name ? " • " + req.subrice_name : "")}</div>
                    <div>สุทธิ (ที่แจ้ง): {req.net_weight ?? "-"} กก.</div>
                    {req.cost_per_kg != null && <div>ต้นทุนที่เสนอ: {Number(req.cost_per_kg).toFixed(2)} บาท/กก.</div>}
                    <div className="text-slate-500">เลขคำขอ: {req.id}</div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* ฟอร์มรับเข้า */}
        <form onSubmit={handleSubmit} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-700 dark:bg-slate-800">
          <h2 className="mb-3 text-xl font-semibold">บันทึกรับเข้า</h2>

          {/* วันที่ + สาขา/คลัง (กว้างเท่า 1 คอลัมน์ของกริด 3 คอลัมน์) */}
          <div className="grid gap-4 md:grid-cols-3">
            {/* แถว 1: วันที่ (กว้าง 1/3) */}
            <div>
              <label className={labelCls}>วันที่รับเข้า</label>
              <DateInput
                value={form.transfer_date}
                onChange={(e) => {
                  clearError("transfer_date")
                  clearHint("transfer_date")
                  update("transfer_date", e.target.value)
                }}
                error={!!errors.transfer_date}
                className={redHintCls("transfer_date")}
                aria-invalid={errors.transfer_date ? true : undefined}
              />
              {errors.transfer_date && <p className={errorTextCls}>{errors.transfer_date}</p>}
            </div>
            {/* เติมคอลัมน์ว่างให้วันที่อยู่บรรทัดเดียว */}
            <div className="hidden md:block" />
            <div className="hidden md:block" />

            {/* แถว 2: สาขาต้นทาง • คลังต้นทาง */}
            <div>
              <label className={labelCls}>สาขาต้นทาง</label>
              <input disabled className={cx(baseField, fieldDisabled)}
                    value={form.from_branch_name || form.from_branch_id || "—"} />
            </div>
            <div>
              <label className={labelCls}>คลังต้นทาง</label>
              <input disabled className={cx(baseField, fieldDisabled)}
                    value={form.from_klang_name || form.from_klang_id || "—"} />
            </div>
            <div className="hidden md:block" />

            {/* แถว 3: สาขาปลายทาง • คลังปลายทาง */}
            <div>
              <label className={labelCls}>สาขาปลายทาง</label>
              <input disabled className={cx(baseField, fieldDisabled)}
                    value={form.to_branch_name || form.to_branch_id || "—"} />
            </div>
            <div>
              <label className={labelCls}>คลังปลายทาง</label>
              <input disabled className={cx(baseField, fieldDisabled)}
                    value={form.to_klang_name || form.to_klang_id || "—"} />
            </div>
            <div className="hidden md:block" />
          </div>


          {/* สินค้า */}
          <div className="mt-6 grid gap-4 md:grid-cols-3">
            <div>
              <label className={labelCls}>ประเภทสินค้า</label>
              <ComboBox
                options={productOptions}
                value={form.product_id}
                onChange={(id, found) => {
                  clearError("product_id")
                  clearHint("product_id")
                  update("product_id", id)
                  update("product_name", found?.label ?? "")
                  update("rice_id", "")
                  update("rice_type", "")
                  update("subrice_id", "")
                  update("subrice_name", "")
                }}
                placeholder="— เลือกประเภทสินค้า —"
                error={!!errors.product_id}
                hintRed={!!missingHints.product_id}
              />
              {errors.product_id && <p className={errorTextCls}>{errors.product_id}</p>}
            </div>

            <div>
              <label className={labelCls}>ชนิดข้าว</label>
              <ComboBox
                options={riceOptions}
                value={form.rice_id}
                onChange={(id, found) => {
                  clearError("rice_id")
                  clearHint("rice_id")
                  update("rice_id", id)
                  update("rice_type", found?.label ?? "")
                  update("subrice_id", "")
                  update("subrice_name", "")
                }}
                placeholder="— เลือกชนิดข้าว —"
                disabled={!form.product_id}
                error={!!errors.rice_id}
                hintRed={!!missingHints.rice_id}
              />
              {errors.rice_id && <p className={errorTextCls}>{errors.rice_id}</p>}
            </div>

            <div>
              <label className={labelCls}>ชั้นย่อย (Sub-class)</label>
              <ComboBox
                options={subriceOptions}
                value={form.subrice_id}
                onChange={(id, found) => {
                  clearError("subrice_id")
                  clearHint("subrice_id")
                  update("subrice_id", id)
                  update("subrice_name", found?.label ?? "")
                }}
                placeholder="— เลือกชั้นย่อย —"
                disabled={!form.rice_id}
                error={!!errors.subrice_id}
                hintRed={!!missingHints.subrice_id}
              />
              {errors.subrice_id && <p className={errorTextCls}>{errors.subrice_id}</p>}
            </div>
          </div>

          {/* ชั่ง/ต้นทุน */}
          <div className="mt-6 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm ring-1 ring-transparent dark:border-slate-700 dark:bg-slate-800">
            <div className="mb-3 flex items-center gap-2">
              <span className="inline-flex h-2 w-2 rounded-full bg-emerald-500" />
              <h3 className="text-lg font-semibold">ตัวเลขและการคำนวณ</h3>
            </div>

            <div className="grid gap-4 md:grid-cols-4">
              <div>
                <label className={labelCls}>น้ำหนักชั่งเข้า (กก.)</label>
                <input
                  inputMode="decimal"
                  className={cx(baseField, redFieldCls("weight_in"))}
                  value={form.weight_in}
                  onChange={(e) => update("weight_in", e.target.value.replace(/[^\d.]/g, ""))}
                  onFocus={() => {
                    clearError("weight_in")
                    clearHint("weight_in")
                  }}
                  placeholder="เช่น 15000"
                  aria-invalid={errors.weight_in ? true : undefined}
                />
                {errors.weight_in && <p className={errorTextCls}>{errors.weight_in}</p>}
              </div>

              <div>
                <label className={labelCls}>น้ำหนักชั่งออก (กก.)</label>
                <input
                  inputMode="decimal"
                  className={cx(baseField, redFieldCls("weight_out"))}
                  value={form.weight_out}
                  onChange={(e) => update("weight_out", e.target.value.replace(/[^\d.]/g, ""))}
                  onFocus={() => {
                    clearError("weight_out")
                    clearHint("weight_out")
                  }}
                  placeholder="เช่น 2000"
                  aria-invalid={errors.weight_out ? true : undefined}
                />
                {errors.weight_out && <p className={errorTextCls}>{errors.weight_out}</p>}
              </div>

              <div>
                <label className={labelCls}>น้ำหนักสุทธิ (กก.)</label>
                <input
                  disabled
                  className={cx(baseField, fieldDisabled)}
                  value={Math.round(Math.max(weightIn - weightOut, 0) * 100) / 100}
                />
                {errors.net_weight && <p className={errorTextCls}>{errors.net_weight}</p>}
                <p className={helpTextCls}>คำนวณ = ชั่งเข้า − ชั่งออก</p>
              </div>

              <div>
                <label className={labelCls}>ราคาต้นทุน (บาท/กก.)</label>
                <input
                  disabled
                  className={cx(baseField, fieldDisabled)}
                  value={form.cost_per_kg}
                  placeholder="ออโต้จากคำขอโอน"
                />
              </div>

              <div>
                <label className={labelCls}>ราคาสุทธิ (บาท)</label>
                <input disabled className={cx(baseField, fieldDisabled)} value={thb(totalCost)} />
                <p className={helpTextCls}>= ราคาต้นทุน × น้ำหนักสุทธิ</p>
              </div>

              <div>
                <label className={labelCls}>คุณภาพ (บันทึกเพิ่มเติม)</label>
                <input
                  className={baseField}
                  value={form.quality_note}
                  onChange={(e) => update("quality_note", e.target.value)}
                  placeholder="เช่น 15"
                />
              </div>
            </div>
          </div>

          {/* ปุ่ม */}
          <div className="mt-6 flex flex-col gap-3 sm:flex-row">
            <button
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
              {submitting ? "กำลังบันทึก..." : "บันทึกรับเข้า"}
            </button>

            <button
              type="button"
              onClick={() =>
                setForm((f) => ({
                  ...f,
                  transfer_id: null,
                  product_id: "",
                  product_name: "",
                  rice_id: "",
                  rice_type: "",
                  subrice_id: "",
                  subrice_name: "",
                  weight_in: "",
                  weight_out: "",
                  cost_per_kg: "",
                  quality_note: "",
                  from_branch_id: null,
                  from_branch_name: "",
                  from_klang_id: null,
                  from_klang_name: "",
                  to_branch_id: null,
                  to_branch_name: "",
                  to_klang_id: null,
                  to_klang_name: "",
                }))
              }
              className="inline-flex items-center justify-center rounded-2xl 
                border border-slate-300 bg-white px-6 py-3 text-base font-medium text-slate-700 
                shadow-sm
                transition-all duration-300 ease-out
                hover:bg-slate-100 hover:shadow-md hover:scale-[1.03]
                active:scale-[.97]
                dark:border-slate-600 dark:bg-slate-700/60 dark:text-white 
                dark:hover:bg-slate-700/50 dark:hover:shadow-lg cursor-pointer"
            >
              ล้างฟอร์มรับเข้า
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

export default StockTransferIn
