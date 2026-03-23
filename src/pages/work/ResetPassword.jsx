// src/pages/work/ResetPassword.jsx
// ขั้นตอนที่ 2 ของการลืมรหัสผ่าน — ผู้ใช้กดลิงก์จาก LINE แล้วมาที่หน้านี้
// token จะอยู่ใน query string: /reset-password?token=xxx
import { useState } from "react"
import { useNavigate, useSearchParams, Navigate } from "react-router-dom"
import { api } from "../../lib/api"
import sktBg from "../../assets/skt_bg.png"

const asset = (p) => `${import.meta.env.BASE_URL.replace(/\/+$/, "")}${p}`

const EyeOpen = () => (
  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path strokeLinecap="round" strokeLinejoin="round" d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
    <circle cx="12" cy="12" r="3" />
  </svg>
)

const EyeOff = () => (
  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path strokeLinecap="round" strokeLinejoin="round" d="M17.94 17.94A10.07 10.07 0 0112 20c-7 0-11-8-11-8a18.45 18.45 0 015.06-5.94M9.9 4.24A9.12 9.12 0 0112 4c7 0 11 8 11 8a18.5 18.5 0 01-2.16 3.19m-6.72-1.07a3 3 0 11-4.24-4.24M1 1l22 22" />
  </svg>
)

export default function ResetPassword() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const token = searchParams.get("token")

  const [newPass, setNewPass] = useState("")
  const [confirmPass, setConfirmPass] = useState("")
  const [showNew, setShowNew] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")
  const [success, setSuccess] = useState(false)

  // ถ้าไม่มี token ใน URL → เด้งกลับหน้า login
  if (!token) {
    return <Navigate to="/" replace />
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError("")
    if (newPass.length < 8) {
      setError("รหัสผ่านต้องมีอย่างน้อย 8 ตัวอักษร")
      return
    }
    if (newPass !== confirmPass) {
      setError("รหัสผ่านใหม่และการยืนยันไม่ตรงกัน")
      return
    }
    setLoading(true)
    try {
      await api("/auth/reset-password", {
        method: "POST",
        body: { token, new_password: newPass },
      })
      setSuccess(true)
    } catch (err) {
      setError(err?.message || "รีเซ็ตรหัสผ่านไม่สำเร็จ ลิงก์อาจหมดอายุแล้ว")
    } finally {
      setLoading(false)
    }
  }

  const inputCls =
    "w-full rounded-2xl border border-gray-200 px-4 py-2.5 pr-12 text-sm shadow-sm outline-none transition placeholder:text-gray-400 focus:border-indigo-400 focus:ring-2 focus:ring-indigo-500/20 dark:border-gray-600 dark:bg-gray-700 dark:text-white dark:placeholder:text-gray-500 dark:focus:border-indigo-500"

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

          {!success ? (
            <>
              <div className="mb-5">
                <h2 className="text-xl font-bold text-gray-800 dark:text-gray-100">ตั้งรหัสผ่านใหม่</h2>
                <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                  กรอกรหัสผ่านใหม่ของคุณด้านล่าง
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
                    รหัสผ่านใหม่
                  </label>
                  <div className="relative">
                    <input
                      type={showNew ? "text" : "password"}
                      className={inputCls}
                      value={newPass}
                      onChange={(e) => setNewPass(e.target.value)}
                      placeholder="อย่างน้อย 8 ตัวอักษร"
                      required
                      autoComplete="new-password"
                      autoFocus
                    />
                    <button
                      type="button"
                      onClick={() => setShowNew((v) => !v)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition cursor-pointer"
                      tabIndex={-1}
                    >
                      {showNew ? <EyeOff /> : <EyeOpen />}
                    </button>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                    ยืนยันรหัสผ่านใหม่
                  </label>
                  <div className="relative">
                    <input
                      type={showConfirm ? "text" : "password"}
                      className={inputCls}
                      value={confirmPass}
                      onChange={(e) => setConfirmPass(e.target.value)}
                      placeholder="กรอกรหัสผ่านอีกครั้ง"
                      required
                      autoComplete="new-password"
                    />
                    <button
                      type="button"
                      onClick={() => setShowConfirm((v) => !v)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition cursor-pointer"
                      tabIndex={-1}
                    >
                      {showConfirm ? <EyeOff /> : <EyeOpen />}
                    </button>
                  </div>
                </div>

                {newPass && confirmPass && newPass !== confirmPass && (
                  <p className="text-xs text-red-500">รหัสผ่านไม่ตรงกัน</p>
                )}
                {newPass.length > 0 && newPass.length < 8 && (
                  <p className="text-xs text-amber-600">รหัสผ่านต้องมีอย่างน้อย 8 ตัวอักษร</p>
                )}

                <button
                  type="submit"
                  disabled={loading || !newPass || !confirmPass}
                  className="w-full rounded-2xl bg-indigo-600 py-2.5 font-semibold text-white shadow-sm transition hover:bg-indigo-700 active:scale-[0.98] disabled:opacity-60 disabled:cursor-not-allowed cursor-pointer"
                >
                  {loading ? (
                    <span className="flex items-center justify-center gap-2">
                      <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white" />
                      กำลังบันทึก...
                    </span>
                  ) : "เปลี่ยนรหัสผ่าน"}
                </button>
              </form>
            </>
          ) : (
            /* ── สำเร็จ ── */
            <div className="text-center py-2">
              <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-green-100 dark:bg-green-900/40">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 text-green-600 dark:text-green-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <h4 className="text-base font-bold text-gray-800 dark:text-gray-100 mb-1">เปลี่ยนรหัสผ่านสำเร็จ!</h4>
              <p className="text-sm text-gray-500 dark:text-gray-400 mb-6">
                คุณสามารถเข้าสู่ระบบด้วยรหัสผ่านใหม่ได้เลย
              </p>
              <button
                onClick={() => navigate("/")}
                className="w-full rounded-2xl bg-indigo-600 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-indigo-700 active:scale-[0.98] cursor-pointer"
              >
                ไปยังหน้าเข้าสู่ระบบ
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
