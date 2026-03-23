// src/pages/work/ChangePassword.jsx
// เปลี่ยนรหัสผ่านครั้งแรก — สำหรับ account ที่ account_status == "new"
import { useState } from "react"
import { useNavigate, Navigate } from "react-router-dom"
import { apiAuth } from "../../lib/api"
import sktBg from "../../assets/skt_bg.png"

const asset = (p) => `${import.meta.env.BASE_URL.replace(/\/+$/, "")}${p}`

export default function ChangePassword() {
  const navigate = useNavigate()
  const accountStatus = localStorage.getItem("account_status")

  // state ต้องอยู่ก่อน conditional return เสมอ (Rules of Hooks)
  const [newPass, setNewPass] = useState("")
  const [confirmPass, setConfirmPass] = useState("")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")
  const [showNew, setShowNew] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)

  // ถ้าไม่ใช่ "new" ให้เด้งไปหน้าหลัก
  if (accountStatus !== "new") {
    return <Navigate to="/home" replace />
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError("")
    if (newPass.length < 8) {
      setError("รหัสผ่านต้องมีอย่างน้อย 8 ตัวอักษร")
      return
    }
    if (newPass !== confirmPass) {
      setError("รหัสผ่านทั้งสองช่องไม่ตรงกัน")
      return
    }
    setLoading(true)
    try {
      await apiAuth("/auth/change-password", {
        method: "POST",
        body: { new_password: newPass },
      })
      localStorage.setItem("account_status", "registered")
      navigate("/home", { replace: true })
    } catch (err) {
      setError(err?.message || "เปลี่ยนรหัสผ่านไม่สำเร็จ")
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
          <div className="mb-5">
            <h2 className="text-xl font-bold text-gray-800 dark:text-gray-100">
              ตั้งรหัสผ่านใหม่
            </h2>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
              บัญชีของคุณเป็นบัญชีใหม่ กรุณาตั้งรหัสผ่านก่อนเข้าใช้งาน
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
                />
                <button
                  type="button"
                  onClick={() => setShowNew((v) => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition cursor-pointer"
                  tabIndex={-1}
                >
                  {showNew ? (
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M17.94 17.94A10.07 10.07 0 0112 20c-7 0-11-8-11-8a18.45 18.45 0 015.06-5.94M9.9 4.24A9.12 9.12 0 0112 4c7 0 11 8 11 8a18.5 18.5 0 01-2.16 3.19m-6.72-1.07a3 3 0 11-4.24-4.24M1 1l22 22" />
                    </svg>
                  ) : (
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                      <circle cx="12" cy="12" r="3" />
                    </svg>
                  )}
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
                  {showConfirm ? (
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M17.94 17.94A10.07 10.07 0 0112 20c-7 0-11-8-11-8a18.45 18.45 0 015.06-5.94M9.9 4.24A9.12 9.12 0 0112 4c7 0 11 8 11 8a18.5 18.5 0 01-2.16 3.19m-6.72-1.07a3 3 0 11-4.24-4.24M1 1l22 22" />
                    </svg>
                  ) : (
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                      <circle cx="12" cy="12" r="3" />
                    </svg>
                  )}
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
              disabled={loading}
              className="w-full rounded-2xl bg-indigo-600 py-2.5 font-semibold text-white shadow-sm transition hover:bg-indigo-700 active:scale-[0.98] disabled:opacity-60 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 cursor-pointer"
            >
              {loading ? (
                <span className="flex items-center justify-center gap-2">
                  <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white" />
                  กำลังบันทึก...
                </span>
              ) : (
                "ตั้งรหัสผ่านและเข้าสู่ระบบ"
              )}
            </button>
          </form>
        </div>
      </div>
    </div>
  )
}
