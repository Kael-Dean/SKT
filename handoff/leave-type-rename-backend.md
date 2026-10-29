# Handoff → Backend: แก้ชื่อ + เพิ่มประเภทการลาจากหน้า HR

**จาก:** Frontend (SKT) · **ถึง:** Backend (`FeatureRichDevelopment/um_backend`) · **วันที่:** 2026-10-29
**หน้าที่เกี่ยว:** `/hr/dashboard?tab=leave-types` (`src/pages/hr/tabs/HRLeaveTypesTab.jsx`)

## ต้องการอะไร

HR อยากแก้ชื่อ (ส่วนที่ 1) และเพิ่มประเภทการลาใหม่ (ส่วนที่ 2) ในหน้าตั้งค่าได้เอง — ตอนนี้แก้ได้แค่จำนวนวัน/ปี กับเปิด/ปิด

## สถานะ backend ตอนนี้ (main ล่าสุด)

- `GET /hr/leave-types` → `Leaves` rows: `{ id, type, days, max_days, is_active }`
- `PATCH /hr/leave-types/{id}` → body `LeaveTypeUpdateRequest { days: int }` (บังคับ) — แก้ได้แค่ `days`
- `PATCH /hr/leave-types/{id}/toggle` → สลับ `is_active`
- ไม่มี endpoint ไหนเปลี่ยนชื่อ

## ⚠️ ห้ามแก้ `Leaves.type` ตรง ๆ

`Leaves.type` (ชื่อไทย) ถูกใช้เป็น **key ของ logic** ไม่ใช่แค่ป้ายแสดงผล ถ้าเปลี่ยนชื่อ logic จะพังเงียบ ๆ:

| ที่ | ใช้ชื่อทำอะไร |
|---|---|
| `Phase3/hr_constants.py` `LEAVE_QUOTA_MAP` | map ชื่อ → คอลัมน์โควตา (`"ลาป่วย" → sick_leave`) |
| `Phase3/hr_constants.py` `CALENDAR_DAY_LEAVE_TYPES = {"ลาคลอด"}` | ลาคลอดนับวันปฏิทิน |
| `employee_router.py` (~920, ~1116, ~1353) | ยอดคงเหลือ/โควตา `LEAVE_QUOTA_MAP.get(lt.type)` · หา annual leave ด้วย `Leaves.type == ...` |
| `personnel_route.py` (~726, ~853, ~1033) | ยื่นลา/หักโควตา `LEAVE_QUOTA_MAP.get(leave_type.type)` |
| `hr_route.py` (~494) | อนุมัติลา `LEAVE_QUOTA_MAP.get(leave_type_obj.type)` |
| `LeaveQuotaUpdateRequest.leave_type: str` | PATCH โควตารายคน ส่งชื่อเป็น key |

ตัวอย่าง: เปลี่ยน "ลาป่วย" → "ลาป่วย (มีใบแพทย์)" → `LEAVE_QUOTA_MAP.get()` คืน `None` → ประเภทนี้หายจากยอดคงเหลือ และยื่น/อนุมัติลาไม่หักโควตา
ฝั่ง frontend ก็จับ "ลาคลอด" จากชื่อเหมือนกัน (`src/lib/leaveDays.js` → นับวันปฏิทิน)

## ส่วนที่ 1: แก้ชื่อ — ข้อเสนอ (แนะนำ): เพิ่ม `display_name` แยกจาก key

ให้ `type` เป็น key คงที่ (ไม่ให้แก้) แล้วเพิ่มชื่อที่แสดงซึ่ง HR แก้ได้

### 1. Model + migration

```python
class Leaves(Base):
    ...
    display_name = Column(String, nullable=True)   # HR-editable label; NULL = use `type`
```

Alembic migration: add nullable column, ไม่ต้อง backfill (FE fallback เป็น `type`)

### 2. PATCH `/hr/leave-types/{id}` — ทุก field optional

```python
class LeaveTypeUpdateRequest(BaseModel):
    days: int | None = Field(None, ge=0)
    display_name: str | None = Field(None, max_length=100)

    @field_validator("display_name")
    @classmethod
    def _strip(cls, v):
        if v is None:
            return v
        v = v.strip()
        if not v:
            raise ValueError("ชื่อประเภทการลาต้องไม่ว่าง")
        return v
```

- อัปเดตเฉพาะ field ที่ส่งมา (`req.model_fields_set`) — FE ส่งแยก: `{ days }` หรือ `{ display_name }`
- ไม่ส่งอะไรเลย → 422
- กันชื่อซ้ำ: `display_name` (หรือ `type`) ชนกับประเภทอื่น → `409 { detail: "มีประเภทการลาชื่อนี้แล้ว" }` (เทียบกับ `coalesce(display_name, type)` ของแถวอื่น)
- AuditLog: `comment=f"display_name={old!r}->{new!r}"` แบบเดียวกับ `days`
- คงสิทธิ์ `require_perm("leave.types.edit")`
- Response: `{ status, leave_type_id, days, display_name }`

### 3. ส่ง `display_name` ออกไปทุกที่ที่โชว์ชื่อ

- `GET /hr/leave-types` → ได้อัตโนมัติ (คืน ORM row)
- endpoint ที่ label `Leaves.type.label("leave_type_name")` (employee_router ~1026, ~1043) และ balance (`"leave_type_name": lt.type` ~1123) → เปลี่ยนเป็น `func.coalesce(Leaves.display_name, Leaves.type)` / `lt.display_name or lt.type`
- รายงาน `reports_router.py` ~354 (`"name": lt.type`) → `lt.display_name or lt.type`
- **logic ทั้งหมดในตารางด้านบนใช้ `lt.type` ต่อไปเหมือนเดิม**

## ทางเลือก B (ใหญ่กว่า ไม่แนะนำตอนนี้)

เพิ่ม `Leaves.code` (= ชื่อคอลัมน์โควตา เช่น `sick_leave`), ย้าย `LEAVE_QUOTA_MAP` / `CALENDAR_DAY_LEAVE_TYPES` / `LeaveQuotaUpdateRequest.leave_type` ไปผูกกับ `code` แล้วให้แก้ `type` ได้ตรง ๆ — สะอาดกว่าระยะยาวแต่แตะหลายไฟล์และ contract ของ PATCH โควตารายคน

## ส่วนที่ 2: เพิ่มประเภทการลาใหม่ (`POST /hr/leave-types`)

ตอนนี้ไม่มี endpoint สร้าง (ไล่ทุกไฟล์ `.py` ใน main แล้ว — มี `Leaves(...)` แค่ใน `tests/hr_helpers.py`)

### ปัญหาที่ต้องคิดก่อน: โควตาผูกกับคอลัมน์

โควตารายคนเป็น **คอลัมน์ตายตัว** ใน `PersonnelLeaveQuota` (`sick_leave`, `business_leave`, … `other_leave`) และหาคอลัมน์ผ่าน `LEAVE_QUOTA_MAP.get(type)`
ประเภทที่สร้างใหม่จะไม่อยู่ใน map → `col_name = None` → ตามโค้ดปัจจุบัน:

- ยื่นลา (`personnel_route.py` ~853) / อนุมัติ (`hr_route.py` ~494): ข้ามการเช็ค/หักโควตา = **ลาได้ไม่จำกัด ไม่หักวัน ไม่คิด extra_leave_days**
- ยอดคงเหลือ (`employee_router.py` ~1116, `personnel_route.py` ~726): `if not col_name: continue` = **ไม่โผล่ในยอดคงเหลือ**
- รายงาน (`reports_router.py` ~354): มีหัวคอลัมน์ แต่ไม่มีโควตา

### ข้อเสนอ (แนะนำ, เข้ากับ `display_name` ด้านบน)

ให้ประเภทใหม่ **เลือกคอลัมน์โควตาที่จะใช้** (`quota_column`) จาก `QUOTA_COLUMNS` ที่มีอยู่ — ไม่ต้องเพิ่มคอลัมน์ใน DB

1. เพิ่ม `Leaves.quota_column = Column(String, nullable=True)` — ถ้ามีค่า ใช้แทน `LEAVE_QUOTA_MAP.get(type)`
   ทำ helper กลางที่เดียว แล้วแทนทุกจุดที่เรียก `LEAVE_QUOTA_MAP.get(x.type)`:
   ```python
   def quota_column_for(lt: Leaves) -> str | None:
       return lt.quota_column or LEAVE_QUOTA_MAP.get(lt.type)
   ```
2. `POST /hr/leave-types` (`require_perm("leave.types.edit")`)
   ```python
   class LeaveTypeCreateRequest(BaseModel):
       type: str = Field(..., min_length=1, max_length=100)   # strip แล้วห้ามว่าง
       days: int = Field(0, ge=0)
       max_days: int | None = Field(None, ge=1)
       quota_column: str | None = None      # ต้องอยู่ใน QUOTA_COLUMNS ถ้าส่งมา, None = ไม่จำกัด/ไม่หักโควตา
       is_active: bool = True
   ```
   - ชื่อซ้ำ (`type` หรือ `display_name` ของแถวอื่น) → 409 `"มีประเภทการลาชื่อนี้แล้ว"`
   - `quota_column` ไม่อยู่ใน `QUOTA_COLUMNS` → 422
   - AuditLog `CREATE_LEAVE_TYPE`
   - Response = row ที่สร้าง `{ id, type, days, max_days, quota_column, is_active }`
3. `GET /hr/leave-types` คืน `quota_column` ด้วย (ORM ได้อัตโนมัติ) + เพิ่ม endpoint หรือ field บอกรายการ `QUOTA_COLUMNS` พร้อมชื่อไทย ให้ FE ทำ dropdown
   (เช่น `GET /hr/leave-types/quota-columns` → `[{ "key": "other_leave", "label": "อื่นๆ" }, …]`)
4. ไม่ต้องมี DELETE — ใช้ toggle ปิดแทน (ใบลาเก่าอ้าง `leave_type` id อยู่)

> ถ้าไม่อยากเพิ่ม `quota_column`: ทางเลือกเร็วคือให้ประเภทใหม่ทุกตัวใช้ `other_leave` โดย default — แต่จะแชร์โควตาเดียวกันหมด ต้องให้ลูกค้ายืนยันก่อน

### Acceptance (ส่วนที่ 2)

- [ ] `POST { "type": "ลาไปช่วยราชการ", "days": 5, "quota_column": "other_leave" }` → 201 และโผล่ใน `GET /hr/leave-types`
- [ ] พนักงานเห็นประเภทใหม่ในฟอร์มยื่นลา (ถ้า `is_active`) · ยื่น+อนุมัติแล้วหัก `other_leave`
- [ ] ประเภทใหม่โผล่ในยอดคงเหลือ
- [ ] `POST` ชื่อซ้ำ → 409 · `quota_column: "foo"` → 422 · role ที่ไม่มี `leave.types.edit` → 403

## ฝั่ง Frontend จะทำเมื่อ backend deploy แล้ว

- หน้า `leave-types`: ปุ่ม "เพิ่มประเภทการลา" → `<Sheet>` ฟอร์ม (ชื่อ, จำนวนวัน/ปี, ลาได้สูงสุด, คอลัมน์โควตา `SelectDropdown`) → `POST /hr/leave-types`

- หน้า `leave-types`: ปุ่มดินสอข้างชื่อ → inline input → `PATCH { display_name }` · โชว์ `display_name ?? type`
- PATCH จำนวนวันยังส่ง `{ days }` เหมือนเดิม
- ฟอร์มยื่นลา / ยอดคงเหลือ / รายงาน: แสดง `display_name ?? type` (logic ลาคลอดยังจับจาก `type`)

## Acceptance (ส่วนที่ 1)

- [ ] `PATCH /hr/leave-types/2 { "display_name": "ลากิจส่วนตัว" }` → 200, `GET` คืน `display_name` ใหม่ · `type` ยังเป็น `"ลากิจ"`
- [ ] ยื่น + อนุมัติลากิจหลังเปลี่ยนชื่อ → ยังหัก `business_leave` ถูก
- [ ] ยอดคงเหลือ (`/personnel/me/...` balance) ยังมีประเภทนั้น พร้อมชื่อใหม่
- [ ] `PATCH { "days": 12 }` อย่างเดียวยังใช้ได้ (ไม่ต้องส่ง display_name)
- [ ] `PATCH { "display_name": "ลาป่วย" }` บนแถวอื่น → 409 · `{ "display_name": "  " }` → 422
