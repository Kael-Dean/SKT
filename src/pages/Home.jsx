// src/pages/Home.jsx
import { useEffect, useState } from "react"
import { apiAuth } from "../lib/api"   // ✅ เรียก API พร้อมแนบ token อัตโนมัติ

function Home() {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchUser = async () => {
      try {
        const data = await apiAuth("/me")  // 👈 endpoint profile ผู้ใช้ (คุณต้องมีหลังบ้านรองรับ)
        setUser(data)
      } catch (err) {
        console.error("โหลดข้อมูลผู้ใช้ล้มเหลว:", err)
      } finally {
        setLoading(false)
      }
    }
    fetchUser()
  }, [])

  if (loading) {
    return <div className="text-center text-slate-500">กำลังโหลดข้อมูล...</div>
  }

  return (
    <div className="text-center text-xl font-semibold text-green-600">
      ✅ หน้าหลักใช้งานได้แล้ว.
      {user && (
        <div className="mt-3 text-lg text-slate-700 dark:text-slate-200">
          สวัสดี, {user.name || "ผู้ใช้"}
        </div>
      )}
    </div>
  )
}

export default Home
