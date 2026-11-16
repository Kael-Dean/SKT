# Backend request — per-account "seen" flags for one-time intros

**From:** frontend · **Date:** 16 พ.ย. 2569 (2026-11-16) · **Repo:** `um_backend`
**Frontend status:** ready and already deployed — it calls the endpoints below and falls back to the
old behaviour while they return 404, so this can ship any time without coordination.

## Why

Some intro popups only show once (for now: the "ค้นหาฟังก์ชันได้แล้ว" intro on the header search).
Today the frontend remembers "already seen" in the browser's `localStorage`, so a person who saw it on
their office PC sees it again on their laptop or phone with the same account. We want it to show
**once per account**, on whichever device comes first.

The first-login onboarding (`/personnel/me/onboarding`, `tour_completed_at`) already lives on the
server and needs no change.

## Endpoints

Under the existing `/auth` router (`rbac.py`, next to `GET /auth/me/permissions`), because it must work for
**every logged-in account**, including Super Admin and login-only accounts that have no personnel
onboarding row (where `/personnel/me/onboarding` returns 404).

### `GET /auth/me/ui-flags`

Auth: `get_current_user` (any logged-in user). No `require_onboarded`.

```json
200
{ "flags": { "search_intro": "2026-11-16T09:12:44Z" } }
```

- `flags`: object; key = flag name, value = when it was first set (ISO 8601 UTC). Keys not set are absent.
- A user with nothing set → `{ "flags": {} }` (never 404 for a valid user — the frontend reads 404 as
  "backend doesn't have this feature yet").

### `POST /auth/me/ui-flags/{key}`

Auth: same. No body.

- Sets `key` for the current user if not set yet. **Idempotent**: calling again keeps the first timestamp
  and still returns 200.
- Returns the full set, same shape as GET: `{ "flags": { … } }`.
- Unknown key → `422 { "detail": "unknown flag" }`. Allowed keys (whitelist, so it can't become a
  free-form store):

| key            | meaning                                         |
|----------------|-------------------------------------------------|
| `search_intro` | saw the header function-search intro            |

New keys will come as small follow-up requests (add to the whitelist only).

### Act-as-role

While a Super Admin acts as another role, read/write the flags of the **real** user (the person at the
keyboard), not the acted role.

### Optional: reset (admin/HR, not needed now)

`DELETE /auth/me/ui-flags/{key}` for the user themselves would help testing. Not required for launch.

## Storage suggestion

Either works; whichever fits your migrations better:

1. **New table** `user_ui_flags (user_id FK userdata.id, key varchar(64), seen_at timestamptz,
   PRIMARY KEY (user_id, key))` — insert `ON CONFLICT DO NOTHING`.
2. **JSON column** `userdata.ui_flags JSON NOT NULL DEFAULT '{}'` — set `flags[key]` only if missing.

## How the frontend uses it (for reference)

- `src/lib/uiFlags.js` — loads `GET` once per login; `POST` when an intro opens.
- 404 / 405 → treated as "not supported yet": falls back to per-browser `localStorage` (today's behaviour).
- 5xx / network error → the intro just doesn't open in that session (it's optional) and tries again
  on the next app load.
- When the endpoint goes live, people who already saw the intro on a device get synced up
  automatically: the frontend sees its local "seen" mark with no server flag and POSTs it once.

## Test checklist

- [ ] `GET` for a new user → `200 { "flags": {} }`
- [ ] `POST search_intro` → 200, `GET` now shows it with a timestamp
- [ ] `POST search_intro` again → 200, timestamp unchanged
- [ ] `POST nope` → 422
- [ ] Super Admin (no personnel onboarding row) → GET/POST work
- [ ] Super Admin acting as role 5 → flags are the Super Admin's own
- [ ] No token → 401
