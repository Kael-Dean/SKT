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
      <div className="fixed bottom-5 right-5 z-50 flex flex-col items-end gap-2">
        {/* Chat panel */}
        <div className="w-72 rounded-2xl shadow-2xl overflow-hidden border border-white/20 bg-white dark:bg-gray-900">
          {/* Header */}
          <div className="flex items-center gap-2.5 px-4 py-3 bg-indigo-600">
            <div className="relative">
              <div className="h-8 w-8 rounded-full bg-white/20 flex items-center justify-center text-white text-sm font-bold">AI</div>
              <span className="absolute bottom-0 right-0 h-2.5 w-2.5 rounded-full bg-green-400 border-2 border-indigo-600" />
            </div>
            <div>
              <div className="text-sm font-semibold text-white leading-tight">ผู้ช่วย SKT</div>
              <div className="text-xs text-indigo-200">ออนไลน์อยู่</div>
            </div>
            <button className="ml-auto text-white/60 hover:text-white transition cursor-pointer" aria-label="ปิด">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
          {/* Messages */}
          <div className="flex flex-col gap-3 px-4 py-3 bg-gray-50 dark:bg-gray-800 min-h-[120px]">
            <div className="flex items-end gap-2">
              <div className="h-6 w-6 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-600 text-xs font-bold shrink-0">AI</div>
              <div className="rounded-2xl rounded-bl-sm bg-white dark:bg-gray-700 px-3 py-2 text-xs text-gray-700 dark:text-gray-200 shadow-sm max-w-[200px]">
                สวัสดีครับ มีอะไรให้ช่วยไหมครับ? 😊
              </div>
            </div>
            <div className="flex items-end justify-end gap-2">
              <div className="rounded-2xl rounded-br-sm bg-indigo-600 px-3 py-2 text-xs text-white max-w-[180px]">
                อยากทราบวิธีเข้าสู่ระบบ
              </div>
            </div>
            <div className="flex items-end gap-2">
              <div className="h-6 w-6 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-600 text-xs font-bold shrink-0">AI</div>
              <div className="rounded-2xl rounded-bl-sm bg-white dark:bg-gray-700 px-3 py-2 text-xs text-gray-700 dark:text-gray-200 shadow-sm max-w-[200px]">
                กรอกชื่อผู้ใช้และรหัสผ่านที่ได้รับแล้วกด "เข้าสู่ระบบ" ได้เลยครับ
              </div>
            </div>
          </div>
          {/* Input */}
          <div className="flex items-center gap-2 px-3 py-2.5 bg-white dark:bg-gray-900 border-t border-gray-100 dark:border-gray-700">
            <input
              type="text"
              placeholder="พิมพ์ข้อความ..."
              className="flex-1 text-xs rounded-xl border border-gray-200 dark:border-gray-600 px-3 py-1.5 outline-none bg-gray-50 dark:bg-gray-800 dark:text-white placeholder:text-gray-400 focus:border-indigo-400"
              readOnly
            />
            <button className="h-7 w-7 rounded-xl bg-indigo-600 flex items-center justify-center text-white hover:bg-indigo-700 transition cursor-pointer shrink-0">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <path strokeLinecap="round" strokeLinejoin="round" d="M22 2L11 13M22 2L15 22l-4-9-9-4 19-7z" />
              </svg>
            </button>
          </div>
        </div>
        {/* Bubble button */}
        <button className="h-12 w-12 rounded-full bg-indigo-600 shadow-lg flex items-center justify-center text-white hover:bg-indigo-700 active:scale-95 transition cursor-pointer" aria-label="แชทกับผู้ช่วย">
          <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path strokeLinecap="round" strokeLinejoin="round" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
          </svg>
        </button>
      </div>
      {/* Layer: dark base fallback */}
      <div className="absolute inset-0 bg-gray-900/40" />
      {/* Layer: indigo brand tint */}
      <div className="absolute inset-0 bg-indigo-950/55" />

      <div className="relative z-10 w-full max-w-md">

        {/* Branding */}
        <div className="mb-6 text-center">
          <div className="flex justify-center mb-3">
            <div className="rounded-2xl bg-white p-2 shadow-md">
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
          <h1 className="text-base font-semibold text-white/90 leading-snug">
            สหกรณ์การเกษตรเพื่อการตลาดลูกค้า ธ.ก.ส.
          </h1>
          <p className="text-sm text-white/65">จังหวัดสุรินทร์</p>
        </div>

        {/* Card */}
        <div className="rounded-2xl bg-white/90 dark:bg-gray-900/80 shadow-xl backdrop-blur-md ring-1 ring-white/20 dark:ring-white/10 p-8">
          <h2 className="mb-6 text-xl font-bold text-gray-800 dark:text-gray-100">
            เข้าสู่ระบบ
          </h2>

          {error && (
            <div className="mb-5 flex items-start gap-2 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700 dark:bg-red-900/30 dark:text-red-200">
              <span className="mt-0.5 shrink-0">⚠️</span>
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                ชื่อผู้ใช้
              </label>
              <input
                type="text"
                className="w-full rounded-2xl border border-gray-200 px-4 py-2.5 text-sm shadow-sm outline-none transition placeholder:text-gray-400 focus:border-indigo-400 focus:ring-2 focus:ring-indigo-500/20 dark:border-gray-600 dark:bg-gray-700 dark:text-white dark:placeholder:text-gray-500 dark:focus:border-indigo-500"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                autoComplete="username"
                placeholder="กรอกชื่อผู้ใช้"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                รหัสผ่าน
              </label>
              <div className="relative">
                <input
                  type={showPass ? "text" : "password"}
                  className="w-full rounded-2xl border border-gray-200 px-4 py-2.5 pr-12 text-sm shadow-sm outline-none transition placeholder:text-gray-400 focus:border-indigo-400 focus:ring-2 focus:ring-indigo-500/20 dark:border-gray-600 dark:bg-gray-700 dark:text-white dark:placeholder:text-gray-500 dark:focus:border-indigo-500"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete="current-password"
                  placeholder="กรอกรหัสผ่าน"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPass((v) => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition"
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

            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-2xl bg-indigo-600 py-2.5 font-semibold text-white shadow-sm transition hover:bg-indigo-700 active:scale-[0.98] disabled:opacity-60 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2"
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
          </form>
        </div>
      </div>
    </div>
  );
};

export default Login;
