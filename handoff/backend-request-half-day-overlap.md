# Backend request — allow a second half-day leave on the same date

**From:** Frontend (AMC) · **Date:** 2026-11-13 · **Priority:** High (staff blocked in production)
**Repo:** `FeatureRichDevelopment/um_backend` (checked at `d25866b`)

## Problem

An employee took a **morning half-day** leave, and it was approved. His errand ran long, so he tried to file an **afternoon half-day** for the
same date. `PUT /personnel/me/leaves` rejected it with:

```
409 You have an overlapping pending or approved leave for these dates
```

Reported from production (`amcsurin.com/leave-request`).

## Root cause

`Phase3/personnel_route.py` → `create_leave()` (around lines 825–838) checks for overlap by **date range only**:

```python
overlap = db.query(LeaveHistory).filter(
    LeaveHistory.user_id == user_id,
    LeaveHistory.status.in_(_LEAVE_ACTIVE),
    LeaveHistory.from_date <= req.to_date,
    LeaveHistory.to_date >= req.from_date,
).first()
```

Any active leave on that date blocks a new one, even when both are half-days that together make exactly one day.
`LeaveHistory` already stores `from_time`, `to_time` and `total_days` (0.5 steps), so the data needed to tell morning from afternoon is
already there. The check just doesn't use it.

`create_leave()` is the only place that creates `LeaveHistory` rows, so this is the only check that needs to change.

## What the frontend sends (no change needed)

```json
{
  "leave_type_id": 3,
  "from_date": "2026-11-13",
  "to_date": "2026-11-13",
  "from_time": "13:00",
  "to_time": "16:30",
  "is_half_day": true,
  "comment": "...",
  "address_during_leave": "...",
  "contact_during_leave": "..."
}
```

`from_time` / `to_time` are **optional** in the form, so they may be `null` even when `is_half_day` is `true`.

## Requested rule

1. A new **single-day half-day** leave may share a date with an existing active **single-day half-day** leave, **unless** both have times
   and the time ranges overlap.
2. A single date may hold at most **two** half-days in total (1.0 day). A third half-day returns 409.
3. Everything else works as it does now: any other date overlap returns 409. That covers full days, multi-day ranges, and a half-day
   requested on a date that already has a full-day leave.
4. "Active" stays the same: `pending_branch_head`, `pending_assistant_manager`, `pending_manager`, `approved`.

## Suggested implementation

Replaces the block at around lines 825–838:

```python
_LEAVE_ACTIVE = [
    "pending_branch_head", "pending_assistant_manager", "pending_manager", "approved",
]
clashes = db.query(LeaveHistory).filter(
    LeaveHistory.user_id == user_id,
    LeaveHistory.status.in_(_LEAVE_ACTIVE),
    LeaveHistory.from_date <= req.to_date,
    LeaveHistory.to_date >= req.from_date,
).all()

def _is_half(l):
    return (
        l.from_date == l.to_date
        and l.total_days is not None
        and Decimal(l.total_days) <= Decimal("0.5")
    )

def _times_overlap(a_from, a_to, b_from, b_to):
    if not (a_from and a_to and b_from and b_to):
        return False  # times unknown → rule 2 (max two halves per day) decides
    return a_from < b_to and b_from < a_to

req_is_half = req.is_half_day and req.from_date == req.to_date

blocking = [
    l for l in clashes
    if not (
        req_is_half
        and _is_half(l)
        and l.from_date == req.from_date
        and not _times_overlap(l.from_time, l.to_time, req.from_time, req.to_time)
    )
]

if req_is_half and not blocking:
    same_day_halves = [l for l in clashes if _is_half(l) and l.from_date == req.from_date]
    if len(same_day_halves) >= 2:
        blocking = same_day_halves

if blocking:
    raise HTTPException(
        status.HTTP_409_CONFLICT,
        "มีใบลาที่รออนุมัติหรืออนุมัติแล้วในช่วงวันดังกล่าว",
    )
```

(`Decimal` is already used elsewhere in this function; import it if this module doesn't already.)

Optional: return the 409 message in Thai, as above. The frontend shows `detail` to staff exactly as received, and the English text is
confusing for them.

## Test cases

| # | Existing active leave(s) on 2026-11-13 | New request | Expected |
|---|---|---|---|
| 1 | half-day 08:30–12:00 (approved) | half-day 13:00–16:30 | **201** |
| 2 | half-day, no times (approved) | half-day, no times | **201** |
| 3 | half-day 08:30–12:00 | half-day 10:00–14:00 | 409 (times overlap) |
| 4 | two half-days (morning + afternoon) | another half-day | 409 (day already 1.0) |
| 5 | full day | half-day | 409 |
| 6 | half-day | full day, same date | 409 |
| 7 | half-day on 11-13 | range 11-12 → 11-14 | 409 |
| 8 | half-day with status `rejected` / `cancelled` | full day | 201 (not active) |

## Frontend

No change needed. The form already sends `is_half_day`, `from_time` and `to_time`, and it already shows the 409 `detail` message.
Please ping us when this is deployed, and we'll re-test the morning + afternoon flow on staging.
