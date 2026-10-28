// src/components/onboarding/OnboardingBanner.jsx
// Compact resume strip on Home while onboarding is not done: "กรอกข้อมูลต่อ" before unlock,
// "เริ่มทัวร์เมนู" / "ดูทัวร์ต่อ" after. Hidden while the tour itself is running.
import { useNavigate } from "react-router-dom"
import ProgressRing from "./ProgressRing"
import { SECTIONS, useOnboarding } from "../../lib/onboarding"
import { TOUR_LENGTH } from "../../lib/onboardingTour"
import { resumeTour, startTour, useTourState } from "../../lib/tourState"
import { cx, primaryBtnCls } from "../../lib/styles"

export default function OnboardingBanner() {
  const ob = useOnboarding()
  const tour = useTourState()
  const navigate = useNavigate()
  if (!ob.needsOnboarding) return null
  if (ob.unlocked && tour.active) return null

  const unlocked = ob.unlocked
  const resuming = unlocked && tour.started
  const title = unlocked ? "ข้อมูลครบแล้ว เหลือดูทัวร์เมนูอีกนิด" : "กรอกข้อมูลเริ่มต้นให้ครบ เพื่อเปิดเมนูบริการตนเอง"
  const sub = unlocked
    ? resuming
      ? `ค้างไว้ที่จุด ${tour.index + 1} จาก ${TOUR_LENGTH}`
      : "ใช้เวลาประมาณ 1 นาที แล้วเมนูทั้งหมดจะเปิดให้ใช้"
    : `กรอกแล้ว ${ob.confirmedCount} จาก ${SECTIONS.length} หัวข้อ ใช้เวลาประมาณ 10 นาที`
  const cta = unlocked ? (resuming ? "ดูทัวร์ต่อ" : "เริ่มทัวร์เมนู") : ob.confirmedCount > 0 ? "กรอกข้อมูลต่อ" : "เริ่มกรอกข้อมูล"
  const go = () => {
    if (!unlocked) navigate("/onboarding")
    else if (resuming) resumeTour()
    else startTour(0)
  }

  return (
    <section
      aria-label="ข้อมูลเริ่มต้น"
      className="animate-fade-up flex flex-col gap-4 rounded-2xl bg-white p-4 shadow-sm ring-1 ring-indigo-200/80 sm:flex-row sm:items-center sm:p-5 dark:bg-surface dark:shadow-none dark:ring-indigo-400/25"
    >
      <div className="flex min-w-0 flex-1 items-center gap-4">
        <ProgressRing
          value={unlocked ? SECTIONS.length : ob.confirmedCount}
          total={SECTIONS.length}
          size={52}
          stroke={5}
        />
        <div className="min-w-0">
          <p className="text-base font-semibold leading-relaxed text-gray-900 dark:text-gray-100">{title}</p>
          <p className="text-sm leading-relaxed text-gray-600 dark:text-gray-400">{sub}</p>
        </div>
      </div>
      <button type="button" onClick={go} className={cx(primaryBtnCls, "h-11 w-full shrink-0 px-5 sm:w-auto")}>
        {cta}
      </button>
    </section>
  )
}
