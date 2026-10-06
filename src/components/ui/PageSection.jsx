// src/components/ui/PageSection.jsx
// ─────────────────────────────────────────────────────────────────────────────
// Section header + body for a work area inside a content card.
//
//   <PageSection title="เงินเดือน" description="…" icon={Coins}
//     actions={<button className={primaryBtnCls}>…</button>}>
//     {body}
//   </PageSection>
//
// `icon` is a component (e.g. a lucide icon). `as` sets the heading level
// (default h2). Keep at most one primary button in `actions`.
// ─────────────────────────────────────────────────────────────────────────────
import { useId } from "react"
import { cx } from "../../lib/styles"

export default function PageSection({
  title,
  description,
  icon: Icon,
  actions,
  as = "h2",
  className = "",
  children,
}) {
  const Heading = as
  const headingId = useId()
  return (
    <section aria-labelledby={headingId} className={cx("min-w-0", className)}>
      <header className="mb-5 flex flex-wrap items-start justify-between gap-4 border-b border-gray-100 pb-4 dark:border-gray-700/70">
        <div className="flex min-w-0 items-start gap-3">
          {Icon && (
            <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-gray-100 text-gray-600 dark:bg-gray-700/60 dark:text-gray-300">
              <Icon aria-hidden="true" className="size-4" strokeWidth={1.75} />
            </span>
          )}
          <div className="min-w-0">
            <Heading id={headingId} tabIndex={-1} className="text-lg font-bold text-balance text-gray-900 focus:outline-none dark:text-gray-100">
              {title}
            </Heading>
            {description && (
              <p className="mt-0.5 max-w-prose text-sm leading-relaxed text-pretty text-gray-500 dark:text-gray-400">
                {description}
              </p>
            )}
          </div>
        </div>
        {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
      </header>
      {children}
    </section>
  )
}
