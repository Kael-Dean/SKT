# Handoff → Backend: แก้ชื่อประเภทการลาได้จากหน้า HR

**จาก:** Frontend (SKT) · **ถึง:** Backend (`FeatureRichDevelopment/um_backend`) · **วันที่:** 2026-10-29
**หน้าที่เกี่ยว:** `/hr/dashboard?tab=leave-types` (`src/pages/hr/tabs/HRLeaveTypesTab.jsx`)

## ต้องการอะไร

HR อยากแก้ชื่อประเภทการลาในหน้าตั้งค่าได้เอง (ตอนนี้แก้ได้แค่จำนวนวัน/ปี กับเปิด/ปิด)

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

## ข้อเสนอ (แนะนำ): เพิ่ม `display_name` แยกจาก key

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

## ฝั่ง Frontend จะทำเมื่อ backend deploy แล้ว

- หน้า `leave-types`: ปุ่มดินสอข้างชื่อ → inline input → `PATCH { display_name }` · โชว์ `display_name ?? type`
- PATCH จำนวนวันยังส่ง `{ days }` เหมือนเดิม
- ฟอร์มยื่นลา / ยอดคงเหลือ / รายงาน: แสดง `display_name ?? type` (logic ลาคลอดยังจับจาก `type`)

## Acceptance

- [ ] `PATCH /hr/leave-types/2 { "display_name": "ลากิจส่วนตัว" }` → 200, `GET` คืน `display_name` ใหม่ · `type` ยังเป็น `"ลากิจ"`
- [ ] ยื่น + อนุมัติลากิจหลังเปลี่ยนชื่อ → ยังหัก `business_leave` ถูก
- [ ] ยอดคงเหลือ (`/personnel/me/...` balance) ยังมีประเภทนั้น พร้อมชื่อใหม่
- [ ] `PATCH { "days": 12 }` อย่างเดียวยังใช้ได้ (ไม่ต้องส่ง display_name)
- [ ] `PATCH { "display_name": "ลาป่วย" }` บนแถวอื่น → 409 · `{ "display_name": "  " }` → 422
