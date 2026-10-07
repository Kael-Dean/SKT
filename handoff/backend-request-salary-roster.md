# Backend request — `GET /hr/salary-roster` (รายชื่อเงินเดือนทั้งหมด แบบ JSON)

Status: LIVE v1.4.1 — frontend switched (see backend-reply-salary-roster.md)

**From:** Frontend (HR → เงินเดือน → แท็บย่อย "รายชื่อทั้งหมด")
**Date:** 2026-10-07
**Priority:** Medium — หน้าใช้งานได้แล้วด้วยวิธีชั่วคราว แต่ยิง request เยอะ (ดูด้านล่าง)

## ทำไมต้องมี

แท็บย่อยใหม่ "รายชื่อทั้งหมด" (`/hr/dashboard?tab=salary&sub=roster`) แสดงเจ้าหน้าที่ active ทุกคน
พร้อม สาขา · ตำแหน่ง · กระบอก · ขั้นปัจจุบัน · เงินเดือนปัจจุบัน

ตอนนี้ไม่มี endpoint แบบรวม frontend จึงต้องประกอบข้อมูลเอง:

| Request | จำนวน |
|---|---|
| `GET /hr/personnel?is_active=true` | 1 |
| `GET /hr/positions?include_inactive=true` | 1 |
| `GET /order/branch/search` | 1 (แคชทั้ง session) |
| `GET /hr/personnel/{id}` (เอาแค่ `personnel_info.salary_level`, `position`, `financial.current_salary`) | **N = จำนวนเจ้าหน้าที่** (ยิงพร้อมกันครั้งละ 6) |
| `GET /hr/salary-ladder?tier=` | 1 ต่อกระบอกที่มีคนใช้ (≤ 9) |

เจ้าหน้าที่ 120 คน = ~130 request ต่อการโหลดครั้งแรก/กดรีเฟรช และ `/hr/personnel/{id}` แต่ละตัว query
8 ตาราง (address, education, work_experience, criminal_records, leave quota, relocations …) ที่หน้านี้ไม่ได้ใช้เลย

## ของที่มีอยู่แล้วฝั่ง backend

`Phase3/reports_router.py` → `GET /hr/reports/salary-levels` (บรรทัด ~602-638, `require_role(1, 3, 7)`)
ประกอบข้อมูลชุดนี้ครบแล้วใน **query เดียว** (`UserData` ⟕ `PersonnelInfo` ⟕ `BranchData` ⟕ `Positions`
+ lookup `SalaryLevel` ด้วย `(position_tier_id, level)`) แต่ส่งออกเป็น **PDF** เท่านั้น
ขอแค่แยก logic ส่วน `rows` ออกมาเป็น endpoint JSON

## Spec ที่ขอ

```
GET /hr/salary-roster
Auth: require_role(1, 3, 7)   (เหมือน /hr/reports/salary-levels)
Query (optional ทั้งหมด): branch_id:int, tier:int
```

Response `200 application/json` — เรียงตาม `branch_id`, `personnel_id` (หรือไม่เรียงก็ได้ frontend เรียงเอง)

```json
[
  {
    "personnel_id": 105,
    "name": "กาญจนา ทองคำ",
    "branch_id": 3,
    "branch_name": "สาขาท่าตูม",
    "position_id": 1,
    "position_title": "พนักงานบัญชี",
    "position_tier": 2,
    "salary_level": 3.5,
    "salary_amount": 15550.00
  }
]
```

| Field | Type | หมายเหตุ |
|---|---|---|
| `personnel_id` | int | `UserData.id` |
| `name` | string | `first_name + " " + last_name` (หรือส่ง `first_name`/`last_name` แยกก็ได้ — ดีกว่า) |
| `branch_id` | int \| null | `UserData.branch_location` |
| `branch_name` | string \| null | |
| `position_id` | int \| null | `UserData.position` |
| `position_title` | string \| null | |
| `position_tier` | int \| null | `Positions.position_tier_id` |
| `salary_level` | number \| null | `PersonnelInfo.salary_level` เป็น **number** (ไม่ใช่ Decimal string) |
| `salary_amount` | number \| null | จาก `SalaryLevel` ของ (tier, level); ถ้าไม่พบ ใช้ `UserFinancialData.current_salary` เป็น fallback (frontend ทำแบบนี้อยู่) |

ข้อสังเกตจากโค้ด PDF เดิม (ถ้า copy logic มา):
- `if level and tier_id` ทำให้ `salary_level = 0` ถูกมองเป็นไม่มีค่า — ใช้ `is not None` แทน
- `str(sl.level)` vs `str(level)` อาจไม่ตรงกันถ้า scale ของ Decimal ต่างกัน (`"3.5"` vs `"3.50"`) — แนะนำ key ด้วย `Decimal`/`float` แทน string
- อยากได้ `salary_source: "ladder" | "financial" | null` เพิ่ม (optional) เพื่อแสดงที่มาของตัวเลข

## ฝั่ง frontend เมื่อ endpoint พร้อม

Hook ที่ต้องสลับ: **`useSalaryRoster`** ใน `src/components/hr/salaryData.js`
(มี `TODO(backend)` ที่หัวไฟล์). เปลี่ยนเป็นยิง `GET /hr/salary-roster` ครั้งเดียวแล้ว map เป็น row shape เดิม
(`{ id, name, branchId, positionId, position, tierId, level, salary, salaryStatus, … }`) — UI
(`src/components/hr/SalaryRosterPanel.jsx`) ไม่ต้องแก้ ตัด pool / per-employee cache / ladder fetch ทิ้งได้
คาดว่าเหลือ 2-3 request ต่อการโหลด (roster + positions/branches ถ้ายังใช้)
