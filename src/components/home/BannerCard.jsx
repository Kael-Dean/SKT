import { cx } from "../../lib/styles"
import { getSeason } from "../../lib/season"
import WelcomeArt from "./WelcomeArt"

/**
 * แบนเนอร์ไล่สี indigo + ลายตามฤดูกาล/เทศกาล (WelcomeArt) + ประกายวิ่ง (welcome-shimmer)
 * ใช้ตัวนี้ทุกที่ที่มีแบนเนอร์หัวหน้า (Home, โปรไฟล์ ฯลฯ) — ห้ามเขียน gradient + ลายเองในหน้า
 * - children วางทับลาย: เนื้อหาหลักต้องมี `relative` (ลายเป็น absolute)
 * - season ไม่ส่ง = ฤดูของวันนี้ (getSeason)
 */
export default function BannerCard({ season, className, children, ...rest }) {
  return (
    <div
      className={cx(
        "relative overflow-hidden rounded-2xl bg-gradient-to-br from-indigo-500 to-indigo-700 p-6 text-white",
        className,
      )}
      {...rest}
    >
      <div className="welcome-shimmer pointer-events-none absolute inset-0" aria-hidden="true" />
      <WelcomeArt season={season ?? getSeason()} />
      {children}
    </div>
  )
}
