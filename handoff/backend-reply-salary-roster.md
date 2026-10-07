# Backend reply — `GET /hr/salary-roster` is LIVE (prod v1.4.1, 2026-10-07)

Reply to `backend-request-salary-roster.md`. The endpoint is deployed to both production and staging. Please make the frontend change below.

## Task

Rewrite the `useSalaryRoster` hook in `src/components/hr/salaryData.js` so it calls `GET /hr/salary-roster` **once** instead of building the roster from many requests. **Keep the row shape the hook returns now** (`{ id, name, branchId, positionId, position, tierId, level, salary, salaryStatus, … }`), so `src/components/hr/SalaryRosterPanel.jsx` needs no changes. Then delete what's no longer needed: the per-employee `GET /hr/personnel/{id}` calls, the concurrency pool (6 at a time), the per-employee cache, the `GET /hr/salary-ladder?tier=` calls, and the `TODO(backend)` comment at the top of the file.

## Endpoint

```
GET /hr/salary-roster
Auth: same bearer token as the other /hr endpoints; use the project's existing API client
Roles allowed: 1, 2, 3, 7  (anyone else → 403, no token → 401)
Query params (all optional): branch_id: int, tier: int  (tier = position tier ID)
```

Returns active employees only, sorted by `branch_id` then `personnel_id`.

## Response `200` — JSON array

```json
[
  {
    "personnel_id": 105,
    "first_name": "กาญจนา",
    "last_name": "ทองคำ",
    "name": "กาญจนา ทองคำ",
    "branch_id": 3,
    "branch_name": "สาขาท่าตูม",
    "position_id": 1,
    "position_title": "พนักงานบัญชี",
    "position_tier": 2,
    "salary_level": 3.5,
    "salary_amount": 15550.0,
    "salary_source": "ladder"
  }
]
```

| Field | Type | Notes |
|---|---|---|
| `personnel_id` | int | |
| `first_name`, `last_name` | string \| null | |
| `name` | string | `first_name + " " + last_name`, already trimmed |
| `branch_id` / `branch_name` | int \| null / string \| null | |
| `position_id` / `position_title` | int \| null / string \| null | |
| `position_tier` | int \| null | |
| `salary_level` | number \| null | A JSON number, not a Decimal string. **`0` is a real level**, so check `== null`, not truthiness |
| `salary_amount` | number \| null | The ladder amount for (tier, level). If there's no ladder entry, the server falls back to `current_salary` |
| `salary_source` | `"ladder"` \| `"financial"` \| `null` | Where `salary_amount` came from. `null` means no salary data at all |

## Mapping to the existing row shape

| Existing row field | From |
|---|---|
| `id` | `personnel_id` |
| `name` | `name` |
| `branchId` | `branch_id` |
| `positionId` | `position_id` |
| `position` | `position_title` |
| `tierId` | `position_tier` |
| `level` | `salary_level` |
| `salary` | `salary_amount` |
| `salaryStatus` | Derive from `salary_source`, keeping the meaning the hook uses today: `"ladder"` = found in the ladder, `"financial"` = fallback from current salary, `null` = no data. Read the current hook first and keep the same status values the UI already handles |

Fill any other fields the current hook produces from this response, or from the positions/branches data the page already has. Branch name is now in the response, so the branches lookup is only needed if something else on the page uses it.

## Expected result

One request per load or refresh (two or three if the page still loads positions/branches for other reasons), down from about 130 for 120 employees. Handle the error states the hook already handles: 401/403 and network errors.

## Check before finishing

1. The roster tab (`/hr/dashboard?tab=salary&sub=roster`) shows the same people, branches, positions, tiers, levels and salaries as before.
2. The Network tab shows a single `GET /hr/salary-roster` and no `/hr/personnel/{id}` or `/hr/salary-ladder` calls.
3. An employee at level 0 shows level 0 with a salary, not a blank.