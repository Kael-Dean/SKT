# Handoff: มะลิ ซื้อเป็น "รวม" / ขายแยกพันธุ์ (Phase 1 buy & sell)

Branch `feat/mali-pool` · migration `section25A1_mali_pool` · 2026-10-26

## Business rule (AMC, via Vivid)

- Every หอมมะลิ buy (แห้ง or สด, CP or ERM, any year or season) uses the spec whose **variant is "รวม"**. Users no longer choose กข15 or ดอกมะลิ105 when buying.
- Every หอมมะลิ sale must choose **กข15 or ดอกมะลิ105**, as before. Selling "รวม" is not allowed.
- At each คลัง, the กข15 and ดอกมะลิ105 sales together may not exceed the รวม bought (older buys still recorded under a variant also count). CP and ERM are separate pools.

## What the frontend must change

### 1. Spec / variant dropdowns: pass `order_type`

| Endpoint | New query param | Effect for มะลิ |
|---|---|---|
| `GET /order/form/search` | `order_type=buy` or `order_type=sell` | `buy` returns only รวม specs; `sell` hides the รวม specs |
| `GET /order/variant/search?species_id=…` | `order_type=buy` or `order_type=sell` | `buy` returns only `รวม`; `sell` returns กข15 and ดอกมะลิ105 |

Without `order_type`, both endpoints return everything as before. Other species are never filtered.

- The buy form and the buy-edit form send `order_type=buy`.
- The sell form and the sell-edit form send `order_type=sell`.

The three มะลิ specs in a group share one `prod_name` (the name never carried the variant). That is why the dropdown looked like it had duplicates. With the filter, the buy dropdown shows one row per group.

### 2. New errors to show as-is

| When | Status | `detail` |
|---|---|---|
| A buy (or buy edit that changes spec) uses กข15/ดอกมะลิ105 for มะลิ | 400 | `ข้าวหอมมะลิต้องรับซื้อด้วยพันธุ์ "รวม" เท่านั้น (ไม่แยก กข15 / ดอกมะลิ105)` |
| A sale (or sell edit that changes spec) uses รวม | 400 | `การขายข้าวหอมมะลิต้องเลือกพันธุ์ กข15 หรือ ดอกมะลิ105 (ขายเป็น "รวม" ไม่ได้)` |
| A sale would take the pool below zero | 409 | `สต็อกไม่พอ: คงเหลือ X กก. …` (X is now the pool total) |

Editing an old buy that keeps its กข15/ดอกมะลิ105 spec is still allowed. Only a spec change is checked.

### 3. Stock figures

- `stockdata` for the รวม spec now holds only its own buys. The old copies of กข15/ดอกมะลิ105 movements were removed by the migration.
- `stockdaily` for the รวม spec holds the **whole pool** (รวม + กข15 + ดอกมะลิ105). Use it when the screen wants "how much มะลิ is left".
- `POST /order/stockdaily/recalc` with a มะลิ spec also rebuilds the pool rows. If you call it with the รวม spec itself, `recalc` is `null` and `recalc_combined` holds the result.
