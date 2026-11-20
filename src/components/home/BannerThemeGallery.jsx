import { Check } from "lucide-react"
import { Sheet } from "../ui"
import { cx, focusRingCls } from "../../lib/styles"
import { SEASON_LABEL, SEASON_ORDER, SEASON_RANGE } from "../../lib/season"
import WelcomeArt from "./WelcomeArt"

/**
 * แกลเลอรีลายแบนเนอร์ต้อนรับทุกฤดู/เทศกาล (Super Admin เท่านั้น — คีย์ home.bannerThemes.preview)
 * เลือกลาย = แสดงตัวอย่างบนแบนเนอร์หน้าหลักชั่วคราว (ไม่บันทึก, ผู้ใช้อื่นไม่เห็น, รีเฟรชแล้วกลับเป็นลายตามวันที่)
 */
export default function BannerThemeGallery({ open, onClose, today, shown, onPick }) {
  return (
    <Sheet
      open={open}
      onClose={onClose}
      size="lg"
      title="ลายแบนเนอร์ทั้งหมด"
      subtitle="ระบบเปลี่ยนลายเองตามวันที่ · กดลายเพื่อดูตัวอย่างบนแบนเนอร์ (เห็นเฉพาะคุณ ไม่บันทึก)"
    >
      <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {SEASON_ORDER.map((s) => {
          const active = s === shown
          return (
            <li key={s} className="min-w-0">
              <button
                type="button"
                onClick={() => onPick(s)}
                aria-pressed={active}
                className={cx(
                  "group block w-full min-w-0 rounded-2xl p-1.5 text-left ring-1 transition-colors duration-200",
                  active
                    ? "bg-indigo-50 ring-2 ring-indigo-500 dark:bg-indigo-500/10 dark:ring-indigo-400"
                    : "ring-gray-200 hover:bg-gray-50 dark:ring-line dark:hover:bg-raised",
                  focusRingCls,
                )}
              >
                <span className="relative block h-24 overflow-hidden rounded-xl bg-gradient-to-br from-indigo-500 to-indigo-700">
                  <WelcomeArt season={s} tile />
                </span>
                <span className="flex min-w-0 items-center gap-2 px-1.5 pb-1 pt-2">
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-semibold text-gray-900 dark:text-gray-100">{SEASON_LABEL[s]}</span>
                    <span className="block truncate text-xs text-gray-500 dark:text-gray-400">{SEASON_RANGE[s]}</span>
                  </span>
                  {s === today && (
                    <span className="shrink-0 rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-semibold text-emerald-700 ring-1 ring-emerald-200 dark:bg-emerald-500/10 dark:text-emerald-300 dark:ring-emerald-500/30">
                      วันนี้
                    </span>
                  )}
                  {active && <Check aria-hidden="true" className="size-4 shrink-0 text-indigo-600 dark:text-indigo-300" />}
                </span>
              </button>
            </li>
          )
        })}
      </ul>
    </Sheet>
  )
}
