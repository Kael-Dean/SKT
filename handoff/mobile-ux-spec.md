# SKT — Mobile UI-SPEC: โมดูลธุรกิจรวบรวมผลผลิต

> ผู้เขียน: product-ux-designer · impeccable `shape` · mode **Operate**
> อ้างอิง: แผน `C:\Users\User\.claude\plans\ux-ui-swift-liskov.md` (§A–C), `.impeccable.md`, `src/lib/styles.js`, `src/components/ui/*`
> ผู้รับ: WP3a/WP3b/WP3c (`dashboard-app-dev`), WP4 (`ux-writer`), WP6 (`accessibility-qa`)
>
> **กติกาของ spec นี้**
> - ทุก component ที่อ้าง = primitive ใน §B ของแผน (`Sheet`, `Stepper`, `StickyActionBar`, `DataList`, `SearchField`, `ResultSheet`, `ComboBox`) หรือของที่มีอยู่แล้ว (`Card`, `Badge`, `EmptyState`, `ErrorState`, `Skeleton*`, `toast`, `ConfirmDialog`) — **ไม่มี component ใหม่** ยกเว้นที่ระบุใน §13 "ข้อเสนอเพิ่ม"
> - `<md` = phone (`useIsPhone()` / `max-width: 767.98px`); `≥md` = desktop/tablet **ห้ามเปลี่ยน**
> - ข้อความ UI ในไฟล์นี้เป็น **ค่าเริ่มต้น** — `ux-writer` (WP4 `handoff/mobile-copy.md`) เป็นผู้ชี้ขาด copy สุดท้าย; builder import string จากที่นั่น
> - หมายเหตุ setup: โปรเจกต์ไม่มี `PRODUCT.md` (impeccable init) — spec นี้ใช้แผนที่อนุมัติแล้วเป็น product truth และ `.impeccable.md` เป็น design authority แทน ไม่สร้างไฟล์เพิ่ม

---

## 1. หลักการ + mode (Operate)

### 1.1 ฉากใช้งานจริง (ที่ทุกการตัดสินใจต้องรับใช้)

| ข้อเท็จจริง | ผลต่อการออกแบบ |
|---|---|
| พนักงานหน้าตาชั่งถือมือถือมือเดียว, มืออีกข้างถือใบชั่ง, เกษตรกรยืนรอ | ลำดับฟิลด์ = ลำดับที่ข้อมูลมาถึงมือ (ลูกค้า → สเปค → น้ำหนัก → เงิน) ไม่ใช่ลำดับ payload; ปุ่มหลักอยู่ล่างจอในระยะนิ้วโป้ง (`StickyActionBar`) |
| แดดจ้า, จอ Android ราคาประหยัด 360×640 | contrast สูง (text-gray-900/gray-100), ตัวเลขเงินใหญ่ `text-xl` ขึ้นไป, ไม่พึ่งสีอ่อน/opacity ในการสื่อความหมาย |
| มือเปื้อน/ถุงมือ | touch target **≥44×44** ทุก interactive element (`min-h-touch`/`size-touch`), ช่องว่างระหว่างปุ่ม ≥8px, ไม่มี hover-only affordance |
| กรอกซ้ำวันละหลายสิบรายการ | ความคุ้นเคย > ความแปลกใหม่ (product slop test ของ Operate): component เดิมหน้าตาเดิมทุกหน้า; ไม่มี motion ตกแต่ง; "ทำรายการใหม่" กลับไป step 1 ภายใน 1 แตะ |
| ข้อมูลที่เครื่องรู้แล้ว (สาขาจาก JWT, สเปคจาก template, ที่อยู่จาก auto-fill) | แสดงเป็น read-only card/chip ไม่ใช่ input ว่าง ๆ 8 ช่องให้เลื่อนผ่าน |

### 1.2 Density + ลำดับความสำคัญบนจอเล็ก

1. **ตัวเลขที่ต้องอ่านออกเสียงให้เกษตรกรฟัง** (น้ำหนักสุทธิ, เป็นเงิน) — ใหญ่สุด, อยู่ใน sticky bar ตลอดเวลาที่อยู่ step 3-4
2. **ฟิลด์ที่ต้องกรอกเอง** (เลขบัตรชั่ง, น้ำหนัก, ความชื้น, ราคา) — input เต็มความกว้าง 1 คอลัมน์, h-12 (`p-3` ของ `baseField` + 16px = ~48px)
3. **ฟิลด์ที่ระบบเติมให้** (ที่อยู่, สเปค 8 ตัว, สาขา) — หุบใน `<details>` หรือ read-only card
4. **ฟิลด์เสริม** (comment, paymentRef ที่ไม่บังคับ) — อยู่ท้าย step หรือ step 4

หนึ่งหน้าจอ 360×640 (หัก Topbar 64 + Stepper 56 + StickyActionBar 96) เหลือ ~424px = ฟิลด์ 1 คอลัมน์ประมาณ 4 ช่อง → ทุก step ต้องจัดกลุ่มให้ "ฟิลด์ที่ต้องกรอกเอง" ของ step นั้นอยู่ใน 1–2 จอเลื่อน

### 1.3 สีตามความหมาย (ห้ามใช้นอกตาราง)

| สี | ใช้กับ | ห้าม |
|---|---|---|
| `indigo` (accent เดียว) | step ปัจจุบัน/ผ่านแล้วบน `Stepper`, focus ring, ComboBox check icon, ปุ่ม secondary outline (`secondaryBtnCls`), link "เปลี่ยนฟอร์ม", `Badge tone=info` | พื้นหลัง card, decoration |
| `emerald` | ปุ่มบันทึก/ยืนยัน (`submitBtnCls`), `ResultSheet tone=success`, `Badge tone=success` ("ครบ", "เลือกแล้ว", "สำเร็จ"), dot พ่วงหน้าใน trailer summary (ของเดิม) | ปุ่ม "ถัดไป" (ใช้ `primaryBtnCls` indigo — ถัดไป ≠ บันทึก) |
| `red` | dot error บน `Stepper`, `errorTextCls`, `aria-invalid` border, `Badge tone=danger` ("ผิดพลาด n"), `ResultSheet tone=error`, ปุ่มลบรายการในลอต (`dangerBtnCls`) | ตัวเลขติดลบทั่วไป |
| `amber` | `Badge tone=pending` ("รอดำเนินการ", "ยังไม่ล็อกฟอร์ม"), toast.warning | error |
| `gray` | ทุกอย่างที่เหลือ: label, subtitle, read-only, divider, handle ของ Sheet | — |

### 1.4 Typography scale มือถือ (`<md`) — fixed rem, family เดิมของแอป

| บทบาท | class | ขนาด |
|---|---|---|
| Page title (h1) | `text-xl font-bold` (ลดจาก `text-3xl` เดิม เฉพาะ <md: `text-xl md:text-3xl`) — **ตัด emoji นำหน้าออกบน <md** | 20px |
| Step label บน Stepper | `text-sm font-semibold` (current) / `text-sm text-gray-500` (อื่น) | 14px |
| Section title | `sectionTitleCls` เดิม | 12px uppercase |
| Label ฟิลด์ | `labelCls` → บน <md บังคับ `text-sm font-medium text-gray-600 dark:text-gray-300` (14px) | 14px |
| Input value | `baseField` หลัง B1 = `text-base` | 16px (กัน iOS zoom) |
| Helper/error | `helpTextCls` / `errorTextCls` | 14px |
| `dl` summary — dt | `text-sm text-gray-500 dark:text-gray-400` | 14px |
| `dl` summary — dd | `text-base font-medium text-gray-900 dark:text-gray-100 tabular-nums` | 16px |
| ตัวเลขเงิน/น้ำหนักเด่น (sticky bar, calc card, ResultSheet) | `text-xl font-bold tabular-nums` | 20px |
| ยอดเงินรวม step 4 / ResultSheet หลัก | `text-2xl font-bold tabular-nums` | 24px |
| Badge | `badgeCls` เดิม | 12px |
| line-height ไทย | `leading-relaxed` บนทุก label/dd/description | — |

ตัวเลขทุกตัวที่เรียงกันในคอลัมน์ = `tabular-nums text-right`. เงินใช้ `thb()`, น้ำหนักใช้ `nf()` + " กก." เสมอ

### 1.5 Touch + spacing

- ปุ่ม: `primaryBtnCls`/`neutralBtnCls`/`dangerBtnCls` หลัง B1 = `h-11 md:h-10`; ปุ่มใน `StickyActionBar` = `h-12`; icon-only = `iconBtnCls` (`size-11 md:size-9`)
- Card: `cardCls` + `p-4` (<md) ตาม `.impeccable.md`; ระยะระหว่าง card `space-y-4`; page padding `p-4` เดิม
- Row ที่กดได้ (DataList, ComboBox picker, `<details><summary>`) = `min-h-touch` + `px-4`
- ห้ามวาง interactive element 2 ตัวห่างกัน <8px (ยกเว้น segmented ที่เป็นกลุ่มเดียว)

---

## 2. IA มือถือ

### 2.1 Home — strip "ทางลัด" + tile กลุ่ม

```
┌ Topbar ───────────────────────────────┐
│ [☰]  SKT          [สาขา ▾] [🔔] [👤] │
├───────────────────────────────────────┤
│ welcome card (เดิม)                   │
│                                       │
│ ทางลัด                                │  ← section title (sectionTitleCls)
│ ┌────┐┌────┐┌────┐┌────┐┌────┐ ›     │  ← horizontal scroll strip, snap-x
│ │ซื้อ ││ขาย ││คลัง││ออเดอร์││รับเข้า│      │     chip w-[4.75rem] min-h-touch
│ └────┘└────┘└────┘└────┘└────┘       │
│                                       │
│ 🌾 ธุรกิจรวบรวมผลผลิต                  │
│ ┌───────────┐ ┌───────────┐           │  ← grid-cols-2 gap-3
│ │ [icon] ยกมา│ │ [icon] ยกเข้าโรงสี│   │     tile min-h-touch, label 14px
│ └───────────┘ └───────────┘           │
│ ...                                   │
│ 🪪 ทะเบียนสมาชิก  (grid-cols-3)        │
└───────────────────────────────────────┘
```

| ส่วน | spec |
|---|---|
| Source | `ALL_FUNCTIONS`/`TRADING_GROUP`/`canAccessItem` จาก `src/lib/homeFunctions.js`; recents จาก `getRecent()` (`src/lib/recentRoutes.js`, max 6, เฉพาะ trading route) |
| ลำดับ strip | **pinned ก่อน** (`/Buy` ซื้อ, `/sales` ขาย, `/stock` คลัง, `/order` ออเดอร์ — ตามลำดับนี้) แล้วต่อด้วย recents ที่ไม่ซ้ำ pinned; ทั้งหมดกรองด้วย `canAccessItem(item, roleId)` ก่อน render; ถ้าหลังกรองเหลือ 0 → ไม่ render section "ทางลัด" เลย (ไม่แสดง empty) |
| Chip | `button` `flex flex-col items-center gap-1 w-[4.75rem] min-h-touch rounded-2xl` `cardCls`; icon lucide `size-5` ใน `size-9 rounded-xl bg-gray-100 dark:bg-gray-700/60` (pattern เดียวกับ `PageSection` icon); label `text-xs font-medium` ไม่ตัดคำ (`text-balance`, 2 บรรทัดได้); recents มี `Badge tone=neutral` เล็ก "ล่าสุด" ไม่ต้อง — ใช้ลำดับบอกแทน |
| Scroll | `flex gap-2 overflow-x-auto snap-x snap-mandatory -mx-4 px-4 pb-1 [scrollbar-width:none]`; chip `snap-start`; ≥md: `hidden` (desktop ไม่มี strip) |
| Tile กลุ่ม trading | `<md`: `grid-cols-2 gap-3`; tile = `cardCls p-3 flex items-center gap-3 min-h-touch`: icon chip ซ้าย (lucide ผ่าน `lucideFor(path)`) + label `text-sm font-medium leading-relaxed` ซ้ายชิด (ไม่ center — ชื่อยาวอย่าง "ยกเข้าโรงสี" อ่านง่ายกว่า) ; กลุ่มอื่น `grid-cols-3` label `text-xs`; ≥md: layout เดิม |
| Emoji | <md ใช้ lucide แทน emoji ทั้ง strip และ tile (emoji render ต่างกันระหว่าง Android/iOS และเล็กเกินไปที่ 360); ≥md คงเดิม |
| State | loading: `SkeletonCard` ×1 สำหรับ strip + skeleton tile เดิม; `checkAccess` เดิม |

### 2.2 Sidebar (<md) — หมวด "ธุรกิจรวบรวมผลผลิต"

- panel `h-dvh pb-safe`, กว้าง `w-[85vw] max-w-xs`
- เพิ่มหมวด `md:hidden` ชื่อ "ธุรกิจรวบรวมผลผลิต" **อยู่บนสุดถัดจาก Home** (ก่อนหมวด HR/แผน) — items = `TRADING_GROUP.items` + items ของกลุ่ม "ออเดอร์ & คลังสินค้า" (`/order`, `/order-correction`, `/stock`) กรองด้วย `canAccessItem`; icon lucide `size-5`; row `min-h-touch px-4` ; active = `bg-indigo-50 text-indigo-700 dark:bg-indigo-900/20 dark:text-indigo-300`
- หมวดยุบ/ขยายได้ตามกลไกเดิมของ Sidebar; default **ขยาย** บน <md
- Footer (sticky ล่าง, `pb-safe`): แถว "โหมดมืด" = label + switch (toggle ที่ย้ายมาจาก Topbar) `min-h-touch`; ถัดไปแถว logout เดิม

### 2.3 Topbar (<md)

```
[‹ 44] [☰ 44]   (logo/ชื่อหน้า text-base font-semibold truncate)   [สาขา ▾ max-w-28] [🔔 44] [avatar 44]
```

| element | spec |
|---|---|
| ปุ่มย้อนกลับ | แสดงเมื่อ `back` prop ไม่ null (ทุกหน้าที่ไม่ใช่ `/home`); `iconBtnCls` chevron-left; `aria-label="ย้อนกลับไป {label}"`; ปลายทาง = `PARENT_ROUTES` เดิม/`/home`; **อยู่ซ้ายสุดเสมอ** (Jakob's law: ตำแหน่ง back ของ Android/iOS) |
| Hamburger | `iconBtnCls`; ถ้ามีปุ่มย้อนกลับ hamburger อยู่ถัดไปทางขวา |
| กลาง | ชื่อหน้า (จาก `document.title`/route label) `truncate`; search decorative = `hidden md:flex` |
| BranchSwitcher | compact: แสดงชื่อสาขาย่อ `max-w-[7rem] truncate` + chevron; hit area `min-h-touch`; เปิดเป็น panel เดิม (≥10050 z) |
| Bell | hit `size-11`, icon `size-5`, badge count เดิม |
| Avatar | `size-11` hit, รูป `size-8` |
| Dark toggle | `hidden md:inline-flex` (ย้ายไป Sidebar footer) |
| ความสูง | `h-14` (<md) / เดิม (≥md); ตั้ง `--topbar-h` ผ่าน ResizeObserver (B1) |

---

## 3. Buy — stepper 4 ขั้น (`<md` เท่านั้น)

### 3.0 โครงหน้า

```
Topbar (sticky)                         --topbar-h
Stepper (sticky top-(--topbar-h))       h-14, bg-white/95 backdrop-blur dark:bg-gray-900/95, border-b
  ● ── ● ── ○ ── ○    "ขั้น 2/4 · สเปค/คลัง"
<section step>  p-4 space-y-4  (mount ทีละ section — A3)
spacer h-24 md:hidden
StickyActionBar (fixed bottom, pb-safe)
```

`Stepper` props: `steps=[{key:"customer",label:"ลูกค้า",shortLabel:"ลูกค้า"},{key:"spec",label:"สเปค/คลัง",shortLabel:"สเปค"},{key:"weigh",label:"ชั่งน้ำหนัก",shortLabel:"ชั่ง"},{key:"review",label:"ตรวจสอบ",shortLabel:"ตรวจ"}]`, `current`, `maxReached`, `errorSteps`, `onSelect`. บน 360px แสดง dot 4 จุด + label เฉพาะ step ปัจจุบัน ("ขั้น 2/4 · สเปค/คลัง"); ≥390px แสดง `shortLabel` ใต้ทุก dot. กด dot ย้อนได้เฉพาะ `≤ maxReached` (ไม่ validate ตอนย้อน); กดไปข้างหน้าผ่าน dot ไม่ได้ — ต้องผ่านปุ่ม "ถัดไป"

### 3.1 Step 1 — ลูกค้า

| # | field (ref key) | control | หมายเหตุ |
|---|---|---|---|
| 1 | ประเภทผู้ซื้อ (`buyerType`) | **segmented** 2 ช่อง `segmentedCls` (B1): "บุคคล" / "บริษัท" `h-11` `role=radiogroup` | แทน ComboBox เดิมเฉพาะ <md (ค่า state เดิม `person`/`company`) |
| 2 | ฟอร์มสำเร็จรูป (`formTemplate`) | `ComboBox searchable` (เปิด picker Sheet full + search) | helper ใต้ช่อง: "ฟอร์มจะล็อกสเปคสินค้าในขั้นถัดไป"; ถ้าเลือกแล้ว แสดง `Badge tone=info` "ล็อกสเปคแล้ว" ขวาของ label |
| 3a | *(บุคคล)* เลขบัตรประชาชน (`citizenId`) | `input inputMode=numeric maxLength=13` + ผลค้นหา `SearchField.SearchResults` render inline ใต้ช่อง | keyboard handler เดิม (Buy.jsx:1569-1584) — เปลี่ยนแค่ markup list |
| 3b | รหัสสมาชิก (`memberId`) | `input inputMode=numeric` + SearchResults inline | |
| 3c | ชื่อ–สกุล (`fullName`) | `input` + SearchResults inline (debounce 400ms เดิม) | label ย่อเป็น "ชื่อ–สกุล" + helper "พิมพ์ 2 ตัวอักษรเพื่อค้นหา" |
| 3d | **ที่อยู่** (`houseNo, moo, subdistrict, district, province, postalCode, phone`) | `<details>` disclosure: `<summary min-h-touch>` แสดง "ที่อยู่ · {houseNo} ม.{moo} ต.{subdistrict} อ.{district} จ.{province}" truncate 1 บรรทัด + chevron; body = 7 input 1 คอลัมน์ (รหัสไปรษณีย์ `inputMode=numeric`, เบอร์โทร `inputMode=tel`) | **เปิดอัตโนมัติ** เมื่อ auto-fill ไม่ได้ (เลือกผลค้นหาแล้วที่อยู่ว่าง) หรือพิมพ์ชื่อใหม่ที่ไม่มีในระบบ; **หุบอัตโนมัติ** เมื่อ auto-fill ครบ; summary เมื่อว่าง = "ที่อยู่ · ยังไม่มีข้อมูล" + `Badge tone=pending` "กรอกเอง" |
| 4a | *(บริษัท)* ชื่อบริษัท (`companyName`) | `input` + SearchResults inline | |
| 4b | เลขผู้เสียภาษี (`taxId`) | `input inputMode=numeric maxLength=13` | |
| 4c | เบอร์โทร (`companyPhone`) | `input inputMode=tel` | |
| 4d | ที่อยู่สำนักงานใหญ่ (`hq*` 6 ช่อง) | `<details>` "สำนักงานใหญ่ · …" กติกาเดียวกับ 3d | |
| 4e | ที่อยู่สาขา (`br*` 6 ช่อง) | `<details>` "ที่อยู่สาขา · …" default หุบ | |
| 5 | วิธีชำระเงิน (`payment`) | `ComboBox` (options น้อย → ไม่มี search) | |
| 6 | ลงวันที่ (`issueDate`) | `ThaiDatePicker` (B1: <md เปิด Sheet sm) | default วันนี้ (ตาม logic เดิม) |
| 7 | เลขที่ใบชั่ง/ใบเบิกเงิน (`paymentRefNo`) | `input` (text, `autoCapitalize=characters`) | ย้ายขึ้นมาอยู่ท้าย step 1 เพราะพนักงานถือใบชั่งอยู่ในมือตอนเริ่มรายการ |

ลำดับใน DOM ต้องเป็นตามตาราง (Enter ภายใน step ใช้ `useEnterNavigation` เดิม → `focusNext` จะเจอ ref ที่ mount อยู่เท่านั้น)

**StickyActionBar (step 1)**
- `summary`: บรรทัด 1 `text-sm font-medium truncate` = ชื่อลูกค้า (`customer.fullName`/`companyName`) หรือ "ยังไม่ระบุลูกค้า" (gray-500); บรรทัด 2 `text-xs text-gray-500` = "{วิธีชำระ} · {issueDate}" หรือว่าง
- `primary={label:"ถัดไป", onClick: validateCustomer → go(2)}` ใช้ `primaryBtnCls` (indigo) ขยาย `h-12 flex-1`
- `secondary` = ไม่มี (ไม่มี "ย้อนกลับ" ใน step 1); ปุ่ม "ล้างฟอร์ม" เป็น link button `text-sm text-gray-500` ใต้ Page title (ไม่อยู่ใน bar) → `ConfirmDialog` "ล้างข้อมูลทั้งหมด?" → `handleReset`

### 3.2 Step 2 — สเปค/คลัง

**กรณี template lock** (`order.__templateLocked*` / `formTemplate` ตั้งค่าแล้ว — เป็นกรณีปกติ):

```
┌ Card ───────────────────────────────────┐
│ สเปคสินค้า            [ล็อกโดยฟอร์ม] ⓘ  │  ← sectionTitle + Badge tone=info
│ ฟอร์ม: ข้าวหอมมะลิ นาปี 67             │  ← text-sm font-medium
│ ──────────────────────────────────────  │
│ ประเภทสินค้า      ข้าวเปลือก            │  ← dl grid-cols-[auto_1fr] gap-x-4 gap-y-2
│ ชนิดข้าว          หอมมะลิ 105           │     dt text-sm gray-500 · dd text-base
│ ชั้นย่อย          —                    │
│ สภาพ/เงื่อนไข     แห้ง                  │
│ ประเภทนา          นาปี                  │
│ ปี/ฤดูกาล         2567/68               │
│ ประเภทธุรกิจ      รวบรวม                │
│ โปรแกรม           ปกติ                  │
│ ──────────────────────────────────────  │
│ [เปลี่ยนฟอร์ม]  ← secondaryBtnCls text-sm h-11 → go(1) + focus formTemplate │
└─────────────────────────────────────────┘
```

ComboBox 8 ตัวของสเปค **ยังต้อง mount** (ซ่อนด้วย `hidden` ไม่ได้ — A3 บอกว่า ref ที่ unmount จะถูก filter; แต่ `product` ที่ `__templateLockedProduct` ถูก force-include ใน `list`) → บน <md กรณี lock ให้ render ComboBox 8 ตัวแบบ `disabled` ไว้ใน `<details>` "ดู/แก้สเปครายตัว" (default หุบ) **ใต้** read-only card แทนการไม่ mount — ค่า/ref/lock เดิมทั้งหมด

**กรณีไม่ lock** (ไม่เลือก template): ไม่มี read-only card; แสดง `Badge tone=pending` "ยังไม่ล็อกฟอร์ม — เลือกสเปคเอง" + ComboBox 8 ตัว 1 คอลัมน์ ลำดับ `product → riceType → subrice → condition → fieldType → riceYear → businessType → program` (= `orderOrder`); `riceType` disabled จน `productId`, `subrice` disabled จน `riceId` (logic เดิม); `searchable='auto'`

**สาขา/คลัง** (ทั้งสองกรณี) — Card ที่สอง "สาขาและคลัง":

| field | control |
|---|---|
| สาขา (`branchName`) | ถ้า `lockedBranch` (จาก JWT ผ่าน `deriveLockedBranch`) → `readonlyFieldCls` แสดง "{ชื่อสาขา}" + `Badge tone=neutral` "ตามสิทธิ์" ด้านใน; ComboBox เดิม mount แบบ `disabled` (ref ยังอยู่). ถ้าไม่ lock → `ComboBox searchable='auto'` |
| คลัง (`klangName`) | `ComboBox` disabled จน `branchId`; options มักน้อย → ไม่มี search; placeholder "— เลือกคลัง —" |

**StickyActionBar (step 2)**: `summary` บรรทัด 1 = ชื่อ template หรือ "{ชนิดข้าว} · {ชั้นย่อย}"; บรรทัด 2 = "{สาขา} · {คลัง}" ; `secondary={label:"ย้อนกลับ"}` (`neutralBtnCls h-12 w-28`) ; `primary="ถัดไป"` → validateSpec

### 3.3 Step 3 — ชั่งน้ำหนัก + คำนวณ

| # | field (ref) | control | หมายเหตุ |
|---|---|---|---|
| 1 | น้ำหนักก่อนชั่ง (`entryWeightKg`) | `input inputMode=decimal` `text-right tabular-nums text-lg` suffix "กก." | label "ก่อนชั่ง (รถเข้า)" |
| 2 | น้ำหนักหลังชั่ง (`exitWeightKg`) | เหมือน 1 | label "หลังชั่ง (รถออก)" |
| — | **calc card A** | `cardCls p-4 bg-gray-50 dark:bg-gray-800/60` `dl` 1 แถว: "น้ำหนักจากตาชั่ง" → `text-xl font-bold tabular-nums` `{grossFromScale} กก.` | read-only; แทน input disabled เดิม (ยังคง ref ถ้า code อ้าง — ใช้ `readonlyFieldCls` ซ่อนใน `sr-only` ไม่ต้อง: field นี้ไม่อยู่ใน `orderOrder`) |
| 3 | ความชื้น (`moisturePct`) | `input inputMode=decimal` suffix "%" | 2 ช่องนี้วาง `grid-cols-2 gap-3` ได้ (สั้น, มักกรอกคู่กัน) |
| 4 | สิ่งเจือปน (`impurityPct`) | `input inputMode=decimal` suffix "%" | |
| — | **calc card B — หักน้ำหนัก** | Card: แถวบน "หัก (ความชื้น+สิ่งเจือปน)" → `text-xl font-bold` `{autoDeduct} กก.` + ข้อความ `text-xs gray-500` "คำนวณอัตโนมัติจาก suggestDeductionWeight"; แถวล่าง = toggle `min-h-touch` "กำหนดเอง" (checkbox `manualDeduct` เดิม, render เป็น switch `size-11` hit) → เมื่อเปิด แสดง input `deductWeightKg inputMode=decimal` ใต้ toggle (mount ตาม `manualDeduct` ตรงกับ filter ใน `useEnterNavigation`) | |
| — | **calc card C — สุทธิ** | `cardCls` ring indigo-200/40: "น้ำหนักสุทธิ" → `text-2xl font-bold tabular-nums` `{netWeight} กก.` | ค่าเดียวกับที่โชว์ใน sticky bar |
| 5 | คุณภาพข้าว gram (`gram`) | `input inputMode=numeric` | |
| 6 | ราคาต่อกก. (`unitPrice`) | `input inputMode=decimal` suffix "บาท/กก." `text-lg` | |
| 7 | เป็นเงิน (`amountTHB`) | `input inputMode=decimal` `text-xl font-bold text-right` prefix "฿" — auto-fill จาก net×unitPrice (logic `formatMoneyInput` เดิม) แก้ได้ | helper "คำนวณให้อัตโนมัติ แก้ได้ถ้ายอดจริงต่างกัน" |

ไม่มี `comment`/`paymentRefNo` ใน step นี้ (ย้ายไป step 4 / step 1 ตามลำดับ)

**StickyActionBar (step 3)**: `summary` = 2 คอลัมน์ `grid-cols-2`: ซ้าย "สุทธิ" `text-xs gray-500` + `text-lg font-bold tabular-nums` "{net} กก."; ขวา "เป็นเงิน" + `text-lg font-bold` `thb(amount)`; อัปเดต live ทุก keystroke; `secondary="ย้อนกลับ"`, `primary="ถัดไป"` → validateWeigh. `hideWhenKeyboard=true` (default) — ตอน keyboard เปิด bar ซ่อน, ผู้ใช้เห็นค่าใน calc card C แทน

### 3.4 Step 4 — ตรวจสอบ + บันทึก

`BuySummary` render `<md` เป็น `dl` 2 คอลัมน์ (`grid grid-cols-[minmax(0,7.5rem)_1fr] gap-x-3 gap-y-1.5`) แบ่ง 4 กลุ่ม แต่ละกลุ่มเป็น `Card` มี `sectionTitleCls` + ปุ่ม "แก้ไข" `text-sm text-indigo-600 min-h-touch` มุมขวา → `onSelect(step)`:

| กลุ่ม | แถว (dt → dd) | แก้ไข → step |
|---|---|---|
| ลูกค้า | ประเภท · ชื่อ/บริษัท · เลขบัตร/เลขภาษี (mask กลาง `1-2345-xxxxx-67-8`) · รหัสสมาชิก · ที่อยู่ (1 บรรทัด truncate) · โทร · วิธีชำระ · ลงวันที่ · เลขที่ใบชั่ง/ใบเบิกเงิน | 1 |
| สเปค/คลัง | ฟอร์ม · ชนิดข้าว · ชั้นย่อย · สภาพ · ประเภทนา · ปี/ฤดูกาล · ประเภทธุรกิจ · โปรแกรม · สาขา / คลัง | 2 |
| น้ำหนัก | ก่อนชั่ง · หลังชั่ง · จากตาชั่ง · หัก (ความชื้น {m}% + สิ่งเจือปน {i}%) · **สุทธิ** (dd `font-bold`) · gram | 3 |
| เงิน | ราคาต่อหน่วย (บาท/กก.) · **ยอดเงิน** (dd `text-2xl font-bold` แถวนี้ขยาย `col-span-2` ชิดขวา) | 3 |

ใต้ 4 กลุ่ม:
- `textarea comment` label "หมายเหตุ / คอมเมนต์ (ไม่บังคับ)" `rows=3` `text-base`
- ข้อความ `text-xs text-gray-500` "ตรวจสอบยอดเงินกับเกษตรกรก่อนกดบันทึก"

≥md: `BuySummary` render tiles เดิม (list `label/value` Buy.jsx:3160-3180) — ไม่แตะ

**StickyActionBar (step 4)**: `summary` = "ยอดเงิน" + `text-xl font-bold` `thb(amount)` (+ บรรทัด 2 "{net} กก. · {ชื่อลูกค้า}" truncate); `secondary="ย้อนกลับ"`; `primary={label:"บันทึกออเดอร์", type:"submit", loading:submitting}` ใช้ `submitBtnCls` (emerald) `h-12 flex-1`; `disabled` ขณะ `submitting`/`submitLockRef`. ปุ่มนี้ต้องเป็น `refs.submitBtn` ตัวเดิม (code เรียก `.blur()`)

### 3.5 Validation + error (ทุก step)

1. กด "ถัดไป" → รัน validator ของ step (`validateCustomer`/`validateSpec`/`validateWeigh` จาก `buyValidation.js`; ข้อความ error = string เดิมบรรทัด 1834-1878) → `setErrors(e)`
2. ถ้ามี error:
   - `toast.error("กรอกข้อมูลไม่ครบ", { description: <รายการ 3 ข้อแรก คั่น "·" + " และอีก n รายการ"> })` (duration 7s เดิม)
   - `Stepper errorSteps` เพิ่ม step ปัจจุบัน (dot แดง + `aria-invalid` บน step button) — ลบออกเมื่อ validator ผ่านรอบถัดไป
   - scroll ไป field แรกที่ผิด ตามลำดับ `personOrder/companyOrder + orderOrder` ที่อยู่ใน step นั้น: `refs[key].current.scrollIntoView({block:"center"})` + `focus()` (กลไกเดียวกับ `focusNext`); ถ้า field อยู่ใน `<details>` ที่หุบ → เปิด details ก่อน (set `open`) แล้วค่อย scroll
   - field ผิด: `aria-invalid=true` + `border-red-500` + `errorTextCls` ใต้ช่อง (ของเดิม)
   - **ไม่เปลี่ยน step**
3. ถ้าผ่าน: `setMaxReached(max(maxReached, next))`, `setCurrent(next)`, `scrollToPageTop()` (ของเดิม), focus ไป field แรกของ step ใหม่ **เฉพาะเมื่อ keyboard ไม่ได้เปิดอยู่** (กัน keyboard เด้งทับ Stepper ตอนเพิ่งเข้า step)
4. Step 4 "บันทึกออเดอร์" → `validateAll` เดิม (merge ทั้ง 3) — ถ้าพบ error ใน step ก่อนหน้า: toast เดิม + `errorSteps` ทุก step ที่มี error + **กระโดดไป step แรกที่มี error** (กรณีเดียวที่กดแล้วเปลี่ยน step ถอยหลัง) ; ถ้าผ่าน → `handleSubmit` เดิม
5. `alert()` 6 จุด → mapping:

| บรรทัดเดิม | แทนด้วย |
|---|---|
| 1952, 1957 (บันทึกไม่สำเร็จ กรอกไม่ครบ) | ข้อ 4 ข้างบน (`toast.error` + jump) |
| 1972 (ล็อกสาขาไม่สำเร็จ) | `toast.error("ล็อกสาขาไม่สำเร็จ", {description:"ไม่พบสาขาจากสิทธิ์ผู้ใช้ในระบบ"})` + `errorSteps=[2]` |
| 2012 (ต้องมี member_id/asso_id) | `toast.error` + jump step 1 + focus `memberId` |
| 2087 (สำเร็จ) | `ResultSheet tone=success` (§3.6) |
| 2094 (ล้มเหลวจาก API) | `ResultSheet tone=error` (§3.6) |

Desktop (≥md): ใช้ `toast` + `ResultSheet` ตัวเดียวกัน (แผน: เลิก `alert()` โดยเจตนา) — `ResultSheet` บน ≥md เป็น centered dialog ผ่าน `Sheet`

### 3.6 ResultSheet

**success** (`tone="success" size="md"`):
- icon check emerald ใหญ่ `size-12` ใน `rounded-full bg-emerald-100 dark:bg-emerald-900/30` (ของ ResultSheet เอง)
- `title="บันทึกออเดอร์เรียบร้อย"`
- `description` = "{ชื่อลูกค้า} · {issueDate}"
- `lines=[{label:"เลขที่ใบชั่ง/ใบเบิกเงิน", value:paymentRefNo},{label:"น้ำหนักสุทธิ", value:"{net} กก."},{label:"ยอดเงิน", value:thb(amount)}]` — แถวยอดเงิน render `text-2xl font-bold`
- `primary={label:"ทำรายการใหม่", onClick: handleReset → setCurrent(1) → setMaxReached(1) → scrollToPageTop}` (`submitBtnCls`)
- `secondary={label:"ดูออเดอร์", onClick: navigate("/order")}` (`neutralBtnCls`) — gate ด้วย `can("trading.reports.view")`; ไม่มีสิทธิ์ → ไม่แสดง secondary
- ปิดด้วย swipe/backdrop/Esc = เท่ากับ "ทำรายการใหม่" (ฟอร์มถูก reset แล้วหลังบันทึก — logic เดิม `handleReset()` หลัง success)
- **ไม่มี** template reset: `localStorage shared.formTemplate` คงค่าไว้เหมือนเดิม → step 1 รอบถัดไปมี template เลือกอยู่แล้ว

**error** (`tone="error"`):
- `title="บันทึกไม่สำเร็จ"`, `description=err.message || "เกิดข้อผิดพลาด"`
- `lines` = detail จาก FastAPI (`{detail:[{msg}]}` → แต่ละ msg เป็น 1 line `label:"รายละเอียด"`), ไม่มี detail → ไม่มี lines
- `primary={label:"กลับไปแก้ไข", onClick: onClose}` (อยู่ step 4 เดิม ข้อมูลครบ) — `primaryBtnCls` indigo (ไม่ใช่ emerald เพราะไม่ใช่การบันทึก)
- `secondary={label:"ลองอีกครั้ง", onClick: handleSubmit}` แสดงเฉพาะ error ที่ไม่ใช่ 4xx validation (network/5xx)

---

## 4. Sales — stepper 4 ขั้น

ใช้โครง §3 ทั้งหมด ต่างที่:

### 4.1 Step 1 — ลูกค้า + เครดิต

ลำดับ: ประเภทผู้ซื้อ (segmented) → ฟอร์มสำเร็จรูป → ค้นหาลูกค้า/บริษัท (+ที่อยู่ใน disclosure) → วิธีชำระเงิน → ลงวันที่ → **เอกสารอ้างอิง** → **เงื่อนไขเครดิต** (เฉพาะ `isCreditPayment()`)

| field | control |
|---|---|
| เอกสารอ้างอิง (`creditInvoiceNo` / ใบรับเงินขายสด) | `input`; label dynamic เดิม ("เลขที่ใบกำกับสินค้า (ขายเชื่อ)" / "ใบรับเงินขายสินค้า (ขายสด)"); ก่อนเลือกวิธีชำระ = `readonlyFieldCls` placeholder "เลือกวิธีชำระเงินก่อน"; helper `sale_id` เดิม |
| กำหนดชำระ (วัน) (`deptAllowed`) | `input inputMode=numeric` suffix "วัน" |
| ผ่อนผัน (`deptPostpone`) | switch row `min-h-touch` "ขอผ่อนผัน/ปลอดดอกเบี้ย" |
| ระยะเวลาปลอดดอกเบี้ย (วัน) (`deptPostponePeriod`) | mount เมื่อ `dept.postpone` (เดิม) `inputMode=numeric` |

Card "เงื่อนไขเครดิต" มี `sectionTitleCls` + helper `allowed_period/postpone/postpone_period` เดิม (`text-xs`)

Sticky bar summary step 1: ชื่อลูกค้า / "{วิธีชำระ} · {ขายเชื่อ กำหนด n วัน | ขายสด}"

### 4.2 Step 2 — สเปค/คลัง: เหมือน Buy §3.2 ทุกประการ

### 4.3 Step 3 — รถพ่วง

```
จำนวนรถพ่วง  [ComboBox 1–10]            ← ไม่มี search; เปลี่ยนจำนวน = newTrailer clone เดิม
┌ Card คันที่ 1 ─────────────── [ครบ ✓] ˅ ┐   ← accordion header min-h-touch (button, aria-expanded)
│ ─ พ่วงหน้า ─────────────────────────── │   ← sub-section title + dot emerald (เดิม)
│ เลขที่ใบชั่งพ่วงหน้า  [            ]   │   scaleNoFront
│ ราคาต่อกก.           [      ] บาท     │   unitPriceFront (decimal)
│ gram                 [      ]         │   gramFront (numeric)
│ ทะเบียนพ่วงหน้า       [            ]   │   licensePlateFront
│ น้ำหนักสุทธิพ่วงหน้า   [      ] กก.    │   frontWeightKg (decimal, text-lg)
│ เป็นเงิน (หน้า)       ฿ 105,000  (auto)│   amountFront read-only calc row
│ ─ พ่วงหลัง ─────────────────────────── │   dot slate (เดิม)
│ … 6 ช่องเดียวกัน (scaleNoBack … amountBack)
│ ──────────────────────────────────────  │
│ รวมคันนี้  19,000 กก. · ฿285,000       │   text-base font-semibold tabular-nums
│ [ไปคันถัดไป →]  neutralBtnCls h-11 w-full (แสดงเมื่อ i < n-1)
└─────────────────────────────────────────┘
┌ Card คันที่ 2 ─────────── [ยังไม่กรอก] ˅ ┐   ← หุบ
└─────────────────────────────────────────┘
```

| กติกา | spec |
|---|---|
| เปิดทีละคัน | state local `openTrailer` (index) ใน `SalesMobileStepper`; เปลี่ยนจำนวน → เปิดคันแรกที่ยังไม่ครบ; กด header คันอื่น → หุบคันเดิม เปิดคันนั้น |
| mount | **body ของคันที่หุบยัง mount** แต่ `hidden` (ต้องคง `trailerRefs` ให้ `focusNextTrailer` ชี้ได้ — `isEnabledInput` เช็ค offsetParent → hidden = ข้ามไป; Enter ท้ายคันที่เปิดอยู่ → `focusFirstOfTrailer(i+1)` → builder ต้อง `setOpenTrailer(i+1)` ก่อน focus: hook จุดนี้ใน `focusTrailerField` ผ่าน callback `onBeforeFocusTrailer?.(i)`) |
| ลำดับฟิลด์ในคัน | = `trailerOrder` เดิม: `scaleNoFront, unitPriceFront, gramFront, licensePlateFront, frontWeightKg, amountFront, scaleNoBack, …` |
| Badge สถานะบน header | `Badge tone=neutral` "ยังไม่กรอก" (ว่างทั้งคัน) · `tone=pending` "กรอกบางส่วน" · `tone=success` "ครบ" · `tone=danger` "ผิดพลาด {n}" (หลังกด ถัดไป แล้ว validator คืน error ของคันนั้น) |
| "ไปคันถัดไป" | หุบคันนี้ เปิดคันถัดไป `focusTrailerField(i+1,"scaleNoFront")` |
| คันที่กรอกเฉพาะพ่วงหน้า | อนุญาตตาม logic เดิม (พ่วงหลังเว้นว่างได้ถ้า code เดิมอนุญาต) — spec นี้ไม่เปลี่ยน rule |

**StickyActionBar (step 3)**: summary `grid-cols-2`: "สุทธิรวม {totals.net} กก." / "เป็นเงินรวม {thb(totals.amount)}" (จาก `trailerSummary` เดิม); `secondary="ย้อนกลับ"`, `primary="ถัดไป"` → validateTrailers (ทุกคัน) → error → toast + `errorSteps=[3]` + เปิดคันแรกที่ผิด + scroll ไป field

### 4.4 Step 4 — ตรวจสอบ + บันทึก

- กลุ่ม ลูกค้า / สเปค-คลัง = `dl` เหมือน Buy
- **Trailer summary** = `DataList` (`items=trailerSummary.rows`, `keyOf=row=>row.index`):
  - `title`: "คันที่ {index}"
  - `subtitle`: "หน้า {licensePlateFront || "—"} · หลัง {licensePlateBack || "—"}"
  - `fields`: `[{label:"นน.หน้า", value:"{front} กก.", align:"right"},{label:"นน.หลัง", value:"{back} กก.", align:"right"},{label:"ราคา/กก.", value:"{unit} บ."},{label:"เป็นเงิน", value:thb(amount), emphasis:true}]`
  - `badge`: `Badge tone=success` "ครบ" / `tone=danger` "ขาดข้อมูล"
  - `onClick` → `onSelect(3)` + `setOpenTrailer(index-1)`
- **Card รวม** ใต้ DataList: `cardCls` `dl` 2 คอลัมน์: รวมพ่วงหน้า · รวมพ่วงหลัง · **สุทธิรวม** (bold) · ราคาเฉลี่ย (บ./กก.) · gram เฉลี่ย · **เป็นเงินรวม** (`text-2xl font-bold col-span-2 text-right`) — ค่าจาก `trailerSummary.totals` เดิม
- `textarea comment` + ปุ่มบันทึกใน sticky bar (`refs.submitBtn`)

### 4.5 ResultSheet ต่อคัน

submit loop `/save/sell` เดิม → เก็บผลต่อคัน `{index, ok, message, detail}`:

| กรณี | tone | title | lines | primary / secondary |
|---|---|---|---|---|
| ทุกคัน ok | success | "บันทึกออเดอร์เรียบร้อย ({n} คัน)" | ต่อคัน: `{label:"คันที่ i", value:"สำเร็จ · {thb(amount_i)}"}` + แถวท้าย "รวม" `text-2xl` | "ทำรายการใหม่" / "ดูออเดอร์" |
| บางคัน fail | error | "บันทึกสำเร็จ {ok}/{n} คัน" | ต่อคัน: ok → value "สำเร็จ"; fail → value "ไม่สำเร็จ — {message}" (`text-red-600`) + บรรทัดย่อย detail (`text-xs`) | "กลับไปแก้ไข" (ปิด; **ห้าม reset** — คันที่สำเร็จแล้วต้อง mark เพื่อไม่ส่งซ้ำตาม logic เดิม ถ้า code เดิมไม่มี ให้ดู §12 Q3) / — |
| ทุกคัน fail | error | "บันทึกไม่สำเร็จ" | ต่อคัน message | "กลับไปแก้ไข" / "ลองอีกครั้ง" |

---

## 5. Sheet anatomy (`<md` = bottom sheet)

```
┌─────────────────────────────────────┐  fixed inset-x-0 bottom-0 z-10040
│          ━━━━  (handle)             │  h-1 w-9 rounded-full bg-gray-300 dark:bg-gray-600, pt-2 pb-1
│ Title (text-base font-bold)   [✕ 44]│  header: sticky top-0, px-4 py-3, border-b, bg เดียวกับ sheet
│ subtitle text-sm gray-500           │
├─────────────────────────────────────┤
│ body  px-4 py-4                     │  min-h-0 overflow-y-auto overscroll-contain
│ …                                   │
├─────────────────────────────────────┤
│ [ secondary ] [   primary   ]       │  footer: sticky bottom-0 px-4 pt-3 pb-safe border-t
└─────────────────────────────────────┘  rounded-t-3xl, shadow-2xl, bg-white dark:bg-gray-800
```

| ส่วน | spec |
|---|---|
| ขนาด | `max-h: calc(min(100dvh, vv.height) - 1rem)`; `size` กำหนด **ความสูงเริ่มต้น** (sheet ขยายถึง max-h ตามเนื้อหา): `sm` ≈ 45dvh · `md` ≈ 65dvh · `lg` ≈ 85dvh · `full` = max-h เต็ม (+ handle ซ่อน `hideHandle` เพราะเป็นหน้าเต็ม ปิดด้วย ✕) |
| ใช้ size ไหน | `sm`: ThaiDatePicker, ConfirmDialog-like เนื้อหาสั้น · `md`: ResultSheet, ตัวกรอง Order/OrderCorrection, overlay preview ของ TransferOut · `lg`: รายละเอียดสมาชิก/ลูกค้า (MemberSearch/CustomerSearch) · `full`: ComboBox picker, OrderCorrection edit form |
| Header | `title` บังคับ (เป็น `aria-labelledby`); `subtitle` optional; ปุ่มปิด `iconBtnCls` X `aria-label="ปิด"`; `busy=true` → ปุ่มปิด disabled + footer ปุ่ม loading |
| Body | scroll ภายใน; `focusin` บน input → `scrollIntoView({block:"center"})` หลัง 150ms (รอ keyboard) |
| Footer | render เมื่อส่ง `footer`; <md ปุ่มเรียง `grid grid-cols-2 gap-3` (`h-12`), ปุ่มเดียว = `grid-cols-1`; primary อยู่ **ขวา** (ใกล้นิ้วโป้งขวา, ตรงกับ ≥md); ≥md `flex justify-end gap-2` |
| Keyboard | `useVisualViewport` → เมื่อ `keyboardOpen`: sheet `max-h` ลดตาม `vv.height`, footer ยังติดล่าง (อยู่เหนือ keyboard เพราะ sheet อิง vv), `StickyActionBar` ของหน้าใต้ sheet ซ่อนอยู่แล้ว (body lock) |
| Dismiss | backdrop tap, Esc, swipe handle ลง >80px (optional — ถ้าไม่ทำ ไม่ block), ปุ่ม ✕; `busy` → block ทั้งหมด |
| Focus | `useFocusTrap` + `initialFocus` (default = ปุ่มปิด; **ไม่ใช่ input** บน <md เพื่อไม่ให้ keyboard เด้งก่อนเห็นเนื้อหา); ปิดแล้วคืน focus ไป trigger |
| Backdrop | `bg-gray-900/40 dark:bg-black/60` fade 150ms; panel slide-up 200ms `ease-out`; `prefers-reduced-motion` → ไม่ animate |
| ≥md | centered `max-w-lg` (`sm`/`md`) / `max-w-2xl` (`lg`) / `max-w-4xl` (`full`), `max-h-[90dvh]`, `rounded-2xl`, ไม่มี handle |

---

## 6. DataList card anatomy

โครง card (ทุกกรณี): `li` `cardCls p-4` → แถว 1 `flex items-start justify-between gap-3`: ซ้าย `title` (`text-base font-semibold truncate`) + `subtitle` (`text-sm text-gray-500 truncate`); ขวา `badge` + chevron (เมื่อ `onClick`) → แถว 2 `dl grid grid-cols-2 gap-x-4 gap-y-1` (`dt text-xs text-gray-500`, `dd text-sm font-medium tabular-nums`, `align:"right"` → `text-right`, `emphasis` → `text-base font-bold`) → แถว 3 `actions` (`flex gap-2 justify-end`, ปุ่ม `h-11`). card ทั้งใบกดได้เมื่อ `onClick` (`role=button tabIndex=0`), actions `stopPropagation`

### 6.1 Order (<md render ด้วย `isPhone` — ไม่ใช่ CSS hide)

| column set | title | subtitle | fields | badge |
|---|---|---|---|---|
| **buy** | ลูกค้า | "{วันที่} · {เลขที่ใบสำคัญ}" | ชนิดข้าว (`col-span-2`) · นน.สุทธิ (right) · หัก นน. (right) · ราคา/กก. (right) · **เป็นเงิน** (emphasis, right) | `tone=neutral` "{สาขา}" ; คลัง ต่อท้าย subtitle ถ้ามี ("· {คลัง}") |
| **sell** | ลูกค้า | "{วันที่} · ใบรับเงิน {เลขที่} · ใบชั่ง {เลขที่}" (2 บรรทัดได้ `line-clamp-2`) | ชนิดข้าว (`col-span-2`) · น้ำหนัก (right) · ราคา/กก. (right) · **เป็นเงิน** (emphasis) | `tone=neutral` "{สาขา}" + ถ้า `#ย่อย > 1` → `tone=info` "ย่อย {n}" |

นน.ขาเข้า/ขาออก ไม่แสดงบน card (ดูได้บน desktop) — ลด noise; ถ้าลูกค้าต้องการให้ใส่ใน §12 Q4

**ตัวกรอง** (<md): `<details>` "ตัวกรอง" summary `min-h-touch` + `Badge tone=info` "{n} ตัวกรอง" เมื่อมี filter active; body = วันที่เริ่ม/สิ้นสุด (ThaiDatePicker), สาขา/คลัง/สเปค (`ComboBox`), ค้นหาลูกค้า (input), ปุ่ม "ค้นหา" `primaryBtnCls h-11 w-full` + "ล้าง" `neutralBtnCls`. segmented ซื้อ/ขาย อยู่ **นอก** details (เห็นตลอด)
**Stat tiles**: `grid-cols-2 gap-3` (น้ำหนักสุทธิรวม · หัก นน. · ยอดเงินรวม · ราคาเฉลี่ย) ค่า `text-xl font-bold tabular-nums`
**Pagination** (<md, ใต้ list): `flex items-center justify-between`: ปุ่ม "‹ ก่อนหน้า" `neutralBtnCls h-11` · กลาง "หน้า" + `input inputMode=numeric w-14 h-11 text-base text-center` + "/ {totalPages}" · "ถัดไป ›" ; ซ่อน page-number list เดิม; แสดง "{startIndex}–{endIndex} จาก {rows.length}" `text-xs gray-500 text-center mt-2`; `PAGE_SIZE=100` เดิม (100 card/หน้า — WP5 พิจารณา `content-visibility:auto` บน `li`)

### 6.2 MemberSearch / CustomerSearch

| | title | subtitle | fields | actions |
|---|---|---|---|---|
| Member | "{first_name} {last_name}" | เลขบัตร (เต็มตามตารางเดิม) | โทรศัพท์ · อำเภอ/จังหวัด ("{district}, {province}") · วันที่สมัคร · เลขสมาชิก | ปุ่ม "แก้ไข" `secondaryBtnCls h-11` → เปิด Sheet lg ในโหมด editing |
| Customer | เดียวกัน | เลขบัตร | โทรศัพท์ · อำเภอ/จังหวัด | "แก้ไข" |

- `onClick` card → Sheet `size=lg` title = ชื่อ, subtitle = เลขบัตร; body = `dl` ทุก field (`FIELDS` เดิม: ข้อมูลหลัก → ที่อยู่ → บัญชี → โครงการ → ที่ดิน), โหมดแก้ไข = input 1 คอลัมน์ (`type` ตาม field: cid `inputMode=numeric maxLength=13`, number `inputMode=numeric`, select → `ComboBox`, date → ThaiDatePicker); โครงการ (seedling/slowdown/organic/product_loan) = switch row `min-h-touch`
- footer Sheet: โหมดดู = ["ปิด"] ; โหมดแก้ไข = ["ยกเลิก", "บันทึก" (`submitBtnCls`, `busy` ตอน save)]
- Search box = `SearchField` (`minChars=2`, `inputMode` text, `loading`) — <md ผลลัพธ์ **คือ DataList เอง** (ไม่ใช่ dropdown): พิมพ์ → debounce → list อัปเดต; จำนวนผล `text-sm gray-500` "พบ {n} รายการ"
- sticky header ของตาราง `top-(--topbar-h)` ใช้บน ≥md เท่านั้น

### 6.3 Trailer summary — ดู §4.4

### 6.4 StockTransferMill — 2 ตาราง → 2 DataList

| ตาราง | title | subtitle | fields | actions |
|---|---|---|---|---|
| เลือกคลังเข้าลอต (eligible) | "คลัง {klang}" | "{สาขา} · Temp #{tempstock_id} · Stock #{stock_id}" | คงเหลือ (right, `text-base font-semibold`) | `input inputMode=decimal` `baseField` `w-32 h-11 text-right` placeholder "กก." + ปุ่ม "เพิ่ม" `primaryBtnCls h-11` (เปลี่ยนเป็น "อัปเดต" เมื่ออยู่ในลอตแล้ว — label เดิม) |
| รายการในลอต | "คลัง {klang}" | "Temp #{id}" | คงเหลือ (right) · กก.ที่ใช้ (editable `input` ใน dd, `w-28 h-11`) | ปุ่มลบ `dangerBtnCls` icon trash `size-11` `aria-label="ลบ {klang}"` |
| badge | — | — | — | ในลอต: `Badge tone=success` "ในลอต" บน eligible card ที่ถูกเลือกแล้ว |

ความคืบหน้า "รวมที่เลือก {picked} / ต้องการ {required} กก." → ย้ายไป `StickyActionBar.summary` (บรรทัด 1) + `Badge tone=success` "ครบ" / `tone=pending` "ขาด {diff} กก." (บรรทัด 2)

### 6.5 StockTransferIn — คำขอรอดำเนินการ

DataList: title "คำขอ #{id}" , subtitle "{สาขาต้นทาง} → {คลังปลายทาง} · {วันที่}", fields: สเปค (`col-span-2`) · น้ำหนักขอโอน (right), badge `tone=success` "เลือกแล้ว" เมื่อ `isPicked`, actions: ปุ่ม "เลือก" `secondaryBtnCls h-11` (ปุ่มที่ 2 ของแถวเดิม เช่น "ดูรายละเอียด" คงไว้เป็น `neutralBtnCls`); header card แสดง `Badge` สถานะโหลดเดิม (กำลังโหลด…/โหลดไม่สำเร็จ/ทั้งหมด n)

### 6.6 Stock — tree

ไม่ใช้ DataList (โครงสร้าง tree) — ต่อคลัง = `<details className=cardCls>` `<summary min-h-touch px-4 flex items-center justify-between>`: "คลัง: {label}" `font-semibold` + chevron; ใต้ชื่อ `flex flex-wrap gap-2` Pill เดิม ("รวม: x กก.", "มูลค่า: ฿y") ; body = รายการสเปคของคลัง 1 คอลัมน์ `dl` (ชนิดข้าว/ชั้นย่อย → น้ำหนัก right) ; เลือกคลังเดียว → ไม่มี details แสดงตรง ๆ

---

## 7. หน้าฟอร์ม 1 คอลัมน์ (`<md`)

กติการ่วม: `grid-cols-1`; card ต่อ section (`cardCls p-4`, `sectionTitleCls`); ทุก `ComboBox` → shared; ปุ่ม submit/reset ท้ายฟอร์ม → `StickyActionBar` (<md) / inline เดิม (≥md — `StickyActionBar` render inline ≥md ตาม B2); ฟิลด์ตัวเลขสั้น 2 ตัวที่กรอกคู่กันวาง `grid-cols-2` ได้ (ระบุไว้ต่อหน้า)

| หน้า | section order (<md) | StickyActionBar `summary` | primary / secondary | Sheet |
|---|---|---|---|---|
| **Stock** | ตัวกรอง (สาขา, คลัง ทางเลือก) → stat tiles `grid-cols-2` (ปริมาณรวม, มูลค่ารวม) → tree §6.6 | — (ไม่มี bar, หน้า read-only) | — | — |
| **StockTransferIn** | 1 คำขอรอดำเนินการ (DataList §6.5) → 2 ข้อมูลการรับเข้า (วันที่รับเข้า, เลขคำขอที่เลือก `readonlyFieldCls`) → 3 ชั่งน้ำหนัก (ชั่งเข้า, ชั่งออก [`grid-cols-2`], **calc card สุทธิ**, คุณภาพ*, สิ่งเจือปน* [`grid-cols-2`]) → 4 ต้นทุน (ราคาต้นทุน/กก.*, รวมต้นทุน read-only calc, บันทึกเพิ่มเติม textarea) | "คำขอ #{id} · สุทธิ {net} กก." / "รวมต้นทุน {thb}" | "ยืนยันรับเข้า" (`submitBtnCls`, = ปุ่ม `submitBtnRef` เดิม) / "ล้าง" ; ปุ่มที่ 3 ของหน้าเดิม (ถ้ามี) คง inline ท้าย section 4 | ไม่มี |
| **StockTransferOut** | 1 ข้อมูลการโอน (ฟอร์มสำเร็จรูป searchable, วันที่โอน, ชื่อผู้ขนส่ง, ทะเบียนรถ, สาขาต้นทาง, คลังต้นทาง, สาขาปลายทาง, คลังปลายทาง) → 2 สินค้า/คุณสมบัติ (template lock → read-only card แบบ §3.2 + `<details>` ComboBox disabled; ไม่ lock → 8 ComboBox) → 3 น้ำหนัก/ราคา (ตามฟิลด์เดิมของหน้า) → 4 หมายเหตุ | "{คลังต้นทาง} → {คลังปลายทาง}" / "{น้ำหนัก} กก." | "บันทึกโอนออก" / "ล้าง" | overlay `fixed inset-0` เดิม → `Sheet size=md` (title ตามเนื้อหาเดิม เช่น "ยืนยันการโอน"/"สรุปรายการ") footer = ปุ่มเดิมของ overlay |
| **StockBringIn** | 1 กำหนดสเปคสินค้า (8 ComboBox* ลำดับ ประเภทสินค้า → ชนิดข้าว → ชั้นย่อย → ปี/ฤดูกาล → สภาพ → ประเภทนา → โปรแกรม → ประเภทธุรกิจ) → 2 คลังปลายทางและปริมาณ (คลัง*, ปริมาณยกมา* decimal `text-lg`) → 3 ราคายกเข้า (ราคา 1, ราคา 2 [`grid-cols-2`], มูลค่าประเมินรวม = calc card) | "{ชนิดข้าว} · {คลัง}" / "{กก.} กก. · {thb(มูลค่า)}" | "บันทึกยกมา" / "ล้าง" | ไม่มี |
| **StockBringInMill** | เหมือน BringIn (คลังโรงสีปลายทาง, ปริมาณยกเข้า, ราคา 2 เว้นว่างได้) | เหมือน BringIn | "บันทึกยกเข้าโรงสี" / "ล้าง" | ไม่มี; gate `canBringInMill()` เดิม |
| **StockDamageOut** | 1 ข้อมูลตัดเสียหาย (วันที่, สาขา, คลัง) → 2 สินค้า/คุณสมบัติ (8 ComboBox; โปรแกรมไม่บังคับ) → 3 น้ำหนักและค่าเสียหาย (น้ำหนักที่ตัดออก decimal `text-lg`, ค่าเสียหาย/กก. decimal, มูลค่าเสียหายรวม = calc card `text-xl`) | "ตัด {กก.} กก. · {คลัง}" / "มูลค่าเสียหาย {thb}" | "บันทึกตัดเสียหาย" (`submitBtnCls`; ถ้า code เดิมมี confirm ก่อน submit ให้ใช้ `ConfirmDialog` เดิม — ไม่เพิ่มใหม่) / "ล้าง" | ไม่มี |
| **StockTransferMill** | 1 ข้อมูล LOT (เลข LOT, น้ำหนักรวม LOT numeric `text-lg`, วันที่ล็อต) → 2 ที่ตั้ง & สเปค (สาขา, คลัง, 8 ComboBox; ปุ่ม "ดึงจากทุกคลัง" toggle เดิม = switch row) → 3 เลือกคลังเข้าลอต (DataList §6.4) → 4 รายการในลอต (DataList §6.4) | "รวมที่เลือก {picked} / {required} กก." + Badge ครบ/ขาด | "บันทึกส่งสี" (disabled จนครบ — logic เดิม) / "ล้าง" | ไม่มี |
| **Share** | 1 เลือกสมาชิก (`SearchField` + ผลลัพธ์ inline list — row `min-h-touch` ชื่อ + เลขบัตร, `aria-selected` เดิม; เลือกแล้ว → card สมาชิกที่เลือก `readonlyFieldCls`-style `dl`: ชื่อ, เลขสมาชิก, เลขบัตร + ปุ่ม "เปลี่ยน" `text-sm text-indigo-600`) → 2 รายละเอียดการซื้อ (วันที่ซื้อ, จำนวนที่ซื้อ (บาท) `inputMode=decimal text-xl font-bold text-right` prefix ฿) → 3 ผลการซื้อ/ใบเสร็จ (card เดิม แสดงหลัง success) | "{ชื่อสมาชิก}" / "ซื้อหุ้น {thb(จำนวน)}" | "ซื้อหุ้น" / "ล้าง" | ไม่มี (ผลลัพธ์ใช้ card เดิม + `toast.success`; ถ้าหน้าเดิมใช้ `alert()` → `ResultSheet`) |
| **OrderCorrection** | segmented ซื้อ/ขาย → `<details>` ตัวกรอง (วันที่เริ่ม/สิ้นสุด, สาขา, คลัง, ค้นหา; ปุ่มค้นหา/ล้าง ใน details) → list `DataList` (column set เหมือน Order §6.1 + actions: "แก้ไข" `secondaryBtnCls h-11`) | — (ไม่มี bar — action อยู่บน card) | — | edit modal (1139) → `Sheet size=full` title "แก้ไขออเดอร์ #{id}", subtitle ลูกค้า·วันที่; body = ฟอร์มแก้ไข 1 คอลัมน์ (ฟิลด์เดิม; ComboBox "— ไม่เปลี่ยน —" เดิม; เหตุผล textarea); footer ["ยกเลิก", "บันทึกการแก้ไข" `submitBtnCls` `busy`] |

---

## 8. ComboBox picker บนมือถือ

| ส่วน | spec |
|---|---|
| Trigger | `baseField` look (h-12 บน <md) + chevron-down ขวา `size-5 text-gray-400`; ค่าเลือกแล้ว `text-base text-gray-900`; placeholder gray-400; `disabled` → `fieldDisabled`; `error` → border red + `aria-invalid`; `aria-haspopup=listbox` |
| เปิด | `<md` → `Sheet size=full hideHandle` title = label ของฟิลด์ (ส่งผ่าน `ariaLabel`/`id` → builder ส่ง title = label text), ปิด ✕ |
| Search | แสดงเมื่อ `searchable===true` หรือ `'auto'` และ `options.length > 8`; `input text-base h-12` `baseField` ใน header sheet (sticky ใต้ title), placeholder "ค้นหา…", icon search ซ้าย, ปุ่ม clear ✕ `size-11` ขวาเมื่อมีข้อความ; **ไม่ autofocus** (กติกาเดียวกับ SelectDropdown B1); filter แบบ includes case-insensitive บน `getLabel` + `getSubLabel` |
| Row | `button` `w-full min-h-touch px-4 flex items-center gap-3 text-left`; label `text-base`; `getSubLabel` → บรรทัดสอง `text-sm text-gray-500`; selected → check icon `size-5 text-indigo-600 dark:text-indigo-400` ขวา + `bg-indigo-50/60 dark:bg-indigo-900/15`; `role=option aria-selected`; divider `divide-y divide-gray-100 dark:divide-gray-700/60` |
| เลือก | tap → `onChange(valueStr, opt)` → ปิด sheet → focus กลับ trigger → **ไม่เรียก** `onEnterNext` บน <md (กัน keyboard เด้งไป field ถัดไปอัตโนมัติบนมือถือ — ผู้ใช้แตะต่อเอง) ; ≥md เรียกเดิม |
| Empty | `EmptyState` เล็ก (icon ซ่อน) `title=emptyText || "ไม่พบรายการ"` ; กรณี `options=[]` ตั้งแต่ต้น (เช่น คลังยังไม่โหลด) → trigger disabled + helper "เลือกสาขาก่อน" (จากหน้า) |
| Loading | หน้า pass `options=[]` + `disabled` ระหว่างโหลด; placeholder "— กำลังโหลด… —" (pattern Order เดิม) |
| เมื่อไหร่ searchable | **บังคับ `searchable`**: ฟอร์มสำเร็จรูป (ทุกหน้า), ชนิดข้าว/ชั้นย่อย (list ยาว), ลูกค้า/สเปคใน Order filter · **`'auto'`** (default): สาขา, คลัง, ประเภทสินค้า, สภาพ, ประเภทนา, ปี/ฤดูกาล, ประเภทธุรกิจ, โปรแกรม · **`false`**: วิธีชำระเงิน, จำนวนรถพ่วง, ประเภทผู้ซื้อ (≥md เท่านั้น — <md เป็น segmented), เพศ/คำนำหน้า |
| z | picker sheet 10050 (เหนือ Sheet 10040 → ComboBox ใน OrderCorrection edit sheet เปิดทับได้) |

---

## 9. Empty / loading / error state ต่อหน้า

ใช้ของที่มี: `EmptyState{title,description,action,icon}`, `ErrorState{message,onRetry}`, `Skeleton`/`SkeletonText`/`SkeletonCard`/`SkeletonStat`/`SkeletonTableRows`, `DataList{loading,skeletonRows,emptyState}`, `PageLoader`

| หน้า | loading | empty | error |
|---|---|---|---|
| Home | `SkeletonCard` strip + tile skeleton เดิม | ไม่มี strip ถ้า 0 item (ไม่แสดง empty) | — |
| Buy / Sales (โหลด options template/สาขา) | ComboBox disabled + placeholder "— กำลังโหลด… —"; Stepper ใช้ได้ทันที | SearchResults: `emptyText` "ไม่พบ — กรอกข้อมูลเองได้" (ไม่ block) | โหลด options fail → `toast.error` + ปุ่ม "โหลดใหม่" ใน helper; submit fail → `ResultSheet error` |
| Order | `DataList loading skeletonRows=6` (card skeleton: title line + 2×2 dl); stat tiles `SkeletonStat` ×4 | `EmptyState title="ไม่พบข้อมูลออเดอร์" description="ลองขยายช่วงวันที่หรือล้างตัวกรอง" action=<ปุ่ม "ล้างตัวกรอง">` ; ก่อนค้นหาครั้งแรก: `title="เลือกช่วงวันที่แล้วกดค้นหา"` | `ErrorState message onRetry=fetch` แทนที่ list |
| OrderCorrection | เหมือน Order | เหมือน Order | เหมือน Order; save fail ใน Sheet → `toast.error` (sheet ยังเปิด, `busy=false`) |
| Stock | `StockTreeSkeleton rows=4` เดิม | ยังไม่เลือกสาขา: `EmptyState "เลือกสาขาเพื่อดูคลัง"` ; คลังว่าง: `"ไม่มีสินค้าในคลังนี้"` (ของเดิม) | `ErrorState onRetry` เดิม |
| MemberSearch / CustomerSearch | `DataList loading skeletonRows=4` ขณะค้น; Sheet detail: `SkeletonText lines=6` ถ้าต้อง fetch เพิ่ม | ก่อนพิมพ์: `EmptyState "เริ่มต้นด้วยการค้นหาสมาชิก" description "พิมพ์ชื่อ นามสกุล เลขบัตร หรือเลขสมาชิกอย่างน้อย 2 ตัวอักษร"` ; ไม่พบ: `title=ไม่พบข้อมูลที่ตรงกับ "{q}"` (เดิม) | `ErrorState onRetry=search` ; save ใน Sheet fail → `toast.error` |
| Share | SearchField `loading`; list skeleton 3 แถว | ไม่พบ (เดิม `EmptyState`) | `ErrorState onRetry` เดิม |
| TransferIn | section 1: `SkeletonCard` ×2 (`DataList loading`) | `EmptyState "ไม่มีคำขอโอนเข้าที่รอดำเนินการ"` (เดิม) | `Badge danger` + `ErrorState onRetry` ใน section 1 |
| TransferOut / BringIn / BringInMill / DamageOut | ComboBox placeholder โหลด | — | submit fail → `toast.error` (หรือ `ResultSheet` ถ้าหน้ามี success sheet) |
| TransferMill | DataList 1: `loading=loadingEligible skeletonRows=3` | DataList 1: `EmptyState` เดิม ("เลือกสเปคข้าวให้ครบ แล้วกด…"); DataList 2: "ยังไม่มีคลังในลอต" + description เดิม | DataList 1: `ErrorState message=eligibleErr onRetry=fetchEligible` (เดิม) |

กติกา: skeleton แทน spinner กลางเนื้อหา; `PageLoader` ใช้เฉพาะตอน route-level (เดิม); ปุ่มใน bar ตอน submit = `loading` (spinner ใน ปุ่ม + label "กำลังบันทึก…") ไม่ overlay ทั้งจอ

---

## 10. Dark mode note ต่อ primitive

| primitive | note |
|---|---|
| `Sheet` | panel `bg-white dark:bg-gray-800`; header/footer `bg-inherit` + `border-gray-200 dark:border-gray-700`; handle `bg-gray-300 dark:bg-gray-600`; backdrop `bg-gray-900/40 dark:bg-black/60`; **เงา** บน dark ใช้ `ring-1 ring-white/10` แทน shadow (shadow มองไม่เห็นบนพื้นดำ) |
| `Stepper` | dot ผ่าน/ปัจจุบัน `bg-indigo-600 dark:bg-indigo-500 text-white`; dot ถัดไป `bg-gray-200 dark:bg-gray-700 text-gray-600 dark:text-gray-300` (ห้าม opacity-only); connector `bg-gray-200 dark:bg-gray-700` / ผ่านแล้ว indigo; error `bg-red-600 dark:bg-red-500`; label current `text-gray-900 dark:text-gray-100`; sticky bg `bg-white/95 dark:bg-gray-900/95 backdrop-blur` (gray-900 = พื้น body dark ตาม theme-color `#030712`→ ใช้ `dark:bg-gray-950/95` ถ้า body เป็น gray-950 — ให้ตรงกับ body) |
| `StickyActionBar` | `bg-white/95 dark:bg-gray-900/95 backdrop-blur border-t border-gray-200 dark:border-gray-800`; summary text `text-gray-900 dark:text-gray-100` / secondary `dark:text-gray-400`; ตัวเลขเงิน **ไม่ใช้สี** (ขาว/ดำเท่านั้น) |
| `DataList` | card `cardCls` (มี dark); dt `dark:text-gray-400`, dd `dark:text-gray-100`; chevron `dark:text-gray-500`; pressed state `active:bg-gray-50 dark:active:bg-gray-700/40`; selected (ComboBox row) `dark:bg-indigo-900/15` |
| `SearchField` | input `baseField` (dark แล้ว); inline results list `bg-white dark:bg-gray-800 ring-1 ring-gray-200 dark:ring-gray-700`; highlighted `bg-indigo-50 dark:bg-indigo-900/20` |
| `ResultSheet` | icon circle success `bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-300`; error `bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-300`; line value fail `text-red-600 dark:text-red-400`; ยอดเงิน `dark:text-gray-100` |
| `ComboBox` | trigger = `baseField`; picker = Sheet dark; check `dark:text-indigo-400`; focus ring `focus-visible:ring-indigo-400` บน dark (ตาม `baseField`) — เปลี่ยนจาก emerald ของ copy เดิมโดยเจตนา |
| calc card (ประกอบจาก `cardCls`) | `bg-gray-50 dark:bg-gray-800/60`; สุทธิ card ring `ring-indigo-200/60 dark:ring-indigo-500/30` |
| `<details>` disclosure | summary `text-gray-700 dark:text-gray-200`; chevron `dark:text-gray-500`; border `dark:border-gray-700` |
| segmented (`segmentedCls`) | track `bg-gray-100 dark:bg-gray-700/60`; active `bg-white dark:bg-gray-800 shadow-sm text-gray-900 dark:text-gray-100 ring-1 ring-gray-200 dark:ring-gray-600`; inactive `text-gray-600 dark:text-gray-300` |
| Badge | ใช้ variant เดิม (dark มีแล้ว) |

ทดสอบ: ทุก surface ใหม่ screenshot light+dark ที่ 390 (WP6); ไม่มี text ที่ contrast < 4.5:1 บน dark (ระวัง `text-gray-500` บน `bg-gray-800` = 4.6:1 ผ่านพอดี — ห้ามใช้ gray-600 เป็น text บน dark)

---

## 11. สิ่งที่ห้ามเปลี่ยน

1. **Desktop (≥md) layout ของทุกหน้า** — Buy/Sales ยัง `<form>` 3 section เดิม ลำดับ node เดิม; ตาราง 12 คอลัมน์เดิม; ปุ่มย้อนกลับ inline เดิม (`hidden md:flex`); Home tile เดิม
2. **Enter-to-next flow**: `useEnterNavigation` (Buy.jsx:97-152), `personOrder/companyOrder/orderOrder`, `refs` map (~640-716), `trailerRefs`/`trailerOrder`/`focusNextTrailer` (Sales 605-633), `onEnterNext` ของ ComboBox บน ≥md, `submitBtn` ref + `.blur()`
3. **State / validation / payload**: ข้อความ error ทุกตัว, `validateAll` semantics, `suggestDeductionWeight`, `formatMoneyInput/moneyToNumber`, `deriveLockedBranch` + `lockedBranch`, `submitLockRef`, debounce 400ms, template lock (`__templateLocked*`), `localStorage shared.formTemplate / sales.formTemplate`, `handleReset`, `scrollToPageTop`, `/order/customers/save/buy` และ `/save/sell` loop payload **byte-equal**, `isCreditPayment()`, `newTrailer` clone
4. **Permission**: `can()/Can/RequirePermission/checkAccess`, `canBringInMill()`, `canSeeAddCompany()`; strip/Sidebar ใช้ `canAccessItem` เดิม — ห้าม hardcode role id
5. **Routing**: HashRouter; step index ไม่ลง URL (A4); `PARENT_ROUTES`
6. **Backend**: ไม่แตะ; error format FastAPI parse เดิม
7. **HR / plan / debt / Documents**: นอก scope — `HrModal`, `ConfirmDialog`, plan grid `cellInput` (class `cell-input` ยกเว้น 16px rule), `StickyTableScrollbar` บน desktop
8. **Primitive API ตาม §B** — ห้ามเพิ่ม prop นอกเหนือที่กำหนด โดยไม่ผ่าน `design-system-engineer`; จุดที่ spec นี้ต้องการเพิ่มระบุใน §13

---

## 12. Open questions (ถามลูกค้า — ไม่ block การสร้าง)

| # | คำถาม | ค่า default ที่ spec ใช้ถ้าไม่ได้คำตอบ |
|---|---|---|
| Q1 | บน Home strip "ทางลัด" pinned 4 ตัว (ซื้อ/ขาย/คลัง/ออเดอร์) ตรงกับงานหน้าตาชั่งจริงไหม หรือควรเป็น ซื้อ/ขาย/รับเข้า/โอนออก สำหรับสาขา? | pinned ตาม §C ของแผน (ซื้อ/ขาย/คลัง/ออเดอร์); recents เติมที่เหลือ |
| Q2 | เลขบัตรประชาชนบน card MemberSearch/CustomerSearch (จอมือถือ ถือกลางคนอื่น) ควร mask กลางไหม? | แสดงเต็มตามตารางเดิม (desktop ก็แสดงเต็ม) |
| Q3 | Sales บันทึกสำเร็จบางคัน — รอบที่กด "ลองอีกครั้ง" ต้องส่งเฉพาะคันที่ fail หรือทั้งหมด? code เดิมเป็นอย่างไร | ยึด logic เดิม; ถ้า code เดิมส่งซ้ำทั้งหมด → ResultSheet ไม่แสดง "ลองอีกครั้ง" กรณี partial (แสดงเฉพาะ "กลับไปแก้ไข") |
| Q4 | card Order ซื้อบนมือถือ ตัด นน.ขาเข้า/ขาออก ออก เหลือ สุทธิ/หัก/ราคา/เป็นเงิน — พอไหม? | ตัดออก; ดูเต็มบน desktop |
| Q5 | ใบชั่ง (`paymentRefNo`) ย้ายไปท้าย step 1 (ก่อนสเปค) — ตรงกับลำดับงานจริงไหม หรือใบชั่งออกหลังชั่งเสร็จ (ควรอยู่ step 3)? | step 1 (พนักงานมักได้เลขใบชั่งจากเครื่องก่อนเริ่มคีย์); ถ้าตอบ step 3 → ย้ายไปท้ายตาราง §3.3 (ไม่กระทบ validation) |
| Q6 | ต้องการ swipe-to-dismiss บน Sheet ไหม (เพิ่มงาน gesture ~1 วัน) | ไม่ทำใน round นี้ — ปิดด้วย ✕/backdrop/Esc |

---

## 13. ข้อเสนอเพิ่ม (นอก §B — ต้องให้ `design-system-engineer` อนุมัติก่อนใช้)

| # | ข้อเสนอ | เหตุผล | ทางเลือกถ้าไม่อนุมัติ |
|---|---|---|---|
| P1 | `ComboBox` prop `title` (string) สำหรับ title ของ picker Sheet | ตอนนี้ API มี `ariaLabel`/`id` — picker ต้องมี title อ่านได้ | builder ส่ง `ariaLabel` = label text และ ComboBox ใช้ `ariaLabel` เป็น title |
| P2 | `ComboBox` ไม่เรียก `onEnterNext` หลัง commit เมื่อ `useIsPhone()` | §8 — กัน keyboard เด้งไป field ถัดไปบนมือถือ | builder ส่ง `onEnterNext={isPhone ? undefined : …}` จากหน้า |
| P3 | `Stepper` prop `onSelect` เรียกได้จากปุ่ม "แก้ไข" ใน summary step 4 (ไปข้างหน้าไม่ได้แต่ย้อนได้) | §3.4 | ใช้ `setCurrent` ตรง ๆ ใน `BuyMobileStepper` (step ≤ maxReached อยู่แล้ว) |
| P4 | `StickyActionBar.summary` รับ node (ไม่ใช่ string) | ต้อง render 2 คอลัมน์/2 บรรทัด + Badge | ถ้ารับ string อย่างเดียว → ใช้ string 1 บรรทัด "สุทธิ 6,850 กก. · ฿85,625" |
| P5 | `DataList.fields[].span` (`1|2`) | ชนิดข้าว/สเปค ต้องการเต็มแถว | ใส่ชนิดข้าวใน `subtitle` แทน |
| P6 | hook ใน Sales `focusTrailerField` → callback `onBeforeFocusTrailer(i)` ให้ accordion เปิดคันก่อน focus | §4.3 | `SalesMobileStepper` ใช้ `useEffect` watch `document.activeElement` — ไม่แนะนำ |

---

## Acceptance (สรุปสำหรับ WP3 + WP6)

- [ ] 390×844 / 360×640: ทำรายการ Buy ครบ 4 step → ResultSheet success → "ทำรายการใหม่" กลับ step 1 ภายใน 1 แตะ; template ยังถูกเลือกอยู่
- [ ] กด "ถัดไป" ทั้งที่ว่าง → ไม่เปลี่ยน step, toast แสดงรายการ, dot step แดง, focus+scroll ไป field แรก (ถ้าอยู่ใน `<details>` ต้องเปิดก่อน)
- [ ] Sales 2 คัน หน้า/หลัง: เปิดทีละคัน, "ไปคันถัดไป" เปิดคันถัดไปและ focus `scaleNoFront`; step 4 DataList 2 card + card รวม; ResultSheet แสดงผลต่อคัน
- [ ] Sticky bar summary อัปเดต live ตอนพิมพ์น้ำหนัก/ราคา; ซ่อนตอน keyboard เปิด; `pb-safe` บน iPhone
- [ ] Order <md: 100 card + pagination 44px + "หน้า x/y"; ไม่มี horizontal overflow ที่ 360
- [ ] MemberSearch <md: tap card → Sheet lg; "แก้ไข" → footer ยกเลิก/บันทึก; Esc ปิด; focus คืน card
- [ ] ComboBox picker: >8 options มี search ไม่ autofocus; row ≥44px; เปิดทับ OrderCorrection edit sheet ได้
- [ ] 1280: Buy/Sales Enter-flow ตรง recording WP0; payload diff = none; screenshot ≥md ทุกหน้าใน §C = baseline
- [ ] dark mode: ทุก surface ใหม่ไม่มี text contrast < 4.5:1; ไม่มี element ที่มองไม่เห็นบนพื้นดำ
- [ ] `npx impeccable detect src/pages/work` ไม่มี finding ใหม่เทียบ `handoff/mobile-baseline.md`

---

**สรุป**
- ไฟล์: `D:\SKT-dev\handoff\mobile-ux-spec.md` (ไฟล์เดียว, ไม่แตะ `src/`)
- §1–2 หลักการ Operate + typography/สี/touch + IA (Home strip, Sidebar trading, Topbar <md)
- §3–4 Buy/Sales stepper 4 ขั้น: ฟิลด์ต่อขั้น, control type, disclosure/read-only card, calc card, StickyActionBar ต่อขั้น, validation/error/jump, step 4 `dl` summary, ResultSheet (Sales ต่อคัน)
- §5–8 anatomy ของ Sheet / DataList (Order, Search, Trailer, TransferMill, TransferIn) / หน้าฟอร์ม 1 คอลัมน์ 9 หน้า / ComboBox picker
- §9–13 state ต่อหน้า, dark mode ต่อ primitive, ห้ามเปลี่ยน, open questions 6 ข้อ, ข้อเสนอเพิ่ม 6 ข้อ (P1–P6) ที่ต้องผ่าน design-system-engineer + acceptance checklist

---

## 14. Lead decisions (2026-10-11)

| # | ตัดสิน |
|---|---|
| Q1–Q6 | ใช้ค่า default ของ spec ทั้งหมด (Q3: builder WP3b ตรวจ submit loop เดิมก่อน — ถ้าส่งซ้ำทั้งหมด ไม่แสดง "ลองอีกครั้ง" กรณี partial; Q6 ไม่ทำ swipe) |
| P1 | อนุมัติ — `ComboBox` prop `title` (WP2) |
| P2 | อนุมัติ — `ComboBox` ไม่เรียก `onEnterNext` บน `useIsPhone()` (WP2, รวมศูนย์ใน primitive) |
| P3 | ไม่เพิ่ม prop — `BuyMobileStepper` ใช้ `setCurrent` ตรง (step ≤ maxReached) |
| P4 | อนุมัติ — `summary` เป็น ReactNode ตามแผน §B2 |
| P5 | อนุมัติ — `DataList.fields[].span` (WP2) |
| P6 | ทำระดับหน้า — WP3b เพิ่ม callback ใน Sales controller ให้ accordion เปิดคันก่อน focus (ไม่ใช้ activeElement watcher) |
| copy | ข้อความ UI ยึด `handoff/mobile-copy.md` (+ §11 lead decisions ในไฟล์นั้น) |
