// src/pages/admin/RolePermissions.jsx
// "สิทธิ์ตามบทบาท" — ตาราง read-only ของ permission registry (src/lib/permissions.js)
// โมเดลใหม่ (backend PR #13): Super Admin (role 1) ได้ทุกฟังก์ชัน + ตำแหน่งงาน 42 ตำแหน่ง (101–142)
// แถว = ฟังก์ชันตาม AMC_Role_Permission_Matrix (จัดกลุ่มตามโมดูล)
// โหมด "ทุกตำแหน่ง" = คอลัมน์สรุปว่าตำแหน่งไหนใช้ได้ · เลือกตำแหน่ง = คอลัมน์ ✓ / – ของตำแหน่งนั้น
// เข้าได้เฉพาะ admin.roles.view (App.jsx). ค่าที่แสดงมาจาก rbacMatrix.js (สร้างจาก backend)
import { Fragment, useId, useMemo, useState } from "react"
import { AlertTriangle, Check, Info, Search, X } from "lucide-react"
import SelectDropdown from "../../components/SelectDropdown"
import { EmptyState } from "../../components/ui"
import { useIsPhone } from "../../hooks/useMediaQuery"
import { cx, cardCls } from "../../lib/styles"
import { POSITION_ROLES } from "../../lib/rbacMatrix"
import { MODULE_LABEL, codeFor, isRbacMode, permissionRows, positionsFor, useCan } from "../../lib/permissions"
import PageTitle from "../../components/PageTitle"

const POSITION_IDS = Object.keys(POSITION_ROLES)
  .map(Number)
  .sort((a, b) => a - b)
const POSITION_TOTAL = POSITION_IDS.length
const positionName = (id) => POSITION_ROLES[id]?.name ?? `ตำแหน่ง #${id}`
const scopeText = (scope) => (scope === "all" ? "เลือกสาขาได้ทุกสาขา" : "เฉพาะสาขาตนเอง")

/** ประเภทของ code ที่ backend ใช้ตรวจ → ใช้เลือก badge / ข้อความ */
function describeCode(code) {
  if (code === "login") return { kind: "login", codes: [] }
  if (code === "public") return { kind: "public", codes: [] }
  if (code === "superadmin" || code == null) return { kind: "superadmin", codes: [] }
  if (typeof code === "function") return { kind: "rule", codes: [] }
  if (Array.isArray(code)) return { kind: "anyOf", codes: code }
  return { kind: "code", codes: [code] }
}

// คำนวณครั้งเดียวต่อการโหลดหน้า (positionsFor วนตาราง matrix ทุกตำแหน่ง — ไม่ควรทำทุก render)
let rowsCache = null
function getRows() {
  if (rowsCache) return rowsCache
  rowsCache = permissionRows().map((r) => {
    const code = codeFor(r.key)
    const codeInfo = describeCode(code)
    const positions = positionsFor(r.key)
    const moduleTh = MODULE_LABEL[r.module] ?? r.module
    return {
      ...r,
      codeInfo,
      positions,
      positionSet: new Set(positions),
      moduleTh,
      haystack: [r.key, r.label, r.en, r.module, moduleTh, r.no == null ? "" : `#${r.no}`, ...codeInfo.codes]
        .join(" ")
        .toLowerCase(),
    }
  })
  return rowsCache
}

const MODULE_OPTIONS_CACHE = { value: null }
function getModuleOptions() {
  if (MODULE_OPTIONS_CACHE.value) return MODULE_OPTIONS_CACHE.value
  const modules = [...new Set(getRows().map((r) => r.module))]
  MODULE_OPTIONS_CACHE.value = [
    { value: "", label: "ทุกโมดูล" },
    ...modules.map((m) => ({ value: m, label: MODULE_LABEL[m] ?? m, sublabel: m, keywords: m })),
  ]
  return MODULE_OPTIONS_CACHE.value
}

const POSITION_OPTIONS = [
  { value: "", label: "ทุกตำแหน่ง (ภาพรวม)", sublabel: `สรุปว่าแต่ละฟังก์ชันใช้ได้กี่ตำแหน่ง จาก ${POSITION_TOTAL}` },
  ...POSITION_IDS.map((id) => ({
    value: String(id),
    label: positionName(id),
    sublabel: `#${id} · ${scopeText(POSITION_ROLES[id].scope)}`,
    keywords: [String(id), POSITION_ROLES[id].scope],
  })),
]

const BADGE = {
  login: { text: "ทุกคนที่ล็อกอิน", cls: "bg-sky-50 text-sky-800 ring-sky-200 dark:bg-sky-500/10 dark:text-sky-200 dark:ring-sky-500/30" },
  public: { text: "ทุกคนที่ล็อกอิน", cls: "bg-sky-50 text-sky-800 ring-sky-200 dark:bg-sky-500/10 dark:text-sky-200 dark:ring-sky-500/30" },
  superadmin: { text: "Super Admin เท่านั้น", cls: "bg-rose-50 text-rose-800 ring-rose-200 dark:bg-rose-500/10 dark:text-rose-200 dark:ring-rose-500/30" },
  feOnly: { text: "เฉพาะหน้าเว็บ", cls: "bg-violet-50 text-violet-800 ring-violet-200 dark:bg-violet-500/10 dark:text-violet-200 dark:ring-violet-500/30" },
}

const thBase =
  "sticky top-0 z-20 border-b border-gray-200 bg-gray-50 px-2 py-2.5 text-xs font-semibold text-gray-700 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-200"

const codeCls = "rounded bg-gray-100 px-1 py-px font-mono text-[11px] text-gray-700 dark:bg-gray-700 dark:text-gray-200"

const PREVIEW_NAMES = 3

export default function RolePermissions() {
  const rows = getRows()
  const moduleOptions = getModuleOptions()
  const isPhone = useIsPhone()
  // subscribe เพื่อ re-render เมื่อโหลด /auth/me/permissions เสร็จ (isRbacMode เปลี่ยนได้)
  useCan()
  const rbac = isRbacMode()

  const [query, setQuery] = useState("")
  const [moduleFilter, setModuleFilter] = useState("")
  const [positionValue, setPositionValue] = useState("")
  const [onlyGranted, setOnlyGranted] = useState(false)
  const searchId = useId()
  const noteId = useId()
  const onlyId = useId()

  const positionId = positionValue === "" ? null : Number(positionValue)
  const position = positionId != null ? POSITION_ROLES[positionId] : null

  const baseFiltered = useMemo(() => {
    const q = query.trim().toLowerCase()
    return rows.filter((r) => (!moduleFilter || r.module === moduleFilter) && (!q || r.haystack.includes(q)))
  }, [rows, query, moduleFilter])

  const filtered = useMemo(
    () => (positionId != null && onlyGranted ? baseFiltered.filter((r) => r.positionSet.has(positionId)) : baseFiltered),
    [baseFiltered, positionId, onlyGranted],
  )

  const grantedCount = useMemo(
    () => (positionId == null ? 0 : baseFiltered.filter((r) => r.positionSet.has(positionId)).length),
    [baseFiltered, positionId],
  )

  const groups = useMemo(() => {
    const map = new Map()
    for (const r of filtered) {
      if (!map.has(r.module)) map.set(r.module, [])
      map.get(r.module).push(r)
    }
    return [...map.entries()]
  }, [filtered])

  const hasFilter = query.trim() !== "" || moduleFilter !== "" || (positionId != null && onlyGranted)
  const clearFilters = () => {
    setQuery("")
    setModuleFilter("")
    setOnlyGranted(false)
  }

  return (
    <div className="space-y-4 p-4 md:p-6">
      <PageTitle title="สิทธิ์ตามบทบาท" />

      <div id={noteId} className="max-w-3xl space-y-2">
        <p className="flex items-start gap-2 rounded-xl bg-indigo-50 px-3 py-2.5 text-sm text-indigo-900 ring-1 ring-indigo-100 dark:bg-indigo-500/10 dark:text-indigo-100 dark:ring-indigo-500/20">
          <Info aria-hidden="true" strokeWidth={1.75} className="mt-0.5 size-4 shrink-0" />
          <span>
            ค่าทั้งหมดมาจากตารางสิทธิ์ของ AMC ที่ระบบหลังบ้าน (backend) ใช้ตรวจจริง · Super Admin ใช้ได้ทุกฟังก์ชัน
            จึงไม่แสดงในตาราง · เมนูที่ผู้ใช้แต่ละคนเห็นคำนวณจากสิทธิ์ที่ได้จาก{" "}
            <code className="rounded bg-indigo-100 px-1 font-mono text-xs dark:bg-indigo-500/20">GET /auth/me/permissions</code>
          </span>
        </p>
        {!rbac && (
          <p
            role="status"
            className="flex items-start gap-2 rounded-xl bg-amber-50 px-3 py-2.5 text-sm text-amber-900 ring-1 ring-amber-200 dark:bg-amber-500/10 dark:text-amber-100 dark:ring-amber-500/30"
          >
            <AlertTriangle aria-hidden="true" strokeWidth={1.75} className="mt-0.5 size-4 shrink-0" />
            <span>
              เซิร์ฟเวอร์ยังใช้ระบบบทบาทแบบเดิม (role 1–7) — กฎตามตำแหน่งในหน้านี้จะมีผลหลังอัปเดตระบบหลังบ้าน
            </span>
          </p>
        )}
      </div>

      <div className={cx(cardCls, "overflow-hidden")}>
        {/* Toolbar */}
        <div className="grid gap-3 border-b border-gray-200 p-3 md:grid-cols-[minmax(0,1fr)_16rem_18rem] md:items-end dark:border-gray-700">
          <div className="min-w-0">
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
                placeholder="ไทย, English, คีย์ หรือ code เช่น hr.leave"
                autoComplete="off"
                className="min-h-11 w-full rounded-2xl border border-gray-300 bg-white py-2 pl-9 pr-11 text-sm text-gray-900 outline-none transition-colors duration-200 placeholder:text-gray-500 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 md:min-h-0 md:pr-9 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100 dark:placeholder:text-gray-400 dark:focus:border-indigo-400"
              />
              {query && (
                <button
                  type="button"
                  onClick={() => setQuery("")}
                  aria-label="ล้างคำค้นหา"
                  className="absolute right-1 top-1/2 flex size-10 -translate-y-1/2 cursor-pointer items-center justify-center rounded-xl text-gray-500 transition-colors duration-150 hover:bg-gray-100 hover:text-gray-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 md:right-2 md:size-7 md:rounded-lg dark:text-gray-400 dark:hover:bg-gray-600 dark:hover:text-gray-100"
                >
                  <X aria-hidden="true" strokeWidth={1.75} className="size-4" />
                </button>
              )}
            </div>
          </div>
          <div className="min-w-0">
            <span id={`${searchId}-module`} className="mb-1 block text-xs font-medium text-gray-700 dark:text-gray-300">
              โมดูล
            </span>
            <SelectDropdown
              options={moduleOptions}
              value={moduleFilter}
              onChange={(v) => setModuleFilter(v ?? "")}
              placeholder="ทุกโมดูล"
              searchable
              ariaLabelledby={`${searchId}-module`}
            />
          </div>
          <div className="min-w-0">
            <span id={`${searchId}-position`} className="mb-1 block text-xs font-medium text-gray-700 dark:text-gray-300">
              ตำแหน่ง
            </span>
            <SelectDropdown
              options={POSITION_OPTIONS}
              value={positionValue}
              onChange={(v) => {
                setPositionValue(v ?? "")
                if (!v) setOnlyGranted(false)
              }}
              placeholder="ทุกตำแหน่ง (ภาพรวม)"
              searchable
              searchPlaceholder="ค้นหาชื่อตำแหน่งหรือเลข…"
              ariaLabelledby={`${searchId}-position`}
            />
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-x-4 gap-y-2 px-3 py-2 text-xs text-gray-600 dark:text-gray-300">
          <p aria-live="polite">
            แสดง <span className="font-semibold tabular-nums text-gray-900 dark:text-gray-100">{filtered.length}</span> จาก{" "}
            <span className="tabular-nums">{rows.length}</span> รายการ
            {position && (
              <>
                {" · "}
                <span className="font-medium text-gray-900 dark:text-gray-100">{position.name}</span> ใช้ได้{" "}
                <span className="font-semibold tabular-nums text-emerald-700 dark:text-emerald-300">{grantedCount}</span> ฟังก์ชัน
              </>
            )}
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
          {position && (
            <label htmlFor={onlyId} className="inline-flex min-h-11 cursor-pointer items-center gap-2 md:min-h-0">
              <input
                id={onlyId}
                type="checkbox"
                checked={onlyGranted}
                onChange={(e) => setOnlyGranted(e.target.checked)}
                className="size-4 cursor-pointer rounded border-gray-300 accent-indigo-600 dark:border-gray-600"
              />
              <span className="text-gray-700 dark:text-gray-200">เฉพาะฟังก์ชันที่ตำแหน่งนี้ใช้ได้</span>
            </label>
          )}
        </div>

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
                  className="min-h-11 cursor-pointer rounded-2xl bg-indigo-500 px-4 py-2 text-sm font-semibold text-white transition-all duration-200 hover:bg-indigo-600 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2 md:min-h-0 dark:focus-visible:ring-offset-gray-800"
                >
                  ล้างตัวกรอง
                </button>
              }
            />
          </div>
        ) : isPhone ? (
          <div className="space-y-5 border-t border-gray-200 bg-gray-50 p-3 dark:border-gray-700 dark:bg-gray-900/40">
            {groups.map(([module, items]) => (
              <section key={module} aria-labelledby={`${searchId}-g-${module}`}>
                <h2 id={`${searchId}-g-${module}`} className="mb-2 flex items-baseline gap-2 px-1">
                  <span className="text-sm font-bold text-gray-900 dark:text-gray-100">{MODULE_LABEL[module] ?? module}</span>
                  <span className="text-xs font-normal tabular-nums text-gray-600 dark:text-gray-400">{items.length}</span>
                </h2>
                <ul className="space-y-2">
                  {items.map((r) => (
                    <PermissionCard key={r.key} row={r} positionId={positionId} />
                  ))}
                </ul>
              </section>
            ))}
          </div>
        ) : (
          <div
            role="region"
            aria-label="ตารางสิทธิ์ตามตำแหน่ง (เลื่อนได้)"
            aria-describedby={noteId}
            tabIndex={0}
            className="max-h-[calc(100dvh-20rem)] min-h-64 overflow-auto border-t border-gray-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-indigo-500 dark:border-gray-700"
          >
            <table className="w-full min-w-[48rem] border-separate border-spacing-0 text-sm">
              <caption className="sr-only">
                {position
                  ? `สิทธิ์การใช้ฟังก์ชันของตำแหน่ง${position.name} เครื่องหมายถูกหมายถึงใช้ได้`
                  : "จำนวนและรายชื่อตำแหน่งที่ใช้แต่ละฟังก์ชันได้"}
              </caption>
              <thead>
                <tr>
                  <th scope="col" className={cx(thBase, "w-12 text-right tabular-nums")}>
                    ลำดับ
                  </th>
                  <th scope="col" className={cx(thBase, "min-w-[18rem] text-left")}>
                    ฟังก์ชัน
                  </th>
                  {position ? (
                    <th scope="col" className={cx(thBase, "w-44 text-center")}>
                      <span className="block">{position.name}</span>
                      <span className="mt-0.5 block text-[11px] font-normal tabular-nums text-gray-600 dark:text-gray-400">
                        ใช้ได้ {grantedCount} ฟังก์ชัน
                      </span>
                    </th>
                  ) : (
                    <th scope="col" className={cx(thBase, "w-[22rem] text-left")}>
                      ตำแหน่งที่ใช้ได้
                    </th>
                  )}
                </tr>
              </thead>
              <tbody>
                {groups.map(([module, items]) => (
                  <Fragment key={module}>
                    <tr>
                      <th
                        scope="colgroup"
                        colSpan={3}
                        className="border-b border-gray-200 bg-white px-3 pb-1.5 pt-4 text-left dark:border-gray-700 dark:bg-gray-800"
                      >
                        <span className="inline-flex items-baseline gap-2">
                          <span className="text-sm font-bold text-gray-900 dark:text-gray-100">{MODULE_LABEL[module] ?? module}</span>
                          <span className="text-xs font-normal text-gray-600 dark:text-gray-400">
                            {module} · <span className="tabular-nums">{items.length}</span>
                          </span>
                        </span>
                      </th>
                    </tr>
                    {items.map((r) => (
                      <PermissionRow key={r.key} row={r} positionId={positionId} />
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

/** ชื่อฟังก์ชัน + คีย์ + code backend + badge (ใช้ทั้งตารางและการ์ดมือถือ) */
function FunctionMeta({ row }) {
  const { kind, codes } = row.codeInfo
  const badge = BADGE[kind]
  return (
    <>
      <span className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-gray-600 dark:text-gray-400">
        {row.en && <span>{row.en}</span>}
        <code className={codeCls} title="คีย์ในหน้าเว็บ (permissions.js)">
          {row.key}
        </code>
        {badge && <span className={cx("rounded-full px-1.5 py-px text-[11px] font-medium ring-1", badge.cls)}>{badge.text}</span>}
        {row.feOnly && (
          <span className={cx("rounded-full px-1.5 py-px text-[11px] font-medium ring-1", BADGE.feOnly.cls)}>{BADGE.feOnly.text}</span>
        )}
      </span>
      {codes.length > 0 && (
        <span className="mt-1 flex flex-wrap items-center gap-x-1.5 gap-y-1 text-xs text-gray-600 dark:text-gray-400">
          <span className="sr-only">code ที่ backend ตรวจ:</span>
          <span aria-hidden="true" className="text-[11px] uppercase tracking-wide text-gray-500 dark:text-gray-500">
            code
          </span>
          {codes.map((c, i) => (
            <Fragment key={c}>
              {i > 0 && <span aria-hidden="true" className="text-gray-400 dark:text-gray-500">/</span>}
              <code className="rounded bg-indigo-50 px-1 py-px font-mono text-[11px] text-indigo-800 dark:bg-indigo-500/15 dark:text-indigo-200">
                {c}
              </code>
            </Fragment>
          ))}
          {kind === "anyOf" && <span className="text-[11px] italic text-gray-500 dark:text-gray-400">อย่างใดอย่างหนึ่ง</span>}
        </span>
      )}
      {row.note && <span className="mt-1 block max-w-prose text-xs text-amber-800 dark:text-amber-300">{row.note}</span>}
    </>
  )
}

/** ✓ / – สำหรับตำแหน่งเดียว */
function GrantMark({ ok, name }) {
  return ok ? (
    <Check aria-label={`${name}: ใช้ได้`} role="img" strokeWidth={2.25} className="mx-auto size-4 text-emerald-600 dark:text-emerald-400" />
  ) : (
    <span aria-label={`${name}: ไม่ได้`} role="img" className="mx-auto block h-px w-3 bg-gray-300 dark:bg-gray-600" />
  )
}

/** สรุปตำแหน่งที่ใช้ได้: N/42 + รายชื่อย่อ + ดูทั้งหมด (disclosure) */
function PositionSummary({ row }) {
  const n = row.positions.length
  const all = n === POSITION_TOTAL
  const names = row.positions.map(positionName)
  const preview = names.slice(0, PREVIEW_NAMES)
  const more = n - preview.length
  return (
    <div className="min-w-0">
      <div className="flex items-center gap-2">
        <span className="font-semibold tabular-nums text-gray-900 dark:text-gray-100">
          {n}
          <span className="font-normal text-gray-500 dark:text-gray-400">/{POSITION_TOTAL}</span>
        </span>
        <span aria-hidden="true" className="h-1.5 w-16 overflow-hidden rounded-full bg-gray-200 dark:bg-gray-700">
          <span
            className="block h-full rounded-full bg-emerald-500 dark:bg-emerald-400"
            style={{ width: `${(n / POSITION_TOTAL) * 100}%` }}
          />
        </span>
      </div>
      {n === 0 ? (
        <p className="mt-0.5 text-xs text-gray-600 dark:text-gray-400">ไม่มีตำแหน่งใด — Super Admin เท่านั้น</p>
      ) : all ? (
        <p className="mt-0.5 text-xs text-gray-600 dark:text-gray-400">ทุกตำแหน่ง</p>
      ) : more <= 0 ? (
        <p className="mt-0.5 text-xs text-gray-700 dark:text-gray-300">{preview.join(", ")}</p>
      ) : (
        <details className="group/d mt-0.5 text-xs">
          <summary
            className="cursor-pointer list-none rounded text-gray-700 marker:hidden focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 dark:text-gray-300 [&::-webkit-details-marker]:hidden"
            title={names.join(", ")}
          >
            <span className="group-open/d:hidden">
              {preview.join(", ")}{" "}
              <span className="font-semibold text-indigo-700 dark:text-indigo-300">+{more}</span>
            </span>
            <span className="hidden font-semibold text-indigo-700 group-open/d:inline dark:text-indigo-300">ย่อรายชื่อ</span>
          </summary>
          <ul className="mt-1 columns-1 gap-x-4 text-gray-700 sm:columns-2 dark:text-gray-300">
            {names.map((nm, i) => (
              <li key={row.positions[i]} className="break-inside-avoid">
                {nm}
              </li>
            ))}
          </ul>
        </details>
      )}
    </div>
  )
}

function PermissionRow({ row, positionId }) {
  const cellBg = "bg-white group-hover:bg-gray-50 dark:bg-gray-800 dark:group-hover:bg-gray-700/40"
  const tdBorder = "border-b border-gray-100 dark:border-gray-700/60"
  return (
    <tr className="group">
      <td className={cx(tdBorder, cellBg, "px-2 py-2 text-right align-top text-xs tabular-nums text-gray-600 dark:text-gray-400")}>
        {row.no ?? "—"}
      </td>
      <th scope="row" className={cx(tdBorder, cellBg, "px-2 py-2 text-left align-top font-normal")}>
        <span className="block font-medium text-gray-900 dark:text-gray-100">{row.label}</span>
        <FunctionMeta row={row} />
      </th>
      {positionId != null ? (
        <td className={cx(tdBorder, cellBg, "px-2 py-2 text-center align-top")}>
          <GrantMark ok={row.positionSet.has(positionId)} name={positionName(positionId)} />
        </td>
      ) : (
        <td className={cx(tdBorder, cellBg, "px-2 py-2 align-top")}>
          <PositionSummary row={row} />
        </td>
      )}
    </tr>
  )
}

function PermissionCard({ row, positionId }) {
  const ok = positionId != null && row.positionSet.has(positionId)
  return (
    <li className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-gray-200/70 dark:bg-gray-800 dark:ring-gray-700/70">
      <div className="flex items-start gap-3">
        <div className="min-w-0 flex-1">
          <p className="text-base font-semibold leading-snug text-gray-900 dark:text-gray-100">
            {row.no != null && <span className="mr-1.5 text-sm font-normal tabular-nums text-gray-500 dark:text-gray-400">#{row.no}</span>}
            {row.label}
          </p>
          <div className="break-all">
            <FunctionMeta row={row} />
          </div>
        </div>
        {positionId != null && (
          <span
            className={cx(
              "shrink-0 rounded-full px-2 py-0.5 text-xs font-semibold ring-1",
              ok
                ? "bg-emerald-50 text-emerald-800 ring-emerald-200 dark:bg-emerald-500/10 dark:text-emerald-200 dark:ring-emerald-500/30"
                : "bg-gray-100 text-gray-600 ring-gray-200 dark:bg-gray-700/60 dark:text-gray-300 dark:ring-gray-600",
            )}
          >
            {ok ? "ใช้ได้" : "ไม่ได้"}
          </span>
        )}
      </div>
      {positionId == null && (
        <div className="mt-3 border-t border-gray-100 pt-3 dark:border-gray-700/60">
          <p className="mb-1 text-xs text-gray-500 dark:text-gray-400">ตำแหน่งที่ใช้ได้</p>
          <PositionSummary row={row} />
        </div>
      )}
    </li>
  )
}
