// src/pages/work/ForgotPassword.jsx
// ขั้นตอนที่ 1 ของการลืมรหัสผ่าน — กรอก username แล้ว BE ส่งลิงก์ไปยัง LINE
import { useState } from "react"
import { useNavigate, useSearchParams, Navigate } from "react-router-dom"
import { api } from "../../lib/api"
import sktBg from "../../assets/skt_bg.png"
import lineIcon from "../../assets/line-icon.png"

const asset = (p) => `${import.meta.env.BASE_URL.replace(/\/+$/, "")}${p}`

export default function ForgotPassword() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const [username, setUsername] = useState("")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")
  const [sent, setSent] = useState(false)

  // กรณี backend ส่ง token มาที่ /forgot-password แทน /reset-password
  const tokenInUrl = searchParams.get("token")
  if (tokenInUrl) {
    return <Navigate to={`/reset-password?token=${encodeURIComponent(tokenInUrl)}`} replace />
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!username.trim()) return
    setError("")
    setLoading(true)
    try {
      await api("/auth/request-reset", {
        method: "POST",
        body: { username: username.trim() },
      })
      setSent(true)
    } catch (err) {
      setError(err?.message || "ไม่พบชื่อผู้ใช้นี้ในระบบ หรือผู้ใช้ยังไม่ได้ผูก LINE")
    } finally {
      setLoading(false)
    }
  }

  return (
    <div
      className="relative min-h-screen flex items-center justify-center px-4"
      style={{ backgroundImage: `url(${sktBg})`, backgroundSize: "cover", backgroundPosition: "center" }}
    >
      <div className="absolute inset-0 bg-gray-900/40" />
      <div className="absolute inset-0 bg-indigo-950/55" />

      <div className="relative z-10 w-full max-w-md">
        {/* Branding */}
        <div className="mb-6 text-center">
          <div className="flex justify-center mb-3">
            <div className="rounded-2xl bg-white p-2 shadow-md">
              <img
                src={asset("/logo/skt-logo.png")}
                onError={(e) => { e.currentTarget.src = asset("/logo/skt-logo-dark.png") }}
                alt="โลโก้องค์กร"
                className="h-14 w-auto object-contain"
                loading="eager"
              />
            </div>
          </div>
          <h1 className="text-base font-semibold text-white/90 leading-snug">
            สหกรณ์การเกษตรเพื่อการตลาดลูกค้า ธ.ก.ส.
          </h1>
          <p className="text-sm text-white/65">จังหวัดสุรินทร์</p>
        </div>

        {/* Card */}
        <div className="rounded-2xl bg-white/90 dark:bg-gray-900/80 shadow-xl backdrop-blur-md ring-1 ring-white/20 dark:ring-white/10 p-8">

          {!sent ? (
            <>
              <div className="mb-5">
                <h2 className="text-xl font-bold text-gray-800 dark:text-gray-100">ลืมรหัสผ่าน</h2>
                <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                  กรอกชื่อผู้ใช้ของคุณ ระบบจะส่งลิงก์รีเซ็ตรหัสผ่านไปยัง LINE ที่ผูกกับบัญชีนี้
                </p>
              </div>

              {error && (
                <div className="mb-5 flex items-start gap-2 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700 dark:bg-red-900/30 dark:text-red-200">
                  <span className="mt-0.5 shrink-0">⚠️</span>
                  <span>{error}</span>
                </div>
              )}

              <form onSubmit={handleSubmit} className="space-y-5">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                    ชื่อผู้ใช้ (Username)
                  </label>
                  <input
                    type="text"
                    autoFocus
                    className="w-full rounded-2xl border border-gray-200 px-4 py-2.5 text-sm shadow-sm outline-none transition placeholder:text-gray-400 focus:border-indigo-400 focus:ring-2 focus:ring-indigo-500/20 dark:border-gray-600 dark:bg-gray-700 dark:text-white dark:placeholder:text-gray-500 dark:focus:border-indigo-500"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    placeholder="กรอกชื่อผู้ใช้ของคุณ"
                    required
                  />
                </div>

                <button
                  type="submit"
                  disabled={loading || !username.trim()}
                  className="w-full rounded-2xl bg-indigo-600 py-2.5 font-semibold text-white shadow-sm transition hover:bg-indigo-700 active:scale-[0.98] disabled:opacity-60 disabled:cursor-not-allowed cursor-pointer"
                >
                  {loading ? (
                    <span className="flex items-center justify-center gap-2">
                      <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white" />
                      กำลังส่งลิงก์...
                    </span>
                  ) : <span className="flex items-center justify-center gap-2"><img src={lineIcon} alt="LINE" className="h-5 w-5 object-contain" />ส่งลิงก์รีเซ็ตรหัสผ่านไปยัง LINE</span>}
                </button>

                <div className="text-center pt-1">
                  <button
                    type="button"
                    onClick={() => navigate("/")}
                    className="text-sm text-indigo-500 hover:text-indigo-700 dark:text-indigo-400 dark:hover:text-indigo-300 transition underline-offset-2 hover:underline cursor-pointer"
                  >
                    กลับสู่หน้าเข้าสู่ระบบ
                  </button>
                </div>
              </form>
            </>
          ) : (
            /* ── ส่ง link สำเร็จ ── */
            <div className="text-center py-2">
              <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-green-100 dark:bg-green-900/40">
                <img src={lineIcon} alt="LINE" className="h-10 w-10 object-contain" />
              </div>
              <h4 className="text-base font-bold text-gray-800 dark:text-gray-100 mb-1">ส่งลิงก์สำเร็จแล้ว!</h4>
              <p className="text-sm text-gray-500 dark:text-gray-400 mb-1">
                ระบบส่งลิงก์รีเซ็ตรหัสผ่านไปยัง LINE ที่ผูกกับบัญชี
              </p>
              <p className="text-sm font-semibold text-indigo-600 dark:text-indigo-400 mb-5">
                {username}
              </p>
              <p className="text-xs text-gray-400 dark:text-gray-500 mb-6">
                กรุณาตรวจสอบ LINE ของคุณ แล้วกดลิงก์เพื่อตั้งรหัสผ่านใหม่<br />
                ลิงก์จะหมดอายุใน 15 นาที
              </p>
              <button
                onClick={() => navigate("/")}
                className="w-full rounded-2xl bg-indigo-600 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-indigo-700 active:scale-[0.98] cursor-pointer"
              >
                กลับสู่หน้าเข้าสู่ระบบ
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
