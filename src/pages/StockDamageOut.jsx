// src/pages/StockDamageOut.jsx
import { useEffect, useState } from "react"
import { get } from "../lib/api"   // ดึง helper ที่แนบ token อัตโนมัติ

const StockDamageOut = () => {
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true)
      try {
        const data = await get("/report/stock/damage-out") // 👈 เปลี่ยน endpoint ตาม backend
        setRows(Array.isArray(data) ? data : [])
      } catch (e) {
        console.error("load damage-out failed:", e)
        setRows([])
      } finally {
        setLoading(false)
      }
    }
    fetchData()
  }, [])

  return (
    <div className="p-4">
      <h1 className="text-xl font-semibold mb-3">📦 ตัดเสียหาย</h1>
      {loading ? (
        <div>กำลังโหลด…</div>
      ) : rows.length === 0 ? (
        <div>ไม่พบข้อมูล</div>
      ) : (
        <pre className="bg-slate-100 rounded-xl p-3 text-sm">
          {JSON.stringify(rows, null, 2)}
        </pre>
      )}
    </div>
  )
}

export default StockDamageOut
