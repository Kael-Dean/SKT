import React, { useState, useEffect, useMemo, useRef } from "react"
import { apiAuth } from "../../lib/api" 

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
    label: "💰 ประเภทต้นทุน (Cost Types)",
    endpoint: "/cost-types",
    fields: [
      { name: "name", label: "ชื่อประเภทต้นทุน", type: "text", required: true },
      { name: "comment", label: "หมายเหตุ", type: "text" },
    ],
  },
  {
    key: "earning-types",
    label: "💵 ประเภทรายได้ (Earning Types)",
    endpoint: "/earning-types",
    fields: [
      { name: "name", label: "ชื่อประเภทรายได้", type: "text", required: true },
      { name: "comment", label: "หมายเหตุ", type: "text" },
    ],
  },
  {
    key: "aux-costs",
    label: "🧾 ต้นทุนส่วนเพิ่ม (Aux Costs)",
    endpoint: "/aux-costs",
    fields: [
      { name: "name", label: "ชื่อต้นทุน", type: "text", required: true },
      { name: "business_group", label: "กลุ่มธุรกิจ", type: "select", options: BUSINESS_GROUP_OPTIONS },
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

const BusinessEdit = () => {
  const [activeTab, setActiveTab] = useState(TABS[0].key)
  const [data, setData] = useState([])
  const [loading, setLoading] = useState(false)

  // Form State
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [editingId, setEditingId] = useState(null)
  const [formData, setFormData] = useState({})

  const currentConfig = useMemo(() => TABS.find((t) => t.key === activeTab), [activeTab])

  useEffect(() => {
    fetchData()
  }, [activeTab])

  const fetchData = async () => {
    setLoading(true)
    try {
      const res = await apiAuth(`${currentConfig.endpoint}`, { method: "GET" })
      setData(res || [])
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
      initialData[f.name] = ""
    })
    setFormData(initialData)
    setEditingId(null)
    setIsModalOpen(true)
  }

  const handleEdit = (item) => {
    const initialData = {}
    currentConfig.fields.forEach(f => {
      initialData[f.name] = item[f.name] ?? ""
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
    } catch (err) {
      console.error(err)
      alert("เกิดข้อผิดพลาดในการลบข้อมูล หรือคุณไม่มีสิทธิ์ (Admin Only)")
    }
  }

  const handleChange = (e) => {
    const { name, value, type } = e.target
    const fieldConfig = currentConfig.fields.find(f => f.name === name)
    let parsedValue = value
    if (fieldConfig?.type === "number" || fieldConfig?.type === "select") {
      parsedValue = value === "" ? "" : Number(value)
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
      if (f.required && (payload[f.name] === "" || payload[f.name] === null || payload[f.name] === undefined)) {
        alert(`กรุณาระบุ ${f.label}`)
        return
      }
    }

    try {
      if (editingId) {
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
              className={`px-4 py-2 text-sm font-medium rounded-lg transition-all cursor-pointer transform hover:scale-105 active:scale-95 ${
                activeTab === tab.key
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
          
          <div className="flex items-center justify-between border-b border-slate-300 dark:border-slate-700 p-4">
            <h2 className="text-lg font-bold">{currentConfig.label}</h2>
            <button
              onClick={handleAdd}
              className="bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded-xl text-sm font-semibold transition-all cursor-pointer transform hover:scale-105 active:scale-95 shadow-md hover:shadow-lg"
            >
              + เพิ่มข้อมูล
            </button>
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
                ) : data.length === 0 ? (
                  <tr>
                    <td colSpan={currentConfig.fields.length + 2} className="border border-slate-300 p-8 text-center text-slate-500 dark:border-slate-600">
                      ไม่พบข้อมูล
                    </td>
                  </tr>
                ) : (
                  data.map((row) => (
                    <tr key={row.id} className="hover:bg-slate-50 dark:hover:bg-slate-700/30 transition-colors">
                      <td className="border border-slate-300 p-3 text-center dark:border-slate-600">{row.id}</td>
                      {currentConfig.fields.map((f) => (
                        <td key={f.name} className="border border-slate-300 p-3 dark:border-slate-600">
                          {f.name === "business_group" && row[f.name] != null
                            ? BUSINESS_GROUP_MAP[row[f.name]] || row[f.name]
                            : (row[f.name] !== null && row[f.name] !== undefined ? String(row[f.name]) : "-")}
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
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm overflow-y-auto">
          <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-xl dark:bg-slate-800 transform transition-all animate-in zoom-in-95 duration-200 my-auto">
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
        </div>
      )}

    </div>
    </>
  )
}

export default BusinessEdit