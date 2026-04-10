# API Handoff: Section 13 — Client Document Integration

## Business Context

Section 13 adds five new HR workflows that map directly to paper forms and registers the client currently manages manually: employee termination settlement, salary certificate requests, extended relocation request forms, org-wide relocation history reports, leave registers, and resigned/retired staff lists. All auth is JWT-based (`Authorization: Bearer <token>`). Roles are integers: **1 = Manager**, **3 = HR**. Employees are any authenticated user. The fiscal year boundary is **April 1 → March 31** (e.g. Thai BE 2568 = Apr 2025 → Mar 2026).

---

## Endpoints

---

### 13E — Termination Settlement

#### GET /hr/employees/{employee_id}/termination-record
- **Purpose**: Pre-fill the settlement form with live-computed values, or return an existing saved record.
- **Auth**: Roles 1 or 3
- **Response (200)**:
  ```json
  {
    "id": null,
    "exit_type": null,
    "exit_date": "2026-04-03",
    "committee_set_no": null,
    "committee_meeting_no": null,
    "committee_meeting_date": null,
    "tenure_years": 12,
    "tenure_days": 87,
    "total_leave_days": "45.0",
    "total_annual_leave_days": "18.0",
    "last_salary": "28500.00",
    "severance_pay": null,
    "accumulated_fund": null,
    "work_guarantee_bond": null,
    "loan_outstanding": null,
    "loan_interest_estimate": null,
    "bank_guarantee_ref": null,
    "bank_guarantee_date": null,
    "bank_guarantee_amount": null,
    "created_at": null
  }
  ```
- **Notes**:
  - If `id` is `null`, no record has been saved yet — this is the **pre-fill preview**. The form should show these values but mark them as read-only computed fields.
  - If `id` is a number, the record is saved and editable via PATCH.
  - `tenure_years` / `tenure_days`: computed from hire date → exit date (or today in pre-fill mode).
  - `last_salary`: from latest payslip; falls back to financial profile if no payroll history.
  - All monetary fields are strings (Decimal serialised as string to preserve precision).

#### POST /hr/employees/{employee_id}/termination-record
- **Purpose**: Save the settlement record and simultaneously deactivate the employee.
- **Auth**: Roles 1 or 3
- **Request**:
  ```json
  {
    "exit_type": "resign",
    "exit_date": "2026-04-01",
    "committee_set_no": 13,
    "committee_meeting_no": 10,
    "committee_meeting_date": "2026-03-28",
    "severance_pay": "342000.00",
    "accumulated_fund": "85500.00",
    "work_guarantee_bond": "10000.00",
    "loan_outstanding": "12000.00",
    "loan_interest_estimate": "450.00",
    "bank_guarantee_ref": "ธก.001/2569",
    "bank_guarantee_date": "2026-03-01",
    "bank_guarantee_amount": "50000.00"
  }
  ```
- **Response (201)**:
  ```json
  { "status": "created", "id": 7 }
  ```
- **Errors**:
  - `404` — employee not found
  - `409` — employee already inactive (`"Employee is already terminated. Complete the termination process through this endpoint only."`)
  - `409` — record already exists (`"Termination record already exists. Use PATCH to update."`)
- **Notes**:
  - This is the **only** correct way to terminate an employee. Do not call `PATCH /hr/employees/{id}/terminate` separately — doing so will cause the 409 on this endpoint.
  - `tenure_years`, `tenure_days`, `total_leave_days`, `total_annual_leave_days`, `last_salary` are **computed server-side** from `exit_date`. Do not send them.
  - After a successful POST, the employee's `is_active` becomes `false`. Their account will be locked out.

#### PATCH /hr/employees/{employee_id}/termination-record
- **Purpose**: Correct fields on an existing record (e.g. wrong committee number).
- **Auth**: Roles 1 or 3
- **Request**: Any subset of the same fields as POST (all optional, patch-only semantics):
  ```json
  {
    "committee_set_no": 14,
    "severance_pay": "345000.00"
  }
  ```
- **Response (200)**: `{ "status": "ok" }`
- **Errors**: `404` if no record exists yet (must POST first)

#### GET /hr/employees/{employee_id}/termination-record/pdf
- **Purpose**: Download the settlement PDF (บันทึกการออก...).
- **Auth**: Roles 1 or 3
- **Response**: `application/pdf` binary stream
- **Headers**: `Content-Disposition: attachment; filename="termination_{id}.pdf"`
- **Errors**: `404` if no record saved yet
- **Notes**: PDF title changes based on `exit_type` — "ลาออก" / "ไล่ออก" / "เกษียณอายุ". Shows full financial settlement table with receipts, deductions, and net.

---

### 13G — Salary Certificate Requests

#### POST /personnel/me/salary-cert-requests
- **Purpose**: Employee submits a salary certificate request.
- **Auth**: Any authenticated employee
- **Request**:
  ```json
  {
    "copies_count": 2,
    "purpose_type": "loan_self",
    "loan_bank": "ธนาคารออมสิน",
    "loan_branch_name": "สาขาสุรินทร์",
    "loan_purpose": "ปลูกสร้างบ้าน",
    "loan_amount": "500000.00"
  }
  ```
- **Response (201)**: `{ "status": "created", "id": 12 }`
- **Errors**: `422` if `purpose_type` is not one of the three allowed values

#### GET /personnel/me/salary-cert-requests
- **Purpose**: Employee views own request history.
- **Auth**: Any authenticated employee
- **Response (200)**:
  ```json
  [
    {
      "id": 12,
      "requested_at": "2026-04-03",
      "copies_count": 2,
      "purpose_type": "loan_self",
      "purpose_detail": null,
      "recipient_name": null,
      "loan_bank": "ธนาคารออมสิน",
      "loan_branch_name": "สาขาสุรินทร์",
      "loan_purpose": "ปลูกสร้างบ้าน",
      "loan_amount": "500000.00",
      "guarantor_for_name": null,
      "status": "pending",
      "supervisor_comment": null,
      "created_at": "2026-04-03T14:22:01.000Z"
    }
  ]
  ```

#### GET /hr/salary-cert-requests
- **Purpose**: HR lists all requests, filterable by status and branch.
- **Auth**: Roles 1 or 3
- **Query params**: `status` (optional), `branch_id` (optional, integer)
- **Response (200)**:
  ```json
  [
    {
      "id": 12,
      "user_id": 301,
      "user_name": "สมชาย ใจดี",
      "branch_name": "สาขาสุรินทร์",
      "requested_at": "2026-04-03",
      "copies_count": 2,
      "purpose_type": "loan_self",
      "status": "pending",
      "supervisor_comment": null,
      "approved_at": null,
      "created_at": "2026-04-03T14:22:01.000Z"
    }
  ]
  ```

#### PATCH /hr/salary-cert-requests/{req_id}/approve
- **Purpose**: Approve a pending request.
- **Auth**: Roles 1 or 3
- **Request** (optional body):
  ```json
  { "comment": "อนุมัติแล้ว" }
  ```
- **Response (200)**: `{ "status": "ok" }`
- **Errors**: `404` not found, `400` not in pending status

#### PATCH /hr/salary-cert-requests/{req_id}/deny
- **Purpose**: Deny a pending request. Comment is required.
- **Auth**: Roles 1 or 3
- **Request**:
  ```json
  { "comment": "เอกสารไม่ครบ กรุณายื่นใหม่" }
  ```
- **Response (200)**: `{ "status": "ok" }`
- **Errors**: `422` if comment is empty/missing, `404` not found, `400` not in pending status

#### GET /hr/salary-cert-requests/{req_id}/certificate-pdf
- **Purpose**: Generate the official salary certificate letter (หนังสือรับรองเงินเดือน).
- **Auth**: Roles 1 or 3
- **Response**: `application/pdf`
- **Errors**: `404` not found, `400` if status is not `"approved"` — do not show this button until approved.

#### GET /hr/salary-cert-requests/{req_id}/request-form-pdf
- **Purpose**: Generate a copy of the filled-in request form for HR records.
- **Auth**: Roles 1 or 3
- **Response**: `application/pdf`
- **Errors**: `404` not found

---

### 13F — Extended Relocation Request Form

#### PUT /personnel/me/relocation *(extended)*
- **Purpose**: Submit a relocation request. Now accepts family details and position preferences in addition to branch preferences.
- **Auth**: Any authenticated employee
- **Request** (all new fields optional, backwards-compatible):
  ```json
  {
    "branch_pref_1": 3,
    "branch_pref_2": 5,
    "branch_pref_3": null,
    "branch_pref_4": null,
    "branch_pref_5": null,
    "reason": "ใกล้บ้าน",
    "reason_2": "ดูแลผู้ป่วย",
    "reason_3": null,
    "family_address": "123 ถนนสุรินทร์",
    "family_father_status": "deceased",
    "family_father_occupation": null,
    "family_father_province": null,
    "family_mother_status": "alive",
    "family_mother_occupation": "เกษตรกร",
    "family_mother_province": "สุรินทร์",
    "family_spouse_status": "alive",
    "family_spouse_occupation": "ครู",
    "family_spouse_province": "สุรินทร์",
    "children_count": 2,
    "children_with_self": 2,
    "children_with_spouse": 0,
    "children_with_relatives_province": null,
    "siblings_total": 3,
    "siblings_deceased": 0,
    "position_pref_1": 12,
    "position_pref_2": 7,
    "position_pref_3": null,
    "position_pref_4": null,
    "position_pref_5": null
  }
  ```
- **Response (201)**: `{ "status": "created", "id": 45 }`
- **Notes**: `branch_pref_1` is still required. All new fields are optional and can be omitted.

#### GET /personnel/me/relocations/{relo_id} *(new)*
- **Purpose**: Employee fetches a specific own relocation request by ID (for pre-populating a re-submission or view).
- **Auth**: Any authenticated employee
- **Response (200)**: Same shape as the items in `GET /personnel/me/relocations` — includes all extended fields.
- **Errors**: `404` if not found or belongs to another user

#### GET /hr/relocation-requests/{relo_id} *(new)*
- **Purpose**: HR fetches full detail of a single relocation request including family data.
- **Auth**: Roles 1 or 3
- **Response (200)**: Full `RelocationRequestOut` including all extended fields plus `user_first_name`, `user_last_name`, approval step fields.
- **Errors**: `404` not found

#### GET /hr/relocation-requests/{relo_id}/form-pdf *(new)*
- **Purpose**: Generate the formal relocation request form PDF (หนังสือแจ้งความประสงค์ขอย้าย).
- **Auth**: Roles 1 or 3
- **Response**: `application/pdf`
- **Notes**: PDF includes auto-filled employee info, last 3 relocation history entries, education, 5 branch prefs, 5 position prefs, all reasons, full family section, and manager approval section if request is approved.

---

### 13B — Org-wide Relocation History

#### GET /hr/reports/relocation-history
- **Purpose**: List all completed transfers (from `relocationdata`) with optional filters.
- **Auth**: Roles 1 or 3
- **Query params**: `from_date` (YYYY-MM-DD), `to_date` (YYYY-MM-DD), `branch_id` (int, filters by destination branch), `user_id` (int)
- **Response (200)**:
  ```json
  [
    {
      "id": 18,
      "user_id": 301,
      "full_name": "สมชาย ใจดี",
      "cid_masked": "XXXXXXXXX1234",
      "hired_date": "01/04/2558",
      "transfer_date": "01/04/2568",
      "position_title": "เจ้าหน้าที่สินเชื่อ",
      "branch_name": "สาขาสุรินทร์",
      "order_reference": "คำสั่งที่ 14/2543",
      "reason": "ขอย้ายเพื่อดูแลครอบครัว"
    }
  ]
  ```
- **Notes**: `hired_date` and `transfer_date` are pre-formatted as `DD/MM/BBBB` Thai BE strings (not ISO). `cid_masked` shows only the last 4 digits. `order_reference` may be `null` if not recorded.

#### GET /hr/reports/relocation-history-pdf
- **Purpose**: Download relocation history as a printable PDF table.
- **Auth**: Roles 1 or 3
- **Query params**: `from_date`, `to_date` (both optional)
- **Response**: `application/pdf`

---

### 13C — Leave Register

#### GET /hr/leave/annual-summary
- **Purpose**: Return all active employees' approved leave days by type for a fiscal year (ทะเบียนคุมการลา).
- **Auth**: Roles 1 or 3
- **Query params**: `fiscal_year` (Thai BE int, defaults to current FY), `branch_id` (optional)
- **Response (200)**:
  ```json
  [
    {
      "user_id": 301,
      "full_name": "สมชาย ใจดี",
      "legacy_user_id": "690701234",
      "position_title": "เจ้าหน้าที่สินเชื่อ",
      "branch_name": "สาขาสุรินทร์",
      "sick_leave_days": 3,
      "business_leave_days": 1,
      "annual_leave_days": 5,
      "maternity_leave_days": 0,
      "paternity_leave_days": 0,
      "religious_leave_days": 0,
      "military_leave_days": 0,
      "training_leave_days": 0,
      "ow_leave_days": 0,
      "accompany_leave_days": 0,
      "rehab_leave_days": 0,
      "absent_days": 0,
      "total_days": 9
    }
  ]
  ```
- **Notes**: Only counts **approved** leave with `from_date` in the fiscal year window (Apr 1 → Mar 31). Days are integers.

#### GET /hr/leave/annual-summary-pdf
- **Purpose**: Tabular PDF version of the annual summary (ทะเบียนคุมการลาประจำปีบัญชี).
- **Auth**: Roles 1 or 3
- **Query params**: same as above
- **Response**: `application/pdf`

#### GET /hr/leave/register-pdf
- **Purpose**: Detailed per-employee leave register PDF (ฟอร์มทะเบียนการลาปีบัญชี) — one card per employee showing quota breakdown and a monthly calendar grid marking each day leave was taken.
- **Auth**: Roles 1 or 3
- **Query params**: `fiscal_year`, `branch_id`
- **Response**: `application/pdf`
- **Notes**: This PDF is large if many employees. Initiate as a download (not inline). One page per employee; 12-month grid April→March.

---

### 13D — Resigned/Retired Staff

#### GET /hr/reports/resigned-retired
- **Purpose**: List all inactive employees with exit details.
- **Auth**: Roles 1 or 3
- **Query params**: `exit_type` (`resign` / `dismiss` / `retire`, optional), `branch_id` (optional), `from_date` (optional), `to_date` (optional, applied to exit date)
- **Response (200)**:
  ```json
  [
    {
      "user_id": 301,
      "full_name": "สมชาย ใจดี",
      "legacy_user_id": "690701234",
      "hired_date": "01/04/2558",
      "exit_date": "01/04/2568",
      "exit_type": "resign",
      "position_title": "เจ้าหน้าที่สินเชื่อ",
      "branch_name": "สาขาสุรินทร์",
      "cid_masked": "XXXXXXXXX1234",
      "birthday": "15/06/2510",
      "education_level": "ปริญญาตรี"
    }
  ]
  ```
- **Notes**:
  - `exit_type` may be `null` for employees deactivated before the termination record system existed.
  - When `exit_type` filter is applied, only employees **with a matching TerminationRecord** are returned — employees deactivated via legacy path are excluded from typed filter results.
  - `exit_date` falls back to `personeldata.termination_date` if no `TerminationRecord` row exists.
  - All date fields are Thai BE formatted strings (`DD/MM/BBBB`), not ISO.

#### GET /hr/reports/resigned-retired-pdf
- **Purpose**: Printable PDF version of the resigned/retired list.
- **Auth**: Roles 1 or 3
- **Query params**: same as above
- **Response**: `application/pdf`

---

## Data Models / DTOs

```typescript
// Termination Record (GET response)
interface TerminationRecordOut {
  id: number | null;                    // null = pre-fill preview, not saved yet
  exit_type: 'resign' | 'dismiss' | 'retire' | null;
  exit_date: string | null;             // YYYY-MM-DD
  committee_set_no: number | null;
  committee_meeting_no: number | null;
  committee_meeting_date: string | null; // YYYY-MM-DD
  tenure_years: number | null;
  tenure_days: number | null;
  total_leave_days: string | null;      // Decimal as string e.g. "45.0"
  total_annual_leave_days: string | null;
  last_salary: string | null;           // Decimal as string e.g. "28500.00"
  severance_pay: string | null;
  accumulated_fund: string | null;
  work_guarantee_bond: string | null;
  loan_outstanding: string | null;
  loan_interest_estimate: string | null;
  bank_guarantee_ref: string | null;
  bank_guarantee_date: string | null;   // YYYY-MM-DD
  bank_guarantee_amount: string | null;
  created_at: string | null;            // ISO 8601 datetime
}

// Salary Certificate Request (employee view)
interface SalaryCertRequestOut {
  id: number;
  requested_at: string;          // YYYY-MM-DD
  copies_count: number;
  purpose_type: 'document' | 'loan_self' | 'loan_guarantee';
  purpose_detail: string | null;
  recipient_name: string | null;
  loan_bank: string | null;
  loan_branch_name: string | null;
  loan_purpose: string | null;
  loan_amount: string | null;    // Decimal as string
  guarantor_for_name: string | null;
  status: 'pending' | 'approved' | 'denied';
  supervisor_comment: string | null;
  created_at: string;            // ISO 8601
}

// Salary Certificate Request (HR view)
interface SalaryCertRequestHROut {
  id: number;
  user_id: number;
  user_name: string;
  branch_name: string;
  requested_at: string;          // YYYY-MM-DD
  copies_count: number;
  purpose_type: 'document' | 'loan_self' | 'loan_guarantee';
  status: 'pending' | 'approved' | 'denied';
  supervisor_comment: string | null;
  approved_at: string | null;    // ISO 8601 datetime
  created_at: string;
}

// Leave Annual Summary Row
interface LeaveAnnualSummaryRow {
  user_id: number;
  full_name: string;
  legacy_user_id: string | null;
  position_title: string | null;
  branch_name: string;
  sick_leave_days: number;
  business_leave_days: number;
  annual_leave_days: number;
  maternity_leave_days: number;
  paternity_leave_days: number;
  religious_leave_days: number;
  military_leave_days: number;
  training_leave_days: number;
  ow_leave_days: number;
  accompany_leave_days: number;
  rehab_leave_days: number;
  absent_days: number;
  total_days: number;
}

// Relocation History Row
interface RelocationHistoryRow {
  id: number;
  user_id: number;
  full_name: string;
  cid_masked: string;            // e.g. "XXXXXXXXX1234"
  hired_date: string;            // Thai BE formatted "DD/MM/BBBB"
  transfer_date: string;         // Thai BE formatted
  position_title: string | null;
  branch_name: string;
  order_reference: string | null;
  reason: string | null;
}

// Resigned/Retired Row
interface ResignedRetiredRow {
  user_id: number;
  full_name: string;
  legacy_user_id: string | null;
  hired_date: string;            // Thai BE formatted
  exit_date: string | null;      // Thai BE formatted
  exit_type: 'resign' | 'dismiss' | 'retire' | null;
  position_title: string | null;
  branch_name: string;
  cid_masked: string;
  birthday: string | null;       // Thai BE formatted
  education_level: string | null;
}
```

---

## Enums & Constants

### exit_type
| Value | Thai Label | Used in |
|-------|-----------|---------|
| `resign` | ลาออก | Termination record, resigned/retired list |
| `dismiss` | ไล่ออก | Termination record, resigned/retired list |
| `retire` | เกษียณอายุ | Termination record, resigned/retired list |

### purpose_type (salary certificate)
| Value | Thai Label | Required conditional fields |
|-------|-----------|---------------------------|
| `document` | เพื่อใช้เป็นหลักฐาน | `purpose_detail`, `recipient_name` |
| `loan_self` | เพื่อกู้เงิน | `loan_bank`, `loan_branch_name`, `loan_purpose`, `loan_amount` |
| `loan_guarantee` | เพื่อค้ำประกันเงินกู้ | `guarantor_for_name`, `loan_bank`, `loan_branch_name`, `loan_purpose`, `loan_amount` |

### salary cert status
| Value | Meaning |
|-------|---------|
| `pending` | Awaiting HR/manager review |
| `approved` | Approved — certificate PDF is available |
| `denied` | Denied — `supervisor_comment` contains reason |

### family_*_status
| Value | Meaning |
|-------|---------|
| `alive` | Still living |
| `deceased` | Deceased |
| `null` | Not provided |

---

## Validation Rules

**Termination Record (POST)**
- `exit_type`: required, must be `resign`, `dismiss`, or `retire`
- `exit_date`: required, format `YYYY-MM-DD`
- Cannot POST if employee is already inactive — check this before opening the form (GET the employee profile and check `is_active`)
- Cannot POST if a record already exists (GET will return a non-null `id`) — show PATCH form instead

**Salary Certificate (POST)**
- `copies_count`: integer ≥ 1, defaults to 1
- `purpose_type`: required, one of the three enum values — use radio buttons
- Show/hide conditional sub-fields based on `purpose_type` selection (see Enums table above)

**Deny salary cert (PATCH)**
- `comment` is required and must not be blank — validate client-side before submitting

**Relocation Request (PUT)**
- `branch_pref_1` is required
- All other fields optional
- `family_father_status` / `family_mother_status` / `family_spouse_status`: if provided, should be `"alive"` or `"deceased"`

---

## Business Logic & Edge Cases

- **Termination is a one-way door**: Once POST succeeds, the employee is inactive and cannot log in. Do not call this speculatively. Use GET first to confirm the employee is still active (`id` is null in pre-fill, user still visible in employee list).
- **GET pre-fill vs. saved record**: Distinguish by checking `id`. If `null` — pre-fill, show the form. If a number — record saved, show edit form or read-only view with PATCH option.
- **Termination PDF variant**: The PDF title line changes based on `exit_type` (`ลาออก` / `ไล่ออก` / `เกษียณอายุ`). No extra param needed — it reads from the record.
- **Salary cert PDF gating**: `GET /certificate-pdf` returns 400 if status is not `approved`. Gate the "Download Certificate" button on `status === "approved"`.
- **Relocation history dates are Thai BE strings**: `hired_date`, `transfer_date`, etc. are already formatted as `DD/MM/BBBB`. Do not parse them as ISO dates — display as-is.
- **Resigned/retired exit_type filter is strict**: If `exit_type=resign` is passed, only employees with a `TerminationRecord` row with `exit_type="resign"` appear. Employees deactivated manually (no record) are excluded when a filter is applied. When no filter is passed, all inactive employees appear.
- **Leave register PDF is per-employee, one page per card**: Can be large (>50 pages for a big branch). Offer as a download link, not inline preview.
- **Fiscal year param**: All leave/report endpoints accept `fiscal_year` as Thai BE integer (e.g. `2568`). Defaults to the current fiscal year if omitted. The fiscal year cuts over on April 1.
- **`legacy_user_id`**: The client's old employee ID system. May be null. Display it as a secondary identifier if present.

---

## Integration Notes

- **Recommended flow — Termination**:
  1. HR opens employee detail → clicks "ออกจากงาน"
  2. Call `GET /hr/employees/{id}/termination-record` → if `id` is null, show pre-fill form with computed read-only fields; if `id` exists, show edit/read-only view
  3. HR fills in exit details → `POST` (or `PATCH` if editing)
  4. Offer "Download PDF" button → `GET .../pdf`

- **Recommended flow — Salary Cert**:
  1. Employee opens "ขอหนังสือรับรองเงินเดือน" form
  2. Select `purpose_type` via radio → show/hide conditional fields
  3. Submit → `POST /personnel/me/salary-cert-requests`
  4. Employee can track status via `GET /personnel/me/salary-cert-requests`
  5. HR sees pending list via `GET /hr/salary-cert-requests?status=pending`
  6. HR approves/denies → reveal PDF download buttons when `status === "approved"`

- **Optimistic UI**: Not safe for termination (destructive, irreversible). Safe for salary cert request submission (employee-facing, low risk).

- **PDF downloads**: Trigger via `window.open(url)` or an anchor with `download` attribute. All PDFs stream as `application/pdf` with `Content-Disposition: attachment`.

- **Caching**: Do not cache termination record responses — the pre-fill state changes as soon as a record is saved. Salary cert lists should invalidate after approve/deny.

---

## Test Scenarios

1. **Termination happy path**: GET pre-fill (id=null) → fill form → POST → response 201 → GET again (id is now a number) → GET PDF downloads successfully.
2. **Terminate already-inactive employee**: GET employee; they are inactive → POST → expect 409 "Employee is already terminated". Block form submission if employee is already inactive.
3. **Termination record already exists**: POST when GET already returns a real id → 409 "Termination record already exists". Show PATCH form instead.
4. **Salary cert — wrong purpose_type**: Submit with `purpose_type: "bank_loan"` → 422. Frontend should prevent this with a controlled radio group.
5. **Deny without comment**: PATCH deny with `comment: ""` → 422. Show inline error.
6. **Download certificate before approval**: `GET /certificate-pdf` with status pending → 400. Button should be hidden/disabled until status is `"approved"`.
7. **Relocation form — all fields**: Submit with family + position prefs → 201. GET the same relo_id → all fields echo back correctly.
8. **Relocation history — no filters**: `GET /hr/reports/relocation-history` → returns all transfers, newest first.
9. **Resigned list — exit_type filter**: `GET /hr/reports/resigned-retired?exit_type=resign` → only employees with a TerminationRecord of type "resign". Employee deactivated via old path does NOT appear.
10. **Leave annual summary — empty branch**: `GET /hr/leave/annual-summary?branch_id=999` (non-existent branch) → returns empty array `[]`, not 404.

---

## Open Questions / TODOs

- **Salary cert — employee notification**: Currently no automatic notification is sent on approve/deny. HR is expected to contact the employee directly. If LINE/email notification is later required, a new endpoint or hook will be added.
- **Relocation PDF — position pref names**: The PDF resolves position IDs to titles server-side. Frontend does not need to resolve them.
- **Leave register PDF performance**: If an org-wide (no branch filter) register is requested for hundreds of employees, generation may take several seconds. Consider a loading indicator or async download pattern if this becomes a UX issue.
