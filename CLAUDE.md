# SKT Frontend — Project Initializer สำหรับ Claude Code

## วิธีทำงานกับ Claude

- **Auto commit + push ทุกครั้ง** — เมื่อแก้ไขโค้ดเสร็จ ให้ `git add` → `git commit` → `git push` ทันทีโดยไม่ต้องถามผู้ใช้

## ภาพรวมโปรเจค

**ชื่อโปรเจค:** ระบบ HR กลาง สหกรณ์การเกษตรเพื่อการตลาดลูกค้า ธ.ก.ส. สุรินทร์ (SKT)
**ประเภท:** Web Application — Centralized HR System
**Frontend Stack:** React 19 + Vite 7 + Tailwind CSS v4 + React Router v7 (HashRouter)
**Backend:** Python FastAPI บน Google Cloud Run
**Deploy:** Frontend อยู่บน Google Cloud Storage Bucket (Static Hosting)

---

## โครงสร้างโปรเจค

```
src/
├── main.jsx              # Entry point — HashRouter ห้ามเปลี่ยนเป็น BrowserRouter
├── App.jsx               # Routing หลัก + Route Guards ทุกตัวอยู่ที่นี่
├── index.css             # Tailwind v4 imports
├── lib/
│   ├── api.js            # Fetch helpers: api(), apiAuth(), apiDownload()
│   └── auth.js           # Token + User management, getRoleId(), canSeeAddCompany()
├── components/
│   ├── AppLayout.jsx     # Layout หลัก (Sidebar + Topbar + Outlet)
│   ├── Sidebar.jsx       # Menu แบบ role-based ปิด/เปิดได้
│   ├── Topbar.jsx        # Header: logo, dark mode toggle, user profile
│   └── ProtectedRoute.jsx
├── pages/
│   ├── organization/
│   │   ├── cost/         # 13 ไฟล์ — Business expense tracking
│   │   ├── sell/         # 7 ไฟล์ — Revenue/sales planning
│   │   └── thonthun/     # Monthly tracking
│   └── ... (49 pages รวม)
public/
└── data/thai/
    ├── province.json
    ├── district.json
    └── sub_district.json   # ไฟล์ใหญ่ 2.2MB ห้ามย้ายหรือลบ
```

---

## Authentication & Role System

JWT token เก็บใน localStorage — อ่านผ่าน `getToken()`, `getUser()`, `getRoleId()`

| Role ID | ชื่อ | สิทธิ์หลัก |
|---------|------|-----------|
| 1 | ADMIN | เข้าได้เกือบทุกหน้า ยกเว้น /company-add, /order-correction |
| 2 | MNG | เต็มสิทธิ์ + /company-add ถ้า canSeeAddCompany() = true |
| 3 | HR | เฉพาะ /order และ /order-correction |
| 4 | HA | /documents, /share, /search, /customer-search, /order, /order-correction, /spec/create |
| 5 | MKT | ทุก business route ยกเว้น /documents, /order-correction, /order, /spec/create |

**Route Guards ใน App.jsx:**
- `RequireUserId17or18` — เฉพาะ user ID 17 หรือ 18
- `RequireMngAdminHA` — Role 1, 2, หรือ 4
- `RequireNotMarketing` — ทุก role ยกเว้น Role 5
- `RequireAdminHA` — Role 1 หรือ 4

---

## API Layer (src/lib/api.js)

```js
api(path, opts)          // Public endpoint (ไม่มี auth)
apiAuth(path, opts)      // Bearer token (ดึง token อัตโนมัติจาก localStorage)
apiDownload(path, opts)  // Binary download พร้อม token

// Shortcut methods
get(path)   post(path, body)   put(path, body)   del(path)
```

**Base URL Priority:**
`VITE_API_BASE` → `VITE_API_BASE_RUNAPP` → `VITE_API_BASE_CUSTOM` → `/api` (prod) / `localhost:8000` (dev)

**Error Handling:** parse FastAPI 422 format `{ detail: [{ msg: "..." }] }` หรือ `{ detail: "string" }`

---

## กฎการเขียนโค้ด

### Must Follow
1. **ใช้ JSX เสมอ** — ห้ามใช้ TypeScript ในโปรเจคนี้
2. **HashRouter ห้ามแตะ** — Static hosting ไม่รองรับ BrowserRouter
3. **State management = React hooks เท่านั้น** — `useState`, `useMemo`, `useCallback` ห้ามเพิ่ม Redux/Context
4. **Dark mode ต้องทดสอบเสมอ** — ใช้ `dark:` prefix ทุก element ที่มีสีพื้นหลังหรือสีข้อความ
5. **ตัวเลขการเงิน** ใช้ `thb()` สกุลเงิน, `nf()` ตัวเลขธรรมดา
6. **ห้าม commit `.env`** — อยู่ใน .gitignore แล้ว

### Styling Conventions (Tailwind v4)
```
Dark mode variant: @custom-variant dark (&:where(.dark, .dark *))
Card:    bg-white dark:bg-gray-800 rounded-2xl shadow-sm p-4
Button:  bg-indigo-500 hover:bg-indigo-600 text-white rounded-2xl px-4 py-2 transition-all duration-200
Input:   border rounded-2xl px-3 py-2 focus:ring-2 focus:ring-indigo-500/20 dark:bg-gray-700
Table:   overflow-x-auto wrapper, even:bg-gray-50 dark:even:bg-gray-700/30
```

### Component Pattern
- ComboBox มี keyboard nav (Up/Down/Enter) — อย่าสร้าง dropdown ใหม่ ให้ reuse ตัวเดิม
- Page padding: `p-4 md:p-6`
- Animation duration: `duration-200` (hover/focus), `duration-300` (layout animations)

---

## Environment Variables

```
VITE_API_BASE=https://um-repo-243977022740.asia-southeast1.run.app
VITE_API_BASE_CUSTOM=https://api.amcsurin.com
```

---

## Build & Deploy

```bash
npm run dev      # Vite dev server (HMR)
npm run build    # Production build → /dist
npm run preview  # Preview build locally
npm run lint     # ESLint check
```

**Deploy:** อัปโหลดโฟลเดอร์ `/dist` ทั้งหมดขึ้น Google Cloud Storage bucket

---

## ข้อควรระวังพิเศษ

- `public/data/thai/sub_district.json` ขนาด 2.2MB — ห้ามย้าย ห้ามลบ ไฟล์นี้ถูกใช้ใน form ทุกหน้าที่มีที่อยู่
- Sidebar menu visibility คำนวณผ่าน `useMemo` ในไฟล์ `Sidebar.jsx` — ถ้าเพิ่ม route ใหม่ต้องอัปเดตที่นั่นด้วย
- Backend error format มาจาก FastAPI — อย่า parse แบบ generic string อย่างเดียว
- การ check สิทธิ์ใช้ `getRoleId()` จาก `src/lib/auth.js` เท่านั้น — ห้าม hardcode role ใน component

---

## ทีม

- **Frontend:** (คุณ) — React, Tailwind, Vite
- **Backend:** เพื่อน — Python FastAPI บน Google Cloud Run
- **Client:** องค์กรสหกรณ์การเกษตร SKT
