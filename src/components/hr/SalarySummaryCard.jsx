// src/components/hr/SalarySummaryCard.jsx
// สรุปเจ้าหน้าที่ที่เลือก: ชื่อ ตำแหน่ง กระบอก ขั้นปัจจุบัน เงินเดือนปัจจุบัน (spec §3.1 Summary card)
// ข้อมูลมาจาก useEmployeeSalary (salaryData.js) — component นี้แสดงผลอย่างเดียว
import { ErrorState, Skeleton } from "../ui"
import { Notice } from "./HrModal"
import { useSalaryLookup } from "./salaryData"
import { cx, focusRingCls } from "../../lib/styles"
import { tierName, thb, fmtLevel, employeeName } from "./positionUtils"

const SURFACE = "rounded-2xl ring-1 ring-gray-200/70 dark:ring-gray-700/70 shadow-sm p-5"

/** Inline link inside an amber Notice — inherits the notice's text colour. */
const GO_LINK = "rounded font-semibold underline underline-offset-2 cursor-pointer " + focusRingCls

// first consonant: skip Thai leading vowels (เ แ โ ใ ไ) so "เอกชัย" → "อ", not "เ"
const firstLetter = (s) => Array.from(String(s ?? "").trim()).find((ch) => !/[เแโใไ]/.test(ch)) ?? ""

function initialsOf(person) {
  return (firstLetter(person?.first_name) + firstLetter(person?.last_name)) || "?"
}

function Cell({ label, children }) {
  return (
    <div className="min-w-0">
      <dt className="text-xs text-gray-500 dark:text-gray-400">{label}</dt>
      <dd className="mt-1 text-base font-semibold tabular-nums text-gray-900 dark:text-gray-100 break-words">{children}</dd>
    </div>
  )
}

export default function SalarySummaryCard({
  emp,                // list record from EmployeePicker (name/id fallback)
  info,               // useEmployeeSalary(...) result
  positionsLoading = false,
  onGoToPositions,
  highlight = "off",  // "just updated" cue: "on" | "fading" (bg eases back over 1.2s) | "off"
}) {
  const { detail, loading, error, retry, positionId, position, tierId, currentLevel } = info
  const salary = useSalaryLookup(tierId, currentLevel)

  // transition only while fading, so theme switches and loads stay instant
  const surface = cx(
    SURFACE,
    highlight === "on" ? "bg-indigo-50/60 dark:bg-indigo-500/10" : "bg-white dark:bg-gray-800",
    highlight === "fading" && "transition-colors duration-[1200ms] ease-out motion-reduce:transition-none",
  )

  if (error) {
    return (
      <section className={surface} aria-label="ข้อมูลเจ้าหน้าที่">
        <ErrorState message={error} onRetry={retry} />
      </section>
    )
  }

  if (loading || positionsLoading) {
    return (
      <section className={surface} aria-busy="true" aria-label="กำลังโหลดข้อมูลเจ้าหน้าที่">
        <div className="flex items-center gap-3">
          <Skeleton className="size-11 shrink-0" rounded="rounded-full" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-5 w-48" />
            <Skeleton className="h-4 w-64 max-w-full" />
          </div>
        </div>
        <div className="mt-4 grid grid-cols-2 sm:grid-cols-3 gap-4 border-t border-gray-100 pt-4 dark:border-gray-700">
          {[0, 1, 2].map((i) => (
            <div key={i} className="space-y-2">
              <Skeleton className="h-3 w-16" />
              <Skeleton className="h-5 w-20" />
            </div>
          ))}
        </div>
      </section>
    )
  }

  const person = detail?.first_name || detail?.last_name ? detail : emp
  const name = employeeName(person) || employeeName(emp)
  const id = emp?.id ?? detail?.id
  const positionTitle = position?.title ?? (positionId != null ? `ตำแหน่ง #${positionId}` : null)

  return (
    <section className={surface} aria-labelledby="salary-summary-name">
      <div className="flex items-center gap-3 min-w-0">
        <span
          aria-hidden="true"
          className="flex size-11 shrink-0 items-center justify-center rounded-full bg-gray-100 text-sm font-semibold text-gray-600 dark:bg-gray-700 dark:text-gray-200"
        >
          {initialsOf(person)}
        </span>
        <div className="min-w-0">
          <h3 id="salary-summary-name" className="text-lg font-bold text-gray-900 dark:text-gray-100 truncate" title={name}>
            {name}
          </h3>
          <p className="text-sm text-gray-500 dark:text-gray-400 truncate">
            <span className="tabular-nums">รหัส {id}</span> · {positionTitle ?? "ยังไม่มีตำแหน่ง"}
          </p>
        </div>
      </div>

      <dl className="mt-4 grid grid-cols-2 sm:grid-cols-3 gap-4 border-t border-gray-100 pt-4 dark:border-gray-700">
        <Cell label="กระบอก">
          {tierId != null ? (
            tierName(tierId)
          ) : (
            <span className="font-medium text-amber-700 dark:text-amber-300">ยังไม่กำหนด</span>
          )}
        </Cell>
        <Cell label="ขั้นปัจจุบัน">
          {currentLevel != null ? fmtLevel(currentLevel) : <span className="font-medium text-gray-500 dark:text-gray-400">ไม่ระบุ</span>}
        </Cell>
        <Cell label="เงินเดือนปัจจุบัน">
          {tierId == null || currentLevel == null ? (
            <span className="font-medium text-gray-500 dark:text-gray-400">ไม่พบ</span>
          ) : salary.status === "loading" ? (
            <Skeleton className="h-5 w-24" />
          ) : salary.status === "ok" ? (
            <>{thb(salary.amount)} <span className="text-sm font-normal text-gray-500 dark:text-gray-400">บาท</span></>
          ) : (
            <span className="font-medium text-gray-500 dark:text-gray-400" title="ไม่พบขั้นนี้ในบัญชีเงินเดือน">ไม่พบ</span>
          )}
        </Cell>
      </dl>

      {positionId == null ? (
        <Notice tone="warning" className="mt-4">เจ้าหน้าที่คนนี้ยังไม่มีตำแหน่ง จึงเลื่อนขั้นไม่ได้</Notice>
      ) : tierId == null ? (
        <Notice tone="warning" className="mt-4">
          ตำแหน่ง “{positionTitle}” ยังไม่ได้กำหนดกระบอกเงินเดือน จึงเลื่อนขั้นไม่ได้
          {onGoToPositions && (
            <>
              {" "}
              <button type="button" onClick={onGoToPositions} className={GO_LINK}>
                ไปที่ตำแหน่งงาน
              </button>
            </>
          )}
        </Notice>
      ) : null}
    </section>
  )
}
