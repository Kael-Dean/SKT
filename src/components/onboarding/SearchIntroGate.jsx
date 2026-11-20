// src/components/onboarding/SearchIntroGate.jsx
// ─────────────────────────────────────────────────────────────────────────────
// Decides WHEN the one-time function search intro opens (rules: lib/searchIntro.js).
// Mounted once in AppLayout and stays small: the overlay and its demo are a lazy chunk that
// people who have already seen the intro never download.
//
// Plain React.lazy, not lazyWithReload: a missing chunk must not reload the page under someone's
// work for an optional intro. It just stays unseen and tries again on the next visit.
// ─────────────────────────────────────────────────────────────────────────────
import { Component, lazy, Suspense, useCallback, useEffect, useState } from "react"
import { useLocation } from "react-router-dom"
import { getUser } from "../../lib/auth"
import { getMyPermissionsStatus, useMyPermissionsVersion } from "../../lib/myPermissions"
import { useOnboarding } from "../../lib/onboarding"
import { isOnboardingGalleryPath, usePreview } from "../../lib/previewMode"
import {
  findFunctionSearch,
  hasSeenSearchIntro,
  isPageBusy,
  isSearchIntroEligible,
  syncSearchIntroSeen,
} from "../../lib/searchIntro"
import { getUiFlagsStatus, loadUiFlags, useUiFlagsVersion } from "../../lib/uiFlags"
import { useTourState } from "../../lib/tourState"
import { useIsPhone } from "../../hooks/useMediaQuery"

const loadSearchIntro = () => import("./SearchIntro")
const SearchIntro = lazy(loadSearchIntro)

const SETTLE_MS = 800 // let the page finish loading first
const RETRY_MS = 1000 // while the search box is missing or something else is open

class ChunkBoundary extends Component {
  state = { failed: false }
  static getDerivedStateFromError() {
    return { failed: true }
  }
  componentDidCatch() {
    this.props.onError()
  }
  render() {
    return this.state.failed ? null : this.props.children
  }
}

export default function SearchIntroGate() {
  const { pathname } = useLocation()
  const isPhone = useIsPhone()
  const onboarding = useOnboarding()
  const tour = useTourState()
  useMyPermissionsVersion() // re-render when permissions finish loading
  const uiFlagsVersion = useUiFlagsVersion() // …and when the per-account seen flags load
  const userId = getUser()?.id ?? null
  const [phase, setPhase] = useState("waiting") // waiting → showing → done

  // Per-account seen flags: load once per login, then line the server and this device up.
  useEffect(() => {
    if (userId !== null) loadUiFlags()
  }, [userId])
  useEffect(() => {
    syncSearchIntroSeen(userId)
  }, [userId, uiFlagsVersion])

  // On the gallery and during a preview the real one holds back: it would use up its one showing.
  const previewing = usePreview()
  const wanted =
    phase === "waiting" &&
    !previewing &&
    !isOnboardingGalleryPath(pathname) &&
    isSearchIntroEligible({
      userId,
      isPhone,
      onboardingStatus: onboarding.status,
      needsOnboarding: onboarding.needsOnboarding,
      locked: onboarding.locked,
      tourActive: tour.active,
      permissionsStatus: getMyPermissionsStatus(),
      uiFlagsStatus: getUiFlagsStatus(),
    }) &&
    !hasSeenSearchIntro(userId)

  // Restarts on navigation: a page that just opened hasn't settled yet.
  useEffect(() => {
    if (!wanted) return
    loadSearchIntro().catch(() => {}) // the lazy render below reports a failure
    let timer
    const check = (wasBlocked) => {
      if (!findFunctionSearch() || isPageBusy()) timer = setTimeout(() => check(true), RETRY_MS)
      // Don't pop up the instant a sheet closes: wait for the page to settle again.
      else if (wasBlocked) timer = setTimeout(() => check(false), SETTLE_MS)
      else setPhase("showing")
    }
    timer = setTimeout(() => check(false), SETTLE_MS)
    return () => clearTimeout(timer)
  }, [wanted, pathname])

  const close = useCallback(() => setPhase("done"), [])
  const postpone = useCallback(() => setPhase("waiting"), [])

  if (phase !== "showing") return null
  return (
    <ChunkBoundary onError={close}>
      <Suspense fallback={null}>
        <SearchIntro userId={userId} onClose={close} onPostpone={postpone} />
      </Suspense>
    </ChunkBoundary>
  )
}
