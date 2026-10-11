# Mobile overhaul — performance (WP5) + a11y follow-up

Owner: frontend-performance-engineer · branch `dev` · 2026-10-11
Commits: `e305bf0 perf(buy,sales): reuse Intl.NumberFormat instances in thb()/nf()` ·
`0454de8 fix(a11y,buy,sales): label association + error description`
Gates: `npm run build` PASS · `npm run lint` 206 errors (gate ≤ 206, no new) ·
`impeccable detect src/pages/work/{buy,sales,Buy.jsx,Sales.jsx}` → 0 findings.

## Method (all numbers are measured)

- **Bundle:** `vite build` + a throw-away Rollup plugin (per-module `renderedLength`) on three builds:
  baseline `48ed1a3`, WP3 HEAD `67eb3cc`, final. gzip = `gzip -9`.
- **Render:** production build (`vite preview`), Playwright Chromium, CDP CPU throttle **4x**, fake JWT + mocked API.
  A minimal `__REACT_DEVTOOLS_GLOBAL_HOOK__` counts components that performed work per commit.
  **React ms/keystroke** = window-capture `input` → window-bubble `input`. React flushes the controlled-input
  render synchronously in between, so this is render+commit time.
  **key→frame** = keydown → next rAF.
  Large sample: 3 runs x 40 keys per field, before/after builds interleaved.
- **CWV:** Lighthouse 12 mobile (simulated Slow 4G + 4x CPU) for the public login page.
  Authenticated routes use Playwright with 150 ms RTT, 1.6 Mbps and 4x CPU, measuring LCP, CLS and TBT
  (long tasks after FCP) via PerformanceObserver. 3–5 runs, median.

## 1. Bundle — chunk sizes (bytes, raw / gzip)

| chunk | baseline 48ed1a3 | WP3 HEAD | final (0454de8) |
|---|---|---|---|
| Buy | 71,375 / 17,609 | 106,213 / 25,932 | 109,777 / 26,659 |
| Sales | 77,646 / 17,923 | 105,449 / 26,609 | 108,121 / 27,346 |
| index (entry) | 138,239 / 34,956 | 169,406 / 42,594 | 169,629 / 42,623 |
| vendor-react | 223,040 / 71,510 | same (hash unchanged) | same |
| buyShared (new, Buy + Share) | — | 9,181 / 3,645 | 9,274 / 3,706 |
| ComboBox / Sheet / Stepper / StickyActionBar / ResultSheet / DataList / useVisualViewport | — | 9.1k / 4.2k / 2.1k / 2.0k / 2.1k / 2.5k / 0.8k raw | 3.8 / 2.0 / 1.0 / 1.1 / 1.0 / 1.2 / 0.4 KB gz |

Per-route JS beyond the entry chunk (gzip). Every module chunk is modulepreloaded in parallel.

| route | baseline | WP3 HEAD |
|---|---|---|
| Buy | 1 chunk, 17.8 KB | 14 chunks, 42.2 KB |
| Sales | 1 chunk, 18.1 KB | 15 chunks, 40.7 KB |
| Order | 2 chunks, 8.2 KB | 12 chunks, 18.2 KB |
| MemberSearch | 4 chunks, 8.7 KB | 9 chunks, 13.1 KB |

Findings:
- **No duplication.** Every primitive is exactly one chunk, shared by its importers (Rollup never duplicates modules).
- **lucide-react is tree-shaken** (confirmed). Only named icons ship, one module per icon.
- **Buy/Sales growth is page-owned feature code**, not primitives. The phone stepper commit added an `isPhone`
  variant to every section (`BuyMobileStepper` 11.3 KB raw, the phone halves of the Customer/Spec/Weigh/Summary sections).
  `Buy.jsx` is still a 68.5 KB controller.
- **Acceptance "Buy ≤ baseline + primitives used":**
  - **gzip: passes.** 26.7 ≤ 17.6 + ~12.9 (ComboBox, Sheet, Stepper, StickyActionBar, ResultSheet, ConfirmDialog, SearchField, useVisualViewport).
  - **raw: over by ~6 KB.** 109.8 KB vs ~103 KB. The overage is the phone JSX described above.
- **Entry chunk +7.6 KB gz vs baseline.** Sources:
  - Sidebar trading section + `homeFunctions` + ~20 lucide icons (~14 KB raw). These are needed by the shell.
  - `SearchField` + `useAnchoredPanel` (10.5 KB raw). Kept in the entry because
    `SearchField.SearchResults = SearchResults` is a top-level property write (a side effect), so Rollup keeps
    the module whenever the `ui` barrel is imported (App.jsx imports `PageLoader` from it).
- **`manualChunks`: not changed (not worth it, measured).** Three grouping variants were tried
  (leaf hooks only / + icons / + trading primitives). Rollup moves a manual chunk's unassigned dependencies into it
  (lucide runtime, `lib/styles`), so the entry ends up importing the group:
  - entry +2.3 to +13.7 KB gz
  - vendor-react hash churn
  - Buy route saving only 0.7 KB.

  `vite.config.js` is untouched; `DEV_PROXY_TARGET` logic is intact.
- **SearchField side-effect fix: tried, measured, reverted.**
  - Gain: entry −1.96 KB gz; login LCP −36 ms (2152 → 2116, 5 runs).
  - Cost: the Buy route needs 4 more chunk requests; Buy LCP +152 ms (3144 → 3296 ms, 5 runs, no overlap); TBT +17 ms.
  - Measured on HTTP/1.1 local preview. On an HTTP/2 host the trade-off may flip, so re-measure there before re-applying.

## 2. Render — keystroke cost (prod build, CPU 4x)

Component renders per keystroke (dev and prod identical; unchanged by my commits):

| surface | renders/key | what re-renders |
|---|---|---|
| Buy 1280 (any field) | 51 | controller + all 4 sections + 13 ComboBoxes (x3 fibers each = 39 of the 51) + ResultSheet/Sheet shell |
| Buy 1280 name field | 63.8 | same + debounced search commit |
| Sales 1280 | 65 (name 81) | controller + all sections + 14 ComboBoxes |
| Buy 390 (stepper) | 25–31 | **only the active step's section** + Stepper + StickyActionBar |
| Sales 390 (stepper) | 39 | active step only |

WP5 acceptance "typing does not re-render all 3 sections (390)": **met by construction** (plan A3: one section mounted per step).

React render+commit per keystroke (ms). Before = WP3 HEAD, after = final. Interleaved runs, n = keystrokes:

| field | before p50 / p75 / p90 / max | after p50 / p75 / p90 / max | share > 16 ms |
|---|---|---|---|
| Buy 1280 comment (n=120) | 13.9 / 16.9 / 19.4 / 29.4 | 13.4 / 15.6 / 20.5 / 35.6 | 29% → 23% |
| Buy 1280 entry weight (n=48) | 13.9 / 15.1 / 17.5 / 21.3 | 11.5 / 14.3 / 15.8 / 17.4 | 19% → 4% |
| Sales 1280 trailer weight (n=12) | 18.8 / **79.3 / 81.2 / 100.2** | 15.6 / 19.3 / 21.0 / 26.3 | 67% → 33% |
| Sales 1280 comment (n=120) | 12.9 / 14.2 / 16.5 / 24.5 | 11.3 / 13.0 / 14.2 / 19.9 | 13% → 4% |
| Buy 390 slip number (n=60) | 8.8 / 10.0 / 11.1 / 12.4 | 8.0 / 8.9 / 11.2 / 13.7 | 0% → 0% |

key→frame p90 (INP proxy):

- Desktop: 26–35 ms after (Sales trailer field 136 → 70 ms).
- Phone: about 21 ms.
- All far below the 200 ms INP threshold.

**Fixed (`e305bf0`):** `thb()`/`nf()` in `buyShared.js`/`salesShared.js` built a new `Intl.NumberFormat("th-TH")` on every call.

- A fresh formatter is 58x slower than a cached one: 0.039 vs 0.0007 ms (V8 micro-benchmark).
- The first th-TH construction costs ~24 ms (ICU setup), and it landed inside the first trailer-weight keystroke as a 100–114 ms long task at 4x.
- In the dev profile `SalesSummary` itself took 104 ms of self time on that commit.
- The formatters are now module-level. Same locale and options, so output is byte-identical.

**Not fixed (by decision): React.memo / props-bag slicing.**

- Steady state on desktop is p50 11–14 ms and p75 13–16 ms at 4x, so not slow by the brief's 16 ms rule.
- A safe split needs stable handlers across the 2,000-line controller. Sections read `order` wholesale, and `redFieldCls`/`onEnter`/`clearHint` are render-time closures over state. That would mean touching the Enter-flow/validation code for about 5 ms at 4x (about 1 ms real) on desktop only.
- If desktop ever needs it, the recipe is:
  1. a `useStableCallback` (ref + layout-effect) wrapper for event handlers only (not `redFieldCls`/`onEnter`, which are called during render);
  2. per-section `useMemo` slices (Spec: spec ids + options + spec errors; Weigh: weight/price fields + their errors);
  3. `React.memo` on the Desktop* sections.

  The biggest single win would be the 13–14 ComboBoxes (~75% of renders).

## 3. useVisualViewport / StickyActionBar / Toaster (phone 390, touch, coarse pointer)

| check | result |
|---|---|
| listeners on Buy phone | window `resize` x3, visualViewport `resize` x2 + `scroll` x2 (2 subscribers), ResizeObserver x2, MutationObserver 0 |
| 25 wheel steps of document scroll | **0 React commits, 0 layouts**, RecalcStyle 72 (6.8 ms total), script 2.2 ms |
| 6 viewport-height changes (keyboard-like) | 12 commits, 12 layouts (1.1 ms), script 12.5 ms — bounded, 2 commits per change |
| ResizeObserver loop errors | none (console + window `error`) |

- `useVisualViewport` uses one module-level `subscribe` and a cached snapshot that changes only when rounded values change, so there are no per-scroll re-renders.
- StickyActionBar's ResizeObserver writes `--sticky-bar-h` on `:root`. That invalidates styles document-wide, but only when the bar's height changes (rare, measured no loop). Acceptable.

## 4. StickyTableScrollbar on coarse pointer

Measured on `/dev/mobile-kit` (dev server) with fine vs coarse pointer.

| | fine 1280 | coarse 390 |
|---|---|---|
| custom bars rendered | 1 | **0 (returns null, native scroll kept)** |
| work during 25 scroll steps | 15 commits, 6 layouts, script 17.5 ms | **0 commits, 0 layouts**, script 3.1 ms |
| window `scroll` listener / MutationObserver | attached | **still attached** |

- **Finding (minor, not fixed — not my file):** on coarse pointers the effects still subscribe:
  - window scroll/resize listeners
  - table scroll listener
  - ResizeObserver
  - subtree MutationObserver
  - an ancestor `getComputedStyle` walk at mount

  `sync()` short-circuits to two same-value setStates, so the cost is ~0 (measured above).
- **Suggested patch (`src/components/StickyTableScrollbar.jsx`):** add `if (off) return` at the top of each subscribing effect and add `off` to their deps.

## 5. Core Web Vitals

Login (public), Lighthouse mobile, median of 3:

| build | score | FCP | LCP | TBT | CLS | JS transfer |
|---|---|---|---|---|---|---|
| deployed skt-dev.vercel.app | 76 | 1.76 s | **4.54 s** | 260 ms | 0.002 | 116 KB |
| local baseline 48ed1a3 | 82 | 1.97 s | 4.44 s | 128 ms | 0 | 105 KB |
| local WP3 HEAD | 82 | 2.04 s | 4.43 s | 135 ms | 0 | 113 KB |
| local final | 81 | 2.04 s | 4.44 s | 141 ms | 0 | 111 KB |

- **Login LCP of about 4.4 s is pre-existing (identical on baseline), not caused by the overhaul.**
- LCP = the `<h1>` inside `.animate-fade-up`. Lighthouse puts 79% of it in render delay; main thread shows Style & Layout 1.43 s.
- Login also loads:
  - `skt_bg.webp` 228 KB
  - `logo/skt-logo-dark.png` 185 KB (512 px, loaded via the `<img onError>` fallback)
  - `logo/skt-logo.png` 51 KB (512 px for a small mark)
- → **Escalate to frontend-lead** (Login.jsx/public assets are outside WP5, and the fade/backdrop-blur is a design call). Candidates:
  - resize/compress the logo to the displayed size (WebP)
  - a mobile-sized background
  - drop the entrance fade on the LCP text (or start it visible)
  - look at `backdrop-blur-xl` over a full-bleed image

Authenticated routes, phone 390, 150 ms RTT / 1.6 Mbps / 4x CPU, mocked API:

| route | build | FCP | LCP | TBT | CLS | JS files |
|---|---|---|---|---|---|---|
| Buy | baseline | 1.53 s | 3.28 s | 67 ms | 0.012 | 3 |
| Buy | WP3 HEAD (5 runs) | 1.52 s | 3.14 s | 173 ms | 0.002 | 16 |
| Sales | baseline | 1.54 s | 3.37 s | 31 ms | 0.012 | 3 |
| Sales | WP3 HEAD | 1.66 s | 3.48 s | 187 ms | 0.002 | 17 |

- LCP is flat and CLS improved.
- TBT on Buy/Sales rose by about 110–150 ms at 4x. That is the cost of the extra stepper/section/primitive JS evaluated on first load.
- The final build adds +0.7 KB gz (a11y ids); load was not re-measured separately.

Interaction CLS (phone Buy):

| event | result |
|---|---|
| page load | 0.0019 |
| "ถัดไป" with an empty step | 0.013, all input-attributed (`hadRecentInput`), so it counts as 0 |
| step 1 → 2 | one 0.12 shift, input-attributed, so it counts as 0; no late shifts |
| ComboBox picker Sheet open / pick / close | 0 |

All within CLS < 0.1.

## 6. a11y follow-up from mobile-qa-report (M7–M11) — `0454de8`

| # | fix | verified (Playwright, 390 + 1280, Buy + Sales) |
|---|---|---|
| M8/M9 | every field label has `htmlFor` → control `id`. Ids: `buy-<key>`, `sales-<key>`, trailers `sales-t<idx>-<key>`. RefDocField uses a single `sales-refDoc` for whichever input renders. Helpers `fieldId/errId/describedBy` live in `buyShared.js` / `salesShared.js` | 0 unlabeled controls (14 / 37 / 7 / 32 visible controls), 0 duplicate ids, 0 dangling `for` |
| M11 | error `<p>` gets an `id`; the field gets `aria-describedby` while the error is shown. `ComboBox` gained an optional `ariaDescribedBy` prop. The phone `Field` (Sales stepper) takes `htmlFor`/`errorId` | after "ถัดไป": focused `memberId` has `aria-invalid=true` + `aria-describedby` → the error text resolves; 0 dangling describedby |
| M10 | `clearError` moved from `onFocus` to `onChange` (the hint `clearHint` stays on focus) | the validator-focused field keeps its error; typing 1 char clears `aria-invalid` + `describedby` |
| M7 | DateInput calendar buttons (`buy/`, `sales/`) use `focusRingCls` | — |

- Untouched: refs map, Enter-to-next order, validation rules, payload.
- Desktop Enter sequence at 1280 is identical before/after:

  | page | sequence |
  |---|---|
  | Buy | citizenId → memberId → fullName → คลัง → … → weights |
  | Sales | citizenId → memberId → fullName → คลัง → … → จำนวนรถพ่วง → trailer 1 |

- **Note for QA (pre-existing):** with an empty name search, Enter on fullName jumps to คลัง and skips the address fields. This is the same on the WP3 build, but it differs from the `mobile-baseline.md` static order (fullName → houseNo → …). Please check it against the WP0 recording.

## Summary — fixed vs not fixed

| item | status | why |
|---|---|---|
| Intl formatter per call (Sales 100 ms keystroke) | **fixed** | root cause, zero behaviour change |
| a11y M7–M11 | **fixed** | requested by lead |
| section memoisation | not fixed | measured below the 16 ms p75 bar; high regression risk |
| manualChunks grouping | not changed | measured: entry grows, route gain ≤ 0.7 KB |
| SearchField side-effect (entry −2 KB gz) | reverted | Buy route LCP +152 ms on HTTP/1.1; re-measure on HTTP/2 host |
| StickyTableScrollbar coarse listeners | finding | zero measured cost; patch suggested |
| Login LCP 4.4 s (images, fade-in) | escalate → frontend-lead | pre-existing, outside WP5 files, design trade-off |
