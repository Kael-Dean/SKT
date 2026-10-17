// Position choices + "ถ้าเปลี่ยนตำแหน่งไม่ได้ ยังจะย้ายหรือไม่" answer of a relocation request.
// Used on the employee's own history and the HR approval / history screens (AMC meeting fixes #29).
import { ACCEPT_WITHOUT_POSITION_QUESTION, acceptWithoutPositionLabel, positionPrefs } from "../../lib/relocation"
import { cx } from "../../lib/styles"

/**
 * @param {object}   props
 * @param {object}   props.req           relocation row
 * @param {Function} props.positionName  (id, fallbackName) → label (from usePositionLookup)
 * @param {string}   [props.className]
 */
export default function RelocationPositionPrefs({ req, positionName, className }) {
  const prefs = positionPrefs(req)
  const answer = acceptWithoutPositionLabel(req?.accept_without_position_change)
  if (prefs.length === 0 && !answer) return null

  const label = (p) => (positionName ? positionName(p.id, p.name) : p.name || `ตำแหน่ง #${p.id}`)

  return (
    <div className={cx("space-y-2 text-sm", className)}>
      {prefs.length > 0 && (
        <div>
          <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">ตำแหน่งที่ขอ (ตามลำดับ)</p>
          <ol className="flex flex-wrap gap-1.5">
            {prefs.map((p) => (
              <li key={p.n} className="rounded-lg px-2 py-0.5 text-xs bg-gray-100 text-gray-700 dark:bg-gray-700/60 dark:text-gray-200">
                {p.n}. {label(p)}
              </li>
            ))}
          </ol>
        </div>
      )}
      {answer && (
        <p className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
          <span className="text-xs text-gray-500 dark:text-gray-400">{ACCEPT_WITHOUT_POSITION_QUESTION}</span>
          <span
            className={cx(
              "rounded-full px-2.5 py-0.5 text-xs font-semibold",
              req.accept_without_position_change
                ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-500/15 dark:text-emerald-300"
                : "bg-amber-100 text-amber-800 dark:bg-amber-500/15 dark:text-amber-300",
            )}
          >
            {answer}
          </span>
        </p>
      )}
    </div>
  )
}
