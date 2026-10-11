# Mobile overhaul — baseline (dev @ 48ed1a3, 2026-10-11)

Captured right after merging `feat/role-permissions` into `dev`, before any mobile work.

| Gate | Baseline | Rule for every later commit |
|---|---|---|
| `npm run build` | PASS (built in ~12s) | must pass |
| `npm run lint` | ✖ 292 problems (242 errors, 50 warnings) (pre-existing, mostly react-hooks/exhaustive-deps + no-unused-vars; `vite.config.js` process no-undef) | no NEW errors in touched files; count must not grow |
| `npx impeccable detect src/pages/work src/components` | 31 anti-patterns found. (side-tab stripes `w-1 bg-emerald-600` in 11 trading pages, NotificationBell, Sidebar; ai-color-palette in RelocationPanel) | count must not grow; touched files should drop their findings |

Raw outputs: `handoff/baseline/lint.txt`, `handoff/baseline/impeccable.txt`, `handoff/baseline/chunks.txt` (dist chunk sizes).

Key chunk sizes (bytes): Buy 71375, Sales 77646, index 138239, vendor-react 223040.

## Desktop Enter-to-next order (Buy) — static reference
From `src/pages/work/Buy.jsx` `useEnterNavigation` (lines 97-152). The post-change desktop flow must walk exactly this order (filtered by the same enabled/visible rules):

- person: citizenId → memberId → fullName → houseNo → moo → subdistrict → district → province → postalCode → phone
- company: companyName → taxId → companyPhone → hqHouseNo → hqMoo → hqSubdistrict → hqDistrict → hqProvince → hqPostalCode → brHouseNo → brMoo → brSubdistrict → brDistrict → brProvince → brPostalCode
- order: product → riceType → subrice → condition → fieldType → riceYear → businessType → program → branchName → klangName → entryWeightKg → exitWeightKg → moisturePct → impurityPct → deductWeightKg (only when manualDeduct) → gram → unitPrice → amountTHB → paymentRefNo → comment → payment → issueDate

Live recording (playwright-cli at 1280, activeElement per Enter) is deferred to QA (WP6) because it needs staging login credentials — QA will record it on the pre-change deploy (vercel deployment of this commit) vs. post-change.

## Correction (2026-10-11, lead)
The order lists above are the `useEnterNavigation` arrays only. In the baseline, the **fullName** field does not use `onEnter`: its own `handleNameKeyDown` (Buy.jsx@48ed1a3:1568-1585) picks the highlighted search result, or otherwise calls `focusKlangOrBranchOrEntry()` and jumps straight to คลัง/สาขา/น้ำหนักเข้า, skipping the address fields. That jump is **original behaviour, not a regression** — both QA runs (a11y-qa and perf) recorded the same order on baseline and on the overhauled build.
