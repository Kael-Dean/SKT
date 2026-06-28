import { useNavigate } from "react-router-dom"
import { cx, cardCls, pageTitleCls } from "../../lib/styles"

// ─────────────────────────────────────────────────────────────────────────────
// หน้า "ตัวอย่างเว็บ" — รวม card ตัวอย่าง landing page
// คลิก card → เปิดหน้า landing จริง (เต็มจอ)
// ─────────────────────────────────────────────────────────────────────────────

const EXAMPLES = [
  {
    id: "thaktho",
    name: "ถักทอ",
    tagline: "Handmade Knitwear",
    desc: "แลนดิ้งเพจสินค้าผ้าถักแฮนด์เมด — โทนสีธรรมชาติ scroll-driven hero",
    path: "/landing/thaktho",
    // โทนสีตัวอย่างไว้พรีวิวบน card
    swatches: ["#F2EEE3", "#B07A56", "#3B4232", "#828B6B"],
  },
]

function ExampleCard({ item, onOpen }) {
  return (
    <button
      onClick={() => onOpen(item.path)}
      className={cx(
        cardCls,
        "group flex flex-col overflow-hidden text-left",
        "transition-all duration-200 hover:-translate-y-1 hover:shadow-lg",
        "hover:ring-indigo-300 dark:hover:ring-indigo-700/60",
        "focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500",
        "cursor-pointer"
      )}
    >
      {/* พรีวิวธีม */}
      <div
        className="relative flex h-36 items-center justify-center overflow-hidden"
        style={{ background: item.swatches[0] }}
      >
        <span
          className="font-semibold tracking-tight transition-transform duration-300 group-hover:scale-105"
          style={{ fontFamily: "'Trirong', 'Times New Roman', serif", fontSize: "44px", color: "#2B2A22" }}
        >
          {item.name}
        </span>
        <div className="absolute bottom-3 right-3 flex gap-1.5">
          {item.swatches.map((c) => (
            <span
              key={c}
              className="h-4 w-4 rounded-full ring-1 ring-black/10"
              style={{ background: c }}
            />
          ))}
        </div>
      </div>

      {/* รายละเอียด */}
      <div className="flex flex-1 flex-col gap-1.5 p-4">
        <div className="flex items-center gap-2">
          <h3 className="text-base font-semibold text-gray-900 dark:text-gray-100">{item.name}</h3>
          <span className="text-[11px] font-medium uppercase tracking-wide text-indigo-500 dark:text-indigo-400">
            {item.tagline}
          </span>
        </div>
        <p className="text-sm leading-snug text-gray-500 dark:text-gray-400">{item.desc}</p>
        <span className="mt-2 inline-flex items-center gap-1 text-sm font-medium text-indigo-600 dark:text-indigo-300">
          เปิดดูตัวอย่าง
          <svg
            aria-hidden="true"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            className="h-4 w-4 transition-transform duration-150 group-hover:translate-x-0.5"
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
          </svg>
        </span>
      </div>
    </button>
  )
}

export default function Showcase() {
  const navigate = useNavigate()

  return (
    <div className="space-y-5 p-4 md:p-6">
      <div>
        <h1 className={pageTitleCls}>ตัวอย่างเว็บ</h1>
        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
          คลิกการ์ดเพื่อเปิดดูตัวอย่างแลนดิ้งเพจแบบเต็มจอ
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {EXAMPLES.map((item) => (
          <ExampleCard key={item.id} item={item} onOpen={navigate} />
        ))}
      </div>
    </div>
  )
}
