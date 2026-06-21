# Phase 1 Reports — Backend Wiring Contract (สำหรับ backend dev)

> ที่มา: handoff `api-handoff (4).md` ระบุว่า generator ทั้ง 19 ตัวเสร็จแล้ว แต่ **HTTP routes ยังไม่ wired**.
> ฝั่ง frontend (`src/pages/work/Documents.jsx` → การ์ด "รายงาน Phase 1") พร้อมเรียกแล้ว — ตอนนี้ได้ **404 ทุกตัวเพราะ route ยังไม่มี**.
> เอกสารนี้คือ contract ที่ frontend คาดหวัง เพื่อให้ backend wire route แล้วเชื่อมกันได้ทันที.

## รูปแบบ route

```
GET /reports/phase1/P{nn}/pdf        # nn = 01..19
```

- Response: `200`, `Content-Type: application/pdf`, `Content-Disposition: attachment; filename="Pnn_xxx.pdf"` (FE อ่าน filename จาก header นี้)
- ใช้ `StreamingResponse(buf, media_type="application/pdf", ...)` ตาม pattern `Phase3/reports_router.py`
- Frontend แนบ query `preview=false` มาด้วยเสมอ → **ignore ได้** (ไม่ต้องประกาศก็ได้ ถ้า FastAPI ไม่ strict)

## Auth

- ใช้ `require_role(1, 3, 7)` ทุก endpoint
- ⚠️ **ยืนยัน role mapping**: handoff (4) เขียน "1=admin, 3=manager, 7=report viewer" แต่ใน SKT role จริงคือ **1=ADMIN, 3=HR, 7=STAFF** (ดู `src/App.jsx` `const ROLE`) → ช่วย confirm ว่า `require_role(1,3,7)` ครอบคลุม role ที่ควรเห็นรายงานจริง (ฝั่ง FE การ์ด "รายงาน" เปิดให้ ADMIN/MNG/HA/STAFF)

## Query params ที่ frontend ส่ง (ต้องตรงชื่อ snake_case)

| Report | params (required) | optional |
|--------|-------------------|----------|
| P01 | `branch_id`, `start_date`, `end_date` | — |
| P02 | `branch_id`, `start_date`, `end_date` | — |
| P03 | `branch_id`, `start_date`, `end_date` | — |
| P04 | `branch_id`, `start_date`, `end_date` | — |
| **P05** | `branch_id`, `start_date`, `end_date` | — |
| P06 | `branch_id`, `start_date`, `end_date` | — |
| **P07** | `branch_id`, `start_date`, `end_date` | — |
| P08 | `branch_id`, `start_date`, `end_date` | — |
| P09 | `branch_id`, `start_date`, `end_date` | — |
| **P10** | `member_id` (int) | `branch_id` |
| P11 | `branch_id` | — (point-in-time, ไม่มีช่วงวันที่) |
| P12 | `branch_id`, `start_date`, `end_date` | — |
| **P13** | `branch_id`, `start_date`, `end_date` | — |
| P14 | `branch_id`, `start_date`, `end_date` | `klang_ids` (ส่งซ้ำหลายค่า เช่น `?klang_ids=1&klang_ids=2`) |
| P15 | `branch_id`, `start_date`, `end_date` | — |
| P16 | `branch_id`, `start_date`, `end_date` | — |
| P17 | `branch_id`, `start_date`, `end_date` | — |
| P18 | `branch_id` | — (point-in-time) |
| P19 | `branch_id`, `start_date`, `end_date` | — |

- `start_date` / `end_date` = `YYYY-MM-DD` (ค.ศ. / CE)
- `branch_id`, `member_id`, `klang_ids` = integer

> หมายเหตุ: P05/P07/P13 ฝั่ง FE เพิ่งแก้ให้ตรงตารางนี้ (เดิม P05 บังคับ `asso_id`, P07/P13 บังคับ `spec_id` ซึ่งไม่ตรง handoff).

## error contract ที่ FE รองรับแล้ว

FE แยกข้อความตาม status: `404` (route ยังไม่เปิด) / `403` (สิทธิ์) / `401` (เซสชัน) / `422` (พารามิเตอร์ — อ่าน `{detail:[{msg}]}`). ขอให้ backend ใช้ status เหล่านี้ตามมาตรฐาน Phase 3.

## TODO ค้างจาก handoff (4)

1. wire 19 routes (ข้างบน) — งานหลักที่ทำให้รายงานเรียกได้
2. P01 payload builder ยังไม่ confirm — verify ก่อน expose
3. P14 รายชื่อ klang: FE ใช้ `/order/klang/search?branch_id=X` อยู่แล้ว (มี endpoint ใน SKT) — ถ้าจะอัปเกรด FE เป็น multi-select จะดึงจากตัวนี้
