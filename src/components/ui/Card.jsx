// src/components/ui/Card.jsx
// ─────────────────────────────────────────────────────────────────────────────
// Thin wrapper over the card class constants in styles.js so pages stop
// hand-writing rounded-2xl/ring/shadow. Provides the primitive only — do not
// nest cards inside cards by design.
// ─────────────────────────────────────────────────────────────────────────────
import { cx, cardCls, cardPaddedCls, pageTitleCls, sectionTitleCls } from "../../lib/styles"

/** Content card. `padded` toggles built-in padding; `as` swaps the element. */
export default function Card({ as = "div", padded = true, className = "", children, ...rest }) {
  const Tag = as
  return (
    <Tag className={cx(padded ? cardPaddedCls : cardCls, className)} {...rest}>
      {children}
    </Tag>
  )
}

/** Consistent card header: title (pageTitleCls), optional subtitle + action slot. */
export function CardHeader({ title, subtitle, action, className = "" }) {
  return (
    <div className={cx("mb-4 flex items-start justify-between gap-3", className)}>
      <div className="min-w-0">
        {title ? <h3 className={cx(pageTitleCls, "text-balance")}>{title}</h3> : null}
        {subtitle ? (
          <p className={cx(sectionTitleCls, "mt-1 border-b-0 pb-0")}>{subtitle}</p>
        ) : null}
      </div>
      {action ? <div className="shrink-0">{action}</div> : null}
    </div>
  )
}
