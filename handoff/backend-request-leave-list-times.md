# Backend request — return `from_time` / `to_time` from `GET /hr/leave-requests`

**From:** Frontend (AMC) · **Date:** 2026-11-16 · **Priority:** Medium (approvers can't tell a morning half-day from an afternoon one)
**Repo:** `FeatureRichDevelopment/um_backend` (checked at `7c16053`)

## Problem

When an employee files a half-day leave, they pick **ครึ่งเช้า** (08:30–12:00) or **ครึ่งบ่าย** (13:00–16:30). On the approval card,
the branch head, HR and the inbox only see "ครึ่งวัน", so they can't tell which half was requested.

The frontend already shows "ครึ่งวันเช้า" or "ครึ่งวันบ่าย" whenever a leave row has `from_time`. But in production, every row from
`GET /hr/leave-requests` comes back with `from_time: null` and `to_time: null`. That holds for all 308 rows, including the 56 half-day
leaves. Example: leave **#623** (นายแสงอาทิตย์, ลากิจ 0.5 day on 13/11/2569, filed 16/11).

## Root cause

The times **are saved**. In `Phase3/personnel_route.py` → `create_leave()` (around lines 943–949), the code writes
`from_time=req.from_time` and `to_time=req.to_time` into `LeaveHistory`.

They are **not read back**. `Phase3/hr_route.py` → `list_leave_requests()` (around lines 1064–1093) builds the response with an explicit
column list in `db.query(...)`. That list doesn't include `LeaveHistory.from_time` or `LeaveHistory.to_time`. `LeaveRequestOut` declares
both fields with a default of `None`, so `LeaveRequestOut(**r._asdict())` fills them with `null`.

The same list also leaves out `LeaveHistory.address_during_leave` and `LeaveHistory.contact_during_leave`. Those fields are declared in
`LeaveRequestOut` too, so they also always come back `null`. The inbox detail ("ที่อยู่ระหว่างลา") is empty for the same reason.

## Requested change

In `list_leave_requests()`, add these 4 columns to `db.query(...)`:

```python
        LeaveHistory.from_date,
        LeaveHistory.to_date,
        LeaveHistory.from_time,             # + add
        LeaveHistory.to_time,               # + add
        LeaveHistory.total_days,
        LeaveHistory.comment,
        LeaveHistory.status,
        LeaveHistory.hr_comment,
        LeaveHistory.extra_leave_days,
        LeaveHistory.address_during_leave,  # + add
        LeaveHistory.contact_during_leave,  # + add
        LeaveHistory.created_at,
```

No schema, migration or request-body change is needed. The column names already match `LeaveRequestOut`.

Please also check any other endpoint that returns `LeaveRequestOut` or builds leave rows with an explicit column list (for example, the
approver queue or inbox endpoints). Each one should include the same 4 columns.

## What the frontend sends (unchanged)

`PUT /personnel/me/leaves`

```json
{ "from_date": "2026-11-13", "to_date": "2026-11-13", "from_time": "08:30", "to_time": "12:00", "is_half_day": true }
```

The afternoon half-day sends `"13:00"` / `"16:30"`. A full day sends `null` / `null`.

## How the frontend reads it

Implemented in `src/lib/leaveDays.js` → `fmtLeaveDuration()` (pushed to `main` in `f581c10`):

| `total_days` | `from_time` | Shown as |
|---|---|---|
| 0.5 | earlier than 12:00 | ครึ่งวันเช้า |
| 0.5 | 12:00 or later | ครึ่งวันบ่าย |
| 0.5 | `null` | ครึ่งวัน (what everyone sees today) |
| 1.5 / 2.5 | — | วันครึ่ง / 2 วันครึ่ง |

`"08:30"` and `"08:30:00"` both work. Once the backend returns the times, no frontend change is needed.

## Acceptance

1. `GET /hr/leave-requests` returns leave #623 with `from_time` and `to_time` filled (the values stored in the DB).
2. A newly filed **ครึ่งบ่าย** leave returns `"from_time": "13:00:00"` (or `"13:00"`).
3. Full-day leaves still return `null` / `null`.
4. `address_during_leave` and `contact_during_leave` return the stored values.
