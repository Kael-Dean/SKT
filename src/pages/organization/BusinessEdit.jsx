import React, { useState, useEffect, useMemo, useRef } from "react"
import ReactDOM from "react-dom"
import { apiAuth } from "../../lib/api"
import { emitMasterDataChanged } from "../../lib/useProductsByGroup"
import { invalidateBusinessListCache } from "../../lib/useBusinessList"

/** ---------- Mapping ---------- */
const BUSINESS_GROUP_MAP = {
  1: "ธุรกิจจัดหา",
  2: "ธุรกิจจัดหา-ปั้มน้ำมัน",
  3: "ธุรกิจรวบรวม",
  4: "ธุรกิจแปรรูป",
  5: "ธุรกิจเมล็ดพันธ์ุ",
  6: "ฝึกอบรมณ์",
  7: "อื่นๆ",
}

const BUSINESS_GROUP_OPTIONS = Object.entries(BUSINESS_GROUP_MAP).map(([val, label]) => ({
  value: Number(val),
  label,
}))

/** ---------- Configuration สำหรับแต่ละ Entity ---------- */
const TABS = [
  {
    key: "products",
    label: "📦 สินค้า (Products)",
    endpoint: "/products",
    fields: [
      { name: "product_type", label: "ประเภทสินค้า", type: "text", required: true },
      { name: "unit", label: "หน่วยนับ", type: "text", required: true },
      { name: "business_group", label: "กลุ่มธุรกิจ", type: "select", options: BUSINESS_GROUP_OPTIONS },
    ],
  },
  {
    key: "cost-types",
    label: "💰 ประเภทตค่าใช้จ่าย (Cost Types)",
    endpoint: "/cost-types",
    fields: [
      { name: "name", label: "ชื่อประเภทต้นทุน", type: "text", required: true },
      { name: "business_groups", label: "กลุ่มธุรกิจ", type: "multi-select", options: BUSINESS_GROUP_OPTIONS },
      { name: "comment", label: "หมายเหตุ", type: "text" },
    ],
  },
  {
    key: "earning-types",
    label: "💵 ประเภทรายได้ (Earning Types)",
    endpoint: "/earning-types",
    fields: [
      { name: "name", label: "ชื่อประเภทรายได้", type: "text", required: true },
      { name: "business_groups", label: "กลุ่มธุรกิจ", type: "multi-select", options: BUSINESS_GROUP_OPTIONS },
      { name: "comment", label: "หมายเหตุ", type: "text" },
    ],
  },
  {
    key: "aux-costs",
    label: "🧾 ต้นทุน (Aux Costs)",
    endpoint: "/aux-costs",
    fields: [
      { name: "name", label: "ชื่อต้นทุน", type: "text", required: true },
      { name: "business_group", label: "กลุ่มธุรกิจ", type: "select", options: BUSINESS_GROUP_OPTIONS },
      {
        name: "is_deduction",
        label: "ประเภทรายการ",
        type: "boolean",
        trueLabel: "รายการหัก (ลดต้นทุน)",
        falseLabel: "ต้นทุน (เพิ่ม)",
      },
      { name: "comment", label: "หมายเหตุ", type: "text" },
    ],
  },
  {
    key: "branches",
    label: "🏢 สาขา (Branches)",
    endpoint: "/branches",
    fields: [
      // ปรับลดเหลือแค่ชื่อสาขาตามที่ต้องการ
      { name: "branch_name", label: "ชื่อสาขา", type: "text", required: true },
    ],
  },
]

/** ---------- Styles ---------- */
const baseInput = "w-full rounded-xl border border-slate-300 bg-slate-50 p-2.5 text-sm outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 dark:border-slate-600 dark:bg-slate-700 dark:text-white dark:focus:border-emerald-400 transition-all"
const labelCls = "mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300"

/** ---------- Reusable ComboBox ---------- */
const cx = (...a) => a.filter(Boolean).join(" ")

function ComboBox({
  options = [],
  value,
  onChange,
  placeholder = "— เลือก —",
  getLabel = (o) => o?.label ?? "",
  getValue = (o) => o?.value ?? o?.id ?? "",
  disabled = false,
}) {
  const [open, setOpen] = useState(false)
  const [highlight, setHighlight] = useState(-1)
  const boxRef = useRef(null)
  const listRef = useRef(null)
  const btnRef = useRef(null)

  const selectedObj = useMemo(
    () => options.find((o) => String(getValue(o)) === String(value)),
    [options, value, getValue]
  )
  const selectedLabel = selectedObj ? getLabel(selectedObj) : ""

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
    onChange?.(getValue(opt), opt)
    setOpen(false)
    setHighlight(-1)
    btnRef.current?.focus()
  }

  const onKeyDown = (e) => {
    if (disabled) return
    if (!open && (e.key === "Enter" || e.key === " " || e.key === "ArrowDown")) {
      e.preventDefault()
      setOpen(true)
      setHighlight((h) => (h >= 0 ? h : 0))
      return
    }
    if (!open) return

    if (e.key === "ArrowDown") {
      e.preventDefault()
      setHighlight((h) => (h < options.length - 1 ? h + 1 : 0))
    } else if (e.key === "ArrowUp") {
      e.preventDefault()
      setHighlight((h) => (h > 0 ? h - 1 : options.length - 1))
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
    <div className={cx("relative w-full", open && "z-[1000]")} ref={boxRef}>
      <button
        type="button"
        ref={btnRef}
        disabled={disabled}
        onClick={() => !disabled && setOpen((o) => !o)}
        onKeyDown={onKeyDown}
        className={cx(
          baseInput,
          "text-left flex justify-between items-center shadow-none",
          disabled ? "cursor-not-allowed opacity-80" : "cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-600"
        )}
        aria-haspopup="listbox"
        aria-expanded={open}
      >
        <span className={selectedLabel ? "text-slate-800 dark:text-slate-100" : "text-slate-500 dark:text-slate-400"}>
          {selectedLabel || placeholder}
        </span>
        <svg className="w-4 h-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7"></path>
        </svg>
      </button>

      {open && (
        <div
          ref={listRef}
          role="listbox"
          className="absolute z-[1100] mt-1 max-h-60 w-full overflow-auto rounded-xl border border-slate-200 bg-white text-sm text-black shadow-lg dark:border-slate-700 dark:bg-slate-800 dark:text-white"
        >
          {options.length === 0 && <div className="p-3 text-slate-500">ไม่มีตัวเลือก</div>}
          {options.map((opt, idx) => {
            const label = getLabel(opt)
            const isActive = idx === highlight
            const isChosen = String(getValue(opt)) === String(value)
            return (
              <button
                key={String(getValue(opt)) || idx}
                type="button"
                role="option"
                aria-selected={isChosen}
                onMouseEnter={() => setHighlight(idx)}
                onClick={() => commit(opt)}
                className={cx(
                  "flex w-full items-center justify-between px-3 py-2.5 text-left transition-colors cursor-pointer",
                  isActive ? "bg-emerald-100 dark:bg-emerald-400/20" : "hover:bg-emerald-50 dark:hover:bg-emerald-900/30"
                )}
              >
                <span>{label}</span>
                {isChosen && <span className="text-emerald-600 dark:text-emerald-300 text-xs font-bold">✓</span>}
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}

/** ---------- Reusable MultiSelect ComboBox ---------- */
function MultiSelectComboBox({
  options = [],
  values = [],
  onChange,
  placeholder = "— เลือก —",
  getLabel = (o) => o?.label ?? "",
  getValue = (o) => o?.value ?? o?.id ?? "",
  disabled = false,
}) {
  const [open, setOpen] = useState(false)
  const boxRef = useRef(null)

  const valueSet = useMemo(() => new Set((values || []).map(String)), [values])
  const selectedLabels = useMemo(
    () => options.filter((o) => valueSet.has(String(getValue(o)))).map(getLabel),
    [options, valueSet, getLabel, getValue]
  )

  useEffect(() => {
    const onClick = (e) => {
      if (!boxRef.current) return
      if (!boxRef.current.contains(e.target)) setOpen(false)
    }
    document.addEventListener("click", onClick)
    return () => document.removeEventListener("click", onClick)
  }, [])

  const toggle = (opt) => {
    const v = getValue(opt)
    const sv = String(v)
    const next = valueSet.has(sv)
      ? (values || []).filter((x) => String(x) !== sv)
      : [...(values || []), v]
    onChange?.(next)
  }

  const clearAll = (e) => {
    e.stopPropagation()
    onChange?.([])
  }

  return (
    <div className={cx("relative w-full", open && "z-[1000]")} ref={boxRef}>
      <button
        type="button"
        disabled={disabled}
        onClick={() => !disabled && setOpen((o) => !o)}
        className={cx(
          baseInput,
          "text-left flex justify-between items-center gap-2 shadow-none min-h-[42px]",
          disabled ? "cursor-not-allowed opacity-80" : "cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-600"
        )}
        aria-haspopup="listbox"
        aria-expanded={open}
      >
        <div className="flex flex-1 flex-wrap items-center gap-1 overflow-hidden">
          {selectedLabels.length === 0 ? (
            <span className="text-slate-500 dark:text-slate-400">{placeholder}</span>
          ) : (
            selectedLabels.map((lab) => (
              <span
                key={lab}
                className="inline-flex items-center rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-200"
              >
                {lab}
              </span>
            ))
          )}
        </div>
        <div className="flex items-center gap-1 shrink-0">
          {selectedLabels.length > 0 && !disabled && (
            <span
              role="button"
              tabIndex={0}
              onClick={clearAll}
              onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") clearAll(e) }}
              className="rounded-full px-1.5 py-0.5 text-[11px] text-slate-500 hover:bg-slate-200 hover:text-slate-700 dark:text-slate-400 dark:hover:bg-slate-600 dark:hover:text-slate-100 cursor-pointer"
              title="ล้างทั้งหมด"
            >
              ✕
            </span>
          )}
          <svg className="w-4 h-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
          </svg>
        </div>
      </button>

      {open && (
        <div
          role="listbox"
          className="absolute z-[1100] mt-1 max-h-60 w-full overflow-auto rounded-xl border border-slate-200 bg-white text-sm text-black shadow-lg dark:border-slate-700 dark:bg-slate-800 dark:text-white"
        >
          {options.length === 0 && <div className="p-3 text-slate-500">ไม่มีตัวเลือก</div>}
          {options.map((opt, idx) => {
            const label = getLabel(opt)
            const val = getValue(opt)
            const isChosen = valueSet.has(String(val))
            return (
              <button
                key={String(val) || idx}
                type="button"
                role="option"
                aria-selected={isChosen}
                onClick={() => toggle(opt)}
                className={cx(
                  "flex w-full items-center justify-between px-3 py-2.5 text-left transition-colors cursor-pointer",
                  isChosen ? "bg-emerald-50 dark:bg-emerald-900/30" : "hover:bg-slate-100 dark:hover:bg-slate-700"
                )}
              >
                <span className="flex items-center gap-2">
                  <span
                    className={cx(
                      "flex h-4 w-4 items-center justify-center rounded border",
                      isChosen
                        ? "bg-emerald-600 border-emerald-600 text-white"
                        : "border-slate-400 dark:border-slate-500"
                    )}
                  >
                    {isChosen && (
                      <svg viewBox="0 0 20 20" fill="currentColor" className="h-3 w-3">
                        <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-7.5 7.5a1 1 0 01-1.414 0l-3.5-3.5a1 1 0 011.414-1.414L8.5 12.086l6.793-6.793a1 1 0 011.414 0z" clipRule="evenodd" />
                      </svg>
                    )}
                  </span>
                  <span>{label}</span>
                </span>
                {isChosen && <span className="text-emerald-600 dark:text-emerald-300 text-xs font-bold">✓</span>}
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}

const BusinessEdit = () => {
  const [activeTab, setActiveTab] = useState(TABS[0].key)
  const [data, setData] = useState([])
  const [loading, setLoading] = useState(false)
  const [searchText, setSearchText] = useState("")

  // Form State
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [editingId, setEditingId] = useState(null)
  const [formData, setFormData] = useState({})

  const currentConfig = useMemo(() => TABS.find((t) => t.key === activeTab), [activeTab])

  const filteredData = useMemo(() => {
    if (!searchText.trim()) return data
    const q = searchText.toLowerCase()
    return data.filter((row) =>
      currentConfig.fields.some((f) => {
        let val
        if (f.name === "business_group" && row[f.name] != null) {
          val = BUSINESS_GROUP_MAP[row[f.name]] || String(row[f.name])
        } else if (f.type === "multi-select" && Array.isArray(row[f.name])) {
          val = row[f.name].map((id) => BUSINESS_GROUP_MAP[id] || id).join(", ")
        } else if (f.type === "boolean") {
          val = row[f.name] ? (f.trueLabel || "หัก") : (f.falseLabel || "ปกติ")
        } else {
          val = String(row[f.name] ?? "")
        }
        return val.toLowerCase().includes(q)
      }) || String(row.id).includes(q)
    )
  }, [data, searchText, currentConfig])

  useEffect(() => {
    setSearchText("")
    fetchData()
  }, [activeTab])

  const fetchData = async () => {
    setLoading(true)
    try {
      const res = await apiAuth(`${currentConfig.endpoint}`, { method: "GET" })
      const rows = Array.isArray(res) ? res : []

      // สำหรับ cost-types / earning-types: merge business_groups จากตาราง assignment
      if (activeTab === "cost-types" || activeTab === "earning-types") {
        const assignmentEndpoint = activeTab === "cost-types" ? "/business-costs" : "/business-earnings"
        const matchKey = activeTab === "cost-types" ? "cost_id" : "earning_id"
        let assignments = []
        try {
          assignments = await apiAuth(assignmentEndpoint, { method: "GET" })
        } catch (e) {
          console.warn(`load ${assignmentEndpoint} failed:`, e)
          assignments = []
        }
        const map = new Map()
        for (const a of Array.isArray(assignments) ? assignments : []) {
          if (a?.is_active === false) continue
          const k = a?.[matchKey]
          if (k == null) continue
          const arr = map.get(k) || []
          if (a.business_group != null) arr.push(Number(a.business_group))
          map.set(k, arr)
        }
        setData(rows.map((r) => ({ ...r, business_groups: map.get(r.id) || [] })))
      } else {
        setData(rows)
      }
    } catch (err) {
      console.error(err)
      alert("เกิดข้อผิดพลาดในการโหลดข้อมูล")
    } finally {
      setLoading(false)
    }
  }

  const handleAdd = () => {
    const initialData = {}
    currentConfig.fields.forEach(f => {
      initialData[f.name] = f.type === "multi-select" ? [] : f.type === "boolean" ? false : ""
    })
    setFormData(initialData)
    setEditingId(null)
    setIsModalOpen(true)
  }

  const handleEdit = (item) => {
    const initialData = {}
    currentConfig.fields.forEach(f => {
      if (f.type === "multi-select") {
        initialData[f.name] = Array.isArray(item[f.name]) ? item[f.name].map(Number) : []
      } else if (f.type === "boolean") {
        initialData[f.name] = Boolean(item[f.name])
      } else {
        initialData[f.name] = item[f.name] ?? ""
      }
    })
    setFormData(initialData)
    setEditingId(item.id)
    setIsModalOpen(true)
  }

  const handleDelete = async (id) => {
    if (!window.confirm("คุณแน่ใจหรือไม่ที่จะลบรายการนี้? (ระบบจะเปลี่ยนสถานะเป็น Inactive)")) return

    try {
      await apiAuth(`${currentConfig.endpoint}/${id}`, { method: "DELETE" })
      fetchData() // โหลดข้อมูลใหม่หลังจากลบ
      // กระจายให้ทุกตารางที่ฟังอยู่ refetch
      invalidateBusinessListCache()
      emitMasterDataChanged({ tab: activeTab, action: "delete", id })
    } catch (err) {
      console.error(err)
      alert("เกิดข้อผิดพลาดในการลบข้อมูล หรือคุณไม่มีสิทธิ์ (Admin Only)")
    }
  }

  const handleChange = (e) => {
    const { name, value } = e.target
    const fieldConfig = currentConfig.fields.find(f => f.name === name)
    let parsedValue = value
    if (fieldConfig?.type === "number" || fieldConfig?.type === "select") {
      parsedValue = value === "" ? "" : Number(value)
    } else if (fieldConfig?.type === "multi-select") {
      parsedValue = Array.isArray(value)
        ? value.map(Number).filter((n) => Number.isFinite(n))
        : []
    }
    setFormData(prev => ({
      ...prev,
      [name]: parsedValue
    }))
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    const payload = { ...formData }
    currentConfig.fields.forEach(f => {
      if ((f.type === "number" || f.type === "select") && payload[f.name] === "") {
        payload[f.name] = null
      }
    })

    // Validate required fields since ComboBox is not a native input
    for (const f of currentConfig.fields) {
      const v = payload[f.name]
      const isEmpty = f.type === "multi-select"
        ? !Array.isArray(v) || v.length === 0
        : v === "" || v === null || v === undefined
      if (f.required && isEmpty) {
        alert(`กรุณาระบุ ${f.label}`)
        return
      }
    }

    try {
      // cost-types / earning-types ใช้ endpoint แบบ with-assignment เพื่อรองรับ multi business_group
      const isAssignmentEntity = activeTab === "cost-types" || activeTab === "earning-types"
      if (isAssignmentEntity) {
        const url = activeTab === "cost-types"
          ? "/cost-types-with-assignment"
          : "/earning-types-with-assignment"
        const submitPayload = {
          name: payload.name,
          comment: payload.comment ?? null,
          business_groups: Array.isArray(payload.business_groups) ? payload.business_groups : [],
        }
        if (editingId) {
          await apiAuth(`${url}/${editingId}`, { method: "PUT", body: submitPayload })
        } else {
          await apiAuth(url, { method: "POST", body: submitPayload })
        }
      } else if (editingId) {
        await apiAuth(`${currentConfig.endpoint}/${editingId}`, {
          method: "PUT",
          body: payload
        })
      } else {
        await apiAuth(`${currentConfig.endpoint}`, {
          method: "POST",
          body: payload
        })
      }
      setIsModalOpen(false)
      fetchData() // โหลดข้อมูลใหม่มาแสดงผล
      // แจ้งทุกตาราง/หน้าที่ผูก master data ให้ refresh แบบ realtime
      invalidateBusinessListCache()
      emitMasterDataChanged({ tab: activeTab, action: editingId ? "update" : "create", id: editingId ?? null })
    } catch (err) {
      console.error(err)
      alert(err.message || "เกิดข้อผิดพลาด กรุณาตรวจสอบสิทธิ์ (Admin Only) หรือความถูกต้องของข้อมูล")
    }
  }

  return (
    <>
      <div className="min-h-screen bg-slate-50 text-black dark:bg-slate-900 dark:text-white rounded-2xl md:p-6 p-4">
        <div className="mx-auto max-w-[1400px]">

          <div className="mb-6 flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <h1 className="text-2xl md:text-3xl font-extrabold text-slate-800 dark:text-white">⚙️ แก้ไขข้อมูลธุรกิจ (Master Data)</h1>
              <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                เพิ่ม/แก้ไข/ลบ ข้อมูลพื้นฐานที่ใช้ในระบบ (เฉพาะ Admin เท่านั้นที่สามารถจัดการได้)
              </p>
            </div>
          </div>

          {/* --- TABS --- */}
          <div className="mb-6 flex flex-wrap gap-2 rounded-xl bg-white p-2 shadow-sm dark:bg-slate-800 border border-slate-300 dark:border-slate-700">
            {TABS.map((tab) => (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={`px-4 py-2 text-sm font-medium rounded-lg transition-all cursor-pointer transform hover:scale-105 active:scale-95 ${activeTab === tab.key
                  ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300 shadow-sm"
                  : "text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-700"
                  }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* --- MAIN CONTENT --- */}
          <div className="rounded-2xl border border-slate-300 bg-white shadow-sm dark:border-slate-700 dark:bg-slate-800 overflow-hidden">

            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-300 dark:border-slate-700 p-4">
              <h2 className="text-lg font-bold shrink-0">{currentConfig.label}</h2>
              <div className="flex items-center gap-2 flex-1 sm:max-w-sm">
                <div className="relative flex-1">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none text-sm">🔍</span>
                  <input
                    type="text"
                    value={searchText}
                    onChange={(e) => setSearchText(e.target.value)}
                    placeholder="ค้นหา..."
                    className="w-full rounded-xl border border-slate-300 bg-slate-50 pl-8 pr-8 py-2 text-sm outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 dark:border-slate-600 dark:bg-slate-700 dark:text-white dark:focus:border-emerald-400 transition-all"
                  />
                  {searchText && (
                    <button
                      type="button"
                      onClick={() => setSearchText("")}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors cursor-pointer"
                    >
                      ✕
                    </button>
                  )}
                </div>
                <button
                  onClick={handleAdd}
                  className="bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded-xl text-sm font-semibold transition-all cursor-pointer transform hover:scale-105 active:scale-95 shadow-md hover:shadow-lg shrink-0"
                >
                  + เพิ่มข้อมูล
                </button>
              </div>
            </div>

            <div className="overflow-x-auto p-4">
              {/* ตารางที่มีเส้นกั้นตัดกันอย่างชัดเจนตามที่ผู้ใช้ต้องการ */}
              <table className="w-full border-collapse border border-slate-300 text-left text-sm text-slate-700 dark:border-slate-600 dark:text-slate-300">
                <thead className="bg-slate-100 dark:bg-slate-700/80 text-slate-800 dark:text-slate-200">
                  <tr>
                    <th className="border border-slate-300 p-3 font-semibold w-16 text-center dark:border-slate-600">ID</th>
                    {currentConfig.fields.map((f) => (
                      <th key={f.name} className="border border-slate-300 p-3 font-semibold dark:border-slate-600">{f.label}</th>
                    ))}
                    <th className="border border-slate-300 p-3 font-semibold text-center w-32 dark:border-slate-600">จัดการ</th>
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    <tr>
                      <td colSpan={currentConfig.fields.length + 2} className="border border-slate-300 p-8 text-center text-slate-500 dark:border-slate-600">
                        กำลังโหลดข้อมูล...
                      </td>
                    </tr>
                  ) : filteredData.length === 0 ? (
                    <tr>
                      <td colSpan={currentConfig.fields.length + 2} className="border border-slate-300 p-8 text-center text-slate-500 dark:border-slate-600">
                        {searchText ? `ไม่พบข้อมูลที่ตรงกับ "${searchText}"` : "ไม่พบข้อมูล"}
                      </td>
                    </tr>
                  ) : (
                    filteredData.map((row) => (
                      <tr key={row.id} className="hover:bg-slate-50 dark:hover:bg-slate-700/30 transition-colors">
                        <td className="border border-slate-300 p-3 text-center dark:border-slate-600">{row.id}</td>
                        {currentConfig.fields.map((f) => (
                          <td key={f.name} className="border border-slate-300 p-3 dark:border-slate-600">
                            {f.name === "business_group" && row[f.name] != null ? (
                              BUSINESS_GROUP_MAP[row[f.name]] || row[f.name]
                            ) : f.type === "boolean" ? (
                              row[f.name] ? (
                                <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-semibold text-amber-800 dark:bg-amber-900/40 dark:text-amber-200">
                                  − {f.trueLabel}
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-semibold text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-200">
                                  ＋ {f.falseLabel}
                                </span>
                              )
                            ) : f.type === "multi-select" && Array.isArray(row[f.name]) ? (
                              row[f.name].length === 0 ? (
                                "-"
                              ) : (
                                <div className="flex flex-wrap gap-1">
                                  {row[f.name].map((id) => (
                                    <span
                                      key={id}
                                      className="inline-flex items-center rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-200"
                                    >
                                      {BUSINESS_GROUP_MAP[id] || id}
                                    </span>
                                  ))}
                                </div>
                              )
                            ) : (row[f.name] !== null && row[f.name] !== undefined ? String(row[f.name]) : "-")}
                          </td>
                        ))}
                        <td className="border border-slate-300 p-3 text-center dark:border-slate-600">
                          <div className="flex items-center justify-center gap-2">
                            <button
                              onClick={() => handleEdit(row)}
                              className="text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300 p-1.5 bg-blue-50 dark:bg-blue-900/20 rounded-md transition-all cursor-pointer transform hover:scale-110 active:scale-95"
                              title="แก้ไข"
                            >
                              ✏️
                            </button>
                            <button
                              onClick={() => handleDelete(row.id)}
                              className="text-red-600 hover:text-red-800 dark:text-red-400 dark:hover:text-red-300 p-1.5 bg-red-50 dark:bg-red-900/20 rounded-md transition-all cursor-pointer transform hover:scale-110 active:scale-95"
                              title="ลบ"
                            >
                              🗑️
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>

        </div>

        {/* --- MODAL FORM --- */}
        {isModalOpen && ReactDOM.createPortal(
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
            <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-xl dark:bg-slate-800 transform transition-all animate-in zoom-in-95 duration-200">
              <h2 className="mb-4 text-xl font-bold border-b border-slate-100 dark:border-slate-700 pb-3">
                {editingId ? "✏️ แก้ไขข้อมูล" : "+ เพิ่มข้อมูลใหม่"} - {currentConfig.label.split(" ")[1]}
              </h2>

              <form onSubmit={handleSubmit} className="flex flex-col gap-4">
                {currentConfig.fields.map((f) => (
                  <div key={f.name}>
                    <label className={labelCls}>
                      {f.label} {f.required && <span className="text-red-500">*</span>}
                    </label>
                    {f.type === "select" ? (
                      <ComboBox
                        options={[{ value: "", label: `— ไม่ระบุ —` }, ...f.options]}
                        value={formData[f.name]}
                        onChange={(val) => handleChange({ target: { name: f.name, value: val, type: "select" } })}
                        placeholder={`— เลือก${f.label} —`}
                      />
                    ) : f.type === "multi-select" ? (
                      <MultiSelectComboBox
                        options={f.options}
                        values={Array.isArray(formData[f.name]) ? formData[f.name] : []}
                        onChange={(vals) => handleChange({ target: { name: f.name, value: vals, type: "multi-select" } })}
                        placeholder={`— เลือก${f.label} (เลือกได้หลายรายการ) —`}
                      />
                    ) : f.type === "boolean" ? (
                      <div>
                        <div className="grid grid-cols-2 gap-2">
                          <button
                            type="button"
                            onClick={() => handleChange({ target: { name: f.name, value: false, type: "boolean" } })}
                            className={cx(
                              "flex items-center justify-center gap-1.5 rounded-xl border px-3 py-2.5 text-sm font-medium transition-all cursor-pointer",
                              !formData[f.name]
                                ? "border-emerald-500 bg-emerald-50 text-emerald-700 ring-1 ring-emerald-500/30 dark:border-emerald-400 dark:bg-emerald-900/30 dark:text-emerald-300"
                                : "border-slate-300 bg-slate-50 text-slate-500 hover:bg-slate-100 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-400"
                            )}
                          >
                            <span className="text-base leading-none">＋</span> {f.falseLabel}
                          </button>
                          <button
                            type="button"
                            onClick={() => handleChange({ target: { name: f.name, value: true, type: "boolean" } })}
                            className={cx(
                              "flex items-center justify-center gap-1.5 rounded-xl border px-3 py-2.5 text-sm font-medium transition-all cursor-pointer",
                              formData[f.name]
                                ? "border-amber-500 bg-amber-50 text-amber-700 ring-1 ring-amber-500/30 dark:border-amber-400 dark:bg-amber-900/30 dark:text-amber-300"
                                : "border-slate-300 bg-slate-50 text-slate-500 hover:bg-slate-100 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-400"
                            )}
                          >
                            <span className="text-base leading-none">−</span> {f.trueLabel}
                          </button>
                        </div>
                        {editingId && (
                          <p className="mt-2 flex items-start gap-1.5 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-700 dark:bg-amber-900/20 dark:text-amber-300">
                            <span className="shrink-0">⚠️</span>
                            <span>การเปลี่ยนประเภทจะมีผลกับค่ารายเดือนที่บันทึก<b>ใหม่</b>เท่านั้น ค่าที่บันทึกไว้ก่อนหน้าจะไม่ถูกแก้ไขย้อนหลัง</span>
                          </p>
                        )}
                      </div>
                    ) : (
                      <input
                        type={f.type === "number" ? "number" : "text"}
                        name={f.name}
                        value={formData[f.name] ?? ""}
                        onChange={handleChange}
                        required={f.required}
                        className={baseInput}
                        placeholder={`ระบุ${f.label}...`}
                      />
                    )}
                  </div>
                ))}

                <div className="mt-4 flex justify-end gap-3 pt-4 border-t border-slate-100 dark:border-slate-700">
                  <button
                    type="button"
                    onClick={() => setIsModalOpen(false)}
                    className="rounded-xl border border-slate-300 bg-white px-5 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-200 dark:hover:bg-slate-600 transition-all cursor-pointer transform hover:scale-105 active:scale-95"
                  >
                    ยกเลิก
                  </button>
                  <button
                    type="submit"
                    className="rounded-xl bg-emerald-600 px-5 py-2 text-sm font-medium text-white hover:bg-emerald-700 shadow-sm transition-all cursor-pointer transform hover:scale-105 active:scale-95"
                  >
                    บันทึกข้อมูล
                  </button>
                </div>
              </form>
            </div>
          </div>,
          document.body
        )}

      </div>
    </>
  )
}

export default BusinessEdit