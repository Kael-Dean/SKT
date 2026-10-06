# HR Dashboard: UX/UI spec (stage 1)

Mode: **Operate**, desktop-first (1280 to 1920), mobile secondary. Contract: `C:\Users\User\.claude\plans\amc-skt-squishy-penguin.md`. Visual authority: `.impeccable.md` plus the incumbent code. Apple-like calm, one indigo accent, gray neutrals, emerald/amber/red for status only, Sarabun, `rounded-2xl`, and light and dark treated equally.
References: Linear (grouped rail, Ctrl+K), Stripe Dashboard (section header, calm stats and tables), Rippling/Workday (compensation change with a before→after preview and a confirm step).
Process note: there is no PRODUCT.md. Discovery is replaced by the approved plan and `.impeccable.md`. Run `impeccable init` later; it is not blocking.

**Direction thesis:** "A quiet workbench." The page has no decoration. Navigation sits on the bare canvas (`bg-gray-50 / dark:bg-gray-950`) and the work sits on one white card. Indigo appears in only three places: the active nav item, the primary action, and focus rings. Numbers use `tabular-nums` throughout. The main visual moment of the salary page is the before→after preview, so it gets the largest type in the action card.

---

## 1. Information architecture

Keep all 20 existing `?tab=` keys exactly. Only labels, grouping and icons change. Remove the emoji. Icons come from `lucide-react` at `size-4`, `strokeWidth={1.75}`.

| Group (rail header) | key | Label | Icon | Badge |
|---|---|---|---|---|
| **บุคลากร** | `employees` | เจ้าหน้าที่ | `Users` | – |
| | `positions` | ตำแหน่งงาน | `BriefcaseBusiness` | – |
| | `promotions` | เลื่อนตำแหน่ง | `Award` | – |
| | `termination` | บันทึกออกจากงาน | `UserMinus` | – |
| | `resigned-retired` | ประวัติออกจากงาน | `Archive` | – |
| **การลาและเวลา** | `leave` | คำขอลา | `FileText` | `stats.pending_leave_requests` |
| | `leave-register` | ทะเบียนการลา | `BookOpen` | – |
| | `out-of-office` | ออกนอกสถานที่ | `MapPin` | – |
| | `holiday-work` | ทำงานวันหยุด | `CalendarClock` | – |
| **การย้าย** | `relocation` | ย้ายสาขา | `ArrowRightLeft` | `stats.pending_relocation_requests` |
| | `relocation-history` | ประวัติย้ายสาขา | `History` | – |
| **เงินเดือนและสวัสดิการ** | `salary` | เงินเดือน | `Coins` | – |
| | `payroll` | จ่ายเงินเดือน | `Banknote` | – |
| | `loans` | สินเชื่อ | `HandCoins` | – |
| | `salary-cert` | หนังสือรับรองเงินเดือน | `ScrollText` | – |
| | `kpi` | KPI | `Target` | – |
| **ตั้งค่า** | `leave-types` | ประเภทการลา | `ListChecks` | – |
| | `holiday-calendar` | ปฏิทินวันหยุด | `CalendarDays` | – |
| **ระบบ** | `issues` | รายงานปัญหา | `Wrench` | `stats.pending_issue_reports` |
| | `audit` | ประวัติการใช้งาน | `ClipboardList` | – |

- Keep a single config in `HRDashboard.jsx`: `HR_NAV = [{ group, items: [{ key, label, icon, badgeKey?, description, keywords }] }]`. The rail, the <lg menu, Ctrl+K, the section header and `document.title` all read from it.
- Badge rules: show only when the value is a number greater than 0. Display `99+` above 99. Hide while stats are loading or after a stats error, because the stat strip already reports that.
- `keywords` feed fuzzy matching. Examples: `leave` gets `["ลา","leave","อนุมัติ"]`, `salary` gets `["ขั้น","เลื่อนขั้น","บัญชีเงินเดือน"]`, `payroll` gets `["สลิป","จ่าย"]`. Renamed items keep their old words as keywords so habit still finds them: `leave` adds `"ใบลา"`, `termination` adds `["ออกจากงาน","เลิกจ้าง","เงินชดเชย"]`, `resigned-retired` adds `["ลาออก","เกษียณ","ไล่ออก"]`, `salary-cert` adds `"หนังสือรับรอง"`, `audit` adds `["ประวัติระบบ","log","audit"]`.
- Default tab is `employees`. An unknown `tab` falls back to `employees` and is rewritten with `replace`.

## 2. HR shell

### 2.1 Wireframe at 1440

The global app sidebar is an off-canvas drawer (`Sidebar.jsx`, fixed `w-72`). It overlays the page and takes no layout width. The topbar sits above `<main class="overflow-y-auto">`, which is the scroll container used for sticky positioning.

```
┌ Topbar (existing) ─────────────────────────────────────────────────────────────────────────┐
├────────────────────────────────────────────────────────────────────────────────────────────┤
│ max-w-[1600px] mx-auto px-6 py-6                                                           │
│ งานบุคคล (HR)                                                                               │ h1 text-xl font-bold
│ จัดการข้อมูลเจ้าหน้าที่ การลา เงินเดือน และระบบ HR ในที่เดียว                                     │ text-sm gray-500
│ ┌──────────┬──────────┬──────────┬──────────┬──────────┐                                    │ stat strip: grid-cols-5 gap-3
│ │◦ 202 คน   │◦ 4 รายการ │◦ 1 รายการ │◦ 0 รายการ │◦ 1.2M ฿   │  (all are buttons)                 │ h-[76px] each
│ └──────────┴──────────┴──────────┴──────────┴──────────┘                                    │
│ ┌ rail w-60 sticky top-6 ┐  ┌ content card (cardCls) min-w-0 ───────────────────────────────┐│
│ │ [⌕ ค้นหาเมนู    Ctrl K] │  │ ◦ เงินเดือน                                [primary action?] ││ PageSection header
│ │                         │  │   เลื่อนขั้น ดูบัญชีเงินเดือน และประวัติรายบุคคล                   ││
│ │ บุคลากร                 │  │ ───────────────────────────────────────────────────────── ││ border-b gray-100
│ │  ◦ เจ้าหน้าที่            │  │ [เลื่อนขั้น|บัญชีเงินเดือน|ประวัติรายบุคคล]   (Tabs)            ││
│ │  ◦ ตำแหน่งงาน           │  │                                                            ││
│ │  ...                    │  │   section body (existing tab component)                    ││
│ │ การลาและเวลา            │  │                                                            ││
│ │  ◦ คำขอลา          (4)  │  │                                                            ││
│ │ ...                     │  │                                                            ││
│ │ เงินเดือนและสวัสดิการ     │  │                                                            ││
│ │ ▌◦ เงินเดือน  (active)  │  │                                                            ││
│ │ ...                     │  └────────────────────────────────────────────────────────────┘│
└─┴─────────────────────────┴────────────────────────────────────────────────────────────────┘
grid: lg:grid-cols-[15rem_minmax(0,1fr)] gap-8 items-start
```

- `AppLayout.jsx:76`: when `pathname === "/hr/dashboard"`, use `mx-auto max-w-[1600px]` instead of `max-w-7xl`. Keep `/debt-form` as `w-full`.
- Page title: replace "HR Dashboard" with **งานบุคคล (HR)**.
- **Stat strip** (`grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3`): compact. Each tile has an icon chip, a label and a value, with `p-4` and no "ต้องดำเนินการ" badge row. That badge row caused uneven heights; the rail badge now carries that signal. When a pending value is greater than 0, show a small `size-1.5 rounded-full bg-amber-500` dot before the value. Icon chips are neutral (`bg-gray-100 text-gray-500 dark:bg-gray-700/60 dark:text-gray-300`). Drop the per-card blue/red/emerald tints because they break "one accent".
  - All five tiles are `<button>`. Targets: employees, leave, relocation, issues, and **payroll** for the salary total.
  - Loading: five `SkeletonStat` tiles at the same height, so nothing jumps.
  - Error: replace the strip with one row inside `cardCls p-4`: `AlertCircle` in red-500, "โหลดสรุปข้อมูลไม่สำเร็จ", and a `secondaryBtn` "ลองใหม่". Never show five silent "—".
- **Content card:** `cardCls` (`rounded-2xl bg-white dark:bg-gray-800 ring-1 ring-gray-200/70 dark:ring-gray-700/70 shadow-sm`) with padding `p-5 xl:p-6`. Every tab renders a `PageSection` header (see §4.5) from `HR_NAV`, followed by the existing tab body.
- On tab change, scroll `<main>` to top. Use `behavior: "smooth"` only when `prefers-reduced-motion` is not set. Set `document.title = "<label> · HR"`.

### 2.2 Rail

- Container: `<nav aria-label="เมนูงานบุคคล" class="hidden lg:block sticky top-6 self-start">`. Inner list: `max-h-[calc(100dvh-8rem)] overflow-y-auto pr-1 [scrollbar-width:thin]`. The rail sits on the canvas with no card.
- Filter box at the top: `h-9 rounded-xl bg-white dark:bg-gray-800 ring-1 ring-gray-200 dark:ring-gray-700 pl-8 pr-14 text-sm`. It has a `Search` icon on the left and a `<kbd>` "Ctrl K" on the right (`text-[11px] text-gray-400 ring-1 ring-gray-200 dark:ring-gray-700 rounded-md px-1.5`).
  - Filtering is live against label + keywords. Groups with no matches are hidden. Enter navigates to the first match, Esc clears the filter.
  - With no matches, show "ไม่พบเมนู" (`text-sm text-gray-500 px-2.5 py-2`).
- Group header: `<h2 class="px-2.5 pt-5 pb-1.5 text-xs font-semibold text-gray-400 dark:text-gray-500">`. The first header uses `pt-3`. Each group is a `<ul role="list">`.
- Items follow §4.6. Use `<Link to={{ search: "?tab=<key>" }}>` so middle-click and "open in new tab" work, and set `aria-current="page"` on the active item.
- Height budget: 20 × 32px + 6 headers × ~30px + 44px filter ≈ 870px. Inner scroll handles short viewports. The active item calls `scrollIntoView({block:"nearest"})` on mount.

### 2.3 Below `lg` (<1024)

- Hide the rail. Above the content card, show a full-width **section menu**: `SelectDropdown searchable` (see §4.2) with `options = all items {value:key, label, sublabel: group}` and placeholder "เลือกเมนู". Badges go into the sublabel as "คำขอลา" with sublabel "การลาและเวลา · รอ 4".
- The Ctrl+K switcher still works. The stat strip wraps to 2 or 3 columns. Content card padding is `p-4`.

### 2.4 Ctrl+K quick switcher

- Trigger: `Ctrl+K` / `⌘K` (`e.key.toLowerCase()==="k" && (e.ctrlKey||e.metaKey)`) with `preventDefault`. Listen only while HRDashboard is mounted. Clicking the rail filter's `<kbd>` also opens it.
- UI: rendered through `Portal` at `z-[10060]`, backdrop `bg-gray-950/40`. Panel `fixed top-[15vh] left-1/2 -translate-x-1/2 w-[min(36rem,calc(100vw-2rem))] rounded-2xl bg-white dark:bg-gray-800 ring-1 ring-gray-200 dark:ring-gray-700 shadow-lg`.
  - Search input: `h-12 px-4 text-base border-b border-gray-100 dark:border-gray-700`, placeholder "ไปที่เมนู… (พิมพ์ชื่อหรือคำค้น)".
  - Results: `max-h-80 overflow-y-auto p-2`, grouped by group header. Each row shows icon + label + group (right side, gray-400) + badge.
  - Footer hint: `text-xs text-gray-400`, "↑↓ เลือก · Enter เปิด · Esc ปิด".
- A11y: `role="dialog" aria-modal="true" aria-label="ไปที่เมนู"`. The input is `role="combobox" aria-expanded aria-controls=<listbox> aria-activedescendant`. Results are `role="listbox"` with `role="option"` rows and `aria-selected` on the active one.
- Keys: ↑/↓ wrap, Home/End, Enter navigates (push history), Esc closes. Focus returns to the element that opened the switcher.
- Matching: normalize with lowercase and trim, then match against label + keywords + key. Rank exact prefix, then substring, then subsequence. With an empty query, show all 20 items grouped and preselect the current tab.
- Empty result: "ไม่พบเมนูที่ตรงกับ “{q}”".

### 2.5 URL contract

| Action | Result | History |
|---|---|---|
| Rail / switcher / stat tile click | `?tab=<key>` (drops `sub`) | **push** |
| Sub-tab change inside a section | `?tab=<key>&sub=<value>` | **replace** |
| Invalid `tab` | rewrite to `?tab=employees` | replace |
| Missing/invalid `sub` | render first sub-tab and do not write the URL | – |

- Sub-tab values are each component's existing internal values. Salary uses `step | ladder | history`.
- Provide a hook `useSubTab(validValues, fallback)` that returns `[sub, setSub]` and wraps `useSearchParams`. Use it in all 11 tabbed files.
- Deep link: `#/hr/dashboard?tab=salary&sub=history` must restore the section and sub-tab after a refresh.
- Wire `HRSalaryTab`'s `onGoToPositions` to `setTab("positions")`.

## 3. Salary section (`tab=salary`)

PageSection: title **เงินเดือน**, description "เลื่อนขั้นเงินเดือนเจ้าหน้าที่ และดูอัตราเงินเดือนแต่ละขั้นของกระบอก". Tabs (`aria-label="เงินเดือน"`): **เลื่อนขั้น** (`step`) · **บัญชีเงินเดือน** (`ladder`) · **ประวัติรายบุคคล** (`history`).

### 3.1 `sub=step` at 1440 (content width ≈1070)

```
grid gap-6 lg:grid-cols-[minmax(0,1fr)_22rem] lg:items-start
┌ LEFT (min-w-0, space-y-4) ──────────────────────────────┐ ┌ RIGHT sticky top-6 ─────────────────┐
│ เจ้าหน้าที่                                                │ │ เลื่อนขั้นเงินเดือน                       │ h3 font-semibold
│ [⌕ สมชาย ใจดี · รหัส 112 · เจ้าหน้าที่การเงิน      ▾]      │ │ ขั้นใหม่จะไม่เกินขั้นสูงสุดของกระบอก        │ text-xs gray-500
│                                                          │ │                                     │
│ ┌ Employee summary card (cardCls p-5) ────────────────┐  │ │ จำนวนขั้นที่เลื่อน *                    │
│ │ (สจ)  สมชาย ใจดี                         text-lg bold │  │ │ [0.5][ 1 ][1.5][ 2 ][อื่น ๆ]           │ chip radiogroup
│ │       รหัส 112 · เจ้าหน้าที่การเงิน                     │  │ │ (custom) [ 2.5    ] ขั้น  (≤ 5)      │ only when อื่น ๆ
│ │ ─────────────────────────────────────────────────── │  │ │                                     │
│ │ กระบอก        ขั้นปัจจุบัน       เงินเดือนปัจจุบัน        │  │ │ ┌ preview bg-gray-50 rounded-xl p-4 ┐│
│ │ ระดับ 3        12               15,060 บาท             │  │ │ │ ขั้น      12  →  13                 ││ text-2xl bold on new
│ │ (dl grid-cols-3, values text-base font-semibold tnum)│  │ │ │ เงินเดือน 15,060 → 15,600 บาท       ││
│ └──────────────────────────────────────────────────────┘  │ │ │ +540 บาท/เดือน (+3.6%)  emerald-700 ││
│                                                          │ │ └────────────────────────────────────┘│
│ ประวัติการเลื่อนขั้น (SalaryHistoryTable, existing)          │ │ [!] amber capped warning (if any)   │
│ ┌──────────────────────────────────────────────────────┐  │ │ เหตุผล *                              │
│ │ วันที่ | จาก | เป็น | จำนวน | เหตุผล | ผู้บันทึก          │  │ │ [textarea rows=3          ] 0/255   │
│ └──────────────────────────────────────────────────────┘  │ │ [      เลื่อนขั้น (primaryBtn w-full) ]│
└──────────────────────────────────────────────────────────┘ │ hint: กรอกเหตุผลการเลื่อนขั้น            │
                                                             └─────────────────────────────────────┘
```

**Employee picker** (`EmployeePicker`, rewritten)
- Use one control: `SelectDropdown searchable` with label "เจ้าหน้าที่". Remove the separate search `<input>` and the 150 cap, and render all ~200 rows.
- Option: `label = employeeName`, `sublabel = "รหัส {id}{ · staff code if field exists} · {position title | ยังไม่มีตำแหน่ง}"`.
- Filter matches name, id, staff code and position. Pass `showSwatch={false}`.
- Put `aria-labelledby` on the trigger, not on the wrapper div.
- Export `refreshPersonnel()`, which clears the module cache and refetches. Call it after a successful award.
- Load error: red helper text "โหลดรายชื่อเจ้าหน้าที่ไม่สำเร็จ" plus a link-style "ลองใหม่".
- Width: `max-w-xl`.

**Summary card**
- Initials avatar: `size-11 rounded-full bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-200 text-sm font-semibold`.
- `dl` with 3 cells (`grid-cols-3 gap-4`), separated from the header by `border-t border-gray-100 dark:border-gray-700 pt-4 mt-4`:
  - Current salary comes from `GET /hr/salary-ladder/lookup?tier&level=current`. If the lookup fails, show "ไม่พบ" in gray-500 with title "ไม่พบขั้นนี้ในบัญชีเงินเดือน" (no bare dash).
- Loading: skeleton lines at the final height.
- On employee change, reset `detail`, preview, reason, step (back to `1`) and errors **synchronously**, before the fetch. Guard every fetch with an alive flag or AbortController, including `SalaryHistoryTable` and `EmployeePositionCard`.
- After a successful award, refetch, and give the summary card a 1.2s `bg-indigo-50/60 dark:bg-indigo-500/10` fade-out as the "updated" cue. Skip it under reduced motion.
- No tier: an amber `Notice` inside the card, "ตำแหน่ง “{title}” ยังไม่ได้กำหนดกระบอกเงินเดือน จึงเลื่อนขั้นไม่ได้", with the link button **ไปที่ตำแหน่งงาน**. No position: "เจ้าหน้าที่คนนี้ยังไม่มีตำแหน่ง จึงเลื่อนขั้นไม่ได้".

**Action card**
- Classes: `cardCls p-5 space-y-5 lg:sticky lg:top-6`, as a `<form noValidate>`.
- **Step chips:**
  - `role="radiogroup" aria-label="จำนวนขั้นที่เลื่อน"` with 5 `role="radio"` buttons and roving tabindex driven by arrow keys.
  - Chip classes: `h-9 flex-1 rounded-lg text-sm font-semibold tabular-nums ring-1 ring-inset`.
  - Off: `ring-gray-200 text-gray-700 hover:bg-gray-50 dark:ring-gray-600 dark:text-gray-200 dark:hover:bg-gray-700/50`.
  - On: `bg-indigo-600 text-white ring-indigo-600 dark:bg-indigo-500 dark:ring-indigo-500`.
- **Custom field** (only when "อื่น ๆ" is on; it receives focus when it appears):
  - Left-aligned `inputCls w-28 tabular-nums` followed by the suffix "ขั้น".
  - Attributes: `inputMode="decimal" step=0.5 min=0.5 max=5`, `aria-invalid`, `aria-describedby="step-err"`.
  - Validate on blur and before submit: the value must be finite, between 0.5 and 5, and a multiple of 0.5. Clear the error on change.
- **Preview:**
  - Compute `target = current + step`, plus `max` from `GET /hr/salary-ladder?tier=` (already used by SalaryLadderPanel; cache per tier), and `newLevel = min(target, max)`.
  - Salary comes from `GET /hr/salary-ladder/lookup?tier&level=newLevel`, debounced 250ms with AbortController and cached by `tier:level`.
  - Rows show labels in gray-500 and values in `tabular-nums`. The new value is gray-900 bold, and the delta is `text-emerald-700 dark:text-emerald-400`.
  - Preview states:
    - Waiting for an employee: "เลือกเจ้าหน้าที่เพื่อดูขั้นและเงินเดือนใหม่".
    - Lookup in progress: skeleton.
    - Lookup failed: the level row still shows, and the salary row shows "ไม่พบเงินเดือนของขั้น {n} ในบัญชีเงินเดือน".
  - The preview is `aria-live="polite"`.
- **Capped warning** (`newLevel < target`): amber `Notice`, "เลื่อนได้จริง {gain} จาก {step} ขั้น เพราะถึงขั้นสูงสุดของกระบอก (ขั้น {max})". Submit stays enabled.
  - Already at max (`gain === 0`): show "เจ้าหน้าที่คนนี้อยู่ขั้นสูงสุดของกระบอกแล้ว จะเลื่อนขั้นต่อได้เมื่อเลื่อนตำแหน่งไปกระบอกที่สูงกว่า" and disable submit.
- **Reason:** `<textarea rows=3 maxLength=255>` with `inputCls resize-none` and a counter `{n}/255` (`text-xs text-gray-400`, right). Placeholder "เช่น ผลประเมินประจำปี 2569 ระดับดีเด่น".
- **Disabled rules:** submit is `disabled` when any of these hold: no employee; detail loading; no tier; invalid step; empty `reason.trim()`; `gain===0`; submitting.
  - Under the button, `<p id="submit-hint" class="text-xs text-gray-500 text-center">` shows the **first** unmet rule (copy in §5). The button has `aria-describedby="submit-hint"`.
- Clicking submit opens the ConfirmDialog. Nothing is posted before the user confirms.

**Confirm dialog** (§4.3, tone `primary`, initial focus on cancel)
```
ยืนยันการเลื่อนขั้นเงินเดือน
สมชาย ใจดี · รหัส 112
┌ bg-gray-50 rounded-xl p-4 ────────────────┐
│ ขั้น         12 → 13   (+1 ขั้น)            │
│ เงินเดือน    15,060 → 15,600 บาท           │
│ เหตุผล       ผลประเมินประจำปี 2569 …         │
└────────────────────────────────────────────┘
[amber line if capped]
บันทึกแล้วจะแก้ไขจากหน้านี้ไม่ได้ ตรวจสอบข้อมูลก่อนยืนยัน
                         [ยกเลิก] [ยืนยันเลื่อนขั้น]
```
- While posting, the confirm button shows a spinner and "กำลังบันทึก…". Esc, backdrop click and cancel are disabled.
- On error, the dialog stays open with a red `Notice` inside it. A 409 response adds the "ไปที่ตำแหน่งงาน" link, which closes the dialog and navigates.

**Success**
- Close the dialog and call `toast.success("เลื่อนขั้นเรียบร้อยแล้ว", { description: "{name} · ขั้น {old} → {new}" })`. If the backend returns `capped`, call `toast.warning("เลื่อนขั้นเรียบร้อยแล้ว ถึงขั้นสูงสุดของกระบอก", { description: "{name} · ขั้น {old} → {new} · ได้จริง {gain} ขั้น" })` instead.
- Then refetch detail and history, call `refreshPersonnel()`, clear the reason, and reset the step to 1.
- Remove the old `AwardResult` block. The toast and the updated summary card replace it.

**Empty state (no employee chosen)**
- Left column: the picker, then an `EmptyState` with icon `UserSearch`, title "เลือกเจ้าหน้าที่ที่จะเลื่อนขั้น" and body "ค้นหาด้วยชื่อ รหัส หรือตำแหน่ง ระบบจะแสดงขั้นปัจจุบันและประวัติการเลื่อนขั้น" (no "แผงด้านขวา": below `lg` the card is not on the right).
- The right card still renders its controls with a muted preview. Submit is disabled and the hint reads "เลือกเจ้าหน้าที่ก่อน".

**Below `lg`:** single column, in this order: picker, summary, action card (not sticky), history.

### 3.2 `sub=history` and `sub=ladder`
- **history:** the same left-column pattern (picker, summary card, `SalaryHistoryTable`), full width at `max-w-4xl`, with no action card. Empty state: "เลือกเจ้าหน้าที่เพื่อดูประวัติการเลื่อนขั้น".
- **ladder:** keep `SalaryLadderPanel` as is. Fix its dark-mode gaps, and change its tier selector to the upgraded SelectDropdown.

## 4. Component specs (design-system-engineer)

Put these in `src/components/ui/` and export them from `index.js`. JSX only. Hooks only, no Context. Overlays go through `Portal`.
Shared focus ring: `focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2 focus-visible:ring-offset-white dark:focus-visible:ring-offset-gray-800`.

### 4.1 `Tabs` (segmented)
- API: `<Tabs items={[{value,label,icon?,count?,disabled?}]} value onChange ariaLabel idBase size="md|sm" />`. Also export `tabId(idBase,v)` and `panelId(idBase,v)`. The consumer renders `<div role="tabpanel" id={panelId} aria-labelledby={tabId} tabIndex={0}>`.
- Track: `inline-flex max-w-full gap-1 overflow-x-auto rounded-xl bg-gray-100 p-1 ring-1 ring-inset ring-gray-200/60 dark:bg-gray-900/60 dark:ring-gray-700/60 [scrollbar-width:none]`. The dark track is visible inside a `dark:bg-gray-800` card.
- Tab: `h-9 (sm:h-8) px-3.5 rounded-lg text-sm font-semibold whitespace-nowrap transition-colors duration-150`.

| State | Light | Dark |
|---|---|---|
| default | `text-gray-500` | `text-gray-400` |
| hover | `text-gray-800 bg-white/60` | `text-gray-100 bg-gray-700/40` |
| active | `bg-white text-indigo-700 shadow-sm` | `bg-gray-700 text-indigo-300 shadow-sm` |
| focus-visible | shared ring, `ring-offset-0` + `ring-inset` | same |
| disabled | `opacity-50 cursor-not-allowed` | same |

- A11y: `role="tablist" aria-label`, and each tab has `role="tab" aria-selected aria-controls id`. Roving `tabIndex` (0 on active, -1 on the rest). ←/→ wraps, Home/End jump, and activation is automatic. Disabled tabs are skipped. `count` renders a `rounded-full px-1.5 text-xs bg-gray-200 dark:bg-gray-700` pill.

### 4.2 `SelectDropdown`: `searchable` upgrade (backward compatible)
- Keep the existing props and `onChange(value: string)` exactly as they are. New optional props:
  - `searchable=false`, `searchPlaceholder="ค้นหา…"`, `filterFn(opt,q)` (default: case-insensitive includes on label + sublabel + value), `emptyText="ไม่พบรายการ"`.
  - `showSwatch=true` (current behaviour); the swatch colour is a **hash of `value`**, not the index.
  - `id`, `ariaLabel`, `ariaLabelledby`, `ariaDescribedby` go on the trigger.
- Trigger:
  - Add `pr-9`. The label span is `min-w-0 flex-1 truncate` with `title={selected.label}`.
  - Optionally show the sublabel in the trigger via `showSublabelInTrigger`, as `truncate text-xs text-slate-500` on a second line.
  - Add `focus-visible` styles. Keep the existing slate tokens so the 23 current usages don't shift visually.
- Panel:
  - Keep the portal, z 10050 and flip logic. Width is `max(trigger, 18rem)`, capped at `32rem`. Height is `max-h-72`.
  - When `searchable`, a sticky search input (`h-10 border-b`) is at the top and gets focus on open. The query resets on close.
- Keyboard:
  - Closed trigger: Enter/Space/↓ opens with the selected option active (or the first), and ↑ opens on the last.
  - Open: ↑/↓/Home/End move the active option, which calls `scrollIntoView({block:"nearest"})`. Enter selects, Esc closes and refocuses the trigger, Tab closes.
  - When not searchable, typing a printable character does type-ahead.
- ARIA:
  - The trigger is `role="combobox" aria-haspopup="listbox" aria-expanded aria-controls`.
  - The search input carries `aria-activedescendant`.
  - The panel is `role="listbox"` and options are `role="option" aria-selected`, with ids.
- Option row: `px-3 py-2 rounded-lg`. Active: `bg-indigo-50 dark:bg-indigo-500/15`. Selected: a `Check` icon on the right in indigo. The sublabel is `text-xs text-gray-500 truncate`.
- Empty: `px-3 py-6 text-center text-sm text-gray-500`, `{emptyText}`.

### 4.3 `ConfirmDialog`
- Props: `open, title, description?, children?, confirmLabel, cancelLabel="ยกเลิก", tone="primary|danger", loading, error, onConfirm, onCancel, initialFocus="cancel|confirm"`.
- `Portal`, `z-[10070]`, `role="alertdialog" aria-modal aria-labelledby aria-describedby`. Trap focus, lock body scroll, and return focus to the opener on close. Esc and backdrop clicks cancel, unless `loading`.
- Panel: `w-[min(28rem,calc(100vw-2rem))] rounded-2xl bg-white p-6 shadow-lg ring-1 ring-gray-200 dark:bg-gray-800 dark:ring-gray-700`. Title is `text-lg font-bold`, description is `text-sm text-gray-500 leading-relaxed`. Actions are right-aligned with `gap-2 mt-6`; on mobile they stack full width with confirm first.
- Confirm uses `primaryBtn` (indigo) for `primary`, and `bg-red-600 hover:bg-red-500` for `danger`.
- Motion: opacity plus `scale-[.98]→1`, 150ms. Opacity only under reduced motion.

### 4.4 `Toast` (no Context)
- `ui/toast.js` holds the module emitter: `toast.success|error|warning|info(title, {description, duration})` and `toast.dismiss(id)`. A `Set` of listeners exposes `subscribe(fn)`.
- `ui/Toaster.jsx` subscribes in `useEffect` and renders through `Portal` at `z-[10080]`. Mount it **once in `AppLayout`**, so standalone HR pages get it too.
- Position: `fixed bottom-4 right-4` on desktop, `inset-x-4 bottom-4` on mobile. Maximum 3 visible, newest at the bottom.
- Card: `w-[22rem] rounded-2xl bg-white p-4 shadow-lg ring-1 ring-gray-200 dark:bg-gray-800 dark:ring-gray-700`, with an icon (`CheckCircle2` emerald-600, `AlertTriangle` amber-500, `XCircle` red-600, `Info` gray-500), the title (`text-sm font-semibold`), the description (`text-sm text-gray-500`) and a close `X` button (`aria-label="ปิดการแจ้งเตือน"`).
- Duration: 4s by default and 7s for errors. Pause while hovered or focused.
- `success`, `info` and `warning` use `role="status" aria-live="polite"`; `error` uses `role="alert"`.
- Replace the `window.alert` calls at `HRLeaveTab.jsx:40`, `HRLeaveManagement.jsx:41` and `HRPayrollTab.jsx:102`.

### 4.5 `PageSection` header
- `<PageSection title description? icon? actions? as="h2">{children}</PageSection>`
- Header: `flex flex-wrap items-start justify-between gap-4 border-b border-gray-100 pb-4 mb-5 dark:border-gray-700/70`.
  - Optional icon chip: `size-9 rounded-xl bg-gray-100 text-gray-600 dark:bg-gray-700/60 dark:text-gray-300`.
  - Title: `text-lg font-bold text-gray-900 dark:text-gray-100`.
  - Description: `mt-0.5 text-sm leading-relaxed text-gray-500 dark:text-gray-400 max-w-prose`.
  - Actions slot: `flex items-center gap-2 shrink-0`, holding at most one primary button.

### 4.6 HR rail item (`HRNavItem`, local to HR)
- Base: `group flex h-8 w-full items-center gap-2.5 rounded-lg px-2.5 text-sm font-medium transition-colors duration-150`.

| State | Light | Dark |
|---|---|---|
| default | `text-gray-600`, icon `text-gray-400` | `text-gray-400`, icon `text-gray-500` |
| hover | `bg-gray-100 text-gray-900`, icon `text-gray-600` | `bg-gray-800 text-gray-100`, icon `text-gray-300` |
| active (`aria-current="page"`) | `bg-indigo-50 text-indigo-700 font-semibold`, icon `text-indigo-600` | `bg-indigo-500/15 text-indigo-300`, icon `text-indigo-400` |
| focus-visible | `ring-2 ring-inset ring-indigo-500` | same |
| filtered-out | not rendered | – |

- Badge: `ml-auto min-w-5 rounded-full px-1.5 text-center text-xs font-semibold tabular-nums`. Inactive: `bg-gray-200/80 text-gray-700 dark:bg-gray-700 dark:text-gray-200`. Active: `bg-indigo-600 text-white dark:bg-indigo-500`. Also add `<span class="sr-only">รอดำเนินการ {n} รายการ</span>`.
- The label is `truncate`.

## 5. Copy (Thai, new strings)

| Context | Text |
|---|---|
| Page title / desc | งานบุคคล (HR) · จัดการข้อมูลเจ้าหน้าที่ การลา การย้ายสาขา และเงินเดือน |
| Group headers | บุคลากร · การลาและเวลา · การย้าย · เงินเดือนและสวัสดิการ · ตั้งค่า · ระบบ |
| Rail items (changed) | บันทึกออกจากงาน · ประวัติออกจากงาน · คำขอลา · หนังสือรับรองเงินเดือน · ประวัติการใช้งาน (full list in §1) |
| Rail | aria: เมนูงานบุคคล · filter placeholder: ค้นหาเมนู · empty: ไม่พบเมนู · <lg placeholder: เลือกเมนู |
| Switcher | dialog aria: ไปที่เมนู · placeholder: พิมพ์ชื่อเมนูหรือคำค้น · ไม่พบเมนูที่ตรงกับ “{q}” · ↑↓ เลือก · Enter เปิด · Esc ปิด |
| Badge sr | รอดำเนินการ {n} รายการ |
| Stat labels | เจ้าหน้าที่ที่ใช้งานอยู่ · คำขอลารออนุมัติ · คำขอย้ายสาขารออนุมัติ · รายงานปัญหารอดำเนินการ · เงินเดือนรวมเดือนนี้ |
| Stat error | โหลดตัวเลขสรุปไม่สำเร็จ · ลองใหม่ |
| Salary header | เงินเดือน · เลื่อนขั้นเงินเดือนเจ้าหน้าที่ และดูอัตราเงินเดือนแต่ละขั้นของกระบอก |
| Salary sub-tabs | เลื่อนขั้น · บัญชีเงินเดือน · ประวัติรายบุคคล |
| Action card | เลื่อนขั้นเงินเดือน · ขั้นใหม่จะไม่เกินขั้นสูงสุดของกระบอก · จำนวนขั้นที่เลื่อน · อื่น ๆ · ขั้น · สูงสุด 5 ขั้น · เหตุผล · placeholder: เช่น ผลประเมินประจำปี 2569 ระดับดีเด่น · {n}/255 |
| Picker | เจ้าหน้าที่ · ค้นหาชื่อ รหัส หรือตำแหน่ง · เลือกเจ้าหน้าที่ · ไม่พบเจ้าหน้าที่ที่ตรงกับคำค้น · โหลดรายชื่อเจ้าหน้าที่ไม่สำเร็จ · ลองใหม่ · ยังไม่มีตำแหน่ง |
| Summary | กระบอก · ขั้นปัจจุบัน · เงินเดือนปัจจุบัน · ไม่พบ (title: ไม่พบขั้นนี้ในบัญชีเงินเดือน) · เจ้าหน้าที่คนนี้ยังไม่มีตำแหน่ง จึงเลื่อนขั้นไม่ได้ |
| No tier | ตำแหน่ง “{title}” ยังไม่ได้กำหนดกระบอกเงินเดือน จึงเลื่อนขั้นไม่ได้ · ไปที่ตำแหน่งงาน |
| Preview | ขั้น · เงินเดือน · +{x} บาท/เดือน (+{p}%) · เลือกเจ้าหน้าที่เพื่อดูขั้นและเงินเดือนใหม่ · ไม่พบเงินเดือนของขั้น {n} ในบัญชีเงินเดือน |
| Capped | เลื่อนได้จริง {gain} จาก {step} ขั้น เพราะถึงขั้นสูงสุดของกระบอก (ขั้น {max}) |
| At max | เจ้าหน้าที่คนนี้อยู่ขั้นสูงสุดของกระบอกแล้ว จะเลื่อนขั้นต่อได้เมื่อเลื่อนตำแหน่งไปกระบอกที่สูงกว่า |
| Step errors | ระบุจำนวนขั้น · จำนวนขั้นต้องอยู่ระหว่าง 0.5 ถึง 5 · ระบุทีละครึ่งขั้น เช่น 1.5 หรือ 2.5 |
| Submit hint (first unmet, in rule order) | เลือกเจ้าหน้าที่ก่อน · กำลังโหลดข้อมูลเจ้าหน้าที่… · กำหนดตำแหน่งให้เจ้าหน้าที่ก่อน (no position) · กำหนดกระบอกเงินเดือนของตำแหน่งก่อน (no tier) · แก้จำนวนขั้นให้ถูกต้อง · กรอกเหตุผลการเลื่อนขั้น · อยู่ขั้นสูงสุดของกระบอกแล้ว (gain 0) |
| Buttons | เลื่อนขั้น · ยืนยันเลื่อนขั้น · กำลังบันทึก… · ยกเลิก |
| Confirm | ยืนยันการเลื่อนขั้นเงินเดือน · rows: ขั้น · เงินเดือน · เหตุผล · (+{gain} ขั้น) · บันทึกแล้วจะแก้ไขจากหน้านี้ไม่ได้ ตรวจสอบข้อมูลก่อนยืนยัน |
| API errors | เลื่อนขั้นไม่สำเร็จ ลองใหม่อีกครั้ง หากยังไม่ได้ แจ้งที่เมนู “รายงานปัญหา” · (409) ตำแหน่งของเจ้าหน้าที่คนนี้ยังไม่ได้กำหนดกระบอกเงินเดือน กำหนดที่ “ตำแหน่งงาน” ก่อนเลื่อนขั้น · ไปที่ตำแหน่งงาน |
| Toasts | success: เลื่อนขั้นเรียบร้อยแล้ว / {name} · ขั้น {old} → {new} · capped: เลื่อนขั้นเรียบร้อยแล้ว ถึงขั้นสูงสุดของกระบอก / {name} · ขั้น {old} → {new} · ได้จริง {gain} ขั้น · close aria: ปิดการแจ้งเตือน |
| Empty | step: เลือกเจ้าหน้าที่ที่จะเลื่อนขั้น / ค้นหาด้วยชื่อ รหัส หรือตำแหน่ง ระบบจะแสดงขั้นปัจจุบันและประวัติการเลื่อนขั้น · history: เลือกเจ้าหน้าที่เพื่อดูประวัติการเลื่อนขั้น |
| Generic | ไม่พบรายการ · ค้นหา… |

**Glossary (use one word per concept across HR):**
- **เจ้าหน้าที่** for any staff member. Do not use พนักงาน in new copy (HR nav, employees tab, personnel and finance pages already use เจ้าหน้าที่; older strings in leave, out-of-office, holiday-work and termination tabs still say พนักงาน and should be migrated later). Note: `officer` is also an employee type labelled เจ้าหน้าที่ in the signup form; where both appear on one screen, call the type "ประเภท: เจ้าหน้าที่".
- **เลื่อนขั้น** = step increase inside a กระบอก. **เลื่อนตำแหน่ง** = position change. Never swap them.
- **กระบอก** = salary tier, **ขั้น** = level, **บัญชีเงินเดือน** = the ladder table.
- **ถึงขั้นสูงสุด**, not ชนขั้นสูงสุด (colloquial).
- Retry is always **ลองใหม่**. Loading is always **กำลังโหลด…/กำลังบันทึก…** with the single-character ellipsis.
- No em dash in any string. Missing values render as words ("ไม่พบ", "ยังไม่มีตำแหน่ง"), never a bare dash.

The `ux-writer` owns final wording. Keys and placeholders (`{n}`, `{q}` …) are fixed.

## 6. Acceptance criteria
1. At 1280, 1440 and 1920, in light and dark, all 20 menus are visible in the rail with no horizontal scrollbar anywhere in the HR shell. Badges match the stats fields.
2. `?tab=` links still work, including `HRSalaryTab`'s positions link. Each `?tab=salary&sub=history` survives a refresh. Sub-tab clicks don't add history entries; rail clicks do.
3. Ctrl+K opens the switcher, typing "ลา" lists the leave items, Enter navigates, and Esc returns focus.
4. Typing a name, an id or a position finds any of the ~202 employees. Long names truncate in the trigger with a tooltip.
5. Preview shows level and salary before and after before anything is posted, and the capped warning appears when relevant. Nothing is posted without the confirm dialog.
6. Switching employees quickly never shows the previous person's level, preview or history.
7. Keyboard alone can operate the rail, Tabs, combobox, chips and dialog. Focus is always visible. Dark-mode Tabs track contrast is at least 3:1 against the card.
8. There is no `window.alert` and no emoji left in HR files. `npx impeccable detect` is clean for `src/pages/hr src/components/hr src/components/ui`.
