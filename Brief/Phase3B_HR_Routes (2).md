# Phase 3B — HR Personnel Routes
### Frontend Integration Guide

---

## Overview

Phase 3B adds HR personnel management to the system. The new routes live under the `/hr` prefix. All routes require a valid JWT Bearer token in the `Authorization` header.

**Base URL:** `http://localhost:8080` (dev) / Cloud Run URL (prod)

**Swagger:** `http://localhost:8080/docs`

---

## Authentication Reminder

All routes require:

```
Authorization: Bearer <access_token>
```

Get a token via `POST /auth/login_json`. The response now includes `account_status`:
```json
{ "access_token": "eyJ...", "token_type": "bearer", "account_status": "new" }
```
If `account_status == "new"`, redirect the user to the change-password page immediately.

---

## Routes Summary

### Auth Routes
| Method | Endpoint | Auth | Role | Description |
|--------|----------|------|------|-------------|
| `POST` | `/auth/login_json` | — | — | Login, returns token + account_status |
| `POST` | `/auth/change-password` | Yes | Any | Change password; "new" → "registered" |

### HR Routes (role 1 or 3 only)
| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/hr/dashboard` | Overview counts and salary total |
| `POST` | `/hr/signup` | Register new personnel |
| `GET` | `/hr/positions` | Position dropdown data |
| `GET` | `/hr/leave-types` | Leave type dropdown data |
| `GET` | `/hr/personnel` | Search personnel list |
| `GET` | `/hr/personnel/{user_id}` | Full personnel profile |
| `POST` | `/hr/financial/{user_id}` | Update financial baseline |
| `GET` | `/hr/leave-requests` | List leave requests |
| `POST` | `/hr/leave-requests/{id}/approve` | Approve leave |
| `POST` | `/hr/leave-requests/{id}/deny` | Deny leave |
| `GET` | `/hr/relocation-requests` | List relocation requests |
| `POST` | `/hr/relocation-requests/{id}/approve` | Approve relocation |
| `POST` | `/hr/relocation-requests/{id}/deny` | Deny relocation |
| `GET` | `/hr/issue-reports` | List issue reports |
| `POST` | `/hr/issue-reports/{id}/approve` | Approve & auto-fix |
| `POST` | `/hr/issue-reports/{id}/deny` | Deny issue report |

### Personnel Routes (any logged-in user)
| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/personnel/me` | Own personal profile |
| `POST` | `/personnel/me/report-issue` | Report a data correction |
| `GET` | `/personnel/me/financial` | Own financial info + leave quota |
| `GET` | `/personnel/me/leaves` | Own leave request history |
| `PUT` | `/personnel/me/leaves` | Submit new leave request |
| `POST` | `/personnel/me/leaves/{id}/cancel` | Cancel pending leave |
| `GET` | `/personnel/me/relocations` | Own relocation request history |
| `PUT` | `/personnel/me/relocation` | Submit relocation request |
| `GET` | `/personnel/me/issues` | Own issue report history |

---

## 1. Register New Staff — `POST /hr/signup`

> **Who can call this:** Admin only (role 1 or 3)

Registers a new employee. The backend **auto-generates** the username and password — you do **not** send them. The system also notifies the new user via Line or email automatically.

### Auto-generated credentials

| Field | Rule | Example |
|-------|------|---------|
| `username` | First initial (capital) + full last name | Prin Vivid → `Pvivid` |
| `password` | Fiscal year + last 5 digits of CID | FY2025, CID `...90123` → `202590123` |

> **Fiscal year rule:** April is the start of the new FY. If current month ≥ April → use current year, else use year − 1.
> If the username is already taken, a numeric suffix is appended automatically (`Pvivid1`, `Pvivid2`, …).

### Request Body

```json
{
  "first_name": "Prin",
  "last_name": "Vivid",
  "cid": "1234567890123",

  "role_id": 2,
  "branch_location": 3,
  "position": 1,
  "email": "prin@example.com",

  "hired": "2025-04-01",
  "bank_no": "123-4-56789-0",
  "p_number": "0812345678",
  "line_id": "U1234abcd",
  "e_contact": "0891234567",
  "birthday": "1990-06-15",
  "age": 34,
  "gender": "M",
  "m_status": "single",
  "children_number": 0,

  "h_address": "123 Moo 4",
  "mhoo": "4",
  "soi": "Sukhumvit 22",
  "road": "Sukhumvit",
  "district": "Khlong Toei",
  "sub_district": "Khlong Toei",
  "province": "Bangkok",
  "postal_code": "10110",

  "education": [
    {
      "ed_level": "Bachelor",
      "inst_name": "Chulalongkorn University",
      "from_date": "2008-06-01",
      "to_date": "2012-05-31"
    }
  ],

  "current_salary": 25000.00
}
```

### Required fields

Only **two fields are required** — everything else is optional:

| Field | Type | Notes |
|-------|------|-------|
| `first_name` | string | Used to generate username |
| `last_name` | string | Used to generate username |
| `cid` | string | Thai National ID — must be unique, used to generate password |

### Optional sections

- **Address** (`h_address`, `mhoo`, `soi`, `road`, `district`, `sub_district`, `province`, `postal_code`) — send any or all; if at least one is provided, an address row is created.
- **Education** (`education`) — send an empty array `[]` or omit entirely if not applicable. Multiple entries are supported.
- **Financial** (`current_salary`) — omit if unknown at signup time.

### Success Response — `201 Created`

```json
{
  "id": 42,
  "username": "Pvivid",
  "fiscal_year": 2025,
  "notified_via": "line"
}
```

| Field | Description |
|-------|-------------|
| `id` | New user's ID in the system |
| `username` | Auto-generated username to show/store |
| `fiscal_year` | The FY used for the generated password |
| `notified_via` | `"line"`, `"email"`, or `"none"` — how credentials were sent |

### Error Responses

| Status | When |
|--------|------|
| `401 Unauthorized` | No or invalid token |
| `403 Forbidden` | Logged-in user is not role 1 or 3 |
| `409 Conflict` | A personnel record with this `cid` already exists |

---

## 2. List Positions — `GET /hr/positions`

> **Who can call this:** Any logged-in user

Returns all available job positions. Use this to populate the **position dropdown** on the signup form.

### Request

No body. Just the Authorization header.

```
GET /hr/positions
Authorization: Bearer <token>
```

### Response — `200 OK`

```json
[
  { "id": 1, "title": "Manager", "created_at": "2026-03-21T10:00:00+07:00" },
  { "id": 2, "title": "Officer", "created_at": "2026-03-21T10:00:00+07:00" },
  { "id": 3, "title": "Clerk",   "created_at": "2026-03-21T10:00:00+07:00" }
]
```

> Use `id` as the value sent in `position` when calling `POST /hr/signup`.

---

## 3. List Leave Types — `GET /hr/leave-types`

> **Who can call this:** Any logged-in user

Returns all active leave type definitions. Use this to populate **leave type dropdowns** in any future leave management UI.

### Request

No body. Just the Authorization header.

```
GET /hr/leave-types
Authorization: Bearer <token>
```

### Response — `200 OK`

```json
[
  { "id": 1, "type": "Sick Leave",     "days": 30, "is_active": true },
  { "id": 2, "type": "Business Leave", "days": 6,  "is_active": true },
  { "id": 3, "type": "Annual Leave",   "days": 6,  "is_active": true }
]
```

---

---

## Auth Routes

### `POST /auth/change-password`
**Auth:** Any logged-in user

```json
{ "new_password": "mynewpassword" }
```
Response `200 OK`:
```json
{ "status": "ok", "account_status": "registered" }
```
Sets `account_status` from `"new"` to `"registered"` on first call. Subsequent calls keep it `"registered"`.

---

## HR Routes

### `GET /hr/dashboard`
**Auth:** Role 1 or 3

Response `200 OK`:
```json
{
  "total_active_employees": 42,
  "total_salary_this_month": 1050000.00,
  "salary_source": "monthlypayout",
  "pending_leave_requests": 3,
  "pending_relocation_requests": 1,
  "pending_issue_reports": 5,
  "employees_per_branch": [
    { "branch_name": "สำนักงานใหญ่", "count": 20 },
    { "branch_name": "สาขาสุรินทร์", "count": 22 }
  ]
}
```
`salary_source` is `"monthlypayout"` if payroll for this month has been processed, otherwise `"userfinancialdata"` (sum of baseline salaries).

---

### `GET /hr/personnel`
**Auth:** Role 1 or 3 | **Query params:** `name`, `branch_id`, `position_id`, `is_active`

All filters optional. Returns list:
```json
[
  { "id": 1, "first_name": "Prin", "last_name": "Vivid", "branch_location": 2,
    "position": 1, "is_active": true, "role_id": 2, "account_status": "registered" }
]
```

---

### `GET /hr/personnel/{user_id}`
**Auth:** Role 1 or 3

Returns full nested profile:
```json
{
  "id": 1, "username": "Pvivid", "first_name": "Prin", "last_name": "Vivid",
  "email": "...", "branch_location": 2, "position": 1, "is_active": true,
  "role_id": 2, "account_status": "registered",
  "personnel_info": { "cid": "...", "p_number": "...", "hired": "2025-04-01", ... },
  "address": { "h_address": "...", "province": "...", ... },
  "education": [{ "id": 1, "ed_level": "Bachelor", "inst_name": "...", ... }],
  "financial": { "current_salary": "25000.00", "current_loan": "0.00", ... },
  "leave_quota": { "year": 2025, "sick_leave": 28, "annual_leave": 6, ... },
  "relocation_history": [{ "id": 1, "location_id": 3, "date": "2025-06-01", ... }]
}
```

---

### `POST /hr/financial/{user_id}`
**Auth:** Role 1 or 3 | All body fields optional (at least one required)

```json
{
  "current_salary": 28000.00,
  "current_loan": 5000.00,
  "job_age": 3
}
```
Response `200 OK`: `{ "status": "ok", "user_id": 1 }`

---

### `GET /hr/leave-requests?status=pending`
**Auth:** Role 1 or 3 | `status` default: `"pending"`

```json
[
  {
    "id": 5, "user_id": 1, "user_first_name": "Prin", "user_last_name": "Vivid",
    "leave_type_id": 1, "leave_type_name": "ลาป่วย",
    "from_date": "2026-04-01", "to_date": "2026-04-03", "total_days": 3,
    "comment": "ไม่สบาย", "status": "pending", "hr_comment": null,
    "extra_leave_days": 0, "created_at": "2026-03-20T09:00:00"
  }
]
```

### `POST /hr/leave-requests/{id}/approve`
```json
{ "hr_comment": "อนุมัติ" }
```
Response: `{ "status": "ok", "extra_leave_days": 0 }`

Leave quota is deducted automatically. If extra days exceed the quota, `extra_leave_days > 0` — track for monthly payout deduction.

### `POST /hr/leave-requests/{id}/deny`
```json
{ "hr_comment": "เอกสารไม่ครบ" }
```
`hr_comment` is **required**. Response: `{ "status": "ok" }`

---

### `GET /hr/relocation-requests?status=pending`
**Auth:** Role 1 or 3

```json
[
  {
    "id": 2, "user_id": 1, "user_first_name": "Prin", "user_last_name": "Vivid",
    "requested_branch_id": 3, "requested_branch_name": "สาขาสุรินทร์",
    "reason": "ย้ายบ้าน", "status": "pending", "hr_comment": null,
    "effective_date": null, "created_at": "2026-03-18T08:00:00", "reviewed_at": null
  }
]
```

### `POST /hr/relocation-requests/{id}/approve`
`effective_date` is **required**.
```json
{ "effective_date": "2026-05-01", "hr_comment": "อนุมัติ" }
```
On approval: user's `branch_location` is updated automatically, and a row is written to `relocationdata`.

### `POST /hr/relocation-requests/{id}/deny`
```json
{ "hr_comment": "ตำแหน่งไม่ว่าง" }
```

---

### `GET /hr/issue-reports?status=pending`
**Auth:** Role 1 or 3

```json
[
  {
    "id": 3, "user_id": 1, "user_first_name": "Prin", "user_last_name": "Vivid",
    "category": "personal_info", "field_name": "p_number",
    "current_value": "0812345678", "correct_value": "0899999999",
    "description": "เบอร์เปลี่ยนแล้ว", "status": "pending",
    "hr_comment": null, "created_at": "2026-03-21T11:00:00", "resolved_at": null
  }
]
```

### `POST /hr/issue-reports/{id}/approve`
No body required. The fix is applied automatically — the field is updated in the database.

### `POST /hr/issue-reports/{id}/deny`
```json
{ "hr_comment": "ข้อมูลถูกต้องแล้ว" }
```

---

## Personnel Routes

### `GET /personnel/me`
**Auth:** Any logged-in user

Returns own profile (userdata + personeldata + address + education list). Does **not** include financial data (use `/personnel/me/financial`).

---

### `POST /personnel/me/report-issue`
**Auth:** Any logged-in user

**Valid categories and their reportable fields:**

| category | reportable fields |
|---|---|
| `personal_info` | hired, cid, bank_no, p_number, line_id, e_contact, birthday, age, gender, m_status, children_number |
| `address` | h_address, mhoo, soi, road, district, sub_district, province, postal_code |
| `financial` | current_salary, current_loan, current_slf, current_wg, current_ss, current_reserve, current_prov, current_pending, job_age, current_pension |
| `account` | email, first_name, last_name |

```json
{
  "category": "personal_info",
  "field_name": "p_number",
  "current_value": "0812345678",
  "correct_value": "0899999999",
  "description": "เบอร์เปลี่ยนแล้ว"
}
```
Response `201`: `{ "status": "created", "id": 3 }`

Errors: `400` if category/field invalid, `409` if a pending report for the same field already exists.

---

### `GET /personnel/me/financial`
Returns own financial info and current fiscal year leave quota:
```json
{
  "financial": { "current_salary": "25000.00", "current_loan": "0.00", ... },
  "leave_quota": { "year": 2025, "sick_leave": 28, "annual_leave": 6, ... }
}
```

---

### `GET /personnel/me/leaves`
Returns all own leave requests newest first, including `hr_comment` for accepted/denied reasons.

### `PUT /personnel/me/leaves`
```json
{ "leave_type_id": 1, "from_date": "2026-04-01", "to_date": "2026-04-03", "comment": "ไม่สบาย" }
```
Response `201`: `{ "status": "created", "id": 5, "total_days": 3 }`

Errors: `422` if dates invalid, `404` if leave type not found, `409` if overlapping leave exists.

### `POST /personnel/me/leaves/{id}/cancel`
Cancels own pending leave. Error `409` if not pending.

---

### `GET /personnel/me/relocations`
Returns all own relocation requests newest first. Shows `hr_comment` and `effective_date` after HR action.

### `PUT /personnel/me/relocation`
```json
{ "requested_branch_id": 3, "reason": "ย้ายบ้าน" }
```
Response `201`: `{ "status": "created", "id": 2 }`

Errors: `404` if branch invalid, `400` if same branch, `409` if pending request already exists.

---

### `GET /personnel/me/issues`
Returns all own issue reports newest first, including `hr_comment` showing the HR's resolution reason.

---

## Database Tables Created (for reference)

These are the new tables added in Phase 3B. You don't need to interact with them directly — the API handles it — but good to know what gets created on signup.

| Table | Description |
|-------|-------------|
| `positions` | Job position lookup |
| `leaves` | Leave type definitions |
| `personeldata` | HR details (CID, bank, contact, etc.) |
| `personneladdress` | Home address |
| `personeleducation` | Education history (multiple rows per user) |
| `userfinancialdata` | Salary & deduction baseline |
| `personnelleavequota` | Annual leave quota per user per fiscal year |
| `positionhistory` | Promotion/position change log |
| `relocationdata` | Completed branch transfers (history) |
| `relocation_requests` | Pending/approved/denied relocation requests |
| `monthlypayout` | Monthly payroll records |
| `leavehistory` | Leave requests & approvals |
| `issue_reports` | User-reported data correction requests |

**New columns on existing tables:**
- `userdata.position` (FK → positions), `userdata.is_active`, `userdata.account_status`
- `leavehistory.hr_comment`, `leavehistory.created_at`, `leavehistory.extra_leave_days`
- `monthlypayout.deduct_extra_leave`

---

## Typical Signup Flow (Frontend)

```
1. GET /hr/positions        → populate position dropdown
2. Admin fills in the form
3. POST /hr/signup          → submit the form
4. On 201: show the returned username to the admin
           ("New account created: Pvivid — credentials sent via Line")
5. On 409: show "CID already registered"
6. On 403: show "You don't have permission to do this"
```

---

## Notes

- The password is **never returned** in any API response. It is sent directly to the user via Line or email by the backend.
- `notified_via` in the signup response tells you **how** the backend tried to send it — useful to display a confirmation message like "Credentials sent via Line".
- If neither `line_id` nor `email` was provided, `notified_via` will be `"none"` — the admin will need to manually inform the new user of their credentials.
- Leave quota is **automatically created** for the current fiscal year on signup with default values. No extra call needed.
