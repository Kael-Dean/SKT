# API Handoff: Branch-Free Positions + `position_display` (PR #55, v1.6.1)

## Business Context
Branch heads used to have the branch baked into their position (หัวหน้าสาขาปราสาท, ผู้ช่วยหัวหน้าสาขาจอมพระ …). Relocating a head to another branch moved their branch but left the old branch name in the position. Now **position = หัวหน้าสาขา / ผู้ช่วยหัวหน้าสาขา** and **branch = the employee's `branch_location`**. The backend sends a ready-made label, `position_display`, that joins them back together ("หัวหน้าสาขา" + "สาขาท่าตูม" → **"หัวหน้าสาขาท่าตูม"**). It follows the person automatically when they are relocated. Live on prod v1.6.1 and on staging (DB migration `section26A1`).

## What the frontend must do
1. Wherever you show a person's **current** position, show `position_display`. Do not look up `position` in the positions list for this; that lookup gives the bare "หัวหน้าสาขา".
2. The positions dropdown (`GET /hr/positions`) no longer has branch-named entries. HR picks "หัวหน้าสาขา" and sets the branch through the relocation flow.
3. Show the 422 message from create/rename position as-is (Thai, user-facing).
4. Position history screens: old rows may still point at the retired branch-named positions (that is correct, it was their title then). To resolve those ids to titles, load `GET /hr/positions?include_inactive=true`.

## Endpoints

### GET /hr/employees/{employee_id} and GET /hr/personnel/{user_id}
- **Purpose**: full employee profile (unchanged), with one new field
- **Auth**: `hr.employee.view`
- **Response** (new field only):
  ```json
  { "position": 26, "branch_location": 7, "position_display": "หัวหน้าสาขาท่าตูม" }
  ```
- **Notes**: `position_display` is `null` when the employee has no position.

### GET /hr/employees/export (JSON; `format=xlsx` unchanged)
- **Auth**: `hr.employee.export`
- **Response** (each row, new field):
  ```json
  { "id": 510300004, "branch_id": 7, "branch_name": "สาขาท่าตูม", "position_id": 26,
    "position_title": "หัวหน้าสาขา", "position_display": "หัวหน้าสาขาท่าตูม" }
  ```

### GET /hr/salary-roster
- **Auth**: `salary.roster`
- **Response** (each row, new field): `"position_display": "หัวหน้าสาขาท่าตูม"`, placed after `position_title`.

### GET /personnel/me/position
- **Auth**: any logged-in user (own record)
- **Response**:
  ```json
  { "id": 4, "title": "ผู้ช่วยหัวหน้าสาขา", "position_id": 4, "position_title": "ผู้ช่วยหัวหน้าสาขา",
    "position_display": "ผู้ช่วยหัวหน้าสาขาสังขะ", "salary_level": 5.0, "position_entered_date": "2024-04-01" }
  ```

### POST /hr/positions and PATCH /hr/positions/{position_id}
- **Purpose**: create / rename a position (unchanged otherwise)
- **Auth**: `position.edit`
- **New error**: 422 when the title is a branch-head title with a branch in it (`หัวหน้าสาขา<anything>` or `ผู้ช่วยหัวหน้าสาขา<anything>`; spaces ignored):
  ```json
  { "detail": "ไม่ต้องใส่ชื่อสาขาในตำแหน่ง ใช้ 'หัวหน้าสาขา' แล้วกำหนดสาขาที่ตัวพนักงาน" }
  ```
- **Notes**: exactly "หัวหน้าสาขา" / "ผู้ช่วยหัวหน้าสาขา" and all other titles are still accepted.

## Data Models / DTOs
```typescript
// added to: PersonnelDetail, employee export row, SalaryRosterRow, /personnel/me/position
position_display: string | null;
```

## Business Logic & Edge Cases
- Only the two branch titles get the branch appended, and only when the branch name starts with "สาขา". Everyone else gets their title unchanged ("เจ้าหน้าที่บัญชี 3" stays "เจ้าหน้าที่บัญชี 3").
- A หัวหน้าสาขา placed somewhere that is not a สาขา (HQ, ศูนย์ฝึกอบรม) shows the bare "หัวหน้าสาขา".
- Relocation needs no extra call: once a transfer is applied (same day, or on its effective date), the next fetch returns the new label. A future-dated transfer shows the current branch until the date arrives.
- Approval routing and permissions are unchanged: role 110 and "title starts with หัวหน้าสาขา + same branch" already worked this way.
- Printed documents (certificate person block, discipline letter) already use the combined label on the backend.

## Test Scenarios
1. **Relocated head**: on staging, relocate a หัวหน้าสาขา from ปราสาท to ท่าตูม with today's date. The profile shows "หัวหน้าสาขาท่าตูม" and the position id is unchanged.
2. **Dropdown**: the positions list shows only หัวหน้าสาขา / ผู้ช่วยหัวหน้าสาขา (no branch-named copies).
3. **Guard**: creating "หัวหน้าสาขาท่าตูม" shows the Thai 422 message.
4. **Non-branch staff**: the label equals the plain title.
5. **History**: old position-history rows still show their old branch-named title (using `include_inactive=true`).
