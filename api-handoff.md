# API Handoff: Salary Tier Management

## Business Context
Thai cooperative staff salaries are determined by two axes: **position tier** (job category, 9 types) and **salary level** (step on a 1–21 ladder in 0.5 increments). The `PositionTier` table is the canonical list of the 9 tiers; `SalaryLevel` stores the baht amount for every (tier, level) combination. A `Position` (job title) belongs to a tier, and each employee holds a position plus a personal salary level — the lookup of those two yields their monthly salary.

## Endpoints

### GET /hr/salary-ladder
- **Purpose**: List all salary level rows for a given tier
- **Auth**: Role 1 or 3 required
- **Request**:
  ```
  Query param: tier_id (integer, required) — ID from positiontier table
  ```
- **Response** (success `200`):
  ```json
  [
    {
      "id": 37,
      "position_tier_id": 3,
      "level": "1.0",
      "salary_amount": "10490.00"
    }
  ]
  ```
- **Response** (error): `422` if `tier_id` missing or not an integer
- **Notes**: Returns rows ordered by level ascending. Use `tier_id=1` through `tier_id=9` (seeded constants — see Enums section).

### GET /hr/salary-ladder/lookup
- **Purpose**: Get the exact salary amount for one tier + level pair
- **Auth**: Role 1 or 3 required
- **Request**:
  ```
  Query params:
    tier_id (integer, required)
    level   (decimal, required) — e.g. 4.5
  ```
- **Response** (success `200`):
  ```json
  {
    "id": 52,
    "position_tier_id": 5,
    "level": "4.5",
    "salary_amount": "15765.00"
  }
  ```
- **Response** (error): `404` if no entry for that combination

### PATCH /hr/salary-ladder/{id}
- **Purpose**: Update the baht amount for a single ladder entry (annual adjustment)
- **Auth**: Role 1 or 3 required
- **Request**:
  ```json
  { "salary_amount": "16500.00" }
  ```
- **Response** (success `200`): Updated `SalaryLevelOut` object (same shape as lookup response)
- **Response** (error): `404` if entry not found

### POST /hr/positions
- **Purpose**: Create a new job position title linked to a tier
- **Auth**: Role 1 or 3 required
- **Request**:
  ```json
  {
    "title": "Senior Accountant",
    "position_tier_id": 4
  }
  ```
- **Response** (success `201`):
  ```json
  {
    "id": 12,
    "title": "Senior Accountant",
    "position_tier_id": 4,
    "is_active": true
  }
  ```
- **Response** (error): `422` if `title` missing

### PATCH /hr/positions/{id}
- **Purpose**: Update a position's title or tier assignment
- **Auth**: Role 1 or 3 required
- **Request** (all fields optional):
  ```json
  {
    "title": "Senior Accountant II",
    "position_tier_id": 5
  }
  ```
- **Response** (success `200`): Updated `PositionOut` object

### PATCH /hr/positions/{id}/deactivate
- **Purpose**: Soft-deactivate a position so it can no longer be assigned to employees
- **Auth**: Role 1 or 3 required
- **Request**: No body
- **Response** (success `200`): `{ "status": "ok", "position_id": 12 }`
- **Response** (error): `409` if already inactive

### GET /hr/salary-ladder (tier listing — all tiers)
- **Notes**: To show a tier selector UI, fetch the `positiontier` table directly via the DB or a future `/hr/position-tiers` endpoint (not yet implemented — use the seeded constants below for now).

## Data Models / DTOs

```typescript
interface PositionTierRecord {
  id: number;           // 1–9, stable seeded IDs
  name: string;         // short key e.g. "officer_level1"
  full_name: string;    // Thai label e.g. "เจ้าหน้าที่ ระดับ 1"
  min_education: string | null;
}

interface SalaryLevelOut {
  id: number;
  position_tier_id: number;
  level: string;         // decimal string e.g. "4.5"
  salary_amount: string; // decimal string e.g. "15765.00"
}

interface PositionOut {
  id: number;
  title: string;
  position_tier_id: number | null;
  is_active: boolean;
}
```

## Enums & Constants

### Position Tiers (seeded, stable IDs)

| `id` | `name` | `full_name` (Thai) |
|------|--------|--------------------|
| 1 | `employee_level1` | ลูกจ้าง ระดับ 1 |
| 2 | `employee_level2` | ลูกจ้าง ระดับ 2 |
| 3 | `officer_level1` | เจ้าหน้าที่ ระดับ 1 |
| 4 | `officer_level2` | เจ้าหน้าที่ ระดับ 2 |
| 5 | `officer_level3` | เจ้าหน้าที่ ระดับ 3 |
| 6 | `supervisor_dept` | หัวหน้างาน แผนก / ผู้ช่วยสาขา / ฝ่าย |
| 7 | `supervisor_branch` | หัวหน้างาน ฝ่าย / สาขา |
| 8 | `asst_manager` | ผู้ช่วยผู้จัดการ |
| 9 | `manager` | ผู้จัดการ |

### Salary Levels
- Range: `1.0` to `21.0` in `0.5` steps
- Not every tier has all 21 levels — higher tiers start at level 1 but lower tiers cap out early (e.g. `employee_level1` only goes to level 9)

## Validation Rules
- `title` on positions: required, non-empty string
- `position_tier_id`: must be an integer 1–9; `null` is allowed (position not yet assigned to a tier)
- `salary_amount` in PATCH: must be a valid decimal (use string or number — backend accepts both)
- `level` in lookup: must match an existing step for that tier (0.5 increments); `404` returned otherwise
- `tier_id` in ladder endpoints: must be integer; non-existent IDs return empty array (not 404)

## Business Logic & Edge Cases
- **Salary lookup for an employee**: combine `PersonnelInfo.salary_level` (their step) + `Positions.position_tier_id` (their job's tier) → query `SalaryLevel` for the amount. If either is null, salary resolves to null.
- **Promotion salary adjustment**: on promotion exam pass, the backend automatically finds the equivalent salary level in the new tier (exact match on amount → if none, nearest level without exceeding current salary). Frontend does not need to handle this.
- **Tier gaps (xxx in original PDF)**: some tier/level combinations simply don't exist in the DB — this is intentional. `GET /hr/salary-ladder?tier_id=1` returns only 17 rows (levels 1–9), not 42.
- **Deactivated positions**: cannot be assigned to employees via `PATCH /hr/employees/{id}/position`. Filter these out in position pickers (`is_active: true` only).
- **`min_education`** is on `PositionTier`, not on individual `Position` — it applies to the whole tier category, not per job title.

## Integration Notes
- **Recommended flow for salary display**: fetch employee list → for each employee resolve `(position_tier_id, salary_level)` → single call to `/hr/salary-ladder/lookup` or build a local map from `/hr/salary-ladder?tier_id=X`.
- **Tier selector**: hard-code the 9 tier IDs from the constants table above — they are seeded with fixed IDs and will not change.
- **Optimistic UI**: safe for position title edits; avoid optimistic updates on salary amounts (always confirm from server).
- **Caching**: tier list and salary ladder are rarely updated (annual adjustments only) — safe to cache per session.

## Test Scenarios
1. **Happy path — lookup salary**: `GET /hr/salary-ladder/lookup?tier_id=5&level=7.5` → returns `{ salary_amount: "18665.00" }`
2. **Missing tier/level combo**: `GET /hr/salary-ladder/lookup?tier_id=1&level=15` → `404` (employee_level1 only goes to level 9)
3. **Create position without tier**: `POST /hr/positions` with only `title` → `201`, `position_tier_id: null`
4. **Deactivate already inactive**: `PATCH /hr/positions/{id}/deactivate` twice → second call returns `409`
5. **Permission denied**: any of the above without role 1 or 3 → `403`

## Open Questions / TODOs
- No `GET /hr/position-tiers` endpoint exists yet — frontend currently must use the hard-coded tier table above for tier name display.
- `min_education` on `PositionTier` has no update endpoint yet; must be set directly in DB.
