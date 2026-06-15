# SECURITY NOTES — SKT Frontend

ไฟล์นี้บันทึกประเด็นความปลอดภัยที่ **frontend แก้เองไม่ได้** (ต้องอาศัย backend
หรือ host/CDN config) ไว้ส่งต่อให้ทีม backend / DevOps. งานฝั่ง frontend ที่ทำได้
ถูกแก้ไปแล้วใน Phase 2 (ดูท้ายไฟล์).

> สรุปหลักการ: **guard และ role check ฝั่ง frontend เป็นแค่ UX** — ปลอมแปลงได้ทั้งหมด
> โดยแก้ค่าใน localStorage หรือ JWT payload (decode ฝั่ง client ไม่ verify signature).
> การบังคับสิทธิ์จริง **ต้อง** อยู่ที่ backend ทุกครั้ง.

---

## 🔴 ต้องแก้ที่ Backend

### 1. JWT เก็บใน localStorage → เสี่ยง XSS token theft
- **ตอนนี้:** token เก็บใน `localStorage` (`src/lib/auth.js`). ถ้ามีช่องโหว่ XSS ที่ใดก็ตาม
  JavaScript ของผู้โจมตีอ่าน token ได้ทันที = account takeover.
- **แก้จริง:** backend ออก token เป็น **HttpOnly + Secure + SameSite=Strict cookie**
  แทนการส่ง token กลับมาให้ JS เก็บ. frontend จะเลิกใช้ localStorage แล้วพึ่ง cookie
  ที่ browser แนบให้อัตโนมัติ (ต้องตั้ง CORS `credentials: 'include'` + `Access-Control-Allow-Credentials`).
- **ผลกระทบ frontend:** ต้องแก้ `api.js`/`auth.js` ตามเมื่อ backend พร้อม.

### 2. Authorization ต้องบังคับที่ backend (ไม่ใช่ route guard)
- **ตอนนี้:** route guards ใน `src/App.jsx` (RequireAdmin, RequireMngAdminHA, ฯลฯ)
  อ่าน role จาก localStorage/JWT ฝั่ง client = bypass ได้.
- **แก้จริง:** ทุก API endpoint ต้อง verify JWT signature + เช็ค role/permission ของ
  request ก่อนคืนข้อมูลหรือทำ mutation. อย่าเชื่อ role ที่ frontend ส่งมา.

### 3. JWT ไม่ถูก verify signature ฝั่ง client (โดยตั้งใจ)
- `decodeJwt()` ใน `auth.js` แค่ base64-decode payload — **ไม่ verify signature** (เป็นไปไม่ได้
  ฝั่ง client โดยไม่เปิดเผย secret). ดังนั้น claim ที่ decode ได้ใช้เพื่อ UX เท่านั้น.
- **แก้จริง:** backend verify signature + expiry ทุก request (ข้อ 2).

### 4. Reset password token อยู่ใน URL
- **ตอนนี้:** reset token ส่งผ่าน query/hash (`src/main.jsx`, `ForgotPassword.jsx`,
  `ResetPassword.jsx`) — โผล่ใน browser history / referrer / log.
- **แก้จริง:** ใช้ token แบบ one-time, อายุสั้น (< 15 นาที), ผูกกับ session ฝั่ง server,
  และ invalidate ทันทีหลังใช้. ฝั่ง frontend ลด exposure ได้บางส่วนแต่ root cause อยู่ที่ flow.

---

## 🟠 ต้องตั้งที่ Host / CDN (Google Cloud Storage / Load Balancer)

Header เหล่านี้ **ตั้งผ่าน `<meta>` ไม่ได้** — ต้องตั้งที่ HTTP response header ของ bucket/CDN:

| Header | ค่าที่แนะนำ |
|--------|------------|
| `Strict-Transport-Security` | `max-age=31536000; includeSubDomains; preload` |
| `X-Content-Type-Options` | `nosniff` |
| `X-Frame-Options` | `DENY` (กัน clickjacking; `frame-ancestors` ใน meta ถูก ignore) |
| `Referrer-Policy` | `strict-origin-when-cross-origin` |
| `Content-Security-Policy` | ย้าย CSP จาก `<meta>` ใน `index.html` มาเป็น header จริง แล้ว tune ให้แคบลง (เช่น `script-src 'self'` ไม่มี `https:` ใน img-src) — ดูค่า baseline ใน `index.html` |

> GCS static hosting ตั้ง custom header ตรง ๆ ไม่ได้ — ต้องวาง **Cloud Load Balancer +
> Cloud CDN** หรือ response header policy หน้า bucket.

---

## ✅ แก้ไปแล้วฝั่ง Frontend (Phase 2)

- **CSP baseline** เพิ่ม `<meta http-equiv="Content-Security-Policy">` ใน `index.html`
  (`object-src 'none'`, `base-uri 'self'`, `form-action 'self'`, scope script/style/img/connect
  ตาม origin ที่ใช้จริง). **ต้อง smoke-test ใน DevTools console ว่าไม่มี CSP violation ก่อน deploy.**
- **logout เคลียร์ครบ** — `logout()` ล้าง auth/PII keys ทุกตัว (`token/access_token/jwt/role/
  user/userdata/profile/account`) ไม่เหลือค้าง.
- **เช็ค token หมดอายุก่อนยิง API** — `apiAuth()` เด้ง login ทันทีถ้า `exp` ผ่านแล้ว
  (guard บน exp จริง กัน false logout).
- **`innerHTML` → safe DOM** ใน print preview popup.
- **`window.open(..., "noopener,noreferrer")` + `win.opener = null`** ทุกจุดที่เปิดหน้าต่างใหม่.
- **debounce/lockout ปุ่ม submit** หน้า Login / ForgotPassword / ResetPassword กัน brute force ฝั่ง client.

---
_อัปเดต: Phase 2 security hardening — โดยทีม frontend. backend items ยังรอดำเนินการ._
