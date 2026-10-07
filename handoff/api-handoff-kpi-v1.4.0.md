# API Handoff: KPI Evaluation & Salary Step Rules (3L / 3D) — v1.4.0

## Business Context
Once a year AMC scores every employee out of 100. The score decides how many salary steps (ขั้นเงินเดือน) the person moves up on the salary scale (บัญชีเงินเดือน). AMC confirmed the rules on 2026-10-06, and they are live on prod as **v1.4.0**:
- **Steps by score:** 90+ → 1.5 steps · 80–89 → 1.0 · 50–79 → 0.5 · below 50 → 0. This applies to all staff.
- **Evaluation window (ช่วงประเมิน):** scores are entered between 1 March and 10 April.
- **Review chain:** after the window closes, HR finalizes the results. The assistant manager (ผช.ผจก.) reviews everyone, then the manager (ผจก.) gives the final approval. **Only that final approval changes anyone's salary**, effective 1 April.
- **The 90+ group (ขั้นพิเศษ):** they get +1.0 in April and the extra **+0.5 is held** (pending) until the previous fiscal year's accounts close, up to about 3 months later.
  - If the cooperative made a **profit**, the 0.5 is applied from that month, and the money missed for the earlier months is paid once as back pay (เงินตกเบิก) in that month's payroll.
  - If it made a **loss**, the 0.5 is cancelled.
- **Eligibility (ระเบียบ 2561):** someone who didn't work the full fiscal year, or took more than 30 days' leave, gets no raise. Reviewers can override this either way with a reason, for example for discipline or a long illness.

Domain terms: **step / level** = position on the salary ladder, e.g. `5.5`. **Tier / band** = ladder column, 9 bands. **Fiscal year (`fiscal_year`)** = a Thai BE integer such as `2569`, see Open Questions.

## Roles (from JWT / `userdata.role_id`)
| role_id | Who | KPI permissions |
|---|---|---|
| 1 | Super admin | everything |
| 2 | ผู้จัดการ (manager) | manager score, branch KPI, board score, **final approval**, profit result, window, reopen, eligibility override |
| 3 | HR | monthly KPI, **finalize**, window, view |
| 6 | Branch head | branch-head score, only when their position title starts with "หัวหน้า" and the employee is in the same branch |
| 7 | ผช.ผจก. (assistant manager) | asst-manager score, **first review**, reopen, eligibility override, view |

All endpoints need `Authorization: Bearer <token>`. Errors use FastAPI's shape `{"detail": "<Thai message>"}`. Show `detail` to the user as it is, because messages are already in Thai.

## Status Lifecycle (per employee per fiscal year)

```
open ──(scores entered in window)──► open
open/returned ──finalize (HR, after window)──► finalized
finalized ──asst-review (role 7)──► asst_reviewed
asst_reviewed ──manager-approve (role 2)──► approved      ← salary changes here
finalized/asst_reviewed ──reopen (2/7)──► returned         ← scores editable again, outside the window too
```

Held half-step (`pending_status`, only for 90+): `null` → `pending` (at approval) → `confirmed` (profit) or `cancelled` (loss).

---

## Endpoints

### Scoring (unchanged shapes, new window rule)

#### PUT /hr/kpi/evaluations/{employee_id}/branch-head-score
- **Purpose**: Branch head's individual score (0–42).
- **Auth**: role 1, or a branch head (title starts with "หัวหน้า") in the same branch.
- **Request**: `{ "fiscal_year": 2569, "score": 40 }`
- **Response**: `KpiEvaluation`
- **Errors**: 409 `อยู่นอกช่วงเวลาประเมิน (YYYY-MM-DD ถึง YYYY-MM-DD)` when outside the window · 409 `การประเมินสรุปผลแล้ว ไม่สามารถแก้ไขได้` when status is not `open`/`returned` · 422 when the score is out of range · 403 when it's another branch or the user isn't a head.

#### PUT /hr/kpi/evaluations/{employee_id}/asst-manager-score
- **Purpose**: Assistant manager's score (0–20). **Auth**: roles 1, 2, **7** (role 7 is new here). Request and errors are the same as above.

#### PUT /hr/kpi/evaluations/{employee_id}/manager-score
- **Purpose**: Manager's score (0–10). **Auth**: roles 1, 2. Request and errors are the same as above.

#### PUT /hr/kpi/evaluations/{employee_id}/board-score
- **Purpose**: All three components at once, for senior staff. **Auth**: roles 1, 2.
- **Request**: `{ "fiscal_year": 2569, "branch_head_score": 40, "asst_manager_score": 18, "manager_score": 9 }`

> The **branch component (max 28)** is filled automatically from `POST /hr/kpi/branch` (total out of 100 × 0.28) the first time any score is saved. Enter branch KPI **before** individual scores, otherwise finalize fails with "ยังขาดข้อมูล: branch_score_component".

#### POST /hr/kpi/monthly, POST /hr/kpi/branch
- Request and response are unchanged. **New:** both return 409 `ปิดรับข้อมูลแล้ว — ช่วงเวลาประเมินสิ้นสุด YYYY-MM-DD` after the window end. They are open all year until then.

---

### Finalize (HR)

#### POST /hr/kpi/evaluations/{employee_id}/finalize?fiscal_year=2569
- **Purpose**: Compute the composite score, the step and eligibility for one person. **Does not change salary.**
- **Auth**: roles 1, 3.
- **Response**:
  ```json
  {
    "status": "finalized",
    "composite_score": 95.0,
    "step_awarded": 1.5,
    "step_immediate": 1.0,
    "step_pending": 0.5,
    "eligible": true,
    "ineligible_reasons": null
  }
  ```
- **Errors**: 409 `ยังไม่สิ้นสุดช่วงเวลาประเมิน (...)` while the window is still open · 404 when there's no evaluation · 409 when it's already finalized or later · 422 `ยังขาดข้อมูล: ...` listing the missing components.
- **Notes**: ⚠️ **Breaking change.** The response no longer contains `salary_step`, and nothing on the salary side changes here.

#### POST /hr/kpi/fiscal-years/{fiscal_year}/finalize-all
- **Purpose**: Finalize every complete `open`/`returned` evaluation of the year.
- **Auth**: roles 1, 3.
- **Response**:
  ```json
  { "finalized": [101, 102], "skipped": [{ "user_id": 103, "reason": "ยังขาดข้อมูล: manager_score" }] }
  ```
- **Errors**: 409 while the window is open.

---

### Review

#### POST /hr/kpi/fiscal-years/{fiscal_year}/asst-review
- **Purpose**: ผช.ผจก. marks finalized results as checked. This is the first check.
- **Auth**: roles 1, **7**.
- **Request**: `{ "user_ids": [101, 102] | null, "comment": "string | null" }`. Use `null` or omit `user_ids` to review everyone in `finalized`.
- **Response**: `{ "reviewed": [101, 102] }`
- **Notes**: Only rows in `finalized` are affected. Other rows are silently ignored, so an empty list is not an error.

#### POST /hr/kpi/fiscal-years/{fiscal_year}/manager-approve
- **Purpose**: ผจก. final approval. **Applies the step and moves the salary.**
- **Auth**: roles 1, 2.
- **Request**:
  ```json
  { "user_ids": null, "comment": "string | null", "board_reference": "มติ คกก. ชุดที่ 35 ครั้งที่ 10 | null" }
  ```
- **Response**:
  ```json
  {
    "approved": [
      { "user_id": 101, "eligible": true, "level_before": 5.0, "level_after": 6.0, "step_pending": 0.5 }
    ],
    "skipped": [
      { "user_id": 120, "reason": "ตำแหน่งผู้ช่วยผู้จัดการ/ผู้จัดการ ต้องระบุมติคณะกรรมการ (board_reference)" },
      { "user_id": 130, "reason": "ไม่สามารถกำหนดขั้นสูงสุดได้: ตำแหน่งของพนักงานยังไม่ได้ผูกกับระดับ ..." }
    ]
  }
  ```
- **Notes**:
  - Only rows in `asst_reviewed` are approved. If the manager approves before the assistant manager has reviewed, nothing happens: `approved: []`.
  - **Assistant manager and manager positions** are skipped unless `board_reference` is given, because the regulation reserves their raise for the board. Approve them in a separate call with the reference.
  - Someone whose position has no band (tier) is skipped. HR must fix their position, then call this again.
  - Ineligible people are approved with no change, so `level_before == level_after`.
  - **The band top caps the step.** Someone near the top may get less than the table step, and their pending part may be 0.
  - If the profit result has **already** been recorded for the year, the held 0.5 is settled during this same call.

#### POST /hr/kpi/evaluations/{employee_id}/reopen
- **Purpose**: Send one evaluation back for correction.
- **Auth**: roles 1, 2, 7.
- **Request**: `{ "fiscal_year": 2569, "comment": "คะแนนหัวหน้าสาขาผิด" }` (comment required)
- **Response**: `KpiEvaluation` with `status: "returned"`
- **Errors**: 409 unless the status is `finalized` or `asst_reviewed`. Approved evaluations can't be reopened · 422 when the comment is empty.
- **Notes**: A `returned` evaluation accepts score edits **outside the window**. It must then be finalized and reviewed again. The previous assistant-manager review is cleared.

#### PATCH /hr/kpi/evaluations/{employee_id}/eligibility
- **Purpose**: A reviewer sets eligibility by hand.
- **Auth**: roles 1, 2, 7.
- **Request**: `{ "fiscal_year": 2569, "eligible": false, "note": "ถูกลงโทษพักงาน" }` (note required)
- **Response**: `KpiEvaluation` with `eligibility_overridden: true`
- **Errors**: 409 unless the status is `finalized` or `asst_reviewed` · 422 when the note is empty.
- **Notes**: Use it when:
  - **Blocking a raise:** discipline above ภาคทัณฑ์ (not recorded in the system yet).
  - **Allowing a flagged person:** long illness of 60 days or less, or a work-accident sick leave. The system counts sick leave and can't tell these cases apart.
  - **Correcting a wrong flag.**

  The override survives a re-finalize.

---

### Fiscal-year settings

#### GET /hr/kpi/fiscal-years/{fiscal_year}
- **Purpose**: Window, profit result, and progress counts for a dashboard.
- **Auth**: roles 1, 2, 3, 7.
- **Response**:
  ```json
  {
    "fiscal_year": 2569,
    "window_start": "2027-03-01",
    "window_end": "2027-04-10",
    "window_is_default": true,
    "profit_result": null,
    "profit_reference": null,
    "settlement_month": null,
    "profit_recorded_by": null,
    "profit_recorded_at": null,
    "counts": { "open": 120, "finalized": 3, "asst_reviewed": 0, "approved": 0, "pending_half_steps": 0 }
  }
  ```
- **Notes**: A status key appears in `counts` only when it has at least one row. `pending_half_steps` is always present.

#### PATCH /hr/kpi/fiscal-years/{fiscal_year}/window
- **Purpose**: Move the window. The default is 1 Mar to 10 Apr of the year the fiscal year ends in.
- **Auth**: roles 1, 2, 3.
- **Request**: `{ "window_start": "2026-10-01", "window_end": "2026-10-31" }`
- **Response**: same as GET.
- **Errors**: 422 when the end is before the start.
- **Notes**: Also used for **demos and testing**, since the real window is months away.

#### POST /hr/kpi/fiscal-years/{fiscal_year}/profit-result
- **Purpose**: Record whether the previous fiscal year made a profit, once the accounts close. This releases or cancels every held 0.5 of that year.
- **Auth**: roles 1, 2.
- **Request**:
  ```json
  { "is_profit": true, "reference": "มติ คกก. ชุดที่ 35 ครั้งที่ 12", "settlement_month": "2027-07-01" }
  ```
  `settlement_month` is the payroll month the result takes effect. Any day is accepted and is normalised to the 1st of the month.
- **Response**:
  ```json
  {
    "profit_result": "profit",
    "settled": [
      { "user_id": 101, "pending_status": "confirmed", "level_after": 6.5,
        "back_pay_amount": 3000.0, "back_pay_month": "2027-07-01" }
    ],
    "skipped": []
  }
  ```
- **Errors**:
  - 422 when `reference` is empty.
  - 422 when `settlement_month` is before April after the fiscal year ends.
  - 409 `บันทึกผลประกอบการของปีนี้แล้ว (profit) — แก้ไขไม่ได้` when called with the **opposite** result.
- **Notes**:
  - **This action can't be undone.** Show a confirmation dialog that names the result and the month.
  - Calling again with the **same** result is safe. It retries anyone skipped the first time and changes nothing else.
  - Back pay = (new monthly salary − old monthly salary) × the months from April up to the settlement month. For example, a settlement in July gives 3 months (Apr, May, Jun).
  - If approval happens after the settlement month, back pay goes into the current month instead.

---

### Views

#### GET /hr/kpi/evaluations?fiscal_year=2569&branch_id=&status=
- **Auth**: roles 1, 2, 3, **7** (2 and 7 are new). Returns `KpiEvaluation[]` sorted by `user_id`.
- Use `status=finalized` for the assistant manager's queue and `status=asst_reviewed` for the manager's queue.

#### GET /hr/kpi/evaluations/{employee_id}?fiscal_year=2569
- **Auth**: roles 1, 2, 3, 7. Returns one `KpiEvaluation`, or 404.

### Related changes outside KPI

#### POST /hr/employees/{employee_id}/salary-step-award (manual)
- The request is unchanged. The response adds `old_salary`, `new_salary` and `salary_note`. **The salary now moves to the ladder amount** for the new level. Before, only the level changed.

#### Payroll records / payslip
- `PayrollRecord` gains `add_back_pay` (number). It's included in `final_payout`.
- The payslip PDF shows "เงินเลื่อนขั้นพิเศษตกเบิก" when it's above 0.

---

## Data Models / DTOs

```typescript
type KpiStatus = 'open' | 'returned' | 'finalized' | 'asst_reviewed' | 'approved';
type PendingStatus = 'pending' | 'confirmed' | 'cancelled' | null;

interface KpiEvaluation {
  id: number;
  user_id: number;
  fiscal_year: number;                 // Thai BE
  branch_head_score: number | null;    // 0–42
  branch_score_component: number | null; // 0–28, auto from branch KPI
  asst_manager_score: number | null;   // 0–20
  manager_score: number | null;        // 0–10
  composite_score: number | null;      // 0–100, set at finalize
  step_awarded: number | null;         // table step: 0 | 0.5 | 1.0 | 1.5
  status: KpiStatus;
  branch_head_evaluator_id: number | null;
  asst_manager_evaluator_id: number | null;
  manager_evaluator_id: number | null;
  board_evaluator_id: number | null;
  created_at: string | null;           // ISO 8601

  // v1.4.0
  step_immediate: number | null;       // part applied in April (after band cap, once approved)
  step_pending: number | null;         // held part (0 or 0.5, after band cap)
  pending_status: PendingStatus;
  eligible: boolean | null;            // null until finalize
  ineligible_reasons: string | null;   // Thai, '; '-separated
  eligibility_overridden: boolean | null;
  eligibility_note: string | null;
  asst_reviewed_by: number | null;
  asst_reviewed_at: string | null;
  manager_approved_by: number | null;
  manager_approved_at: string | null;
  review_comment: string | null;       // last reopen / review / approval comment
  board_reference: string | null;      // only for ผช.ผจก./ผจก.
  level_before: number | null;         // salary level at approval
  level_after: number | null;          // after approval; updated again when the 0.5 is confirmed
  back_pay_amount: number | null;      // THB, set when pending is confirmed
  back_pay_month: string | null;       // 'YYYY-MM-01', payroll month it is paid in
}
```

Numbers arrive as JSON numbers or numeric strings, because of Decimal serialisation. Parse defensively.

## Enums & Constants

| `status` | Meaning | Display Label (TH) |
|---|---|---|
| `open` | Scores being entered | กำลังประเมิน |
| `returned` | Sent back for correction | ส่งกลับแก้ไข |
| `finalized` | Computed, waiting for ผช.ผจก. | รอผู้ช่วยผู้จัดการตรวจสอบ |
| `asst_reviewed` | Waiting for ผจก. | รอผู้จัดการอนุมัติ |
| `approved` | Step applied | อนุมัติแล้ว |

| `pending_status` | Meaning | Display Label (TH) |
|---|---|---|
| `null` | Nothing held | — |
| `pending` | 0.5 held until profit result | รอผลประกอบการ (+0.5 ขั้น) |
| `confirmed` | 0.5 applied + back pay | ได้รับ +0.5 ขั้นแล้ว |
| `cancelled` | No profit, 0.5 dropped | ไม่ได้รับ (ขาดทุน) |

| Score | Steps | Paid when |
|---|---|---|
| ≥ 90 | 1.5 | 1.0 in April, 0.5 after the profit result |
| 80–89.99 | 1.0 | April |
| 50–79.99 | 0.5 | April |
| < 50 | 0 | — |

## Validation Rules
- Score ranges: branch head 0–42, asst manager 0–20, manager 0–10. Branch KPI components: 10/10/40/10/20/10.
- Scores are allowed only when today is within `[window_start, window_end]` or the status is `returned`. Use `GET /hr/kpi/fiscal-years/{fy}` to disable the inputs and show the window dates.
- Finalize is allowed only when today is after `window_end`.
- `reopen.comment`, `eligibility.note` and `profit-result.reference` are required and can't be empty.
- `window_end` must not be before `window_start`.
- `settlement_month` must be no earlier than April after the fiscal year ends.

## Business Logic & Edge Cases
- **Nothing changes salary before `manager-approve`.** Finalize and the assistant manager's review are just checks.
- **Ineligible people** still go through the whole chain. At approval they get 0 steps. Show `ineligible_reasons` prominently on both review screens, with an override button.
- **Excused leave:** ordination up to 120 days, maternity up to 98 days, annual leave, comp leave and sterilisation don't count toward the 30 days. **Sick leave counts**, and reviewers clear long-illness cases by override.
- **Joined mid-year:** anyone hired after the fiscal year started is ineligible: "ทำงานไม่ครบปีบัญชี".
- **Salary never goes down.** If someone is already paid above their ladder cell, their salary stays the same. The manual award response explains this in `salary_note`.
- **Back pay is paid once.** Payroll picks it up only when generating `back_pay_month`. Regenerating another month won't include it.
- **One evaluation per person per year.**
- A branch head can only score staff in their own branch.

## Integration Notes
- **Recommended flow:**
  1. **HR or the manager** enters branch KPI (`POST /hr/kpi/branch`). This can happen any time before the window ends.
  2. **During the window:** the branch head, assistant manager and manager enter their scores on each employee's screen.
  3. **After 10 April:** HR clicks "สรุปผลทั้งหมด" (`finalize-all`) and shows the `skipped` list so missing scores can be fixed.
  4. **ผช.ผจก. screen:** list `status=finalized` with breakdown, step and eligibility. Actions per row: reopen and eligibility override. Bulk action: "ตรวจสอบแล้ว" (`asst-review`).
  5. **ผจก. screen:** list `status=asst_reviewed`. Bulk action: "อนุมัติ" (`manager-approve`). Show the `skipped` list with reasons. For assistant manager and manager rows, prompt for `board_reference` and approve them separately.
  6. **About 3 months later**, the manager records the profit result: a confirmation dialog, then show the `settled` table with back pay amounts.
- **Optimistic UI**: not safe for approve or profit-result. They move money, and some people can be skipped. Always render from the response and refetch the list.
- **Dashboard**: `GET /hr/kpi/fiscal-years/{fy}` gives window dates plus counts per status. Use it for a progress bar and to lock inputs.
- **Employee history**: `GET /hr/employees/{id}/salary-history` now includes `reason: "kpi_award"` (April) and `"kpi_special_step"` (the 0.5).

## Test Scenarios
1. **Happy path, 90+:**
   - Set a window covering today, score 42/20/10 plus branch 100.
   - Move the window end to yesterday, then finalize: expect step 1.5, immediate 1.0, pending 0.5.
   - Run the assistant manager review, then the manager approval: level +1.0, salary = the ladder amount, `pending_status = pending`.
   - Record a profit with settlement in July: level +0.5, `back_pay_amount` = difference × 3. July payroll includes `add_back_pay`; August doesn't.
2. **Loss:** recording `is_profit: false` gives `pending_status = cancelled`, and the level stays the same.
3. **Score 85:** 1.0 step, nothing pending.
4. **Outside the window:** a score PUT returns 409 with the window dates in `detail`.
5. **Finalize too early:** 409 "ยังไม่สิ้นสุดช่วงเวลาประเมิน".
6. **Wrong order:** a manager approval before the assistant manager's review returns `approved: []`.
7. **Ineligible:** more than 30 days of ลากิจ gives `eligible: false`. Approval leaves the level unchanged. After an override to true, approval raises the level.
8. **Reopen:** after a reopen, a score edit outside the window succeeds. Finalize again.
9. **Assistant manager / manager without board_reference:** they appear in `skipped`. With it, they're approved.
10. **Profit result twice:** the same result returns 200 (a retry). The opposite result returns 409.
11. **Permissions:** role 2 calling `asst-review` gets 403. Role 7 calling `manager-approve` gets 403.

## Open Questions / TODOs
- **Fiscal year label mismatch.** The backend names a fiscal year by the BE year it **starts** in: `2569` = 1 Apr 2026 – 31 Mar 2027, window March–April 2027. AMC's documents name it by the year it **ends** in ("ปีบัญชีสิ้นสุด 31 มี.ค. 2569"). Until Vivid confirms with AMC, show the date range next to the year everywhere, e.g. "2569 (1 เม.ย. 2569 – 31 มี.ค. 2570)".
- **Senior evaluator weights not modelled yet.** Branch heads and department heads should be scored 40 by the assistant manager and 60 by the manager (30 individual + 30 branch). Today the staff split 42/28/20/10 applies to everyone. This waits on AMC's org chart.
- **The 12-item individual form** (competency 30 / performance 30 / branch result 40, monthly April–March) is not reflected in `/hr/kpi/monthly` sections yet.
- **Discipline records don't exist** (module 3Q isn't built). Reviewers use the eligibility override for now.
- **No board role** exists. The manager records board decisions by passing `board_reference`.
