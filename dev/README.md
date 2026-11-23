# dev/ — ไฟล์ตั้งค่าของ SKT-dev (อยู่เฉพาะ branch `dev`)

โฟลเดอร์นี้เก็บไฟล์ตั้งค่าที่ใช้เฉพาะ **SKT-dev** (backend = staging,
เว็บ = https://skt-dev.vercel.app) — อยู่ใน branch `dev` เท่านั้น
**ห้าม merge เข้า `main`** เพราะ `main` ใช้ค่า production

> repo นี้เป็น **public** — ห้ามใส่ token / password / secret ในโฟลเดอร์นี้เด็ดขาด

## ไฟล์ในโฟลเดอร์

| ไฟล์ | copy ไปเป็น | ใช้ทำอะไร |
|---|---|---|
| `env.local.example` | `.env.local` | ใช้ตอน `npm run build` → ชี้ backend staging |
| `env.development.local.example` | `.env.development.local` | ใช้ตอน `npm run dev` → ยิงผ่าน Vite proxy `/api-proxy` |
| `vercelignore` | `.vercelignore` | ให้ `vercel` CLI อัปโหลดเฉพาะไฟล์ที่ต้องใช้ build |
| `CLAUDE.local.md` | `CLAUDE.local.md` | กฎการทำงานของ Claude ในโฟลเดอร์ SKT-dev |

`vercel.json` (rewrite `/api-proxy/*` → staging) อยู่ที่ root ของ repo
เพราะ Vercel อ่านไฟล์นี้จาก root เท่านั้น

## ตั้งเครื่องใหม่

```bash
git worktree add ../SKT-dev dev
cd ../SKT-dev
cp dev/env.local.example .env.local
cp dev/env.development.local.example .env.development.local
cp dev/vercelignore .vercelignore
cp dev/CLAUDE.local.md CLAUDE.local.md
npm ci
```

แล้วเพิ่มบรรทัดนี้ใน `.git/info/exclude` กันไฟล์ในเครื่องหลุดเข้า git:

```
CLAUDE.local.md
.vercelignore
.vercel/
```

## โปรเจกต์ Vercel `skt-dev` (team `kael-deans-projects`)

- ต่อกับ GitHub แล้ว — push เข้า `dev` เมื่อไร deploy production ให้เอง
- Environment Variables (Production + Preview):
  - `VITE_API_BASE` = `/api-proxy`
  - `VITE_API_BASE_CUSTOM` = `/api-proxy`
- ต้องเป็น `/api-proxy` เท่านั้น ห้ามใส่ URL staging ตรง ๆ — staging ไม่รับ CORS
  จาก `*.vercel.app` แล้ว login จะใช้ไม่ได้ (เคยเกิด 2026-10-16)
