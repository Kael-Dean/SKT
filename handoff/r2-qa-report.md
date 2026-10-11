# R2 QA: desktop Buy/Sales redesign + copy cleanup (accessibility-qa)

- **วันที่:** 2026-10-11 · **branch:** `dev` · ตรวจบน HEAD `13f336f` + fix ของ QA `84c9b14`, `a1aed4a`
- **ผู้ตรวจ:** accessibility-qa · impeccable `audit`, mode **Operate**
- **เครื่องมือ:** playwright-cli (Chromium) บน Vite dev server ของ worktree นี้ (`127.0.0.1:5173`)
- **Auth/data:** fake JWT (role 1, branch 1, user 17) + mock `/api-proxy/**` ด้วย `context.route`: `/order/form/search` (2 ฟอร์ม + ฟอร์มสเปคไม่ครบอีก 1 ชุดสำหรับเคส error), `/order/klang/search` (สลับ 1 คลัง / 2 คลัง), payment เงินสด + เครดิต, ค้นสมาชิก/บริษัท, save ตอบ 200 (`order_no`) / 422 (`detail[].msg`) / 200 แบบหน่วง 1.5 วินาที (ไว้ทดสอบ loading). หน้าที่ล้างข้อความรันสองรอบ: รอบแรก mock ว่าง รอบสอง mock ส่งแถวข้อมูลที่มีฟิลด์ id ทุกแบบ (`member_id`, `asso_id`, `from_klang` ฯลฯ) เพื่อดูว่ามี fallback ดิบหลุดออกมาหรือไม่
- **Viewport:** 1440×900, 1280×800, 1024×768, 900×1000, 768×1024, 390×844, 360×640 × light/dark

## 1. Checklist

| # | ข้อ | ผล | หลักฐาน |
|---|---|---|---|
| 1 | Enter-flow 3 แบบ + Tab order + focus ring | **PASS** (หลังแก้ M1) | script กด Enter แล้วเก็บ `activeElement` ทุกขั้น. **Buy person:** citizenId → memberId → fullName (list เปิด, Enter เลือก) → payment (Enter เปิด, Enter เลือก) → paymentRefNo → klang (2 คลังที่ยังไม่ได้เลือก: Enter เปิด/เลือก; มีค่าแล้ว: Enter ไปต่อ) → entryWeight → exitWeight → moisture → impurity → gram → unitPrice → amountTHB → "บันทึกออเดอร์" **ตรงทุกขั้น**. **Buy company:** companyName (เลือกจาก list) → taxId → companyPhone → payment → paymentRefNo → klang → entryWeight **ตรง**. **Sales เงินสด 1 คัน:** … → refDoc → klang → trailerCount → 12 ช่อง → save **ตรง**. **Sales เครดิต 2 คัน:** refDoc → deptAllowed → deptPostpone → (ติ๊กแล้ว) deptPostponePeriod → klang → trailerCount → 24 ช่อง → save **ตรง**. ถ้ามีคลังเดียว (mock 1 คลัง) ระบบเลือกให้อัตโนมัติแล้ว Enter ไปต่อ. ลงวันที่เข้าได้ด้วย Tab (3 segment + ปุ่มปฏิทิน). Tab sweep ทั้ง 2 หน้าไม่มี tab stop ที่ถูกซ่อน (ช่องที่อยู่ใน `<details>` ที่ปิดอยู่ถูกข้าม). Autofocus `buy-citizenId` / `sales-citizenId` ทุก desktop viewport. Ctrl+S และ Ctrl+Enter บันทึกได้; ถ้า ConfirmDialog เปิดอยู่กดแล้วไม่มี POST (0). "ทำรายการใหม่" → focus `citizenId` และฟอร์มสินค้ากับคลังยังอยู่. **Focus ring:** ก่อนแก้ ปุ่มทุกตัว (segmented, ลบคัน, เพิ่มคัน, ปุ่มใน panel) เหลือแค่ halo indigo 20% (~1.3:1) → แก้แล้ว (M1) shot `focus-*` (ก่อน) / `focus-after-*` (หลัง) |
| 2 | Segmented ประเภทผู้ซื้อ | **PASS** | `role=radiogroup` ชื่อ "ประเภทผู้ซื้อ", ใช้ roving tabindex (0/-1) และ `aria-checked`; กด → แล้วเปลี่ยนเป็นบริษัท พร้อมแสดง `buy-taxId` และ `buy-companyPhone`; กด ← แล้วกลับ |
| 3 | OrderSummaryPanel | **PASS** (หลังแก้ M2, M3) | ariaSnapshot: `region "สรุปรายการ"` → `heading [level=2]` → คู่ term/definition (ยอดเงินรวม = `definition: ฿240,000.00` อ่านเป็นข้อความได้) → ปุ่ม 2 ปุ่ม → hint `Enter … Ctrl + S บันทึก` (`<kbd>`). Loading: label "กำลังบันทึก…" + `aria-busy` + `aria-disabled`, focus ยังอยู่ที่ปุ่ม, กด Enter ซ้ำหรือ Ctrl+S ระหว่างบันทึกยังส่ง POST แค่ 1 ครั้ง (shot `panel-1280x800-light-saving.png`). Sticky ≥1024: panel สูง 452/482px น้อยกว่าพื้นที่ใต้ topbar ทุก viewport จึงไม่ทับหรือถูกตัด. 768–1023: `position: static` อยู่ใต้ฟอร์ม (`below=true`) ไม่ซ้อนกัน. ที่ 1024 เป็น 2 คอลัมน์ตามแผน (≥lg) |
| 4 | ตารางรถพ่วง | **PASS** (+ Minor m3) | ทุก input มีชื่อ `คันที่ N พ่วงหน้า/พ่วงหลัง <ช่อง>` (24/24 ช่องเมื่อมี 2 คัน); ปุ่มลบ `ลบรถคันที่ N` 36×36; "เพิ่มคัน" 97×40; ที่ 1024 ไม่ล้น (`scrollWidth = innerWidth`) แต่หัวคอลัมน์ถูกตัดเป็น "ราคา/กก…", "คุณภา…" (m3) |
| 5 | Contrast AA light/dark | **PASS** (หลังแก้ M3, + Minor) | checker วนทุก text node ใน `main` แปลง oklch ผ่าน canvas และ composite พื้นหลังโปร่งแสง: chip สเปค, badge สถานะลูกค้า, แถวรถ, kbd, ปุ่มใน panel ผ่านทั้งสองธีม. ก่อนแก้ ค่าสีจางใน panel ("ยังไม่ได้เลือก", "—", "0 กก.") = **2.60:1** light / **3.03:1** dark → หลังแก้ผ่าน. ที่เหลือคือ m1 (เครื่องหมาย −/= 2.49) และ m2 (placeholder ของ ComboBox 4.35) |
| 6 | Error | **PASS** | Ctrl+S ตอนฟอร์มว่าง → toast `role=alert` "บันทึกไม่สำเร็จ ยังไม่ได้กรอก: รหัสสมาชิก, ชื่อ-สกุล, วิธีชำระเงิน และอีก 8 ช่อง…", focus ไป `buy-memberId` ที่มี `aria-invalid=true`. ช่องที่ invalid ทั้ง 11 ช่องมี `aria-describedby` ชี้ไปยังข้อความ error ที่มีอยู่จริง (M10/M11 ของรอบก่อนแก้แล้ว). Error สเปค: ฟอร์มที่ไม่มีชนิดข้าว → `buy-formTemplate` มี `aria-invalid` + describedby "ฟอร์มสินค้านี้ข้อมูลไม่ครบ เลือกฟอร์มอื่น" (shot `buy-1280x800-light-spec-error.png`). 422 → ResultSheet "ข้อมูลไม่ผ่านการตรวจ" + ข้อความไทยจาก `detail[].msg` (ไม่มี HTTP code). ก่อนแก้ ปิด sheet แล้ว focus หลุดไป `<body>` (M2) |
| 7 | ไม่มี horizontal overflow | **PASS** | Buy/Sales × 7 viewports × 2 ธีม = 28 page loads: `scrollWidth <= innerWidth`; หน้าที่ล้างข้อความทั้ง 12 หน้าที่ 1280 ก็ไม่ล้น |
| 8 | มือถือ 390 | **PASS** | ไม่มี autofocus (`activeElement = body`), stepper `aria-current=step` "ขั้น 1: ลูกค้า", กด "ถัดไป" ตอนฟอร์มว่าง → "ขั้น 1: ลูกค้า (มีข้อผิดพลาด)" + toast + focus `memberId`; ไม่พบศัพท์ dev (shot `mobile-*-390x844-light-next-errors.png`) |
| 9 | หน้าที่ล้างข้อความ | **PASS** | 12 หน้า + Buy/Sales: ค้น regex ที่กำหนดใน `body.innerText` และใน `placeholder`/`aria-label`/`title` → **0 hit** ทั้ง mock ว่างและ mock มีข้อมูล. MemberSearch/CustomerSearch ค้น "สมชาย" แล้วเปิดรายละเอียด → 0 hit (เพิ่ม `#\d` ในการค้นด้วย). ดูด้วยตาจาก shot `copy-*-1280x800-light-{emptymock,datamock}.png`: TransferIn แสดง "สถานะ: รอรับ/รับแล้ว"; RiceSpecCreate และ Documents ไม่มี debug box หรือ JSON |
| 10 | Console error ใหม่ | **PASS** | 0 ใน 14 routes × 2 mock (ไม่นับ CSP `frame-ancestors`) |
| 11 | Gate | **PASS** | `vite build` ผ่าน; eslint error **197** (เท่ากับก่อนแก้, ≤197); `npx impeccable detect src/pages/work src/components` = **10** (เท่าเดิม); `detect.mjs` เฉพาะไฟล์ Buy/Sales/buy/sales/OrderSummaryPanel = **0** |

## 2. Findings

รวม **Blocker 0 · Major 3 (แก้แล้วทั้ง 3) · Minor 7 (ค้าง)**

### Major

| # | ไฟล์:บรรทัด | ปัญหา | WCAG | วิธีแก้ | สถานะ |
|---|---|---|---|---|---|
| M1 | `src/index.css:198` (มีมาตั้งแต่ initial commit) | animation `focus-ring-in` ใช้ fill-mode `both` บน `button:focus-visible` ทำให้ box-shadow ตอนจบ animation ทับ `focus-visible:ring-*` ของ Tailwind บนปุ่ม**ทุกตัว**: ring indigo-500/emerald-500 + offset ถูกแทนด้วย halo indigo 20% กว้าง 3px (~1.3:1). โดนทุก control ใหม่ (segmented, ลบคัน/เพิ่มคัน, ปุ่มบันทึก/ล้างฟอร์มใน panel, trigger ของ ComboBox) | 2.4.7, 1.4.11 | ยกเว้นปุ่มที่ class มี `focus-visible:ring` / `focus:ring` อยู่แล้ว ส่วนปุ่มที่ไม่มี ring ของตัวเองยังได้ halo เหมือนเดิม; input/select/textarea ไม่เปลี่ยน | **แก้แล้ว `84c9b14`**. ตรวจด้วย computed style + crop: ring ทึบพร้อม offset (`focus-after-*.png`). ⚠ **flag ให้ design-system-engineer:** มีผลทั้งแอป ปุ่มจะแสดง ring ตามที่เขียนไว้ใน class (ตรงกับเจตนาเดิมของ class) |
| M2 | `src/components/ui/OrderSummaryPanel.jsx:108` | ระหว่างบันทึกปุ่มถูก `disabled` ทำให้ focus หลุดไป `<body>` และ useFocusTrap จำ opener เป็น body → ปิด ResultSheet ที่เป็น error (Esc / "แก้ไขข้อมูล" / "ปิด") แล้ว focus ไปอยู่ต้นเอกสาร ผู้ใช้คีย์บอร์ดต้อง Tab ไล่ใหม่ทั้งหน้า (เกิดทั้ง Buy และ Sales เมื่อบันทึกด้วย Enter บนปุ่ม ซึ่งเป็นขั้นสุดท้ายของ Enter-flow) | 2.4.3 | ใช้ `aria-disabled` + `aria-busy` แทน `disabled` ตอน loading, onClick กันกดซ้ำด้วย `preventDefault`, ใส่ `opacity-60 cursor-wait`; ใน `Sales.jsx` `editTrailers` (desktop) ให้ focus หลัง sheet คืน focus แล้ว (40ms เหมือน `focusFirstCustomerField`) | **แก้แล้ว `a1aed4a`**. ตรวจซ้ำ: Buy Esc / "แก้ไขข้อมูล" → focus "บันทึกออเดอร์"; Sales Esc → "บันทึกออเดอร์"; "แก้ไขรถพ่วง" → `sales-t0-scaleNoFront`; success → `citizenId`; Enter/Ctrl+S ระหว่างบันทึก → POST 1 ครั้ง |
| M3 | `src/components/ui/OrderSummaryPanel.jsx:76` | ค่าสีจางใน panel: gray-400 บนขาว = 2.60:1, gray-500 บน gray-800 = 3.03:1 | 1.4.3 | `text-gray-500 dark:text-gray-400` | **แก้แล้ว `a1aed4a`** (รัน checker ซ้ำผ่านทั้งสองธีม) |

### Minor (ค้าง: เกินขอบเขต Blocker/Major หรือต้องให้ design ตัดสิน)

| # | ไฟล์:บรรทัด | ปัญหา | WCAG | ข้อเสนอ | ส่งต่อ |
|---|---|---|---|---|---|
| m1 | `src/pages/work/buy/BuyWeighSection.jsx:243,268` | เครื่องหมาย "−" / "=" ในแถบคำนวณน้ำหนักเป็น gray-400 = 2.49:1 (dark 3.30) แม้เป็น `aria-hidden` แต่ยังสื่อความหมายในภาพ | 1.4.3 | `text-gray-500 dark:text-gray-400` | dashboard-app-dev |
| m2 | `src/components/ComboBox.jsx` (placeholder) | slate-500 บน slate-100 = 4.35:1 (ยกมาจาก m2 รอบก่อน) | 1.4.3 | slate-600 | design-system-engineer |
| m3 | `src/pages/work/sales/SalesTrailerSection.jsx:324` | ที่ 1024 หัวคอลัมน์ถูกตัดเป็น "ราคา/กก…", "คุณภา…", "น้ำหนักสุท…" (input ยังมีชื่อเต็มสำหรับ screen reader) ผู้ใช้ที่ดูจอจึงอ่านหัวคอลัมน์ไม่ครบ | 1.3.1 (ภาพ) | ให้หัวคอลัมน์ตัดขึ้นบรรทัดใหม่แทน `truncate` ช่วง lg–xl หรือใช้ชื่อสั้น ("ราคา", "กรัม", "สุทธิ") | dashboard-app-dev |
| m4 | `src/lib/styles.js:71` `submitBtnCls` | ring emerald-500 บน offset สีขาว ≈2.5:1 (ต่ำกว่า 3:1) | 1.4.11 | `focus-visible:ring-emerald-700` หรือ indigo-600 | design-system-engineer |
| m5 | `src/pages/work/Buy.jsx:1950` | เมื่อได้ 422 ปุ่ม "แก้ไขข้อมูล" คืน focus ไปที่ปุ่มบันทึก ไม่ได้พาไปช่องที่ server ปฏิเสธ | 3.3.1 (enhancement) | map `detail[].loc` → field key แล้ว focus/ใส่ `aria-invalid` ช่องนั้น | dashboard-app-dev |
| m6 | `src/pages/work/buy/BuyWeighSection.jsx:287` | track ของ switch "กำหนดน้ำหนักหักเอง" ตอนปิด (gray-300 บน gray-50) ≈1.3:1 | 1.4.11 | ขอบ gray-400 หรือ track gray-400 | design-system-engineer |
| m7 | `src/index.css:198` | ปุ่มที่ไม่มี ring ของตัวเองยังได้แค่ halo 20% (ทั่วแอป ไม่ใช่ปุ่มของ R2) | 2.4.7 | ทำ halo ให้ทึบขึ้น (indigo-500 ≥60%) หรือเติม `focusRingCls` ให้ปุ่มเหล่านั้น | design-system-engineer |

## 3. impeccable audit (mode Operate): Buy / Sales / OrderSummaryPanel

| # | Dimension | Score | Key finding |
|---|---|---|---|
| 1 | Accessibility | 3 → **4** หลังแก้ | semantics ครบ (radiogroup, dl/dt/dd, describedby, ชื่อช่องรถพ่วง, live status); ที่ค้างเป็น Minor ด้าน contrast |
| 2 | Performance | 3 | ไม่ได้วัดรอบนี้; ไม่มี animation หนัก, panel ไม่มี state หรือ effect |
| 3 | Theming | 4 | dark mode ครบทุก surface ใหม่, ใช้ class จาก `styles.js` ร่วมกัน |
| 4 | Responsive | 3 | ไม่ล้นตั้งแต่ 360 ถึง 1440, panel sticky/static ถูก breakpoint; หัวคอลัมน์รถพ่วงถูกตัดที่ 1024 (m3) |
| 5 | Implementation integrity | 4 | detector = 0 ในไฟล์ R2; Buy/Sales ใช้ OrderSummaryPanel ตัวเดียวกัน |

**Health 18/20 (Excellent).** ความสูงหน้าเหลือ 1.42 / 1.59 จอที่ 1440 / 1280 (Buy) และ 1.37 / 1.54 (Sales) ใกล้เป้า ≤ ~1.5 จอ

## 4. Commits (QA)

| commit | เรื่อง | ไฟล์ |
|---|---|---|
| `84c9b14` | fix(a11y): show each button's own focus ring instead of the faint global halo | `src/index.css` |
| `a1aed4a` | fix(a11y): summary panel keeps focus while saving, readable empty values | `src/components/ui/OrderSummaryPanel.jsx`, `src/pages/work/Sales.jsx` |

ไม่แตะ logic, payload หรือลำดับ Enter (รัน Enter-flow ทั้ง 3 แบบซ้ำหลังแก้ ได้ลำดับเดิม); ไม่แตะ `.env*`; ไม่ deploy

## 5. ตรวจไม่ได้

1. Save จริงกับ staging: ใช้ mock ทั้งหมด จึงไม่ได้เทียบว่า payload byte-equal กับ baseline (ใน mock ไม่มี POST ซ้ำ)
2. Screen reader จริง (NVDA/VoiceOver): ตรวจจาก accessibility tree (ariaSnapshot) และ attribute เท่านั้น
3. ข้อความที่ขึ้นกับข้อมูลจริงเฉพาะทาง (ต้นไม้สต็อก, ข้อความ error ของ backend แต่ละแบบ) ตรวจได้เท่าที่ mock ทั่วไปไปถึง

## 6. Screenshots (`handoff/qa-shots/r2-qa/`, ไม่ถูก track)

`buy-1280x800-light-{initial,filled,result-sheet,save-422,ctrl-s-empty,spec-error,company-segment-focus}.png`, `sales-1280x800-{light-initial,light-filled,light-credit-2trailers,dark-initial,dark-filled}.png`, `layout-{Buy,sales}-{1440x900,1024x768,768x1024,390x844}-{light,dark}.png`, `after-buy-1280x800-{light,dark}.png`, `focus-*.png` (ก่อนแก้) / `focus-after-*.png` (หลังแก้), `panel-1280x800-light-saving.png`, `mobile-{Buy,sales}-390x844-light-next-errors.png`, `copy-*-1280x800-light-{emptymock,datamock}.png`, `copy-{search,customer-search}-1280x800-light-detail.png`
