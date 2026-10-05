# Backend requests — งวด 2 (frontend → backend)

The frontend for `api-handoff-payment-2.md` (3B leave chain, 3O, notifications, 3D, 3E) is live on `main`.
These are the gaps we found against the live API (`https://api.amcsurin.com/openapi.json`, checked 2026-10-06).
None of them blocks deploy: the UI has a fallback for each one. Some UAT rows will look wrong, or won't pass, until they are fixed.

Priority: **P1** = affects a UAT row or what an approver sees · **P2** = nice to have.

---

## P1-1. Requester name on 3O responses
- **Where**: `OOOOut` (from `GET /hr/out-of-office`, the approve/reject responses, and `GET /personnel/me/out-of-office`).
- **Problem**: the response only has `user_id`. Approvers see "พนักงานรหัส 42" instead of a name.
- **Ask**: add `user_first_name`, `user_last_name` (same names as `LeaveRequestOut`). Adding `branch_name` would also help.
- **Frontend**: already reads `user_first_name`/`user_last_name`, `full_name` and `user_full_name`. No change needed once any one of them is added.

## P1-2. Branch on leave requests
- **Where**: `LeaveRequestOut`.
- **Problem**: there is no `branch_id`. A branch head's Inbox can't be filtered to their branches on the client. Today we rely only on the backend's 403, so the head still sees other branches' leave and gets an error when they press approve.
- **Ask**: add `branch_id` (the requester's branch when filed, same meaning as `OOOOut.branch_id`) and ideally `branch_name`.
- **Alternative**: scope `GET /hr/leave-requests` server-side for role 6 to the branches they cover, the same way `GET /hr/out-of-office` already works.

## P1-3. Who can read `GET /hr/leave-requests`
- The Inbox (`/inbox`) builds the approval queue for roles **2, 6 and 7** from this endpoint.
- In the older backend snapshot it allowed only roles 1 and 3. If that is still true, those approvers see "โหลดใบลาไม่สำเร็จ" and can't approve leave in the UI. That blocks UAT rows **B1, B2, B4, B8 and B9**.
- **Ask**: allow roles **1, 2, 3, 6, 7** with the same scoping as 3O (role 6 sees only their branches).

## P1-4. Role numbering — please confirm
- The handoff says JWT `role` is `5` Staff · `6` Branch head · `7` Assistant manager.
- The older frontend role map used `5` = MKT and `7` = STAFF.
- New approval code follows the handoff (`src/lib/approval.js`).
- **Ask**: confirm the handoff numbering is what the JWT carries in production, and whether role 5 is still also used for marketing users.

## P1-5. List promotion exams
- **Problem**: there is `POST /hr/promotions/exams` and `PATCH /hr/promotions/exams/{id}/result`, but no way to list exams. To record a result (UAT **D4–D6**), HR needs the exam id. Today the UI remembers ids in the browser that scheduled the exam, plus a manual "exam number" box.
- **Ask**: `GET /hr/promotions/exams?status=pending|done&candidate_id=` returning `{id, candidate_id, candidate_name, position_target, position_target_title, exam_date, notes, result, decided_at}`.

## P1-6. Relocation request status values
- **Where**: `GET /hr/relocation-requests?status=`.
- **Problem**: it defaults to `pending_branch_head`. The UI tabs use `pending_branch_head`, `pending_manager`, `approved` and `denied`.
- **Ask**: confirm the exact final status strings (`approved`/`denied`, or `approved`/`rejected`?). Also confirm that `status=all` (or an empty value) returns everything, so the history tab can show finished requests.

---

## P2-1. 3O settings readable by staff
- `GET /hr/out-of-office/settings` allows roles 1, 2, 3, 6, 7. Staff (role 5) filing a request can't see work hours or the half-day limit, so they only learn of them from the 400 error.
- **Ask**: allow any logged-in user to GET, or add `GET /personnel/me/out-of-office/settings`.

## P2-2. Return `order_reference` on relocation requests
- `RelocationRequestOut` has no `order_reference`, so the เลขคำสั่ง entered at manager-approve can't be shown afterwards.
- **Ask**: add `order_reference` to `RelocationRequestOut`, and to `relocation-history` rows if available.

## P2-3. Names in position history
- `GET /hr/employees/{employee_id}/position-history`: the UI reads `old_position_title`/`new_position_title` and falls back to ids.
- **Ask**: include both titles.

## P2-4. `salary-ladder` query param name
- The handoff says `?tier=`, the backend code reads `tier_id`. The UI sends both.
- **Ask**: confirm which one, so the other can be removed.

## P2-5. CORS for local development
- The API rejects `http://localhost:*` origins (preflight 400). Frontend dev works around this with a Vite proxy.
- **Optional**: add `http://localhost:5173` to the allowlist **only in a non-production config**.

---

## Already confirmed OK on the live API
- **3O**: all 9 endpoints exist.
- **Notifications**: the 3 endpoints exist; `NotificationOut` matches the spec.
- **Leave**: `branch-head-approve`, `branch-head-deny`, `approve`, `deny`, `manager-confirm` and `manager-deny` exist.
- **Relocation**: the `branch-head-*` and `manager-*` request endpoints, and `POST /hr/employees/{id}/relocations`.
