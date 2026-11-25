# Handoff → Backend: ลายเซ็นอิเล็กทรอนิกส์ (ลงลายเซ็นในเอกสารอัตโนมัติ)

> สถานะ FE: ส่วนที่ 1–6 **ทำเสร็จแล้ว รอ BE** — ถ้า endpoint ยังไม่มี (404) หน้าเว็บจะทำงานเหมือนเดิม ช่องเซ็นเป็นเส้นจุดว่าง
> ส่วนที่ 7 (คำขอเปลี่ยนลายเซ็น) **FE ยังไม่ได้ทำ** — ทำตามสเปกนี้เมื่อ BE พร้อม
> repo backend: `um_backend` (อ้างอิงโค้ด commit `bf30570`)
>
> **สรุปสิ่งที่ BE ต้องทำ:** ตาราง 2 ตาราง (`employee_signature`, `signature_change_request`) · endpoint จัดการโดย HR ·
> endpoint ของพนักงานเอง · endpoint ลายเซ็นของเอกสาร · **คำขอเปลี่ยนลายเซ็น (พนักงานยื่น → HR อนุมัติ) พร้อมประวัติ** · ฝังลายเซ็นใน PDF ของ BE

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
| PUT | `/hr/signatures/{user_id}` | multipart field `file` (+ ไม่บังคับ: `source` = `upload` \| `import`, `note`) → สร้างหรือแทนที่ ตอบกลับแบบเดียวกับ 1 แถวใน GET list · **ต้องบันทึกแถวประวัติใน `signature_change_request` ด้วย** (ส่วนที่ 7.6) |
| DELETE | `/hr/signatures/{user_id}` | ปิด `is_active` (soft delete) → `204` · บันทึกแถวประวัติ `kind="remove"` ด้วย |

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

พนักงานอัปโหลดหรือเปลี่ยนลายเซ็นเองโดยตรงไม่ได้ ต้อง**ยื่นคำขอเปลี่ยนลายเซ็น**ให้ HR อนุมัติ (ส่วนที่ 7)

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

## 7. คำขอเปลี่ยนลายเซ็น (พนักงานยื่น → HR อนุมัติ) — ส่วนเพิ่มเติม

พนักงานที่ต้องการเปลี่ยนลายเซ็น (เซ็นใหม่ ลายเซ็นเดิมไม่ชัด เปลี่ยนชื่อ-สกุล) หรือยังไม่มีลายเซ็นในระบบ
ยื่นคำขอพร้อมไฟล์ลายเซ็นใหม่และเหตุผล → HR ตรวจเทียบลายเซ็นเก่ากับใหม่ → อนุมัติ (ลายเซ็นใหม่ใช้ทันที) หรือไม่อนุมัติ (พร้อมเหตุผล)
**ทุกการเปลี่ยนลายเซ็นต้องมีบันทึก**: ใครขอ เมื่อไร เหตุผล ใครอนุมัติหรือไม่อนุมัติ เมื่อไร หมายเหตุ ไฟล์เก่า → ไฟล์ใหม่
รวมถึงการที่ HR อัปโหลด นำเข้า หรือลบเองโดยตรง (ส่วนที่ 3) ด้วย

### 7.1 สถานะ

```
            ยื่นคำขอ                 HR อนุมัติ
(พนักงาน) ──────────▶ pending ──────────────▶ approved   → ลายเซ็นใหม่ active ทันที, อันเก่า is_active=false
                        │   └── HR ไม่อนุมัติ ──▶ rejected   (ต้องมีเหตุผล)
                        └── ผู้ยื่นยกเลิกเอง ──▶ cancelled
```

- 1 คนมีคำขอ `pending` ได้ **ครั้งละ 1 รายการ** — ยื่นซ้ำ → 409 `"มีคำขอเปลี่ยนลายเซ็นที่รออนุมัติอยู่แล้ว"`
- **ห้ามอนุมัติคำขอของตัวเอง** (เช่น HR ขอเปลี่ยนลายเซ็นตัวเอง ต้องให้ HR คนอื่นหรือ Admin อนุมัติ) → 403 `"ไม่สามารถอนุมัติคำขอของตัวเองได้"`
- อนุมัติ/ไม่อนุมัติ/ยกเลิกได้เฉพาะ `pending` — ไม่ใช่ → 409 · ล็อกแถวด้วย `SELECT … FOR UPDATE` กันกดอนุมัติซ้อนกัน
- ไม่อนุมัติต้องมี `note` (ไม่ว่าง) → ไม่มี 422 `"กรุณาระบุเหตุผลที่ไม่อนุมัติ"`
- อนุมัติ = ทำใน transaction เดียว: ปิด `is_active` ของลายเซ็นปัจจุบัน → insert `employee_signature` ใหม่จากไฟล์ของคำขอ
  (`uploaded_by` = ผู้อนุมัติ) → เก็บ `previous_signature_id` / `resulting_signature_id` ลงคำขอ
- ตรวจไฟล์ตอนยื่นเหมือน PUT ในส่วนที่ 3 ทุกข้อ (PNG จริง, ≤ 1 MB, มี alpha, re-encode) · เหตุผล (`reason`) บังคับ 1–500 ตัวอักษร
- rate limit: ยื่นได้ไม่เกิน 5 ครั้งต่อวันต่อคน

### 7.2 ตาราง

```python
class SignatureChangeRequest(Base):
    __tablename__ = "signature_change_request"
    id                     = Column(Integer, primary_key=True)
    user_id                = Column(Integer, ForeignKey("userdata.id"), nullable=False, index=True)  # เจ้าของลายเซ็น
    kind                   = Column(String, nullable=False, server_default="set")   # "set" (ตั้ง/เปลี่ยน) | "remove" (ลบ)
    source                 = Column(String, nullable=False)   # "self_request" | "hr_upload" | "hr_import" | "hr_remove"
    status                 = Column(String, nullable=False, server_default="pending")  # pending | approved | rejected | cancelled
    reason                 = Column(String, nullable=True)    # เหตุผลของผู้ยื่น (บังคับเมื่อ source=self_request)
    # ไฟล์ลายเซ็นที่ขอ (null เมื่อ kind="remove")
    data                   = Column(LargeBinary, nullable=True)
    content_type           = Column(String, nullable=True)
    width                  = Column(Integer, nullable=True)
    height                 = Column(Integer, nullable=True)
    size_bytes             = Column(Integer, nullable=True)
    sha256                 = Column(String(64), nullable=True)
    source_name            = Column(String, nullable=True)    # ชื่อไฟล์ที่อัปโหลด
    requested_by           = Column(Integer, ForeignKey("userdata.id"), nullable=False)
    requested_at           = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    decided_by             = Column(Integer, ForeignKey("userdata.id"), nullable=True)
    decided_at             = Column(DateTime(timezone=True), nullable=True)
    decision_note          = Column(String, nullable=True)    # เหตุผลอนุมัติ/ไม่อนุมัติ
    cancelled_at           = Column(DateTime(timezone=True), nullable=True)
    previous_signature_id  = Column(Integer, ForeignKey("employee_signature.id"), nullable=True)  # ลายเซ็นก่อนเปลี่ยน
    resulting_signature_id = Column(Integer, ForeignKey("employee_signature.id"), nullable=True)  # ลายเซ็นที่ได้หลังอนุมัติ
# unique partial index: (user_id) WHERE status = 'pending'
# ห้ามลบแถวในตารางนี้ (เป็นหลักฐาน) — ไม่มี endpoint DELETE
```

### 7.3 Endpoint ของพนักงาน (ทุกคนที่ login — เห็นเฉพาะของตัวเอง)

| Method | Path | ใช้ทำอะไร |
|---|---|---|
| POST | `/personnel/me/signature-requests` | multipart: `file` (PNG), `reason` → `201` แถวคำขอ (status `pending`) |
| GET | `/personnel/me/signature-requests` | ประวัติของตัวเองทั้งหมด (ทุกสถานะ **รวมที่ HR อัปโหลด/ลบให้โดยตรง**) เรียงใหม่ → เก่า |
| GET | `/personnel/me/signature-requests/{id}/image` | PNG ของลายเซ็นที่ขอ (ของตัวเองเท่านั้น, อื่น → 404) |
| PATCH | `/personnel/me/signature-requests/{id}/cancel` | ยกเลิกคำขอที่ยัง `pending` |

### 7.4 Endpoint ของ HR — สิทธิ์ใหม่ `signature.approve` → role 1, 3

(แยกจาก `signature.manage` เพื่อให้ลูกค้ามอบสิทธิ์อนุมัติให้ตำแหน่งอื่นทีหลังได้)

| Method | Path | ใช้ทำอะไร |
|---|---|---|
| GET | `/hr/signature-requests?status=pending` | รายการคำขอ (กรองสถานะได้, ไม่ส่ง = ทุกสถานะ) |
| GET | `/hr/signature-requests/{id}/image` | PNG ที่ขอ — FE วางเทียบกับลายเซ็นปัจจุบัน (`GET /hr/signatures/{user_id}/image`) |
| PATCH | `/hr/signature-requests/{id}/approve` | body `{ "note": "..." }` (ไม่บังคับ) → แถวคำขอที่อัปเดตแล้ว |
| PATCH | `/hr/signature-requests/{id}/reject` | body `{ "note": "..." }` (**บังคับ**) → แถวคำขอที่อัปเดตแล้ว |
| GET | `/hr/signatures/{user_id}/history` | ประวัติการเปลี่ยนลายเซ็นของคนนั้นทั้งหมด (ทุก source, ทุกสถานะ) เรียงใหม่ → เก่า |
| GET | `/hr/signatures/versions/{signature_id}/image` | PNG ของลายเซ็นเวอร์ชันเก่า (รวมที่ `is_active=false`) — ไว้ดูในประวัติ |

รูปแบบแถวคำขอ (ใช้เหมือนกันทุก endpoint ด้านบน — **ไม่มี bytes**):

```jsonc
{
  "id": 12,
  "user_id": 42, "user_name": "นางสาวกมลทิพย์ พิมพ์เสน", "position": "ผู้จัดการ", "branch_name": "สำนักงานใหญ่",
  "kind": "set",                       // set | remove
  "source": "self_request",            // self_request | hr_upload | hr_import | hr_remove
  "status": "pending",                 // pending | approved | rejected | cancelled
  "reason": "ลายเซ็นเดิมไม่ชัด เซ็นใหม่",
  "has_image": true,
  "requested_by": 42, "requested_by_name": "นางสาวกมลทิพย์ พิมพ์เสน", "requested_at": "2026-11-26T10:05:00+07:00",
  "decided_by": null, "decided_by_name": null, "decided_at": null, "decision_note": null,
  "cancelled_at": null,
  "previous_signature_id": 7, "resulting_signature_id": null,
  "has_current_signature": true        // ตอนนี้ user_id มีลายเซ็น active อยู่ไหม (เฉพาะ endpoint ของ HR)
}
```

### 7.5 แจ้งเตือน / กล่องงาน

- ยื่นคำขอ → `notify()` ถึงทุกคนที่มี `signature.approve` (ยกเว้นผู้ยื่น) `kind="signature_request_pending"`, `ref_type="signature_request"`
- อนุมัติ / ไม่อนุมัติ → `notify()` ถึงผู้ยื่น `kind="signature_request_decided"` (ข้อความบอกผล + เหตุผลถ้าไม่อนุมัติ)
- `GET /hr/dashboard` เพิ่ม `"pending_signature_requests": <จำนวน pending>` — FE ใช้แสดง badge ที่เมนู
- ถ้ากล่องงานรออนุมัติ (Inbox) ดึงจากหลายแหล่ง ให้รวมคำขอนี้ด้วย

### 7.6 บันทึกประวัติของการเปลี่ยนโดย HR โดยตรง

การเปลี่ยนที่ไม่ผ่านคำขอ ต้องสร้างแถวใน `signature_change_request` ด้วยเสมอ (สถานะ `approved` ทันที) เพื่อให้ประวัติครบในที่เดียว:

| การกระทำ | `kind` | `source` | `requested_by` / `decided_by` |
|---|---|---|---|
| `PUT /hr/signatures/{user_id}` (`source=upload` หรือไม่ส่ง) | set | `hr_upload` | HR คนที่อัปโหลด (ทั้งสองช่อง) |
| `PUT /hr/signatures/{user_id}` (`source=import`) — หน้า "นำเข้าหลายไฟล์" | set | `hr_import` | HR คนที่นำเข้า |
| `DELETE /hr/signatures/{user_id}` | remove | `hr_remove` | HR คนที่ลบ |

- ใส่ `previous_signature_id` / `resulting_signature_id` เหมือนกรณีอนุมัติ
- ถ้าคนนั้นมีคำขอ `pending` ค้างอยู่ตอน HR เปลี่ยนให้โดยตรง → ปิดคำขอนั้นเป็น `rejected` อัตโนมัติ พร้อม `decision_note="HR เปลี่ยนลายเซ็นให้โดยตรงแล้ว"` และแจ้งเตือนผู้ยื่น
- ทุกแถวลง `AuditLog` ด้วย (`signature.request.create` / `.approve` / `.reject` / `.cancel` / `signature.set` / `signature.remove`)

## 8. Test ที่ควรมี

- พนักงาน A เรียก `/hr/leave-requests/{ใบของ B}/signatures` → 403 (เหมือน history)
- ใบลาที่ยังรออนุมัติ → มีแค่ `requester` ไม่มี `approver`
- ใบลาที่ HR ยังไม่ตรวจ → ไม่มี `reviewer`
- คำขอหนังสือรับรองที่ยังไม่อนุมัติ → ไม่มี `approver`
- PUT ไฟล์ SVG / JPEG / PNG ไม่มี alpha / ใหญ่เกิน 1 MB → 422
- role 5 เรียก `/hr/signatures*` → 403
- เปลี่ยนลายเซ็นแล้วแถวเก่ายังอยู่ (`is_active=false`) และมี AuditLog
- **คำขอเปลี่ยนลายเซ็น:**
  - ยื่นคำขอที่ 2 ขณะที่อันแรกยัง pending → 409
  - ยื่นด้วยไฟล์ผิดประเภท / ไม่มีเหตุผล → 422
  - HR อนุมัติคำขอของตัวเอง → 403 · role 5 เรียก `/hr/signature-requests*` → 403
  - อนุมัติแล้ว: ลายเซ็นใหม่ active, อันเก่า `is_active=false`, คำขอมี `previous_signature_id` / `resulting_signature_id`, เอกสารที่พิมพ์หลังจากนั้นใช้ลายเซ็นใหม่
  - ไม่อนุมัติโดยไม่มี note → 422 · ไม่อนุมัติแล้วลายเซ็นเดิมไม่เปลี่ยน
  - อนุมัติ / ไม่อนุมัติ / ยกเลิก คำขอที่ไม่ใช่ pending → 409 · กดอนุมัติพร้อมกัน 2 ครั้ง → สำเร็จครั้งเดียว
  - พนักงาน A ดูรูป `/personnel/me/signature-requests/{id ของ B}/image` → 404
  - HR PUT / DELETE โดยตรง → มีแถวประวัติ `hr_upload` / `hr_import` / `hr_remove` และคำขอ pending ที่ค้างถูกปิดเป็น rejected
  - มีแจ้งเตือนถึง HR ตอนยื่น และถึงผู้ยื่นตอนตัดสิน · `pending_signature_requests` ใน `/hr/dashboard` ถูกต้อง

## 9. FE ที่ทำแล้ว (อ้างอิง)

- `src/lib/signatures.js` — API helpers, จับคู่ชื่อไฟล์ ↔ ชื่อเจ้าหน้าที่, โหลดลายเซ็นของเอกสาร (404 / 501 = ไม่มี → ช่องว่าง)
- `src/components/SignatureMark.jsx` — วางลายเซ็นทับเหนือเส้นจุด ไม่ดันเลย์เอาต์ทั้งตอนพิมพ์และบนจอ
- `src/pages/hr/tabs/HRSignaturesTab.jsx` — หน้า HR: รายชื่อ + สถานะ, อัปโหลด/เปลี่ยน/ลบรายคน, นำเข้าหลายไฟล์พร้อมจับคู่ชื่ออัตโนมัติให้ HR ตรวจก่อนอัปโหลด
- ใบลา (`LeaveFormDocument`) · ใบลาก่อนส่ง (`LeaveRequest` ใช้ `/personnel/me/signature/image`) · หนังสือรับรองเงินเดือนของฉัน
- permission ใหม่ `hr.signatures.manage` (role 1, 3) ใน `src/lib/permissions.js`
- หน้า "นำเข้าหลายไฟล์" ส่ง `source=import` · อัปโหลดรายคนส่ง `source=upload`

### FE ที่จะทำต่อเมื่อ BE ส่วนที่ 7 พร้อม

- **ลายเซ็นของฉัน** (เมนูข้อมูลของฉัน): ดูลายเซ็นปัจจุบัน · ยื่นคำขอเปลี่ยน (อัปโหลด PNG + เหตุผล) · ดูสถานะ/ประวัติ · ยกเลิกคำขอที่รออยู่
- **HR → ลายเซ็นอิเล็กทรอนิกส์** เพิ่มแท็บ "คำขอเปลี่ยนลายเซ็น": วางลายเซ็นเก่า | ใหม่ เทียบกัน · อนุมัติ / ไม่อนุมัติ (ต้องใส่เหตุผล) · badge จำนวนที่รอ
- ประวัติการเปลี่ยนลายเซ็นรายคน (ทั้งคำขอ และการเปลี่ยนโดย HR) พร้อมรูปแต่ละเวอร์ชัน
- กล่องงานรออนุมัติแสดงคำขอเปลี่ยนลายเซ็น
