# HR System — Frontend Data Brief
> สรุปข้อมูลที่ต้องแสดงผลในแต่ละหน้า ตาม Onboarding Workflow

---

## Onboarding Flow Overview

```
สร้าง User → กรอกข้อมูลบุคคล → ตั้งค่าเงินเดือน → กำหนดวันลา → ระบุสาขา
   /users      /personnel           /finance          /leaves       /locations
```

---

## 1. Users Module `/users`

### หน้า: User List (Admin)
| ข้อมูลที่แสดง | API |
|---|---|
| รายชื่อผู้ใช้ทั้งหมด (พร้อม pagination) | `GET get_users` |

**Fields ที่ควรแสดง:** ชื่อ, นามสกุล, email, สถานะ

---

### หน้า: My Profile
| ข้อมูลที่แสดง | API |
|---|---|
| โปรไฟล์ของตัวเอง + ตำแหน่งปัจจุบัน | `GET get_user_me` |

**Fields ที่ควรแสดง:** first_name, last_name, email, ตำแหน่ง (position)

---

### Actions ที่ต้องมี UI
| Action | Method | หมายเหตุ |
|---|---|---|
| สร้างผู้ใช้ใหม่ | `POST create_user` | จะ auto-init PersonnelData & Address ให้ |
| แก้ไข email / ชื่อ | `PUT update_user` | |
| เปลี่ยนรหัสผ่าน | `PUT change_password` | |
| ลบผู้ใช้ | `DEL delete_user` | แจ้งเตือน cascade ก่อนลบ |

---

## 2. Personnel Module `/personnel`

### หน้า: Personnel Detail
| Section | ข้อมูลที่แสดง | API |
|---|---|---|
| ข้อมูลส่วนตัว | บัญชีธนาคาร, ผู้ติดต่อฉุกเฉิน, สถานภาพสมรส | `GET get_personnel_detail` |
| ที่อยู่ | ที่อยู่อาศัยปัจจุบัน | `GET get_personnel_detail` |
| ประวัติตำแหน่ง | Timeline การเลื่อนตำแหน่ง / เปลี่ยนบทบาท | `GET get_position_history` |
| ประวัติการศึกษา | รายการวุฒิการศึกษา | `GET get_personnel_detail` |

**หมายเหตุ:** `get_personnel_detail` คืน PersonnelData + Address + PositionHistory ในครั้งเดียว

---

### Actions ที่ต้องมี UI
| Action | Method | Fields |
|---|---|---|
| แก้ไขข้อมูลส่วนตัว | `PUT update_personnel_data` | บัญชีธนาคาร, ผู้ติดต่อฉุกเฉิน, สถานภาพสมรส |
| แก้ไขที่อยู่ | `PUT update_address` | ที่อยู่อาศัย |
| เพิ่มประวัติการศึกษา | `POST add_education` | |
| ลบประวัติการศึกษา | `DEL delete_education` | |

---

## 3. Finance Module `/finance`

### หน้า: Financial Overview
| Section | ข้อมูลที่แสดง | API |
|---|---|---|
| ข้อมูลทางการเงิน | เงินเดือนปัจจุบัน, ยอดเงินกู้คงเหลือ, ค่าประกันสังคม | `GET get_user_financials` |
| ประวัติสลิปเงินเดือน | รายการสลิปย้อนหลัง | `GET get_payout_history` |

---

### Actions ที่ต้องมี UI
| Action | Role | Method | Fields |
|---|---|---|---|
| ปรับเงินเดือน / เงินกู้ | Admin only | `PUT update_financial_settings` | current_salary, current_loan |
| สร้างสลิปเงินเดือน | Admin only | `POST generate_monthly_payout` | คำนวณอัตโนมัติ: salary - loan - social security |

---

## 4. Leave Module `/leaves`

### หน้า: Leave Management (ซับซ้อนที่สุด)

| Section | ข้อมูลที่แสดง | API | Role |
|---|---|---|---|
| ประเภทการลา | รายการประเภทการลาทั้งหมด | `GET get_leave_types` | All |
| โควต้าวันลา | วันลาคงเหลือแต่ละประเภท (filter by year) | `GET get_my_quota(year)` | User |
| ประวัติคำขอลา | รายการลาของตัวเอง | `GET get_leave_requests` | User |
| คำขอรออนุมัติ | รายการลาที่ pending ทั้งหมด | `GET get_leave_requests` | Admin |

---

### Actions ที่ต้องมี UI
| Action | Role | Method | หมายเหตุ |
|---|---|---|---|
| ยื่นคำขอลา | User | `POST request_leave` | สถานะเริ่มต้น = pending |
| ยกเลิกคำขอลา | User | `DEL cancel_leave` | ยกเลิกได้เฉพาะที่ยังไม่ได้รับอนุมัติ |
| อนุมัติ / ปฏิเสธ | Admin | `PUT update_leave_status` | หักวันลาจาก Quota อัตโนมัติเมื่ออนุมัติ |

**Logic สำคัญสำหรับ Frontend:**
- แสดง action "ยกเลิก" เฉพาะ status = `pending`
- ปุ่มอนุมัติ/ปฏิเสธ แสดงเฉพาะ Admin view
- โควต้าวันลาต้อง refresh หลังอนุมัติคำขอ

---

## 5. Locations Module `/locations`

### หน้า: Branch / Relocation
| ข้อมูลที่แสดง | API |
|---|---|
| รายชื่อสาขาทั้งหมด | `GET get_branches` |
| ประวัติการย้ายสาขา (ดูใน personnel detail) | `GET get_personnel_detail` |

---

### Actions ที่ต้องมี UI
| Action | Role | Method | หมายเหตุ |
|---|---|---|---|
| ย้ายสาขา | Admin only | `POST relocate_user` | เลือกสาขาจาก get_branches ก่อนเสมอ |

**Relocation Workflow (4 ขั้นตอน):**
1. Admin เรียก `get_branches` → แสดง dropdown สาขา
2. Admin เลือกสาขาปลายทาง → เรียก `relocate_user`
3. ระบบสร้าง RelocationData + อัพเดต branch_location อัตโนมัติ
4. ข้อมูลการย้ายปรากฏใน personnel detail ของผู้ใช้

---

## Permission Summary

| Module | User (ตัวเอง) | Admin |
|---|---|---|
| Users | ดูโปรไฟล์ตัวเอง, แก้ไข, เปลี่ยน password | ดูทั้งหมด, สร้าง, ลบ |
| Personnel | ดู/แก้ไขข้อมูลตัวเอง | ดู/แก้ไขทุกคน |
| Finance | ดูข้อมูลของตัวเอง | ปรับ salary/loan, สร้างสลิป |
| Leaves | ยื่นลา, ยกเลิก, ดูประวัติตัวเอง | อนุมัติ/ปฏิเสธ, ดูทุกคำขอ |
| Locations | — | ย้ายสาขา |

---

## Auto-Cascade ที่ระบบทำให้อัตโนมัติ (ไม่ต้อง call เพิ่ม)

| Trigger | สิ่งที่เกิดขึ้นอัตโนมัติ |
|---|---|
| `create_user` | สร้าง PersonnelData + PersonnelAddress |
| `generate_monthly_payout` | หัก loan + หัก social security |
| `update_leave_status` (approved) | หักวันลาจาก Quota |
| `relocate_user` | สร้าง RelocationData + อัพเดต branch_location |
| `delete_user` | จัดการ foreign key cascades ทั้งหมด |
