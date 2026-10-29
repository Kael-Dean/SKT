# มาสคอต "น้องหอมทอง" (Hom Thong) — Rive handoff

ตัวการ์ตูนเมล็ดข้าวหอมมะลิของ AMC — สหกรณ์การเกษตรเพื่อการตลาดลูกค้า ธ.ก.ส. สุรินทร์
ใช้ในแอป HR: onboarding, empty state, loading, success

**Concept (v2):** หัว/ตัวคือเมล็ดข้าวสารสีขาวมุก เงาครีมอุ่น ๆ สวม "เปลือกข้าวสีทอง" เป็นเสื้อ
เปลือกแตกเป็นปากเปิดด้านบน (ปลายแหลมสองข้าง + รอยแยกรูปตัว V ตรงกลางหน้าอก) ให้หน้าขาวโผล่ออกมา
เปลือกมีเส้นสันตามยาวแบบแกลบจริง, ขอบปากมีไฮไลต์บอกความหนา, มีเงา AO บนเนื้อขาวใต้ขอบเปลือก
แขนเป็นแขนเสื้อเปลือกทอง มือเป็นเนื้อข้าวขาว ขาเป็นเนื้อข้าวขาว บนหัวยังมีใบข้าว 2 ใบ + รวงเล็ก

API ของ runtime เหมือน v1 ทุกอย่าง (artboard / state machine / view model / ชื่อ animation) โค้ดฝั่งแอปจึงไม่ต้องแก้

## ไฟล์

| ไฟล์ | ใช้ทำอะไร |
|---|---|
| `public/mascot/homthong.riv` | runtime file (11.9 KB, export จากบัญชี Rive Pro ไม่มี splash/ลายน้ำ) |
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
| `search` | 3.0 s | loop | มือซ้ายเกาแก้ม/ข้างหัว, มองซ้ายแล้วมองขวา, ปากเล็กแบบ "อืม" |
| `loading` | 1.0 s | loop | เด้งตัว squash/stretch ปานกลาง (93–106%), เงาที่พื้นหดและจางตามความสูง |
| `success` | 1.4 s | one-shot | ย่อตัว → กระโดดชูสองแขน → squash ตอนลงพื้น → settle → แขนลงมาที่ท่าพัก |

Rig: bones `ArmL_Bone`, `ArmR_Bone` (แขนเสื้อ + มือ), chain 3 ท่อน `Sprout_Bone1-3` (ใบข้าว+รวงเป็น follow-through)
ลำตัวใช้ scale ของ group `Body` (pivot ที่ก้น) ทำ squash/stretch · ตาใช้ group `EyeL` / `EyeR` scaleY ทำ blink (เปลือกตาย่อตาม) · หน้าใช้ group `Face` ขยับ x เพื่อหันมอง
group `Husk` (เสื้อเปลือก, pivot ที่ก้น) มี scaleY ของตัวเองที่ช้ากว่าตัว 2–4 เฟรม และเด้งเกินนิดหน่อยใน `loading` / `success` / `wave`
ขอบเปลือกจึงขยับตามหลังตัว (follow-through) แล้วกลับมานิ่งที่ 100% ทุกท่า

## Palette

| token | hex | ใช้ที่ |
|---|---|---|
| grain white | `#FFFFFF` → `#FDFBF6` → `#F6F0E2` | เนื้อข้าว (หัว/ตัว/มือ/ขา) radial จากซ้ายบน |
| grain shade | `#E9DFC8` → `#D8C8A6`, form shadow `#C9B48C`→`#9C8460` | เงาครีมอุ่นด้านขวาล่าง |
| grain outline | `#9C8462` 3.5px | เส้นขอบเนื้อข้าว (สีน้ำตาลอุ่น ไม่ใช้ดำ) |
| rim light | `#FFFFFF` @ 90% | เส้นขอบสว่างด้านขวาของหัว บอกความใส |
| husk base | `#E8B53A` (ไล่ `#FFE7A3` → `#F4C653` → `#E8B53A` → `#D29C32` → `#B9832A`) | เสื้อเปลือก |
| husk shade | `#A06A1E` → `#7E5016` | form shadow บนเปลือก |
| husk outline | `#9A661C` 3.5px | ขอบเปลือก + แขนเสื้อ |
| husk ridges | เข้ม `#A8721F` @ 45% 2px + สว่าง `#FFEDB8` @ 60% 1.6px | เส้นสันตามยาว (เส้นภายในบางกว่าเส้นขอบ) |
| husk lip | `#FFF2C8` @ 90% | ขอบปากเปลือก (ความหนา) |
| AO under lip | `#A88C60` @ 12–20% | เงาบนเนื้อขาวใต้ขอบเปลือก |
| leaf green | `#6FA84A` (ไล่ `#4E8A34`→`#9ED170`) | ใบ, ก้าน `#5E9A3E` |
| eye | iris `#1E1208` → `#3A2410` → `#9A6128`, pupil `#140A03`, lid `#2A170A`, catchlight ขาว 2 จุด | ตา |
| cheek | `#F59A7A` @ 70%→0 | แก้ม |

ระบบเส้น: ใช้เส้นขอบสีอุ่นตามวัสดุ เส้นนอก 3.5px เส้นภายใน 1.6–2px
(ขาวบนพื้นขาวต้องมีเส้นถึงจะอ่านออกที่ขนาดเล็ก เลยไม่เลือกแบบไม่มีเส้น)
แสงมาจากซ้ายบนทิศเดียว เงาทุกชั้นทำด้วย gradient (ไม่ใช้ feather/blur) จึงออกมาเหมือนกันทั้ง renderer canvas และ webgl
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
   v2 export จากบัญชี Pro แล้วทดสอบใน browser (`@rive-app/webgl2@2.44.2`) ตัวละครขึ้นตั้งแต่เฟรมแรก ไม่มี splash/ลายน้ำ
2. ท่า `search` มือไปได้ถึงแก้ม/ข้างหัวเท่านั้น เพราะลำตัวทั้งก้อนคือหัว และแขนอยู่หลังเสื้อเปลือก
3. ยังไม่มี eye-follow (`look`) และ listener hover/tap — brief ไม่ได้ขอ
