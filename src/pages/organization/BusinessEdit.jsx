import React, { useState, useEffect, useMemo } from "react"
// นำเข้า API helper ของคุณ (ปรับแก้ path ให้ตรงกับโปรเจกต์ของคุณ)
import { apiAuth } from "../lib/api" 

/** ---------- Configuration สำหรับแต่ละ Entity ---------- */
const TABS = [
  {
    key: "products",
    label: "📦 สินค้า (Products)",
    endpoint: "/products",
    fields: [
      { name: "product_type", label: "ประเภทสินค้า", type: "text", required: true },
      { name: "unit", label: "หน่วยนับ", type: "text", required: true },
      { name: "business_group", label: "กลุ่มธุรกิจ (ID)", type: "number" },
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
    key: "business-costs",
    label: "📉 ต้นทุนธุรกิจ (Business Costs)",
    endpoint: "/business-costs",
    fields: [
      { name: "cost_id", label: "ประเภทต้นทุน (Cost ID)", type: "number", required: true },
      { name: "business_group", label: "กลุ่มธุรกิจ (ID)", type: "number", required: true },
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
    key: "business-earnings",
    label: "📈 รายได้ธุรกิจ (Business Earnings)",
    endpoint: "/business-earnings",
    fields: [
      { name: "earning_id", label: "ประเภทรายได้ (Earning ID)", type: "number", required: true },
      { name: "business_group", label: "กลุ่มธุรกิจ (ID)", type: "number", required: true },
      { name: "comment", label: "หมายเหตุ", type: "text" },
    ],
  },
  {
    key: "aux-costs",
    label: "🧾 ต้นทุนส่วนเพิ่ม (Aux Costs)",
    endpoint: "/aux-costs",
    fields: [
      { name: "name", label: "ชื่อต้นทุน", type: "text", required: true },
      { name: "business_group", label: "กลุ่มธุรกิจ (ID)", type: "number" },
      { name: "comment", label: "หมายเหตุ", type: "text" },
    ],
  },
  {
    key: "branches",
    label: "🏢 สาขา (Branches)",
    endpoint: "/branches",
    fields: [
      { name: "branch_name", label: "ชื่อสาขา", type: "text", required: true },
      { name: "address", label: "ที่อยู่", type: "text" },
      { name: "mhoo", label: "หมู่", type: "text" },
      { name: "sub_district", label: "ตำบล", type: "text" },
      { name: "district", label: "อำเภอ", type: "text" },
      { name: "province", label: "จังหวัด", type: "text" },
      { name: "postal_code", label: "รหัสไปรษณีย์", type: "number" },
    ],
  },
  {
    key: "units",
    label: "🏘️ หน่วยงาน (Units)",
    endpoint: "/units",
    fields: [
      { name: "branch_id", label: "สาขา (Branch ID)", type: "number", required: true },
      { name: "unit", label: "ชื่อหน่วยงาน", type: "text", required: true },
      { name: "abbreviation", label: "ตัวย่อ", type: "text", required: true },
    ],
  },
]

/** ---------- Styles ---------- */
const baseInput = "w-full rounded-xl border border-slate-300 bg-slate-50 p-2.5 text-sm outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 dark:border-slate-600 dark:bg-slate-700 dark:text-white dark:focus:border-emerald-400"
const labelCls = "mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300"

const BusinessEdit = () => {
  const [activeTab, setActiveTab] = useState(TABS[0].key)
  const [data, setData] = useState([])
  const [loading, setLoading] = useState(false)

  // Form State
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [editingId, setEditingId] = useState(null) // null = สร้างใหม่, มีค่า = แก้ไข
  const [formData, setFormData] = useState({})

  const currentConfig = useMemo(() => TABS.find((t) => t.key === activeTab), [activeTab])

  /** โหลดข้อมูลเมื่อเปลี่ยน Tab */
  useEffect(() => {
    fetchData()
  }, [activeTab])

  const fetchData = async () => {
    setLoading(true)
    try {
      // ดึงข้อมูลเฉพาะรายการที่ is_active = true (ตามค่า default ของ BE)
      const res = await apiAuth(`${currentConfig.endpoint}`)
      setData(res || [])
    } catch (err) {
      console.error(err)
      alert("เกิดข้อผิดพลาดในการโหลดข้อมูล")
    } finally {
      setLoading(false)
    }
  }

  /** เปิด Modal สำหรับสร้างใหม่ */
  const handleAdd = () => {
    const initialData = {}
    currentConfig.fields.forEach(f => {
      initialData[f.name] = ""
    })
    setFormData(initialData)
    setEditingId(null)
    setIsModalOpen(true)
  }

  /** เปิด Modal สำหรับแก้ไข */
  const handleEdit = (item) => {
    const initialData = {}
    currentConfig.fields.forEach(f => {
      initialData[f.name] = item[f.name] ?? ""
    })
    setFormData(initialData)
    setEditingId(item.id)
    setIsModalOpen(true)
  }

  /** ลบข้อมูล (Soft Delete) */
  const handleDelete = async (id) => {
    if (!window.confirm("คุณแน่ใจหรือไม่ที่จะลบรายการนี้? (ระบบจะเปลี่ยนสถานะเป็น Inactive)")) return
    
    try {
      await apiAuth(`${currentConfig.endpoint}/${id}`, { method: "DELETE" })
      fetchData() // รีโหลดข้อมูลหลังลบสำเร็จ
    } catch (err) {
      console.error(err)
      alert("เกิดข้อผิดพลาดในการลบข้อมูล หรือคุณไม่มีสิทธิ์ (Admin Only)")
    }
  }

  /** เปลี่ยนแปลงค่าใน Form */
  const handleChange = (e) => {
    const { name, value, type } = e.target
    setFormData(prev => ({
      ...prev,
      [name]: type === "number" ? (value === "" ? "" : Number(value)) : value
    }))
  }

  /** บันทึกข้อมูล (Create / Update) */
  const handleSubmit = async (e) => {
    e.preventDefault()
    
    // Clean payload: เอาฟิลด์ที่เป็นค่าว่าง "" สำหรับ number ออกให้เป็น null (ถ้าจำเป็น)
    const payload = { ...formData }
    currentConfig.fields.forEach(f => {
      if (f.type === "number" && payload[f.name] === "") {
        payload[f.name] = null
      }
    })

    try {
      if (editingId) {
        // อัปเดตข้อมูล (PUT)
        await apiAuth(`${currentConfig.endpoint}/${editingId}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload)
        })
      } else {
        // สร้างใหม่ (POST)
        await apiAuth(`${currentConfig.endpoint}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload)
        })
      }
      setIsModalOpen(false)
      fetchData()
    } catch (err) {
      console.error(err)
      alert(err.message || "เกิดข้อผิดพลาด กรุณาตรวจสอบสิทธิ์ (Admin Only) หรือความถูกต้องของข้อมูล")
    }
  }

  return (
    <div className="min-h-screen bg-slate-50 text-black dark:bg-slate-900 dark:text-white rounded-2xl md:p-6 p-4">
      <div className="mx-auto max-w-[1400px]">
        
        <div className="mb-6 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl md:text-3xl font-extrabold text-slate-800 dark:text-white">⚙️ จัดการข้อมูลระบบ (Master Data)</h1>
            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
              เพิ่ม/แก้ไข/ลบ ข้อมูลพื้นฐานที่ใช้ในระบบ (เฉพาะ Admin เท่านั้นที่สามารถจัดการได้)
            </p>
          </div>
        </div>

        {/* --- TABS --- */}
        <div className="mb-6 flex flex-wrap gap-2 rounded-xl bg-white p-2 shadow-sm dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
          {TABS.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`px-4 py-2 text-sm font-medium rounded-lg transition-all ${
                activeTab === tab.key
                  ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300"
                  : "text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-700"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* --- MAIN CONTENT --- */}
        <div className="rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-700 dark:bg-slate-800 overflow-hidden">
          
          <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-700 p-4">
            <h2 className="text-lg font-bold">{currentConfig.label}</h2>
            <button
              onClick={handleAdd}
              className="bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded-xl text-sm font-semibold transition shadow-sm"
            >
              + เพิ่มข้อมูล
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-slate-600 dark:text-slate-300">
              <thead className="bg-slate-50 text-slate-700 dark:bg-slate-700/50 dark:text-slate-200">
                <tr>
                  <th className="p-4 font-semibold w-16">ID</th>
                  {currentConfig.fields.map((f) => (
                    <th key={f.name} className="p-4 font-semibold">{f.label}</th>
                  ))}
                  <th className="p-4 font-semibold text-center w-32">จัดการ</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 dark:divide-slate-700">
                {loading ? (
                  <tr>
                    <td colSpan={currentConfig.fields.length + 2} className="p-8 text-center text-slate-500">
                      กำลังโหลดข้อมูล...
                    </td>
                  </tr>
                ) : data.length === 0 ? (
                  <tr>
                    <td colSpan={currentConfig.fields.length + 2} className="p-8 text-center text-slate-500">
                      ไม่พบข้อมูล
                    </td>
                  </tr>
                ) : (
                  data.map((row) => (
                    <tr key={row.id} className="hover:bg-slate-50 dark:hover:bg-slate-700/30 transition">
                      <td className="p-4">{row.id}</td>
                      {currentConfig.fields.map((f) => (
                        <td key={f.name} className="p-4">
                          {row[f.name] !== null && row[f.name] !== undefined ? String(row[f.name]) : "-"}
                        </td>
                      ))}
                      <td className="p-4 text-center">
                        <div className="flex items-center justify-center gap-2">
                          <button
                            onClick={() => handleEdit(row)}
                            className="text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300 p-1 bg-blue-50 dark:bg-blue-900/20 rounded-md"
                            title="แก้ไข"
                          >
                            ✏️
                          </button>
                          <button
                            onClick={() => handleDelete(row.id)}
                            className="text-red-600 hover:text-red-800 dark:text-red-400 dark:hover:text-red-300 p-1 bg-red-50 dark:bg-red-900/20 rounded-md"
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
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
          <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-xl dark:bg-slate-800">
            <h2 className="mb-4 text-xl font-bold border-b border-slate-100 dark:border-slate-700 pb-3">
              {editingId ? "✏️ แก้ไขข้อมูล" : "+ เพิ่มข้อมูลใหม่"} - {currentConfig.label.split(" ")[1]}
            </h2>
            
            <form onSubmit={handleSubmit} className="flex flex-col gap-4">
              {currentConfig.fields.map((f) => (
                <div key={f.name}>
                  <label className={labelCls}>
                    {f.label} {f.required && <span className="text-red-500">*</span>}
                  </label>
                  <input
                    type={f.type === "number" ? "number" : "text"}
                    name={f.name}
                    value={formData[f.name]}
                    onChange={handleChange}
                    required={f.required}
                    className={baseInput}
                    placeholder={`ระบุ${f.label}...`}
                  />
                </div>
              ))}

              <div className="mt-4 flex justify-end gap-3 pt-4 border-t border-slate-100 dark:border-slate-700">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="rounded-xl border border-slate-300 bg-white px-5 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-200 dark:hover:bg-slate-600"
                >
                  ยกเลิก
                </button>
                <button
                  type="submit"
                  className="rounded-xl bg-emerald-600 px-5 py-2 text-sm font-medium text-white hover:bg-emerald-700 shadow-sm"
                >
                  บันทึกข้อมูล
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  )
}

export default BusinessEdit