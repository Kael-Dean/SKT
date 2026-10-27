# Backend requests — สต็อกมะลิในรายงาน + `position_display` ที่ยังขาด

Status: OPEN — รอคำตอบ backend

**From:** Frontend
**Date:** 2026-10-27
**Related:** `handoff/mali-pool.md` (migration `section25A1_mali_pool`), `handoff/api-handoff-position-display.md` (PR #55, v1.6.1)
**Priority:** Medium — หน้าเว็บใช้งานได้ ไม่มีอะไรพัง แต่บางจุดแสดงตัวเลข/ชื่อไม่ครบ

frontend ทำตาม handoff ทั้งสองแล้ว (ขึ้น dev + main วันที่ 2026-10-27) เหลือ 2 เรื่องที่ต้องให้ backend ตอบหรือเพิ่ม

---

## 1. สต็อกมะลิใน `GET /report/stock/tree`

### ที่เห็นจากฝั่ง frontend

หน้า "สต็อก" (`src/pages/work/Stock.jsx`) ใช้ `GET /report/stock/tree` แล้ว**บวกยอดของ leaf ทุกพันธุ์**
เพื่อทำยอดรวมรายชนิด (หอมมะลิ = รวม + กข15 + ดอกมะลิ105)

หลัง mali-pool:
- ซื้อมะลิ → ลงที่สเปค **"รวม"** เท่านั้น
- ขายมะลิ → ตัดจาก **กข15 / ดอกมะลิ105**
- handoff บอกว่า `stockdata` ของ "รวม" มีแค่ยอดซื้อของตัวเอง ส่วน `stockdaily` ของ "รวม" เป็นยอดทั้ง pool

### คำถาม

1. `/report/stock/tree` อ่านยอดจาก `stockdata` หรือ `stockdaily`?
2. ถ้าอ่านจาก `stockdata` (หรือคิดรายพันธุ์จาก movement):
   - แถว **กข15 / ดอกมะลิ105** จะติดลบเรื่อย ๆ (มีแต่ขายออก ไม่มีซื้อเข้า)
   - แถว **"รวม"** จะไม่ลดเลยแม้มีการขาย
   - ยอดรวมทั้งชนิดที่ frontend บวกเองน่าจะยังถูก แต่ตัวเลขรายพันธุ์อ่านแล้วงง
3. ถ้าอ่านจาก `stockdaily`: แถว "รวม" เป็นยอดทั้ง pool อยู่แล้ว → frontend บวก กข15/ดอกมะลิ105 ซ้ำเข้าไป จะ**นับซ้ำ**ไหม?

### ที่อยากได้ (เลือกแบบที่ backend สะดวก)

- **A.** ให้ tree ส่งมะลิเป็นแถวเดียว = ยอด pool (แยก CP / ERM ตามคลัง) แล้ว frontend แสดงแถวนั้นตรง ๆ
- **B.** ส่งรายพันธุ์เหมือนเดิม + เพิ่ม field บอกว่าแถวไหนเป็นยอด pool (เช่น `is_pool: true` หรือ `pool_total`) ให้ frontend ไม่บวกซ้ำ
- **C.** บอกกติกาให้ frontend คำนวณเอง (ต้องใช้แถวไหน บวก/ไม่บวกอะไร)

---

## 2. `position_display` ยังไม่มีใน endpoint เหล่านี้

v1.6.1 ส่ง `position_display` มาที่ 5 endpoint ตาม handoff (`/hr/employees/{id}`, `/hr/personnel/{user_id}`,
`/hr/employees/export`, `/hr/salary-roster`, `/personnel/me/position`) — frontend ใช้แล้วทั้งหมด

จุดด้านล่างยังได้แค่ชื่อตำแหน่งเปล่า → หัวหน้าสาขาแสดงเป็น **"หัวหน้าสาขา"** ไม่มีชื่อสาขาต่อท้าย

| # | หน้าจอ | Endpoint | Field ที่ frontend ใช้ตอนนี้ |
|---|---|---|---|
| 2.1 | ฟอร์มเอกสาร (ตำแหน่งผู้ยื่นที่หัวกระดาษ) | `GET /personnel/me/form-defaults` | `position` |
| 2.2 | ตารางรายชื่อพนักงาน (HR → พนักงาน) | `GET /hr/personnel` (list) | `position` id → lookup ชื่อ |
| 2.3 | ทะเบียนการลา | `GET /hr/leave/annual-summary` | `position_title` |
| 2.4 | ผู้ลาออก / เกษียณ | `GET /hr/reports/resigned-retired` | `position_title` |
| 2.5 | รายชื่อผู้มีสิทธิ์เลื่อนตำแหน่ง | `GET /hr/promotions/eligible` | `position_title` |

### ขอ

เพิ่ม `position_display: string | null` ในแต่ละแถว (หรือใน object ของ 2.1) โดยใช้ตรรกะเดียวกับ v1.6.1
(ต่อชื่อสาขาเฉพาะ "หัวหน้าสาขา" / "ผู้ช่วยหัวหน้าสาขา" ที่อยู่สาขาที่ชื่อขึ้นต้นด้วย "สาขา")

หมายเหตุ:
- **2.1 สำคัญสุด** — ชื่อนี้พิมพ์ลงเอกสารจริง ถ้า form-defaults ส่งแค่ "หัวหน้าสาขา" เอกสารจะไม่มีชื่อสาขา
  (ทางสำรองของ frontend ที่อ่าน `/personnel/me/position` ใช้ `position_display` แล้ว แต่ใช้เฉพาะตอน form-defaults ไม่ตอบ)
  หรือถ้า form-defaults ส่ง `position` เป็นชื่อรวมสาขาอยู่แล้ว บอกได้เลย frontend ไม่ต้องแก้
- **2.2** ตอนนี้ frontend ดึงชื่อรวมสาขาจาก `/hr/employees/export` มาเติมให้ (ต้องมีสิทธิ์ `hr.employee.export` + แคชทั้ง session)
  ถ้า list ส่ง `position_display` มาเลย จะเลิกพึ่ง export ได้ และถูกต้องทันทีหลังย้ายสาขา
- 2.3–2.5 frontend ยังไม่ได้ต่อ field นี้ — ถ้า backend เพิ่มแล้วแจ้งมา frontend แก้ให้ใช้ (งานเล็ก)
- **ไม่ต้องเพิ่ม** ใน position history / relocation history — แถวเก่าควรเป็นชื่อตำแหน่ง ณ ตอนนั้น (frontend ใช้ `include_inactive=true` แล้ว)

---

## ตอบกลับ

ตอบในไฟล์นี้ หรือส่ง handoff ใหม่ก็ได้ — ข้อ 1 บอกแค่ว่าเลือก A / B / C, ข้อ 2 บอกว่า endpoint ไหนเพิ่มแล้ว + version
