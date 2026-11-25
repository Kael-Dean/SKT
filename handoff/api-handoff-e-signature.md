# Handoff → Backend: ลายเซ็นอิเล็กทรอนิกส์ (ลงลายเซ็นในเอกสารอัตโนมัติ)

> สถานะ FE: **ทำเสร็จแล้ว รอ BE** — ถ้า endpoint ยังไม่มี (404) หน้าเว็บจะทำงานเหมือนเดิม ช่องเซ็นเป็นเส้นจุดว่าง
> repo backend: `um_backend` (อ้างอิงโค้ด commit `bf30570`)

## 1. เป้าหมาย

เมื่อพิมพ์เอกสารในระบบ (ใบลา, หนังสือรับรองเงินเดือน และรายงาน PDF ที่มีช่องลงนาม) ให้ใส่ลายเซ็นของคนที่**ทำรายการนั้นจริง**
ลงในช่อง "ลงชื่อ" ให้เอง HR มีลายเซ็นของเจ้าหน้าที่ 139 คนแล้ว: เป็น PNG พื้นโปร่งใส 300 dpi หมึกน้ำเงิน
HR จะอัปโหลดผ่านหน้า **HR → ลายเซ็นอิเล็กทรอนิกส์** (FE ทำแล้ว)

### กฎหลัก (ต้องบังคับที่ server)

1. **ลายเซ็นผูกกับ `user_id` ไม่ใช่ชื่อ** — การจับคู่ "ชื่อไฟล์ ↔ ชื่อจริง" FE ทำตอน HR นำเข้า แล้ว HR ตรวจและยืนยันก่อน
   จากนั้นอ้างอิงด้วย `user_id` เท่านั้น เพื่อกันชื่อซ้ำ ชื่อเปลี่ยน หรือการพิมพ์ชื่อคนอื่นเพื่อดึงลายเซ็น
2. **ลายเซ็นจะออกในเอกสารเฉพาะคนที่ทำ action นั้นจริงในระบบ** ได้แก่ ผู้ยื่น ผู้ให้ความเห็น/อนุมัติ/ไม่อนุมัติ และผู้ตรวจ (HR)
   ห้ามคืนลายเซ็นของคนที่แค่มีชื่ออยู่ในเอกสาร
3. **ห้ามมี endpoint ที่ให้คนทั่วไปดึงลายเซ็นของ user ไหนก็ได้** — คนทั่วไปเห็นลายเซ็นได้ผ่าน endpoint ของเอกสารเท่านั้น
   และต้องใช้สิทธิ์เดียวกับการดูเอกสารนั้น
4. ห้ามเก็บไฟล์ใน bucket แบบ public หรือส่ง URL ที่เปิดได้โดยไม่ login — ส่ง bytes หรือ data URI ผ่าน API ที่ต้องมี token เท่านั้น
5. ทุกการอัปโหลด เปลี่ยน หรือลบ ต้องลง `AuditLog` (ใคร / ของใคร / sha256 เก่า→ใหม่ / เวลา)

## 2. ตาราง

```python
class EmployeeSignature(Base):
    __tablename__ = "employee_signature"
    id           = Column(Integer, primary_key=True)
    user_id      = Column(Integer, ForeignKey("userdata.id"), nullable=False, index=True)
    data         = Column(LargeBinary, nullable=False)       # PNG bytes (Cloud Run ไม่มี disk ถาวร — เหมือน stored_file)
    content_type = Column(String, nullable=False)            # "image/png"
    width        = Column(Integer, nullable=False)
    height       = Column(Integer, nullable=False)
    size_bytes   = Column(Integer, nullable=False)
    sha256       = Column(String(64), nullable=False)
    source_name  = Column(String, nullable=True)             # ชื่อไฟล์ต้นฉบับ (ไว้ตรวจย้อน)
    uploaded_by  = Column(Integer, ForeignKey("userdata.id"), nullable=False)
    uploaded_at  = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    is_active    = Column(Boolean, nullable=False, server_default="true")
# unique partial index: (user_id) WHERE is_active  → 1 คนมีลายเซ็นใช้งานได้ 1 อัน
# เปลี่ยนลายเซ็น = ปิด is_active ของอันเก่า (ไม่ลบ) แล้ว insert อันใหม่ → เอกสารเก่ายังย้อนตรวจได้ว่าใช้ไฟล์ไหน
```

**ทางเลือกที่แนะนำ:** เก็บ `signature_id` ที่ใช้ ณ เวลาที่ทำ action ลงในแถว step หรือ approval (เช่น `leave_request_step.signature_id`, `salary_cert_request.approved_signature_id`)
เมื่อพิมพ์เอกสารเก่าจะได้ลายเซ็นที่ใช้จริงในตอนนั้น ไม่ใช่ลายเซ็นปัจจุบัน
ถ้ายังไม่ทำ ให้คืนลายเซ็น active ปัจจุบันไปก่อน (FE ไม่ต้องแก้อะไรเพิ่ม)

## 3. Endpoint จัดการ (HR / Admin) — สิทธิ์ใหม่ `signature.manage` → role 1, 3

| Method | Path | ใช้ทำอะไร |
|---|---|---|
| GET | `/hr/signatures` | รายการลายเซ็นที่ active: `[{ user_id, width, height, size_bytes, sha256, source_name, uploaded_by, uploaded_by_name, uploaded_at }]` (ไม่มี bytes) |
| GET | `/hr/signatures/{user_id}/image` | PNG bytes (`Content-Type: image/png`, `Cache-Control: private, no-store`) — ไว้ให้ HR พรีวิว |
| PUT | `/hr/signatures/{user_id}` | multipart field `file` → สร้างหรือแทนที่ ตอบกลับแบบเดียวกับ 1 แถวใน GET list |
| DELETE | `/hr/signatures/{user_id}` | ปิด `is_active` (soft delete) → `204` |

**ตรวจไฟล์ตอน PUT** (ตอบ 422 พร้อม `detail` ภาษาไทย):
- ตรวจ magic bytes ว่าเป็น PNG (`sniff_type` ใน `file_store.py` ใช้ซ้ำได้) — **ไม่รับ SVG** (กัน XSS)
- ขนาดไม่เกิน **1 MB**, กว้างและสูงไม่เกิน 4000 px, ต่ำสุด 20 px
- เปิดด้วย Pillow แล้ว **re-encode เป็น PNG ใหม่** (ทิ้ง metadata / chunk แปลก ๆ) ก่อนเก็บ
- ต้องมี alpha channel (พื้นโปร่งใส) — ถ้าไม่มีให้ตอบ 422 `"ไฟล์ลายเซ็นต้องเป็น PNG พื้นหลังโปร่งใส"`
- `user_id` ต้องมีอยู่จริง → ไม่มี 404
- **ไม่ใช้โควตา `DAILY_FILES_PER_USER` (30) ของ `/files`** — HR จะนำเข้า 139 ไฟล์ในรอบเดียว
  ให้ใช้ rate limit แยก เช่น 300 ไฟล์ต่อวันต่อคน

## 4. Endpoint ของตัวเอง (ทุกคนที่ login)

| Method | Path | ใช้ทำอะไร |
|---|---|---|
| GET | `/personnel/me/signature` | `{ has_signature, uploaded_at }` |
| GET | `/personnel/me/signature/image` | PNG ของตัวเอง (ไม่มี → 404) — FE ใช้ตอนพิมพ์ใบลาของตัวเองก่อนส่ง |

พนักงานอัปโหลดหรือเปลี่ยนลายเซ็นเองไม่ได้ ต้องผ่าน HR

## 5. Endpoint ลายเซ็นของเอกสาร (หัวใจของงานนี้)

รูปแบบเดียวกันทุกเอกสาร: ใช้**สิทธิ์เดียวกับการดูเอกสารนั้น** และคืนเฉพาะคนที่ทำ action แล้ว

```jsonc
// 200
{
  "signatures": [
    {
      "user_id": 17,
      "role": "requester",          // ดูตารางด้านล่าง
      "action": "SUBMIT",           // action ที่ทำให้มีสิทธิ์ลงลายเซ็นในเอกสารนี้
      "at": "2026-11-20T09:12:00+07:00",
      "name": "นางสาวกมลทิพย์ พิมพ์เสน",
      "position": "พนักงานบัญชี",
      "image": "data:image/png;base64,iVBORw0KGgo..."   // null = คนนี้ยังไม่มีลายเซ็นในระบบ
    }
  ]
}
```

| Path | สิทธิ์ (เท่ากับ) | role ที่คืน |
|---|---|---|
| `GET /hr/leave-requests/{leave_id}/signatures` | เดียวกับ `GET /hr/leave-requests/{leave_id}/history` | `requester` (เจ้าของใบลา ตลอด เพราะยื่นแล้ว) · `approver` (ทุก step ที่ action เป็น APPROVE / REJECT / ความเห็นหัวหน้า — ใส่ทุกคนที่ทำ step) · `reviewer` (`justified_by` เมื่อ HR ตรวจแล้ว) |
| `GET /personnel/me/salary-cert-requests/{req_id}/signatures` | เจ้าของคำขอเท่านั้น | `requester` · `supervisor` (`supervisor_id` เมื่อมี `supervisor_at`) · `approver` (`approved_by` เฉพาะ status = approved) |
| `GET /hr/salary-cert-requests/{req_id}/signatures` | เดียวกับ `GET /hr/salary-cert-requests` | เหมือนข้างบน |

- ใบที่ **ยกเลิก (cancelled)** ยังคืนลายเซ็นของคนที่ทำ action ไปแล้ว (เอกสารเป็นหลักฐาน)
- ใบที่ **ไม่อนุมัติ** คืน `approver` ของคนที่กดไม่อนุมัติ
- ทุกครั้งที่เรียก endpoint นี้ ลง `AuditLog` (`action="signature.render"`, ref เอกสาร, ผู้เรียก) — ไว้ตรวจย้อนว่าใครพิมพ์เอกสารที่มีลายเซ็นของใคร

FE จับคู่ช่องเซ็นจาก `user_id` + `role`:
- ใบลา: ช่อง "ผู้ขออนุญาตลา" = `requester` · ช่อง "ผู้บันทึก" (ความเห็นผู้บังคับบัญชา) = `approver` ของ step สุดท้ายที่อนุมัติหรือไม่อนุมัติ · ช่อง "ผู้ตรวจ" = `reviewer`
- หนังสือรับรองเงินเดือน: ช่อง "(ลงชื่อ)" = `approver` แล้วใช้ `name` / `position` ของ approver เป็นชื่อใต้ลายเซ็นด้วย

## 6. PDF ที่ backend สร้างเอง (ทำต่อในเฟสถัดไปได้)

FE ไม่ได้วาดเอกสารเหล่านี้ จึงต้องฝังลายเซ็นใน template ฝั่ง backend:

| PDF | ช่องที่ควรใส่ลายเซ็น |
|---|---|
| `/personnel/me/salary-cert-requests/{id}/certificate-pdf`, `/hr/salary-cert-requests/{id}/certificate-pdf` | `approved_by` (มี `signer` อยู่แล้วที่บรรทัด 237 ของ `salary_cert_router.py`) |
| `.../request-form-pdf` | ผู้ยื่น · หัวหน้า (ถ้าให้ความเห็นแล้ว) · ผู้จัดการ (ถ้าอนุมัติแล้ว) |
| รายงาน R1–R12 (`SIGNED_TEMPLATES` ใน `hr_report_generators.py`) | **"ผู้จัดทำ" = คนที่กดออกรายงาน** (current user) ถ้ามีลายเซ็น · "ผู้ตรวจสอบ" / "ผู้อนุมัติ" **เว้นว่าง** เพราะยังไม่มีขั้นตอนตรวจหรืออนุมัติรายงานในระบบ (ถ้าต้องการ ต้องทำ workflow sign-off รายงานก่อน แล้วค่อยใส่) |

ใน template ให้วาง `<img src="data:image/png;base64,...">` ทับเหนือเส้นจุด (`position:absolute`, สูงประมาณ 14–16 mm) ไม่ให้ดันเลย์เอาต์

## 7. Test ที่ควรมี

- พนักงาน A เรียก `/hr/leave-requests/{ใบของ B}/signatures` → 403 (เหมือน history)
- ใบลาที่ยังรออนุมัติ → มีแค่ `requester` ไม่มี `approver`
- ใบลาที่ HR ยังไม่ตรวจ → ไม่มี `reviewer`
- คำขอหนังสือรับรองที่ยังไม่อนุมัติ → ไม่มี `approver`
- PUT ไฟล์ SVG / JPEG / PNG ไม่มี alpha / ใหญ่เกิน 1 MB → 422
- role 5 เรียก `/hr/signatures*` → 403
- เปลี่ยนลายเซ็นแล้วแถวเก่ายังอยู่ (`is_active=false`) และมี AuditLog

## 8. FE ที่ทำแล้ว (อ้างอิง)

- `src/lib/signatures.js` — API helpers, จับคู่ชื่อไฟล์ ↔ ชื่อเจ้าหน้าที่, โหลดลายเซ็นของเอกสาร (404 / 501 = ไม่มี → ช่องว่าง)
- `src/components/SignatureMark.jsx` — วางลายเซ็นทับเหนือเส้นจุด ไม่ดันเลย์เอาต์ทั้งตอนพิมพ์และบนจอ
- `src/pages/hr/tabs/HRSignaturesTab.jsx` — หน้า HR: รายชื่อ + สถานะ, อัปโหลด/เปลี่ยน/ลบรายคน, นำเข้าหลายไฟล์พร้อมจับคู่ชื่ออัตโนมัติให้ HR ตรวจก่อนอัปโหลด
- ใบลา (`LeaveFormDocument`) · ใบลาก่อนส่ง (`LeaveRequest` ใช้ `/personnel/me/signature/image`) · หนังสือรับรองเงินเดือนของฉัน
- permission ใหม่ `hr.signatures.manage` (role 1, 3) ใน `src/lib/permissions.js`
