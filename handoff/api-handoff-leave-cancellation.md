# Backend handoff — Leave cancellation (employee + HR), kept for audit

**From:** Frontend (AMC สกต.สุรินทร์ web) · **Date:** 2026-11-25
**Backend repo:** `FeatureRichDevelopment/um_backend` · files referenced below are in `Phase3/`, `models.py`, `rbac_matrix.py`

---

## 1. What the client wants

A **"Cancel leave"** button that both the **employee who requested the leave** and **HR** can press.

After cancelling:

1. **Quota is given back**: the employee's balance is the same as if the leave had never been requested.
   Every derived figure (balance, leave calendar, reports, KPI, savings, payroll not yet generated) must stop counting it.
2. **The record is NOT deleted.** It stays in the database and in every list/history, shown with the status
   **"ยกเลิก" (cancelled)**, so it can be audited later: who requested it, who approved it, who cancelled it, when, and why.
3. Cancellation must work for **pending and already-approved** leave.

---

## 2. What exists today (checked against `main` on 2026-11-25)

| Endpoint | Who | Allowed statuses | Notes |
|---|---|---|---|
| `POST /personnel/me/leaves/{leave_id}/cancel` (`personnel_route.py` ~L1036) | Owner only | `pending_branch_head`, `pending_assistant_manager`, `pending_manager` | Sets `status = "cancelled"`, writes `AuditLog CANCEL_LEAVE` |
| `POST /hr/leave-requests/{leave_id}/cancel-approved` (`hr_route.py` ~L1574) | `require_perm("leave.cancel_approved")` = **role 101 only** (+ Super Admin 1) | `approved` | Sets `status = "cancelled"`, writes `AuditLog CANCEL_APPROVED_LEAVE` |

Good already:
- Quota is computed from `status == "approved"` rows everywhere, so flipping to `cancelled` **already gives the days back** with no extra work.
- The row is soft-cancelled (not deleted), and `GET /hr/leave-requests` / `GET /personnel/me/leaves` return all statuses.
- `leave_form_generator.py` already has the label `"cancelled": "ยกเลิกแล้ว"`.

Gaps:
- **G1.** HR (`117` หัวหน้าแผนกบุคคล, `130` เจ้าหน้าที่บุคคล) cannot cancel an approved leave: they get 403.
- **G2.** An employee cannot cancel their own leave once it is approved.
- **G3.** No cancellation metadata on `LeaveHistory`: no `cancelled_by`, `cancelled_at`, `cancel_reason`, or status-before-cancel.
  The only trace is `AuditLog`, which the frontend cannot read per leave.
- **G4.** `LeaveHistory.action_at` has `onupdate=func.now()`, so **cancelling overwrites the approval timestamp**.
  After a cancel we lose when the leave was approved, which defeats the audit requirement.
- **G5.** Payroll that is already generated/finalized for a period that contains the leave is not recalculated
  (e.g. unpaid leave was deducted, then the leave is cancelled).

---

## 3. Requested changes

### 3.1 Data model: add cancellation fields (Alembic migration)

```python
# models.py — class LeaveHistory
cancelled_by          = Column(Integer, ForeignKey("userdata.id"), nullable=True)
cancelled_at          = Column(DateTime(timezone=True), nullable=True)
cancel_reason         = Column(String, nullable=True)          # required when cancelling an approved leave
cancelled_from_status = Column(String, nullable=True)          # e.g. "approved", "pending_manager"
```

And **stop `action_at` from changing on cancel** (fix G4). Either remove `onupdate=func.now()` and set
`action_at` explicitly in the approve/deny handlers, or keep it but make sure the cancel handlers do not touch it.
Pick whichever is safer for you; the requirement is that the approval time survives a cancel.

### 3.2 Employee cancel: extend the existing endpoint

`POST /personnel/me/leaves/{leave_id}/cancel`

Body (new, optional for pending, **required for approved**):
```json
{ "reason": "string" }
```

Rules:
- Owner only (keep the existing ownership guard).
- **Pending** statuses: allowed as today.
- **Approved**: allowed **only while `from_date` > today** (leave has not started yet). Otherwise `409`
  with a Thai-readable detail, e.g. `"ลาเริ่มไปแล้ว ยกเลิกเองไม่ได้ กรุณาติดต่อฝ่ายบุคคล"`.
  *(If the client prefers a different cut-off, e.g. "until the day before", tell us; frontend reads the rule from the response, see 3.5.)*
- `rejected` / `cancelled`: `409`.
- Set `status="cancelled"`, `cancelled_by=user_id`, `cancelled_at=now`, `cancel_reason`, `cancelled_from_status=<old status>`.
- Keep `AuditLog` (`CANCEL_LEAVE`, put old status + days in `comment`).

### 3.3 HR / manager cancel: widen the existing endpoint

`POST /hr/leave-requests/{leave_id}/cancel-approved` → rename or alias to **`POST /hr/leave-requests/{leave_id}/cancel`**
(keep the old path working so nothing breaks).

Body:
```json
{ "reason": "string" }   // required
```

Rules:
- Permission `leave.cancel_approved`: **add roles `117` and `130`** to `rbac_matrix.py` (fix G1).
  Keep `101`. *(If the client wants `106` หัวหน้าฝ่ายอำนวยการ too, add it; frontend follows whatever you set.)*
- Allowed statuses: **any pending status and `approved`** (HR can cancel at any time, including after the leave started).
- `rejected` / `cancelled`: `409`.
- Same fields as 3.2 (`cancelled_by` = HR user id).
- `AuditLog` `CANCEL_APPROVED_LEAVE` / `CANCEL_LEAVE` as today.
- Respect branch scope the same way `leave.list` does if HR roles are ever made `own_branch`.

### 3.4 Notifications

When someone other than the owner cancels, notify the employee (same channel as `leave_notifications.py`):
"ใบลาวันที่ … ถูกยกเลิกโดย … เหตุผล: …".
When the employee cancels an approved leave, notify the approvers on that leave (branch head / asst. manager / manager).

### 3.5 Response fields (lists + detail)

Add these to the leave objects returned by:
- `GET /personnel/me/leaves`
- `GET /hr/leave-requests` (+ `?mine=true`)
- `GET /hr/leave-requests/{id}` / `.../history`
- employee leave history used on the HR personnel page (`employee_router.py`)

```json
{
  "status": "cancelled",
  "cancelled_by": 123,
  "cancelled_by_name": "ชื่อ นามสกุล",
  "cancelled_at": "2026-11-25T09:30:00+07:00",
  "cancel_reason": "เปลี่ยนแผน",
  "cancelled_from_status": "approved",
  "can_cancel": true          // computed for the CURRENT caller: true if this caller may cancel this row now
}
```

`can_cancel` lets the frontend show/hide the button without duplicating your date/role rules.

Also add one entry to the `steps` / history timeline when a leave is cancelled
(`{ "action": "cancelled", "by": …, "by_name": …, "at": …, "comment": cancel_reason }`) so the approval history
UI shows it at the end of the chain.

### 3.6 Keep cancelled leave visible, never counted

Please double-check that **every** place that counts leave uses `status == "approved"` (it looks like it does today:
`hr_route.py`, `personnel_route.py`, `employee_router.py`, `leave_calendar.py`, `reports_router.py`, `payroll_router.py`,
`kpi_step_rules.py`, `savings_service.py`, `history_router.py`), and that **no list endpoint filters cancelled rows out**
unless the caller asks for a specific `status`.

Reports that list leave rows (register PDF, annual summary): show cancelled rows with status "ยกเลิก" **only if** the
client wants them on paper. Default: exclude from totals, but it's fine to include them as rows marked ยกเลิก. Please tell us which you choose.

The leave form PDF (`/personnel/me/leaves/{id}/pdf`) for a cancelled leave should print a clear "ยกเลิก" mark
plus cancelled by / date / reason.

### 3.7 Payroll already generated (G5)

If the cancelled leave falls in a payroll period that is already generated or finalized:
- Minimum: return a warning flag in the cancel response, e.g. `"payroll_affected": true, "payroll_period": "2026-11"`,
  so the frontend can tell HR to regenerate or adjust that payroll.
- Better: if the period is still a draft, regenerate it; if finalized, record an adjustment for the next period.

Your call on the approach; we just need to know which one so the UI can show the right message.

---

## 4. Error format

Keep the FastAPI format the frontend already parses: `{ "detail": "ข้อความภาษาไทย" }` for 403/404/409.
Please make the 409 messages Thai and user-readable. They are shown in a toast as-is.

---

## 5. What frontend will do once this is live

- Employee: "ยกเลิก" button on own leave (pending **and** approved before start date), with a confirm dialog that asks for a reason.
- HR / manager: "ยกเลิกใบลา" button on the HR leave list and the personnel leave history, with a required reason.
- Cancelled leave stays in every list with a grey **"ยกเลิก"** badge plus who/when/why; quota cards update automatically.
- Button visibility follows `can_cancel` from the API. Frontend permission key `hr.leave.cancelApproved` will be
  updated to match the roles you set in `rbac_matrix.py`.

## 6. Acceptance checks

1. Employee cancels a pending leave → status `cancelled`, quota unchanged (was never counted), row still listed.
2. Employee cancels an approved future leave → quota goes back up by `total_days`, row listed as cancelled with reason.
3. Employee tries to cancel an approved leave that already started → 409 Thai message.
4. HR (117 / 130) cancels an approved leave that already started → OK, quota restored, employee notified.
5. Role without permission → 403.
6. After cancel, `action_at` / `approved_by` / step timestamps of the original approval are unchanged.
7. Leave calendar, balance report, KPI, savings no longer count the leave.
8. Cancel inside a generated payroll period → response includes the payroll warning (3.7).
