// src/pages/Login.jsx
import { useState, useEffect, useRef } from "react";
import { useNavigate, Navigate } from "react-router-dom";
import { api } from "../../lib/api";
import { saveAuth, getToken, isTokenExpired } from "../../lib/auth";
import sktBg from "../../assets/skt_bg.png";

const asset = (p) => `${import.meta.env.BASE_URL.replace(/\/+$/, "")}${p}`;

/* ─────────────────────────────────────────────
   ForgotPasswordModal — 3-step flow (mock)
   Step 1: กรอก username → ส่ง OTP ไป LINE
   Step 2: กรอก OTP 6 หลัก
   Step 3: กรอกรหัสผ่านใหม่ + ยืนยัน
───────────────────────────────────────────── */
const MOCK_OTP = "123456"; // OTP ปลอมสำหรับ mock

const ForgotPasswordModal = ({ onClose }) => {
  const [step, setStep] = useState(1); // 1 | 2 | 3 | "success"
  const [fpUsername, setFpUsername] = useState("");
  const [otp, setOtp] = useState(["", "", "", "", "", ""]);
  const [newPass, setNewPass] = useState("");
  const [confirmPass, setConfirmPass] = useState("");
  const [showNewPass, setShowNewPass] = useState(false);
  const [showConfirmPass, setShowConfirmPass] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const otpRefs = useRef([]);

  // ปิด modal เมื่อกด Escape
  useEffect(() => {
    const handler = (e) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onClose]);

  /* Step 1: ส่ง OTP */
  const handleSendOtp = async (e) => {
    e.preventDefault();
    if (!fpUsername.trim()) return;
    setError("");
    setLoading(true);
    try {
      // TODO: เรียก API จริง → api("/auth/forgot-password", { method: "POST", body: { username: fpUsername } })
      await new Promise((r) => setTimeout(r, 1000)); // mock delay
      // mock: สำเร็จเสมอ (production ต้องเช็คว่า user มีอยู่ใน DB + มี LINE)
      setStep(2);
    } catch {
      setError("ไม่พบชื่อผู้ใช้นี้ในระบบ หรือผู้ใช้ยังไม่ได้ผูก LINE");
    } finally {
      setLoading(false);
    }
  };

  /* OTP input — auto-advance & backspace */
  const handleOtpChange = (idx, val) => {
    if (!/^\d*$/.test(val)) return;
    const next = [...otp];
    next[idx] = val.slice(-1);
    setOtp(next);
    if (val && idx < 5) otpRefs.current[idx + 1]?.focus();
  };
  const handleOtpKeyDown = (idx, e) => {
    if (e.key === "Backspace" && !otp[idx] && idx > 0) {
      otpRefs.current[idx - 1]?.focus();
    }
  };

  /* Step 2: ยืนยัน OTP */
  const handleVerifyOtp = async (e) => {
    e.preventDefault();
    const entered = otp.join("");
    if (entered.length < 6) { setError("กรุณากรอก OTP ให้ครบ 6 หลัก"); return; }
    setError("");
    setLoading(true);
    try {
      // TODO: เรียก API จริง → api("/auth/verify-otp", { method: "POST", body: { username: fpUsername, otp: entered } })
      await new Promise((r) => setTimeout(r, 800));
      if (entered !== MOCK_OTP) throw new Error("OTP ไม่ถูกต้อง");
      setStep(3);
    } catch (err) {
      setError(err?.message || "OTP ไม่ถูกต้องหรือหมดอายุแล้ว");
    } finally {
      setLoading(false);
    }
  };

  /* Step 3: เปลี่ยนรหัสผ่าน */
  const handleChangePassword = async (e) => {
    e.preventDefault();
    if (newPass.length < 8) { setError("รหัสผ่านต้องมีอย่างน้อย 8 ตัวอักษร"); return; }
    if (newPass !== confirmPass) { setError("รหัสผ่านใหม่และการยืนยันไม่ตรงกัน"); return; }
    setError("");
    setLoading(true);
    try {
      // TODO: เรียก API จริง → api("/auth/reset-password", { method: "POST", body: { username: fpUsername, otp: otp.join(""), new_password: newPass } })
      await new Promise((r) => setTimeout(r, 1000));
      setStep("success");
    } catch (err) {
      setError(err?.message || "เปลี่ยนรหัสผ่านไม่สำเร็จ");
    } finally {
      setLoading(false);
    }
  };

  const stepLabel = { 1: "กรอกชื่อผู้ใช้", 2: "ยืนยัน OTP", 3: "ตั้งรหัสผ่านใหม่", success: "สำเร็จ" };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center px-4" onClick={onClose}>
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
      <div
        className="relative z-10 w-full max-w-sm rounded-2xl bg-white dark:bg-gray-900 shadow-2xl ring-1 ring-gray-200 dark:ring-gray-700 p-7"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between mb-5">
          <div>
            <h3 className="text-lg font-bold text-gray-800 dark:text-gray-100">ลืมรหัสผ่าน</h3>
            {step !== "success" && (
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                ขั้นตอนที่ {step}/3 — {stepLabel[step]}
              </p>
            )}
          </div>
          <button
            onClick={onClose}
            className="h-8 w-8 flex items-center justify-center rounded-xl text-gray-400 hover:text-gray-600 hover:bg-gray-100 dark:hover:text-gray-200 dark:hover:bg-gray-700 transition cursor-pointer"
            aria-label="ปิด"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Step indicator */}
        {step !== "success" && (
          <div className="flex gap-1.5 mb-6">
            {[1, 2, 3].map((s) => (
              <div
                key={s}
                className={`h-1.5 flex-1 rounded-full transition-all duration-300 ${
                  s <= step ? "bg-indigo-500" : "bg-gray-200 dark:bg-gray-700"
                }`}
              />
            ))}
          </div>
        )}

        {/* Error */}
        {error && (
          <div className="mb-4 flex items-start gap-2 rounded-xl bg-red-50 dark:bg-red-900/30 px-3 py-2.5 text-sm text-red-700 dark:text-red-300">
            <span className="mt-0.5 shrink-0">⚠️</span>
            <span>{error}</span>
          </div>
        )}

        {/* ── Step 1: Username ── */}
        {step === 1 && (
          <form onSubmit={handleSendOtp} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                ชื่อผู้ใช้ (Username)
              </label>
              <input
                type="text"
                autoFocus
                className="w-full rounded-2xl border border-gray-200 dark:border-gray-600 px-4 py-2.5 text-sm outline-none transition placeholder:text-gray-400 dark:placeholder:text-gray-500 focus:border-indigo-400 focus:ring-2 focus:ring-indigo-500/20 dark:bg-gray-700 dark:text-white"
                value={fpUsername}
                onChange={(e) => setFpUsername(e.target.value)}
                placeholder="กรอกชื่อผู้ใช้ของคุณ"
                required
              />
              <p className="mt-1.5 text-xs text-gray-500 dark:text-gray-400">
                ระบบจะส่งรหัส OTP ไปยัง LINE ที่ผูกกับบัญชีนี้
              </p>
            </div>
            <button
              type="submit"
              disabled={loading || !fpUsername.trim()}
              className="w-full rounded-2xl bg-indigo-600 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-indigo-700 active:scale-[0.98] disabled:opacity-60 disabled:cursor-not-allowed cursor-pointer"
            >
              {loading ? (
                <span className="flex items-center justify-center gap-2">
                  <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white" />
                  กำลังส่ง OTP...
                </span>
              ) : "ส่ง OTP ไปยัง LINE"}
            </button>
          </form>
        )}

        {/* ── Step 2: OTP ── */}
        {step === 2 && (
          <form onSubmit={handleVerifyOtp} className="space-y-5">
            <div>
              <p className="text-sm text-gray-600 dark:text-gray-300 mb-4 leading-relaxed">
                ระบบส่งรหัส OTP 6 หลักไปยัง LINE ที่ผูกกับบัญชี{" "}
                <span className="font-semibold text-indigo-600 dark:text-indigo-400">{fpUsername}</span>{" "}
                แล้ว กรุณาตรวจสอบ LINE ของคุณ
              </p>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
                รหัส OTP
              </label>
              <div className="flex gap-2 justify-between">
                {otp.map((digit, idx) => (
                  <input
                    key={idx}
                    ref={(el) => (otpRefs.current[idx] = el)}
                    type="text"
                    inputMode="numeric"
                    maxLength={1}
                    value={digit}
                    onChange={(e) => handleOtpChange(idx, e.target.value)}
                    onKeyDown={(e) => handleOtpKeyDown(idx, e)}
                    autoFocus={idx === 0}
                    className="h-12 w-12 rounded-2xl border border-gray-200 dark:border-gray-600 text-center text-lg font-bold outline-none transition focus:border-indigo-400 focus:ring-2 focus:ring-indigo-500/20 dark:bg-gray-700 dark:text-white"
                  />
                ))}
              </div>
              <p className="mt-3 text-xs text-gray-400 dark:text-gray-500">
                (Mock: OTP คือ <span className="font-mono font-semibold text-indigo-500">{MOCK_OTP}</span>)
              </p>
            </div>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => { setStep(1); setOtp(["","","","","",""]); setError(""); }}
                className="flex-1 rounded-2xl border border-gray-200 dark:border-gray-600 py-2.5 text-sm font-medium text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition cursor-pointer"
              >
                ย้อนกลับ
              </button>
              <button
                type="submit"
                disabled={loading || otp.join("").length < 6}
                className="flex-[2] rounded-2xl bg-indigo-600 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-indigo-700 active:scale-[0.98] disabled:opacity-60 disabled:cursor-not-allowed cursor-pointer"
              >
                {loading ? (
                  <span className="flex items-center justify-center gap-2">
                    <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white" />
                    กำลังยืนยัน...
                  </span>
                ) : "ยืนยัน OTP"}
              </button>
            </div>
          </form>
        )}

        {/* ── Step 3: New Password ── */}
        {step === 3 && (
          <form onSubmit={handleChangePassword} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                รหัสผ่านใหม่
              </label>
              <div className="relative">
                <input
                  type={showNewPass ? "text" : "password"}
                  autoFocus
                  className="w-full rounded-2xl border border-gray-200 dark:border-gray-600 px-4 py-2.5 pr-11 text-sm outline-none transition placeholder:text-gray-400 dark:placeholder:text-gray-500 focus:border-indigo-400 focus:ring-2 focus:ring-indigo-500/20 dark:bg-gray-700 dark:text-white"
                  value={newPass}
                  onChange={(e) => setNewPass(e.target.value)}
                  placeholder="อย่างน้อย 8 ตัวอักษร"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowNewPass((v) => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition cursor-pointer"
                  tabIndex={-1}
                >
                  {showNewPass ? (
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M17.94 17.94A10.07 10.07 0 0112 20c-7 0-11-8-11-8a18.45 18.45 0 015.06-5.94M9.9 4.24A9.12 9.12 0 0112 4c7 0 11 8 11 8a18.5 18.5 0 01-2.16 3.19m-6.72-1.07a3 3 0 11-4.24-4.24M1 1l22 22" /></svg>
                  ) : (
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" /><circle cx="12" cy="12" r="3" /></svg>
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
                  type={showConfirmPass ? "text" : "password"}
                  className="w-full rounded-2xl border border-gray-200 dark:border-gray-600 px-4 py-2.5 pr-11 text-sm outline-none transition placeholder:text-gray-400 dark:placeholder:text-gray-500 focus:border-indigo-400 focus:ring-2 focus:ring-indigo-500/20 dark:bg-gray-700 dark:text-white"
                  value={confirmPass}
                  onChange={(e) => setConfirmPass(e.target.value)}
                  placeholder="กรอกรหัสผ่านอีกครั้ง"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPass((v) => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition cursor-pointer"
                  tabIndex={-1}
                >
                  {showConfirmPass ? (
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M17.94 17.94A10.07 10.07 0 0112 20c-7 0-11-8-11-8a18.45 18.45 0 015.06-5.94M9.9 4.24A9.12 9.12 0 0112 4c7 0 11 8 11 8a18.5 18.5 0 01-2.16 3.19m-6.72-1.07a3 3 0 11-4.24-4.24M1 1l22 22" /></svg>
                  ) : (
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" /><circle cx="12" cy="12" r="3" /></svg>
                  )}
                </button>
              </div>
            </div>
            <button
              type="submit"
              disabled={loading || !newPass || !confirmPass}
              className="w-full rounded-2xl bg-indigo-600 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-indigo-700 active:scale-[0.98] disabled:opacity-60 disabled:cursor-not-allowed cursor-pointer"
            >
              {loading ? (
                <span className="flex items-center justify-center gap-2">
                  <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white" />
                  กำลังบันทึก...
                </span>
              ) : "เปลี่ยนรหัสผ่าน"}
            </button>
          </form>
        )}

        {/* ── Success ── */}
        {step === "success" && (
          <div className="text-center py-2">
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-green-100 dark:bg-green-900/40">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 text-green-600 dark:text-green-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <h4 className="text-base font-bold text-gray-800 dark:text-gray-100 mb-1">เปลี่ยนรหัสผ่านสำเร็จ</h4>
            <p className="text-sm text-gray-500 dark:text-gray-400 mb-5">
              คุณสามารถเข้าสู่ระบบด้วยรหัสผ่านใหม่ได้เลย
            </p>
            <button
              onClick={onClose}
              className="w-full rounded-2xl bg-indigo-600 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-indigo-700 active:scale-[0.98] cursor-pointer"
            >
              กลับสู่หน้าเข้าสู่ระบบ
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

const Login = () => {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading]   = useState(false);
  const [error, setError]       = useState("");
  const [showPass, setShowPass] = useState(false);
  const [showForgot, setShowForgot] = useState(false);
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
              className="w-full rounded-2xl bg-indigo-600 py-2.5 font-semibold text-white shadow-sm transition hover:bg-indigo-700 active:scale-[0.98] disabled:opacity-60 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 cursor-pointer"
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

            <div className="text-center pt-1">
              <button
                type="button"
                onClick={() => setShowForgot(true)}
                className="text-sm text-indigo-500 hover:text-indigo-700 dark:text-indigo-400 dark:hover:text-indigo-300 transition underline-offset-2 hover:underline cursor-pointer"
              >
                ลืมรหัสผ่าน?
              </button>
            </div>
          </form>
        </div>
      </div>

      {showForgot && <ForgotPasswordModal onClose={() => setShowForgot(false)} />}
    </div>
  );
};

export default Login;
