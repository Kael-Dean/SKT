# QA ก่อนส่ง: หน้าจอ HR ใหม่ (2026-10-22)

**ขอบเขต:** 10 commit ใน `origin/dev..HEAD` (scaffold, salary cert + autofill, 3H leave calendar, 3F uploads/issue stats,
payroll daily-paid + ลาคลอด + งดจ่าย, 3L KPI, 3P welfare, 3Q discipline)
**วิธีตรวจ:** `npm run dev` (Vite :5199) + `playwright-cli` เปิด Chromium จริง ไม่ได้ล็อกอิน staging
- ใช้ JWT ปลอมที่ไม่ได้ sign (`alg: none`) ใส่ `localStorage.token` / `user` ในรูปแบบที่ `saveAuth()` เขียนไว้
- ทดสอบ 3 ตำแหน่ง: **117 หัวหน้าแผนกบุคคล (HR)**, **101 ผู้จัดการ** (สิทธิ์ KPI + อนุมัติสวัสดิการ/วินัย) และ **131 พนักงาน**
- `GET /auth/me/permissions` → 404 เพื่อให้ `permissions.js` ถอยไปคำนวณสิทธิ์จาก `rbacMatrix.js` ตามตำแหน่งใน JWT
- ใช้ `context.route('**/api-proxy/**')` ตอบ mock จากตัวอย่างใน handoff งวด 3–5 (3P, 3Q, 3L, 3H, 3F, 3C daily-paid, 3M salary cert)
  ส่วน GET ที่ไม่มี mock ตอบ `[]`/`{}` 200 และทุก method ที่ไม่ใช่ GET ตอบ `{}`
- ทุกหน้าตรวจครบ **375×812 และ 1280×800 × light/dark** (screenshot แบบ full page ในโฟลเดอร์นี้: `<role>-<page>-<width>-<theme>.png`;
  ภาพจากการเปิด sheet/dropdown ใช้ชื่อ `int-*.png`)
- วิธีวัดอัตโนมัติ: ฟัง console error / pageerror, เทียบ `scrollWidth > innerWidth` (horizontal page scroll), ช่องกรอกที่ไม่มี label,
  tap target ต่ำกว่า 44px บนมือถือ, contrast โดยประมาณใน dark mode, เดิน Tab 25 ครั้งเพื่อดู focus ring และใช้ `elementFromPoint`
  เช็คว่า listbox อยู่บนสุด (อยู่เหนือ Sheet และ sticky)

## ผลรวม

| ตรวจ | ผล |
|---|---|
| React crash / pageerror ในหน้าใหม่ | **ผ่าน** ทุกหน้า (`users.filter` ที่เจอมาจาก `HREmployeesTab` เดิมเมื่อได้ mock `{}` เกิดหลัง redirect เท่านั้น ไม่เกี่ยวกับงานนี้) |
| Console error | **พบ 1 → แก้แล้ว**: `<tr>` ซ้อนอยู่ใน `<td>` (validateDOMNesting) ในตารางวินัยและคำร้อง |
| Horizontal page scroll 375 / 1280 | **ผ่าน** ทุกหน้า (overflow = 0px) |
| Dark mode | **ผ่านหลังแก้**: ข้อความรองที่มีความหมายใช้ `dark:text-gray-500` (3.49:1) → เปลี่ยนเป็น `dark:text-gray-400` ส่วนที่ยังเหลือคือขีด "—" ที่ใช้แทนค่าว่าง และ empty state เดิมของ MyProfile |
| Dropdown / sheet อยู่เหนือ sticky | **ผ่าน**: panel z=10050 อยู่บนสุดที่ทุกจุดที่ probe และอยู่ในจอ; Sheet มี `aria-modal`, ชื่อ dialog และ focus อยู่ข้างใน |
| Focus มองเห็นได้ | **ผ่าน**: เดิน Tab แล้วไม่เจอ element ใน main/dialog ที่ไม่มี outline/ring |
| Touch target ≥44px (มือถือ) | **พบหลายจุด → แก้แล้ว** (ดูตาราง) ที่เหลือเป็น false positive หรือของเดิม |
| Label ของช่องกรอก | **พบ 15 ช่องใน `/leave-request` → แก้แล้ว**; Sheet ใหม่ทั้งหมด (claim, dependant, report-issue) มี label ครบ |
| `npm run build` | **ผ่าน** (built in 12s) |
| `eslint` ไฟล์ที่แตะ (19 ไฟล์) | **ผ่าน** (exit 0) |
| native `<select>` / `alert()` / `confirm()` ใหม่ใน diff | ไม่มี (commit นี้ยังเอา `alert()` เดิมใน LeaveRequest ออกด้วย) |

## รายหน้า

| หน้า | ตรวจ | ผล | แก้ที่ทำ |
|---|---|---|---|
| `/#/my-welfare` (HR, staff) | crash / overflow / dark / labels | ผ่าน | — |
| `/#/my-welfare` | touch 375 | ผ่าน (การ์ด DataList ใช้ปุ่มแบบ stretched ทั้งการ์ด ตัวตรวจเห็นหัวข้อสูง 22px แต่พื้นที่กดจริงคือการ์ดทั้งใบ) | — |
| `/#/my-welfare`, profile dependants | dark contrast "ค่าการศึกษาบุตร: ไม่เกี่ยวข้อง" 3.49:1 | ไม่ผ่าน → ผ่าน | `DependantsList.jsx` ใช้ gray-500/dark gray-400 |
| `/#/my-discipline?view=report` | labels, topic dropdown อยู่บนสุด | ผ่าน (ช่อง file ที่ตัวตรวจจับได้เป็น input `sr-only aria-hidden` ใช้งานผ่านปุ่ม) | — |
| `/#/my-discipline` ทั้ง 3 view | แท็บบนมือถือสูง 36px | ไม่ผ่าน → ผ่าน (44px) | `ui/Tabs.jsx` size md = `h-touch md:h-9` |
| `/#/my-discipline?view=reports` | ปุ่ม "รีเฟรช" 37×20 | ไม่ผ่าน → ผ่าน | `MyDiscipline.jsx` ใส่ `min-h-touch md:min-h-0` |
| `/#/my-kpi` | crash / overflow | ผ่าน | — |
| `/#/my-kpi` | dark contrast ของรหัสข้อ "2.1" และ "/max" | ไม่ผ่าน → ผ่าน | `MyKpi.jsx`, `SelfAssessmentCard.jsx`, `MonthlyFormGrid.jsx`, `KpiBits.jsx` |
| `/#/my-salary-cert` | ปุ่ม "รีเฟรช" 37×20, ปุ่ม "ดาวน์โหลด PDF" 36px | ไม่ผ่าน → ผ่าน | `MySalaryCert.jsx` (`md:!h-9`, refresh `min-h-touch`) |
| `/#/my-salary-cert` | radio 13px | ผ่าน (radio ทั้งตัวอยู่ใน `<label>` การ์ดเต็มความกว้าง) | — |
| `/#/leave-request` | ช่องกรอก 15 ช่องไม่ผูก label (WCAG 1.3.1/4.1.2) — วันที่, ชื่อ, ตำแหน่ง, สังกัด, เหตุผล, ช่วงวัน/เวลา ฯลฯ | ไม่ผ่าน → ผ่าน (`getByLabel('ตั้งแต่วันที่')` ใช้ได้แล้ว) | `LeaveRequest.jsx` `Field` สร้าง `useId` → `htmlFor`/`id` + `aria-required`, ดอกจัน `aria-hidden` |
| `/#/leave-request` | preview ลาคลอด | ผ่าน: 2–15 พ.ย. 2569 = **14 วัน** (นับตามปฏิทิน ส่วนวันทำการจะได้ 10) และขึ้นข้อความ "ลาคลอดนับทุกวันตามปฏิทิน…" | — |
| `/#/leave-request` | แท็บ "ยื่นใบลา/ประวัติใบลา" 36px | Minor (ของเดิม ไม่ใช่ `ui/Tabs`) | ยังไม่แก้ |
| `/#/my-profile` แจ้งแก้ไขข้อมูล | sheet + category dropdown อยู่บนสุด, ปุ่มเปิดไฟล์แนบ 32px | ไม่ผ่าน → ผ่าน | `AttachmentList.jsx` `min-h-touch md:min-h-8` |
| `/#/my-profile` | ปุ่ม "แจ้งแก้ไขข้อมูล" สูง 36px และข้อความขาวบน `amber-500` (≈2.1:1, WCAG 1.4.3) | ไม่ผ่าน → ผ่าน | `MyProfile.jsx` → `bg-amber-700 hover:bg-amber-800` (≈5:1) + `min-h-touch` **(สีเปลี่ยนจาก amber-500 เป็น amber-700 ให้ design ยืนยัน)** |
| `/#/my-profile` | FileUploader ใน sheet | ยังไม่ได้ตรวจในเบราว์เซอร์: ตัว uploader แสดงหลังเลือกฟิลด์ ส่วน flow `POST /files` (progress, 413/415) ต้องรอ backend | — |
| `/#/hr/welfare` + `?tab=welfare` | แท็บ 36px, ปุ่ม "บันทึกคำขอเบิก/สรุป/ทะเบียน" 40px | ไม่ผ่าน → ผ่าน | `Tabs.jsx`, `HRWelfareTab.jsx` (`md:!h-10`, smallBtn `md:!h-9`) |
| `/#/hr/welfare` | sheet บันทึกคำขอเบิก (HR) | ผ่าน: label ครบ, ComboBox พนักงานอยู่เหนือ sheet, sheet พอดีจอ 375 | — |
| `/#/hr/welfare` | sheet รายละเอียดคำขอ (ผู้จัดการ) | ผ่าน (aria-modal, focus อยู่ข้างใน) | — |
| `?tab=welfare-settings` | สวิตช์ 44×24, radio sr-only | ผ่าน (label คลิกได้) | — |
| `/#/hr/discipline` + `?tab=discipline` | console: `<tr>` ซ้อนใน `<td>` ตอนโหลด | ไม่ผ่าน → ผ่าน | `HRDisciplineTab.jsx` render `SkeletonTableRows` ตรงใน `<tbody>` |
| `/#/hr/discipline` | ปุ่ม "บันทึกการพ้นสภาพ" และ "ส่งต่อ…แทน" ใน sheet สูง 36px | ไม่ผ่าน → ผ่าน | `HRDisciplineTab.jsx` `md:!h-9` |
| `/#/hr/discipline` | sheet ของเคส | ผ่าน (ชื่อ dialog, focus, ไม่ล้น 375) | — |
| `?tab=discipline-settings` | ปุ่ม "เพิ่มหัวข้อ" 36px | ไม่ผ่าน → ผ่าน | `HRDisciplineSettingsTab.jsx` `md:!h-9` |
| `/#/hr/leave-calendar` + tab | grid เดือน 1280 / รายการ 375 / sheet ของวัน / dropdown สาขา | ผ่าน | — |
| `/#/hr/leave-calendar` | dark: หัวคอลัมน์ ส./อา. และเลขวันหยุด 3.49:1 | ไม่ผ่าน → ผ่าน (ยังเห็นความต่างวันหยุดกับวันทำงาน: หัววันทำงานเข้มขึ้นเป็น gray-700/300) | `HRLeaveCalendarTab.jsx` |
| `/#/hr/kpi` + `?tab=kpi` (ผู้จัดการ 101) | crash / overflow / sheet คะแนน | ผ่าน | — |
| `/#/hr/kpi` | ลิงก์ "แก้ช่วงประเมิน / แจ้งผู้ประเมิน / ดูคะแนน" สูง 16px | ไม่ผ่าน → ผ่าน | `FiscalYearHeader.jsx`, `ScoresPanel.jsx` `min-h-touch md:min-h-0` |
| `/#/hr/kpi` (HR 117) | redirect | ถูกต้องตามสิทธิ์: `kpi.view/monthly` ใน `rbacMatrix.js` มีแค่ 101/102, `kpi.score.head` ไม่มี 117 | — |
| `?tab=issues` (3F) | console: `<tr>` ซ้อนใน `<td>`, ชิป "เกินกำหนด" 36px | ไม่ผ่าน → ผ่าน | `IssueReportsPanel.jsx` |
| `?tab=issue-stats` | การ์ด, bar, เลือกปี/เดือน | ผ่าน | — |
| `?tab=payroll` | sheet วันทำงานลูกจ้างรายวัน | ผ่าน (aria-modal, focus อยู่ข้างใน) | — |
| `/#/hr/personnel/900` | pay basis (daily), dependants, ประวัติการตักเตือน | ผ่าน; sheet "เพิ่มผู้มีสิทธิ์" + dropdown ความสัมพันธ์อยู่เหนือ sheet | `PersonnelDependantsTab.jsx` ปุ่ม 44px บนมือถือ |
| `/#/hr/personnel/900` | ปุ่มอื่น 36px / "เปลี่ยนตำแหน่ง" 16px | Minor (ของเดิมนอก diff) | ยังไม่แก้ |
| `/#/hr/*` (staff 131) | guard | ผ่าน → `#/home` | — |

## ไฟล์ที่แก้ (ไม่ได้ commit)

`src/components/ui/Tabs.jsx`, `src/components/AttachmentList.jsx`, `src/components/hr/IssueReportsPanel.jsx`,
`src/components/hr/kpi/{FiscalYearHeader,KpiBits,MonthlyFormGrid,ScoresPanel,SelfAssessmentCard}.jsx`,
`src/components/hr/welfare/DependantsList.jsx`, `src/pages/hr/tabs/{HRDisciplineTab,HRDisciplineSettingsTab,HRLeaveCalendarTab,HRWelfareTab,PersonnelDependantsTab}.jsx`,
`src/pages/work/{LeaveRequest,MyDiscipline,MyKpi,MyProfile,MySalaryCert}.jsx`

`ui/Tabs.jsx` เป็น primitive ที่ใช้ร่วม 18 จุด ตอนนี้แท็บบนมือถือสูง 44px ทุกหน้า (desktop เท่าเดิม 36px)

## ยังเหลือ / ต้องใช้ข้อมูลจาก backend จริง

- **Minor ที่ยังไม่แก้:**
  - ปุ่ม `SelectDropdown size="sm"` สูง 42px บนมือถือ (ผ่าน WCAG 2.5.8 แต่ต่ำกว่ากฎ 44px ของโปรเจกต์เล็กน้อย)
  - แท็บเดิมใน LeaveRequest สูง 36px
  - ปุ่มเดิมใน HRPersonnelDetail
  - empty state ใน MyProfile ใช้ dark gray-500
  - ขีด "—" ที่ใช้แทนค่าว่างยังเป็นสีจาง
- **ต้องใช้ข้อมูลจริง:**
  - ชื่อ/สถานะ KPI ใน ScoreDialog: mock ไม่มีชื่อ จึงขึ้น "รหัส 900" และสถานะ "scoring" ขึ้นเป็นข้อความดิบ ต้องเช็ค enum จริง
  - thumbnail ของไฟล์แนบ (`GET /files/{id}` เป็น blob)
  - upload `POST /files` ทั้ง progress และ error 413/415
  - PDF (ใบตักเตือน, หนังสือรับรองเงินเดือน, รายงานสวัสดิการ)
  - preview ยอดเบิกตามสิทธิ์ (`/hr/welfare/claims/preview`) ตอนพิมพ์
  - flow อนุมัติ/ลงโทษ/ยกเลิก KPI ที่ backend ตอบ 409/422 จริง
  - หัวหน้าสาขา (110) ดูปฏิทินลาได้เฉพาะสาขาที่ดูแล และได้ 403 เมื่อขอสาขาอื่น
  - ลาคลอดที่มี `max_days` จริง (เตือนเมื่อเกิน)
  - รายชื่อพนักงานใน ComboBox (mock ว่าง)
- เมื่อ backend มี `/auth/me/permissions` จริง ต้องตรวจ guard ซ้ำด้วยรายการ code จริง (รอบนี้ใช้ matrix fallback)

