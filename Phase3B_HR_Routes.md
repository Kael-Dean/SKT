# Phase 3B — HR Personnel Routes
### Frontend Integration Guide

---

## Overview

Phase 3B adds HR personnel management to the system. The new routes live under the `/hr` prefix. All routes require a valid JWT Bearer token in the `Authorization` header.

**Base URL:** `http://localhost:8080` (dev) / Cloud Run URL (prod)

**Swagger:** `http://localhost:8080/docs`

---

## Authentication Reminder

All `/hr` routes require:

```
Authorization: Bearer <access_token>
```

Get a token via:

```
POST /auth/login_json
Content-Type: application/json

{ "username": "...", "password": "..." }
```

Response:
```json
{ "access_token": "eyJ...", "token_type": "bearer" }
```

---

## Routes Summary

| Method | Endpoint | Auth Required | Role Required |
|--------|----------|---------------|---------------|
| `POST` | `/hr/signup` | Yes | Role 1 or 3 (admin) |
| `GET` | `/hr/positions` | Yes | Any logged-in user |
| `GET` | `/hr/leave-types` | Yes | Any logged-in user |

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
| `relocationdata` | Branch transfer log |
| `monthlypayout` | Monthly payroll records |
| `leavehistory` | Leave request & approval records |

> `userdata` also got two new columns: `position` (FK → positions) and `is_active` (boolean, default `true`).

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
