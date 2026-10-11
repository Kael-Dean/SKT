// src/pages/admin/RolePermissions.jsx
// "สิทธิ์ตามบทบาท" — ตาราง read-only ของ permission registry (src/lib/permissions.js)
// แถว = ฟังก์ชันตาม AMC_Role_Permission_Matrix (จัดกลุ่มตามโมดูล), คอลัมน์ = role 1–7
// เข้าได้เฉพาะ admin.roles.view (App.jsx). ค่าที่แสดงสะท้อน guard ปัจจุบันของ backend
import { Fragment, useId, useMemo, useState } from "react"
import { Check, Info, Search, X } from "lucide-react"
import SelectDropdown from "../../components/SelectDropdown"
import { EmptyState } from "../../components/ui"
import { cx, cardCls, pageTitleCls } from "../../lib/styles"
import { ROLE_IDS, ROLE_LABEL, roleShortLabel } from "../../lib/roles"
import { MODULE_LABEL, permissionRows } from "../../lib/permissions"

const ROWS = permissionRows().map((r) => {
  const grants = Array.isArray(r.roles) ? new Set(r.roles) : new Set(ROLE_IDS)
  const moduleTh = MODULE_LABEL[r.module] ?? r.module
  return {
    ...r,
    grants,
    moduleTh,
    haystack: [r.key, r.label, r.en, r.module, moduleTh, r.no == null ? "" : `#${r.no}`]
      .join(" ")
      .toLowerCase(),
  }
})

const MODULES = [...new Set(ROWS.map((r) => r.module))]
const MODULE_OPTIONS = [
  { value: "", label: "ทุกโมดูล" },
  ...MODULES.map((m) => ({ value: m, label: MODULE_LABEL[m] ?? m, sublabel: m, keywords: m })),
]

const SCOPE_BADGE = {
  any: { text: "ทุกคนที่ล็อกอิน", cls: "bg-sky-50 text-sky-800 ring-sky-200 dark:bg-sky-500/10 dark:text-sky-200 dark:ring-sky-500/30" },
  public: { text: "ไม่ต้องล็อกอิน", cls: "bg-gray-100 text-gray-700 ring-gray-200 dark:bg-gray-700/60 dark:text-gray-200 dark:ring-gray-600" },
}

const thBase =
  "sticky top-0 z-20 border-b border-gray-200 bg-gray-50 px-2 py-2.5 text-xs font-semibold text-gray-700 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-200"

export default function RolePermissions() {
  const [query, setQuery] = useState("")
  const [moduleFilter, setModuleFilter] = useState("")
  const searchId = useId()
  const noteId = useId()

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    return ROWS.filter((r) => (!moduleFilter || r.module === moduleFilter) && (!q || r.haystack.includes(q)))
  }, [query, moduleFilter])

  const groups = useMemo(() => {
    const map = new Map()
    for (const r of filtered) {
      if (!map.has(r.module)) map.set(r.module, [])
      map.get(r.module).push(r)
    }
    return [...map.entries()]
  }, [filtered])

  const roleCounts = useMemo(
    () => Object.fromEntries(ROLE_IDS.map((id) => [id, filtered.filter((r) => r.grants.has(id)).length])),
    [filtered],
  )

  const hasFilter = query.trim() !== "" || moduleFilter !== ""
  const clearFilters = () => {
    setQuery("")
    setModuleFilter("")
  }

  return (
    <div className="space-y-4 p-4 md:p-6">
      <header className="space-y-1">
        <h1 className={pageTitleCls}>สิทธิ์ตามบทบาท</h1>
        <p className="max-w-3xl text-sm text-gray-600 dark:text-gray-300">
          ฟังก์ชันที่แต่ละบทบาทใช้ได้ จัดกลุ่มตามโมดูล — หน้านี้ดูอย่างเดียว
        </p>
      </header>

      <p
        id={noteId}
        className="flex max-w-3xl items-start gap-2 rounded-xl bg-indigo-50 px-3 py-2.5 text-sm text-indigo-900 ring-1 ring-indigo-100 dark:bg-indigo-500/10 dark:text-indigo-100 dark:ring-indigo-500/20"
      >
        <Info aria-hidden="true" strokeWidth={1.75} className="mt-0.5 size-4 shrink-0" />
        <span>
          ค่าทั้งหมดตรงกับสิทธิ์ที่ระบบหลังบ้าน (backend) ตรวจอยู่ตอนนี้ และจะปรับตามตารางสิทธิ์ที่ลูกค้ายืนยัน
          หน้าเว็บไม่เปิดสิทธิ์เกินกว่าที่ backend อนุญาต
        </span>
      </p>

      <div className={cx(cardCls, "overflow-hidden")}>
        {/* Toolbar */}
        <div className="flex flex-col gap-3 border-b border-gray-200 p-3 sm:flex-row sm:items-end dark:border-gray-700">
          <div className="min-w-0 flex-1">
            <label htmlFor={searchId} className="mb-1 block text-xs font-medium text-gray-700 dark:text-gray-300">
              ค้นหาฟังก์ชัน
            </label>
            <div className="relative">
              <Search aria-hidden="true" strokeWidth={1.75} className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-gray-500 dark:text-gray-400" />
              <input
                id={searchId}
                type="text"
                enterKeyHint="search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="ไทย, English หรือคีย์ เช่น hr.leave"
                autoComplete="off"
                className="w-full rounded-2xl border border-gray-300 bg-white py-2 pl-9 pr-9 text-sm text-gray-900 outline-none transition-colors duration-200 placeholder:text-gray-500 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100 dark:placeholder:text-gray-400 dark:focus:border-indigo-400"
              />
              {query && (
                <button
                  type="button"
                  onClick={() => setQuery("")}
                  aria-label="ล้างคำค้นหา"
                  className="absolute right-2 top-1/2 flex size-7 -translate-y-1/2 cursor-pointer items-center justify-center rounded-lg text-gray-500 transition-colors duration-150 hover:bg-gray-100 hover:text-gray-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 dark:text-gray-400 dark:hover:bg-gray-600 dark:hover:text-gray-100"
                >
                  <X aria-hidden="true" strokeWidth={1.75} className="size-4" />
                </button>
              )}
            </div>
          </div>
          <div className="sm:w-72">
            <span id={`${searchId}-module`} className="mb-1 block text-xs font-medium text-gray-700 dark:text-gray-300">
              โมดูล
            </span>
            <SelectDropdown
              options={MODULE_OPTIONS}
              value={moduleFilter}
              onChange={(v) => setModuleFilter(v ?? "")}
              placeholder="ทุกโมดูล"
              searchable
              ariaLabelledby={`${searchId}-module`}
            />
          </div>
        </div>

        <p className="px-3 py-2 text-xs text-gray-600 dark:text-gray-300" aria-live="polite">
          แสดง <span className="font-semibold tabular-nums text-gray-900 dark:text-gray-100">{filtered.length}</span> จาก{" "}
          <span className="tabular-nums">{ROWS.length}</span> รายการ
          {hasFilter && (
            <button
              type="button"
              onClick={clearFilters}
              className="ml-2 cursor-pointer rounded font-semibold text-indigo-700 underline-offset-2 hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 dark:text-indigo-300"
            >
              ล้างตัวกรอง
            </button>
          )}
        </p>

        {filtered.length === 0 ? (
          <div className="border-t border-gray-200 dark:border-gray-700">
            <EmptyState
              icon={<Search className="size-10" strokeWidth={1.5} />}
              title="ไม่พบฟังก์ชันที่ตรงกับตัวกรอง"
              description="ลองใช้คำค้นที่สั้นลง หรือเลือก &quot;ทุกโมดูล&quot;"
              action={
                <button
                  type="button"
                  onClick={clearFilters}
                  className="cursor-pointer rounded-2xl bg-indigo-500 px-4 py-2 text-sm font-semibold text-white transition-all duration-200 hover:bg-indigo-600 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-gray-800"
                >
                  ล้างตัวกรอง
                </button>
              }
            />
          </div>
        ) : (
          <div
            role="region"
            aria-label="ตารางสิทธิ์ตามบทบาท (เลื่อนได้)"
            aria-describedby={noteId}
            tabIndex={0}
            className="max-h-[calc(100dvh-19rem)] min-h-64 overflow-auto border-t border-gray-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-indigo-500 dark:border-gray-700"
          >
            <table className="w-full min-w-[56rem] border-separate border-spacing-0 text-sm">
              <caption className="sr-only">
                สิทธิ์การใช้ฟังก์ชันของแต่ละบทบาท เครื่องหมายถูกหมายถึงบทบาทนั้นใช้ฟังก์ชันได้
              </caption>
              <thead>
                <tr>
                  <th scope="col" className={cx(thBase, "w-12 text-right tabular-nums md:left-0 md:z-30")}>
                    ลำดับ
                  </th>
                  <th scope="col" className={cx(thBase, "min-w-[14rem] text-left md:left-12 md:z-30 md:min-w-[18rem]")}>
                    ฟังก์ชัน
                  </th>
                  {ROLE_IDS.map((id) => (
                    <th key={id} scope="col" className={cx(thBase, "w-[5.5rem] text-center")}>
                      <abbr title={ROLE_LABEL[id]} className="block no-underline">
                        {roleShortLabel(id)}
                      </abbr>
                      <span className="mt-0.5 block text-[11px] font-normal tabular-nums text-gray-600 dark:text-gray-400">
                        {roleCounts[id]} รายการ
                      </span>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {groups.map(([module, rows]) => (
                  <Fragment key={module}>
                    <tr>
                      <th
                        scope="colgroup"
                        colSpan={2 + ROLE_IDS.length}
                        className="border-b border-gray-200 bg-white px-3 pb-1.5 pt-4 text-left dark:border-gray-700 dark:bg-gray-800"
                      >
                        <span className="sticky left-3 inline-flex items-baseline gap-2">
                          <span className="text-sm font-bold text-gray-900 dark:text-gray-100">
                            {MODULE_LABEL[module] ?? module}
                          </span>
                          <span className="text-xs font-normal text-gray-600 dark:text-gray-400">
                            {module} · <span className="tabular-nums">{rows.length}</span>
                          </span>
                        </span>
                      </th>
                    </tr>
                    {rows.map((r) => (
                      <PermissionRow key={r.key} row={r} />
                    ))}
                  </Fragment>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}

function PermissionRow({ row }) {
  const scope = typeof row.roles === "string" ? SCOPE_BADGE[row.roles] : null
  const cellBg = "bg-white group-hover:bg-gray-50 dark:bg-gray-800 dark:group-hover:bg-gray-700/40"
  return (
    <tr className="group">
      <td className={cx("border-b border-gray-100 px-2 py-2 text-right align-top text-xs tabular-nums text-gray-600 dark:border-gray-700/60 dark:text-gray-400 md:sticky md:left-0 md:z-10", cellBg)}>
        {row.no ?? "—"}
      </td>
      <th scope="row" className={cx("border-b border-gray-100 px-2 py-2 text-left align-top font-normal dark:border-gray-700/60 md:sticky md:left-12 md:z-10", cellBg)}>
        <span className="block font-medium text-gray-900 dark:text-gray-100">{row.label}</span>
        <span className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-gray-600 dark:text-gray-400">
          <span>{row.en}</span>
          <code className="rounded bg-gray-100 px-1 py-px font-mono text-[11px] text-gray-700 dark:bg-gray-700 dark:text-gray-200">
            {row.key}
          </code>
          {scope && (
            <span className={cx("rounded-full px-1.5 py-px text-[11px] font-medium ring-1", scope.cls)}>{scope.text}</span>
          )}
          {row.feOnly && (
            <span className="rounded-full bg-violet-50 px-1.5 py-px text-[11px] font-medium text-violet-800 ring-1 ring-violet-200 dark:bg-violet-500/10 dark:text-violet-200 dark:ring-violet-500/30">
              เฉพาะหน้าเว็บ
            </span>
          )}
        </span>
        {row.note && <span className="mt-1 block max-w-prose text-xs text-amber-800 dark:text-amber-300">{row.note}</span>}
      </th>
      {ROLE_IDS.map((id) => {
        const ok = row.grants.has(id)
        return (
          <td key={id} className="border-b border-gray-100 px-2 py-2 text-center align-top group-hover:bg-gray-50 dark:border-gray-700/60 dark:group-hover:bg-gray-700/40">
            {ok ? (
              <Check aria-label={`${ROLE_LABEL[id]}: ใช้ได้`} role="img" strokeWidth={2.25} className="mx-auto size-4 text-emerald-600 dark:text-emerald-400" />
            ) : (
              <span aria-label={`${ROLE_LABEL[id]}: ไม่ได้`} role="img" className="mx-auto block h-px w-3 bg-gray-300 dark:bg-gray-600" />
            )}
          </td>
        )
      })}
    </tr>
  )
}
