# มาสคอต "น้องหอมทอง" (Hom Thong) — Rive handoff

ตัวการ์ตูนเมล็ดข้าวหอมมะลิของ AMC — สหกรณ์การเกษตรเพื่อการตลาดลูกค้า ธ.ก.ส. สุรินทร์
ใช้ในแอป HR: onboarding, empty state, loading, success

**Concept:** หัว/ตัวคือเมล็ดข้าวสารสีงาช้างทรงเรียว สวม "เปลือกข้าวสีทอง" เป็นเสื้อตัวสั้น
บนหัวมีใบข้าว 2 ใบ + รวงเล็ก บุคลิกใจดี ขยัน

**สไตล์ v5 (modern flat, chibi เรียว):** ทำตาม skill `rive-modern-flat-character` (`~/.claude/skills/rive-modern-flat-character/`)
- **สัดส่วน:** เมล็ดสูง:กว้าง ≈ 1.54:1 (250×162) เรียวสอบขึ้นไปทางยอดแบบเมล็ดข้าว (อยู่ระหว่าง v3 ที่ยาวแคบไปกับ v4 ที่กลมไป)
  เสื้อเปลือกช่วงลำตัวแคบลงตามทรง ขาเรียวยาวขึ้น แขนยาวขึ้นแต่ยังปลายมน
- **หน้า:** ย่อ layout ให้พอดีหัวที่แคบลง ตาโต ห่างกัน อยู่ใกล้กลางส่วนขาว ไม่ชิดขอบ ประกายใหญ่ 1 + เล็ก 1
  ขนตาเป็นลิ่มมน ปากยิ้มเล็ก แก้มเป็นวงรีอยู่ใต้ตา
- **ท่า:** แขนยาวขึ้นแล้ว `wave` กับ `success` เลยยกมือได้สูงกว่าไหล่
- **ไม่มีรอยหยัก:** ขอบเปลือกเป็นโค้ง U นุ่มเส้นเดียว มุมเปลือกเป็นมุมมนทั้งหมด ใบข้าวปลายมน
  เส้นในเปลือกเหลือแค่ตะเข็บกลางเส้นเดียว
- **ไม่มีเส้นขอบ:** ใช้ flat fill ทุกชิ้น ไม่มี gradient, เงา cel ขอบแข็งชิ้นเดียวต่อก้อน (ระนาบขวาบนหัว, ก้อนขวาล่างบนเปลือก, ใบสองโทน)
  ขอบหัวด้านที่โดนแสงมีแถบ rim สีเข้มกว่าเนื้อ 1 โทนบาง ๆ ให้ขอบหัวไม่หายบนพื้นขาว
- **ข้อต่อไม่มีรอย:** แขนกับมืออยู่บน bone เดียวกัน pivot ซ่อนหลังเปลือก
  ก้านกับปลายรวงเป็น path โค้งเส้นเดียว (tangent ต่อเนื่อง) เลยไม่มีมุมหักทุกเฟรม
  เมล็ดในรวงแกว่งเบา ๆ เป็น follow-through (group `Panicle`)
- **Accent:** ประกาย 2 ดวงใน `success`, เครื่องหมาย "?" สีทองใน `search` (ตัวเอียงซ้าย-ขวา 6° พร้อมมองซ้าย-ขวา มือแตะแก้ม)

API ของ runtime เหมือน v1–v4 ทุกอย่าง (artboard / state machine / view model / ชื่อ animation) โค้ดฝั่งแอปไม่ต้องแก้

## ไฟล์

| ไฟล์ | ใช้ทำอะไร |
|---|---|
| `public/mascot/homthong.riv` | runtime file (11.0 KB, export จากบัญชี Rive Pro ไม่มี splash/ลายน้ำ) |
| `public/mascot/homthong.png` | fallback ภาพนิ่งท่า idle, 1024×1024, พื้นใส |
| `public/mascot/homthong.svg` | fallback แบบเวกเตอร์ท่า idle (สร้างจาก geometry เดียวกัน), viewBox 512×512 |

ไฟล์ต้นฉบับอยู่ใน Rive cloud: `https://editor.rive.app/file/homthong/2692657`

## โครงสร้างใน .riv

- **Artboard:** `HomThong` — 512×512 พื้นใส ตัวละครยืนกลาง เท้าอยู่ที่ y≈452 เหลือพื้นที่ด้านบนไว้กระโดด
- **State machine:** `HomThong` (เป็น default)
  - layer `Main`: Idle / Wave / Point / Search / Loading / Success / SuccessHold
  - layer `Blink`: กะพริบตาวนตลอดทุก state (รอบละ 4.2 วิ) แยกจากท่าตัว
- **Inputs = View Model `HomThong`** (data binding, instance `Default`, ผูกกับ artboard แล้ว)
  ไม่ได้ใช้ input แบบ legacy — ต้องใช้ API ฝั่ง view model ตามตัวอย่างด้านล่าง

| property | type | ค่า |
|---|---|---|
| `mood` | number | `0` idle · `1` onboard (wave 1 ครั้ง แล้ว point วนต่อ) · `2` empty (search) · `3` loading · `4` success (กระโดดครั้งเดียว แล้วยืนนิ่ง) |
| `wave` | trigger | โบกมือ 1 ครั้ง จบแล้วกลับไป state ตาม `mood` ปัจจุบัน |
| `celebrate` | trigger | เล่น success 1 ครั้ง จบแล้วกลับไป state ตาม `mood` |

ลำดับการทำงาน (ทดสอบด้วย simulate และใน browser แล้ว):
- เปลี่ยน `mood` → mix ไป state ใหม่ใน 220ms จากท่าวนได้ทุกท่า
- trigger ยิงได้จากทุก state (เป็น transition จาก Any State) ถ้ายิงระหว่างท่า one-shot จะเริ่มท่าใหม่ ไม่หาย
- `wave` / `success` เล่นจนจบ (exit time 100%) แล้วไปต่อตาม `mood`: 0→Idle, 1→Point, 2→Search, 3→Loading, 4→SuccessHold
- `mood = 4` เล่นกระโดดครั้งเดียวแล้วไปอยู่ที่ `SuccessHold` (ท่า idle) จะไม่วนกระโดดซ้ำ ถ้าอยากเล่นอีกให้ยิง `celebrate`

## Animations (60 fps)

| ชื่อ | ยาว | แบบ | รายละเอียด |
|---|---|---|---|
| `idle` | 4.0 s | loop | หายใจ (scaleY 102%) 2 รอบ, ใบข้าว/รวงแกว่งเหลื่อมกัน, แขนแกว่งเบา ๆ |
| `blink` | 4.2 s | loop | กะพริบตา (layer แยก) |
| `wave` | 1.5 s | one-shot | ย่อตัวรับแรง → ยกแขนขวาโบก 2.5 ครั้ง, ตัวเอียงตาม, ใบข้าวสะบัดตามหลัง → กลับท่าพัก |
| `point` | 2.0 s | loop | แขนขวาชี้ไปทางขวา (ชี้ไปที่ UI ข้าง ๆ), หน้าหันตาม |
| `search` | 3.0 s | loop | "?" สีทองเด้งขึ้นเหนือหัว, ตัวเอียงซ้าย/ขวา 6°, มองซ้ายแล้วมองขวา, มือแตะแก้ม, ปากเล็กแบบ "อืม" |
| `loading` | 1.0 s | loop | เด้งตัว squash/stretch ปานกลาง (93–106%), เงาที่พื้นหดและจางตามความสูง |
| `success` | 1.4 s | one-shot | ย่อตัว → กระโดดชูสองแขน → squash ตอนลงพื้น → settle → แขนลงมาที่ท่าพัก |

Rig: bones `ArmL_Bone`, `ArmR_Bone` (แขนเสื้อ + มือ), `Sprout_Bone1` (ใบ + ก้าน + รวง แกว่งทั้งชุด) และ group `Panicle`
(เมล็ดในรวงแกว่งเบา ๆ ช้ากว่าโคน เป็น follow-through) ส่วน `Sprout_Bone2/3` ลบแล้ว
`SparkleA/B` (ประกาย) ถูก key opacity 0 ในทุกท่า ยกเว้น `success` และ group `Question` ("?") ก็ key opacity 0 ในทุกท่า ยกเว้น `search`
ลำตัวใช้ scale ของ group `Body` (pivot ที่ก้น) ทำ squash/stretch · ตาใช้ group `EyeL` / `EyeR` scaleY ทำ blink (เปลือกตาย่อตาม) · หน้าใช้ group `Face` ขยับ x เพื่อหันมอง
group `Husk` (เสื้อเปลือก, pivot ที่ก้น) มี scaleY ของตัวเองที่ช้ากว่าตัว 2–4 เฟรม และเด้งเกินนิดหน่อยใน `loading` / `success` / `wave`
ขอบเปลือกจึงขยับตามหลังตัว (follow-through) แล้วกลับมานิ่งที่ 100% ทุกท่า

## Palette

| token | hex | ใช้ที่ |
|---|---|---|
| grain | `#F3EBDB` (งาช้างอุ่น) | เนื้อข้าว (หัว/ตัว); มือ `#F1EBDD` |
| grain rim | `#E4D9C2` | แถบบางที่ขอบหัวด้านซ้ายบน (ให้ขอบไม่หายบนพื้นขาว) |
| grain cel | `#DFD2B8` | ระนาบเงาบนหัว + แถบเงาใต้ขอบเปลือก |
| husk | `#E8B53A` | เสื้อเปลือก |
| husk cel | `#CC9226` | เงาขวาล่างของเปลือก |
| sleeve | `#D39A2A` | แขนเสื้อ (เข้มกว่าเปลือกนิดหน่อย จะได้แยกจากตัว) |
| husk line | `#A8701A` 2.6px | ตะเข็บกลางเส้นเดียว |
| husk lip | `#F7D477` 4px | ขอบปากเปลือกโค้ง U |
| leaf | `#6DB04F` / `#4E8E3B` (ใบหน้า), `#5FA244` / `#3F7A30` (ใบหลัง) | ใบแบ่งสองโทน, ก้าน `#4E8E3B` |
| seed / sparkle | `#E8B53A` / `#F2C14E` | เมล็ดในรวง, ประกาย |
| ink | `#1E1A17` | ขนตา, รูม่านตา |
| iris | `#7B4A24` | ม่านตา |
| boots | `#4A3324` | เท้า (น้ำตาลเข้ม ไม่ใช้ดำสนิท เพื่อให้เห็นบนพื้น #1c1c20) |
| blush | `#F2A08A` @ 55% | แก้ม |
| mouth | `#2A1A12` + ลิ้น `#E77A5E` | ปาก |
| ground | `#000000` @ 20% | วงรีเงาพื้นแบบแบน |

ไม่มีเส้นขอบรอบตัว ทุกสีเป็น flat solid ไม่ใช้ gradient / feather / blur
แสงมาจากซ้ายบนทิศเดียว เลยออกมาเหมือนกันทั้ง renderer canvas และ webgl
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

// mood: 0 idle · 1 onboard · 2 empty · 3 loading · 4 success
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
   v2–v5 export จากบัญชี Pro แล้วทดสอบใน browser (`@rive-app/webgl2@2.44.2`) ตัวละครขึ้นตั้งแต่เฟรมแรก ไม่มี splash/ลายน้ำ
2. แขนอยู่หลังเสื้อเปลือก ท่า `wave` / `success` ยกมือได้เหนือไหล่ราว 40px แต่ยังไม่สูงเหนือหัว
3. สไตล์ flat ไม่มีเส้นขอบ บนพื้นขาวล้วนขอบหัวด้านซ้ายบนยังอ่อน แม้มีแถบ rim ช่วย ถ้าวางบนการ์ดสีหรือพื้นเทาอ่อนจะเด่นที่สุด
4. ยังไม่มี eye-follow (`look`) และ listener hover/tap — brief ไม่ได้ขอ
