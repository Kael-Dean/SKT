/**
 * ฤดูกาล/เทศกาลไทยของการ์ดต้อนรับหน้า Home (components/home/WelcomeArt.jsx)
 * ช่วงวันที่เป็นค่าประมาณ — ลอยกระทง/สงกรานต์ขยับทุกปี ปรับที่ getSeason()
 * ดูตัวอย่างตอน dev: เติม ?season=loykrathong|elephant|rain|hot|songkran|cool|newyear ที่ URL
 */

export const SEASON_LABEL = {
  newyear: "สวัสดีปีใหม่",
  cool: "ฤดูหนาว",
  songkran: "สุขสันต์วันสงกรานต์",
  hot: "ฤดูร้อน",
  rain: "ฤดูฝน",
  loykrathong: "เทศกาลลอยกระทง",
  elephant: "งานช้างสุรินทร์",
}

/** ลำดับตามปฏิทิน + ช่วงวันที่ที่แสดงในแกลเลอรีลาย (ต้องตรงกับ getSeason) */
export const SEASON_ORDER = ["newyear", "cool", "hot", "songkran", "rain", "elephant", "loykrathong"]
export const SEASON_RANGE = {
  newyear: "20 ธ.ค. – 5 ม.ค.",
  cool: "6 ม.ค. – 14 ก.พ. · 1–19 ธ.ค.",
  hot: "15 ก.พ. – 14 พ.ค.",
  songkran: "10–16 เม.ย.",
  rain: "15 พ.ค. – 9 พ.ย.",
  elephant: "10–22 พ.ย.",
  loykrathong: "23–30 พ.ย.",
}

export function getSeason(now = new Date()) {
  if (import.meta.env.DEV && typeof window !== "undefined") {
    const q = new URLSearchParams(window.location.search).get("season")
    if (q && SEASON_LABEL[q]) return q
  }
  const md = (now.getMonth() + 1) * 100 + now.getDate()
  if (md >= 1220 || md <= 105) return "newyear"
  if (md >= 410 && md <= 416) return "songkran"
  // งานช้างสุรินทร์ ~สัปดาห์ที่ 3 ของ พ.ย. → ต่อด้วยลอยกระทง (ขึ้น 15 ค่ำ เดือน 12; ปี 2569 = 24 พ.ย.)
  if (md >= 1110 && md <= 1122) return "elephant"
  if (md >= 1123 && md <= 1130) return "loykrathong"
  if (md >= 1201 || md <= 214) return "cool"
  if (md >= 215 && md <= 514) return "hot"
  return "rain"
}
