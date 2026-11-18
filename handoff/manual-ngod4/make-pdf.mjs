// สร้างคู่มือใหม่ทั้งหมดด้วยคำสั่งเดียว:  node make-pdf.mjs
//   1) node build.mjs  → index.html (จาก content.mjs + img/*.jpg)
//   2) headless Chrome → "SKT-HR คู่มือการใช้งาน งวด 4.pdf"
// ภาพใน img/ ถ่ายใหม่ได้ด้วย overlay.js (ดูวิธีในหัวไฟล์) แล้ววางทับไฟล์เดิมโดยใช้ชื่อเดิม
import { execFileSync } from "node:child_process"
import { existsSync } from "node:fs"
import { fileURLToPath, pathToFileURL } from "node:url"
import path from "node:path"

const dir = path.dirname(fileURLToPath(import.meta.url))
execFileSync(process.execPath, [path.join(dir, "build.mjs")], { stdio: "inherit", cwd: dir })

const candidates = [
  process.env.CHROME,
  "C:/Program Files/Google/Chrome/Application/chrome.exe",
  "C:/Program Files (x86)/Google/Chrome/Application/chrome.exe",
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  "/usr/bin/google-chrome",
].filter(Boolean)
const chrome = candidates.find((p) => existsSync(p))
if (!chrome) { console.error("ไม่พบ Chrome — ตั้งตัวแปร CHROME=path ก่อน"); process.exit(1) }

const out = path.join(dir, "SKT-HR คู่มือการใช้งาน งวด 4.pdf")
execFileSync(chrome, ["--headless=new", "--disable-gpu", "--no-pdf-header-footer", "--virtual-time-budget=25000", `--print-to-pdf=${out}`, pathToFileURL(path.join(dir, "index.html")).href], { stdio: "ignore" })
console.log("PDF →", out)
