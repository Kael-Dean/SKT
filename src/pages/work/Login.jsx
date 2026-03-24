// src/pages/Login.jsx
import { useState, useEffect } from "react";
import { useNavigate, Navigate } from "react-router-dom";
import { api } from "../../lib/api";
import { saveAuth, getToken, isTokenExpired } from "../../lib/auth";
import sktBg from "../../assets/skt_bg.png";

const asset = (p) => `${import.meta.env.BASE_URL.replace(/\/+$/, "")}${p}`;

const Login = () => {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading]   = useState(false);
  const [error, setError]       = useState("");
  const [showPass, setShowPass] = useState(false);
  const [isDark] = useState(() => {
    const stored = localStorage.getItem("darkMode");
    if (stored !== null) return stored === "true";
    return window.matchMedia?.("(prefers-color-scheme: dark)")?.matches ?? false;
  });
  const navigate = useNavigate();

  useEffect(() => {
    document.documentElement.classList.toggle("dark", isDark);
  }, [isDark]);

  // ถ้ามีโทเคนและยังไม่หมดอายุ เด้งเข้าหน้าหลัก
  const token = getToken();
  if (token && !isTokenExpired()) {
    return <Navigate to="/home" replace />;
  }

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      // ยิงไปยัง FastAPI ผ่านตัวช่วย api() ที่กำหนด base ไว้แล้ว
      const resp = await api("/auth/login_json", {
        method: "POST",
        body: { username, password },
      });
      // resp = { access_token, token_type: "bearer", account_status? }
      const user = saveAuth(resp.access_token);
      if (resp.account_status) {
        localStorage.setItem("account_status", resp.account_status);
      }
      if (resp.account_status === "new") {
        navigate("/change-password", { replace: true });
      } else {
        navigate("/home", { replace: true, state: { user } });
      }
    } catch (err) {
      setError(err?.message || `เข้าสู่ระบบไม่สำเร็จ`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className="relative min-h-screen flex items-center justify-center px-4"
      style={{ backgroundImage: `url(${sktBg})`, backgroundSize: "cover", backgroundPosition: "center" }}
    >
      {/* Chatbot mockup widget — bottom-right */}
      <button className="fixed bottom-6 right-6 z-50 h-16 w-16 rounded-full bg-indigo-600 shadow-xl flex items-center justify-center text-white hover:bg-indigo-700 active:scale-95 transition cursor-pointer" aria-label="แชทกับผู้ช่วย">
        <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path strokeLinecap="round" strokeLinejoin="round" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
        </svg>
      </button>
      {/* Layer: dark base fallback */}
      <div className="absolute inset-0 bg-gray-900/40" />
      {/* Layer: indigo brand tint */}
      <div className="absolute inset-0 bg-indigo-950/55" />

      <div className="animate-fade-up relative z-10 w-full max-w-md">

        {/* Branding */}
        <div className="mb-8 text-center">
          <div className="mb-4 flex justify-center">
            <div className="rounded-2xl bg-white/95 p-2.5 shadow-lg ring-1 ring-white/50">
              <img
                src={asset("/logo/skt-logo.png")}
                onError={(e) => {
                  e.currentTarget.src = asset("/logo/skt-logo-dark.png");
                }}
                alt="โลโก้องค์กร"
                className="h-14 w-auto object-contain"
                loading="eager"
                decoding="async"
              />
            </div>
          </div>
          <h1 className="text-[15px] font-semibold leading-snug text-white/95">
            สหกรณ์การเกษตรเพื่อการตลาดลูกค้า ธ.ก.ส.
          </h1>
          <p className="mt-0.5 text-sm text-white/60">จังหวัดสุรินทร์</p>
        </div>

        {/* Card */}
        <div className="rounded-2xl bg-white/92 shadow-2xl backdrop-blur-xl ring-1 ring-white/30 dark:bg-gray-900/85 dark:ring-white/10 p-8">
          <h2 className="mb-1 text-xl font-bold text-gray-900 dark:text-gray-100">
            เข้าสู่ระบบ
          </h2>
          <p className="mb-6 text-sm text-gray-400 dark:text-gray-500">กรอกข้อมูลเพื่อเข้าใช้งานระบบ</p>

          {error && (
            <div className="animate-fade-in mb-5 flex items-start gap-2.5 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700 ring-1 ring-red-200 dark:bg-red-900/25 dark:text-red-300 dark:ring-red-800/40">
              <svg className="mt-0.5 h-4 w-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
              </svg>
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-300">
                ชื่อผู้ใช้
              </label>
              <input
                type="text"
                className="w-full rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 text-[15px] outline-none transition-all duration-150 placeholder:text-gray-400 focus:border-indigo-400 focus:bg-white focus:ring-2 focus:ring-indigo-500/20 dark:border-gray-600 dark:bg-gray-700/80 dark:text-white dark:placeholder:text-gray-500 dark:focus:border-indigo-500 dark:focus:bg-gray-700"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                autoComplete="username"
                autoFocus
                placeholder="กรอกชื่อผู้ใช้"
                required
              />
            </div>

            <div>
              <label className="mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-300">
                รหัสผ่าน
              </label>
              <div className="relative">
                <input
                  type={showPass ? "text" : "password"}
                  className="w-full rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 pr-12 text-[15px] outline-none transition-all duration-150 placeholder:text-gray-400 focus:border-indigo-400 focus:bg-white focus:ring-2 focus:ring-indigo-500/20 dark:border-gray-600 dark:bg-gray-700/80 dark:text-white dark:placeholder:text-gray-500 dark:focus:border-indigo-500 dark:focus:bg-gray-700"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete="current-password"
                  placeholder="กรอกรหัสผ่าน"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPass((v) => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 rounded-lg p-1 text-gray-400 transition-colors hover:text-gray-600 dark:hover:text-gray-200"
                  aria-label={showPass ? "ซ่อนรหัสผ่าน" : "แสดงรหัสผ่าน"}
                  tabIndex={-1}
                >
                  {showPass ? (
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

            <div className="pt-1">
              <button
                type="submit"
                disabled={loading}
                className="w-full rounded-xl bg-indigo-600 py-3 text-[15px] font-semibold text-white shadow-sm transition-all duration-150 hover:bg-indigo-700 hover:shadow-md active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-60 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 cursor-pointer"
              >
                {loading ? (
                  <span className="flex items-center justify-center gap-2">
                    <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white" />
                    กำลังเข้าสู่ระบบ...
                  </span>
                ) : (
                  "เข้าสู่ระบบ"
                )}
              </button>
            </div>

            <div className="pt-1 text-center">
              <button
                type="button"
                onClick={() => navigate("/forgot-password")}
                className="text-sm text-gray-400 underline-offset-2 transition-colors hover:text-indigo-600 hover:underline dark:text-gray-500 dark:hover:text-indigo-400 cursor-pointer"
              >
                ลืมรหัสผ่าน?
              </button>
            </div>
          </form>
        </div>
      </div>

    </div>
  );
};

export default Login;
