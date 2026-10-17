# ขอ BE: เพิ่ม field ใน `GET /hr/personnel` (PersonnelListOut)

**จาก:** FE (ตารางพนักงาน `/hr/users` + แท็บเจ้าหน้าที่ใน `/hr/dashboard`) · **วันที่:** 2026-10-17

## ทำไม
ตอนนี้ `PersonnelListOut` (`Phase3/hr_route.py:539`) ส่งแค่ 8 field:
`id, first_name, last_name, branch_location, position, is_active, role_id, account_status`
FE ต้องเดา/ต่อข้อมูลเอง (ชื่อสาขาจาก branch list, ชื่อตำแหน่งจาก `/hr/positions`, วันเริ่มงาน + ขั้นจาก
`/hr/employees/export` ซึ่งเรียกได้แค่ role 106/117/130 และมีแต่คน active) → คนที่ใช้ role อื่นจะไม่เห็นวันเริ่มงาน/อายุงาน
และข้อมูลสำคัญของ HR (เบอร์, รหัสเดิม, ประเภทการจ้าง, แผนก) ไม่มีใน list เลย

## ขอเพิ่ม (ทุกตัว optional / nullable)
แก้ `list_personnel` (`Phase3/hr_route.py:899`) ให้ **outer join** `PersonnelInfo`, `BranchData`, `Positions`
(ห้าม inner join — คนที่ยังไม่มีข้อมูลต้องไม่หายจาก list)

| field | ชนิด | ที่มา | หมายเหตุ |
|---|---|---|---|
| `email` | str | PersonnelInfo | |
| `branch_name` | str | BranchData.branch_name | ตาม `branch_location` |
| `position_title` | str | Positions.title | ตาม `position` |
| `position_tier` | int | Positions.position_tier_id | FE แปลงเป็นชื่อกระบอกเอง |
| `hired` | date (ISO) | PersonnelInfo.hired | วันเริ่มงาน → FE คำนวณอายุงาน |
| `legacy_user_id` | str | | รหัสพนักงานเดิม |
| `p_number` | str | PersonnelInfo | เบอร์โทร |
| `gender` | str | PersonnelInfo | `M` / `F` / `other` |
| `birthday` | date (ISO) | PersonnelInfo | |
| `employment_type` | str | | `officer` / `permanent_employee` / `temporary_employee` |
| `sub_unit` | str | | แผนก |
| `salary_level` | number | ขั้นเงินเดือนปัจจุบัน | **ไม่ต้องส่งจำนวนเงินเดือน** |
| `termination_date` | date (ISO) | | วันพ้นสภาพ (ถ้ามี) |

- สิทธิ์: ใช้ guard เดิมของ `/hr/personnel` — ถ้า field ไหนไม่อยากให้ role ใดเห็น (เช่น `salary_level`, `birthday`)
  ส่ง `null` ได้เลย FE ซ่อนคอลัมน์เองเมื่อไม่มีแถวใดมีค่า
- ไม่ต้องเปลี่ยน query param / ลำดับ / paging

## ฝั่ง FE พร้อมแล้ว
`src/components/hr/useEmployeeRows.js` อ่านทุก field ข้างบนแบบ defensive แล้ว — ค่าจาก BE จะถูกใช้ก่อนค่าที่ FE ต่อเอง
และคอลัมน์ที่ตอนนี้ซ่อนอยู่ (รหัสเดิม, เบอร์โทร, อีเมล, เพศ, วันเกิด, ประเภทการจ้าง, แผนก, วันพ้นสภาพ) จะโผล่เองทันทีที่ deploy
ไม่ต้องแก้ FE เพิ่ม
