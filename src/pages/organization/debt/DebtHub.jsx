import { useNavigate } from "react-router-dom"
import { getRoleId } from "../../../lib/auth"
import { cx, cardCls, pageTitleCls } from "../../../lib/styles"

const ROLE = { ADMIN: 1, MNG: 2, HR: 3, HA: 4, MKT: 5 }

// ฟังก์ชันย่อยภายใต้ "ติดตามหนี้"
const SUB_FUNCTIONS = [
  {
    label: "ติดตามผลหนี้",
    desc: "สรุปยอดหนี้ รายการเคลื่อนไหว และโครงการชำระหนี้",
    path: "/debt-tracking",
    roles: [ROLE.ADMIN, ROLE.HA, ROLE.MKT],
    accent: "indigo",
    icon: (
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M2.25 8.25h19.5M2.25 9h19.5m-16.5 5.25h6m-6 2.25h3M3.75 19.5h16.5A2.25 2.25 0 0022.5 17.25V6.75A2.25 2.25 0 0020.25 4.5H3.75A2.25 2.25 0 001.5 6.75v10.5A2.25 2.25 0 003.75 19.5z"
      />
    ),
  },
  {
    label: "ตารางหนี้",
    desc: "ดูและจัดทำตารางข้อมูลหนี้รายสาขา",
    path: "/debt-form",
    roles: "all",
    accent: "emerald",
    icon: (
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M9 17.25v1.007a3 3 0 01-.879 2.122L7.5 21h9l-.621-.621A3 3 0 0115 18.257V17.25m6-12V15a2.25 2.25 0 01-2.25 2.25H5.25A2.25 2.25 0 013 15V5.25m18 0A2.25 2.25 0 0018.75 3H5.25A2.25 2.25 0 003 5.25m18 0V12a2.25 2.25 0 01-2.25 2.25H5.25A2.25 2.25 0 013 12V5.25"
      />
    ),
  },
]

const ACCENT = {
  indigo: {
    icon: "bg-indigo-50 text-indigo-600 dark:bg-indigo-900/30 dark:text-indigo-300",
    hover: "hover:ring-indigo-300 dark:hover:ring-indigo-700/60",
    arrow: "text-indigo-500 dark:text-indigo-400",
  },
  emerald: {
    icon: "bg-emerald-50 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-300",
    hover: "hover:ring-emerald-300 dark:hover:ring-emerald-700/60",
    arrow: "text-emerald-500 dark:text-emerald-400",
  },
}

function canAccess(item, roleId) {
  if (item.roles === "all") return true
  if (Array.isArray(item.roles)) return item.roles.includes(roleId)
  return false
}

export default function DebtHub() {
  const navigate = useNavigate()
  const roleId = getRoleId()
  const items = SUB_FUNCTIONS.filter((it) => canAccess(it, roleId))

  return (
    <div className="space-y-5 p-4 md:p-6">
      <div>
        <h1 className={pageTitleCls}>ติดตามหนี้</h1>
        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
          เลือกฟังก์ชันที่ต้องการ
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        {items.map((item, i) => {
          const a = ACCENT[item.accent]
          return (
            <button
              key={item.path}
              onClick={() => navigate(item.path)}
              style={{ animationDelay: `${i * 60}ms` }}
              className={cx(
                cardCls,
                a.hover,
                "animate-fade-up group flex items-center gap-4 p-5 text-left",
                "transition-all duration-150 hover:-translate-y-0.5 hover:shadow-md",
                "active:translate-y-0 active:scale-[0.99]",
                "focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500",
                "cursor-pointer"
              )}
            >
              <span
                className={cx(
                  "flex h-12 w-12 shrink-0 items-center justify-center rounded-xl transition-transform duration-150 group-hover:scale-105",
                  a.icon
                )}
              >
                <svg
                  aria-hidden="true"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.75"
                  className="h-6 w-6"
                >
                  {item.icon}
                </svg>
              </span>

              <span className="min-w-0 flex-1">
                <span className="block text-base font-semibold text-gray-900 dark:text-gray-100">
                  {item.label}
                </span>
                <span className="mt-0.5 block text-sm leading-snug text-gray-500 dark:text-gray-400">
                  {item.desc}
                </span>
              </span>

              <svg
                aria-hidden="true"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                className={cx(
                  "h-5 w-5 shrink-0 transition-transform duration-150 group-hover:translate-x-0.5",
                  a.arrow
                )}
              >
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
              </svg>
            </button>
          )
        })}
      </div>
    </div>
  )
}
