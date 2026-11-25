// src/lib/signatureImage.js
// แปลงรูปลายเซ็นที่พนักงานถ่าย/สแกน (JPG/PNG พื้นขาว) → PNG พื้นโปร่งใส หมึกสีเดียว ตัดขอบ
// ทำในเบราว์เซอร์ทั้งหมด (ไม่ส่งรูปต้นฉบับไปไหน) — backend ตรวจไฟล์ซ้ำอีกชั้น
//
//   const { blob, url, width, height } = await toTransparentSignature(file)
//   url = object URL สำหรับพรีวิว (ผู้เรียก revoke เอง)

const MAX_SIDE = 1600 // พอสำหรับพิมพ์ A4 (ช่องลงชื่อสูง ~15 mm)
const MIN_SIDE = 900 // รูปเล็กกว่านี้ขยายขึ้นก่อนตัดพื้นหลัง
const smooth = (e0, e1, x) => {
  const t = Math.min(1, Math.max(0, (x - e0) / (e1 - e0)))
  return t * t * (3 - 2 * t)
}

async function decode(file) {
  if (typeof createImageBitmap === "function") {
    try {
      return await createImageBitmap(file, { imageOrientation: "from-image" })
    } catch {
      /* fall back to <img> */
    }
  }
  const url = URL.createObjectURL(file)
  try {
    const img = new Image()
    img.decoding = "async"
    img.src = url
    await img.decode()
    return img
  } finally {
    URL.revokeObjectURL(url)
  }
}

/** ไฟล์รูปที่รับ: PNG / JPG / WEBP (HEIC จาก iPhone เบราว์เซอร์มักแปลงเป็น JPG ให้ตอนเลือกไฟล์) */
export const SIGNATURE_INPUT_ACCEPT = "image/png,image/jpeg,image/webp"
export const SIGNATURE_INPUT_MAX_BYTES = 15 * 1024 * 1024

export async function toTransparentSignature(file) {
  if (!file) throw new Error("ไม่พบไฟล์")
  if (file.type && !/^image\/(png|jpeg|webp)$/.test(file.type)) throw new Error("รองรับเฉพาะรูป PNG, JPG หรือ WEBP")
  if (file.size > SIGNATURE_INPUT_MAX_BYTES) throw new Error("รูปใหญ่เกิน 15 MB")

  let src
  try {
    src = await decode(file)
  } catch {
    throw new Error("เปิดรูปนี้ไม่ได้ ลองถ่ายใหม่เป็น JPG หรือ PNG")
  }
  // รูปใหญ่ย่อลง · รูปเล็กมาก (สแกนเก่า) ขยายขึ้นให้ขอบเส้นนุ่ม
  const longest = Math.max(src.width, src.height)
  const scale = Math.min(MAX_SIDE / longest, Math.max(1, MIN_SIDE / longest))
  const W = Math.max(1, Math.round(src.width * scale))
  const H = Math.max(1, Math.round(src.height * scale))
  const canvas = document.createElement("canvas")
  canvas.width = W
  canvas.height = H
  const ctx = canvas.getContext("2d", { willReadFrequently: true })
  ctx.imageSmoothingEnabled = true
  ctx.imageSmoothingQuality = "high"
  ctx.fillStyle = "#fff" // PNG โปร่งใสอยู่แล้ว = ถือว่าพื้นขาว
  ctx.fillRect(0, 0, W, H)
  ctx.drawImage(src, 0, 0, W, H)
  src.close?.()

  const img = ctx.getImageData(0, 0, W, H)
  const px = img.data
  const n = W * H

  // ความเข้มหมึก = ช่องสีที่มืดที่สุดเทียบกับสีกระดาษ (หมึกน้ำเงิน → R/G มืด)
  const mins = new Float32Array(n)
  for (let i = 0; i < n; i++) mins[i] = Math.min(px[i * 4], px[i * 4 + 1], px[i * 4 + 2])
  const sample = []
  for (let i = 0; i < n; i += Math.max(1, Math.floor(n / 20000))) sample.push(mins[i])
  sample.sort((a, b) => a - b)
  const paper = Math.max(sample[Math.floor(sample.length * 0.6)], 1) // ส่วนใหญ่ของรูปคือกระดาษ

  // หมึกจาง (ปากกาสีอ่อน / สแกนซีด) → ปรับให้เส้นที่เข้มที่สุดเป็นหมึกเต็ม
  const ink = new Float32Array(n)
  for (let i = 0; i < n; i++) ink[i] = Math.max(0, 1 - mins[i] / paper)
  const inkSample = []
  for (let i = 0; i < n; i += Math.max(1, Math.floor(n / 40000))) if (ink[i] > 0.08) inkSample.push(ink[i])
  inkSample.sort((a, b) => a - b)
  const peak = inkSample.length ? inkSample[Math.floor(inkSample.length * 0.9)] : 0
  if (peak < 0.12) throw new Error("ไม่พบลายเซ็นในรูป — เซ็นด้วยปากกาเข้ม ๆ บนกระดาษขาว แล้วถ่ายให้ชัด")
  const norm = Math.min(1, Math.max(peak, 0.25))

  const alpha = new Float32Array(n)
  let inkR = 0, inkG = 0, inkB = 0, inkN = 0, solid = 0
  for (let i = 0; i < n; i++) {
    const v = ink[i] / norm
    alpha[i] = smooth(0.25, 0.6, v)
    if (alpha[i] > 0.5) solid++
    if (v > 0.75) {
      inkR += px[i * 4]; inkG += px[i * 4 + 1]; inkB += px[i * 4 + 2]; inkN++
    }
  }
  if (solid < 30 || !inkN) throw new Error("ไม่พบลายเซ็นในรูป — เซ็นด้วยปากกาเข้ม ๆ บนกระดาษขาว แล้วถ่ายให้ชัด")
  const col = [inkR / inkN, inkG / inkN, inkB / inkN].map((v) => Math.round(v * 0.85))

  // ตัดขอบให้เหลือแต่ลายเซ็น
  let x1 = W, y1 = H, x2 = -1, y2 = -1
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    if (alpha[y * W + x] > 0.05) {
      if (x < x1) x1 = x
      if (x > x2) x2 = x
      if (y < y1) y1 = y
      if (y > y2) y2 = y
    }
  }
  const M = 12
  x1 = Math.max(0, x1 - M); y1 = Math.max(0, y1 - M); x2 = Math.min(W - 1, x2 + M); y2 = Math.min(H - 1, y2 + M)
  const cw = x2 - x1 + 1, ch = y2 - y1 + 1
  if (cw < 20 || ch < 20) throw new Error("ลายเซ็นเล็กเกินไป — ถ่ายให้ใกล้ขึ้น")
  // ถ้ายังเหลือเกือบทั้งรูป = รูปมีเงา/ขอบกระดาษ/พื้นหลังอื่นติดมา
  const coverage = alpha.reduce((s, a) => s + (a > 0.5 ? 1 : 0), 0) / n
  if (coverage > 0.25) throw new Error("พื้นหลังไม่สะอาด (มีเงาหรือลวดลาย) — ถ่ายบนกระดาษขาวในที่สว่าง ไม่ให้มีเงา")

  const out = ctx.createImageData(cw, ch)
  for (let y = 0; y < ch; y++) for (let x = 0; x < cw; x++) {
    const o = (y * cw + x) * 4
    out.data[o] = col[0]; out.data[o + 1] = col[1]; out.data[o + 2] = col[2]
    out.data[o + 3] = Math.round(alpha[(y + y1) * W + x + x1] * 255)
  }
  const outCanvas = document.createElement("canvas")
  outCanvas.width = cw
  outCanvas.height = ch
  outCanvas.getContext("2d").putImageData(out, 0, 0)
  const blob = await new Promise((resolve) => outCanvas.toBlob(resolve, "image/png"))
  if (!blob) throw new Error("แปลงรูปไม่สำเร็จ")
  if (blob.size > 1024 * 1024) throw new Error("ไฟล์ลายเซ็นใหญ่เกิน 1 MB — ลองครอปให้เหลือแต่ลายเซ็น")
  const name = `${String(file.name || "signature").replace(/\.[a-z0-9]+$/i, "")}.png`
  return { blob, file: new File([blob], name, { type: "image/png" }), url: URL.createObjectURL(blob), width: cw, height: ch }
}
