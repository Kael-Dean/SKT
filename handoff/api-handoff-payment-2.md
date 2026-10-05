# API Handoff: งวด 2 — Leave, Out-of-Office, Positions, Transfers (+ Notifications)

## Business Context
งวด 2 of contract 002/2569 (฿66,000) is accepted by AMC through UAT run **in the UI**, covering four systems:
- **3B ลา**: leave.
- **3O ขอออกนอกสถานที่**: leaving the workplace for at most half a working day.
- **3D ตำแหน่งและการเลื่อนขั้น**: positions, salary steps and promotion exams.
- **3E โยกย้าย**: branch transfers.

This release adds 3O from scratch and an **in-app notification inbox** used by both 3O and leave. It also restricts what branch heads may approve.

Roles (JWT `role`): `1` Admin · `2` Manager (ผู้จัดการ) · `3` HR · `4` Head Accountant · `5` Staff · `6` Head of Branch/Department (หัวหน้าสาขา) · `7` Assistant Manager (ผู้ช่วยผู้จัดการ).

All error bodies are FastAPI's `{"detail": "<Thai message>"}` (422 validation errors use FastAPI's list form). **Show `detail` to the user as is.**

---

## 1. Approval chain (3B and 3O work the same way)

```
Staff (role ≠ 6) files            → status pending_branch_head
   branch head (6) approves       → approved            (final)
Branch head (6) files their own   → status pending_assistant_manager
   assistant manager (7) approves → pending_manager
   manager (2) confirms           → approved            (final)
Any pending stage: reject (with reason) → rejected
Requester: cancel → cancelled
```
3B only: a regular staff leave of **3 days or more** also starts at `pending_assistant_manager`.

**Who may act:**
- A **branch head** acts only on requests from their **home branch or branches assigned to them** (admin "extra branches"). Otherwise the API returns **403**.
- **Nobody approves their own request.** Doing so returns 403 (admin excepted).
- Each stage accepts **only its own role**; admin may act at any stage.
  - Wrong stage on approve/confirm: **409**.
  - 3O reject by the wrong role: **403**.
- Approving something already decided returns **409**.

---

## 2. 3O ขอออกนอกสถานที่

### POST /personnel/me/out-of-office
- **Purpose**: file a request (any logged-in user).
- **Request**:
  ```json
  {
    "request_type": "work | personal",
    "request_date": "2026-11-02",
    "time_out": "09:00",
    "time_back": "11:00",
    "place": "string, non-blank",
    "reason": "string, non-blank"
  }
  ```
- **Response 201**: `OutOfOfficeRequest`. Its `status` is `pending_branch_head` or `pending_assistant_manager`.
- **Errors**:
  - **422**: unknown `request_type`, `time_back` not after `time_out`, or blank place/reason.
  - **400**: outside work hours; over half a day (the message tells them to file leave instead); not a working day (weekend or holiday from the 3N calendar); backdated or too little notice (per settings).
  - **409**: overlaps the user's own pending or approved request on the same date, or the monthly personal-trip cap is reached.
- **Notes**: back-to-back requests are allowed (09:00–10:00 then 10:00–11:00).

### GET /personnel/me/out-of-office?year=2026&month=11
- My requests, newest first. `year`/`month` are calendar (AD) and optional.

### POST /personnel/me/out-of-office/{id}/cancel
- Own request only (otherwise 403). Allowed while the request is pending or approved **and before `time_out` on `request_date`**; otherwise **409**.
- **Response**: `OutOfOfficeRequest` with `status: "cancelled"`.

### POST /hr/out-of-office/{id}/branch-head-approve
- **Auth**: role 1 or 6. Stage `pending_branch_head`, ends `approved`. No body.

### POST /hr/out-of-office/{id}/approve
- **Auth**: role 1 or 7. Stage `pending_assistant_manager`, moves to `pending_manager`. No body.

### POST /hr/out-of-office/{id}/manager-confirm
- **Auth**: role 1 or 2. Stage `pending_manager`, ends `approved`. No body.

### POST /hr/out-of-office/{id}/reject
- **Auth**: role 1, 2, 6 or 7, and only the role whose stage it is.
- **Body**: `{ "reason": "string, required, non-blank" }`. A blank reason returns **422**.
- **Response**: `status: "rejected"`, with `reject_reason` set.

### GET /hr/out-of-office?status=&branch_id=&from_date=&to_date=
- **Auth**: roles 1, 2, 3, 6 and 7. **Role 6 sees only their branches**; the others see all.
- `status` takes any status value. Use `status=pending_branch_head` etc. to build each approver's to-do list.

### GET /hr/out-of-office/summary?year=2026&month=11
- **Auth**: same as the list, with the same scoping.
- **Response**: approved requests per branch:
  ```json
  [ { "branch_id": 3, "branch_name": "สาขาสุรินทร์", "work": 4, "personal": 1 } ]
  ```

### GET /hr/out-of-office/settings · PATCH /hr/out-of-office/settings
- **GET auth**: roles 1, 2, 3, 6, 7. **PATCH auth**: roles 1 and 3 only.
- **Shape** (PATCH accepts any subset of these fields):
  ```json
  {
    "work_start": "08:30",
    "work_end": "16:30",
    "half_day_hours": 4.0,
    "min_notice_days": 0,
    "max_backdate_days": 0,
    "personal_monthly_limit": null
  }
  ```
- `personal_monthly_limit: null` means no cap.
- PATCH returns **422** if `work_start >= work_end` or `half_day_hours <= 0`.
- These are **defaults chosen by FRD**. AMC has not confirmed them, and HR is expected to change them on this screen.

```typescript
interface OutOfOfficeRequest {
  id: number; user_id: number; branch_id: number | null;   // requester's branch when filed
  request_type: 'work' | 'personal';
  request_date: string;            // YYYY-MM-DD
  time_out: string; time_back: string;   // "HH:MM:SS"
  place: string; reason: string;
  status: 'pending_branch_head' | 'pending_assistant_manager' | 'pending_manager'
        | 'approved' | 'rejected' | 'cancelled';
  assistant_manager_id: number | null; assistant_manager_at: string | null;
  approver_id: number | null;      // final decider
  decided_at: string | null; reject_reason: string | null;
  cancelled_at: string | null; created_at: string | null;   // ISO 8601
}
```

| Value | Label (TH) |
|---|---|
| `work` | ออกนอกสถานที่เพื่อปฏิบัติงาน |
| `personal` | ออกนอกสถานที่เพื่อธุระส่วนตัว |
| `pending_branch_head` | รอหัวหน้าสาขาอนุมัติ |
| `pending_assistant_manager` | รอผู้ช่วยผู้จัดการอนุมัติ |
| `pending_manager` | รอผู้จัดการยืนยัน |
| `approved` | อนุมัติแล้ว |
| `rejected` | ไม่อนุมัติ |
| `cancelled` | ยกเลิกแล้ว |

---

## 3. Notifications (new; used by 3O and leave)

### GET /personnel/me/notifications?unread_only=false&limit=50
- **Auth**: any logged-in user. Returns their own notifications only, newest first. `limit` is capped at 200.
```typescript
interface Notification {
  id: number;
  kind: 'action' | 'info';            // action = this user must decide something
  ref_type: 'out_of_office' | 'leave';
  ref_id: number;                     // id of the OutOfOfficeRequest / leave request
  message: string;                    // ready-to-show Thai sentence
  read_at: string | null; created_at: string | null;
}
```

### POST /personnel/me/notifications/{id}/read
- Returns `{ "status": "ok" }`. Someone else's notification, or an unknown id, returns **404**.

### POST /personnel/me/notifications/read-all
- Returns `{ "marked": 3 }`.

**When notifications are created** (3O and leave alike; the requester is never notified of their own filing):

| Event | `action` (must decide) | `info` (FYI) |
|---|---|---|
| Filed → `pending_branch_head` | branch heads of the requester's branch (home or assigned) | HR (3), assistant managers (7) |
| Filed → `pending_assistant_manager` | assistant managers (7) | HR (3) |
| Assistant manager approves → `pending_manager` | managers (2) | — |
| Final approve or reject | — | the requester |

- **No LINE and no push**: poll the inbox (for example every 60 s, or on page focus) and show an unread badge.
- Use `ref_type`/`ref_id` to deep-link to the request.
- An `action` notification is **not** cleared automatically when someone else decides the request. When opening it, check the request's current `status`.

---

## 4. 3B Leave (existing endpoints, changed behaviour)

Unchanged endpoints:
- File: `PUT /personnel/me/leaves`
- Approve: `POST /hr/leave-requests/{id}/branch-head-approve` · `/branch-head-deny` · `/approve` (assistant manager) · `/manager-confirm` · `/deny` (any stage, body `{"hr_comment": "required"}`)

New behaviour:
- **403** when anyone approves, confirms or denies **their own** leave at any stage (assistant manager and manager included; admin excepted).
- **403** when a branch head approves or denies leave for a branch they don't cover. The message reads "ไม่มีสิทธิ์พิจารณาใบลานี้ (ต่างสาขา หรือเป็นใบลาของตนเอง)". Hide or disable the buttons accordingly; to build the head's list, filter to their branches.
- Leave now creates notifications (section 3, `ref_type: "leave"`).

---

## 5. 3D Positions & Salary Steps (existing endpoints)

All endpoints below require **role 1 or 3** and use the `/hr` prefix.

| Method / path | Purpose | Body / notes |
|---|---|---|
| `GET /positions` | list positions | `{id, title, position_tier_id, is_active}` |
| `POST /positions` | create position | `{title, position_tier_id?}` |
| `PATCH /positions/{id}` | rename, or set the tier (band) | `{title?, position_tier_id?}` |
| `PATCH /positions/{id}/deactivate` | soft delete | **409** if already inactive |
| `PATCH /employees/{id}/position` | change someone's position | `{new_position_id, reason, effective_date?}` |
| `GET /employees/{id}/position-history` | history | — |
| `GET /salary-ladder?tier=` / `GET /salary-ladder/lookup` / `PATCH /salary-ladder/{id}` | pay-scale table | PATCH `{salary_amount}` |
| `GET /employees/{id}/salary-history` | step history | `{old_level, new_level, reason, effective_date, …}` |
| `POST /employees/{id}/salary-step-award` | add steps | `{step > 0, reason}`, returns `{old_level, new_level, capped}`. Capped at the band's top step. **409** if the employee's position has no band: fix the position's `position_tier_id` first |
| `GET /promotions/eligible` | 3+ years in current position | `{user_id, full_name, position_title, position_entered_date, years_in_position}` |
| `POST /promotions/exams` | schedule an exam | `{candidate_id, position_target, exam_date, notes?}` |
| `PATCH /promotions/exams/{id}/result` | record pass/fail | `{result: "pass"|"fail", reason, notes?}`. On pass, position and salary step are re-pegged automatically. **409** if a result is already recorded. **422** if the target position is inactive |

Tiers (`position_tier_id`):
- 1 ลูกจ้าง ร.1
- 2 ลูกจ้าง ร.2
- 3 เจ้าหน้าที่ ร.1
- 4 เจ้าหน้าที่ ร.2
- 5 เจ้าหน้าที่ ร.3
- 6 หัวหน้าแผนก / ผู้ช่วยหัวหน้าสาขา
- 7 หัวหน้าฝ่าย/สาขา
- 8 ผู้ช่วยผู้จัดการ
- 9 ผู้จัดการ

Real salaries, bands and steps come from AMC's salary register (2 Oct 2569); the import runs at go-live.

---

## 6. 3E Transfers (existing endpoints, fields to show)

- **Direct transfer.** `POST /hr/employees/{id}/relocations` (role 1 or 3):
  - Body: `{to_branch_id, effective_date?, reason, order_reference?, sub_unit?}`.
  - Returns `{relocation_id, from_branch_id, to_branch_id, effective_date, applied}`.
  - `applied: false` means the date is in the future, so the branch changes when that date arrives. The UI should say "มีผลวันที่ …".
  - **404** if the employee or the target branch doesn't exist.
- **History.** `GET /hr/employees/{id}/relocation-history` returns `[{from_branch_id, from_branch_name, to_branch_id, to_branch_name, date, reason, authorized_by}]`. Show the **names**.
- **Employee requests** (`/hr/relocation-requests…`): unchanged. The manager-approve body now also accepts `order_reference` (เลขคำสั่ง) alongside `selected_branch_id`, `move_date` and `manager_reason`.

---

## 7. งวด 2 UAT checklist (from TOR section 6 of each module; every row must pass)

| # | Module | Scenario | Expected | Endpoint(s) |
|---|---|---|---|---|
| B1 | 3B | Staff files 1-day leave → own branch head approves | approved; staff gets an info notification | `PUT /personnel/me/leaves`, `/branch-head-approve` |
| B2 | 3B | Branch head files leave → AM approves → manager confirms | pending_assistant_manager → pending_manager → approved | `/approve`, `/manager-confirm` |
| B3 | 3B | Staff files 3+ days | starts at pending_assistant_manager | `PUT /personnel/me/leaves` |
| B4 | 3B | Reject at each stage, with reason | rejected; filer notified | `/deny`, `/branch-head-deny` |
| B5 | 3B | Overlapping leave | 409 | `PUT /personnel/me/leaves` |
| B6 | 3B | Over the leave type's ceiling | 400 | 〃 |
| B7 | 3B | Training leave with less than 7 days' notice | 400 | 〃 |
| B8 | 3B | Approve twice, or skip a stage | 409 | approve endpoints |
| B9 | 3B | Branch head of another branch approves | 403 | `/branch-head-approve` |
| B10 | 3B | Cancel a pending leave | cancelled | `POST /personnel/me/leaves/{id}/cancel` |
| O1 | 3O | Staff files 09:00–11:00 → branch head approves | approved; notifications per section 3 | 3O endpoints |
| O2 | 3O | Branch head files → AM → manager | approved after two steps | `/approve`, `/manager-confirm` |
| O3 | 3O | Request longer than half a day | 400, message says to file leave | `POST /personnel/me/out-of-office` |
| O4 | 3O | Weekend or holiday date | 400 | 〃 |
| O5 | 3O | Reject without a reason / with a reason | 422 / rejected | `/reject` |
| O6 | 3O | Cancel before time_out; cancel again | cancelled; 409 | `/cancel` |
| O7 | 3O | Every action appears in the audit log | OOO_SUBMIT/APPROVE/REJECT/CANCEL rows | (admin audit screen) |
| O8 | 3O | Branch summary | counts per branch, work/personal | `/summary` |
| D1 | 3D | Create, rename and deactivate a position; deactivate again | ok; 409 | `/positions…` |
| D2 | 3D | Award steps beyond the band's top | `capped: true`, level = band max | `/salary-step-award` |
| D3 | 3D | Eligible list shows people with 3+ years in position | listed with years | `/promotions/eligible` |
| D4 | 3D | Exam pass, exact salary match | new position, same salary, matching step | `/promotions/exams/{id}/result` |
| D5 | 3D | Exam pass, no exact match | closest step not above the current salary | 〃 |
| D6 | 3D | Exam fail; record the result again | position unchanged; 409 | 〃 |
| E1 | 3E | Direct transfer effective today | branch changes now; history shows branch names | `/employees/{id}/relocations` |
| E2 | 3E | Transfer to a branch that doesn't exist | 404 | 〃 |
| E3 | 3E | After a transfer, the employee's branch-scoped data follows the new branch | access changes | (login as that user) |
| E4 | 3E | History includes both direct transfers and approved employee requests | both appear | `/relocation-history` |

## Open Questions / TODOs
- 3O defaults (work hours, half-day = 4 h, no notice, no backdating, no cap) await AMC confirmation. They are editable on the settings screen.
- No LINE delivery and no 3O PDF form in this release.
- The holiday calendar ships with 15 fixed-date public holidays (marked as defaults). HR adds the lunar holidays through the existing 3N holiday screen.
- A future-dated transfer needs the daily `POST /hr/relocations/apply-due` job (Cloud Scheduler) to take effect on its date. Until then, call it manually or use today's date during UAT.
