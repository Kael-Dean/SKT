// src/pages/Login.jsx
import { useState } from "react";
import { useNavigate, Navigate } from "react-router-dom";
import { api } from "../lib/api";
import { saveAuth, getToken, isTokenExpired } from "../lib/auth";

const Login = () => {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading]   = useState(false);
  const [error, setError]       = useState("");
  const navigate = useNavigate();

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
      // resp = { access_token, token_type: "bearer" }
      const user = saveAuth(resp.access_token);
      navigate("/home", { replace: true, state: { user } });
    } catch (err) {
      setError(err?.message || `เข้าสู่ระบบไม่สำเร็จ`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-100 dark:bg-gray-900 px-4">
      <div className="w-full max-w-md rounded-2xl bg-white p-8 shadow-md dark:bg-gray-800">
        <h2 className="mb-6 text-center text-2xl font-bold text-gray-800 dark:text-gray-100">
          เข้าสู่ระบบ
        </h2>

        {error ? (
          <div className="mb-4 rounded-lg bg-red-50 px-4 py-2 text-sm text-red-700 dark:bg-red-900/30 dark:text-red-200">
            {error}
          </div>
        ) : null}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
              ชื่อผู้ใช้
            </label>
            <input
              type="text"
              className="mt-1 w-full rounded-md border px-4 py-2 dark:border-gray-600 dark:bg-gray-700 dark:text-white"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              autoComplete="username"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
              รหัสผ่าน
            </label>
            <input
              type="password"
              className="mt-1 w-full rounded-md border px-4 py-2 dark:border-gray-600 dark:bg-gray-700 dark:text-white"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
              required
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-md bg-emerald-600 py-2 font-medium text-white transition hover:bg-emerald-700 disabled:opacity-60"
          >
            {loading ? "กำลังเข้าสู่ระบบ..." : "เข้าสู่ระบบ"}
          </button>
        </form>
      </div>
    </div>
  );
};

export default Login;
