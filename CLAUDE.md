# SKT Frontend — Project Initializer สำหรับ Claude Code

## วิธีทำงานกับ Claude

- **Auto commit + push ทุกครั้ง** — เมื่อแก้ไขโค้ดเสร็จ ให้ `git add` → `git commit` → `git push` ทันทีโดยไม่ต้องถามผู้ใช้
- **Frontend เท่านั้น** — ห้ามแตะไฟล์ backend ทุกกรณี แก้ได้เฉพาะไฟล์ใน `src/` และ `public/` เท่านั้น ถ้า task ต้องการเปลี่ยน backend ให้แจ้งผู้ใช้แทน
- **ใช้ frontend-design skill เสมอ** — ทุกครั้งที่มี task แก้ไข/สร้าง UI หรือ component ฝั่ง frontend ให้เรียกใช้ `frontend-design` skill ก่อนลงมือทำเสมอ (ผ่าน Skill tool)

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
│   ├── auth.js           # Token + User management, getRoleId() (ตัวอ่าน role ตัวเดียว)
│   ├── roles.js          # ROLE ids + ชื่อไทย roleLabel()
│   └── permissions.js    # PERMISSIONS registry + can()/useCan() + กฎเฉพาะผู้ใช้
├── components/
│   ├── AppLayout.jsx     # Layout หลัก (Sidebar + Topbar + Outlet)
│   ├── Sidebar.jsx       # Menu ตาม permission key ปิด/เปิดได้
│   ├── RequirePermission.jsx # Route guard ตาม permission key
│   ├── Can.jsx           # แสดง UI ตาม permission key
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

JWT token เก็บใน localStorage — อ่านผ่าน `getToken()`, `getUser()`, `getRoleId()` (`src/lib/auth.js`)
`getRoleId()` เป็นตัวอ่าน role **ตัวเดียว** ของทั้งแอป (รองรับ claim/ชื่อ role รุ่นเก่าไว้ข้างในแล้ว)

### Role ids (ตาม JWT claim `role` ของ backend — `require_role(...)` ใน FastAPI)

| Role ID | ชื่อ | ค่าคงที่ (`src/lib/roles.js`) |
|---------|------|------------------------------|
| 1 | ผู้ดูแลระบบ (Admin) | `ROLE.ADMIN` |
| 2 | ผู้จัดการ | `ROLE.MANAGER` |
| 3 | ฝ่ายบุคคล (HR) | `ROLE.HR` |
| 4 | หัวหน้าฝ่ายบัญชี/การเงิน | `ROLE.HEAD_ACCOUNTANT` |
| 5 | พนักงาน | `ROLE.STAFF` |
| 6 | หัวหน้าสาขา/ฝ่าย (server จำกัดให้เห็นเฉพาะสาขาบ้าน + สาขาที่ได้รับมอบหมาย) | `ROLE.BRANCH_HEAD` |
| 7 | ผู้ช่วยผู้จัดการ | `ROLE.ASSISTANT_MANAGER` |

ชื่อ/สี badge ของ role: `roleLabel(id)`, `roleShortLabel(id)`, `roleBadgeTone(id)`, `ASSIGNABLE_ROLE_OPTIONS` จาก `src/lib/roles.js`

### Permission registry (`src/lib/permissions.js`)

- `PERMISSIONS` = คีย์แบบ dotted (เช่น `hr.employees.list`, `hr.leave.approve.branchHead`, `trading.buy.create`) →
  `{ no, module, label, en, roles }` — `no` = เลขฟังก์ชันใน `AMC_Role_Permission_Matrix.xlsx` (sheet "Dev reference")
- `roles` = `[ids]` | `"any"` (ทุกคนที่ล็อกอิน) | `"public"` — **ตอนนี้ยึด guard ปัจจุบันของ backend เป็นความจริง**
  หน้าเว็บต้องไม่ให้สิทธิ์เกิน backend. เมื่อลูกค้าส่ง matrix ที่กรอกแล้ว แก้แค่ `roles` ในไฟล์นี้ไฟล์เดียว
- ดูตารางทั้งหมดได้ที่หน้า **"สิทธิ์ตามบทบาท"** `/admin/roles` (Admin เท่านั้น, read-only)
- Helpers: `can(key)`, `canAny([keys])`, `canAll([keys])`, `useCan()` — คีย์ที่ไม่รู้จัก = `false` (+ `console.warn` ตอน dev)
- กฎเฉพาะ "ผู้ใช้" (ไม่ใช่ role) ที่คงไว้โดยเจตนา: `canBringInMill()` (user id 17/18), `canSeeAddCompany()` (role 2 + ผู้ใช้ "HA" role 4)

### ใช้งาน

```jsx
// Route guard (App.jsx) — ไม่มีสิทธิ์ → toast แจ้ง + พากลับ /home
<Route path="/hr/dashboard" element={<RequirePermission perm="hr.dashboard.view"><HRDashboard /></RequirePermission>} />
<RequirePermission anyOf={["hr.leave.list", "hr.ooo.list"]}>…</RequirePermission>

// ซ่อน/แสดงปุ่มหรือส่วนของหน้า
<Can perm="hr.payroll.generate"><button>…</button></Can>
const { can } = useCan(); if (can("hr.relocation.approve.manager")) …
```

### เพิ่ม permission ใหม่

1. เพิ่ม entry ใน `PERMISSIONS` (`src/lib/permissions.js`) — ใส่ `no` ตาม matrix และ `roles` ตาม guard ของ backend
   (ถ้าเป็นกฎแสดงผลของหน้าเว็บล้วน ใส่ `no: null, feOnly: true`)
2. ใช้คีย์นั้นใน route (`RequirePermission`), เมนู (`Sidebar.jsx` → `perm`), การ์ดหน้า Home (`perm`/`anyOf`) และปุ่ม (`Can`/`can`)
3. ตรวจที่ `/admin/roles` ว่าแสดงถูก

**ห้าม hardcode เลข role ใน component** (`roleId === 1`, `[1, 3].includes(role)` ฯลฯ) — เลข role มีได้เฉพาะใน
`src/lib/roles.js` และ `src/lib/permissions.js` เท่านั้น

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
- **Popup / Modal ต้อง render ผ่าน `<Portal>` เสมอ** (`src/components/Portal.jsx`) — ทำแบบ popup หน้า "กล่องงานรออนุมัติ" (Inbox). ห้าม render overlay `fixed inset-0` ไว้กลาง component tree ตรง ๆ เพราะถ้ามี ancestor ที่มี `transform`/`filter`/`backdrop-filter` `position: fixed` จะอิงกล่องนั้นแทน viewport → modal ไม่อยู่กลางจอ. Portal render เข้าที่ `document.body` + lock body scroll ให้อัตโนมัติ
- **Dropdown / popup panel ห้ามมีอะไรมาทับตอนเปิดเลือก** — panel ต้อง portal เข้า `document.body` + `position: fixed` วาง coord จาก trigger rect (ไม่ใช่ `absolute z-30` กลาง tree) และ z-index ต้องสูงกว่า `StickyTableScrollbar` (z-index 10000). ดู `src/components/SelectDropdown.jsx` (ใช้ `PANEL_Z = 10050`, reposition ตอน scroll/resize, outside-click เช็คทั้ง trigger + panel ref). เคยมี sticky table scrollbar ลอยทับ dropdown จนกดเลือกไม่ได้ — อย่าให้เกิดอีก

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
- การ check สิทธิ์ใช้ `can()` / `<Can>` / `<RequirePermission>` จาก permission registry เท่านั้น — ห้าม hardcode เลข role ใน component

### ฟังก์ชันซ้อน (nested / hub) + ปุ่มย้อนกลับ

เมื่อจับหลายฟังก์ชันมารวมเป็น "hub" หน้าเดียว (เช่น `/debt-hub` รวม `ติดตามผลหนี้` + `ตารางหนี้`):

- หน้า hub เป็นหน้า landing แสดงการ์ดของฟังก์ชันย่อย แต่ละการ์ด `navigate()` ไปหน้าจริง (gate ด้วย `can("<permission key>")` ถ้าจำเป็น)
- ปุ่มย้อนกลับเป็น **global** อยู่ใน `src/components/AppLayout.jsx` — โดยปกติเด้งกลับ `/home` (หรือ `/hr/dashboard` สำหรับหน้า HR)
- ถ้าหน้าใด "ซ้อน" อยู่ใต้ hub ต้องเพิ่ม entry ใน `PARENT_ROUTES` ที่หัวไฟล์ `AppLayout.jsx` เพื่อให้ปุ่มย้อนกลับพากลับไปหน้า parent แทนหน้าหลัก:

```js
const PARENT_ROUTES = {
  "/debt-tracking": { path: "/debt-hub", label: "ติดตามหนี้" },
  "/debt-form":     { path: "/debt-hub", label: "ติดตามหนี้" },
}
```

  ป้ายปุ่ม (`label`) จะแสดงชื่อหน้า parent ให้ผู้ใช้รู้ว่ากำลังจะกลับไปไหน

---

## ทีม

- **Frontend:** (คุณ) — React, Tailwind, Vite
- **Backend:** เพื่อน — Python FastAPI บน Google Cloud Run
- **Client:** องค์กรสหกรณ์การเกษตร SKT
