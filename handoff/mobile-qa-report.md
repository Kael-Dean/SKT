# Mobile overhaul: QA a11y + responsive report (WP6)

- **วันที่:** 2026-10-11 · **branch:** `dev` (ตรวจบน HEAD `67eb3cc` + fix ของ QA `fb4e8a5..dd1e0a5`)
- **ผู้ตรวจ:** accessibility-qa · impeccable `audit` + `adapt`, mode **Operate**
- **เครื่องมือ:** playwright-cli (Chromium) บน Vite dev server ของ worktree นี้ (`:5175`) + baseline `48ed1a3` (`git archive`, `:5176`) เพื่อเทียบ Enter-flow
- **Auth/data:** ไม่มี credential staging → fake JWT (role 1, branch 1, user id 17) ใน localStorage + mock ทุก `/api-proxy/**` ด้วย `context.route` (GET → รายการ 12 แถว, write → 400). ผลทุกข้อด้านล่างจึงเป็น **UI ภายใต้ mock data** ไม่ใช่ข้อมูลจริง
- **Viewport:** 360×640, 375×667, 390×844, 430×932, 768×1024, 1280×800 × light/dark (localStorage `darkMode`)
- **Routes (15):** `/home /Buy /sales /stock /order /order-correction /search /customer-search /share /transfer-in /transfer-out /transfer-mill /bring-in /damage-out /member-signup` + regression `/hr/dashboard /debt-form /operation-plan` (+ P2 `/business-edit /documents /customer-add /spec/create /bring-in-mill` เช็ค overflow)

---

## 1. Checklist

| # | ข้อ | ผล | หลักฐาน |
|---|---|---|---|
| 1 | ไม่มี horizontal overflow ที่ 360 | **PASS** (หลังแก้ 1 จุด) | sweep 15 routes × 6 viewports × 2 themes = 180 page loads: `scrollWidth <= innerWidth` ทุกหน้า. Regression `/operation-plan` ล้น 398px ที่ 390 (implicit grid column = min-content ของ placeholder ใน ComboBox) → **แก้แล้ว `969d418`**; P2 routes ที่ 360/390 ไม่ล้น. shot: `mobile-after/operation-plan-360x640-*-no-overflow.png` |
| 2 | Touch target ≥44×44 ที่ 390 (trading routes) | **PASS** (หลังแก้) | script ตรวจ `button,a,[role=button],input,select,summary,[role=combobox],textarea` ที่มองเห็น. ก่อนแก้: BranchSwitcher ใน topbar **58×30** ทุก route (แถวในเมนูสาขา ~40px), ปุ่มปิด toast **24×24**, ปุ่ม action ของ toast 36px → **แก้แล้ว `9bc92da`** (58×44, แถว 44, ปิด 44×44). ผ่านตาม allow-list: DataList stretched button (สูง 22px แต่ hit area = ทั้ง card), checkbox ของ TransferMill 20×20 (มี `<label htmlFor>` `min-h-touch` เป็น hit area). Buy/Sales stepper step 1–4 ที่ 390/360 = 0 element < 44 (ยกเว้น sr-only checkbox ที่มี label). Order phone: 12 card + pagination ไม่มีตัวไหน < 44 |
| 3 | computed font-size input/select/textarea ≥16px ที่ 375 | **PASS** | 0 field < 16px ทุก route ทั้ง light/dark ที่ 375 (ไม่นับ `.cell-input`); Buy/Sales step 1–4 ที่ 360/390 = 0; ช่องค้นหาใน ComboBox picker = 16px |
| 4 | Sheet: dialog + aria-modal + label, focus เข้า, Tab วน, Esc ปิด, focus คืน trigger; ComboBox picker บนมือถือเหมือนกัน | Sheet **PASS** · picker **FAIL → แก้แล้ว** | Sheet รายละเอียดใน MemberSearch ที่ 390 + 1280: `role=dialog` `aria-modal=true` `aria-labelledby` → ชื่อสมาชิก; initial focus = ปุ่ม "ปิด"; Tab 25 ครั้ง + Shift+Tab อยู่ใน dialog ตลอด; Esc ปิด; focus คืนปุ่มการ์ด/"ดูรายละเอียด". **Picker:** dialog/label/Esc/คืน focus ผ่าน แต่ **option ที่ focus ได้ = 0 ตัว** และลูกศรไม่ทำงาน → ใช้ keyboard เลือกค่าไม่ได้ (Blocker B1) → **แก้แล้ว `fb4e8a5`**: Tab → search → option ปัจจุบัน → ปิด; ↑↓ Home End เลื่อน, Enter เลือก, focus คืน trigger (ตรวจซ้ำกับ "ฟอร์มสำเร็จรูป" 12 ตัวเลือก + "วิธีชำระเงิน"). shot: `mobile-after/combobox-picker-390x844-*-keyboard-focus.png` |
| 5 | Stepper: `aria-current="step"`, ปุ่มมี label, dot error มี text alternative | **PASS** (+ Minor) | `aria-current=step` อยู่บนขั้นปัจจุบันเท่านั้น; ชื่อปุ่ม `ขั้น 1: ลูกค้า`; ขั้นที่มี error = `ขั้น 1: ลูกค้า (มีข้อผิดพลาด)`; ขั้นที่ยังไปไม่ถึงเป็น `disabled`; caption `ขั้น n/4 · …` เป็น `aria-live=polite`. Minor m1: ในภาพ dot error ใช้สีแดงแยกอย่างเดียว |
| 6 | Form: label เชื่อม, error มี `aria-invalid` + `aria-describedby`, toast เป็น live region | **FAIL** (แก้แล้วบางส่วน ที่เหลือส่งต่อ) | Toast: `region "การแจ้งเตือน"` `aria-live=polite` + error เป็น `role=alert` → PASS. Label: ก่อนแก้ Order, OrderCorrection, Share, MemberSignup มี field ที่ไม่มี accessible name หรือมีแค่ placeholder → **แก้แล้ว `de3603b`, `dd1e0a5`** (sweep ซ้ำ = 0 ใน route เหล่านี้). **ยังเหลือ (ไฟล์ของ perf engineer):** Buy phone 1 field, Sales phone 18 field, Buy desktop 23, Sales desktop 18; error ใน Buy/Sales มี `aria-invalid` แต่ไม่มี `aria-describedby`; validator focus ไป field แรกแล้ว `onFocus` ล้าง error ของ field นั้นทันที (M7–M11) |
| 7 | Contrast AA ทั้ง light/dark บน StickyActionBar, Sheet, DataList, Stepper, ResultSheet, Home strip, Sidebar trading | **FAIL → แก้แล้ว** (+ Minor) | checker แปลง oklch ผ่าน canvas แล้ว composite พื้นหลังโปร่งแสงของ ancestor. ก่อนแก้: ปุ่มบันทึก/ResultSheet success ขาวบน emerald-600 = **3.65:1**, error text red-500 บนขาว = **3.81:1** → **แก้แล้ว `ffb47d0`** (emerald-700 = 5.36, red-600 = 4.77) + red-500 ที่ hard-code ใน Order/OC/TransferIn **`dd1e0a5`**. ตรวจซ้ำ: ทุก surface ในรายการ light + dark = 0 fail. Minor ที่เหลือ: placeholder/sub-label ของ ComboBox 4.35:1 (m2), primary hover บน desktop dark 3.13:1 (m3). Welcome card บน Home เป็น gradient (checker ข้าม) → ตรวจด้วยตา: ขาวบน indigo-600/700 ผ่าน |
| 8 | Keyboard 1280: Buy + Sales Enter-flow ตรง baseline, ComboBox ↑↓ Enter Esc | **PASS** | script เดียวกันรันบน baseline `48ed1a3` และ HEAD (mock เดียวกัน). Buy: citizenId → memberId → fullName → คลัง → น้ำหนักก่อนชั่ง → หลังชั่ง → ความชื้น → สิ่งเจือปน → gram → ราคา/กก. → เป็นเงิน → บันทึก **ตรงกันทุกช่อง**. Sales: … → คลัง → จำนวนรถพ่วง → ใบชั่ง/ราคา/gram/ทะเบียน/น้ำหนัก/เป็นเงิน × 2 คัน → บันทึก **ตรงกัน** (ต่างกันแค่ ComboBox ใหม่เปิดใน Enter เดียว). array `PERSON/COMPANY/ORDER_ORDER` + filter ตรงกับ baseline ทุกบรรทัด. ComboBox ("สาขา" ใน Order): ↓ เปิด, ↓↓↑ เลื่อน `aria-activedescendant`, Enter เลือก + focus คืน trigger, Esc ปิดโดยค่าไม่เปลี่ยน |
| 9 | Console error ใหม่ = 0 | **PASS** | 180 page loads + regression routes: 0 error (ไม่นับ CSP `frame-ancestors` meta และ 401/400 จาก mock) |
| 10 | `prefers-reduced-motion` | **PASS** | `emulateMedia({reducedMotion})`: Sheet panel `sheet-in 0.2s → 1e-05s`, backdrop `fade-in 0.25s → 1e-05s`, toast `fade-up 0.35s → 1e-05s`; StickyActionBar มี `motion-reduce:transition-none` |
| 11 | `npx impeccable detect src/pages/work src/components` ไม่เพิ่ม | **PASS** | **10** anti-patterns (baseline 31, หลัง WP3 = 10). ที่เหลือเป็น side-tab stripe / ai-color-palette เดิมใน MemberTermination, MyProfile, NotificationBell, RelocationPanel (นอก scope) |

**Regression 1280/768/390:** `/hr/dashboard`, `/debt-form`, `/operation-plan` render ได้, ไม่มี overflow (หลังแก้ operation-plan), console 0. shot: `mobile-after/{order,buy}-1280x800-light-regression.png`; HR ที่ 1280 ดูแล้วเหมือนเดิม (BranchSwitcher บน desktop ไม่เปลี่ยน เพราะใช้ `md:min-h-0`)

---

## 2. Findings

รวม: **Blocker 1 · Major 11 · Minor 9** — แก้แล้ว Blocker 1 + Major 6; ส่งต่อ Major 5 (ไฟล์ของ perf engineer) + Minor 9

### Blocker

| # | ไฟล์:บรรทัด | ปัญหา | WCAG | วิธีแก้ | สถานะ |
|---|---|---|---|---|---|
| B1 | `src/components/ComboBox.jsx` `renderOption` (phone branch) | Picker บนมือถือ: option เป็น `<li role=option onClick>` ไม่มี tabindex และไม่รับคีย์ → keyboard, switch access และ desktop ที่ zoom ≥200% (กว้าง < 768 = เข้าโหมด phone) เปิด picker ได้แต่**เลือกค่าไม่ได้** ทุก ComboBox ในแอป | 2.1.1 (A) | roving tabindex, ↑↓ Home End, Enter/Space เลือก, ↓ จาก search เข้า list, focus ring แบบ inset | **แก้แล้ว `fb4e8a5`** ตรวจซ้ำผ่าน |

### Major

| # | ไฟล์:บรรทัด | ปัญหา | WCAG | วิธีแก้ | สถานะ |
|---|---|---|---|---|---|
| M1 | `src/lib/styles.js:65` `submitBtnCls` | ขาวบน emerald-600 = 3.65:1 (ปุ่ม "บันทึก…" ใน StickyActionBar, "ทำรายการใหม่" ใน ResultSheet และปุ่ม submit ทุกตัว) | 1.4.3 | `bg-emerald-700` / hover `emerald-800` = 5.36:1 | **แก้แล้ว `ffb47d0`** — ⚠ **flag ให้ design-system-engineer:** เขียวเข้มขึ้น 1 shade ทั้งแอป (รวม desktop/HR) สีเดิมตามเจตนา |
| M2 | `src/lib/styles.js:47` `errorTextCls` + `text-red-500` ที่ hard-code ใน `Order.jsx:464,476`, `OrderCorrection.jsx:767,778`, `StockTransferIn.jsx:589` | error text red-500 บนขาว = 3.81:1 (Order/OC ไม่มี `dark:` ด้วย) | 1.4.3 | red-600 (4.77:1) / `dark:text-red-400` | **แก้แล้ว `ffb47d0`, `dd1e0a5`** |
| M3 | `src/components/BranchSwitcher.jsx:80-96,127` · `src/components/ui/Toaster.jsx` ปุ่มปิด/action | บนมือถือ touch target 58×30 / ~40 / 24×24 / 36 (spec §1.5 กำหนด ≥44); เมื่อข้อความถูกซ่อน (< sm) ปุ่มสาขาได้ชื่อจาก `title` อย่างเดียว | spec §1.5, 2.5.8 | `min-h-11 min-w-11 md:min-h-0`, `aria-label`; toast `size-11 -m-2.5` (ขนาดที่เห็นเท่าเดิม) | **แก้แล้ว `9bc92da`** |
| M4 | Order/OrderCorrection/Share/MemberSignup (date input, ช่องค้นหา/jump ของ OC, ComboBox 6 ตัวใน OC ที่ไม่มี `ariaLabel`, MemberSignup 21 field) | `<label>` ไม่ผูกกับ field → date input ไม่มีชื่อเลย ส่วน field อื่นได้ชื่อจาก placeholder ("สมชาย", "เช่น 1") | 1.3.1, 4.1.2, 3.3.2 | `htmlFor`/`id`, ComboBox `ariaLabel`/`title`, Share ผูก help/error ด้วย `aria-describedby` | **แก้แล้ว `de3603b`** (sweep ซ้ำ = 0) |
| M5 | `Order.jsx:54`, `OrderCorrection.jsx:61`, `Share.jsx:101` ปุ่ม "เปิดตัวเลือกวันที่" | `focus:outline-none` โดยไม่มีตัวแทน → keyboard focus มองไม่เห็น | 2.4.7 | `focus-visible:ring-2 ring-indigo-500` | **แก้แล้ว `de3603b`** (ตรวจ box-shadow ตอน Tab มาถึง) |
| M6 | `src/pages/organization/OperationPlan.jsx:272` | หน้าล้นแนวนอนเป็น 398px ที่ 390 | 1.4.10 | `grid-cols-1` เมื่อ < md | **แก้แล้ว `969d418`** |
| M7 | `src/pages/work/buy/DateInput.jsx:42`, `src/pages/work/sales/DateInput.jsx:29` | ปุ่มปฏิทิน `focus:outline-none` ไม่มี focus ring (แบบเดียวกับ M5) | 2.4.7 | เพิ่ม `focus-visible:ring-2 focus-visible:ring-indigo-500` | **ส่งต่อ frontend-performance-engineer** (เจ้าของไฟล์) |
| M8 | Buy phone: `buy/BuyCustomerSection.jsx:367` (ลงวันที่) · Buy desktop: `buy/BuyCustomerSection.jsx:516-600`, `buy/BuySpecSection.jsx`, `buy/BuyWeighSection.jsx:180+` (23 field) | `<label className={labelCls}>` ไม่มี `htmlFor` → date ไม่มีชื่อ ส่วน field อื่นได้ชื่อจาก placeholder ("เช่น 12000") | 1.3.1, 4.1.2 | ใส่ `id` (เช่น `buy-${key}` แบบ helper `field()` บรรทัด 92-111 ที่ทำถูกอยู่แล้ว) + `htmlFor`; **ไม่กระทบ refs/Enter-flow** | **ส่งต่อ frontend-performance-engineer** |
| M9 | Sales phone: `sales/SalesCustomerSection.jsx:139` (date), `:203` (ใบรับเงิน), `:279/299/328` (บัตร/สมาชิก/ชื่อ) · `sales/SalesTrailerSection.jsx:61,75,90,103,117,132` (6 field × 2 คัน) · `sales/SalesSummary.jsx:17-18` (textarea) · desktop `SalesCustomerSection.jsx:468-537` | แบบเดียวกับ M8: phone 18 field (step 1 = 5, step 3 = 12, step 4 = 1) และ desktop 18 field ไม่มี label ผูก | 1.3.1, 4.1.2 | `id` + `htmlFor` (trailer: `sales-t${i}-${key}`) | **ส่งต่อ frontend-performance-engineer** |
| M10 | `buy/BuyCustomerSection.jsx:101,109` (helper `field()`), `:585` (desktop) · `sales/SalesCustomerSection.jsx:297` | กด "ถัดไป"/บันทึกขณะที่ยังว่าง → focus ไป field แรกที่ผิด แต่ `onFocus={() => clearError(key)}` **ล้าง error + aria-invalid ของ field นั้นทันที** → ทั้งผู้ใช้ screen reader และคนตาดีไม่เห็นข้อความของช่องที่ถูก focus (ทดสอบแล้ว: memberId อยู่ใน toast แต่ไม่มี inline error) | 3.3.1 | ล้าง error ตอน `onChange` แทน `onFocus` (หรือข้ามเมื่อ focus มาจาก validator) | **ส่งต่อ frontend-performance-engineer** (logic เล็ก ๆ ในไฟล์ของเขา) |
| M11 | ทุก field ใน Buy/Sales ที่มี `errors[key]` (เช่น `buy/BuyCustomerSection.jsx:109`, `:220`; `sales/SalesCustomerSection.jsx:147,300,333`) | มี `aria-invalid` แต่ไม่มี `aria-describedby` → SR ได้ยินแค่ "invalid" ไม่รู้ว่าผิดเพราะอะไร | 3.3.1, 1.3.1 | `<p id="buy-{key}-err">` + `aria-describedby` บน input/ComboBox | **ส่งต่อ frontend-performance-engineer** |

### Minor (ไม่แก้: นอก mandate Blocker/Major หรือต้องให้ design ตัดสิน)

| # | ไฟล์:บรรทัด | ปัญหา | WCAG | ข้อเสนอ | ส่งต่อ |
|---|---|---|---|---|---|
| m1 | `src/components/ui/Stepper.jsx:65-74` | ในภาพ dot error ต่างจาก dot ปัจจุบันแค่สี (แดง vs indigo) — SR ได้ข้อความแล้ว | 1.4.1 | ไอคอน `!` ใน dot หรือ caption "· มีข้อผิดพลาด" | design-system-engineer |
| m2 | `src/components/ComboBox.jsx:479-484` | placeholder/sub-label `slate-500` บน `slate-100` = 4.35:1 (ขาดไป 0.15) | 1.4.3 | `slate-600` (ต้องยังต่างจากค่าที่เลือกซึ่งเป็น slate-900) | design-system-engineer |
| m3 | `src/lib/styles.js:112` `primaryBtnCls` | dark hover `bg-indigo-400` + ตัวขาว = 3.13:1 (เกิดบน desktop เท่านั้น เพราะ Tailwind v4 วาง `hover:` ใน `@media (hover:hover)`) | 1.4.3 | `dark:hover:bg-indigo-600` | design-system-engineer |
| m4 | `src/components/ui/DataList.jsx:111` | focus ของ card เป็น ring 1px indigo (เปลี่ยนแค่สีของ ring เดิม) มองเห็นยาก | 2.4.7 (ผ่านขั้นต่ำ) | `has-[button:focus-visible]:ring-2` | design-system-engineer |
| m5 | `src/components/ui/Toaster.jsx:55,136` | error toast `role=alert` อยู่ใน region `aria-live=polite` → SR บางตัวอ่านซ้ำ 2 รอบ | 4.1.3 | ให้ region polite เฉพาะ non-error หรือแยก alert region | design-system-engineer |
| m6 | `src/pages/work/MemberSearch.jsx:612`, `CustomerSearch.jsx:517` (desktop) | ปุ่ม "ดูรายละเอียด" × N ชื่อเหมือนกันทุกแถว (บนมือถือดีแล้ว: "แก้ไข สมชาย ใจดี 1") | 2.4.6 | `aria-label` = "ดูรายละเอียด {ชื่อสมาชิก}" | dashboard-app-dev |
| m7 | `StockBringIn.jsx:527-736` (11 จุด), `StockTransferIn.jsx:717,735,762`, `RiceSpecCreate.jsx:35` | ดอกจัน required เป็น `text-red-500` (3.81:1) และไม่บอก required ในเชิง programmatic | 1.4.3, 3.3.2 | `text-red-600` + `aria-required`/`required` บน field | dashboard-app-dev |
| m8 | `CustomerAdd.jsx:487,549,572,594,650,692`, `Documents.jsx:1303,1321,1353,1377,1614,1786,1814,1842,1871` | ComboBox ไม่มี `ariaLabel` → combobox ไม่มีชื่อ (role combobox ไม่รับชื่อจากเนื้อหา) — route นี้อยู่นอกรายการ WP6 | 4.1.2 | ส่ง `ariaLabel`/`title` = ข้อความ label | dashboard-app-dev (P2) |
| m9 | `CustomerAdd.jsx:49`, `Documents.jsx:142`, `MemberTermination.jsx:70` | ปุ่มปฏิทินไม่มี focus ring (แบบ M5) — นอก route WP6 | 2.4.7 | เหมือน M5 | dashboard-app-dev |

---

## 3. impeccable audit (mode Operate) — สรุปคะแนน

| # | Dimension | ก่อน QA | หลัง QA | Key finding |
|---|---|---|---|---|
| 1 | Accessibility | 2 | 3 | label/describedby ใน Buy/Sales ยังค้าง (M7–M11) |
| 2 | Performance | — | — | อยู่ใน WP5 (frontend-performance-engineer) |
| 3 | Responsive | 3 | 4 | overflow 0 ตั้งแต่ 360 ถึง 1280, touch ≥44, input 16px ครบ |
| 4 | Theming | 3 | 3 | dark mode ครบทุก surface ใหม่; หน้าเก่ายังมีสี red/emerald ที่ hard-code |
| 5 | Implementation integrity | 3 | 3 | detector = 10 (คงที่), primitive ชุดเดียวใช้ทั่วโมดูล trading |

จุดที่ดี: Sheet (dialog/trap/restore/reduced-motion) ทำถูกตั้งแต่แรก; Stepper semantics ครบ; StickyActionBar ซ่อนตอน keyboard ขึ้น + publish ความสูงให้ toast; desktop Enter-flow ไม่เพี้ยนเลยหลัง refactor ใหญ่

---

## 4. Commits (QA)

| commit | เรื่อง | ไฟล์ |
|---|---|---|
| `fb4e8a5` | fix(a11y): keyboard-operable ComboBox picker on phones | `src/components/ComboBox.jsx` |
| `ffb47d0` | fix(a11y): AA contrast for submit button and field error text | `src/lib/styles.js` |
| `9bc92da` | fix(a11y): 44px touch targets for branch switcher and toast buttons | `src/components/BranchSwitcher.jsx`, `src/components/ui/Toaster.jsx` |
| `de3603b` | fix(a11y): link field labels and show focus on date buttons | `Order.jsx`, `OrderCorrection.jsx`, `Share.jsx`, `MemberSignup.jsx` |
| `969d418` | fix(responsive): operation plan filters no horizontal overflow on phones | `src/pages/organization/OperationPlan.jsx` |
| `dd1e0a5` | fix(a11y): readable, linked date errors on Order/OrderCorrection/TransferIn | `Order.jsx`, `OrderCorrection.jsx`, `StockTransferIn.jsx` |

Gate ของทุก commit: จำนวน eslint error ในไฟล์ที่แตะ = เท่ากับ HEAD ก่อนแก้ (ไม่มี error ใหม่ ที่เหลือเป็นของเดิม: OC 3 / Share 2 / MemberSignup 6), `vite build` ผ่าน, impeccable detect = 10. **ไม่แตะ** `vite.config.js`, `Buy.jsx`, `Sales.jsx`, `buy/*`, `sales/*`, `.env*`; ไม่ deploy

---

## 5. ตรวจไม่ได้ (ต้องใช้ staging หรืออุปกรณ์จริง)

1. **Save จริง + ResultSheet จาก response จริง** (Buy/Sales `/save/buy` `/save/sell`): mock บล็อก write → ResultSheet ตรวจผ่าน DevMobileKit + shot ของ builder (`fix-round-1/resultsheet-*`). **ไม่ได้ตรวจว่า payload byte-equal**
2. **Enter-flow ช่วงที่อยู่ + สเปค:** ภายใต้ mock ทั้ง baseline และ HEAD ล็อก template อัตโนมัติและ auto-fill ข้อมูลสมาชิก → ช่วง houseNo…phone และ product…branch ถูก filter ออกทั้งคู่ (เทียบได้เฉพาะลำดับที่เหลือ + array static ตรงกันทุกบรรทัด). ต้องเดินซ้ำบน staging ด้วยสมาชิกที่ไม่มีที่อยู่และฟอร์มที่ไม่ล็อก
3. **ตาราง debt ที่ 390 scroll แบบ native:** หน้า `/debt-form` เปิดได้แต่ตารางต้องใช้ข้อมูลโปรแกรม/ปีงบจริง; การซ่อน StickyTableScrollbar บน coarse pointer ดูได้จาก `mobile-kit/390x844-touch-scrollbar-off.png` ของ builder
4. **iOS Safari จริง:** zoom ตอน focus, safe-area, visualViewport ตอน keyboard ขึ้น (ตรวจได้แค่ Chromium emulation + shot `mobile-kit/390x460-touch-sheet-keyboard.png`)
5. **Screen reader จริง** (VoiceOver/TalkBack/NVDA): ตรวจจาก role/name/live region ใน DOM/accessibility tree เท่านั้น
6. **Role อื่นนอกจาก Admin (role 1):** ยังไม่ได้เดิน UI ที่ gate ด้วย permission (strip/Sidebar) ครบทุก role

---

## 6. Screenshot ใหม่ (`handoff/qa-shots/mobile-after/`)

ถ่ายเฉพาะที่ยังไม่มีใน `mobile-kit/ wp3a/ wp3b/ wp3c/ fix-round-1/`:
- `combobox-picker-390x844-{light,dark}-keyboard-focus.png` — B1 หลังแก้ (focus ring บน option)
- `buy-390x844-{light,dark}-step1-errors-red600-toast44.png` — M2/M3 หลังแก้
- `resultsheet-390x844-{light,dark}-success-emerald700.png` — M1 หลังแก้
- `topbar-390x844-{light,dark}-branch-44.png` — M3 หลังแก้
- `operation-plan-360x640-{light,dark}-no-overflow.png` — M6 หลังแก้
- `order-1280x800-light-regression.png`, `buy-1280x800-light-regression.png` — layout บน desktop ไม่เปลี่ยน
