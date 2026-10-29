# SKT-dev — กฎเฉพาะโฟลเดอร์ dev (อ่านก่อน CLAUDE.md)

> ไฟล์นี้อยู่เฉพาะ `D:\SKT-dev` — ไม่เข้า git (อยู่ใน `.git/info/exclude`) จึงไม่หลุดไป main
> กฎในไฟล์นี้ **override** กฎใน `CLAUDE.md` ที่ขัดกัน

## สภาพแวดล้อม

| | SKT-dev (โฟลเดอร์นี้) | SKT-main |
|---|---|---|
| Path | `D:\SKT-dev` | `D:\SKT-main` |
| Git | worktree, branch `dev` | repo หลัก (branch `main` / feature) |
| Backend | **staging** `https://um-backend-staging-243977022740.asia-southeast1.run.app` | production `https://api.amcsurin.com` |
| ตั้งค่าที่ | `.env.local` + `.env.development.local` (gitignored) | `.env` (tracked) |

- `npm run dev` → ยิงผ่าน Vite proxy `/api-proxy` → staging (`DEV_PROXY_TARGET`)
- `npm run build` ในโฟลเดอร์นี้ → build ชี้ staging — **ห้ามเอา `dist/` ของ SKT-dev ไปขึ้น bucket production**

## เว็บ dev บน Vercel — https://skt-dev.vercel.app

- โปรเจกต์ Vercel `skt-dev` (team `kael-deans-projects`) — **ต่อ GitHub แล้ว**: push เข้า `dev` = deploy production อัตโนมัติ
  (`vercel deploy` จาก CLI ตรง ๆ จะขึ้น BLOCKED — ถ้าต้อง build ใหม่โดยไม่ push ใช้
  `vercel redeploy <deployment-url ล่าสุด> --target production --scope kael-deans-projects`)
- Backend staging ไม่อนุญาต CORS จาก `*.vercel.app` → `vercel.json` rewrite `/api-proxy/*` → staging (same-origin, ไม่ติด CORS)
- Env ของโปรเจกต์ Vercel: `VITE_API_BASE` = `VITE_API_BASE_CUSTOM` = `/api-proxy` (Production + Preview)
  — ห้ามใส่ URL staging ตรง ๆ (CORS พัง login ไม่ได้ — เกิดแล้ว 2026-10-16)
- `vercel.json` **track ใน branch `dev`** (ต้องมีเพราะ Vercel build จาก Git) — `.vercelignore`, `.vercel/` อยู่ใน `.git/info/exclude`
- `.vercelignore` อัปเฉพาะ `src/ public/ index.html package*.json vite.config.js eslint.config.js vercel.json` — ห้ามเพิ่ม `Brief/` `handoff/` `.env*` `.claude/`
- **ทุกครั้งหลัง commit + push เข้า `dev`** Vercel deploy ให้เอง → ดูว่า deployment ล่าสุดขึ้น READY แล้วแจ้งผู้ใช้ว่าอัปเดตที่ https://skt-dev.vercel.app แล้ว

## ทดสอบบน staging ด้วย Claude in Chrome (อนุญาตแล้ว ไม่ต้องถาม)

หลัง deploy READY ใช้ Claude in Chrome เปิด https://skt-dev.vercel.app ทดสอบหน้าที่แก้ได้ทันที — Chrome ของผู้ใช้
login staging ไว้แล้ว (Browser pane ในแอปไม่จำ session ใช้ไม่ได้)
- เช็ค API บน staging ด้วย `fetch('/api-proxy/...', { headers: { Authorization: 'Bearer ' + localStorage.getItem('token') } })`
  ใน javascript_tool — ดู response shape / ว่า backend deploy field ใหม่แล้วหรือยัง ก่อนแก้ FE
- ข้อมูลทดสอบ: ใช้ **สาขาทดสอบ 1–4 / แผนกโรงสีทดสอบ** และ account ตัวเอง (mmt, user id 1) — ห้ามแก้ข้อมูลพนักงานจริง
- สิ่งที่สร้างเพื่อทดสอบ (กิจกรรม ไฟล์แนบ ฯลฯ) ลบคืนเมื่อทำได้ · สิ่งที่ย้อนไม่ได้ (อนุมัติ, บันทึก KPI) แจ้งผู้ใช้ในสรุปทุกครั้ง
- ห้ามแตะ production (`api.amcsurin.com` / `amcsurin.com`) ผ่าน Chrome — ดูอย่างเดียว
- account ที่ login อยู่เป็น Super Admin role เดียว — flow ที่ต้องสลับ role (หัวหน้าให้ความเห็น ฯลฯ) ให้แจ้งผู้ใช้ว่ายังทดสอบไม่ได้

## โฟลเดอร์ `dev/` (track ใน branch `dev` เท่านั้น)

- เก็บสำเนาไฟล์ตั้งค่าของ dev: `env.local.example`, `env.development.local.example`, `vercelignore`, `CLAUDE.local.md` + `README.md` (วิธีตั้งเครื่องใหม่)
- แก้ `.env.local` / `.env.development.local` / `.vercelignore` / `CLAUDE.local.md` เมื่อไร → copy ไปทับใน `dev/` ด้วย แล้ว commit
- repo เป็น **public** — ห้ามมี token/secret ใน `dev/` (เช่น `VERCEL_OIDC_TOKEN` ใน `.env.local` ห้าม copy)
- `dev/` และ `vercel.json` **ห้ามเข้า main** — ดูขั้นตอนข้างล่าง
- ⚠️ ห้ามรัน `vercel link` ซ้ำโดยไม่ดูผล — มันแก้ `.gitignore` (tracked) ต้อง `git checkout -- .gitignore` คืน

## ⚠️ กฎบังคับ: ถามเรื่อง dev → main ทุกครั้งที่เปลี่ยนไฟล์

ทุกครั้งที่ task ใด ๆ ใน SKT-dev **มีการสร้าง/แก้/ลบไฟล์** (หลัง commit + push เข้า `dev` และ deploy Vercel เสร็จ) ต้อง
**ถามผู้ใช้ด้วย `AskUserQuestion` เสมอ ก่อนจบ turn** — ห้ามข้าม ห้ามเดาคำตอบ ห้ามทำเองโดยไม่ถาม:

> **"นำสิ่งที่เปลี่ยนแปลงจาก dev ไปอัพเดทใน main ไหม?"**

ในคำถามให้แสดงสรุปสั้น ๆ: commit ที่ยังไม่อยู่ใน main (`git log --oneline origin/main..dev`) + ไฟล์ที่เปลี่ยน (`git diff --stat origin/main...dev`)

ตัวเลือก:
1. **ใช่ — เปิด PR เข้า `main`** (ตัด `dev/` + `vercel.json` ออก, squash merge)
2. **ยังไม่ต้อง** — เก็บไว้ใน dev ก่อน

ถ้าผู้ใช้ตอบ "ยังไม่ต้อง" → จบ ไม่ต้องทำอะไรต่อ (รอบหน้าที่แก้ไฟล์ให้ถามใหม่)

## ขั้นตอนเมื่อผู้ใช้ตอบ "ใช่"

1. ตรวจว่า `dev` commit + push ครบ: `git status` สะอาด, `git push origin dev`
2. `git fetch origin`
3. ถ้า main มี commit ใหม่ที่ dev ยังไม่มี (`git log --oneline dev..origin/main` ไม่ว่าง) → `git merge origin/main` เข้า dev ก่อน, แก้ conflict, `npm run build` ให้ผ่าน, commit + push dev
4. **ตัด `dev/` + `vercel.json` ออกก่อนขึ้น main** — ทำ branch แยก ไม่แตะ `dev`:
   `git switch -c to-main/<วันที่> dev` → `git rm -r -q dev vercel.json` → commit `chore: drop dev-only files for main` → `git push -u origin to-main/<วันที่>` → `git switch dev`
5. **ตรวจกันค่า staging หลุดเข้า main** — ใน branch `to-main/...` ต้องไม่เจอ URL staging:
   `git grep -n "um-backend-staging" to-main/<วันที่> -- . ":!CLAUDE.local.md"` → ต้องว่าง
   (`.env` ที่ track ต้องเป็นค่า production เท่าเดิม)
6. อัปเดต main ผ่าน PR จาก branch `to-main/...` เท่านั้น:
   `gh pr create --base main --head to-main/<วันที่> --title "..." --body "..."` → ส่งลิงก์ PR ให้ผู้ใช้
   - **บอกผู้ใช้ให้กด "Squash and merge" เท่านั้น** — ถ้า merge แบบปกติ commit ที่ลบ `dev/` + `vercel.json` จะไหลกลับเข้า `dev`
     ตอน `git merge origin/main` แล้วลบไฟล์ dev ทิ้ง (login เว็บ dev พังแบบ e33dd24)
   - ตัวเลือก "push ตรงเข้า main" ใช้ไม่ได้แล้ว (จะพา `dev/` + `vercel.json` เข้า main) — ถ้าผู้ใช้เลือก ให้อธิบายแล้วเสนอ PR แทน
   - หลัง `git merge origin/main` เข้า dev ทุกครั้ง: เช็คว่า `dev/` กับ `vercel.json` ยังอยู่ ถ้าหายให้ `git checkout ORIG_HEAD -- dev vercel.json` คืน
7. sync ref main ในเครื่อง: `git fetch origin main:main` (ถ้า `D:\SKT-main` checkout `main` อยู่ ให้บอกผู้ใช้ไป `git pull` ที่นั่นเอง)
8. รายงานผลสั้น ๆ: commit ที่ขึ้น main / ลิงก์ PR

## ข้อห้าม

- **ห้ามแก้ไฟล์ใน `D:\SKT-main` โดยตรง** จากเซสชันนี้ — ทุกอย่างไป main ผ่าน git เท่านั้น
- **ห้ามแก้ `.env`** (tracked, เป็นค่า production) — ค่า dev ใส่ `.env.local` / `.env.development.local` เท่านั้น
- กฎ "Auto commit + push" ใน `CLAUDE.md` → ในโฟลเดอร์นี้ commit + push เข้า **`dev` เท่านั้น** ห้าม push เข้า `main` โดยไม่ผ่านคำถามข้างบน
- ห้าม `git push --force` ทุก branch
