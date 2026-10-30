# มาสคอต "น้องหอมทอง" (Hom Thong) — Rive handoff

ตัวการ์ตูนเมล็ดข้าวหอมมะลิของ AMC — สหกรณ์การเกษตรเพื่อการตลาดลูกค้า ธ.ก.ส. สุรินทร์
ใช้ในแอป HR: onboarding, empty state, loading, success

**Concept:** หัว/ตัวคือเมล็ดข้าวสารสีงาช้างทรงเรียว สวม "เปลือกข้าวสีทอง" เป็นเสื้อตัวสั้น
บนหัวมีใบข้าว 2 ใบ + รวงเล็ก บุคลิกใจดี ขยัน

**สไตล์ v7 (textured-flat / editorial avatar):** ตาม ref ภาพประกอบแนว editorial (flat + เม็ด grain) — ทำตาม skill
`rive-modern-flat-character` หัวข้อ "Textured-flat (editorial avatar) variant"
- **หน้า (v7.1 ตาใหญ่ขึ้น):** ตาเป็นจุดดำรี 20×23 (ใหญ่ขึ้น ~1.65× จาก v7) + ประกายหลัก 1 จุด (6.2) + ประกายเล็ก 1 จุด (2.8)
  ยังเป็นจุดกลมแบบ textured-flat ไม่ใช่ตาการ์ตูนอนิเมะ อ่านออกที่ 64px และยังเห็นที่ 48px
  ขยับคิ้วขึ้น 6 หน่วย แก้มกับกระขยับออกด้านนอก/ลงนิดหน่อยให้ไม่เบียดตา · blink, หันมองใน search และ squash ตรวจแล้ว ตาไม่หลุดขอบหัว
  คิ้วเป็นแท่งมนหนา, จมูกวงรีสีพีช `#E6BB98`,
  ปากเป็นเส้นยิ้มบาง 3px ปลายมน, แก้มเป็น radial gradient จาง ๆ (ไม่มีขอบ), กระ 3 จุด
- **เงา = เม็ด grain:** ไล่ gradient อ่อน ๆ บนหัว/เปลือก + ชั้นจุด stipple (PNG 1-bit) ทับเฉพาะด้านเงา (ขวา/ขวาล่าง)
  และแถบ AO เหนือขอบเปลือก ไม่ใช้ cel plane ขอบแข็งแบบ v3–v6 แล้ว ไม่มี feather/blur
  ทดสอบแล้วขึ้นทั้ง `@rive-app/canvas@2.44.2` และ `@rive-app/webgl2@2.44.2` ไม่มี console error
- **สีลดความสด:** งาช้างอุ่น, ทองหม่น, เขียวฝุ่น (ดู Palette)
- **กลีบเปลือกหุบเข้า:** กลีบซ้าย-ขวาพับแนบข้างหัว ปลายสูงไม่เกินกลางหัว โค้งเข้าหาหัว silhouette กระชับ
  (ลบด้านในกลีบสีเข้มของ v6 ออก) follow-through ของกลีบยังมีแต่แกว่งน้อยลงมาก
- **สัดส่วน/ท่า/rig:** เหมือน v5–v6 (เมล็ด ≈ 1.54:1, แขนยกเหนือไหล่ได้)

ประวัติ: v3 modern flat → v4 กลม chibi → v5 เรียว → v6 กลีบเปลือกยาวกางออก → v7 textured-flat + กลีบหุบ
รายละเอียด v5/v6 ด้านล่างยังใช้ได้ ยกเว้นเรื่องสี, cel shadow, หน้า (ตาโต/ขนตา/ปากเปิด) และกลีบกาง ที่ v7 แทนแล้ว

**สไตล์ v5 (modern flat, chibi เรียว):** ทำตาม skill `rive-modern-flat-character` (`~/.claude/skills/rive-modern-flat-character/`)
- **สัดส่วน:** เมล็ดสูง:กว้าง ≈ 1.54:1 (250×162) เรียวสอบขึ้นไปทางยอดแบบเมล็ดข้าว (อยู่ระหว่าง v3 ที่ยาวแคบไปกับ v4 ที่กลมไป)
  เสื้อเปลือกช่วงลำตัวแคบลงตามทรง ขาเรียวยาวขึ้น แขนยาวขึ้นแต่ยังปลายมน
- **หน้า:** ย่อ layout ให้พอดีหัวที่แคบลง ตาโต ห่างกัน อยู่ใกล้กลางส่วนขาว ไม่ชิดขอบ ประกายใหญ่ 1 + เล็ก 1
  ขนตาเป็นลิ่มมน ปากยิ้มเล็ก แก้มเป็นวงรีอยู่ใต้ตา
- **ท่า:** แขนยาวขึ้นแล้ว `wave` กับ `success` เลยยกมือได้สูงกว่าไหล่
- **v6 — เปลือกแตกเป็นกลีบยาว (แบบเปลือกข้าวโพดที่ถูกแกะ):** เปลือกทองแยกเป็นกลีบเรียวยาว 2 กลีบ ซ้าย-ขวา โผล่จากด้านหลังหัว
  กว้างที่ไหล่แล้วสอบไปปลายมน โค้งออกด้านนอกนิดหน่อย ปลายสูงถึงราวหนึ่งในสามบนของหัว
  สีทองเดียวกับเสื้อ + ด้านในกลีบสีเข้ม `#C9922E` ให้มีมิติ ไม่มีลายเมล็ดข้าวโพด ตะเข็บยังมีเส้นเดียว
  กลีบอยู่หลังหัว ไม่บังตาหรือใบข้าว · bone `FlapR_Bone` / `FlapL_Bone` ที่โคนกลีบ (โคนซ่อนหลังเสื้อ ข้อต่อไม่มีรอย)
  การเคลื่อนไหว: ช้ากว่าตัว 2–4 เฟรมเวลา squash/กระโดดแล้วเด้งเกินก่อนนิ่ง, idle แกว่งเบาตามหายใจ,
  `success` สะบัดมากขึ้น, `search` กลีบตกลงนิดหน่อย
- **ไม่มีรอยหยัก:** ขอบเปลือกเป็นโค้ง U นุ่มเส้นเดียว มุมเปลือกเป็นมุมมนทั้งหมด ใบข้าวปลายมน
  เส้นในเปลือกเหลือแค่ตะเข็บกลางเส้นเดียว
- **ไม่มีเส้นขอบ:** ใช้ flat fill ทุกชิ้น ไม่มี gradient, เงา cel ขอบแข็งชิ้นเดียวต่อก้อน (ระนาบขวาบนหัว, ก้อนขวาล่างบนเปลือก, ใบสองโทน)
  ขอบหัวด้านที่โดนแสงมีแถบ rim สีเข้มกว่าเนื้อ 1 โทนบาง ๆ ให้ขอบหัวไม่หายบนพื้นขาว
- **ข้อต่อไม่มีรอย:** แขนกับมืออยู่บน bone เดียวกัน pivot ซ่อนหลังเปลือก
  ก้านกับปลายรวงเป็น path โค้งเส้นเดียว (tangent ต่อเนื่อง) เลยไม่มีมุมหักทุกเฟรม
  เมล็ดในรวงแกว่งเบา ๆ เป็น follow-through (group `Panicle`)
- **Accent:** ประกาย 2 ดวงใน `success`, เครื่องหมาย "?" สีทองใน `search` (ตัวเอียงซ้าย-ขวา 6° พร้อมมองซ้าย-ขวา มือแตะแก้ม)

API ของ runtime เหมือน v1–v7 ทุกอย่าง (artboard / state machine / view model / ชื่อ animation) โค้ดฝั่งแอปไม่ต้องแก้
v7.3 เพิ่มแค่ค่า `mood` 5 / 6 + state/animation ใหม่ — ของเดิมไม่ถูกเปลี่ยนชื่อหรือลบ (backward compatible)

## ไฟล์

| ไฟล์ | ใช้ทำอะไร |
|---|---|
| `public/mascot/homthong.riv` | runtime file v7.3 (33.7 KB, เพิ่ม mood 5 error + mood 6 offline; v7.2 เพิ่ม pointDir + ท่าเต้น; รวมภาพ grain 2 ไฟล์ ~10 KB, export จากบัญชี Rive Pro ไม่มี splash/ลายน้ำ) |
| `handoff/homthong.backup-before-mood56.riv` | สำเนา v7.2 (26.2 KB) ก่อนเพิ่ม mood 5/6 — ใช้ย้อนกลับได้ทันที |
| `public/mascot/homthong.png` | fallback ภาพนิ่งท่า idle, 1024×1024, พื้นใส |
| `public/mascot/homthong.svg` | fallback แบบเวกเตอร์ท่า idle (geometry เดียวกัน), viewBox 512×512, grain ทำด้วย SVG `feTurbulence` (ใกล้เคียง ไม่ใช่ลายจุดเดียวกับ .riv) |

ไฟล์ต้นฉบับอยู่ใน Rive cloud: `https://editor.rive.app/file/homthong/2692657`

## โครงสร้างใน .riv

- **Artboard:** `HomThong` — 512×512 พื้นใส ตัวละครยืนกลาง เท้าอยู่ที่ y≈452 เหลือพื้นที่ด้านบนไว้กระโดด
- **State machine:** `HomThong` (เป็น default)
  - layer `Main`: Idle (ชื่อ state ว่าง ใช้ animation `idle`) / Wave / Point / PointUp / PointDown / Search / Loading / Success / SuccessHold
    / **Error / ErrorHold / Offline** (v7.3)
  - layer `Blink`: กะพริบตาวนตลอดทุก state (รอบละ 4.2 วิ) แยกจากท่าตัว
- **Inputs = View Model `HomThong`** (data binding, instance `Default`, ผูกกับ artboard แล้ว)
  ไม่ได้ใช้ input แบบ legacy — ต้องใช้ API ฝั่ง view model ตามตัวอย่างด้านล่าง

| property | type | ค่า |
|---|---|---|
| `mood` | number | `0` idle · `1` onboard (wave 1 ครั้ง แล้ว point วนต่อ) · `2` empty (search) · `3` loading · `4` success (กระโดดครั้งเดียว แล้วยืนนิ่ง) · `5` error "บันทึกไม่สำเร็จ" (สะดุ้งเบา ๆ ครั้งเดียว แล้วค้างหน้ากังวลมือแตะแก้ม) · `6` offline/timeout "ระบบไม่ตอบ / เน็ตหลุด" (หลับสัปหงก มี z ลอย วนต่อ) |
| `wave` | trigger | โบกมือ 1 ครั้ง จบแล้วกลับไป state ตาม `mood` ปัจจุบัน |
| `celebrate` | trigger | เล่น success (ท่าเต้นดีใจ) 1 ครั้ง จบแล้วกลับไป state ตาม `mood` |
| `pointDir` | number (v7.2) | ทิศชี้ตอน `mood = 1` (onboard): `0` ชี้ข้าง (ขวาของตัวละคร, ค่าเริ่มต้น = ท่าเดิม) · `1` ชี้ขึ้น (แขนยกเฉียงขึ้น ตัวเอนหงายเล็กน้อย ตามองขึ้น) · `2` ชี้ลง (แขนเฉียงลง ตัวเอนไปทางที่ชี้ ตามองลง). เปลี่ยนระหว่างวนอยู่ได้ blend 200ms ไม่กระตุก. นอก mood 1 ไม่มีผล |

**ชี้ไปทางซ้าย:** กลับด้านทั้ง canvas ด้วย CSS `transform: scaleX(-1)` (ทั้งตัว + เงาพื้น) — ตัวละครไม่มีตัวอักษร
ทรงเกือบสมมาตร จึงดูถูกต้องเมื่อกลับด้าน. ข้อสังเกต: แสงหลักจะย้ายจากซ้ายบนเป็นขวาบน (เม็ด grain ย้ายไปฝั่งซ้าย)
ภายในตัวละครยังสอดคล้องกันเอง แต่ถ้าวางคู่กับตัวที่ไม่กลับด้านในจอเดียวกันจะเห็นว่าแสงคนละทิศ

React: `const { setValue: setPointDir } = useViewModelInstanceNumber("pointDir", vmi)` แล้ว `setPointDir(1)` ตามขั้นของ tour
(vanilla: `r.viewModelInstance.number("pointDir").value = 1`) — ไฟล์เก่าที่ไม่มี `pointDir` จะไม่ error แค่ไม่ชี้ขึ้น/ลง

ลำดับการทำงาน (ทดสอบด้วย simulate และใน browser แล้ว):
- เปลี่ยน `mood` → mix ไป state ใหม่ใน 220ms จากท่าวนได้ทุกท่า
- trigger ยิงได้จากทุก state (เป็น transition จาก Any State) ถ้ายิงระหว่างท่า one-shot จะเริ่มท่าใหม่ ไม่หาย
- `wave` / `success` เล่นจนจบ (exit time 100%) แล้วไปต่อตาม `mood`: 0→Idle, 1→Point, 2→Search, 3→Loading, 4→SuccessHold,
  5→ErrorHold (ไม่เล่นสะดุ้งซ้ำ), 6→Offline
- `mood = 4` เล่นกระโดดครั้งเดียวแล้วไปอยู่ที่ `SuccessHold` (ท่า idle) จะไม่วนกระโดดซ้ำ ถ้าอยากเล่นอีกให้ยิง `celebrate`
- (v7.3) `mood = 5`: จากท่าวนทุกท่า (Idle/Point/PointUp/PointDown/Search/Loading/SuccessHold/Offline) mix 220ms → `Error`
  (one-shot 1.2s) → จบแล้วไป `ErrorHold` (exit time 100%, mix 180ms) แล้ววนนิ่ง ๆ. ถ้าเปลี่ยน mood ระหว่าง `Error`
  จะออกทันที (mix 220ms ไม่ต้องรอจบท่า) — ไปตาม mood ใหม่ (1 → Wave, 4 → Success เหมือน state อื่น)
- (v7.3) `mood = 6`: จากทุก state ที่ฟัง mood → `Offline` (mix 220ms) วนต่อจนกว่า mood จะเปลี่ยน; ออกจาก Offline ไป
  0/1/2/3/4/5 ด้วย mix 220ms (ตาเปิดกลับภายในช่วง mix)
- ตั้ง `mood = 5` ซ้ำขณะอยู่ใน ErrorHold ไม่มีผล (ค่าไม่เปลี่ยน) — ถ้าอยากให้สะดุ้งใหม่ทุกครั้งที่ error ซ้ำ ให้ตั้ง mood เป็นค่าอื่น
  (เช่น 3 ตอนกำลังบันทึก) ก่อน แล้วค่อยกลับมา 5
- ทดสอบแล้วด้วย `simulateStateMachine` ใน editor และด้วย runtime `@rive-app/canvas@2.44.2` แบบ step ทีละเฟรม:
  idle→Error→ErrorHold, ErrorHold+`wave`→Wave→ErrorHold, ErrorHold→Offline, Offline+`celebrate`→Success→Offline,
  Offline→idle, idle→Error→(mood 2 กลางท่า)→Search

## Animations (60 fps)

| ชื่อ | ยาว | แบบ | รายละเอียด |
|---|---|---|---|
| `idle` | 4.0 s | loop | หายใจ (scaleY 102%) 2 รอบ, ใบข้าว/รวงแกว่งเหลื่อมกัน, แขนแกว่งเบา ๆ |
| `blink` | 4.2 s | loop | กะพริบตา (layer แยก) |
| `wave` | 1.5 s | one-shot | ย่อตัวรับแรง → ยกแขนขวาโบก 2.5 ครั้ง, ตัวเอียงตาม, ใบข้าวสะบัดตามหลัง → กลับท่าพัก |
| `point` | 2.0 s | loop | แขนขวาชี้ไปทางขวา (ชี้ไปที่ UI ข้าง ๆ), หน้าหันตาม |
| `search` | 3.0 s | loop | "?" สีทองเด้งขึ้นเหนือหัว, ตัวเอียงซ้าย/ขวา 6°, มองซ้ายแล้วมองขวา, มือแตะแก้ม, ปากเล็กแบบ "อืม" |
| `loading` | 1.0 s | loop | เด้งตัว squash/stretch ปานกลาง (93–106%), เงาที่พื้นหดและจางตามความสูง |
| `pointUp` | 2.0 s | loop | (v7.2, `pointDir = 1`) แขนขวาชี้เฉียงขึ้น ~64°, ตัวยืดขึ้นเล็กน้อย, หน้า/ตาเลื่อนขึ้น |
| `pointDown` | 2.0 s | loop | (v7.2, `pointDir = 2`) แขนขวาชี้เฉียงลง, ตัวเอนไปทางที่ชี้ 5°, หน้า/ตาเลื่อนลง |
| `success` | 2.2 s | one-shot | (v7.2 ท่าเต้นดีใจ) ย่อตัว → กระโดดชูสองแขน + ประกาย → ลง squash → กระโดดเอียงไปขวา (แขนขวาโบกขึ้น แขนซ้ายลง) → กระโดดไปซ้าย (สลับแขน) → กระโดดเล็กกลับกลาง → ท่า "ta-da" ชูแขน + ประกายเด้งอีกรอบ → แขนลงท่าพัก แล้วไป SuccessHold. กลีบเปลือก/ใบข้าว/รวงสะบัดตามหลัง (follow-through) ทุกครั้งที่กระโดด/ลง; เงาพื้นตามตัวไปด้านข้างและหด/จางตามความสูง |

| `error` | 1.2 s | one-shot | (v7.3, `mood = 5`) สะดุ้งเบา ๆ: ตัวยืดขึ้น (scaleY 106% / X 96%) + เด้งจากพื้น 7px, ตาโตขึ้นชั่วครู่ (จุดตา 112×118%), คิ้วยก → เปลือก/กลีบ/ใบข้าว/รวงสะบัดตามหลัง 2–4 เฟรมแล้วนิ่ง → แขนขวา (ฝั่งขวาของจอ) ยกขึ้นแตะข้างแก้ม เกาเบา ๆ 2 ครั้ง, ตัวเอียงเข้าหามือ 4°, คิ้วเอียงแบบกังวล (ปลายในยก 12°), ปากเปลี่ยนเป็นเส้นหยักเล็ก ๆ จบในท่าที่ตรงกับเฟรมแรกของ `errorHold` |
| `errorHold` | 3.0 s | loop | (v7.3) ค้างท่าเขิน/กังวล: มือแตะแก้ม ถูไปมาเบา ๆ, หายใจ (scaleY 101.6%), ตัวโยก 3–4°, คิ้วกังวลขยับนิดเดียว, ปากหยัก. ไม่มี "?" ไม่มีประกาย ไม่ร้องไห้ |
| `sleep` | 3.6 s | loop | (v7.3, `mood = 6`) หลับตา (เส้นโค้งคว่ำ ◡ แทนจุดตา), หายใจลึกช้า (scaleY 103%), หัวเอียง/ก้มเล็กน้อย, ใบข้าวกับรวงตกลง (Sprout −69°, Panicle 96°), แขนห้อย, ปากยิ้มเล็ก, "z" สีทอง 3 ตัวลอยขึ้นเฉียงขวา ขยาย + จางหาย เหลื่อมกันทุก 1.2 s ต่อเนื่องไร้รอยต่อตอนวน |

Rig: bones `ArmL_Bone`, `ArmR_Bone` (แขนเสื้อ + มือ), `Sprout_Bone1` (ใบ + ก้าน + รวง แกว่งทั้งชุด) และ group `Panicle`
(เมล็ดในรวงแกว่งเบา ๆ ช้ากว่าโคน เป็น follow-through) ส่วน `Sprout_Bone2/3` ลบแล้ว
`SparkleA/B` (ประกาย) ถูก key opacity 0 ในทุกท่า ยกเว้น `success` และ group `Question` ("?") ก็ key opacity 0 ในทุกท่า ยกเว้น `search`
ลำตัวใช้ scale ของ group `Body` (pivot ที่ก้น) ทำ squash/stretch · ตาใช้ group `EyeL` / `EyeR` scaleY ทำ blink (เปลือกตาย่อตาม) · หน้าใช้ group `Face` ขยับ x เพื่อหันมอง
group `Husk` (เสื้อเปลือก, pivot ที่ก้น) มี scaleY ของตัวเองที่ช้ากว่าตัว 2–4 เฟรม และเด้งเกินนิดหน่อยใน `loading` / `success` / `wave`
ขอบเปลือกจึงขยับตามหลังตัว (follow-through) แล้วกลับมานิ่งที่ 100% ทุกท่า

ชิ้นใหม่ v7.3 (key ค่าพักไว้ที่เฟรม 0 ของทุก animation ใน layer Main แล้ว ไม่ค้างข้ามท่า):
- group `EyesClosed` (ใน `Face`) = `ClosedL` / `ClosedR` เส้นโค้ง ◡ หมึก `#2B2421` 3.4px ปลายมน — opacity 100 เฉพาะ `sleep`
  ส่วน group `EyeL` / `EyeR` ถูก key **opacity** 0 ใน `sleep` (layer Blink key แค่ scaleY ของ EyeL/EyeR จึงไม่ชนกัน:
  blink ยังวิ่งอยู่แต่ย่อตาที่มองไม่เห็น)
- `MouthWavy` (ใน `Mouth`) ปากหยัก 3px — opacity 100 เฉพาะ `error`/`errorHold`; `Smile` ถูก key opacity 0 ในสองท่านี้
- group `Zzz` (ใน `Character`, scale 145%, อยู่บนสุด) = `Z1` / `Z2` / `Z3` เส้น Z สี `#DDAA52` 3.2px — opacity 100 เฉพาะ `sleep`
- key ใหม่บนชิ้นเดิม: `BrowL` / `BrowR` (r, y), `DotL` / `DotR` (scale) — ทุกท่าเดิมได้ค่าพัก r 0, y −34, scale 100%

## Palette

Palette v7 (muted):

| token | hex | ใช้ที่ |
|---|---|---|
| grain | linear `#F4EDE0` → `#F1E8D8` → `#E6D7BE` → `#DCC9AC` (ซ้ายบน → ขวาล่าง) | เนื้อข้าว (หัว); มือ `#F1E8D8` |
| grain stipple | จุด `#C8B291` (PNG 1-bit, `GrainHead`) | เงาด้านขวา + AO เหนือขอบเปลือก |
| husk | linear `#DDB15A` → `#B4833C` | เสื้อเปลือก |
| husk stipple | จุด `#A07234` (PNG 1-bit, `GrainHusk`) | เงาขวาล่างของเปลือก |
| husk flap | `#C69545` | กลีบเปลือกที่พับแนบข้างหัว |
| sleeve | `#C99A48` | แขนเสื้อ |
| husk line | `#9C6F33` 2.6px | ตะเข็บกลางเส้นเดียว |
| husk lip | `#EACB86` 4px | ขอบปากเปลือกโค้ง U; เงาใต้ขอบ `#D9C6A6` @ 50% |
| leaf | `#86A672` / `#789A66` + เงา `#62835A` | ใบข้าว, ก้าน `#62835A` |
| seed / sparkle / "?" | `#D6A54E` / `#DDAA52` | เมล็ดในรวง, ประกาย, เครื่องหมายคำถาม |
| ink | `#2B2421` | ตา, คิ้ว, เส้นปาก |
| nose | `#E6BB98` | จมูก |
| blush | radial `#E8A08A` → โปร่งใส | แก้ม (+ กระ 3 จุด) |
| boots | `#4A3B31` | เท้า |
| ground | `#000000` @ 20% | วงรีเงาพื้นแบบแบน |

ไม่มีเส้นขอบรอบตัว ไม่ใช้ feather / blur (บาง renderer ไม่วาด) — เงาใช้ linear/radial gradient + ภาพจุด stipple
แสงมาจากซ้ายบนทิศเดียว ผลออกมาเหมือนกันทั้ง renderer canvas และ webgl2 (ทดสอบแล้ว)
ภาพ grain เป็น Image ใน group `Body` / `Husk` (scale 50% ของ PNG 2× จึงคมบนจอ retina) ขยับ/squash ไปกับชิ้นเลย
ตอนนี้สียังไม่ได้ผูกกับ view model — ถ้าจะ theme ต้องเพิ่ม color property เอง

## ขนาดแนะนำ

- **≥ 96px**: onboarding / empty state / success (แนะนำ 160–240px)
- **48–64px**: loading inline / avatar ยังอ่านออก (ทดสอบแล้ว silhouette = เมล็ด+ใบ) แต่ตัวละครกินพื้นที่ประมาณ 60% ของ artboard
  เพราะเผื่อที่ไว้กระโดด ถ้าวางที่ 48px ให้ขยาย canvas ขึ้น ~1.3× แล้ว crop หรือใช้ `Fit.Cover`
- อัตราส่วน canvas 1:1 เสมอ

## ใช้กับ React (`@rive-app/react-canvas`)

```bash
npm i @rive-app/react-canvas@4.36.0   # pin ตรง version ที่ทดสอบ (runtime core 2.44.x)
```

```jsx
import { useEffect } from "react"
import {
  useRive, useViewModel, useViewModelInstance,
  useViewModelInstanceNumber, useViewModelInstanceTrigger,
  Layout, Fit, Alignment,
} from "@rive-app/react-canvas"

// mood: 0 idle · 1 onboard · 2 empty · 3 loading · 4 success · 5 error · 6 offline
export default function HomThong({ mood = 0, size = 160, className = "" }) {
  const { rive, RiveComponent } = useRive({
    src: "/mascot/homthong.riv",
    artboard: "HomThong",
    stateMachines: "HomThong",
    autoplay: true,
    autoBind: false,
    layout: new Layout({ fit: Fit.Contain, alignment: Alignment.Center }),
  })
  const vm = useViewModel(rive, { name: "HomThong" })
  const vmi = useViewModelInstance(vm, { rive, useDefault: true })
  const { setValue: setMood } = useViewModelInstanceNumber("mood", vmi)
  const { trigger: wave } = useViewModelInstanceTrigger("wave", vmi)
  const { trigger: celebrate } = useViewModelInstanceTrigger("celebrate", vmi)

  useEffect(() => { if (vmi) setMood(mood) }, [vmi, mood, setMood])

  return (
    <div style={{ width: size, height: size }} className={className} aria-hidden="true">
      <RiveComponent />
    </div>
  )
}
```

> ตัวอย่างนี้ยังไม่ได้รันในแอปจริง ที่ทดสอบแล้วคือ vanilla runtime (`r.viewModelInstance.number("mood").value = n`,
> `r.viewModelInstance.trigger("wave").trigger()`) ซึ่งทำงานครบ ส่วนชื่อ hook ให้เช็คกับ README ของ version ที่ pin ก่อนใช้

ข้อควรทำในแอป:
- **reduced motion**: ถ้า `matchMedia("(prefers-reduced-motion: reduce)").matches` ให้แสดง `<img src="/mascot/homthong.svg">` (หรือ `.png`) แทน ไม่ต้องโหลด Rive
- **fallback**: ถ้าโหลดไม่สำเร็จ (`onLoadError`) ให้ใช้ภาพนิ่งตัวเดียวกัน
- ตัวละครเป็นของตกแต่ง → `aria-hidden="true"` แล้วให้ข้อความใน UI สื่อความหมายเอง
- หยุด render ตอนอยู่นอกจอ (react runtime หยุดให้เมื่อ canvas ไม่อยู่ใน viewport อยู่แล้ว)
- import ไฟล์เดียวต่อหน้าก็พอ เปลี่ยนท่าด้วย `mood` อย่าสร้างหลาย instance

## ข้อจำกัด / สิ่งที่ต้องตัดสินใจ

1. **Splash "RIVE" แก้แล้ว**: v1 ที่ export จาก plan ฟรีมีจอดำโลโก้ RIVE ~3 วินาที
   v2–v7 export จากบัญชี Pro แล้วทดสอบใน browser ตัวละครขึ้นตั้งแต่เฟรมแรก ไม่มี splash/ลายน้ำ
2. แขนอยู่หลังเสื้อเปลือก ท่า `wave` / `success` ยกมือได้เหนือไหล่ราว 40px แต่ยังไม่สูงเหนือหัว
3. สไตล์ flat ไม่มีเส้นขอบ บนพื้นขาวล้วนขอบหัวด้านซ้ายบน (ด้านสว่าง ไม่มี grain) ยังอ่อน
   ถ้าวางบนการ์ดสีหรือพื้นเทาอ่อนจะเด่นที่สุด
4. เม็ด grain ละเอียด: ต่ำกว่า ~96px จะกลืนเป็นสีเรียบ (ไม่เสีย แต่ไม่เห็น texture)
5. สีและ grain ยังไม่ผูก view model — เปลี่ยนธีมต้องแก้ใน Rive หรือ export ภาพ grain ใหม่
6. ยังไม่มี eye-follow (`look`) และ listener hover/tap — brief ไม่ได้ขอ
7. (v7.2) แขนสั้นตามดีไซน์ ท่า "ชูแขน" ในท่าเต้นยกมือได้ถึงระดับแก้ม ไม่ถึงเหนือหัว; ชี้ขึ้นเป็นมุมเฉียง ~64° ไม่ตั้งตรง
8. (v7.2) `pointDir` รับ 0/1/2 เท่านั้น (ค่าอื่น = ค้างทิศเดิม)
9. (v7.3) แขนอยู่หลังหัว มือจึง "แตะข้างแก้ม" ได้แค่ที่ขอบหัว (ไม่ทับบนแก้ม) — เกาหัวจริง ๆ เหนือหัวทำไม่ได้ด้วย rig นี้
10. (v7.3) ระหว่าง mix 220ms เข้า/ออก `Offline` ตาเปิดกับเส้นตาปิด cross-fade กัน (เห็นซ้อนจาง ๆ ราว 0.2 วิ อ่านเป็น "ค่อย ๆ หลับตา")
11. (v7.3) ภาพนิ่ง fallback `homthong.svg` / `.png` ยังเป็นท่า idle — ตอน reduced-motion จะไม่เห็นหน้ากังวล/หลับ
    ถ้าต้องการให้ข้อความ UI สื่อเอง หรือทำภาพนิ่งเพิ่มต่อ mood ภายหลัง
12. (v7.3) `MascotRive.jsx` ส่ง mood เป็นตัวเลขตรง ๆ อยู่แล้ว ใช้ 5/6 ได้ทันที แต่คอมเมนต์หัวไฟล์ยังระบุแค่ 0–4 (ไม่ได้แก้ app code)
