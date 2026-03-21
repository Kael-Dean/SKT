# SKT Frontend — Claude Code Project Guide

## Project Overview

**Project:** Centralized HR System for SKT Agricultural Cooperative (สหกรณ์การเกษตรเพื่อการตลาดลูกค้า ธ.ก.ส. สุรินทร์)
**Type:** Web Application — Centralized HR & Business Management System
**Frontend Stack:** React 19 + Vite 7 + Tailwind CSS v4 + React Router v7 (HashRouter)
**Backend:** Python FastAPI on Google Cloud Run (managed by backend partner)
**Deploy:** Frontend hosted on Google Cloud Storage Bucket (Static Hosting)
**Repo:** https://github.com/Kael-Dean/SKT

---

## Project Structure

```
src/
├── main.jsx              # Entry point — HashRouter (DO NOT change to BrowserRouter)
├── App.jsx               # All routes + all route guards live here
├── index.css             # Tailwind v4 imports
├── lib/
│   ├── api.js            # Fetch helpers: api(), apiAuth(), apiDownload()
│   └── auth.js           # Token + user management, getRoleId(), canSeeAddCompany()
├── components/
│   ├── AppLayout.jsx     # Main layout (Sidebar + Topbar + Outlet)
│   ├── Sidebar.jsx       # Role-based collapsible menu
│   ├── Topbar.jsx        # Header: logo, dark mode toggle, user profile
│   └── ProtectedRoute.jsx
└── pages/
    ├── organization/
    │   ├── cost/         # 13 files — Business expense tracking
    │   ├── sell/         # 7 files — Revenue/sales planning
    │   └── thonthun/     # Monthly tracking modules
    └── ... (49 pages total)

public/
└── data/thai/
    ├── province.json
    ├── district.json
    └── sub_district.json   # 2.2MB — DO NOT move or delete
```

---

## Authentication & Role System

JWT token stored in `localStorage` — accessed via `getToken()`, `getUser()`, `getRoleId()` from `src/lib/auth.js`.

| Role ID | Name | Key Access |
|---------|------|-----------|
| 1 | ADMIN | Almost all routes except /company-add, /order-correction |
| 2 | MNG | Full access + /company-add if `canSeeAddCompany()` returns true |
| 3 | HR | Only /order and /order-correction |
| 4 | HA | /documents, /share, /search, /customer-search, /order, /order-correction, /spec/create |
| 5 | MKT | All business routes except /documents, /order-correction, /order, /spec/create |

**Route Guards in App.jsx:**
- `RequireUserId17or18` — Only user ID 17 or 18
- `RequireMngAdminHA` — Role 1, 2, or 4
- `RequireNotMarketing` — All roles except Role 5
- `RequireAdminHA` — Role 1 or 4

Always check permissions via `getRoleId()` from `src/lib/auth.js` — never hardcode role checks in components.

---

## API Layer (src/lib/api.js)

```js
api(path, opts)          // Public endpoint (no auth)
apiAuth(path, opts)      // Authenticated — auto-injects Bearer token from localStorage
apiDownload(path, opts)  // Binary file download with token

// Shortcut methods
get(path)   post(path, body)   put(path, body)   del(path)
```

**Base URL Priority:**
`VITE_API_BASE` → `VITE_API_BASE_RUNAPP` → `VITE_API_BASE_CUSTOM` → `/api` (prod) / `localhost:8000` (dev)

**Error Handling:** Always parse FastAPI 422 format `{ detail: [{ msg: "..." }] }` or `{ detail: "string" }` — never rely on generic HTTP status messages alone.

---

## Code Rules

### Must Follow
1. **JSX only** — No TypeScript in this project
2. **Never touch HashRouter** — Static hosting does not support BrowserRouter
3. **React hooks only for state** — `useState`, `useMemo`, `useCallback` — do not add Redux or Context
4. **Always test dark mode** — Every element with background or text color needs a `dark:` prefix
5. **Use number formatters** — `thb()` for currency, `nf()` for plain numbers
6. **Never commit `.env`** — already in .gitignore

### Styling Conventions (Tailwind v4)
```
Dark mode variant: @custom-variant dark (&:where(.dark, .dark *))

Card:    bg-white dark:bg-gray-800 rounded-2xl shadow-sm p-4
Button:  bg-indigo-500 hover:bg-indigo-600 text-white rounded-2xl px-4 py-2 transition-all duration-200
Input:   border rounded-2xl px-3 py-2 focus:ring-2 focus:ring-indigo-500/20 dark:bg-gray-700
Table:   overflow-x-auto wrapper, even:bg-gray-50 dark:even:bg-gray-700/30
Page:    padding p-4 md:p-6
```

### Component Patterns
- **ComboBox** already has keyboard nav (Up/Down/Enter) — reuse it, do not create new dropdowns
- Animation durations: `duration-200` for hover/focus, `duration-300` for layout animations

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
npm run preview  # Preview production build locally
npm run lint     # ESLint check
```

**Deploy:** Upload the entire `/dist` folder to Google Cloud Storage bucket.

---

## Special Warnings

- `public/data/thai/sub_district.json` is 2.2MB and used by every address form — never move or delete it
- Sidebar menu visibility is computed via `useMemo` in `Sidebar.jsx` — when adding a new route, update that file too
- Backend error format is FastAPI-specific — always handle `detail` array, not just HTTP status
- `sub_district.json` is served from `public/` (not imported at build time) — keep it there

---

## Team

- **Frontend:** (you) — React, Tailwind, Vite
- **Backend:** Partner — Python FastAPI on Google Cloud Run
- **Client:** SKT Agricultural Cooperative Organization
