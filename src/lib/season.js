/**
 * ฤดูกาล/เทศกาลไทยของการ์ดต้อนรับหน้า Home (components/home/WelcomeArt.jsx)
 * ช่วงวันที่เป็นค่าประมาณ — ลอยกระทง/สงกรานต์ขยับทุกปี ปรับที่ getSeason()
 * ดูตัวอย่างตอน dev: เติม ?season=loykrathong|rain|hot|songkran|cool|newyear ที่ URL
 */

export const SEASON_LABEL = {
  newyear: "สวัสดีปีใหม่",
  cool: "ฤดูหนาว",
  songkran: "สุขสันต์วันสงกรานต์",
  hot: "ฤดูร้อน",
  rain: "ฤดูฝน",
  loykrathong: "เทศกาลลอยกระทง",
}

export function getSeason(now = new Date()) {
  if (import.meta.env.DEV && typeof window !== "undefined") {
    const q = new URLSearchParams(window.location.search).get("season")
    if (q && SEASON_LABEL[q]) return q
  }
  const md = (now.getMonth() + 1) * 100 + now.getDate()
  if (md >= 1220 || md <= 105) return "newyear"
  if (md >= 410 && md <= 416) return "songkran"
  if (md >= 1110 && md <= 1130) return "loykrathong"
  if (md >= 1201 || md <= 214) return "cool"
  if (md >= 215 && md <= 514) return "hot"
  return "rain"
}
