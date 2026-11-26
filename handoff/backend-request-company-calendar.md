# ขอ API: ปฏิทินกิจกรรมของสหกรณ์ (วันประชุม / กิจกรรม)

**ที่มา (26 พ.ย. 2026):** ผู้ใช้อยากให้ทุกคนเปิดหน้า **ปฏิทินวันหยุด** (`/holidays`) แล้วเห็นทั้งวันหยุดและ**วันประชุม**ที่ฝ่ายบุคคลลงไว้

**ตอนนี้:** มีแค่ `GET /hr/holidays` (วันหยุด). วันหยุดถูกนำไปหักวันลาอัตโนมัติ → **เอาวันประชุมไปใส่เป็นวันหยุดไม่ได้**.
ส่วน `/hr/employees/{id}/activities` เป็นประวัติรายคน ไม่ใช่ปฏิทินกลาง

## ที่ขอ

| Method | Path | สิทธิ์ | หมายเหตุ |
|---|---|---|---|
| GET | `/calendar/events?from=YYYY-MM-DD&to=YYYY-MM-DD` | ทุกคนที่ล็อกอิน | ช่วงวันที่ (หน้าเว็บขอทีละปีงบ หรือ 6 สัปดาห์) |
| POST | `/hr/calendar/events` | Admin, HR | |
| PATCH | `/hr/calendar/events/{id}` | Admin, HR | |
| DELETE | `/hr/calendar/events/{id}` | Admin, HR | soft delete ก็ได้ |

```jsonc
// CalendarEventOut
{
  "id": 12,
  "title": "ประชุมประจำเดือนพนักงาน",
  "event_type": "meeting",        // meeting | training | activity | other
  "start_date": "2026-12-03",
  "end_date": null,               // หลายวัน → ใส่วันสุดท้าย
  "start_time": "09:30",          // null = ทั้งวัน
  "end_time": "12:00",
  "location": "ห้องประชุมชั้น 2 สำนักงานใหญ่",
  "detail": "วาระ: …",
  "branch_ids": [],               // ว่าง = ทุกสาขา; มีค่า = เห็นเฉพาะคนในสาขานั้น (กรองที่ server)
  "created_by_name": "ฝ่ายบุคคล",
  "updated_at": "2026-11-26T10:00:00+07:00"
}
```

- **ไม่กระทบวันลา** (ต่างจากวันหยุด)
- ถ้ามี `branch_ids` ให้ server กรองตามสาขาของผู้ขอ หน้าเว็บจะไม่กรองเอง

## หน้าเว็บที่รออยู่

`src/pages/work/HolidayCalendar.jsx` รวมทุกอย่างเป็นรายการ `events` ภายใน `{ date, title, kind, note }` แล้ว
เมื่อ API พร้อม: เพิ่ม kind `meeting` (สี indigo/neutral), แสดงเวลา + สถานที่ในแผงวันที่เลือก และเพิ่มฟอร์มจัดการในแท็บ HR
