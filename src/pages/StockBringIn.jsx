// src/pages/StockBringIn.jsx
import { useEffect, useState } from "react"
import { get } from "../lib/api"   // ใช้ get/post/... จาก api.js

const StockBringIn = () => {
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true)
      try {
        const data = await get("/report/stock/bring-in") // endpoint จริงตาม backend
        setRows(Array.isArray(data) ? data : [])
      } catch (e) {
        console.error("load bring-in failed:", e)
        setRows([])
      } finally {
        setLoading(false)
      }
    }
    fetchData()
  }, [])

  return (
    <div className="p-4">
      <h1 className="text-xl font-semibold mb-3">📦 สต็อกยกมา</h1>
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

export default StockBringIn
