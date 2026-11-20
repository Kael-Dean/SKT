// src/lib/searchIntro.js
// ─────────────────────────────────────────────────────────────────────────────
// One-time "what's new" intro for the header function search: seen state and the
// eligibility rules. No React here.
//   gate     components/onboarding/SearchIntroGate.jsx (always loaded, decides when)
//   overlay  components/onboarding/SearchIntro.jsx     (lazy chunk)
//
// Seen state is per ACCOUNT: the server flag UI_FLAG.SEARCH_INTRO (lib/uiFlags.js), so seeing it on
// one device stops it on every other device. localStorage["search_intro_seen:<userId>"] stays as the
// per-device copy: the cross-tab race guard, and the whole answer while the backend lacks ui-flags.
// It must survive logout, so this key must never join AUTH_STORAGE_KEYS in lib/auth.js.
// ─────────────────────────────────────────────────────────────────────────────

import { isPreviewActive } from "./previewMode"
import { getUiFlagsStatus, hasUiFlag, markUiFlag, UI_FLAG } from "./uiFlags"

const SEEN_PREFIX = "search_intro_seen:"
const FUNCTION_SEARCH_SELECTOR = '[data-tour="function-search"]'
const OPEN_OVERLAY_SELECTOR = '[role="dialog"], [role="alertdialog"], [aria-modal="true"]'
const EDITABLE_SELECTOR = "input, textarea, select, [contenteditable='true']"

const hasUserId = (userId) => userId !== null && userId !== undefined && userId !== ""

export const searchIntroKey = (userId) => `${SEEN_PREFIX}${userId}`

function hasSeenOnDevice(userId) {
  try {
    return localStorage.getItem(searchIntroKey(userId)) !== null
  } catch {
    return true // unreadable storage counts as seen: if we can't remember showing it, it could repeat forever
  }
}

/** Seen on this device, or on any device of this account (once the server flags have loaded). */
export function hasSeenSearchIntro(userId) {
  return hasSeenOnDevice(userId) || hasUiFlag(UI_FLAG.SEARCH_INTRO) === true
}

/**
 * Brings the two copies together: seen elsewhere → remember it on this device too; seen here before
 * the server kept flags (or a write that failed) → tell the server so other devices stop showing it.
 */
export function syncSearchIntroSeen(userId) {
  if (!hasUserId(userId) || isPreviewActive() || getUiFlagsStatus() !== "ready") return
  const onServer = hasUiFlag(UI_FLAG.SEARCH_INTRO) === true
  const onDevice = hasSeenOnDevice(userId)
  if (onServer && !onDevice) {
    try {
      localStorage.setItem(searchIntroKey(userId), "1")
    } catch {
      // storage disabled: the server flag still answers for this session
    }
  } else if (onDevice && !onServer) {
    markUiFlag(UI_FLAG.SEARCH_INTRO)
  }
}

/**
 * Marks it seen and returns true only if this call is the one that may open the overlay:
 * false when it was already seen (another tab won the race) or the write did not stick.
 */
export function claimSearchIntro(userId) {
  if (isPreviewActive()) return false
  if (hasUiFlag(UI_FLAG.SEARCH_INTRO) === true) return false
  try {
    const key = searchIntroKey(userId)
    if (localStorage.getItem(key) !== null) return false
    localStorage.setItem(key, "1")
    if (localStorage.getItem(key) === null) return false
  } catch {
    return false
  }
  markUiFlag(UI_FLAG.SEARCH_INTRO)
  return true
}

/**
 * The conditions that come from app state. While any fails nothing is shown and nothing is
 * marked, so the intro still appears once they clear.
 *   onboardingStatus   useOnboarding().status: out_of_scope (Super Admin, login-only) is a final answer
 *   permissionsStatus  getMyPermissionsStatus(): until loaded the demo could list what the user can't open
 *   uiFlagsStatus      getUiFlagsStatus(): until the server answers, another device may already have shown it
 */
export function isSearchIntroEligible({
  uiFlagsStatus,
  userId,
  isPhone,
  onboardingStatus,
  needsOnboarding,
  locked,
  tourActive,
  permissionsStatus,
}) {
  if (!hasUserId(userId) || isPhone) return false
  if (onboardingStatus !== "ready" && onboardingStatus !== "out_of_scope") return false
  if (needsOnboarding || locked || tourActive) return false
  if (uiFlagsStatus !== "ready" && uiFlagsStatus !== "unsupported") return false
  return permissionsStatus === "ready" || permissionsStatus === "unsupported"
}

/** The real search box, or null when it is not on screen (the Topbar hides its wrapper below md). */
export function findFunctionSearch() {
  const el = document.querySelector(FUNCTION_SEARCH_SELECTOR)
  return el && el.getClientRects().length > 0 ? el : null
}

/**
 * Something the intro must not interrupt: a background tab (it would burn the one showing unseen),
 * an open overlay (Portal's scroll lock also covers the tour's finish flourish), or someone typing.
 */
export function isPageBusy() {
  if (document.visibilityState !== "visible") return true
  if (document.body.dataset.sheetOpen) return true
  if (document.activeElement?.matches?.(EDITABLE_SELECTOR)) return true
  return [...document.querySelectorAll(OPEN_OVERLAY_SELECTOR)].some((el) => el.getClientRects().length > 0)
}
